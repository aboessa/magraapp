import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, envelope } from './harness'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { ProductionPage } from '../pages/ProductionPage'
import { WorkflowPage } from '../pages/WorkflowPage'
import { MediaLibraryPage } from '../pages/MediaLibraryPage'
import { StoriesPage } from '../pages/StoriesPage'
import { MasteryPage } from '../pages/MasteryPage'
import { QualityPage } from '../pages/QualityPage'
import { ChildrenPage } from '../pages/ChildrenPage'
import { SeasonsPage } from '../pages/SeasonsPage'

/**
 * اختبارات حالة القوائم في العنوان للدفعة الثانية من الشاشات الثماني.
 *
 * ## ما تحرسه هذه الاختبارات
 *
 * ١. **الرابط المفلتر يصل إلى الخادم بأسماء معاملاته.** التأكيد على **وسائط
 *    النداء المسجَّلة** لا على ما ظهر في الجدول: جدولٌ مطابق بالحظّ يُخفي أن
 *    الفلتر لم يُرسَل، أو أنه أُرسل باسم لا يعرفه المعالِج فأُهمل بصمت. أسماء
 *    المعاملات في كل تأكيد أدناه مقروءة من معالِج المسار نفسه، والمعالِج مذكور
 *    في تعليق كل مجموعة.
 *
 * ٢. **المُطبَّق مرئي وقابل للإزالة وحده.** فلترة نشطة بلا شريحة تعني «لا نتائج»
 *    على مجموعة فيها نتائج بلا دليل في الشاشة على السبب، وشريحة تُسقط غيرها معها
 *    تعني فقدان فلتر لم يطلب أحد إسقاطه.
 *
 * ٣. **تغيير الفلتر يُعيد إلى الصفحة الأولى.** حيث تُرقِّم الشاشة على الخادم
 *    يُقاس ذلك على `offset` المُرسَل؛ وحيث لا ترقيم (القصص، المواسم، الأطفال)
 *    يُقاس على العنوان نفسه، فلا يبقى `offset` عالقًا فيه ليُرسَل لاحقًا.
 *
 * ٤. **طريقة العرض في العنوان.** مركز الإنتاج ومركز سير العمل والإتقان تُقرأ في
 *    اجتماع: «انظر عمود المتوقّف في كانبان القصص» يجب أن يكون رابطًا لا وصفًا.
 */

const lastArgs = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls[spy.mock.calls.length - 1]?.[0] as Record<string, unknown>

const lastCall = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls[spy.mock.calls.length - 1] ?? []

/// مِجَسّ العنوان: بعض الشاشات لا تُرقِّم على الخادم، فالدليل الوحيد على تصفير
/// الترقيم هو العنوان نفسه.
function UrlProbe() {
  const location = useLocation()
  return <output data-testid="probe">{location.search}</output>
}

const probe = () => screen.getByTestId('probe').textContent ?? ''

/// شرائح الفلاتر المُطبَّقة وحدها، فلا يلتبس نصّها بنصّ في جدول الصفحة.
const chips = () => screen.getByLabelText('فلاتر مُطبَّقة')

async function openFilterDrawer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /فلاتر/ }))
  return screen.getByRole('dialog', { name: 'فلاتر متقدّمة' })
}

// jsdom لا يوفّر IntersectionObserver، ومعاينة الأصل في مكتبة الوسائط تُركِّب
// واحدًا. مُراقب لا يفعل شيئًا يجعل المعاينة تبقى على أيقونتها، وهو ما نريده:
// الاختبار عن الفلترة لا عن التحميل المتأخّر للصور.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}
window.IntersectionObserver = NoopObserver as unknown as typeof IntersectionObserver

const requirementRow = (overrides: Record<string, unknown> = {}) => ({
  key: 'video', label_ar: 'الفيديو', state: 'missing', detail: 'لا ملف رئيسي',
  percent: null, owner_role: 'production', items: [], depends_on: [],
  assignee_id: null, due_at: null, blocker: null, note: null,
  ...overrides,
})

const productionItem = (overrides: Record<string, unknown> = {}) => ({
  content_type: 'episode', content_id: 'ep-1', title: 'الحلقة الأولى', status: 'production',
  requirements: [requirementRow()],
  summary: {
    total: 1, ready: 0, partial: 0, in_progress: 0, missing: 1, blocked: 0,
    not_applicable: 0, percent: 0, publish_state: 'missing',
  },
  ...overrides,
})

const assetRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'asset-1', title_ar: 'غلاف لونا', kind: 'image', status: 'ready', visibility: 'private',
  expected_path: 'assets/images/luna.png', original_filename: 'luna.png', size_bytes: 2048,
  quality: 'ok', metadata: {}, expected_width: null, expected_height: null, links_count: 2,
  language: null,
  ...overrides,
})

const assetStats = {
  by_status: [{ status: 'ready', count: 4 }],
  by_kind: [{ kind: 'image', count: 4 }],
  storage: { total_bytes: 4096 },
}

const storyRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'st-1', title_ar: 'حكاية القمر', slug: 'moon-tale', type: 'comic', series_id: 's1',
  series_title: 'لونا', languages: ['ar'], pages_count: 5, status: 'draft',
  age_min: 6, age_max: 8, visual_style_id: null, visual_style_name: null,
  default_language: 'ar', description_ar: null, cover_asset_id: null,
  ...overrides,
})

const seriesRow = (id: string, title: string) => ({
  id, slug: id, title_ar: title, title_en: title, planet_id: 'p1', planet_name: 'أبجد', planet_color: '#fff',
  type: 'continuous', track_ids: ['kids'], production_level: 'limited_2d', status: 'published',
  episodes_count: 3, cover_url: null, visual_style: null, visual_style_id: null, description_ar: null,
})

const objectiveRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'obj-1', code: 'AR-1', title_ar: 'الحروف', skill_id: 'sk-1', skill_name: 'القراءة',
  children_count: 3, independent_count: 1, needs_review_count: 2, not_started_count: 0,
  attempts: 10, correct_attempts: 6, success_rate: 60, last_attempt_at: '2026-08-01T10:00:00.000Z',
  ...overrides,
})

const masteryChildRow = (overrides: Record<string, unknown> = {}) => ({
  child_id: 'ch-1', nickname: 'سارة', age_track: 'kids', parent_id: 'fam-1',
  objectives_count: 4, independent_count: 2, needs_review_count: 1,
  attempts: 8, correct_attempts: 5, success_rate: 63, last_attempt_at: null,
  ...overrides,
})

const attemptRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'att-1', child_id: 'ch-1', nickname: 'سارة', episode_id: 'ep-1', game_id: null,
  episode_title: 'الحلقة الأولى', game_title: null, score: 8, max_score: 10, score_percent: 80,
  time_spent_seconds: 120, help_used: 0, created_at: '2026-08-01T10:00:00.000Z',
  ...overrides,
})

const qualityFinding = (overrides: Record<string, unknown> = {}) => ({
  id: 'page_images', label_ar: 'صور الصفحات', status: 'blocked', severity: 'blocker',
  detail: 'الصفحة ٣ بلا صورة', owner: 'production', required_action: 'إضافة صورة', items: ['page-3'],
  ...overrides,
})

const qualityReport = (overrides: Record<string, unknown> = {}) => {
  const finding = qualityFinding()
  return {
    entity_type: 'story', entity_id: 'st-1', publishable: false,
    findings: [finding], blockers: [finding], warnings: [],
    ...overrides,
  }
}

const childRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'ch-1', nickname: 'سارة', avatar_id: 'av-1', parent_id: 'fam-1', parent_name: 'أبو سارة',
  parent_email: 'p@example.com', birth_month: 5, birth_year: 2018, age_track: 'kids',
  interests: '["القراءة"]', status: 'active',
  ...overrides,
})

const seasonRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'se-1', series_id: 's1', series_title: 'لونا', season_number: 1, title_ar: 'الموسم الأول',
  theme_ar: 'الحروف', description_ar: null, watch_order: 'any', status: 'draft',
  episodes_count: 4, learning_goals: [],
  ...overrides,
})

const workflowRun = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1', content_type: 'episode', content_id: 'ep-1', template_id: 'tpl-1',
  current_step: 'review_edu', status: 'running', reviews_count: 0,
  created_at: '2026-08-01T10:00:00.000Z', updated_at: '2026-08-01T10:00:00.000Z',
  ...overrides,
})

const myStage = (overrides: Record<string, unknown> = {}) => ({
  run_id: 'run-1', content_type: 'episode', content_id: 'ep-1', stage_key: 'review_lang',
  status: 'in_progress', due_at: '2026-08-05T10:00:00.000Z', name_ar: 'المراجعة اللغوية',
  blocks_publish: 1,
  ...overrides,
})

const overdueStage = (overrides: Record<string, unknown> = {}) => ({
  run_id: 'run-1', content_type: 'episode', content_id: 'ep-1', stage_key: 'review_edu',
  status: 'in_progress', due_at: '2026-07-01T10:00:00.000Z', name_ar: 'المراجعة التربوية',
  hours_late: 12.5, escalated: true,
  ...overrides,
})

beforeEach(() => { vi.restoreAllMocks(); window.localStorage.clear() })

// --- مركز الإنتاج ----------------------------------------------------------
//
// أسماء المعاملات من `GET /admin/production/board` في
// `api/src/routes/adminProduction.ts`: `type`, `status`, `series_id`,
// `with_publish`, `limit`, `offset`. الشاشة تُرسل `type` و`with_publish`
// والترقيم؛ `status` و`series_id` لا تعرضهما فلا تُرسلهما.

describe('ProductionPage', () => {
  const mockBoard = (total = 1) => {
    const board = vi.spyOn(api, 'productionBoard')
      .mockResolvedValue({ success: true, data: [productionItem()], meta: { total, limit: 25, offset: 0, board_limit: 40 } } as never)
    const queue = vi.spyOn(api, 'productionQueue').mockResolvedValue(envelope([], 0) as never)
    return { board, queue }
  }

  test('a pre-filtered link sends type, with_publish and the page to GET /admin/production/board', async () => {
    const { board } = mockBoard()
    renderWithProviders(<ProductionPage />, { route: `${adminPath('production')}?type=story&with_publish=0&offset=25` })

    await waitFor(() => expect(board).toHaveBeenCalled())
    expect(board).toHaveBeenCalledWith({ type: 'story', with_publish: '0', limit: 25, offset: 25 })
  })

  test('the applied type shows as a chip that drops only itself', async () => {
    const { board } = mockBoard()
    const user = userEvent.setup()
    renderWithProviders(<ProductionPage />, { route: `${adminPath('production')}?type=story&with_publish=0` })

    expect(await screen.findByText('النوع: القصص')).toBeInTheDocument()
    await user.click(within(chips()).getByRole('button', { name: 'إزالة الفلتر: النوع' }))

    // الإزالة تُعيد النوع إلى افتراضه ولا تلمس تقييم البوابة.
    await waitFor(() => expect(lastArgs(board).type).toBe('episode'))
    expect(lastArgs(board).with_publish).toBe('0')
  })

  test('changing a filter returns to the first page', async () => {
    const { board } = mockBoard(400)
    const user = userEvent.setup()
    renderWithProviders(<ProductionPage />, { route: `${adminPath('production')}?type=story&offset=40` })
    await waitFor(() => expect(lastArgs(board).offset).toBe(40))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('النوع'), 'episode')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(lastArgs(board).type).toBe('episode'))
    // الصفحة الثالثة من مجموعة أخرى تُعرض «لا عناصر» على مجموعة فيها عناصر.
    expect(lastArgs(board).offset).toBe(0)
  })

  test('the view is read from the URL: ?view=queue asks for the queue, not the board', async () => {
    const { board, queue } = mockBoard()
    renderWithProviders(<ProductionPage />, { route: `${adminPath('production')}?view=queue` })

    await waitFor(() => expect(queue).toHaveBeenCalled())
    // لو كانت طريقة العرض في الذاكرة لفتح الرابط الجدول ونادى المسار الآخر.
    expect(board).not.toHaveBeenCalled()
  })

  test('the view is written to the URL, so the link opens what was shared', async () => {
    mockBoard()
    const user = userEvent.setup()
    renderWithProviders(<><ProductionPage /><UrlProbe /></>, { route: adminPath('production') })

    await waitFor(() => expect(probe()).toBe(''))
    await user.click(screen.getByRole('tab', { name: 'كانبان' }))

    await waitFor(() => expect(probe()).toContain('view=kanban'))
  })
})

// --- مركز سير العمل --------------------------------------------------------
//
// `GET /admin/workflows/runs` (في `api/src/routes/adminTeams.ts`) لا يقبل إلا
// `limit` و`offset`، و`api.workflowRuns()` لا يمرّر أيًّا منهما؛
// و`GET /admin/workflows/my-stages` و`GET /admin/workflows/overdue` (في
// `api/src/routes/adminWorkflow.ts`) لا يقبلان معاملًا واحدًا. فلا فلتر يُرسَل
// من هذه الشاشة، والمحفوظ في العنوان هو التبويب — والحدّ مُعلَن في الشاشة.

describe('WorkflowPage', () => {
  const mockWorkflow = () => {
    const runs = vi.spyOn(api, 'workflowRuns').mockResolvedValue(envelope([workflowRun()], 1) as never)
    vi.spyOn(api, 'workflowTemplates').mockResolvedValue(envelope([{ id: 'tpl-1', name_ar: 'مسار الحلقة', content_type: 'episode', stages: [] }]) as never)
    vi.spyOn(api, 'workflowMyStages').mockResolvedValue(envelope([myStage()], 1) as never)
    vi.spyOn(api, 'workflowOverdue').mockResolvedValue(envelope([overdueStage()], 1) as never)
    return runs
  }

  test('the tab is read from the URL: ?view=overdue lands on the overdue stages', async () => {
    mockWorkflow()
    renderWithProviders(<WorkflowPage />, { route: `${adminPath('workflows')}?view=overdue` })

    // المرحلة المتأخّرة وحدها تحمل ساعات التأخّر، فظهورها يعني أن التبويب المفتوح
    // هو المتأخّر لا التشغيلات.
    expect(await screen.findByText(/12.5 ساعة تأخّر/)).toBeInTheDocument()
    expect(screen.queryByText('المرحلة الحالية')).not.toBeInTheDocument()
  })

  test('the tab is written to the URL, and only the tab', async () => {
    mockWorkflow()
    const user = userEvent.setup()
    renderWithProviders(<><WorkflowPage /><UrlProbe /></>, { route: adminPath('workflows') })

    await screen.findByRole('tab', { name: 'نظرة عامة' })
    await user.click(screen.getByRole('tab', { name: /مهامي/ }))

    await waitFor(() => expect(probe()).toBe('?view=mine'))
    expect(await screen.findByText('المراجعة اللغوية · حاجبة للنشر')).toBeInTheDocument()
  })

  test('the runs list is paged on the server, and says filtering is what it lacks', async () => {
    const runs = mockWorkflow()
    const user = userEvent.setup()
    renderWithProviders(<WorkflowPage />, { route: `${adminPath('workflows')}?offset=25` })

    // الترقيم يُرسَل الآن. كان العميل لا يمرّر شيئًا فيتعذّر الوصول لما بعد الصفحة
    // الأولى من جدول ينمو بلا حدّ.
    await waitFor(() => expect(runs.mock.calls.at(-1)![0]).toMatchObject({ offset: 25 }))
    expect(runs.mock.calls.at(-1)![0]!.limit).toBeGreaterThan(0)

    // الحدّ الباقي مُعلَن: المسار لا يقبل فلترة بحالة ولا بقالب.
    expect(await screen.findByText(/ولا يقبل فلترة بحالة ولا بقالب/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /المتأخّر/ }))
    await waitFor(() => expect(screen.queryByText(/GET \/admin\/workflows\/runs/)).not.toBeInTheDocument())
  })
})

// --- مكتبة الوسائط ---------------------------------------------------------
//
// أسماء المعاملات من `GET /admin/assets` في `api/src/routes/adminAssets.ts`:
// `q`, `status`, `kind`, `source`, `visibility`, `limit`, `offset`. الشاشة تُرسل
// `q` و`status` و`kind` والترقيم.

describe('MediaLibraryPage', () => {
  const mockAssets = (total = 1) => {
    const assets = vi.spyOn(api, 'assets').mockResolvedValue(envelope([assetRow()], total) as never)
    vi.spyOn(api, 'assetStats').mockResolvedValue(envelope(assetStats) as never)
    return assets
  }

  test('a pre-filtered link sends kind, status and the page to GET /admin/assets', async () => {
    const assets = mockAssets()
    renderWithProviders(<MediaLibraryPage />, { route: `${adminPath('media')}?kind=image&status=ready&offset=48` })

    await waitFor(() => expect(assets).toHaveBeenCalled())
    expect(assets).toHaveBeenCalledWith({ q: '', status: 'ready', kind: 'image', limit: 48, offset: 48 })
  })

  test('the applied kind shows as a chip that drops only itself', async () => {
    const assets = mockAssets()
    const user = userEvent.setup()
    renderWithProviders(<MediaLibraryPage />, { route: `${adminPath('media')}?kind=image&status=ready` })

    expect(await screen.findByText('النوع: image')).toBeInTheDocument()
    await user.click(within(chips()).getByRole('button', { name: 'إزالة الفلتر: النوع' }))

    await waitFor(() => expect(lastArgs(assets).kind).toBe(''))
    expect(lastArgs(assets).status).toBe('ready')
  })

  test('changing a filter returns to the first page', async () => {
    const assets = mockAssets(500)
    const user = userEvent.setup()
    renderWithProviders(<MediaLibraryPage />, { route: `${adminPath('media')}?status=ready&offset=96` })
    await waitFor(() => expect(lastArgs(assets).offset).toBe(96))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('النوع'), 'audio')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(lastArgs(assets).kind).toBe('audio'))
    expect(lastArgs(assets).offset).toBe(0)
  })
})

// --- القصص ----------------------------------------------------------------
//
// أسماء المعاملات من `GET /admin/stories` في `api/src/routes/adminContent.ts`:
// `q`, `status`, `type`, `series_id`, `limit`, `offset`. الشاشة تُرسل `q`
// و`type` وحدهما كما كانت، فلا ترقيم على الخادم هنا.

describe('StoriesPage', () => {
  const mockStories = () => {
    // المكتبة الجديدة `storyLibrary` تحلّ محلّ `stories` القديمة: نفس المعاملات
    // `q` و`type` تصل إلى الخادم عبرها، فالاختبار يُثبّت وصولها لا اسم الدالة.
    const libraryRow = {
      ...storyRow(),
      planet_id: 'qisas', planet_name: 'كوكب القصص', planet_color: '#FECA57',
      cover_url: null, pages_total: 5, pages_with_image: 5,
      coverage: [{ language: 'ar', declared: true, text_done: 5, narration_done: 5, timing_done: 0, total: 5 }],
      readiness: 'ready',
    }
    const stories = vi.spyOn(api, 'storyLibrary').mockResolvedValue({
      success: true, data: [libraryRow], meta: { total: 1, summary: { total: 1, ready: 1, partial: 0, empty: 0, published: 0, in_review: 0, missing_pages: 0, missing_artwork: 0, missing_cover: 0 }, notes: [] },
    } as never)
    vi.spyOn(api, 'series').mockResolvedValue(envelope([seriesRow('s1', 'لونا')]) as never)
    vi.spyOn(api, 'visualStyles').mockResolvedValue(envelope([]) as never)
    return stories
  }

  test('a pre-filtered link sends q and type to GET /admin/stories', async () => {
    const stories = mockStories()
    renderWithProviders(<StoriesPage />, { route: `${adminPath('stories')}?q=قمر&type=comic` })

    await waitFor(() => expect(stories).toHaveBeenCalled())
    expect(stories).toHaveBeenCalledWith(expect.objectContaining({ q: 'قمر', type: 'comic' }))
  })

  test('the applied type shows as a chip that drops only itself', async () => {
    const stories = mockStories()
    const user = userEvent.setup()
    renderWithProviders(<StoriesPage />, { route: `${adminPath('stories')}?q=قمر&type=comic` })

    expect(await within(chips()).findByText('النوع: كوميكس')).toBeInTheDocument()
    await user.click(within(chips()).getByRole('button', { name: 'إزالة الفلتر: النوع' }))

    // النوع وحده يسقط، والبحث النصّي يبقى. القيمة الفارغة لا تُرسل كمعامل
    // فارغ بل تُحذف — فالتحقق على الفقد لا على سلسلة فارغة.
    await waitFor(() => expect((lastArgs(stories) as Record<string, unknown>).type ?? '').toBe(''))
    expect((lastArgs(stories) as Record<string, unknown>).q).toBe('قمر')
  })

  test('changing a filter clears a stale offset from the URL', async () => {
    mockStories()
    const user = userEvent.setup()
    renderWithProviders(<><StoriesPage /><UrlProbe /></>, { route: `${adminPath('stories')}?type=comic&offset=40` })
    await waitFor(() => expect(probe()).toContain('offset=40'))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('النوع'), 'picture_book')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    // `offset` عالق في العنوان يُرسَل في اللحظة التي تُوصَل فيها هذه الشاشة
    // بالترقيم، فتُعرض صفحة فارغة على مجموعة فيها نتائج.
    await waitFor(() => expect(probe()).toContain('type=picture_book'))
    expect(probe()).not.toContain('offset')
  })
})

// --- الإتقان والمحاولات ----------------------------------------------------
//
// ثلاثة مسارات في `api/src/routes/adminMastery.ts`: `level` في
// `GET /admin/mastery/by-objective`، و`track` في `GET /admin/mastery/by-child`،
// و`child_id` في `GET /admin/attempts` — ولكلٍّ `limit` و`offset`.

describe('MasteryPage', () => {
  const mockMastery = (total = 1) => {
    const objectives = vi.spyOn(api, 'masteryByObjective').mockResolvedValue(envelope([objectiveRow()], total) as never)
    const children = vi.spyOn(api, 'masteryByChild').mockResolvedValue(envelope([masteryChildRow()], total) as never)
    const attempts = vi.spyOn(api, 'attempts').mockResolvedValue(envelope([attemptRow()], total) as never)
    return { objectives, children, attempts }
  }

  test('a pre-filtered link sends level to GET /admin/mastery/by-objective', async () => {
    const { objectives } = mockMastery()
    renderWithProviders(<MasteryPage />, { route: `${adminPath('mastery')}?level=needs_review` })

    await waitFor(() => expect(objectives).toHaveBeenCalled())
    expect(objectives).toHaveBeenCalledWith({ level: 'needs_review', limit: 50, offset: 0 })
  })

  test('the tab in the URL selects the route that answers it', async () => {
    const { objectives, children } = mockMastery()
    renderWithProviders(<MasteryPage />, { route: `${adminPath('mastery')}?view=children&track=kids&offset=50` })

    await waitFor(() => expect(children).toHaveBeenCalled())
    expect(children).toHaveBeenCalledWith({ track: 'kids', limit: 50, offset: 50 })
    // تبويب الأطفال لا يسأل مسار الأهداف: كل تبويب سؤال ومسار.
    expect(objectives).not.toHaveBeenCalled()
  })

  test('the applied level shows as a chip that removes only itself', async () => {
    const { objectives } = mockMastery()
    const user = userEvent.setup()
    renderWithProviders(<MasteryPage />, { route: `${adminPath('mastery')}?level=needs_review` })

    // الشاشة تُعيد حالة تحميل قبل أول صفّ، فيُنتظَر نصّ الشريحة لا يُستعلَم فورًا.
    expect(await screen.findByText('المستوى: يحتاج مراجعة')).toBeInTheDocument()
    await user.click(within(chips()).getByRole('button', { name: 'إزالة الفلتر: المستوى' }))

    await waitFor(() => expect(lastArgs(objectives).level ?? '').toBe(''))
  })

  test('changing a filter returns to the first page', async () => {
    const { children } = mockMastery(400)
    const user = userEvent.setup()
    renderWithProviders(<MasteryPage />, { route: `${adminPath('mastery')}?view=children&track=kids&offset=100` })
    await waitFor(() => expect(lastArgs(children).offset).toBe(100))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('المسار'), 'junior')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(lastArgs(children).track).toBe('junior'))
    // المؤشّر هو نفسه مؤشّر «تحميل المزيد»: بقاؤه يعني قائمة تبدأ من منتصف مجموعة أخرى.
    expect(lastArgs(children).offset).toBe(0)
  })

  test('the attempts tab sends child_id, which is the only filter that route accepts', async () => {
    const { attempts } = mockMastery()
    renderWithProviders(<MasteryPage />, { route: `${adminPath('mastery')}?view=attempts&child_id=ch-1` })

    await waitFor(() => expect(attempts).toHaveBeenCalled())
    expect(attempts).toHaveBeenCalledWith({ child_id: 'ch-1', limit: 50, offset: 0 })
  })
})

// --- فحص الجاهزية ----------------------------------------------------------
//
// `GET /admin/publish-readiness/:type/:id` لا يقبل أي معامل استعلام: `type`
// و`id` جزءا مسار. ولذلك هما ما يُحفظ في العنوان، فنتيجة الفحص تصير قابلة
// للمشاركة برابط بدل إعادة لصق المعرّف.

describe('QualityPage', () => {
  const mockReport = () => vi.spyOn(api, 'publishReadiness').mockResolvedValue(envelope(qualityReport()) as never)

  test('a link carrying the type and id runs that check without a second click', async () => {
    const report = mockReport()
    renderWithProviders(<QualityPage />, { route: `${adminPath('quality')}?type=story&id=st-1` })

    await waitFor(() => expect(report).toHaveBeenCalled())
    // وسائط مسار لا استعلام: الترتيب هو ما يبنيه `api.publishReadiness`.
    expect(lastCall(report)).toEqual(['story', 'st-1'])
    expect(await screen.findByText('الصفحة ٣ بلا صورة')).toBeInTheDocument()
  })

  test('the id chip drops only itself and clears the verdict with it', async () => {
    const report = mockReport()
    const user = userEvent.setup()
    renderWithProviders(<QualityPage />, { route: `${adminPath('quality')}?type=book&id=st-1` })

    expect(await within(chips()).findByText('المعرّف: st-1')).toBeInTheDocument()
    await user.click(within(chips()).getByRole('button', { name: 'إزالة الفلتر: المعرّف' }))

    // النتيجة تُخلى: حكم جاهزية معروض بلا المعرّف الذي أنتجه يُقرأ على الكيان الخطأ.
    await waitFor(() => expect(screen.queryByText('الصفحة ٣ بلا صورة')).not.toBeInTheDocument())
    expect(within(chips()).getByText('النوع: كتاب')).toBeInTheDocument()
    expect(report).toHaveBeenCalledTimes(1)
  })

  test('changing the type re-checks the same id against the other gate', async () => {
    const report = mockReport()
    const user = userEvent.setup()
    renderWithProviders(<QualityPage />, { route: `${adminPath('quality')}?id=st-1` })
    await waitFor(() => expect(lastCall(report)).toEqual(['story', 'st-1']))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('النوع'), 'book')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(lastCall(report)).toEqual(['book', 'st-1']))
  })
})

// --- ملفات الأطفال --------------------------------------------------------
//
// أسماء المعاملات من `GET /admin/children` في
// `api/src/routes/adminFamilyProjection.ts`: `q`, `track`, `parent_id`,
// `status`, `limit`, `offset`. الشاشة تُرسل `q` و`track` و`status` والترقيم.

describe('ChildrenPage', () => {
  const mockChildren = () =>
    vi.spyOn(api, 'children').mockResolvedValue(envelope([childRow()], 1) as never)

  test('a pre-filtered link sends track to GET /admin/children', async () => {
    const children = mockChildren()
    renderWithProviders(<ChildrenPage />, { route: `${adminPath('children')}?track=kids` })

    await waitFor(() => expect(children).toHaveBeenCalled())
    expect(children).toHaveBeenCalledWith({ q: '', track: 'kids', status: undefined, limit: 25, offset: 0 })
  })

  test('the applied track shows as a chip that drops only itself', async () => {
    const children = mockChildren()
    const user = userEvent.setup()
    renderWithProviders(<ChildrenPage />, { route: `${adminPath('children')}?track=kids&q=سارة` })

    expect(await within(chips()).findByText('المسار المحسوب: المستكشفون 6–8')).toBeInTheDocument()
    await user.click(within(chips()).getByRole('button', { name: 'إزالة الفلتر: المسار المحسوب' }))

    await waitFor(() => expect(lastArgs(children).track).toBeUndefined())
    expect(lastArgs(children).q).toBe('سارة')
  })

  test('changing a filter clears a stale offset from the URL', async () => {
    mockChildren()
    const user = userEvent.setup()
    renderWithProviders(<><ChildrenPage /><UrlProbe /></>, { route: `${adminPath('children')}?track=kids&offset=100` })
    await waitFor(() => expect(probe()).toContain('offset=100'))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('المسار المحسوب'), 'junior')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(probe()).toContain('track=junior'))
    expect(probe()).not.toContain('offset')
  })
})

// --- المواسم --------------------------------------------------------------
//
// `GET /admin/seasons` في `api/src/routes/adminContent.ts` يقبل `series_id`
// و`limit` و`offset`، و`api.seasons` يمرّرها كلها الآن — كان يمرّر معرّف السلسلة
// وحده كوسيط موضعي، فما بعد صفحة الخادم الافتراضية لم يكن قابلًا للوصول.

describe('SeasonsPage', () => {
  const mockSeasons = () => {
    const seasons = vi.spyOn(api, 'seasons').mockResolvedValue(envelope([seasonRow()], 1) as never)
    vi.spyOn(api, 'series').mockResolvedValue(envelope([seriesRow('s1', 'لونا'), seriesRow('s2', 'رحلة')]) as never)
    return seasons
  }

  test('a pre-filtered link sends series_id and the page to GET /admin/seasons', async () => {
    const seasons = mockSeasons()
    renderWithProviders(<SeasonsPage />, { route: `${adminPath('seasons')}?series_id=s1` })

    await waitFor(() => expect(seasons).toHaveBeenCalled())
    expect(seasons.mock.calls.at(-1)![0]).toMatchObject({ series_id: 's1', offset: 0 })
    expect(seasons.mock.calls.at(-1)![0]!.limit).toBeGreaterThan(0)
  })

  test('the applied series shows as a chip, and removing it asks for no series at all', async () => {
    const seasons = mockSeasons()
    const user = userEvent.setup()
    renderWithProviders(<SeasonsPage />, { route: `${adminPath('seasons')}?series_id=s1` })

    expect(await within(chips()).findByText('السلسلة: لونا')).toBeInTheDocument()
    await user.click(within(chips()).getByRole('button', { name: 'إزالة الفلتر: السلسلة' }))

    // بلا سلسلة لا يُرسَل المعامل، ولا يُرسَل فارغًا.
    await waitFor(() => expect(seasons.mock.calls.at(-1)![0]!.series_id).toBeUndefined())
  })

  test('changing the series clears a stale offset from the URL', async () => {
    mockSeasons()
    const user = userEvent.setup()
    renderWithProviders(<><SeasonsPage /><UrlProbe /></>, { route: `${adminPath('seasons')}?series_id=s1&offset=25` })
    await waitFor(() => expect(probe()).toContain('offset=25'))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('السلسلة'), 's2')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(probe()).toContain('series_id=s2'))
    expect(probe()).not.toContain('offset')
  })
})
