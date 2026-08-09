import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { FamilyState } from '../src/do/FamilyState.ts';

/// Regression coverage for the FamilyState Durable Object.
///
/// ## Why this file exists
///
/// `src/do/FamilyState.ts` is 925 lines and 22 handlers, and it is the source of
/// truth for family state — every D1 projection is derived from the events it
/// emits. It had zero tests, making it the largest untested surface in the
/// codebase.
///
/// The invariants here are not cosmetic. They are the plan limits that stop a
/// free account registering eight devices, the refresh-token reuse detection
/// that revokes a session when a stolen token is replayed, and the idempotency
/// keys that stop a retried progress event being applied twice. A silent
/// regression in any of them is a billing or security problem, not a display
/// bug.
///
/// ## A real SQLite engine, not a mock
///
/// Node 22 ships `node:sqlite`, so `SqlStorage` is shimmed over a real in-memory
/// database rather than a hand-written fake. That matters: the handlers lean on
/// actual SQL semantics — `ON CONFLICT ... DO UPDATE`, `CHECK` constraints,
/// `UNIQUE` violations, `MAX()` in an upsert. A mock returning canned rows would
/// assert that the test author understood the SQL, not that the SQL is correct.
///
/// The one thing this cannot cover is Durable Object concurrency: input gates
/// and single-threaded execution are runtime guarantees, so a test that needs
/// them would need `workerd`. Everything asserted below is logic that runs the
/// same way in either place.

/* ------------------------------------------------------------------ the shim */

/// Wraps `node:sqlite` in the `SqlStorage` shape the DO expects.
///
/// Two call styles have to be supported, because the object uses both:
///
///   * The constructor passes one multi-statement block (`CREATE TABLE ...;
///     CREATE TABLE ...;`) with no parameters. `DatabaseSync.exec` handles that
///     and `prepare` does not.
///   * Every handler passes a single statement with positional parameters.
///     `prepare().all()` handles that and `exec` does not.
///
/// So the shim branches on whether parameters were supplied.
function sqlStorage(db) {
  return {
    exec(sql, ...params) {
      if (params.length === 0 && /;\s*\S/.test(sql)) {
        // Multi-statement DDL from the constructor.
        db.exec(sql);
        return { toArray: () => [] };
      }
      const statement = db.prepare(sql);
      // `all()` returns [] for writes, which is what `.toArray()` callers on an
      // INSERT/UPDATE expect.
      const rows = statement.all(...params);
      return { toArray: () => rows };
    },
  };
}

/// Minimal `DurableObjectState`.
///
/// `transactionSync` runs a real SQLite transaction so a throwing handler rolls
/// back exactly as it would in production. Alarms are recorded rather than
/// fired: the tests assert that one was *scheduled*, and invoke `alarm()`
/// directly when they want to observe delivery.
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
      async getAlarm() { return state.alarms.length ? state.alarms[state.alarms.length - 1] : null; },
    },
  };
  return state;
}

/// Builds a fresh object with an empty database.
///
/// `queue` defaults to a recorder so `scheduleOutbox` is exercised; passing
/// `null` models an environment with no queue binding, which the object treats
/// as "do not schedule".
function familyState({ queue = { batches: [] } } = {}) {
  const db = new DatabaseSync(':memory:');
  const state = durableState(db);
  const env = {
    FAMILY_EVENTS: queue
      ? { async sendBatch(messages) { queue.batches.push(messages); } }
      : undefined,
  };
  return { object: new FamilyState(state, env), db, state, queue };
}

const post = (path, body) => new Request(`https://do.local${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const get = (path) => new Request(`https://do.local${path}`, { method: 'GET' });

async function call(object, request) {
  const response = await object.fetch(request);
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

/// A family with one active session, which most handlers require.
async function seeded(options) {
  const context = familyState(options);
  await call(context.object, post('/initialize', {
    parent_id: 'parent_00000001',
    display_name: 'أسرة تجربة',
    identity_epoch: 1,
  }));
  const session = await call(context.object, post('/sessions/create', {
    session_id: 'session-1',
    refresh_token_hash: 'hash-1',
    installation_id_hash: 'install-1',
    platform: 'android',
    device_name: 'هاتف',
    expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }));
  return { ...context, session: session.body.data };
}

/// Rows the object wrote, read straight from SQLite. Asserting on stored state
/// catches a handler that returns success without persisting.
const rows = (db, sql) => db.prepare(sql).all();

/* ------------------------------------------------------------- initialization */

test('the schema is created on construction', () => {
  const { db } = familyState();
  const tables = rows(db, `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .map((row) => row.name);

  for (const expected of [
    'attempts', 'auth_sessions', 'children', 'content_progress', 'devices',
    'entitlements', 'favorites', 'idempotency_keys', 'mastery', 'outbox',
    'parental_settings', 'playback_leases', 'used_refresh_tokens',
  ]) {
    assert.ok(tables.includes(expected), `missing table ${expected}`);
  }
});

test('the parent PIN columns are added in place', () => {
  // Added after Phase 0 without a migration, so the constructor ALTERs an
  // existing table and swallows the error when the column is already there.
  const { db } = familyState();
  const columns = rows(db, `PRAGMA table_info(family)`).map((row) => row.name);
  assert.ok(columns.includes('parent_pin_hash'));
  assert.ok(columns.includes('parent_pin_failed_count'));
  assert.ok(columns.includes('parent_pin_locked_until'));
});

test('a second construction over the same database does not throw', () => {
  // Every DO wake-up runs the constructor again. `CREATE TABLE IF NOT EXISTS`
  // and the swallowed ALTERs make that idempotent; losing either would break
  // every request after the first eviction.
  const db = new DatabaseSync(':memory:');
  const state = durableState(db);
  new FamilyState(state, {});
  assert.doesNotThrow(() => new FamilyState(durableState(db), {}));
});

test('initialize starts on the free plan and emits one event', async () => {
  const { object, db, state } = familyState();
  const result = await call(object, post('/initialize', {
    parent_id: 'parent_00000001',
    display_name: 'أسرة',
    identity_epoch: 1,
  }));

  assert.equal(result.status, 200);
  assert.equal(result.body.data.plan, 'free');
  assert.equal(result.body.data.auth_epoch, 1);

  const outbox = rows(db, `SELECT event_type FROM outbox`);
  assert.deepEqual(outbox.map((row) => row.event_type), ['family.initialized']);
  // The outbox is drained by an alarm, so one must be scheduled or the event
  // never leaves.
  assert.equal(state.alarms.length, 1);
});

test('initialize is idempotent and does not emit twice', async () => {
  const { object, db } = familyState();
  const payload = { parent_id: 'parent_00000001', identity_epoch: 1 };
  await call(object, post('/initialize', payload));
  const second = await call(object, post('/initialize', payload));

  assert.equal(second.status, 200);
  assert.equal(rows(db, `SELECT event_id FROM outbox`).length, 1);
  assert.equal(rows(db, `SELECT parent_id FROM family`).length, 1);
});

test('a different parent id on an initialized family is a conflict', async () => {
  // One DO instance is one family. Accepting a second identity would silently
  // merge two families into one state.
  const { object } = familyState();
  await call(object, post('/initialize', { parent_id: 'parent_00000001', identity_epoch: 1 }));
  const result = await call(object, post('/initialize', { parent_id: 'parent_00000002', identity_epoch: 1 }));
  assert.equal(result.status, 409);
});

test('initialize rejects a missing parent id or epoch', async () => {
  const { object } = familyState();
  for (const body of [
    {},
    { parent_id: 'parent_00000001' },
    { identity_epoch: 1 },
    { parent_id: 'parent_00000001', identity_epoch: 0 },
    { parent_id: '', identity_epoch: 1 },
  ]) {
    const result = await call(object, post('/initialize', body));
    assert.equal(result.status, 400, JSON.stringify(body));
  }
});

/* ----------------------------------------------------------- plan limits */

test('the free plan allows exactly one device', async () => {
  // PLAN_LIMITS.free.devices is 1. A second installation must be refused, or a
  // free account shares one subscription across a household.
  const { object } = await seeded();
  const second = await call(object, post('/sessions/create', {
    session_id: 'session-2',
    refresh_token_hash: 'hash-2',
    installation_id_hash: 'install-2',
    platform: 'ios',
    expires_at: Date.now() + 60_000 * 10,
  }));

  assert.equal(second.status, 403);
  assert.match(second.body.error, /device limit/i);
});

test('the same installation reuses its device row rather than adding one', async () => {
  // Re-authenticating on the same phone must not consume another device slot.
  const { object, db } = await seeded();
  const again = await call(object, post('/sessions/create', {
    session_id: 'session-2',
    refresh_token_hash: 'hash-2',
    installation_id_hash: 'install-1',
    platform: 'android',
    device_name: 'هاتف محدَّث',
    expires_at: Date.now() + 60_000 * 10,
  }));

  assert.equal(again.status, 201);
  assert.equal(rows(db, `SELECT id FROM devices`).length, 1);
  // The display name is refreshed on re-auth.
  assert.equal(rows(db, `SELECT display_name FROM devices`)[0].display_name, 'هاتف محدَّث');
});

test('a revoked device cannot start a new session', async () => {
  // Revocation has to survive re-authentication, otherwise "revoke device" is
  // undone by the user simply signing in again.
  const { object, db } = await seeded();
  db.exec(`UPDATE devices SET status = 'revoked' WHERE installation_id_hash = 'install-1'`);

  const result = await call(object, post('/sessions/create', {
    session_id: 'session-2',
    refresh_token_hash: 'hash-2',
    installation_id_hash: 'install-1',
    platform: 'android',
    expires_at: Date.now() + 60_000 * 10,
  }));
  assert.equal(result.status, 403);
  assert.match(result.body.error, /revoked/i);
});

test('a paid plan raises the device ceiling', async () => {
  const { object, db } = await seeded();
  const now = Date.now();
  db.prepare(`
    INSERT INTO entitlements (id, source, plan, status, starts_at, expires_at, updated_at)
    VALUES ('ent-1', 'google_play', 'family', 'active', ?, ?, ?)
  `).run(now - 1000, now + 86_400_000, now);

  // family allows 4 devices, so the second registration now succeeds.
  const second = await call(object, post('/sessions/create', {
    session_id: 'session-2',
    refresh_token_hash: 'hash-2',
    installation_id_hash: 'install-2',
    platform: 'ios',
    expires_at: now + 60_000 * 10,
  }));
  assert.equal(second.status, 201);
  assert.equal(second.body.data.plan, 'family');
});

test('an expired entitlement does not grant a paid plan', async () => {
  // The plan is derived from the entitlement window, not from its mere presence.
  const { object, db } = await seeded();
  const now = Date.now();
  db.prepare(`
    INSERT INTO entitlements (id, source, plan, status, starts_at, expires_at, updated_at)
    VALUES ('ent-1', 'google_play', 'family_plus', 'active', ?, ?, ?)
  `).run(now - 86_400_000, now - 1000, now);

  const state = await call(object, get('/state'));
  assert.equal(state.body.data.family.plan, 'free');
});

test('the free plan allows exactly one child profile', async () => {
  const { object, session } = await seeded();
  const first = await call(object, post('/children', {
    session_id: session.session_id,
    nickname: 'سعاد',
    birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 7,
    avatar_id: 'avatar-1',
  }));
  assert.equal(first.status, 201);

  const second = await call(object, post('/children', {
    session_id: session.session_id,
    nickname: 'زيد',
    birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 8,
    avatar_id: 'avatar-2',
  }));
  assert.equal(second.status, 403);
  assert.match(second.body.error, /limit/i);
});

/* ------------------------------------------------------------- child profiles */

test('the age track is derived, never taken from the request', async () => {
  // A client-supplied track would let a 4-year-old be placed in the junior
  // track, which is a content-safety boundary rather than a preference.
  const { object, session } = await seeded();
  const year = new Date().getUTCFullYear();
  const result = await call(object, post('/children', {
    session_id: session.session_id,
    nickname: 'سعاد',
    birth_month: 1,
    birth_year: year - 7,
    avatar_id: 'avatar-1',
    age_track: 'junior',
  }));

  assert.equal(result.status, 201);
  assert.equal(result.body.data.age_track, 'kids');
});

test('a child outside three to twelve is refused', async () => {
  const { object, session } = await seeded();
  const year = new Date().getUTCFullYear();
  for (const birthYear of [year - 1, year - 2, year - 13, year - 40]) {
    const result = await call(object, post('/children', {
      session_id: session.session_id,
      nickname: 'طفل',
      birth_month: 6,
      birth_year: birthYear,
      avatar_id: 'avatar-1',
    }));
    assert.equal(result.status, 400, `birth year ${birthYear}`);
  }
});

test('adding a child requires an active session', async () => {
  const { object } = await seeded();
  const result = await call(object, post('/children', {
    session_id: 'not-a-session',
    nickname: 'سعاد',
    birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 7,
    avatar_id: 'avatar-1',
  }));
  assert.equal(result.status, 400);
});

test('a child creation emits an event carrying no birth date', async () => {
  // The projection stores a nickname and track; birth month and year are PII
  // that the event bus does not need to carry.
  const { object, db, session } = await seeded();
  await call(object, post('/children', {
    session_id: session.session_id,
    nickname: 'سعاد',
    birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 7,
    avatar_id: 'avatar-1',
  }));

  const event = rows(db, `SELECT payload_json FROM outbox WHERE event_type = 'child.created'`)[0];
  assert.ok(event, 'child.created was not emitted');
  const payload = JSON.parse(event.payload_json).payload;
  assert.equal(payload.ageTrack, 'kids');
  assert.equal(payload.birthMonth, undefined);
  assert.equal(payload.birthYear, undefined);
});

test('archived children do not count against the limit or the listing', async () => {
  const { object, db, session } = await seeded();
  await call(object, post('/children', {
    session_id: session.session_id,
    nickname: 'سعاد',
    birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 7,
    avatar_id: 'avatar-1',
  }));
  db.exec(`UPDATE children SET status = 'archived'`);

  const listed = await call(object, get('/children'));
  assert.deepEqual(listed.body.data, []);

  // The freed slot is usable again.
  const second = await call(object, post('/children', {
    session_id: session.session_id,
    nickname: 'زيد',
    birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 8,
    avatar_id: 'avatar-2',
  }));
  assert.equal(second.status, 201);
});

/* ------------------------------------------------------------------ sessions */

test('resolving a session requires a matching auth epoch', async () => {
  // The epoch is how "sign out everywhere" works: it is bumped, and every token
  // minted under the old value stops resolving.
  const { object, session } = await seeded();

  const ok = await call(object, post('/sessions/resolve', {
    session_id: session.session_id,
    auth_epoch: session.auth_epoch,
  }));
  assert.equal(ok.status, 200);

  const stale = await call(object, post('/sessions/resolve', {
    session_id: session.session_id,
    auth_epoch: session.auth_epoch + 1,
  }));
  assert.equal(stale.status, 401);
});

test('an expired session does not resolve', async () => {
  const { object, db, session } = await seeded();
  db.prepare(`UPDATE auth_sessions SET expires_at = ? WHERE id = ?`)
    .run(Date.now() - 1000, session.session_id);

  const result = await call(object, post('/sessions/resolve', {
    session_id: session.session_id,
    auth_epoch: session.auth_epoch,
  }));
  assert.equal(result.status, 401);
});

test('a refresh rotates the token hash', async () => {
  const { object, db, session } = await seeded();
  const result = await call(object, post('/sessions/refresh', {
    session_id: session.session_id,
    current_hash: 'hash-1',
    next_hash: 'hash-2',
  }));

  assert.equal(result.status, 200);
  const stored = rows(db, `SELECT refresh_token_hash FROM auth_sessions WHERE id = 'session-1'`)[0];
  assert.equal(stored.refresh_token_hash, 'hash-2');
  // The consumed hash is retained so a replay can be detected.
  assert.equal(rows(db, `SELECT token_hash FROM used_refresh_tokens`)[0].token_hash, 'hash-1');
});

test('replaying a consumed refresh token revokes the session', async () => {
  // The security invariant of the whole rotation scheme. A replayed token means
  // either the client is broken or the token was stolen; the safe response to
  // both is to end the session rather than to mint a new pair.
  const { object, db, session } = await seeded();
  await call(object, post('/sessions/refresh', {
    session_id: session.session_id,
    current_hash: 'hash-1',
    next_hash: 'hash-2',
  }));

  const replay = await call(object, post('/sessions/refresh', {
    session_id: session.session_id,
    current_hash: 'hash-1',
    next_hash: 'hash-3',
  }));

  assert.equal(replay.status, 401);
  const stored = rows(db, `SELECT status FROM auth_sessions WHERE id = 'session-1'`)[0];
  assert.equal(stored.status, 'revoked');
  assert.ok(
    rows(db, `SELECT event_id FROM outbox WHERE event_type = 'session.revoked'`).length > 0,
    'revocation was not published',
  );
});

test('a wrong hash that was never issued does not revoke the session', async () => {
  // Only a *replay* is evidence of compromise. A merely wrong value is refused
  // without punishing the session, or a buggy client could log everyone out.
  const { object, db, session } = await seeded();
  const result = await call(object, post('/sessions/refresh', {
    session_id: session.session_id,
    current_hash: 'never-issued',
    next_hash: 'hash-2',
  }));

  assert.equal(result.status, 401);
  assert.equal(rows(db, `SELECT status FROM auth_sessions WHERE id = 'session-1'`)[0].status, 'active');
});

test('logout revokes the session and its playback leases', async () => {
  const { object, db, session } = await seeded();
  const now = Date.now();
  db.prepare(`
    INSERT INTO playback_leases (
      id, child_id, device_id, session_id, asset_id, entity_type, entity_id,
      expires_at, created_at, last_heartbeat_at
    ) VALUES ('lease-1', 'child-1', ?, ?, 'asset-1', 'episode', 'ep-1', ?, ?, ?)
  `).run(session.device_id, session.session_id, now + 60_000, now, now);

  const result = await call(object, post('/sessions/logout', { session_id: session.session_id }));
  assert.equal(result.status, 200);
  assert.equal(rows(db, `SELECT status FROM auth_sessions WHERE id = 'session-1'`)[0].status, 'revoked');
  // A lease left active would hold a concurrent-stream slot for a session that
  // no longer exists.
  assert.equal(rows(db, `SELECT status FROM playback_leases WHERE id = 'lease-1'`)[0].status, 'revoked');
});

test('logging out an unknown session is unauthorized, not a success', async () => {
  const { object } = await seeded();
  const result = await call(object, post('/sessions/logout', { session_id: 'nope' }));
  assert.equal(result.status, 401);
});

/* -------------------------------------------------------------- progress */

async function seededWithChild() {
  const context = await seeded();
  const child = await call(context.object, post('/children', {
    session_id: context.session.session_id,
    nickname: 'سعاد',
    birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 7,
    avatar_id: 'avatar-1',
  }));
  return { ...context, child: child.body.data };
}

const progressBody = (context, over = {}) => ({
  session_id: context.session.session_id,
  child_id: context.child.id,
  content_type: 'episode',
  content_id: 'ep-1',
  event_id: 'event-1',
  position_ms: 30_000,
  duration_ms: 100_000,
  sequence: 1,
  ...over,
});

test('a progress update is stored and published', async () => {
  const context = await seededWithChild();
  const result = await call(context.object, post('/progress', progressBody(context)));

  assert.equal(result.status, 200);
  assert.equal(result.body.data.accepted, true);
  const stored = rows(context.db, `SELECT position_ms, sequence FROM content_progress`)[0];
  assert.equal(stored.position_ms, 30_000);
  assert.equal(stored.sequence, 1);
  assert.ok(rows(context.db, `SELECT event_id FROM outbox WHERE event_type = 'progress.updated'`).length);
});

test('replaying the same event id returns the cached response', async () => {
  // The client retries on a flaky network. Without the idempotency key the retry
  // would emit a second event and the projection would double-count it.
  const context = await seededWithChild();
  await call(context.object, post('/progress', progressBody(context)));
  const retry = await call(context.object, post('/progress', progressBody(context, { position_ms: 90_000 })));

  assert.equal(retry.status, 200);
  const stored = rows(context.db, `SELECT position_ms FROM content_progress`)[0];
  // The retry did not move the position, because it was answered from cache.
  assert.equal(stored.position_ms, 30_000);
  assert.equal(rows(context.db, `SELECT event_id FROM outbox WHERE event_type = 'progress.updated'`).length, 1);
});

test('an out-of-order update is rejected without losing the newer position', async () => {
  // Two devices report progress; the older report must not rewind the newer one.
  const context = await seededWithChild();
  await call(context.object, post('/progress', progressBody(context, { event_id: 'event-2', sequence: 5, position_ms: 80_000 })));
  const stale = await call(context.object, post('/progress', progressBody(context, { event_id: 'event-3', sequence: 2, position_ms: 10_000 })));

  assert.equal(stale.body.data.accepted, false);
  assert.equal(rows(context.db, `SELECT position_ms FROM content_progress`)[0].position_ms, 80_000);
});

test('ninety percent watched marks the item completed', async () => {
  const context = await seededWithChild();
  const result = await call(context.object, post('/progress', progressBody(context, {
    position_ms: 90_000,
    duration_ms: 100_000,
  })));

  assert.equal(result.body.data.completed, true);
  assert.equal(rows(context.db, `SELECT completed FROM content_progress`)[0].completed, 1);
  // A completion is a different event type, because the projection treats it
  // differently.
  assert.ok(rows(context.db, `SELECT event_id FROM outbox WHERE event_type = 'content.completed'`).length);
});

test('completion never reverts once reached', async () => {
  // Re-watching from the start must not un-complete an episode.
  const context = await seededWithChild();
  await call(context.object, post('/progress', progressBody(context, { event_id: 'e1', sequence: 1, position_ms: 95_000, duration_ms: 100_000 })));
  await call(context.object, post('/progress', progressBody(context, { event_id: 'e2', sequence: 2, position_ms: 1_000, duration_ms: 100_000 })));

  assert.equal(rows(context.db, `SELECT completed FROM content_progress`)[0].completed, 1);
});

test('progress for an unknown child is refused', async () => {
  const context = await seededWithChild();
  const result = await call(context.object, post('/progress', progressBody(context, { child_id: 'not-a-child' })));
  assert.equal(result.status, 400);
});

test('progress without a session is refused', async () => {
  const context = await seededWithChild();
  const result = await call(context.object, post('/progress', progressBody(context, { session_id: 'nope' })));
  assert.equal(result.status, 400);
});

/* --------------------------------------------------------------- favorites */

/// The handler reads `action: 'add' | 'remove'`, not a boolean `favorite`. Any
/// other value falls back to `add`, so a typo silently favourites instead of
/// unfavouriting — worth pinning.
test('a favorite can be added twice without duplicating', async () => {
  const context = await seededWithChild();
  const body = {
    session_id: context.session.session_id,
    child_id: context.child.id,
    entity_type: 'episode',
    entity_id: 'ep-1',
    action: 'add',
  };
  await call(context.object, post('/favorites', body));
  await call(context.object, post('/favorites', body));

  assert.equal(rows(context.db, `SELECT entity_id FROM favorites`).length, 1);
});

test('a favorite can be removed', async () => {
  const context = await seededWithChild();
  const base = {
    session_id: context.session.session_id,
    child_id: context.child.id,
    entity_type: 'episode',
    entity_id: 'ep-1',
  };
  await call(context.object, post('/favorites', { ...base, action: 'add' }));
  await call(context.object, post('/favorites', { ...base, action: 'remove' }));

  assert.equal(rows(context.db, `SELECT entity_id FROM favorites`).length, 0);
});

test('an unrecognised favorite action defaults to adding', async () => {
  // Documenting the fallback rather than asserting it is correct: a client that
  // sends `favorite: false` expecting removal gets an add instead.
  const context = await seededWithChild();
  await call(context.object, post('/favorites', {
    session_id: context.session.session_id,
    child_id: context.child.id,
    entity_type: 'episode',
    entity_id: 'ep-1',
    action: 'delete',
  }));

  assert.equal(rows(context.db, `SELECT entity_id FROM favorites`).length, 1);
});

/* ------------------------------------------------------------------ outbox */

test('the alarm delivers pending events and marks them sent', async () => {
  const { object, db, queue } = familyState();
  await call(object, post('/initialize', { parent_id: 'parent_00000001', identity_epoch: 1 }));

  await object.alarm();

  assert.equal(queue.batches.length, 1);
  assert.equal(queue.batches[0].length, 1);
  assert.equal(queue.batches[0][0].body.type, 'family.initialized');
  assert.equal(rows(db, `SELECT status FROM outbox`)[0].status, 'sent');
});

test('a queue failure leaves the event pending and schedules a retry', async () => {
  // Losing the event here would leave D1 permanently behind the DO, which is the
  // failure the dead-letter table exists to catch downstream.
  const db = new DatabaseSync(':memory:');
  const state = durableState(db);
  const object = new FamilyState(state, {
    FAMILY_EVENTS: { async sendBatch() { throw new Error('queue unavailable'); } },
  });
  await call(object, post('/initialize', { parent_id: 'parent_00000001', identity_epoch: 1 }));

  await assert.rejects(() => object.alarm(), /queue unavailable/);

  const row = rows(db, `SELECT status, attempts FROM outbox`)[0];
  assert.equal(row.status, 'pending');
  assert.equal(row.attempts, 1);
  // A retry must be scheduled, or the event waits for an unrelated alarm.
  assert.ok(state.alarms.length >= 1);
});

test('the alarm is a no-op with no queue binding', async () => {
  // Local development runs without the queue. Throwing here would break every
  // request that schedules an alarm.
  const { object } = familyState({ queue: null });
  await call(object, post('/initialize', { parent_id: 'parent_00000001', identity_epoch: 1 }));
  await assert.doesNotReject(() => object.alarm());
});

test('an alarm with an empty outbox sends nothing', async () => {
  const { object, queue } = familyState();
  await object.alarm();
  assert.equal(queue.batches.length, 0);
});

test('the alarm expires stale idempotency keys and used tokens', async () => {
  // Both tables grow with every request and are only bounded by this sweep.
  const { object, db } = familyState();
  await call(object, post('/initialize', { parent_id: 'parent_00000001', identity_epoch: 1 }));
  const past = Date.now() - 1000;
  db.prepare(`INSERT INTO idempotency_keys (key, operation, response_json, expires_at) VALUES ('old', 'progress', '{}', ?)`).run(past);
  db.prepare(`INSERT INTO used_refresh_tokens (token_hash, session_id, expires_at, used_at) VALUES ('old', 's', ?, ?)`).run(past, past);

  await object.alarm();

  assert.equal(rows(db, `SELECT key FROM idempotency_keys`).length, 0);
  assert.equal(rows(db, `SELECT token_hash FROM used_refresh_tokens`).length, 0);
});

/* --------------------------------------------------------------- routing */

test('an unknown path is a 404, not a 500', async () => {
  const { object } = familyState();
  const result = await call(object, post('/does-not-exist', {}));
  assert.equal(result.status, 404);
});

test('a malformed body is a handled failure, not an unhandled throw', async () => {
  // `request.json()` throws on invalid JSON; the catch in `fetch` turns that
  // into a 500 envelope rather than letting the isolate report an error.
  const { object } = familyState();
  const response = await object.fetch(new Request('https://do.local/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ not json',
  }));
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.success, false);
  // The internal message must not leak to the caller.
  assert.doesNotMatch(body.error, /JSON/i);
});

test('the method is part of the route, not just the path', async () => {
  // `GET /children` lists and `POST /children` creates. Matching on path alone
  // would let a GET fall into the mutating handler.
  const { object } = await seeded();
  const listed = await call(object, get('/children'));
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.data, []);
});

/* ------------------------------------------------------------- state read */

/// The envelope nests the family under `data.family`, alongside sibling
/// `children`, `progress` and `favorites` arrays. Reading `data.plan` returns
/// undefined, which an `assert.ok` would have passed silently.
test('the state read reports the plan and the child roster', async () => {
  const context = await seededWithChild();
  const result = await call(context.object, get('/state'));

  assert.equal(result.status, 200);
  assert.equal(result.body.data.family.plan, 'free');
  assert.equal(result.body.data.family.parent_id, 'parent_00000001');
  assert.equal(result.body.data.children.length, 1);
  assert.equal(result.body.data.children[0].nickname, 'سعاد');
  // The roster carries no birth date: /state is read by the app, not by support.
  assert.equal(result.body.data.children[0].birth_year, undefined);
});

test('a state read before initialization is a 404', async () => {
  const { object } = familyState();
  const result = await call(object, get('/state'));
  assert.equal(result.status, 404);
});

test('the device listing excludes nothing and reports status', async () => {
  const { object, db } = await seeded();
  db.exec(`UPDATE devices SET status = 'revoked'`);
  const result = await call(object, get('/devices'));

  assert.equal(result.status, 200);
  // A revoked device must remain visible, or an operator cannot see what was
  // revoked.
  assert.equal(result.body.data.length, 1);
  assert.equal(result.body.data[0].status, 'revoked');
});
