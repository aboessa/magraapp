import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PreferencesContext } from '../context/preferences'
import type { Locale, PreferencesValue } from '../context/preferences'

/**
 * تركيب مكوّن داخل السياق الذي يحتاجه فعلًا: التفضيلات + الموجِّه.
 *
 * ## لماذا لا `PreferencesProvider` الحقيقي
 *
 * المزوّد الحقيقي يقرأ `localStorage` ويكتب `document.documentElement`، فيصير
 * لغة الاختبار رهنًا بترتيب التشغيل وبما تركه اختبار سابق. هنا تُمرَّر اللغة
 * صراحةً، فالاختبار العربي والاختبار الإنجليزي مستقلّان تمامًا — وهو شرط أساسي
 * لاختبار الاتجاه (rtl/ltr).
 *
 * ## لماذا `MemoryRouter` بمسار
 *
 * حالة القوائم كلها محفوظة في عنوان الصفحة (`useUrlListState`). اختبار فلترة بلا
 * موجِّه حقيقي يقيس شيئًا آخر: بلا العنوان لا فلترة. `initialEntries` تسمح
 * ببدء الاختبار من رابط مفلتر، وهو بالضبط ما يفعله رابط من اللوحة التنفيذية.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: { locale?: Locale; route?: string; path?: string },
) {
  const locale = options?.locale ?? 'ar'
  const route = options?.route ?? '/'

  const preferences: PreferencesValue = {
    theme: 'dark',
    setTheme: () => {},
    toggleTheme: () => {},
    locale,
    setLocale: () => {},
    menuOpen: false,
    setMenuOpen: () => {},
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <PreferencesContext.Provider value={preferences}>
      <MemoryRouter initialEntries={[route]}>
        {options?.path
          ? <Routes><Route path={options.path} element={children} /></Routes>
          : children}
      </MemoryRouter>
    </PreferencesContext.Provider>
  )

  return render(ui, { wrapper })
}

/// استجابة مغلَّفة بشكل الخادم، فلا يخترع الاختبار شكلًا لا يُعيده الخادم.
export const envelope = <T,>(data: T, total?: number) => ({
  success: true,
  data,
  ...(total === undefined ? {} : { meta: { total, limit: 25, offset: 0 } }),
})
