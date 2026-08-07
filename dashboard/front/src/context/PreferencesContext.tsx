import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { PreferencesContext } from './preferences'
import type { Locale, PreferencesValue, Theme } from './preferences'

function initialTheme(): Theme {
  const stored = window.localStorage.getItem('majarra-theme')
  return stored === 'light' ? 'light' : 'dark'
}

function initialLocale(): Locale {
  return window.localStorage.getItem('majarra-lang') === 'en' ? 'en' : 'ar'
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('majarra-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    window.localStorage.setItem('majarra-lang', locale)
    setMenuOpen(false)
  }, [locale])

  const value = useMemo<PreferencesValue>(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark'),
    locale,
    setLocale,
    menuOpen,
    setMenuOpen,
  }), [locale, menuOpen, theme])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
