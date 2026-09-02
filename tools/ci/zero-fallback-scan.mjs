#!/usr/bin/env node
// مقاييس تسقط إلى صفر عند غياب القيمة: قياسٌ ثم بوابة (`ADM-106`).
//
// ## العلّة
//
// `value ?? 0` يجعل ثلاث حالاتٍ مختلفة تُعرَض شكلًا واحدًا: «القيمة صفر»،
// و«لا بيانات بعد»، و«تعذّرت القراءة». والمشغّل يقرأ الثلاثة «لا مشاكل».
//
// وقد وقع هذا فعلًا لا احتمالًا: `/admin/ops/overview` كانت عدّاداته تبدأ من صفر
// وكل استعلام في `catch {}` فارغة، فقراءةٌ فاشلة تُشحَن صفرًا و`overall_health`
// يبقى `healthy` — سلامةٌ مُعلَنة على فشلٍ صامت.
//
// ## لماذا بوابةُ تجميدٍ لا منعٌ كامل
//
// أكثر الـ`?? 0` القائمة **صادقة**: الجدول له كاتب وصفره يعني «لم يفعلها أحد
// بعد». وسحبُها بالجملة يقلب العطل إلى ضدّه — شرطةٌ مكان صفرٍ حقيقي، وهي كذبة
// في الاتجاه المعاكس. فالتمييز يحتاج مرورًا موضعًا بموضع بقاعدةٍ مُعلَنة، وهو
// عملٌ مفتوح.
//
// وما تفعله هذه البوابة أضيق وأصدق: **تُجمّد العدد**. المقيس أن الرقم نما من 85
// في 2026-08-26 إلى 103 في 2026-09-02، أي أن كل مرور تصحيحيّ يسابق كتابةً جديدة.
// فأيّ موضعٍ جديد يُفشل الجولة، ويُطلب من كاتبه أن يقرّر: هل الصفر صادق هنا؟
//
// الاستعمال:
//   node tools/ci/zero-fallback-scan.mjs [--check] [--write-baseline] [--self-test]

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';

/// `?? 0` و`?? 0.0` بمسافاتٍ حرة. لا يرصد `|| 0` عن قصد: `||` يسقط على القيم
/// الزائفة كلّها فهو عطلٌ مختلف (صفرٌ حقيقي يصير صفرًا افتراضيًّا)، ويستحق بندًا
/// خاصًّا لا خلطًا في هذا العدّ.
const ZERO_FALLBACK = /\?\?\s*0(?:\.0+)?\b/g;

const ROOTS = ['dashboard/front/src/pages'];

function isComment(line) {
  const t = line.trimStart();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

export function countZeroFallbacks(text) {
  let total = 0;
  const lines = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (isComment(line)) return;
    const n = [...line.matchAll(ZERO_FALLBACK)].length;
    if (n > 0) {
      total += n;
      if (lines.length < 3) lines.push(index + 1);
    }
  });
  return { total, lines };
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
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

function selfTest() {
  const cases = [
    ['const n = data.count ?? 0;', 1, 'الشكل الأساسي'],
    ['const n = data.count ?? 0.0;', 1, 'عشريّ'],
    ['const n = data.count??0;', 1, 'بلا مسافات'],
    ['// const n = data.count ?? 0;', 0, 'تعليق لا يُحسب'],
    ['const n = a ?? 0, m = b ?? 0;', 2, 'موضعان في سطر'],
    ['const n = data.count ?? 1;', 0, 'افتراضٌ غير صفر لا يُحسب'],
    ['const n = data.count || 0;', 0, '`||` خارج النطاق بقرار'],
    ['const s = data.label ?? "0";', 0, 'نصّ «0» ليس رقمًا'],
  ];
  let failed = 0;
  for (const [src, expected, name] of cases) {
    const got = countZeroFallbacks(src).total;
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

const BASELINE_FILE = new URL('./zero-fallback-scan.baseline.json', import.meta.url);

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

const root = process.cwd();
const files = [];
for (const r of ROOTS) files.push(...walk(join(root, r)));

const findings = [];
let total = 0;
for (const path of files) {
  const rel = path.slice(root.length + 1).split(sep).join('/');
  const { total: n, lines } = countZeroFallbacks(readFileSync(path, 'utf8'));
  if (n > 0) {
    findings.push({ rel, n, lines });
    total += n;
  }
}
findings.sort((a, b) => b.n - a.n || a.rel.localeCompare(b.rel));

/// حرسُ الحرس: مجموعةٌ فارغة تمرّ دائمًا. هذا يمنع أن تمرّ البوابة لأن الجمع فشل
/// — وهو ما حدث فعلًا في هذا المشروع حين صار `tsc --noEmit` في اللوحة يفحص صفر
/// ملف بينما يُقرأ خضاره دليلًا.
if (files.length < 100) {
  console.error(
    `عدد الملفات المفحوصة ${files.length} — أقلّ من المعقول لصفحات اللوحة (118+). `
    + 'الجمع فشل، ولا تُقرأ نتيجة هذه الجولة.',
  );
  process.exit(1);
}

if (process.argv.includes('--write-baseline')) {
  const map = {};
  for (const f of findings) map[f.rel] = f.n;
  writeFileSync(BASELINE_FILE, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  console.log(`كُتب خطّ الأساس: ${findings.length} ملفًا · ${total} موضعًا`);
  process.exit(0);
}

console.log(`صفحات مفحوصة: ${files.length}`);
console.log(`صفحات فيها \`?? 0\`: ${findings.length}`);
console.log(`إجمالي المواضع: ${total}`);
console.log('\nأكثر عشر صفحات:');
for (const f of findings.slice(0, 10)) {
  console.log(`  ${String(f.n).padStart(4)}  ${f.rel}:${f.lines[0]}`);
}

if (process.argv.includes('--check')) {
  const BASELINE = readBaseline();
  if (!BASELINE || Object.keys(BASELINE).length === 0) {
    console.error(
      '\nلا خطّ أساس. شغّل `node tools/ci/zero-fallback-scan.mjs --write-baseline` أوّلًا.',
    );
    process.exit(1);
  }
  const regressions = [];
  for (const f of findings) {
    const allowed = BASELINE[f.rel];
    if (allowed === undefined) {
      regressions.push(`${f.rel}:${f.lines[0]}: صفحةٌ جديدة فيها ${f.n} موضعًا`);
    } else if (f.n > allowed) {
      regressions.push(`${f.rel}: ${f.n} موضعًا، وخطّ الأساس ${allowed}`);
    }
  }
  const improved = Object.entries(BASELINE).filter(
    ([rel, allowed]) => (findings.find((f) => f.rel === rel)?.n ?? 0) < allowed,
  );

  if (regressions.length) {
    console.error('\nمواضع `?? 0` جديدة. اسأل عن كلٍّ منها: هل الصفر هنا **صادق**؟');
    for (const line of regressions) console.error(`  ${line}`);
    console.error(
      '\nإن كان للجدول كاتبٌ فصفره قياسٌ صادق ويُسجَّل في خطّ الأساس. وإن كانت '
      + 'القراءة قد تفشل فالصفر كذبة: اعرض شرطةً وسببًا مُسمّى، لا صفرًا.',
    );
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
  console.log('\nلا مواضع `?? 0` جديدة.');
}
