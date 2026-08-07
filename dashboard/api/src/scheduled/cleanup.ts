import type { Env } from '../lib/db'

export async function handleScheduled(event: ScheduledEvent, env: Env) {
  if (event.cron === '0 3 * * *') {
    // تنظيف processed_family_events الأقدم من 30 يوم - يمنع النمو اللانهائي
    try {
      const res = await env.DB.prepare(
        `DELETE FROM processed_family_events WHERE occurred_at_ms < ?`
      ).bind(Date.now() - 30 * 24 * 60 * 60 * 1000).run()
      console.log('cleanup_processed_events', res.meta.changes ?? 0)
    } catch (e) {
      console.error('cleanup_failed', e)
    }
  }
}
