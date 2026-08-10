/**
 * جلسة الإدارة: دخول ببريد وكلمة مرور.
 *
 * ## ما تغيّر ولماذا
 *
 * كانت هذه الوحدة تحفظ مفتاح ADMIN_API_KEY المشترك في sessionStorage. المفتاح
 * الواحد لا يصلح لفريق: لا يميّز موظفًا عن آخر، فسجل التدقيق كان يعتمد على
 * ترويسة X-Admin-Actor يكتبها المتصل بنفسه بلا تحقّق، ولا يمكن سحب وصول شخص
 * واحد دون تبديل المفتاح على الجميع، ولا يمكن منح مراجعًا صلاحيات أقل من مالك.
 *
 * الآن: `POST /admin/auth/login` بالبريد وكلمة المرور يُعيد رمز جلسة مرتبطًا
 * بصف في `admin_sessions`. الرمز عشوائي بلا معنى في ذاته، وما يُخزَّن في
 * الخادم ملخّصه لا هو. تعطيل الحساب أو تسجيل الخروج من كل الأجهزة يُبطله فورًا.
 *
 * ## sessionStorage لا localStorage
 *
 * الرمز يزول بإغلاق التبويب، فلا يبقى وصول إداري على جهاز مشترك. الثمن إعادة
 * الدخول كل جلسة، وهو مقبول لأداة إدارة.
 */

const TOKEN_KEY = 'majarra-admin-token'
const USER_KEY = 'majarra-admin-user'

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export type AdminUser = {
  id: string
  email: string
  display_name: string
  roles: string[]
  permissions: string[]
  must_change_password: boolean
}

/* ------------------------------------------------------------- التخزين */

export function readAdminToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    // التخزين محجوب في التصفح الخاص: القراءة الفاشلة تعني «لا جلسة»
    return ''
  }
}

/**
 * هوية الفاعل المُرسلة في X-Admin-Actor.
 *
 * صارت مشتقّة من المستخدم المُصادَق لا مُدخلة بيده. الخادم يتجاهلها الآن ويستعمل
 * هوية الجلسة، لكنها تبقى مفيدة في السجلات وللمسارات القديمة.
 */
export function readAdminActor(): string {
  return readAdminUser()?.id ?? 'dashboard-admin'
}

export function readAdminUser(): AdminUser | null {
  try {
    const raw = window.sessionStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdminUser
    return parsed && typeof parsed.id === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function hasAdminSession(): boolean {
  return readAdminToken().trim().length > 0
}

function saveSession(token: string, user: AdminUser) {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token)
    window.sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    throw new Error('storage-unavailable')
  }
}

export function clearAdminSession() {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY)
    window.sessionStorage.removeItem(USER_KEY)
  } catch {
    // الجلسة تزول بإغلاق التبويب على أي حال
  }
}

/* -------------------------------------------------------------- الصلاحيات */

/// المالك ومدير النظام يملكان كل شيء، بنفس منطق الخادم في lib/adminUsers.ts.
export function hasPermission(action: string): boolean {
  const user = readAdminUser()
  if (!user) return false
  if (user.roles.includes('owner') || user.roles.includes('system_admin')) return true
  return user.permissions.includes(action)
}

/* ------------------------------------------------------------ الدخول */

export type LoginResult =
  | { ok: true; user: AdminUser }
  | { ok: false; reason: 'invalid' | 'locked' | 'disabled' | 'network' | 'storage'; message?: string }

export async function signIn(email: string, password: string): Promise<LoginResult> {
  let response: Response
  try {
    response = await fetch(`${API_ROOT}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    return { ok: false, reason: 'network' }
  }

  const body = await response.json().catch(() => null) as
    { data?: { token: string; user: AdminUser }; error?: string } | null

  if (!response.ok) {
    // الخادم يوحّد رسالة «بريد أو كلمة مرور خاطئة» عن قصد: التمييز بينهما يكشف
    // من له حساب على المنصّة.
    if (response.status === 429) return { ok: false, reason: 'locked', message: body?.error }
    if (response.status === 403) return { ok: false, reason: 'disabled', message: body?.error }
    return { ok: false, reason: 'invalid', message: body?.error }
  }

  const token = body?.data?.token
  const user = body?.data?.user
  if (!token || !user) return { ok: false, reason: 'network' }

  try {
    saveSession(token, user)
  } catch {
    return { ok: false, reason: 'storage' }
  }
  return { ok: true, user }
}

/**
 * يتحقق من صلاحية الجلسة المحفوظة عند تحميل اللوحة.
 *
 * الرمز قد يكون منتهيًا أو مسحوبًا أو الحساب معطَّلًا، وكلها حالات لا يمكن
 * معرفتها من المتصفح وحده. بلا هذا الفحص تُعرض اللوحة ثم تفشل كل صفحة بـ401.
 *
 * ## 401 و403 فقط تعني «خارج الجلسة»
 *
 * كانت أي استجابة غير ناجحة تُعيد `null`، فيعرض الحرس شاشة الدخول. أول تشغيل
 * حقيقي في المتصفح كشف ما يعنيه ذلك: حصّة الإدارة كانت تُستهلك بعد ست شاشات
 * فيردّ الخادم 429، فتُعرض شاشة الدخول للمسؤول في منتصف عمله وتضيع كل مسوّدة
 * مفتوحة. 429 و5xx حالتا «لا أعرف» لا حالتَي «مسحوب»: الجلسة تُترك كما هي،
 * ويظهر الفشل في النداء الذي حدث فيه فعلًا حيث يمكن إعادة المحاولة.
 */
export async function verifySession(): Promise<AdminUser | null> {
  const token = readAdminToken()
  if (!token) return null
  try {
    const response = await fetch(`${API_ROOT}/admin/auth/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      // 401/403 يعني أن الجلسة لم تعد صالحة، فتُمسح بدل تركها تفشل عند كل نداء
      if (response.status === 401 || response.status === 403) {
        clearAdminSession()
        return null
      }
      // 429 أو خطأ خادم: الجلسة قد تكون صالحة تمامًا. تُعاد النسخة المحفوظة.
      return readAdminUser()
    }
    const body = await response.json() as { data?: { user: AdminUser } }
    const user = body?.data?.user ?? null
    if (user) {
      // تحديث النسخة المحفوظة: الأدوار قد تتغيّر بين الجلسات
      try { window.sessionStorage.setItem(USER_KEY, JSON.stringify(user)) } catch { /* غير حرج */ }
    }
    return user
  } catch {
    // انقطاع شبكة: الجلسة تُترك كما هي، فقد تكون صالحة
    return readAdminUser()
  }
}

export async function signOut(): Promise<void> {
  const token = readAdminToken()
  if (token) {
    try {
      await fetch(`${API_ROOT}/admin/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // الخروج محليًا يكفي: الرمز يزول من المتصفح على أي حال
    }
  }
  clearAdminSession()
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; message: string }

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const token = readAdminToken()
  if (!token) return { ok: false, message: 'الجلسة منتهية' }
  try {
    const response = await fetch(`${API_ROOT}/admin/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
    const body = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) return { ok: false, message: body?.error ?? 'تعذر تغيير كلمة المرور' }
    // الخادم يسحب كل الجلسات بعد التغيير، فالرمز الحالي لم يعد صالحًا
    clearAdminSession()
    return { ok: true }
  } catch {
    return { ok: false, message: 'تعذر الوصول إلى الخادم' }
  }
}
