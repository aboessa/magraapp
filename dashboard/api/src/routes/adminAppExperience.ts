import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { queryAll, queryFirst } from '../lib/db'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

// Home Experience Builder - يتحكم في تركيب الصفحة الرئيسية
route.get('/home-experience', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT * FROM home_experience_blocks ORDER BY sort_order, created_at`)
  return c.json({ success: true, data: rows.map(r => ({ ...r, targeting: JSON.parse((r as any).targeting_json || '{}'), config: JSON.parse((r as any).config_json || '{}') })) })
})

route.post('/home-experience', async (c) => {
  const body = await c.req.json().catch(() => null) as any
  if (!body?.block_type) return c.json({ success: false, error: 'block_type required' }, 400)
  const id = `block-${Date.now()}`
  await c.env.DB.prepare(`INSERT INTO home_experience_blocks (id, block_type, title_ar, sort_order, is_active, is_draft, scheduled_at, expires_at, version, targeting_json, config_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, body.block_type, body.title_ar || null, body.sort_order ?? 99, body.is_active ?? 1, body.is_draft ? 1 : 0, body.scheduled_at || null, body.expires_at || null, 1, JSON.stringify(body.targeting || {}), JSON.stringify(body.config || {})).run()
  // snapshot for rollback
  await c.env.DB.prepare(`INSERT INTO home_experience_versions (id, snapshot_json) VALUES (?,?)`).bind(`ver-${id}-${Date.now()}`, JSON.stringify({ id, block_type: body.block_type, title_ar: body.title_ar })).run().catch(() => {})
  return c.json({ success: true, data: { id } }, 201)
})

route.patch('/home-experience/:id', async (c) => {
  const body = await c.req.json().catch(() => null) as any
  const sets: string[] = []
  const params: unknown[] = []
  const add = (col: string, val: unknown) => { sets.push(`${col}=?`); params.push(val) }
  if (body.title_ar !== undefined) add('title_ar', body.title_ar)
  if (body.sort_order !== undefined) add('sort_order', body.sort_order)
  if (body.is_active !== undefined) add('is_active', body.is_active ? 1 : 0)
  if (body.is_draft !== undefined) add('is_draft', body.is_draft ? 1 : 0)
  if (body.scheduled_at !== undefined) add('scheduled_at', body.scheduled_at)
  if (body.expires_at !== undefined) add('expires_at', body.expires_at)
  if (body.version !== undefined) add('version', body.version)
  if (body.targeting !== undefined) add('targeting_json', JSON.stringify(body.targeting))
  if (body.config !== undefined) add('config_json', JSON.stringify(body.config))
  if (!sets.length) return c.json({ success: false, error: 'No fields' }, 400)
  await c.env.DB.prepare(`UPDATE home_experience_blocks SET ${sets.join(', ')}, updated_at=datetime('now') WHERE id=?`).bind(...params, c.req.param('id')).run()
  return c.json({ success: true, data: { id: c.req.param('id') } })
})

route.post('/home-experience/:id/rollback', async (c) => {
  const id = c.req.param('id')
  const ver = await c.env.DB.prepare(`SELECT snapshot_json FROM home_experience_versions WHERE id LIKE ? ORDER BY created_at DESC LIMIT 1`).bind(`ver-${id}%`).first() as any
  if (!ver) return c.json({ success: false, error: 'No version found' }, 404)
  const snap = JSON.parse(ver.snapshot_json)
  await c.env.DB.prepare(`UPDATE home_experience_blocks SET title_ar=?, targeting_json=?, config_json=?, version=version+1 WHERE id=?`).bind(snap.title_ar, JSON.stringify(snap.targeting || {}), JSON.stringify(snap.config || {}), id).run()
  return c.json({ success: true, data: { rolled_back: true } })
})

route.post('/home-experience/reorder', async (c) => {
  const body = await c.req.json().catch(() => null) as any
  const order: string[] = body?.order
  if (!Array.isArray(order)) return c.json({ success: false, error: 'order must be array of ids' }, 400)
  for (let i = 0; i < order.length; i++) {
    await c.env.DB.prepare(`UPDATE home_experience_blocks SET sort_order=? WHERE id=?`).bind(i, order[i]).run()
  }
  return c.json({ success: true, data: { reordered: true } })
})

route.delete('/home-experience/:id', async (c) => {
  await c.env.DB.prepare(`DELETE FROM home_experience_blocks WHERE id=?`).bind(c.req.param('id')).run()
  return c.json({ success: true, data: { deleted: true } })
})

// Preview - يبني JSON للصفحة حسب الاستهداف + الجدولة
route.get('/home-experience/preview', async (c) => {
  const track = c.req.query('track') || 'kids'
  const country = c.req.query('country') || 'EG'
  const platform = c.req.query('platform') || 'mobile'
  const plan = c.req.query('plan') || 'family'
  const isNewUser = c.req.query('is_new_user') === '1'
  const now = new Date().toISOString()
  const rows = await queryAll(c.env.DB, `SELECT * FROM home_experience_blocks WHERE is_active=1 AND is_draft=0 AND (scheduled_at IS NULL OR scheduled_at <= ?) AND (expires_at IS NULL OR expires_at > ?) ORDER BY sort_order`, [now, now])
  const filtered = rows.filter((r: any) => {
    const t = JSON.parse(r.targeting_json || '{}')
    if (t.track && t.track !== track) return false
    if (t.country && t.country !== country) return false
    if (t.platform && t.platform !== platform) return false
    if (t.plan && t.plan !== plan) return false
    if (t.is_new_user !== undefined && Boolean(t.is_new_user) !== isNewUser) return false
    return true
  })
  return c.json({ success: true, data: { blocks: filtered, meta: { track, country, platform, plan, isNewUser } } })
})

// Devices
route.get('/devices', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT d.*, p.display_name as parent_name FROM account_devices d LEFT JOIN parents p ON p.id=d.parent_id ORDER BY d.last_seen_at DESC LIMIT 50`)
  return c.json({ success: true, data: rows })
})

// Support Center - Family lookup
route.get('/support/family/:id', async (c) => {
  const id = c.req.param('id')
  const family = await queryFirst(c.env.DB, `SELECT * FROM family_projection WHERE parent_id=?`, [id])
  if (!family) return c.json({ success: false, error: 'Family not found' }, 404)
  const children = await queryAll(c.env.DB, `SELECT * FROM child_projection WHERE parent_id=?`, [id])
  const devices = await queryAll(c.env.DB, `SELECT * FROM account_devices WHERE parent_id=? ORDER BY last_seen_at DESC`, [id])
  const entitlements = await queryAll(c.env.DB, `SELECT * FROM billing_audit WHERE parent_id=? ORDER BY created_at DESC LIMIT 10`, [id])
  return c.json({ success: true, data: { family, children, devices, entitlements } })
})

// Rights
route.get('/rights', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT r.*, s.title_ar as series_title FROM rights_licenses r LEFT JOIN series s ON s.id=r.content_id ORDER BY r.expires_at`)
  return c.json({ success: true, data: rows })
})

route.post('/rights', async (c) => {
  const body = await c.req.json().catch(() => null) as any
  if (!body?.content_id || !body?.owner) return c.json({ success: false, error: 'content_id and owner required' }, 400)
  const id = `rights-${Date.now()}`
  await c.env.DB.prepare(`INSERT INTO rights_licenses (id, content_id, owner, license_type, countries, languages, devices, expiry_date) VALUES (?,?,?,?,?,?,?,?)`).bind(id, body.content_id, body.owner, body.license_type || 'exclusive', JSON.stringify(body.countries || []), JSON.stringify(body.languages || []), JSON.stringify(body.devices || []), body.expiry_date || null).run()
  return c.json({ success: true, data: { id } }, 201)
})

export default route
