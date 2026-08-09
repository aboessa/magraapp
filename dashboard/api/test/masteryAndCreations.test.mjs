/// Tests for the mastery ladder and for private creation storage.
///
/// The mastery group pins the distinction the old three-state implementation
/// could not express: succeeding only after the engine widened its tolerance is
/// `assisted`, not `independent`.
///
/// The storage group pins the security boundary that keeps a child's drawing out
/// of the public catalogue buckets.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveMastery,
  isMasteryLevel,
  masteryCounters,
  MASTERY_WINDOW,
} from '../src/lib/mastery.ts';
import {
  creationClaimError,
  creationKeyBelongsTo,
  creationStorageKey,
  isSafeStorageId,
  isSupportedCreationType,
  MAX_CREATION_BYTES,
  sniffImageType,
} from '../src/lib/creationStorage.ts';
import { bucketForAsset, PUBLIC_BUCKET } from '../src/lib/assetBuckets.ts';

let clock = 1_700_000_000_000;
function attempt({ score = 1, maxScore = 1, helpUsed = false } = {}) {
  clock += 60_000;
  return { score, maxScore, helpUsed, createdAt: clock };
}

// --- mastery ---------------------------------------------------------------

test('no attempts is not_started', () => {
  const summary = deriveMastery([]);
  assert.equal(summary.level, 'not_started');
  assert.equal(summary.windowAccuracy, null);
});

test('an unscored attempt records that the child played without grading them', () => {
  // Colouring and free drawing report 0 out of 0. Treating that as 0% accuracy
  // would let a child's mastery fall because they coloured a picture.
  const summary = deriveMastery([attempt({ score: 0, maxScore: 0 })]);
  assert.equal(summary.level, 'introduced');
  assert.equal(summary.windowAccuracy, null);
});

test('three clean successes in a row is independent', () => {
  const summary = deriveMastery([
    attempt({ score: 4, maxScore: 4 }),
    attempt({ score: 4, maxScore: 4 }),
    attempt({ score: 4, maxScore: 4 }),
  ]);
  assert.equal(summary.level, 'independent');
});

test('accurate but assisted is assisted, never independent', () => {
  // The reason this matters for tracing: the help ladder widens tolerance from
  // 24dp to 36dp at the third stall. Recording that as independent mastery of
  // letter formation would be false.
  const summary = deriveMastery([
    attempt({ score: 4, maxScore: 4, helpUsed: true }),
    attempt({ score: 4, maxScore: 4, helpUsed: true }),
    attempt({ score: 4, maxScore: 4, helpUsed: true }),
  ]);
  assert.equal(summary.level, 'assisted');
  assert.ok(summary.helpUsedInWindow);
});

test('one assisted attempt in the streak prevents independent', () => {
  const summary = deriveMastery([
    attempt({ score: 4, maxScore: 4 }),
    attempt({ score: 4, maxScore: 4, helpUsed: true }),
    attempt({ score: 4, maxScore: 4 }),
  ]);
  assert.notEqual(summary.level, 'independent');
  assert.equal(summary.level, 'assisted');
});

test('middling accuracy is practicing', () => {
  const summary = deriveMastery([
    attempt({ score: 2, maxScore: 4 }),
    attempt({ score: 3, maxScore: 4 }),
    attempt({ score: 2, maxScore: 4 }),
  ]);
  assert.equal(summary.level, 'practicing');
});

test('regression after independence is needs_review', () => {
  const summary = deriveMastery([
    attempt({ score: 0, maxScore: 4 }),
    attempt({ score: 1, maxScore: 4 }),
  ], 'independent');
  assert.equal(summary.level, 'needs_review');
});

test('a child who was never independent is not flagged for review', () => {
  // needs_review is a regression signal. Applying it to a beginner would tell a
  // parent their child has lost a skill they never had.
  const summary = deriveMastery([
    attempt({ score: 0, maxScore: 4 }),
    attempt({ score: 0, maxScore: 4 }),
  ], 'introduced');
  assert.equal(summary.level, 'introduced');
});

test('only the most recent attempts count', () => {
  // A lifetime counter never forgets, so one good run long ago outweighed five
  // recent failures and needs_review was unreachable.
  const history = [
    attempt({ score: 4, maxScore: 4 }),
    attempt({ score: 4, maxScore: 4 }),
    attempt({ score: 4, maxScore: 4 }),
    attempt({ score: 0, maxScore: 4 }),
    attempt({ score: 0, maxScore: 4 }),
    attempt({ score: 0, maxScore: 4 }),
    attempt({ score: 0, maxScore: 4 }),
    attempt({ score: 0, maxScore: 4 }),
  ];
  const summary = deriveMastery(history, 'independent');
  assert.equal(summary.consideredAttempts, MASTERY_WINDOW);
  assert.equal(summary.level, 'needs_review');
});

test('recovery is possible: a fresh clean streak returns to independent', () => {
  const summary = deriveMastery([
    attempt({ score: 0, maxScore: 4 }),
    attempt({ score: 0, maxScore: 4 }),
    attempt({ score: 4, maxScore: 4 }),
    attempt({ score: 4, maxScore: 4 }),
    attempt({ score: 4, maxScore: 4 }),
  ], 'needs_review');
  assert.equal(summary.level, 'independent');
});

test('counters exclude unscored attempts from the correct count', () => {
  const counters = masteryCounters([
    attempt({ score: 4, maxScore: 4 }),
    attempt({ score: 0, maxScore: 0 }),
    attempt({ score: 1, maxScore: 4 }),
  ]);
  assert.equal(counters.attempts, 3);
  assert.equal(counters.correctAttempts, 1);
});

test('every documented level is recognised', () => {
  for (const level of ['not_started', 'introduced', 'practicing', 'assisted', 'independent', 'needs_review']) {
    assert.ok(isMasteryLevel(level), level);
  }
  assert.ok(!isMasteryLevel('mastered'));
});

// --- creation storage ------------------------------------------------------

test('keys are namespaced by family and child', () => {
  const key = creationStorageKey({
    familyId: 'parent-1', childId: 'child-1',
    creationId: 'creation-1', mimeType: 'image/png',
  });
  assert.equal(key, 'family/parent-1/child/child-1/creation-1.png');
});

test('a key cannot be built from an id that could climb out of the prefix', () => {
  for (const bad of ['../evil', 'a/b', '', 'x'.repeat(200), 'has space']) {
    assert.equal(
      creationStorageKey({
        familyId: bad, childId: 'child-1', creationId: 'c1', mimeType: 'image/png',
      }),
      null,
      `familyId ${JSON.stringify(bad)} must be rejected`,
    );
  }
  assert.ok(!isSafeStorageId('../x'));
  assert.ok(isSafeStorageId('child-1'));
});

test('ownership is decided from the key itself as well as from the row', () => {
  const key = 'family/parent-1/child/child-1/creation-1.png';
  assert.ok(creationKeyBelongsTo(key, 'parent-1'));
  assert.ok(creationKeyBelongsTo(key, 'parent-1', 'child-1'));
  // Another family cannot claim it.
  assert.ok(!creationKeyBelongsTo(key, 'parent-2'));
  // Nor another child inside the same family.
  assert.ok(!creationKeyBelongsTo(key, 'parent-1', 'child-2'));
});

test('a prefix collision cannot be used to reach another family', () => {
  // `parent-1` must not match `parent-10`'s objects.
  const key = 'family/parent-10/child/child-1/creation-1.png';
  assert.ok(!creationKeyBelongsTo(key, 'parent-1'));
});

test('only PNG and WebP are storable', () => {
  assert.ok(isSupportedCreationType('image/png'));
  assert.ok(isSupportedCreationType('image/webp'));
  // SVG is an image type and also a script container.
  assert.ok(!isSupportedCreationType('image/svg+xml'));
  assert.ok(!isSupportedCreationType('text/html'));
  assert.ok(!isSupportedCreationType('application/octet-stream'));
});

test('size and dimension limits are enforced before anything is written', () => {
  const base = { mimeType: 'image/png', byteSize: 1024, width: 512, height: 512 };
  assert.equal(creationClaimError(base), null);
  assert.match(
    creationClaimError({ ...base, byteSize: MAX_CREATION_BYTES + 1 }),
    /exceeds the \d+ byte limit/,
  );
  assert.match(creationClaimError({ ...base, width: 9000 }), /width exceeds/);
  assert.match(creationClaimError({ ...base, byteSize: 0 }), /positive integer/);
  assert.match(creationClaimError({ ...base, mimeType: 'image/gif' }), /Unsupported creation type/);
});

test('the body must actually be the image type it claims', () => {
  // The declared content type is caller-supplied. Without a magic-byte check a
  // private bucket becomes a file drop.
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);
  const html = new TextEncoder().encode('<html><script>alert(1)</script>');

  assert.equal(sniffImageType(png), 'image/png');
  assert.equal(sniffImageType(webp), 'image/webp');
  assert.equal(sniffImageType(html), null);
  assert.equal(sniffImageType(new Uint8Array([1, 2, 3])), null);
});

test('creations are outside the catalogue bucket mapping entirely', () => {
  // The release-blocking invariant. `bucketForAsset` is a pure function over the
  // two catalogue buckets, and there is no value of `visibility` or `kind` that
  // produces a creations bucket - so no mislabelled row, and no future refactor
  // of the catalogue pipeline, can relocate a child's drawing into the
  // CDN-fronted bucket.
  const outcomes = new Set();
  for (const visibility of ['public', 'private', null, undefined, 'creations']) {
    for (const kind of ['image', 'video', 'audio', 'archive', null, 'creation']) {
      outcomes.add(bucketForAsset({ visibility, kind }));
    }
  }
  assert.deepEqual([...outcomes].sort(), ['media', 'thumbs']);
  assert.ok(!outcomes.has('creations'));

  // And a creation key is not something the public bucket could ever serve,
  // because creations never become content_assets rows in the first place.
  assert.equal(PUBLIC_BUCKET, 'thumbs');
});
