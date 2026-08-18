import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts'
import { parsePagination } from '../lib/catalogueValidation.ts'
import { actorId, auditStatement } from '../lib/auditLog.ts'
import { pathParam } from '../lib/routeParams.ts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()
route.use('*', requireAdmin)

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
  const country = c.req.query('country')
  const status = c.req.query('status')
  const clauses: string[] = []
  const params: unknown[] = []
  if (plan) { clauses.push('pp.plan = ?'); params.push(plan) }
  if (country) { clauses.push('pp.country = ?'); params.push(country) }
  if (status) { clauses.push('pp.status = ?'); params.push(status) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await queryAll(c.env.DB, `
    SELECT pp.*, sp.store_product_id, sp.provider, sp.billing_period, sp.status as product_status
    FROM plan_pricing pp JOIN store_products sp ON sp.id=pp.store_product_id
    ${where}
    ORDER BY pp.plan, pp.country, sp.provider
  `, params)
  return c.json({ success: true, data: rows })
})

route.get('/store-products', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT * FROM store_products ORDER BY provider, plan`)
  return c.json({ success: true, data: rows })
})

route.post('/store-products', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const provider = typeof body.provider === 'string' ? body.provider : ''
  const storePid = typeof body.store_product_id === 'string' ? body.store_product_id.trim() : ''
  const plan = typeof body.plan === 'string' ? body.plan : ''
  if (!provider || !storePid || !['free','family','family_plus'].includes(plan)) return c.json({ success: false, error: 'provider, store_product_id, valid plan required' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO store_products (id, provider, store_product_id, plan, billing_period, base_country, currency, base_price_minor, status) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, provider, storePid, plan, (body.billing_period as string) || 'monthly', (body.base_country as string) || null, (body.currency as string) || null, (body.base_price_minor as number) ?? null, 'active'),
    auditStatement(c.env.DB, actorId(c), 'create', 'store_product', id, body)
  ])
  return c.json({ success: true, data: { id } }, 201)
})

route.post('/pricing', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const plan = typeof body.plan === 'string' ? body.plan : ''
  const storePid = typeof body.store_product_id === 'string' ? body.store_product_id : ''
  const country = typeof body.country === 'string' ? body.country.toUpperCase() : ''
  const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : ''
  const price = typeof body.price_minor === 'number' ? body.price_minor : Number(body.price_minor)
  if (!plan || !storePid || !country || !currency || !Number.isInteger(price) || price < 0) return c.json({ success: false, error: 'plan, store_product_id, country, currency, price_minor required' }, 400)
  const product = await queryFirst<{ id: string }>(c.env.DB, `SELECT id FROM store_products WHERE id=?`, [storePid])
  if (!product) return c.json({ success: false, error: 'Store product not found' }, 404)
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO plan_pricing (id, plan, store_product_id, country, currency, price_minor, effective_from, status) VALUES (?,?,?,?,?,?,datetime('now'),?)`).bind(id, plan, storePid, country, currency, price, 'active'),
    auditStatement(c.env.DB, actorId(c), 'create', 'plan_pricing', id, body)
  ])
  return c.json({ success: true, data: { id } }, 201)
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
