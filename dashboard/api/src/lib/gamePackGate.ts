/// The D1-aware wrapper around [validateGamePack].
///
/// `lib/gamePackValidation.ts` is deliberately pure so it can be unit tested
/// without a database. This module supplies the parts that require queries — the
/// engine's declared mechanics and which assets actually exist and are `ready` —
/// and is the single gate both `POST /admin/games` and `PATCH /admin/games/:id`
/// call, so the two paths cannot enforce different rules.
///
/// Engines other than `trace_color` have no runtime schema yet. Rather than
/// invent one, they are passed through untouched: this module never blocks a
/// pack it has no contract for, and says so explicitly via `validated: false`.

import { queryAll, queryFirst } from './db.ts';
import { validateGamePack, type PackValidationResult } from './gamePackValidation.ts';
import traceColorV1 from '../schemas/trace_color.v1.schema.json' with { type: 'json' };

/// Engine id -> parsed runtime schema. Adding an engine here is what turns its
/// packs from unchecked JSON into a validated contract.
const ENGINE_SCHEMAS: Record<string, Record<string, unknown>> = {
  trace_color: traceColorV1 as unknown as Record<string, unknown>,
};

export function hasRuntimeSchema(engineId: string): boolean {
  return engineId in ENGINE_SCHEMAS;
}

export interface GameRowForValidation {
  engine_id: string;
  age_min: number;
  age_max: number;
  supervision_level: string;
  safety_notes: string | null;
  translated_from?: string | null;
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
  }

  return [...ids];
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
  let maxElements = 3;
  let engineVersion = 1;
  try {
    const mechanics = JSON.parse(engine?.mechanics ?? '{}') as Record<string, unknown>;
    const declared = Number(mechanics.max_elements_on_screen);
    if (Number.isFinite(declared) && declared > 0) maxElements = declared;
    const version = Number(mechanics.engine_version);
    if (Number.isFinite(version) && version > 0) engineVersion = version;
  } catch { /* mechanics is malformed; the conservative defaults stand. */ }

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
    supportedEngineVersion: engineVersion,
    maxElementsOnScreen: maxElements,
    knownAssetIds,
    readyAssetIds,
    forPublish,
  });

  return { validated: true, ...result };
}
