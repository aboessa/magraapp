/**
 * Public Creative Studio — R2-first listings for Flutter.
 * No auth. CDN URLs via PUBLIC_ASSET_BASE_URL.
 * Child doesn't need auth to browse templates; save/share happens local.
 *
 * GET /creative-studio/home -> categories summary + featured + hero URLs
 * GET /creative-studio/drawings?category=&status=&featured=&q=&limit=&offset=
 * GET /creative-studio/drawings/:id
 *
 * Also re-uses existing /creative/coloring legacy endpoint via view, but this new
 * route is canonical for v2 R2-backed.
 */
import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { publicAssetBaseUrl } from '../lib/assetUrls.ts';

type AppEnv = { Bindings: Env };
const app = new Hono<AppEnv>();

const PALETTE_DEFAULT = ["#2B5AD8","#FF7E3A","#FFD400","#2EAC5A","#6A3DF2","#FF3E78","#111111","#FF8F2A"];

function parseJsonSafe(v: unknown, fallback: any) {
  if (typeof v !== 'string') return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

function buildUrl(base: string|null, key: string|null): string|null {
  if (!key) return null;
  if (!base) return `/${key.replace(/^\/+/,'')}`; // relative fallback
  const clean = key.replace(/^\/+/,'');
  // cache-buster v=3 forces edge cache miss after fixing R2 object content-type
  // (v=2 responses were cached as image/jpeg for png/webp objects)
  // R2 ignores query for object lookup but edge cache key includes it
  return `${base}/${clean}?v=3`;
}

function rowToPublic(row: any, base: string|null) {
  const key = String(row.r2_key||'');
  const thumbKey = row.thumb_r2_key ? String(row.thumb_r2_key) : null;
  const transKey = row.transparent_r2_key ? String(row.transparent_r2_key) : null;
  const extra = parseJsonSafe(row.extra_json, null);
  const referenceFullKey = typeof extra?.reference_full === 'string'
    ? extra.reference_full
    : null;
  return {
    id: row.id,
    category: row.category,
    sub_category: row.sub_category ?? null,
    title_ar: row.title_ar,
    title_en: row.title_en ?? null,
    age_min: row.age_min,
    age_max: row.age_max,
    difficulty: row.difficulty,
    // prefer transparent PNG for coloring canvas white background
    image_url: buildUrl(base, transKey || key),
    thumb_url: buildUrl(base, thumbKey || transKey || key),
    // keep all URLs for client to choose
    urls: {
      main: buildUrl(base, key),
      thumb: buildUrl(base, thumbKey ?? null),
      transparent: buildUrl(base, transKey ?? null),
      best: buildUrl(base, transKey || key),
    },
    // assetId يتيح للـ client fallback محلي مميز (SVG) بدل تكرار نفس العصفورة عند 404
    asset_id: row.asset_id ?? null,
    palette: (parseJsonSafe(row.palette_json, null) as string[]|null) ?? PALETTE_DEFAULT,
    geometry: parseJsonSafe(row.geometry_json, null),
    extra,
    // Complete Drawing stores its answer reference in extra_json because it is
    // a paired asset rather than the activity's primary canvas image.
    reference_full_url: buildUrl(base, referenceFullKey),
    is_featured: !!row.is_featured,
    is_new: !!row.is_new,
    sort_order: row.sort_order,
    status: row.status,
    tags: row.tags ?? null,
    updated_at: row.updated_at ?? null,
  };
}

// Home: summary of all categories + featured + hero
app.get('/creative-studio/home', async (c) => {
  const base = publicAssetBaseUrl(c.env);
  try {
    const cats = await queryAll<any>(c.env.DB, `
      SELECT category, COUNT(*) as count,
             SUM(CASE WHEN status='ready' OR status='published' THEN 1 ELSE 0 END) as ready_count,
             SUM(CASE WHEN is_featured=1 THEN 1 ELSE 0 END) as featured_count
      FROM creative_drawings
      WHERE category NOT IN ('birds','animals','vehicles','space','flowers','sea','fruits','toys')
      GROUP BY category ORDER BY category
    `);
    // coloring subcats
    const subcats = await queryAll<any>(c.env.DB, `
      SELECT sub_category as slug, COUNT(*) as count FROM creative_drawings
      WHERE category='coloring' AND sub_category IS NOT NULL
      GROUP BY sub_category
      UNION ALL
      SELECT category as slug, COUNT(*) as count FROM creative_drawings
      WHERE category IN ('birds','animals','vehicles','space','flowers','sea','fruits','toys')
      GROUP BY category
      ORDER BY slug
    `);

    const featured = await queryAll<any>(c.env.DB, `
      SELECT * FROM creative_drawings
      WHERE (status='ready' OR status='published') AND is_featured=1
      ORDER BY sort_order ASC, updated_at DESC LIMIT 20
    `);

    const heroRow = await queryFirst<any>(c.env.DB, `SELECT * FROM creative_drawings WHERE id='hero-coloring' LIMIT 1`);
    const drawLikeMeHeroRow = await queryFirst<any>(c.env.DB, `SELECT * FROM creative_drawings WHERE id='hero-draw-like-me' LIMIT 1`);

    const coloringAll = await queryAll<any>(c.env.DB, `
      SELECT * FROM creative_drawings
      WHERE (category='coloring' OR category IN ('birds','animals','vehicles','space','flowers','sea','fruits','toys'))
        AND (status='ready' OR status='published')
      ORDER BY sort_order ASC, is_featured DESC, updated_at DESC LIMIT 100
    `);

    // draw_like_me featured for ارسم مثلي screen - 50 premium full-color
    const drawLikeMe = await queryAll<any>(c.env.DB, `
      SELECT * FROM creative_drawings
      WHERE category='draw_like_me' AND (status='ready' OR status='published')
      ORDER BY sort_order ASC, is_featured DESC, updated_at DESC LIMIT 100
    `);
    return c.json({
      success:true,
      data:{
        categories: cats,
        coloring_subcategories: subcats,
        featured: featured.map((r:any)=> rowToPublic(r, base)),
        hero: heroRow ? rowToPublic(heroRow, base) : null,
        draw_like_me_hero: drawLikeMeHeroRow ? rowToPublic(drawLikeMeHeroRow, base) : null,
        draw_like_me: drawLikeMe.map((r:any)=> rowToPublic(r, base)),
        coloring_all: coloringAll.map((r:any)=> rowToPublic(r, base)),
        cdn_base: base,
      }
    });
  } catch (e) {
    return c.json({ success:false, error:String(e) }, 500);
  }
});

// List drawings
app.get('/creative-studio/drawings', async (c) => {
  const base = publicAssetBaseUrl(c.env);
  const qCategory = c.req.query('category')?.trim();
  const qSub = c.req.query('sub_category')?.trim();
  const qStatus = c.req.query('status')?.trim() || 'ready,published';
  const qFeatured = c.req.query('featured');
  const qSearch = c.req.query('q')?.trim();
  const limit = Math.min(Math.max(parseInt(c.req.query('limit')||'100',10)||100,1),200);
  const offset = Math.max(parseInt(c.req.query('offset')||'0',10)||0,0);
  const sort = c.req.query('sort')?.trim() || 'sort_order';

  const statuses = qStatus.split(',').map(s=>s.trim()).filter(Boolean);
  const where: string[] = [];
  const params: any[] = [];

  if (statuses.length) {
    where.push(`status IN (${statuses.map(()=>'?').join(',')})`);
    params.push(...statuses);
  }
  if (qCategory && qCategory !== 'all') {
    // if category is coloring, include its legacy sub buckets too
    if (qCategory === 'coloring') {
      where.push(`(category='coloring' OR category IN ('birds','animals','vehicles','space','flowers','sea','fruits','toys'))`);
    } else {
      where.push(`category = ?`);
      params.push(qCategory);
    }
  }
  if (qSub) { where.push(`(sub_category = ? OR category = ?)`); params.push(qSub, qSub); }
  if (qFeatured === '1') where.push('is_featured = 1');
  if (qSearch) {
    where.push('(title_ar LIKE ? OR title_en LIKE ? OR id LIKE ?)');
    const like = `%${qSearch}%`;
    params.push(like, like, like);
  }

  const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderBy = sort === 'updated_at' ? 'updated_at DESC' : sort === 'title_ar' ? 'title_ar ASC' : 'sort_order ASC, updated_at DESC';

  try {
    const totalRow = await queryFirst<{ total:number }>(c.env.DB, `SELECT COUNT(*) as total FROM creative_drawings ${wsql}`, params);
    const rows = await queryAll<any>(c.env.DB, `SELECT * FROM creative_drawings ${wsql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return c.json({ success:true, data: rows.map((r:any)=> rowToPublic(r, base)), meta:{ total: totalRow?.total ?? 0, limit, offset, cdn_base: base } });
  } catch (e) {
    return c.json({ success:false, error:String(e) }, 500);
  }
});

app.get('/creative-studio/drawings/:id', async (c) => {
  const base = publicAssetBaseUrl(c.env);
  const id = c.req.param('id');
  const row = await queryFirst<any>(c.env.DB, `SELECT * FROM creative_drawings WHERE id = ? LIMIT 1`, [id]);
  if (!row) return c.json({ success:false, error:'not found' }, 404);
  return c.json({ success:true, data: rowToPublic(row, base) });
});

export default app;
