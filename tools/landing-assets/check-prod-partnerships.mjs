/**
 * فحص طلبات الشراكة على الإنتاج.
 * محافظ: يتحقق من الحماية والتحقق من المدخلات دون كتابة صفوف،
 * ثم يرسل طلبًا حقيقيًا واحدًا فقط إذا مُرِّر --submit، ويطبع مُعرّفه لحذفه لاحقًا.
 *
 * التشغيل: node tools/landing-assets/check-prod-partnerships.mjs [--submit]
 */

const API = 'https://api.majarra.app/api/v1'
const SUBMIT = process.argv.includes('--submit')

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
}

async function call(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, json }
}

console.log('--- الـWorker حي ---')
const root = await fetch('https://api.majarra.app/').then((r) => r.json()).catch(() => null)
check('الـAPI يستجيب', root?.status === 'ok', `environment=${root?.environment}`)

console.log('\n--- المسار العام موجود ---')
const status = await call('GET', '/partnerships/status')
check('/partnerships/status يعمل', status.status === 200 && status.json?.data?.accepting === true, `HTTP ${status.status}`)
check('لا يكشف إحصاءات', status.json?.data?.newRequests === undefined, JSON.stringify(status.json?.data))

console.log('\n--- التحقق من المدخلات يعمل على الإنتاج (بلا كتابة) ---')
const badEmail = await call('POST', '/partnerships', {
  kind: 'school', name: 'اختبار', organization: 'اختبار',
  email: 'not-an-email', message: 'رسالة اختبار طويلة كافية للتحقق.', locale: 'ar',
})
check('بريد غير صالح مرفوض بـ400', badEmail.status === 400, `HTTP ${badEmail.status} ${badEmail.json?.error ?? ''}`)

const badKind = await call('POST', '/partnerships', {
  kind: 'hacker', name: 'اختبار', organization: 'اختبار',
  email: 'a@b.co', message: 'رسالة اختبار طويلة كافية للتحقق.', locale: 'ar',
})
check('نوع جهة غير معروف مرفوض بـ400', badKind.status === 400, `HTTP ${badKind.status}`)

console.log('\n--- فخ البوتات ---')
const honeypot = await call('POST', '/partnerships', {
  kind: 'school', name: 'bot', organization: 'bot', email: 'bot@example.com',
  message: 'spam message long enough to pass length check', locale: 'en', website: 'http://spam.example',
})
check('الحقل المخفي يُبلع الطلب بـ202 بلا كتابة', honeypot.status === 202, `HTTP ${honeypot.status}`)

console.log('\n--- مسارات الإدارة محمية ---')
const unauth = await call('GET', '/admin/partnerships')
const protectedOk = unauth.status === 401 || unauth.status === 503
check('قائمة الإدارة ليست مفتوحة للعامة', protectedOk, `HTTP ${unauth.status} ${unauth.json?.error ?? ''}`)
if (unauth.status === 200) {
  console.log('    ! تحذير: ADMIN_API_KEY غير مضبوط على الإنتاج، فمسارات الإدارة مكشوفة')
}

const unauthSettings = await call('GET', '/admin/partnerships/settings')
check('إعدادات البريد ليست مكشوفة', unauthSettings.status === 401 || unauthSettings.status === 503, `HTTP ${unauthSettings.status}`)

if (SUBMIT) {
  console.log('\n--- إرسال طلب حقيقي واحد ---')
  const stamp = Date.now()
  const real = await call('POST', '/partnerships', {
    kind: 'other',
    name: 'فحص النشر',
    organization: `فحص النشر ${stamp}`,
    email: `deploy-check.${stamp}@example.com`,
    country: 'مصر',
    message: 'هذا طلب اختبار أنشأه فحص النشر للتأكد من عمل المسار كاملًا على الإنتاج. يمكن حذفه.',
    locale: 'ar',
  })
  check('الطلب مقبول بـ201', real.status === 201, `HTTP ${real.status} ${real.json?.error ?? ''}`)
  console.log(`    مُعرّف الطلب للحذف: ${real.json?.data?.id}`)
} else {
  console.log('\n(لم يُرسَل طلب حقيقي. أضف --submit لإرسال طلب واحد.)')
}

console.log('\n=== الخلاصة ===')
if (failures.length === 0) console.log('كل الفحوص ناجحة')
else {
  console.log(`فحوص فاشلة: ${failures.length} → ${failures.join(' , ')}`)
  process.exitCode = 1
}
