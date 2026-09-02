import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts'
import { parsePagination } from '../lib/catalogueValidation.ts'
import { actorId, auditStatement } from '../lib/auditLog.ts'
import { pathParam } from '../lib/routeParams.ts'
import {
  getGooglePlaySubscription,
  GooglePlayError,
  googlePlayIsConfigured,
  parseGooglePlayProducts,
  updateGooglePlayRegionalBasePlanPrice,
} from '../services/googlePlay.ts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()
route.use('*', requireAdmin)

type PriceDraft = {
  id: string
  product_id: string
  base_plan_id: string
  region_code: string
  currency_code: string
  units: string
  nanos: number
  observed_price_json: string | null
  observed_regions_version: string
  status: 'draft' | 'published' | 'superseded' | 'failed'
  created_by: string | null
  published_by: string | null
  published_at: string | null
  failure_code: string | null
  created_at: string
  updated_at: string
}

function moneyEquals(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function validPriceInput(value: Record<string, unknown>) {
  const productId = typeof value.product_id === 'string' ? value.product_id.trim() : ''
  const basePlanId = typeof value.base_plan_id === 'string' ? value.base_plan_id.trim() : ''
  const regionCode = typeof value.region_code === 'string' ? value.region_code.trim().toUpperCase() : ''
  const currencyCode = typeof value.currency_code === 'string' ? value.currency_code.trim().toUpperCase() : ''
  const units = typeof value.units === 'string' ? value.units.trim() : ''
  const nanos = typeof value.nanos === 'number' ? value.nanos : Number(value.nanos)
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(productId)
    || !/^[A-Za-z0-9._-]{1,200}$/.test(basePlanId)
    || !/^[A-Z]{2}$/.test(regionCode)
    || !/^[A-Z]{3}$/.test(currencyCode)
    || !/^\d+$/.test(units)
    || !Number.isInteger(nanos)
    || nanos < 0
    || nanos > 999_999_999) return null
  return { productId, basePlanId, regionCode, currencyCode, units, nanos }
}

function priceDraftResponse(draft: PriceDraft) {
  let observedPrice: unknown = null
  try { observedPrice = draft.observed_price_json ? JSON.parse(draft.observed_price_json) : null } catch { /* legacy malformed row remains inspectable */ }
  return { ...draft, observed_price: observedPrice, observed_price_json: undefined }
}

function googlePlayAdminError(error: unknown) {
  if (error instanceof GooglePlayError && error.code === 'unconfigured') {
    return 'Google Play pricing is not configured'
  }
  return 'Google Play pricing is temporarily unavailable'
}

type CommercePlan = 'family' | 'family_plus'
type StoreProvider = 'google_play' | 'app_store' | 'stripe' | 'manual'
type PaymentProvider = 'google_play' | 'app_store' | 'stripe' | 'payment_gateway'

const commercePlans = new Set<CommercePlan>(['family', 'family_plus'])
const storeProviders = new Set<StoreProvider>(['google_play', 'app_store', 'stripe', 'manual'])
const paymentProviders = new Set<PaymentProvider>(['google_play', 'app_store', 'stripe', 'payment_gateway'])
const billingPeriods = new Set(['weekly', 'monthly', 'annual', 'lifetime'])
const checkoutModes = new Set(['native_store', 'hosted_checkout', 'redirect'])
const paymentPlatforms = new Set(['android', 'ios', 'web'])

const productTransitions: Record<string, ReadonlySet<string>> = {
  inactive: new Set(['active', 'deprecated']),
  active: new Set(['inactive', 'deprecated']),
  deprecated: new Set(),
}
const pricingTransitions: Record<string, ReadonlySet<string>> = {
  draft: new Set(['active']),
  active: new Set(['expired']),
  expired: new Set(),
}
const paymentTransitions: Record<string, ReadonlySet<string>> = {
  draft: new Set(['active', 'disabled']),
  active: new Set(['disabled']),
  disabled: new Set(['draft', 'active']),
}

const supportedCurrencies = new Set([
  'AED', 'BHD', 'EGP', 'EUR', 'GBP', 'JOD', 'JPY', 'KRW', 'KWD', 'OMR',
  'QAR', 'SAR', 'TND', 'USD',
])
const zeroExponentCurrencies = new Set(['JPY', 'KRW'])
const threeExponentCurrencies = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND'])

function currencyExponentFor(currency: string) {
  if (!supportedCurrencies.has(currency)) return undefined
  if (zeroExponentCurrencies.has(currency)) return 0
  if (threeExponentCurrencies.has(currency)) return 3
  return 2
}

function transitionAllowed(matrix: Record<string, ReadonlySet<string>>, from: unknown, to: string) {
  return typeof from === 'string' && matrix[from]?.has(to) === true
}

function text(value: unknown, maximum = 200) {
  if (typeof value !== 'string') return ''
  const result = value.trim()
  return result.length <= maximum ? result : ''
}

function countryCode(value: unknown, optional = false) {
  const result = text(value, 6).toUpperCase()
  if (optional && !result) return null
  return result === 'GLOBAL' || /^[A-Z]{2}$/.test(result) ? result : undefined
}

function currencyCode(value: unknown, optional = false) {
  const result = text(value, 3).toUpperCase()
  if (optional && !result) return null
  return /^[A-Z]{3}$/.test(result) ? result : undefined
}

function integer(value: unknown, minimum: number, maximum: number) {
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(result) && result >= minimum && result <= maximum ? result : null
}

function isoDate(value: unknown, optional = false) {
  const result = text(value, 40)
  if (optional && !result) return null
  if (!result || Number.isNaN(Date.parse(result))) return undefined
  return new Date(result).toISOString()
}

function paymentAdapterReady(env: Env, provider: string, platform: string, mode: string) {
  return provider === 'google_play'
    && platform === 'android'
    && mode === 'native_store'
    && googlePlayIsConfigured(env)
}

function duplicateResponse(c: any, error: unknown, message: string) {
  const detail = String(error).toLowerCase()
  if (detail.includes('unique') || detail.includes('constraint')) {
    return c.json({ success: false, error: message }, 409)
  }
  throw error
}

// ---- Subscriptions collection (billing_audit + family_projection) ----
// Distinguishes STORE STATE vs EFFECTIVE ENTITLEMENT
route.get('/subscriptions', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const q = c.req.query('q')?.trim()
  const plan = c.req.query('plan')
  const provider = c.req.query('provider')
  const status = c.req.query('status')
  const entitlement = c.req.query('entitlement') // effective

  const clauses: string[] = []
  const params: unknown[] = []
  if (q) { clauses.push('(b.parent_id LIKE ? OR b.product_id LIKE ? OR f.display_name LIKE ?)'); const t=`%${q}%`; params.push(t,t,t) }
  if (plan) { clauses.push('b.plan = ?'); params.push(plan) }
  if (provider) { clauses.push('b.provider = ?'); params.push(provider) }
  if (status) { clauses.push('b.provider_state = ?'); params.push(status) }
  if (entitlement) { clauses.push('b.entitlement_status = ?'); params.push(entitlement) }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) as total FROM billing_audit b LEFT JOIN family_projection f ON f.parent_id=b.parent_id ${where}`, params)
  const rows = await queryAll(c.env.DB, `
    SELECT b.id, b.parent_id, f.display_name as family_name, f.status as family_status, f.plan as family_plan,
           b.product_id, b.plan, b.provider, b.provider_state, b.entitlement_status, b.starts_at_ms, b.expires_at_ms, b.verified_at_ms, b.created_at,
           CASE WHEN b.provider_state != b.entitlement_status THEN 1 ELSE 0 END as has_mismatch
    FROM billing_audit b
    LEFT JOIN family_projection f ON f.parent_id=b.parent_id
    ${where}
    ORDER BY b.verified_at_ms DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset } })
})

route.get('/subscriptions/:id', async (c) => {
  const id = pathParam(c, 'id')
  const row = await queryFirst(c.env.DB, `SELECT b.*, f.display_name as family_name, f.status as family_status, f.plan as family_plan FROM billing_audit b LEFT JOIN family_projection f ON f.parent_id=b.parent_id WHERE b.id=?`, [id])
  if (!row) return c.json({ success: false, error: 'Subscription not found' }, 404)
  // Entitlement reconciliation: compare provider_state vs entitlement_status
  const mismatch = (row as any).provider_state !== (row as any).entitlement_status
  // Related transactions for same family
  const related = await queryAll(c.env.DB, `SELECT id, product_id, provider_state, entitlement_status, verified_at_ms FROM billing_audit WHERE parent_id=? ORDER BY verified_at_ms DESC LIMIT 10`, [(row as any).parent_id])
  // Family entitlement from FamilyState projection (family_projection)
  const family = await queryFirst(c.env.DB, `SELECT parent_id, plan, status, last_event_at_ms FROM family_projection WHERE parent_id=?`, [(row as any).parent_id])
  return c.json({ success: true, data: { ...row, has_mismatch: mismatch, related_transactions: related, family_entitlement: family } })
})

route.get('/transactions/:id', async (c) => {
  const id = pathParam(c, 'id')
  const row = await queryFirst(c.env.DB, `SELECT b.*, f.display_name as family_name FROM billing_audit b LEFT JOIN family_projection f ON f.parent_id=b.parent_id WHERE b.id=?`, [id])
  if (!row) return c.json({ success: false, error: 'Transaction not found' }, 404)
  const history = await queryAll(c.env.DB, `SELECT * FROM audit_logs WHERE entity_type='billing' AND entity_id=? ORDER BY created_at DESC LIMIT 20`, [id])
  // Also check for refund/duplicate: same purchase_token_hash
  const dupCheck = await queryFirst<{ cnt: number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM billing_audit WHERE purchase_token_hash=?`, [(row as any).purchase_token_hash])
  return c.json({ success: true, data: { ...row, is_duplicate: Number(dupCheck?.cnt ?? 1) > 1, history } })
})

// Provider reconciliation diagnostics
route.get('/commerce/reconciliation', async (c) => {
  const mismatches = await queryAll(c.env.DB, `
    SELECT b.parent_id, b.product_id, b.provider_state, b.entitlement_status, b.verified_at_ms, f.plan as family_plan
    FROM billing_audit b LEFT JOIN family_projection f ON f.parent_id=b.parent_id
    WHERE b.provider_state != b.entitlement_status
    ORDER BY b.verified_at_ms DESC LIMIT 20
  `)
  const dupes = await queryAll(c.env.DB, `SELECT purchase_token_hash, COUNT(*) as cnt FROM billing_audit GROUP BY purchase_token_hash HAVING cnt > 1 LIMIT 10`)
  const unmapped = await queryAll(c.env.DB, `SELECT DISTINCT b.product_id, b.provider FROM billing_audit b LEFT JOIN store_products sp ON sp.store_product_id=b.product_id WHERE sp.id IS NULL LIMIT 10`)
  const unverified = await queryAll(c.env.DB, `SELECT parent_id, product_id, provider_state FROM billing_audit WHERE provider_state IN ('pending','unverified','failed') LIMIT 10`)
  return c.json({ success: true, data: { mismatches, duplicates: dupes, unmapped_products: unmapped, unverified } })
})

// ---- Plans & Pricing ----
route.get('/plans/:id', async (c) => {
  const id = pathParam(c, 'id')
  const { PLAN_LIMITS } = await import('../lib/familyPolicy.ts')
  const limits = (PLAN_LIMITS as any)[id]
  if (!limits) return c.json({ success: false, error: 'Plan not found' }, 404)
  // Count subscribers
  const subs = await queryFirst<{ cnt: number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM family_projection WHERE plan=? AND status='active'`, [id])
  // Pricing matrix for this plan
  const pricing = await queryAll(c.env.DB, `SELECT pp.*, sp.store_product_id, sp.provider, sp.billing_period FROM plan_pricing pp JOIN store_products sp ON sp.id=pp.store_product_id WHERE pp.plan=? ORDER BY pp.country, pp.effective_from DESC`, [id])
  const products = await queryAll(c.env.DB, `SELECT * FROM store_products WHERE plan=? ORDER BY provider, billing_period`, [id])
  const promos = await queryAll(c.env.DB, `SELECT * FROM promotions WHERE plan=? OR plan IS NULL ORDER BY created_at DESC LIMIT 10`, [id])
  return c.json({ success: true, data: { id, limits: { children: limits.children, devices: limits.devices, concurrent_streams: limits.concurrentStreams, download_devices: limits.downloadDevices }, subscribers: Number(subs?.cnt ?? 0), pricing, products, promotions: promos } })
})

route.get('/pricing/matrix', async (c) => {
  const plan = c.req.query('plan')
  const country = c.req.query('country')?.toUpperCase()
  const status = c.req.query('status')
  const provider = c.req.query('provider')
  const clauses: string[] = []
  const params: unknown[] = []
  if (plan) { clauses.push('pp.plan = ?'); params.push(plan) }
  if (country) { clauses.push('pp.country = ?'); params.push(country) }
  if (status) { clauses.push('pp.status = ?'); params.push(status) }
  if (provider) { clauses.push('sp.provider = ?'); params.push(provider) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await queryAll(c.env.DB, `
    SELECT pp.*, sp.store_product_id, sp.provider, sp.billing_period, sp.status as product_status
    FROM plan_pricing pp JOIN store_products sp ON sp.id=pp.store_product_id
    ${where}
    ORDER BY pp.plan, pp.country, sp.provider, datetime(pp.effective_from) DESC
  `, params)
  return c.json({ success: true, data: rows })
})

route.get('/store-products', async (c) => {
  const provider = c.req.query('provider')
  const plan = c.req.query('plan')
  const status = c.req.query('status')
  const clauses: string[] = []
  const params: unknown[] = []
  if (provider) { clauses.push('provider=?'); params.push(provider) }
  if (plan) { clauses.push('plan=?'); params.push(plan) }
  if (status) { clauses.push('status=?'); params.push(status) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await queryAll(c.env.DB, `SELECT * FROM store_products ${where} ORDER BY provider, plan, billing_period, store_product_id`, params)
  return c.json({ success: true, data: rows })
})

// Google Play remains the source of truth for live prices. D1 stores only
// reviewable draft intentions and publication receipts.
// Return 200 with empty list when not configured — dashboard should stay usable
// without Google Play, not show a 503 banner and console error.
route.get('/google-play/products', async (c) => {
  const products = parseGooglePlayProducts(c.env.GOOGLE_PLAY_PRODUCTS)
  if (!products) return c.json({ success: true, data: [] })
  return c.json({
    success: true,
    data: Object.entries(products).map(([product_id, plan]) => ({ product_id, plan })),
  })
})

route.get('/google-play/prices', async (c) => {
  const productId = c.req.query('product_id')?.trim() ?? ''
  const products = parseGooglePlayProducts(c.env.GOOGLE_PLAY_PRODUCTS)
  if (!products?.[productId]) return c.json({ success: false, error: 'Unknown Google Play subscription product' }, 404)
  try {
    const subscription = await getGooglePlaySubscription(c.env, productId)
    return c.json({
      success: true,
      data: {
        product_id: subscription.productId,
        plan: products[productId],
        regions_version: subscription.regionsVersion,
        base_plans: subscription.basePlans.map((basePlan) => ({
          base_plan_id: basePlan.basePlanId,
          regional_configs: basePlan.regionalConfigs.map((config) => ({
            region_code: config.regionCode,
            new_subscriber_availability: config.newSubscriberAvailability,
            price: config.price,
          })),
        })),
      },
    })
  } catch (error) {
    return c.json({ success: false, error: googlePlayAdminError(error) }, 503)
  }
})

route.get('/google-play/price-drafts', async (c) => {
  const productId = c.req.query('product_id')?.trim()
  const rows = await queryAll<PriceDraft>(
    c.env.DB,
    `SELECT * FROM google_play_price_drafts ${productId ? 'WHERE product_id=?' : ''} ORDER BY created_at DESC LIMIT 100`,
    productId ? [productId] : [],
  )
  return c.json({ success: true, data: rows.map(priceDraftResponse) })
})

route.post('/google-play/price-drafts', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const input = body ? validPriceInput(body) : null
  if (!input) return c.json({ success: false, error: 'product_id, base_plan_id, region_code, currency_code, units, and nanos are required' }, 400)
  const products = parseGooglePlayProducts(c.env.GOOGLE_PLAY_PRODUCTS)
  if (!products?.[input.productId]) return c.json({ success: false, error: 'Unknown Google Play subscription product' }, 404)

  try {
    const subscription = await getGooglePlaySubscription(c.env, input.productId)
    const basePlan = subscription.basePlans.find((item) => item.basePlanId === input.basePlanId)
    const current = basePlan?.regionalConfigs.find((item) => item.regionCode === input.regionCode)
    if (!basePlan) {
      return c.json({ success: false, error: 'Google Play base plan not found for this subscription product' }, 400)
    }
    if (current?.price && current.price.currencyCode !== input.currencyCode) {
      return c.json({ success: false, error: 'Currency must match the Google Play currency for this existing region' }, 400)
    }
    const id = crypto.randomUUID()
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO google_play_price_drafts (
          id, product_id, base_plan_id, region_code, currency_code, units, nanos,
          observed_price_json, observed_regions_version, created_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
      `).bind(
        id, input.productId, input.basePlanId, input.regionCode, input.currencyCode,
        input.units, input.nanos, JSON.stringify(current?.price ?? null), subscription.regionsVersion, actorId(c),
      ),
      auditStatement(c.env.DB, actorId(c), 'create_price_draft', 'google_play_subscription', id, {
        product_id: input.productId,
        base_plan_id: input.basePlanId,
        region_code: input.regionCode,
        current_price: current?.price ?? null,
        proposed_price: { currencyCode: input.currencyCode, units: input.units, nanos: input.nanos },
        regions_version: subscription.regionsVersion,
      }),
    ])
    return c.json({ success: true, data: { id, status: 'draft' } }, 201)
  } catch (error) {
    return c.json({ success: false, error: googlePlayAdminError(error) }, 503)
  }
})

route.post('/google-play/price-drafts/:id/publish', requirePermission('publish'), async (c) => {
  const id = pathParam(c, 'id')
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (body?.confirmation !== id) {
    return c.json({ success: false, error: 'Type the draft ID to confirm this Google Play price change' }, 400)
  }
  const draft = await queryFirst<PriceDraft>(c.env.DB, `SELECT * FROM google_play_price_drafts WHERE id=?`, [id])
  if (!draft) return c.json({ success: false, error: 'Price draft not found' }, 404)
  if (draft.status !== 'draft') return c.json({ success: false, error: 'Only an unmodified draft can be published' }, 409)

  const proposedPrice = { currencyCode: draft.currency_code, units: draft.units, nanos: draft.nanos }
  let observedPrice: unknown = null
  try { observedPrice = draft.observed_price_json ? JSON.parse(draft.observed_price_json) : null } catch { /* stale draft is rejected below */ }
  try {
    const current = await getGooglePlaySubscription(c.env, draft.product_id)
    const basePlan = current.basePlans.find((item) => item.basePlanId === draft.base_plan_id)
    const currentConfig = basePlan?.regionalConfigs.find((item) => item.regionCode === draft.region_code)

    // A previous attempt may have reached Google but lost its response or D1
    // receipt. Read-before-write makes a retry idempotent and reconciles it.
    if (moneyEquals(currentConfig?.price ?? null, proposedPrice)) {
      await c.env.DB.batch([
        c.env.DB.prepare(`UPDATE google_play_price_drafts SET status='published', failure_code=NULL, published_by=?, published_at=COALESCE(published_at, datetime('now')), updated_at=datetime('now') WHERE id=? AND status='draft'`)
          .bind(actorId(c), id),
        auditStatement(c.env.DB, actorId(c), 'reconcile_price_publish', 'google_play_subscription', id, {
          product_id: draft.product_id, base_plan_id: draft.base_plan_id, region_code: draft.region_code,
          published_price: proposedPrice, regions_version: current.regionsVersion,
        }),
      ])
      return c.json({ success: true, data: { id, status: 'published', regions_version: current.regionsVersion, reconciled: true } })
    }

    if (current.regionsVersion !== draft.observed_regions_version || !moneyEquals(currentConfig?.price ?? null, observedPrice)) {
      await c.env.DB.batch([
        c.env.DB.prepare(`UPDATE google_play_price_drafts SET status='superseded', failure_code='provider_changed', updated_at=datetime('now') WHERE id=? AND status='draft'`).bind(id),
        auditStatement(c.env.DB, actorId(c), 'supersede_price_draft', 'google_play_subscription', id, {
          product_id: draft.product_id, base_plan_id: draft.base_plan_id, region_code: draft.region_code,
          observed_price: observedPrice, current_price: currentConfig?.price ?? null,
          observed_regions_version: draft.observed_regions_version, current_regions_version: current.regionsVersion,
        }),
      ])
      return c.json({ success: false, error: 'Google Play price changed after this draft was created. Refresh and create a new draft.' }, 409)
    }

    const result = await updateGooglePlayRegionalBasePlanPrice(c.env, current, {
      basePlanId: draft.base_plan_id,
      regionCode: draft.region_code,
      price: proposedPrice,
    })
    await c.env.DB.batch([
      c.env.DB.prepare(`
        UPDATE google_play_price_drafts
        SET status='published', failure_code=NULL, published_by=?, published_at=datetime('now'), updated_at=datetime('now')
        WHERE id=? AND status='draft'
      `).bind(actorId(c), id),
      auditStatement(c.env.DB, actorId(c), 'publish_price', 'google_play_subscription', id, {
        product_id: draft.product_id,
        base_plan_id: draft.base_plan_id,
        region_code: draft.region_code,
        previous_price: observedPrice,
        published_price: proposedPrice,
        regions_version: result.regionsVersion,
      }),
    ])
    return c.json({ success: true, data: { id, status: 'published', regions_version: result.regionsVersion } })
  } catch (error) {
    // The provider may have applied the update before a timeout. Re-read before
    // classifying the outcome; never claim a definitive failure blindly.
    try {
      const current = await getGooglePlaySubscription(c.env, draft.product_id)
      const basePlan = current.basePlans.find((item) => item.basePlanId === draft.base_plan_id)
      const currentConfig = basePlan?.regionalConfigs.find((item) => item.regionCode === draft.region_code)
      if (moneyEquals(currentConfig?.price ?? null, proposedPrice)) {
        await c.env.DB.batch([
          c.env.DB.prepare(`UPDATE google_play_price_drafts SET status='published', failure_code=NULL, published_by=?, published_at=COALESCE(published_at, datetime('now')), updated_at=datetime('now') WHERE id=? AND status='draft'`)
            .bind(actorId(c), id),
          auditStatement(c.env.DB, actorId(c), 'reconcile_price_publish', 'google_play_subscription', id, {
            product_id: draft.product_id, base_plan_id: draft.base_plan_id, region_code: draft.region_code,
            published_price: proposedPrice, regions_version: current.regionsVersion,
          }),
        ])
        return c.json({ success: true, data: { id, status: 'published', regions_version: current.regionsVersion, reconciled: true } })
      }
    } catch { /* provider outcome remains unknown */ }

    try {
      await c.env.DB.batch([
        c.env.DB.prepare(`UPDATE google_play_price_drafts SET failure_code='publish_unknown', updated_at=datetime('now') WHERE id=? AND status='draft'`).bind(id),
        auditStatement(c.env.DB, actorId(c), 'publish_price_unknown', 'google_play_subscription', id, {
          product_id: draft.product_id, base_plan_id: draft.base_plan_id, region_code: draft.region_code,
          proposed_price: proposedPrice,
        }),
      ])
    } catch { /* preserve the original provider error if D1 is also unavailable */ }
    return c.json({ success: false, error: `${googlePlayAdminError(error)}; outcome is unknown, retry to reconcile before creating another draft` }, 503)
  }
})

route.post('/store-products', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const provider = text(body.provider) as StoreProvider
  const storeProductId = text(body.store_product_id)
  const plan = text(body.plan) as CommercePlan
  const billingPeriod = text(body.billing_period) || 'monthly'
  const baseCountry = countryCode(body.base_country, true)
  const currency = currencyCode(body.currency, true)
  const basePriceMinor = body.base_price_minor === null || body.base_price_minor === undefined || body.base_price_minor === ''
    ? null : integer(body.base_price_minor, 0, Number.MAX_SAFE_INTEGER)
  const trialDays = body.trial_days === null || body.trial_days === undefined || body.trial_days === ''
    ? null : integer(body.trial_days, 0, 365)
  if (!storeProviders.has(provider)
    || !commercePlans.has(plan)
    || !/^[A-Za-z0-9._-]{1,200}$/.test(storeProductId)
    || !billingPeriods.has(billingPeriod)
    || baseCountry === undefined
    || currency === undefined
    || basePriceMinor === null && body.base_price_minor !== null && body.base_price_minor !== undefined && body.base_price_minor !== ''
    || trialDays === null && body.trial_days !== null && body.trial_days !== undefined && body.trial_days !== '') {
    return c.json({ success: false, error: 'Invalid store product fields' }, 400)
  }
  const id = crypto.randomUUID()
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO store_products (
          id, provider, store_product_id, plan, billing_period, base_country,
          currency, base_price_minor, trial_days, status
        ) VALUES (?,?,?,?,?,?,?,?,?,'inactive')
      `).bind(id, provider, storeProductId, plan, billingPeriod, baseCountry, currency, basePriceMinor, trialDays),
      auditStatement(c.env.DB, actorId(c), 'create', 'store_product', id, {
        provider, store_product_id: storeProductId, plan, billing_period: billingPeriod,
        base_country: baseCountry, currency, base_price_minor: basePriceMinor, trial_days: trialDays,
      }),
    ])
    return c.json({ success: true, data: { id, status: 'inactive' } }, 201)
  } catch (error) {
    return duplicateResponse(c, error, 'This provider product already exists')
  }
})

route.patch('/store-products/:id', requirePermission('edit_metadata'), async (c) => {
  const id = pathParam(c, 'id')
  const existing = await queryFirst<any>(c.env.DB, `SELECT * FROM store_products WHERE id=?`, [id])
  if (!existing) return c.json({ success: false, error: 'Store product not found' }, 404)
  if (existing.status === 'deprecated') return c.json({ success: false, error: 'Deprecated products are immutable' }, 409)
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const billingPeriod = body.billing_period === undefined ? existing.billing_period : text(body.billing_period)
  const baseCountry = body.base_country === undefined ? existing.base_country : countryCode(body.base_country, true)
  const currency = body.currency === undefined ? existing.currency : currencyCode(body.currency, true)
  const basePriceMinor = body.base_price_minor === undefined ? existing.base_price_minor
    : body.base_price_minor === null || body.base_price_minor === '' ? null
      : integer(body.base_price_minor, 0, Number.MAX_SAFE_INTEGER)
  const trialDays = body.trial_days === undefined ? existing.trial_days
    : body.trial_days === null || body.trial_days === '' ? null : integer(body.trial_days, 0, 365)
  if (!billingPeriods.has(billingPeriod) || baseCountry === undefined || currency === undefined
    || basePriceMinor === null && body.base_price_minor !== undefined && body.base_price_minor !== null && body.base_price_minor !== ''
    || trialDays === null && body.trial_days !== undefined && body.trial_days !== null && body.trial_days !== '') {
    return c.json({ success: false, error: 'Invalid store product fields' }, 400)
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE store_products SET billing_period=?, base_country=?, currency=?, base_price_minor=?, trial_days=?, updated_at=datetime('now') WHERE id=?`)
      .bind(billingPeriod, baseCountry, currency, basePriceMinor, trialDays, id),
    auditStatement(c.env.DB, actorId(c), 'update', 'store_product', id, { before: existing, after: { billing_period: billingPeriod, base_country: baseCountry, currency, base_price_minor: basePriceMinor, trial_days: trialDays } }),
  ])
  return c.json({ success: true, data: { id, updated: true } })
})

route.post('/store-products/:id/status', requirePermission('publish'), async (c) => {
  const id = pathParam(c, 'id')
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const status = text(body?.status)
  const reason = text(body?.reason, 500)
  if (!reason) return c.json({ success: false, error: 'A status change reason is required' }, 400)
  const existing = await queryFirst<any>(c.env.DB, `SELECT * FROM store_products WHERE id=?`, [id])
  if (!existing) return c.json({ success: false, error: 'Store product not found' }, 404)
  if (!transitionAllowed(productTransitions, existing.status, status)) {
    return c.json({ success: false, error: `Store product cannot transition from ${existing.status} to ${status}` }, 409)
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE store_products SET status=?, updated_at=datetime('now') WHERE id=?`).bind(status, id),
    auditStatement(c.env.DB, actorId(c), 'change_status', 'store_product', id, { from: existing.status, to: status, reason }),
  ])
  return c.json({ success: true, data: { id, status } })
})

route.post('/pricing', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const storeProductId = text(body.store_product_id)
  const country = countryCode(body.country)
  const currency = currencyCode(body.currency)
  const price = integer(body.price_minor, 0, Number.MAX_SAFE_INTEGER)
  const currencyExponent = typeof currency === 'string' ? currencyExponentFor(currency) : undefined
  const effectiveUntil = isoDate(body.effective_until, true)
  const createdAt = new Date().toISOString()
  if (!storeProductId || country === undefined || currency === undefined || currencyExponent === undefined
    || price === null || effectiveUntil === undefined
    || effectiveUntil !== null && Date.parse(effectiveUntil) <= Date.parse(createdAt)) {
    return c.json({ success: false, error: 'Invalid regional price fields or unsupported currency' }, 400)
  }
  const product = await queryFirst<{ id: string; plan: CommercePlan }>(c.env.DB, `SELECT id, plan FROM store_products WHERE id=?`, [storeProductId])
  if (!product) return c.json({ success: false, error: 'Store product not found' }, 404)
  const id = crypto.randomUUID()
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO plan_pricing (
          id, plan, store_product_id, country, currency, currency_exponent,
          price_minor, effective_from, effective_until, status
        ) VALUES (?,?,?,?,?,?,?,?,?,'draft')
      `).bind(id, product.plan, storeProductId, country, currency, currencyExponent, price, createdAt, effectiveUntil),
      auditStatement(c.env.DB, actorId(c), 'create', 'plan_pricing', id, {
        plan: product.plan, store_product_id: storeProductId, country, currency,
        currency_exponent: currencyExponent, price_minor: price,
        effective_from: createdAt, effective_until: effectiveUntil, status: 'draft',
      }),
    ])
    return c.json({ success: true, data: { id, status: 'draft' } }, 201)
  } catch (error) {
    return duplicateResponse(c, error, 'A price revision already exists for this effective time')
  }
})

route.patch('/pricing/:id', requirePermission('edit_metadata'), async (c) => {
  const id = pathParam(c, 'id')
  const existing = await queryFirst<any>(c.env.DB, `SELECT * FROM plan_pricing WHERE id=?`, [id])
  if (!existing) return c.json({ success: false, error: 'Regional price not found' }, 404)
  if (existing.status !== 'draft') return c.json({ success: false, error: 'Only draft prices can be edited; create a new revision' }, 409)
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const country = body.country === undefined ? existing.country : countryCode(body.country)
  const currency = body.currency === undefined ? existing.currency : currencyCode(body.currency)
  const price = body.price_minor === undefined ? existing.price_minor : integer(body.price_minor, 0, Number.MAX_SAFE_INTEGER)
  const exponent = typeof currency === 'string' ? currencyExponentFor(currency) : undefined
  const effectiveUntil = body.effective_until === undefined ? existing.effective_until : isoDate(body.effective_until, true)
  if (country === undefined || currency === undefined || exponent === undefined || price === null || effectiveUntil === undefined
    || effectiveUntil !== null && Date.parse(effectiveUntil) <= Date.now()) {
    return c.json({ success: false, error: 'Invalid regional price fields or unsupported currency' }, 400)
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE plan_pricing SET country=?, currency=?, currency_exponent=?, price_minor=?, effective_until=?, updated_at=datetime('now') WHERE id=? AND status='draft'`)
      .bind(country, currency, exponent, price, effectiveUntil, id),
    auditStatement(c.env.DB, actorId(c), 'update', 'plan_pricing', id, { before: existing, after: { country, currency, currency_exponent: exponent, price_minor: price, effective_until: effectiveUntil, status: 'draft' } }),
  ])
  return c.json({ success: true, data: { id, updated: true } })
})

route.post('/pricing/:id/status', requirePermission('publish'), async (c) => {
  const id = pathParam(c, 'id')
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const status = text(body?.status)
  const reason = text(body?.reason, 500)
  if (!reason) return c.json({ success: false, error: 'A status change reason is required' }, 400)
  const existing = await queryFirst<any>(c.env.DB, `SELECT pp.*, sp.status as product_status FROM plan_pricing pp JOIN store_products sp ON sp.id=pp.store_product_id WHERE pp.id=?`, [id])
  if (!existing) return c.json({ success: false, error: 'Regional price not found' }, 404)
  if (!transitionAllowed(pricingTransitions, existing.status, status)) {
    return c.json({ success: false, error: `Regional price cannot transition from ${existing.status} to ${status}` }, 409)
  }
  if (status === 'active' && existing.product_status !== 'active') return c.json({ success: false, error: 'Activate the store product before its price' }, 409)

  const transitionAt = new Date().toISOString()
  if (status === 'active' && existing.effective_until !== null && Date.parse(existing.effective_until) <= Date.parse(transitionAt)) {
    return c.json({ success: false, error: 'The price end time must be after activation' }, 409)
  }
  const superseded = status === 'active' ? await queryAll<any>(c.env.DB, `
    SELECT * FROM plan_pricing
    WHERE store_product_id=? AND country=? AND status='active' AND id<>?
  `, [existing.store_product_id, existing.country, id]) : []
  const statements = []
  if (status === 'active') {
    for (const previous of superseded) {
      statements.push(
        c.env.DB.prepare(`UPDATE plan_pricing SET status='expired', effective_until=?, updated_at=? WHERE id=? AND status='active'`)
          .bind(transitionAt, transitionAt, previous.id),
        auditStatement(c.env.DB, actorId(c), 'supersede', 'plan_pricing', previous.id, {
          from: 'active', to: 'expired', reason, superseded_by: id, effective_until: transitionAt,
        }),
      )
    }
    statements.push(c.env.DB.prepare(`UPDATE plan_pricing SET status='active', effective_from=?, updated_at=? WHERE id=? AND status='draft'`)
      .bind(transitionAt, transitionAt, id))
  } else {
    statements.push(c.env.DB.prepare(`UPDATE plan_pricing SET status='expired', effective_until=?, updated_at=? WHERE id=? AND status='active'`)
      .bind(transitionAt, transitionAt, id))
  }
  statements.push(auditStatement(c.env.DB, actorId(c), 'change_status', 'plan_pricing', id, {
    from: existing.status, to: status, reason, transition_at: transitionAt,
  }))
  await c.env.DB.batch(statements)
  return c.json({ success: true, data: { id, status } })
})

route.get('/payment-methods', async (c) => {
  const rows = await queryAll<any>(c.env.DB, `SELECT * FROM billing_payment_methods ORDER BY platform, country, sort_order, name_ar`)
  return c.json({ success: true, data: rows.map((row) => ({
    ...row,
    runtime_ready: paymentAdapterReady(c.env, row.provider, row.platform, row.checkout_mode),
  })) })
})

route.post('/payment-methods', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const provider = text(body.provider) as PaymentProvider
  const methodCode = text(body.method_code, 80)
  const nameAr = text(body.name_ar, 120)
  const nameEn = text(body.name_en, 120)
  const country = countryCode(body.country)
  const platform = text(body.platform)
  const checkoutMode = text(body.checkout_mode)
  const sortOrder = body.sort_order === undefined ? 0 : integer(body.sort_order, -10000, 10000)
  if (!paymentProviders.has(provider) || !/^[A-Za-z0-9._-]{1,80}$/.test(methodCode)
    || !nameAr || !nameEn || country === undefined || !paymentPlatforms.has(platform)
    || !checkoutModes.has(checkoutMode) || sortOrder === null) {
    return c.json({ success: false, error: 'Invalid payment method fields' }, 400)
  }
  const id = crypto.randomUUID()
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO billing_payment_methods (id, provider, method_code, name_ar, name_en, country, platform, checkout_mode, status, sort_order) VALUES (?,?,?,?,?,?,?,?,'draft',?)`)
        .bind(id, provider, methodCode, nameAr, nameEn, country, platform, checkoutMode, sortOrder),
      auditStatement(c.env.DB, actorId(c), 'create', 'billing_payment_method', id, { provider, method_code: methodCode, name_ar: nameAr, name_en: nameEn, country, platform, checkout_mode: checkoutMode, sort_order: sortOrder }),
    ])
    return c.json({ success: true, data: { id, status: 'draft', runtime_ready: false } }, 201)
  } catch (error) {
    return duplicateResponse(c, error, 'This payment method already exists for the country and platform')
  }
})

route.patch('/payment-methods/:id', requirePermission('edit_metadata'), async (c) => {
  const id = pathParam(c, 'id')
  const existing = await queryFirst<any>(c.env.DB, `SELECT * FROM billing_payment_methods WHERE id=?`, [id])
  if (!existing) return c.json({ success: false, error: 'Payment method not found' }, 404)
  if (existing.status === 'active') return c.json({ success: false, error: 'Disable the payment method before editing it' }, 409)
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const nameAr = body.name_ar === undefined ? existing.name_ar : text(body.name_ar, 120)
  const nameEn = body.name_en === undefined ? existing.name_en : text(body.name_en, 120)
  const country = body.country === undefined ? existing.country : countryCode(body.country)
  const platform = body.platform === undefined ? existing.platform : text(body.platform)
  const checkoutMode = body.checkout_mode === undefined ? existing.checkout_mode : text(body.checkout_mode)
  const sortOrder = body.sort_order === undefined ? existing.sort_order : integer(body.sort_order, -10000, 10000)
  if (!nameAr || !nameEn || country === undefined || !paymentPlatforms.has(platform) || !checkoutModes.has(checkoutMode) || sortOrder === null) {
    return c.json({ success: false, error: 'Invalid payment method fields' }, 400)
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE billing_payment_methods SET name_ar=?, name_en=?, country=?, platform=?, checkout_mode=?, sort_order=?, updated_at=datetime('now') WHERE id=?`)
      .bind(nameAr, nameEn, country, platform, checkoutMode, sortOrder, id),
    auditStatement(c.env.DB, actorId(c), 'update', 'billing_payment_method', id, { before: existing, after: { name_ar: nameAr, name_en: nameEn, country, platform, checkout_mode: checkoutMode, sort_order: sortOrder } }),
  ])
  return c.json({ success: true, data: { id, updated: true } })
})

route.post('/payment-methods/:id/status', requirePermission('publish'), async (c) => {
  const id = pathParam(c, 'id')
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const status = text(body?.status)
  const reason = text(body?.reason, 500)
  if (!reason) return c.json({ success: false, error: 'A status change reason is required' }, 400)
  const existing = await queryFirst<any>(c.env.DB, `SELECT * FROM billing_payment_methods WHERE id=?`, [id])
  if (!existing) return c.json({ success: false, error: 'Payment method not found' }, 404)
  if (!transitionAllowed(paymentTransitions, existing.status, status)) {
    return c.json({ success: false, error: `Payment method cannot transition from ${existing.status} to ${status}` }, 409)
  }
  const ready = paymentAdapterReady(c.env, existing.provider, existing.platform, existing.checkout_mode)
  if (status === 'active' && !ready) {
    return c.json({ success: false, error: 'The server adapter, credentials, signed callback, and verification are not ready for this method' }, 409)
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE billing_payment_methods SET status=?, updated_at=datetime('now') WHERE id=?`).bind(status, id),
    auditStatement(c.env.DB, actorId(c), 'change_status', 'billing_payment_method', id, { from: existing.status, to: status, reason, runtime_ready: ready }),
  ])
  return c.json({ success: true, data: { id, status, runtime_ready: ready } })
})

route.get('/promotions', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT * FROM promotions ORDER BY created_at DESC`)
  return c.json({ success: true, data: rows })
})

// ---- Revenue analytics (verified transactions only) ----
route.get('/revenue/overview', async (c) => {
  const range = c.req.query('range') || '30d' // today, 7d, 30d, quarter, year
  const sinceMap: Record<string,string> = {
    today: "datetime('now','start of day')",
    '7d': "datetime('now','-7 days')",
    '30d': "datetime('now','-30 days')",
    quarter: "datetime('now','-90 days')",
    year: "datetime('now','-365 days')",
  }
  const sinceExpr = sinceMap[range] || sinceMap['30d']
  // Gross revenue: count and sum? billing_audit has no amount – honest: we lack gross amount
  // We treat each verified purchase as 1 unit; gross/net unavailable without price model.
  // Provide honest metrics: active paid subs, new subs, renewals, refunds (revoked), trial conversion (if promotions), churn proxy.
  const activePaid = await queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM family_projection WHERE plan != 'free' AND status='active'`)
  const newPaid = await queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM billing_audit WHERE entitlement_status='active' AND datetime(created_at) >= ${sinceExpr}`)
  const renewals = await queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM billing_audit WHERE entitlement_status='active' AND verified_at_ms >= (strftime('%s','now','-30 days')*1000) AND id IN (SELECT id FROM billing_audit GROUP BY parent_id HAVING COUNT(*) > 1)`)
  const refunds = await queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM billing_audit WHERE entitlement_status='revoked' AND datetime(created_at) >= ${sinceExpr}`)
  const trials = await queryAll(c.env.DB, `SELECT plan, COUNT(*) as cnt FROM billing_audit WHERE provider_state='trial' GROUP BY plan`)
  // By plan
  const byPlan = await queryAll(c.env.DB, `SELECT plan, COUNT(*) as cnt FROM billing_audit WHERE datetime(created_at) >= ${sinceExpr} GROUP BY plan`)
  // By provider
  const byProvider = await queryAll(c.env.DB, `SELECT provider, COUNT(*) as cnt FROM billing_audit WHERE datetime(created_at) >= ${sinceExpr} GROUP BY provider`)
  // By country? billing_audit has no country – report as unavailable
  // Gross/net honest handling
  const hasPricing = await queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM plan_pricing WHERE status='active' AND price_minor IS NOT NULL`)
  const dataQuality = await queryAll(c.env.DB, `
    SELECT 'missing_price' as issue, COUNT(*) as cnt FROM billing_audit b LEFT JOIN store_products sp ON sp.store_product_id=b.product_id WHERE sp.id IS NULL
    UNION ALL SELECT 'unknown_currency' as issue, 0
    UNION ALL SELECT 'unverified' as issue, COUNT(*) FROM billing_audit WHERE provider_state NOT IN ('active','expired','revoked','grace')
    UNION ALL SELECT 'duplicate' as issue, (SELECT COUNT(*) FROM (SELECT purchase_token_hash, COUNT(*) as c FROM billing_audit GROUP BY purchase_token_hash HAVING c>1))
  `)
  return c.json({ success: true, data: {
    range,
    metrics: {
      gross_revenue: { value: null, unavailable: 'Price model incomplete — gross amount not stored in billing_audit; needs store product price × quantity' },
      net_revenue: { value: null, unavailable: 'Store fees require versioned commercial terms; not configured' },
      mrr: { value: null, unavailable: 'Requires recurring billing period × price; current audit lacks billing period for MRR normalization' },
      arr: { value: null, unavailable: 'Derived from MRR' },
      active_paid_subscribers: Number(activePaid?.cnt ?? 0),
      new_paid_subscribers: Number(newPaid?.cnt ?? 0),
      renewals: Number(renewals?.cnt ?? 0),
      refunds: Number(refunds?.cnt ?? 0),
      trial_starts: trials,
      churn_proxy: null,
    },
    breakdowns: { by_plan: byPlan, by_provider: byProvider, by_currency: [], by_country: [] },
    data_quality: dataQuality,
    has_pricing: Number(hasPricing?.cnt ?? 0) > 0,
  }})
})

route.get('/revenue/drilldown', async (c) => {
  const dimension = c.req.query('dimension') || 'plan' // plan, provider, status
  const value = c.req.query('value')
  if (!value) return c.json({ success: false, error: 'value required' }, 400)
  const map: Record<string,string> = { plan: 'plan', provider: 'provider', status: 'entitlement_status' }
  const col = map[dimension]
  if (!col) return c.json({ success: false, error: 'Invalid dimension' }, 400)
  const rows = await queryAll(c.env.DB, `SELECT * FROM billing_audit WHERE ${col}=? ORDER BY verified_at_ms DESC LIMIT 50`, [value])
  return c.json({ success: true, data: rows })
})

// ---- Content costs ----
route.get('/content-costs', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const entity = c.req.query('entity_type')
  const category = c.req.query('category')
  const currency = c.req.query('currency')
  const clauses: string[] = []
  const params: unknown[] = []
  if (entity) { clauses.push('entity_type = ?'); params.push(entity) }
  if (category) { clauses.push('category = ?'); params.push(category) }
  if (currency) { clauses.push('currency = ?'); params.push(currency) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = await queryFirst<{ total:number }>(c.env.DB, `SELECT COUNT(*) as total FROM content_costs ${where}`, params)
  const rows = await queryAll(c.env.DB, `SELECT cc.*, s.title_ar as series_title FROM content_costs cc LEFT JOIN series s ON s.id=cc.entity_id ${where} ORDER BY cc.incurred_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
  // Aggregates by currency (honest: don't sum across currencies)
  const byCurrency = await queryAll(c.env.DB, `SELECT currency, SUM(amount_minor) as total FROM content_costs GROUP BY currency`)
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset, by_currency: byCurrency } })
})

route.get('/content-costs/:entityType/:entityId', async (c) => {
  const entityType = pathParam(c, 'entityType')
  const entityId = pathParam(c, 'entityId')
  const rows = await queryAll(c.env.DB, `SELECT * FROM content_costs WHERE entity_type=? AND entity_id=? ORDER BY incurred_at DESC`, [entityType, entityId])
  const byCat = await queryAll(c.env.DB, `SELECT category, SUM(amount_minor) as total, currency FROM content_costs WHERE entity_type=? AND entity_id=? GROUP BY category, currency`, [entityType, entityId])
  return c.json({ success: true, data: { costs: rows, by_category: byCat } })
})

route.post('/content-costs', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const entityType = typeof body.entity_type === 'string' ? body.entity_type : ''
  const entityId = typeof body.entity_id === 'string' ? body.entity_id : ''
  const category = typeof body.category === 'string' ? body.category : ''
  const amount = typeof body.amount_minor === 'number' ? body.amount_minor : Number(body.amount_minor)
  const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : 'EGP'
  if (!entityType || !entityId || !category || !Number.isInteger(amount) || amount < 0) return c.json({ success: false, error: 'entity_type, entity_id, category, amount_minor required' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO content_costs (id, entity_type, entity_id, category, amount_minor, currency, vendor, incurred_at, allocation_basis, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, entityType, entityId, category, amount, currency, (body.vendor as string) || null, (body.incurred_at as string) || new Date().toISOString(), (body.allocation_basis as string) || null, (body.notes as string) || null, actorId(c)),
    auditStatement(c.env.DB, actorId(c), 'create', 'content_cost', id, body)
  ])
  return c.json({ success: true, data: { id } }, 201)
})

// Rights workspace detail
route.get('/rights/:id', async (c) => {
  const id = pathParam(c, 'id')
  const row = await queryFirst(c.env.DB, `SELECT r.*, s.title_ar as series_title, s.status as series_status FROM rights_licenses r LEFT JOIN series s ON s.id=r.content_id WHERE r.id=?`, [id])
  if (!row) return c.json({ success: false, error: 'Right not found' }, 404)
  // Affected content: all series/episodes/stories linked? For now series
  const content = await queryAll(c.env.DB, `SELECT id, title_ar, status FROM series WHERE id=?`, [(row as any).content_id])
  // Availability check: query content_availability
  const availability = await queryFirst(c.env.DB, `SELECT * FROM content_availability WHERE entity_type='series' AND entity_id=? ORDER BY updated_at DESC LIMIT 1`, [(row as any).content_id])
  // Rights history via audit_logs
  const history = await queryAll(c.env.DB, `SELECT * FROM audit_logs WHERE entity_type='rights_license' AND entity_id=? ORDER BY created_at DESC LIMIT 20`, [id])
  return c.json({ success: true, data: { ...row, affected_content: content, availability, history } })
})

// Data integrity checks
route.get('/commerce/integrity', async (c) => {
  const checks = await Promise.all([
    queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM billing_audit WHERE plan NOT IN ('family','family_plus')`).then(r=> ({ check: 'subscription unknown plan', count: Number(r?.cnt ?? 0), severity: 'error' })),
    queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM billing_audit b LEFT JOIN store_products sp ON sp.store_product_id=b.product_id WHERE sp.id IS NULL`).then(r=> ({ check: 'provider product not mapped', count: Number(r?.cnt ?? 0), severity: 'warn' })),
    queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM billing_audit WHERE provider_state != entitlement_status`).then(r=> ({ check: 'entitlement mismatch', count: Number(r?.cnt ?? 0), severity: 'warn' })),
    queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM (SELECT purchase_token_hash, COUNT(*) as c FROM billing_audit GROUP BY purchase_token_hash HAVING c>1)`).then(r=> ({ check: 'duplicate purchase', count: Number(r?.cnt ?? 0), severity: 'error' })),
    queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM rights_licenses WHERE expiry_date IS NOT NULL AND SUBSTR(expiry_date,1,10) < date('now')`).then(r=> ({ check: 'expired rights counted as active (highlight)', count: Number(r?.cnt ?? 0), severity: 'info' })),
    queryFirst<{ cnt:number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM content_costs WHERE entity_id NOT IN (SELECT id FROM series UNION SELECT id FROM episodes UNION SELECT id FROM stories UNION SELECT id FROM games)`).then(r=> ({ check: 'cost references missing entity', count: Number(r?.cnt ?? 0), severity: 'warn' })),
  ])
  return c.json({ success: true, data: checks })
})

export default route
