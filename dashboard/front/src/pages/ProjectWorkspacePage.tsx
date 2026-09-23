import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EntityHeader } from '../components/EntityHeader'
import { DetailTabs } from '../components/DetailTabs'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { Icon } from '../components/Icon'
import { TimelineView } from '../components/DataViews'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { ContentStatus, ProjectDetail, ProjectPayload, SupervisionLevel } from '../types/api'

const TABS = ['overview', 'steps', 'materials', 'learning', 'safety', 'media', 'localization', 'production', 'workflow', 'downloads', 'analytics', 'history'] as const
type TabKey = typeof TABS[number]

const copy = {
  ar: {
    breadcrumb: 'المشروعات والأنشطة',
    loading: 'جارٍ تحميل مساحة عمل المشروع...',
    notFound: 'المشروع غير موجود',
    loadError: 'تعذر تحميل بيانات المشروع',
    tabs: { overview: 'نظرة عامة', steps: 'الخطوات والتنفيذ', materials: 'المواد والأدوات', learning: 'أهداف التعلم', safety: 'إرشادات السلامة', media: 'الوسائط', localization: 'الترجمة', production: 'الإنتاج', workflow: 'سير العمل', downloads: 'المواد القابلة للتنزيل', analytics: 'التحليلات', history: 'السجل' },
    duration: 'المدة المقدرة',
    difficulty: 'الصعوبة',
    supervision: 'مستوى الإشراف',
    age: 'الفئة العمرية',
    steps: 'خطوات العمل',
    materials: 'الأدوات والمواد',
    objectives: 'أهداف التعلم',
    safetyState: 'حالة اعتماد السلامة',
    review: 'المراجعة التربوية',
    notRequired: 'غير مطلوبة',
    pending: 'بانتظار مراجعة واعتماد السلامة',
    approved: 'مُعتمدة وآمنة',
    blocked: 'موقوفة',
    editMeta: 'تعديل بيانات المشروع',
    saveChanges: 'حفظ التعديلات',
    saving: 'جارٍ الحفظ...',
  },
  en: {
    breadcrumb: 'Projects & Activities',
    loading: 'Loading project workspace...',
    notFound: 'Project not found',
    loadError: 'Unable to load project',
    tabs: { overview: 'Overview', steps: 'Steps & Execution', materials: 'Tools & Materials', learning: 'Learning Goals', safety: 'Safety Guidelines', media: 'Media', localization: 'Localization', production: 'Production', workflow: 'Workflow', downloads: 'Downloads', analytics: 'Analytics', history: 'History' },
    duration: 'Estimated Duration',
    difficulty: 'Difficulty',
    supervision: 'Supervision',
    age: 'Age Range',
    steps: 'Steps',
    materials: 'Materials',
    objectives: 'Objectives',
    safetyState: 'Safety Status',
    review: 'Review',
    notRequired: 'Not required',
    pending: 'Pending safety audit',
    approved: 'Approved & Safe',
    blocked: 'Blocked',
    editMeta: 'Edit Project Info',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
  },
}

export function ProjectWorkspacePage() {
  const { locale } = usePreferences()
  const text = copy[locale] as any
  const { id = '' } = useParams()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [error, setError] = useState('')

  // Edit Modal
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    title_ar: '',
    description_ar: '',
    supervision_level: 'none' as SupervisionLevel,
    age_min: 5,
    age_max: 12,
    safety_notes: '',
    status: 'draft' as ContentStatus,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const r = await api.project(id)
      const data = r.data as ProjectDetail
      setProject(data)
      setEditForm({
        title_ar: data.title_ar,
        description_ar: data.description_ar || '',
        supervision_level: data.supervision_level,
        age_min: data.age_min,
        age_max: data.age_max,
        safety_notes: data.safety_notes || '',
        status: data.status,
      })
      setState('ok')
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setState('missing')
      else {
        setState('error')
        setError(e instanceof Error ? e.message : text.loadError)
      }
    }
  }, [id, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      await api.updateProject(id, {
        title_ar: editForm.title_ar.trim(),
        description_ar: editForm.description_ar.trim() || null,
        supervision_level: editForm.supervision_level,
        age_min: Number(editForm.age_min),
        age_max: Number(editForm.age_max),
        safety_notes: editForm.safety_notes.trim() || null,
        status: editForm.status,
      } as Partial<ProjectPayload>)
      setEditOpen(false)
      await load()
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  if (state === 'loading') return <LoadingState label={text.loading} />
  if (state === 'missing') {
    return (
      <div className="page-stack">
        <EmptyState
          title={text.notFound}
          description=""
          action={<Link className="button button--ghost" to={adminPath('projects')}>{text.breadcrumb}</Link>}
        />
      </div>
    )
  }
  if (state === 'error' || !project) {
    return (
      <div className="page-stack">
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  const overview = (
    <div className="workspace-stack">
      {/* 4-COLUMN BENTO KPI METRICS */}
      <section className="hero-kpis">
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.steps}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="objectives" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(project.steps.length, locale)}</div>
          <div className="kpi-glass-card__caption">خطوات عمل مرقمة وموثقة</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.materials}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="check" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(project.materials.length, locale)}</div>
          <div className="kpi-glass-card__caption">أدوات ومواد مطلوبة</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.duration}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="clock" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{(project as any).estimated_minutes || 20} د</div>
          <div className="kpi-glass-card__caption">زمن التنفيذ والتطبيق</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.supervision}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="check" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value" style={{ fontSize: 22, lineHeight: 1.6 }}>
            {project.supervision_level === 'required' ? 'إشراف إلزامي' : project.supervision_level === 'recommended' ? 'مستحسن' : 'ذاتي آمن'}
          </div>
          <div className="kpi-glass-card__caption">متطلبات المتابعة</div>
        </div>
      </section>

      {/* PROJECT DETAILS PANEL */}
      <section className="panel">
        <header className="panel__header">
          <h3>{text.tabs.overview}</h3>
        </header>
        <div className="panel__body">
          <div className="detail-fields">
            <div><span>{text.age}</span><strong>{project.age_min}–{project.age_max} سنوات</strong></div>
            <div><span>{text.supervision}</span><strong>{project.supervision_level}</strong></div>
            <div><span>الحالة</span><StatusBadge status={project.status as any} /></div>
          </div>
          <p style={{ marginTop: 16 }} className="panel__note">
            {project.description_ar || '—'}
          </p>
          <div className="inline-alert inline-alert--info" style={{ marginTop: 14 }}>
            🛡️ {text.safetyState}: {project.safety_notes ? text.approved : text.pending}
          </div>
        </div>
      </section>
    </div>
  )

  const stepsTab = project.steps.length === 0 ? (
    <EmptyState
      title={locale === 'ar' ? 'لم تتم إضافة خطوات بعد' : 'No steps yet'}
      description=""
      action={
        <button className="button button--primary">
          <Icon name="plus" size={14} />
          {locale === 'ar' ? 'إضافة أول خطوة' : 'Add first step'}
        </button>
      }
    />
  ) : (
    <div className="panel panel--table">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>{text.tabs.steps}</th>
            </tr>
          </thead>
          <tbody>
            {project.steps.map((s, i) => (
              <tr key={i}>
                <td><strong>{i + 1}</strong></td>
                <td>{s}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const materialsTab = project.materials.length === 0 ? (
    <EmptyState title="لا توجد أدوات مسجلة" description="" />
  ) : (
    <div className="panel">
      <div className="panel__body">
        <ul className="detail-list">
          {project.materials.map((m) => (
            <li key={m}>
              <Icon name="check" size={14} />
              <span>{m}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )

  const tabs = [
    { key: 'overview', label: text.tabs.overview, content: overview },
    { key: 'steps', label: text.tabs.steps, badge: project.steps.length, content: stepsTab },
    { key: 'materials', label: text.tabs.materials, badge: project.materials.length, content: materialsTab },
    { key: 'learning', label: text.tabs.learning, content: <div className="data-unavailable">{text.objectives}: {project.learning_objective_ids.length} — {project.learning_objective_ids.join(', ') || '—'}</div> },
    {
      key: 'safety',
      label: text.tabs.safety,
      content: (
        <div className="panel">
          <div className="panel__body">
            <p>{project.safety_notes || text.pending}</p>
            <small>{text.supervision}: {project.supervision_level}</small>
          </div>
        </div>
      ),
    },
    {
      key: 'media',
      label: text.tabs.media,
      content: (project as any).assets?.length ? (
        <div className="media-studio-grid">
          {(project as any).assets.map((a: any) => (
            <Link key={a.id} className="media-card-item" to={adminPath(`media/${a.id}`)}>
              <div className="media-card-item__body">
                <h4 className="media-card-item__title">{a.title_ar}</h4>
                <small className="media-card-item__path">{a.kind}</small>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="لا وسائط" description="" />
      ),
    },
    { key: 'localization', label: text.tabs.localization, content: <div className="data-unavailable">AR 1/1 · EN 0/1</div> },
    { key: 'production', label: text.tabs.production, content: <div className="data-unavailable">يرتبط بمركز الإنتاج</div> },
    { key: 'workflow', label: text.tabs.workflow, content: <div className="data-unavailable">سير العمل والمراجعات</div> },
    { key: 'downloads', label: text.tabs.downloads, content: <div className="data-unavailable">مواد قابلة للطباعة والتنزيل</div> },
    { key: 'analytics', label: text.tabs.analytics, content: <div className="data-unavailable">بدء واكتمال — إن وُجد تتبع</div> },
    { key: 'history', label: text.tabs.history, content: <TimelineView entries={[]} emptyLabel="لا سجل" /> },
  ]

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[{ label: text.breadcrumb, to: adminPath('projects') }, { label: project.title_ar }]}
        thumbnail={
          <div className="entity-thumb" style={{ width: 48, height: 48, borderRadius: 14 }}>
            <span className="entity-thumb__letter"><Icon name="objectives" size={24} /></span>
          </div>
        }
        title={project.title_ar}
        subtitle={project.description_ar ?? undefined}
        meta={
          <>
            <span>{project.age_min}–{project.age_max} سنوات</span>
            <span>{project.supervision_level}</span>
            <span>{formatNumber(project.steps.length, locale)} {text.steps}</span>
          </>
        }
        status={<StatusBadge status={project.status as any} />}
        actions={
          <button className="button button--primary" onClick={() => setEditOpen(true)}>
            <Icon name="edit" size={16} />
            {text.editMeta}
          </button>
        }
      />
      <DetailTabs tabs={tabs as any} active={tab} onChange={(k) => setTab(k as TabKey)} />

      {/* EDIT METADATA MODAL */}
      <Modal open={editOpen} onClose={() => !saving && setEditOpen(false)} title={text.editMeta}>
        <form className="entity-form" onSubmit={handleEditSubmit}>
          {saveError && <div className="inline-alert inline-alert--error">{saveError}</div>}
          <label className="field">
            <span>عنوان المشروع *</span>
            <input
              type="text"
              required
              value={editForm.title_ar}
              onChange={(e) => setEditForm({ ...editForm, title_ar: e.target.value })}
            />
          </label>

          <label className="field">
            <span>الوصف</span>
            <textarea
              rows={3}
              value={editForm.description_ar}
              onChange={(e) => setEditForm({ ...editForm, description_ar: e.target.value })}
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span>مستوى الإشراف</span>
              <select
                value={editForm.supervision_level}
                onChange={(e) => setEditForm({ ...editForm, supervision_level: e.target.value as SupervisionLevel })}
              >
                <option value="none">بدون إشراف (آمن)</option>
                <option value="recommended">مستحسن</option>
                <option value="required">إلزامي</option>
              </select>
            </label>

            <label className="field">
              <span>الحالة</span>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ContentStatus })}
              >
                <option value="draft">draft</option>
                <option value="ready">ready</option>
                <option value="published">published</option>
              </select>
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>أدنى عمر</span>
              <input
                type="number"
                min={3}
                max={16}
                value={editForm.age_min}
                onChange={(e) => setEditForm({ ...editForm, age_min: Number(e.target.value) })}
              />
            </label>

            <label className="field">
              <span>أقصى عمر</span>
              <input
                type="number"
                min={4}
                max={18}
                value={editForm.age_max}
                onChange={(e) => setEditForm({ ...editForm, age_max: Number(e.target.value) })}
              />
            </label>
          </div>

          <label className="field">
            <span>ملاحظات وإرشادات السلامة</span>
            <textarea
              rows={2}
              placeholder="مثال: يرجى استخدام مقص أطفال بلاستيكي غير حاد..."
              value={editForm.safety_notes}
              onChange={(e) => setEditForm({ ...editForm, safety_notes: e.target.value })}
            />
          </label>

          <div className="form-actions">
            <button
              className="button button--ghost"
              type="button"
              disabled={saving}
              onClick={() => setEditOpen(false)}
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="button button--primary" type="submit" disabled={saving}>
              <Icon name="check" size={16} />
              {saving ? text.saving : text.saveChanges}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
