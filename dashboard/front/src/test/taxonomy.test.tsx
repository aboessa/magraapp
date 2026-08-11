import { describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaxonomyPage } from '../pages/TaxonomyPage'
import { SeriesPage } from '../pages/SeriesPage'
import { api, ApiError } from '../lib/api'
import { renderWithProviders, envelope } from './harness'
import type { CategoryRecord, Planet } from '../types/api'

/**
 * اختبارات شاشة الكواكب والتصنيفات.
 *
 * ## ما تُثبِّته
 *
 * ١. **حالة التحميل تقول «جارٍ التحميل» لا نصّ الخطأ.** كانت الشاشة تُمرّر
 *    `text.loadError` إلى `LoadingState`، فيقرأ المستخدم «تعذر تحميل الهيكل» في
 *    كل زيارة ناجحة. عيب يظهر دائمًا ولا يُسقط شيئًا، فلا اختبار كان يرصده.
 * ٢. **البطاقة مدخل إلى عمل لا رقم في لوح.** التصنيف يفتح سلاسله مفلترة،
 *    والكوكب يفتح مساحة عمله.
 * ٣. **الفلترة في العنوان**، فرابط «التصنيفات بلا سلاسل» قابل للمشاركة.
 * ٤. **الملخّص يصف المجموعة كلها** لا المفلترة.
 * ٥. **التعطيل يقول عدد السلاسل المرتبطة** قبل التنفيذ.
 * ٦. **‏`?category=` يصل إلى الخادم** من شاشة السلاسل، فالرقم على البطاقة
 *    والقائمة التي يفتحها يتّفقان.
 */

const planet = (over: Partial<Planet> = {}): Planet => ({
  id: 'abjad', name_ar: 'أبجد', name_en: 'Abjad', description_ar: 'حروف وأرقام',
  color_hex: '#FF6B6B', icon_url: null, sort_order: 1, is_active: true,
  series_count: 4, assets_count: 3,
  ...over,
} as Planet)

const category = (over: Partial<CategoryRecord> = {}): CategoryRecord => ({
  id: 'category-adventure', slug: 'adventure', name_ar: 'مغامرة', name_en: 'Adventure',
  description_ar: 'حكايات مغامرة', color_hex: '#4ECDC4', sort_order: 2, is_active: true,
  series_count: 7,
  ...over,
})

function grantAll() {
  window.sessionStorage.setItem('majarra-admin-user', JSON.stringify({
    id: 'u-owner', email: 'owner@majarra.local', display_name: 'مالك',
    roles: ['owner'], permissions: [], must_change_password: false,
  }))
}

function grantNothing() {
  window.sessionStorage.setItem('majarra-admin-user', JSON.stringify({
    id: 'u-view', email: 'viewer@majarra.local', display_name: 'قارئ',
    roles: ['content_creator'], permissions: ['view'], must_change_password: false,
  }))
}

const mount = (route = '/taxonomy') => renderWithProviders(<TaxonomyPage />, { route })

const stub = (planets: Planet[], categories: CategoryRecord[]) => {
  vi.spyOn(api, 'cmsPlanets').mockResolvedValue(envelope(planets) as never)
  vi.spyOn(api, 'categories').mockResolvedValue(envelope(categories) as never)
}

describe('TaxonomyPage', () => {
  test('renders both sections with their real counters', async () => {
    grantAll()
    stub([planet()], [category()])

    mount()

    expect(await screen.findByRole('link', { name: 'أبجد' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'مغامرة' })).toBeInTheDocument()
    // العدّادات من الحمولة لا من طول المصفوفة
    expect(screen.getByText(/٤ سلسلة/)).toBeInTheDocument()
    expect(screen.getByText(/٧ سلسلة/)).toBeInTheDocument()
  })

  test('the loading state says it is loading, not that loading failed', async () => {
    grantAll()
    // نداءان لا يُحلّان أبدًا: تبقى الشاشة في حالة التحميل فتُقرأ تسميتها.
    vi.spyOn(api, 'cmsPlanets').mockReturnValue(new Promise(() => {}) as never)
    vi.spyOn(api, 'categories').mockReturnValue(new Promise(() => {}) as never)

    mount()

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('جارٍ تحميل الهيكل...')
    expect(screen.queryByText('تعذر تحميل الهيكل')).not.toBeInTheDocument()
  })

  test('a category card opens the series filtered by that category', async () => {
    grantAll()
    stub([planet()], [category()])

    mount()

    const link = await screen.findByRole('link', { name: 'مغامرة' })
    expect(link).toHaveAttribute('href', '/iamnotsite/series?category=category-adventure')
  })

  test('a planet card opens its workspace, not an edit dialog', async () => {
    grantAll()
    stub([planet()], [category()])

    mount()

    expect(await screen.findByRole('link', { name: 'أبجد' }))
      .toHaveAttribute('href', '/iamnotsite/planets/abjad')
  })

  test('the summary counts every category while the list shows the filtered subset', async () => {
    grantAll()
    stub([planet()], [
      category(),
      category({ id: 'category-empty', slug: 'empty', name_ar: 'فارغ', series_count: 0 }),
    ])

    mount('/taxonomy?usage=unused')

    // الصفّ المعروض واحد، والملخّص يعدّ الاثنين
    expect(await screen.findByRole('link', { name: 'فارغ' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'مغامرة' })).not.toBeInTheDocument()
    const summary = screen.getByLabelText('الكواكب والتصنيفات')
    expect(within(summary).getByText('٢')).toBeInTheDocument()
  })

  test('a summary metric applies the filter that reproduces it', async () => {
    grantAll()
    stub([planet()], [
      category(),
      category({ id: 'category-empty', slug: 'empty', name_ar: 'فارغ', series_count: 0 }),
    ])
    const user = userEvent.setup()

    mount()
    await screen.findByRole('link', { name: 'مغامرة' })

    const summary = screen.getByLabelText('الكواكب والتصنيفات')
    await user.click(within(summary).getByRole('button', { name: /تصنيف بلا سلاسل/ }))

    // الفلترة تُطبَّق فيُخفى المستخدَم ويبقى غير المستخدَم
    await waitFor(() => expect(screen.queryByRole('link', { name: 'مغامرة' })).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'فارغ' })).toBeInTheDocument()
  })

  test('an empty category list distinguishes "none yet" from "no match"', async () => {
    grantAll()
    stub([planet()], [])

    const bare = mount()
    expect(await screen.findByText('لا تصنيفات بعد')).toBeInTheDocument()
    bare.unmount()

    // القسمان يعرضان حالة «لا مطابق» معًا حين تُخفي الفلترة كليهما، وهو صواب:
    // كلٌّ يشرح فراغه بنفسه. فالتوكيد على العدد لا على وجود نصّ واحد.
    stub([planet()], [category()])
    mount('/taxonomy?usage=unused')
    expect(await screen.findAllByText('لا عنصر يطابق هذه الفلترة')).toHaveLength(2)
  })

  test('a category with no series is named as such rather than showing a bare zero', async () => {
    grantAll()
    stub([], [category({ series_count: 0 })])

    mount()

    expect(await screen.findByText('بلا سلاسل')).toBeInTheDocument()
  })

  test('a missing description is stated, not left as an em dash', async () => {
    grantAll()
    stub([], [category({ description_ar: '   ' })])

    mount()

    // النصّ نفسه تسمية في شريط الملخّص أيضًا، فالتوكيد داخل البطاقة وحدها.
    await screen.findByRole('link', { name: 'مغامرة' })
    const card = screen.getByRole('listitem')
    expect(within(card).getByText('بلا وصف')).toBeInTheDocument()
  })

  test('disabling a category quotes how many series carry the tag', async () => {
    grantAll()
    stub([], [category()])
    const archive = vi.spyOn(api, 'archiveCategory').mockResolvedValue(envelope({ id: 'category-adventure' }) as never)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    mount()
    await screen.findByRole('link', { name: 'مغامرة' })

    await user.click(screen.getByRole('button', { name: /تعطيل: مغامرة/ }))

    await waitFor(() => expect(archive).toHaveBeenCalledWith('category-adventure'))
    expect(confirm.mock.calls[0][0]).toContain('7')
  })

  test('a failed read offers a retry rather than an empty structure', async () => {
    grantAll()
    vi.spyOn(api, 'cmsPlanets').mockRejectedValue(new ApiError('تعذّرت القراءة', 503))
    vi.spyOn(api, 'categories').mockRejectedValue(new ApiError('تعذّرت القراءة', 503))

    mount()

    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّرت القراءة')
    expect(screen.getByRole('button', { name: /إعادة المحاولة|retry/i })).toBeInTheDocument()
  })

  test('a permission refusal is stated, not shown as an empty structure', async () => {
    grantNothing()
    vi.spyOn(api, 'cmsPlanets').mockRejectedValue(new ApiError('لا تملك صلاحية «view»', 403))
    vi.spyOn(api, 'categories').mockRejectedValue(new ApiError('لا تملك صلاحية «view»', 403))

    mount()

    expect(await screen.findByRole('alert')).toHaveTextContent('لا تملك صلاحية')
  })

  test('without the create permission both buttons are disabled and explain why', async () => {
    grantNothing()
    stub([planet()], [category()])

    mount()
    await screen.findByRole('link', { name: 'مغامرة' })

    const create = screen.getByRole('button', { name: /إضافة تصنيف/ })
    expect(create).toBeDisabled()
    expect(create).toHaveAttribute('title', 'الإنشاء يحتاج صلاحية الإنشاء.')
    expect(screen.getByRole('button', { name: /إضافة كوكب/ })).toBeDisabled()
  })

  test('the slug is read-only when editing, because every link is built on it', async () => {
    grantAll()
    stub([], [category()])
    const user = userEvent.setup()

    mount()
    await screen.findByRole('link', { name: 'مغامرة' })

    await user.click(screen.getByRole('button', { name: /تعديل: مغامرة/ }))

    expect(await screen.findByRole('dialog', { name: 'تعديل التصنيف' })).toBeInTheDocument()
    expect(screen.getByLabelText(/المعرّف/)).toBeDisabled()
    expect(screen.getByText(/كل رابط ومرجع مبني عليه/)).toBeInTheDocument()
  })

  test('English renders the English names and labels', async () => {
    grantAll()
    stub([planet()], [category()])

    renderWithProviders(<TaxonomyPage />, { route: '/taxonomy', locale: 'en' })

    expect(await screen.findByRole('link', { name: 'Adventure' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Planets and categories', level: 2 })).toBeInTheDocument()
  })
})

describe('SeriesPage category context', () => {
  test('a category link sends category to the server, not to a client filter', async () => {
    grantAll()
    const spy = vi.spyOn(api, 'series').mockResolvedValue(envelope([], 0) as never)
    vi.spyOn(api, 'planets').mockResolvedValue(envelope([planet()]) as never)
    vi.spyOn(api, 'visualStyles').mockResolvedValue(envelope([]) as never)

    renderWithProviders(<SeriesPage />, { route: '/series?category=category-adventure' })

    await waitFor(() => expect(spy).toHaveBeenCalled())
    const call = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
    expect(call).toMatchObject({ category: 'category-adventure' })
  })

  test('creating a series from inside a planet preselects that planet', async () => {
    grantAll()
    vi.spyOn(api, 'series').mockResolvedValue(envelope([], 0) as never)
    // كوكبان: الأول ليس المطلوب، فلو تجاهل النموذج السياق لاختار الخطأ.
    vi.spyOn(api, 'planets').mockResolvedValue(envelope([
      planet({ id: 'other', name_ar: 'كوكب آخر' }),
      planet({ id: 'abjad', name_ar: 'أبجد' }),
    ]) as never)
    vi.spyOn(api, 'visualStyles').mockResolvedValue(envelope([]) as never)

    renderWithProviders(<SeriesPage />, { route: '/series?planet=abjad&new=1' })

    // ‏`?new=1` يفتح النموذج، و`?planet=` يختار الكوكب الذي جاء منه المستخدم.
    const select = await screen.findByLabelText(/الكوكب \*/)
    await waitFor(() => expect(select).toHaveValue('abjad'))
  })
})
