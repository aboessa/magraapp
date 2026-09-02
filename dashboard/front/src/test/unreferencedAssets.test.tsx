import { describe, expect, test, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, envelope } from './harness'
import { MediaLibraryPage } from '../pages/MediaLibraryPage'
import { api } from '../lib/api'

/**
 * `CNT-104` — قسم «أصول لا يشير إليها شيء» في مكتبة الوسائط.
 *
 * نقطةٌ بلا مُستهلِك هي `ADM-101` بثوب آخر، فالتقرير له شاشة. وما تحرسه هذه
 * الاختبارات هو **الصدق في العرض**: أن عدد مسارات الربط المفحوصة معروض (تقريرٌ لا
 * تُرى تغطيته لا يُوثَق به)، وأن فشل الفحص لا يُقرأ «لا يتيم»، وأنه لا يُنفَّذ إلا
 * بطلب لأنه أثقل من قراءة.
 */

const STATS = () => envelope({
  by_status: [{ status: 'ready', count: 3 }],
  by_kind: [{ kind: 'audio', count: 14 }],
  storage: { ready_count: 3, total_bytes: 1024 },
})

const stubPage = () => {
  vi.spyOn(api, 'assets').mockResolvedValue(envelope([], 0) as never)
  vi.spyOn(api, 'assetStats').mockResolvedValue(STATS() as never)
}

const REPORT = (overrides: Record<string, unknown> = {}) => ({
  total: 0,
  by_kind: [],
  assets: [],
  checked_paths: [{ table: 'asset_links', column: 'asset_id' }],
  include_archived: false,
  limit: 200,
  ...overrides,
})

beforeEach(() => { vi.restoreAllMocks() })

describe('أصول لا يشير إليها شيء', () => {
  test('لا يُفحص إلا بطلب', async () => {
    stubPage()
    const spy = vi.spyOn(api, 'unreferencedAssets').mockResolvedValue(envelope(REPORT()) as never)
    renderWithProviders(<MediaLibraryPage />, { locale: 'en' })
    await waitFor(() => expect(screen.getByText('Assets nothing points at')).toBeTruthy())
    expect(spy).not.toHaveBeenCalled()
  })

  test('العدد يُعرض ومعه عدد مسارات الربط المفحوصة', async () => {
    stubPage()
    vi.spyOn(api, 'unreferencedAssets').mockResolvedValue(envelope(REPORT({
      total: 101,
      by_kind: [
        { kind: 'image', count: 87, bytes: 1000 },
        { kind: 'audio', count: 14, bytes: 500 },
      ],
      checked_paths: Array.from({ length: 16 }, (_, i) => ({ table: `t${i}`, column: 'asset_id' })),
    })) as never)
    renderWithProviders(<MediaLibraryPage />, { locale: 'en' })
    await userEvent.click(await screen.findByRole('button', { name: /^check$/i }))

    await waitFor(() => expect(screen.getByText(/101 asset\(s\) nothing points at/i)).toBeTruthy())
    // التغطية معروضة: «فُحص مسارٌ واحد» و«فُحص ستة عشر» تقريران مختلفان تمامًا.
    expect(screen.getByText(/16 reference path\(s\) checked/i)).toBeTruthy()
    expect(screen.getByText('87')).toBeTruthy()
    expect(screen.getByText('14')).toBeTruthy()
  })

  test('صفرٌ يُعرض «لا أصل يتيم» ومعه التغطية أيضًا', async () => {
    stubPage()
    vi.spyOn(api, 'unreferencedAssets').mockResolvedValue(envelope(REPORT()) as never)
    renderWithProviders(<MediaLibraryPage />, { locale: 'en' })
    await userEvent.click(await screen.findByRole('button', { name: /^check$/i }))
    await waitFor(() => expect(screen.getByText(/No unreferenced assets/i)).toBeTruthy())
    expect(screen.getByText(/1 reference path\(s\) checked/i)).toBeTruthy()
  })

  test('فشل الفحص لا يُعرض «لا أصل يتيم»', async () => {
    stubPage()
    vi.spyOn(api, 'unreferencedAssets').mockRejectedValue(new Error('500 upstream'))
    renderWithProviders(<MediaLibraryPage />, { locale: 'en' })
    await userEvent.click(await screen.findByRole('button', { name: /^check$/i }))
    await waitFor(() => expect(screen.getByText('500 upstream')).toBeTruthy())
    expect(screen.queryByText(/No unreferenced assets/i)).toBeNull()
  })
})
