import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { RateLimiter } from '../src/do/RateLimiter.ts';

/// Rate limiting (SEC-005).
///
/// ## The defect these tests pin
///
/// Counters lived in a module-level `Map` — one per isolate — with a best-effort
/// KV mirror whose errors were swallowed. So "5 login attempts per minute" was
/// "5 per minute per isolate the request happened to land on", and a caller who
/// retried got a fresh budget. Several of the most expensive endpoints were not
/// registered with the limiter at all: playback and narration session creation
/// (each mints a lease and a capability token), signed-media redemption,
/// child-settings and notification writes, and the creation upload that writes an
/// R2 object.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/* ------------------------------------------------ the Durable Object itself */

/**
 * A `DurableObjectState` double with real storage semantics.
 *
 * `blockConcurrencyWhile` is honoured by chaining onto a promise, so the
 * serialization the counter depends on is actually exercised rather than assumed.
 */
function fakeState() {
  const store = new Map();
  let alarm = null;
  let queue = Promise.resolve();
  return {
    storage: {
      async get(key) { return store.get(key); },
      async put(key, value) { store.set(key, structuredClone(value)); },
      async deleteAll() { store.clear(); alarm = null; },
      async setAlarm(at) { alarm = at; },
      async getAlarm() { return alarm; },
    },
    blockConcurrencyWhile(callback) {
      const next = queue.then(() => callback());
      queue = next.then(() => undefined, () => undefined);
      return next;
    },
    _store: store,
    get _alarm() { return alarm; },
  };
}

const consume = (limiter, body) => limiter.fetch(new Request('https://durable.internal/consume', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}));

async function consumeJson(limiter, body) {
  const response = await consume(limiter, body);
  const payload = await response.json();
  return { status: response.status, ...payload };
}

test('the bucket refuses the request after the allowance is spent', async () => {
  const limiter = new RateLimiter(fakeState());
  const options = { windowMs: 60_000, max: 3 };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await consumeJson(limiter, options);
    assert.equal(result.data.allowed, true, `attempt ${attempt} must be allowed`);
    assert.equal(result.data.remaining, 3 - attempt);
    assert.equal(result.data.retryAfter, 0, 'an allowed request has nothing to wait for');
  }

  const refused = await consumeJson(limiter, options);
  assert.equal(refused.data.allowed, false);
  assert.equal(refused.data.remaining, 0);
  // `Retry-After` must be actionable: a client that cannot compute a wait will
  // simply retry immediately.
  assert.ok(refused.data.retryAfter >= 1, 'a refusal must carry a positive wait');
  assert.ok(refused.data.retryAfter <= 60);
});

test('concurrent requests cannot both spend the last unit', async () => {
  // This is the property a non-atomic read-modify-write loses: two requests each
  // read count=2, each write count=3, and a limit of 3 admits four requests.
  const limiter = new RateLimiter(fakeState());
  const options = { windowMs: 60_000, max: 3 };
  const results = await Promise.all(
    Array.from({ length: 6 }, () => consumeJson(limiter, options)),
  );
  const allowed = results.filter((result) => result.data.allowed).length;
  assert.equal(allowed, 3, 'exactly the allowance may pass, however concurrent');
});

test('the window resets, and the reset time is reported in epoch seconds', async () => {
  const state = fakeState();
  const limiter = new RateLimiter(state);
  const options = { windowMs: 60_000, max: 1 };

  const first = await consumeJson(limiter, options);
  assert.equal(first.data.allowed, true);
  assert.equal((await consumeJson(limiter, options)).data.allowed, false);

  // Expire the window by rewriting the stored bucket, which is what the passage
  // of time would do.
  const stored = state._store.get('bucket');
  state._store.set('bucket', { ...stored, resetAt: Date.now() - 1 });

  const afterReset = await consumeJson(limiter, options);
  assert.equal(afterReset.data.allowed, true, 'a new window starts fresh');
  // Seconds, not milliseconds: the header contract is `X-RateLimit-Reset`.
  assert.ok(afterReset.data.resetAt < 1e11, 'resetAt must be epoch seconds');
});

test('an abandoned bucket is cleared, and a live one is not', async () => {
  const state = fakeState();
  const limiter = new RateLimiter(state);
  await consumeJson(limiter, { windowMs: 60_000, max: 5 });
  assert.ok(state._alarm > Date.now(), 'an alarm must be scheduled');

  // Still inside its window: the alarm reschedules rather than wiping a bucket
  // that is actively limiting someone.
  await limiter.alarm();
  assert.ok(state._store.has('bucket'), 'a live bucket must survive its alarm');

  const stored = state._store.get('bucket');
  state._store.set('bucket', { ...stored, resetAt: Date.now() - 1 });
  await limiter.alarm();
  assert.equal(state._store.size, 0, 'an expired bucket is released');
});

test('a peek reports the count without spending it', async () => {
  const limiter = new RateLimiter(fakeState());
  const options = { windowMs: 60_000, max: 2 };
  await consumeJson(limiter, options);
  const peeked = await consumeJson(limiter, { ...options, peek: true });
  assert.equal(peeked.data.remaining, 1);
  const next = await consumeJson(limiter, options);
  assert.equal(next.data.remaining, 0, 'the peek must not have consumed anything');
});

test('malformed parameters are refused rather than defaulted', async () => {
  const limiter = new RateLimiter(fakeState());
  for (const body of [
    {}, { windowMs: 60_000 }, { max: 5 },
    { windowMs: 10, max: 5 },
    { windowMs: 60_000, max: 0 },
    { windowMs: 60_000, max: 5, cost: 0 },
    { windowMs: 999_999_999_999, max: 5 },
  ]) {
    const result = await consumeJson(limiter, body);
    assert.equal(result.status, 400, JSON.stringify(body));
  }
});

test('an unknown path is a 404, not a silent allow', async () => {
  const limiter = new RateLimiter(fakeState());
  const response = await limiter.fetch(new Request('https://durable.internal/whatever'));
  assert.equal(response.status, 404);
});

/* --------------------------------------------------- the middleware, mounted */

const { default: worker } = await import('../src/index.ts');

/// A namespace whose objects are real `RateLimiter` instances, so a request path
/// through the middleware exercises the durable store rather than the fallback.
function rateLimiterNamespace() {
  const objects = new Map();
  const names = [];
  return {
    idFromName(name) { names.push(name); return { name, toString: () => name }; },
    get(id) {
      const key = id.name;
      if (!objects.has(key)) objects.set(key, new RateLimiter(fakeState()));
      return { fetch: (request) => objects.get(key).fetch(request) };
    },
    _names: names,
    _objects: objects,
  };
}

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

const ctx = { waitUntil() {}, passThroughOnException() {} };

function call(path, init, namespace) {
  return worker.fetch(new Request(`https://api.majarra.app${path}`, init), {
    ENVIRONMENT: 'development',
    API_VERSION: 'v1',
    DB: emptyDb,
    CACHE: { async get() { return null; }, async put() {} },
    RATE_LIMITER: namespace,
  }, ctx);
}

test('the login limit refuses the sixth attempt and says how long to wait', async () => {
  const namespace = rateLimiterNamespace();
  const attempt = () => call('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '198.51.100.7' },
    body: JSON.stringify({ email: 'a@b.test', password: 'x' }),
  }, namespace);

  const statuses = [];
  for (let index = 0; index < 6; index += 1) statuses.push((await attempt()).status);

  // The first five are handled (whatever they answer); the sixth is refused by the
  // limiter before the handler runs.
  assert.equal(statuses.filter((status) => status === 429).length, 1);
  assert.equal(statuses[5], 429);

  const refused = await attempt();
  assert.equal(refused.status, 429);
  const retryAfter = Number(refused.headers.get('Retry-After'));
  assert.ok(retryAfter >= 1 && retryAfter <= 60, `Retry-After was ${retryAfter}`);
  assert.equal(refused.headers.get('X-RateLimit-Remaining'), '0');
  assert.equal(refused.headers.get('X-RateLimit-Limit'), '5');
  const body = await refused.json();
  assert.equal(body.retry_after, retryAfter, 'the body must agree with the header');
});

test('a limit is enforced across isolates, not per isolate', async () => {
  // The durable store is the shared one, so two "isolates" — two separate calls
  // that would each have their own module-level map — share the budget. This is
  // the property the in-memory implementation could not have.
  const namespace = rateLimiterNamespace();
  const from = (ip) => call('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({}),
  }, namespace);

  for (let index = 0; index < 5; index += 1) await from('203.0.113.9');
  assert.equal((await from('203.0.113.9')).status, 429);
  // A different address has its own bucket, so one caller cannot lock out another.
  assert.notEqual((await from('203.0.113.10')).status, 429);
  assert.ok(namespace._objects.size >= 2, 'each bucket is its own object');
});

test('authenticated limits are keyed per principal, and the key never contains the token', async () => {
  const namespace = rateLimiterNamespace();
  const token = 'super-secret-session-token-value';
  await call('/api/v1/family/children', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}`, 'CF-Connecting-IP': '198.51.100.1' },
    body: JSON.stringify({}),
  }, namespace);

  const keys = namespace._names.join('|');
  assert.match(keys, /^parent-write:sub:[0-9a-f]{24}$/, `unexpected key: ${keys}`);
  // The bucket name reaches traces and dashboards, so a session token must not be
  // in it.
  assert.equal(keys.includes(token), false, 'the raw token must never key a bucket');
});

test('two parents behind one address do not share a budget', async () => {
  const namespace = rateLimiterNamespace();
  const asParent = (token) => call('/api/v1/child-settings/child-1', {
    headers: { Authorization: `Bearer ${token}`, 'CF-Connecting-IP': '198.51.100.2' },
  }, namespace);

  for (let index = 0; index < 61; index += 1) await asParent('parent-one-token');
  assert.equal((await asParent('parent-one-token')).status, 429);
  // Carrier NAT is common; one family exhausting its quota must not lock out
  // another family on the same address.
  assert.notEqual((await asParent('parent-two-token')).status, 429);
});

test('a store outage degrades to a local counter and is logged, not swallowed', async () => {
  const broken = {
    idFromName(name) { return { name }; },
    get() { return { fetch() { throw new Error('durable object unreachable'); } }; },
  };
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    const response = await call('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '198.51.100.3' },
      body: JSON.stringify({}),
    }, broken);
    // Still served — refusing every login during a storage incident would be a
    // worse outage than a degraded limit.
    assert.notEqual(response.status, 429);
    assert.ok(response.headers.get('X-RateLimit-Limit'), 'headers still describe the limit');
  } finally {
    console.error = original;
  }
  assert.ok(
    errors.some((line) => line.includes('rate_limit_store_failed')),
    'the failure must be reported; the old code left an empty catch',
  );
});

test('a missing binding is reported too', async () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    await call('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '198.51.100.4' },
      body: JSON.stringify({}),
    }, undefined);
  } finally {
    console.warn = original;
  }
  assert.ok(warnings.some((line) => line.includes('rate_limit_store_unavailable')));
});

/* ------------------------------------------------------- coverage, by source */

test('every endpoint group the audit found unprotected is now registered', async () => {
  const source = read('src/index.ts');
  for (const prefix of [
    '/api/v1/auth/*',            // pre-existing
    '/api/v1/billing/*',         // pre-existing
    '/api/v1/admin/*',           // pre-existing
    '/api/v1/analytics/*',       // added in batch 2
    '/api/v1/episodes/*',        // playback session minting
    '/api/v1/books/*',           // narration session minting
    '/api/v1/stories/*',         // narration session minting
    '/api/v1/media/*',           // signed-media redemption
    '/api/v1/child-settings/*',  // parental-control writes
    '/api/v1/notifications/*',
    '/api/v1/family/*',
    '/api/v1/creations',         // R2 upload
    '/api/v1/creations/*',
  ]) {
    assert.match(
      source, new RegExp(`app\\.use\\('${prefix.replace(/[*/]/g, (ch) => `\\${ch}`)}'`),
      `${prefix} is not registered with a rate limit`,
    );
  }
});

test('the limiter no longer uses KV or a swallowed catch', () => {
  const source = read('src/lib/rateLimit.ts');
  // KV cannot hold a counter: ~1 write/s per key and reads stale for up to a
  // minute. Its presence here was the defect, not the mitigation.
  assert.equal(/env\.CACHE/.test(source), false, 'KV must not be the counter store');
  assert.equal(/catch\s*\{\s*\}/.test(source), false, 'no empty catch may remain');
  assert.match(source, /console\.error\(\s*\n?\s*'rate_limit_store_failed'/);
  assert.match(source, /console\.warn\('rate_limit_store_unavailable'/);
});

test('the Durable Object class is exported and declared for both environments', () => {
  assert.match(read('src/index.ts'), /export \{ RateLimiter \} from '\.\/do\/RateLimiter\.ts'/);
  const config = read('wrangler.jsonc');
  // Both the top level and the production environment, because named environments
  // do not inherit bindings.
  assert.equal(
    (config.match(/"class_name": "RateLimiter"/g) ?? []).length, 2,
    'RateLimiter must be bound in dev and production',
  );
  assert.equal(
    (config.match(/"RateLimiter"\s*\]/g) ?? []).length, 2,
    'a migration tag must create the class in dev and production',
  );
});
