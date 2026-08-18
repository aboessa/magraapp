import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { corsOptions, resolveAllowedOrigin, ALLOW_HEADERS } from '../src/lib/corsOptions.ts';

/// CORS contract for `/api/*`.
///
/// ## What changed and why
///
/// This file used to declare its own `cors({...})` literal, so every assertion
/// below tested a copy of the configuration rather than the configuration. That
/// is not a theoretical weakness: removing `X-Platform` from the real middleware
/// left all eight tests green while every `/api/v1/*` request from Flutter Web
/// failed *after* a successful preflight, and `index.ts` records the same class
/// of regression having already happened for `X-Admin-Actor`.
///
/// The options now come from `src/lib/corsOptions.ts`, which `index.ts` imports,
/// so a header removed from the product is a header removed from these tests.
/// `assertIndexUsesTheSharedContract` stops the copy being reintroduced.
const app = new Hono();
app.use('/api/*', cors(corsOptions));
app.get('/api/*', (c) => c.json({ success: true }));

const env = (overrides = {}) => ({ ENVIRONMENT: 'development', API_VERSION: 'v1', ...overrides });

async function preflight(origin, path, requestHeaders = 'authorization,x-platform,x-app-version', overrides = {}) {
  return app.request(path, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': requestHeaders,
    },
  }, env(overrides));
}

test('the worker uses the shared contract instead of an inline copy', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');
  assert.match(source, /cors\(corsOptions\)/, 'index.ts must apply the shared options object');
  assert.match(source, /from '\.\/lib\/corsOptions\.ts'/);
  assert.doesNotMatch(source, /allowHeaders:\s*\[/, 'a second header list in index.ts would drift from this suite');
});

/// The headers first-party clients actually send. Removing one breaks that
/// client silently, after the preflight succeeds.
const REQUIRED_ALLOW_HEADERS = [
  'content-type',
  'authorization',
  'accept',
  'x-platform',
  'x-app-version',
  'x-parent-proof',
  'idempotency-key',
  'x-admin-actor',
];

test('the shared contract lists every header a first-party client sends', () => {
  const declared = ALLOW_HEADERS.map((header) => header.toLowerCase());
  for (const header of REQUIRED_ALLOW_HEADERS) {
    assert.ok(declared.includes(header), `${header} is missing from ALLOW_HEADERS`);
  }
});

test('preflight from Flutter Web on localhost allows every client header', async () => {
  const res = await preflight('http://localhost:64686', '/api/v1/series');
  assert.equal(res.status, 204, `expected 204, got ${res.status}`);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:64686');

  const allowed = (res.headers.get('Access-Control-Allow-Headers') ?? '').toLowerCase();
  for (const header of REQUIRED_ALLOW_HEADERS) {
    assert.ok(allowed.includes(header), `${header} not allowed; the client would break after a successful preflight`);
  }
});

test('preflight advertises every method the API implements', async () => {
  const res = await preflight('http://localhost:64686', '/api/v1/series');
  const methods = (res.headers.get('Access-Control-Allow-Methods') ?? '').toUpperCase();
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.ok(methods.includes(method), `${method} missing from ${methods}`);
  }
});

test('the 127.0.0.1 development variant is allowed on any port', async () => {
  const res = await preflight('http://127.0.0.1:54321', '/api/v1/series');
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:54321');
});

test('production, api and dashboard origins are allowed', async () => {
  for (const origin of ['https://majarra.app', 'https://www.majarra.app', 'https://api.majarra.app', 'https://admin.majarra.app']) {
    const res = await preflight(origin, '/api/v1/series');
    assert.equal(res.status, 204, `${origin} preflight failed`);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin);
  }
});

test('an unrelated origin receives no allow-origin header', async () => {
  const res = await preflight('https://evil.com', '/api/v1/series');
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

test('a lookalike domain is refused', async () => {
  // `majarra.app.evil.com` must not satisfy the suffix rule.
  for (const origin of ['https://majarra.app.evil.com', 'http://majarra.app', 'https://notmajarra.app']) {
    assert.equal(resolveAllowedOrigin(origin, {}), null, `${origin} must be refused`);
  }
});

/// This branch had no coverage at all, so an operator could set the variable and
/// silently disable the built-in rules.
test('ALLOWED_ORIGINS is additive, never a replacement', async () => {
  const extra = 'https://partner.example';
  const added = await preflight(extra, '/api/v1/series', undefined, { ALLOWED_ORIGINS: `${extra},https://other.example` });
  assert.equal(added.headers.get('Access-Control-Allow-Origin'), extra);

  const stillAllowed = await preflight('https://majarra.app', '/api/v1/series', undefined, { ALLOWED_ORIGINS: extra });
  assert.equal(stillAllowed.headers.get('Access-Control-Allow-Origin'), 'https://majarra.app', 'the override must not disable the Majarra rule');

  const stillBlocked = await preflight('https://evil.com', '/api/v1/series', undefined, { ALLOWED_ORIGINS: extra });
  assert.equal(stillBlocked.headers.get('Access-Control-Allow-Origin'), null);

  const localhostStillAllowed = await preflight('http://localhost:1234', '/api/v1/series', undefined, { ALLOWED_ORIGINS: extra });
  assert.equal(localhostStillAllowed.headers.get('Access-Control-Allow-Origin'), 'http://localhost:1234');
});

test('the contract is uniform across public, media and admin paths', async () => {
  const paths = [
    '/api/v1/series',
    '/api/v1/stories/story-bird-home/pages?language=ar',
    '/api/v1/app-config',
    '/api/v1/planets',
    '/api/v1/media/assets/asset-1',
    '/api/v1/admin/recommendations',
  ];

  for (const path of paths) {
    const res = await preflight('http://localhost:64686', path);
    assert.equal(res.status, 204, `${path} preflight returned ${res.status}`);
    const allowed = (res.headers.get('Access-Control-Allow-Headers') ?? '').toLowerCase();
    assert.ok(allowed.includes('x-platform'), `${path} lost x-platform`);
    assert.ok(allowed.includes('authorization'), `${path} lost authorization`);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:64686');
  }
});

test('credentials stay disabled, so a wildcard origin carries no ambient authority', async () => {
  assert.equal(corsOptions.credentials, false);
  const res = await preflight('http://localhost:64686', '/api/v1/series');
  assert.equal(res.headers.get('Access-Control-Allow-Credentials'), null);
});

test('a request with no Origin is answered, not refused', () => {
  // Native mobile clients send no Origin header at all.
  assert.equal(resolveAllowedOrigin(undefined, {}), '*');
});

test('range and validator headers stay exposed for media playback', async () => {
  const res = await preflight('http://localhost:64686', '/api/v1/media/assets/asset-1');
  const exposed = (res.headers.get('Access-Control-Expose-Headers') ?? '').toLowerCase();
  for (const header of ['content-range', 'etag', 'content-length']) {
    assert.ok(exposed.includes(header), `${header} must stay exposed or seeking breaks`);
  }
});
