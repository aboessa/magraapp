import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts'
import { actorId, auditStatement } from '../lib/auditLog.ts'
import { parsePagination } from '../lib/catalogueValidation.ts'
import { pathParam } from '../lib/routeParams.ts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()
route.use('*', requireAdmin)

// Helper: safe JSON parse
function parseJson(v: unknown, fallback: any = null) {
  if (typeof v !== 'string') return fallback
  try { return JSON.parse(v) } catch { return fallback }
}

// --- Service Registry + Health ---
route.get('/ops/services', async (c) => {
  const services = await queryAll(c.env.DB, `SELECT * FROM ops_services WHERE is_active=1 ORDER BY tier, name`)
  // attach latest health per service
  const result = []
  for (const s of services as any[]) {
    const health = await queryFirst(c.env.DB, `SELECT status, latency_ms, checked_at FROM ops_health_checks WHERE service_id=? ORDER BY checked_at DESC LIMIT 1`, [s.id])
    const alerts = await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM ops_alerts WHERE service_id=? AND status IN ('open','acknowledged')`, [s.id])
    const incident = await queryFirst(c.env.DB, `SELECT id FROM ops_incidents WHERE status IN ('open','investigating','identified','monitoring') AND affected_services LIKE ? LIMIT 1`, [`%${s.id}%`])
    result.push({ ...s, dependencies: parseJson(s.dependencies, []), latest_health: health ?? { status: 'unknown', checked_at: null }, open_alerts: Number(alerts?.cnt ?? 0), open_incident: incident ? (incident as any).id : null })
  }
  return c.json({ success: true, data: result })
})

route.get('/ops/services/:id', async (c) => {
  const id = pathParam(c, 'id')
  const svc = await queryFirst(c.env.DB, `SELECT * FROM ops_services WHERE id=?`, [id])
  if (!svc) return c.json({ success: false, error: 'Service not found' }, 404)
  const checks = await queryAll(c.env.DB, `SELECT * FROM ops_health_checks WHERE service_id=? ORDER BY checked_at DESC LIMIT 20`, [id])
  const alerts = await queryAll(c.env.DB, `SELECT * FROM ops_alerts WHERE service_id=? ORDER BY started_at DESC LIMIT 20`, [id])
  const incidents = await queryAll(c.env.DB, `SELECT * FROM ops_incidents WHERE affected_services LIKE ? ORDER BY started_at DESC LIMIT 10`, [`%${id}%`])
  // Recent changes correlation: last remote_config changes
  const changes = await queryAll(c.env.DB, `SELECT * FROM audit_logs WHERE entity_type IN ('remote_config','feature_flag') ORDER BY created_at DESC LIMIT 5`)
  return c.json({ success: true, data: { service: { ...(svc as any), dependencies: parseJson((svc as any).dependencies, []) }, health_checks: checks, alerts, incidents, recent_changes: changes } })
})

// --- Monitoring overview (system vs business health) ---
route.get('/ops/overview', async (c) => {
  // System health: probe via simple queries, not per-card fan-out
  const probes = []
  let overall: 'healthy'|'degraded'|'partial_outage'|'outage'|'unknown' = 'healthy'
  let criticalIncidents = 0
  let activeAlerts = 0
  let failedEvents = 0
  let queueBacklog: number | null = null
  let apiError: string | null = null
  let dbError: string | null = null
  let familyError: string | null = null
  let cdnError: string | null = null

  try {
    await queryFirst(c.env.DB, `SELECT 1 as ok`)
  } catch (e) { dbError = String(e); overall = 'degraded' }

  try {
    const r = await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM failed_family_events WHERE status='pending'`)
    failedEvents = Number(r?.cnt ?? 0)
    if (failedEvents > 0) overall = overall === 'healthy' ? 'degraded' : overall
  } catch {}

  try {
    const r = await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM ops_alerts WHERE status IN ('open','acknowledged')`)
    activeAlerts = Number(r?.cnt ?? 0)
  } catch {}

  try {
    const r = await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM ops_incidents WHERE status IN ('open','investigating','identified','monitoring') AND severity='critical'`)
    criticalIncidents = Number(r?.cnt ?? 0)
    if (criticalIncidents > 0) overall = 'partial_outage'
  } catch {}

  try {
    const r = await queryFirst<{pending:number}>(c.env.DB, `SELECT pending FROM queue_health WHERE queue_name='family_events'`)
    queueBacklog = r?.pending ?? null
  } catch { queueBacklog = null }

  // Telemetry capability: report what's available
  const telemetry = await queryAll(c.env.DB, `SELECT * FROM telemetry_sources ORDER BY status, signal`)

  // Business health: publishing pipeline, billing verification, etc. (derived counts, not zeros)
  const business = {
    publishing_blocked: await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM series WHERE status IN ('ready','scheduled')`).then(r=> Number(r?.cnt ?? 0)).catch(()=> null),
    support_breaches: await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM sla_escalation_log`).then(r=> Number(r?.cnt ?? 0)).catch(()=> null),
    workflow_stuck: await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM workflow_runs WHERE status='open'`).then(r=> Number(r?.cnt ?? 0)).catch(()=> null),
  }

  return c.json({ success: true, data: {
    overall_health: overall,
    critical_incidents: criticalIncidents,
    active_alerts: activeAlerts,
    failed_queue_events: failedEvents,
    queue_backlog: queueBacklog,
    api: apiError ? { status: 'unknown', error: apiError } : { status: 'healthy', checked_at: new Date().toISOString() },
    d1: dbError ? { status: 'outage', error: dbError } : { status: 'healthy' },
    telemetry,
    business,
    generated_at: new Date().toISOString(),
  }})
})

// --- Alerts ---
route.get('/ops/alerts', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const status = c.req.query('status')
  const severity = c.req.query('severity')
  const service = c.req.query('service_id')
  const clauses: string[] = []
  const params: unknown[] = []
  if (status) { clauses.push('status = ?'); params.push(status) }
  if (severity) { clauses.push('severity = ?'); params.push(severity) }
  if (service) { clauses.push('service_id = ?'); params.push(service) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = await queryFirst<{total:number}>(c.env.DB, `SELECT COUNT(*) as total FROM ops_alerts ${where}`, params)
  const rows = await queryAll(c.env.DB, `SELECT * FROM ops_alerts ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset } })
})

route.post('/ops/alerts/:id/acknowledge', requirePermission('edit_metadata'), async (c) => {
  const id = pathParam(c, 'id')
  const row = await queryFirst(c.env.DB, `SELECT id, status FROM ops_alerts WHERE id=?`, [id])
  if (!row) return c.json({ success: false, error: 'Alert not found' }, 404)
  if ((row as any).status === 'resolved') return c.json({ success: false, error: 'Already resolved' }, 400)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE ops_alerts SET status='acknowledged', acknowledged_at=datetime('now'), acknowledged_by=?, updated_at=datetime('now') WHERE id=?`).bind(actorId(c), id),
    auditStatement(c.env.DB, actorId(c), 'acknowledge', 'ops_alert', id, {})
  ])
  return c.json({ success: true, data: { id, status: 'acknowledged' } })
})

// --- Incidents ---
route.get('/ops/incidents', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const status = c.req.query('status')
  const severity = c.req.query('severity')
  const clauses: string[] = []
  const params: unknown[] = []
  if (status) { clauses.push('status = ?'); params.push(status) }
  if (severity) { clauses.push('severity = ?'); params.push(severity) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = await queryFirst<{total:number}>(c.env.DB, `SELECT COUNT(*) as total FROM ops_incidents ${where}`, params)
  const rows = await queryAll(c.env.DB, `SELECT * FROM ops_incidents ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
  return c.json({ success: true, data: rows.map((r:any)=> ({...r, affected_services: parseJson(r.affected_services,[])})), meta: { total: Number(total?.total ?? 0), limit, offset } })
})

route.post('/ops/incidents', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(()=>null) as Record<string,unknown>|null
  if (!body || typeof body.title !== 'string' || !body.title.trim()) return c.json({ success:false, error:'title required' },400)
  const severity = typeof body.severity==='string' && ['critical','high','medium','low'].includes(body.severity) ? body.severity : 'medium'
  const affected = Array.isArray(body.affected_services) ? body.affected_services : []
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO ops_incidents (id, title, severity, status, affected_services, started_at, detected_at, owner_id, impact, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, (body.title as string).trim(), severity, 'open', JSON.stringify(affected), new Date().toISOString(), new Date().toISOString(), (body.owner_id as string)??null, (body.impact as string)??null, actorId(c)),
    c.env.DB.prepare(`INSERT INTO ops_incident_timeline (id, incident_id, entry_type, body, actor_id) VALUES (?,?,?,?,?)`).bind(crypto.randomUUID(), id, 'note', `Incident opened: ${(body.title as string).trim()}`, actorId(c)),
    auditStatement(c.env.DB, actorId(c), 'create', 'ops_incident', id, { title: body.title, severity })
  ])
  return c.json({ success:true, data:{ id } },201)
})

route.get('/ops/incidents/:id', async (c) => {
  const id = pathParam(c,'id')
  const row = await queryFirst(c.env.DB, `SELECT * FROM ops_incidents WHERE id=?`, [id])
  if (!row) return c.json({ success:false, error:'Incident not found' },404)
  const timeline = await queryAll(c.env.DB, `SELECT * FROM ops_incident_timeline WHERE incident_id=? ORDER BY created_at ASC`, [id])
  const alerts = await queryAll(c.env.DB, `SELECT * FROM ops_alerts WHERE incident_id=? ORDER BY started_at DESC`, [id])
  const failed = await queryAll(c.env.DB, `SELECT * FROM failed_family_events WHERE status='pending' ORDER BY failed_at DESC LIMIT 5`)
  return c.json({ success:true, data: { ...(row as any), affected_services: parseJson((row as any).affected_services,[]), timeline, alerts, failed_events: failed } })
})

route.patch('/ops/incidents/:id', requirePermission('edit_metadata'), async (c) => {
  const id = pathParam(c,'id')
  const body = await c.req.json().catch(()=>null) as Record<string,unknown>|null
  if (!body) return c.json({ success:false, error:'Invalid body' },400)
  const existing = await queryFirst(c.env.DB, `SELECT status FROM ops_incidents WHERE id=?`, [id])
  if (!existing) return c.json({ success:false, error:'Incident not found' },404)
  const sets:string[]=[]; const params:unknown[]=[]
  if (typeof body.status==='string' && ['open','investigating','identified','monitoring','resolved'].includes(body.status)) {
    sets.push('status=?'); params.push(body.status)
    if (body.status==='resolved') { sets.push('resolved_at=datetime(\'now\')'); }
  }
  if (typeof body.resolution==='string') { sets.push('resolution=?'); params.push(body.resolution.slice(0,2000)) }
  if (typeof body.impact==='string') { sets.push('impact=?'); params.push(body.impact.slice(0,2000)) }
  if (!sets.length) return c.json({ success:false, error:'No valid fields' },400)
  sets.push(`updated_at=datetime('now')`)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE ops_incidents SET ${sets.join(', ')} WHERE id=?`).bind(...params, id),
    c.env.DB.prepare(`INSERT INTO ops_incident_timeline (id, incident_id, entry_type, body, actor_id) VALUES (?,?,?,?,?)`).bind(crypto.randomUUID(), id, 'status', `Status → ${body.status}`, actorId(c)),
    auditStatement(c.env.DB, actorId(c), 'update', 'ops_incident', id, body)
  ])
  return c.json({ success:true, data:{ id } })
})

// --- Queues ---
route.get('/ops/queues', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT * FROM queue_health ORDER BY queue_name`)
  return c.json({ success:true, data: rows })
})

route.get('/ops/queues/:name', async (c) => {
  const name = pathParam(c,'name')
  const row = await queryFirst(c.env.DB, `SELECT * FROM queue_health WHERE queue_name=?`, [name])
  if (!row) return c.json({ success:false, error:'Queue not found' },404)
  const failed = await queryAll(c.env.DB, `SELECT * FROM failed_family_events WHERE status='pending' ORDER BY failed_at DESC LIMIT 10`)
  const recent = await queryAll(c.env.DB, `SELECT * FROM processed_family_events ORDER BY processed_at DESC LIMIT 10`)
  return c.json({ success:true, data: { queue: row, failed, recent } })
})

// --- Telemetry sources ---
route.get('/ops/telemetry', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT * FROM telemetry_sources ORDER BY status, signal`)
  return c.json({ success:true, data: rows })
})

// --- Operational timeline (recent changes) ---
route.get('/ops/timeline', async (c) => {
  const { limit } = parsePagination(c.req.query('limit'), undefined, { defaultLimit: 20, maxLimit: 50 })
  const incidents = await queryAll(c.env.DB, `SELECT id, title, severity, status, started_at as at FROM ops_incidents ORDER BY started_at DESC LIMIT ?`, [limit])
  const alerts = await queryAll(c.env.DB, `SELECT id, condition_text as title, severity, status, started_at as at FROM ops_alerts ORDER BY started_at DESC LIMIT ?`, [limit])
  const deploys = await queryAll(c.env.DB, `SELECT id, action as title, created_at as at FROM audit_logs WHERE entity_type IN ('remote_config','feature_flag') ORDER BY created_at DESC LIMIT ?`, [limit])
  const failed = await queryAll(c.env.DB, `SELECT id, event_type as title, failed_at as at FROM failed_family_events ORDER BY failed_at DESC LIMIT ?`, [limit])
  const merged = [
    ...incidents.map((r:any)=> ({ ...r, type:'incident' })),
    ...alerts.map((r:any)=> ({ ...r, type:'alert' })),
    ...deploys.map((r:any)=> ({ ...r, type:'change' })),
    ...failed.map((r:any)=> ({ ...r, type:'failed_event' })),
  ].sort((a,b)=> String(b.at).localeCompare(String(a.at))).slice(0, limit)
  return c.json({ success:true, data: merged })
})

// --- SLA ---
route.get('/sla/policies', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT * FROM sla_policies WHERE is_active=1 ORDER BY domain, name`)
  return c.json({ success:true, data: rows.map((r:any)=> ({...r, escalation_rules: parseJson(r.escalation_rules,[]), business_calendar: parseJson(r.business_calendar, null)})) })
})

route.get('/sla/policies/:id', async (c) => {
  const id = pathParam(c,'id')
  const row = await queryFirst(c.env.DB, `SELECT * FROM sla_policies WHERE id=?`, [id])
  if (!row) return c.json({ success:false, error:'Policy not found' },404)
  const affected = await queryAll(c.env.DB, `SELECT id FROM audit_logs WHERE entity_type='sla_escalation' AND entity_id=? LIMIT 10`, [id])
  return c.json({ success:true, data: { ...(row as any), escalation_rules: parseJson((row as any).escalation_rules,[]), affected_work: affected } })
})

route.post('/sla/policies', requirePermission('manage_permissions'), async (c) => {
  const body = await c.req.json().catch(()=>null) as Record<string,unknown>|null
  if (!body || typeof body.name !== 'string' || !body.name.trim()) return c.json({ success:false, error:'name required' },400)
  const domain = typeof body.domain==='string' ? body.domain : 'support'
  if (!['support','content_review','workflow','production','queue','incident'].includes(domain)) return c.json({ success:false, error:'Invalid domain' },400)
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO sla_policies (id, domain, name, applies_to, priority, first_response_minutes, resolution_minutes, business_calendar, pause_condition, escalation_rules) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, domain, (body.name as string).trim(), (body.applies_to as string)??null, (body.priority as string)??null, (body.first_response_minutes as number)??null, (body.resolution_minutes as number)??null, body.business_calendar ? JSON.stringify(body.business_calendar) : null, (body.pause_condition as string)??null, JSON.stringify(body.escalation_rules ?? [])),
    auditStatement(c.env.DB, actorId(c), 'create', 'sla_policy', id, body)
  ])
  return c.json({ success:true, data:{ id } },201)
})

route.get('/sla/command-center', async (c) => {
  const domain = c.req.query('domain')
  // Support: compute breaching via SLA? For now aggregate from escalation_log
  const breached = await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM sla_escalation_log`)
  const atRisk = await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM support_tickets WHERE status NOT IN ('resolved','closed')`)
  return c.json({ success:true, data: {
    breached: Number(breached?.cnt ?? 0),
    at_risk: Number(atRisk?.cnt ?? 0),
    due_soon: 0,
    paused: await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM support_tickets WHERE status='waiting_customer'`).then(r=>Number(r?.cnt ?? 0)),
    recently_resolved: await queryFirst<{cnt:number}>(c.env.DB, `SELECT COUNT(*) as cnt FROM support_tickets WHERE status IN ('resolved','closed') AND datetime(updated_at) >= datetime('now','-7 days')`).then(r=>Number(r?.cnt ?? 0)),
  }})
})

// Failed events grouping
route.get('/ops/failed-grouped', async (c) => {
  const by = c.req.query('by') || 'queue' // queue, category, entity
  if (by==='queue') {
    const rows = await queryAll(c.env.DB, `SELECT 'family_events' as queue, COUNT(*) as cnt, MAX(failed_at) as last FROM failed_family_events WHERE status='pending'`)
    return c.json({ success:true, data: rows })
  }
  if (by==='category') {
    const rows = await queryAll(c.env.DB, `SELECT event_type as category, COUNT(*) as cnt FROM failed_family_events WHERE status='pending' GROUP BY event_type ORDER BY cnt DESC`)
    return c.json({ success:true, data: rows })
  }
  return c.json({ success:true, data: [] })
})

export default route
