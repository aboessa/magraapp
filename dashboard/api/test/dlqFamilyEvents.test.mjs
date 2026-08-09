import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handleFamilyEventsDlq } from '../src/queue/dlq.ts';

/// Regression coverage for dead-lettered family events.
///
/// ## The defect these tests pin
///
/// `handleFamilyEventsDlq` logged each failed message with `console.error` and
/// then called `msg.ack()`. An ack removes the message from the queue, so a
/// family event that had exhausted every retry was destroyed. The only record
/// was a log line that ages out, leaving that family's `family_projection`
/// permanently behind with nothing to detect or repair it.
///
/// The comment claimed "لا نحذف الرسالة دون تسجيل" while doing exactly that, and
/// pointed at `/admin/family-projection/reconcile` for recovery — a route that
/// did not exist anywhere in the codebase.
///
/// The handler now writes to `failed_family_events` *before* acking, and retries
/// when that write fails. These tests pin the ordering, because acking first and
/// persisting second reintroduces the original data loss.

/// D1 stub recording every statement. `run()` is all the handler calls.
function fakeDb({ failWrites = false } = {}) {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              if (failWrites) throw new Error('D1 unavailable');
              writes.push({ sql, params });
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

/// Queue message stub tracking which disposition the handler chose.
function fakeMessage(body, attempts = 3) {
  return {
    body,
    attempts,
    acked: false,
    retried: false,
    ack() { this.acked = true; },
    retry() { this.retried = true; },
  };
}

const validEvent = {
  eventId: 'event_12345678',
  type: 'child.created',
  schemaVersion: 1,
  parentId: 'parent_12345678',
  occurredAt: 1_700_000_000_000,
  payload: { childId: 'child_12345678', ageTrack: 'kids' },
};

/// Silences the handler's console.error for one call. The logging is intended
/// behaviour, but it would otherwise flood the test output.
async function withQuietConsole(run) {
  const original = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = original;
  }
}

test('a failed event is persisted before it is acknowledged', async () => {
  const db = fakeDb();
  const message = fakeMessage(validEvent);

  await withQuietConsole(() => handleFamilyEventsDlq({ messages: [message] }, { DB: db }));

  assert.equal(db.writes.length, 1, 'the event must be written to failed_family_events');
  assert.match(db.writes[0].sql, /INSERT INTO failed_family_events/);
  assert.equal(message.acked, true, 'once persisted, acking is safe');
  assert.equal(message.retried, false);
});

test('the stored row carries the identity needed to find the affected family', async () => {
  const db = fakeDb();
  await withQuietConsole(() => handleFamilyEventsDlq(
    { messages: [fakeMessage(validEvent)] },
    { DB: db },
  ));

  const [, eventId, eventType, parentId, occurredAt, payload, attempts] = db.writes[0].params;
  assert.equal(eventId, 'event_12345678');
  assert.equal(eventType, 'child.created');
  assert.equal(parentId, 'parent_12345678');
  assert.equal(occurredAt, 1_700_000_000_000);
  assert.equal(attempts, 3);

  // The raw body is kept so replay does not depend on the capture having parsed
  // it correctly at the time of failure.
  assert.deepEqual(JSON.parse(payload), validEvent);
});

test('a write failure retries instead of dropping the event', async () => {
  // This is the inversion that matters. The old handler acked unconditionally,
  // so any failure here destroyed the message.
  const db = fakeDb({ failWrites: true });
  const message = fakeMessage(validEvent);

  await withQuietConsole(() => handleFamilyEventsDlq({ messages: [message] }, { DB: db }));

  assert.equal(message.acked, false, 'an unpersisted event must never be acknowledged');
  assert.equal(message.retried, true);
});

test('a malformed body is recorded rather than discarded', async () => {
  // An unparseable message is one reason an event reaches the DLQ at all, so the
  // handler must not assume the shape it hoped for.
  const db = fakeDb();
  const message = fakeMessage({ garbage: true, eventId: 42 });

  await withQuietConsole(() => handleFamilyEventsDlq({ messages: [message] }, { DB: db }));

  const [, eventId, eventType, parentId, occurredAt, payload] = db.writes[0].params;
  // Nullable columns exist precisely for this: a failure with unknown identity
  // is still worth keeping.
  assert.equal(eventId, null, 'a non-string event id becomes null, not "42"');
  assert.equal(eventType, null);
  assert.equal(parentId, null);
  assert.equal(occurredAt, null);
  assert.deepEqual(JSON.parse(payload), { garbage: true, eventId: 42 });
  assert.equal(message.acked, true);
});

test('a non-object body does not throw', async () => {
  const db = fakeDb();
  const messages = [fakeMessage(null), fakeMessage('a string'), fakeMessage([1, 2])];

  await withQuietConsole(() => handleFamilyEventsDlq({ messages }, { DB: db }));

  assert.equal(db.writes.length, 3, 'every message is recorded whatever its shape');
  for (const message of messages) assert.equal(message.acked, true);
});

test('snake_case identity fields are read as well as camelCase', async () => {
  // Production emits camelCase, but the DLQ is not the place to be strict about
  // shape: an older message must still be identifiable.
  const db = fakeDb();
  await withQuietConsole(() => handleFamilyEventsDlq({
    messages: [fakeMessage({
      event_id: 'event_87654321',
      event_type: 'entitlement.updated',
      parent_id: 'parent_87654321',
      occurred_at_ms: 1_700_000_000_001,
    })],
  }, { DB: db }));

  const [, eventId, eventType, parentId, occurredAt] = db.writes[0].params;
  assert.equal(eventId, 'event_87654321');
  assert.equal(eventType, 'entitlement.updated');
  assert.equal(parentId, 'parent_87654321');
  assert.equal(occurredAt, 1_700_000_000_001);
});

test('an oversized payload is truncated rather than failing the write', async () => {
  const db = fakeDb();
  const huge = { ...validEvent, payload: { blob: 'x'.repeat(40_000) } };

  await withQuietConsole(() => handleFamilyEventsDlq(
    { messages: [fakeMessage(huge)] },
    { DB: db },
  ));

  const stored = JSON.parse(db.writes[0].params[5]);
  assert.equal(stored.error, 'payload_truncated');
  assert.ok(stored.original_length > 20_000);
  assert.ok(stored.preview.length <= 2_000);
  // Identity columns still resolve, so the family is traceable even though the
  // body was too large to keep whole.
  assert.equal(db.writes[0].params[1], 'event_12345678');
});

test('an unserializable payload is recorded as such', async () => {
  const db = fakeDb();
  const cyclic = { ...validEvent };
  cyclic.self = cyclic;

  await withQuietConsole(() => handleFamilyEventsDlq(
    { messages: [fakeMessage(cyclic)] },
    { DB: db },
  ));

  assert.deepEqual(
    JSON.parse(db.writes[0].params[5]),
    { error: 'payload_not_serializable' },
  );
});

test('one failing message does not block the rest of the batch', async () => {
  // Queue batches hold up to ten messages; a single bad one must not strand the
  // others in the DLQ.
  let call = 0;
  const writes = [];
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              call += 1;
              if (call === 2) throw new Error('transient');
              writes.push({ sql, params });
            },
          };
        },
      };
    },
  };
  const messages = [fakeMessage(validEvent), fakeMessage(validEvent), fakeMessage(validEvent)];

  await withQuietConsole(() => handleFamilyEventsDlq({ messages }, { DB: db }));

  assert.equal(messages[0].acked, true);
  assert.equal(messages[1].retried, true, 'only the failing message is retried');
  assert.equal(messages[2].acked, true);
  assert.equal(writes.length, 2);
});

/* --------------------------------------------------- the recovery path exists */

const routesDir = fileURLToPath(new URL('../src/routes/', import.meta.url));
const projectionSource = readFileSync(routesDir + 'adminFamilyProjection.ts', 'utf8');

test('dead-lettered events are readable and replayable', () => {
  // Persisting to a table nobody can read is barely better than the log line it
  // replaced. The old code promised recovery through a route that never existed;
  // these assertions keep that promise honest.
  assert.match(projectionSource, /\/failed-family-events'/, 'the failed events must be listable');
  assert.match(projectionSource, /\/failed-family-events\/:id\/replay'/);
  assert.match(projectionSource, /\/failed-family-events\/:id\/discard'/);

  // Replay must go through the same processor that failed, so the idempotency
  // check in processFamilyEvent still applies and nothing is applied twice.
  assert.match(projectionSource, /processFamilyEvent\(c\.env, body\)/);
});

test('replay and discard are guarded and attributed', () => {
  for (const path of ['replay', 'discard']) {
    const index = projectionSource.indexOf(`/failed-family-events/:id/${path}'`);
    assert.ok(index > 0, `${path} route is missing`);
    const registration = projectionSource.slice(index, index + 200);
    assert.match(
      registration,
      /requirePermission\('publish'\)/,
      `${path} rewrites projected family state and must be guarded`,
    );
  }

  // resolved_by comes from the session, matching the actor fixes elsewhere.
  assert.match(projectionSource, /resolved_by = \?/);
  assert.match(projectionSource, /actorId\(c\)/);
});

test('discarding requires a written reason', () => {
  // A discarded row with no reason recreates the original problem: the
  // information about why data was lost is itself lost.
  const index = projectionSource.indexOf('/failed-family-events/:id/discard\'');
  const handler = projectionSource.slice(index, index + 1_200);
  assert.match(handler, /note is required when discarding an event/);
});

test('the dead-letter table matches what the handler writes', () => {
  const migration = readFileSync(
    fileURLToPath(new URL('../migrations/0021_dlq_family_events.sql', import.meta.url)),
    'utf8',
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS failed_family_events/);
  // The three states the routes transition between.
  assert.match(migration, /CHECK \(status IN \('pending', 'replayed', 'discarded'\)\)/);
  // Identity columns are nullable on purpose; a malformed body has no identity.
  for (const column of ['event_id', 'event_type', 'parent_id', 'occurred_at_ms']) {
    assert.doesNotMatch(
      migration,
      new RegExp(`${column}[^,]*NOT NULL`),
      `${column} must stay nullable so a malformed event can still be recorded`,
    );
  }
  assert.match(migration, /payload TEXT NOT NULL/, 'the raw body is the point of the table');
});
