import type { Env } from '../lib/db.ts';
import { sha256Base64Url } from '../lib/security.ts';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

type SendResult =
  | { ok: true; provider: 'cloudflare' | 'resend'; providerId: string }
  | { ok: false; reason: 'unconfigured' | 'provider_error' };

type Message = {
  subject: string;
  text: string;
  html: string;
  idempotencySeed: string;
};

function configuredValue(value: string | undefined, maximum: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum
    ? value.trim()
    : null;
}

function configuredHttpsUrl(value: string | undefined) {
  const configured = configuredValue(value, 2048);
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function hasCloudflareBinding(env: Env): boolean {
  return !!env.EMAIL && typeof env.EMAIL.send === 'function';
}

function hasDeliveryProvider(env: Env) {
  return hasCloudflareBinding(env) || !!configuredValue(env.RESEND_API_KEY, 500);
}

export function emailIsConfigured(env: Env): boolean {
  return Boolean(
    configuredValue(env.EMAIL_FROM, 320)
      && configuredHttpsUrl(env.EMAIL_VERIFICATION_URL)
      && hasDeliveryProvider(env),
  );
}

export function passwordResetEmailIsConfigured(env: Env): boolean {
  return Boolean(
    configuredValue(env.EMAIL_FROM, 320)
      && configuredHttpsUrl(env.PASSWORD_RESET_URL)
      && hasDeliveryProvider(env),
  );
}

function actionLink(base: string, token: string, placement: 'query' | 'fragment' = 'query'): string {
  const url = new URL(base);
  if (placement === 'fragment') {
    // Fragments are not sent in HTTP requests or Referer headers, keeping the
    // reset capability out of edge logs. Flutter captures it in memory and
    // immediately redirects to the fragment-free route.
    url.hash = new URLSearchParams({ token }).toString();
  } else {
    url.searchParams.set('token', token);
  }
  return url.toString();
}

function escaped(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function verificationMessage(env: Env, token: string): Message {
  const link = actionLink(env.EMAIL_VERIFICATION_URL!, token);
  return {
    subject: 'تأكيد البريد الإلكتروني لحساب مجرة',
    text: `لتأكيد حسابك في مجرة افتح الرابط التالي:\n${link}\n\nتنتهي صلاحية الرابط خلال ساعة واحدة.`,
    html: `<div dir="rtl" lang="ar"><h2>تأكيد حساب مجرة</h2><p>اضغط على الرابط التالي لتأكيد بريدك الإلكتروني:</p><p><a href="${escaped(link)}">تأكيد البريد الإلكتروني</a></p><p>تنتهي صلاحية الرابط خلال ساعة واحدة.</p></div>`,
    idempotencySeed: `verify-email:${token}`,
  };
}

function passwordResetMessage(env: Env, token: string): Message {
  const link = actionLink(env.PASSWORD_RESET_URL!, token, 'fragment');
  return {
    subject: 'إعادة تعيين كلمة مرور حساب مجرة',
    text: `طلبت إعادة تعيين كلمة مرور حسابك في مجرة. افتح الرابط التالي:\n${link}\n\nتنتهي صلاحية الرابط خلال 30 دقيقة. إذا لم تطلب ذلك، فتجاهل الرسالة.`,
    html: `<div dir="rtl" lang="ar"><h2>إعادة تعيين كلمة المرور</h2><p>اضغط على الرابط التالي لاختيار كلمة مرور جديدة:</p><p><a href="${escaped(link)}">إعادة تعيين كلمة المرور</a></p><p>تنتهي صلاحية الرابط خلال 30 دقيقة. إذا لم تطلب ذلك، فتجاهل الرسالة.</p></div>`,
    idempotencySeed: `password-reset:${token}`,
  };
}

async function sendViaCloudflare(env: Env, recipient: string, message: Message): Promise<SendResult> {
  if (!hasCloudflareBinding(env)) return { ok: false, reason: 'unconfigured' };
  const from = configuredValue(env.EMAIL_FROM, 320)!;
  try {
    const fromEmail = from.includes('<') ? from.match(/<(.+)>/)?.[1] || from : from;
    const fromName = from.includes('<') ? from.split('<')[0].trim() : 'مجرة';
    const result: any = await env.EMAIL.send({
      to: recipient,
      from: { email: fromEmail, name: fromName },
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    const id = result?.messageId || result?.id || `cloudflare-${Date.now()}`;
    return { ok: true, provider: 'cloudflare', providerId: String(id) };
  } catch {
    console.error('cloudflare_email_failed');
    return { ok: false, reason: 'provider_error' };
  }
}

async function sendViaResend(env: Env, recipient: string, message: Message): Promise<SendResult> {
  const apiKey = configuredValue(env.RESEND_API_KEY, 500);
  if (!apiKey) return { ok: false, reason: 'unconfigured' };
  const from = configuredValue(env.EMAIL_FROM, 320)!;
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': await sha256Base64Url(message.idempotencySeed),
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return { ok: false, reason: 'provider_error' };
  const result = (await response.json().catch(() => null)) as { id?: unknown } | null;
  return typeof result?.id === 'string'
    ? { ok: true, provider: 'resend', providerId: result.id }
    : { ok: false, reason: 'provider_error' };
}

async function send(env: Env, recipient: string, message: Message): Promise<SendResult> {
  if (hasCloudflareBinding(env)) {
    const cloudflare = await sendViaCloudflare(env, recipient, message);
    if (cloudflare.ok) return cloudflare;
    console.warn('cloudflare_send_failed_fallback_to_resend');
  }
  return sendViaResend(env, recipient, message);
}

export async function sendVerificationEmail(env: Env, recipient: string, token: string): Promise<SendResult> {
  if (!emailIsConfigured(env)) return { ok: false, reason: 'unconfigured' };
  return send(env, recipient, verificationMessage(env, token));
}

export async function sendPasswordResetEmail(env: Env, recipient: string, token: string): Promise<SendResult> {
  if (!passwordResetEmailIsConfigured(env)) return { ok: false, reason: 'unconfigured' };
  return send(env, recipient, passwordResetMessage(env, token));
}
