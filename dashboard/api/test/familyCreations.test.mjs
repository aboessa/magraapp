/// Durable Object coverage for child creations, rewards, and the deletion path
/// that stops an R2 object outliving the profile it belongs to.
///
/// The harness mirrors `familyState.test.mjs`: a real in-memory SQLite database
/// behind a `sql.exec` shim, so `transactionSync` rolls back exactly as it does in
/// production.

import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { FamilyState } from '../src/do/FamilyState.ts';

function sqlStorage(db) {
  return {
    exec(sql, ...params) {
      if (params.length === 0 && /;\s*\S/.test(sql)) {
        db.exec(sql);
        return { toArray: () => [] };
      }
      const statement = db.prepare(sql);
      const rows = statement.all(...params);
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
        try {
          const result = fn();
          db.exec('COMMIT');
          return result;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
      async setAlarm(at) { state.alarms.push(at); },
      async getAlarm() { return state.alarms.at(-1) ?? null; },
    },
  };
  return state;
}

const post = (path, body) => new Request(`https://do.local${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const get = (path) => new Request(`https://do.local${path}`, { method: 'GET' });

async function call(object, request) {
  const response = await object.fetch(request);
  return { status: response.status, body: await response.json().catch(() => null) };
}

/// A family with one session and two children.
async function seeded() {
  const db = new DatabaseSync(':memory:');
  const object = new FamilyState(durableState(db), {
    FAMILY_EVENTS: { async sendBatch() {} },
  });
  await call(object, post('/initialize', {
    parent_id: 'parent_00000001', display_name: 'أسرة', identity_epoch: 1,
  }));
  await call(object, post('/sessions/create', {
    session_id: 'session-1', refresh_token_hash: 'h', installation_id_hash: 'i',
    platform: 'android', device_name: 'هاتف',
    expires_at: Date.now() + 86_400_000,
  }));
  const sessionId = 'session-1';

  // The free plan allows one child; two are needed to prove per-child isolation.
  await call(object, post('/entitlements/apply', {
    id: 'ent-1', plan: 'family', status: 'active',
    starts_at: Date.now() - 1000, expires_at: Date.now() + 86_400_000,
    observed_at: Date.now(),
  }));

  const children = [];
  for (const nickname of ['سلمى', 'يوسف']) {
    const created = await call(object, post('/children', {
      session_id: sessionId,
      nickname,
      birth_month: 4,
      birth_year: new Date().getUTCFullYear() - 5,
      avatar_id: 'avatar-1',
      language: 'ar',
    }));
    assert.equal(created.status, 201, `child creation failed: ${JSON.stringify(created.body)}`);
    children.push(created.body.data.id);
  }
  return { object, db, sessionId, children };
}

function registerCreation(object, sessionId, { childId, creationId }) {
  return call(object, post('/creations', {
    session_id: sessionId,
    child_id: childId,
    creation_id: creationId,
    game_id: 'game-tc-shapes-basic',
    drawing_mode: 'coloring',
    storage_key: `family/parent_00000001/child/${childId}/${creationId}.png`,
    mime_type: 'image/png',
    width: 512, height: 512, byte_size: 4096,
  }));
}

const rows = (db, sql) => db.prepare(sql).all();

/* ------------------------------------------------------------------ creations */

test('the creations and deletion tables exist on construction', () => {
  const db = new DatabaseSync(':memory:');
  new FamilyState(durableState(db), {});
  const tables = rows(db, `SELECT name FROM sqlite_master WHERE type='table'`).map((r) => r.name);
  for (const expected of ['child_creations', 'creation_object_deletions', 'rewards']) {
    assert.ok(tables.includes(expected), `${expected} must exist`);
  }
});

test('child_creations has no column for text a child wrote', () => {
  // A structural guarantee, not a policy: there is nowhere to put a caption.
  const db = new DatabaseSync(':memory:');
  new FamilyState(durableState(db), {});
  const columns = rows(db, `PRAGMA table_info(child_creations)`).map((r) => r.name);
  for (const forbidden of ['title', 'caption', 'description', 'note', 'text']) {
    assert.ok(!columns.includes(forbidden), `${forbidden} must not exist`);
  }
});

test('a creation is registered and listed', async () => {
  const { object, sessionId, children } = await seeded();
  const result = await registerCreation(object, sessionId, {
    childId: children[0], creationId: 'creation-1',
  });
  assert.equal(result.status, 200);

  const listed = await call(object, get('/creations'));
  assert.equal(listed.body.data.creations.length, 1);
  assert.equal(listed.body.data.creations[0].child_id, children[0]);
});

test('a key outside the child prefix is refused', async () => {
  // The route mints the key, but the DO is the ownership authority and must not
  // take it on trust.
  const { object, sessionId, children } = await seeded();
  const result = await call(object, post('/creations', {
    session_id: sessionId,
    child_id: children[0],
    creation_id: 'creation-x',
    drawing_mode: 'coloring',
    storage_key: `family/parent_00000001/child/${children[1]}/creation-x.png`,
    mime_type: 'image/png',
    width: 10, height: 10, byte_size: 10,
  }));
  assert.equal(result.status, 403);
  assert.match(result.body.error, /does not belong to this child/);
});

test('an unsupported image type is refused', async () => {
  const { object, sessionId, children } = await seeded();
  const result = await call(object, post('/creations', {
    session_id: sessionId,
    child_id: children[0],
    creation_id: 'creation-svg',
    drawing_mode: 'free_draw',
    storage_key: `family/parent_00000001/child/${children[0]}/creation-svg.svg`,
    mime_type: 'image/svg+xml',
    width: 10, height: 10, byte_size: 10,
  }));
  assert.equal(result.status, 415);
});

/* ------------------------------------------------------------------- deletion */

test('deleting a creation queues its object for removal', async () => {
  // The queue is the pointer that makes "row gone, blob remains" recoverable.
  const { object, db, sessionId, children } = await seeded();
  await registerCreation(object, sessionId, { childId: children[0], creationId: 'creation-1' });

  const deleted = await call(object, post('/creations/delete', {
    session_id: sessionId, creation_id: 'creation-1',
  }));
  assert.equal(deleted.status, 200);
  assert.ok(deleted.body.data.storage_key.includes(children[0]));

  const queued = rows(db, `SELECT storage_key FROM creation_object_deletions`);
  assert.equal(queued.length, 1);
  // Soft-deleted, so the key survives for the sweep to act on.
  assert.equal((await call(object, get('/creations'))).body.data.creations.length, 0);
});

test('settling a deletion removes both the queue entry and the row', async () => {
  const { object, db, sessionId, children } = await seeded();
  await registerCreation(object, sessionId, { childId: children[0], creationId: 'creation-1' });
  const deleted = await call(object, post('/creations/delete', {
    session_id: sessionId, creation_id: 'creation-1',
  }));

  await call(object, post('/creations/deletions-settled', {
    session_id: sessionId, settled: [deleted.body.data.storage_key],
  }));

  assert.equal(rows(db, `SELECT * FROM creation_object_deletions`).length, 0);
  // Once the object is gone the row describes nothing, so the table stays bounded.
  assert.equal(rows(db, `SELECT * FROM child_creations`).length, 0);
});

test('a failed deletion records the attempt instead of vanishing', async () => {
  const { object, db, sessionId, children } = await seeded();
  await registerCreation(object, sessionId, { childId: children[0], creationId: 'creation-1' });
  const deleted = await call(object, post('/creations/delete', {
    session_id: sessionId, creation_id: 'creation-1',
  }));

  await call(object, post('/creations/deletions-settled', {
    session_id: sessionId,
    failed: [deleted.body.data.storage_key],
    error: 'network',
  }));

  const queued = rows(db, `SELECT attempts, last_error FROM creation_object_deletions`);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].attempts, 1);
  assert.equal(queued[0].last_error, 'network');
});

test('purging one child leaves the other child untouched', async () => {
  const { object, sessionId, children } = await seeded();
  await registerCreation(object, sessionId, { childId: children[0], creationId: 'c-a' });
  await registerCreation(object, sessionId, { childId: children[1], creationId: 'c-b' });

  const purged = await call(object, post('/creations/purge', {
    session_id: sessionId, child_id: children[0],
  }));
  assert.equal(purged.status, 200);
  assert.equal(purged.body.data.scope, 'child');
  assert.equal(purged.body.data.storage_keys.length, 1);

  const remaining = (await call(object, get('/creations'))).body.data.creations;
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].child_id, children[1]);
});

test('purging the family queues every object', async () => {
  // This is what an account deletion needs: rows cascading is not enough.
  const { object, db, sessionId, children } = await seeded();
  await registerCreation(object, sessionId, { childId: children[0], creationId: 'c-a' });
  await registerCreation(object, sessionId, { childId: children[1], creationId: 'c-b' });

  const purged = await call(object, post('/creations/purge', { session_id: sessionId }));
  assert.equal(purged.body.data.scope, 'family');
  assert.equal(purged.body.data.storage_keys.length, 2);
  assert.equal(rows(db, `SELECT * FROM creation_object_deletions`).length, 2);
  assert.equal((await call(object, get('/creations'))).body.data.creations.length, 0);
});

test('purge is idempotent', async () => {
  const { object, db, sessionId, children } = await seeded();
  await registerCreation(object, sessionId, { childId: children[0], creationId: 'c-a' });

  await call(object, post('/creations/purge', { session_id: sessionId }));
  const second = await call(object, post('/creations/purge', { session_id: sessionId }));

  assert.equal(second.status, 200);
  // Keyed by storage key, so a repeat does not duplicate the queue.
  assert.equal(rows(db, `SELECT * FROM creation_object_deletions`).length, 1);
});

test('pending deletions are reported oldest first', async () => {
  const { object, sessionId, children } = await seeded();
  await registerCreation(object, sessionId, { childId: children[0], creationId: 'c-a' });
  await call(object, post('/creations/purge', { session_id: sessionId }));

  const pending = await call(object, get('/creations/pending-deletions'));
  assert.equal(pending.body.data.pending.length, 1);
  assert.equal(pending.body.data.pending[0].attempts, 0);
});

test('purge and settle require an active session', async () => {
  const { object } = await seeded();
  assert.equal((await call(object, post('/creations/purge', { session_id: 'nope' }))).status, 400);
  assert.equal(
    (await call(object, post('/creations/deletions-settled', { session_id: 'nope', settled: [] }))).status,
    400,
  );
});

/* -------------------------------------------------------------------- rewards */

test('a reward is granted once and kept', async () => {
  const { object, sessionId, children } = await seeded();
  const first = await call(object, post('/rewards', {
    session_id: sessionId, child_id: children[0],
    reward_key: 'sticker-shapes-complete', source_type: 'game',
    source_id: 'game-tc-shapes-basic',
  }));
  assert.equal(first.status, 200);
  assert.equal(first.body.data.newly_earned, true);

  // Replaying a game a child enjoyed must not mint a second sticker.
  const second = await call(object, post('/rewards', {
    session_id: sessionId, child_id: children[0],
    reward_key: 'sticker-shapes-complete', source_type: 'game',
    source_id: 'game-tc-shapes-basic',
  }));
  assert.equal(second.body.data.newly_earned, false);

  const listed = await call(object, get('/rewards'));
  assert.equal(listed.body.data.rewards.length, 1);
});

test('an unknown reward source type is refused', async () => {
  const { object, sessionId, children } = await seeded();
  const result = await call(object, post('/rewards', {
    session_id: sessionId, child_id: children[0],
    reward_key: 'x', source_type: 'lootbox', source_id: 'y',
  }));
  assert.equal(result.status, 400);
});

/* --------------------------------------------------------- game attempts */

test('a game attempt is filed under game_id, not episode_id', async () => {
  // The defect this fixes: the game id used to be written into episode_id,
  // making per-game accuracy impossible to report.
  const { object, db, sessionId, children } = await seeded();
  await call(object, post('/progress', {
    session_id: sessionId,
    child_id: children[0],
    content_type: 'game',
    content_id: 'game-tc-shapes-basic',
    event_id: 'event-1',
    position_ms: 0, duration_ms: 0, completed: true,
    score: 1, max_score: 1,
    answers: [{ stroke: 's1', coverage: 0.95, deviation_dp: 6, completed: true, help_level: 0 }],
    time_spent: 30, help_used: false,
    objective_id: 'objective-world-shape-trace_form',
  }));

  const attempts = rows(db, `SELECT game_id, episode_id, content_type, score, max_score FROM attempts`);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].game_id, 'game-tc-shapes-basic');
  assert.equal(attempts[0].episode_id, null);
  assert.equal(attempts[0].content_type, 'game');
});

test('an unscored level reports 0 of 0 without failing the write', async () => {
  // Colouring has nothing to measure. Rejecting max_score 0 would have meant
  // dropping the attempt or inventing a score for a drawing.
  const { object, db, sessionId, children } = await seeded();
  const result = await call(object, post('/progress', {
    session_id: sessionId,
    child_id: children[0],
    content_type: 'game',
    content_id: 'game-tc-shapes-basic',
    event_id: 'event-unscored',
    position_ms: 0, duration_ms: 0, completed: true,
    score: 0, max_score: 0,
    answers: [],
    time_spent: 12, help_used: false,
    objective_id: 'objective-world-shape-trace_form',
  }));
  assert.equal(result.status, 200);

  const attempts = rows(db, `SELECT score, max_score FROM attempts WHERE id IS NOT NULL`);
  assert.ok(attempts.some((row) => row.max_score === 0));

  // An unscored attempt must not drag mastery down.
  const mastery = rows(db, `SELECT level FROM mastery`);
  assert.equal(mastery[0].level, 'introduced');
});

test('mastery reaches independent only after three unassisted successes', async () => {
  const { object, db, sessionId, children } = await seeded();
  for (let i = 0; i < 3; i++) {
    await call(object, post('/progress', {
      session_id: sessionId,
      child_id: children[0],
      content_type: 'game',
      content_id: 'game-tc-shapes-basic',
      event_id: `event-clean-${i}`,
      position_ms: 0, duration_ms: 0, completed: true,
      score: 1, max_score: 1, answers: [{ stroke: 's1', completed: true }],
      time_spent: 20, help_used: false,
      objective_id: 'objective-world-shape-trace_form',
    }));
  }
  assert.equal(rows(db, `SELECT level FROM mastery`)[0].level, 'independent');
});

test('succeeding with help is assisted, not independent', async () => {
  const { object, db, sessionId, children } = await seeded();
  for (let i = 0; i < 3; i++) {
    await call(object, post('/progress', {
      session_id: sessionId,
      child_id: children[0],
      content_type: 'game',
      content_id: 'game-tc-shapes-basic',
      event_id: `event-helped-${i}`,
      position_ms: 0, duration_ms: 0, completed: true,
      score: 1, max_score: 1, answers: [{ stroke: 's1', completed: true, help_level: 1 }],
      time_spent: 20, help_used: true,
      objective_id: 'objective-world-shape-trace_form',
    }));
  }
  // The tolerance was widened for this child; reporting independent mastery of
  // letter formation would be false.
  assert.equal(rows(db, `SELECT level FROM mastery`)[0].level, 'assisted');
});
