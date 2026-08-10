import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, envelope } from './harness'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EpisodesPage } from '../pages/EpisodesPage'
import { CustomersPage } from '../pages/CustomersPage'
import { AuditLogPage } from '../pages/AuditLogPage'
import { FailedEventsPage } from '../pages/FailedEventsPage'
import { RightsPage } from '../pages/RightsPage'
import { CharactersPage } from '../pages/CharactersPage'

/**
 * اختبارات حالة القوائم في العنوان للصفحات الستّ المُهاجَرة.
 *
 * ## ما تحرسه هذه الاختبارات
 *
 * ١. **رابط الغوص من اللوحة التنفيذية يصل مفلترًا.** المقياس يقول «١٢ حلقة قيد
 *    الإنتاج»، والرابط يجب أن يُنادي الخادم بنفس المعامل الذي عدّه المقياس. لذلك
 *    التأكيد على **وسائط النداء المسجَّلة** لا على ما ظهر في الجدول: جدولٌ مطابق
 *    بالحظّ يُخفي أن الفلتر لم يُرسَل أصلًا.
 *
 * ٢. **المُطبَّق مرئي وقابل للإزالة.** فلترة نشطة بلا شريحة تعني «لا نتائج» على
 *    مجموعة فيها نتائج، بلا دليل في الشاشة على السبب.
 *
 * ٣. **تغيير الفلتر يُصفّر الترقيم.** البقاء في الصفحة الثالثة بعد تضييق الفلترة
 *    هو بالضبط كيف تُقرأ مجموعة غير فارغة كأنها فارغة.
 *
 * ٤. **ما لا يقبله الخادم لا يُرسَل إليه.** `GET /admin/rights` بلا فلاتر، وحالة
 *    «كل الحالات» في الأحداث الفاشلة تعني غياب المعامل لا القيمة `all` التي
 *    يرفضها الخادم بـ400.
 */

const lastArgs = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls[spy.mock.calls.length - 1]?.[0] as Record<string, unknown>

const seriesRow = (id: string, title: string) => ({
  id, slug: id, title_ar: title, title_en: title, planet_id: 'p1', planet_name: 'أبجد', planet_color: '#fff',
  type: 'continuous', track_ids: ['kids'], production_level: 'limited_2d', status: 'published',
  episodes_count: 3, cover_url: null, visual_style: null, visual_style_id: null, description_ar: null,
})

const episodeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'ep-1', title_ar: 'الحلقة الأولى', episode_number: 1, series_id: 's1', series_title: 'لونا',
  track_ids: ['kids'], objective_title: 'الحروف', family_activity_ar: 'نشاط', duration_seconds: 300,
  status: 'ready', thumbnail_url: null, description_ar: null, parent_guide_ar: null,
  ...overrides,
})

const customerRow = (overrides: Record<string, unknown> = {}) => ({
  parent_id: 'fam-1', plan: 'family', status: 'active', child_count: 2, device_count: 3, open_tickets: 1,
  ...overrides,
})

const auditRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'log-1', actor_id: 'user-7', action: 'update', entity_type: 'series', entity_id: 's1',
  details: '{"title_ar":"لونا"}', created_at: '2026-08-01T10:00:00.000Z',
  ...overrides,
})

const failedRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'fail-1', event_id: 'evt-1', event_type: 'subscription.updated', parent_id: 'fam-1',
  occurred_at_ms: 1_770_000_000_000, payload: '{"type":"subscription.updated"}', attempts: 5,
  failed_at: '2026-08-01T10:00:00.000Z', status: 'pending', resolved_at: null, resolved_by: null,
  resolution_note: null,
  ...overrides,
})

/// ثلاثون ترخيصًا: النوع يتبدّل، والانتهاء يتبدّل بين «دائم» و«له تاريخ»، فكل
/// فلتر في الشاشة يُقسِم المجموعة قسمة يمكن رؤيتها.
const rightsRows = Array.from({ length: 30 }, (_, index) => ({
  id: `right-${index}`,
  content_id: `series-${index}`,
  series_title: `ترخيص ${index}`,
  owner: `مالك ${index}`,
  license_type: index % 2 === 0 ? 'exclusive' : 'owned',
  countries: '["EG"]',
  languages: '["ar"]',
  devices: '["mobile"]',
  expiry_date: index % 2 === 0 ? null : '2030-01-01',
}))

const characterRows = Array.from({ length: 25 }, (_, index) => ({
  id: `char-${index}`,
  series_id: 's1',
  series_title: 'لونا',
  name_ar: `شخصية ${index}`,
  role: 'hero',
  age: 8,
  description_ar: null,
  traits: ['ودود'],
  reference_images: [],
  expressions: {},
  outfits: [],
  languages: ['ar'],
  speech_style: null,
  voice_actor: 'مؤدٍّ',
  status: 'active',
}))

beforeEach(() => { vi.restoreAllMocks(); window.localStorage.clear() })

/// يفتح درج الفلاتر ويُعيده لتُقرأ حقوله وحدها بلا التباس بجداول الصفحة.
async function openFilterDrawer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /فلاتر/ }))
  return screen.getByRole('dialog', { name: 'فلاتر متقدّمة' })
}

// --- الحلقات ---------------------------------------------------------------

describe('EpisodesPage', () => {
  const mockList = (total = 1) => {
    const episodes = vi.spyOn(api, 'episodes').mockResolvedValue(envelope([episodeRow()], total) as never)
    vi.spyOn(api, 'series').mockResolvedValue(envelope([seriesRow('s1', 'لونا'), seriesRow('s2', 'رحلة')]) as never)
    return episodes
  }

  test('a pre-filtered link sends series_id and status to GET /admin/episodes', async () => {
    const episodes = mockList()
    renderWithProviders(<EpisodesPage />, { route: `${adminPath('episodes')}?series_id=s1&status=ready&offset=50` })

    await waitFor(() => expect(episodes).toHaveBeenCalled())
    // أسماء المعاملات كما يقرؤها المعالِج في api/src/routes/admin.ts بالحرف.
    expect(episodes).toHaveBeenCalledWith({ q: '', series_id: 's1', status: 'ready', limit: 50, offset: 50 })
  })

  test('the applied status shows as a chip that removes only itself', async () => {
    const episodes = mockList()
    const user = userEvent.setup()
    renderWithProviders(<EpisodesPage />, { route: `${adminPath('episodes')}?series_id=s1&status=ready` })

    expect(await screen.findByText('الحالة: جاهز')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'إزالة الفلتر: الحالة' }))

    // الشريحة المُزالة تُسقط معاملها وحده، وتبقى السلسلة مُطبَّقة.
    await waitFor(() => expect(lastArgs(episodes).status).toBe(''))
    expect(lastArgs(episodes).series_id).toBe('s1')
  })

  test('changing a filter returns to the first page', async () => {
    const episodes = mockList(400)
    const user = userEvent.setup()
    renderWithProviders(<EpisodesPage />, { route: `${adminPath('episodes')}?status=ready&offset=200` })
    await waitFor(() => expect(lastArgs(episodes).offset).toBe(200))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('الحالة'), 'draft')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(lastArgs(episodes).status).toBe('draft'))
    // الصفحة الخامسة من مجموعة أضيق تُعرض «لا نتائج» على مجموعة فيها نتائج.
    expect(lastArgs(episodes).offset).toBe(0)
  })
})

// --- العائلات --------------------------------------------------------------

describe('CustomersPage', () => {
  const mockList = (total = 1) =>
    vi.spyOn(api, 'customers').mockResolvedValue(envelope([customerRow()], total) as never)

  test('a pre-filtered link sends plan and status to GET /admin/customers', async () => {
    const customers = mockList()
    renderWithProviders(<CustomersPage />, { route: `${adminPath('customers')}?plan=family&status=active&offset=25` })

    await waitFor(() => expect(customers).toHaveBeenCalled())
    expect(customers).toHaveBeenCalledWith({ q: undefined, plan: 'family', status: 'active', limit: 25, offset: 25 })
  })

  test('the applied plan shows as a chip that removes only itself', async () => {
    const customers = mockList()
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />, { route: `${adminPath('customers')}?plan=family&status=active` })

    expect(await screen.findByText('الباقة: family')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'إزالة الفلتر: الباقة' }))

    await waitFor(() => expect(lastArgs(customers).plan).toBeUndefined())
    expect(lastArgs(customers).status).toBe('active')
  })

  test('changing a filter returns to the first page', async () => {
    const customers = mockList(300)
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />, { route: `${adminPath('customers')}?plan=family&offset=100` })
    await waitFor(() => expect(lastArgs(customers).offset).toBe(100))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('الحالة'), 'suspended')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(lastArgs(customers).status).toBe('suspended'))
    expect(lastArgs(customers).offset).toBe(0)
  })
})

// --- سجل التدقيق -----------------------------------------------------------

describe('AuditLogPage', () => {
  const mockList = (total = 1) =>
    vi.spyOn(api, 'auditLogs').mockResolvedValue(envelope([auditRow()], total) as never)

  test('a pre-filtered link sends actor_id and action to GET /admin/audit-logs', async () => {
    const logs = mockList()
    renderWithProviders(<AuditLogPage />, { route: `${adminPath('audit-logs')}?actor_id=user-7&action=update&offset=50` })

    await waitFor(() => expect(logs).toHaveBeenCalled())
    // لا `q`: المسار لا يقبل بحثًا نصيًّا حرًّا، وحقل البحث هو `actor_id` نفسه.
    expect(logs).toHaveBeenCalledWith({
      action: 'update', entity_type: '', actor_id: 'user-7', from: '', to: '', limit: 50, offset: 50,
    })
  })

  test('the applied action shows as a chip that removes only itself', async () => {
    const logs = mockList()
    const user = userEvent.setup()
    renderWithProviders(<AuditLogPage />, { route: `${adminPath('audit-logs')}?action=update&actor_id=user-7` })

    expect(await screen.findByText('الفعل: تعديل')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'إزالة الفلتر: الفعل' }))

    await waitFor(() => expect(lastArgs(logs).action).toBe(''))
    expect(lastArgs(logs).actor_id).toBe('user-7')
  })

  test('changing a filter returns to the first page', async () => {
    const logs = mockList(500)
    const user = userEvent.setup()
    renderWithProviders(<AuditLogPage />, { route: `${adminPath('audit-logs')}?action=update&offset=150` })
    await waitFor(() => expect(lastArgs(logs).offset).toBe(150))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('الفعل'), 'delete')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(lastArgs(logs).action).toBe('delete'))
    expect(lastArgs(logs).offset).toBe(0)
  })
})

// --- الأحداث الفاشلة -------------------------------------------------------

describe('FailedEventsPage', () => {
  const mockList = (rows = [failedRow()], total = 1) =>
    vi.spyOn(api, 'failedFamilyEvents').mockResolvedValue({
      success: true, data: rows, meta: { total, pending: 1, limit: 50, offset: 0 },
    } as never)

  test('a pre-filtered link sends status and parent_id to GET /admin/failed-family-events', async () => {
    const events = mockList([failedRow({ status: 'replayed' })])
    renderWithProviders(<FailedEventsPage />, { route: `${adminPath('failed-events')}?status=replayed&parent_id=fam-1` })

    await waitFor(() => expect(events).toHaveBeenCalled())
    expect(events).toHaveBeenCalledWith({ status: 'replayed', parent_id: 'fam-1', limit: 50, offset: 0 })
  })

  test('the default landing asks for pending, and "all statuses" asks for none', async () => {
    const events = mockList()
    const user = userEvent.setup()
    renderWithProviders(<FailedEventsPage />, { route: adminPath('failed-events') })

    // الصفحة تُفتح على ما يحتاج قرارًا، لا على السجل كله.
    await waitFor(() => expect(lastArgs(events).status).toBe('pending'))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('الحالة'), 'all')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    // `status=all` يرفضه الخادم بـ400، فيُترجَم إلى غياب المعامل لا يُرسَل كما هو.
    await waitFor(() => expect(lastArgs(events).status).toBe(''))
  })

  test('the applied status shows as a chip that removes only itself', async () => {
    const events = mockList([failedRow({ status: 'discarded' })])
    const user = userEvent.setup()
    renderWithProviders(<FailedEventsPage />, { route: `${adminPath('failed-events')}?status=discarded&parent_id=fam-1` })

    expect(await screen.findByText('الحالة: مُستبعَد')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'إزالة الفلتر: الحالة' }))

    // إزالة الشريحة تُعيد الافتراض `pending` لا الفراغ، فالعنوان يقول ما تقوله الشاشة.
    await waitFor(() => expect(lastArgs(events).status).toBe('pending'))
    expect(lastArgs(events).parent_id).toBe('fam-1')
  })

  test('changing a filter returns to the first page', async () => {
    const events = mockList([failedRow()], 400)
    const user = userEvent.setup()
    renderWithProviders(<FailedEventsPage />, { route: `${adminPath('failed-events')}?status=pending&offset=100` })
    await waitFor(() => expect(lastArgs(events).offset).toBe(100))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('الحالة'), 'replayed')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(lastArgs(events).status).toBe('replayed'))
    expect(lastArgs(events).offset).toBe(0)
  })
})

// --- الحقوق ----------------------------------------------------------------

describe('RightsPage', () => {
  const mockList = () => vi.spyOn(api, 'rights').mockResolvedValue(envelope(rightsRows, 30) as never)

  test('a pre-filtered link sends the filter to the server, not to a browser-side pass', async () => {
    const rights = mockList()
    renderWithProviders(<RightsPage />, { route: `${adminPath('rights')}?license_type=owned` })

    // كان المسار بلا فلاتر والتصفية في المتصفح، فمقياس «تراخيص منتهية» في اللوحة
    // التنفيذية كان يفتح قائمة غير مفلترة. الآن الفلتر معامل يفهمه الخادم.
    await waitFor(() => expect(rights).toHaveBeenCalled())
    expect(rights.mock.calls.at(-1)![0]).toMatchObject({ license_type: 'owned' })
    expect(await screen.findByText('مالك 0')).toBeInTheDocument()
  })

  test('the applied licence type shows as a chip that drops only itself', async () => {
    const rights = mockList()
    const user = userEvent.setup()
    renderWithProviders(<RightsPage />, { route: `${adminPath('rights')}?license_type=owned` })

    expect(await screen.findByText('النوع: ملكية كاملة')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'إزالة الفلتر: النوع' }))

    await waitFor(() => expect(rights.mock.calls.at(-1)![0]!.license_type).toBeUndefined())
  })

  test('the expiry filter uses the values the server understands', async () => {
    const rights = mockList()
    const user = userEvent.setup()
    renderWithProviders(<RightsPage />, { route: adminPath('rights') })
    await waitFor(() => expect(rights).toHaveBeenCalled())

    const drawer = await openFilterDrawer(user)
    // `soon` و`expired` و`none` هي ما يفهمه المعالِج بالحرف. `perpetual` كان اسمًا
    // محليًّا لا يعرفه الخادم، فإرساله كان يعني فلترة لا تحدث.
    await user.selectOptions(within(drawer).getByLabelText('الانتهاء'), 'soon')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(rights.mock.calls.at(-1)![0]).toMatchObject({ expiry: 'soon' }))
  })

  test('changing a filter returns to the first page', async () => {
    const rights = mockList()
    const user = userEvent.setup()
    renderWithProviders(<RightsPage />, { route: `${adminPath('rights')}?offset=25` })

    await waitFor(() => expect(rights.mock.calls.at(-1)![0]).toMatchObject({ offset: 25 }))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('الانتهاء'), 'none')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    // بلا تصفير الترقيم كانت النتيجة صفحةً فارغة على مجموعة فيها نتائج.
    await waitFor(() => expect(rights.mock.calls.at(-1)![0]).toMatchObject({ expiry: 'none', offset: 0 }))
  })
})

// --- الشخصيات --------------------------------------------------------------

describe('CharactersPage', () => {
  const mockList = () => {
    const characters = vi.spyOn(api, 'characters').mockResolvedValue(envelope(characterRows, 25) as never)
    vi.spyOn(api, 'series').mockResolvedValue(envelope([seriesRow('s1', 'لونا'), seriesRow('s2', 'رحلة')]) as never)
    return characters
  }

  test('a pre-filtered link sends series_id, and paging goes to the server', async () => {
    const characters = mockList()
    renderWithProviders(<CharactersPage />, { route: `${adminPath('characters')}?series_id=s1` })

    await waitFor(() => expect(characters).toHaveBeenCalled())
    // الترقيم يُرسَل الآن. كان الخادم يحدّ بعشرين صفًّا والعميل لا يُرسل offset
    // إطلاقًا، فما بعد الصفحة الأولى لم يكن قابلًا للوصول.
    expect(characters.mock.calls.at(-1)![0]).toMatchObject({ series_id: 's1', offset: 0 })
    expect(characters.mock.calls.at(-1)![0]!.limit).toBeGreaterThan(0)
  })

  test('the applied series shows as a chip that clears the filter when removed', async () => {
    const characters = mockList()
    const user = userEvent.setup()
    renderWithProviders(<CharactersPage />, { route: `${adminPath('characters')}?series_id=s1` })

    expect(await screen.findByText('السلسلة: لونا')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'إزالة الفلتر: السلسلة' }))

    // بلا سلسلة لا يُرسَل المعامل، لا يُرسَل فارغًا.
    await waitFor(() => expect(characters.mock.calls.at(-1)![0]!.series_id).toBeUndefined())
  })

  test('changing the series returns to the first page', async () => {
    const characters = mockList()
    const user = userEvent.setup()
    renderWithProviders(<CharactersPage />, { route: `${adminPath('characters')}?series_id=s1&offset=20` })

    await waitFor(() => expect(characters.mock.calls.at(-1)![0]).toMatchObject({ offset: 20 }))

    const drawer = await openFilterDrawer(user)
    await user.selectOptions(within(drawer).getByLabelText('السلسلة'), 's2')
    await user.click(within(drawer).getByRole('button', { name: /تطبيق/ }))

    await waitFor(() => expect(characters.mock.calls.at(-1)![0]).toMatchObject({ series_id: 's2', offset: 0 }))
  })
})
