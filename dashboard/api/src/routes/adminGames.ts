/// Admin endpoints for drawing games: publish readiness and preview.
///
/// Both exist so the CMS can stop being a JSON textarea. Readiness returns every
/// blocker at once with an owner for each, and preview returns *the same
/// `content_pack` the app consumes* — never a second, prettier model of it, which
/// would drift and then lie about what a child will see.

import { Hono } from 'hono';
// Explicit `.ts` extensions on the relative imports: the test suite runs with
// `node --experimental-strip-types`, which requires them, and wrangler accepts
// both forms — so this is what makes the router importable in a test at all.
// Same reasoning as the note at the top of `lib/adminAuth.ts`.
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';
import {
  ENGINE_SCHEMAS,
  enginesWithRuntimeSchema,
  hasRuntimeSchema,
  parseEngineLimits,
  validatePackForGame,
} from '../lib/gamePackGate.ts';
import { validateGamePack } from '../lib/gamePackValidation.ts';
import { evaluatePublishReadiness, type ReadinessInput } from '../lib/publishReadiness.ts';
import { validateLocalization, type NormalizedLocalization } from '../lib/gameLocalization.ts';
import { GAME_LANGUAGES, isGameLanguage } from '../lib/gameDelivery.ts';
import {
  audioQueueAssetIds,
  buildAudioProductionQueue,
  summarizeAudioQueue,
  type AudioQueueGame,
} from '../lib/audioProductionQueue.ts';
import {
  artQueueAssetIds,
  buildArtProductionQueue,
  summarizeArtQueue,
  type ArtQueueGame,
} from '../lib/artProductionQueue.ts';
import {
  buildGameAnalytics,
  findPrivacyViolations,
  GAME_ATTEMPT_AGGREGATE_GROUP_BY,
  GAME_ATTEMPT_AGGREGATE_SQL,
  GAME_MASTERY_AGGREGATE_GROUP_BY,
  GAME_MASTERY_AGGREGATE_SQL,
  GAME_SCORE_BAND_GROUP_BY,
  GAME_SCORE_BAND_SQL,
  type GameAttemptAggregate,
  type GameMasteryAggregate,
  type GameScoreBand,
} from '../lib/gameAnalytics.ts';
import { buildGamesOpsOverview, type GamesOpsGame } from '../lib/gamesOps.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

interface GameRow {
  id: string;
  engine_id: string;
  series_id: string | null;
  episode_id: string | null;
  title_ar: string;
  learning_objective_id: string | null;
  age_min: number;
  age_max: number;
  reading_level: string;
  interaction_mode: string;
  supervision_level: string;
  safety_notes: string | null;
  difficulty: string;
  content_pack: string;
  instructions_ar: string | null;
  help_system: string;
  is_free: number;
  status: string;
  translated_from: string | null;
  objective_code: string | null;
  objective_title: string | null;
  objective_criteria: string | null;
  primary_skill_id: string | null;
  objective_age_min: number | null;
  objective_age_max: number | null;
  content_class: string | null;
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/// Every asset id a pack refers to, tagged by whether it is audio.
///
/// Audio is separated so an editor can tell "the artwork is not drawn" from "the
/// voice-over is not recorded" — different people, different lead times.
function packAssets(pack: Record<string, unknown> | null): { all: string[]; audio: string[] } {
  const all = new Set<string>();
  const audio = new Set<string>();
  if (!pack) return { all: [], audio: [] };
  const isObject = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);

  const voice = isObject(pack.voice_manifest) ? pack.voice_manifest : {};
  for (const value of Object.values(voice)) {
    if (typeof value === 'string' && value) { all.add(value); audio.add(value); }
  }
  const assets = isObject(pack.assets) ? pack.assets : {};
  for (const value of Array.isArray(assets.audio) ? assets.audio : []) {
    if (typeof value === 'string' && value) { all.add(value); audio.add(value); }
  }
  for (const value of Array.isArray(assets.images) ? assets.images : []) {
    if (typeof value === 'string' && value) all.add(value);
  }
  for (const level of Array.isArray(pack.levels) ? pack.levels : []) {
    if (!isObject(level)) continue;
    if (typeof level.guide_audio === 'string') { all.add(level.guide_audio); audio.add(level.guide_audio); }
    if (typeof level.background_asset === 'string') all.add(level.background_asset);
    const coloring = isObject(level.coloring) ? level.coloring : null;
    if (typeof coloring?.template_asset === 'string') all.add(coloring.template_asset);
  }
  return { all: [...all].sort(), audio: [...audio].sort() };
}

/// Prompt keys the pack expects a translation for.
function promptKeys(pack: Record<string, unknown> | null): string[] {
  if (!pack || !Array.isArray(pack.levels)) return [];
  const keys = new Set<string>();
  for (const level of pack.levels) {
    if (level && typeof level === 'object' && typeof (level as Record<string, unknown>).prompt_key === 'string') {
      keys.add((level as Record<string, unknown>).prompt_key as string);
    }
  }
  return [...keys].sort();
}

/// Voice keys the pack declares, so the localization editor can offer a
/// per-language override for each one instead of asking an editor to remember
/// them. Audio is inherently per-language; geometry is not.
function voiceKeys(pack: Record<string, unknown> | null): string[] {
  const voice = pack && typeof pack.voice_manifest === 'object' && pack.voice_manifest !== null
    ? pack.voice_manifest as Record<string, unknown>
    : {};
  return Object.keys(voice).sort();
}

interface LocalizationRow {
  language: string;
  title: string | null;
  instructions: string | null;
  prompts: string;
  voice_manifest: string;
  status: string;
  translated_from: string | null;
  is_machine_translated: number;
  updated_at: string;
}

const LOCALIZATION_SELECT = `
  SELECT language, title, instructions, prompts, voice_manifest, status,
         translated_from, is_machine_translated, updated_at
    FROM game_localizations WHERE game_id = ?
`;

/// Widens the stored JSON columns into the shape the validator and the CMS use.
/// Values that are not strings are dropped rather than coerced: a number where a
/// translation belongs is corrupt data, and rendering `0` to a child is worse
/// than rendering nothing.
function serializeLocalization(row: LocalizationRow): NormalizedLocalization & { language: string; updated_at: string } {
  const stringMap = (raw: string): Record<string, string> => {
    const parsed = parseJson(raw) ?? {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  };
  return {
    language: row.language,
    title: row.title,
    instructions: row.instructions,
    prompts: stringMap(row.prompts),
    voice_manifest: stringMap(row.voice_manifest),
    status: row.status as NormalizedLocalization['status'],
    translated_from: row.translated_from,
    is_machine_translated: row.is_machine_translated === 1,
    updated_at: row.updated_at,
  };
}

/// Exported as `loadGameRow` for `routes/adminPublishGate.ts`.
///
/// The unified publish gate must evaluate a game with the *same* engine readiness
/// this file serves at `/admin/games/:id/readiness`. Re-implementing the load and
/// the evaluation there would create a second opinion about whether a game is
/// publishable, and the two would drift the first time an engine contract changed.
export { loadGame as loadGameRow, readinessFor as gameReadinessFor };

async function loadGame(db: D1Database, id: string): Promise<GameRow | null> {
  return queryFirst<GameRow>(db, `
    SELECT g.*, s.content_class,
           lo.code AS objective_code, lo.title_ar AS objective_title,
           lo.measurable_criteria AS objective_criteria, lo.skill_id AS primary_skill_id,
           lo.age_min AS objective_age_min, lo.age_max AS objective_age_max
      FROM games g
      LEFT JOIN series s ON s.id = g.series_id
      LEFT JOIN learning_objectives lo ON lo.id = g.learning_objective_id
     WHERE g.id = ?
  `, [id]);
}

/// `content_reviews` rows for one game, in the shape readiness and the queues use.
///
/// One query rather than one per review kind: an editor asking "why is this
/// blocked" should not cost five round trips.
async function loadGameReviews(db: D1Database, gameId: string) {
  const rows = await queryAll<{ reviewer_role: string; status: string; reviewer_id: string | null }>(db, `
    SELECT reviewer_role, status, reviewer_id
      FROM content_reviews
     WHERE entity_type = 'game' AND entity_id = ?
     ORDER BY created_at DESC
  `, [gameId]);
  return rows.map((row) => ({ role: row.reviewer_role, status: row.status, reviewer: row.reviewer_id }));
}

/// Assets linked to the game itself — the cover, the catalogue illustration —
/// which live in `asset_links` and are named nowhere in the pack.
async function loadLinkedAssets(db: D1Database, gameId: string) {
  return queryAll<{ role: string; asset_id: string; status: string | null }>(db, `
    SELECT al.role AS role, al.asset_id AS asset_id, ca.status AS status
      FROM asset_links al
      LEFT JOIN content_assets ca ON ca.id = al.asset_id
     WHERE al.entity_type = 'game' AND al.entity_id = ?
     ORDER BY al.role, al.sort_order
  `, [gameId]);
}

/// Whether the shipped client registers a runtime for an engine.
///
/// D1 has no column for it, so the only honest source is an explicit
/// `client_implemented` flag inside `game_engines.mechanics`. When it is absent
/// this returns `undefined` and the readiness check reports `not_applicable`
/// rather than `pass`: an unrecorded fact must not be reported as a verified one,
/// because the failure it would hide — a published game that opens to an error
/// screen on every device — is the worst outcome on the board.
function clientImplementedFlag(mechanics: string | null | undefined): boolean | undefined {
  try {
    const parsed = JSON.parse(mechanics ?? '{}') as Record<string, unknown>;
    return typeof parsed.client_implemented === 'boolean' ? parsed.client_implemented : undefined;
  } catch {
    return undefined;
  }
}

async function readinessFor(env: Env, game: GameRow) {
  const pack = parseJson(game.content_pack);
  const { all, audio } = packAssets(pack);

  const assetRows = all.length
    ? await queryAll<{ id: string; status: string }>(
        env.DB,
        `SELECT id, status FROM content_assets WHERE id IN (${all.map(() => '?').join(', ')})`,
        all,
      )
    : [];
  const known = new Set(assetRows.map((row) => row.id));
  const ready = new Set(assetRows.filter((row) => row.status === 'ready').map((row) => row.id));

  const gate = await validatePackForGame(env.DB, {
    engine_id: game.engine_id,
    age_min: game.age_min,
    age_max: game.age_max,
    supervision_level: game.supervision_level,
    safety_notes: game.safety_notes,
    translated_from: game.translated_from,
  }, game.content_pack, true);

  const secondary = game.learning_objective_id
    ? (await queryAll<{ skill_id: string }>(env.DB, `
        SELECT skill_id FROM learning_objective_skills
         WHERE objective_id = ? AND role = 'secondary' ORDER BY skill_id
      `, [game.learning_objective_id])).map((row) => row.skill_id)
    : [];

  const required = promptKeys(pack);
  const localizationRows = await queryAll<{
    language: string; title: string | null; instructions: string | null;
    prompts: string; status: string; is_machine_translated: number;
  }>(env.DB, `
    SELECT language, title, instructions, prompts, status, is_machine_translated
      FROM game_localizations WHERE game_id = ?
  `, [game.id]);

  // The three facts readiness gained when it grew past trace_color: the human
  // review record, the game's own artwork, and what the engine says about itself.
  const reviews = await loadGameReviews(env.DB, game.id);
  const linked = await loadLinkedAssets(env.DB, game.id);
  const engineRow = await queryFirst<{ mechanics: string | null }>(
    env.DB, 'SELECT mechanics FROM game_engines WHERE id = ?', [game.engine_id],
  );
  const limits = parseEngineLimits(engineRow?.mechanics);

  const input: ReadinessInput = {
    engineId: game.engine_id,
    engineHasRuntimeSchema: hasRuntimeSchema(game.engine_id),
    packErrors: gate.errors,
    packWarnings: gate.warnings,
    pack,
    objectiveId: game.learning_objective_id,
    objectiveCode: game.objective_code,
    primarySkillId: game.primary_skill_id,
    secondarySkillIds: secondary,
    localizations: localizationRows.map((row) => {
      const prompts = parseJson(row.prompts) ?? {};
      return {
        language: row.language,
        status: row.status,
        hasTitle: Boolean(row.title?.trim()),
        hasInstructions: Boolean(row.instructions?.trim()),
        missingPromptKeys: required.filter((key) => typeof prompts[key] !== 'string' || !prompts[key]),
        isMachineTranslated: row.is_machine_translated === 1,
      };
    }),
    requiredPromptKeys: required,
    assets: {
      required: all,
      missing: all.filter((id) => !known.has(id)),
      notReady: all.filter((id) => known.has(id) && !ready.has(id)),
    },
    audio: {
      required: audio,
      missing: audio.filter((id) => !known.has(id)),
      notReady: audio.filter((id) => known.has(id) && !ready.has(id)),
    },
    ageMin: game.age_min,
    ageMax: game.age_max,
    supervisionLevel: game.supervision_level,
    safetyNotes: game.safety_notes,
    isTestFixture: game.content_class === 'test_fixture',
    supportedPackVersion: limits.engineVersion,
    engineImplemented: clientImplementedFlag(engineRow?.mechanics),
    reviews,
    productionAssets: linked.map((row) => ({
      role: row.role,
      assetId: row.asset_id,
      status: row.status,
    })),
    objectiveAgeMin: game.objective_age_min,
    objectiveAgeMax: game.objective_age_max,
  };

  return { readiness: evaluatePublishReadiness(input), gate, pack, assetRows, required };
}

/// `GET /admin/games/:id/readiness`
route.get('/games/:id/readiness', requireAdmin, async (c) => {
  const game = await loadGame(c.env.DB, c.req.param('id') ?? '');
  if (!game) return c.json({ success: false, error: 'Game not found' }, 404);

  const { readiness, gate, assetRows, required } = await readinessFor(c.env, game);

  return c.json({
    success: true,
    data: {
      game_id: game.id,
      status: game.status,
      engine_id: game.engine_id,
      ...readiness,
      pack_warnings: gate.warnings,
      // Per-asset state, so the CMS can render an asset checklist rather than a
      // count. Never reports a missing asset as ready.
      assets: assetRows.length || required.length
        ? (() => {
            const byId = new Map(assetRows.map((row) => [row.id, row.status]));
            const { all, audio } = packAssets(parseJson(game.content_pack));
            return all.map((id) => ({
              asset_id: id,
              kind: audio.includes(id) ? 'audio' : 'image',
              state: byId.has(id) ? byId.get(id) : 'missing',
              ready: byId.get(id) === 'ready',
            }));
          })()
        : [],
      required_prompt_keys: required,
      languages: GAME_LANGUAGES,
    },
  });
});

/// `GET /admin/games/:id/preview`
///
/// Returns the stored `content_pack` unchanged plus the localisation rows, so the
/// CMS preview renders exactly what the runtime would. `review` is *kept* here,
/// unlike the app-facing endpoint: this is the editor's own view.
route.get('/games/:id/preview', requireAdmin, async (c) => {
  const game = await loadGame(c.env.DB, c.req.param('id') ?? '');
  if (!game) return c.json({ success: false, error: 'Game not found' }, 404);

  const language = c.req.query('language') ?? 'ar';
  const pack = parseJson(game.content_pack);
  const localizations = await queryAll<{
    language: string; title: string | null; instructions: string | null; prompts: string;
  }>(c.env.DB, `
    SELECT language, title, instructions, prompts FROM game_localizations WHERE game_id = ?
  `, [game.id]);

  const chosen = localizations.find((row) => row.language === language)
    ?? localizations.find((row) => row.language === 'ar')
    ?? null;
  const prompts = parseJson(chosen?.prompts) ?? {};

  // Draft validation, not publish: an editor previewing an unfinished pack should
  // see structural errors without being told the artwork is missing.
  const gate = await validatePackForGame(c.env.DB, {
    engine_id: game.engine_id,
    age_min: game.age_min,
    age_max: game.age_max,
    supervision_level: game.supervision_level,
    safety_notes: game.safety_notes,
    translated_from: game.translated_from,
  }, game.content_pack, false);

  return c.json({
    success: true,
    data: {
      game_id: game.id,
      engine_id: game.engine_id,
      status: game.status,
      title: chosen?.title ?? game.title_ar,
      instructions: chosen?.instructions ?? game.instructions_ar,
      language: chosen?.language ?? null,
      available_languages: localizations.map((row) => row.language),
      // Verbatim. A second preview model would drift from the runtime.
      content_pack: pack,
      prompts,
      help_system: parseJson(game.help_system) ?? {},
      validation: { errors: gate.errors, warnings: gate.warnings, validated: gate.validated },
    },
  });
});

/// `GET /admin/games/:id/localizations`
///
/// Everything the localization editor needs in one call: the languages this
/// deployment supports, the prompt keys the pack declares, the voice keys that
/// may be overridden, and the rows that exist. The language list comes from the
/// server rather than being written into the CMS, so a fourth language is a
/// change here and nowhere else.
route.get('/games/:id/localizations', requireAdmin, async (c) => {
  const game = await loadGame(c.env.DB, c.req.param('id') ?? '');
  if (!game) return c.json({ success: false, error: 'Game not found' }, 404);

  const pack = parseJson(game.content_pack);
  const rows = await queryAll<LocalizationRow>(c.env.DB, LOCALIZATION_SELECT, [game.id]);

  return c.json({
    success: true,
    data: {
      game_id: game.id,
      languages: GAME_LANGUAGES,
      required_prompt_keys: promptKeys(pack),
      voice_keys: voiceKeys(pack),
      // Surfaced because it changes what an editor is allowed to do: a
      // language_specific pack is authored per language, never translated.
      localization_policy: typeof pack?.localization === 'string' ? pack.localization : null,
      localizations: rows.map(serializeLocalization),
    },
  });
});

/// `GET /admin/games/:id/localizations/:language`
route.get('/games/:id/localizations/:language', requireAdmin, async (c) => {
  const language = c.req.param('language') ?? '';
  if (!isGameLanguage(language)) return c.json({ success: false, error: 'Invalid language code' }, 400);
  const game = await loadGame(c.env.DB, c.req.param('id') ?? '');
  if (!game) return c.json({ success: false, error: 'Game not found' }, 404);

  const row = await queryFirst<LocalizationRow>(
    c.env.DB,
    `${LOCALIZATION_SELECT} AND language = ?`,
    [game.id, language],
  );
  if (!row) return c.json({ success: false, error: 'Localization not found' }, 404);
  return c.json({ success: true, data: serializeLocalization(row) });
});

/// `PUT /admin/games/:id/localizations/:language`
///
/// Upsert, because "create the Arabic row" and "correct the Arabic row" are the
/// same editorial act and a CMS that distinguishes them makes the editor guess.
///
/// Guarded by `edit_text` rather than `edit_metadata`: this is translation work,
/// and the `translator` role holds exactly that permission (migration 0019).
route.put('/games/:id/localizations/:language', requireAdmin, requirePermission('edit_text'), async (c) => {
  const language = c.req.param('language') ?? '';
  if (!isGameLanguage(language)) return c.json({ success: false, error: 'Invalid language code' }, 400);
  const game = await loadGame(c.env.DB, c.req.param('id') ?? '');
  if (!game) return c.json({ success: false, error: 'Game not found' }, 404);

  const body = await c.req.json().catch(() => null) as unknown;
  const pack = parseJson(game.content_pack);
  const existing = await queryFirst<LocalizationRow>(
    c.env.DB,
    `${LOCALIZATION_SELECT} AND language = ?`,
    [game.id, language],
  );

  const result = validateLocalization(body, {
    language,
    languages: GAME_LANGUAGES,
    packLocalization: typeof pack?.localization === 'string' ? pack.localization : null,
    requiredPromptKeys: promptKeys(pack),
  }, existing ? serializeLocalization(existing) : null);

  if (!result.ok) return c.json({ success: false, error: result.error }, 400);
  const value = result.value;

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO game_localizations (game_id, language, title, instructions, prompts, voice_manifest, status, translated_from, is_machine_translated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(game_id, language) DO UPDATE SET
        title = excluded.title,
        instructions = excluded.instructions,
        prompts = excluded.prompts,
        voice_manifest = excluded.voice_manifest,
        status = excluded.status,
        translated_from = excluded.translated_from,
        is_machine_translated = excluded.is_machine_translated,
        updated_at = datetime('now')
    `).bind(
      game.id, language, value.title, value.instructions,
      JSON.stringify(value.prompts), JSON.stringify(value.voice_manifest),
      value.status, value.translated_from, value.is_machine_translated ? 1 : 0,
    ),
    // The prompt text itself is not recorded: the audit row states which language
    // changed and how complete it is, which is what an audit needs.
    auditStatement(c.env.DB, actorId(c), 'upsert_localization', 'game', game.id, {
      language,
      status: value.status,
      prompt_count: Object.keys(value.prompts).length,
      missing_prompt_keys: result.missing_prompt_keys.length,
      is_machine_translated: value.is_machine_translated,
    }),
  ]);

  return c.json({
    success: true,
    data: {
      game_id: game.id,
      language,
      ...value,
      missing_prompt_keys: result.missing_prompt_keys,
      unused_prompt_keys: result.unused_prompt_keys,
      warnings: result.warnings,
    },
  });
});

/* ------------------------------------------------------------------------- */
/* Production, analytics and operations                                       */
/*                                                                            */
/* Four read-only endpoints that answer the questions a content lead actually  */
/* asks, none of which a per-game readiness call can answer: what has to be    */
/* recorded, what has to be drawn, whether the games that exist are being      */
/* played, and where the catalogue is stuck.                                   */
/*                                                                            */
/* All four are catalogue-wide, so every one of them batches its lookups. A    */
/* query per game inside a Worker request is not slow, it is a timeout, and an  */
/* endpoint that times out is an endpoint nobody uses — which is the same as    */
/* not having written it.                                                      */
/* ------------------------------------------------------------------------- */

/// Bound parameters per `IN (...)` lookup.
///
/// D1 limits how many values a single statement may bind, so catalogue-wide id
/// lists are chunked. Kept well below the limit rather than at it: the cost of a
/// second round trip is milliseconds, and the cost of exceeding the limit is a
/// 500 that only appears once the catalogue grows.
const ID_CHUNK = 40;

async function queryByIds<T>(
  db: D1Database,
  sql: (placeholders: string) => string,
  ids: readonly string[],
  leading: readonly unknown[] = [],
): Promise<T[]> {
  const out: T[] = [];
  for (let index = 0; index < ids.length; index += ID_CHUNK) {
    const slice = ids.slice(index, index + ID_CHUNK);
    const placeholders = slice.map(() => '?').join(', ');
    out.push(...await queryAll<T>(db, sql(placeholders), [...leading, ...slice]));
  }
  return out;
}

interface ProductionGameRow {
  id: string;
  engine_id: string;
  title_ar: string;
  status: string;
  content_pack: string;
  learning_objective_id: string | null;
  age_min: number;
  age_max: number;
  supervision_level: string;
  safety_notes: string | null;
  translated_from: string | null;
  content_class: string | null;
  planet_id: string | null;
  planet_name: string | null;
  objective_code: string | null;
  primary_skill_id: string | null;
  objective_age_min: number | null;
  objective_age_max: number | null;
}

/// Every game that still has production work ahead of it or behind it.
///
/// `archived` is the only status excluded. The brief says "published or draft",
/// and the nine statuses between them — `writing`, `review_lang`, `production`,
/// `qa`, `ready`, `scheduled` — are all literally that: drafts on their way to
/// being published. Excluding them would hide precisely the games that are in
/// production from the production queue, which is the one defect this endpoint
/// cannot afford.
async function loadProductionGames(db: D1Database, status?: string): Promise<ProductionGameRow[]> {
  const clauses = ["g.status <> 'archived'"];
  const params: unknown[] = [];
  if (status) {
    clauses.push('g.status = ?');
    params.push(status);
  }
  return queryAll<ProductionGameRow>(db, `
    SELECT g.id, g.engine_id, g.title_ar, g.status, g.content_pack,
           g.learning_objective_id, g.age_min, g.age_max, g.supervision_level,
           g.safety_notes, g.translated_from,
           s.content_class AS content_class,
           s.planet_id AS planet_id,
           p.name_ar AS planet_name,
           lo.code AS objective_code, lo.skill_id AS primary_skill_id,
           lo.age_min AS objective_age_min, lo.age_max AS objective_age_max
      FROM games g
      LEFT JOIN series s ON s.id = g.series_id
      LEFT JOIN planets p ON p.id = s.planet_id
      LEFT JOIN learning_objectives lo ON lo.id = g.learning_objective_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY g.status, g.title_ar
  `, params);
}

/// `content_reviews` for many games at once, grouped by game.
async function loadReviewsByGame(
  db: D1Database,
  gameIds: readonly string[],
): Promise<Map<string, Array<{ role: string; status: string }>>> {
  const rows = await queryByIds<{ entity_id: string; reviewer_role: string; status: string }>(
    db,
    (placeholders) => `
      SELECT entity_id, reviewer_role, status
        FROM content_reviews
       WHERE entity_type = 'game' AND entity_id IN (${placeholders})
       ORDER BY created_at DESC
    `,
    gameIds,
  );
  const map = new Map<string, Array<{ role: string; status: string }>>();
  for (const row of rows) {
    const list = map.get(row.entity_id) ?? [];
    list.push({ role: row.reviewer_role, status: row.status });
    map.set(row.entity_id, list);
  }
  return map;
}

interface LocalizationLite {
  language: string;
  status: string;
  title: string | null;
  instructions: string | null;
  prompts: Record<string, string>;
  voiceManifest: Record<string, string>;
  isMachineTranslated: boolean;
}

function stringMap(raw: string | null): Record<string, string> {
  const parsed = parseJson(raw) ?? {};
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

async function loadLocalizationsByGame(
  db: D1Database,
  gameIds: readonly string[],
): Promise<Map<string, LocalizationLite[]>> {
  const rows = await queryByIds<{
    game_id: string; language: string; status: string; title: string | null;
    instructions: string | null; prompts: string; voice_manifest: string;
    is_machine_translated: number;
  }>(
    db,
    (placeholders) => `
      SELECT game_id, language, status, title, instructions, prompts, voice_manifest,
             is_machine_translated
        FROM game_localizations
       WHERE game_id IN (${placeholders})
    `,
    gameIds,
  );
  const map = new Map<string, LocalizationLite[]>();
  for (const row of rows) {
    const list = map.get(row.game_id) ?? [];
    list.push({
      language: row.language,
      status: row.status,
      title: row.title,
      instructions: row.instructions,
      prompts: stringMap(row.prompts),
      voiceManifest: stringMap(row.voice_manifest),
      isMachineTranslated: row.is_machine_translated === 1,
    });
    map.set(row.game_id, list);
  }
  return map;
}

interface AssetLite {
  status: string;
  kind: string | null;
  expectedWidth: number | null;
  expectedHeight: number | null;
  aspectRatio: string | null;
  language: string | null;
  uploadedBy: string | null;
}

async function loadAssets(
  db: D1Database,
  assetIds: readonly string[],
): Promise<Map<string, AssetLite>> {
  const rows = await queryByIds<{
    id: string; status: string; kind: string | null;
    expected_width: number | null; expected_height: number | null;
    aspect_ratio: string | null; language: string | null; uploaded_by: string | null;
  }>(
    db,
    (placeholders) => `
      SELECT id, status, kind, expected_width, expected_height, aspect_ratio,
             language, uploaded_by
        FROM content_assets
       WHERE id IN (${placeholders})
    `,
    assetIds,
  );
  return new Map(rows.map((row) => [row.id, {
    status: row.status,
    kind: row.kind,
    expectedWidth: row.expected_width,
    expectedHeight: row.expected_height,
    aspectRatio: row.aspect_ratio,
    language: row.language,
    uploadedBy: row.uploaded_by,
  }]));
}

/// `GET /admin/games/production/audio`
///
/// Every clip the catalogue needs, in every language, whether or not anybody has
/// thought about it yet. See `lib/audioProductionQueue.ts` for why this is derived
/// from the engine contracts rather than from what the packs happen to bind.
///
/// Filters are query parameters rather than separate endpoints: `?language=ar`,
/// `?status=draft`, `?production_status=missing`, `?required=true`. A production
/// board needs "everything Arabic that is still missing" far more often than it
/// needs the whole list.
route.get('/games/production/audio', requireAdmin, async (c) => {
  const languageFilter = c.req.query('language');
  if (languageFilter && !isGameLanguage(languageFilter)) {
    return c.json({ success: false, error: 'Invalid language code' }, 400);
  }
  const productionFilter = c.req.query('production_status');
  if (productionFilter && !['missing', 'pending', 'ready'].includes(productionFilter)) {
    return c.json({ success: false, error: 'production_status must be missing, pending or ready' }, 400);
  }
  const requiredOnly = c.req.query('required') === 'true';

  const games = await loadProductionGames(c.env.DB, c.req.query('status'));
  const gameIds = games.map((game) => game.id);
  const [localizations, reviews] = await Promise.all([
    loadLocalizationsByGame(c.env.DB, gameIds),
    loadReviewsByGame(c.env.DB, gameIds),
  ]);

  const queueGames: AudioQueueGame[] = games.map((game) => ({
    id: game.id,
    title: game.title_ar,
    engineId: game.engine_id,
    status: game.status,
    pack: parseJson(game.content_pack),
    localizations: (localizations.get(game.id) ?? []).map((row) => ({
      language: row.language,
      status: row.status,
      prompts: row.prompts,
      voiceManifest: row.voiceManifest,
    })),
    reviews: reviews.get(game.id) ?? [],
  }));

  const assets = await loadAssets(c.env.DB, audioQueueAssetIds(queueGames));
  const assetStatus = Object.fromEntries([...assets].map(([id, asset]) => [id, asset.status]));

  const all = buildAudioProductionQueue(queueGames, {
    languages: languageFilter ? [languageFilter] : GAME_LANGUAGES,
    assetStatus,
  });
  const rows = all.filter((row) => (
    (!productionFilter || row.production_status === productionFilter)
    && (!requiredOnly || row.requirement === 'required')
  ));

  return c.json({
    success: true,
    data: {
      // The summary is over the filtered rows, so a filtered board's numbers match
      // the list it is showing.
      summary: summarizeAudioQueue(rows),
      // And over everything, so the filter never hides how much work remains.
      catalogue_summary: summarizeAudioQueue(all),
      languages: GAME_LANGUAGES,
      games_covered: queueGames.length,
      rows,
    },
  });
});

/// `GET /admin/games/production/art`
///
/// Every image the catalogue needs, with the role, the expected geometry and a
/// brief. See `lib/artProductionQueue.ts` for why the role is what carries the
/// brief and not the file name.
route.get('/games/production/art', requireAdmin, async (c) => {
  const roleFilter = c.req.query('role');
  const productionFilter = c.req.query('production_status');
  if (productionFilter && !['missing', 'pending', 'ready'].includes(productionFilter)) {
    return c.json({ success: false, error: 'production_status must be missing, pending or ready' }, 400);
  }

  const games = await loadProductionGames(c.env.DB, c.req.query('status'));
  const gameIds = games.map((game) => game.id);
  const reviews = await loadReviewsByGame(c.env.DB, gameIds);

  const links = await queryByIds<{ entity_id: string; role: string; asset_id: string }>(
    c.env.DB,
    (placeholders) => `
      SELECT entity_id, role, asset_id
        FROM asset_links
       WHERE entity_type = 'game' AND entity_id IN (${placeholders})
    `,
    gameIds,
  );
  const linksByGame = new Map<string, Array<{ role: string; assetId: string }>>();
  for (const link of links) {
    const list = linksByGame.get(link.entity_id) ?? [];
    list.push({ role: link.role, assetId: link.asset_id });
    linksByGame.set(link.entity_id, list);
  }

  const queueGames: ArtQueueGame[] = games.map((game) => ({
    id: game.id,
    title: game.title_ar,
    engineId: game.engine_id,
    status: game.status,
    pack: parseJson(game.content_pack),
    reviews: reviews.get(game.id) ?? [],
    linkedAssets: linksByGame.get(game.id) ?? [],
  }));

  const assets = await loadAssets(c.env.DB, artQueueAssetIds(queueGames));
  const all = buildArtProductionQueue(queueGames, {
    assets: Object.fromEntries(assets),
  });
  const rows = all.filter((row) => (
    (!roleFilter || row.role === roleFilter)
    && (!productionFilter || row.production_status === productionFilter)
  ));

  return c.json({
    success: true,
    data: {
      summary: summarizeArtQueue(rows),
      catalogue_summary: summarizeArtQueue(all),
      games_covered: queueGames.length,
      rows,
    },
  });
});

/// `GET /admin/games/analytics`
///
/// Aggregate play metrics from the `attempts` table. Nothing about an individual
/// child, and nothing about what they drew or wrote — see `lib/gameAnalytics.ts`
/// for the rule and the reasons.
///
/// The payload is checked against that rule before it is returned. A guard that
/// only exists in a test protects the test; this one protects the response, so a
/// column added carelessly to a query fails here rather than in a child's
/// privacy.
route.get('/games/analytics', requireAdmin, async (c) => {
  const since = c.req.query('since')?.trim() || null;
  const sinceClause = since ? ' AND a.created_at >= ?' : '';
  const sinceParams = since ? [since] : [];

  const attempts = await queryAll<GameAttemptAggregate>(
    c.env.DB,
    `${GAME_ATTEMPT_AGGREGATE_SQL}${sinceClause}${GAME_ATTEMPT_AGGREGATE_GROUP_BY}`,
    sinceParams,
  );
  const mastery = await queryAll<GameMasteryAggregate>(
    c.env.DB,
    `${GAME_MASTERY_AGGREGATE_SQL}${GAME_MASTERY_AGGREGATE_GROUP_BY}`,
  );
  const bands = await queryAll<GameScoreBand>(
    c.env.DB,
    `${GAME_SCORE_BAND_SQL}${sinceClause}${GAME_SCORE_BAND_GROUP_BY}`,
    sinceParams,
  );

  // Level counts come from the packs of the games that actually have data, so an
  // idle catalogue costs nothing.
  const packLevels: Record<string, number> = {};
  const playedIds = attempts.map((row) => row.game_id).filter((id): id is string => Boolean(id));
  if (playedIds.length) {
    const packs = await queryByIds<{ id: string; content_pack: string }>(
      c.env.DB,
      (placeholders) => `SELECT id, content_pack FROM games WHERE id IN (${placeholders})`,
      playedIds,
    );
    for (const row of packs) {
      const pack = parseJson(row.content_pack);
      const levels = pack && Array.isArray(pack.levels) ? pack.levels : null;
      if (levels) packLevels[row.id] = levels.length;
    }
  }

  const payload = buildGameAnalytics({ attempts, mastery, bands, packLevels, since });

  const violations = findPrivacyViolations(payload);
  if (violations.length) {
    // Fail closed. Returning a payload that breaks the privacy rule because the
    // guard found a problem would make the guard decorative.
    return c.json({
      success: false,
      error: 'Analytics payload rejected by the privacy guard',
      details: violations,
    }, 500);
  }

  return c.json({ success: true, data: payload });
});

/// `GET /admin/games/ops`
///
/// The catalogue-wide operations view. Every number comes from a query; see
/// `lib/gamesOps.ts` for why readiness is evaluated rather than read off the
/// status column.
///
/// Readiness is computed with the *pure* validator plus batched lookups rather
/// than by calling `validatePackForGame` per game, which would issue two queries
/// per game. The rules are identical because it is the same function with the same
/// context — only the transport of the context differs.
route.get('/games/ops', requireAdmin, async (c) => {
  const games = await loadProductionGames(c.env.DB);
  const gameIds = games.map((game) => game.id);

  const [localizations, reviews, engineRows, awaitingRows] = await Promise.all([
    loadLocalizationsByGame(c.env.DB, gameIds),
    loadReviewsByGame(c.env.DB, gameIds),
    queryAll<{ id: string; mechanics: string | null }>(c.env.DB, 'SELECT id, mechanics FROM game_engines'),
    queryAll<{ entity_id: string }>(c.env.DB, `
      SELECT DISTINCT entity_id FROM content_reviews
       WHERE entity_type = 'game' AND status = 'pending'
    `),
  ]);

  const objectiveIds = [...new Set(games
    .map((game) => game.learning_objective_id)
    .filter((id): id is string => Boolean(id)))];
  const secondarySkills = objectiveIds.length
    ? await queryByIds<{ objective_id: string; skill_id: string }>(
        c.env.DB,
        (placeholders) => `
          SELECT objective_id, skill_id FROM learning_objective_skills
           WHERE role = 'secondary' AND objective_id IN (${placeholders})
           ORDER BY skill_id
        `,
        objectiveIds,
      )
    : [];
  const secondaryByObjective = new Map<string, string[]>();
  for (const row of secondarySkills) {
    const list = secondaryByObjective.get(row.objective_id) ?? [];
    list.push(row.skill_id);
    secondaryByObjective.set(row.objective_id, list);
  }

  // Every asset any pack names, in one batch.
  const packsById = new Map(games.map((game) => [game.id, parseJson(game.content_pack)]));
  const allAssetIds = new Set<string>();
  const assetsByGame = new Map<string, { all: string[]; audio: string[] }>();
  for (const game of games) {
    const split = packAssets(packsById.get(game.id) ?? null);
    assetsByGame.set(game.id, split);
    for (const id of split.all) allAssetIds.add(id);
  }
  const linkRows = await queryByIds<{ entity_id: string; role: string; asset_id: string; status: string | null }>(
    c.env.DB,
    (placeholders) => `
      SELECT al.entity_id, al.role, al.asset_id, ca.status
        FROM asset_links al
        LEFT JOIN content_assets ca ON ca.id = al.asset_id
       WHERE al.entity_type = 'game' AND al.entity_id IN (${placeholders})
    `,
    gameIds,
  );
  const linksByGame = new Map<string, Array<{ role: string; assetId: string; status: string | null }>>();
  for (const row of linkRows) {
    const list = linksByGame.get(row.entity_id) ?? [];
    list.push({ role: row.role, assetId: row.asset_id, status: row.status });
    linksByGame.set(row.entity_id, list);
  }

  const assets = await loadAssets(c.env.DB, [...allAssetIds]);
  const engineMechanics = new Map(engineRows.map((row) => [row.id, row.mechanics]));

  const opsGames: GamesOpsGame[] = games.map((game) => {
    const pack = packsById.get(game.id) ?? null;
    const split = assetsByGame.get(game.id) ?? { all: [], audio: [] };
    const schema = ENGINE_SCHEMAS[game.engine_id];
    const limits = parseEngineLimits(engineMechanics.get(game.engine_id));
    const localizationRows = localizations.get(game.id) ?? [];
    const required = promptKeys(pack);

    let packErrors: string[] = [];
    let packWarnings: string[] = [];
    if (schema) {
      const known = new Set(split.all.filter((id) => assets.has(id)));
      const ready = new Set(split.all.filter((id) => assets.get(id)?.status === 'ready'));
      const result = validateGamePack(schema, pack ?? {}, {
        engineId: game.engine_id,
        ageMin: Number(game.age_min),
        ageMax: Number(game.age_max),
        supervisionLevel: String(game.supervision_level),
        safetyNotes: game.safety_notes ?? null,
        translatedFrom: game.translated_from ?? null,
        hasLearningObjective: Boolean(game.learning_objective_id),
        supportedEngineVersion: limits.engineVersion,
        maxElementsOnScreen: limits.maxElements,
        knownAssetIds: known,
        readyAssetIds: ready,
        forPublish: true,
      });
      packErrors = result.errors;
      packWarnings = result.warnings;
    }

    const readinessInput: ReadinessInput = {
      engineId: game.engine_id,
      engineHasRuntimeSchema: hasRuntimeSchema(game.engine_id),
      packErrors,
      packWarnings,
      pack,
      objectiveId: game.learning_objective_id,
      objectiveCode: game.objective_code,
      primarySkillId: game.primary_skill_id,
      secondarySkillIds: game.learning_objective_id
        ? secondaryByObjective.get(game.learning_objective_id) ?? []
        : [],
      localizations: localizationRows.map((row) => ({
        language: row.language,
        status: row.status,
        hasTitle: Boolean(row.title?.trim()),
        hasInstructions: Boolean(row.instructions?.trim()),
        missingPromptKeys: required.filter((key) => !row.prompts[key]),
        isMachineTranslated: row.isMachineTranslated,
      })),
      requiredPromptKeys: required,
      assets: {
        required: split.all,
        missing: split.all.filter((id) => !assets.has(id)),
        notReady: split.all.filter((id) => assets.has(id) && assets.get(id)!.status !== 'ready'),
      },
      audio: {
        required: split.audio,
        missing: split.audio.filter((id) => !assets.has(id)),
        notReady: split.audio.filter((id) => assets.has(id) && assets.get(id)!.status !== 'ready'),
      },
      ageMin: game.age_min,
      ageMax: game.age_max,
      supervisionLevel: game.supervision_level,
      safetyNotes: game.safety_notes,
      isTestFixture: game.content_class === 'test_fixture',
      supportedPackVersion: limits.engineVersion,
      engineImplemented: clientImplementedFlag(engineMechanics.get(game.engine_id)),
      reviews: reviews.get(game.id) ?? [],
      productionAssets: linksByGame.get(game.id) ?? [],
      objectiveAgeMin: game.objective_age_min,
      objectiveAgeMax: game.objective_age_max,
    };

    return {
      id: game.id,
      title: game.title_ar,
      engineId: game.engine_id,
      status: game.status,
      ageMin: game.age_min,
      ageMax: game.age_max,
      planetId: game.planet_id,
      planetName: game.planet_name,
      readinessInput,
    };
  });

  const overview = buildGamesOpsOverview({
    games: opsGames,
    catalogueEngineIds: engineRows.map((row) => row.id),
    implementedEngineIds: enginesWithRuntimeSchema(),
    gameIdsAwaitingReview: awaitingRows.map((row) => row.entity_id),
  });

  return c.json({ success: true, data: overview });
});

export default route;
