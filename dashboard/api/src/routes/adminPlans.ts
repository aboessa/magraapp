import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { PLAN_LIMITS, PLAN_POLICY_VERSION, type Plan } from '../lib/familyPolicy.ts'
import { requireAdmin } from '../lib/adminAuth.ts'

type AppEnv = { Bindings: Env }

const route = new Hono<AppEnv>()

// This catalogue is deliberately derived from the same policy FamilyState uses
// to enforce child, device, and playback limits. It is not a pricing or store
// catalogue: provider products, prices, and promotions have no authority model
// in this application yet.
route.use('*', requireAdmin)

route.get('/plans', (c) => {
  const plans = (Object.entries(PLAN_LIMITS) as Array<[Plan, typeof PLAN_LIMITS[Plan]]>)
    .map(([id, limits]) => ({
      id,
      limits: {
        children: limits.children,
        devices: limits.devices,
        concurrent_streams: limits.concurrentStreams,
        download_devices: limits.downloadDevices,
      },
    }))

  return c.json({
    success: true,
    data: {
      // API-102: `family_policy` هو المصدر **الوحيد** الآن. كان جدول
      // `subscription_plan_limits` يحمل الأرقام نفسها ولا يقرؤه أحد، فأُسقط في
      // المهاجرة 0085. و`policy_version` هنا يقول أي نسخة أرقام تُعرَض.
      source: 'family_policy',
      policy_version: PLAN_POLICY_VERSION,
      pricing_available: false,
      plans,
    },
  })
})

export default route
