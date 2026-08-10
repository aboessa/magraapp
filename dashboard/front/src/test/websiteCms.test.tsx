import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './harness'

/**
 * اختبارات واجهة CMS الموقع العام.
 *
 * ## ما تحرسه
 *
 * ثلاث قواعد وضعها الخادم، والواجهة ملزمة بها وإلا صارت تكذب:
 *
 * 1. **النشر ليس حقل حالة.** `PATCH` يرفض `published`؛ الشاشة لا تعرضه خيارًا
 *    ولا ترسله في تعديل عنوان.
 * 2. **الرفض يُعرض مُفصَّلًا.** `POST /publish` يردّ 409 بقائمة عوائق؛ عرض «تعذر
 *    النشر» يعيد بالضبط المشكلة التي بُنيت البوابة لإنهائها.
 * 3. **ترتيب المصفوفة هو الترتيب المحفوظ.** الخادم يتجاهل `sort_order`، فتحريك
 *    قسم يجب أن يغيّر ترتيب ما يُرسَل.
 */

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    webPages: vi.fn(),
    webPage: vi.fn(),
    createWebPage: vi.fn(),
    updateWebPage: vi.fn(),
    saveWebPageSections: vi.fn(),
    publishWebPage: vi.fn(),
    rollbackWebPage: vi.fn(),
    auditLogs: vi.fn(),
    seoRedirects: vi.fn(),
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

const { WebsitePagesPage } = await import('../pages/WebsitePagesPage')
const { WebsitePageEditor } = await import('../pages/WebsitePageEditor')
const { ApiError } = await import('../lib/api')
const { adminPath } = await import('../lib/adminPath')

const pageRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'page-ar-plans',
  page_key: 'plans',
  language: 'ar',
  path: '/ar/plans',
  slug: 'plans',
  title: 'الباقات',
  status: 'published',
  scheduled_at: null,
  published_at: '2026-08-01T10:00:00.000Z',
  kind: 'standard',
  is_indexable: 1,
  translation_group: 'plans',
  updated_at: '2026-08-05T10:00:00.000Z',
  active_sections: 3,
  language_variants: 2,
  has_seo: 1,
  ...overrides,
})

const pageDetail = (overrides: Record<string, unknown> = {}) => ({
  page: {
    id: 'page-ar-plans', page_key: 'plans', language: 'ar', path: '/ar/plans', slug: 'plans',
    title: 'الباقات', summary: 'ملخّص', translation_group: 'plans', status: 'draft',
    scheduled_at: null, published_at: null, kind: 'standard', is_indexable: 1,
    created_at: '2026-08-01T10:00:00.000Z', updated_at: '2026-08-05T10:00:00.000Z',
  },
  sections: [
    {
      id: 'sec-1', section_type: 'hero', sort_order: 0, is_active: 1,
      content_json: '{"headline":"مرحبًا"}', cta_json: '{}',
      media_asset_id: null, media_status: null, media_title: null,
    },
    {
      id: 'sec-2', section_type: 'rich_text', sort_order: 1, is_active: 1,
      content_json: '{"body":"نصّ"}', cta_json: '{}',
      media_asset_id: null, media_status: null, media_title: null,
    },
  ],
  seo: null,
  translations: [{ id: 'page-en-plans', language: 'en', path: '/en/plans', status: 'draft' }],
  revisions: [{ id: 'rev-2', version: 2, note: 'before update', created_at: '2026-08-05T09:00:00.000Z', created_by_name: 'محرِّر' }],
  readiness: [{ id: 'seo_title', detail: 'لا عنوان SEO', severity: 'warning' }],
  ...overrides,
})

beforeEach(() => {
  apiMock.webPages.mockResolvedValue({ success: true, data: [pageRow()], meta: { total: 1 } })
  apiMock.webPage.mockResolvedValue({ success: true, data: pageDetail() })
  apiMock.auditLogs.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
  apiMock.seoRedirects.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
  apiMock.seoMeta.mockResolvedValue({
    success: true,
    data: { entity_type: 'web_page', entity_id: 'page-ar-plans', seo: null, guidance: { title_max: 60, description_min: 70, description_max: 160 } },
  })
  apiMock.assets.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
})

// --- القائمة ---------------------------------------------------------------

describe('WebsitePagesPage', () => {
  test('a row is one page in one language, with its own publication state', async () => {
    apiMock.webPages.mockResolvedValue({
      success: true,
      data: [pageRow(), pageRow({ id: 'page-fr-plans', language: 'fr', path: '/fr/plans', status: 'draft', active_sections: 0, has_seo: 0 })],
      meta: { total: 2 },
    })
    renderWithProviders(<WebsitePagesPage />, { route: adminPath('website/pages') })

    const rows = await screen.findAllByRole('row')
    // رأس + صفّان
    expect(rows).toHaveLength(3)
    expect(screen.getByText('/ar/plans')).toBeInTheDocument()
    expect(screen.getByText('/fr/plans')).toBeInTheDocument()
    expect(screen.getByText('published')).toBeInTheDocument()
    expect(screen.getByText('draft')).toBeInTheDocument()
  })

  test('language and status are sent to the server, and the rest filter locally', async () => {
    renderWithProviders(<WebsitePagesPage />, { route: `${adminPath('website/pages')}?language=ar&status=published&kind=legal` })
    await waitFor(() => expect(apiMock.webPages).toHaveBeenCalled())
    // النوع لا يقبله الخادم، فلا يُرسَل — إرساله يجعل البحث يبدو معطَّلًا.
    expect(apiMock.webPages).toHaveBeenCalledWith({ language: 'ar', status: 'published' })
    // ولأنه يُفلتَر محليًا، الصفحة القياسية تُستبعَد فعلًا من الجدول.
    expect(await screen.findByText('لا صفحات مطابقة')).toBeInTheDocument()
  })

  test('the loading state shows before the first response', async () => {
    apiMock.webPages.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<WebsitePagesPage />, { route: adminPath('website/pages') })
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  test('a failed load offers a retry and reports the server message', async () => {
    apiMock.webPages.mockRejectedValueOnce(new ApiError('D1 unavailable', 503))
    const user = userEvent.setup()
    renderWithProviders(<WebsitePagesPage />, { route: adminPath('website/pages') })
    expect(await screen.findByText('D1 unavailable')).toBeInTheDocument()

    apiMock.webPages.mockResolvedValue({ success: true, data: [pageRow()], meta: { total: 1 } })
    await user.click(screen.getByRole('button', { name: /إعادة المحاولة/ }))
    expect(await screen.findByText('/ar/plans')).toBeInTheDocument()
  })

  test('an empty result is an empty state, not a blank table', async () => {
    apiMock.webPages.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
    renderWithProviders(<WebsitePagesPage />, { route: adminPath('website/pages') })
    expect(await screen.findByText('لا صفحات مطابقة')).toBeInTheDocument()
  })

  test('the calendar view is reachable from the URL and shows scheduled pages', async () => {
    apiMock.webPages.mockResolvedValue({
      success: true,
      data: [pageRow({ status: 'scheduled', scheduled_at: new Date().toISOString(), published_at: null })],
      meta: { total: 1 },
    })
    renderWithProviders(<WebsitePagesPage />, { route: `${adminPath('website/pages')}?view=calendar` })
    expect(await screen.findByRole('grid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /الباقات/ })).toBeInTheDocument()
  })

  test('the tree view groups the language variants of one page', async () => {
    apiMock.webPages.mockResolvedValue({
      success: true,
      data: [pageRow(), pageRow({ id: 'page-fr-plans', language: 'fr', path: '/fr/plans', status: 'draft' })],
      meta: { total: 2 },
    })
    renderWithProviders(<WebsitePagesPage />, { route: `${adminPath('website/pages')}?view=tree` })
    const tree = await screen.findByRole('tree')
    expect(within(tree).getByText('plans')).toBeInTheDocument()
    expect(within(tree).getByText('ar · الباقات')).toBeInTheDocument()
    expect(within(tree).getByText('fr · الباقات')).toBeInTheDocument()
  })

  test('quick view reads the page without leaving the list, and links to the editor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WebsitePagesPage />, { route: adminPath('website/pages') })
    await user.click((await screen.findAllByRole('button', { name: 'عرض سريع' }))[0])

    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('لا عنوان SEO')).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: 'فتح المحرِّر' })).toHaveAttribute('href', adminPath('website/pages/page-ar-plans'))
  })

  test('bulk publish reports each refusal with its blockers, not a single failure', async () => {
    const user = userEvent.setup()
    apiMock.publishWebPage.mockRejectedValueOnce(new ApiError('Publish blocked by 1 check(s)', 409, [], {
      blockers: [{ id: 'sections', detail: 'لا أقسام مُفعَّلة، فالصفحة ستُنشر فارغة.', severity: 'blocker' }],
    }))
    renderWithProviders(<WebsitePagesPage />, { route: adminPath('website/pages') })

    await user.click(await screen.findByRole('checkbox', { name: /تحرير: الباقات/ }))
    await user.click(screen.getByRole('button', { name: 'نشر المحدَّد' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/لا أقسام مُفعَّلة/)).toBeInTheDocument()
  })
})

// --- المحرِّر ---------------------------------------------------------------

describe('WebsitePageEditor', () => {
  const renderEditor = () => renderWithProviders(<WebsitePageEditor />, {
    route: adminPath('website/pages/page-ar-plans'),
    path: `${adminPath('website/pages')}/:id`,
  })

  test('the readiness report is shown before anyone presses publish', async () => {
    renderEditor()
    expect(await screen.findByText('لا عنوان SEO')).toBeInTheDocument()
  })

  test('published is not offered as an editable status on a draft', async () => {
    const user = userEvent.setup()
    renderEditor()
    await user.click(await screen.findByRole('tab', { name: /الإعدادات/ }))
    const select = screen.getByLabelText('الحالة')
    const options = within(select).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)
    // الخادم يرفض `status: 'published'` في PATCH؛ عرضه خيارًا يجعل تعديل عنوان
    // بريئًا يردّ 400.
    expect(options).not.toContain('published')
    expect(options).toEqual(['draft', 'review', 'scheduled', 'archived'])
  })

  test('saving settings does not send a status the server refuses', async () => {
    const user = userEvent.setup()
    apiMock.updateWebPage.mockResolvedValue({ success: true, data: { id: 'page-ar-plans', updated: true } })
    renderEditor()
    await user.click(await screen.findByRole('tab', { name: /الإعدادات/ }))
    await user.click(screen.getByRole('button', { name: /^حفظ$/ }))
    await waitFor(() => expect(apiMock.updateWebPage).toHaveBeenCalled())
    const payload = apiMock.updateWebPage.mock.calls[0][1] as Record<string, unknown>
    expect(payload.status).toBe('draft')
    expect(payload.status).not.toBe('published')
  })

  test('moving a section changes the order that is sent, since the server ignores sort_order', async () => {
    const user = userEvent.setup()
    apiMock.saveWebPageSections.mockResolvedValue({ success: true, data: { id: 'page-ar-plans', sections: 2 } })
    renderEditor()

    await user.click((await screen.findAllByRole('button', { name: 'تحريك لأسفل' }))[0])
    await user.click(screen.getByRole('button', { name: /حفظ الأقسام/ }))

    await waitFor(() => expect(apiMock.saveWebPageSections).toHaveBeenCalled())
    const sections = apiMock.saveWebPageSections.mock.calls[0][1] as Array<{ section_type: string }>
    expect(sections.map((section) => section.section_type)).toEqual(['rich_text', 'hero'])
  })

  test('a refused publish shows every blocker with its reason', async () => {
    const user = userEvent.setup()
    apiMock.publishWebPage.mockRejectedValueOnce(new ApiError('Publish blocked by 2 check(s)', 409, [], {
      blockers: [
        { id: 'title', detail: 'الصفحة بلا عنوان.', severity: 'blocker' },
        { id: 'sections', detail: 'لا أقسام مُفعَّلة.', severity: 'blocker' },
      ],
      warnings: [{ id: 'meta_description', detail: 'لا وصف ميتا.', severity: 'warning' }],
    }))
    renderEditor()
    await user.click(await screen.findByRole('button', { name: /^نشر$/ }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('الصفحة بلا عنوان.')).toBeInTheDocument()
    expect(within(dialog).getByText('لا أقسام مُفعَّلة.')).toBeInTheDocument()
    // التحذير يُعرض ولا يُلبَّس ثوب العائق.
    expect(within(dialog).getByText('لا وصف ميتا.')).toBeInTheDocument()
  })

  test('a successful publish reports the warnings that did not block it', async () => {
    const user = userEvent.setup()
    apiMock.publishWebPage.mockResolvedValue({
      success: true,
      data: { id: 'page-ar-plans', path: '/ar/plans', warnings: [{ id: 'meta_description', detail: 'لا وصف ميتا.', severity: 'warning' }] },
    })
    renderEditor()
    await user.click(await screen.findByRole('button', { name: /^نشر$/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('لا وصف ميتا.')).toBeInTheDocument()
  })

  test('a rollback is confirmed first and states what it does not restore', async () => {
    const user = userEvent.setup()
    apiMock.rollbackWebPage.mockResolvedValue({ success: true, data: { id: 'page-ar-plans', restored_version: 2 } })
    renderEditor()

    await user.click(await screen.findByRole('tab', { name: /المراجعات/ }))
    await user.click(screen.getByRole('button', { name: /استرجاع/ }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/الحالة والمسار لا يُسترجعان/)).toBeInTheDocument()
    expect(apiMock.rollbackWebPage).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: /استرجاع النسخة/ }))
    expect(apiMock.rollbackWebPage).toHaveBeenCalledWith('page-ar-plans', 2)
  })

  test('the content is edited in the page language direction, not the admin locale', async () => {
    // لوحة إنجليزية تحرّر صفحة عربية: المحرِّر يجب أن يكون rtl كما سيراه الزائر.
    const { container } = renderWithProviders(<WebsitePageEditor />, {
      locale: 'en',
      route: adminPath('website/pages/page-ar-plans'),
      path: `${adminPath('website/pages')}/:id`,
    })
    await screen.findByRole('heading', { name: 'الباقات', level: 2 })
    await waitFor(() => expect(container.querySelector('.panel[dir="rtl"]')).not.toBeNull())
  })

  test('a missing page reports not found rather than an empty workspace', async () => {
    apiMock.webPage.mockRejectedValueOnce(new ApiError('Page not found', 404))
    renderEditor()
    expect(await screen.findByText('الصفحة غير موجودة')).toBeInTheDocument()
  })
})
