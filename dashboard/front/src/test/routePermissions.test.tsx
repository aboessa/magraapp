import { describe, expect, test, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { screen } from '@testing-library/react'
import { renderWithProviders } from './harness'
import { PermissionGate } from '../components/PermissionGate'
import { Sidebar } from '../components/Sidebar'
import { ROUTE_PERMISSIONS, SERVER_PERMISSIONS, permissionForPath } from '../lib/routePermissions'

/**
 * حرس تصاريح المسارات في اللوحة (`ADM-102`).
 *
 * ## ما تحميه هذه الاختبارات
 *
 * **أن الخريطة كاملة**: كل مسار في `AdminRoutes.tsx` له قرارٌ مُعلَن. بلا هذا،
 * المسار التالي الذي يُضاف سيكون مفتوحًا بالسهو لا بالقرار، ولن يُلاحظ لأن غياب
 * الحرس يظهر كشاشة تعمل.
 *
 * **أن الخريطة ليست أوسع من المسارات**: مفتاحٌ لمسار حُذف يعني قاعدةً ميتة تُقرأ
 * كأنها سارية.
 *
 * **أن الأسماء يعرفها الخادم**: اسم صلاحية مخترع يعني حجبًا دائمًا لا يفسّره أحد،
 * لأن لا حساب يملك ما لا يُمنح.
 *
 * **أن التخصيص يفوز**: `stories/:id/builder` لا يُحكَم عليه بقاعدة `stories/:id`.
 *
 * **أن القائمة الجانبية والحرس متّفقان**: كانا قائمتين تُصانان بيدٍ فاختلفا في
 * خمسة مواضع. الاختبار يقيس السلوك المرئي: عنصرٌ محجوب مساره لا يظهر، والمالك يرى.
 */

const SRC = path.resolve(__dirname, '..')

function declaredRoutes(): string[] {
  const source = readFileSync(path.join(SRC, 'AdminRoutes.tsx'), 'utf8')
  return [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])
}

const session = (roles: string[], permissions: string[] = []) => {
  const user = JSON.stringify({
    id: 'u1', email: 'a@b.c', display_name: 'Tester', roles, permissions, must_change_password: false,
  })
  window.localStorage.setItem('majarra-admin-token', 'test-token')
  window.localStorage.setItem('majarra-admin-user', user)
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('خريطة المسار إلى الصلاحية', () => {
  test('كل مسار في AdminRoutes معلَن في الخريطة', () => {
    const missing = declaredRoutes().filter((route) => !(route in ROUTE_PERMISSIONS))
    expect(missing).toEqual([])
  })

  test('لا مفتاح في الخريطة بلا مسار يقابله', () => {
    const routes = new Set(declaredRoutes())
    const orphans = Object.keys(ROUTE_PERMISSIONS).filter((key) => !routes.has(key))
    expect(orphans).toEqual([])
  })

  test('كل صلاحية مطلوبة يعرفها الخادم', () => {
    const known = new Set<string>(SERVER_PERMISSIONS)
    const unknown = Object.entries(ROUTE_PERMISSIONS)
      .filter(([, permission]) => permission !== null && !known.has(permission))
      .map(([route, permission]) => `${route} → ${permission}`)
    expect(unknown).toEqual([])
  })
})

describe('permissionForPath', () => {
  test('المسار الجذر مفتوح', () => {
    expect(permissionForPath('/')).toBeNull()
    expect(permissionForPath('')).toBeNull()
  })

  test('النمط الأكثر حرفيةً يفوز على النمط ذي المعامل', () => {
    // لولا ترجيح المقاطع الحرفية لطابق `plans/:id` مسارَ `blog/posts` طولًا.
    expect(permissionForPath('plans/abc')).toBe('manage_billing')
    expect(permissionForPath('blog/posts')).toBeNull()
  })

  test('يقبل المسار ببادئة مائلة أو بلا', () => {
    expect(permissionForPath('/audit-logs')).toBe('view_audit_log')
    expect(permissionForPath('audit-logs')).toBe('view_audit_log')
  })

  test('مسار غير معروف لا يُحجَب', () => {
    // شاشة بيضاء لخطأ في الخريطة أسوأ من شاشة يحرسها الخادم أصلًا.
    expect(permissionForPath('this/does/not/exist')).toBeNull()
  })
})

describe('PermissionGate', () => {
  test('يعرض شاشة «لا تملك صلاحية» ولا يرسم الصفحة', () => {
    session(['reviewer'], ['edit_text'])
    renderWithProviders(
      <PermissionGate><p>محتوى الفوترة</p></PermissionGate>,
      { route: '/admin/billing' },
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByText('محتوى الفوترة')).toBeNull()
    // الرسالة تسمّي الصلاحية، فيعرف المستخدم ماذا يطلب.
    expect(screen.getByText('manage_billing')).toBeTruthy()
  })

  test('يرسم الصفحة لمن يملك الصلاحية', () => {
    session(['finance'], ['manage_billing'])
    renderWithProviders(
      <PermissionGate><p>محتوى الفوترة</p></PermissionGate>,
      { route: '/admin/billing' },
    )
    expect(screen.getByText('محتوى الفوترة')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('المالك يتجاوز بلا صلاحيات مُعدّدة', () => {
    session(['owner'], [])
    renderWithProviders(
      <PermissionGate><p>سجل التدقيق</p></PermissionGate>,
      { route: '/admin/audit-logs' },
    )
    expect(screen.getByText('سجل التدقيق')).toBeTruthy()
  })

  test('شاشات القراءة مفتوحة لأي حساب مُصادَق', () => {
    session(['reviewer'], [])
    renderWithProviders(
      <PermissionGate><p>قائمة السلاسل</p></PermissionGate>,
      { route: '/admin/series' },
    )
    expect(screen.getByText('قائمة السلاسل')).toBeTruthy()
  })
})

describe('القائمة الجانبية تعكس الصلاحيات', () => {
  test('تُخفي عنصرًا مساره محجوب وتُظهره لمن يملكه', () => {
    session(['reviewer'], [])
    const first = renderWithProviders(<Sidebar />, { locale: 'en', route: '/admin' })
    expect(screen.queryByText('Audit log')).toBeNull()
    first.unmount()

    session(['auditor'], ['view_audit_log'])
    renderWithProviders(<Sidebar />, { locale: 'en', route: '/admin' })
    expect(screen.getByText('Audit log')).toBeTruthy()
  })

  test('المالك يرى العناصر المحجوبة كلها', () => {
    session(['owner'], [])
    renderWithProviders(<Sidebar />, { locale: 'en', route: '/admin' })
    expect(screen.getByText('Audit log')).toBeTruthy()
    expect(screen.getByText('AI providers')).toBeTruthy()
  })
})
