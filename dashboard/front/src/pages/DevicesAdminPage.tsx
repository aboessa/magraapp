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
import type { AdminDeviceRecord } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'الأجهزة والجلسات',
    title: 'مركز الأجهزة والجلسات',
    lede: 'مراقبة الأجهزة والجلسات النشطة والتنزيلات. إجراءات السحب تتم عبر أمر إداري موثق.',
    device: 'الجهاز',
    family: 'العائلة',
    platform: 'المنصّة',
    status: 'الحالة',
    lastSeen: 'آخر ظهور',
    never: '—',
    empty: 'لا أجهزة مسجَّلة',
    emptyHint: 'ستظهر الأجهزة هنا بعد تسجيلها من التطبيق.',
    loadError: 'تعذر تحميل سجل الأجهزة',
    search: 'بحث بالجهاز أو العائلة…',
    allStatuses: 'كل الحالات',
    allPlatforms: 'كل المنصات',
    open: 'فتح',
    viewFamily: 'العائلة',
    revokeAction: 'سحب الجهاز متاح من ملف العائلة أو ملف الجهاز.',
    downloadsNote: 'التنزيلات ترتبط بالجهاز وتمنحها التراخيص. سحب التنزيلات لا يلغي تسجيل الجهاز.',
  },
  en: {
    eyebrow: 'Devices & Sessions',
    title: 'Device & Session Operations',
    lede: 'Monitor devices, active sessions and offline access. Revocations use an audited operator command.',
    device: 'Device',
    family: 'Family',
    platform: 'Platform',
    status: 'Status',
    lastSeen: 'Last seen',
    never: '—',
    empty: 'No registered devices',
    emptyHint: 'Devices will appear here after registration from the app.',
    loadError: 'Unable to load devices',
    search: 'Search device or family…',
    allStatuses: 'All statuses',
    allPlatforms: 'All platforms',
    open: 'Open',
    viewFamily: 'Family',
    revokeAction: 'Device revocation is available from the family file or the device workspace.',
    downloadsNote: 'Downloads are device-bound licences. Revoking downloads does not unregister the device.',
  },
}

function formatDate(value: string | null, locale: 'ar' | 'en') {
  if (!value) return null
  const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

const LIMIT = 25
const DEFAULT_FILTERS = { status: '', platform: '' }

const FILTER_FIELDS = (text: (typeof copy)['ar']): FilterField[] => [
  { key: 'status', label: text.status, type: 'select', options: [{ value: '', label: text.allStatuses }, { value: 'active', label: 'active' }, { value: 'revoked', label: 'revoked' }, { value: 'archived', label: 'archived' }] },
  { key: 'platform', label: text.platform, type: 'select', options: [{ value: '', label: text.allPlatforms }, { value: 'ios', label: 'iOS' }, { value: 'android', label: 'Android' }, { value: 'web', label: 'Web' }] },
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
    if (!device.display_name?.toLowerCase().includes(q) && !device.id.toLowerCase().includes(q) && !device.parent_id.toLowerCase().includes(q) && !device.parent_name?.toLowerCase().includes(q)) return false
  }
  if (filters.status && device.status !== filters.status) return false
  if (filters.platform && device.platform !== filters.platform) return false
  return true
}

export function DevicesAdminPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { query, filters, offset } = list
  const [allDevices, setAllDevices] = useState<AdminDeviceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const columns = useColumnPreferences('devices', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.devices()
      setAllDevices(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally { setLoading(false) }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  const filtered = allDevices.filter((d) => matchesFilters(d, filters, query))
  const total = filtered.length
  const paged = filtered.slice(offset, offset + list.limit)

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
                <SavedViewsMenu storageKey="devices" currentSearch={list.search} onApply={(search) => navigate(`${adminPath('devices-admin')}${search}`)} />
                <ColumnManager columns={COLUMNS.map((c) => ({ ...c, label: text[c.label as keyof typeof text] ?? c.label }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} />
              </>
            }
          />
        </header>

        {paged.length ? (
          <>
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
                  {paged.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <Link className="entity-cell entity-cell--button" to={adminPath(`devices/${device.id}`)}>
                          <span className="entity-avatar entity-avatar--device">{(device.platform ?? 'D').charAt(0).toUpperCase()}</span>
                          <div><strong>{device.display_name || device.id.slice(0, 12)}</strong><small dir="ltr">{device.id.slice(0, 14)}…</small></div>
                        </Link>
                      </td>
                      {columns.isVisible('family') && <td><Link className="table-secondary" to={adminPath(`customers/${device.parent_id}`)}>{device.parent_name ?? device.parent_id.slice(0, 8)}</Link></td>}
                      {columns.isVisible('platform') && <td>{device.platform ?? '—'}</td>}
                      {columns.isVisible('status') && <td><span className={`account-status account-status--${device.status === 'active' ? 'active' : 'archived'}`}>{device.status}</span></td>}
                      {columns.isVisible('lastSeen') && <td><span className="table-secondary">{formatDate(device.last_seen_at, locale) ?? text.never}</span></td>}
                      <td>
                        <div className="table-actions">
                          <Link className="button button--ghost button--small" to={adminPath(`devices/${device.id}`)}>{text.open}</Link>
                          <Link className="button button--ghost button--small" to={adminPath(`customers/${device.parent_id}`)}>{text.viewFamily}</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={list.limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </>
        ) : <EmptyState title={text.empty} description={text.emptyHint} />}
      </section>

      <section className="panel panel--notice">
        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{text.revokeAction}</p>
        <p style={{ fontSize: 13, lineHeight: 1.6, margin: '8px 0 0', color: 'var(--text-secondary)' }}>{text.downloadsNote}</p>
      </section>
    </div>
  )
}
