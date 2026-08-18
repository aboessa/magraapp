import assert from 'node:assert/strict';
import test from 'node:test';

/// Assertions against the **real** worker entrypoint.
///
/// ## Why this file could not exist before
///
/// `src/index.ts` and 73 other modules imported relative paths without a file
/// extension. The Workers bundler resolves that; Node's ESM loader does not. One
/// further blocker sat in `do/StoryCollab.ts`, whose constructor used a
/// TypeScript parameter property that the type-stripping loader rejects.
///
/// The consequence was that **no test had ever loaded the entrypoint**, so
/// nothing observable to CI depended on middleware order, route mount order or
/// CORS actually being applied — the three properties whose regressions the
/// comments in `index.ts` record having already shipped twice.
///
/// Everything here is deliberately checked through `app.request(...)` rather than
/// by reading source, because composition is the property under test.
/// The default export is the worker object (`{ fetch, scheduled, queue }`), not
/// the Hono instance, so requests go through the same `fetch` Cloudflare calls.
const { default: worker } = await import('../src/index.ts');

/// Bindings are minimal on purpose. The D1 stub answers "no rows" to everything,
/// which is what a guard needs to refuse: `requireAdmin` reads the session and the
/// seeded-user check before deciding. Without any DB it throws a 500, which is a
/// property of the harness rather than the product — so the stub is supplied
/// rather than the assertion loosened.
const emptyDb = {
  prepare() {
    return {
      bind: () => ({
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() { return { meta: { changes: 0 } }; },
      }),
      async first() { return null; },
      async all() { return { results: [] }; },
      async run() { return { meta: { changes: 0 } }; },
    };
  },
  async batch(statements) { return statements.map(() => ({ meta: { changes: 0 } })); },
};

const env = (overrides = {}) => ({
  ENVIRONMENT: 'development',
  API_VERSION: 'v1',
  DB: emptyDb,
  CACHE: { async get() { return null; }, async put() {} },
  ...overrides,
});

const ctx = { waitUntil() {}, passThroughOnException() {} };

/// `app.request`-style helper over the worker's real fetch handler.
function request(path, init = {}, overrides = {}) {
  return worker.fetch(new Request(`https://api.majarra.app${path}`, init), env(overrides), ctx);
}

const app = { request };

test('CORS is applied to /api/* by the real app', async () => {
  const res = await app.request('/api/v1/series', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:64686',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,x-platform,x-app-version',
    },
  }, env());

  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:64686');

  const allowed = (res.headers.get('Access-Control-Allow-Headers') ?? '').toLowerCase();
  for (const header of ['authorization', 'x-platform', 'x-app-version', 'x-admin-actor', 'content-type', 'accept']) {
    assert.ok(allowed.includes(header), `${header} is not allowed by the mounted middleware`);
  }
});

test('an unrelated origin is refused by the mounted middleware', async () => {
  const res = await app.request('/api/v1/series', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.com', 'Access-Control-Request-Method': 'GET' },
  }, env());
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

test('the analytics ingest route carries rate-limit headers', async () => {
  // Registration is middleware on the app, so only a mounted request can prove
  // it. The route had no quota at all before.
  const res = await app.request('/api/v1/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:1' },
    body: JSON.stringify({ event: 'not_an_allowed_event' }),
  }, env());

  assert.ok(res.headers.get('X-RateLimit-Limit'), 'the limiter did not run for /api/v1/analytics/*');
  // The event is refused on its own merits; what matters here is that the quota
  // middleware ran first.
  assert.equal(res.status, 400);
});

test('auth endpoints carry the strict quota', async () => {
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }, env());
  assert.ok(res.headers.get('X-RateLimit-Limit'), 'strictAuthLimit is not mounted on /api/v1/auth/*');
});

test('editorial recommendation writes are no longer reachable without a session', async () => {
  // The regression: `POST /api/v1/recommendations/admin` had no authentication
  // whatsoever and wrote rows served to every child's home rail.
  const res = await app.request('/api/v1/recommendations/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ series_id: 'series-1', is_pinned: true }),
  }, env());

  assert.notEqual(res.status, 201, 'the unauthenticated write must not succeed');
  assert.ok(res.status === 404 || res.status === 401 || res.status === 405, `unexpected ${res.status}`);
});

/// A database that reports at least one seeded administrator.
///
/// This matters: `requireAdmin` deliberately allows a pre-seed break-glass path
/// while `admin_credentials` is empty (`lib/adminAuth.ts`), which is exactly the
/// state the audit found in the local database. Asserting against an empty DB
/// would therefore test the fresh-install posture and conclude, wrongly, that the
/// guard is open.
const seededDb = {
  prepare(sql) {
    const seeded = sql.includes('FROM admin_credentials');
    return {
      bind: () => ({
        async first() { return seeded ? { total: 1 } : null; },
        async all() { return { results: [] }; },
        async run() { return { meta: { changes: 0 } }; },
      }),
      async first() { return seeded ? { total: 1 } : null; },
      async all() { return { results: [] }; },
      async run() { return { meta: { changes: 0 } }; },
    };
  },
  async batch(statements) { return statements.map(() => ({ meta: { changes: 0 } })); },
};

test('the admin recommendations route requires a session once an admin exists', async () => {
  const res = await app.request('/api/v1/admin/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ series_id: 'series-1' }),
  }, { DB: seededDb });

  assert.equal(res.status, 401, 'requireAdmin must refuse an anonymous caller');
});

test('the pre-seed break-glass path is limited to a fresh install', async () => {
  // With no credentials seeded the shared-key path is open by design, so the
  // request reaches the handler and is refused on its own validation instead.
  // Recorded as an assertion so the exemption stays visible and narrow.
  const res = await app.request('/api/v1/admin/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ series_id: 'does-not-exist' }),
  }, env());

  assert.equal(res.status, 400, 'a fresh install reaches validation, and validation refuses');
  const payload = await res.json();
  assert.match(payload.error, /series_id/);
});

test('two-segment admin literals are not shadowed by generic :id routes', async () => {
  // `GET /admin/games/ops` and `/admin/games/analytics` were both swallowed by
  // `route.get('/games/:id')` in adminContent.ts, so the Games Operations screen
  // answered `{"error":"Game not found"}` with a 404. Mount order fixed it, and
  // only a mounted request can prove the fix holds.
  //
  // Anonymous, so the expected answer is 401 from requireAdmin. A 404 would mean
  // the literal bound as an id again.
  //
  // `/admin/recommendations` is deliberately absent: it exposes POST only, so a
  // GET 404 there is correct and says nothing about shadowing.
  for (const path of ['/api/v1/admin/games/ops', '/api/v1/admin/games/analytics']) {
    const res = await app.request(path, { method: 'GET' }, env());
    assert.notEqual(res.status, 404, `${path} is shadowed by a generic :id route`);
  }
});

test('publish endpoints exist for every publishable type and require a session', async () => {
  // Four of the six publishable types had no endpoint at all, which is the
  // mechanical reason nothing of those types was ever published.
  for (const path of [
    '/api/v1/admin/stories/story-1/publish',
    '/api/v1/admin/books/book-1/publish',
    '/api/v1/admin/games/game-1/publish',
    '/api/v1/admin/projects/project-1/publish',
    '/api/v1/admin/series/series-1/publish',
    '/api/v1/admin/episodes/episode-1/publish',
  ]) {
    const res = await app.request(path, { method: 'POST' }, { DB: seededDb });
    assert.notEqual(res.status, 404, `${path} is not mounted`);
    assert.equal(res.status, 401, `${path} must refuse an anonymous caller`);
  }
});

test('health and root negotiation stay outside the API guards', async () => {
  const health = await app.request('/health', {}, env());
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
});
