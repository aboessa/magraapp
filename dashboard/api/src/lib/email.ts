import type { Env } from './db'

/**
 * إرسال البريد من الـWorker.
 *
 * مزوّدان بترتيب أفضلية:
 *  1. RESEND_API_KEY — واجهة HTTP، تُرسل إلى أي عنوان.
 *  2. رابط EMAIL (send_email) الخاص بـCloudflare Email Routing.
 *
 * قيد مهم على الخيار الثاني: Cloudflare لا يسمح بالإرسال إلا إلى عنوان
 * مُتحقَّق منه كـdestination address داخل النطاق نفسه. فبريد استقبال
 * طلبات الشراكة يجب التحقق منه في لوحة Cloudflare أولًا، وإلا فشل الإرسال
 * ولو كان العنوان صحيحًا. عند الحاجة لإرسال حر استخدم Resend.
 */

export type EmailAddress = { email: string; name?: string }

export type EmailMessagePayload = {
  to: EmailAddress
  from?: EmailAddress
  /** يظهر كعنوان الرد، فيمكن للفريق الرد على المُرسل مباشرة */
  replyTo?: EmailAddress
  cc?: EmailAddress[]
  subject: string
  text: string
  html?: string
}

export type SendResult =
  | { ok: true; provider: 'resend' | 'cloudflare' }
  | { ok: false; provider: 'resend' | 'cloudflare' | 'none'; error: string }

const EMAIL_PATTERN = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/

export function isEmailAddress(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value.trim())
}

/** يقسّم قائمة عناوين مفصولة بفواصل ويُسقِط غير الصالح بصمت */
export function parseEmailList(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => isEmailAddress(entry))
}

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** RFC 2047: يسمح بعنوان رسالة عربي دون أن يُشوَّه في العميل */
function encodedWord(value: string) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(value)) return value
  return `=?UTF-8?B?${base64Utf8(value)}?=`
}

function formatAddress(address: EmailAddress) {
  if (!address.name) return address.email
  return `${encodedWord(address.name)} <${address.email}>`
}

/**
 * يبني رسالة MIME متعددة الأجزاء يدويًا.
 * الجسم بترميز base64 لأن سطور UTF-8 الطويلة تُقطع في quoted-printable
 * فتنكسر العربية في منتصف محرف.
 */
function buildMime(payload: EmailMessagePayload, from: EmailAddress) {
  const boundary = `mj-${crypto.randomUUID()}`
  const headers = [
    `From: ${formatAddress(from)}`,
    `To: ${formatAddress(payload.to)}`,
    ...(payload.cc?.length ? [`Cc: ${payload.cc.map(formatAddress).join(', ')}`] : []),
    ...(payload.replyTo ? [`Reply-To: ${formatAddress(payload.replyTo)}`] : []),
    `Subject: ${encodedWord(payload.subject)}`,
    `Message-ID: <${crypto.randomUUID()}@majarra.app>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
  ]

  if (!payload.html) {
    return [
      ...headers,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64Utf8(payload.text),
      '',
    ].join('\r\n')
  }

  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Utf8(payload.text),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Utf8(payload.html),
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

async function sendViaResend(env: Env, payload: EmailMessagePayload, from: EmailAddress): Promise<SendResult> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: formatAddress(from),
        to: [payload.to.email],
        ...(payload.cc?.length ? { cc: payload.cc.map((entry) => entry.email) } : {}),
        ...(payload.replyTo ? { reply_to: payload.replyTo.email } : {}),
        subject: payload.subject,
        text: payload.text,
        ...(payload.html ? { html: payload.html } : {}),
      }),
    })

    if (response.ok) return { ok: true, provider: 'resend' }
    const body = await response.text().catch(() => '')
    return { ok: false, provider: 'resend', error: `resend ${response.status}: ${body.slice(0, 300)}` }
  } catch (error) {
    return { ok: false, provider: 'resend', error: error instanceof Error ? error.message : String(error) }
  }
}

async function sendViaCloudflare(env: Env, payload: EmailMessagePayload, from: EmailAddress): Promise<SendResult> {
  try {
    // الاستيراد ديناميكي حتى لا تفشل الوحدة في بيئات بلا وحدة cloudflare:email
    const { EmailMessage } = await import('cloudflare:email') as {
      EmailMessage: new (from: string, to: string, raw: string) => unknown
    }
    const message = new EmailMessage(from.email, payload.to.email, buildMime(payload, from))
    await env.EMAIL.send(message)
    return { ok: true, provider: 'cloudflare' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, provider: 'cloudflare', error: `cloudflare: ${message.slice(0, 300)}` }
  }
}

export async function sendEmail(env: Env, payload: EmailMessagePayload): Promise<SendResult> {
  const fromEmail = payload.from?.email ?? env.EMAIL_FROM
  if (!isEmailAddress(fromEmail)) {
    return { ok: false, provider: 'none', error: 'EMAIL_FROM غير مضبوط أو غير صالح' }
  }
  if (!isEmailAddress(payload.to.email)) {
    return { ok: false, provider: 'none', error: 'عنوان المستلم غير صالح' }
  }

  const from: EmailAddress = { email: fromEmail, name: payload.from?.name ?? 'Majarra' }

  if (env.RESEND_API_KEY) return sendViaResend(env, payload, from)
  if (env.EMAIL) return sendViaCloudflare(env, payload, from)
  return { ok: false, provider: 'none', error: 'لا مزوّد بريد مضبوط: اضبط RESEND_API_KEY أو رابط EMAIL' }
}
