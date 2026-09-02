#!/usr/bin/env node
// كل وثيقة في جذر المستودع مُصنَّفة، وكل وثيقة تاريخية تُعلن ذلك في رأسها
// (`DOCS-101`).
//
// ## العلّة
//
// 36 ملف `.md` في الجذر، أكثرها لقطاتٌ مؤرَّخة تصف حالةً انقضت. و`النواقص_
// المتبقية.md` (مراجعة 2026-08-15) لا تزال تقول «الكود لا يُبنى — P0» وتقدّر
// تطبيق Flutter بـ«20-25%» — والمقيس اليوم: `flutter analyze` نظيف و712 اختبارًا
// ناجحًا. فمن يقرأها يعيد إصلاح ما هو مُصلَح، أو يبني على أرقامٍ انقضت.
//
// ## ولماذا الرأس لا النقل
//
// البند اقترح نقل التقارير إلى `_archive/`. والمقيس: **304 مراجع داخلة** إلى
// خمسة عشر منها من ملفاتٍ أخرى في المستودع. فالنقل يستبدل «توثيقًا مُضلِّلًا»
// بـ«304 روابط مكسورة» — وهو تبادلٌ لا مكسب فيه. الرأس يحلّ الأثر المذكور
// (قارئٌ يصدّق لقطةً منقضية) بلا كسر شيء.
//
// الاستعمال:
//   node tools/ci/docs-classified.mjs [--check]

import { readFileSync, readdirSync, existsSync } from 'node:fs';

const INDEX = 'DOCS_INDEX.md';

/// الوسم الذي يجب أن يحمله رأس كل ملف تاريخي أو مُبطَل.
///
/// **وسمٌ لا نثر**: الفحص على `<!-- doc-status: ... -->` لا على عبارةٍ عربية.
/// حرسٌ على النثر يرصد الملف الذي **يشرح** التصنيف (كهذا الملف نفسه) ويمرّ على
/// ملفٍ نُسخ رأسه بلا معنى. وهذا الفخّ تكرّر في هذا الأودت سبع مرّات.
const marker = (status) => `<!-- doc-status: ${status} -->`;

const VALID = new Set(['source', 'historical', 'obsolete']);

/// يقرأ جدول التصنيف من `DOCS_INDEX.md`.
///
/// الصيغة المتوقَّعة لكل صفّ: `| \`FILE.md\` | status | ... |`
function classification() {
  if (!existsSync(INDEX)) {
    throw new Error(`${INDEX} غير موجود — وهو مصدر التصنيف`);
  }
  const map = new Map();
  for (const line of readFileSync(INDEX, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\|\s*`([^`]+\.md)`\s*\|\s*([a-z]+)\s*\|/);
    if (!m) continue;
    const [, file, status] = m;
    if (!VALID.has(status)) {
      throw new Error(`تصنيف غير معروف لـ${file}: ${status}`);
    }
    map.set(file, status);
  }
  return map;
}

const classified = classification();
// الفهرس نفسه مُصنَّف في جدوله (`source`)، فلا يُستثنى: استثناؤه يجعل حرسًا
// على «كل ملف مُصنَّف له ملف» يشكو من صفٍّ صحيح.
const present = readdirSync('.', { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.md'))
  .map((d) => d.name);

const unclassified = present.filter((f) => !classified.has(f));
const stale = [...classified.keys()].filter((f) => !present.includes(f));

/// الملفات التاريخية والمُبطَلة يجب أن تحمل الوسم في **أوّل** الملف.
///
/// «في أوّله» مقصود: وسمٌ في آخر ملفٍ من 122 كيلوبايت لا يراه من يقرأ العنوان
/// ويبدأ التنفيذ — وهو القارئ الذي يحمي منه هذا البند.
const missingMarker = [];
const head = (file) => readFileSync(file, 'utf8').slice(0, 400);
for (const [file, status] of classified) {
  if (status === 'source' || !present.includes(file)) continue;
  if (!head(file).includes(marker(status))) missingMarker.push(`${file} (${status})`);
}

const counts = { source: 0, historical: 0, obsolete: 0 };
for (const status of classified.values()) counts[status]++;

console.log(`وثائق الجذر: ${present.length}`);
console.log(
  `مُصنَّفة: ${classified.size} — مصدر حقيقة ${counts.source} · تاريخي ${counts.historical} · مُبطَل ${counts.obsolete}`,
);

let failed = false;
if (unclassified.length) {
  console.error(
    `\nوثائق في الجذر بلا تصنيف في ${INDEX}:\n  ${unclassified.join('\n  ')}`,
  );
  failed = true;
}
if (stale.length) {
  console.error(
    `\nمُصنَّفة في ${INDEX} ولا ملف لها:\n  ${stale.join('\n  ')}`,
  );
  failed = true;
}
if (missingMarker.length) {
  console.error(
    `\nملفات لا تُعلن حالتها في رأسها (يلزم ${marker('historical')}):\n  ${missingMarker.join('\n  ')}`,
  );
  failed = true;
}

if (process.argv.includes('--check') && failed) process.exit(1);
if (failed) process.exit(1);
