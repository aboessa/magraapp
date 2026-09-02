import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/// `DB-102` — الجداول التي انتقلت ملكيّتها إلى الكائنات الدائمة لا تُقرأ من D1.
///
/// ## العلّة
///
/// `0010_cleanup_dead_d1_tables.sql` أعلن سبعة جداول ميتة، وقال إنها «تُبقى
/// كـno-op … وسيتم إسقاطها في 0011 بعد التأكد». لم يحدث ذلك: نحن عند `0089`.
/// وبقاؤها بلا وسمٍ نافذ أنتج ما توقّعه البند نصًّا — «مطوّر يكتب استعلامًا على
/// جدول لا يُكتب أبدًا، فيحصل على نتيجة فارغة **بلا خطأ**».
///
/// وقد وقع فعلًا: `account_devices` كان مقروءًا في **ثلاثة** مسارات إدارية،
/// و`google_play_purchases` في واحد. فكانت لوحة الإدارة تعرض «صفر أجهزة» لكل
/// أسرة وقائمة أجهزة فارغة للمنصّة كلّها. (الدفعة 65)
///
/// ## ولماذا حرسٌ لا تعليق
///
/// المعيار الأوّل في البند يقبل «تُسقَط بترحيل، **أو** تُوسَم بتعليق لا يمكن
/// تفويته». والإسقاط في الإنتاج يمحو صفوفًا قد تكون موجودة من قبل انتقال
/// الملكية، ولا أعرف حالة الإنتاج. والتعليق **يمكن تفويته** — والدليل أن
/// `0010` نفسه تعليقٌ فُوِّت أربعة أعوام من الترحيلات. فالحرس هو الوسم الذي لا
/// يُفوَّت: من يكتب الاستعلام يرى الفشل في نفس الدقيقة.
///
/// ## ما هو مسموح
///
/// الأسماء نفسها تعيش في مخطَّط `FamilyState` الداخلي (`playback_leases`
/// و`used_refresh_tokens` هناك **مالكها الشرعي**)، فملفات `src/do/` مستثناة.
/// والترحيلات مستثناة لأنها التاريخ الذي أنشأ الجداول ولا يُعاد كتابته.

const root = fileURLToPath(new URL('../src', import.meta.url));

/// الجداول السبعة كما أعلنها `0010_cleanup_dead_d1_tables.sql`.
const DEAD = [
  'account_devices',
  'parent_credentials',
  'parent_auth_sessions',
  'google_play_purchases',
  'subscription_entitlements',
  'playback_leases',
  'used_refresh_tokens',
];

/// الملفات التي تملك هذه الأسماء بحقّ: مخطَّط الكائن الدائم نفسه.
const OWNED_BY_DURABLE_OBJECT = /[\\/]do[\\/]/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

/// يُسقط التعليقات قبل الفحص.
///
/// بلا هذا يرصد الحرس **الشرح** لا الاستعلام: ملفات هذه الدفعة تشرح لماذا لا
/// تُقرأ هذه الجداول، فتذكرُ أسماءها بالضرورة. وهذا الفخّ تكرّر في هذا الأودت
/// سبع مرّات، ووقعتُ فيه في الدفعتين 62 و63.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('///'))
    .join('\n');
}

test('لا استعلام D1 على جدول ميت خارج مخطَّط الكائن الدائم', () => {
  const offenders = [];
  for (const path of walk(root)) {
    if (OWNED_BY_DURABLE_OBJECT.test(path)) continue;
    const code = stripComments(readFileSync(path, 'utf8'));
    for (const table of DEAD) {
      // الشكل المفحوص هو **الاستعلام** لا مجرّد ذكر الاسم: `FROM x` أو
      // `JOIN x` أو `INTO x` أو `UPDATE x`.
      const query = new RegExp(`(FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`, 'i');
      if (query.test(code)) {
        offenders.push(`${path.slice(root.length + 1)} → ${table}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'جدول ميت (0010_cleanup_dead_d1_tables.sql) يُستعلَم من D1. السلطة في '
      + 'الكائن الدائم؛ أعلِن عدم التوفّر بدل إعادة صفرٍ أو قائمةٍ فارغة:\n  '
      + offenders.join('\n  '),
  );
});

test('الجداول السبعة هي ما أعلنه الترحيل، لا قائمة يدوية تنحرف', () => {
  // القائمة أعلاه ليست اختيارًا: مصدرها سطرٌ في `0010`. ولو أُضيف جدول ميت
  // هناك ولم يُضَف هنا، لصار الحرس ناقصًا بصمت.
  const migration = readFileSync(
    fileURLToPath(new URL('../migrations/0010_cleanup_dead_d1_tables.sql', import.meta.url)),
    'utf8',
  );
  for (const table of DEAD) {
    assert.match(
      migration,
      new RegExp(table),
      `${table} يجب أن يبقى مذكورًا في الترحيل الذي أعلن موته`,
    );
  }
  // والعكس: كل اسم جدول في سطر الإعلان مُدرَجٌ هنا.
  const declared = (migration.match(/^-- ([a-z_]+(?:, [a-z_]+)+)$/m)?.[1] ?? '')
    .split(', ')
    .filter(Boolean);
  assert.deepEqual(
    [...declared].sort(),
    [...DEAD].sort(),
    'قائمة الحرس تخالف ما أعلنه الترحيل',
  );
});
