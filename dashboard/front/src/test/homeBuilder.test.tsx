import { describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppExperiencePage } from '../pages/AppExperiencePage'
import { api } from '../lib/api'
import { renderWithProviders } from './harness'
import type { HomeBlockRecord, HomeBuilderMeta, HomePreviewEnvelope } from '../types/api'

/**
 * Home Builder (ADMIN-002).
 *
 * ## ما كان معطوبًا
 *
 * كل أزرار الشاشة كانت `disabled`: Save وCancel وPublish وRollback ومنتقي
 * المحتوى. جدول «النسخ» كان صفّين مخترعَين (`v3 Active owner 2026-08-11`)،
 * وقائمة الأنواع كانت مكتوبة في الواجهة وتضمّ نوعين ترفضهما قاعدة البيانات،
 * وتشخيص المُحلِّل كان يطبع «Fallback applied: none» دائمًا. والأهم أن الشاشة
 * كانت تحمل لافتة تقول إن التطبيق لا يقرأ هذا الإعداد — وكانت صادقة.
 *
 * هذه الاختبارات تثبّت أن كل إجراء ظاهر يصل إلى الخادم، وأن ما لا وجود له لا
 * يُعرَض.
 */

const meta: HomeBuilderMeta = {
  block_types: ['hero_slider', 'games', 'continue_watching', 'planet_orbit'],
  system_block_types: ['continue_watching'],
  targeting_dimensions: ['track', 'language', 'country', 'plan', 'platform', 'min_app_version', 'is_new_user'],
  config_keys: ['system', 'subtitle', 'card_style', 'maxItems'],
}

const block = (over: Partial<HomeBlockRecord> = {}): HomeBlockRecord => ({
  id: 'block-hero',
  block_type: 'hero_slider',
  title_ar: 'الهيرو',
  sort_order: 0,
  is_active: 1,
  is_draft: 0,
  scheduled_at: null,
  expires_at: null,
  version: 1,
  targeting: {},
  config: {},
  is_system: false,
  targeting_invalid: null,
  config_invalid: null,
  ...over,
})

const preview = (over: Partial<HomePreviewEnvelope['meta']> = {}): HomePreviewEnvelope => ({
  blocks: [
    {
      id: 'block-hero', type: 'hero_slider', title: 'الهيرو', subtitle: null,
      source: 'editorial', card_style: null, config: {}, targeting: {},
      position: 0, is_system: false,
    },
  ],
  meta: {
    track: 'kids', language: 'ar', country: 'EG', plan: 'family', platform: 'phone',
    appVersion: '1.0.0', isNewUser: false, resolved_at: '2026-08-15T12:00:00.000Z',
    total_blocks: 2, matched: 1, excluded: 1, excluded_inactive: 1,
    excluded_draft: 0, excluded_schedule: 0,
    resolver: 'lib/homeExperience.ts',
    ...over,
  },
})

function stubList(blocks: HomeBlockRecord[]) {
  return vi.spyOn(api, 'homeExperience').mockResolvedValue({
    success: true, data: blocks, meta,
  } as never)
}

function stubPreview() {
  return vi.spyOn(api, 'homeExperiencePreview').mockResolvedValue({
    success: true, data: preview(),
  } as never)
}

describe('Home Builder', () => {
  test('الأنواع المعروضة هي ما يقبله الخادم لا قائمة مكتوبة في الواجهة', async () => {
    // كانت الواجهة تعرض `continue_journey` و`featured_series`، وهما نوعان يرفضهما
    // قيد CHECK، فإنشاء أيّهما يفشل بخطأ قاعدة بيانات غير مفهوم.
    stubList([block()])
    stubPreview()
    renderWithProviders(<AppExperiencePage />)

    await userEvent.click(await screen.findByRole('button', { name: /قسم جديد|Add section/ }))
    for (const type of meta.block_types) {
      // The list also shows the existing block's type, so the assertion is that
      // the picker offers each type at all, not that it appears once.
      expect((await screen.findAllByText(type)).length).toBeGreaterThan(0)
    }
    expect(screen.queryByText('continue_journey')).toBeNull()
    expect(screen.queryByText('featured_series')).toBeNull()
  })

  test('إعادة الترتيب تُرسل القائمة كاملة إلى الخادم', async () => {
    const blocks = [
      block({ id: 'a', title_ar: 'الأول', sort_order: 0 }),
      block({ id: 'b', title_ar: 'الثاني', sort_order: 1 }),
    ]
    stubList(blocks)
    stubPreview()
    const reorder = vi.spyOn(api, 'reorderHomeBlocks').mockResolvedValue({
      success: true, data: { order: ['b', 'a'] },
    } as never)

    renderWithProviders(<AppExperiencePage />)
    const down = await screen.findAllByRole('button', { name: /تحريك لأسفل|Move down/ })
    await userEvent.click(down[0])

    // الخادم يشترط القائمة الكاملة ويحدّد sort_order من موضع العنصر، فالمحفوظ هو
    // المعروض بالحرف.
    await waitFor(() => expect(reorder).toHaveBeenCalledWith(['b', 'a']))
  })

  test('الحفظ يُرسل الحقول المعدّلة ولا يكون متاحًا بلا تغيير', async () => {
    stubList([block()])
    stubPreview()
    const update = vi.spyOn(api, 'updateHomeBlock').mockResolvedValue({
      success: true, data: block({ title_ar: 'الهيرو الجديد' }),
    } as never)

    renderWithProviders(<AppExperiencePage />)
    const save = await screen.findByRole('button', { name: /^حفظ$|^Save$/ })
    // بلا تعديل لا شيء يُحفظ — وهذا عكس الحالة السابقة حيث كان الزرّ معطّلًا دائمًا.
    expect(save.hasAttribute('disabled')).toBe(true)

    const title = await screen.findByDisplayValue('الهيرو')
    await userEvent.clear(title)
    await userEvent.type(title, 'الهيرو الجديد')
    expect(save.hasAttribute('disabled')).toBe(false)

    await userEvent.click(save)
    await waitFor(() => expect(update).toHaveBeenCalled())
    const [, payload] = update.mock.calls[0]
    expect((payload as Record<string, unknown>).title_ar).toBe('الهيرو الجديد')
  })

  test('التعطيل يُرسل is_active صريحًا', async () => {
    stubList([block()])
    stubPreview()
    const update = vi.spyOn(api, 'updateHomeBlock').mockResolvedValue({
      success: true, data: block({ is_active: 0 }),
    } as never)

    renderWithProviders(<AppExperiencePage />)
    const enabled = await screen.findByRole('checkbox', { name: /مفعل|Enabled/ })
    await userEvent.click(enabled)
    await userEvent.click(screen.getByRole('button', { name: /^حفظ$|^Save$/ }))

    await waitFor(() => expect(update).toHaveBeenCalled())
    expect((update.mock.calls[0][1] as Record<string, unknown>).is_active).toBe(false)
  })

  test('النسخ تُقرأ من الخادم، ونسخة الإنشاء لا تُعرض كقابلة للاستعادة', async () => {
    stubList([block()])
    stubPreview()
    vi.spyOn(api, 'homeBlockVersions').mockResolvedValue({
      success: true,
      data: [
        { id: 'v2', created_at: '2026-08-15T10:00:00Z', action: 'update', actor_id: 'admin-1', before: {}, after: {}, restorable: true },
        { id: 'v1', created_at: '2026-08-14T10:00:00Z', action: 'create', actor_id: 'admin-1', before: null, after: {}, restorable: false },
      ],
      meta: { total: 2, legacy_records: 0, note: null },
    } as never)

    renderWithProviders(<AppExperiencePage />)
    await userEvent.click(await screen.findByRole('button', { name: /النسخ|Versions/ }))

    // الصفّان المخترعان اختفيا؛ ما يظهر هو ما أعاده الخادم — صفّان بفاعل حقيقي.
    expect((await screen.findAllByText('admin-1')).length).toBe(2)
    expect(screen.queryByText('v3')).toBeNull()
    expect(await screen.findByText(/نسخة الإنشاء|Creation record/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /استعادة|Restore/ })).toHaveLength(1)
  })

  test('الاستعادة تُرسل معرّف النسخة المختارة', async () => {
    stubList([block()])
    stubPreview()
    vi.spyOn(api, 'homeBlockVersions').mockResolvedValue({
      success: true,
      data: [{ id: 'v2', created_at: '2026-08-15T10:00:00Z', action: 'update', actor_id: 'admin-1', before: {}, after: {}, restorable: true }],
      meta: { total: 1, legacy_records: 0, note: null },
    } as never)
    const rollback = vi.spyOn(api, 'rollbackHomeBlock').mockResolvedValue({
      success: true, data: { block: block(), restored_from: 'v2' },
    } as never)

    renderWithProviders(<AppExperiencePage />)
    await userEvent.click(await screen.findByRole('button', { name: /النسخ|Versions/ }))
    await userEvent.click(await screen.findByRole('button', { name: /استعادة|Restore/ }))

    // الاستعادة «إلى آخر شيء» لا تُعرض للمسؤول ما سيحدث، فالمعرّف صريح.
    await waitFor(() => expect(rollback).toHaveBeenCalledWith('block-hero', 'v2'))
  })

  test('عدم وجود نسخ يُقال صراحة، والسجلات القديمة تُوصَف بأنها غير قابلة للاستعادة', async () => {
    stubList([block()])
    stubPreview()
    vi.spyOn(api, 'homeBlockVersions').mockResolvedValue({
      success: true,
      data: [],
      meta: { total: 0, legacy_records: 3, note: 'legacy' },
    } as never)

    renderWithProviders(<AppExperiencePage />)
    await userEvent.click(await screen.findByRole('button', { name: /النسخ|Versions/ }))
    expect(await screen.findByText(/لا نسخ محفوظة|No versions recorded/)).toBeTruthy()
    expect(await screen.findByText(/سجلات أقدم|Older records/)).toBeTruthy()
  })

  test('تشخيص المُحلِّل من الخادم لا من فلترة المتصفح', async () => {
    stubList([block(), block({ id: 'b', is_active: 0 })])
    stubPreview()
    renderWithProviders(<AppExperiencePage />)

    // «مطابق 1/2» و«معطل 1» أرقام أعادها المُحلِّل نفسه.
    expect(await screen.findByText('1/2')).toBeTruthy()
    expect(screen.queryByText(/Fallback applied: none/)).toBeNull()
  })

  test('فشل المعاينة يُعلَن ولا يُستبدل بمحاكاة محلية', async () => {
    stubList([block()])
    vi.spyOn(api, 'homeExperiencePreview').mockRejectedValue(new Error('preview down'))

    renderWithProviders(<AppExperiencePage />)
    // كانت الشاشة تفلتر القائمة محليًا بقواعد مختلفة عن الخادم وتسمّي النتيجة
    // معاينة، فيصبح الفشل جوابًا واثقًا خاطئًا.
    expect(await screen.findByText('preview down')).toBeTruthy()
  })

  test('لا يوجد زرّ معطَّل دائمًا، ولا أبعاد استهداف لا يطبّقها الخادم', async () => {
    stubList([block()])
    stubPreview()
    const { container } = renderWithProviders(<AppExperiencePage />)
    await screen.findByDisplayValue('الهيرو')

    // منتقي المحتوى غائب لأن الخادم لا يدعمه — لا معروضًا معطّلًا.
    expect(screen.queryByText(/اختيار المحتوى|Content picker/)).toBeNull()
    expect(await screen.findByText(/لا يوجد اختيار عناصر|no per-row item picker/)).toBeTruthy()

    // كل زرّ معطّل في اللحظة الأولى إمّا حفظ أو تراجع (بلا تغييرات) أو سهم عند حدّ
    // القائمة. لا زرّ يعلن إجراءً غير مُنفَّذ.
    const labels = [...container.querySelectorAll('button[disabled]')]
      .map((node) => node.textContent?.trim() ?? '')
    for (const label of labels) {
      expect(label).toMatch(/^(حفظ|Save|تراجع|Revert|↑|↓)$/)
    }

    // age_min/age_max كانا يُعرضان في جملة الاستهداف ولا يقرأهما أي مُحلِّل.
    expect(screen.queryByText(/age_min|age_max/)).toBeNull()
    expect(await screen.findByText(/أدنى إصدار تطبيق|Minimum app version/)).toBeTruthy()
  })
})
