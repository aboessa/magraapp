import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'

const pageNames: Record<Locale, Record<string, { title: string; subtitle: string }>> = {
  ar: {
    '/admin': { title: 'لوحة التحكم', subtitle: 'صورة مباشرة من قاعدة بيانات المحتوى والعائلات' },
    '/admin/series': { title: 'إدارة السلاسل', subtitle: 'هوية مستقلة لكل سلسلة ومسار عمري واضح' },
    '/admin/episodes': { title: 'الحلقات والوحدات', subtitle: 'إدارة النشر والأهداف والأنشطة المرتبطة' },
    '/admin/library-content': { title: 'مكتبة المحتوى', subtitle: 'إدارة الكتب والألعاب والمشروعات من مكان واحد' },
    '/admin/parents': { title: 'أولياء الأمور', subtitle: 'الحسابات والباقات وملفات الأسرة' },
    '/admin/children': { title: 'ملفات الأطفال', subtitle: 'المسار مشتق تلقائيًا من شهر وسنة الميلاد' },
  },
  en: {
    '/admin': { title: 'Dashboard', subtitle: 'Live content and family data from the database' },
    '/admin/series': { title: 'Series management', subtitle: 'A distinct identity and clear age track for every series' },
    '/admin/episodes': { title: 'Episodes & units', subtitle: 'Manage publishing, objectives, and linked activities' },
    '/admin/library-content': { title: 'Content library', subtitle: 'Manage books, games, and projects in one place' },
    '/admin/parents': { title: 'Parents', subtitle: 'Accounts, plans, and family profiles' },
    '/admin/children': { title: 'Child profiles', subtitle: 'Track is derived automatically from birth month and year' },
  },
}

const copy = {
  ar: { menu: 'فتح القائمة', placeholder: 'بحث في السلاسل...', search: 'بحث السلاسل', light: 'تفعيل الوضع الفاتح', dark: 'تفعيل الوضع الداكن', language: 'اللغة', account: 'حساب الإدارة', role: 'مدير المحتوى', org: 'إدارة مجرة' },
  en: { menu: 'Open menu', placeholder: 'Search series...', search: 'Search series', light: 'Enable light mode', dark: 'Enable dark mode', language: 'Language', account: 'Admin account', role: 'Content manager', org: 'Majarra administration' },
}

export function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme, locale, setLocale, setMenuOpen } = usePreferences()
  const [search, setSearch] = useState('')
  const text = copy[locale]
  const page = pageNames[locale][location.pathname] ?? pageNames[locale]['/admin']

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    const value = search.trim()
    navigate(value ? `/admin/series?q=${encodeURIComponent(value)}` : '/admin/series')
  }

  return (
    <header className="topbar">
      <div className="topbar__heading">
        <button className="icon-button menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label={text.menu}><Icon name="menu" /></button>
        <div><h1>{page.title}</h1><p>{page.subtitle}</p></div>
      </div>

      <div className="topbar__actions">
        <form className="global-search" role="search" onSubmit={submitSearch}>
          <Icon name="search" size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.placeholder} aria-label={text.search} />
        </form>
        <div className="language-toggle" aria-label={text.language}>
          <button className={locale === 'ar' ? 'active' : ''} type="button" aria-pressed={locale === 'ar'} onClick={() => setLocale('ar')}>العربية</button>
          <button className={locale === 'en' ? 'active' : ''} type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
        </div>
        <button className="icon-button" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? text.light : text.dark} title={theme === 'dark' ? text.light : text.dark}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <div className="admin-profile" title={text.account}><span>{locale === 'ar' ? 'م' : 'M'}</span><div><strong>{text.role}</strong><small>{text.org}</small></div></div>
      </div>
    </header>
  )
}
