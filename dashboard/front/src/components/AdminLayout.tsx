import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette, useCommandPalette } from './CommandPalette'
import { usePreferences } from '../context/preferences'
import { ADMIN_BASE } from '../lib/adminPath'

/**
 * قشرة اللوحة.
 *
 * لوحة الأوامر تُركَّب هنا لا في الشريط العلوي: الاختصار العام (Ctrl+K) يجب أن
 * يعمل من أي صفحة، وتركيبها داخل الشريط كان سيربط عمرها بعمره.
 *
 * ## حدود Suspense واحدة
 *
 * كل صفحة في `AdminRoutes` تُحمَّل عند الطلب، فتحتاج حدودًا. حدود واحدة حول
 * `Outlet` تكفي وأفضل من واحدة لكل مسار: القائمة والشريط العلوي يبقيان مرسومين
 * أثناء تحميل الصفحة، فلا تختفي اللوحة كلها ثم تعود.
 */
export function AdminLayout() {
  const { locale, menuOpen, setMenuOpen } = usePreferences()
  const palette = useCommandPalette()
  const location = useLocation()

  // ضمان أن كل مسار داخل /admin له عنوان تبويب صحيح، لا يبقى على
  // "تسجيل الدخول" بعد الانتقال. الصفحات الفردية قد تكتب عنوانًا أدق
  // في useEffect خاص بها وستتفوّق لأنها تُنفّذ بعد هذا التأثير الأب.
  useEffect(() => {
    const raw = location.pathname.replace(/\/+$/, '') || '/'
    const base = ADMIN_BASE
    const isDashboard = raw === base || raw === `${base}/` || raw === '/' || raw === ''
    if (isDashboard) {
      document.title = locale === 'ar' ? 'لوحة التحكم · مجرة' : 'Dashboard · Majarra'
    } else {
      const withoutBase = raw.startsWith(base) ? raw.slice(base.length) : raw
      const segment = withoutBase.split('/').filter(Boolean).pop() ?? ''
      const pretty = segment ? segment.replace(/-/g, ' ') : ''
      if (pretty) {
        document.title = locale === 'ar' ? `${pretty} · لوحة التحكم · مجرة` : `${pretty} · Dashboard · Majarra`
      } else {
        document.title = locale === 'ar' ? 'لوحة التحكم · مجرة' : 'Dashboard · Majarra'
      }
    }
  }, [location.pathname, locale])

  return (
    <div className="admin-shell">
      <Sidebar />
      {menuOpen && <button className="sidebar-overlay" type="button" aria-label={locale === 'ar' ? 'إغلاق القائمة' : 'Close menu'} onClick={() => setMenuOpen(false)} />}
      <div className="admin-workspace">
        <Topbar onOpenPalette={() => palette.setOpen(true)} />
        <main className="admin-content">
          <Suspense fallback={
            <div className="page-state page-state--loading" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <p>{locale === 'ar' ? 'جارٍ تحميل الشاشة…' : 'Loading the screen…'}</p>
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette open={palette.open} onClose={() => palette.setOpen(false)} />
    </div>
  )
}

