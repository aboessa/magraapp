/// App-facing game delivery.
///
/// ## What was missing
///
/// There was no app-facing games endpoint at all. `src/routes/` had only admin
/// handlers, and the app could see a game solely as a five-column summary
/// embedded in `GET /episodes/:id`:
///
///   SELECT id, title_ar, instructions_ar, difficulty, max_attempts
///
/// No `content_pack`, so no client could ever have run a game even if an engine
/// existed. `docs/games/02-data-contract.md` specifies `GET /api/v1/games/:id`
/// returning the published pack in the child's language; this is that endpoint.
///
/// ## Rules enforced here
///
/// - published only; a draft pack is never served, whatever the caller asks for
/// - the parent is authenticated and the child must belong to that parent, which
///   `FamilyDO` decides, not this route
/// - the child's age must fall inside the game's range
/// - test fixtures are excluded unless the environment explicitly opts in, and
///   never in production
/// - language falls back explicitly and the response says so
/// - editorial state (`review`) is stripped by `localizePack`
///
/// Audio and image assets are returned as ids plus a short-lived media token per
/// asset, reusing the same capability mechanism as episode playback. Pack assets
/// live in the private bucket, so there is no public URL to hand out.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';
import { contentClassPredicate, shouldServeTestFixtures } from '../lib/contentClass.ts';
import { authenticateParent, createMediaToken, mediaIsConfigured } from '../lib/parentAuth.ts';
import {
  availabilityContext,
  availabilityFor,
  availabilityForBatch,
  availabilityRefusal,
} from '../lib/requestGeo.ts';
import {
  isGameLanguage,
  localizePack,
  resolveLanguage,
  tracksForAgeRange,
  type GameLanguage,
  type GameLocalizationRow,
} from '../lib/gameDelivery.ts';

type AppEnv = { Bindings: Env };

const gamesRoute = new Hono<AppEnv>();

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseStringMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(parseJsonObject(value))) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

function pagination(value: string | undefined, fallback: number, minimum = 0) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed)
    ? Math.min(Math.max(parsed, minimum), 100)
    : fallback;
}

interface FamilyChild {
  id: string;
  birth_month: number;
  birth_year: number;
  language: string;
}

function ageInYears(child: FamilyChild, now = new Date()): number | null {
  const birthMonth = Number(child.birth_month);
  const birthYear = Number(child.birth_year);
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) return null;
  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > now.getUTCFullYear()) return null;
  const currentMonth = now.getUTCMonth() + 1;
  return now.getUTCFullYear() - birthYear - (currentMonth < birthMonth ? 1 : 0);
}

interface GameSummaryRow {
  id: string;
  title: string;
  engine_id: string;
  series_id: string;
  episode_id: string | null;
  planet_id: string;
  difficulty: string;
  age_min: number;
  age_max: number;
  is_free: number;
  engine_mechanics: string | null;
}

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
  max_attempts: number | null;
  help_system: string;
  is_free: number;
  engine_mechanics: string | null;
  objective_code: string | null;
  objective_title: string | null;
  objective_criteria: string | null;
}

// GET /api/v1/games - child-specific, published summaries only.
//
// This endpoint deliberately fails closed for standalone games. `games` has no
// `content_class` or `planet_id`; both are authoritative on the parent series.
// A direct series link or an episode's series is therefore required before a
// row can be proven production content and checked against inherited territory
// policy. No pack, asset id, media capability or editorial field is selected.
gamesRoute.get('/', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const childId = c.req.query('child_id')?.trim();
  if (!childId) return c.json({ success: false, error: 'child_id is required' }, 400);

  const family = await callDurable<{ data?: FamilyChild[] }>(
    familyStub(c.env, auth.principal.parentId),
    '/children',
  );
  if (family.status !== 200) {
    return Response.json(
      family.data ?? { success: false, error: 'Family service unavailable' },
      { status: family.status },
    );
  }
  const child = family.data?.data?.find((entry) => String(entry.id) === childId);
  if (!child) return c.json({ success: false, error: 'Child not found for this account' }, 404);

  const childAge = ageInYears(child);
  if (childAge === null) {
    return c.json({ success: false, error: 'Child profile has no valid age' }, 409);
  }

  const requestedRaw = c.req.query('language') ?? child.language ?? 'ar';
  const requested: GameLanguage = isGameLanguage(requestedRaw) ? requestedRaw : 'ar';
  const limit = pagination(c.req.query('limit'), 100, 1);
  const offset = pagination(c.req.query('offset'), 0);
  const serveFixtures = shouldServeTestFixtures(c.env);
  const context = availabilityContext(c.req.raw, c.env, { language: requested });

  // `queryAll` prepares and binds this statement. The only interpolation is the
  // trusted content-class predicate built from the literal alias `s`.
  const rows = await queryAll<GameSummaryRow>(c.env.DB, `
    SELECT g.id,
           COALESCE(NULLIF(TRIM(gl.title), ''), g.title_ar) AS title,
           g.engine_id,
           s.id AS series_id,
           g.episode_id,
           p.id AS planet_id,
           g.difficulty,
           g.age_min,
           g.age_max,
           g.is_free,
           ge.mechanics AS engine_mechanics
      FROM games g
      JOIN game_engines ge ON ge.id = g.engine_id
      LEFT JOIN episodes e ON e.id = g.episode_id
      JOIN series s ON s.id = COALESCE(g.series_id, e.series_id)
      JOIN planets p ON p.id = s.planet_id
      LEFT JOIN game_localizations gl
        ON gl.game_id = g.id
       AND gl.language = ?
       AND gl.status IN ('ready', 'published')
     WHERE g.status = 'published'
       AND s.status = 'published'
       AND p.is_active = 1
       AND g.age_min <= ? AND g.age_max >= ?
       AND s.age_min <= ? AND s.age_max >= ?
       AND (
         g.episode_id IS NULL OR (
           e.id IS NOT NULL
           AND e.status = 'published'
           AND e.is_published = 1
           AND e.series_id = s.id
         )
       )
       ${contentClassPredicate('s', serveFixtures)}
     ORDER BY COALESCE(g.updated_at, g.created_at) DESC, g.id ASC
     LIMIT ? OFFSET ?
  `, [requested, childAge, childAge, childAge, childAge, limit, offset]);

  const decisions = await availabilityForBatch(c.env, 'game', rows, (row) => ({
    id: row.id,
    series_id: row.series_id,
    planet_id: row.planet_id,
  }), context);
  const visible = rows.filter((row) => decisions.get(row.id)?.available !== false);

  return c.json({
    success: true,
    data: visible.map((row) => ({
      id: row.id,
      title: row.title,
      engine: row.engine_id,
      series_id: row.series_id,
      episode_id: row.episode_id,
      planet_id: row.planet_id,
      difficulty: row.difficulty,
      age_min: row.age_min,
      age_max: row.age_max,
      is_free: Boolean(row.is_free),
      supports_dpad: parseJsonObject(row.engine_mechanics).supports_dpad === true,
    })),
    meta: {
      limit,
      offset,
      withheld_in_territory: rows.length - visible.length,
    },
  });
});

gamesRoute.get('/:id', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const childId = c.req.query('child_id')?.trim();
  if (!childId) return c.json({ success: false, error: 'child_id is required' }, 400);

  // Ownership and profile come from the family Durable Object, which is the
  // authority for who a parent's children are. Deciding it from D1 here would
  // duplicate that authority and could disagree with it.
  const state = await callDurable(familyStub(c.env, auth.principal.parentId), '/state', {});
  if (state.status !== 200) {
    return Response.json(state.data ?? { success: false, error: 'Family service unavailable' }, { status: state.status });
  }
  const children = (state.data as { data?: { children?: Array<Record<string, unknown>> } })?.data?.children ?? [];
  const child = children.find((entry) => String(entry.id) === childId);
  if (!child) return c.json({ success: false, error: 'Child not found for this account' }, 404);

  const serveFixtures = shouldServeTestFixtures(c.env);
  const gameId = c.req.param('id');

  // Territory enforcement before the pack is handed to a child's device.
  //
  // A game pack is downloadable content like any other: if its series is licensed
  // for two countries, so is it. Applied here rather than only in the catalogue
  // because this endpoint is what the app actually calls to play.
  const gameContext = availabilityContext(c.req.raw, c.env);
  const gameDecision = await availabilityFor(c.env, 'game', gameId, gameContext);
  if (!gameDecision.available) {
    return c.json(availabilityRefusal(gameDecision, gameContext.country), 451);
  }

  // Published-only, and the parent series must be published too: a published
  // game hanging off a draft series is not reachable content.
  const game = await queryFirst<GameRow>(c.env.DB, `
    SELECT g.id, g.engine_id, g.series_id, g.episode_id, g.title_ar, g.learning_objective_id,
           g.age_min, g.age_max, g.reading_level, g.interaction_mode, g.supervision_level,
           g.safety_notes, g.difficulty, g.content_pack, g.instructions_ar, g.max_attempts,
           g.help_system, g.is_free,
           ge.mechanics AS engine_mechanics,
           lo.code AS objective_code, lo.title_ar AS objective_title,
           lo.measurable_criteria AS objective_criteria
      FROM games g
      JOIN game_engines ge ON ge.id = g.engine_id
      LEFT JOIN series s ON s.id = g.series_id
      LEFT JOIN learning_objectives lo ON lo.id = g.learning_objective_id
     WHERE g.id = ?
       AND g.status = 'published'
       AND (g.series_id IS NULL OR s.status = 'published')
       ${seriesClassPredicate(serveFixtures)}
  `, [gameId]);
  if (!game) return c.json({ success: false, error: 'Game not found' }, 404);

  // Age gate. The pack is authored for a range and a three-year-old handed a
  // nine-year-old's pack is a bad experience, not a security problem, but it is
  // still the server's job to refuse.
  const childAge = Number(child.age ?? child.age_years ?? NaN);
  if (Number.isFinite(childAge) && (childAge < game.age_min || childAge > game.age_max)) {
    return c.json({
      success: false,
      error: `This game is for ages ${game.age_min}-${game.age_max}`,
    }, 403);
  }

  const requestedRaw = c.req.query('language') ?? child.language ?? 'ar';
  const requested: GameLanguage = isGameLanguage(requestedRaw) ? requestedRaw : 'ar';

  const localizationRows = await queryAll<{
    language: string; title: string | null; instructions: string | null;
    prompts: string; voice_manifest: string; status: string; is_machine_translated: number;
  }>(c.env.DB, `
    SELECT language, title, instructions, prompts, voice_manifest, status, is_machine_translated
      FROM game_localizations
     WHERE game_id = ?
  `, [gameId]);

  const localizations: GameLocalizationRow[] = localizationRows.map((row) => ({
    language: row.language,
    title: row.title,
    instructions: row.instructions,
    prompts: parseStringMap(row.prompts),
    voice_manifest: parseStringMap(row.voice_manifest),
    status: row.status,
    is_machine_translated: row.is_machine_translated,
  }));

  const resolution = resolveLanguage(requested, localizations.map((row) => row.language));
  const localization = resolution
    ? localizations.find((row) => row.language === resolution.language) ?? null
    : null;

  const { pack, missing_prompt_keys, missing_voice_keys } = localizePack(
    parseJsonObject(game.content_pack),
    localization,
  );

  // Skills: the primary from the legacy column and the secondaries from the join
  // table added in migration 0022. This is what makes a drawing game legible as
  // fine-motor work and not only as literacy.
  const skills = game.learning_objective_id
    ? await queryAll<{ skill_id: string; role: string; name_ar: string | null; category: string | null }>(c.env.DB, `
        SELECT los.skill_id, los.role, sk.name_ar, sk.category
          FROM learning_objective_skills los
          LEFT JOIN skills sk ON sk.id = los.skill_id
         WHERE los.objective_id = ?
         ORDER BY los.role DESC, los.skill_id
      `, [game.learning_objective_id])
    : [];

  const mechanics = parseJsonObject(game.engine_mechanics);

  // Asset capabilities. Pack assets are private, so the client gets a token per
  // asset rather than a URL it could share. Unconfigured media is not an error:
  // a pack with no recorded audio yet is still playable in silence.
  const assetIds = collectAssetIds(pack);
  const assetTokens: Record<string, string> = {};
  const unavailableAssets: string[] = [];
  if (assetIds.length && mediaIsConfigured(c.env)) {
    const placeholders = assetIds.map(() => '?').join(', ');
    const assets = await queryAll<{
      id: string; r2_key: string | null; bucket: string | null; mime_type: string | null;
      original_filename: string | null; version: number; etag: string | null; status: string;
    }>(c.env.DB, `
      SELECT id, r2_key, bucket, mime_type, original_filename, version, etag, status
        FROM content_assets WHERE id IN (${placeholders})
    `, assetIds);
    const byId = new Map(assets.map((row) => [row.id, row]));
    for (const assetId of assetIds) {
      const asset = byId.get(assetId);
      if (!asset || asset.status !== 'ready' || !asset.r2_key || !asset.bucket) {
        unavailableAssets.push(assetId);
        continue;
      }
      assetTokens[assetId] = await createMediaToken(c.env, {
        sub: auth.principal.parentId,
        sid: auth.principal.sessionId,
        lid: `game:${gameId}`,
        aid: asset.id,
        r2_key: asset.r2_key,
        bucket: asset.bucket as 'media' | 'thumbs',
        mime_type: asset.mime_type,
        filename: asset.original_filename,
        asset_version: asset.version,
        etag: asset.etag,
      });
    }
  } else {
    unavailableAssets.push(...assetIds);
  }

  return c.json({
    success: true,
    data: {
      id: game.id,
      engine_id: game.engine_id,
      pack_version: pack.pack_version ?? null,
      engine_version: Number(mechanics.engine_version ?? 1),
      title: localization?.title ?? game.title_ar,
      instructions: localization?.instructions ?? game.instructions_ar,
      language: resolution?.language ?? null,
      language_requested: requested,
      language_fell_back: resolution?.fell_back ?? false,
      language_chain: resolution?.chain ?? [],
      difficulty: game.difficulty,
      age_min: game.age_min,
      age_max: game.age_max,
      tracks: tracksForAgeRange(game.age_min, game.age_max),
      reading_level: game.reading_level,
      interaction_mode: game.interaction_mode,
      supervision_level: game.supervision_level,
      safety_notes: game.safety_notes,
      is_free: Boolean(game.is_free),
      max_attempts: game.max_attempts,
      series_id: game.series_id,
      episode_id: game.episode_id,
      objective: game.learning_objective_id
        ? {
            id: game.learning_objective_id,
            code: game.objective_code,
            title: game.objective_title,
            criteria: game.objective_criteria,
          }
        : null,
      skills,
      // Engine-level capabilities the client needs before it renders anything.
      // `supports_dpad: false` is why tracing is hidden on TV.
      engine: {
        supports_dpad: mechanics.supports_dpad === true,
        max_elements_on_screen: Number(mechanics.max_elements_on_screen ?? 0) || null,
        min_touch_target_dp: Number(mechanics.min_touch_target_dp ?? 0) || null,
        has_timer: mechanics.has_timer === true,
      },
      help_system: parseJsonObject(game.help_system),
      progression: pack.progression ?? null,
      accessibility: pack.accessibility ?? null,
      content_pack: pack,
      assets: {
        tokens: assetTokens,
        unavailable: unavailableAssets,
      },
      // Surfaced rather than hidden: a missing prompt is a content gap the app
      // can report, and pretending otherwise makes it invisible.
      gaps: {
        missing_prompt_keys,
        missing_voice_keys,
      },
    },
  });
});

/// Test fixtures are joined through `series`, so the predicate needs the alias
/// and must tolerate games with no series at all.
///
/// `contentClassPredicate` is reused rather than reimplemented so the definition
/// of "production content" stays in one place; only the null-series allowance is
/// added here, because a standalone game has no series to classify.
function seriesClassPredicate(serveFixtures: boolean): string {
  const predicate = contentClassPredicate('s', serveFixtures);
  if (!predicate) return '';
  return ` AND (g.series_id IS NULL OR ${predicate.trim().replace(/^AND\s+/, '')})`;
}

/// Every asset id a resolved pack refers to.
function collectAssetIds(pack: Record<string, unknown>): string[] {
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

  return [...ids].sort();
}

export default gamesRoute;
