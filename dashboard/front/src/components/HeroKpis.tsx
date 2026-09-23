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

  const Card = ({ title, value, sub, tone, href, icon }: { title:string; value:string; sub:string; tone?: 'blue'|'cyan'|'yellow'|'purple'; href:string; icon: any }) => (
    <Link to={adminPath(href)} style={{ textDecoration:'none', color:'inherit' }}>
      <article className={`stat-card kpi-glass-card kpi-glass-card--${tone ?? 'blue'}`}>
        <div className="kpi-card__top">
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.03em' }}>{title}</span>
          <span className="kpi-icon-bubble">
            <Icon name={icon} size={16} />
          </span>
        </div>
        <div>
          <strong className="kpi-card__value">{value}</strong>
          <div className="kpi-card__sub">{sub}</div>
        </div>
      </article>
    </Link>
  )

  return (
    <section className="stats-grid kpi-bento-grid" aria-label="Hero KPIs">
      <Card title={t.mrr} value={mrrVal!=null ? `$${(mrrVal/100).toFixed(2)}` : (mrrAvail ? '—' : t.noData)} sub={mrrAvail ?? (rev? t.revNote : t.noData)} tone="blue" href="revenue" icon="analytics" />
      <Card title={t.paid} value={paid!=null ? String(paid) : '—'} sub={`${t.trials}: ${trials ?? '—'} · ${t.churn}: ${churn ?? '—'}`} tone="cyan" href="billing" icon="parents" />
      <Card title={t.sla} value={slaBreaches!=null ? String(slaBreaches) : '—'} sub={locale==='ar' ? 'تذاكر متأخرة / تجاوزات' : 'Overdue / breaches'} tone={slaBreaches && slaBreaches>0 ? 'yellow' : 'purple'} href="ops-sla" icon="clock" />
      <Card title={t.health} value={overall==='healthy'?t.healthy:overall} sub={`${t.failed}: ${failedEvents ?? '—'} · ${t.billing}: ${bill?.by_plan?.length ?? '—'} plans`} tone={overall==='healthy'?'purple':'yellow'} href="ops" icon="devices" />
    </section>
  )
}

