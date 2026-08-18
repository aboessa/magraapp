import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'

const copy={
  ar:{ back:'العودة للبنك', loading:'جارٍ تحميل السؤال…', loadError:'تعذر تحميل السؤال', tabs:{ overview:'نظرة عامة', authoring:'التأليف', answers:'الإجابات', media:'الوسائط', learning:'التعلم', localization:'الترجمة', usage:'الاستخدام', reviews:'المراجعات', history:'السجل' },
    preview:'معاينة آمنة', prompt:'السؤال', correct:'الإجابة الصحيحة', distractors:'المشتتات', explanation:'الشرح', status:'الحالة', version:'النسخة', objective:'الهدف', skill:'المهارة', edit:'تعديل', submitReview:'إرسال للمراجعة', approve:'اعتماد', reject:'رفض', needsChanges:'يحتاج تعديل',
    noMedia:'لا وسائط', usageTitle:'الاستخدام', reviewsTitle:'المراجعات', historyTitle:'السجل', save:'حفظ', cancel:'إلغاء', mediaHint:'اختر من مكتبة الوسائط — لا مفاتيح R2 خام',
  },
  en:{ back:'Back to bank', loading:'Loading question…', loadError:'Unable to load question', tabs:{ overview:'Overview', authoring:'Authoring', answers:'Answers', media:'Media', learning:'Learning', localization:'Localization', usage:'Usage', reviews:'Reviews', history:'History' },
    preview:'Safe preview', prompt:'Prompt', correct:'Correct answer', distractors:'Distractors', explanation:'Explanation', status:'Status', version:'Version', objective:'Objective', skill:'Skill', edit:'Edit', submitReview:'Submit for review', approve:'Approve', reject:'Reject', needsChanges:'Needs changes',
    noMedia:'No media', usageTitle:'Usage', reviewsTitle:'Reviews', historyTitle:'History', save:'Save', cancel:'Cancel', mediaHint:'Pick from Media Library — no raw R2 keys',
  }
}

export function QuestionWorkspacePage(){
  const { id='' }=useParams()
  const { locale }=usePreferences()
  const text=copy[locale==='en'?'en':'ar']
  const [data,setData]=useState<any>(null)
  const [tab,setTab]=useState<keyof typeof text.tabs>('overview')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [editOpen,setEditOpen]=useState(false)
  const [form,setForm]=useState<any>({})
  const [saving,setSaving]=useState(false)
  const [formError,setFormError]=useState('')

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{ const res=await api.question(id); setData(res.data); setForm({ prompt_ar: res.data.prompt_ar, correct_answer: res.data.correct_answer, distractors: res.data.distractors, explanation_ar: res.data.explanation_ar, media_asset_id: res.data.media_asset_id }) }
    catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[id, text.loadError])

  useEffect(()=>{ void load()},[load])

  async function save(){
    setSaving(true); setFormError('')
    try{ await api.updateQuestion(id, { prompt_ar: form.prompt_ar, correct_answer: form.correct_answer, distractors: form.distractors, explanation_ar: form.explanation_ar, media_asset_id: form.media_asset_id }); setEditOpen(false); await load() }
    catch(e){ setFormError(e instanceof Error? e.message:'خطأ')} finally{ setSaving(false)}
  }
  async function review(status:string){
    await api.reviewQuestion(id, { status, reviewer_role:'edu' }); await load()
  }

  if(loading) return <LoadingState label={text.loading} />
  if(error) return <ErrorState message={error} onRetry={()=> void load()} />
  if(!data) return <EmptyState title={text.loadError} description={id} />

  return (
    <div className="page-stack">
      <div className="panel">
        <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
          <div><div className="eyebrow" dir="ltr">{data.code} · {data.type}</div><h2 style={{ margin:'4px 0' }}>{data.prompt_ar.slice(0,120)}</h2>
            <div style={{ display:'flex', gap:8, fontSize:13, color:'var(--muted)' }}><span>{text.status}: {data.status}</span><span>{text.version}: {data.version}</span><span>{text.objective}: <Link to={adminPath(`objectives/${data.learning_objective_id}`)}>{data.objective_code ?? '—'}</Link></span></div></div>
          <div style={{ display:'flex', gap:8 }}><Link className="button button--ghost" to={adminPath('quiz')}>{text.back}</Link><button className="button button--primary" onClick={()=> setEditOpen(true)}><Icon name="edit" size={14}/>{text.edit}</button></div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:12, overflowX:'auto' }}>{(Object.keys(text.tabs) as Array<keyof typeof text.tabs>).map(k=> <button key={k} className={`button ${tab===k?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab(k)}>{text.tabs[k]}</button>)}</div>
      </div>

      {tab==='overview' && (
        <div className="panel" style={{ padding:16 }}>
          <h3>{text.preview}</h3>
          <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:16, background:'#fff' }}>
            <p style={{ fontSize:16, fontWeight:600 }}>{data.prompt_ar}</p>
            {data.media_asset_id && <p className="panel__note">وسائط: {data.media_asset_id}</p>}
            <div style={{ marginTop:12 }}>
              {data.type==='MULTIPLE_CHOICE' && (
                <ul>{[data.correct_answer?.value, ...(Array.isArray(data.distractors)? data.distractors: [])].map((opt:string,i:number)=> <li key={i} style={{ padding:'8px 12px', background: i===0?'#e6ffed':'#f6f8fa', borderRadius:6, marginBottom:6 }}>{opt} {i===0&& '✓'}</li>)}</ul>
              )}
              {data.type==='TRUE_FALSE' && <p>الإجابة: {data.correct_answer?.value}</p>}
              {data.type==='ORDERING' && <p>الترتيب الصحيح: {Array.isArray(data.correct_answer?.items)? data.correct_answer.items.join(' → '): '—'}</p>}
              {data.type==='MATCHING' && <p>أزواج: {data.correct_answer?.pairs ?? '—'}</p>}
              {data.type==='IMAGE_CHOICE' && <p>اختيار صورة — {data.media_asset_id ?? text.noMedia}</p>}
            </div>
            {data.explanation_ar && <p className="panel__note" style={{ marginTop:12 }}>{data.explanation_ar}</p>}
          </div>
          <div style={{ marginTop:12, display:'flex', gap:8 }}>
            <button className="button button--ghost" onClick={()=> review('pending')}>{text.submitReview}</button>
            <button className="button button--primary" onClick={()=> review('approved')}>{text.approve}</button>
            <button className="button button--ghost" onClick={()=> review('rejected')}>{text.reject}</button>
          </div>
        </div>
      )}

      {tab==='authoring' && (
        <div className="panel" style={{ padding:16 }}>
          <h4>تأليف حسب النوع</h4>
          <p><strong>{data.type}</strong> — الحقول المعروضة تطابق نوع السؤال فقط، لا نموذج JSON خام</p>
          <dl><div><dt>{text.prompt}</dt><dd>{data.prompt_ar}</dd></div><div><dt>{text.correct}</dt><dd>{JSON.stringify(data.correct_answer)}</dd></div><div><dt>{text.distractors}</dt><dd>{JSON.stringify(data.distractors)}</dd></div></dl>
          <button className="button button--primary" onClick={()=> setEditOpen(true)}>{text.edit}</button>
        </div>
      )}

      {tab==='answers' && (
        <div className="panel" style={{ padding:16 }}>
          <h4>{text.correct} / {text.distractors}</h4>
          <p>{JSON.stringify(data.correct_answer)}</p><p>{JSON.stringify(data.distractors)}</p>
          <p className="panel__note">التحقق: لا يُسمح بإجابة صحيحة فارغة أو مطابقة لمشتت</p>
        </div>
      )}

      {tab==='media' && (
        <div className="panel" style={{ padding:16 }}>
          <h4>{text.noMedia}</h4>
          {data.media_asset_id? <p>{data.media_asset_id} <Link to={adminPath(`media/${data.media_asset_id}`)}>فتح الوسائط</Link></p>: <p>{text.noMedia}</p>}
          <p className="panel__note">{text.mediaHint}</p>
        </div>
      )}

      {tab==='learning' && (
        <div className="panel" style={{ padding:16 }}>
          <h4>{text.objective} → المهارة</h4>
          <p>الهدف: <Link to={adminPath(`objectives/${data.learning_objective_id}`)}>{data.objective_code}</Link></p>
          <p>المهارة مستنتجة عبر الهدف — لا ربط مباشر مهارة↔إتقان بدون هدف</p>
          <p className="panel__note">العمر: {data.age_min}–{data.age_max} · الصعوبة: {data.difficulty}</p>
        </div>
      )}

      {tab==='localization' && (
        <div className="panel" style={{ padding:16 }}>
          <h4>الترجمة</h4>
          <p>السؤال يترجم عبر مركز الترجمة: prompt / answers / distractors / feedback مع الحفاظ على خريطة الإجابة الصحيحة</p>
          <Link to={adminPath('translation')} className="button button--ghost">فتح مركز الترجمة</Link>
        </div>
      )}

      {tab==='usage' && (
        <div className="panel" style={{ padding:16 }}>
          <h4>{text.usageTitle}</h4>
          {data.usage?.length? <ul>{data.usage.map((u:any)=> <li key={u.entity_type+u.entity_id}>{u.entity_type}: {u.entity_id}</li>)}</ul>: <p>غير مستخدم بعد</p>}
        </div>
      )}

      {tab==='reviews' && (
        <div className="panel" style={{ padding:16 }}>
          <h4>{text.reviewsTitle}</h4>
          {data.reviews?.length? <table className="data-table"><thead><tr><th>الدور</th><th>الحالة</th><th>التعليق</th></tr></thead><tbody>{data.reviews.map((r:any)=> <tr key={r.id}><td>{r.reviewer_role}</td><td>{r.status}</td><td>{r.comments ?? '—'}</td></tr>)}</tbody></table>: <p>لا مراجعات بعد</p>}
          <div style={{ marginTop:12, display:'flex', gap:8 }}><button className="button button--ghost" onClick={()=> review('needs_changes')}>{text.needsChanges}</button></div>
        </div>
      )}

      {tab==='history' && (
        <div className="panel" style={{ padding:16 }}>
          <h4>{text.historyTitle}</h4>
          {data.history?.length? <ul>{data.history.map((h:any)=> <li key={h.id}>{h.action} — {h.created_at}</li>)}</ul>: <p>السجل من audit_logs</p>}
          <p className="panel__note">تغيير النسخة يحفظ تفسير المحاولات التاريخية</p>
        </div>
      )}

      <Modal open={editOpen} onClose={()=> setEditOpen(false)} title={text.edit}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field"><span>نص السؤال</span><textarea rows={2} value={form.prompt_ar} onChange={e=> setForm({...form, prompt_ar:e.target.value})} /></label>
          <label className="field"><span>الإجابة الصحيحة (JSON)</span><input value={JSON.stringify(form.correct_answer)} onChange={e=>{ try{ setForm({...form, correct_answer: JSON.parse(e.target.value)}) }catch{ setForm({...form, correct_answer:{ value: e.target.value }}) }}} /></label>
          <label className="field"><span>المشتتات (JSON array)</span><input value={JSON.stringify(form.distractors)} onChange={e=>{ try{ setForm({...form, distractors: JSON.parse(e.target.value)}) }catch{ setForm({...form, distractors: e.target.value.split(',')}) }}} /></label>
          <label className="field"><span>الشرح</span><textarea rows={2} value={form.explanation_ar??''} onChange={e=> setForm({...form, explanation_ar:e.target.value})} /></label>
          <label className="field"><span>وسائط (معرّف من المكتبة)</span><input value={form.media_asset_id??''} onChange={e=> setForm({...form, media_asset_id:e.target.value})} /></label>
          <div className="form-actions"><button className="button button--ghost" onClick={()=> setEditOpen(false)}>{text.cancel}</button><button className="button button--primary" disabled={saving} onClick={save}>{text.save}</button></div>
        </div>
      </Modal>
    </div>
  )
}
