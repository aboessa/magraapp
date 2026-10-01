import type { Env } from './db.ts';
import { queryAll, queryFirst } from './db.ts';

/// APP-203 — push notifications through FCM HTTP v1.
///
/// The Worker signs its own OAuth assertion (RS256) with the service account
/// in `FCM_SERVICE_ACCOUNT_JSON` (role: Firebase Cloud Messaging admin only),
/// exchanges it for an access token, and caches the token in memory for its
/// lifetime. No Firebase SDK: it does not run on Workers and is not needed.

/// `billing` (a payment approved, rejected, or about to expire) is not a
/// preference: it is about the account itself, so it is always delivered.
export type PushKind = 'new_episodes' | 'screen_time' | 'weekly_report' | 'billing';
export const PUSH_KINDS: readonly Exclude<PushKind, 'billing'>[] = ['new_episodes', 'screen_time', 'weekly_report'];

export type PushMessage = { title: string; body: string; route?: string };
type ServiceAccount = { project_id: string; client_email: string; private_key: string };

export function pushIsConfigured(env: Env) {
  return serviceAccount(env) !== null;
}

function serviceAccount(env: Env): ServiceAccount | null {
  if (!env.FCM_SERVICE_ACCOUNT_JSON) return null;
  try {
    const parsed = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON) as Partial<ServiceAccount>;
    return parsed.project_id && parsed.client_email && parsed.private_key ? parsed as ServiceAccount : null;
  } catch {
    return null;
  }
}

const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text = '';
  for (const byte of view) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cached: { token: string; expiresAt: number; email: string } | null = null;

async function accessToken(account: ServiceAccount, fetcher: typeof fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.email === account.client_email && cached.expiresAt > now + 60) return cached.token;

  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(new TextEncoder().encode(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const pem = account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));

  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  if (!response.ok) {
    // Google's error code only (e.g. `invalid_grant`); never the assertion.
    const reason = await response.json().then((b) => (b as { error?: string }).error ?? '').catch(() => '');
    throw new Error(`fcm_oauth_${response.status}${reason ? `_${reason}` : ''}`);
  }
  const data = await response.json() as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: now + Number(data.expires_in ?? 3600), email: account.client_email };
  return data.access_token;
}

/// Only in-app routes the app knows how to open.
const ROUTE = /^\/(parent|membership|series\/[a-z0-9-]{1,120}|)$/;

/// One message to one token. `invalid` means FCM will never deliver to it.
export async function sendPush(env: Env, token: string, message: PushMessage, fetcher: typeof fetch = fetch)
  : Promise<'sent' | 'invalid' | 'failed'> {
  const account = serviceAccount(env);
  if (!account) return 'failed';
  const route = message.route && ROUTE.test(message.route) ? message.route : '/';
  const response = await fetcher(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken(account, fetcher)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: message.title.slice(0, 120), body: message.body.slice(0, 240) },
        data: { route },
        android: { priority: 'normal' },
      },
    }),
  });
  if (response.ok) return 'sent';
  if (response.status === 404) return 'invalid';
  if (response.status === 400) {
    const text = await response.text().catch(() => '');
    return /UNREGISTERED|registration token/i.test(text) ? 'invalid' : 'failed';
  }
  return 'failed';
}

/// Whether the parent wants this kind (absence of a row = everything on).
export async function wantsPush(env: Env, parentId: string, kind: PushKind) {
  if (kind === 'billing') return true;
  const row = await queryFirst<Record<Exclude<PushKind, 'billing'>, number>>(env.DB,
    'SELECT new_episodes, screen_time, weekly_report FROM push_preferences WHERE parent_id = ?', [parentId]);
  return row ? Number(row[kind]) === 1 : true;
}

/// Sends to every device of one family, once per `dedupeKey`. Invalid tokens
/// are removed. Never throws: a notification is never a reason to fail a request.
export async function notifyParent(env: Env, parentId: string, kind: PushKind, dedupeKey: string, message: PushMessage,
  fetcher: typeof fetch = fetch) {
  try {
    if (!pushIsConfigured(env) || !await wantsPush(env, parentId, kind)) return 0;
    const claim = await env.DB.prepare(
      'INSERT OR IGNORE INTO push_log (parent_id, dedupe_key, kind) VALUES (?, ?, ?)',
    ).bind(parentId, dedupeKey.slice(0, 200), kind).run();
    if (!claim.meta?.changes) return 0; // already sent (or being sent) for this key
    const tokens = await queryAll<{ token: string }>(env.DB, 'SELECT token FROM push_tokens WHERE parent_id = ? LIMIT 20', [parentId]);
    let sent = 0;
    for (const { token } of tokens) {
      const result = await sendPush(env, token, message, fetcher).catch(() => 'failed' as const);
      if (result === 'sent') sent++;
      if (result === 'invalid') await env.DB.prepare('DELETE FROM push_tokens WHERE token = ?').bind(token).run();
    }
    await env.DB.prepare('UPDATE push_log SET sent = ? WHERE parent_id = ? AND dedupe_key = ?')
      .bind(sent, parentId, dedupeKey.slice(0, 200)).run();
    return sent;
  } catch (error) {
    console.warn('push_failed', kind, error instanceof Error ? error.message : String(error));
    return 0;
  }
}
