import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu, useColumnPreferences, ColumnManager } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { QuestionRecord, LearningObjectiveRecord } from '../types/api'

const TYPES = ['MULTIPLE_CHOICE','TRUE_FALSE','ORDERING','MATCHING','IMAGE_CHOICE']
const STATUSES = ['draft','in_review','approved','archived']

const copy={
  ar:{
    eyebrow:'التعليم', title:'بنك الأسئلة', lede:'أسئلة مقاسة مرتبطة بهدف تعليمي — مصدر دليل الإتقان.',
    add:'سؤال جديد', import:'استيراد', export:'تصدير', refresh:'تحديث',
    total:'الإجمالي', draft:'مسودة', inReview:'قيد المراجعة', approved:'معتمد', missingObjective:'بدون هدف', missingTranslation:'بدون ترجمة', missingMedia:'بدون وسائط', used:'مستخدم', unused:'غير مستخدم',
    search:'بحث السؤال...', type:'النوع', objective:'الهدف', skill:'المهارة', age:'العمر', difficulty:'الصعوبة', languages:'اللغات', media:'الوسائط', usage:'الاستخدام', review:'المراجعة', status:'الحالة', updated:'تحديث',
    question:'السؤال', actions:'', noQuestions:'لا أسئلة مطابقة', noQuestionsHint:'أنشئ سؤالًا مرتبطًا بهدف تعليمي أو استورد من قالب',
    preview:'معاينة', edit:'تعديل', createTitle:'إنشاء سؤال', typeField:'النوع *', promptField:'نص السؤال *', objectiveField:'الهدف التعليمي *', skillField:'المهارة (مستنتجة)', ageMin:'أدنى عمر', ageMax:'أقصى عمر', difficultyField:'الصعوبة', correctField:'الإجابة الصحيحة', distractorsField:'المشتتات', mediaField:'الوسائط', explanationField:'الشرح/التغذية',
    save:'حفظ', cancel:'إلغاء', required:'الحقول المطلوبة ناقصة', loadError:'تعذر تحميل الأسئلة', saveError:'تعذر حفظ السؤال',
  },
  en:{
    eyebrow:'Learning', title:'Question bank', lede:'Measurable questions linked to objectives — evidence for mastery.',
    add:'New question', import:'Import', export:'Export', refresh:'Refresh',
    total:'Total', draft:'Draft', inReview:'In review', approved:'Approved', missingObjective:'Missing objective', missingTranslation:'Missing translation', missingMedia:'Missing media', used:'Used', unused:'Unused',
    search:'Search question...', type:'Type', objective:'Objective', skill:'Skill', age:'Age', difficulty:'Difficulty', languages:'Languages', media:'Media', usage:'Usage', review:'Review', status:'Status', updated:'Updated',
    question:'Question', actions:'', noQuestions:'No matching questions', noQuestionsHint:'Create a question linked to an objective or import from template',
    preview:'Preview', edit:'Edit', createTitle:'Create question', typeField:'Type *', promptField:'Prompt *', objectiveField:'Learning objective *', skillField:'Skill (derived)', ageMin:'Min age', ageMax:'Max age', difficultyField:'Difficulty', correctField:'Correct answer', distractorsField:'Distractors', mediaField:'Media', explanationField:'Explanation',
    save:'Save', cancel:'Cancel', required:'Required fields missing', loadError:'Unable to load questions', saveError:'Unable to save question',
  }
}

const COLUMNS: ColumnDefinition[]=[
  { key:'question', label:'question', locked:true },
  { key:'type', label:'type' },
  { key:'objective', label:'objective' },
  { key:'age', label:'age' },
  { key:'difficulty', label:'difficulty' },
  { key:'languages', label:'languages' },
  { key:'media', label:'media' },
  { key:'usage', label:'usage' },
  { key:'review', label:'review' },
  { key:'status', label:'status' },
]

export function QuizBuilderPage(){
  const { locale }=usePreferences()
  const text=copy[locale] as any
  const navigate=useNavigate()
  const list=useUrlListState({ type:'', status:'', objective_id:'', difficulty:'' } as any, { limit:25 })
  const { query, filters, offset, limit }=list
  const [records,setRecords]=useState<QuestionRecord[]>([])
  const [total,setTotal]=useState(0)
  const [summary,setSummary]=useState<any>(null)
  const [objectives,setObjectives]=useState<LearningObjectiveRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [modalOpen,setModalOpen]=useState(false)
  const [form,setForm]=useState<any>({ code:`Q-${Date.now().toString().slice(-6)}`, type:'MULTIPLE_CHOICE', prompt_ar:'', learning_objective_id:'', age_min:6, age_max:8, difficulty:'medium', correct_answer:{ value:'' }, distractors:[] })
  const [formError,setFormError]=useState('')
  const [saving,setSaving]=useState(false)
  const columns=useColumnPreferences('quiz', COLUMNS)

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const [qRes, objRes]=await Promise.all([
        api.questions({ q: query, ...filters, limit, offset } as any),
        api.learningObjectives({ limit:100 } as any),
      ])
      setRecords((qRes as any).data); setTotal((qRes as any).meta?.total ?? (qRes as any).data.length); setSummary((qRes as any).meta?.summary)
      setObjectives((objRes as any).data)
    }catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[query, filters, limit, offset, text.loadError])

  useEffect(()=>{ const t=setTimeout(()=> void load(),220); return ()=> clearTimeout(t)},[load])

  // Recompute summary from current page if missing
  const metrics=useMemo(()=>{
    if(summary) return summary
    return { total: records.length, draft: records.filter(r=>r.status==='draft').length, in_review: records.filter(r=>r.status==='in_review').length, approved: records.filter(r=>r.status==='approved').length, missing_objective: records.filter(r=>!r.learning_objective_id).length }
  },[summary, records])

  async function submit(e:any){
    e.preventDefault()
    if(!form.code || !form.prompt_ar || !form.learning_objective_id){ setFormError(text.required); return }
    setSaving(true); setFormError('')
    try{
      await api.createQuestion({
        code: form.code, type: form.type, prompt_ar: form.prompt_ar, learning_objective_id: form.learning_objective_id,
        age_min: Number(form.age_min), age_max: Number(form.age_max), difficulty: form.difficulty,
        correct_answer: form.correct_answer, distractors: Array.isArray(form.distractors)? form.distractors: form.distractors? [form.distractors]: []
      } as any)
      setModalOpen(false); await load()
    }catch(err){ setFormError(err instanceof Error? err.message: text.saveError)} finally{ setSaving(false)}
  }

  const filterFields: FilterField[]=[
    { key:'type', label:text.type, type:'select', options:[{value:'',label:'All'}, ...TYPES.map(v=>({value:v,label:v}))] },
    { key:'status', label:text.status, type:'select', options:[{value:'',label:'All'}, ...STATUSES.map(v=>({value:v,label:v}))] },
    { key:'difficulty', label:text.difficulty, type:'select', options:[{value:'',label:'All'}, {value:'easy',label:'easy'}, {value:'medium',label:'medium'}, {value:'hard',label:'hard'}] },
    { key:'objective_id', label:text.objective, type:'select', options:[{value:'',label:'All'}, ...objectives.slice(0,20).map(o=>({value:o.id, label:o.code}))] },
  ]

  if(loading && !records.length) return <LoadingState label={text.loading ?? 'Loading...'} />
  if(error && !records.length) return <ErrorState message={error} onRetry={()=> void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div>
        <div className="page-intro__actions"><button className="button button--secondary" onClick={()=> void load()}><Icon name="refresh" size={17}/>{text.refresh}</button><button className="button button--primary" onClick={()=> setModalOpen(true)}><Icon name="plus" size={17}/>{text.add}</button></div>
      </section>

      <section className="prod-command" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div className="prod-metric"><strong>{metrics.total ?? total}</strong><span>{text.total}</span></div>
        <div className="prod-metric"><strong>{metrics.draft ?? 0}</strong><span>{text.draft}</span></div>
        <div className="prod-metric"><strong>{metrics.in_review ?? 0}</strong><span>{text.inReview}</span></div>
        <div className="prod-metric prod-metric--complete"><strong>{metrics.approved ?? 0}</strong><span>{text.approved}</span></div>
        <div className="prod-metric prod-metric--blocked"><strong>{metrics.missing_objective ?? 0}</strong><span>{text.missingObjective}</span></div>
        <div className="prod-metric"><strong>{metrics.missing_media ?? 0}</strong><span>{text.missingMedia}</span></div>
      </section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><h3>{text.title} <span className="title-count">{formatNumber(total, locale as any)}</span></h3></div>
          <ListToolbar
            searchValue={query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={filterFields}
            values={filters as any}
            defaults={{ type:'', status:'', objective_id:'', difficulty:'' } as any}
            onApply={next=> list.setFilters(next as any)}
            onClear={list.clearFilters}
            onRemove={k=> list.setFilter(k as any,'')}
            trailing={<><SavedViewsMenu storageKey="quiz" currentSearch={list.search} onApply={s=> navigate(`${adminPath('quiz')}${s}`)} /><ColumnManager columns={COLUMNS.map(c=> ({...c, label: (text as any)[c.label] ?? c.label }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} /><button className="button button--ghost button--small" onClick={async()=>{ const res=await api.exportQuestions({ q:query } as any); const blob=new Blob([JSON.stringify(res.data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='questions-export.json'; a.click(); URL.revokeObjectURL(url)}}>{text.export}</button></>}
          />
        </header>

        {records.length? (
          <>
            <div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr>
              <th>{text.question}</th>{columns.isVisible('type')&&<th>{text.type}</th>}{columns.isVisible('objective')&&<th>{text.objective}</th>}{columns.isVisible('age')&&<th>{text.age}</th>}{columns.isVisible('difficulty')&&<th>{text.difficulty}</th>}{columns.isVisible('languages')&&<th>{text.languages}</th>}{columns.isVisible('media')&&<th>{text.media}</th>}{columns.isVisible('usage')&&<th>{text.usage}</th>}{columns.isVisible('review')&&<th>{text.review}</th>}{columns.isVisible('status')&&<th>{text.status}</th>}<th></th>
            </tr></thead><tbody>
              {records.map(r=>(
                <tr key={r.id}>
                  <td><Link to={adminPath(`quiz/${r.id}`)} style={{ textDecoration:'none' }}><strong style={{ display:'block', maxWidth:360, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.prompt_ar}</strong><small dir="ltr" className="table-secondary">{r.code}</small></Link></td>
                  {columns.isVisible('type')&&<td><span className="track-badge">{r.type}</span></td>}
                  {columns.isVisible('objective')&&<td>{r.objective_code? <Link to={adminPath(`objectives/${r.learning_objective_id}`)} className="prod-chip">{r.objective_code}</Link>: <span className="prod-chip prod-chip--blocked">{text.missingObjective}</span>}</td>}
                  {columns.isVisible('age')&&<td dir="ltr">{r.age_min}–{r.age_max}</td>}
                  {columns.isVisible('difficulty')&&<td>{r.difficulty}</td>}
                  {columns.isVisible('languages')&&<td>{r.languages_count ?? 1}</td>}
                  {columns.isVisible('media')&&<td>{r.media_asset_id? '✓':'—'}</td>}
                  {columns.isVisible('usage')&&<td>{r.usage_count??0}</td>}
                  {columns.isVisible('review')&&<td><span className={`status-badge ${r.status==='approved'?'status-badge--published': r.status==='in_review'?'status-badge--review':''}`}>{r.status}</span></td>}
                  {columns.isVisible('status')&&<td>{r.status}</td>}
                  <td><div className="table-actions"><Link className="button button--ghost button--small" to={adminPath(`quiz/${r.id}`)}>فتح</Link></div></td>
                </tr>
              ))}
            </tbody></table></div>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale as any} />
          </>
        ): <EmptyState title={text.noQuestions} description={text.noQuestionsHint} action={<button className="button button--primary" onClick={()=> setModalOpen(true)}>{text.add}</button>} />}
      </section>

      <Modal open={modalOpen} onClose={()=> !saving && setModalOpen(false)} title={text.createTitle}>
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid">
            <label className="field"><span>الرمز *</span><input dir="ltr" value={form.code} onChange={e=> setForm({...form, code:e.target.value})} /></label>
            <label className="field"><span>{text.typeField}</span><select value={form.type} onChange={e=> setForm({...form, type:e.target.value})}><option value="MULTIPLE_CHOICE">اختيار متعدد</option><option value="TRUE_FALSE">صح/خطأ</option><option value="ORDERING">ترتيب</option><option value="MATCHING">مطابقة</option><option value="IMAGE_CHOICE">اختيار صورة</option></select></label>
          </div>
          <label className="field"><span>{text.promptField}</span><textarea rows={2} value={form.prompt_ar} onChange={e=> setForm({...form, prompt_ar:e.target.value})} /></label>
          <label className="field"><span>{text.objectiveField}</span><select value={form.learning_objective_id} onChange={e=> setForm({...form, learning_objective_id:e.target.value})}><option value="">— اختر هدفًا —</option>{objectives.map(o=> <option key={o.id} value={o.id}>{o.code} — {o.title_ar}</option>)}</select></label>
          <div className="form-grid form-grid--three">
            <label className="field"><span>{text.ageMin}</span><input type="number" min={3} max={12} value={form.age_min} onChange={e=> setForm({...form, age_min:e.target.value})} /></label>
            <label className="field"><span>{text.ageMax}</span><input type="number" min={3} max={12} value={form.age_max} onChange={e=> setForm({...form, age_max:e.target.value})} /></label>
            <label className="field"><span>{text.difficultyField}</span><select value={form.difficulty} onChange={e=> setForm({...form, difficulty:e.target.value})}><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select></label>
          </div>
          {form.type==='MULTIPLE_CHOICE' && (
            <>
              <label className="field"><span>{text.correctField} *</span><input value={form.correct_answer?.value??''} onChange={e=> setForm({...form, correct_answer:{ value: e.target.value }})} /></label>
              <label className="field"><span>{text.distractorsField}</span><input placeholder="مشتتات مفصولة بفاصلة" value={Array.isArray(form.distractors)? form.distractors.join(', '): ''} onChange={e=> setForm({...form, distractors: e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)})} /></label>
            </>
          )}
          {form.type==='TRUE_FALSE' && (
            <label className="field"><span>{text.correctField} *</span><select value={form.correct_answer?.value ?? 'true'} onChange={e=> setForm({...form, correct_answer:{ value: e.target.value }})}><option value="true">صح</option><option value="false">خطأ</option></select></label>
          )}
          {form.type==='ORDERING' && (
            <label className="field"><span>عناصر الترتيب (افصل بفاصلة) *</span><input value={Array.isArray(form.correct_answer?.items)? form.correct_answer.items.join(', '): ''} onChange={e=> setForm({...form, correct_answer:{ items: e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean) }})} /></label>
          )}
          {form.type==='MATCHING' && (
            <label className="field"><span>أزواج المطابقة (مثال: أ-1، ب-2)</span><input value={form.correct_answer?.pairs??''} onChange={e=> setForm({...form, correct_answer:{ pairs: e.target.value }})} /></label>
          )}
          {form.type==='IMAGE_CHOICE' && (
            <label className="field"><span>{text.mediaField}</span><input placeholder="معرّف الصورة من مكتبة الوسائط" value={form.media_asset_id??''} onChange={e=> setForm({...form, media_asset_id: e.target.value})} /></label>
          )}
          <div className="form-actions"><button className="button button--ghost" type="button" onClick={()=> setModalOpen(false)}>{text.cancel}</button><button className="button button--primary" type="submit" disabled={saving}>{text.save}</button></div>
        </form>
      </Modal>
    </div>
  )
}
