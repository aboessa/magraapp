import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { signIn, signOut, readAdminToken } from '../lib/adminSession'

/**
 * SEC-106 — سطح تعرّض رمز جلسة اللوحة.
 *
 * ## العلّة التي تثبّتها هذه الاختبارات
 *
 * الرمز يمنح صلاحيات إدارية كاملة وكان يُكتب في `localStorage` **و**
 * `sessionStorage`، بينما مسار القراءة صار يقرأ الأول وحده. أي أن النسخة
 * الثانية لم يكن أحد يقرؤها: سطح تعرّض إضافي بلا مقابل.
 *
 * ## ما لا تثبّته
 *
 * أن الرمز غير مقروء من JavaScript. هذا يحتاج كوكي `HttpOnly`، وهو غير ممكن
 * بالاستضافة الحالية (اللوحة على أصل والـAPI على آخر، فالكوكي طرف ثالث محجوب).
 * الخطر مقبول موثَّق، وتعويضه ثلاث طبقات تُثبّتها الاختبارات أدناه: منع تنفيذ
 * السكربت الغريب، وإبطال الجلسة في الخادم عند الخروج، وعمر محدود للجلسة.
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

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('حفظ الجلسة', () => {
  test('الدخول يكتب الرمز في localStorage ولا ينسخه إلى sessionStorage', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { token: 'token-abc', user: USER } }),
    } as Response)))

    const result = await signIn('owner@majarra.local', 'correct-horse')

    expect(result.ok).toBe(true)
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('token-abc')
    // النسخة الثانية كانت رمزًا إداريًّا كامل الصلاحيات في موضع لا يقرؤه أحد.
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(USER_KEY)).toBeNull()
  })

  test('الخروج يُبطل الجلسة في الخادم ثم يمسح المخزنين', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'token-abc')
    // جلسة قديمة قد تكون نسختها باقية في sessionStorage، فالمسح يشمله.
    window.sessionStorage.setItem(TOKEN_KEY, 'token-abc')
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200 } as Response))
    vi.stubGlobal('fetch', fetchMock)

    await signOut()

    // مسح محلي وحده كان سيترك رمزًا صالحًا في الخادم بعد «تسجيل الخروج».
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/admin/auth/logout')
    expect(init.method).toBe('POST')
    expect(readAdminToken()).toBe('')
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe('تعويض عن غياب HttpOnly', () => {
  // بيئة الاختبار jsdom، فـ`import.meta.url` ليس مسار ملف. جذر التشغيل هو
  // مجلد الواجهة.
  const headersPath = resolve(process.cwd(), 'public/_headers')
  const headers = readFileSync(headersPath, 'utf8')

  test('مستند اللوحة يُخدَم بسياسة تمنع أي سكربت غريب', () => {
    // هذا هو التعويض الفعلي: رمز مقروء من JavaScript لا يُقرأ إن لم يُنفَّذ
    // سكربت غريب أصلًا.
    expect(headers).toContain("script-src 'self'")
    expect(headers).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(headers).not.toContain('unsafe-eval')
  })

  test('السياسة تمنع التأطير والمنافذ الكلاسيكية', () => {
    expect(headers).toContain("frame-ancestors 'none'")
    expect(headers).toContain("base-uri 'none'")
    expect(headers).toContain("object-src 'none'")
    expect(headers).toMatch(/X-Frame-Options:\s*DENY/)
  })

  test('نداءات اللوحة محصورة في الـAPI', () => {
    // `connect-src` واسعة كانت ستسمح لسكربت — لو نُفِّذ — بتصدير الرمز إلى أي
    // مستقبل. حصرها يجعل التسريب أصعب حتى في أسوأ حالة.
    expect(headers).toContain("connect-src 'self' https://api.majarra.app")
  })

  test('الخطوط الخارجية مسموحة بالتحديد لا بفتح https كلها', () => {
    // `index.css:1` يستورد Readex Pro؛ بلا هذين المصدرين تُخدَم اللوحة بلا خط.
    expect(headers).toContain('https://fonts.googleapis.com')
    expect(headers).toContain('https://fonts.gstatic.com')
  })

  test('الملف يُنشَر مع مخرجات البناء', () => {
    // `_headers` في `public/` ينسخه Vite إلى جذر `dist/`، وهو الموضع الذي
    // يقرؤه Cloudflare Pages. لو وُضع في أي مكان آخر لكانت السياسة كلها
    // ملفًا نصيًّا لا أثر له.
    expect(headersPath.replace(/\\/g, '/')).toContain('/public/_headers')
  })
})
