import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { queryAll, queryFirst } from '../lib/db'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

// إحصائيات الاشتراكات من family_projection + billing_audit
route.get('/billing/stats', async (c) => {
  const byPlan = await queryAll(c.env.DB, `SELECT plan, COUNT(*) as count FROM family_projection WHERE status='active' GROUP BY plan`)
  const recent = await queryAll(c.env.DB, `SELECT parent_id, product_id, status, purchased_at, expires_at, created_at FROM billing_audit ORDER BY created_at DESC LIMIT 20`)
  const rtdn = await queryAll(c.env.DB, `SELECT event_id, event_type, parent_id, created_at FROM processed_family_events WHERE event_type LIKE 'entitlement.%' ORDER BY created_at DESC LIMIT 20`)
  return c.json({ success: true, data: { by_plan: byPlan, recent_purchases: recent, recent_entitlements: rtdn } })
})

route.get('/billing/purchases', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
  const rows = await queryAll(c.env.DB, `SELECT parent_id, product_id, purchase_token_hash, status, purchased_at, expires_at, created_at FROM billing_audit ORDER BY created_at DESC LIMIT ?`, [limit])
  return c.json({ success: true, data: rows })
})

route.get('/billing/entitlements', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT parent_id, plan, status, starts_at, expires_at, updated_at FROM family_projection WHERE plan != 'free' ORDER BY updated_at DESC LIMIT 50`)
  return c.json({ success: true, data: rows })
})

export default route
