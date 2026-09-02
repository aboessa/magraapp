import { describe, expect, test, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, envelope } from './harness'
import { MasteryPage } from '../pages/MasteryPage'
import { api } from '../lib/api'

/**
 * `CNT-109` — تبويب التشخيص يعرض قياسًا لا عناوينه.
 *
 * كانت الخلايا الثلاث تكتب **عناوين الأعمدة مكان قيمها**: «محتوى مرتبط» و«ألعاب
 * قادرة على توليد دليل» و«حالة التشغيل» تتكرّر في كل صفّ. فقارئ الشاشة يستنتج أن لكل
 * هدفٍ محتوًى وألعابًا قادرة — عكسَ ما يوجد التبويب لكشفه.
 *
 * وما يحرسه الاختبار: أن الأعداد المقيسة تظهر، وأن «صفر قادرة» يُقال بالكلمات لا
 * برقمٍ يُقرأ كأنه قياس ناجح، وأن الحالة التي يخطئ فيها عدّ الألعاب المرتبطة
 * (ألعابٌ مرتبطة وصفر قياس) تظهر بوضوح.
 */

const OBJECTIVE = (overrides: Record<string, unknown> = {}) => ({
  id: 'obj-1', code: 'math.count', title_ar: 'العدّ', skill_id: 'sk-1', skill_name: 'الحساب',
  linked_episodes: 0, linked_games: 0, questions_count: 0, evidence_capable_games: 0,
  children_count: 0, independent_count: 0, needs_review_count: 0, not_started_count: 0,
  attempts: 0, correct_attempts: 0, success_rate: null, last_attempt_at: null,
  ...overrides,
})

beforeEach(() => { vi.restoreAllMocks() })

const openDiagnostics = async (rows: Array<Record<string, unknown>>) => {
  vi.spyOn(api, 'masteryByObjective').mockResolvedValue(envelope(rows, rows.length) as never)
  vi.spyOn(api, 'masteryByChild').mockResolvedValue(envelope([]) as never)
  vi.spyOn(api, 'attempts').mockResolvedValue(envelope([]) as never)
  renderWithProviders(<MasteryPage />, { locale: 'ar', route: '/admin/mastery?view=diagnostics' })
}

describe('تشخيص غياب الدليل', () => {
  test('يعرض الأعداد المقيسة لا عناوين الأعمدة', async () => {
    await openDiagnostics([OBJECTIVE({ linked_episodes: 2, linked_games: 3, evidence_capable_games: 1, questions_count: 4 })])
    const row = await waitFor(() => screen.getByText('العدّ').closest('tr')!)
    // 5 = 2 حلقتان + 3 ألعاب مرتبطة.
    expect(within(row).getByText('5')).toBeTruthy()
    expect(within(row).getByText('1')).toBeTruthy()
    expect(within(row).getByText('4 سؤالًا')).toBeTruthy()
    // ولا تتكرّر عناوين الأعمدة كقيم.
    expect(within(row).queryByText('محتوى مرتبط')).toBeNull()
    expect(within(row).queryByText('حالة التشغيل')).toBeNull()
  })

  test('صفر ألعاب قادرة يُقال بالكلمات لا برقم يُقرأ قياسًا', async () => {
    // «0» في خلية تُقرأ كقياسٍ ناجح قيمته صفر؛ والعبارة تقول السبب.
    await openDiagnostics([OBJECTIVE({ linked_games: 3, evidence_capable_games: 0 })])
    const row = await waitFor(() => screen.getByText('العدّ').closest('tr')!)
    expect(within(row).getByText('لا لعبة منشورة على محرّك يقيس الإتقان')).toBeTruthy()
    // والألعاب المرتبطة الثلاث ظاهرة، فيُرى أن العلّة خطأُ ربطٍ لا نقصُ محتوى.
    expect(within(row).getByText('3')).toBeTruthy()
  })

  test('لا أسئلة تُقال بالكلمات أيضًا', async () => {
    await openDiagnostics([OBJECTIVE({ questions_count: 0 })])
    const row = await waitFor(() => screen.getByText('العدّ').closest('tr')!)
    expect(within(row).getByText('لا أسئلة')).toBeTruthy()
  })
})
