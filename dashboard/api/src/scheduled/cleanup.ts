import type { Env } from '../lib/db.ts'

/// Retention for behavioural telemetry, in days.
///
/// The ingest endpoint had no retention at all, so `analytics_events` grew
/// without bound and every row about a child stayed indefinitely. 180 days is
/// enough for year-on-year seasonality on a launch product while keeping the
/// window finite.
///
/// This is a **policy default, not a legal determination**: the number needs
/// confirmation from the child-privacy review (HUMAN-009 in the audit backlog)
/// and should move to configuration if that review sets a different figure.
const ANALYTICS_RETENTION_DAYS = 180

/// Retention for the family-event dedupe ledger, in days.
///
/// Shorter on purpose: it exists to make queue delivery idempotent, and a
/// redelivery months later is not a case worth carrying.
const PROCESSED_EVENT_RETENTION_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export async function handleScheduled(event: ScheduledEvent, env: Env) {
  if (event.cron !== '0 3 * * *') return

  // Each task is independent: one failing table must not stop the others, and a
  // failure is logged rather than swallowed so a silently growing table is
  // visible in observability.
  const tasks: Array<{ name: string; run: () => Promise<number> }> = [
    {
      name: 'processed_family_events',
      run: async () => {
        const res = await env.DB.prepare(
          `DELETE FROM processed_family_events WHERE occurred_at_ms < ?`,
        ).bind(Date.now() - PROCESSED_EVENT_RETENTION_DAYS * DAY_MS).run()
        return res.meta.changes ?? 0
      },
    },
    {
      name: 'analytics_events',
      run: async () => {
        // `created_at` is a `datetime('now')` string, so the comparison is made
        // in SQLite rather than against a JS timestamp.
        const res = await env.DB.prepare(
          `DELETE FROM analytics_events WHERE created_at < datetime('now', ?)`,
        ).bind(`-${ANALYTICS_RETENTION_DAYS} days`).run()
        return res.meta.changes ?? 0
      },
    },
  ]

  for (const task of tasks) {
    try {
      const removed = await task.run()
      console.log('cleanup', task.name, removed)
    } catch (error) {
      console.error('cleanup_failed', task.name, error)
    }
  }
}
