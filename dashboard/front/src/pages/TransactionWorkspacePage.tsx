import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'

const copy={ ar:{ back:'عودة', loading:'تحميل', loadError:'تعذر', transaction:'المعاملة', family:'العائلة', provider:'المزود', product:'المنتج', plan:'الخطة', country:'البلد', currency:'العملة', gross:'الإجمالي', status:'الحالة', verified:'التحقق', refund:'الاسترداد', audit:'التدقيق' }, en:{ back:'Back', loading:'Loading', loadError:'Error', transaction:'Transaction', family:'Family', provider:'Provider', product:'Product', plan:'Plan', country:'Country', currency:'Currency', gross:'Gross', status:'Status', verified:'Verified', refund:'Refund', audit:'Audit' } }
function formatMs(v:any, loc:string){ if(typeof v!=='number'||!v) return '—'; return new Date(v).toLocaleString(loc==='ar'?'ar-EG':'en-GB',{dateStyle:'medium', timeStyle:'short'})}
export function TransactionWorkspacePage(){
  const { id='' }=useParams()
  const { locale }=usePreferences()
  const text=copy[locale==='en'?'en':'ar'] as any
  const [data,setData]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{ const r=await api.transaction(id); setData(r.data)}catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[id, text.loadError])
  useEffect(()=>{ void load()},[load])
  if(loading) return <LoadingState label={text.loading}/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()}/>
  if(!data) return <EmptyState title={text.loadError} description={id}/>
  return (
    <div className="page-stack">
      <div className="panel" style={{padding:16}}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>{text.transaction} <code dir="ltr">{String(data.id).slice(0,12)}</code></h2><Link className="button button--ghost" to={adminPath('billing')}>{text.back}</Link></div>
        <dl style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
          <div><dt>{text.family}</dt><dd><Link to={adminPath(`customers/${data.parent_id}`)} dir="ltr">{String(data.parent_id).slice(0,16)}</Link></dd></div>
          <div><dt>{text.provider}</dt><dd>{data.provider}</dd></div>
          <div><dt>{text.product}</dt><dd dir="ltr">{data.product_id}</dd></div>
          <div><dt>{text.plan}</dt><dd><span className={`plan-badge plan-badge--${data.plan}`}>{data.plan}</span></dd></div>
          <div><dt>{text.status}</dt><dd>{data.entitlement_status} / {data.provider_state}</dd></div>
          <div><dt>{text.verified}</dt><dd>{formatMs(data.verified_at_ms, locale)}</dd></div>
          <div><dt>{text.refund}</dt><dd>{data.entitlement_status==='revoked'? 'Refunded/Revoked':'—'}</dd></div>
          <div><dt>Audit</dt><dd>{data.is_duplicate? <span className="status-badge status-badge--review">Duplicate token</span>: '—'}</dd></div>
        </dl>
        <p className="panel__note" style={{marginTop:12}}>Only actual provider data — no invented gross/store fee. Token hash shown truncated, private payload not exposed.</p>
        <div style={{marginTop:12}}><Link className="button button--ghost button--small" to={adminPath(`billing/subscription/${data.id}`)}>Subscription</Link> <Link className="button button--ghost button--small" to={adminPath(`customers/${data.parent_id}`)}>Family360</Link></div>
      </div>
      <div className="panel" style={{padding:16}}><h3>{text.audit}</h3><table className="data-table"><thead><tr><th>Action</th><th>Actor</th><th>Time</th></tr></thead><tbody>{(data.history??[]).map((h:any)=><tr key={h.id}><td>{h.action}</td><td>{h.actor_id ?? '—'}</td><td>{h.created_at}</td></tr>)}</tbody></table></div>
    </div>
  )
}
