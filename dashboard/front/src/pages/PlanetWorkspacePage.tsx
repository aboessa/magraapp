import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { EntityHeader } from '../components/EntityHeader'
import { DetailTabs } from '../components/DetailTabs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge, TrackBadge } from '../components/StatusBadge'
import { TimelineView, TreeView } from '../components/DataViews'
import type { TreeNode } from '../components/DataViews'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import { MediaThumb } from '../components/MediaPicker'
import { PlanetEditorDrawer } from '../components/PlanetEditorDrawer'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate, formatNumber, statusLabels, trackList } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import type {
  ContentStatus,
  PlanetListRow,
  PlanetTreeEnvelope,
  PlanetWorkspace,
  ProductionItem,
} from '../types/api'

/**
 * مساحة عمل الكوكب.
 *
 * ## ما كانت الصفحة قبل ذلك
 *
 * خمسة تبويبات: وصف، وهوية فيها المعرّف واللون وترتيب العرض، وشبكة سلاسل، وثلاثة
 * أرقام، ولافتة «لا يوجد رصيد وسائط». أي سؤال تشغيلي — ما المنشور؟ ما الناقص؟ ما
 * المتعطّل؟ ما حالة اللغات؟ من يملك الخطوة التالية؟ — كان يلزمه مغادرة الصفحة.
 *
 * ## المبدأ
 *
 * الكوكب أحد أعلى كيانات المحتوى، فمساحته يجب أن تجيب عن حالته كاملةً بلا استعلام
 * قاعدة بيانات ولا تنقّل بين شاشات غير مرتبطة. التجميعة تأتي من نداء واحد
 * (`GET /admin/planets/:id/workspace`)، والشجرة ولوحة الإنتاج نداءان يُطلبان عند
 * فتح تبويبهما فقط لأن حجمهما يتبع الكوكب.
 *
 * ## الصدق قبل الاكتمال
 *
 * كل رقم هنا من عمود موجود. وما لا يمكن قياسه يُعلَن غير متاح ويُسمّى مصدره
 * الصحيح: تحليلات المشاهدة ليست في D1 (سلطتها FamilyState)، ولا نسبة اكتمال إنتاج
 * على مستوى الكوكب لأن الاكتمال يُشتقّ لكل عنصر، ولا حالة نشر للكوكب لأن جدوله لا
 * يحمل حالة. تبويب يقول سبب غيابه أنفع من رقم مُختلق.
 *
 * ## حالة الشاشة في العنوان
 *
 * التبويب وطريقة عرض المحتوى وفلتر حالة السلسلة كلها في `?tab=&view=&status=`،
 * فرابط «تبويب الإنتاج في كوكب أبجد» يُشارَك، وزرّ الرجوع يعيد التبويب السابق.
 */

const copy = {
  ar: {
    contentRoot: 'المحتوى', planets: 'الكواكب',
    loading: 'جارٍ تحميل مساحة عمل الكوكب...', loadError: 'تعذر تحميل مساحة العمل',
    notFound: 'الكوكب غير موجود',
    notFoundDesc: 'قد يكون المعرّف غير صحيح أو حُذف صفّ الكوكب من قاعدة البيانات.',
    denied: 'لا تملك صلاحية عرض هذا الكوكب.', generatedAt: 'حُسبت في',
    active: 'نشط', inactive: 'معطَّل', stateNote: 'حالة تشغيل لا حالة نشر: جدول الكواكب بلا حالة تحريرية',
    edit: 'تعديل', editDenied: 'التعديل يحتاج صلاحية تعديل البيانات.',
    manageMedia: 'إدارة الوسائط', addSeries: 'إضافة سلسلة', createDenied: 'الإنشاء يحتاج صلاحية الإنشاء.',
    quickCreate: 'إنشاء داخل الكوكب',
    addStory: 'إضافة قصة', addBook: 'إضافة كتاب', addGame: 'إضافة لعبة', addProject: 'إضافة نشاط',
    viaSeriesNote: 'السلسلة وحدها تحمل الكوكب. أمّا القصة والكتاب واللعبة والنشاط فتُنسب إلى الكوكب عبر سلسلتها، فمُنتقي السلسلة يُقصر على سلاسل هذا الكوكب.',
    archive: 'تعطيل', reactivate: 'إعادة التنشيط', archiveDenied: 'التعطيل يحتاج صلاحية الأرشفة.',
    archiveConfirm: (name: string, series: number, episodes: number, published: number) =>
      `تعطيل «${name}» يخفيه من كل اختيار جديد. يحمل ${series} سلسلة و${episodes} حلقة، منها ${published} منشورة تبقى منشورة. متابعة؟`,
    archiveError: 'تعذر تعطيل الكوكب',

    tabOverview: 'نظرة عامة', tabContent: 'المحتوى', tabProduction: 'الإنتاج', tabLearning: 'التعلّم',
    tabMedia: 'الوسائط', tabLanguages: 'اللغات', tabReviews: 'المراجعات وسير العمل',
    tabRights: 'الحقوق والإتاحة', tabAnalytics: 'التحليلات', tabActivity: 'السجل',

    health: 'حالة الكوكب', healthContent: 'المحتوى', healthMedia: 'الوسائط', healthLanguages: 'اللغات',
    healthProduction: 'الإنتاج', healthReviews: 'المراجعات', healthLearning: 'التعلّم', healthRights: 'الإتاحة',
    missing: 'ناقص', blocked: 'متعطّل', pending: 'معلّق', linked: 'مرتبط', overrides: 'تجاوز',
    inherited: 'موروث', unavailableShort: 'غير متاح',

    attention: 'ما يحتاج إلى انتباه',
    attentionNone: 'لا شيء معلّق على هذا الكوكب من واقع البيانات المتاحة.',
    attentionNoneDesc: 'لا صور ناقصة ولا عوائق إنتاج ولا مراجعات معلّقة ولا حقوق منتهية.',
    open: 'فتح',

    description: 'الوصف',
    noDescription: 'لا وصف لهذا الكوكب بعد. الوصف يظهر في الفهرس وفي التطبيق.',
    identity: 'الهوية البصرية', slug: 'المعرّف', colour: 'اللون', order: 'ترتيب العرض',
    icon: 'الأيقونة', cover: 'الغلاف', uploaded: 'مرفوعة', notUploaded: 'غير مرفوعة',
    appPreview: 'معاينة بطاقة التطبيق', composition: 'تركيب المحتوى', pipeline: 'مراحل السلاسل',
    early: 'مسوّدة وكتابة', inReview: 'في المراجعة', inProduction: 'إنتاج وجودة',
    ready: 'جاهزة ومجدولة', publishedLabel: 'منشورة',
    fixtures: (count: string) => `${count} سلسلة اختبار مستثناة من العدّادات`,
    unparented: (count: string) => `${count} عنصر مكتبة بلا سلسلة، فلا يمكن نسبته إلى أي كوكب`,
    unscopedShort: 'كل الكتالوج',
    unscopedTarget: 'هذه الشاشة لا تقبل قصرًا بالكوكب بعد، فستفتح على كل الكتالوج لا على عدد هذا الكوكب.',
    contentUpdated: 'آخر تعديل على المحتوى',

    seriesTitle: 'السلاسل', seasons: 'موسم', episodes: 'حلقة', episodesShort: 'حلقة',
    stories: 'قصة', games: 'لعبة', books: 'كتاب', projects: 'نشاط', characters: 'شخصية',
    viewTree: 'شجرة', viewTable: 'جدول', viewGrid: 'بطاقات',
    treeEmpty: 'لا سلاسل في هذا الكوكب بعد.', seriesEmpty: 'لا سلاسل في هذا الكوكب',
    treeLabel: 'شجرة محتوى الكوكب',
    seriesEmptyDesc: 'أضف سلسلة وسيظهر موسمها وحلقاتها هنا.',
    unassignedSeason: 'حلقات بلا موسم', testFixture: 'محتوى اختبار',
    truncated: (shown: string, total: string) => `تُعرض ${shown} حلقة من ${total}.`,
    noVideo: 'بلا فيديو', noThumb: 'بلا صورة', allStatuses: 'كل الحالات', filterStatus: 'حالة السلسلة',
    noCaptions: 'بلا تعليقات', noPoster: 'بلا ملصق',
    publishedRatio: (done: string, total: string) => `${done}/${total} منشورة`,
    ages: 'الأعمار',

    productionBlockers: 'عوائق مُعلَنة', productionPastDue: 'مضى موعدها',
    productionUnowned: 'بلا مالك', productionTracked: 'عناصر لها متابعة',
    productionItems: 'المتطلبات المتعطّلة أو المتأخّرة', productionBoard: 'مصفوفة المتطلبات',
    productionEpisodes: 'الحلقات', productionStories: 'القصص',
    productionEmpty: 'لا متطلبات متعطّلة أو متأخّرة على هذا الكوكب.',
    productionBoardEmpty: 'لا عناصر في خطّ الإنتاج لهذا الكوكب.',
    requirement: 'المتطلب', blockerLabel: 'العائق', due: 'الموعد', owner: 'المسؤول',
    unowned: 'بلا مالك', openProductionCentre: 'مركز الإنتاج', item: 'العنصر',

    objectives: 'الأهداف المرتبطة',
    objectivesEmpty: 'لا هدف تعليمي مرتبط بمحتوى هذا الكوكب.',
    objectiveCode: 'الرمز', objectiveTitle: 'الهدف', skill: 'المهارة',
    withObjective: 'حلقات لها هدف', withoutObjective: 'حلقات بلا هدف',
    gamesWithObjective: 'ألعاب لها هدف', distinctObjectives: 'أهداف مغطّاة',
    catalogue: 'أهداف في الفهرس',

    mediaAssets: 'أصول الكوكب', mediaEmpty: 'لا صورة مرتبطة بهذا الكوكب.',
    mediaEmptyDesc: 'الصور تُربط عبر مكتبة الوسائط بدور icon أو cover أو banner.',
    addImage: 'إضافة صورة', expectedRoles: 'الأدوار المتوقّعة', role: 'الدور', kind: 'النوع',
    assetStatus: 'الحالة', visibility: 'الظهور', dimensions: 'الأبعاد المُعلَنة', updatedAt: 'آخر تحديث',
    seriesWithoutPoster: 'سلاسل بلا ملصق', episodesWithoutThumb: 'حلقات بلا صورة مصغّرة',
    cdnMissing: 'CDN الأصول غير مضبوط في هذه البيئة فلا تُبنى روابط الصور؛ وجود الصورة يُقرأ من روابط الأصول لا من العنوان.',
    openMediaLibrary: 'مكتبة الوسائط',

    language: 'اللغة', coverage: 'التغطية',
    languagesNote: 'التغطية تُقاس على أعمدة موجودة فقط، ولكل قياس مقامه. الخلية الناقصة رابط إلى الشاشة التي تُغلق نقصها.',
    fixCoverage: 'فتح العمل الذي يُغلق النقص',

    reviewsPending: 'مراجعات معلّقة', reviewsChanges: 'طُلبت تعديلات', reviewsApproved: 'مُعتمدة',
    workflowRunning: 'مسارات جارية', stagesOverdue: 'مراحل مضى موعدها',
    religiousPending: 'بانتظار الاعتماد الشرعي',
    reviewsEmpty: 'لا مراجعات معلّقة على محتوى هذا الكوكب.',
    reviewer: 'المراجع', reviewRole: 'الدور', reviewOpened: 'فُتحت',
    reviewerIdOnly: 'لم يُعرف اسم لهذا المعرّف — قد يكون صف المستخدم محذوفًا.',
    reviewerUnassigned: 'بلا مراجع',
    openWorkflow: 'سير العمل', openReviews: 'المراجعات',

    licences: 'اتفاقيات الحقوق',
    licencesEmpty: 'لا اتفاقية حقوق مرتبطة بمعرّفات محتوى هذا الكوكب.',
    licenceOwner: 'المالك', licenceType: 'النوع', licenceExpiry: 'الانتهاء', expired: 'منتهية',
    overridesSeries: 'تجاوزات على سلاسل', overridesEpisodes: 'تجاوزات على حلقات',
    withheld: 'محجوب كليًا', restricted: 'مُقيَّد جغرافيًا', openRights: 'شاشة الحقوق',

    activityEmpty: 'لا سجل تدقيق لهذا الكوكب أو محتواه بعد.', unknownActor: 'غير معروف',
    openAudit: 'سجل التدقيق',
  },
  en: {
    contentRoot: 'Content', planets: 'Planets',
    loading: 'Loading the planet workspace...', loadError: 'Unable to load the workspace',
    notFound: 'Planet not found',
    notFoundDesc: 'The slug may be wrong, or the planet row was removed from the database.',
    denied: 'You do not have permission to view this planet.', generatedAt: 'Computed at',
    active: 'Active', inactive: 'Disabled',
    stateNote: 'Operational state, not a publication state: the planets table has no editorial status',
    edit: 'Edit', editDenied: 'Editing needs the edit_metadata permission.',
    manageMedia: 'Manage media', addSeries: 'Add series', createDenied: 'Creating needs the create permission.',
    quickCreate: 'Create inside this planet',
    addStory: 'Add story', addBook: 'Add book', addGame: 'Add game', addProject: 'Add activity',
    viaSeriesNote: 'Only a series carries the planet. Stories, books, games and activities reach a planet through their series, so the series picker is scoped to this planet’s series.',
    archive: 'Disable', reactivate: 'Reactivate', archiveDenied: 'Disabling needs the archive permission.',
    archiveConfirm: (name: string, series: number, episodes: number, published: number) =>
      `Disabling “${name}” hides it from every new selection. It holds ${series} series and ${episodes} episodes, ${published} of them published, which stay published. Continue?`,
    archiveError: 'Unable to disable the planet',

    tabOverview: 'Overview', tabContent: 'Content', tabProduction: 'Production', tabLearning: 'Learning',
    tabMedia: 'Media', tabLanguages: 'Languages', tabReviews: 'Reviews & workflow',
    tabRights: 'Rights & availability', tabAnalytics: 'Analytics', tabActivity: 'History',

    health: 'Planet health', healthContent: 'Content', healthMedia: 'Media', healthLanguages: 'Languages',
    healthProduction: 'Production', healthReviews: 'Reviews', healthLearning: 'Learning', healthRights: 'Availability',
    missing: 'missing', blocked: 'blocked', pending: 'pending', linked: 'linked', overrides: 'overrides',
    inherited: 'Inherited', unavailableShort: 'unavailable',

    attention: 'What needs attention',
    attentionNone: 'Nothing is outstanding on this planet, from the data available.',
    attentionNoneDesc: 'No missing artwork, no production blockers, no pending reviews, no expired rights.',
    open: 'Open',

    description: 'Description',
    noDescription: 'No description yet. It appears in the index and in the app.',
    identity: 'Visual identity', slug: 'Slug', colour: 'Colour', order: 'Sort order',
    icon: 'Icon', cover: 'Cover', uploaded: 'Uploaded', notUploaded: 'Not uploaded',
    appPreview: 'App card preview', composition: 'Content composition', pipeline: 'Series pipeline',
    early: 'Draft & writing', inReview: 'In review', inProduction: 'Production & QA',
    ready: 'Ready & scheduled', publishedLabel: 'Published',
    fixtures: (count: string) => `${count} test-fixture series excluded from the counters`,
    unparented: (count: string) => `${count} library items have no series, so they cannot be attributed to any planet`,
    unscopedShort: 'whole catalogue',
    unscopedTarget: 'This screen does not accept a planet scope yet, so it opens the whole catalogue rather than this planet’s count.',
    contentUpdated: 'Content last updated',

    seriesTitle: 'Series', seasons: 'seasons', episodes: 'episodes', episodesShort: 'ep.',
    stories: 'stories', games: 'games', books: 'books', projects: 'activities', characters: 'characters',
    viewTree: 'Tree', viewTable: 'Table', viewGrid: 'Cards',
    treeEmpty: 'No series in this planet yet.', seriesEmpty: 'No series in this planet',
    treeLabel: 'Planet content tree',
    seriesEmptyDesc: 'Add a series and its seasons and episodes appear here.',
    unassignedSeason: 'Episodes with no season', testFixture: 'Test fixture',
    truncated: (shown: string, total: string) => `Showing ${shown} of ${total} episodes.`,
    noVideo: 'no video', noThumb: 'no thumbnail', allStatuses: 'All statuses', filterStatus: 'Series status',
    noCaptions: 'no captions', noPoster: 'no poster',
    publishedRatio: (done: string, total: string) => `${done}/${total} published`,
    ages: 'Ages',

    productionBlockers: 'Declared blockers', productionPastDue: 'Past due',
    productionUnowned: 'Without an owner', productionTracked: 'Items with tracking',
    productionItems: 'Blocked or overdue requirements', productionBoard: 'Requirement matrix',
    productionEpisodes: 'Episodes', productionStories: 'Stories',
    productionEmpty: 'No blocked or overdue requirements on this planet.',
    productionBoardEmpty: 'No items in the production pipeline for this planet.',
    requirement: 'Requirement', blockerLabel: 'Blocker', due: 'Due', owner: 'Owner',
    unowned: 'Unowned', openProductionCentre: 'Production centre', item: 'Item',

    objectives: 'Linked objectives',
    objectivesEmpty: 'No learning objective is linked to content in this planet.',
    objectiveCode: 'Code', objectiveTitle: 'Objective', skill: 'Skill',
    withObjective: 'Episodes with an objective', withoutObjective: 'Episodes without one',
    gamesWithObjective: 'Games with an objective', distinctObjectives: 'Objectives covered',
    catalogue: 'Objectives in the catalogue',

    mediaAssets: 'Planet assets', mediaEmpty: 'No artwork is linked to this planet.',
    mediaEmptyDesc: 'Artwork is linked through the media library with the role icon, cover or banner.',
    addImage: 'Add artwork', expectedRoles: 'Expected roles', role: 'Role', kind: 'Kind',
    assetStatus: 'Status', visibility: 'Visibility', dimensions: 'Declared size', updatedAt: 'Updated',
    seriesWithoutPoster: 'Series without a poster', episodesWithoutThumb: 'Episodes without a thumbnail',
    cdnMissing: 'The asset CDN is not configured here, so no image URLs are built; presence is read from the asset links, not from a URL.',
    openMediaLibrary: 'Media library',

    language: 'Language', coverage: 'Coverage',
    languagesNote: 'Coverage is measured only on columns that exist, and every signal carries its denominator. An incomplete cell links to the screen that closes the gap.',
    fixCoverage: 'Open the work that closes this gap',

    reviewsPending: 'Pending reviews', reviewsChanges: 'Changes requested', reviewsApproved: 'Approved',
    workflowRunning: 'Runs in progress', stagesOverdue: 'Stages past due',
    religiousPending: 'Awaiting religious approval',
    reviewsEmpty: 'No pending reviews on this planet’s content.',
    reviewer: 'Reviewer', reviewRole: 'Role', reviewOpened: 'Opened',
    reviewerIdOnly: 'No display name resolves for this id — the user row may be deleted.',
    reviewerUnassigned: 'No reviewer',
    openWorkflow: 'Workflow', openReviews: 'Reviews',

    licences: 'Rights agreements',
    licencesEmpty: 'No rights agreement matches this planet’s content ids.',
    licenceOwner: 'Owner', licenceType: 'Type', licenceExpiry: 'Expiry', expired: 'Expired',
    overridesSeries: 'Series overrides', overridesEpisodes: 'Episode overrides',
    withheld: 'Withheld everywhere', restricted: 'Geo-restricted', openRights: 'Rights screen',

    activityEmpty: 'No audit history for this planet or its content yet.', unknownActor: 'Unknown',
    openAudit: 'Audit log',
  },
}

const TABS = [
  'overview', 'content', 'production', 'learning', 'media',
  'languages', 'reviews', 'rights', 'analytics', 'activity',
] as const
type TabKey = (typeof TABS)[number]

/// تسميات المتطلبات كما في lib/productionMatrix.ts على الخادم، فلا يُعرض مفتاح خام.
const requirementLabels: Record<string, string> = {
  script: 'النصّ', educational: 'المراجعة التربوية', translation_ar: 'النصّ العربي',
  translation_en: 'الترجمة الإنجليزية', translation_fr: 'الترجمة الفرنسية',
  voice_ar: 'الصوت العربي', voice_en: 'الصوت الإنجليزي', voice_fr: 'الصوت الفرنسي',
  artwork: 'الرسوم', video: 'الفيديو', thumbnail: 'الصورة المصغّرة',
  captions: 'الترجمة المصاحبة', qa: 'ضمان الجودة', publish: 'النشر',
}

const roleLabels: Record<string, { ar: string; en: string }> = {
  edu: { ar: 'تربوية', en: 'Educational' },
  lang: { ar: 'لغوية', en: 'Language' },
  sharia: { ar: 'شرعية', en: 'Religious' },
  rights: { ar: 'حقوق', en: 'Rights' },
  qa: { ar: 'جودة', en: 'QA' },
}

/// شريط تغطية يحمل الرقم ومقامه معًا، فلا نسبة بلا أساس تُقرأ منها.
function CoverageBar({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const tone = total === 0 ? 'muted' : percent >= 100 ? 'good' : percent > 0 ? 'warn' : 'danger'
  return (
    <div className={`coverage coverage--${tone}`}>
      <span className="coverage__track"><span style={{ width: `${percent}%` }} /></span>
      <b dir="ltr">{done}/{total}</b>
    </div>
  )
}

function ModuleNotes({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null
  return <ul className="module-notes">{notes.map((note) => <li key={note}>{note}</li>)}</ul>
}

function Unavailable({ message }: { message: string }) {
  return <p className="data-unavailable" role="note">{message}</p>
}

/// إنشاء سياقي من داخل الكوكب.
///
/// ## لماذا قائمة لا أزرار متجاورة
///
/// خمسة أزرار إنشاء في شريط أدوات فيه فلتر ومبدّل عرض تُغرق الإجراء الأساسي
/// (فتح المحتوى) في زحام. القائمة تُبقي فعلًا واحدًا مرئيًّا وتُخفي التفريعات.
///
/// ## ما «الكوكب مُختار مسبقًا» فعلًا
///
/// السلسلة وحدها تحمل `planet_id`. القصة والكتاب واللعبة والنشاط تُنسب إلى كوكب
/// عبر سلسلتها لا بحقل كوكب، فلا يمكن «اختيار الكوكب» في نموذجها. المتاح والصادق
/// هو قصر مُنتقي السلسلة على سلاسل هذا الكوكب — وهو ما يفعله `?planet=` في كل
/// شاشة من هذه الشاشات. لذلك تحمل هذه المداخل ملاحظة تقول إنّ الاختيار سلسلة.
function QuickCreateMenu({ planetId, text }: { planetId: string; text: typeof copy['ar'] }) {
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
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const scope = `planet=${encodeURIComponent(planetId)}`
  const items: Array<{ key: string; label: string; to: string; viaSeries: boolean }> = [
    { key: 'series', label: text.addSeries, to: `series?${scope}&new=1`, viaSeries: false },
    { key: 'story', label: text.addStory, to: `stories?${scope}&new=1`, viaSeries: true },
    { key: 'book', label: text.addBook, to: `library-content?${scope}&kind=books&new=1`, viaSeries: true },
    { key: 'game', label: text.addGame, to: `library-content?${scope}&kind=games&new=1`, viaSeries: true },
    { key: 'project', label: text.addProject, to: `library-content?${scope}&kind=projects&new=1`, viaSeries: true },
  ]

  return (
    <div className="popover-wrap" ref={wrapper}>
      <button
        type="button"
        className="button button--secondary button--small"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
      ><Icon name="plus" size={15} />{text.quickCreate}</button>
      {open && (
        <div className="popover popover--menu" role="menu" aria-label={text.quickCreate}>
          {items.map((item) => (
            <Link
              className="popover__item"
              role="menuitem"
              key={item.key}
              to={adminPath(item.to)}
              title={item.viaSeries ? text.viaSeriesNote : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon name="plus" size={14} />{item.label}
            </Link>
          ))}
          <p className="popover__note">{text.viaSeriesNote}</p>
        </div>
      )}
    </div>
  )
}

function MetricRow({ cells, locale }: {
  cells: Array<{ key: string; label: string; value: number | string; tone?: string }>
  locale: 'ar' | 'en'
}) {
  return (
    <div className="metric-row">
      {cells.map((cell) => (
        <div className={`metric-cell metric-cell--${cell.tone ?? 'neutral'}`} key={cell.key}>
          <strong>{typeof cell.value === 'number' ? formatNumber(cell.value, locale) : cell.value}</strong>
          <span>{cell.label}</span>
        </div>
      ))}
    </div>
  )
}

/// الطوابع في D1 على شكلين: `datetime('now')` بمسافة، وISO بـT وZ. التطبيع قبل
/// العرض يمنع «تاريخ غير صالح» على نصف الصفوف.
const stamp = (value: string) => (value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)

export function PlanetWorkspacePage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()

  const [workspace, setWorkspace] = useState<PlanetWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'denied' | 'error'>('loading')
  const [editorOpen, setEditorOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [tree, setTree] = useState<PlanetTreeEnvelope | null>(null)
  const [treeError, setTreeError] = useState('')
  const [board, setBoard] = useState<ProductionItem[] | null>(null)
  const [boardError, setBoardError] = useState('')

  const rawTab = params.get('tab') ?? 'overview'
  const tab = (TABS as readonly string[]).includes(rawTab) ? (rawTab as TabKey) : 'overview'
  const contentView = params.get('view') ?? 'tree'
  const seriesStatus = params.get('status') ?? ''
  /// نوع لوحة الإنتاج في العنوان لا في الذاكرة. كان في `useState`، فرابط منسوخ من
  /// شريط العنوان وهو يعرض عوائق القصص يفتح عند المستلم على عوائق الحلقات، وزرّ
  /// التحديث يُعيد المشغّل إلى النوع الخطأ. بقية حالة هذه الصفحة في العنوان، فلا
  /// سبب يجعل هذا الحقل وحده استثناءً.
  const boardType: 'episode' | 'story' = params.get('board') === 'story' ? 'story' : 'episode'

  const setParam = useCallback((key: string, value: string, fallback = '') => {
    const next = new URLSearchParams(params)
    if (!value || value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }, [params, setParams])

  const canEdit = hasPermission('edit_metadata')
  const canArchive = hasPermission('archive')
  const canCreate = hasPermission('create')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.planetWorkspace(id)
      setWorkspace(response.data)
      setState('ok')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setState('missing')
      else if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) setState('denied')
      else setState('error')
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => { void load() }, [load])

  // الشجرة تُطلب مع أول فتح لتبويب المحتوى فقط، ولا تُعاد بعد نجاحها.
  useEffect(() => {
    if (tab !== 'content' || tree || treeError) return
    void api.planetTree(id)
      .then(setTree)
      .catch((caught) => setTreeError(caught instanceof Error ? caught.message : text.loadError))
  }, [tab, tree, treeError, id, text.loadError])

  // لوحة الإنتاج تُطلب لكل نوع على حدة: تقييم بوابة النشر مُعطَّل (with_publish=0)
  // لأنه يكلّف عدة استعلامات لكل عنصر ولا يلزم هذه النظرة.
  useEffect(() => {
    if (tab !== 'production') return
    setBoard(null)
    setBoardError('')
    void api.productionBoard({ type: boardType, planet_id: id, with_publish: 0, limit: 20 })
      .then((response) => setBoard(response.data))
      .catch((caught) => setBoardError(caught instanceof Error ? caught.message : text.loadError))
  }, [tab, boardType, id, text.loadError])

  if (loading && !workspace) return <LoadingState label={text.loading} />
  if (state === 'missing') {
    return (
      <div className="page-stack">
        <EmptyState
          title={text.notFound}
          description={text.notFoundDesc}
          action={<Link className="button button--secondary" to={adminPath('planets')}>{text.planets}</Link>}
        />
      </div>
    )
  }
  if (state === 'denied') return <ErrorState message={error || text.denied} />
  if (!workspace) return <ErrorState message={error || text.loadError} onRetry={() => void load()} />

  const { planet, content, media, localization, production, learning, reviews, rights, analytics, attention, activity } = workspace
  const name = locale === 'en' ? planet.name_en || planet.name_ar : planet.name_ar

  /// نفس شكل صفّ الفهرس، فيُعاد استخدام درج المحرِّر بلا نسخة ثانية منه.
  const asListRow: PlanetListRow = {
    ...planet,
    health: {
      series_total: content.series_total,
      series_published: content.series_published,
      series_pipeline: content.series_pipeline,
      seasons_total: content.seasons_total,
      episodes_total: content.episodes_total,
      episodes_published: content.episodes_published,
      episodes_ready_unpublished: content.episodes_ready_unpublished,
      stories_total: content.stories_total,
      books_total: content.books_total,
      games_total: content.games_total,
      projects_total: content.projects_total,
      characters_total: content.characters_total,
      artwork_icon: planet.artwork_icon,
      artwork_cover: planet.artwork_cover,
      has_description: !!planet.description_ar,
      production_blockers: production.blocked,
      reviews_pending: reviews.pending,
      series_with_english_title: 0,
      content_updated_at: content.content_updated_at,
    },
  }

  async function archive() {
    setBusy(true)
    try {
      // الخادم يرفض أولًا بـ409 مع أثر التعطيل، فالتأكيد يُبنى على أرقامه.
      await api.archivePlanet(id)
      await load()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        const impact = (caught.payload as { impact?: { series: number; episodes: number; published_series: number } } | null)?.impact
        if (window.confirm(text.archiveConfirm(
          name,
          impact?.series ?? content.series_total,
          impact?.episodes ?? content.episodes_total,
          impact?.published_series ?? content.series_published,
        ))) {
          try { await api.archivePlanet(id, true); await load() }
          catch (forced) { setError(forced instanceof Error ? forced.message : text.archiveError) }
        }
      } else {
        setError(caught instanceof Error ? caught.message : text.archiveError)
      }
    } finally { setBusy(false) }
  }

  async function reactivate() {
    setBusy(true)
    try { await api.updatePlanet(id, { is_active: true }); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.archiveError) }
    finally { setBusy(false) }
  }

  /// شريط الحالة: كل مؤشّر يفتح التبويب الذي يحلّه. الوحدة التي تعذّرت قراءتها
  /// تُعلن ذلك ولا تُلوَّن أخضر — «لا نعرف» ليست «كل شيء سليم».
  const healthCells: Array<{
    key: string; label: string; value: string; detail: string
    tone: 'neutral' | 'good' | 'warn' | 'danger'; tab: TabKey; unavailable: string | null
  }> = [
    {
      key: 'content',
      label: text.healthContent,
      value: formatNumber(
        content.series_total + content.episodes_total + content.stories_total
        + content.games_total + content.books_total + content.projects_total, locale),
      detail: `${formatNumber(content.episodes_published, locale)} ${text.publishedLabel}`,
      tone: 'neutral', tab: 'content', unavailable: content.unavailable,
    },
    {
      key: 'media',
      label: text.healthMedia,
      value: formatNumber(media.series_without_poster + media.episodes_without_thumbnail
        + (planet.artwork_icon ? 0 : 1) + (planet.artwork_cover ? 0 : 1), locale),
      detail: text.missing,
      tone: media.series_without_poster + media.episodes_without_thumbnail > 0 ? 'warn' : 'good',
      tab: 'media', unavailable: media.unavailable,
    },
    {
      key: 'languages',
      label: text.healthLanguages,
      value: localization.languages.map((entry) => {
        const story = entry.signals.find((signal) => signal.key === 'story_text')
        const percent = story && story.total > 0 ? Math.round((story.done / story.total) * 100) : 0
        return `${entry.language.toUpperCase()} ${percent}%`
      }).join(' · '),
      detail: text.coverage, tone: 'neutral', tab: 'languages', unavailable: localization.unavailable,
    },
    {
      key: 'production',
      label: text.healthProduction,
      value: formatNumber(production.blocked, locale),
      detail: text.blocked,
      tone: production.blocked > 0 ? 'danger' : 'good',
      tab: 'production', unavailable: production.unavailable,
    },
    {
      key: 'reviews',
      label: text.healthReviews,
      value: formatNumber(reviews.pending + reviews.needs_changes, locale),
      detail: text.pending,
      tone: reviews.needs_changes > 0 ? 'danger' : reviews.pending > 0 ? 'warn' : 'good',
      tab: 'reviews', unavailable: reviews.unavailable,
    },
    {
      key: 'learning',
      label: text.healthLearning,
      value: `${formatNumber(learning.episodes_with_objective, locale)}/${formatNumber(learning.episodes_total, locale)}`,
      detail: text.linked,
      tone: learning.episodes_total > learning.episodes_with_objective ? 'warn' : 'good',
      tab: 'learning', unavailable: learning.unavailable,
    },
    {
      key: 'rights',
      label: text.healthRights,
      value: rights.own_policy ? String((rights.own_policy as { mode?: string }).mode ?? '—') : text.inherited,
      detail: `${formatNumber(rights.series_overrides + rights.episode_overrides, locale)} ${text.overrides}`,
      tone: rights.expired_licences > 0 ? 'danger' : 'neutral',
      tab: 'rights', unavailable: rights.unavailable,
    },
  ]

  const attentionSection = (
    <section className="panel attention" aria-labelledby="attention-title">
      <header className="panel__header">
        <div>
          <span className="panel__kicker">{text.health}</span>
          <h3 id="attention-title">
            {text.attention} <span className="title-count">{formatNumber(attention.length, locale)}</span>
          </h3>
        </div>
      </header>
      {attention.length === 0 ? (
        <div className="panel__body">
          <p className="attention__clear"><Icon name="check" size={16} />{text.attentionNone}</p>
          <p className="panel__note">{text.attentionNoneDesc}</p>
        </div>
      ) : (
        <ul className="attention__list">
          {attention.map((item) => {
            const label = locale === 'en' ? item.label_en : item.label_ar
            // الوجهة إمّا تبويب في هذه الصفحة أو شاشة أخرى مفلترة — كلتاهما رابط حقيقي.
            const own = `/planets/${id}`
            const to = item.drill.startsWith(own)
              ? `${adminPath(`planets/${id}`)}${item.drill.slice(own.length)}`
              : adminPath(item.drill.replace(/^\//, ''))
            return (
              <li className={`attention__item attention__item--${item.tone}`} key={item.key}>
                <span className="attention__count">{formatNumber(item.count, locale)}</span>
                <div className="attention__body">
                  <strong>{label}</strong>
                  {item.note && <small>{item.note}</small>}
                </div>
                <Link className="button button--ghost button--small" to={to}>
                  {text.open}<Icon name="arrow" size={13} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  const overviewTab = (
    <div className="workspace-stack">
      {attentionSection}

      <div className="workspace-columns">
        <section className="panel">
          <header className="panel__header"><h3>{text.description}</h3></header>
          <div className="panel__body">
            <p className="workspace-prose">{planet.description_ar || text.noDescription}</p>
            <dl className="workspace-facts">
              <div><dt>{text.slug}</dt><dd dir="ltr">{planet.id}</dd></div>
              <div><dt>{text.order}</dt><dd>{formatNumber(planet.sort_order, locale)}</dd></div>
              <div>
                <dt>{text.contentUpdated}</dt>
                <dd dir="ltr">
                  {content.content_updated_at ? formatDate(stamp(content.content_updated_at), locale, true) : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="panel">
          <header className="panel__header"><h3>{text.identity}</h3></header>
          <div className="panel__body">
            <div className="identity-grid">
              <div className="identity-swatch" style={{ background: planet.color_hex }} aria-hidden="true" />
              <div className="identity-facts">
                <span>{text.colour}</span>
                <code dir="ltr">{planet.color_hex}</code>
                <ul>
                  <li>
                    <span>{text.icon}</span>
                    <strong className={planet.artwork_icon ? 'field__ok' : 'field__warn'}>
                      {planet.artwork_icon ? text.uploaded : text.notUploaded}
                    </strong>
                  </li>
                  <li>
                    <span>{text.cover}</span>
                    <strong className={planet.artwork_cover ? 'field__ok' : 'field__warn'}>
                      {planet.artwork_cover ? text.uploaded : text.notUploaded}
                    </strong>
                  </li>
                </ul>
              </div>
            </div>

            {/* معاينة حقيقية: نفس الصورة واللون والاسم الذي يظهر في التطبيق. */}
            <div className="app-preview">
              <span className="app-preview__label">{text.appPreview}</span>
              <div className="app-preview__card" style={{ ['--planet-colour' as string]: planet.color_hex }}>
                {planet.cover_url || planet.icon_url
                  ? <img src={planet.cover_url || planet.icon_url || ''} alt="" />
                  : <Icon name="planets" size={26} />}
                <strong>{name}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <header className="panel__header"><h3>{text.pipeline}</h3></header>
        <div className="panel__body">
          {content.unavailable ? <Unavailable message={content.unavailable} /> : (
            <div className="pipeline-row">
              {[
                { key: 'early', label: text.early, value: content.series_early },
                { key: 'review', label: text.inReview, value: content.series_in_review },
                { key: 'production', label: text.inProduction, value: content.series_in_production },
                { key: 'ready', label: text.ready, value: content.series_ready },
                { key: 'published', label: text.publishedLabel, value: content.series_published },
              ].map((stage) => (
                <div className="pipeline-cell" key={stage.key}>
                  <strong>{formatNumber(stage.value, locale)}</strong>
                  <span>{stage.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )

  // --- content ------------------------------------------------------------
  const allSeries = tree?.data ?? []
  const filteredSeries = allSeries.filter((series) => !seriesStatus || series.status === seriesStatus)

  /// صفوف الشجرة تحمل ما تحمله الحمولة فعلًا: الحالة، النقص، اللغات المُعلَنة،
  /// وتاريخ التعديل. كان الصف يعرض الاسم والحالة وحدهما بينما `updated_at` و`dubs`
  /// و`has_captions` موجودة في الحمولة بلا عرض — فكان المشغّل يفتح كل حلقة ليعرف
  /// ما كان يمكن أن يقرأه من الصف.
  ///
  /// المقصد `href` لا `onOpen`: الشجرة يُتنقَّل فيها كثيرًا، والرابط الحقيقي يتيح
  /// النقر الأوسط وفتح في تبويب جديد.
  const episodeNode = (episode: PlanetTreeEnvelope['data'][number]['unassigned_episodes'][number]): TreeNode => {
    const dubs = (episode.dubs ?? '').split(',').map((value) => value.trim()).filter(Boolean)
    return {
      id: episode.id,
      label: `${episode.episode_number ? `${formatNumber(episode.episode_number, locale)} — ` : ''}${episode.title_ar}`,
      href: adminPath(`episodes/${episode.id}`),
      tags: [
        { label: statusLabels[locale][episode.status], tone: episode.is_published ? 'good' as const : 'muted' as const },
        // النقص وحده يُعرض. شريحة «به فيديو» على كل حلقة سليمة ضجيج يُخفي الاستثناء.
        ...(episode.has_video ? [] : [{ label: text.noVideo, tone: 'danger' as const }]),
        ...(episode.has_thumbnail ? [] : [{ label: text.noThumb, tone: 'warn' as const }]),
        ...(episode.has_captions ? [] : [{ label: text.noCaptions, tone: 'warn' as const }]),
        // اللغات المُعلَنة في `episodes.dubs`. تُعرض كما هي بلا حكم على اكتمالها:
        // العمود إعلان لا إثبات وجود ملف، وتبويب اللغات يشرح ذلك.
        ...(dubs.length ? [{ label: dubs.join(' · ').toUpperCase(), tone: 'muted' as const }] : []),
      ],
      meta: formatDate(stamp(episode.updated_at), locale),
    }
  }

  const treeNodes: TreeNode[] = filteredSeries.map((series) => ({
    id: series.id,
    label: `${series.title_ar}${series.content_class === 'test_fixture' ? ` — ${text.testFixture}` : ''}`,
    href: adminPath(`series/${series.id}`),
    thumb: series.cover_url ?? null,
    badge: `${formatNumber(series.episodes_count, locale)} ${text.episodesShort}`,
    tags: [
      { label: statusLabels[locale][series.status], tone: series.status === 'published' ? 'good' as const : 'muted' as const },
      ...(series.cover_url ? [] : [{ label: text.noPoster, tone: 'warn' as const }]),
      ...(series.episodes_count > 0 && series.episodes_published < series.episodes_count
        ? [{ label: text.publishedRatio(
            formatNumber(series.episodes_published, locale),
            formatNumber(series.episodes_count, locale),
          ), tone: 'muted' as const }]
        : []),
    ],
    meta: formatDate(stamp(series.updated_at), locale),
    children: [
      ...series.seasons.map((season) => ({
        id: season.id,
        label: season.title_ar || `${text.seasons} ${formatNumber(season.season_number, locale)}`,
        href: adminPath(`seasons/${season.id}`),
        badge: formatNumber(season.episodes_count, locale),
        children: season.episodes.map(episodeNode),
      })),
      ...(series.unassigned_episodes.length ? [{
        // مجموعة اصطناعية لا كيان، فلا مقصد لها: رابط إلى «موسم» غير موجود
        // كان سيقود إلى 404.
        id: `${series.id}-unassigned`,
        label: text.unassignedSeason,
        badge: formatNumber(series.unassigned_episodes.length, locale),
        children: series.unassigned_episodes.map(episodeNode),
      }] : []),
    ],
  }))

  const seriesCards = (
    <div className="planet-grid planet-grid--series">
      {filteredSeries.map((series) => (
        <article className="planet-card" key={series.id}>
          <div className="planet-card__media">
            {series.cover_url
              ? <img src={series.cover_url} alt="" loading="lazy" />
              : <div className="planet-card__media-fallback"><Icon name="series" size={26} /></div>}
          </div>
          <div className="planet-card__body">
            <div className="planet-card__title-row">
              <h3><Link className="planet-card__link" to={adminPath(`series/${series.id}`)}>{series.title_ar}</Link></h3>
            </div>
            <div className="planet-card__signals">
              <StatusBadge status={series.status} />
              {trackList(series.track_ids).map((track) => <TrackBadge track={track} key={track} />)}
              {series.content_class === 'test_fixture' && (
                <span className="planet-chip planet-chip--muted">{text.testFixture}</span>
              )}
            </div>
          </div>
          <div className="planet-card__metrics">
            <span className="planet-chip"><b>{formatNumber(series.seasons_count, locale)}</b> {text.seasons}</span>
            <span className="planet-chip"><b>{formatNumber(series.episodes_count, locale)}</b> {text.episodes}</span>
            {series.episodes_published > 0 && (
              <span className="planet-chip planet-chip--good">
                <b>{formatNumber(series.episodes_published, locale)}</b> {text.publishedLabel}
              </span>
            )}
          </div>
          <footer className="planet-card__footer">
            <span dir="ltr">{formatNumber(series.age_min, locale)}–{formatNumber(series.age_max, locale)}</span>
            <Icon name="arrow" size={14} />
          </footer>
        </article>
      ))}
    </div>
  )

  const seriesTable = (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table data-table--wide">
        <thead>
          <tr>
            <th>{text.seriesTitle}</th>
            <th>{text.filterStatus}</th>
            <th>{text.seasons}</th>
            <th>{text.episodes}</th>
            <th>{text.publishedLabel}</th>
            <th>{text.ages}</th>
            <th>{text.contentUpdated}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filteredSeries.map((series) => (
            <tr key={series.id}>
              <td>
                <Link className="entity-cell entity-cell--button" to={adminPath(`series/${series.id}`)}>
                  <EntityThumbnail src={series.cover_url} alt="" label={series.title_ar} icon="series" />
                  <div><strong>{series.title_ar}</strong><small dir="ltr">{series.slug}</small></div>
                </Link>
              </td>
              <td><StatusBadge status={series.status} /></td>
              <td>{formatNumber(series.seasons_count, locale)}</td>
              <td>{formatNumber(series.episodes_count, locale)}</td>
              <td>{formatNumber(series.episodes_published, locale)}</td>
              <td dir="ltr">{formatNumber(series.age_min, locale)}–{formatNumber(series.age_max, locale)}</td>
              <td dir="ltr">{formatDate(stamp(series.updated_at), locale)}</td>
              <td>
                <Link className="button button--ghost button--small" to={adminPath(`series/${series.id}`)}>{text.open}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const contentTab = (
    <div className="workspace-stack">
      <section className="panel">
        <header className="panel__header panel__header--filters">
          <div>
            <h3>{text.seriesTitle} <span className="title-count">{formatNumber(filteredSeries.length, locale)}</span></h3>
            {tree?.meta.truncated && (
              <p className="panel__note">
                {text.truncated(formatNumber(tree.meta.episodes_returned, locale), formatNumber(tree.meta.episodes_total, locale))}
              </p>
            )}
            {tree?.meta.notes?.map((note) => <p className="panel__note" key={note}>{note}</p>)}
          </div>
          <div className="filters-row filters-row--toolbar">
            <label className="planet-sort">
              <span>{text.filterStatus}</span>
              <select value={seriesStatus} onChange={(event) => setParam('status', event.target.value)}>
                <option value="">{text.allStatuses}</option>
                {(Object.keys(statusLabels[locale]) as ContentStatus[]).map((key) => (
                  <option value={key} key={key}>{statusLabels[locale][key]}</option>
                ))}
              </select>
            </label>
            <div className="view-switcher" role="group" aria-label={text.viewTree}>
              {([['tree', text.viewTree, 'tree'], ['table', text.viewTable, 'reviews'], ['grid', text.viewGrid, 'media']] as const).map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  className={`view-switcher__button ${contentView === value ? 'view-switcher__button--active' : ''}`}
                  aria-pressed={contentView === value}
                  onClick={() => setParam('view', value, 'tree')}
                ><Icon name={icon} size={16} /><span>{label}</span></button>
              ))}
            </div>
            {canCreate && <QuickCreateMenu planetId={id} text={text} />}
          </div>
        </header>

        <div className="panel__body">
          {treeError ? <ErrorState message={treeError} onRetry={() => { setTreeError(''); setTree(null) }} />
            : !tree ? <LoadingState label={text.loading} />
              : filteredSeries.length === 0 ? (
                <EmptyState
                  title={text.seriesEmpty}
                  description={text.seriesEmptyDesc}
                  action={canCreate
                    ? <Link className="button button--primary" to={adminPath(`series?planet=${id}&new=1`)}><Icon name="plus" size={16} />{text.addSeries}</Link>
                    : undefined}
                />
              ) : contentView === 'table' ? seriesTable
                : contentView === 'grid' ? seriesCards
                  : <TreeView nodes={treeNodes} emptyLabel={text.treeEmpty} label={text.treeLabel} />}
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.composition}</h3></header>
        <div className="panel__body">
          {/* كل عدّاد يفتح المجموعة التي عدّها، مقصورة على هذا الكوكب.
              العدّادات التي لا يقبل مقصدها قصرًا بالكوكب تُعلَن صريحةً بـ`scoped:
              false` وتحمل عنوانًا يقول ذلك، فلا يُفتح «٤ كتب» على كل كتب مَجرّة
              بلا تحذير. الكتب والألعاب والأنشطة صارت مقصورة بعد إضافة `planet`
              إلى نقاطها في الخادم. */}
          <div className="composition">
            {[
              { key: 'series', label: text.seriesTitle, value: content.series_total, to: `series?planet=${id}`, scoped: true },
              { key: 'seasons', label: text.seasons, value: content.seasons_total, to: 'seasons', scoped: false },
              { key: 'episodes', label: text.episodes, value: content.episodes_total, to: 'episodes', scoped: false },
              { key: 'stories', label: text.stories, value: content.stories_total, to: 'stories', scoped: false },
              { key: 'games', label: text.games, value: content.games_total, to: `library-content?planet=${id}`, scoped: true },
              { key: 'books', label: text.books, value: content.books_total, to: `library-content?planet=${id}`, scoped: true },
              { key: 'projects', label: text.projects, value: content.projects_total, to: `library-content?planet=${id}`, scoped: true },
              { key: 'characters', label: text.characters, value: content.characters_total, to: 'characters', scoped: false },
            ].map((cell) => (
              <Link
                className="composition__cell"
                to={adminPath(cell.to)}
                key={cell.key}
                title={cell.scoped ? undefined : text.unscopedTarget}
              >
                <strong>{formatNumber(cell.value, locale)}</strong>
                <span>{cell.label}</span>
                {!cell.scoped && <em className="composition__unscoped">{text.unscopedShort}</em>}
              </Link>
            ))}
          </div>
          {content.fixture_series > 0 && (
            <p className="panel__note">{text.fixtures(formatNumber(content.fixture_series, locale))}</p>
          )}
          {content.unparented_stories + content.unparented_games + content.unparented_books + content.unparented_projects > 0 && (
            <p className="panel__note">
              {text.unparented(formatNumber(
                content.unparented_stories + content.unparented_games
                + content.unparented_books + content.unparented_projects, locale))}
            </p>
          )}
        </div>
      </section>
    </div>
  )

  // --- production ---------------------------------------------------------
  const productionTab = production.unavailable ? <Unavailable message={production.unavailable} /> : (
    <div className="workspace-stack">
      <MetricRow
        locale={locale}
        cells={[
          { key: 'blocked', label: text.productionBlockers, value: production.blocked, tone: production.blocked ? 'danger' : 'good' },
          { key: 'past_due', label: text.productionPastDue, value: production.past_due, tone: production.past_due ? 'warn' : 'good' },
          { key: 'unowned', label: text.productionUnowned, value: production.unowned, tone: production.unowned ? 'warn' : 'good' },
          { key: 'tracked', label: text.productionTracked, value: production.tracked_items },
        ]}
      />

      <section className="panel">
        <header className="panel__header">
          <h3>{text.productionItems} <span className="title-count">{formatNumber(production.items.length, locale)}</span></h3>
          <Link className="button button--ghost button--small" to={adminPath('production')}>
            {text.openProductionCentre}<Icon name="arrow" size={13} />
          </Link>
        </header>
        {production.items.length === 0 ? (
          <div className="panel__body">
            <p className="attention__clear"><Icon name="check" size={15} />{text.productionEmpty}</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.item}</th><th>{text.requirement}</th><th>{text.blockerLabel}</th>
                  <th>{text.due}</th><th>{text.owner}</th><th />
                </tr>
              </thead>
              <tbody>
                {production.items.map((item) => (
                  <tr key={`${item.content_type}-${item.content_id}-${item.requirement}`}>
                    <td className="cell-wrap">
                      <strong>{item.title ?? item.content_id}</strong>
                      {item.series_title && <small>{item.series_title}</small>}
                    </td>
                    <td>{requirementLabels[item.requirement] ?? item.requirement}</td>
                    <td className="cell-wrap">
                      {item.blocker ? <span className="planet-chip planet-chip--danger">{item.blocker}</span> : '—'}
                    </td>
                    <td dir="ltr">{item.due_at ? formatDate(item.due_at, locale) : '—'}</td>
                    <td>
                      {item.assignee_name || item.team_name
                        || <span className="planet-chip planet-chip--warn">{text.unowned}</span>}
                    </td>
                    <td>
                      <Link
                        className="button button--ghost button--small"
                        to={adminPath(item.content_type === 'episode' ? `episodes/${item.content_id}` : 'stories')}
                      >{text.open}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ModuleNotes notes={production.notes} />
      </section>

      <section className="panel">
        <header className="panel__header panel__header--filters">
          <h3>{text.productionBoard}</h3>
          <div className="view-switcher" role="group" aria-label={text.productionBoard}>
            {([['episode', text.productionEpisodes], ['story', text.productionStories]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`view-switcher__button ${boardType === value ? 'view-switcher__button--active' : ''}`}
                aria-pressed={boardType === value}
                onClick={() => setParam('board', value, 'episode')}
              ><span>{label}</span></button>
            ))}
          </div>
        </header>
        <div className="panel__body">
          {boardError ? <ErrorState message={boardError} />
            : !board ? <LoadingState label={text.loading} />
              : board.length === 0 ? <p className="data-unavailable">{text.productionBoardEmpty}</p>
                : (
                  <ul className="matrix-list">
                    {board.map((item) => (
                      <li className="matrix-item" key={item.content_id}>
                        <div className="matrix-item__head">
                          <Link to={adminPath(item.content_type === 'episode' ? `episodes/${item.content_id}` : 'stories')}>
                            <strong>{item.title}</strong>
                          </Link>
                          <span className="matrix-item__percent" dir="ltr">{item.summary.percent}%</span>
                        </div>
                        <div className="matrix-item__requirements">
                          {item.requirements.map((requirement) => (
                            <span
                              className={`requirement-chip requirement-chip--${requirement.state}`}
                              key={requirement.key}
                              title={`${requirement.label_ar}: ${requirement.detail}`}
                            >{requirement.label_ar}</span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
        </div>
      </section>
    </div>
  )

  // --- learning -----------------------------------------------------------
  const learningTab = learning.unavailable ? <Unavailable message={learning.unavailable} /> : (
    <div className="workspace-stack">
      <MetricRow
        locale={locale}
        cells={[
          { key: 'with', label: text.withObjective, value: learning.episodes_with_objective },
          {
            key: 'without',
            label: text.withoutObjective,
            value: Math.max(0, learning.episodes_total - learning.episodes_with_objective),
            tone: learning.episodes_total > learning.episodes_with_objective ? 'warn' : 'good',
          },
          { key: 'games', label: text.gamesWithObjective, value: learning.games_with_objective },
          { key: 'distinct', label: text.distinctObjectives, value: learning.distinct_objectives },
          { key: 'catalogue', label: text.catalogue, value: learning.objectives_catalogue, tone: 'muted' },
        ]}
      />
      <section className="panel">
        <header className="panel__header">
          <h3>{text.objectives} <span className="title-count">{formatNumber(learning.objectives.length, locale)}</span></h3>
          <Link className="button button--ghost button--small" to={adminPath('objectives')}>
            {text.open}<Icon name="arrow" size={13} />
          </Link>
        </header>
        {learning.objectives.length === 0
          ? <div className="panel__body"><p className="data-unavailable">{text.objectivesEmpty}</p></div>
          : (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.objectiveCode}</th><th>{text.objectiveTitle}</th><th>{text.skill}</th>
                    <th>{text.ages}</th><th>{text.episodes}</th><th>{text.games}</th>
                  </tr>
                </thead>
                <tbody>
                  {learning.objectives.map((objective) => (
                    <tr key={objective.id}>
                      <td dir="ltr">{objective.code}</td>
                      <td className="cell-wrap">{objective.title_ar}</td>
                      <td>{objective.skill_name || '—'}</td>
                      <td dir="ltr">{formatNumber(objective.age_min, locale)}–{formatNumber(objective.age_max, locale)}</td>
                      <td>{formatNumber(objective.episodes, locale)}</td>
                      <td>{formatNumber(objective.games, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <ModuleNotes notes={learning.notes} />
      </section>
    </div>
  )

  // --- media --------------------------------------------------------------
  const mediaTab = media.unavailable ? <Unavailable message={media.unavailable} /> : (
    <div className="workspace-stack">
      {!media.cdn_configured && <div className="inline-alert inline-alert--info">{text.cdnMissing}</div>}
      <div className="metric-row">
        <div className={`metric-cell metric-cell--${planet.artwork_icon ? 'good' : 'warn'}`}>
          <strong>{planet.artwork_icon ? text.uploaded : text.notUploaded}</strong>
          <span>{text.icon}</span>
        </div>
        <div className={`metric-cell metric-cell--${planet.artwork_cover ? 'good' : 'warn'}`}>
          <strong>{planet.artwork_cover ? text.uploaded : text.notUploaded}</strong>
          <span>{text.cover}</span>
        </div>
        <div className={`metric-cell metric-cell--${media.series_without_poster ? 'warn' : 'good'}`}>
          <strong>{formatNumber(media.series_without_poster, locale)}</strong>
          <span>{text.seriesWithoutPoster}</span>
        </div>
        <div className={`metric-cell metric-cell--${media.episodes_without_thumbnail ? 'warn' : 'good'}`}>
          <strong>{formatNumber(media.episodes_without_thumbnail, locale)}</strong>
          <span>{text.episodesWithoutThumb}</span>
        </div>
      </div>

      <section className="panel">
        <header className="panel__header">
          <div>
            <h3>{text.mediaAssets} <span className="title-count">{formatNumber(media.assets.length, locale)}</span></h3>
            <p className="panel__note">
              {text.expectedRoles}: {[...media.expected_roles.icon, ...media.expected_roles.cover].join(' · ')}
            </p>
          </div>
          <Link className="button button--secondary button--small" to={adminPath('media')}>
            <Icon name="upload" size={15} />{text.openMediaLibrary}
          </Link>
        </header>
        {media.assets.length === 0 ? (
          <div className="panel__body">
            <EmptyState
              title={text.mediaEmpty}
              description={text.mediaEmptyDesc}
              action={<Link className="button button--primary" to={adminPath('media')}><Icon name="plus" size={16} />{text.addImage}</Link>}
            />
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th />
                  <th>{text.role}</th><th>{text.kind}</th><th>{text.assetStatus}</th>
                  <th>{text.visibility}</th><th>{text.dimensions}</th><th>{text.updatedAt}</th><th />
                </tr>
              </thead>
              <tbody>
                {media.assets.map((asset) => (
                  <tr key={asset.link_id}>
                    <td><MediaThumb assetId={asset.asset_id} size={40} alt={asset.title_ar} /></td>
                    <td dir="ltr">{asset.role}{asset.language ? ` · ${asset.language}` : ''}</td>
                    <td dir="ltr">{asset.kind}</td>
                    <td>
                      <span className={`planet-chip ${asset.status === 'ready' ? 'planet-chip--good' : 'planet-chip--warn'}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td dir="ltr">{asset.visibility}</td>
                    <td dir="ltr">
                      {asset.expected_width && asset.expected_height
                        ? `${asset.expected_width}×${asset.expected_height}` : '—'}
                    </td>
                    <td dir="ltr">{asset.updated_at ? formatDate(stamp(asset.updated_at), locale) : '—'}</td>
                    <td>
                      <Link className="button button--ghost button--small" to={adminPath(`media/${asset.asset_id}`)}>
                        {text.open}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )

  // --- languages ----------------------------------------------------------
  const languagesTab = localization.unavailable ? <Unavailable message={localization.unavailable} /> : (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h3>{text.coverage}</h3>
          <p className="panel__note">{text.languagesNote}</p>
        </div>
      </header>
      <div className="table-scroll" tabIndex={0}>
        <table className="data-table data-table--wide">
          <thead>
            <tr>
              <th>{text.language}</th>
              {localization.languages[0]?.signals.map((signal) => <th key={signal.key}>{signal.label_ar}</th>)}
            </tr>
          </thead>
          <tbody>
            {localization.languages.map((entry) => (
              <tr key={entry.language}>
                <td><strong dir="ltr">{entry.language.toUpperCase()}</strong></td>
                {entry.signals.map((signal) => (
                  <td key={signal.key}>
                    {signal.unavailable
                      ? <span className="planet-chip planet-chip--muted" title={signal.unavailable}>{text.unavailableShort}</span>
                      : signal.drill
                        /* الخلية الناقصة رابط إلى الشاشة التي تُغلق النقص. الخلية
                           المكتملة أو غير القابلة للقياس تبقى نصًّا: رابط لا يفتح
                           عملًا هو وعد كاذب. */
                        ? (
                          <Link
                            className="coverage-link"
                            to={adminPath(signal.drill.replace(/^\//, ''))}
                            aria-label={`${text.fixCoverage}: ${signal.label_ar} — ${entry.language.toUpperCase()}`}
                          >
                            <CoverageBar done={signal.done} total={signal.total} />
                            <Icon name="arrow" size={12} />
                          </Link>
                        )
                        : <CoverageBar done={signal.done} total={signal.total} />}
                    {signal.note && <small className="coverage__note">{signal.note}</small>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ModuleNotes notes={localization.notes} />
    </section>
  )

  // --- reviews ------------------------------------------------------------
  const reviewsTab = reviews.unavailable ? <Unavailable message={reviews.unavailable} /> : (
    <div className="workspace-stack">
      <MetricRow
        locale={locale}
        cells={[
          { key: 'pending', label: text.reviewsPending, value: reviews.pending, tone: reviews.pending ? 'warn' : 'good' },
          { key: 'changes', label: text.reviewsChanges, value: reviews.needs_changes, tone: reviews.needs_changes ? 'danger' : 'good' },
          { key: 'approved', label: text.reviewsApproved, value: reviews.approved },
          { key: 'runs', label: text.workflowRunning, value: reviews.runs_running },
          { key: 'overdue', label: text.stagesOverdue, value: reviews.stages_overdue, tone: reviews.stages_overdue ? 'warn' : 'good' },
          // بوابة الحكومة الشرعية تُعرض للكواكب التي لها محتوى بمصدر شرعي فقط.
          ...(reviews.religious_scoped > 0
            ? [{
              key: 'religious',
              label: text.religiousPending,
              value: reviews.religious_pending,
              tone: reviews.religious_pending ? 'danger' : 'good',
            }]
            : []),
        ]}
      />
      <section className="panel">
        <header className="panel__header">
          <h3>{text.reviewsPending} <span className="title-count">{formatNumber(reviews.items.length, locale)}</span></h3>
          <div className="table-actions">
            <Link className="button button--ghost button--small" to={adminPath('content-reviews')}>{text.openReviews}</Link>
            <Link className="button button--ghost button--small" to={adminPath('workflows')}>{text.openWorkflow}</Link>
          </div>
        </header>
        {reviews.items.length === 0
          ? <div className="panel__body"><p className="attention__clear"><Icon name="check" size={15} />{text.reviewsEmpty}</p></div>
          : (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.item}</th><th>{text.reviewRole}</th><th>{text.reviewer}</th>
                    <th>{text.reviewOpened}</th><th />
                  </tr>
                </thead>
                <tbody>
                  {reviews.items.map((item) => (
                    <tr key={item.id}>
                      <td className="cell-wrap">
                        <strong>{item.title ?? item.entity_id}</strong>
                        <small dir="ltr">{item.entity_type}</small>
                      </td>
                      <td>{roleLabels[item.reviewer_role]?.[locale] ?? item.reviewer_role}</td>
                      {/* الاسم من admin_users، والمعرّف احتياط حين حُذف صف المراجع — لا نخفي مراجعة معلّقة. */}
                      <td className="cell-wrap">
                        {item.reviewer_name
                          ? <strong>{item.reviewer_name}</strong>
                          : item.reviewer_id
                            ? <span dir="ltr" title={text.reviewerIdOnly}>{item.reviewer_id}</span>
                            : <span className="text-muted">{text.reviewerUnassigned}</span>}
                      </td>
                      <td dir="ltr">{formatDate(stamp(item.created_at), locale)}</td>
                      <td>
                        <Link
                          className="button button--ghost button--small"
                          to={adminPath(item.entity_type === 'series' ? `series/${item.entity_id}` : `episodes/${item.entity_id}`)}
                        >{text.open}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <ModuleNotes notes={reviews.notes} />
      </section>
    </div>
  )

  // --- rights -------------------------------------------------------------
  const today = new Date().toISOString().slice(0, 10)
  const rightsTab = rights.unavailable ? <Unavailable message={rights.unavailable} /> : (
    <div className="workspace-stack">
      <MetricRow
        locale={locale}
        cells={[
          { key: 'series', label: text.overridesSeries, value: rights.series_overrides },
          { key: 'episodes', label: text.overridesEpisodes, value: rights.episode_overrides },
          { key: 'withheld', label: text.withheld, value: rights.withheld, tone: rights.withheld ? 'warn' : 'good' },
          { key: 'restricted', label: text.restricted, value: rights.restricted },
          { key: 'expired', label: text.expired, value: rights.expired_licences, tone: rights.expired_licences ? 'danger' : 'good' },
        ]}
      />

      {/* لوحة الإتاحة المشتركة بنطاق planet: هي السلطة على ما يُخدَم فعلًا، وتعرض
          السلسلة الموروثة كاملة بدل تكرار قراءة ناقصة هنا. */}
      <AvailabilityPanel scope="planet" entityId={id} />

      <section className="panel">
        <header className="panel__header">
          <h3>{text.licences} <span className="title-count">{formatNumber(rights.licences.length, locale)}</span></h3>
          <Link className="button button--ghost button--small" to={adminPath('rights')}>{text.openRights}</Link>
        </header>
        {rights.licences.length === 0
          ? <div className="panel__body"><p className="data-unavailable">{text.licencesEmpty}</p></div>
          : (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.item}</th><th>{text.licenceOwner}</th>
                    <th>{text.licenceType}</th><th>{text.licenceExpiry}</th>
                  </tr>
                </thead>
                <tbody>
                  {rights.licences.map((licence) => {
                    const expiry = (licence.expiry_date ?? '').slice(0, 10)
                    const expired = !!expiry && expiry < today
                    return (
                      <tr key={licence.id}>
                        <td className="cell-wrap">{licence.title ?? licence.content_id}</td>
                        <td>{licence.owner}</td>
                        <td dir="ltr">{licence.license_type ?? '—'}</td>
                        <td dir="ltr">
                          {expiry
                            ? <span className={`planet-chip ${expired ? 'planet-chip--danger' : ''}`}>{expiry}</span>
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        <ModuleNotes notes={rights.notes} />
      </section>
    </div>
  )

  const activityTab = (
    <section className="panel">
      <header className="panel__header">
        <h3>{text.tabActivity} <span className="title-count">{formatNumber(activity.length, locale)}</span></h3>
        <Link className="button button--ghost button--small" to={adminPath('audit-logs')}>{text.openAudit}</Link>
      </header>
      <div className="panel__body">
        <TimelineView
          entries={activity.map((row) => ({
            id: row.id,
            at: stamp(row.created_at),
            title: `${row.action} · ${row.title ?? row.entity_id ?? row.entity_type}`,
            detail: row.entity_type,
            actor: row.actor_name || row.actor_id || text.unknownActor,
            tone: row.action.includes('archive') ? 'warn' : 'default',
          }))}
          emptyLabel={text.activityEmpty}
        />
      </div>
    </section>
  )

  const tabs = [
    { key: 'overview', label: text.tabOverview, badge: attention.length || undefined, content: overviewTab },
    { key: 'content', label: text.tabContent, badge: content.unavailable ? undefined : content.series_total, content: contentTab },
    { key: 'production', label: text.tabProduction, badge: production.blocked || undefined, content: productionTab },
    { key: 'learning', label: text.tabLearning, content: learningTab },
    { key: 'media', label: text.tabMedia, badge: media.assets.length || undefined, content: mediaTab },
    { key: 'languages', label: text.tabLanguages, content: languagesTab },
    {
      key: 'reviews',
      label: text.tabReviews,
      badge: (reviews.pending + reviews.needs_changes) || undefined,
      content: reviewsTab,
    },
    { key: 'rights', label: text.tabRights, content: rightsTab },
    {
      key: 'analytics',
      label: text.tabAnalytics,
      // تبويب موجود ويقول الحقيقة: لا مقاييس مشاهدة لكوكب في D1، ومصدرها مُسمّى.
      content: (
        <div className="workspace-stack">
          <Unavailable message={analytics.unavailable} />
          <p className="panel__note">{analytics.source}</p>
        </div>
      ),
    },
    { key: 'activity', label: text.tabActivity, badge: activity.length || undefined, content: activityTab },
  ]

  return (
    <div className="page-stack planet-workspace">
      <EntityHeader
        breadcrumbs={[
          { label: text.contentRoot, to: adminPath('') },
          { label: text.planets, to: adminPath('planets') },
          { label: name },
        ]}
        thumbnail={(
          <EntityThumbnail
            src={planet.cover_url || planet.icon_url}
            alt=""
            label={name}
            color={planet.color_hex}
            icon="planets"
            size={64}
          />
        )}
        title={name}
        subtitle={planet.description_ar || undefined}
        meta={(
          <>
            <span dir="ltr">{planet.id}</span>
            <span>{formatNumber(content.series_total, locale)} {text.seriesTitle}</span>
            <span>{formatNumber(content.episodes_total, locale)} {text.episodes}</span>
            <span>{formatNumber(content.stories_total, locale)} {text.stories}</span>
            <span>{formatNumber(content.games_total, locale)} {text.games}</span>
            <span>{formatNumber(content.characters_total, locale)} {text.characters}</span>
            <span className="entity-header__colour">
              <i style={{ background: planet.color_hex }} aria-hidden="true" />
              <code dir="ltr">{planet.color_hex}</code>
            </span>
          </>
        )}
        status={(
          <span
            className={`planet-state ${planet.is_active === false ? 'planet-state--off' : 'planet-state--on'}`}
            title={text.stateNote}
          >{planet.is_active === false ? text.inactive : text.active}</span>
        )}
        actions={(
          <>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setEditorOpen(true)}
              disabled={!canEdit}
              title={canEdit ? undefined : text.editDenied}
            ><Icon name="edit" size={16} />{text.edit}</button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setParam('tab', 'media', 'overview')}
            ><Icon name="media" size={16} />{text.manageMedia}</button>
            {canCreate && (
              <Link className="button button--ghost" to={adminPath(`series?planet=${id}&new=1`)}>
                <Icon name="plus" size={16} />{text.addSeries}
              </Link>
            )}
            {planet.is_active === false ? (
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void reactivate()}
                disabled={!canEdit || busy}
                title={canEdit ? undefined : text.editDenied}
              ><Icon name="refresh" size={16} />{text.reactivate}</button>
            ) : (
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void archive()}
                disabled={!canArchive || busy}
                title={canArchive ? undefined : text.archiveDenied}
              ><Icon name="archive" size={16} />{text.archive}</button>
            )}
          </>
        )}
      />

      {error && <div className="inline-alert inline-alert--error" role="alert">{error}</div>}

      <section className="health-strip" aria-label={text.health}>
        {healthCells.map((cell) => (
          <button
            type="button"
            key={cell.key}
            className={`health-cell health-cell--${cell.unavailable ? 'muted' : cell.tone}`}
            onClick={() => setParam('tab', cell.tab, 'overview')}
            aria-current={tab === cell.tab ? 'true' : undefined}
            title={cell.unavailable ?? undefined}
          >
            <span className="health-cell__label">{cell.label}</span>
            <strong className="health-cell__value">{cell.unavailable ? text.unavailableShort : cell.value}</strong>
            <span className="health-cell__detail">{cell.unavailable ? '' : cell.detail}</span>
          </button>
        ))}
      </section>

      <DetailTabs tabs={tabs} active={tab} onChange={(key) => setParam('tab', key, 'overview')} />

      <p className="workspace-generated" dir="ltr">
        {text.generatedAt} {new Date(workspace.generated_at).toLocaleString(locale === 'ar' ? 'ar' : 'en-GB')}
      </p>

      <PlanetEditorDrawer
        open={editorOpen}
        planet={asListRow}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); void load() }}
      />
    </div>
  )
}
