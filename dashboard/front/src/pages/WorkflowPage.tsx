import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { WorkflowRunRecord } from '../types/api'

/**
 * سير عمل المحتوى: تشغيلات المراجعة وقراراتها.
 *
 * ## ما كانت عليه
 *
 * `.catch()` كان يضع **تشغيلين مخترعين** (`wf-1` و`wf-2`). والأسوأ أن زر
 * «مراجعة» على هذين الصفّين يُرسل قرارًا إلى `/workflows/runs/wf-1/review`
 * لمعرّف لا وجود له، ثم يُنادي `location.reload()` بلا فحص الاستجابة — فيبدو
 * القرار كأنه سُجّل.
 *
 * القرار كان يُجمَع بـ`prompt()` نصيّ يطلب من المستخدم كتابة
 * `approved/rejected/changes_requested` حرفيًا، فأي خطأ مطبعي يُرسَل كقرار.
 *
 * ## ما صارت عليه
 *
 * القرار يُختار من أزرار محدّدة لا نصّ حرّ، والاستجابة تُفحَص، والفشل يظهر.
 */

const DECISIONS = ['approved', 'changes_requested', 'rejected'] as const
type Decision = typeof DECISIONS[number]

const copy = {
  ar: {
    eyebrow: 'سير العمل',
    title: 'سجل قرارات المراجعة',
    lede: 'يسجل هذا السجل قرارات المراجعة للخطوة المخزنة. لا ينشئ تشغيلات، ولا يقدّم أو يعتمد أو يجدول أو ينشر المحتوى.',
    content: 'المحتوى',
    step: 'الخطوة',
    status: 'الحالة',
    reviews: 'المراجعات',
    actions: 'إجراءات',
    review: 'تسجيل مراجعة',
    reviewTitle: 'تسجيل قرار مراجعة',
    reviewFor: 'المحتوى',
    currentStep: 'الخطوة الحالية',
    decision: 'القرار',
    note: 'ملاحظة (اختيارية)',
    submit: 'تسجيل القرار',
    submitting: 'جارٍ التسجيل…',
    cancel: 'إلغاء',
    recorded: 'سُجّل القرار',
    empty: 'لا تشغيلات سير عمل',
    emptyHint: 'لا ينشئ النظام التشغيلات أو يقدّم المحتوى للمراجعة من هذه الصفحة.',
    loadError: 'تعذر تحميل التشغيلات',
    decisions: {
      approved: 'اعتماد',
      changes_requested: 'طلب تعديلات',
      rejected: 'رفض',
    } as Record<Decision, string>,
  },
  en: {
    eyebrow: 'Workflow',
    title: 'Review decision records',
    lede: 'This register records decisions for the stored step only. It does not create runs, advance or approve workflows, schedule, or publish content.',
    content: 'Content',
    step: 'Step',
    status: 'Status',
    reviews: 'Reviews',
    actions: 'Actions',
    review: 'Record review',
    reviewTitle: 'Record review decision',
    reviewFor: 'Content',
    currentStep: 'Current step',
    decision: 'Decision',
    note: 'Note (optional)',
    submit: 'Record decision',
    submitting: 'Recording…',
    cancel: 'Cancel',
    recorded: 'Decision recorded',
    empty: 'No workflow runs',
    emptyHint: 'This page does not create runs or submit content for review.',
    loadError: 'Unable to load runs',
    decisions: {
      approved: 'Approve',
      changes_requested: 'Request changes',
      rejected: 'Reject',
    } as Record<Decision, string>,
  },
}

export function WorkflowPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [runs, setRuns] = useState<WorkflowRunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<WorkflowRunRecord | null>(null)
  const [decision, setDecision] = useState<Decision>('approved')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.workflowRuns()
      setRuns(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  function openReview(run: WorkflowRunRecord) {
    setSelected(run)
    setDecision('approved')
    setNote('')
    setModalError('')
  }

  async function submitReview() {
    if (!selected) return
    setSaving(true)
    setModalError('')
    try {
      await api.reviewWorkflowRun(selected.id, {
        decision,
        comment: note.trim() || undefined,
      })
      setSelected(null)
      setNotice(text.recorded)
      // إعادة تحميل البيانات لا الصفحة: location.reload() كان يخفي أي خطأ
      await load()
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
      </section>

      {notice ? <section className="panel panel--notice" role="status">{notice}</section> : null}

      {runs.length ? (
        <section className="panel panel--table">
          <div className="table-scroll">
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.content}</th>
                  <th>{text.step}</th>
                  <th>{text.status}</th>
                  <th>{text.reviews}</th>
                  <th>{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <span className="table-primary">{run.content_type}</span>
                      <span className="table-secondary" dir="ltr">{run.content_id}</span>
                    </td>
                    <td>{run.current_step ?? '—'}</td>
                    <td>
                      <span className="status-badge status-badge--review_edu">
                        {run.status}
                      </span>
                    </td>
                    <td><span className="table-secondary">{Number(run.reviews_count ?? 0)}</span></td>
                    <td>
                      {run.status === 'running' ? (
                        <button className="button button--ghost" type="button" onClick={() => openReview(run)}>
                          {text.review}
                        </button>
                      ) : <span className="table-secondary">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState title={text.empty} description={text.emptyHint} />
      )}

      {selected ? (
        <Modal open title={text.reviewTitle} onClose={() => setSelected(null)}>
          <div className="entity-form">
            <dl className="detail-list">
              <div>
                <dt>{text.reviewFor}</dt>
                <dd dir="ltr">{selected.content_type} · {selected.content_id}</dd>
              </div>
              <div>
                <dt>{text.currentStep}</dt>
                <dd>{selected.current_step ?? '—'}</dd>
              </div>
            </dl>

            <label className="field">
              <span>{text.decision}</span>
              {/* أزرار محدّدة لا نصّ حرّ: prompt() كان يقبل أي خطأ مطبعي كقرار */}
              <select value={decision} onChange={(event) => setDecision(event.target.value as Decision)}>
                {DECISIONS.map((value) => (
                  <option value={value} key={value}>{text.decisions[value]}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{text.note}</span>
              <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>

            {modalError ? <p className="form-error" role="alert">{modalError}</p> : null}

            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setSelected(null)}>
                {text.cancel}
              </button>
              <button className="button button--primary" type="button" disabled={saving} onClick={() => void submitReview()}>
                {saving ? text.submitting : text.submit}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
