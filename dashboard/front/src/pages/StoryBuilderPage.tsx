import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { MediaPicker } from '../components/MediaPicker'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import type { StoryWorkspace, StoryWorkspacePage } from '../types/api'

/**
 * محرّر القصة المصوّرة.
 *
 * ## ما كان مكسورًا
 *
 * الشاشة القديمة كانت تُصيّر *كل* صفحات القصة معًا في عمود واحد، كلٌّ بمحرّرها
 * الكامل وحالتها المحلّية وطلب صورتها. فقصة بأربعين صفحة كانت تُركّب أربعين
 * محرّرًا وتُطلق ثمانين طلب blob. ولم يكن هناك «صفحة مختارة» إطلاقًا: النقر على
 * مصغّرة كان يُنفّذ `scrollIntoView`.
 *
 * وفوق ذلك كان الصنف `story-editor--three` مُطبَّقًا على `.page-stack` لا على
 * شبكة المحرّر، فتحوّلت حزمة الصفحة إلى ثلاثة أعمدة متساوية وانحصر المحرّر في
 * ثلثها. هذا مصدر «الفراغ الهائل في الوسط».
 *
 * ## البنية الآن
 *
 *   مسّاح الصفحات  ←  لوحة العرض  ←  المفتِّش
 *
 * صفحة واحدة مختارة في كل لحظة، صورتها في المركز بأكبر حجم تتيحه النافذة،
 * وحقولها في عمود المفتِّش. الأعمدة الثلاثة لكلٍّ تمريرها الخاص، والصفحة نفسها
 * لا تُمرَّر — فلا يُخرج تمرير النصّ الصورةَ من الشاشة.
 *
 * ## حالة المحرّر في العنوان
 *
 * `?page=4&lang=en&inspect=audio` تعني أنّ رابط عائق النشر يفتح الصفحة المعنيّة
 * على تبويب المفتِّش الذي يُصلحه. بلا ذلك كان «الصفحة ٦ بلا سرد» يُنزل المحرِّر
 * في أول القصة ليبحث بنفسه.
 *
 * ## ما لا يفعله هذا المحرّر
 *
 * لا يرسم نصًّا على الصورة. `story_page_localizations` تحفظ النصّ بلا إحداثيات،
 * فرسمه على الصورة كان سيخترع موضعًا لا يعرفه المخطَّط ولا التطبيق. النصّ يظهر
 * أسفل الصورة كما يظهر في القارئ.
 */

const LANGUAGES = ['ar', 'en', 'fr'] as const
const INSPECTOR_TABS = ['content', 'image', 'audio', 'layout'] as const
type InspectorTab = (typeof INSPECTOR_TABS)[number]

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed'

const LAYOUTS = ['full_bleed', 'split', 'panels', 'text_focus'] as const

const copy = {
  ar: {
    contentRoot: 'المحتوى',
    stories: 'القصص',
    builder: 'المحرّر',
    loading: 'جارٍ تحميل القصة...',
    loadError: 'تعذر تحميل القصة',
    notFound: 'القصة غير موجودة',
    denied: 'لا تملك صلاحية تحرير هذه القصة.',
    retry: 'إعادة المحاولة',
    backToWorkspace: 'مساحة العمل',

    saveIdle: 'لا تعديلات',
    saveDirty: 'تعديلات غير محفوظة',
    saveSaving: 'جارٍ الحفظ...',
    saveSaved: 'محفوظ',
    saveFailed: 'فشل الحفظ',
    saveNow: 'حفظ',
    saveShortcut: 'Ctrl+S',

    /// الأرقام تُمرَّر منسَّقة من موضع النداء: هذا نصٌّ عربي، وأرقامه تتبع لغة
    /// الواجهة كما في بقيّة اللوحة. النسب وحدها تبقى لاتينية داخل `dir="ltr"`.
    pageOf: (current: string, total: string) => `صفحة ${current} من ${total}`,
    noPageSelected: 'لا صفحة مختارة',
    noPageSelectedDesc: 'اختر صفحة من المسّاح، أو أضف أول صفحة.',

    pages: 'الصفحات',
    addPage: 'إضافة صفحة',
    duplicatePage: 'تكرار الصفحة',
    deletePage: 'حذف الصفحة',
    moveUp: 'نقل لأعلى',
    moveDown: 'نقل لأسفل',
    pageActions: 'إجراءات الصفحة',
    reordering: 'جارٍ إعادة الترتيب...',

    noImage: 'لا توجد صورة لهذه الصفحة',
    noImageDesc: 'ارفع صورة أو اخترها من مكتبة الوسائط. الصورة مشتركة بين كل اللغات.',
    uploadImage: 'رفع صورة',
    chooseMedia: 'اختيار من الوسائط',
    imageProcessing: (status: string) => `الصورة حالتها «${status}» — لن تُقبل في النشر قبل أن تصير ready`,
    imageFailed: 'فشل تحميل الصورة المرتبطة',

    zoomFit: 'ملاءمة',
    zoomFull: '١٠٠٪',
    focusMode: 'تركيز',
    exitFocus: 'إظهار الأعمدة',
    toggleNav: 'مسّاح الصفحات',
    toggleInspector: 'المفتِّش',

    tabContent: 'النصّ',
    tabImage: 'الصورة',
    tabAudio: 'السرد',
    tabLayout: 'التخطيط',

    pageText: 'نصّ الصفحة',
    pageTextHint: 'هذا ما يقرأه الطفل. لا تضع فيه ملاحظات داخلية.',
    altText: 'وصف الصورة لسهولة الوصول',
    altTextHint: 'يقرأه قارئ الشاشة بدل الصورة. وصفٌ لما فيها لا إعادة صياغة للنصّ.',
    characters: 'حرف',

    imageAsset: 'الأصل',
    imageStatus: 'الحالة',
    imageDimensions: 'الأبعاد',
    imageAspect: 'النسبة',
    imageSize: 'الحجم',
    imageType: 'النوع',
    replaceImage: 'استبدال الصورة',
    removeImage: 'إزالة الصورة',
    sharedAsset: 'أصل مشترك بين اللغات',

    narration: 'السرد',
    narrationFor: (language: string) => `سرد ${language.toUpperCase()}`,
    narrationMissing: 'لا سرد لهذه اللغة',
    narrationStatus: 'الحالة',
    narrationSource: 'المصدر',
    narrationSourceGenerated: 'مُصيَّر آليًّا — لم يُراجَع',
    narrationSourceUpload: 'مرفوع',
    narrationSourceCatalog: 'من الكتالوج',
    narrationSourceImport: 'مستورد',
    chooseNarration: 'اختيار صوت',
    removeNarration: 'إزالة السرد',
    languageSpecific: 'خاصّ باللغة',
    timing: 'مؤشّرات التوقيت',

    layout: 'التخطيط',
    layoutFullBleed: 'صورة كاملة',
    layoutSplit: 'صورة ونصّ',
    layoutPanels: 'لوحات',
    layoutTextFocus: 'نصّ بارز',
    layoutPanelsNote: 'قيمة «لوحات» بلا جدول لوحات في المخطَّط: لا هندسة ولا ترتيب قراءة. تُحفظ كتخطيط ولا تُنتج بنية لوحات.',
    transition: 'الانتقال',
    duration: 'مدّة العرض (ملّي ثانية)',
    durationHint: 'مدّة عرض الصفحة، وليست بالضرورة طول السرد: صفحة قد تحمل صمتًا مقصودًا.',

    completeness: 'اكتمال الصفحة',
    hasImage: 'صورة',
    hasText: 'نصّ',
    hasNarration: 'سرد',
    hasTiming: 'توقيت',
    ok: 'موجود',
    missing: 'ناقص',
    notCounted: 'غير محسوب',

    confirmDelete: (page: number, image: boolean, texts: number, narrations: number) => {
      const parts: string[] = []
      if (image) parts.push('صورة')
      if (texts) parts.push(`${texts} نصّ`)
      if (narrations) parts.push(`${narrations} سرد`)
      return parts.length
        ? `حذف الصفحة ${page}؟ تحمل ${parts.join(' و')}. الحذف لا يُلغي الأصول من المكتبة، لكنّه يفصلها عن هذه الصفحة.`
        : `حذف الصفحة ${page}؟ لا محتوى فيها.`
    },
    unsavedWarning: 'لديك تعديلات غير محفوظة في هذه الصفحة. المتابعة تفقدها.',
    createDenied: 'الإنشاء يحتاج صلاحية الإنشاء.',
    editDenied: 'التعديل يحتاج صلاحية تعديل البيانات.',
    archiveDenied: 'الحذف يحتاج صلاحية الأرشفة.',
  },
  en: {
    contentRoot: 'Content',
    stories: 'Stories',
    builder: 'Editor',
    loading: 'Loading the story...',
    loadError: 'Unable to load the story',
    notFound: 'Story not found',
    denied: 'You do not have permission to edit this story.',
    retry: 'Retry',
    backToWorkspace: 'Workspace',

    saveIdle: 'No changes',
    saveDirty: 'Unsaved changes',
    saveSaving: 'Saving...',
    saveSaved: 'Saved',
    saveFailed: 'Save failed',
    saveNow: 'Save',
    saveShortcut: 'Ctrl+S',

    pageOf: (current: string, total: string) => `Page ${current} of ${total}`,
    noPageSelected: 'No page selected',
    noPageSelectedDesc: 'Pick a page from the navigator, or add the first one.',

    pages: 'Pages',
    addPage: 'Add page',
    duplicatePage: 'Duplicate page',
    deletePage: 'Delete page',
    moveUp: 'Move up',
    moveDown: 'Move down',
    pageActions: 'Page actions',
    reordering: 'Reordering...',

    noImage: 'This page has no image',
    noImageDesc: 'Upload an image or pick one from the media library. The image is shared across languages.',
    uploadImage: 'Upload image',
    chooseMedia: 'Choose from media',
    imageProcessing: (status: string) => `The image is ${status} — publishing needs it to be ready`,
    imageFailed: 'The linked image failed to load',

    zoomFit: 'Fit',
    zoomFull: '100%',
    focusMode: 'Focus',
    exitFocus: 'Show panels',
    toggleNav: 'Page navigator',
    toggleInspector: 'Inspector',

    tabContent: 'Text',
    tabImage: 'Image',
    tabAudio: 'Narration',
    tabLayout: 'Layout',

    pageText: 'Page text',
    pageTextHint: 'This is what the child reads. Do not put internal notes here.',
    altText: 'Accessible image description',
    altTextHint: 'Read by a screen reader instead of the image. Describe what is in it, do not restate the text.',
    characters: 'characters',

    imageAsset: 'Asset',
    imageStatus: 'Status',
    imageDimensions: 'Dimensions',
    imageAspect: 'Aspect',
    imageSize: 'Size',
    imageType: 'Type',
    replaceImage: 'Replace image',
    removeImage: 'Remove image',
    sharedAsset: 'Shared across languages',

    narration: 'Narration',
    narrationFor: (language: string) => `${language.toUpperCase()} narration`,
    narrationMissing: 'No narration for this language',
    narrationStatus: 'Status',
    narrationSource: 'Source',
    narrationSourceGenerated: 'Machine generated — not reviewed',
    narrationSourceUpload: 'Uploaded',
    narrationSourceCatalog: 'From the catalogue',
    narrationSourceImport: 'Imported',
    chooseNarration: 'Choose audio',
    removeNarration: 'Remove narration',
    languageSpecific: 'Language specific',
    timing: 'Timing cues',

    layout: 'Layout',
    layoutFullBleed: 'Full bleed',
    layoutSplit: 'Image and text',
    layoutPanels: 'Panels',
    layoutTextFocus: 'Text focus',
    layoutPanelsNote: 'The “panels” value has no panel table in the schema: no geometry, no reading order. It is stored as a layout and produces no panel structure.',
    transition: 'Transition',
    duration: 'Display duration (ms)',
    durationHint: 'How long the page is shown, which is not necessarily the narration length: a page may carry deliberate silence.',

    completeness: 'Page completeness',
    hasImage: 'Image',
    hasText: 'Text',
    hasNarration: 'Narration',
    hasTiming: 'Timing',
    ok: 'Present',
    missing: 'Missing',
    notCounted: 'Not counted',

    confirmDelete: (page: number, image: boolean, texts: number, narrations: number) => {
      const parts: string[] = []
      if (image) parts.push('an image')
      if (texts) parts.push(`${texts} text${texts === 1 ? '' : 's'}`)
      if (narrations) parts.push(`${narrations} narration${narrations === 1 ? '' : 's'}`)
      return parts.length
        ? `Delete page ${page}? It holds ${parts.join(' and ')}. Deleting does not remove the assets from the library, but it does detach them from this page.`
        : `Delete page ${page}? It has no content.`
    },
    unsavedWarning: 'You have unsaved changes on this page. Continuing loses them.',
    createDenied: 'Creating needs the create permission.',
    editDenied: 'Editing needs the edit_metadata permission.',
    archiveDenied: 'Deleting needs the archive permission.',
  },
}

const layoutLabel = (layout: string, text: typeof copy['ar']) =>
  layout === 'full_bleed' ? text.layoutFullBleed
    : layout === 'split' ? text.layoutSplit
      : layout === 'panels' ? text.layoutPanels
        : layout === 'text_focus' ? text.layoutTextFocus
          : layout

const sourceLabel = (source: string | null | undefined, text: typeof copy['ar']) =>
  source === 'generated' ? text.narrationSourceGenerated
    : source === 'upload' ? text.narrationSourceUpload
      : source === 'catalog' ? text.narrationSourceCatalog
        : source === 'import' ? text.narrationSourceImport
          : '—'

export function StoryBuilderPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()

  const [workspace, setWorkspace] = useState<StoryWorkspace | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'denied' | 'error'>('loading')
  const [error, setError] = useState('')

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [draftText, setDraftText] = useState('')
  const [draftAlt, setDraftAlt] = useState('')
  const [busy, setBusy] = useState(false)
  const [picker, setPicker] = useState<'image' | 'audio' | null>(null)
  const [navOpen, setNavOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [zoom, setZoom] = useState<'fit' | 'full'>('fit')
  const [imageFailed, setImageFailed] = useState(false)

  const canCreate = hasPermission('create')
  const canEdit = hasPermission('edit_metadata')
  const canArchive = hasPermission('archive')

  // --- حالة المحرّر في العنوان ---------------------------------------------
  const pageParam = Number(params.get('page') ?? '1')
  const langParam = params.get('lang') ?? ''
  const rawInspect = params.get('inspect') ?? 'content'
  const inspectorTab: InspectorTab = (INSPECTOR_TABS as readonly string[]).includes(rawInspect)
    ? (rawInspect as InspectorTab)
    : 'content'

  const setParam = useCallback((key: string, value: string, fallback = '') => {
    const next = new URLSearchParams(params)
    if (!value || value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }, [params, setParams])

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.storyWorkspace(id)
      setWorkspace(response.data)
      setState('ok')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setState('missing')
      else if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) setState('denied')
      else setState('error')
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }, [id, text.loadError])

  useEffect(() => { void load() }, [load])

  const pages = workspace?.pages ?? []
  const declared = workspace?.story.languages ?? ['ar']
  const defaultLanguage = workspace?.story.default_language ?? 'ar'
  const language = langParam || defaultLanguage

  const selected: StoryWorkspacePage | null = useMemo(() => {
    if (pages.length === 0) return null
    return pages.find((page) => page.page_number === pageParam) ?? pages[0]
  }, [pages, pageParam])

  const localized = selected?.localizations.find((entry) => entry.language === language) ?? null

  // المسوّدة تُزامن مع الصفحة واللغة المختارتين. الحفظ صريح، فلا يُكتب شيء بمجرّد
  // التبديل — والحالة `dirty` تُنبّه قبل الفقد.
  useEffect(() => {
    setDraftText(localized?.body_text ?? '')
    setDraftAlt(localized?.alt_text ?? '')
    setSaveState('idle')
    setImageFailed(false)
  }, [selected?.id, language, localized?.body_text, localized?.alt_text])

  const dirty = saveState === 'dirty' || saveState === 'saving'

  const savePage = useCallback(async () => {
    if (!selected || !canEdit) return
    setSaveState('saving')
    try {
      await api.savePageLocalization(selected.id, language, {
        body_text: draftText.trim() || null,
        alt_text: draftAlt.trim() || null,
        narration_asset_id: localized?.narration_asset_id ?? null,
        // مؤشّرات التوقيت تُمرَّر كما هي: لا شيء في هذا المحرّر يكتبها، وإفراغها
        // بالحفظ كان سيمحو بيانات ربّما كتبها مسار آخر.
        timing_cues: [],
      })
      setSaveState('saved')
      await load()
    } catch (caught) {
      setSaveState('failed')
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }, [selected, canEdit, language, draftText, draftAlt, localized?.narration_asset_id, load, text.loadError])

  // Ctrl/Cmd+S يحفظ. لا نختطف مفاتيح أخرى: أسهم التنقّل تتعارض مع الكتابة في
  // منطقة نصّ، والتنقّل بين الصفحات له أزراره.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void savePage()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [savePage])

  // تحذير قبل مغادرة التبويب بتعديلات غير محفوظة.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const guardUnsaved = useCallback(() => {
    if (!dirty) return true
    return window.confirm(text.unsavedWarning)
  }, [dirty, text.unsavedWarning])

  const selectPage = (pageNumber: number) => {
    if (!guardUnsaved()) return
    setParam('page', String(pageNumber), '1')
  }

  const switchLanguage = (next: string) => {
    if (!guardUnsaved()) return
    // اللغة تتغيّر والصفحة تبقى: تبديل اللغة سؤال عن *هذه* الصفحة بلغة أخرى.
    setParam('lang', next, defaultLanguage)
  }

  async function addPage() {
    if (!workspace || !canCreate) return
    setBusy(true)
    try {
      await api.createStoryPage(workspace.story.id, { layout: 'full_bleed' })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setBusy(false)
    }
  }

  async function deletePage(page: StoryWorkspacePage) {
    if (!canArchive) return
    const texts = page.localizations.filter((entry) => entry.has_text).length
    const narrations = page.localizations.filter((entry) => !!entry.narration_asset_id).length
    // الأثر يُقال قبل التنفيذ: صفحة تحمل صورة وثلاث ترجمات وسردين ليست صفحة فارغة.
    if (!window.confirm(text.confirmDelete(page.page_number, !!page.image_asset_id, texts, narrations))) return
    setBusy(true)
    try {
      await api.deleteStoryPage(page.id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setBusy(false)
    }
  }

  /// النقل خطوة واحدة. الترتيب يُرسل كاملًا لأنّ الخادم يرفض أي ترتيب جزئي:
  /// `UNIQUE (story_id, page_number)` تجعل الترتيب الجزئي حالةً لا يمكن إصلاحها.
  async function movePage(page: StoryWorkspacePage, direction: -1 | 1) {
    if (!workspace || !canEdit) return
    const index = pages.findIndex((entry) => entry.id === page.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= pages.length) return
    const order = pages.map((entry) => entry.id)
    ;[order[index], order[target]] = [order[target], order[index]]
    setBusy(true)
    try {
      await api.reorderStoryPages(workspace.story.id, order)
      await load()
      setParam('page', String(target + 1), '1')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setBusy(false)
    }
  }

  async function attachAsset(assetId: string) {
    if (!selected) return
    setBusy(true)
    try {
      if (picker === 'image') {
        await api.updateStoryPage(selected.id, { image_asset_id: assetId })
      } else {
        await api.savePageLocalization(selected.id, language, {
          body_text: draftText.trim() || null,
          alt_text: draftAlt.trim() || null,
          narration_asset_id: assetId,
          timing_cues: [],
        })
      }
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setBusy(false)
      setPicker(null)
    }
  }

  async function detachImage() {
    if (!selected || !canEdit) return
    setBusy(true)
    try {
      await api.updateStoryPage(selected.id, { image_asset_id: null })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function detachNarration() {
    if (!selected || !canEdit) return
    setBusy(true)
    try {
      await api.savePageLocalization(selected.id, language, {
        body_text: draftText.trim() || null,
        alt_text: draftAlt.trim() || null,
        narration_asset_id: null,
        timing_cues: [],
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function updateLayout(patch: Record<string, unknown>) {
    if (!selected || !canEdit) return
    setBusy(true)
    try {
      await api.updateStoryPage(selected.id, patch)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' && !workspace) return <LoadingState label={text.loading} />
  if (state === 'missing') {
    return (
      <div className="page-stack">
        <EmptyState
          title={text.notFound}
          description={text.loadError}
          action={<Link className="button button--ghost" to={adminPath('stories')}>{text.stories}</Link>}
        />
      </div>
    )
  }
  if (state === 'denied') return <div className="page-stack"><ErrorState message={error || text.denied} /></div>
  if (!workspace) return <div className="page-stack"><ErrorState message={error} onRetry={() => void load()} /></div>

  const story = workspace.story
  const title = locale === 'en' ? story.title_en || story.title_ar : story.title_ar

  const saveLabel = saveState === 'saving' ? text.saveSaving
    : saveState === 'saved' ? text.saveSaved
      : saveState === 'failed' ? text.saveFailed
        : saveState === 'dirty' ? text.saveDirty
          : text.saveIdle
  const saveTone = saveState === 'saved' ? 'saved'
    : saveState === 'saving' ? 'saving'
      : saveState === 'failed' ? 'failed'
        : saveState === 'dirty' ? 'dirty'
          : 'idle'

  /// نسبة الصفحة من أبعاد الأصل الفعلية، فلا تُشوَّه صورة 4:3 لتبدو 16:9.
  const aspect = selected?.image_width && selected?.image_height
    ? selected.image_width / selected.image_height
    : 16 / 9

  const bodyClass = [
    'story-builder__body',
    !navOpen && inspectorOpen ? 'story-builder__body--no-nav' : '',
    navOpen && !inspectorOpen ? 'story-builder__body--no-inspector' : '',
    !navOpen && !inspectorOpen ? 'story-builder__body--focus' : '',
  ].filter(Boolean).join(' ')

  const pageFlags = (page: StoryWorkspacePage) => {
    const entry = page.localizations.find((item) => item.language === language)
    return [
      { key: 'img', label: text.hasImage, ok: !!page.image_asset_id && page.image_status === 'ready' },
      { key: 'txt', label: language.toUpperCase(), ok: !!entry?.has_text },
      { key: 'vo', label: '♪', ok: !!entry?.narration_ready },
    ]
  }

  return (
    <div className="story-builder">
      {/* ── الشريط اللاصق ─────────────────────────────────────────────── */}
      <header className="story-builder__bar">
        <div className="story-builder__identity">
          <Breadcrumbs items={[
            { label: text.contentRoot, to: adminPath('') },
            { label: text.stories, to: adminPath('stories') },
            { label: title, to: adminPath(`stories/${id}`) },
            { label: text.builder },
          ]} />
          <h2>{title}</h2>
        </div>

        {selected && (
          <span className="story-builder__page-of">
            {text.pageOf(formatNumber(selected.page_number, locale), formatNumber(pages.length, locale))}
          </span>
        )}

        {/* مبدّل اللغة بارز: تبديل اللغة أكثر فعل يتكرّر في قصة متعدّدة اللغات. */}
        <div className="story-lang-switch" role="group" aria-label={text.tabContent}>
          {LANGUAGES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={language === item}
              data-declared={declared.includes(item) ? 'true' : 'false'}
              title={declared.includes(item) ? undefined : `${item.toUpperCase()} — ${text.notCounted}`}
              onClick={() => switchLanguage(item)}
            >{item.toUpperCase()}</button>
          ))}
        </div>

        <span className={`story-save-state story-save-state--${saveTone}`} role="status" aria-live="polite">
          <Icon name={saveState === 'failed' ? 'warning' : saveState === 'saved' ? 'check' : 'clock'} size={13} />
          {saveLabel}
        </span>

        <button
          className="button button--primary button--small"
          type="button"
          onClick={() => void savePage()}
          disabled={!canEdit || saveState === 'saving' || saveState === 'idle'}
          title={canEdit ? text.saveShortcut : text.editDenied}
        ><Icon name="check" size={14} />{text.saveNow}</button>

        <Link className="button button--ghost button--small" to={adminPath(`stories/${id}`)}>
          {text.backToWorkspace}
        </Link>
      </header>

      {error && <div className="inline-alert inline-alert--error" role="alert">{error}</div>}

      <div className={bodyClass}>
        {/* ── مسّاح الصفحات ───────────────────────────────────────────── */}
        <aside className="story-builder__nav" aria-label={text.pages}>
          <div className="story-nav__head">
            <strong>{text.pages} <span className="title-count">{formatNumber(pages.length, locale)}</span></strong>
            <button
              className="icon-button icon-button--small"
              type="button"
              aria-label={text.toggleNav}
              title={text.toggleNav}
              onClick={() => setNavOpen(false)}
            ><Icon name="close" size={14} /></button>
          </div>

          <ul className="story-nav__list">
            {pages.map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  className={`story-nav__item ${selected?.id === page.id ? 'story-nav__item--active' : ''}`}
                  aria-current={selected?.id === page.id ? 'true' : undefined}
                  onClick={() => selectPage(page.page_number)}
                >
                  <span className="story-nav__num" dir="ltr">{formatNumber(page.page_number, locale)}</span>
                  <span className="story-nav__body">
                    <span className="story-nav__thumb">
                      {page.image_url
                        ? <img src={page.image_url} alt="" loading="lazy" />
                        : <Icon name="media" size={18} />}
                    </span>
                    <span className="story-nav__flags">
                      {pageFlags(page).map((flag) => (
                        <span
                          className={`story-nav__flag story-nav__flag--${flag.ok ? 'ok' : 'bad'}`}
                          key={flag.key}
                        >{flag.label}</span>
                      ))}
                    </span>
                  </span>
                </button>

                {/* أدوات الصفحة في قائمة سياقية لا سلّة بجوار كل صفحة: السلّة
                    الظاهرة دائمًا تجعل الحذف بنفس بروز الاختيار. */}
                <div className="story-nav__item-menu">
                  <button
                    className="icon-button icon-button--small"
                    type="button"
                    aria-label={`${text.moveUp}: ${page.page_number}`}
                    title={text.moveUp}
                    disabled={busy || !canEdit || page.page_number === 1}
                    onClick={() => void movePage(page, -1)}
                  ><Icon name="arrow" size={12} /></button>
                </div>
              </li>
            ))}

            <li>
              <button
                type="button"
                className="story-nav__item story-nav__add"
                disabled={busy || !canCreate}
                title={canCreate ? undefined : text.createDenied}
                onClick={() => void addPage()}
              >
                <Icon name="plus" size={15} />
                <span>{text.addPage}</span>
              </button>
            </li>
          </ul>
        </aside>

        {/* ── لوحة العرض ──────────────────────────────────────────────── */}
        <main className="story-builder__canvas">
          <div className="story-canvas__stage">
            {!selected ? (
              <div className="story-canvas__empty">
                <Icon name="books" size={34} />
                <strong>{text.noPageSelected}</strong>
                <p>{text.noPageSelectedDesc}</p>
                {canCreate && (
                  <div className="story-canvas__empty-actions">
                    <button className="button button--primary" type="button" onClick={() => void addPage()}>
                      <Icon name="plus" size={15} />{text.addPage}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`story-canvas__page ${zoom === 'full' ? 'story-canvas__page--zoom' : ''}`}
                style={{ ['--page-aspect' as string]: String(aspect) }}
              >
                {selected.image_url && !imageFailed ? (
                  <img
                    src={selected.image_url}
                    alt=""
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  // حالة فعلية لا لوح أسود: تُسمّي النقص وتحمل الإجراءين.
                  <div className="story-canvas__empty">
                    <Icon name="media" size={34} />
                    <strong>{imageFailed ? text.imageFailed : text.noImage}</strong>
                    <p>{text.noImageDesc}</p>
                    {canEdit && (
                      <div className="story-canvas__empty-actions">
                        <button className="button button--primary" type="button" onClick={() => setPicker('image')}>
                          <Icon name="media" size={15} />{text.chooseMedia}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="story-canvas__foot">
            {!navOpen && (
              <button className="button button--ghost button--small" type="button" onClick={() => setNavOpen(true)}>
                <Icon name="columns" size={13} />{text.toggleNav}
              </button>
            )}

            <div className="story-canvas__zoom" role="group" aria-label={text.zoomFit}>
              <button type="button" aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>{text.zoomFit}</button>
              <button type="button" aria-pressed={zoom === 'full'} onClick={() => setZoom('full')}>{text.zoomFull}</button>
            </div>

            {/* النصّ أسفل الصورة لا فوقها: المخطَّط يحفظ النصّ بلا إحداثيات، فرسمه
                على الصورة كان سيخترع موضعًا لا يعرفه التطبيق. */}
            <p className={`story-canvas__text ${draftText.trim() ? '' : 'story-canvas__text--empty'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
              {draftText.trim() || text.missing}
            </p>

            {!inspectorOpen && (
              <button className="button button--ghost button--small" type="button" onClick={() => setInspectorOpen(true)}>
                <Icon name="settings" size={13} />{text.toggleInspector}
              </button>
            )}
          </div>
        </main>

        {/* ── المفتِّش ─────────────────────────────────────────────────── */}
        <aside className="story-builder__inspector" aria-label={text.toggleInspector}>
          <div className="story-inspector__head">
            <div className="story-inspector__tabs" role="tablist">
              {INSPECTOR_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === tab}
                  onClick={() => setParam('inspect', tab, 'content')}
                >
                  {tab === 'content' ? text.tabContent
                    : tab === 'image' ? text.tabImage
                      : tab === 'audio' ? text.tabAudio
                        : text.tabLayout}
                </button>
              ))}
              <button
                className="icon-button icon-button--small"
                type="button"
                aria-label={text.toggleInspector}
                onClick={() => setInspectorOpen(false)}
              ><Icon name="close" size={14} /></button>
            </div>
          </div>

          {!selected ? (
            <div className="story-inspector__body">
              <p className="story-inspector__hint">{text.noPageSelectedDesc}</p>
            </div>
          ) : (
            <div className="story-inspector__body">
              {inspectorTab === 'content' && (
                <>
                  <section className="story-inspector__section">
                    <h4>{text.pageText} <span dir="ltr">({language.toUpperCase()})</span></h4>
                    {/* التسمية داخل `<label>` نصًّا لا عنوانًا في `<h4>` وحده:
                        `<label>` تلفّ حقلًا بلا نصّ لا تُعطي اسمًا مقروءًا، فيصير
                        الحقل بلا اسم لقارئ الشاشة. واللغة جزء من الاسم لأنّ في
                        المفتِّش حقلَي نصّ يختلفان باللغة وحدها. */}
                    <label>
                      <span>{text.pageText} — {language.toUpperCase()}</span>
                      <textarea
                        value={draftText}
                        dir={language === 'ar' ? 'rtl' : 'ltr'}
                        onChange={(event) => { setDraftText(event.target.value); setSaveState('dirty') }}
                        disabled={!canEdit}
                      />
                    </label>
                    <p className="story-inspector__hint">{text.pageTextHint}</p>
                    <span className="story-inspector__count" dir="ltr">
                      {formatNumber(draftText.length, locale)} {text.characters}
                    </span>
                  </section>

                  <section className="story-inspector__section">
                    <label>
                      <span>{text.altText}</span>
                      <input
                        value={draftAlt}
                        dir={language === 'ar' ? 'rtl' : 'ltr'}
                        onChange={(event) => { setDraftAlt(event.target.value); setSaveState('dirty') }}
                        disabled={!canEdit}
                      />
                    </label>
                    <p className="story-inspector__hint">{text.altTextHint}</p>
                  </section>
                </>
              )}

              {inspectorTab === 'image' && (
                <section className="story-inspector__section">
                  <h4>{text.tabImage}</h4>
                  {/* الصورة مشتركة بين اللغات، والنصّ خاصّ بها. التمييز مُعلَن
                      حتى لا يظنّ المحرِّر أنّه يستبدل صورة الإنجليزية وحدها. */}
                  <p className="story-inspector__hint">{text.sharedAsset}</p>
                  <dl className="story-facts">
                    <div><dt>{text.imageStatus}</dt><dd>{selected.image_status ?? text.missing}</dd></div>
                    <div>
                      <dt>{text.imageDimensions}</dt>
                      <dd dir="ltr">
                        {selected.image_width && selected.image_height
                          ? `${selected.image_width}×${selected.image_height}`
                          : '—'}
                      </dd>
                    </div>
                    <div><dt>{text.imageAspect}</dt><dd dir="ltr">{selected.image_aspect ?? '—'}</dd></div>
                    <div><dt>{text.imageType}</dt><dd dir="ltr">{selected.image_mime ?? '—'}</dd></div>
                    <div>
                      <dt>{text.imageSize}</dt>
                      <dd dir="ltr">{selected.image_size ? `${Math.round(selected.image_size / 1024)} KB` : '—'}</dd>
                    </div>
                  </dl>
                  {selected.image_asset_id && selected.image_status !== 'ready' && (
                    <p className="story-inspector__hint">{text.imageProcessing(String(selected.image_status))}</p>
                  )}
                  <div className="story-canvas__empty-actions">
                    <button className="button button--secondary button--small" type="button" disabled={!canEdit || busy} onClick={() => setPicker('image')}>
                      <Icon name="media" size={14} />{selected.image_asset_id ? text.replaceImage : text.chooseMedia}
                    </button>
                    {selected.image_asset_id && (
                      <button className="button button--ghost button--small" type="button" disabled={!canEdit || busy} onClick={() => void detachImage()}>
                        {text.removeImage}
                      </button>
                    )}
                  </div>
                </section>
              )}

              {inspectorTab === 'audio' && (
                <section className="story-inspector__section">
                  <h4>{text.narrationFor(language)}</h4>
                  <p className="story-inspector__hint">{text.languageSpecific}</p>
                  {localized?.narration_asset_id ? (
                    <div className="story-audio">
                      <dl className="story-facts">
                        <div><dt>{text.narrationStatus}</dt><dd>{localized.narration_status ?? '—'}</dd></div>
                        {/* المصدر يُقال: `generated` تصيير آلي لا تسجيل مُعتمد،
                            ومساواتهما تسمح بنشر صوت لم يراجعه أحد. */}
                        <div><dt>{text.narrationSource}</dt><dd>{sourceLabel(localized.narration_source, text)}</dd></div>
                        <div>
                          <dt>{text.imageSize}</dt>
                          <dd dir="ltr">{localized.narration_size ? `${Math.round(localized.narration_size / 1024)} KB` : '—'}</dd>
                        </div>
                        <div><dt>{text.timing}</dt><dd>{localized.has_timing ? formatNumber(localized.timing_count, locale) : text.notCounted}</dd></div>
                      </dl>
                      <div className="story-audio__row">
                        <button className="button button--secondary button--small" type="button" disabled={!canEdit || busy} onClick={() => setPicker('audio')}>
                          <Icon name="media" size={14} />{text.chooseNarration}
                        </button>
                        <button className="button button--ghost button--small" type="button" disabled={!canEdit || busy} onClick={() => void detachNarration()}>
                          {text.removeNarration}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="story-inspector__hint">{text.narrationMissing}</p>
                      <button className="button button--secondary button--small" type="button" disabled={!canEdit || busy} onClick={() => setPicker('audio')}>
                        <Icon name="media" size={14} />{text.chooseNarration}
                      </button>
                    </>
                  )}
                  <p className="story-inspector__hint">{workspace.capabilities.timing_reason}</p>
                </section>
              )}

              {inspectorTab === 'layout' && (
                <section className="story-inspector__section">
                  <h4>{text.layout}</h4>
                  <label>
                    <span>{text.layout}</span>
                    <select
                      value={selected.layout}
                      disabled={!canEdit || busy}
                      onChange={(event) => void updateLayout({ layout: event.target.value })}
                    >
                      {LAYOUTS.map((item) => (
                        <option value={item} key={item}>{layoutLabel(item, text)}</option>
                      ))}
                    </select>
                  </label>
                  {selected.layout === 'panels' && (
                    // «لوحات» قيمة تخطيط بلا جدول لوحات. قول ذلك هنا يمنع توقّع
                    // محرِّرٍ لبنية غير موجودة.
                    <p className="story-inspector__hint">{text.layoutPanelsNote}</p>
                  )}
                  <label>
                    <span>{text.duration}</span>
                    <input
                      type="number"
                      min="1"
                      dir="ltr"
                      defaultValue={selected.duration_ms ?? ''}
                      disabled={!canEdit || busy}
                      onBlur={(event) => {
                        const value = event.target.value.trim()
                        void updateLayout({ duration_ms: value ? Number(value) : null })
                      }}
                    />
                  </label>
                  <p className="story-inspector__hint">{text.durationHint}</p>
                  <label>
                    <span>{text.transition}</span>
                    <input
                      dir="ltr"
                      defaultValue={selected.transition}
                      disabled={!canEdit || busy}
                      onBlur={(event) => {
                        const value = event.target.value.trim()
                        if (value && value !== selected.transition) void updateLayout({ transition: value })
                      }}
                    />
                  </label>

                  <h4>{text.completeness}</h4>
                  <div className="story-nav__flags">
                    <span className={`story-nav__flag story-nav__flag--${selected.image_status === 'ready' ? 'ok' : 'bad'}`}>
                      {text.hasImage}
                    </span>
                    <span className={`story-nav__flag story-nav__flag--${localized?.has_text ? 'ok' : 'bad'}`}>
                      {text.hasText}
                    </span>
                    <span className={`story-nav__flag story-nav__flag--${localized?.narration_ready ? 'ok' : 'warn'}`}>
                      {text.hasNarration}
                    </span>
                    <span className="story-nav__flag">{text.hasTiming}: {text.notCounted}</span>
                  </div>

                  {canArchive && (
                    <div className="story-canvas__empty-actions">
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        disabled={busy}
                        onClick={() => void deletePage(selected)}
                      ><Icon name="archive" size={14} />{text.deletePage}</button>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </aside>
      </div>

      <MediaPicker
        open={picker !== null}
        kind={picker === 'audio' ? 'audio' : 'image'}
        onClose={() => setPicker(null)}
        onPick={(assetId) => void attachAsset(assetId)}
      />
    </div>
  )
}
