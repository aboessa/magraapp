import { describe, expect, test, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './harness'
import { Kanban } from '../components/Kanban'
import { SectionEditor } from '../components/SectionEditor'
import type { KanbanCard } from '../components/Kanban'
import type { WebSectionDraft } from '../types/api'

/**
 * اختبارات لوحة الكانبان وسحب أقسام الموقع.
 *
 * ## ما تحميه
 *
 * **الكانبان**: أنها لا تعرض نقلة لا يسمح بها الخادم، وأنها تتراجع عند الرفض،
 * وأن كل نقلة قابلة للتنفيذ بلوحة المفاتيح. الأخيرة ليست تحسينًا: السحب بالماوس
 * لا يمكن تنفيذه بلوحة مفاتيح، فلو كان الطريق الوحيد لصارت إعادة الترتيب ميزة
 * لبعض المستخدمين فقط.
 *
 * **أقسام الموقع**: أن المقبض هو القابل للسحب لا البطاقة (بطاقة قابلة للسحب
 * تمنع تحديد النصّ في حقولها)، وأن الترتيب ترتيب مصفوفة يبلّغه `onChange` —
 * لأن `PUT /sections` يتجاهل أي `sort_order` من العميل ويستعمل موضع العنصر.
 */

const card = (overrides: Partial<KanbanCard> = {}): KanbanCard => ({
  id: 't1',
  column: 'open',
  title: 'لا يمكن تسجيل الدخول',
  subtitle: 'SUP-1',
  allowedTargets: ['in_progress', 'resolved'],
  ...overrides,
})

const COLUMNS = [
  { key: 'open', label: 'مفتوحة' },
  { key: 'in_progress', label: 'قيد العمل' },
  { key: 'resolved', label: 'محلولة' },
  { key: 'closed', label: 'مغلقة' },
]

describe('Kanban', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  test('cards sit in the column their state names, and counts follow', () => {
    renderWithProviders(
      <Kanban
        columns={COLUMNS}
        cards={[card(), card({ id: 't2', column: 'resolved', title: 'مسألة أخرى' })]}
        onMove={async () => {}}
        onOpen={() => {}}
      />,
    )
    const open = screen.getByRole('region', { name: /مفتوحة — 1/ })
    expect(within(open).getByText('لا يمكن تسجيل الدخول')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /محلولة — 1/ })).toBeInTheDocument()
    // العمود الفارغ يقول ذلك بدل أن يبدو معطوبًا.
    expect(screen.getAllByText('لا عناصر').length).toBe(2)
  })

  test('the move list offers only the targets the server allows', async () => {
    renderWithProviders(
      <Kanban columns={COLUMNS} cards={[card()]} onMove={async () => {}} onOpen={() => {}} />,
    )
    const select = screen.getByLabelText('نقل إلى') as HTMLSelectElement
    const options = [...select.options].map((option) => option.value).filter(Boolean)
    // `closed` مسموح في الخادم من `open`، لكن البطاقة هنا تُصرّح بهدفين فقط —
    // فاللوحة تعرض ما أُعطي لها لا ما تظنّه.
    expect(options).toEqual(['in_progress', 'resolved'])
  })

  test('a card with no allowed target is not draggable and states why', () => {
    renderWithProviders(
      <Kanban
        columns={COLUMNS}
        cards={[card({ column: 'closed', allowedTargets: [], lockedReason: 'المغلقة نهائية.' })]}
        onMove={async () => {}}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByText('المغلقة نهائية.')).toBeInTheDocument()
    expect(screen.queryByLabelText('نقل إلى')).not.toBeInTheDocument()
    expect(screen.getByText('لا يمكن تسجيل الدخول').closest('li')).toHaveAttribute('draggable', 'false')
  })

  test('the keyboard move calls onMove with the chosen column', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <Kanban columns={COLUMNS} cards={[card()]} onMove={onMove} onOpen={() => {}} />,
    )
    await userEvent.selectOptions(screen.getByLabelText('نقل إلى'), 'in_progress')
    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1))
    expect(onMove.mock.calls[0][0].id).toBe('t1')
    expect(onMove.mock.calls[0][1]).toBe('in_progress')
  })

  test('the card moves optimistically and stays when the server accepts', async () => {
    renderWithProviders(
      <Kanban
        columns={COLUMNS}
        cards={[card()]}
        onMove={async () => new Promise((resolve) => setTimeout(resolve, 10))}
        onOpen={() => {}}
      />,
    )
    await userEvent.selectOptions(screen.getByLabelText('نقل إلى'), 'in_progress')
    await waitFor(() => {
      const target = screen.getByRole('region', { name: /قيد العمل — 1/ })
      expect(within(target).getByText('لا يمكن تسجيل الدخول')).toBeInTheDocument()
    })
  })

  test('a rejected move returns the card and shows the server message', async () => {
    renderWithProviders(
      <Kanban
        columns={COLUMNS}
        cards={[card()]}
        onMove={async () => { throw new Error('انتقال غير مسموح من «open» إلى «resolved».') }}
        onOpen={() => {}}
      />,
    )
    await userEvent.selectOptions(screen.getByLabelText('نقل إلى'), 'resolved')
    // الرسالة كما جاءت من الخادم، والبطاقة عادت إلى عمودها.
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('انتقال غير مسموح'))
    const open = screen.getByRole('region', { name: /مفتوحة — 1/ })
    expect(within(open).getByText('لا يمكن تسجيل الدخول')).toBeInTheDocument()
  })

  test('opening a card is a separate action from moving it', async () => {
    const onOpen = vi.fn()
    const onMove = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <Kanban columns={COLUMNS} cards={[card()]} onMove={onMove} onOpen={onOpen} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /لا يمكن تسجيل الدخول/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onMove).not.toHaveBeenCalled()
  })

  test('a work-in-progress limit warns rather than blocks', () => {
    renderWithProviders(
      <Kanban
        columns={[{ key: 'open', label: 'مفتوحة', wipLimit: 1 }]}
        cards={[card(), card({ id: 't2', title: 'ثانية' })]}
        onMove={async () => {}}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByText(/فوق الحدّ العملي/)).toBeInTheDocument()
    // كلتا البطاقتين معروضة: الحدّ إشارة تشغيلية لا منع.
    expect(screen.getByText('ثانية')).toBeInTheDocument()
  })
})

// --- أقسام الموقع ----------------------------------------------------------

const section = (key: string, type = 'rich_text'): WebSectionDraft => ({
  key,
  section_type: type as WebSectionDraft['section_type'],
  is_active: true,
  content: { body: `نصّ ${key}` },
  cta: {},
  media_asset_id: null,
})

describe('SectionEditor reordering', () => {
  test('the handle is draggable and the card is not', () => {
    renderWithProviders(
      <SectionEditor sections={[section('a'), section('b')]} onChange={() => {}} canEdit />,
    )
    // بطاقة قابلة للسحب تمنع تحديد النصّ داخل حقولها، فمن يسحب ليحدّد عنوانًا
    // يُعيد ترتيب الصفحة بدل ذلك.
    const handles = screen.getAllByLabelText(/مقبض السحب/)
    expect(handles[0]).toHaveAttribute('draggable', 'true')
    expect(handles[0].closest('li')).not.toHaveAttribute('draggable', 'true')
  })

  test('a read-only editor exposes no drag handle', () => {
    renderWithProviders(
      <SectionEditor sections={[section('a')]} onChange={() => {}} canEdit={false} />,
    )
    expect(screen.queryByLabelText(/مقبض السحب/)).not.toBeInTheDocument()
  })

  test('dropping one section on another reports the new array order', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <SectionEditor sections={[section('a'), section('b'), section('c')]} onChange={onChange} canEdit />,
    )
    const handles = screen.getAllByLabelText(/مقبض السحب/)
    const cards = screen.getAllByLabelText(/مقبض السحب/).map((handle) => handle.closest('li')!)

    // jsdom لا ينقل DataTransfer بين الحدثين، فيُمرَّر صراحةً كما يفعل المتصفح.
    const data = new Map<string, string>()
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
      effectAllowed: 'move',
    }
    await userEvent.pointer({ target: handles[0]! })
    handles[0]!.dispatchEvent(Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer }))
    cards[2]!.dispatchEvent(Object.assign(new Event('dragover', { bubbles: true, cancelable: true }), { dataTransfer }))
    cards[2]!.dispatchEvent(Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer }))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    // الترتيب هو ترتيب المصفوفة: الخادم يتجاهل أي `sort_order` من العميل.
    expect(onChange.mock.calls.at(-1)![0].map((entry: WebSectionDraft) => entry.key)).toEqual(['b', 'c', 'a'])
  })

  test('the up and down buttons are the keyboard path to the same reorder', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <SectionEditor sections={[section('a'), section('b')]} onChange={onChange} canEdit />,
    )
    await userEvent.click(screen.getAllByLabelText('تحريك لأسفل')[0]!)
    expect(onChange.mock.calls.at(-1)![0].map((entry: WebSectionDraft) => entry.key)).toEqual(['b', 'a'])
  })
})
