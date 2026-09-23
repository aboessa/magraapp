import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// `DB-105` — لا مرجعَ جديدًا إلى `children_profiles`.
///
/// ## الحادثة التي أنشأت هذا الحرس
///
/// `GET /api/v1/child-settings/:childId` كان يُرجع **500** لكل طفل في كل أسرة.
/// المعالِج سليم: يفحص الملكية في `child_projection`، ثمّ يُنشئ صفّ الإعدادات
/// بشكل بطيء بـ`INSERT INTO child_settings (child_id) VALUES (?)`. والإدراج يفشل
/// **دائمًا** لأن العمود كان `REFERENCES children_profiles(id)`، و`children_profiles`
/// فيه صفر صفًّا ولا كاتب له — بينما `child_projection` فيه ٢١.
///
/// أي أن القيد كان يمنع **الصحيح** ولا يمنع الخطأ: الملكية تُفحَص في المعالِج
/// بالأسرة والحالة، وهي بوابة أقوى من مجرّد وجود المعرّف.
///
/// وثلاثة جداول أخرى تحمل نفس العطل كامنًا (`analytics_events`, `notifications`,
/// `home_recommendations`) — يفشل أوّل إدراج يمرّر `child_id` غير فارغ. أصلحها
/// `0090_drop_dead_child_profile_fks.sql` جميعًا.
///
/// ## ولماذا حرسٌ لا تعليق
///
/// المرجع لا يبدو خطأً عند الكتابة: `REFERENCES children_profiles(id)` سطرٌ
/// مألوف، والجدول **موجود** فلا يفشل الإنشاء. العطل يظهر عند أوّل إدراج، في
/// الإنتاج، كـ500 مجهول. فالحرس هو الموضع الوحيد الذي يقوله في نفس الدقيقة.
///
/// ## ما هو مسموح
///
/// الترحيلات حتى `0090` **تاريخٌ لا يُعاد كتابته** (وهي قاعدة `LEDGER.md`
/// الصريحة)، فهي مستثناة: هي التي أنشأت المراجع ثمّ أسقطتها. المفحوص هو ما
/// **يُضاف بعدها**.

const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url));

/// الترحيل الذي أسقط المراجع الميتة. ما بعده هو المفحوص.
const FIX_MIGRATION = 90;

/// الجداول التي أصلحها `0090`، مع كاتبها الحيّ.
///
/// القائمة ليست اختيارًا: هذه هي الجداول التي **يُكتب فيها من كود حيّ** ويشير
/// مخطَّطها إلى `children_profiles`. وما عداها (`attempts`, `mastery`,
/// `favorites`, `playback_leases`) كتابته على تخزين الكائن الدائم لا D1.
const FIXED_TABLES = [
  'child_settings',
  'analytics_events',
  'notifications',
  'home_recommendations',
];

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

/// يُقشّر التعليقات سطرًا سطرًا قبل الفحص.
///
/// بلا هذا يرصد الحرس **الشرح** لا المخطَّط: `0090` نفسه يشرح لماذا أُسقط
/// المرجع، فيذكر `REFERENCES children_profiles(id)` بالضرورة. وهو نفس الفخّ
/// الموسوم في `deadTables.test.mjs`.
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

/* ------------------------------------------------- لا مرجع جديد إلى الجدول الميت */

test('لا ترحيل بعد 0090 يُعلن `REFERENCES children_profiles`', () => {
  const offenders = [];
  for (const name of files) {
    if (migrationNumber(name) <= FIX_MIGRATION) continue;
    const sql = stripComments(readFileSync(migrationsDir + name, 'utf8'));
    if (/REFERENCES\s+children_profiles\b/i.test(sql)) offenders.push(name);
  }

  assert.deepEqual(
    offenders,
    [],
    'مرجعٌ إلى `children_profiles` — وهو جدول صفر صفًّا بلا كاتب، فكل إدراج '
      + 'يشير إليه يفشل بـ`SQLITE_CONSTRAINT_FOREIGNKEY` ويصير 500. استخدم '
      + '`child_projection` بلا مفتاح أجنبي، وافحص الملكية في المعالِج:\n  '
      + offenders.join('\n  '),
  );
});

test('لا ترحيل بعد 0090 يُدرج في `children_profiles`', () => {
  // لأن المخرج الآخر من العطل هو إحياء الجدول بكاتب جديد. وذلك يُضاعف سلطة
  // الحقيقة: الأطفال في الكائن الدائم، وإسقاطهم `child_projection`.
  const offenders = [];
  for (const name of files) {
    if (migrationNumber(name) <= FIX_MIGRATION) continue;
    const sql = stripComments(readFileSync(migrationsDir + name, 'utf8'));
    if (/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+children_profiles\b/i.test(sql)) offenders.push(name);
  }

  assert.deepEqual(offenders, [], 'إحياء `children_profiles` بكاتب جديد يُنشئ مصدر حقيقة ثانيًا');
});

/* ------------------------------------------- الإصلاح نفسه مُثبَّت لا يُنقَض بصمت */

test('`0090` يُعيد بناء الجداول الأربعة بلا مرجع ميت', () => {
  const sql = stripComments(
    readFileSync(migrationsDir + '0090_drop_dead_child_profile_fks.sql', 'utf8'),
  );

  // المرجع الميت غائب عن المخطَّط الجديد كلّه.
  assert.doesNotMatch(
    sql,
    /REFERENCES\s+children_profiles\b/i,
    'الترحيل الذي يُسقط المرجع لا يجوز أن يُعلنه',
  );

  for (const table of FIXED_TABLES) {
    assert.match(
      sql,
      new RegExp(`\\b${table}\\b`),
      `${table} يُكتب من كود حيّ ويجب أن يُعاد بناؤه هنا`,
    );
  }
});

test('`0090` يُبقي المرجع الحيّ `series`', () => {
  // الإصلاح ليس «إسقاط كل مفتاح»: `series` جدول مزروع عامر، وقيده يمنع خطأً
  // حقيقيًّا. وإسقاطه معه يُحوّل إصلاحًا إلى تراجع في السلامة.
  //
  // وكان هذا الاختبار يشترط بقاء `REFERENCES parents(id)` كذلك، ويسمّيه «مرجعًا
  // حيًّا». وذلك **خطأ ثبَّته الاختبار**: `parents` صفر صفًّا بلا كاتب، فالمرجع
  // ميت مثل `children_profiles`. أسقطه `0091` وحرسُه `deadParentsFks.test.mjs`.
  // لا يُشترط هنا غيابه لأن `0090` تاريخٌ لا يُعاد كتابته.
  const sql = stripComments(
    readFileSync(migrationsDir + '0090_drop_dead_child_profile_fks.sql', 'utf8'),
  );
  assert.match(sql, /REFERENCES\s+series\(id\)/i, 'مرجع `series` يبقى');
});

test('`0090` ينقل صفوف `home_recommendations` ولا يزرعها', () => {
  // الجداول الثلاثة الأخرى صفر صفًّا، أمّا هذا ففيه صفوف تحريرية قائمة. وإعادة
  // زرعها تعني كتابة محتوى إنتاج في ترحيل بنية.
  const sql = stripComments(
    readFileSync(migrationsDir + '0090_drop_dead_child_profile_fks.sql', 'utf8'),
  );
  assert.match(
    sql,
    /INSERT\s+INTO\s+home_recommendations_new[\s\S]*?SELECT[\s\S]*?FROM\s+home_recommendations\b/i,
    'الصفوف تُنقل بـ`INSERT ... SELECT`',
  );
});

test('فهارس الجداول المُعاد بناؤها مُعاد إنشاؤها', () => {
  // `DROP TABLE` يُسقط فهارسها معه بصمت. وفهرسٌ مفقود لا يُفشل استعلامًا — يُبطّئه
  // فقط، فلا يظهر في اختبار وظيفي.
  const sql = stripComments(
    readFileSync(migrationsDir + '0090_drop_dead_child_profile_fks.sql', 'utf8'),
  );
  for (const index of [
    'idx_analytics_parent',
    'idx_analytics_child',
    'idx_analytics_name',
    'idx_notifications_parent',
    'idx_notifications_child',
    'idx_home_recs_child',
  ]) {
    assert.match(sql, new RegExp(`CREATE INDEX ${index}\\b`), `${index} مفقود بعد إعادة البناء`);
  }
});
