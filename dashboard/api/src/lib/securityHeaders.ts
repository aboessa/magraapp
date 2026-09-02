/// SEC-108 — ترويسات أمان الاستجابات العامة، في موضع واحد.
///
/// ## العلّة
///
/// عارض الصفحات العامة (`routes/publicRender.ts`) كان يُصدر مستندًا كاملًا —
/// مبنيًّا من محتوى يكتبه بشر في اللوحة — بلا `Content-Security-Policy` ولا
/// `X-Frame-Options` ولا `Strict-Transport-Security`. والمقابل الصحيح كان موجودًا
/// في المستودع نفسه: `routes/creations.ts` يضبط `default-src 'none'; sandbox`
/// و`routes/media.ts` يضبط `no-store` و`nosniff` و`no-referrer`. أي أن المعرفة
/// كانت حاضرة والتطبيق ناقصًا في أخطر سطح: المستند.
///
/// ## لماذا وحدة مستقلة
///
/// ترويسة أمان منسوخة في ثلاثة ملفات تسقط من أحدها بعد أول تعديل، ولا شيء
/// يكشف ذلك. هنا مصدر واحد، ويثبّته `test/securityHeaders.test.mjs`.
///
/// ## الطبقات: هذه الترويسات ليست بديلًا عن الهروب
///
/// `lib/publicHtml.ts` يهرّب كل قيمة مُنتَجة ويرفض كل رابط ليس `http(s)`.
/// الـCSP طبقة ثانية: لو أفلتت قيمة يومًا من الهروب فالسكربت المُدرَج لا
/// يُنفَّذ. الاعتماد على أيّهما وحده خطأ.

/// سياسة المستندات العامة.
///
/// كل توجيه هنا مبني على ما تحتاجه الصفحة فعلًا، لا على قائمة منسوخة:
///
///  * `default-src 'none'` — الأساس. الصفحة **لا تحمل أي سكربت**: لا ملف
///    خارجي ولا سطر مضمَّن. (`<script type="application/ld+json">` كتلة بيانات
///    لا تُنفَّذ ولا يحجبها `script-src` بحسب المواصفة.) فالمنع الكامل ليس
///    تقييدًا زائدًا بل توصيف للواقع.
///  * `img-src 'self' https: data:` — الصور تأتي من `cdn.majarra.app` ومن
///    روابط قد يضعها محرّر المحتوى لمصدر خارجي. حصرها في نطاقنا كان سيكسر
///    محتوى مشروعًا، والصورة لا تُنفَّذ فالمخاطرة مقبولة. `data:` للصور
///    المضمَّنة الصغيرة.
///  * `style-src 'unsafe-inline'` — المستند يضمّن ورقة أنماط ثابتة واحدة
///    (`BASE_STYLE`) لا مصدر خارجي لها. البديل بصمة `'sha256-…'` يحتاج حسابًا
///    غير متزامن لكل استجابة أو ثابتًا يُنسى تحديثه فتتعطّل كل الصفحات بلا
///    أنماط. والأثر محدود: مع `default-src 'none'` لا سكربت يُنفَّذ، فالحدّ
///    الأقصى لحقن CSS هو تشويه شكلي لا تنفيذ.
///  * `base-uri 'none'` — يمنع `<base>` مُدرَجًا من إعادة توجيه كل رابط نسبي.
///  * `form-action 'none'` — لا نموذج في هذه الصفحات، فالتوجيه يمنع سرقة
///    بيانات عبر نموذج مُدرَج.
///  * `frame-ancestors 'none'` — لا تأطير. البديل الأقدم `X-Frame-Options`
///    يُرسَل معه لأن متصفّحات قديمة لا تعرف التوجيه.
export const PUBLIC_DOCUMENT_CSP = [
  "default-src 'none'",
  "img-src 'self' https: data:",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

/// HSTS: سنة كاملة، ويشمل النطاقات الفرعية.
///
/// كل مضيفات «مجرة» على TLS خلف Cloudflare (`api.` و`cdn.` والموقع)، فلا مسار
/// `http` مشروع ليُكسَر. `preload` **غير مُدرَج عن قصد**: إدراج النطاق في قائمة
/// المتصفّحات المسبقة قرار شبه دائم وإزالته تأخذ أشهرًا، وهو قرار مالك لا
/// إعداد ترويسة.
export const HSTS_VALUE = 'max-age=31536000; includeSubDomains';

/// الترويسات المشتركة لكل استجابة عامة، مستندًا كانت أو أصلًا.
export function baseSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': HSTS_VALUE,
  };
}

/// ترويسات مستند HTML عام.
///
/// [cacheControl] يُمرَّر من المتصل لأن سياسة التخزين قرار من المسار لا من
/// الأمان: مستند `noindex` لا يُخزَّن في كاش مشترك، وصفحة منشورة تُخزَّن.
export function publicDocumentHeaders(cacheControl: string): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=UTF-8',
    'Cache-Control': cacheControl,
    ...baseSecurityHeaders(),
    'Content-Security-Policy': PUBLIC_DOCUMENT_CSP,
    // مع `frame-ancestors 'none'` أعلاه. لا يُغني أحدهما عن الآخر: المواصفة
    // تقول إن `frame-ancestors` يتقدّم حيث يُفهَم، وما لا يفهمه يفهم هذا.
    'X-Frame-Options': 'DENY',
  };
}
