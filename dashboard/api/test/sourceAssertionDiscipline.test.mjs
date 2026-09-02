import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * انضباط التأكيد على نصّ المصدر (`QA-104`).
 *
 * ## القاعدة، ولماذا ليست «لا تأكيد على المصدر أبدًا»
 *
 * البند يطلب: «لا `assert.match` على نصّ مصدر **لإثبات سلوك وقت التشغيل**». والقيد
 * الأخير هو كل شيء، لأن الفحصين مختلفان:
 *
 * * **سلوك وقت التشغيل** — هل يعمل الوسيط؟ هل تُفرَض الحصة؟ هل تعود ترويسات CORS؟
 *   هذا يُثبَت بطلبٍ حقيقي على التطبيق المُركَّب. وتأكيدٌ على النصّ يبقى أخضر لو
 *   غُيّر مسار التركيب إلى مسار لا يطابق أي طلب حقيقي — وهو العطل نفسه الذي يحرسه.
 * * **خاصّية بنيوية شاملة** — أن **كل** موجّه متحوّل في 36 ملفًا يُعلن
 *   `requirePermission`، أو أن لا نسخة ثانية من عقد CORS. هذه تُقاس بمسح المصدر،
 *   وتحويلها إلى سلوك يعني ضرب 497 نقطة واحدةً واحدة — أي **خسارة** في الصرامة لا
 *   ربحًا. فمسح المصدر هو الأداة الصحيحة لها، لا تنازلًا.
 *
 * ## وما يحرسه هذا الملف
 *
 * ليس التمييز نفسه — لا يُكتشَف آليًّا. بل **العُذر** الذي كان يُبرّر الخطأ: تعليقٌ
 * يزعم أن التطبيق خارج متناول المجموعة، بينما ثلاث مجموعات تُركّبه فعلًا. كان ذلك
 * العذر مكتوبًا في `analyticsIngest.test.mjs` وأُزيل في الدفعة 54، وهذا الحرس يمنع
 * عودته.
 *
 * ## ودرسٌ من بنائه
 *
 * أوّل تشغيل للحرس **أوقع نفسه**: تعليقاتي التي تشرح ما أُزيل كانت تقتبس العبارة
 * المحروسة حرفيًّا، فرصدها الحرس في ملفَين. وهو الدرس الذي تكرّر خمس مرّات في هذا
 * الأودت: حرسٌ على نصّ يرصد **التعليق الذي يشرح العطل**. والعلاج أن يُوصَف العطل
 * بغير عبارته المحروسة — لا أن يُخفَّف الحرس.
 */

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(TEST_DIR).filter((name) => name.endsWith('.test.mjs'));

/// عبارات تعني «لا أستطيع تركيب التطبيق»، بالإنجليزية والعربية.
const EXCUSES = [
  /cannot\s+(?:be\s+)?mount/i,
  /can(?:'|no)t\s+mount/i,
  /unable\s+to\s+mount/i,
  /لا\s+يمكن\s+تركيب/,
  /لا\s+تستطيع\s+هذه\s+المجموعة/,
];

test('at least three suites mount the worker, so "cannot mount" is never true', () => {
  // الحرس يعتمد على هذه الحقيقة، فتُقاس ولا تُفترض.
  const mounting = files.filter((name) => /await import\('\.\.\/src\/index\.ts'\)/
    .test(readFileSync(join(TEST_DIR, name), 'utf8')));
  assert.ok(
    mounting.length >= 3,
    `expected at least three suites mounting the app, found ${mounting.length}: ${mounting.join(', ')}`,
  );
});

test('no suite excuses a source assertion by claiming the app cannot be mounted', () => {
  const offenders = [];
  for (const name of files) {
    if (name === 'sourceAssertionDiscipline.test.mjs') continue;
    const source = readFileSync(join(TEST_DIR, name), 'utf8');
    for (const excuse of EXCUSES) {
      const match = excuse.exec(source);
      if (match) offenders.push(`${name}: "${match[0]}"`);
    }
  }
  assert.deepEqual(
    offenders, [],
    'A runtime property asserted on source text with this excuse is untested: '
    + 'rateLimit.test.mjs, entrypoint.test.mjs and homeBuilderE2E.test.mjs all mount '
    + 'the app, so mount it and assert on the response.',
  );
});

test('the analytics quota is asserted by a response, not by a source match', () => {
  // الحالة التي أُصلحت في الدفعة 54، مُقفَلة بعينها: لا تعود إلى نصّ المصدر.
  const ingest = readFileSync(join(TEST_DIR, 'analyticsIngest.test.mjs'), 'utf8');
  assert.ok(
    !/assert\.match\(source, \/app\\\.use/.test(ingest),
    'the mount registration is back to being matched as text',
  );
  const limits = readFileSync(join(TEST_DIR, 'rateLimit.test.mjs'), 'utf8');
  assert.match(limits, /X-RateLimit-Limit/);
  assert.match(limits, /\/api\/v1\/analytics\/events/);
});
