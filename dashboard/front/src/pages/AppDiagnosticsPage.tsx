import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { metricAvailabilityLabel, metricAvailabilityProps } from '../lib/labels'

/// ADM-304: what is failing in the app, from real events.
///
/// The page used to simulate a "resolver" over three invented child profiles
/// with no API call. It now shows the playback and download failures the app
/// actually reported in the last seven days, by reason and by day. The home
/// resolver itself can be previewed for real in "بناء الصفحة الرئيسية".

type Health = Awaited<ReturnType<typeof api.appHealth>>['data']

const copy = {
  ar: {
    eyebrow: 'التحكّم في التطبيق', title: 'تشخيص التطبيق',
    lede: 'الأعطال اللي التطبيق بلّغ عنها فعلًا في آخر 7 أيام.',
    volume: 'نشاط آخر 7 أيام', events: 'حدث', families: 'أسرة',
    byReason: 'الأعطال حسب السبب', type: 'النوع', reason: 'السبب', count: 'العدد',
    byDay: 'التشغيل والأعطال يوميًا', day: 'اليوم', starts: 'بدء تشغيل', errors: 'أعطال', rate: 'نسبة الأعطال',
    none: 'مفيش أعطال مسجّلة في آخر 7 أيام.', noDays: 'مفيش نشاط مسجّل.',
    unknownReason: 'غير محدد', playback: 'تشغيل', download: 'تنزيل',
    note: 'الانهيارات بتتسجل من نسخ الإنتاج بس، ومن غير رسالة الخطأ (نوعه ومكانه في الكود) عشان خصوصية الأطفال.',
    crashes: 'الانهيارات (آخر 7 أيام)', crashType: 'نوع الخطأ', where: 'المكان في الكود', reports: 'مرات',
    fatal: 'قفل التطبيق', versions: 'النسخ', lastSeen: 'آخر مرة', noCrashes: 'مفيش انهيارات مسجّلة في آخر 7 أيام.',
    frames: 'كل الأسطر',
  },
  en: {
    eyebrow: 'App control', title: 'App diagnostics',
    lede: 'Failures the app actually reported in the last 7 days.',
    volume: 'Last 7 days', events: 'events', families: 'families',
    byReason: 'Failures by reason', type: 'Type', reason: 'Reason', count: 'Count',
    byDay: 'Playback and failures per day', day: 'Day', starts: 'Starts', errors: 'Failures', rate: 'Failure rate',
    none: 'No failures recorded in the last 7 days.', noDays: 'No activity recorded.',
    unknownReason: 'Unspecified', playback: 'Playback', download: 'Download',
    note: 'Crashes are recorded from production builds only, without the error message (type and code location) for children\'s privacy.',
    crashes: 'Crashes (last 7 days)', crashType: 'Error type', where: 'Code location', reports: 'Reports',
    fatal: 'Fatal', versions: 'Versions', lastSeen: 'Last seen', noCrashes: 'No crashes recorded in the last 7 days.',
    frames: 'All frames',
  },
}

export function AppDiagnosticsPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [data, setData] = useState<Health | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setData((await api.appHealth()).data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return <LoadingState />

  return (
    <div className="content-studio-root">
      <section className="catalog-hero">
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta"><span className="catalog-hero__eyebrow">{text.eyebrow}</span></div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><div><h3>{text.volume}</h3></div></header>
        <p><strong>{data.volume_7d.events}</strong> {text.events} · <strong>{data.volume_7d.families}</strong> {text.families}</p>
      </section>

      <section className="panel">
        <header className="panel__header"><div><h3>{text.crashes}</h3></div></header>
        {data.crashes == null ? (
          <p className="panel__note" {...metricAvailabilityProps(data.crashes, locale)}>
            {metricAvailabilityLabel(locale)}
          </p>
        ) : data.crashes.groups.length === 0 ? <p className="panel__note">{text.noCrashes}</p> : (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.crashType}</th><th>{text.where}</th><th>{text.reports}</th>
                  <th>{text.fatal}</th><th>{text.families}</th><th>{text.versions}</th><th>{text.lastSeen}</th>
                </tr>
              </thead>
              <tbody>
                {data.crashes.groups.map((row) => (
                  <tr key={row.fingerprint}>
                    <td dir="ltr"><code>{row.error_type}</code>{row.context ? <div className="panel__note">{row.context}</div> : null}</td>
                    <td dir="ltr">
                      <code>{row.frames.find((f) => f.startsWith('package:majarra/')) ?? row.frames[0] ?? '—'}</code>
                      {row.frames.length > 1 ? (
                        <details>
                          <summary>{text.frames}</summary>
                          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{row.frames.join('\n')}</pre>
                        </details>
                      ) : null}
                    </td>
                    <td>{row.reports}</td>
                    <td>{row.fatal}</td>
                    <td>{row.families}</td>
                    <td dir="ltr">{row.versions.join(', ') || '—'}</td>
                    <td dir="ltr">{row.last_seen.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <header className="panel__header"><div><h3>{text.byReason}</h3></div></header>
        {data.errors.length === 0 ? <p className="panel__note">{text.none}</p> : (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.type}</th><th>{text.reason}</th><th>{text.count}</th><th>{text.families}</th></tr></thead>
              <tbody>
                {data.errors.map((row, index) => (
                  <tr key={`${row.event_name}-${row.reason}-${index}`}>
                    <td>{row.event_name === 'playback_error' ? text.playback : text.download}</td>
                    <td dir="ltr">{row.reason ?? text.unknownReason}</td>
                    <td>{row.count}</td>
                    <td>{row.families}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <header className="panel__header"><div><h3>{text.byDay}</h3></div></header>
        {data.daily.length === 0 ? <p className="panel__note">{text.noDays}</p> : (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.day}</th><th>{text.starts}</th><th>{text.errors}</th><th>{text.rate}</th></tr></thead>
              <tbody>
                {data.daily.map((row) => {
                  const total = Number(row.starts) + Number(row.errors)
                  return (
                    <tr key={row.day}>
                      <td dir="ltr">{row.day}</td>
                      <td>{row.starts}</td>
                      <td>{row.errors}</td>
                      <td>{total > 0 ? `${Math.round((Number(row.errors) / total) * 100)}%` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel panel--notice" role="note"><span>{text.note}</span></section>
    </div>
  )
}
