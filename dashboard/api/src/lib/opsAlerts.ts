/// رفع التنبيهات وإغلاقها وتسليمها (`OPS-106`).
///
/// ## العلّة
///
/// كانت `ops_alerts` جدولًا **بلا كاتب واحد** في المصدر كلّه: لا `INSERT` في أي
/// موضع، وشاشة العمليات تعرض «صفر تنبيه نشط» على الدوام. وأربعة وعشرون حدث
/// عائلة فاشلًا مرّت بلا أن يعرف أحد.
///
/// و«صفر تنبيه» في شاشة رصدٍ لا يرصد أسوأ من غياب الشاشة: يُقرأ **«لا مشاكل»**.
///
/// ## القاعدة التي يفرضها هذا الملف
///
/// التنبيه له ثلاث مراحل، وكلّها إلزامية: **يُرفَع** بأثر مُزال التكرار، و**يُسلَّم**
/// إلى قناة تصل إلى شخص، و**يُغلَق تلقائيًّا** حين تزول حالته.
///
/// الإغلاق التلقائي ليس تحسينًا: تنبيهٌ يبقى مفتوحًا بعد زوال سببه يحتاج من يغلقه
/// يدويًّا، ومن لا يجد وقتًا لذلك يتعلّم تجاهل الشاشة — فتصير مليئة بتنبيهات ميتة
/// تخفي الحيّ بينها.
///
/// ## ولماذا التسليم لا يرفع استثناءً
///
/// لأن من يستدعي هذا الملف هو مستهلك طابور أو دورة cron: فشل إرسال بريد لا يجوز
/// أن يُفشل حفظ الحدث الفاشل نفسه. فالنتيجة تُكتب في `notify_outcome` ويمضي
/// المسار — والصفّ يبقى مرئيًّا في الشاشة على كل حال.

import type { Env } from './db.ts';
import { sendOpsAlertEmail } from '../services/email.ts';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertRequest = {
  /// بصمة الحالة لا الحادثة: نفس الخلل يُنتج نفس البصمة في كل دورة.
  ///
  /// فلا تدخل فيها قيمة متغيّرة — عدد، أو وقت، أو معرّف حدث — وإلا صارت كل دورة
  /// «حالةً جديدة» وعاد الضجيج الذي أُنشئ الفهرس الفريد لمنعه.
  fingerprint: string;
  serviceId: string | null;
  severity: AlertSeverity;
  /// وصف يقرؤه إنسان مستعجل. يُخزَّن ويُرسَل كما هو.
  condition: string;
};

/// يرفع تنبيهًا إن لم يكن مفتوحًا، ويُسلّمه.
///
/// يعود `raised: false` إن كان التنبيه مفتوحًا أصلًا — وهذا هو المسار الشائع:
/// عطل مستمرّ يُنتج نداءً كل دورة ورسالة **واحدة**.
export async function raiseAlert(env: Env, request: AlertRequest): Promise<{
  raised: boolean;
  id: string | null;
  notified: 'sent' | 'unconfigured' | 'provider_error' | null;
}> {
  const id = crypto.randomUUID();

  // `INSERT OR IGNORE` مع الفهرس الفريد الجزئي: التزامن يخسر بلا خطأ، ولا حاجة
  // إلى `SELECT` قبله. و`changes === 0` تعني «مفتوح أصلًا».
  const inserted = await env.DB.prepare(`
    INSERT OR IGNORE INTO ops_alerts (id, fingerprint, service_id, severity, condition_text, status)
    VALUES (?, ?, ?, ?, ?, 'open')
  `).bind(id, request.fingerprint, request.serviceId, request.severity, request.condition).run();

  if ((inserted.meta.changes ?? 0) === 0) return { raised: false, id: null, notified: null };

  const outcome = await notify(env, request);
  await env.DB.prepare(`
    UPDATE ops_alerts
       SET notified_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE NULL END,
           notify_outcome = ?,
           updated_at = datetime('now')
     WHERE id = ?
  `).bind(outcome, outcome, id).run();

  return { raised: true, id, notified: outcome };
}

/// يغلق كل تنبيه حيّ لهذه البصمة.
///
/// يُنادى في كل دورة فحص تجد الحالة سليمة — لا عند «زوال» مرصود. الفرق مهمّ:
/// النداء غير المشروط يجعل الإغلاق **دالّةً على الواقع الحالي** لا على تذكّر
/// النظام أنه رفع تنبيهًا. ودورةٌ فاتت أو نشرٌ أعاد التشغيل لا يُخلّف تنبيهًا خالدًا.
export async function resolveAlert(env: Env, fingerprint: string): Promise<number> {
  const result = await env.DB.prepare(`
    UPDATE ops_alerts
       SET status = 'resolved', resolved_at = datetime('now'), updated_at = datetime('now')
     WHERE fingerprint = ? AND status IN ('open', 'acknowledged')
  `).bind(fingerprint).run();
  return result.meta.changes ?? 0;
}

async function notify(env: Env, request: AlertRequest) {
  const subject = `[مجرة/${request.severity}] ${request.condition}`;
  const body = [
    request.condition,
    '',
    `الخدمة: ${request.serviceId ?? 'غير محدَّدة'}`,
    `الدرجة: ${request.severity}`,
    `البصمة: ${request.fingerprint}`,
    '',
    'شاشة العمليات: /ops',
  ].join('\n');

  // البصمة هي بذرة عدم التكرار لا معرّف التنبيه: مزوّد البريد يمنع تكرار نفس
  // الحالة حتى لو أُعيد رفعها بعد إغلاق خاطئ.
  const result = await sendOpsAlertEmail(env, {
    subject,
    text: body,
    idempotencySeed: `ops-alert:${request.fingerprint}`,
  });
  return result.ok ? 'sent' as const : result.reason;
}
