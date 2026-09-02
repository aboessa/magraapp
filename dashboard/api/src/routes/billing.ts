import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';
import { bodyOr400, text } from '../lib/requestSchema.ts';
import { PLAN_LIMITS } from '../lib/familyPolicy.ts';
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

type CatalogOfferRow = {
  id: string;
  provider: string;
  product_id: string;
  plan: 'family' | 'family_plus';
  billing_period: string;
  country: string;
  currency: string;
  currency_exponent: number;
  price_minor: number;
};

type PaymentMethodRow = {
  id: string;
  provider: string;
  method_code: string;
  name_ar: string;
  name_en: string;
  country: string;
  checkout_mode: string;
  status: 'draft' | 'active' | 'disabled';
};

function catalogueCountry(c: { env: Env; req: { header(name: string): string | undefined; query(name: string): string | undefined } }) {
  // Cloudflare overwrites CF-IPCountry at the edge. A query override is useful
  // only for a local preview (`ENVIRONMENT=development`) and is never accepted
  // in production — وهما البيئتان الوحيدتان.
  const preview = c.env.ENVIRONMENT === 'production' ? null : c.req.query('country');
  const candidate = preview ?? c.req.header('CF-IPCountry');
  if (!candidate || !/^[A-Za-z]{2}$/.test(candidate)) return 'GLOBAL';
  const country = candidate.toUpperCase();
  return country === 'XX' || country === 'T1' ? 'GLOBAL' : country;
}

async function googlePlaySalesEnabled(env: Env, country: string) {
  if (!googlePlayIsConfigured(env)) return false;
  try {
    const row = await queryFirst<{ id: string; status: string }>(env.DB, `
      SELECT id, status FROM billing_payment_methods
      WHERE provider='google_play'
        AND platform='android'
        AND checkout_mode='native_store'
        AND country IN (?, 'GLOBAL')
      ORDER BY CASE WHEN country=? THEN 0 ELSE 1 END
      LIMIT 1
    `, [country, country]);
    return row?.status === 'active';
  } catch (error) {
    // During a phased rollout, a missing control table must disable new sales,
    // not bypass the operator kill switch. Other D1 failures remain visible.
    if (!String(error).toLowerCase().includes('no such table')) throw error;
    return false;
  }
}

// GET /api/v1/billing/catalog?platform=android|ios|web
//
// The catalogue controls presentation and product discovery only. Checkout and
// entitlement endpoints must resolve the product, amount, currency and account
// again from trusted server/provider data; clients never authorise a price.
billingRoute.get('/catalog', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const requestedPlatform = c.req.query('platform')?.trim().toLowerCase();
  const platform = requestedPlatform === 'android' || requestedPlatform === 'ios' || requestedPlatform === 'web'
    ? requestedPlatform
    : 'unsupported';
  const country = catalogueCountry(c);
  const providers = platform === 'android'
    ? ['google_play']
    : platform === 'ios'
      ? ['app_store']
      : platform === 'web'
        ? ['stripe', 'manual']
        : [];

  const pricingColumns = await queryAll<{ name: string }>(c.env.DB, 'PRAGMA table_info(plan_pricing)');
  const exponentExpression = pricingColumns.some((column) => column.name === 'currency_exponent')
    ? 'pp.currency_exponent'
    : '2';
  const rows = providers.length === 0 ? [] : await queryAll<CatalogOfferRow>(c.env.DB, `
    SELECT
      pp.id,
      sp.provider,
      sp.store_product_id AS product_id,
      pp.plan,
      sp.billing_period,
      pp.country,
      pp.currency,
      ${exponentExpression} AS currency_exponent,
      pp.price_minor
    FROM plan_pricing pp
    JOIN store_products sp ON sp.id = pp.store_product_id
    WHERE pp.status = 'active'
      AND sp.status = 'active'
      AND pp.plan IN ('family', 'family_plus')
      AND pp.country IN (?, 'GLOBAL')
      AND sp.provider IN (${providers.map(() => '?').join(', ')})
      AND datetime(pp.effective_from) <= datetime('now')
      AND (pp.effective_until IS NULL OR datetime(pp.effective_until) > datetime('now'))
    ORDER BY
      CASE WHEN pp.country = ? THEN 0 ELSE 1 END,
      CASE sp.billing_period WHEN 'annual' THEN 0 WHEN 'monthly' THEN 1 ELSE 2 END,
      pp.plan,
      sp.provider
  `, [country, ...providers, country]);

  // Exact-country rows win over GLOBAL without allowing multiple active price
  // revisions for the same provider product to leak into the client.
  const seenOffers = new Set<string>();
  const offers = rows.filter((row) => {
    const key = `${row.provider}:${row.product_id}:${row.plan}:${row.billing_period}`;
    if (seenOffers.has(key)) return false;
    seenOffers.add(key);
    return true;
  });

  let configuredMethods: PaymentMethodRow[] = [];
  if (platform !== 'unsupported') {
    try {
      configuredMethods = await queryAll<PaymentMethodRow>(c.env.DB, `
        SELECT id, provider, method_code, name_ar, name_en, country, checkout_mode, status
        FROM billing_payment_methods
        WHERE platform = ? AND country IN (?, 'GLOBAL')
        ORDER BY CASE WHEN country = ? THEN 0 ELSE 1 END, sort_order, name_ar
      `, [platform, country, country]);
    } catch (error) {
      // Safe phased rollout: the catalogue remains usable if the Worker reaches
      // an environment before migration 0075. Other D1 failures remain visible.
      if (!String(error).toLowerCase().includes('no such table')) throw error;
      configuredMethods = [];
    }
  }

  // An active operator row is a required runtime kill switch. Only adapters
  // that are both implemented and configured may pass through to clients.
  const seenMethods = new Set<string>();
  const paymentMethods = configuredMethods.filter((method) => {
    const key = `${method.provider}:${method.method_code}`;
    if (seenMethods.has(key)) return false;
    seenMethods.add(key);
    return method.status === 'active'
      && method.provider === 'google_play'
      && method.checkout_mode === 'native_store'
      && googlePlayIsConfigured(c.env);
  });

  return c.json({
    success: true,
    data: {
      country,
      platform,
      plans: (['family', 'family_plus'] as const).map((id) => ({
        id,
        limits: {
          children: PLAN_LIMITS[id].children,
          devices: PLAN_LIMITS[id].devices,
          concurrent_streams: PLAN_LIMITS[id].concurrentStreams,
          download_devices: PLAN_LIMITS[id].downloadDevices,
        },
      })),
      offers,
      payment_methods: paymentMethods.map((method) => ({
        id: method.id,
        provider: method.provider,
        code: method.method_code,
        name_ar: method.name_ar,
        name_en: method.name_en,
        checkout_mode: method.checkout_mode,
      })),
    },
  });
});

billingRoute.get('/google-play/context', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const country = catalogueCountry(c);
  if (!await googlePlaySalesEnabled(c.env, country)) {
    return c.json({ success: false, error: 'Google Play checkout is disabled for this market' }, 503);
  }
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
  // SEC-110: الحدود نفسها، مُعلَنةً في مخطَّط بدل شرطٍ ثلاثيّ.
  const parsed = await bodyOr400<{ purchase_token: string }>(c, {
    purchase_token: text({ min: 20, max: 4096 }),
  });
  if (!parsed.ok) return parsed.response;
  const purchaseToken = parsed.value.purchase_token;

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
