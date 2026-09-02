import type { Env } from '../lib/db.ts'

/// المدّة الافتراضية للاحتفاظ بالقياسات السلوكية، بالأيام.
///
/// كان هذا الرقم **ثابتًا في الكود**، والتعليق فوقه يقول بنفسه إنه ينتظر مراجعة
/// خصوصية الطفل و«ينبغي أن ينتقل إلى الإعداد إن قرّرت المراجعة رقمًا آخر»
/// (`PRIV-101`). صار افتراضًا يُجاوزه `ANALYTICS_RETENTION_DAYS` في الإعداد، فلا
/// يحتاج قرارُ المراجعة نشرَ كودٍ.
///
/// **والرقم لم يُغيَّر**: 180 هو ما ينفّذه النظام اليوم، وتغييره قرارٌ قانوني
/// (COPPA / GDPR-K) لا هندسي — `HUMAN-106`. نقلُه إلى الإعداد يجعل القرار
/// **قابلًا للتنفيذ**، ولا ينفّذه.
const DEFAULT_ANALYTICS_RETENTION_DAYS = 180

/// حدّا الصحّة للقيمة المُعدَّة. ليسا سياسة بل حرسٌ على قيمةٍ مشوّهة: صفرٌ أو
/// سالبٌ يحذف كل شيء في كل تشغيل، و«عشر سنوات» تُبطل وجود النافذة أصلًا.
const MIN_RETENTION_DAYS = 1
const MAX_RETENTION_DAYS = 3650

/// Retention for the family-event dedupe ledger, in days.
///
/// Shorter on purpose: it exists to make queue delivery idempotent, and a
/// redelivery months later is not a case worth carrying.
///
/// لا يُعدّ من الإعداد: ليس بيانات سلوك طفل بل سجلّ منع تكرار تسليم، فلا يقع
/// تحت قرار المراجعة. وإعدادُ ما لا يُسأل عنه ضجيج.
const PROCESSED_EVENT_RETENTION_DAYS = 30

/// يقرأ مدّة الاحتفاظ من الإعداد، ويُبلّغ عن قيمةٍ مرفوضة بدل أن يصمت.
///
/// عند قيمةٍ مشوّهة يُستعمل الافتراض **ولا يُلغى الحذف**: تعطيلُ الحذف على خطأ
/// إعدادٍ يحفظ بيانات الأطفال إلى الأبد — وهو أسوأ إخفاق ممكن هنا. والخطأ
/// يُسجَّل بمفتاح قابل للبحث حتى لا يمرّ إعدادٌ لا أثر له.
export function analyticsRetentionDays(env: Env): number {
  const raw = env.ANALYTICS_RETENTION_DAYS
  if (raw === undefined || raw === null || raw.trim() === '') {
    return DEFAULT_ANALYTICS_RETENTION_DAYS
  }
  const parsed = Number(raw)
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_RETENTION_DAYS ||
    parsed > MAX_RETENTION_DAYS
  ) {
    console.error(
      'cleanup_retention_invalid',
      raw,
      `expected an integer between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}; using ${DEFAULT_ANALYTICS_RETENTION_DAYS}`,
    )
    return DEFAULT_ANALYTICS_RETENTION_DAYS
  }
  return parsed
}

const DAY_MS = 24 * 60 * 60 * 1000

/// تعبير الـcron الذي يملكه هذا الملف.
///
/// مُصدَّر لأن `index.ts` هو من يوزّع الآن بين مهمّتين مجدولتين (`OPS-106`):
/// حرسٌ داخل كل ملف بتعبيره الحرفي كان يعني أن إضافة جدول ثالث تحتاج تعديل كل
/// ملف — وأن نسيان واحد يُنتج مهمّة لا تعمل **بلا أي خطأ**.
export const CLEANUP_CRON = '0 3 * * *'

export async function handleScheduled(event: ScheduledEvent, env: Env) {
  if (event.cron !== CLEANUP_CRON) return

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
        ).bind(`-${analyticsRetentionDays(env)} days`).run()
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
