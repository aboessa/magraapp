import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'

const copy={
  ar:{ back:'العودة', loading:'تحميل...', loadError:'تعذر', overview:'نظرة عامة', transactions:'المعاملات', entitlement:'الاستحقاق', provider:'حالة المزود', renewal:'التجديد', history:'السجل', support:'الدعم', audit:'التدقيق', mismatch:'تناقض استحقاق', renew:'التجديد', family:'العائلة', plan:'الخطة' },
  en:{ back:'Back', loading:'Loading...', loadError:'Error', overview:'Overview', transactions:'Transactions', entitlement:'Entitlement', provider:'Provider', renewal:'Renewal', history:'History', support:'Support', audit:'Audit', mismatch:'ENTITLEMENT MISMATCH', renew:'Renewal', family:'Family', plan:'Plan' }
}
function formatMs(v:any, locale:string){
  if(typeof v!=='number'||!v) return '—'
  return new Date(v).toLocaleDateString(locale==='ar'?'ar-EG':'en-GB',{dateStyle:'medium'})
}
export function SubscriptionWorkspacePage(){
  const { id='' }=useParams()
  const { locale }=usePreferences()
  const text=copy[locale==='en'?'en':'ar'] as any
  const [data,setData]=useState<any>(null)
  const [tab,setTab]=useState<'overview'|'transactions'|'entitlement'|'provider'|'renewal'>('overview')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{ const res=await api.subscription(id); setData(res.data)}catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[id, text.loadError])
  useEffect(()=>{ void load()},[load])
  if(loading) return <LoadingState label={text.loading}/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()}/>
  if(!data) return <EmptyState title={text.loadError} description={id}/>
  const mismatch=data.has_mismatch
  return (
    <div className="page-stack">
      <div className="panel" style={{padding:16}}>
        <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
          <div><h2>{text.family}: <Link to={adminPath(`customers/${data.parent_id}`)} dir="ltr">{String(data.parent_id).slice(0,16)}</Link></h2>
            <p><span className={`plan-badge plan-badge--${data.plan}`}>{data.plan}</span> · {data.provider} · <span className={`account-status ${data.provider_state==='active'?'account-status--active':'account-status--archived'}`}>{data.provider_state}</span> · <span className={`account-status ${data.entitlement_status==='active'?'account-status--active':'account-status--archived'}`}>{data.entitlement_status}</span></p>
            {mismatch && <div className="inline-alert inline-alert--error">Google Play: {data.provider_state} vs Family entitlement: {data.entitlement_status} → {text.mismatch}</div>}
          </div>
          <Link className="button button--ghost" to={adminPath('billing')}>{text.back}</Link>
        </div>
        <div style={{display:'flex', gap:8, marginTop:12, overflowX:'auto'}}>
          {(['overview','transactions','entitlement','provider','renewal'] as const).map(t=> <button key={t} className={`button ${tab===t?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab(t)}>{(text as any)[t] ?? t}</button>)}
        </div>
      </div>
      {tab==='overview' && <div className="panel" style={{padding:16}}><dl style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}><div><dt>{text.plan}</dt><dd>{data.plan}</dd></div><div><dt>{text.provider}</dt><dd>{data.provider} — {data.product_id}</dd></div><div><dt>Provider state</dt><dd>{data.provider_state}</dd></div><div><dt>Effective entitlement</dt><dd>{data.entitlement_status}</dd></div><div><dt>{text.renew}</dt><dd>{formatMs(data.expires_at_ms, locale)}</dd></div><div><dt>Verified</dt><dd>{formatMs(data.verified_at_ms, locale)}</dd></div></dl>
        <div style={{marginTop:12}}><Link className="button button--ghost button--small" to={adminPath(`customers/${data.parent_id}`)}>Family360</Link> <Link className="button button--ghost button--small" to={adminPath(`billing/transaction/${data.id}`)}>Transaction</Link></div>
        <p className="panel__note" style={{marginTop:12}}>No fake Cancel/Refund — provider actions unavailable, read-only. Repair via canonical reconciliation (elevated, reason, audit) if supported.</p>
      </div>}
      {tab==='transactions' && <div className="panel" style={{padding:16}}><h3>Transactions</h3><table className="data-table"><thead><tr><th>Product</th><th>Provider</th><th>Entitlement</th><th>Verified</th></tr></thead><tbody>{(data.related_transactions??[]).map((r:any)=><tr key={r.id}><td dir="ltr">{r.product_id}</td><td>{r.provider_state}</td><td>{r.entitlement_status}</td><td>{formatMs(r.verified_at_ms, locale)}</td></tr>)}</tbody></table></div>}
      {tab==='entitlement' && <div className="panel" style={{padding:16}}><h3>{text.entitlement}</h3><p>Effective plan from FamilyState: {data.family_entitlement?.plan ?? data.plan}</p><p className="panel__note">FamilyState is authority — D1 projection not conflicting.</p></div>}
      {tab==='provider' && <div className="panel" style={{padding:16}}><h3>{text.provider}</h3><p>Provider: {data.provider}</p><p>Provider state: {data.provider_state}</p><p>Token hash: <code dir="ltr">{String(data.purchase_token_hash).slice(0,12)}…</code> (private payload not exposed)</p></div>}
      {tab==='renewal' && <div className="panel" style={{padding:16}}><h3>{text.renewal}</h3><p>Expires: {formatMs(data.expires_at_ms, locale)}</p><p>Starts: {formatMs(data.starts_at_ms, locale)}</p></div>}
    </div>
  )
}
