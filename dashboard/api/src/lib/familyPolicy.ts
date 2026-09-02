export type Plan = 'free' | 'family' | 'family_plus';
export type AgeTrack = 'preschool' | 'kids' | 'junior';

/// إصدار سياسة الحدود (`API-102`).
///
/// ## لماذا الكود هو المصدر الوحيد
///
/// كانت الأرقام مكتوبة هنا **وفي** جدول `subscription_plan_limits` (المهاجرة
/// 0006). والمفروض فعلًا هو هذا الملف؛ الجدول لم يقرأه سطرٌ واحد في المصدر كلّه
/// — فتغييره لا يغيّر شيئًا. وهو أخطر أنواع الجداول: يبدو حيًّا، ولم يُدرَج في
/// قائمة الجداول الميتة في 0010، فأي عملية تسويق تعدّل أرقامه وتظنّ أنها فعلت.
///
/// وحُسم الأمر لصالح الكود لا الجدول، وهذا قرار يستحقّ سببه:
///
/// **موضع الفرض هو `FamilyState`**، وهو كائن دائم يفرض الحدّ بعدٍّ-ثم-إدراج
/// مُسلسَل. قراءة الحدّ من D1 داخل ذلك المسار تُدخل **فشلًا شبكيًّا في اللحظة
/// التي يجب أن تكون قاطعة**: انقطاع D1 يصير إمّا فتحًا للباب (كارثة) أو منعًا
/// لأسرة تدفع (عطل). والحدّ في الكود لا يفشل.
///
/// و«تغيير حدّ بلا نشر» ليس حاجةً قائمة: الحدود قرار تسعير مرتبط بـ`API-104`
/// الموقوف على قرار مالك، وكل تغيير فيها يستحقّ مراجعةً واختبارًا — لا صفًّا
/// يُعدَّل في قاعدة بلا أثر.
///
/// ## ولماذا رقم إصدار
///
/// حتى يكون كل رفض حدٍّ **قابلًا للتفسير بعد شهر**: «رُفض على سياسة 2» جواب،
/// و«رُفض» ليس جوابًا. ويُسجَّل مع قرارات الحدّ في سجلّ أودت الأسرة.
///
/// **يُرفَع مع كل تغيير في `PLAN_LIMITS`.** واختبار في `architecture.test.mjs`
/// يثبّت بصمة الأرقام، فتغييرها بلا رفع الإصدار يُفشل الجولة — لأن رقمًا لا
/// يتغيّر مع ما يوصفه أسوأ من غيابه.
export const PLAN_POLICY_VERSION = 2;

export const PLAN_LIMITS: Record<Plan, {
  children: number;
  devices: number;
  concurrentStreams: number;
  downloadDevices: number;
  /// أقصى عدد عناصر محفوظة للاستخدام دون إنترنت في وقت واحد.
  ///
  /// المعيار 3 في `تشفير المحتوي.md` §26 يطلب «ملفات 1/4/4» مفروضة خادميًّا
  /// وذريًّا. كان الحدّ غير موجود أصلًا: العميل يقرّر بنفسه ماذا ينزّل وكم،
  /// والخادم لا يعرف أن تنزيلًا حدث. `ENC-001` يفرضه في `FamilyState` لأنه
  /// عدّ-ثم-إدراج على حالة مشتركة، وهذا الكائن هو الموضع الوحيد المُسلسَل لكل
  /// أسرة.
  offlineItems: number;
}> = {
  free: { children: 1, devices: 1, concurrentStreams: 1, downloadDevices: 0, offlineItems: 1 },
  family: { children: 4, devices: 4, concurrentStreams: 2, downloadDevices: 2, offlineItems: 4 },
  family_plus: { children: 4, devices: 8, concurrentStreams: 4, downloadDevices: 4, offlineItems: 4 },
};

/// بصمة الأرقام المُعلَنة.
///
/// نصٌّ حتميّ يُبنى من `PLAN_LIMITS` نفسها، ويُقارَن في الاختبار بقيمة مثبَّتة.
/// وظيفته الوحيدة أن يجعل **نسيان رفع `PLAN_POLICY_VERSION` مستحيلًا** بلا
/// جولة حمراء.
export function planLimitsFingerprint(): string {
  return (Object.keys(PLAN_LIMITS) as Plan[])
    .sort()
    .map((plan) => {
      const limits = PLAN_LIMITS[plan];
      const fields = (Object.keys(limits) as Array<keyof typeof limits>).sort();
      return `${plan}:${fields.map((field) => `${field}=${limits[field]}`).join(',')}`;
    })
    .join('|');
}

const PLAN_RANK: Record<Plan, number> = { free: 0, family: 1, family_plus: 2 };

export function isPlan(value: unknown): value is Plan {
  return value === 'free' || value === 'family' || value === 'family_plus';
}

export function planAllows(actual: Plan, required: Plan) {
  return PLAN_RANK[actual] >= PLAN_RANK[required];
}

export function deriveAgeTrack(birthMonth: number, birthYear: number, now = new Date()): AgeTrack | null {
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) return null;
  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > now.getUTCFullYear()) return null;
  const currentMonth = now.getUTCMonth() + 1;
  const age = now.getUTCFullYear() - birthYear - (currentMonth < birthMonth ? 1 : 0);
  if (age >= 3 && age <= 5) return 'preschool';
  if (age >= 6 && age <= 8) return 'kids';
  if (age >= 9 && age <= 12) return 'junior';
  return null;
}

export function normalizeTracks(value: unknown): AgeTrack[] | null {
  if (!Array.isArray(value)) return null;
  const tracks = [...new Set(value)];
  if (!tracks.length || tracks.some((track) => track !== 'preschool' && track !== 'kids' && track !== 'junior')) return null;
  return tracks as AgeTrack[];
}

export function boundedInteger(value: unknown, minimum: number, maximum: number): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}
