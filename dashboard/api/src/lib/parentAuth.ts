import type { Env } from './db.ts';
import { callDurable, familyStub } from './doClient.ts';
import { createStructuredRefreshToken, parseStructuredRefreshToken, refreshTokenSigningInput, type RefreshTokenParts } from './refreshToken.ts';
import {
  createHmacSignature,
  createSignedToken,
  hasUsableSecret,
  randomToken,
  sha256Base64Url,
  verifyHmacSignature,
  verifySignedToken,
} from './security.ts';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const MEDIA_TOKEN_TTL_SECONDS = 3 * 60;
const PARENT_PROOF_TTL_SECONDS = 5 * 60;
const PASSWORD_RESET_TOKEN_TTL_SECONDS = 30 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The purposes a parent proof can be bound to.
 *
 * ## The rule this list must satisfy
 *
 * **Every purpose here is verified by at least one endpoint.** A purpose that can
 * be issued but is never checked makes the parent gate decorative for that
 * operation: the client asks for a PIN, the parent enters it, a token is minted,
 * and the server never looks at it. Five of the previous fourteen were in that
 * state (`manage_children`, `manage_consents`, `manage_billing`,
 * `delete_creation`, `approve_tv`), which `test/parentProof.test.mjs` now prevents
 * from recurring by asserting each value appears in a verification call site.
 *
 * | Purpose | Verified at |
 * |---|---|
 * | `parent_area` | `GET /account/profile`, `PATCH /account/profile`, `GET /account/deletions/:id`, `POST /family/consents` *(read)*, `GET /family/devices`, `GET|PATCH /child-settings/:id` |
 * | `manage_children` | `POST /family/children` |
 * | `manage_consents` | `POST /family/consents` |
 * | `change_parent_pin` | `POST /family/parent-pin` |
 * | `change_password` | `POST /account/change-password` |
 * | `revoke_device` | `POST /family/devices/revoke` |
 * | `delete_creation` | `DELETE /creations/:id` |
 * | `purge_creations` | `POST /creations/purge` |
 * | `delete_child` | `DELETE /account/children/:childId` |
 * | `delete_account` | `DELETE /account/delete` |
 * | `export_data` | `GET /account/export` |
 *
 * ## Two purposes were removed rather than wired
 *
 * - **`manage_billing`** — the only endpoints it could gate are
 *   `GET /billing/google-play/context` and `POST /billing/google-play/verify`.
 *   Neither has a client caller, both belong to `BILLING-001` which is blocked on
 *   an owner decision, and putting a PIN prompt in front of `verify` would risk
 *   stranding a purchase Google Play has already charged for. It returns when
 *   billing is implemented, and it belongs on the parent-initiated *start* of a
 *   plan change — never on the provider-completed verification.
 * - **`approve_tv`** — no TV approval or device-pairing endpoint exists anywhere
 *   in the API, and no client requests it. It was aspirational.
 */
export const PARENT_PROOF_PURPOSES = [
  'parent_area',
  'manage_children',
  'manage_consents',
  'change_parent_pin',
  'change_password',
  'revoke_device',
  'delete_creation',
  'purge_creations',
  'delete_child',
  'delete_account',
  'export_data',
] as const;

/**
 * Purposes whose proof must be consumed on first use.
 *
 * A destructive operation must not be replayable from a captured header: the
 * proof is single-use, tracked by `jti` in the family object's
 * `used_parent_proofs`. Read-only and repeatable operations do not consume, so a
 * parent browsing the parent area does not need a new PIN entry per screen.
 */
export const SINGLE_USE_PURPOSES: readonly ParentProofPurpose[] = [
  'revoke_device',
  'delete_creation',
  'purge_creations',
  'delete_child',
  'delete_account',
  'export_data',
  'change_password',
  'change_parent_pin',
];

export type ParentProofPurpose = typeof PARENT_PROOF_PURPOSES[number];

type AccessClaims = {
  typ: 'parent_access';
  sub: string;
  sid: string;
  epoch: number;
  exp: number;
};

type ParentProofClaims = {
  typ: 'parent_proof';
  sub: string;
  sid: string;
  epoch: number;
  pin_version: number;
  purpose: ParentProofPurpose;
  iat: number;
  exp: number;
  jti: string;
};

type VerificationClaims = {
  typ: 'email_verification';
  sub: string;
  email: string;
  exp: number;
};

export type PasswordResetClaims = {
  typ: 'password_reset';
  sub: string;
  identity_name: string;
  email_hash: string;
  jti: string;
  iat: number;
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

export type ParentProofResolution =
  | {
    ok: true;
    proof: {
      purpose: ParentProofPurpose;
      pinVersion: number;
      issuedAt: number;
      expiresAt: number;
      jti: string;
    };
  }
  | { ok: false; reason: 'unconfigured' | 'invalid' };

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

function parentProofToken(header: string | undefined) {
  const token = header?.trim();
  return token && token.length <= 8192 && !/\s/.test(token) ? token : null;
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

export function parseParentProofPurpose(value: unknown): ParentProofPurpose | null {
  return typeof value === 'string' && (PARENT_PROOF_PURPOSES as readonly string[]).includes(value)
    ? value as ParentProofPurpose
    : null;
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

export function createParentAccessToken(env: Env, principal: ParentPrincipal) {
  return accessToken(env, principal);
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

export async function createParentProof(env: Env, values: {
  principal: ParentPrincipal;
  pinVersion: number;
  purpose: ParentProofPurpose;
  notAfter?: number;
}) {
  const signingSecret = secret(env, 'AUTH_TOKEN_SECRET');
  if (!signingSecret) throw new Error('Authentication is not configured');
  if (!Number.isInteger(values.pinVersion) || values.pinVersion < 1) {
    throw new Error('A valid parent PIN version is required');
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  const normalExpiry = issuedAt + PARENT_PROOF_TTL_SECONDS;
  const expiresAt = values.notAfter === undefined
    ? normalExpiry
    : Math.min(normalExpiry, Math.floor(values.notAfter / 1000));
  if (expiresAt <= issuedAt) throw new Error('Parent proof has expired');
  const jti = crypto.randomUUID();
  const token = await createSignedToken({
    typ: 'parent_proof',
    sub: values.principal.parentId,
    sid: values.principal.sessionId,
    epoch: values.principal.authEpoch,
    pin_version: values.pinVersion,
    purpose: values.purpose,
    iat: issuedAt,
    exp: expiresAt,
    jti,
  } satisfies ParentProofClaims, signingSecret);
  return {
    token,
    purpose: values.purpose,
    issuedAt: issuedAt * 1000,
    expiresAt: expiresAt * 1000,
    jti,
  };
}

export async function verifyParentProof(env: Env, values: {
  principal: ParentPrincipal;
  header: string | undefined;
  purpose: ParentProofPurpose;
  consume?: boolean;
}): Promise<ParentProofResolution> {
  const signingSecret = secret(env, 'AUTH_TOKEN_SECRET');
  if (!signingSecret) return { ok: false, reason: 'unconfigured' };
  const token = parentProofToken(values.header);
  if (!token) return { ok: false, reason: 'invalid' };

  const claims = await verifySignedToken<ParentProofClaims>(token, signingSecret);
  const now = Math.floor(Date.now() / 1000);
  if (!claims || claims.typ !== 'parent_proof' || !isValidExpiry(claims.exp)
    || typeof claims.sub !== 'string' || typeof claims.sid !== 'string'
    || !Number.isInteger(claims.epoch) || !Number.isInteger(claims.pin_version)
    || claims.pin_version < 1 || parseParentProofPurpose(claims.purpose) === null
    || !Number.isInteger(claims.iat) || claims.iat > now + 30
    || claims.iat < now - PARENT_PROOF_TTL_SECONDS - 30
    || typeof claims.jti !== 'string' || claims.jti.length < 16 || claims.jti.length > 128
    || claims.sub !== values.principal.parentId
    || claims.sid !== values.principal.sessionId
    || claims.epoch !== values.principal.authEpoch
    || claims.purpose !== values.purpose) {
    return { ok: false, reason: 'invalid' };
  }

  const checked = await callDurable<Envelope<{ pin_version: number }>>(
    familyStub(env, values.principal.parentId),
    '/parent-proof/validate',
    {
      body: {
        session_id: values.principal.sessionId,
        auth_epoch: values.principal.authEpoch,
        pin_version: claims.pin_version,
        purpose: claims.purpose,
        jti: claims.jti,
        expires_at: claims.exp * 1000,
        consume: values.consume === true,
      },
    },
  );
  const data = checked.data?.success ? checked.data.data : null;
  if (!checked.ok || !data || data.pin_version !== claims.pin_version) {
    return { ok: false, reason: 'invalid' };
  }

  return {
    ok: true,
    proof: {
      purpose: claims.purpose,
      pinVersion: claims.pin_version,
      issuedAt: claims.iat * 1000,
      expiresAt: claims.exp * 1000,
      jti: claims.jti,
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

export async function createPasswordResetToken(env: Env, values: {
  parentId: string;
  identityName: string;
  emailHash: string;
  jti: string;
  expiresAt: number;
}) {
  const signingSecret = secret(env, 'AUTH_TOKEN_SECRET');
  if (!signingSecret) throw new Error('Authentication is not configured');
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = Math.min(
    issuedAt + PASSWORD_RESET_TOKEN_TTL_SECONDS,
    Math.floor(values.expiresAt / 1000),
  );
  if (expiresAt <= issuedAt) throw new Error('Password reset token has expired');
  return createSignedToken({
    typ: 'password_reset',
    sub: values.parentId,
    identity_name: values.identityName,
    email_hash: values.emailHash,
    jti: values.jti,
    iat: issuedAt,
    exp: expiresAt,
  } satisfies PasswordResetClaims, signingSecret);
}

export async function verifyPasswordResetToken(env: Env, token: string) {
  const signingSecret = secret(env, 'AUTH_TOKEN_SECRET');
  if (!signingSecret) return null;
  const claims = await verifySignedToken<PasswordResetClaims>(token, signingSecret);
  const now = Math.floor(Date.now() / 1000);
  if (!claims || claims.typ !== 'password_reset' || !isValidExpiry(claims.exp)
    || !Number.isInteger(claims.iat) || claims.iat > now + 30
    || claims.iat < now - PASSWORD_RESET_TOKEN_TTL_SECONDS - 30
    || typeof claims.sub !== 'string' || claims.sub.length < 8 || claims.sub.length > 200
    || typeof claims.identity_name !== 'string' || claims.identity_name.length < 8 || claims.identity_name.length > 200
    || typeof claims.email_hash !== 'string' || claims.email_hash.length < 16 || claims.email_hash.length > 128
    || typeof claims.jti !== 'string' || claims.jti.length < 16 || claims.jti.length > 128) {
    return null;
  }
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
