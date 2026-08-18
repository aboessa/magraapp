import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { generalLimit } from '../lib/rateLimit.ts'
import { readSiteModeSettings, toPublicStatus } from '../lib/siteMode.ts'

type AppEnv = { Bindings: Env }

const siteModeRoute = new Hono<AppEnv>()

/**
 * حالة الموقع للزائر المجهول.
 *
 * تُعيد 200 دائمًا حتى في وضع الصيانة: هذه نقطة استعلام عن الحالة وليست
 * الصفحة نفسها، وإرجاع 503 هنا يجعل الواجهة عاجزة عن التمييز بين «الموقع
 * في صيانة» و«تعذّر الوصول للخدمة»، وهما حالتان تُعرضان بشكل مختلف.
 *
 * لا تكشف أي إعداد داخلي: فقط الوضع وموعد الإطلاق والرسالة المعلنة.
 */
siteModeRoute.get('/', generalLimit, async (c) => {
  const settings = await readSiteModeSettings(c.env.DB)
  const status = toPublicStatus(settings)

  if (status.retryAfterSeconds) {
    c.header('Retry-After', String(status.retryAfterSeconds))
  }
  // الحالة تتغيّر بقرار إداري، فالتخزين القصير يقلّل الحمل بلا تأخير محسوس
  c.header('Cache-Control', 'public, max-age=30')

  return c.json({ success: true, data: status })
})

export default siteModeRoute
