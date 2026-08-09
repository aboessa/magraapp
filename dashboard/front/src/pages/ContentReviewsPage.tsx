import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { formatDate, formatNumber } from '../lib/labels'
import type {
  ContentReviewRecord,
  ReviewEntityType,
  ReviewStatus,
  ReviewerRole,
} from '../types/api'

/**
 * مراجعات المحتوى.
 *
 * ## لماذا كانت هذه الصفحة غائبة
 *
 * `GET/POST/PATCH/DELETE /admin/content-reviews` موجودة في adminCatalogue.ts،
 * وهي المسار الذي يفرض فصل الإنشاء عن الاعتماد (`checkSelfApproval`). لم يكن
 * لها أي مستدعٍ في الواجهة، فكان عنصر «مراجعات المحتوى» في القائمة معطَّلًا
 * بلافتة «قريبًا» مع أن الخادم يفرض القاعدة بالفعل.
 *
 * ## ثلاث قواعد من الخادم تُحترم هنا
 *
 * ١. **`story` ليس نوعًا قابلًا للمراجعة.** الـCHECK في D1 هو
 *    `entity_type IN ('series','episode','book','game','project')`، فصفّ مراجعة
 *    لقصة يفشل القيد. القائمة هنا تطابق القيد ولا تعرض «قصة».
 *
 * ٢. **التعليق إلزامي عند الرفض أو طلب التعديل.** الخادم يرفض بـ400 لأن رفضًا
 *    بلا سبب غير قابل للتنفيذ من المحرّر. يُمنع الإرسال هنا بدل انتظار الرفض.
 *
 * ٣. **`reviewer_id` لا يُنتحل.** الاعتماد يُرفض بـ409 إذا كان المُعتمِد آخر من
 *    عدّل المحتوى. الحقل متروك للخادم في الاعتماد، وسبب الرفض يُعرض كما ورد.
 */

const ENTITY_TYPES: ReviewEntityType[] = ['series', 'episode', 'book', 'game', 'project']
const REVIEWER_ROLES: ReviewerRole[] = ['edu', 'lang', 'sharia', 'rights', 'qa']
const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected', 'needs_changes']

/// الحالتان اللتان يشترط الخادم معهما تعليقًا
const COMMENT_REQUIRED: ReviewStatus[] = ['rejected', 'needs_changes']

const entityLabels: Record<'ar' | 'en', Record<ReviewEntityType, string>> = {
  ar: { series: 'سلسلة', episode: 'حلقة', book: 'كتاب', game: 'لعبة', project: 'مشروع' },
  en: { series: 'Series', episode: 'Episode', book: 'Book', game: 'Game', project: 'Project' },
}

const roleLabels: Record<'ar' | 'en', Record<ReviewerRole, string>> = {
  ar: { edu: 'تعليمية', lang: 'لغوية', sharia: 'شرعية', rights: 'حقوق', qa: 'جودة' },
  en: { edu: 'Educational', lang: 'Language', sharia: 'Values', rights: 'Rights', qa: 'Quality' },
}

const statusLabels: Record<'ar' | 'en', Record<ReviewStatus, string>> = {
  ar: { pending: 'قيد الانتظار', approved: 'معتمد', rejected: 'مرفوض', needs_changes: 'يحتاج تعديلًا' },
  en: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', needs_changes: 'Needs changes' },
}

/// تعيين حالة المراجعة إلى صنف شارة الحالة الموجود في dashboard.css
const statusBadge: Record<ReviewStatus, string> = {
  pending: 'status-badge--review',
  approved: 'status-badge--published',
  rejected: 'status-badge--archived',
  needs_changes: 'status-badge--draft',
}

const copy = {
  ar: {
    eyebrow: 'ضبط الجودة',
    title: 'مراجعات المحتوى',
    intro: 'سجل قرارات المراجعة لكل قطعة محتوى. من عدّل المحتوى لا يعتمده — قاعدة يفرضها الخادم.',
    add: 'مراجعة جديدة',
    refresh: 'تحديث',
    list: 'المراجعات',
    total: 'الإجمالي',
    allTypes: 'كل الأنواع',
    allRoles: 'كل أنواع المراجعة',
    allStatuses: 'كل الحالات',
    entity: 'المحتوى',
    role: 'نوع المراجعة',
    status: 'الحالة',
    reviewer: 'المراجع',
    comments: 'الملاحظات',
    created: 'التاريخ',
    edit: 'تعديل',
    remove: 'حذف',
    create: 'تسجيل مراجعة',
    editTitle: 'تعديل المراجعة',
    entityTypeField: 'نوع المحتوى *',
    entityIdField: 'معرّف المحتوى *',
    entityIdHint: 'يتحقّق الخادم من وجوده قبل الحفظ.',
    roleField: 'نوع المراجعة *',
    statusField: 'الحالة *',
    reviewerField: 'معرّف المراجع',
    reviewerHint: 'يُترك فارغًا عادةً: هوية الجلسة هي المرجع في الاعتماد.',
    commentsField: 'الملاحظات',
    commentsRequired: 'الملاحظات *',
    commentsHint: 'إلزامية عند الرفض أو طلب التعديل.',
    cancel: 'إلغاء',
    save: 'حفظ',
    required: 'نوع المحتوى ومعرّفه مطلوبان.',
    commentsMissing: 'الملاحظات إلزامية عند الرفض أو طلب التعديل.',
    loading: 'جارٍ تحميل المراجعات...',
    loadError: 'تعذر تحميل المراجعات',
    saveError: 'تعذر حفظ المراجعة',
    empty: 'لا مراجعات بعد',
    emptyDesc: 'سجّل أول مراجعة لسلسلة أو حلقة أو كتاب أو لعبة أو مشروع.',
    confirmRemove: 'سيُحذف صفّ المراجعة نهائيًا. متابعة؟',
    storyNote: 'القصص غير مدرجة: قيد قاعدة البيانات يقصر المراجعة على السلاسل والحلقات والكتب والألعاب والمشروعات.',
  },
  en: {
    eyebrow: 'Quality control',
    title: 'Content reviews',
    intro: 'The review decision log for each content item. Whoever edited the content cannot approve it — a rule the server enforces.',
    add: 'New review',
    refresh: 'Refresh',
    list: 'Reviews',
    total: 'Total',
    allTypes: 'All types',
    allRoles: 'All review types',
    allStatuses: 'All statuses',
    entity: 'Content',
    role: 'Review type',
    status: 'Status',
    reviewer: 'Reviewer',
    comments: 'Comments',
    created: 'Date',
    edit: 'Edit',
    remove: 'Delete',
    create: 'Record review',
    editTitle: 'Edit review',
    entityTypeField: 'Content type *',
    entityIdField: 'Content id *',
    entityIdHint: 'The server verifies it exists before saving.',
    roleField: 'Review type *',
    statusField: 'Status *',
    reviewerField: 'Reviewer id',
    reviewerHint: 'Usually left blank: the session identity is authoritative on approval.',
    commentsField: 'Comments',
    commentsRequired: 'Comments *',
    commentsHint: 'Mandatory when rejecting or requesting changes.',
    cancel: 'Cancel',
    save: 'Save',
    required: 'Content type and id are required.',
    commentsMissing: 'Comments are mandatory when rejecting or requesting changes.',
    loading: 'Loading reviews...',
    loadError: 'Unable to load reviews',
    saveError: 'Unable to save review',
    empty: 'No reviews yet',
    emptyDesc: 'Record the first review for a series, episode, book, game or project.',
    confirmRemove: 'This review row will be permanently deleted. Continue?',
    storyNote: 'Stories are not listed: the database constraint limits reviews to series, episodes, books, games and projects.',
  },
}

type ReviewForm = {
  entity_type: ReviewEntityType
  entity_id: string
  reviewer_role: ReviewerRole
  reviewer_id: string
  status: ReviewStatus
  comments: string
}

const emptyForm: ReviewForm = {
  entity_type: 'series',
  entity_id: '',
  reviewer_role: 'edu',
  reviewer_id: '',
  status: 'pending',
  comments: '',
}

export function ContentReviewsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [records, setRecords] = useState<ContentReviewRecord[]>([])
  const [total, setTotal] = useState(0)
  const [entityType, setEntityType] = useState('')
  const [reviewerRole, setReviewerRole] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ReviewForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.contentReviews({
        entity_type: entityType,
        reviewer_role: reviewerRole,
        status,
        limit: 100,
      })
      setRecords(response.data)
      setTotal(response.meta?.total ?? response.data.length)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [entityType, reviewerRole, status, text.loadError])

  useEffect(() => { void load() }, [load])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item: ContentReviewRecord) {
    setEditingId(item.id)
    setForm({
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      reviewer_role: item.reviewer_role,
      reviewer_id: item.reviewer_id ?? '',
      status: item.status,
      comments: item.comments ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const commentsRequired = COMMENT_REQUIRED.includes(form.status)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const entityId = form.entity_id.trim()
    const comments = form.comments.trim()
    if (!entityId) { setFormError(text.required); return }
    // نفس شرط الخادم: رفض أو طلب تعديل بلا سبب غير قابل للتنفيذ
    if (commentsRequired && !comments) { setFormError(text.commentsMissing); return }

    setSaving(true)
    setFormError('')
    try {
      if (editingId) {
        await api.updateContentReview(editingId, {
          reviewer_role: form.reviewer_role,
          status: form.status,
          reviewer_id: form.reviewer_id.trim() || null,
          comments: comments || null,
        })
      } else {
        await api.createContentReview({
          entity_type: form.entity_type,
          entity_id: entityId,
          reviewer_role: form.reviewer_role,
          status: form.status,
          reviewer_id: form.reviewer_id.trim() || null,
          comments: comments || null,
        })
      }
      setModalOpen(false)
      await load()
    } catch (caught) {
      // 409 هنا يعني فصل المهام: المُعتمِد هو آخر من عدّل المحتوى.
      // الرسالة تُعرض كما وردت لأنها تشرح القاعدة بالعربية.
      setFormError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: ContentReviewRecord) {
    if (!window.confirm(text.confirmRemove)) return
    try {
      await api.deleteContentReview(item.id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.saveError)
    }
  }

  if (loading && !records.length) return <LoadingState label={text.loading} />
  if (error && !records.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--secondary" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={17} />{text.refresh}
          </button>
          <button className="button button--primary" type="button" onClick={openCreate}>
            <Icon name="plus" size={17} />{text.add}
          </button>
        </div>
      </section>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{text.list}</span>
            <h3>{text.total} <span className="title-count">{formatNumber(total, locale)}</span></h3>
          </div>
          <div className="filters-row">
            <select value={entityType} onChange={(event) => setEntityType(event.target.value)}>
              <option value="">{text.allTypes}</option>
              {ENTITY_TYPES.map((item) => <option value={item} key={item}>{entityLabels[locale][item]}</option>)}
            </select>
            <select value={reviewerRole} onChange={(event) => setReviewerRole(event.target.value)}>
              <option value="">{text.allRoles}</option>
              {REVIEWER_ROLES.map((item) => <option value={item} key={item}>{roleLabels[locale][item]}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{text.allStatuses}</option>
              {REVIEW_STATUSES.map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}
            </select>
          </div>
        </header>

        {records.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.entity}</th>
                  <th>{text.role}</th>
                  <th>{text.status}</th>
                  <th>{text.reviewer}</th>
                  <th>{text.comments}</th>
                  <th>{text.created}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="entity-cell">
                        <span className="entity-avatar"><Icon name="reviews" size={18} /></span>
                        <div>
                          <strong>{entityLabels[locale][item.entity_type]}</strong>
                          <small dir="ltr">{item.entity_id}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="track-badge">{roleLabels[locale][item.reviewer_role]}</span></td>
                    <td>
                      <span className={`status-badge ${statusBadge[item.status]}`}>
                        {statusLabels[locale][item.status]}
                      </span>
                    </td>
                    <td>
                      {item.reviewer_id
                        ? <span className="table-secondary" dir="ltr">{item.reviewer_id}</span>
                        : <span className="table-secondary">—</span>}
                    </td>
                    <td><span className="table-secondary">{item.comments || '—'}</span></td>
                    <td>{formatDate(item.created_at, locale)}</td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-button icon-button--small" type="button" title={text.edit} onClick={() => openEdit(item)}>
                          <Icon name="edit" size={15} />
                        </button>
                        <button className="icon-button icon-button--small icon-button--danger" type="button" title={text.remove} onClick={() => void remove(item)}>
                          <Icon name="archive" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title={text.empty} description={text.emptyDesc} />}
      </section>

      {/* حدّ قاعدة البيانات يُعلَن بدل أن يُكتشف عند فشل الحفظ */}
      <section className="panel panel--notice">
        <strong>{text.eyebrow}</strong>
        <p>{text.storyNote}</p>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? text.editTitle : text.create}
      >
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>{text.entityTypeField}</span>
              <select
                value={form.entity_type}
                // نوع المحتوى ومعرّفه لا يُعدَّلان بعد الإنشاء: تغييرهما يعني
                // مراجعة أخرى لا تعديل هذه
                disabled={Boolean(editingId)}
                onChange={(event) => setForm({ ...form, entity_type: event.target.value as ReviewEntityType })}
              >
                {ENTITY_TYPES.map((item) => <option value={item} key={item}>{entityLabels[locale][item]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.entityIdField}</span>
              <input
                autoFocus
                dir="ltr"
                value={form.entity_id}
                disabled={Boolean(editingId)}
                onChange={(event) => setForm({ ...form, entity_id: event.target.value })}
              />
              <small>{text.entityIdHint}</small>
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>{text.roleField}</span>
              <select value={form.reviewer_role} onChange={(event) => setForm({ ...form, reviewer_role: event.target.value as ReviewerRole })}>
                {REVIEWER_ROLES.map((item) => <option value={item} key={item}>{roleLabels[locale][item]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.statusField}</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ReviewStatus })}>
                {REVIEW_STATUSES.map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}
              </select>
            </label>
          </div>

          <label className="field">
            <span>{text.reviewerField}</span>
            <input dir="ltr" value={form.reviewer_id} onChange={(event) => setForm({ ...form, reviewer_id: event.target.value })} />
            <small>{text.reviewerHint}</small>
          </label>

          <label className="field">
            <span>{commentsRequired ? text.commentsRequired : text.commentsField}</span>
            <textarea rows={4} value={form.comments} onChange={(event) => setForm({ ...form, comments: event.target.value })} />
            <small>{text.commentsHint}</small>
          </label>

          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setModalOpen(false)}>{text.cancel}</button>
            <button className="button button--primary" type="submit" disabled={saving}>{text.save}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
