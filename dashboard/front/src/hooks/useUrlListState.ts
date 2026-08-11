import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * حالة قائمة محفوظة في عنوان الصفحة: بحث + فلاتر + ترتيب + ترقيم + طريقة عرض.
 *
 * ## لماذا العنوان هو المصدر الوحيد
 *
 * `useListQuery` القائم يحفظ `q` و`offset` في العنوان لكنه يحتفظ بنسخة في
 * `useState` أيضًا، فصار للحالة مصدران يتزامنان بـ`useEffect`. ذلك يعمل ما لم
 * يتغيّر العنوان من خارج المكوّن — وهو بالضبط ما يفعله زرّ الرجوع في المتصفح
 * ورابط مشترك وتنقّل من بطاقة في الصفحة الرئيسية إلى صفحة مفلترة. هنا لا نسخة
 * محلية: كل قراءة من `searchParams` وكل كتابة إليه، فحالة الشاشة وحالة العنوان
 * لا يمكن أن تختلفا.
 *
 * ## القواعد المضمّنة
 *
 * - تغيير أي فلتر يُصفِّر الترقيم. البقاء في الصفحة الرابعة بعد تضييق الفلترة
 *   يُظهر «لا نتائج» على مجموعة فيها نتائج، وهو أسوأ من الخطأ نفسه.
 * - القيم الافتراضية لا تُكتب في العنوان، فيبقى الرابط قصيرًا ومقروءًا.
 * - `replace: true` عند تغيير الفلاتر: لا يُراد سجلّ تنقّل بمدخل لكل حرف يُكتب
 *   في حقل البحث.
 */
export interface UrlListState<F extends Record<string, string>> {
  /// قيم الفلاتر الحالية، مدموجة مع الافتراضيات
  filters: F
  /// بحث نصّي حرّ (المفتاح `q` في العنوان)
  query: string
  setQuery: (value: string) => void
  setFilter: (key: Extract<keyof F, string>, value: string) => void
  setFilters: (next: Partial<Record<Extract<keyof F, string>, string>>) => void
  clearFilters: () => void
  /// عدد الفلاتر المختلفة عن الافتراضي (بلا البحث)
  activeFilterCount: number
  sort: string
  setSort: (value: string) => void
  offset: number
  setOffset: (value: number) => void
  limit: number
  view: string
  setView: (value: string) => void
  /// طريقة العرض كما وردت في العنوان حرفيًّا، و`null` إذا لم يحملها العنوان.
  ///
  /// `view` يطبّق الافتراضي فلا يمكن أن يميّز «العنوان يطلب الشبكة» من «العنوان
  /// لا يطلب شيئًا». الصفحة التي تحفظ تفضيل المستخدم بين الزيارات تحتاج هذا
  /// الفرق: الرابط المشترك يفوز، والعنوان المجرَّد يترك المجال للتفضيل المحفوظ.
  rawView: string | null
  /// العنوان النسبي الحالي بالفلاتر، لبناء روابط قابلة للمشاركة
  search: string
}

export function useUrlListState<F extends Record<string, string>>(
  defaults: F,
  options?: { limit?: number; defaultSort?: string; defaultView?: string },
): UrlListState<F> {
  const [searchParams, setSearchParams] = useSearchParams()
  const limit = options?.limit ?? 25
  const defaultSort = options?.defaultSort ?? ''
  const defaultView = options?.defaultView ?? 'table'

  const filters = useMemo(() => {
    const result = { ...defaults }
    for (const key of Object.keys(defaults) as Array<Extract<keyof F, string>>) {
      const value = searchParams.get(key)
      if (value !== null) result[key] = value as F[Extract<keyof F, string>]
    }
    return result
  }, [defaults, searchParams])

  const write = useCallback((mutate: (params: URLSearchParams) => void, resetPage: boolean) => {
    const params = new URLSearchParams(searchParams)
    mutate(params)
    if (resetPage) params.delete('offset')
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  const setFilter = useCallback((key: Extract<keyof F, string>, value: string) => {
    write((params) => {
      if (!value || value === defaults[key]) params.delete(key)
      else params.set(key, value)
    }, true)
  }, [defaults, write])

  const setFilters = useCallback((next: Partial<Record<Extract<keyof F, string>, string>>) => {
    write((params) => {
      for (const [key, value] of Object.entries(next) as Array<[Extract<keyof F, string>, string]>) {
        if (!value || value === defaults[key]) params.delete(key)
        else params.set(key, value)
      }
    }, true)
  }, [defaults, write])

  const clearFilters = useCallback(() => {
    write((params) => {
      for (const key of Object.keys(defaults)) params.delete(key)
      params.delete('q')
    }, true)
  }, [defaults, write])

  const activeFilterCount = useMemo(
    () => (Object.keys(defaults) as Array<Extract<keyof F, string>>)
      .filter((key) => filters[key] !== defaults[key]).length,
    [defaults, filters],
  )

  return {
    filters,
    query: searchParams.get('q') ?? '',
    setQuery: (value: string) => write((params) => {
      if (value) params.set('q', value); else params.delete('q')
    }, true),
    setFilter,
    setFilters,
    clearFilters,
    activeFilterCount,
    sort: searchParams.get('sort') ?? defaultSort,
    setSort: (value: string) => write((params) => {
      if (value && value !== defaultSort) params.set('sort', value); else params.delete('sort')
    }, true),
    offset: Math.max(0, Number(searchParams.get('offset') ?? 0) || 0),
    setOffset: (value: number) => write((params) => {
      if (value > 0) params.set('offset', String(value)); else params.delete('offset')
    }, false),
    limit,
    view: searchParams.get('view') ?? defaultView,
    rawView: searchParams.get('view'),
    // طريقة العرض لا تُصفِّر الترقيم: هي عرض للمجموعة نفسها لا تضييق لها.
    setView: (value: string) => write((params) => {
      if (value && value !== defaultView) params.set('view', value); else params.delete('view')
    }, false),
    search: searchParams.toString() ? `?${searchParams.toString()}` : '',
  }
}
