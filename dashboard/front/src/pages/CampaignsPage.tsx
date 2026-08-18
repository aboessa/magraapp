// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu, useColumnPreferences, ColumnManager } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { Pagination } from '../components/Pagination'
import { useUrlListState } from '../hooks/useUrlListState'
import { usePreferences } from '../context/preferences'

const CHANNELS=['in_app','website_banner','email']
const STATUSES=['draft','in_review','scheduled','sending','completed','paused','cancelled','failed']

const copy={
  ar:{
    eyebrow:'النمو', title:'الحملات', lede:'حملات عبر قنوات متاحة فعليًا فقط — في التطبيق/لافتة موقع/بريد. بدون إرسال وهمي عبر FCM.',
    create:'حملة جديدة', search:'بحث الحملات...', channel:'القناة', audience:'الجمهور', status:'الحالة', scheduled:'مجدولة', sent:'مرسل/مؤهل', delivery:'التسليم', open:'الفتح', owner:'المالك', updated:'تحديث',
    allChannels:'كل القنوات', allStatuses:'كل الحالات', empty:'لا حملات بعد', emptyHint:'أنشئ حملة عبر قناة متاحة، أو ستظهر الحملات المرسلة هنا.',
    name:'الاسم', objective:'الهدف', deepLink:'الرابط العميق', audienceHint:'بلد/لغة/باقة/مسار عمري — دون استهداف أطفال محددين',
    createTitle:'حملة جديدة', channelLabel:'القناة *', nameLabel:'الاسم *', objectiveLabel:'الهدف', deepLinkLabel:'الرابط العميق', audienceLabel:'الجمهور', scheduledLabel:'الجدولة', now:'الآن', schedule:'جدولة',
    save:'حفظ', cancel:'إلغاء', loadError:'تعذر التحميل', noChannels:'لا قنوات متاحة — إعداد البريد غير مكتمل',
  },
  en:{
    eyebrow:'Growth', title:'Campaigns', lede:'Campaigns only via channels that can actually deliver — in-app / website banner / email. No fake FCM.',
    create:'New campaign', search:'Search campaigns...', channel:'Channel', audience:'Audience', status:'Status', scheduled:'Scheduled', sent:'Sent/Eligible', delivery:'Delivery', open:'Open', owner:'Owner', updated:'Updated',
    allChannels:'All channels', allStatuses:'All statuses', empty:'No campaigns yet', emptyHint:'Create a campaign on a real channel, or sent campaigns will appear here.',
    name:'Name', objective:'Objective', deepLink:'Deep link', audienceHint:'Country/language/plan/age band — no identifiable child targeting',
    createTitle:'New campaign', channelLabel:'Channel *', nameLabel:'Name *', objectiveLabel:'Objective', deepLinkLabel:'Deep link', audienceLabel:'Audience', scheduledLabel:'Schedule', now:'Now', schedule:'Schedule',
    save:'Save', cancel:'Cancel', loadError:'Unable to load', noChannels:'No channels available',
  }
}

const COLUMNS: ColumnDefinition[]=[
  { key:'campaign', label:'campaign', locked:true },
  { key:'channel', label:'channel' },
  { key:'audience', label:'audience' },
  { key:'status', label:'status' },
  { key:'scheduled', label:'scheduled' },
  { key:'sent', label:'sent' },
  { key:'delivery', label:'delivery' },
]

export function CampaignsPage(){
  const { locale }=usePreferences()
  const text=copy[locale as 'ar'|'en'] as any
  const navigate=useNavigate()
  const list=useUrlListState({ channel:'', status:'' } as any, { limit:25 })
  const { query, filters, offset, limit }=list
  const [rows,setRows]=useState<any[]>([])
  const [total,setTotal]=useState(0)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [creating,setCreating]=useState(false)
  const [form,setForm]=useState({ name:'', objective:'', channel:'in_app', deep_link:'', audience_countries:'', audience_languages:'', scheduled_at:'' })
  const [busy,setBusy]=useState(false)
  const [formError,setFormError]=useState('')
  const columns=useColumnPreferences('campaigns', COLUMNS)

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const res=await api.campaigns({ q: query || undefined, channel: filters.channel||undefined, status: filters.status||undefined, limit, offset } as any)
      setRows((res as any).data ?? [])
      setTotal((res as any).meta?.total ?? 0)
    }catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[query, filters.channel, filters.status, limit, offset, text.loadError])

  useEffect(()=>{ const t=setTimeout(()=> void load(), query? 250:0); return ()=> clearTimeout(t)},[load])

  const filterFields: FilterField[]=[
    { key:'channel', label:text.channel, type:'select', options:[{value:'',label:text.allChannels}, ...CHANNELS.map(v=>({value:v,label:v}))] },
    { key:'status', label:text.status, type:'select', options:[{value:'',label:text.allStatuses}, ...STATUSES.map(v=>({value:v,label:v}))] },
  ]

  const create=async()=>{
    if(!form.name.trim()){ setFormError('name required'); return }
    setBusy(true); setFormError('')
    try{
      const audience={ countries: form.audience_countries.split(',').map(s=>s.trim()).filter(Boolean), languages: form.audience_languages.split(',').map(s=>s.trim()).filter(Boolean) }
      await api.createCampaign({ name: form.name.trim(), objective: form.objective.trim()||undefined, channel: form.channel, deep_link: form.deep_link.trim()||undefined, audience, scheduled_at: form.scheduled_at||undefined })
      setCreating(false); setForm({ name:'', objective:'', channel:'in_app', deep_link:'', audience_countries:'', audience_languages:'', scheduled_at:'' }); await load()
    }catch(e){ setFormError(e instanceof Error? e.message: 'Error')} finally{ setBusy(false)}
  }

  if(loading && !rows.length) return <LoadingState/>
  if(error && !rows.length) return <ErrorState message={error} onRetry={()=>void load()}/>

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div><button className="button button--primary" onClick={()=> setCreating(true)}><Icon name="plus" size={16}/>{text.create}</button></section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><h3>{text.title} <span className="title-count">{total}</span></h3></div>
          <ListToolbar
            searchValue={query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={filterFields}
            values={filters as any}
            defaults={{ channel:'', status:'' } as any}
            onApply={(n)=> list.setFilters(n as any)}
            onClear={list.clearFilters}
            onRemove={(k)=> list.setFilter(k as any,'')}
            trailing={<><SavedViewsMenu storageKey="campaigns" currentSearch={list.search} onApply={(s)=> navigate(`${adminPath('campaigns')}${s}`)} /><ColumnManager columns={COLUMNS.map(c=> ({...c, label: (text as any)[c.label] ?? c.label }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} /></>}
          />
        </header>

        {rows.length ? <>
          <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr>
            <th>Campaign</th>{columns.isVisible('channel')&&<th>{text.channel}</th>}{columns.isVisible('audience')&&<th>{text.audience}</th>}{columns.isVisible('status')&&<th>{text.status}</th>}{columns.isVisible('scheduled')&&<th>{text.scheduled}</th>}{columns.isVisible('sent')&&<th>{text.sent}</th>}<th></th>
          </tr></thead><tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td><Link to={adminPath(`campaigns/${r.id}`)} style={{textDecoration:'none'}}><strong>{r.name}</strong><br/><small>{r.objective ?? ''}</small></Link></td>
                {columns.isVisible('channel')&&<td><span className="track-badge">{r.channel}</span></td>}
                {columns.isVisible('audience')&&<td><small>{(() => { try{ const a=JSON.parse(r.audience_json); return `${(a.countries??[]).join(',')||'—'} · ${(a.languages??[]).join(',')||'—'}` }catch{ return '—' } })()}</small></td>}
                {columns.isVisible('status')&&<td><span className={`account-status account-status--${r.status==='completed'?'active': r.status==='scheduled'?'pending':'draft'}`}>{r.status}</span></td>}
                {columns.isVisible('scheduled')&&<td dir="ltr">{r.scheduled_at ?? '—'}</td>}
                {columns.isVisible('sent')&&<td>{r.eligible_count ?? '—'} / {r.sent_count ?? '—'}</td>}
                <td><Link className="button button--ghost button--small" to={adminPath(`campaigns/${r.id}`)}>Open</Link></td>
              </tr>
            ))}
          </tbody></table></div>
          <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale as any} />
        </> : <EmptyState title={text.empty} description={text.emptyHint} action={<button className="button button--primary" onClick={()=> setCreating(true)}>{text.create}</button>} />}
      </section>

      <Modal open={creating} title={text.createTitle} onClose={()=> setCreating(false)}>
        <div className="entity-form">
          {formError && <p className="field__error" role="alert">{formError}</p>}
          <label className="field"><span>{text.nameLabel}</span><input value={form.name} onChange={e=> setForm({...form, name:e.target.value})} /></label>
          <label className="field"><span>{text.objectiveLabel}</span><input value={form.objective} onChange={e=> setForm({...form, objective:e.target.value})} /></label>
          <label className="field"><span>{text.channelLabel}</span><select value={form.channel} onChange={e=> setForm({...form, channel:e.target.value})}><option value="in_app">in_app</option><option value="website_banner">website_banner</option><option value="email">email</option></select><small>Only these 3 — push would require FCM/APNs tokens not stored</small></label>
          <label className="field"><span>{text.deepLinkLabel}</span><input dir="ltr" value={form.deep_link} onChange={e=> setForm({...form, deep_link:e.target.value})} placeholder="/ar/about or https://majarra.app/ar/story/123" /></label>
          <div className="field-row"><label className="field"><span>Countries</span><input value={form.audience_countries} onChange={e=> setForm({...form, audience_countries:e.target.value})} placeholder="EG,SA" /></label><label className="field"><span>Languages</span><input value={form.audience_languages} onChange={e=> setForm({...form, audience_languages:e.target.value})} placeholder="ar,en" /></label></div>
          <small>{text.audienceHint}</small>
          <label className="field"><span>{text.scheduledLabel}</span><input type="datetime-local" value={form.scheduled_at} onChange={e=> setForm({...form, scheduled_at: e.target.value ? new Date(e.target.value).toISOString(): ''})} /></label>
          <div className="form-actions"><button className="button button--primary" disabled={busy} onClick={()=> void create()}>{text.save}</button><button className="button button--ghost" onClick={()=> setCreating(false)}>{text.cancel}</button></div>
        </div>
      </Modal>
    </div>
  )
}
