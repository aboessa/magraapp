import { Hono } from 'hono';
import { queryAll } from '../lib/db';
import { cachedPublicJson } from '../lib/publicCache';

type Env = { Bindings: { DB: D1Database; CACHE: KVNamespace } };

const planetsRoute = new Hono<Env>();

// GET /api/v1/planets - قائمة الكواكب (تصنيف فقط، ليست عوالم قصصية)
planetsRoute.get('/', async (c) => {
  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const planets = await queryAll(c.env.DB, `
      SELECT id, name_ar, description_ar, color_hex, icon_url, sort_order
      FROM planets WHERE is_active = 1 ORDER BY sort_order ASC
    `);
    return { success: true, data: planets, meta: { total: planets.length, model: 'classification_not_story_world' } };
  });
});

// GET /api/v1/planets/:id - تفاصيل كوكب مع سلاسله
planetsRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const planet = await queryAll(c.env.DB, `SELECT * FROM planets WHERE id = ? AND is_active = 1`, [id]);
  if (!planet.length) return c.json({ success: false, error: 'Planet not found' }, 404);

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    // Each series is an independent property; the planet is only navigation taxonomy.
    const series = await queryAll(c.env.DB, `
      SELECT id, title_ar, type, age_min, age_max, cover_url, production_level, is_free
      FROM series WHERE planet_id = ? AND status = 'published' ORDER BY sort_order ASC
    `, [id]);
    return { success: true, data: { planet: planet[0], series } };
  });
});

export default planetsRoute;
