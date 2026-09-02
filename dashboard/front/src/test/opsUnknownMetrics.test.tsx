import { describe, expect, test, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, envelope } from './harness'
import { OpsPage } from '../pages/OpsPage'
import { api } from '../lib/api'

/**
 * `ADM-106` — الشاشة لا تُعيد إنتاج الصفر الذي أزاله الخادم.
 *
 * الخادم صار يُرسل `null` لمقياسٍ تعذّرت قراءته، واسم المسبار الفاشل معه. وكانت
 * الشاشة تكتب `?? 0` على كل عدّاد، فتُترجم «لا نعرف» إلى «لا شيء» — نفس العطل
 * بعد إصلاحه، على بعد طبقة واحدة. إصلاحُ أحد الطرفين وحده لا يُغيّر ما يراه
 * المشغّل، وهو الوحيد الذي يهمّ.
 */

const OVERVIEW = (overrides: Record<string, unknown> = {}) => ({
  overall_health: 'healthy',
  critical_incidents: 0,
  active_alerts: 0,
  failed_queue_events: 0,
  queue_backlog: 0,
  unavailable_probes: [],
  api: { status: 'healthy', checked_at: '2026-08-29T10:00:00Z' },
  d1: { status: 'healthy' },
  telemetry: [],
  business: {},
  generated_at: '2026-08-29T10:00:00Z',
  ...overrides,
})

const stubOps = (data: Record<string, unknown>) => {
  vi.spyOn(api as never as { opsOverview: () => unknown }, 'opsOverview')
    .mockResolvedValue(envelope(data) as never)
  for (const method of ['opsServices', 'opsQueues', 'opsTimeline', 'opsIncidents', 'opsAlerts'] as const) {
    const holder = api as unknown as Record<string, unknown>
    if (typeof holder[method] === 'function') {
      vi.spyOn(api as never as Record<string, () => unknown>, method).mockResolvedValue(envelope([]) as never)
    }
  }
}

beforeEach(() => { vi.restoreAllMocks() })

describe('مركز العمليات: صفرٌ مقيس مقابل قراءةٍ فاشلة', () => {
  test('الصفر المقيس يُعرض صفرًا', async () => {
    stubOps(OVERVIEW())
    renderWithProviders(<OpsPage />, { locale: 'en' })
    await waitFor(() => expect(screen.getByText('Active alerts')).toBeTruthy())
    const card = screen.getByText('Active alerts').closest('.stat-card')
    expect(card?.textContent).toContain('0')
    expect(card?.textContent).not.toContain('Read failed')
  })

  test('القراءة الفاشلة تُعرض شرطةً مع سببها لا صفرًا', async () => {
    stubOps(OVERVIEW({
      active_alerts: null,
      overall_health: 'unknown',
      unavailable_probes: [{ probe: 'ops_alerts', error: 'D1 unavailable' }],
    }))
    renderWithProviders(<OpsPage />, { locale: 'en' })
    await waitFor(() => expect(screen.getByText('Active alerts')).toBeTruthy())
    const card = screen.getByText('Active alerts').closest('.stat-card')
    // الشرطة وحدها تُقرأ «لا شيء»؛ السبب هو ما يجعلها معلومة.
    expect(card?.textContent).toContain('—')
    expect(card?.textContent).toContain('Read failed')
    expect(card?.textContent).not.toContain('0')
  })

  test('الحالة العامّة «غير معروف» لا «سليم» حين يفشل مسبار', async () => {
    stubOps(OVERVIEW({
      critical_incidents: null,
      overall_health: 'unknown',
      unavailable_probes: [{ probe: 'ops_incidents', error: 'D1 unavailable' }],
    }))
    renderWithProviders(<OpsPage />, { locale: 'en' })
    await waitFor(() => expect(screen.getByText('Overall health')).toBeTruthy())
    const card = screen.getByText('Overall health').closest('.stat-card')
    expect(card?.textContent).toContain('Unknown')
    expect(card?.textContent).not.toContain('Healthy')
  })
})
