import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiRoot } from '../lib/api'
import type { DashboardStats } from '../types/api'
import { StatCard } from '../components/StatCard'
import { ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { formatNumber } from '../lib/labels'
import { adminPath } from '../lib/adminPath'
import { readAdminUser } from '../lib/adminSession'
import { usePreferences } from '../context/preferences'
import { DASHBOARD_VERSION, rangeToParams, type DashboardRange } from '../lib/dashboardRange'
import { HeroKpis } from '../components/HeroKpis'
import { DASHBOARD_EXPIRING_SOON_MS } from '../lib/constants.ts'
import { AnalyticsPanel, RevenuePanel } from '../components/dashboard/RevenuePanels'
import { AttentionPanels } from '../components/dashboard/AttentionPanels'
import { ExecutiveModules } from '../components/dashboard/ExecutiveModules'
import { ContentHealthPanels } from '../components/dashboard/ContentPanels'
import { FailedPanel, PlatformPanel, SearchPanel, TeamPanel, TimelinePanel, WebsitePanel } from '../components/dashboard/OperationalPanels'
import { AdvancedPanels } from '../components/dashboard/AdvancedPanels'
import { BulkOpsPanel as _BulkOpsPanel } from '../components/dashboard/BulkOpsPanel'
void _BulkOpsPanel

export { DASHBOARD_VERSION, rangeToParams, type DashboardRange }
export { ExecutiveModules } from '../components/dashboard/ExecutiveModules'

/// ثلاث قراءات، وكلٌّ منها تُميّز **الفشل** عن **الفراغ** (`ADM-203`).
///
/// ## ما كان
///
/// `api.contentReviews(...).catch(() => ({ data: [] }))` — وكذلك `tasks` و
/// `rights`. فقراءةٌ فاشلة تُشحَن قائمةً فارغة، والشاشة تعرض «لا توجد مراجعات
/// معلّقة حاليًا». وهي صورةُ `?? 0` في هيئة قائمة، وعلى **أوّل شاشة بعد الدخول**:
/// مشغّلٌ يقرأ «كل شيء تمام» على خادمٍ لم يُجب.
///
/// والنمط الصحيح قائمٌ في الملف المجاور: `HeroKpis` يعرض `'—'` عند الغياب ويضع
/// `overall_health: 'unknown'` لا `'healthy'`. هذا هو نفسه للقوائم: `null` تعني
/// «تعذّرت القراءة»، و`[]` تعني «لا شيء معلَّق».
async function loadOpsWidgets(actorId: string | null): Promise<OpsWidgets> {
  const FAILED = null
  const [reviews, tasks, rights] = await Promise.all([
    api.contentReviews({ status: 'pending', limit: 6 }).then((r) => r.data as any[]).catch(() => FAILED),
    // بلا فاعلٍ معروف لا مهامَّ **بالتعريف**، وهذه ليست قراءةً فاشلة: `[]` هي
    // الجواب الصادق، لا `null`.
    actorId ? api.tasks().then((r) => r.data as any[]).catch(() => FAILED) : Promise.resolve([] as any[]),
    api.rights().then((r) => r.data as any[]).catch(() => FAILED),
  ])
  const now = Date.now()
  const soon = now + DASHBOARD_EXPIRING_SOON_MS
  return {
    pendingReviews: reviews,
    myTasks: tasks === FAILED
      ? FAILED
      : tasks.filter((task: any) => task.status !== 'done' && (!actorId || task.assignee_id === actorId)).slice(0, 6),
    expiringRights: rights === FAILED
      ? FAILED
      : rights.filter((right: any) => {
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

/// `null` = تعذّرت القراءة · `[]` = لا شيء معلَّق. الفرق هو البند كلّه
/// (`ADM-203`)، فلا يجوز توحيدهما في `any[]` كما كان.
type OpsWidgets = {
  pendingReviews: any[] | null
  myTasks: any[] | null
  expiringRights: any[] | null
}
export function DashboardPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [data, setData] = useState<DashboardStats | null>(null)
  const [ops, setOps] = useState<OpsWidgets | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<DashboardRange>('all')
  const [showAdvanced, setShowAdvanced] = useState<boolean>(() => {
    try { return localStorage.getItem('majarra-dashboard-advanced') === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('majarra-dashboard-advanced', showAdvanced ? '1' : '0') } catch {}
  }, [showAdvanced])

  useEffect(() => {
    document.title = locale === 'ar' ? 'لوحة التحكم · مجرة' : 'Dashboard · Majarra'
  }, [locale])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.dashboard(rangeToParams(range))
      setData(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.unexpected)
    } finally {
      setLoading(false)
    }
    void loadOpsWidgets(readAdminUser()?.id ?? null).then(setOps)
  }, [text.unexpected, range])

  useEffect(() => { void load() }, [load])

  const [revDetail, setRevDetail] = useState<any>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [failedCount, setFailedCount] = useState<number|null>(null)
  const [failedList, setFailedList] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [attention, setAttention] = useState<{ blocked: any[]; atRisk: any[]; overdue: number|null }>({ blocked: [], atRisk: [], overdue: null })
  const [teamLoad, setTeamLoad] = useState<{ teams:number|null; overdueTasks:number|null; websitePages?:number|null }>({ teams:null, overdueTasks:null })
  const [teasers, setTeasers] = useState<{ cal7:number|null; transPending:number|null; transStale?:number|null; calDetail?:{total:number}; factoryRuns?:number|null }>({ cal7:null, transPending:null })
  useEffect(() => {
    const p = rangeToParams(range)
    try { void (api as any).revenueOverview?.(p.range)?.then((r:any)=>setRevDetail(r.data)).catch(()=>setRevDetail({_unavailable:true})) } catch { setRevDetail({_unavailable:true}) }
    try { void (api as any).analyticsOverview?.()?.then((r:any)=>setAnalytics(r.data)).catch(()=>setAnalytics(null)) } catch { setAnalytics(null) }
    try { void (api as any).failedFamilyEvents?.({ limit:1 } as any)?.then((r:any)=>setFailedCount(r.meta?.total ?? r.data?.length ?? null)).catch(()=>setFailedCount(null)) } catch { setFailedCount(null) }
    try { void (api as any).failedFamilyEvents?.({ limit:3 } as any)?.then((r:any)=>setFailedList(Array.isArray(r.data)? r.data.slice(0,3):[])).catch(()=>setFailedList([])) } catch { setFailedList([]) }
    try { void (api as any).opsTimeline?.(5)?.then((r:any)=>setTimeline(Array.isArray((r as any).data)? (r as any).data.slice(0,5):[])).catch(()=>setTimeline([])) } catch { setTimeline([]) }
    try { void (api as any).productionBoard?.({ limit:5 })?.then((r:any)=>setAttention(prev=>({ ...prev, blocked: r.data?.slice(0,5) ?? [] }))).catch(()=>{}) } catch {}
    try { void (api as any).customers?.({ limit:5 })?.then((r:any)=>setAttention(prev=>({ ...prev, atRisk: r.data?.slice(0,5) ?? [] }))).catch(()=>{}) } catch {}
    try { void (api as any).supportSla?.()?.then((r:any)=>setAttention(prev=>({ ...prev, overdue: r.data?.overdue ?? r.data?.breaches ?? null }))).catch(()=>{}) } catch {}
    try { void (api as any).teams?.()?.then((r:any)=>setTeamLoad(prev=>({ ...prev, teams: Array.isArray(r.data)? r.data.length : null }))).catch(()=>{}) } catch {}
    try { void (api as any).tasks?.()?.then((r:any)=>{ const arr = Array.isArray(r.data)? r.data:[]; const overdue = arr.filter((t:any)=> t.due_date && new Date(t.due_date) < new Date() && t.status!=='done').length; setTeamLoad(prev=>({ ...prev, overdueTasks: overdue })) }).catch(()=>{}) } catch {}
    try { void (api as any).workflowOverdue?.()?.then((r:any)=>setTeamLoad(prev=>({ ...prev, workflowOverdue: r.meta?.total ?? (Array.isArray(r.data)? r.data.length: null) } as any))).catch(()=>{}) } catch {}
    try { void (api as any).webPages?.({} as any)?.then((r:any)=>setTeamLoad(prev=>({ ...prev, websitePages: (r as any).meta?.total ?? (r as any).data?.length ?? null } as any))).catch(()=>{}) } catch {}
    try {
      const from = new Date().toISOString()
      const to = new Date(Date.now()+7*24*60*60*1000).toISOString()
      void (api as any).contentCalendar?.({ from, to })?.then((r:any)=>setTeasers(prev=>({ ...prev, cal7: r.data?.events?.length ?? r.data?.total_unfiltered ?? null }))).catch(()=>setTeasers(prev=>({ ...prev, cal7: null })))
    } catch {}
    try { void (api as any).translationQueue?.({ limit:1 })?.then((r:any)=>setTeasers(prev=>({ ...prev, transPending: r.meta?.total ?? (Array.isArray(r.data)? r.data.length:null) }))).catch(()=>{}) } catch {}
    try { void (api as any).translationQueue?.({ status:'stale', limit:1 } as any)?.then((r:any)=>setTeasers(prev=>({ ...prev, transStale: r.meta?.total ?? (Array.isArray(r.data)? r.data.length:0) } as any))).catch(()=>{}) } catch {}
    try { void (api as any).contentFactoryRuns?.({ limit:1 } as any)?.then((r:any)=>setTeasers(prev=>({ ...prev, factoryRuns: r.meta?.total ?? (Array.isArray(r.data)? r.data.length:0) } as any))).catch(()=>{}) } catch {}
    try {
      const calFrom = new Date().toISOString().slice(0,10)
      const calTo = new Date(Date.now()+30*24*60*60*1000).toISOString().slice(0,10)
      void (api as any).contentCalendar?.({ from: calFrom, to: calTo } as any)?.then((r:any)=>setTeasers(prev=>({ ...prev, calDetail: { total: r.data?.total_unfiltered ?? r.data?.events?.length ?? 0 } } as any))).catch(()=>{})
    } catch {}
  }, [range])

  const [focusMode, setFocusMode] = useState<'all' | 'content' | 'growth' | 'ops'>('all')

  if (loading && !data) return <LoadingState label={text.loading} />
  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return null

  const totals = data.totals

  return (
    <div className="page-stack" style={{ gap: 22 }}>
      {/* --- 1. Bento Header Banner --- */}
      <section className="bento-header">
        <div style={{ minWidth: 0, zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span className="eyebrow" style={{ color: 'var(--primary-strong)', fontWeight: 700, margin: 0 }}>
              {text.operations}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.28)', fontSize: 11, color: '#34d399', fontWeight: 600 }}>
              <span className="pulse-beacon" />
              {locale === 'ar' ? 'بيانات حية مباشرة من D1' : 'Live from D1 Database'}
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.03em', margin: 0, color: 'var(--text)' }}>
            {text.welcome}
          </h1>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)', maxWidth: 640, lineHeight: 1.5 }}>
            {text.liveData}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', zIndex: 1 }}>
          {/* Time Range Pills */}
          <div className="range-pill-group preset-tabs" role="tablist" aria-label="Range">
            {(['today','7d','30d','all'] as DashboardRange[]).map(v => {
              const label = v==='today' ? (locale==='ar'?'اليوم':'Today') : v==='7d' ? (locale==='ar'?'7 أيام':'7 days') : v==='30d' ? (locale==='ar'?'30 يومًا':'30 days') : (locale==='ar'?'الكل':'All')
              return (
                <button
                  key={v}
                  role="tab"
                  className="range-pill-btn"
                  aria-selected={range===v}
                  onClick={() => setRange(v)}
                  type="button"
                >
                  {label}
                </button>
              )
            })}
          </div>

          <button className="button button--secondary" type="button" onClick={() => void load()} disabled={loading} style={{ borderRadius: 12 }}>
            <Icon name="refresh" size={15} />
            {text.refresh}
          </button>
          <Link className="button button--primary" to={adminPath('series')} style={{ borderRadius: 12 }}>
            <Icon name="plus" size={15} />
            {text.newSeries}
          </Link>
        </div>
      </section>

      {/* --- 2. Smart Focus View Switcher --- */}
      <div className="focus-tabs-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`focus-tab-btn ${focusMode === 'all' ? 'active' : ''}`}
            onClick={() => setFocusMode('all')}
          >
            <span>🌟</span>
            <span>{locale === 'ar' ? 'عرض شامل (الكل)' : 'All Overview'}</span>
          </button>
          <button
            type="button"
            className={`focus-tab-btn ${focusMode === 'content' ? 'active' : ''}`}
            onClick={() => setFocusMode('content')}
          >
            <span>🎬</span>
            <span>{locale === 'ar' ? 'المحتوى والإنتاج' : 'Content & Production'}</span>
          </button>
          <button
            type="button"
            className={`focus-tab-btn ${focusMode === 'growth' ? 'active' : ''}`}
            onClick={() => setFocusMode('growth')}
          >
            <span>📈</span>
            <span>{locale === 'ar' ? 'الاشتراكات والنمو' : 'Growth & Revenue'}</span>
          </button>
          <button
            type="button"
            className={`focus-tab-btn ${focusMode === 'ops' ? 'active' : ''}`}
            onClick={() => setFocusMode('ops')}
          >
            <span>⚡</span>
            <span>{locale === 'ar' ? 'العمليات وصحة المنصة' : 'Ops & Health'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)' }}>
          <Icon name="clock" size={13} />
          <span>
            {range === 'all'
              ? (locale === 'ar' ? 'لقطة فورية' : 'Full Snapshot')
              : (locale === 'ar' ? `نطاق: ${range}` : `Range: ${range}`)}
          </span>
        </div>
      </div>

      {error && <div className="inline-alert inline-alert--error">{text.updateError} {error}</div>}

      {/* --- 3. Hero KPIs Grid --- */}
      <HeroKpis locale={locale} range={range} />

      {/* --- 4. Core Catalog & Audience Stats --- */}
      <section className="stats-grid kpi-bento-grid" aria-label={text.statsAria}>
        <StatCard label={text.totalSeries} value={formatNumber(totals.total_series, locale)} description={`${formatNumber(totals.published_series, locale)} ${text.publishedNow}`} icon="series" tone="blue" />
        <StatCard label={text.episodes} value={formatNumber(totals.total_episodes, locale)} description={`${formatNumber(totals.published_episodes, locale)} ${text.available}`} icon="episodes" tone="cyan" />
        <StatCard label={text.parents} value={formatNumber(totals.active_parents, locale)} description={text.activeAccounts} icon="parents" tone="yellow" />
        <StatCard label={text.children} value={formatNumber(totals.active_children, locale)} description={text.isolatedProfiles} icon="children" tone="purple" />
      </section>

      {/* --- 5. Executive Operational Modules --- */}
      <ExecutiveModules locale={locale} range={range} />

      {/* --- 6. Content & Production Bento Area --- */}
      {(focusMode === 'all' || focusMode === 'content') && (
        <>
          <section className="dashboard-grid dashboard-grid--tracks">
            <AttentionPanels attention={attention} ops={ops} locale={locale} />
          </section>
          <ContentHealthPanels data={data} locale={locale} />
        </>
      )}

      {/* --- 7. Growth & Revenue Bento Area --- */}
      {(focusMode === 'all' || focusMode === 'growth') && (
        <>
          <section className="dashboard-grid dashboard-grid--tracks">
            <RevenuePanel revDetail={revDetail} locale={locale} />
            <AnalyticsPanel analytics={analytics} failedCount={failedCount} locale={locale} />
          </section>
          <section className="dashboard-grid dashboard-grid--tracks">
            <WebsitePanel teamLoad={teamLoad} locale={locale} />
          </section>
        </>
      )}

      {/* --- 8. Operations & Platform Health Bento Area --- */}
      {(focusMode === 'all' || focusMode === 'ops') && (
        <>
          <section className="dashboard-grid dashboard-grid--activity">
            <TimelinePanel timeline={timeline} locale={locale} />
            <FailedPanel failedCount={failedCount} failedList={failedList} locale={locale} />
          </section>

          <section className="dashboard-grid dashboard-grid--tracks">
            <SearchPanel locale={locale} />
            <PlatformPanel failedCount={failedCount} locale={locale} />
          </section>

          <section className="dashboard-grid dashboard-grid--tracks">
            <TeamPanel teamLoad={teamLoad} locale={locale} />
            <article className="panel bento-card">
              <header className="panel__header">
                <div>
                  <span className="panel__kicker">Release Pipeline</span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{locale==='ar'?'إصدارات التطبيق':'App Releases'}</h3>
                </div>
                <Link className="text-link" to={adminPath('app-releases')} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600 }}>
                  Releases <Icon name="arrow" size={12} />
                </Link>
              </header>
              <div style={{ padding:'16px 18px', display:'grid', gap:10 }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', padding:'12px', border:'1px dashed rgba(255,255,255,0.08)', borderRadius:12, background:'var(--surface-2)' }}>
                  <Icon name="devices" size={18} />
                  <span style={{ fontSize:12.5, color:'var(--muted)' }}>
                    {locale==='ar'?'الإصدارات تُدار من /app-releases — تتبع إصدارات Android و iOS':'Releases managed at /app-releases — tracks Android & iOS'}
                  </span>
                </div>
                <small style={{ color:'var(--muted)', fontSize:11.5 }}>
                  Phase 27 — {locale==='ar'?'تتبع إصدار الأندرويد/iOS والحدّ الأدنى المدعوم':'Tracks Android/iOS versions & minimum supported'}
                </small>
              </div>
            </article>
          </section>
        </>
      )}

      {/* --- 9. Advanced Panels (Toggleable) --- */}
      {!showAdvanced ? (
        <button
          className="button button--secondary"
          type="button"
          onClick={() => setShowAdvanced(true)}
          style={{ alignSelf: 'center', borderRadius: 12, padding: '10px 20px', fontSize: 12.5 }}
        >
          <Icon name="arrow" size={13} />
          {locale === 'ar'
            ? 'عرض الأقسام المتقدّمة (تقويم النشر، الجودة، الترجمة، التسويق، القانوني)'
            : 'Show advanced modules (Calendar, Quality, Translation, Marketing, Legal)'}
        </button>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="button button--ghost button--small" type="button" onClick={() => setShowAdvanced(false)}>
              {locale === 'ar' ? 'إخفاء الأقسام المتقدّمة' : 'Hide advanced modules'}
            </button>
          </div>
          <AdvancedPanels teasers={teasers} locale={locale} />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="button button--ghost button--small" type="button" onClick={() => setShowAdvanced(false)}>
              {locale === 'ar' ? 'إخفاء الأقسام المتقدّمة' : 'Hide advanced modules'}
            </button>
          </div>
        </div>
      )}

      {/* --- 10. Quick Command & Export Hub --- */}
      <section className="quick-command-hub">
        <article className="panel bento-card">
          <header className="panel__header">
            <div>
              <span className="panel__kicker" style={{ color: 'var(--primary-strong)' }}>{locale==='ar'?'اختصارات الإدارة':'Shortcuts'}</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{locale==='ar'?'إجراءات سريعة':'Quick actions'}</h3>
            </div>
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--surface-3)', border: '1px solid var(--line)', color: 'var(--muted)', fontWeight: 700 }}>
              Ctrl + K
            </span>
          </header>
          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <Link className="quick-action-tile" to={adminPath('series')}>
              <Icon name="plus" size={15} />
              <span>{locale==='ar'?'سلسلة جديدة':'New series'}</span>
            </Link>
            <Link className="quick-action-tile" to={adminPath('stories')}>
              <Icon name="books" size={15} />
              <span>{locale==='ar'?'قصة جديدة':'New story'}</span>
            </Link>
            <Link className="quick-action-tile" to={adminPath('content-reviews')}>
              <Icon name="reviews" size={15} />
              <span>{locale==='ar'?'مركز المراجعات':'Reviews hub'}</span>
            </Link>
            <Link className="quick-action-tile" to={adminPath('production')}>
              <Icon name="episodes" size={15} />
              <span>{locale==='ar'?'لوحة الإنتاج':'Production board'}</span>
            </Link>
          </div>
        </article>

        <article className="panel bento-card">
          <header className="panel__header">
            <div>
              <span className="panel__kicker" style={{ color: 'var(--cyan)' }}>{locale==='ar'?'التقارير المعتمدة':'Exports'}</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{locale==='ar'?'تصدير البيانات':'Export reports'}</h3>
            </div>
          </header>
          <div style={{ padding: '16px 18px', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <a className="button button--ghost button--small" style={{ borderRadius: 10 }} href={`${apiRoot}/admin/production/board?format=csv`} target="_blank" rel="noreferrer">
                <Icon name="upload" size={13} /> {locale==='ar'?'الإنتاج CSV':'Production CSV'}
              </a>
              <a className="button button--ghost button--small" style={{ borderRadius: 10 }} href={`${apiRoot}/admin/rights?format=csv`} target="_blank" rel="noreferrer">
                <Icon name="rights" size={13} /> Rights CSV
              </a>
              <Link className="button button--ghost button--small" style={{ borderRadius: 10 }} to={adminPath('revenue')}>
                <Icon name="analytics" size={13} /> {locale==='ar'?'المالية':'Revenue'}
              </Link>
              <Link className="button button--ghost button--small" style={{ borderRadius: 10 }} to={adminPath('ops')}>
                <Icon name="devices" size={13} /> Ops
              </Link>
            </div>
            <small style={{ color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.4 }}>
              {locale==='ar'?'جميع عمليات التصدير تحترم الصلاحيات المشفرة وتمنع كشف بيانات الأطفال':'Exports respect permissions and strictly isolate child data'}
            </small>
          </div>
        </article>
      </section>

      {/* --- 11. Bento Footer --- */}
      <footer className="panel bento-card" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong>Majarra Dashboard</strong> v{DASHBOARD_VERSION} · {new Date().toISOString().slice(0,10)} · <code style={{ fontSize: 11, background: 'var(--surface)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line)' }}>{readAdminUser()?.email || 'aboessa101@gmail.com'}</code>
          {data?.generated_at && <span>· {locale === 'ar' ? 'حُدثت في' : 'Updated at'} {new Date(data.generated_at).toLocaleTimeString(locale==='ar'?'ar':'en-GB')}</span>}
        </span>
        <button className="button button--ghost button--small" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span style={{ transform: 'rotate(-90deg)', display: 'inline-block' }}><Icon name="arrow" size={12} /></span>
          {locale==='ar'?'للأعلى':'Top'}
        </button>
      </footer>
    </div>
  )
}

