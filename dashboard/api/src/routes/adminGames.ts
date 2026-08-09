/// Admin endpoints for drawing games: publish readiness and preview.
///
/// Both exist so the CMS can stop being a JSON textarea. Readiness returns every
/// blocker at once with an owner for each, and preview returns *the same
/// `content_pack` the app consumes* — never a second, prettier model of it, which
/// would drift and then lie about what a child will see.

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { requireAdmin, requirePermission } from '../lib/adminAuth';
import { actorId, auditStatement } from '../lib/auditLog';
import { hasRuntimeSchema, validatePackForGame } from '../lib/gamePackGate.ts';
import { evaluatePublishReadiness, type ReadinessInput } from '../lib/publishReadiness.ts';
import { validateLocalization, type NormalizedLocalization } from '../lib/gameLocalization.ts';
import { GAME_LANGUAGES, isGameLanguage } from '../lib/gameDelivery.ts';

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

async function loadGame(db: D1Database, id: string): Promise<GameRow | null> {
  return queryFirst<GameRow>(db, `
    SELECT g.*, s.content_class,
           lo.code AS objective_code, lo.title_ar AS objective_title,
           lo.measurable_criteria AS objective_criteria, lo.skill_id AS primary_skill_id
      FROM games g
      LEFT JOIN series s ON s.id = g.series_id
      LEFT JOIN learning_objectives lo ON lo.id = g.learning_objective_id
     WHERE g.id = ?
  `, [id]);
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

export default route;
