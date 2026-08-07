import type { Env } from '../lib/db';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

type JwtClaims = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  email?: unknown;
  email_verified?: unknown;
};

type CachedKeys = { keys: JsonWebKey[]; expiresAt: number };
let cachedKeys: CachedKeys | null = null;

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  try { return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); } catch { return null; }
}

function parseJsonPart(value: string) {
  const decoded = decodeBase64Url(value);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decoded));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function bearer(value: string | undefined) {
  return value?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
}

async function googleKeys(forceRefresh = false) {
  if (!forceRefresh && cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  const response = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!response?.ok) return null;
  const body = await response.json().catch(() => null) as { keys?: unknown } | null;
  if (!Array.isArray(body?.keys)) return null;
  cachedKeys = { keys: body.keys as JsonWebKey[], expiresAt: Date.now() + 60 * 60 * 1000 };
  return cachedKeys.keys;
}

export function googlePubSubIsConfigured(env: Env) {
  if (!env.GOOGLE_PUBSUB_AUDIENCE || !env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL) return false;
  try {
    return new URL(env.GOOGLE_PUBSUB_AUDIENCE).protocol === 'https:'
      && /^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL);
  } catch {
    return false;
  }
}

export async function verifyGooglePubSubToken(env: Env, authorization: string | undefined) {
  if (!googlePubSubIsConfigured(env)) return false;
  const token = bearer(authorization);
  if (!token) return false;
  const [encodedHeader, encodedClaims, encodedSignature, ...extra] = token.split('.');
  if (!encodedHeader || !encodedClaims || !encodedSignature || extra.length) return false;
  const header = parseJsonPart(encodedHeader);
  const claims = parseJsonPart(encodedClaims) as JwtClaims | null;
  const signature = decodeBase64Url(encodedSignature);
  if (!header || !claims || !signature || header.alg !== 'RS256' || typeof header.kid !== 'string') return false;

  let keys = await googleKeys();
  let jwk = keys?.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    keys = await googleKeys(true);
    jwk = keys?.find((candidate) => candidate.kid === header.kid);
  }
  if (!jwk) return false;
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signature as BufferSource,
      new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`) as BufferSource,
    );
    if (!valid) return false;
  } catch {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const audienceMatches = claims.aud === env.GOOGLE_PUBSUB_AUDIENCE
    || (Array.isArray(claims.aud) && claims.aud.includes(env.GOOGLE_PUBSUB_AUDIENCE));
  return VALID_ISSUERS.has(String(claims.iss))
    && audienceMatches
    && typeof claims.exp === 'number' && claims.exp > now && claims.exp <= now + 3700
    && typeof claims.iat === 'number' && claims.iat <= now + 60 && claims.iat >= now - 3700
    && claims.email === env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL
    && claims.email_verified === true;
}

export function parseGoogleRtdn(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const message = (value as Record<string, unknown>).message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  const data = (message as Record<string, unknown>).data;
  if (typeof data !== 'string' || data.length < 1 || data.length > 16_384) return null;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data), (character) => character.charCodeAt(0)))) as Record<string, unknown>;
    if (decoded.testNotification) return { test: true as const, packageName: null, purchaseToken: null };
    const notification = decoded.subscriptionNotification;
    if (!notification || typeof notification !== 'object' || Array.isArray(notification)) return null;
    const packageName = typeof decoded.packageName === 'string' ? decoded.packageName : null;
    const purchaseToken = typeof (notification as Record<string, unknown>).purchaseToken === 'string'
      ? (notification as Record<string, unknown>).purchaseToken as string
      : null;
    if (!packageName || !purchaseToken || purchaseToken.length < 20 || purchaseToken.length > 4096) return null;
    return { test: false as const, packageName, purchaseToken };
  } catch {
    return null;
  }
}
