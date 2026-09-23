import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu, useColumnPreferences, ColumnManager } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { QuestionRecord, LearningObjectiveRecord } from '../types/api'

const TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'ORDERING', 'MATCHING', 'IMAGE_CHOICE']
const TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: 'اختيار متعدد',
  TRUE_FALSE: 'صح / خطأ',
  ORDERING: 'ترتيب تسلسلي',
  MATCHING: 'مطابقة أزواج',
  IMAGE_CHOICE: 'اختيار صورة',
}
const STATUSES = ['draft', 'in_review', 'approved', 'archived']

const copy = {
  ar: {
    eyebrow: 'الإطار التعليمي والتقييم',
    title: 'بنك الأسئلة والتقييم التفاعلي',
    lede: 'أسئلة معيارية مرتبطة بأهداف تعليمية محددة — تشكل الأساس التقييمي لاحتساب شارات الإتقان.',
    add: 'سؤال تقييمي جديد',
    import: 'استيراد أسئلة',
    export: 'تصدير JSON',
    refresh: 'تحديث',
    total: 'إجمالي الأسئلة',
    draft: 'مسودة',
    inReview: 'قيد المراجعة',
    approved: 'معتمد ونشط',
    missingObjective: 'بدون هدف',
    cardsView: 'بطاقات الأسئلة',
    tableView: 'الجدول التفصيلي',
    search: 'بحث بنص السؤال أو الرمز...',
    type: 'نوع السؤال',
    allTypes: 'كل الأنواع',
    objective: 'الهدف التعليمي',
    difficulty: 'مستوى الصعوبة',
    status: 'حالة الاعتماد',
    actions: '',
    noQuestions: 'لا توجد أسئلة مطابقة للبحث',
    noQuestionsHint: 'يمكنك إنشاء سؤال جديد وربطه بهدف تعليمي أو استيراد أسئلة من ملف.',
    createTitle: 'إنشاء سؤال تقييمي جديد',
    editTitle: 'تعديل بيانات السؤال',
    typeField: 'نوع السؤال *',
    promptField: 'نص السؤال باللغة العربية *',
    objectiveField: 'الهدف التعليمي المرتبط *',
    ageMin: 'أدنى عمر',
    ageMax: 'أقصى عمر',
    difficultyField: 'الصعوبة',
    correctField: 'الإجابة الصحيحة',
    distractorsField: 'المشتتات (الخيارات الخاطئة)',
    mediaField: 'رمز وسائط الصورة',
    save: 'حفظ السؤال',
    cancel: 'إلغاء',
    question: 'السؤال',
  },
  en: {
    eyebrow: 'Educational Framework',
    title: 'Question Bank & Assessment Studio',
    lede: 'Measurable assessment items linked directly to learning objectives — providing empirical evidence for mastery.',
    add: 'New Question',
    import: 'Import',
    export: 'Export JSON',
    refresh: 'Refresh',
    total: 'Total Questions',
    draft: 'Draft',
    inReview: 'In Review',
    approved: 'Approved',
    missingObjective: 'Missing Objective',
    cardsView: 'Question Cards',
    tableView: 'Detailed Table',
    search: 'Search by prompt or code...',
    type: 'Question Type',
    allTypes: 'All Types',
    objective: 'Objective',
    difficulty: 'Difficulty',
    status: 'Status',
    actions: '',
    noQuestions: 'No matching questions found',
    noQuestionsHint: 'Create a new question linked to an objective or import from JSON.',
    createTitle: 'Create Assessment Question',
    editTitle: 'Edit Question',
    typeField: 'Question Type *',
    promptField: 'Question Prompt *',
    objectiveField: 'Learning Objective *',
    ageMin: 'Min Age',
    ageMax: 'Max Age',
    difficultyField: 'Difficulty',
    correctField: 'Correct Answer',
    distractorsField: 'Distractors',
    mediaField: 'Media Asset ID',
    save: 'Save Question',
    cancel: 'Cancel',
    question: 'Question',
  },
}

const COLUMNS: ColumnDefinition[] = [
  { key: 'question', label: 'question', locked: true },
  { key: 'type', label: 'type' },
  { key: 'objective', label: 'objective' },
  { key: 'age', label: 'age' },
  { key: 'difficulty', label: 'difficulty' },
  { key: 'languages', label: 'languages' },
  { key: 'media', label: 'media' },
  { key: 'usage', label: 'usage' },
  { key: 'review', label: 'review' },
  { key: 'status', label: 'status' },
]

const QUIZ_FILTER_DEFAULTS = { type: '', status: '', objective_id: '', difficulty: '' } as const

export function QuizBuilderPage() {
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const navigate = useNavigate()
  const list = useUrlListState(QUIZ_FILTER_DEFAULTS as any, { limit: 25 })
  const { query, filters, offset, limit } = list
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [records, setRecords] = useState<QuestionRecord[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<any>(null)
  const [objectives, setObjectives] = useState<LearningObjectiveRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importResult, setImportResult] = useState<string>('')
  const [form, setForm] = useState<any>(() => ({
    code: `Q-${Date.now().toString().slice(-6)}`,
    type: 'MULTIPLE_CHOICE',
    prompt_ar: '',
    learning_objective_id: '',
    age_min: 6,
    age_max: 8,
    difficulty: 'medium',
    correct_answer: { value: '' },
    distractors: [],
  }))
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const columns = useColumnPreferences('quiz', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [qRes, objRes] = await Promise.all([
        api.questions({ q: query, ...filters, limit, offset } as any),
        api.learningObjectives({ limit: 100 } as any),
      ])
      setRecords((qRes as any).data || [])
      setTotal((qRes as any).meta?.total ?? (qRes as any).data?.length ?? 0)
      setSummary((qRes as any).meta?.summary)
      setObjectives((objRes as any).data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل بنك الأسئلة')
    } finally {
      setLoading(false)
    }
  }, [query, filters, limit, offset])

  useEffect(() => {
    const t = setTimeout(() => void load(), 200)
    return () => clearTimeout(t)
  }, [load])

  const metrics = useMemo(() => {
    if (summary) return summary
    return {
      total: records.length,
      draft: records.filter((r) => r.status === 'draft').length,
      in_review: records.filter((r) => r.status === 'in_review').length,
      approved: records.filter((r) => r.status === 'approved').length,
      missing_objective: records.filter((r) => !r.learning_objective_id).length,
    }
  }, [summary, records])

  async function submit(e: any) {
    e.preventDefault()
    if (!form.code || !form.prompt_ar || !form.learning_objective_id) {
      setFormError('يرجى تعبئة الحقول الإلزامية: الرمز، نص السؤال، والهدف التعليمي')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await api.createQuestion({
        code: form.code,
        type: form.type,
        prompt_ar: form.prompt_ar,
        learning_objective_id: form.learning_objective_id,
        age_min: Number(form.age_min),
        age_max: Number(form.age_max),
        difficulty: form.difficulty,
        correct_answer: form.correct_answer,
        distractors: Array.isArray(form.distractors)
          ? form.distractors
          : form.distractors
          ? [form.distractors]
          : [],
      } as any)
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'تعذر حفظ السؤال')
    } finally {
      setSaving(false)
    }
  }

  async function handleImport() {
    setImportError('')
    setImportResult('')
    setImportBusy(true)
    try {
      let questions: any[] = []
      const trimmed = importJson.trim()
      if (!trimmed) throw new Error('الملف فارغ')
      const parsed = JSON.parse(trimmed)
      questions = Array.isArray(parsed) ? parsed : parsed.questions ?? []
      if (!Array.isArray(questions) || questions.length === 0)
        throw new Error('الملف لا يحتوي على مصفوفة أسئلة صالحة')
      const res = await api.importQuestions(questions)
      setImportResult(`تم بنجاح استيراد ${res.data.imported} سؤال إلى بنك الأسئلة`)
      await load()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'خطأ في معالجة ملف الاستيراد')
    } finally {
      setImportBusy(false)
    }
  }

  function onImportFile(e: any) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImportJson(String(reader.result || ''))
    }
    reader.readAsText(file)
  }

  const filterFields: FilterField[] = [
    {
      key: 'type',
      label: text.type,
      type: 'select',
      options: [{ value: '', label: 'الكل' }, ...TYPES.map((v) => ({ value: v, label: TYPE_LABELS[v] ?? v }))],
    },
    {
      key: 'status',
      label: text.status,
      type: 'select',
      options: [{ value: '', label: 'الكل' }, ...STATUSES.map((v) => ({ value: v, label: v }))],
    },
    {
      key: 'difficulty',
      label: text.difficulty,
      type: 'select',
      options: [
        { value: '', label: 'الكل' },
        { value: 'easy', label: 'سهل' },
        { value: 'medium', label: 'متوسط' },
        { value: 'hard', label: 'صعب' },
      ],
    },
    {
      key: 'objective_id',
      label: text.objective,
      type: 'select',
      options: [
        { value: '', label: 'الكل' },
        ...objectives.slice(0, 30).map((o) => ({ value: o.id, label: `${o.code} - ${o.title_ar.slice(0, 30)}` })),
      ],
    },
  ]

  if (loading && !records.length) return <LoadingState label="جارٍ تحميل بنك الأسئلة..." />
  if (error && !records.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(99, 102, 241, 0.12) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#f59e0b' }} />
              {formatNumber(total, locale as any)} سؤال تقييمي
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
        <div className="catalog-hero__actions">
          <button className="button button--secondary" onClick={() => void load()} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="refresh" size={15} />
            <span>{text.refresh}</span>
          </button>
          <button
            className="button button--ghost"
            onClick={() => {
              setImportOpen(true)
              setImportError('')
              setImportResult('')
              setImportJson('')
            }}
          >
            <Icon name="upload" size={14} />
            <span>{text.import}</span>
          </button>
          <button className="cs-btn-primary" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={16} />
            <span>{text.add}</span>
          </button>
        </div>
      </section>

      {/* 2. Side-by-side Bento Live Metric Strip */}
      <div className="hero-kpis">
        <div className="kpi-glass-card" onClick={() => list.clearFilters()} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Icon name="objectives" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.total}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.total ?? total, locale as any)}</div>
            <span className="kpi-glass-card__trend">في بنك الاختبارات والتمارين</span>
          </div>
        </div>

        <div className="kpi-glass-card" onClick={() => list.setFilter('status', 'approved')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="check" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.approved}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.approved ?? 0, locale as any)}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              معتمد ومدرج في الألعاب
            </span>
          </div>
        </div>

        <div className="kpi-glass-card" onClick={() => list.setFilter('status', 'in_review')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Icon name="edit" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.inReview}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.in_review ?? 0, locale as any)}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#818cf8' }}>
              بانتظار المراجعة التربوية
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
            <Icon name="warning" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.missingObjective}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.missing_objective ?? 0, locale as any)}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#f87171' }}>
              أسئلة بحاجة للربط بهدف
            </span>
          </div>
        </div>
      </div>

      {/* 3. Catalog Control Strip */}
      <section className="catalog-control-strip">
        <div className="catalog-control-strip__left">
          <div className="filter-pill-group">
            <button
              className={`filter-pill ${filters.type === '' ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('type', '')}
            >
              {text.allTypes}
            </button>
            {TYPES.map((t) => (
              <button
                key={t}
                className={`filter-pill ${filters.type === t ? 'filter-pill--active' : ''}`}
                onClick={() => list.setFilter('type', t)}
              >
                {TYPE_LABELS[t] ?? t}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-control-strip__right">
          <ListToolbar
            searchValue={query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={filterFields}
            values={filters as any}
            defaults={{ type: '', status: '', objective_id: '', difficulty: '' } as any}
            onApply={(next) => list.setFilters(next as any)}
            onClear={list.clearFilters}
            onRemove={(k) => list.setFilter(k as any, '')}
            trailing={
              <>
                <SavedViewsMenu
                  storageKey="quiz"
                  currentSearch={list.search}
                  onApply={(s) => navigate(`${adminPath('quiz')}${s}`)}
                />
                <ColumnManager
                  columns={COLUMNS.map((c) => ({ ...c, label: (text as any)[c.label] ?? c.label }))}
                  hidden={columns.hidden}
                  onToggle={columns.toggle}
                  onReset={columns.reset}
                />
                <button
                  className="button button--ghost button--small"
                  onClick={async () => {
                    const res = await api.exportQuestions({ q: query } as any)
                    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'questions-export.json'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <Icon name="copy" size={13} />
                  <span>{text.export}</span>
                </button>
              </>
            }
          />

          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${view === 'cards' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setView('cards')}
            >
              <Icon name="grid" size={14} />
              <span>{text.cardsView}</span>
            </button>
            <button
              className={`view-mode-btn ${view === 'table' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setView('table')}
            >
              <Icon name="bars" size={14} />
              <span>{text.tableView}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4. Active View Presentation */}
      {records.length === 0 ? (
        <EmptyState
          title={text.noQuestions}
          description={text.noQuestionsHint}
          action={
            <button className="button button--primary" onClick={() => setModalOpen(true)}>
              {text.add}
            </button>
          }
        />
      ) : view === 'cards' ? (
        <>
          <div className="quiz-studio-grid">
            {records.map((r) => {
              const correctAnswer = (r as any).correct_answer?.value ?? (r as any).correct_answer?.items?.join(', ') ?? 'محددة'
              return (
                <article key={r.id} className="question-card-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="question-type-badge">{TYPE_LABELS[r.type] ?? r.type}</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: r.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-3)',
                        color: r.status === 'approved' ? '#10b981' : 'var(--muted)',
                      }}
                    >
                      {r.status === 'approved' ? 'معتمد' : r.status === 'in_review' ? 'قيد المراجعة' : 'مسودة'}
                    </span>
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1.4 }}>
                      {r.prompt_ar}
                    </h3>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{r.code}</div>
                  </div>

                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      fontSize: 12.5,
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Icon name="check" size={14} />
                    <span>
                      <strong>الإجابة:</strong> {correctAnswer}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11.5 }}>
                    {r.objective_code ? (
                      <Link
                        to={adminPath(`objectives/${r.learning_objective_id}`)}
                        className="prod-chip"
                        style={{ textDecoration: 'none' }}
                      >
                        الهدف: {r.objective_code}
                      </Link>
                    ) : (
                      <span className="prod-chip prod-chip--blocked">{text.missingObjective}</span>
                    )}
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-soft)' }}>
                      الصعوبة: {r.difficulty}
                    </span>
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-soft)' }}>
                      الأعمار: {r.age_min}–{r.age_max}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 10,
                      borderTop: '1px solid var(--cs-glass-border)',
                      marginTop: 'auto',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      مرات الاستخدام: {r.usage_count ?? 0}
                    </span>
                    <Link
                      to={adminPath(`quiz/${r.id}`)}
                      className="button button--primary button--small"
                      style={{ textDecoration: 'none' }}
                    >
                      <span>مساحة السؤال</span>
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
          <div style={{ marginTop: 20 }}>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale as any} />
          </div>
        </>
      ) : (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.question}</th>
                  {columns.isVisible('type') && <th>{text.type}</th>}
                  {columns.isVisible('objective') && <th>{text.objective}</th>}
                  {columns.isVisible('age') && <th>العمر</th>}
                  {columns.isVisible('difficulty') && <th>{text.difficulty}</th>}
                  {columns.isVisible('languages') && <th>اللغات</th>}
                  {columns.isVisible('media') && <th>الوسائط</th>}
                  {columns.isVisible('usage') && <th>الاستخدام</th>}
                  {columns.isVisible('status') && <th>{text.status}</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={adminPath(`quiz/${r.id}`)} style={{ textDecoration: 'none' }}>
                        <strong style={{ display: 'block', maxWidth: 340, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.prompt_ar}
                        </strong>
                        <small dir="ltr" className="table-secondary">
                          {r.code}
                        </small>
                      </Link>
                    </td>
                    {columns.isVisible('type') && (
                      <td>
                        <span className="question-type-badge">{TYPE_LABELS[r.type] ?? r.type}</span>
                      </td>
                    )}
                    {columns.isVisible('objective') && (
                      <td>
                        {r.objective_code ? (
                          <Link to={adminPath(`objectives/${r.learning_objective_id}`)} className="prod-chip">
                            {r.objective_code}
                          </Link>
                        ) : (
                          <span className="prod-chip prod-chip--blocked">{text.missingObjective}</span>
                        )}
                      </td>
                    )}
                    {columns.isVisible('age') && (
                      <td dir="ltr">
                        {r.age_min}–{r.age_max}
                      </td>
                    )}
                    {columns.isVisible('difficulty') && <td>{r.difficulty}</td>}
                    {columns.isVisible('languages') && <td>{r.languages_count ?? 1}</td>}
                    {columns.isVisible('media') && <td>{r.media_asset_id ? '✓' : '—'}</td>}
                    {columns.isVisible('usage') && <td>{r.usage_count ?? 0}</td>}
                    {columns.isVisible('status') && (
                      <td>
                        <span
                          className={`status-badge ${
                            r.status === 'approved'
                              ? 'status-badge--published'
                              : r.status === 'in_review'
                              ? 'status-badge--review'
                              : ''
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    )}
                    <td>
                      <Link className="button button--ghost button--small" to={adminPath(`quiz/${r.id}`)}>
                        فتح
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale as any} />
        </section>
      )}

      {/* Add Question Modal */}
      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={text.createTitle}>
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>رمز السؤال التقييمي *</span>
              <input dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </label>
            <label className="field">
              <span>{text.typeField}</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>{text.promptField}</span>
            <textarea
              rows={2}
              value={form.prompt_ar}
              onChange={(e) => setForm({ ...form, prompt_ar: e.target.value })}
              placeholder="اكتب نص السؤال بدقة ووضوح للطفل..."
            />
          </label>
          <label className="field">
            <span>{text.objectiveField}</span>
            <select
              value={form.learning_objective_id}
              onChange={(e) => setForm({ ...form, learning_objective_id: e.target.value })}
            >
              <option value="">— اختر الهدف التعليمي المرتبط —</option>
              {objectives.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} — {o.title_ar}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.ageMin}</span>
              <input
                type="number"
                min={3}
                max={12}
                value={form.age_min}
                onChange={(e) => setForm({ ...form, age_min: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{text.ageMax}</span>
              <input
                type="number"
                min={3}
                max={12}
                value={form.age_max}
                onChange={(e) => setForm({ ...form, age_max: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{text.difficultyField}</span>
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
              </select>
            </label>
          </div>
          {form.type === 'MULTIPLE_CHOICE' && (
            <>
              <label className="field">
                <span>{text.correctField} *</span>
                <input
                  value={form.correct_answer?.value ?? ''}
                  onChange={(e) => setForm({ ...form, correct_answer: { value: e.target.value } })}
                  placeholder="الإجابة الصحيحة"
                />
              </label>
              <label className="field">
                <span>{text.distractorsField}</span>
                <input
                  placeholder="مشتتات مفصولة بفاصلة (مثال: أزرق، أخضر، أسود)"
                  value={Array.isArray(form.distractors) ? form.distractors.join(', ') : ''}
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
            </>
          )}
          {form.type === 'TRUE_FALSE' && (
            <label className="field">
              <span>{text.correctField} *</span>
              <select
                value={form.correct_answer?.value ?? 'true'}
                onChange={(e) => setForm({ ...form, correct_answer: { value: e.target.value } })}
              >
                <option value="true">صح (True)</option>
                <option value="false">خطأ (False)</option>
              </select>
            </label>
          )}
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setModalOpen(false)}>
              {text.cancel}
            </button>
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? 'جارٍ الحفظ...' : text.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal open={importOpen} onClose={() => !importBusy && setImportOpen(false)} title={text.import}>
        <div className="entity-form">
          {importError && <div className="inline-alert inline-alert--error">{importError}</div>}
          {importResult && <div className="inline-alert inline-alert--success">{importResult}</div>}
          <label className="field">
            <span>رفع ملف JSON</span>
            <input type="file" accept=".json" onChange={onImportFile} />
          </label>
          <label className="field">
            <span>أو الصق محتوى الـ JSON هنا</span>
            <textarea
              rows={8}
              dir="ltr"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='[{"code":"Q-001","type":"MULTIPLE_CHOICE","prompt_ar":"..."}]'
            />
          </label>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setImportOpen(false)}>
              {text.cancel}
            </button>
            <button className="button button--primary" disabled={importBusy} onClick={() => void handleImport()}>
              {importBusy ? 'جارٍ المعالجة...' : text.import}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
