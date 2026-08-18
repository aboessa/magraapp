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
import { accountStatusLabels, formatDate, planLabels } from '../lib/labels'
import { usePreferences } from '../context/preferences'
import type { ParentRecord } from '../types/api'

const copy = {
  ar: {
    loadError: 'تعذر تحميل أولياء الأمور', account: 'حساب الأسرة', title: 'أولياء الأمور',
    intro: 'إدارة حسابات أولياء الأمور والوصول إلى ملفات العائلة المرتبطة.',
    refresh: 'تحديث', directory: 'دليل الحسابات',
    search: 'اسم أو بريد...', allPlans: 'كل الباقات', parent: 'ولي الأمر', plan: 'الباقة', children: 'الأطفال', language: 'اللغة',
    status: 'الحالة', joined: 'تاريخ التسجيل', loading: 'جارٍ تحميل الحسابات...',
    noName: 'من دون اسم معروض', arabic: 'العربية', english: 'الإنجليزية', empty: 'لا توجد حسابات مطابقة',
    emptyDesc: 'غيّر البحث أو الفلاتر للعثور على الحسابات.',
    family: 'العائلة', contact: 'التواصل', verification: 'التحقق', lastActive: 'آخر نشاط',
    viewFamily: 'العائلة', open: 'فتح',
  },
  en: {
    loadError: 'Unable to load parent accounts', account: 'Family account', title: 'Parents',
    intro: 'Manage parent accounts and jump to their family workspaces.',
    refresh: 'Refresh', directory: 'Account directory',
    search: 'Name or email...', allPlans: 'All plans', parent: 'Parent', plan: 'Plan', children: 'Children', language: 'Language',
    status: 'Status', joined: 'Registration date', loading: 'Loading accounts...',
    noName: 'No display name', arabic: 'Arabic', english: 'English', empty: 'No matching accounts',
    emptyDesc: 'Change your search or filters to find accounts.',
    family: 'Family', contact: 'Contact', verification: 'Verification', lastActive: 'Last active',
    viewFamily: 'Family', open: 'Open',
  },
}

const PLANS = ['free', 'family', 'family_plus']
const STATUSES = ['active', 'suspended', 'archived']
const LIMIT = 25
const DEFAULT_FILTERS = { plan: '', status: '' }

const FILTER_FIELDS = (text: (typeof copy)['ar']): FilterField[] => [
  { key: 'plan', label: text.plan, type: 'select', options: [{ value: '', label: text.allPlans }, ...PLANS.map((v) => ({ value: v, label: v }))] },
  { key: 'status', label: text.status, type: 'select', options: [{ value: '', label: text.status }, ...STATUSES.map((v) => ({ value: v, label: v }))] },
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
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { query, filters, offset, limit } = list
  const { plan, status } = filters
  const [records, setRecords] = useState<ParentRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const columns = useColumnPreferences('parents', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.parents({ q: query, plan: plan || undefined, status: status || undefined, limit, offset })
      setRecords(response.data)
      setTotal(response.meta?.total ?? response.data.length)
    } catch (caught) { setError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setLoading(false) }
  }, [plan, query, status, limit, offset, text.loadError])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer) }, [load])

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">{text.account}</span><h2>{text.title}</h2><p>{text.intro}</p></div>
        <button className="button button--secondary" type="button" onClick={() => void load()}><Icon name="refresh" size={17} />{text.refresh}</button>
      </section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><span className="panel__kicker">{text.directory}</span><h3>{text.title} <span className="title-count">{total}</span></h3></div>
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
                <SavedViewsMenu storageKey="parents" currentSearch={list.search} onApply={(search) => navigate(`${adminPath('parents')}${search}`)} />
                <ColumnManager columns={COLUMNS.map((c) => ({ ...c, label: text[c.label as keyof typeof text] ?? c.label }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} />
              </>
            }
          />
        </header>
        {loading && !records.length ? <LoadingState label={text.loading} /> : error && !records.length ? <ErrorState message={error} onRetry={() => void load()} /> : records.length ? (
          <>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>{text.parent}</th>{columns.isVisible('family') && <th>{text.plan}</th>}<th>{text.children}</th><th>{text.language}</th><th>{text.status}</th><th>{text.joined}</th><th /></tr></thead>
                <tbody>
                  {records.map((parent) => (
                    <tr key={parent.id}>
                      <td>
                        <Link className="entity-cell entity-cell--button" to={adminPath(`parents/${parent.id}`)}>
                          <span className="entity-avatar entity-avatar--parent">{(parent.display_name || parent.email || (locale === 'ar' ? 'و' : 'P')).charAt(0)}</span>
                          <div><strong>{parent.display_name || text.noName}</strong><small>{parent.email || parent.id}</small></div>
                        </Link>
                      </td>
                      {columns.isVisible('family') && <td><span className={`plan-badge plan-badge--${parent.plan}`}>{planLabels[locale][parent.plan]}</span></td>}
                      <td>{parent.children_count}</td>
                      <td>{parent.locale === 'ar' ? text.arabic : parent.locale === 'en' ? text.english : parent.locale}</td>
                      <td><span className={`account-status account-status--${parent.status}`}>{accountStatusLabels[locale][parent.status]}</span></td>
                      <td>{formatDate(parent.created_at, locale)}</td>
                      <td>
                        <div className="table-actions">
                          <Link className="button button--ghost button--small" to={adminPath(`parents/${parent.id}`)}>{text.open}</Link>
                          <Link className="button button--ghost button--small" to={adminPath(`customers/${parent.id}`)}>{text.viewFamily}</Link>
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
