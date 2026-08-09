import { Hono } from 'hono'
import { requireAdmin, requirePermission } from '../lib/adminAuth'
import { actorId, auditStatement } from '../lib/auditLog'
import type { Env } from '../lib/db'
import type { AdminSessionUser } from '../lib/adminUsers'
import { writeSetting } from '../lib/partnerships'
import {
  DEFAULT_SITE_MODE,
  isSiteMode,
  isSiteModeSetting,
  normalizeEtaMinutes,
  normalizeLaunchAt,
  normalizeStatusMessage,
  readSiteModeSettings,
  SITE_MODES,
  toPublicStatus,
} from '../lib/siteMode'

type AppEnv = { Bindings: Env; Variables: { adminUser?: AdminSessionUser; adminIsLegacyKey?: boolean } }

const adminSiteModeRoute = new Hono<AppEnv>()

adminSiteModeRoute.use('*', requireAdmin)

/// هوية الفاعل من الجلسة لا من ترويسة يكتبها المتصل.
///
/// كانت `X-Admin-Actor` هي المصدر الوحيد، وهي ترويسة يضعها العميل بنفسه بلا
/// أي تحقّق، فكان بوسع أي متصل نسبة حجب الموقع إلى موظف آخر. القيمة
/// الافتراضية `'dashboard-admin'` لم تكن معرّفًا في admin_users أصلًا، فسجل
/// «من غيّر وضع الموقع» كان بلا قيمة تدقيقية.
///
/// `actorId` من lib/auditLog.ts يقرأ الجلسة المُصادَقة التي وضعها requireAdmin،
/// وهو المصدر نفسه الذي تستخدمه بقية وحدات الإدارة.
function actor(c: Parameters<typeof actorId>[0]) {
  return actorId(c)
}

adminSiteModeRoute.get('/', async (c) => {
  const settings = await readSiteModeSettings(c.env.DB)
  return c.json({
    success: true,
    data: {
      settings,
      // تُرسل الأوضاع المتاحة مع الحالة حتى لا تُكرَّر القائمة في الواجهة
      // وتنحرف عن الخادم عند إضافة وضع جديد.
      modes: SITE_MODES,
      preview: toPublicStatus(settings),
    },
  })
})

/// `publish`: تبديل وضع الموقع يحجب المنصّة عن كل زائر أو يفتحها، وهو أوسع
/// أثرًا من نشر قطعة محتوى واحدة. لا توجد صلاحية مخصّصة لإعدادات المنصّة في
/// المهاجرة 0014، و`publish` أقرب الموجود لأثر عام كهذا.
adminSiteModeRoute.put('/', requirePermission('publish'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'صيغة الطلب غير صالحة' }, 400)

  const updates: [string, string][] = []

  for (const [key, raw] of Object.entries(body)) {
    if (!isSiteModeSetting(key)) {
      return c.json({ success: false, error: `مفتاح غير مسموح: ${key}` }, 400)
    }
    const value = typeof raw === 'string' ? raw : String(raw ?? '')

    if (key === 'site_mode') {
      if (!isSiteMode(value)) {
        return c.json({ success: false, error: `وضع غير معروف: ${value}` }, 400)
      }
      updates.push([key, value])
      continue
    }

    if (key === 'site_launch_at') {
      const normalized = normalizeLaunchAt(value)
      if (normalized === null) {
        return c.json({ success: false, error: 'موعد الإطلاق ليس تاريخًا صالحًا' }, 400)
      }
      updates.push([key, normalized])
      continue
    }

    if (key === 'maintenance_eta_minutes') {
      const normalized = normalizeEtaMinutes(value)
      if (normalized === null) {
        return c.json({ success: false, error: 'مدة الصيانة يجب أن تكون دقائق بين 1 و20160' }, 400)
      }
      updates.push([key, normalized])
      continue
    }

    updates.push([key, normalizeStatusMessage(value)])
  }

  if (!updates.length) return c.json({ success: false, error: 'لا حقول للتحديث' }, 400)

  for (const [key, value] of updates) {
    await writeSetting(c.env.DB, key, value, actor(c))
  }

  // تغيير وضع الموقع قرار له أثر عام، فيُسجَّل بآلية التدقيق المشتركة التي
  // تنقّح أي قيمة حساسة بدل تسلسل JSON محليًا.
  const changedMode = updates.find(([key]) => key === 'site_mode')?.[1]
  try {
    await auditStatement(
      c.env.DB,
      actor(c),
      'update',
      'platform_settings',
      'site_mode',
      { changes: Object.fromEntries(updates) },
    ).run()
  } catch (error) {
    // الإعداد حُفظ بالفعل، وفشل التدقيق لا يستحق إفشال الاستجابة
    console.error('site_mode_audit_failed', error instanceof Error ? error.message : String(error))
  }
  if (changedMode) console.warn('site_mode_changed', changedMode, actor(c))

  const settings = await readSiteModeSettings(c.env.DB)
  return c.json({
    success: true,
    data: { settings, modes: SITE_MODES, preview: toPublicStatus(settings) },
  })
})

/** يعيد الموقع إلى الوضع الافتراضي الآمن، لاستخدامه كمخرج طارئ */
adminSiteModeRoute.post('/reset', requirePermission('publish'), async (c) => {
  await writeSetting(c.env.DB, 'site_mode', DEFAULT_SITE_MODE, actor(c))
  try {
    await auditStatement(
      c.env.DB,
      actor(c),
      'reset',
      'platform_settings',
      'site_mode',
      { site_mode: DEFAULT_SITE_MODE },
    ).run()
  } catch (error) {
    console.error('site_mode_reset_audit_failed', error instanceof Error ? error.message : String(error))
  }
  const settings = await readSiteModeSettings(c.env.DB)
  return c.json({
    success: true,
    data: { settings, modes: SITE_MODES, preview: toPublicStatus(settings) },
  })
})

export default adminSiteModeRoute
