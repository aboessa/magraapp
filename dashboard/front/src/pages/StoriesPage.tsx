import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { ViewSwitcher, useStoredViewMode } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { StoryThumbnail } from '../components/StoryThumbnail'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate, formatNumber } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import { useQuickCreate } from '../hooks/useQuickCreate'
import { useUrlListState } from '../hooks/useUrlListState'
import type { ContentStatus, SeriesRecord, StoryLibraryRow, StoryLibrarySummary, StoryType, VisualStyleRecord } from '../types/api'

const types: StoryType[] = ['picture_book', 'audio_story', 'interactive', 'comic']

const typeLabels: Record<'ar' | 'en', Record<StoryType, string>> = {
  ar: { picture_book: 'كتاب مصور', audio_story: 'قصة صوتية', interactive: 'قصة تفاعلية', comic: 'كوميكس' },
  en: { picture_book: 'Picture book', audio_story: 'Audio story', interactive: 'Interactive', comic: 'Comic' },
}

const statuses: ContentStatus[] = [
  'draft',
  'writing',
  'review_edu',
  'review_lang',
  'review_sharia',
  'production',
  'qa',
  'ready',
  'scheduled',
  'published',
]

type StoryForm = {
  title_ar: string
  slug: string
  series_id: string
  type: StoryType
  age_min: string
  age_max: string
  visual_style_id: string
  languages: string
  description_ar: string
  status: ContentStatus
}

const initialForm: StoryForm = {
  title_ar: '',
  slug: '',
  series_id: '',
  type: 'picture_book',
  age_min: '3',
  age_max: '5',
  visual_style_id: '',
  languages: 'ar',
  description_ar: '',
  status: 'draft',
}

const copy = {
  ar: {
    eyebrow: 'المكتبة',
    title: 'القصص والكوميكس',
    intro: 'مكتبة القصص: غلاف حقيقي، صفحات، نصوص وسرد وتغطية محسوبة لكل لغة.',
    create: 'قصة جديدة',
    createDenied: 'إنشاء قصة يحتاج صلاحية الإنشاء.',
    editDenied: 'التعديل يحتاج صلاحية تعديل البيانات.',
    archiveDenied: 'الأرشفة تحتاج صلاحية الأرشفة.',
    summaryTotal: 'قصة',
    summaryReady: 'جاهزة',
    summaryPartial: 'جزئية',
    summaryEmpty: 'فارغة',
    summaryPublished: 'منشورة',
    summaryReview: 'قيد المراجعة',
    summaryArtwork: 'صور ناقصة',
    summaryCover: 'بلا غلاف',
    search: 'بحث بالعنوان أو المعرف...',
    filterType: 'النوع',
    typeAll: 'كل الأنواع',
    filterStatus: 'الحالة',
    statusAll: 'كل الحالات',
    filterReadiness: 'الجاهزية',
    readinessAll: 'أي جاهزية',
    readinessReady: 'جاهزة',
    readinessPartial: 'جزئية',
    readinessEmpty: 'فارغة',
    filterMissing: 'النواقص',
    missingAll: 'كل الحالات',
    missingPages: 'بلا صفحات',
    missingArtwork: 'صور ناقصة',
    missingNarration: 'سرد ناقص',
    missingTranslation: 'ترجمة ناقصة',
    missingCover: 'بلا غلاف',
    filterSeries: 'السلسلة',
    seriesAll: 'كل السلاسل',
    colCover: 'الغلاف',
    colStory: 'القصة',
    colSeries: 'السلسلة',
    colPlanet: 'الكوكب',
    colType: 'النوع',
    colAge: 'العمر',
    colPages: 'الصفحات',
    colText: 'النص',
    colNarration: 'السرد',
    colArtwork: 'الرسوم',
    colReadiness: 'الجاهزية',
    colStatus: 'الحالة',
    colUpdated: 'آخر تعديل',
    openWorkspace: 'مساحة العمل',
    openBuilder: 'فتح المحرر',
    actions: 'إجراءات',
    edit: 'تعديل',
    archive: 'أرشفة',
    addFirstPage: 'إضافة الصفحة الأولى',
    noPages: 'بلا صفحات',
    noCover: 'بلا غلاف',
    pagesLabel: 'صفحة',
    of: 'من',
    never: 'لا تعديل مسجّل',
    loading: 'جارٍ تحميل القصص...',
    loadError: 'تعذر تحميل القصص',
    retry: 'إعادة المحاولة',
    denied: 'لا تملك صلاحية عرض القصص. اطلب صلاحية «view» من مدير النظام.',
    empty: 'لا قصص بعد',
    emptyDesc: 'أنشئ أول قصة لتبدأ بناء مكتبة القصص والكوميكس.',
    noResults: 'لا قصة تطابق هذه الفلترة',
    noResultsDesc: 'وسّع الفلترة أو امسحها لعرض كل القصص.',
    clear: 'مسح الفلاتر',
    formCreate: 'إنشاء قصة',
    formEdit: 'تعديل القصة',
    titleAr: 'عنوان القصة *',
    slug: 'المعرّف (slug)',
    slugHint: 'يُستخدم في الرابط. اتركه فارغًا ليُنشأ تلقائيًا.',
    series: 'السلسلة',
    seriesNone: 'بلا سلسلة',
    typeField: 'النوع',
    ageMin: 'العمر الأدنى',
    ageMax: 'العمر الأقصى',
    style: 'النمط البصري',
    styleNone: 'بلا نمط',
    languagesField: 'اللغات',
    languagesHint: 'افصل بفاصلة، مثال: ar,en',
    description: 'الوصف',
    statusField: 'الحالة',
    statusHint: 'تُحدّد مرحلة القصة في سير العمل.',
    cancel: 'إلغاء',
    save: 'حفظ',
    saving: 'جارٍ الحفظ...',
    required: 'العنوان مطلوب.',
    saveError: 'تعذر حفظ القصة',
    archiveConfirm: (title: string) => `أرشفة «${title}»؟`,
  },
  en: {
    eyebrow: 'Library',
    title: 'Stories & comics',
    intro: 'Story library: real cover, pages, text and narration coverage counted per language.',
    create: 'New story',
    createDenied: 'Creating a story needs the create permission.',
    editDenied: 'Editing needs the edit_metadata permission.',
    archiveDenied: 'Archiving needs the archive permission.',
    summaryTotal: 'stories',
    summaryReady: 'ready',
    summaryPartial: 'partial',
    summaryEmpty: 'empty',
    summaryPublished: 'published',
    summaryReview: 'in review',
    summaryArtwork: 'artwork missing',
    summaryCover: 'no cover',
    search: 'Search by title or slug...',
    filterType: 'Type',
    typeAll: 'All types',
    filterStatus: 'Status',
    statusAll: 'All statuses',
    filterReadiness: 'Readiness',
    readinessAll: 'Any readiness',
    readinessReady: 'Ready',
    readinessPartial: 'Partial',
    readinessEmpty: 'Empty',
    filterMissing: 'Missing',
    missingAll: 'All',
    missingPages: 'No pages',
    missingArtwork: 'Artwork missing',
    missingNarration: 'Narration missing',
    missingTranslation: 'Translation missing',
    missingCover: 'No cover',
    filterSeries: 'Series',
    seriesAll: 'All series',
    colCover: 'Cover',
    colStory: 'Story',
    colSeries: 'Series',
    colPlanet: 'Planet',
    colType: 'Type',
    colAge: 'Age',
    colPages: 'Pages',
    colText: 'Text',
    colNarration: 'Narration',
    colArtwork: 'Artwork',
    colReadiness: 'Readiness',
    colStatus: 'Status',
    colUpdated: 'Updated',
    openWorkspace: 'Workspace',
    openBuilder: 'Open editor',
    actions: 'Actions',
    edit: 'Edit',
    archive: 'Archive',
    addFirstPage: 'Add first page',
    noPages: 'No pages',
    noCover: 'No cover',
    pagesLabel: 'pages',
    of: 'of',
    never: 'No recorded update',
    loading: 'Loading stories...',
    loadError: 'Unable to load stories',
    retry: 'Try again',
    denied: 'You do not have permission to view stories. Ask a system administrator for the “view” permission.',
    empty: 'No stories yet',
    emptyDesc: 'Create the first story to start building the library.',
    noResults: 'No story matches this filter',
    noResultsDesc: 'Widen or clear the filter to see every story.',
    clear: 'Clear filters',
    formCreate: 'Create story',
    formEdit: 'Edit story',
    titleAr: 'Arabic title *',
    slug: 'Slug',
    slugHint: 'Used in the URL. Leave empty to auto-generate.',
    series: 'Series',
    seriesNone: 'No series',
    typeField: 'Type',
    ageMin: 'Min age',
    ageMax: 'Max age',
    style: 'Visual style',
    styleNone: 'No style',
    languagesField: 'Languages',
    languagesHint: 'Comma-separated, e.g. ar,en',
    description: 'Description',
    statusField: 'Status',
    statusHint: 'Determines the workflow stage of the story.',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    required: 'Title is required.',
    saveError: 'Unable to save story',
    archiveConfirm: (title: string) => `Archive “${title}”?`,
  },
}

const DEFAULT_FILTERS = {
  type: '',
  status: '',
  readiness: '',
  missing: '',
  series_id: '',
  planet: '',
}

const FILTER_FIELDS = (
  text: typeof copy['ar'],
  locale: 'ar' | 'en',
  series: SeriesRecord[],
): FilterField[] => [
  {
    key: 'type',
    label: text.filterType,
    type: 'select',
    options: [
      { value: '', label: text.typeAll },
      ...types.map((item) => ({ value: item, label: typeLabels[locale][item] })),
    ],
  },
  {
    key: 'readiness',
    label: text.filterReadiness,
    type: 'select',
    options: [
      { value: '', label: text.readinessAll },
      { value: 'ready', label: text.readinessReady },
      { value: 'partial', label: text.readinessPartial },
      { value: 'empty', label: text.readinessEmpty },
    ],
  },
  {
    key: 'status',
    label: text.filterStatus,
    type: 'select',
    options: [
      { value: '', label: text.statusAll },
      ...statuses.map((item) => ({ value: item, label: item })),
    ],
  },
  {
    key: 'missing',
    label: text.filterMissing,
    type: 'select',
    advanced: true,
    options: [
      { value: '', label: text.missingAll },
      { value: 'pages', label: text.missingPages },
      { value: 'artwork', label: text.missingArtwork },
      { value: 'narration', label: text.missingNarration },
      { value: 'translation', label: text.missingTranslation },
      { value: 'cover', label: text.missingCover },
    ],
  },
  {
    key: 'series_id',
    label: text.filterSeries,
    type: 'select',
    advanced: true,
    options: [
      { value: '', label: text.seriesAll },
      ...series.map((item) => ({
        value: item.id,
        label: locale === 'en' ? item.title_en || item.title_ar : item.title_ar,
      })),
    ],
  },
]

const COLUMNS: ColumnDefinition[] = [
  { key: 'story', label: 'colStory', locked: true },
  { key: 'series', label: 'colSeries' },
  { key: 'planet', label: 'colPlanet' },
  { key: 'type', label: 'colType' },
  { key: 'pages', label: 'colPages' },
  { key: 'text', label: 'colText' },
  { key: 'narration', label: 'colNarration' },
  { key: 'artwork', label: 'colArtwork' },
  { key: 'readiness', label: 'colReadiness' },
  { key: 'status', label: 'colStatus' },
  { key: 'age', label: 'colAge' },
  { key: 'updated', label: 'colUpdated' },
]

function Ratio({ done, total }: { done: number; total: number }) {
  // keep raw digits (no formatNumber) because Arabic-Indic digits
  // in an LTR badge would mix numeral systems with surrounding text
  const tone = total === 0 ? 'muted' : done >= total ? 'ok' : done > 0 ? 'warn' : 'bad'
  return (
    <span className={`ratio ratio--${tone}`} dir="ltr">
      {done}/{total}
    </span>
  )
}

function CoverageChips({
  row,
  kind,
}: {
  row: StoryLibraryRow
  kind: 'text' | 'narration'
}) {
  // filter declared languages only; undeclared coverage is not actionable
  const items = row.coverage.filter((entry) => entry.declared)
  if (!items.length) return <span className="chip chip--muted">—</span>
  return (
    <span className="chip-list">
      {items.map((entry) => {
        const done = kind === 'text' ? entry.text_done : entry.narration_done
        // do not mix Arabic-Indic numerals with LTR badge; keep raw latin digits and LTR
        return (
          <span key={entry.language} className="chip" dir="ltr">
            {entry.language.toUpperCase()} {done}/{entry.total}
          </span>
        )
      })}
    </span>
  )
}

function ReadinessBadge({ readiness }: { readiness: StoryLibraryRow['readiness'] }) {
  const className =
    readiness === 'ready'
      ? 'readiness readiness--ready'
      : readiness === 'empty'
        ? 'readiness readiness--empty'
        : 'readiness readiness--partial'
  const label = readiness === 'ready' ? 'ready' : readiness === 'empty' ? 'empty' : 'partial'
  return <span className={className}>{label}</span>
}

export function StoriesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { defaultView: 'table' })
  const { query, filters } = list

  const [storedView, setStoredView] = useStoredViewMode('stories', 'table')
  const view: ViewMode = list.rawView === 'table' || list.rawView === 'grid' ? (list.rawView as ViewMode) : storedView
  const setView = (mode: ViewMode) => {
    setStoredView(mode)
    list.setView(mode)
  }

  const [rows, setRows] = useState<StoryLibraryRow[]>([])
  const [summary, setSummary] = useState<StoryLibrarySummary | null>(null)
  const [series, setSeries] = useState<SeriesRecord[]>([])
  const [styles, setStyles] = useState<VisualStyleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StoryLibraryRow | null>(null)
  const [form, setForm] = useState<StoryForm>(initialForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = hasPermission('create')
  const canEdit = hasPermission('edit_metadata')
  const canArchive = hasPermission('archive')

  const columns = useColumnPreferences('stories', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.storyLibrary({
        q: query || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        readiness: filters.readiness || undefined,
        missing: filters.missing || undefined,
        series_id: filters.series_id || undefined,
        planet: filters.planet || undefined,
      })
      setRows(response.data)
      // summary lives in meta.summary per PaginatedEnvelope extension
      const meta = (response as unknown as { meta: { summary: StoryLibrarySummary } }).meta
      setSummary(meta.summary)
      setDenied(false)
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) {
        setDenied(true)
        setError(caught.message)
      } else {
        setError(caught instanceof Error ? caught.message : text.loadError)
      }
    } finally {
      setLoading(false)
    }
  }, [query, filters.type, filters.status, filters.readiness, filters.missing, filters.series_id, filters.planet, text.loadError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    void api
      .series({ status: 'all', limit: 100, planet: filters.planet || undefined })
      .then((response) => setSeries(response.data.filter((item) => item.status !== 'archived')))
      .catch(() => setSeries([]))
    void api
      .visualStyles()
      .then((response) => setStyles(response.data))
      .catch(() => setStyles([]))
  }, [filters.planet])

  useQuickCreate(() => openCreate())

  function openCreate() {
    if (!canCreate) return
    setEditing(null)
    setForm({ ...initialForm, series_id: series[0]?.id ?? '', visual_style_id: styles[0]?.id ?? '' })
    setFormError('')
    setOpen(true)
  }

  function openEdit(row: StoryLibraryRow) {
    if (!canEdit) return
    setEditing(row)
    setForm({
      title_ar: row.title_ar,
      slug: row.slug,
      series_id: row.series_id ?? '',
      type: row.type,
      age_min: String(row.age_min),
      age_max: String(row.age_max),
      visual_style_id: (row as unknown as { visual_style_id?: string }).visual_style_id ?? '',
      languages: row.languages.join(','),
      description_ar: row.description_ar ?? '',
      status: row.status,
    })
    setFormError('')
    setOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.title_ar.trim()) {
      setFormError(text.required)
      return
    }
    setSaving(true)
    setFormError('')
    const languages = form.languages
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const default_language = languages[0] || 'ar'
    const payload = {
      title_ar: form.title_ar.trim(),
      slug: form.slug.trim(),
      series_id: form.series_id || null,
      type: form.type,
      age_min: Number(form.age_min),
      age_max: Number(form.age_max),
      visual_style_id: form.visual_style_id || null,
      languages,
      default_language,
      description_ar: form.description_ar.trim() || null,
      status: form.status,
    }
    try {
      if (editing) await api.updateStory(editing.id, payload)
      else await api.createStory(payload)
      setOpen(false)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function archive(row: StoryLibraryRow) {
    if (!canArchive) return
    if (!window.confirm(text.archiveConfirm(row.title_ar))) return
    try {
      await api.archiveStory(row.id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }

  const filtersActive = list.activeFilterCount > 0 || !!query

  const summaryCells = useMemo(() => {
    if (!summary) return []
    // 7 cells: total not button, ready/partial/empty with readiness filter, published with status, artwork/cover with missing
    return [
      { key: 'total', label: text.summaryTotal, value: summary.total, tone: undefined as string | undefined, filters: undefined as Record<string, string> | undefined },
      { key: 'ready', label: text.summaryReady, value: summary.ready, tone: 'ok', filters: { readiness: 'ready' } },
      { key: 'partial', label: text.summaryPartial, value: summary.partial, tone: 'warn', filters: { readiness: 'partial' } },
      { key: 'empty', label: text.summaryEmpty, value: summary.empty, tone: 'bad', filters: { readiness: 'empty' } },
      { key: 'published', label: text.summaryPublished, value: summary.published, tone: 'ok', filters: { status: 'published' } },
      { key: 'artwork', label: text.summaryArtwork, value: summary.missing_artwork, tone: 'warn', filters: { missing: 'artwork' } },
      { key: 'cover', label: text.summaryCover, value: summary.missing_cover, tone: 'warn', filters: { missing: 'cover' } },
    ]
  }, [summary, text])

  const rowMenu = (row: StoryLibraryRow) => (
    <div className="table-actions">
      <Link className="icon-button icon-button--small" to={adminPath(`stories/${row.id}`)} title={text.openWorkspace}>
        <Icon name="eye" size={15} />
      </Link>
      <Link className="icon-button icon-button--small" to={adminPath(`stories/${row.id}/builder`)} title={text.openBuilder}>
        <Icon name="edit" size={15} />
      </Link>
      <button className="icon-button icon-button--small" type="button" onClick={() => openEdit(row)} disabled={!canEdit} title={canEdit ? text.edit : text.editDenied}>
        <Icon name="edit" size={15} />
      </button>
      <button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void archive(row)} disabled={!canArchive} title={canArchive ? text.archive : text.archiveDenied}>
        <Icon name="archive" size={15} />
      </button>
    </div>
  )

  const table = (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table data-table--wide">
        <thead>
          <tr>
            <th>{text.colStory}</th>
            {columns.isVisible('series') && <th>{text.colSeries}</th>}
            {columns.isVisible('planet') && <th>{text.colPlanet}</th>}
            {columns.isVisible('type') && <th>{text.colType}</th>}
            {columns.isVisible('pages') && <th>{text.colPages}</th>}
            {columns.isVisible('text') && <th>{text.colText}</th>}
            {columns.isVisible('narration') && <th>{text.colNarration}</th>}
            {columns.isVisible('artwork') && <th>{text.colArtwork}</th>}
            {columns.isVisible('readiness') && <th>{text.colReadiness}</th>}
            {columns.isVisible('status') && <th>{text.colStatus}</th>}
            {columns.isVisible('age') && <th>{text.colAge}</th>}
            {columns.isVisible('updated') && <th>{text.colUpdated}</th>}
            <th>{text.actions}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="entity-cell" to={adminPath(`stories/${row.id}`)}>
                  <StoryThumbnail src={row.cover_url} alt={row.title_ar} title={row.title_ar} color={row.planet_color} size={44} />
                  <div>
                    <strong>{row.title_ar}</strong>
                    <small dir="ltr">{row.slug}</small>
                  </div>
                </Link>
              </td>
              {columns.isVisible('series') && <td>{row.series_title || '—'}</td>}
              {columns.isVisible('planet') && <td>{row.planet_name || '—'}</td>}
              {columns.isVisible('type') && <td>{typeLabels[locale][row.type]}</td>}
              {columns.isVisible('pages') && (
                <td dir="ltr">
                  {row.pages_total === 0 ? <span className="chip chip--muted">{text.noPages}</span> : <Ratio done={row.pages_with_image} total={row.pages_total} />}
                </td>
              )}
              {columns.isVisible('text') && (
                <td>
                  <CoverageChips row={row} kind="text" />
                </td>
              )}
              {columns.isVisible('narration') && (
                <td>
                  <CoverageChips row={row} kind="narration" />
                </td>
              )}
              {columns.isVisible('artwork') && (
                <td dir="ltr">
                  <Ratio done={row.pages_with_image} total={row.pages_total} />
                </td>
              )}
              {columns.isVisible('readiness') && (
                <td>
                  <ReadinessBadge readiness={row.readiness} />
                </td>
              )}
              {columns.isVisible('status') && (
                <td>
                  <StatusBadge status={row.status} />
                </td>
              )}
              {columns.isVisible('age') && (
                <td dir="ltr">
                  {formatNumber(row.age_min, locale)}–{formatNumber(row.age_max, locale)}
                </td>
              )}
              {columns.isVisible('updated') && (
                <td dir="ltr">{row.updated_at ? formatDate(row.updated_at.replace(' ', 'T') + 'Z', locale) : text.never}</td>
              )}
              <td>{rowMenu(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const cards = (
    <div className="story-grid" role="list">
      {rows.map((row) => (
        <article key={row.id} className="story-card" role="listitem">
          <div className="story-card__media">
            <StoryThumbnail src={row.cover_url} alt={row.title_ar} title={row.title_ar} color={row.planet_color} fill />
            {!row.cover_url && <span className="story-card__badge">{text.noCover}</span>}
            <span className="story-card__type">{typeLabels[locale][row.type]}</span>
          </div>
          <div className="story-card__body">
            <h3>
              <Link className="story-card__link" to={adminPath(`stories/${row.id}`)}>
                {row.title_ar}
              </Link>
            </h3>
            <p className="story-card__where">
              {[row.series_title, row.planet_name].filter(Boolean).join(' · ') || '—'}
            </p>
            {row.pages_total === 0 ? (
              <p className="story-card__facts">
                <Link className="button button--ghost button--small" to={adminPath(`stories/${row.id}/builder`)}>
                  <Icon name="plus" size={14} />
                  {text.addFirstPage}
                </Link>
              </p>
            ) : (
              <p className="story-card__facts">
                <span>
                  {formatNumber(row.pages_total, locale)} {text.pagesLabel} · {formatNumber(row.pages_with_image, locale)} {text.of} {formatNumber(row.pages_total, locale)} {text.colArtwork}
                </span>
                <span>
                  <CoverageChips row={row} kind="text" /> · <CoverageChips row={row} kind="narration" />
                </span>
              </p>
            )}
          </div>
          <footer className="story-card__foot">
            <ReadinessBadge readiness={row.readiness} />
            <StatusBadge status={row.status} />
            <Link className="button button--ghost button--small" to={adminPath(`stories/${row.id}/builder`)}>
              {text.openBuilder}
            </Link>
          </footer>
        </article>
      ))}
    </div>
  )

  const skeleton = (
    <div className="story-grid" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="story-card story-card--skeleton">
          <div className="story-card__media" />
          <div className="story-card__body">
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--short" />
            <span className="skeleton-line" />
          </div>
          <div className="story-card__foot">
            <span className="skeleton-chip" />
            <span className="skeleton-chip" />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--primary" type="button" onClick={openCreate} disabled={!canCreate} title={canCreate ? undefined : text.createDenied}>
            <Icon name="plus" size={16} />
            {text.create}
          </button>
        </div>
      </section>

      {summary && (
        <section className="planet-summary" aria-label={text.title}>
          {summaryCells.map((cell) => {
            const body = (
              <>
                <strong>{formatNumber(cell.value, locale)}</strong>
                <span>{cell.label}</span>
              </>
            )
            const tone = cell.value > 0 && cell.tone ? ` planet-summary__cell--${cell.tone}` : ''
            return cell.filters ? (
              <button key={cell.key} type="button" className={`planet-summary__cell planet-summary__cell--button${tone}`} onClick={() => list.setFilters(cell.filters!)}>
                {body}
              </button>
            ) : (
              <div key={cell.key} className={`planet-summary__cell${tone}`}>
                {body}
              </div>
            )
          })}
        </section>
      )}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{text.title}</span>
            <h3>
              {formatNumber(rows.length, locale)} <span className="title-count">{text.pagesLabel}</span>
            </h3>
          </div>
          <ListToolbar
            searchValue={query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={FILTER_FIELDS(text, locale, series)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')}
            trailing={
              <>
                <SavedViewsMenu storageKey="stories" currentSearch={list.search} onApply={(search) => navigate(`${adminPath('stories')}${search}`)} />
                {view === 'table' && (
                  <ColumnManager
                    columns={COLUMNS.map((column) => ({ ...column, label: text[column.label as keyof typeof text] as string }))}
                    hidden={columns.hidden}
                    onToggle={columns.toggle}
                    onReset={columns.reset}
                  />
                )}
                <ViewSwitcher value={view} onChange={setView} modes={['table', 'grid']} locale={locale} />
              </>
            }
          />
        </header>

        {denied ? (
          <ErrorState message={error || text.denied} />
        ) : loading && !rows.length ? (
          <>
            <p className="planet-loading" role="status" aria-live="polite">
              {text.loading}
            </p>
            {skeleton}
          </>
        ) : error && !rows.length ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : rows.length === 0 ? (
          filtersActive ? (
            <EmptyState title={text.noResults} description={text.noResultsDesc} action={<button className="button button--ghost" type="button" onClick={list.clearFilters}>{text.clear}</button>} />
          ) : (
            <EmptyState
              title={text.empty}
              description={text.emptyDesc}
              action={
                canCreate ? (
                  <button className="button button--primary" type="button" onClick={openCreate}>
                    <Icon name="plus" size={16} />
                    {text.create}
                  </button>
                ) : undefined
              }
            />
          )
        ) : view === 'grid' ? (
          cards
        ) : (
          table
        )}

        {error && rows.length > 0 && (
          <div className="inline-alert inline-alert--error" role="alert">
            {error}
          </div>
        )}
      </section>

      <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? text.formEdit : text.formCreate}>
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>{text.titleAr}</span>
              <input autoFocus value={form.title_ar} onChange={(event) => setForm({ ...form, title_ar: event.target.value })} />
            </label>
            <label className="field">
              <span>{text.slug}</span>
              <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
              <small>{text.slugHint}</small>
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>{text.series}</span>
              <select value={form.series_id} onChange={(event) => setForm({ ...form, series_id: event.target.value })}>
                <option value="">{text.seriesNone}</option>
                {series.map((item) => (
                  <option value={item.id} key={item.id}>
                    {locale === 'en' ? item.title_en || item.title_ar : item.title_ar}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{text.typeField}</span>
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as StoryType })}>
                {types.map((item) => (
                  <option value={item} key={item}>
                    {typeLabels[locale][item]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.ageMin}</span>
              <input type="number" min={0} value={form.age_min} onChange={(event) => setForm({ ...form, age_min: event.target.value })} />
            </label>
            <label className="field">
              <span>{text.ageMax}</span>
              <input type="number" min={0} value={form.age_max} onChange={(event) => setForm({ ...form, age_max: event.target.value })} />
            </label>
            <label className="field">
              <span>{text.style}</span>
              <select value={form.visual_style_id} onChange={(event) => setForm({ ...form, visual_style_id: event.target.value })}>
                <option value="">{text.styleNone}</option>
                {styles.map((item) => (
                  <option value={item.id} key={item.id}>
                    {locale === 'en' ? item.name_en : item.name_ar}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>{text.languagesField}</span>
            <input value={form.languages} onChange={(event) => setForm({ ...form, languages: event.target.value })} />
            <small>{text.languagesHint}</small>
          </label>

          <label className="field">
            <span>{text.description}</span>
            <textarea rows={3} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })} />
          </label>

          <label className="field">
            <span>{text.statusField}</span>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ContentStatus })}>
              {statuses.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
            <small>{text.statusHint}</small>
          </label>

          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setOpen(false)} disabled={saving}>
              {text.cancel}
            </button>
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? text.saving : text.save}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
