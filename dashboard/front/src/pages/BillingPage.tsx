// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { BillingStats } from '../types/api'

// Subscriptions Operations Center — distinguishes provider vs entitlement
const copy = {
  ar: {
    eyebrow: 'التجارة', title: 'مركز الاشتراكات', lede: 'Google Play يثبت الشراء كمزوّد؛ FamilyState يمثل الاستحقاق الفعلي للعائلة. الفوترة تُظهر الحالتين ولا تختار واحدة صامتة.',
    refresh: 'تحديث',
    metricsActive:'اشتراكات نشطة', metricsGrace:'فترة سماح', metricsExpired:'منتهية', metricsMismatch:'تناقض استحقاق', metricsFailed:'فشل تحقق', metricsRefunded:'مستردة',
    tabs: { overview:'نظرة عامة', subscriptions:'الاشتراكات', transactions:'المعاملات', mismatches:'تناقضات', failed:'فشل تحقق' },
    search:'بحث بالعائلة أو المنتج...',
    family:'العائلة', plan:'الخطة', provider:'المزود', providerState:'حالة المزود', entitlement:'الاستحقاق الفعلي', renewal:'التجديد', country:'البلد',
    lastTx:'آخر معاملة', mismatch:'تنبيه', actions:'', open:'فتح',
    providerVsEntitlement:'حالة المزود مقابل الاستحقاق', noData:'لا بيانات', loadError:'تعذر التحميل',
    total:'الإجمالي',
  },
  en: {
    eyebrow: 'Commerce', title: 'Subscription Operations', lede: 'Google Play verifies as provider; FamilyState is effective entitlement. Billing shows both, never silently picks one.',
    refresh: 'Refresh',
    metricsActive:'Active subs', metricsGrace:'Grace', metricsExpired:'Expired', metricsMismatch:'Mismatches', metricsFailed:'Failed verification', metricsRefunded:'Refunded',
    tabs: { overview:'Overview', subscriptions:'Subscriptions', transactions:'Transactions', mismatches:'Mismatches', failed:'Failures' },
    search:'Search family or product...',
    family:'Family', plan:'Plan', provider:'Provider', providerState:'Provider state', entitlement:'Effective entitlement', renewal:'Renewal', country:'Country',
    lastTx:'Last transaction', mismatch:'Alert', actions:'', open:'Open',
    providerVsEntitlement:'Provider vs Entitlement', noData:'No data', loadError:'Unable to load',
    total:'Total',
  }
}
function formatMs(v: unknown, locale: 'ar'|'en'){
  if(typeof v!=='number'||!Number.isFinite(v)||v<=0) return '—'
  return new Date(v).toLocaleDateString(locale==='ar'?'ar-EG':'en-GB',{dateStyle:'medium'})
}

export function BillingPage(){
  const { locale }=usePreferences()
  const text=copy[locale=== 'ar'?'ar':'en'] as any
  const [searchParams,setSearchParams]=useSearchParams()
  const activeTab=(searchParams.get('tab') as any) || 'overview'
  const [stats,setStats]=useState<BillingStats|null>(null)
  const [subs,setSubs]=useState<any[]>([])
  const [mismatches,setMismatches]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [query,setQuery]=useState('')
  const [filterPlan,setFilterPlan]=useState('')

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const [s, subRes, recon]=await Promise.all([
        api.billingStats(),
        api.subscriptions({ q: query || undefined, plan: filterPlan || undefined, limit: 25, offset:0 } as any),
        api.commerceReconciliation().catch(()=> ({data:{mismatches:[]}}) as any),
      ])
      setStats(s.data)
      setSubs((subRes as any).data ?? [])
      setMismatches((recon as any).data?.mismatches ?? [])
    }catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[query, filterPlan, text.loadError])

  useEffect(()=>{ const t=setTimeout(()=>void load(), query?220:0); return ()=> clearTimeout(t)},[load])

  const setTab=(t:string)=>{ const n=new URLSearchParams(searchParams); n.set('tab',t); setSearchParams(n) }

  const metrics = {
    active: (stats?.by_plan ?? []).reduce((a:any,c:any)=> a+Number(c.count),0),
    grace: subs.filter((s:any)=> s.entitlement_status==='grace').length,
    expired: subs.filter((s:any)=> s.entitlement_status==='expired').length,
    mismatches: mismatches.length,
    refunded: subs.filter((s:any)=> s.entitlement_status==='revoked').length,
  }

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div><button className="button button--secondary" onClick={()=>void load()}><Icon name="refresh" size={17}/>{text.refresh}</button></section>

      <section className="stat-grid" role="list">
        <Link to={adminPath('billing?tab=subscriptions')} className="stat-card" style={{textDecoration:'none'}}><span>{text.metricsActive}</span><strong>{metrics.active}</strong></Link>
        <div className="stat-card"><span>{text.metricsGrace}</span><strong>{metrics.grace}</strong></div>
        <div className="stat-card"><span>{text.metricsExpired}</span><strong>{metrics.expired}</strong></div>
        <Link to={adminPath('billing?tab=mismatches')} className="stat-card" style={{textDecoration:'none', borderColor: metrics.mismatches? '#d97706': undefined}}><span>{text.metricsMismatch}</span><strong style={{color: metrics.mismatches? '#b45309': undefined}}>{metrics.mismatches}</strong></Link>
        <div className="stat-card"><span>{text.metricsRefunded}</span><strong>{metrics.refunded}</strong></div>
      </section>

      <div className="detail-tabs" role="tablist" style={{display:'flex', gap:8, overflowX:'auto'}}>
        {(['overview','subscriptions','transactions','mismatches'] as const).map(t=>(
          <button key={t} role="tab" aria-selected={activeTab===t} className={`button ${activeTab===t?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab(t)}>{(text.tabs as any)[t] ?? t}</button>
        ))}
      </div>

      {loading ? <LoadingState/> : error ? <ErrorState message={error} onRetry={()=>void load()} /> : (
        <>
          {activeTab==='overview' && stats && (
            <div className="panel" style={{padding:16}}>
              <h3>{text.providerVsEntitlement}</h3>
              <p className="panel__note">Google Play ACTIVE vs Family entitlement ACTIVE → {locale==='ar'?'متطابق':'MATCH'}; Google Play ACTIVE vs EXPIRED → {locale==='ar'?'تناقض':'MISMATCH'} (diagnostic)</p>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:12}}>
                <div><h4>By plan</h4><table className="data-table"><thead><tr><th>{text.plan}</th><th>{text.total}</th></tr></thead><tbody>{(stats.by_plan??[]).map((r:any)=><tr key={r.plan}><td><span className={`plan-badge plan-badge--${r.plan}`}>{r.plan}</span></td><td>{r.count}</td></tr>)}</tbody></table></div>
                <div><h4>Recent purchases</h4><table className="data-table"><thead><tr><th>{text.family}</th><th>{text.provider}</th><th>{text.entitlement}</th></tr></thead><tbody>{(stats.recent_purchases??[]).slice(0,5).map((p:any,i:number)=><tr key={i}><td dir="ltr">{String(p.parent_id).slice(0,8)}</td><td>{String(p.provider_state)}</td><td>{String(p.entitlement_status)}</td></tr>)}</tbody></table></div>
              </div>
              <div style={{marginTop:16}}><Link className="button button--ghost button--small" to={adminPath('customers')}>Family360 → Subscription</Link></div>
            </div>
          )}

          {(activeTab==='subscriptions' || activeTab==='overview') && (
            <section className="panel panel--table">
              <header className="panel__header" style={{display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
                <h3>{text.tabs.subscriptions} <span className="title-count">{subs.length}</span></h3>
                <div style={{display:'flex', gap:8}}>
                  <input value={query} onChange={e=> setQuery(e.target.value)} placeholder={text.search} style={{padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)'}}/>
                  <select value={filterPlan} onChange={e=> setFilterPlan(e.target.value)}><option value="">{text.plan}</option><option value="family">family</option><option value="family_plus">family_plus</option></select>
                </div>
              </header>
              {subs.length ? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.family}</th><th>{text.plan}</th><th>{text.provider}</th><th>{text.providerState}</th><th>{text.entitlement}</th><th>{text.renewal}</th><th>{text.mismatch}</th><th></th></tr></thead><tbody>
                {subs.map((r:any)=><tr key={r.id}>
                  <td><Link to={adminPath(`customers/${r.parent_id}`)} style={{textDecoration:'none'}}><strong dir="ltr">{String(r.parent_id).slice(0,12)}</strong><br/><small>{r.family_name ?? ''}</small></Link></td>
                  <td><span className={`plan-badge plan-badge--${r.plan}`}>{r.plan}</span></td>
                  <td>{r.provider}</td>
                  <td><span className={`account-status ${r.provider_state==='active'?'account-status--active':'account-status--archived'}`}>{r.provider_state}</span></td>
                  <td><span className={`account-status ${r.entitlement_status==='active'?'account-status--active':'account-status--archived'}`}>{r.entitlement_status}</span></td>
                  <td>{formatMs(r.expires_at_ms, locale as any)}</td>
                  <td>{r.has_mismatch ? <span className="status-badge status-badge--review">Mismatch</span> : <span className="table-secondary">—</span>}</td>
                  <td><Link className="button button--ghost button--small" to={adminPath(`billing/subscription/${r.id}`)}>{text.open}</Link></td>
                </tr>)}
              </tbody></table></div> : <EmptyState title={text.noData} description="No subscriptions yet" />}
            </section>
          )}

          {activeTab==='transactions' && (
            <section className="panel panel--table"><div style={{padding:16}}><h3>Transactions</h3><p className="panel__note">Each row opens Transaction Workspace</p>
              <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>ID</th><th>{text.family}</th><th>Product</th><th>Verified</th><th></th></tr></thead><tbody>
                {subs.slice(0,10).map((r:any)=><tr key={r.id}><td dir="ltr">{r.id.slice(0,8)}</td><td dir="ltr">{r.parent_id.slice(0,8)}</td><td dir="ltr">{r.product_id}</td><td>{formatMs(r.verified_at_ms, locale as any)}</td><td><Link className="button button--ghost button--small" to={adminPath(`billing/transaction/${r.id}`)}>{text.open}</Link></td></tr>)}
              </tbody></table></div>
            </div></section>
          )}

          {activeTab==='mismatches' && (
            <section className="panel panel--table"><div style={{padding:16}}>
              <h3>Entitlement mismatches</h3>
              {mismatches.length ? <table className="data-table"><thead><tr><th>Family</th><th>Provider</th><th>Entitlement</th><th>Action</th></tr></thead><tbody>
                {mismatches.map((m:any,i:number)=><tr key={i}><td dir="ltr">{m.parent_id.slice(0,8)}</td><td>{m.provider_state}</td><td>{m.entitlement_status}</td><td><Link className="button button--ghost button--small" to={adminPath(`billing/subscription/${m.parent_id}`)}>Reconcile</Link></td></tr>)}
              </tbody></table> : <EmptyState title="No mismatches" description="Provider and entitlement aligned" />}
            </div></section>
          )}
        </>
      )}
    </div>
  )
}
