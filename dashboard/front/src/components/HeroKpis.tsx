import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from './Icon'
import { rangeToParams, type DashboardRange } from '../lib/dashboardRange'

export function HeroKpis({ locale, range }: { locale: 'ar'|'en'; range: DashboardRange }) {
  const [rev, setRev] = useState<any>(null)
  const [bill, setBill] = useState<any>(null)
  const [sla, setSla] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    const params = rangeToParams(range)
    try { void (api as any).revenueOverview?.(params.range)?.then((r:any)=>setRev(r.data)).catch(()=>setRev({ _unavailable:true })) } catch { setRev({ _unavailable:true }) }
    try { void (api as any).billingStats?.()?.then((r:any)=>setBill(r.data)).catch(()=>setBill(null)) } catch { setBill(null) }
    try { void (api as any).supportSla?.()?.then((r:any)=>setSla(r.data)).catch(()=>setSla(null)) } catch { setSla(null) }
    try { void (api as any).opsOverview().then((r:any)=>setHealth((r as any).data ?? null)).catch(()=>setHealth(null)) } catch { setHealth(null) }
  }, [range])

  const t = locale==='ar'
    ? { mrr:'MRR', paid:'مشترك مدفوع', revNote:'من /admin/revenue/overview', noData:'غير متاح', churn:'معدّل فقد', trials:'تجارب جديدة', sla:'التزام الدعم', slaBreaches:'تجاوزات SLA', health:'صحة النظام', healthy:'سليم', failed:'أحداث فاشلة', billing:'فوترة' }
    : { mrr:'MRR', paid:'Paid subscribers', revNote:'from /admin/revenue/overview', noData:'Unavailable', churn:'Churn proxy', trials:'New trials', sla:'Support SLA', slaBreaches:'SLA breaches', health:'System health', healthy:'Healthy', failed:'Failed events', billing:'Billing' }

  const mrrVal = rev?.metrics?.mrr?.value
  const mrrAvail = rev?.metrics?.mrr?.unavailable
  const paid = rev?.metrics?.active_paid_subscribers
  const churn = rev?.metrics?.churn_proxy
  const trials = Array.isArray(rev?.metrics?.trial_starts) ? rev.metrics.trial_starts.reduce((s:number,x:any)=>s+(x.cnt||0),0) : null
  const slaBreaches = sla?.breaches ?? sla?.overdue ?? null
  const failedEvents = health?.failed_queue_events ?? null
  const overall = health?.overall_health ?? 'unknown'

  const Card = ({ title, value, sub, tone, href }: { title:string; value:string; sub:string; tone?:string; href:string }) => (
    <Link to={adminPath(href)} style={{ textDecoration:'none', color:'inherit' }}>
      <article className={`stat-card stat-card--${tone ?? 'blue'}`} style={{ minHeight: 122, padding:'14px 16px', display:'flex', flexDirection:'column', gap:6, textDecoration:'none' }}>
        <div className="stat-card__top" style={{ fontSize:11, fontWeight:700, letterSpacing:'.04em', textTransform:'uppercase' as any }}>
          <span>{title}</span>
          <span style={{ opacity:.6 }}><Icon name="arrow" size={12} /></span>
        </div>
        <strong className="stat-card__value" style={{ fontSize:22, marginTop:4 }}>{value}</strong>
        <span style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5 }}>{sub}</span>
      </article>
    </Link>
  )

  return (
    <section className="stats-grid" aria-label="Hero KPIs">
      <Card title={t.mrr} value={mrrVal!=null ? `$${(mrrVal/100).toFixed(2)}` : (mrrAvail ? '—' : t.noData)} sub={mrrAvail ?? (rev? t.revNote : t.noData)} tone="blue" href="revenue" />
      <Card title={t.paid} value={paid!=null ? String(paid) : '—'} sub={`${t.trials}: ${trials ?? '—'} · ${t.churn}: ${churn ?? '—'}`} tone="cyan" href="billing" />
      <Card title={t.sla} value={slaBreaches!=null ? String(slaBreaches) : '—'} sub={locale==='ar' ? 'تذاكر متأخرة / تجاوزات' : 'Overdue / breaches'} tone={slaBreaches && slaBreaches>0 ? 'yellow' : 'purple'} href="ops-sla" />
      <Card title={t.health} value={overall==='healthy'?t.healthy:overall} sub={`${t.failed}: ${failedEvents ?? '—'} · ${t.billing}: ${bill?.by_plan?.length ?? '—'} plans`} tone={overall==='healthy'?'purple':'yellow'} href="ops" />
    </section>
  )
}
