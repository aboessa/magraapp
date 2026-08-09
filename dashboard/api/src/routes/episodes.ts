import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { callDurable, familyStub } from '../lib/doClient';
import { cachedPublicJson } from '../lib/publicCache';
import { contentClassPredicate, shouldServeTestFixtures } from '../lib/contentClass';
import {
  applyArtworkUrl,
  artworkSelect,
  EPISODE_THUMBNAIL_ROLES,
  publicAssetBaseUrl,
} from '../lib/assetUrls';
import { authenticateParent, createMediaToken, mediaIsConfigured, type ParentPrincipal } from '../lib/parentAuth';
import {
  availabilityContext,
  availabilityFor,
  availabilityForBatch,
  availabilityRefusal,
} from '../lib/requestGeo.ts';
import type { AgeTrack, Plan } from '../lib/familyPolicy';

type AppEnv = { Bindings: Env };
type Envelope<T> = { success: boolean; data?: T; error?: string };

type CatalogMedia = {
  id: string;
  is_free: number;
  price_tier: Plan;
  learning_objective_id: string | null;
  duration_seconds: number | null;
  asset_id: string;
  r2_key: string;
  bucket: 'media' | 'thumbs';
  mime_type: string | null;
  original_filename: string | null;
  version: number;
  etag: string | null;
};

type PlaybackLease = {
  lease_id: string;
  expires_at: number;
  plan: Plan;
};

const episodesRoute = new Hono<AppEnv>();

function pagination(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 0), 100) : fallback;
}

function forward(result: { status: number; data: unknown }) {
  return Response.json(result.data ?? { success: false, error: 'Family service unavailable' }, { status: result.status });
}

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

async function catalogMedia(env: Env, episodeId: string) {
  const media = await queryFirst<CatalogMedia>(env.DB, `
    SELECT e.id, e.is_free, s.price_tier, e.learning_objective_id, e.duration_seconds,
      ca.id AS asset_id, ca.r2_key, ca.bucket, ca.mime_type,
      ca.original_filename, ca.version, ca.etag
    FROM episodes e
    JOIN series s ON s.id = e.series_id
    JOIN asset_links al ON al.entity_type = 'episode' AND al.entity_id = e.id
      AND al.role IN ('stream', 'video')
    JOIN content_assets ca ON ca.id = al.asset_id
    WHERE e.id = ? AND e.status = 'published' AND e.is_published = 1
      AND s.status = 'published' AND ca.status = 'ready'
      AND ca.visibility = 'private' AND ca.kind = 'video'
      AND ca.r2_key IS NOT NULL AND ca.bucket IS NOT NULL
    ORDER BY CASE al.role WHEN 'stream' THEN 0 ELSE 1 END, al.sort_order ASC
    LIMIT 1
  `, [episodeId]);
  if (!media) return null;
  const tracks = await queryAll<{ track_id: AgeTrack }>(env.DB, `
    SELECT track_id FROM episode_tracks WHERE episode_id = ? ORDER BY track_id
  `, [episodeId]);
  return { media, tracks: tracks.map((row) => row.track_id) };
}

async function issueMediaToken(env: Env, principal: ParentPrincipal, leaseId: string, media: CatalogMedia) {
  return createMediaToken(env, {
    sub: principal.parentId,
    sid: principal.sessionId,
    lid: leaseId,
    aid: media.asset_id,
    r2_key: media.r2_key,
    bucket: media.bucket,
    mime_type: media.mime_type,
    filename: media.original_filename,
    asset_version: media.version,
    etag: media.etag,
  });
}

episodesRoute.get('/', async (c) => {
  const seriesId = c.req.query('series_id');
  const limit = pagination(c.req.query('limit'), 20) || 20;
  const offset = pagination(c.req.query('offset'), 0);
  const context = availabilityContext(c.req.raw, c.env);

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    // thumbnail_url is resolved from asset_links/content_assets rather than the
    // deprecated episodes.thumbnail_url column. See lib/assetUrls.ts.
    let sql = `SELECT e.id, e.series_id, e.season_id, e.episode_number, e.title_ar,
      e.description_ar, e.thumbnail_url, e.duration_seconds, e.age_min, e.age_max,
      e.is_free, e.published_at, s.title_ar AS series_title, s.planet_id,
      ${artworkSelect('thumb_asset', 'episode', 'e.id', EPISODE_THUMBNAIL_ROLES)}
      FROM episodes e
      JOIN series s ON s.id = e.series_id
      WHERE e.status = 'published' AND e.is_published = 1 AND s.status = 'published'${contentClassPredicate('s', shouldServeTestFixtures(c.env))}`;
    const params: unknown[] = [];
    if (seriesId) { sql += ' AND e.series_id = ?'; params.push(seriesId); }
    sql += ' ORDER BY e.published_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const episodes = await queryAll<Record<string, unknown>>(c.env.DB, sql, params);

    // Season, series and planet are already joined for this response, so the whole
    // inheritance chain resolves with one extra query for the page. See
    // lib/requestGeo.ts for why this is not a SQL predicate.
    const decisions = await availabilityForBatch(c.env, 'episode', episodes, (row) => ({
      id: String(row.id),
      season_id: row.season_id ? String(row.season_id) : null,
      series_id: row.series_id ? String(row.series_id) : null,
      planet_id: row.planet_id ? String(row.planet_id) : null,
    }), context);
    const visible = episodes.filter((row) => decisions.get(String(row.id))?.available !== false);

    const base = publicAssetBaseUrl(c.env);
    for (const row of visible) applyArtworkUrl(row, 'thumb_asset', 'thumbnail_url', base);
    return {
      success: true,
      data: visible,
      meta: { limit, offset, withheld_in_territory: episodes.length - visible.length },
    };
  }, 300, context.country ?? 'unknown');
});

episodesRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const exists = await queryFirst<{ id: string }>(c.env.DB, `
    SELECT e.id FROM episodes e JOIN series s ON s.id = e.series_id
    WHERE e.id = ? AND e.status = 'published' AND e.is_published = 1 AND s.status = 'published'
  `, [id]);
  if (!exists) return c.json({ success: false, error: 'Episode not found' }, 404);

  const context = availabilityContext(c.req.raw, c.env);
  const decision = await availabilityFor(c.env, 'episode', id, context);
  if (!decision.available) {
    return c.json(availabilityRefusal(decision, context.country), 451);
  }

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const episode = await queryFirst<Record<string, unknown>>(c.env.DB, `
      SELECT e.id, e.series_id, e.season_id, e.episode_number, e.title_ar,
        e.description_ar, e.thumbnail_url, e.duration_seconds, e.captions_ar_url,
        e.age_min, e.age_max, e.new_words, e.skills, e.mastery_criteria,
        e.parent_guide_ar, e.questions, e.linked_game_id, e.linked_book_id,
        e.printable_url, e.family_activity_ar, e.is_free, e.published_at,
        s.title_ar AS series_title, s.type AS series_type,
        lo.title_ar AS objective_title,
        ${artworkSelect('thumb_asset', 'episode', 'e.id', EPISODE_THUMBNAIL_ROLES)}
      FROM episodes e
      JOIN series s ON s.id = e.series_id
      LEFT JOIN learning_objectives lo ON e.learning_objective_id = lo.id
      WHERE e.id = ? AND e.status = 'published' AND e.is_published = 1 AND s.status = 'published'
    `, [id]);
    if (episode) {
      applyArtworkUrl(episode, 'thumb_asset', 'thumbnail_url', publicAssetBaseUrl(c.env));
    }
    const linkedGameId = typeof episode?.linked_game_id === 'string' ? episode.linked_game_id : null;
    const game = linkedGameId ? await queryFirst(c.env.DB, `
      SELECT id, title_ar, instructions_ar, difficulty, max_attempts
      FROM games WHERE id = ? AND status = 'published'
    `, [linkedGameId]) : null;
    const parsed = <T>(value: unknown, fallback: T): T => {
      if (typeof value !== 'string') return fallback;
      try { return JSON.parse(value) as T; } catch { return fallback; }
    };
    return {
      success: true,
      data: {
        episode,
        game,
        questions: parsed(episode?.questions, []),
        parent_guide: episode?.parent_guide_ar ?? null,
        family_activity: episode?.family_activity_ar ?? null,
        new_words: parsed(episode?.new_words, []),
      },
    };
  });
});

episodesRoute.post('/:id/playback-sessions', async (c) => {
  if (!mediaIsConfigured(c.env)) return c.json({ success: false, error: 'Secure media delivery is not configured' }, 503);
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const value = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const childId = typeof value?.child_id === 'string' ? value.child_id : '';
  if (!childId) return c.json({ success: false, error: 'child_id required' }, 400);

  const catalog = await catalogMedia(c.env, c.req.param('id'));
  if (!catalog) return c.json({ success: false, error: 'Protected episode media is unavailable' }, 404);

  // Territory enforcement at the point that actually hands over the video.
  //
  // The catalogue endpoints already filter, but a client that cached an episode id
  // before travelling — or any caller with curl — reaches this endpoint directly.
  // Enforcing only in the listing would make the restriction cosmetic, which is the
  // exact state the rights registry was in before: recorded and never consulted.
  const playbackContext = availabilityContext(c.req.raw, c.env);
  const playbackDecision = await availabilityFor(c.env, 'episode', catalog.media.id, playbackContext);
  if (!playbackDecision.available) {
    return c.json(availabilityRefusal(playbackDecision, playbackContext.country), 451);
  }

  const requiredPlan: Plan = catalog.media.is_free ? 'free' : catalog.media.price_tier;
  const created = await callDurable<Envelope<PlaybackLease>>(familyStub(c.env, auth.principal.parentId), '/playback/start', {
    body: {
      session_id: auth.principal.sessionId,
      child_id: childId,
      asset_id: catalog.media.asset_id,
      entity_type: 'episode',
      entity_id: catalog.media.id,
      required_plan: requiredPlan,
      allowed_tracks: catalog.tracks,
    },
  });
  const lease = created.data?.success ? created.data.data : null;
  if (!created.ok || !lease) return forward(created);

  const token = await issueMediaToken(c.env, auth.principal, lease.lease_id, catalog.media);
  return c.json({
    success: true,
    data: {
      stream_url: `/api/v1/media/assets/${catalog.media.asset_id}`,
      authorization: `Bearer ${token}`,
      expires_at: new Date(lease.expires_at).toISOString(),
      capability_expires_in: 180,
      content_type: catalog.media.mime_type,
      protection: 'access_controlled_no_drm',
    },
  }, 201);
});

episodesRoute.post('/:id/playback-sessions/:leaseId/heartbeat', async (c) => {
  if (!mediaIsConfigured(c.env)) return c.json({ success: false, error: 'Secure media delivery is not configured' }, 503);
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const catalog = await catalogMedia(c.env, c.req.param('id'));
  if (!catalog) return c.json({ success: false, error: 'Protected episode media is unavailable' }, 404);

  const requiredPlan: Plan = catalog.media.is_free ? 'free' : catalog.media.price_tier;
  const heartbeat = await callDurable<Envelope<{
    lease_id: string; expires_at: number; asset_id: string; entity_id: string;
  }>>(familyStub(c.env, auth.principal.parentId), '/playback/heartbeat', {
    body: {
      session_id: auth.principal.sessionId,
      lease_id: c.req.param('leaseId'),
      required_plan: requiredPlan,
      allowed_tracks: catalog.tracks,
    },
  });
  const lease = heartbeat.data?.success ? heartbeat.data.data : null;
  if (!heartbeat.ok || !lease) return forward(heartbeat);
  if (lease.asset_id !== catalog.media.asset_id || lease.entity_id !== catalog.media.id) {
    return c.json({ success: false, error: 'Playback lease is unavailable' }, 404);
  }
  const token = await issueMediaToken(c.env, auth.principal, lease.lease_id, catalog.media);
  return c.json({
    success: true,
    data: {
      authorization: `Bearer ${token}`,
      expires_at: new Date(lease.expires_at).toISOString(),
      capability_expires_in: 180,
    },
  });
});

episodesRoute.post('/:id/playback-sessions/:leaseId/end', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/playback/end', {
    body: { session_id: auth.principal.sessionId, lease_id: c.req.param('leaseId') },
  }));
});

episodesRoute.get('/:id/stream', (c) => c.json({
  success: false,
  error: 'Use an authenticated playback session',
}, 405));

episodesRoute.post('/:id/progress', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const value = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400);
  const childId = typeof value.child_id === 'string' ? value.child_id : '';
  const progressSeconds = Number(value.progress_seconds ?? 0);
  if (!childId) return c.json({ success: false, error: 'child_id required' }, 400);
  if (!Number.isFinite(progressSeconds) || progressSeconds < 0) {
    return c.json({ success: false, error: 'progress_seconds must be a non-negative number' }, 400);
  }

  const episode = await queryFirst<{ id: string; learning_objective_id: string | null; duration_seconds: number | null }>(c.env.DB, `
    SELECT e.id, e.learning_objective_id, e.duration_seconds FROM episodes e
    JOIN series s ON s.id = e.series_id
    WHERE e.id = ? AND e.status = 'published' AND e.is_published = 1 AND s.status = 'published'
  `, [c.req.param('id')]);
  if (!episode) return c.json({ success: false, error: 'Episode not found' }, 404);

  if (value.answers !== undefined) {
    const score = Number(value.score);
    const maxScore = Number(value.max_score);
    const timeSpent = Number(value.time_spent ?? 0);
    if (!Number.isInteger(score) || !Number.isInteger(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
      return c.json({ success: false, error: 'score and a positive max_score are required for an attempt' }, 400);
    }
    if (!Number.isInteger(timeSpent) || timeSpent < 0) {
      return c.json({ success: false, error: 'time_spent must be a non-negative integer' }, 400);
    }
  }

  const durationSeconds = Number(value.duration_seconds ?? episode.duration_seconds ?? 0);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return c.json({ success: false, error: 'duration_seconds must be non-negative' }, 400);
  }
  const result = await callDurable(familyStub(c.env, auth.principal.parentId), '/progress', {
    body: {
      ...value,
      session_id: auth.principal.sessionId,
      child_id: childId,
      content_type: 'episode',
      content_id: episode.id,
      objective_id: episode.learning_objective_id,
      event_id: typeof value.event_id === 'string' ? value.event_id : crypto.randomUUID(),
      position_ms: Math.floor(progressSeconds * 1000),
      duration_ms: Math.floor(durationSeconds * 1000),
      completed: value.is_completed === true,
    },
  });
  return forward(result);
});

export default episodesRoute;
