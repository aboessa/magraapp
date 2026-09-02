import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { hasPermission } from '../lib/adminSession'
import { ADMIN_BASE, adminPath } from '../lib/adminPath'
import { permissionForPath } from '../lib/routePermissions'
import { usePreferences } from '../context/preferences'

/**
 * نقطة الإنفاذ الوحيدة لتصاريح المسارات في اللوحة (`ADM-102`).
 *
 * ## لماذا نقطة واحدة لا مئة وثلاث وعشرون
 *
 * البديل الظاهر أن يُغلَّف كل `<Route>` بحرسٍ خاصّ به. رفضته لسبب واحد يكفي:
 * مئة وثلاثة وعشرون موضعًا يعني أن **المسار المئة والرابع والعشرين سيُكتب بلا
 * حرس**، ولن يلاحظ أحد لأن غياب الحرس يظهر كشاشة تعمل. الحرس هنا يقرأ الموقع
 * الحالي من الموجّه، فيسري على كل مسار قائم وكل مسار يُضاف، ويحرس اختبارٌ أن كل
 * مسار في `AdminRoutes.tsx` له قرارٌ مُعلَن في `ROUTE_PERMISSIONS`.
 *
 * ## ما لا يفعله
 *
 * لا يحمي شيئًا. الحماية في `requirePermission` في الخادم، وهي التي تبقى إن
 * عُدِّل هذا الملف في المتصفح. وظيفته أن يقول «لا تملك هذا» **قبل** أن يملأ
 * المستخدم نموذجًا يفقده على 403.
 */
export function PermissionGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { locale } = usePreferences()

  const raw = location.pathname
  const relative = raw.startsWith(ADMIN_BASE) ? raw.slice(ADMIN_BASE.length) : raw
  const required = permissionForPath(relative)

  if (!required || hasPermission(required)) return <>{children}</>

  const ar = locale === 'ar'
  return (
    <div className="page-state page-state--empty" role="alert" style={{ minHeight: 320, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <div aria-hidden="true" style={{ fontSize: 34 }}>🔒</div>
        <h2 style={{ margin: 0 }}>{ar ? 'لا تملك صلاحية هذه الشاشة' : 'You do not have access to this screen'}</h2>
        <p style={{ margin: 0, color: 'var(--text-2)' }}>
          {ar
            ? 'هذه الشاشة تحتاج صلاحية لا يمنحها حسابك، فكل إجراء فيها سيُرفض. اطلب الصلاحية من مالك المنصّة بدل تعبئة نموذج يفقد عمله.'
            : 'This screen needs a permission your account does not have, so every action in it would be rejected. Ask the platform owner for the permission instead of filling a form that loses your work.'}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
          {ar ? 'الصلاحية المطلوبة: ' : 'Required permission: '}
          <code>{required}</code>
        </p>
        <a href={adminPath()} className="btn btn--ghost" style={{ justifySelf: 'center' }}>
          {ar ? 'رجوع إلى لوحة التحكم' : 'Back to dashboard'}
        </a>
      </div>
    </div>
  )
}
