import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryFirst } from '../lib/db.ts'
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
