#!/usr/bin/env node
// نصوص عربية حرفية في كود Dart: قياسٌ ثم بوابة (`I18N-101`).
//
// ## العلّة
//
// التطبيق يُعلن ثلاث لغات، ومعظم نصوصه المعروضة **مكتوبة في الكود** لا في
// كتالوج الترجمة. فتغييرُ لغةٍ لا يغيّر ما يقرؤه الطفل، والمنتج أحادي اللغة
// عمليًّا مهما أُضيف من مفاتيح.
//
// وما يجعل البند غير قابل للإغلاق ليس حجمه بل **أنه ينمو**: قيس الأودت في
// 2026-08-26 عددًا، وبعد ستة أيام صار أكبر. أي أن الاستخراج يسابق كتابةً جديدة
// ويخسر. فهذه البوابة تُجمّد الرقم أوّلًا، ثم يصير الاستخراج تقدُّمًا لا لحاقًا.
//
// ## ما يُحسب حرفيًّا وما لا يُحسب
//
// يُحسب: نصٌّ عربي داخل علامتَي اقتباس في سطرٍ **ليس تعليقًا**.
//
// ولا يُحسب:
//   - التعليقات. هذا المشروع يكتب توثيقه بالعربية داخل الكود، وعدُّها يُنتج رقمًا
//     مضخَّمًا بلا معنى — قِستُه: يقارب ثلاثة أضعاف الحرفيّات الحقيقية.
//   - `test/`. اختبارٌ يؤكّد نصًّا معروضًا يحتاج ذلك النصّ حرفيًّا؛ ومنعُه يعني
//     اختبارات تؤكّد مفاتيح لا ما يراه المستخدم.
//   - `lib/l10n/`. هو كتالوج الترجمة نفسه.
//
// الاستعمال:
//   node tools/ci/dart-literal-strings.mjs [--check] [--self-test]

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';

/// نطاق المحارف العربية. يشمل الحركات وعلامات الترقيم العربية.
const ARABIC = /[\u0600-\u06FF]/;

/// نصٌّ بين علامتَي اقتباس (مفردة أو مزدوجة) فيه محرف عربي واحد على الأقل.
/// لا يتعامل مع النصوص متعددة الأسطر (''' و""") — تُعالَج بالسطر.
const LITERAL = /(['"])((?:(?!\1)[^\\]|\\.)*?[\u0600-\u06FF](?:(?!\1)[^\\]|\\.)*?)\1/g;

const ROOTS = ['app_main/lib'];

/// مسارات مستثناة بسببٍ مكتوب، لا بالراحة.
const SKIP_PATHS = [
  'app_main/lib/l10n/',
];

function isComment(line) {
  const t = line.trimStart();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/// يعدّ الحرفيّات العربية في ملف، متجاهلًا أسطر التعليقات.
export function countLiterals(text) {
  let total = 0;
  const samples = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (isComment(line)) return;
    for (const match of line.matchAll(LITERAL)) {
      total++;
      if (samples.length < 3) samples.push({ line: index + 1, text: match[2] });
    }
  });
  return { total, samples };
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith('.dart')) out.push(path);
  }
  return out;
}

function selfTest() {
  const cases = [
    ["const a = 'مرحبا';", 1, 'حرفيّة مفردة'],
    ['const a = "مرحبا";', 1, 'حرفيّة مزدوجة'],
    ["// تعليق فيه مرحبا", 0, 'تعليق سطري لا يُحسب'],
    [' * توثيق فيه مرحبا', 0, 'سطر توثيق لا يُحسب'],
    ["const a = 'hello';", 0, 'إنجليزية لا تُحسب'],
    ["Text('أهلًا'), Text('وسهلًا')", 2, 'حرفيّتان في سطر'],
    ["const a = 'assets/images/bird.png';", 0, 'مسار أصل لا يُحسب'],
    ["l10n.welcome", 0, 'نداء مفتاح لا يُحسب'],
    ["const a = 'قيمة \\'مُقتبَسة\\' داخلها';", 1, 'اقتباس مهروب داخل النصّ'],
  ];
  let failed = 0;
  for (const [src, expected, name] of cases) {
    const got = countLiterals(src).total;
    if (got !== expected) {
      console.error(`  ✗ ${name}: توقّعتُ ${expected} فجاء ${got} — ${src}`);
      failed++;
    }
  }
  if (failed) {
    console.error(`self-test: ${failed} من ${cases.length} فشلت`);
    process.exit(1);
  }
  console.log(`self-test: ${cases.length} حالة نجحت`);
}

/// الدَّين المُجمَّد يعيش في ملفٍ مجاور تكتبه الأداة بـ`--write-baseline`.
///
/// ## لماذا ملفٌ لا خريطةٌ في الكود
///
/// الخطّ 109 مدخلات ويتغيّر مع كل استخراج. خريطةٌ في الكود تعني تحريرًا يدويًّا
/// لمئة سطر عند كل تقدُّم، وهو ثمنٌ يجعل تجاهُلَ البوابة أرخص من إرضائها — فتُعطَّل
/// أو يُرفع رقمها بالجملة. والملفُّ يجعل التحديث أمرًا واحدًا، والـdiff يُظهر
/// الاتجاه: أرقامٌ تنزل لا تصعد.
///
/// ## لماذا خطُّ أساسٍ لكل ملف لا رقمٌ واحد
///
/// رقمٌ إجمالي يسمح بنقل الدَّين: تُستخرَج عشر حرفيّات من شاشةٍ وتُكتب عشرٌ
/// جديدة في أخرى، فيبقى المجموع ويبقى العطل. والخطُّ لكل ملف يجعل كل ملفٍ
/// يتحسّن أو يثبت، ولا يُموَّل تحسُّنٌ من تراجعٍ في مكانٍ آخر.
///
/// و`--check` يفشل أيضًا على **تحسُّنٍ غير مُسجَّل**، لأن خطًّا أكبر من الواقع
/// يسمح بعودة ما استُخرِج بصمت.
///
/// ## ما يقوله الرقم وما لا يقوله
///
/// ليس كل حرفيّة نصًّا معروضًا يحتاج ترجمة. المقيس: `local_catalog.dart` (208)
/// كتالوجٌ مبندل أي **بيانات محتوى**، و`arabic_search.dart` (34) جداول تطبيعٍ
/// عربية لا تُترجَم بطبيعتها. فالرقم سقفٌ للدَّين لا قائمةَ عملٍ مصنَّفة —
/// والتصنيف يأتي مع الاستخراج، لا قبله.
const BASELINE_FILE = new URL('./dart-literal-strings.baseline.json', import.meta.url);

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
  } catch {
    return null;
  }
}


const root = process.cwd();
const files = [];
for (const r of ROOTS) files.push(...walk(join(root, r)));

const findings = [];
let total = 0;
for (const path of files) {
  const rel = path.slice(root.length + 1).split(sep).join('/');
  if (SKIP_PATHS.some((p) => rel.startsWith(p))) continue;
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  const { total: n, samples } = countLiterals(text);
  if (n > 0) {
    findings.push({ rel, n, samples });
    total += n;
  }
}

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

findings.sort((a, b) => b.n - a.n || a.rel.localeCompare(b.rel));

/// يكتب خطّ الأساس من الواقع. وجودُه مقصود: خطٌّ يُحرَّر بيدٍ يتقادم، وتحديثه
/// بعد كل استخراج يجب أن يكون أرخص من تجاهله.
if (process.argv.includes('--write-baseline')) {
  const map = {};
  for (const f of findings) map[f.rel] = f.n;
  writeFileSync(BASELINE_FILE, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  console.log(`كُتب خطّ الأساس: ${findings.length} ملفًا · ${total} حرفيّة`);
  process.exit(0);
}

console.log(`ملفات Dart مفحوصة: ${files.length}`);
console.log(`ملفات فيها نصوص عربية حرفية: ${findings.length}`);
console.log(`إجمالي الحرفيّات: ${total}`);
console.log('\nأكثر عشرين ملفًا:');
for (const f of findings.slice(0, 20)) {
  console.log(`  ${String(f.n).padStart(5)}  ${f.rel}`);
}

if (process.argv.includes('--check')) {
  const BASELINE = readBaseline();
  if (!BASELINE || Object.keys(BASELINE).length === 0) {
    console.error(
      '\nلا خطّ أساس. شغّل `node tools/ci/dart-literal-strings.mjs --write-baseline` أوّلًا، '
      + 'وإلّا فالبوابة تقيس صفرًا من صفر وتمرّ دائمًا.',
    );
    process.exit(1);
  }
  const regressions = [];
  for (const f of findings) {
    const allowed = BASELINE[f.rel];
    if (allowed === undefined) {
      regressions.push(`${f.rel}: ملفٌ جديد فيه ${f.n} حرفيّة (أوّلها سطر ${f.samples[0].line})`);
    } else if (f.n > allowed) {
      regressions.push(`${f.rel}: ${f.n} حرفيّة، وخطّ الأساس ${allowed}`);
    }
  }
  const improved = Object.entries(BASELINE).filter(
    ([rel, allowed]) => (findings.find((f) => f.rel === rel)?.n ?? 0) < allowed,
  );

  if (regressions.length) {
    console.error('\nنصوص عربية حرفية جديدة — استخدم مفتاح ترجمة لا نصًّا في الكود:');
    for (const line of regressions) console.error(`  ${line}`);
    process.exit(1);
  }
  if (improved.length) {
    console.error('\nتحسّنٌ غير مُسجَّل — اخفض خطّ الأساس ليطابق الواقع:');
    for (const [rel, allowed] of improved) {
      const now = findings.find((f) => f.rel === rel)?.n ?? 0;
      console.error(`  ${rel}: ${allowed} → ${now}`);
    }
    process.exit(1);
  }
  console.log('\nلا نصوص عربية حرفية جديدة.');
}
