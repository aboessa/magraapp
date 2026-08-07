import type { Env } from './db';
import { callDurable, familyStub } from './doClient';
import { createStructuredRefreshToken, parseStructuredRefreshToken, refreshTokenSigningInput, type RefreshTokenParts } from './refreshToken';
import {
  createHmacSignature,
  createSignedToken,
  hasUsableSecret,
  randomToken,
  sha256Base64Url,
  verifyHmacSignature,
  verifySignedToken,
} from './security';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const MEDIA_TOKEN_TTL_SECONDS = 3 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type AccessClaims = {
  typ: 'parent_access';
  sub: string;
  sid: string;
  epoch: number;
  exp: number;
};

type VerificationClaims = {
  typ: 'email_verification';
  sub: string;
  email: string;
  exp: number;
};

export type MediaDescriptor = {
  r2_key: string;
  bucket: 'media' | 'thumbs';
  mime_type: string | null;
  filename: string | null;
  asset_version: number;
  etag: string | null;
};

type MediaClaims = MediaDescriptor & {
  typ: 'media_lease';
  sub: string;
  sid: string;
  lid: string;
  aid: string;
  exp: number;
};

export type ParentPrincipal = {
  parentId: string;
  sessionId: string;
  deviceId: string;
  plan: 'free' | 'family' | 'family_plus';
  authEpoch: number;
};

export type AuthResolution =
  | { ok: true; principal: ParentPrincipal }
  | { ok: false; reason: 'unconfigured' | 'unauthorized' };

type Envelope<T> = { success: boolean; data?: T; error?: string };

type SessionData = {
  session_id: string;
  device_id: string;
  plan: ParentPrincipal['plan'];
  auth_epoch: number;
  expires_at: number;
};

function expiration(seconds: number) {
  return Math.floor(Date.now() / 1000) + seconds;
}

function isValidExpiry(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > Math.floor(Date.now() / 1000);
}

function bearerToken(header: string | undefined) {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function secret(env: Env, name: 'AUTH_TOKEN_SECRET' | 'MEDIA_TOKEN_SECRET') {
  const value = env[name];
  return hasUsableSecret(value) ? value : null;
}

async function signedRefreshToken(env: Env, parts: RefreshTokenParts) {
  const signingSecret = secret(env, 'AUTH_TOKEN_SECRET');
  if (!signingSecret) throw new Error('Authentication is not configured');
  const signature = await createHmacSignature(refreshTokenSigningInput(parts), signingSecret);
  return createStructuredRefreshToken(parts, signature);
}

export function authIsConfigured(env: Env) {
  return Boolean(secret(env, 'AUTH_TOKEN_SECRET'));
}

export function mediaIsConfigured(env: Env) {
  return Boolean(secret(env, 'MEDIA_TOKEN_SECRET'));
}

async function accessToken(env: Env, principal: ParentPrincipal) {
  const signingSecret = secret(env, 'AUTH_TOKEN_SECRET');
  if (!signingSecret) throw new Error('Authentication is not configured');
  return createSignedToken({
    typ: 'parent_access',
    sub: principal.parentId,
    sid: principal.sessionId,
    epoch: principal.authEpoch,
    exp: expiration(ACCESS_TOKEN_TTL_SECONDS),
  } satisfies AccessClaims, signingSecret);
}

export async function authenticateParent(env: Env, authorization: string | undefined): Promise<AuthResolution> {
  const signingSecret = secret(env, 'AUTH_TOKEN_SECRET');
  if (!signingSecret) return { ok: false, reason: 'unconfigured' };
  const token = bearerToken(authorization);
  if (!token) return { ok: false, reason: 'unauthorized' };

  const claims = await verifySignedToken<AccessClaims>(token, signingSecret);
  if (!claims || claims.typ !== 'parent_access' || !isValidExpiry(claims.exp)
    || typeof claims.sub !== 'string' || typeof claims.sid !== 'string' || !Number.isInteger(claims.epoch)) {
    return { ok: false, reason: 'unauthorized' };
  }

  const resolved = await callDurable<Envelope<{
    parent_id: string;
    session_id: string;
    device_id: string;
    plan: ParentPrincipal['plan'];
    auth_epoch: number;
  }>>(familyStub(env, claims.sub), '/sessions/resolve', {
    body: { session_id: claims.sid, auth_epoch: claims.epoch },
  });
  const data = resolved.data?.success ? resolved.data.data : null;
  if (!resolved.ok || !data || data.parent_id !== claims.sub || data.session_id !== claims.sid || data.auth_epoch !== claims.epoch) {
    return { ok: false, reason: 'unauthorized' };
  }

  return {
    ok: true,
    principal: {
      parentId: data.parent_id,
      sessionId: data.session_id,
      deviceId: data.device_id,
      plan: data.plan,
      authEpoch: data.auth_epoch,
    },
  };
}

export async function createParentSession(env: Env, values: {
  parentId: string;
  installationId: string;
  platform: string;
  deviceName: string | null;
}) {
  if (!authIsConfigured(env)) throw new Error('Authentication is not configured');
  const sessionId = crypto.randomUUID();
  const refreshToken = await signedRefreshToken(env, {
    parentId: values.parentId,
    sessionId,
    secret: randomToken(32),
  });
  const expiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
  const created = await callDurable<Envelope<SessionData>>(familyStub(env, values.parentId), '/sessions/create', {
    body: {
      session_id: sessionId,
      refresh_token_hash: await sha256Base64Url(refreshToken),
      installation_id_hash: await sha256Base64Url(values.installationId),
      platform: values.platform,
      device_name: values.deviceName,
      expires_at: expiresAt,
    },
  });
  const data = created.data?.success ? created.data.data : null;
  if (!created.ok || !data) {
    return { ok: false as const, status: created.status, error: created.data?.error ?? 'Unable to create session' };
  }

  const principal: ParentPrincipal = {
    parentId: values.parentId,
    sessionId: data.session_id,
    deviceId: data.device_id,
    plan: data.plan,
    authEpoch: data.auth_epoch,
  };
  return {
    ok: true as const,
    access_token: await accessToken(env, principal),
    refresh_token: refreshToken,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_expires_at: new Date(data.expires_at).toISOString(),
    principal,
  };
}

export async function rotateParentSession(env: Env, refreshToken: string) {
  const signingSecret = secret(env, 'AUTH_TOKEN_SECRET');
  if (!signingSecret) return null;
  const parts = parseStructuredRefreshToken(refreshToken);
  if (!parts || !await verifyHmacSignature(refreshTokenSigningInput(parts), parts.signature, signingSecret)) return null;
  const nextRefreshToken = await signedRefreshToken(env, {
    parentId: parts.parentId,
    sessionId: parts.sessionId,
    secret: randomToken(32),
  });
  const rotated = await callDurable<Envelope<SessionData>>(familyStub(env, parts.parentId), '/sessions/refresh', {
    body: {
      session_id: parts.sessionId,
      current_hash: await sha256Base64Url(refreshToken),
      next_hash: await sha256Base64Url(nextRefreshToken),
    },
  });
  const data = rotated.data?.success ? rotated.data.data : null;
  if (!rotated.ok || !data) return null;

  const principal: ParentPrincipal = {
    parentId: parts.parentId,
    sessionId: data.session_id,
    deviceId: data.device_id,
    plan: data.plan,
    authEpoch: data.auth_epoch,
  };
  return {
    access_token: await accessToken(env, principal),
    refresh_token: nextRefreshToken,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_expires_at: new Date(data.expires_at).toISOString(),
    principal,
  };
}

export async function logoutParentSession(env: Env, principal: ParentPrincipal) {
  const result = await callDurable<Envelope<{ logged_out: boolean }>>(familyStub(env, principal.parentId), '/sessions/logout', {
    body: { session_id: principal.sessionId },
  });
  return result.ok && result.data?.success === true;
}

export async function createVerificationToken(env: Env, parentId: string, email: string) {
  const signingSecret = secret(env, 'AUTH_TOKEN_SECRET');
  if (!signingSecret) throw new Error('Authentication is not configured');
  return createSignedToken({ typ: 'email_verification', sub: parentId, email, exp: expiration(60 * 60) } satisfies VerificationClaims, signingSecret);
}

export async function verifyEmailToken(env: Env, token: string) {
  const signingSecret = secret(env, 'AUTH_TOKEN_SECRET');
  if (!signingSecret) return null;
  const claims = await verifySignedToken<VerificationClaims>(token, signingSecret);
  if (!claims || claims.typ !== 'email_verification' || !isValidExpiry(claims.exp)
    || typeof claims.sub !== 'string' || typeof claims.email !== 'string') return null;
  return claims;
}

export async function createMediaToken(env: Env, values: Omit<MediaClaims, 'typ' | 'exp'>) {
  const signingSecret = secret(env, 'MEDIA_TOKEN_SECRET');
  if (!signingSecret) throw new Error('Media protection is not configured');
  return createSignedToken({ typ: 'media_lease', ...values, exp: expiration(MEDIA_TOKEN_TTL_SECONDS) } satisfies MediaClaims, signingSecret);
}

export async function verifyMediaToken(env: Env, authorization: string | undefined) {
  const signingSecret = secret(env, 'MEDIA_TOKEN_SECRET');
  if (!signingSecret) return null;
  const token = bearerToken(authorization);
  if (!token) return null;
  const claims = await verifySignedToken<MediaClaims>(token, signingSecret);
  if (!claims || claims.typ !== 'media_lease' || !isValidExpiry(claims.exp)
    || typeof claims.sub !== 'string' || typeof claims.sid !== 'string'
    || typeof claims.lid !== 'string' || typeof claims.aid !== 'string'
    || typeof claims.r2_key !== 'string' || claims.r2_key.length < 1 || claims.r2_key.length > 1024
    || (claims.bucket !== 'media' && claims.bucket !== 'thumbs')
    || (claims.mime_type !== null && typeof claims.mime_type !== 'string')
    || (claims.filename !== null && typeof claims.filename !== 'string')
    || (claims.etag !== null && typeof claims.etag !== 'string')
    || !Number.isInteger(claims.asset_version) || claims.asset_version < 1) return null;
  return claims;
}
