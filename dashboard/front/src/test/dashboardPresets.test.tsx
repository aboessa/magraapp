import { describe, expect, test, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, envelope } from './harness'
import { ExecutiveModules } from '../pages/DashboardPage'
import { orderModules, PRESETS, readPreset, suggestedPreset, writePreset } from '../lib/dashboardPresets'
import { api } from '../lib/api'

/**
 * اختبارات اللوحة الرئيسية: الترتيب حسب الدور، وعرض المقياس غير المتاح.
 *
 * ## أهمّ ما تحميه
 *
 * أن `value: null` يُعرَض شرطةً لا صفرًا. الخادم كان يُنهي كل عدّ بـ`?? 0` فيُعرَض
 * مصدر غير مقروء رقمًا حقيقيًّا؛ أُصلح ذلك في الخادم، ولو طبعت الواجهة
 * `formatNumber(null)` لعاد الخلط من الجهة الأخرى. وأن مقياسًا بلا قيمة لا يفتح
 * شاشة مفلترة، لأن الرابط كان سيوعد بمجموعة لا يُعرف حجمها.
 *
 * وأن الترتيب لا يُخفي وحدة: الوحدة خارج إعداد الدور تُنقل إلى «وحدات أخرى»،
 * فمدير الدعم يعرف أن وحدة الحقوق موجودة حتى وهي ليست أولويته.
 */

const metric = (key: string, overrides: Record<string, unknown> = {}) => ({
  key,
  label_ar: `مقياس ${key}`,
  label_en: `metric ${key}`,
  value: 7,
  tone: 'neutral',
  drill: '/support-center',
  ...overrides,
})

const module_ = (key: string, metrics = [metric(`${key}_a`)]) => ({
  key,
  label_ar: `وحدة ${key}`,
  label_en: `module ${key}`,
  source: `${key}_table`,
  unavailable: null,
  metrics,
})

const overview = (keys: string[]) => ({
  generated_at: '2026-08-11T00:00:00.000Z',
  modules: keys.map((key) => module_(key)),
  limits: ['حدّ معلن'],
})

/// المسارات الأخرى التي تنادِيها الصفحة، مُسكتة حتى لا تُخفي فشلًا غير مقصود.
function mockSupporting() {
  vi.spyOn(api, 'dashboard').mockResolvedValue(envelope({
    totals: {
      series: 0, episodes: 0, stories: 0, games: 0, projects: 0, books: 0,
      parents: 0, children: 0, assets: 0,
    },
    series_by_track: { preschool: 0, kids: 0, junior: 0 },
    series_by_status: {},
    plans: {},
    recent_activity: [],
  }) as never)
  vi.spyOn(api, 'contentReviews').mockResolvedValue(envelope([]) as never)
  vi.spyOn(api, 'tasks').mockResolvedValue(envelope([]) as never)
  vi.spyOn(api, 'rights').mockResolvedValue(envelope([], 0) as never)
  vi.spyOn(api, 'failedFamilyEvents').mockResolvedValue(envelope([], 0) as never)
}

const session = (roles: string[]) => {
  window.sessionStorage.setItem('majarra-admin-token', 'test-token')
  window.sessionStorage.setItem('majarra-admin-user', JSON.stringify({
    id: 'u1', email: 'a@b.c', display_name: 'Tester', roles, permissions: [], must_change_password: false,
  }))
}

// --- منطق الإعداد -----------------------------------------------------------

describe('dashboardPresets', () => {
  beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear() })

  test('every preset names only real module keys', () => {
    // إعداد يذكر مفتاحًا لا يُعيده الخادم يعني بطاقة مفقودة بلا أي إشارة.
    const real = new Set(['support', 'production', 'workflow', 'catalogue', 'website',
      'blog', 'seo', 'customers', 'devices', 'rights', 'platform'])
    for (const [preset, keys] of Object.entries(PRESETS)) {
      for (const key of keys) expect(real.has(key), `${preset} -> ${key}`).toBe(true)
    }
  })

  test('ordering moves modules rather than dropping them', () => {
    const modules = [{ key: 'rights' }, { key: 'support' }, { key: 'customers' }]
    const { primary, secondary } = orderModules(modules, 'support')
    expect(primary.map((entry) => entry.key)).toEqual(['support', 'customers'])
    expect(secondary.map((entry) => entry.key)).toEqual(['rights'])
    // لا وحدة تُفقد بتبديل إعداد.
    expect(primary.length + secondary.length).toBe(modules.length)
  })

  test('a module the server did not send is skipped, not rendered empty', () => {
    const { primary } = orderModules([{ key: 'support' }], 'support')
    expect(primary.map((entry) => entry.key)).toEqual(['support'])
  })

  test('the all preset keeps the server order untouched', () => {
    const modules = [{ key: 'rights' }, { key: 'support' }]
    const { primary, secondary } = orderModules(modules, 'all')
    expect(primary).toEqual(modules)
    expect(secondary).toEqual([])
  })

  test('the suggested preset follows the account roles, and falls back to the widest', () => {
    session(['support'])
    expect(suggestedPreset()).toBe('support')
    session(['content_manager'])
    expect(suggestedPreset()).toBe('content')
    session(['owner'])
    expect(suggestedPreset()).toBe('executive')
    // دور غير معروف يحصل على الأوسع لا على إعداد فارغ.
    session(['some_new_role'])
    expect(suggestedPreset()).toBe('executive')
  })

  test('a stored preference wins over the role, and a corrupt one does not', () => {
    session(['support'])
    writePreset('marketing')
    expect(readPreset()).toBe('marketing')
    window.localStorage.setItem('majarra-admin-dashboard-preset', 'not-a-preset')
    expect(readPreset()).toBe('support')
  })
})

// --- العرض ------------------------------------------------------------------

describe('DashboardPage executive modules', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    session(['owner'])
    mockSupporting()
  })

  test('an unavailable metric prints a dash and its reason, never a zero', async () => {
    vi.spyOn(api, 'executiveOverview').mockResolvedValue(envelope({
      ...overview(['devices']),
      modules: [module_('devices', [metric('active_devices', {
        value: null,
        unavailable: 'account_devices إسقاط لا يكتبه شيء.',
        drill: '/devices-admin',
      })])],
    }) as never)

    renderWithProviders(<ExecutiveModules locale="ar" />, { route: '/' })

    const card = await screen.findByText('وحدة devices')
    const panel = card.closest('article')!
    expect(within(panel).getByText('—')).toBeInTheDocument()
    expect(within(panel).queryByText('0')).not.toBeInTheDocument()
    expect(within(panel).getByText('account_devices إسقاط لا يكتبه شيء.')).toBeInTheDocument()
  })

  test('an unavailable metric is not a link, because its set has no known size', async () => {
    vi.spyOn(api, 'executiveOverview').mockResolvedValue(envelope({
      ...overview(['devices']),
      modules: [module_('devices', [metric('active_devices', { value: null, unavailable: 'غير متاح', drill: '/devices-admin' })])],
    }) as never)

    renderWithProviders(<ExecutiveModules locale="ar" />, { route: '/' })
    await screen.findByText('وحدة devices')
    expect(screen.queryByRole('link', { name: /مقياس active_devices/ })).not.toBeInTheDocument()
  })

  test('a metric with a value keeps its drill-down link', async () => {
    vi.spyOn(api, 'executiveOverview').mockResolvedValue(envelope(overview(['support'])) as never)
    renderWithProviders(<ExecutiveModules locale="ar" />, { route: '/' })

    await screen.findByText('وحدة support')
    const link = screen.getByRole('link', { name: /مقياس support_a/ })
    expect(link.getAttribute('href')).toContain('support-center')
  })

  test('the layout follows the role, and switching it reorders without hiding', async () => {
    vi.spyOn(api, 'executiveOverview').mockResolvedValue(
      envelope(overview(['rights', 'support', 'customers'])) as never,
    )
    const user = userEvent.setup()
    session(['support'])
    renderWithProviders(<ExecutiveModules locale="ar" />, { route: '/' })

    await screen.findByText('وحدة support')
    // إعداد الدعم يقدّم الدعم والعملاء؛ الحقوق تُنقل إلى «وحدات أخرى» ولا تُخفى.
    expect(screen.getByText('وحدات أخرى')).toBeInTheDocument()
    expect(screen.getByText('وحدة rights')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('الترتيب'), 'all')
    await waitFor(() => expect(screen.queryByText('وحدات أخرى')).not.toBeInTheDocument())
    expect(screen.getByText('وحدة rights')).toBeInTheDocument()
  })

  test('the chosen layout is remembered and declared as browser-local', async () => {
    vi.spyOn(api, 'executiveOverview').mockResolvedValue(envelope(overview(['support', 'rights'])) as never)
    const user = userEvent.setup()
    renderWithProviders(<ExecutiveModules locale="ar" />, { route: '/' })

    await screen.findByText('وحدة support')
    await user.selectOptions(screen.getByLabelText('الترتيب'), 'marketing')
    expect(window.localStorage.getItem('majarra-admin-dashboard-preset')).toBe('marketing')
    // الحدّ مُعلَن: لا جدول تفضيلات في الخادم، فالاختيار لا يسافر مع الحساب.
    expect(screen.getByText(/تفضيل في هذا المتصفح/)).toBeInTheDocument()
  })

  test('a module-level unavailable reason is rendered above its metrics', async () => {
    vi.spyOn(api, 'executiveOverview').mockResolvedValue(envelope({
      ...overview(['platform']),
      modules: [{ ...module_('platform'), unavailable: 'جدول الأحداث الفاشلة غير موجود.' }],
    }) as never)

    renderWithProviders(<ExecutiveModules locale="ar" />, { route: '/' })
    expect(await screen.findByText('جدول الأحداث الفاشلة غير موجود.')).toBeInTheDocument()
  })

  test('a failing overview offers a retry that recovers', async () => {
    const overviewCall = vi.spyOn(api, 'executiveOverview').mockRejectedValue(new Error('500 server'))
    const user = userEvent.setup()
    renderWithProviders(<ExecutiveModules locale="ar" />, { route: '/' })

    expect(await screen.findByText('500 server')).toBeInTheDocument()
    overviewCall.mockResolvedValue(envelope(overview(['support'])) as never)
    await user.click(screen.getByRole('button', { name: /إعادة المحاولة/ }))
    await waitFor(() => expect(screen.getByText('وحدة support')).toBeInTheDocument())
  })
})
