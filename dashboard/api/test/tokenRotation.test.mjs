import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createSignedToken, tokenKeyId, verifySignedToken } from '../src/lib/security.ts';

/// SEC-109 — تدوير سرّ التوقيع بلا إخراج أي مستخدم.

const CURRENT = 'current-secret-0123456789abcdef0123456789';
const PREVIOUS = 'previous-secret-0123456789abcdef0123456789';
const STRANGER = 'stranger-secret-0123456789abcdef0123456789';

/* ------------------------------------------------------------ معرّف المفتاح */

test('المعرّف مشتقّ من السرّ وثابت له', async () => {
  const first = await tokenKeyId(CURRENT);
  assert.equal(await tokenKeyId(CURRENT), first);
  assert.notEqual(await tokenKeyId(PREVIOUS), first);
});

test('المعرّف لا يفشي السرّ ولا جزءًا منه', async () => {
  const kid = await tokenKeyId(CURRENT);
  assert.equal(kid.length, 12);
  assert.match(kid, /^[A-Za-z0-9_-]+$/);
  assert.equal(CURRENT.includes(kid), false);
});

test('المعرّف يُدرج في كل توكن', async () => {
  const token = await createSignedToken({ typ: 'test' }, CURRENT);
  const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  assert.equal(payload.kid, await tokenKeyId(CURRENT));
});

/* ------------------------------------------------------------------ الدوران */

test('توكن السرّ السابق يبقى مقبولًا أثناء نافذة الدوران', async () => {
  // معيار القبول الأول. هذا هو العطل بعينه: قبل التغيير كان تبديل السرّ يُبطل
  // كل توكن قائم، فيُخرَج كل وليّ أمر وتفشل كل مشاهدة جارية.
  const issued = await createSignedToken({ typ: 'parent_access', sub: 'parent-1' }, PREVIOUS);
  assert.equal(await verifySignedToken(issued, [CURRENT, PREVIOUS]) !== null, true);
});

test('التوقيع الجديد بالحالي، والتحقّق يقبل الاثنين', async () => {
  const fresh = await createSignedToken({ typ: 'parent_access' }, CURRENT);
  assert.ok(await verifySignedToken(fresh, [CURRENT, PREVIOUS]));
  // والحالي وحده يكفي لتوكناته: انقضاء النافذة لا يمسّ ما وُقِّع بعد الدوران.
  assert.ok(await verifySignedToken(fresh, [CURRENT]));
});

test('انقضاء النافذة يُبطل توكنات السرّ المسحوب', async () => {
  // معيار القبول الثاني. حذف `AUTH_TOKEN_SECRET_PREVIOUS` هو كل الإجراء: لا
  // قائمة سحب ولا جدول، فالسرّ الذي لا يُقرأ لا يُتحقَّق به.
  const old = await createSignedToken({ typ: 'parent_access' }, PREVIOUS);
  assert.equal(await verifySignedToken(old, [CURRENT]), null);
});

test('سرّ لم يكن في الحلقة يومًا يُرفض', async () => {
  const forged = await createSignedToken({ typ: 'parent_access' }, STRANGER);
  assert.equal(await verifySignedToken(forged, [CURRENT, PREVIOUS]), null);
});

/* -------------------------------------------------------- ما لا يخدع الاختيار */

test('معرّف مكذوب لا يُمرّر توقيعًا خاطئًا', async () => {
  // `kid` يُقرأ قبل التحقّق، أي من مدخل غير موثوق. فهو للاختيار وحده والتوقيع
  // هو ما يحكم: توكن موقَّع بغريب ويُعلن معرّف الحالي يُرفض.
  const payload = { typ: 'parent_access', kid: await tokenKeyId(CURRENT) };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const forged = await createSignedToken(payload, STRANGER);
  assert.equal(await verifySignedToken(forged, [CURRENT, PREVIOUS]), null);
  assert.equal(await verifySignedToken(`${encoded}.${forged.split('.')[1]}`, [CURRENT]), null);
});

test('معرّف لا يقابل مفتاحًا في الحلقة يُرفض', async () => {
  const payload = { typ: 'parent_access', kid: 'not-a-real-kid' };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  assert.equal(await verifySignedToken(`${encoded}.AAAA`, [CURRENT, PREVIOUS]), null);
});

test('توكن قديم بلا معرّف يُجرَّب على الحلقة كلّها', async () => {
  // التسامح المؤقّت: توكنات أُصدرت قبل هذا التغيير. حذفه اليوم كان سيُخرج كل
  // مستخدم قائم — نفس العطل الذي كُتب هذا الملف لإصلاحه.
  const legacy = Buffer.from(JSON.stringify({ typ: 'parent_access' }), 'utf8').toString('base64url');
  const { createHmac } = await import('node:crypto');
  const sign = (secret) => createHmac('sha256', secret).update(legacy).digest('base64url');
  assert.ok(await verifySignedToken(`${legacy}.${sign(PREVIOUS)}`, [CURRENT, PREVIOUS]));
  assert.ok(await verifySignedToken(`${legacy}.${sign(CURRENT)}`, [CURRENT, PREVIOUS]));
  assert.equal(await verifySignedToken(`${legacy}.${sign(STRANGER)}`, [CURRENT, PREVIOUS]), null);
});

test('حلقة فارغة أو سرّ قصير لا تُقبل بها توكنات', async () => {
  const token = await createSignedToken({ typ: 'test' }, CURRENT);
  assert.equal(await verifySignedToken(token, []), null);
  assert.equal(await verifySignedToken(token, [undefined, null]), null);
  // سرّ أقصر من ٣٢ بايت يُسقَط من الحلقة بلا خطأ: القصير ليس مفتاحًا.
  assert.equal(await verifySignedToken(token, ['short']), null);
});

/* -------------------------------------------------------------------- الربط */

const authSource = readFileSync(
  fileURLToPath(new URL('../src/lib/parentAuth.ts', import.meta.url)),
  'utf8',
);

test('كل مسار تحقّق يستخدم الحلقة لا السرّ الواحد', () => {
  // انزلاق واحد يعيد العطل: مسار يتحقّق بالسرّ الحالي وحده يُخرج مستخدميه عند
  // الدوران، والعطل يظهر مرّة كل تدوير — أي حين لا أحد ينظر.
  const calls = authSource.match(/verifySignedToken<[^>]+>\(\s*\n?\s*token,\s*([^)]+)\)/g) ?? [];
  assert.equal(calls.length, 5, 'عدد مسارات التحقّق تغيّر');
  for (const call of calls) {
    assert.match(call, /secretRing\(env, '(AUTH|MEDIA)_TOKEN_SECRET'\)/, call);
  }
});

test('التوقيع بالحالي وحده', () => {
  // لو وُقِّع بالسابق لصار الدوران بلا نهاية ولما انقضت نافذته أبدًا.
  assert.equal(/createSignedToken\([^)]*secretRing/s.test(authSource), false);
  assert.match(authSource, /function secretRing/);
});

test('الحلقة ترتيبها الحالي ثم السابق', () => {
  assert.match(authSource, /return \[env\[name\], env\[`\$\{name\}_PREVIOUS`\]\]/);
});

test('الإجراء موثَّق', () => {
  // معيار القبول الثالث: سرّ لا يُعرَف كيف يُدوَّر هو سرّ لا يُدوَّر.
  const docs = readFileSync(
    fileURLToPath(new URL('../../../SETUP_SECRETS.md', import.meta.url)),
    'utf8',
  );
  assert.match(docs, /AUTH_TOKEN_SECRET_PREVIOUS/);
  assert.match(docs, /MEDIA_TOKEN_SECRET_PREVIOUS/);
});
