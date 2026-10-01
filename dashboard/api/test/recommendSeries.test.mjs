import assert from 'node:assert/strict';
import test from 'node:test';

import { rankSeries } from '../src/lib/recommendSeries.ts';
import { processFamilyEvent } from '../src/queue/familyEvents.ts';

/// APP-209 — «عجبني» feeds recommendations.

const all = [
  { id: 'liked', planet_id: 'oloom', categories: ['animals'] },
  { id: 'same-planet', planet_id: 'oloom', categories: [] },
  { id: 'same-both', planet_id: 'oloom', categories: ['animals'] },
  { id: 'same-category', planet_id: 'qisas', categories: ['animals'] },
  { id: 'unrelated', planet_id: 'arqam', categories: ['numbers'] },
  { id: 'watched', planet_id: 'arqam', categories: ['numbers'] },
];

test('series like the one the child liked rank first', () => {
  const ranked = rankSeries(all, [{ series_id: 'liked', kind: 'like' }], all);
  assert.deepEqual(ranked.map((r) => r.series_id), ['same-both', 'same-planet', 'same-category']);
  assert.equal(ranked[0].reason, 'liked_similar');
});

test('what the child already liked, saved or watched is not recommended back', () => {
  const ranked = rankSeries(all, [
    { series_id: 'liked', kind: 'like' },
    { series_id: 'same-both', kind: 'save' },
    { series_id: 'watched', kind: 'watch', minutes: 30 },
  ], all);
  const ids = ranked.map((r) => r.series_id);
  for (const known of ['liked', 'same-both', 'watched']) assert.ok(!ids.includes(known), known);
  assert.ok(ids.includes('unrelated'), 'similar to a watched series');
});

test('a like outweighs a short watch', () => {
  const ranked = rankSeries(all, [
    { series_id: 'liked', kind: 'like' },
    { series_id: 'watched', kind: 'watch', minutes: 2 },
  ], all);
  assert.equal(ranked[0].series_id, 'same-both');
  assert.equal(ranked.find((r) => r.series_id === 'unrelated').reason, 'watched_similar');
});

test('no signals means no personal picks (the age fill takes over)', () => {
  assert.deepEqual(rankSeries(all, [], all), []);
});

/* ------------------------------------------------------------ projection */

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

const favorite = (payload, occurredAt = 1_700_000_000_000) => ({
  eventId: `evt_fav_${occurredAt}_${payload.entityType}`, type: 'favorite.updated', schemaVersion: 1,
  parentId: 'parent_12345678', occurredAt, payload,
});
const signalWrites = (db) => db.writes.filter((w) => /child_series_signals/.test(w.sql));

test('a like and a save are projected as signals; a remove turns one off', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, favorite({ childId: 'child_1', entityType: 'series_like', entityId: 's1', action: 'add' }));
  await processFamilyEvent({ DB: db }, favorite({ childId: 'child_1', entityType: 'series', entityId: 's2', action: 'add' }, 2));
  await processFamilyEvent({ DB: db }, favorite({ childId: 'child_1', entityType: 'series_like', entityId: 's1', action: 'remove' }, 3));
  const [like, save, remove] = signalWrites(db);
  assert.deepEqual(like.params.slice(0, 5), ['child_1', 's1', 'like', 'parent_12345678', 1]);
  assert.deepEqual(save.params.slice(0, 5), ['child_1', 's2', 'save', 'parent_12345678', 1]);
  assert.equal(remove.params[4], 0);
  assert.match(like.sql, /WHERE excluded\.last_event_at_ms >= child_series_signals\.last_event_at_ms/);
});

test('other favourite types are not projected', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, favorite({ childId: 'child_1', entityType: 'game', entityId: 'g1', action: 'add' }));
  assert.equal(signalWrites(db).length, 0);
});
