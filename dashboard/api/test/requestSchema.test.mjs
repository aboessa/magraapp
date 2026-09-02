import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  boolean,
  integer,
  list,
  nested,
  oneOf,
  opaque,
  parseBody,
  text,
  validateBody,
  validationFailure,
} from '../src/lib/requestSchema.ts';

/// SEC-110 — تحقّق مخطَّطي مركزي لأجسام الطلبات.

const read = (relative) => readFileSync(
  fileURLToPath(new URL(`../${relative}`, import.meta.url)),
  'utf8',
);

/* -------------------------------------------------------- رفض غير المعروف */

test('الحقل غير المعروف يُرفض ويُسمّى', () => {
  // الافتراضي لا خيار. حقل زائد يُقبل صامتًا هو إمّا خطأ إملائي في العميل يُهمَل
  // بلا أثر، أو حقل أُزيل من الخادم وما زال العميل يرسله. والحالتان تستحقّان جوابًا.
  const result = validateBody({ name: 'ليان', nickname: 'ليان' }, { name: text() });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unknown');
  assert.deepEqual(result.fields, ['nickname']);
});

test('الخارج من التصفية لا يحمل إلا ما أُعلن', () => {
  // ليس رفضًا فقط بل **قطعًا**: ما بعد المخطَّط لا يرى حقلًا لم يُعلَن، فلا يمكن
  // أن يقرأ معالجٌ حقلًا نسي المخطَّط إعلانه.
  const result = validateBody({ a: 'x' }, { a: text(), b: text({ optional: true }) });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.value), ['a']);
});

/* ------------------------------------------------------------------ الأنواع */

test('النصّ: النوع والمدى والنمط', () => {
  const schema = { code: text({ min: 2, max: 4, pattern: /^[a-z]+$/ }) };
  assert.equal(validateBody({ code: 'abc' }, schema).ok, true);
  assert.equal(validateBody({ code: 'a' }, schema).reason, 'invalid');
  assert.equal(validateBody({ code: 'abcde' }, schema).reason, 'invalid');
  assert.equal(validateBody({ code: 'AB' }, schema).reason, 'invalid');
  assert.equal(validateBody({ code: 7 }, schema).reason, 'invalid');
});

test('العدد الصحيح لا يقبل نصًّا رقميًّا ولا كسرًا ولا لانهاية', () => {
  // قبول `'7'` كان سيعني أن العميل يتحكّم في **نوع** ما نُدرجه في القاعدة.
  const schema = { minutes: integer({ min: 5, max: 180 }) };
  assert.equal(validateBody({ minutes: 30 }, schema).ok, true);
  for (const value of ['30', 30.5, Number.NaN, Number.POSITIVE_INFINITY, true, null]) {
    assert.equal(validateBody({ minutes: value }, schema).ok, false, String(value));
  }
});

test('المنطقي لا يقبل صادقًا بالتقريب', () => {
  // `body.autoplay ? 1 : 0` كان يقبل `"no"` تشغيلًا تلقائيًّا مفعَّلًا.
  const schema = { autoplay: boolean() };
  assert.equal(validateBody({ autoplay: false }, schema).ok, true);
  for (const value of ['true', 1, 0, '', null]) {
    assert.equal(validateBody({ autoplay: value }, schema).ok, false, String(value));
  }
});

test('القائمة المغلقة ترفض ما ليس فيها', () => {
  const schema = { action: oneOf(['add', 'remove']) };
  assert.equal(validateBody({ action: 'add' }, schema).ok, true);
  assert.equal(validateBody({ action: 'delete' }, schema).reason, 'invalid');
});

test('المصفوفة لها سقف إلزامي ويُفحَص كل عنصر', () => {
  // مصفوفة بلا حدّ هي طلب واحد يستهلك ذاكرة Worker كلّها.
  const schema = { interests: list(text({ max: 8 }), { max: 3 }) };
  assert.equal(validateBody({ interests: ['a', 'b'] }, schema).ok, true);
  assert.equal(validateBody({ interests: ['a', 'b', 'c', 'd'] }, schema).reason, 'invalid');
  assert.equal(validateBody({ interests: ['a', 42] }, schema).reason, 'invalid');
  assert.equal(validateBody({ interests: 'a' }, schema).reason, 'invalid');
});

test('الكائن المتداخل يرفض غير المعروف كالجسم نفسه', () => {
  const schema = { child: nested({ id: text() }) };
  assert.equal(validateBody({ child: { id: 'c1' } }, schema).ok, true);
  assert.equal(validateBody({ child: { id: 'c1', extra: 1 } }, schema).ok, false);
  assert.equal(validateBody({ child: 'c1' }, schema).ok, false);
});

test('`null` يُقبل حين يُعلَن وحده', () => {
  assert.equal(validateBody({ name: null }, { name: text({ nullable: true }) }).ok, true);
  assert.equal(validateBody({ name: null }, { name: text() }).ok, false);
});

test('الحقل الاختياري الغائب ليس نقصًا، والمطلوب الغائب نقص', () => {
  assert.equal(validateBody({}, { a: text({ optional: true }) }).ok, true);
  const missing = validateBody({}, { a: text(), b: text() });
  assert.equal(missing.reason, 'missing');
  assert.deepEqual(missing.fields, ['a', 'b']);
});

test('الحقل الحرّ الشكل معلَن صراحةً', () => {
  // «هذا الحقل بلا مخطَّط» يجب أن يكون قرارًا مكتوبًا لا سهوًا.
  assert.equal(validateBody({ payload: { anything: [1, 2] } }, { payload: opaque() }).ok, true);
});

test('ما ليس كائنًا JSON يُرفض بلا استثناء', () => {
  for (const value of [null, undefined, 'text', 42, [], true]) {
    assert.equal(validateBody(value, { a: text() }).ok, false, String(value));
  }
  assert.equal(validateBody([], { a: text() }).reason, 'malformed');
});

test('JSON غير صالح مدخل خاطئ لا استثناء', async () => {
  const result = await parseBody({ req: { json: () => Promise.reject(new Error('bad')) } }, { a: text() });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'malformed');
});

/* ------------------------------------------------------------ شكل الخطأ */

test('الخطأ موحَّد الشكل ولا يكشف القاعدة المخروقة', () => {
  // «`birth_year` غير صالح» يكفي من يبني عميلًا شريفًا، و«يجب أن يكون بين 2008
  // و2024» يرسم لمن يستكشف حدود القاعدة خريطةً مجّانًا.
  const failure = validationFailure(validateBody({ birth_year: 1500 }, {
    birth_year: integer({ min: 2008, max: 2024 }),
  }));
  assert.deepEqual(failure, {
    success: false,
    code: 'invalid_body',
    error: 'Request body is invalid',
    data: { fields: ['birth_year'] },
  });
  const encoded = JSON.stringify(failure);
  for (const leak of ['2008', '2024', 'integer', 'min', 'max', 'pattern']) {
    assert.equal(encoded.includes(leak), false, `الرسالة تكشف ${leak}`);
  }
});

test('الرمز واحد لكل الأسباب', () => {
  // التفريق بين «مجهول» و«ناقص» يجعل من المسار أوراكل لمعرفة الحقول المعروفة.
  const unknownField = validationFailure(validateBody({ x: 1 }, { a: text() }));
  const missingField = validationFailure(validateBody({}, { a: text() }));
  assert.equal(unknownField.code, missingField.code);
  assert.equal(unknownField.error, missingField.error);
});

test('الناقص يُبلَّغ قبل الخاطئ', () => {
  const result = validateBody({ b: 42 }, { a: text(), b: text() });
  assert.equal(result.reason, 'missing');
  assert.deepEqual(result.fields, ['a']);
});

/* ------------------------------------------------------ تغطية مسارات العميل */

/// كل موجّهات العميل التي تقرأ جسم طلب.
///
/// كانت أربعة في الدفعة 18 وتسعة مُدرَجة؛ صارت الثلاثة عشر كلّها مُغطّاة في
/// الدفعة 23. و`STAGED` **فارغة الآن**، وهذا موضعها الصحيح: قائمة إدراج تنقص
/// ولا تنمو، وإفراغها هو اكتمال البند.
const COVERED = [
  'auth.ts', 'account.ts', 'family.ts', 'childSettings.ts',
  'episodes.ts', 'books.ts', 'stories.ts', 'downloads.ts',
  'notifications.ts', 'billing.ts', 'partnerships.ts', 'analyticsIngest.ts',
  'creations.ts',
];

/// ما لم يُحوَّل بعد، بسببه المكتوب. القائمة **تنقص ولا تنمو**.
const STAGED = {};

test('كل موجّه عميل إمّا مُغطّى بمخطَّط أو مُدرَج بسببه', () => {
  // معيار القبول الثالث. الحرس هيكلي: ملف كتابة جديد على مسار العميل يفشل هذا
  // الاختبار حتى يُعلن مخطَّطه أو يُدرَج بسببه المكتوب — والإدراج مرئي في مراجعة.
  const dir = fileURLToPath(new URL('../src/routes/', import.meta.url));
  const files = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.startsWith('admin'));
  for (const name of files) {
    const source = read(`src/routes/${name}`);
    if (!/\.(post|patch|put|delete)\(/.test(source)) continue;
    if (!/req\.json\(\)|parseBody|bodyOr400/.test(source)) continue;
    const covered = COVERED.includes(name);
    const staged = name in STAGED;
    assert.ok(covered || staged, `${name} مسار كتابة بلا مخطَّط وبلا سبب مُدرَج`);
    // `bodyOr400` مُغلِّف `parseBody`؛ أيّهما يكفي.
    if (covered) {
      assert.match(source, /parseBody|bodyOr400/, `${name} مُعلَن مُغطّى ولا يستخدم المخطَّط`);
    }
  }
});

/// قراءات الجسم المباشرة المُستثناة، بسببها المكتوب.
///
/// `POST /billing/google-play/rtdn` يستقبل **مغلَّف Google Pub/Sub** بعد تحقّق
/// OIDC، ويحلّه `parseGoogleRtdn`. شكله شكل Google لا شكلنا، وإعلانه في مخطَّط
/// يعني نسخة ثانية من عقدٍ نحن لا نملكه — تتقادم مع أوّل تغيير عنده.
const DIRECT_READS = { 'billing.ts': 1 };

test('الموجّهات المُغطّاة لا تقرأ الجسم خارج المخطَّط', () => {
  // انزلاق واحد يعيد التحقّق اليدوي: قراءةُ جسمٍ بجانب مخطَّط تعني معالجًا يرى ما
  // لم يُعلَن. والاستثناء **معدود** لا مسموح: قراءةٌ ثانية في نفس الملف تُفشل.
  for (const name of COVERED) {
    const source = read(`src/routes/${name}`)
      .split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
    const direct = source.match(/await c\.req\.json\(\)/g) ?? [];
    assert.equal(
      direct.length,
      DIRECT_READS[name] ?? 0,
      `${name}: قراءة جسم مباشرة غير مُستثناة`,
    );
  }
});

test('قارئ الجسم المحلّي حُذف من كل موجّه مُغطّى', () => {
  // `{ ...value }` كان يمرّر أي حقل زائد إلى الكائن الدائم. وما يمنع رجوعه ليس
  // مراجعة كل نشر، بل **ألّا يبقى في الملف جسمٌ غير مصفّى يُنشَر**: القارئ
  // المحلّي `async function body(c)` كان هو مصدره الوحيد.
  for (const name of COVERED) {
    const source = read(`src/routes/${name}`);
    assert.equal(
      /async function body\(/.test(source),
      false,
      `${name} ما زال فيه قارئ جسم محلّي`,
    );
  }
});
