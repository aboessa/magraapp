import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette, useCommandPalette } from './CommandPalette'
import { usePreferences } from '../context/preferences'

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

