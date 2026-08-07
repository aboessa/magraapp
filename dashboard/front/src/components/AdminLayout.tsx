import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { usePreferences } from '../context/preferences'

export function AdminLayout() {
  const { locale, menuOpen, setMenuOpen } = usePreferences()

  return (
    <div className="admin-shell">
      <Sidebar />
      {menuOpen && <button className="sidebar-overlay" type="button" aria-label={locale === 'ar' ? 'إغلاق القائمة' : 'Close menu'} onClick={() => setMenuOpen(false)} />}
      <div className="admin-workspace">
        <Topbar />
        <main className="admin-content"><Outlet /></main>
      </div>
    </div>
  )
}
