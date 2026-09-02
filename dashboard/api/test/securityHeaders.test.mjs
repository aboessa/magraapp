import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import worker from '../src/index.ts';
import {
  HSTS_VALUE, PUBLIC_DOCUMENT_CSP, baseSecurityHeaders, publicDocumentHeaders,
} from '../src/lib/securityHeaders.ts';

/// نفس تجهيزة `entrypoint.test.mjs`: نداء عبر `fetch` الحقيقي للـWorker لا عبر
/// نسخة Hono مستقلّة، وإلا اختُبر وسيط لم يُركَّب على المسار الفعلي.
const emptyDb = {
  prepare() {
    return {
      bind: () => ({
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() { return { meta: { changes: 0 } }; },
      }),
      async first() { return null; },
      async all() { return { results: [] }; },
      async run() { return { meta: { changes: 0 } }; },
    };
  },
  async batch(statements) { return statements.map(() => ({ meta: { changes: 0 } })); },
};

const request = (path, init = {}) => worker.fetch(
  new Request(`https://api.majarra.app${path}`, init),
  {
    ENVIRONMENT: 'development',
    API_VERSION: 'v1',
    DB: emptyDb,
    CACHE: { async get() { return null; }, async put() {} },
  },
  { waitUntil() {}, passThroughOnException() {} },
);

/// SEC-108 — ترويسات أمان الاستجابات العامة.
///
/// ## العلّة التي تثبّتها هذه الاختبارات
///
/// عارض الصفحات العامة كان يُصدر مستندًا كاملًا — مبنيًّا من محتوى يكتبه بشر في
/// اللوحة — بلا `Content-Security-Policy` ولا `X-Frame-Options` ولا
/// `Strict-Transport-Security`. ثغرة هروب واحدة في `lib/publicHtml.ts` كانت
/// تعني تنفيذ سكربت بلا أي طبقة ثانية تمنعه، وأي موقع كان يستطيع تأطير الصفحة.
///
/// والمقابل الصحيح كان في المستودع نفسه (`routes/creations.ts` و`routes/media.ts`)،
/// أي أن المعرفة كانت حاضرة والتطبيق ناقصًا في أخطر سطح: المستند.

const documentHeaders = () => publicDocumentHeaders('no-store');

test('مستند HTML عام يحمل الترويسات الأربع', () => {
  const headers = documentHeaders();
  assert.equal(headers['Content-Security-Policy'], PUBLIC_DOCUMENT_CSP);
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(headers['Strict-Transport-Security'], HSTS_VALUE);
});

test('السياسة تمنع كل سكربت', () => {
  // هذا هو التوجيه الذي يحوّل ثغرة هروب من تنفيذ إلى نصّ معروض. الصفحة لا
  // تحمل أي سكربت أصلًا، فالمنع الكامل توصيف للواقع لا تقييد زائد.
  assert.match(PUBLIC_DOCUMENT_CSP, /default-src 'none'/);
  assert.doesNotMatch(PUBLIC_DOCUMENT_CSP, /script-src/);
  // ولا `unsafe-inline` ولا `unsafe-eval` على السكربت بأي صياغة.
  assert.doesNotMatch(PUBLIC_DOCUMENT_CSP, /unsafe-eval/);
});

test('السياسة تمنع التأطير وإعادة تأصيل الروابط والنماذج', () => {
  assert.match(PUBLIC_DOCUMENT_CSP, /frame-ancestors 'none'/);
  // `<base>` مُدرَج يعيد توجيه كل رابط نسبي في الصفحة.
  assert.match(PUBLIC_DOCUMENT_CSP, /base-uri 'none'/);
  // لا نموذج في هذه الصفحات، فأي `form` مُدرَج لا مقصد له.
  assert.match(PUBLIC_DOCUMENT_CSP, /form-action 'none'/);
});

test('الصور مسموحة لأن المحرّر قد يضع مصدرًا خارجيًّا', () => {
  // حصر الصور في نطاقنا كان سيكسر محتوى مشروعًا، والصورة لا تُنفَّذ.
  assert.match(PUBLIC_DOCUMENT_CSP, /img-src 'self' https: data:/);
});

test('HSTS سنة ويشمل النطاقات الفرعية، وبلا preload', () => {
  assert.match(HSTS_VALUE, /max-age=31536000/);
  assert.match(HSTS_VALUE, /includeSubDomains/);
  // الإدراج في قائمة المتصفّحات المسبقة قرار شبه دائم، وإزالته تأخذ أشهرًا:
  // قرار مالك لا إعداد ترويسة.
  assert.doesNotMatch(HSTS_VALUE, /preload/);
});

test('سياسة التخزين تبقى قرار المسار لا الأمان', () => {
  // مستند `noindex` لا يُخزَّن في كاش مشترك، وصفحة منشورة تُخزَّن. لو ثبّتت
  // وحدة الأمان القيمة لكانت أخطأت في أحد الحالين.
  assert.equal(publicDocumentHeaders('no-store')['Cache-Control'], 'no-store');
  assert.equal(
    publicDocumentHeaders('public, max-age=60')['Cache-Control'],
    'public, max-age=60',
  );
});

/* ------------------------------------------------- الأرضية على كل استجابة */

test('استجابة JSON من الـAPI تحمل HSTS و nosniff', async () => {
  // HSTS ترويسة على مستوى المضيف لا المسار: لو وُضعت على صفحات HTML وحدها
  // لما ثبّتها أول اتصال بالـAPI — وهو الاتصال الأول لكل عميل تطبيق.
  const response = await request('/api/v1/nonexistent-route-for-header-test');
  assert.equal(response.headers.get('Strict-Transport-Security'), HSTS_VALUE);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('الوسيط يرفع الأرضية ولا يخفض سقفًا أصرم', () => {
  // `routes/media.ts` يضبط `no-referrer` وهي أصرم من أرضيتنا. الكتابة فوقها
  // كانت ستُرخي حماية مسار الوسائط بينما نظنّ أننا نشدّده.
  const index = readFileSync(
    fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    'utf8',
  );
  assert.match(index, /Referrer-Policy' && c\.res\.headers\.has\(name\)/);

  const media = readFileSync(
    fileURLToPath(new URL('../src/routes/media.ts', import.meta.url)),
    'utf8',
  );
  assert.match(media, /no-referrer/, 'الافتراض الذي يقوم عليه الاستثناء أعلاه');
});

/* --------------------------------------------- المصدر واحد لا منسوخ */

test('عارض الصفحات لا يكتب ترويسات أمان لنفسه', () => {
  // ترويسة منسوخة في ثلاثة ملفات تسقط من أحدها بعد أول تعديل ولا شيء يكشفه.
  const renderer = readFileSync(
    fileURLToPath(new URL('../src/routes/publicRender.ts', import.meta.url)),
    'utf8',
  );
  assert.match(renderer, /publicDocumentHeaders\(/);
  assert.doesNotMatch(renderer, /'X-Content-Type-Options':/);
  assert.doesNotMatch(renderer, /'Content-Security-Policy':/);
});

test('الأرضية المشتركة لا تحوي ترويسة خاصة بالمستندات', () => {
  // `X-Frame-Options: DENY` على استجابة JSON بلا معنى، و`CSP` للمستند لا تصف
  // ما تحتاجه استجابة وسائط. الفصل مقصود.
  const base = baseSecurityHeaders();
  assert.equal(base['X-Frame-Options'], undefined);
  assert.equal(base['Content-Security-Policy'], undefined);
});
