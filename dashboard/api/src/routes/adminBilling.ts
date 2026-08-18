import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin } from '../lib/adminAuth.ts'
import { parsePagination } from '../lib/catalogueValidation.ts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

/// حرس صريح لا ضمني.
///
/// هذا الملف كان بلا `use()`، فحمايته تعتمد على اتّساع وسيط adminRoute
/// المركّب على `/api/v1/admin/*` وعلى ترتيب التركيب في index.ts. المسارات هنا
/// تكشف سجل الشراء و parent_id، فالاعتماد الضمني غير مقبول.
route.use('*', requireAdmin)

/// أسماء الأعمدة مطابقة لمهاجرة 0008، لا مخترعة.
///
/// كانت هذه الاستعلامات تسأل عن `status` و`purchased_at` و`starts_at` في
/// billing_audit، وهي أعمدة لا وجود لها: الجدول يحمل `entitlement_status`
/// و`verified_at_ms` و`starts_at_ms`. لم يظهر الخطأ لأن المسارات كانت مركّبة
/// على بادئة مضاعفة فتُعيد 404 قبل أن يُنفَّذ أي استعلام.

// إحصائيات الاشتراكات من family_projection + billing_audit
route.get('/billing/stats', async (c) => {
  // family_projection is asynchronous operational data. Exclude the free plan
  // so this count does not describe active accounts as subscriptions.
  const byPlan = await queryAll(c.env.DB, `SELECT plan, COUNT(*) as count FROM family_projection WHERE status = 'active' AND plan != 'free' GROUP BY plan`)
  const recent = await queryAll(c.env.DB, `SELECT parent_id, product_id, plan, entitlement_status, provider_state, starts_at_ms, expires_at_ms, created_at FROM billing_audit ORDER BY created_at DESC LIMIT 20`)
  // processed_family_events يحمل processed_at لا created_at
  const rtdn = await queryAll(c.env.DB, `SELECT event_id, event_type, parent_id, occurred_at_ms, processed_at FROM processed_family_events WHERE event_type LIKE 'entitlement.%' ORDER BY occurred_at_ms DESC LIMIT 20`)
  return c.json({ success: true, data: { by_plan: byPlan, recent_purchases: recent, recent_entitlements: rtdn } })
})

route.get('/billing/purchases', async (c) => {
  // SQLite treats a negative LIMIT as unbounded. Clamp every request to a
  // finite 1–100 page before binding it, so a malformed query cannot expose
  // the whole correlatable purchase ledger.
  const { limit } = parsePagination(c.req.query('limit'), undefined, { defaultLimit: 20, maxLimit: 100 })
  const rows = await queryAll(c.env.DB, `SELECT parent_id, product_id, plan, purchase_token_hash, entitlement_status, provider_state, starts_at_ms, expires_at_ms, verified_at_ms, created_at FROM billing_audit ORDER BY created_at DESC LIMIT ?`, [limit])
  return c.json({ success: true, data: rows })
})

route.get('/billing/entitlements', async (c) => {
  // family_projection ليس فيه starts_at/expires_at: الاستحقاق الزمني في billing_audit
  const rows = await queryAll(c.env.DB, `SELECT parent_id, plan, status, last_event_at_ms, updated_at FROM family_projection WHERE plan != 'free' ORDER BY updated_at DESC LIMIT 50`)
  return c.json({ success: true, data: rows })
})

export default route
