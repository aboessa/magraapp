import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type {
  WorkflowDecision,
  WorkflowMyStage,
  WorkflowOverdueRow,
  WorkflowRunDetail,
  WorkflowRunRecord,
  WorkflowStageView,
  WorkflowTemplate,
} from '../types/api'

/**
 * مركز سير العمل: مراحل وتعيينات وقرارات وSLA — لا سجل قرارات فقط.
 *
 * ## ما كانت عليه هذه الصفحة
 *
 * سجل قرارات على «الخطوة المخزَّنة»: تشغيلة واحدة تحمل `current_step` نصيًّا،
 * وقرار يُسجَّل عليها، وشيء لا يتقدّم ولا يُسنَد ولا يحجب ولا يتأخّر. نصّها كان
 * صادقًا في وصف ذلك، لكن النتيجة أن محتوى يصل إلى `published` بلا أي مرحلة
 * معتمدة، لأن عمود الحالة وسير العمل كانا بيانين غير مرتبطين.
 *
 * ## ما صارت عليه
 *
 * ثلاث نوافذ على نفس المحرك:
 *
 *  * **التشغيلات** — كل تشغيلة ومراحلها، مع تعيين وقرار لكل مرحلة.
 *  * **مهامي** — المراحل المُسنَدة للمستخدم الحالي وحده.
 *  * **المتأخّر** — تجاوزات SLA والتصعيد، محسوبة من التواريخ لا من عمود مخزَّن.
 *
 * زرّ القرار يظهر دائمًا؛ إن كان ممنوعًا فهو معطَّل مع **سبب من الخادم**
 * (`refusal_reason`) لا من تقدير الواجهة. هذا هو الفرق بين «لا أدري لماذا لا
 * يعمل» و«هذه المرحلة تحتاج صلاحية upload_images».
 */

const DECISIONS: WorkflowDecision[] = ['approved', 'changes_requested', 'rejected', 'skipped']

const copy = {
  ar: {
    eyebrow: 'سير العمل',
    title: 'مركز سير العمل',
    lede: 'مراحل حقيقية بتعيينات وتواريخ استحقاق وتبعيات وصلاحيات انتقال. المراحل الحاجبة تمنع النشر فعلًا: تغيير حالة المحتوى وحده لا يتجاوزها.',
    tabs: { runs: 'التشغيلات', mine: 'مهامي', overdue: 'المتأخّر' },
    content: 'المحتوى',
    step: 'المرحلة الحالية',
    status: 'الحالة',
    open: 'فتح',
    start: 'بدء تشغيلة',
    startTitle: 'بدء تشغيلة سير عمل',
    startHint: 'القالب يُختار يدويًا: المحتوى الديني يتبع مسار المراجعة الشرعية لا مسار الحلقة، واستنتاج ذلك من الكوكب سبق أن أخطأ على الكتالوج كله.',
    contentType: 'نوع المحتوى',
    contentId: 'معرّف المحتوى',
    template: 'القالب',
    stages: 'المراحل',
    blocking: 'حاجبة للنشر',
    nonBlocking: 'لا تحجب النشر',
    dependsOn: 'تعتمد على',
    assignee: 'المسؤول',
    due: 'الاستحقاق',
    sla: 'مدة SLA (ساعة)',
    decide: 'قرار',
    assign: 'تعيين',
    assignTitle: 'تعيين مرحلة',
    decisionTitle: 'قرار مرحلة',
    decision: 'القرار',
    comment: 'ملاحظة',
    commentRequired: 'الملاحظة إلزامية للرفض وطلب التعديل والتخطّي.',
    submit: 'تسجيل',
    submitting: 'جارٍ التسجيل…',
    cancel: 'إلغاء',
    history: 'السجل',
    noHistory: 'لا قرارات بعد',
    empty: 'لا تشغيلات سير عمل',
    emptyHint: 'ابدأ تشغيلة من قالب لتُدار المراجعات بمراحل حقيقية.',
    emptyMine: 'لا مراحل مُسنَدة إليك',
    emptyOverdue: 'لا تجاوزات استحقاق',
    loadError: 'تعذر تحميل سير العمل',
    hoursLate: 'ساعة تأخّر',
    escalated: 'مُصعَّد',
    impliedStatus: 'الحالة المستنتجة من المراحل',
    statuses: {
      pending: 'لم تبدأ', in_progress: 'قيد التنفيذ', approved: 'معتمدة',
      rejected: 'مرفوضة', changes_requested: 'طلب تعديلات', skipped: 'مُتخطّاة',
    } as Record<string, string>,
    decisions: {
      approved: 'اعتماد', changes_requested: 'طلب تعديلات', rejected: 'رفض', skipped: 'تخطّي',
    } as Record<WorkflowDecision, string>,
  },
  en: {
    eyebrow: 'Workflow',
    title: 'Workflow centre',
    lede: 'Real stages with assignments, due dates, dependencies and transition authority. Blocking stages actually prevent publication: changing a content status alone does not bypass them.',
    tabs: { runs: 'Runs', mine: 'My stages', overdue: 'Overdue' },
    content: 'Content',
    step: 'Current stage',
    status: 'Status',
    open: 'Open',
    start: 'Start a run',
    startTitle: 'Start a workflow run',
    startHint: 'The template is chosen by a person: Islamic content follows the sharia path, not the episode path, and inferring that from a planet id has already been wrong across the whole catalogue once.',
    contentType: 'Content type',
    contentId: 'Content id',
    template: 'Template',
    stages: 'Stages',
    blocking: 'Blocks publication',
    nonBlocking: 'Does not block publication',
    dependsOn: 'Depends on',
    assignee: 'Assignee',
    due: 'Due',
    sla: 'SLA (hours)',
    decide: 'Decide',
    assign: 'Assign',
    assignTitle: 'Assign a stage',
    decisionTitle: 'Stage decision',
    decision: 'Decision',
    comment: 'Comment',
    commentRequired: 'A comment is required to reject, request changes or skip.',
    submit: 'Submit',
    submitting: 'Submitting…',
    cancel: 'Cancel',
    history: 'History',
    noHistory: 'No decisions yet',
    empty: 'No workflow runs',
    emptyHint: 'Start a run from a template so reviews are managed as real stages.',
    emptyMine: 'No stages assigned to you',
    emptyOverdue: 'No overdue stages',
    loadError: 'Unable to load the workflow',
    hoursLate: 'hours late',
    escalated: 'Escalated',
    impliedStatus: 'Status implied by the stages',
    statuses: {
      pending: 'Not started', in_progress: 'In progress', approved: 'Approved',
      rejected: 'Rejected', changes_requested: 'Changes requested', skipped: 'Skipped',
    } as Record<string, string>,
    decisions: {
      approved: 'Approve', changes_requested: 'Request changes', rejected: 'Reject', skipped: 'Skip',
    } as Record<WorkflowDecision, string>,
  },
}

type Tab = 'runs' | 'mine' | 'overdue'

export function WorkflowPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [tab, setTab] = useState<Tab>('runs')
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [mine, setMine] = useState<WorkflowMyStage[]>([])
  const [overdue, setOverdue] = useState<WorkflowOverdueRow[]>([])
  const [detail, setDetail] = useState<WorkflowRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    setLoading(true)
    setError('')
    try {
      const [runsResponse, templatesResponse, mineResponse, overdueResponse] = await Promise.all([
        api.workflowRuns(),
        api.workflowTemplates(),
        api.workflowMyStages(),
        api.workflowOverdue(),
      ])
      setRuns(runsResponse.data)
      setTemplates(templatesResponse.data)
      setMine(mineResponse.data)
      setOverdue(overdueResponse.data)
      if (!startForm.template_id && templatesResponse.data.length) {
        setStartForm((form) => ({ ...form, template_id: templatesResponse.data[0].id }))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
    // startForm.template_id مقصود استثناؤه: إدراجه يجعل الدالة تتغيّر بعد أول
    // تهيئة فيُعاد التحميل بلا سبب.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  const openRun = useCallback(async (runId: string) => {
    setModalError('')
    try {
      const response = await api.workflowRun(runId)
      setDetail(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }, [text.loadError])

  async function startRun() {
    setSaving(true)
    setModalError('')
    try {
      const response = await api.startWorkflowRun({
        content_type: startForm.content_type.trim(),
        content_id: startForm.content_id.trim(),
        template_id: startForm.template_id,
      })
      setStartOpen(false)
      await load()
      await openRun(response.data.run_id)
    } catch (caught) {
      setModalError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  async function submitDecision() {
    if (!detail || !decisionStage) return
    if (decision !== 'approved' && !comment.trim()) {
      setModalError(text.commentRequired)
      return
    }
    setSaving(true)
    setModalError('')
    try {
      await api.decideWorkflowStage(detail.run.id, decisionStage.stage_key, {
        decision,
        comment: comment.trim() || undefined,
      })
      setDecisionStage(null)
      setComment('')
      await openRun(detail.run.id)
      await load()
    } catch (caught) {
      setModalError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  async function submitAssignment() {
    if (!detail || !assignStage) return
    setSaving(true)
    setModalError('')
    try {
      await api.assignWorkflowStage(detail.run.id, assignStage.stage_key, {
        assignee_id: assignee.trim() || null,
        due_at: dueDate ? `${dueDate}T23:59:59.999Z` : null,
      })
      setAssignStage(null)
      setAssignee('')
      setDueDate('')
      await openRun(detail.run.id)
    } catch (caught) {
      setModalError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => setStartOpen(true)}>
          {text.start}
        </button>
      </section>

      <div className="filters-row">
        {(['runs', 'mine', 'overdue'] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`button ${tab === item ? 'button--primary' : 'button--ghost'}`}
            onClick={() => setTab(item)}
          >
            {text.tabs[item]}
            {item === 'overdue' && overdue.length ? ` (${overdue.length})` : ''}
            {item === 'mine' && mine.length ? ` (${mine.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'runs' && (runs.length ? (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead><tr><th>{text.content}</th><th>{text.step}</th><th>{text.status}</th><th /></tr></thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <span className="table-primary">{run.content_type}</span>
                      <span className="table-secondary" dir="ltr">{run.content_id}</span>
                    </td>
                    <td>{run.current_step ?? '—'}</td>
                    <td><span className="status-badge status-badge--review_edu">{run.status}</span></td>
                    <td>
                      <button className="button button--ghost" type="button" onClick={() => void openRun(run.id)}>
                        {text.open}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : <EmptyState title={text.empty} description={text.emptyHint} />)}

      {tab === 'mine' && (mine.length ? (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.content}</th><th>{text.stages}</th><th>{text.status}</th><th>{text.due}</th><th /></tr></thead>
              <tbody>
                {mine.map((entry) => (
                  <tr key={`${entry.run_id}:${entry.stage_key}`}>
                    <td><span className="table-primary">{entry.content_type}</span><span className="table-secondary" dir="ltr">{entry.content_id}</span></td>
                    <td>{entry.name_ar ?? entry.stage_key}{entry.blocks_publish ? ` · ${text.blocking}` : ''}</td>
                    <td>{text.statuses[entry.status] ?? entry.status}</td>
                    <td dir="ltr">{entry.due_at?.slice(0, 16).replace('T', ' ') ?? '—'}</td>
                    <td><button className="button button--ghost" type="button" onClick={() => void openRun(entry.run_id)}>{text.open}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : <EmptyState title={text.emptyMine} description={text.tabs.mine} />)}

      {tab === 'overdue' && (overdue.length ? (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.content}</th><th>{text.stages}</th><th>{text.due}</th><th /><th /></tr></thead>
              <tbody>
                {overdue.map((entry) => (
                  <tr key={`${entry.run_id}:${entry.stage_key}`}>
                    <td><span className="table-primary">{entry.content_type}</span><span className="table-secondary" dir="ltr">{entry.content_id}</span></td>
                    <td>{entry.name_ar ?? entry.stage_key}</td>
                    <td dir="ltr">{entry.due_at?.slice(0, 16).replace('T', ' ') ?? '—'}</td>
                    <td>
                      {entry.hours_late} {text.hoursLate}
                      {entry.escalated ? ` · ${text.escalated}` : ''}
                    </td>
                    <td><button className="button button--ghost" type="button" onClick={() => void openRun(entry.run_id)}>{text.open}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : <EmptyState title={text.emptyOverdue} description={text.tabs.overdue} />)}

      {detail && (
        <Modal
          open
          title={`${detail.run.content_type} · ${detail.run.content_id}`}
          description={`${text.impliedStatus}: ${detail.implied_status}`}
          onClose={() => setDetail(null)}
        >
          <ul className="readiness-list">
            {detail.stages.map((stage) => {
              const state = stage.run_stage
              const status = state?.status ?? 'pending'
              const visual = status === 'approved' ? 'pass'
                : status === 'rejected' || status === 'changes_requested' ? 'blocked'
                  : status === 'skipped' ? 'not_applicable' : 'warn'
              return (
                <li key={stage.stage_key} className={`readiness-item readiness-item--${visual}`}>
                  <div className="readiness-item__head">
                    <span className="readiness-item__label">{stage.name_ar}</span>
                    <span className="readiness-item__owner">
                      {text.statuses[status] ?? status}
                      {stage.blocks_publish ? ` · ${text.blocking}` : ` · ${text.nonBlocking}`}
                    </span>
                  </div>
                  {stage.instructions_ar && <p className="readiness-item__detail">{stage.instructions_ar}</p>}
                  <p className="readiness-item__detail" dir="ltr">
                    {stage.depends_on.length ? `${text.dependsOn}: ${stage.depends_on.join(', ')}` : ''}
                    {stage.sla_hours ? ` · ${text.sla}: ${stage.sla_hours}` : ''}
                    {state?.assignee_id ? ` · ${text.assignee}: ${state.assignee_id}` : ''}
                    {state?.due_at ? ` · ${text.due}: ${state.due_at.slice(0, 10)}` : ''}
                  </p>
                  {state?.decision_comment && <p className="readiness-item__detail">{state.decision_comment}</p>}
                  {/* السبب من الخادم لا من الواجهة: الزر المعطَّل يقول سببه. */}
                  {!stage.can_decide && stage.refusal_reason && (
                    <p className="readiness-item__action">{stage.refusal_reason}</p>
                  )}
                  <div className="form-actions">
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => { setAssignStage(stage); setAssignee(state?.assignee_id ?? ''); setDueDate(state?.due_at?.slice(0, 10) ?? ''); setModalError('') }}
                    >
                      {text.assign}
                    </button>
                    <button
                      className="button button--primary"
                      type="button"
                      disabled={!stage.can_decide}
                      title={stage.can_decide ? undefined : stage.refusal_reason ?? undefined}
                      onClick={() => { setDecisionStage(stage); setDecision('approved'); setComment(''); setModalError('') }}
                    >
                      {text.decide}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <details className="readiness-group">
            <summary>{text.history}</summary>
            {detail.history.length ? (
              <ul className="readiness-list">
                {detail.history.map((entry) => (
                  <li key={entry.id} className="readiness-item readiness-item--not_applicable">
                    <div className="readiness-item__head">
                      <span className="readiness-item__label">{entry.step} · {entry.decision}</span>
                      <span className="readiness-item__owner" dir="ltr">
                        {entry.reviewer_name ?? entry.reviewer_id ?? '—'} · {entry.created_at.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    {entry.comment && <p className="readiness-item__detail">{entry.comment}</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="readiness-note">{text.noHistory}</p>}
          </details>
        </Modal>
      )}

      {startOpen && (
        <Modal open title={text.startTitle} description={text.startHint} onClose={() => setStartOpen(false)}>
          <div className="entity-form">
            {modalError && <p className="inline-alert inline-alert--error" role="alert">{modalError}</p>}
            <div className="form-grid">
              <label className="field">
                <span>{text.contentType}</span>
                <input value={startForm.content_type} dir="ltr" onChange={(event) => setStartForm({ ...startForm, content_type: event.target.value })} />
              </label>
              <label className="field">
                <span>{text.contentId}</span>
                <input value={startForm.content_id} dir="ltr" onChange={(event) => setStartForm({ ...startForm, content_id: event.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>{text.template}</span>
              <select value={startForm.template_id} onChange={(event) => setStartForm({ ...startForm, template_id: event.target.value })}>
                {templates.map((template) => (
                  <option value={template.id} key={template.id}>
                    {template.name_ar} ({template.stages.length})
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setStartOpen(false)}>{text.cancel}</button>
              <button className="button button--primary" type="button" disabled={saving || !startForm.content_id.trim()} onClick={() => void startRun()}>
                {saving ? text.submitting : text.submit}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {decisionStage && (
        <Modal open title={`${text.decisionTitle} — ${decisionStage.name_ar}`} onClose={() => setDecisionStage(null)}>
          <div className="entity-form">
            {modalError && <p className="inline-alert inline-alert--error" role="alert">{modalError}</p>}
            <label className="field">
              <span>{text.decision}</span>
              <select value={decision} onChange={(event) => setDecision(event.target.value as WorkflowDecision)}>
                {DECISIONS.map((value) => <option value={value} key={value}>{text.decisions[value]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.comment}</span>
              <textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
              <small>{text.commentRequired}</small>
            </label>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setDecisionStage(null)}>{text.cancel}</button>
              <button className="button button--primary" type="button" disabled={saving} onClick={() => void submitDecision()}>
                {saving ? text.submitting : text.submit}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {assignStage && (
        <Modal open title={`${text.assignTitle} — ${assignStage.name_ar}`} onClose={() => setAssignStage(null)}>
          <div className="entity-form">
            {modalError && <p className="inline-alert inline-alert--error" role="alert">{modalError}</p>}
            <div className="form-grid">
              <label className="field">
                <span>{text.assignee}</span>
                <input value={assignee} dir="ltr" onChange={(event) => setAssignee(event.target.value)} />
              </label>
              <label className="field date-field">
                <span>{text.due}</span>
                <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
            </div>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setAssignStage(null)}>{text.cancel}</button>
              <button className="button button--primary" type="button" disabled={saving} onClick={() => void submitAssignment()}>
                {saving ? text.submitting : text.submit}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
