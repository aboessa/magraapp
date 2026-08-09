/**
 * تحقق من نشر وضع الموقع على الإنتاج.
 *
 * يفحص الـAPI الحقيقي والواجهة المنشورة. لا يغيّر أي إعداد: كل النداءات قراءة
 * فقط، فتشغيله على الإنتاج آمن ومتكرّر.
 *
 * Usage: node scripts/verify-prod-site-mode.mjs
 */

const API = 'https://api.majarra.app/api/v1';
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
  console.log('=== API: GET /site-mode (عام، بلا مصادقة) ===');
  const modeRes = await fetch(`${API}/site-mode`);
  const modeText = await modeRes.text();
  check('يستجيب 200', modeRes.status === 200, `status=${modeRes.status}`);
  let mode = null;
  try {
    const parsed = JSON.parse(modeText);
    mode = parsed?.data?.mode ?? null;
  } catch { /* يُبلَّغ عنه أدناه */ }
  check('يُعيد وضعًا معروفًا', ['live', 'construction', 'maintenance'].includes(mode), String(mode));
  check('يحمل Cache-Control', !!modeRes.headers.get('cache-control'), modeRes.headers.get('cache-control') ?? 'غائب');
  // Retry-After للصيانة فقط
  const retry = modeRes.headers.get('retry-after');
  check(
    'Retry-After يتبع الوضع',
    mode === 'maintenance' ? !!retry : retry === null,
    `mode=${mode} retry=${retry}`,
  );
  check('لا يكشف مفاتيح داخلية', !/partnership_|admin_api_key|ADMIN_API_KEY/i.test(modeText));

  console.log('\n=== API: حرس الإدارة يعمل ===');
  // بلا ترويسة: يجب أن يُرفض. هذا ما كان يفشل صامتًا في اللوحة.
  const noAuth = await fetch(`${API}/admin/site-mode`);
  check('طلب إدارة بلا مفتاح يُرفض 401', noAuth.status === 401, `status=${noAuth.status}`);

  const badAuth = await fetch(`${API}/admin/site-mode`, {
    headers: { Authorization: 'Bearer definitely-not-the-key' },
  });
  check('مفتاح خاطئ يُرفض 401', badAuth.status === 401, `status=${badAuth.status}`);

  console.log('\n=== الواجهة المنشورة ===');
  for (const path of ['/', '/admin', '/a-page-that-does-not-exist']) {
    const res = await fetch(`${WEB}${path}`);
    const body = await res.text();
    // Worker الأصول يعيد index.html لأي مسار (SPA)، فالتوجيه يحسمه react-router
    const hasRoot = body.includes('id="root"');
    check(`${path} يخدم تطبيق الواجهة`, res.status === 200 && hasRoot, `status=${res.status}`);
  }

  console.log('\n=== أصول الواجهة ===');
  const index = await (await fetch(`${WEB}/`)).text();
  const assets = [...index.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  check('index.html يشير إلى أصول مبنية', assets.length > 0, `${assets.length} أصل`);
  for (const asset of assets.slice(0, 4)) {
    const res = await fetch(`${WEB}${asset}`);
    check(`${asset} متاح`, res.status === 200, `status=${res.status}`);
  }

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
