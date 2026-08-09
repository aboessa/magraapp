import { createContext, useContext } from 'react'

/**
 * لغات صفحة الهبوط.
 * مستقلة عن Locale الخاص بلوحة الإدارة (ar|en فقط) حتى لا تنكسر
 * سجلات النصوص هناك بإضافة الفرنسية إلى نوع مشترك.
 */
export type LandingLocale = 'ar' | 'en' | 'fr'

export const LANDING_LOCALES: {
  code: LandingLocale
  /** الاسم بلغته الأصلية، وهو ما يُعرض في مبدّل اللغة */
  native: string
  /** اختصار للهيدر الضيق */
  short: string
  dir: 'rtl' | 'ltr'
  /** وسم HTML lang */
  htmlLang: string
}[] = [
  { code: 'ar', native: 'العربية', short: 'ع', dir: 'rtl', htmlLang: 'ar' },
  { code: 'en', native: 'English', short: 'EN', dir: 'ltr', htmlLang: 'en' },
  { code: 'fr', native: 'Français', short: 'FR', dir: 'ltr', htmlLang: 'fr' },
]

export const STORAGE_KEY = 'majarra-landing-lang'

export function localeMeta(locale: LandingLocale) {
  return LANDING_LOCALES.find((entry) => entry.code === locale) ?? LANDING_LOCALES[0]
}

export function isLandingLocale(value: unknown): value is LandingLocale {
  return value === 'ar' || value === 'en' || value === 'fr'
}

/** يقرأ اللغة المحفوظة، وإلا يستنتجها من لغة المتصفح، وإلا العربية */
export function initialLandingLocale(): LandingLocale {
  if (typeof window === 'undefined') return 'ar'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (isLandingLocale(stored)) return stored
  const preferred = window.navigator.languages ?? [window.navigator.language]
  for (const tag of preferred) {
    const base = String(tag).slice(0, 2).toLowerCase()
    if (isLandingLocale(base)) return base
  }
  return 'ar'
}

export type LandingLocaleValue = {
  locale: LandingLocale
  dir: 'rtl' | 'ltr'
  setLocale: (locale: LandingLocale) => void
}

export const LandingLocaleContext = createContext<LandingLocaleValue | null>(null)

export function useLandingLocale() {
  const value = useContext(LandingLocaleContext)
  if (!value) throw new Error('useLandingLocale must be used inside the landing page')
  return value
}

/**
 * يعزل مقطعًا لاتينيًا أو نطاقًا رقميًا داخل نص عربي.
 * في سياق RTL تعكس قواعد الاتجاه الثنائي «9–12» فتظهر «12–9»،
 * وهذا خطأ في المعلومة لا في الشكل. لا حاجة للعزل في اللغات اللاتينية.
 */
export function ltr(value: string) {
  return `\u2066${value}\u2069`
}
