import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, envelope } from './harness'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { AvailabilityPoliciesPage } from '../pages/AvailabilityPoliciesPage'
import type { AvailabilityListRow } from '../types/api'

/**
 * `ADM-101` — قائمة قيود الإتاحة الجغرافية.
 *
 * ## العلّة
 *
 * `GET /admin/availability` كانت **بلا أي مُستهلِك**: مُنفَّذة في الخادم، ومُعلَنة في
 * `lib/api.ts` باسم `availabilityPolicies`، ولا شاشة تنادِيها.
 *
 * ولوحة الإتاحة لكل عنصر (`AvailabilityPanel`) موجودة وتعمل ومركّبة في خمس مساحات
 * عمل، فسؤال «هل هذه السلسلة ظاهرة في فرنسا؟» له جواب. والذي **لم يكن له جواب** هو
 * المعاكس: «ما المحجوب على المنصّة كلّها، وأين؟» — ومسار التشغيل يرفض بـ451 اعتمادًا
 * على هذا الجدول، فشكوى «الفيديو لا يعمل عندي» لم يكن يمكن ردّها إلى سببها إلا
 * باستعلام D1 بيدٍ.
 */

const row = (overrides: Partial<AvailabilityListRow> = {}): AvailabilityListRow => ({
  id: 'availability-series-s-1',
  entity_type: 'series',
  entity_id: 's-1',
  entity_title: 'مغامرات الأرقام',
  mode: 'worldwide_except',
  countries: ['FR', 'DE'],
  languages: [],
  platforms: [],
  starts_at: null,
  ends_at: null,
  reason: 'rights',
  note: null,
  updated_at: '2026-08-20T10:00:00Z',
  ...overrides,
})

describe('AvailabilityPoliciesPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  test('تقرأ القائمة من النقطة التي كانت بلا مُستهلِك', async () => {
    const list = vi.spyOn(api, 'availabilityPolicies')
      .mockResolvedValue(envelope([row()]) as never)

    renderWithProviders(<AvailabilityPoliciesPage />)

    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(await screen.findByText('مغامرات الأرقام')).toBeInTheDocument()
  });

  test('النمط والسبب بالكلمات لا بالرمز', async () => {
    // `unavailable` و`worldwide` يفترقان في الأثر تمامًا، وقراءة أحدهما مكان الآخر
    // تُنتج بلاغ عطل أو حجبًا لا يلاحظه أحد.
    vi.spyOn(api, 'availabilityPolicies')
      .mockResolvedValue(envelope([row({ mode: 'unavailable', reason: 'legal' })]) as never)

    renderWithProviders(<AvailabilityPoliciesPage />)

    expect(await screen.findByText('غير متاح')).toBeInTheDocument()
    expect(screen.getByText('قانوني')).toBeInTheDocument()
  });

  test('نافذة العرض تُعرض حين توجد، و«دائمًا» حين لا توجد', async () => {
    vi.spyOn(api, 'availabilityPolicies').mockResolvedValue(
      envelope([
        row({ id: 'a-1', entity_id: 's-1' }),
        row({ id: 'a-2', entity_id: 's-2', entity_title: 'سلسلة موقوتة', starts_at: '2026-09-01T00:00:00Z' }),
      ]) as never,
    )

    renderWithProviders(<AvailabilityPoliciesPage />)

    expect(await screen.findByText('دائمًا')).toBeInTheDocument()
    // النطاق داخل الصفّ لا في الصفحة: النصّ التعريفي أعلى الشاشة يحتوي «من» أيضًا،
    // فتأكيدٌ على الصفحة كلّها يمرّ بمطابقة لا تعني شيئًا.
    const timedRow = (await screen.findByText('سلسلة موقوتة')).closest('tr')
    expect(timedRow).not.toBeNull()
    expect(within(timedRow as HTMLElement).getByText(/^من /)).toBeInTheDocument()
  });

  test('كل صفّ يفتح موضع تحريره، لأن الوراثة تُقرأ هناك', async () => {
    // القائمة لا تحرّر عن قصد: قيدٌ يُحرَّر بلا رؤية ما يورثه الأب قرارٌ نصفُ معلوم.
    vi.spyOn(api, 'availabilityPolicies')
      .mockResolvedValue(envelope([row()]) as never)

    renderWithProviders(<AvailabilityPoliciesPage />)

    const link = await screen.findByRole('link', { name: 'فتح' })
    expect(link).toHaveAttribute('href', adminPath('series/s-1'))
  });

  test('الافتراض العام لا يُعرض له رابط، فليس عنصرًا له صفحة', async () => {
    // رابطٌ يؤدّي إلى 404 أسوأ من غيابه.
    vi.spyOn(api, 'availabilityPolicies').mockResolvedValue(
      envelope([row({ id: 'a-global', entity_type: 'global', entity_id: 'global', entity_title: null })]) as never,
    )

    renderWithProviders(<AvailabilityPoliciesPage />)

    await waitFor(() => expect(screen.getByText('global', { selector: 'small' })).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'فتح' })).toBeNull()
  });

  test('قائمة فارغة تُقرأ «لا قيود» لا «تعذّر القراءة»', async () => {
    vi.spyOn(api, 'availabilityPolicies').mockResolvedValue(envelope([]) as never)

    renderWithProviders(<AvailabilityPoliciesPage />)

    expect(await screen.findByText('لا قيود مضبوطة')).toBeInTheDocument()
  });

  test('فشل القراءة يُعرض بزرّ إعادة، ولا يُقرأ قائمةً فارغة', async () => {
    // على شاشة حقوق، «لا قيود» و«تعذّر القراءة» حالتان لا يجوز أن تبدوا واحدة:
    // الأولى تعني أن المحتوى عالميّ، والثانية لا تعني شيئًا.
    const list = vi.spyOn(api, 'availabilityPolicies')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(envelope([row()]) as never)

    renderWithProviders(<AvailabilityPoliciesPage />)

    expect(await screen.findByText(/network down/)).toBeInTheDocument()
    expect(screen.queryByText('لا قيود مضبوطة')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /إعادة|Retry/ }))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('مغامرات الأرقام')).toBeInTheDocument()
  });
});
