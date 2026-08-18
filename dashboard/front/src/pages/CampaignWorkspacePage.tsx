// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'

const copy={
  ar:{ back:'عودة', loading:'تحميل', loadError:'تعذر', overview:'نظرة عامة', audience:'الجمهور', creative:'الإبداع', schedule:'الجدولة', delivery:'التسليم', experiment:'التجربة', analytics:'التحليلات', history:'السجل',
    channel:'القناة', audienceEst:'الجمهور المؤهل', deepLink:'الرابط العميق', scheduleHint:'timezone: UTC — يعرض كما أدخله المسؤول', testSend:'إرسال تجريبي', confirmSend:'تأكيد الإرسال — حجم كبير', channelHint:'القنوات المتاحة فقط هي المعروضة',
    noDelivery:'لا بيانات تسليم بعد', noOpen:'نسبة الفتح غير متاحة — لا تتبع حقيقي', eligible:'مؤهل', sent:'مرسل', delivered:'تم التسليم', opened:'مفتوح', clicked:'نقرة',
  },
  en:{ back:'Back', loading:'Loading', loadError:'Error', overview:'Overview', audience:'Audience', creative:'Creative', schedule:'Schedule', delivery:'Delivery', experiment:'Experiment', analytics:'Analytics', history:'History',
    channel:'Channel', audienceEst:'Eligible audience', deepLink:'Deep link', scheduleHint:'Timezone: UTC', testSend:'Test send', confirmSend:'Confirm large send', channelHint:'Only real channels offered',
    noDelivery:'No delivery yet', noOpen:'Open rate unavailable — no telemetry', eligible:'Eligible', sent:'Sent', delivered:'Delivered', opened:'Opened', clicked:'Clicked',
  }
}
export function CampaignWorkspacePage(){
  const { id='' }=useParams()
  const { locale }=usePreferences()
  const text=copy[locale==='en'?'en':'ar'] as any
  const [data,setData]=useState<any>(null)
  const [tab,setTab]=useState<'overview'|'audience'|'creative'|'schedule'|'delivery'|'analytics'>('overview')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{ const r=await api.campaign(id); setData(r.data)}catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[id, text.loadError])
  useEffect(()=>{ void load()},[load])
  if(loading) return <LoadingState label={text.loading}/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()}/>
  if(!data) return <EmptyState title={text.loadError} description={id}/>
  const aud = typeof data.audience_json==='string'? JSON.parse(data.audience_json): data.audience_json ?? {}
  const cr = typeof data.creative_json==='string'? JSON.parse(data.creative_json): data.creative_json ?? {}
  return (
    <div className="page-stack">
      <div className="panel" style={{padding:16}}>
        <div style={{display:'flex', justifyContent:'space-between'}}><div><h2>{data.name}</h2><p><span className={`account-status account-status--${data.status==='completed'?'active': data.status==='scheduled'?'pending':'draft'}`}>{data.status}</span> · {data.channel} · {data.objective ?? ''}</p></div><Link className="button button--ghost" to={adminPath('campaigns')}>{text.back}</Link></div>
        <div style={{display:'flex', gap:8, marginTop:12, overflowX:'auto'}}>
          {(['overview','audience','creative','schedule','delivery','analytics'] as const).map(t=> <button key={t} className={`button ${tab===t?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab(t)}>{(text as any)[t] ?? t}</button>)}
        </div>
      </div>
      {tab==='overview' && <div className="panel" style={{padding:16}}><dl style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div><dt>{text.channel}</dt><dd>{data.channel} — {text.channelHint}</dd></div>
        <div><dt>{text.audienceEst}</dt><dd>{data.eligible_count ?? '—'}</dd></div>
        <div><dt>{text.deepLink}</dt><dd dir="ltr">{data.deep_link ?? '—'}</dd></div>
        <div><dt>Eligible/Sent/Delivered</dt><dd>{data.eligible_count ?? '—'} / {data.sent_count ?? '—'} / {data.delivered_count ?? '—'}</dd></div>
      </dl><p className="panel__note">{text.noOpen} — {data.opened_count ?? '—'} opened</p><div style={{marginTop:12}}><button className="button button--ghost button--small" onClick={async()=>{ await api.campaignTestSend(id); await load() }}>{text.testSend} (test audience only)</button></div></div>}
      {tab==='audience' && <div className="panel" style={{padding:16}}><h3>{text.audience}</h3><pre style={{background:'#f6f8fa', padding:12, borderRadius:8, overflow:'auto'}}>{JSON.stringify(aud,null,2)}</pre><p className="panel__note">Privacy-safe: country/language/plan/age band aggregate only, no child-level targeting.</p></div>}
      {tab==='creative' && <div className="panel" style={{padding:16}}><h3>{text.creative}</h3><pre style={{background:'#f6f8fa', padding:12, borderRadius:8}}>{JSON.stringify(cr,null,2)}</pre><p>Deep link validated: {data.deep_link?.startsWith('/') || data.deep_link?.startsWith('https://majarra.app') ? '✓' : 'broken'}</p></div>}
      {tab==='schedule' && <div className="panel" style={{padding:16}}><h3>{text.schedule}</h3><p>Scheduled: {data.scheduled_at ?? 'now'} — {text.scheduleHint}</p><p>Status: {data.status}</p></div>}
      {tab==='delivery' && <div className="panel" style={{padding:16}}><h3>{text.delivery}</h3><table className="data-table"><thead><tr><th>Channel</th><th>Status</th><th>Count</th></tr></thead><tbody>{(data.delivery_logs??[]).map((l:any)=><tr key={l.id}><td>{l.channel}</td><td>{l.status}</td><td>{l.recipient_count}</td></tr>)}</tbody></table>{!(data.delivery_logs??[]).length && <p className="panel__note">{text.noDelivery}</p>}</div>}
      {tab==='analytics' && <div className="panel" style={{padding:16}}><h3>{text.analytics}</h3><p>{text.eligible}: {data.eligible_count ?? '—'} → {text.sent}: {data.sent_count ?? '—'} → {text.delivered}: {data.delivered_count ?? '—'} → {text.opened}: {data.opened_count ?? '—'} (real events only)</p><p className="panel__note">No fake open/click if telemetry unavailable.</p></div>}
    </div>
  )
}
