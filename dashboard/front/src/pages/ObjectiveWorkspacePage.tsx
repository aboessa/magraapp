// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { formatDate } from '../lib/labels'

const copy = {
  ar: {
    back: 'العودة للأهداف', loading: 'جارٍ تحميل الهدف…', loadError:'تعذر تحميل الهدف',
    tabs: { overview:'نظرة عامة', measurement:'القياس', age:'المسارات العمرية', content:'المحتوى', games:'الألعاب والنشاط', questions:'الأسئلة والتقييم', mastery:'أدلة الإتقان', reviews:'المراجعات', history:'السجل' },
    code:'الرمز', skill:'المهارة', ages:'المدى العمري', tracks:'المسارات', criterion:'معيار القياس', noCriterion:'لا يوجد معيار قياس محدد — مشكلة إطارية', noCriterionHint:'يجب إضافة إجراء/هدف/شرط/معيار نجاح قابل للقياس',
    contentCoverage:'تغطية المحتوى', gamesCoverage:'الألعاب', questionsCoverage:'الأسئلة', masteryEligible:'مؤهل للإتقان', evidenceSources:'مصادر الدليل',
    episodes:'حلقات', stories:'قصص', games:'ألعاب', projects:'مشروعات', questions:'أسئلة',
    noContent:'لا محتوى مرتبط بهذا الهدف', noGames:'لا ألعاب تدرّب على هذا الهدف', noQuestions:'لا أسئلة تقييمية مرتبطة', noMastery:'لا أدلة إتقان بعد', domainGap:'يجب تمييز دور المحتوى: تعليم/تدريب/تقييم — غير موجود حاليًا',
    measurementTitle:'ماذا يُقاس؟', measurementWhat:'السلوك المقاس', measurementSuccess:'ما يُعد نجاحًا', measurementEvidence:'ما يُحتسب دليلاً', measurementMin:'الحد الأدنى للمحاولات', measurementMastery:'هل يساهم في الإتقان؟',
    threshold:'العتبة: 80% دقة', minAttempts:'٣ محاولات مؤهلة', evidence:'ألعاب trace_color وما يقابلها', archive:'أرشفة', delete:'حذف', rederive:'إعادة اشتقاق المسارات',
    updated:'آخر تحديث', related:'روابط ذات صلة',
  },
  en: {
    back:'Back to objectives', loading:'Loading objective…', loadError:'Unable to load objective',
    tabs: { overview:'Overview', measurement:'Measurement', age:'Age Tracks', content:'Content', games:'Games & Practice', questions:'Questions & Assessment', mastery:'Mastery Evidence', reviews:'Reviews', history:'History' },
    code:'Code', skill:'Skill', ages:'Age range', tracks:'Tracks', criterion:'Measurement criterion', noCriterion:'No measurement criterion — framework issue', noCriterionHint:'Add Action/Target/Condition/Success criterion',
    contentCoverage:'Content coverage', gamesCoverage:'Games', questionsCoverage:'Questions', masteryEligible:'Mastery eligible', evidenceSources:'Evidence sources',
    episodes:'Episodes', stories:'Stories', games:'Games', projects:'Projects', questions:'Questions',
    noContent:'No content linked to this objective', noGames:'No games linked', noQuestions:'No assessment questions', noMastery:'No mastery evidence yet', domainGap:'Content role distinction Teach/Practice/Assess not yet modeled — domain gap',
    measurementTitle:'What is measured?', measurementWhat:'Behavior measured', measurementSuccess:'What counts as success', measurementEvidence:'What counts as evidence', measurementMin:'Minimum attempts', measurementMastery:'Contributes to mastery?',
    threshold:'Threshold: 80% accuracy', minAttempts:'3 qualifying attempts', evidence:'trace_color games', archive:'Archive', delete:'Delete', rederive:'Re-derive tracks',
    updated:'Updated', related:'Related',
  }
}

export function ObjectiveWorkspacePage(){
  const { id='' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale==='en'?'en':'ar']
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState<keyof typeof text.tabs>('overview')
  const [loading, setLoading]=useState(true)
  const [error, setError]=useState('')
  const [coverage, setCoverage]=useState<any>(null)
  const [questions, setQuestions]=useState<any[]>([])
  const [mastery, setMastery]=useState<any>(null)

  const load = useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const res = await api.learningObjective(id)
      setData(res.data)
      // fetch coverage: episodes, games, projects via existing APIs
      const [epRes, gameRes, qRes, mRes] = await Promise.allSettled([
        api.episodes({ limit:50 } as any),
        api.games({ limit:50 } as any),
        api.questions({ objective_id: id, limit:50 } as any),
        api.masteryByObjective({} as any).then(()=> api.masteryByObjective({}).catch(()=>null)),
      ])
      const eps = epRes.status==='fulfilled'? (epRes.value as any).data?.filter((e:any)=> e.learning_objective_id===id) ?? [] : []
      const gs = gameRes.status==='fulfilled'? (gameRes.value as any).data?.filter((g:any)=> g.learning_objective_id===id) ?? [] : []
      const projRes = await (api as any).projects?.({ limit:100 })?.catch(()=>null) as any
      let projects:any[]=[]
      try{ if(projRes?.data) projects=projRes.data.filter((p:any)=> Array.isArray(p.learning_objective_ids) && p.learning_objective_ids.includes(id)) }catch{}
      setCoverage({ episodes: eps, games: gs, projects, stories: [] })
      if(qRes.status==='fulfilled') setQuestions((qRes.value as any).data ?? [])
      // mastery for this objective
      try{
        const mr = await api.masteryByObjective({} as any) as any
        const row = mr.data?.find((r:any)=> r.id===id)
        setMastery(row ?? null)
      }catch{ setMastery(null) }
    }catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[id, text.loadError])

  useEffect(()=>{ void load()},[load])

  if(loading) return <LoadingState label={text.loading} />
  if(error) return <ErrorState message={error} onRetry={()=> void load()} />
  if(!data) return <EmptyState title={text.loadError} description={id} />

  const isMeasurable = !!data.measurable_criteria?.trim()
  const hasContent = (coverage?.episodes?.length??0)+(coverage?.games?.length??0)+(coverage?.projects?.length??0)>0
  const hasAssessment = questions.length>0 || (coverage?.games?.length??0)>0
  const masteryEligible = isMeasurable && hasAssessment

  return (
    <div className="page-stack">
      <div className="panel">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
          <div>
            <div className="eyebrow" style={{ color:'var(--muted)', fontSize:12 }}>{data.code}</div>
            <h2 style={{ margin:'4px 0' }}>{data.title_ar}</h2>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', color:'var(--muted)', fontSize:13 }}>
              <span>{text.skill}: <Link to={adminPath(`skills`)}>{data.skill_name ?? '—'}</Link></span>
              <span>{text.ages}: {data.age_min}–{data.age_max}</span>
              <span>{text.tracks}: {data.track_ids?.join(', ') ?? '—'}</span>
            </div>
            {!isMeasurable && <div className="inline-alert inline-alert--warn" style={{ marginTop:8 }}><strong>{text.noCriterion}</strong> — {text.noCriterionHint}</div>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Link className="button button--ghost" to={adminPath('objectives')}>{text.back}</Link>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:12, overflowX:'auto' }}>
          {(Object.keys(text.tabs) as Array<keyof typeof text.tabs>).map(k=>(
            <button key={k} className={`button ${tab===k?'button--primary':'button--ghost'} button--small`} onClick={()=> setTab(k)}>{text.tabs[k]}</button>
          ))}
        </div>
      </div>

      {tab==='overview' && (
        <div className="panel">
          <div className="prod-command" style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <div className="prod-metric"><strong>{coverage?.episodes?.length??0}</strong><span>{text.episodes}</span></div>
            <div className="prod-metric"><strong>{coverage?.games?.length??0}</strong><span>{text.games}</span></div>
            <div className="prod-metric"><strong>{questions.length}</strong><span>{text.questions}</span></div>
            <div className="prod-metric"><strong>{mastery?.attempts??0}</strong><span>محاولات</span></div>
            <div className={`prod-metric ${masteryEligible?'prod-metric--complete':'prod-metric--blocked'}`}><strong>{masteryEligible?'✓':'—'}</strong><span>{text.masteryEligible}</span></div>
          </div>
          <div style={{ padding:12 }}>
            {data.description_ar && <p>{data.description_ar}</p>}
            <h4>{text.criterion}</h4>
            {isMeasurable? <p>{data.measurable_criteria}</p> : <p className="panel__note">{text.noCriterion}</p>}
            <div className="inline-alert inline-alert--info" style={{ marginTop:12 }}>{text.domainGap}</div>
            <div style={{ marginTop:12 }}>
              <Link className="button button--ghost button--small" to={adminPath(`quiz?objective=${data.id}`)}>عرض أسئلة الهدف</Link>
              <Link className="button button--ghost button--small" to={adminPath(`mastery?objective=${data.id}`)}>عرض أدلة الإتقان</Link>
            </div>
          </div>
        </div>
      )}

      {tab==='measurement' && (
        <div className="panel"><div style={{ padding:16 }}>
          <h3>{text.measurementTitle}</h3>
          <dl style={{ display:'grid', gap:12 }}>
            <div><dt>{text.measurementWhat}</dt><dd>{data.title_ar}</dd></div>
            <div><dt>{text.measurementSuccess}</dt><dd>{isMeasurable? data.measurable_criteria : text.noCriterion}</dd></div>
            <div><dt>{text.measurementEvidence}</dt><dd>{text.evidence}</dd></div>
            <div><dt>{text.measurementMin}</dt><dd>{text.minAttempts}</dd></div>
            <div><dt>{text.measurementMastery}</dt><dd>{masteryEligible? 'نعم — مؤهل بعد ٣ محاولات مؤهلة':'لا — يحتاج معيار قياس ومصدر تقييم'}</dd></div>
            <div><dt>{text.threshold}</dt><dd>≥80% دقة في نافذة 5 محاولات، 3 متتالية مستقلة للاستقلال</dd></div>
          </dl>
          <p style={{ color:'var(--muted)', fontSize:12, marginTop:12 }}>الصيغة مستمدة من lib/mastery.ts — لا يُخترع معيار جديد هنا</p>
        </div></div>
      )}

      {tab==='age' && (
        <div className="panel"><div style={{ padding:16 }}>
          <h4>المسارات العمرية</h4>
          <div className="badge-row">{data.track_ids?.map((t:string)=> <span key={t} className="track-badge">{t}</span>)}</div>
          <p style={{ marginTop:8 }}>المدى {data.age_min}–{data.age_max} يلمس {data.track_ids?.join('، ')}</p>
          <h4 style={{ marginTop:16 }}>تغطية حسب المسار</h4>
          <table className="data-table"><thead><tr><th>المسار</th><th>محتوى</th><th>تقييم</th></tr></thead><tbody>
            {['preschool','kids','junior'].map(tr=>(
              <tr key={tr}><td>{tr}</td><td>{data.track_ids?.includes(tr)? (hasContent?'✓':'—'):'—'}</td><td>{data.track_ids?.includes(tr)? (hasAssessment?'✓':'لا يوجد تقييم'):'—'}</td></tr>
            ))}
          </tbody></table>
          {!hasContent && <p className="panel__note">{text.noContent}</p>}
        </div></div>
      )}

      {tab==='content' && (
        <div className="panel"><div style={{ padding:16 }}>
          <h3>{text.contentCoverage}</h3>
          {(coverage?.episodes?.length??0)===0 && (coverage?.projects?.length??0)===0 ? <EmptyState title={text.noContent} description="اربط حلقات أو مشروعات بهذا الهدف من صفحات المحتوى" /> :
          <div className="vs-grid">
            {coverage.episodes.map((e:any)=>(
              <Link key={e.id} to={adminPath(`episodes/${e.id}`)} className="vs-card"><div className="vs-card__body"><h4>{e.title_ar}</h4><small>حلقة · {e.series_title ?? ''}</small></div><footer className="vs-card__foot">حلقة</footer></Link>
            ))}
            {coverage.projects.map((p:any)=>(
              <Link key={p.id} to={adminPath(`projects/${p.id}`)} className="vs-card"><div className="vs-card__body"><h4>{p.title_ar}</h4></div><footer className="vs-card__foot">مشروع</footer></Link>
            ))}
          </div>}
        </div></div>
      )}

      {tab==='games' && (
        <div className="panel"><div style={{ padding:16 }}>
          <h3>{text.gamesCoverage}</h3>
          {(coverage?.games?.length??0)===0 ? <EmptyState title={text.noGames} description="الألعاب المرتبطة بهذا الهدف تظهر هنا مع دورها: تعليم/تدريب/تقييم" /> :
          <div className="vs-grid">
            {coverage.games.map((g:any)=>(
              <Link key={g.id} to={adminPath(`games/${g.id}`)} className="vs-card"><div className="vs-card__body"><h4>{g.title_ar}</h4><small>{g.engine_name ?? g.engine_id}</small></div><footer className="vs-card__foot">{g.difficulty} · {g.age_min}-{g.age_max}</footer></Link>
            ))}
          </div>}
          <p className="panel__note" style={{ marginTop:12 }}>الدور (Teach/Practice/Assess) غير مصنف بعد — فجوة مجال</p>
        </div></div>
      )}

      {tab==='questions' && (
        <div className="panel"><div style={{ padding:16 }}>
          <h3>{text.questionsCoverage}</h3>
          {questions.length===0 ? <EmptyState title={text.noQuestions} description="أنشئ سؤالاً تقييميًا مرتبطًا بهذا الهدف من بنك الأسئلة" action={<Link className="button button--primary" to={adminPath(`quiz?objective_id=${data.id}`)}>فتح بنك الأسئلة</Link>} /> :
          <table className="data-table"><thead><tr><th>السؤال</th><th>النوع</th><th>الحالة</th></tr></thead><tbody>
            {questions.map((q:any)=> <tr key={q.id}><td><Link to={adminPath(`quiz/${q.id}`)}>{q.prompt_ar.slice(0,80)}</Link></td><td>{q.type}</td><td>{q.status}</td></tr>)}
          </tbody></table>}
        </div></div>
      )}

      {tab==='mastery' && (
        <div className="panel"><div style={{ padding:16 }}>
          <h3>{text.masteryEligible}</h3>
          {mastery? (
            <div><p>أطفال: {mastery.children_count} · مستقل: {mastery.independent_count} · يحتاج مراجعة: {mastery.needs_review_count}</p><p>محاولات: {mastery.attempts} · نسبة نجاح: {mastery.success_rate ?? '—'}%</p><Link to={adminPath(`mastery`)} className="button button--ghost button--small">فتح الإتقان</Link></div>
          ): <EmptyState title={text.noMastery} description="لا توجد محاولات مؤهلة لهذا الهدف بعد — تحقق من وجود محتوى والعاب تقييمية" />}
        </div></div>
      )}

      {tab==='reviews' && (
        <div className="panel"><div style={{ padding:16 }}>
          <h3>المراجعات</h3>
          <p className="panel__note">تستخدم نظام المراجعات الموحد (content_reviews) عبر review/edu, lang, qa — لا نظام مصغر مستقل</p>
          <Link className="button button--ghost" to={adminPath('content-reviews')}>فتح المراجعات</Link>
        </div></div>
      )}

      {tab==='history' && (
        <div className="panel"><div style={{ padding:16 }}>
          <p>السجل من audit_logs</p>
          <p className="panel__note">كل تغيير يؤرشف مع actor/reason</p>
        </div></div>
      )}
    </div>
  )
}
