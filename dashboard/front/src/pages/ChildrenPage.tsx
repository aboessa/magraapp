import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { ChildRecord } from '../types/api'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Pagination } from '../components/Pagination'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { adminPath } from '../lib/adminPath'
import { formatNumber, trackLabels } from '../lib/labels'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'
import { Icon } from '../components/Icon'

const months: Record<Locale, string[]> = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

const copy = {
  ar: {
    loadError: 'تعذر تحميل ملفات الأطفال',
    independent: 'النمو والتعلّم الذكي',
    title: 'ملفات الأطفال والمسارات النمائية',
    intro: 'استعراض ملفات الأطفال ومساراتهم العمرية واهتماماتهم المرتبطة بحسابات أولياء الأمور.',
    familyProfiles: 'ملفات الأطفال',
    allProfiles: 'كل الملفات',
    search: 'اسم الطفل أو ولي الأمر...',
    allTracks: 'كل المسارات',
    loading: 'جارٍ تحميل ملفات الأطفال...',
    child: 'الطفل',
    parent: 'ولي الأمر',
    birth: 'الميلاد',
    computedTrack: 'المسار المحسوب',
    interests: 'الاهتمامات',
    status: 'الحالة',
    noName: 'من دون اسم',
    unspecified: 'لم تُحدد',
    empty: 'لا توجد ملفات مطابقة',
    emptyDesc: 'جرّب تغيير البحث أو الفلاتر.',
    viewChild: 'فتح الملف',
    viewFamily: 'ملف العائلة 360',
    inspect: 'معاينة سريعة',
    cardsView: 'بطاقات الأطفال',
    tableView: 'الجدول الشامل',
    totalChildren: 'إجمالي الأطفال',
    preschoolCount: 'براعم (3–5)',
    kidsCount: 'أشبال (6–8)',
    juniorCount: 'يافعين (9–12)',
    refresh: 'تحديث البيانات',
    exportCsv: 'تصدير الملفات (CSV)',
    childDrawerTitle: 'ملف الطفل والمسار التطويري',
    childId: 'معرّف ملف الطفل',
    parentId: 'معرّف ولي الأمر',
    copied: 'تم النسخ!',
    copyId: 'نسخ المعرّف',
    systemBeacon: 'محرك المسارات التطورية',
    beaconSub: 'تحديد آلي للمحتوى حسب العمر',
    yearsOld: 'سنوات',
    bornIn: 'مواليد',
  },
  en: {
    loadError: 'Unable to load child profiles',
    independent: 'Growth & Adaptive Learning',
    title: 'Child Profiles & Age Tracks',
    intro: 'Explore child profiles, age-computed developmental tracks, and learning interests linked to family accounts.',
    familyProfiles: 'Family Profiles',
    allProfiles: 'All Profiles',
    search: 'Child or parent name...',
    allTracks: 'All Tracks',
    loading: 'Loading child profiles...',
    child: 'Child',
    parent: 'Parent',
    birth: 'Birth',
    computedTrack: 'Computed Track',
    interests: 'Interests',
    status: 'Status',
    noName: 'No Name',
    unspecified: 'Not Specified',
    empty: 'No matching profiles',
    emptyDesc: 'Try changing search or filters.',
    viewChild: 'Open',
    viewFamily: 'Family 360',
    inspect: 'Quick Inspect',
    cardsView: 'Child Cards',
    tableView: 'Detailed Table',
    totalChildren: 'Total Children',
    preschoolCount: 'Preschool (3–5)',
    kidsCount: 'Kids (6–8)',
    juniorCount: 'Junior (9–12)',
    refresh: 'Refresh Data',
    exportCsv: 'Export Profiles (CSV)',
    childDrawerTitle: 'Child Dossier & Developmental Track',
    childId: 'Child Profile ID',
    parentId: 'Parent Account ID',
    copied: 'Copied!',
    copyId: 'Copy ID',
    systemBeacon: 'Adaptive Track Engine',
    beaconSub: 'Automatic age-curated streaming',
    yearsOld: 'years old',
    bornIn: 'Born',
  },
}

function parseInterestsList(value: string | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string')
    }
  } catch {
    // fallback if comma separated
    if (typeof value === 'string' && value.includes(',')) {
      return value.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  return []
}

function interestsText(value: string | undefined, locale: Locale) {
  const list = parseInterestsList(value)
  return list.join(locale === 'ar' ? '، ' : ', ')
}

const DEFAULT_FILTERS = { track: '', status: '' }
const LIMIT = 25

const COLUMNS: ColumnDefinition[] = [
  { key: 'child', label: 'child', locked: true },
  { key: 'parent', label: 'parent' },
  { key: 'birth', label: 'birth' },
  { key: 'computedTrack', label: 'computedTrack' },
  { key: 'interests', label: 'interests' },
  { key: 'status', label: 'status' },
]

const FILTER_FIELDS = (text: (typeof copy)['ar'], locale: Locale): FilterField[] => [
  {
    key: 'track',
    label: text.computedTrack,
    type: 'select',
    options: [
      { value: '', label: text.allTracks },
      ...Object.entries(trackLabels[locale]).map(([value, label]) => ({ value, label })),
    ],
  },
  {
    key: 'status',
    label: text.status,
    type: 'select',
    options: [
      { value: '', label: text.status },
      { value: 'active', label: 'active' },
      { value: 'archived', label: 'archived' },
    ],
  },
]

function ageBand(birthMonth: number, birthYear: number, locale: Locale) {
  if (!birthYear) return '—'
  const now = new Date()
  const age = now.getFullYear() - birthYear - (now.getMonth() + 1 < birthMonth ? 1 : 0)
  if (age < 3 || age > 14) return `${age} ${locale === 'ar' ? 'سنوات' : 'years'}`
  return `${age} ${locale === 'ar' ? 'سنوات' : 'years'}`
}

export function ChildrenPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { query, filters, offset, limit } = list
  const { track, status } = filters
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [records, setRecords] = useState<ChildRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDrawerChild, setSelectedDrawerChild] = useState<ChildRecord | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const columns = useColumnPreferences('children', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.children({
        q: query,
        track: track || undefined,
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
  }, [query, text.loadError, track, status, limit, offset])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(timer)
  }, [load])

  const preschool = records.filter((c) => c.age_track === 'preschool').length
  const kids = records.filter((c) => c.age_track === 'kids').length
  const junior = records.filter((c) => c.age_track === 'junior').length

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const exportCSV = () => {
    if (!records.length) return
    const headers = ['Child_ID', 'Nickname', 'Parent_ID', 'Parent_Name', 'Age_Track', 'Birth_Year', 'Birth_Month', 'Interests']
    const csvRows = records.map((c: any) => [
      c.id,
      `"${(c.nickname || '').replace(/"/g, '""')}"`,
      c.parent_id || '',
      `"${(c.parent_name || '').replace(/"/g, '""')}"`,
      c.age_track || '',
      c.birth_year || '',
      c.birth_month || '',
      `"${(interestsText(c.interests, locale) || '').replace(/"/g, '""')}"`,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `children_profiles_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getTrackTheme = (ageTrack: string | undefined) => {
    if (ageTrack === 'preschool') return { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', gradient: 'linear-gradient(135deg, #6366f1, #818cf8)' }
    if (ageTrack === 'kids') return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #34d399)' }
    if (ageTrack === 'junior') return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }
    return { bg: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)' }
  }

  return (
    <div className="content-studio-root">
      {/* 1. Master Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className="status-beacon__dot status-beacon__dot--indigo" />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">{text.systemBeacon}</span>
              <span className="status-beacon__sub">{text.beaconSub}</span>
            </div>
          </div>
          <div className="filter-pill-group" style={{ marginInlineStart: 12 }}>
            <button
              className={`filter-pill ${filters.track === '' ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('track', '')}
            >
              {text.allTracks}
            </button>
            {Object.entries(trackLabels[locale]).map(([val, lbl]) => (
              <button
                key={val}
                className={`filter-pill ${filters.track === val ? 'filter-pill--active' : ''}`}
                onClick={() => list.setFilter('track', val)}
              >
                {lbl}
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
          style={{ background: 'radial-gradient(circle, rgba(236, 72, 153, 0.28) 0%, rgba(139, 92, 246, 0.18) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.independent}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#ec4899' }} />
              {formatNumber(total, locale)} {text.totalChildren}
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
            <span className="commercial-bento-card__title">{text.totalChildren}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="children" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(total, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              <Icon name="check" size={12} /> {locale === 'ar' ? 'جميع الملفات المعتمدة' : 'All approved profiles'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald" onClick={() => list.setFilter('track', 'preschool')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.preschoolCount}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="star" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(preschool, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'المسار التأسيسي الأولي' : 'Preschool Foundation'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--rose" onClick={() => list.setFilter('track', 'kids')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.kidsCount}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="palette" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(kids, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              {locale === 'ar' ? 'المستكشفون والتعلّم التفاعلي' : 'Interactive Explorers'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber" onClick={() => list.setFilter('track', 'junior')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.juniorCount}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="objectives" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(junior, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'الروّاد والمحتوى المتقدم' : 'Advanced Pioneers'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Catalog Control Strip */}
      <section className="catalog-control-strip" style={{ marginTop: 24 }}>
        <div className="catalog-control-strip__left">
          <ListToolbar
            searchValue={query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={FILTER_FIELDS(text, locale)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')}
            trailing={
              <>
                <SavedViewsMenu
                  storageKey="children"
                  currentSearch={list.search}
                  onApply={(search) => navigate(`${adminPath('children')}${search}`)}
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
            {records.map((child: any) => {
              const safeNickname = (child.nickname as string | null) ?? ''
              const initial = safeNickname.trim().charAt(0) || (locale === 'ar' ? 'ط' : 'C')
              const bm = Number(child.birth_month) || 1
              const by = Number(child.birth_year) || 0
              const parsedInterests = parseInterestsList(child.interests)
              const theme = getTrackTheme(child.age_track)

              return (
                <article
                  key={child.id}
                  className="customer-family-card"
                  onClick={() => setSelectedDrawerChild(child)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: theme.gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: 18,
                          boxShadow: `0 4px 12px ${theme.bg}`,
                        }}
                      >
                        {initial}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: 16, color: 'var(--text)' }}>
                          {safeNickname || text.noName}
                        </strong>
                        <small style={{ color: 'var(--muted)', display: 'block' }}>
                          {ageBand(bm, by, locale)} · {months[locale][bm - 1]} {by || ''}
                        </small>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 800,
                        background: theme.bg,
                        color: theme.color,
                        border: '1px solid currentColor',
                      }}
                    >
                      {child.age_track ? ((trackLabels[locale] as Record<string, string>)[child.age_track] ?? child.age_track) : '—'}
                    </span>
                  </div>

                  {parsedInterests.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
                      {parsedInterests.slice(0, 4).map((interest, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: 'var(--surface-2)',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            color: 'var(--text-soft)',
                            border: '1px solid var(--cs-glass-border)',
                          }}
                        >
                          {interest}
                        </span>
                      ))}
                      {parsedInterests.length > 4 && (
                        <span style={{ fontSize: 10.5, color: 'var(--muted)', alignSelf: 'center' }}>
                          +{parsedInterests.length - 4}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0' }}>
                      {locale === 'ar' ? 'لا توجد اهتمامات محددة' : 'No specific interests recorded'}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="parents" size={13} />
                    <span>{text.parent}:</span>
                    <strong style={{ color: 'var(--text)' }}>
                      {child.parent_name || child.parent_id?.slice(0, 10)}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 12,
                      borderTop: '1px solid var(--cs-glass-border)',
                      marginTop: 10,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="button button--ghost button--small"
                      onClick={() => setSelectedDrawerChild(child)}
                    >
                      <Icon name="objectives" size={13} />
                      <span>{text.inspect}</span>
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link
                        to={adminPath(`customers/${child.parent_id}`)}
                        className="button button--ghost button--small"
                        style={{ textDecoration: 'none' }}
                      >
                        <span>{text.viewFamily}</span>
                      </Link>
                      <Link
                        to={adminPath(`children/${child.id}`)}
                        className="button button--primary button--small"
                        style={{ textDecoration: 'none' }}
                      >
                        <span>{text.viewChild}</span>
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
                  <th>{text.child}</th>
                  <th>{text.parent}</th>
                  <th>{text.birth}</th>
                  <th>{text.computedTrack}</th>
                  <th>{text.interests}</th>
                  <th>{text.status}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((child: any) => {
                  const bm = Number(child.birth_month) || 1
                  const by = Number(child.birth_year) || 0
                  const theme = getTrackTheme(child.age_track)
                  return (
                    <tr key={child.id} onClick={() => setSelectedDrawerChild(child)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div className="entity-cell">
                          <span
                            className="entity-avatar"
                            style={{ background: theme.gradient, color: '#fff', fontWeight: 800 }}
                          >
                            {(child.nickname || 'C').charAt(0)}
                          </span>
                          <div>
                            <strong>{child.nickname || text.noName}</strong>
                            <small>{ageBand(bm, by, locale)}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Link
                          to={adminPath(`parents/${child.parent_id}`)}
                          style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {child.parent_name || child.parent_id?.slice(0, 10)}
                        </Link>
                      </td>
                      <td>
                        {by ? `${months[locale][bm - 1]} ${by}` : '—'}
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: theme.bg,
                            color: theme.color,
                          }}
                        >
                          {child.age_track ? ((trackLabels[locale] as Record<string, string>)[child.age_track] ?? child.age_track) : '—'}
                        </span>
                      </td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {interestsText(child.interests, locale) || '—'}
                      </td>
                      <td>
                        <span className={`account-status account-status--${child.status || 'active'}`}>
                          {child.status || 'active'}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions">
                          <button
                            className="button button--ghost button--small"
                            onClick={() => setSelectedDrawerChild(child)}
                            title={text.inspect}
                          >
                            <Icon name="objectives" size={13} />
                          </button>
                          <Link className="button button--ghost button--small" to={adminPath(`children/${child.id}`)}>
                            {text.viewChild}
                          </Link>
                          <Link className="button button--ghost button--small" to={adminPath(`customers/${child.parent_id}`)}>
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
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </div>
        </section>
      )}

      {/* 6. Slide-Over Inspection Drawer */}
      {selectedDrawerChild && (
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
          onClick={() => setSelectedDrawerChild(null)}
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
                background: 'linear-gradient(180deg, rgba(236, 72, 153, 0.08) 0%, transparent 100%)',
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: getTrackTheme(selectedDrawerChild.age_track).gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: 22,
                    boxShadow: `0 8px 20px ${getTrackTheme(selectedDrawerChild.age_track).bg}`,
                  }}
                >
                  {((selectedDrawerChild as any).nickname || 'C').charAt(0)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                    {(selectedDrawerChild as any).nickname || text.noName}
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                    {text.childDrawerTitle}
                  </span>
                </div>
              </div>
              <button
                className="button button--ghost button--small"
                onClick={() => setSelectedDrawerChild(null)}
                style={{ padding: '6px 10px' }}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Copyable Child ID */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  {text.childId}
                </label>
                <div className="token-copy-box">
                  <code style={{ fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {selectedDrawerChild.id}
                  </code>
                  <button
                    className="button button--ghost button--small"
                    onClick={() => copyToClipboard(selectedDrawerChild.id)}
                    style={{ flexShrink: 0, padding: '4px 8px' }}
                  >
                    {copiedId ? text.copied : text.copyId}
                  </button>
                </div>
              </div>

              {/* Copyable Parent ID */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  {text.parentId}
                </label>
                <div className="token-copy-box">
                  <code style={{ fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {selectedDrawerChild.parent_id}
                  </code>
                  <button
                    className="button button--ghost button--small"
                    onClick={() => copyToClipboard(selectedDrawerChild.parent_id)}
                    style={{ flexShrink: 0, padding: '4px 8px' }}
                  >
                    {copiedId ? text.copied : text.copyId}
                  </button>
                </div>
              </div>

              {/* Developmental Track and Status */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 800,
                    background: getTrackTheme(selectedDrawerChild.age_track).bg,
                    color: getTrackTheme(selectedDrawerChild.age_track).color,
                    border: '1px solid currentColor',
                  }}
                >
                  {selectedDrawerChild.age_track
                    ? ((trackLabels[locale] as Record<string, string>)[selectedDrawerChild.age_track] ?? selectedDrawerChild.age_track)
                    : '—'}
                </span>
                <span className={`account-status account-status--${(selectedDrawerChild as any).status || 'active'}`} style={{ padding: '6px 12px', fontSize: 12 }}>
                  {(selectedDrawerChild as any).status || 'active'}
                </span>
              </div>

              {/* Age and Birth Details */}
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
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>العمر المحسوب</span>
                  <strong style={{ fontSize: 14, color: 'var(--text)' }}>
                    {ageBand(Number((selectedDrawerChild as any).birth_month) || 1, Number((selectedDrawerChild as any).birth_year) || 0, locale)}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{text.birth}</span>
                  <strong style={{ fontSize: 13, color: 'var(--text)' }}>
                    {months[locale][(Number((selectedDrawerChild as any).birth_month) || 1) - 1]} {(selectedDrawerChild as any).birth_year || '—'}
                  </strong>
                </div>
              </div>

              {/* Interests Tags */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                  {text.interests}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {parseInterestsList((selectedDrawerChild as any).interests).length > 0 ? (
                    parseInterestsList((selectedDrawerChild as any).interests).map((item, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'var(--surface-2)',
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'var(--text)',
                          border: '1px solid var(--cs-glass-border)',
                        }}
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {locale === 'ar' ? 'لم تُحدد أي اهتمامات حتى الآن' : 'No interests configured yet'}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <Link
                  to={adminPath(`children/${selectedDrawerChild.id}`)}
                  className="button button--primary"
                  style={{ justifyContent: 'center', textDecoration: 'none', padding: '12px 16px' }}
                >
                  <Icon name="children" size={16} />
                  <span>{text.viewChild}</span>
                </Link>
                <Link
                  to={adminPath(`customers/${selectedDrawerChild.parent_id}`)}
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
