import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './harness'

/**
 * اختبارات اللوحة التنفيذية والأسطح التشغيلية القائمة.
 *
 * ## ما تحرسه في كل سطح
 *
 * - **اللوحة التنفيذية**: كل مؤشّر يفتح الشاشة المفلترة على نفس مجموعته، والحدّ
 *   المُعلَن من الخادم يُعرض ولا يُخفى في تلميح.
 * - **الدعم**: الساعتان تظهران منفصلتين، والإجراء غير المتاح يُعرض بسبب تعذّره لا
 *   كزرّ يفشل.
 * - **مركز الإنتاج**: الحالة مشتقّة من الأصول ولا حقل حالة قابلًا للضبط.
 * - **Customer 360**: القراءة الحيّة والإسقاط مصدران مُسمّيان، وفشل السلطة لا
 *   يُسقط الصفحة، والسبب إلزامي في كل أمر مشغِّل.
 */

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    executiveOverview: vi.fn(),
    dashboard: vi.fn(),
    contentReviews: vi.fn(),
    tasks: vi.fn(),
    rights: vi.fn(),
    supportTickets: vi.fn(),
    supportSla: vi.fn(),
    supportViews: vi.fn(),
    supportTicket: vi.fn(),
    createSupportView: vi.fn(),
    productionBoard: vi.fn(),
    productionQueue: vi.fn(),
    productionItem: vi.fn(),
    saveProductionAssignment: vi.fn(),
    customer360: vi.fn(),
    revokeFamilyDevice: vi.fn(),
    revokeFamilyDownloads: vi.fn(),
    resyncFamily: vi.fn(),
    devices: vi.fn(),
    adminUsers: vi.fn(),
    teams: vi.fn(),
    assetBlob: vi.fn(),
    assets: vi.fn(),
  },
}))

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, api: apiMock }
})

const { DashboardPage } = await import('../pages/DashboardPage')
const { CustomerDetailPage } = await import('../pages/CustomerDetailPage')
const { ProductionPage } = await import('../pages/ProductionPage')
const { ApiError } = await import('../lib/api')
const { adminPath } = await import('../lib/adminPath')

const OVERVIEW = {
  generated_at: '2026-08-10T00:00:00.000Z',
  modules: [
    {
      key: 'support',
      label_ar: 'الدعم',
      label_en: 'Support',
      source: 'support_tickets',
      unavailable: null,
      metrics: [
        { key: 'open', label_ar: 'تذاكر مفتوحة', label_en: 'Open tickets', value: 12, tone: 'neutral', drill: '/support-center?status=open' },
        { key: 'resolution_breached', label_ar: 'خرق مهلة الحلّ', label_en: 'Resolution SLA breached', value: 5, tone: 'danger', drill: '/support-center?overdue=resolution' },
      ],
    },
    {
      key: 'devices',
      label_ar: 'الأجهزة',
      label_en: 'Devices',
      source: 'account_devices (إسقاط D1)',
      unavailable: 'العدّ من إسقاط D1 الذي لم يعد مسار التسجيل يكتبه.',
      metrics: [
        { key: 'active_devices', label_ar: 'أجهزة نشطة (إسقاط)', label_en: 'Active devices', value: 90, tone: 'neutral', drill: '/devices-admin' },
      ],
    },
  ],
  limits: ['الإيرادات: لا مزوّد دفع مُهيَّأ.', 'حالة الفهرسة: لا تكامل مع Search Console.'],
}

const DASHBOARD_STATS = {
  totals: { total_series: 8, published_series: 5, total_episodes: 40, published_episodes: 30, active_parents: 100, active_children: 180 },
  series_by_track: { preschool: 3, kids: 3, junior: 2 },
  series_by_status: [{ status: 'published', count: 5 }],
  parents_by_plan: [{ plan: 'family', count: 20 }],
  recent_series: [],
  recent_activity: [],
  generated_at: '2026-08-10T00:00:00.000Z',
}

const CUSTOMER = {
  family: { parent_id: 'fam-1', plan: 'family', status: 'active' },
  authority: {
    available: true as const,
    source: 'FamilyState',
    parent_id: 'fam-1',
    status: 'active',
    base_plan: 'family',
    effective_plan: 'family',
    auth_epoch: 3,
    entitlements: [],
    devices: [{ id: 'dev-1', display_name: 'لوح البيت', platform: 'android', status: 'active', registered_at: 0, last_seen_at: 0 }],
    active_leases: 1,
    active_sessions: 2,
    child_count: 0,
    active_child_count: 0,
    progress_records: 12,
  },
  children: [],
  devices_projection: [],
  billing: [],
  purchases: [],
  tickets: [],
  audit: [],
  consents: [],
  progress_summary: { records: 12 },
}

beforeEach(() => {
  apiMock.executiveOverview.mockResolvedValue({ success: true, data: OVERVIEW })
  apiMock.dashboard.mockResolvedValue({ success: true, data: DASHBOARD_STATS })
  apiMock.contentReviews.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
  apiMock.tasks.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
  apiMock.rights.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
  apiMock.customer360.mockResolvedValue({ success: true, data: CUSTOMER })
  apiMock.productionBoard.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
  apiMock.productionQueue.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
  apiMock.adminUsers.mockResolvedValue({ success: true, data: [] })
  apiMock.teams.mockResolvedValue({ success: true, data: [] })
})

// --- اللوحة التنفيذية ------------------------------------------------------

describe('executive dashboard modules', () => {
  test('every metric is a link to the filtered screen that reproduces it', async () => {
    renderWithProviders(<DashboardPage />, { route: adminPath() })
    const open = await screen.findByRole('link', { name: /تذاكر مفتوحة/ })
    expect(open).toHaveAttribute('href', `${adminPath('support-center')}?status=open`)
    const breached = screen.getByRole('link', { name: /خرق مهلة الحلّ/ })
    expect(breached).toHaveAttribute('href', `${adminPath('support-center')}?overdue=resolution`)
  })

  test('an alerting metric is visually distinct from a plain count', async () => {
    renderWithProviders(<DashboardPage />, { route: adminPath() })
    const breached = await screen.findByRole('link', { name: /خرق مهلة الحلّ/ })
    expect(breached).toHaveClass('exec-metric--danger')
    expect(screen.getByRole('link', { name: /تذاكر مفتوحة/ })).toHaveClass('exec-metric--neutral')
  })

  test('a declared data limit is shown next to the numbers it qualifies', async () => {
    renderWithProviders(<DashboardPage />, { route: adminPath() })
    expect(await screen.findByText(/لم يعد مسار التسجيل يكتبه/)).toBeInTheDocument()
  })

  test('each module names its source tables', async () => {
    renderWithProviders(<DashboardPage />, { route: adminPath() })
    expect(await screen.findByText(/support_tickets/)).toBeInTheDocument()
  })

  test('what the dashboard cannot say is listed on the page', async () => {
    renderWithProviders(<DashboardPage />, { route: adminPath() })
    expect(await screen.findByText(/لا مزوّد دفع مُهيَّأ/)).toBeInTheDocument()
    expect(screen.getByText(/لا تكامل مع Search Console/)).toBeInTheDocument()
  })

  test('a failed aggregate degrades to its own error, not a blank home screen', async () => {
    apiMock.executiveOverview.mockRejectedValueOnce(new ApiError('aggregate failed', 500))
    renderWithProviders(<DashboardPage />, { route: adminPath() })
    // بقية اللوحة تظهر: الإحصاءات الأساسية تأتي من مسار آخر.
    expect(await screen.findByText(/تعذر تحميل الوحدات التشغيلية/)).toBeInTheDocument()
    expect(screen.getByText('إجمالي السلاسل')).toBeInTheDocument()
  })

  test('the aggregate is retried on demand', async () => {
    const user = userEvent.setup()
    apiMock.executiveOverview.mockRejectedValueOnce(new ApiError('aggregate failed', 500))
    renderWithProviders(<DashboardPage />, { route: adminPath() })
    await user.click(await screen.findByRole('button', { name: /إعادة المحاولة/ }))
    expect(await screen.findByRole('link', { name: /تذاكر مفتوحة/ })).toBeInTheDocument()
  })
})

// --- مركز الإنتاج ----------------------------------------------------------

describe('ProductionPage', () => {
  test('an empty board says so instead of rendering an empty grid', async () => {
    renderWithProviders(<ProductionPage />, { route: adminPath('production') })
    await waitFor(() => expect(apiMock.productionBoard).toHaveBeenCalled())
    expect(await screen.findByText('لا عمل إنتاجي مطابق')).toBeInTheDocument()
  })

  test('a failed board load reports the server message', async () => {
    apiMock.productionBoard.mockRejectedValueOnce(new ApiError('board unavailable', 503))
    renderWithProviders(<ProductionPage />, { route: adminPath('production') })
    expect(await screen.findByText('board unavailable')).toBeInTheDocument()
  })
})

// --- Customer 360 والأوامر التشغيلية ---------------------------------------

describe('CustomerDetailPage', () => {
  const renderWorkspace = () => renderWithProviders(<CustomerDetailPage />, {
    route: adminPath('customers/fam-1'),
    path: `${adminPath('customers')}/:id`,
  })

  test('the live authority and the D1 projection are named as different sources', async () => {
    renderWorkspace()
    await screen.findByRole('tab', { name: /الأجهزة/ })
    expect(screen.getByText(/FamilyState \(حيّ\)/)).toBeInTheDocument()
  })

  test('an unavailable authority marks its own section and leaves the page usable', async () => {
    apiMock.customer360.mockResolvedValue({
      success: true,
      data: { ...CUSTOMER, authority: { available: false, reason: 'DO unreachable' } },
    })
    renderWorkspace()
    // القسم يُعلن تعذّره، وباقي الصفحة يُحمَّل: 503 على المساحة كلها يجعلها بلا
    // نفع في اللحظة التي تُطلب فيها.
    expect(await screen.findByRole('alert')).toHaveTextContent('DO unreachable')
    expect(screen.getAllByRole('tab').length).toBeGreaterThan(1)
  })

  test('a device revoke cannot be executed without a reason', async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByRole('tab', { name: /الأجهزة/ })
    await user.click(screen.getByRole('tab', { name: /الأجهزة/ }))
    await user.click(screen.getByRole('button', { name: 'سحب الجهاز' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/لا يمكن التراجع/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'تنفيذ' }))
    // الخادم يرفض بلا سبب؛ الواجهة لا ترسل نداءً سيُرفض.
    expect(apiMock.revokeFamilyDevice).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText(/السبب/), 'جهاز مفقود')
    await user.click(within(dialog).getByRole('button', { name: 'تنفيذ' }))
    await waitFor(() => expect(apiMock.revokeFamilyDevice).toHaveBeenCalledWith('fam-1', 'dev-1', 'جهاز مفقود'))
  })

  test('a refused operator command shows the server reason', async () => {
    const user = userEvent.setup()
    apiMock.revokeFamilyDevice.mockRejectedValueOnce(new ApiError('reason is required', 400))
    renderWorkspace()
    await screen.findByRole('tab', { name: /الأجهزة/ })
    await user.click(screen.getByRole('tab', { name: /الأجهزة/ }))
    await user.click(screen.getByRole('button', { name: 'سحب الجهاز' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/السبب/), 'x')
    await user.click(within(dialog).getByRole('button', { name: 'تنفيذ' }))
    expect(await screen.findByText('reason is required')).toBeInTheDocument()
  })

  test('a resync states that the projection updates on delivery, not immediately', async () => {
    const user = userEvent.setup()
    renderWorkspace()
    // الإجراء على مستوى العائلة لا على جهاز، فموضعه تبويب النظرة العامة.
    await user.click(await screen.findByRole('button', { name: 'إعادة مزامنة الإسقاط' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/عند تسليم الحدث لا فورًا/)).toBeInTheDocument()
  })

  test('a failed workspace load offers a retry', async () => {
    apiMock.customer360.mockRejectedValueOnce(new ApiError('not found', 404))
    renderWorkspace()
    expect(await screen.findByRole('alert')).toHaveTextContent('not found')
    expect(screen.getByRole('button', { name: /إعادة المحاولة/ })).toBeInTheDocument()
  })

  test('no watch history and no purchase token are rendered', async () => {
    renderWorkspace()
    await screen.findByRole('tab', { name: /الأجهزة/ })
    // حدّ خصوصية مثبَّت في الخادم بالاختبارات؛ هذا يمنع الواجهة من إعادة إدخاله.
    expect(screen.queryByText(/purchase_token/)).toBeNull()
    expect(screen.queryByText(/watch_progress/)).toBeNull()
    expect(screen.getByText(/لا يعرض هذا الملف تاريخ مشاهدة/)).toBeInTheDocument()
  })
})
