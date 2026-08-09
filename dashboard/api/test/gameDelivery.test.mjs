/// Tests for lib/gameDelivery.ts — what the app is allowed to receive, and how
/// a language is chosen.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isGameLanguage,
  localizePack,
  resolveLanguage,
  tracksForAgeRange,
} from '../src/lib/gameDelivery.ts';

function pack(overrides = {}) {
  return {
    pack_version: 1,
    engine_id: 'trace_color',
    progression: { levels_to_finish: 1, advance_on: 'level_complete' },
    accessibility: { simplified_motor: { tolerance_dp: 40, coverage_required: 0.6 }, sequential_tap_alternative: true },
    review: { linguistic_review: { status: 'pending', reviewer: 'Someone', notes: 'internal' } },
    levels: [
      {
        level: 1,
        mode: 'path',
        scoring: 'geometric',
        prompt_key: 'game.pinch_place.peg_to_basket.prompt',
        completion: { rule: 'all_strokes_complete' },
        stroke_paths: [{ id: 's1', order: 1, type: 'stroke', points: [[0.2, 0.5], [0.7, 0.5]] }],
        tolerance_dp: 48,
        coverage_required: 0.5,
      },
    ],
    assets: { images: [], audio: [] },
    voice_manifest: { 'vo.intro': 'asset-vo-intro' },
    ...overrides,
  };
}

function localization(overrides = {}) {
  return {
    language: 'ar',
    title: 'من المشبك إلى السلّة',
    instructions: 'مرِّرْ إصبعك',
    prompts: { 'game.pinch_place.peg_to_basket.prompt': 'مرِّرْ إصبعك من المشبك إلى السلّة.' },
    voice_manifest: {},
    status: 'draft',
    ...overrides,
  };
}

// --- language resolution ---------------------------------------------------

test('the requested language wins when it exists', () => {
  const result = resolveLanguage('fr', ['ar', 'en', 'fr']);
  assert.equal(result.language, 'fr');
  assert.equal(result.fell_back, false);
});

test('fallback is Arabic-first, then English', () => {
  // Majarra is an Arabic product: Arabic is the language most likely to be
  // authored and reviewed, so it is the first fallback rather than a peer.
  const noFrench = resolveLanguage('fr', ['ar', 'en']);
  assert.equal(noFrench.language, 'ar');
  assert.equal(noFrench.fell_back, true);
  assert.deepEqual(noFrench.chain, ['fr', 'ar', 'en']);

  const englishOnly = resolveLanguage('fr', ['en']);
  assert.equal(englishOnly.language, 'en');
});

test('an unlocalised game resolves to nothing rather than a guess', () => {
  // Returning a language we do not have would ship raw i18n keys to a child.
  assert.equal(resolveLanguage('ar', []), null);
  assert.equal(resolveLanguage('ar', ['de']), null);
});

test('the chain never repeats the requested language', () => {
  assert.deepEqual(resolveLanguage('ar', ['ar']).chain, ['ar', 'en']);
});

test('only the three supported languages are accepted', () => {
  assert.ok(isGameLanguage('ar') && isGameLanguage('en') && isGameLanguage('fr'));
  assert.ok(!isGameLanguage('de'));
  assert.ok(!isGameLanguage(undefined));
});

// --- pack projection -------------------------------------------------------

test('editorial review state never reaches the client', () => {
  // `review` carries reviewer names and internal notes. It has no use on a
  // child's device and should not be mirrored to thousands of them.
  const result = localizePack(pack(), localization());
  assert.equal(result.pack.review, undefined);
  assert.ok('linguistic_review' in pack().review, 'fixture really did contain review state');
});

test('the resolved prompt is attached and geometry is returned untouched', () => {
  const original = pack();
  const result = localizePack(original, localization());
  assert.equal(result.pack.levels[0].prompt, 'مرِّرْ إصبعك من المشبك إلى السلّة.');
  // Geometry is not language: it must survive localization byte for byte.
  assert.deepEqual(result.pack.levels[0].stroke_paths, original.levels[0].stroke_paths);
  assert.equal(result.pack.levels[0].tolerance_dp, 48);
  assert.deepEqual(result.missing_prompt_keys, []);
});

test('the same geometry serves every language', () => {
  const geometryFor = (lang) => localizePack(
    pack(),
    localization({ language: lang, prompts: { 'game.pinch_place.peg_to_basket.prompt': `prompt-${lang}` } }),
  ).pack.levels[0].stroke_paths;

  assert.deepEqual(geometryFor('ar'), geometryFor('en'));
  assert.deepEqual(geometryFor('en'), geometryFor('fr'));
});

test('a missing prompt is reported and the key is still sent', () => {
  // A client rendering a visible key is debuggable; a silently blank prompt
  // looks like a rendering bug.
  const result = localizePack(pack(), localization({ prompts: {} }));
  assert.deepEqual(result.missing_prompt_keys, ['game.pinch_place.peg_to_basket.prompt']);
  assert.equal(result.pack.levels[0].prompt, undefined);
  assert.equal(result.pack.levels[0].prompt_key, 'game.pinch_place.peg_to_basket.prompt');
});

test('per-language voice assets override the pack default', () => {
  const result = localizePack(pack(), localization({
    voice_manifest: { 'vo.intro': 'asset-vo-intro-fr' },
  }));
  assert.equal(result.pack.voice_manifest['vo.intro'], 'asset-vo-intro-fr');
});

test('an absent localization still yields a usable pack', () => {
  const result = localizePack(pack(), null);
  assert.equal(result.pack.levels[0].prompt, undefined);
  assert.deepEqual(result.missing_prompt_keys, ['game.pinch_place.peg_to_basket.prompt']);
  assert.equal(result.pack.review, undefined);
});

test('a non-object pack degrades to empty rather than throwing', () => {
  assert.deepEqual(localizePack(null, null).pack, {});
  assert.deepEqual(localizePack('nonsense', null).pack, {});
});

// --- tracks ---------------------------------------------------------------

test('age ranges map onto the platform tracks', () => {
  assert.deepEqual(tracksForAgeRange(3, 5), ['preschool']);
  assert.deepEqual(tracksForAgeRange(6, 8), ['kids']);
  assert.deepEqual(tracksForAgeRange(9, 12), ['junior']);
  // A game spanning a boundary reports every track it touches, because
  // games.age_min/age_max is the only authority and there is no game_tracks.
  assert.deepEqual(tracksForAgeRange(5, 7), ['preschool', 'kids']);
  assert.deepEqual(tracksForAgeRange(3, 12), ['preschool', 'kids', 'junior']);
});
