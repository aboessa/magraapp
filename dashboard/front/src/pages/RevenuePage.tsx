// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'

const copy={
  ar:{
    eyebrow:'المالية', title:'الإيرادات والتحويل', lede:'إيرادات محققة من معاملات موثقة فقط — بدون حسابات صافية وهمية بالخصم الثابت.',
    rangeToday:'اليوم', range7:'٧ أيام', range30:'٣٠ يوم', rangeQuarter:'ربع', rangeYear:'سنة',
    gross:'الإجمالي', net:'الصافي', mrr:'MRR', arr:'ARR', activePaid:'مشتركون مدفوعون نشطون', newPaid:'جدد مدفوعون', renewals:'تجديدات', refunds:'مستردات', trialConversion:'تحويل التجربة', churn:'الإلغاء', arpu:'ARPU',
    byPlan:'حسب الخطة', byCountry:'حسب البلد', byProvider:'حسب المزود', byCurrency:'حسب العملة',
    grossHint:'الإجمالي غير متاح — مبلغ الشراء غير مخزن بدون نموذج تسعير', netHint:'الصافي يتطلب حصة متجر مرنة', mrrHint:'MRR = إيراد شهري معياري', refundsNote:'المبيعات الإجمالية ≠ الإيراد المحتفظ',
    drillByPlan:'التنقيب حسب الخطة', drillByProvider:'حسب المزود',
    dataQuality:'جودة البيانات', missingPrice:'سعر مفقود', unknownCurrency:'عملة غير معروفة', unverified:'شراء غير متحقق', duplicate:'معاملة مكررة',
    noData:'لا بيانات إيرادات بعد', noDataHint:'سجل billing_audit فارغ',
  },
  en:{
    eyebrow:'Finance', title:'Revenue & Conversion', lede:'Verified transaction revenue only — no fake net with fixed fee.',
    rangeToday:'Today', range7:'7D', range30:'30D', rangeQuarter:'Quarter', rangeYear:'Year',
    gross:'Gross', net:'Net', mrr:'MRR', arr:'ARR', activePaid:'Active paid subs', newPaid:'New paid', renewals:'Renewals', refunds:'Refunds', trialConversion:'Trial conversion', churn:'Churn', arpu:'ARPU',
    byPlan:'By plan', byCountry:'By country', byProvider:'By provider', byCurrency:'By currency',
    grossHint:'Gross unavailable — amount not stored without price', netHint:'Net requires versioned store fee', mrrHint:'MRR = normalized monthly recurring', refundsNote:'Gross ≠ retained',
    drillByPlan:'Drill by plan', drillByProvider:'By provider',
    dataQuality:'Data quality', missingPrice:'Missing price', unknownCurrency:'Unknown currency', unverified:'Unverified', duplicate:'Duplicate',
    noData:'No revenue yet', noDataHint:'billing_audit empty',
  }
}

export function RevenuePage(){
  const { locale }=usePreferences()
  const text=copy[locale as 'ar'|'en'] as any
  const [range,setRange]=useState<'today'|'7d'|'30d'|'quarter'|'year'>('30d')
  const [data,setData]=useState<any>(null)
  const [drill,setDrill]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{ const r=await api.revenueOverview(range); setData(r.data)}catch(e){ setError(e instanceof Error? e.message:'Error')} finally{ setLoading(false)}
  },[range])
  useEffect(()=>{ void load()},[load])
  const doDrill=async(dimension:string, value:string)=>{
    try{ const r=await api.revenueDrilldown(dimension, value); setDrill(r.data as any)}catch{}
  }
  if(loading) return <LoadingState/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()}/>
  if(!data) return <EmptyState title={text.noData} description={text.noDataHint}/>
  const metrics=data.metrics
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div>
        <div style={{display:'flex', gap:8}}>
          {(['today','7d','30d','quarter','year'] as const).map(r=> <button key={r} className={`button ${range===r?'button--primary':'button--ghost'} button--small`} onClick={()=> setRange(r)}>{(text as any)['range'+ (r==='today'?'Today': r==='7d'?'7': r==='30d'?'30': r==='quarter'?'Quarter':'Year')] ?? r}</button>)}
        </div>
      </section>

      <section className="stat-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12}}>
        <div className="stat-card"><span>{text.gross}</span><strong>{metrics.gross_revenue.value ?? '—'}</strong><small>{metrics.gross_revenue.unavailable ?? ''}</small></div>
        <div className="stat-card"><span>{text.net}</span><strong>{metrics.net_revenue.value ?? '—'}</strong><small>{metrics.net_revenue.unavailable ?? ''}</small></div>
        <div className="stat-card"><span>{text.mrr}</span><strong>{metrics.mrr.value ?? '—'}</strong><small>{metrics.mrr.unavailable ?? ''}</small></div>
        <div className="stat-card"><span>{text.activePaid}</span><strong>{metrics.active_paid_subscribers}</strong></div>
        <div className="stat-card"><span>{text.newPaid}</span><strong>{metrics.new_paid_subscribers}</strong></div>
        <div className="stat-card"><span>{text.renewals}</span><strong>{metrics.renewals}</strong></div>
        <div className="stat-card"><span>{text.refunds}</span><strong>{metrics.refunds}</strong><small>{text.refundsNote}</small></div>
        <div className="stat-card"><span>{text.trialConversion}</span><strong>—</strong><small>Cohort: trial start → paid (data not yet)</small></div>
      </section>

      <section style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        <div className="panel" style={{padding:12}}><h3>{text.byPlan}</h3>
          <table className="data-table"><thead><tr><th>Plan</th><th>Count</th><th></th></tr></thead><tbody>
            {(data.breakdowns.by_plan??[]).map((r:any)=><tr key={r.plan}><td>{r.plan}</td><td>{r.cnt}</td><td><button className="button button--ghost button--small" onClick={()=> void doDrill('plan', r.plan)}>{text.drillByPlan}</button></td></tr>)}
          </tbody></table>
        </div>
        <div className="panel" style={{padding:12}}><h3>{text.byProvider}</h3>
          <table className="data-table"><thead><tr><th>Provider</th><th>Count</th></tr></thead><tbody>
            {(data.breakdowns.by_provider??[]).map((r:any)=><tr key={r.provider}><td>{r.provider}</td><td>{r.cnt}</td></tr>)}
          </tbody></table>
          <p className="panel__note">Currency: reported per-currency, not summed naively. Multi-currency honest.</p>
        </div>
      </section>

      {drill.length ? <section className="panel" style={{padding:12}}><h3>Drilldown ({drill.length})</h3><div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>Parent</th><th>Product</th><th>Provider</th><th>Entitlement</th></tr></thead><tbody>
        {drill.map((r:any)=><tr key={r.id}><td dir="ltr">{String(r.parent_id).slice(0,8)}</td><td dir="ltr">{r.product_id}</td><td>{r.provider}</td><td>{r.entitlement_status}</td></tr>)}
      </tbody></table></div><p className="panel__note">All finance numbers drill to qualifying transaction population.</p></section> : null}

      <section className="panel" style={{padding:12}}><h3>{text.dataQuality}</h3>
        <table className="data-table"><thead><tr><th>Issue</th><th>Count</th></tr></thead><tbody>
          {(data.data_quality??[]).map((r:any)=><tr key={r.issue}><td>{r.issue}</td><td>{r.cnt}</td></tr>)}
        </tbody></table>
        <p className="panel__note">{text.grossHint} — no silent inclusion in metrics.</p>
      </section>
    </div>
  )
}
