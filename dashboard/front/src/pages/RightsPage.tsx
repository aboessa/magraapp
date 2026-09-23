import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { Pagination } from '../components/Pagination'
import { ViewSwitcher } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import type { RightsLicenseRecord } from '../types/api'
import { RIGHTS_EXPIRING_SOON_MS } from '../lib/constants'

const LICENSE_TYPES = ['exclusive', 'non_exclusive', 'owned'] as const

const copy = {
  ar: {
    eyebrow: 'الملكية الفكرية والتراخيص',
    title: 'استوديو إدارة الحقوق والتراخيص القانونية',
    lede: 'سجل تدقيق مركزي لمالكي الحقوق، نطاقات البث الإقليمية، اللغات المعتمدة، وتواريخ انتهاء التراخيص مع رادار استباقي للانتهاء.',
    add: 'إضافة ترخيص جديد',
    search: 'بحث بالمالك أو معرّف المحتوى…',
    filterNote: 'البحث والفلاتر والترقيم كلها على الخادم — الرابط قابل للمشاركة.',
    stats: { total: 'إجمالي الحقوق', expired: 'منتهية الصلاحية', soon: 'تنتهي قريباً', perpetual: 'حقوق دائمة', expiringSoon: '٦٠ يوماً' },
    allTypes: 'كل الأنواع',
    all: 'الجميع',
    content: 'المحتوى',
    owner: 'المالك',
    type: 'النوع',
    countries: 'الأقاليم',
    languages: 'اللغات',
    devices: 'الأجهزة',
    expires: 'الانتهاء',
    perpetual: 'دائم',
    expired: 'منتهي',
    contentIdLabel: 'معرّف المحتوى',
    contentIdHint: 'معرّف سلسلة منشورة أو مسودة من الكتالوج.',
    ownerLabel: 'مالك الحق',
    typeLabel: 'نوع الترخيص',
    countriesLabel: 'الأقاليم',
    countriesHint: 'رموز دول مفصولة بفاصلة مثل EG,SA,AE. اتركه فارغاً لكل الدول.',
    languagesLabel: 'اللغات',
    languagesHint: 'رموز لغات مفصولة بفاصلة مثل ar,en. اتركه فارغاً لكل اللغات.',
    devicesLabel: 'الأجهزة',
    devicesHint: 'مثل mobile,tv,web. اتركه فارغاً لكل الأجهزة.',
    expiryLabel: 'تاريخ الانتهاء',
    expiryHint: 'فارغ = دائم. لا يُخترع تاريخ افتراضي.',
    save: 'إضافة الترخيص',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    created: 'أُضيف الحق بنجاح',
    required: 'معرّف المحتوى ومالك الحق مطلوبان',
    empty: 'لا توجد حقوق مسجلة',
    emptyHint: 'أضف أول ترخيص لتتبع صلاحية بث وتوزيع المحتوى.',
    loadError: 'تعذر تحميل سجل الحقوق',
    cardsView: 'بطاقات التراخيص',
    tableView: 'الجدول الشامل',
    types: { exclusive: 'حصري', non_exclusive: 'غير حصري', owned: 'ملكية كاملة' } as Record<string, string>,
  },
  en: {
    eyebrow: 'Rights & Intellectual Property',
    title: 'Rights & Distribution Licensing Studio',
    lede: 'Central audit ledger for rights holders, distribution territories, authorized audio/subtitles, and legal milestones.',
    add: 'New License',
    search: 'Search owner or content ID…',
    filterNote: 'Search, filters, and paging run on server — shareable URL.',
    stats: { total: 'Total Rights', expired: 'Expired', soon: 'Expiring Soon', perpetual: 'Perpetual', expiringSoon: '60 days' },
    allTypes: 'All Types',
    all: 'All',
    content: 'Content',
    owner: 'Owner',
    type: 'Type',
    countries: 'Territories',
    languages: 'Languages',
    devices: 'Devices',
    expires: 'Expiry',
    perpetual: 'Perpetual',
    expired: 'Expired',
    contentIdLabel: 'Content ID',
    contentIdHint: 'Series ID from catalogue.',
    ownerLabel: 'Rights Holder',
    typeLabel: 'License Type',
    countriesLabel: 'Territories',
    countriesHint: 'Comma-separated ISO codes (e.g. EG,SA,AE). Empty = all.',
    languagesLabel: 'Languages',
    languagesHint: 'Comma-separated codes (e.g. ar,en). Empty = all.',
    devicesLabel: 'Devices',
    devicesHint: 'e.g. mobile,tv,web. Empty = all.',
    expiryLabel: 'Expiry Date',
    expiryHint: 'Empty = perpetual.',
    save: 'Save License',
    saving: 'Saving…',
    cancel: 'Cancel',
    created: 'Right added successfully',
    required: 'Content ID and rights holder required',
    empty: 'No rights recorded',
    emptyHint: 'Add your first license to track distribution validity.',
    loadError: 'Unable to load rights',
    cardsView: 'License Cards',
    tableView: 'Detailed Table',
    types: { exclusive: 'Exclusive', non_exclusive: 'Non-exclusive', owned: 'Full Ownership' } as Record<string, string>,
  },
}

const EMPTY_FORM = {
  content_id: '',
  owner: '',
  license_type: 'exclusive',
  countries: '',
  languages: '',
  devices: '',
  expiry_date: '',
}

function parseList(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean)
}

function isExpired(date: string | null) {
  if (!date) return false
  const p = new Date(date)
  return !Number.isNaN(p.getTime()) && p.getTime() < Date.now()
}

function isSoon(date: string | null) {
  if (!date) return false
  const p = new Date(date)
  if (Number.isNaN(p.getTime())) return false
  const diff = p.getTime() - Date.now()
  return diff > 0 && diff < RIGHTS_EXPIRING_SOON_MS
}

const LIMIT = 25
const DEFAULT_FILTERS = { license_type: '', expiry: '' }
const FILTER_FIELDS = (text: (typeof copy)['ar']): FilterField[] => [
  {
    key: 'license_type',
    label: text.type,
    type: 'select',
    options: [{ value: '', label: text.allTypes }, ...LICENSE_TYPES.map((v) => ({ value: v, label: text.types[v] ?? v }))],
  },
  {
    key: 'expiry',
    label: text.expires,
    type: 'select',
    options: [
      { value: '', label: text.all },
      { value: 'expired', label: text.expired },
      { value: 'soon', label: text.stats.expiringSoon },
      { value: 'none', label: text.perpetual },
    ],
  },
]

export function RightsPage() {
  const { locale } = usePreferences()
  const text = copy[locale as 'ar' | 'en']
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { query, filters, offset, limit } = list
  const [rights, setRights] = useState<RightsLicenseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [total, setTotal] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [selectedDrawerRight, setSelectedDrawerRight] = useState<RightsLicenseRecord | null>(null)
  const [copiedId, setCopiedId] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.rights({
        q: query.trim() || undefined,
        license_type: filters.license_type || undefined,
        expiry: filters.expiry || undefined,
        limit,
        offset,
      })
      setRights(response.data)
      setTotal(response.meta.total)
    } catch (c) {
      setError(c instanceof Error ? c.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [filters.expiry, filters.license_type, limit, offset, query, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const expired = rights.filter((r) => isExpired(r.expiry_date as any)).length
    const soon = rights.filter((r) => isSoon(r.expiry_date as any)).length
    const perpetual = rights.filter((r) => !r.expiry_date).length
    return { total, expired, soon, perpetual }
  }, [rights, total])

  async function submit() {
    if (!form.content_id.trim() || !form.owner.trim()) {
      setFormError(text.required)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await api.createRight({
        content_id: form.content_id.trim(),
        owner: form.owner.trim(),
        license_type: form.license_type,
        countries: splitList(form.countries),
        languages: splitList(form.languages),
        devices: splitList(form.devices),
        expiry_date: form.expiry_date.trim() || null,
      })
      setOpen(false)
      setForm(EMPTY_FORM)
      setNotice(text.created)
      await load()
    } catch (c) {
      setFormError(c instanceof Error ? c.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

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
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#c084fc',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <span className="status-dot-pulse" style={{ background: '#a855f7' }} />
            <span>سجل الملكية الفكرية والتراخيص نشط</span>
          </div>

          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
            {total} ترخيص قانوني مسجل ومحمي
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={() => void load()}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh" size={14} />
            <span>تحديث السجل</span>
          </button>

          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => {
              setForm(EMPTY_FORM)
              setFormError('')
              setOpen(true)
            }}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="plus" size={14} />
            <span>{text.add}</span>
          </button>
        </div>
      </header>

      {/* 2. Hero Panoramic Banner */}
      <section className="catalog-hero" style={{ marginBottom: 20 }}>
        <div
          className="catalog-hero__glow"
          style={{
            background:
              'radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, rgba(14, 165, 233, 0.15) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{ borderColor: 'rgba(168, 85, 247, 0.3)', color: '#a855f7' }}
            >
              <span className="status-dot-pulse" style={{ background: '#a855f7' }} />
              {total} ترخيص معتمد
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Triage Alert Banner for Expiring or Expired Contracts */}
      {(stats.soon > 0 || stats.expired > 0) && (
        <div
          style={{
            margin: '0 0 20px',
            padding: '16px 20px',
            borderRadius: 16,
            background:
              stats.expired > 0
                ? 'rgba(239, 68, 68, 0.08)'
                : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${
              stats.expired > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'
            }`,
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
                background: stats.expired > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: stats.expired > 0 ? '#ef4444' : '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="warning" size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
                {stats.expired > 0
                  ? `تنبيه تدقيق: يوجد ${stats.expired} ترخيص منتهي الصلاحية يحتاج إجراء فوري`
                  : `تنبيه صلاحية: يوجد ${stats.soon} ترخيص ينتهي خلال ٦٠ يوماً`}
              </div>
              <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                قم بمراجعة بنود العقد وتجديده مع المالك لتفادي حجب المحتوى تلقائياً في الأقاليم المحددة.
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                list.setFilter('expiry', stats.expired > 0 ? 'expired' : 'soon')
                list.setOffset(0)
              }}
            >
              عرض التراخيص المتأثرة الآن
            </button>
          </div>
        </div>
      )}

      {/* 4. Side-by-side Bento Live Metric KPI Strip */}
      <div className="hero-kpis">
        <div
          className="kpi-glass-card"
          onClick={() => {
            list.clearFilters()
            list.setOffset(0)
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Icon name="rights" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.stats.total}</span>
            <div className="kpi-glass-card__num">{stats.total}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#818cf8' }}>
              كل الحقوق المسجلة
            </span>
          </div>
        </div>

        <div
          className="kpi-glass-card"
          onClick={() => {
            list.setFilter('expiry', 'expired')
            list.setOffset(0)
          }}
          style={{ cursor: 'pointer', borderColor: stats.expired ? 'rgba(239, 68, 68, 0.3)' : undefined }}
        >
          <div
            className="kpi-glass-card__icon"
            style={{
              background: stats.expired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: stats.expired ? '#ef4444' : '#10b981',
            }}
          >
            <Icon name="warning" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.stats.expired}</span>
            <div className="kpi-glass-card__num" style={{ color: stats.expired ? '#ef4444' : undefined }}>
              {stats.expired}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: stats.expired ? '#ef4444' : '#10b981' }}>
              {stats.expired ? 'تحتاج مراجعة قانونية' : 'لا توجد عقود منتهية'}
            </span>
          </div>
        </div>

        <div
          className="kpi-glass-card"
          onClick={() => {
            list.setFilter('expiry', 'soon')
            list.setOffset(0)
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Icon name="clock" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.stats.soon}</span>
            <div className="kpi-glass-card__num">{stats.soon}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#f59e0b' }}>
              {text.stats.expiringSoon}
            </span>
          </div>
        </div>

        <div
          className="kpi-glass-card"
          onClick={() => {
            list.setFilter('expiry', 'none')
            list.setOffset(0)
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="check" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.stats.perpetual}</span>
            <div className="kpi-glass-card__num">{stats.perpetual}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              ملكية دائمة دون انتهاء
            </span>
          </div>
        </div>
      </div>

      {notice && (
        <div className="inline-alert inline-alert--success" style={{ margin: '8px 0' }}>
          {notice}
        </div>
      )}

      {/* 5. Studio Control Strip with ListToolbar */}
      <div className="catalog-control-strip">
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
            onRemove={(k) => list.setFilter(k as any, '')}
            trailing={
              <SavedViewsMenu
                storageKey="rights"
                currentSearch={list.search}
                onApply={(s) => navigate(`${adminPath('rights')}${s}`)}
              />
            }
          />
        </div>

        <div className="catalog-control-strip__right" style={{ alignSelf: 'center' }}>
          <ViewSwitcher
            modes={['cards', 'table']}
            current={viewMode}
            onChange={setViewMode}
            labels={{ cards: text.cardsView, table: text.tableView }}
          />
        </div>
      </div>

      {/* 6. Rights Content: Cards vs Table */}
      {rights.length === 0 ? (
        <EmptyState title={text.empty} description={text.emptyHint} />
      ) : viewMode === 'cards' ? (
        <div className="rights-studio-grid">
          {rights.map((r) => {
            const expired = isExpired(r.expiry_date as any)
            const soon = isSoon(r.expiry_date as any)
            const countries = parseList(r.countries)
            const languages = parseList(r.languages)
            const devices = parseList(r.devices)

            return (
              <article key={r.id} className="rights-card-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: 'rgba(0,0,0,0.05)',
                        display: 'inline-block',
                        marginBottom: 4,
                      }}
                      dir="ltr"
                    >
                      {r.content_id}
                    </span>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                      <Link
                        to={adminPath(`rights/${r.id}`)}
                        style={{ color: 'var(--text)', textDecoration: 'none' }}
                      >
                        {r.series_title || r.content_id}
                      </Link>
                    </h3>
                    <small style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      المالك: <strong style={{ color: 'var(--text)' }}>{r.owner}</strong>
                    </small>
                  </div>

                  <span
                    className={`plan-badge plan-badge--${
                      r.license_type === 'owned'
                        ? 'family_plus'
                        : r.license_type === 'exclusive'
                        ? 'family'
                        : 'free'
                    }`}
                  >
                    {text.types[r.license_type] ?? r.license_type}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 6, fontSize: 11.5 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>الأقاليم:</span>
                    {countries.length ? (
                      countries.slice(0, 4).map((c) => (
                        <span key={c} className="plan-badge" style={{ fontSize: 10 }}>
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="plan-badge" style={{ fontSize: 10 }}>
                        كل الدول (عالمي)
                      </span>
                    )}
                    {countries.length > 4 && <span style={{ fontSize: 10 }}>+{countries.length - 4}</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>اللغات:</span>
                    {languages.length ? (
                      languages.map((l) => (
                        <span key={l} className="track-badge" style={{ fontSize: 10 }}>
                          {l}
                        </span>
                      ))
                    ) : (
                      <span className="track-badge" style={{ fontSize: 10 }}>
                        كل اللغات
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>الأجهزة:</span>
                    {devices.length ? (
                      devices.map((d) => (
                        <span key={d} className="track-badge" style={{ fontSize: 10 }}>
                          {d}
                        </span>
                      ))
                    ) : (
                      <span className="track-badge" style={{ fontSize: 10 }}>
                        كل الأجهزة
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'auto',
                    paddingTop: 12,
                    borderTop: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <span
                    className={`account-status account-status--${
                      expired ? 'archived' : soon ? 'review' : 'active'
                    }`}
                  >
                    {expired
                      ? text.expired
                      : soon
                      ? 'ينتهي قريباً'
                      : r.expiry_date
                      ? r.expiry_date
                      : text.perpetual}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => setSelectedDrawerRight(r)}
                      title="فحص تفاصيل الترخيص"
                      style={{ padding: '4px 8px' }}
                    >
                      <Icon name="eye" size={13} />
                    </button>
                    <Link
                      className="button button--secondary button--small"
                      to={adminPath(`rights/${r.id}`)}
                    >
                      <Icon name="sparkles" size={13} />
                      <span>مساحة العمل</span>
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <section className="catalog-filter-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.content}</th>
                  <th>{text.owner}</th>
                  <th>{text.type}</th>
                  <th>{text.countries}</th>
                  <th>{text.languages}</th>
                  <th>{text.devices}</th>
                  <th>{text.expires}</th>
                  <th style={{ textAlign: 'end' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rights.map((r) => {
                  const expired = isExpired(r.expiry_date as any)
                  const soon = isSoon(r.expiry_date as any)
                  const countries = parseList(r.countries)
                  const languages = parseList(r.languages)
                  const devices = parseList(r.devices)

                  return (
                    <tr key={r.id}>
                      <td>
                        <Link to={adminPath(`rights/${r.id}`)} className="table-primary">
                          {r.series_title || r.content_id}
                        </Link>
                        <small className="table-secondary" dir="ltr">
                          {r.content_id}
                        </small>
                      </td>
                      <td>{r.owner}</td>
                      <td>
                        <span
                          className={`plan-badge plan-badge--${
                            r.license_type === 'owned'
                              ? 'family_plus'
                              : r.license_type === 'exclusive'
                              ? 'family'
                              : 'free'
                          }`}
                        >
                          {text.types[r.license_type] ?? r.license_type}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {countries.length ? (
                            countries.slice(0, 3).map((c) => (
                              <span key={c} className="plan-badge" style={{ fontSize: 10 }}>
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="table-secondary">—</span>
                          )}
                          {countries.length > 3 && <small>+{countries.length - 3}</small>}
                        </div>
                      </td>
                      <td>{languages.length ? languages.join(', ') : 'كل اللغات'}</td>
                      <td>{devices.length ? devices.join(', ') : 'كل الأجهزة'}</td>
                      <td>
                        <span
                          className={`account-status account-status--${
                            expired ? 'archived' : soon ? 'review' : 'active'
                          }`}
                        >
                          {expired
                            ? text.expired
                            : soon
                            ? 'ينتهي قريباً'
                            : r.expiry_date
                            ? r.expiry_date
                            : text.perpetual}
                        </span>
                      </td>
                      <td style={{ textAlign: 'end' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            className="button button--ghost button--small"
                            onClick={() => setSelectedDrawerRight(r)}
                            title="فحص التفاصيل"
                          >
                            <Icon name="eye" size={13} />
                          </button>
                          <Link className="button button--ghost button--small" to={adminPath(`rights/${r.id}`)}>
                            مساحة العمل
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 7. Pagination */}
      <div style={{ marginTop: 20 }}>
        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          onOffsetChange={list.setOffset}
          locale={locale as any}
        />
      </div>

      {/* 8. Slide-Over Rights Inspector Drawer */}
      {selectedDrawerRight && (
        <>
          <div className="commercial-drawer-backdrop" onClick={() => setSelectedDrawerRight(null)} />
          <div className="commercial-slide-drawer" role="dialog" aria-modal="true">
            <div className="commercial-drawer__header">
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>
                  فحص تفاصيل الترخيص القانوني
                </h3>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                  معرّف الترخيص: {selectedDrawerRight.id}
                </small>
              </div>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => setSelectedDrawerRight(null)}
                style={{ padding: 6 }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="commercial-drawer__body">
              {/* Content Header Card */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 16,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: '#a855f7' }}>المحتوى المرخص</span>
                <h3 style={{ margin: '4px 0 2px', fontSize: 17, fontWeight: 900 }}>
                  {selectedDrawerRight.series_title || selectedDrawerRight.content_id}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <div className="token-copy-box" style={{ flex: 1, padding: '6px 10px', fontSize: 11 }}>
                    <span dir="ltr">{selectedDrawerRight.content_id}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedDrawerRight.content_id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                    >
                      <Icon name="copy" size={13} />
                    </button>
                  </div>
                  {copiedId && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>تم النسخ!</span>}
                </div>
              </div>

              {/* License Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>مالك الحق القانوني</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
                    {selectedDrawerRight.owner}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>نوع الترخيص</span>
                  <div style={{ marginTop: 4 }}>
                    <span
                      className={`plan-badge plan-badge--${
                        selectedDrawerRight.license_type === 'owned'
                          ? 'family_plus'
                          : selectedDrawerRight.license_type === 'exclusive'
                          ? 'family'
                          : 'free'
                      }`}
                    >
                      {text.types[selectedDrawerRight.license_type] ?? selectedDrawerRight.license_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Territories Scope */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 14,
                  background: 'var(--surface)',
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 8 }}>
                  الأقاليم والدول المصرح بالبث فيها (Territories):
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {parseList(selectedDrawerRight.countries).length > 0 ? (
                    parseList(selectedDrawerRight.countries).map((c) => (
                      <span
                        key={c}
                        className="plan-badge"
                        style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontWeight: 800,
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: '#6366f1',
                        }}
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                      ✓ تغطية عالمية شاملة (كل دول العالم دون استثناء)
                    </span>
                  )}
                </div>
              </div>

              {/* Languages & Devices */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>
                    اللغات المصرح بها:
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {parseList(selectedDrawerRight.languages).length > 0 ? (
                      parseList(selectedDrawerRight.languages).map((l) => (
                        <span key={l} className="track-badge" style={{ fontSize: 11 }}>
                          {l}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text)' }}>كل اللغات</span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>
                    المنصات والأجهزة:
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {parseList(selectedDrawerRight.devices).length > 0 ? (
                      parseList(selectedDrawerRight.devices).map((d) => (
                        <span key={d} className="track-badge" style={{ fontSize: 11 }}>
                          {d}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text)' }}>كل الأجهزة (TV, Mobile, Web)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expiry Status */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 14,
                  background: isExpired(selectedDrawerRight.expiry_date as any)
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${
                    isExpired(selectedDrawerRight.expiry_date as any)
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(16, 185, 129, 0.3)'
                  }`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>تاريخ انتهاء الترخيص</span>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                    {selectedDrawerRight.expiry_date || 'ترخيص دائم (Perpetual - بلا نهاية)'}
                  </div>
                </div>
                <span
                  className={`account-status account-status--${
                    isExpired(selectedDrawerRight.expiry_date as any)
                      ? 'archived'
                      : isSoon(selectedDrawerRight.expiry_date as any)
                      ? 'review'
                      : 'active'
                  }`}
                >
                  {isExpired(selectedDrawerRight.expiry_date as any)
                    ? 'منتهي'
                    : isSoon(selectedDrawerRight.expiry_date as any)
                    ? 'ينتهي قريباً'
                    : 'ساري ومصرح'}
                </span>
              </div>
            </div>

            <div className="commercial-drawer__footer">
              <Link
                className="button button--primary"
                to={adminPath(`rights/${selectedDrawerRight.id}`)}
                style={{ flex: 1, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Icon name="sparkles" size={15} />
                <span>فتح مساحة عمل الترخيص الكاملة</span>
              </Link>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setSelectedDrawerRight(null)}
                style={{ height: 42 }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </>
      )}

      {/* 9. Add Right Modal */}
      {open && (
        <Modal open title={text.add} onClose={() => setOpen(false)}>
          <div className="entity-form">
            {formError && (
              <p className="inline-alert inline-alert--error" role="alert">
                {formError}
              </p>
            )}
            <label className="field">
              <span>{text.contentIdLabel} *</span>
              <input
                value={form.content_id}
                onChange={(e) => setForm({ ...form, content_id: e.target.value })}
                placeholder="series_abc123"
                dir="ltr"
              />
              <small>{text.contentIdHint}</small>
            </label>

            <label className="field">
              <span>{text.ownerLabel} *</span>
              <input
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
                placeholder="اسم مالك الحق أو الاستوديو"
              />
            </label>

            <label className="field">
              <span>{text.typeLabel} *</span>
              <select
                value={form.license_type}
                onChange={(e) => setForm({ ...form, license_type: e.target.value as any })}
              >
                {LICENSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {text.types[t] ?? t}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{text.countriesLabel}</span>
              <input
                value={form.countries}
                onChange={(e) => setForm({ ...form, countries: e.target.value })}
                placeholder="EG, SA, AE"
                dir="ltr"
              />
              <small>{text.countriesHint}</small>
            </label>

            <label className="field">
              <span>{text.languagesLabel}</span>
              <input
                value={form.languages}
                onChange={(e) => setForm({ ...form, languages: e.target.value })}
                placeholder="ar, en, fr"
                dir="ltr"
              />
              <small>{text.languagesHint}</small>
            </label>

            <label className="field">
              <span>{text.devicesLabel}</span>
              <input
                value={form.devices}
                onChange={(e) => setForm({ ...form, devices: e.target.value })}
                placeholder="mobile, tv, web"
                dir="ltr"
              />
              <small>{text.devicesHint}</small>
            </label>

            <label className="field">
              <span>{text.expiryLabel}</span>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                dir="ltr"
              />
              <small>{text.expiryHint}</small>
            </label>

            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setOpen(false)}>
                {text.cancel}
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={saving}
                onClick={() => void submit()}
              >
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
