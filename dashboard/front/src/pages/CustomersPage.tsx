import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Pagination } from '../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { usePreferences } from '../context/preferences'
import type { CustomerListRow } from '../types/api'

/**
 * قائمة العائلات: نقطة الدخول إلى Customer 360.
 *
 * ## لماذا منفصلة عن ParentsPage
 *
 * `ParentsPage` قراءة صحيحة لإسقاط الوالدين بلا كتابة، وهي كذلك بتصميم. هذه
 * الصفحة سؤال مختلف: «أي عائلة تحتاج تدخّلًا الآن» — فتحمل عدّاد تذاكر مفتوحة
 * وعدّاد أجهزة، وتفتح مساحة العمل لا صفحة قراءة.
 *
 * العدّادات من الإسقاط لا من مصدر السلطة بقصد: قائمة تنادي كائنًا دائمًا لكل صفّ
 * تعني خمسة وعشرين نداءً لكل صفحة. القراءة الحيّة تحدث في مساحة العمل حيث تخصّ
 * عائلة واحدة، وهي مُعلَنة هناك.
 */

const copy = {
  ar: {
    eyebrow: 'العملاء',
    title: 'العائلات',
    lede: 'نقطة الدخول إلى مساحة عمل العائلة. العدّادات هنا من إسقاط D1؛ القراءة الحيّة من مصدر السلطة تجري داخل مساحة العمل.',
    search: 'بحث بمعرّف العائلة…',
    allPlans: 'كل الباقات',
    allStatuses: 'كل الحالات',
    family: 'العائلة',
    plan: 'الباقة',
    status: 'الحالة',
    children: 'الأطفال',
    devices: 'الأجهزة',
    openTickets: 'تذاكر مفتوحة',
    open: 'مساحة العمل',
    empty: 'لا عائلات مطابقة',
    emptyHint: 'غيّر البحث أو الفلاتر.',
    loadError: 'تعذر تحميل العائلات',
  },
  en: {
    eyebrow: 'Customers',
    title: 'Families',
    lede: 'The entry point to the family workspace. Counts here come from the D1 projection; the live authority read happens inside the workspace.',
    search: 'Search by family id…',
    allPlans: 'All plans',
    allStatuses: 'All statuses',
    family: 'Family',
    plan: 'Plan',
    status: 'Status',
    children: 'Children',
    devices: 'Devices',
    openTickets: 'Open tickets',
    open: 'Workspace',
    empty: 'No matching families',
    emptyHint: 'Change the search or the filters.',
    loadError: 'Unable to load families',
  },
}

const LIMIT = 25
const PLANS = ['free', 'family', 'family_plus']
const STATUSES = ['active', 'suspended', 'deleted']

/// مفاتيح الفلاتر هي أسماء معاملات `GET /admin/customers` بالحرف (`q`, `plan`,
/// `status`, `limit`, `offset` في `api/src/routes/adminCustomer.ts`)، فرابط
/// «العائلات المعلَّقة» من اللوحة التنفيذية يفتح المجموعة نفسها التي عُدَّت.
const DEFAULT_FILTERS = { plan: '', status: '' }

const FILTER_FIELDS = (text: { allPlans: string; allStatuses: string; plan: string; status: string }): FilterField[] => [
  {
    key: 'plan',
    label: text.plan,
    type: 'select',
    options: [{ value: '', label: text.allPlans }, ...PLANS.map((item) => ({ value: item, label: item }))],
  },
  {
    key: 'status',
    label: text.status,
    type: 'select',
    options: [{ value: '', label: text.allStatuses }, ...STATUSES.map((item) => ({ value: item, label: item }))],
  },
]

/// أعمدة العدّادات قابلة للإخفاء، وعمود العائلة مُقفل: هو هوية الصفّ والرابط إلى
/// مساحة العمل، وإخفاؤه يترك جدولًا من أرقام بلا صاحب.
const COLUMNS: ColumnDefinition[] = [
  { key: 'family', label: 'family', locked: true },
  { key: 'plan', label: 'plan' },
  { key: 'status', label: 'status' },
  { key: 'children', label: 'children' },
  { key: 'devices', label: 'devices' },
  { key: 'openTickets', label: 'openTickets' },
]

export function CustomersPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const navigate = useNavigate()

  // العنوان هو حالة القائمة: عائلة معلَّقة على الباقة العائلية رابطٌ يُشارك، لا
  // سلسلة نقرات تُشرح لمن يستلم التذكرة بعدك.
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { query, filters, offset, limit } = list
  const { plan, status } = filters
  const [rows, setRows] = useState<CustomerListRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const columns = useColumnPreferences('customers', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.customers({
        q: query.trim() || undefined,
        plan: plan || undefined,
        status: status || undefined,
        limit,
        offset,
      })
      setRows(response.data)
      setTotal(response.meta?.total ?? response.data.length)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [limit, offset, plan, query, status, text.loadError])

  // لا أثر يُصفّر الترقيم عند تغيير الفلتر: `useUrlListState` يفعله في نفس
  // الكتابة التي تُغيّر الفلتر، فلا كتابتان في العنوان لكل ضغطة.
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, query ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load, query])

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><h3>{text.title} <span className="title-count">{total}</span></h3></div>
          <ListToolbar
            searchValue={query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={FILTER_FIELDS(text)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')}
            trailing={
              <>
                <SavedViewsMenu
                  storageKey="customers"
                  currentSearch={list.search}
                  onApply={(search) => navigate(`${adminPath('customers')}${search}`)}
                />
                <ColumnManager
                  columns={COLUMNS.map((column) => ({ ...column, label: text[column.label as keyof typeof text] }))}
                  hidden={columns.hidden}
                  onToggle={columns.toggle}
                  onReset={columns.reset}
                />
              </>
            }
          />
        </header>

        {loading && !rows.length ? <LoadingState /> : error && !rows.length ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : rows.length ? (
          <>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.family}</th>
                    {columns.isVisible('plan') && <th>{text.plan}</th>}
                    {columns.isVisible('status') && <th>{text.status}</th>}
                    {columns.isVisible('children') && <th>{text.children}</th>}
                    {columns.isVisible('devices') && <th>{text.devices}</th>}
                    {columns.isVisible('openTickets') && <th>{text.openTickets}</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.parent_id}>
                      <td>
                        <Link className="entity-cell entity-cell--button" to={adminPath(`customers/${row.parent_id}`)}>
                          <div><strong dir="ltr">{row.parent_id}</strong></div>
                        </Link>
                      </td>
                      {columns.isVisible('plan') && <td>{row.plan}</td>}
                      {columns.isVisible('status') && (
                        <td>
                          <span className={`account-status account-status--${row.status === 'active' ? 'active' : 'archived'}`}>
                            {row.status}
                          </span>
                        </td>
                      )}
                      {columns.isVisible('children') && <td>{row.child_count}</td>}
                      {columns.isVisible('devices') && <td>{row.device_count}</td>}
                      {columns.isVisible('openTickets') && (
                        <td>
                          {row.open_tickets > 0
                            ? <span className="readiness-item readiness-item--warn readiness-pill">{row.open_tickets}</span>
                            : <span className="table-secondary">0</span>}
                        </td>
                      )}
                      <td>
                        <Link className="button button--ghost" to={adminPath(`customers/${row.parent_id}`)}>{text.open}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </>
        ) : <EmptyState title={text.empty} description={text.emptyHint} />}
      </section>
    </div>
  )
}
