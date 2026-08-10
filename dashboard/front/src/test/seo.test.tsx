import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './harness'

/**
 * اختبارات واجهة SEO.
 *
 * ## الادّعاء الذي تحرسه
 *
 * التدقيق الداخلي يُثبت ما في قاعدة البيانات. حالة الفهرسة في محرّكات البحث
 * **غير معروفة**. الشاشة ملزمة بإظهار الفصل: «صفر أخطاء» في لوحة موحّدة تُقرأ
 * كـ«الموقع مفهرس» — وهي جملة لا سند لها هنا. والفحص غير المُنفَّذ يُعرض بالاسم،
 * لأن إخفاءه يُنتج ثقة بلا أساس.
 */

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    seoAudit: vi.fn(),
    seoRedirects: vi.fn(),
    createSeoRedirect: vi.fn(),
    deleteSeoRedirect: vi.fn(),
    seoMeta: vi.fn(),
    saveSeoMeta: vi.fn(),
    assets: vi.fn(),
    assetBlob: vi.fn(),
  },
}))

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, api: apiMock }
})

const { SeoOperationsPage } = await import('../pages/SeoOperationsPage')
const { SeoEditor } = await import('../components/SeoEditor')
const { ApiError } = await import('../lib/api')
const { adminPath } = await import('../lib/adminPath')

const AUDIT = {
  issues: [
    { id: 'missing_title', severity: 'error', entity_type: 'web_page', entity_id: 'p1', path: '/ar/plans', detail: 'لا عنوان SEO؛ ستستخدم نتيجة البحث عنوان الصفحة الخام.' },
    { id: 'missing_title', severity: 'error', entity_type: 'blog_post', entity_id: 'b1', path: '/ar/blog/x', detail: 'لا عنوان SEO؛ ستستخدم نتيجة البحث عنوان الصفحة الخام.' },
    { id: 'orphan_page', severity: 'warning', entity_type: 'web_page', entity_id: 'p2', path: '/ar/help', detail: 'صفحة منشورة لا يشير إليها أي رابط داخلي.' },
  ],
  summary: { errors: 2, warnings: 1, audited_pages: 19, audited_posts: 3, redirects: 1 },
  sitemap: { generated_on_request: true, included_urls: 22, excluded_unpublished: 5, noindex_published: 0 },
  coverage: [
    { id: 'missing_title', implemented: true, note: null },
    { id: 'index_status', implemented: false, note: 'حالة الفهرسة تحتاج تكامل Search Console. غير مُهيَّأ.' },
    { id: 'external_link_broken', implemented: false, note: 'يحتاج زحفًا شبكيًا.' },
  ],
  source: 'internal_audit',
  index_status_available: false,
  index_status_note: 'هذا تدقيق داخلي على قاعدة البيانات فقط. حالة الفهرسة الفعلية غير متاحة: لا تكامل مع Search Console.',
}

const REDIRECTS = [
  { id: 'r1', from_path: '/ar/old', to_path: '/ar/plans', status_code: 301, reason: 'slug change', created_at: '2026-08-01T00:00:00.000Z', created_by_name: 'محرِّر' },
]

beforeEach(() => {
  apiMock.seoAudit.mockResolvedValue({ success: true, data: AUDIT })
  apiMock.seoRedirects.mockResolvedValue({ success: true, data: REDIRECTS, meta: { total: 1 } })
  apiMock.seoMeta.mockResolvedValue({
    success: true,
    data: {
      entity_type: 'web_page',
      entity_id: 'p1',
      seo: null,
      guidance: { title_max: 60, description_min: 70, description_max: 160 },
    },
  })
  apiMock.assets.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
})

describe('SeoOperationsPage', () => {
  test('the internal-audit source and the missing index status are on screen', async () => {
    renderWithProviders(<SeoOperationsPage />, { route: adminPath('seo') })
    expect(await screen.findByText('internal_audit')).toBeInTheDocument()
    expect(screen.getByText(/لا تكامل مع Search Console/)).toBeInTheDocument()
  })

  test('external indexing is a separate tab that states it is unavailable', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SeoOperationsPage />, { route: adminPath('seo') })
    await user.click(await screen.findByRole('tab', { name: /الفهرسة الخارجية/ }))
    expect(screen.getByRole('heading', { level: 3, name: /غير متاحة/ })).toBeInTheDocument()
    // ولا رقم واحد يُعرض هناك: عدّاد فهرسة مُختلق يُبنى عليه قرار تسويقي.
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).queryByText(/^\d+$/)).toBeNull()
  })

  test('the coverage tab names every check that is not implemented, with a reason', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SeoOperationsPage />, { route: adminPath('seo') })
    await user.click(await screen.findByRole('tab', { name: /تغطية الفحوص/ }))
    expect(screen.getByText('index_status')).toBeInTheDocument()
    expect(screen.getByText('external_link_broken')).toBeInTheDocument()
    expect(screen.getAllByText('غير مُنفَّذ')).toHaveLength(2)
  })

  test('issues are grouped by check and the group filters the table', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SeoOperationsPage />, { route: adminPath('seo') })
    const chip = await screen.findByRole('button', { name: /missing_title/ })
    expect(chip).toHaveTextContent('2')

    await user.click(chip)
    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // رأس + صفّان من نفس الفحص
      expect(rows).toHaveLength(3)
    })
  })

  test('the check filter is read from the URL, so a dashboard card can link straight to it', async () => {
    renderWithProviders(<SeoOperationsPage />, { route: `${adminPath('seo')}?check=orphan_page` })
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2))
    expect(screen.getByText(/صفحة منشورة لا يشير إليها/)).toBeInTheDocument()
  })

  test('every page or post issue links to the editor that fixes it', async () => {
    renderWithProviders(<SeoOperationsPage />, { route: `${adminPath('seo')}?check=missing_title` })
    const links = await screen.findAllByRole('link', { name: 'فتح' })
    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain(adminPath('website/pages/p1'))
    expect(hrefs).toContain(adminPath('blog/posts/b1'))
  })

  test('a clean audit says the database is clean, not that the site is indexed', async () => {
    apiMock.seoAudit.mockResolvedValue({
      success: true,
      data: { ...AUDIT, issues: [], summary: { ...AUDIT.summary, errors: 0, warnings: 0 } },
    })
    renderWithProviders(<SeoOperationsPage />, { route: adminPath('seo') })
    expect(await screen.findByText('لا مشاكل في التدقيق الداخلي')).toBeInTheDocument()
    expect(screen.getByText(/لا يعني أن الموقع مفهرس/)).toBeInTheDocument()
  })

  test('the sitemap reports counts and no fabricated generation date', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SeoOperationsPage />, { route: adminPath('seo') })
    await user.click(await screen.findByRole('tab', { name: /خريطة الموقع/ }))
    expect(screen.getByText('22')).toBeInTheDocument()
    expect(screen.getByText(/تُولَّد عند كل طلب/)).toBeInTheDocument()
  })

  test('a redirect refused by the server shows the server reason', async () => {
    const user = userEvent.setup()
    apiMock.createSeoRedirect.mockRejectedValueOnce(new ApiError('A published page already serves that path', 409))
    renderWithProviders(<SeoOperationsPage />, { route: adminPath('seo') })
    await user.click(await screen.findByRole('tab', { name: /التحويلات/ }))
    await user.click(screen.getByRole('button', { name: /تحويل جديد/ }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^من/), '/ar/plans')
    await user.type(within(dialog).getByLabelText(/^إلى/), '/ar/other')
    await user.click(within(dialog).getByRole('button', { name: 'إنشاء' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A published page already serves that path')
  })

  test('deleting a redirect is confirmed and states the consequence', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SeoOperationsPage />, { route: adminPath('seo') })
    await user.click(await screen.findByRole('tab', { name: /التحويلات/ }))
    await user.click(screen.getByRole('button', { name: 'حذف' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/الروابط القديمة ستعود إلى 404/)).toBeInTheDocument()
    expect(apiMock.deleteSeoRedirect).not.toHaveBeenCalled()
  })

  test('a failed audit is an error state with a retry', async () => {
    apiMock.seoAudit.mockRejectedValueOnce(new ApiError('audit failed', 500))
    renderWithProviders(<SeoOperationsPage />, { route: adminPath('seo') })
    expect(await screen.findByRole('alert')).toHaveTextContent('audit failed')
  })
})

describe('SeoEditor', () => {
  const renderEditor = () => renderWithProviders(
    <SeoEditor entityType="web_page" entityId="p1" path="/ar/plans" language="ar" translations={[]} redirects={REDIRECTS} />,
    { route: adminPath('website/pages/p1') },
  )

  test('the length limits come from the server, not from the screen', async () => {
    const user = userEvent.setup()
    apiMock.seoMeta.mockResolvedValue({
      success: true,
      data: { entity_type: 'web_page', entity_id: 'p1', seo: null, guidance: { title_max: 42, description_min: 10, description_max: 90 } },
    })
    renderEditor()
    await user.type(await screen.findByLabelText('عنوان SEO'), 'عنوان')
    expect(screen.getByText(/\/ 42/)).toBeInTheDocument()
  })

  test('an over-length title warns rather than blocking, because the server treats it as a warning', async () => {
    const user = userEvent.setup()
    renderEditor()
    const title = await screen.findByLabelText('عنوان SEO')
    await user.type(title, 'ا'.repeat(70))
    expect(screen.getByText(/أطول من حدّ العرض/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /حفظ SEO/ })).toBeEnabled()
  })

  test('invalid JSON-LD blocks the save, because the server rejects it', async () => {
    const user = userEvent.setup()
    renderEditor()
    // paste لا type: `type` يقرأ `{` كواصف مفتاح، وهذا الحقل يحتوي JSON.
    await user.click(await screen.findByLabelText(/البيانات المهيكلة/))
    await user.paste('{not json')
    expect(screen.getByText('JSON غير صالح')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /حفظ SEO/ })).toBeDisabled()
  })

  test('valid JSON-LD reports the declared types', async () => {
    const user = userEvent.setup()
    renderEditor()
    await user.click(await screen.findByLabelText(/البيانات المهيكلة/))
    await user.paste('[{"@type":"FAQPage"}]')
    expect(await screen.findByText(/الأنواع المُعلَنة: FAQPage/)).toBeInTheDocument()
  })

  test('noindex is called out on screen, since it silently removes the page from search', async () => {
    const user = userEvent.setup()
    renderEditor()
    await user.click(await screen.findByRole('checkbox', { name: /قابلة للفهرسة/ }))
    expect(screen.getByText(/لن تظهر في نتائج البحث/)).toBeInTheDocument()
  })

  test('server warnings are shown after a save instead of a bare success', async () => {
    const user = userEvent.setup()
    apiMock.saveSeoMeta.mockResolvedValue({
      success: true,
      data: { entity_type: 'web_page', entity_id: 'p1', warnings: ['الوصف 40 حرفًا؛ أقل من 70 يضيّع مساحة نتيجة البحث.'] },
    })
    renderEditor()
    await user.click(await screen.findByRole('button', { name: /حفظ SEO/ }))
    expect(await screen.findByText(/أقل من 70/)).toBeInTheDocument()
  })

  test('the redirect history for this path is shown, not every redirect on the site', async () => {
    renderWithProviders(
      <SeoEditor
        entityType="web_page"
        entityId="p1"
        path="/ar/plans"
        language="ar"
        translations={[]}
        redirects={[...REDIRECTS, { id: 'r2', from_path: '/en/old', to_path: '/en/plans', status_code: 301, reason: null, created_at: '', created_by_name: null }]}
      />,
      { route: adminPath('website/pages/p1') },
    )
    expect(await screen.findByText('/ar/old → /ar/plans')).toBeInTheDocument()
    expect(screen.queryByText('/en/old → /en/plans')).toBeNull()
  })

  test('unpublished translations are listed so the hreflang gap is visible', async () => {
    renderWithProviders(
      <SeoEditor
        entityType="web_page"
        entityId="p1"
        path="/ar/plans"
        language="ar"
        translations={[{ id: 'p1-fr', language: 'fr', path: '/fr/plans', status: 'draft' }]}
        redirects={[]}
      />,
      { route: adminPath('website/pages/p1') },
    )
    expect(await screen.findByText('/fr/plans')).toBeInTheDocument()
    expect(screen.getByText('غير منشورة')).toBeInTheDocument()
  })
})
