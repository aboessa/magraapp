/// Tests for game localization writes.
///
/// The behaviour being pinned is that a translation row can be authored at all —
/// nothing could write one before — and that authoring it cannot quietly break
/// the two rules the readiness checks depend on: a `language_specific` pack is
/// never machine translated, and prompt text is keyed by the pack's own keys.

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateLocalization, LOCALIZATION_STATUSES } from '../src/lib/gameLocalization.ts';

const LANGUAGES = ['ar', 'en', 'fr'];

function context(overrides = {}) {
  return {
    language: 'ar',
    languages: LANGUAGES,
    packLocalization: 'translatable',
    requiredPromptKeys: ['game.pack.circle.prompt', 'game.pack.square.prompt'],
    ...overrides,
  };
}

test('a complete Arabic row is accepted and reports no gaps', () => {
  const result = validateLocalization({
    title: 'أشكال أولى',
    instructions: 'ضع إصبعك على النقطة واتبع الطريق.',
    prompts: {
      'game.pack.circle.prompt': 'اتبع الدائرة.',
      'game.pack.square.prompt': 'اتبع المربع.',
    },
    status: 'ready',
  }, context());

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing_prompt_keys, []);
  assert.deepEqual(result.unused_prompt_keys, []);
  assert.equal(result.value.status, 'ready');
  assert.equal(result.value.is_machine_translated, false);
});

test('an untranslated prompt key is reported rather than rejected', () => {
  // A translation in progress is a legitimate draft. Publish readiness is where
  // the gap becomes a blocker, and it reads the same list.
  const result = validateLocalization({
    title: 'Shapes',
    prompts: { 'game.pack.circle.prompt': 'Trace the circle.' },
  }, context({ language: 'en' }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing_prompt_keys, ['game.pack.square.prompt']);
});

test('an empty prompt string is a deletion, not a translation', () => {
  // Storing '' would make the key look translated to everything that checks for
  // presence, including the readiness check.
  const result = validateLocalization({
    prompts: { 'game.pack.circle.prompt': '   ' },
  }, context());

  assert.equal(result.ok, true);
  assert.equal(result.value.prompts['game.pack.circle.prompt'], undefined);
  assert.equal(result.missing_prompt_keys.length, 2);
});

test('a key that no level references is kept but reported', () => {
  const result = validateLocalization({
    prompts: {
      'game.pack.circle.prompt': 'اتبع الدائرة.',
      'game.pack.renamed.prompt': 'نصّ قديم',
    },
  }, context());

  assert.equal(result.ok, true);
  assert.equal(result.value.prompts['game.pack.renamed.prompt'], 'نصّ قديم');
  assert.deepEqual(result.unused_prompt_keys, ['game.pack.renamed.prompt']);
});

test('human-readable text as a prompt key is refused', () => {
  const result = validateLocalization({ prompts: { 'Trace the circle': 'x' } }, context());
  assert.equal(result.ok, false);
  assert.match(result.error, /i18n key/);
});

test('a language_specific pack cannot be machine translated', () => {
  // Arabic letter shapes are authored per language. A machine-translated letter
  // pack teaches the wrong strokes while looking complete.
  const result = validateLocalization({
    title: 'Letters',
    is_machine_translated: true,
  }, context({ language: 'en', packLocalization: 'language_specific' }));

  assert.equal(result.ok, false);
  assert.match(result.error, /language_specific/);
});

test('a language_specific pack warns when a source language is recorded', () => {
  const result = validateLocalization({
    title: 'Letters',
    translated_from: 'ar',
  }, context({ language: 'en', packLocalization: 'language_specific' }));

  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /language_specific/);
});

test('machine translation outside draft is flagged for human review', () => {
  const result = validateLocalization({
    is_machine_translated: true,
    status: 'ready',
  }, context({ language: 'fr' }));

  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
});

test('a row cannot be a translation of itself', () => {
  const result = validateLocalization({ translated_from: 'ar' }, context({ language: 'ar' }));
  assert.equal(result.ok, false);
  assert.match(result.error, /differ/);
});

test('unsupported languages and statuses are refused', () => {
  assert.equal(validateLocalization({}, context({ language: 'de' })).ok, false);
  assert.equal(validateLocalization({ status: 'live' }, context()).ok, false);
  assert.equal(validateLocalization({ translated_from: 'de' }, context()).ok, false);
  for (const status of LOCALIZATION_STATUSES) {
    assert.equal(validateLocalization({ status }, context()).ok, true, status);
  }
});

test('voice overrides must be voice keys pointing at asset ids', () => {
  const good = validateLocalization({
    voice_manifest: { 'vo.intro': 'asset-vo-intro-fr' },
  }, context({ language: 'fr' }));
  assert.equal(good.ok, true);
  assert.equal(good.value.voice_manifest['vo.intro'], 'asset-vo-intro-fr');

  assert.equal(validateLocalization({ voice_manifest: { intro: 'asset-x' } }, context()).ok, false);
  assert.equal(validateLocalization({ voice_manifest: { 'vo.intro': 'no spaces allowed' } }, context()).ok, false);

  // An emptied override falls back to the pack default rather than storing a
  // blank asset id that would resolve to silence.
  const cleared = validateLocalization({ voice_manifest: { 'vo.intro': '' } }, context());
  assert.equal(cleared.ok, true);
  assert.deepEqual(cleared.value.voice_manifest, {});
});

test('a partial write does not blank the fields it omits', () => {
  // Sending only `status` from a status dropdown must not delete the prompts an
  // editor already wrote.
  const previous = {
    title: 'أشكال أولى',
    instructions: 'تعليمات',
    prompts: { 'game.pack.circle.prompt': 'اتبع الدائرة.' },
    voice_manifest: { 'vo.intro': 'asset-vo-intro' },
    status: 'draft',
    translated_from: null,
    is_machine_translated: false,
  };
  const result = validateLocalization({ status: 'review_lang' }, context(), previous);

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'review_lang');
  assert.equal(result.value.title, 'أشكال أولى');
  assert.deepEqual(result.value.prompts, previous.prompts);
  assert.deepEqual(result.value.voice_manifest, previous.voice_manifest);
});

test('an explicit null clears a field', () => {
  const previous = {
    title: 'قديم', instructions: 'قديم', prompts: {}, voice_manifest: {},
    status: 'draft', translated_from: 'ar', is_machine_translated: false,
  };
  const result = validateLocalization({ title: null, translated_from: null }, context({ language: 'en' }), previous);

  assert.equal(result.ok, true);
  assert.equal(result.value.title, null);
  assert.equal(result.value.translated_from, null);
  assert.equal(result.value.instructions, 'قديم');
});

test('a non-object body is refused', () => {
  assert.equal(validateLocalization(null, context()).ok, false);
  assert.equal(validateLocalization([], context()).ok, false);
  assert.equal(validateLocalization('x', context()).ok, false);
});
