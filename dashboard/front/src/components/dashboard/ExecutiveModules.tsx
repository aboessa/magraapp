import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { adminPath } from '../../lib/adminPath'
import { orderModules, readPreset, writePreset } from '../../lib/dashboardPresets'
import type { DashboardPreset } from '../../lib/dashboardPresets'
import type { ExecutiveOverview } from '../../types/api'
import { formatNumber } from '../../lib/labels'
import { Icon } from '../Icon'
import { LoadingState } from '../PageState'
import { rangeToParams, type DashboardRange } from '../../lib/dashboardRange'

export function ExecutiveModules({ locale, range = 'all' }: { locale: 'ar' | 'en'; range?: DashboardRange }) {
  const [overview, setOverview] = useState<ExecutiveOverview | null>(null)
  const [preset, setPreset] = useState<DashboardPreset>(() => readPreset())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.executiveOverview(rangeToParams(range))
      setOverview(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'executive_overview_failed')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    try { void (api as any).opsAlerts?.({ limit: 4 } as any)?.then((r:any)=> setAlerts(Array.isArray(r.data)? r.data.slice(0,4):[])).catch(()=>{}) } catch {}
  }, [])

  const text = locale === 'ar'
    ? { title: 'الوحدات التشغيلية', lede: 'كل رقم من قاعدة البيانات، وكل رقم يفتح الشاشة المفلترة على نفس المجموعة.', limits: 'ما لا تستطيع هذه اللوحة قوله', generated: 'محدَّثة في', retry: 'إعادة المحاولة', failed: 'تعذر تحميل الوحدات التشغيلية', source: 'المصدر', layout: 'الترتيب', more: 'وحدات أخرى', unavailable: 'غير متاح', localPreset: 'الترتيب تفضيل في هذا المتصفح، ولا يُشارك مع الفريق.', live: 'مباشر', presets: { executive: 'تنفيذي', content: 'مدير محتوى', production: 'مدير إنتاج', support: 'مدير دعم', marketing: 'تسويق و SEO', tech: 'تشغيل تقني', all: 'الكل' } as Record<DashboardPreset, string> }
    : { title: 'Operational modules', lede: 'Every number comes from the database, and every number opens the screen filtered to the same set.', limits: 'What this dashboard cannot say', generated: 'Updated', retry: 'Try again', failed: 'Unable to load the operational modules', source: 'Source', layout: 'View', more: 'More modules', unavailable: 'Unavailable', localPreset: 'Layout is a local browser preference and is not shared with the team.', live: 'Live', presets: { executive: 'Executive', content: 'Content', production: 'Production', support: 'Support', marketing: 'Marketing', tech: 'Engineering', all: 'All' } as Record<DashboardPreset, string> }

  if (loading && !overview) return <LoadingState />
  if (error && !overview) {
    return (
      <section className="panel panel--notice">
        <strong>{text.failed}</strong>
        <p>{error}</p>
        <button className="button button--secondary" type="button" onClick={() => void load()}>
          <Icon name="refresh" size={15} />{text.retry}
        </button>
      </section>
    )
  }
  if (!overview) return null

  const { primary, secondary } = orderModules(overview.modules, preset)

  const moduleIcon = (key: string): any => {
    const m: Record<string,string> = {
      catalogue: 'series', customers: 'parents', support: 'reviews',
      production: 'episodes', rights: 'rights', platform: 'devices',
      devices: 'devices', workflow: 'timeline', website: 'website',
      blog: 'blog', seo: 'seo', analytics: 'analytics'
    }
    return m[key] ?? 'dashboard'
  }

  return (
    <>
      <section className="page-intro page-intro--sub" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            {text.title}
            <span className="exec-head__live"><i />{text.live}</span>
          </span>
          <p style={{ marginTop: 6 }}>{text.lede}</p>
          <span className="data-note" dir="ltr" style={{ display:'inline-flex', marginTop:8, fontSize:11 }}>
            {text.generated} · {new Date(overview.generated_at).toLocaleString(locale === 'ar' ? 'ar' : 'en-GB')}
          </span>
        </div>
        <div className="exec-head" style={{ flexDirection:'column', alignItems:'flex-end', gap:8 }}>
          <div className="preset-tabs" role="tablist" aria-label={text.layout}>
            {(['executive', 'content', 'production', 'support', 'marketing', 'tech', 'all'] as DashboardPreset[]).map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={preset === value}
                onClick={() => { setPreset(value); writePreset(value) }}
                type="button"
              >
                {text.presets[value]}
              </button>
            ))}
          </div>
          <small style={{ color:'var(--muted)', fontSize:10.5 }}>{text.localPreset}</small>
        </div>
      </section>

      <div className="exec-grid">
        {primary.map((module) => renderModule(module))}
      </div>

      {secondary.length > 0 && (
        <>
          <section className="page-intro page-intro--sub" style={{ marginTop: 4 }}>
            <div><span className="eyebrow">{text.more} · {secondary.length}</span></div>
          </section>
          <div className="exec-grid" style={{ opacity:.92 }}>
            {secondary.map((module) => renderModule(module))}
          </div>
        </>
      )}

      {/* Alerts center (Phase 42): severity/owner/status من /admin/ops/alerts */}
      <section className="panel" style={{ overflow:'hidden' }}>
        <div className="panel__header" style={{ background:'color-mix(in srgb, var(--warning) 7%, var(--surface-2))' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ width:28, height:28, display:'grid', placeItems:'center', borderRadius:8, background:'rgba(245,158,11,.14)', color:'#b45309' }}><Icon name="warning" size={14} /></span>
            <div>
              <h3 style={{ margin:0, fontSize:13 }}>{text.limits} — {locale==='ar'?'مركز التنبيهات':'Alerts center'}</h3>
              <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar' ? 'severity/owner/status من /admin/ops/alerts — acknowledged/resolved/history' : 'severity/owner/status from /admin/ops/alerts — acknowledged/resolved/history'}</small>
            </div>
          </div>
          <Link className="button button--ghost button--small" to={adminPath('ops')}>{locale==='ar'?'العمليات':'Ops'}</Link>
        </div>
        <div style={{ padding:12, display:'grid', gap:10 }}>
          {alerts.length>0 && (
            <ul style={{ margin:0, padding:0, listStyle:'none', display:'grid', gap:6 }}>
              {alerts.map((a:any)=>(
                <li key={a.id} style={{ display:'flex', gap:8, alignItems:'center', padding:'7px 10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)', fontSize:12 }}>
                  <span className={`status-badge ${a.severity==='critical'?'status-badge--review': a.severity==='warning'?'status-badge--ready':'status-badge--draft'}`} style={{ fontSize:10 }}>{a.severity ?? 'info'}</span>
                  <span style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title ?? a.message ?? a.id}</span>
                  <span style={{ fontSize:10, color:'var(--muted)' }}>{a.status ?? a.state ?? ''}</span>
                  <span style={{ fontSize:10, color:'var(--muted)' }}>{a.owner_id ?? a.owner ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
          <ul style={{ margin:0, padding:0, listStyle:'none', display:'grid', gap:8 }}>
            {overview.limits.map((limit) => (
              <li key={limit} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'8px 10px', border:'1px dashed var(--line)', borderRadius:10, background:'color-mix(in srgb, var(--warning) 6%, var(--surface))', fontSize:12, lineHeight:1.6 }}>
                <span style={{ width:6, height:6, marginTop:8, borderRadius:'50%', background:'var(--warning)', flex:'0 0 6px' }} />
                <span style={{ color:'var(--text-soft)' }}>{limit}</span>
              </li>
            ))}
          </ul>
          {range!=='all' && (
            <p style={{ margin:'10px 0 0', fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>
              {locale==='ar' ? `النطاق ${range} أُرسل إلى الخادم؛ إن رأيت نفس الأرقام فالخادم ما زال Snapshot (مقدّر حتى اكتمال Phase 4 instrumentation)` : `Range ${range} was sent to the server; identical numbers mean the server is still snapshot (expected until Phase 4 instrumentation)`}
            </p>
          )}
        </div>
      </section>
    </>
  )

  function renderModule(module: ExecutiveOverview['modules'][number]) {
    return (
      <article className={`panel exec-module exec-module--${module.key}`} key={module.key}>
        <header className="panel__header">
          <div className="exec-module__head">
            <span className="exec-module__icon"><Icon name={moduleIcon(module.key) as any} size={18} /></span>
            <div className="exec-module__titles">
              <h3>{locale === 'ar' ? module.label_ar : module.label_en}</h3>
              <span className="exec-module__source" dir="ltr">{module.source}</span>
            </div>
          </div>
        </header>
        {module.unavailable && (
          <p className="panel--notice panel--inline" style={{ margin:'0 14px' }}><Icon name="warning" size={14} />{module.unavailable}</p>
        )}
        <ul className="exec-metrics">
          {module.metrics.map((metric) => {
            const label = locale === 'ar' ? metric.label_ar : metric.label_en
            const unknown = metric.value === null || metric.value === undefined
            const bodyInner = (
              <>
                <span className="exec-metric__top">
                  <i className="exec-metric__dot" />
                  {metric.drill && !unknown && <span className="exec-metric__arrow"><Icon name="arrow" size={14} /></span>}
                </span>
                <strong>{unknown ? '—' : formatNumber(metric.value as number, locale)}</strong>
                <span>{label}</span>
                {unknown && <small className="exec-metric__note">{metric.unavailable ?? text.unavailable}</small>}
              </>
            )
            return (
              <li key={metric.key}>
                {metric.drill && !unknown ? (
                  <Link
                    className={`exec-metric exec-metric--${metric.tone}`}
                    to={adminPath(metric.drill.replace(/^\//, ''))}
                  >{bodyInner}</Link>
                ) : (
                  <span className={`exec-metric exec-metric--${metric.tone}${unknown ? ' exec-metric--unknown' : ''}`}>{bodyInner}</span>
                )}
              </li>
            )
          })}
        </ul>
      </article>
    )
  }
}
