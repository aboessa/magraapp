/// Independent verification of the CMS trace-pack helpers.
///
/// These are the functions the Trace Path Editor relies on, so a defect here means
/// an editor authors geometry that the server will reject or, worse, that a child
/// cannot trace. Run from dashboard/api so the node test runner is already set up.

import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../../front/src/lib/tracePack.ts');

test('coordinates are clamped into the pack space and rounded', () => {
  assert.equal(mod.clamp01(1.4), 1);
  assert.equal(mod.clamp01(-0.2), 0);
  // 3 decimals is enough for a 0..1 space at any canvas size and keeps the pack
  // readable; more would be noise from pointer jitter.
  assert.equal(mod.roundCoord(0.123456), 0.123);
});

test('Ramer-Douglas-Peucker turns a dragged path into an authored one', () => {
  // A dense straight drag must collapse to its endpoints, or every hand-drawn
  // stroke would ship hundreds of points.
  const line = Array.from({ length: 60 }, (_, i) => [i / 59, 0.5]);
  const simplified = mod.simplifyPath(line, 0.01);
  assert.equal(simplified.length, 2);
  assert.deepEqual(simplified[0], [0, 0.5]);

  // A real corner must survive.
  const corner = [[0, 0], [0.25, 0], [0.5, 0], [0.5, 0.25], [0.5, 0.5]];
  const keptCorner = mod.simplifyPath(corner, 0.01);
  assert.ok(keptCorner.some(([x, y]) => x === 0.5 && y === 0),
    'the corner point must be retained');

  // Degenerate inputs must not throw: an editor can click once.
  assert.deepEqual(mod.simplifyPath([], 0.01), []);
  assert.equal(mod.simplifyPath([[0.5, 0.5]], 0.01).length, 1);
});

test('a closed shape does not divide by zero', () => {
  // A circle authored first-point == last-point is the shapes pack's own shape,
  // and the naive perpendicular-distance formula degenerates on it.
  const ring = [[0.5, 0.15], [0.85, 0.5], [0.5, 0.85], [0.15, 0.5], [0.5, 0.15]];
  const simplified = mod.simplifyPath(ring, 0.001);
  assert.ok(simplified.length >= 4);
  assert.deepEqual(simplified.at(-1), simplified[0]);
});

test('stroke order is renumbered contiguously from 1', () => {
  // The server rejects gaps, so the editor must never be able to produce one.
  const renumbered = mod.renumberStrokes([
    { id: 's3', order: 7, points: [[0, 0], [1, 1]], type: 'stroke' },
    { id: 's1', order: 2, points: [[0, 1], [1, 0]], type: 'stroke' },
  ]);
  assert.deepEqual(renumbered.map((s) => s.order), [1, 2]);
});

test('the scoring table matches the server exactly', async () => {
  // Two copies of this rule exist by necessity - one for immediate feedback, one
  // for enforcement. They must not disagree, or the CMS will promise a save the
  // server refuses.
  const server = await import('../src/lib/gamePackValidation.ts');
  for (const [mode, allowed] of Object.entries(server.SCORING_BY_MODE)) {
    assert.deepEqual(
      [...(mod.SCORING_BY_MODE[mode] ?? [])].sort(),
      [...allowed].sort(),
      `scoring for mode "${mode}" differs between client and server`,
    );
  }
});

test('free expression can never be marked scoreable in the editor', () => {
  for (const mode of ['coloring', 'free_draw', 'draw_from_prompt']) {
    assert.deepEqual(mod.SCORING_BY_MODE[mode], ['none'], mode);
  }
});

test('an out-of-order Arabic dot is reported, never silently fixed', () => {
  // Silently reordering would hide an authoring mistake in the one thing the
  // objective actually measures.
  const issue = mod.letterOrderIssue([
    { id: 's1', order: 1, type: 'dot', points: [[0.55, 0.78]] },
    { id: 's2', order: 2, type: 'stroke', points: [[0.8, 0.45], [0.3, 0.45]] },
  ], 'ar');
  assert.ok(issue, 'a dot ordered before the body must be reported');

  const fine = mod.letterOrderIssue([
    { id: 's1', order: 1, type: 'stroke', points: [[0.8, 0.45], [0.3, 0.45]] },
    { id: 's2', order: 2, type: 'dot', points: [[0.55, 0.78]] },
  ], 'ar');
  assert.equal(fine, null);
});
