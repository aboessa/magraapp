import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { queryAll, queryFirst } from '../lib/db'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

// Teams
route.get('/teams', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT t.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id=t.id) as members_count FROM teams t ORDER BY t.created_at DESC`)
  return c.json({ success: true, data: rows })
})

route.post('/teams', async (c) => {
  const body = await c.req.json().catch(() => null) as any
  if (!body?.name_ar) return c.json({ success: false, error: 'name_ar required' }, 400)
  const id = body.id || `team-${Date.now()}`
  await c.env.DB.prepare(`INSERT INTO teams (id, name_ar, description_ar, planet_id, section) VALUES (?,?,?,?,?)`).bind(id, body.name_ar, body.description_ar || null, body.planet_id || null, body.section || null).run()
  if (Array.isArray(body.member_ids)) {
    for (const uid of body.member_ids) {
      await c.env.DB.prepare(`INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?,?)`).bind(id, uid).run()
    }
  }
  return c.json({ success: true, data: { id } }, 201)
})

route.get('/teams/:id', async (c) => {
  const team = await queryFirst(c.env.DB, `SELECT * FROM teams WHERE id=?`, [c.req.param('id')])
  if (!team) return c.json({ success: false, error: 'Team not found' }, 404)
  const members = await queryAll(c.env.DB, `SELECT u.id, u.display_name, u.email FROM team_members tm JOIN admin_users u ON u.id=tm.user_id WHERE tm.team_id=?`, [c.req.param('id')])
  return c.json({ success: true, data: { ...team, members } })
})

// Roles
route.get('/roles', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT r.*, (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id=r.id) as permissions_count FROM roles r ORDER BY r.name_ar`)
  return c.json({ success: true, data: rows })
})

// Permissions
route.get('/permissions', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT * FROM permissions ORDER BY action`)
  return c.json({ success: true, data: rows })
})

// Access Grants - 4 layers
route.get('/grants', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT ag.*, r.name_ar as role_name FROM access_grants ag LEFT JOIN roles r ON r.id=ag.role_id ORDER BY ag.created_at DESC LIMIT 100`)
  return c.json({ success: true, data: rows })
})

route.post('/grants', async (c) => {
  const body = await c.req.json().catch(() => null) as any
  if (!body?.grantee_id || !body?.role_id) return c.json({ success: false, error: 'grantee_id and role_id required' }, 400)
  const id = `grant-${Date.now()}`
  await c.env.DB.prepare(`INSERT INTO access_grants (id, grantee_type, grantee_id, role_id, scope_type, scope_id, content_type, language, valid_until, granted_by) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
    id, body.grantee_type || 'user', body.grantee_id, body.role_id, body.scope_type || 'platform', body.scope_id || null, body.content_type || null, body.language || null, body.valid_until || null, 'admin-api-key'
  ).run()
  return c.json({ success: true, data: { id } }, 201)
})

route.delete('/grants/:id', async (c) => {
  await c.env.DB.prepare(`DELETE FROM access_grants WHERE id=?`).bind(c.req.param('id')).run()
  return c.json({ success: true, data: { deleted: true } })
})

// Workflow
route.get('/workflows/runs', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT wr.*, (SELECT COUNT(*) FROM workflow_step_reviews wsr WHERE wsr.run_id=wr.id) as reviews_count FROM workflow_runs wr ORDER BY wr.updated_at DESC LIMIT 50`)
  return c.json({ success: true, data: rows })
})

route.post('/workflows/runs/:id/review', async (c) => {
  const body = await c.req.json().catch(() => null) as any
  const decision = body?.decision
  if (!['approved', 'rejected', 'changes_requested'].includes(decision)) return c.json({ success: false, error: 'Invalid decision' }, 400)
  const runId = c.req.param('id')
  const id = `review-${Date.now()}`
  await c.env.DB.prepare(`INSERT INTO workflow_step_reviews (id, run_id, step, reviewer_id, decision, comment) VALUES (?,?,?,?,?,?)`).bind(id, runId, body.step || 'review', body.reviewer_id || 'admin', decision, body.comment || null).run()
  if (decision === 'approved') {
    await c.env.DB.prepare(`UPDATE workflow_runs SET current_step='approved', status='approved', updated_at=datetime('now') WHERE id=?`).bind(runId).run()
  }
  return c.json({ success: true, data: { id } })
})

// Tasks - My tasks
route.get('/tasks', async (c) => {
  const assignee = c.req.query('assignee_id')
  const status = c.req.query('status')
  let sql = `SELECT t.*, s.title_ar as series_title FROM tasks t LEFT JOIN series s ON s.id=t.content_id ORDER BY t.created_at DESC`
  const params: unknown[] = []
  const clauses: string[] = []
  if (assignee) { clauses.push('t.assignee_id=?'); params.push(assignee) }
  if (status) { clauses.push('t.status=?'); params.push(status) }
  if (clauses.length) sql = `SELECT t.*, s.title_ar as series_title FROM tasks t LEFT JOIN series s ON s.id=t.content_id WHERE ${clauses.join(' AND ')} ORDER BY t.created_at DESC`
  const rows = await queryAll(c.env.DB, sql, params)
  return c.json({ success: true, data: rows })
})

route.get('/audit-logs', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50`)
  return c.json({ success: true, data: rows })
})

export default route
