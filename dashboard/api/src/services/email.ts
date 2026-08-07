import type { Env } from '../lib/db';
import { sha256Base64Url } from '../lib/security.ts';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

type SendResult = { ok: true; provider: 'cloudflare' | 'resend'; providerId: string } | { ok: false; reason: 'unconfigured' | 'provider_error' };

function configuredValue(value: string | undefined, maximum: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum ? value.trim() : null;
}

function hasCloudflareBinding(env: Env): boolean {
  return !!env.EMAIL && typeof env.EMAIL.send === 'function';
}

export function emailIsConfigured(env: Env): boolean {
  const from = configuredValue(env.EMAIL_FROM, 320);
  const verificationUrl = configuredValue(env.EMAIL_VERIFICATION_URL, 2048);
  if (!from || !verificationUrl) return false;
  try {
    if (new URL(verificationUrl).protocol !== 'https:') return false;
  } catch {
    return false;
  }
  // إما Cloudflare (مفضل - لا يحتاج مفتاح) أو Resend
  const hasCloudflare = hasCloudflareBinding(env);
  const hasResend = !!configuredValue(env.RESEND_API_KEY, 500);
  return hasCloudflare || hasResend;
}

function verificationLink(env: Env, token: string): string {
  const url = new URL(env.EMAIL_VERIFICATION_URL!);
  url.searchParams.set('token', token);
  return url.toString();
}

async function sendViaCloudflare(env: Env, recipient: string, token: string): Promise<SendResult> {
  if (!hasCloudflareBinding(env)) return { ok: false, reason: 'unconfigured' };
  const from = configuredValue(env.EMAIL_FROM, 320)!;
  const link = verificationLink(env, token);
  try {
    // Workers binding: from: { email, name }
    const fromEmail = from.includes('<') ? from.match(/<(.+)>/)?.[1] || from : from;
    const fromName = from.includes('<') ? from.split('<')[0].trim() : 'مجرة';
    const res: any = await env.EMAIL.send({
      to: recipient,
      from: { email: fromEmail, name: fromName },
      subject: 'تأكيد البريد الإلكتروني لحساب مجرة',
      text: `لتأكيد حسابك في مجرة افتح الرابط التالي:\n${link}\n\nتنتهي صلاحية الرابط خلال ساعة واحدة.`,
      html: `<div dir="rtl" lang="ar"><h2>تأكيد حساب مجرة</h2><p>اضغط على الرابط التالي لتأكيد بريدك الإلكتروني:</p><p><a href="${link.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">تأكيد البريد الإلكتروني</a></p><p>تنتهي صلاحية الرابط خلال ساعة واحدة.</p></div>`,
    });
    // Cloudflare returns { messageId } or similar
    const id = res?.messageId || res?.id || 'cloudflare-' + Date.now();
    return { ok: true, provider: 'cloudflare', providerId: String(id) };
  } catch (e) {
    console.error('cloudflare_email_failed', e);
    return { ok: false, reason: 'provider_error' };
  }
}

async function sendViaResend(env: Env, recipient: string, token: string): Promise<SendResult> {
  const apiKey = configuredValue(env.RESEND_API_KEY, 500);
  if (!apiKey) return { ok: false, reason: 'unconfigured' };
  const from = configuredValue(env.EMAIL_FROM, 320)!;
  const link = verificationLink(env, token);
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': await sha256Base64Url(`verify-email:${token}`),
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: 'تأكيد البريد الإلكتروني لحساب مجرة',
      text: `لتأكيد حسابك في مجرة افتح الرابط التالي:\n${link}\n\nتنتهي صلاحية الرابط خلال ساعة واحدة.`,
      html: `<div dir="rtl" lang="ar"><h2>تأكيد حساب مجرة</h2><p>اضغط على الرابط التالي لتأكيد بريدك الإلكتروني:</p><p><a href="${link.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">تأكيد البريد الإلكتروني</a></p><p>تنتهي صلاحية الرابط خلال ساعة واحدة.</p></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return { ok: false, reason: 'provider_error' };
  const result = (await response.json().catch(() => null)) as { id?: unknown } | null;
  return typeof result?.id === 'string' ? { ok: true, provider: 'resend', providerId: result.id } : { ok: false, reason: 'provider_error' };
}

export async function sendVerificationEmail(env: Env, recipient: string, token: string): Promise<SendResult> {
  if (!emailIsConfigured(env)) return { ok: false, reason: 'unconfigured' };

  // الأولوية لـ Cloudflare (أنت فعلت onboarding و Healthy 4/1000) - لا يحتاج مفتاح
  if (hasCloudflareBinding(env)) {
    const cf = await sendViaCloudflare(env, recipient, token);
    if (cf.ok) return cf;
    // لو فشل Cloudflare جرّب Resend كـ fallback إن وجد
    console.warn('cloudflare_send_failed_fallback_to_resend');
  }

  // Fallback: Resend
  const rs = await sendViaResend(env, recipient, token);
  return rs;
}
