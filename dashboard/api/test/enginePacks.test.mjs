/// Validation for the eleven engines beyond `trace_color`.
///
/// The emphasis is on the rules that catch content which would otherwise publish
/// and then fail a child: an unanswerable counting question, a pattern whose
/// answer does not fit its own rule, an Arabic word whose letters are marked with
/// the wrong shapes, a reference solution that walks into a wall, an event placed
/// off the edge of the map.
///
/// Also asserts the two properties that keep the duplicated logic honest: the
/// worker's schema copies are byte-identical to the documented ones, and the
/// server-side block interpreter agrees with the Dart one on every shared fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { validateGamePack } from '../src/lib/gamePackValidation.ts';
import { ENGINE_SCHEMAS, enginesWithRuntimeSchema } from '../src/lib/gamePackGate.ts';
import { ENGINE_CONTRACTS } from '../src/lib/engineContracts.ts';
import { buildPackSchema, overlappingDefNames, envelopeDef } from '../src/lib/packSchema.ts';
import { runBlockProgram } from '../src/lib/blockCodeSim.ts';
import { REGION_BOUNDS, WORLD_BOUNDS, boundsForRegion } from '../src/lib/mapRegions.ts';
import { assertSupportedSchema } from '../src/lib/jsonSchema.ts';

const REPO = path.resolve(import.meta.dirname, '../../..');
const DOCS_SCHEMAS = path.join(REPO, 'docs/games/schemas');
const SRC_SCHEMAS = path.resolve(import.meta.dirname, '../src/schemas');
const FIXTURES = path.join(REPO, 'docs/games/fixtures');

function baseContext(engineId, overrides = {}) {
  return {
    engineId,
    ageMin: 6,
    ageMax: 8,
    supervisionLevel: 'none',
    safetyNotes: null,
    translatedFrom: null,
    supportedEngineVersion: 1,
    maxElementsOnScreen: 20,
    forPublish: false,
    ...overrides,
  };
}

const VOICE = {
  'vo.intro': 'asset-vo-intro',
  'vo.instruction': 'asset-vo-instruction',
  'vo.instruction_repeat': 'asset-vo-instruction-repeat',
  'vo.level_complete': 'asset-vo-level-complete',
  'vo.game_complete': 'asset-vo-game-complete',
  'vo.exit_confirm': 'asset-vo-exit',
};

function packFor(engineId, level, overrides = {}) {
  return {
    pack_version: 1,
    engine_id: engineId,
    pack_id: `test-${engineId.replace(/_/g, '-')}`,
    supports_dpad: ENGINE_CONTRACTS[engineId]?.supportsDpad ?? true,
    progression: { levels_to_finish: 1, advance_on: 'level_complete' },
    voice_manifest: VOICE,
    levels: [level],
    ...overrides,
  };
}

function validate(engineId, pack, ctxOverrides = {}) {
  return validateGamePack(ENGINE_SCHEMAS[engineId], pack, baseContext(engineId, ctxOverrides));
}

// ------------------------------------------------------------ schema integrity

test('every engine has a runtime schema, and it matches the registry of contracts', () => {
  const withSchema = enginesWithRuntimeSchema();
  assert.equal(withSchema.length, 12);
  assert.deepEqual(withSchema, Object.keys(ENGINE_CONTRACTS).sort());
});

test('the worker schema copies are byte-identical to the documented ones', () => {
  // Authors read docs/games/schemas; the worker enforces its own copy. Drift makes
  // the documented contract a lie.
  const documented = readdirSync(DOCS_SCHEMAS).filter((f) => f.endsWith('.json'));
  assert.ok(documented.length >= 13);
  for (const file of documented) {
    const docs = readFileSync(path.join(DOCS_SCHEMAS, file), 'utf8');
    const src = readFileSync(path.join(SRC_SCHEMAS, file), 'utf8');
    assert.equal(src, docs, `${file} differs between docs and the worker`);
  }
});

test('every composed pack schema uses only implemented keywords', () => {
  for (const [engineId, schema] of Object.entries(ENGINE_SCHEMAS)) {
    assert.doesNotThrow(() => assertSupportedSchema(schema), `${engineId} schema`);
  }
});

test('a $defs name shared with the envelope is defined identically', () => {
  // The composed schema lifts a level schema's $defs alongside the envelope's. If
  // a name existed on both sides with different meanings, one would silently
  // shadow the other and a constraint would quietly change.
  for (const file of readdirSync(DOCS_SCHEMAS).filter((f) => f.endsWith('.v1.schema.json'))) {
    const levelSchema = JSON.parse(readFileSync(path.join(DOCS_SCHEMAS, file), 'utf8'));
    for (const name of overlappingDefNames(levelSchema)) {
      const level = levelSchema.$defs[name];
      const envelope = envelopeDef(name);
      assert.equal(level.type, envelope.type, `${file} $defs/${name} type`);
      assert.equal(level.pattern, envelope.pattern, `${file} $defs/${name} pattern`);
    }
  }
});

test('a composed schema rejects a pack for the wrong engine', () => {
  const schema = buildPackSchema({
    engineId: 'count_quantity',
    levelSchema: JSON.parse(readFileSync(path.join(SRC_SCHEMAS, 'count_quantity.v1.schema.json'), 'utf8')),
  });
  const result = validateGamePack(schema, { ...packFor('count_quantity', { level: 1 }), engine_id: 'sort_bins' },
    baseContext('count_quantity'));
  assert.ok(result.errors.some((e) => /does not match the game's engine/.test(e)));
});

// ------------------------------------------------------------- engine contracts

test('supports_dpad must match the engine, in both directions', () => {
  // The pointer-only direction is covered for trace_color in
  // gamePackValidation.test.mjs against its real pack shape. What is new here is
  // the opposite direction: a board engine denying D-pad support would hide working
  // content from every television household.
  const level = {
    level: 1,
    grid: [2, 2],
    pair_type: 'identical',
    flip_back_delay_ms: 1400,
    pairs: [
      { a: 'asset-card-a', b: 'asset-card-a2', sound_key: 'vo.card.a' },
      { a: 'asset-card-b', b: 'asset-card-b2', sound_key: 'vo.card.b' },
    ],
  };
  const board = validate('memory_flip', packFor('memory_flip', level, { supports_dpad: false }));
  assert.ok(
    board.errors.some((e) => /playable with a D-pad/.test(e)),
    board.errors.join('; '),
  );

  const correct = validate('memory_flip', packFor('memory_flip', level));
  assert.ok(!correct.errors.some((e) => /D-pad/.test(e)), correct.errors.join('; '));
});

test('a language_specific engine cannot be relabelled translatable', () => {
  const result = validate('word_build', packFor('word_build', {
    level: 1,
    language: 'ar',
    word: 'قمر',
    word_audio: 'asset-vo-word',
    word_image: 'asset-moon',
    writing_direction: 'rtl',
    slots: 3,
    letters: [
      { char: 'ق', form: 'initial', position: 1, audio: 'asset-vo-qaf' },
      { char: 'م', form: 'medial', position: 2, audio: 'asset-vo-meem' },
      { char: 'ر', form: 'final', position: 3, audio: 'asset-vo-ra' },
    ],
    show_word_text_button: true,
  }, { localization: 'translatable' }));
  assert.ok(result.errors.some((e) => /contradicts the engine contract/.test(e)));
});

test('an entertainment-first engine may not carry a learning objective', () => {
  const level = {
    level: 1,
    track: 'asset-nasheed',
    track_duration_ms: 30000,
    bpm: 90,
    lanes: 1,
    hit_window_ms: 450,
    accuracy_to_pass: 0.5,
    notes: [{ time_ms: 1000, lane: 0 }, { time_ms: 2000, lane: 0 }, { time_ms: 3000, lane: 0 }, { time_ms: 4000, lane: 0 }],
    visual_pulse: true,
    never_fail: true,
  };
  const withObjective = validate('rhythm_tap', packFor('rhythm_tap', level), { hasLearningObjective: true });
  assert.ok(withObjective.errors.some((e) => /must not have a learning objective/.test(e)));

  const without = validate('rhythm_tap', packFor('rhythm_tap', level), { hasLearningObjective: false });
  assert.ok(!without.errors.some((e) => /learning objective/.test(e)));
});

test('the review each engine mandates blocks publish and warns on a draft', () => {
  const level = {
    level: 1,
    sim: 'pendulum',
    variables: [{ id: 'length_cm', label_key: 'var.length', min: 20, max: 100, step: 20, unit_key: 'unit.cm' }],
    measured: { id: 'period_s', label_key: 'var.period', unit_key: 'unit.second' },
    hypothesis_options: ['hyp.longer_slower', 'hyp.no_effect'],
    expected_relationships: { length_cm: 'positive' },
    explanation_options: ['exp.length_only', 'exp.mass_only'],
    explanation_answer: 'exp.length_only',
    results_table: true,
    min_trials_before_explain: 2,
    supervision_level: 'none',
    safety_note_key: null,
  };
  const draft = validate('sim_lab', packFor('sim_lab', level), { ageMin: 9, ageMax: 11 });
  assert.ok(draft.warnings.some((w) => /scientific review/.test(w)));
  assert.equal(draft.errors.length, 0, draft.errors.join('; '));

  const publish = validate('sim_lab', packFor('sim_lab', level), {
    ageMin: 9, ageMax: 11, forPublish: true,
  });
  assert.ok(publish.errors.some((e) => /scientific review/.test(e)));

  const approved = validate('sim_lab', packFor('sim_lab', level, {
    review: { scientific_review: { status: 'approved', reviewer: 'Dr Reviewer' } },
  }), { ageMin: 9, ageMax: 11, forPublish: true });
  assert.ok(!approved.errors.some((e) => /scientific review/.test(e)));
});

// ------------------------------------------------------------- count_quantity

test('a counting answer must equal the number of elements on screen', () => {
  const bad = validate('count_quantity', packFor('count_quantity', {
    level: 1,
    mode: 'count_and_pick',
    range: [1, 5],
    items: [
      { id: 'q1', items: [{ image: 'asset-star', count: 3 }], options: [2, 4, 5], answer: 5 },
      { id: 'q2', items: [{ image: 'asset-star', count: 4 }], options: [3, 4, 5], answer: 4 },
      { id: 'q3', items: [{ image: 'asset-star', count: 2 }], options: [1, 2, 3], answer: 2 },
    ],
  }));
  assert.ok(bad.errors.some((e) => /answer is 5 but 3 element\(s\) are on screen/.test(e)));
});

test('a compare_sets answer of equal must mean the sets are equal', () => {
  const result = validate('count_quantity', packFor('count_quantity', {
    level: 1,
    mode: 'compare_sets',
    items: [
      { id: 'q1', set_a: { image: 'asset-star', count: 5 }, set_b: { image: 'asset-star', count: 8 }, question_key: 'count.which_more', options: ['set_a', 'set_b', 'equal'], answer: 'equal' },
      { id: 'q2', set_a: { image: 'asset-star', count: 4 }, set_b: { image: 'asset-star', count: 4 }, question_key: 'count.which_more', options: ['set_a', 'set_b', 'equal'], answer: 'set_a' },
      { id: 'q3', set_a: { image: 'asset-star', count: 2 }, set_b: { image: 'asset-star', count: 3 }, question_key: 'count.which_more', options: ['set_a', 'set_b', 'equal'], answer: 'set_b' },
    ],
  }));
  assert.ok(result.errors.some((e) => /answer is "equal" but the sets hold 5 and 8/.test(e)));
  assert.ok(result.errors.some((e) => /the sets are equal \(4 and 4\)/.test(e)));
});

test('a numeric pattern must be consistent with its own step', () => {
  const result = validate('count_quantity', packFor('count_quantity', {
    level: 1,
    mode: 'pattern_fill',
    items: [
      { id: 'p1', sequence: [2, 4, 6, null], options: [7, 8, 9], answer: 9, rule_key: 'pattern.add_2' },
      { id: 'p2', sequence: [5, 10, null, 20], options: [12, 15, 18], answer: 15, rule_key: 'pattern.add_5' },
      { id: 'p3', sequence: [1, 2, 3, null], options: [4, 5], answer: 4, rule_key: 'pattern.add_1' },
    ],
  }));
  assert.ok(result.errors.some((e) => /steps by 2, so the missing value is 8, not 9/.test(e)));
  // The mid-sequence gap is handled too, and p2 is correct.
  assert.ok(!result.errors.some((e) => /"p2"/.test(e)), result.errors.join('; '));
});

test('the recount button cannot be switched off', () => {
  const result = validate('count_quantity', packFor('count_quantity', {
    level: 1,
    mode: 'count_and_pick',
    allow_recount_button: false,
    items: [
      { id: 'q1', items: [{ image: 'asset-star', count: 3 }], options: [2, 3], answer: 3 },
      { id: 'q2', items: [{ image: 'asset-star', count: 2 }], options: [2, 3], answer: 2 },
      { id: 'q3', items: [{ image: 'asset-star', count: 1 }], options: [1, 2], answer: 1 },
    ],
  }));
  assert.ok(result.errors.some((e) => /allow_recount_button must be true/.test(e)));
});

// -------------------------------------------------------------- logic_pattern

test('colour may not be the only changing dimension', () => {
  const result = validate('logic_pattern', packFor('logic_pattern', {
    level: 1,
    mode: 'linear',
    sequence: ['asset-a', 'asset-b', null],
    options: ['asset-c', 'asset-d', 'asset-e'],
    answer: 'asset-c',
    rule_key: 'rule.color_cycle',
    changing_dimensions: ['color'],
  }));
  assert.ok(result.errors.some((e) => /colour may not be the only changing dimension/.test(e)));
});

test('a 3x3 matrix must require an explanation', () => {
  const result = validate('logic_pattern', packFor('logic_pattern', {
    level: 4,
    mode: 'matrix_3x3',
    grid: [['asset-a1', 'asset-a2', 'asset-a3'], ['asset-b1', 'asset-b2', 'asset-b3'], ['asset-c1', 'asset-c2', null]],
    options: ['asset-c3', 'asset-x1', 'asset-x2'],
    answer: 'asset-c3',
    rule_key: 'rule.rotate',
    changing_dimensions: ['rotation', 'shape'],
    require_explanation: false,
    explain_options: ['rule.rotate', 'rule.mirror', 'rule.color'],
    explain_answer: 'rule.rotate',
  }));
  assert.ok(result.errors.some((e) => /must set require_explanation true/.test(e)));
});

test('exactly one cell may be missing', () => {
  const result = validate('logic_pattern', packFor('logic_pattern', {
    level: 1,
    mode: 'linear',
    sequence: ['asset-a', null, null],
    options: ['asset-c', 'asset-d', 'asset-e'],
    answer: 'asset-c',
    rule_key: 'rule.shape_cycle',
    changing_dimensions: ['shape'],
  }));
  assert.ok(result.errors.some((e) => /exactly one cell may be missing, found 2/.test(e)));
});

// ----------------------------------------------------------------- word_build

test('Arabic letter forms must be the forms the letter takes in the word', () => {
  // In «قمر» the ر is final. Marking it isolated would teach a shape that does not
  // occur in the word.
  const result = validate('word_build', packFor('word_build', {
    level: 1,
    language: 'ar',
    word: 'قمر',
    word_audio: 'asset-vo-word',
    word_image: 'asset-moon',
    writing_direction: 'rtl',
    slots: 3,
    letters: [
      { char: 'ق', form: 'initial', position: 1, audio: 'asset-vo-qaf' },
      { char: 'م', form: 'medial', position: 2, audio: 'asset-vo-meem' },
      { char: 'ر', form: 'isolated', position: 3, audio: 'asset-vo-ra' },
    ],
    show_word_text_button: true,
  }, { localization: 'language_specific' }));
  assert.ok(result.errors.some((e) => /takes the "final" form/.test(e)));
});

test('a letter after a non-connecting letter is initial, not medial', () => {
  // «درس»: د does not join to the left, so ر is initial rather than medial.
  const result = validate('word_build', packFor('word_build', {
    level: 1,
    language: 'ar',
    word: 'درس',
    word_audio: 'asset-vo-word',
    word_image: 'asset-lesson',
    writing_direction: 'rtl',
    slots: 3,
    letters: [
      { char: 'د', form: 'initial', position: 1, audio: 'asset-vo-dal' },
      { char: 'ر', form: 'medial', position: 2, audio: 'asset-vo-ra' },
      { char: 'س', form: 'final', position: 3, audio: 'asset-vo-seen' },
    ],
    show_word_text_button: true,
  }, { localization: 'language_specific' }));
  assert.ok(
    result.errors.some((e) => /"ر" at position 2 is marked "medial"/.test(e)),
    result.errors.join('; '),
  );
  assert.ok(result.errors.some((e) => /does not join to the left/.test(e)));
});

test('the letters must spell the word, and a distractor may not be a needed letter', () => {
  const result = validate('word_build', packFor('word_build', {
    level: 1,
    language: 'ar',
    word: 'قمر',
    word_audio: 'asset-vo-word',
    word_image: 'asset-moon',
    writing_direction: 'rtl',
    slots: 3,
    letters: [
      { char: 'ق', form: 'initial', position: 1, audio: 'asset-vo-qaf' },
      { char: 'ب', form: 'medial', position: 2, audio: 'asset-vo-baa' },
      { char: 'ر', form: 'final', position: 3, audio: 'asset-vo-ra' },
    ],
    distractors: [{ char: 'ر', form: 'isolated', audio: 'asset-vo-ra' }],
    show_word_text_button: true,
  }, { localization: 'language_specific' }));
  assert.ok(result.errors.some((e) => /letters spell "قبر" but the word is "قمر"/.test(e)));
  assert.ok(result.errors.some((e) => /distractor "ر" is also a letter of the word/.test(e)));
});

// ----------------------------------------------------------------- rhythm_tap

test('a preschool rhythm pack cannot have a tight hit window or a high level', () => {
  const result = validate('rhythm_tap', packFor('rhythm_tap', {
    level: 4,
    track: 'asset-nasheed',
    track_duration_ms: 30000,
    bpm: 108,
    lanes: 2,
    hit_window_ms: 320,
    accuracy_to_pass: 0.6,
    notes: [{ time_ms: 500, lane: 0 }, { time_ms: 1000, lane: 1 }, { time_ms: 1500, lane: 0 }, { time_ms: 2000, lane: 1 }],
    visual_pulse: true,
    never_fail: true,
  }), { ageMin: 3, ageMax: 5 });
  assert.ok(result.errors.some((e) => /below the 450ms floor/.test(e)));
  assert.ok(result.errors.some((e) => /levels 1 and 2 only/.test(e)));
});

test('a note outside the track or in a missing lane is rejected', () => {
  const result = validate('rhythm_tap', packFor('rhythm_tap', {
    level: 1,
    track: 'asset-nasheed',
    track_duration_ms: 10000,
    bpm: 72,
    lanes: 1,
    hit_window_ms: 450,
    accuracy_to_pass: 0.5,
    notes: [{ time_ms: 500, lane: 0 }, { time_ms: 1000, lane: 2 }, { time_ms: 99000, lane: 0 }, { time_ms: 2000, lane: 0 }],
    visual_pulse: true,
    never_fail: true,
  }));
  assert.ok(result.errors.some((e) => /lane 2 but the level has 1 lane/.test(e)));
  assert.ok(result.errors.some((e) => /falls after the 10000ms track ends/.test(e)));
});

// ----------------------------------------------------------------- block_code

test('a reference solution that does not solve the level is rejected', () => {
  const result = validate('block_code', packFor('block_code', {
    level: 1,
    grid: { w: 4, h: 4, walls: [[2, 0]], start: [0, 0], facing: 'east', goal: [3, 0], collectibles: [] },
    allowed_blocks: ['move', 'turn_left', 'turn_right'],
    block_limit: 8,
    optimal_blocks: 5,
    step_delay_ms: 500,
    reference_solution: ['move', 'move', 'move'],
  }), { ageMin: 8, ageMax: 10 });
  assert.ok(
    result.errors.some((e) => /reference_solution does not solve the level/.test(e)),
    result.errors.join('; '),
  );
});

test('a reference solution using a block the level forbids is rejected', () => {
  const result = validate('block_code', packFor('block_code', {
    level: 1,
    grid: { w: 4, h: 3, walls: [], start: [0, 0], facing: 'east', goal: [2, 0], collectibles: [] },
    allowed_blocks: ['move'],
    block_limit: 8,
    optimal_blocks: 4,
    step_delay_ms: 500,
    reference_solution: ['repeat:2', 'move'],
  }), { ageMin: 8, ageMax: 10 });
  assert.ok(result.errors.some((e) => /"repeat", which is not in allowed_blocks/.test(e)));
});

test('a start or goal on a wall, or off the grid, is rejected', () => {
  // [5,5] is inside the schema's 0..7 cell range but outside this 4x4 grid, which
  // is precisely the gap a schema cannot close: the bound depends on `w` and `h`.
  const result = validate('block_code', packFor('block_code', {
    level: 1,
    grid: { w: 4, h: 4, walls: [[0, 0], [3, 3]], start: [0, 0], facing: 'east', goal: [3, 3], collectibles: [[5, 5]] },
    allowed_blocks: ['move'],
    block_limit: 8,
    optimal_blocks: 4,
    step_delay_ms: 500,
  }), { ageMin: 8, ageMax: 10 });
  assert.ok(result.errors.some((e) => /start \[0,0\] is on a wall/.test(e)), result.errors.join('; '));
  assert.ok(result.errors.some((e) => /goal \[3,3\] is on a wall/.test(e)));
  assert.ok(result.errors.some((e) => /collectible at \[5,5\] is outside the 4x4 grid/.test(e)));
});

test('an unreachable optimality star is rejected', () => {
  const result = validate('block_code', packFor('block_code', {
    level: 1,
    grid: { w: 4, h: 3, walls: [], start: [0, 0], facing: 'east', goal: [2, 0], collectibles: [] },
    allowed_blocks: ['move'],
    block_limit: 3,
    optimal_blocks: 6,
    step_delay_ms: 500,
  }), { ageMin: 8, ageMax: 10 });
  assert.ok(result.errors.some((e) => /optimal_blocks 6 exceeds block_limit 3/.test(e)));
});

test('a correct block_code level passes', () => {
  const result = validate('block_code', packFor('block_code', {
    level: 1,
    grid: { w: 4, h: 3, walls: [], start: [0, 0], facing: 'east', goal: [2, 0], collectibles: [[1, 0]] },
    allowed_blocks: ['move', 'collect'],
    block_limit: 8,
    optimal_blocks: 3,
    step_delay_ms: 500,
    reference_solution: ['move', 'collect', 'move'],
  }), { ageMin: 8, ageMax: 10 });
  assert.deepEqual(result.errors, []);
});

// -------------------------------------------------------------------- sim_lab

test('a simulation where nothing has an effect is rejected', () => {
  const result = validate('sim_lab', packFor('sim_lab', {
    level: 1,
    sim: 'pendulum',
    variables: [{ id: 'mass_g', label_key: 'var.mass', min: 10, max: 50, step: 10, unit_key: 'unit.gram' }],
    measured: { id: 'period_s', label_key: 'var.period', unit_key: 'unit.second' },
    hypothesis_options: ['hyp.heavier_slower', 'hyp.no_effect'],
    expected_relationships: { mass_g: 'none' },
    explanation_options: ['exp.mass_only', 'exp.neither'],
    explanation_answer: 'exp.neither',
    results_table: true,
    min_trials_before_explain: 2,
    supervision_level: 'none',
    safety_note_key: null,
  }), { ageMin: 9, ageMax: 11 });
  assert.ok(result.errors.some((e) => /no observable outcome/.test(e)));
});

test('a relationship must name a real variable, and every variable needs one', () => {
  const result = validate('sim_lab', packFor('sim_lab', {
    level: 1,
    sim: 'plant_growth',
    variables: [
      { id: 'light_h', label_key: 'var.light', min: 0, max: 12, step: 2, unit_key: 'unit.hour' },
      { id: 'water_ml', label_key: 'var.water', min: 0, max: 100, step: 25, unit_key: 'unit.ml' },
    ],
    measured: { id: 'height_cm', label_key: 'var.height', unit_key: 'unit.cm' },
    hypothesis_options: ['hyp.more_light_taller', 'hyp.no_effect'],
    expected_relationships: { light_h: 'saturating', sunshine: 'positive' },
    explanation_options: ['exp.light_then_plateau', 'exp.water_only'],
    explanation_answer: 'exp.light_then_plateau',
    results_table: true,
    min_trials_before_explain: 3,
    supervision_level: 'none',
    safety_note_key: null,
  }), { ageMin: 9, ageMax: 11 });
  assert.ok(result.errors.some((e) => /names "sunshine", which is not a variable/.test(e)));
  assert.ok(result.errors.some((e) => /variable "water_ml" has no declared relationship/.test(e)));
});

test('a supervised experiment needs a safety note', () => {
  const result = validate('sim_lab', packFor('sim_lab', {
    level: 1,
    sim: 'circuit',
    variables: [{ id: 'batteries', label_key: 'var.batteries', min: 1, max: 4, step: 1, unit_key: 'unit.count' }],
    measured: { id: 'brightness', label_key: 'var.brightness', unit_key: 'unit.lux' },
    hypothesis_options: ['hyp.more_brighter', 'hyp.no_effect'],
    expected_relationships: { batteries: 'positive' },
    explanation_options: ['exp.more_batteries', 'exp.fewer_batteries'],
    explanation_answer: 'exp.more_batteries',
    results_table: true,
    min_trials_before_explain: 2,
    supervision_level: 'required',
    safety_note_key: null,
  }), { ageMin: 10, ageMax: 12, supervisionLevel: 'required', safetyNotes: 'Adult supervision required' });
  assert.ok(result.errors.some((e) => /safety_note_key/.test(e)), result.errors.join('; '));
});

// --------------------------------------------------------------- timeline_map

test('an event outside the named map region is rejected', () => {
  const result = validate('timeline_map', packFor('timeline_map', {
    level: 1,
    mode: 'map',
    map: { region: 'middle_east_north_africa', projection: 'equirectangular', mirror_in_rtl: false },
    events: [
      { id: 'e1', label_key: 'hist.event.baghdad', image: 'asset-e1', lat: 33.31, lon: 44.36, tolerance_km: 200 },
      { id: 'e2', label_key: 'hist.event.tokyo', image: 'asset-e2', lat: 35.68, lon: 139.69, tolerance_km: 200 },
      { id: 'e3', label_key: 'hist.event.cairo', image: 'asset-e3', lat: 30.04, lon: 31.24, tolerance_km: 200 },
    ],
  }), { ageMin: 9, ageMax: 11 });
  assert.ok(
    result.errors.some((e) => /is outside the "middle_east_north_africa" map/.test(e)),
    result.errors.join('; '),
  );
});

test('a mirrored map is rejected outright', () => {
  const result = validate('timeline_map', packFor('timeline_map', {
    level: 1,
    mode: 'map',
    map: { region: 'arab_world', projection: 'equirectangular', mirror_in_rtl: true },
    events: [
      { id: 'e1', label_key: 'hist.event.a', image: 'asset-e1', lat: 30, lon: 31, tolerance_km: 200 },
      { id: 'e2', label_key: 'hist.event.b', image: 'asset-e2', lat: 25, lon: 45, tolerance_km: 200 },
      { id: 'e3', label_key: 'hist.event.c', image: 'asset-e3', lat: 33, lon: 44, tolerance_km: 200 },
    ],
  }), { ageMin: 9, ageMax: 11 });
  // The schema pins it, so this is caught before the semantic rules even run.
  assert.ok(result.errors.some((e) => /mirror_in_rtl/.test(e)));
});

test('an event year outside the timeline is rejected', () => {
  const result = validate('timeline_map', packFor('timeline_map', {
    level: 1,
    mode: 'timeline',
    timeline: { from: 600, to: 1500, unit: 'gregorian_year', display_calendar: 'auto' },
    events: [
      { id: 'e1', label_key: 'hist.event.a', image: 'asset-e1', year: 762, tolerance_years: 50 },
      { id: 'e2', label_key: 'hist.event.b', image: 'asset-e2', year: 1969, tolerance_years: 50 },
      { id: 'e3', label_key: 'hist.event.c', image: 'asset-e3', year: 1258, tolerance_years: 50 },
    ],
  }), { ageMin: 9, ageMax: 11 });
  assert.ok(result.errors.some((e) => /year 1969 falls outside the timeline 600\.\.1500/.test(e)));
});

// --------------------------------------------------- shared fixture agreement

test('the server block interpreter matches the shared fixture', () => {
  // The same file drives app_main/test/wave_two_engines_test.dart. Two
  // interpreters of block_code exist because one plays and one verifies an
  // authored reference solution; this is what stops them diverging.
  const fixture = JSON.parse(readFileSync(path.join(FIXTURES, 'block_code_cases.json'), 'utf8'));
  assert.ok(fixture.cases.length >= 10);
  for (const testCase of fixture.cases) {
    const grid = {
      width: testCase.grid.w,
      height: testCase.grid.h,
      start: testCase.grid.start,
      goal: testCase.grid.goal,
      facing: testCase.grid.facing,
      walls: testCase.grid.walls ?? [],
      collectibles: testCase.grid.collectibles ?? [],
    };
    const outcome = runBlockProgram(grid, testCase.program, testCase.function ?? []);
    assert.equal(outcome.x, testCase.expect.x, `${testCase.name}: x`);
    assert.equal(outcome.y, testCase.expect.y, `${testCase.name}: y`);
    assert.equal(outcome.facing, testCase.expect.facing, `${testCase.name}: facing`);
    assert.equal(outcome.collected, testCase.expect.collected, `${testCase.name}: collected`);
    assert.equal(outcome.collided, testCase.expect.collided, `${testCase.name}: collided`);
    assert.equal(outcome.reachedGoal, testCase.expect.reached_goal, `${testCase.name}: reached_goal`);
  }
});

test('the map region bounds match the shared fixture', () => {
  const fixture = JSON.parse(readFileSync(path.join(FIXTURES, 'map_regions.json'), 'utf8'));
  for (const [region, expected] of Object.entries(fixture.regions)) {
    const actual = REGION_BOUNDS[region];
    assert.ok(actual, `region ${region} must be known to the server`);
    assert.equal(actual.minLat, expected.min_lat, `${region} minLat`);
    assert.equal(actual.maxLat, expected.max_lat, `${region} maxLat`);
    assert.equal(actual.minLon, expected.min_lon, `${region} minLon`);
    assert.equal(actual.maxLon, expected.max_lon, `${region} maxLon`);
  }
  assert.equal(WORLD_BOUNDS.maxLon, fixture.world.max_lon);

  for (const place of fixture.known_places) {
    for (const region of Object.keys(fixture.regions)) {
      const bounds = boundsForRegion(region);
      const inside = place.lat >= bounds.minLat && place.lat <= bounds.maxLat
        && place.lon >= bounds.minLon && place.lon <= bounds.maxLon;
      assert.equal(
        inside,
        place.inside.includes(region),
        `${place.name} in ${region}`,
      );
    }
  }
});

test('an unknown region falls back to the world rather than mis-plotting', () => {
  assert.deepEqual(boundsForRegion('atlantis'), WORLD_BOUNDS);
});
