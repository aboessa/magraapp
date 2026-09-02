#!/usr/bin/env node
// نصوص عربية مُشوَّهة الترميز: قياسٌ ثم بوابة.
//
// ## العلّة
//
// نصٌّ عربي كُتب UTF-8 ثمّ قُرئ cp1252 وأُعيدت كتابته يصير رطانةً بدل «الصوت».
// وُجد ذلك في ترحيلة `0088_games_voice_assets.sql` — **150 صفّ `title_ar`** —
// وفي تعليقٍ عربي داخل `src/routes/adminTeams.ts`.
//
// والخطر متفاوت: في التعليق قبحٌ يعيق القراءة، وفي `title_ar` **بيانٌ يُعرَض
// لطفل أو لمشغّل**. فالفحص يفرّق بين الاثنين ولا يسوّي بينهما.
//
// ## كيف يُكتشَف
//
// بايتات العربية في UTF-8 تبدأ بـ`D8` أو `D9`، فتظهر بعد التشويه محرفًا
// يتبعه محرفٌ في المدى `U+0080..U+00BF`. وهذا التتالي **لا يقع** في نصٍّ سليم —
// لا عربيًّا ولا إنجليزيًّا — فالكاشف دقيق ولا يحتاج قائمة كلمات.
//
// الاستعمال:
//   node tools/ci/mojibake-scan.mjs [--check]

import { readdirSync, readFileSync } from 'node:fs';
import { join, extname, sep } from 'node:path';

/// التتالي الذي لا يقع في نصٍّ سليم.
const MOJIBAKE = /[\u00D8\u00D9][\u0080-\u00BF]/;

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.wrangler', 'build', 'dist', '.dart_tool',
  '_backups', '_archive', '.backups', '.tmp_covers', 'coverage', 'ios', 'android',
]);

/// الامتدادات المفحوصة. المُستثنى مقصود: الصور والصوت ثنائية.
const EXTENSIONS = new Set([
  '.ts', '.tsx', '.dart', '.mjs', '.js', '.sql', '.json', '.md', '.yaml', '.yml', '.arb',
]);

/// ملفاتٌ تحمل التشويه **كموضوعٍ لها**: تشرحه أو تكشفه.
///
/// استثناءٌ ضيّق ومُعلَن: بلا هذا يرصد الفحص **نفسه** وشرحَه في الأودت، وهو
/// الفخّ الذي تكرّر في هذا الأودت سبع مرّات.
const ABOUT_MOJIBAKE = [
  'tools/ci/mojibake-scan.mjs',
  'dashboard/api/test/mojibake.test.mjs',
  'AUDIT_FULL_2026.md',
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (EXTENSIONS.has(extname(entry.name))) out.push(path);
  }
  return out;
}

/// يفرّق بين تشويهٍ في تعليق وتشويهٍ في بيانٍ أو نصٍّ يُعرَض.
///
/// التمييز تقريبيّ ومُعلَن: سطرٌ يبدأ بعلامة تعليق يُحسب تعليقًا، وما عداه
/// **بيانًا**. والخطأ في هذا الاتجاه يُبلّغ عن قبحٍ زائد، وفي الاتجاه الآخر
/// يُسكت عن نصٍّ يراه طفل.
function isComment(line) {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//')
    || trimmed.startsWith('#')
    || trimmed.startsWith('*')
    // `/*` أُضيف بعد إيجابيةٍ كاذبة مقيسة: عنوانُ قسمٍ عربي في
    // `front/src/types/api.ts` كان يُحسب «بيانًا» لأن سطره يبدأ بـ`/*` لا `*`،
    // فأبلغ عن 34 سطرًا لا يراها مستخدم.
    || trimmed.startsWith('/*')
    || trimmed.startsWith('--')
    || trimmed.startsWith('>');
}

const root = process.cwd();
const findings = [];

for (const path of walk(root)) {
  const rel = path.slice(root.length + 1).split(sep).join('/');
  if (ABOUT_MOJIBAKE.includes(rel)) continue;
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  if (!MOJIBAKE.test(text)) continue;

  let comments = 0;
  let data = 0;
  let firstDataLine = 0;
  text.split(/\r?\n/).forEach((line, index) => {
    if (!MOJIBAKE.test(line)) return;
    if (isComment(line)) comments++;
    else {
      data++;
      if (!firstDataLine) firstDataLine = index + 1;
    }
  });
  findings.push({ rel, comments, data, firstDataLine });
}

const withData = findings.filter((f) => f.data > 0);
const commentsOnly = findings.filter((f) => f.data === 0);

console.log(`ملفات فيها تشويه: ${findings.length}`);
console.log(`  منها في بيانات أو نصوص تُعرَض: ${withData.length}`);
console.log(`  منها في تعليقات فقط: ${commentsOnly.length}`);

if (withData.length) {
  console.log('\nتشويه في بيانات (الأخطر — يُعرَض لمستخدم):');
  for (const f of withData.sort((a, b) => b.data - a.data)) {
    console.log(`  ${String(f.data).padStart(5)} سطرًا  ${f.rel}:${f.firstDataLine}`);
  }
}
if (commentsOnly.length) {
  console.log('\nتشويه في تعليقات فقط (يعيق القراءة ولا يُعرَض):');
  for (const f of commentsOnly.sort((a, b) => b.comments - a.comments)) {
    console.log(`  ${String(f.comments).padStart(5)} سطرًا  ${f.rel}`);
  }
}

/// الدَّين المُجمَّد: ملفٌ → عدد أسطر التشويه في بياناته، كما قيس في 2026-08-31.
///
/// ## لماذا خطٌّ أساسٍ لا صفر
///
/// التشويه القائم **مزدوج**: قياسُ فكّه أعطى 1097 محرف إبدال في ترحيلة `0088`،
/// و«استعادةَ» 37% من مقاطع الملفات الأخرى ورفضَ الباقي. وترقيعُ 37% يُنتج ملفًا
/// نصفَ صحيح — أسوأ من مشوَّهٍ معروف. فالصحيح **إعادة توليده من مصدره**، وهو فعل
/// مالك (`HUMAN-112`).
///
/// فالبوابة تُجمّد الدَّين ولا تسمح بنموّه: ملفٌ جديد أو عددٌ أكبر يُفشل الجولة.
/// وخفضُ العدد يتطلّب خفضَ الرقم هنا — فلا يبقى خطُّ الأساس أكبر من الواقع
/// بصمت.
///
/// وقد خُفِض `adminUsers.ts` من **26 إلى صفر** في الدفعة 67: كانت رسائل خطأ
/// **يراها مشغّل**، ونصوصها كُتبت يدويًّا بعد تأكيد معناها من الفكّ الجزئي ومن
/// سياق الشرط الذي يُطلقها.
const BASELINE = {
  'dashboard/api/migrations/0088_games_voice_assets.sql': 150,
  'KIRO_REPORT_HISTORY.md': 97,
  'dashboard/api/scripts/seed-demo-family.mjs': 3,
  'dashboard/api/scripts/fix-arabic-names.mjs': 2,
  'dashboard/api/scripts/fix-avatars.mjs': 2,
  'dashboard/api/scripts/_audit_gen_sql.mjs': 1,
  'dashboard/api/_audit_apply.sql': 1,
};

if (process.argv.includes('--check')) {
  const regressions = [];
  for (const f of withData) {
    const allowed = BASELINE[f.rel];
    if (allowed === undefined) {
      regressions.push(`${f.rel}: ملفٌ جديد فيه ${f.data} سطرًا`);
    } else if (f.data > allowed) {
      regressions.push(`${f.rel}: ${f.data} سطرًا، وخطّ الأساس ${allowed}`);
    }
  }
  const improved = Object.entries(BASELINE).filter(
    ([rel, allowed]) => (withData.find((f) => f.rel === rel)?.data ?? 0) < allowed,
  );

  if (regressions.length) {
    console.error('\nتشويه جديد في بيانات — وهذا يُعرَض لطفل أو لمشغّل:');
    for (const line of regressions) console.error(`  ${line}`);
    console.error(
      '\nأعِد توليد الملف من مصدره بترميز UTF-8 صحيح. ولا تُصلحه بفكّ ترميز '
      + 'مُخمَّن: التشويه القائم مزدوج، وجولةٌ واحدة تُنتج ملفًا نصفَ صحيح.',
    );
    process.exit(1);
  }
  if (improved.length) {
    console.error('\nتحسّنٌ غير مُسجَّل — اخفض خطّ الأساس ليطابق الواقع:');
    for (const [rel, allowed] of improved) {
      const now = withData.find((f) => f.rel === rel)?.data ?? 0;
      console.error(`  ${rel}: ${allowed} → ${now}`);
    }
    process.exit(1);
  }
  console.log('\nلا تشويه جديد في بيانات.');
}
