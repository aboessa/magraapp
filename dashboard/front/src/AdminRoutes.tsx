import { lazy, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { hasAdminSession, verifySession } from './lib/adminSession'
// الشاشات غير المُنفَّذة تبقى ساكنة: كل واحدة ٢–٣ كيلوبايت وتتشارك
// NotImplementedPage، فتقسيمها ينتج ثماني حِزَم صغيرة بلا مكسب.
import { AdvancedFinancePage } from './pages/AdvancedFinancePage'
import { CampaignsPage } from './pages/CampaignsPage'
import { OpsSlaPage } from './pages/OpsSlaPage'
import { QuizBuilderPage } from './pages/QuizBuilderPage'
import { RecommendationsPage } from './pages/RecommendationsPage'
import { RevenuePage } from './pages/RevenuePage'
import { SchoolAccountsPage } from './pages/SchoolAccountsPage'
import { TranslationCenterPage } from './pages/TranslationCenterPage'
import './styles/dashboard.css'
// أنماط استوديو المحرّكات في ملف مستقلّ: dashboard.css قارب التسعين كيلوبايت،
// وإلحاق محرّرات أحد عشر محرّكًا به يجعل مراجعة أي تغيير فيه أصعب.
import './styles/gameStudio.css'
// طبقة UX المشتركة (فلاتر، أدراج، تقويم، خطّ زمني، شجرة) وشاشات الموقع والمدوّنة
// و SEO واللوحة التنفيذية. مفصولة لنفس سبب فصل gameStudio.css.
import './styles/adminUx.css'

/**
 * كل مسارات لوحة الإدارة في وحدة واحدة تُحمّل عند الطلب فقط،
 * حتى لا تحمل صفحة الهبوط العامة حزمة اللوحة كاملة.
 *
 * ## تقسيم على مستوى المسار
 *
 * كانت الوحدة تستورد ٦٧ صفحة استيرادًا ساكنًا، فأصبحت حزمة واحدة بـ١٫١ ميغابايت
 * تُنزَّل بالكامل قبل ظهور لوحة التحكم. أثقل ما فيها ليس الصفحات نفسها بل ما
 * تجرّه: `lib/enginePackIssues.ts` وحده سبعون كيلوبايت، و`enginePack.ts` و
 * `tracePack.ts` ثمانية وخمسون، وكلها لا يحتاجها أحد إلا في استوديو الألعاب.
 *
 * الآن كل صفحة `lazy`، وحدود `Suspense` واحدة حول `Outlet` في `AdminLayout`.
 * ثلاث صفحات تبقى ساكنة:
 *
 * * **لوحة التحكم** هي أول ما يُفتح بعد الدخول؛ تقسيمها يعني نداءً إضافيًا قبل
 *   أول بكسل.
 * * **شاشة الدخول** تُعرض قبل أي مسار.
 * * **الشاشات غير المُنفَّذة** صغيرة وتتشارك مكوّنًا واحدًا.
 *
 * ## حرس الجلسة
 *
 * قبل أي مسار: إن لم تكن هناك جلسة صالحة تُعرض شاشة الدخول.
 *
 * الحرس عرضيّ لا أمني — الخادم هو من يرفض بـ401 — لكنه يمنع شاشات فارغة
 * ورسائل «تعذر التحميل» بلا سبب مفهوم، وهو ما كان يحدث قبل وجود شاشة دخول.
 *
 * وجود الرمز في المتصفح لا يكفي: قد يكون منتهيًا أو مسحوبًا أو الحساب معطَّلًا،
 * وكلها لا تُعرف إلا من الخادم. لذلك يُتحقَّق منه بنداء `/admin/auth/me` مرة
 * عند التحميل، وتُعرض شاشة الدخول عند رفضه.
 */

// --- المحتوى ---------------------------------------------------------------
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const TaxonomyPage = lazy(() => import('./pages/TaxonomyPage').then((module) => ({ default: module.TaxonomyPage })))
const PlanetsPage = lazy(() => import('./pages/PlanetsPage').then((module) => ({ default: module.PlanetsPage })))
// مساحة عمل الكوكب بدل صفحة التفاصيل السابقة: عشرة تبويبات تقرأ تجميعة واحدة،
// فصفحة التفاصيل القديمة (وصف + لون + ترتيب) لم يبقَ لها معنى.
const PlanetWorkspacePage = lazy(() => import('./pages/PlanetWorkspacePage').then((module) => ({ default: module.PlanetWorkspacePage })))
const SkillsPage = lazy(() => import('./pages/SkillsPage').then((module) => ({ default: module.SkillsPage })))
const LearningObjectivesPage = lazy(() => import('./pages/LearningObjectivesPage').then((module) => ({ default: module.LearningObjectivesPage })))
const ContentReviewsPage = lazy(() => import('./pages/ContentReviewsPage').then((module) => ({ default: module.ContentReviewsPage })))
const SeriesPage = lazy(() => import('./pages/SeriesPage').then((module) => ({ default: module.SeriesPage })))
const SeriesDetailPage = lazy(() => import('./pages/SeriesDetailPage').then((module) => ({ default: module.SeriesDetailPage })))
const SeasonsPage = lazy(() => import('./pages/SeasonsPage').then((module) => ({ default: module.SeasonsPage })))
const SeasonDetailPage = lazy(() => import('./pages/SeasonDetailPage').then((module) => ({ default: module.SeasonDetailPage })))
const EpisodesPage = lazy(() => import('./pages/EpisodesPage').then((module) => ({ default: module.EpisodesPage })))
const EpisodeDetailPage = lazy(() => import('./pages/EpisodeDetailPage').then((module) => ({ default: module.EpisodeDetailPage })))
const CharactersPage = lazy(() => import('./pages/CharactersPage').then((module) => ({ default: module.CharactersPage })))
const CharacterDetailPage = lazy(() => import('./pages/CharacterDetailPage').then((module) => ({ default: module.CharacterDetailPage })))
const StoriesPage = lazy(() => import('./pages/StoriesPage').then((module) => ({ default: module.StoriesPage })))
const StoryWorkspacePage = lazy(() => import('./pages/StoryWorkspacePage').then((module) => ({ default: module.StoryWorkspacePage })))
const StoryBuilderPage = lazy(() => import('./pages/StoryBuilderPage').then((module) => ({ default: module.StoryBuilderPage })))
const LibraryHubPage = lazy(() => import('./pages/LibraryHubPage').then((module) => ({ default: module.LibraryHubPage })))
const LibraryContentDetailPage = lazy(() => import('./pages/LibraryContentDetailPage').then((module) => ({ default: module.LibraryContentDetailPage })))
const BooksPage = lazy(() => import('./pages/BooksPage').then((module) => ({ default: module.BooksPage })))
const BookWorkspacePage = lazy(() => import('./pages/BookWorkspacePage').then((module) => ({ default: module.BookWorkspacePage })))
const GamesPage = lazy(() => import('./pages/GamesPage').then((module) => ({ default: module.GamesPage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })))
const ProjectWorkspacePage = lazy(() => import('./pages/ProjectWorkspacePage').then((module) => ({ default: module.ProjectWorkspacePage })))
const VisualStylesPage = lazy(() => import('./pages/VisualStylesPage').then((module) => ({ default: module.VisualStylesPage })))
const NarrationPage = lazy(() => import('./pages/NarrationPage').then((module) => ({ default: module.NarrationPage })))
const QualityPage = lazy(() => import('./pages/QualityPage').then((module) => ({ default: module.QualityPage })))

// --- استوديو الألعاب -------------------------------------------------------
// أثقل مجموعة في اللوحة: صفحة اللعبة تجرّ محرّرات أحد عشر محرّكًا وقواعد التحقّق
// (١٢٦ كيلوبايت من lib وحدها). لا أحد يحتاجها إلا داخل الاستوديو.
const GameDetailPage = lazy(() => import('./pages/GameDetailPage').then((module) => ({ default: module.GameDetailPage })))
const GamesOpsPage = lazy(() => import('./pages/GamesOpsPage').then((module) => ({ default: module.GamesOpsPage })))
const AudioProductionQueuePage = lazy(() => import('./pages/AudioProductionQueuePage').then((module) => ({ default: module.AudioProductionQueuePage })))
const ArtProductionQueuePage = lazy(() => import('./pages/ArtProductionQueuePage').then((module) => ({ default: module.ArtProductionQueuePage })))

// --- الوسائط ---------------------------------------------------------------
const MediaLibraryPage = lazy(() => import('./pages/MediaLibraryPage').then((module) => ({ default: module.MediaLibraryPage })))
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage').then((module) => ({ default: module.AssetDetailPage })))

// --- العملاء والدعم --------------------------------------------------------
const ParentsPage = lazy(() => import('./pages/ParentsPage').then((module) => ({ default: module.ParentsPage })))
const CustomersPage = lazy(() => import('./pages/CustomersPage').then((module) => ({ default: module.CustomersPage })))
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetailPage').then((module) => ({ default: module.CustomerDetailPage })))
const ChildrenPage = lazy(() => import('./pages/ChildrenPage').then((module) => ({ default: module.ChildrenPage })))
const DevicesAdminPage = lazy(() => import('./pages/DevicesAdminPage').then((module) => ({ default: module.DevicesAdminPage })))
const SupportCenterPage = lazy(() => import('./pages/SupportCenterPage').then((module) => ({ default: module.SupportCenterPage })))

// --- التجارة ---------------------------------------------------------------
const BillingPage = lazy(() => import('./pages/BillingPage').then((module) => ({ default: module.BillingPage })))
const PackagesPage = lazy(() => import('./pages/PackagesPage').then((module) => ({ default: module.PackagesPage })))
const RightsPage = lazy(() => import('./pages/RightsPage').then((module) => ({ default: module.RightsPage })))
const PartnershipsPage = lazy(() => import('./pages/PartnershipsPage').then((module) => ({ default: module.PartnershipsPage })))

// --- التشغيل ---------------------------------------------------------------
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })))
const MasteryPage = lazy(() => import('./pages/MasteryPage').then((module) => ({ default: module.MasteryPage })))
const MyTasksPage = lazy(() => import('./pages/MyTasksPage').then((module) => ({ default: module.MyTasksPage })))
const ProductionPage = lazy(() => import('./pages/ProductionPage').then((module) => ({ default: module.ProductionPage })))
const WorkflowPage = lazy(() => import('./pages/WorkflowPage').then((module) => ({ default: module.WorkflowPage })))
const ContentCalendarPage = lazy(() => import('./pages/ContentCalendarPage').then((module) => ({ default: module.ContentCalendarPage })))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage').then((module) => ({ default: module.AuditLogPage })))
const FailedEventsPage = lazy(() => import('./pages/FailedEventsPage').then((module) => ({ default: module.FailedEventsPage })))
const OpsPage = lazy(() => import('./pages/OpsPage').then((module) => ({ default: module.OpsPage })))
const AppExperiencePage = lazy(() => import('./pages/AppExperiencePage').then((module) => ({ default: module.AppExperiencePage })))
const RemoteConfigPage = lazy(() => import('./pages/RemoteConfigPage').then((module) => ({ default: module.RemoteConfigPage })))

// --- الفريق ----------------------------------------------------------------
const TeamsPage = lazy(() => import('./pages/TeamsPage').then((module) => ({ default: module.TeamsPage })))
const RolesPage = lazy(() => import('./pages/RolesPage').then((module) => ({ default: module.RolesPage })))
const TeamAccessPage = lazy(() => import('./pages/TeamAccessPage').then((module) => ({ default: module.TeamAccessPage })))

// --- الموقع والمدوّنة و SEO -------------------------------------------------
const WebsitePagesPage = lazy(() => import('./pages/WebsitePagesPage').then((module) => ({ default: module.WebsitePagesPage })))
const WebsitePageEditor = lazy(() => import('./pages/WebsitePageEditor').then((module) => ({ default: module.WebsitePageEditor })))
const BlogPostsPage = lazy(() => import('./pages/BlogPostsPage').then((module) => ({ default: module.BlogPostsPage })))
const BlogPostEditor = lazy(() => import('./pages/BlogPostEditor').then((module) => ({ default: module.BlogPostEditor })))
const BlogTaxonomyPage = lazy(() => import('./pages/BlogTaxonomyPage').then((module) => ({ default: module.BlogTaxonomyPage })))
const SeoOperationsPage = lazy(() => import('./pages/SeoOperationsPage').then((module) => ({ default: module.SeoOperationsPage })))

export default function AdminRoutes() {
  // 'checking' حالة ثالثة ضرورية: بلا فصلها عن 'signed-out' تظهر شاشة الدخول
  // لحظةً لكل مستخدم بجلسة صالحة قبل أن تُستبدل، وهو وميض مزعج.
  const [state, setState] = useState<'checking' | 'signed-in' | 'signed-out'>(
    () => (hasAdminSession() ? 'checking' : 'signed-out'),
  )

  useEffect(() => {
    if (state !== 'checking') return
    let cancelled = false
    void verifySession().then((user) => {
      if (!cancelled) setState(user ? 'signed-in' : 'signed-out')
    })
    return () => { cancelled = true }
  }, [state])

  if (state === 'checking') {
    return (
      <div className="admin-login" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
      </div>
    )
  }

  if (state === 'signed-out') return <AdminLoginPage onSignedIn={() => setState('signed-in')} />

  return (
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="taxonomy" element={<TaxonomyPage />} />
        <Route path="planets" element={<PlanetsPage />} />
        <Route path="planets/:id" element={<PlanetWorkspacePage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="objectives" element={<LearningObjectivesPage />} />
        <Route path="content-reviews" element={<ContentReviewsPage />} />
        <Route path="series" element={<SeriesPage />} />
        <Route path="series/:id" element={<SeriesDetailPage />} />
        <Route path="seasons" element={<SeasonsPage />} />
        <Route path="seasons/:id" element={<SeasonDetailPage />} />
        <Route path="episodes" element={<EpisodesPage />} />
        <Route path="episodes/:id" element={<EpisodeDetailPage />} />
        <Route path="characters" element={<CharactersPage />} />
        <Route path="characters/:id" element={<CharacterDetailPage />} />
        <Route path="stories" element={<StoriesPage />} />
        {/* مساحة العمل والمحرّر سياقان مختلفان بمساران مختلفان.
            كان `stories/:id` يفتح المحرّر مباشرةً، فمن أراد حالة القصة كان يهبط
            في سطح تأليف صفحات. الآن: `:id` يُدير القصة ككيان، و`:id/builder`
            يُؤلّف صفحاتها. */}
        <Route path="stories/:id" element={<StoryWorkspacePage />} />
        <Route path="stories/:id/builder" element={<StoryBuilderPage />} />
        <Route path="library" element={<LibraryHubPage />} />
        <Route path="library-content" element={<LibraryHubPage />} />
        <Route path="library-content/:kind/:id" element={<LibraryContentDetailPage />} />
        <Route path="books" element={<BooksPage />} />
        <Route path="books/:id" element={<BookWorkspacePage />} />
        <Route path="games" element={<GamesPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectWorkspacePage />} />
        {/* استوديو الرسم: صفحة تأليف لحزمة اللعبة وهندستها ومعاينتها وجاهزيتها.
            منفصلة عن صفحة المكتبة لأن تلك تعرض الحزمة كـJSON للقراءة فقط. */}
        <Route path="games/:id" element={<GameDetailPage />} />
        {/* عمليّات الألعاب وطوابير الإنتاج: ثلاث شاشات تقرأ المسارات الأربعة
            الجديدة في adminGames.ts. مفصولة عن صفحة اللعبة لأن أسئلتها على
            مستوى الكتالوج: ما يجب تسجيله، وما يجب رسمه، وأين تعطّل. */}
        <Route path="games-ops" element={<GamesOpsPage />} />
        <Route path="games-audio-queue" element={<AudioProductionQueuePage />} />
        <Route path="games-art-queue" element={<ArtProductionQueuePage />} />
        <Route path="media" element={<MediaLibraryPage />} />
        <Route path="media/:id" element={<AssetDetailPage />} />
        <Route path="visual-styles" element={<VisualStylesPage />} />
        <Route path="parents" element={<ParentsPage />} />
        {/* Customer 360: القائمة ثم مساحة العمل. منفصلة عن /parents لأن تلك قراءة
            إسقاط الوالدين، وهذه سؤال «أي عائلة تحتاج تدخّلًا الآن». */}
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="children" element={<ChildrenPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="team-access" element={<TeamAccessPage />} />
        <Route path="tasks" element={<MyTasksPage />} />
        {/* مركز الإنتاج: مصفوفة متطلبات لكل حلقة/قصة، مشتقّة من الأصول.
            منفصل عن /tasks لأن ذاك مهام عامة وهذا خطّ إنتاج المحتوى. */}
        <Route path="production" element={<ProductionPage />} />
        {/* تقويم المحتوى: شاشة تخطيط واحدة عبر تسعة جداول مجدولة. منفصلة عن
            تبويب التقويم في المدوّنة والموقع لأن سؤالها أوسع من أي قائمة. */}
        <Route path="calendar" element={<ContentCalendarPage />} />
        <Route path="audit-logs" element={<AuditLogPage />} />
        <Route path="failed-events" element={<FailedEventsPage />} />
        <Route path="narration" element={<NarrationPage />} />
        <Route path="quality" element={<QualityPage />} />
        <Route path="mastery" element={<MasteryPage />} />
        <Route path="app-experience" element={<AppExperiencePage />} />
        <Route path="devices-admin" element={<DevicesAdminPage />} />
        <Route path="support-center" element={<SupportCenterPage />} />
        <Route path="workflows" element={<WorkflowPage />} />
        <Route path="rights" element={<RightsPage />} />
        <Route path="remote-config" element={<RemoteConfigPage />} />
        <Route path="packages" element={<PackagesPage />} />
        <Route path="ops" element={<OpsPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="revenue" element={<RevenuePage />} />
        <Route path="translation" element={<TranslationCenterPage />} />
        <Route path="quiz" element={<QuizBuilderPage />} />
        <Route path="recommendations" element={<RecommendationsPage />} />
        <Route path="school" element={<SchoolAccountsPage />} />
        <Route path="finance-advanced" element={<AdvancedFinancePage />} />
        <Route path="ops-sla" element={<OpsSlaPage />} />
        <Route path="partnerships" element={<PartnershipsPage />} />
        {/* الموقع العام والمدوّنة و SEO: الواجهات الإدارية للـAPI الذي كان بلا
            شاشات. القائمة والمحرِّر منفصلان لأن الأول سؤال «ما حالة الموقع» والثاني
            مساحة عمل صفحة واحدة بأقسامها ومراجعاتها وسجلّها. */}
        <Route path="website/pages" element={<WebsitePagesPage />} />
        <Route path="website/pages/:id" element={<WebsitePageEditor />} />
        <Route path="blog/posts" element={<BlogPostsPage />} />
        <Route path="blog/posts/:id" element={<BlogPostEditor />} />
        <Route path="blog/taxonomy" element={<BlogTaxonomyPage />} />
        <Route path="seo" element={<SeoOperationsPage />} />
      </Route>
    </Routes>
  )
}
