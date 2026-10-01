import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  loadPlanLimits,
  loadPolicy,
  resetPolicy,
  resetPolicyCache,
  validatePlanLimits,
  writePolicy,
} from '../src/lib/platformPolicy.ts';
import { PLAN_LIMITS, PLAN_POLICY_VERSION } from '../src/lib/familyPolicy.ts';

/// ADMIN-POLICY: plan limits and product timings editable from the dashboard.

const migration = readFileSync(new URL('../migrations/0098_platform_policy.sql', import.meta.url), 'utf8');

/// A D1 double over real SQLite, running the real migration.
function d1({ fail = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
  const state = { fail };
  const wrap = (sql) => {
    let params = [];
    const stmt = {
      bind(...values) { params = values; return stmt; },
      async first() {
        if (state.fail) throw new Error('D1 unavailable');
        return db.prepare(sql).get(...params) ?? null;
      },
      async run() {
        if (state.fail) throw new Error('D1 unavailable');
        db.prepare(sql).run(...params);
        return { meta: { changes: 1 } };
      },
    };
    return stmt;
  };
  return { DB: { prepare: wrap }, state, raw: db };
}

const edited = () => {
  const limits = structuredClone(PLAN_LIMITS);
  limits.free.devices = 2;
  limits.family.tvDevices = 3;
  return limits;
};

test.beforeEach(() => resetPolicyCache());

test('nothing stored means the code defaults, at the code version', async () => {
  const env = d1();
  const { limits, version } = await loadPlanLimits(env);
  assert.deepEqual(limits, PLAN_LIMITS);
  assert.equal(version, PLAN_POLICY_VERSION);
  // Without a binding at all (tests, local runs) the same.
  assert.deepEqual((await loadPlanLimits({})).limits, PLAN_LIMITS);
});

test('a saved change is what every reader gets, with a higher version', async () => {
  const env = d1();
  const written = await writePolicy(env.DB, 'plan_limits', edited(), 'admin-1');
  assert.equal(written.ok, true);
  assert.equal(written.value.version, PLAN_POLICY_VERSION + 1);
  resetPolicyCache();
  const loaded = await loadPolicy(env, 'plan_limits');
  assert.equal(loaded.source, 'stored');
  assert.equal(loaded.value.free.devices, 2);
  assert.equal(loaded.value.family.tvDevices, 3);
  assert.equal(loaded.updated_by, 'admin-1');

  await writePolicy(env.DB, 'plan_limits', edited(), 'admin-1');
  resetPolicyCache();
  assert.equal((await loadPolicy(env, 'plan_limits')).version, PLAN_POLICY_VERSION + 2, 'every save bumps it');
});

test('restoring defaults is a new version, never a rewind', async () => {
  const env = d1();
  await writePolicy(env.DB, 'plan_limits', edited(), 'admin-1');
  const reset = await resetPolicy(env.DB, 'plan_limits', 'admin-1');
  assert.equal(reset.ok, true);
  assert.deepEqual(reset.value.value, PLAN_LIMITS);
  assert.equal(reset.value.version, PLAN_POLICY_VERSION + 2);
});

test('numbers outside their bounds, unknown plans and unknown fields are refused', () => {
  const zero = edited(); zero.free.devices = 0;
  assert.match(validatePlanLimits(zero).error, /free\.devices .* between 1 and 20/);
  const huge = edited(); huge.family_plus.concurrentStreams = 10_000;
  assert.equal(validatePlanLimits(huge).ok, false);
  const fraction = edited(); fraction.family.children = 2.5;
  assert.equal(validatePlanLimits(fraction).ok, false);
  const text = edited(); text.family.children = '4';
  assert.equal(validatePlanLimits(text).ok, false);
  assert.equal(validatePlanLimits({ ...edited(), vip: PLAN_LIMITS.free }).ok, false);
  const extra = edited(); extra.free.unlimited = 1;
  assert.equal(validatePlanLimits(extra).ok, false);
  const missing = edited(); delete missing.family;
  assert.equal(validatePlanLimits(missing).ok, false);
  // A TV allowance of 0 is allowed: it means "no TVs on this plan".
  const noTv = edited(); noTv.free.tvDevices = 0;
  assert.equal(validatePlanLimits(noTv).ok, true);
});

test('an invalid row in D1 is ignored in favour of the defaults', async () => {
  const env = d1();
  env.raw.prepare(`INSERT INTO platform_policy (section, value_json, version) VALUES ('plan_limits', ?, 9)`)
    .run(JSON.stringify({ free: { devices: 0 } }));
  const loaded = await loadPolicy(env, 'plan_limits');
  assert.equal(loaded.source, 'default');
  assert.deepEqual(loaded.value, PLAN_LIMITS);
});

test('a D1 outage keeps the last good value, and never opens or closes a limit by itself', async (t) => {
  const env = d1();
  await writePolicy(env.DB, 'plan_limits', edited(), 'admin-1');
  resetPolicyCache();
  const realNow = Date.now;
  t.after(() => { Date.now = realNow; });
  assert.equal((await loadPlanLimits(env)).limits.free.devices, 2);

  env.state.fail = true;
  const later = realNow() + 5 * 60_000; // past the cache window
  const kept = await loadPolicy(env, 'plan_limits', later);
  assert.equal(kept.source, 'cached');
  assert.equal(kept.value.free.devices, 2, 'the edited value survives the outage');

  resetPolicyCache();
  const cold = await loadPolicy(env, 'plan_limits');
  assert.equal(cold.source, 'default', 'a cold isolate falls back to the code defaults');
});

test('TV pairing and offline licence timings are bounded too', async () => {
  const env = d1();
  assert.equal((await writePolicy(env.DB, 'tv_pairing', { code_ttl_minutes: 60, poll_interval_seconds: 5 }, 'a')).ok, false,
    'the pairing object caps codes at 15 minutes');
  assert.equal((await writePolicy(env.DB, 'tv_pairing', { code_ttl_minutes: 5, poll_interval_seconds: 1 }, 'a')).ok, false,
    'a 1 s poll would trip the poll limiter');
  assert.equal((await writePolicy(env.DB, 'offline_license', { ttl_days: 90 }, 'a')).ok, false);
  const ok = await writePolicy(env.DB, 'offline_license', { ttl_days: 7 }, 'a');
  assert.equal(ok.ok, true);
  assert.equal(ok.value.version, 1);
  resetPolicyCache();
  assert.equal((await loadPolicy(env, 'offline_license')).value.ttl_days, 7);
});

/* ------------------------------------------------------- enforcement */

test('FamilyState enforces the limit saved from the dashboard', async () => {
  const { FamilyState } = await import('../src/do/FamilyState.ts');
  const env = d1();
  const limits = edited(); // free.devices = 2
  await writePolicy(env.DB, 'plan_limits', limits, 'admin-1');
  resetPolicyCache();

  const db = new DatabaseSync(':memory:');
  const state = {
    storage: {
      sql: { exec: (sql, ...params) => {
        const trimmed = sql.trim();
        if (/^(SELECT|WITH|PRAGMA)/i.test(trimmed) || /RETURNING/i.test(trimmed)) {
          const rows = db.prepare(trimmed).all(...params);
          return { toArray: () => rows, one: () => rows[0], [Symbol.iterator]: () => rows[Symbol.iterator]() };
        }
        if (params.length) db.prepare(trimmed).run(...params); else db.exec(trimmed);
        return { toArray: () => [], one: () => undefined, [Symbol.iterator]: () => [][Symbol.iterator]() };
      } },
      transactionSync: (fn) => fn(),
      async getAlarm() { return null; }, async setAlarm() {}, async get() {}, async put() {},
    },
    blockConcurrencyWhile: (fn) => fn(),
  };
  const object = new FamilyState(state, { DB: env.DB });
  const call = async (path, body) => {
    const res = await object.fetch(new Request(`https://do.local${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: res.status, body: await res.json() };
  };
  await call('/initialize', { parent_id: 'parent_00000001', identity_epoch: 1 });
  const session = (id, install) => call('/sessions/create', {
    session_id: id, refresh_token_hash: `h-${id}`, installation_id_hash: install,
    platform: 'android', expires_at: Date.now() + 600_000,
  });
  assert.equal((await session('s1', 'i1')).status, 201);
  assert.equal((await session('s2', 'i2')).status, 201, 'the dashboard raised free devices to 2');
  const third = await session('s3', 'i3');
  assert.equal(third.status, 403);
  assert.equal(third.body.limit.value, 2);
  assert.equal(third.body.limit.policy_version, PLAN_POLICY_VERSION + 1, 'the refusal names the dashboard version');
});

test('the dashboard write path is guarded, reasoned and audited', () => {
  const source = readFileSync(new URL('../src/routes/adminPlans.ts', import.meta.url), 'utf8');
  assert.match(source, /route\.put\('\/platform-policy\/:section', requirePermission\('publish'\)/);
  assert.match(source, /route\.post\('\/platform-policy\/:section\/reset', requirePermission\('publish'\)/);
  assert.match(source, /reasonOf\(body\)/);
  assert.match(source, /auditStatement\(/);
});
