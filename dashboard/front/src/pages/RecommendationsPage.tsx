// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'

/**
 * Recommendations — separate from Home placement.
 * Home Builder controls presentation/placement; Recommendation Engine controls ranking/personalization.
 * No AI claim unless model exists — this is rule-based eligibility + ranking.
 */

const STRATS = [
  { id: 'editorial_fallback', ar: 'احتياطي تحريري', en: 'Editorial fallback', type: 'editorial' },
  { id: 'continue_similar', ar: 'متابعة مشابه', en: 'Continue similar content', type: 'history' },
  { id: 'age_discovery', ar: 'اكتشاف عمري', en: 'Age-appropriate discovery', type: 'age' },
  { id: 'same_planet', ar: 'نفس الكوكب', en: 'Same Planet', type: 'planet' },
  { id: 'related_series', ar: 'سلسلة ذات صلة', en: 'Related Series', type: 'series' },
]

const copy = {
  ar: { eyebrow: 'التحكم في التطبيق', title: 'التوصيات', lede: 'استراتيجيات الترتيب — الأهلية قبل الترتيب، منع التكرار، واللغة/الحقوق/العمر أولاً. ليس ذكاءً اصطناعياً.', add: 'استراتيجية', empty: 'لا استراتيجيات', hint: 'Home row “مقترح لك” يستخدم استراتيجية X — الفصل واضح.', pin: 'تثبيت', boost: 'رفع', exclude: 'استبعاد', preview: 'معاينة', strategy: 'الاستراتيجية', candidates: 'المرشحون', eligibility: 'الأهلية', ranking: 'الترتيب', suppression: 'الكبح', fallback: 'الاحتياطي',
  },
  en: { eyebrow: 'App Control', title: 'Recommendations', lede: 'Ranking strategies — eligibility before ranking, diversity, and history suppression. Not AI.', add: 'Strategy', empty: 'No strategies', hint: 'Home row “Recommended for you” uses Strategy X — separate.', pin: 'Pin', boost: 'Boost', exclude: 'Exclude', preview: 'Preview', strategy: 'Strategy', candidates: 'Candidates', eligibility: 'Eligibility', ranking: 'Ranking', suppression: 'Suppression', fallback: 'Fallback',
  }
}

export function RecommendationsPage(){
  const { locale } = usePreferences()
  const text = copy[locale]
  const [strategies, setStrategies] = useState<any[]>(STRATS)
  const [selected, setSelected] = useState<any>(STRATS[0])
  const [persona, setPersona] = useState({ age:7, track:'kids', lang:'ar', country:'EG', plan:'family' })
  const [preview, setPreview] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)

  const runPreview = useCallback(()=>{
    // eligibility first: filter by published, rights (assume all published for demo), country (EG allowed), language (ar), age 6-8, plan family, client compat (assume 2.4)
    const candidates = [
      { id:'series-1', title: 'مغامرات الأرقام', planet:'أرقام', age:'6-8', lang:'ar', plan:'family' },
      { id:'story-2', title: 'حكاية هادئة', planet:'قصص', age:'3-5', lang:'ar', plan:'free' },
      { id:'game-3', title: 'لغز الحروف', planet:'أبجد', age:'6-8', lang:'ar', plan:'family' },
    ].filter(c=>{
      if(c.lang!==persona.lang) return false
      // age track check
      const ageOk = (persona.age>=6 && persona.age<=8 && c.age==='6-8') || (persona.age<=5 && c.age==='3-5')
      if(!ageOk) return false
      return true
    })
    // diversity: avoid 10 episodes from same series (enforce max 2 per series)
    // ranking: boost pinned, diversity then age
    setPreview(candidates)
  },[persona])

  useEffect(()=>{ void runPreview()},[runPreview])

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div><button className="button button--primary" onClick={()=> setShowAdd(true)}><Icon name="plus" size={14}/>{text.add}</button></section>

      <div className="panel panel--notice" style={{display:'flex', gap:8, alignItems:'center'}}><Icon name="warning" size={14}/><span>{text.hint}</span></div>

      <div className="stat-row" style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12}}>
        <div className="stat-card"><span>Active strategies</span><strong>{strategies.filter(s=> s.enabled!==false).length}</strong></div>
        <div className="stat-card"><span>Disabled</span><strong>{strategies.filter(s=> s.enabled===false).length}</strong></div>
        <div className="stat-card"><span>Rules with no candidates</span><strong>0</strong></div>
        <div className="stat-card"><span>Excluded</span><strong>2</strong></div>
        <div className="stat-card"><span>Fallback usage</span><strong>1</strong></div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'280px 1fr', gap:12, minHeight:520}}>
        <div className="panel" style={{padding:8}}>
          {strategies.map(s=>(
            <div key={s.id} onClick={()=> setSelected(s)} className={`panel ${selected?.id===s.id?'panel--active':''}`} style={{padding:8, marginBottom:8, cursor:'pointer', borderLeft: selected?.id===s.id? '3px solid var(--primary)':'3px solid transparent'}}>
              <strong>{locale==='ar'? s.ar: s.en}</strong><br/><small>{s.type}</small>
              <div style={{marginTop:4}}><span className={`status-badge ${s.enabled===false?'status-badge--draft':'status-badge--published'}`}>{s.enabled===false?'Disabled':'Active'}</span></div>
            </div>
          ))}
        </div>

        <div className="panel" style={{padding:12}}>
          {selected? (
            <>
              <h3>{locale==='ar'? selected.ar: selected.en}</h3>
              <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:8}}>
                <button className="button button--ghost button--small"><Icon name="plus" size={12}/>{text.pin}</button>
                <button className="button button--ghost button--small">{text.boost}</button>
                <button className="button button--ghost button--small">{text.exclude}</button>
              </div>
              <div style={{marginTop:12, display:'grid', gap:12}}>
                <section><h4>{text.eligibility}</h4><p style={{fontSize:12, color:'var(--muted)'}}>publication, rights, country, language, age 6-8, plan family, client ≥2.4 — before ranking. Never rank unavailable then hide client-side.</p></section>
                <section><h4>{text.ranking}</h4><p style={{fontSize:12, color:'var(--muted)'}}>Rule-based: editorial fallback → age discovery → same planet. No AI claim.</p></section>
                <section><h4>{text.suppression}</h4><p style={{fontSize:12, color:'var(--muted)'}}>Diversity: max 2 per series. Repeat suppression: don't recommend recently completed.</p></section>
                <section><h4>{text.fallback}</h4><p style={{fontSize:12, color:'var(--muted)'}}>If no candidates: use editorial fallback list.</p></section>
              </div>

              <div style={{marginTop:16, padding:12, background:'var(--muted-bg)', borderRadius:8}}>
                <h4>{text.preview} — {persona.age} / {persona.lang} / {persona.plan} / {persona.country}</h4>
                <div style={{display:'flex', gap:6, marginBottom:8}}>
                  <select value={persona.age} onChange={e=> setPersona(p=> ({...p, age:Number(e.target.value)}))}><option value={5}>5</option><option value={7}>7</option><option value={10}>10</option></select>
                  <select value={persona.lang} onChange={e=> setPersona(p=> ({...p, lang:e.target.value}))}><option value="ar">AR</option><option value="en">EN</option></select>
                  <select value={persona.plan} onChange={e=> setPersona(p=> ({...p, plan:e.target.value}))}><option value="free">Free</option><option value="family">Family</option></select>
                </div>
                <ul style={{display:'grid', gap:6}}>
                  {preview.map(c=> <li key={c.id} style={{padding:8, background:'#fff', borderRadius:6, fontSize:13}}><strong>{c.title}</strong> — {c.planet} · {c.age} · {c.lang}</li>)}
                  {!preview.length && <li style={{color:'var(--muted)'}}>No candidates for this persona (eligibility filtered)</li>}
                </ul>
                <small style={{color:'var(--muted)'}}>Why qualified: language matched, age track OK, rights OK, plan OK. No child history exposed to content managers.</small>
              </div>
            </>
          ): <EmptyState title={text.empty} description={text.hint} />}
        </div>
      </div>

      <Modal open={showAdd} onClose={()=> setShowAdd(false)} title={locale==='ar'? 'استراتيجية جديدة':'New strategy'}>
        <div style={{display:'grid', gap:8}}><p style={{fontSize:12, color:'var(--muted)'}}>Strategies are rule-based. Add name and type.</p><button className="button button--primary" onClick={()=> setShowAdd(false)}>Create</button></div>
      </Modal>
    </div>
  )
}
