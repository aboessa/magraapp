// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'

const copy={
  ar:{
    eyebrow:'التجارة', title:'الباقات والأسعار', lede:'الخطة = مزايا/حدود؛ السعر = عرض تجاري حسب البلد/المتجر/العملة/الوقت.',
    plan:'الباقة', children:'ملفات الأطفال', devices:'الأجهزة', streams:'المشاهدة المتزامنة', downloads:'أجهزة التنزيل',
    limitsTitle:'الحدود القانونية', pricingTitle:'مصفوفة التسعير', comparison:'مقارنة الباقات',
    storeProducts:'منتجات المتجر', promotions:'العروض', noPricing:'لا تسعير مهيأ', noPricingHint:'التسعير حسب البلد/المتجر غير متاح بعد — مصفوفة الأسعار فارغة.',
    source:'مصدر الحدود: FamilyState (سياسة موحدة)', storeHint:'الخطة ← منتج مزود خارجي (Google Play)',
  },
  en:{
    eyebrow:'Commerce', title:'Plans & Pricing', lede:'Plan = entitlements/limits; Price = commercial offer per country/store/currency/time.',
    plan:'Plan', children:'Child profiles', devices:'Devices', streams:'Concurrent streams', downloads:'Download devices',
    limitsTitle:'Entitlement limits', pricingTitle:'Pricing matrix', comparison:'Plan comparison',
    storeProducts:'Store products', promotions:'Promotions', noPricing:'No pricing configured', noPricingHint:'Country/store pricing unavailable — matrix empty.',
    source:'Limit source: FamilyState policy', storeHint:'Plan → external provider product (Google Play)',
  }
}

export function PackagesPage(){
  const { locale }=usePreferences()
  const text=copy[locale as 'ar'|'en'] as any
  const [catalogue,setCatalogue]=useState<any>(null)
  const [pricing,setPricing]=useState<any[]>([])
  const [plansDetail,setPlansDetail]=useState<Record<string,any>>({})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)

  const load=useCallback(async()=>{
    setLoading(true); setError(null)
    try{
      const [cat, matrix]=await Promise.all([
        api.plans(),
        api.pricingMatrix({} as any).catch(()=> ({data:[]}) as any),
      ])
      setCatalogue(cat.data)
      setPricing((matrix as any).data ?? [])
      // Load per-plan details for subscribers count
      const details:Record<string,any>={}
      for(const p of (cat.data as any).plans ?? []){
        try{ const d=await api.planDetail(p.id); details[p.id]= (d as any).data }catch{ details[p.id]=null }
      }
      setPlansDetail(details)
    }catch(e){ setError(e instanceof Error? e.message: 'Error')} finally{ setLoading(false)}
  },[])
  useEffect(()=>{ void load()},[load])

  if(loading) return <LoadingState/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()} />

  const plans=catalogue?.plans ?? []
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div></section>

      {/* Limits */}
      <section className="panel panel--table"><div className="panel__header"><h3>{text.limitsTitle}</h3><span className="panel__note">{text.source}</span></div>
        {plans.length ? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.plan}</th><th>{text.children}</th><th>{text.devices}</th><th>{text.streams}</th><th>{text.downloads}</th><th>Subscribers</th><th></th></tr></thead><tbody>
          {plans.map((p:any)=><tr key={p.id}><td><Link to={adminPath(`plans/${p.id}`)}><span className="table-primary">{p.id}</span></Link></td><td>{p.limits.children}</td><td>{p.limits.devices}</td><td>{p.limits.concurrent_streams}</td><td>{p.limits.download_devices}</td><td>{plansDetail[p.id]?.subscribers ?? '—'}</td><td><Link className="button button--ghost button--small" to={adminPath(`plans/${p.id}`)}>Workspace</Link></td></tr>)}
        </tbody></table></div> : <EmptyState title="No plans" description="No policy limits"/>}
      </section>

      {/* Comparison */}
      <section className="panel"><div className="panel__header"><h3>{text.comparison}</h3></div>
        <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>Feature</th><th>Free</th><th>Family</th><th>Family Plus</th></tr></thead><tbody>
          <tr><td>{text.children}</td><td>{plans.find((p:any)=>p.id==='free')?.limits.children ?? 1}</td><td>{plans.find((p:any)=>p.id==='family')?.limits.children ?? 4}</td><td>{plans.find((p:any)=>p.id==='family_plus')?.limits.children ?? 4}</td></tr>
          <tr><td>{text.devices}</td><td>{plans.find((p:any)=>p.id==='free')?.limits.devices ?? 1}</td><td>{plans.find((p:any)=>p.id==='family')?.limits.devices ?? 4}</td><td>{plans.find((p:any)=>p.id==='family_plus')?.limits.devices ?? 8}</td></tr>
          <tr><td>{text.streams}</td><td>1</td><td>2</td><td>4</td></tr>
          <tr><td>{text.downloads}</td><td>0</td><td>2</td><td>4</td></tr>
        </tbody></table></div>
      </section>

      {/* Store products */}
      <section className="panel panel--table"><div className="panel__header"><h3>{text.storeProducts}</h3><span className="panel__note">{text.storeHint}</span></div>
        {plans.length ? <div style={{padding:12, display:'grid', gap:8}}>
          {plans.map((p:any)=>(
            <div key={p.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8}}>
              <span><strong>{p.id}</strong> → {(plansDetail[p.id]?.products??[]).map((sp:any)=> sp.store_product_id).join(', ') || 'no product'}</span>
              <Link className="button button--ghost button--small" to={adminPath(`plans/${p.id}`)}>Products</Link>
            </div>
          ))}
        </div> : null}
      </section>

      {/* Pricing matrix */}
      <section className="panel panel--table"><div className="panel__header" style={{display:'flex', justifyContent:'space-between'}}><h3>{text.pricingTitle}</h3><Link className="button button--ghost button--small" to={adminPath('plans/family')}>Open matrix</Link></div>
        {pricing.length ? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>Plan × Country × Store</th><th>Currency</th><th>Current price</th><th>Product</th><th>Status</th><th>Effective</th></tr></thead><tbody>
          {pricing.slice(0,10).map((r:any)=><tr key={r.id}><td>{r.plan} × {r.country} × {r.provider}</td><td>{r.currency}</td><td>{r.price_minor!=null? (r.price_minor/100).toFixed(2): '—'}</td><td dir="ltr">{r.store_product_id}</td><td>{r.status}</td><td>{String(r.effective_from).slice(0,10)}</td></tr>)}
        </tbody></table></div> : <EmptyState title={text.noPricing} description={text.noPricingHint} />}
        {!pricing.length && <div className="panel__note" style={{padding:12}}>Price configuration unavailable — implement store integration honestly, no guessed prices.</div>}
      </section>

      <section className="panel panel--notice"><strong>{text.source}</strong><p>FamilyState is authoritative for limits; dashboard not separate manual copy.</p></section>
    </div>
  )
}
