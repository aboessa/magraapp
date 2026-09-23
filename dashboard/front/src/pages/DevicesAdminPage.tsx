import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Pagination } from '../components/Pagination'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { formatNumber } from '../lib/labels'
import type { AdminDeviceRecord } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'إدارة العتاد والجلسات المؤمنة',
    title: 'مركز الأجهزة وتراخيص المحتوى دون اتصال',
    lede: 'مراقبة الأجهزة المسجلة، الجلسات الفعالة، والتنزيلات المحلية مع صلاحيات السحب والتعليق الإداري الموثق.',
    device: 'الجهاز',
    family: 'العائلة',
    platform: 'نظام التشغيل',
    status: 'الحالة',
    lastSeen: 'آخر ظهور',
    never: '—',
    empty: 'لا توجد أجهزة مسجَّلة',
    emptyHint: 'ستظهر الأجهزة هنا تلقائياً عند تسجيل دخول تطبيق مجرة من أجهزة العائلات.',
    loadError: 'تعذر تحميل سجل الأجهزة',
    search: 'بحث باسم الجهاز أو العائلة أو المعرف…',
    allStatuses: 'كل الحالات',
    allPlatforms: 'كل المنصات',
    open: 'مساحة الجهاز',
    viewFamily: 'ملف العائلة 360',
    inspect: 'معاينة سريعة',
    cardsView: 'بطاقات الأجهزة',
    tableView: 'الجدول الشامل',
    totalDevices: 'إجمالي الأجهزة',
    iosDevices: 'أجهزة iOS',
    androidDevices: 'أجهزة Android',
    activeSessions: 'أجهزة متصلة',
    refresh: 'تحديث البيانات',
    exportCsv: 'تصدير الأجهزة (CSV)',
    revokeAction: 'سحب الجهاز وإلغاء التنزيلات متاح من مساحة عمل الجهاز أو ملف العائلة.',
    downloadsNote: 'التنزيلات المحلية مرتبطة برخص أجهزة مؤمنة؛ إلغاء التنزيلات يحرر السعة دون إلغاء توثيق الجهاز.',
    systemBeacon: 'محرك تراخيص العتاد وDRM',
    beaconSub: 'رخص تنزيل مؤمنة ومشفرة محلياً',
    deviceId: 'معرّف الجهاز (Device ID)',
    familyId: 'معرّف العائلة (Family ID)',
    deviceDrawerTitle: 'فحص مواصفات الجهاز والجلسة',
    copied: 'تم النسخ!',
    copyId: 'نسخ المعرّف',
    statusActive: 'متصل / نشط',
    statusRevoked: 'مسحوب / معلق',
  },
  en: {
    eyebrow: 'Hardware & Encrypted Session Management',
    title: 'Device & Offline DRM Operations Center',
    lede: 'Monitor registered hardware, active mobile sessions, and offline cached licenses with audited administrative revocations.',
    device: 'Device',
    family: 'Family',
    platform: 'Platform',
    status: 'Status',
    lastSeen: 'Last Seen',
    never: '—',
    empty: 'No registered devices found',
    emptyHint: 'Devices will appear here as users sign in from the mobile apps.',
    loadError: 'Unable to load devices',
    search: 'Search device name, family, or ID…',
    allStatuses: 'All Statuses',
    allPlatforms: 'All Platforms',
    open: 'Workspace',
    viewFamily: 'Family 360',
    inspect: 'Quick Inspect',
    cardsView: 'Device Cards',
    tableView: 'Detailed Table',
    totalDevices: 'Total Devices',
    iosDevices: 'iOS Devices',
    androidDevices: 'Android Devices',
    activeSessions: 'Active Devices',
    refresh: 'Refresh Data',
    exportCsv: 'Export Devices (CSV)',
    revokeAction: 'Device revocation and offline license wipe available via device workspace.',
    downloadsNote: 'Local downloads use secure DRM hardware-bound leases; wiping downloads does not deregister the device.',
    systemBeacon: 'Hardware DRM & Session Engine',
    beaconSub: 'Hardware-bound cryptographically secured leases',
    deviceId: 'Device ID',
    familyId: 'Family ID',
    deviceDrawerTitle: 'Hardware & Session Dossier Inspection',
    copied: 'Copied!',
    copyId: 'Copy ID',
    statusActive: 'Active / Connected',
    statusRevoked: 'Revoked / Suspended',
  },
}

function formatDate(value: string | null, locale: 'ar' | 'en') {
  if (!value) return null
  const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const LIMIT = 25
const DEFAULT_FILTERS = { status: '', platform: '' }

const FILTER_FIELDS = (text: (typeof copy)['ar']): FilterField[] => [
  {
    key: 'status',
    label: text.status,
    type: 'select',
    options: [
      { value: '', label: text.allStatuses },
      { value: 'active', label: 'نشط (Active)' },
      { value: 'revoked', label: 'مسحوب (Revoked)' },
      { value: 'archived', label: 'مؤرشف (Archived)' },
    ],
  },
  {
    key: 'platform',
    label: text.platform,
    type: 'select',
    options: [
      { value: '', label: text.allPlatforms },
      { value: 'ios', label: 'Apple iOS' },
      { value: 'android', label: 'Google Android' },
      { value: 'web', label: 'Web Browser' },
    ],
  },
]

const COLUMNS: ColumnDefinition[] = [
  { key: 'device', label: 'device', locked: true },
  { key: 'family', label: 'family' },
  { key: 'platform', label: 'platform' },
  { key: 'status', label: 'status' },
  { key: 'lastSeen', label: 'lastSeen' },
]

function matchesFilters(device: AdminDeviceRecord, filters: Record<string, string>, query: string): boolean {
  if (query) {
    const q = query.toLowerCase()
    if (
      !device.display_name?.toLowerCase().includes(q) &&
      !device.id.toLowerCase().includes(q) &&
      !device.parent_id.toLowerCase().includes(q) &&
      !device.parent_name?.toLowerCase().includes(q)
    )
      return false
  }
  if (filters.status && device.status !== filters.status) return false
  if (filters.platform && device.platform?.toLowerCase() !== filters.platform.toLowerCase()) return false
  return true
}

export function DevicesAdminPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { query, filters, offset } = list
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [allDevices, setAllDevices] = useState<AdminDeviceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDrawerDevice, setSelectedDrawerDevice] = useState<AdminDeviceRecord | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const columns = useColumnPreferences('devices', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.devices()
      setAllDevices(response.data || [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState label={text.loadError} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  const filtered = allDevices.filter((d) => matchesFilters(d, filters, query))
  const total = filtered.length
  const paged = filtered.slice(offset, offset + list.limit)

  const iosCount = allDevices.filter((d) => d.platform?.toLowerCase() === 'ios').length
  const androidCount = allDevices.filter((d) => d.platform?.toLowerCase() === 'android').length
  const activeCount = allDevices.filter((d) => d.status === 'active').length

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const exportCSV = () => {
    if (!filtered.length) return
    const headers = ['Device_ID', 'Display_Name', 'Family_ID', 'Family_Name', 'Platform', 'Status', 'Last_Seen']
    const csvRows = filtered.map((d) => [
      d.id,
      `"${(d.display_name || '').replace(/"/g, '""')}"`,
      d.parent_id,
      `"${(d.parent_name || '').replace(/"/g, '""')}"`,
      d.platform || '',
      d.status,
      d.last_seen_at || '',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `devices_register_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getPlatformMeta = (plat: string | null | undefined) => {
    const p = plat?.toLowerCase()
    if (p === 'ios') return { label: 'Apple iOS', bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', iconColor: '#6366f1' }
    if (p === 'android') return { label: 'Google Android', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', iconColor: '#10b981' }
    if (p === 'web') return { label: 'Web Browser', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', iconColor: '#f59e0b' }
    return { label: plat?.toUpperCase() || 'UNKNOWN', bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', iconColor: '#64748b' }
  }

  return (
    <div className="content-studio-root">
      {/* 1. Master Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className="status-beacon__dot status-beacon__dot--cyan" />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">{text.systemBeacon}</span>
              <span className="status-beacon__sub">{text.beaconSub}</span>
            </div>
          </div>
          <div className="filter-pill-group" style={{ marginInlineStart: 12 }}>
            <button
              className={`filter-pill ${filters.platform === '' ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('platform', '')}
            >
              {text.allPlatforms}
            </button>
            <button
              className={`filter-pill ${filters.platform === 'ios' ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('platform', 'ios')}
            >
              Apple iOS ({iosCount})
            </button>
            <button
              className={`filter-pill ${filters.platform === 'android' ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('platform', 'android')}
            >
              Google Android ({androidCount})
            </button>
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
          style={{ background: 'radial-gradient(circle, rgba(14, 165, 233, 0.28) 0%, rgba(99, 102, 241, 0.16) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#0ea5e9' }} />
              {formatNumber(allDevices.length, locale)} {text.totalDevices}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Bento Live Metrics Matrix */}
      <div className="commercial-bento-grid">
        <div className="commercial-bento-card commercial-bento-card--indigo" onClick={() => list.clearFilters()} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.totalDevices}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="devices" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(allDevices.length, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              <Icon name="check" size={12} /> {locale === 'ar' ? 'جميع العتاد المرتبط بالعائلات' : 'All family registered hardware'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald" onClick={() => list.setFilter('status', 'active')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.activeSessions}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(activeCount, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'أجهزة بجلسات اتصال مصرحة' : 'Authorized active leases'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--purple" onClick={() => list.setFilter('platform', 'ios')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.iosDevices}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="devices" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(iosCount, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              Apple iPhone & iPad
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber" onClick={() => list.setFilter('platform', 'android')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.androidDevices}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="devices" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(androidCount, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              Google Android Tablets & Phones
            </span>
          </div>
        </div>
      </div>

      {/* 4. Operational Governance Notice Banner */}
      <div
        style={{
          margin: '20px 0',
          padding: '14px 18px',
          borderRadius: 14,
          background: 'var(--surface-1)',
          border: '1px solid var(--cs-glass-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ color: '#0ea5e9', display: 'flex', alignItems: 'center' }}>
          <Icon name="objectives" size={20} />
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-soft)' }}>
          <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 2 }}>{text.revokeAction}</strong>
          <span>{text.downloadsNote}</span>
        </div>
      </div>

      {/* 5. Catalog Control Strip */}
      <section className="catalog-control-strip">
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
                  storageKey="devices"
                  currentSearch={list.search}
                  onApply={(search) => navigate(`${adminPath('devices-admin')}${search}`)}
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

      {/* 6. Main View: Cards or Detailed Table */}
      {paged.length === 0 ? (
        <EmptyState title={text.empty} description={text.emptyHint} />
      ) : view === 'cards' ? (
        <>
          <div className="customer-360-grid">
            {paged.map((device) => {
              const meta = getPlatformMeta(device.platform)
              return (
                <article
                  key={device.id}
                  className="customer-family-card"
                  onClick={() => setSelectedDrawerDevice(device)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 11.5,
                        fontWeight: 800,
                        background: meta.bg,
                        color: meta.color,
                        border: '1px solid currentColor',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Icon name="devices" size={13} />
                      {meta.label}
                    </span>

                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 800,
                        background: device.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: device.status === 'active' ? '#10b981' : '#f87171',
                        border: '1px solid currentColor',
                      }}
                    >
                      {device.status === 'active' ? text.statusActive : text.statusRevoked}
                    </span>
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                      {device.display_name || device.id.slice(0, 16)}
                    </h3>
                    <code dir="ltr" style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'monospace', display: 'block' }}>
                      {device.id}
                    </code>
                  </div>

                  <div
                    style={{
                      background: 'var(--surface-2)',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid var(--cs-glass-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{text.family}:</span>
                      <Link
                        to={adminPath(`customers/${device.parent_id}`)}
                        style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {device.parent_name || device.parent_id.slice(0, 12)}
                      </Link>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-soft)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{text.lastSeen}:</span>
                      <strong style={{ color: 'var(--text)' }}>
                        {formatDate(device.last_seen_at, locale) ?? text.never}
                      </strong>
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
                      onClick={() => setSelectedDrawerDevice(device)}
                    >
                      <Icon name="objectives" size={13} />
                      <span>{text.inspect}</span>
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link
                        to={adminPath(`customers/${device.parent_id}`)}
                        className="button button--ghost button--small"
                        style={{ textDecoration: 'none' }}
                      >
                        <Icon name="parents" size={13} />
                        <span>{text.viewFamily}</span>
                      </Link>
                      <Link
                        to={adminPath(`devices/${device.id}`)}
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
            <Pagination total={total} limit={list.limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </div>
        </>
      ) : (
        <section className="panel panel--table" style={{ background: 'var(--surface-1)', borderRadius: 16, border: '1px solid var(--cs-glass-border)', overflow: 'hidden' }}>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.device}</th>
                  {columns.isVisible('family') && <th>{text.family}</th>}
                  {columns.isVisible('platform') && <th>{text.platform}</th>}
                  {columns.isVisible('status') && <th>{text.status}</th>}
                  {columns.isVisible('lastSeen') && <th>{text.lastSeen}</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {paged.map((device) => {
                  const meta = getPlatformMeta(device.platform)
                  return (
                    <tr key={device.id} onClick={() => setSelectedDrawerDevice(device)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div className="entity-cell">
                          <span
                            className="entity-avatar"
                            style={{ background: meta.bg, color: meta.color, border: '1px solid currentColor', fontWeight: 800 }}
                          >
                            {(device.platform ?? 'D').charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <strong>{device.display_name || device.id.slice(0, 14)}</strong>
                            <small dir="ltr">{device.id.slice(0, 16)}…</small>
                          </div>
                        </div>
                      </td>
                      {columns.isVisible('family') && (
                        <td>
                          <Link
                            className="table-secondary"
                            to={adminPath(`customers/${device.parent_id}`)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontWeight: 600 }}
                          >
                            {device.parent_name ?? device.parent_id.slice(0, 12)}
                          </Link>
                        </td>
                      )}
                      {columns.isVisible('platform') && (
                        <td>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              background: meta.bg,
                              color: meta.color,
                            }}
                          >
                            {meta.label}
                          </span>
                        </td>
                      )}
                      {columns.isVisible('status') && (
                        <td>
                          <span
                            className={`account-status account-status--${
                              device.status === 'active' ? 'active' : 'archived'
                            }`}
                          >
                            {device.status === 'active' ? text.statusActive : text.statusRevoked}
                          </span>
                        </td>
                      )}
                      {columns.isVisible('lastSeen') && (
                        <td>
                          <span className="table-secondary">{formatDate(device.last_seen_at, locale) ?? text.never}</span>
                        </td>
                      )}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions">
                          <button
                            className="button button--ghost button--small"
                            onClick={() => setSelectedDrawerDevice(device)}
                            title={text.inspect}
                          >
                            <Icon name="objectives" size={13} />
                          </button>
                          <Link className="button button--ghost button--small" to={adminPath(`devices/${device.id}`)}>
                            {text.open}
                          </Link>
                          <Link
                            className="button button--ghost button--small"
                            to={adminPath(`customers/${device.parent_id}`)}
                          >
                            {text.viewFamily}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--cs-glass-border)' }}>
            <Pagination total={total} limit={list.limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </div>
        </section>
      )}

      {/* 7. Slide-Over Inspection Drawer */}
      {selectedDrawerDevice && (
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
          onClick={() => setSelectedDrawerDevice(null)}
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
                background: 'linear-gradient(180deg, rgba(14, 165, 233, 0.08) 0%, transparent 100%)',
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: getPlatformMeta(selectedDrawerDevice.platform).bg,
                    color: getPlatformMeta(selectedDrawerDevice.platform).color,
                    border: '1px solid currentColor',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 22,
                    boxShadow: '0 8px 20px rgba(14, 165, 233, 0.25)',
                  }}
                >
                  <Icon name="devices" size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                    {selectedDrawerDevice.display_name || selectedDrawerDevice.id.slice(0, 16)}
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                    {text.deviceDrawerTitle}
                  </span>
                </div>
              </div>
              <button
                className="button button--ghost button--small"
                onClick={() => setSelectedDrawerDevice(null)}
                style={{ padding: '6px 10px' }}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Copyable Device ID */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  {text.deviceId}
                </label>
                <div className="token-copy-box">
                  <code style={{ fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {selectedDrawerDevice.id}
                  </code>
                  <button
                    className="button button--ghost button--small"
                    onClick={() => copyToClipboard(selectedDrawerDevice.id)}
                    style={{ flexShrink: 0, padding: '4px 8px' }}
                  >
                    {copiedId ? text.copied : text.copyId}
                  </button>
                </div>
              </div>

              {/* Copyable Family ID */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  {text.familyId}
                </label>
                <div className="token-copy-box">
                  <code style={{ fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {selectedDrawerDevice.parent_id}
                  </code>
                  <button
                    className="button button--ghost button--small"
                    onClick={() => copyToClipboard(selectedDrawerDevice.parent_id)}
                    style={{ flexShrink: 0, padding: '4px 8px' }}
                  >
                    {copiedId ? text.copied : text.copyId}
                  </button>
                </div>
              </div>

              {/* Platform & Status Badges */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 800,
                    background: getPlatformMeta(selectedDrawerDevice.platform).bg,
                    color: getPlatformMeta(selectedDrawerDevice.platform).color,
                    border: '1px solid currentColor',
                  }}
                >
                  {getPlatformMeta(selectedDrawerDevice.platform).label}
                </span>
                <span
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 800,
                    background: selectedDrawerDevice.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: selectedDrawerDevice.status === 'active' ? '#10b981' : '#f87171',
                    border: '1px solid currentColor',
                  }}
                >
                  {selectedDrawerDevice.status === 'active' ? text.statusActive : text.statusRevoked}
                </span>
              </div>

              {/* Hardware & Session Metadata Grid */}
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
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{text.family}</span>
                  <strong style={{ fontSize: 13, color: 'var(--text)' }}>
                    {selectedDrawerDevice.parent_name || selectedDrawerDevice.parent_id.slice(0, 12)}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{text.lastSeen}</span>
                  <strong style={{ fontSize: 12, color: 'var(--text)' }}>
                    {formatDate(selectedDrawerDevice.last_seen_at, locale) ?? text.never}
                  </strong>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <Link
                  to={adminPath(`devices/${selectedDrawerDevice.id}`)}
                  className="button button--primary"
                  style={{ justifyContent: 'center', textDecoration: 'none', padding: '12px 16px' }}
                >
                  <Icon name="devices" size={16} />
                  <span>{text.open}</span>
                </Link>
                <Link
                  to={adminPath(`customers/${selectedDrawerDevice.parent_id}`)}
                  className="button button--secondary"
                  style={{ justifyContent: 'center', textDecoration: 'none', padding: '12px 16px' }}
                >
                  <Icon name="parents" size={16} />
                  <span>{text.viewFamily}</span>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
