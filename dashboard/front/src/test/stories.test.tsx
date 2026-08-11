import { describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StoriesPage } from '../pages/StoriesPage'
import { StoryWorkspacePage } from '../pages/StoryWorkspacePage'
import { StoryBuilderPage } from '../pages/StoryBuilderPage'
import { api, ApiError } from '../lib/api'
import { renderWithProviders, envelope } from './harness'
import type {
  StoryLibraryRow,
  StoryWorkspace,
  StoryWorkspacePage as PageType,
} from '../types/api'

/**
 * اختبارات مكتبة القصص ومساحة عملها ومحرّرها.
 *
 * ## ما تُثبِّته
 *
 * ١. **الغلاف الحقيقي يُعرض، والاحتياط لا يكون أيقونة موحّدة.** الشاشة القديمة
 *    كانت تعرض أيقونة كتاب بنفسجية لكل صفّ، فتطابق عشرون صفًّا بصريًّا.
 * ٢. **الإعلان ليس إنجازًا.** لغة في `stories.languages` بلا نصّ على أي صفحة
 *    تُعرض `0/8` لا «موجودة».
 * ٣. **صفر صفحات حالة مُسمّاة** بإجراء، لا رقم صامت بين القصص المكتملة.
 * ٤. **مساحة العمل والمحرّر مقصدان مختلفان**: العنوان يفتح الأولى، وزرّ المحرّر
 *    يفتح الثاني.
 * ٥. **لوحة العرض مركز المحرّر**: صفحة واحدة مختارة، صورتها في الوسط، وتبديل
 *    اللغة يبقي الصفحة نفسها.
 * ٦. **العائق يقود إلى موضعه**: رقم الصفحة وتبويب المفتِّش في الرابط.
 * ٧. **«اقرأ لي» و«القراءة المتزامنة» حُكمان منفصلان.**
 */

const coverage = (over: Partial<Record<'ar' | 'en' | 'fr', [number, number, number]>> = {}, total = 8) =>
  (['ar', 'en', 'fr'] as const).map((language) => {
    const entry = over[language]
    return {
      language,
      declared: !!entry,
      text_done: entry?.[0] ?? 0,
      narration_done: entry?.[1] ?? 0,
      timing_done: entry?.[2] ?? 0,
      total,
    }
  })

const libraryRow = (over: Partial<StoryLibraryRow> = {}): StoryLibraryRow => ({
  id: 'story-bird-home',
  slug: 'bird-home',
  title_ar: 'بيت الطائر',
  title_en: 'Bird Home',
  description_ar: 'طائر صغير يعود إلى عشّه',
  type: 'picture_book',
  status: 'ready',
  age_min: 3,
  age_max: 5,
  reading_level: 'pre_reader',
  default_language: 'ar',
  languages: ['ar', 'en'],
  is_free: true,
  sort_order: 1,
  updated_at: '2026-08-11 10:00:00',
  published_at: null,
  series_id: 'series-preschool-calm-tale',
  series_title: 'حكاية هادئة',
  planet_id: 'qisas',
  planet_name: 'كوكب القصص',
  planet_color: '#FECA57',
  cover_url: 'https://cdn.example.com/public/cover.jpg',
  pages_total: 8,
  pages_with_image: 8,
  coverage: coverage({ ar: [8, 8, 0], en: [6, 0, 0] }),
  readiness: 'ready',
  ...over,
})

const librarySummary = (over = {}) => ({
  total: 1, ready: 1, partial: 0, empty: 0, published: 0, in_review: 0,
  missing_pages: 0, missing_artwork: 0, missing_cover: 0,
  ...over,
})

const stubLibrary = (rows: StoryLibraryRow[], summaryOver = {}) => {
  const spy = vi.spyOn(api, 'storyLibrary').mockResolvedValue({
    success: true,
    data: rows,
    meta: { total: rows.length, summary: librarySummary(summaryOver), notes: [] },
  } as never)
  vi.spyOn(api, 'series').mockResolvedValue(envelope([], 0) as never)
  vi.spyOn(api, 'visualStyles').mockResolvedValue(envelope([]) as never)
  return spy
}

const page = (over: Partial<PageType> = {}): PageType => ({
  id: 'page-1',
  page_number: 1,
  layout: 'full_bleed',
  transition: 'kenburns_slow',
  duration_ms: 5480,
  image_asset_id: 'asset-1',
  image_status: 'ready',
  image_url: 'https://cdn.example.com/public/page-001.jpg',
  image_width: 1920,
  image_height: 1080,
  image_aspect: '16:9',
  image_mime: 'image/jpeg',
  image_size: 810268,
  background_asset_id: null,
  bubbles_count: 0,
  updated_at: '2026-08-11 10:00:00',
  localizations: [
    {
      language: 'ar', has_text: true, has_alt: true,
      body_text: 'هذا زُغب. بيته عشّ صغير.', alt_text: 'عشّ صغير على فرع',
      narration_asset_id: 'asset-vo-ar-1', narration_status: 'ready',
      narration_source: 'generated', narration_size: 263084,
      narration_ready: true, has_timing: false, timing_count: 0,
      updated_at: '2026-08-11 10:00:00',
    },
    {
      language: 'en', has_text: true, has_alt: false,
      body_text: 'This is Fluff.', alt_text: null,
      narration_asset_id: null, narration_status: null,
      narration_source: null, narration_size: null,
      narration_ready: false, has_timing: false, timing_count: 0,
      updated_at: null,
    },
  ],
  ...over,
})

const workspace = (over: Partial<StoryWorkspace> = {}): StoryWorkspace => ({
  story: {
    id: 'story-bird-home', slug: 'bird-home', title_ar: 'بيت الطائر', title_en: 'Bird Home',
    description_ar: 'طائر صغير يعود إلى عشّه', type: 'picture_book', status: 'ready',
    age_min: 3, age_max: 5, reading_level: 'pre_reader', interaction_mode: 'tap',
    supervision_level: 'recommended', default_language: 'ar', languages: ['ar', 'en'],
    is_free: true, price_tier: 'free', sort_order: 1,
    series_id: 'series-preschool-calm-tale', series_title: 'حكاية هادئة',
    planet_id: 'qisas', planet_name: 'كوكب القصص', planet_color: '#FECA57',
    visual_style_name: 'هادئ', cover_url: 'https://cdn.example.com/public/cover.jpg',
    updated_at: '2026-08-11 10:00:00',
  } as StoryWorkspace['story'],
  pages: [page(), page({ id: 'page-2', page_number: 2 })],
  coverage: coverage({ ar: [8, 8, 0], en: [6, 0, 0] }, 2),
  blockers: [
    {
      key: 'page_2_no_narration_ar', severity: 'warning',
      label_ar: 'الصفحة ٢ بلا سرد جاهز بلغة القصة',
      label_en: 'Page 2 has no ready narration in the story language',
      page_number: 2, inspector: 'audio', language: 'ar',
    },
  ],
  readiness: {
    pages_total: 2, pages_with_image: 2, pages_ready: 2,
    read_to_me_ready: true, read_along_ready: false, publishable: true,
  },
  capabilities: {
    reviews_supported: false,
    reviews_reason: 'قيد content_reviews.entity_type لا يقبل story.',
    rights_supported: false,
    rights_reason: 'قيد content_rights.entity_type لا يقبل story.',
    timing_supported: false,
    timing_reason: 'العمود timing_cues لا يكتبه شيء في المنصّة.',
    panels_supported: false,
    panels_reason: 'قيمة layout «panels» بلا جدول لوحات.',
    bubbles_supported: true,
  },
  activity: [
    {
      id: 'au-1', actor_id: 'u1', actor_name: 'محرِّر', action: 'update',
      entity_type: 'story', entity_id: 'story-bird-home', created_at: '2026-08-11 09:00:00',
    },
  ],
  generated_at: '2026-08-11T12:00:00.000Z',
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

describe('StoriesPage library', () => {
  test('renders the real cover rather than a uniform icon', async () => {
    grantAll()
    stubLibrary([libraryRow()])

    const { container } = renderWithProviders(<StoriesPage />, { route: '/stories' })

    await screen.findByRole('link', { name: /بيت الطائر/ })
    const image = container.querySelector('.story-thumb img')
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/public/cover.jpg')
  })

  test('a declared language with no text reads as a ratio, not as present', async () => {
    grantAll()
    // الإنجليزية معلَنة وبها نصّ على ٦ من ٨ صفحات وصفر سرد. الشاشة القديمة كانت
    // تكتب «ar · en» فتُقرأ الإنجليزية مكتملة.
    stubLibrary([libraryRow()])

    renderWithProviders(<StoriesPage />, { route: '/stories' })

    await screen.findByRole('link', { name: /بيت الطائر/ })
    expect(screen.getByText('EN 6/8')).toBeInTheDocument()
    // السرد الإنجليزي صفر، ويُقال صريحًا لا يُستنتج من وجود اللغة.
    expect(screen.getByText('EN 0/8')).toBeInTheDocument()
  })

  test('a zero-page story is a named state with an action, not a silent zero', async () => {
    grantAll()
    stubLibrary([libraryRow({
      id: 'empty', pages_total: 0, pages_with_image: 0,
      readiness: 'empty', coverage: coverage({ ar: [0, 0, 0] }, 0),
    })], { total: 1, ready: 0, empty: 1, missing_pages: 1 })

    renderWithProviders(<StoriesPage />, { route: '/stories?view=grid' })

    await screen.findByRole('link', { name: /بيت الطائر/ })
    expect(screen.getByText(/الإعداد لم يبدأ/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /أضف الصفحة الأولى/ }))
      .toHaveAttribute('href', '/iamnotsite/stories/empty/builder')
  })

  test('the title opens the workspace and the editor button opens the builder', async () => {
    grantAll()
    stubLibrary([libraryRow()])

    renderWithProviders(<StoriesPage />, { route: '/stories' })

    // مقصدان مختلفان: إدارة القصة ككيان، وتأليف صفحاتها.
    expect(await screen.findByRole('link', { name: /بيت الطائر/ }))
      .toHaveAttribute('href', '/iamnotsite/stories/story-bird-home')
    expect(screen.getByRole('link', { name: /فتح المحرّر/ }))
      .toHaveAttribute('href', '/iamnotsite/stories/story-bird-home/builder')
  })

  test('a filter reaches the server rather than filtering in the browser', async () => {
    grantAll()
    const spy = stubLibrary([libraryRow()])

    renderWithProviders(<StoriesPage />, { route: '/stories?missing=artwork&readiness=partial' })

    await waitFor(() => expect(spy).toHaveBeenCalled())
    const call = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
    expect(call).toMatchObject({ missing: 'artwork', readiness: 'partial' })
  })

  test('a summary metric applies the filter that reproduces it', async () => {
    grantAll()
    const spy = stubLibrary([libraryRow()], { total: 3, empty: 2, missing_pages: 2 })
    const user = userEvent.setup()

    renderWithProviders(<StoriesPage />, { route: '/stories' })
    await screen.findByRole('link', { name: /بيت الطائر/ })

    const summary = screen.getByLabelText('القصص والكوميكس')
    await user.click(within(summary).getByRole('button', { name: /بلا صفحات/ }))

    await waitFor(() => {
      const call = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
      expect(call).toMatchObject({ readiness: 'empty' })
    })
  })

  test('a failed read offers a retry rather than an empty library', async () => {
    grantAll()
    vi.spyOn(api, 'storyLibrary').mockRejectedValue(new ApiError('تعذّرت القراءة', 503))
    vi.spyOn(api, 'series').mockResolvedValue(envelope([], 0) as never)
    vi.spyOn(api, 'visualStyles').mockResolvedValue(envelope([]) as never)

    renderWithProviders(<StoriesPage />, { route: '/stories' })

    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّرت القراءة')
    expect(screen.getByRole('button', { name: /إعادة المحاولة|retry/i })).toBeInTheDocument()
  })

  test('without the create permission the button is disabled and explains why', async () => {
    grantNothing()
    stubLibrary([libraryRow()])

    renderWithProviders(<StoriesPage />, { route: '/stories' })
    await screen.findByRole('link', { name: /بيت الطائر/ })

    const create = screen.getByRole('button', { name: /قصة جديدة/ })
    expect(create).toBeDisabled()
    expect(create).toHaveAttribute('title', 'الإنشاء يحتاج صلاحية الإنشاء.')
  })
})

describe('StoryWorkspacePage', () => {
  const mount = (route = '/stories/story-bird-home') =>
    renderWithProviders(<StoryWorkspacePage />, { route, path: '/stories/:id' })

  test('the header states counts and the primary action opens the builder', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mount()

    expect(await screen.findByRole('heading', { name: 'بيت الطائر' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /فتح المحرّر/ }))
      .toHaveAttribute('href', '/iamnotsite/stories/story-bird-home/builder')
  })

  test('read-to-me and read-along are reported separately', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mount()

    await screen.findByRole('heading', { name: 'بيت الطائر' })
    // سرد جاهز بلا مؤشّرات توقيت: الأول مكتمل والثاني فارغ، ورقم واحد لا يصلح
    // للاثنين.
    const readToMe = screen.getByText('اقرأ لي').closest('.metric-cell')
    const readAlong = screen.getByText('قراءة متزامنة').closest('.metric-cell')
    expect(readToMe).toHaveTextContent('جاهزة')
    expect(readAlong).toHaveTextContent('غير مكتملة')
  })

  test('a blocker deep-links to the exact page and inspector tab', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mount()

    const link = await screen.findByRole('link', { name: /الصفحة ٢ بلا سرد جاهز/ })
    // «لا يمكن النشر» بلا موضع تجعل المحرِّر يفتح كل صفحة بالتناوب.
    expect(link).toHaveAttribute('href', '/iamnotsite/stories/story-bird-home/builder?page=2&inspect=audio&lang=ar')
  })

  test('schema limits are stated rather than shown as empty tabs', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mount()

    await screen.findByRole('heading', { name: 'بيت الطائر' })
    expect(screen.getByText(/content_reviews/)).toBeInTheDocument()
    expect(screen.getByText(/panels/)).toBeInTheDocument()
    // ولا تبويب مراجعات ولا حقوق: القيد يرفضهما، فإعلانهما كان سيبدو عيبًا.
    expect(screen.queryByRole('tab', { name: /المراجعات/ })).not.toBeInTheDocument()
  })

  test('an image that is present but not ready names its actual status', async () => {
    grantAll()
    const data = workspace()
    data.pages = [page({ image_status: 'planned' })]
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data } as never)

    mount('/stories/story-bird-home?tab=pages')

    // أصل `planned` كان يمنع النشر بلا أن تُظهر الشاشة السبب.
    expect(await screen.findByText(/الصورة planned/)).toBeInTheDocument()
  })

  test('a missing story is a stated empty state with a way back', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockRejectedValue(new ApiError('Story not found', 404))

    mount('/stories/nope')

    expect(await screen.findByText('القصة غير موجودة')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'القصص' })).toHaveAttribute('href', '/iamnotsite/stories')
  })
})

describe('StoryBuilderPage', () => {
  const mount = (route = '/stories/story-bird-home/builder') =>
    renderWithProviders(<StoryBuilderPage />, { route, path: '/stories/:id/builder' })

  test('the canvas shows the selected page artwork as the visual centre', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    const { container } = mount()

    await screen.findByRole('heading', { name: 'بيت الطائر' })
    // صفحة واحدة مختارة وصورتها في اللوحة، لا أربعون محرّرًا مكدّسًا.
    const canvasImage = container.querySelector('.story-canvas__page img')
    expect(canvasImage).toHaveAttribute('src', 'https://cdn.example.com/public/page-001.jpg')
    expect(container.querySelectorAll('.story-canvas__page')).toHaveLength(1)
  })

  test('the page navigator marks exactly one page as selected', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    const { container } = mount('/stories/story-bird-home/builder?page=2')

    await screen.findByRole('heading', { name: 'بيت الطائر' })
    const active = container.querySelectorAll('.story-nav__item--active')
    expect(active).toHaveLength(1)
    expect(screen.getByText('صفحة ٢ من ٢')).toBeInTheDocument()
  })

  test('the three editor regions are all present', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    const { container } = mount()

    await screen.findByRole('heading', { name: 'بيت الطائر' })
    // مسّاح ← لوحة ← مفتِّش. البنية نفسها هي ما كان مكسورًا.
    expect(container.querySelector('.story-builder__nav')).toBeTruthy()
    expect(container.querySelector('.story-builder__canvas')).toBeTruthy()
    expect(container.querySelector('.story-builder__inspector')).toBeTruthy()
    // ولا `story-editor--three` على حزمة الصفحة: هذا الصنف هو أصل الفراغ.
    expect(container.querySelector('.story-editor--three')).toBeNull()
  })

  test('switching language keeps the same page and swaps only language content', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    const user = userEvent.setup()

    const { container } = mount('/stories/story-bird-home/builder?page=1')
    await screen.findByRole('heading', { name: 'بيت الطائر' })

    // النصّ العربي أولًا، لأنّ `ar` هي لغة القصة.
    expect(screen.getByRole('textbox', { name: /نصّ الصفحة/ })).toHaveValue('هذا زُغب. بيته عشّ صغير.')

    await user.click(screen.getByRole('button', { name: 'EN', pressed: false }))

    // الصفحة نفسها، والنصّ صار إنجليزيًّا: تبديل اللغة سؤال عن *هذه* الصفحة
    // بلغة أخرى، لا انتقال إلى صفحة أخرى.
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /نصّ الصفحة/ })).toHaveValue('This is Fluff.')
    })
    expect(screen.getByText('صفحة ١ من ٢')).toBeInTheDocument()
    // والصورة مشتركة بين اللغات فلم تتغيّر.
    const canvasImage = container.querySelector('.story-canvas__page img')
    expect(canvasImage).toHaveAttribute('src', 'https://cdn.example.com/public/page-001.jpg')
  })

  test('a page with no image gets an actionable canvas state, not a blank area', async () => {
    grantAll()
    const data = workspace()
    data.pages = [page({ image_asset_id: null, image_status: null, image_url: null })]
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data } as never)

    mount()

    expect(await screen.findByText('لا توجد صورة لهذه الصفحة')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /اختيار من الوسائط/ })).toBeInTheDocument()
  })

  test('editing text marks the editor dirty and the save button enables', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    const user = userEvent.setup()

    mount()
    await screen.findByRole('heading', { name: 'بيت الطائر' })

    const save = screen.getByRole('button', { name: /^حفظ$/ })
    expect(save).toBeDisabled()

    // المفتِّش فيه حقلان نصّيان مسمّيان (النصّ والبديل)، فالاستعلام بالاسم لا
    // بالدور وحده — وهو ما صار ممكنًا بعد إعطاء الحقلين أسماء مقروءة.
    const textarea = screen.getByRole('textbox', { name: /نصّ الصفحة/ })
    await user.type(textarea, '!')

    // الحالة تُعلَن قبل الفقد: «تعديلات غير محفوظة» لا حفظ صامت.
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('تعديلات غير محفوظة'))
    expect(save).toBeEnabled()
  })

  test('saving sends the current language and text to the server', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    const spy = vi.spyOn(api, 'savePageLocalization').mockResolvedValue(envelope({ page_id: 'page-1' }) as never)
    const user = userEvent.setup()

    mount('/stories/story-bird-home/builder?page=1&lang=en')
    await screen.findByRole('heading', { name: 'بيت الطائر' })

    await user.type(screen.getByRole('textbox', { name: /نصّ الصفحة/ }), ' more')
    await user.click(screen.getByRole('button', { name: /^حفظ$/ }))

    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy.mock.calls[0][0]).toBe('page-1')
    expect(spy.mock.calls[0][1]).toBe('en')
  })

  test('the inspector tab comes from the URL so a blocker link lands on it', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mount('/stories/story-bird-home/builder?page=1&inspect=audio')

    await screen.findByRole('heading', { name: 'بيت الطائر' })
    expect(screen.getByRole('tab', { name: 'السرد', selected: true })).toBeInTheDocument()
    // ومصدر الصوت يُقال: `generated` تصيير آلي لا تسجيل مُعتمد.
    expect(screen.getByText(/مُصيَّر آليًّا/)).toBeInTheDocument()
  })

  test('reordering sends the full page order, because a partial order is refused', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    const spy = vi.spyOn(api, 'reorderStoryPages').mockResolvedValue(
      envelope({ id: 'story-bird-home', pages: 2, order: ['page-2', 'page-1'] }) as never,
    )
    const user = userEvent.setup()

    mount()
    await screen.findByRole('heading', { name: 'بيت الطائر' })

    await user.click(screen.getByRole('button', { name: /نقل لأعلى: 2/ }))

    await waitFor(() => expect(spy).toHaveBeenCalled())
    // ‏`UNIQUE (story_id, page_number)` تجعل الترتيب الجزئي حالةً لا تُصلَح.
    expect(spy.mock.calls[0][1]).toEqual(['page-2', 'page-1'])
  })

  test('deleting a page states its impact before asking', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const remove = vi.spyOn(api, 'deleteStoryPage')
    const user = userEvent.setup()

    mount('/stories/story-bird-home/builder?page=1&inspect=layout')
    await screen.findByRole('heading', { name: 'بيت الطائر' })

    await user.click(screen.getByRole('button', { name: /حذف الصفحة/ }))

    // الأثر يُعدّ: صورة و٢ نصّ و١ سرد، لا «هل أنت متأكد؟».
    expect(confirm.mock.calls[0][0]).toContain('صورة')
    expect(confirm.mock.calls[0][0]).toContain('2 نصّ')
    expect(remove).not.toHaveBeenCalled()
  })

  test('a viewer cannot edit, and the controls say why', async () => {
    grantNothing()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    mount()
    await screen.findByRole('heading', { name: 'بيت الطائر' })

    expect(screen.getByRole('textbox', { name: /نصّ الصفحة/ })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /وصف الصورة/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^حفظ$/ }))
      .toHaveAttribute('title', 'التعديل يحتاج صلاحية تعديل البيانات.')
  })

  test('English renders the same structure in LTR', async () => {
    grantAll()
    vi.spyOn(api, 'storyWorkspace').mockResolvedValue({ success: true, data: workspace() } as never)

    renderWithProviders(<StoryBuilderPage />, {
      route: '/stories/story-bird-home/builder',
      path: '/stories/:id/builder',
      locale: 'en',
    })

    expect(await screen.findByRole('heading', { name: 'Bird Home' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Text' })).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })
})
