import assert from 'node:assert/strict';
import test from 'node:test';
import {
  correctedVisibility,
  inferVisibilityFromPath,
  PRIVATE_MEDIA_SEGMENTS,
  PUBLIC_ARTWORK_SEGMENTS,
  PUBLIC_AUDIO_SEGMENTS,
} from '../src/lib/assetClassification.ts';

/// Regression coverage for the public/private classification rule.
///
/// The defect: this rule existed as three separate copies (routes/adminAssets.ts,
/// scripts/import-images.mjs, and the migration tooling). The first two had
/// already drifted — both treated only `landing|marketing|worlds|store` as
/// public, so every poster, banner and episode still was minted `private/…` and
/// could never resolve on the CDN. 194 real assets were affected in local D1.
///
/// These tests pin the rule so a future copy cannot silently diverge again.

test('every catalogue artwork segment classifies public', () => {
  for (const segment of PUBLIC_ARTWORK_SEGMENTS) {
    assert.equal(
      inferVisibilityFromPath(`assets/images/${segment}/example.webp`),
      'public',
      segment,
    );
  }
});

test('every entitlement-controlled segment classifies private', () => {
  for (const segment of PRIVATE_MEDIA_SEGMENTS) {
    assert.equal(
      inferVisibilityFromPath(`assets/${segment}/example.bin`),
      'private',
      segment,
    );
  }
});

test('the real catalogue paths that were mis-classified now resolve public', () => {
  // Exact paths taken from the 194 mis-keyed rows found in local D1.
  const paths = [
    'assets/images/series/posters/adventures-of-numbers-poster.webp',
    'assets/images/episodes/numbers-01-counting-stars.webp',
    'assets/images/characters/nouma-character-sheet.webp',
    'assets/images/planets/planet-abjad.webp',
    'assets/images/islamic/posters/preschool-adhkar-manners-prayer-poster.webp',
    'assets/images/books/covers/preschool-first-words-cover.webp',
    'assets/images/games/tiles/match-letters.webp',
    'assets/images/stories/pages/bird-home-01.webp',
    'assets/images/series/banners/try-it-at-home-banner.webp',
    'assets/images/app/icons/home.webp',
  ];
  for (const path of paths) {
    assert.equal(inferVisibilityFromPath(path), 'public', path);
  }
});

test('the historically public segments still classify public', () => {
  // These four were the only ones the original buggy rule accepted; they must
  // keep working so the fix is purely additive for artwork.
  for (const segment of ['landing', 'marketing', 'worlds', 'store']) {
    assert.equal(inferVisibilityFromPath(`assets/images/${segment}/x.png`), 'public', segment);
  }
});

test('a private segment wins even when an artwork segment appears in the path', () => {
  // `series` is a public segment, but a stream underneath it is still a stream.
  assert.equal(
    inferVisibilityFromPath('assets/images/series/streams/ep-01.mp4'),
    'private',
  );
  assert.equal(
    inferVisibilityFromPath('assets/video/series/mazen-wa-thaaloub/ep-01.mp4'),
    'private',
  );
  assert.equal(
    inferVisibilityFromPath('assets/images/games/packs/pack-01.zip'),
    'private',
  );
  assert.equal(
    inferVisibilityFromPath('assets/images/books/downloads/book-01.pdf'),
    'private',
  );
});

test('unknown locations fail closed to private', () => {
  assert.equal(inferVisibilityFromPath('assets/misc/unsorted.bin'), 'private');
  assert.equal(inferVisibilityFromPath('random.webp'), 'private');
  assert.equal(inferVisibilityFromPath(''), 'private');
  assert.equal(inferVisibilityFromPath(null), 'private');
  assert.equal(inferVisibilityFromPath(undefined), 'private');
});

test('classification is case insensitive and separator agnostic', () => {
  assert.equal(inferVisibilityFromPath('ASSETS/IMAGES/SERIES/Poster.WEBP'), 'public');
  assert.equal(inferVisibilityFromPath('assets\\images\\series\\poster.webp'), 'public');
  assert.equal(inferVisibilityFromPath('/assets/images/series/poster.webp'), 'public');
  assert.equal(inferVisibilityFromPath('///assets/images/series/poster.webp'), 'public');
});

test('video and archive kinds are private wherever they sit', () => {
  // Even a video filed under a public artwork segment stays private: the CDN
  // must never front a stream.
  assert.equal(correctedVisibility({
    kind: 'video',
    expected_path: 'assets/images/series/posters/looks-like-artwork.mp4',
  }), 'private');
  assert.equal(correctedVisibility({
    kind: 'archive',
    expected_path: 'assets/images/games/tiles/pack.zip',
  }), 'private');
});

test('corrected visibility uses expected_path as the authoritative signal', () => {
  assert.equal(correctedVisibility({
    kind: 'image',
    expected_path: 'assets/images/series/posters/p.webp',
    r2_key: 'private/catalog/assets/images/series/posters/p.webp',
  }), 'public', 'the wrong existing key must not override the editorial path');
});

test('corrected visibility falls back to the key with its scope prefix stripped', () => {
  // Assets uploaded straight through the admin API have no expected_path. The
  // prefix is stripped first so a wrong prefix cannot confirm itself.
  assert.equal(correctedVisibility({
    kind: 'image',
    expected_path: null,
    r2_key: 'private/catalog/images/series/posters/p.webp',
  }), 'public');
  assert.equal(correctedVisibility({
    kind: 'video',
    expected_path: null,
    r2_key: 'private/catalog/video/series/mazen/ep-01.mp4',
  }), 'private');
});

test('corrected visibility fails closed with no path evidence at all', () => {
  assert.equal(correctedVisibility({ kind: 'image' }), 'private');
  assert.equal(correctedVisibility({ kind: 'image', expected_path: '', r2_key: '' }), 'private');
  assert.equal(correctedVisibility({}), 'private');
});

test('corrected visibility is idempotent for already-correct rows', () => {
  // Re-running the migration must converge, not oscillate.
  const asset = {
    kind: 'image',
    expected_path: 'assets/images/series/posters/p.webp',
    r2_key: 'public/catalog/assets/images/series/posters/p.webp',
  };
  const once = correctedVisibility(asset);
  assert.equal(once, 'public');
  assert.equal(correctedVisibility({ ...asset, visibility: once }), 'public');
});

test('the Mazen stream shape classifies private', () => {
  // The 14 real episode videos imported in this task.
  for (let number = 1; number <= 14; number += 1) {
    const padded = String(number).padStart(2, '0');
    assert.equal(correctedVisibility({
      kind: 'video',
      expected_path: `assets/video/series/mazen-wa-thaaloub/ep-${padded}-lesson.mp4`,
    }), 'private', `episode ${padded}`);
  }
});

/// ---------------------------------------------------------------------------
/// Audio protection policy
///
/// `audio` used to sit in PUBLIC_ARTWORK_SEGMENTS, which put every generated
/// narration on the anonymously-readable CDN. That contradicts three separate
/// statements in `تشفير المحتوي.md`: paid audio is "Streaming خاص" (:70), `audio/`
/// belongs under the `private/` prefix (:175), and a public bucket for paid
/// content is prohibited (:157).
///
/// The generic segment loops above would keep passing if `audio` were moved back,
/// so these tests assert the policy directly rather than relying on list
/// membership. The header comment on this file records that the rule has already
/// drifted once.

test('narration classifies private, not public CDN artwork', () => {
  // The layout the plan specifies for a story, تشفير المحتوي.md:196.
  assert.equal(
    inferVisibilityFromPath('private/stories/story_001/v4/audio/ar/page_001.m4a'),
    'private',
  );
  // A generated narration keyed by the asset pipeline, which has no
  // `expected_path` and lands under `{kind}/{date}/`.
  assert.equal(
    inferVisibilityFromPath('audio/2026-08-08/page-01-narration-ar.mp3'),
    'private',
  );
  // `stories` is a public artwork segment, but audio underneath it is narration.
  assert.equal(
    inferVisibilityFromPath('assets/stories/qisas-01/audio/page-01.mp3'),
    'private',
    'a public artwork segment must not promote narration to public',
  );
  assert.equal(
    inferVisibilityFromPath('assets/books/qisas-01/narration/ar/page-01.m4a'),
    'private',
  );
});

test('audio is absent from the public artwork segments', () => {
  // Pins the removal itself: re-adding `audio` here would silently re-expose
  // every narration file, and the loop at the top of this file would still pass.
  assert.ok(
    !PUBLIC_ARTWORK_SEGMENTS.includes('audio'),
    'audio must not be a public artwork segment',
  );
  assert.ok(
    PRIVATE_MEDIA_SEGMENTS.includes('audio'),
    'audio must be an entitlement-controlled segment',
  );
  assert.ok(
    PRIVATE_MEDIA_SEGMENTS.includes('narration'),
    'narration must be an entitlement-controlled segment',
  );
});

test('interface sound effects stay public', () => {
  // The deliberate exception: a click or a win chime has no resale value, and
  // routing it through a 180-second token would add latency to protect nothing.
  // تشفير المحتوي.md:65-66 permits free and public audio.
  for (const segment of PUBLIC_AUDIO_SEGMENTS) {
    assert.equal(
      inferVisibilityFromPath(`assets/audio/${segment}/click.mp3`),
      'public',
      segment,
    );
  }
});

test('the public-audio allowlist outranks the private audio segment', () => {
  // Ordering matters: `assets/audio/sfx/click.mp3` contains both an `/audio/`
  // segment (private) and an `/sfx/` segment (public). The allowlist is tested
  // first, so the effect stays on the CDN.
  assert.equal(inferVisibilityFromPath('assets/audio/sfx/win.mp3'), 'public');
  assert.equal(inferVisibilityFromPath('assets/audio/ui-audio/tap.mp3'), 'public');
  assert.equal(
    inferVisibilityFromPath('assets/audio/audio-samples/qisas-01-preview.mp3'),
    'public',
    'a free sample is explicitly allowed to be public',
  );
});

test('an audio kind filed outside the sfx allowlist is private', () => {
  // `audio` is deliberately NOT in ALWAYS_PRIVATE_KINDS, because that would also
  // force interface sound private. So the kind alone must not decide it — the
  // path does.
  assert.equal(correctedVisibility({
    kind: 'audio',
    expected_path: 'assets/stories/qisas-01/audio/page-01.mp3',
  }), 'private');
  assert.equal(correctedVisibility({
    kind: 'audio',
    expected_path: 'assets/audio/sfx/click.mp3',
  }), 'public', 'sound effects remain servable from the CDN');
});
