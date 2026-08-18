// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import { DetailTabs } from '../components/DetailTabs'

const copy={
  ar:{
    eyebrow:'التشغيل', title:'SLA والتصعيد', lede:'سياسات حسب المجال — أوقات أول استجابة وحل منفصلة، وwaiting_customer يوقف الحل.',
    addPolicy:'سياسة جديدة', refresh:'تحديث',
    tabPolicies:'السياسات', tabCommand:'مركز القيادة', tabWork:'العمل',
    domain:'المجال', applies:'ينطبق على', priority:'الأولوية', firstResponse:'أول استجابة', resolution:'الحل', calendar:'التقويم', escalations:'التصعيد', status:'الحالة',
    support:'الدعم', review:'المراجعة', workflow:'سير العمل', queue:'الطابور', incident:'الحادث',
    breached:'متجاوز', atRisk:'على وشك', dueSoon:'قريب', paused:'موقوف', completed:'مكتمل',
    supportHint:'Support: first_response توقف عند أول رد، resolution يتوقف في waiting_customer ويعود عند رد العميل',
    queueHint:'Queue SLA: based on oldest message age, not customer semantics',
    workflowHint:'Workflow SLA: per stage, target per run stage, not support clocks',
    createTitle:'سياسة SLA جديدة', nameLabel:'الاسم', domainLabel:'المجال', priorityLabel:'الأولوية', firstLabel:'أول استجابة (دقائق)', resolutionLabel:'الحل (دقائق)', pauseLabel:'شرط الإيقاف (مثال waiting_customer)',
    save:'حفظ', cancel:'إلغاء', loadError:'تعذر التحميل', emptyPolicies:'لا سياسات',
  },
  en:{
    eyebrow:'Operations', title:'SLA & Escalations', lede:'Policies per domain — first response and resolution separate, waiting_customer pauses resolution.',
    addPolicy:'New policy', refresh:'Refresh',
    tabPolicies:'Policies', tabCommand:'Command Center', tabWork:'Work items',
    domain:'Domain', applies:'Applies to', priority:'Priority', firstResponse:'First response', resolution:'Resolution', calendar:'Calendar', escalations:'Escalations', status:'Status',
    support:'Support', review:'Review', workflow:'Workflow', queue:'Queue', incident:'Incident',
    breached:'Breached', atRisk:'At risk', dueSoon:'Due soon', paused:'Paused', completed:'Completed',
    supportHint:'Support dual clocks: first_response stops on first reply, resolution pauses in waiting_customer',
    queueHint:'Queue SLA: oldest message age, not customer clocks',
    workflowHint:'Workflow SLA: per stage, not support semantics',
    createTitle:'New SLA policy', nameLabel:'Name', domainLabel:'Domain', priorityLabel:'Priority', firstLabel:'First response (min)', resolutionLabel:'Resolution (min)', pauseLabel:'Pause condition (e.g. waiting_customer)',
    save:'Save', cancel:'Cancel', loadError:'Unable to load', emptyPolicies:'No policies',
  }
}

export function OpsSlaPage(){
  const { locale }=usePreferences()
  const text=copy[locale]
  const [tab,setTab]=useState<'policies'|'command'|'work'>('policies')
  const [policies,setPolicies]=useState<any[]>([])
  const [command,setCommand]=useState<any>(null)
  const [work,setWork]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [showCreate,setShowCreate]=useState(false)
  const [form,setForm]=useState({ name:'', domain:'support', priority:'high', first_response_minutes:60, resolution_minutes:1440, pause_condition:'waiting_customer' })

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const [p,c]=await Promise.all([api.slaPolicies(), api.slaCommandCenter().catch(()=> ({data:{breached:0, at_risk:0}} as any))])
      setPolicies((p as any).data ?? [])
      setCommand((c as any).data)
      if(tab==='work'){
        const w=await api.supportFamily('test').catch(()=> null) // placeholder
        // fetch support tickets for work table
        const tickets=await (api as any).supportTickets?.({ limit:10 } as any).catch(()=> ({data:[]})) as any
        setWork(tickets.data ?? [])
      }
    }catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[tab, text.loadError])

  useEffect(()=>{ void load()},[load])

  const create=async()=>{
    await api.createSlaPolicy({ name: form.name, domain: form.domain, priority: form.priority, first_response_minutes: Number(form.first_response_minutes), resolution_minutes: Number(form.resolution_minutes), pause_condition: form.pause_condition || null })
    setShowCreate(false); void load()
  }

  if(loading) return <LoadingState/>
  if(error && !policies.length) return <ErrorState message={error} onRetry={()=>void load()}/>

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div><button className="button button--primary" onClick={()=> setShowCreate(true)}><Icon name="plus" size={14}/>{text.addPolicy}</button></section>

      <div style={{display:'flex', gap:8}}>
        <button className={`button ${tab==='policies'?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab('policies')}>{text.tabPolicies}</button>
        <button className={`button ${tab==='command'?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab('command')}>{text.tabCommand}</button>
        <button className={`button ${tab==='work'?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab('work')}>{text.tabWork}</button>
      </div>

      {tab==='policies' && (
        <section className="panel panel--table"><div className="panel__header"><h3>SLA Policies ({policies.length})</h3><span className="panel__kicker">Domain-specific, not universal</span></div>
          <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.domain}</th><th>Name</th><th>{text.priority}</th><th>{text.firstResponse}</th><th>{text.resolution}</th><th>{text.escalations}</th></tr></thead><tbody>
            {policies.map((p:any)=>(
              <tr key={p.id}><td><span className="track-badge">{p.domain}</span><br/><small>{p.pause_condition? `pause: ${p.pause_condition}`: ''}</small></td><td><Link to={adminPath(`ops-sla/policy/${p.id}`)}><strong>{p.name}</strong></Link><br/><small>{p.applies_to ?? ''}</small></td><td>{p.priority ?? '—'}</td><td>{p.first_response_minutes ?? '—'}</td><td>{p.resolution_minutes ?? '—'}</td><td>{Array.isArray(p.escalation_rules)? p.escalation_rules.length: 0} rules</td></tr>
            ))}
            {!policies.length && <tr><td colSpan={6}><EmptyState title={text.emptyPolicies} description="Add policy per domain"/></td></tr>}
          </tbody></table></div>
          <div style={{padding:12, fontSize:12, color:'var(--muted)'}}>
            <p>{text.supportHint}</p><p>{text.queueHint}</p><p>{text.workflowHint}</p>
          </div>
        </section>
      )}

      {tab==='command' && command && (
        <section className="stat-row" style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12}}>
          <Link to={adminPath('support-center')} className="stat-card"><span>{text.breached}</span><strong>{command.breached}</strong></Link>
          <div className="stat-card"><span>{text.atRisk}</span><strong>{command.at_risk}</strong></div>
          <div className="stat-card"><span>{text.dueSoon}</span><strong>{command.due_soon}</strong></div>
          <div className="stat-card"><span>{text.paused}</span><strong>{command.paused}</strong><small>waiting_customer pauses resolution</small></div>
          <div className="stat-card"><span>{text.completed}</span><strong>{command.recently_resolved}</strong></div>
        </section>
      )}

      {tab==='work' && (
        <section className="panel panel--table"><div className="panel__header"><h3>Work items</h3></div>
          <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>Work</th><th>Domain</th><th>Priority</th><th>First Due</th><th>Resolution Due</th><th>SLA state</th><th>Escalation</th></tr></thead><tbody>
            {work.slice(0,10).map((w:any)=>(
              <tr key={w.id}><td><Link to={adminPath(`support-center`)}>{w.reference ?? w.id.slice(0,6)}</Link></td><td>support</td><td>{w.priority}</td><td>{String(w.first_response_due_at??'').slice(0,16)}</td><td>{String(w.resolution_due_at??'').slice(0,16)}</td><td><span className={`status-badge ${w.sla?.resolution_breached?'status-badge--review':''}`}>{w.sla?.resolution_breached? text.breached: w.sla?.paused? text.paused: 'on_track'}</span></td><td>{w.escalated_at? 'escalated': '—'}</td></tr>
            ))}
            {!work.length && <tr><td colSpan={7} style={{textAlign:'center', color:'var(--muted)'}}>No work — filtered via SLA policies</td></tr>}
          </tbody></table></div>
        </section>
      )}

      <Modal open={showCreate} onClose={()=> setShowCreate(false)} title={text.createTitle}>
        <div style={{display:'grid', gap:12}}>
          <label className="field"><span>{text.nameLabel}</span><input value={form.name} onChange={e=> setForm({...form, name:e.target.value})} /></label>
          <label className="field"><span>{text.domainLabel}</span><select value={form.domain} onChange={e=> setForm({...form, domain:e.target.value})}><option value="support">support</option><option value="content_review">content_review</option><option value="workflow">workflow</option><option value="queue">queue</option><option value="incident">incident</option></select></label>
          <label className="field"><span>{text.priorityLabel}</span><select value={form.priority} onChange={e=> setForm({...form, priority:e.target.value})}><option value="high">high</option><option value="normal">normal</option><option value="low">low</option></select></label>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <label className="field"><span>{text.firstLabel}</span><input type="number" value={form.first_response_minutes} onChange={e=> setForm({...form, first_response_minutes: Number(e.target.value)})} /></label>
            <label className="field"><span>{text.resolutionLabel}</span><input type="number" value={form.resolution_minutes} onChange={e=> setForm({...form, resolution_minutes: Number(e.target.value)})} /></label>
          </div>
          <label className="field"><span>{text.pauseLabel}</span><input value={form.pause_condition} onChange={e=> setForm({...form, pause_condition: e.target.value})} placeholder="waiting_customer" /></label>
          <div style={{display:'flex', gap:8}}><button className="button button--primary" onClick={()=> void create()}>{text.save}</button><button className="button button--ghost" onClick={()=> setShowCreate(false)}>{text.cancel}</button></div>
        </div>
      </Modal>
    </div>
  )
}
