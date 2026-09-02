import { describe, expect, test, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, envelope } from './harness'
import { RecommendationsPage } from '../pages/RecommendationsPage'
import { TeamAccessPage } from '../pages/TeamAccessPage'
import { RemoteConfigPage } from '../pages/RemoteConfigPage'
import { api } from '../lib/api'

/**
 * الأعطال التي كان `@ts-nocheck` يُخفيها (`ADM-105`).
 *
 * حرس `typeSuppression.test.ts` يمنع عودة التعطيل. وهذا الملف يحرس **ما وجدناه
 * تحته**، فلا يُقاس الإصلاح بأن `tsc` سكت: السكوت هو ما كان قائمًا أصلًا.
 *
 * ثلاثة من أربعة هنا؛ والرابع (`Icon` لا يقبل `style`، واسم أيقونة غير موجود)
 * يحرسه الفحص نفسه بعد رفع التعطيل، فاختبارُه تكرارٌ لما يمنعه المترجم.
 */

const session = () => {
  const user = JSON.stringify({
    id: 'u1', email: 'a@b.c', display_name: 'Owner', roles: ['owner'], permissions: [], must_change_password: false,
  })
  window.localStorage.setItem('majarra-admin-token', 'test-token')
  window.localStorage.setItem('majarra-admin-user', user)
}

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('معاينة التوصيات: مسار ٩–١٢', () => {
  test('اختيار عمر 10 يُظهر مرشَّح الروّاد لا مرشَّحي ٦–٨', async () => {
    vi.spyOn(api, 'recommendations').mockResolvedValue(envelope([]) as never)
    renderWithProviders(<RecommendationsPage />)

    // الافتراضي عمر 7: مرشَّحا ٦–٨ يظهران، ولا شيء للروّاد.
    await waitFor(() => expect(screen.getByText('مغامرات الأرقام')).toBeTruthy())
    expect(screen.queryByText('رحلة الحضارات')).toBeNull()

    const ageSelect = screen.getAllByRole('combobox').find((el) => (el as HTMLSelectElement).value === '7')
    expect(ageSelect).toBeTruthy()
    await userEvent.selectOptions(ageSelect as HTMLElement, '10')

    // كان الشرط `persona.age === '9-12'` — رقمٌ يُقارن بنصّ، فأبدًا غير صحيح،
    // فكان هذا التأكيد يفشل بـ«No candidates for this persona».
    await waitFor(() => expect(screen.getByText('رحلة الحضارات')).toBeTruthy())
    expect(screen.queryByText('مغامرات الأرقام')).toBeNull()
  })
})

describe('الضبط البعيد: فشلٌ غير Error لا يُقرأ نجاحًا', () => {
  test('يعرض رسالة تعذُّر لا صفحةً فارغة', async () => {
    // فشلٌ ليس `Error` (رفضٌ بنصّ) هو ما كان يكشف العطل: `text.loadError` غير
    // موجودة، فتصير `undefined`، فيصير `error` فارغًا، فتُرسَم الصفحة **كأن
    // القراءة نجحت وليس فيها شيء**.
    vi.spyOn(api, 'remoteConfig').mockRejectedValue('boom' as never)
    vi.spyOn(api, 'featureFlags').mockRejectedValue('boom' as never)
    renderWithProviders(<RemoteConfigPage />, { locale: 'en' })
    await waitFor(() => expect(screen.getByText('Could not read remote config')).toBeTruthy())
  })
})

describe('الموظفون والتصاريح: التأكيد بعد الفعل', () => {
  test('سحب الجلسات يعرض تأكيدًا لا صمتًا', async () => {
    session()
    vi.spyOn(api, 'adminUsers').mockResolvedValue(envelope([{
      id: 'u9', email: 'staff@majarra.app', display_name: 'مراجع', roles: ['reviewer'],
      permissions: [], is_active: 1, must_change_password: 0, created_at: null, last_login_at: null,
    }]) as never)
    vi.spyOn(api, 'roles').mockResolvedValue(envelope([]) as never)
    const revoke = vi.spyOn(api, 'revokeAdminUserSessions').mockResolvedValue(envelope({ id: 'u9', revoked: true }) as never)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithProviders(<TeamAccessPage />, { locale: 'en' })
    await waitFor(() => expect(screen.getByText('staff@majarra.app')).toBeTruthy())

    const button = screen.getAllByRole('button').find((el) => /revoke/i.test(el.textContent ?? ''))
    expect(button).toBeTruthy()
    await userEvent.click(button as HTMLElement)

    expect(revoke).toHaveBeenCalledWith('u9')
    // `notice` كان يُكتب ولا يُعرض: المسؤول لا يعرف أن السحب حدث فيُعيده.
    const status = await waitFor(() => screen.getByRole('status'))
    expect(status.textContent ?? '').toMatch(/All sessions .* were revoked/i)
    // ولا رقمَ مُختلَقًا: النقطة تُعيد `revoked: true` بلا عدد.
    expect(status.textContent ?? '').not.toMatch(/\d/)
  })
})
