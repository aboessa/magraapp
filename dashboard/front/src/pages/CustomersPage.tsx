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
import { Icon } from '../components/Icon'
import { formatNumber } from '../lib/labels'
import type { CustomerListRow } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'إدارة الحسابات والعملاء 360',
    title: 'مركز ملف العميل 360 — العائلات والاشتراكات',
    lede: 'إدارة مركزية موحدة لحسابات أولياء الأمور، الاشتراكات الفعالة، الأجهزة المرخصة، وملفات الأطفال مع رادار الدعم الفني.',
    search: 'بحث بمعرّف العائلة أو ولي الأمر...',
    allPlans: 'كل الباقات',
    allStatuses: 'كل الحالات',
    family: 'العائلة',
    plan: 'الباقة',
    status: 'الحالة',
    children: 'الأطفال',
    devices: 'الأجهزة',
    openTickets: 'تذاكر مفتوحة',
    open: 'فتح ملف 360',
    empty: 'لا توجد عائلات مطابقة',
    emptyHint: 'جرّب تغيير معايير البحث أو تصفية الباقات.',
    loadError: 'تعذر تحميل حسابات العائلات',
    summaryTotal: 'إجمالي العائلات',
    summaryActive: 'مشتركون نشطون',
    summarySupport: 'بحاجة دعم فني',
    cardsView: 'بطاقات العائلات',
    tableView: 'الجدول الشامل',
    refresh: 'تحديث البيانات',
  },
  en: {
    eyebrow: 'Customer Accounts 360',
    title: 'Customer 360 — Subscribed Families',
    lede: 'Centralized command center for parent accounts, active subscriptions, authorized hardware, and children profiles.',
    search: 'Search family ID or parent...',
    allPlans: 'All Plans',
    allStatuses: 'All Statuses',
    family: 'Family',
    plan: 'Plan',
    status: 'Status',
    children: 'Children',
    devices: 'Devices',
    openTickets: 'Open Tickets',
    open: 'Open 360 Profile',
    empty: 'No matching families',
    emptyHint: 'Try changing search query or plan filters.',
    loadError: 'Unable to load family accounts',
    summaryTotal: 'Total Families',
    summaryActive: 'Active Subscribers',
    summarySupport: 'Needs Support',
    cardsView: 'Family Cards',
    tableView: 'Detailed Table',
    refresh: 'Refresh Data',
  },
}

const LIMIT = 25
const PLANS = ['free', 'family', 'family_plus']
const STATUSES = ['active', 'suspended', 'deleted']
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
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [rows, setRows] = useState<CustomerListRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDrawerCustomer, setSelectedDrawerCustomer] = useState<CustomerListRow | null>(null)
  const [copiedId, setCopiedId] = useState(false)
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
      setRows(response.data || [])
      setTotal(response.meta?.total ?? response.data?.length ?? 0)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [limit, offset, plan, query, status, text.loadError])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, query ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load, query])

  const planLabel = (p: string) => {
    if (p === 'family_plus') return locale === 'ar' ? 'عائلة بلس (Family+)' : 'Family Plus'
    if (p === 'family') return locale === 'ar' ? 'عائلة (Family)' : 'Family'
    return locale === 'ar' ? 'مجاني (Free)' : 'Free'
  }

  const activeSubscribersCount = rows.filter((r) => r.plan !== 'free' && r.status === 'active').length
  const totalChildrenCount = rows.reduce((a, r) => a + (r.child_count || 0), 0)
  const needsSupportCount = rows.filter((r) => r.open_tickets > 0).length

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const exportCSV = () => {
    if (!rows.length) return
    const headers = ['Parent_ID', 'Plan', 'Status', 'Children_Count', 'Device_Count', 'Open_Tickets']
    const csvRows = rows.map((r) => [
      r.parent_id,
      r.plan,
      r.status,
      String(r.child_count ?? 0),
      String(r.device_count ?? 0),
      String(r.open_tickets ?? 0),
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...csvRows].map((e) => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `customers_360_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="content-studio-root">
      {/* 1. Command Strip */}
      <header className="commercial-command-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818cf8',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <span className="status-dot-pulse" style={{ background: '#6366f1' }} />
            <span>محرك هوية العائلات متصل (FamilyState Vault)</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              borderRadius: 12,
              background: 'var(--surface-2)',
              border: '1px solid var(--cs-glass-border)',
              gap: 4,
            }}
          >
            <button
              type="button"
              className={`button ${filters.plan === '' ? 'button--primary' : 'button--ghost'} button--small`}
              style={{ padding: '5px 12px', fontSize: 12, fontWeight: filters.plan === '' ? 800 : 500 }}
              onClick={() => list.setFilter('plan', '')}
            >
              {text.allPlans}
            </button>
            {PLANS.map((p) => (
              <button
                key={p}
                type="button"
                className={`button ${filters.plan === p ? 'button--primary' : 'button--ghost'} button--small`}
                style={{ padding: '5px 12px', fontSize: 12, fontWeight: filters.plan === p ? 800 : 500 }}
                onClick={() => list.setFilter('plan', p)}
              >
                {planLabel(p)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={exportCSV}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="download" size={14} />
            <span>تصدير CSV</span>
          </button>

          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => void load()}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh" size={14} />
            <span>{text.refresh}</span>
          </button>
        </div>
      </header>

      {/* 2. Hero Panoramic Banner */}
      <section className="catalog-hero" style={{ marginBottom: 20 }}>
        <div
          className="catalog-hero__glow"
          style={{
            background:
              'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.15) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#6366f1' }} />
              {formatNumber(total, locale)} عائلة موثقة
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Support Triage Alert Banner if open tickets exist */}
      {needsSupportCount > 0 && (
        <div
          style={{
            margin: '0 0 20px',
            padding: '16px 20px',
            borderRadius: 16,
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="bell" size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
                تنبيه الدعم الفني: يوجد {needsSupportCount} عائلة لديها تذاكر مساعدة مفتوحة تنتظر الرد
              </div>
              <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                قم بمراجعة تذاكر العائلات المتأثرة لضمان الالتزام بمعايير SLA ورضا أولياء الأمور.
              </small>
            </div>
          </div>

          <Link
            className="button button--secondary button--small"
            to={adminPath('support-center')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="sparkles" size={14} />
            <span>فتح مركز الدعم المباشر</span>
          </Link>
        </div>
      )}

      {/* 4. Executive Customer Bento Matrix */}
      <div className="commercial-bento-grid">
        <div
          className="commercial-bento-card"
          onClick={() => list.clearFilters()}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}
            >
              <Icon name="parents" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>ALL FAMILIES</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{formatNumber(total, locale)}</div>
            <div className="commercial-bento-card__label">{text.summaryTotal}</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: '#818cf8' }}>✓ مسجلة في FamilyState</span>
            <span>انقر لإلغاء الفلاتر</span>
          </div>
        </div>

        <div
          className="commercial-bento-card"
          onClick={() => list.setFilter('plan', 'family')}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #10b981, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
            >
              <Icon name="check" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>ACTIVE SUBS</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{formatNumber(activeSubscribersCount, locale)}</div>
            <div className="commercial-bento-card__label">{text.summaryActive}</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: '#10b981' }}>اشتراكات عائلية مدفوعة</span>
            <span>باقات مفعلة</span>
          </div>
        </div>

        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #ec4899, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}
            >
              <Icon name="children" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#ec4899' }}>CHILDREN PROFILES</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{formatNumber(totalChildrenCount, locale)}</div>
            <div className="commercial-bento-card__label">{text.children}</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: '#ec4899' }}>ملفات أطفال مرتبطة بالعائلات</span>
          </div>
        </div>

        <div
          className="commercial-bento-card"
          onClick={() => navigate(adminPath('support-center'))}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
            >
              <Icon name="warning" size={22} />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: needsSupportCount > 0 ? '#f59e0b' : '#10b981',
              }}
            >
              TICKETS QUEUE
            </span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{formatNumber(needsSupportCount, locale)}</div>
            <div className="commercial-bento-card__label">{text.summarySupport}</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: needsSupportCount > 0 ? '#f59e0b' : '#10b981' }}>
              {needsSupportCount > 0 ? 'تذاكر بانتظار الرد والمتابعة' : 'لا توجد تذاكر معلقة'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Catalog Control Strip */}
      <section className="catalog-control-strip">
        <div style={{ flex: 1 }}>
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
        </div>

        <div className="catalog-control-strip__right" style={{ alignSelf: 'center' }}>
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${view === 'cards' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setView('cards')}
            >
              <Icon name="grid" size={14} />
              <span>{text.cardsView}</span>
            </button>
            <button
              className={`view-mode-btn ${view === 'table' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setView('table')}
            >
              <Icon name="bars" size={14} />
              <span>{text.tableView}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 6. Active View Presentation */}
      {loading && !rows.length ? (
        <LoadingState label="جارٍ تحميل سجلات العائلات..." />
      ) : error && !rows.length ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <EmptyState title={text.empty} description={text.emptyHint} />
      ) : view === 'cards' ? (
        <>
          <div className="customer-360-grid">
            {rows.map((row) => (
              <article key={row.parent_id} className="customer-family-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: 16,
                      }}
                    >
                      {row.parent_id.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: 15, color: 'var(--text)' }} dir="ltr">
                        {row.parent_id}
                      </strong>
                      <span
                        style={{
                          fontSize: 11,
                          color: row.status === 'active' ? '#10b981' : '#f87171',
                          fontWeight: 700,
                        }}
                      >
                        {row.status === 'active' ? '● حساب نشط' : '● معلق'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`plan-badge plan-badge--${row.plan}`}
                    style={{ fontSize: 11, fontWeight: 800 }}
                  >
                    {planLabel(row.plan)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    background: 'var(--surface-2)',
                    padding: '12px',
                    borderRadius: 14,
                    textAlign: 'center',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>{row.child_count}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>أطفال</div>
                  </div>
                  <div style={{ borderInline: '1px solid var(--cs-glass-border)' }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>
                      {row.device_count === null || row.device_count === undefined ? '—' : row.device_count}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>أجهزة</div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 900,
                        color: row.open_tickets > 0 ? '#fbbf24' : '#10b981',
                      }}
                    >
                      {row.open_tickets}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>تذاكر مفتوحة</div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 12,
                    borderTop: '1px solid var(--cs-glass-border)',
                    marginTop: 'auto',
                  }}
                >
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => setSelectedDrawerCustomer(row)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Icon name="eye" size={13} />
                    <span>فحص سريع</span>
                  </button>

                  <Link
                    to={adminPath(`customers/${row.parent_id}`)}
                    className="button button--primary button--small"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Icon name="sparkles" size={13} />
                    <span>{text.open}</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </div>
        </>
      ) : (
        <section className="catalog-filter-card" style={{ padding: 0, borderRadius: 18, overflow: 'hidden' }}>
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
                  <th style={{ textAlign: 'end' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.parent_id}>
                    <td>
                      <Link className="entity-cell entity-cell--button" to={adminPath(`customers/${row.parent_id}`)}>
                        <span className="entity-avatar entity-avatar--parent">
                          {row.parent_id.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <strong dir="ltr">{row.parent_id}</strong>
                          <small>
                            {planLabel(row.plan)} · {row.status}
                          </small>
                        </div>
                      </Link>
                    </td>
                    {columns.isVisible('plan') && (
                      <td>
                        <span className={`plan-badge plan-badge--${row.plan}`}>{planLabel(row.plan)}</span>
                      </td>
                    )}
                    {columns.isVisible('status') && (
                      <td>
                        <span
                          className={`account-status account-status--${row.status === 'active' ? 'active' : 'archived'}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    )}
                    {columns.isVisible('children') && <td>{row.child_count}</td>}
                    {columns.isVisible('devices') && (
                      <td>
                        {row.device_count === null || row.device_count === undefined ? (
                          <span
                            className="table-secondary"
                            title="غير متوفّر: عدّ الأجهزة سلطته FamilyState لكل أسرة، ولا إسقاط مُجمَّع في D1."
                          >
                            —
                          </span>
                        ) : (
                          row.device_count
                        )}
                      </td>
                    )}
                    {columns.isVisible('openTickets') && (
                      <td>
                        {row.open_tickets > 0 ? (
                          <span className="readiness-item readiness-item--warn readiness-pill">{row.open_tickets}</span>
                        ) : (
                          <span className="table-secondary">0</span>
                        )}
                      </td>
                    )}
                    <td style={{ textAlign: 'end' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          onClick={() => setSelectedDrawerCustomer(row)}
                          title="فحص سريع"
                        >
                          <Icon name="eye" size={13} />
                        </button>
                        <Link className="button button--ghost button--small" to={adminPath(`customers/${row.parent_id}`)}>
                          {text.open}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
        </section>
      )}

      {/* 7. Slide-Over Customer Quick Inspection Drawer */}
      {selectedDrawerCustomer && (
        <>
          <div className="commercial-drawer-backdrop" onClick={() => setSelectedDrawerCustomer(null)} />
          <div className="commercial-slide-drawer" role="dialog" aria-modal="true">
            <div className="commercial-drawer__header">
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>
                  فحص حساب العائلة 360
                </h3>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                  سجل العائلة الموحد في محرك FamilyState
                </small>
              </div>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => setSelectedDrawerCustomer(null)}
                style={{ padding: 6 }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="commercial-drawer__body">
              {/* Account Identity Card */}
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 16,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#818cf8' }}>معرّف العائلة الرسمي (Family ID)</span>
                  <span
                    className={`account-status account-status--${
                      selectedDrawerCustomer.status === 'active' ? 'active' : 'archived'
                    }`}
                  >
                    {selectedDrawerCustomer.status === 'active' ? 'حساب نشط' : 'حساب معلق'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <div className="token-copy-box" style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}>
                    <span dir="ltr">{selectedDrawerCustomer.parent_id}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedDrawerCustomer.parent_id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                    >
                      <Icon name="copy" size={14} />
                    </button>
                  </div>
                  {copiedId && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>تم النسخ!</span>}
                </div>
              </div>

              {/* Plan and Subscription status */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 14,
                  background: 'var(--surface)',
                  border: '1px solid var(--cs-glass-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>الباقة المشترك بها:</span>
                  <div style={{ marginTop: 4 }}>
                    <span className={`plan-badge plan-badge--${selectedDrawerCustomer.plan}`} style={{ fontSize: 13, fontWeight: 800 }}>
                      {planLabel(selectedDrawerCustomer.plan)}
                    </span>
                  </div>
                </div>
                <Link
                  to={adminPath('packages')}
                  className="button button--ghost button--small"
                  style={{ fontSize: 12 }}
                >
                  تفاصيل الباقة →
                </Link>
              </div>

              {/* Counts grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>الأطفال</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginTop: 2 }}>
                    {selectedDrawerCustomer.child_count}
                  </div>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>الأجهزة</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginTop: 2 }}>
                    {selectedDrawerCustomer.device_count === null || selectedDrawerCustomer.device_count === undefined
                      ? '—'
                      : selectedDrawerCustomer.device_count}
                  </div>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>التذاكر</span>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: selectedDrawerCustomer.open_tickets > 0 ? '#fbbf24' : '#10b981',
                      marginTop: 2,
                    }}
                  >
                    {selectedDrawerCustomer.open_tickets}
                  </div>
                </div>
              </div>

              {/* Direct Quick Shortcuts */}
              <div style={{ display: 'grid', gap: 8 }}>
                <Link
                  className="button button--secondary"
                  to={adminPath(`customers/${selectedDrawerCustomer.parent_id}`)}
                  style={{ width: '100%', height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Icon name="sparkles" size={15} />
                  <span>فتح ملف العميل الكامل 360</span>
                </Link>

                <Link
                  className="button button--ghost"
                  to={adminPath(`children?q=${selectedDrawerCustomer.parent_id}`)}
                  style={{ width: '100%', height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Icon name="children" size={15} />
                  <span>فحص ملفات أطفال هذه العائلة</span>
                </Link>
              </div>
            </div>

            <div className="commercial-drawer__footer">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setSelectedDrawerCustomer(null)}
                style={{ width: '100%', height: 42 }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
