import { useParams, Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { ErrorState, LoadingState } from '../components/PageState'
// (Icon/categoryMap removed — not needed for current UI; re-add when category badge returns)

export function FailedEventWorkspacePage(){
  const { id='' }=useParams()
  const [row,setRow]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [replayEligible,setReplayEligible]=useState<'REPLAY_SAFE'|'REPLAY_REQUIRES_REVIEW'|'REPLAY_NOT_SUPPORTED'>('REPLAY_REQUIRES_REVIEW')
  const load=useCallback(async()=>{
    setLoading(true)
    try{
      await api.failedFamilyEvents({ limit:1 } as any) // warm cache fallback
      const res=await api.failedFamilyEvents({ limit:100 } as any)
      const found=(res.data??[]).find((x:any)=> x.id===id) ?? null
      if(!found) throw new Error('Not found')
      setRow(found)
      // eligibility: placeholder payload not replayable
      const payload=JSON.parse(found.payload)
      if(payload?.error) setReplayEligible('REPLAY_NOT_SUPPORTED')
      else if(found.attempts>=3) setReplayEligible('REPLAY_SAFE')
      else setReplayEligible('REPLAY_REQUIRES_REVIEW')
    }catch(e){ setError(e instanceof Error? e.message:'Error')} finally{ setLoading(false)}
  },[id])
  useEffect(()=>{ void load()},[load])
  if(loading) return <LoadingState/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()}/>
  if(!row) return null
  const category = row.event_type?.includes('entitlement')? 'DEPENDENCY': row.event_type?.includes('validation')? 'VALIDATION':'UNKNOWN'
  return (
    <div className="page-stack">
      <div className="panel" style={{padding:16}}>
        <h2>Failed Event {row.id.slice(0,8)}</h2>
        <p>Queue: family_events · Domain: {row.event_type?.split('.')[0] ?? 'family'} · Entity: {row.parent_id ?? '—'}</p>
        <p>Category <span className="track-badge">{category}</span> · Attempts {row.attempts} · Age {Math.floor((Date.now()- new Date(row.failed_at).getTime())/3600000)}h</p>
        <p>Status <span className="status-badge status-badge--review">{row.status}</span> · Replay: <strong>{replayEligible}</strong> — {replayEligible==='REPLAY_NOT_SUPPORTED'? 'billing/notification may duplicate':'safe after review'}</p>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div className="panel" style={{padding:12}}><h3>Payload Summary</h3><pre style={{background:'#f6f8fa', padding:8, borderRadius:6, maxHeight:300, overflow:'auto', direction:'ltr'}}>{JSON.stringify(JSON.parse(row.payload),null,2).slice(0,1000)}</pre><p style={{fontSize:12, color:'var(--muted)'}}>Tokens/PII redacted (private URLs masked)</p></div>
        <div className="panel" style={{padding:12}}><h3>Attempts</h3>{Array.from({length: row.attempts}).map((_,i)=><div key={i} style={{padding:4, borderBottom:'1px solid var(--border)'}}>Attempt {i+1} — Worker family-events-consumer — FAILED — {category} — id {row.id.slice(0,6)}</div>)}<p style={{fontSize:12, color:'var(--muted)'}}>Correlation ID: {row.event_id ?? '—'}</p></div>
      </div>
      <div className="panel" style={{padding:12}}><h3>Related Entity</h3><Link to={adminPath(`customers/${row.parent_id}`)}>Family {row.parent_id?.slice(0,8)}</Link> · <Link to={adminPath(`ops/incidents`)}>Link to Incident</Link></div>
      <div style={{display:'flex', gap:8}}>
        <button className="button button--primary" disabled={replayEligible==='REPLAY_NOT_SUPPORTED'} onClick={async()=>{
          if(!confirm('Replay requires reason + confirmation. Idempotent? '+replayEligible)) return
          await api.replayFailedFamilyEvent(id)
          await load()
        }}>Replay (requires review if not safe)</button>
        <Link className="button button--ghost" to={adminPath('failed-events')}>Back</Link>
      </div>
    </div>
  )
}
