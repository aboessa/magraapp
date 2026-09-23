import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// `DB-106` — لا مرجعَ جديدًا إلى `parents`.
///
/// ## الحادثة التي أنشأت هذا الحرس
///
/// هذا الحرس وُلد من **خطأ في إصلاح**، لا من عطلٍ في كودٍ قديم. فـ`0090` أسقط
/// المراجع الميتة إلى `children_profiles`، وأبقى `REFERENCES parents(id)` على
/// `analytics_events` و`notifications`، وكتب في تعليله: «`parents` جدول حيّ».
///
/// والتعليل استنتاجٌ لا قياس: الجدول مذكور في الترحيلات ومقروء في الكود، فبدا
/// حيًّا. وعدّ الصفوف على الإنتاج: `parents` = **0**، بينما `family_projection` = 2
/// و`child_projection` = 21. ولا `INSERT INTO parents` في المصدر كلّه.
///
/// والبرهان قاطع: إدراجان في `analytics_events` لا يختلفان إلا في `parent_id` —
/// بمعرّف أب حقيقي رُفض بـ`SQLITE_CONSTRAINT_FOREIGNKEY [7500]`، وبـ`NULL` نجح.
///
/// ## ولماذا حرسٌ لا تعليق
///
/// لأن الاختبار الأول **ثبَّت الخطأ**: كان `deadChildProfileFks.test.mjs` يشترط
/// بقاء `REFERENCES parents(id)` ويسمّيه «مرجعًا حيًّا». أي أن حرسًا مبنيًّا على
/// افتراض غير مقيس يُحوّل الافتراض إلى شرطٍ يُدافع عن نفسه. صُحِّح ذلك الاختبار،
/// وهذا الحرس بديله المبني على القياس.
///
/// ## الأثر الذي كان صامتًا
///
/// خلافًا لـ`child_settings` (500 مرئيّ)، لم يظهر هذا العطل لأحد:
/// `postAnalyticsEvent` في `majarra_api_client.dart` يلفّ النداء بـ
/// `catch (_) { return {'success': false} }`، فيُرمى كل حدث لمستخدم **مُسجَّل**
/// بلا أثر. والأحداث المجهولة تُكتب بنجاح لأن `parent_id` فيها `NULL` عن قصد.
/// فالمقياس يفقد المسجّلين وحدهم — وهو أسوأ من انقطاع كامل لأنه لا يُلاحَظ.
///
/// ## ما هو مسموح
///
/// الترحيلات حتى `0091` تاريخٌ لا يُعاد كتابته (قاعدة `LEDGER.md` الصريحة)، فهي
/// مستثناة: هي التي أنشأت المراجع ثمّ أسقطتها. المفحوص ما **يُضاف بعدها**.

const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url));

/// الترحيل الذي أسقط المراجع الميتة إلى `parents`. ما بعده هو المفحوص.
const FIX_MIGRATION = 91;

/// الجداول التي أصلحها `0091`، مع كاتبها الحيّ في D1.
///
/// أحد عشر جدولًا يشير إلى `parents`؛ هذان وحدهما يُكتبان من كود حيّ في D1.
/// و`playback_leases` كتابته على `state.storage.sql` (تخزين الكائن الدائم)،
/// و`parental_consents` مهجور بقرار موثَّق في `FamilyState.ts:507`، والبقية صفر
/// صفًّا بلا `INSERT` في `src/`.
const FIXED_TABLES = ['analytics_events', 'notifications'];

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

/// يُقشّر التعليقات سطرًا سطرًا قبل الفحص.
///
/// بلا هذا يرصد الحرس **الشرح** لا المخطَّط: `0091` نفسه يشرح لماذا أُسقط المرجع،
/// فيذكر `REFERENCES parents(id)` بالضرورة. وهو نفس الفخّ الموسوم في
/// `deadTables.test.mjs`.
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

function migrationNumber(name) {
  return Number.parseInt(name.slice(0, 4), 10);
}

function fixSql() {
  return stripComments(readFileSync(migrationsDir + '0091_drop_dead_parents_fks.sql', 'utf8'));
}

/* ------------------------------------------------- لا مرجع جديد إلى الجدول الميت */

test('لا ترحيل بعد 0091 يُعلن `REFERENCES parents`', () => {
  const offenders = [];
  for (const name of files) {
    if (migrationNumber(name) <= FIX_MIGRATION) continue;
    const sql = stripComments(readFileSync(migrationsDir + name, 'utf8'));
    if (/REFERENCES\s+parents\s*\(/i.test(sql)) offenders.push(name);
  }

  assert.deepEqual(
    offenders,
    [],
    'مرجعٌ إلى `parents` — وهو جدول صفر صفًّا بلا كاتب، فكل إدراج يشير إليه '
      + 'بمعرّف أب حقيقي يفشل بـ`SQLITE_CONSTRAINT_FOREIGNKEY`. سلطة الحقيقة '
      + '`family_projection`، والنسبة تُؤخذ من الرمز المُوثَّق لا من جسم الطلب:\n  '
      + offenders.join('\n  '),
  );
});

test('لا ترحيل بعد 0091 يُدرج في `parents`', () => {
  // لأن المخرج الآخر من العطل إحياء الجدول بكاتب جديد، وذلك يُنشئ مصدر حقيقة
  // ثانيًا: حساب وليّ الأمر يسكن الكائن الدائم، وإسقاطه `family_projection`.
  const offenders = [];
  for (const name of files) {
    if (migrationNumber(name) <= FIX_MIGRATION) continue;
    const sql = stripComments(readFileSync(migrationsDir + name, 'utf8'));
    if (/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+parents\b/i.test(sql)) offenders.push(name);
  }

  assert.deepEqual(offenders, [], 'إحياء `parents` بكاتب جديد يُنشئ مصدر حقيقة ثانيًا');
});

/* ------------------------------------------- الإصلاح نفسه مُثبَّت لا يُنقَض بصمت */

test('`0091` يُعيد بناء الجدولين بلا مرجع ميت', () => {
  const sql = fixSql();

  assert.doesNotMatch(
    sql,
    /REFERENCES\s+parents\s*\(/i,
    'الترحيل الذي يُسقط المرجع لا يجوز أن يُعلنه',
  );

  for (const table of FIXED_TABLES) {
    assert.match(
      sql,
      new RegExp(`CREATE TABLE ${table}\\b`),
      `${table} يُكتب من كود حيّ في D1 ويجب أن يُعاد بناؤه هنا`,
    );
  }
});

test('`0091` لا يمسّ الجداول المكتوبة في تخزين الكائن الدائم', () => {
  // الإصلاح مقصور على ما يُكتب في D1. و`playback_leases` كتابته في
  // `FamilyState:3287` على `state.storage.sql`، فإعادة بنائها في D1 عملٌ لا
  // يُصلح عطلًا — ويُوسّع نطاق ترحيلٍ على الإنتاج بلا مقابل.
  const sql = fixSql();
  for (const table of ['playback_leases', 'attempts', 'mastery', 'favorites']) {
    assert.doesNotMatch(
      sql,
      new RegExp(`\\b${table}\\b`),
      `${table} كتابته في تخزين الكائن الدائم لا D1، فلا يُمَسّ هنا`,
    );
  }
});

test('`0091` يُبقي عمودَي النسبة موجودَين', () => {
  // الإصلاح إسقاط **قيد** لا إسقاط عمود: `analyticsIngest.ts:200` و
  // `notifications.ts:70` يُدرجان `parent_id`، فحذف العمود يحوّل العطل من
  // فشل مفتاح إلى فشل «لا عمود بهذا الاسم».
  const sql = fixSql();
  const matches = sql.match(/^\s*parent_id TEXT,\s*$/gm) ?? [];
  assert.equal(matches.length, 2, '`parent_id` يبقى عمودًا حرًّا في الجدولين');
});

test('فهارس الجدولين المُعاد بناؤهما مُعاد إنشاؤها', () => {
  // `DROP TABLE` يُسقط فهارسها معه بصمت. وفهرسٌ مفقود لا يُفشل استعلامًا —
  // يُبطّئه فقط، فلا يظهر في اختبار وظيفي.
  const sql = fixSql();
  for (const index of [
    'idx_analytics_parent',
    'idx_analytics_child',
    'idx_analytics_name',
    'idx_notifications_parent',
    'idx_notifications_child',
  ]) {
    assert.match(sql, new RegExp(`CREATE INDEX ${index}\\b`), `${index} مفقود بعد إعادة البناء`);
  }
});
