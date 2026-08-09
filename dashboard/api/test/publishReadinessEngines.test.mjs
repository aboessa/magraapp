/// Publish readiness across all twelve engines.
///
/// `publishReadiness.test.mjs` pins the original trace_color behaviour. This file
/// pins the rules that only exist because there are now eleven other engines, each
/// with its own review, its own touch-target floor, and its own answer to whether
/// it may carry a learning objective at all.
///
/// The property under test throughout: a check must answer *what*, *who* and
/// *whether it blocks* — and must never invert a contract. Demanding a learning
/// objective from `rhythm_tap`, or a drawing tolerance from `logic_pattern`, is not
/// a stricter check. It is a wrong one, and it teaches editors that this endpoint
/// is noise.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DRAG_ENGINES,
  PRESCHOOL_TOUCH_TARGET_DP,
  REVIEW_KINDS,
  evaluatePublishReadiness,
  rendersArabicGlyphsToChild,
  requiredReviewKinds,
} from '../src/lib/publishReadiness.ts';
import { ENGINE_CONTRACTS, ENGINES_WITHOUT_MASTERY } from '../src/lib/engineContracts.ts';
import { enginesWithRuntimeSchema } from '../src/lib/gamePackGate.ts';

const ALL_ENGINES = Object.keys(ENGINE_CONTRACTS);

/// A readiness input that passes everything, for whichever engine is named.
///
/// Built from the engine's own contract rather than from a fixed literal, so a
/// "complete" fixture stays complete when a contract changes instead of quietly
/// asserting against stale numbers.
function input(engineId, overrides = {}) {
  const contract = ENGINE_CONTRACTS[engineId];
  const reviews = [{ role: 'rights', status: 'approved', reviewer: 'مورد' }];
  const packReview = {};
  for (const kind of REVIEW_KINDS) packReview[kind] = { status: 'approved', reviewer: 'مراجع' };

  return {
    engineId,
    engineHasRuntimeSchema: true,
    packErrors: [],
    packWarnings: [],
    pack: {
      pack_version: 1,
      localization: contract.languageClass ?? 'language_neutral',
      levels: [{ level: 1, mode: 'shape', prompt_key: 'game.x.prompt', scoring: 'discrete' }],
      accessibility: {
        min_touch_target_dp: Math.max(contract.minTouchTargetDp, PRESCHOOL_TOUCH_TARGET_DP),
        sequential_tap_alternative: true,
        simplified_motor: { tolerance_dp: 44, coverage_required: 0.6 },
      },
      review: packReview,
    },
    objectiveId: contract.writesMastery ? 'objective-x' : null,
    objectiveCode: contract.writesMastery ? 'x.y.z' : null,
    primarySkillId: contract.writesMastery ? 'skill-1' : null,
    secondarySkillIds: [],
    localizations: ['ar', 'en', 'fr'].map((language) => ({
      language, status: 'ready', hasTitle: true, hasInstructions: true,
      missingPromptKeys: [], isMachineTranslated: false,
    })),
    requiredPromptKeys: ['game.x.prompt'],
    assets: { required: [], missing: [], notReady: [] },
    audio: { required: [], missing: [], notReady: [] },
    ageMin: 3,
    ageMax: 5,
    supervisionLevel: 'none',
    safetyNotes: null,
    isTestFixture: false,
    supportedPackVersion: 1,
    reviews,
    productionAssets: [{ role: 'cover', assetId: 'asset-cover', status: 'ready' }],
    ...overrides,
  };
}

const check = (result, id) => result.checks.find((entry) => entry.id === id);

test('every engine has a fixture that is publishable, so the checks can fail meaningfully', () => {
  // Without this, a check that blocks unconditionally would look like thoroughness.
  for (const engineId of ALL_ENGINES) {
    const result = evaluatePublishReadiness(input(engineId));
    assert.equal(
      result.publishable,
      true,
      `${engineId} is not publishable when complete: ${result.blocking_reasons.join(' | ')}`,
    );
  }
});

test('every check names an owner when it is not satisfied', () => {
  // A blocker with no owner is a note, not a task. The three exceptions are
  // structural: `not_applicable` has nobody to assign, and a `pass` needs nobody.
  const result = evaluatePublishReadiness(input('word_build', {
    packErrors: ['level 1: bad'],
    assets: { required: ['img'], missing: ['img'], notReady: [] },
    audio: { required: ['vo'], missing: ['vo'], notReady: [] },
    reviews: [],
    engineImplemented: false,
    objectiveId: null,
    objectiveCode: null,
    pack: { pack_version: 9, localization: 'language_specific', levels: [{ level: 1, language: 'ar' }], accessibility: {}, review: {} },
    supervisionLevel: 'required',
    safetyNotes: '  ',
  }));

  for (const entry of result.checks) {
    if (entry.status === 'blocked' || entry.status === 'warn') {
      assert.ok(entry.owner, `${entry.id} is ${entry.status} with no owner`);
      assert.ok(entry.detail && entry.detail.length > 8, `${entry.id} has no usable detail`);
    }
  }
});

test('all blockers come back at once and none of them is generic', () => {
  const result = evaluatePublishReadiness(input('sim_lab', {
    packErrors: ['level 2: variable "x" has no relationship'],
    assets: { required: ['img'], missing: ['img'], notReady: [] },
    audio: { required: ['vo'], missing: [], notReady: ['vo'] },
    localizations: [],
    pack: {
      pack_version: 1, localization: 'language_neutral',
      levels: [{ level: 1, scoring: 'discrete' }],
      accessibility: { min_touch_target_dp: 48 },
      review: {},
    },
  }));

  assert.equal(result.publishable, false);
  assert.ok(result.blocking_reasons.length >= 5, result.blocking_reasons.join(' | '));
  for (const reason of result.blocking_reasons) {
    assert.ok(!/cannot publish/i.test(reason), `generic reason: ${reason}`);
    assert.ok(reason.length > 12, `reason too vague: ${reason}`);
    assert.match(reason, /:/, `reason does not name its check: ${reason}`);
  }
});

/* ------------------------------------------------------- mastery and objectives */

test('the two entertainment engines are blocked *for having* an objective', () => {
  // The old rule demanded an objective from every engine, which is the exact
  // inversion of the contract for these two: they write attempts and never
  // mastery, and the mechanism is that no objective is attached.
  assert.deepEqual(ENGINES_WITHOUT_MASTERY.sort(), ['memory_flip', 'rhythm_tap']);

  for (const engineId of ENGINES_WITHOUT_MASTERY) {
    const withObjective = evaluatePublishReadiness(input(engineId, {
      objectiveId: 'objective-x', objectiveCode: 'x.y.z',
    }));
    const objective = check(withObjective, 'objective');
    assert.equal(objective.status, 'blocked', engineId);
    assert.equal(objective.owner, 'editor');
    assert.match(objective.detail, /x\.y\.z/);
    assert.equal(withObjective.publishable, false);

    const without = evaluatePublishReadiness(input(engineId));
    assert.equal(check(without, 'objective').status, 'not_applicable');
    assert.equal(check(without, 'skills').status, 'not_applicable');
  }
});

test('a scoring engine with no objective is still blocked', () => {
  const result = evaluatePublishReadiness(input('count_quantity', {
    objectiveId: null, objectiveCode: null, primarySkillId: null,
  }));
  assert.equal(check(result, 'objective').status, 'blocked');
});

test('a wholly unscored pack needs no objective', () => {
  const result = evaluatePublishReadiness(input('trace_color', {
    objectiveId: null, objectiveCode: null, primarySkillId: null,
    pack: {
      pack_version: 1, localization: 'language_neutral',
      levels: [{ level: 1, mode: 'coloring', scoring: 'none' }],
      accessibility: { min_touch_target_dp: 64, sequential_tap_alternative: true, simplified_motor: { tolerance_dp: 40 } },
      review: {},
    },
  }));
  assert.equal(check(result, 'objective').status, 'not_applicable');
  assert.equal(result.publishable, true);
});

/* ------------------------------------------------------------------- reviews */

test('each engine that names a required review is blocked until it is approved', () => {
  const expected = {
    word_build: 'linguistic_review',
    sim_lab: 'scientific_review',
    timeline_map: 'historical_review',
    rhythm_tap: 'music_rights',
  };

  for (const [engineId, kind] of Object.entries(expected)) {
    assert.equal(ENGINE_CONTRACTS[engineId].requiredReview, kind);
    assert.deepEqual(requiredReviewKinds(engineId, { levels: [] }), [kind]);

    const pending = evaluatePublishReadiness(input(engineId, {
      pack: {
        ...input(engineId).pack,
        review: { [kind]: { status: 'pending' } },
      },
    }));
    const entry = check(pending, kind);
    assert.equal(entry.status, 'blocked', `${engineId}/${kind}`);
    assert.match(entry.detail, /pending/);
    assert.equal(pending.publishable, false);
  }
});

test('music rights are owned by the provider, not by a reviewer', () => {
  // Nobody on the team can approve a licence. Filing it as reviewer work is how
  // an unlicensed nasheed ships while everyone assumes a colleague is on it.
  const result = evaluatePublishReadiness(input('rhythm_tap', {
    pack: { ...input('rhythm_tap').pack, review: { music_rights: { status: 'pending' } } },
  }));
  assert.equal(check(result, 'music_rights').owner, 'provider');
  // And the review that does not apply to this engine carries no owner at all.
  assert.equal(check(result, 'scientific_review').status, 'not_applicable');
  assert.equal(check(result, 'scientific_review').owner, undefined);
});

test('a pack that names a music track needs rights even on an engine that does not', () => {
  const result = evaluatePublishReadiness(input('sequence_order', {
    pack: {
      ...input('sequence_order').pack,
      levels: [{ level: 1, scoring: 'sequence', track: 'asset-track-1' }],
      review: {},
    },
  }));
  assert.equal(check(result, 'music_rights').status, 'blocked');
});

test('all four review checks are always reported, mostly as not applicable', () => {
  // A response shape that changes with the engine is a shape a CMS will one day
  // fail to render.
  const result = evaluatePublishReadiness(input('match_pairs'));
  for (const kind of REVIEW_KINDS) {
    const entry = check(result, kind);
    assert.ok(entry, `${kind} missing from the report`);
    assert.equal(entry.status, 'not_applicable');
    assert.ok(entry.detail, `${kind} says not applicable without saying why`);
  }
});

/* ------------------------------------------------- the Arabic font licence */

test('a pack that shows Arabic glyphs to a child is blocked on a font licence', () => {
  assert.equal(rendersArabicGlyphsToChild('word_build', { levels: [{ language: 'ar' }] }), true);
  assert.equal(rendersArabicGlyphsToChild('trace_color', { levels: [{ mode: 'letter' }] }), true);
  assert.equal(rendersArabicGlyphsToChild('trace_color', { levels: [{ mode: 'shape' }] }), false);
  assert.equal(rendersArabicGlyphsToChild('match_pairs', { levels: [{ level: 1 }] }), false);

  const result = evaluatePublishReadiness(input('word_build', {
    pack: {
      ...input('word_build').pack,
      levels: [{ level: 1, language: 'ar', word: 'قمر', scoring: 'discrete' }],
    },
    reviews: [],
  }));
  const licence = check(result, 'arabic_font_license');
  assert.equal(licence.status, 'blocked');
  assert.equal(licence.owner, 'provider');
  assert.match(licence.detail, /ترخيص خطّ/);
  assert.equal(result.publishable, false);
});

test('the font licence is never bypassed by a missing review record', () => {
  // The whole point of the check is that it cannot be forgotten, so "no evidence"
  // must fail rather than pass.
  for (const reviews of [[], [{ role: 'rights', status: 'pending' }], [{ role: 'qa', status: 'approved' }]]) {
    const result = evaluatePublishReadiness(input('trace_color', {
      pack: {
        ...input('trace_color').pack,
        levels: [{ level: 1, mode: 'letter', scoring: 'geometric_ordered' }],
      },
      reviews,
    }));
    assert.equal(check(result, 'arabic_font_license').status, 'blocked');
  }
});

test('an approved rights record clears the font licence and records who granted it', () => {
  const result = evaluatePublishReadiness(input('word_build', {
    pack: {
      ...input('word_build').pack,
      levels: [{ level: 1, language: 'ar', word: 'قمر', scoring: 'discrete' }],
    },
    reviews: [{ role: 'rights', status: 'approved', reviewer: 'مسبك الخطوط' }],
  }));
  const licence = check(result, 'arabic_font_license');
  assert.equal(licence.status, 'pass');
  assert.match(licence.detail, /مسبك الخطوط/);
});

test('an engine that shows no Arabic glyphs is not asked for a font licence', () => {
  for (const engineId of ['match_pairs', 'sort_bins', 'memory_flip', 'logic_pattern', 'block_code', 'sim_lab', 'rhythm_tap', 'timeline_map', 'count_quantity', 'sequence_order']) {
    const result = evaluatePublishReadiness(input(engineId));
    assert.equal(check(result, 'arabic_font_license').status, 'not_applicable', engineId);
  }
});

/* ------------------------------------------------------------ accessibility */

test('the drawing tolerance is demanded only from the engine that draws', () => {
  // Demanding `simplified_motor.tolerance_dp` from logic_pattern would block every
  // pack in an engine with no geometry to be tolerant about.
  const noTolerance = {
    min_touch_target_dp: 64,
    sequential_tap_alternative: true,
  };
  const traceColor = evaluatePublishReadiness(input('trace_color', {
    pack: { ...input('trace_color').pack, accessibility: noTolerance },
  }));
  assert.equal(check(traceColor, 'accessibility').status, 'blocked');
  assert.match(check(traceColor, 'accessibility').detail, /simplified_motor/);

  const logicPattern = evaluatePublishReadiness(input('logic_pattern', {
    pack: { ...input('logic_pattern').pack, accessibility: { min_touch_target_dp: 64 } },
  }));
  assert.equal(check(logicPattern, 'accessibility').status, 'pass');
});

test('a tap-only alternative is demanded only from the engines that drag', () => {
  assert.ok(DRAG_ENGINES.includes('sort_bins'));
  assert.ok(!DRAG_ENGINES.includes('memory_flip'));

  const dragEngine = evaluatePublishReadiness(input('sort_bins', {
    pack: { ...input('sort_bins').pack, accessibility: { min_touch_target_dp: 64 } },
  }));
  assert.equal(check(dragEngine, 'accessibility').status, 'blocked');
  assert.match(check(dragEngine, 'accessibility').detail, /sequential_tap_alternative/);

  const tapEngine = evaluatePublishReadiness(input('memory_flip', {
    pack: { ...input('memory_flip').pack, accessibility: { min_touch_target_dp: 64 } },
  }));
  assert.equal(check(tapEngine, 'accessibility').status, 'pass');
});

/* ------------------------------------------------------------ touch targets */

test('a declared touch target below the engine contract blocks publication', () => {
  for (const engineId of ALL_ENGINES) {
    const floor = ENGINE_CONTRACTS[engineId].minTouchTargetDp;
    const result = evaluatePublishReadiness(input(engineId, {
      // Older audience, so the preschool floor does not apply and the engine's own
      // number is the one being tested.
      ageMin: 9,
      ageMax: 12,
      pack: {
        ...input(engineId).pack,
        accessibility: {
          ...input(engineId).pack.accessibility,
          min_touch_target_dp: floor - 1,
        },
      },
    }));
    const entry = check(result, 'touch_targets');
    assert.equal(entry.status, 'blocked', `${engineId} accepted ${floor - 1}dp`);
    assert.equal(entry.owner, 'engineering');
    assert.match(entry.detail, new RegExp(String(floor)));
  }
});

test('rhythm_tap asks for more than the shared floor because the target moves', () => {
  assert.equal(ENGINE_CONTRACTS.rhythm_tap.minTouchTargetDp, 72);
  const result = evaluatePublishReadiness(input('rhythm_tap', {
    ageMin: 9, ageMax: 12,
    pack: {
      ...input('rhythm_tap').pack,
      accessibility: { ...input('rhythm_tap').pack.accessibility, min_touch_target_dp: 56 },
    },
  }));
  assert.equal(check(result, 'touch_targets').status, 'blocked');
});

test('the preschool floor raises every engine to 64dp', () => {
  const result = evaluatePublishReadiness(input('block_code', {
    ageMin: 3, ageMax: 5,
    pack: {
      ...input('block_code').pack,
      accessibility: { ...input('block_code').pack.accessibility, min_touch_target_dp: 48 },
    },
  }));
  assert.equal(check(result, 'touch_targets').status, 'blocked');
  assert.match(check(result, 'touch_targets').detail, /64dp/);
  assert.match(check(result, 'touch_targets').detail, /preschool/);
});

test('an undeclared touch target warns rather than blocks', () => {
  // The client applies its own floor, so silence is a documentation gap. A
  // declared value below the floor is the opposite: an instruction to shrink it.
  const result = evaluatePublishReadiness(input('match_pairs', {
    pack: {
      ...input('match_pairs').pack,
      accessibility: { sequential_tap_alternative: true },
    },
  }));
  assert.equal(check(result, 'touch_targets').status, 'warn');
  assert.equal(result.publishable, true);
});

/* -------------------------------------------------- version, ages, QA, assets */

test('a pack from the future cannot be run and says so', () => {
  const result = evaluatePublishReadiness(input('block_code', {
    pack: { ...input('block_code').pack, pack_version: 4 },
    supportedPackVersion: 2,
  }));
  const entry = check(result, 'pack_version');
  assert.equal(entry.status, 'blocked');
  assert.equal(entry.owner, 'engineering');
  assert.match(entry.detail, /4/);
  assert.match(entry.detail, /2/);
});

test('invalid age bounds block, and a mismatched objective band warns', () => {
  const invalid = evaluatePublishReadiness(input('sort_bins', { ageMin: 8, ageMax: 4 }));
  assert.equal(check(invalid, 'age_range').status, 'blocked');

  const mismatch = evaluatePublishReadiness(input('sort_bins', {
    ageMin: 3, ageMax: 5, objectiveAgeMin: 9, objectiveAgeMax: 12,
  }));
  assert.equal(check(mismatch, 'age_range').status, 'warn');
  assert.equal(mismatch.publishable, true);

  const overlap = evaluatePublishReadiness(input('sort_bins', {
    ageMin: 5, ageMax: 7, objectiveAgeMin: 6, objectiveAgeMax: 9,
  }));
  assert.equal(check(overlap, 'age_range').status, 'pass');
});

test('QA refusal blocks; a pending QA record only warns', () => {
  const rejected = evaluatePublishReadiness(input('match_pairs', {
    reviews: [{ role: 'qa', status: 'rejected' }],
  }));
  assert.equal(check(rejected, 'qa').status, 'blocked');
  assert.equal(rejected.publishable, false);

  const pending = evaluatePublishReadiness(input('match_pairs', {
    reviews: [{ role: 'qa', status: 'pending' }],
  }));
  assert.equal(check(pending, 'qa').status, 'warn');
  assert.equal(pending.publishable, true);

  const approved = evaluatePublishReadiness(input('match_pairs', {
    reviews: [{ role: 'qa', status: 'approved', reviewer: 'فاحص' }],
  }));
  assert.equal(check(approved, 'qa').status, 'pass');
});

test('an unimplemented engine in the app blocks, and an unrecorded one does not lie', () => {
  const missing = evaluatePublishReadiness(input('sim_lab', { engineImplemented: false }));
  assert.equal(check(missing, 'implementation').status, 'blocked');
  assert.equal(check(missing, 'implementation').owner, 'engineering');

  const unknown = evaluatePublishReadiness(input('sim_lab', { engineImplemented: undefined }));
  assert.equal(check(unknown, 'implementation').status, 'not_applicable');
});

test('production artwork is visible without withholding a playable game', () => {
  const notReady = evaluatePublishReadiness(input('match_pairs', {
    productionAssets: [{ role: 'cover', assetId: 'asset-cover', status: 'planned' }],
  }));
  const entry = check(notReady, 'production_assets');
  assert.equal(entry.status, 'warn');
  assert.equal(entry.owner, 'production');
  assert.ok(entry.items.some((item) => item.includes('cover')));
  assert.equal(notReady.publishable, true);

  const none = evaluatePublishReadiness(input('match_pairs', { productionAssets: [] }));
  assert.equal(check(none, 'production_assets').status, 'warn');
});

test('a level demanding supervision is surfaced even when the game row does not', () => {
  const result = evaluatePublishReadiness(input('sim_lab', {
    supervisionLevel: 'none',
    pack: {
      ...input('sim_lab').pack,
      levels: [{ level: 1, scoring: 'discrete', supervision_level: 'required' }],
    },
  }));
  assert.equal(check(result, 'safety').status, 'warn');
});

test('every engine with a runtime schema also has a contract', () => {
  // A schema with no contract means readiness would fall back to defaults for a
  // real engine, silently applying the wrong touch-target floor.
  for (const engineId of enginesWithRuntimeSchema()) {
    assert.ok(ENGINE_CONTRACTS[engineId], `${engineId} has a runtime schema but no contract`);
  }
});
