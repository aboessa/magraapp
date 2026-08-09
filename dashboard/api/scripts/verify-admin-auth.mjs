/**
 * تحقق وقت التشغيل من مصادقة لوحة الإدارة.
 *
 * يغطّي ما لا تستطيع اختبارات الوحدة تغطيته: الجلسات وكلمات المرور والحرس
 * تحتاج D1 حقيقيًا، وقاعدة بيانات مزيّفة قد تنحرف عن سلوك الحقيقية فتُعطي
 * ثقة كاذبة.
 *
 * الإنشاء والحذف يقتصران على حساب اختبار مخصّص، ولا يُلمس حساب المالك.
 *
 * Usage: node scripts/verify-admin-auth.mjs --email=owner@x.com --password=...
 */

const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => {
  const found = args.find((a) => a.startsWith(`${name}=`))
  return found ? found.slice(name.length + 1) : fallback
}

const BASE = valueOf('--base', 'http://127.0.0.1:8787').replace(/\/+$/, '')
const API = `${BASE}/api/v1`
const OWNER_EMAIL = valueOf('--email')
const OWNER_PASSWORD = valueOf('--password')

if (!OWNER_EMAIL || !OWNER_PASSWORD) {
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

/**
 * ينادي الـAPI، ويصبر على حدّ المحاولات.
 *
 * حدّ الدخول خمس محاولات في الدقيقة لكل عنوان، وهذا السكربت يُجري نحو ست
 * محاولات دخول للتحقّق من حالات مختلفة، فيصطدم بالحدّ في منتصف الفحص.
 * الـ429 هنا **دليل على أن الحدّ يعمل** لا خطأ، فلا يصحّ تسجيله فشلًا ولا
 * تعطيل الحدّ للاختبار: الانتظار يتيح إكمال التحقّق دون إخفاء السلوك.
 *
 * `allow429` يُستخدم حين يكون الـ429 هو النتيجة المتوقّعة نفسها.
 */
async function call(path, { method = 'GET', token, body, actor, allow429 = false } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const headers = { Accept: 'application/json' }
    if (body) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    if (actor) headers['X-Admin-Actor'] = actor
    const response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await response.text()

    if (response.status === 429 && !allow429 && attempt <= 4) {
      const retryAfter = Number(response.headers.get('Retry-After'))
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? (retryAfter + 2) * 1000 : 62_000
      console.log(`    (حدّ المحاولات على ${path}: انتظار ${Math.round(waitMs / 1000)}ث)`)
      await sleep(waitMs)
      continue
    }

    let json = null
    try { json = JSON.parse(text) } catch { /* استجابة غير JSON */ }
    return { status: response.status, text, json, headers: response.headers }
  }
}

async function main() {
  console.log(`التحقق من ${BASE}\n`)

  // ------------------------------------------------------------ الحرس
  console.log('حرس المصادقة')
  const noAuth = await call('/admin/dashboard/stats')
  check('نداء إدارة بلا رمز يُرفض 401', noAuth.status === 401, `status=${noAuth.status}`)

  const badToken = await call('/admin/dashboard/stats', { token: 'not-a-real-session-token' })
  check('رمز غير صالح يُرفض 401', badToken.status === 401, `status=${badToken.status}`)

  // ------------------------------------------------------------- الدخول
  console.log('\nالدخول')
  const wrongPassword = await call('/admin/auth/login', {
    method: 'POST',
    body: { email: OWNER_EMAIL, password: 'definitely-the-wrong-password' },
  })
  check('كلمة مرور خاطئة تُرفض 401', wrongPassword.status === 401, `status=${wrongPassword.status}`)
  check(
    'رسالة الرفض لا تكشف وجود الحساب',
    /البريد أو كلمة المرور/.test(wrongPassword.json?.error ?? ''),
    wrongPassword.json?.error,
  )

  const unknownEmail = await call('/admin/auth/login', {
    method: 'POST',
    body: { email: 'nobody-here@example.com', password: 'whatever-password' },
  })
  check('بريد غير موجود يُعطي نفس الرسالة', unknownEmail.json?.error === wrongPassword.json?.error)

  const malformed = await call('/admin/auth/login', {
    method: 'POST',
    body: { email: 'not-an-email', password: 'x' },
  })
  check('بريد غير صالح يُرفض 400 قبل استهلاك الحصة', malformed.status === 400, `status=${malformed.status}`)

  const login = await call('/admin/auth/login', {
    method: 'POST',
    body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  })
  check('الدخول الصحيح ينجح 200', login.status === 200, `status=${login.status}`)
  const token = login.json?.data?.token
  check('يُعيد رمز جلسة', typeof token === 'string' && token.length > 20, `len=${token?.length}`)
  check('لا يُعيد تعمية كلمة المرور', !/pbkdf2|password_hash/i.test(login.text))
  check('دور المالك موجود', (login.json?.data?.user?.roles ?? []).includes('owner'))
  check(
    'صلاحية manage_permissions موجودة',
    (login.json?.data?.user?.permissions ?? []).includes('manage_permissions'),
  )

  if (!token) {
    console.log('\nلا رمز: بقية الفحوص متوقفة')
    process.exitCode = 1
    return
  }

  // ------------------------------------------------------------ الجلسة
  console.log('\nالجلسة')
  const me = await call('/admin/auth/me', { token })
  check('/me يحلّ الجلسة', me.status === 200 && me.json?.data?.user?.email === OWNER_EMAIL, `status=${me.status}`)

  const guarded = await call('/admin/dashboard/stats', { token })
  check('الرمز يفتح مسارات الإدارة (إصلاح 401)', guarded.status === 200, `status=${guarded.status}`)

  // مسارات كانت بلا حرس صريح وتعتمد على ترتيب التركيب
  for (const path of ['/admin/billing/stats', '/admin/analytics/overview']) {
    const withToken = await call(path, { token })
    const without = await call(path)
    check(`${path} يعمل بالجلسة`, withToken.status === 200, `status=${withToken.status}`)
    check(`${path} يُرفض بلا جلسة`, without.status === 401, `status=${without.status}`)
  }

  // ---------------------------------------------- المفتاح المشترك مرفوض
  console.log('\nالمفتاح المشترك بعد بذر مستخدم')
  const status = await call('/admin/auth/status')
  check('users_configured صحيح', status.json?.data?.users_configured === true)
  check('legacy_key_available خطأ', status.json?.data?.legacy_key_available === false)

  // -------------------------------------------------- إدارة المستخدمين
  console.log('\nإدارة المستخدمين')
  const list = await call('/admin/users', { token })
  check('قائمة المستخدمين تعمل', list.status === 200, `status=${list.status}`)
  check('لا تكشف تعمية كلمات المرور', !/password_hash|pbkdf2/i.test(list.text))

  const testEmail = `verify-${Date.now()}@majarra.test`
  const created = await call('/admin/users', {
    method: 'POST',
    token,
    body: {
      email: testEmail,
      display_name: 'حساب تحقق مؤقت',
      role_id: 'reviewer',
      password: 'temp-password-1234',
    },
  })
  check('إنشاء موظف ينجح 201', created.status === 201, `status=${created.status}`)
  const newUserId = created.json?.data?.id

  const weak = await call('/admin/users', {
    method: 'POST',
    token,
    body: { email: `weak-${Date.now()}@majarra.test`, display_name: 'x', role_id: 'reviewer', password: 'short' },
  })
  check('كلمة مرور ضعيفة تُرفض 400', weak.status === 400, `status=${weak.status}`)

  const duplicate = await call('/admin/users', {
    method: 'POST',
    token,
    body: { email: testEmail, display_name: 'مكرر', role_id: 'reviewer', password: 'temp-password-1234' },
  })
  check('بريد مكرر يُرفض 409', duplicate.status === 409, `status=${duplicate.status}`)

  const badRole = await call('/admin/users', {
    method: 'POST',
    token,
    body: { email: `role-${Date.now()}@majarra.test`, display_name: 'x', role_id: 'wizard', password: 'temp-password-1234' },
  })
  check('دور غير معروف يُرفض 400', badRole.status === 400, `status=${badRole.status}`)

  // ------------------------------------------- صلاحيات الموظف المحدودة
  console.log('\nحدود صلاحيات المراجع')
  const reviewerLogin = await call('/admin/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: 'temp-password-1234' },
  })
  check('الموظف الجديد يستطيع الدخول', reviewerLogin.status === 200, `status=${reviewerLogin.status}`)
  const reviewerToken = reviewerLogin.json?.data?.token
  check(
    'must_change_password مضبوط للكلمة المؤقتة',
    reviewerLogin.json?.data?.user?.must_change_password === true,
  )
  check(
    'المراجع لا يملك manage_permissions',
    !(reviewerLogin.json?.data?.user?.permissions ?? []).includes('manage_permissions'),
  )

  if (reviewerToken) {
    const denied = await call('/admin/users', { token: reviewerToken })
    check('المراجع يُمنع من قائمة المستخدمين 403', denied.status === 403, `status=${denied.status}`)

    const deniedCreate = await call('/admin/users', {
      method: 'POST',
      token: reviewerToken,
      body: { email: `esc-${Date.now()}@majarra.test`, display_name: 'x', role_id: 'owner', password: 'temp-password-1234' },
    })
    check('المراجع يُمنع من ترقية نفسه 403', deniedCreate.status === 403, `status=${deniedCreate.status}`)

    // المراجع يقرأ الكتالوج: الحرس مصادقة لا منع كامل
    const catalogue = await call('/admin/dashboard/stats', { token: reviewerToken })
    check('المراجع يقرأ الكتالوج', catalogue.status === 200, `status=${catalogue.status}`)
  }

  // ---------------------------------------------------- سحب الجلسات
  console.log('\nالسحب والتعطيل')
  if (newUserId && reviewerToken) {
    await call(`/admin/users/${newUserId}/revoke-sessions`, { method: 'POST', token })
    const afterRevoke = await call('/admin/auth/me', { token: reviewerToken })
    check('سحب الجلسات يُبطل الرمز فورًا', afterRevoke.status === 401, `status=${afterRevoke.status}`)
  }

  if (newUserId) {
    const reLogin = await call('/admin/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'temp-password-1234' },
    })
    const freshToken = reLogin.json?.data?.token
    await call(`/admin/users/${newUserId}`, { method: 'PATCH', token, body: { is_active: false } })
    const afterDisable = await call('/admin/auth/me', { token: freshToken })
    check('تعطيل الحساب يُبطل جلساته فورًا', afterDisable.status === 401, `status=${afterDisable.status}`)

    const disabledLogin = await call('/admin/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'temp-password-1234' },
    })
    check('الحساب المعطَّل لا يستطيع الدخول 403', disabledLogin.status === 403, `status=${disabledLogin.status}`)
  }

  // ------------------------------------------------ حماية آخر مالك
  console.log('\nحماية الملكية')
  const owners = await call('/admin/users', { token })
  const ownerRow = (owners.json?.data ?? []).find((u) => u.email === OWNER_EMAIL)
  check('حساب المالك ظاهر في القائمة', !!ownerRow)
  if (ownerRow) {
    const selfDisable = await call(`/admin/users/${ownerRow.id}`, {
      method: 'PATCH', token, body: { is_active: false },
    })
    check('لا يمكن تعطيل حسابي 400', selfDisable.status === 400, `status=${selfDisable.status}`)
  }

  // ------------------------------------------------------- الخروج
  console.log('\nالخروج')
  const logout = await call('/admin/auth/logout', { method: 'POST', token })
  check('الخروج ينجح', logout.status === 200, `status=${logout.status}`)
  const afterLogout = await call('/admin/auth/me', { token })
  check('الرمز لا يعمل بعد الخروج', afterLogout.status === 401, `status=${afterLogout.status}`)

  console.log(`\n${pass} pass, ${fail} fail`)
  if (failures.length) {
    console.log('الفاشل:')
    for (const item of failures) console.log(`  - ${item}`)
  }
  console.log('\nملاحظة: أُنشئ حساب اختبار مؤقت ومعطَّل بالبريد')
  console.log(`  ${testEmail}`)
  console.log('  احذفه من اللوحة أو اتركه معطَّلًا؛ لم يُلمس حساب المالك.')

  process.exitCode = fail === 0 ? 0 : 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
