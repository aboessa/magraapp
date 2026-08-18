import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

// Get streaming contract for episode
route.get('/episodes/:id/streaming', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const ep = await queryFirst(c.env.DB, `SELECT id, intro_start_ms, intro_end_ms, recap_start_ms, recap_end_ms, credits_start_ms, preview_sprite_url, preview_sprite_vtt_url, quality_renditions FROM episodes WHERE id = ?`, [id]);
  if (!ep) return c.json({ success: false, error: 'Episode not found' }, 404);
  const audios = await queryAll(c.env.DB, `SELECT t.*, ca.r2_key, ca.bucket FROM episode_audio_tracks t JOIN content_assets ca ON ca.id=t.asset_id WHERE t.episode_id=? AND t.status='ready' ORDER BY t.sort_order`, [id]);
  const subs = await queryAll(c.env.DB, `SELECT t.*, ca.r2_key, ca.bucket FROM episode_subtitle_tracks t JOIN content_assets ca ON ca.id=t.asset_id WHERE t.episode_id=? AND t.status='ready' ORDER BY t.sort_order`, [id]);
  const rends = await queryAll(c.env.DB, `SELECT r.*, ca.r2_key, ca.bucket, ca.mime_type FROM episode_renditions r JOIN content_assets ca ON ca.id=r.asset_id WHERE r.episode_id=? AND r.status='ready' ORDER BY r.sort_order`, [id]);
  return c.json({ success: true, data: { episode: ep, audio_tracks: audios, subtitle_tracks: subs, renditions: rends } });
});

// Update editorial timestamps
route.put('/episodes/:id/streaming', requireAdmin, requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const fields: string[] = [];
  const vals: unknown[] = [];
  const allowed = ['intro_start_ms','intro_end_ms','recap_start_ms','recap_end_ms','credits_start_ms','preview_sprite_url','preview_sprite_vtt_url'];
  for (const k of allowed) {
    if (k in body) {
      const v = body[k];
      if (k.includes('_ms')) {
        if (v !== null && v !== '' && !Number.isInteger(Number(v))) return c.json({ success: false, error: `Invalid ${k}` }, 400);
        if (v !== null && Number(v) < 0) return c.json({ success: false, error: `${k} must be >=0` }, 400);
      }
      fields.push(`${k} = ?`);
      vals.push(v === '' ? null : v);
    }
  }
  if (body.quality_renditions !== undefined) {
    const qr = body.quality_renditions;
    if (!Array.isArray(qr)) return c.json({ success: false, error: 'quality_renditions must be array' }, 400);
    fields.push('quality_renditions = ?');
    vals.push(JSON.stringify(qr));
  }
  // validate intro range: end > start and <= duration
  if (('intro_start_ms' in body || 'intro_end_ms' in body)) {
    const start = body.intro_start_ms as number | null;
    const end = body.intro_end_ms as number | null;
    if (start != null && end != null) {
      if (end <= start) return c.json({ success: false, error: 'intro_end_ms must be > intro_start_ms' }, 400);
    }
    if (start != null && end != null) {
      const dur = await queryFirst<{ duration_seconds: number | null }>(c.env.DB, `SELECT duration_seconds FROM episodes WHERE id=?`, [id]);
      if (dur?.duration_seconds && end > dur.duration_seconds * 1000) return c.json({ success: false, error: 'intro_end_ms exceeds duration' }, 400);
    }
  }
  if (!fields.length) return c.json({ success: false, error: 'No fields' }, 400);
  vals.push(id);
  await c.env.DB.prepare(`UPDATE episodes SET ${fields.join(', ')}, updated_at=datetime('now') WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

// Audio track CRUD
route.post('/episodes/:id/audio-tracks', requireAdmin, requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const language = String(body.language ?? '').trim();
  const assetId = String(body.asset_id ?? '').trim();
  if (!['ar','en','fr'].includes(language)) return c.json({ success: false, error: 'language must be ar/en/fr' }, 400);
  if (!assetId) return c.json({ success: false, error: 'asset_id required' }, 400);
  const asset = await queryFirst(c.env.DB, `SELECT id, status, kind FROM content_assets WHERE id=?`, [assetId]);
  if (!asset) return c.json({ success: false, error: 'Asset not found' }, 404);
  const isDefault = body.is_default === true || body.is_default === 1 ? 1 : 0;
  const newId = crypto.randomUUID();
  try {
    await c.env.DB.prepare(`INSERT INTO episode_audio_tracks (id, episode_id, language, asset_id, label, is_default, sort_order) VALUES (?,?,?,?,?,?,?)`)
      .bind(newId, id, language, assetId, String(body.label ?? language), isDefault, Number(body.sort_order ?? 0)).run();
    if (isDefault) {
      await c.env.DB.prepare(`UPDATE episode_audio_tracks SET is_default=0 WHERE episode_id=? AND id!=?`).bind(id, newId).run();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) return c.json({ success: false, error: 'Language already exists for this episode' }, 409);
    throw e;
  }
  return c.json({ success: true, data: { id: newId } }, 201);
});

route.delete('/episodes/:id/audio-tracks/:trackId', requireAdmin, requirePermission('edit_metadata'), async (c) => {
  const { id, trackId } = c.req.param();
  await c.env.DB.prepare(`UPDATE episode_audio_tracks SET status='archived', updated_at=datetime('now') WHERE id=? AND episode_id=?`).bind(trackId, id).run();
  return c.json({ success: true });
});

route.post('/episodes/:id/subtitle-tracks', requireAdmin, requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const language = String(body.language ?? '').trim();
  const assetId = String(body.asset_id ?? '').trim();
  if (!['ar','en','fr'].includes(language)) return c.json({ success: false, error: 'language must be ar/en/fr' }, 400);
  if (!assetId) return c.json({ success: false, error: 'asset_id required' }, 400);
  const asset = await queryFirst(c.env.DB, `SELECT id, status, kind FROM content_assets WHERE id=?`, [assetId]);
  if (!asset) return c.json({ success: false, error: 'Asset not found' }, 404);
  const format = String(body.format ?? 'vtt');
  if (!['vtt','srt'].includes(format)) return c.json({ success: false, error: 'format must be vtt/srt' }, 400);
  const isDefault = body.is_default === true || body.is_default === 1 ? 1 : 0;
  const newId = crypto.randomUUID();
  try {
    await c.env.DB.prepare(`INSERT INTO episode_subtitle_tracks (id, episode_id, language, asset_id, label, format, is_default, sort_order) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(newId, id, language, assetId, String(body.label ?? language), format, isDefault, Number(body.sort_order ?? 0)).run();
    if (isDefault) {
      await c.env.DB.prepare(`UPDATE episode_subtitle_tracks SET is_default=0 WHERE episode_id=? AND id!=?`).bind(id, newId).run();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) return c.json({ success: false, error: 'Language already exists' }, 409);
    throw e;
  }
  return c.json({ success: true, data: { id: newId } }, 201);
});

route.delete('/episodes/:id/subtitle-tracks/:trackId', requireAdmin, requirePermission('edit_metadata'), async (c) => {
  const { id, trackId } = c.req.param();
  await c.env.DB.prepare(`UPDATE episode_subtitle_tracks SET status='archived', updated_at=datetime('now') WHERE id=? AND episode_id=?`).bind(trackId, id).run();
  return c.json({ success: true });
});

route.post('/episodes/:id/renditions', requireAdmin, requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const label = String(body.label ?? '').trim();
  const assetId = String(body.asset_id ?? '').trim();
  if (!label) return c.json({ success: false, error: 'label required (e.g. 1080p,720p,480p,360p)' }, 400);
  if (!assetId) return c.json({ success: false, error: 'asset_id required' }, 400);
  const asset = await queryFirst(c.env.DB, `SELECT id FROM content_assets WHERE id=? AND kind='video'`, [assetId]);
  if (!asset) return c.json({ success: false, error: 'Video asset not found' }, 404);
  const newId = crypto.randomUUID();
  const isDefault = body.is_default === true || body.is_default === 1 ? 1 : 0;
  try {
    await c.env.DB.prepare(`INSERT INTO episode_renditions (id, episode_id, label, asset_id, width, height, bitrate_kbps, is_default, sort_order) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(newId, id, label, assetId, body.width ?? null, body.height ?? null, body.bitrate_kbps ?? null, isDefault, Number(body.sort_order ?? 0)).run();
    if (isDefault) await c.env.DB.prepare(`UPDATE episode_renditions SET is_default=0 WHERE episode_id=? AND id!=?`).bind(id, newId).run();
    // sync JSON column for client that reads episodes.quality_renditions
    const rows = await queryAll<{ label: string; asset_id: string }>(c.env.DB, `SELECT label, asset_id FROM episode_renditions WHERE episode_id=? AND status='ready' ORDER BY sort_order`, [id]);
    const jsonVals = rows.map(r => ({ label: r.label, asset_id: r.asset_id }));
    await c.env.DB.prepare(`UPDATE episodes SET quality_renditions=?, updated_at=datetime('now') WHERE id=?`).bind(JSON.stringify(jsonVals), id).run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) return c.json({ success: false, error: 'Label already exists' }, 409);
    throw e;
  }
  return c.json({ success: true, data: { id: newId } }, 201);
});

route.delete('/episodes/:id/renditions/:rendId', requireAdmin, requirePermission('edit_metadata'), async (c) => {
  const { id, rendId } = c.req.param();
  await c.env.DB.prepare(`UPDATE episode_renditions SET status='archived' WHERE id=? AND episode_id=?`).bind(rendId, id).run();
  const rows = await queryAll<{ label: string; asset_id: string }>(c.env.DB, `SELECT label, asset_id FROM episode_renditions WHERE episode_id=? AND status='ready' ORDER BY sort_order`, [id]);
  await c.env.DB.prepare(`UPDATE episodes SET quality_renditions=?, updated_at=datetime('now') WHERE id=?`).bind(JSON.stringify(rows.map(r => ({ label: r.label, asset_id: r.asset_id }))), id).run();
  return c.json({ success: true });
});

export default route;
