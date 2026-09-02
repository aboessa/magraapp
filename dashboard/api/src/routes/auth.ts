import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import {
  callDurable,
  familyStub,
  identityStubByName,
  resolveIdentity,
  upsertIdentityDirectory,
} from '../lib/doClient.ts';
import {
  authIsConfigured,
  authenticateParent,
  createParentSession,
  createPasswordResetToken,
  createVerificationToken,
  logoutParentSession,
  rotateParentSession,
  verifyEmailToken,
  verifyPasswordResetToken,
} from '../lib/parentAuth.ts';
import { createHmacSignature } from '../lib/security.ts';
import {
  parseBody,
  text as textField,
  validationFailure,
  type BodySchema,
} from '../lib/requestSchema.ts';
import {
  emailIsConfigured,
  passwordResetEmailIsConfigured,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../services/email.ts';

type AppEnv = { Bindings: Env };
type JsonBody = Record<string, unknown>;
type Envelope<T> = { success: boolean; data?: T; error?: string };

const authRoute = new Hono<AppEnv>();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PLATFORMS = [
  'android',
  'android_tv',
  'ios',
  'tvos',
  'web',
  'windows',
  'macos',
  'linux',
] as const;

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

/// SEC-110: مخطَّطات أجسام الطلبات لهذا الموجّه.
///
/// المخطَّط **لا يستبدل** الدوالّ أعلاه: `normalizeEmail` تُطبّع وتفحص النمط،
/// و`password` تفحص الطول الأدنى، و`device` تفحص القائمة المغلقة للمنصّات. وهذه
/// دلالات لا أشكال. ما يضيفه المخطَّط طبقة سابقة لها: النوع، والسقف، **ورفض
/// الحقل غير المعروف**.
///
/// وأثره الأول ظهر هنا: `POST /register` كان يستقبل `installation_id` و`platform`
/// و`device_name` من التطبيق (`majarra_api_client.dart:238`) **ويهملها كلّها**.
/// إعلانها يوثّق أن العميل يرسلها، وحذفها من العميل قرار مستقلّ.
const SCHEMAS = {
  register: {
    email: textField({ max: 254 }),
    password: textField({ min: 1, max: 256 }),
    display_name: textField({ max: 80, optional: true }),
    installation_id: textField({ max: 200, optional: true }),
    platform: textField({ max: 20, optional: true }),
    device_name: textField({ max: 80, optional: true }),
  },
  login: {
    email: textField({ max: 254 }),
    password: textField({ min: 1, max: 256 }),
    installation_id: textField({ max: 200 }),
    platform: textField({ max: 20 }),
    device_name: textField({ max: 80, optional: true }),
  },
  email: { email: textField({ max: 254 }) },
  verifyEmail: { token: textField({ max: 4096 }) },
  resetPassword: {
    token: textField({ max: 8192 }),
    new_password: textField({ min: 1, max: 256 }),
  },
  refresh: { refresh_token: textField({ max: 512 }) },
} satisfies Record<string, BodySchema>;

/// يقرأ الجسم مقابل مخطَّط. الفشل ردٌّ جاهز بشكل موحَّد.
async function schemaBody<T extends JsonBody>(
  c: { req: { json(): Promise<unknown> } },
  schema: BodySchema,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const parsed = await parseBody<T>(c, schema);
  if (parsed.ok) return { ok: true, value: parsed.value };
  return { ok: false, response: Response.json(validationFailure(parsed), { status: 400 }) };
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

async function identityLocator(env: Env, email: string) {
  try {
    return await resolveIdentity(env, email);
  } catch {
    return null;
  }
}

function directoryUnavailable(c: { json(value: unknown, status: 503): Response }) {
  return c.json({ success: false, error: 'Identity directory is temporarily unavailable' }, 503);
}

/// الحدّ يُطبَّق مرة واحدة، على الحافة في `src/index.ts`.
///
/// ## العلّة التي أُزيلت هنا
///
/// كانت هذه الوحدة تُركّب `strictAuthLimit` على خمسة مسارات، و`index.ts:83`
/// يركّبه على `/api/v1/auth/*`. الطلب الواحد كان يمرّ بالوسيط **مرتين**،
/// فيستهلك وحدتين من الميزانية بدل واحدة: الحدّ المُعلَن 5 لكل دقيقة صار
/// عمليًّا 2، وترويسة `X-RateLimit-Limit` تقول 5 وترويسة `Remaining` تنقص
/// باثنين. النتيجة العملية أن ولي أمر يخطئ كلمة المرور مرتين يُحجب دقيقة
/// كاملة، ويُقال له إن له خمس محاولات.
///
/// كشفها `test/rateLimit.test.mjs:213` بستّ محاولات أنتجت أربع استجابات 429 بدل
/// واحدة — وهو رقم لا يفسّره إلا الاستهلاك المزدوج.
///
/// واثنان من الخمسة كانا ميتين أصلًا: لا يوجد مسار `/password-reset/request`
/// ولا `/password-reset/verify` في هذه الوحدة؛ المسارات الفعلية
/// `/forgot-password` و`/reset-password`، وكلاهما مشمول بنمط الحافة.
///
/// القاعدة: كل الحدود تُعلَن في مكان واحد (`index.ts`) حتى يبقى مجموع ما
/// يستهلكه الطلب مقروءًا من ملف واحد.

authRoute.post('/register', async (c) => {
  if (!authIsConfigured(c.env)) return unconfigured(c);
  const parsed = await schemaBody(c, SCHEMAS.register);
  if (!parsed.ok) return parsed.response;
  const value = parsed.value;
  const email = normalizeEmail(value.email);
  const passphrase = password(value.password);
  const displayName = text(value.display_name, 80);
  if (!email || !passphrase) {
    return c.json({ success: false, error: 'A valid email and a password of at least 12 characters are required' }, 400);
  }

  // الإنتاج يفشل مغلقًا حتى تُضبط كل إعدادات Resend. والتطوير يعيد التوكن
  // مباشرة ولا ينادي Resend إطلاقًا. (لا توجد بيئة ثالثة: قرار مالك بأن كل شيء
  // على الإنتاج في مرحلة التطوير هذه.)
  if (c.env.ENVIRONMENT !== 'development' && !emailIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Email verification delivery is not configured' }, 503);
  }

  const locator = await identityLocator(c.env, email);
  if (!locator) return directoryUnavailable(c);
  const stub = locator.stub;
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
  const directoryReady = await upsertIdentityDirectory(c.env, {
    parentId,
    emailHash: locator.emailHash,
    identityName: locator.identityName,
  });
  if (!directoryReady) return directoryUnavailable(c);
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
  const parsed = await schemaBody(c, SCHEMAS.email);
  // Always answer identically so an attacker cannot enumerate accounts.
  const generic = { success: true, data: { message: 'If the account requires verification, an email has been sent.' } };
  // الجواب العامّ يبقى للبريد **الصالح شكلًا وغير المعروف**: هذا ما يمنع التعداد.
  // وجسم بلا حقل بريد أصلًا ليس سؤالًا عن حساب، فالردّ عليه رفضُ شكل لا جواب عامّ.
  if (!parsed.ok) return parsed.response;
  const email = normalizeEmail(parsed.value.email);
  if (!email) return c.json(generic);
  if (c.env.ENVIRONMENT !== 'development' && !emailIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Email verification delivery is not configured' }, 503);
  }

  const locator = await identityLocator(c.env, email);
  if (!locator) return directoryUnavailable(c);
  const requested = await callDurable<Envelope<{
    resend: boolean;
    delivery_id?: string;
    parent_id?: string;
    normalized_email?: string;
  }>>(locator.stub, '/verification-request', { body: {} });
  const data = requested.data?.success ? requested.data.data : null;
  if (!requested.ok || !data?.resend || !data.delivery_id || !data.parent_id || !data.normalized_email) {
    return c.json(generic);
  }

  const cancelDelivery = () => callDurable(locator.stub, '/verification-request/cancel', {
    body: { delivery_id: data.delivery_id },
  });
  const directoryReady = await upsertIdentityDirectory(c.env, {
    parentId: data.parent_id,
    emailHash: locator.emailHash,
    identityName: locator.identityName,
  });
  if (!directoryReady) {
    await cancelDelivery();
    return directoryUnavailable(c);
  }
  const verificationToken = await createVerificationToken(c.env, data.parent_id, data.normalized_email);
  if (c.env.ENVIRONMENT === 'development') {
    return c.json({ success: true, data: { ...generic.data, development_verification_token: verificationToken } });
  }
  const delivery = await sendVerificationEmail(c.env, data.normalized_email, verificationToken);
  if (!delivery.ok) {
    await cancelDelivery();
    return c.json({ success: false, error: 'Verification email delivery is temporarily unavailable' }, 503);
  }
  return c.json(generic);
});

authRoute.post('/verify-email', async (c) => {
  if (!authIsConfigured(c.env)) return unconfigured(c);
  const parsed = await schemaBody(c, SCHEMAS.verifyEmail);
  if (!parsed.ok) return parsed.response;
  const token = text(parsed.value.token, 4096);
  if (!token) return c.json({ success: false, error: 'Verification token is required' }, 400);
  const claims = await verifyEmailToken(c.env, token);
  if (!claims) return c.json({ success: false, error: 'Verification token is invalid or expired' }, 400);

  const locator = await identityLocator(c.env, claims.email);
  if (!locator) return directoryUnavailable(c);
  const verified = await callDurable<Envelope<{ verified: boolean }>>(locator.stub, '/verify-email', {
    body: { parent_id: claims.sub, normalized_email: claims.email },
  });
  if (!verified.ok || !verified.data?.success) {
    return c.json({ success: false, error: 'Verification token is invalid or expired' }, 400);
  }
  const directoryReady = await upsertIdentityDirectory(c.env, {
    parentId: claims.sub,
    emailHash: locator.emailHash,
    identityName: locator.identityName,
  });
  if (!directoryReady) return directoryUnavailable(c);
  return c.json({ success: true, data: { verified: true } });
});

authRoute.post('/forgot-password', async (c) => {
  if (!authIsConfigured(c.env)) return unconfigured(c);
  const parsed = await schemaBody(c, SCHEMAS.email);
  const generic = {
    success: true,
    data: { message: 'If an eligible account exists, a password reset email has been sent.' },
  };
  if (!parsed.ok) return parsed.response;
  const email = normalizeEmail(parsed.value.email);
  if (!email) return c.json(generic);
  if (c.env.ENVIRONMENT !== 'development' && !passwordResetEmailIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Password reset delivery is not configured' }, 503);
  }

  const locator = await identityLocator(c.env, email);
  if (!locator) return directoryUnavailable(c);
  const requested = await callDurable<Envelope<{
    issue: boolean;
    parent_id?: string;
    normalized_email?: string;
    jti?: string;
    expires_at?: number;
  }>>(locator.stub, '/password-reset/request', {
    body: { normalized_email: email },
  });
  const reset = requested.data?.success ? requested.data.data : null;
  if (!requested.ok || !reset?.issue || !reset.parent_id || !reset.normalized_email
    || !reset.jti || !Number.isInteger(reset.expires_at)) {
    return c.json(generic);
  }

  const cancelDelivery = () => callDurable(locator.stub, '/password-reset/cancel', {
    body: { jti: reset.jti },
  });
  const directoryReady = await upsertIdentityDirectory(c.env, {
    parentId: reset.parent_id,
    emailHash: locator.emailHash,
    identityName: locator.identityName,
  });
  if (!directoryReady) {
    await cancelDelivery();
    return directoryUnavailable(c);
  }
  const resetToken = await createPasswordResetToken(c.env, {
    parentId: reset.parent_id,
    identityName: locator.identityName,
    emailHash: locator.emailHash,
    jti: reset.jti,
    expiresAt: reset.expires_at!,
  });
  if (c.env.ENVIRONMENT === 'development') {
    return c.json({
      success: true,
      data: { ...generic.data, development_password_reset_token: resetToken },
    });
  }

  const delivery = await sendPasswordResetEmail(c.env, reset.normalized_email, resetToken);
  if (!delivery.ok) {
    await cancelDelivery();
    return c.json({ success: false, error: 'Password reset email delivery is temporarily unavailable' }, 503);
  }
  return c.json(generic);
});

authRoute.post('/reset-password', async (c) => {
  if (!authIsConfigured(c.env)) return unconfigured(c);
  const parsed = await schemaBody(c, SCHEMAS.resetPassword);
  if (!parsed.ok) return parsed.response;
  const token = text(parsed.value.token, 8192);
  const nextPassword = password(parsed.value.new_password);
  if (!token || !nextPassword) {
    return c.json({ success: false, error: 'A valid reset token and password of at least 12 characters are required' }, 400);
  }
  const claims = await verifyPasswordResetToken(c.env, token);
  if (!claims) return c.json({ success: false, error: 'Password reset token is invalid or expired' }, 400);

  const identityStub = identityStubByName(c.env, claims.identity_name);
  const prepared = await callDurable<Envelope<{
    prepared: boolean;
    already_prepared: boolean;
    parent_id: string;
  }>>(identityStub, '/password-reset/prepare', {
    body: {
      parent_id: claims.sub,
      jti: claims.jti,
      new_password: nextPassword,
    },
  });
  const preparation = prepared.data?.success ? prepared.data.data : null;
  if (!prepared.ok || !preparation?.prepared || preparation.parent_id !== claims.sub) {
    return durableResponse(
      prepared.data ?? { success: false, error: 'Password reset token is invalid or expired' },
      prepared.status === 409 ? 409 : 400,
    );
  }

  // The password hash is only staged above. Session revocation and epoch
  // rotation happen before the identity commit, so an old session can never
  // survive a successfully installed password.
  const revoked = await callDurable<Envelope<{ revoked: number; auth_epoch: number }>>(
    familyStub(c.env, claims.sub),
    '/sessions/revoke-all',
    {
      body: {
        parent_id: claims.sub,
        reason: 'password_reset',
        operation_id: claims.jti,
      },
    },
  );
  if (!revoked.ok || !revoked.data?.success) {
    return c.json({
      success: false,
      error: 'Active sessions could not be closed. The password was not changed; retry this link.',
    }, 503);
  }

  const committed = await callDurable<Envelope<{ changed: boolean; parent_id: string }>>(
    identityStub,
    '/password-reset/commit',
    { body: { parent_id: claims.sub, jti: claims.jti } },
  );
  const reset = committed.data?.success ? committed.data.data : null;
  if (!committed.ok || !reset?.changed || reset.parent_id !== claims.sub) {
    return c.json({
      success: false,
      error: 'Sessions were closed, but the password change is still pending. Retry this link.',
    }, committed.status >= 500 ? 503 : 400);
  }
  return c.json({ success: true, data: { changed: true, sessions_revoked: true } });
});

authRoute.post('/login', async (c) => {
  if (!authIsConfigured(c.env)) return unconfigured(c);
  const parsed = await schemaBody(c, SCHEMAS.login);
  if (!parsed.ok) return parsed.response;
  const value = parsed.value;
  const email = normalizeEmail(value.email);
  const passphrase = password(value.password);
  if (!email || !passphrase) return c.json({ success: false, error: 'Invalid email or password' }, 401);
  const deviceValues = device(value);
  if (!deviceValues) return c.json({ success: false, error: 'A valid installation and platform are required' }, 400);

  const locator = await identityLocator(c.env, email);
  if (!locator) return directoryUnavailable(c);
  const loggedIn = await callDurable<Envelope<{
    parent_id: string;
    display_name: string | null;
    normalized_email: string;
    identity_epoch: number;
  }>>(locator.stub, '/login', {
    body: { password: passphrase, normalized_email: email },
  });
  if (!loggedIn.ok || !loggedIn.data?.success || !loggedIn.data.data) {
    return durableResponse(loggedIn.data ?? { success: false, error: 'Invalid email or password' }, loggedIn.status);
  }
  const identity = loggedIn.data.data;
  const directoryReady = await upsertIdentityDirectory(c.env, {
    parentId: identity.parent_id,
    emailHash: locator.emailHash,
    identityName: locator.identityName,
  });
  if (!directoryReady) return directoryUnavailable(c);

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
  const parsed = await schemaBody(c, SCHEMAS.refresh);
  if (!parsed.ok) return parsed.response;
  const refreshToken = text(parsed.value.refresh_token, 512);
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
