import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette, useCommandPalette } from './CommandPalette'
import { PermissionGate } from './PermissionGate'
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
        <main className="admin-content" key={location.pathname.split('/').slice(0,4).join('/')}>
          <Suspense fallback={
            <div className="page-state page-state--loading" role="status" aria-live="polite" style={{ minHeight: 320 }}>
              <div style={{ display:'grid', gap:14, width:'100%', maxWidth:720, margin:'0 auto' }}>
                <div style={{ height:22, width:'42%', borderRadius:8, background:'var(--surface-2)', animation:'pulse 1.2s ease-in-out infinite' }} />
                <div style={{ height:16, width:'68%', borderRadius:8, background:'var(--surface-2)', animation:'pulse 1.2s ease-in-out infinite .15s' }} />
                <div style={{ height:180, borderRadius:16, background:'linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.6s ease-in-out infinite' }} />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  <div style={{ height:88, borderRadius:14, background:'var(--surface-2)', animation:'pulse 1.2s ease-in-out infinite .3s' }} />
                  <div style={{ height:88, borderRadius:14, background:'var(--surface-2)', animation:'pulse 1.2s ease-in-out infinite .45s' }} />
                  <div style={{ height:88, borderRadius:14, background:'var(--surface-2)', animation:'pulse 1.2s ease-in-out infinite .6s' }} />
                </div>
              </div>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}} @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
            </div>
          }>
            {/* الحرس داخل الحدود لا خارجها: عند الحجب لا يُرسَم `Outlet` فلا
                تُنزَّل حزمة الصفحة أصلًا. */}
            <PermissionGate>
              <Outlet />
            </PermissionGate>
          </Suspense>
        </main>
      </div>
      <CommandPalette open={palette.open} onClose={() => palette.setOpen(false)} />
    </div>
  )
}

