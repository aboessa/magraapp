import { describe, expect, test, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, envelope } from './harness'
import { QualityPage } from '../pages/QualityPage'
import { api } from '../lib/api'

/**
 * `CNT-101` و`CNT-102` — لوحة مسح البوابة على دفعة.
 *
 * الشاشة كانت تفحص **عيّنة** من كل نوع أيًّا كانت حالتها. والسؤالان التشغيليّان — ما
 * هو **حيّ** ومعطوب، وما ينتظر النشر وما ينقصه — لم يكن لهما جواب إلا بطلبٍ لكل صفّ.
 *
 * وما تحرسه هذه الاختبارات ليس وجود الجدول، بل **الفرق بين الحالات**: لا شيء محجوب
 * (مع عدد المفحوص)، ومحجوبٌ مسمّى بحاجبه، وفشلُ فحصٍ لا يُقرأ «لا شيء محجوب»، وأن
 * تغيير الحالة يغيّر السؤال المطروح على الخادم لا شكل الجدول.
 */

const EMPTY_LISTS = () => {
  for (const method of ['series', 'stories', 'episodes', 'books', 'games', 'projects'] as const) {
    vi.spyOn(api, method).mockResolvedValue(envelope([]) as never)
  }
}

const REPORT = (overrides: Record<string, unknown> = {}) => ({
  status: 'published',
  checked: {},
  blocked_count: 0,
  blocked: [],
  warned_count: 0,
  warned: [],
  unavailable: [],
  limit: 100,
  ...overrides,
})

beforeEach(() => { vi.restoreAllMocks() })

describe('مسح البوابة', () => {
  test('لا يُفحص إلا بطلب: أثقل من قراءة، فلا يُحمَّل مع الشاشة', async () => {
    EMPTY_LISTS()
    const spy = vi.spyOn(api, 'publishSweep').mockResolvedValue(envelope(REPORT()) as never)
    renderWithProviders(<QualityPage />, { locale: 'en' })
    await waitFor(() => expect(screen.getByText('Sweep the gate over a batch')).toBeTruthy())
    expect(spy).not.toHaveBeenCalled()
  })

  test('لا شيء محجوب يُعرض مع عدد المفحوص لا كجملة مجرّدة', async () => {
    EMPTY_LISTS()
    vi.spyOn(api, 'publishSweep').mockResolvedValue(
      envelope(REPORT({ checked: { episode: 12, series: 3 } })) as never,
    )
    renderWithProviders(<QualityPage />, { locale: 'en' })
    await userEvent.click(await screen.findByRole('button', { name: /sweep batch/i }))
    // 15 = 12 + 3: «فحصتُ خمسة عشر» يختلف عن «لم أجد شيئًا».
    await waitFor(() => expect(screen.getByText(/15 published row\(s\) checked/i)).toBeTruthy())
  })

  test('الصفّ المحجوب يُسمّى ومعه ما يحجبه', async () => {
    EMPTY_LISTS()
    vi.spyOn(api, 'publishSweep').mockResolvedValue(envelope(REPORT({
      checked: { episode: 20 },
      blocked_count: 1,
      blocked: [{
        entity_type: 'episode',
        entity_id: 'ep-7',
        blockers: [{ id: 'video', label_ar: 'ملف الفيديو', label_en: 'Video file', status: 'blocked', severity: 'blocker', owner: 'production', detail_ar: '', detail_en: '' }],
      }],
    })) as never)
    renderWithProviders(<QualityPage />, { locale: 'en' })
    await userEvent.click(await screen.findByRole('button', { name: /sweep batch/i }))
    await waitFor(() => expect(screen.getByText(/1 published row\(s\) fail the gate today/i)).toBeTruthy())
    expect(screen.getByText('ep-7')).toBeTruthy()
    expect(screen.getByText('ملف الفيديو')).toBeTruthy()
  })

  test('تغيير الحالة يسأل الخادم سؤالًا آخر ويشرحه شرحًا آخر', async () => {
    EMPTY_LISTS()
    const spy = vi.spyOn(api, 'publishSweep').mockResolvedValue(
      envelope(REPORT({ status: 'ready', checked: { story: 12 } })) as never,
    )
    renderWithProviders(<QualityPage />, { locale: 'en' })
    // الشرح يتبع السؤال: «حيّ ومعطوب» ليس «ينتظر النشر».
    expect(screen.getByText(/never again/i)).toBeTruthy()
    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'ready')
    expect(screen.getByText(/editor queue/i)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /sweep batch/i }))
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }))
    // ولا يقول «لا انحراف» عن صفوف لم تُنشر: الجملة تتبع الحالة.
    await waitFor(() => expect(screen.getByText(/12 row\(s\) checked and nothing blocks them/i)).toBeTruthy())
  })

  test('تقرير القصة يقول كم وأين، لا اسم الفحص وحده', async () => {
    // `CNT-103`: «رسوم الصفحات» نصفُ تقرير. البوابة تُعيد العدد والمواضع، وكانت
    // تُلقى في العرض — فيبقى المحرِّر بلا خطوةٍ تالية.
    EMPTY_LISTS()
    vi.spyOn(api, 'publishSweep').mockResolvedValue(envelope(REPORT({
      status: 'ready',
      checked: { story: 12 },
      blocked_count: 1,
      blocked: [{
        entity_type: 'story',
        entity_id: 'story-1',
        blockers: [{
          id: 'page_images', label_ar: 'رسوم الصفحات', label_en: 'Page artwork',
          status: 'blocked', severity: 'blocker', owner: 'production',
          detail: '178 صفحة بلا رسم و0 صفحة رسمها غير جاهز.',
          items: Array.from({ length: 178 }, (_, i) => `صفحة ${i + 1}: بلا رسم`),
        }],
      }],
    })) as never)
    renderWithProviders(<QualityPage />, { locale: 'en' })
    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'ready')
    await userEvent.click(screen.getByRole('button', { name: /sweep batch/i }))

    await waitFor(() => expect(screen.getByText('رسوم الصفحات')).toBeTruthy())
    expect(screen.getByText(/178 صفحة بلا رسم/)).toBeTruthy()
    // أوّل المواضع معروضة بالاسم…
    expect(screen.getByText(/صفحة 1: بلا رسم/)).toBeTruthy()
    // …والباقي بعددٍ صريح: «وغيرها» تُخفي الفرق بين موضعين ومئة وسبعين.
    expect(screen.getByText(/and 170 more/i)).toBeTruthy()
  })

  test('التحذير يُعرض ولا يُدرَج مع المحجوب', async () => {
    // `CNT-107`: البوابة تُحذِّر على مراجعةٍ معلّقة ولا تحجب (بقرارٍ موثَّق)، فكان
    // المنشور بلا اعتماد يظهر «لا شيء محجوب». والتحذير يُعرض منفصلًا: طيُّه في
    // المحجوب يسمّيه رفضًا، وإسقاطه يجعل التحذير المُتجاهَل غير مرئي.
    EMPTY_LISTS()
    vi.spyOn(api, 'publishSweep').mockResolvedValue(envelope(REPORT({
      checked: { series: 24 },
      blocked_count: 0,
      blocked: [],
      warned_count: 1,
      warned: [{
        entity_type: 'series',
        entity_id: 'series-1',
        warnings: [{ id: 'review_edu', label_ar: 'المراجعة التربوية', label_en: 'Educational review', status: 'warn', severity: 'warning', owner: 'reviewer', detail: 'لا سجلّ مراجعة لهذا الدور.', detail_ar: '', detail_en: '' }],
      }],
    })) as never)
    renderWithProviders(<QualityPage />, { locale: 'en' })
    await userEvent.click(await screen.findByRole('button', { name: /sweep batch/i }))

    // «لا شيء محجوب» يبقى صحيحًا…
    await waitFor(() => expect(screen.getByText(/24 published row\(s\) checked/i)).toBeTruthy())
    // …والتحذير المُتجاهَل يظهر، بعبارة «يمرّ» لا «سليم».
    expect(screen.getByText(/1 row\(s\) pass the gate carrying a warning/i)).toBeTruthy()
    expect(screen.getByText('المراجعة التربوية')).toBeTruthy()
  })

  test('صفٌّ تعذّر تقييمه يُعرض «غير معروف» ولا يُطوى', async () => {
    EMPTY_LISTS()
    vi.spyOn(api, 'publishSweep').mockResolvedValue(envelope(REPORT({
      checked: { episode: 5 },
      unavailable: [{ entity_type: 'episode', error: 'D1 unavailable' }],
    })) as never)
    renderWithProviders(<QualityPage />, { locale: 'en' })
    await userEvent.click(await screen.findByRole('button', { name: /sweep batch/i }))
    await waitFor(() => expect(screen.getByText(/1 row\(s\) could not be evaluated/i)).toBeTruthy())
  })

  test('فشل الفحص لا يُعرض «لا شيء محجوب»', async () => {
    EMPTY_LISTS()
    vi.spyOn(api, 'publishSweep').mockRejectedValue(new Error('500 upstream'))
    renderWithProviders(<QualityPage />, { locale: 'en' })
    await userEvent.click(await screen.findByRole('button', { name: /sweep batch/i }))
    await waitFor(() => expect(screen.getByText('500 upstream')).toBeTruthy())
    expect(screen.queryByText(/pass the gate today/i)).toBeNull()
  })
})
