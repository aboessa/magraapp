import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { SkillRecord } from '../types/api'

const DOMAIN_LABELS: Record<string, { ar: string; en: string }> = {
  cognitive: { ar: 'معرفية', en: 'Cognitive' },
  creative: { ar: 'إبداعية', en: 'Creative' },
  literacy: { ar: 'القراءة والكتابة', en: 'Literacy' },
  motor: { ar: 'حركية', en: 'Motor' },
  numeracy: { ar: 'عددية', en: 'Numeracy' },
  social: { ar: 'اجتماعية', en: 'Social' },
}

function domainLabel(key: string, locale: string){ return DOMAIN_LABELS[key]?.[locale==='ar'?'ar':'en'] ?? key }

const copy = {
  ar: {
    eyebrow: 'الإطار التعليمي',
    title: 'خريطة المهارات',
    intro: 'المهارة → أهداف → مسارات عمرية → محتوى → ألعاب/أنشطة → دليل إتقان.',
    total:'إجمالي المهارات', noObjectives:'بدون أهداف', noContent:'بدون محتوى', orphanObjectives:'أهداف بدون مهارة', weak:'ضعيفة التغطية', withGames:'لها ألعاب', measurable:'قابلة للقياس',
    map:'الخريطة', table:'الجدول', ageView:'تغطية الأعمار', matrix:'مصفوفة التغطية',
    search:'بحث بالمهارة...', domain:'المجال', age:'المسار العمري', hasObj:'لها أهداف', noObj:'بلا أهداف',
    all:'الكل',
    skill:'المهارة', domainCol:'المجال', ageTracks:'المسارات', objectives:'الأهداف', content:'المحتوى', games:'الألعاب', assessment:'التقييم', mastery:'الإتقان', health:'الحالة',
    viewSkill:'افتح المهارة', edit:'تعديل',
    workspace:'مساحة المهارة',
    overview:'نظرة عامة', objectivesTab:'الأهداف', ageTab:'الأعمار', contentTab:'المحتوى', gamesTab:'الألعاب', assessmentTab:'التقييم', history:'السجل',
    coverage:'التغطية', gap:'فجوة', noAssessment:'لا يوجد تقييم',
    create:'مهارة جديدة', createTitle:'إنشاء مهارة',
  },
  en: {
    eyebrow:'Learning framework',
    title:'Skills Map',
    intro:'Skill → Objectives → Age tracks → Content → Games → Evidence → Mastery.',
    total:'Total skills', noObjectives:'No objectives', noContent:'No content', orphanObjectives:'Orphan objectives', weak:'Weak coverage', withGames:'With games', measurable:'Measurable',
    map:'Map', table:'Table', ageView:'Age view', matrix:'Coverage matrix',
    search:'Search skill...', domain:'Domain', age:'Age track', hasObj:'Has objectives', noObj:'No objectives',
    all:'All',
    skill:'Skill', domainCol:'Domain', ageTracks:'Age tracks', objectives:'Objectives', content:'Content', games:'Games', assessment:'Assessment', mastery:'Mastery', health:'Health',
    viewSkill:'Open skill', edit:'Edit',
    workspace:'Skill workspace',
    overview:'Overview', objectivesTab:'Objectives', ageTab:'Age', contentTab:'Content', gamesTab:'Games', assessmentTab:'Assessment', history:'History',
    coverage:'Coverage', gap:'Gap', noAssessment:'No assessment',
    create:'New skill', createTitle:'Create skill',
  }
}

type View = 'map'|'table'|'age'|'matrix'

export function SkillsPage(){
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const [view, setView] = useState<View>('map')
  const [skills, setSkills] = useState<SkillRecord[]>([])
  const [objectives, setObjectives] = useState<any[]>([])
  const [episodes, setEpisodes] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [selected, setSelected] = useState<SkillRecord | null>(null)
  const [workspaceTab, setWorkspaceTab] = useState<'overview'|'objectives'|'age'|'content'|'games'|'assessment'|'history'>('overview')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name_ar:'', category:'cognitive', description:'' })

  const load = useCallback(async()=>{
    setLoading(true)
    try{
      const [s, o, e, g] = await Promise.all([
        api.skills({} as any), api.learningObjectives({ limit:100 } as any), api.episodes({ limit:20 } as any), api.games({ limit:20 } as any)
      ])
      setSkills((s as any).data || s as any)
      setObjectives((o as any).data || [])
      setEpisodes((e as any).data || [])
      setGames((g as any).data || [])
    } catch(e){ setError(e instanceof Error? e.message:'خطأ') } finally{ setLoading(false)}
  },[])
  useEffect(()=>{ void load()},[load])

  const filtered = useMemo(()=>{
    let arr=[...skills]
    if(query) arr=arr.filter(s=> `${s.name_ar} ${s.id}`.toLowerCase().includes(query.toLowerCase()))
    if(domainFilter) arr=arr.filter(s=> s.category===domainFilter)
    return arr
  },[skills, query, domainFilter])

  const metrics = useMemo(()=>{
    const total=skills.length
    const noObj=skills.filter(s=> !objectives.some(o=> o.skill_id===s.id)).length
    const noContent = skills.filter(s=>{
      const objs = objectives.filter(o=> o.skill_id===s.id).map(o=>o.id)
      return !episodes.some(e=> objs.includes((e as any).objective_id)) && !games.some(g=> objs.includes((g as any).learning_objective_id))
    }).length
    const withGames = skills.filter(s=> {
      const objs = objectives.filter(o=>o.skill_id===s.id).map(o=>o.id)
      return games.some(g=> objs.includes((g as any).learning_objective_id))
    }).length
    return { total, noObj, noContent, orphanObjectives: objectives.filter(o=> !o.skill_id).length, weak: noContent, withGames, measurable: objectives.filter(o=> o.measurable_criteria).length }
  },[skills, objectives, episodes, games])

  const ageMatrix = useMemo(()=>{
    const tracks = ['preschool','kids','junior']
    const matrix: Record<string, Record<string, number>> = {}
    for(const s of filtered){
      matrix[s.id]={}
      for(const t of tracks){
        const objs = objectives.filter(o=> o.skill_id===s.id && o.track_ids?.includes(t))
        matrix[s.id][t]=objs.length
      }
    }
    return { tracks, matrix }
  },[filtered, objectives])

  if(loading) return <LoadingState label="جارٍ تحميل خريطة المهارات..." />
  if(error) return <ErrorState message={error} onRetry={()=> void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.intro}</p></div><button className="button button--primary" onClick={()=> setCreateOpen(true)}><Icon name="plus" size={14}/>{text.create}</button></section>

      <section className="prod-command">
        <button className="prod-metric" onClick={()=> setDomainFilter('')}><strong>{metrics.total}</strong><span>{text.total}</span></button>
        <button className="prod-metric prod-metric--blocked" onClick={()=> {}}><strong>{metrics.noObj}</strong><span>{text.noObjectives}</span></button>
        <button className="prod-metric prod-metric--blocked"><strong>{metrics.noContent}</strong><span>{text.noContent}</span></button>
        <button className="prod-metric"><strong>{metrics.withGames}</strong><span>{text.withGames}</span></button>
        <button className="prod-metric"><strong>{metrics.measurable}</strong><span>{text.measurable}</span></button>
      </section>

      <div className="detail-tabs" role="tablist">
        {(['map','table','age','matrix'] as View[]).map(v=> <button key={v} role="tab" aria-selected={view===v} className={`detail-tab ${view===v?'detail-tab--active':''}`} onClick={()=> setView(v)}>{(text as any)[v==='map'?'map': v==='table'?'table': v==='age'?'ageView':'matrix']}</button>)}
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div className="search-field" style={{ flex:1 }}><Icon name="search" size={14}/><input value={query} onChange={(e)=> setQuery(e.target.value)} placeholder={text.search} /></div>
        <select value={domainFilter} onChange={(e)=> setDomainFilter(e.target.value)}><option value="">{text.domain}: {text.all}</option>{Object.keys(DOMAIN_LABELS).map(k=> <option key={k} value={k}>{domainLabel(k, locale)}</option>)}</select>
      </div>

      {view==='map' && (
        <section className="panel">
          <div style={{ display:'grid', gap:16, padding:16 }}>
            {Object.entries(
              filtered.reduce((acc:any, s)=>{
                const d=s.category; if(!acc[d]) acc[d]=[]; acc[d].push(s); return acc;
              },{} as Record<string, SkillRecord[]>)
            ).map(([domain, list])=>(
              <div key={domain}>
                <h3 style={{ fontSize:14, margin:'0 0 8px', color:'var(--muted)' }}>{domainLabel(domain, locale)}</h3>
                <div className="vs-grid">
                  {(list as SkillRecord[]).map(s=>{
                    const objs = objectives.filter(o=> o.skill_id===s.id)
                    const contentCount = episodes.filter(e=> objs.some(o=> o.id===(e as any).objective_id)).length + games.filter(g=> objs.some(o=> o.id===(g as any).learning_objective_id)).length
                    const gamesCount = games.filter(g=> objs.some(o=> o.id===(g as any).learning_objective_id)).length
                    const hasAssessment = gamesCount>0
                    return (
                      <article key={s.id} className="vs-card" style={{ cursor:'pointer' }} onClick={()=> setSelected(s)}>
                        <div className="vs-card__body"><h3>{s.name_ar}</h3><small>{s.id} · {domainLabel(s.category, locale)}</small>
                          <div className="vs-card__meta" style={{ marginTop:8 }}>
                            <span>{objs.length} أهداف</span><span>{contentCount} محتوى</span><span>{gamesCount} ألعاب</span><span>{(s as any).age_tracks?.join('·') || '3–8 سنوات'}</span>
                          </div>
                          <div style={{ marginTop:8 }}>{!hasAssessment && <span className="status-badge status-badge--review">{text.noAssessment}</span>}</div>
                        </div>
                        <footer className="vs-card__foot"><span className={`prod-chip ${contentCount===0?'prod-chip--blocked':'prod-chip--complete'}`}>{contentCount===0? text.noContent: 'Coverage: GOOD'}</span><span>{formatNumber(gamesCount, locale as any)} ألعاب</span></footer>
                      </article>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view==='table' && (
        <section className="panel panel--table"><div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr><th>{text.skill}</th><th>{text.domainCol}</th><th>{text.objectives}</th><th>{text.content}</th><th>{text.games}</th><th>{text.assessment}</th><th>{text.health}</th><th /></tr></thead><tbody>
          {filtered.map(s=>{
            const objs = objectives.filter(o=> o.skill_id===s.id)
            const contentCount = episodes.filter(e=> objs.some(o=> o.id===(e as any).objective_id)).length
            return <tr key={s.id}><td><strong>{s.name_ar}</strong><br/><small dir="ltr">{s.id}</small></td><td>{domainLabel(s.category, locale)}</td><td><Link to={adminPath(`objectives`)} className="prod-chip" style={{ cursor:'pointer' }}>{objs.length}</Link></td><td>{contentCount}</td><td>{games.filter(g=> objs.some(o=> o.id===(g as any).learning_objective_id)).length}</td><td>{contentCount? '—': text.noAssessment}</td><td>{objs.length===0? <span className="prod-chip prod-chip--blocked">No objectives</span>: contentCount===0? <span className="prod-chip prod-chip--blocked">No content</span>: <span className="prod-chip prod-chip--complete">OK</span>}</td><td><button className="button button--ghost button--small" onClick={()=> setSelected(s)}>{text.viewSkill}</button></td></tr>
          })}
        </tbody></table></div></section>
      )}

      {view==='age' && (
        <section className="panel"><div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>المهارة</th><th>3–5</th><th>6–8</th><th>9–12</th></tr></thead><tbody>
          {filtered.map(s=>(
            <tr key={s.id}><td>{s.name_ar}</td>{ageMatrix.tracks.map(t=> <td key={t}>{ageMatrix.matrix[s.id]?.[t] ? '●' : '—'}</td>)}</tr>
          ))}
        </tbody></table></div></section>
      )}

      {view==='matrix' && (
        <section className="panel"><div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>المهارة</th><th>Episodes</th><th>Stories</th><th>Games</th><th>Activities</th></tr></thead><tbody>
          {filtered.map(s=>{
            const objs = objectives.filter(o=> o.skill_id===s.id).map(o=>o.id)
            const ep = episodes.filter(e=> objs.includes((e as any).objective_id)).length
            const ga = games.filter(g=> objs.includes((g as any).learning_objective_id)).length
            return <tr key={s.id}><td>{s.name_ar}</td><td><Link to={adminPath('episodes')} className="prod-chip">{ep}</Link></td><td>0</td><td><Link to={adminPath('games')} className="prod-chip">{ga}</Link></td><td>0</td></tr>
          })}
        </tbody></table></div></section>
      )}

      {selected && (
        <div className="drawer-backdrop" onClick={()=> setSelected(null)}>
          <div className="drawer drawer--wide" onClick={(e)=> e.stopPropagation()} role="dialog">
            <header className="drawer__header"><div><h2>{selected.name_ar}</h2><small>{selected.id} · {domainLabel(selected.category, locale)}</small></div><button className="icon-button" onClick={()=> setSelected(null)}><Icon name="close" size={16}/></button></header>
            <div className="drawer__body">
              <div className="detail-tabs" role="tablist">
                {(['overview','objectives','age','content','games','assessment','history'] as const).map(t=> <button key={t} role="tab" aria-selected={workspaceTab===t} className={`detail-tab ${workspaceTab===t?'detail-tab--active':''}`} onClick={()=> setWorkspaceTab(t)}>{(text as any)[t==='overview'? 'overview': t==='objectives'?'objectivesTab': t]}</button>)}
              </div>
              {workspaceTab==='overview' && <div><p>{selected.description || 'لا وصف'}</p><div className="metric-row" style={{ marginTop:12 }}><div className="metric-cell"><strong>{objectives.filter(o=>o.skill_id===selected.id).length}</strong><span>أهداف</span></div><div className="metric-cell"><strong>{episodes.filter(e=> objectives.filter(o=>o.skill_id===selected.id).some(o=>o.id===(e as any).objective_id)).length}</strong><span>محتوى</span></div></div></div>}
              {workspaceTab==='objectives' && <ul>{objectives.filter(o=>o.skill_id===selected.id).map(o=> <li key={o.id}><Link to={adminPath(`objectives`)}>{o.title_ar}</Link> · {o.track_ids?.join(',')}</li>)}</ul>}
              {workspaceTab==='history' && <p className="panel__note">السجل — منشئ/تعديل</p>}
            </div>
          </div>
        </div>
      )}

      <Modal open={createOpen} onClose={()=> setCreateOpen(false)} title={text.createTitle}>
        <div className="entity-form">
          <label className="field"><span>الاسم عربي *</span><input value={form.name_ar} onChange={(e)=> setForm({...form, name_ar:e.target.value})} /></label>
          <label className="field"><span>المجال *</span><select value={form.category} onChange={(e)=> setForm({...form, category:e.target.value})}><option value="cognitive">معرفية</option><option value="literacy">القراءة والكتابة</option><option value="creative">إبداعية</option><option value="motor">حركية</option></select></label>
          <label className="field"><span>الوصف</span><textarea rows={3} value={form.description} onChange={(e)=> setForm({...form, description:e.target.value})} /></label>
          <div className="form-actions"><button className="button button--ghost" onClick={()=> setCreateOpen(false)}>إلغاء</button><button className="button button--primary" onClick={async()=>{ await api.createSkill({ name_ar: form.name_ar, category: form.category, description: form.description } as any); setCreateOpen(false); void load()}}>حفظ</button></div>
        </div>
      </Modal>
    </div>
  )
}
