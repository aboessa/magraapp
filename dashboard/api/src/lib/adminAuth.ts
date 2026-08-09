import type { Context, Next } from 'hono'
import type { Env } from './db'
// امتداد `.ts` صريح: مجموعة الاختبارات تعمل بـ`node --experimental-strip-types`
// الذي يطالب بالامتداد في الاستيراد النسبي. بلا ذلك لا يمكن استيراد أي مُوجِّه
// يعتمد على هذا الحرس في اختبار. wrangler يقبل الصيغتين، فلا أثر على البناء.
import {
  can,
  hasAnyAdminUser,
  resolveSession,
  touchSession,
  type AdminSessionUser,
  type ResourceScope,
} from './adminUsers.ts'

/**
 * حرس لوحة الإدارة: يقبل جلسة مستخدم حقيقية، ويقبل المفتاح المشترك كمخرج طارئ.
 *
 * ## المسارَان ولماذا كلاهما موجود
 *
 * **جلسة مستخدم** هي الطريق المقصود. الرمز يُحلّ إلى صف في admin_sessions،
 * فيصير للطلب هوية معروفة (`c.get('adminUser')`) بأدوار وصلاحيات، ويمكن سحبه
 * فورًا بتعطيل الحساب أو تسجيل الخروج من كل الأجهزة.
 *
 * **المفتاح المشترك (ADMIN_API_KEY)** يبقى مقبولًا لكن **فقط قبل بذر أول
 * مستخدم**. السبب عملي: بلا مستخدمين لا سبيل للدخول لإنشاء أولهم، فمنع
 * المفتاح وقتها يقفل الباب على الجميع بلا مفتاح. وبعد وجود مستخدم واحد يُرفض
 * المفتاح، فلا يبقى بابان مفتوحان أحدهما بلا هوية.
 *
 * هذه القاعدة تُصحّح العلّة الأصلية: مفتاح واحد يحمله الفريق كله لا يميّز
 * موظفًا عن آخر، وسجل التدقيق كان يعتمد على ترويسة X-Admin-Actor يكتبها
 * المتصل بنفسه بلا أي تحقّق.
 *
 * ## بيئة التطوير
 *
 * تبقى بلا احتكاك عند غياب المفتاح وغياب المستخدمين معًا. أما إن وُجد مستخدم
 * فالتحقّق يُطبَّق محليًا أيضًا، حتى لا يُختبر الكود في بيئة تختلف عن الإنتاج.
 */

export type AdminVariables = {
  adminUser?: AdminSessionUser
  /// صحيح عند الدخول بالمفتاح المشترك لا بحساب مستخدم
  adminIsLegacyKey?: boolean
}

type AdminContext = Context<{ Bindings: Env; Variables: AdminVariables }>

function bearer(c: AdminContext) {
  return c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')?.trim() ?? ''
}

export async function requireAdmin(c: AdminContext, next: Next) {
  const supplied = bearer(c)
  const configuredKey = c.env.ADMIN_API_KEY

  // ١. جلسة مستخدم حقيقية أولًا
  if (supplied) {
    const user = await resolveSession(c.env.DB, supplied)
    if (user) {
      c.set('adminUser', user)
      c.set('adminIsLegacyKey', false)
      // أفضل جهد ولا يُنتظر نجاحه: تتبّع الظهور ليس جزءًا من التصريح
      c.executionCtx?.waitUntil?.(touchSession(c.env.DB, supplied))
      await next()
      return
    }
  }

  // ٢. المخرج الطارئ: المفتاح المشترك، وفقط ما لم يُبذَر مستخدم بعد
  const usersExist = await hasAnyAdminUser(c.env.DB)

  if (usersExist) {
    // النظام مُهيّأ: المفتاح المشترك لم يعد بابًا مقبولًا
    return c.json({ success: false, error: 'Unauthorized' }, 401)
  }

  if (configuredKey) {
    if (supplied && supplied === configuredKey) {
      c.set('adminIsLegacyKey', true)
      // يُسجَّل استخدام المفتاح المشترك: هو استثناء لا وضع طبيعي
      console.warn('admin_legacy_key_used', c.req.method, new URL(c.req.url).pathname)
      await next()
      return
    }
    return c.json({ success: false, error: 'Unauthorized' }, 401)
  }

  // ٣. لا مفتاح ولا مستخدمون: التطوير المحلي يبقى بلا احتكاك، والإنتاج يفشل مغلقًا
  if (c.env.ENVIRONMENT !== 'development') {
    return c.json({ success: false, error: 'Admin API is not configured' }, 503)
  }

  c.set('adminIsLegacyKey', true)
  await next()
}

/**
 * يستخرج نطاق المورد من الطلب.
 *
 * يقرأ معاملات المسار وسلسلة الاستعلام وجسم الطلب، فمسار مثل
 * `PATCH /series/:id` يُنتج `{ seriesId }` ومسار `?planet_id=abjad` يُنتج
 * `{ planetId }`.
 *
 * جسم الطلب يُقرأ عبر `c.req.json()` المخزَّن مؤقتًا في Hono، فلا يُستهلك
 * التدفّق مرتين ولا يمنع المعالج من قراءته بعد الحرس.
 */
async function resourceScope(c: AdminContext): Promise<ResourceScope> {
  const param = (name: string) => {
    try {
      return c.req.param(name) ?? null
    } catch {
      return null
    }
  }
  const query = (name: string) => c.req.query(name) ?? null

  let body: Record<string, unknown> = {}
  if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
    // Hono يخزّن الجسم المُحلَّل، فقراءته هنا لا تمنع المعالج من قراءته لاحقًا
    body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  }

  const pick = (...values: (string | null | undefined)[]) => {
    for (const value of values) if (typeof value === 'string' && value) return value
    return null
  }

  return {
    planetId: pick(param('planetId'), query('planet_id'), body.planet_id as string),
    sectionId: pick(param('sectionId'), query('section'), body.section as string),
    seriesId: pick(param('seriesId'), query('series_id'), body.series_id as string),
    contentId: pick(param('id'), query('content_id'), body.content_id as string),
    pageId: pick(param('pageId'), body.page_id as string),
    contentType: pick(query('content_type'), body.content_type as string),
    language: pick(param('language'), query('language'), body.language as string),
  }
}

/**
 * حرس صلاحية بالنطاق. يُركَّب بعد requireAdmin.
 *
 * ## علّتان كانتا في النسخة السابقة
 *
 * ١. **كان يفشل مفتوحًا**: `if (!user) { await next(); return }` — أي أن أي
 *    طلب بلا مستخدم مُصادَق يمرّ. المفتاح المشترك يمرّ عبره وهو مقبول، لكن
 *    القاعدة كانت أوسع من ذلك بلا داعٍ.
 *
 * ٢. **كان يتجاهل النطاق**: يفحص `user.permissions` المسطّحة، فمنحٌ على سلسلة
 *    واحدة يسمح بالتعديل في كل مكان.
 *
 * الآن يُبنى نطاق المورد من الطلب ويُطابَق مع منح المستخدم. والمفتاح المشترك
 * يمرّ صراحةً (`adminIsLegacyKey`) لا ضمنًا، وهو مقبول فقط قبل بذر أول مستخدم
 * كما يفرض `requireAdmin`.
 */
export function requirePermission(action: string) {
  return async (c: AdminContext, next: Next) => {
    const user = c.get('adminUser')

    // المخرج الطارئ الصريح: بلا مستخدمين لا سبيل لبذر أولهم
    if (!user) {
      if (c.get('adminIsLegacyKey')) {
        await next()
        return
      }
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const scope = await resourceScope(c)
    if (can(user, action, scope)) {
      await next()
      return
    }

    return c.json({
      success: false,
      error: `لا تملك صلاحية «${action}» على هذا المورد`,
    }, 403)
  }
}

/// هوية الفاعل للتدقيق: الهوية المُصادَقة تسبق أي ترويسة يكتبها المتصل.
export function auditActor(c: AdminContext) {
  const user = c.get('adminUser')
  if (user) return user.id
  return c.req.header('X-Admin-Actor')?.slice(0, 120) ?? 'legacy-admin-key'
}
