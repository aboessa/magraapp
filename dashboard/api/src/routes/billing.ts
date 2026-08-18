import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryFirst } from '../lib/db.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';
import { authenticateParent } from '../lib/parentAuth.ts';
import { sha256Base64Url } from '../lib/security.ts';
import { verifyAuditAndApplyGooglePlay } from '../services/billing.ts';
import { GooglePlayError, googlePlayIsConfigured, parseGooglePlayProducts } from '../services/googlePlay.ts';
import { googlePubSubIsConfigured, parseGoogleRtdn, verifyGooglePubSubToken } from '../services/googleOidc.ts';

type AppEnv = { Bindings: Env };
const billingRoute = new Hono<AppEnv>();

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

function verificationError(error: unknown) {
  if (error instanceof GooglePlayError && error.code === 'invalid_purchase') {
    return Response.json({ success: false, error: 'Google Play purchase is invalid' }, { status: 400 });
  }
  return Response.json({
    success: false,
    error: error instanceof GooglePlayError && error.code === 'unconfigured'
      ? 'Google Play billing is not configured'
      : 'Google Play verification is temporarily unavailable',
  }, { status: 503 });
}

// GET /api/v1/billing/status
//
// The app called this endpoint before it existed, so `MembershipPage` had no
// data source and rendered as a placeholder. The effective plan is read from the
// same entitlement ledger that enforces limits, so the screen cannot claim a
// tier the app does not actually grant.
billingRoute.get('/status', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const result = await callDurable<unknown>(
    familyStub(c.env, auth.principal.parentId),
    '/billing/status',
  );
  return Response.json(
    result.data ?? { success: false, error: 'Billing service unavailable' },
    { status: result.status },
  );
});

billingRoute.get('/google-play/context', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  if (!googlePlayIsConfigured(c.env)) return c.json({ success: false, error: 'Google Play billing is not configured' }, 503);
  return c.json({
    success: true,
    data: {
      package_name: c.env.GOOGLE_PLAY_PACKAGE_NAME,
      products: parseGooglePlayProducts(c.env.GOOGLE_PLAY_PRODUCTS),
      obfuscated_account_id: await sha256Base64Url(auth.principal.parentId),
    },
  });
});

billingRoute.post('/google-play/verify', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  if (!googlePlayIsConfigured(c.env)) return c.json({ success: false, error: 'Google Play billing is not configured' }, 503);
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const purchaseToken = typeof body?.purchase_token === 'string' && body.purchase_token.length >= 20 && body.purchase_token.length <= 4096
    ? body.purchase_token
    : null;
  if (!purchaseToken) return c.json({ success: false, error: 'A valid purchase_token is required' }, 400);

  try {
    const result = await verifyAuditAndApplyGooglePlay(c.env, auth.principal.parentId, purchaseToken);
    return c.json({
      success: true,
      data: {
        product_id: result.productId,
        plan: result.plan,
        status: result.status,
        expires_at: result.expiresAt === null ? null : new Date(result.expiresAt).toISOString(),
      },
    });
  } catch (error) {
    return verificationError(error);
  }
});

// Google Cloud Pub/Sub authenticated push endpoint for Real-time Developer
// Notifications. The OIDC audience must equal this exact public endpoint.
billingRoute.post('/google-play/rtdn', async (c) => {
  if (!googlePlayIsConfigured(c.env) || !googlePubSubIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Google Play notifications are not configured' }, 503);
  }
  if (!await verifyGooglePubSubToken(c.env, c.req.header('Authorization'))) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const notification = parseGoogleRtdn(await c.req.json().catch(() => null));
  if (!notification) return c.json({ success: false, error: 'Invalid notification' }, 400);
  if (notification.test) return c.body(null, 204);
  if (notification.packageName !== c.env.GOOGLE_PLAY_PACKAGE_NAME) {
    return c.json({ success: false, error: 'Invalid package' }, 400);
  }

  const purchaseTokenHash = await sha256Base64Url(notification.purchaseToken);
  const audit = await queryFirst<{ parent_id: string }>(c.env.DB, `
    SELECT parent_id FROM billing_audit WHERE purchase_token_hash = ?
  `, [purchaseTokenHash]);
  if (!audit) {
    // Pub/Sub retries until the app submits the initial purchase and establishes
    // the token-to-parent mapping without storing the raw token.
    return c.json({ success: false, error: 'Purchase mapping is not available yet' }, 503);
  }

  try {
    await verifyAuditAndApplyGooglePlay(c.env, audit.parent_id, notification.purchaseToken);
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof GooglePlayError && error.code === 'invalid_purchase') {
      // The provider has definitively rejected the purchase; retrying the same
      // notification cannot repair it.
      return c.body(null, 204);
    }
    return c.json({ success: false, error: 'Notification processing is temporarily unavailable' }, 503);
  }
});

export default billingRoute;
