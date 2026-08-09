import { Hono } from 'hono';
import { queryAll } from '../lib/db';
import { cachedPublicJson } from '../lib/publicCache';
import {
  PLANET_COVER_ROLES,
  PLANET_ICON_ROLES,
  SERIES_COVER_ROLES,
  applyArtworkUrl,
  artworkSelect,
  publicAssetBaseUrl,
} from '../lib/assetUrls';

type Env = { Bindings: { DB: D1Database; CACHE: KVNamespace; PUBLIC_ASSET_BASE_URL?: string } };

const planetsRoute = new Hono<Env>();

// GET /api/v1/planets - قائمة الكواكب (تصنيف فقط، ليست عوالم قصصية)
//
// icon_url and cover_url are projected from asset_links + content_assets. The
// planets.icon_url column is deprecated and is only read as a fallback: it is
// NULL for every row, so selecting it directly reported no artwork even for
// planets that had a ready, public icon attached.
planetsRoute.get('/', async (c) => {
  const baseUrl = publicAssetBaseUrl(c.env);
  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const planets = await queryAll(c.env.DB, `
      SELECT id, name_ar, description_ar, color_hex, icon_url, sort_order,
        ${artworkSelect('icon_asset', 'planet', 'planets.id', PLANET_ICON_ROLES)},
        NULL AS cover_url,
        ${artworkSelect('cover_asset', 'planet', 'planets.id', PLANET_COVER_ROLES)}
      FROM planets WHERE is_active = 1 ORDER BY sort_order ASC
    `);
    for (const planet of planets as Record<string, unknown>[]) {
      applyArtworkUrl(planet, 'icon_asset', 'icon_url', baseUrl);
      applyArtworkUrl(planet, 'cover_asset', 'cover_url', baseUrl);
    }
    return { success: true, data: planets, meta: { total: planets.length, model: 'classification_not_story_world' } };
  });
});

// GET /api/v1/planets/:id - تفاصيل كوكب مع سلاسله
planetsRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const baseUrl = publicAssetBaseUrl(c.env);
  const planet = await queryAll(c.env.DB, `
    SELECT id, name_ar, name_en, description_ar, color_hex, icon_url, sort_order,
      ${artworkSelect('icon_asset', 'planet', 'planets.id', PLANET_ICON_ROLES)},
      NULL AS cover_url,
      ${artworkSelect('cover_asset', 'planet', 'planets.id', PLANET_COVER_ROLES)}
    FROM planets WHERE id = ? AND is_active = 1
  `, [id]);
  if (!planet.length) return c.json({ success: false, error: 'Planet not found' }, 404);

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    // Each series is an independent property; the planet is only navigation taxonomy.
    const series = await queryAll(c.env.DB, `
      SELECT id, title_ar, type, age_min, age_max, cover_url, production_level, is_free,
        ${artworkSelect('cover_asset', 'series', 'series.id', SERIES_COVER_ROLES)}
      FROM series WHERE planet_id = ? AND status = 'published' ORDER BY sort_order ASC
    `, [id]);
    const head = planet[0] as Record<string, unknown>;
    applyArtworkUrl(head, 'icon_asset', 'icon_url', baseUrl);
    applyArtworkUrl(head, 'cover_asset', 'cover_url', baseUrl);
    for (const row of series as Record<string, unknown>[]) {
      applyArtworkUrl(row, 'cover_asset', 'cover_url', baseUrl);
    }
    return { success: true, data: { planet: head, series } };
  });
});

export default planetsRoute;
