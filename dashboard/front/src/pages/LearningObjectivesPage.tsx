// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber, trackLabels } from '../lib/labels'
import type { AgeTrack, LearningObjectiveRecord, SkillRecord } from '../types/api'

const ALL_TRACKS: AgeTrack[]=['preschool','kids','junior']
const TRACK_BOUNDS: Record<AgeTrack,[number,number]>={ preschool:[3,5], kids:[6,8], junior:[9,12] }
function tracksForRange(a:number,b:number):AgeTrack[]{ return ALL_TRACKS.filter(t=>{ const [l,h]=TRACK_BOUNDS[t]; return a<=h && b>=l }) }

const copy={
  ar:{
    eyebrow:'الإطار التعليمي', title:'الأهداف القابلة للقياس', intro:'كل هدف يمثل ناتجًا تعليميًا قابلاً للقياس — مربوط بمهارة، مسار عمري، ومحتوى/تقييم يولّد دليل إتقان.',
    add:'هدف جديد', refresh:'تحديث', list:'الأهداف', total:'الإجمالي',
    search:'رمز أو عنوان...', allTracks:'كل المسارات', allSkills:'كل المهارات',
    code:'الرمز', objective:'الهدف', skill:'المهارة', ages:'المدى', tracks:'المسارات', linked:'المحتوى', questions:'الأسئلة', mastery:'الإتقان', health:'الحالة', updated:'تحديث',
    withoutSkill:'بدون مهارة', withoutTrack:'بدون مسار', withoutContent:'بدون محتوى', withoutAssessment:'بدون تقييم', withoutEvidence:'بدون دليل', missingCriterion:'بدون معيار قياس',
    usedInGames:'لها ألعاب',
    edit:'تعديل', remove:'أرشفة/حذف', rederive:'إعادة اشتقاق المسارات',
    create:'إنشاء هدف', editTitle:'تعديل الهدف', codeField:'الرمز *', titleField:'العنوان *', skillField:'المهارة', noSkill:'بلا مهارة', ageMinField:'أدنى عمر *', ageMaxField:'أقصى عمر *', tracksField:'المسارات', tracksHint:'مشتقة من المدى — يمكن تضييقها', descriptionField:'الوصف', criteriaField:'معيار القياس', criteriaHint:'إجراء/هدف/شرط/معيار نجاح',
    cancel:'إلغاء', save:'حفظ', required:'الرمز والعنوان مطلوبان', rangeError:'المدى 3–12', tracksRequired:'اختر مسارًا',
    loading:'جارٍ التحميل...', loadError:'تعذر التحميل', saveError:'تعذر الحفظ', empty:'لا أهداف', emptyDesc:'أنشئ هدفًا ثم اربطه بمحتوى وتقييم', confirmRemove:'سيُحذف الهدف؟ سيُمنع إن كان مرتبطًا بمحتوى منشور', noTracks:'بلا مسارات', episodes:'حلقة', games:'لعبة',
  },
  en:{
    eyebrow:'Learning framework', title:'Measurable objectives', intro:'Each objective is a measurable outcome — linked to skill, age track, content and assessment that generate mastery evidence.',
    add:'New objective', refresh:'Refresh', list:'Objectives', total:'Total',
    search:'Code or title...', allTracks:'All tracks', allSkills:'All skills',
    code:'Code', objective:'Objective', skill:'Skill', ages:'Age', tracks:'Tracks', linked:'Content', questions:'Questions', mastery:'Mastery', health:'Health', updated:'Updated',
    withoutSkill:'Without skill', withoutTrack:'Without track', withoutContent:'Without content', withoutAssessment:'Without assessment', withoutEvidence:'Without evidence', missingCriterion:'Missing criterion',
    usedInGames:'With games',
    edit:'Edit', remove:'Archive/Delete', rederive:'Re-derive tracks',
    create:'Create objective', editTitle:'Edit objective', codeField:'Code *', titleField:'Title *', skillField:'Skill', noSkill:'No skill', ageMinField:'Min age *', ageMaxField:'Max age *', tracksField:'Tracks', tracksHint:'Derived from range — can narrow', descriptionField:'Description', criteriaField:'Measurable criterion', criteriaHint:'Action/Target/Condition/Success',
    cancel:'Cancel', save:'Save', required:'Code and title required', rangeError:'Range 3–12', tracksRequired:'Select track',
    loading:'Loading...', loadError:'Unable to load', saveError:'Unable to save', empty:'No objectives', emptyDesc:'Create objective then link content/assessment', confirmRemove:'Delete objective? Blocked if linked to published content', noTracks:'No tracks', episodes:'episodes', games:'games',
  }
}

export function LearningObjectivesPage(){
  const { locale }=usePreferences()
  const text=copy[locale] as any
  const [records,setRecords]=useState<LearningObjectiveRecord[]>([])
  const [skills,setSkills]=useState<SkillRecord[]>([])
  const [questions,setQuestions]=useState<any[]>([])
  const [masteryRows,setMasteryRows]=useState<any[]>([])
  const [total,setTotal]=useState(0)
  const [query,setQuery]=useState('')
  const [track,setTrack]=useState('')
  const [skillId,setSkillId]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [modalOpen,setModalOpen]=useState(false)
  const [editingId,setEditingId]=useState<string|null>(null)
  const [form,setForm]=useState<any>({ code:'', title_ar:'', skill_id:'', age_min:'3', age_max:'5', description_ar:'', measurable_criteria:'', track_ids: tracksForRange(3,5) })
  const [formError,setFormError]=useState('')
  const [saving,setSaving]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const [r, s, q, m]=await Promise.allSettled([
        api.learningObjectives({ q:query, track, skill_id:skillId, limit:100 } as any),
        api.skills({ limit:100 } as any),
        api.questions({ limit:100 } as any),
        api.masteryByObjective({ limit:100 } as any),
      ])
      if(r.status==='fulfilled'){ setRecords((r.value as any).data); setTotal((r.value as any).meta?.total ?? (r.value as any).data.length) }
      if(s.status==='fulfilled') setSkills((s.value as any).data)
      if(q.status==='fulfilled') setQuestions((q.value as any).data)
      if(m.status==='fulfilled') setMasteryRows((m.value as any).data)
    }catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[query,track,skillId,text.loadError])

  useEffect(()=>{ const t=setTimeout(()=>void load(),220); return ()=> clearTimeout(t)},[load])

  const metrics=useMemo(()=>{
    const totalM=records.length
    const withoutSkill=records.filter(r=> !r.skill_id).length
    const withoutTrack=records.filter(r=> !r.track_ids?.length).length
    const withoutContent=records.filter(r=> Number(r.episodes_count??0)+Number(r.games_count??0)===0).length
    const withoutAssessment=records.filter(r=> !questions.some(q=> q.learning_objective_id===r.id)).length
    const withoutEvidence=records.filter(r=>{
      const row=masteryRows.find((x:any)=> x.id===r.id)
      return !row || Number(row.attempts??0)===0
    }).length
    const missingCriterion=records.filter(r=> !r.measurable_criteria?.trim()).length
    const withGames=records.filter(r=> Number(r.games_count??0)>0).length
    return { totalM, withoutSkill, withoutTrack, withoutContent, withoutAssessment, withoutEvidence, missingCriterion, withGames }
  },[records, questions, masteryRows])

  const rangeValid=(()=>{
    const a=Number(form.age_min), b=Number(form.age_max)
    return Number.isInteger(a)&&Number.isInteger(b)&&a>=3&&b<=12&&b>=a
  })()
  const allowedTracks=rangeValid? tracksForRange(Number(form.age_min), Number(form.age_max)):[]

  function openCreate(){ setEditingId(null); setForm({ code:'', title_ar:'', skill_id:'', age_min:'3', age_max:'5', description_ar:'', measurable_criteria:'', track_ids: tracksForRange(3,5)}); setFormError(''); setModalOpen(true)}
  function openEdit(item:any){
    setEditingId(item.id)
    setForm({ code:item.code, title_ar:item.title_ar, skill_id:item.skill_id??'', age_min:String(item.age_min), age_max:String(item.age_max), description_ar:item.description_ar??'', measurable_criteria:item.measurable_criteria??'', track_ids: item.track_ids?.length? item.track_ids: tracksForRange(item.age_min, item.age_max)})
    setFormError(''); setModalOpen(true)
  }
  async function submit(e:any){
    e.preventDefault()
    if(!form.code.trim()||!form.title_ar.trim()){ setFormError(text.required); return }
    if(!rangeValid){ setFormError(text.rangeError); return }
    if(!form.track_ids.length){ setFormError(text.tracksRequired); return }
    setSaving(true); setFormError('')
    const payload={ code:form.code.trim(), title_ar:form.title_ar.trim(), skill_id: form.skill_id||null, age_min: Number(form.age_min), age_max: Number(form.age_max), description_ar: form.description_ar.trim()||null, measurable_criteria: form.measurable_criteria.trim()||null, track_ids: form.track_ids }
    try{
      if(editingId) await api.updateLearningObjective(editingId, payload as any)
      else await api.createLearningObjective(payload as any)
      setModalOpen(false); await load()
    }catch(err){ setFormError(err instanceof Error? err.message: text.saveError)} finally{ setSaving(false)}
  }
  async function remove(item:any){
    if(!window.confirm(text.confirmRemove)) return
    try{ await api.deleteLearningObjective(item.id); await load()}catch(err){ setError(err instanceof Error? err.message: text.saveError)}
  }
  async function rederive(item:any){
    try{ await api.rederiveObjectiveTracks(item.id); await load()}catch(err){ setError(err instanceof Error? err.message: text.saveError)}
  }

  if(loading && !records.length) return <LoadingState label={text.loading} />
  if(error && !records.length) return <ErrorState message={error} onRetry={()=> void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.intro}</p></div>
        <div className="page-intro__actions"><button className="button button--secondary" onClick={()=> void load()}><Icon name="refresh" size={17}/>{text.refresh}</button><button className="button button--primary" onClick={openCreate}><Icon name="plus" size={17}/>{text.add}</button></div>
      </section>

      <section className="prod-command" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <Link to={adminPath('objectives')} className="prod-metric"><strong>{metrics.totalM}</strong><span>{text.total}</span></Link>
        <Link to={adminPath('objectives?filter=withoutSkill')} className="prod-metric prod-metric--blocked"><strong>{metrics.withoutSkill}</strong><span>{text.withoutSkill}</span></Link>
        <div className="prod-metric prod-metric--blocked"><strong>{metrics.withoutTrack}</strong><span>{text.withoutTrack}</span></div>
        <div className="prod-metric prod-metric--blocked"><strong>{metrics.withoutContent}</strong><span>{text.withoutContent}</span></div>
        <div className="prod-metric prod-metric--blocked"><strong>{metrics.withoutAssessment}</strong><span>{text.withoutAssessment}</span></div>
        <div className="prod-metric prod-metric--blocked"><strong>{metrics.withoutEvidence}</strong><span>{text.withoutEvidence}</span></div>
        <div className="prod-metric prod-metric--blocked"><strong>{metrics.missingCriterion}</strong><span>{text.missingCriterion}</span></div>
        <div className="prod-metric"><strong>{metrics.withGames}</strong><span>{text.usedInGames}</span></div>
      </section>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><span className="panel__kicker">{text.list}</span><h3>{text.total} <span className="title-count">{formatNumber(total, locale as any)}</span></h3></div>
          <div className="filters-row">
            <label className="search-field"><Icon name="search" size={17}/><input value={query} onChange={e=> setQuery(e.target.value)} placeholder={text.search}/></label>
            <select value={track} onChange={e=> setTrack(e.target.value)}><option value="">{text.allTracks}</option>{ALL_TRACKS.map(i=> <option key={i} value={i}>{trackLabels[locale as any][i]}</option>)}</select>
            <select value={skillId} onChange={e=> setSkillId(e.target.value)}><option value="">{text.allSkills}</option>{skills.map(s=> <option key={s.id} value={s.id}>{s.name_ar}</option>)}</select>
          </div>
        </header>

        {records.length? (
          <div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr>
            <th>{text.objective}</th><th>{text.skill}</th><th>{text.ages}</th><th>{text.tracks}</th><th>معيار</th><th>{text.linked}</th><th>{text.questions}</th><th>{text.mastery}</th><th>{text.health}</th><th></th>
          </tr></thead><tbody>
            {records.map(item=>{
              const qCount = questions.filter(q=> q.learning_objective_id===item.id).length
              const mRow = masteryRows.find((m:any)=> m.id===item.id)
              const hasCriterion = !!item.measurable_criteria?.trim()
              const hasContent = Number(item.episodes_count??0)+Number(item.games_count??0)>0
              const hasAssessment = qCount>0
              const hasEvidence = Number(mRow?.attempts??0)>0
              const health = !hasCriterion? 'بدون معيار': !hasContent? 'بدون محتوى': !hasAssessment? 'بدون تقييم': !hasEvidence? 'بدون دليل':'جيد'
              return <tr key={item.id}>
                <td><Link to={adminPath(`objectives/${item.id}`)} style={{ textDecoration:'none' }}><strong>{item.title_ar}</strong><br/><small className="table-secondary" dir="ltr">{item.code}</small>{item.measurable_criteria && <small className="table-secondary" style={{ display:'block', maxWidth:280, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.measurable_criteria}</small>}</Link></td>
                <td>{item.skill_name? <span className="track-badge">{item.skill_name}</span>: <span className="table-secondary">—</span>}</td>
                <td dir="ltr">{item.age_min}–{item.age_max}</td>
                <td>{item.track_ids?.length? <div className="badge-row">{item.track_ids.map((v:any)=> <span key={v} className={`track-badge track-badge--${v}`}>{trackLabels[locale as any][v]}</span>)}</div>: <button className="button button--ghost button--small" onClick={()=> void rederive(item)}>{text.rederive}</button>}</td>
                <td>{hasCriterion? <span className="prod-chip prod-chip--complete">✓</span>: <span className="prod-chip prod-chip--blocked">—</span>}</td>
                <td><span className="table-secondary">{formatNumber(Number(item.episodes_count??0), locale as any)} {text.episodes} · {formatNumber(Number(item.games_count??0), locale as any)} {text.games}</span></td>
                <td>{qCount? <Link to={adminPath(`quiz?objective_id=${item.id}`)} className="prod-chip prod-chip--complete">{qCount}</Link> : <span className="table-secondary">0</span>}</td>
                <td>{hasEvidence? <Link to={adminPath(`mastery`)} className="table-secondary">{mRow.attempts} محاولات</Link>: <span className="table-secondary">—</span>}</td>
                <td><span className={`prod-chip ${health==='جيد'?'prod-chip--complete':'prod-chip--blocked'}`}>{health}</span></td>
                <td><div className="table-actions"><Link className="button button--ghost button--small" to={adminPath(`objectives/${item.id}`)}>فتح</Link><button className="icon-button icon-button--small" title={text.edit} onClick={()=> openEdit(item)}><Icon name="edit" size={15}/></button><button className="icon-button icon-button--small icon-button--danger" title={text.remove} onClick={()=> void remove(item)}><Icon name="archive" size={15}/></button></div></td>
              </tr>
            })}
          </tbody></table></div>
        ): <EmptyState title={text.empty} description={text.emptyDesc} />}
      </section>

      <Modal open={modalOpen} onClose={()=> !saving && setModalOpen(false)} title={editingId? text.editTitle: text.create}>
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid">
            <label className="field"><span>{text.codeField}</span><input dir="ltr" value={form.code} onChange={e=> setForm({...form, code:e.target.value})} /><small>مثل LO-TRACE-01</small></label>
            <label className="field"><span>{text.titleField}</span><input value={form.title_ar} onChange={e=> setForm({...form, title_ar:e.target.value})} /></label>
          </div>
          <div className="form-grid form-grid--three">
            <label className="field"><span>{text.skillField}</span><select value={form.skill_id} onChange={e=> setForm({...form, skill_id:e.target.value})}><option value="">{text.noSkill}</option>{skills.map(s=> <option key={s.id} value={s.id}>{s.name_ar}</option>)}</select></label>
            <label className="field"><span>{text.ageMinField}</span><input type="number" min={3} max={12} value={form.age_min} onChange={e=> setForm({...form, age_min:e.target.value, track_ids:(()=>{ const a=Number(e.target.value), b=Number(form.age_max); if(Number.isInteger(a)&&Number.isInteger(b)&&a>=3&&b<=12&&b>=a) return tracksForRange(a,b); return form.track_ids })()})}/></label>
            <label className="field"><span>{text.ageMaxField}</span><input type="number" min={3} max={12} value={form.age_max} onChange={e=> setForm({...form, age_max:e.target.value, track_ids:(()=>{ const a=Number(form.age_min), b=Number(e.target.value); if(Number.isInteger(a)&&Number.isInteger(b)&&a>=3&&b<=12&&b>=a) return tracksForRange(a,b); return form.track_ids })()})}/></label>
          </div>
          <fieldset className="field"><span>{text.tracksField}</span><div className="checkbox-row">{ALL_TRACKS.map(v=>{
            const allowed=allowedTracks.includes(v)
            return <label key={v} className={`checkbox-chip ${allowed?'':'checkbox-chip--disabled'}`}><input type="checkbox" checked={form.track_ids.includes(v)} disabled={!allowed} onChange={()=> setForm((c:any)=> ({...c, track_ids: c.track_ids.includes(v)? c.track_ids.filter((x:any)=>x!==v): [...c.track_ids, v]}))}/><span>{trackLabels[locale as any][v]}</span></label>
          })}</div><small>{text.tracksHint}</small></fieldset>
          <label className="field"><span>{text.descriptionField}</span><textarea rows={2} value={form.description_ar} onChange={e=> setForm({...form, description_ar:e.target.value})} /></label>
          <label className="field"><span>{text.criteriaField}</span><textarea rows={2} value={form.measurable_criteria} onChange={e=> setForm({...form, measurable_criteria:e.target.value})} /><small>{text.criteriaHint}</small></label>
          <div className="form-actions"><button className="button button--ghost" type="button" onClick={()=> setModalOpen(false)}>{text.cancel}</button><button className="button button--primary" type="submit" disabled={saving}>{text.save}</button></div>
        </form>
      </Modal>
    </div>
  )
}
