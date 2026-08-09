/**
 * يتحقق أن كل نقاط الإدارة على الإنتاج تُعيد JSON حقيقيًا لا HTML.
 *
 * ## العلّة التي يحرسها هذا السكربت
 *
 * كانت 12 صفحة في اللوحة تنادي `fetch('/api/v1/admin/...')` بمسار **نسبي**،
 * فيذهب النداء إلى majarra.app لا api.majarra.app. وPages تُعيد index.html لأي
 * مسار مجهول، فترجع **200 مع HTML**. ثم يرمي `r.json()`، فيمسك الـcatch ويضع
 * بيانات مخترعة. النتيجة صفحات تبدو سليمة وأرقامها كلها كذب.
 *
 * لذلك يفحص هذا السكربت أمرين لكل نقطة:
 *   ١. النطاق الصحيح (api.majarra.app) يُعيد JSON بترويسة application/json.
 *   ٢. النطاق الخطأ (majarra.app) يُعيد HTML — وهو تأكيد أن الخطأ الأصلي كان
 *      حقيقيًا، ولهذا يجب ألّا يبقى أي نداء نسبي في الواجهة.
 *
 * Usage: node scripts/verify-admin-endpoints.mjs --email=... --password=...
 */

const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => {
  const found = args.find((a) => a.startsWith(`${name}=`))
  return found ? found.slice(name.length + 1) : fallback
}

const API = valueOf('--api', 'https://api.majarra.app').replace(/\/+$/, '')
const WEB = valueOf('--web', 'https://majarra.app').replace(/\/+$/, '')
const EMAIL = valueOf('--email')
const PASSWORD = valueOf('--password')

if (!EMAIL || !PASSWORD) {
  console.error('يجب تمرير --email و --password لحساب المالك')
  process.exit(1)
}

let pass = 0
let fail = 0
const failures = []

function check(label, ok, detail = '') {
  if (ok) {
    pass += 1
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail += 1
    failures.push(label)
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/// كل نقاط القراءة التي تستهلكها الصفحات الاثنتا عشرة
const READ_ENDPOINTS = [
  ['/admin/dashboard/stats', 'DashboardPage, OpsPage'],
  ['/admin/analytics/overview', 'AnalyticsPage'],
  ['/admin/billing/stats', 'BillingPage'],
  ['/admin/roles', 'RolesPage, TeamAccessPage'],
  ['/admin/permissions', 'RolesPage'],
  ['/admin/grants', 'RolesPage'],
  ['/admin/teams', 'TeamsPage'],
  ['/admin/tasks', 'MyTasksPage'],
  ['/admin/workflows/runs', 'WorkflowPage'],
  ['/admin/devices', 'DevicesAdminPage'],
  ['/admin/rights', 'RightsPage'],
  ['/admin/remote-config', 'RemoteConfigPage'],
  ['/admin/feature-flags', 'RemoteConfigPage'],
  ['/admin/home-experience', 'AppExperiencePage'],
  ['/admin/home-experience/preview?track=kids&country=EG&platform=mobile', 'AppExperiencePage'],
  ['/admin/users', 'TeamAccessPage'],
  ['/admin/site-mode', 'SettingsPage'],
]

async function call(path, token) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${API}/api/v1${path}`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (response.status === 429 && attempt <= 3) {
      // حدّ المحاولات يعمل: يُنتظَر بدل تسجيله فشلًا
      await sleep(20_000)
      continue
    }
    const text = await response.text()
    return { status: response.status, text, headers: response.headers }
  }
}

async function main() {
  console.log(`API: ${API}`)
  console.log(`WEB: ${WEB}\n`)

  console.log('الدخول')
  const loginRes = await fetch(`${API}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const loginBody = await loginRes.json().catch(() => null)
  const token = loginBody?.data?.token
  check('الدخول ينجح ويُعيد رمز جلسة', loginRes.status === 200 && !!token, `status=${loginRes.status}`)
  if (!token) {
    console.log('\nلا رمز: بقية الفحوص متوقفة')
    process.exitCode = 1
    return
  }

  console.log('\nالنطاق الصحيح يُعيد JSON')
  for (const [path, pages] of READ_ENDPOINTS) {
    const result = await call(path, token)
    const contentType = result.headers.get('content-type') ?? ''
    const isJson = contentType.includes('application/json')
    let parsed = null
    try { parsed = JSON.parse(result.text) } catch { /* يُبلَّغ عنه */ }

    const ok = result.status === 200 && isJson && parsed?.success === true
    check(
      `${path}`,
      ok,
      ok ? pages : `status=${result.status} ctype=${contentType.slice(0, 30)} ${result.text.slice(0, 90)}`,
    )
  }

  console.log('\nالحرس: بلا رمز يُرفض 401')
  // النقاط التي كانت محمية ضمنيًا بترتيب التركيب فقط
  for (const path of ['/admin/roles', '/admin/grants', '/admin/teams', '/admin/devices', '/admin/rights', '/admin/home-experience', '/admin/remote-config', '/admin/billing/stats', '/admin/analytics/overview']) {
    const result = await call(path, null)
    check(`${path} بلا رمز`, result.status === 401, `status=${result.status}`)
  }

  console.log('\nالنطاق الخطأ يُعيد HTML (سبب البيانات الوهمية)')
  // هذا ما كانت الصفحات تنادِيه: 200 مع HTML، فيرمي JSON.parse
  for (const path of ['/api/v1/admin/roles', '/api/v1/admin/remote-config']) {
    const response = await fetch(`${WEB}${path}`)
    const text = await response.text()
    const isHtml = text.includes('id="root"')
    let throwsOnParse = false
    try { JSON.parse(text) } catch { throwsOnParse = true }
    check(
      `${WEB}${path} يُعيد HTML وJSON.parse يرمي`,
      isHtml && throwsOnParse,
      `status=${response.status}`,
    )
  }

  console.log(`\n${pass} pass, ${fail} fail`)
  if (failures.length) {
    console.log('الفاشل:')
    for (const item of failures) console.log(`  - ${item}`)
  }
  process.exitCode = fail === 0 ? 0 : 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
