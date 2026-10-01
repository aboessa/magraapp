import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { FamilyState } from '../src/do/FamilyState.ts';

/// APP-206 — warn before a limit, and do not count paused time.

function sqlStorage(db) {
  return {
    exec(sql, ...params) {
      if (params.length === 0 && /;\s*\S/.test(sql)) { db.exec(sql); return { toArray: () => [] }; }
      const rows = db.prepare(sql).all(...params);
      return { toArray: () => rows };
    },
  };
}

function durableState(db) {
  return {
    storage: {
      sql: sqlStorage(db),
      transactionSync(fn) {
        db.exec('BEGIN');
        try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
      },
      async setAlarm() {},
      async getAlarm() { return null; },
    },
  };
}

function fakeDb(settings) {
  return {
    prepare(sql) {
      const row = sql.includes('child_settings') ? settings : { timezone: 'Africa/Cairo' };
      return { bind() { return this; }, async first() { return row; }, async all() { return { results: row ? [row] : [] }; } };
    },
  };
}

const post = (path, body) => new Request(`https://do.local${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
async function call(object, path, body) {
  const res = await object.fetch(post(path, body));
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function seeded(settings) {
  const db = new DatabaseSync(':memory:');
  const object = new FamilyState(durableState(db), { DB: fakeDb(settings), FAMILY_EVENTS: { async sendBatch() {} } });
  await call(object, '/initialize', { parent_id: 'parent_00000001', display_name: 'أسرة', identity_epoch: 1 });
  await call(object, '/sessions/create', {
    session_id: 'session-1', refresh_token_hash: 'h', installation_id_hash: 'i', platform: 'android',
    device_name: 'هاتف', expires_at: Date.now() + 86_400_000,
  });
  const child = await call(object, '/children', {
    session_id: 'session-1', nickname: 'سلمى', birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 7, avatar_id: 'avatar-1',
  });
  const start = await call(object, '/playback/start', {
    session_id: 'session-1', child_id: child.body.data.id, asset_id: 'asset-1', entity_type: 'episode',
    entity_id: 'episode-1', required_plan: 'free', allowed_tracks: ['preschool', 'kids', 'junior'],
  });
  assert.equal(start.status, 201, JSON.stringify(start.body));
  return { db, object, childId: child.body.data.id, start };
}

const beat = (object, leaseId, extra = {}) => call(object, '/playback/heartbeat', {
  session_id: 'session-1', lease_id: leaseId, required_plan: 'free',
  allowed_tracks: ['preschool', 'kids', 'junior'], ...extra,
});
const rewind = (db, ms) => db.prepare('UPDATE playback_leases SET last_heartbeat_at = last_heartbeat_at - ?').run(ms);
const watched = (db, childId) =>
  db.prepare('SELECT COALESCE(SUM(watched_seconds), 0) AS s FROM screen_time_daily WHERE child_id = ?').get(childId).s;

const DAILY_10 = { daily_minutes: 10, max_session_minutes: null, bedtime_start: null, bedtime_end: null };

test('start reports the remaining daily allowance', async () => {
  const { start } = await seeded(DAILY_10);
  assert.equal(start.body.data.remaining_seconds, 600);
  assert.equal(start.body.data.limit_kind, 'daily');
});

test('no limit set means no allowance to warn about', async () => {
  const { start } = await seeded(null);
  assert.equal(start.body.data.remaining_seconds, null);
  assert.equal(start.body.data.limit_kind, null);
});

test('paused time is not credited: the played time the app reports is', async () => {
  const { db, object, childId, start } = await seeded(DAILY_10);
  rewind(db, 60_000); // 60 s of wall clock, of which the video played 20 s
  const res = await beat(object, start.body.data.lease_id, { played_ms: 20_000 });
  assert.equal(res.status, 200);
  assert.equal(watched(db, childId), 20);
  assert.equal(res.body.data.remaining_seconds, 580);
});

test('a client cannot claim more than the wall-clock gap', async () => {
  const { db, object, childId, start } = await seeded(DAILY_10);
  rewind(db, 30_000);
  await beat(object, start.body.data.lease_id, { played_ms: 10 * 60_000 });
  assert.equal(watched(db, childId), 30);
});

test('an older client that sends nothing is credited the wall clock, as before', async () => {
  const { db, object, childId, start } = await seeded(DAILY_10);
  rewind(db, 30_000);
  await beat(object, start.body.data.lease_id);
  assert.equal(watched(db, childId), 30);
});

test('the session limit wins when it is nearer', async () => {
  const { start } = await seeded({ daily_minutes: 60, max_session_minutes: 5, bedtime_start: null, bedtime_end: null });
  assert.equal(start.body.data.limit_kind, 'session');
  assert.equal(start.body.data.remaining_seconds, 300);
});

test('the end tail is bounded by played time too', async () => {
  const { db, object, childId, start } = await seeded(DAILY_10);
  rewind(db, 40_000);
  const res = await call(object, '/playback/end', { session_id: 'session-1', lease_id: start.body.data.lease_id, played_ms: 0 });
  assert.equal(res.status, 200);
  assert.equal(watched(db, childId), 0, 'paused before closing: nothing credited');
});
