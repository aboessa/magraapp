import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COVERAGE_FLOORS, coverageFromLcov } from '../../../tools/ci/coverage-floor.mjs';

/**
 * حرس التغطية نفسه محروس (`QA-103`).
 *
 * ## لماذا
 *
 * الدفعة 42 وجدت مولِّدًا كُتب لمنع التقادم **فتقادم هو** لأن `--check` فيه لم
 * يُشغَّل. فسكربت CI بلا اختبار هو نفس النمط: يبدو أنه يحرس. وهذه المجموعة تحرسه
 * بحسابه لا بقراءة نصّه.
 *
 * ## وما تحرسه بالأخصّ
 *
 * أن النسبة **مرجَّحة بالأسطر** لا متوسّط نسبٍ (المتوسّط يمنح ملفًا من عشرة أسطر
 * وزن ملفٍ من ألف، فيتحسّن الرقم بإضافة ملفات صغيرة مغطّاة)، وأن تقريرًا بلا أسطر
 * قابلة للتنفيذ **لا يدّعي نسبة**، وأن الحدود مكتوبة بتاريخ قياسها.
 */

test('the percentage is weighted by lines, not an average of file percentages', () => {
  // ملفٌ صغير مغطّى تمامًا وملفٌ كبير بلا تغطية: المتوسّط 50% والحقيقة 2%.
  const skewed = [
    'SF:lib/tiny.dart', 'LF:2', 'LH:2', 'end_of_record',
    'SF:lib/big.dart', 'LF:98', 'LH:0', 'end_of_record',
  ].join('\n');
  assert.equal(coverageFromLcov(skewed).percent, 2);
});

test('a report with no executable lines claims no percentage', () => {
  // صفرٌ هنا كان سيُقرأ «لا تغطية»، و100 كان سيُقرأ «كاملة». الصادق `null`.
  assert.equal(coverageFromLcov('SF:lib/x.dart\nLF:0\nLH:0\nend_of_record').percent, null);
});

test('every declared floor records when it was measured', () => {
  // حدٌّ بلا تاريخ قياس يصير رقمًا مُختارًا بعد شهر، ولا أحد يعرف أصله.
  for (const [key, target] of Object.entries(COVERAGE_FLOORS)) {
    assert.match(String(target.measuredAt), /^\d{4}-\d{2}-\d{2}$/, `${key} has no measured date`);
    assert.equal(typeof target.floor, 'number', `${key} floor must be a number`);
    assert.ok(target.floor > 0, `${key}: a zero floor guards nothing`);
    assert.ok(target.floor <= 100, `${key}: a floor above 100 can never pass`);
  }
});

test('the floor guards the file count as well as the percentage', () => {
  // النسبة ترتفع بانخفاض التغطية الحقيقية: ملفٌ كبيرٌ ضعيف التغطية يخرج من التقرير
  // حين يتوقّف اختبارٌ عن استيراده، فـ`lcov` لا يذكره أصلًا.
  const flutter = COVERAGE_FLOORS.flutter;
  assert.equal(typeof flutter.minFiles, 'number');
  assert.ok(flutter.minFiles > 100, 'the file floor must be near the measured tree, not a token');
});

test('CI runs the guard, and runs it with coverage enabled', () => {
  // خطوةٌ تُنتج تقريرًا بلا حرس تُقرأ مرّة وتُنسى؛ وحرسٌ بلا تقرير يفشل دائمًا.
  const ci = readFileSync(fileURLToPath(new URL('../../../.github/workflows/ci.yml', import.meta.url)), 'utf8');
  assert.match(ci, /flutter test --no-pub --coverage/);
  assert.match(ci, /node tools\/ci\/coverage-floor\.mjs app_main\/coverage\/lcov\.info flutter/);
  // والفحص الذاتي قبله: حاسبٌ حسابه خاطئ يُبلّغ رقمًا مريحًا.
  assert.match(ci, /coverage-floor\.mjs --self-test/);
});
