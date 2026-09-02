/// هوية البناء — يُولَّد بـ`tools/ci/write-release.mjs` (`OPS-105`).
///
/// **لا يُحرَّر بيد.** القيَم أدناه قيَم النائب، وتُستبدل في مسار النشر وحده. وأي
/// تحرير يدوي يُفشل `test/release.test.mjs` لأنه يوازن الملف بمخرَج القالب.
///
/// و`unknown` جوابٌ صادق لا نقصٌ: بناءٌ محلي أو نشرٌ يدوي **لا يعرف** رقم الإصدار،
/// وإعلان ذلك أنفع من تاريخٍ مُختلَق يُقرأ كأنه حقيقة.

export interface ReleaseIdentity {
  /// أوّل ١٢ محرفًا من بصمة الـcommit، أو `unknown`.
  ///
  /// مقتطعة لا كاملة: الاثنا عشر تكفي للمطابقة في مستودع واحد، والنقطة النهائية
  /// عامّة بلا مصادقة. والبصمة الكاملة محفوظة في وسم الإصدار في git.
  readonly commit: string;
  /// وقت البناء بصيغة ISO‏-8601 بالتوقيت العالمي، أو `unknown`.
  readonly builtAt: string;
  /// رقم جولة CI التي أنتجت البناء، أو `unknown`.
  readonly run: string;
}

export const RELEASE: ReleaseIdentity = {
  commit: 'unknown',
  builtAt: 'unknown',
  run: 'unknown',
};
