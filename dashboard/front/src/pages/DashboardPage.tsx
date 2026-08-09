import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { ContentReviewRecord, DashboardStats, RightsLicenseRecord, TaskRecord } from '../types/api'
import { StatCard } from '../components/StatCard'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate, formatNumber, planLabels, trackLabels } from '../lib/labels'
import { adminPath } from '../lib/adminPath'
import { readAdminUser } from '../lib/adminSession'
import { usePreferences } from '../context/preferences'

/**
 * ويدجتات العمليات الإضافية (UX-20 «مركز قيادة الأعمال» في DASHBOARD v3).
 *
 * لا يوجد في الخادم مسار واحد يجمع هذه الأرقام، فتُجلب من نفس المسارات التي
 * تستخدمها صفحاتها المخصّصة (content-reviews, tasks, rights, failed-family-
 * events) بدل إضافة مسار مجمّع جديد لهذا العرض فقط. لا KPI بفترة زمنية
 * (اليوم/٧ أيام/٣٠ يومًا) لأن /admin/dashboard/stats لا يدعم نطاقات تاريخ
 * فعليًا بعد — إضافة مبدّل لا يُغيّر شيئًا نوع من التضليل تحديدًا ما تحذّر
 * منه UX-44، فتُرك خارج هذا الإصدار حتى يُضاف الدعم الحقيقي في الخادم.
 */
type OpsWidgets = {
  pendingReviews: ContentReviewRecord[]
  myTasks: TaskRecord[]
  expiringRights: RightsLicenseRecord[]
}

async function loadOpsWidgets(actorId: string | null): Promise<OpsWidgets> {
  const [reviews, tasks, rights] = await Promise.all([
    api.contentReviews({ status: 'pending', limit: 6 }).catch(() => ({ data: [] as ContentReviewRecord[] })),
    actorId ? api.tasks().catch(() => ({ data: [] as TaskRecord[] })) : Promise.resolve({ data: [] as TaskRecord[] }),
    api.rights().catch(() => ({ data: [] as RightsLicenseRecord[] })),
  ])
  const now = Date.now()
  const soon = now + 30 * 24 * 60 * 60 * 1000
  return {
    pendingReviews: reviews.data,
    myTasks: tasks.data.filter((task) => task.status !== 'done' && (!actorId || task.assignee_id === actorId)).slice(0, 6),
    expiringRights: rights.data.filter((right) => {
      if (!right.expiry_date) return false
      const expiry = new Date(right.expiry_date).getTime()
      return Number.isFinite(expiry) && expiry >= now && expiry <= soon
    }),
  }
}

const copy = {
  ar: {
    loading: 'جارٍ تجهيز لوحة التحكم...', unexpected: 'حدث خطأ غير متوقع', operations: 'مركز العمليات',
    welcome: 'مرحبًا بك في لوحة مجرة', liveData: 'أرقام المحتوى والحسابات أدناه مقروءة مباشرة من قاعدة البيانات.',
    refresh: 'تحديث', newSeries: 'سلسلة جديدة', updateError: 'تعذر تحديث بعض البيانات:', statsAria: 'الإحصاءات الرئيسية',
    totalSeries: 'إجمالي السلاسل', publishedNow: 'منشورة حاليًا', episodes: 'الحلقات والوحدات', available: 'متاحة للمشاهدة',
    parents: 'أولياء الأمور', activeAccounts: 'حسابات نشطة فقط', children: 'ملفات الأطفال', isolatedProfiles: 'ملفات نشطة ومعزولة',
    launchCoverage: 'تغطية الإطلاق', byTrack: 'السلاسل حسب المسار', total: 'الإجمالي', seriesUnit: 'سلاسل',
    workflow: 'سير الإنتاج', seriesStatuses: 'حالات السلاسل', noStatuses: 'لا توجد حالات بعد', noStatusesDesc: 'ستظهر مراحل الإنتاج عند إضافة السلاسل.',
    latestUpdate: 'آخر تحديث', recentSeries: 'السلاسل الأخيرة', viewAll: 'عرض الكل', series: 'السلسلة', planet: 'الكوكب', age: 'العمر', episodeCount: 'الحلقات', status: 'الحالة',
    noSeries: 'لا توجد سلاسل', noSeriesDesc: 'ابدأ بإضافة أول سلسلة إلى كتالوج المحتوى.', addSeries: 'إضافة سلسلة',
    audit: 'سجل الإدارة', latestActivity: 'آخر النشاطات', noActivity: 'لا يوجد نشاط مسجل', noActivityDesc: 'ستظهر هنا عمليات الإنشاء والتعديل والأرشفة الفعلية.',
    create: 'إضافة', archive: 'أرشفة', update: 'تحديث', seriesEntity: 'سلسلة', episodeEntity: 'حلقة', childEntity: 'ملف طفل',
    families: 'العائلات', accountsByPlan: 'الحسابات حسب الباقة', admin: 'admin', percent: '٪',
    contentOps: 'عمليات المحتوى', pendingReviews: 'مراجعات معلّقة', noPendingReviews: 'لا توجد مراجعات معلّقة حاليًا',
    myTasks: 'مهامي', noMyTasks: 'لا توجد مهام مسنَدة إليك حاليًا', viewTasks: 'عرض كل المهام',
    rightsExpiring: 'حقوق تنتهي خلال ٣٠ يومًا', noRightsExpiring: 'لا توجد تراخيح تنتهي قريبًا', viewRights: 'عرض الحقوق',
    viewReviews: 'عرض كل المراجعات', due: 'الاستحقاق', noDue: 'بلا موعد', expiresOn: 'ينتهي',
  },
  en: {
    loading: 'Preparing the dashboard...', unexpected: 'An unexpected error occurred', operations: 'Operations center',
    welcome: 'Welcome to the Majarra dashboard', liveData: 'The content and account figures below are read directly from the database.',
    refresh: 'Refresh', newSeries: 'New series', updateError: 'Some data could not be refreshed:', statsAria: 'Primary statistics',
    totalSeries: 'Total series', publishedNow: 'currently published', episodes: 'Episodes & units', available: 'available to watch',
    parents: 'Parents', activeAccounts: 'Active accounts only', children: 'Child profiles', isolatedProfiles: 'Active, isolated profiles',
    launchCoverage: 'Launch coverage', byTrack: 'Series by age track', total: 'Total', seriesUnit: 'series',
    workflow: 'Production workflow', seriesStatuses: 'Series statuses', noStatuses: 'No statuses yet', noStatusesDesc: 'Production stages will appear after series are added.',
    latestUpdate: 'Latest update', recentSeries: 'Recent series', viewAll: 'View all', series: 'Series', planet: 'Planet', age: 'Age', episodeCount: 'Episodes', status: 'Status',
    noSeries: 'No series', noSeriesDesc: 'Start by adding the first series to the content catalog.', addSeries: 'Add series',
    audit: 'Admin audit', latestActivity: 'Recent activity', noActivity: 'No recorded activity', noActivityDesc: 'Actual create, update, and archive operations will appear here.',
    create: 'Created', archive: 'Archived', update: 'Updated', seriesEntity: 'series', episodeEntity: 'episode', childEntity: 'child profile',
    families: 'Families', accountsByPlan: 'Accounts by plan', admin: 'admin', percent: '%',
    contentOps: 'Content operations', pendingReviews: 'Pending reviews', noPendingReviews: 'No pending reviews right now',
    myTasks: 'My tasks', noMyTasks: 'No tasks assigned to you right now', viewTasks: 'View all tasks',
    rightsExpiring: 'Rights expiring within 30 days', noRightsExpiring: 'No rights expiring soon', viewRights: 'View rights',
    viewReviews: 'View all reviews', due: 'Due', noDue: 'No due date', expiresOn: 'Expires',
  },
}

export function DashboardPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [data, setData] = useState<DashboardStats | null>(null)
  const [ops, setOps] = useState<OpsWidgets | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.dashboard()
      setData(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.unexpected)
    } finally {
      setLoading(false)
    }
    // ويدجتات العمليات لا تُوقف تحميل اللوحة الرئيسية إن فشلت: كل مصدر منها
    // معالج بأمان (catch يعيد مصفوفة فارغة) داخل loadOpsWidgets.
    void loadOpsWidgets(readAdminUser()?.id ?? null).then(setOps)
  }, [text.unexpected])

  useEffect(() => { void load() }, [load])

  if (loading && !data) return <LoadingState label={text.loading} />
  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return null

  const totals = data.totals
  const trackTotal = Object.values(data.series_by_track).reduce((sum, count) => sum + Number(count), 0)
  const actionLabel = (action: string) => action === 'create' ? text.create : action === 'archive' ? text.archive : text.update
  const entityLabel = (entity: string) => entity === 'series' ? text.seriesEntity : entity === 'episode' ? text.episodeEntity : text.childEntity

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">{text.operations}</span><h2>{text.welcome}</h2><p>{text.liveData}</p></div>
        <div className="page-intro__actions">
          <button className="button button--secondary" type="button" onClick={() => void load()} disabled={loading}><Icon name="refresh" size={17} />{text.refresh}</button>
          <Link className="button button--primary" to={adminPath('series')}><Icon name="plus" size={17} />{text.newSeries}</Link>
        </div>
      </section>

      {error && <div className="inline-alert inline-alert--error">{text.updateError} {error}</div>}

      <section className="stats-grid" aria-label={text.statsAria}>
        <StatCard label={text.totalSeries} value={formatNumber(totals.total_series, locale)} description={`${formatNumber(totals.published_series, locale)} ${text.publishedNow}`} icon="series" tone="blue" />
        <StatCard label={text.episodes} value={formatNumber(totals.total_episodes, locale)} description={`${formatNumber(totals.published_episodes, locale)} ${text.available}`} icon="episodes" tone="cyan" />
        <StatCard label={text.parents} value={formatNumber(totals.active_parents, locale)} description={text.activeAccounts} icon="parents" tone="yellow" />
        <StatCard label={text.children} value={formatNumber(totals.active_children, locale)} description={text.isolatedProfiles} icon="children" tone="purple" />
      </section>

      <section className="dashboard-grid dashboard-grid--tracks">
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{text.launchCoverage}</span><h3>{text.byTrack}</h3></div><span className="data-note">{text.total} {formatNumber(trackTotal, locale)}</span></header>
          <div className="track-distribution">
            {(['preschool', 'kids', 'junior'] as const).map((track) => {
              const count = Number(data.series_by_track[track] ?? 0)
              const percentage = trackTotal ? Math.round((count / trackTotal) * 100) : 0
              return <div className={`track-row track-row--${track}`} key={track}><div className="track-row__label"><span className="track-dot"/><div><strong>{trackLabels[locale][track]}</strong><small>{formatNumber(count, locale)} {text.seriesUnit}</small></div></div><div className="track-progress"><span style={{ width: `${percentage}%` }} /></div><b>{formatNumber(percentage, locale)}{text.percent}</b></div>
            })}
          </div>
        </article>

        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{text.workflow}</span><h3>{text.seriesStatuses}</h3></div></header>
          {data.series_by_status.length ? <div className="status-summary">{data.series_by_status.map((row) => row.status && <div key={row.status}><StatusBadge status={row.status} /><strong>{formatNumber(Number(row.count), locale)}</strong></div>)}</div> : <EmptyState title={text.noStatuses} description={text.noStatusesDesc} />}
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--activity">
        <article className="panel panel--table">
          <header className="panel__header"><div><span className="panel__kicker">{text.latestUpdate}</span><h3>{text.recentSeries}</h3></div><Link className="text-link" to={adminPath('series')}>{text.viewAll} <Icon name="arrow" size={15} /></Link></header>
          {data.recent_series.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>{text.series}</th><th>{text.planet}</th><th>{text.age}</th><th>{text.episodeCount}</th><th>{text.status}</th></tr></thead><tbody>{data.recent_series.map((series) => { const title = locale === 'en' ? series.title_en || series.title_ar : series.title_ar; return <tr key={series.id}><td><div className="entity-cell"><span className="entity-avatar" style={{ background: series.planet_color || undefined }}>{title.charAt(0)}</span><div><strong>{title}</strong><small>{series.slug}</small></div></div></td><td>{series.planet_name || '—'}</td><td>{formatNumber(series.age_min, locale)}–{formatNumber(series.age_max, locale)}</td><td>{formatNumber(Number(series.episodes_count ?? 0), locale)}</td><td><StatusBadge status={series.status} /></td></tr> })}</tbody></table></div> : <EmptyState title={text.noSeries} description={text.noSeriesDesc} action={<Link className="button button--primary" to={adminPath('series')}><Icon name="plus" size={17} />{text.addSeries}</Link>} />}
        </article>

        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{text.audit}</span><h3>{text.latestActivity}</h3></div></header>
          {data.recent_activity.length ? <div className="activity-list">{data.recent_activity.map((item) => <div className="activity-item" key={item.id}><span className="activity-item__icon"><Icon name={item.action === 'create' ? 'plus' : item.action === 'archive' ? 'archive' : 'edit'} size={17} /></span><div><strong>{actionLabel(item.action)} {entityLabel(item.entity_type)}</strong><small>{item.actor_id || text.admin} • {formatDate(item.created_at, locale, true)}</small></div></div>)}</div> : <EmptyState title={text.noActivity} description={text.noActivityDesc} />}
        </article>
      </section>

      {data.parents_by_plan.length > 0 && <section className="panel compact-panel"><header className="panel__header"><div><span className="panel__kicker">{text.families}</span><h3>{text.accountsByPlan}</h3></div></header><div className="plan-chips">{data.parents_by_plan.map((row) => row.plan && <span key={row.plan}><b>{formatNumber(Number(row.count), locale)}</b>{planLabels[locale][row.plan]}</span>)}</div></section>}

      {ops && (
        <section className="dashboard-grid dashboard-grid--activity">
          <article className="panel">
            <header className="panel__header"><div><span className="panel__kicker">{text.contentOps}</span><h3>{text.pendingReviews}</h3></div><Link className="text-link" to={adminPath('content-reviews')}>{text.viewReviews} <Icon name="arrow" size={15} /></Link></header>
            {ops.pendingReviews.length ? (
              <div className="activity-list">
                {ops.pendingReviews.map((review) => (
                  <div className="activity-item" key={review.id}>
                    <span className="activity-item__icon"><Icon name="reviews" size={17} /></span>
                    <div><strong>{review.entity_type} · {review.reviewer_role}</strong><small>{formatDate(review.created_at, locale, true)}</small></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title={text.noPendingReviews} description="" />}
          </article>

          <article className="panel">
            <header className="panel__header"><div><span className="panel__kicker">{text.operations}</span><h3>{text.myTasks}</h3></div><Link className="text-link" to={adminPath('tasks')}>{text.viewTasks} <Icon name="arrow" size={15} /></Link></header>
            {ops.myTasks.length ? (
              <div className="activity-list">
                {ops.myTasks.map((task) => (
                  <div className="activity-item" key={task.id}>
                    <span className="activity-item__icon"><Icon name="reviews" size={17} /></span>
                    <div><strong>{task.title_ar}</strong><small>{task.due_date ? `${text.due}: ${formatDate(task.due_date, locale)}` : text.noDue}</small></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title={text.noMyTasks} description="" />}
          </article>
        </section>
      )}

      {ops && ops.expiringRights.length > 0 && (
        <section className="panel compact-panel">
          <header className="panel__header"><div><span className="panel__kicker">{text.families}</span><h3>{text.rightsExpiring}</h3></div><Link className="text-link" to={adminPath('rights')}>{text.viewRights} <Icon name="arrow" size={15} /></Link></header>
          <div className="badge-list" style={{ flexWrap: 'wrap', gap: 8, padding: '0 18px 18px' }}>
            {ops.expiringRights.map((right) => (
              <span className="track-badge" key={right.id}>{right.series_title || right.content_id} · {text.expiresOn} {right.expiry_date ? formatDate(right.expiry_date, locale) : '—'}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
