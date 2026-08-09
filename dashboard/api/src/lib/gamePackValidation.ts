/// Server-side validation for `games.content_pack`.
///
/// ## The defect this closes
///
/// `docs/games/02-data-contract.md` lists twelve mandatory rules and states the
/// server rejects a pack on any breach, with "لا يُعتمد على تحقق الواجهة إطلاقًا"
/// — never trust client validation. None of it was implemented. The only check
/// in the codebase was `lib/catalogueValidation.ts`, which asserted the pack was
/// a non-empty object before release. A pack could therefore be published with
/// levels numbered 3, 7, 7, no stroke geometry, audio keys pointing at assets
/// that do not exist, and a colouring stage that claimed to score the child's
/// artwork.
///
/// ## Draft versus publish
///
/// Authoring is iterative, so a draft is allowed to be incomplete: missing
/// artwork, unrecorded voice-over, a pending linguistic review. What a draft may
/// never be is *malformed* — a level numbered 0, or a scoring mode that grades
/// free expression, is a defect at any status.
///
/// Publish fails closed: every asset must exist and be `ready`, every mandatory
/// voice key must be present, and a language-specific letter pack must carry an
/// approved linguistic review. Anything unresolved is an error, never a warning.
///
/// The split is expressed as `errors` (block the requested transition) and
/// `warnings` (surface in the CMS, do not block a draft save).

import { engineContract, REVIEW_OWNERS } from './engineContracts.ts';
import { validateEngineRules } from './enginePackRules.ts';
import { validateAgainstSchema, type Schema } from './jsonSchema.ts';

export interface PackValidationContext {
  /// `games.engine_id`. Rule 6: the pack must agree with the row.
  engineId: string;
  ageMin: number;
  ageMax: number;
  supervisionLevel: string;
  safetyNotes: string | null;
  /// `games.translated_from` where present. Rule 10: a `language_specific` pack
  /// must not be a translation of another pack.
  translatedFrom?: string | null;
  /// Whether the game row names a learning objective. Engines that write no
  /// mastery must not have one.
  hasLearningObjective?: boolean;
  /// Highest `pack_version` this deployment can run. Rule 7.
  supportedEngineVersion: number;
  /// `game_engines.mechanics.max_elements_on_screen`. Rule 4.
  maxElementsOnScreen: number;
  /// Asset ids that exist in `content_assets`.
  knownAssetIds?: ReadonlySet<string>;
  /// Asset ids that exist *and* are `status = 'ready'`. Rule 3.
  readyAssetIds?: ReadonlySet<string>;
  /// True when validating a publish transition rather than a draft save.
  forPublish: boolean;
}

export interface PackValidationResult {
  errors: string[];
  warnings: string[];
}

/// Which scoring modes are honest for each drawing mode.
///
/// This table is the enforcement point for a pedagogical rule that would
/// otherwise live only in prose: Majarra has no image recognition of any kind,
/// so a mode with nothing objective to measure may not claim a score. The
/// engine contract already states colouring has "لا شرط فوز إطلاقًا" and is
/// excluded from `score`; encoding it here means an editor cannot re-enable it
/// from the CMS.
export const SCORING_BY_MODE: Record<string, readonly string[]> = {
  // Geometry is objective: coverage of a known path and deviation from it.
  line: ['geometric'],
  curve: ['geometric'],
  path: ['geometric'],
  // Shapes and numerals may be multi-stroke, and then the order is real: the
  // crossbar of a `4` drawn before its stem produces a shape that is not a 4.
  shape: ['geometric', 'geometric_ordered'],
  number: ['geometric', 'geometric_ordered'],
  // Letters additionally require correct stroke order, which is the whole
  // pedagogical point: body before dots.
  letter: ['geometric_ordered'],
  // Tap order is discrete and binary — the cleanest thing to measure.
  connect_dots: ['sequence'],
  // Only scoreable when the pattern is discretised into cells or stamps.
  copy_pattern: ['discrete', 'none'],
  // Symmetry completion against a template is measurable; open-ended is not.
  complete_drawing: ['geometric', 'none'],
  // Free expression. Never scored.
  coloring: ['none'],
  free_draw: ['none'],
  draw_from_prompt: ['none'],
};

/// Modes that produce a child artefact rather than a measurement.
export const CREATION_MODES: readonly string[] = [
  'coloring', 'free_draw', 'draw_from_prompt', 'complete_drawing', 'copy_pattern',
];

/// Modes whose levels carry traceable geometry.
export const GEOMETRIC_MODES: readonly string[] = [
  'line', 'curve', 'path', 'shape', 'number', 'letter', 'copy_pattern',
];

const BASE_VOICE_KEYS = [
  'vo.intro', 'vo.instruction', 'vo.instruction_repeat',
  'vo.level_complete', 'vo.game_complete', 'vo.exit_confirm',
];

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/// Validates a `trace_color` pack against its schema plus the mandatory rules.
///
/// `schema` is the parsed canonical schema document, passed in rather than
/// imported so this module stays free of bundler-specific import syntax and can
/// be unit tested directly.
export function validateGamePack(
  schema: Schema,
  pack: unknown,
  ctx: PackValidationContext,
): PackValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // An empty pack is the initial state of a newly created game. It is a legal
  // draft and an illegal publish; `catalogueValidation.releaseError` already
  // says so for the release path and this keeps the two consistent.
  if (isObject(pack) && Object.keys(pack).length === 0) {
    if (ctx.forPublish) errors.push('content_pack must be authored before publish');
    return { errors, warnings };
  }

  if (!isObject(pack)) {
    errors.push('content_pack must be a JSON object');
    return { errors, warnings };
  }

  // Rule 6 — the pack and the row must name the same engine. Checked before the
  // schema so a pack pasted into the wrong game gives a comprehensible error
  // rather than a wall of const mismatches.
  if (typeof pack.engine_id === 'string' && pack.engine_id !== ctx.engineId) {
    errors.push(`content_pack.engine_id "${pack.engine_id}" does not match the game's engine "${ctx.engineId}"`);
    return { errors, warnings };
  }

  errors.push(...validateAgainstSchema(schema, pack));
  // Structural failures make the semantic rules meaningless: reporting that
  // level 1 has bad stroke order when `levels` is not even an array is noise.
  if (errors.length) return { errors, warnings };

  // Rule 7 — a pack from the future cannot be run.
  const packVersion = Number(pack.pack_version);
  if (packVersion > ctx.supportedEngineVersion) {
    errors.push(`pack_version ${packVersion} exceeds the supported engine_version ${ctx.supportedEngineVersion}`);
  }

  // Rule 9 — age bounds. Enforced here as well as by the D1 CHECK so a bad pack
  // is reported alongside its siblings instead of surfacing as a 500.
  if (!Number.isInteger(ctx.ageMin) || !Number.isInteger(ctx.ageMax) || ctx.ageMin > ctx.ageMax) {
    errors.push('age_min must be less than or equal to age_max');
  }
  if (ctx.ageMin < 3 || ctx.ageMax > 12) {
    errors.push('age_min and age_max must fall between 3 and 12');
  }

  const levels = asArray(pack.levels).filter(isObject);

  // Rules 1 and 2 — level numbers contiguous from 1. A gap silently strands
  // every level after it, because progression advances by number.
  const numbers = levels.map((level) => Number(level.level));
  numbers.forEach((value, index) => {
    if (value !== index + 1) {
      errors.push(`levels[${index}].level is ${value}; level numbers must run 1..${levels.length} without gaps or repeats`);
    }
  });

  const progression = isObject(pack.progression) ? pack.progression : {};
  const toFinish = Number(progression.levels_to_finish);
  if (Number.isFinite(toFinish) && toFinish > levels.length) {
    errors.push(`progression.levels_to_finish (${toFinish}) exceeds the ${levels.length} level(s) in the pack`);
  }

  // Whether the engine is playable without a pointer is the engine's own property,
  // not the pack's opinion of itself. A pack claiming D-pad support for a pointer
  // engine would be offered on television and then be unplayable; a pack denying it
  // for a board engine would hide working content from every TV household.
  const contract = engineContract(ctx.engineId);
  if (contract && typeof pack.supports_dpad === 'boolean'
    && pack.supports_dpad !== contract.supportsDpad) {
    errors.push(
      contract.supportsDpad
        ? `${ctx.engineId} is playable with a D-pad; supports_dpad must be true`
        : `${ctx.engineId} requires a pointer; supports_dpad must be false`,
    );
  }

  // The language class is declared by the engine contract, where the engine fixes
  // one. An editor may not reclassify a language-specific engine as translatable,
  // which is what would permit machine translation of Arabic letter forms.
  // `trace_color` fixes none, because shapes and letters differ; its letter levels
  // are covered by the rule below instead.
  if (contract?.languageClass && typeof pack.localization === 'string'
    && pack.localization !== contract.languageClass) {
    errors.push(
      `${ctx.engineId} is "${contract.languageClass}"; content_pack.localization `
      + `"${pack.localization}" contradicts the engine contract`,
    );
  }

  // Engines the mastery document lists as entertainment-first must not carry a
  // learning objective, because an objective is what a mastery row attaches to.
  // This is how "لا تُكتب mastery" is enforced without the engine understating its
  // score.
  if (contract && !contract.writesMastery && ctx.hasLearningObjective === true) {
    errors.push(
      `${ctx.engineId} is entertainment-first and writes no mastery; `
      + 'it must not have a learning objective',
    );
  }

  // Rule 12 — supervised activities must say why.
  const packSupervision = typeof pack.supervision_level === 'string' ? pack.supervision_level : null;
  if (packSupervision && packSupervision !== ctx.supervisionLevel) {
    errors.push(`content_pack.supervision_level "${packSupervision}" does not match the game's "${ctx.supervisionLevel}"`);
  }
  if ((packSupervision ?? ctx.supervisionLevel) === 'required' && !ctx.safetyNotes?.trim()) {
    errors.push('supervision_level "required" needs non-empty safety_notes');
  }

  // Rule 10 — a language-specific pack is authored per language, never derived.
  const localization = typeof pack.localization === 'string' ? pack.localization : null;
  // `mode: "letter"` is a trace_color level shape. Other engines have their own
  // level vocabularies, so this must not be inferred across engines.
  const isTraceColor = ctx.engineId === 'trace_color';
  const hasLetterLevel = isTraceColor && levels.some((level) => level.mode === 'letter');
  if (localization === 'language_specific' && ctx.translatedFrom) {
    errors.push('a language_specific pack must not be a translation (translated_from must be null)');
  }
  if (hasLetterLevel && localization !== 'language_specific') {
    errors.push('a pack containing letter levels must declare localization "language_specific"');
  }

  const accessibility = isObject(pack.accessibility) ? pack.accessibility : {};
  const simplified = isObject(accessibility.simplified_motor) ? accessibility.simplified_motor : {};

  // Per-level rules.
  const seenLevelIds = new Set<number>();
  for (const level of levels) {
    const index = Number(level.level);
    const label = `level ${index}`;
    if (seenLevelIds.has(index)) errors.push(`${label}: duplicated level number`);
    seenLevelIds.add(index);

    const mode = String(level.mode);
    const scoring = String(level.scoring);
    const allowed = SCORING_BY_MODE[mode];
    if (allowed && !allowed.includes(scoring)) {
      // The message names the pedagogy, not just the enum, because this is the
      // rule an editor is most likely to try to work around.
      errors.push(
        `${label}: mode "${mode}" may only use scoring ${allowed.map((s) => `"${s}"`).join(' or ')}, not "${scoring}". `
        + (CREATION_MODES.includes(mode) && scoring !== 'none'
          ? 'Free expression is never graded and Majarra has no image recognition.'
          : 'Scoring must match what the mode can objectively measure.'),
      );
    }

    const strokes = asArray(level.stroke_paths).filter(isObject);
    const dots = asArray(level.dots).filter(isObject);

    // Rule 4 — on-screen element budget.
    const elements = strokes.length + dots.length;
    if (elements > ctx.maxElementsOnScreen) {
      errors.push(`${label}: ${elements} element(s) exceeds max_elements_on_screen ${ctx.maxElementsOnScreen}`);
    }

    if (strokes.length) {
      // Stroke order must be contiguous from 1: the engine walks it, and a gap
      // would leave a stroke permanently unreachable.
      const orders = strokes.map((stroke) => Number(stroke.order)).sort((a, b) => a - b);
      orders.forEach((value, position) => {
        if (value !== position + 1) {
          errors.push(`${label}: stroke order must run 1..${strokes.length} without gaps, found ${orders.join(',')}`);
        }
      });

      const ids = strokes.map((stroke) => String(stroke.id));
      if (new Set(ids).size !== ids.length) errors.push(`${label}: duplicate stroke id`);

      // A dot is a single tapped point; more than one point means it was
      // authored as a drag and the child could never satisfy it.
      for (const stroke of strokes) {
        if (stroke.type === 'dot' && asArray(stroke.points).length !== 1) {
          errors.push(`${label}: stroke "${stroke.id}" is a dot and must carry exactly one point`);
        }
        if (stroke.type !== 'dot' && asArray(stroke.points).length < 2) {
          errors.push(`${label}: stroke "${stroke.id}" needs at least two points to be traceable`);
        }
      }

      // Arabic letters: the body is drawn before the diacritic dots. This is
      // the measured criterion of `lang.letters.trace_form`, so authoring it
      // the wrong way round would silently invert what the game teaches.
      if (mode === 'letter') {
        const maxBody = Math.max(...strokes.filter((s) => s.type !== 'dot').map((s) => Number(s.order)), 0);
        const minDot = Math.min(...strokes.filter((s) => s.type === 'dot').map((s) => Number(s.order)), Infinity);
        if (Number.isFinite(minDot) && minDot < maxBody) {
          errors.push(`${label}: dots must be ordered after the letter body (body order ${maxBody}, dot order ${minDot})`);
        }
      }

      // A glyph drawn in more than one stroke has a correct order, and scoring it
      // without enforcing that order would accept a shape that is not the glyph.
      // The inverse of the rule above: not just "ordered is allowed" but "ordered
      // is required once order exists".
      if ((mode === 'letter' || mode === 'number') && strokes.length > 1
        && scoring !== 'geometric_ordered') {
        errors.push(
          `${label}: "${mode}" with ${strokes.length} strokes must use scoring "geometric_ordered"; `
          + 'drawing the strokes in the wrong order produces a different glyph.',
        );
      }
    }

    if (dots.length) {
      const orders = dots.map((dot) => Number(dot.order)).sort((a, b) => a - b);
      orders.forEach((value, position) => {
        if (value !== position + 1) {
          errors.push(`${label}: connect_dots order must run 1..${dots.length} without gaps`);
        }
      });
    }

    // Simplified motor mode must genuinely be easier. A stricter "accessible"
    // setting would be worse than having none, because it would be presented to
    // the children least able to meet it.
    const tolerance = Number(level.tolerance_dp);
    const coverage = Number(level.coverage_required);
    if (Number.isFinite(tolerance) && Number.isFinite(Number(simplified.tolerance_dp))
      && Number(simplified.tolerance_dp) < tolerance) {
      errors.push(`${label}: accessibility.simplified_motor.tolerance_dp (${simplified.tolerance_dp}) must be at least the level tolerance (${tolerance})`);
    }
    if (Number.isFinite(coverage) && Number.isFinite(Number(simplified.coverage_required))
      && Number(simplified.coverage_required) > coverage) {
      errors.push(`${label}: accessibility.simplified_motor.coverage_required (${simplified.coverage_required}) must not exceed the level requirement (${coverage})`);
    }

    // Completion rule must be satisfiable by the level's own data.
    const completion = isObject(level.completion) ? level.completion : {};
    if (completion.rule === 'all_strokes_complete' && !strokes.length) {
      errors.push(`${label}: completion rule "all_strokes_complete" needs stroke_paths`);
    }
    if (completion.rule === 'all_dots_connected' && !dots.length) {
      errors.push(`${label}: completion rule "all_dots_connected" needs dots`);
    }
    if (CREATION_MODES.includes(mode) && scoring === 'none' && completion.rule !== 'child_taps_done') {
      errors.push(`${label}: unscored mode "${mode}" must complete on "child_taps_done" so the child decides when it is finished`);
    }

    const coloring = isObject(level.coloring) ? level.coloring : null;
    if (coloring?.enabled === true && ctx.forPublish) {
      const palette = asArray(coloring.palette);
      if (!palette.length) errors.push(`${label}: colouring is enabled but no palette is defined`);
    }
  }

  // Rule 5 — mandatory voice keys.
  const voice = isObject(pack.voice_manifest) ? pack.voice_manifest : {};
  const requiredVoice = [...BASE_VOICE_KEYS];
  if (levels.some((level) => asArray(level.stroke_paths).length > 0)) requiredVoice.push('vo.stroke_complete');
  if (levels.some((level) => isObject(level.coloring) && level.coloring.enabled === true)) {
    requiredVoice.push('vo.coloring_intro');
  }
  for (const key of requiredVoice) {
    if (typeof voice[key] !== 'string' || !voice[key]) {
      const message = `voice_manifest is missing the required key "${key}"`;
      if (ctx.forPublish) errors.push(message); else warnings.push(message);
    }
  }

  // Rule 3 — every referenced asset must exist and be ready before publish.
  const referenced = new Set<string>();
  for (const value of Object.values(voice)) if (typeof value === 'string') referenced.add(value);
  for (const value of asArray((isObject(pack.assets) ? pack.assets : {}).images)) {
    if (typeof value === 'string') referenced.add(value);
  }
  for (const value of asArray((isObject(pack.assets) ? pack.assets : {}).audio)) {
    if (typeof value === 'string') referenced.add(value);
  }
  for (const level of levels) {
    for (const key of ['guide_audio', 'background_asset']) {
      if (typeof level[key] === 'string') referenced.add(level[key] as string);
    }
    const coloring = isObject(level.coloring) ? level.coloring : null;
    if (typeof coloring?.template_asset === 'string') referenced.add(coloring.template_asset);
  }

  if (ctx.readyAssetIds || ctx.knownAssetIds) {
    for (const assetId of [...referenced].sort()) {
      const known = ctx.knownAssetIds?.has(assetId) ?? true;
      const ready = ctx.readyAssetIds?.has(assetId) ?? false;
      if (!known) {
        const message = `asset "${assetId}" does not exist in content_assets`;
        if (ctx.forPublish) errors.push(message); else warnings.push(message);
      } else if (!ready) {
        const message = `asset "${assetId}" is not status "ready"`;
        if (ctx.forPublish) errors.push(message); else warnings.push(message);
      }
    }
  }

  // Human review. Arabic stroke order is a linguistic judgement, so the pack
  // may not be published on the strength of an engineer's guess.
  const review = isObject(pack.review) ? pack.review : {};
  const linguistic = isObject(review.linguistic_review) ? review.linguistic_review : null;
  if (hasLetterLevel) {
    const status = linguistic?.status ?? 'pending';
    if (status !== 'approved') {
      const message = `letter packs need an approved linguistic review of stroke order (status: ${status})`;
      if (ctx.forPublish) errors.push(message); else warnings.push(message);
    }
  }

  // The review each engine's contract makes mandatory. Engineering cannot satisfy
  // any of these, which is exactly why they are checked rather than remembered:
  // a science simulation, a historical timeline, an Arabic word pack and licensed
  // music each need a named human to sign off before a child sees them.
  const requiredReview = contract?.requiredReview;
  if (requiredReview && !(isTraceColor && requiredReview === 'linguistic_review')) {
    const record = isObject(review[requiredReview]) ? review[requiredReview] : null;
    const status = typeof record?.status === 'string' ? record.status : 'pending';
    if (status !== 'approved') {
      const message =
        `${ctx.engineId} packs need an approved ${requiredReview.replace('_', ' ')} `
        + `by ${REVIEW_OWNERS[requiredReview] ?? 'a reviewer'} (status: ${status})`;
      if (ctx.forPublish) errors.push(message); else warnings.push(message);
    }
  }

  // Engine-specific semantics: the rules a JSON Schema cannot state, such as an
  // answer that must equal the number of elements actually on screen, or a
  // reference solution that must genuinely reach the goal.
  const engineRules = validateEngineRules(ctx.engineId, pack, {
    ageMin: ctx.ageMin,
    ageMax: ctx.ageMax,
    forPublish: ctx.forPublish,
    hasLearningObjective: ctx.hasLearningObjective,
  });
  errors.push(...engineRules.errors);
  warnings.push(...engineRules.warnings);

  return { errors, warnings };
}
