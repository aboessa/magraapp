import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './harness'

/**
 * اختبارات واجهة المدوّنة.
 *
 * ## القاعدة المركزية
 *
 * الجسم كتل يتحقّق منها الخادم ويرفض المصفوفة كاملة إن فسدت واحدة. لذلك الواجهة
 * ملزمة بأمرين: أن تُظهر الكتلة الفاسدة قبل الحفظ، وأن **توقف الحفظ التلقائي**
 * عندها. حفظ تلقائي يفشل صامتًا كل ثلاثين ثانية يجعل المحرِّر يظنّ عمله محفوظًا
 * وهو ليس — وهي أسوأ نتيجة ممكنة من ميزة وُجدت لحماية عمله.
 */

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    blogPosts: vi.fn(),
    blogPost: vi.fn(),
    blogTaxonomy: vi.fn(),
    createBlogPost: vi.fn(),
    updateBlogPost: vi.fn(),
    publishBlogPost: vi.fn(),
    rollbackBlogPost: vi.fn(),
    createBlogAuthor: vi.fn(),
    createBlogCategory: vi.fn(),
    createBlogTag: vi.fn(),
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

const { BlogPostsPage } = await import('../pages/BlogPostsPage')
const { BlogPostEditor } = await import('../pages/BlogPostEditor')
const { BlogTaxonomyPage } = await import('../pages/BlogTaxonomyPage')
const { invalidBlockIndexes } = await import('../pages/BlogPostEditor')
const { ApiError } = await import('../lib/api')
const { adminPath } = await import('../lib/adminPath')

const TAXONOMY = {
  authors: [{ id: 'author-1', display_name: 'نهى', bio: null, avatar_asset_id: null, is_active: 1 }],
  categories: [
    { id: 'cat-ar-islamic', category_key: 'islamic', language: 'ar', name: 'إسلامي', slug: 'islamic', sort_order: 0 },
    { id: 'cat-en-news', category_key: 'news', language: 'en', name: 'News', slug: 'news', sort_order: 1 },
  ],
  tags: [{ slug: 'space', name_ar: 'فضاء', name_en: 'Space', name_fr: null, post_count: 2 }],
}

const postRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'post-1', post_key: 'hello', language: 'ar', slug: 'hello', path: '/ar/blog/hello',
  title: 'مرحبًا بالعالم', status: 'draft', scheduled_at: null, published_at: null,
  updated_at: '2026-08-05T10:00:00.000Z', translation_group: 'hello',
  hero_asset_id: null, source_type: null, religious_approved_at: null,
  author_name: 'نهى', category_name: 'إسلامي', category_key: 'islamic',
  language_variants: 1, has_seo: 0,
  ...overrides,
})

const postDetail = (overrides: Record<string, unknown> = {}) => ({
  post: {
    id: 'post-1', post_key: 'hello', language: 'ar', slug: 'hello', path: '/ar/blog/hello',
    title: 'مرحبًا بالعالم', excerpt: 'مقتطف', body: [
      { type: 'heading', level: 2, text: 'العنوان الفرعي' },
      { type: 'paragraph', text: 'فقرة أولى' },
    ],
    body_json: '[]', hero_asset_id: null, author_id: 'author-1', category_id: 'cat-ar-islamic',
    translation_group: 'hello', status: 'draft', scheduled_at: null, published_at: null,
    related_posts_json: '[]', related_content_json: '[]', cta_json: '{}',
    source_type: null, source_reference: null, religious_reviewer_id: null, religious_approved_at: null,
    created_at: '2026-08-01T10:00:00.000Z', updated_at: '2026-08-05T10:00:00.000Z',
  },
  tags: ['space'],
  translations: [],
  revisions: [
    { id: 'r-3', version: 3, is_autosave: 1, note: 'autosave', created_at: '2026-08-05T09:30:00.000Z', created_by_name: 'نهى' },
    { id: 'r-2', version: 2, is_autosave: 0, note: 'before update', created_at: '2026-08-05T09:00:00.000Z', created_by_name: 'نهى' },
  ],
  seo: null,
  word_count: 4,
  is_religious: false,
  readiness: [{ id: 'meta_description', detail: 'لا وصف ميتا.', severity: 'warning' }],
  ...overrides,
})

beforeEach(() => {
  apiMock.blogPosts.mockResolvedValue({ success: true, data: [postRow()], meta: { total: 1 } })
  apiMock.blogTaxonomy.mockResolvedValue({ success: true, data: TAXONOMY })
  apiMock.blogPost.mockResolvedValue({ success: true, data: postDetail() })
  apiMock.auditLogs.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
  apiMock.seoRedirects.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
  apiMock.assets.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
})

// --- المجموعة --------------------------------------------------------------

describe('BlogPostsPage', () => {
  test('server-side filters go to the server and browser-side ones do not', async () => {
    renderWithProviders(<BlogPostsPage />, {
      route: `${adminPath('blog/posts')}?language=ar&status=draft&category_id=cat-ar-islamic&author=نهى&q=مرحبا`,
    })
    await waitFor(() => expect(apiMock.blogPosts).toHaveBeenCalled())
    const args = apiMock.blogPosts.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(args).toEqual({ language: 'ar', status: 'draft', category_id: 'cat-ar-islamic', q: 'مرحبا' })
    expect(args).not.toHaveProperty('author')
  })

  test('a post with no author is flagged in the list, because it blocks publication', async () => {
    apiMock.blogPosts.mockResolvedValue({ success: true, data: [postRow({ author_name: null })], meta: { total: 1 } })
    renderWithProviders(<BlogPostsPage />, { route: adminPath('blog/posts') })
    const rows = await screen.findAllByRole('row')
    const cells = within(rows[1]).getAllByRole('cell')
    // العمود الرابع هو الكاتب (العنوان، اللغة، الحالة، الكاتب).
    expect(cells[3].querySelector('.readiness-item--blocked')).not.toBeNull()
  })

  test('the card view is available where a hero image matters', async () => {
    renderWithProviders(<BlogPostsPage />, { route: `${adminPath('blog/posts')}?view=cards` })
    expect(await screen.findByRole('heading', { name: 'مرحبًا بالعالم', level: 4 })).toBeInTheDocument()
  })

  test('an empty collection states it', async () => {
    apiMock.blogPosts.mockResolvedValue({ success: true, data: [], meta: { total: 0 } })
    renderWithProviders(<BlogPostsPage />, { route: adminPath('blog/posts') })
    expect(await screen.findByText('لا مقالات مطابقة')).toBeInTheDocument()
  })

  test('a failed load reports the server message', async () => {
    apiMock.blogPosts.mockRejectedValueOnce(new ApiError('forbidden', 403))
    renderWithProviders(<BlogPostsPage />, { route: adminPath('blog/posts') })
    expect(await screen.findByRole('alert')).toHaveTextContent('forbidden')
  })

  test('creating a post refuses an empty latin slug before calling the server', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BlogPostsPage />, { route: adminPath('blog/posts') })
    await user.click(await screen.findByRole('button', { name: /مقال جديد/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/العنوان/), 'مقال عربي')
    // العنوان العربي لا يُنتج اختصارًا لاتينيًا، والخادم يرفض؛ الزرّ يبقى معطَّلًا.
    expect(within(dialog).getByRole('button', { name: 'إنشاء' })).toBeDisabled()
  })
})

// --- محرِّر الكتل ----------------------------------------------------------

describe('block validation mirrors the server', () => {
  test('an image needs both an asset id and alt text', () => {
    expect(invalidBlockIndexes([{ key: 'k', type: 'image', asset_id: 'a1', alt: '' }])).toEqual([0])
    expect(invalidBlockIndexes([{ key: 'k', type: 'image', asset_id: '', alt: 'وصف' }])).toEqual([0])
    expect(invalidBlockIndexes([{ key: 'k', type: 'image', asset_id: 'a1', alt: 'وصف' }])).toEqual([])
  })

  test('a heading is limited to levels 2 to 4', () => {
    expect(invalidBlockIndexes([{ key: 'k', type: 'heading', level: 1, text: 'x' }])).toEqual([0])
    expect(invalidBlockIndexes([{ key: 'k', type: 'heading', level: 5, text: 'x' }])).toEqual([0])
    expect(invalidBlockIndexes([{ key: 'k', type: 'heading', level: 3, text: 'x' }])).toEqual([])
  })

  test('an embed must be https and on the allow-list', () => {
    expect(invalidBlockIndexes([{ key: 'k', type: 'embed', url: 'http://www.youtube.com/watch?v=1' }])).toEqual([0])
    expect(invalidBlockIndexes([{ key: 'k', type: 'embed', url: 'https://evil.example/x' }])).toEqual([0])
    expect(invalidBlockIndexes([{ key: 'k', type: 'embed', url: 'https://youtu.be/abc' }])).toEqual([])
  })

  test('a cta needs a label and a destination', () => {
    expect(invalidBlockIndexes([{ key: 'k', type: 'cta', label: 'اقرأ', href: '' }])).toEqual([0])
    expect(invalidBlockIndexes([{ key: 'k', type: 'cta', label: 'اقرأ', href: '/ar/plans' }])).toEqual([])
  })

  test('a list needs at least one non-empty item', () => {
    expect(invalidBlockIndexes([{ key: 'k', type: 'list', items: [] }])).toEqual([0])
    expect(invalidBlockIndexes([{ key: 'k', type: 'list', items: [''] }])).toEqual([0])
    expect(invalidBlockIndexes([{ key: 'k', type: 'list', items: ['أ'] }])).toEqual([])
  })

  test('a divider needs nothing', () => {
    expect(invalidBlockIndexes([{ key: 'k', type: 'divider' }])).toEqual([])
  })
})

// --- المحرِّر --------------------------------------------------------------

describe('BlogPostEditor', () => {
  const renderEditor = (locale: 'ar' | 'en' = 'ar') => renderWithProviders(<BlogPostEditor />, {
    locale,
    route: adminPath('blog/posts/post-1'),
    path: `${adminPath('blog/posts')}/:id`,
  })

  test('the body loads as editable blocks, not as JSON text', async () => {
    renderEditor()
    expect(await screen.findByDisplayValue('العنوان الفرعي')).toBeInTheDocument()
    expect(screen.getByDisplayValue('فقرة أولى')).toBeInTheDocument()
    // مربّع JSON واحد بكل الجسم هو ما كان يجب تجنّبه.
    expect(screen.queryByDisplayValue(/^\[\{/)).toBeNull()
  })

  test('autosave stops while a block is invalid, and says so', async () => {
    const user = userEvent.setup()
    renderEditor()
    const heading = await screen.findByDisplayValue('العنوان الفرعي')
    await user.clear(heading)
    expect(await screen.findByText(/الحفظ التلقائي متوقّف/)).toBeInTheDocument()
    expect(screen.getByText(/كتل غير صالحة/)).toBeInTheDocument()
  })

  test('an Arabic post is edited right-to-left and a French one left-to-right', async () => {
    const { container, unmount } = renderEditor('en')
    await screen.findByDisplayValue('العنوان الفرعي')
    expect(container.querySelector('.block-card__body[dir="rtl"]')).not.toBeNull()
    unmount()

    apiMock.blogPost.mockResolvedValue({
      success: true,
      data: postDetail({
        post: { ...postDetail().post, language: 'fr', path: '/fr/blog/hello', title: 'Bonjour' },
      }),
    })
    const second = renderEditor('en')
    await screen.findByDisplayValue('العنوان الفرعي')
    expect(second.container.querySelector('.block-card__body[dir="ltr"]')).not.toBeNull()
  })

  test('saving sends the blocks without the local editor keys', async () => {
    const user = userEvent.setup()
    apiMock.updateBlogPost.mockResolvedValue({ success: true, data: { id: 'post-1', autosave: false } })
    renderEditor()
    await user.click((await screen.findAllByRole('button', { name: /^حفظ$/ }))[0])
    await waitFor(() => expect(apiMock.updateBlogPost).toHaveBeenCalled())
    const payload = apiMock.updateBlogPost.mock.calls[0][1] as { body: Array<Record<string, unknown>>; autosave?: boolean }
    expect(payload.body[0]).not.toHaveProperty('key')
    expect(payload.autosave).toBeUndefined()
  })

  test('the religious gate is shown as reviewer plus date, never as a checkbox', async () => {
    const user = userEvent.setup()
    apiMock.blogPost.mockResolvedValue({
      success: true,
      data: postDetail({
        is_religious: true,
        readiness: [{ id: 'religious_review', detail: 'محتوى ديني بلا مراجع شرعي مُسجَّل وتاريخ موافقة.', severity: 'blocker' }],
      }),
    })
    renderEditor()
    expect(await screen.findByText(/محتوى ديني بلا مراجع شرعي/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /الإعدادات/ }))
    expect(screen.getByLabelText('المراجع الشرعي')).toBeInTheDocument()
    expect(screen.getByLabelText('تاريخ الموافقة')).toBeInTheDocument()
  })

  test('a refused publish lists the blockers the server returned', async () => {
    const user = userEvent.setup()
    apiMock.publishBlogPost.mockRejectedValueOnce(new ApiError('Publish blocked by 1 check(s)', 409, [], {
      blockers: [{ id: 'author', detail: 'لا كاتب مرتبط؛ المقال سيُنشر بلا نسبة.', severity: 'blocker' }],
    }))
    renderEditor()
    await user.click(await screen.findByRole('button', { name: /^نشر$/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/لا كاتب مرتبط/)).toBeInTheDocument()
  })

  test('autosave revisions are labelled so they cannot be mistaken for checkpoints', async () => {
    const user = userEvent.setup()
    renderEditor()
    await user.click(await screen.findByRole('tab', { name: /المراجعات/ }))
    expect(screen.getByText(/v3 · حفظ تلقائي/)).toBeInTheDocument()
    expect(screen.getByText(/v2 — before update/)).toBeInTheDocument()
  })

  test('a missing post reports not found', async () => {
    apiMock.blogPost.mockRejectedValueOnce(new ApiError('Post not found', 404))
    renderEditor()
    expect(await screen.findByText('المقال غير موجود')).toBeInTheDocument()
  })
})

// --- التصنيفات -------------------------------------------------------------

describe('BlogTaxonomyPage', () => {
  test('a category is created per language', async () => {
    const user = userEvent.setup()
    apiMock.createBlogCategory.mockResolvedValue({ success: true, data: { id: 'cat-new' } })
    renderWithProviders(<BlogTaxonomyPage />, { route: adminPath('blog/taxonomy') })

    await user.click(await screen.findByRole('tab', { name: /التصنيفات/ }))
    await user.type(screen.getByLabelText(/مفتاح التصنيف/), 'science')
    await user.type(screen.getByLabelText(/^الاسم/), 'علوم')
    await user.click(screen.getAllByRole('button', { name: /إضافة/ }).at(-1)!)

    await waitFor(() => expect(apiMock.createBlogCategory).toHaveBeenCalled())
    expect(apiMock.createBlogCategory.mock.calls[0][0]).toMatchObject({ category_key: 'science', name: 'علوم', language: 'ar' })
  })

  test('a tag carries three names on one row, because a tag is a filter not a page', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BlogTaxonomyPage />, { route: adminPath('blog/taxonomy') })
    await user.click(await screen.findByRole('tab', { name: /الوسوم/ }))
    const rows = await screen.findAllByRole('row')
    expect(within(rows[1]).getByText('فضاء')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Space')).toBeInTheDocument()
  })
})
