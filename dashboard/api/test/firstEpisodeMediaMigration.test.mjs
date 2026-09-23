import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ‏`DATA-201`: شكل الترحيل الذي استوعب تسجيل وسائط أول حلقة.
 *
 * ## العطل الذي وقع
 *
 * إنتاج الفيديو في 2026-09-03 سجّل وسائطه في الإنتاج بأربعة ملفات SQL شُغِّلت
 * **بيدٍ** من `tools/ops/`، وكلّها خارج git. فالقدرة التي دُفع ثمنها — إعادة بناء
 * القاعدة من المستودع (`DB-104`، ووظيفة `migrations` في CI) — كانت تُنقَض في كل
 * تشغيل، ولا شيء يسجّل أنه حدث.
 *
 * محتوى الملفات الأربعة صار في `0092_register_first_episode_media.sql`. وما
 * يمنع عودة النمط بوابةٌ على مستوى المستودع لا هذا الملف:
 * `tools/ci/content-sql-outside-migrations.mjs` — لأن الملفات المخالفة كانت في
 * `tools/ops/` خارج حزمة الـWorker. وما يُفحَص هنا هو **شكل الترحيل نفسه**، وهو
 * شأن هذه الحزمة.
 */

const apiRoot = fileURLToPath(new URL('..', import.meta.url));

const migration = readFileSync(
  join(apiRoot, 'migrations', '0092_register_first_episode_media.sql'),
  'utf8',
);

test('every insert is guarded against a second application', () => {
  // ترحيلٌ يُطبَّق مرّتين على بيئتين مختلفتين: الإنتاج يحمل الصفوف أصلًا (شُغِّلت
  // بيدٍ)، والبناء من الصفر لا يحملها. فغير الحاصل على `OR IGNORE` يُفشل واحدة
  // من الحالتين.
  const inserts = [...migration.matchAll(/INSERT\s+(?:OR\s+\w+\s+)?INTO/gi)].map((m) => m[0]);
  assert.ok(inserts.length > 0, 'the migration must insert something');
  for (const insert of inserts) {
    assert.match(insert, /OR IGNORE/i, `every INSERT must be OR IGNORE, found: ${insert}`);
  }
});

test('asset links are guarded by the existence of both sides', () => {
  // وإلّا أوقف انتهاكُ مفتاحٍ أجنبي بناءَ قاعدةٍ من الصفر — وهي العلّة نفسها التي
  // أوقفها `0074` وكلّفت المستودع 18 ترحيلًا لم يُطبَّق (`DB-104`).
  assert.match(migration, /WHERE EXISTS \(SELECT 1 FROM episodes WHERE id = '/);
  assert.match(migration, /AND EXISTS \(SELECT 1 FROM content_assets WHERE id = '/);
});

test('the migration does not invent a video asset row', () => {
  // الفجوة قائمة: لا شيء في المستودع يُنشئ `ca-episode-*-1080p` ولا صفوف
  // `episode_renditions`، فلا حلقة قابلة للتشغيل في قاعدةٍ مبنيّة من الصفر.
  // وهي **مُعلَنة** في `migrations/LEDGER.md` لا مُرقَّعة بصفٍّ مُختلق: صفُّ فيديو
  // يشير إلى ملفٍ غير موجود في R2 يُنتج حلقةً تبدو قابلة للتشغيل وتفشل عند الطفل.
  assert.doesNotMatch(
    migration,
    /INSERT\s+(?:OR\s+\w+\s+)?INTO content_assets[\s\S]{0,400}?'video'/i,
    'the migration must not invent a video asset row; that gap is declared in LEDGER.md',
  );

  const ledger = readFileSync(join(apiRoot, 'migrations', 'LEDGER.md'), 'utf8');
  // إعلانٌ في السجلّ هو ما يجعل الفجوة قرارًا لا سهوًا. وحرسه هنا يمنع حذفه بهدوء.
  assert.match(ledger, /0092_register_first_episode_media/);
  assert.match(ledger, /episode_renditions/);
});
