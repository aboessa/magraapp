import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { EmptyState, ErrorState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { ViewSwitcher, useStoredViewMode } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { PlanetEditorDrawer } from '../components/PlanetEditorDrawer'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate, formatNumber } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import { useUrlListState } from '../hooks/useUrlListState'
import { useQuickCreate } from '../hooks/useQuickCreate'
import type { PlanetListRow, PlanetsSummary } from '../types/api'

/**
 * فهرس الكواكب: تجربة تصفّح تشغيلية لا شبكة بطاقات فارغة.
 *
 * ## ما كان
 *
 * الصفحة كانت تقرأ `GET /admin/planets` وتعرض لكل كوكب اسمًا ولونًا وعدّادَي
 * سلاسل وأصول، وتفلتر بالبحث في المتصفح، وتربط زرّها الوحيد بصفحة التصنيفات.
 * لم يكن ممكنًا معرفة أي كوكب فيه محتوى منشور، ولا أيّها بلا صورة، ولا أيّها
 * متعطّل في الإنتاج، إلا بفتح تسعة كواكب واحدًا واحدًا.
 *
 * ## ما صار
 *
 * الخادم يجمّع لكل كوكب مؤشّراته في استعلام واحد (`routes/adminPlanets.ts`)،
 * فتصير الصفحة قادرة على الإجابة عن «ما الذي يحتاج عملًا» من الفهرس نفسه:
 * ملخّص للمجموعة كلها في الرأس، مؤشّرات لكل بطاقة، فلاتر على إشارات حقيقية،
 * وترتيب من الخادم. حالة الصفحة في العنوان، فرابط «الكواكب بلا صور» يُشارَك
 * ويعمل بعد التحديث.
 *
 * ## ما ليس هنا بقصد
 *
 * لا كانبان: حالة الكوكب عمود منطقي واحد (`is_active`) ولا سير عمل تحريري له،
 * فلوحة أعمدة ستكون عمودين أحدهما دائمًا فارغ. ولا «نشر كوكب»: لا حالة نشر في
 * المخطوطة، والتعطيل يُطلب من الخادم الذي يعيد أثره ويشترط تأكيدًا.
 */

const copy = {
  ar: {
    eyebrow: 'هيكل المحتوى',
    title: 'الكواكب',
    intro: 'كل كوكب مجال تنقّل مستقل تُبنى عليه السلاسل. هذه الشاشة تُظهر ما يحمله كل كوكب وما ينقصه قبل فتحه.',
    create: 'إضافة كوكب',
    createDenied: 'إضافة كوكب تحتاج صلاحية الإنشاء.',
    catalog: 'الفهرس',
    /// تسمية الشبكة مستقلّة عن تسمية الملخّص: لو تشاركتا نصًّا واحدًا لصار في
    /// الصفحة منطقتان بالاسم نفسه، فلا يميّزهما قارئ الشاشة ولا مُحدِّد اختبار.
    gridLabel: 'شبكة الكواكب',
    all: 'الكواكب',
    search: 'ابحث بالاسم أو المعرّف...',
    loading: 'جارٍ تحميل الكواكب...',
    loadError: 'تعذر تحميل الكواكب',
    retry: 'إعادة المحاولة',
    denied: 'لا تملك صلاحية عرض الكواكب. اطلب صلاحية «view» من مدير النظام.',
    empty: 'لا توجد كواكب',
    emptyDesc: 'أنشئ أول كوكب لتبدأ ربط السلاسل به.',
    noResults: 'لا كوكب يطابق هذه الفلترة',
    noResultsDesc: 'وسّع الفلترة أو امسحها لعرض كل الكواكب.',
    clear: 'مسح الفلاتر',

    summaryTotal: 'كوكب',
    summaryActive: 'نشط',
    summaryInactive: 'معطَّل',
    summaryPublished: 'به محتوى منشور',
    summaryUnpublished: 'بلا محتوى منشور',
    summaryEmpty: 'بلا محتوى',
    summaryArtwork: 'صور ناقصة',
    summaryDescription: 'وصف ناقص',
    summaryBlockers: 'به عوائق إنتاج',

    status: 'الحالة',
    statusAll: 'كل الحالات',
    active: 'نشط',
    inactive: 'معطَّل',
    content: 'المحتوى',
    contentAll: 'كل الكواكب',
    contentHas: 'به محتوى',
    contentEmpty: 'بلا محتوى',
    contentPublished: 'به محتوى منشور',
    contentUnpublished: 'بلا محتوى منشور',
    artwork: 'الصور',
    artworkAll: 'أي حالة صور',
    artworkComplete: 'مكتملة',
    artworkMissing: 'ناقصة',
    description: 'الوصف',
    descriptionAll: 'أي وصف',
    descriptionComplete: 'موجود',
    descriptionMissing: 'ناقص',
    production: 'الإنتاج',
    productionAll: 'أي حالة إنتاج',
    productionHealthy: 'بلا عوائق',
    productionBlocked: 'به عوائق',
    localization: 'الترجمة الإنجليزية',
    localizationAll: 'أي حالة ترجمة',
    localizationComplete: 'كل السلاسل بعنوان إنجليزي',
    localizationIncomplete: 'سلاسل بلا عنوان إنجليزي',
    localizationHint: 'المقياس هو عنوان السلسلة الإنجليزي وحده. لا عمود عنوان فرنسي في المخطط، والعنوان العربي إلزامي — فلا يصلح أيٌّ منهما فلترًا. التفصيل الكامل في تبويب اللغات داخل الكوكب.',

    sort: 'الترتيب',
    sortOrder: 'ترتيب العرض',
    sortName: 'الاسم',
    sortUpdated: 'الأحدث تعديلًا',
    sortMost: 'الأكثر محتوى',
    sortLeast: 'الأقل محتوى',

    series: 'سلسلة',
    episodes: 'حلقة',
    stories: 'قصة',
    games: 'لعبة',
    books: 'كتاب',
    projects: 'نشاط',
    characters: 'شخصية',
    seasons: 'موسم',
    noContent: 'لا محتوى بعد',
    published: 'منشور',
    pipeline: 'في الخطّ',
    blockers: 'عائق إنتاج',
    reviews: 'مراجعة معلّقة',
    missingArtwork: 'صورة ناقصة',
    noArtwork: 'لا توجد صورة للكوكب',
    addArtwork: 'إضافة صورة',
    brokenArtwork: 'تعذّر تحميل الصورة المرتبطة',
    missingDescription: 'وصف ناقص',
    englishTitles: 'عنوان إنجليزي',
    updated: 'آخر تعديل للمحتوى',
    never: 'لا تعديل مسجّل',

    open: 'فتح مساحة العمل',
    actions: 'إجراءات',
    menu: 'إجراءات الكوكب',
    edit: 'تعديل',
    openContent: 'سلاسل هذا الكوكب',
    openMedia: 'وسائط الكوكب',
    openProduction: 'إنتاج الكوكب',
    addSeries: 'إضافة سلسلة هنا',
    archive: 'تعطيل الكوكب',
    reactivate: 'إعادة التنشيط',
    archiveDenied: 'التعطيل يحتاج صلاحية الأرشفة.',
    editDenied: 'التعديل يحتاج صلاحية تعديل البيانات.',
    archiveConfirm: (name: string, series: number, episodes: number, published: number) =>
      `تعطيل «${name}» يخفيه من كل اختيار جديد. يحمل ${series} سلسلة و${episodes} حلقة، منها ${published} منشورة تبقى منشورة. متابعة؟`,
    archiveError: 'تعذر تعطيل الكوكب',
    reactivateError: 'تعذر إعادة التنشيط',

    colArtwork: 'الصورة',
    colPlanet: 'الكوكب',
    colStatus: 'الحالة',
    colSeries: 'السلاسل',
    colEpisodes: 'الحلقات',
    colStories: 'القصص',
    colGames: 'الألعاب',
    colPublished: 'منشور',
    colBlockers: 'عوائق',
    colEnglish: 'إنجليزي',
    colUpdated: 'آخر تعديل',
    colActions: 'إجراءات',
    fixtureNote: 'العدّادات تستثني محتوى الاختبار.',
  },
  en: {
    eyebrow: 'Content structure',
    title: 'Planets',
    intro: 'Each planet is an independent navigation domain for series. This screen shows what each planet holds and what it is missing before you open it.',
    create: 'Add planet',
    createDenied: 'Adding a planet needs the create permission.',
    catalog: 'Index',
    gridLabel: 'Planet grid',
    all: 'Planets',
    search: 'Search by name or slug...',
    loading: 'Loading planets...',
    loadError: 'Unable to load planets',
    retry: 'Try again',
    denied: 'You do not have permission to view planets. Ask a system administrator for the “view” permission.',
    empty: 'No planets yet',
    emptyDesc: 'Create the first planet to start attaching series to it.',
    noResults: 'No planet matches this filter',
    noResultsDesc: 'Widen or clear the filter to see every planet.',
    clear: 'Clear filters',

    summaryTotal: 'planets',
    summaryActive: 'active',
    summaryInactive: 'disabled',
    summaryPublished: 'with published content',
    summaryUnpublished: 'without published content',
    summaryEmpty: 'empty',
    summaryArtwork: 'artwork missing',
    summaryDescription: 'description missing',
    summaryBlockers: 'with production blockers',

    status: 'State',
    statusAll: 'Any state',
    active: 'Active',
    inactive: 'Disabled',
    content: 'Content',
    contentAll: 'All planets',
    contentHas: 'Has content',
    contentEmpty: 'Empty',
    contentPublished: 'Has published content',
    contentUnpublished: 'Nothing published',
    artwork: 'Artwork',
    artworkAll: 'Any artwork state',
    artworkComplete: 'Complete',
    artworkMissing: 'Missing',
    description: 'Description',
    descriptionAll: 'Any description',
    descriptionComplete: 'Present',
    descriptionMissing: 'Missing',
    production: 'Production',
    productionAll: 'Any production state',
    productionHealthy: 'No blockers',
    productionBlocked: 'Has blockers',
    localization: 'English localization',
    localizationAll: 'Any localization state',
    localizationComplete: 'Every series has an English title',
    localizationIncomplete: 'Series missing an English title',
    localizationHint: 'Measured on the series English title alone. The schema has no French title column, and the Arabic title is mandatory, so neither works as a filter. The full breakdown lives in the planet Languages tab.',

    sort: 'Sort',
    sortOrder: 'Display order',
    sortName: 'Name',
    sortUpdated: 'Recently updated',
    sortMost: 'Most content',
    sortLeast: 'Least content',

    series: 'series',
    episodes: 'episodes',
    stories: 'stories',
    games: 'games',
    books: 'books',
    projects: 'activities',
    characters: 'characters',
    seasons: 'seasons',
    noContent: 'No content yet',
    published: 'published',
    pipeline: 'in pipeline',
    blockers: 'production blockers',
    reviews: 'pending reviews',
    missingArtwork: 'artwork missing',
    noArtwork: 'No planet artwork',
    addArtwork: 'Add artwork',
    brokenArtwork: 'The linked artwork failed to load',
    missingDescription: 'description missing',
    englishTitles: 'English titles',
    updated: 'Content last updated',
    never: 'No recorded update',

    open: 'Open workspace',
    actions: 'Actions',
    menu: 'Planet actions',
    edit: 'Edit',
    openContent: 'Series in this planet',
    openMedia: 'Planet media',
    openProduction: 'Planet production',
    addSeries: 'Add a series here',
    archive: 'Disable planet',
    reactivate: 'Reactivate',
    archiveDenied: 'Disabling needs the archive permission.',
    editDenied: 'Editing needs the edit_metadata permission.',
    archiveConfirm: (name: string, series: number, episodes: number, published: number) =>
      `Disabling “${name}” hides it from every new selection. It holds ${series} series and ${episodes} episodes, ${published} of them published, which stay published. Continue?`,
    archiveError: 'Unable to disable the planet',
    reactivateError: 'Unable to reactivate the planet',

    colArtwork: 'Artwork',
    colPlanet: 'Planet',
    colStatus: 'State',
    colSeries: 'Series',
    colEpisodes: 'Episodes',
    colStories: 'Stories',
    colGames: 'Games',
    colPublished: 'Published',
    colBlockers: 'Blockers',
    colEnglish: 'English',
    colUpdated: 'Updated',
    colActions: 'Actions',
    fixtureNote: 'Counters exclude test fixtures.',
  },
}

/// مفاتيح الفلاتر هي معاملات الاستعلام التي يقبلها `GET /admin/planets` بالحرف،
/// فرابط مفلتر من أي شاشة يفتح المجموعة نفسها بلا ترجمة وسيطة تنحرف.
const DEFAULT_FILTERS = { status: '', content: '', artwork: '', description: '', production: '', localization: '' }

const FILTER_FIELDS = (text: typeof copy['ar']): FilterField[] => [
  {
    key: 'status',
    label: text.status,
    type: 'select',
    options: [
      { value: '', label: text.statusAll },
      { value: 'active', label: text.active },
      { value: 'inactive', label: text.inactive },
    ],
    hint: text.summaryInactive,
  },
  {
    key: 'content',
    label: text.content,
    type: 'select',
    options: [
      { value: '', label: text.contentAll },
      { value: 'has', label: text.contentHas },
      { value: 'empty', label: text.contentEmpty },
      { value: 'published', label: text.contentPublished },
      { value: 'unpublished', label: text.contentUnpublished },
    ],
  },
  {
    key: 'production',
    label: text.production,
    type: 'select',
    options: [
      { value: '', label: text.productionAll },
      { value: 'healthy', label: text.productionHealthy },
      { value: 'blocked', label: text.productionBlocked },
    ],
  },
  /// ما دون هذا الحدّ فلاتر تدقيق اكتمال، تُستخدم عند تنظيف الكتالوج لا في التنقّل
  /// اليومي، فتُطوى تحت «فلاتر أخرى» ليبقى الحقل اليومي أبرز من النادر.
  {
    key: 'artwork',
    label: text.artwork,
    type: 'select',
    advanced: true,
    options: [
      { value: '', label: text.artworkAll },
      { value: 'complete', label: text.artworkComplete },
      { value: 'missing', label: text.artworkMissing },
    ],
  },
  {
    key: 'description',
    label: text.description,
    type: 'select',
    advanced: true,
    options: [
      { value: '', label: text.descriptionAll },
      { value: 'complete', label: text.descriptionComplete },
      { value: 'missing', label: text.descriptionMissing },
    ],
  },
  {
    key: 'localization',
    label: text.localization,
    type: 'select',
    advanced: true,
    options: [
      { value: '', label: text.localizationAll },
      { value: 'en_complete', label: text.localizationComplete },
      { value: 'en_incomplete', label: text.localizationIncomplete },
    ],
    hint: text.localizationHint,
  },
]

const COLUMNS: ColumnDefinition[] = [
  { key: 'planet', label: 'colPlanet', locked: true },
  { key: 'status', label: 'colStatus' },
  { key: 'series', label: 'colSeries' },
  { key: 'episodes', label: 'colEpisodes' },
  { key: 'stories', label: 'colStories' },
  { key: 'games', label: 'colGames' },
  { key: 'published', label: 'colPublished' },
  { key: 'blockers', label: 'colBlockers' },
  { key: 'english', label: 'colEnglish' },
  { key: 'updated', label: 'colUpdated' },
]

/// قائمة إجراءات البطاقة. تُبنى هنا لا في طبقة مشتركة لأن لكل كيان إجراءاته،
/// وقائمة عامة كانت ستعرض على الكوكب إجراءات لا مسار لها.
function CardMenu({
  label,
  children,
}: {
  label: string
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="popover-wrap planet-card__menu" ref={wrapper}>
      <button
        type="button"
        className="icon-button icon-button--small"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="grip" size={15} />
      </button>
      {open && (
        <div className="popover popover--menu" role="menu" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

function SummaryStrip({ summary, text, locale, onPick }: {
  summary: PlanetsSummary
  text: typeof copy['ar']
  locale: 'ar' | 'en'
  onPick: (filters: Partial<Record<keyof typeof DEFAULT_FILTERS, string>>) => void
}) {
  /// كل مقياس قابل للنقر يضبط الفلتر الذي يُنتج المجموعة نفسها بالضبط، فلا رقم
  /// بلا وجهة. المقاييس التي لا يوجد لها فلتر تبقى نصًّا لا زرًّا.
  const cells: Array<{
    key: string
    value: number
    label: string
    tone?: 'warn' | 'danger'
    filters?: Partial<Record<keyof typeof DEFAULT_FILTERS, string>>
  }> = [
    { key: 'total', value: summary.total, label: text.summaryTotal },
    { key: 'active', value: summary.active, label: text.summaryActive, filters: { status: 'active' } },
    { key: 'inactive', value: summary.inactive, label: text.summaryInactive, filters: { status: 'inactive' } },
    { key: 'published', value: summary.with_published_content, label: text.summaryPublished, filters: { content: 'published' } },
    { key: 'unpublished', value: summary.without_published_content, label: text.summaryUnpublished, tone: 'warn', filters: { content: 'unpublished' } },
    { key: 'empty', value: summary.empty, label: text.summaryEmpty, tone: 'warn', filters: { content: 'empty' } },
    { key: 'artwork', value: summary.missing_artwork, label: text.summaryArtwork, tone: 'warn', filters: { artwork: 'missing' } },
    { key: 'description', value: summary.missing_description, label: text.summaryDescription, tone: 'warn', filters: { description: 'missing' } },
    { key: 'blockers', value: summary.with_production_blockers, label: text.summaryBlockers, tone: 'danger', filters: { production: 'blocked' } },
  ]

  return (
    <section className="planet-summary" aria-label={text.catalog}>
      {cells.map((cell) => {
        const body = (
          <>
            <strong>{formatNumber(cell.value, locale)}</strong>
            <span>{cell.label}</span>
          </>
        )
        const tone = cell.value > 0 && cell.tone ? ` planet-summary__cell--${cell.tone}` : ''
        return cell.filters
          ? (
            <button
              key={cell.key}
              type="button"
              className={`planet-summary__cell planet-summary__cell--button${tone}`}
              onClick={() => onPick(cell.filters!)}
            >{body}</button>
          )
          : <div className={`planet-summary__cell${tone}`} key={cell.key}>{body}</div>
      })}
    </section>
  )
}

export function PlanetsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { defaultView: 'grid', defaultSort: 'order' })
  const { query, filters, sort } = list
  const columns = useColumnPreferences('planets', COLUMNS)

  /// طريقة العرض تُقرأ من العنوان أولًا ثم من تفضيل المتصفح. الترتيب مقصود:
  /// رابط يحمل `view=table` يجب أن يفتح جدولًا لمن أرسله ولمن استلمه معًا، بينما
  /// عنوان مجرَّد يستحقّ آخر اختيار للمستخدم لا الافتراض الثابت.
  const [storedView, setStoredView] = useStoredViewMode('planets', 'grid')
  const view: ViewMode = list.rawView === 'table' || list.rawView === 'grid'
    ? list.rawView
    : storedView === 'table' ? 'table' : 'grid'
  const setView = (mode: ViewMode) => { setStoredView(mode); list.setView(mode) }

  const [rows, setRows] = useState<PlanetListRow[]>([])
  const [summary, setSummary] = useState<PlanetsSummary | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [editing, setEditing] = useState<PlanetListRow | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  /// الكواكب التي فشل تحميل صورتها المرتبطة. الحالة محليّة لا في الخادم لأن الفشل
  /// قد يكون شبكيًّا لا بيانيًّا: إعادة التحميل تعطي الصورة فرصة أخرى بدلًا من
  /// تسجيل «لا صورة» في بيانات الكوكب.
  const [brokenArt, setBrokenArt] = useState<Record<string, boolean>>({})

  const canCreate = hasPermission('create')
  const canEdit = hasPermission('edit_metadata')
  const canArchive = hasPermission('archive')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // `include_inactive=1` دائمًا: الفهرس الإداري يجب أن يُظهر الكوكب المعطَّل،
      // وفلتر الحالة هو ما يضيّق لا الإخفاء الضمني.
      const response = await api.planetsCollection({
        include_inactive: 1,
        q: query || undefined,
        status: filters.status || undefined,
        content: filters.content || undefined,
        artwork: filters.artwork || undefined,
        description: filters.description || undefined,
        production: filters.production || undefined,
        localization: filters.localization || undefined,
        sort: sort || undefined,
      })
      setRows(response.data)
      setSummary(response.meta.summary)
      setNotes(response.meta.notes ?? [])
      setDenied(false)
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 403 || caught.status === 401)) {
        setDenied(true)
        setError(caught.message)
      } else {
        setError(caught instanceof Error ? caught.message : text.loadError)
      }
    } finally {
      setLoading(false)
    }
  }, [query, filters.status, filters.content, filters.artwork, filters.description, filters.production, sort, text.loadError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  useQuickCreate(() => openCreate())

  function openCreate() {
    if (!canCreate) return
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(planet: PlanetListRow) {
    setEditing(planet)
    setEditorOpen(true)
  }

  async function archive(planet: PlanetListRow) {
    const name = locale === 'en' ? planet.name_en || planet.name_ar : planet.name_ar
    setBusyId(planet.id)
    setError('')
    try {
      // الخادم يرفض أولًا بـ409 ويعيد أثر التعطيل، فالتأكيد يُبنى على أرقامه لا
      // على تقدير الواجهة، ثم يُعاد الطلب بـforce.
      await api.archivePlanet(planet.id)
      await load()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        const impact = (caught.payload as { impact?: { series: number; episodes: number; published_series: number } } | null)?.impact
        const confirmed = window.confirm(text.archiveConfirm(
          name,
          impact?.series ?? planet.health.series_total,
          impact?.episodes ?? planet.health.episodes_total,
          impact?.published_series ?? planet.health.series_published,
        ))
        if (!confirmed) { setBusyId(''); return }
        try {
          await api.archivePlanet(planet.id, true)
          await load()
        } catch (forced) {
          setError(forced instanceof Error ? forced.message : text.archiveError)
        }
      } else {
        setError(caught instanceof Error ? caught.message : text.archiveError)
      }
    } finally {
      setBusyId('')
    }
  }

  async function reactivate(planet: PlanetListRow) {
    setBusyId(planet.id)
    try {
      await api.updatePlanet(planet.id, { is_active: true })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.reactivateError)
    } finally {
      setBusyId('')
    }
  }

  const filtersActive = list.activeFilterCount > 0 || !!query

  const menuItems = (planet: PlanetListRow, close: () => void) => (
    <ul className="popover__list popover__list--menu">
      <li>
        <Link className="popover__item" role="menuitem" to={adminPath(`planets/${planet.id}`)} onClick={close}>
          <Icon name="arrow" size={13} />{text.open}
        </Link>
      </li>
      <li>
        <button
          className="popover__item"
          role="menuitem"
          type="button"
          disabled={!canEdit}
          title={canEdit ? undefined : text.editDenied}
          onClick={() => { close(); openEdit(planet) }}
        ><Icon name="edit" size={13} />{text.edit}</button>
      </li>
      <li>
        <Link className="popover__item" role="menuitem" to={adminPath(`series?planet=${planet.id}`)} onClick={close}>
          <Icon name="series" size={13} />{text.openContent}
        </Link>
      </li>
      <li>
        <Link className="popover__item" role="menuitem" to={adminPath(`planets/${planet.id}?tab=media`)} onClick={close}>
          <Icon name="media" size={13} />{text.openMedia}
        </Link>
      </li>
      <li>
        <Link className="popover__item" role="menuitem" to={adminPath(`planets/${planet.id}?tab=production`)} onClick={close}>
          <Icon name="clock" size={13} />{text.openProduction}
        </Link>
      </li>
      <li>
        <Link className="popover__item" role="menuitem" to={adminPath(`series?planet=${planet.id}&new=1`)} onClick={close}>
          <Icon name="plus" size={13} />{text.addSeries}
        </Link>
      </li>
      <li>
        {planet.is_active === false ? (
          <button
            className="popover__item"
            role="menuitem"
            type="button"
            disabled={!canEdit || busyId === planet.id}
            title={canEdit ? undefined : text.editDenied}
            onClick={() => { close(); void reactivate(planet) }}
          ><Icon name="refresh" size={13} />{text.reactivate}</button>
        ) : (
          <button
            className="popover__item popover__item--danger"
            role="menuitem"
            type="button"
            disabled={!canArchive || busyId === planet.id}
            title={canArchive ? undefined : text.archiveDenied}
            onClick={() => { close(); void archive(planet) }}
          ><Icon name="archive" size={13} />{text.archive}</button>
        )}
      </li>
    </ul>
  )

  const metricChips = (planet: PlanetListRow) => {
    const health = planet.health
    const chips: Array<{ key: string; value: number; label: string }> = [
      { key: 'series', value: health.series_total, label: text.series },
      { key: 'episodes', value: health.episodes_total, label: text.episodes },
      { key: 'stories', value: health.stories_total, label: text.stories },
      { key: 'games', value: health.games_total, label: text.games },
      { key: 'books', value: health.books_total, label: text.books },
      { key: 'projects', value: health.projects_total, label: text.projects },
    ].filter((chip) => chip.value > 0)
    if (!chips.length) return <span className="planet-chip planet-chip--muted">{text.noContent}</span>
    return chips.map((chip) => (
      <span className="planet-chip" key={chip.key}>
        <b>{formatNumber(chip.value, locale)}</b> {chip.label}
      </span>
    ))
  }

  const stateChips = (planet: PlanetListRow) => {
    const health = planet.health
    const chips = []
    if (health.series_published + health.episodes_published > 0) {
      chips.push(
        <span className="planet-chip planet-chip--good" key="published">
          <Icon name="check" size={11} />
          {formatNumber(health.episodes_published || health.series_published, locale)} {text.published}
        </span>,
      )
    }
    if (health.series_pipeline > 0) {
      chips.push(
        <span className="planet-chip" key="pipeline">
          {formatNumber(health.series_pipeline, locale)} {text.pipeline}
        </span>,
      )
    }
    if (health.production_blockers > 0) {
      chips.push(
        <span className="planet-chip planet-chip--danger" key="blockers">
          <Icon name="warning" size={11} />
          {formatNumber(health.production_blockers, locale)} {text.blockers}
        </span>,
      )
    }
    if (health.reviews_pending > 0) {
      chips.push(
        <span className="planet-chip planet-chip--warn" key="reviews">
          <Icon name="reviews" size={11} />
          {formatNumber(health.reviews_pending, locale)} {text.reviews}
        </span>,
      )
    }
    if (!health.artwork_icon || !health.artwork_cover) {
      chips.push(
        <span className="planet-chip planet-chip--warn" key="artwork">
          <Icon name="media" size={11} />{text.missingArtwork}
        </span>,
      )
    }
    if (!health.has_description) {
      chips.push(
        <span className="planet-chip planet-chip--warn" key="description">
          <Icon name="text" size={11} />{text.missingDescription}
        </span>,
      )
    }
    return chips
  }

  /// الشبكة قائمة صريحة: `role="list"` يُعلن العدد لقارئ الشاشة، وبلا ذلك تُقرأ
  /// البطاقات كنصّ متجاور بلا حدود بينها. عناصر القائمة تحمل `aria-labelledby`
  /// المعرِّف نفسه للعنوان، فيُنطق اسم الكوكب مرة واحدة لا مرتين.
  const cards = (
    <div className="planet-grid" role="list" aria-label={text.gridLabel}>
      {rows.map((planet) => {
        const name = locale === 'en' ? planet.name_en || planet.name_ar : planet.name_ar
        const artwork = planet.cover_url || planet.icon_url
        return (
          <article
            className={`planet-card ${planet.is_active === false ? 'planet-card--inactive' : ''}`}
            key={planet.id}
            role="listitem"
            aria-labelledby={`planet-card-title-${planet.id}`}
            style={{ ['--planet-colour' as string]: planet.color_hex }}
          >
            <div className="planet-card__media">
              {/* الصورة الحقيقية أولًا، ثم حالة صريحة مع إجراء. الرابط المكسور
                  يسقط إلى الحالة نفسها عبر onError: صورة مكسورة تُخفي النقص
                  بينما الحالة الصريحة تُسمّيه وتفتح طريق إصلاحه. */}
              {artwork && !brokenArt[planet.id]
                ? (
                  <img
                    src={artwork}
                    alt=""
                    loading="lazy"
                    onError={() => setBrokenArt((prev) => ({ ...prev, [planet.id]: true }))}
                  />
                )
                : (
                  <div className="planet-card__media-fallback">
                    <Icon name="planets" size={28} />
                    <span>{artwork ? text.brokenArtwork : text.noArtwork}</span>
                    {canEdit && (
                      <Link
                        className="button button--ghost button--small planet-card__media-cta"
                        to={adminPath(`planets/${planet.id}?tab=media`)}
                      >
                        <Icon name="upload" size={13} />{text.addArtwork}
                      </Link>
                    )}
                  </div>
                )}
              <span className="planet-card__state">
                {planet.is_active === false
                  ? <span className="planet-state planet-state--off">{text.inactive}</span>
                  : <span className="planet-state planet-state--on">{text.active}</span>}
              </span>
            </div>

            <div className="planet-card__body">
              <div className="planet-card__title-row">
                {/* الرابط على العنوان، والبطاقة كلها منطقة نقر عبر ::after في CSS:
                    فتبقى نقطة تركيز واحدة لقارئ الشاشة ولا يُلفّ زرّ داخل رابط. */}
                <h3 id={`planet-card-title-${planet.id}`}>
                  <Link className="planet-card__link" to={adminPath(`planets/${planet.id}`)}>{name}</Link>
                </h3>
                <CardMenu label={`${text.menu}: ${name}`}>
                  {(close) => menuItems(planet, close)}
                </CardMenu>
              </div>
              <code className="planet-card__slug" dir="ltr">{planet.id}</code>
              <p className="planet-card__description">{planet.description_ar || '—'}</p>
            </div>

            <div className="planet-card__metrics">{metricChips(planet)}</div>
            <div className="planet-card__signals">{stateChips(planet)}</div>

            <footer className="planet-card__footer">
              <span className="planet-card__updated">
                {planet.health.content_updated_at
                  ? `${text.updated}: ${formatDate(planet.health.content_updated_at.replace(' ', 'T') + 'Z', locale)}`
                  : text.never}
              </span>
              <Icon name="arrow" size={14} />
            </footer>
          </article>
        )
      })}
    </div>
  )

  const table = (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table data-table--wide">
        <thead>
          <tr>
            <th>{text.colPlanet}</th>
            {columns.isVisible('status') && <th>{text.colStatus}</th>}
            {columns.isVisible('series') && <th>{text.colSeries}</th>}
            {columns.isVisible('episodes') && <th>{text.colEpisodes}</th>}
            {columns.isVisible('stories') && <th>{text.colStories}</th>}
            {columns.isVisible('games') && <th>{text.colGames}</th>}
            {columns.isVisible('published') && <th>{text.colPublished}</th>}
            {columns.isVisible('blockers') && <th>{text.colBlockers}</th>}
            {columns.isVisible('english') && <th>{text.colEnglish}</th>}
            {columns.isVisible('updated') && <th>{text.colUpdated}</th>}
            <th>{text.colActions}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((planet) => {
            const name = locale === 'en' ? planet.name_en || planet.name_ar : planet.name_ar
            const health = planet.health
            return (
              <tr key={planet.id} className={planet.is_active === false ? 'planet-row--inactive' : undefined}>
                <td>
                  <Link className="entity-cell entity-cell--button" to={adminPath(`planets/${planet.id}`)}>
                    <EntityThumbnail
                      src={planet.cover_url || planet.icon_url}
                      alt=""
                      label={name}
                      color={planet.color_hex}
                      icon="planets"
                    />
                    <div><strong>{name}</strong><small dir="ltr">{planet.id}</small></div>
                  </Link>
                </td>
                {columns.isVisible('status') && (
                  <td>
                    {planet.is_active === false
                      ? <span className="planet-state planet-state--off">{text.inactive}</span>
                      : <span className="planet-state planet-state--on">{text.active}</span>}
                  </td>
                )}
                {columns.isVisible('series') && (
                  <td>{formatNumber(health.series_total, locale)}</td>
                )}
                {columns.isVisible('episodes') && <td>{formatNumber(health.episodes_total, locale)}</td>}
                {columns.isVisible('stories') && <td>{formatNumber(health.stories_total, locale)}</td>}
                {columns.isVisible('games') && <td>{formatNumber(health.games_total, locale)}</td>}
                {columns.isVisible('published') && (
                  <td>
                    {health.series_published + health.episodes_published > 0
                      ? <span className="planet-chip planet-chip--good">{formatNumber(health.episodes_published, locale)}</span>
                      : <span className="planet-chip planet-chip--muted">—</span>}
                  </td>
                )}
                {columns.isVisible('blockers') && (
                  <td>
                    {health.production_blockers > 0
                      ? <span className="planet-chip planet-chip--danger">{formatNumber(health.production_blockers, locale)}</span>
                      : '—'}
                  </td>
                )}
                {columns.isVisible('english') && (
                  <td dir="ltr">
                    {health.series_total
                      ? `${formatNumber(health.series_with_english_title, locale)}/${formatNumber(health.series_total, locale)}`
                      : '—'}
                  </td>
                )}
                {columns.isVisible('updated') && (
                  <td dir="ltr">
                    {health.content_updated_at
                      ? formatDate(health.content_updated_at.replace(' ', 'T') + 'Z', locale)
                      : '—'}
                  </td>
                )}
                <td>
                  <div className="table-actions">
                    <Link
                      className="icon-button icon-button--small"
                      to={adminPath(`planets/${planet.id}`)}
                      title={text.open}
                      aria-label={`${text.open}: ${name}`}
                    ><Icon name="arrow" size={15} /></Link>
                    <button
                      className="icon-button icon-button--small"
                      type="button"
                      onClick={() => openEdit(planet)}
                      disabled={!canEdit}
                      title={canEdit ? text.edit : text.editDenied}
                      aria-label={`${text.edit}: ${name}`}
                    ><Icon name="edit" size={15} /></button>
                    {planet.is_active === false ? (
                      <button
                        className="icon-button icon-button--small"
                        type="button"
                        onClick={() => void reactivate(planet)}
                        disabled={!canEdit || busyId === planet.id}
                        title={canEdit ? text.reactivate : text.editDenied}
                        aria-label={`${text.reactivate}: ${name}`}
                      ><Icon name="refresh" size={15} /></button>
                    ) : (
                      <button
                        className="icon-button icon-button--small icon-button--danger"
                        type="button"
                        onClick={() => void archive(planet)}
                        disabled={!canArchive || busyId === planet.id}
                        title={canArchive ? text.archive : text.archiveDenied}
                        aria-label={`${text.archive}: ${name}`}
                      ><Icon name="archive" size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  /// هيكل تحميل بشكل النتيجة لا دوّامة: البطاقات لها ارتفاع معروف، فالانتقال من
  /// التحميل إلى البيانات لا يُقفز التخطيط.
  const skeleton = (
    <div className="planet-grid" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="planet-card planet-card--skeleton" key={index}>
          <div className="planet-card__media" />
          <div className="planet-card__body">
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--short" />
            <span className="skeleton-line" />
          </div>
          <div className="planet-card__metrics">
            <span className="skeleton-chip" /><span className="skeleton-chip" /><span className="skeleton-chip" />
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
          <button
            className="button button--primary"
            type="button"
            onClick={openCreate}
            disabled={!canCreate}
            title={canCreate ? undefined : text.createDenied}
          ><Icon name="plus" size={17} />{text.create}</button>
        </div>
      </section>

      {summary && (
        <SummaryStrip
          summary={summary}
          text={text}
          locale={locale}
          onPick={(next) => list.setFilters(next)}
        />
      )}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{text.catalog}</span>
            <h3>{text.all} <span className="title-count">{formatNumber(rows.length, locale)}</span></h3>
            {notes.length > 0 && <p className="panel__note">{text.fixtureNote}</p>}
          </div>
          <ListToolbar
            searchValue={query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={FILTER_FIELDS(text)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')}
            trailing={
              <>
                <label className="planet-sort">
                  <span>{text.sort}</span>
                  <select value={sort} onChange={(event) => list.setSort(event.target.value)}>
                    <option value="order">{text.sortOrder}</option>
                    <option value="name">{text.sortName}</option>
                    <option value="updated">{text.sortUpdated}</option>
                    <option value="content_desc">{text.sortMost}</option>
                    <option value="content_asc">{text.sortLeast}</option>
                  </select>
                </label>
                <SavedViewsMenu
                  storageKey="planets"
                  currentSearch={list.search}
                  onApply={(search) => navigate(`${adminPath('planets')}${search}`)}
                />
                {view === 'table' && (
                  <ColumnManager
                    columns={COLUMNS.map((column) => ({ ...column, label: text[column.label as keyof typeof text] as string }))}
                    hidden={columns.hidden}
                    onToggle={columns.toggle}
                    onReset={columns.reset}
                  />
                )}
                {/* شبكة وجدول فقط: لا كانبان لكيان بلا سير عمل. */}
                <ViewSwitcher
                  value={view}
                  onChange={setView}
                  modes={['grid', 'table']}
                  locale={locale}
                />
              </>
            }
          />
        </header>

        <div className="planet-collection__body">
          {denied ? (
            <ErrorState message={error || text.denied} />
          ) : loading && !rows.length ? (
            <>
              <p className="planet-loading" role="status" aria-live="polite">{text.loading}</p>
              {skeleton}
            </>
          ) : error && !rows.length ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : rows.length === 0 ? (
            filtersActive ? (
              <EmptyState
                title={text.noResults}
                description={text.noResultsDesc}
                action={<button className="button button--secondary" type="button" onClick={list.clearFilters}>{text.clear}</button>}
              />
            ) : (
              <EmptyState
                title={text.empty}
                description={text.emptyDesc}
                action={canCreate
                  ? <button className="button button--primary" type="button" onClick={openCreate}><Icon name="plus" size={17} />{text.create}</button>
                  : undefined}
              />
            )
          ) : view === 'table' ? table : cards}

          {error && rows.length > 0 && <div className="inline-alert inline-alert--error" role="alert">{error}</div>}
        </div>
      </section>

      <PlanetEditorDrawer
        open={editorOpen}
        planet={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={(id) => {
          setEditorOpen(false)
          void load()
          // إنشاء كوكب جديد يفتح مساحة عمله: الخطوة التالية دائمًا هي إكمال
          // الصور والسلاسل، وكلها هناك.
          if (!editing) navigate(adminPath(`planets/${id}`))
        }}
      />
    </div>
  )
}
