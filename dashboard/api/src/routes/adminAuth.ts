import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { sha256Base64Url } from '../lib/security.ts'
import { consumeRateLimit } from '../lib/rateLimit.ts'
import {
  changePassword,
  hasAnyAdminUser,
  login,
  normalizeEmail,
  resolveSession,
  revokeAllSessions,
  revokeSession,
  validatePassword,
  type AdminSessionUser,
} from '../lib/adminUsers.ts'

type AppEnv = { Bindings: Env }

const adminAuthRoute = new Hono<AppEnv>()

/**
 * مصادقة لوحة الإدارة: دخول بالبريد وكلمة المرور.
 *
 * ## غير محروسة عن قصد
 *
 * مسارات الدخول لا يمكن أن تتطلّب جلسة، فهي التي تُنشئها. الحماية هنا بحدّ
 * المحاولات وقفل الحساب لا بالتصريح.
 *
 * ## لماذا لا تُركَّب تحت /api/v1/admin
 *
 * ذلك المسار يحمل adminLimit وهو ١٢٠ محاولة في الدقيقة، وهو فضفاض على نقطة
 * دخول. تُركَّب هنا بحدّها الخاص الأضيق.
 */

/// حدّ محاولات الدخول: خمس محاولات في الدقيقة من عنوان واحد.
const LOGIN_LIMIT = { windowMs: 60_000, max: 5, keyPrefix: 'admin-login' }

/// حدّ أوسع للنداءات التي تقرأ الجلسة فقط.
const SESSION_LIMIT = { windowMs: 60_000, max: 60, keyPrefix: 'admin-session' }

function bearer(c: { req: { header: (name: string) => string | undefined } }) {
  return c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')?.trim() ?? ''
}

/// شكل المستخدم المُعاد للواجهة. لا يحمل أي سرّ.
function publicUser(user: AdminSessionUser) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    roles: user.roles,
    permissions: user.permissions,
    must_change_password: user.must_change_password,
  }
}

/**
 * حالة نظام المصادقة، تُقرأ قبل الدخول.
 *
 * تخبر الواجهة هل هناك مستخدمون مُهيّأون أصلًا، فتعرض شاشة الدخول بالبريد أو
 * تشرح أن النظام لم يُبذَر بعد. لا تكشف أي بريد ولا عددًا: مجرد نعم أو لا.
 */
adminAuthRoute.get('/status', async (c) => {
  const configured = await hasAnyAdminUser(c.env.DB)
  return c.json({
    success: true,
    data: {
      users_configured: configured,
      // يخبر الواجهة أن المخرج الطارئ بالمفتاح المشترك ما زال متاحًا
      legacy_key_available: !configured && !!c.env.ADMIN_API_KEY,
    },
  })
})

adminAuthRoute.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'صيغة الطلب غير صالحة' }, 400)

  const email = normalizeEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''

  // التحقق من الشكل قبل استهلاك الحصة، فبريد فيه خطأ مطبعي لا يحرق المحاولات
  if (!email || !password) {
    return c.json({ success: false, error: 'البريد وكلمة المرور مطلوبان' }, 400)
  }

  const quota = await consumeRateLimit(c, LOGIN_LIMIT)
  if (!quota.allowed) {
    c.header('Retry-After', String(quota.retryAfter))
    return c.json({ success: false, error: 'محاولات كثيرة، انتظر قليلًا وأعد المحاولة' }, 429)
  }

  const result = await login(c.env.DB, email, password, {
    userAgent: c.req.header('User-Agent') ?? null,
    sourceIp: c.req.header('CF-Connecting-IP') ?? null,
  })

  if (!result.ok) {
    if (result.reason === 'locked') {
      c.header('Retry-After', String(result.retryAfterSeconds))
      return c.json({
        success: false,
        error: 'الحساب مقفل مؤقتًا بعد محاولات فاشلة متكرّرة. أعد المحاولة بعد قليل.',
      }, 429)
    }
    if (result.reason === 'inactive') {
      // حساب معطَّل: رسالة مختلفة لأن صاحبه يحتاج معرفة السبب لا تخمينه
      return c.json({ success: false, error: 'هذا الحساب معطَّل. راجع مدير النظام.' }, 403)
    }
    // 'invalid' و'no_credentials' يشتركان في نفس الرسالة: التمييز بينهما يكشف
    // من له حساب على المنصّة ومن لا.
    return c.json({ success: false, error: 'البريد أو كلمة المرور غير صحيحة' }, 401)
  }

  return c.json({
    success: true,
    data: {
      token: result.token,
      expires_at: result.expiresAt,
      user: publicUser(result.user),
    },
  })
})

/// من أنا؟ تُستخدمها الواجهة للتحقق من صلاحية الجلسة عند التحميل.
adminAuthRoute.get('/me', async (c) => {
  const token = bearer(c)
  if (!token) return c.json({ success: false, error: 'Unauthorized' }, 401)

  const quota = await consumeRateLimit(c, SESSION_LIMIT)
  if (!quota.allowed) {
    c.header('Retry-After', String(quota.retryAfter))
    return c.json({ success: false, error: 'طلبات كثيرة' }, 429)
  }

  const user = await resolveSession(c.env.DB, token)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  return c.json({ success: true, data: { user: publicUser(user) } })
})

adminAuthRoute.post('/logout', async (c) => {
  const token = bearer(c)
  // الخروج فكرة لا تفشل: رمز غير صالح يعني أن الجلسة زالت أصلًا
  if (token) await revokeSession(c.env.DB, token)
  return c.json({ success: true, data: { signed_out: true } })
})

/// جلسات المتصل نفسه.
///
/// ## الثغرة التي يسدّها هذا
///
/// شاشة «جلساتي» كانت تعرض مصفوفة وهمية مكتوبة في الملف، وزرّ السحب فيها بلا
/// معالج، ونداء «سحب الجلسات الأخرى» يستدعي مسارًا بمعرّف غير صالح (`'me'`)
/// ويُهمل الخطأ. أي أن جلسة مسروقة لم يكن ممكنًا رؤيتها ولا إبطالها من اللوحة.
///
/// المسار الموجود `GET /users/:id/sessions` يطلب صلاحية `manage_permissions`،
/// وهي صلاحية إدارة الآخرين — فلا تصلح لأن يرى الإداريّ العاديّ جلساته هو.
/// لذلك هذه النقاط **مقصورة على المتصل**: لا معرّف مستخدم في المسار، فلا مجال
/// لقراءة جلسات غيره أو إبطالها.
adminAuthRoute.get('/sessions', async (c) => {
  const token = bearer(c)
  if (!token) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const user = await resolveSession(c.env.DB, token)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)

  // الجلسة الحالية تُعرَف بمطابقة بصمة الرمز، فلا يُعاد الرمز الخام أبدًا.
  const currentHash = await sha256Base64Url(token)
  const rows = await queryAll<{
    id: string
    token_hash: string
    user_agent: string | null
    source_ip: string | null
    created_at: string
    last_seen_at: string | null
    expires_at: string
  }>(c.env.DB, `
    SELECT id, token_hash, user_agent, source_ip, created_at, last_seen_at, expires_at
      FROM admin_sessions
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')
     ORDER BY last_seen_at DESC
  `, [user.id])

  return c.json({
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      user_agent: row.user_agent,
      source_ip: row.source_ip,
      created_at: row.created_at,
      last_seen_at: row.last_seen_at,
      expires_at: row.expires_at,
      current: row.token_hash === currentHash,
    })),
  })
})

/// يسحب جلسة واحدة للمتصل. المعرّف يُقيَّد بـ`user_id` فلا يمكن سحب جلسة غيره.
adminAuthRoute.delete('/sessions/:id', async (c) => {
  const token = bearer(c)
  if (!token) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const user = await resolveSession(c.env.DB, token)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)

  const sessionId = c.req.param('id')
  const currentHash = await sha256Base64Url(token)
  const target = await queryFirst<{ id: string; token_hash: string }>(
    c.env.DB,
    `SELECT id, token_hash FROM admin_sessions
      WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
    [sessionId, user.id],
  )
  if (!target) return c.json({ success: false, error: 'الجلسة غير موجودة' }, 404)

  // سحب الجلسة الحالية من هذه الشاشة يُربك: زرّ الخروج هو مكانه.
  if (target.token_hash === currentHash) {
    return c.json({ success: false, error: 'استخدم تسجيل الخروج لإنهاء الجلسة الحالية' }, 400)
  }

  await c.env.DB.prepare(
    `UPDATE admin_sessions SET revoked_at = datetime('now') WHERE id = ? AND user_id = ?`,
  ).bind(sessionId, user.id).run()
  return c.json({ success: true, data: { id: sessionId, revoked: true } })
})

/// يسحب كل جلسات المتصل **عدا الحالية**، فلا يُخرج نفسه بالضغط على زرّ مراجعة.
adminAuthRoute.post('/sessions/revoke-others', async (c) => {
  const token = bearer(c)
  if (!token) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const user = await resolveSession(c.env.DB, token)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)

  const currentHash = await sha256Base64Url(token)
  const result = await c.env.DB.prepare(
    `UPDATE admin_sessions SET revoked_at = datetime('now')
      WHERE user_id = ? AND revoked_at IS NULL AND token_hash <> ?`,
  ).bind(user.id, currentHash).run()

  return c.json({ success: true, data: { revoked: result.meta.changes ?? 0 } })
})

/// تسجيل الخروج من كل الأجهزة. يحتاج جلسة صالحة.
adminAuthRoute.post('/logout-all', async (c) => {
  const token = bearer(c)
  if (!token) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const user = await resolveSession(c.env.DB, token)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)

  await revokeAllSessions(c.env.DB, user.id)
  return c.json({ success: true, data: { signed_out_everywhere: true } })
})

/**
 * تغيير كلمة المرور.
 *
 * يتطلّب كلمة المرور الحالية حتى لا يستطيع من استولى على جلسة مفتوحة أن يُقصي
 * صاحبها بتغيير كلمته. النجاح يسحب كل الجلسات بما فيها الحالية، فالواجهة
 * تُعيد الدخول.
 */
adminAuthRoute.post('/change-password', async (c) => {
  const token = bearer(c)
  if (!token) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const user = await resolveSession(c.env.DB, token)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'صيغة الطلب غير صالحة' }, 400)

  const current = typeof body.current_password === 'string' ? body.current_password : ''
  const next = typeof body.new_password === 'string' ? body.new_password : ''
  if (!current) return c.json({ success: false, error: 'كلمة المرور الحالية مطلوبة' }, 400)

  const weak = validatePassword(next)
  if (weak) return c.json({ success: false, error: weak }, 400)
  if (next === current) {
    return c.json({ success: false, error: 'كلمة المرور الجديدة مطابقة للحالية' }, 400)
  }

  const quota = await consumeRateLimit(c, LOGIN_LIMIT)
  if (!quota.allowed) {
    c.header('Retry-After', String(quota.retryAfter))
    return c.json({ success: false, error: 'محاولات كثيرة، انتظر قليلًا' }, 429)
  }

  const result = await changePassword(c.env.DB, user.id, current, next)
  if (!result.ok) {
    return c.json({ success: false, error: 'كلمة المرور الحالية غير صحيحة' }, 400)
  }

  try {
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details)
      VALUES (?, ?, 'update', 'admin_user', ?, ?)
    `).bind(
      crypto.randomUUID(), user.id, user.id,
      JSON.stringify({ change: 'password' }),
    ).run()
  } catch (error) {
    // كلمة المرور غُيّرت فعلًا، وفشل التدقيق لا يستحق إفشال الاستجابة
    console.error('admin_password_audit_failed', error instanceof Error ? error.message : String(error))
  }

  // الجلسات كلها سُحبت، فالواجهة تعلم أنها تحتاج دخولًا جديدًا
  return c.json({ success: true, data: { changed: true, reauthenticate: true } })
})

export default adminAuthRoute
