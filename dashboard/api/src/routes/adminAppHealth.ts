import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll } from '../lib/db.ts'
import { requireAdmin } from '../lib/adminAuth.ts'

/**
 * App releases and diagnostics from real data (`ADM-304`).
 *
 * Both dashboard pages used to render invented numbers ("2.2% of clients",
 * release 2.5.0, resolver profiles) with no API call at all. This answers the
 * two questions they pretended to, from what the app actually reports:
 *
 * - **Which versions are in use?** Families active in the last 30 days, by the
 *   `app_version` recorded with their analytics events (stamped from the
 *   `X-App-Version` header since ADM-304; older events have none).
 * - **What is failing?** `playback_error` and download failure events in the
 *   last 7 days, by reason and by day.
 *
 * The forced-update settings are the existing `remote_config` keys, edited
 * through `PUT /admin/remote-config/:key`, so there is one place for them.
 */

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()
route.use('/app-health', requireAdmin)
route.use('/app-health/*', requireAdmin)

route.get('/app-health', async (c) => {
  const db = c.env.DB
  const [versions, errors, daily, config, volume, crashGroups, crashDaily] = await Promise.all([
    queryAll<{ version: string | null; families: number; events: number; last_seen: string }>(db, `
      SELECT json_extract(params_json, '$.app_version') AS version,
             COUNT(DISTINCT parent_id) AS families,
             COUNT(*) AS events,
             MAX(created_at) AS last_seen
        FROM analytics_events
       WHERE created_at >= datetime('now', '-30 days')
       GROUP BY version
       ORDER BY families DESC, events DESC
       LIMIT 50
    `),
    queryAll<{ event_name: string; reason: string | null; count: number; families: number }>(db, `
      SELECT event_name,
             COALESCE(json_extract(params_json, '$.reason'), json_extract(params_json, '$.error')) AS reason,
             COUNT(*) AS count,
             COUNT(DISTINCT parent_id) AS families
        FROM analytics_events
       WHERE created_at >= datetime('now', '-7 days')
         AND event_name IN ('playback_error', 'downloadFailed')
       GROUP BY event_name, reason
       ORDER BY count DESC
       LIMIT 50
    `),
    queryAll<{ day: string; errors: number; starts: number }>(db, `
      SELECT substr(created_at, 1, 10) AS day,
             SUM(CASE WHEN event_name = 'playback_error' THEN 1 ELSE 0 END) AS errors,
             SUM(CASE WHEN event_name IN ('content_started', 'video_started') THEN 1 ELSE 0 END) AS starts
        FROM analytics_events
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY day
       ORDER BY day
    `),
    queryAll<{ key: string; value_json: string; updated_at: string | null }>(db, `
      SELECT key, value_json, updated_at FROM remote_config
       WHERE key IN ('min_app_version', 'forced_update_url', 'maintenance_message')
    `),
    queryAll<{ events: number; families: number }>(db, `
      SELECT COUNT(*) AS events, COUNT(DISTINCT parent_id) AS families
        FROM analytics_events WHERE created_at >= datetime('now', '-7 days')
    `),
    // OPS-202: crash groups (same type + top frames) over the last 7 days.
    queryAll<{
      fingerprint: string; error_type: string; frames_json: string; context: string | null
      reports: number; fatal: number; families: number; first_seen: string; last_seen: string
      versions: string | null
    }>(db, `
      SELECT fingerprint,
             MAX(error_type) AS error_type,
             MAX(frames_json) AS frames_json,
             MAX(context) AS context,
             COUNT(*) AS reports,
             SUM(fatal) AS fatal,
             COUNT(DISTINCT parent_id) AS families,
             MIN(occurred_at) AS first_seen,
             MAX(occurred_at) AS last_seen,
             GROUP_CONCAT(DISTINCT app_version) AS versions
        FROM app_crash_reports
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY fingerprint
       ORDER BY reports DESC
       LIMIT 50
    `).catch(() => []),
    queryAll<{ day: string; reports: number; fatal: number }>(db, `
      SELECT substr(occurred_at, 1, 10) AS day, COUNT(*) AS reports, SUM(fatal) AS fatal
        FROM app_crash_reports
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY day ORDER BY day
    `).catch(() => []),
  ])

  const settings: Record<string, unknown> = {}
  for (const row of config) {
    try { settings[row.key] = JSON.parse(row.value_json) } catch { settings[row.key] = null }
  }

  return c.json({
    success: true,
    data: {
      versions: versions.map((row) => ({ ...row, version: row.version ?? null })),
      errors,
      daily,
      settings: {
        min_app_version: typeof settings.min_app_version === 'string' ? settings.min_app_version : null,
        forced_update_url: typeof settings.forced_update_url === 'string' ? settings.forced_update_url : null,
        maintenance_message: typeof settings.maintenance_message === 'string' ? settings.maintenance_message : null,
      },
      volume_7d: volume[0] ?? { events: 0, families: 0 },
      crashes: {
        groups: crashGroups.map(({ frames_json, versions, ...row }) => {
          let frames: string[] = []
          try { frames = JSON.parse(frames_json) as string[] } catch { /* shaped at ingest */ }
          return { ...row, frames, versions: versions ? versions.split(',') : [] }
        }),
        daily: crashDaily,
      },
    },
  })
})

export default route
