import { describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanetsPage } from '../pages/PlanetsPage'
import { PlanetWorkspacePage } from '../pages/PlanetWorkspacePage'
import { PlanetEditorDrawer } from '../components/PlanetEditorDrawer'
import { api, ApiError } from '../lib/api'
import { renderWithProviders } from './harness'
import type { PlanetHealth, PlanetListRow, PlanetWorkspace } from '../types/api'

/**
 * اختبارات فهرس الكواكب ومساحة عملها.
 *
 * ## ما تُثبِّته هذه الاختبارات
 *
 * ١. **الفلاتر والترتيب معاملات خادم لا فلترة في المتصفح.** الصفحة القديمة كانت
 *    تفلتر `items.filter(...)` محليًا، فرابط مفلتر لا يفتح شيئًا. التوكيدات هنا
 *    على وسائط النداء المُسجَّلة لا على ما ظهر فقط.
 * ٢. **حالة الشاشة في العنوان**: التبويب وطريقة العرض والفلتر، فرابط «تبويب
 *    الإنتاج» يُشارَك وزرّ الرجوع يعمل.
 * ٣. **الملخّص يصف المجموعة كلها** لا المفلترة: ملخّص يتغيّر بالفلترة لا يمكن أن
 *    يُستعمل لاختيار الفلترة.
 * ٤. **«غير متاح» ليس صفرًا**: وحدة تعذّرت قراءتها تقول ذلك، والتحليلات معلَنة
 *    غير متاحة دائمًا لأن جداول النشاط في D1 بلا كاتب.
 * ٥. **كل عنصر في «ما يحتاج إلى انتباه» له وجهة**، والوجهة رابط حقيقي.
 * ٦. **الصلاحيات تُعطِّل الأزرار وتشرح السبب** بدل إخفائها بلا تفسير.
 */

const health = (over: Partial<PlanetHealth> = {}): PlanetHealth => ({
  series_total: 3, series_published: 1, series_pipeline: 2, seasons_total: 2,
  episodes_total: 12, episodes_published: 4, episodes_ready_unpublished: 1,
  stories_total: 5, books_total: 0, games_total: 2, projects_total: 0,
  characters_total: 4, artwork_icon: true, artwork_cover: true, has_description: true,
  production_blockers: 0, reviews_pending: 0, series_with_english_title: 2,
  content_updated_at: '2026-08-01 10:00:00',
  ...over,
})

const planetRow = (over: Partial<PlanetListRow> = {}): PlanetListRow => ({
  id: 'qisas', name_ar: 'كوكب القصص', name_en: 'Stories', description_ar: 'حكايات مصوّرة',
  color_hex: '#FECA57', icon_url: null, cover_url: null, sort_order: 5, is_active: true,
  series_count: 3, assets_count: 2, health: health(),
  ...over,
})

const collection = (rows: PlanetListRow[], summaryOver = {}) => ({
  success: true,
  data: rows,
  meta: {
    total: rows.length,
    summary: {
      total: rows.length, active: rows.length, inactive: 0,
      with_published_content: 1, without_published_content: rows.length - 1,
      empty: 0, missing_artwork: 1, missing_description: 1, with_production_blockers: 1,
      ...summaryOver,
    },
    notes: [],
  },
})

const workspace = (over: Partial<PlanetWorkspace> = {}): PlanetWorkspace => ({
  planet: {
    id: 'qisas', name_ar: 'كوكب القصص', name_en: 'Stories', description_ar: 'حكايات مصوّرة',
    color_hex: '#FECA57', icon_url: null, cover_url: null, sort_order: 5, is_active: true,
    artwork_icon: true, artwork_cover: false,
  },
  content: {
    unavailable: null, series_total: 3, series_published: 1, series_pipeline: 2, series_early: 1,
    series_in_review: 1, series_in_production: 0, series_ready: 0, seasons_total: 2,
    episodes_total: 12, episodes_published: 4, episodes_ready_unpublished: 2, episodes_without_video: 3,
    stories_total: 5, stories_published: 2, games_total: 2, games_published: 0, books_total: 0,
    projects_total: 1, characters_total: 4, fixture_series: 1,
    unparented_stories: 7, unparented_games: 0, unparented_books: 0, unparented_projects: 0,
    content_updated_at: '2026-08-01 10:00:00',
  },
  media: {
    unavailable: null, assets: [], series_total: 3, series_without_poster: 2,
    episodes_total: 12, episodes_without_thumbnail: 5,
    expected_roles: { icon: ['icon'], cover: ['cover', 'banner'] }, cdn_configured: true,
  },
  localization: {
    unavailable: null, configured: ['ar', 'en', 'fr'],
    notes: ['الكتب بلا عمود لغة في المخطوطة.'],
    languages: [
      {
        language: 'ar',
        signals: [
          { key: 'series_metadata', label_ar: 'عنوان السلسلة', done: 3, total: 3, unavailable: null, note: 'حقل إلزامي (NOT NULL)' },
          { key: 'episode_dubs', label_ar: 'الصوت المُعلَن', done: 12, total: 12, unavailable: null, note: null },
          { key: 'story_text', label_ar: 'نصّ الصفحات', done: 40, total: 40, unavailable: null, note: null },
          { key: 'story_narration', label_ar: 'السرد', done: 30, total: 40, unavailable: null, note: null },
          { key: 'game_localizations', label_ar: 'ترجمة الألعاب', done: 2, total: 2, unavailable: null, note: null },
        ],
      },
      {
        language: 'fr',
        signals: [
          { key: 'series_metadata', label_ar: 'عنوان السلسلة', done: 0, total: 3, unavailable: 'لا عمود عنوان فرنسي في جدول السلاسل.', note: null },
          { key: 'episode_dubs', label_ar: 'الصوت المُعلَن', done: 0, total: 12, unavailable: null, note: null },
          { key: 'story_text', label_ar: 'نصّ الصفحات', done: 0, total: 40, unavailable: null, note: null },
          { key: 'story_narration', label_ar: 'السرد', done: 0, total: 40, unavailable: null, note: null },
          { key: 'game_localizations', label_ar: 'ترجمة الألعاب', done: 0, total: 2, unavailable: null, note: null },
        ],
      },
    ],
  },
  production: {
    unavailable: null, blocked: 2, past_due: 3, unowned: 4, tracked_items: 6,
    notes: ['لا نسبة اكتمال على مستوى الكوكب.'],
    items: [{
      content_type: 'episode', content_id: 'ep-1', requirement: 'video',
      blocker: 'انتظار المونتاج', due_at: '2026-07-01T00:00:00.000Z',
      title: 'الحلقة الأولى', series_id: 's1', series_title: 'حكايات', assignee_name: null, team_name: null,
    }],
  },
  learning: {
    unavailable: null, episodes_total: 12, episodes_with_objective: 8, games_total: 2,
    games_with_objective: 1, distinct_objectives: 5, objectives_catalogue: 40,
    notes: ['لا ربط بين الكوكب ومنهج أهداف.'],
    objectives: [{ id: 'lo-1', code: 'LO-1', title_ar: 'الحروف', age_min: 6, age_max: 8, skill_name: 'القراءة', episodes: 3, games: 1 }],
  },
  reviews: {
    unavailable: null, pending: 3, needs_changes: 1, approved: 5, rejected: 0,
    runs_running: 2, stages_overdue: 1, religious_pending: 0, religious_scoped: 0,
    notes: ['قيد content_reviews لا يقبل النوع story.'],
    items: [{
      id: 'cr-1', entity_type: 'series', entity_id: 's1', reviewer_role: 'edu',
      status: 'pending', created_at: '2026-08-01 09:00:00', title: 'حكايات',
    }],
  },
  rights: {
    unavailable: null, own_policy: null, inherits_from: 'global', global_policy: { mode: 'worldwide' },
    chain: ['episode', 'season', 'series', 'planet', 'global'],
    series_overrides: 1, episode_overrides: 0, withheld: 0, restricted: 1,
    licences: [{ id: 'rl-1', content_id: 's1', owner: 'مجرة', license_type: 'exclusive', expiry_date: '2020-01-01', title: 'حكايات' }],
    expired_licences: 1,
    notes: ['الإتاحة لا تتقاطع.'],
  },
  analytics: {
    unavailable: 'لا مقاييس مشاهدة لكوكب في D1: جداول النشاط بلا كاتب، وسلطتها FamilyState.',
    source: 'FamilyState',
  },
  attention: [
    {
      key: 'planet_artwork', label_ar: 'الكوكب بلا غلاف', label_en: 'Planet cover missing',
      count: 1, tone: 'warn', drill: '/planets/qisas?tab=media', note: 'الأدوار المتوقّعة: icon وcover.',
    },
    {
      key: 'production_blocked', label_ar: 'متطلبات إنتاج بعائق', label_en: 'Blocked requirements',
      count: 2, tone: 'danger', drill: '/planets/qisas?tab=production', note: null,
    },
    {
      key: 'episodes_ready_unpublished', label_ar: 'حلقات جاهزة ولم تُنشر', label_en: 'Ready, not published',
      count: 2, tone: 'warn', drill: '/episodes?status=ready', note: null,
    },
  ],
  activity: [{
    id: 'au-1', actor_id: 'u1', actor_name: 'محرِّر', action: 'update',
    entity_type: 'series', entity_id: 's1', created_at: '2026-08-01 09:30:00', title: 'حكايات',
  }],
  generated_at: '2026-08-11T02:00:00.000Z',
  ...over,
})

const lastCall = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls[spy.mock.calls.length - 1]?.[0]

function grantAll() {
  window.sessionStorage.setItem('majarra-admin-user', JSON.stringify({
    id: 'u-owner', email: 'owner@majarra.local', display_name: 'مالك',
    roles: ['owner'], permissions: [], must_change_password: false,
  }))
}

function grantNothing() {
  window.sessionStorage.setItem('majarra-admin-user', JSON.stringify({
    id: 'u-view', email: 'viewer@majarra.local', display_name: 'قارئ',
    roles: ['content_creator'], permissions: ['view'], must_change_password: false,
  }))
}

describe('PlanetsPage', () => {
  test('renders each planet with its real counters and artwork', async () => {
    grantAll()
    vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([
      planetRow({ cover_url: 'https://cdn.example.com/public/qisas.png' }),
    ]) as never)

    const { container } = renderWithProviders(<PlanetsPage />, { route: '/planets' })

    expect(await screen.findByRole('heading', { name: 'كوكب القصص' })).toBeInTheDocument()
    expect(screen.getByText('حكايات مصوّرة')).toBeInTheDocument()
    // العدّادات من `health` لا من طول مصفوفة
    expect(screen.getByText('١٢')).toBeInTheDocument()
    // الصورة الحقيقية تُعرض. `alt` فارغة بقصد: العنوان بجوارها يحمل الاسم، فبديل
    // مكرّر يقرأه القارئ مرتين.
    const image = container.querySelector('.planet-card__media img')
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/public/qisas.png')
    expect(image).toHaveAttribute('alt', '')
  })

  test('a planet with no artwork says so instead of showing a coloured rectangle', async () => {
    grantAll()
    vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([
      planetRow({ cover_url: null, icon_url: null, health: health({ artwork_icon: false, artwork_cover: false }) }),
    ]) as never)

    renderWithProviders(<PlanetsPage />, { route: '/planets' })

    await screen.findByRole('heading', { name: 'كوكب القصص' })
    expect(screen.getAllByText('صورة ناقصة').length).toBeGreaterThan(0)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  test('the whole card opens the workspace through one focusable link', async () => {
    grantAll()
    vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([planetRow()]) as never)

    renderWithProviders(<PlanetsPage />, { route: '/planets' })

    const link = await screen.findByRole('link', { name: 'كوكب القصص' })
    expect(link).toHaveAttribute('href', '/admin/planets/qisas')
    expect(link.className).toContain('planet-card__link')
  })

  test('a pre-filtered link sends the filter to the server, not to a client filter', async () => {
    grantAll()
    const spy = vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([planetRow()]) as never)

    renderWithProviders(<PlanetsPage />, { route: '/planets?artwork=missing&production=blocked&sort=content_desc' })

    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(lastCall(spy)).toMatchObject({
      artwork: 'missing', production: 'blocked', sort: 'content_desc', include_inactive: 1,
    })
    // الفلتر المُطبَّق يظهر كشريحة قابلة للإزالة
    expect(screen.getAllByRole('button', { name: /إزالة الفلتر/ }).length).toBeGreaterThan(0)
  })

  test('the summary counts every planet while the list shows the filtered subset', async () => {
    grantAll()
    vi.spyOn(api, 'planetsCollection').mockResolvedValue(
      collection([planetRow()], { total: 9, missing_artwork: 4 }) as never,
    )

    renderWithProviders(<PlanetsPage />, { route: '/planets?artwork=missing' })

    await screen.findByRole('heading', { name: 'كوكب القصص' })
    const summary = screen.getByLabelText('الفهرس')
    // ٩ كواكب في الملخّص مع صفّ واحد معروض
    expect(within(summary).getByText('٩')).toBeInTheDocument()
    expect(within(summary).getByText('٤')).toBeInTheDocument()
  })

  test('a summary metric applies the filter that reproduces it', async () => {
    grantAll()
    const spy = vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([planetRow()]) as never)
    const user = userEvent.setup()

    renderWithProviders(<PlanetsPage />, { route: '/planets' })
    await screen.findByRole('heading', { name: 'كوكب القصص' })

    const summary = screen.getByLabelText('الفهرس')
    await user.click(within(summary).getByRole('button', { name: /به عوائق إنتاج/ }))

    await waitFor(() => expect(lastCall(spy)).toMatchObject({ production: 'blocked' }))
  })

  test('switching to the table view is recorded in the URL and keeps the data', async () => {
    grantAll()
    vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([planetRow()]) as never)
    const user = userEvent.setup()

    renderWithProviders(<PlanetsPage />, { route: '/planets' })
    await screen.findByRole('heading', { name: 'كوكب القصص' })

    await user.click(screen.getByRole('button', { name: 'جدول' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    // مدير الأعمدة يظهر في عرض الجدول فقط
    expect(screen.getByRole('button', { name: /الأعمدة/ })).toBeInTheDocument()
  })

  test('an empty result set distinguishes "no planets" from "no match"', async () => {
    grantAll()
    vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([]) as never)

    const filtered = renderWithProviders(<PlanetsPage />, { route: '/planets?artwork=missing' })
    expect(await screen.findByText('لا كوكب يطابق هذه الفلترة')).toBeInTheDocument()
    filtered.unmount()

    renderWithProviders(<PlanetsPage />, { route: '/planets' })
    expect(await screen.findByText('لا توجد كواكب')).toBeInTheDocument()
  })

  test('a failed read offers a retry and never renders as an empty catalogue', async () => {
    grantAll()
    vi.spyOn(api, 'planetsCollection').mockRejectedValue(new ApiError('تعذّرت القراءة', 503))

    renderWithProviders(<PlanetsPage />, { route: '/planets' })

    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّرت القراءة')
    expect(screen.getByRole('button', { name: /إعادة المحاولة|retry/i })).toBeInTheDocument()
    expect(screen.queryByText('لا توجد كواكب')).not.toBeInTheDocument()
  })

  test('a permission refusal is stated, not shown as an empty list', async () => {
    grantNothing()
    vi.spyOn(api, 'planetsCollection').mockRejectedValue(new ApiError('لا تملك صلاحية «view»', 403))

    renderWithProviders(<PlanetsPage />, { route: '/planets' })

    expect(await screen.findByRole('alert')).toHaveTextContent('لا تملك صلاحية')
  })

  test('without the create permission the button is disabled and explains why', async () => {
    grantNothing()
    vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([planetRow()]) as never)

    renderWithProviders(<PlanetsPage />, { route: '/planets' })
    await screen.findByRole('heading', { name: 'كوكب القصص' })

    const create = screen.getByRole('button', { name: /إضافة كوكب/ })
    expect(create).toBeDisabled()
    expect(create).toHaveAttribute('title', 'إضافة كوكب تحتاج صلاحية الإنشاء.')
  })

  test('the card menu links to the filtered screens that resolve each concern', async () => {
    grantAll()
    vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([planetRow()]) as never)
    const user = userEvent.setup()

    renderWithProviders(<PlanetsPage />, { route: '/planets' })
    await screen.findByRole('heading', { name: 'كوكب القصص' })

    await user.click(screen.getByRole('button', { name: /إجراءات الكوكب/ }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /وسائط الكوكب/ }))
      .toHaveAttribute('href', '/admin/planets/qisas?tab=media')
    expect(within(menu).getByRole('menuitem', { name: /إنتاج الكوكب/ }))
      .toHaveAttribute('href', '/admin/planets/qisas?tab=production')
    expect(within(menu).getByRole('menuitem', { name: /إضافة سلسلة هنا/ }))
      .toHaveAttribute('href', '/admin/series?planet=qisas&new=1')
  })

  test('disabling a planet with content confirms with the impact the server reported', async () => {
    grantAll()
    vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([planetRow()]) as never)
    const archive = vi.spyOn(api, 'archivePlanet')
      .mockRejectedValueOnce(new ApiError('يحمل محتوى', 409, [], {
        id: 'qisas', requires_confirmation: true,
        impact: { series: 3, published_series: 1, episodes: 12, published_episodes: 4 },
      }))
      .mockResolvedValueOnce({ success: true, data: { id: 'qisas', is_active: false, impact: { series: 3, published_series: 1, episodes: 12, published_episodes: 4 } } } as never)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    renderWithProviders(<PlanetsPage />, { route: '/planets?view=table' })
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: /تعطيل الكوكب: كوكب القصص/ }))

    await waitFor(() => expect(archive).toHaveBeenCalledTimes(2))
    // النداء الثاني يحمل التأكيد، والرسالة تحمل أرقام الخادم
    expect(archive.mock.calls[1]).toEqual(['qisas', true])
    expect(confirm.mock.calls[0][0]).toContain('3')
    expect(confirm.mock.calls[0][0]).toContain('12')
  })

  test('English renders the English name and label set', async () => {
    grantAll()
    vi.spyOn(api, 'planetsCollection').mockResolvedValue(collection([planetRow()]) as never)

    renderWithProviders(<PlanetsPage />, { route: '/planets', locale: 'en' })

    expect(await screen.findByRole('heading', { name: 'Stories' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Planets', level: 2 })).toBeInTheDocument()
  })
})

describe('PlanetWorkspacePage', () => {
  const mountWorkspace = (route = '/planets/qisas', locale: 'ar' | 'en' = 'ar') =>
    renderWithProviders(<PlanetWorkspacePage />, { route, path: '/planets/:id', locale })

  test('the header states counts, the operational state and the identity colour', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mountWorkspace()

    expect(await screen.findByRole('heading', { name: 'كوكب القصص' })).toBeInTheDocument()
    expect(screen.getByTitle(/حالة تشغيل لا حالة نشر/)).toHaveTextContent('نشط')
    // اللون يظهر في الرأس وفي لوحة الهوية معًا؛ كلاهما مقصود.
    expect(screen.getAllByText('#FECA57').length).toBeGreaterThanOrEqual(1)
    // الرأس يحمل أعدادًا حقيقية للمحتوى لا اسمًا ولونًا فقط
    expect(screen.getByText('١٢ حلقة')).toBeInTheDocument()
    expect(screen.getByText('٣ السلاسل')).toBeInTheDocument()
  })

  test('the health strip exposes one cell per module and opens its tab', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    const user = userEvent.setup()

    mountWorkspace()
    const strip = await screen.findByLabelText('حالة الكوكب')
    expect(within(strip).getAllByRole('button')).toHaveLength(7)

    await user.click(within(strip).getByRole('button', { name: /الإنتاج/ }))
    expect(await screen.findByText('عوائق مُعلَنة')).toBeInTheDocument()
  })

  test('every attention item carries a count and a working destination', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mountWorkspace()

    const list = await screen.findByRole('list', { name: '' }).catch(() => null)
    expect(list ?? screen.getByText('الكوكب بلا غلاف')).toBeTruthy()
    // وجهة داخل الصفحة تصير تبويبًا، ووجهة خارجية تصير شاشة أخرى
    const links = screen.getAllByRole('link', { name: /فتح/ })
    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/admin/planets/qisas?tab=media')
    expect(hrefs).toContain('/admin/episodes?status=ready')
  })

  test('the tab lives in the URL so the view is shareable', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    vi.spyOn(api, 'planetTree').mockResolvedValue({
      success: true, data: [], meta: {
        series_limit: 60, episode_limit: 400, series_returned: 0, fixture_series: 0,
        episodes_returned: 0, episodes_total: 0, truncated: false, notes: [],
      },
    } as never)

    mountWorkspace('/planets/qisas?tab=content')

    // التبويب المطلوب في العنوان هو المفتوح، لا الأول
    expect(await screen.findByRole('tab', { name: /المحتوى/, selected: true })).toBeInTheDocument()
  })

  test('an unknown tab in the URL falls back to the overview instead of a blank panel', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mountWorkspace('/planets/qisas?tab=nonsense')

    expect(await screen.findByRole('tab', { name: /نظرة عامة/, selected: true })).toBeInTheDocument()
  })

  test('the content tree drills planet to series to season to episode', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    vi.spyOn(api, 'planetTree').mockResolvedValue({
      success: true,
      data: [{
        id: 's1', title_ar: 'حكايات', slug: 'hekayat', status: 'draft', type: 'anthology',
        age_min: 6, age_max: 8, sort_order: 1, updated_at: '2026-08-01 00:00:00',
        content_class: 'production', cover_url: null, seasons_count: 1, episodes_count: 2,
        episodes_published: 1, track_ids: ['kids'], loaded_episodes: 2,
        seasons: [{
          id: 'se1', series_id: 's1', season_number: 1, title_ar: 'الموسم الأول',
          status: 'draft', episodes_count: 1,
          episodes: [{
            id: 'ep1', series_id: 's1', season_id: 'se1', episode_number: 1, title_ar: 'الأولى',
            status: 'ready', is_published: true, updated_at: '2026-08-01 00:00:00',
            has_video: true, has_captions: false, has_thumbnail: true,
          }],
        }],
        unassigned_episodes: [{
          id: 'ep2', series_id: 's1', season_id: null, episode_number: 2, title_ar: 'الثانية',
          status: 'draft', is_published: false, updated_at: '2026-08-01 00:00:00',
          has_video: false, has_captions: false, has_thumbnail: false,
        }],
      }],
      meta: {
        series_limit: 60, episode_limit: 400, series_returned: 1, fixture_series: 0,
        episodes_returned: 2, episodes_total: 2, truncated: false, notes: [],
      },
    } as never)
    const user = userEvent.setup()

    mountWorkspace('/planets/qisas?tab=content')

    const tree = await screen.findByRole('tree')
    // عقد الشجرة روابط حقيقية لا أزرار تستدعي navigate: الشجرة يُتنقَّل فيها
    // كثيرًا، والرابط يتيح النقر الأوسط وفتح في تبويب جديد ونسخ العنوان.
    expect(within(tree).getByRole('link', { name: /حكايات/ }))
      .toHaveAttribute('href', '/admin/series/s1')
    // الموسم مطوي في البداية، ويُفتح بزرّ
    await user.click(within(tree).getAllByRole('button', { expanded: false })[0])
    expect(await screen.findByRole('link', { name: /الأولى/ }))
      .toHaveAttribute('href', '/admin/episodes/ep1')
    // الحلقة بلا موسم ليست مخفيّة. المجموعة نفسها ليست كيانًا يُفتح، فهي نصّ لا
    // رابط — لأن «حلقات بلا موسم» مجموعة اصطناعية لا صفّ في قاعدة البيانات.
    expect(within(tree).getByText('حلقات بلا موسم')).toBeInTheDocument()
    expect(within(tree).queryByRole('link', { name: 'حلقات بلا موسم' })).not.toBeInTheDocument()
    await user.click(within(tree).getAllByRole('button', { expanded: false })[0])
    expect(await screen.findByRole('link', { name: /الثانية/ }))
      .toHaveAttribute('href', '/admin/episodes/ep2')
  })

  test('a tree row carries the readiness signals the payload already knows', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    vi.spyOn(api, 'planetTree').mockResolvedValue({
      success: true,
      data: [{
        id: 's1', title_ar: 'حكايات', slug: 'hekayat', status: 'draft', type: 'anthology',
        age_min: 6, age_max: 8, sort_order: 1, updated_at: '2026-08-01 00:00:00',
        content_class: 'production', cover_url: null, seasons_count: 0, episodes_count: 1,
        episodes_published: 0, track_ids: ['kids'], loaded_episodes: 1,
        seasons: [],
        unassigned_episodes: [{
          id: 'ep2', series_id: 's1', season_id: null, episode_number: 2, title_ar: 'الثانية',
          status: 'draft', is_published: false, updated_at: '2026-08-01 00:00:00',
          dubs: 'ar,en', has_video: false, has_captions: false, has_thumbnail: false,
        }],
      }],
      meta: {
        series_limit: 60, episode_limit: 400, series_returned: 1, fixture_series: 0,
        episodes_returned: 1, episodes_total: 1, truncated: false, notes: [],
      },
    } as never)
    const user = userEvent.setup()

    mountWorkspace('/planets/qisas?tab=content')

    const tree = await screen.findByRole('tree')
    // السلسلة بلا غلاف تُعلن ذلك في صفّها
    expect(within(tree).getByText('بلا ملصق')).toBeInTheDocument()
    await user.click(within(tree).getAllByRole('button', { expanded: false })[0])

    // النقص يُعرض، والسليم لا يُزحم الصف بشريحة «تمّ»
    expect(await screen.findByText('بلا فيديو')).toBeInTheDocument()
    expect(screen.getByText('بلا صورة')).toBeInTheDocument()
    expect(screen.getByText('بلا تعليقات')).toBeInTheDocument()
    // اللغات المُعلَنة في العمود dubs تُقرأ من الصف
    expect(screen.getByText('AR · EN')).toBeInTheDocument()
  })

  test('analytics is an honest unavailable state naming its authority', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mountWorkspace('/planets/qisas?tab=analytics')

    const note = await screen.findByRole('note')
    expect(note).toHaveTextContent('FamilyState')
    expect(note).toHaveTextContent(/بلا كاتب/)
  })

  test('a module that could not be read says so instead of showing zeros', async () => {
    grantAll()
    const data = workspace()
    data.production = { ...data.production, unavailable: 'تعذّرت قراءة جدول متطلبات الإنتاج.' }
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data } as never)

    mountWorkspace('/planets/qisas?tab=production')

    expect(await screen.findByRole('note')).toHaveTextContent('تعذّرت قراءة جدول متطلبات الإنتاج.')
    expect(screen.queryByText('عوائق مُعلَنة')).not.toBeInTheDocument()
  })

  test('language coverage shows a denominator, and a missing column is not a zero', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mountWorkspace('/planets/qisas?tab=languages')

    expect(await screen.findByText('30/40')).toBeInTheDocument()
    // الفرنسية بلا عمود عنوان: «غير متاح» بسببه في الـtitle، لا 0/3
    const unavailable = screen.getAllByTitle(/لا عمود عنوان فرنسي/)
    expect(unavailable.length).toBeGreaterThan(0)
    expect(unavailable[0]).toHaveTextContent('غير متاح')
  })

  test('the production tab lists blocked requirements with owner and due date', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    vi.spyOn(api, 'productionBoard').mockResolvedValue({ success: true, data: [], meta: { total: 0, limit: 20, offset: 0 } } as never)

    mountWorkspace('/planets/qisas?tab=production')

    expect(await screen.findByText('انتظار المونتاج')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('الفيديو')).toBeInTheDocument()
    // المتطلب بلا مسؤول ولا فريق يُعلَن في صفّه، لا يُترك فارغًا
    expect(within(table).getByText('بلا مالك')).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: 'فتح' }))
      .toHaveAttribute('href', '/admin/episodes/ep-1')
  })

  test('the production board is requested for this planet only', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    const board = vi.spyOn(api, 'productionBoard').mockResolvedValue({ success: true, data: [], meta: { total: 0, limit: 20, offset: 0 } } as never)

    mountWorkspace('/planets/qisas?tab=production')

    await waitFor(() => expect(board).toHaveBeenCalled())
    expect(lastCall(board)).toMatchObject({ planet_id: 'qisas', type: 'episode', with_publish: 0 })
  })

  test('rights are represented honestly: inheritance, overrides and expiry', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    vi.spyOn(api, 'availability').mockResolvedValue({
      success: true,
      data: {
        available: true, code: 'ok', source: 'inherited', inherited_from: 'global',
        policy: null, reason: null, message_ar: null, chain: [],
      },
    } as never)

    mountWorkspace('/planets/qisas?tab=rights')

    expect(await screen.findByText('تجاوزات على سلاسل')).toBeInTheDocument()
    expect(screen.getByText('2020-01-01')).toBeInTheDocument()
    expect(screen.getByText(/الإتاحة لا تتقاطع/)).toBeInTheDocument()
  })

  test('a missing planet is a stated empty state with a way back', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockRejectedValue(new ApiError('Planet not found', 404))

    mountWorkspace('/planets/nope')

    expect(await screen.findByText('الكوكب غير موجود')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'الكواكب' })).toHaveAttribute('href', '/admin/planets')
  })

  test('breadcrumbs are clickable up the hierarchy', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mountWorkspace()

    await screen.findByRole('heading', { name: 'كوكب القصص' })
    expect(screen.getByRole('link', { name: 'الكواكب' })).toHaveAttribute('href', '/admin/planets')
    expect(screen.getByRole('link', { name: 'المحتوى' })).toHaveAttribute('href', '/admin')
  })

  test('English keeps the same structure with English labels', async () => {
    grantAll()
    vi.spyOn(api, 'planetWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mountWorkspace('/planets/qisas', 'en')

    expect(await screen.findByRole('heading', { name: 'Stories' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Production/ })).toBeInTheDocument()
    expect(screen.getByText('Planet cover missing')).toBeInTheDocument()
  })
})

describe('PlanetEditorDrawer', () => {
  test('it edits exactly the columns the planets table has', async () => {
    grantAll()
    renderWithProviders(
      <PlanetEditorDrawer open planet={planetRow()} onClose={() => {}} onSaved={() => {}} />,
      { route: '/planets' },
    )

    expect(screen.getByRole('dialog', { name: 'تعديل الكوكب' })).toBeInTheDocument()
    expect(screen.getByLabelText(/الاسم بالعربية/)).toHaveValue('كوكب القصص')
    expect(screen.getByLabelText(/الاسم بالإنجليزية/)).toHaveValue('Stories')
    // المعرّف مقروء فقط بعد الإنشاء: تغييره يكسر كل رابط
    expect(screen.getByLabelText(/المعرّف/)).toBeDisabled()
    // ولا حقل لوصف إنجليزي، لأن العمود غير موجود
    expect(screen.getByText(/لا عمود لوصف إنجليزي/)).toBeInTheDocument()
  })

  test('it validates the colour before sending anything', async () => {
    grantAll()
    const update = vi.spyOn(api, 'updatePlanet')
    const user = userEvent.setup()

    renderWithProviders(
      <PlanetEditorDrawer open planet={planetRow()} onClose={() => {}} onSaved={() => {}} />,
      { route: '/planets' },
    )

    // حقلان لقيمة واحدة، ولكلٍّ اسمه: المنتقي وقيمة الـhex.
    const hex = screen.getByLabelText('قيمة اللون (#RRGGBB)')
    await user.clear(hex)
    await user.type(hex, 'red')
    await user.click(screen.getByRole('button', { name: 'حفظ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('#RRGGBB')
    expect(update).not.toHaveBeenCalled()
  })

  test('closing with unsaved changes asks first', async () => {
    grantAll()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderWithProviders(
      <PlanetEditorDrawer open planet={planetRow()} onClose={onClose} onSaved={() => {}} />,
      { route: '/planets' },
    )

    await user.type(screen.getByLabelText(/الاسم بالعربية/), ' معدّل')
    expect(screen.getByText('تعديلات غير محفوظة')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'إلغاء' }))
    expect(confirm).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  test('a save sends only supported fields and reports the server error verbatim', async () => {
    grantAll()
    const update = vi.spyOn(api, 'updatePlanet').mockRejectedValue(new ApiError('Invalid color_hex', 400))
    const user = userEvent.setup()

    renderWithProviders(
      <PlanetEditorDrawer open planet={planetRow()} onClose={() => {}} onSaved={() => {}} />,
      { route: '/planets' },
    )

    await user.type(screen.getByLabelText(/الاسم بالعربية/), '!')
    await user.click(screen.getByRole('button', { name: 'حفظ' }))

    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.calls[0][1]).toEqual({
      name_ar: 'كوكب القصص!',
      name_en: 'Stories',
      description_ar: 'حكايات مصوّرة',
      color_hex: '#FECA57',
      sort_order: 5,
      is_active: true,
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid color_hex')
  })
})
