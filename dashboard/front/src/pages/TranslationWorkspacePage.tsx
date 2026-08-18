import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'

const copy={
  ar:{ back:'العودة للمركز', loading:'جارٍ التحميل…', loadError:'تعذر تحميل الوحدة', source:'المصدر (عربي — للقراءة فقط)', target:'الهدف', save:'حفظ', submitReview:'إرسال للمراجعة', approve:'اعتماد', reject:'رفض', glossary:'المسرد', memory:'ذاكرة الترجمة', comments:'تعليقات', version:'الإصدار', status:'الحالة', stale:'قديم — تغيّر المصدر', diff:'ما تغيّر', context:'السياق', preview:'معاينة', reauthor:'يتطلب إعادة تأليف — لا ترجمة حرفية', languageSpecific:'محتوى مرتبط باللغة العربية — ترجمته الحرفية تفقد المعنى' },
  en:{ back:'Back to center', loading:'Loading…', loadError:'Unable to load unit', source:'Source (AR — read-only)', target:'Target', save:'Save', submitReview:'Submit for review', approve:'Approve', reject:'Reject', glossary:'Glossary', memory:'Translation Memory', comments:'Comments', version:'Version', status:'Status', stale:'Stale — source changed', diff:'What changed', context:'Context', preview:'Preview', reauthor:'Re-author required — not literal translation', languageSpecific:'Arabic-specific content — literal translation loses meaning' }
}

export function TranslationWorkspacePage(){
  const { id='' }=useParams()
  const { locale }=usePreferences()
  const text=copy[locale==='en'?'en':'ar']
  const [data,setData]=useState<any>(null)
  const [target,setTarget]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [saving,setSaving]=useState(false)
  const [suggestions,setSuggestions]=useState<any[]>([])

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{ const res=await api.translationUnit(id); setData(res.data); setTarget(res.data.target_text ?? ''); if(res.data.source_text){ const tm=await api.translationMemory(res.data.source_text.slice(0,40), res.data.target_language).catch(()=>({data:[]})); setSuggestions((tm as any).data ?? []) } }
    catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[id, text.loadError])

  useEffect(()=>{ void load()},[load])

  async function save(status?:string){
    setSaving(true)
    try{ await api.saveTranslation(id, { target_text: target, status: status ?? 'in_translation' }); await load() }
    catch(e){ alert(e instanceof Error? e.message:'خطأ')} finally{ setSaving(false)}
  }

  if(loading) return <LoadingState label={text.loading} />
  if(error) return <ErrorState message={error} onRetry={()=> void load()} />
  if(!data) return <EmptyState title={text.loadError} description={id} />

  const isRTL = data.source_language==='ar'
  const targetRTL = data.target_language==='ar'

  return (
    <div className="page-stack">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Link className="button button--ghost" to={adminPath('translation')}><Icon name="arrow" size={14}/>{text.back}</Link>
        <span className={`status-badge ${data.status==='approved'?'status-badge--published': data.status==='stale'?'status-badge--review':''}`}>{data.status}</span>
      </div>

      {data.status==='stale' && <div className="inline-alert inline-alert--warn"><strong>{text.stale}</strong> — {text.diff}: تم تحديث النص المصدر بعد اعتماد الترجمة</div>}
      {data.is_reauthor && <div className="inline-alert inline-alert--warn">{text.reauthor}<br/><small>{text.languageSpecific}</small></div>}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 320px', gap:12, alignItems:'start' }}>
        {/* source — read-only */}
        <div className="panel" style={{ padding:12 }}>
          <h4>{text.source} <small style={{ color:'var(--muted)' }}>v{data.source_version}</small></h4>
          <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:12, minHeight:200, direction: isRTL? 'rtl':'ltr', textAlign: isRTL? 'right':'left', background:'#f6f8fa' }}>
            <p style={{ whiteSpace:'pre-wrap' }}>{data.source_text || '—'}</p>
          </div>
          {data.context && (
            <div style={{ marginTop:12 }}>
              <h5>{text.context}</h5>
              {data.context.image_asset_id && <p className="panel__note">صورة الصفحة: {data.context.image_asset_id}</p>}
              {data.siblings && <p className="panel__note">سياق: ص {data.siblings?.map((s:any)=>s.page_number).join(', ')}</p>}
              {data.thumbnail && <Link to={adminPath(`media/${data.thumbnail}`)} className="button button--ghost button--small">عرض الصورة</Link>}
            </div>
          )}
        </div>

        {/* target — editable */}
        <div className="panel" style={{ padding:12 }}>
          <h4>{text.target} — {data.target_language?.toUpperCase()} {targetRTL? '(RTL)':'(LTR)'}</h4>
          <textarea
            dir={targetRTL? 'rtl':'ltr'}
            style={{ width:'100%', minHeight:200, padding:12, borderRadius:8, border:'1px solid var(--border)' }}
            value={target}
            onChange={e=> setTarget(e.target.value)}
            placeholder="اكتب الترجمة هنا..."
          />
          <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
            <button className="button button--primary" disabled={saving || !target.trim()} onClick={()=> save('in_translation')}>{text.save}</button>
            <button className="button button--ghost" disabled={saving} onClick={()=> save('ready_for_review')}>{text.submitReview}</button>
            <button className="button button--ghost" disabled={saving} onClick={async()=>{ await api.reviewTranslation(id, { status:'approved' }); await load() }}>{text.approve}</button>
          </div>
          <p className="panel__note" style={{ marginTop:8 }}>المصدر للقراءة فقط — إن كان خطأ، افتح محرر المحتوى الأصلي</p>
        </div>

        {/* side panel */}
        <div style={{ display:'grid', gap:12 }}>
          <div className="panel" style={{ padding:12 }}>
            <h5>{text.glossary}</h5>
            {data.glossary?.length? <ul style={{ fontSize:13 }}>{data.glossary.map((g:any)=> <li key={g.id}><strong>{g.source_term}</strong> → {g.translations?.[data.target_language] ?? JSON.stringify(g.translations)}</li>)}</ul>: <p className="panel__note">لا مصطلحات مطابقة</p>}
          </div>
          <div className="panel" style={{ padding:12 }}>
            <h5>{text.memory}</h5>
            {suggestions.length? <ul style={{ fontSize:13 }}>{suggestions.map((s:any,i:number)=> <li key={i}><em>{s.source_text.slice(0,60)}</em><br/>→ {s.target_text.slice(0,60)} <button className="button button--ghost button--small" onClick={()=> setTarget(s.target_text)}>استخدام</button></li>)}</ul>: <p className="panel__note">لا اقتراحات ذاكرة</p>}
          </div>
          <div className="panel" style={{ padding:12 }}>
            <h5>{text.version}</h5><p className="panel__note">المصدر v{data.source_version} — الترجمة {data.status}</p>
            <h5 style={{ marginTop:12 }}>{text.preview}</h5><p className="panel__note">المعاينة تحافظ على خريطة الإجابة — لا تغيّر دلالة التقييم</p>
          </div>
        </div>
      </div>
    </div>
  )
}
