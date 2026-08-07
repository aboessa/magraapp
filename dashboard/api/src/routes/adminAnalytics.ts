import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { queryAll, queryFirst } from '../lib/db'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

route.get('/analytics/overview', async (c) => {
  const totalPlays = await queryFirst<{ c: number }>(c.env.DB, `SELECT COUNT(*) as c FROM processed_family_events WHERE event_type IN ('progress.updated','content.completed','playback.started')`)
  const byTrack = await queryAll(c.env.DB, `SELECT track_id, COUNT(*) as count FROM series_tracks JOIN series s ON s.id = series_tracks.series_id WHERE s.status='published' GROUP BY track_id`)
  const mastery = await queryAll(c.env.DB, `SELECT level, COUNT(*) as count FROM mastery GROUP BY level`)
  const recent = await queryAll(c.env.DB, `SELECT event_id, event_type, parent_id, occurred_at_ms FROM processed_family_events ORDER BY occurred_at_ms DESC LIMIT 20`)
  return c.json({ success: true, data: { total_plays: totalPlays?.c ?? 0, by_track: byTrack, mastery, recent_events: recent } })
})

route.get('/analytics/children/:childId', async (c) => {
  const childId = c.req.param('childId')
  const progress = await queryAll(c.env.DB, `SELECT content_type, content_id, position_ms, duration_ms, completed, updated_at FROM content_progress WHERE child_id = ? ORDER BY updated_at DESC LIMIT 20`, [childId])
  // Fallback to FamilyState if not in projection (dev)
  return c.json({ success: true, data: { child_id: childId, progress } })
})

export default route
