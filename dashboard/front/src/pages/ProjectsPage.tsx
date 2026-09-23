import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { ViewSwitcher, useStoredViewMode } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { EmptyState, ErrorState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import { useUrlListState } from '../hooks/useUrlListState'
import type { ContentStatus, ProjectPayload, ProjectRecord, SupervisionLevel } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'مكتبة المحتوى / المشروعات والأنشطة',
    title: 'استوديو المشروعات والأنشطة',
    intro: 'إدارة مشروعات الأنشطة والعلوم والابتكار اليدوي: خطوات التنفيذ، المواد المطلوبة، متطلبات الإشراف، ومعايير السلامة.',
    create: 'مشروع جديد',
    search: 'بحث بالعنوان أو الوصف...',
    status: 'الحالة',
    supervision: 'مستوى الإشراف',
    total: 'إجمالي المشروعات',
    ready: 'جاهزة للتعليم',
    review: 'قيد المراجعة',
    safety: 'تحتاج تدقيق السلامة',
    supervisionReq: 'تتطلب إشرافاً',
    open: 'مساحة العمل',
    colProject: 'المشروع',
    colAge: 'العمر',
    colDuration: 'المدة المتوقعة',
    colSupervision: 'الإشراف',
    colSteps: 'الخطوات',
    colStatus: 'الحالة',
    empty: 'لا توجد مشروعات مسجلة',
    noMatch: 'لا توجد نتائج مطابقة لبحثك',
    clear: 'مسح الفلاتر',
    loading: 'جارٍ تحميل المشروعات...',
    all: 'الكل',
    allSupervision: 'جميع مستويات الإشراف',
    stepsCount: (n: number) => `${n} خطوات`,
    materialsCount: (n: number) => `${n} أدوات`,
    createDenied: 'إنشاء المشروعات يحتاج صلاحية المشرف',
    saveProject: 'حفظ المشروع والخطوات',
    saving: 'جارٍ الحفظ...',
    supervisionLabels: {
      none: 'بدون إشراف (ذاتي)',
      recommended: 'إشراف مستحسن',
      required: 'إشراف عائلي إلزامي',
    } as Record<string, string>,
  },
  en: {
    eyebrow: 'Content Library / Projects & Activities',
    title: 'Projects & Activities Studio',
    intro: 'Hands-on project engineering and crafts management: step-by-step instructions, materials, adult supervision, and safety guidelines.',
    create: 'New Project',
    search: 'Search by title or description...',
    status: 'Status',
    supervision: 'Supervision Level',
    total: 'Total Projects',
    ready: 'Ready for Kids',
    review: 'In Review',
    safety: 'Safety Audit Pending',
    supervisionReq: 'Supervision Required',
    open: 'Workspace',
    colProject: 'Project',
    colAge: 'Age',
    colDuration: 'Duration',
    colSupervision: 'Supervision',
    colSteps: 'Steps',
    colStatus: 'Status',
    empty: 'No projects recorded',
    noMatch: 'No matching projects found',
    clear: 'Clear Filters',
    loading: 'Loading projects...',
    all: 'All',
    allSupervision: 'All Supervision Levels',
    stepsCount: (n: number) => `${n} steps`,
    materialsCount: (n: number) => `${n} materials`,
    createDenied: 'Creating projects requires admin permissions',
    saveProject: 'Save Project & Steps',
    saving: 'Saving...',
    supervisionLabels: {
      none: 'None (Independent)',
      recommended: 'Recommended',
      required: 'Required Adult Supervision',
    } as Record<string, string>,
  },
}

const DEFAULT_FILTERS = { status: '', supervision: '' }
const COLUMNS: ColumnDefinition[] = [
  { key: 'project', label: 'colProject', locked: true },
  { key: 'age', label: 'colAge' },
  { key: 'duration', label: 'colDuration' },
  { key: 'supervision', label: 'colSupervision' },
  { key: 'steps', label: 'colSteps' },
  { key: 'status', label: 'colStatus' },
]

function ProjectCover({ coverUrl, title }: { coverUrl?: string | null; title: string }) {
  return (
    <div className="project-card-item__icon-bubble">
      {coverUrl ? <img src={coverUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Icon name="objectives" size={24} />}
    </div>
  )
}

interface NewProjectFormState {
  title_ar: string
  description_ar: string
  supervision_level: SupervisionLevel
  age_min: number
  age_max: number
  estimated_minutes: number
  safety_notes: string
  materials: string
  steps: string
}

const emptyNewProject: NewProjectFormState = {
  title_ar: '',
  description_ar: '',
  supervision_level: 'none',
  age_min: 5,
  age_max: 12,
  estimated_minutes: 20,
  safety_notes: '',
  materials: 'ورق مقوى, مقص أطفال آمن, أقلام تلوين',
  steps: 'قص الورق حسب النموذج\nتلوين الأشكال وتجميعها\nفحص النتيجة وتشغيلها',
}

export function ProjectsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { defaultView: 'grid' })
  const columns = useColumnPreferences('projects-coll', COLUMNS)
  const [storedView, setStoredView] = useStoredViewMode('projects-coll', 'grid')
  const view: ViewMode = list.rawView === 'grid' || list.rawView === 'table' ? list.rawView : storedView === 'grid' ? 'grid' : 'table'
  const setView = (m: ViewMode) => { setStoredView(m); list.setView(m) }

  const [rows, setRows] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<NewProjectFormState>(emptyNewProject)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = hasPermission('create')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.projects({ q: list.query || undefined, status: list.filters.status as any || undefined })
      let data = res.data as ProjectRecord[]
      if (list.filters.supervision) data = data.filter((r) => r.supervision_level === list.filters.supervision)
      if (list.query) {
        const q = list.query.toLowerCase()
        data = data.filter((r) => r.title_ar.toLowerCase().includes(q) || (r.description_ar || '').toLowerCase().includes(q))
      }
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error')
    } finally {
      setLoading(false)
    }
  }, [list.query, list.filters.status, list.filters.supervision])

  useEffect(() => {
    const t = setTimeout(() => void load(), 180)
    return () => clearTimeout(t)
  }, [load])

  const summary = useMemo(() => ({
    total: rows.length,
    ready: rows.filter((r) => r.status === 'ready' || r.status === 'published').length,
    supervisionReq: rows.filter((r) => r.supervision_level === 'required').length,
    safety: rows.filter((r) => r.supervision_level === 'required' && !r.safety_notes).length,
  }), [rows])

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title_ar.trim()) {
      setFormError(locale === 'ar' ? 'يرجى كتابة عنوان المشروع' : 'Please provide a project title')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const materialsList = form.materials.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
      const stepsList = form.steps.split('\n').map((s) => s.trim()).filter(Boolean)
      const payload: ProjectPayload = {
        title_ar: form.title_ar.trim(),
        description_ar: form.description_ar.trim() || null,
        age_min: Number(form.age_min) || 5,
        age_max: Number(form.age_max) || 12,
        supervision_level: form.supervision_level,
        safety_notes: form.safety_notes.trim() || null,
        materials: materialsList,
        steps: stepsList,
        learning_objective_ids: [],
        cover_url: null,
        is_free: true,
        status: 'draft',
      }
      const res = await api.createProject(payload)
      setModalOpen(false)
      setForm(emptyNewProject)
      await load()
      if (res.data?.id) {
        navigate(adminPath(`projects/${res.data.id}`))
      }
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const fields: FilterField[] = [
    { key: 'status', label: text.status, type: 'select', options: [{ value: '', label: text.all }, ...(['draft', 'ready', 'published'] as ContentStatus[]).map((s) => ({ value: s, label: s }))] },
    { key: 'supervision', label: text.supervision, type: 'select', options: [{ value: '', label: text.all }, { value: 'none', label: text.supervisionLabels.none }, { value: 'recommended', label: text.supervisionLabels.recommended }, { value: 'required', label: text.supervisionLabels.required }], advanced: true },
  ]

  const table = (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table data-table--wide">
        <thead>
          <tr>
            <th>{text.colProject}</th>
            {columns.isVisible('age') && <th>{text.colAge}</th>}
            {columns.isVisible('duration') && <th>{text.colDuration}</th>}
            {columns.isVisible('supervision') && <th>{text.colSupervision}</th>}
            {columns.isVisible('steps') && <th>{text.colSteps}</th>}
            {columns.isVisible('status') && <th>{text.colStatus}</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="entity-cell entity-cell--button" to={adminPath(`projects/${row.id}`)}>
                  <ProjectCover coverUrl={(row as any).cover_url} title={row.title_ar} />
                  <div>
                    <strong>{row.title_ar}</strong>
                    <small>{row.description_ar?.slice(0, 45) || '—'}</small>
                  </div>
                </Link>
              </td>
              {columns.isVisible('age') && <td>{row.age_min}–{row.age_max} سنوات</td>}
              {columns.isVisible('duration') && <td>{(row as any).estimated_minutes ? `${(row as any).estimated_minutes} دقيقة` : '—'}</td>}
              {columns.isVisible('supervision') && (
                <td>
                  <span className={`project-supervision-pill project-supervision--${row.supervision_level}`}>
                    {text.supervisionLabels[row.supervision_level] || row.supervision_level}
                  </span>
                </td>
              )}
              {columns.isVisible('steps') && <td>{row.steps?.length ?? 0}</td>}
              {columns.isVisible('status') && <td><StatusBadge status={row.status as any} /></td>}
              <td>
                <Link className="button button--ghost button--small" to={adminPath(`projects/${row.id}`)}>
                  {text.open}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const cards = (
    <div className="project-studio-grid" role="list">
      {rows.map((row) => {
        const sup = row.supervision_level || 'none'
        return (
          <article key={row.id} className="project-card-item" role="listitem">
            <div className="project-card-item__head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ProjectCover coverUrl={(row as any).cover_url} title={row.title_ar} />
                <div>
                  <Link to={adminPath(`projects/${row.id}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h3 className="project-card-item__title">{row.title_ar}</h3>
                  </Link>
                  <span className={`project-supervision-pill project-supervision--${sup}`} style={{ marginTop: 4 }}>
                    {text.supervisionLabels[sup] || sup}
                  </span>
                </div>
              </div>
              <StatusBadge status={row.status as any} />
            </div>

            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, flex: 1 }}>
              {row.description_ar || 'مشروع عملي واستكشافي شيق للأطفال بمواد منزلية آمنة.'}
            </p>

            <div className="project-card-item__meta-strip">
              <span>🎯 {row.age_min}–{row.age_max} سنوات</span>
              <span>⏱️ {(row as any).estimated_minutes ? `${(row as any).estimated_minutes} دقيقة` : '20 دقيقة'}</span>
              <span>📝 {text.stepsCount(row.steps?.length ?? 0)}</span>
              <span>🧰 {text.materialsCount(row.materials?.length ?? 0)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--cs-glass-border)' }}>
              <Link className="button button--primary button--small" to={adminPath(`projects/${row.id}`)}>
                <Icon name="objectives" size={14} />
                {text.open}
              </Link>
            </div>
          </article>
        )
      })}
    </div>
  )

  return (
    <div className="page-stack">
      {/* 1. PANORAMIC HERO HEADER */}
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <div className="page-intro__actions">
          <button
            className="button button--primary"
            disabled={!canCreate}
            onClick={() => {
              setForm(emptyNewProject)
              setFormError('')
              setModalOpen(true)
            }}
          >
            <Icon name="plus" size={16} />
            {text.create}
          </button>
        </div>
      </section>

      {/* 2. LIVE BENTO KPI METRICS */}
      <section className="hero-kpis" aria-label={text.title}>
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.total}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="objectives" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.total, locale)}</div>
          <div className="kpi-glass-card__caption">مشروعات عملية مسجلة</div>
        </div>

        <div
          className="kpi-glass-card kpi-glass-card--success"
          style={{ cursor: 'pointer' }}
          onClick={() => list.setFilter('status', list.filters.status === 'ready' ? '' : 'ready')}
        >
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.ready}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="check" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.ready, locale)}</div>
          <div className="kpi-glass-card__caption">مكتملة ومتاحة للأطفال</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.supervisionReq}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="clock" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.supervisionReq, locale)}</div>
          <div className="kpi-glass-card__caption">تتطلب مرافقة الوالدين</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.safety}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="check" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.safety, locale)}</div>
          <div className="kpi-glass-card__caption">بانتظار إرشادات السلامة</div>
        </div>
      </section>

      {/* 3. QUICK SUPERVISION FILTER PILLS */}
      <section className="catalog-control-strip">
        <button
          type="button"
          className={`filter-pill ${!list.filters.supervision ? 'active' : ''}`}
          onClick={() => list.setFilter('supervision', '')}
        >
          🧰 {text.allSupervision} ({rows.length})
        </button>
        <button
          type="button"
          className={`filter-pill ${list.filters.supervision === 'none' ? 'active' : ''}`}
          onClick={() => list.setFilter('supervision', list.filters.supervision === 'none' ? '' : 'none')}
        >
          🟢 {text.supervisionLabels.none}
        </button>
        <button
          type="button"
          className={`filter-pill ${list.filters.supervision === 'recommended' ? 'active' : ''}`}
          onClick={() => list.setFilter('supervision', list.filters.supervision === 'recommended' ? '' : 'recommended')}
        >
          🟡 {text.supervisionLabels.recommended}
        </button>
        <button
          type="button"
          className={`filter-pill ${list.filters.supervision === 'required' ? 'active' : ''}`}
          onClick={() => list.setFilter('supervision', list.filters.supervision === 'required' ? '' : 'required')}
        >
          🔴 {text.supervisionLabels.required}
        </button>
      </section>

      {/* 4. MAIN PANEL */}
      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{text.title}</span>
            <h3>{formatNumber(rows.length, locale)}</h3>
          </div>
          <ListToolbar
            searchValue={list.query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={fields}
            values={list.filters}
            defaults={DEFAULT_FILTERS}
            onApply={(n) => list.setFilters(n)}
            onClear={list.clearFilters}
            onRemove={(k) => list.setFilter(k as any, '')}
            trailing={
              <>
                <SavedViewsMenu storageKey="projects-coll" currentSearch={list.search} onApply={(s) => navigate(`${adminPath('projects')}${s}`)} />
                {view === 'table' && (
                  <ColumnManager
                    columns={COLUMNS.map((c) => ({ ...c, label: (text as any)[c.label] || c.label }))}
                    hidden={columns.hidden}
                    onToggle={columns.toggle}
                    onReset={columns.reset}
                  />
                )}
                <ViewSwitcher value={view} onChange={setView} modes={['grid', 'table']} locale={locale} />
              </>
            }
          />
        </header>

        {loading ? (
          <p className="planet-loading">{text.loading}</p>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={list.query || list.activeFilterCount ? text.noMatch : text.empty}
            description=""
            action={
              list.activeFilterCount ? (
                <button className="button button--ghost" onClick={() => { list.clearFilters(); list.setQuery('') }}>
                  {text.clear}
                </button>
              ) : undefined
            }
          />
        ) : view === 'grid' ? (
          cards
        ) : (
          table
        )}
      </section>

      {/* 5. ADD NEW PROJECT LIQUID GLASS MODAL */}
      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={text.create}>
        <form className="entity-form" onSubmit={handleCreateSubmit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field">
            <span>عنوان المشروع / النشاط *</span>
            <input
              type="text"
              required
              placeholder="مثال: صناعة نموذج المجموعة الشمسية"
              value={form.title_ar}
              onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span>مستوى الإشراف العائلي</span>
              <select
                value={form.supervision_level}
                onChange={(e) => setForm({ ...form, supervision_level: e.target.value as SupervisionLevel })}
              >
                <option value="none">بدون إشراف (نشاط آمن بالكامل)</option>
                <option value="recommended">مستحسن (إشراف عند الحاجة)</option>
                <option value="required">إلزامي (يتضمن مقصاً أو مواد دقيقة)</option>
              </select>
            </label>

            <label className="field">
              <span>المدة المقدرة (بالدقائق)</span>
              <input
                type="number"
                min={5}
                max={180}
                value={form.estimated_minutes}
                onChange={(e) => setForm({ ...form, estimated_minutes: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>أدنى عمر</span>
              <input
                type="number"
                min={3}
                max={16}
                value={form.age_min}
                onChange={(e) => setForm({ ...form, age_min: Number(e.target.value) })}
              />
            </label>

            <label className="field">
              <span>أقصى عمر</span>
              <input
                type="number"
                min={4}
                max={18}
                value={form.age_max}
                onChange={(e) => setForm({ ...form, age_max: Number(e.target.value) })}
              />
            </label>
          </div>

          <label className="field">
            <span>الأدوات والمواد المطلوبة (مفصولة بفاصلة أو سطر جديد)</span>
            <textarea
              rows={3}
              value={form.materials}
              onChange={(e) => setForm({ ...form, materials: e.target.value })}
            />
          </label>

          <label className="field">
            <span>خطوات التنفيذ (كل خطوة في سطر منفصل)</span>
            <textarea
              rows={4}
              value={form.steps}
              onChange={(e) => setForm({ ...form, steps: e.target.value })}
            />
          </label>

          <div className="form-actions">
            <button
              className="button button--ghost"
              type="button"
              disabled={saving}
              onClick={() => setModalOpen(false)}
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="button button--primary" type="submit" disabled={saving}>
              <Icon name="check" size={16} />
              {saving ? text.saving : text.saveProject}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
