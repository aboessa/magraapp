import { Icon } from './Icon'
import { formatNumber } from '../lib/labels'
import type { Locale } from '../context/preferences'

/**
 * ترقيم صفحات حقيقي متصل بميتاداتا الخادم (UX-33 في DASHBOARD v3).
 *
 * يعرض «١–٥٠ من ٤٬٢٨١» بدل تحميل كل السجلات إلى المتصفح. `total/limit/offset`
 * تأتي مباشرة من `PaginatedEnvelope.meta` كما يُعيدها `lib/api.ts` — لا حساب
 * محلي مستقل قد ينحرف عن الخادم.
 */
export function Pagination({
  total,
  limit,
  offset,
  onOffsetChange,
  locale,
}: {
  total: number
  limit: number
  offset: number
  onOffsetChange: (offset: number) => void
  locale: Locale
}) {
  if (total <= limit && offset === 0) return null

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + limit, total)
  const hasPrev = offset > 0
  const hasNext = offset + limit < total

  const text = locale === 'ar'
    ? { of: 'من', prev: 'السابق', next: 'التالي' }
    : { of: 'of', prev: 'Previous', next: 'Next' }

  return (
    <footer className="pagination">
      <button
        className="button button--ghost"
        type="button"
        disabled={!hasPrev}
        onClick={() => onOffsetChange(Math.max(0, offset - limit))}
      >
        <Icon name="arrow" size={14} />
        {text.prev}
      </button>
      <span>{formatNumber(from, locale)}–{formatNumber(to, locale)} {text.of} {formatNumber(total, locale)}</span>
      <button
        className="button button--ghost"
        type="button"
        disabled={!hasNext}
        onClick={() => onOffsetChange(offset + limit)}
      >
        {text.next}
        <Icon name="arrow" size={14} />
      </button>
    </footer>
  )
}
