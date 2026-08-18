import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// Telemetry ingest: identifier authority and parameter screening.
///
/// ## The defects these tests pin
///
/// The handler used to compute `authenticateParent` and then discard it.
/// `parent_id` fell back to the request body when unauthenticated, and
/// `child_id` was read from the body **unconditionally, with no ownership
/// check** — so any anonymous caller could write unbounded rows attributed to
/// arbitrary families and children. Nothing in the route was rate limited.
///
/// The PII screen was `/nickname|email|birth|query|text|transcript/i` applied to
/// the serialized params, which rejected any event whose *value* contained
/// "text" while accepting `child_name`, `dob` and `phone`. A substring match over
/// a blob cannot tell a key from a value, so it failed in both directions.

const writes = [];

function fakeDb() {
  return {
    prepare(sql) {
      return {
        bind: (...params) => ({
          async run() {
            writes.push({ sql, params });
            return { meta: { changes: 1 } };
          },
          async all() { return { results: [] }; },
          async first() { return null; },
        }),
        async run() { writes.push({ sql, params: [] }); return { meta: { changes: 1 } }; },
        async all() { return { results: [] }; },
        async first() { return null; },
      };
    },
  };
}

/// The Durable Object stub stands in for `FamilyState`, the ownership authority.
function env({ children = [], authenticated = false } = {}) {
  return {
    DB: fakeDb(),
    ENVIRONMENT: 'development',
    AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef', // secret-scan:allow test fixture
    CACHE: { async get() { return null; }, async put() {} },
    FAMILY_STATE: {
      idFromName: () => 'family-id',
      get: () => ({
        async fetch() {
          return new Response(JSON.stringify({ success: true, data: { children } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      }),
    },
    __authenticated: authenticated,
  };
}

async function post(body, options = {}) {
  const { default: route } = await import('../src/routes/analyticsIngest.ts');
  return route.request('/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.authorization ? { Authorization: options.authorization } : {}),
    },
    body: JSON.stringify(body),
  }, env(options));
}

function lastWrite() {
  return writes[writes.length - 1];
}

test('an anonymous app_open is stored with no identifiers, whatever it claims', async () => {
  writes.length = 0;
  const res = await post({
    event: 'app_open',
    parent_id: 'parent-victim',
    child_id: 'child-victim',
  });

  assert.equal(res.status, 201);
  const write = lastWrite();
  assert.match(write.sql, /INSERT INTO analytics_events/);
  // (id, parent_id, child_id, event_name, params_json)
  assert.equal(write.params[1], null, 'parent_id must never come from the body');
  assert.equal(write.params[2], null, 'child_id must never come from the body');
  assert.equal(write.params[3], 'app_open');
});

test('an anonymous caller cannot write any other event', async () => {
  writes.length = 0;
  for (const event of ['video_started', 'content_completed', 'search', 'download_started']) {
    const res = await post({ event, parent_id: 'parent-victim' });
    assert.equal(res.status, 401, `${event} must require a session`);
  }
  assert.equal(writes.length, 0, 'nothing may be written for a refused event');
});

test('an unknown event name is refused', async () => {
  writes.length = 0;
  const res = await post({ event: 'exfiltrate' });
  assert.equal(res.status, 400);
  assert.equal(writes.length, 0);
});

test('params keys are allow-listed, so PII-shaped keys are refused', async () => {
  writes.length = 0;
  for (const key of ['child_name', 'dob', 'phone', 'email', 'nickname', 'address', 'query', 'transcript']) {
    const res = await post({ event: 'app_open', params: { [key]: 'value' } });
    assert.equal(res.status, 400, `${key} must be refused`);
    const payload = await res.json();
    assert.match(payload.error, /not allowed/);
  }
  assert.equal(writes.length, 0);
});

test('a legitimate value containing the word "text" is accepted', async () => {
  // The old denylist searched the serialized JSON, so this was rejected while
  // `child_name` sailed through.
  writes.length = 0;
  const res = await post({
    event: 'app_open',
    params: { source: 'text_only_mode', mode: 'read_to_me', position_ms: 1200 },
  });

  assert.equal(res.status, 201);
  const stored = JSON.parse(lastWrite().params[4]);
  assert.deepEqual(stored, { source: 'text_only_mode', mode: 'read_to_me', position_ms: 1200 });
});

test('nested params are refused, because free text hides in them', async () => {
  writes.length = 0;
  const res = await post({ event: 'app_open', params: { source: { nested: 'child name here' } } });
  assert.equal(res.status, 400);
  assert.equal(writes.length, 0);
});

test('an over-long param value is refused', async () => {
  writes.length = 0;
  const res = await post({ event: 'app_open', params: { source: 'x'.repeat(200) } });
  assert.equal(res.status, 400);
  assert.equal(writes.length, 0);
});

test('params must be an object, not an array or scalar', async () => {
  writes.length = 0;
  for (const params of [['a'], 'a', 5]) {
    const res = await post({ event: 'app_open', params });
    assert.equal(res.status, 400);
  }
  assert.equal(writes.length, 0);
});

test('the ingest route is registered with the rate limiter', () => {
  // The quota lives in index.ts middleware, which this suite cannot mount, so
  // the registration is asserted on the source. Its absence was half the defect.
  const source = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');
  assert.match(source, /app\.use\('\/api\/v1\/analytics\/\*', analyticsLimit\)/);
  assert.match(source, /analyticsLimit/, 'the preset must be imported');
});

test('telemetry retention is enforced by the daily cron', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/scheduled/cleanup.ts', import.meta.url)), 'utf8');
  assert.match(source, /DELETE FROM analytics_events WHERE created_at < datetime\('now', \?\)/);
  assert.match(source, /ANALYTICS_RETENTION_DAYS/);
  // A failure must be visible rather than swallowed: a silently growing table is
  // the failure mode that matters here.
  assert.match(source, /console\.error\('cleanup_failed'/);
});
