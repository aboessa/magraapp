import { useParams, Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { ErrorState, LoadingState } from '../components/PageState'
export function OpsIncidentWorkspacePage(){
  const { id='' }=useParams()
  const [data,setData]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const r=await api.opsIncident(id)
      if((r as any).success) setData((r as any).data)
      else throw new Error((r as any).error)
    }catch(e){ setError(e instanceof Error? e.message:'Error')} finally{ setLoading(false)}
  },[id])
  useEffect(()=>{ void load()},[load])
  if(loading) return <LoadingState/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()}/>
  if(!data) return null
  return (
    <div className="page-stack">
      <div className="panel" style={{padding:16}}>
        <h2>Incident {data.id.slice(0,8)} — {data.title}</h2>
        <p>Severity <span className={`status-badge status-badge--${data.severity==='critical'?'review':'draft'}`}>{data.severity}</span> · Status {data.status} · Affected {data.affected_services.join(', ')}</p>
        <p>Started {String(data.started_at).slice(0,16)} · Owner {data.owner_id ?? '—'}</p>
        {data.impact && <p>Impact: {data.impact}</p>}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div className="panel" style={{padding:12}}><h3>Timeline</h3>{(data.timeline??[]).map((t:any)=><div key={t.id} style={{padding:6, borderLeft:'2px solid var(--primary)', marginBottom:6}}><small>{String(t.created_at).slice(11,16)}</small> <strong>{t.entry_type}</strong> — {t.body}</div>)}</div>
        <div className="panel" style={{padding:12}}><h3>Alerts</h3>{(data.alerts??[]).map((a:any)=><div key={a.id}>{a.condition_text}</div>)}{!data.alerts?.length && <p style={{color:'var(--muted)'}}>No linked alerts</p>}</div>
      </div>
      <div className="panel" style={{padding:12}}><h3>Failed Events</h3>{(data.failed_events??[]).slice(0,5).map((f:any)=><div key={f.id}>{f.event_type} — {f.id.slice(0,8)}</div>)}</div>
      <div style={{display:'flex', gap:8}}>
        <button className="button button--primary" onClick={async()=>{
          const nxt = data.status==='open'?'investigating': data.status==='investigating'?'identified': data.status==='identified'?'monitoring':'resolved'
          await api.updateOpsIncident(id, { status: nxt })
          await load()
        }}>Advance status</button>
        <Link className="button button--ghost" to={adminPath('ops/incidents')}>Back</Link>
      </div>
    </div>
  )
}
