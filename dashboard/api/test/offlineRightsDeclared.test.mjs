import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `CNT-110` — التنزيل لا يُمارس حقًّا لم يُعلَن.
 *
 * ## العلّة
 *
 * `content_rights.licenses` تحمل الاستعمالات المسموح بها (`streaming`, `offline`)،
 * و`routes/downloads.ts` **لم يكن يقرؤها أصلًا**. فمنصّةٌ تُنزِّل عنصرًا حقوقه
 * المُعلَنة «بثّ فقط» تُمارس حقًّا لم تُعلنه. وهذا معنى معيار «مصفوفة
 * DRM/Offline/Watermark» بعد قرار المالك بلا DRM: لا تشفير، لكن ما يُعلَن يُحترَم.
 *
 * ## وما يحرسه هذا الملف بالأخصّ: أن الرفض **لا يتوسّع**
 *
 * بالقياس على البيانات: الحلقات والكتب كلّها تُعلن `offline`، والألعاب «بثّ فقط»
 * وليست قابلة للتنزيل، و**القصص لا يمكن أن تحمل صفّ حقوق** لأن قيد CHECK في
 * `content_rights.entity_type` يستثنيها. فرفضٌ عند غياب الحقوق كان سيُعطّل تنزيل
 * القصص كلّها بسبب قيدٍ في المخطوطة لا بسبب حقوق — وهو «حجبُ الكلّ» الذي يُعلِّم
 * الناس تجاوز البوابات، وهو الخطأ الذي كنتُ سأرتكبه لولا القياس.
 */

const routeSource = readFileSync(
  fileURLToPath(new URL('../src/routes/downloads.ts', import.meta.url)),
  'utf8',
);

test('the rights table cannot describe a story, and the code says so', () => {
  // القيد نفسه، مقروءًا من المخطوطة لا من الذاكرة.
  const migration = readFileSync(
    fileURLToPath(new URL('../migrations/0001_init.sql', import.meta.url)),
    'utf8',
  );
  const table = migration.slice(migration.indexOf('CREATE TABLE content_rights'));
  const check = table.slice(0, table.indexOf(');'));
  assert.match(check, /entity_type TEXT NOT NULL CHECK \(entity_type IN \([^)]*\)\)/);
  assert.ok(!/'story'/.test(check), 'if stories ever become rights-bearing, revisit RIGHTS_BEARING');
});

test('only rights-bearing types are checked, so stories are not blocked by a schema limit', () => {
  assert.match(routeSource, /RIGHTS_BEARING[^=]*=\s*\['episode',\s*'book'\]/);
  assert.match(routeSource, /if \(!RIGHTS_BEARING\.includes\(entityType\)\) return true;/);
});

test('absent rights do not refuse a download', () => {
  // الغياب ليس منعًا، وبوابة النشر تُحذِّر عليه أصلًا.
  assert.match(routeSource, /if \(rows\.length === 0\) return true;/);
});

test('a declared licence that omits offline refuses with 403 and a named reason', () => {
  // 403 لا 404: العنصر موجود ومنشور، والمنع سببه حقٌّ لم يُعلَن — و«غير متاح»
  // كانت ستُخفي السبب عن المشغّل وعن وليّ الأمر.
  assert.match(routeSource, /offline_right_not_declared/);
  assert.match(routeSource, /Offline use is not among the declared rights/);
  const refusal = routeSource.slice(routeSource.indexOf('offline_right_not_declared') - 400);
  assert.match(refusal.slice(0, 600), /\}, 403\)/);
});

test('the check runs before a licence is minted, not after', () => {
  // فحصٌ بعد الإصدار لا يمنع شيئًا: الترخيص يكون قد وُقِّع ووصل الجهاز.
  // والمقارنة على **موضع النداء** لا على الاسم: أوّل ظهور للاسم هو سطر الاستيراد،
  // ومقارنةٌ به تنجح دائمًا وتحرس لا شيء — وهي أوّل صيغةٍ كتبتُها وأسقطها الاختبار.
  const guard = routeSource.indexOf('offlineRightDeclared(c.env, entityType, entityId)');
  const mint = routeSource.indexOf('signOfflineLicense(c.env');
  assert.ok(guard > 0, 'the guard is not called in the session route');
  assert.ok(mint > 0, 'the minting call was not found');
  assert.ok(guard < mint, 'the rights check must precede signing');
});

test('renewal is checked too, so a withdrawn right does not extend for ever', () => {
  // التجديد يُمارس الحقّ من جديد. وفحصُ الإصدار وحده كان يجعل حقًّا سُحب بعد
  // التنزيل يبقى ممتدًّا شهرًا بعد شهر — نفس علّة «البوابة تعمل مرّةً ولا تُعاد».
  const mints = [...routeSource.matchAll(/signOfflineLicense\(c\.env/g)].map((m) => m.index);
  assert.equal(mints.length, 2, 'expected exactly two minting sites: issue and renew');
  const guards = [...routeSource.matchAll(/offlineRightDeclared\(c\.env/g)].map((m) => m.index);
  assert.equal(guards.length, 2, 'every minting site must be guarded');
  // كل حرس يسبق الإصدار الذي يحميه.
  assert.ok(guards[0] < mints[0]);
  assert.ok(guards[1] < mints[1]);
  assert.match(routeSource, /no longer among the declared rights/);
});

test('a malformed licence list is treated as absent, not as a refusal', () => {
  // قائمة معطوبة ليست إعلانًا بالمنع. ولو عُوملت منعًا لصار خطأُ بياناتٍ واحد
  // يُوقف تنزيل عنصرٍ حقوقه سليمة في الواقع.
  assert.match(routeSource, /parsed\.length === 0 \|\| parsed\.includes\('offline'\)/);
});
