import type { Env } from '../lib/db';
import { isPlan, type Plan } from '../lib/familyPolicy.ts';
import { sha256Base64Url } from '../lib/security.ts';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const PUBLISHER_AUDIENCE = TOKEN_ENDPOINT;

type PaidPlan = Exclude<Plan, 'free'>;
type ProductMap = Record<string, PaidPlan>;
type JsonObject = Record<string, unknown>;

type CachedAccessToken = {
  key: string;
  token: string;
  expiresAt: number;
};

let cachedAccessToken: CachedAccessToken | null = null;

export class GooglePlayError extends Error {
  readonly code: 'unconfigured' | 'invalid_purchase' | 'provider_unavailable';

  constructor(code: 'unconfigured' | 'invalid_purchase' | 'provider_unavailable') {
    super(code);
    this.code = code;
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeJson(value: unknown) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function parsePrivateKey(pem: string) {
  const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  if (!encoded) throw new GooglePlayError('unconfigured');
  try {
    return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  } catch {
    throw new GooglePlayError('unconfigured');
  }
}

export function parseGooglePlayProducts(value: string | undefined): ProductMap | null {
  if (!value || value.length > 10_000) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (!entries.length || entries.length > 50) return null;
    const result: ProductMap = {};
    for (const [productId, plan] of entries) {
      if (!/^[A-Za-z0-9._-]{1,200}$/.test(productId) || !isPlan(plan) || plan === 'free') return null;
      result[productId] = plan;
    }
    return result;
  } catch {
    return null;
  }
}

export function googlePlayIsConfigured(env: Env) {
  return Boolean(
    env.GOOGLE_PLAY_PACKAGE_NAME
    && /^[A-Za-z][A-Za-z0-9_.]{2,199}$/.test(env.GOOGLE_PLAY_PACKAGE_NAME)
    && env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL
    && env.GOOGLE_PLAY_PRIVATE_KEY
    && parseGooglePlayProducts(env.GOOGLE_PLAY_PRODUCTS),
  );
}

async function serviceAccountAccessToken(env: Env) {
  if (!googlePlayIsConfigured(env)) throw new GooglePlayError('unconfigured');
  const cacheKey = `${env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL}:${env.GOOGLE_PLAY_PACKAGE_NAME}`;
  if (cachedAccessToken?.key === cacheKey && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: 'RS256', typ: 'JWT' });
  const claims = encodeJson({
    iss: env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
    scope: PUBLISHER_SCOPE,
    aud: PUBLISHER_AUDIENCE,
    iat: now,
    exp: now + 3600,
  });
  const signingInput = `${header}.${claims}`;
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'pkcs8',
      parsePrivateKey(env.GOOGLE_PLAY_PRIVATE_KEY!).buffer as ArrayBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  } catch {
    throw new GooglePlayError('unconfigured');
  }
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const assertion = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) throw new GooglePlayError('provider_unavailable');
  const token = await response.json().catch(() => null) as { access_token?: unknown; expires_in?: unknown } | null;
  if (typeof token?.access_token !== 'string') throw new GooglePlayError('provider_unavailable');
  const expiresIn = typeof token.expires_in === 'number' ? Math.min(Math.max(token.expires_in, 60), 3600) : 3600;
  cachedAccessToken = { key: cacheKey, token: token.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return token.access_token;
}

function object(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

function timestamp(value: unknown) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type VerifiedGooglePlaySubscription = {
  productId: string;
  plan: PaidPlan;
  providerPurchaseId: string | null;
  providerState: string;
  entitlementStatus: 'active' | 'grace' | 'expired' | 'revoked';
  startsAt: number | null;
  expiresAt: number | null;
  rawResponseHash: string;
};

export async function resolveGooglePlaySubscription(
  response: unknown,
  products: ProductMap,
  expectedAccountId: string,
  now = Date.now(),
): Promise<Omit<VerifiedGooglePlaySubscription, 'rawResponseHash'>> {
  const purchase = object(response);
  const external = object(purchase?.externalAccountIdentifiers);
  if (!purchase || external?.obfuscatedExternalAccountId !== expectedAccountId) {
    throw new GooglePlayError('invalid_purchase');
  }
  const items = Array.isArray(purchase.lineItems) ? purchase.lineItems.map(object).filter(Boolean) as JsonObject[] : [];
  const recognized = items.map((item) => {
    const productId = typeof item.productId === 'string' ? item.productId : '';
    const plan = products[productId];
    return plan ? { productId, plan, expiry: timestamp(item.expiryTime) } : null;
  }).filter(Boolean) as Array<{ productId: string; plan: PaidPlan; expiry: number | null }>;
  if (!recognized.length) throw new GooglePlayError('invalid_purchase');
  const rank: Record<PaidPlan, number> = { family: 1, family_plus: 2 };
  recognized.sort((left, right) => ((right.expiry ?? 0) - (left.expiry ?? 0)) || (rank[right.plan] - rank[left.plan]));
  const item = recognized[0];
  const providerState = typeof purchase.subscriptionState === 'string' ? purchase.subscriptionState : 'SUBSCRIPTION_STATE_UNSPECIFIED';
  let entitlementStatus: VerifiedGooglePlaySubscription['entitlementStatus'];
  if (item.expiry !== null && item.expiry <= now) entitlementStatus = 'expired';
  else if (providerState === 'SUBSCRIPTION_STATE_ACTIVE' || providerState === 'SUBSCRIPTION_STATE_CANCELED') entitlementStatus = 'active';
  else if (providerState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') entitlementStatus = 'grace';
  else if (providerState === 'SUBSCRIPTION_STATE_PAUSED' || providerState === 'SUBSCRIPTION_STATE_ON_HOLD') entitlementStatus = 'revoked';
  else entitlementStatus = 'expired';
  if ((entitlementStatus === 'active' || entitlementStatus === 'grace') && item.expiry === null) {
    throw new GooglePlayError('invalid_purchase');
  }
  return {
    productId: item.productId,
    plan: item.plan,
    providerPurchaseId: typeof purchase.latestOrderId === 'string' ? purchase.latestOrderId : null,
    providerState,
    entitlementStatus,
    startsAt: timestamp(purchase.startTime),
    expiresAt: item.expiry,
  };
}

export async function verifyGooglePlaySubscription(env: Env, parentId: string, purchaseToken: string) {
  if (!googlePlayIsConfigured(env)) throw new GooglePlayError('unconfigured');
  const accessToken = await serviceAccountAccessToken(env);
  const endpoint = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME!)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  // Official contract: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
  const response = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) throw new GooglePlayError('provider_unavailable');
  if (response.status === 404 || response.status === 400) throw new GooglePlayError('invalid_purchase');
  if (!response.ok) throw new GooglePlayError('provider_unavailable');
  const raw = await response.text();
  let purchase: unknown;
  try { purchase = JSON.parse(raw); } catch { throw new GooglePlayError('provider_unavailable'); }
  if (env.ENVIRONMENT === 'production' && object(purchase)?.testPurchase) throw new GooglePlayError('invalid_purchase');
  const resolved = await resolveGooglePlaySubscription(
    purchase,
    parseGooglePlayProducts(env.GOOGLE_PLAY_PRODUCTS)!,
    await sha256Base64Url(parentId),
  );
  const acknowledgementState = object(purchase)?.acknowledgementState;
  if (acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING'
    && (resolved.entitlementStatus === 'active' || resolved.entitlementStatus === 'grace')) {
    // Official contract: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge
    const acknowledgeEndpoint = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME!)}/purchases/subscriptions/${encodeURIComponent(resolved.productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
    const acknowledged = await fetch(acknowledgeEndpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!acknowledged?.ok) throw new GooglePlayError('provider_unavailable');
  }
  return { ...resolved, rawResponseHash: await sha256Base64Url(raw) } satisfies VerifiedGooglePlaySubscription;
}
