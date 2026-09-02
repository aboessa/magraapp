import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { PLANS, AGE_TRACKS } from '../lib/constants'

const copy = {
  ar: {
    eyebrow: 'التحكم في التطبيق · التوصيات',
    title: 'محرك التوصيات التحريري',
    lede: 'تثبيت تحريري لسلسلة في شريط الطفل. الأهلية قبل الترتيب — اللغة/الحقوق/العمر أولاً. ليس ذكاءً اصطناعياً، بل قواعد شفافة.',
    add: 'تثبيت توصية', refresh: 'تحديث',
    stats: { total:'الإجمالي', pinned:'مثبتة', hidden:'مخفية', global:'عامة (لكل طفل)', personalized:'مخصصة لطفل' },
    table: { series:'السلسلة', child:'الطفل المستهدف', reason:'السبب', priority:'الأولوية', pinned:'تثبيت', hidden:'إخفاء', created:'تاريخ', actions:'' },
    form: { seriesId:'معرّف السلسلة *', childId:'معرّف الطفل (اختياري - فاضي = عامة)', reason:'السبب', priority:'الأولوية 0-1000', pinned:'تثبيت في الأعلى؟', seriesHint:'سلسلة نشطة من الكتالوج - سيتم التحقق في الخادم', childHint:'اتركه فاضي لتظهر التوصية لكل الأطفال، أو أدخل child_id لطفل محدد', reasonHint:'مثال: editorial, ramadan, new_release - max 120 حرف', priorityHint:'الأعلى = يظهر أولاً. المثبتة دائماً فوق غير المثبتة' },
    previewTitle: 'معاينة الأهلية حسب شخصية الطفل',
    eligibility: 'قواعد الأهلية', ranking: 'الترتيب', suppression: 'الكبح والتنوع', fallback: 'الاحتياطي',
    eligibilityDesc: 'النشر، الحقوق، البلد، اللغة، العمر، الخطة، إصدار العميل - قبل أي ترتيب. لا نرتب غير المتاح ثم نخفيه في العميل.',
    rankingDesc: 'قائم على القواعد: المثبتة أولاً، ثم حسب الأولوية، ثم الاكتشاف العمري ثم نفس الكوكب. لا ندعي AI.',
    suppressionDesc: 'التنوع: حد أقصى 2 حلقة من نفس السلسلة في الشريط. كبح التكرار: لا نوصي بما أكمله الطفل مؤخراً.',
    fallbackDesc: 'إن لم يوجد مرشحون: استخدم قائمة احتياطي تحريري ثابتة.',
    pin:'تثبيت', unpin:'إلغاء تثبيت', hide:'إخفاء', unhide:'إظهار', delete:'حذف', edit:'تعديل',
    confirmDelete:'حذف هذه التوصية؟',
    empty:'لا توصيات', emptyHint:'أول تثبيت تحريري سيظهر لكل الأطفال في شريط الرئيسية.',
    loadError:'تعذر تحميل التوصيات', createOk:'تم التثبيت', deleteOk:'تم الحذف',
  },
  en: {
    eyebrow: 'App Control · Recommendations',
    title: 'Editorial recommendation engine',
    lede: 'Pin a series into child home rail. Eligibility before ranking — language/rights/age first. Rule-based, not AI.',
    add: 'Pin recommendation', refresh:'Refresh',
    stats:{ total:'Total', pinned:'Pinned', hidden:'Hidden', global:'Global (all children)', personalized:'Child-specific' },
    table:{ series:'Series', child:'Target child', reason:'Reason', priority:'Priority', pinned:'Pinned', hidden:'Hidden', created:'Created', actions:'' },
    form:{ seriesId:'Series ID *', childId:'Child ID (optional - empty = global)', reason:'Reason', priority:'Priority 0-1000', pinned:'Pin to top?', seriesHint:'Active series from catalogue - validated server-side', childHint:'Empty = shows for all children, or enter child_id for specific child', reasonHint:'e.g. editorial, ramadan, new_release - max 120 chars', priorityHint:'Higher = shows first. Pinned always above non-pinned' },
    previewTitle:'Eligibility preview by child persona',
    eligibility:'Eligibility', ranking:'Ranking', suppression:'Suppression & diversity', fallback:'Fallback',
    eligibilityDesc:'Publication, rights, country, language, age, plan, client version - before ranking. Never rank unavailable then hide client-side.',
    rankingDesc:'Rule-based: pinned first, then priority, then age discovery then same planet. No AI claim.',
    suppressionDesc:'Diversity: max 2 per series in rail. Repeat suppression: don\'t recommend recently completed.',
    fallbackDesc:'If no candidates: use static editorial fallback list.',
    pin:'Pin', unpin:'Unpin', hide:'Hide', unhide:'Unhide', delete:'Delete', edit:'Edit',
    confirmDelete:'Delete this recommendation?',
    empty:'No recommendations', emptyHint:'First editorial pin will appear for all children in home rail.',
    loadError:'Unable to load recommendations', createOk:'Pinned', deleteOk:'Deleted',
  }
}

export function RecommendationsPage(){
  const { locale }=usePreferences()
  const text=copy[locale==='en'?'en':'ar'] as any
  const [rows,setRows]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [showAdd,setShowAdd]=useState(false)
  const [form,setForm]=useState({ series_id:'', child_id:'', reason:'editorial', priority:'100', is_pinned:true })
  const [formError,setFormError]=useState('')
  const [saving,setSaving]=useState(false)
  const [persona,setPersona]=useState({ age:7, track:'kids', lang:'ar', country:'EG', plan:'family' })
  const [preview,setPreview]=useState<any[]>([])

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{ const res=await api.recommendations(); setRows(res.data ?? []) }
    catch(e){ setError(e instanceof Error? e.message: text.loadError) } finally{ setLoading(false) }
  },[text.loadError])

  useEffect(()=>{ void load() },[load])

  const stats=useMemo(()=>({
    total: rows.length,
    pinned: rows.filter(r=> r.is_pinned).length,
    hidden: rows.filter(r=> r.is_hidden).length,
    global: rows.filter(r=> !r.child_id).length,
    personalized: rows.filter(r=> !!r.child_id).length,
  }),[rows])

  const runPreview=useCallback(()=>{
    const candidates=[
      { id:'series-1', title:'مغامرات الأرقام', planet:'أرقام', age:'6-8', lang:'ar', plan:'family' },
      { id:'story-2', title:'حكاية هادئة', planet:'قصص', age:'3-5', lang:'ar', plan:'free' },
      { id:'game-3', title:'لغز الحروف', planet:'أبجد', age:'6-8', lang:'ar', plan:'family' },
      // مرشَّحٌ للروّاد ٩–١٢: لم يكن في القائمة، فمسارهم كان يعرض «لا مرشَّحين»
      // لسببين معًا — شرطٌ أبدًا غير صحيح، وبيانات معاينة بلا صفٍّ لهم. تصحيح
      // الشرط وحده يُبقي الشاشة كما كانت، فالخلل يبقى ظاهرًا للمستخدم.
      { id:'series-4', title:'رحلة الحضارات', planet:'تاريخ', age:'9-12', lang:'ar', plan:'family' },
    ].filter(c=>{
      if(c.lang!==persona.lang) return false
      // كان الشرط الأخير `persona.age==='9-12'`: مقارنة رقم بنصّ، فهي **أبدًا
      // غير صحيحة**، فمسار ٩–١٢ كان يعرض «لا نتائج» دائمًا. الصفّ هو من يحمل
      // النطاق النصّي لا الشخص.
      const ageOk=(persona.age>=6 && persona.age<=8 && c.age==='6-8') || (persona.age<=5 && c.age==='3-5') || (persona.age>=9 && c.age==='9-12')
      if(!ageOk) return false
      return true
    })
    setPreview(candidates)
  },[persona])
  useEffect(()=>{ runPreview() },[runPreview])

  async function create(){
    if(!form.series_id.trim()){ setFormError('series_id required'); return }
    setSaving(true); setFormError('')
    try{
      await api.createRecommendation({
        series_id: form.series_id.trim(),
        child_id: form.child_id.trim() || null,
        reason: form.reason.trim() || 'editorial',
        priority: Number(form.priority)||0,
        is_pinned: !!form.is_pinned,
      })
      setNotice(text.createOk); setShowAdd(false); setForm({ series_id:'', child_id:'', reason:'editorial', priority:'100', is_pinned:true }); await load()
    }catch(e){ setFormError(e instanceof Error? e.message: 'Error') } finally{ setSaving(false) }
  }
  async function togglePin(row:any){
    try{ await api.updateRecommendation(row.id, { is_pinned: !row.is_pinned }); await load() } catch{}
  }
  async function toggleHide(row:any){
    try{ await api.updateRecommendation(row.id, { is_hidden: !row.is_hidden }); await load() } catch{}
  }
  async function del(row:any){
    if(!window.confirm(text.confirmDelete)) return
    try{ await api.deleteRecommendation(row.id); setNotice(text.deleteOk); await load() } catch(e){ setError(e instanceof Error? e.message: 'Error') }
  }

  if(loading && !rows.length) return <LoadingState/>
  if(error && !rows.length) return <ErrorState message={error} onRetry={()=>void load()} />

  return (
    <div className="page-stack" style={{ gap:18 }}>
      <style>{`
        .rec-hero{position:relative;border-radius:20px;border:1px solid var(--line);background:linear-gradient(160deg, var(--surface), color-mix(in srgb, var(--surface-2) 88%, var(--surface)));padding:22px;overflow:hidden}
        .rec-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(520px 220px at 85% -10%, rgba(86,121,242,.12), transparent 60%), radial-gradient(380px 200px at 5% 110%, rgba(255,211,77,.10), transparent 70%)}
        .rec-hero>*{position:relative}
        .rec-kicker{display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);font-size:10px;font-weight:700;color:var(--muted)}
        .rec-title{margin-top:12px;font-size:clamp(22px,2.6vw,30px);letter-spacing:-.04em}
        .rec-lede{margin-top:8px;max-width:720px;color:var(--text-soft);font-size:11px;line-height:1.8}
        .stat-grid{display:grid;grid-template-columns:repeat(5, minmax(0,1fr));gap:12px}
        @media(max-width:1100px){.stat-grid{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:640px){.stat-grid{grid-template-columns:repeat(2,1fr)}}
        .s-card{border-radius:16px;border:1px solid var(--line);background:linear-gradient(180deg, var(--surface), var(--surface-2));padding:14px;transition:transform .16s}
        .s-card:hover{transform:translateY(-1px)}
        .s-card__top{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:10px;font-weight:700}
        .s-card__icon{width:28px;height:28px;border-radius:9px;display:grid;place-items:center}
        .s-card__value{margin-top:10px;font-size:22px;font-weight:800}
        .s-card--pinned .s-card__icon{background:rgba(86,121,242,.12);color:var(--primary)}
        .s-card--hidden .s-card__icon{background:rgba(161,161,161,.12);color:var(--muted)}
        .s-card--global .s-card__icon{background:rgba(34,184,120,.10);color:#0e7a4d}
        .rec-panel{border:1px solid var(--line);border-radius:16px;background:var(--surface);overflow:hidden}
        .rec-panel__head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}
        .rule-grid{display:grid;grid-template-columns:repeat(2, minmax(0,1fr));gap:12px;padding:14px}
        @media(max-width:800px){.rule-grid{grid-template-columns:1fr}}
        .rule{padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2)}
        .rule h4{font-size:11px;margin-bottom:6px}
        .rule p{font-size:11px;color:var(--muted);line-height:1.6}
      `}</style>

      <section className="rec-hero">
        <div style={{ display:'flex', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div><span className="rec-kicker"><Icon name="sparkles" size={12}/>{text.eyebrow}</span><h2 className="rec-title">{text.title}</h2><p className="rec-lede">{text.lede}</p></div>
          <div style={{ display:'flex', gap:8, alignItems:'start' }}><button className="button button--secondary" onClick={()=>void load()}><Icon name="refresh" size={14}/>{text.refresh}</button><button className="button button--primary" onClick={()=> setShowAdd(true)}><Icon name="plus" size={14}/>{text.add}</button></div>
        </div>
      </section>

      <div className="stat-grid">
        <div className="s-card"><div className="s-card__top"><span>{text.stats.total}</span><span className="s-card__icon" style={{ background:'rgba(86,121,242,.12)', color:'var(--primary)' }}><Icon name="text" size={14}/></span></div><strong className="s-card__value">{stats.total}</strong></div>
        <div className="s-card s-card--pinned"><div className="s-card__top"><span>{text.stats.pinned}</span><span className="s-card__icon"><Icon name="sparkles" size={14}/></span></div><strong className="s-card__value">{stats.pinned}</strong></div>
        <div className="s-card s-card--hidden"><div className="s-card__top"><span>{text.stats.hidden}</span><span className="s-card__icon"><Icon name="eye" size={14}/></span></div><strong className="s-card__value">{stats.hidden}</strong></div>
        <div className="s-card s-card--global"><div className="s-card__top"><span>{text.stats.global}</span><span className="s-card__icon"><Icon name="globe" size={14}/></span></div><strong className="s-card__value">{stats.global}</strong></div>
        <div className="s-card"><div className="s-card__top"><span>{text.stats.personalized}</span><span className="s-card__icon" style={{ background:'rgba(245,165,36,.12)', color:'#b47800' }}><Icon name="children" size={14}/></span></div><strong className="s-card__value">{stats.personalized}</strong></div>
      </div>

      {notice && <div className="inline-alert inline-alert--success">{notice}</div>}
      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      <section className="rec-panel">
        <div className="rec-panel__head"><h3 style={{ fontSize:13 }}>Editorial pins <span className="title-count">{rows.length}</span></h3><span style={{ color:'var(--muted)', fontSize:10 }}>is_pinned DESC, priority DESC, created DESC — served to child home rail</span></div>
        {rows.length ? (
          <div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr><th>{text.table.series}</th><th>{text.table.child}</th><th>{text.table.reason}</th><th>{text.table.priority}</th><th>{text.table.pinned}</th><th>{text.table.hidden}</th><th>{text.table.created}</th><th></th></tr></thead><tbody>
            {rows.map((r:any)=>(
              <tr key={r.id}>
                <td><Link to={adminPath(`series/${r.series_id}`)} style={{ textDecoration:'none' }}><strong style={{ fontSize:11 }}>{r.series_title ?? r.series_id}</strong><br/><small style={{ color:'var(--muted)', fontSize:10 }}>{r.series_id}{r.planet_name?` · ${r.planet_name}`:''}</small></Link></td>
                <td>{r.child_id ? <Link to={adminPath(`children/${r.child_id}`)} dir="ltr" style={{ fontSize:11 }}>{r.child_id.slice(0,12)}…</Link> : <span className="status-badge status-badge--published" style={{ fontSize:10 }}>Global</span>}</td>
                <td><span className="track-badge">{r.reason}</span></td>
                <td><strong style={{ fontSize:12 }}>{r.priority}</strong></td>
                <td>{r.is_pinned ? <span className="status-badge status-badge--published">Pinned</span> : <span className="table-secondary">—</span>}</td>
                <td>{r.is_hidden ? <span className="status-badge status-badge--draft">Hidden</span> : <span className="table-secondary">—</span>}</td>
                <td style={{ fontSize:11 }}>{r.created_at?.slice(0,16) ?? '—'}</td>
                <td><div className="table-actions"><button className="button button--ghost button--small" onClick={()=>void togglePin(r)}>{r.is_pinned? text.unpin: text.pin}</button><button className="button button--ghost button--small" onClick={()=>void toggleHide(r)}>{r.is_hidden? text.unhide: text.hide}</button><button className="button button--ghost button--small" style={{ color:'var(--danger)' }} onClick={()=>void del(r)}>{text.delete}</button></div></td>
              </tr>
            ))}
          </tbody></table></div>
        ) : <div style={{ padding:28 }}><EmptyState title={text.empty} description={text.emptyHint} action={<button className="button button--primary" onClick={()=>setShowAdd(true)}>{text.add}</button>} /></div>}
      </section>

      <div style={{ display:'grid', gridTemplateColumns:'1.1fr .9fr', gap:12 }}>
        <section className="rec-panel"><div style={{ padding:14 }}><h3 style={{ fontSize:12, marginBottom:12 }}>Rules</h3><div className="rule-grid" style={{ padding:0 }}>
          <div className="rule"><h4>{text.eligibility}</h4><p>{text.eligibilityDesc}</p></div>
          <div className="rule"><h4>{text.ranking}</h4><p>{text.rankingDesc}</p></div>
          <div className="rule"><h4>{text.suppression}</h4><p>{text.suppressionDesc}</p></div>
          <div className="rule"><h4>{text.fallback}</h4><p>{text.fallbackDesc}</p></div>
        </div></div></section>

        <section className="rec-panel"><div style={{ padding:14 }}>
          <h3 style={{ fontSize:12 }}>{text.previewTitle}</h3>
          <p style={{ color:'var(--muted)', fontSize:10, marginTop:4 }}>Why qualified: language matched, age track OK, rights OK, plan OK. No child history exposed.</p>
          <div style={{ display:'flex', gap:6, margin:'12px 0', flexWrap:'wrap' }}>
            <select value={persona.age} onChange={e=> setPersona(p=>({...p, age:Number(e.target.value)}))} style={{ height:34, borderRadius:8, border:'1px solid var(--line)', background:'var(--surface-2)', padding:'0 8px' }}><option value={5}>5</option><option value={7}>7</option><option value={10}>10</option></select>
            <select value={persona.track} onChange={e=> setPersona(p=>({...p, track:e.target.value}))} style={{ height:34, borderRadius:8, border:'1px solid var(--line)', background:'var(--surface-2)', padding:'0 8px' }}>{AGE_TRACKS.map(t=> <option key={t} value={t}>{t}</option>)}</select>
            <select value={persona.lang} onChange={e=> setPersona(p=>({...p, lang:e.target.value}))} style={{ height:34, borderRadius:8, border:'1px solid var(--line)', background:'var(--surface-2)', padding:'0 8px' }}><option value="ar">AR</option><option value="en">EN</option><option value="fr">FR</option></select>
            <select value={persona.plan} onChange={e=> setPersona(p=>({...p, plan:e.target.value}))} style={{ height:34, borderRadius:8, border:'1px solid var(--line)', background:'var(--surface-2)', padding:'0 8px' }}>{PLANS.map(p=> <option key={p} value={p}>{p}</option>)}</select>
            <select value={persona.country} onChange={e=> setPersona(p=>({...p, country:e.target.value}))} style={{ height:34, borderRadius:8, border:'1px solid var(--line)', background:'var(--surface-2)', padding:'0 8px' }}><option value="EG">EG</option><option value="SA">SA</option><option value="AE">AE</option><option value="US">US</option></select>
          </div>
          <div style={{ display:'grid', gap:6 }}>
            {preview.map(c=> <div key={c.id} style={{ padding:10, borderRadius:10, border:'1px solid var(--line)', background:'var(--surface-2)', display:'flex', justifyContent:'space-between' }}><strong style={{ fontSize:12 }}>{c.title}</strong><span style={{ fontSize:11, color:'var(--muted)' }}>{c.planet} · {c.age} · {c.lang}</span></div>)}
            {!preview.length && <div style={{ padding:18, textAlign:'center', color:'var(--muted)', fontSize:11 }}>No candidates for this persona (eligibility filtered)</div>}
          </div>
        </div></section>
      </div>

      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title={text.add}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field"><span>{text.form.seriesId}</span><input value={form.series_id} onChange={e=> setForm({...form, series_id:e.target.value})} dir="ltr" placeholder="series_xxx" style={{ height:40 }}/><small>{text.form.seriesHint}</small></label>
          <label className="field"><span>{text.form.childId}</span><input value={form.child_id} onChange={e=> setForm({...form, child_id:e.target.value})} dir="ltr" placeholder="child_id or empty = global" style={{ height:40 }}/><small>{text.form.childHint}</small></label>
          <div className="form-grid">
            <label className="field"><span>{text.form.reason}</span><input value={form.reason} onChange={e=> setForm({...form, reason:e.target.value})} placeholder="editorial" style={{ height:40 }}/><small>{text.form.reasonHint}</small></label>
            <label className="field"><span>{text.form.priority}</span><input type="number" min={0} max={1000} value={form.priority} onChange={e=> setForm({...form, priority:e.target.value})} style={{ height:40 }}/><small>{text.form.priorityHint}</small></label>
          </div>
          <label className="field"><span><input type="checkbox" checked={form.is_pinned} onChange={e=> setForm({...form, is_pinned:e.target.checked})} /> {text.form.pinned}</span></label>
          <div className="form-actions"><button className="button button--ghost" onClick={()=>setShowAdd(false)}>Cancel</button><button className="button button--primary" disabled={saving} onClick={()=>void create()}>{saving?'Saving…':'Pin'}</button></div>
        </div>
      </Modal>
    </div>
  )
}
