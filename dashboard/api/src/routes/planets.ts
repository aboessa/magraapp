import { Hono } from 'hono';
import { queryAll } from '../lib/db.ts';
import { cachedPublicJson } from '../lib/publicCache.ts';
import {
  PLANET_COVER_ROLES,
  PLANET_ICON_ROLES,
  SERIES_COVER_ROLES,
  applyArtworkUrl,
  artworkSelect,
  publicAssetBaseUrl,
} from '../lib/assetUrls.ts';

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
    // `published_series` and `published_episodes` are measured, not assumed
    // (`CNT-106`).
    //
    // ## Why the counts are in this payload
    //
    // Nine planets are shown to a child and three of them are empty rooms:
    // `maharat` and `tarikh` have published series but **zero** published
    // episodes, and `islamic` has neither. The list said nothing about it, so a
    // child taps a planet and lands on nothing — which is worse than the planet
    // not being there, because the app promised something.
    //
    // Hiding an empty planet is the other tempting answer, and it is worse for a
    // different reason: the roadmap disappears, and a planet that is deliberately
    // "coming soon" becomes indistinguishable from one that was never planned.
    // So the API reports the fact and the client renders it honestly.
    //
    // ## Why "openable", and not a series count or an episode count
    //
    // A series is a folder: publishing one opens nothing. And episodes alone
    // misdescribe the shelf in both directions — measured on the local database,
    // counting episodes only calls `maharat` and `tarikh` empty when each has
    // three openable items (games and stories hang off `series`, not off
    // episodes), and calls `qiyam` full when it has none.
    //
    // So the number is what a child can actually open in this planet: published
    // episodes, stories, games and books, all reached through `series.planet_id`.
    // `published_series` stays alongside it for the dashboard, clearly separate.
    const planets = await queryAll(c.env.DB, `
      SELECT id, name_ar, description_ar, color_hex, icon_url, sort_order,
        ${artworkSelect('icon_asset', 'planet', 'planets.id', PLANET_ICON_ROLES)},
        NULL AS cover_url,
        ${artworkSelect('cover_asset', 'planet', 'planets.id', PLANET_COVER_ROLES)},
        (SELECT COUNT(*) FROM series s
          WHERE s.planet_id = planets.id AND s.status = 'published') AS published_series,
        (SELECT COUNT(*) FROM episodes e JOIN series s ON s.id = e.series_id
           WHERE s.planet_id = planets.id AND e.status = 'published' AND e.is_published = 1)
        + (SELECT COUNT(*) FROM stories st JOIN series s ON s.id = st.series_id
           WHERE s.planet_id = planets.id AND st.status = 'published')
        + (SELECT COUNT(*) FROM games g JOIN series s ON s.id = g.series_id
           WHERE s.planet_id = planets.id AND g.status = 'published')
        + (SELECT COUNT(*) FROM books b JOIN series s ON s.id = b.series_id
           WHERE s.planet_id = planets.id AND b.status = 'published') AS published_openable
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
