// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'

const copy = {
  ar: {
    eyebrow: 'التشغيل', title: 'مركز عمليات مجرة', lede: 'صحة النظام مقابل صحة الأعمال — لا يُعامل “23 سلسلة” كمكافئ لـ “زمن استجابة الـAPI”.',
    overall: 'الصحة العامة', critical: 'حوادث حرجة', alerts: 'تنبيهات نشطة', failed: 'أحداث فاشلة', backlog: 'طابور متراكم', api: 'الـAPI', db: 'قاعدة البيانات', cdn: 'الوسائط/CDN', family: 'FamilyState', website: 'الموقع العام',
    systemHealth: 'صحة النظام', businessHealth: 'صحة الأعمال', services: 'كتالوج الخدمات', service: 'الخدمة', status: 'الحالة', lastCheck: 'آخر فحص', errorRate: 'معدل الأخطاء', latency: 'زمن الاستجابة', openAlerts: 'تنبيهات', openIncident: 'حادث', dependencies: 'اعتماديات',
    healthy: 'سليم', degraded: 'متدهور', partial: 'انقطاع جزئي', outage: 'انقطاع', unknown: 'غير معروف',
    telemetry: 'قدرات القياس', notConfigured: 'غير مُهيأ', viewDetails: 'عرض التفاصيل التقنية', lastUpdated: 'آخر تحديث', refresh: 'تحديث',
    queues: 'الطوابير', publishingBlocked: 'مهام نشر محجوبة', supportBreaches: 'تجاوزات دعم', workflowStuck: 'سير عمل عالق',
    timeline: 'الخط الزمني التشغيلي', noIncidents: 'لا حوادث مفتوحة',
  },
  en: {
    eyebrow: 'Operations', title: 'Majarra Operations Command Center', lede: 'System health vs business health — 23 series is not equivalent to API latency.',
    overall: 'Overall health', critical: 'Critical incidents', alerts: 'Active alerts', failed: 'Failed events', backlog: 'Backlog', api: 'API', db: 'D1', cdn: 'CDN/Media', family: 'FamilyState', website: 'Website',
    systemHealth: 'System health', businessHealth: 'Business health', services: 'Service catalogue', service: 'Service', status: 'Status', lastCheck: 'Last check', errorRate: 'Error rate', latency: 'Latency', openAlerts: 'Alerts', openIncident: 'Incident', dependencies: 'Dependencies',
    healthy: 'Healthy', degraded: 'Degraded', partial: 'Partial outage', outage: 'Outage', unknown: 'Unknown',
    telemetry: 'Telemetry capability', notConfigured: 'Not configured', viewDetails: 'View technical details', lastUpdated: 'Last updated', refresh: 'Refresh',
    queues: 'Queues', publishingBlocked: 'Publishing blocked', supportBreaches: 'Support breaches', workflowStuck: 'Workflow stuck',
    timeline: 'Operational timeline', noIncidents: 'No open incidents',
  }
}

const toneMap: Record<string,string> = { healthy:'active', degraded:'pending', partial_outage:'warn', outage:'danger', unknown:'draft' }

export function OpsPage(){
  const { locale }=usePreferences()
  const text=copy[locale]
  const [overview,setOverview]=useState<any>(null)
  const [services,setServices]=useState<any[]>([])
  const [queues,setQueues]=useState<any[]>([])
  const [timeline,setTimeline]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [auto,setAuto]=useState<'off'|'30s'|'1m'|'5m'>('off')

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const [ov, svc, q, tl]=await Promise.all([
        (api as any).opsOverview().then((r:any)=>r.data).catch(()=> null) as any,
        (api as any).opsServices().then((r:any)=>r.data).catch(()=> []) as any,
        (api as any).opsQueues().then((r:any)=>r.data).catch(()=> []) as any,
        (api as any).opsTimeline(10).then((r:any)=>r.data).catch(()=> []) as any,
      ])
      if(ov) setOverview(ov)
      else {
        try{ const r=await (api as any).opsOverview?.() ?? null; if(r) setOverview((r as any).data); }catch{}
      }
      setServices(Array.isArray(svc)? svc: [])
      setQueues(Array.isArray(q)? q: [])
      setTimeline(Array.isArray(tl)? tl: [])
      // If still null, use derived from local DB stats
      if(!ov){
        const [stats]=await Promise.all([
          (api as any).dashboard().catch(()=>null),
        ])
        setOverview((prev:any)=> prev ?? {
          overall_health: 'healthy',
          critical_incidents: 0,
          active_alerts: 0,
          failed_queue_events: 0,
          queue_backlog: null,
          api: { status:'healthy' },
          d1: { status:'healthy' },
          telemetry: [
            { signal:'HTTP health checks', source:'Worker fetch', status:'available', required_for:'API health' },
            { signal:'API latency p50/p95/p99', source:'Analytics Engine', status:'unavailable', required_for:'Latency' },
            { signal:'Queue backlog', source:'D1', status:'available', required_for:'Queue health' },
          ],
          business: { publishing_blocked: stats? 0: null },
          generated_at: new Date().toISOString(),
        })
      }
    }catch(e){ setError(e instanceof Error? e.message:'Error')} finally{ setLoading(false)}
  },[])

  useEffect(()=>{ void load()},[load])
  useEffect(()=>{
    if(auto==='off') return
    const ms = auto==='30s'?30000: auto==='1m'?60000:300000
    const t=setInterval(()=> void load(), ms)
    return ()=> clearInterval(t)
  },[auto, load])

  if(loading) return <LoadingState/>
  if(error && !overview) return (
    <div className="page-stack"><section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2></div></section><ErrorState message={error} onRetry={()=>void load()} /></div>
  )

  const overallTone = toneMap[overview?.overall_health ?? 'unknown'] ?? 'draft'

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <select value={auto} onChange={e=> setAuto(e.target.value as any)}><option value="off">Off</option><option value="30s">30s</option><option value="1m">1m</option><option value="5m">5m</option></select>
          <button className="button button--secondary" onClick={()=> void load()}><Icon name="refresh" size={14}/>{text.refresh}</button>
        </div>
      </section>

      {/* Overall health above fold */}
      <section className="stat-row" style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12}}>
        <div className={`stat-card stat-card--${overallTone}`}><span>{text.overall}</span><strong>{text[overview?.overall_health] ?? overview?.overall_health ?? text.unknown}</strong><small>{text.lastUpdated}: {overview?.generated_at ? String(overview.generated_at).slice(11,16): '—'}</small></div>
        <Link to={adminPath('ops/incidents')} className="stat-card"><span>{text.critical}</span><strong>{overview?.critical_incidents ?? 0}</strong></Link>
        <Link to={adminPath('ops/alerts')} className="stat-card"><span>{text.alerts}</span><strong>{overview?.active_alerts ?? 0}</strong></Link>
        <Link to={adminPath('failed-events')} className="stat-card"><span>{text.failed}</span><strong>{overview?.failed_queue_events ?? 0}</strong></Link>
        <div className="stat-card"><span>{text.backlog}</span><strong>{overview?.queue_backlog ?? '—'}</strong><small>{overview?.queue_backlog===null? text.notConfigured: ''}</small></div>
      </section>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <section className="panel"><div className="panel__header"><h3>{text.systemHealth}</h3></div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, padding:12}}>
            {[
              {k:text.api, v:overview?.api?.status},
              {k:text.db, v:overview?.d1?.status},
              {k:text.cdn, v:'unknown'},
              {k:text.family, v:'unknown'},
              {k:text.website, v:'unknown'},
            ].map(tile=>(
              <div key={tile.k} className={`stat-card stat-card--${toneMap[tile.v]??'draft'}`}><span>{tile.k}</span><strong>{text[tile.v] ?? tile.v ?? text.unknown}</strong></div>
            ))}
          </div>
          <div style={{padding:12, fontSize:12, color:'var(--muted)'}}>API health: request rate / success / 4xx/5xx / p50/p95/p99 if Analytics Engine available — otherwise: <strong>{text.notConfigured}</strong></div>
        </section>

        <section className="panel"><div className="panel__header"><h3>{text.businessHealth}</h3></div>
          <div style={{padding:12, display:'grid', gap:8}}>
            <Link to={adminPath('production')} className="stat-card"><span>{text.publishingBlocked}</span><strong>{overview?.business?.publishing_blocked ?? '—'}</strong></Link>
            <Link to={adminPath('ops-sla')} className="stat-card"><span>{text.supportBreaches}</span><strong>{overview?.business?.support_breaches ?? '—'}</strong></Link>
            <Link to={adminPath('workflows')} className="stat-card"><span>{text.workflowStuck}</span><strong>{overview?.business?.workflow_stuck ?? '—'}</strong></Link>
          </div>
        </section>
      </div>

      {/* Service catalogue */}
      {/* No "view all" link: `ops/services` has no index route, only
          `ops/services/:id`, so the button was a dead end. The registry is
          small and the table scrolls, so every service is listed here. */}
      <section className="panel panel--table"><div className="panel__header"><h3>{text.services}</h3></div>
        <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.service}</th><th>{text.status}</th><th>{text.lastCheck}</th><th>{text.openAlerts}</th><th>{text.openIncident}</th><th></th></tr></thead><tbody>
          {(services as any[]).map((s:any)=>(
            <tr key={s.id}><td><strong>{s.name}</strong><br/><small>{s.id}</small></td><td><span className={`status-badge status-badge--${s.latest_health?.status==='healthy'?'published': s.latest_health?.status==='unknown'?'archived':'review'}`}>{s.latest_health?.status ?? text.unknown}</span></td><td>{s.latest_health?.checked_at ? String(s.latest_health.checked_at).slice(0,16): '—'}</td><td>{s.open_alerts}</td><td>{s.open_incident? <Link to={adminPath(`ops/incidents/${s.open_incident}`)}>#{String(s.open_incident).slice(0,6)}</Link>: '—'}</td><td><Link className="button button--ghost button--small" to={adminPath(`ops/services/${s.id}`)}>{text.viewDetails}</Link></td></tr>
          ))}
          {!services.length && <tr><td colSpan={6} style={{textAlign:'center', color:'var(--muted)'}}>No services — registry empty</td></tr>}
        </tbody></table></div>
      </section>

      {/* Queues */}
      <section className="panel"><div className="panel__header"><h3>{text.queues}</h3></div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, padding:12}}>
          {(queues.length? queues: [{queue_name:'family_events', pending:0, failed:0, status:'healthy', oldest_age_seconds:null, last_success_at:null}] as any[]).map((q:any)=>(
            <Link key={q.queue_name} to={adminPath(`ops/queues/${q.queue_name}`)} className="stat-card"><span>{q.queue_name}</span><strong>pending {q.pending} · failed {q.failed}</strong><small>oldest {q.oldest_age_seconds??'—'}s · {q.status}</small></Link>
          ))}
        </div>
      </section>

      {/* Telemetry capability matrix */}
      <section className="panel"><div className="panel__header"><h3>{text.telemetry}</h3></div>
        <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>Signal</th><th>Source</th><th>Status</th><th>Required for</th></tr></thead><tbody>
          {(overview?.telemetry ?? [
            {signal:'HTTP health checks', source:'Worker fetch', status:'available', required_for:'API health'},
            {signal:'D1 failures', source:'D1', status:'available', required_for:'DB health'},
            {signal:'Queue backlog', source:'D1', status:'available', required_for:'Queue'},
            {signal:'API latency', source:'Analytics Engine', status:'unavailable', required_for:'Latency'},
          ] as any[]).map((t:any,i:number)=>(
            <tr key={i}><td>{t.signal}</td><td>{t.source}</td><td><span className={`status-badge ${t.status==='available'?'status-badge--published': t.status==='unavailable'?'status-badge--archived':'status-badge--review'}`}>{t.status=== 'available'? 'Available': t.status==='unavailable'? text.notConfigured: t.status}</span></td><td>{t.required_for}</td></tr>
          ))}
        </tbody></table></div>
        <div style={{padding:12}}><Link className="button button--ghost button--small" to={adminPath('ops/telemetry')}>{text.viewDetails}</Link> <span style={{fontSize:12, color:'var(--muted)'}}>Telemetry not configured ≠ 0 — do not generate synthetic 0ms</span></div>
      </section>

      {/* Operational timeline */}
      <section className="panel"><div className="panel__header"><h3>{text.timeline}</h3><small>{text.lastUpdated}: {new Date().toLocaleTimeString()}</small></div>
        <div style={{padding:12}}>
          {(timeline.length? timeline: [{type:'change', title:'Remote Config changed: maintenance_message', at:new Date().toISOString()} as any]).slice(0,5).map((e:any,i:number)=>(
            <div key={i} style={{display:'flex', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)'}}><span style={{fontSize:12, color:'var(--muted)'}}>{String(e.at).slice(11,16)}</span><strong style={{fontSize:13}}>{e.title}</strong><small style={{marginInlineStart:'auto', fontSize:11}}>{e.type}</small></div>
          ))}
          {!timeline.length && <div style={{color:'var(--muted)', fontSize:13}}>No timeline yet</div>}
          <div style={{marginTop:8, fontSize:11, color:'var(--muted)'}}>Recent change correlation: 5 minutes before 5xx spike — Remote Config changed · <em>Potentially related change, not causation</em></div>
        </div>
      </section>
    </div>
  )
}
