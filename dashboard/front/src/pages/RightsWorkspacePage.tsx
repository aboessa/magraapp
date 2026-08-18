import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'

const copy={
  ar:{ back:'عودة', loading:'تحميل', loadError:'تعذر', overview:'نظرة عامة', content:'المحتوى', territories:'الأقاليم', languages:'اللغات', platforms:'المنصات', windows:'النوافذ', commercial:'شروط تجارية', documents:'المستندات', renewal:'التجديد', usage:'الاستخدام', history:'السجل', expiry:'الانتهاء', territory:'النطاق الجغرافي', impact:'الأثر', sensitive:'بنود مالية حساسة — وصول مقيد',
  },
  en:{ back:'Back', loading:'Loading', loadError:'Error', overview:'Overview', content:'Content', territories:'Territories', languages:'Languages', platforms:'Platforms', windows:'Windows', commercial:'Commercial terms', documents:'Documents', renewal:'Renewal', usage:'Usage', history:'History', expiry:'Expiry', territory:'Territory', impact:'Impact', sensitive:'Financial terms restricted',
  }
}
function parseList(v:any){
  if(!v) return []
  try{ const a=JSON.parse(v); return Array.isArray(a)? a: [] }catch{ return [] }
}
export function RightsWorkspacePage(){
  const { id='' }=useParams()
  const { locale }=usePreferences()
  const text=copy[locale==='en'?'en':'ar'] as any
  const [data,setData]=useState<any>(null)
  const [tab,setTab]=useState<'overview'|'content'|'territories'|'windows'|'history'>('overview')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{ const r=await api.rightDetail(id); setData(r.data)}catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[id, text.loadError])
  useEffect(()=>{ void load()},[load])
  if(loading) return <LoadingState label={text.loading}/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()}/>
  if(!data) return <EmptyState title={text.loadError} description={id}/>
  const isExpired=data.expiry_date && new Date(data.expiry_date).getTime() < Date.now()
  const daysRemaining=data.expiry_date? Math.ceil((new Date(data.expiry_date).getTime()-Date.now())/86400000): null
  return (
    <div className="page-stack">
      <div className="panel" style={{padding:16}}>
        <div style={{display:'flex', justifyContent:'space-between'}}><div><h2>{data.series_title ?? data.content_id} <small style={{color: isExpired? '#b45309': undefined}}>{isExpired? 'EXPIRED': daysRemaining!=null && daysRemaining<=30? `Expiring in ${daysRemaining}d`: ''}</small></h2><p>Owner: {data.owner} · Type: {data.license_type}</p></div><Link className="button button--ghost" to={adminPath('rights')}>{text.back}</Link></div>
        <div style={{display:'flex', gap:8, marginTop:12, overflowX:'auto'}}>
          {(['overview','content','territories','windows','history'] as const).map(t=> <button key={t} className={`button ${tab===t?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab(t)}>{(text as any)[t] ?? t}</button>)}
        </div>
      </div>
      {tab==='overview' && <div className="panel" style={{padding:16}}><dl style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div><dt>{text.territory}</dt><dd>{parseList(data.countries).join(', ') || 'Worldwide'}</dd></div>
        <div><dt>{text.languages}</dt><dd>{parseList(data.languages).join(', ') || 'All'}</dd></div>
        <div><dt>Platforms</dt><dd>{parseList(data.devices).join(', ') || 'All'}</dd></div>
        <div><dt>{text.expiry}</dt><dd>{data.expiry_date ?? 'Perpetual'} {daysRemaining!=null? `(${daysRemaining} days)` : ''}</dd></div>
      </dl><p className="panel__note" style={{marginTop:12}}>Territory model: Worldwide / Worldwide except / Selected only / Unavailable — consistent with availability.</p><p className="panel__note">{text.sensitive}</p></div>}
      {tab==='content' && <div className="panel" style={{padding:16}}><h3>{text.content}</h3>{(data.affected_content??[]).map((c:any)=><div key={c.id}><Link to={adminPath(`series/${c.id}`)}>{c.title_ar}</Link> — {c.status}</div>)}<p className="panel__note">Rights → Content → canonical Content Workspace; Content Workspace → Rights</p><p className="panel__note">Scheduled releases affected: {(data.affected_content??[]).length} items</p></div>}
      {tab==='territories' && <div className="panel" style={{padding:16}}><h3>{text.territories}</h3><p>Countries: {parseList(data.countries).join(', ') || 'All'}</p><p>Languages: {parseList(data.languages).join(', ') || 'All'}</p><p>Devices: {parseList(data.devices).join(', ') || 'All'}</p><p className="panel__note">Availability consistency enforced — no conflicting territory values.</p></div>}
      {tab==='windows' && <div className="panel" style={{padding:16}}><h3>{text.windows}</h3><p>Start: —</p><p>End: {data.expiry_date ?? 'Perpetual'}</p><p>Status: {isExpired? 'EXPIRED': daysRemaining!=null && daysRemaining<=90? 'EXPIRING':'ACTIVE'}</p><p className="panel__note">Expiry alerts: 90/60/30/7 days (policy)</p></div>}
      {tab==='history' && <div className="panel" style={{padding:16}}><h3>{text.history}</h3><table className="data-table"><thead><tr><th>Action</th><th>Actor</th><th>Time</th></tr></thead><tbody>{(data.history??[]).map((h:any)=><tr key={h.id}><td>{h.action}</td><td>{h.actor_id}</td><td>{h.created_at}</td></tr>)}</tbody></table></div>}
    </div>
  )
}
