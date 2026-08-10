// الامتداد .ts مقصود ومطلوب.
//
// هذه الوحدة تُختبر بـ`node --experimental-strip-types`، وهو يمحو أنواع
// TypeScript فقط ولا يحلّ مسارًا بلا امتداد. استيراد قيمة من './db' كان
// يُسقط الاختبار بـERR_MODULE_NOT_FOUND. البديل كان تكرار التعمية هنا، وهو
// أسوأ: خوارزميتان لكلمات المرور تعنيان موضعين للمراجعة الأمنية.
// tsconfig يضبط allowImportingTsExtensions، وesbuild يحلّ الامتداد كذلك.
import { queryAll, queryFirst, type Env } from './db.ts'
import { hashPassword, randomToken, sha256Base64Url, verifyPassword } from './security.ts'

/**
 * مصادقة مستخدمي اللوحة: حسابات ببريد وكلمة مرور وأدوار وجلسات قابلة للسحب.
 *
 * ## ما يُعاد استخدامه ولا يُعاد بناؤه
 *
 * التعمية من lib/security.ts نفسها التي تستخدمها حسابات أولياء الأمور:
 * PBKDF2-SHA256 بمئة ألف تكرار وملح عشوائي ومقارنة ثابتة الزمن. خوارزمية
 * ثانية تعني موضعين للمراجعة الأمنية ومكانين للخطأ.
 *
 * الأدوار والصلاحيات من المهاجرة 0014: roles و permissions و role_permissions
 * و access_grants. الجداول كانت موجودة منذ البداية لكن لا كود يقرؤها للتصريح،
 * ولا مسار يُنشئ صفًا في admin_users، فكانت بنية معطّلة.
 *
 * ## لماذا الجلسة صف في D1 لا حمولة في الرمز
 *
 * الرمز الموقَّع المكتفي بنفسه لا يمكن سحبه قبل انتهاء صلاحيته: تعطيل موظف
 * اليوم يتركه داخلًا حتى ينتهي رمزه. قراءة صف عند كل طلب تجعل التعطيل وتسجيل
 * الخروج من كل الأجهزة فوريَّين. الثمن استعلام واحد لكل طلب إداري، وهو ثمن
 * مقبول على سطح إداري منخفض الحركة.
 *
 * يُخزَّن ملخّص SHA-256 للرمز لا الرمز نفسه، فنسخة مسروقة من قاعدة البيانات
 * لا تمنح جلسات صالحة.
 */

/// عمر الجلسة. ثمانية أيام تكفي أسبوع عمل بلا إعادة دخول يومية.
const SESSION_TTL_MS = 8 * 24 * 60 * 60 * 1000

/// القفل بعد محاولات فاشلة، بنفس أرقام IdentityState للأهل.
const MAX_LOGIN_FAILURES = 5
const LOCK_DURATION_MS = 15 * 60 * 1000

/// أقل طول مقبول لكلمة المرور. الطول أهم من تعقيد الرموز في مقاومة التخمين.
export const MIN_PASSWORD_LENGTH = 10

export type AdminUserRow = {
  id: string
  email: string
  display_name: string
  is_active: number
  is_external: number
  created_at: string
  updated_at: string
}

export type AdminSessionUser = {
  id: string
  email: string
  display_name: string
  /// أدوار المستخدم على نطاق المنصّة أو نطاق أضيق
  roles: string[]
  /// الصلاحيات المستخلصة من كل أدواره مجتمعة
  permissions: string[]
  /// المنح كاملة بنطاقاتها.
  ///
  /// ## علّة كانت هنا
  ///
  /// `resolveSession` كان يُحمّل المنح بـ`loadUserAccess` ثم يُسقطها، فتصل إلى
  /// `requirePermission` جلسةٌ بلا `grants`. و`can()` — بحقّ — يطالب بمنح واحد
  /// على الأقل يطابق المورد، فكانت النتيجة أن **كل** مستخدم غير مالك ولا مدير
  /// نظام يُرفض في كل عملية محروسة بصلاحية، مهما كانت منحه. الصلاحيات المسطّحة
  /// كانت تصل للواجهة فتُظهر الأزرار، والخادم يرفض. تحميلها هنا هو ما يجعل
  /// النموذج المكتوب في `can()` نافذًا فعلًا.
  grants: AccessGrant[]
  must_change_password: boolean
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  // فحص متحفّظ: لا يحاول تطبيق RFC كاملًا، فقط يرفض ما هو بيّن الخطأ
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null
  return trimmed.slice(0, 254)
}

/**
 * يتحقق من قوة كلمة المرور ويُعيد سبب الرفض بالعربية أو null.
 *
 * لا يُلزم برموز خاصة: القواعد المعقّدة تدفع الناس إلى أنماط متوقّعة مثل
 * `Password1!`، والطول يقاوم التخمين أكثر.
 */
export function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return 'كلمة المرور مطلوبة'
  if (value.length < MIN_PASSWORD_LENGTH) return `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`
  if (value.length > 200) return 'كلمة المرور طويلة جدًا'
  // كلمة من محرف واحد مكرّر تمرّ فحص الطول لكنها لا تقاوم شيئًا
  if (new Set(value).size < 4) return 'كلمة المرور بسيطة جدًا'
  return null
}

/* ------------------------------------------------------------ المستخدمون */

export async function findUserByEmail(db: D1Database, email: string) {
  return queryFirst<AdminUserRow>(db, 'SELECT * FROM admin_users WHERE email = ?', [email])
}

export async function findUserById(db: D1Database, id: string) {
  return queryFirst<AdminUserRow>(db, 'SELECT * FROM admin_users WHERE id = ?', [id])
}

/**
 * منح واحد بكل طبقاته الأربع، مع الصلاحيات التي يمنحها دوره.
 *
 * هذا هو الشكل الذي كان مفقودًا: المنح كانت تُسطَّح إلى قائمتي نصوص فتضيع
 * الطبقات الثلاث الأخرى.
 */
export type AccessGrant = {
  role_id: string
  scope_type: ScopeType
  /// null يعني «كل ما في هذا المستوى»، مثل منح على كل الكواكب
  scope_id: string | null
  /// null يعني «كل أنواع المحتوى»
  content_type: string | null
  /// null يعني «كل اللغات»
  language: string | null
  permissions: string[]
}

/// مستويات النطاق من الأوسع إلى الأضيق، بنفس ترتيب المهاجرة 0014.
export const SCOPE_TYPES = [
  'platform', 'planet', 'section', 'series', 'content', 'page', 'language',
] as const

export type ScopeType = typeof SCOPE_TYPES[number]

/**
 * النطاق المطلوب لعملية بعينها.
 *
 * الحقول الاختيارية تعني «غير معروف»، ولا تُطابق إلا منحًا مفتوحًا على ذلك
 * البعد. مثال: تعديل نص إنجليزي في سلسلة معيّنة يُوصَف بـ
 * `{ planetId, seriesId, contentType: 'illustrated_story', language: 'en' }`.
 */
export type ResourceScope = {
  planetId?: string | null
  sectionId?: string | null
  seriesId?: string | null
  contentId?: string | null
  pageId?: string | null
  contentType?: string | null
  language?: string | null
}

export type UserAccess = {
  roles: string[]
  /// اتحاد كل الصلاحيات في كل النطاقات. للعرض في الواجهة فقط، لا للتصريح.
  permissions: string[]
  grants: AccessGrant[]
}

/**
 * يجمع منح المستخدم من access_grants بكل طبقاتها.
 *
 * ## العلّة التي يعالجها هذا التغيير
 *
 * كان الاستعلام يقرأ عمودين فقط (`role_id` و`action`) ويُسطّحهما في مجموعتين
 * نصيّتين، فمنحٌ على سلسلة واحدة ومنحٌ على المنصّة كلها ينتجان **القيمة
 * نفسها بالحرف**. أي أن الطبقات الثلاث الأخرى في الخطة — النطاق ونوع المحتوى
 * واللغة — كانت تُكتب في قاعدة البيانات ثم تُهمَل عند القراءة، فلا تمنع شيئًا.
 *
 * الآن يُعاد كل منح كاملًا، ويقرّر `can()` المطابقة بحسب الموارد المطلوبة.
 *
 * يشمل المنح المباشرة ومنح الفرق التي هو عضو فيها، ويستبعد المنتهية.
 */
export async function loadUserAccess(db: D1Database, userId: string): Promise<UserAccess> {
  const rows = await queryAll<{
    role_id: string
    scope_type: string
    scope_id: string | null
    content_type: string | null
    language: string | null
    action: string | null
  }>(db, `
    SELECT DISTINCT ag.role_id, ag.scope_type, ag.scope_id, ag.content_type, ag.language,
           p.id AS action
      FROM access_grants ag
      LEFT JOIN role_permissions rp ON rp.role_id = ag.role_id
      LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE (
             (ag.grantee_type = 'user' AND ag.grantee_id = ?)
             OR (ag.grantee_type = 'team' AND ag.grantee_id IN (
                  SELECT team_id FROM team_members
                   WHERE user_id = ?
                     AND (valid_until IS NULL OR valid_until > datetime('now'))
                ))
           )
       AND ag.valid_from <= datetime('now')
       AND (ag.valid_until IS NULL OR ag.valid_until > datetime('now'))
  `, [userId, userId])

  // يُجمَّع بحسب هوية المنح لا بحسب الدور: نفس الدور قد يُمنح مرتين بنطاقين
  // مختلفين، ودمجهما يوسّع الوصول خطأً.
  const byGrant = new Map<string, AccessGrant>()
  const roles = new Set<string>()
  const permissions = new Set<string>()

  for (const row of rows) {
    const scopeType = (SCOPE_TYPES as readonly string[]).includes(row.scope_type)
      ? row.scope_type as ScopeType
      // نطاق غير معروف يفشل مغلقًا إلى أضيق مستوى، فلا يُمنح وصولًا أوسع
      : 'page'
    const key = [row.role_id, scopeType, row.scope_id, row.content_type, row.language].join('\u0000')

    let grant = byGrant.get(key)
    if (!grant) {
      grant = {
        role_id: row.role_id,
        scope_type: scopeType,
        scope_id: row.scope_id,
        content_type: row.content_type,
        language: row.language,
        permissions: [],
      }
      byGrant.set(key, grant)
    }
    if (row.action && !grant.permissions.includes(row.action)) grant.permissions.push(row.action)

    roles.add(row.role_id)
    if (row.action) permissions.add(row.action)
  }

  return { roles: [...roles], permissions: [...permissions], grants: [...byGrant.values()] }
}

/* --------------------------------------------------------------- الجلسات */

export type LoginFailure =
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'locked'; retryAfterSeconds: number }
  | { ok: false; reason: 'inactive' }
  | { ok: false; reason: 'no_credentials' }

export type LoginSuccess = {
  ok: true
  token: string
  expiresAt: string
  user: AdminSessionUser
}

/**
 * يتحقق من البريد وكلمة المرور ويُنشئ جلسة.
 *
 * كل حالات الفشل تُعيد نفس الرسالة للمتصل (انظر routes/adminAuth.ts): التمييز
 * بين «بريد غير موجود» و«كلمة مرور خاطئة» يكشف من له حساب أصلًا.
 */
export async function login(
  db: D1Database,
  email: string,
  password: string,
  context: { userAgent?: string | null; sourceIp?: string | null } = {},
): Promise<LoginSuccess | LoginFailure> {
  const user = await findUserByEmail(db, email)
  if (!user) {
    // تعمية وهمية بنفس تكلفة الحقيقية، فلا يكشف زمن الاستجابة وجود الحساب
    await verifyPassword(password, 'pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
    return { ok: false, reason: 'invalid' }
  }
  if (!user.is_active) return { ok: false, reason: 'inactive' }

  const credentials = await queryFirst<{
    password_hash: string
    failed_login_count: number
    locked_until: string | null
    must_change_password: number
  }>(db, 'SELECT password_hash, failed_login_count, locked_until, must_change_password FROM admin_credentials WHERE user_id = ?', [user.id])

  // حساب موجود بلا اعتمادات: أُنشئ ولم تُضبط له كلمة مرور بعد
  if (!credentials) return { ok: false, reason: 'no_credentials' }

  if (credentials.locked_until) {
    const until = new Date(`${credentials.locked_until.replace(' ', 'T')}Z`).getTime()
    if (Number.isFinite(until) && until > Date.now()) {
      return { ok: false, reason: 'locked', retryAfterSeconds: Math.ceil((until - Date.now()) / 1000) }
    }
  }

  const valid = await verifyPassword(password, credentials.password_hash)
  if (!valid) {
    const failures = Number(credentials.failed_login_count) + 1
    if (failures >= MAX_LOGIN_FAILURES) {
      // يُصفَّر العدّاد مع القفل، فالمحاولات تُحسب لكل نافذة قفل لا تراكميًا
      const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString()
      await db.prepare(
        `UPDATE admin_credentials SET failed_login_count = 0, locked_until = ?, updated_at = datetime('now') WHERE user_id = ?`,
      ).bind(lockedUntil, user.id).run()
      return { ok: false, reason: 'locked', retryAfterSeconds: Math.ceil(LOCK_DURATION_MS / 1000) }
    }
    await db.prepare(
      `UPDATE admin_credentials SET failed_login_count = ?, updated_at = datetime('now') WHERE user_id = ?`,
    ).bind(failures, user.id).run()
    return { ok: false, reason: 'invalid' }
  }

  const access = await loadUserAccess(db, user.id)
  const token = randomToken(32)
  const tokenHash = await sha256Base64Url(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

  await db.batch([
    db.prepare(`
      INSERT INTO admin_sessions (id, user_id, token_hash, expires_at, user_agent, source_ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), user.id, tokenHash, expiresAt,
      context.userAgent?.slice(0, 300) ?? null, context.sourceIp ?? null,
    ),
    db.prepare(
      `UPDATE admin_credentials SET failed_login_count = 0, locked_until = NULL, last_login_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?`,
    ).bind(user.id),
  ])

  return {
    ok: true,
    token,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      roles: access.roles,
      permissions: access.permissions,
      grants: access.grants,
      must_change_password: credentials.must_change_password === 1,
    },
  }
}

/**
 * يحلّ رمز جلسة إلى مستخدم، أو null.
 *
 * يتحقق من الصلاحية والسحب وحالة الحساب في استعلام واحد، فحساب معطَّل أو جلسة
 * مسحوبة تفقد الوصول فورًا لا عند انتهاء الرمز.
 */
export async function resolveSession(db: D1Database, token: string): Promise<AdminSessionUser | null> {
  if (!token || token.length > 400) return null
  const tokenHash = await sha256Base64Url(token)

  const row = await queryFirst<{
    session_id: string
    user_id: string
    email: string
    display_name: string
    must_change_password: number
  }>(db, `
    SELECT s.id AS session_id, u.id AS user_id, u.email, u.display_name,
           COALESCE(c.must_change_password, 0) AS must_change_password
      FROM admin_sessions s
      JOIN admin_users u ON u.id = s.user_id
      LEFT JOIN admin_credentials c ON c.user_id = u.id
     WHERE s.token_hash = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > datetime('now')
       AND u.is_active = 1
  `, [tokenHash])
  if (!row) return null

  const access = await loadUserAccess(db, row.user_id)
  return {
    id: row.user_id,
    email: row.email,
    display_name: row.display_name,
    roles: access.roles,
    permissions: access.permissions,
    grants: access.grants,
    must_change_password: Number(row.must_change_password) === 1,
  }
}

/// يسجّل آخر ظهور للجلسة. أفضل جهد: فشله لا يمنع الطلب.
export async function touchSession(db: D1Database, token: string) {
  try {
    const tokenHash = await sha256Base64Url(token)
    await db.prepare(
      `UPDATE admin_sessions SET last_seen_at = datetime('now') WHERE token_hash = ?`,
    ).bind(tokenHash).run()
  } catch {
    // تتبّع الظهور ليس جزءًا من التصريح
  }
}

export async function revokeSession(db: D1Database, token: string) {
  const tokenHash = await sha256Base64Url(token)
  await db.prepare(
    `UPDATE admin_sessions SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL`,
  ).bind(tokenHash).run()
}

/// يسحب كل جلسات مستخدم. يُستخدم عند تغيير كلمة المرور أو تعطيل الحساب.
export async function revokeAllSessions(db: D1Database, userId: string) {
  await db.prepare(
    `UPDATE admin_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`,
  ).bind(userId).run()
}

/* ------------------------------------------------------- كلمات المرور */

export async function setPassword(
  db: D1Database,
  userId: string,
  password: string,
  options: { mustChange?: boolean } = {},
) {
  const hash = await hashPassword(password)
  await db.prepare(`
    INSERT INTO admin_credentials (user_id, password_hash, must_change_password)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      password_hash = excluded.password_hash,
      password_updated_at = datetime('now'),
      must_change_password = excluded.must_change_password,
      failed_login_count = 0,
      locked_until = NULL,
      updated_at = datetime('now')
  `).bind(userId, hash, options.mustChange ? 1 : 0).run()
}

/**
 * يغيّر كلمة المرور بعد التحقق من الحالية.
 *
 * يسحب كل الجلسات الأخرى بعد النجاح: تغيير كلمة المرور غالبًا استجابة لشكّ
 * في تسريب، وترك الجلسات القائمة يُبقي المتسلّل داخلًا.
 */
export async function changePassword(
  db: D1Database,
  userId: string,
  currentPassword: string,
  nextPassword: string,
): Promise<{ ok: true } | { ok: false; reason: 'invalid_current' | 'no_credentials' }> {
  const credentials = await queryFirst<{ password_hash: string }>(
    db, 'SELECT password_hash FROM admin_credentials WHERE user_id = ?', [userId],
  )
  if (!credentials) return { ok: false, reason: 'no_credentials' }
  if (!await verifyPassword(currentPassword, credentials.password_hash)) {
    return { ok: false, reason: 'invalid_current' }
  }
  await setPassword(db, userId, nextPassword, { mustChange: false })
  await revokeAllSessions(db, userId)
  return { ok: true }
}

/* -------------------------------------------------------------- الصلاحيات */

/// الأدوار التي تتخطّى فحص النطاق. تُبقى قائمة صغيرة ومقصودة.
const SUPERUSER_ROLES = ['owner', 'system_admin'] as const

export function isSuperuser(user: { roles: string[] }): boolean {
  return user.roles.some((role) => (SUPERUSER_ROLES as readonly string[]).includes(role))
}

/**
 * هل يطابق منحٌ واحد الموردَ المطلوب؟
 *
 * ## قاعدة المطابقة
 *
 * حقل `null` في المنح يعني «كل شيء في هذا البعد»، فهو يطابق دائمًا. أما القيمة
 * المحدّدة فتُطابق نظيرها فقط.
 *
 * والأهم: إن حدّد المنح بعدًا ولم يذكره المورد المطلوب (`undefined`) فالمطابقة
 * **تفشل**. مثال: منح مقصور على `language='en'` لا يسمح بعملية لم تُعلن لغتها،
 * لأن السماح بها يعني تجاوز القيد بمجرد إغفال المعلومة — وهو أسهل تجاوز ممكن.
 */
function grantMatchesScope(grant: AccessGrant, scope: ResourceScope): boolean {
  if (grant.content_type && grant.content_type !== scope.contentType) return false
  if (grant.language && grant.language !== scope.language) return false

  switch (grant.scope_type) {
    // منصّة: يطابق كل شيء
    case 'platform':
      return true
    case 'planet':
      return !grant.scope_id || grant.scope_id === scope.planetId
    case 'section':
      return !grant.scope_id || grant.scope_id === scope.sectionId
    case 'series':
      return !grant.scope_id || grant.scope_id === scope.seriesId
    case 'content':
      return !grant.scope_id || grant.scope_id === scope.contentId
    case 'page':
      return !grant.scope_id || grant.scope_id === scope.pageId
    case 'language':
      return !grant.scope_id || grant.scope_id === scope.language
    default:
      return false
  }
}

/**
 * هل يملك المستخدم صلاحية `action` على المورد الموصوف بـ`scope`؟
 *
 * ## العلّة التي يعالجها هذا
 *
 * كان `hasPermission` يفحص قائمة نصوص مسطّحة، فأي منح بأي نطاق يمنح الصلاحية
 * في كل مكان. الآن يجب أن يوجد **منح واحد على الأقل** يحمل الصلاحية *و*
 * يطابق المورد.
 *
 * المالك ومدير النظام يتخطّيان النطاق: هذا مقصود ومحدود بدورين فقط.
 */
export function can(
  user: { roles: string[]; grants?: AccessGrant[] },
  action: string,
  scope: ResourceScope = {},
): boolean {
  if (isSuperuser(user)) return true
  const grants = user.grants ?? []
  return grants.some((grant) => grant.permissions.includes(action) && grantMatchesScope(grant, scope))
}

/**
 * فحص الصلاحية بلا نطاق: هل يملكها في أي مكان؟
 *
 * للعمليات غير المرتبطة بمحتوى بعينه، مثل عرض قائمة أو إدارة المستخدمين.
 * لا يصحّ استخدامه لحماية تعديل محتوى، لأنه يتجاهل النطاق بالتعريف.
 */
export function hasPermission(user: { roles: string[]; permissions?: string[] }, action: string): boolean {
  if (isSuperuser(user)) return true
  return (user.permissions ?? []).includes(action)
}

/// تنظيف الجلسات المنتهية. يُنادى من المهمة المجدولة.
export async function purgeExpiredSessions(db: D1Database) {
  const result = await db.prepare(
    `DELETE FROM admin_sessions WHERE expires_at < datetime('now', '-30 days')`,
  ).run()
  return result.meta?.changes ?? 0
}

/**
 * هل نظام المستخدمين مُهيّأ؟
 *
 * يُستخدم ليقرّر الحرس هل يقبل ADMIN_API_KEY كمخرج طارئ. قبل بذر أول مستخدم
 * لا يوجد سبيل آخر للدخول، فمنع المفتاح وقتها يقفل الباب على الجميع.
 *
 * ## لماذا يلتقط الخطأ
 *
 * الجدول قد لا يكون موجودًا: نشر الـWorker قبل تطبيق المهاجرة نافذة حقيقية،
 * وهي الحالة القائمة على الإنتاج الآن حيث لم تُطبَّق 0014 ولا 0019 بعد. بلا
 * هذا الالتقاط يرمي الاستعلام، فيرتفع الاستثناء عبر الحرس ويُعيد **كل** مسار
 * إداري 500 — أي قفل كامل بلا مخرج، وهو أسوأ من فقدان الميزة.
 *
 * الرجوع إلى `false` يُبقي المفتاح المشترك بابًا صالحًا حتى تُطبَّق المهاجرة،
 * فيكون الفشل مفتوحًا بقدر ما كان قبل هذا العمل لا أضيق.
 */
export async function hasAnyAdminUser(db: D1Database): Promise<boolean> {
  try {
    const row = await queryFirst<{ total: number }>(
      db, 'SELECT COUNT(*) AS total FROM admin_credentials',
    )
    return Number(row?.total ?? 0) > 0
  } catch (error) {
    console.warn(
      'admin_credentials_unavailable',
      error instanceof Error ? error.message : String(error),
    )
    return false
  }
}

/// نوع مساعد لتمرير المستخدم المُصادَق في سياق Hono
export type AdminAuthVariables = {
  adminUser?: AdminSessionUser
  /// صحيح عند الدخول بالمفتاح المشترك لا بحساب مستخدم
  adminIsLegacyKey?: boolean
}

export type { Env }
