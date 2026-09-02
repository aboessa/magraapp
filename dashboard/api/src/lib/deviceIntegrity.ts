/// سياسة سلامة الجهاز (`SEC-107`).
///
/// ## ما هذا الملف
///
/// `تشفير المحتوي.md:22` يطلب مؤشرات Root/Jailbreak/Debugger/Emulator/Hooking
/// «مع سياسة تخفيف». هذا موضع **السياسة** وحدها: الرصد في التطبيق، والقرار هنا.
///
/// ## لماذا القرار هنا لا في التطبيق
///
/// لأن تغيير عتبة أو ردّ فعل بلا تحديث تطبيق ممكن هنا وحده. ولأن جهازًا مكسورًا
/// هو بالضبط الجهاز الذي لا يُؤتمن على تطبيق سياسة على نفسه.
///
/// ## ولماذا لا تُحجب هذه الأجهزة
///
/// الإشارات كلها **إرشادية**، ومصدرها جهاز يستطيع الكذب. وكشف Root إيجابياته
/// الخاطئة كثيرة: هاتف مطوّر، جهاز مخصَّص، مضاهٍ يستخدمه فريقنا. فالحجب يعني
/// أسرة تدفع ولا تشاهد بسبب استدلال.
///
/// والسياسة المطبَّقة: **المشاهدة المتّصلة لا تُمسّ أبدًا** — لا فحص سلامة في
/// مسار قدرات الوسائط أصلًا — ويُقصَّر عمر ترخيص الاستخدام دون إنترنت وحده،
/// لأنه الشيء الوحيد الذي يعطي الجهاز سلطة أيامًا بلا رجوع إلينا.
/// أي: على جهاز عالي الخطورة يظلّ كل شيء يعمل، ويُسأل الخادم أكثر.

/// قائمة الإشارات المغلقة.
///
/// مغلقة عن قصد: العميل يرسل أسماء، والقائمة المفتوحة تجعل من سجلّ الأودت
/// قناةً لكتابة نصّ حرّ فيه — أي قناة PII بلا حساب.
export const INTEGRITY_SIGNALS = [
  /// ملفّات `su`/Magisk موجودة في مسار معروف (Android).
  'root_binaries',
  /// حزمة إدارة Root مثبَّتة (Android).
  'root_manager_app',
  /// بناء النظام موقَّع بمفاتيح تطوير `test-keys` (Android).
  'test_keys',
  /// مسارات Jailbreak معروفة موجودة (iOS).
  'jailbreak_paths',
  /// الكتابة خارج صندوق التطبيق نجحت (iOS) — أقوى إشارة على الطرفين.
  'sandbox_escape',
  /// آثار حقن دوالّ (Frida/Substrate).
  'hooking',
  /// مضاهٍ أو محاكٍ لا جهاز حقيقي.
  'emulator',
  /// منقّح موصول بالعملية الآن.
  'debugger',
] as const;

export type IntegritySignal = typeof INTEGRITY_SIGNALS[number];

export type IntegrityRisk = 'none' | 'elevated' | 'high';

/// الإشارات التي تعني «سلطة الجهاز على نفسه صارت أوسع من سلطتنا عليه».
///
/// وجود واحدة منها يعني أن مفتاح الحزمة في المخزن الآمن قابل للاستخراج، فلا
/// معنى لمنح هذا الجهاز ترخيصًا شهريًّا.
const HIGH_RISK: readonly IntegritySignal[] = [
  'root_binaries',
  'root_manager_app',
  'jailbreak_paths',
  'sandbox_escape',
  'hooking',
];

/// مدّة الترخيص على جهاز عالي الخطورة.
///
/// ثلاثة أيام بدل ثلاثين: الجهاز يواصل التنزيل والمشاهدة، لكن نافذة الاستخدام
/// بعد سحب الجهاز أو انتهاء الاشتراك تقصر من شهر إلى أيام. وهو تقصير **لا** منع:
/// أسرة على هاتف مطوَّر تُكمل استخدامها بلا أن تعرف أن شيئًا اختلف.
export const HIGH_RISK_LICENSE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/// يقرأ الإشارات المُعلَنة من العميل.
///
/// ما ليس في القائمة المغلقة يُهمَل بلا خطأ: نسخة تطبيق أحدث قد ترسل إشارة
/// أضفناها بعد نشر هذا الخادم، وردّ 400 عليها كان سيمنع تنزيلًا مشروعًا.
export function parseIntegritySignals(value: unknown): IntegritySignal[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const source = value as Record<string, unknown>;
  return INTEGRITY_SIGNALS.filter((signal) => source[signal] === true);
}

/// درجة الخطورة من الإشارات.
///
/// تُحسَب هنا ولا تُقرأ من العميل: القراءة كانت ستجعل جهازًا مكسورًا يعلن عن
/// نفسه «سليمًا» بكلمة واحدة، بدل أن يكذب في كل إشارة على حدة.
export function integrityRisk(signals: readonly IntegritySignal[]): IntegrityRisk {
  if (signals.some((signal) => HIGH_RISK.includes(signal))) return 'high';
  return signals.length > 0 ? 'elevated' : 'none';
}

/// مدّة الترخيص المطبَّقة.
///
/// `Math.min` لا إسناد: لو صار الأساس أقصر من حدّ الخطورة يومًا، فالأقصر يفوز.
export function licenceTtlFor(risk: IntegrityRisk, baseTtlMs: number): number {
  return risk === 'high' ? Math.min(baseTtlMs, HIGH_RISK_LICENSE_TTL_MS) : baseTtlMs;
}

/// ما يُسجَّل في سجلّ أودت الأسرة.
///
/// أسماء إشارات وكلمة خطورة — لا طراز جهاز، ولا إصدار نظام، ولا معرّف تثبيت،
/// ولا بصمة. الغرض «هل صار هذا الحساب يُستخدم على أجهزة مكسورة؟» لا وصف الجهاز،
/// والوصف كان سيجعل السجلّ أداة تتبّع أوسع من غرضه.
export function integrityAuditDetails(
  signals: readonly IntegritySignal[],
  risk: IntegrityRisk,
): { risk: IntegrityRisk; signals: IntegritySignal[] } | null {
  return risk === 'none' ? null : { risk, signals: [...signals].sort() };
}
