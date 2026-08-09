/// The D1-aware wrapper around [validateGamePack].
///
/// `lib/gamePackValidation.ts` is deliberately pure so it can be unit tested
/// without a database. This module supplies the parts that require queries — the
/// engine's declared mechanics, whether the game names a learning objective, and
/// which assets actually exist and are `ready` — and is the single gate both
/// `POST /admin/games` and `PATCH /admin/games/:id` call, so the two paths cannot
/// enforce different rules.
///
/// All twelve engines now have a runtime schema. `trace_color`'s was authored as a
/// whole-pack document; the other eleven are composed by [buildPackSchema] from the
/// canonical level schema plus the shared envelope, so the envelope exists once.

import { queryAll, queryFirst } from './db.ts';
import { validateGamePack, type PackValidationResult } from './gamePackValidation.ts';
import { buildPackSchema } from './packSchema.ts';
import traceColorV1 from '../schemas/trace_color.v1.schema.json' with { type: 'json' };
import matchPairsV1 from '../schemas/match_pairs.v1.schema.json' with { type: 'json' };
import sortBinsV1 from '../schemas/sort_bins.v1.schema.json' with { type: 'json' };
import memoryFlipV1 from '../schemas/memory_flip.v1.schema.json' with { type: 'json' };
import sequenceOrderV1 from '../schemas/sequence_order.v1.schema.json' with { type: 'json' };
import countQuantityV1 from '../schemas/count_quantity.v1.schema.json' with { type: 'json' };
import logicPatternV1 from '../schemas/logic_pattern.v1.schema.json' with { type: 'json' };
import wordBuildV1 from '../schemas/word_build.v1.schema.json' with { type: 'json' };
import rhythmTapV1 from '../schemas/rhythm_tap.v1.schema.json' with { type: 'json' };
import blockCodeV1 from '../schemas/block_code.v1.schema.json' with { type: 'json' };
import simLabV1 from '../schemas/sim_lab.v1.schema.json' with { type: 'json' };
import timelineMapV1 from '../schemas/timeline_map.v1.schema.json' with { type: 'json' };

type RawSchema = Record<string, unknown>;

const LEVEL_SCHEMAS: Record<string, RawSchema> = {
  match_pairs: matchPairsV1 as unknown as RawSchema,
  sort_bins: sortBinsV1 as unknown as RawSchema,
  memory_flip: memoryFlipV1 as unknown as RawSchema,
  sequence_order: sequenceOrderV1 as unknown as RawSchema,
  count_quantity: countQuantityV1 as unknown as RawSchema,
  logic_pattern: logicPatternV1 as unknown as RawSchema,
  word_build: wordBuildV1 as unknown as RawSchema,
  rhythm_tap: rhythmTapV1 as unknown as RawSchema,
  block_code: blockCodeV1 as unknown as RawSchema,
  sim_lab: simLabV1 as unknown as RawSchema,
  timeline_map: timelineMapV1 as unknown as RawSchema,
};

/// Engine id -> parsed runtime pack schema.
///
/// Built once at module scope. Composing on every request would re-walk twelve
/// schema documents inside the request path for no benefit.
export const ENGINE_SCHEMAS: Record<string, RawSchema> = {
  trace_color: traceColorV1 as unknown as RawSchema,
  ...Object.fromEntries(
    Object.entries(LEVEL_SCHEMAS).map(([engineId, levelSchema]) => [
      engineId,
      buildPackSchema({ engineId, levelSchema }) as RawSchema,
    ]),
  ),
};

export function hasRuntimeSchema(engineId: string): boolean {
  return engineId in ENGINE_SCHEMAS;
}

/// Every engine with a validated contract, for the readiness report and the CMS.
export function enginesWithRuntimeSchema(): string[] {
  return Object.keys(ENGINE_SCHEMAS).sort();
}

export interface GameRowForValidation {
  engine_id: string;
  age_min: number;
  age_max: number;
  supervision_level: string;
  safety_notes: string | null;
  translated_from?: string | null;
  learning_objective_id?: string | null;
}

export interface GatedPackResult extends PackValidationResult {
  /// False when no runtime schema exists for the engine, so callers can tell
  /// "passed validation" apart from "was never validated".
  validated: boolean;
}

/// Collects every asset id a pack references, mirroring the traversal in
/// [validateGamePack] so the existence lookup and the validation agree.
function referencedAssetIds(pack: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const add = (value: unknown) => { if (typeof value === 'string' && value) ids.add(value); };
  const isObject = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);

  const voice = isObject(pack.voice_manifest) ? pack.voice_manifest : {};
  for (const value of Object.values(voice)) add(value);

  const assets = isObject(pack.assets) ? pack.assets : {};
  for (const key of ['images', 'audio']) {
    const list = assets[key];
    if (Array.isArray(list)) for (const value of list) add(value);
  }

  const levels = Array.isArray(pack.levels) ? pack.levels : [];
  for (const level of levels) {
    if (!isObject(level)) continue;
    add(level.guide_audio);
    add(level.background_asset);
    const coloring = isObject(level.coloring) ? level.coloring : null;
    if (coloring) add(coloring.template_asset);

    // The other engines name their artwork and audio in their own level fields.
    // Missing one here would let a pack publish referencing an asset that does not
    // exist, which is the failure mode rule 3 exists to prevent.
    add(level.track);          // rhythm_tap
    add(level.word_audio);     // word_build
    add(level.word_syllables_audio);
    add(level.word_image);
    add(level.answer);         // logic_pattern options are asset ids
    for (const key of ['options', 'sequence']) {
      const list = level[key];
      if (Array.isArray(list)) for (const value of list) add(value);
    }
    const grid = level.grid;
    if (Array.isArray(grid)) for (const row of grid) {
      if (Array.isArray(row)) for (const cell of row) add(cell);
    }
    for (const key of ['letters', 'distractors']) {
      const list = level[key];
      if (Array.isArray(list)) {
        for (const entry of list) if (isObject(entry)) add(entry.audio);
      }
    }
    for (const key of ['items', 'events', 'pairs']) {
      const list = level[key];
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        if (!isObject(entry)) continue;
        add(entry.image);
        add(entry.a);
        add(entry.b);
        for (const setKey of ['set_a', 'set_b']) {
          const set = entry[setKey];
          if (isObject(set)) add(set.image);
        }
        const nested = entry.items;
        if (Array.isArray(nested)) {
          for (const item of nested) if (isObject(item)) add(item.image);
        }
      }
    }
  }

  return [...ids];
}

/// The limits an engine declares about itself, parsed from `game_engines.mechanics`.
///
/// Extracted so a batched caller — the production queues and the operations
/// overview read every engine's mechanics in one query — derives the same numbers
/// this gate does. Two copies of the parse would eventually disagree about the
/// on-screen budget, and the disagreement would show up as a pack that publishes
/// through one path and fails through another.
export interface EngineLimits {
  /// Falls back to 3, the conservative `trace_color` budget, when the column is
  /// malformed. A too-small budget rejects a legal pack loudly; a too-large one
  /// admits an illegal pack silently, and the loud failure is the safe one.
  maxElements: number;
  engineVersion: number;
}

export function parseEngineLimits(mechanics: string | null | undefined): EngineLimits {
  let maxElements = 3;
  let engineVersion = 1;
  try {
    const parsed = JSON.parse(mechanics ?? '{}') as Record<string, unknown>;
    const declared = Number(parsed.max_elements_on_screen);
    if (Number.isFinite(declared) && declared > 0) maxElements = declared;
    const version = Number(parsed.engine_version);
    if (Number.isFinite(version) && version > 0) engineVersion = version;
  } catch { /* malformed mechanics; the conservative defaults stand. */ }
  return { maxElements, engineVersion };
}

/// Validates a game's pack against its engine contract.
///
/// `forPublish` must be true for any transition into a release status. When it
/// is, unresolved assets and pending human review become errors rather than
/// warnings, so publish fails closed.
export async function validatePackForGame(
  db: D1Database,
  game: GameRowForValidation,
  packJson: string,
  forPublish: boolean,
): Promise<GatedPackResult> {
  const schema = ENGINE_SCHEMAS[game.engine_id];
  if (!schema) return { validated: false, errors: [], warnings: [] };

  let pack: unknown;
  try {
    pack = JSON.parse(packJson);
  } catch {
    return { validated: true, errors: ['content_pack is not valid JSON'], warnings: [] };
  }

  // The engine declares its own limits; reading them here keeps the budget in
  // one place instead of hard-coding 3 for trace_color.
  const engine = await queryFirst<{ mechanics: string | null }>(
    db, 'SELECT mechanics FROM game_engines WHERE id = ?', [game.engine_id],
  );
  const { maxElements, engineVersion } = parseEngineLimits(engine?.mechanics);

  // Only look up the assets the pack actually names. An empty pack references
  // nothing and needs no query at all.
  const referenced = referencedAssetIds(pack as Record<string, unknown>);
  let knownAssetIds: Set<string> | undefined;
  let readyAssetIds: Set<string> | undefined;
  if (referenced.length) {
    const placeholders = referenced.map(() => '?').join(', ');
    const rows = await queryAll<{ id: string; status: string }>(
      db, `SELECT id, status FROM content_assets WHERE id IN (${placeholders})`, referenced,
    );
    knownAssetIds = new Set(rows.map((row) => row.id));
    readyAssetIds = new Set(rows.filter((row) => row.status === 'ready').map((row) => row.id));
  }

  const result = validateGamePack(schema, pack, {
    engineId: game.engine_id,
    ageMin: Number(game.age_min),
    ageMax: Number(game.age_max),
    supervisionLevel: String(game.supervision_level),
    safetyNotes: game.safety_notes ?? null,
    translatedFrom: game.translated_from ?? null,
    hasLearningObjective: Boolean(game.learning_objective_id),
    supportedEngineVersion: engineVersion,
    maxElementsOnScreen: maxElements,
    knownAssetIds,
    readyAssetIds,
    forPublish,
  });

  return { validated: true, ...result };
}
