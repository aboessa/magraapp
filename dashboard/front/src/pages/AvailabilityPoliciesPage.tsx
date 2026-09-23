import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { ViewSwitcher } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate } from '../lib/labels'
import type { AvailabilityListRow, AvailabilityMode, AvailabilityReason } from '../types/api'

/**
 * كل قيد إتاحة جغرافي مضبوط على المنصّة، في مكان واحد (`ADM-101`).
 */

const copy = {
  ar: {
    eyebrow: 'الحقوق والإتاحة الجغرافية',
    title: 'قيود الإتاحة وتوزيع البث الإقليمي',
    intro: 'كل قيد مضبوط صراحةً على عنصر. ما لا يظهر هنا يرث قيده من أبيه أو من الافتراض العام — والوراثة تُقرأ في تبويب الإتاحة داخل صفحة العنصر.',
    refresh: 'تحديث القيود',
    total: 'الإجمالي',
    entity: 'العنصر',
    type: 'النوع',
    mode: 'النمط',
    countries: 'الدول',
    window: 'النافذة',
    reason: 'السبب',
    updated: 'آخر تعديل',
    open: 'فتح',
    empty: 'لا قيود مضبوطة',
    emptyHint: 'كل المحتوى يتبع الافتراض العام. اضبط قيدًا من تبويب الإتاحة في صفحة العنصر.',
    noCountries: '—',
    always: 'دائمًا',
    from: 'من',
    to: 'إلى',
    searchPlaceholder: 'ابحث عن عنصر أو معرّف...',
    allModes: 'كل الأنماط',
    allReasons: 'كل الأسباب',
    cardsView: 'بطاقات القيود',
    tableView: 'جدول تفصيلي',
    modes: {
      worldwide: 'عالمي',
      worldwide_except: 'عالمي إلا',
      selected_only: 'دول محدَّدة',
      unavailable: 'غير متاح',
    } as Record<AvailabilityMode, string>,
    reasons: {
      rights: 'حقوق',
      commercial: 'تجاري',
      editorial: 'تحريري',
      legal: 'قانوني',
    } as Record<AvailabilityReason, string>,
  },
  en: {
    eyebrow: 'Rights & Territory Availability',
    title: 'Territory Restrictions & Regional Geo-Fencing',
    intro: 'Every policy set explicitly on an entity. Anything absent inherits from its parent or the platform default — inheritance is shown in the entity’s availability tab.',
    refresh: 'Refresh Policies',
    total: 'Total',
    entity: 'Entity',
    type: 'Type',
    mode: 'Mode',
    countries: 'Countries',
    window: 'Window',
    reason: 'Reason',
    updated: 'Updated',
    open: 'Open',
    empty: 'No policies set',
    emptyHint: 'All content follows the platform default. Set one from an entity’s availability tab.',
    noCountries: '—',
    always: 'Always',
    from: 'From',
    to: 'To',
    searchPlaceholder: 'Search entity or ID...',
    allModes: 'All Modes',
    allReasons: 'All Reasons',
    cardsView: 'Policy Cards',
    tableView: 'Detail Table',
    modes: {
      worldwide: 'Worldwide',
      worldwide_except: 'Worldwide except',
      selected_only: 'Selected only',
      unavailable: 'Unavailable',
    } as Record<AvailabilityMode, string>,
    reasons: {
      rights: 'Rights',
      commercial: 'Commercial',
      editorial: 'Editorial',
      legal: 'Legal',
    } as Record<AvailabilityReason, string>,
  },
}

function entityHref(row: AvailabilityListRow): string | null {
  switch (row.entity_type) {
    case 'planet': return adminPath(`planets/${row.entity_id}`)
    case 'series': return adminPath(`series/${row.entity_id}`)
    case 'episode': return adminPath(`episodes/${row.entity_id}`)
    case 'story': return adminPath(`stories/${row.entity_id}`)
    case 'book': return adminPath(`books/${row.entity_id}`)
    case 'game': return adminPath(`games/${row.entity_id}`)
    case 'project': return adminPath(`projects/${row.entity_id}`)
    default: return null
  }
}

export function parseCountryList(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      // not JSON
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

export function AvailabilityPoliciesPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [rows, setRows] = useState<AvailabilityListRow[] | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState<string>('all')
  const [reasonFilter, setReasonFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [selectedDrawerRow, setSelectedDrawerRow] = useState<AvailabilityListRow | null>(null)
  const [simulatedCountry, setSimulatedCountry] = useState('')
  const [simulatedResult, setSimulatedResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.availabilityPolicies()
      const normalized = (response.data ?? []).map((row: AvailabilityListRow) => ({
        ...row,
        countries: parseCountryList(row.countries),
      }))
      setRows(normalized)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setRows(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    if (!rows) return []
    return rows.filter((r) => {
      const matchesSearch =
        !search ||
        (r.entity_title && r.entity_title.toLowerCase().includes(search.toLowerCase())) ||
        r.entity_id.toLowerCase().includes(search.toLowerCase())
      const matchesMode = modeFilter === 'all' || r.mode === modeFilter
      const matchesReason = reasonFilter === 'all' || r.reason === reasonFilter
      return matchesSearch && matchesMode && matchesReason
    })
  }, [rows, search, modeFilter, reasonFilter])

  const stats = useMemo(() => {
    if (!rows) return { total: 0, except: 0, unavailable: 0, rightsOrLegal: 0 }
    return {
      total: rows.length,
      except: rows.filter((r) => r.mode === 'worldwide_except').length,
      unavailable: rows.filter((r) => r.mode === 'unavailable').length,
      rightsOrLegal: rows.filter((r) => r.reason === 'rights' || r.reason === 'legal').length,
    }
  }, [rows])

  const handleSimulate = (code: string) => {
    const c = code.trim().toUpperCase()
    setSimulatedCountry(c)
    if (!c || !rows) {
      setSimulatedResult(null)
      return
    }

    const blockedCount = rows.filter((r) => {
      const cList = parseCountryList(r.countries)
      if (r.mode === 'unavailable') return true
      if (r.mode === 'worldwide_except' && cList.includes(c)) return true
      if (r.mode === 'selected_only' && !cList.includes(c)) return true
      return false
    }).length

    setSimulatedResult(
      blockedCount > 0
        ? `في الدولة [${c}]، يوجد ${blockedCount} عنصر محجوب بحسب القيود الجغرافية الصريحة.`
        : `في الدولة [${c}]، جميع العناصر ذات القيود الصريحة متاحة للبث.`,
    )
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (rows === null) return <LoadingState />

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
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <span className="status-dot-pulse" style={{ background: '#ef4444' }} />
            <span>محرك الفحص الجغرافي (HTTP 451) نشط</span>
          </div>

          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
            {rows.length} قيد جغرافي مباشر على مستوى الكتالوج
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
            <span>{text.refresh}</span>
          </button>
        </div>
      </header>

      {/* 2. Hero Panoramic Headline */}
      <section className="catalog-hero" style={{ marginBottom: 20 }}>
        <div
          className="catalog-hero__glow"
          style={{
            background:
              'radial-gradient(circle, rgba(239, 68, 68, 0.22) 0%, rgba(245, 158, 11, 0.15) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
            >
              <span className="status-dot-pulse" style={{ background: '#ef4444' }} />
              {rows.length} {text.total}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.intro}</p>
        </div>
      </section>

      {/* 3. Interactive Geo Decision Simulator Widget */}
      <div className="geo-simulator-box" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(14, 165, 233, 0.15)',
              color: '#0ea5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="globe" size={20} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
              جهاز محاكاة فحص الإتاحة الجغرافية
            </div>
            <small style={{ color: 'var(--muted)', fontSize: 11 }}>
              اختبر قرار البث الفوري لأي بلد عبر كتابة رمزه (مثل: EG, SA, FR, DE, US)
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineStart: 'auto' }}>
          <input
            type="text"
            placeholder="ISO كود (مثال: FR)"
            maxLength={2}
            value={simulatedCountry}
            onChange={(e) => setSimulatedCountry(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSimulate(simulatedCountry)
            }}
            style={{
              height: 38,
              width: 140,
              borderRadius: 10,
              border: '1px solid var(--cs-glass-border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 800,
              textAlign: 'center',
              outline: 'none',
            }}
          />
          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => handleSimulate(simulatedCountry)}
            style={{ height: 38 }}
          >
            اختبار الإتاحة
          </button>
        </div>

        {simulatedResult && (
          <div
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text)',
              marginTop: 4,
            }}
          >
            {simulatedResult}
          </div>
        )}
      </div>

      {/* 4. Bento Live Metric KPI Strip */}
      <div className="hero-kpis">
        <div
          className="kpi-glass-card"
          onClick={() => {
            setModeFilter('all')
            setReasonFilter('all')
            setSearch('')
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Icon name="globe" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.total}</span>
            <div className="kpi-glass-card__num">{stats.total}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#3b82f6' }}>
              {locale === 'ar' ? 'كل القيود النشطة' : 'Active Policies'}
            </span>
          </div>
        </div>

        <div
          className="kpi-glass-card"
          onClick={() => setModeFilter('worldwide_except')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Icon name="alert-triangle" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{locale === 'ar' ? 'استثناءات جغرافية' : 'Territory Exceptions'}</span>
            <div className="kpi-glass-card__num">{stats.except}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#f59e0b' }}>
              {locale === 'ar' ? 'عالمي مع استثناء' : 'Worldwide except'}
            </span>
          </div>
        </div>

        <div
          className="kpi-glass-card"
          onClick={() => setModeFilter('unavailable')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <Icon name="shield" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{locale === 'ar' ? 'حجب جغرافي صارم' : 'Territory Blocks'}</span>
            <div className="kpi-glass-card__num">{stats.unavailable}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#ef4444' }}>
              {locale === 'ar' ? 'غير متاح إطلاقاً' : 'Fully Unavailable'}
            </span>
          </div>
        </div>

        <div
          className="kpi-glass-card"
          onClick={() => setReasonFilter('rights')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
            <Icon name="info" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{locale === 'ar' ? 'أسباب قانونية وحقوق' : 'Legal & Rights'}</span>
            <div className="kpi-glass-card__num">{stats.rightsOrLegal}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#8b5cf6' }}>
              {locale === 'ar' ? 'حقوق وترخيص' : 'Regulatory'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Studio Filter & Control Strip */}
      <div className="catalog-control-strip">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          <div className="search-box" style={{ maxWidth: 320 }}>
            <input
              type="search"
              placeholder={text.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-box__input"
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="filter-pill-select"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--cs-glass-border)',
                borderRadius: '10px',
                padding: '6px 14px',
                color: 'inherit',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <option value="all">{text.allModes}</option>
              <option value="worldwide">{locale === 'ar' ? 'نطاق عالمي' : 'Worldwide'}</option>
              <option value="worldwide_except">{locale === 'ar' ? 'نطاق عالمي مع استثناء' : 'Worldwide except'}</option>
              <option value="selected_only">{locale === 'ar' ? 'دول محددة فقط' : 'Selected only'}</option>
              <option value="unavailable">{locale === 'ar' ? 'محتوى محجوب' : 'Unavailable'}</option>
            </select>

            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="filter-pill-select"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--cs-glass-border)',
                borderRadius: '10px',
                padding: '6px 14px',
                color: 'inherit',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <option value="all">{text.allReasons}</option>
              <option value="rights">{locale === 'ar' ? 'سبب: حقوق' : 'Reason: Rights'}</option>
              <option value="commercial">{locale === 'ar' ? 'سبب: تجاري' : 'Reason: Commercial'}</option>
              <option value="editorial">{locale === 'ar' ? 'سبب: تحريري' : 'Reason: Editorial'}</option>
              <option value="legal">{locale === 'ar' ? 'سبب: قانوني' : 'Reason: Legal'}</option>
            </select>
          </div>
        </div>

        <div className="catalog-control-strip__right" style={{ alignSelf: 'center' }}>
          <ViewSwitcher
            modes={['table', 'cards']}
            current={viewMode}
            onChange={setViewMode}
            labels={{ table: text.tableView, cards: text.cardsView }}
          />
        </div>
      </div>

      {/* 6. Main Content: Table or Cards */}
      {rows.length === 0 ? (
        <EmptyState title={text.empty} description={text.emptyHint} />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title={locale === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching policies'}
          description={locale === 'ar' ? 'جرّب تعديل البحث أو الفلاتر' : 'Try adjusting your search or filters'}
        />
      ) : viewMode === 'cards' ? (
        <div className="rights-studio-grid">
          {filteredRows.map((row) => {
            const href = entityHref(row)
            const isUnavail = row.mode === 'unavailable'
            return (
              <div key={row.id} className="rights-card-item">
                <div className="rights-card-item__header">
                  <div>
                    <span className="track-badge" style={{ marginBottom: 6, display: 'inline-block' }}>
                      {row.entity_type}
                    </span>
                    <h3 className="rights-card-item__title">{row.entity_title || row.entity_id}</h3>
                    <code className="rights-card-item__code" dir="ltr">{row.entity_id}</code>
                  </div>
                  <span
                    className={`account-status account-status--${
                      isUnavail ? 'archived' : row.mode === 'worldwide_except' ? 'review' : 'active'
                    }`}
                  >
                    {text.modes[row.mode] ?? row.mode}
                  </span>
                </div>

                <div className="rights-card-item__body">
                  <div className="rights-card-item__prop">
                    <span className="rights-card-item__prop-label">{text.countries}</span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {parseCountryList(row.countries).length ? (
                        parseCountryList(row.countries).map((c) => (
                          <span key={c} className="plan-badge" style={{ fontSize: 11 }} dir="ltr">
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="table-secondary">{text.noCountries}</span>
                      )}
                    </div>
                  </div>

                  <div className="rights-card-item__prop">
                    <span className="rights-card-item__prop-label">{text.window}</span>
                    <span className="rights-card-item__prop-value">
                      {row.starts_at || row.ends_at ? (
                        <small>
                          {row.starts_at ? `${text.from} ${formatDate(row.starts_at, locale)}` : ''}
                          {row.starts_at && row.ends_at ? ' · ' : ''}
                          {row.ends_at ? `${text.to} ${formatDate(row.ends_at, locale)}` : ''}
                        </small>
                      ) : (
                        <small>{text.always}</small>
                      )}
                    </span>
                  </div>

                  <div className="rights-card-item__prop">
                    <span className="rights-card-item__prop-label">{text.reason}</span>
                    <span className="rights-card-item__prop-value" style={{ fontWeight: 600 }}>
                      {text.reasons[row.reason] ?? row.reason}
                    </span>
                  </div>
                </div>

                <div className="rights-card-item__footer">
                  <small style={{ color: 'var(--text-muted)' }}>
                    {row.updated_at ? formatDate(row.updated_at, locale) : '—'}
                  </small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => setSelectedDrawerRow(row)}
                      title="فحص القيد"
                      style={{ padding: '4px 8px' }}
                    >
                      <Icon name="eye" size={13} />
                    </button>
                    {href ? (
                      <Link className="button button--ghost button--small" to={href}>
                        {text.open}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <section
          className="catalog-filter-card"
          style={{ padding: 0, borderRadius: 16, overflow: 'hidden' }}
        >
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.entity}</th>
                  <th>{text.type}</th>
                  <th>{text.mode}</th>
                  <th>{text.countries}</th>
                  <th>{text.window}</th>
                  <th>{text.reason}</th>
                  <th>{text.updated}</th>
                  <th style={{ textAlign: 'end' }}>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const href = entityHref(row)
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.entity_title || row.entity_id}</strong>
                        <br />
                        <small dir="ltr" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {row.entity_id}
                        </small>
                      </td>
                      <td>
                        <span className="track-badge">{row.entity_type}</span>
                      </td>
                      <td>
                        <span
                          className={`account-status account-status--${
                            row.mode === 'unavailable'
                              ? 'archived'
                              : row.mode === 'worldwide_except'
                              ? 'review'
                              : 'active'
                          }`}
                        >
                          {text.modes[row.mode] ?? row.mode}
                        </span>
                      </td>
                      <td dir="ltr">
                        {parseCountryList(row.countries).length ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {parseCountryList(row.countries).map((c) => (
                              <span key={c} className="plan-badge" style={{ fontSize: 10 }}>
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          text.noCountries
                        )}
                      </td>
                      <td>
                        {row.starts_at || row.ends_at ? (
                          <small>
                            {row.starts_at ? `${text.from} ${formatDate(row.starts_at, locale)}` : ''}
                            {row.starts_at && row.ends_at ? ' · ' : ''}
                            {row.ends_at ? `${text.to} ${formatDate(row.ends_at, locale)}` : ''}
                          </small>
                        ) : (
                          <small>{text.always}</small>
                        )}
                      </td>
                      <td>
                        <span
                          className="track-badge"
                          style={{
                            background:
                              row.reason === 'legal'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : row.reason === 'rights'
                                ? 'rgba(168, 85, 247, 0.12)'
                                : 'rgba(99, 102, 241, 0.12)',
                            color:
                              row.reason === 'legal'
                                ? '#ef4444'
                                : row.reason === 'rights'
                                ? '#a855f7'
                                : 'var(--text)',
                          }}
                        >
                          {text.reasons[row.reason] ?? row.reason}
                        </span>
                      </td>
                      <td>
                        <small>{row.updated_at ? formatDate(row.updated_at, locale) : '—'}</small>
                      </td>
                      <td style={{ textAlign: 'end' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            className="button button--ghost button--small"
                            onClick={() => setSelectedDrawerRow(row)}
                            title="فحص التفاصيل"
                          >
                            <Icon name="eye" size={13} />
                          </button>
                          {href && (
                            <Link className="button button--ghost button--small" to={href}>
                              {text.open}
                            </Link>
                          )}
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

      {/* 7. Slide-Over Availability Policy Drawer */}
      {selectedDrawerRow && (
        <>
          <div className="commercial-drawer-backdrop" onClick={() => setSelectedDrawerRow(null)} />
          <div className="commercial-slide-drawer" role="dialog" aria-modal="true">
            <div className="commercial-drawer__header">
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>
                  فحص قيد الإتاحة الجغرافي
                </h3>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                  معرّف القيد: {selectedDrawerRow.id}
                </small>
              </div>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => setSelectedDrawerRow(null)}
                style={{ padding: 6 }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="commercial-drawer__body">
              {/* Entity Headline Card */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 16,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <span className="track-badge" style={{ marginBottom: 6 }}>
                  {selectedDrawerRow.entity_type}
                </span>
                <h3 style={{ margin: '4px 0 2px', fontSize: 17, fontWeight: 900 }}>
                  {selectedDrawerRow.entity_title || selectedDrawerRow.entity_id}
                </h3>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  {selectedDrawerRow.entity_id}
                </div>
              </div>

              {/* Mode and Reason */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>النمط المطبق</span>
                  <div style={{ marginTop: 4 }}>
                    <span
                      className={`account-status account-status--${
                        selectedDrawerRow.mode === 'unavailable'
                          ? 'archived'
                          : selectedDrawerRow.mode === 'worldwide_except'
                          ? 'review'
                          : 'active'
                      }`}
                    >
                      {text.modes[selectedDrawerRow.mode] ?? selectedDrawerRow.mode}
                    </span>
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
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>سبب القيد</span>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>
                    {text.reasons[selectedDrawerRow.reason] ?? selectedDrawerRow.reason}
                  </div>
                </div>
              </div>

              {/* Restricted Countries */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 14,
                  background: 'var(--surface)',
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 8 }}>
                  قائمة الدول المحددة في هذا القيد:
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {parseCountryList(selectedDrawerRow.countries).length > 0 ? (
                    parseCountryList(selectedDrawerRow.countries).map((c) => (
                      <span
                        key={c}
                        className="plan-badge"
                        style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontWeight: 800,
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#ef4444',
                        }}
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                      لا توجد دول محددة (يطبق كقيد شامل حسب النمط)
                    </span>
                  )}
                </div>
              </div>

              {/* Time Window */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>النافذة الزمنية للقيد:</span>
                <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>
                  {selectedDrawerRow.starts_at || selectedDrawerRow.ends_at ? (
                    <span>
                      {selectedDrawerRow.starts_at ? `${text.from} ${formatDate(selectedDrawerRow.starts_at, locale)}` : ''}
                      {selectedDrawerRow.starts_at && selectedDrawerRow.ends_at ? ' · ' : ''}
                      {selectedDrawerRow.ends_at ? `${text.to} ${formatDate(selectedDrawerRow.ends_at, locale)}` : ''}
                    </span>
                  ) : (
                    <span>{text.always} (دائم حتى التعديل الصريح)</span>
                  )}
                </div>
              </div>

              {/* Resolution rule notice */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 12,
                  background: 'rgba(14, 165, 233, 0.08)',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                  fontSize: 12,
                  color: 'var(--text)',
                }}
              >
                <div style={{ fontWeight: 800, color: '#0ea5e9', marginBottom: 4 }}>
                  مبدأ الوراثة الصارمة:
                </div>
                أي تعديل على هذا القيد يتم مباشرة في لوحة الإتاحة داخل صفحة العنصر لضمان تناسق التوريث من الأب إلى
                الأبناء.
              </div>
            </div>

            <div className="commercial-drawer__footer">
              {entityHref(selectedDrawerRow) ? (
                <Link
                  className="button button--primary"
                  to={entityHref(selectedDrawerRow)!}
                  style={{ flex: 1, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Icon name="sparkles" size={15} />
                  <span>فتح العنصر في الاستوديو</span>
                </Link>
              ) : null}
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setSelectedDrawerRow(null)}
                style={{ height: 42 }}
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
