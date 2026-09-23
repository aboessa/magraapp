import type { Env } from './db.ts';
import { queryFirst } from './db.ts';

/**
 * سياسة وقت الشاشة لطفل واحد، كما ضبطها ولي الأمر.
 *
 * ## العلّة التي يغلقها هذا الملف
 *
 * `routes/childSettings.ts` كان يكتب `daily_minutes` و`max_session_minutes`
 * و`bedtime_start/end` بتحقق دقيق من المدى والصيغة، ثم **لا يقرؤها أي مسار
 * تشغيل**. البحث عن `child_settings` في كل `src/` لم يكن يعطي نتيجة خارج ذلك
 * الملف نفسه، وجدول التتبّع اليومي `child_screen_time_daily` كان بلا كاتب واحد.
 *
 * النتيجة أن شاشة الإعدادات كانت تمنح ولي الأمر إحساسًا بالتحكّم لا يقابله أي
 * فرض: الطفل يشاهد بلا حدّ يومي، وبلا حدّ للجلسة، وفي وقت النوم.
 *
 * ## أين يُفرض وأين يُقرأ
 *
 * القراءة هنا (Worker، من D1) والفرض في `FamilyState`. السبب أن الفرض يحتاج
 * قراءة-تعديل-كتابة ذرية على وقت مُستهلَك، والـDurable Object هو الموضع الوحيد
 * الذي يسلسل ذلك لكل أسرة. ولا يُقرأ أي حدّ من جسم الطلب: عميل معدَّل يكتب
 * `daily_minutes: 999` وينتهي الأمر.
 */
export type ScreenTimePolicy = {
  /// الحدّ اليومي بالدقائق. `null` تعني لا حدّ.
  dailyMinutes: number | null;
  /// حدّ الجلسة الواحدة بالدقائق. `null` تعني لا حدّ.
  maxSessionMinutes: number | null;
  /// هل الوقت الآن داخل نافذة النوم في توقيت الأسرة.
  bedtimeActive: boolean;
  /// تاريخ اليوم في توقيت الأسرة (`YYYY-MM-DD`)، مفتاح الاحتساب اليومي.
  localDate: string;
  /// توقيت الأسرة كما هو مسجَّل، للتشخيص والرسائل.
  timezone: string;
  /// نافذة النوم كما ضبطها ولي الأمر، للرسائل. `null` حين لا نافذة.
  bedtime: { start: string; end: string } | null;
};

const DEFAULT_TIMEZONE = 'Africa/Cairo';

/// أجزاء الوقت المحلي لمنطقة زمنية بالاسم.
///
/// `Intl.DateTimeFormat` متاح في وقت تشغيل Workers، وهو الطريق الصحيح: حساب
/// الإزاحة يدويًّا يخطئ في التوقيت الصيفي، ونافذة نوم تخطئ بساعة في ليلة التحويل
/// إمّا تمنع الطفل قبل موعده أو تسمح له بعده.
function localParts(now: Date, timezone: string): { date: string; minutes: number } {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    // منطقة زمنية غير معروفة (بيانات قديمة أو خطأ إدخال): يُستخدم الافتراضي بدل
    // الفشل، لأن رفض التشغيل بسبب حقل إعدادات تالف عقوبة على الطفل لا حماية له.
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }
  const parts = formatter.formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  const hour = Number(pick('hour')) % 24;
  const minute = Number(pick('minute'));
  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    minutes: hour * 60 + minute,
  };
}

function parseHhMm(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * هل اللحظة الحالية داخل نافذة النوم.
 *
 * النافذة تعبر منتصف الليل في الاستخدام الطبيعي (`20:00` → `07:00`)، فالمقارنة
 * ليست `start <= now < end` دائمًا: عندما تكون البداية بعد النهاية تُقسم النافذة
 * إلى ما بعد البداية أو ما قبل النهاية. ونافذة طرفاها متساويان تُعتبر معطَّلة، لا
 * حجبًا لأربع وعشرين ساعة — الأخير سيقفل التطبيق كليًّا على إعداد يبدو بريئًا.
 */
export function bedtimeCovers(nowMinutes: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}

type SettingsRow = {
  daily_minutes: number | null;
  max_session_minutes: number | null;
  bedtime_start: string | null;
  bedtime_end: string | null;
};

/**
 * يقرأ سياسة الطفل من D1 ويحسب الأجزاء الزمنية في توقيت الأسرة.
 *
 * ## الغياب يعني «لم يفعّله ولي الأمر» — قرار المالك 2026-09-23 (`DECIDE-108`)
 *
 * «لا وقت نوم وكدا، لازم ولي الأمر يفعّل الموضوع ده.» فضوابط الوقت اختيارية
 * يفعّلها ولي الأمر، ولا تُفرَض بالافتراض.
 *
 * وكانت هذه الدالّة تستبدل **30 دقيقة** مكان الغياب، بحجّة مطابقة ما تعرضه
 * الشاشة. والحجّة كانت متماسكة داخليًّا وخاطئة في نتيجتها: `GET /child-settings`
 * يُدرج صفًّا بالافتراضات لمجرّد فتح الشاشة، و`PUT` لم يكن يقبل `null`،
 * و`Slider` يبدأ من 5 — فكان ولي الأمر يُمنَح حدًّا لم يطلبه ثم **لا يملك
 * إلغاءه**، ويُفرَض على الفيديو فعلًا في `startPlayback`/`heartbeatPlayback`.
 *
 * الآن: `daily_minutes IS NULL` (أو صفّ غائب) ⇒ `dailyMinutes = null` ⇒ لا فحص.
 * و`0093_daily_limit_opt_in.sql` أزال `NOT NULL` و`DEFAULT 30` فصار الغياب
 * قابلًا للتمثيل في القاعدة لا في هذه الدالّة وحدها.
 */
export async function loadScreenTimePolicy(
  env: Env,
  parentId: string,
  childId: string,
  now: Date = new Date(),
): Promise<ScreenTimePolicy> {
  const [settings, parent] = await Promise.all([
    queryFirst<SettingsRow>(
      env.DB,
      'SELECT daily_minutes, max_session_minutes, bedtime_start, bedtime_end FROM child_settings WHERE child_id = ?',
      [childId],
    ).catch(() => null),
    queryFirst<{ timezone: string | null }>(
      env.DB,
      'SELECT timezone FROM parents WHERE id = ?',
      [parentId],
    ).catch(() => null),
  ]);

  const timezone = parent?.timezone?.trim() || DEFAULT_TIMEZONE;
  const { date, minutes } = localParts(now, timezone);

  // نفس شكل `maxSessionMinutes` أدناه: رقمٌ موجب حدٌّ، وكل ما عداه «غير مفعَّل».
  const dailyRaw = settings?.daily_minutes;
  const dailyMinutes = typeof dailyRaw === 'number' && dailyRaw > 0 ? dailyRaw : null;

  const sessionRaw = settings?.max_session_minutes;
  const maxSessionMinutes = typeof sessionRaw === 'number' && sessionRaw > 0 ? sessionRaw : null;

  const start = parseHhMm(settings?.bedtime_start);
  const end = parseHhMm(settings?.bedtime_end);
  const hasWindow = start !== null && end !== null;

  return {
    dailyMinutes,
    maxSessionMinutes,
    bedtimeActive: hasWindow ? bedtimeCovers(minutes, start, end) : false,
    localDate: date,
    timezone,
    bedtime: hasWindow
      ? { start: settings!.bedtime_start!.trim(), end: settings!.bedtime_end!.trim() }
      : null,
  };
}

/// الشكل الذي يُمرَّر إلى `FamilyState`. الحدود تُرسَل بالثواني لأن الاحتساب
/// هناك بالثواني، فلا يبقى تحويل مكرّر في موضعين.
export function screenTimePayload(policy: ScreenTimePolicy) {
  return {
    daily_limit_seconds: policy.dailyMinutes === null ? null : policy.dailyMinutes * 60,
    session_limit_seconds: policy.maxSessionMinutes === null ? null : policy.maxSessionMinutes * 60,
    bedtime_active: policy.bedtimeActive,
    local_date: policy.localDate,
  };
}

/// رسالة رفض موحّدة، برمز يقرؤه العميل ليعرض الشاشة المناسبة بدل خطأ عام.
///
/// الرمز جزء من العقد: `bedtime` تعرض «وقت النوم»، و`daily_limit` تعرض «انتهى
/// وقتك اليوم»، وكلتاهما مختلفة عن انتهاء الاشتراك أو انقطاع الشبكة.
export function screenTimeRefusal(
  reason: 'bedtime' | 'daily_limit' | 'session_limit',
  policy: ScreenTimePolicy,
) {
  const messages: Record<typeof reason, string> = {
    bedtime: 'وقت النوم الآن. التشغيل متاح بعد انتهاء وقت النوم.',
    daily_limit: 'انتهى وقت المشاهدة المسموح لهذا اليوم.',
    session_limit: 'انتهت مدة هذه الجلسة. خُذ راحة ثم ابدأ جلسة جديدة.',
  };
  return {
    success: false as const,
    code: `screen_time_${reason}`,
    error: messages[reason],
    data: {
      reason,
      timezone: policy.timezone,
      local_date: policy.localDate,
      daily_minutes: policy.dailyMinutes,
      max_session_minutes: policy.maxSessionMinutes,
      bedtime: policy.bedtime,
    },
  };
}
