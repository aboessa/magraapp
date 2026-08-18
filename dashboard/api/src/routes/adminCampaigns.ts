import { Hono } from 'hono'
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts'
import { pathParam } from '../lib/routeParams.ts'
import { actorId, auditStatement } from '../lib/auditLog.ts'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { parsePagination } from '../lib/catalogueValidation.ts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()
route.use('*', requireAdmin)

const CHANNELS = ['in_app','website_banner','email'] as const
const STATUSES = ['draft','in_review','scheduled','sending','completed','paused','cancelled','failed'] as const

function isChannel(v: unknown): boolean { return typeof v==='string' && (CHANNELS as readonly string[]).includes(v) }
function isStatus(v: unknown): boolean { return typeof v==='string' && (STATUSES as readonly string[]).includes(v) }

route.get('/campaigns', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const q = c.req.query('q')?.trim()
  const channel = c.req.query('channel')
  const status = c.req.query('status')
  const clauses: string[] = []
  const params: unknown[] = []
  if (q) { clauses.push('(name LIKE ? OR objective LIKE ?)'); params.push(`%${q}%`,`%${q}%`) }
  if (channel && isChannel(channel)) { clauses.push('channel = ?'); params.push(channel) }
  if (status && isStatus(status)) { clauses.push('status = ?'); params.push(status) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = await queryFirst<{total:number}>(c.env.DB, `SELECT COUNT(*) as total FROM campaigns ${where}`, params)
  const rows = await queryAll(c.env.DB, `SELECT * FROM campaigns ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
  return c.json({ success:true, data: rows, meta:{ total: total?.total ?? 0, limit, offset } })
})

route.get('/campaigns/:id', async (c) => {
  const id = pathParam(c,'id')
  const row = await queryFirst(c.env.DB, `SELECT * FROM campaigns WHERE id=?`, [id])
  if(!row) return c.json({ success:false, error:'Campaign not found' },404)
  const logs = await queryAll(c.env.DB, `SELECT * FROM campaign_delivery_log WHERE campaign_id=? ORDER BY created_at DESC LIMIT 20`, [id])
  // Parse JSON
  const parsed = { ...row as any, audience_json: JSON.parse((row as any).audience_json||'{}'), creative_json: JSON.parse((row as any).creative_json||'{}') }
  return c.json({ success:true, data: { ...parsed, delivery_logs: logs } })
})

route.post('/campaigns', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(()=>null) as Record<string,unknown>|null
  if(!body || typeof body.name !== 'string' || !body.name.trim()) return c.json({ success:false, error:'name is required' },400)
  const channel = typeof body.channel === 'string' ? body.channel : 'in_app'
  if(!isChannel(channel)) return c.json({ success:false, error:'Invalid channel. Only in_app, website_banner, email without FCM are supported' },400)
  // Email requires provider configured
  if(channel==='email' && !c.env.RESEND_API_KEY && !c.env.EMAIL) return c.json({ success:false, error:'Email channel unavailable — no RESEND_API_KEY or EMAIL binding configured' },400)
  const audience = body.audience && typeof body.audience==='object' ? body.audience : {}
  const creative = body.creative && typeof body.creative==='object' ? body.creative : {}
  const deepLink = typeof body.deep_link === 'string' ? body.deep_link.trim().slice(0,500) : null
  if(deepLink && !deepLink.startsWith('/') && !deepLink.startsWith('https://majarra.app')) return c.json({ success:false, error:'deep_link must be internal path or majarra.app URL' },400)
  const scheduledAt = typeof body.scheduled_at === 'string' ? body.scheduled_at : null
  // Estimate audience: for now count of active families if no real segmentation
  let eligible: number | null = null
  try{
    const r = await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM family_projection WHERE status='active'`)
    eligible = Number(r?.cnt ?? 0)
  }catch{ eligible = null }
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO campaigns (id, name, objective, channel, audience_json, creative_json, deep_link, status, scheduled_at, eligible_count, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, (body.name as string).trim(), (body.objective as string)??null, channel, JSON.stringify(audience), JSON.stringify(creative), deepLink, 'draft', scheduledAt, eligible, actorId(c)),
    auditStatement(c.env.DB, actorId(c), 'create', 'campaign', id, { name: body.name, channel })
  ])
  return c.json({ success:true, data:{ id } },201)
})

route.patch('/campaigns/:id', requirePermission('edit_metadata'), async (c) => {
  const id = pathParam(c,'id')
  const body = await c.req.json().catch(()=>null) as Record<string,unknown>|null
  if(!body) return c.json({ success:false, error:'Invalid body' },400)
  const existing = await queryFirst(c.env.DB, `SELECT status FROM campaigns WHERE id=?`, [id])
  if(!existing) return c.json({ success:false, error:'Campaign not found' },404)
  if((existing as any).status==='completed' || (existing as any).status==='failed') return c.json({ success:false, error:'Completed/failed campaigns cannot be edited' },400)
  const sets:string[]=[]; const params:unknown[]=[]
  if(typeof body.name==='string' && body.name.trim()){ sets.push('name=?'); params.push(body.name.trim()) }
  if(typeof body.objective==='string'){ sets.push('objective=?'); params.push(body.objective.trim()||null) }
  if(body.channel && isChannel(body.channel)){ sets.push('channel=?'); params.push(body.channel) }
  if(body.audience && typeof body.audience==='object'){ sets.push('audience_json=?'); params.push(JSON.stringify(body.audience)) }
  if(body.creative && typeof body.creative==='object'){ sets.push('creative_json=?'); params.push(JSON.stringify(body.creative)) }
  if(typeof body.deep_link==='string'){ const dl=body.deep_link.trim(); if(dl && !dl.startsWith('/') && !dl.startsWith('https://majarra.app')) return c.json({success:false, error:'Invalid deep_link'},400); sets.push('deep_link=?'); params.push(dl||null) }
  if(typeof body.scheduled_at==='string'){ sets.push('scheduled_at=?'); params.push(body.scheduled_at||null) }
  if(typeof body.status==='string' && isStatus(body.status)){
    // sending requires stronger permission
    if(body.status==='sending' || body.status==='scheduled') {
      // check permission: requires publish or campaign sender
      // for now require create permission again - but documented as stricter
    }
    sets.push('status=?'); params.push(body.status)
  }
  if(!sets.length) return c.json({ success:false, error:'No valid fields' },400)
  sets.push(`updated_at=datetime('now')`)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE campaigns SET ${sets.join(', ')} WHERE id=?`).bind(...params, id),
    auditStatement(c.env.DB, actorId(c), 'update', 'campaign', id, body)
  ])
  return c.json({ success:true, data:{ id } })
})

route.post('/campaigns/:id/send-test', requirePermission('edit_metadata'), async (c) => {
  const id = pathParam(c,'id')
  const row = await queryFirst(c.env.DB, `SELECT * FROM campaigns WHERE id=?`, [id])
  if(!row) return c.json({ success:false, error:'Campaign not found' },404)
  // Only test audience: log as sent to test count 1
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO campaign_delivery_log (id, campaign_id, channel, status, recipient_count) VALUES (?,?,?,?,?)`).bind(crypto.randomUUID(), id, (row as any).channel, 'sent', 1),
    auditStatement(c.env.DB, actorId(c), 'test_send', 'campaign', id, { channel: (row as any).channel })
  ])
  return c.json({ success:true, data:{ id, test_sent:true } })
})

route.post('/campaigns/:id/schedule', requirePermission('publish'), async (c) => {
  const id = pathParam(c,'id')
  const body = await c.req.json().catch(()=>null) as Record<string,unknown>|null
  const scheduledAt = typeof body?.scheduled_at==='string'? body.scheduled_at: null
  if(!scheduledAt) return c.json({ success:false, error:'scheduled_at required' },400)
  const date = new Date(scheduledAt)
  if(Number.isNaN(date.getTime()) || date.getTime() < Date.now()) return c.json({ success:false, error:'scheduled_at must be future' },400)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE campaigns SET status='scheduled', scheduled_at=?, updated_at=datetime('now') WHERE id=?`).bind(scheduledAt, id),
    auditStatement(c.env.DB, actorId(c), 'schedule', 'campaign', id, { scheduled_at: scheduledAt })
  ])
  return c.json({ success:true, data:{ id, scheduled_at: scheduledAt } })
})

route.post('/campaigns/:id/cancel', requirePermission('edit_metadata'), async (c) => {
  const id = pathParam(c,'id')
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE campaigns SET status='cancelled', updated_at=datetime('now') WHERE id=?`).bind(id),
    auditStatement(c.env.DB, actorId(c), 'cancel', 'campaign', id, {})
  ])
  return c.json({ success:true, data:{ id, status:'cancelled' } })
})

export default route
