import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { Pagination } from '../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import type { CustomerListRow } from '../types/api'

/**
 * قائمة العائلات: نقطة الدخول إلى Customer 360.
 *
 * ## لماذا منفصلة عن ParentsPage
 *
 * `ParentsPage` قراءة صحيحة لإسقاط الوالدين بلا كتابة، وهي كذلك بتصميم. هذه
 * الصفحة سؤال مختلف: «أي عائلة تحتاج تدخّلًا الآن» — فتحمل عدّاد تذاكر مفتوحة
 * وعدّاد أجهزة، وتفتح مساحة العمل لا صفحة قراءة.
 *
 * العدّادات من الإسقاط لا من مصدر السلطة بقصد: قائمة تنادي كائنًا دائمًا لكل صفّ
 * تعني خمسة وعشرين نداءً لكل صفحة. القراءة الحيّة تحدث في مساحة العمل حيث تخصّ
 * عائلة واحدة، وهي مُعلَنة هناك.
 */

const copy = {
  ar: {
    eyebrow: 'العملاء',
    title: 'العائلات',
    lede: 'نقطة الدخول إلى مساحة عمل العائلة. العدّادات هنا من إسقاط D1؛ القراءة الحيّة من مصدر السلطة تجري داخل مساحة العمل.',
    search: 'بحث بمعرّف العائلة…',
    allPlans: 'كل الباقات',
    allStatuses: 'كل الحالات',
    family: 'العائلة',
    plan: 'الباقة',
    status: 'الحالة',
    children: 'الأطفال',
    devices: 'الأجهزة',
    openTickets: 'تذاكر مفتوحة',
    open: 'مساحة العمل',
    empty: 'لا عائلات مطابقة',
    emptyHint: 'غيّر البحث أو الفلاتر.',
    loadError: 'تعذر تحميل العائلات',
  },
  en: {
    eyebrow: 'Customers',
    title: 'Families',
    lede: 'The entry point to the family workspace. Counts here come from the D1 projection; the live authority read happens inside the workspace.',
    search: 'Search by family id…',
    allPlans: 'All plans',
    allStatuses: 'All statuses',
    family: 'Family',
    plan: 'Plan',
    status: 'Status',
    children: 'Children',
    devices: 'Devices',
    openTickets: 'Open tickets',
    open: 'Workspace',
    empty: 'No matching families',
    emptyHint: 'Change the search or the filters.',
    loadError: 'Unable to load families',
  },
}

const LIMIT = 25
const PLANS = ['free', 'family', 'family_plus']
const STATUSES = ['active', 'suspended', 'deleted']

export function CustomersPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [rows, setRows] = useState<CustomerListRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.customers({
        q: query.trim() || undefined,
        plan: plan || undefined,
        status: status || undefined,
        limit: LIMIT,
        offset,
      })
      setRows(response.data)
      setTotal(response.meta?.total ?? response.data.length)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [offset, plan, query, status, text.loadError])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, query ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load, query])

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
          <div className="filters-row">
            <label className="search-field">
              <Icon name="search" size={17} />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0) }} placeholder={text.search} />
            </label>
            <select aria-label={text.allPlans} value={plan} onChange={(event) => { setPlan(event.target.value); setOffset(0) }}>
              <option value="">{text.allPlans}</option>
              {PLANS.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
            <select aria-label={text.allStatuses} value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0) }}>
              <option value="">{text.allStatuses}</option>
              {STATUSES.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </div>
        </header>

        {loading && !rows.length ? <LoadingState /> : error && !rows.length ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : rows.length ? (
          <>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.family}</th><th>{text.plan}</th><th>{text.status}</th>
                    <th>{text.children}</th><th>{text.devices}</th><th>{text.openTickets}</th><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.parent_id}>
                      <td>
                        <Link className="entity-cell entity-cell--button" to={adminPath(`customers/${row.parent_id}`)}>
                          <div><strong dir="ltr">{row.parent_id}</strong></div>
                        </Link>
                      </td>
                      <td>{row.plan}</td>
                      <td>
                        <span className={`account-status account-status--${row.status === 'active' ? 'active' : 'archived'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>{row.child_count}</td>
                      <td>{row.device_count}</td>
                      <td>
                        {row.open_tickets > 0
                          ? <span className="readiness-item readiness-item--warn readiness-pill">{row.open_tickets}</span>
                          : <span className="table-secondary">0</span>}
                      </td>
                      <td>
                        <Link className="button button--ghost" to={adminPath(`customers/${row.parent_id}`)}>{text.open}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={LIMIT} offset={offset} onOffsetChange={setOffset} locale={locale} />
          </>
        ) : <EmptyState title={text.empty} description={text.emptyHint} />}
      </section>
    </div>
  )
}
