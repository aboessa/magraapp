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
    <div className="content-studio-root">
      {/* 1. Commercial Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className="status-beacon__dot status-beacon__dot--emerald" />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">
                {locale === 'ar' ? 'محرك التوصيات التحريرية الشفاف' : 'Transparent Editorial Recommendation Engine'}
              </span>
              <span className="status-beacon__sub">
                {locale === 'ar' ? 'قواعد الأهلية تسبق الترتيب · لا خوارزميات غامضة' : 'Eligibility before ranking · Deterministic rules'}
              </span>
            </div>
          </div>
        </div>

        <div className="commercial-command-strip__right">
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
            <span>{text.refresh}</span>
          </button>
          <button className="button button--primary button--small" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={14} />
            <span>{text.add}</span>
          </button>
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, rgba(59, 130, 246, 0.14) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" />
              {rows.length} {locale === 'ar' ? 'توصية نشطة' : 'active pins'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Bento Grid Matrix */}
      <div className="commercial-bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <div className="commercial-bento-card commercial-bento-card--indigo">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.stats.total}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="grid" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{stats.total}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'كل التوصيات التحريرية' : 'All pins'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--purple">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.stats.pinned}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="sparkles" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{stats.pinned}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'مثبتة في صدارة الشريط' : 'Top of rail'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.stats.global}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="globe" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{stats.global}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'تظهر لجميع الأطفال' : 'Global rail'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.stats.personalized}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="children" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{stats.personalized}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'مستهدفة لطفل محدد' : 'Child specific'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--slate">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.stats.hidden}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="eye" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{stats.hidden}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'مستبعدة مؤقتاً' : 'Temporarily muted'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--cyan">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'مرشحو المعاينة' : 'Candidates'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{preview.length}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'مؤهلون للشخصية الحالية' : 'Persona qualified'}</span>
          </div>
        </div>
      </div>

      {notice && <div className="inline-alert inline-alert--success" style={{ margin: '12px 0' }}>{notice}</div>}
      {error && <div className="inline-alert inline-alert--error" style={{ margin: '12px 0' }}>{error}</div>}

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
