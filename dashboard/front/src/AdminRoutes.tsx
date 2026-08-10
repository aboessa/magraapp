import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { TeamAccessPage } from './pages/TeamAccessPage'
import { hasAdminSession, verifySession } from './lib/adminSession'
import { AdvancedFinancePage } from './pages/AdvancedFinancePage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { AuditLogPage } from './pages/AuditLogPage'
import { AppExperiencePage } from './pages/AppExperiencePage'
import { BillingPage } from './pages/BillingPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { CharactersPage } from './pages/CharactersPage'
import { ChildrenPage } from './pages/ChildrenPage'
import { CustomersPage } from './pages/CustomersPage'
import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { ContentReviewsPage } from './pages/ContentReviewsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DevicesAdminPage } from './pages/DevicesAdminPage'
import { EpisodesPage } from './pages/EpisodesPage'
import { FailedEventsPage } from './pages/FailedEventsPage'
import { GameDetailPage } from './pages/GameDetailPage'
import { GamesOpsPage } from './pages/GamesOpsPage'
import { AudioProductionQueuePage } from './pages/AudioProductionQueuePage'
import { ArtProductionQueuePage } from './pages/ArtProductionQueuePage'
import { LearningObjectivesPage } from './pages/LearningObjectivesPage'
import { LibraryContentPage } from './pages/LibraryContentPage'
import { MasteryPage } from './pages/MasteryPage'
import { MediaLibraryPage } from './pages/MediaLibraryPage'
import { MyTasksPage } from './pages/MyTasksPage'
import { NarrationPage } from './pages/NarrationPage'
import { OpsPage } from './pages/OpsPage'
import { OpsSlaPage } from './pages/OpsSlaPage'
import { PackagesPage } from './pages/PackagesPage'
import { ParentsPage } from './pages/ParentsPage'
import { QualityPage } from './pages/QualityPage'
import { QuizBuilderPage } from './pages/QuizBuilderPage'
import { RecommendationsPage } from './pages/RecommendationsPage'
import { RemoteConfigPage } from './pages/RemoteConfigPage'
import { RevenuePage } from './pages/RevenuePage'
import { PartnershipsPage } from './pages/PartnershipsPage'
import { PlanetsPage } from './pages/PlanetsPage'
import { ProductionPage } from './pages/ProductionPage'
import { PlanetDetailPage } from './pages/PlanetDetailPage'
import { SeriesDetailPage } from './pages/SeriesDetailPage'
import { EpisodeDetailPage } from './pages/EpisodeDetailPage'
import { SeasonDetailPage } from './pages/SeasonDetailPage'
import { CharacterDetailPage } from './pages/CharacterDetailPage'
import { LibraryContentDetailPage } from './pages/LibraryContentDetailPage'
import { AssetDetailPage } from './pages/AssetDetailPage'
import { RightsPage } from './pages/RightsPage'
import { RolesPage } from './pages/RolesPage'
import { SchoolAccountsPage } from './pages/SchoolAccountsPage'
import { SeasonsPage } from './pages/SeasonsPage'
import { SeriesPage } from './pages/SeriesPage'
import { SkillsPage } from './pages/SkillsPage'
import { StoriesPage } from './pages/StoriesPage'
import { SupportCenterPage } from './pages/SupportCenterPage'
import { TaxonomyPage } from './pages/TaxonomyPage'
import { TeamsPage } from './pages/TeamsPage'
import { TranslationCenterPage } from './pages/TranslationCenterPage'
import { VisualStylesPage } from './pages/VisualStylesPage'
import { WorkflowPage } from './pages/WorkflowPage'
import { WebsitePagesPage } from './pages/WebsitePagesPage'
import { WebsitePageEditor } from './pages/WebsitePageEditor'
import { BlogPostsPage } from './pages/BlogPostsPage'
import { BlogPostEditor } from './pages/BlogPostEditor'
import { BlogTaxonomyPage } from './pages/BlogTaxonomyPage'
import { SeoOperationsPage } from './pages/SeoOperationsPage'
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
        <Route path="planets/:id" element={<PlanetDetailPage />} />
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
        <Route path="stories/:id" element={<StoriesPage />} />
        <Route path="library-content" element={<LibraryContentPage />} />
        <Route path="library-content/:kind/:id" element={<LibraryContentDetailPage />} />
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
