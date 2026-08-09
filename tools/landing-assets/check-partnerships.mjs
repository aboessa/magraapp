/**
 * فحص طلبات الشراكة من طرف إلى طرف مقابل wrangler dev المحلي.
 * يغطي: التحقق من المدخلات، فخ البوتات، الحفظ في D1، حالة البريد،
 * مسارات الإدارة، تحقق الإعدادات، وحد المعدّل.
 *
 * التشغيل: node tools/landing-assets/check-partnerships.mjs http://127.0.0.1:8790
 */

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8790').replace(/\/$/, '')
const API = `${BASE}/api/v1`

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
}

/**
 * حد المعدّل يُفتَّح بعنوان العميل، فكل مرحلة تستخدم عنوانًا خاصًا
 * حتى لا تُحرق مرحلةٌ حصةَ التي بعدها ويظهر الفشل في غير موضعه.
 */
let clientIp = '203.0.113.1'
function phase(title, ip) {
  clientIp = ip
  console.log(`\n--- ${title} ---`)
}

async function call(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'CF-Connecting-IP': clientIp,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, json }
}

const stamp = Date.now()
const valid = {
  kind: 'school',
  name: 'نُهى عبد الله',
  organization: `مدرسة الأفق ${stamp}`,
  email: `noha.${stamp}@example.com`,
  phone: '+20 100 000 0000',
  country: 'مصر',
  message: 'نريد حسابات صفّية لثلاثة صفوف، ومحتوى مرتبط بمنهج الصف الثالث الابتدائي.',
  locale: 'ar',
}

phase('إعداد: تفريغ بريد الاستقبال', '203.0.113.10')
const reset = await call('PUT', '/admin/partnerships/settings', { partnership_inbox_email: '' })
check('يمكن تفريغ الإعداد', reset.status === 200, `HTTP ${reset.status}`)

phase('التحقق من المدخلات', '203.0.113.11')
const badEmail = await call('POST', '/partnerships', { ...valid, email: 'not-an-email' })
check('بريد غير صالح مرفوض بـ400', badEmail.status === 400, `HTTP ${badEmail.status} ${badEmail.json?.error ?? ''}`)

const noName = await call('POST', '/partnerships', { ...valid, name: '   ' })
check('اسم فارغ مرفوض بـ400', noName.status === 400, `HTTP ${noName.status}`)

const shortMessage = await call('POST', '/partnerships', { ...valid, message: 'قصير' })
check('رسالة قصيرة مرفوضة بـ400', shortMessage.status === 400, `HTTP ${shortMessage.status}`)

const badKind = await call('POST', '/partnerships', { ...valid, kind: 'hacker' })
check('نوع جهة غير معروف مرفوض بـ400', badKind.status === 400, `HTTP ${badKind.status}`)

phase('فخ البوتات', '203.0.113.12')
const honeypot = await call('POST', '/partnerships', { ...valid, website: 'http://spam.example' })
check('الحقل المخفي يُبلع الطلب بـ202', honeypot.status === 202, `HTTP ${honeypot.status}`)
check('لا مُعرّف يُعاد للبوت', honeypot.json?.data?.id === null, JSON.stringify(honeypot.json?.data))

phase('إرسال صحيح بلا بريد استقبال مضبوط', '203.0.113.13')
const first = await call('POST', '/partnerships', valid)
check('الطلب مقبول بـ201', first.status === 201, `HTTP ${first.status} ${first.json?.error ?? ''}`)
const firstId = first.json?.data?.id
check('أُعيد مُعرّف الطلب', typeof firstId === 'string' && firstId.length > 10, String(firstId))

const detail = firstId ? await call('GET', `/admin/partnerships/${firstId}`) : { status: 0, json: null }
check('الطلب محفوظ فعلًا في D1', detail.status === 200, `HTTP ${detail.status}`)
const row = detail.json?.data
check('حالة الطلب new', row?.status === 'new', String(row?.status))
check('حالة البريد skipped حين لا عنوان', row?.email_status === 'skipped', `${row?.email_status} :: ${row?.email_error ?? ''}`)
check('الاسم العربي محفوظ بلا تلف', row?.name === valid.name, String(row?.name))
check('اللغة محفوظة', row?.locale === 'ar', String(row?.locale))
check('الرسالة محفوظة كاملة', row?.message === valid.message)
check('البوت لم يُحفظ في الجدول', row?.organization === valid.organization)

phase('التحقق من إعدادات البريد', '203.0.113.14')
const badSetting = await call('PUT', '/admin/partnerships/settings', { partnership_inbox_email: 'nope' })
check('بريد استقبال غير صالح مرفوض', badSetting.status === 400, `HTTP ${badSetting.status} ${badSetting.json?.error ?? ''}`)

const badCc = await call('PUT', '/admin/partnerships/settings', { partnership_cc_emails: 'a@b.co, broken' })
check('قائمة CC بعنوان فاسد مرفوضة', badCc.status === 400, `HTTP ${badCc.status}`)

const badKey = await call('PUT', '/admin/partnerships/settings', { evil_key: 'x' })
check('مفتاح إعداد غير مسموح مرفوض', badKey.status === 400, `HTTP ${badKey.status}`)

const setInbox = await call('PUT', '/admin/partnerships/settings', {
  partnership_inbox_email: 'partners@majarra.app',
  partnership_cc_emails: 'ops@majarra.app',
})
check('ضبط بريد الاستقبال ناجح', setInbox.status === 200, `HTTP ${setInbox.status}`)

const settings = await call('GET', '/admin/partnerships/settings')
check('الإعداد يُقرأ بعد الحفظ', settings.json?.data?.settings?.partnership_inbox_email === 'partners@majarra.app',
  String(settings.json?.data?.settings?.partnership_inbox_email))
check('اللوحة تعرف المزوّد المستخدم', typeof settings.json?.data?.emailProvider === 'string',
  String(settings.json?.data?.emailProvider))
check('اللوحة تعرف أن الصندوق مضبوط', settings.json?.data?.inboxConfigured === true)

phase('إرسال بعد ضبط البريد', '203.0.113.15')
const second = await call('POST', '/partnerships', { ...valid, kind: 'nursery', locale: 'fr', email: `b.${stamp}@example.com` })
check('الطلب مقبول بـ201', second.status === 201, `HTTP ${second.status}`)
const secondId = second.json?.data?.id
const secondRow = secondId ? (await call('GET', `/admin/partnerships/${secondId}`)).json?.data : null
check('حاول الإرسال فعلًا (لم يُتخطَّ)', secondRow?.email_status !== 'skipped',
  `${secondRow?.email_status} :: ${(secondRow?.email_error ?? '').slice(0, 120)}`)
check('اللغة الفرنسية محفوظة', secondRow?.locale === 'fr', String(secondRow?.locale))

phase('مسارات الإدارة', '203.0.113.16')
const list = await call('GET', '/admin/partnerships?limit=5')
check('القائمة تعمل', list.status === 200 && Array.isArray(list.json?.data), `HTTP ${list.status}`)
check('الترقيم موجود', typeof list.json?.meta?.total === 'number' && typeof list.json?.meta?.pages === 'number',
  JSON.stringify(list.json?.meta))
check('عدّاد الحالات موجود', typeof list.json?.meta?.counts === 'object', JSON.stringify(list.json?.meta?.counts))

const filtered = await call('GET', '/admin/partnerships?status=new&kind=school')
check('التصفية بالحالة والنوع تعمل',
  filtered.status === 200 && filtered.json.data.every((item) => item.status === 'new' && item.kind === 'school'),
  `${filtered.json?.data?.length} صف`)

const searched = await call('GET', `/admin/partnerships?search=${encodeURIComponent(String(stamp))}`)
check('البحث يجد الطلب المُنشأ', searched.json?.data?.some((item) => item.id === firstId),
  `${searched.json?.data?.length} نتيجة`)

const patched = await call('PATCH', `/admin/partnerships/${firstId}`, { status: 'in_review', admin_note: 'اتصلنا بهم' })
check('تحديث الحالة والملاحظة يعمل',
  patched.status === 200 && patched.json?.data?.status === 'in_review' && patched.json?.data?.admin_note === 'اتصلنا بهم',
  `HTTP ${patched.status} ${patched.json?.data?.status}`)

const badStatus = await call('PATCH', `/admin/partnerships/${firstId}`, { status: 'deleted' })
check('حالة غير معروفة مرفوضة', badStatus.status === 400, `HTTP ${badStatus.status}`)

const missing = await call('PATCH', '/admin/partnerships/does-not-exist', { status: 'new' })
check('طلب غير موجود يُعيد 404', missing.status === 404, `HTTP ${missing.status}`)

const resend = await call('POST', `/admin/partnerships/${firstId}/resend`)
check('إعادة الإرسال تُعيد نتيجة صريحة', resend.status === 200 || resend.status === 502,
  `HTTP ${resend.status} ${(resend.json?.error ?? '').slice(0, 120)}`)

phase('المسار العام لا يكشف بيانات', '203.0.113.17')
const status = await call('GET', '/partnerships/status')
check('status يعمل', status.status === 200, `HTTP ${status.status}`)
check('status لا يكشف إحصاءات', status.json?.data?.newRequests === undefined && status.json?.data?.emailConfigured === undefined,
  JSON.stringify(status.json?.data))

phase('حد المعدّل: 5 مقبولة في الساعة', '203.0.113.18')
let limited = false
let attempts = 0
for (let i = 0; i < 8; i += 1) {
  const response = await call('POST', '/partnerships', { ...valid, email: `rl.${stamp}.${i}@example.com` })
  attempts += 1
  if (response.status === 429) { limited = true; break }
}
check('يُطبَّق حد على الإرسال المتكرر', limited, `توقّف بعد ${attempts} محاولة`)

console.log('\n=== الخلاصة ===')
if (failures.length === 0) console.log('كل الفحوص ناجحة')
else {
  console.log(`فحوص فاشلة: ${failures.length} → ${failures.join(' , ')}`)
  process.exitCode = 1
}
