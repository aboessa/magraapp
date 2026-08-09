import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { PaginatedEnvelope } from '../types/api'

const DEFAULT_LIMIT = 24

/**
 * حالة قائمة موحّدة: بحث + فلاتر + صفحات، مع مزامنة `q`/`offset` في عنوان
 * الصفحة (UX-35 «حالة العنوان» في DASHBOARD v3) — التحديث لا يُفقد الفلترة،
 * والرابط قابل للمشاركة.
 *
 * لا يستبدل هذا الهوك نمط `useCallback`+`useState` المستخدم في كل صفحة
 * حاليًا، بل يوحّد الجزء المتكرر منه (الاستعلام والترقيم) فقط، تاركًا جلب
 * البيانات نفسه لكل صفحة لأن شكل كل استجابة API مختلف.
 */
export function useListQuery(options?: { limit?: number; syncQ?: boolean }) {
  const limit = options?.limit ?? DEFAULT_LIMIT
  const syncQ = options?.syncQ ?? true
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = useState(syncQ ? searchParams.get('q') ?? '' : '')
  const [offset, setOffset] = useState(() => Number(searchParams.get('offset') ?? 0) || 0)

  useEffect(() => {
    if (!syncQ) return
    const params = new URLSearchParams(searchParams)
    if (query) params.set('q', query); else params.delete('q')
    if (offset) params.set('offset', String(offset)); else params.delete('offset')
    setSearchParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, offset])

  const resetPage = useCallback(() => setOffset(0), [])

  return { query, setQuery: (value: string) => { setQuery(value); resetPage() }, offset, setOffset, limit, resetPage }
}

/// يستخرج meta.total الحقيقي من استجابة الخادم، أو صفرًا إن غاب — لا تخمين.
export function totalFrom<T>(envelope: PaginatedEnvelope<T> | null): number {
  return envelope?.meta?.total ?? 0
}
