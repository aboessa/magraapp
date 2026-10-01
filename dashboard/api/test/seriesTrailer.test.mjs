import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/// APP-204 — the TV hero trailer: private, capability-served, withheld at bedtime,
/// and never a playback lease (not screen time, not a stream slot).

const source = readFileSync(new URL('../src/routes/series.ts', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf("seriesRoute.get('/:id/trailer'"), source.indexOf('export default seriesRoute'));

test('the trailer requires a signed-in parent and the child to be theirs', () => {
  assert.match(handler, /authenticateParent\(/);
  assert.match(handler, /child_projection WHERE child_id = \? AND parent_id = \? AND status = 'active'/);
});

test('it is withheld during bedtime', () => {
  assert.match(handler, /loadScreenTimePolicy\(/);
  assert.match(handler, /if \(policy\.bedtimeActive\) return c\.body\(null, 204\)/);
});

test('it serves only a private video linked as the series trailer', () => {
  assert.match(handler, /al\.role = 'trailer'/);
  assert.match(handler, /ca\.kind = 'video' AND ca\.status = 'ready' AND ca\.visibility = 'private'/);
  assert.match(handler, /Cache-Control': 'private, no-store'/);
});

test('it is not a playback lease: no screen time, no concurrent-stream slot', () => {
  assert.doesNotMatch(handler, /\/playback\/start/);
  assert.match(handler, /lid: `trailer:/);
});
