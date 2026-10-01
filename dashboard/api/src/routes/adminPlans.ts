import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import type { Plan } from '../lib/familyPolicy.ts'
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts'
import { actorId, auditStatement } from '../lib/auditLog.ts'
import type { AdminSessionUser } from '../lib/adminUsers.ts'
import {
  isPolicySection,
  loadPolicy,
  PLANS,
  POLICY_SECTIONS,
  policyBounds,
  policyDefaults,
  resetPolicy,
  writePolicy,
  type PolicySection,
} from '../lib/platformPolicy.ts'

type AppEnv = { Bindings: Env; Variables: { adminUser?: AdminSessionUser; adminIsLegacyKey?: boolean } }

const route = new Hono<AppEnv>()

// This catalogue is derived from the same policy FamilyState uses to enforce
// child, device, and playback limits. It is not a pricing or store catalogue:
// provider products, prices, and promotions have no authority model here yet.
route.use('*', requireAdmin)

route.get('/plans', async (c) => {
  const policy = await loadPolicy(c.env, 'plan_limits')
  const plans = PLANS.map((id: Plan) => {
    const limits = policy.value[id]
    return {
      id,
      limits: {
        children: limits.children,
        devices: limits.devices,
        tv_devices: limits.tvDevices,
        concurrent_streams: limits.concurrentStreams,
        download_devices: limits.downloadDevices,
        offline_items: limits.offlineItems,
      },
    }
  })

  return c.json({
    success: true,
    data: {
      // ADMIN-POLICY: `platform_policy` (0098) when an operator has saved
      // limits, the code defaults (`family_policy`) otherwise. Either way these
      // are exactly the numbers FamilyState enforces.
      source: policy.source === 'default' ? 'family_policy' : 'platform_policy',
      policy_version: policy.version,
      pricing_available: false,
      plans,
    },
  })
})

/* ---------------------------------------------------- platform policy */

async function snapshot(env: Env) {
  const sections = await Promise.all(POLICY_SECTIONS.map(async (section) => [section, await loadPolicy(env, section)] as const))
  return {
    sections: Object.fromEntries(sections),
    defaults: policyDefaults(),
    bounds: policyBounds(),
    /// Shown on the page so nobody hunts for a field that is missing on purpose.
    not_editable: [
      'token_lifetimes', 'pairing_code_length', 'link_ticket_lifetime', 'rate_limits', 'screen_time_accounting',
    ],
  }
}

route.get('/platform-policy', async (c) => c.json({ success: true, data: await snapshot(c.env) }))

function reasonOf(body: Record<string, unknown>) {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  return reason.length >= 3 && reason.length <= 500 ? reason : null
}

async function audit(c: Parameters<typeof actorId>[0] & { env: Env }, action: string, section: PolicySection, details: Record<string, unknown>) {
  try {
    await auditStatement(c.env.DB, actorId(c), action, 'platform_policy', section, details).run()
  } catch (error) {
    // The change is stored; a failed audit row is logged, not turned into a
    // failed save the operator would retry.
    console.error('platform_policy_audit_failed', error instanceof Error ? error.message : String(error))
  }
}

/// `publish`: a limit change reaches every family at once, like a remote-config
/// value. Every change needs a written reason, kept in the audit log.
route.put('/platform-policy/:section', requirePermission('publish'), async (c) => {
  const section = c.req.param('section')
  if (!isPolicySection(section)) return c.json({ success: false, error: `قسم غير معروف: ${section}` }, 400)
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'صيغة الطلب غير صالحة' }, 400)
  const reason = reasonOf(body)
  if (!reason) return c.json({ success: false, error: 'اكتب سبب التغيير (3 أحرف على الأقل)' }, 400)

  const before = await loadPolicy(c.env, section)
  const written = await writePolicy(c.env.DB, section, body.value, actorId(c))
  if (!written.ok) return c.json({ success: false, error: written.error }, 400)
  await audit(c, 'update', section, {
    reason, before: before.value, after: written.value.value,
    version_from: before.version, version_to: written.value.version,
  })
  return c.json({ success: true, data: await snapshot(c.env) })
})

route.post('/platform-policy/:section/reset', requirePermission('publish'), async (c) => {
  const section = c.req.param('section')
  if (!isPolicySection(section)) return c.json({ success: false, error: `قسم غير معروف: ${section}` }, 400)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const reason = reasonOf(body) ?? 'restore defaults'
  const before = await loadPolicy(c.env, section)
  const written = await resetPolicy(c.env.DB, section, actorId(c))
  if (!written.ok) return c.json({ success: false, error: written.error }, 400)
  await audit(c, 'reset', section, {
    reason, before: before.value, after: written.value.value,
    version_from: before.version, version_to: written.value.version,
  })
  return c.json({ success: true, data: await snapshot(c.env) })
})

export default route
