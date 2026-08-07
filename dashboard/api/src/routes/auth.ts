import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { callDurable, familyStub, identityStub } from '../lib/doClient';
import {
  authIsConfigured,
  authenticateParent,
  createParentSession,
  createVerificationToken,
  logoutParentSession,
  rotateParentSession,
  verifyEmailToken,
} from '../lib/parentAuth';
import { createHmacSignature } from '../lib/security';
import { emailIsConfigured, sendVerificationEmail } from '../services/email';

 type AppEnv = { Bindings: Env };
type JsonBody = Record<string, unknown>;
type Envelope<T> = { success: boolean; data?: T; error?: string };

const authRoute = new Hono<AppEnv>();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLATFORMS = ['android', 'android_tv', 'ios', 'tvos', 'web'] as const;

function text(value: unknown, maxLength = 256) {
  return typeof value === 'string' && value.trim() && value.trim().length <= maxLength ? value.trim() : null;
}

function normalizeEmail(value: unknown) {
  const email = text(value, 254)?.toLowerCase();
  return email && EMAIL_PATTERN.test(email) ? email : null;
}

function password(value: unknown) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 256 ? value : null;
}

async function body(c: { req: { json(): Promise<unknown> } }): Promise<JsonBody | null> {
  const value = await c.req.json().catch(() => null);
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonBody : null;
}

function device(value: JsonBody) {
  const installationId = text(value.installation_id, 200);
  const platform = text(value.platform, 20);
  const deviceName = text(value.device_name, 80);
  if (!installationId || installationId.length < 16 || !platform || !PLATFORMS.includes(platform as typeof PLATFORMS[number])) return null;
  return { installationId, platform, deviceName };
}

function unconfigured(c: { json(value: unknown, status: 503): Response }) {
  return c.json({ success: false, error: 'Parent authentication is not configured' }, 503);
}

function durableResponse(data: unknown, status: number) {
  return Response.json(data, { status });
}

authRoute.post('/register', async (c) => {
  if (!authIsConfigured(c.env)) return unconfigured(c);
  const value = await body(c);
  const email = value ? normalizeEmail(value.email) : null;
  const passphrase = value ? password(value.password) : null;
  const displayName = value ? text(value.display_name, 80) : null;
  if (!email || !passphrase) {
    return c.json({ success: false, error: 'A valid email and a password of at least 12 characters are required' }, 400);
  }

  // Staging and production remain fail-closed until all Resend settings are
  // present. Development returns the token directly and never calls Resend.
  if (c.env.ENVIRONMENT !== 'development' && !emailIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Email verification delivery is not configured' }, 503);
  }

  const stub = await identityStub(c.env, email);
  // Derived from the email only: the password must never influence a stored key.
  const idempotencyKey = c.req.header('Idempotency-Key')
    ?? await createHmacSignature(`register:${email}`, c.env.AUTH_TOKEN_SECRET!);
  const registered = await callDurable<Envelope<{ parent_id: string; display_name: string | null; auth_epoch: number }>>(stub, '/register', {
    body: {
      normalized_email: email,
      password: passphrase,
      display_name: displayName,
      idempotency_key: idempotencyKey,
    },
  });
  if (!registered.ok || !registered.data?.success || !registered.data.data) {
    return durableResponse(registered.data ?? { success: false, error: 'Identity service unavailable' }, registered.status);
  }

  const parentId = registered.data.data.parent_id;
  const verificationToken = await createVerificationToken(c.env, parentId, email);
  if (c.env.ENVIRONMENT === 'development') {
    return c.json({
      success: true,
      data: {
        message: 'Verify the email address before signing in.',
        development_verification_token: verificationToken,
      },
    }, 201);
  }

  const delivery = await sendVerificationEmail(c.env, email, verificationToken);
  if (!delivery.ok) {
    // Registration is idempotent, so retrying the same credentials can safely
    // retry delivery without creating another identity.
    return c.json({ success: false, error: 'Verification email delivery is temporarily unavailable' }, 503);
  }
  return c.json({ success: true, data: { message: 'Verify the email address before signing in.' } }, 201);
});

authRoute.post('/resend-verification', async (c) => {
  if (!authIsConfigured(c.env)) return unconfigured(c);
  const value = await body(c);
  const email = value ? normalizeEmail(value.email) : null;
  // Always answer identically so an attacker cannot enumerate accounts.
  const generic = { success: true, data: { message: 'If the account requires verification, an email has been sent.' } };
  if (!email) return c.json(generic);
  if (c.env.ENVIRONMENT !== 'development' && !emailIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Email verification delivery is not configured' }, 503);
  }

  const requested = await callDurable<Envelope<{
    resend: boolean;
    parent_id?: string;
    normalized_email?: string;
  }>>(await identityStub(c.env, email), '/verification-request', { body: {} });
  const data = requested.data?.success ? requested.data.data : null;
  if (!requested.ok || !data?.resend || !data.parent_id || !data.normalized_email) return c.json(generic);

  const verificationToken = await createVerificationToken(c.env, data.parent_id, data.normalized_email);
  if (c.env.ENVIRONMENT === 'development') {
    return c.json({ success: true, data: { ...generic.data, development_verification_token: verificationToken } });
  }
  const delivery = await sendVerificationEmail(c.env, data.normalized_email, verificationToken);
  if (!delivery.ok) return c.json({ success: false, error: 'Verification email delivery is temporarily unavailable' }, 503);
  return c.json(generic);
});

authRoute.post('/verify-email', async (c) => {
  if (!authIsConfigured(c.env)) return unconfigured(c);
  const value = await body(c);
  const token = value ? text(value.token, 4096) : null;
  if (!token) return c.json({ success: false, error: 'Verification token is required' }, 400);
  const claims = await verifyEmailToken(c.env, token);
  if (!claims) return c.json({ success: false, error: 'Verification token is invalid or expired' }, 400);

  const verified = await callDurable<Envelope<{ verified: boolean }>>(await identityStub(c.env, claims.email), '/verify-email', {
    body: { parent_id: claims.sub, normalized_email: claims.email },
  });
  if (!verified.ok || !verified.data?.success) {
    return c.json({ success: false, error: 'Verification token is invalid or expired' }, 400);
  }
  return c.json({ success: true, data: { verified: true } });
});

authRoute.post('/login', async (c) => {
  if (!authIsConfigured(c.env)) return unconfigured(c);
  const value = await body(c);
  const email = value ? normalizeEmail(value.email) : null;
  const passphrase = value ? password(value.password) : null;
  if (!email || !passphrase) return c.json({ success: false, error: 'Invalid email or password' }, 401);
  const deviceValues = device(value!);
  if (!deviceValues) return c.json({ success: false, error: 'A valid installation and platform are required' }, 400);

  const loggedIn = await callDurable<Envelope<{
    parent_id: string;
    display_name: string | null;
    identity_epoch: number;
  }>>(await identityStub(c.env, email), '/login', { body: { password: passphrase } });
  if (!loggedIn.ok || !loggedIn.data?.success || !loggedIn.data.data) {
    return durableResponse(loggedIn.data ?? { success: false, error: 'Invalid email or password' }, loggedIn.status);
  }
  const identity = loggedIn.data.data;

  const initialized = await callDurable<Envelope<{ parent_id: string; auth_epoch: number }>>(familyStub(c.env, identity.parent_id), '/initialize', {
    body: {
      parent_id: identity.parent_id,
      display_name: identity.display_name,
      identity_epoch: identity.identity_epoch,
    },
  });
  if (!initialized.ok || !initialized.data?.success) {
    return c.json({ success: false, error: 'Family service unavailable' }, 503);
  }

  const session = await createParentSession(c.env, {
    parentId: identity.parent_id,
    ...deviceValues,
  });
  if (!session.ok) {
    return durableResponse({ success: false, error: session.error }, session.status);
  }
  return c.json({
    success: true,
    data: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: 'Bearer',
      expires_in: session.expires_in,
      refresh_expires_at: session.refresh_expires_at,
      parent: { id: session.principal.parentId, plan: session.principal.plan },
    },
  });
});

authRoute.post('/refresh', async (c) => {
  if (!authIsConfigured(c.env)) return unconfigured(c);
  const value = await body(c);
  const refreshToken = value ? text(value.refresh_token, 512) : null;
  if (!refreshToken) return c.json({ success: false, error: 'Refresh token is required' }, 400);
  const session = await rotateParentSession(c.env, refreshToken);
  if (!session) return c.json({ success: false, error: 'Refresh token is invalid or expired' }, 401);
  return c.json({
    success: true,
    data: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: 'Bearer',
      expires_in: session.expires_in,
      refresh_expires_at: session.refresh_expires_at,
    },
  });
});

authRoute.get('/me', async (c) => {
  const result = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!result.ok) {
    return c.json({ success: false, error: result.reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized' }, result.reason === 'unconfigured' ? 503 : 401);
  }
  return c.json({
    success: true,
    data: {
      parent_id: result.principal.parentId,
      plan: result.principal.plan,
      device_id: result.principal.deviceId,
    },
  });
});

authRoute.post('/logout', async (c) => {
  const result = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!result.ok) {
    return c.json({ success: false, error: result.reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized' }, result.reason === 'unconfigured' ? 503 : 401);
  }
  if (!await logoutParentSession(c.env, result.principal)) {
    return c.json({ success: false, error: 'Unable to end session' }, 503);
  }
  return c.json({ success: true, data: { logged_out: true } });
});

export default authRoute;
