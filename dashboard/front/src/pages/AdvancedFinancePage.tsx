import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'

const copy={
  ar:{
    eyebrow:'المالية المتقدمة', title:'اقتصاديات المحتوى', lede:'تكلفة المحتوى مقابل الاستهلاك — الربحية لا تُعرض بدون منهجية إسناد إيراد.',
    overview:'نظرة عامة', revenue:'الإيرادات', costs:'التكاليف', economics:'اقتصاديات المحتوى', countries:'البلدان', rightsCosts:'تكاليف الحقوق', budget:'الميزانية مقابل الفعلي',
    addCost:'إضافة تكلفة', entity:'الكيان', category:'الفئة', amount:'المبلغ', currency:'العملة', vendor:'المورد', period:'الفترة', allocation:'التخصيص',
    storyCosts:'تكاليف القصة', noCosts:'لا تكاليف بعد', noCostsHint:'أدخل تكلفة الإنتاج/الترجمة/الترخيص', profitUnavailable:'الربحية غير متاحة — لا نموذج إسناد إيراد', ltvUnavailable:'قيمة العميل الدائمة غير متاحة', cacUnavailable:'تكلفة الاكتساب غير متاحة',
    costCategories:'الكتابة / الرسم / التحريك / الصوت / الترجمة / المراجعة / الترخيص / الخارجي',
    totalCost:'إجمالي التكلفة',
  },
  en:{
    eyebrow:'Advanced finance', title:'Content Economics', lede:'Cost vs engagement — profitability not claimed without attribution.',
    overview:'Overview', revenue:'Revenue', costs:'Costs', economics:'Content economics', countries:'Countries', rightsCosts:'Rights costs', budget:'Budget vs Actual',
    addCost:'Add cost', entity:'Entity', category:'Category', amount:'Amount', currency:'Currency', vendor:'Vendor', period:'Period', allocation:'Allocation',
    storyCosts:'Story costs', noCosts:'No costs yet', noCostsHint:'Enter production/translation/licensing cost', profitUnavailable:'Profit unavailable — no attribution model', ltvUnavailable:'LTV unavailable', cacUnavailable:'CAC unavailable',
    costCategories:'Writing / Illustration / Animation / Audio / Translation / QA / Licensing / External',
    totalCost:'Total cost',
  }
}

const CATEGORIES=['writing','illustration','animation','video','audio','translation','qa','licensing','external','marketing','technology','other']

export function AdvancedFinancePage(){
  const { locale }=usePreferences()
  const text=copy[locale as 'ar'|'en'] as any
  const [tab,setTab]=useState<'overview'|'costs'|'economics'|'budget'>('overview')
  const [costs,setCosts]=useState<any[]>([])
  const [byCurrency,setByCurrency]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [formOpen,setFormOpen]=useState(false)
  const [form,setForm]=useState<any>({ entity_type:'story', entity_id:'', category:'writing', amount_minor:0, currency:'EGP', vendor:'', allocation_basis:'flat' })

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const res=await api.contentCosts({ limit:25 } as any) as any
      setCosts(res.data ?? []); setByCurrency(res.meta?.by_currency ?? [])
    }catch(e){ setError(e instanceof Error? e.message:'Error')} finally{ setLoading(false)}
  },[])
  useEffect(()=>{ void load()},[load])

  const createCost=async()=>{
    if(!form.entity_id || !form.category) return
    await api.createContentCost({ ...form, amount_minor: Number(form.amount_minor) } as any)
    setFormOpen(false); void load()
  }

  if(loading) return <LoadingState/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()}/>

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div>
        <button className="button button--primary" onClick={()=> setFormOpen(true)}><Icon name="plus" size={14}/>{text.addCost}</button>
      </section>

      <div style={{display:'flex', gap:8, overflowX:'auto'}}>
        {(['overview','costs','economics','budget'] as const).map(t=> <button key={t} className={`button ${tab===t?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab(t)}>{(text as any)[t]}</button>)}
      </div>

      {tab==='overview' && <div className="panel" style={{padding:16}}>
        <p>{text.costCategories}</p>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
          <div><h4>{text.costs} by currency</h4><table className="data-table"><thead><tr><th>Currency</th><th>Total (minor)</th></tr></thead><tbody>{byCurrency.map((r:any)=><tr key={r.currency}><td>{r.currency}</td><td>{r.total}</td></tr>)}</tbody></table><p className="panel__note">Multi-currency not summed without FX.</p></div>
          <div><h4>Budget vs Actual</h4><p className="panel__note">Scope: Planet/Series/Global — separate Budget/Committed/Actual/Forecast per period.</p><Link className="button button--ghost button--small" to={adminPath('series')}>Series → Cost workspace</Link></div>
        </div>
        <div className="panel__note" style={{marginTop:12}}>{text.profitUnavailable} — engagement & cost shown separately. LTV {text.ltvUnavailable} (needs retention/ARPU). CAC {text.cacUnavailable} (needs acquisition spend).</div>
      </div>}

      {tab==='costs' && <section className="panel panel--table"><div className="panel__header"><h3>{text.costs}</h3></div>
        {costs.length ? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.entity}</th><th>{text.category}</th><th>{text.amount}</th><th>{text.currency}</th><th>{text.vendor}</th><th>{text.period}</th><th>{text.allocation}</th><th></th></tr></thead><tbody>
          {costs.map((c:any)=><tr key={c.id}><td>{c.entity_type}:{c.entity_id.slice(0,8)}<br/><small>{c.series_title ?? ''}</small></td><td>{c.category}</td><td>{(c.amount_minor/100).toFixed(2)}</td><td>{c.currency}</td><td>{c.vendor ?? '—'}</td><td>{c.period ?? '—'}</td><td>{c.allocation_basis ?? '—'}</td><td><Link className="button button--ghost button--small" to={adminPath(`${c.entity_type==='series'?'series': c.entity_type==='episode'?'episodes': c.entity_type==='story'?'stories': 'games'}/${c.entity_id}`)}>Content</Link></td></tr>)}
        </tbody></table></div> : <EmptyState title={text.noCosts} description={text.noCostsHint} />}
      </section>}

      {tab==='economics' && <div className="panel" style={{padding:16}}><h3>{text.economics}</h3>
        <p>For Story/Game/Series show: Writing, Illustration, Narration, Translation, QA, Rights allocation, Total — only after real cost data.</p>
        <p className="panel__note">Example: Story X → Writing EGP 2000 + Illustration 3000 + Translation 1500 = 6500. Shared cost (license covers 10 episodes) → allocation per episode explicit or unallocated.</p>
        <p className="panel__note">Revenue attribution: platform subscription has no direct per-content revenue — show Engagement + Cost separately, not fabricated profit. Profit/Margin/ROI only when both methodologies defined.</p>
        <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>Content</th><th>{text.totalCost}</th><th>Engagement</th><th>Profit</th></tr></thead><tbody>
          {costs.slice(0,5).map((c:any)=><tr key={c.id}><td>{c.entity_id.slice(0,8)}</td><td>{(c.amount_minor/100).toFixed(2)} {c.currency}</td><td>—</td><td>{text.profitUnavailable}</td></tr>)}
        </tbody></table></div>
      </div>}

      {tab==='budget' && <div className="panel" style={{padding:16}}><h3>{text.budget}</h3><p>Budget / Committed / Actual / Forecast per Planet/Series/Production.</p><p className="panel__note">Do not conflate budget with actual costs.</p></div>}

      {formOpen && <div className="modal-backdrop" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'grid', placeItems:'center'}} onClick={()=> setFormOpen(false)}><div className="panel" style={{padding:16, minWidth:400, background:'#fff'}} onClick={e=> e.stopPropagation()}>
        <h3>{text.addCost}</h3>
        <div style={{display:'grid', gap:8, marginTop:12}}>
          <label>Entity type<select value={form.entity_type} onChange={e=> setForm({...form, entity_type:e.target.value})}><option value="series">series</option><option value="episode">episode</option><option value="story">story</option><option value="game">game</option><option value="planet">planet</option></select></label>
          <label>Entity ID<input value={form.entity_id} onChange={e=> setForm({...form, entity_id:e.target.value})} placeholder="series id"/></label>
          <label>Category<select value={form.category} onChange={e=> setForm({...form, category:e.target.value})}>{CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}</select></label>
          <label>Amount (EGP)<input type="number" value={form.amount_minor} onChange={e=> setForm({...form, amount_minor: Number(e.target.value)*100 })} placeholder="1000"/></label>
          <label>Currency<input value={form.currency} onChange={e=> setForm({...form, currency:e.target.value.toUpperCase()})} /></label>
          <label>Vendor<input value={form.vendor} onChange={e=> setForm({...form, vendor:e.target.value})} /></label>
          <label>Allocation basis<select value={form.allocation_basis} onChange={e=> setForm({...form, allocation_basis:e.target.value})}><option value="flat">flat</option><option value="per_episode">per_episode</option><option value="per_minute">per_minute</option></select></label>
        </div>
        <div style={{display:'flex', gap:8, marginTop:12}}><button className="button button--ghost" onClick={()=> setFormOpen(false)}>Cancel</button><button className="button button--primary" onClick={()=> void createCost()}>Save</button></div>
      </div></div>}
    </div>
  )
}
