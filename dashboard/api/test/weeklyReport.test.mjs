import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { FamilyState } from '../src/do/FamilyState.ts';

/// APP-207 — the parent's weekly report, computed in the family's own object
/// from the authoritative tables (the same seconds the screen-time limits use).

function sqlStorage(db) {
  return {
    exec(sql, ...params) {
      if (params.length === 0 && /;\s*\S/.test(sql)) {
        db.exec(sql);
        return { toArray: () => [] };
      }
      const rows = db.prepare(sql).all(...params);
      return { toArray: () => rows };
    },
  };
}

function durableState(db) {
  const state = {
    alarms: [],
    storage: {
      sql: sqlStorage(db),
      transactionSync(fn) {
        db.exec('BEGIN');
        try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
      },
      async setAlarm(at) { state.alarms.push(at); },
      async getAlarm() { return null; },
    },
  };
  return state;
}

const post = (path, body) => new Request(`https://do.local${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
async function call(object, request) {
  const response = await object.fetch(request);
  return { status: response.status, body: await response.json().catch(() => null) };
}

const fakeDb = { prepare() { return { bind() { return this; }, async first() { return { timezone: 'Africa/Cairo' }; }, async all() { return { results: [] }; } }; } };

async function seeded() {
  const db = new DatabaseSync(':memory:');
  const object = new FamilyState(durableState(db), { DB: fakeDb, FAMILY_EVENTS: { async sendBatch() {} } });
  await call(object, post('/initialize', { parent_id: 'parent_00000001', display_name: 'أسرة', identity_epoch: 1 }));
  await call(object, post('/sessions/create', {
    session_id: 'session-1', refresh_token_hash: 'h', installation_id_hash: 'i', platform: 'android',
    device_name: 'هاتف', expires_at: Date.now() + 86_400_000,
  }));
  const child = await call(object, post('/children', {
    session_id: 'session-1', nickname: 'سلمى', birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 7, avatar_id: 'avatar-1',
  }));
  assert.equal(child.status, 201);
  return { db, object, childId: child.body.data.id };
}

test('minutes this week and last week come from the screen-time counter by local date', async () => {
  const { db, object, childId } = await seeded();
  const put = db.prepare('INSERT INTO screen_time_daily (child_id, activity_date, watched_seconds, updated_at) VALUES (?,?,?,?)');
  put.run(childId, '2026-09-28', 600, 1); // today: 10 min
  put.run(childId, '2026-09-22', 300, 1); // first day of this week: 5 min
  put.run(childId, '2026-09-21', 1200, 1); // last day of last week: 20 min
  put.run(childId, '2026-09-15', 60, 1); // first day of last week: 1 min
  put.run(childId, '2026-09-14', 9999, 1); // outside both weeks
  put.run('other-child', '2026-09-28', 9999, 1); // another child

  const res = await call(object, post('/reports/weekly', { child_id: childId, local_date: '2026-09-28' }));
  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.equal(data.week_start, '2026-09-22');
  assert.equal(data.minutes_this_week, 15);
  assert.equal(data.minutes_last_week, 21);
  assert.equal(data.active_days, 2);
  assert.deepEqual(data.daily.map((d) => d.date), [
    '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28',
  ]);
  assert.equal(data.daily[6].minutes, 10);
});

test('completions, attempts and mastery count only the last 7 days', async () => {
  const { db, object, childId } = await seeded();
  const now = Date.now();
  const old = now - 10 * 86_400_000;
  const progress = db.prepare(`INSERT INTO content_progress (child_id, content_type, content_id, position_ms, duration_ms, completed, device_id, sequence, event_id, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  progress.run(childId, 'episode', 'ep-new', 1, 1, 1, 'd', 1, 'e1', now);
  progress.run(childId, 'episode', 'ep-old', 1, 1, 1, 'd', 1, 'e2', old);
  progress.run(childId, 'episode', 'ep-open', 1, 10, 0, 'd', 1, 'e3', now);

  const attempt = db.prepare(`INSERT INTO attempts (id, child_id, game_id, content_type, score, max_score, created_at) VALUES (?,?,?,?,?,?,?)`);
  attempt.run('a1', childId, 'game-1', 'game', 3, 4, now);
  attempt.run('a2', childId, 'game-1', 'game', 1, 4, now);
  attempt.run('a3', childId, 'game-2', 'game', 0, 0, now); // unscored drawing
  attempt.run('a4', childId, 'game-3', 'game', 0, 4, old); // too old

  const mastery = db.prepare(`INSERT INTO mastery (child_id, objective_id, level, attempts, correct_attempts, last_attempt_at) VALUES (?,?,?,?,?,?)`);
  mastery.run(childId, 'obj-a', 'independent', 3, 3, now);
  mastery.run(childId, 'obj-b', 'independent', 3, 3, old);
  mastery.run(childId, 'obj-c', 'needs_review', 3, 1, now);

  const { body } = await call(object, post('/reports/weekly', { child_id: childId, local_date: '2026-09-28' }));
  const data = body.data;
  assert.deepEqual(data.completed.map((c) => c.content_id), ['ep-new']);
  assert.equal(data.attempts, 3);
  assert.equal(data.games_played, 2);
  assert.equal(data.accuracy, 50, 'scored attempts only: 4 of 8');
  assert.deepEqual(data.mastered, ['obj-a']);
  assert.deepEqual(data.needs_review, ['obj-c']);
});

test('an unknown child is refused, and so is a missing local date', async () => {
  const { object, childId } = await seeded();
  assert.equal((await call(object, post('/reports/weekly', { child_id: 'someone-else', local_date: '2026-09-28' }))).status, 404);
  assert.equal((await call(object, post('/reports/weekly', { child_id: childId }))).status, 400);
});

test('an empty week reports zeros and no accuracy, not a failure', async () => {
  const { object, childId } = await seeded();
  const { status, body } = await call(object, post('/reports/weekly', { child_id: childId, local_date: '2026-03-01' }));
  assert.equal(status, 200);
  assert.equal(body.data.minutes_this_week, 0);
  assert.equal(body.data.accuracy, null);
  // Week crossing February in a non-leap year.
  assert.equal(body.data.week_start, '2026-02-23');
});
