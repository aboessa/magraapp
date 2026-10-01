import { Hono } from 'hono';

import type { Env } from '../lib/db.ts';
import { callDurable } from '../lib/doClient.ts';
import { loadPolicy, TV_PAIRING_DEFAULTS } from '../lib/platformPolicy.ts';
import {
  authenticateParent,
  authIsConfigured,
  createParentSession,
  verifyParentProof,
} from '../lib/parentAuth.ts';
import {
  openOpaqueValue,
  randomToken,
  sealOpaqueValue,
  sha256Base64Url,
} from '../lib/security.ts';
import {
  bodyOr400,
  oneOf,
  text,
  type BodySchema,
} from '../lib/requestSchema.ts';

/**
 * Television sign-in by pairing code (`TV-001`).
 *
 * Typing an email and a twelve-character password with a TV remote is the
 * slowest part of setting the app up on a television. This is the device flow
 * streaming apps use instead: the TV shows a short code and a QR, a parent who is
 * already signed in on a phone approves it, and the TV receives its own session.
 *
 * | Endpoint | Caller | Auth |
 * |---|---|---|
 * | `POST /start` | television | none (per-IP limit) |
 * | `POST /poll` | television | the `poll_secret` issued by `/start` |
 * | `POST /lookup` | phone | parent session |
 * | `POST /approve` | phone | parent session + single-use `approve_tv` proof |
 *
 * ## Security properties
 *
 * - **The code alone grants nothing.** Approving needs a signed-in parent *and*
 *   a PIN-bound proof. Collecting the tokens needs the 256-bit poll secret that
 *   only the television received.
 * - **The phone sees what it is approving.** `/lookup` returns the device name
 *   and platform first, so a parent handed a code by someone else sees that it
 *   is not their TV.
 * - **The session is an ordinary one.** It is created by `createParentSession`,
 *   so the plan's device limit, revocation, refresh rotation and auth epoch apply
 *   unchanged. A device-limit refusal reaches the *phone*, where it can be acted
 *   on, rather than a TV that has no way to manage devices.
 * - **Tokens are held briefly and sealed.** Between approval and pick-up they sit
 *   in the pairing object encrypted under a purpose-bound key, for two minutes at
 *   most, and are removed in the same step that hands them out.
 */

type AppEnv = { Bindings: Env };
type Envelope<T> = { success: boolean; data?: T; error?: string; code?: string };

const tvPairingRoute = new Hono<AppEnv>();

/// Unambiguous on a TV at three metres: no I/L/1, no O/0.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;
/// Defaults; the live values come from the dashboard (`tv_pairing` policy).
export const CODE_TTL_MS = TV_PAIRING_DEFAULTS.code_ttl_minutes * 60_000;
export const POLL_INTERVAL_SECONDS = TV_PAIRING_DEFAULTS.poll_interval_seconds;

async function pairingTiming(env: Env) {
  const { value } = await loadPolicy(env, 'tv_pairing');
  return { codeTtlMs: value.code_ttl_minutes * 60_000, pollSeconds: value.poll_interval_seconds };
}
const TOKEN_SEAL_PURPOSE = 'tv-pairing-tokens';
const DEFAULT_PAIRING_URL = 'majarra://app/link-tv';
const TV_PLATFORMS = ['android_tv', 'tvos'] as const;

const SCHEMAS = {
  start: {
    installation_id: text({ min: 16, max: 200 }),
    platform: oneOf(TV_PLATFORMS),
    device_name: text({ max: 80, optional: true }),
  },
  poll: {
    code: text({ max: 16 }),
    poll_secret: text({ min: 32, max: 128 }),
  },
  code: { code: text({ max: 16 }) },
} satisfies Record<string, BodySchema>;

/// A uniformly random code. Rejection sampling keeps every character equally
/// likely: `byte % 31` over 0-255 would favour the first eight characters.
export function generatePairingCode(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)) {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of random(new Uint8Array(16))) {
      if (byte >= limit) continue;
      code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === CODE_LENGTH) break;
    }
  }
  return code;
}

/// Accepts what a parent is likely to type — lower case, a dash or spaces — and
/// returns the canonical form, or null when it cannot be a code.
export function normalizePairingCode(value: unknown) {
  if (typeof value !== 'string') return null;
  const code = value.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  for (const character of code) if (!CODE_ALPHABET.includes(character)) return null;
  return code;
}

export function formatPairingCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function pairingStub(env: Env, code: string) {
  const namespace = env.TV_PAIRING!;
  return namespace.get(namespace.idFromName(`tv-pair:${code}`));
}

function unavailable() {
  return Response.json({ success: false, error: 'TV pairing is not available' }, { status: 503 });
}

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

function pairingUrl(env: Env, code: string) {
  const base = env.TV_PAIRING_URL?.trim() || DEFAULT_PAIRING_URL;
  const url = new URL(base);
  url.searchParams.set('code', formatPairingCode(code));
  return { base, complete: url.toString() };
}

tvPairingRoute.post('/start', async (c) => {
  if (!authIsConfigured(c.env) || !c.env.TV_PAIRING) return unavailable();
  const parsed = await bodyOr400<{ installation_id: string; platform: string; device_name?: string }>(c, SCHEMAS.start);
  if (!parsed.ok) return parsed.response;
  const { installation_id: installationId, platform } = parsed.value;
  const deviceName = parsed.value.device_name?.trim() || null;

  const pollSecret = randomToken(32);
  // ADMIN-POLICY: code lifetime and poll interval come from the dashboard.
  const { codeTtlMs, pollSeconds } = await pairingTiming(c.env);
  const body = {
    poll_secret_hash: await sha256Base64Url(pollSecret),
    installation_id_hash: await sha256Base64Url(installationId),
    platform,
    device_name: deviceName,
    ttl_ms: codeTtlMs,
  };

  // 31^8 ≈ 8.5e11 codes against a few thousand live at once: a collision is
  // rare, and the object refuses to overwrite a live code, so a retry is all
  // that is needed.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = generatePairingCode();
    const created = await callDurable<Envelope<{ expires_at: number }>>(pairingStub(c.env, code), '/create', { body });
    if (created.status === 409) continue;
    if (!created.ok || !created.data?.success) return unavailable();
    const url = pairingUrl(c.env, code);
    return c.json({
      success: true,
      data: {
        code: formatPairingCode(code),
        poll_secret: pollSecret,
        expires_in: Math.floor(codeTtlMs / 1000),
        interval: pollSeconds,
        verification_uri: url.base,
        verification_uri_complete: url.complete,
      },
    }, 201);
  }
  return unavailable();
});

tvPairingRoute.post('/poll', async (c) => {
  if (!authIsConfigured(c.env) || !c.env.TV_PAIRING) return unavailable();
  const parsed = await bodyOr400<{ code: string; poll_secret: string }>(c, SCHEMAS.poll);
  if (!parsed.ok) return parsed.response;
  const code = normalizePairingCode(parsed.value.code);
  if (!code) return c.json({ success: false, error: 'Pairing expired', code: 'pairing_expired' }, 410);

  const polled = await callDurable<Envelope<{ status: 'pending' | 'approved'; sealed_tokens?: string }>>(
    pairingStub(c.env, code), '/poll',
    { body: { poll_secret_hash: await sha256Base64Url(parsed.value.poll_secret) } },
  );
  if (polled.status === 410) {
    return c.json({ success: false, error: 'Pairing expired', code: 'pairing_expired' }, 410);
  }
  const data = polled.ok && polled.data?.success ? polled.data.data : null;
  if (!data) return unavailable();
  if (data.status !== 'approved') {
    return c.json({ success: true, data: { status: 'pending', interval: (await pairingTiming(c.env)).pollSeconds } });
  }

  const opened = data.sealed_tokens
    ? await openOpaqueValue(data.sealed_tokens, c.env.AUTH_TOKEN_SECRET!, TOKEN_SEAL_PURPOSE)
    : null;
  const tokens = opened ? JSON.parse(opened) as Record<string, unknown> : null;
  if (!tokens) return unavailable();
  return c.json({ success: true, data: { status: 'approved', ...tokens } });
});

tvPairingRoute.post('/lookup', async (c) => {
  if (!authIsConfigured(c.env) || !c.env.TV_PAIRING) return unavailable();
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const parsed = await bodyOr400<{ code: string }>(c, SCHEMAS.code);
  if (!parsed.ok) return parsed.response;
  const code = normalizePairingCode(parsed.value.code);
  if (!code) return c.json({ success: false, error: 'Pairing code not found', code: 'pairing_not_found' }, 404);

  const described = await callDurable<Envelope<{
    platform: string; device_name: string | null; created_at: number; expires_at: number;
  }>>(pairingStub(c.env, code), '/describe', { body: {} });
  if (described.status === 404) {
    return c.json({ success: false, error: 'Pairing code not found', code: 'pairing_not_found' }, 404);
  }
  const data = described.ok && described.data?.success ? described.data.data : null;
  if (!data) return unavailable();
  return c.json({
    success: true,
    data: {
      code: formatPairingCode(code),
      platform: data.platform,
      device_name: data.device_name,
      expires_at: new Date(data.expires_at).toISOString(),
    },
  });
});

tvPairingRoute.post('/approve', async (c) => {
  if (!authIsConfigured(c.env) || !c.env.TV_PAIRING) return unavailable();
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const parent = auth.principal;

  // The gate precedes the body, as on every other proof-gated write: a refusal
  // must not depend on what was sent.
  const proof = await verifyParentProof(c.env, {
    principal: parent,
    header: c.req.header('X-Parent-Proof'),
    purpose: 'approve_tv',
    consume: true,
  });
  if (!proof.ok) {
    return c.json({
      success: false,
      error: proof.reason === 'unconfigured'
        ? 'Parent authentication is not configured'
        : 'A current parent proof is required',
    }, proof.reason === 'unconfigured' ? 503 : 403);
  }

  const parsed = await bodyOr400<{ code: string }>(c, SCHEMAS.code);
  if (!parsed.ok) return parsed.response;
  const code = normalizePairingCode(parsed.value.code);
  if (!code) return c.json({ success: false, error: 'Pairing code not found', code: 'pairing_not_found' }, 404);
  const stub = pairingStub(c.env, code);

  const claimed = await callDurable<Envelope<{
    installation_id_hash: string; platform: string; device_name: string | null;
  }>>(stub, '/claim', { body: { parent_id: parent.parentId } });
  if (claimed.status === 404 || claimed.status === 409) {
    return c.json({
      success: false,
      error: claimed.data?.error ?? 'Pairing code not found',
      code: claimed.data?.code ?? 'pairing_not_found',
    }, claimed.status);
  }
  const device = claimed.ok && claimed.data?.success ? claimed.data.data : null;
  if (!device) return unavailable();

  const release = () => callDurable(stub, '/abort', { body: { parent_id: parent.parentId } }).catch(() => null);

  let session: Awaited<ReturnType<typeof createParentSession>>;
  try {
    session = await createParentSession(c.env, {
      parentId: parent.parentId,
      installationIdHash: device.installation_id_hash,
      platform: device.platform,
      deviceName: device.device_name,
    });
  } catch {
    await release();
    return unavailable();
  }
  if (!session.ok) {
    // Released so the parent can free a device slot and approve the same code
    // again without the TV starting over.
    await release();
    return Response.json({ success: false, error: session.error }, { status: session.status });
  }

  const sealed = await sealOpaqueValue(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: 'Bearer',
    expires_in: session.expires_in,
    refresh_expires_at: session.refresh_expires_at,
    parent: { id: session.principal.parentId, plan: session.principal.plan },
  }), c.env.AUTH_TOKEN_SECRET!, TOKEN_SEAL_PURPOSE);

  const completed = await callDurable<Envelope<{ approved: boolean }>>(stub, '/complete', {
    body: { parent_id: parent.parentId, sealed_tokens: sealed },
  });
  if (!completed.ok || !completed.data?.success) return unavailable();

  return c.json({
    success: true,
    data: {
      approved: true,
      device_id: session.principal.deviceId,
      device_name: device.device_name,
      platform: device.platform,
    },
  });
});

export default tvPairingRoute;
