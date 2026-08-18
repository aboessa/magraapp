import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'

const copy={
  ar:{ back:'عودة', loading:'تحميل', loadError:'تعذر', overview:'نظرة عامة', entitlements:'الاستحقاقات', limits:'الحدود', pricing:'التسعير', store:'منتجات المتجر', trials:'التجارب', promotions:'العروض', availability:'الإتاحة', subscribers:'المشتركون', history:'السجل', limitChange:'تغيير الحدود يؤثر على عائلات كثيرة — راجع الأثر', priceUnavailable:'التسعير غير متاح',
  },
  en:{ back:'Back', loading:'Loading', loadError:'Error', overview:'Overview', entitlements:'Entitlements', limits:'Limits', pricing:'Pricing', store:'Store products', trials:'Trials', promotions:'Promotions', availability:'Availability', subscribers:'Subscribers', history:'History', limitChange:'Changing limits affects many families — review impact', priceUnavailable:'Price unavailable',
  }
}
export function PlanWorkspacePage(){
  const { id='' }=useParams()
  const { locale }=usePreferences()
  const text=copy[locale==='en'?'en':'ar'] as any
  const [data,setData]=useState<any>(null)
  const [tab,setTab]=useState<'overview'|'pricing'|'store'|'subscribers'>('overview')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{ const r=await api.planDetail(id); setData(r.data)}catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[id, text.loadError])
  useEffect(()=>{ void load()},[load])
  if(loading) return <LoadingState label={text.loading}/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()}/>
  if(!data) return <EmptyState title={text.loadError} description={id}/>
  return (
    <div className="page-stack">
      <div className="panel" style={{padding:16}}>
        <div style={{display:'flex', justifyContent:'space-between'}}><div><h2><span className={`plan-badge plan-badge--${data.id}`}>{data.id}</span> {text.overview}</h2><p>Current subscribers: {data.subscribers} · Countries/offers: {(data.pricing??[]).length}</p></div><Link className="button button--ghost" to={adminPath('packages')}>{text.back}</Link></div>
        <div style={{display:'flex', gap:8, marginTop:12}}>
          {(['overview','pricing','store','subscribers'] as const).map(t=> <button key={t} className={`button ${tab===t?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab(t)}>{(text as any)[t] ?? t}</button>)}
        </div>
      </div>
      {tab==='overview' && <div className="panel" style={{padding:16}}><h3>{text.entitlements}</h3><table className="data-table"><thead><tr><th>Feature</th><th>Value</th></tr></thead><tbody>
        <tr><td>Children</td><td>{data.limits.children}</td></tr><tr><td>Devices</td><td>{data.limits.devices}</td></tr><tr><td>Concurrent streams</td><td>{data.limits.concurrent_streams}</td></tr><tr><td>Download devices</td><td>{data.limits.download_devices}</td></tr>
      </tbody></table><p className="panel__note" style={{marginTop:12}}>{text.limitChange} — use authorization/audit, show affected families, timing.</p></div>}
      {tab==='pricing' && <div className="panel" style={{padding:16}}><h3>{text.pricing}</h3>
        {(data.pricing??[]).length ? <table className="data-table"><thead><tr><th>Country</th><th>Store</th><th>Currency</th><th>Price</th><th>Status</th></tr></thead><tbody>{(data.pricing as any[]).map((p:any)=><tr key={p.id}><td>{p.country}</td><td>{p.provider}</td><td>{p.currency}</td><td>{p.price_minor!=null? (p.price_minor/100).toFixed(2): '—'}</td><td>{p.status}</td></tr>)}</tbody></table> : <EmptyState title={text.priceUnavailable} description="Price configuration unavailable"/>}
      </div>}
      {tab==='store' && <div className="panel" style={{padding:16}}><h3>{text.store}</h3><table className="data-table"><thead><tr><th>Store product ID</th><th>Provider</th><th>Billing period</th><th>Status</th></tr></thead><tbody>{(data.products??[]).map((p:any)=><tr key={p.id}><td dir="ltr">{p.store_product_id}</td><td>{p.provider}</td><td>{p.billing_period}</td><td>{p.status}</td></tr>)}</tbody></table><p className="panel__note">Plan → product mapping explicit, not inferred from price.</p></div>}
      {tab==='subscribers' && <div className="panel" style={{padding:16}}><h3>{text.subscribers}: {data.subscribers}</h3><Link className="button button--ghost button--small" to={adminPath(`billing?plan=${data.id}`)}>View subscriptions filtered to {data.id}</Link></div>}
    </div>
  )
}
