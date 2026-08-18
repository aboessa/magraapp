import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { isEmailAddress, parseEmailList, sendEmail } from '../lib/email.ts'
import { consumeRateLimit, generalLimit } from '../lib/rateLimit.ts'
import {
  buildPartnershipEmail,
  KINDS,
  LOCALES,
  markEmailResult,
  readSetting,
  type PartnershipKind,
  type PartnershipLocale,
} from '../lib/partnerships.ts'

type AppEnv = { Bindings: Env }

const partnershipsRoute = new Hono<AppEnv>()

/**
 * حد أضيق من generalLimit: النموذج بشري لا آلي، وخمسة طلبات مقبولة في الساعة
 * من عنوان واحد أكثر من كافٍ. generalLimit يبقى طبقة أولى للحماية العامة.
 *
 * يُستهلك بعد نجاح التحقق لا قبله، فالمدخلات الخاطئة لا تحرق حصة صاحبها.
 */
const SUBMIT_LIMIT = { windowMs: 60 * 60_000, max: 5, keyPrefix: 'partnership-submit' }

const LIMITS = {
  name: 120,
  organization: 160,
  email: 254,
  phone: 40,
  country: 80,
  message: 4000,
}

function text(value: unknown, max: number) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

partnershipsRoute.post('/', generalLimit, async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'صيغة الطلب غير صالحة' }, 400)

  // فخ البوتات: حقل مخفي يجب أن يبقى فارغًا. نُعيد نجاحًا كاذبًا حتى لا
  // يتعلّم المُرسِل الآلي أن الحقل هو ما كشفه.
  const honeypot = typeof body.website === 'string' ? body.website.trim() : ''
  if (honeypot) return c.json({ success: true, data: { id: null } }, 202)

  const kind = typeof body.kind === 'string' && (KINDS as readonly string[]).includes(body.kind)
    ? body.kind as PartnershipKind
    : null
  const name = text(body.name, LIMITS.name)
  const organization = text(body.organization, LIMITS.organization)
  const email = text(body.email, LIMITS.email)
  const message = text(body.message, LIMITS.message)
  const phone = text(body.phone, LIMITS.phone)
  const country = text(body.country, LIMITS.country)
  const locale = typeof body.locale === 'string' && (LOCALES as readonly string[]).includes(body.locale)
    ? body.locale as PartnershipLocale
    : 'ar'

  if (!kind) return c.json({ success: false, error: 'نوع الجهة غير صالح' }, 400)
  if (!name) return c.json({ success: false, error: 'الاسم مطلوب' }, 400)
  if (!organization) return c.json({ success: false, error: 'اسم الجهة مطلوب' }, 400)
  if (!email || !isEmailAddress(email)) return c.json({ success: false, error: 'البريد الإلكتروني غير صالح' }, 400)
  if (!message || message.length < 10) return c.json({ success: false, error: 'تفاصيل التعاون مطلوبة' }, 400)

  // بعد التحقق: الطلب صالح، والآن يستهلك حصة الإرسال
  const quota = await consumeRateLimit(c, SUBMIT_LIMIT)
  if (!quota.allowed) {
    c.header('Retry-After', String(quota.retryAfter))
    return c.json({ success: false, error: 'طلبات كثيرة، انتظر قليلًا وأعد المحاولة' }, 429)
  }

  const id = crypto.randomUUID()
  const sourceIp = c.req.header('CF-Connecting-IP') ?? null
  const userAgent = c.req.header('User-Agent')?.slice(0, 300) ?? null

  // نحفظ أولًا: الطلب لا يُفقد لو سقط مزوّد البريد
  try {
    await c.env.DB.prepare(`
      INSERT INTO partnership_requests
        (id, kind, name, organization, email, phone, country, message, locale, source_ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, kind, name, organization, email, phone, country, message, locale, sourceIp, userAgent).run()
  } catch (error) {
    console.error('partnership_insert_failed', error instanceof Error ? error.message : String(error))
    return c.json({ success: false, error: 'تعذر حفظ الطلب' }, 500)
  }

  const inbox = await readSetting(c.env.DB, 'partnership_inbox_email')
  if (!isEmailAddress(inbox)) {
    // الطلب محفوظ ويظهر في اللوحة، لكن لا بريد مضبوط بعد.
    // لا نُفشل الزائر على إعداد ناقص عندنا.
    await markEmailResult(c.env.DB, id, 'skipped', 'لم يُضبط بريد استقبال الشراكات في اللوحة')
    console.warn('partnership_inbox_unset', id)
    return c.json({ success: true, data: { id } }, 201)
  }

  const fromOverride = await readSetting(c.env.DB, 'partnership_from_email')
  const cc = parseEmailList(await readSetting(c.env.DB, 'partnership_cc_emails'))
  const mail = buildPartnershipEmail({
    id, kind, name, organization, email, phone, country, message, locale,
  })

  const result = await sendEmail(c.env, {
    to: { email: inbox },
    ...(isEmailAddress(fromOverride) ? { from: { email: fromOverride, name: 'Majarra' } } : {}),
    ...(cc.length ? { cc: cc.map((address) => ({ email: address })) } : {}),
    // الرد يذهب لصاحب الطلب مباشرة
    replyTo: { email, name },
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  })

  if (result.ok) {
    await markEmailResult(c.env.DB, id, 'sent', null)
  } else {
    await markEmailResult(c.env.DB, id, 'failed', result.error)
    console.error('partnership_email_failed', id, result.error)
  }

  // الطلب وصلنا فعلًا، وفشل البريد شأن داخلي يظهر في اللوحة
  return c.json({ success: true, data: { id } }, 201)
})

/**
 * فحص خفيف يخبر الواجهة أن النموذج يستقبل.
 * لا يُعيد إحصاءات ولا حالة إعداد البريد: تلك بيانات داخلية
 * ولا سبب لكشفها لزائر غير مُصادق.
 */
partnershipsRoute.get('/status', generalLimit, (c) => c.json({
  success: true,
  data: { accepting: true },
}))

export default partnershipsRoute
