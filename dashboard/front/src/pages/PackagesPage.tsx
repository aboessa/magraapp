import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { CommerceControls } from '../components/CommerceControls'

const copy={
  ar:{
    eyebrow:'التجارة · الباقات',
    title:'الباقات والأسعار',
    lede:'الخطة = استحقاق موحد من FamilyState. السعر = عرض تجاري حسب البلد والمتجر. لا نسخ يدوية للحدود.',
    limitsTitle:'حدود الاستحقاق', source:'المصدر الوحيد: FamilyState policy',
    pricingTitle:'مصفوفة التسعير',
    comparison:'مقارنة الميزات',
    storeProducts:'منتجات المتجر', promotions:'العروض',
    googleTitle:'أسعار Google Play الحية',
    googleDesc:'الأسعار الحية تُقرأ من Google Play. المسودة تسجل نية التغيير، والنشر يغير Base Plan والبلد في Google Play فعلياً.',
    noPricing:'لا تسعير', noPricingHint:'اختر منتجاً لعرض الأسعار الإقليمية.',
    plan:{ free:'المجانية', family:'العائلة', family_plus:'العائلة بلس' },
    feat:{ children:'ملفات الأطفال', devices:'الأجهزة', streams:'المشاهدة المتزامنة', downloads:'التنزيل للأوفلاين' },
    cta:'مساحة العمل', subs:'مشتركين',
  },
  en:{
    eyebrow:'Commerce · Plans',
    title:'Plans & Pricing',
    lede:'Plan = unified entitlement from FamilyState. Price = commercial offer per country & store. No manual copy of limits.',
    limitsTitle:'Entitlement limits', source:'Single source: FamilyState policy',
    pricingTitle:'Pricing matrix',
    comparison:'Feature comparison',
    storeProducts:'Store products', promotions:'Promotions',
    googleTitle:'Live Google Play prices',
    googleDesc:'Live prices read from Google Play. Draft records intent, publishing mutates the base plan & country in Google Play.',
    noPricing:'No pricing', noPricingHint:'Select a product to view regional prices.',
    plan:{ free:'Free', family:'Family', family_plus:'Family Plus' },
    feat:{ children:'Child profiles', devices:'Devices', streams:'Concurrent streams', downloads:'Offline downloads' },
    cta:'Workspace', subs:'Subscribers',
  }
}

export function PackagesPage(){
  const { locale }=usePreferences()
  const text=copy[locale as 'ar'|'en'] as any
  const [catalogue,setCatalogue]=useState<any>(null)
  const [plansDetail,setPlansDetail]=useState<Record<string,any>>({})
  const [googleProducts,setGoogleProducts]=useState<Array<{product_id:string;plan:string}>>([])
  const [selectedGoogleProduct,setSelectedGoogleProduct]=useState('')
  const [googlePrices,setGooglePrices]=useState<any>(null)
  const [googleDrafts,setGoogleDrafts]=useState<any[]>([])
  const [country,setCountry]=useState('')
  const [draftForm,setDraftForm]=useState({base_plan_id:'',region_code:'',currency_code:'',units:'',nanos:'0'})
  const [priceError,setPriceError]=useState('')
  const [priceNotice,setPriceNotice]=useState('')
  const [priceBusy,setPriceBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)

  const load=useCallback(async()=>{
    setLoading(true); setError(null)
    try{
      const [cat, google]=await Promise.all([
        api.plans(),
        api.googlePlayProducts().catch(()=> ({data:[]}) as any),
      ])
      setCatalogue(cat.data)
      const products=(google as any).data ?? []
      setGoogleProducts(products)
      setSelectedGoogleProduct((current)=> current || products[0]?.product_id || '')
      const details:Record<string,any>={}
      for(const p of (cat.data as any).plans ?? []){
        try{ const d=await api.planDetail(p.id); details[p.id]= (d as any).data }catch{ details[p.id]=null }
      }
      setPlansDetail(details)
    }catch(e){ setError(e instanceof Error? e.message: 'Error')} finally{ setLoading(false)}
  },[])
  useEffect(()=>{ void load()},[load])

  const loadGooglePricing=useCallback(async(productId:string)=>{
    if(!productId) return
    setPriceBusy(true); setPriceError(''); setPriceNotice('')
    try{
      const [prices,drafts]=await Promise.all([
        api.googlePlayPrices(productId),
        api.googlePlayPriceDrafts(productId),
      ])
      setGooglePrices((prices as any).data)
      setGoogleDrafts((drafts as any).data ?? [])
    }catch(e){ setPriceError(e instanceof Error?e.message:'Unable to load Google Play prices') }
    finally{ setPriceBusy(false) }
  },[])

  useEffect(()=>{ void loadGooglePricing(selectedGoogleProduct) },[loadGooglePricing,selectedGoogleProduct])

  const plans=catalogue?.plans ?? []
  const free = plans.find((p:any)=>p.id==='free')
  const family = plans.find((p:any)=>p.id==='family')
  const familyPlus = plans.find((p:any)=>p.id==='family_plus')

  const choosePrice=(basePlanId:string,config:any)=>{
    const price=config.price
    setDraftForm({
      base_plan_id:basePlanId,
      region_code:config.region_code,
      currency_code:price?.currencyCode ?? '',
      units:price?.units ?? '',
      nanos:String(price?.nanos ?? 0),
    })
    setPriceNotice('')
  }

  const addCountryPrice=()=>{
    const firstBasePlan=googlePrices?.base_plans?.[0]?.base_plan_id ?? ''
    setDraftForm({ base_plan_id:firstBasePlan, region_code:country, currency_code:'', units:'', nanos:'0' })
    setPriceNotice('')
  }

  const createGoogleDraft=async()=>{
    if(!selectedGoogleProduct) return
    setPriceBusy(true); setPriceError(''); setPriceNotice('')
    try{
      const result=await api.createGooglePlayPriceDraft({
        product_id:selectedGoogleProduct,
        base_plan_id:draftForm.base_plan_id,
        region_code:draftForm.region_code,
        currency_code:draftForm.currency_code,
        units:draftForm.units,
        nanos:Number(draftForm.nanos),
      })
      setPriceNotice(`Draft ${result.data.id} created. Review below before publishing.`)
      await loadGooglePricing(selectedGoogleProduct)
    }catch(e){ setPriceError(e instanceof Error?e.message:'Unable to create draft') }
    finally{ setPriceBusy(false) }
  }

  const publishGoogleDraft=async(draft:any)=>{
    const confirmation=window.prompt(`Type this draft ID to publish:\n${draft.id}`)
    if(confirmation===null) return
    setPriceBusy(true); setPriceError(''); setPriceNotice('')
    try{
      await api.publishGooglePlayPriceDraft(draft.id,confirmation)
      setPriceNotice('Google Play accepted the price change.')
      await loadGooglePricing(selectedGoogleProduct)
    }catch(e){ setPriceError(e instanceof Error?e.message:'Google Play did not accept') }
    finally{ setPriceBusy(false) }
  }

  if(loading) return <LoadingState/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()} />

  return (
    <div className="page-stack" style={{ gap:20 }}>
      <style>{`
        .pkg-hero{position:relative;border-radius:20px;border:1px solid var(--line);background:linear-gradient(165deg, var(--surface), color-mix(in srgb, var(--surface-2) 84%, var(--surface)));padding:22px}
        .pkg-hero::before{content:'';position:absolute;inset:0;border-radius:inherit;background:radial-gradient(520px 200px at 85% -10%, rgba(86,121,242,.14), transparent 60%), radial-gradient(420px 220px at -5% 120%, rgba(255,211,77,.10), transparent 70%)}
        .pkg-hero>*{position:relative}
        .pkg-kicker{display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);font-size:10px;font-weight:700;color:var(--muted)}
        .pkg-title{margin-top:12px;font-size:clamp(22px,2.6vw,30px);letter-spacing:-.04em}
        .pkg-lede{margin-top:8px;max-width:680px;color:var(--text-soft);font-size:12px;line-height:1.7}
        .tier-grid{display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:14px}
        @media(max-width:980px){.tier-grid{grid-template-columns:1fr}}
        .tier{position:relative;border-radius:18px;border:1px solid var(--line);background:linear-gradient(180deg, var(--surface), var(--surface-2));padding:18px;display:flex;flex-direction:column;overflow:hidden;transition:transform .18s, border-color .18s}
        .tier:hover{transform:translateY(-2px);border-color:var(--line-strong)}
        .tier--family{border-color:rgba(86,121,242,.22);background:linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, rgba(86,121,242,.06)), var(--surface-2))}
        .tier--family_plus{border-color:rgba(255,211,77,.28);background:linear-gradient(180deg, color-mix(in srgb, var(--surface) 92%, rgba(255,211,77,.08)), var(--surface-2))}
        .tier__head{display:flex;justify-content:space-between;align-items:start;gap:12px}
        .tier__name{font-size:14px;font-weight:800;letter-spacing:-.02em}
        .tier__badge{display:inline-flex;height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;border:1px solid var(--line);background:var(--surface-2);color:var(--muted)}
        .tier__limits{margin-top:14px;display:grid;gap:10px}
        .limit-row{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line);font-size:11px}
        .limit-row b{font-size:13px}
        .tier__foot{margin-top:auto;padding-top:14px;display:flex;justify-content:space-between;align-items:center}
        .compare{border:1px solid var(--line);border-radius:16px;background:var(--surface);overflow:hidden}
        .compare__head{padding:14px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
        .compare table{width:100%;border-collapse:collapse}
        .compare th{height:40px;padding:0 14px;text-align:start;color:var(--muted);font-size:10px;font-weight:700;border-bottom:1px solid var(--line);background:var(--surface-2)}
        .compare td{height:52px;padding:0 14px;border-bottom:1px solid var(--line);font-size:11px}
        .check{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(34,184,120,.12);color:#0e7a4d;font-weight:800;font-size:11px}
        .gp-card{border:1px solid var(--line);border-radius:16px;background:var(--surface);overflow:hidden}
        .gp-card__head{padding:16px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}
        .gp-select{height:38px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);padding:0 12px;font-size:12px;min-width:260px}
        .price-pill{display:inline-flex;height:22px;padding:0 8px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);font-size:10px;font-weight:700}
        .draft-box{border:1px dashed var(--line-strong);border-radius:12px;background:linear-gradient(135deg, rgba(86,121,242,.05), rgba(0,214,245,.04));padding:14px}
      `}</style>

      <section className="pkg-hero">
        <span className="pkg-kicker"><Icon name="sparkles" size={12}/>{text.eyebrow}</span>
        <h2 className="pkg-title">{text.title}</h2>
        <p className="pkg-lede">{text.lede}</p>
      </section>

      <div className="tier-grid">
        {[
          { id:'free', data:free, tone:'', label:text.plan.free, popular:false },
          { id:'family', data:family, tone:'tier--family', label:text.plan.family, popular:true },
          { id:'family_plus', data:familyPlus, tone:'tier--family_plus', label:text.plan.family_plus, popular:false },
        ].map(card=>(
          <div key={card.id} className={`tier ${card.tone}`}>
            <div className="tier__head">
              <div><div className="tier__name">{card.label}<span style={{ marginInlineStart:8, fontWeight:400, color:'var(--muted)', fontSize:11 }}>{card.id}</span></div><small style={{ color:'var(--muted)', fontSize:11 }}>{text.subs}: {plansDetail[card.id]?.subscribers ?? '—'}</small></div>
              <span className="tier__badge">{card.popular ? (locale==='ar'?'الأكثر اختياراً':'Most popular') : (card.id==='free'?'Free':'Plus')}</span>
            </div>
            <div className="tier__limits">
              <div className="limit-row"><span>{text.feat.children}</span><b>{card.data?.limits?.children ?? '—'}</b></div>
              <div className="limit-row"><span>{text.feat.devices}</span><b>{card.data?.limits?.devices ?? '—'}</b></div>
              <div className="limit-row"><span>{text.feat.streams}</span><b>{card.data?.limits?.concurrent_streams ?? '—'}</b></div>
              <div className="limit-row"><span>{text.feat.downloads}</span><b>{card.data?.limits?.download_devices ?? '—'}</b></div>
            </div>
            <div className="tier__foot">
              <span style={{ color:'var(--muted)', fontSize:10 }}>{text.source}</span>
              <Link className="button button--ghost button--small" to={adminPath(`plans/${card.id}`)}>{text.cta}</Link>
            </div>
          </div>
        ))}
      </div>

      <section className="compare">
        <div className="compare__head"><h3 style={{ fontSize:13 }}>{text.comparison}</h3><span style={{ color:'var(--muted)', fontSize:10 }}>{text.source}</span></div>
        <div className="table-scroll" tabIndex={0}><table><thead><tr><th>{text.feat.children}</th><th>Free</th><th>Family</th><th>Family Plus</th></tr></thead><tbody>
          <tr><td>{text.feat.children}</td><td>{free?.limits?.children ?? 1}</td><td>{family?.limits?.children ?? 4}</td><td>{familyPlus?.limits?.children ?? 4}</td></tr>
          <tr><td>{text.feat.devices}</td><td>{free?.limits?.devices ?? 1}</td><td>{family?.limits?.devices ?? 4}</td><td>{familyPlus?.limits?.devices ?? 8}</td></tr>
          <tr><td>{text.feat.streams}</td><td>1</td><td>2</td><td>4</td></tr>
          <tr><td>{text.feat.downloads}</td><td>0</td><td><span className="check">✓</span> 2</td><td><span className="check">✓</span> 4</td></tr>
        </tbody></table></div>
      </section>

      <CommerceControls onChanged={()=>void load()} />

      <section className="gp-card">
        <div className="gp-card__head">
          <div><h3 style={{ fontSize:13 }}>{text.googleTitle}</h3><p style={{ color:'var(--muted)', fontSize:11, marginTop:4, maxWidth:560, lineHeight:1.6 }}>{text.googleDesc}</p></div>
          <button className="button button--secondary button--small" disabled={!selectedGoogleProduct||priceBusy} onClick={()=>void loadGooglePricing(selectedGoogleProduct)}><Icon name="refresh" size={14}/>Refresh</button>
        </div>
        {googleProducts.length ? <div style={{ padding:16, display:'grid', gap:16 }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'end' }}>
            <label style={{ display:'grid', gap:6, minWidth:300 }}><span style={{ fontSize:10, fontWeight:700, color:'var(--muted)' }}>Subscription product</span>
              <select className="gp-select" value={selectedGoogleProduct} onChange={e=>setSelectedGoogleProduct(e.target.value)} disabled={priceBusy}>
                {googleProducts.map(p=><option key={p.product_id} value={p.product_id}>{p.plan} · {p.product_id}</option>)}
              </select>
            </label>
            <label style={{ display:'grid', gap:6 }}><span style={{ fontSize:10, color:'var(--muted)' }}>{locale==='ar'?'فلترة بلد':'Country filter'}</span><input value={country} onChange={e=>setCountry(e.target.value.toUpperCase())} placeholder="EG, SA, US" maxLength={2} style={{ height:38, borderRadius:10, border:'1px solid var(--line)', background:'var(--surface-2)', padding:'0 12px', width:140 }}/></label>
            <button className="button button--ghost button--small" disabled={!googlePrices?.base_plans?.length||priceBusy} onClick={addCountryPrice}>Add country price</button>
          </div>

          {priceError && <div className="inline-alert inline-alert--error">{priceError}</div>}
          {priceNotice && <div className="inline-alert inline-alert--success">{priceNotice}</div>}

          {googlePrices && <>
            <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--surface-2)', border:'1px solid var(--line)', display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
              <span><strong style={{ fontSize:11 }}>Regions version:</strong> <span dir="ltr" style={{ fontSize:11 }}>{googlePrices.regions_version}</span></span>
              <span style={{ color:'var(--muted)', fontSize:10 }}>New subscribers only — cohort migration separate in Google Play</span>
            </div>

            <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>Base plan</th><th>Country</th><th>Current price</th><th>New subs</th><th></th></tr></thead><tbody>
              {googlePrices.base_plans.flatMap((base:any)=>base.regional_configs.filter((c:any)=>!country||c.region_code===country).map((c:any)=><tr key={`${base.base_plan_id}:${c.region_code}`}><td dir="ltr" style={{ fontSize:11, fontWeight:700 }}>{base.base_plan_id}</td><td><span className="price-pill">{c.region_code}</span></td><td dir="ltr" style={{ fontSize:11 }}>{c.price?`${c.price.currencyCode} ${c.price.units}${c.price.nanos?'.'+String(c.price.nanos).padStart(9,'0'):''}`:'—'}</td><td><span className={`status-badge ${c.new_subscriber_availability?'status-badge--published':'status-badge--archived'}`} style={{ fontSize:10 }}>{c.new_subscriber_availability?'Available':'Unavailable'}</span></td><td><button className="button button--ghost button--small" disabled={!c.price||priceBusy} onClick={()=>choosePrice(base.base_plan_id,c)}>Change</button></td></tr>))}
            </tbody></table></div>
          </>}

          {draftForm.base_plan_id && <div className="draft-box">
            <h4 style={{ fontSize:12, marginBottom:4 }}>New price draft</h4><p style={{ color:'var(--muted)', fontSize:11, marginBottom:12 }}>Does not mutate Google Play yet — records proposal against live price. Currency validated on publish.</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:10 }}>
              <label style={{ display:'grid', gap:5 }}><span style={{ fontSize:10, color:'var(--muted)' }}>Base plan</span><select value={draftForm.base_plan_id} dir="ltr" onChange={e=>setDraftForm({...draftForm,base_plan_id:e.target.value})} style={{ height:38, borderRadius:9, border:'1px solid var(--line)', background:'var(--surface-2)', padding:'0 10px' }}>{googlePrices?.base_plans?.map((b:any)=><option key={b.base_plan_id} value={b.base_plan_id}>{b.base_plan_id}</option>)}</select></label>
              <label style={{ display:'grid', gap:5 }}><span style={{ fontSize:10, color:'var(--muted)' }}>Country</span><input value={draftForm.region_code} maxLength={2} dir="ltr" onChange={e=>setDraftForm({...draftForm,region_code:e.target.value.toUpperCase()})} style={{ height:38, borderRadius:9, border:'1px solid var(--line)', background:'var(--surface)' }}/></label>
              <label style={{ display:'grid', gap:5 }}><span style={{ fontSize:10, color:'var(--muted)' }}>Currency</span><input value={draftForm.currency_code} maxLength={3} dir="ltr" onChange={e=>setDraftForm({...draftForm,currency_code:e.target.value.toUpperCase()})} style={{ height:38, borderRadius:9, border:'1px solid var(--line)', background:'var(--surface)' }}/></label>
              <label style={{ display:'grid', gap:5 }}><span style={{ fontSize:10, color:'var(--muted)' }}>Units</span><input value={draftForm.units} inputMode="numeric" dir="ltr" onChange={e=>setDraftForm({...draftForm,units:e.target.value})} style={{ height:38, borderRadius:9, border:'1px solid var(--line)', background:'var(--surface)' }}/></label>
              <label style={{ display:'grid', gap:5 }}><span style={{ fontSize:10, color:'var(--muted)' }}>Nanos</span><input value={draftForm.nanos} inputMode="numeric" dir="ltr" onChange={e=>setDraftForm({...draftForm,nanos:e.target.value})} style={{ height:38, borderRadius:9, border:'1px solid var(--line)', background:'var(--surface)' }}/></label>
            </div>
            <div style={{ marginTop:12 }}><button className="button button--primary" disabled={priceBusy} onClick={()=>void createGoogleDraft()}>Create reviewable draft</button></div>
          </div>}

          <div><h4 style={{ fontSize:12, marginBottom:10 }}>Price change history</h4>{googleDrafts.length? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>Draft</th><th>Country</th><th>Previous</th><th>Proposed</th><th>Status</th><th></th></tr></thead><tbody>{googleDrafts.map((d:any)=><tr key={d.id}><td dir="ltr"><small style={{ color:'var(--muted)' }}>{d.id.slice(0,8)}…</small><br/><span style={{ fontSize:11, fontWeight:700 }}>{d.base_plan_id}</span></td><td><span className="price-pill">{d.region_code}</span></td><td dir="ltr" style={{ fontSize:11 }}>{d.observed_price?`${d.observed_price.currencyCode} ${d.observed_price.units}`:'—'}</td><td dir="ltr" style={{ fontSize:11 }}>{d.currency_code} {d.units}</td><td><span className={`status-badge ${d.status==='draft'?'status-badge--review': d.status==='published'?'status-badge--published':'status-badge--archived'}`}>{d.status}</span></td><td>{d.status==='draft'?<button className="button button--primary button--small" disabled={priceBusy} onClick={()=>void publishGoogleDraft(d)}>Publish</button>:'—'}</td></tr>)}</tbody></table></div> : <EmptyState title="No drafts" description="Choose a live country price to create a proposal."/>}</div>

        </div> : <div style={{ padding:28 }}><EmptyState title="Google Play unavailable" description="Configure GOOGLE_PLAY_PRODUCTS and service account in API environment first. Dashboard stays usable without it."/></div>}
      </section>
    </div>
  )
}
