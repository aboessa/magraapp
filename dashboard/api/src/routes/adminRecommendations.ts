import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts'
import { auditStatement, actorId } from '../lib/auditLog.ts'

type AppEnv = { Bindings: Env }

const route = new Hono<AppEnv>()

/// Editorial recommendation pinning.
///
/// This capability previously lived on the public router as
/// `POST /api/v1/recommendations/admin` with no authentication whatsoever: the
/// only authorization was a comment reading "reuse requireAdmin via parentAuth?
/// simple check". Anything written here is served to children's home rails by
/// `GET /api/v1/recommendations`, so an anonymous caller could pin arbitrary
/// content into every child's feed.
///
/// It is mounted in an `admin*` module on purpose, not merely guarded in place:
/// the route-guard sweep asserts that every mutating handler in an admin router
/// carries a named permission, so keeping this on the public router would leave
/// it outside the one test designed to catch exactly this defect.
///
/// Mounted directly in `index.ts`, so it must guard itself — Hono middleware
/// belongs to the router instance it is registered on and is not inherited by a
/// second router sharing the same prefix.
route.use('*', requireAdmin)

const MAX_PRIORITY = 1000

// LIST — editorial recommendations with series join for display
route.get('/recommendations', async (c) => {
  const rows = await queryAll<any>(
    c.env.DB,
    `SELECT hr.id, hr.child_id, hr.series_id, hr.reason, hr.priority, hr.is_pinned, hr.is_hidden, hr.created_at,
            s.title_ar as series_title, s.title_en as series_title_en, s.planet_id, p.name_ar as planet_name
     FROM home_recommendations hr
     LEFT JOIN series s ON s.id = hr.series_id
     LEFT JOIN planets p ON p.id = s.planet_id
     ORDER BY hr.is_pinned DESC, hr.priority DESC, hr.created_at DESC
     LIMIT 100`
  )
  return c.json({ success: true, data: rows })
})

route.delete('/recommendations/:id', requirePermission('publish'), async (c) => {
  const id = c.req.param('id') as string
  const existing = await queryFirst<{ id: string }>(c.env.DB, `SELECT id FROM home_recommendations WHERE id=?`, [id])
  if (!existing) return c.json({ success: false, error: 'Not found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM home_recommendations WHERE id=?`).bind(id),
    auditStatement(c.env.DB, actorId(c), 'delete', 'home_recommendation', id, {}),
  ])
  return c.json({ success: true, data: { id, deleted: true } })
})

route.patch('/recommendations/:id', requirePermission('publish'), async (c) => {
  const id = c.req.param('id') as string
  const body = await c.req.json().catch(() => null) as any
  if (!body) return c.json({ success: false, error: 'JSON body required' }, 400)
  const existing = await queryFirst<any>(c.env.DB, `SELECT * FROM home_recommendations WHERE id=?`, [id])
  if (!existing) return c.json({ success: false, error: 'Not found' }, 404)

  const updates: string[] = []
  const params: any[] = []

  if (body.priority !== undefined) {
    const p = Number(body.priority)
    if (!Number.isInteger(p) || p < 0 || p > MAX_PRIORITY) return c.json({ success: false, error: `priority 0-${MAX_PRIORITY}` }, 400)
    updates.push('priority=?'); params.push(p)
  }
  if (body.is_pinned !== undefined) {
    if (typeof body.is_pinned !== 'boolean') return c.json({ success: false, error: 'is_pinned bool' }, 400)
    updates.push('is_pinned=?'); params.push(body.is_pinned ? 1 : 0)
  }
  if (body.is_hidden !== undefined) {
    if (typeof body.is_hidden !== 'boolean') return c.json({ success: false, error: 'is_hidden bool' }, 400)
    updates.push('is_hidden=?'); params.push(body.is_hidden ? 1 : 0)
  }
  if (body.reason !== undefined) {
    if (typeof body.reason !== 'string' || body.reason.trim().length > 120) return c.json({ success: false, error: 'reason 1-120 chars' }, 400)
    updates.push('reason=?'); params.push(body.reason.trim() || 'editorial')
  }
  if (!updates.length) return c.json({ success: false, error: 'No fields' }, 400)

  params.push(id)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE home_recommendations SET ${updates.join(', ')} WHERE id=?`).bind(...params),
    auditStatement(c.env.DB, actorId(c), 'update', 'home_recommendation', id, body),
  ])
  return c.json({ success: true, data: { id } })
})

/// Pinning or hiding a series for a child is a publishing act: it changes what a
/// child is offered, immediately, with no review step and no schedule.
route.post('/recommendations', requirePermission('publish'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON body is required' }, 400)

  const seriesId = typeof body.series_id === 'string' ? body.series_id.trim() : ''
  if (!seriesId) return c.json({ success: false, error: 'series_id required' }, 400)

  // A recommendation pointing at a missing or archived series renders as an
  // empty card in the child's rail, so the reference is validated here rather
  // than discovered at read time.
  const series = await queryFirst<{ id: string }>(
    c.env.DB,
    `SELECT id FROM series WHERE id = ? AND status <> 'archived'`,
    [seriesId],
  )
  if (!series) return c.json({ success: false, error: 'series_id does not match an active series' }, 400)

  const childIdValue = body.child_id
  if (childIdValue !== undefined && childIdValue !== null && typeof childIdValue !== 'string') {
    return c.json({ success: false, error: 'child_id must be a string or null' }, 400)
  }
  const childId = typeof childIdValue === 'string' && childIdValue.trim() ? childIdValue.trim() : null

  const reasonValue = body.reason
  if (reasonValue !== undefined && typeof reasonValue !== 'string') {
    return c.json({ success: false, error: 'reason must be a string' }, 400)
  }
  const reason = typeof reasonValue === 'string' && reasonValue.trim() ? reasonValue.trim() : 'editorial'
  if (reason.length > 120) return c.json({ success: false, error: 'reason is too long' }, 400)

  const priorityValue = body.priority ?? 0
  const priority = Number(priorityValue)
  if (!Number.isInteger(priority) || priority < 0 || priority > MAX_PRIORITY) {
    return c.json({ success: false, error: `priority must be an integer between 0 and ${MAX_PRIORITY}` }, 400)
  }

  if (body.is_pinned !== undefined && typeof body.is_pinned !== 'boolean') {
    return c.json({ success: false, error: 'is_pinned must be a boolean' }, 400)
  }
  const isPinned = body.is_pinned === true

  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO home_recommendations (id, child_id, series_id, reason, priority, is_pinned)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, childId, seriesId, reason, priority, isPinned ? 1 : 0),
    auditStatement(c.env.DB, actorId(c), 'create', 'home_recommendation', id, {
      series_id: seriesId,
      child_id: childId,
      priority,
      is_pinned: isPinned,
    }),
  ])

  return c.json({ success: true, data: { id } }, 201)
})

export default route
