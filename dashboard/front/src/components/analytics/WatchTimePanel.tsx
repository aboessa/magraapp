import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../PageState'
import { usePreferences } from '../../context/preferences'
import { api } from '../../lib/api'

/// ADM-309: watch time, from `GET /admin/analytics/watch-time`.
///
/// The numbers are the same seconds the screen-time limits count, broken down by
/// content, so what the dashboard reports is what families were limited on.

type WatchTime = Awaited<ReturnType<typeof api.watchTime>>['data']
type Range = 7 | 30 | 90

const copy = {
  ar: {
    title: 'وقت المشاهدة', lede: 'نفس الثواني اللي بتتحسب في حدود وقت الشاشة. الأيام بتوقيت كل أسرة.',
    minutes: 'دقيقة مشاهدة', children: 'طفل شاهد', families: 'أسرة', avg: 'متوسط دقايق الطفل في اليوم',
    daily: 'يوميًا', day: 'اليوم', kids: 'أطفال', byTrack: 'حسب المرحلة', track: 'المرحلة',
    topContent: 'أكتر حلقات اتشافت', topSeries: 'أكتر سلاسل اتشافت', item: 'المحتوى', series: 'السلسلة',
    empty: 'مفيش وقت مشاهدة مسجّل في الفترة دي. التسجيل بدأ من 2026-09-28.',
    range: { 7: '7 أيام', 30: '30 يوم', 90: '90 يوم' },
    tracks: { preschool: 'ما قبل المدرسة', kids: 'أطفال', junior: 'ناشئين', unknown: 'غير معروف' },
  },
  en: {
    title: 'Watch time', lede: 'The same seconds the screen-time limits count. Days are each family\'s local date.',
    minutes: 'minutes watched', children: 'children watched', families: 'families', avg: 'avg minutes per child per day',
    daily: 'Daily', day: 'Day', kids: 'Children', byTrack: 'By age track', track: 'Track',
    topContent: 'Most watched episodes', topSeries: 'Most watched series', item: 'Content', series: 'Series',
    empty: 'No watch time recorded in this period. Recording started on 2026-09-28.',
    range: { 7: '7 days', 30: '30 days', 90: '90 days' },
    tracks: { preschool: 'Preschool', kids: 'Kids', junior: 'Junior', unknown: 'Unknown' },
  },
}

export function WatchTimePanel() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [range, setRange] = useState<Range>(7)
  const [data, setData] = useState<WatchTime | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (days: Range) => {
    setError('')
    setData(null)
    try {
      setData((await api.watchTime(days)).data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    }
  }, [])
  useEffect(() => { void load(range) }, [load, range])

  const trackName = (track: string | null) =>
    text.tracks[(track ?? 'unknown') as keyof typeof text.tracks] ?? track ?? text.tracks.unknown
  const peak = Math.max(1, ...(data?.daily.map((row) => row.minutes) ?? [0]))

  return (
    <section className="panel" style={{ padding: 22, borderRadius: 16 }} aria-labelledby="watch-time-title">
      <div className="panel__header" style={{ padding: 0, marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 id="watch-time-title">{text.title}</h3>
          <p className="panel__note">{text.lede}</p>
        </div>
        <div role="group" aria-label={text.title} style={{ display: 'flex', gap: 6 }}>
          {([7, 30, 90] as Range[]).map((days) => (
            <button
              key={days}
              type="button"
              className={days === range ? 'button button--primary' : 'button'}
              aria-pressed={days === range}
              onClick={() => setRange(days)}
            >
              {text.range[days]}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void load(range)} /> : !data ? <LoadingState /> : (
        data.totals.watched_minutes === 0 && data.daily.length === 0 ? <p className="panel__note">{text.empty}</p> : (
          <>
            <p>
              <strong>{data.totals.watched_minutes}</strong> {text.minutes} · <strong>{data.totals.active_children}</strong> {text.children}
              {' · '}<strong>{data.totals.active_families}</strong> {text.families} · <strong>{data.totals.avg_minutes_per_child_day}</strong> {text.avg}
            </p>

            <h4>{text.daily}</h4>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>{text.day}</th><th>{text.minutes}</th><th>{text.kids}</th></tr></thead>
                <tbody>
                  {data.daily.map((row) => (
                    <tr key={row.day}>
                      <td dir="ltr">{row.day}</td>
                      <td>
                        <span aria-hidden="true" style={{ display: 'inline-block', height: 8, borderRadius: 4, background: 'currentColor', opacity: 0.5, width: `${Math.round((row.minutes / peak) * 120)}px`, marginInlineEnd: 8 }} />
                        {row.minutes}
                      </td>
                      <td>{row.children}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4>{text.byTrack}</h4>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>{text.track}</th><th>{text.minutes}</th><th>{text.kids}</th></tr></thead>
                <tbody>
                  {data.by_track.map((row) => (
                    <tr key={row.age_track ?? 'unknown'}><td>{trackName(row.age_track)}</td><td>{row.minutes}</td><td>{row.children}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4>{text.topSeries}</h4>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>{text.series}</th><th>{text.minutes}</th><th>{text.kids}</th></tr></thead>
                <tbody>
                  {data.top_series.map((row) => (
                    <tr key={row.series_id}><td>{row.title ?? row.series_id}</td><td>{row.minutes}</td><td>{row.children}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4>{text.topContent}</h4>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>{text.item}</th><th>{text.series}</th><th>{text.minutes}</th><th>{text.kids}</th></tr></thead>
                <tbody>
                  {data.top_content.map((row) => (
                    <tr key={`${row.content_type}:${row.content_id}`}>
                      <td>{row.title ?? <code dir="ltr">{row.content_id}</code>}</td>
                      <td>{row.series_title ?? '—'}</td>
                      <td>{row.minutes}</td>
                      <td>{row.children}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </section>
  )
}
