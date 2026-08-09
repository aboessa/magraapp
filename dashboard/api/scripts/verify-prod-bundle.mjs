/**
 * يتحقق أن كود بوابة الوضع وصفحات الحالة موجود فعلًا في الحزمة المنشورة.
 *
 * ## لماذا هذا الفحص وليس فحص متصفح
 *
 * طلب HTML من majarra.app يُعيد قوقعة SPA فقط (`<div id="root">`)، فلا يثبت
 * شيئًا عن العرض. والتحقق البصري الحقيقي يحتاج متصفحًا مُشغَّلًا آليًا وهو غير
 * متاح في هذه البيئة، فلا يصح ادّعاؤه.
 *
 * ما يمكن إثباته بصدق: أن حزمة JavaScript المنشورة تحتوي فعلًا نصوص صفحات
 * الحالة ونداء /site-mode وقواعد البوابة. وجود هذه البصمات يعني أن الكود
 * المنشور هو الكود المكتوب، لا نسخة قديمة مخزّنة.
 *
 * Usage: node scripts/verify-prod-bundle.mjs
 */

const WEB = 'https://majarra.app';

let pass = 0;
let fail = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  const index = await (await fetch(`${WEB}/`)).text();
  const scripts = [...index.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const styles = [...index.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map((m) => m[1]);

  console.log('=== الحزمة المنشورة ===');
  check('index.html يشير إلى حزمة JS', scripts.length > 0, scripts.join(', '));
  check('index.html يشير إلى ورقة أنماط', styles.length > 0, styles.join(', '));

  let js = '';
  for (const path of scripts) {
    const res = await fetch(`${WEB}${path}`);
    check(`${path} يُخدَم 200`, res.status === 200, `status=${res.status}`);
    js += await res.text();
  }

  let css = '';
  for (const path of styles) {
    css += await (await fetch(`${WEB}${path}`)).text();
  }

  console.log('\n=== بوابة وضع الموقع في حزمة JS ===');
  check('نداء نقطة /site-mode موجود', js.includes('/site-mode'));
  check('مفتاح المعاينة preview موجود', js.includes('preview'));
  check('الأوضاع الثلاثة موجودة', js.includes('construction') && js.includes('maintenance'));

  console.log('\n=== نصوص صفحات الحالة (عربية) ===');
  // نصوص مأخوذة حرفيًا من pages/StatusPages.tsx
  const strings = [
    ['كلمة «قريبًا» لصفحة الإنشاء', 'قريبًا'],
    ['عنوان صفحة الإنشاء', 'يستحق الانتظار'],
    ['كلمة «صيانة جارية»', 'صيانة جارية'],
    ['عنوان صفحة الصيانة', 'أعمال الصيانة'],
    ['عنوان صفحة 404', 'تاهت في الفضاء'],
    ['نص 404 «صفحة غير موجودة»', 'صفحة غير موجودة'],
  ];
  for (const [label, needle] of strings) {
    check(label, js.includes(needle), needle);
  }

  console.log('\n=== نصوص شاشة دخول اللوحة (إصلاح 401) ===');
  // الحزمة الرئيسية لا تحمل كود اللوحة (تُحمَّل عند الطلب)، فنجلب حزمتها
  const adminChunk = (js.match(/"\.\/([^"]*AdminRoutes[^"]*\.js)"/) ?? [])[1]
    ?? (js.match(/assets\/(AdminRoutes-[A-Za-z0-9_-]+\.js)/) ?? [])[1];
  if (adminChunk) {
    const res = await fetch(`${WEB}/assets/${adminChunk.replace(/^assets\//, '')}`);
    check(`حزمة اللوحة ${adminChunk} تُخدَم`, res.status === 200, `status=${res.status}`);
    const adminJs = await res.text();
    check('حقل مفتاح الإدارة موجود', adminJs.includes('مفتاح الإدارة'));
    check('رسالة المفتاح الخاطئ موجودة', adminJs.includes('المفتاح غير صحيح'));
    check('صفحة إعدادات وضع الموقع موجودة', adminJs.includes('وضع الموقع'));
    check('يكتب مفتاح الجلسة', adminJs.includes('majarra-admin-token'));
  } else {
    // لا نُمرّر فحصًا لم يُجرَ
    check('العثور على حزمة اللوحة في الحزمة الرئيسية', false, 'لم يُستخرج اسم الحزمة');
  }

  console.log('\n=== أنماط صفحات الحالة في CSS ===');
  check('أصناف mj-st- موجودة', css.includes('.mj-st-') || css.includes('mj-status'));
  check('حقل النجوم موجود', css.includes('mj-st-stars'));
  check('المدار موجود', css.includes('mj-st-orbit'));

  console.log(`\n${pass} pass, ${fail} fail`);
  if (failures.length) {
    console.log('الفاشل:');
    for (const item of failures) console.log(`  - ${item}`);
  }
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
