import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import type { RightsLicenseRecord } from '../types/api'

const LICENSE_TYPES = ['exclusive', 'non_exclusive', 'owned'] as const

const copy = {
  ar: {
    eyebrow: 'الحقوق · التراخيص',
    title: 'إدارة الحقوق',
    lede: 'سجل إداري لمالك الحق ونوع الترخيص والإقليم واللغات والأجهزة وتاريخ الانتهاء. لا يفرض حجب نشر تلقائياً — المنتهية تبرز للتنبيه والمراجعة القانونية.',
    add: 'حق جديد', search: 'بحث بالمالك أو معرّف المحتوى…',
    filterNote: 'البحث والفلاتر والترقيم كلها على الخادم — الرابط قابل للمشاركة.',
    stats: { total:'الإجمالي', expired:'منتهي', soon:'ينتهي قريباً', perpetual:'دائم', expiringSoon:'٦٠ يوماً' },
    allTypes: 'كل الأنواع', all:'الجميع',
    content:'المحتوى', owner:'المالك', type:'النوع', countries:'الأقاليم', languages:'اللغات', devices:'الأجهزة', expires:'الانتهاء',
    perpetual:'دائم', expired:'منتهي',
    contentIdLabel:'معرّف المحتوى', contentIdHint:'معرّف سلسلة منشورة أو مسودة. لا يدعم أنواع أخرى بعد.',
    ownerLabel:'مالك الحق', typeLabel:'نوع الترخيص',
    countriesLabel:'الأقاليم', countriesHint:'رموز دول مفصولة بفاصلة مثل EG,SA,AE. فاضي = كل الدول.',
    languagesLabel:'اللغات', languagesHint:'رموز لغات مفصولة بفاصلة مثل ar,en. فاضي = كل اللغات.',
    devicesLabel:'الأجهزة', devicesHint:'مثل mobile,tv,web. فاضي = كل الأجهزة.',
    expiryLabel:'تاريخ الانتهاء', expiryHint:'فاضي = دائم. لا يُخترع تاريخ افتراضي.',
    save:'إضافة', saving:'جارٍ…', cancel:'إلغاء', created:'أُضيف الحق', required:'معرّف المحتوى ومالك الحق مطلوبان',
    empty:'لا حقوق مسجلة', emptyHint:'أضف أول ترخيص لتتبع صلاحية بث المحتوى.',
    loadError:'تعذر تحميل الحقوق',
    types: { exclusive:'حصري', non_exclusive:'غير حصري', owned:'ملكية كاملة' } as Record<string,string>,
  },
  en: {
    eyebrow:'Rights · Licensing',
    title:'Rights management',
    lede:'Administrative register of rights holder, licence type, territories, languages, devices and expiry. Does not auto-block publishing — expired rights are highlighted for legal attention.',
    add:'New right', search:'Search owner or content id…',
    filterNote:'Search, filters and paging run on server — link is shareable and opens same set.',
    stats:{ total:'Total', expired:'Expired', soon:'Expiring soon', perpetual:'Perpetual', expiringSoon:'60 days' },
    allTypes:'All types', all:'All',
    content:'Content', owner:'Owner', type:'Type', countries:'Territories', languages:'Languages', devices:'Devices', expires:'Expires',
    perpetual:'Perpetual', expired:'Expired',
    contentIdLabel:'Content ID', contentIdHint:'Published or draft series ID from catalogue. Other types not yet supported.',
    ownerLabel:'Rights holder', typeLabel:'Licence type',
    countriesLabel:'Territories', countriesHint:'Comma-separated codes e.g. EG,SA,AE. Empty = all territories.',
    languagesLabel:'Languages', languagesHint:'Comma-separated e.g. ar,en. Empty = all languages.',
    devicesLabel:'Devices', devicesHint:'e.g. mobile,tv,web. Empty = all devices.',
    expiryLabel:'Expiry date', expiryHint:'Empty = perpetual. No default date invented.',
    save:'Add', saving:'Adding…', cancel:'Cancel', created:'Right added', required:'Content ID and rights holder required',
    empty:'No rights recorded', emptyHint:'Add first licence to track distribution validity.',
    loadError:'Unable to load rights',
    types:{ exclusive:'Exclusive', non_exclusive:'Non-exclusive', owned:'Owned' } as Record<string,string>,
  }
}

const EMPTY_FORM = {
  content_id:'', owner:'', license_type:'exclusive', countries:'', languages:'', devices:'', expiry_date:'',
}

import { RIGHTS_EXPIRING_SOON_MS } from '../lib/constants.ts'
function parseList(value: string | null | undefined): string[] {
  if (!value) return []
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : [] } catch { return [] }
}
function splitList(value: string): string[] { return value.split(',').map(i=>i.trim()).filter(Boolean) }
function isExpired(date: string | null) { if (!date) return false; const p=new Date(date); return !Number.isNaN(p.getTime()) && p.getTime() < Date.now() }
function isSoon(date: string | null) { if (!date) return false; const p=new Date(date); if(Number.isNaN(p.getTime())) return false; const diff=p.getTime()-Date.now(); return diff>0 && diff < RIGHTS_EXPIRING_SOON_MS }

const LIMIT = 25
const DEFAULT_FILTERS = { license_type:'', expiry:'' }
const FILTER_FIELDS = (text: (typeof copy)['ar']): FilterField[] => [
  { key:'license_type', label:text.type, type:'select', options:[{ value:'', label:text.allTypes }, ...LICENSE_TYPES.map(v=>({ value:v, label:text.types[v] ?? v }))] },
  { key:'expiry', label:text.expires, type:'select', options:[{ value:'', label:text.all }, { value:'expired', label:text.expired }, { value:'soon', label:text.stats.expiringSoon }, { value:'none', label:text.perpetual }] },
]

export function RightsPage(){
  const { locale }=usePreferences()
  const text=copy[locale]
  const navigate=useNavigate()
  const list=useUrlListState(DEFAULT_FILTERS, { limit:LIMIT })
  const { query, filters, offset, limit }=list
  const [rights,setRights]=useState<RightsLicenseRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [open,setOpen]=useState(false)
  const [form,setForm]=useState(EMPTY_FORM)
  const [saving,setSaving]=useState(false)
  const [formError,setFormError]=useState('')
  const [total,setTotal]=useState(0)

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const response=await api.rights({ q:query.trim()||undefined, license_type:filters.license_type||undefined, expiry:filters.expiry||undefined, limit, offset })
      setRights(response.data); setTotal(response.meta.total)
    }catch(c){ setError(c instanceof Error? c.message: text.loadError) } finally{ setLoading(false) }
  },[filters.expiry, filters.license_type, limit, offset, query, text.loadError])

  useEffect(()=>{ const t=setTimeout(()=>void load(),220); return ()=> clearTimeout(t)},[load])

  const stats=useMemo(()=>{
    const expired=rights.filter(r=> isExpired(r.expiry_date as any)).length
    const soon=rights.filter(r=> isSoon(r.expiry_date as any)).length
    const perpetual=rights.filter(r=> !r.expiry_date).length
    return { total, expired, soon, perpetual }
  },[rights, total])

  async function submit(){
    if(!form.content_id.trim() || !form.owner.trim()){ setFormError(text.required); return }
    setSaving(true); setFormError('')
    try{
      await api.createRight({ content_id:form.content_id.trim(), owner:form.owner.trim(), license_type:form.license_type, countries:splitList(form.countries), languages:splitList(form.languages), devices:splitList(form.devices), expiry_date:form.expiry_date.trim()||null })
      setOpen(false); setForm(EMPTY_FORM); setNotice(text.created); await load()
    }catch(c){ setFormError(c instanceof Error? c.message: text.loadError) } finally{ setSaving(false) }
  }

  if(loading) return <LoadingState/>
  if(error) return <ErrorState message={error} onRetry={()=>void load()} />

  return (
    <div className="page-stack" style={{ gap:18 }}>
      <style>{`
        .rights-hero{position:relative;border-radius:20px;border:1px solid var(--line);background:linear-gradient(160deg, var(--surface), color-mix(in srgb, var(--surface-2) 88%, var(--surface)));padding:22px;overflow:hidden}
        .rights-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(520px 220px at 85% -10%, rgba(155,123,255,.14), transparent 60%), radial-gradient(380px 200px at 5% 110%, rgba(86,121,242,.10), transparent 70%)}
        .rights-hero>*{position:relative}
        .rights-kicker{display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);font-size:10px;font-weight:700;color:var(--muted)}
        .rights-title{margin-top:12px;font-size:clamp(22px,2.6vw,30px);letter-spacing:-.04em}
        .rights-lede{margin-top:8px;max-width:720px;color:var(--text-soft);font-size:11px;line-height:1.8}
        .stat-grid{display:grid;grid-template-columns:repeat(4, minmax(0,1fr));gap:12px}
        @media(max-width:900px){.stat-grid{grid-template-columns:repeat(2, minmax(0,1fr))}}
        .s-card{border-radius:16px;border:1px solid var(--line);background:linear-gradient(180deg, var(--surface), var(--surface-2));padding:14px 14px 12px;position:relative;overflow:hidden;transition:transform .16s}
        .s-card:hover{transform:translateY(-1px)}
        .s-card__top{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:10px;font-weight:700}
        .s-card__icon{width:28px;height:28px;border-radius:9px;display:grid;place-items:center}
        .s-card__value{margin-top:10px;font-size:24px;font-weight:800;letter-spacing:-.03em}
        .s-card__sub{margin-top:4px;color:var(--muted);font-size:10px}
        .s-card--total .s-card__icon{background:rgba(86,121,242,.12);color:var(--primary)}
        .s-card--expired{border-color:rgba(240,93,119,.22)} .s-card--expired .s-card__icon{background:rgba(240,93,119,.10);color:#c43a54}
        .s-card--soon{border-color:rgba(245,165,36,.22)} .s-card--soon .s-card__icon{background:rgba(245,165,36,.12);color:#b47800}
        .s-card--perp .s-card__icon{background:rgba(34,184,120,.10);color:#0e7a4d}
        .rights-panel{border:1px solid var(--line);border-radius:16px;background:var(--surface);overflow:hidden}
        .rights-panel__head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}
        .chip{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);font-size:10px;font-weight:600;color:var(--text-soft)}
        .chip--country{background:rgba(86,121,242,.08);border-color:rgba(86,121,242,.16);color:#3352c5}
        .chip--lang{background:rgba(0,214,245,.08);border-color:rgba(0,214,245,.16);color:#0a6a7a}
        .expiry{font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2)}
        .expiry--expired{background:rgba(240,93,119,.10);color:#c43a54;border-color:rgba(240,93,119,.22)}
        .expiry--soon{background:rgba(245,165,36,.10);color:#8a5a00;border-color:rgba(245,165,36,.22)}
        .expiry--perp{background:rgba(34,184,120,.08);color:#0e6340;border-color:rgba(34,184,120,.16)}
        .type-badge{display:inline-flex;height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;border:1px solid var(--line)}
        .type-badge--exclusive{background:rgba(155,123,255,.10);color:#5a3ac7;border-color:rgba(155,123,255,.18)}
        .type-badge--non_exclusive{background:rgba(86,121,242,.08);color:#2e4bb8;border-color:rgba(86,121,242,.14)}
        .type-badge--owned{background:rgba(34,184,120,.10);color:#0e6340;border-color:rgba(34,184,120,.18)}
      `}</style>

      <section className="rights-hero">
        <div style={{ display:'flex', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div>
            <span className="rights-kicker"><Icon name="rights" size={12}/>{text.eyebrow}</span>
            <h2 className="rights-title">{text.title}</h2>
            <p className="rights-lede">{text.lede}</p>
          </div>
          <button className="button button--primary" onClick={()=>{ setForm(EMPTY_FORM); setFormError(''); setOpen(true) }}><Icon name="plus" size={14}/>{text.add}</button>
        </div>
      </section>

      <div className="stat-grid">
        <div className="s-card s-card--total"><div className="s-card__top"><span>{text.stats.total}</span><span className="s-card__icon"><Icon name="text" size={14}/></span></div><strong className="s-card__value">{stats.total}</strong><span className="s-card__sub">{text.filterNote}</span></div>
        <div className="s-card s-card--expired"><div className="s-card__top"><span>{text.stats.expired}</span><span className="s-card__icon"><Icon name="warning" size={14}/></span></div><strong className="s-card__value">{stats.expired}</strong><span className="s-card__sub">{locale==='ar'?'تحتاج مراجعة قانونية':'Needs legal review'}</span></div>
        <div className="s-card s-card--soon"><div className="s-card__top"><span>{text.stats.soon}</span><span className="s-card__icon"><Icon name="clock" size={14}/></span></div><strong className="s-card__value">{stats.soon}</strong><span className="s-card__sub">{text.stats.expiringSoon}</span></div>
        <div className="s-card s-card--perp"><div className="s-card__top"><span>{text.stats.perpetual}</span><span className="s-card__icon"><Icon name="check" size={14}/></span></div><strong className="s-card__value">{stats.perpetual}</strong><span className="s-card__sub">{locale==='ar'?'بدون تاريخ انتهاء':'No expiry — perpetual'}</span></div>
      </div>

      {notice ? <div className="inline-alert inline-alert--success">{notice}</div> : null}

      <section className="rights-panel">
        <div className="rights-panel__head">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}><h3 style={{ fontSize:13 }}>{text.title} <span className="title-count">{total}</span></h3><span style={{ color:'var(--muted)', fontSize:10 }}>{text.filterNote}</span></div>
          <ListToolbar searchValue={query} onSearchChange={list.setQuery} searchPlaceholder={text.search} fields={FILTER_FIELDS(text)} values={filters} defaults={DEFAULT_FILTERS} onApply={n=>list.setFilters(n)} onClear={list.clearFilters} onRemove={k=>list.setFilter(k as any,'')} trailing={<SavedViewsMenu storageKey="rights" currentSearch={list.search} onApply={s=>navigate(`${adminPath('rights')}${s}`)} />} />
        </div>

        {rights.length ? (
          <>
            <div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr><th>{text.content}</th><th>{text.owner}</th><th>{text.type}</th><th>{text.countries}</th><th>{text.languages}</th><th>{text.expires}</th><th></th></tr></thead><tbody>
              {rights.map((right:any)=>{
                const countries=parseList(right.countries)
                const languages=parseList(right.languages)
                const expired=isExpired(right.expiry_date)
                const soon=isSoon(right.expiry_date)
                return (
                  <tr key={right.id}>
                    <td><Link to={adminPath(`rights/${right.id}`)} style={{ textDecoration:'none', display:'flex', gap:10, alignItems:'center' }}><span style={{ width:32, height:32, borderRadius:9, background:'var(--surface-2)', border:'1px solid var(--line)', display:'grid', placeItems:'center', fontSize:11, fontWeight:800 }}>{String(right.series_title ?? right.content_id ?? '?').charAt(0).toUpperCase()}</span><span><span className="table-primary" style={{ display:'block', fontSize:11, fontWeight:700 }}>{right.series_title ?? right.content_id}</span><span className="table-secondary" dir="ltr" style={{ fontSize:10 }}>{right.content_id}</span></span></Link></td>
                    <td><span style={{ fontSize:11, fontWeight:600 }}>{right.owner}</span></td>
                    <td><span className={`type-badge type-badge--${right.license_type}`}>{text.types[right.license_type] ?? right.license_type}</span></td>
                    <td><div style={{ display:'flex', gap:5, flexWrap:'wrap', maxWidth:200 }}>{countries.length ? countries.slice(0,3).map((c:string)=><span key={c} className="chip chip--country">{c}</span>) : <span className="chip">{text.all}</span>}{countries.length>3 && <span className="chip">+{countries.length-3}</span>}</div></td>
                    <td><div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{languages.length ? languages.slice(0,3).map((l:string)=><span key={l} className="chip chip--lang">{l}</span>) : <span className="chip">{text.all}</span>}{languages.length>3 && <span className="chip">+{languages.length-3}</span>}</div></td>
                    <td>{right.expiry_date ? <span className={`expiry ${expired?'expiry--expired': soon?'expiry--soon':''}`}>{right.expiry_date}{expired?` · ${text.expired}`: soon?` · ${text.stats.soon}`:''}</span> : <span className="expiry expiry--perp">{text.perpetual}</span>}</td>
                    <td><Link className="button button--ghost button--small" to={adminPath(`rights/${right.id}`)}>Open</Link></td>
                  </tr>
                )
              })}
            </tbody></table></div>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </>
        ) : <div style={{ padding:28 }}><EmptyState title={text.empty} description={text.emptyHint} action={<button className="button button--primary" onClick={()=>setOpen(true)}>{text.add}</button>} /></div>}
      </section>

      {open && (
        <Modal open title={text.add} onClose={()=>setOpen(false)}>
          <div className="entity-form">
            <div className="form-grid">
              <label className="field"><span>{text.contentIdLabel} *</span><input value={form.content_id} onChange={e=>setForm({...form, content_id:e.target.value})} dir="ltr" placeholder="series_xxx" style={{ height:40 }}/><small>{text.contentIdHint}</small></label>
              <label className="field"><span>{text.ownerLabel} *</span><input value={form.owner} onChange={e=>setForm({...form, owner:e.target.value})} placeholder={locale==='ar'?'مثال: دار النشر X':'e.g. Publisher X'} style={{ height:40 }}/></label>
            </div>
            <label className="field"><span>{text.typeLabel}</span><select value={form.license_type} onChange={e=>setForm({...form, license_type:e.target.value})} style={{ height:40 }}>{LICENSE_TYPES.map(v=><option key={v} value={v}>{text.types[v] ?? v}</option>)}</select></label>
            <div className="form-grid form-grid--three">
              <label className="field"><span>{text.countriesLabel}</span><input value={form.countries} onChange={e=>setForm({...form, countries:e.target.value})} dir="ltr" placeholder="EG,SA,AE" style={{ height:40 }}/><small>{text.countriesHint}</small></label>
              <label className="field"><span>{text.languagesLabel}</span><input value={form.languages} onChange={e=>setForm({...form, languages:e.target.value})} dir="ltr" placeholder="ar,en" style={{ height:40 }}/><small>{text.languagesHint}</small></label>
              <label className="field"><span>{text.devicesLabel}</span><input value={form.devices} onChange={e=>setForm({...form, devices:e.target.value})} dir="ltr" placeholder="mobile,tv,web" style={{ height:40 }}/><small>{text.devicesHint}</small></label>
            </div>
            <label className="field"><span>{text.expiryLabel}</span><input type="date" value={form.expiry_date} onChange={e=>setForm({...form, expiry_date:e.target.value})} style={{ height:40 }}/><small>{text.expiryHint}</small></label>
            {formError ? <div className="inline-alert inline-alert--error">{formError}</div> : null}
            <div className="form-actions"><button className="button button--ghost" onClick={()=>setOpen(false)}>{text.cancel}</button><button className="button button--primary" disabled={saving} onClick={()=>void submit()}>{saving?text.saving:text.save}</button></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
