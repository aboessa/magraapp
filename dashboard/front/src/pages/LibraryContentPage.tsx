import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber, statusLabels } from '../lib/labels'
import type {
  BookPayload,
  BookRecord,
  ContentStatus,
  EpisodeRecord,
  GameDifficulty,
  GameEngineRecord,
  GamePayload,
  GameRecord,
  InteractionMode,
  LibraryContentKind,
  ProjectPayload,
  ProjectRecord,
  ReadingLevel,
  SeriesRecord,
  StoryType,
  SupervisionLevel,
} from '../types/api'

const editableStatuses: ContentStatus[] = ['draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published']
const filterStatuses: ContentStatus[] = [...editableStatuses, 'archived']
const bookTypes: StoryType[] = ['picture_book', 'audio_story', 'interactive', 'comic']
const readingLevels: ReadingLevel[] = ['pre_reader', 'emerging', 'independent']
const interactionModes: InteractionMode[] = ['tap', 'guided', 'mixed', 'independent']
const supervisionLevels: SupervisionLevel[] = ['none', 'recommended', 'required']
const difficulties: GameDifficulty[] = ['easy', 'medium', 'hard']

const bookTypeLabels = {
  ar: { picture_book: 'كتاب مصور', audio_story: 'كتاب صوتي', interactive: 'كتاب تفاعلي', comic: 'كوميكس' },
  en: { picture_book: 'Picture book', audio_story: 'Audio book', interactive: 'Interactive', comic: 'Comic' },
}
const readingLabels = {
  ar: { pre_reader: 'ما قبل القراءة', emerging: 'قارئ ناشئ', independent: 'قارئ مستقل' },
  en: { pre_reader: 'Pre-reader', emerging: 'Emerging reader', independent: 'Independent reader' },
}
const interactionLabels = {
  ar: { tap: 'باللمس', guided: 'موجّه', mixed: 'مختلط', independent: 'مستقل' },
  en: { tap: 'Tap', guided: 'Guided', mixed: 'Mixed', independent: 'Independent' },
}
const supervisionLabels = {
  ar: { none: 'دون إشراف', recommended: 'إشراف مستحسن', required: 'إشراف مطلوب' },
  en: { none: 'None', recommended: 'Recommended', required: 'Required' },
}
const difficultyLabels = {
  ar: { easy: 'سهل', medium: 'متوسط', hard: 'صعب' },
  en: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
}

const copy = {
  ar: {
    tabs: { books: 'الكتب', games: 'الألعاب', projects: 'المشروعات' },
    singular: { books: 'كتاب', games: 'لعبة', projects: 'مشروع' },
    eyebrow: 'مكتبة التجارب', title: 'الكتب والألعاب والمشروعات', intro: 'إدارة التجارب المقروءة والتفاعلية والمشروعات العملية مع بيانات العمر والأمان والنشر.',
    add: 'إضافة', catalog: 'المحتوى', search: 'بحث بالعنوان أو المرجع...', searchLabel: 'بحث في المحتوى', activeStatuses: 'الحالات النشطة', allStatuses: 'كل الحالات', statusFilter: 'تصفية حسب الحالة',
    loading: 'جارٍ تحميل المحتوى...', loadError: 'تعذر تحميل مكتبة المحتوى', empty: 'لا يوجد محتوى مطابق', emptyDescription: 'غيّر البحث أو الحالة، أو أضف أول عنصر في هذا القسم.',
    edit: 'تعديل', archive: 'أرشفة', actions: 'إجراءات', years: 'سنوات', free: 'مجاني', paid: 'مدفوع', noSeries: 'بلا سلسلة', noEpisode: 'بلا حلقة',
    series: 'السلسلة', episode: 'الحلقة', engine: 'المحرك', type: 'النوع', reading: 'مستوى القراءة', interaction: 'نمط التفاعل', supervision: 'الإشراف', difficulty: 'الصعوبة', materialsCount: 'مواد',
    titleField: 'العنوان بالعربية *', seriesOptional: 'السلسلة — اختياري', episodeOptional: 'الحلقة — اختياري', episodeIdOptional: 'معرّف الحلقة — اختياري', engineRequired: 'محرك اللعبة *',
    minAge: 'العمر الأدنى *', maxAge: 'العمر الأقصى *', safety: 'ملاحظات الأمان', instructions: 'التعليمات', maxAttempts: 'الحد الأقصى للمحاولات',
    description: 'الوصف', materials: 'المواد — كل مادة في سطر', steps: 'الخطوات — كل خطوة في سطر', status: 'الحالة', availability: 'الإتاحة', freeContent: 'إتاحة مجانية',
    cancel: 'إلغاء', save: 'حفظ التعديلات', create: 'إنشاء', saving: 'جارٍ الحفظ...', required: 'أكمل الحقول المطلوبة.', ageError: 'يجب أن يكون العمر بين 3 و12 وأن يكون الحد الأعلى أكبر من أو مساويًا للأدنى.', attemptsError: 'عدد المحاولات يجب أن يكون رقمًا صحيحًا موجبًا أو فارغًا.',
    saveError: 'تعذر حفظ المحتوى', archiveError: 'تعذر أرشفة المحتوى', editLoadError: 'تعذر تحميل تفاصيل العنصر', referencesError: 'تعذر تحميل بعض السلاسل أو محركات الألعاب؛ أعد المحاولة قبل إنشاء محتوى مرتبط.',
    archiveConfirm: (title: string) => `هل تريد أرشفة «${title}»؟ لن تُحذف البيانات.`, coverAlt: (title: string) => `غلاف ${title}`,
  },
  en: {
    tabs: { books: 'Books', games: 'Games', projects: 'Projects' },
    singular: { books: 'book', games: 'game', projects: 'project' },
    eyebrow: 'Experience library', title: 'Books, games, and projects', intro: 'Manage reading, interactive, and hands-on experiences with age, safety, and publishing metadata.',
    add: 'Add', catalog: 'Content', search: 'Search by title or reference...', searchLabel: 'Search content', activeStatuses: 'Active statuses', allStatuses: 'All statuses', statusFilter: 'Filter by status',
    loading: 'Loading content...', loadError: 'Unable to load the content library', empty: 'No matching content', emptyDescription: 'Change the search or status, or add the first item in this section.',
    edit: 'Edit', archive: 'Archive', actions: 'Actions', years: 'years', free: 'Free', paid: 'Paid', noSeries: 'No series', noEpisode: 'No episode',
    series: 'Series', episode: 'Episode', engine: 'Engine', type: 'Type', reading: 'Reading level', interaction: 'Interaction', supervision: 'Supervision', difficulty: 'Difficulty', materialsCount: 'materials',
    titleField: 'Arabic title *', seriesOptional: 'Series — optional', episodeOptional: 'Episode — optional', episodeIdOptional: 'Episode ID — optional', engineRequired: 'Game engine *',
    minAge: 'Minimum age *', maxAge: 'Maximum age *', safety: 'Safety notes', instructions: 'Instructions', maxAttempts: 'Maximum attempts',
    description: 'Description', materials: 'Materials — one per line', steps: 'Steps — one per line', status: 'Status', availability: 'Availability', freeContent: 'Free access',
    cancel: 'Cancel', save: 'Save changes', create: 'Create', saving: 'Saving...', required: 'Complete the required fields.', ageError: 'Ages must be between 3 and 12, and maximum age must be at least the minimum.', attemptsError: 'Maximum attempts must be a positive integer or blank.',
    saveError: 'Unable to save content', archiveError: 'Unable to archive content', editLoadError: 'Unable to load item details', referencesError: 'Some series or game engines could not be loaded. Retry before creating linked content.',
    archiveConfirm: (title: string) => `Archive “${title}”? The data will not be deleted.`, coverAlt: (title: string) => `${title} cover`,
  },
}

type BookForm = {
  title_ar: string
  series_id: string
  type: StoryType
  age_min: string
  age_max: string
  reading_level: ReadingLevel
  interaction_mode: InteractionMode
  supervision_level: SupervisionLevel
  safety_notes: string
  is_free: boolean
  status: ContentStatus
}

type GameForm = {
  title_ar: string
  engine_id: string
  series_id: string
  episode_id: string
  age_min: string
  age_max: string
  reading_level: ReadingLevel
  interaction_mode: InteractionMode
  supervision_level: SupervisionLevel
  difficulty: GameDifficulty
  instructions_ar: string
  max_attempts: string
  is_free: boolean
  status: ContentStatus
}

type ProjectForm = {
  title_ar: string
  description_ar: string
  age_min: string
  age_max: string
  supervision_level: SupervisionLevel
  safety_notes: string
  materials: string
  steps: string
  is_free: boolean
  status: ContentStatus
}

type EditorState = { kind: LibraryContentKind; id?: string }

const emptyBookForm: BookForm = { title_ar: '', series_id: '', type: 'picture_book', age_min: '6', age_max: '8', reading_level: 'emerging', interaction_mode: 'guided', supervision_level: 'recommended', safety_notes: '', is_free: false, status: 'draft' }
const emptyGameForm: GameForm = { title_ar: '', engine_id: '', series_id: '', episode_id: '', age_min: '6', age_max: '8', reading_level: 'emerging', interaction_mode: 'guided', supervision_level: 'recommended', difficulty: 'easy', instructions_ar: '', max_attempts: '', is_free: false, status: 'draft' }
const emptyProjectForm: ProjectForm = { title_ar: '', description_ar: '', age_min: '6', age_max: '8', supervision_level: 'recommended', safety_notes: '', materials: '', steps: '', is_free: false, status: 'draft' }

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
}

function validAges(minimum: string, maximum: string) {
  const min = Number(minimum)
  const max = Number(maximum)
  return Number.isInteger(min) && Number.isInteger(max) && min >= 3 && max <= 12 && max >= min
}

function formStatuses(status: ContentStatus) {
  return status === 'archived' ? filterStatuses : editableStatuses
}

function ContentCover({ assetId, title, icon, alt }: { assetId?: string | null; title: string; icon: IconName; alt: string }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    setUrl('')
    if (!assetId) return
    let active = true
    let objectUrl = ''
    void api.assetBlob(assetId).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => setUrl(''))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [assetId])

  return <div className="library-card__cover">{url ? <img src={url} alt={alt} /> : <span aria-label={title}><Icon name={icon} size={30} /></span>}</div>
}

type ContentCardProps = {
  title: string
  coverAssetId?: string | null
  icon: IconName
  status: ContentStatus
  ageMin: number
  ageMax: number
  isFree: boolean
  metadata: string[]
  openLabel: string
  editLabel: string
  archiveLabel: string
  ageLabel: string
  freeLabel: string
  paidLabel: string
  coverAlt: string
  busy: boolean
  onOpen: () => void
  onEdit: () => void
  onArchive: () => void
}

function ContentCard(props: ContentCardProps) {
  return (
    <article className="library-card">
      <ContentCover assetId={props.coverAssetId} title={props.title} icon={props.icon} alt={props.coverAlt} />
      <div className="library-card__body">
        <header><h3>{props.title}</h3><StatusBadge status={props.status} /></header>
        <div className="library-card__badges">
          <span className="library-pill library-pill--age">{props.ageMin}–{props.ageMax} {props.ageLabel}</span>
          <span className={`library-pill ${props.isFree ? 'library-pill--free' : 'library-pill--paid'}`}>{props.isFree ? props.freeLabel : props.paidLabel}</span>
        </div>
        <ul className="library-card__meta">{props.metadata.map((item) => <li key={item}>{item}</li>)}</ul>
        <footer>
          <button className="button button--ghost" type="button" onClick={props.onOpen} disabled={props.busy}><Icon name="arrow" size={14} />{props.openLabel}</button>
          <button className="button button--ghost" type="button" onClick={props.onEdit} disabled={props.busy}><Icon name="edit" size={14} />{props.editLabel}</button>
          {props.status !== 'archived' && <button className="icon-button icon-button--small icon-button--danger" type="button" onClick={props.onArchive} disabled={props.busy} title={props.archiveLabel} aria-label={`${props.archiveLabel}: ${props.title}`}><Icon name="archive" size={15} /></button>}
        </footer>
      </div>
    </article>
  )
}

export function LibraryContentPage() {
  const { locale } = usePreferences()
  const navigate = useNavigate()
  const text = copy[locale]
  const [active, setActive] = useState<LibraryContentKind>('books')
  const [books, setBooks] = useState<BookRecord[]>([])
  const [games, setGames] = useState<GameRecord[]>([])
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [series, setSeries] = useState<SeriesRecord[]>([])
  const [engines, setEngines] = useState<GameEngineRecord[]>([])
  const [episodes, setEpisodes] = useState<EpisodeRecord[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [referenceIssue, setReferenceIssue] = useState(false)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorReady, setEditorReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [bookForm, setBookForm] = useState<BookForm>(emptyBookForm)
  const [gameForm, setGameForm] = useState<GameForm>(emptyGameForm)
  const [projectForm, setProjectForm] = useState<ProjectForm>(emptyProjectForm)
  const [bookPages, setBookPages] = useState<unknown[]>([])
  const [gameContentPack, setGameContentPack] = useState<Record<string, unknown>>({})
  const [gameHelpSystem, setGameHelpSystem] = useState<Record<string, unknown>>({})
  const [projectObjectiveIds, setProjectObjectiveIds] = useState<string[]>([])
  const [projectCoverUrl, setProjectCoverUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const filters = { q: query, status }
      const [bookResponse, gameResponse, projectResponse] = await Promise.all([
        api.books(filters),
        api.games(filters),
        api.projects(filters),
      ])
      setBooks(bookResponse.data)
      setGames(gameResponse.data)
      setProjects(projectResponse.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [query, status, text.loadError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    let activeRequest = true
    void Promise.allSettled([
      api.series({ status: 'all', limit: 100 }),
      api.gameEngines(),
      api.episodes({ status: 'all', limit: 100 }),
    ]).then(([seriesResult, engineResult, episodeResult]) => {
      if (!activeRequest) return
      if (seriesResult.status === 'fulfilled') setSeries(seriesResult.value.data.filter((item) => item.status !== 'archived'))
      if (engineResult.status === 'fulfilled') setEngines(engineResult.value.data)
      if (episodeResult.status === 'fulfilled') setEpisodes(episodeResult.value.data.filter((item) => item.status !== 'archived'))
      setReferenceIssue(seriesResult.status === 'rejected' || engineResult.status === 'rejected')
    })
    return () => { activeRequest = false }
  }, [])

  const counts: Record<LibraryContentKind, number> = { books: books.length, games: games.length, projects: projects.length }
  const tabs: Array<{ kind: LibraryContentKind; icon: IconName }> = [
    { kind: 'books', icon: 'books' },
    { kind: 'games', icon: 'games' },
    { kind: 'projects', icon: 'objectives' },
  ]
  const episodeOptions = gameForm.series_id ? episodes.filter((item) => item.series_id === gameForm.series_id) : episodes

  function openCreate(kind: LibraryContentKind) {
    setEditor({ kind })
    setEditorLoading(false)
    setEditorReady(true)
    setFormError('')
    if (kind === 'books') {
      setBookForm({ ...emptyBookForm })
      setBookPages([])
    } else if (kind === 'games') {
      setGameForm({ ...emptyGameForm, engine_id: engines[0]?.id ?? '' })
      setGameContentPack({})
      setGameHelpSystem({})
    } else {
      setProjectForm({ ...emptyProjectForm })
      setProjectObjectiveIds([])
      setProjectCoverUrl(null)
    }
  }

  async function openEdit(kind: LibraryContentKind, id: string) {
    setEditor({ kind, id })
    setEditorLoading(true)
    setEditorReady(false)
    setFormError('')
    try {
      if (kind === 'books') {
        const { data } = await api.book(id)
        setBookForm({ title_ar: data.title_ar, series_id: data.series_id ?? '', type: data.type, age_min: String(data.age_min), age_max: String(data.age_max), reading_level: data.reading_level, interaction_mode: data.interaction_mode, supervision_level: data.supervision_level, safety_notes: data.safety_notes ?? '', is_free: data.is_free, status: data.status })
        setBookPages(data.pages)
      } else if (kind === 'games') {
        const { data } = await api.game(id)
        setGameForm({ title_ar: data.title_ar, engine_id: data.engine_id, series_id: data.series_id ?? '', episode_id: data.episode_id ?? '', age_min: String(data.age_min), age_max: String(data.age_max), reading_level: data.reading_level, interaction_mode: data.interaction_mode, supervision_level: data.supervision_level, difficulty: data.difficulty, instructions_ar: data.instructions_ar ?? '', max_attempts: data.max_attempts == null ? '' : String(data.max_attempts), is_free: data.is_free, status: data.status })
        setGameContentPack(data.content_pack)
        setGameHelpSystem(data.help_system)
      } else {
        const { data } = await api.project(id)
        setProjectForm({ title_ar: data.title_ar, description_ar: data.description_ar ?? '', age_min: String(data.age_min), age_max: String(data.age_max), supervision_level: data.supervision_level, safety_notes: data.safety_notes ?? '', materials: data.materials.join('\n'), steps: data.steps.join('\n'), is_free: data.is_free, status: data.status })
        setProjectObjectiveIds(data.learning_objective_ids)
        setProjectCoverUrl(data.cover_url ?? null)
      }
      setEditorReady(true)
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.editLoadError)
    } finally {
      setEditorLoading(false)
    }
  }

  function closeEditor() {
    if (!saving) setEditor(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!editor) return
    const currentForm = editor.kind === 'books' ? bookForm : editor.kind === 'games' ? gameForm : projectForm
    if (!currentForm.title_ar.trim()) {
      setFormError(text.required)
      return
    }
    if (!validAges(currentForm.age_min, currentForm.age_max)) {
      setFormError(text.ageError)
      return
    }
    if (editor.kind === 'games' && !gameForm.engine_id) {
      setFormError(text.required)
      return
    }
    const attempts = gameForm.max_attempts.trim() ? Number(gameForm.max_attempts) : null
    if (editor.kind === 'games' && attempts !== null && (!Number.isInteger(attempts) || attempts < 1)) {
      setFormError(text.attemptsError)
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (editor.kind === 'books') {
        const payload: BookPayload = { title_ar: bookForm.title_ar.trim(), series_id: bookForm.series_id || null, type: bookForm.type, pages: bookPages, age_min: Number(bookForm.age_min), age_max: Number(bookForm.age_max), reading_level: bookForm.reading_level, interaction_mode: bookForm.interaction_mode, supervision_level: bookForm.supervision_level, safety_notes: bookForm.safety_notes.trim() || null, is_free: bookForm.is_free, status: bookForm.status }
        if (editor.id) await api.updateBook(editor.id, payload)
        else await api.createBook(payload)
      } else if (editor.kind === 'games') {
        const payload: GamePayload = { title_ar: gameForm.title_ar.trim(), engine_id: gameForm.engine_id, series_id: gameForm.series_id || null, episode_id: gameForm.episode_id.trim() || null, age_min: Number(gameForm.age_min), age_max: Number(gameForm.age_max), reading_level: gameForm.reading_level, interaction_mode: gameForm.interaction_mode, supervision_level: gameForm.supervision_level, difficulty: gameForm.difficulty, content_pack: gameContentPack, instructions_ar: gameForm.instructions_ar.trim() || null, max_attempts: attempts, help_system: gameHelpSystem, is_free: gameForm.is_free, status: gameForm.status }
        if (editor.id) await api.updateGame(editor.id, payload)
        else await api.createGame(payload)
      } else {
        const payload: ProjectPayload = { title_ar: projectForm.title_ar.trim(), description_ar: projectForm.description_ar.trim() || null, age_min: Number(projectForm.age_min), age_max: Number(projectForm.age_max), supervision_level: projectForm.supervision_level, safety_notes: projectForm.safety_notes.trim() || null, materials: lines(projectForm.materials), steps: lines(projectForm.steps), learning_objective_ids: projectObjectiveIds, cover_url: projectCoverUrl, is_free: projectForm.is_free, status: projectForm.status }
        if (editor.id) await api.updateProject(editor.id, payload)
        else await api.createProject(payload)
      }
      setEditor(null)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function archive(kind: LibraryContentKind, id: string, title: string) {
    if (!window.confirm(text.archiveConfirm(title))) return
    const key = `${kind}:${id}`
    setBusyKey(key)
    setError('')
    try {
      if (kind === 'books') await api.archiveBook(id)
      else if (kind === 'games') await api.archiveGame(id)
      else await api.archiveProject(id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.archiveError)
    } finally {
      setBusyKey('')
    }
  }

  const editorTitle = editor ? `${editor.id ? text.edit : text.add} ${text.singular[editor.kind]}` : ''
  const emptyAction = <button className="button button--primary" type="button" onClick={() => openCreate(active)}><Icon name="plus" size={16} />{text.add} {text.singular[active]}</button>

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.intro}</p></div>
        <button className="button button--primary" type="button" onClick={() => openCreate(active)}><Icon name="plus" size={16} />{text.add} {text.singular[active]}</button>
      </section>

      <nav className="library-tabs" role="tablist" aria-label={text.title}>
        {tabs.map((tab) => <button id={`library-tab-${tab.kind}`} className={active === tab.kind ? 'library-tab library-tab--active' : 'library-tab'} type="button" role="tab" aria-selected={active === tab.kind} aria-controls="library-content-panel" onClick={() => setActive(tab.kind)} key={tab.kind}><Icon name={tab.icon} size={18} /><span>{text.tabs[tab.kind]}</span><strong>{formatNumber(counts[tab.kind], locale)}</strong></button>)}
      </nav>

      {referenceIssue && <div className="inline-alert inline-alert--error">{text.referencesError}</div>}
      {error && counts[active] > 0 && <div className="inline-alert inline-alert--error">{error}</div>}

      <section className="panel" id="library-content-panel" role="tabpanel" aria-labelledby={`library-tab-${active}`} aria-busy={loading}>
        <header className="panel__header panel__header--filters">
          <div><span className="panel__kicker">{text.catalog}</span><h3>{text.tabs[active]} <span className="title-count">{formatNumber(counts[active], locale)}</span></h3></div>
          <div className="filters-row">
            <label className="search-field"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} aria-label={text.searchLabel} /></label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={text.statusFilter}><option value="">{text.activeStatuses}</option><option value="all">{text.allStatuses}</option>{filterStatuses.map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}</select>
          </div>
        </header>

        {loading && counts[active] === 0 ? <LoadingState label={text.loading} /> : error && counts[active] === 0 ? <ErrorState message={error} onRetry={() => void load()} /> : counts[active] === 0 ? <EmptyState title={text.empty} description={text.emptyDescription} action={emptyAction} /> : (
          <div className="library-grid">
            {active === 'books' && books.map((book) => <ContentCard title={book.title_ar} coverAssetId={book.cover_asset_id} icon="books" status={book.status} ageMin={book.age_min} ageMax={book.age_max} isFree={book.is_free} metadata={[`${text.type}: ${bookTypeLabels[locale][book.type]}`, `${text.series}: ${book.series_title || text.noSeries}`, `${text.reading}: ${readingLabels[locale][book.reading_level]}`]} openLabel={locale === 'ar' ? 'فتح' : 'Open'} onOpen={() => navigate(adminPath(`library-content/books/${book.id}`))} editLabel={text.edit} archiveLabel={text.archive} ageLabel={text.years} freeLabel={text.free} paidLabel={text.paid} coverAlt={text.coverAlt(book.title_ar)} busy={busyKey === `books:${book.id}`} onEdit={() => void openEdit('books', book.id)} onArchive={() => void archive('books', book.id, book.title_ar)} key={book.id} />)}
            {active === 'games' && games.map((game) => <ContentCard title={game.title_ar} coverAssetId={game.cover_asset_id} icon="games" status={game.status} ageMin={game.age_min} ageMax={game.age_max} isFree={game.is_free} metadata={[`${text.engine}: ${game.engine_name || '—'}`, `${text.series}: ${game.series_title || text.noSeries}`, `${text.difficulty}: ${difficultyLabels[locale][game.difficulty]}`]} openLabel={locale === 'ar' ? 'فتح' : 'Open'} onOpen={() => navigate(adminPath(`library-content/games/${game.id}`))} editLabel={text.edit} archiveLabel={text.archive} ageLabel={text.years} freeLabel={text.free} paidLabel={text.paid} coverAlt={text.coverAlt(game.title_ar)} busy={busyKey === `games:${game.id}`} onEdit={() => void openEdit('games', game.id)} onArchive={() => void archive('games', game.id, game.title_ar)} key={game.id} />)}
            {active === 'projects' && projects.map((project) => <ContentCard title={project.title_ar} coverAssetId={project.cover_asset_id} icon="objectives" status={project.status} ageMin={project.age_min} ageMax={project.age_max} isFree={project.is_free} metadata={[project.description_ar || '—', `${formatNumber(project.materials.length, locale)} ${text.materialsCount}`, `${text.supervision}: ${supervisionLabels[locale][project.supervision_level]}`]} openLabel={locale === 'ar' ? 'فتح' : 'Open'} onOpen={() => navigate(adminPath(`library-content/projects/${project.id}`))} editLabel={text.edit} archiveLabel={text.archive} ageLabel={text.years} freeLabel={text.free} paidLabel={text.paid} coverAlt={text.coverAlt(project.title_ar)} busy={busyKey === `projects:${project.id}`} onEdit={() => void openEdit('projects', project.id)} onArchive={() => void archive('projects', project.id, project.title_ar)} key={project.id} />)}
          </div>
        )}
      </section>

      <Modal open={editor !== null} onClose={closeEditor} title={editorTitle} description={editor ? text.tabs[editor.kind] : undefined}>
        {editorLoading ? <LoadingState /> : !editorReady ? <ErrorState message={formError || text.editLoadError} onRetry={editor?.id ? () => void openEdit(editor.kind, editor.id as string) : undefined} /> : editor && (
          <form className="entity-form" onSubmit={submit}>
            {formError && <div className="inline-alert inline-alert--error">{formError}</div>}

            {editor.kind === 'books' && <>
              <div className="form-grid"><label className="field"><span>{text.titleField}</span><input autoFocus required value={bookForm.title_ar} onChange={(event) => setBookForm({ ...bookForm, title_ar: event.target.value })} /></label><label className="field"><span>{text.seriesOptional}</span><select value={bookForm.series_id} onChange={(event) => setBookForm({ ...bookForm, series_id: event.target.value })}><option value="">—</option>{series.map((item) => <option value={item.id} key={item.id}>{item.title_ar}</option>)}</select></label></div>
              <div className="form-grid form-grid--three"><label className="field"><span>{text.type}</span><select value={bookForm.type} onChange={(event) => setBookForm({ ...bookForm, type: event.target.value as StoryType })}>{bookTypes.map((item) => <option value={item} key={item}>{bookTypeLabels[locale][item]}</option>)}</select></label><label className="field"><span>{text.minAge}</span><input type="number" min="3" max="12" required value={bookForm.age_min} onChange={(event) => setBookForm({ ...bookForm, age_min: event.target.value })} /></label><label className="field"><span>{text.maxAge}</span><input type="number" min="3" max="12" required value={bookForm.age_max} onChange={(event) => setBookForm({ ...bookForm, age_max: event.target.value })} /></label></div>
              <div className="form-grid form-grid--three"><label className="field"><span>{text.reading}</span><select value={bookForm.reading_level} onChange={(event) => setBookForm({ ...bookForm, reading_level: event.target.value as ReadingLevel })}>{readingLevels.map((item) => <option value={item} key={item}>{readingLabels[locale][item]}</option>)}</select></label><label className="field"><span>{text.interaction}</span><select value={bookForm.interaction_mode} onChange={(event) => setBookForm({ ...bookForm, interaction_mode: event.target.value as InteractionMode })}>{interactionModes.map((item) => <option value={item} key={item}>{interactionLabels[locale][item]}</option>)}</select></label><label className="field"><span>{text.supervision}</span><select value={bookForm.supervision_level} onChange={(event) => setBookForm({ ...bookForm, supervision_level: event.target.value as SupervisionLevel })}>{supervisionLevels.map((item) => <option value={item} key={item}>{supervisionLabels[locale][item]}</option>)}</select></label></div>
              <label className="field"><span>{text.safety}</span><textarea rows={3} value={bookForm.safety_notes} onChange={(event) => setBookForm({ ...bookForm, safety_notes: event.target.value })} /></label>
              <div className="form-grid"><label className="field"><span>{text.status}</span><select value={bookForm.status} onChange={(event) => setBookForm({ ...bookForm, status: event.target.value as ContentStatus })}>{formStatuses(bookForm.status).map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}</select></label><div className="field"><span>{text.availability}</span><label className="checkbox-control"><input type="checkbox" checked={bookForm.is_free} onChange={(event) => setBookForm({ ...bookForm, is_free: event.target.checked })} /><span>{text.freeContent}</span></label></div></div>
            </>}

            {editor.kind === 'games' && <>
              <div className="form-grid"><label className="field"><span>{text.titleField}</span><input autoFocus required value={gameForm.title_ar} onChange={(event) => setGameForm({ ...gameForm, title_ar: event.target.value })} /></label><label className="field"><span>{text.engineRequired}</span><select required value={gameForm.engine_id} onChange={(event) => setGameForm({ ...gameForm, engine_id: event.target.value })}><option value="">—</option>{engines.map((item) => <option value={item.id} key={item.id}>{item.name_ar}</option>)}</select></label></div>
              <div className="form-grid"><label className="field"><span>{text.seriesOptional}</span><select value={gameForm.series_id} onChange={(event) => setGameForm({ ...gameForm, series_id: event.target.value, episode_id: '' })}><option value="">—</option>{series.map((item) => <option value={item.id} key={item.id}>{item.title_ar}</option>)}</select></label><label className="field"><span>{episodeOptions.length ? text.episodeOptional : text.episodeIdOptional}</span>{episodeOptions.length ? <select value={gameForm.episode_id} onChange={(event) => setGameForm({ ...gameForm, episode_id: event.target.value })}><option value="">—</option>{episodeOptions.map((item) => <option value={item.id} key={item.id}>{item.title_ar}</option>)}</select> : <input dir="ltr" value={gameForm.episode_id} onChange={(event) => setGameForm({ ...gameForm, episode_id: event.target.value })} />}</label></div>
              <div className="form-grid form-grid--three"><label className="field"><span>{text.minAge}</span><input type="number" min="3" max="12" required value={gameForm.age_min} onChange={(event) => setGameForm({ ...gameForm, age_min: event.target.value })} /></label><label className="field"><span>{text.maxAge}</span><input type="number" min="3" max="12" required value={gameForm.age_max} onChange={(event) => setGameForm({ ...gameForm, age_max: event.target.value })} /></label><label className="field"><span>{text.difficulty}</span><select value={gameForm.difficulty} onChange={(event) => setGameForm({ ...gameForm, difficulty: event.target.value as GameDifficulty })}>{difficulties.map((item) => <option value={item} key={item}>{difficultyLabels[locale][item]}</option>)}</select></label></div>
              <div className="form-grid form-grid--three"><label className="field"><span>{text.reading}</span><select value={gameForm.reading_level} onChange={(event) => setGameForm({ ...gameForm, reading_level: event.target.value as ReadingLevel })}>{readingLevels.map((item) => <option value={item} key={item}>{readingLabels[locale][item]}</option>)}</select></label><label className="field"><span>{text.interaction}</span><select value={gameForm.interaction_mode} onChange={(event) => setGameForm({ ...gameForm, interaction_mode: event.target.value as InteractionMode })}>{interactionModes.map((item) => <option value={item} key={item}>{interactionLabels[locale][item]}</option>)}</select></label><label className="field"><span>{text.supervision}</span><select value={gameForm.supervision_level} onChange={(event) => setGameForm({ ...gameForm, supervision_level: event.target.value as SupervisionLevel })}>{supervisionLevels.map((item) => <option value={item} key={item}>{supervisionLabels[locale][item]}</option>)}</select></label></div>
              <label className="field"><span>{text.instructions}</span><textarea rows={4} value={gameForm.instructions_ar} onChange={(event) => setGameForm({ ...gameForm, instructions_ar: event.target.value })} /></label>
              <div className="form-grid form-grid--three"><label className="field"><span>{text.maxAttempts}</span><input type="number" min="1" value={gameForm.max_attempts} onChange={(event) => setGameForm({ ...gameForm, max_attempts: event.target.value })} /></label><label className="field"><span>{text.status}</span><select value={gameForm.status} onChange={(event) => setGameForm({ ...gameForm, status: event.target.value as ContentStatus })}>{formStatuses(gameForm.status).map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}</select></label><div className="field"><span>{text.availability}</span><label className="checkbox-control"><input type="checkbox" checked={gameForm.is_free} onChange={(event) => setGameForm({ ...gameForm, is_free: event.target.checked })} /><span>{text.freeContent}</span></label></div></div>
            </>}

            {editor.kind === 'projects' && <>
              <label className="field"><span>{text.titleField}</span><input autoFocus required value={projectForm.title_ar} onChange={(event) => setProjectForm({ ...projectForm, title_ar: event.target.value })} /></label>
              <label className="field"><span>{text.description}</span><textarea rows={3} value={projectForm.description_ar} onChange={(event) => setProjectForm({ ...projectForm, description_ar: event.target.value })} /></label>
              <div className="form-grid form-grid--three"><label className="field"><span>{text.minAge}</span><input type="number" min="3" max="12" required value={projectForm.age_min} onChange={(event) => setProjectForm({ ...projectForm, age_min: event.target.value })} /></label><label className="field"><span>{text.maxAge}</span><input type="number" min="3" max="12" required value={projectForm.age_max} onChange={(event) => setProjectForm({ ...projectForm, age_max: event.target.value })} /></label><label className="field"><span>{text.supervision}</span><select value={projectForm.supervision_level} onChange={(event) => setProjectForm({ ...projectForm, supervision_level: event.target.value as SupervisionLevel })}>{supervisionLevels.map((item) => <option value={item} key={item}>{supervisionLabels[locale][item]}</option>)}</select></label></div>
              <label className="field"><span>{text.safety}</span><textarea rows={3} value={projectForm.safety_notes} onChange={(event) => setProjectForm({ ...projectForm, safety_notes: event.target.value })} /></label>
              <div className="form-grid"><label className="field"><span>{text.materials}</span><textarea rows={5} value={projectForm.materials} onChange={(event) => setProjectForm({ ...projectForm, materials: event.target.value })} /></label><label className="field"><span>{text.steps}</span><textarea rows={5} value={projectForm.steps} onChange={(event) => setProjectForm({ ...projectForm, steps: event.target.value })} /></label></div>
              <div className="form-grid"><label className="field"><span>{text.status}</span><select value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value as ContentStatus })}>{formStatuses(projectForm.status).map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}</select></label><div className="field"><span>{text.availability}</span><label className="checkbox-control"><input type="checkbox" checked={projectForm.is_free} onChange={(event) => setProjectForm({ ...projectForm, is_free: event.target.checked })} /><span>{text.freeContent}</span></label></div></div>
            </>}

            <div className="form-actions"><button className="button button--ghost" type="button" onClick={closeEditor} disabled={saving}>{text.cancel}</button><button className="button button--primary" type="submit" disabled={saving}>{saving ? text.saving : editor.id ? text.save : text.create}</button></div>
          </form>
        )}
      </Modal>
    </div>
  )
}
