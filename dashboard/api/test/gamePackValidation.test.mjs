/// Tests for the game pack contract: the JSON Schema evaluator, the mandatory
/// rules from docs/games/02-data-contract.md, and the two packs actually shipped
/// by migration 0023.
///
/// The last group matters most. It reads the migration file, extracts the JSON
/// that will be written to `games.content_pack`, and validates it — so the
/// authored data is covered, not just the validator.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateAgainstSchema, assertSupportedSchema } from '../src/lib/jsonSchema.ts';
import { validateGamePack, SCORING_BY_MODE } from '../src/lib/gamePackValidation.ts';

const SCHEMA_PATH = new URL('../src/schemas/trace_color.v1.schema.json', import.meta.url);
const DOCS_SCHEMA_PATH = new URL('../../../docs/games/schemas/trace_color.v1.schema.json', import.meta.url);
const MIGRATION_PATH = new URL('../migrations/0023_trace_color_runtime_packs.sql', import.meta.url);

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

function baseContext(overrides = {}) {
  return {
    engineId: 'trace_color',
    ageMin: 3,
    ageMax: 5,
    supervisionLevel: 'none',
    safetyNotes: null,
    translatedFrom: null,
    supportedEngineVersion: 1,
    maxElementsOnScreen: 3,
    forPublish: false,
    ...overrides,
  };
}

/// A minimal pack that satisfies the schema, used as the base for negative cases
/// so each test changes exactly one thing.
function validPack(overrides = {}) {
  return {
    pack_version: 1,
    engine_id: 'trace_color',
    localization: 'language_neutral',
    supports_dpad: false,
    progression: { levels_to_finish: 1, advance_on: 'level_complete' },
    accessibility: {
      simplified_motor: { tolerance_dp: 40, coverage_required: 0.6 },
      sequential_tap_alternative: true,
    },
    levels: [
      {
        level: 1,
        mode: 'shape',
        scoring: 'geometric',
        prompt_key: 'game.shapes.circle.prompt',
        completion: { rule: 'all_strokes_complete' },
        stroke_paths: [
          { id: 's1', order: 1, type: 'stroke', points: [[0.2, 0.2], [0.8, 0.8]] },
        ],
        tolerance_dp: 24,
        coverage_required: 0.8,
      },
    ],
    assets: { images: [], audio: [] },
    voice_manifest: {
      'vo.intro': 'asset-vo-intro',
      'vo.instruction': 'asset-vo-instruction',
      'vo.instruction_repeat': 'asset-vo-instruction-slow',
      'vo.stroke_complete': 'asset-vo-stroke-complete',
      'vo.level_complete': 'asset-vo-level-complete',
      'vo.game_complete': 'asset-vo-game-complete',
      'vo.exit_confirm': 'asset-vo-exit-confirm',
    },
    ...overrides,
  };
}

// --- the schema evaluator --------------------------------------------------

test('the canonical schema uses only keywords the evaluator implements', () => {
  // Guards the failure mode where a new keyword is added to the schema and the
  // constraint is then silently never enforced.
  assert.doesNotThrow(() => assertSupportedSchema(schema));
});

test('an unsupported keyword is rejected loudly rather than ignored', () => {
  assert.throws(
    () => assertSupportedSchema({ oneOf: [{ type: 'string' }] }),
    /Unsupported JSON Schema keyword "oneOf"/,
  );
});

test('the worker schema and the documented schema are identical', () => {
  // Authors read docs/games/schemas; the worker enforces its own copy. If they
  // drift, the documented contract becomes a lie.
  const docs = JSON.parse(readFileSync(DOCS_SCHEMA_PATH, 'utf8'));
  assert.deepEqual(docs, schema);
});

test('the evaluator enforces type, bounds, pattern and additionalProperties', () => {
  const s = {
    type: 'object',
    additionalProperties: false,
    required: ['n'],
    properties: {
      n: { type: 'integer', minimum: 1, maximum: 3 },
      s: { type: 'string', pattern: '^a+$', minLength: 2 },
    },
  };
  assert.deepEqual(validateAgainstSchema(s, { n: 2 }), []);
  assert.match(validateAgainstSchema(s, { n: 9 })[0], /above maximum/);
  assert.match(validateAgainstSchema(s, { n: 1.5 })[0], /expected integer/);
  assert.match(validateAgainstSchema(s, {})[0], /missing required property/);
  assert.match(validateAgainstSchema(s, { n: 1, extra: 1 })[0], /unexpected property/);
  // 'bb' rather than 'b': a 1-char value trips minLength first and the pattern
  // error would never be the one reported.
  assert.match(validateAgainstSchema(s, { n: 1, s: 'bb' })[0], /does not match/);
  assert.match(validateAgainstSchema(s, { n: 1, s: 'a' })[0], /shorter than 2 characters/);
});

test('the evaluator resolves local $ref and applies if/then', () => {
  const s = {
    type: 'object',
    properties: { mode: { type: 'string' }, p: { $ref: '#/$defs/point' } },
    if: { properties: { mode: { const: 'letter' } }, required: ['mode'] },
    then: { required: ['p'] },
    $defs: {
      point: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0, maximum: 1 } },
    },
  };
  assert.deepEqual(validateAgainstSchema(s, { mode: 'shape' }), []);
  assert.match(validateAgainstSchema(s, { mode: 'letter' })[0], /missing required property "p"/);
  assert.deepEqual(validateAgainstSchema(s, { mode: 'letter', p: [0.5, 0.5] }), []);
  assert.match(validateAgainstSchema(s, { mode: 'letter', p: [2, 0] })[0], /above maximum/);
});

// --- mandatory rules ------------------------------------------------------

test('a well-formed pack passes as a draft', () => {
  const result = validateGamePack(schema, validPack(), baseContext());
  assert.deepEqual(result.errors, []);
});

test('an empty pack is a legal draft and an illegal publish', () => {
  assert.deepEqual(validateGamePack(schema, {}, baseContext()).errors, []);
  const published = validateGamePack(schema, {}, baseContext({ forPublish: true }));
  assert.match(published.errors[0], /must be authored before publish/);
});

test('rule 6: the pack engine must match the game engine', () => {
  const result = validateGamePack(schema, validPack({ engine_id: 'match_pairs' }), baseContext());
  assert.match(result.errors[0], /does not match the game's engine/);
});

test('rule 7: a pack from a future engine version is rejected', () => {
  const result = validateGamePack(schema, validPack({ pack_version: 1 }), baseContext({ supportedEngineVersion: 0 }));
  assert.ok(result.errors.some((e) => /exceeds the supported engine_version/.test(e)));
});

test('rule 2: level numbers must be contiguous from 1', () => {
  const pack = validPack();
  pack.levels = [
    { ...pack.levels[0], level: 1 },
    { ...pack.levels[0], level: 3 },
  ];
  pack.progression.levels_to_finish = 2;
  const result = validateGamePack(schema, pack, baseContext());
  assert.ok(result.errors.some((e) => /level numbers must run 1\.\.2/.test(e)));
});

test('progression cannot require more levels than the pack has', () => {
  const pack = validPack();
  pack.progression.levels_to_finish = 5;
  const result = validateGamePack(schema, pack, baseContext());
  assert.ok(result.errors.some((e) => /exceeds the 1 level/.test(e)));
});

test('rule 4: elements per level cannot exceed the engine budget', () => {
  const pack = validPack();
  pack.levels[0].stroke_paths = [
    { id: 's1', order: 1, type: 'stroke', points: [[0, 0], [1, 1]] },
    { id: 's2', order: 2, type: 'stroke', points: [[0, 1], [1, 0]] },
    { id: 's3', order: 3, type: 'stroke', points: [[0, 0.5], [1, 0.5]] },
  ];
  const result = validateGamePack(schema, pack, baseContext({ maxElementsOnScreen: 2 }));
  assert.ok(result.errors.some((e) => /exceeds max_elements_on_screen 2/.test(e)));
});

test('rule 5: mandatory voice keys block publish but only warn on a draft', () => {
  const pack = validPack();
  delete pack.voice_manifest['vo.exit_confirm'];
  const draft = validateGamePack(schema, pack, baseContext());
  assert.deepEqual(draft.errors, []);
  assert.ok(draft.warnings.some((w) => /vo\.exit_confirm/.test(w)));

  const published = validateGamePack(schema, pack, baseContext({ forPublish: true }));
  assert.ok(published.errors.some((e) => /vo\.exit_confirm/.test(e)));
});

test('rule 3: assets must exist and be ready before publish', () => {
  const pack = validPack();
  const ctx = baseContext({
    forPublish: true,
    knownAssetIds: new Set(['asset-vo-intro']),
    readyAssetIds: new Set(),
  });
  const result = validateGamePack(schema, pack, ctx);
  assert.ok(result.errors.some((e) => /does not exist in content_assets/.test(e)));
  assert.ok(result.errors.some((e) => /is not status "ready"/.test(e)));
});

test('rule 9: age bounds are enforced', () => {
  assert.ok(validateGamePack(schema, validPack(), baseContext({ ageMin: 6, ageMax: 5 }))
    .errors.some((e) => /age_min must be less than or equal/.test(e)));
  assert.ok(validateGamePack(schema, validPack(), baseContext({ ageMin: 2, ageMax: 5 }))
    .errors.some((e) => /between 3 and 12/.test(e)));
});

test('rule 10: a language_specific pack cannot be a translation', () => {
  const pack = validPack({ localization: 'language_specific' });
  const result = validateGamePack(schema, pack, baseContext({ translatedFrom: 'tc-arabic-letters-1' }));
  assert.ok(result.errors.some((e) => /must not be a translation/.test(e)));
});

test('rule 12: supervision "required" needs safety notes', () => {
  const pack = validPack({ supervision_level: 'required' });
  const ctx = baseContext({ supervisionLevel: 'required', safetyNotes: '   ' });
  const result = validateGamePack(schema, pack, ctx);
  assert.ok(result.errors.some((e) => /needs non-empty safety_notes/.test(e)));

  const ok = validateGamePack(schema, pack, baseContext({ supervisionLevel: 'required', safetyNotes: 'بالغ حاضر' }));
  assert.deepEqual(ok.errors, []);
});

test('a pack cannot claim D-pad support for a pointer-only engine', () => {
  const result = validateGamePack(schema, validPack({ supports_dpad: true }), baseContext());
  assert.ok(result.errors.some((e) => /requires a pointer/.test(e)));
});

// --- scoring honesty -------------------------------------------------------

test('free expression cannot be scored', () => {
  // The central pedagogical guarantee: Majarra has no image recognition, so a
  // mode with nothing objective to measure may not claim a score.
  for (const mode of ['coloring', 'free_draw', 'draw_from_prompt']) {
    assert.deepEqual(SCORING_BY_MODE[mode], ['none'], `${mode} must be unscored`);
  }

  const pack = validPack();
  pack.levels[0] = {
    level: 1,
    mode: 'free_draw',
    scoring: 'geometric',
    prompt_key: 'game.free.draw.prompt',
    completion: { rule: 'child_taps_done' },
  };
  const result = validateGamePack(schema, pack, baseContext());
  assert.ok(result.errors.some((e) => /Free expression is never graded/.test(e)));
});

test('an unscored mode must let the child decide when it is finished', () => {
  const pack = validPack();
  pack.levels[0] = {
    level: 1,
    mode: 'free_draw',
    scoring: 'none',
    prompt_key: 'game.free.draw.prompt',
    completion: { rule: 'all_strokes_complete' },
  };
  const result = validateGamePack(schema, pack, baseContext());
  assert.ok(result.errors.some((e) => /child_taps_done/.test(e)));
});

test('letter tracing must use ordered geometric scoring', () => {
  assert.deepEqual(SCORING_BY_MODE.letter, ['geometric_ordered']);
  assert.deepEqual(SCORING_BY_MODE.connect_dots, ['sequence']);
});

// --- stroke geometry -------------------------------------------------------

test('stroke order must be contiguous from 1', () => {
  const pack = validPack();
  pack.levels[0].stroke_paths = [
    { id: 's1', order: 1, type: 'stroke', points: [[0, 0], [1, 1]] },
    { id: 's2', order: 5, type: 'stroke', points: [[0, 1], [1, 0]] },
  ];
  const result = validateGamePack(schema, pack, baseContext());
  assert.ok(result.errors.some((e) => /stroke order must run 1\.\.2/.test(e)));
});

test('a dot carries exactly one point and a stroke at least two', () => {
  const pack = validPack();
  pack.levels[0].stroke_paths = [
    { id: 's1', order: 1, type: 'dot', points: [[0.1, 0.1], [0.2, 0.2]] },
  ];
  assert.ok(validateGamePack(schema, pack, baseContext())
    .errors.some((e) => /is a dot and must carry exactly one point/.test(e)));

  const pack2 = validPack();
  pack2.levels[0].stroke_paths = [{ id: 's1', order: 1, type: 'stroke', points: [[0.1, 0.1]] }];
  assert.ok(validateGamePack(schema, pack2, baseContext())
    .errors.some((e) => /needs at least two points/.test(e)));
});

test('Arabic dots must be ordered after the letter body', () => {
  // The measured criterion of lang.letters.trace_form is body-before-dot.
  // Authoring it inverted would teach the opposite of the objective.
  const pack = validPack({ localization: 'language_specific' });
  pack.levels[0] = {
    level: 1,
    mode: 'letter',
    scoring: 'geometric_ordered',
    prompt_key: 'game.letter_tracing.baa.prompt',
    completion: { rule: 'all_strokes_complete' },
    language: 'ar',
    glyph: 'ب',
    letter_form: 'isolated',
    writing_direction: 'rtl',
    guide_audio: 'asset-vo-sound-baa',
    tolerance_dp: 24,
    coverage_required: 0.8,
    stroke_paths: [
      { id: 's1', order: 2, type: 'stroke', points: [[0.8, 0.45], [0.3, 0.45]] },
      { id: 's2', order: 1, type: 'dot', points: [[0.55, 0.78]] },
    ],
  };
  const result = validateGamePack(schema, pack, baseContext());
  assert.ok(result.errors.some((e) => /dots must be ordered after the letter body/.test(e)));
});

test('letter levels force a language_specific pack', () => {
  const pack = validPack({ localization: 'translatable' });
  pack.levels[0] = {
    level: 1,
    mode: 'letter',
    scoring: 'geometric_ordered',
    prompt_key: 'game.letter_tracing.alif.prompt',
    completion: { rule: 'all_strokes_complete' },
    language: 'ar',
    glyph: 'ا',
    letter_form: 'isolated',
    writing_direction: 'rtl',
    guide_audio: 'asset-vo-sound-alif',
    tolerance_dp: 24,
    coverage_required: 0.8,
    stroke_paths: [{ id: 's1', order: 1, type: 'stroke', points: [[0.5, 0.22], [0.5, 0.74]] }],
  };
  assert.ok(validateGamePack(schema, pack, baseContext())
    .errors.some((e) => /must declare localization "language_specific"/.test(e)));
});

// --- accessibility --------------------------------------------------------

test('simplified motor mode must be easier, never stricter', () => {
  const pack = validPack();
  pack.accessibility.simplified_motor = { tolerance_dp: 24, coverage_required: 0.9 };
  pack.levels[0].tolerance_dp = 32;
  pack.levels[0].coverage_required = 0.8;
  const result = validateGamePack(schema, pack, baseContext());
  assert.ok(result.errors.some((e) => /must be at least the level tolerance/.test(e)));
  assert.ok(result.errors.some((e) => /must not exceed the level requirement/.test(e)));
});

test('accessibility cannot be omitted and the tap alternative cannot be disabled', () => {
  const pack = validPack();
  delete pack.accessibility;
  assert.ok(validateGamePack(schema, pack, baseContext())
    .errors.some((e) => /missing required property "accessibility"/.test(e)));

  const pack2 = validPack();
  pack2.accessibility.sequential_tap_alternative = false;
  assert.ok(validateGamePack(schema, pack2, baseContext())
    .errors.some((e) => /must equal true/.test(e)));
});

// --- review gating --------------------------------------------------------

test('a letter pack cannot be published without an approved linguistic review', () => {
  const pack = validPack({
    localization: 'language_specific',
    review: { linguistic_review: { status: 'pending' } },
  });
  pack.levels[0] = {
    level: 1,
    mode: 'letter',
    scoring: 'geometric_ordered',
    prompt_key: 'game.letter_tracing.alif.prompt',
    completion: { rule: 'all_strokes_complete' },
    language: 'ar',
    glyph: 'ا',
    letter_form: 'isolated',
    writing_direction: 'rtl',
    guide_audio: 'asset-vo-sound-alif',
    tolerance_dp: 24,
    coverage_required: 0.8,
    stroke_paths: [{ id: 's1', order: 1, type: 'stroke', points: [[0.5, 0.22], [0.5, 0.74]] }],
  };

  const draft = validateGamePack(schema, pack, baseContext());
  assert.ok(draft.warnings.some((w) => /approved linguistic review/.test(w)));
  assert.deepEqual(draft.errors, []);

  const published = validateGamePack(schema, pack, baseContext({
    forPublish: true,
    knownAssetIds: new Set(),
    readyAssetIds: new Set(),
  }));
  assert.ok(published.errors.some((e) => /approved linguistic review/.test(e)));
});

// --- the packs actually shipped by migration 0023 --------------------------

/// Pulls the `content_pack = '...'` literals out of the migration so the shipped
/// data is under test, not just the validator.
function packsFromMigration() {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const matches = [...sql.matchAll(/content_pack = '([\s\S]*?)', updated_at/g)];
  return matches.map((match) => JSON.parse(match[1]));
}

test('migration 0023 ships two packs that parse and match their pack ids', () => {
  const packs = packsFromMigration();
  assert.equal(packs.length, 2);
  assert.deepEqual(packs.map((p) => p.pack_id), ['tc-luna-ep4', 'yt-pinch-place']);
});

test('the shipped ABJAD letter pack is schema-valid and carries real geometry', () => {
  const [letters] = packsFromMigration();
  const result = validateGamePack(schema, letters, baseContext({ ageMin: 3, ageMax: 5 }));
  assert.deepEqual(result.errors, []);

  assert.equal(letters.levels.length, 4);
  assert.deepEqual(letters.levels.map((l) => l.glyph), ['ا', 'ل', 'ب', 'ن']);

  // The coordinates the audit found stranded in Markdown are now in the pack.
  assert.deepEqual(letters.levels[0].stroke_paths[0].points, [[0.50, 0.22], [0.50, 0.74]]);
  assert.deepEqual(letters.levels[2].stroke_paths[1], {
    id: 's2', order: 2, type: 'dot', points: [[0.55, 0.78]],
  });

  // Every level is ordered-geometric and body-before-dot.
  for (const level of letters.levels) {
    assert.equal(level.scoring, 'geometric_ordered');
    assert.equal(level.tolerance_dp, 24);
    assert.equal(level.coverage_required, 0.8);
  }
});

test('the shipped MAHARAT path pack is schema-valid and narrows its tolerance', () => {
  const [, pinch] = packsFromMigration();
  const result = validateGamePack(schema, pinch, baseContext({
    supervisionLevel: 'required',
    safetyNotes: 'يحتاج وجود بالغ',
  }));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(pinch.levels.map((l) => l.tolerance_dp), [48, 42, 36]);
  assert.ok(pinch.levels.every((l) => l.scoring === 'geometric'));
});

test('neither shipped pack is publishable yet, and the reasons are the honest ones', () => {
  // Both games are `draft` in D1. This pins *why*: unproduced assets, and for
  // the Arabic pack an unapproved stroke-order review. If someone later marks
  // the review approved without a reviewer, this test still requires the assets.
  const [letters, pinch] = packsFromMigration();
  const ctx = baseContext({ forPublish: true, knownAssetIds: new Set(), readyAssetIds: new Set() });

  const lettersResult = validateGamePack(schema, letters, ctx);
  assert.ok(lettersResult.errors.some((e) => /approved linguistic review/.test(e)));
  assert.ok(lettersResult.errors.some((e) => /does not exist in content_assets/.test(e)));

  const pinchResult = validateGamePack(schema, pinch, {
    ...ctx, supervisionLevel: 'required', safetyNotes: 'يحتاج وجود بالغ',
  });
  assert.ok(pinchResult.errors.some((e) => /does not exist in content_assets/.test(e)));
  // Not a letter pack, so no linguistic review is demanded of it.
  assert.ok(!pinchResult.errors.some((e) => /linguistic review/.test(e)));
});

// --- the launch packs shipped by migration 0026 ----------------------------

const LAUNCH_MIGRATION_PATH = new URL('../migrations/0026_trace_color_launch_packs.sql', import.meta.url);

/// Pulls the pack literals out of the launch-pack migration, which embeds them in
/// INSERT statements rather than UPDATEs.
function launchPacks() {
  const sql = readFileSync(LAUNCH_MIGRATION_PATH, 'utf8');
  return [...sql.matchAll(/'(\{\s*\n\s*"pack_version"[\s\S]*?\n\})',/g)]
    .map((match) => JSON.parse(match[1]));
}

test('migration 0026 ships the two declared launch packs', () => {
  const packs = launchPacks();
  assert.deepEqual(
    packs.map((pack) => pack.pack_id).sort(),
    ['tc-numbers-1-10', 'tc-shapes-basic'],
  );
});

test('the shapes pack is valid and every level is a closed traceable shape', () => {
  const shapes = launchPacks().find((pack) => pack.pack_id === 'tc-shapes-basic');
  const result = validateGamePack(schema, shapes, baseContext({ ageMin: 3, ageMax: 5 }));
  assert.deepEqual(result.errors, []);
  assert.equal(shapes.levels.length, 3);

  for (const level of shapes.levels) {
    assert.equal(level.mode, 'shape');
    assert.equal(level.scoring, 'geometric');
    const points = level.stroke_paths[0].points;
    // Closed: the last point returns to the first, or the shape has a gap a child
    // would be asked to trace across empty space.
    assert.deepEqual(points[0], points[points.length - 1],
      `level ${level.level} must close`);
    // Inside the canvas with margin, so a 40dp visual path is not clipped.
    for (const [x, y] of points) {
      assert.ok(x >= 0.1 && x <= 0.9, `x ${x} within margin`);
      assert.ok(y >= 0.1 && y <= 0.9, `y ${y} within margin`);
    }
  }
});

test('the numbers pack is valid and multi-stroke digits are order-scored', () => {
  const numbers = launchPacks().find((pack) => pack.pack_id === 'tc-numbers-1-10');
  const result = validateGamePack(schema, numbers, baseContext({ ageMin: 4, ageMax: 5 }));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(numbers.levels.map((level) => level.glyph), ['1', '2', '3', '4', '5']);

  for (const level of numbers.levels) {
    // Drawing the crossbar of a 4 before its stem produces a shape that is not a
    // 4, so any multi-stroke digit must enforce order.
    const expected = level.stroke_paths.length > 1 ? 'geometric_ordered' : 'geometric';
    assert.equal(level.scoring, expected, `level ${level.level}`);
  }
});

test('the launch packs need no linguistic review and could be published once assets exist', () => {
  // The distinction that makes the review gate meaningful: a circle has no
  // correct starting point for an Arabic linguist to rule on, whereas a letter
  // does.
  for (const pack of launchPacks()) {
    assert.equal(pack.review.linguistic_review.status, 'not_required');
    // Every asset the pack names, not only the voice manifest: levels also carry
    // guide_audio and background/template references.
    const referenced = new Set(Object.values(pack.voice_manifest));
    for (const level of pack.levels) {
      if (level.guide_audio) referenced.add(level.guide_audio);
      if (level.background_asset) referenced.add(level.background_asset);
      if (level.coloring?.template_asset) referenced.add(level.coloring.template_asset);
    }
    const result = validateGamePack(schema, pack, baseContext({
      forPublish: true,
      ageMin: 3,
      ageMax: 5,
      knownAssetIds: referenced,
      readyAssetIds: referenced,
    }));
    assert.deepEqual(result.errors, [], `${pack.pack_id} should be publishable with ready assets`);
  }
});

test('a multi-stroke glyph cannot be scored without enforcing order', () => {
  // The inverse of allowing ordered scoring for numbers: once a glyph has more
  // than one stroke, order is not optional.
  const pack = validPack();
  pack.levels[0] = {
    level: 1,
    mode: 'number',
    scoring: 'geometric',
    prompt_key: 'game.numbers.four.prompt',
    completion: { rule: 'all_strokes_complete' },
    glyph: '4',
    guide_audio: 'asset-vo-number-four',
    tolerance_dp: 26,
    coverage_required: 0.8,
    stroke_paths: [
      { id: 's1', order: 1, type: 'stroke', points: [[0.6, 0.18], [0.34, 0.56]] },
      { id: 's2', order: 2, type: 'stroke', points: [[0.6, 0.36], [0.6, 0.82]] },
    ],
  };
  const result = validateGamePack(schema, pack, baseContext());
  assert.ok(result.errors.some((e) => /must use scoring "geometric_ordered"/.test(e)));
});

test('all four shipped packs share the same accessibility guarantees', () => {
  const all = [...packsFromMigration(), ...launchPacks()];
  assert.equal(all.length, 4);
  for (const pack of all) {
    assert.equal(pack.supports_dpad, false, `${pack.pack_id} must be pointer-only`);
    assert.equal(pack.accessibility.sequential_tap_alternative, true);
    const simplified = pack.accessibility.simplified_motor;
    for (const level of pack.levels) {
      if (level.tolerance_dp === undefined) continue;
      assert.ok(simplified.tolerance_dp >= level.tolerance_dp,
        `${pack.pack_id} level ${level.level}: simplified tolerance must not be stricter`);
      assert.ok(simplified.coverage_required <= level.coverage_required,
        `${pack.pack_id} level ${level.level}: simplified coverage must not be higher`);
    }
  }
});
