#!/usr/bin/env node
// حجم حزمة الإصدار المبنيّة، وحدٌّ خارجيّ لا مُختار (`PERF-101`، المعيار 2).
//
// الحدّ الافتراضي **200 ميغابايت** ليس رقمًا اخترتُه: هو العتبة التي تُظهر عندها
// Google Play للمستخدم على بيانات الجوّال حوارَ «هذا التطبيق كبير» عند التثبيت
// — https://support.google.com/googleplay/android-developer/answer/9859372
// (الصياغة أعيدت بإيجاز للامتثال لقيود الترخيص). أي أن تجاوزه أثرٌ ملموس على
// أهلٍ يثبّتون التطبيق لطفلهم، لا ذوقٌ هندسي.
//
// الاستعمال:
//   node tools/ci/aab-size.mjs [path/to/app.aab] [--max-mb=200]
//
// بلا مسار: يبحث في مواضع مخرجات Flutter المعتادة. وغيابُ الملف **فشل** لا
// تجاوُز: خطوةٌ تقيس شيئًا غير موجود وتُبلّغ نجاحًا أسوأ من غيابها.

import { existsSync, statSync } from 'node:fs';

const candidates = [
  'app_main/build/app/outputs/bundle/release/app-release.aab',
  'app_main/build/app/outputs/bundle/release/app.aab',
];

const explicit = process.argv
  .slice(2)
  .find((a) => !a.startsWith('--') && a.endsWith('.aab'));

const path = explicit ?? candidates.find((p) => existsSync(p));

if (!path || !existsSync(path)) {
  console.error(
    'لم يُعثَر على حزمة .aab. المواضع المفحوصة:\n  ' +
      candidates.join('\n  ') +
      '\nشغّل `flutter build appbundle --release` أوّلًا، أو مرّر المسار صريحًا.',
  );
  process.exit(1);
}

const flag = process.argv.find((a) => a.startsWith('--max-mb='));
const ceilingMB = flag ? Number(flag.split('=')[1]) : 200;

const bytes = statSync(path).size;
const mb = bytes / 1048576;

console.log(`الحزمة: ${path}`);
console.log(`الحجم: ${mb.toFixed(2)} MB · الحدّ: ${ceilingMB} MB`);

if (mb > ceilingMB) {
  console.error(
    `\nتجاوزت الحزمة ${ceilingMB} MB. فوق هذا الحدّ يرى المستخدم على بيانات ` +
      'الجوّال تحذيرًا بحجم التطبيق عند التثبيت من Google Play.',
  );
  process.exit(1);
}
