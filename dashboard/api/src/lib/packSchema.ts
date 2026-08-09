/// Turns a canonical *level* schema into a full *pack* schema.
///
/// ## Why this is composed rather than authored
///
/// `docs/games/schemas/` holds one schema per engine describing a **level**, plus
/// `content-pack.base.schema.json` describing the envelope every pack shares.
/// `trace_color` is the exception: its schema was already widened to cover the whole
/// pack when the runtime contract was built.
///
/// Writing eleven more pack schemas by hand would mean eleven copies of the
/// envelope, and the first time a mandatory voice key changed, ten of them would be
/// wrong. Composing means the envelope exists once and each engine contributes only
/// what is genuinely its own.
///
/// ## The `$defs` merge
///
/// A level schema keeps its `$defs` and refers to them as `#/$defs/...`. Lifting
/// them into the composed pack schema preserves those references without rewriting
/// them. Several engines define `assetId` and `i18nKey` identically to the
/// envelope; `test/packSchema.test.mjs` asserts that any name defined on both sides
/// is defined the *same* way, so a future divergence fails loudly instead of one
/// silently shadowing the other.

import type { Schema } from './jsonSchema.ts';

/// Keys that describe the level schema document itself rather than a level.
const DOCUMENT_KEYS = new Set(['$schema', '$id', 'title', '$defs']);

/// Envelope `$defs`, from `content-pack.base.schema.json`.
const ENVELOPE_DEFS: Record<string, Schema> = {
  assetId: {
    $comment: 'must exist in content_assets with status ready',
    type: 'string',
    pattern: '^[A-Za-z0-9_-]{3,128}$',
  },
  i18nKey: {
    $comment: 'a translation key, never readable text',
    type: 'string',
    pattern: '^[a-z][a-z0-9_]*(\\.[a-z0-9_]+)+$',
  },
};

/// The six voice keys every pack must carry, from the base schema.
export const BASE_REQUIRED_VOICE_KEYS = [
  'vo.intro',
  'vo.instruction',
  'vo.instruction_repeat',
  'vo.level_complete',
  'vo.game_complete',
  'vo.exit_confirm',
] as const;

export interface PackSchemaOptions {
  engineId: string;
  /// The parsed canonical level schema.
  levelSchema: Schema;
  /// Highest level count the engine's contract allows. All twelve ship five.
  maxLevels?: number;
}

/// Builds the pack schema for one engine.
export function buildPackSchema({
  engineId,
  levelSchema,
  maxLevels = 10,
}: PackSchemaOptions): Schema {
  const levelDefs = (levelSchema.$defs ?? {}) as Record<string, Schema>;

  // The level constraints, with the document-level keys stripped so the result can
  // be dropped straight into `levels.items`.
  const levelBody: Schema = {};
  for (const [key, value] of Object.entries(levelSchema)) {
    if (DOCUMENT_KEYS.has(key)) continue;
    levelBody[key] = value;
  }

  // Every engine's runtime carries `scoring` on the level, because the client reads
  // it to decide whether an attempt produces a mark at all. The canonical level
  // schemas predate that field and set `additionalProperties: false`, so it is
  // declared here rather than by editing twelve upstream documents.
  const properties = (levelBody.properties ?? {}) as Record<string, Schema>;
  levelBody.properties = {
    ...properties,
    scoring: {
      $comment: 'how the level contributes to score; validated against the engine',
      type: 'string',
      enum: ['geometric', 'geometric_ordered', 'sequence', 'discrete', 'none'],
    },
    mode: properties.mode ?? { type: 'string' },
  };

  return {
    $comment: `Composed from ${engineId}.v1.schema.json and content-pack.base.schema.json`,
    title: `${engineId} content pack v1`,
    type: 'object',
    additionalProperties: false,
    required: ['pack_version', 'engine_id', 'progression', 'levels', 'voice_manifest'],
    properties: {
      pack_version: { type: 'integer', minimum: 1 },
      engine_id: { type: 'string', const: engineId },
      pack_id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{2,63}$' },
      localization: {
        type: 'string',
        enum: ['translatable', 'language_neutral', 'language_specific'],
      },
      supports_dpad: { type: 'boolean' },
      supervision_level: { type: 'string', enum: ['none', 'recommended', 'required'] },
      translated_from: { type: ['string', 'null'] },
      progression: {
        type: 'object',
        required: ['levels_to_finish', 'advance_on'],
        additionalProperties: false,
        properties: {
          levels_to_finish: { type: 'integer', minimum: 1, maximum: maxLevels },
          advance_on: { type: 'string', enum: ['level_complete', 'manual'] },
        },
      },
      levels: {
        type: 'array',
        minItems: 1,
        maxItems: maxLevels,
        items: levelBody,
      },
      assets: {
        type: 'object',
        additionalProperties: false,
        properties: {
          images: { type: 'array', items: { $ref: '#/$defs/assetId' } },
          audio: { type: 'array', items: { $ref: '#/$defs/assetId' } },
        },
      },
      voice_manifest: {
        type: 'object',
        required: [...BASE_REQUIRED_VOICE_KEYS],
        // `vo.count.7` and `vo.block.turn_left` are both legal shapes.
        patternProperties: {
          '^vo\\.[a-z_]+(\\.[A-Za-z0-9_-]+)?$': { $ref: '#/$defs/assetId' },
        },
        additionalProperties: false,
      },
      accessibility: {
        type: 'object',
        additionalProperties: false,
        properties: {
          min_touch_target_dp: { type: 'number', minimum: 48, maximum: 96 },
          sequential_tap_alternative: { type: 'boolean' },
          reduced_motion_supported: { type: 'boolean' },
          repeat_instructions_button: { type: 'boolean', const: true },
          simplified_motor: {
            type: 'object',
            additionalProperties: false,
            properties: {
              tolerance_dp: { type: 'number' },
              coverage_required: { type: 'number' },
              lanes: { type: 'integer', minimum: 1, maximum: 3 },
              hit_window_ms: { type: 'integer', minimum: 250, maximum: 600 },
            },
          },
        },
      },
      review: {
        type: 'object',
        additionalProperties: false,
        properties: {
          linguistic_review: { $ref: '#/$defs/reviewRecord' },
          scientific_review: { $ref: '#/$defs/reviewRecord' },
          historical_review: { $ref: '#/$defs/reviewRecord' },
          music_rights: { $ref: '#/$defs/reviewRecord' },
        },
      },
    },
    $defs: {
      ...ENVELOPE_DEFS,
      reviewRecord: {
        type: 'object',
        required: ['status'],
        additionalProperties: false,
        properties: {
          status: { type: 'string', enum: ['not_required', 'pending', 'approved', 'rejected'] },
          reviewer: { type: ['string', 'null'] },
          reviewed_at: { type: ['string', 'null'] },
          note: { type: ['string', 'null'] },
        },
      },
      // Level defs last so an engine's own definition wins, and the test asserts
      // that a shared name is defined identically on both sides.
      ...levelDefs,
    },
  };
}

/// Names defined by both the envelope and a level schema.
///
/// Exported for the drift test rather than used at runtime.
export function overlappingDefNames(levelSchema: Schema): string[] {
  const levelDefs = Object.keys((levelSchema.$defs ?? {}) as Record<string, unknown>);
  return levelDefs.filter((name) => name in ENVELOPE_DEFS);
}

export function envelopeDef(name: string): Schema | undefined {
  return ENVELOPE_DEFS[name];
}
