import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { AnalyticsOverview } from '../types/api'

/**
 * الإحصاءات السلوكية.
 *
 * ## ما كانت عليه
 *
 * `.catch(() => setData({}))` يجعل `{}` قيمة صادقة، فتُخفى شاشة التحميل وتُعرض
 * «إجمالي التشغيلات: 0» عبر `{data.total_plays ?? 0}`. النتيجة أن انقطاع
 * الـAPI يبدو مطابقًا تمامًا لنشاط صفري حقيقي — وهما حالتان مختلفتان تمامًا،
 * الأولى عطل والثانية معلومة.
 *
 * وكانت `mastery` تعود من الخادم ولا تُعرض إطلاقًا، والأحداث الحديثة تُلقى في
 * `<pre>JSON.stringify(...)</pre>` خامًا.
 */

const copy = {
  ar: {
    eyebrow: 'التحليلات',
    title: 'الإحصاءات السلوكية',
    lede: 'مجهولة الهوية: child_id فقط بلا أي بيانات شخصية.',
    totalPlays: 'إجمالي التشغيلات',
    byTrack: 'حسب المسار العمري',
    mastery: 'مستويات الإتقان',
    recentEvents: 'أحداث حديثة',
    track: 'المسار',
    count: 'العدد',
    level: 'المستوى',
    eventType: 'الحدث',
    parent: 'الحساب',
    when: 'الوقت',
    noTracks: 'لا نشاط بعد',
    noTracksHint: 'الأرقام تظهر عند بدء الأطفال بمشاهدة المحتوى.',
    noMastery: 'لا بيانات إتقان',
    noMasteryHint: 'الإتقان يُحسب من محاولات الأنشطة التعليمية.',
    noEvents: 'لا أحداث',
    loadError: 'تعذر تحميل التحليلات',
  },
  en: {
    eyebrow: 'Analytics',
    title: 'Behavioural analytics',
    lede: 'Anonymous: child_id only, no personal data.',
    totalPlays: 'Total plays',
    byTrack: 'By age track',
    mastery: 'Mastery levels',
    recentEvents: 'Recent events',
    track: 'Track',
    count: 'Count',
    level: 'Level',
    eventType: 'Event',
    parent: 'Account',
    when: 'When',
    noTracks: 'No activity yet',
    noTracksHint: 'Numbers appear once children start watching content.',
    noMastery: 'No mastery data',
    noMasteryHint: 'Mastery is computed from learning activity attempts.',
    noEvents: 'No events',
    loadError: 'Unable to load analytics',
  },
}

const TRACK_LABELS: Record<string, { ar: string; en: string }> = {
  preschool: { ar: 'ما قبل المدرسة', en: 'Preschool' },
  kids: { ar: 'الأطفال', en: 'Kids' },
  junior: { ar: 'الناشئة', en: 'Junior' },
}

function formatEventTime(value: unknown, locale: 'ar' | 'en') {
  // occurred_at_ms عدد ميلي ثانية، وprocessed_at نص D1 بتوقيت UTC
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }
  if (typeof value === 'string' && value) {
    const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    }
  }
  return '—'
}

export function AnalyticsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.analyticsOverview()
      setData(response.data)
    } catch (caught) {
      // لا `{}` احتياطية: العطل يُعرض عطلًا لا صفرًا
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error || text.loadError} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card stat-card--blue">
          <div className="stat-card__top"><span>{text.totalPlays}</span></div>
          <strong className="stat-card__value" dir="ltr">{data.total_plays ?? 0}</strong>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel__header"><h3>{text.byTrack}</h3></div>
          {(data.by_track ?? []).length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>{text.track}</th><th>{text.count}</th></tr></thead>
                <tbody>
                  {data.by_track.map((row) => (
                    <tr key={row.track_id}>
                      <td>
                        <span className={`track-badge track-badge--${row.track_id}`}>
                          {TRACK_LABELS[row.track_id]?.[locale] ?? row.track_id}
                        </span>
                      </td>
                      <td dir="ltr">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.noTracks} description={text.noTracksHint} />
          )}
        </section>

        <section className="panel">
          <div className="panel__header"><h3>{text.mastery}</h3></div>
          {/* mastery كانت تعود من الخادم ولا تُعرض إطلاقًا */}
          {(data.mastery ?? []).length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>{text.level}</th><th>{text.count}</th></tr></thead>
                <tbody>
                  {data.mastery.map((row) => (
                    <tr key={row.level}>
                      <td><span className="track-badge">{row.level}</span></td>
                      <td dir="ltr">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.noMastery} description={text.noMasteryHint} />
          )}
        </section>
      </div>

      <section className="panel panel--table">
        <div className="panel__header">
          <h3>{text.recentEvents}</h3>
          <span className="panel__kicker">{(data.recent_events ?? []).length}</span>
        </div>
        {(data.recent_events ?? []).length ? (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr><th>{text.eventType}</th><th>{text.parent}</th><th>{text.when}</th></tr>
              </thead>
              <tbody>
                {/* جدول مقروء بدل JSON.stringify خام */}
                {data.recent_events.slice(0, 20).map((event, index) => {
                  const row = event as Record<string, unknown>
                  return (
                    <tr key={String(row.event_id ?? index)}>
                      <td><span className="table-primary" dir="ltr">{String(row.event_type ?? '—')}</span></td>
                      <td>
                        <span className="table-secondary" dir="ltr">
                          {String(row.parent_id ?? '—').slice(0, 12)}…
                        </span>
                      </td>
                      <td>
                        <span className="table-secondary">
                          {formatEventTime(row.occurred_at_ms ?? row.processed_at, locale)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={text.noEvents} description={text.noTracksHint} />
        )}
      </section>
    </div>
  )
}
