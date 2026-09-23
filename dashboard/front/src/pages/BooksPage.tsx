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
import { formatNumber, formatDate } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import { useUrlListState } from '../hooks/useUrlListState'
import type { BookPayload, BookRecord, ContentStatus, InteractionMode, ReadingLevel, SeriesRecord, StoryType, SupervisionLevel } from '../types/api'

const statuses: ContentStatus[] = ['draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published', 'archived']
const types: StoryType[] = ['picture_book', 'audio_story', 'interactive', 'comic']
const typeLabels = {
  ar: { picture_book: 'كتاب مصور', audio_story: 'كتاب صوتي', interactive: 'تفاعلي', comic: 'كوميكس' },
  en: { picture_book: 'Picture book', audio_story: 'Audio book', interactive: 'Interactive', comic: 'Comic' },
}

const typeIcons: Record<StoryType, string> = {
  picture_book: '📖',
  audio_story: '🎧',
  interactive: '🎮',
  comic: '💬',
}

const copy = {
  ar: {
    eyebrow: 'مكتبة المحتوى / الكتب والروايات',
    title: 'استوديو الكتب',
    intro: 'المكتبة الفاخرة للكتب المصورة والتفاعلية والصوتية: أغلفة ثلاثية الأبعاد، فصول وصفحات، سرد صوتي متزامن، ومؤشرات جاهزية النشر.',
    create: 'إضافة كتاب جديد',
    total: 'إجمالي الكتب',
    ready: 'جاهز للنشر',
    review: 'قيد المراجعة',
    missingPages: 'ناقص صفحات',
    missingCover: 'بلا غلاف فني',
    search: 'بحث بالعنوان أو السلسلة...',
    type: 'النوع',
    status: 'الحالة',
    series: 'السلسلة',
    all: 'الكل',
    allTypes: 'جميع الأنواع',
    colCover: 'الغلاف',
    colBook: 'الكتاب',
    colSeries: 'السلسلة',
    colType: 'النوع',
    colPages: 'الصفحات',
    colLang: 'اللغات',
    colReadiness: 'الجاهزية',
    colStatus: 'الحالة',
    colUpdated: 'آخر تعديل',
    open: 'مساحة العمل',
    edit: 'تعديل',
    archive: 'أرشفة',
    denied: 'لا صلاحية',
    empty: 'لا توجد كتب مسجلة',
    noMatch: 'لا توجد نتائج مطابقة لبحثك',
    clear: 'إعادة تعيين الفلاتر',
    loading: 'جارٍ تحميل الكتب...',
    loadError: 'تعذر تحميل قائمة الكتب',
    noCover: 'بلا غلاف',
    pagesCount: (n: number) => `${n} صفحة`,
    audioNarration: 'سرد صوتي',
    interactiveBadge: 'تفاعلي',
    createDenied: 'إنشاء الكتب يحتاج صلاحية المشرف',
    saveBook: 'حفظ الكتاب والبدء',
    saving: 'جارٍ الحفظ...',
  },
  en: {
    eyebrow: 'Content Library / Books & Novels',
    title: 'Book Studio',
    intro: 'Curated studio for illustrated, interactive and audio books: 3D hardcover presentation, pages, synchronized audio narration and release readiness.',
    create: 'Add New Book',
    total: 'Total Books',
    ready: 'Ready to Publish',
    review: 'In Review',
    missingPages: 'Missing Pages',
    missingCover: 'No Cover Art',
    search: 'Search by title or series...',
    type: 'Type',
    status: 'Status',
    series: 'Series',
    all: 'All',
    allTypes: 'All Types',
    colCover: 'Cover',
    colBook: 'Book',
    colSeries: 'Series',
    colType: 'Type',
    colPages: 'Pages',
    colLang: 'Languages',
    colReadiness: 'Readiness',
    colStatus: 'Status',
    colUpdated: 'Updated',
    open: 'Workspace',
    edit: 'Edit',
    archive: 'Archive',
    denied: 'No permission',
    empty: 'No books recorded',
    noMatch: 'No matching books found',
    clear: 'Reset Filters',
    loading: 'Loading books...',
    loadError: 'Unable to load books list',
    noCover: 'No cover',
    pagesCount: (n: number) => `${n} pages`,
    audioNarration: 'Audio Narration',
    interactiveBadge: 'Interactive',
    createDenied: 'Creating books requires admin permissions',
    saveBook: 'Save Book & Start',
    saving: 'Saving...',
  },
}

const DEFAULT_FILTERS = { type: '', status: '', series_id: '' }
const COLUMNS: ColumnDefinition[] = [
  { key: 'book', label: 'colBook', locked: true },
  { key: 'series', label: 'colSeries' },
  { key: 'type', label: 'colType' },
  { key: 'pages', label: 'colPages' },
  { key: 'lang', label: 'colLang' },
  { key: 'readiness', label: 'colReadiness' },
  { key: 'status', label: 'colStatus' },
  { key: 'updated', label: 'colUpdated' },
]

function BookCover({ assetId, title, size = 'small' }: { assetId?: string | null; title: string; size?: 'small' | 'card' }) {
  const [url, setUrl] = useState<string>('')
  useEffect(() => {
    if (!assetId) return
    let live = true
    let obj = ''
    void api.assetBlob(assetId).then((b) => {
      if (!live) return
      obj = URL.createObjectURL(b)
      setUrl(obj)
    }).catch(() => {})
    return () => {
      live = false
      if (obj) URL.revokeObjectURL(obj)
    }
  }, [assetId])

  if (size === 'card') {
    return (
      <div className="book-card-item__cover-wrapper">
        {url ? (
          <img src={url} alt={title} className="book-card-item__cover-img" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.4)' }}>
            <Icon name="books" size={44} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="entity-thumb" style={{ width: 44, height: 44 }}>
      {url ? <img src={url} alt="" /> : <span className="entity-thumb__letter"><Icon name="books" size={18} /></span>}
    </div>
  )
}

interface NewBookFormState {
  title_ar: string
  series_id: string
  type: StoryType
  age_min: number
  age_max: number
  reading_level: ReadingLevel
  interaction_mode: InteractionMode
  supervision_level: SupervisionLevel
  description_ar: string
}

const emptyNewBook: NewBookFormState = {
  title_ar: '',
  series_id: '',
  type: 'picture_book',
  age_min: 3,
  age_max: 7,
  reading_level: 'emerging',
  interaction_mode: 'tap',
  supervision_level: 'none',
  description_ar: '',
}

export function BooksPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { defaultView: 'grid' })
  const columns = useColumnPreferences('books', COLUMNS)
  const [storedView, setStoredView] = useStoredViewMode('books', 'grid')
  const view: ViewMode = list.rawView === 'grid' || list.rawView === 'table' ? list.rawView : storedView === 'grid' ? 'grid' : 'table'
  const setView = (m: ViewMode) => { setStoredView(m); list.setView(m) }

  const [rows, setRows] = useState<BookRecord[]>([])
  const [series, setSeries] = useState<SeriesRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<NewBookFormState>(emptyNewBook)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = hasPermission('create')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.books({ q: list.query || undefined, status: list.filters.status as any || undefined })
      let data = res.data as BookRecord[]
      if (list.filters.type) data = data.filter((r) => r.type === list.filters.type)
      if (list.filters.series_id) data = data.filter((r) => r.series_id === list.filters.series_id)
      if (list.query) {
        const q = list.query.toLowerCase()
        data = data.filter((r) => r.title_ar.toLowerCase().includes(q) || (r.series_title || '').toLowerCase().includes(q))
      }
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [list.query, list.filters.type, list.filters.status, list.filters.series_id, text.loadError])

  useEffect(() => {
    const t = setTimeout(() => void load(), 180)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    void api.series({ status: 'all', limit: 100 }).then((r) => setSeries(r.data.filter((x) => x.status !== 'archived'))).catch(() => {})
  }, [])

  const summary = useMemo(() => {
    const total = rows.length
    const ready = rows.filter((r) => r.status === 'ready' || r.status === 'published').length
    const review = rows.filter((r) => String(r.status).startsWith('review')).length
    const missingPages = rows.filter((r) => !r.pages || (Array.isArray(r.pages) && r.pages.length === 0)).length
    const missingCover = rows.filter((r) => !r.cover_asset_id).length
    return { total, ready, review, missingPages, missingCover }
  }, [rows])

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title_ar.trim()) {
      setFormError(locale === 'ar' ? 'يرجى كتابة عنوان الكتاب' : 'Please provide a book title')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload: BookPayload = {
        title_ar: form.title_ar.trim(),
        series_id: form.series_id || null,
        type: form.type,
        pages: [],
        age_min: Number(form.age_min) || 3,
        age_max: Number(form.age_max) || 7,
        reading_level: form.reading_level,
        interaction_mode: form.interaction_mode,
        supervision_level: form.supervision_level,
        safety_notes: null,
        is_free: true,
        status: 'draft',
      }
      const res = await api.createBook(payload)
      setModalOpen(false)
      setForm(emptyNewBook)
      await load()
      if (res.data?.id) {
        navigate(adminPath(`books/${res.data.id}`))
      }
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  const fields: FilterField[] = [
    { key: 'type', label: text.type, type: 'select', options: [{ value: '', label: text.all }, ...types.map((t) => ({ value: t, label: (typeLabels as any)[locale][t] }))] },
    { key: 'status', label: text.status, type: 'select', options: [{ value: '', label: text.all }, ...statuses.map((s) => ({ value: s, label: s }))] },
    { key: 'series_id', label: text.series, type: 'select', advanced: true, options: [{ value: '', label: text.all }, ...series.map((s) => ({ value: s.id, label: s.title_ar }))] },
  ]

  const table = (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table data-table--wide">
        <thead>
          <tr>
            <th>{text.colBook}</th>
            {columns.isVisible('series') && <th>{text.colSeries}</th>}
            {columns.isVisible('type') && <th>{text.colType}</th>}
            {columns.isVisible('pages') && <th>{text.colPages}</th>}
            {columns.isVisible('status') && <th>{text.colStatus}</th>}
            {columns.isVisible('updated') && <th>{text.colUpdated}</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="entity-cell entity-cell--button" to={adminPath(`books/${row.id}`)}>
                  <BookCover assetId={(row as any).cover_asset_id} title={row.title_ar} />
                  <div>
                    <strong>{row.title_ar}</strong>
                    <small>{row.age_min}–{row.age_max} سنوات</small>
                  </div>
                </Link>
              </td>
              {columns.isVisible('series') && <td>{row.series_title || '—'}</td>}
              {columns.isVisible('type') && (
                <td>
                  <span className="book-type-pill" style={{ display: 'inline-block' }}>
                    {typeIcons[row.type]} {(typeLabels as any)[locale][row.type] ?? row.type}
                  </span>
                </td>
              )}
              {columns.isVisible('pages') && <td>{Array.isArray(row.pages) ? row.pages.length : 0}</td>}
              {columns.isVisible('status') && <td><StatusBadge status={row.status as any} /></td>}
              {columns.isVisible('updated') && <td dir="ltr">{(row as any).updated_at ? formatDate(String((row as any).updated_at).replace(' ', 'T') + 'Z', locale) : '—'}</td>}
              <td>
                <Link className="button button--ghost button--small" to={adminPath(`books/${row.id}`)}>
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
    <div className="book-studio-grid" role="list">
      {rows.map((row) => {
        const pagesCount = Array.isArray(row.pages) ? row.pages.length : 0
        return (
          <article key={row.id} className="book-card-item" role="listitem">
            <Link to={adminPath(`books/${row.id}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ position: 'relative' }}>
                <BookCover assetId={(row as any).cover_asset_id} title={row.title_ar} size="card" />
                <div className="book-card-item__overlay-badges">
                  <span className="book-type-pill">
                    {typeIcons[row.type]} {(typeLabels as any)[locale][row.type] ?? row.type}
                  </span>
                  <StatusBadge status={row.status as any} />
                </div>
                <div className="book-pages-pill">
                  <Icon name="books" size={13} />
                  <span>{text.pagesCount(pagesCount)}</span>
                </div>
              </div>
            </Link>

            <div className="book-card-item__body">
              <Link to={adminPath(`books/${row.id}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <h3 className="book-card-item__title">{row.title_ar}</h3>
              </Link>
              <div className="book-card-item__series">{row.series_title || 'مستقل / بلا سلسلة'}</div>
              
              <div className="book-card-item__tags">
                <span className="character-trait-pill">{row.age_min}–{row.age_max} سنوات</span>
                {row.type === 'audio_story' && <span className="book-audio-badge">🎧 {text.audioNarration}</span>}
                {row.type === 'interactive' && <span className="book-audio-badge">⚡ {text.interactiveBadge}</span>}
              </div>
            </div>

            <footer className="book-card-item__footer">
              <Link className="button button--primary button--small" to={adminPath(`books/${row.id}`)}>
                <Icon name="edit" size={14} />
                {text.open}
              </Link>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                {(row as any).updated_at ? formatDate(String((row as any).updated_at).replace(' ', 'T') + 'Z', locale) : ''}
              </span>
            </footer>
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
            title={!canCreate ? text.createDenied : undefined}
            onClick={() => {
              setForm(emptyNewBook)
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
            <div className="kpi-glass-card__icon-bubble"><Icon name="books" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.total, locale)}</div>
          <div className="kpi-glass-card__caption">مكتبة الكتب الرقمية</div>
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
            <span className="kpi-glass-card__label">{text.missingPages}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="clock" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.missingPages, locale)}</div>
          <div className="kpi-glass-card__caption">تحتاج استكمال الصفحات</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.missingCover}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="media" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.missingCover, locale)}</div>
          <div className="kpi-glass-card__caption">بانتظار الغلاف الفني</div>
        </div>
      </section>

      {/* 3. QUICK TYPE FILTER STRIP */}
      <section className="catalog-control-strip">
        <button
          type="button"
          className={`filter-pill ${!list.filters.type ? 'active' : ''}`}
          onClick={() => list.setFilter('type', '')}
        >
          ✨ {text.allTypes} ({rows.length})
        </button>
        {types.map((t) => (
          <button
            key={t}
            type="button"
            className={`filter-pill ${list.filters.type === t ? 'active' : ''}`}
            onClick={() => list.setFilter('type', list.filters.type === t ? '' : t)}
          >
            {typeIcons[t]} {(typeLabels as any)[locale][t]}
          </button>
        ))}
      </section>

      {/* 4. MAIN CATALOG PANEL */}
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
                <SavedViewsMenu storageKey="books" currentSearch={list.search} onApply={(s) => navigate(`${adminPath('books')}${s}`)} />
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

      {/* 5. ADD NEW BOOK LIQUID GLASS MODAL */}
      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={text.create}>
        <form className="entity-form" onSubmit={handleCreateSubmit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          
          <label className="field">
            <span>عنوان الكتاب بالعربية *</span>
            <input
              type="text"
              required
              placeholder="مثال: مغامرات الأرنب الذكي"
              value={form.title_ar}
              onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span>نوع الكتاب *</span>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as StoryType })}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {typeIcons[t]} {(typeLabels as any)[locale][t]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>السلسلة التابع لها</span>
              <select
                value={form.series_id}
                onChange={(e) => setForm({ ...form, series_id: e.target.value })}
              >
                <option value="">كتاب مستقل (بدون سلسلة)</option>
                {series.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title_ar}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-grid form-grid--three">
            <label className="field">
              <span>أدنى عمر (سنوات)</span>
              <input
                type="number"
                min={2}
                max={16}
                value={form.age_min}
                onChange={(e) => setForm({ ...form, age_min: Number(e.target.value) })}
              />
            </label>

            <label className="field">
              <span>أقصى عمر (سنوات)</span>
              <input
                type="number"
                min={3}
                max={18}
                value={form.age_max}
                onChange={(e) => setForm({ ...form, age_max: Number(e.target.value) })}
              />
            </label>

            <label className="field">
              <span>نمط التفاعل</span>
              <select
                value={form.interaction_mode}
                onChange={(e) => setForm({ ...form, interaction_mode: e.target.value as InteractionMode })}
              >
                <option value="tap">قراءة بالنقر (Tap)</option>
                <option value="guided">قراءة موجهة (Guided)</option>
                <option value="mixed">مختلط (Mixed)</option>
                <option value="independent">ذاتي (Independent)</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>نبذة مختصرة عن فكرة الكتاب</span>
            <textarea
              rows={3}
              placeholder="اكتب وصفاً موجزاً للحبكة أو القيم التربوية..."
              value={form.description_ar}
              onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
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
            <button
              className="button button--primary"
              type="submit"
              disabled={saving}
            >
              <Icon name="check" size={16} />
              {saving ? text.saving : text.saveBook}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
