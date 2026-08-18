import { useParams, Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { ErrorState, LoadingState } from '../components/PageState'
// (usePreferences removed — no locale-specific strings in this view)

export function OpsServiceWorkspacePage(){
  const { id='' }=useParams()
  const [data,setData]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const r=await api.opsService(id)
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
        <h2>{data.service.name}</h2><p>{data.service.description}</p>
        <div style={{display:'flex', gap:8}}><span className="track-badge">{data.service.tier}</span><span>Deps: {data.service.dependencies.join(', ')||'—'}</span></div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div className="panel" style={{padding:12}}><h3>Health Checks</h3><table className="data-table"><thead><tr><th>Time</th><th>Status</th><th>Latency</th></tr></thead><tbody>{(data.health_checks??[]).map((h:any)=><tr key={h.id}><td>{String(h.checked_at).slice(0,16)}</td><td>{h.status}</td><td>{h.latency_ms??'—'}</td></tr>)}</tbody></table></div>
        <div className="panel" style={{padding:12}}><h3>Alerts</h3>{(data.alerts??[]).map((a:any)=><div key={a.id} style={{padding:6, borderBottom:'1px solid var(--border)'}}>{a.condition_text} — {a.severity}</div>)} {!data.alerts?.length && <p style={{color:'var(--muted)'}}>No alerts</p>}</div>
      </div>
      <div className="panel" style={{padding:12}}><h3>Recent Changes</h3><p style={{fontSize:12, color:'var(--muted)'}}>Potentially related change shown next to incident, not causation.</p><ul>{(data.recent_changes??[]).map((c:any)=><li key={c.id}>{c.action} — {String(c.created_at).slice(0,16)}</li>)}</ul></div>
      <Link className="button button--ghost" to={adminPath('ops')}>Back to Ops</Link>
    </div>
  )
}
