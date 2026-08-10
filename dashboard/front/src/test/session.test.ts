import { beforeEach, describe, expect, test, vi } from 'vitest'
import { clearAdminSession, verifySession } from '../lib/adminSession'

/**
 * اختبارات صمود الجلسة.
 *
 * ## المشكلة التي رصدها أول تشغيل حقيقي في المتصفح
 *
 * كان أي ردّ غير ناجح من `/admin/auth/me` يُعدّ «خارج الجلسة»، فتُمسح الجلسة
 * وتُعرض شاشة الدخول. وحصّة الإدارة كانت ثلاثين طلبًا في الدقيقة، وكل شاشة تُصدر
 * بين ثلاثة وسبعة نداءات — فبعد ست شاشات يردّ الخادم 429، ويجد المسؤول نفسه على
 * شاشة الدخول في منتصف تحرير صفحة، وكل ما لم يُحفظ يضيع.
 *
 * 429 و5xx حالتا «لا أعرف»، و401/403 وحدهما حالة «لم تعد مصرَّحًا». هذه
 * الاختبارات تُثبّت الفرق حتى لا يعود.
 */

const TOKEN_KEY = 'majarra-admin-token'
const USER_KEY = 'majarra-admin-user'

const USER = {
  id: 'admin-1',
  email: 'owner@majarra.local',
  display_name: 'مالك',
  roles: ['owner'],
  permissions: [],
  must_change_password: false,
}

function seedSession() {
  window.sessionStorage.setItem(TOKEN_KEY, 'token-abc')
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(USER))
}

const response = (status: number, body: unknown = {}) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
} as Response)

beforeEach(() => {
  clearAdminSession()
  vi.restoreAllMocks()
})

describe('verifySession', () => {
  test('a valid session returns the user and refreshes the stored copy', async () => {
    seedSession()
    vi.stubGlobal('fetch', vi.fn(() => response(200, { data: { user: { ...USER, roles: ['owner', 'system_admin'] } } })))
    const user = await verifySession()
    expect(user?.roles).toContain('system_admin')
    expect(JSON.parse(window.sessionStorage.getItem(USER_KEY) ?? '{}').roles).toContain('system_admin')
  })

  test('a 401 clears the session, because the token is genuinely no longer valid', async () => {
    seedSession()
    vi.stubGlobal('fetch', vi.fn(() => response(401, { error: 'Unauthorized' })))
    expect(await verifySession()).toBeNull()
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  test('a 403 clears the session', async () => {
    seedSession()
    vi.stubGlobal('fetch', vi.fn(() => response(403, { error: 'Account disabled' })))
    expect(await verifySession()).toBeNull()
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  test('a 429 keeps the session: being throttled is not being signed out', async () => {
    seedSession()
    vi.stubGlobal('fetch', vi.fn(() => response(429, { error: 'Too many requests' })))
    const user = await verifySession()
    expect(user?.id).toBe('admin-1')
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('token-abc')
  })

  test('a 500 keeps the session', async () => {
    seedSession()
    vi.stubGlobal('fetch', vi.fn(() => response(500, { error: 'Internal server error' })))
    expect((await verifySession())?.id).toBe('admin-1')
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('token-abc')
  })

  test('a network failure keeps the session', async () => {
    seedSession()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    expect((await verifySession())?.id).toBe('admin-1')
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('token-abc')
  })

  test('no stored token means signed out without calling the server', async () => {
    const fetchMock = vi.fn(() => response(200))
    vi.stubGlobal('fetch', fetchMock)
    expect(await verifySession()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
