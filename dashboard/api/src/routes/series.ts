import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { cachedPublicJson } from '../lib/publicCache';
import { contentClassPredicate, shouldServeTestFixtures } from '../lib/contentClass';
import {
  applyArtworkUrl,
  artworkSelect,
  publicAssetBaseUrl,
  SERIES_COVER_ROLES,
} from '../lib/assetUrls';
import {
  availabilityContext,
  availabilityFor,
  availabilityForBatch,
  availabilityRefusal,
} from '../lib/requestGeo.ts';

type AppEnv = { Bindings: Env };

const seriesRoute = new Hono<AppEnv>();
const SERIES_TYPES = new Set(['continuous', 'anthology', 'knowledge', 'presenter', 'standalone']);

function pagination(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 0), 100) : fallback;
}

function ageRange(value: string | undefined): { min: number; max: number } | null | undefined {
  if (!value) return undefined;
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  return min >= 3 && max <= 12 && min <= max ? { min, max } : null;
}

// GET /api/v1/series - published catalog only. This response is intentionally
// free of rights, review, and private media fields so it can be edge-cached.
seriesRoute.get('/', async (c) => {
  const planet = c.req.query('planet');
  const type = c.req.query('type');
  const requestedAge = ageRange(c.req.query('age'));
  const limit = pagination(c.req.query('limit'), 20) || 20;
  const offset = pagination(c.req.query('offset'), 0);

  if (type && !SERIES_TYPES.has(type)) {
    return c.json({ success: false, error: 'Invalid series type' }, 400);
  }
  if (requestedAge === null) {
    return c.json({ success: false, error: 'age must use an inclusive range within 3-12, for example 6-8' }, 400);
  }

  const context = availabilityContext(c.req.raw, c.env);

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    // cover_url is resolved from asset_links/content_assets, not read straight
    // from the deprecated series.cover_url column. See lib/assetUrls.ts.
    let sql = `SELECT s.id, s.title_ar, s.title_en, s.slug, s.planet_id, s.type,
      s.age_min, s.age_max, s.cover_url, s.description_ar, s.description_en,
      s.production_level, s.is_free, s.price_tier, s.sort_order, s.published_at,
      p.name_ar AS planet_name, p.color_hex AS planet_color,
      ${artworkSelect('cover_asset', 'series', 's.id', SERIES_COVER_ROLES)},
      (SELECT COUNT(*) FROM seasons WHERE series_id = s.id AND status = 'published') AS seasons_count,
      (SELECT COUNT(*) FROM episodes WHERE series_id = s.id AND status = 'published' AND is_published = 1) AS episodes_count
      FROM series s
      LEFT JOIN planets p ON s.planet_id = p.id
      WHERE s.status = 'published'${contentClassPredicate('s', shouldServeTestFixtures(c.env))}`;
    const params: unknown[] = [];

    if (planet) { sql += ' AND s.planet_id = ?'; params.push(planet); }
    if (type) { sql += ' AND s.type = ?'; params.push(type); }
    if (requestedAge) {
      sql += ' AND s.age_max >= ? AND s.age_min <= ?';
      params.push(requestedAge.min, requestedAge.max);
    }

    sql += ' ORDER BY s.sort_order ASC, s.published_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const series = await queryAll<Record<string, unknown>>(c.env.DB, sql, params);

    // Territory availability, applied after the page is fetched.
    //
    // Filtering in SQL was rejected: the decision involves an inheritance chain and
    // a time window, so expressing it as a predicate would mean duplicating
    // lib/availabilityPolicy.ts in SQL — a second implementation of a rights rule,
    // which is the one place a divergence must never happen. One extra query per
    // page resolves the whole page (see availabilityForBatch).
    //
    // The consequence is a page that can return fewer rows than `limit` in a
    // restricted territory. That is honest: the alternative is refetching until the
    // page is full, which leaks the existence of the hidden rows through timing and
    // offset arithmetic.
    const decisions = await availabilityForBatch(c.env, 'series', series, (row) => ({
      id: String(row.id),
      series_id: String(row.id),
      planet_id: row.planet_id ? String(row.planet_id) : null,
    }), context);
    const visible = series.filter((row) => decisions.get(String(row.id))?.available !== false);

    const base = publicAssetBaseUrl(c.env);
    for (const row of visible) applyArtworkUrl(row, 'cover_asset', 'cover_url', base);
    return {
      success: true,
      data: visible,
      meta: {
        limit,
        offset,
        model: 'series_network_not_fixed_mascots',
        // Stated so a client showing "20 of N" cannot present a filtered page as a
        // complete one, and so support can see that filtering happened at all.
        withheld_in_territory: series.length - visible.length,
      },
    };
  }, 300, context.country ?? 'unknown');
});

// GET /api/v1/series/:id - public presentation data only.
seriesRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const exists = await queryFirst<{ id: string }>(
    c.env.DB,
    'SELECT id FROM series WHERE id = ? AND status = ?',
    [id, 'published'],
  );
  if (!exists) return c.json({ success: false, error: 'Series not found' }, 404);

  // Territory enforcement before anything is rendered.
  //
  // Outside the cached block on purpose: the refusal must not be stored under the
  // catalogue cache key, and a restricted request must not be able to warm the
  // cache for a permitted one.
  const context = availabilityContext(c.req.raw, c.env);
  const decision = await availabilityFor(c.env, 'series', id, context);
  if (!decision.available) {
    return c.json(availabilityRefusal(decision, context.country), 451);
  }

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const series = await queryFirst<Record<string, unknown>>(c.env.DB, `
      SELECT s.id, s.title_ar, s.title_en, s.slug, s.planet_id, s.type,
        s.age_min, s.age_max, s.cover_url, s.logo_url, s.description_ar,
        s.description_en, s.production_level, s.is_free, s.price_tier,
        s.published_at, p.name_ar AS planet_name,
        ${artworkSelect('cover_asset', 'series', 's.id', SERIES_COVER_ROLES)}
      FROM series s
      LEFT JOIN planets p ON s.planet_id = p.id
      WHERE s.id = ? AND s.status = 'published'${contentClassPredicate('s', shouldServeTestFixtures(c.env))}
    `, [id]);
    if (series) {
      applyArtworkUrl(series, 'cover_asset', 'cover_url', publicAssetBaseUrl(c.env));
    }
    const [seasons, characters, objectives] = await Promise.all([
      queryAll(c.env.DB, `
        SELECT id, season_number, title_ar, theme_ar, description_ar, episode_count,
          watch_order, release_date
        FROM seasons WHERE series_id = ? AND status = 'published' ORDER BY season_number ASC
      `, [id]),
      queryAll(c.env.DB, `
        SELECT id, name_ar, role, age, description_ar, traits
        FROM characters WHERE series_id = ? AND status = 'active' ORDER BY role ASC
      `, [id]),
      queryAll(c.env.DB, `
        SELECT lo.id, lo.code, lo.title_ar, lo.description_ar, lo.age_min, lo.age_max
        FROM learning_objectives lo
        JOIN series_learning_objectives slo ON slo.objective_id = lo.id
        WHERE slo.series_id = ?
      `, [id]).catch(() => []),
    ]);

    return {
      success: true,
      data: { series, seasons, characters, objectives },
      note: 'Each series has its own identity, characters, visual bible, and goals - not platform mascots',
    };
  });
});

export default seriesRoute;
