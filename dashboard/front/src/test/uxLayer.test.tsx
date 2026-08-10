import { describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useUrlListState } from '../hooks/useUrlListState'
import { ActiveFilterChips, ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { BulkActionBar, ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import { renderWithProviders } from './harness'

/**
 * اختبارات طبقة UX المشتركة.
 *
 * ## الخاصية المُثبَّتة
 *
 * حالة القائمة تعيش في عنوان الصفحة، وليس في `useState`. هذا ليس تفصيلًا
 * تقنيًا: كل بطاقة في اللوحة التنفيذية تربط إلى شاشة مفلترة برابط، وأي شاشة
 * تحفظ فلترها محليًا تفتح غير مفلترة من ذلك الرابط. الاختبارات هنا تقيس ذلك من
 * الاتجاهين: الرابط يُنتج فلترة، والفلترة تُنتج رابطًا.
 */

const FILTERS = { status: '', language: '' }

const FIELDS: FilterField[] = [
  {
    key: 'status',
    label: 'الحالة',
    type: 'select',
    options: [
      { value: '', label: 'كل الحالات' },
      { value: 'published', label: 'منشورة' },
      { value: 'draft', label: 'مسوّدة' },
    ],
  },
  {
    key: 'language',
    label: 'اللغة',
    type: 'select',
    options: [
      { value: '', label: 'كل اللغات' },
      { value: 'ar', label: 'ar' },
      { value: 'en', label: 'en' },
    ],
  },
]

function Probe() {
  const state = useUrlListState(FILTERS, { limit: 10 })
  return (
    <div>
      <output data-testid="status">{state.filters.status || 'none'}</output>
      <output data-testid="query">{state.query || 'none'}</output>
      <output data-testid="offset">{state.offset}</output>
      <output data-testid="count">{state.activeFilterCount}</output>
      <output data-testid="search">{state.search}</output>
      <button type="button" onClick={() => state.setFilter('status', 'published')}>set status</button>
      <button type="button" onClick={() => state.setOffset(30)}>page 2</button>
      <button type="button" onClick={() => state.setQuery('mazen')}>search</button>
      <button type="button" onClick={() => state.clearFilters()}>clear</button>
    </div>
  )
}

describe('useUrlListState', () => {
  test('reads filters out of the URL so a shared link opens filtered', () => {
    renderWithProviders(<Probe />, { route: '/list?status=draft&offset=20' })
    expect(screen.getByTestId('status')).toHaveTextContent('draft')
    expect(screen.getByTestId('offset')).toHaveTextContent('20')
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  test('writes a filter into the URL', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Probe />, { route: '/list' })
    await user.click(screen.getByText('set status'))
    expect(screen.getByTestId('status')).toHaveTextContent('published')
    expect(screen.getByTestId('search')).toHaveTextContent('status=published')
  })

  test('changing a filter resets the page', async () => {
    // Staying on page four after narrowing the filter shows "no results" over a set
    // that has results, which reads as a bug in the data.
    const user = userEvent.setup()
    renderWithProviders(<Probe />, { route: '/list?offset=40' })
    expect(screen.getByTestId('offset')).toHaveTextContent('40')
    await user.click(screen.getByText('set status'))
    expect(screen.getByTestId('offset')).toHaveTextContent('0')
  })

  test('paging does not reset the filters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Probe />, { route: '/list?status=draft' })
    await user.click(screen.getByText('page 2'))
    expect(screen.getByTestId('offset')).toHaveTextContent('30')
    expect(screen.getByTestId('status')).toHaveTextContent('draft')
  })

  test('a default value is not written to the URL', async () => {
    // Otherwise every link carries ?status= and the shared URL stops being readable.
    const user = userEvent.setup()
    renderWithProviders(<Probe />, { route: '/list?status=draft' })
    await user.click(screen.getByText('clear'))
    expect(screen.getByTestId('search')).toHaveTextContent('')
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  test('search is part of the URL state', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Probe />, { route: '/list' })
    await user.click(screen.getByText('search'))
    expect(screen.getByTestId('query')).toHaveTextContent('mazen')
    expect(screen.getByTestId('search')).toHaveTextContent('q=mazen')
  })
})

describe('filter drawer and chips', () => {
  test('the drawer does not apply until the apply button is pressed', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    renderWithProviders(
      <ListToolbar
        fields={FIELDS}
        values={FILTERS}
        defaults={FILTERS}
        onApply={onApply}
        onClear={() => {}}
        onRemove={() => {}}
      />,
      { route: '/list' },
    )

    await user.click(screen.getByRole('button', { name: /فلاتر/ }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(screen.getByLabelText('الحالة'), 'published')
    // Eight fields applying on every keystroke means eight requests and eight
    // intermediate states nobody asked for.
    expect(onApply).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /تطبيق/ }))
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  test('Escape closes the drawer without applying', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    renderWithProviders(
      <ListToolbar fields={FIELDS} values={FILTERS} defaults={FILTERS} onApply={onApply} onClear={() => {}} onRemove={() => {}} />,
      { route: '/list' },
    )
    await user.click(screen.getByRole('button', { name: /فلاتر/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onApply).not.toHaveBeenCalled()
  })

  test('the filter button counts only filters that differ from the default', () => {
    renderWithProviders(
      <ListToolbar
        fields={FIELDS}
        values={{ status: 'draft', language: '' }}
        defaults={FILTERS}
        onApply={() => {}}
        onClear={() => {}}
        onRemove={() => {}}
      />,
      { route: '/list' },
    )
    expect(screen.getByRole('button', { name: /فلاتر/ })).toHaveTextContent('1')
  })

  test('each applied filter is a removable chip', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    renderWithProviders(
      <ActiveFilterChips
        fields={FIELDS}
        values={{ status: 'draft', language: 'ar' }}
        defaults={FILTERS}
        onRemove={onRemove}
        onClearAll={() => {}}
      />,
      { route: '/list' },
    )
    expect(screen.getByText('الحالة: مسوّدة')).toBeInTheDocument()
    expect(screen.getByText('اللغة: ar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /إزالة الفلتر: الحالة/ }))
    expect(onRemove).toHaveBeenCalledWith('status')
  })

  test('no chips render when nothing is filtered', () => {
    const { container } = renderWithProviders(
      <ActiveFilterChips fields={FIELDS} values={FILTERS} defaults={FILTERS} onRemove={() => {}} onClearAll={() => {}} />,
      { route: '/list' },
    )
    expect(container.querySelector('.filter-chips')).toBeNull()
  })
})

describe('saved views', () => {
  test('a saved view replays the exact query string', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    renderWithProviders(
      <SavedViewsMenu storageKey="test-views" currentSearch="?status=draft&language=ar" onApply={onApply} />,
      { route: '/list' },
    )
    await user.click(screen.getByRole('button', { name: /عروض محفوظة/ }))
    await user.click(screen.getByRole('button', { name: /حفظ العرض الحالي/ }))
    await user.type(screen.getByLabelText('اسم العرض'), 'مسوّدات عربية')
    await user.click(screen.getByRole('button', { name: 'حفظ' }))

    await user.click(screen.getByRole('button', { name: 'مسوّدات عربية' }))
    expect(onApply).toHaveBeenCalledWith('?status=draft&language=ar')
  })

  test('the local-only scope is stated in the UI, not hidden', async () => {
    // A view that looks shared but the colleague cannot see is worse than none.
    const user = userEvent.setup()
    renderWithProviders(<SavedViewsMenu storageKey="test-views" currentSearch="" onApply={() => {}} />, { route: '/list' })
    await user.click(screen.getByRole('button', { name: /عروض محفوظة/ }))
    expect(screen.getByText(/محفوظة في هذا المتصفح فقط/)).toBeInTheDocument()
  })
})

describe('column manager', () => {
  const COLUMNS = [
    { key: 'title', label: 'العنوان', locked: true },
    { key: 'status', label: 'الحالة' },
  ]

  function ColumnProbe() {
    const columns = useColumnPreferences('test-columns', COLUMNS)
    return (
      <div>
        <ColumnManager columns={COLUMNS} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} />
        <output data-testid="visible">{COLUMNS.filter((column) => columns.isVisible(column.key)).map((column) => column.key).join(',')}</output>
      </div>
    )
  }

  test('hiding a column persists and a locked column cannot be hidden', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ColumnProbe />, { route: '/list' })
    await user.click(screen.getByRole('button', { name: /الأعمدة/ }))

    expect(screen.getByRole('checkbox', { name: /العنوان/ })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'الحالة' }))
    expect(screen.getByTestId('visible')).toHaveTextContent('title')
    expect(window.localStorage.getItem('majarra-admin-columns:test-columns')).toContain('status')
  })
})

describe('bulk action bar', () => {
  test('it stays hidden with nothing selected', () => {
    renderWithProviders(
      <BulkActionBar count={0} actions={[{ key: 'x', label: 'نشر', onRun: () => {} }]} onClear={() => {}} />,
      { route: '/list' },
    )
    expect(screen.queryByRole('region')).toBeNull()
  })

  test('it reports the selection and runs the action', async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()
    renderWithProviders(
      <BulkActionBar count={3} actions={[{ key: 'publish', label: 'نشر المحدَّد', onRun }]} onClear={() => {}} />,
      { route: '/list' },
    )
    expect(screen.getByRole('region')).toHaveTextContent('3')
    await user.click(screen.getByRole('button', { name: 'نشر المحدَّد' }))
    expect(onRun).toHaveBeenCalledOnce()
  })

  test('actions are disabled while a bulk run is in flight', () => {
    renderWithProviders(
      <BulkActionBar count={2} busy actions={[{ key: 'publish', label: 'نشر', onRun: () => {} }]} onClear={() => {}} />,
      { route: '/list' },
    )
    expect(screen.getByRole('button', { name: 'نشر' })).toBeDisabled()
  })
})
