import assert from 'node:assert/strict';
import test from 'node:test';

import { processFamilyEvent } from '../src/queue/familyEvents.ts';

/// ADM-307 — devices across families, projected from FamilyState events.

function fakeDb() {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      return { bind(...params) { return { sql, params, async first() { return null; } }; } };
    },
    async batch(statements) { for (const s of statements) writes.push({ sql: s.sql, params: s.params }); },
  };
}

let n = 0;
const event = (type, payload) => ({
  eventId: `evt_device_${++n}_${type}`, type, schemaVersion: 1,
  parentId: 'parent_12345678', occurredAt: 1_700_000_000_000 + n, payload,
});
const deviceWrites = (db) => db.writes.filter((w) => /device_projection/.test(w.sql));

test('a sign-in projects the device, without any fingerprint', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('session.created', {
    sessionId: 's1', deviceId: 'dev-1', platform: 'android_tv', displayName: 'تلفزيون الصالة', registeredAt: 5,
  }));
  const [write] = deviceWrites(db);
  assert.ok(write);
  assert.deepEqual(write.params.slice(0, 6), ['dev-1', 'parent_12345678', 'تلفزيون الصالة', 'android_tv', 'active', 5]);
  assert.doesNotMatch(write.sql, /installation/);
  // An ordinary sign-in never un-revokes.
  assert.equal(write.params.at(-2), 0);
});

test('an older event without a name does not erase a known name', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('session.created', { sessionId: 's', deviceId: 'dev-1', platform: 'ios' }));
  assert.match(deviceWrites(db)[0].sql, /COALESCE\(excluded\.display_name, device_projection\.display_name\)/);
});

test('a parent or operator revoke marks the device revoked', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('device.revoked', { deviceId: 'dev-1', by: 'operator' }));
  const [write] = deviceWrites(db);
  assert.match(write.sql, /SET status = 'revoked'/);
  assert.deepEqual(write.params.slice(2), ['parent_12345678', 'dev-1']);
});

test('operator revoke-all revokes the listed devices; a password reset does not', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('session.revoked', { scope: 'all', actorId: 'op', deviceIds: ['a', 'b'] }));
  assert.deepEqual(deviceWrites(db)[0].params.slice(2), ['parent_12345678', 'a', 'b']);

  const reset = fakeDb();
  await processFamilyEvent({ DB: reset }, event('session.revoked', { scope: 'all', reason: 'password_reset', count: 2 }));
  assert.equal(deviceWrites(reset).length, 0, 'sessions end, devices stay');
});

test('a resync backfills every device and may set a revoke', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('family.resynced', {
    plan: 'free', status: 'active', children: [], device_count: 2, active_device_count: 1,
    devices: [
      { id: 'dev-a', platform: 'android', status: 'active', display_name: 'هاتف', registered_at: 1, last_seen_at: 9, revoked_at: null },
      { id: 'dev-b', platform: 'web', status: 'revoked', display_name: null, registered_at: 2, last_seen_at: 3, revoked_at: 4 },
    ],
  }));
  const writes = deviceWrites(db);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].params[4], 'revoked');
  assert.equal(writes[1].params.at(-1), 1, 'a snapshot is authoritative');
});

test('a deleted family loses its device rows', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('family.deleted', { requestId: 'req_12345678' }));
  assert.ok(db.writes.some((w) => /DELETE FROM device_projection WHERE parent_id = \?/.test(w.sql)));
});
