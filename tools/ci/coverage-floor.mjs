#!/usr/bin/env node
/**
 * حدٌّ أدنى مُعلَن للتغطية لا ينخفض (`QA-103`).
 *
 * ## لماذا حدٌّ ولا تقرير
 *
 * تقرير تغطية بلا حدّ يُقرأ مرّةً ثم يُنسى، ونسبته تنزل تغييرًا بعد تغيير بلا أن
 * يلاحظ أحد. والحدّ هو ما يجعل الرقم **قرارًا** لا ملاحظة.
 *
 * ## ولماذا الحدّ مقيسٌ لا مُختار
 *
 * حدٌّ أعلى من الواقع يُفشل كل جولة، فيُطفَأ أو يُخفَّض — وهو الدرس الذي تكرّر في هذا
 * الأودت: حرسٌ يصرخ بالباطل يُطفَأ. وحدٌّ صفريّ يحرس لا شيء. فالأرقام في
 * `COVERAGE_FLOORS` **مقاسة عند إدخالها**، مقرَّبةً للأسفل، ومكتوبٌ بجانبها تاريخُ
 * قياسها. ورفعُها فعلٌ مقصود بعد تحسين التغطية، لا شيء يحدث تلقائيًّا.
 *
 * ## ما لا يفعله
 *
 * لا يقيس جودة الاختبار. سطرٌ يُنفَّذ ليس سطرًا مُتحقَّقًا منه، والتغطية العالية مع
 * تأكيداتٍ ضعيفة أسوأ من تغطيةٍ متوسّطة مع تأكيداتٍ دقيقة. فهو حرسٌ على الانحدار
 * فقط: «لا تنزل عمّا وصلتَ إليه».
 *
 * التشغيل: `node tools/ci/coverage-floor.mjs <lcov path> <key>`
 *          `node tools/ci/coverage-floor.mjs --self-test`
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * النسبة الدنيا المسموح بها لكل هدف، ومتى قِيست.
 *
 * `flutter`: خطوط `lib/**` كما يكتبها `flutter test --coverage`.
 */
export const COVERAGE_FLOORS = {
  /**
   * مقيس 2026-08-29 على 689 اختبارًا: **31.92%** من 28,834 سطرًا في 193 ملفًا.
   *
   * والحدّ 31 لا 31.92: هامشٌ ضيّق للتغيّر الطبيعي، ويظلّ يرصد انخفاضًا حقيقيًّا.
   *
   * `minFiles` ليس زينة. `lcov` لا يذكر إلا الملفات التي **حمّلها** اختبار (193 من
   * 203 في `lib/`)، فنسبةٌ تُحسَب على ما حُمِّل ترتفع إن توقّف اختبارٌ عن استيراد
   * ملفٍ كبيرٍ ضعيف التغطية — أي أن الرقم يتحسّن والتغطية الحقيقية تنخفض. فحرسُ
   * النسبة وحده كان سيُصفِّق لذلك الانحدار.
   */
  flutter: { floor: 31, minFiles: 190, measuredAt: '2026-08-29', label: 'app_main/lib' },
};

/// يحسب تغطية الخطوط من ملف lcov: مجموع `LH` على مجموع `LF`.
///
/// المجموع على الملفات كلّها لا متوسّط النسب: المتوسّط يمنح ملفًا من عشرة أسطر نفس
/// وزن ملفٍ من ألف، فيتحسّن الرقم بإضافة ملفات صغيرة مغطّاة.
export function coverageFromLcov(text) {
  let found = 0;
  let hit = 0;
  let files = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('LF:')) { found += Number(line.slice(3)) || 0; files += 1; }
    else if (line.startsWith('LH:')) { hit += Number(line.slice(3)) || 0; }
  }
  return { found, hit, files, percent: found === 0 ? null : (hit / found) * 100 };
}

function selfTest() {
  const sample = [
    'SF:lib/a.dart', 'DA:1,1', 'LF:10', 'LH:5', 'end_of_record',
    'SF:lib/b.dart', 'LF:90', 'LH:45', 'end_of_record',
  ].join('\n');
  const result = coverageFromLcov(sample);
  assert(result.files === 2, `files: ${result.files}`);
  assert(result.found === 100, `found: ${result.found}`);
  assert(result.hit === 50, `hit: ${result.hit}`);
  assert(result.percent === 50, `percent: ${result.percent}`);

  // المجموع لا المتوسّط: لو كان متوسّطًا لأعطى الملفان 50% أيضًا هنا، فتُختار
  // حالة تفرّق بينهما.
  const skewed = [
    'SF:lib/tiny.dart', 'LF:2', 'LH:2', 'end_of_record',
    'SF:lib/big.dart', 'LF:98', 'LH:0', 'end_of_record',
  ].join('\n');
  const skewedResult = coverageFromLcov(skewed);
  assert(skewedResult.percent === 2, `weighted percent must be 2, got ${skewedResult.percent}`);

  // ملفٌ بلا أسطر قابلة للتنفيذ لا يجعل النسبة صفرًا ولا 100: لا شيء يُقاس.
  const empty = coverageFromLcov('SF:lib/x.dart\nLF:0\nLH:0\nend_of_record');
  assert(empty.percent === null, `an empty report must not claim a percentage, got ${empty.percent}`);

  console.log('coverage-floor self-test: ok');
}

function assert(condition, message) {
  if (!condition) { console.error(`self-test failed: ${message}`); process.exit(1); }
}

/// يُشغَّل السطر الأمريّ حين يكون هذا الملف نقطة الدخول فقط.
///
/// بلا هذا الشرط كان `import` منه يُنفّذ الفحص فورًا ويُنهي العملية — فلم يكن قابلًا
/// للاختبار أصلًا. وسكربتُ CI بلا اختبار هو نمط الدفعة 42 نفسه: يبدو أنه يحرس.
const isEntryPoint = process.argv[1]
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (!isEntryPoint) {
  // مُستورَد: تُصدَّر الدوالّ ولا يُنفَّذ شيء.
} else if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  runCli();
}

function runCli() {
const [lcovPath, key] = process.argv.slice(2);
if (!lcovPath || !key) {
  console.error('usage: coverage-floor.mjs <lcov path> <key>   (keys: ' + Object.keys(COVERAGE_FLOORS).join(', ') + ')');
  process.exit(1);
}
const target = COVERAGE_FLOORS[key];
if (!target) { console.error(`unknown key "${key}"`); process.exit(1); }
if (!existsSync(lcovPath)) {
  // غياب التقرير ليس نجاحًا: خطوةٌ لم تُنتج تقريرًا تمرّ بلا قياس، وهو أسوأ من
  // انخفاض النسبة لأنه لا يُرى.
  console.error(`no coverage report at ${lcovPath} — the test step did not produce one`);
  process.exit(1);
}
const result = coverageFromLcov(readFileSync(lcovPath, 'utf8'));
if (result.percent === null) {
  console.error(`the report at ${lcovPath} contains no executable lines`);
  process.exit(1);
}
const percent = Math.round(result.percent * 100) / 100;
console.log(
  `${target.label}: ${percent}% of ${result.found} lines in ${result.files} files `
  + `(floor ${target.floor}%, measured ${target.measuredAt})`,
);
let failed = false;
if (percent + 1e-9 < target.floor) {
  console.error(
    `coverage fell below the declared floor: ${percent}% < ${target.floor}%.\n`
    + 'Either add tests for what you changed, or lower the floor deliberately in '
    + 'tools/ci/coverage-floor.mjs and say why in the commit.',
  );
  failed = true;
}
if (typeof target.minFiles === 'number' && result.files < target.minFiles) {
  // النسبة قد ترتفع بانخفاض التغطية الحقيقية: ملفٌ كبيرٌ ضعيف التغطية يخرج من
  // التقرير حين يتوقّف اختبارٌ عن استيراده. فيُحرَس العدد كما تُحرَس النسبة.
  console.error(
    `the report covers ${result.files} files, fewer than the declared ${target.minFiles}. `
    + 'A file that no test loads at all is absent from lcov, so the percentage can rise '
    + 'while real coverage falls.',
  );
  failed = true;
}
if (failed) process.exit(1);
}
