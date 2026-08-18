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

async function loadOpsWidgets(actorId: string | null) {
  const [reviews, tasks, rights] = await Promise.all([
    api.contentReviews({ status: 'pending', limit: 6 }).catch(() => ({ data: [] as any })),
    actorId ? api.tasks().catch(() => ({ data: [] as any })) : Promise.resolve({ data: [] as any }),
    api.rights().catch(() => ({ data: [] as any })),
  ])
  const now = Date.now()
  const soon = now + 30 * 24 * 60 * 60 * 1000
  return {
    pendingReviews: reviews.data,
    myTasks: tasks.data.filter((task: any) => task.status !== 'done' && (!actorId || task.assignee_id === actorId)).slice(0, 6),
    expiringRights: rights.data.filter((right: any) => {
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

type OpsWidgets = { pendingReviews: any[]; myTasks: any[]; expiringRights: any[] }
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

  if (loading && !data) return <LoadingState label={text.loading} />
  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return null

  const totals = data.totals

  return (
    <div className="page-stack" style={{ gap: 20 }}>
      <section className="page-intro" style={{ alignItems: 'flex-start', paddingBottom: 4 }}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            {text.operations}
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 9px', borderRadius:999, background:'var(--surface-3)', border:'1px solid var(--line)', fontSize:10.5, color:'var(--muted)', letterSpacing:0, textTransform:'none', fontWeight:600 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', display:'inline-block' }} /> {locale==='ar' ? 'مباشر من قاعدة البيانات' : 'Live from database'}
            </span>
          </span>
          <h2 style={{ fontSize:24, letterSpacing:'-.03em', marginTop:6 }}>{text.welcome}</h2>
          <p style={{ marginTop:6, fontSize:12.5, maxWidth:620 }}>{text.liveData}</p>
        </div>
        <div className="page-intro__actions" style={{ flexWrap:'wrap' }}>
          <button className="button button--secondary" type="button" onClick={() => void load()} disabled={loading}><Icon name="refresh" size={15} />{text.refresh}</button>
          <Link className="button button--primary" to={adminPath('series')}><Icon name="plus" size={15} />{text.newSeries}</Link>
        </div>
      </section>

      <section className="panel" style={{ padding:'10px 12px', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div className="preset-tabs" role="tablist" aria-label="Range">
          {(['today','7d','30d','all'] as DashboardRange[]).map(v=>{
            const label = v==='today' ? (locale==='ar'?'اليوم':'Today') : v==='7d' ? (locale==='ar'?'7 أيام':'7 days') : v==='30d' ? (locale==='ar'?'30 يومًا':'30 days') : (locale==='ar'?'الكل':'All')
            return <button key={v} role="tab" aria-selected={range===v} onClick={()=>setRange(v)} type="button">{label}</button>
          })}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'var(--muted)' }}>
          <Icon name="clock" size={13} />
          <span>{range==='all' ? (locale==='ar'?'لقطة حالية من قاعدة البيانات':'Snapshot from database') : (locale==='ar'?`نطاق ${range} — يُمرَّر إلى /admin/revenue/overview و /admin/dashboard/executive`:`Range ${range} — sent to /admin/revenue/overview & /admin/dashboard/executive`)}</span>
        </div>
      </section>

      <HeroKpis locale={locale} range={range} />

      {error && <div className="inline-alert inline-alert--error">{text.updateError} {error}</div>}

      <ExecutiveModules locale={locale} range={range} />

      <section className="stats-grid" aria-label={text.statsAria}>
        <StatCard label={text.totalSeries} value={formatNumber(totals.total_series, locale)} description={`${formatNumber(totals.published_series, locale)} ${text.publishedNow}`} icon="series" tone="blue" />
        <StatCard label={text.episodes} value={formatNumber(totals.total_episodes, locale)} description={`${formatNumber(totals.published_episodes, locale)} ${text.available}`} icon="episodes" tone="cyan" />
        <StatCard label={text.parents} value={formatNumber(totals.active_parents, locale)} description={text.activeAccounts} icon="parents" tone="yellow" />
        <StatCard label={text.children} value={formatNumber(totals.active_children, locale)} description={text.isolatedProfiles} icon="children" tone="purple" />
      </section>

      <section className="dashboard-grid dashboard-grid--tracks">
        <RevenuePanel revDetail={revDetail} locale={locale} />
        <AnalyticsPanel analytics={analytics} failedCount={failedCount} locale={locale} />
      </section>

      <section className="dashboard-grid dashboard-grid--tracks">
        <AttentionPanels attention={attention} ops={ops} locale={locale} />
      </section>

      <ContentHealthPanels data={data} locale={locale} />

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
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">Release</span><h3>{locale==='ar'?'الإصدارات':'Releases'}</h3></div><Link className="text-link" to={adminPath('app-releases')}>Releases <Icon name="arrow" size={12} /></Link></header>
          <div style={{ padding:'14px 16px', display:'grid', gap:8 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', padding:'10px', border:'1px dashed var(--line)', borderRadius:10, background:'var(--surface-3)' }}>
              <Icon name="devices" size={16} />
              <span style={{ fontSize:12, color:'var(--muted)' }}>{locale==='ar'?'الإصدارات تُدار من /app-releases — لا تكامل متجر خارجي حتى الآن':'Releases managed at /app-releases — no external store integration yet'}</span>
            </div>
            <small style={{ color:'var(--muted)', fontSize:11 }}>Phase 27 — {locale==='ar'?'تتبع إصدار الأندرويد/iOS والحدّ الأدنى':'Tracks Android/iOS versions & minimum supported'}</small>
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--tracks">
        <WebsitePanel teamLoad={teamLoad} locale={locale} />
      </section>

      {!showAdvanced ? (
        <button className="button button--secondary" type="button" onClick={()=>setShowAdvanced(true)} style={{ alignSelf:'center' }}>
          <Icon name="arrow" size={12} /> {locale==='ar'?'عرض الأقسام المتقدّمة — تقويم 7 أيام، جودة، ترجمة، تسويق، أداء، قانوني':'Show advanced — Calendar, Quality, Translation, Marketing, Performance, Legal'} ({locale==='ar'?'مطوي':'collapsed'})
        </button>
      ) : (
        <>
        <button className="button button--ghost button--small" type="button" onClick={()=>setShowAdvanced(false)} style={{ alignSelf:'center' }}>
          {locale==='ar'?'إخفاء المتقدّم — إبقاء الأساسي فقط':'Hide advanced — keep essentials only'}
        </button>

      <AdvancedPanels teasers={teasers} locale={locale} />
        <button className="button button--ghost button--small" type="button" onClick={()=>setShowAdvanced(false)} style={{ alignSelf:'center' }}>
          {locale==='ar'?'إخفاء المتقدّم':'Hide advanced'}
        </button>
        </>
      )}

      <section className="dashboard-grid dashboard-grid--tracks">
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'اختصارات':'Quick actions'}</span><h3>{locale==='ar'?'إجراءات سريعة':'Quick actions'}</h3></div><span style={{ fontSize:11, color:'var(--muted)' }}>Ctrl+K</span></header>
          <div style={{ padding:'12px 14px', display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
            <Link className="button button--secondary" to={adminPath('series')} style={{ justifyContent:'flex-start' }}><Icon name="plus" size={14} />{locale==='ar'?'سلسلة جديدة':'New series'}</Link>
            <Link className="button button--secondary" to={adminPath('stories')} style={{ justifyContent:'flex-start' }}><Icon name="books" size={14} />{locale==='ar'?'قصة جديدة':'New story'}</Link>
            <Link className="button button--secondary" to={adminPath('content-reviews')} style={{ justifyContent:'flex-start' }}><Icon name="reviews" size={14} />{locale==='ar'?'المراجعات':'Reviews'}</Link>
            <Link className="button button--secondary" to={adminPath('production')} style={{ justifyContent:'flex-start' }}><Icon name="episodes" size={14} />{locale==='ar'?'مركز الإنتاج':'Production'}</Link>
          </div>
        </article>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'التقارير':'Exports'}</span><h3>{locale==='ar'?'تصدير التقارير':'Export reports'}</h3></div></header>
          <div style={{ padding:'12px 14px', display:'grid', gap:8 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              <a className="button button--ghost button--small" href={`${apiRoot}/admin/production/board?format=csv`} target="_blank" rel="noreferrer"><Icon name="upload" size={12} /> {locale==='ar'?'الإنتاج CSV':'Production CSV'}</a>
              <a className="button button--ghost button--small" href={`${apiRoot}/admin/rights?format=csv`} target="_blank" rel="noreferrer"><Icon name="rights" size={12} /> Rights CSV</a>
              <Link className="button button--ghost button--small" to={adminPath('revenue')}><Icon name="analytics" size={12} /> {locale==='ar'?'المالية':'Revenue'}</Link>
              <Link className="button button--ghost button--small" to={adminPath('ops')}><Icon name="devices" size={12} /> Ops</Link>
            </div>
            <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'التصدير يحترم الصلاحيات ولا يكشف بيانات الأطفال':'Exports respect permissions and never expose child private data'}</small>
          </div>
        </article>
      </section>

      <footer className="panel" style={{ padding:'12px 16px', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:10, background:'var(--surface-3)' }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>
          Dashboard v{DASHBOARD_VERSION} · {new Date().toISOString().slice(0,10)} · <code style={{ fontSize:11, background:'var(--surface)', padding:'2px 6px', borderRadius:6, border:'1px solid var(--line)' }}>majarra-dashboard@{locale}</code>
          {data?.generated_at && <> · generated {new Date(data.generated_at).toLocaleTimeString(locale==='ar'?'ar':'en-GB')}</>}
        </span>
        <button className="button button--ghost button--small" type="button" onClick={()=>window.scrollTo({top:0, behavior:'smooth'})}><span style={{ transform:'rotate(-90deg)', display:'inline-block' }}><Icon name="arrow" size={12} /></span> {locale==='ar'?'للأعلى':'Top'}</button>
      </footer>
    </div>
  )
}
