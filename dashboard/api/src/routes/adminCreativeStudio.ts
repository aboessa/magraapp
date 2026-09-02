/**
 * Admin Creative Studio — R2-first creative drawings manager
 *
 * Covers all 10 studio categories: coloring, trace, letters, numbers,
 * connectDots, complete, copyPattern, freeDraw templates, promptDraw, draw_like_me.
 *
 * - CRUD on `creative_drawings`
 * - Upload / Replace R2 image (THUMBS_BUCKET as public)
 * - Set featured / new / status / sort_order
 * - Trigger PlayVeo generation (T2I + remove-background) -> auto-upload to R2
 * - Bulk import
 *
 * Bucket policy:
 *  - All creative drawings go to THUMBS_BUCKET with key public/studio/{category}/{id}.{ext}
 *  - CDN URL via PUBLIC_ASSET_BASE_URL + '/' + r2_key
 *  - No private bucket — these are freeform drawing templates, not premium video
 */
import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { publicAssetBaseUrl } from '../lib/assetUrls.ts';
import { requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

const STATUSES = ['draft','review','ready','published','archived'] as const;
const CATEGORIES = [
  'coloring','trace','letters','numbers','connect_dots','complete',
  'copy_pattern','free_draw','prompt_draw','draw_like_me',
  // sub buckets under coloring
  'birds','animals','vehicles','space','flowers','sea','fruits','toys'
] as const;
const DIFFS = ['easy','medium','hard','سهل','متوسط','مفصل'] as const;

function isConstraint(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return /UNIQUE|constraint|FOREIGN/i.test(m);
}

function parseJsonSafe(v: unknown, fallback: any = null) {
  if (typeof v !== 'string') return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

function slugify(v: string, fb: string) {
  const s = v.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'');
  return s || `${fb}-${crypto.randomUUID().slice(0,8)}`;
}

function dotsGeometryError(value: unknown): string | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return 'connect_dots geometry must be an object';
  }
  const dots = (value as { dots?: unknown }).dots;
  if (!Array.isArray(dots) || dots.length < 2 || dots.length > 50) {
    return 'connect_dots geometry requires 2 to 50 dots';
  }
  const ids = new Set<string>();
  for (let index = 0; index < dots.length; index += 1) {
    const dot = dots[index];
    if (dot == null || typeof dot !== 'object' || Array.isArray(dot)) return 'invalid connect_dots dot';
    const row = dot as { id?: unknown; order?: unknown; at?: unknown };
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const at = row.at;
    if (!id || ids.has(id) || row.order !== index + 1 || !Array.isArray(at) || at.length !== 2 ||
        typeof at[0] !== 'number' || typeof at[1] !== 'number' || !Number.isFinite(at[0]) || !Number.isFinite(at[1]) ||
        at[0] < 0 || at[0] > 1 || at[1] < 0 || at[1] > 1) {
      return 'connect_dots dots must have unique ids, contiguous order, and normalized at coordinates';
    }
    ids.add(id);
  }
  return null;
}

function traceGeometryError(value: unknown): string | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return 'trace geometry must be an object';
  }
  const strokes = (value as { strokePaths?: unknown }).strokePaths;
  if (!Array.isArray(strokes) || strokes.length < 1 || strokes.length > 20) {
    return 'trace geometry requires 1 to 20 stroke paths';
  }
  const ids = new Set<string>();
  for (let index = 0; index < strokes.length; index += 1) {
    const stroke = strokes[index];
    if (stroke == null || typeof stroke !== 'object' || Array.isArray(stroke)) return 'invalid trace stroke path';
    const row = stroke as { id?: unknown; order?: unknown; type?: unknown; points?: unknown };
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const type = row.type === 'dot' ? 'dot' : row.type === 'stroke' ? 'stroke' : null;
    const points = row.points;
    if (!id || ids.has(id) || row.order !== index + 1 || type == null || !Array.isArray(points) || points.length < (type === 'dot' ? 1 : 2)) {
      return 'trace paths need unique ids, contiguous order, a valid type, and enough points';
    }
    for (const point of points) {
      if (!Array.isArray(point) || point.length !== 2 || typeof point[0] !== 'number' || typeof point[1] !== 'number' ||
          !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || point[0] < 0 || point[0] > 1 || point[1] < 0 || point[1] > 1) {
        return 'trace points must be normalized coordinates';
      }
    }
    ids.add(id);
  }
  return null;
}

const CDN: Record<string, string> = {
  hero: 'public/studio/heroes',
  coloring_thumbs: 'public/studio/coloring/thumbs',
};

function r2KeyFor(category: string, id: string, ext = 'png', sub?: string|null, kind: 'main'|'thumb'|'transparent'|'hero' = 'main'): string {
  const safeId = id.toLowerCase().replace(/[^a-z0-9_-]+/g,'-').slice(0,80);
  const e = ext.replace(/^\./,'').toLowerCase() || 'png';
  if (kind === 'hero') return `public/studio/heroes/${safeId}.${e}`;
  if (kind === 'thumb') return `public/studio/${category}/thumbs/${safeId}.webp`;
  if (kind === 'transparent') return `public/studio/${category}/${safeId}-transparent.png`;
  // coloring sub categories live under coloring
  if (['birds','animals','vehicles','space','flowers','sea','fruits','toys'].includes(category)) {
    return `public/studio/coloring/${safeId}.${e}`;
  }
  return `public/studio/${category}/${safeId}.${e}`;
}

function serializeRow(row: any, baseUrl: string|null) {
  const pal = parseJsonSafe(row.palette_json, []) as string[];
  const geo = parseJsonSafe(row.geometry_json, null);
  const r2Key = String(row.r2_key||'');
  const thumbKey = row.thumb_r2_key ? String(row.thumb_r2_key) : null;
  const transKey = row.transparent_r2_key ? String(row.transparent_r2_key) : null;
  const url = baseUrl && r2Key ? `${baseUrl}/${r2Key.replace(/^\/+/,'')}?v=3` : null;
  const thumbUrl = baseUrl && thumbKey ? `${baseUrl}/${thumbKey.replace(/^\/+/,'')}?v=3` : null;
  const transUrl = baseUrl && transKey ? `${baseUrl}/${transKey.replace(/^\/+/,'')}?v=3` : null;
  return {
    id: row.id,
    category: row.category,
    sub_category: row.sub_category ?? null,
    title_ar: row.title_ar,
    title_en: row.title_en ?? null,
    description_ar: row.description_ar ?? null,
    age_min: row.age_min,
    age_max: row.age_max,
    difficulty: row.difficulty,
    r2_key: r2Key,
    thumb_r2_key: thumbKey,
    transparent_r2_key: transKey,
    url,
    thumb_url: thumbUrl,
    transparent_url: transUrl ?? url,
    storage_bucket: row.storage_bucket,
    palette: pal,
    geometry: geo,
    extra: parseJsonSafe(row.extra_json, null),
    status: row.status,
    is_featured: !!row.is_featured,
    is_new: !!row.is_new,
    sort_order: row.sort_order,
    tags: row.tags ?? null,
    prompt_key: row.prompt_key ?? null,
    asset_id: row.asset_id ?? null,
    playveo_job_id: row.playveo_job_id ?? null,
    playveo_cost: row.playveo_cost ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    original_url: row.original_url ?? null,
  };
}

// List with filters
route.get('/creative-studio/drawings', async (c) => {
  const db = c.env.DB;
  const base = publicAssetBaseUrl(c.env);
  const qCategory = c.req.query('category')?.trim();
  const qSub = c.req.query('sub_category')?.trim();
  const qStatus = c.req.query('status')?.trim();
  const qFeatured = c.req.query('featured'); // 1/0
  const qSearch = c.req.query('q')?.trim();
  const limit = Math.min(Math.max(parseInt(c.req.query('limit')||'100',10)||100,1),500);
  const offset = Math.max(parseInt(c.req.query('offset')||'0',10)||0,0);

  const where: string[] = [];
  const params: any[] = [];
  if (qCategory && qCategory !== 'all') { where.push('category = ?'); params.push(qCategory); }
  if (qSub) { where.push('sub_category = ?'); params.push(qSub); }
  if (qStatus && qStatus !== 'all') { where.push('status = ?'); params.push(qStatus); }
  if (qFeatured === '1') where.push('is_featured = 1');
  if (qFeatured === '0') where.push('is_featured = 0');
  if (qSearch) {
    where.push('(title_ar LIKE ? OR title_en LIKE ? OR id LIKE ? OR tags LIKE ?)');
    const like = `%${qSearch}%`;
    params.push(like, like, like, like);
  }
  const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const totalRow = await queryFirst<{ total:number }>(db, `SELECT COUNT(*) as total FROM creative_drawings ${wsql}`, params);
    const rows = await queryAll<any>(db, `SELECT * FROM creative_drawings ${wsql} ORDER BY sort_order ASC, is_featured DESC, updated_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const data = rows.map((r:any)=> serializeRow(r, base));
    return c.json({ success:true, data, meta:{ total: totalRow?.total ?? 0, limit, offset }});
  } catch (e) {
    return c.json({ success:false, error:String(e) }, 500);
  }
});

// Single
route.get('/creative-studio/drawings/:id', async (c) => {
  const id = c.req.param('id') ?? '';
  const base = publicAssetBaseUrl(c.env);
  const row = await queryFirst<any>(c.env.DB, `SELECT * FROM creative_drawings WHERE id = ? LIMIT 1`, [id]);
  if (!row) return c.json({ success:false, error:'not found' }, 404);
  return c.json({ success:true, data: serializeRow(row, base) });
});

// Create / Upsert
route.post('/creative-studio/drawings', requirePermission('create'), async (c) => {
  const body = await c.req.json().catch(()=>null) as any;
  if (!body || typeof body !== 'object') return c.json({ success:false, error:'JSON required' }, 400);
  const titleAr = (body.title_ar||'').toString().trim();
  if (!titleAr) return c.json({ success:false, error:'title_ar required' }, 400);
  const id = (body.id||slugify(titleAr, 'drawing')).toString().trim();
  const category = (body.category||'coloring').toString().trim();
  if (!(CATEGORIES as readonly string[]).includes(category)) return c.json({ success:false, error:`Invalid category ${category}` }, 400);
  const subCat = body.sub_category ? body.sub_category.toString().trim() : null;
  const status = (body.status||'draft').toString().trim();
  if (!(STATUSES as readonly string[]).includes(status)) return c.json({ success:false, error:`Invalid status ${status}` }, 400);
  const diff = (body.difficulty||'easy').toString().trim();

  const r2Key = (body.r2_key||r2KeyFor(category, id, 'png', subCat)).toString().trim();
  const thumbKey = body.thumb_r2_key ? body.thumb_r2_key.toString().trim() : r2KeyFor(category, id, 'webp', subCat, 'thumb');
  const palette = Array.isArray(body.palette) ? JSON.stringify(body.palette) : (body.palette_json ?? null);
  const geometry = body.geometry ? JSON.stringify(body.geometry) : (body.geometry_json ?? null);
  const extra = body.extra ? JSON.stringify(body.extra) : (body.extra_json ?? null);
  if (category === 'connect_dots' && geometry != null) {
    const error = dotsGeometryError(typeof geometry === 'string' ? parseJsonSafe(geometry, null) : geometry);
    if (error) return c.json({ success:false, error }, 400);
  }
  if (['trace', 'letters', 'numbers'].includes(category) && geometry != null) {
    const error = traceGeometryError(typeof geometry === 'string' ? parseJsonSafe(geometry, null) : geometry);
    if (error) return c.json({ success:false, error }, 400);
  }

  const ageMin = parseInt(body.age_min||'3',10)||3;
  const ageMax = parseInt(body.age_max||'12',10)||12;

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO creative_drawings (id, category, sub_category, title_ar, title_en, description_ar, age_min, age_max, difficulty, r2_key, thumb_r2_key, transparent_r2_key, storage_bucket, palette_json, geometry_json, extra_json, status, is_featured, is_new, sort_order, tags, prompt_key, asset_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category=excluded.category,
          sub_category=excluded.sub_category,
          title_ar=excluded.title_ar,
          title_en=excluded.title_en,
          description_ar=excluded.description_ar,
          age_min=excluded.age_min,
          age_max=excluded.age_max,
          difficulty=excluded.difficulty,
          r2_key=excluded.r2_key,
          thumb_r2_key=excluded.thumb_r2_key,
          palette_json=excluded.palette_json,
          geometry_json=excluded.geometry_json,
          extra_json=excluded.extra_json,
          status=excluded.status,
          is_featured=excluded.is_featured,
          is_new=excluded.is_new,
          sort_order=excluded.sort_order,
          tags=excluded.tags,
          prompt_key=excluded.prompt_key,
          asset_id=excluded.asset_id,
          updated_at=datetime('now')
      `).bind(
        id, category, subCat, titleAr,
        body.title_en?.toString().trim()||null,
        body.description_ar?.toString().trim()||null,
        ageMin, ageMax, diff,
        r2Key, thumbKey, body.transparent_r2_key||null,
        'thumbs',
        palette, geometry, extra,
        status,
        body.is_featured?1:0,
        body.is_new?1:0,
        parseInt(body.sort_order||'0',10)||0,
        body.tags?.toString()||null,
        body.prompt_key?.toString()||null,
        body.asset_id?.toString()||null,
        actorId(c),
      ),
      auditStatement(c.env.DB, actorId(c), 'upsert', 'creative_drawing', id, body),
    ]);
  } catch (e:any) {
    if (isConstraint(e)) return c.json({ success:false, error:'id conflict' }, 409);
    return c.json({ success:false, error:String(e) }, 500);
  }
  const base = publicAssetBaseUrl(c.env);
  const row = await queryFirst<any>(c.env.DB, `SELECT * FROM creative_drawings WHERE id = ?`, [id]);
  return c.json({ success:true, data: row ? serializeRow(row, base) : { id } }, 201);
});

// Patch status / featured / sort / new
route.patch('/creative-studio/drawings/:id', requirePermission('update'), async (c) => {
  const id = c.req.param('id') ?? '';
  const body = await c.req.json().catch(()=>null) as any;
  if (!body) return c.json({ success:false, error:'JSON required' }, 400);
  const exists = await queryFirst<any>(
    c.env.DB,
    `SELECT id, category, status, geometry_json, r2_key FROM creative_drawings WHERE id = ?`,
    [id],
  );
  if (!exists) return c.json({ success:false, error:'not found' }, 404);

  const fields: string[] = [];
  const params: any[] = [];
  if ('title_ar' in body) { fields.push('title_ar = ?'); params.push(String(body.title_ar).trim()); }
  if ('title_en' in body) { fields.push('title_en = ?'); params.push(String(body.title_en||'').trim()||null); }
  if ('description_ar' in body) { fields.push('description_ar = ?'); params.push(String(body.description_ar||'').trim()||null); }
  if ('category' in body) { const cat = String(body.category).trim(); if (!(CATEGORIES as readonly string[]).includes(cat)) return c.json({ success:false, error:`invalid category ${cat}` },400); fields.push('category = ?'); params.push(cat); }
  if ('sub_category' in body) { fields.push('sub_category = ?'); params.push(body.sub_category? String(body.sub_category).trim(): null); }
  if ('status' in body) { const s = String(body.status).trim(); if (!(STATUSES as readonly string[]).includes(s as any)) return c.json({ success:false, error:`invalid status ${s}` },400); fields.push('status = ?'); params.push(s); }
  if ('is_featured' in body) { fields.push('is_featured = ?'); params.push(body.is_featured?1:0); }
  if ('is_new' in body) { fields.push('is_new = ?'); params.push(body.is_new?1:0); }
  if ('sort_order' in body) { fields.push('sort_order = ?'); params.push(parseInt(String(body.sort_order),10)||0); }
  if ('difficulty' in body) { fields.push('difficulty = ?'); params.push(String(body.difficulty).trim()||'easy'); }
  if ('age_min' in body) { fields.push('age_min = ?'); params.push(parseInt(String(body.age_min),10)||3); }
  if ('age_max' in body) { fields.push('age_max = ?'); params.push(parseInt(String(body.age_max),10)||12); }
  if ('palette' in body || 'palette_json' in body) { const pal = body.palette ? JSON.stringify(body.palette) : body.palette_json; fields.push('palette_json = ?'); params.push(pal||null); }
  if ('geometry' in body || 'geometry_json' in body) {
    const geo = body.geometry ? JSON.stringify(body.geometry) : body.geometry_json;
    const category = 'category' in body ? String(body.category).trim() : exists.category;
    if (category === 'connect_dots') {
      const error = dotsGeometryError(typeof geo === 'string' ? parseJsonSafe(geo, null) : geo);
      if (error) return c.json({ success:false, error }, 400);
    }
    if (['trace', 'letters', 'numbers'].includes(category)) {
      const error = traceGeometryError(typeof geo === 'string' ? parseJsonSafe(geo, null) : geo);
      if (error) return c.json({ success:false, error }, 400);
    }
    fields.push('geometry_json = ?'); params.push(geo||null);
  }
  if ('extra' in body || 'extra_json' in body) { const ex = body.extra ? JSON.stringify(body.extra) : body.extra_json; fields.push('extra_json = ?'); params.push(ex||null); }
  if ('tags' in body) { fields.push('tags = ?'); params.push(String(body.tags||'').trim()||null); }
  if ('r2_key' in body) { fields.push('r2_key = ?'); params.push(String(body.r2_key).trim()); }
  if ('thumb_r2_key' in body) { fields.push('thumb_r2_key = ?'); params.push(body.thumb_r2_key? String(body.thumb_r2_key).trim(): null); }
  if ('transparent_r2_key' in body) { fields.push('transparent_r2_key = ?'); params.push(body.transparent_r2_key? String(body.transparent_r2_key).trim(): null); }
  if ('prompt_key' in body) { fields.push('prompt_key = ?'); params.push(body.prompt_key? String(body.prompt_key).trim(): null); }

  if (!fields.length) return c.json({ success:false, error:'no fields' }, 400);
  const effectiveCategory = 'category' in body ? String(body.category).trim() : exists.category;
  const effectiveStatus = 'status' in body ? String(body.status).trim() : exists.status;
  if (effectiveCategory === 'connect_dots' && (effectiveStatus === 'ready' || effectiveStatus === 'published')) {
    const geometry = 'geometry' in body || 'geometry_json' in body
      ? (body.geometry ?? parseJsonSafe(body.geometry_json, null))
      : parseJsonSafe(exists.geometry_json, null);
    const geometryError = dotsGeometryError(geometry);
    if (geometryError) return c.json({ success:false, error: geometryError }, 400);
    const key = 'r2_key' in body ? String(body.r2_key).trim() : exists.r2_key;
    if (!key || !(await c.env.THUMBS_BUCKET.head(key))) {
      return c.json({ success:false, error:'connect_dots PNG must be uploaded before it can be ready or published' }, 400);
    }
  }
  if (['trace', 'letters', 'numbers'].includes(effectiveCategory) && (effectiveStatus === 'ready' || effectiveStatus === 'published')) {
    const geometry = 'geometry' in body || 'geometry_json' in body
      ? (body.geometry ?? parseJsonSafe(body.geometry_json, null))
      : parseJsonSafe(exists.geometry_json, null);
    const geometryError = traceGeometryError(geometry);
    if (geometryError) return c.json({ success:false, error: geometryError }, 400);
    const key = 'r2_key' in body ? String(body.r2_key).trim() : exists.r2_key;
    if (!key || !(await c.env.THUMBS_BUCKET.head(key))) {
      return c.json({ success:false, error:'trace SVG must be uploaded before it can be ready or published' }, 400);
    }
  }
  fields.push(`updated_at = datetime('now')`);
  params.push(id);
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE creative_drawings SET ${fields.join(', ')} WHERE id = ?`).bind(...params),
      auditStatement(c.env.DB, actorId(c), 'update', 'creative_drawing', id, body),
    ]);
  } catch (e) {
    return c.json({ success:false, error:String(e) }, 500);
  }
  const base = publicAssetBaseUrl(c.env);
  const row = await queryFirst<any>(c.env.DB, `SELECT * FROM creative_drawings WHERE id = ?`, [id]);
  return c.json({ success:true, data: row ? serializeRow(row, base) : { id } });
});

// Delete / archive
route.delete('/creative-studio/drawings/:id', requirePermission('delete'), async (c) => {
  const id = c.req.param('id') ?? '';
  const row = await queryFirst<any>(c.env.DB, `SELECT id FROM creative_drawings WHERE id = ?`, [id]);
  if (!row) return c.json({ success:false, error:'not found' }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE creative_drawings SET status='archived', updated_at=datetime('now') WHERE id = ?`).bind(id),
    auditStatement(c.env.DB, actorId(c), 'archive', 'creative_drawing', id, {}),
  ]);
  return c.json({ success:true });
});

// Direct upload bytes to R2 (image file -> THUMBS_BUCKET)
// Client sends FormData: file, optional id, category. Server writes to THUMBS_BUCKET.
// This is how admin uploads any studio asset without bundling in APK.
route.post('/creative-studio/drawings/:id/upload', requirePermission('create'), async (c) => {
  const id = c.req.param('id') ?? '';
  const existing = await queryFirst<any>(c.env.DB, `SELECT * FROM creative_drawings WHERE id = ?`, [id]);
  if (!existing) return c.json({ success:false, error:'drawing not found; create it first' }, 404);

  const form = await c.req.formData().catch(()=>null);
  if (!form) return c.json({ success:false, error:'formData required' }, 400);
  const file = form.get('file') as File | null;
  const kind = (form.get('kind')?.toString()||'main').trim(); // main | thumb | transparent | reference (complete only)
  if (!file || typeof (file as any).arrayBuffer !== 'function') return c.json({ success:false, error:'file required' }, 400);
  if (file.size > 20*1024*1024) return c.json({ success:false, error:'file too large (max 20MB)' }, 400);
  if (kind === 'reference' && existing.category !== 'complete') {
    return c.json({ success:false, error:'reference uploads are only valid for complete drawings' }, 400);
  }

  const ext = (file.name.split('.').pop()||'png').toLowerCase();
  const allowed = ['png','webp','jpg','jpeg', ...( ['trace', 'letters', 'numbers'].includes(existing.category) ? ['svg'] : [])];
  if (!allowed.includes(ext)) return c.json({ success:false, error:`invalid ext ${ext}` }, 400);

  let key: string;
  if (kind === 'thumb') key = existing.thumb_r2_key || r2KeyFor(existing.category, id, 'webp', existing.sub_category, 'thumb');
  else if (kind === 'reference') {
    const extra = parseJsonSafe(existing.extra_json, {}) ?? {};
    const saved = typeof extra.reference_full === 'string' ? extra.reference_full : '';
    key = saved || String(existing.r2_key || '').replace(/\/challenge\.[^.]+$/i, '/reference_full.png');
    if (!key) return c.json({ success:false, error:'complete reference key missing' }, 400);
  }
  else if (kind === 'transparent' || kind === 'trans') key = existing.transparent_r2_key || r2KeyFor(existing.category, id, 'png', existing.sub_category, 'transparent');
  else key = existing.r2_key || r2KeyFor(existing.category, id, ext, existing.sub_category, 'main');

  const buf = await (file as any).arrayBuffer();
  const contentType = file.type || (ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'image/jpeg');

  try {
    await c.env.THUMBS_BUCKET.put(key, buf, { httpMetadata: { contentType }, customMetadata: { uploadedBy: actorId(c), drawingId: id } });
  } catch (e) {
    return c.json({ success:false, error:`R2 put failed: ${String(e)}` }, 500);
  }

  // update D1 row with key
  const field = kind === 'thumb' ? 'thumb_r2_key' : kind === 'transparent' || kind === 'trans' ? 'transparent_r2_key' : 'r2_key';
  const statement = kind === 'reference'
    ? c.env.DB.prepare(`UPDATE creative_drawings SET extra_json = json_set(COALESCE(extra_json, '{}'), '$.reference_full', ?), updated_at = datetime('now') WHERE id = ?`).bind(key, id)
    : c.env.DB.prepare(`UPDATE creative_drawings SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`).bind(key, id);
  await c.env.DB.batch([
    statement,
    auditStatement(c.env.DB, actorId(c), 'upload-r2', 'creative_drawing', id, { key, kind, size: file.size }),
  ]);

  const base = publicAssetBaseUrl(c.env);
  const row = await queryFirst<any>(c.env.DB, `SELECT * FROM creative_drawings WHERE id = ?`, [id]);
  return c.json({ success:true, data: row ? serializeRow(row, base) : { id, key } });
});

// Bulk publish / reorder
route.post('/creative-studio/drawings/reorder', requirePermission('update'), async (c) => {
  const body = await c.req.json().catch(()=>null) as any;
  if (!body || !Array.isArray(body.items)) return c.json({ success:false, error:'{items:[{id,sort_order}]} required' }, 400);
  const items = body.items as { id:string; sort_order:number }[];
  if (items.length > 200) return c.json({ success:false, error:'too many' }, 400);
  try {
    const stmts = items.map((it) =>
      c.env.DB.prepare(`UPDATE creative_drawings SET sort_order = ?, updated_at=datetime('now') WHERE id = ?`).bind(it.sort_order|0, it.id)
    );
    if (stmts.length) await c.env.DB.batch(stmts);
  } catch (e) {
    return c.json({ success:false, error:String(e) }, 500);
  }
  return c.json({ success:true });
});

// PlayVeo generate + remove-bg + upload to R2 (server-side)
// Requires PLAYVEO_API_KEY secret in Worker. Called from dashboard: POST {prompt, count, model, category, id(optional)}.
// If id not given, creates new creative_drawing.
// Flow: T2I submit -> poll -> download JPEG -> POST /remove-background url -> PNG transparent -> R2 upload -> D1 update.
route.post('/creative-studio/generate', requirePermission('create'), async (c) => {
  const body = await c.req.json().catch(()=>null) as any;
  if (!body || !body.prompt) return c.json({ success:false, error:'prompt required' }, 400);
  const prompt = String(body.prompt).trim();
  if (prompt.length < 10) return c.json({ success:false, error:'prompt too short' }, 400);
  const category = (body.category||'coloring').toString().trim();
  const id = (body.id||slugify(prompt.slice(0,40), 'gen')).toString().trim();
  const count = Math.min(Math.max(parseInt(String(body.count||'1'),10)||1,1),4);
  const model = (body.model||'nano_banana_2').toString().trim();
  const aspect = (body.aspect_ratio||'1:1').toString().trim();
  const wantsTransparent = body.transparent !== false; // default true for coloring

  const apiKey = (c.env as any).PLAYVEO_API_KEY as string|undefined;
  const baseUrl = ((c.env as any).PLAYVEO_BASE_URL as string|undefined) || 'https://playveo-api.aboessa101.workers.dev';
  if (!apiKey) return c.json({ success:false, error:'PLAYVEO_API_KEY not configured' }, 500);

  // Build full prompt: enforce closed line-art for coloring
  let fullPrompt = prompt;
  if (category === 'coloring' || (CATEGORIES as readonly string[]).includes(category as any) && aspect === '1:1') {
    if (!/line.?art|black and white|closed shapes/i.test(fullPrompt)) {
      fullPrompt += ', black and white line art, thick bold outlines, pure white background, CLOSED shapes only, no shading, kawaii, centered';
    }
  }

  // Helper to call PlayVeo
  async function pv(path: string, init: RequestInit & { bearer?: string } = {}) {
    const headers: Record<string,string> = { 'Content-Type':'application/json', ...(init.headers as any||{}) };
    if (init.bearer !== undefined) {
      // override
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (init.bearer) headers['Authorization'] = `Bearer ${init.bearer}`;
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    return { res, json, text, ok: res.ok };
  }

  try {
    // T2I submit
    const submit = await pv('/v1/images/text-to-image', { method:'POST', body: JSON.stringify({ prompt: fullPrompt.slice(0,1800), aspect_ratio: aspect, model, count }) });
    if (!submit.ok) return c.json({ success:false, error:`T2I submit failed ${submit.res.status}: ${submit.text.slice(0,500)}` }, 502);
    const jobId = submit.json?.id || submit.json?.job_id || submit.json?.data?.id;
    if (!jobId) return c.json({ success:false, error:`No job id in response: ${submit.text.slice(0,500)}` }, 502);

    // Poll for completion (server side, up to ~2 min)
    const deadline = Date.now() + 2*60*1000;
    let finalUrl: string | null = null;
    let lastJson: any = submit.json;
    while (Date.now() < deadline) {
      await new Promise(r=> setTimeout(r, 5000));
      const status = await pv(`/v1/images/${jobId}`, { method:'GET' });
      lastJson = status.json;
      if (!status.ok) continue;
      const s = String(status.json?.status||'').toLowerCase();
      const urls = status.json?.resultUrls || status.json?.result_urls || status.json?.data?.resultUrls || [];
      if (s === 'completed' || s === 'succeeded' || (Array.isArray(urls) && urls.length)) {
        finalUrl = urls[0] || status.json?.url || status.json?.resultUrl || null;
        if (finalUrl) break;
      }
      if (s === 'failed' || s === 'error') {
        return c.json({ success:false, error:`Generation failed: ${status.text.slice(0,500)}`, jobId }, 500);
      }
    }
    if (!finalUrl) return c.json({ success:false, error:'Timeout waiting for generation', jobId, last: lastJson }, 504);

    // Fetch JPEG
    const imgRes = await fetch(finalUrl);
    if (!imgRes.ok) return c.json({ success:false, error:`Download result failed ${imgRes.status}` }, 502);
    const imgBuf = await imgRes.arrayBuffer();

    // Optional PNG validation (guard)
    const imgBytes = new Uint8Array(imgBuf);

    // Upload original to R2 (jpeg)
    const originalKey = r2KeyFor(category, id, 'jpg', null, 'main');
    await c.env.THUMBS_BUCKET.put(originalKey, imgBuf, { httpMetadata:{ contentType: 'image/jpeg' } });

    let transparentKey: string | null = null;
    let transparentUrl: string | null = null;

    if (wantsTransparent) {
      // Call remove-background with URL (PlayVeo accepts image_url or url)
      const rbPayloads: any[] = [{ image_url: finalUrl }, { url: finalUrl }, { image: finalUrl }];
      let rb: { res: Response; json:any; text:string; ok:boolean } | null = null;
      for (const payload of rbPayloads) {
        // Image url remove-background is sync
        // Try JSON shape
        const attempt = await pv('/v1/images/remove-background', { method:'POST', body: JSON.stringify(payload) });
        rb = attempt as any;
        if (attempt.ok && (attempt.json?.status === 'completed' || attempt.json?.url)) break;
        // continue to next payload shape
      }
      if (rb && rb.ok && rb.json?.url) {
        transparentUrl = rb.json.url as string;
        // download transparent PNG
        const tRes = await fetch(transparentUrl);
        if (tRes.ok) {
          const tBuf = await tRes.arrayBuffer();
          transparentKey = r2KeyFor(category, id, 'png', null, 'transparent');
          await c.env.THUMBS_BUCKET.put(transparentKey, tBuf, { httpMetadata:{ contentType: 'image/png' } });
        }
      }
    }

    // Upsert D1 entry
    const r2KeyMain = transparentKey || originalKey;
    const thumbKey = r2KeyFor(category, id, 'webp', null, 'thumb');
    // Create thumbnail from original (just reuse original for now; real thumb conversion can be done by image resizing worker later)
    await c.env.THUMBS_BUCKET.put(thumbKey, imgBuf, { httpMetadata:{ contentType: 'image/jpeg' } });

    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO creative_drawings (id, category, title_ar, r2_key, thumb_r2_key, transparent_r2_key, original_url, storage_bucket, status, is_featured, is_new, sort_order, playveo_job_id, generated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'thumbs', 'ready', 0, 1, 0, ?, datetime('now'), ?)
        ON CONFLICT(id) DO UPDATE SET
          r2_key=excluded.r2_key,
          thumb_r2_key=excluded.thumb_r2_key,
          transparent_r2_key=excluded.transparent_r2_key,
          original_url=excluded.original_url,
          status='ready',
          playveo_job_id=excluded.playveo_job_id,
          generated_at=datetime('now'),
          updated_at=datetime('now')
      `).bind(
        id, category, body.title_ar||prompt.slice(0,80), r2KeyMain, thumbKey, transparentKey, finalUrl, String(jobId), actorId(c)
      ),
      auditStatement(c.env.DB, actorId(c), 'generate', 'creative_drawing', id, { prompt: fullPrompt, jobId, finalUrl, transparentUrl }),
    ]);

    const baseCdn = publicAssetBaseUrl(c.env);
    const row = await queryFirst<any>(c.env.DB, `SELECT * FROM creative_drawings WHERE id = ?`, [id]);
    return c.json({
      success:true,
      data: {
        ...(row ? { id: row.id } : { id }),
        jobId,
        originalUrl: finalUrl,
        transparentUrl,
        cdnUrl: row ? (baseCdn ? `${baseCdn}/${row.r2_key}` : row.r2_key) : (baseCdn ? `${baseCdn}/${r2KeyMain}` : r2KeyMain),
        drawing: row ? serializeRow(row, baseCdn) : null,
      }
    });

  } catch (e) {
    return c.json({ success:false, error:String(e) }, 500);
  }
});

// Stats
route.get('/creative-studio/stats', async (c) => {
  try {
    const total = await queryFirst<{ n:number }>(c.env.DB, `SELECT COUNT(*) as n FROM creative_drawings`);
    const ready = await queryFirst<{ n:number }>(c.env.DB, `SELECT COUNT(*) as n FROM creative_drawings WHERE status='ready'`);
    const pub = await queryFirst<{ n:number }>(c.env.DB, `SELECT COUNT(*) as n FROM creative_drawings WHERE status='published'`);
    const byCat = await queryAll<any>(c.env.DB, `SELECT category, COUNT(*) as count FROM creative_drawings GROUP BY category`);
    return c.json({ success:true, data:{ total: total?.n||0, ready: ready?.n||0, published: pub?.n||0, byCategory: byCat }});
  } catch (e) {
    return c.json({ success:false, error:String(e) }, 500);
  }
});

export default route;
