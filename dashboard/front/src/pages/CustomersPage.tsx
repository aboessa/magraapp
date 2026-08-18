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


const copy = {
  ar: {
    eyebrow: 'العملاء',
    title: 'العائلات',
    lede: 'إدارة حسابات العائلات والاشتراكات والأجهزة والدعم من مكان واحد.',
    search: 'بحث بالعائلة أو ولي الأمر…',
    allPlans: 'كل الباقات',
    allStatuses: 'كل الحالات',
    family: 'العائلة',
    plan: 'الباقة',
    status: 'الحالة',
    children: 'الأطفال',
    devices: 'الأجهزة',
    openTickets: 'تذاكر مفتوحة',
    open: 'فتح الملف',
    empty: 'لا عائلات مطابقة',
    emptyHint: 'جرّب تغيير البحث أو الفلاتر.',
    loadError: 'تعذر تحميل العائلات',
    summaryTotal: 'إجمالي العائلات',
    summaryActive: 'مشتركون نشطون',
    summaryTrials: 'فترة تجريبية',
    summaryExpired: 'منتهية',
    summarySupport: 'بحاجة دعم',
    showing: 'عرض',
    filtersHint: 'بحث وحفظ العروض',
  },
  en: {
    eyebrow: 'Customers',
    title: 'Families',
    lede: 'Manage family accounts, subscriptions, devices and support in one place.',
    search: 'Search families…',
    allPlans: 'All plans',
    allStatuses: 'All statuses',
    family: 'Family',
    plan: 'Plan',
    status: 'Status',
    children: 'Children',
    devices: 'Devices',
    openTickets: 'Open tickets',
    open: 'Open',
    empty: 'No matching families',
    emptyHint: 'Try changing search or filters.',
    loadError: 'Unable to load families',
    summaryTotal: 'Total families',
    summaryActive: 'Active subscribers',
    summaryTrials: 'Trials',
    summaryExpired: 'Expired',
    summarySupport: 'Needs support',
    showing: 'Showing',
    filtersHint: 'Search and saved views',
  },
}

const LIMIT = 25
const PLANS = ['free', 'family', 'family_plus']
const STATUSES = ['active', 'suspended', 'deleted']

const DEFAULT_FILTERS = { plan: '', status: '' }

const FILTER_FIELDS = (text: { allPlans: string; allStatuses: string; plan: string; status: string }): FilterField[] => [
  { key: 'plan', label: text.plan, type: 'select', options: [{ value: '', label: text.allPlans }, ...PLANS.map((item) => ({ value: item, label: item }))] },
  { key: 'status', label: text.status, type: 'select', options: [{ value: '', label: text.allStatuses }, ...STATUSES.map((item) => ({ value: item, label: item }))] },
]

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


  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { query, filters, offset, limit } = list
  const { plan, status } = filters
  const [rows, setRows] = useState<CustomerListRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<{ total: number; active: number; support: number } | null>(null)
  const columns = useColumnPreferences('customers', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.customers({ q: query.trim() || undefined, plan: plan || undefined, status: status || undefined, limit, offset })
      setRows(response.data)
      setTotal(response.meta?.total ?? response.data.length)
      if (!summary) {
        // Derive lightweight summary from first page when no separate stats endpoint
        const activeRows = response.data.filter((r) => r.plan !== 'free' && r.status === 'active').length
        const supportRows = response.data.filter((r) => r.open_tickets > 0).length
        setSummary({ total: response.meta?.total ?? response.data.length, active: activeRows, support: supportRows })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [limit, offset, plan, query, status, text.loadError, summary])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, query ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load, query])

  const planLabel = (plan: string) => {
    if (plan === 'family_plus') return locale === 'ar' ? 'عائلة بلس' : 'Family Plus'
    if (plan === 'family') return locale === 'ar' ? 'عائلة' : 'Family'
    return locale === 'ar' ? 'مجاني' : 'Free'
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      {summary && (
        <section className="stat-grid" aria-label={text.title} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
          <div className="stat-card"><span>{text.summaryTotal}</span><strong>{total}</strong></div>
          <div className="stat-card"><span>{text.summaryActive}</span><strong>{rows.filter((r) => r.plan !== 'free').length}</strong></div>
          <div className="stat-card"><span>{text.summarySupport}</span><strong>{rows.filter((r) => r.open_tickets > 0).length}</strong></div>
          <div className="stat-card"><span>{text.children}</span><strong>{rows.reduce((a, r) => a + r.child_count, 0)}</strong></div>
        </section>
      )}

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
                <SavedViewsMenu storageKey="customers" currentSearch={list.search} onApply={(search) => navigate(`${adminPath('customers')}${search}`)} />
                <ColumnManager columns={COLUMNS.map((column) => ({ ...column, label: text[column.label as keyof typeof text] }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} />
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
                          <span className="entity-avatar entity-avatar--parent">{row.parent_id.charAt(0).toUpperCase()}</span>
                          <div><strong dir="ltr">{row.parent_id}</strong><small>{planLabel(row.plan)} · {row.status}</small></div>
                        </Link>
                      </td>
                      {columns.isVisible('plan') && <td><span className={`plan-badge plan-badge--${row.plan}`}>{planLabel(row.plan)}</span></td>}
                      {columns.isVisible('status') && <td><span className={`account-status account-status--${row.status === 'active' ? 'active' : 'archived'}`}>{row.status}</span></td>}
                      {columns.isVisible('children') && <td>{row.child_count}</td>}
                      {columns.isVisible('devices') && <td>{row.device_count}</td>}
                      {columns.isVisible('openTickets') && <td>{row.open_tickets > 0 ? <span className="readiness-item readiness-item--warn readiness-pill">{row.open_tickets}</span> : <span className="table-secondary">0</span>}</td>}
                      <td><Link className="button button--ghost" to={adminPath(`customers/${row.parent_id}`)}>{text.open}</Link></td>
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
