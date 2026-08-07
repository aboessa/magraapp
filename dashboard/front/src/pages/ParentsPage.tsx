import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ParentRecord } from '../types/api'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { accountStatusLabels, formatDate, formatNumber, planLabels } from '../lib/labels'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: {
    loadError: 'تعذر تحميل أولياء الأمور', account: 'حساب الأسرة', title: 'أولياء الأمور',
    intro: 'حساب ولي الأمر هو المالك لكل ملفات الأطفال والموافقات والاشتراك.', refresh: 'تحديث', directory: 'دليل الحسابات',
    search: 'اسم أو بريد...', allPlans: 'كل الباقات', parent: 'ولي الأمر', plan: 'الباقة', children: 'ملفات الأطفال', language: 'اللغة',
    timezone: 'المنطقة الزمنية', status: 'الحالة', joined: 'تاريخ التسجيل', loading: 'جارٍ تحميل الحسابات...',
    noName: 'من دون اسم معروض', arabic: 'العربية', english: 'الإنجليزية', empty: 'لا توجد حسابات بعد',
    emptyDesc: 'ستظهر حسابات أولياء الأمور هنا فور تسجيلها فعليًا؛ لا تعرض اللوحة مستخدمين افتراضيين.',
  },
  en: {
    loadError: 'Unable to load parent accounts', account: 'Family account', title: 'Parents',
    intro: 'The parent account owns all child profiles, consents, and the subscription.', refresh: 'Refresh', directory: 'Account directory',
    search: 'Name or email...', allPlans: 'All plans', parent: 'Parent', plan: 'Plan', children: 'Child profiles', language: 'Language',
    timezone: 'Time zone', status: 'Status', joined: 'Registration date', loading: 'Loading accounts...',
    noName: 'No display name', arabic: 'Arabic', english: 'English', empty: 'No accounts yet',
    emptyDesc: 'Real parent accounts will appear here as soon as they register; the dashboard does not show placeholder users.',
  },
}

export function ParentsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [records, setRecords] = useState<ParentRecord[]>([])
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { const response = await api.parents({ q: query, plan, limit: 100 }); setRecords(response.data) }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setLoading(false) }
  }, [plan, query, text.loadError])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer) }, [load])

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.account}</span><h2>{text.title}</h2><p>{text.intro}</p></div><button className="button button--secondary" type="button" onClick={() => void load()}><Icon name="refresh" size={17}/>{text.refresh}</button></section>
      <section className="panel panel--table"><header className="panel__header panel__header--filters"><div><span className="panel__kicker">{text.directory}</span><h3>{text.title} <span className="title-count">{formatNumber(records.length, locale)}</span></h3></div><div className="filters-row"><label className="search-field"><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search}/></label><select value={plan} onChange={(event) => setPlan(event.target.value)}><option value="">{text.allPlans}</option><option value="free">{planLabels[locale].free}</option><option value="family">{planLabels[locale].family}</option><option value="family_plus">{planLabels[locale].family_plus}</option></select></div></header>
        {loading && !records.length ? <LoadingState label={text.loading}/> : error && !records.length ? <ErrorState message={error} onRetry={() => void load()}/> : records.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>{text.parent}</th><th>{text.plan}</th><th>{text.children}</th><th>{text.language}</th><th>{text.timezone}</th><th>{text.status}</th><th>{text.joined}</th></tr></thead><tbody>{records.map((parent) => <tr key={parent.id}><td><div className="entity-cell"><span className="entity-avatar entity-avatar--parent">{(parent.display_name || parent.email || (locale === 'ar' ? 'و' : 'P')).charAt(0)}</span><div><strong>{parent.display_name || text.noName}</strong><small>{parent.email || parent.id}</small></div></div></td><td><span className={`plan-badge plan-badge--${parent.plan}`}>{planLabels[locale][parent.plan]}</span></td><td>{formatNumber(Number(parent.children_count), locale)}</td><td>{parent.locale === 'ar' ? text.arabic : parent.locale === 'en' ? text.english : parent.locale}</td><td>{parent.timezone}</td><td><span className={`account-status account-status--${parent.status}`}>{accountStatusLabels[locale][parent.status]}</span></td><td>{formatDate(parent.created_at, locale)}</td></tr>)}</tbody></table></div> : <EmptyState title={text.empty} description={text.emptyDesc}/>} 
      </section>
    </div>
  )
}
