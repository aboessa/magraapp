import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { cachedPublicJson } from '../lib/publicCache.ts';
import {
  isPubliclyServableAsset,
  publicAssetBaseUrl,
  publicAssetUrl,
} from '../lib/assetUrls.ts';
import { availabilityContext, availabilityFor, availabilityRefusal } from '../lib/requestGeo.ts';
import { optionalContentClassPredicate, shouldServeTestFixtures } from '../lib/contentClass.ts';
import type { Plan } from '../lib/familyPolicy.ts';

/// `artworkSelect` is typed to `series|episode`, so this local variant covers
/// `story` and `story_page`. Roles are inlined from constants, never request input.
function assetSelect(
  prefix: string,
  entityType: 'story' | 'story_page',
  entityIdColumn: string,
  roles: readonly string[],
  kinds: readonly string[],
): string {
  const roleList = roles.map((role) => `'${role}'`).join(', ');
  const kindList = kinds.map((kind) => `'${kind}'`).join(', ');
  const rolePriority = roles.map((role, index) => `WHEN '${role}' THEN ${index}`).join(' ');
  const pick = (column: string) => `
    (SELECT ca.${column}
       FROM asset_links al
       JOIN content_assets ca ON ca.id = al.asset_id
      WHERE al.entity_type = '${entityType}'
        AND al.entity_id = ${entityIdColumn}
        AND al.role IN (${roleList})
        AND ca.status = 'ready'
        AND ca.visibility = 'public'
        AND ca.r2_key IS NOT NULL
        AND ca.kind IN (${kindList})
      ORDER BY CASE al.role ${rolePriority} ELSE 99 END, al.sort_order ASC
      LIMIT 1) AS ${prefix}_${column}`;
  return [pick('r2_key'), pick('visibility'), pick('status'), pick('kind')].join(',');
}

function applyAssetUrl(
  row: Record<string, unknown>,
  prefix: string,
  targetField: string,
  baseUrl: string | null,
): void {
  const asset = {
    r2_key: (row[`${prefix}_r2_key`] ?? null) as string | null,
    visibility: (row[`${prefix}_visibility`] ?? null) as string | null,
    status: (row[`${prefix}_status`] ?? null) as string | null,
    kind: (row[`${prefix}_kind`] ?? null) as string | null,
  };
  row[targetField] = isPubliclyServableAsset(asset) ? publicAssetUrl(baseUrl, asset) : null;
  for (const column of ['r2_key', 'visibility', 'status', 'kind']) delete row[`${prefix}_${column}`];
}

type AppEnv = { Bindings: Env };
type Envelope<T> = { success: boolean; data?: T; error?: string };
type AudioAccess = 'public' | 'protected' | 'unavailable';
type NarrationMedia = {
  story_id: string;
  is_free: number;
  asset_id: string;
  r2_key: string;
  bucket: 'media' | 'thumbs';
  mime_type: string | null;
  original_filename: string | null;
  version: number;
  etag: string | null;
};

type AudioTrack = {
  language: string;
  kind: 'narration' | 'bubble';
  access: Exclude<AudioAccess, 'unavailable'>;
  url: string | null;
  bubble_id?: string;
};

const storiesRoute = new Hono<AppEnv>();

const STORY_TYPES = new Set(['picture_book', 'audio_story', 'interactive', 'comic']);
const STORY_COVER_ROLES = ['cover', 'poster'] as const;
const PAGE_IMAGE_ROLES = ['page', 'illustration', 'cover'] as const;
const LANGUAGE_TAG = /^[a-z]{2}(-[a-z]{2})?$/;

function pagination(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 0), 100) : fallback;
}

function ageRange(value: string | undefined): { min: number; max: number } | null | undefined {
  if (!value) return undefined;
  const parts = value.split('-').map((p) => Number.parseInt(p.trim(), 10));
  if (parts.length !== 2 || parts.some((n) => !Number.isInteger(n))) return null;
  const [min, max] = parts;
  if (min < 3 || max > 12 || min > max) return null;
  return { min, max };
}

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function parseStringMap(value: unknown): Record<string, string> {
  const parsed = parseObject(value);
  return Object.fromEntries(
    Object.entries(parsed)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, item]) => [key.toLowerCase(), item.trim()])
      .filter(([, item]) => item.length > 0),
  );
}

function parseObjectArray(value: unknown): Array<Record<string, unknown>> {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item),
  );
}

function parseLanguages(value: unknown, fallback: string): string[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = [];
    }
  }
  const languages = Array.isArray(parsed)
    ? parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => LANGUAGE_TAG.test(item))
    : [];
  return [...new Set([fallback, ...languages])];
}

function audioTrackFromAsset(
  asset: Record<string, unknown> | null | undefined,
  language: string,
  kind: AudioTrack['kind'],
  baseUrl: string | null,
  bubbleId?: string,
): AudioTrack | null {
  if (!asset || asset.status !== 'ready' || asset.kind !== 'audio') return null;
  const r2Key = typeof asset.r2_key === 'string' && asset.r2_key ? asset.r2_key : null;
  if (!r2Key) return null;

  const publicAsset = {
    r2_key: r2Key,
    visibility: typeof asset.visibility === 'string' ? asset.visibility : null,
    status: 'ready',
    kind: 'audio',
  };
  const publicUrl = isPubliclyServableAsset(publicAsset)
    ? publicAssetUrl(baseUrl, publicAsset)
    : null;
  if (publicUrl) {
    return {
      language,
      kind,
      access: 'public',
      url: publicUrl,
      ...(bubbleId ? { bubble_id: bubbleId } : {}),
    };
  }
  if (asset.visibility === 'private' && (asset.bucket === 'media' || asset.bucket === 'thumbs')) {
    return {
      language,
      kind,
      access: 'protected',
      url: null,
      ...(bubbleId ? { bubble_id: bubbleId } : {}),
    };
  }
  return null;
}

function trackFromAliasedRow(
  row: Record<string, unknown>,
  prefix: string,
  language: string,
  kind: AudioTrack['kind'],
  baseUrl: string | null,
  bubbleId?: string,
): AudioTrack | null {
  const asset = {
    r2_key: row[`${prefix}_r2_key`],
    visibility: row[`${prefix}_visibility`],
    status: row[`${prefix}_status`],
    kind: row[`${prefix}_kind`],
    bucket: row[`${prefix}_bucket`],
  };
  for (const column of ['r2_key', 'visibility', 'status', 'kind', 'bucket']) {
    delete row[`${prefix}_${column}`];
  }
  return audioTrackFromAsset(asset, language, kind, baseUrl, bubbleId);
}

function forward(result: { status: number; data: unknown }) {
  return Response.json(
    result.data ?? { success: false, error: 'Family service unavailable' },
    { status: result.status },
  );
}

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

async function storyNarrationMedia(
  env: Env,
  storyId: string,
  pageId: string,
  language: string,
  bubbleId: string | null,
): Promise<NarrationMedia | null> {
  if (!bubbleId) {
    return queryFirst<NarrationMedia>(env.DB, `
      SELECT s.id AS story_id, s.is_free,
        ca.id AS asset_id, ca.r2_key, ca.bucket, ca.mime_type,
        ca.original_filename, ca.version, ca.etag
      FROM stories s
      JOIN story_pages sp ON sp.story_id = s.id AND sp.id = ?
      JOIN story_page_localizations spl ON spl.page_id = sp.id AND spl.language = ?
      JOIN content_assets ca ON ca.id = spl.narration_asset_id
      WHERE s.id = ? AND s.status = 'published'
        AND ca.status = 'ready' AND ca.kind = 'audio'
        AND ca.visibility = 'private'
        AND ca.r2_key IS NOT NULL AND ca.bucket IS NOT NULL
      LIMIT 1
    `, [pageId, language, storyId]);
  }

  const bubble = await queryFirst<{ audio_tracks: unknown }>(env.DB, `
    SELECT sb.audio_tracks
      FROM story_bubbles sb
      JOIN story_pages sp ON sp.id = sb.page_id
      JOIN stories s ON s.id = sp.story_id
     WHERE sb.id = ? AND sp.id = ? AND s.id = ? AND s.status = 'published'
     LIMIT 1
  `, [bubbleId, pageId, storyId]);
  const assetId = parseStringMap(bubble?.audio_tracks)[language];
  if (!assetId) return null;

  return queryFirst<NarrationMedia>(env.DB, `
    SELECT s.id AS story_id, s.is_free,
      ca.id AS asset_id, ca.r2_key, ca.bucket, ca.mime_type,
      ca.original_filename, ca.version, ca.etag
    FROM stories s
    JOIN content_assets ca ON ca.id = ?
    WHERE s.id = ? AND s.status = 'published'
      AND ca.status = 'ready' AND ca.kind = 'audio'
      AND ca.visibility = 'private'
      AND ca.r2_key IS NOT NULL AND ca.bucket IS NOT NULL
    LIMIT 1
  `, [assetId, storyId]);
}

// GET /api/v1/stories - published catalogue only.
storiesRoute.get('/', async (c) => {
  const type = c.req.query('type');
  const requestedAge = ageRange(c.req.query('age'));
  const limit = pagination(c.req.query('limit'), 20) || 20;
  const offset = pagination(c.req.query('offset'), 0);

  if (type && !STORY_TYPES.has(type)) {
    return c.json({ success: false, error: 'Invalid story type' }, 400);
  }
  if (requestedAge === null) {
    return c.json(
      { success: false, error: 'age must use an inclusive range within 3-12, for example 6-8' },
      400,
    );
  }

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    let sql = `SELECT s.id, s.slug, s.title_ar, s.title_en, s.description_ar, s.type,
        s.age_min, s.age_max, s.reading_level, s.is_free, s.series_id,
        s.default_language, s.languages,
        ser.title_ar AS series_title, p.name_ar AS planet_name,
        (SELECT COUNT(*) FROM story_pages sp WHERE sp.story_id = s.id) AS pages_count,
        ${assetSelect('cover_asset', 'story', 's.id', STORY_COVER_ROLES, ['image'])}
      FROM stories s
      LEFT JOIN series ser ON ser.id = s.series_id
      LEFT JOIN planets p ON p.id = ser.planet_id
      WHERE s.status = 'published'${optionalContentClassPredicate('ser', shouldServeTestFixtures(c.env))}`;
    const params: unknown[] = [];

    if (type) {
      sql += ' AND s.type = ?';
      params.push(type);
    }
    if (requestedAge) {
      sql += ' AND s.age_max >= ? AND s.age_min <= ?';
      params.push(requestedAge.min, requestedAge.max);
    }

    sql += ' ORDER BY s.sort_order ASC, s.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stories = await queryAll<Record<string, unknown>>(c.env.DB, sql, params);
    const base = publicAssetBaseUrl(c.env);
    for (const row of stories) {
      applyAssetUrl(row, 'cover_asset', 'cover_url', base);
      const defaultLanguage = typeof row.default_language === 'string'
        ? row.default_language.toLowerCase()
        : 'ar';
      row.languages = parseLanguages(row.languages, defaultLanguage);
    }

    return {
      success: true,
      data: stories,
      meta: { limit, offset },
    };
  });
});

// GET /api/v1/stories/:id - single published story.
storiesRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const exists = await queryFirst<{ id: string }>(
    c.env.DB,
    `SELECT s.id FROM stories s
       LEFT JOIN series ser ON ser.id = s.series_id
      WHERE s.id = ? AND s.status = 'published'${optionalContentClassPredicate('ser', shouldServeTestFixtures(c.env))}`,
    [id],
  );
  if (!exists) return c.json({ success: false, error: 'Story not found' }, 404);

  const context = availabilityContext(c.req.raw, c.env);
  const decision = await availabilityFor(c.env, 'story', id, context);
  if (!decision.available) {
    return c.json(availabilityRefusal(decision, context.country), 451);
  }

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const story = await queryFirst<Record<string, unknown>>(
      c.env.DB,
      `SELECT s.id, s.slug, s.title_ar, s.title_en, s.description_ar, s.description_en,
          s.type, s.age_min, s.age_max, s.reading_level, s.interaction_mode,
          s.supervision_level, s.is_free, s.series_id, s.default_language, s.languages,
          ser.title_ar AS series_title, p.name_ar AS planet_name,
          (SELECT COUNT(*) FROM story_pages sp WHERE sp.story_id = s.id) AS pages_count,
          ${assetSelect('cover_asset', 'story', 's.id', STORY_COVER_ROLES, ['image'])}
        FROM stories s
        LEFT JOIN series ser ON ser.id = s.series_id
        LEFT JOIN planets p ON p.id = ser.planet_id
        WHERE s.id = ? AND s.status = 'published'${optionalContentClassPredicate('ser', shouldServeTestFixtures(c.env))}`,
      [id],
    );
    if (story) {
      const base = publicAssetBaseUrl(c.env);
      applyAssetUrl(story, 'cover_asset', 'cover_url', base);
      const defaultLanguage = typeof story.default_language === 'string'
        ? story.default_language.toLowerCase()
        : 'ar';
      story.languages = parseLanguages(story.languages, defaultLanguage);
    }
    return { success: true, data: story };
  });
});

// GET /api/v1/stories/:id/pages - reader content for exactly one language.
storiesRoute.get('/:id/pages', async (c) => {
  const id = c.req.param('id');
  const language = (c.req.query('language') ?? 'ar').trim().toLowerCase();

  if (!LANGUAGE_TAG.test(language)) {
    return c.json({ success: false, error: 'Invalid language tag' }, 400);
  }

  const exists = await queryFirst<{ id: string }>(
    c.env.DB,
    `SELECT s.id FROM stories s
       LEFT JOIN series ser ON ser.id = s.series_id
      WHERE s.id = ? AND s.status = 'published'${optionalContentClassPredicate('ser', shouldServeTestFixtures(c.env))}`,
    [id],
  );
  if (!exists) return c.json({ success: false, error: 'Story not found' }, 404);

  const context = availabilityContext(c.req.raw, c.env);
  const decision = await availabilityFor(c.env, 'story', id, context);
  if (!decision.available) {
    return c.json(availabilityRefusal(decision, context.country), 451);
  }

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const [story, pages, languageRows, bubbleRows] = await Promise.all([
      queryFirst<Record<string, unknown>>(
        c.env.DB,
        `SELECT default_language, languages FROM stories WHERE id = ? AND status = 'published'`,
        [id],
      ),
      queryAll<Record<string, unknown>>(
        c.env.DB,
        `SELECT sp.id, sp.page_number, sp.layout, sp.transition, sp.duration_ms, sp.dwell_ms,
            spl.page_id AS localization_page_id, spl.body_text, spl.alt_text, spl.timing_cues,
            ca.r2_key AS page_asset_r2_key, ca.visibility AS page_asset_visibility,
            ca.status AS page_asset_status, ca.kind AS page_asset_kind,
            ca.expected_width AS image_width, ca.expected_height AS image_height,
            ca.aspect_ratio AS image_aspect_ratio,
            na.r2_key AS narration_asset_r2_key, na.visibility AS narration_asset_visibility,
            na.status AS narration_asset_status, na.kind AS narration_asset_kind,
            na.bucket AS narration_asset_bucket
          FROM story_pages sp
          LEFT JOIN story_page_localizations spl
            ON spl.page_id = sp.id AND spl.language = ?
          LEFT JOIN content_assets ca
            ON ca.id = sp.image_asset_id
           AND ca.status = 'ready' AND ca.visibility = 'public'
           AND ca.r2_key IS NOT NULL AND ca.kind = 'image'
          LEFT JOIN content_assets na
            ON na.id = spl.narration_asset_id
           AND na.status = 'ready' AND na.kind = 'audio' AND na.r2_key IS NOT NULL
          WHERE sp.story_id = ?
          ORDER BY sp.page_number ASC`,
        [language, id],
      ),
      queryAll<Record<string, unknown>>(
        c.env.DB,
        `SELECT spl.page_id, spl.language, spl.body_text,
            CASE WHEN na.id IS NULL THEN 0 ELSE 1 END AS narration_ready
           FROM story_page_localizations spl
           JOIN story_pages sp ON sp.id = spl.page_id
           LEFT JOIN content_assets na
             ON na.id = spl.narration_asset_id
            AND na.status = 'ready' AND na.kind = 'audio' AND na.r2_key IS NOT NULL
          WHERE sp.story_id = ?`,
        [id],
      ),
      queryAll<Record<string, unknown>>(
        c.env.DB,
        `SELECT sb.id, sb.page_id, sb.kind, sb.position_x, sb.position_y,
            sb.width, sb.height, sb.localized_text, sb.audio_tracks, sb.sort_order
           FROM story_bubbles sb
           JOIN story_pages sp ON sp.id = sb.page_id
          WHERE sp.story_id = ?
          ORDER BY sp.page_number, sb.sort_order`,
        [id],
      ),
    ]);

    const requestedBubbleAssetIds = [...new Set(bubbleRows
      .map((row) => parseStringMap(row.audio_tracks)[language])
      .filter((assetId): assetId is string => !!assetId))];
    const bubbleAssets = requestedBubbleAssetIds.length
      ? await queryAll<Record<string, unknown>>(
        c.env.DB,
        `SELECT id, r2_key, visibility, status, kind, bucket
           FROM content_assets
          WHERE id IN (${requestedBubbleAssetIds.map(() => '?').join(', ')})`,
        requestedBubbleAssetIds,
      )
      : [];
    const bubbleAssetsById = new Map(bubbleAssets.map((asset) => [String(asset.id), asset]));

    const defaultLanguage = typeof story?.default_language === 'string'
      ? story.default_language.toLowerCase()
      : 'ar';
    const declaredLanguages = parseLanguages(story?.languages, defaultLanguage);
    const base = publicAssetBaseUrl(c.env);

    const bubblesByPage = new Map<string, Array<Record<string, unknown>>>();
    const bubbleTextPages = new Map<string, Set<string>>();
    for (const row of bubbleRows) {
      const pageId = String(row.page_id);
      const localized = parseStringMap(row.localized_text);
      for (const [code, value] of Object.entries(localized)) {
        if (!value) continue;
        if (!bubbleTextPages.has(code)) bubbleTextPages.set(code, new Set());
        bubbleTextPages.get(code)!.add(pageId);
      }

      const assetId = parseStringMap(row.audio_tracks)[language];
      const track = assetId
        ? audioTrackFromAsset(bubbleAssetsById.get(assetId), language, 'bubble', base, String(row.id))
        : null;
      const text = localized[language] ?? null;
      if (!text && !track) continue;

      const resolved = {
        id: String(row.id),
        kind: typeof row.kind === 'string' ? row.kind : 'dialogue',
        position_x: Number(row.position_x) || 0,
        position_y: Number(row.position_y) || 0,
        width: Number(row.width) || 30,
        height: Number(row.height) || 20,
        text,
        sort_order: Number(row.sort_order) || 0,
        audio_available: !!track,
        audio_access: track?.access ?? 'unavailable',
        tracks: track ? [track] : [],
      };
      if (!bubblesByPage.has(pageId)) bubblesByPage.set(pageId, []);
      bubblesByPage.get(pageId)!.push(resolved);
    }

    for (const row of pages) {
      applyAssetUrl(row, 'page_asset', 'image_url', base);
      const track = trackFromAliasedRow(row, 'narration_asset', language, 'narration', base);
      const bubbles = bubblesByPage.get(String(row.id)) ?? [];
      row.timing_cues = parseObjectArray(row.timing_cues);
      row.bubbles = bubbles;
      row.translation_available = typeof row.body_text === 'string' && row.body_text.trim().length > 0
        || bubbles.some((bubble) => typeof bubble.text === 'string' && bubble.text.length > 0);
      row.audio_available = !!track;
      row.audio_access = track?.access ?? 'unavailable';
      row.tracks = track ? [track] : [];
      row.audio_url = track?.url ?? null;
      delete row.localization_page_id;
    }

    const textPages = new Map<string, Set<string>>();
    const narrationPages = new Map<string, Set<string>>();
    for (const row of languageRows) {
      const code = typeof row.language === 'string' ? row.language.toLowerCase() : '';
      if (!LANGUAGE_TAG.test(code)) continue;
      const pageId = String(row.page_id);
      if (typeof row.body_text === 'string' && row.body_text.trim()) {
        if (!textPages.has(code)) textPages.set(code, new Set());
        textPages.get(code)!.add(pageId);
      }
      if (Number(row.narration_ready) === 1) {
        if (!narrationPages.has(code)) narrationPages.set(code, new Set());
        narrationPages.get(code)!.add(pageId);
      }
    }

    const languageCodes = new Set<string>([
      ...declaredLanguages,
      ...textPages.keys(),
      ...narrationPages.keys(),
      ...bubbleTextPages.keys(),
      language,
    ]);
    const languages = [...languageCodes].map((code) => {
      const translated = new Set([
        ...(textPages.get(code) ?? []),
        ...(bubbleTextPages.get(code) ?? []),
      ]);
      const translatedPages = translated.size;
      const narratedPages = narrationPages.get(code)?.size ?? 0;
      return {
        code,
        declared: declaredLanguages.includes(code),
        translated_pages: translatedPages,
        narrated_pages: narratedPages,
        total_pages: pages.length,
        translation_available: translatedPages > 0,
        translation_complete: pages.length > 0 && translatedPages >= pages.length,
      };
    });
    const requestedLanguage = languages.find((item) => item.code === language);
    const withAudio = pages.filter((row) => row.audio_available === true).length;

    return {
      success: true,
      data: pages,
      meta: {
        language,
        default_language: defaultLanguage,
        languages,
        translation_available: requestedLanguage?.translation_available ?? false,
        translation_complete: requestedLanguage?.translation_complete ?? false,
        total: pages.length,
        renderable: pages.filter(
          (row) =>
            row.body_text !== null ||
            row.image_url !== null ||
            (Array.isArray(row.bubbles) && row.bubbles.length > 0),
        ).length,
        with_audio: withAudio,
        with_protected_audio: pages.filter((row) => row.audio_access === 'protected').length,
      },
    };
  });
});

// POST /api/v1/stories/:id/audio-sessions - private page/bubble narration.
storiesRoute.post('/:id/audio-sessions', async (c) => {
  // Keep the public catalogue module loadable without pulling authentication
  // dependencies into read-only requests. Wrangler still sees these literal
  // imports and bundles them; Node's public-route tests do not resolve them
  // unless this protected endpoint is invoked.
  const [parentAuth, durableClient] = await Promise.all([
    import('../lib/parentAuth.ts'),
    import('../lib/doClient.ts'),
  ]);
  const { authenticateParent, createMediaToken, mediaIsConfigured } = parentAuth;
  const { callDurable, familyStub } = durableClient;

  if (!mediaIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Secure media delivery is not configured' }, 503);
  }
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const childId = typeof body?.child_id === 'string' ? body.child_id : '';
  const pageId = typeof body?.page_id === 'string' ? body.page_id : '';
  const language = typeof body?.language === 'string' ? body.language.trim().toLowerCase() : 'ar';
  const bubbleId = typeof body?.bubble_id === 'string' && body.bubble_id ? body.bubble_id : null;
  if (!childId) return c.json({ success: false, error: 'child_id required' }, 400);
  if (!pageId) return c.json({ success: false, error: 'page_id required' }, 400);
  if (!LANGUAGE_TAG.test(language)) {
    return c.json({ success: false, error: 'Invalid language tag' }, 400);
  }

  const storyId = c.req.param('id');
  const media = await storyNarrationMedia(c.env, storyId, pageId, language, bubbleId);
  if (!media) {
    return c.json({ success: false, error: 'Protected narration is unavailable' }, 404);
  }

  const context = availabilityContext(c.req.raw, c.env);
  const decision = await availabilityFor(c.env, 'story', storyId, context);
  if (!decision.available) {
    return c.json(availabilityRefusal(decision, context.country), 451);
  }

  const state = await callDurable<Envelope<{
    family: { plan: Plan };
    children: Array<{ id: string }>;
  }>>(familyStub(c.env, auth.principal.parentId), '/state');
  const family = state.data?.success ? state.data.data : null;
  if (!state.ok || !family) return forward(state);

  if (!family.children.some((child) => child.id === childId)) {
    return c.json({ success: false, error: 'Active child profile not found' }, 404);
  }
  if (!media.is_free && family.family.plan === 'free') {
    return c.json(
      { success: false, error: 'An active subscription is required for this story' },
      403,
    );
  }

  const token = await createMediaToken(c.env, {
    sub: auth.principal.parentId,
    sid: auth.principal.sessionId,
    lid: `story-audio:${media.asset_id}`,
    aid: media.asset_id,
    r2_key: media.r2_key,
    bucket: media.bucket,
    mime_type: media.mime_type,
    filename: media.original_filename,
    asset_version: media.version,
    etag: media.etag,
  });

  return c.json({
    success: true,
    data: {
      stream_url: `/api/v1/media/assets/${media.asset_id}`,
      authorization: `Bearer ${token}`,
      capability_expires_in: 180,
      content_type: media.mime_type,
      protection: 'access_controlled_no_drm',
    },
  }, 201);
});

export default storiesRoute;
