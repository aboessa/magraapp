import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { AnalyticsOverview, BillingStats, DashboardStats } from '../types/api'

/**
 * مركز المراقبة.
 *
 * ## ما كانت عليه — أسوأ نوع من الكذب
 *
 * كانت الصفحة تنادي `/admin/dashboard/stats` ثم **لا تقرأ النتيجة إطلاقًا**.
 * كل البطاقات الست قيم ثابتة مكتوبة في الكود:
 *
 *   Workers: OK · D1 p95: 12ms · Queue backlog: 0.4s
 *   DLQ: 0 · R2 uploads: OK · Cache hit: 94%
 *
 * كلها خضراء دائمًا بصرف النظر عن حالة النظام الحقيقية. و`.catch(() => setStats({}))`
 * يجعل `{}` قيمة صادقة فتُخفى شاشة التحميل وتُعرض «كل شيء سليم» حتى وقت
 * انقطاع الـAPI كاملًا. وسطر «Version 71d64770 • 2 د منذ» ثابت أيضًا.
 *
 * صفحة مراقبة تكذب أسوأ من عدم وجود صفحة مراقبة: تمنع اكتشاف العطل.
 *
 * ## ما صارت عليه
 *
 * لا تُعرض إلا أرقام مقروءة من الخادم فعلًا. المؤشرات التي لا يوفّرها الخادم
 * (زمن D1، تراكم الطوابير، نسبة الكاش) **حُذفت** ولم تُستبدل بقيم مخترعة، مع
 * ملاحظة صريحة أن قياسها يحتاج Analytics Engine وهو غير مُهيّأ بعد.
 */

const copy = {
  ar: {
    eyebrow: 'التشغيل',
    title: 'مركز المراقبة',
    lede: 'أرقام مقروءة من قاعدة البيانات مباشرة. لا يُعرض أي مؤشر لا يوفّره الخادم.',
    apiTitle: 'حالة الـAPI',
    apiReachable: 'الـAPI يستجيب',
    apiUnreachable: 'الـAPI لا يستجيب',
    contentTitle: 'المحتوى',
    series: 'السلاسل',
    publishedSeries: 'منشورة',
    episodes: 'الحلقات',
    publishedEpisodes: 'منشورة',
    familiesTitle: 'الحسابات',
    parents: 'أولياء أمور نشطون',
    children: 'ملفات أطفال نشطة',
    eventsTitle: 'معالجة الأحداث',
    processedEvents: 'أحداث مُعالَجة',
    lastEvent: 'آخر حدث',
    none: 'لا شيء',
    plansTitle: 'الاشتراكات النشطة',
    missingTitle: 'مؤشرات غير متاحة',
    missingHint: 'زمن استجابة D1، وتراكم الطوابير، وحجم الرسائل الميتة، ونسبة إصابة الكاش — كلها تحتاج Cloudflare Analytics Engine وهو غير مُهيّأ بعد. لم تُعرض بقيم تقديرية حتى لا تُقرأ كحقائق.',
    loadError: 'تعذر تحميل بيانات المراقبة',
  },
  en: {
    eyebrow: 'Operations',
    title: 'Monitoring',
    lede: 'Numbers read directly from the database. No metric is shown unless the server provides it.',
    apiTitle: 'API status',
    apiReachable: 'API is responding',
    apiUnreachable: 'API is not responding',
    contentTitle: 'Content',
    series: 'Series',
    publishedSeries: 'Published',
    episodes: 'Episodes',
    publishedEpisodes: 'Published',
    familiesTitle: 'Accounts',
    parents: 'Active parents',
    children: 'Active child profiles',
    eventsTitle: 'Event processing',
    processedEvents: 'Processed events',
    lastEvent: 'Last event',
    none: 'None',
    plansTitle: 'Active subscriptions',
    missingTitle: 'Unavailable metrics',
    missingHint: 'D1 latency, queue backlog, dead-letter depth and cache hit rate all require Cloudflare Analytics Engine, which is not configured yet. They are not shown as estimates so they cannot be mistaken for facts.',
    loadError: 'Unable to load monitoring data',
  },
}

export function OpsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [billing, setBilling] = useState<BillingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, analyticsRes, billingRes] = await Promise.all([
        api.dashboard(),
        api.analyticsOverview(),
        api.billingStats(),
      ])
      setStats(statsRes.data)
      setAnalytics(analyticsRes.data)
      setBilling(billingRes.data)
    } catch (caught) {
      // لا احتياطي: انقطاع الـAPI حقيقة تُعرض لا تُخفى
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error || !stats) {
    return (
      <div className="page-stack">
        <section className="page-intro">
          <div>
            <span className="eyebrow">{text.eyebrow}</span>
            <h2>{text.title}</h2>
          </div>
        </section>
        {/* انقطاع الـAPI هو ذاته أهم مؤشر مراقبة، فيُعرض بوضوح */}
        <section className="panel panel--notice" role="alert">
          <strong>{text.apiUnreachable}</strong>
        </section>
        <ErrorState message={error || text.loadError} onRetry={() => void load()} />
      </div>
    )
  }

  const totals = stats.totals
  const events = analytics?.recent_events ?? []
  const lastEvent = events.length ? events[0] : null

  const tiles: { label: string; value: string }[] = [
    { label: text.series, value: String(totals.total_series ?? 0) },
    { label: text.publishedSeries, value: String(totals.published_series ?? 0) },
    { label: text.episodes, value: String(totals.total_episodes ?? 0) },
    { label: text.publishedEpisodes, value: String(totals.published_episodes ?? 0) },
    { label: text.parents, value: String(totals.active_parents ?? 0) },
    { label: text.children, value: String(totals.active_children ?? 0) },
  ]

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      <section className="mode-current">
        <span className="mode-dot mode-dot--live" aria-hidden="true" />
        <strong>{text.apiReachable}</strong>
      </section>

      <section className="panel">
        <div className="panel__header"><h3>{text.contentTitle}</h3></div>
        <div className="stats-grid">
          {tiles.map((tile) => (
            <article className="stat-card" key={tile.label}>
              <div className="stat-card__top">
                <span>{tile.label}</span>
              </div>
              <strong className="stat-card__value" dir="ltr">{tile.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel__header">
            <h3>{text.eventsTitle}</h3>
            <span className="panel__kicker">
              {text.processedEvents}: {analytics?.total_plays ?? 0}
            </span>
          </div>
          <div className="entity-form">
            <dl className="detail-list">
              <div>
                <dt>{text.lastEvent}</dt>
                <dd dir="ltr">
                  {lastEvent
                    ? String((lastEvent as Record<string, unknown>).event_type ?? text.none)
                    : text.none}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header"><h3>{text.plansTitle}</h3></div>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <tbody>
                {(billing?.by_plan ?? []).map((row) => (
                  <tr key={row.plan}>
                    <td><span className={`plan-badge plan-badge--${row.plan}`}>{row.plan}</span></td>
                    <td dir="ltr">{row.count}</td>
                  </tr>
                ))}
                {!(billing?.by_plan ?? []).length ? (
                  <tr><td colSpan={2}><span className="table-secondary">{text.none}</span></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* المؤشرات المفقودة تُعلَن بدل أن تُخترع */}
      <section className="panel panel--notice">
        <strong>{text.missingTitle}</strong>
        <p>{text.missingHint}</p>
      </section>
    </div>
  )
}
