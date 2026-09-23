import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Pagination } from '../components/Pagination'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { accountStatusLabels, formatDate, formatNumber, planLabels } from '../lib/labels'
import { usePreferences } from '../context/preferences'
import type { ParentRecord } from '../types/api'

const copy = {
  ar: {
    loadError: 'تعذر تحميل حسابات أولياء الأمور',
    account: 'إدارة حسابات أولياء الأمور والمشتركين',
    title: 'أولياء الأمور وقاعدة المشتركين',
    intro: 'دليل أولياء الأمور والوصول السريع إلى تفاصيل الحساب، حالة الاشتراك، وملفات الأطفال المرتبطة.',
    refresh: 'تحديث البيانات',
    directory: 'دليل الحسابات',
    search: 'بحث بالاسم أو البريد الإلكتروني...',
    allPlans: 'كل الباقات',
    parent: 'ولي الأمر',
    plan: 'الباقة',
    children: 'الأطفال',
    language: 'اللغة',
    status: 'الحالة',
    joined: 'تاريخ التسجيل',
    loading: 'جارٍ تحميل الحسابات...',
    noName: 'من دون اسم معروض',
    arabic: 'العربية',
    english: 'الإنجليزية',
    empty: 'لا توجد حسابات مطابقة',
    emptyDesc: 'غيّر البحث أو الفلاتر للعثور على الحسابات.',
    family: 'العائلة',
    contact: 'التواصل',
    verification: 'التحقق',
    lastActive: 'آخر نشاط',
    viewFamily: 'ملف العائلة 360',
    open: 'فتح الحساب',
    inspect: 'معاينة سريعة',
    cardsView: 'بطاقات أولياء الأمور',
    tableView: 'الجدول الشامل',
    totalParents: 'إجمالي الحسابات',
    activeSubscribers: 'مشتركون نشطون',
    totalChildren: 'أطفال مسجلون',
    verifiedAccounts: 'حسابات نشطة',
    exportCsv: 'تصدير الدليل (CSV)',
    parentDrawerTitle: 'ملف ولي الأمر التفصيلي',
    parentId: 'معرّف الحساب',
    copied: 'تم النسخ!',
    copyId: 'نسخ المعرّف',
    systemBeacon: 'قاعدة بيانات الهوية النشطة',
    beaconSub: 'تزامن كامل مع FamilyState',
  },
  en: {
    loadError: 'Unable to load parent accounts',
    account: 'User & Subscriber Identity Management',
    title: 'Parents & Subscribers Directory',
    intro: 'Parent accounts directory with direct access to family workspaces, subscriptions, and children.',
    refresh: 'Refresh Data',
    directory: 'Account Directory',
    search: 'Search name or email...',
    allPlans: 'All Plans',
    parent: 'Parent',
    plan: 'Plan',
    children: 'Children',
    language: 'Language',
    status: 'Status',
    joined: 'Registration Date',
    loading: 'Loading accounts...',
    noName: 'No display name',
    arabic: 'Arabic',
    english: 'English',
    empty: 'No matching accounts',
    emptyDesc: 'Change your search or filters to find accounts.',
    family: 'Family',
    contact: 'Contact',
    verification: 'Verification',
    lastActive: 'Last Active',
    viewFamily: 'Family 360',
    open: 'Open',
    inspect: 'Quick Inspect',
    cardsView: 'Parent Cards',
    tableView: 'Detailed Table',
    totalParents: 'Total Accounts',
    activeSubscribers: 'Active Subscribers',
    totalChildren: 'Registered Children',
    verifiedAccounts: 'Active Accounts',
    exportCsv: 'Export Directory (CSV)',
    parentDrawerTitle: 'Parent Dossier Inspection',
    parentId: 'Account ID',
    copied: 'Copied!',
    copyId: 'Copy ID',
    systemBeacon: 'Active Identity Vault',
    beaconSub: 'Synchronized with FamilyState',
  },
}

const PLANS = ['free', 'family', 'family_plus']
const STATUSES = ['active', 'suspended', 'archived']
const LIMIT = 25
const DEFAULT_FILTERS = { plan: '', status: '' }

const FILTER_FIELDS = (text: (typeof copy)['ar']): FilterField[] => [
  {
    key: 'plan',
    label: text.plan,
    type: 'select',
    options: [{ value: '', label: text.allPlans }, ...PLANS.map((v) => ({ value: v, label: v }))],
  },
  {
    key: 'status',
    label: text.status,
    type: 'select',
    options: [{ value: '', label: text.status }, ...STATUSES.map((v) => ({ value: v, label: v }))],
  },
]

const COLUMNS: ColumnDefinition[] = [
  { key: 'parent', label: 'parent', locked: true },
  { key: 'family', label: 'plan' },
  { key: 'contact', label: 'parent' },
  { key: 'status', label: 'status' },
  { key: 'children', label: 'children' },
  { key: 'joined', label: 'joined' },
]

export function ParentsPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { query, filters, offset, limit } = list
  const { plan, status } = filters
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [records, setRecords] = useState<ParentRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDrawerParent, setSelectedDrawerParent] = useState<ParentRecord | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const columns = useColumnPreferences('parents', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.parents({
        q: query,
        plan: plan || undefined,
        status: status || undefined,
        limit,
        offset,
      })
      setRecords(response.data || [])
      setTotal(response.meta?.total ?? response.data?.length ?? 0)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [plan, query, status, limit, offset, text.loadError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(timer)
  }, [load])

  const activeCount = records.filter((p) => p.status === 'active' && p.plan !== 'free').length
  const childrenTotal = records.reduce((acc, p) => acc + (p.children_count || 0), 0)
  const verifiedCount = records.filter((p) => p.status === 'active').length

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const exportCSV = () => {
    if (!records.length) return
    const headers = ['Parent_ID', 'Name', 'Email', 'Plan', 'Status', 'Children_Count', 'Locale']
    const csvRows = records.map((p) => [
      p.id,
      `"${(p.display_name || '').replace(/"/g, '""')}"`,
      p.email || '',
      p.plan,
      p.status,
      p.children_count || 0,
      p.locale || '',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `parents_directory_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="content-studio-root">
      {/* 1. Master Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className="status-beacon__dot status-beacon__dot--emerald" />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">{text.systemBeacon}</span>
              <span className="status-beacon__sub">{text.beaconSub}</span>
            </div>
          </div>
          <div className="filter-pill-group" style={{ marginInlineStart: 12 }}>
            <button
              className={`filter-pill ${filters.plan === '' ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('plan', '')}
            >
              {text.allPlans}
            </button>
            {PLANS.map((p) => (
              <button
                key={p}
                className={`filter-pill ${filters.plan === p ? 'filter-pill--active' : ''}`}
                onClick={() => list.setFilter('plan', p)}
              >
                {(planLabels[locale] as Record<string, string>)[p] ?? p}
              </button>
            ))}
          </div>
        </div>

        <div className="commercial-command-strip__right">
          <button className="button button--secondary button--small" onClick={exportCSV} title={text.exportCsv}>
            <Icon name="objectives" size={14} />
            <span>{text.exportCsv}</span>
          </button>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
            <span>{text.refresh}</span>
          </button>
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, rgba(168, 85, 247, 0.16) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.account}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#6366f1' }} />
              {formatNumber(total, locale)} {text.totalParents}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.intro}</p>
        </div>
      </section>

      {/* 3. Executive Bento Live Metrics Matrix */}
      <div className="commercial-bento-grid">
        <div className="commercial-bento-card commercial-bento-card--indigo" onClick={() => list.clearFilters()} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.totalParents}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="parents" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(total, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              <Icon name="check" size={12} /> {locale === 'ar' ? 'جميع الحسابات المسجلة' : 'All Registered Parents'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald" onClick={() => list.setFilter('plan', 'family')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.activeSubscribers}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(activeCount, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              <Icon name="check" size={12} /> {locale === 'ar' ? 'اشتراكات مدفوعة نشطة' : 'Active Paid Plans'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--rose">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.totalChildren}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="children" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(childrenTotal, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              {locale === 'ar' ? 'أطفال مرتبطون بالحسابات' : 'Children linked to families'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber" onClick={() => list.setFilter('status', 'active')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.verifiedAccounts}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="objectives" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(verifiedCount, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'حسابات مؤكدة وجاهزة' : 'Active verified credentials'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Catalog Control Strip & Filter Tools */}
      <section className="catalog-control-strip" style={{ marginTop: 24 }}>
        <div className="catalog-control-strip__left">
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
                  storageKey="parents"
                  currentSearch={list.search}
                  onApply={(search) => navigate(`${adminPath('parents')}${search}`)}
                />
                <ColumnManager
                  columns={COLUMNS.map((c) => ({ ...c, label: (text as any)[c.label] ?? c.label }))}
                  hidden={columns.hidden}
                  onToggle={columns.toggle}
                  onReset={columns.reset}
                />
              </>
            }
          />
        </div>

        <div className="catalog-control-strip__right">
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

      {/* 5. Main View: Cards or Detailed Table */}
      {loading && !records.length ? (
        <LoadingState label={text.loading} />
      ) : error && !records.length ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : records.length === 0 ? (
        <EmptyState title={text.empty} description={text.emptyDesc} />
      ) : view === 'cards' ? (
        <>
          <div className="customer-360-grid">
            {records.map((parent) => {
              const letter = (parent.display_name || parent.email || (locale === 'ar' ? 'و' : 'P')).charAt(0)
              return (
                <article key={parent.id} className="customer-family-card" onClick={() => setSelectedDrawerParent(parent)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: 16,
                          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                        }}
                      >
                        {letter}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: 15, color: 'var(--text)' }}>
                          {parent.display_name || text.noName}
                        </strong>
                        <small dir="ltr" style={{ color: 'var(--muted)', display: 'block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {parent.email || parent.id}
                        </small>
                      </div>
                    </div>

                    <span className={`plan-badge plan-badge--${parent.plan}`} style={{ fontSize: 11, fontWeight: 800 }}>
                      {planLabels[locale][parent.plan] ?? parent.plan}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                      background: 'var(--surface-2)',
                      padding: '10px 12px',
                      borderRadius: 12,
                      textAlign: 'center',
                      border: '1px solid var(--cs-glass-border)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                        {parent.children_count || 0}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{text.children}</div>
                    </div>
                    <div style={{ borderInline: '1px solid var(--cs-glass-border)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {parent.locale === 'ar' ? text.arabic : text.english}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{text.language}</div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: parent.status === 'active' ? '#10b981' : '#f87171',
                        }}
                      >
                        {accountStatusLabels[locale][parent.status] ?? parent.status}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{text.status}</div>
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
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="button button--ghost button--small"
                      onClick={() => setSelectedDrawerParent(parent)}
                    >
                      <Icon name="objectives" size={13} />
                      <span>{text.inspect}</span>
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link
                        to={adminPath(`customers/${parent.id}`)}
                        className="button button--ghost button--small"
                        style={{ textDecoration: 'none' }}
                      >
                        <Icon name="parents" size={13} />
                        <span>{text.viewFamily}</span>
                      </Link>
                      <Link
                        to={adminPath(`parents/${parent.id}`)}
                        className="button button--primary button--small"
                        style={{ textDecoration: 'none' }}
                      >
                        <span>{text.open}</span>
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          <div style={{ marginTop: 24 }}>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </div>
        </>
      ) : (
        <section className="panel panel--table" style={{ background: 'var(--surface-1)', borderRadius: 16, border: '1px solid var(--cs-glass-border)', overflow: 'hidden' }}>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.parent}</th>
                  {columns.isVisible('family') && <th>{text.plan}</th>}
                  <th>{text.children}</th>
                  <th>{text.language}</th>
                  <th>{text.status}</th>
                  <th>{text.joined}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((parent) => (
                  <tr key={parent.id} onClick={() => setSelectedDrawerParent(parent)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div className="entity-cell">
                        <span className="entity-avatar entity-avatar--parent">
                          {(parent.display_name || parent.email || (locale === 'ar' ? 'و' : 'P')).charAt(0)}
                        </span>
                        <div>
                          <strong>{parent.display_name || text.noName}</strong>
                          <small dir="ltr">{parent.email || parent.id}</small>
                        </div>
                      </div>
                    </td>
                    {columns.isVisible('family') && (
                      <td>
                        <span className={`plan-badge plan-badge--${parent.plan}`}>
                          {planLabels[locale][parent.plan]}
                        </span>
                      </td>
                    )}
                    <td>
                      <span className="counter-badge counter-badge--muted">{parent.children_count || 0}</span>
                    </td>
                    <td>
                      {parent.locale === 'ar'
                        ? text.arabic
                        : parent.locale === 'en'
                        ? text.english
                        : parent.locale}
                    </td>
                    <td>
                      <span className={`account-status account-status--${parent.status}`}>
                        {accountStatusLabels[locale][parent.status]}
                      </span>
                    </td>
                    <td>
                      {formatDate(
                        (parent as any).created_at ??
                          (parent as any).created_at_ms ??
                          (parent as any).last_event_at_ms,
                        locale,
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions">
                        <button
                          className="button button--ghost button--small"
                          onClick={() => setSelectedDrawerParent(parent)}
                          title={text.inspect}
                        >
                          <Icon name="objectives" size={13} />
                        </button>
                        <Link className="button button--ghost button--small" to={adminPath(`parents/${parent.id}`)}>
                          {text.open}
                        </Link>
                        <Link className="button button--ghost button--small" to={adminPath(`customers/${parent.id}`)}>
                          {text.viewFamily}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--cs-glass-border)' }}>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </div>
        </section>
      )}

      {/* 6. Slide-Over Inspection Drawer */}
      {selectedDrawerParent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSelectedDrawerParent(null)}
        >
          <aside
            className="commercial-slide-drawer"
            style={{
              width: '100%',
              maxWidth: 480,
              height: '100%',
              background: 'var(--surface-1)',
              borderInlineStart: '1px solid var(--cs-glass-border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.3)',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '24px 24px 20px',
                borderBottom: '1px solid var(--cs-glass-border)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)',
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: 22,
                    boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
                  }}
                >
                  {(selectedDrawerParent.display_name || selectedDrawerParent.email || 'P').charAt(0)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                    {selectedDrawerParent.display_name || text.noName}
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                    {text.parentDrawerTitle}
                  </span>
                </div>
              </div>
              <button
                className="button button--ghost button--small"
                onClick={() => setSelectedDrawerParent(null)}
                style={{ padding: '6px 10px' }}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Copyable Parent ID Box */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  {text.parentId}
                </label>
                <div className="token-copy-box">
                  <code style={{ fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {selectedDrawerParent.id}
                  </code>
                  <button
                    className="button button--ghost button--small"
                    onClick={() => copyToClipboard(selectedDrawerParent.id)}
                    style={{ flexShrink: 0, padding: '4px 8px' }}
                  >
                    {copiedId ? text.copied : text.copyId}
                  </button>
                </div>
              </div>

              {/* Status and Plan Badges */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className={`plan-badge plan-badge--${selectedDrawerParent.plan}`} style={{ padding: '6px 12px', fontSize: 12 }}>
                  {planLabels[locale][selectedDrawerParent.plan] ?? selectedDrawerParent.plan}
                </span>
                <span className={`account-status account-status--${selectedDrawerParent.status}`} style={{ padding: '6px 12px', fontSize: 12 }}>
                  {accountStatusLabels[locale][selectedDrawerParent.status] ?? selectedDrawerParent.status}
                </span>
              </div>

              {/* Identity & Technical Metadata Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                  background: 'var(--surface-2)',
                  padding: 16,
                  borderRadius: 14,
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{text.contact}</span>
                  <strong dir="ltr" style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>
                    {selectedDrawerParent.email || '—'}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{text.language}</span>
                  <strong style={{ fontSize: 13, color: 'var(--text)' }}>
                    {selectedDrawerParent.locale === 'ar' ? text.arabic : text.english}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{text.children}</span>
                  <strong style={{ fontSize: 16, color: '#ec4899', fontWeight: 800 }}>
                    {selectedDrawerParent.children_count || 0}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{text.joined}</span>
                  <strong style={{ fontSize: 12, color: 'var(--text)' }}>
                    {formatDate(
                      (selectedDrawerParent as any).created_at ??
                        (selectedDrawerParent as any).created_at_ms ??
                        (selectedDrawerParent as any).last_event_at_ms,
                      locale,
                    )}
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <Link
                  to={adminPath(`customers/${selectedDrawerParent.id}`)}
                  className="button button--primary"
                  style={{ justifyContent: 'center', textDecoration: 'none', padding: '12px 16px' }}
                >
                  <Icon name="parents" size={16} />
                  <span>{text.viewFamily}</span>
                </Link>
                <Link
                  to={adminPath(`parents/${selectedDrawerParent.id}`)}
                  className="button button--secondary"
                  style={{ justifyContent: 'center', textDecoration: 'none', padding: '12px 16px' }}
                >
                  <Icon name="objectives" size={16} />
                  <span>{text.open}</span>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
