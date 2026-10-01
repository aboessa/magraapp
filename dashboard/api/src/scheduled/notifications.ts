import type { Env } from '../lib/db.ts';
import { queryAll } from '../lib/db.ts';
import { notifyParent, pushIsConfigured } from '../lib/push.ts';

/// APP-203: the daily family notifications, at 16:00 UTC (18:00–19:00 Cairo),
/// never at night.
///
/// - «حلقة جديدة»: episodes published in the last 24 h, once per family per day.
/// - «تقرير الأسبوع» on Fridays: the family's watch minutes for the last 7 days
///   (`child_watch_time_daily`), linking to the parent area where the full
///   report is. Families that watched nothing get no report.
export const NOTIFY_CRON = '0 16 * * *';

export async function runFamilyNotifications(env: Env, now = new Date(), fetcher: typeof fetch = fetch) {
  if (!pushIsConfigured(env)) return { families: 0, sent: 0 };
  const day = now.toISOString().slice(0, 10);
  const families = await queryAll<{ parent_id: string }>(env.DB, 'SELECT DISTINCT parent_id FROM push_tokens');
  let sent = 0;

  const since = new Date(now.getTime() - 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
  const fresh = await queryAll<{ title: string; series_title: string | null; series_id: string }>(env.DB, `
    SELECT e.title_ar AS title, s.title_ar AS series_title, s.id AS series_id
      FROM episodes e JOIN series s ON s.id = e.series_id
     WHERE e.status = 'published' AND e.is_published = 1 AND s.status = 'published'
       AND e.published_at >= ?
     ORDER BY e.published_at DESC LIMIT 5
  `, [since]).catch(() => []);
  if (fresh.length) {
    const first = fresh[0];
    const message = {
      title: fresh.length === 1 ? 'حلقة جديدة نزلت على مجرة' : `${fresh.length} حلقات جديدة نزلت على مجرة`,
      body: first.series_title ? `«${first.title}» من ${first.series_title}` : `«${first.title}»`,
      route: `/series/${first.series_id}`,
    };
    for (const { parent_id } of families) {
      sent += await notifyParent(env, parent_id, 'new_episodes', `new_episodes:${day}`, message, fetcher);
    }
  }

  if (now.getUTCDay() === 5) {
    const weekStart = new Date(now.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
    const minutes = new Map((await queryAll<{ parent_id: string; seconds: number }>(env.DB, `
      SELECT parent_id, SUM(watched_seconds) AS seconds FROM child_watch_time_daily
       WHERE activity_date >= ? GROUP BY parent_id
    `, [weekStart]).catch(() => [])).map((row) => [row.parent_id, Math.round(Number(row.seconds) / 60)]));
    for (const { parent_id } of families) {
      const total = minutes.get(parent_id) ?? 0;
      if (total <= 0) continue;
      sent += await notifyParent(env, parent_id, 'weekly_report', `weekly_report:${day}`, {
        title: 'تقرير الأسبوع جاهز',
        body: `ولادك اتفرجوا ${total} دقيقة الأسبوع ده. شوف اتعلموا إيه.`,
        route: '/parent',
      }, fetcher);
    }
  }

  // Manual payments have no auto-renewal, so the parent is reminded 3 days and
  // 1 day before the last paid period ends (a renewal already approved hides it).
  const nowMs = now.getTime();
  const expiring = await queryAll<{ id: string; parent_id: string; plan: string; expires_at_ms: number }>(env.DB, `
    SELECT r.id, r.parent_id, r.plan, r.expires_at_ms FROM manual_payment_requests r
     WHERE r.status = 'approved' AND r.expires_at_ms > ? AND r.expires_at_ms <= ?
       AND NOT EXISTS (SELECT 1 FROM manual_payment_requests n
                        WHERE n.parent_id = r.parent_id AND n.status = 'approved' AND n.expires_at_ms > r.expires_at_ms)
  `, [nowMs, nowMs + 3 * 86_400_000]).catch(() => []);
  for (const row of expiring) {
    const daysLeft = Math.max(1, Math.ceil((Number(row.expires_at_ms) - nowMs) / 86_400_000));
    const stage = daysLeft <= 1 ? 1 : 3;
    sent += await notifyParent(env, row.parent_id, 'billing', `manual_expiry:${row.id}:${stage}`, {
      title: stage === 1 ? 'اشتراكك بيخلص بكرة' : 'اشتراكك قرّب يخلص',
      body: stage === 1
        ? 'جدّد من صفحة العضوية عشان الولاد ما يوقفوش.'
        : `فاضل ${daysLeft} أيام على اشتراكك. تقدر تجدّد دلوقتي ومش هتخسر ولا يوم.`,
      route: '/membership',
    }, fetcher);
  }

  await env.DB.prepare(`DELETE FROM push_log WHERE created_at < datetime('now', '-30 days')`).run().catch(() => undefined);
  return { families: families.length, sent };
}
