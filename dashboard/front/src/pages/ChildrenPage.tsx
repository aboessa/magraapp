import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { ChildRecord } from '../types/api'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Pagination } from '../components/Pagination'
import { TrackBadge } from '../components/StatusBadge'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { adminPath } from '../lib/adminPath'
import { accountStatusLabels, formatNumber, trackLabels } from '../lib/labels'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'

const months: Record<Locale, string[]> = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

const copy = {
  ar: {
    loadError: 'تعذر تحميل ملفات الأطفال', independent: 'ملفات الأطفال', title: 'ملفات الأطفال',
    intro: 'عرض ملفات الأطفال المرتبطة بعائلاتهم. إنشاء الملفات يتم من حساب ولي الأمر.',
    familyProfiles: 'ملفات الأسرة', allProfiles: 'كل الملفات', search: 'اسم الطفل أو ولي الأمر...', allTracks: 'كل المسارات', loading: 'جارٍ تحميل ملفات الأطفال...',
    child: 'الطفل', parent: 'ولي الأمر', birth: 'الميلاد', computedTrack: 'المسار المحسوب', interests: 'الاهتمامات', status: 'الحالة', noName: 'من دون اسم', unspecified: 'لم تُحدد',
    empty: 'لا توجد ملفات مطابقة', emptyDesc: 'جرّب تغيير البحث أو الفلاتر.',
    viewChild: 'فتح الملف', viewFamily: 'العائلة',
  },
  en: {
    loadError: 'Unable to load child profiles', independent: 'Child profiles', title: 'Child profiles',
    intro: 'Browse child profiles linked to their families. Profiles are created from the parent account.',
    familyProfiles: 'Family profiles', allProfiles: 'All profiles', search: 'Child or parent name...', allTracks: 'All tracks', loading: 'Loading child profiles...',
    child: 'Child', parent: 'Parent', birth: 'Birth', computedTrack: 'Computed track', interests: 'Interests', status: 'Status', noName: 'No name', unspecified: 'Not specified',
    empty: 'No matching profiles', emptyDesc: 'Try changing search or filters.',
    viewChild: 'Open', viewFamily: 'Family',
  },
}

function interestsText(value: string, locale: Locale) {
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').join(locale === 'ar' ? '، ' : ', ') : '' } catch { return '' }
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
  { key: 'track', label: text.computedTrack, type: 'select', options: [{ value: '', label: text.allTracks }, ...Object.entries(trackLabels[locale]).map(([value, label]) => ({ value, label }))] },
  { key: 'status', label: text.status, type: 'select', options: [{ value: '', label: text.status }, { value: 'active', label: 'active' }, { value: 'archived', label: 'archived' }] },
]

function ageBand(birthMonth: number, birthYear: number, locale: Locale) {
  const now = new Date()
  const age = now.getFullYear() - birthYear - (now.getMonth() + 1 < birthMonth ? 1 : 0)
  if (age < 3 || age > 12) return locale === 'ar' ? '—' : '—'
  return `${age} ${locale === 'ar' ? 'سنة' : 'y'}`
}

export function ChildrenPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { query, filters, offset, limit } = list
  const { track, status } = filters
  const [records, setRecords] = useState<ChildRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const columns = useColumnPreferences('children', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.children({ q: query, track: track || undefined, status: status || undefined, limit, offset })
      setRecords(response.data)
      setTotal(response.meta?.total ?? response.data.length)
    } catch (caught) { setError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setLoading(false) }
  }, [query, text.loadError, track, status, limit, offset])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer) }, [load])

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.independent}</span><h2>{text.title}</h2><p>{text.intro}</p></div></section>
      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><span className="panel__kicker">{text.familyProfiles}</span><h3>{text.allProfiles} <span className="title-count">{total}</span></h3></div>
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
                <SavedViewsMenu storageKey="children" currentSearch={list.search} onApply={(search) => navigate(`${adminPath('children')}${search}`)} />
                <ColumnManager columns={COLUMNS.map((c) => ({ ...c, label: text[c.label as keyof typeof text] ?? c.label }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} />
              </>
            }
          />
        </header>
        {loading && !records.length ? <LoadingState label={text.loading} /> : error && !records.length ? <ErrorState message={error} onRetry={() => void load()} /> : records.length ? (
          <>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>{text.child}</th>{columns.isVisible('parent') && <th>{text.parent}</th>}{columns.isVisible('birth') && <th>{text.birth}</th>}{columns.isVisible('computedTrack') && <th>{text.computedTrack}</th>}{columns.isVisible('interests') && <th>{text.interests}</th>}{columns.isVisible('status') && <th>{text.status}</th>}<th /></tr></thead>
                <tbody>
                  {records.map((child) => (
                    <tr key={child.id}>
                      <td>
                        <Link className="entity-cell entity-cell--button" to={adminPath(`children/${child.id}`)}>
                          <span className={`entity-avatar child-avatar child-avatar--${child.age_track}`}>{child.nickname.charAt(0)}</span>
                          <div><strong>{child.nickname}</strong><small>{ageBand(child.birth_month, child.birth_year, locale)} · {child.avatar_id}</small></div>
                        </Link>
                      </td>
                      {columns.isVisible('parent') && <td><Link className="table-primary" to={adminPath(`parents/${child.parent_id}`)}>{child.parent_name || text.noName}</Link><small className="table-secondary">{child.parent_email || ''}</small></td>}
                      {columns.isVisible('birth') && <td>{months[locale][child.birth_month - 1]} {formatNumber(child.birth_year, locale)}</td>}
                      {columns.isVisible('computedTrack') && <td><TrackBadge track={child.age_track} /></td>}
                      {columns.isVisible('interests') && <td className="cell-wrap">{interestsText(child.interests, locale) || text.unspecified}</td>}
                      {columns.isVisible('status') && <td><span className={`account-status account-status--${child.status}`}>{accountStatusLabels[locale][child.status]}</span></td>}
                      <td>
                        <div className="table-actions">
                          <Link className="button button--ghost button--small" to={adminPath(`children/${child.id}`)}>{text.viewChild}</Link>
                          <Link className="button button--ghost button--small" to={adminPath(`customers/${child.parent_id}`)}>{text.viewFamily}</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </>
        ) : <EmptyState title={text.empty} description={text.emptyDesc} />}
      </section>
    </div>
  )
}
