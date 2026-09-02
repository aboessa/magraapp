import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate } from '../lib/labels'
import type { AvailabilityListRow, AvailabilityMode, AvailabilityReason } from '../types/api'

/**
 * كل قيد إتاحة جغرافي مضبوط على المنصّة، في مكان واحد (`ADM-101`).
 *
 * ## لماذا هذه الصفحة موجودة
 *
 * لوحة الإتاحة (`AvailabilityPanel`) موجودة منذ فترة وتعمل، ومركّبة كتبويب في خمس
 * مساحات عمل: السلسلة، والحلقة، والقصة، والكتاب، والكوكب. فسؤال «هل هذه السلسلة
 * ظاهرة في فرنسا؟» له جواب.
 *
 * والسؤال الذي **لم يكن له جواب** هو المعاكس: «ما المحجوب على المنصّة كلّها،
 * وأين؟». النقطة `GET /admin/availability` تُجيبه وكانت **بلا أي مُستهلِك** —
 * موجودة في الخادم، ومُعلَنة في `lib/api.ts`، ولا شاشة تنادِيها. فالجواب كان
 * يقتضي استعلام D1 بيدٍ.
 *
 * وذلك ليس ترفًا: مسار التشغيل يرفض بـ451 اعتمادًا على هذا الجدول. فبلا هذه
 * القائمة، شكوى «الفيديو لا يعمل عندي» لا يمكن ردّها إلى سببها إلا بالحدس.
 *
 * ## ما لا تفعله هذه الصفحة
 *
 * لا تحرّر. التحرير في `AvailabilityPanel` داخل مساحة العمل، حيث تظهر **سلسلة
 * الوراثة كاملة** — وقيدٌ يُحرَّر بلا رؤية ما يورثه الأب قرارٌ نصفُ معلوم. فكل صفّ
 * هنا رابطٌ إلى موضعه.
 */

const copy = {
  ar: {
    eyebrow: 'الحقوق والإتاحة',
    title: 'قيود الإتاحة الجغرافية',
    intro: 'كل قيد مضبوط صراحةً على عنصر. ما لا يظهر هنا يرث قيده من أبيه أو من الافتراض العام — والوراثة تُقرأ في تبويب الإتاحة داخل صفحة العنصر.',
    refresh: 'تحديث',
    total: 'الإجمالي',
    entity: 'العنصر',
    type: 'النوع',
    mode: 'النمط',
    countries: 'الدول',
    window: 'النافذة',
    reason: 'السبب',
    updated: 'آخر تعديل',
    open: 'فتح',
    empty: 'لا قيود مضبوطة',
    emptyHint: 'كل المحتوى يتبع الافتراض العام. اضبط قيدًا من تبويب الإتاحة في صفحة العنصر.',
    noCountries: '—',
    always: 'دائمًا',
    from: 'من',
    to: 'إلى',
    modes: {
      worldwide: 'عالمي',
      worldwide_except: 'عالمي إلا',
      selected_only: 'دول محدَّدة',
      unavailable: 'غير متاح',
    } as Record<AvailabilityMode, string>,
    reasons: {
      rights: 'حقوق',
      commercial: 'تجاري',
      editorial: 'تحريري',
      legal: 'قانوني',
    } as Record<AvailabilityReason, string>,
  },
  en: {
    eyebrow: 'Rights and availability',
    title: 'Territory restrictions',
    intro: 'Every policy set explicitly on an entity. Anything absent inherits from its parent or the platform default — inheritance is shown in the entity’s availability tab.',
    refresh: 'Refresh',
    total: 'Total',
    entity: 'Entity',
    type: 'Type',
    mode: 'Mode',
    countries: 'Countries',
    window: 'Window',
    reason: 'Reason',
    updated: 'Updated',
    open: 'Open',
    empty: 'No policies set',
    emptyHint: 'All content follows the platform default. Set one from an entity’s availability tab.',
    noCountries: '—',
    always: 'Always',
    from: 'From',
    to: 'To',
    modes: {
      worldwide: 'Worldwide',
      worldwide_except: 'Worldwide except',
      selected_only: 'Selected only',
      unavailable: 'Unavailable',
    } as Record<AvailabilityMode, string>,
    reasons: {
      rights: 'Rights',
      commercial: 'Commercial',
      editorial: 'Editorial',
      legal: 'Legal',
    } as Record<AvailabilityReason, string>,
  },
}

/// المسار الذي يفتح تبويب الإتاحة لهذا النوع، أو `null` لما لا صفحة له.
///
/// `global` ليس عنصرًا: هو الافتراض العام، ولا صفحة تفتحه. وإرجاع `null` أصدق من
/// رابطٍ يؤدّي إلى 404.
function entityHref(row: AvailabilityListRow): string | null {
  switch (row.entity_type) {
    case 'planet': return adminPath(`planets/${row.entity_id}`)
    case 'series': return adminPath(`series/${row.entity_id}`)
    case 'episode': return adminPath(`episodes/${row.entity_id}`)
    case 'story': return adminPath(`stories/${row.entity_id}`)
    case 'book': return adminPath(`books/${row.entity_id}`)
    case 'game': return adminPath(`games/${row.entity_id}`)
    case 'project': return adminPath(`projects/${row.entity_id}`)
    default: return null
  }
}

export function AvailabilityPoliciesPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [rows, setRows] = useState<AvailabilityListRow[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.availabilityPolicies()
      setRows(response.data)
    } catch (caught) {
      // رسالة الخطأ تُعرض ويُعرض معها زرّ إعادة، ولا تُقرأ القائمة الفارغة نجاحًا:
      // «لا قيود» و«تعذّر القراءة» حالتان لا يجوز أن تبدوا واحدة على شاشة حقوق.
      setError(caught instanceof Error ? caught.message : String(caught))
      setRows(null)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (rows === null) return <LoadingState />

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <span className="page__eyebrow">{text.eyebrow}</span>
          <h1>{text.title}</h1>
          <p className="page__lede">{text.intro}</p>
        </div>
        <div className="table-actions">
          <span className="track-badge">{text.total}: {rows.length}</span>
          <button className="button button--ghost" type="button" onClick={() => void load()}>
            {text.refresh}
          </button>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState title={text.empty} description={text.emptyHint} />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{text.entity}</th>
              <th>{text.type}</th>
              <th>{text.mode}</th>
              <th>{text.countries}</th>
              <th>{text.window}</th>
              <th>{text.reason}</th>
              <th>{text.updated}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = entityHref(row)
              return (
                <tr key={row.id}>
                  <td>
                    <strong>{row.entity_title || row.entity_id}</strong>
                    <br />
                    <small dir="ltr">{row.entity_id}</small>
                  </td>
                  <td>{row.entity_type}</td>
                  <td>
                    {/* النمط بالكلمات لا بالرمز: `unavailable` و`worldwide` يفترقان
                        في الأثر تمامًا، وقراءتهما خطأً تُنتج بلاغ عطل. */}
                    <span className="track-badge">{text.modes[row.mode] ?? row.mode}</span>
                  </td>
                  <td dir="ltr">
                    {row.countries.length ? row.countries.join(', ') : text.noCountries}
                  </td>
                  <td>
                    {row.starts_at || row.ends_at ? (
                      <small>
                        {row.starts_at ? `${text.from} ${formatDate(row.starts_at, locale)}` : ''}
                        {row.starts_at && row.ends_at ? ' · ' : ''}
                        {row.ends_at ? `${text.to} ${formatDate(row.ends_at, locale)}` : ''}
                      </small>
                    ) : <small>{text.always}</small>}
                  </td>
                  <td>{text.reasons[row.reason] ?? row.reason}</td>
                  <td><small>{row.updated_at ? formatDate(row.updated_at, locale) : '—'}</small></td>
                  <td>
                    {href && (
                      <Link className="button button--ghost button--small" to={href}>
                        {text.open}
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
