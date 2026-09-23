import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'

const copy = {
  ar: {
    back: 'العودة لبنك الأسئلة',
    loading: 'جارٍ تحميل مساحة عمل السؤال…',
    loadError: 'تعذر تحميل السؤال التقييمي',
    tabs: {
      overview: 'نظرة عامة ومعاينة',
      authoring: 'هيكل السؤال',
      answers: 'الإجابات والبدائل',
      media: 'الوسائط المرتبطة',
      learning: 'الهدف التعليمي',
      localization: 'الترجمات',
      usage: 'مواضع الاستخدام',
      reviews: 'سجل المراجعات',
      history: 'تاريخ النسخ',
    },
    preview: 'معاينة السؤال التفاعلية',
    prompt: 'نص السؤال',
    correct: 'الإجابة الصحيحة',
    distractors: 'المشتتات والخيارات',
    explanation: 'الشرح التوضيحي',
    status: 'الحالة',
    version: 'النسخة',
    objective: 'الهدف',
    skill: 'المهارة',
    edit: 'تعديل السؤال',
    submitReview: 'إرسال للمراجعة',
    approve: 'اعتماد ونشر',
    reject: 'رفض',
    needsChanges: 'طلب تعديلات',
    noMedia: 'لا توجد وسائط مرتبطة',
    usageTitle: 'استخدام السؤال في الألعاب والقصص',
    reviewsTitle: 'المراجعات التربوية',
    historyTitle: 'سجل تدقيق التغييرات',
    save: 'حفظ التعديلات',
    cancel: 'إلغاء',
    mediaHint: 'اختر أصلاً من مكتبة الوسائط المعتمدة — لا تستخدم مسارات خام',
  },
  en: {
    back: 'Back to Bank',
    loading: 'Loading question…',
    loadError: 'Unable to load question',
    tabs: {
      overview: 'Overview & Preview',
      authoring: 'Structure',
      answers: 'Answers & Distractors',
      media: 'Media',
      learning: 'Learning',
      localization: 'Translations',
      usage: 'Usage',
      reviews: 'Reviews',
      history: 'History',
    },
    preview: 'Interactive Preview',
    prompt: 'Prompt',
    correct: 'Correct Answer',
    distractors: 'Distractors',
    explanation: 'Explanation',
    status: 'Status',
    version: 'Version',
    objective: 'Objective',
    skill: 'Skill',
    edit: 'Edit Question',
    submitReview: 'Submit for Review',
    approve: 'Approve & Publish',
    reject: 'Reject',
    needsChanges: 'Needs Changes',
    noMedia: 'No media linked',
    usageTitle: 'Usage in Games & Stories',
    reviewsTitle: 'Educational Reviews',
    historyTitle: 'Change Audit Log',
    save: 'Save Changes',
    cancel: 'Cancel',
    mediaHint: 'Choose an asset from Media Library — avoid raw storage keys',
  },
}

export function QuestionWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState<keyof typeof text.tabs>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.question(id)
      setData(res.data)
      setForm({
        prompt_ar: res.data.prompt_ar,
        correct_answer: res.data.correct_answer,
        distractors: res.data.distractors,
        explanation_ar: res.data.explanation_ar,
        media_asset_id: res.data.media_asset_id,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    setFormError('')
    try {
      await api.updateQuestion(id, {
        prompt_ar: form.prompt_ar,
        correct_answer: form.correct_answer,
        distractors: form.distractors,
        explanation_ar: form.explanation_ar,
        media_asset_id: form.media_asset_id,
      })
      setEditOpen(false)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'تعذر حفظ التعديل')
    } finally {
      setSaving(false)
    }
  }

  async function review(status: string) {
    try {
      await api.reviewQuestion(id, { status, reviewer_role: 'edu' })
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشلت المراجعة')
    }
  }

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return <EmptyState title={text.loadError} description={id} />

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, rgba(99, 102, 241, 0.1) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">
              {data.code} · {data.type}
            </span>
            <span
              className="catalog-hero__status-badge"
              style={{
                borderColor: data.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                color: data.status === 'approved' ? '#10b981' : '#f59e0b',
              }}
            >
              <span
                className="status-dot-pulse"
                style={{ background: data.status === 'approved' ? '#10b981' : '#f59e0b' }}
              />
              الحالة: {data.status} · الإصدار {data.version}
            </span>
          </div>
          <h1 className="catalog-hero__title" style={{ fontSize: 24 }}>
            {data.prompt_ar}
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            <span>
              {text.objective}:{' '}
              <Link
                to={adminPath(`objectives/${data.learning_objective_id}`)}
                style={{ color: 'var(--primary)', fontWeight: 700 }}
              >
                {data.objective_code ?? 'هدف غير محدد'}
              </Link>
            </span>
          </div>
        </div>
        <div className="catalog-hero__actions">
          <Link className="button button--secondary" to={adminPath('quiz')} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="chevron-left" size={14} />
            <span>{text.back}</span>
          </Link>
          <button className="cs-btn-primary" onClick={() => setEditOpen(true)}>
            <Icon name="edit" size={15} />
            <span>{text.edit}</span>
          </button>
        </div>
      </section>

      {/* 2. Detail tabs */}
      <div className="detail-tabs" role="tablist" style={{ margin: '20px 0 16px' }}>
        {(Object.keys(text.tabs) as Array<keyof typeof text.tabs>).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={`detail-tab ${tab === k ? 'detail-tab--active' : ''}`}
            onClick={() => setTab(k)}
          >
            {text.tabs[k]}
          </button>
        ))}
      </div>

      {/* 3. Tab contents */}
      {tab === 'overview' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{text.preview}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="button button--ghost button--small" onClick={() => review('pending')}>
                  {text.submitReview}
                </button>
                <button
                  className="button button--primary button--small"
                  style={{ background: '#10b981', borderColor: '#10b981' }}
                  onClick={() => review('approved')}
                >
                  <Icon name="check" size={13} />
                  <span>{text.approve}</span>
                </button>
                <button
                  className="button button--ghost button--small"
                  style={{ color: '#f87171' }}
                  onClick={() => review('rejected')}
                >
                  {text.reject}
                </button>
              </div>
            </div>

            <div
              style={{
                border: '1px solid var(--cs-glass-border)',
                borderRadius: 16,
                padding: 22,
                background: 'var(--surface-2)',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>
                {data.prompt_ar}
              </div>

              {data.type === 'MULTIPLE_CHOICE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[data.correct_answer?.value, ...(Array.isArray(data.distractors) ? data.distractors : [])].map(
                    (opt: string, i: number) => (
                      <div
                        key={i}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 10,
                          background: i === 0 ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-3)',
                          border: i === 0 ? '1px solid #10b981' : '1px solid var(--cs-glass-border)',
                          color: i === 0 ? '#10b981' : 'var(--text)',
                          fontWeight: i === 0 ? 800 : 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{opt}</span>
                        {i === 0 && <span style={{ fontSize: 12, fontWeight: 800 }}>✓ الإجابة المعتمدة</span>}
                      </div>
                    ),
                  )}
                </div>
              )}

              {data.type === 'TRUE_FALSE' && (
                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                  <strong>الإجابة المعتمدة:</strong> {data.correct_answer?.value === 'true' ? 'صح' : 'خطأ'}
                </div>
              )}

              {data.type === 'ORDERING' && (
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--surface-3)' }}>
                  <strong>الترتيب الصحيح:</strong>{' '}
                  {Array.isArray(data.correct_answer?.items) ? data.correct_answer.items.join(' ← ') : '—'}
                </div>
              )}

              {data.explanation_ar && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 10,
                    background: 'rgba(99, 102, 241, 0.08)',
                    color: 'var(--text-soft)',
                    fontSize: 13,
                  }}
                >
                  <strong style={{ color: '#818cf8', display: 'block', marginBottom: 2 }}>الشرح التوضيحي للطفل:</strong>
                  {data.explanation_ar}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === 'learning' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ margin: '0 0 16px' }}>الهدف التعليمي والمهارة</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p>
              <strong>الهدف المرتبط:</strong>{' '}
              <Link to={adminPath(`objectives/${data.learning_objective_id}`)}>{data.objective_code}</Link>
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              الفئة العمرية المستهدفة: {data.age_min}–{data.age_max} سنة · مستوى الصعوبة: {data.difficulty}
            </p>
          </div>
        </section>
      )}

      {tab === 'reviews' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ margin: '0 0 16px' }}>{text.reviewsTitle}</h3>
          {data.reviews?.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>الدور التربوي</th>
                  <th>الحالة</th>
                  <th>التعليق</th>
                </tr>
              </thead>
              <tbody>
                {data.reviews.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.reviewer_role}</td>
                    <td>{r.status}</td>
                    <td>{r.comments ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--muted)' }}>لا توجد مراجعات سابقة مسجلة على هذا السؤال.</p>
          )}
        </section>
      )}

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={text.edit}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field">
            <span>نص السؤال</span>
            <textarea
              rows={2}
              value={form.prompt_ar}
              onChange={(e) => setForm({ ...form, prompt_ar: e.target.value })}
            />
          </label>
          <label className="field">
            <span>الإجابة الصحيحة (JSON)</span>
            <input
              value={JSON.stringify(form.correct_answer)}
              onChange={(e) => {
                try {
                  setForm({ ...form, correct_answer: JSON.parse(e.target.value) })
                } catch {
                  setForm({ ...form, correct_answer: { value: e.target.value } })
                }
              }}
            />
          </label>
          <label className="field">
            <span>المشتتات والبدائل الخاطئة</span>
            <input
              value={Array.isArray(form.distractors) ? form.distractors.join(', ') : JSON.stringify(form.distractors)}
              onChange={(e) =>
                setForm({
                  ...form,
                  distractors: e.target.value
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="field">
            <span>الشرح والتغذية الراجعة</span>
            <textarea
              rows={2}
              value={form.explanation_ar ?? ''}
              onChange={(e) => setForm({ ...form, explanation_ar: e.target.value })}
            />
          </label>
          <div className="form-actions">
            <button className="button button--ghost" onClick={() => setEditOpen(false)}>
              {text.cancel}
            </button>
            <button className="button button--primary" disabled={saving} onClick={save}>
              {saving ? 'جارٍ الحفظ...' : text.save}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
