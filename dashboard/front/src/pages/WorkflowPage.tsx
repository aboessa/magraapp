import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { useUrlListState } from '../hooks/useUrlListState'
import { adminPath } from '../lib/adminPath'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'
import { api } from '../lib/api'
import type { WorkflowDecision, WorkflowMyStage, WorkflowOverdueRow, WorkflowRunDetail, WorkflowRunRecord, WorkflowStageView, WorkflowTemplate } from '../types/api'

const DECISIONS: WorkflowDecision[] = ['approved', 'changes_requested', 'rejected', 'skipped']

const copy = {
  ar: {
    eyebrow: 'سير العمل',
    title: 'مركز سير العمل والاعتماد',
    lede: 'تشغيلات حقيقية بمراحل واعتمادات وتواريخ استحقاق. لا يمكن تجاوز مرحلة حاجبة بتغيير حالة المحتوى.',
    overview: 'نظرة عامة',
    runs: 'التشغيلات',
    inbox: 'صندوق المراجعة',
    myWork: 'مهامي',
    overdue: 'المتأخّر',
    blocked: 'المعطل',
    unassigned: 'غير مسند',
    templates: 'القوالب',
    history: 'السجل',
    metrics: { active: 'نشط', waiting: 'بانتظار المراجعة', changes: 'طلب تعديلات', blocked: 'معطل', overdue: 'متأخر', today: 'مستحق اليوم', unassigned: 'غير مسند', week: 'مكتمل هذا الأسبوع' },
    pipeline: 'خط المراحل',
    content: 'المحتوى',
    template: 'القالب',
    stage: 'المرحلة الحالية',
    status: 'الحالة',
    owner: 'المسؤول',
    team: 'الفريق',
    due: 'الاستحقاق',
    age: 'العمر في المرحلة',
    blocker: 'العائق',
    open: 'فتح',
    start: 'بدء سير عمل',
    startTitle: 'بدء سير عمل جديد',
    startHint: 'اختر المحتوى والقالب. النسخة تُثبّت على التشغيلة.',
    contentType: 'نوع المحتوى',
    contentId: 'معرّف المحتوى',
    templatePick: 'القالب والإصدار',
    empty: 'لا تشغيلات',
    emptyHint: 'تبدأ التشغيلات عند إرسال محتوى للمراجعة.',
    emptyInbox: 'لا مراجعات معلقة',
    emptyMy: 'لا مراحل مسندة إليك',
    emptyOverdue: 'لا متأخرات',
    emptyTemplates: 'لا قوالب نشطة',
    createTemplate: 'إنشاء قالب',
    loadError: 'تعذر التحميل',
    search: 'بحث بالعنوان أو السلسلة...',
    filterTemplate: 'القالب',
    filterStage: 'المرحلة',
    filterStatus: 'الحالة',
    all: 'الكل',
    review: 'مراجعة',
    approve: 'اعتماد',
    requestChanges: 'طلب تعديلات',
    reject: 'رفض',
    comment: 'ملاحظة',
    commentReq: 'مطلوبة للرفض وطلب التعديل.',
    assign: 'تعيين',
    assignTitle: 'تعيين مرحلة',
    decisionTitle: 'قرار مرحلة',
    cancel: 'إلغاء',
    submit: 'تسجيل',
    submitting: 'جارٍ التسجيل…',
    dueIn: 'متبقٍ',
    overdueBy: 'متأخر',
    sla: 'SLA',
    depends: 'يعتمد على',
    quickView: 'عرض سريع',
    openWorkspace: 'افتح مساحة التشغيل',
    visualTimeline: 'المسار البصري',
    productionLink: 'عرض الإنتاج',
    qaLink: 'عرض الجودة',
    translationLink: 'عرض الترجمة',
    audit: 'السجل',
  },
  en: {
    eyebrow: 'Workflow',
    title: 'Workflow & Approvals Centre',
    lede: 'Real runs with stages, approvals and due dates. Blocking stages prevent publish; status alone cannot bypass.',
    overview: 'Overview',
    runs: 'Runs',
    inbox: 'Inbox',
    myWork: 'My work',
    overdue: 'Overdue',
    blocked: 'Blocked',
    unassigned: 'Unassigned',
    templates: 'Templates',
    history: 'History',
    metrics: { active: 'Active', waiting: 'Waiting review', changes: 'Changes requested', blocked: 'Blocked', overdue: 'Overdue', today: 'Due today', unassigned: 'Unassigned', week: 'Completed this week' },
    pipeline: 'Pipeline',
    content: 'Content',
    template: 'Template',
    stage: 'Current stage',
    status: 'Status',
    owner: 'Owner',
    team: 'Team',
    due: 'Due',
    age: 'Time in stage',
    blocker: 'Blocker',
    open: 'Open',
    start: 'Start workflow',
    startTitle: 'Start new workflow',
    startHint: 'Choose content and template. Version is pinned to the run.',
    contentType: 'Content type',
    contentId: 'Content id',
    templatePick: 'Template & version',
    empty: 'No runs',
    emptyHint: 'Runs appear when content enters review.',
    emptyInbox: 'No pending reviews',
    emptyMy: 'No stages assigned to you',
    emptyOverdue: 'No overdue',
    emptyTemplates: 'No active templates',
    createTemplate: 'Create template',
    loadError: 'Unable to load',
    search: 'Search by title or series...',
    filterTemplate: 'Template',
    filterStage: 'Stage',
    filterStatus: 'Status',
    all: 'All',
    review: 'Review',
    approve: 'Approve',
    requestChanges: 'Request changes',
    reject: 'Reject',
    comment: 'Comment',
    commentReq: 'Required for reject / request changes.',
    assign: 'Assign',
    assignTitle: 'Assign stage',
    decisionTitle: 'Stage decision',
    cancel: 'Cancel',
    submit: 'Submit',
    submitting: 'Submitting…',
    dueIn: 'remaining',
    overdueBy: 'overdue',
    sla: 'SLA',
    depends: 'Depends on',
    quickView: 'Quick view',
    openWorkspace: 'Open workspace',
    visualTimeline: 'Visual timeline',
    productionLink: 'View production',
    qaLink: 'View QA',
    translationLink: 'View translation',
    audit: 'Audit',
  },
}

type View = 'overview' | 'runs' | 'inbox' | 'mine' | 'overdue' | 'blocked' | 'unassigned' | 'templates'

const workflowStatusCopy = {
  ar: {
    blocksPublish: 'حاجبة للنشر',
    escalated: 'مصعّد',
    runsLimitation: 'GET /admin/workflows/runs يدعم الترقيم فقط، ولا يقبل فلترة بحالة ولا بقالب على الخادم.',
    lateHours: (hours: number) => `${hours} ساعة تأخّر`,
  },
  en: {
    blocksPublish: 'Blocks publishing',
    escalated: 'Escalated',
    runsLimitation: 'GET /admin/workflows/runs supports pagination only; it does not support server-side status or template filtering.',
    lateHours: (hours: number) => `${hours} hours overdue`,
  },
}

function dueLabel(dueAt: string | null) {
  if (!dueAt) return '—'
  const diff = Date.parse(dueAt) - Date.now()
  const days = Math.floor(Math.abs(diff)/86400000)
  const hrs = Math.floor(Math.abs(diff)%86400000/3600000)
  if (diff < 0) return `${days}d ${hrs}h متأخر`
  if (days===0) return `${hrs}h متبقٍ`
  return `${days}d متبقٍ`
}

export function WorkflowPage() {
  const { locale } = usePreferences()
  const text = copy[locale==='en'?'en':'ar'] as typeof copy.ar
  const statusText = workflowStatusCopy[locale==='en'?'en':'ar']
  const navigate = useNavigate()
  const url = useUrlListState({}, { defaultView: 'overview' })
  const view = (url.view === 'my' ? 'mine' : url.view) as View
  const setView = (v: View) => url.setView(v as any)

  const [runs, setRuns] = useState<WorkflowRunRecord[]>([])
  const [total, setTotal] = useState(0)
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [mine, setMine] = useState<WorkflowMyStage[]>([])
  const [overdue, setOverdue] = useState<WorkflowOverdueRow[]>([])
  const [detail, setDetail] = useState<WorkflowRunDetail | null>(null)
  const [quick, setQuick] = useState<WorkflowRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState(url.query || '')
  const [templateFilter, setTemplateFilter] = useState('')
  const [startOpen, setStartOpen] = useState(false)
  const [startForm, setStartForm] = useState({ content_type: 'episode', content_id: '', template_id: '' })
  const [decisionStage, setDecisionStage] = useState<WorkflowStageView | null>(null)
  const [assignStage, setAssignStage] = useState<WorkflowStageView | null>(null)
  const [decision, setDecision] = useState<WorkflowDecision>('approved')
  const [comment, setComment] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [r, t, m, o] = await Promise.all([ api.workflowRuns({ limit: url.limit, offset: url.offset }), api.workflowTemplates(), api.workflowMyStages(), api.workflowOverdue()])
      setRuns(r.data); setTotal(r.meta.total); setTemplates(t.data); setMine(m.data); setOverdue(o.data)
      if (!startForm.template_id && t.data.length) setStartForm(f=> ({...f, template_id: t.data[0].id }))
    } catch (e) { setError(e instanceof Error? e.message: text.loadError)} finally { setLoading(false)}
  }, [url.limit, url.offset, text.loadError])

  useEffect(()=>{ void load()},[load])
  useEffect(()=>{ setQuery(url.query || '')},[url.query])

  const filteredRuns = useMemo(()=>{
    let arr=[...runs]
    if (query) arr=arr.filter(r=> `${r.content_type}${r.content_id}${r.current_step}`.toLowerCase().includes(query.toLowerCase()))
    if (templateFilter) arr=arr.filter(r=> r.template_id===templateFilter)
    if (view==='overdue') {
      const ids = new Set(overdue.map(o=>o.run_id))
      arr=arr.filter(r=> ids.has(r.id))
    }
    if (view==='blocked') arr=arr.filter(r=> r.status==='blocked')
    return arr
  },[runs, query, templateFilter, view, overdue])

  const metrics = useMemo(()=>{
    const waiting = runs.filter(r=> r.status==='waiting_review' || r.status==='in_progress').length
    const blocked = runs.filter(r=> r.status==='blocked').length
    const overdueCount = overdue.length
    const today = mine.filter(m=> m.due_at && new Date(m.due_at).toDateString()===new Date().toDateString()).length
    const unassigned = runs.filter(r=> !r.current_step).length
    return { active: runs.length, waiting, changes: runs.filter(r=> r.status==='changes_requested').length, blocked, overdue: overdueCount, today, unassigned, week: runs.filter(r=> r.status==='approved').length }
  },[runs, overdue, mine])

  const pipeline = useMemo(()=>{
    const map = new Map<string, number>()
    for (const r of runs) {
      const key = r.current_step || 'pending'
      map.set(key, (map.get(key)||0)+1)
    }
    return Array.from(map.entries()).slice(0,6)
  },[runs])

  const openRun = useCallback(async (id: string) => {
    try { const res = await api.workflowRun(id); setDetail(res.data)} catch(e){ setError(e instanceof Error?e.message:text.loadError)}
  },[text.loadError])

  const openQuick = useCallback(async (id: string) => {
    try { const res = await api.workflowRun(id); setQuick(res.data)} catch{}
  },[])

  async function startRun(){
    setSaving(true); setModalError('')
    try{
      // duplicate protection: check existing active run for same content
      const existing = runs.find(r=> r.content_type===startForm.content_type && r.content_id===startForm.content_id && r.status!=='completed' && r.status!=='cancelled')
      if (existing) { setModalError('يوجد تشغيلة نشطة لنفس المحتوى — افتح التشغيلة الحالية بدل إنشاء مكررة.'); setSaving(false); return}
      const res = await api.startWorkflowRun({ content_type: startForm.content_type, content_id: startForm.content_id, template_id: startForm.template_id })
      setStartOpen(false); await load(); await openRun(res.data.run_id)
    } catch(e){ setModalError(e instanceof Error? e.message: text.loadError)} finally{ setSaving(false)}
  }
  async function submitDecision(){
    if(!detail||!decisionStage) return
    if(decision!=='approved' && !comment.trim()){ setModalError(text.commentReq); return}
    setSaving(true)
    try{ await api.decideWorkflowStage(detail.run.id, decisionStage.stage_key, { decision, comment: comment.trim()||undefined}); setDecisionStage(null); setComment(''); await openRun(detail.run.id); await load()} catch(e){ setModalError(e instanceof Error?e.message:text.loadError)} finally{ setSaving(false)}
  }
  async function submitAssign(){
    if(!detail||!assignStage) return
    setSaving(true)
    try{ await api.assignWorkflowStage(detail.run.id, assignStage.stage_key, { assignee_id: assignee||null, due_at: dueDate? `${dueDate}T23:59:59.999Z`:null}); setAssignStage(null); setAssignee(''); setDueDate(''); await openRun(detail.run.id)} catch(e){ setModalError(e instanceof Error?e.message:text.loadError)} finally{ setSaving(false)}
  }

  if (loading && !runs.length) return <LoadingState />
  if (error && !runs.length) return <ErrorState message={error} onRetry={()=>void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div><button className="button button--primary" onClick={()=> setStartOpen(true)}><Icon name="plus" size={14} />{text.start}</button></section>

      {/* Command Center */}
      <section className="prod-command" aria-label="command">
        {Object.entries(metrics).map(([k,v])=> (
          <button key={k} className="prod-metric" onClick={()=> { if(k==='waiting') setView('inbox'); else if(k==='overdue') setView('overdue'); else if(k==='blocked') setView('blocked'); else setView('runs')}}>
            <strong>{v as number}</strong><span>{(text.metrics as any)[k]}</span>
          </button>
        ))}
      </section>

      {/* Pipeline */}
      <section className="panel"><header className="panel__header"><h3>{text.pipeline}</h3></header><div className="panel__body prod-pipeline">
        {pipeline.length? pipeline.map(([k,c])=> <div key={k} className="prod-pipe-row"><span>{k}</span><span className="prod-pipe-bar"><i style={{width:`${Math.min(100,c*12)}%`}}/></span><strong>{c}</strong></div>) : <p className="panel__note">لا مراحل نشطة</p>}
      </div></section>

      {/* Tabs */}
      <div className="detail-tabs" role="tablist">
        {(['overview','runs','inbox','mine','overdue','blocked','templates'] as View[]).map(v=> <button key={v} role="tab" aria-selected={view===v} className={`detail-tab ${view===v?'detail-tab--active':''}`} onClick={()=> setView(v)}>{(text as any)[v==='mine'?'myWork':v] ?? v}</button>)}
      </div>

      {(view==='overview' || view==='runs') && (
        <p className="panel__note">{statusText.runsLimitation}</p>
      )}

      {/* Filters */}
      <div className="filters-row" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div className="search-field" style={{ flex:1 }}><Icon name="search" size={16}/><input value={query} onChange={(e)=>{ setQuery(e.target.value); url.setQuery(e.target.value)}} placeholder={text.search} aria-label="search"/></div>
        <select value={templateFilter} onChange={(e)=> setTemplateFilter(e.target.value)} aria-label={text.filterTemplate}><option value="">{text.filterTemplate}: {text.all}</option>{templates.map(t=> <option key={t.id} value={t.id}>{t.name_ar}</option>)}</select>
      </div>

      {view==='overview' && (
        <div className="prod-grid2">
          <section className="panel"><header className="panel__header"><h3>{text.runs}</h3></header><div className="panel__body">
            {filteredRuns.slice(0,5).map(r=> <div key={r.id} className="prod-team-row"><Link to={adminPath(`workflows`)} onClick={(e)=>{e.preventDefault(); void openRun(r.id)}}>{r.content_type}·{r.content_id.slice(0,8)}</Link><small>{r.current_step}</small></div>)}
            {filteredRuns.length===0 && <p className="panel__note">{text.empty}</p>}
          </div></section>
          <section className="panel"><header className="panel__header"><h3>{text.inbox}</h3></header><div className="panel__body">
            {mine.slice(0,5).map(m=> <div key={`${m.run_id}:${m.stage_key}`} className="prod-team-row"><span>{m.content_type}·{m.stage_key}</span><small>{m.due_at?.slice(0,10)}</small></div>)}
            {mine.length===0 && <p className="panel__note">{text.emptyInbox}</p>}
          </div></section>
        </div>
      )}

      {view==='overdue' && (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead><tr><th>{text.content}</th><th>{text.filterStage}</th><th>{text.status}</th><th>{text.owner}</th><th>{text.due}</th><th>{text.age}</th><th>{text.sla}</th><th /></tr></thead>
              <tbody>
                {overdue.map((row) => (
                  <tr key={`${row.run_id}:${row.stage_key}`}>
                    <td><Link to={adminPath(row.content_type==='episode'?`episodes/${row.content_id}`:row.content_type==='story'?`stories/${row.content_id}`:'workflows')}>{row.content_type} · {row.content_id.slice(0,8)}</Link></td>
                    <td><strong>{row.name_ar ?? row.stage_key}</strong><small>{row.stage_key}</small></td>
                    <td><span className="status-badge status-badge--review">{row.status}</span></td>
                    <td>{row.assignee_id ?? row.assignee_team_id ?? '—'}</td>
                    <td dir="ltr">{row.due_at?.slice(0,10) ?? '—'}</td>
                    <td>{statusText.lateHours(row.hours_late)}</td>
                    <td>{row.escalated ? statusText.escalated : '—'}</td>
                    <td><button className="button button--ghost button--small" onClick={()=> void openRun(row.run_id)}>{text.open}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overdue.length===0 && <EmptyState title={text.emptyOverdue} description="" />}
        </section>
      )}

      {(view==='runs' || view==='inbox' || view==='blocked') && (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead><tr><th>{text.content}</th><th>{text.template}</th><th>{text.stage}</th><th>{text.status}</th><th>{text.owner}</th><th>{text.due}</th><th>{text.age}</th><th>{text.blocker}</th><th /></tr></thead>
              <tbody>
                {(view==='inbox' ? runs.filter(r=> mine.some(m=> m.run_id===r.id)) : filteredRuns).map(r=>{
                  const stageName = r.current_step || '—'
                  const isBlocked = r.status==='blocked'
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link to={adminPath(r.content_type==='episode'?`episodes/${r.content_id}`: r.content_type==='story'?`stories/${r.content_id}`: `workflows`)} className="prod-identity">
                          <div className="prod-thumb"><Icon name="media" size={16}/></div>
                          <div><strong>{r.content_type} · {r.content_id.slice(0,8)}</strong><small>{r.content_type}</small></div>
                        </Link>
                      </td>
                      <td>{templates.find(t=>t.id===r.template_id)?.name_ar ?? r.template_id ?? '—'}</td>
                      <td><span className="prod-chip">{stageName}</span></td>
                      <td><span className={`status-badge ${isBlocked?'status-badge--blocked':''}`}>{r.status}</span></td>
                      <td>{(r as any).assignee_id ?? '—'}</td>
                      <td dir="ltr">{(r as any).due_at?.slice(0,10) ?? '—'}</td>
                      <td>{dueLabel((r as any).due_at ?? null)}</td>
                      <td>{isBlocked? 'معطل': '—'}</td>
                      <td>
                        <div className="table-actions">
                          <button className="button button--ghost button--small" onClick={()=> void openQuick(r.id)}>{text.quickView}</button>
                          <button className="button button--ghost button--small" onClick={()=> void openRun(r.id)}>{text.open}</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredRuns.length===0 && <EmptyState title={view==='inbox'?text.emptyInbox:text.empty} description={text.emptyHint} action={<button className="button button--primary" onClick={()=> setStartOpen(true)}>{text.start}</button>} />}
          <Pagination total={total} limit={url.limit} offset={url.offset} onOffsetChange={url.setOffset as any} locale={locale} />
        </section>
      )}

      {view==='mine' && (
        <section className="panel panel--table"><div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.content}</th><th>{text.stage}</th><th>{text.status}</th><th>{text.due}</th><th /></tr></thead>
          <tbody>{mine.map(m=> <tr key={`${m.run_id}:${m.stage_key}`}><td>{m.content_type}·{m.content_id.slice(0,8)}</td><td>{m.name_ar}{m.blocks_publish ? ` · ${statusText.blocksPublish}` : ''}</td><td>{m.status}</td><td dir="ltr">{m.due_at?.slice(0,10)??'—'}</td><td><button className="button button--ghost button--small" onClick={()=> void openRun(m.run_id)}>{text.open}</button></td></tr>)}</tbody></table></div>{mine.length===0 && <EmptyState title={text.emptyMy} description="" />}</section>
      )}

      {view==='templates' && (
        <section className="panel">
          <header className="panel__header"><h3>{text.templates}</h3><button className="button button--ghost button--small" onClick={()=> navigate(adminPath('workflows'))}>{text.createTemplate}</button></header>
          <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>القالب</th><th>النوع</th><th>المراحل</th><th>الإصدار</th><th>النشط</th><th /></tr></thead>
            <tbody>{templates.map(t=> <tr key={t.id}><td><strong>{t.name_ar}</strong><small>{t.id}</small></td><td>{t.content_type}</td><td>{t.stages.length}</td><td>{(t as any).version ?? 'v1'}</td><td>{(t as any).is_active? 'نشط':'مسودة'}</td><td><button className="button button--ghost button--small" onClick={()=> void openRun(t.id)}>{text.open}</button></td></tr>)}</tbody></table></div>
          {templates.length===0 && <EmptyState title={text.emptyTemplates} description="" />}
        </section>
      )}

      {/* Quick View */}
      {quick && (
        <div className="drawer-backdrop" onClick={()=> setQuick(null)}>
          <div className="drawer" onClick={(e)=> e.stopPropagation()} role="dialog" aria-label={text.quickView}>
            <header className="drawer__header"><div><h2>{quick.run.content_type}·{quick.run.content_id.slice(0,8)}</h2><small>{quick.implied_status} · {quick.run.status}</small></div><button className="icon-button" onClick={()=> setQuick(null)}><Icon name="close" size={16}/></button></header>
            <div className="drawer__body">
              {quick.stages.slice(0,4).map(s=> <div key={s.stage_key} className="prod-req-card"><strong>{s.name_ar}</strong><small>{s.run_stage?.status ?? 'pending'} · {s.run_stage?.assignee_id ?? 'غير مسند'}</small></div>)}
            </div>
            <footer className="drawer__footer"><button className="button button--ghost" onClick={()=> setQuick(null)}>{text.cancel}</button><button className="button button--primary" onClick={()=>{ const id=quick.run.id; setQuick(null); void openRun(id)}}>{text.openWorkspace}</button></footer>
          </div>
        </div>
      )}

      {/* Run Workspace */}
      {detail && (
        <Modal open title={`${detail.run.content_type} · ${detail.run.content_id}`} description={`${detail.implied_status} · ${detail.run.status}`} onClose={()=> setDetail(null)}>
          <div className="wf-timeline" aria-label={text.visualTimeline}>
            {detail.stages.map((s, idx)=> {
              const st = s.run_stage?.status ?? 'pending'
              const cls = st==='approved'?'wf-timeline__node--done': st==='rejected'||st==='changes_requested'?'wf-timeline__node--blocked': s.run_stage? 'wf-timeline__node--current':'wf-timeline__node--upcoming'
              return <div key={s.stage_key} className={`wf-timeline__step ${cls}`}><div className="wf-timeline__dot" aria-hidden>{st==='approved'?'✓': st==='rejected'?'✕':'●'}</div><div><strong>{s.name_ar}</strong><small>{s.run_stage?.assignee_id ?? 'غير مسند'} · {s.run_stage?.due_at?.slice(0,10) ?? 'بدون استحقاق'}</small>{s.instructions_ar && <p className="panel__note">{s.instructions_ar}</p>}</div>{idx < detail.stages.length-1 && <div className="wf-timeline__line" />}</div>
            })}
          </div>
          <div className="panel__body" style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
            <Link className="button button--ghost button--small" to={adminPath(detail.run.content_type==='episode'?`episodes/${detail.run.content_id}`:`stories/${detail.run.content_id}`)}>{text.content}</Link>
            <Link className="button button--ghost button--small" to={adminPath('production')}>{text.productionLink}</Link>
            <Link className="button button--ghost button--small" to={adminPath('quality')}>{text.qaLink}</Link>
          </div>
          <ul className="readiness-list" style={{ marginTop:12 }}>
            {detail.stages.map(s=>{
              const st=s.run_stage
              return <li key={s.stage_key} className="readiness-item">
                <div className="readiness-item__head"><span className="readiness-item__label">{s.name_ar}</span><span className="readiness-item__owner">{st?.status ?? 'pending'} {s.blocks_publish?'· حاجبة':''}</span></div>
                <p className="panel__note">{s.depends_on.length? `${text.depends}: ${s.depends_on.join(', ')}`:''} {s.sla_hours? `· SLA ${s.sla_hours}h`:''}</p>
                <div className="form-actions">
                  <button className="button button--ghost button--small" onClick={()=>{ setAssignStage(s); setAssignee(st?.assignee_id??''); setDueDate(st?.due_at?.slice(0,10)??'')}}>{text.assign}</button>
                  <button className="button button--primary button--small" disabled={!s.can_decide} title={s.can_decide?undefined: s.refusal_reason ?? ''} onClick={()=>{ setDecisionStage(s); setDecision('approved'); setComment('')}}>{text.review}</button>
                </div>
              </li>
            })}
          </ul>
          <details className="readiness-group" style={{ marginTop:12 }}><summary>{text.audit}</summary><ul className="readiness-list">{detail.history.slice(0,8).map(h=> <li key={h.id} className="readiness-item"><small>{h.step} · {h.decision} · {h.reviewer_name ?? h.reviewer_id} · {h.created_at.slice(0,16)}</small><p>{h.comment}</p></li>)}</ul></details>
        </Modal>
      )}

      {startOpen && (
        <Modal open title={text.startTitle} description={text.startHint} onClose={()=> setStartOpen(false)}>
          <div className="entity-form">
            {modalError && <p className="inline-alert inline-alert--error">{modalError}</p>}
            <div className="form-grid"><label className="field"><span>{text.contentType}</span><select value={startForm.content_type} onChange={(e)=> setStartForm({...startForm, content_type:e.target.value})}><option value="episode">episode</option><option value="story">story</option><option value="islamic">islamic</option></select></label><label className="field"><span>{text.contentId}</span><input dir="ltr" value={startForm.content_id} onChange={(e)=> setStartForm({...startForm, content_id:e.target.value})} /></label></div>
            <label className="field"><span>{text.templatePick}</span><select value={startForm.template_id} onChange={(e)=> setStartForm({...startForm, template_id:e.target.value})}>{templates.map(t=> <option key={t.id} value={t.id}>{t.name_ar} ({t.stages.length})</option>)}</select></label>
            <div className="form-actions"><button className="button button--ghost" onClick={()=> setStartOpen(false)}>{text.cancel}</button><button className="button button--primary" disabled={saving||!startForm.content_id.trim()} onClick={()=> void startRun()}>{saving? text.submitting: text.submit}</button></div>
          </div>
        </Modal>
      )}

      {decisionStage && (
        <Modal open title={text.decisionTitle} onClose={()=> setDecisionStage(null)}>
          <div className="entity-form">
            {modalError && <p className="inline-alert inline-alert--error">{modalError}</p>}
            <label className="field"><span>{text.review}</span><select value={decision} onChange={(e)=> setDecision(e.target.value as any)}>{DECISIONS.map(d=> <option key={d} value={d}>{(text as any)[d] ?? d}</option>)}</select></label>
            <label className="field"><span>{text.comment}</span><textarea rows={3} value={comment} onChange={(e)=> setComment(e.target.value)} /><small>{text.commentReq}</small></label>
            <div className="form-actions"><button className="button button--ghost" onClick={()=> setDecisionStage(null)}>{text.cancel}</button><button className="button button--primary" disabled={saving} onClick={()=> void submitDecision()}>{saving? text.submitting: text.submit}</button></div>
          </div>
        </Modal>
      )}

      {assignStage && (
        <Modal open title={text.assignTitle} onClose={()=> setAssignStage(null)}>
          <div className="entity-form">
            <label className="field"><span>{text.owner}</span><input dir="ltr" value={assignee} onChange={(e)=> setAssignee(e.target.value)} /></label>
            <label className="field"><span>{text.due}</span><input type="date" value={dueDate} onChange={(e)=> setDueDate(e.target.value)} /></label>
            <div className="form-actions"><button className="button button--ghost" onClick={()=> setAssignStage(null)}>{text.cancel}</button><button className="button button--primary" disabled={saving} onClick={()=> void submitAssign()}>{saving? text.submitting: text.submit}</button></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
