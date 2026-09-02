import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin, requirePermission, type AdminVariables } from '../lib/adminAuth.ts'
import { actorId, auditStatement, claimedActor } from '../lib/auditLog.ts'
import { parsePagination } from '../lib/catalogueValidation.ts'
import { callDurable, familyStub } from '../lib/doClient.ts'
import { isPlan } from '../lib/familyPolicy.ts'

type AppEnv = { Bindings: Env; Variables: AdminVariables }
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

// ── Refunds ──
route.get('/billing/refunds', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit') || 25), 1), 100)
  const offset = Math.max(Number(c.req.query('offset') || 0), 0)
  const status = c.req.query('status')?.trim()
  const parentId = c.req.query('parent_id')?.trim()
  const clauses: string[] = []
  const params: any[] = []
  if (status) { clauses.push('status = ?'); params.push(status) }
  if (parentId) { clauses.push('parent_id = ?'); params.push(parentId) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) as total FROM refunds ${where}`, params).catch(()=> ({ total: 0 } as any))
  const rows = await queryAll(c.env.DB, `SELECT * FROM refunds ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]).catch(()=> [])
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset } })
})

/// `POST /admin/billing/refunds`
///
/// ## ما كان مفقودًا
///
/// `requireAdmin` وحده. أي حساب لوحة مُصادَق — بأي دور — كان ينشئ صف استرداد،
/// و`created_by` كان يُقرأ من ترويسة `X-Admin-Actor` التي يكتبها المتصل بنفسه،
/// فسجل «من طلب هذا الاسترداد؟» كان بلا قيمة. الترويسة المُدَّعاة تُسجَّل الآن
/// داخل تفاصيل التدقيق للمراجعة، ولا تُستخدم كهوية.
route.post('/billing/refunds', requirePermission('manage_billing'), async (c) => {
  const body = await c.req.json().catch(()=> null) as any
  if (!body?.parent_id || !body?.amount_minor || !body?.currency || !body?.reason) {
    return c.json({ success: false, error: 'parent_id, amount_minor, currency, reason required' }, 400)
  }
  const id = `refund-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`
  const actor = actorId(c)
  const parentId = String(body.parent_id).trim()
  const amountMinor = Number(body.amount_minor)
  const currency = String(body.currency).trim().toUpperCase()
  try {
    // الكتابة والتدقيق في دفعة واحدة: استرداد بلا صف تدقيق يعيد إنتاج نفس
    // السؤال الذي لا جواب له.
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO refunds (id, parent_id, original_transaction_id, original_purchase_id, amount_minor, currency, reason, reason_details, channel, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).bind(
        id,
        parentId,
        body.original_transaction_id ? String(body.original_transaction_id).trim() : null,
        body.original_purchase_id ? String(body.original_purchase_id).trim() : null,
        amountMinor,
        currency,
        String(body.reason).trim(),
        body.reason_details ? String(body.reason_details).trim() : null,
        body.channel ? String(body.channel).trim() : 'manual',
        actor,
      ),
      auditStatement(c.env.DB, actor, 'billing_refund_created', 'refund', id, {
        parent_id: parentId,
        amount_minor: amountMinor,
        currency,
        channel: body.channel ? String(body.channel).trim() : 'manual',
        claimed_actor: claimedActor(c),
      }),
    ])
    return c.json({ success: true, data: { id } }, 201)
  } catch (e:any) {
    return c.json({ success: false, error: 'Unable to create refund', details: e?.message }, 500)
  }
})

// Demo family grant – for seeding production demo accounts with real data
// POST /api/v1/admin/billing/grant { parent_id, plan: family|family_plus, source?: admin_grant }
//
/// ## ما كان مفقودًا
///
/// هذا المسار يمنح استحقاقًا مدفوعًا مدته 365 يومًا في الـDurable Object
/// الموثوق، وكان بلا أي فحص صلاحية. الوصف «demo/seeding» لا يغيّر أثره: الأثر
/// هو نفس أثر عملية شراء ناجحة. صار خلف `manage_billing`، ويُسجَّل في
/// `audit_logs` لا في `billing_audit` وحده — الأخير سجل مزوّد، والسؤال هنا
/// «أي موظف منح هذه الباقة؟».
route.post('/billing/grant', requirePermission('manage_billing'), async (c) => {
  const body = await c.req.json().catch(()=>null) as Record<string, unknown> | null
  const parentId = typeof body?.parent_id === 'string' ? body.parent_id.trim() : ''
  const plan = typeof body?.plan === 'string' ? body.plan.trim() : 'family'
  const source = typeof body?.source === 'string' ? body.source.trim() : 'admin_grant'
  if (!parentId || !isPlan(plan)) {
    return c.json({ success: false, error: 'parent_id and valid plan (family, family_plus) required' }, 400)
  }
  const now = Date.now()
  const entitlementId = `admin-grant:${parentId}:${plan}:${now}`
  const expiresAt = now + 365*24*60*60*1000

  // Apply to FamilyState DO (authoritative)
  const applied = await callDurable<{ success: boolean; data?: { plan: string } }>(familyStub(c.env, parentId), '/entitlements/apply', {
    body: {
      id: entitlementId,
      source,
      provider_purchase_id: entitlementId,
      plan,
      status: 'active',
      starts_at: now - 1000,
      expires_at: expiresAt,
      observed_at: now,
    },
  })

  if (!applied.ok || !applied.data?.success) {
    return c.json({ success: false, error: 'Failed to apply entitlement to FamilyState', details: applied.data }, 502)
  }

  // Also insert audit for visibility
  try {
    await c.env.DB.prepare(`
      INSERT INTO billing_audit (id, parent_id, provider, product_id, plan, purchase_token_hash, provider_purchase_id, provider_state, entitlement_status, starts_at_ms, expires_at_ms, verified_at_ms)
      VALUES (?, ?, 'admin_grant', ?, ?, ?, ?, 'active', 'active', ?, ?, ?)
      ON CONFLICT(purchase_token_hash) DO UPDATE SET plan=excluded.plan, entitlement_status='active', expires_at_ms=excluded.expires_at_ms, verified_at_ms=excluded.verified_at_ms
    `).bind(
      entitlementId,
      parentId,
      `admin_${plan}`,
      plan,
      `hash_${parentId}`,
      entitlementId,
      now - 1000,
      expiresAt,
      now
    ).run()
  } catch (_) {
    // Audit failure should not block grant
  }

  // سجل التدقيق الإداري: `billing_audit` أعلاه سجل مزوّد يجيب «ما الاستحقاق؟»،
  // وهذا يجيب «من منحه؟». الفشل هنا لا يُبطل منحًا طُبِّق فعلًا في الـDO، لكنه
  // لا يُكتم أيضًا.
  try {
    await auditStatement(c.env.DB, actorId(c), 'billing_grant', 'entitlement', entitlementId, {
      parent_id: parentId,
      plan,
      source,
      expires_at_ms: expiresAt,
      claimed_actor: claimedActor(c),
    }).run()
  } catch (error) {
    console.error('billing_grant_audit_failed', error instanceof Error ? error.message : String(error))
  }

  return c.json({ success: true, data: { parent_id: parentId, plan: applied.data.data?.plan ?? plan, entitlement_id: entitlementId, expires_at: new Date(expiresAt).toISOString() } })
})

export default route
