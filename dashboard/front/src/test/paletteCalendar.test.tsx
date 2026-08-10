import { describe, expect, test, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, envelope } from './harness'
import { CommandPalette } from '../components/CommandPalette'
import { ContentCalendarPage } from '../pages/ContentCalendarPage'
import { dayKey, scheduleRange, shiftAnchor, startOfWeek } from '../lib/scheduleDates'
import { api } from '../lib/api'

/**
 * اختبارات لوحة الأوامر وتقويم المحتوى وحساب نوافذ الجدولة.
 *
 * ## ما تحميه هذه الاختبارات
 *
 * **لوحة الأوامر**: أنها لا تعرض أمرًا لا يملك المستخدم صلاحيته، وأنها تُظهر ما
 * حجبه الخادم بدل أن تُخفيه، وأنها تعمل بلوحة المفاتيح وحدها. الأخيرة ليست
 * تحسينًا: لوحة أوامر لا تُدار بالمفاتيح هي قائمة عادية بخطوات أكثر.
 *
 * **التقويم**: أن كل حدث مجدول يحمل تنبيه «لا مُشغِّل» — لأن الخادم يقول إن لا
 * كرون ينشر المجدول — وأن حدثًا غير قابل للنقل لا يعرض حقل نقل، وأن حقل النقل
 * ينادي المسار الذي يُعلنه الحدث لا مسارًا يخترعه العميل.
 *
 * **حساب النوافذ**: `dayKey` بالتوقيت المحلّي لا UTC. الفرق يُنتج يومًا خاطئًا
 * لكل حدث بعد التاسعة مساءً بتوقيت الخليج، وهو خطأ لا يُرى في مراجعة كود.
 */

const searchPayload = (overrides: Record<string, unknown> = {}) => ({
  query: 'لونا',
  groups: [
    {
      type: 'series',
      results: [{
        id: 's1', type: 'series', title: 'لونا تكتشف الكلمات', subtitle: 'luna',
        status: 'published', admin_route: 'series/s1', image_url: null, context: 'أبجد',
      }],
    },
  ],
  total: 1,
  unavailable: [{ type: 'campaign', reason: 'لا جدول حملات في أي مهاجرة.' }],
  failed: [],
  scope: { restricted: false, omitted_types: [] },
  types: [{ type: 'series', group: 'catalogue' }],
  ...overrides,
})

const session = (roles: string[], permissions: string[] = []) => {
  window.sessionStorage.setItem('majarra-admin-token', 'test-token')
  window.sessionStorage.setItem('majarra-admin-user', JSON.stringify({
    id: 'u1', email: 'a@b.c', display_name: 'Tester', roles, permissions, must_change_password: false,
  }))
}

describe('CommandPalette', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  test('an owner sees every create command; a reviewer sees only what its permission allows', async () => {
    vi.spyOn(api, 'globalSearch').mockResolvedValue(envelope(searchPayload()) as never)

    session(['owner'])
    const owner = renderWithProviders(<CommandPalette open onClose={() => {}} />)
    expect(screen.getByText('سلسلة جديدة')).toBeInTheDocument()
    // بلا استعلام تُعرض ثمانية أوامر فقط، فأمر التذكرة يظهر عند كتابة اسمه.
    await userEvent.type(screen.getByRole('combobox'), 'تذكرة')
    expect(screen.getByText('تذكرة دعم جديدة')).toBeInTheDocument()
    owner.unmount()

    session(['reviewer'], ['review'])
    renderWithProviders(<CommandPalette open onClose={() => {}} />)
    // `review` تُتيح إنشاء مراجعة محتوى ولا تُتيح إنشاء سلسلة.
    expect(screen.getByText('مراجعة محتوى جديدة')).toBeInTheDocument()
    expect(screen.queryByText('سلسلة جديدة')).not.toBeInTheDocument()
    await userEvent.type(screen.getByRole('combobox'), 'تذكرة')
    expect(screen.queryByText('تذكرة دعم جديدة')).not.toBeInTheDocument()
  })

  test('a query under two characters does not call the server', async () => {
    const search = vi.spyOn(api, 'globalSearch').mockResolvedValue(envelope(searchPayload()) as never)
    session(['owner'])
    renderWithProviders(<CommandPalette open onClose={() => {}} />)

    await userEvent.type(screen.getByRole('combobox'), 'ل')
    // نداء لكل حرف يستهلك حصّة الإدارة، وحرف واحد يطابق معظم الكتالوج.
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(search).not.toHaveBeenCalled()
    expect(screen.getByText('اكتب حرفين على الأقل.')).toBeInTheDocument()
  })

  test('results are grouped by type and carry the context that tells two titles apart', async () => {
    vi.spyOn(api, 'globalSearch').mockResolvedValue(envelope(searchPayload()) as never)
    session(['owner'])
    renderWithProviders(<CommandPalette open onClose={() => {}} />)

    await userEvent.type(screen.getByRole('combobox'), 'لونا')
    await waitFor(() => expect(screen.getByText('لونا تكتشف الكلمات')).toBeInTheDocument())
    expect(screen.getByText('أبجد')).toBeInTheDocument()
    expect(screen.getByText('luna')).toBeInTheDocument()
  })

  test('arrow keys move the selection and Enter opens the highlighted row', async () => {
    vi.spyOn(api, 'globalSearch').mockResolvedValue(envelope(searchPayload()) as never)
    session(['owner'])
    const onClose = vi.fn()
    renderWithProviders(<CommandPalette open onClose={onClose} />)

    const input = screen.getByRole('combobox')
    // الصفّ الأول محدَّد ابتداءً، فالسهم لأسفل ينقل إلى الثاني ثم Enter يفتحه.
    await userEvent.type(input, '{ArrowDown}')
    const options = screen.getAllByRole('option')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')

    await userEvent.type(input, '{Enter}')
    expect(onClose).toHaveBeenCalled()
  })

  test('the highlighted row is announced through aria-activedescendant', async () => {
    session(['owner'])
    renderWithProviders(<CommandPalette open onClose={() => {}} />)
    const input = screen.getByRole('combobox')
    // بلا هذا لا يعرف قارئ الشاشة أيّ صفّ محدَّد، فالتنقّل بالأسهم صامت.
    expect(input.getAttribute('aria-activedescendant')).toMatch(/^palette-row-/)
  })

  test('Escape closes without navigating', async () => {
    session(['owner'])
    const onClose = vi.fn()
    renderWithProviders(<CommandPalette open onClose={onClose} />)
    await userEvent.type(screen.getByRole('combobox'), '{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('what the server withheld is stated, not hidden', async () => {
    vi.spyOn(api, 'globalSearch').mockResolvedValue(envelope(searchPayload({
      scope: {
        restricted: true,
        omitted_types: [{ type: 'family', reason: 'منح الوصول مقصور على محتوى محدّد.' }],
      },
    })) as never)
    session(['editor'], ['edit_text'])
    renderWithProviders(<CommandPalette open onClose={() => {}} />)

    await userEvent.type(screen.getByRole('combobox'), 'لونا')
    // قائمة قصيرة بلا تفسير تُعلّم المستخدم أن البحث غير موثوق.
    await waitFor(() => expect(screen.getByText(/منح وصولك مقصورة/)).toBeInTheDocument())
    expect(screen.getByText(/عائلة —/)).toBeInTheDocument()
  })

  test('a failing search offers a retry rather than an empty list', async () => {
    const search = vi.spyOn(api, 'globalSearch').mockRejectedValue(new Error('rate limited'))
    session(['owner'])
    renderWithProviders(<CommandPalette open onClose={() => {}} />)

    await userEvent.type(screen.getByRole('combobox'), 'لونا')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('rate limited'))

    search.mockResolvedValue(envelope(searchPayload()) as never)
    await userEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }))
    await waitFor(() => expect(screen.getByText('لونا تكتشف الكلمات')).toBeInTheDocument())
  })

  test('a closed palette renders nothing at all', () => {
    session(['owner'])
    const { container } = renderWithProviders(<CommandPalette open={false} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

// --- نوافذ الجدولة ----------------------------------------------------------

describe('scheduleDates', () => {
  test('dayKey uses local time, so a late-evening event stays on its own day', () => {
    // ٢٣:�30 بتوقيت محلّي: لو حُسب المفتاح بـUTC مع أي إزاحة موجبة لانتقل ليوم آخر.
    const late = new Date(2026, 7, 14, 23, 30)
    expect(dayKey(late)).toBe('2026-08-14')
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  test('a week starts on Sunday and spans seven days', () => {
    const range = scheduleRange('week', new Date(2026, 7, 12))
    expect(range.days).toHaveLength(7)
    expect(startOfWeek(new Date(2026, 7, 12)).getDay()).toBe(0)
    expect(range.from < range.to).toBe(true)
  })

  test('a month window covers exactly its own days', () => {
    const february = scheduleRange('month', new Date(2028, 1, 15))
    expect(february.days).toHaveLength(29)
    expect(february.from).toBe('2028-02-01')
    expect(february.to).toBe('2028-02-29')
  })

  test('a day window is one day', () => {
    const range = scheduleRange('day', new Date(2026, 7, 14, 18))
    expect(range.days).toHaveLength(1)
    expect(range.from).toBe(range.to)
  })

  test('moving forward from the 31st does not skip a month', () => {
    // setMonth على يوم ٣١ في شهر من ٣٠ يومًا ينزلق شهرًا كاملًا؛ اليوم الأول صراحةً.
    const next = shiftAnchor('month', new Date(2026, 0, 31), 1)
    expect(next.getMonth()).toBe(1)
    expect(next.getDate()).toBe(1)
  })

  test('day and week navigation move by their own unit', () => {
    expect(dayKey(shiftAnchor('day', new Date(2026, 7, 14), 1))).toBe('2026-08-15')
    expect(dayKey(shiftAnchor('week', new Date(2026, 7, 14), -1))).toBe('2026-08-07')
  })
})

// --- تقويم المحتوى ----------------------------------------------------------

const calendarEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  type: 'blog_post',
  title: 'مقال مجدول',
  date: `${new Date().toISOString().slice(0, 8)}15T09:00:00Z`,
  date_kind: 'scheduled',
  status: 'scheduled',
  language: 'ar',
  planet_id: null,
  owner_id: null,
  team_id: null,
  context: null,
  admin_route: 'blog/posts/p1',
  reschedule: {
    supported: true, method: 'PATCH', route: '/admin/blog/posts/p1',
    field: 'scheduled_at', permission: 'edit_text',
  },
  conflicts: ['no_scheduler'],
  ...overrides,
})

const calendarPayload = (events: Array<Record<string, unknown>>, overrides: Record<string, unknown> = {}) => ({
  from: '2026-08-01',
  to: '2026-08-31',
  events,
  total: events.length,
  total_unfiltered: events.length,
  conflict_summary: {
    no_scheduler: events.filter((event) => (event.conflicts as string[]).includes('no_scheduler')).length,
    lapsed_schedule: 0,
    rights_expiry_before_publication: 0,
    same_day_collision: 0,
  },
  unavailable: [{ type: 'campaign', reason: 'لا جدول حملات في أي مهاجرة.' }],
  scheduler_available: false,
  scheduler_note: 'لا مُشغِّل دوري ينشر المجدول.',
  ...overrides,
})

describe('ContentCalendarPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    session(['owner'])
  })

  test('the missing scheduler is stated on the screen, not implied by a badge', async () => {
    vi.spyOn(api, 'contentCalendar').mockResolvedValue(envelope(calendarPayload([calendarEvent()])) as never)
    renderWithProviders(<ContentCalendarPage />, { route: '/calendar' })
    await waitFor(() => expect(screen.getByText('لا نشر تلقائي')).toBeInTheDocument())
    expect(screen.getByText('لا مُشغِّل دوري ينشر المجدول.')).toBeInTheDocument()
  })

  test('a scheduled event carries the no_scheduler alert on its own card', async () => {
    vi.spyOn(api, 'contentCalendar').mockResolvedValue(envelope(calendarPayload([calendarEvent()])) as never)
    renderWithProviders(<ContentCalendarPage />, { route: '/calendar' })
    await waitFor(() => expect(screen.getByText('مقال مجدول')).toBeInTheDocument())
    expect(screen.getByText(/يحتاج نشرًا يدويًا/)).toBeInTheDocument()
  })

  test('an event the server says cannot be moved shows the reason and no date field', async () => {
    vi.spyOn(api, 'contentCalendar').mockResolvedValue(envelope(calendarPayload([calendarEvent({
      id: 'e1', type: 'episode', title: 'حلقة منشورة', date_kind: 'published', status: 'published',
      admin_route: 'episodes/e1', conflicts: [],
      reschedule: { supported: false, reason: 'التاريخ مشتقّ من حالة الكيان.' },
    })])) as never)
    renderWithProviders(<ContentCalendarPage />, { route: '/calendar' })

    await waitFor(() => expect(screen.getByText('حلقة منشورة')).toBeInTheDocument())
    expect(screen.getByText('التاريخ مشتقّ من حالة الكيان.')).toBeInTheDocument()
    expect(screen.queryByLabelText('نقل إلى')).not.toBeInTheDocument()
  })

  test('the date field calls the route the event declares, not a route the client invents', async () => {
    vi.spyOn(api, 'contentCalendar').mockResolvedValue(envelope(calendarPayload([calendarEvent()])) as never)
    const reschedule = vi.spyOn(api, 'rescheduleCalendarEvent').mockResolvedValue(envelope({}) as never)
    renderWithProviders(<ContentCalendarPage />, { route: '/calendar' })

    await waitFor(() => expect(screen.getByText('مقال مجدول')).toBeInTheDocument())
    const field = screen.getByLabelText('نقل إلى') as HTMLInputElement
    await userEvent.clear(field)
    await userEvent.type(field, '2026-09-02')

    await waitFor(() => expect(reschedule).toHaveBeenCalled())
    const [event, value] = reschedule.mock.calls.at(-1)!
    expect(event.reschedule.route).toBe('/admin/blog/posts/p1')
    expect(event.reschedule.field).toBe('scheduled_at')
    expect(value).toBe('2026-09-02')
  })

  test('a failed move says so and leaves the date alone', async () => {
    vi.spyOn(api, 'contentCalendar').mockResolvedValue(envelope(calendarPayload([calendarEvent()])) as never)
    vi.spyOn(api, 'rescheduleCalendarEvent').mockRejectedValue(new Error('409 conflict'))
    renderWithProviders(<ContentCalendarPage />, { route: '/calendar' })

    await waitFor(() => expect(screen.getByText('مقال مجدول')).toBeInTheDocument())
    const field = screen.getByLabelText('نقل إلى') as HTMLInputElement
    await userEvent.clear(field)
    await userEvent.type(field, '2026-09-02')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('409 conflict'))
  })

  test('conflict chips filter the set they count', async () => {
    vi.spyOn(api, 'contentCalendar').mockResolvedValue(envelope(calendarPayload([
      calendarEvent(),
      calendarEvent({ id: 'p2', title: 'مقال منشور', date_kind: 'published', status: 'published', conflicts: [] }),
    ])) as never)
    renderWithProviders(<ContentCalendarPage />, { route: '/calendar' })

    await waitFor(() => expect(screen.getByText('مقال منشور')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /مجدول بلا مُشغِّل/ }))
    await waitFor(() => expect(screen.queryByText('مقال منشور')).not.toBeInTheDocument())
    expect(screen.getByText('مقال مجدول')).toBeInTheDocument()
  })

  test('the window sent to the server follows the selected view', async () => {
    const calendar = vi.spyOn(api, 'contentCalendar').mockResolvedValue(envelope(calendarPayload([])) as never)
    renderWithProviders(<ContentCalendarPage />, { route: '/calendar' })
    await waitFor(() => expect(calendar).toHaveBeenCalled())

    const monthCall = calendar.mock.calls.at(-1)![0]
    expect(monthCall.from.endsWith('-01')).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'يوم' }))
    await waitFor(() => {
      const dayCall = calendar.mock.calls.at(-1)![0]
      expect(dayCall.from).toBe(dayCall.to)
    })
  })

  test('a failing calendar offers a retry instead of an empty grid', async () => {
    const calendar = vi.spyOn(api, 'contentCalendar').mockRejectedValue(new Error('500 server'))
    renderWithProviders(<ContentCalendarPage />, { route: '/calendar' })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('500 server'))

    calendar.mockResolvedValue(envelope(calendarPayload([calendarEvent()])) as never)
    await userEvent.click(screen.getByRole('button', { name: /إعادة المحاولة/ }))
    await waitFor(() => expect(screen.getByText('مقال مجدول')).toBeInTheDocument())
  })

  test('entities the calendar cannot place are named on the screen', async () => {
    vi.spyOn(api, 'contentCalendar').mockResolvedValue(envelope(calendarPayload([])) as never)
    renderWithProviders(<ContentCalendarPage />, { route: '/calendar' })
    await waitFor(() => expect(screen.getByText('كيانات لا تظهر في التقويم')).toBeInTheDocument())
    const panel = screen.getByText('كيانات لا تظهر في التقويم').closest('section')!
    expect(within(panel).getByText(/campaign —/)).toBeInTheDocument()
  })
})
