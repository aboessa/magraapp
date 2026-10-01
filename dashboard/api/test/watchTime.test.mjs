import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { processFamilyEvent } from '../src/queue/familyEvents.ts';

/// ADM-309 — watch-time analytics.
///
/// The seconds existed only in each family's Durable Object (`screen_time_daily`)
/// and were never emitted. These tests pin the projection and the emission.

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relative) => readFileSync(root + relative, 'utf8');

function fakeDb() {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            sql, params,
            async run() { writes.push({ sql, params }); return { meta: { changes: 1 } }; },
            async first() { return null; },
            async all() { return { results: [] }; },
          };
        },
      };
    },
    async batch(statements) {
      for (const s of statements) writes.push({ sql: s.sql, params: s.params });
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

const credited = (payload = {}, eventId = 'evt_watch_1') => ({
  eventId,
  type: 'watch_time.credited',
  schemaVersion: 1,
  parentId: 'parent_12345678',
  occurredAt: 1_700_000_000_000,
  payload: {
    leaseId: 'lease_1', childId: 'child_12345678', ageTrack: 'kids',
    entityType: 'episode', entityId: 'ep-1', activityDate: '2026-09-28', seconds: 30,
    ...payload,
  },
});

const watchWrites = (db) => db.writes.filter((w) => /INSERT INTO child_watch_time_daily/.test(w.sql));

test('a credited interval becomes watch time for that child, day and episode', async () => {
  const db = fakeDb();
  const result = await processFamilyEvent({ DB: db }, credited());
  assert.equal(result.accepted, true);
  const [write] = watchWrites(db);
  assert.ok(write, 'child_watch_time_daily is written');
  assert.deepEqual(write.params.slice(0, 7),
    ['2026-09-28', 'child_12345678', 'episode', 'ep-1', 'parent_12345678', 'kids', 30]);
  assert.match(write.sql, /watched_seconds = child_watch_time_daily\.watched_seconds \+ excluded\.watched_seconds/);
});

test('the additive write is guarded against redelivery inside the same batch', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, credited());
  const [write] = watchWrites(db);
  assert.match(write.sql, /NOT EXISTS \(SELECT 1 FROM processed_family_events WHERE event_id = \?\)/);
  assert.equal(write.params[8], 'evt_watch_1');
  // And the processed row comes after it in the batch.
  const order = db.writes.map((w) => w.sql);
  const watchAt = order.findIndex((s) => /child_watch_time_daily/.test(s));
  const processedAt = order.findIndex((s) => /INSERT OR IGNORE INTO processed_family_events/.test(s));
  assert.ok(watchAt >= 0 && processedAt > watchAt);
});

test('deleted children and families are not projected', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, credited());
  const [write] = watchWrites(db);
  assert.match(write.sql, /child_deletion_watermarks/);
  assert.match(write.sql, /family_deletion_watermarks/);
});

test('malformed watch time is refused, not stored', async () => {
  for (const bad of [{ seconds: 0 }, { seconds: 99_999 }, { seconds: 1.5 }, { activityDate: '28/09/2026' }, { entityId: '' }]) {
    const db = fakeDb();
    await assert.rejects(processFamilyEvent({ DB: db }, credited(bad)), /invalid_watch_time_event/);
  }
});

test('an unknown age track is stored as null rather than trusted', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, credited({ ageTrack: 'adult' }));
  assert.equal(watchWrites(db)[0].params[5], null);
});

test('deleting a child or family removes their watch history', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, {
    eventId: 'evt_child_deleted_1', type: 'child.deleted', schemaVersion: 1, parentId: 'parent_12345678',
    occurredAt: 1_700_000_000_000, payload: { childId: 'child_12345678', requestId: 'req_1' },
  });
  assert.ok(db.writes.some((w) => /DELETE FROM child_watch_time_daily WHERE child_id = \?/.test(w.sql)));
  assert.ok(read('src/queue/familyEvents.ts').includes('DELETE FROM child_watch_time_daily WHERE parent_id = ?'));
});

test('FamilyState emits the credit in the same transaction as the screen-time counter', () => {
  const source = read('src/do/FamilyState.ts');
  const body = source.slice(source.indexOf('private creditWatchTime('), source.indexOf('// --- ENC-001'));
  assert.match(body, /transactionSync\(\(\) => \{[\s\S]*INSERT INTO screen_time_daily[\s\S]*addOutbox\('watch_time\.credited'/);
  // The tail between the last heartbeat and the end is credited, capped.
  const end = source.slice(source.indexOf('private async endPlayback('), source.indexOf('private async applyEntitlement('));
  assert.match(end, /creditWatchTime\(tail, localDate, [\s\S]{0,120}END_TAIL_CREDIT_SECONDS\)/);
});

test('watch time is not written to the family audit log', async () => {
  const { familyAuditStatement } = await import('../src/lib/familyAudit.ts');
  assert.equal(familyAuditStatement(fakeDb(), credited()), null);
});
