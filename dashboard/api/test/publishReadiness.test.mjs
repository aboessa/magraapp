/// Tests for publish readiness.
///
/// The behaviour being pinned is that an editor learns *every* blocker at once,
/// each with an owner, instead of one generic failure at a time.

import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluatePublishReadiness } from '../src/lib/publishReadiness.ts';

function input(overrides = {}) {
  return {
    engineId: 'trace_color',
    engineHasRuntimeSchema: true,
    packErrors: [],
    packWarnings: [],
    pack: {
      localization: 'language_neutral',
      levels: [{ level: 1, mode: 'shape', prompt_key: 'game.s.prompt' }],
      accessibility: {
        simplified_motor: { tolerance_dp: 44, coverage_required: 0.6 },
        sequential_tap_alternative: true,
      },
      review: { linguistic_review: { status: 'not_required' } },
    },
    objectiveId: 'objective-world-shape-trace_form',
    objectiveCode: 'world.shape.trace_form',
    primarySkillId: 'shape_recognition',
    secondarySkillIds: ['fine_motor'],
    localizations: [
      { language: 'ar', status: 'ready', hasTitle: true, hasInstructions: true, missingPromptKeys: [], isMachineTranslated: false },
      { language: 'en', status: 'ready', hasTitle: true, hasInstructions: true, missingPromptKeys: [], isMachineTranslated: false },
      { language: 'fr', status: 'ready', hasTitle: true, hasInstructions: true, missingPromptKeys: [], isMachineTranslated: false },
    ],
    requiredPromptKeys: ['game.s.prompt'],
    assets: { required: [], missing: [], notReady: [] },
    audio: { required: [], missing: [], notReady: [] },
    ageMin: 3,
    ageMax: 5,
    supervisionLevel: 'none',
    safetyNotes: null,
    isTestFixture: false,
    ...overrides,
  };
}

const check = (result, id) => result.checks.find((entry) => entry.id === id);

test('a complete game is publishable', () => {
  const result = evaluatePublishReadiness(input());
  assert.equal(result.publishable, true);
  assert.deepEqual(result.blocking_reasons, []);
});

test('every blocker is reported at once, not one at a time', () => {
  // This is the whole point: previously an editor discovered one blocker per
  // publish attempt.
  const result = evaluatePublishReadiness(input({
    objectiveId: null,
    objectiveCode: null,
    packErrors: ['level 1: bad'],
    assets: { required: ['a1'], missing: ['a1'], notReady: [] },
    audio: { required: ['vo1'], missing: ['vo1'], notReady: [] },
  }));
  assert.equal(result.publishable, false);
  assert.ok(result.blocking_reasons.length >= 4, result.blocking_reasons.join(' | '));
  assert.equal(check(result, 'objective').status, 'blocked');
  assert.equal(check(result, 'pack_validation').status, 'blocked');
  assert.equal(check(result, 'assets').status, 'blocked');
  assert.equal(check(result, 'audio').status, 'blocked');
});

test('each blocker names who resolves it', () => {
  // A missing recording is not an engineering task and must not look like one.
  const result = evaluatePublishReadiness(input({
    audio: { required: ['vo1'], missing: ['vo1'], notReady: [] },
    engineHasRuntimeSchema: false,
  }));
  assert.equal(check(result, 'audio').owner, 'production');
  assert.equal(check(result, 'engine').owner, 'engineering');
});

test('a letter pack is blocked on a human review and says so', () => {
  const result = evaluatePublishReadiness(input({
    pack: {
      localization: 'language_specific',
      levels: [{ level: 1, mode: 'letter', prompt_key: 'game.l.prompt' }],
      accessibility: {
        simplified_motor: { tolerance_dp: 40, coverage_required: 0.6 },
        sequential_tap_alternative: true,
      },
      review: { linguistic_review: { status: 'pending' } },
    },
  }));
  const review = check(result, 'linguistic_review');
  assert.equal(review.status, 'blocked');
  assert.equal(review.owner, 'reviewer');
  assert.match(review.detail, /مراجعة عربية معتمدة/);
  assert.equal(result.publishable, false);
});

test('a pack with no letters does not need a linguistic review', () => {
  const result = evaluatePublishReadiness(input());
  assert.equal(check(result, 'linguistic_review').status, 'not_applicable');
});

test('an approved review passes and records the reviewer', () => {
  const result = evaluatePublishReadiness(input({
    pack: {
      localization: 'language_specific',
      levels: [{ level: 1, mode: 'letter', prompt_key: 'game.l.prompt' }],
      accessibility: {
        simplified_motor: { tolerance_dp: 40, coverage_required: 0.6 },
        sequential_tap_alternative: true,
      },
      review: { linguistic_review: { status: 'approved', reviewer: 'د. مراجع' } },
    },
  }));
  const review = check(result, 'linguistic_review');
  assert.equal(review.status, 'pass');
  assert.equal(review.detail, 'د. مراجع');
});

test('Arabic blocks publication and the other languages only warn', () => {
  // Holding a finished Arabic game back for a pending French translation would
  // stop content shipping for no child's benefit.
  const missingArabic = evaluatePublishReadiness(input({
    localizations: [
      { language: 'en', status: 'ready', hasTitle: true, hasInstructions: true, missingPromptKeys: [], isMachineTranslated: false },
    ],
  }));
  assert.equal(check(missingArabic, 'localization_ar').status, 'blocked');
  assert.equal(missingArabic.publishable, false);

  const missingFrench = evaluatePublishReadiness(input({
    localizations: [
      { language: 'ar', status: 'ready', hasTitle: true, hasInstructions: true, missingPromptKeys: [], isMachineTranslated: false },
    ],
  }));
  assert.equal(check(missingFrench, 'localization_fr').status, 'warn');
  assert.equal(missingFrench.publishable, true);
});

test('a language_specific pack does not warn about absent translations', () => {
  // It is authored per language as a separate game, so absence is correct.
  //
  // The `reviews` row is what makes this fixture genuinely publishable rather
  // than merely well translated: a letter pack renders Arabic glyphs to a child,
  // and that needs a documented font licence. See the font-licence tests below.
  const result = evaluatePublishReadiness(input({
    pack: {
      localization: 'language_specific',
      levels: [{ level: 1, mode: 'letter', prompt_key: 'game.l.prompt' }],
      accessibility: {
        simplified_motor: { tolerance_dp: 40, coverage_required: 0.6 },
        sequential_tap_alternative: true,
      },
      review: { linguistic_review: { status: 'approved' } },
    },
    reviews: [{ role: 'rights', status: 'approved', reviewer: 'مورد الخطّ' }],
    localizations: [
      { language: 'ar', status: 'ready', hasTitle: true, hasInstructions: true, missingPromptKeys: [], isMachineTranslated: false },
    ],
  }));
  assert.equal(check(result, 'localization_en').status, 'not_applicable');
  assert.equal(check(result, 'localization_fr').status, 'not_applicable');
  assert.equal(result.publishable, true);
});

test('a machine-translated language_specific pack is refused', () => {
  const result = evaluatePublishReadiness(input({
    pack: {
      localization: 'language_specific',
      levels: [{ level: 1, mode: 'letter', prompt_key: 'game.l.prompt' }],
      accessibility: {
        simplified_motor: { tolerance_dp: 40, coverage_required: 0.6 },
        sequential_tap_alternative: true,
      },
      review: { linguistic_review: { status: 'approved' } },
    },
    localizations: [
      { language: 'ar', status: 'ready', hasTitle: true, hasInstructions: true, missingPromptKeys: [], isMachineTranslated: true },
    ],
  }));
  assert.equal(check(result, 'localization_ar').status, 'blocked');
});

test('a partly translated language reports which prompts are missing', () => {
  const result = evaluatePublishReadiness(input({
    localizations: [
      { language: 'ar', status: 'draft', hasTitle: true, hasInstructions: false, missingPromptKeys: ['game.s.prompt'], isMachineTranslated: false },
      { language: 'en', status: 'ready', hasTitle: true, hasInstructions: true, missingPromptKeys: [], isMachineTranslated: false },
      { language: 'fr', status: 'ready', hasTitle: true, hasInstructions: true, missingPromptKeys: [], isMachineTranslated: false },
    ],
  }));
  const arabic = check(result, 'localization_ar');
  assert.equal(arabic.status, 'blocked');
  assert.deepEqual(arabic.items, ['game.s.prompt']);
});

test('art and audio are reported separately', () => {
  // Different people and different lead times, so one count for both would be
  // useless to an editor.
  const result = evaluatePublishReadiness(input({
    assets: { required: ['img1', 'vo1'], missing: ['img1'], notReady: [] },
    audio: { required: ['vo1'], missing: [], notReady: ['vo1'] },
  }));
  assert.deepEqual(check(result, 'assets').items, ['img1']);
  assert.deepEqual(check(result, 'audio').items, ['vo1']);
});

test('accessibility must be declared', () => {
  const result = evaluatePublishReadiness(input({
    pack: { localization: 'language_neutral', levels: [], accessibility: {} },
  }));
  assert.equal(check(result, 'accessibility').status, 'blocked');
});

test('supervision required demands safety notes', () => {
  const blocked = evaluatePublishReadiness(input({ supervisionLevel: 'required', safetyNotes: '  ' }));
  assert.equal(check(blocked, 'safety').status, 'blocked');

  const ok = evaluatePublishReadiness(input({ supervisionLevel: 'required', safetyNotes: 'بالغ حاضر' }));
  assert.equal(check(ok, 'safety').status, 'pass');
});

test('a test fixture can never be published', () => {
  const result = evaluatePublishReadiness(input({ isTestFixture: true }));
  assert.equal(check(result, 'content_class').status, 'blocked');
  assert.equal(result.publishable, false);
});

test('a missing skill warns rather than blocks', () => {
  // 60 seeded objectives have no skill; blocking on it would stop all of them.
  const result = evaluatePublishReadiness(input({ primarySkillId: null, secondarySkillIds: [] }));
  assert.equal(check(result, 'skills').status, 'warn');
  assert.equal(result.publishable, true);
});

test('an engine with no runtime contract blocks publication', () => {
  const result = evaluatePublishReadiness(input({
    engineId: 'sim_lab', engineHasRuntimeSchema: false,
  }));
  assert.equal(check(result, 'engine').status, 'blocked');
  assert.match(check(result, 'engine').detail, /sim_lab/);
});

test('blocking reasons are specific, never generic', () => {
  const result = evaluatePublishReadiness(input({
    audio: { required: ['vo1'], missing: ['vo1'], notReady: [] },
  }));
  for (const reason of result.blocking_reasons) {
    assert.ok(reason.length > 12, `reason too vague: ${reason}`);
    assert.ok(!/cannot publish/i.test(reason));
  }
});
