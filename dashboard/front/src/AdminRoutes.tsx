import { Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { AdvancedFinancePage } from './pages/AdvancedFinancePage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { AppExperiencePage } from './pages/AppExperiencePage'
import { BillingPage } from './pages/BillingPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { CharactersPage } from './pages/CharactersPage'
import { ChildrenPage } from './pages/ChildrenPage'
import { DashboardPage } from './pages/DashboardPage'
import { DevicesAdminPage } from './pages/DevicesAdminPage'
import { EpisodesPage } from './pages/EpisodesPage'
import { LibraryContentPage } from './pages/LibraryContentPage'
import { MediaLibraryPage } from './pages/MediaLibraryPage'
import { MyTasksPage } from './pages/MyTasksPage'
import { OpsPage } from './pages/OpsPage'
import { OpsSlaPage } from './pages/OpsSlaPage'
import { PackagesPage } from './pages/PackagesPage'
import { ParentsPage } from './pages/ParentsPage'
import { QuizBuilderPage } from './pages/QuizBuilderPage'
import { RecommendationsPage } from './pages/RecommendationsPage'
import { RemoteConfigPage } from './pages/RemoteConfigPage'
import { RevenuePage } from './pages/RevenuePage'
import { RightsPage } from './pages/RightsPage'
import { RolesPage } from './pages/RolesPage'
import { SchoolAccountsPage } from './pages/SchoolAccountsPage'
import { SeasonsPage } from './pages/SeasonsPage'
import { SeriesPage } from './pages/SeriesPage'
import { StoriesPage } from './pages/StoriesPage'
import { SupportCenterPage } from './pages/SupportCenterPage'
import { TaxonomyPage } from './pages/TaxonomyPage'
import { TeamsPage } from './pages/TeamsPage'
import { TranslationCenterPage } from './pages/TranslationCenterPage'
import { VisualStylesPage } from './pages/VisualStylesPage'
import { WorkflowPage } from './pages/WorkflowPage'
import './styles/dashboard.css'

/**
 * كل مسارات لوحة الإدارة في وحدة واحدة تُحمّل عند الطلب فقط،
 * حتى لا تحمل صفحة الهبوط العامة حزمة اللوحة كاملة.
 */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="taxonomy" element={<TaxonomyPage />} />
        <Route path="series" element={<SeriesPage />} />
        <Route path="seasons" element={<SeasonsPage />} />
        <Route path="episodes" element={<EpisodesPage />} />
        <Route path="characters" element={<CharactersPage />} />
        <Route path="stories" element={<StoriesPage />} />
        <Route path="library-content" element={<LibraryContentPage />} />
        <Route path="media" element={<MediaLibraryPage />} />
        <Route path="visual-styles" element={<VisualStylesPage />} />
        <Route path="parents" element={<ParentsPage />} />
        <Route path="children" element={<ChildrenPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="tasks" element={<MyTasksPage />} />
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
      </Route>
    </Routes>
  )
}
