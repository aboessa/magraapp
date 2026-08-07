import { createContext, useContext } from 'react'

export type Theme = 'dark' | 'light'
export type Locale = 'ar' | 'en'

export interface PreferencesValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  locale: Locale
  setLocale: (locale: Locale) => void
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
}

export const PreferencesContext = createContext<PreferencesValue | null>(null)

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider')
  return value
}
