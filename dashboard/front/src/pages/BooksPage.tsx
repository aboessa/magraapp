import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { ViewSwitcher, useStoredViewMode } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { EmptyState, ErrorState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber, formatDate } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import { useUrlListState } from '../hooks/useUrlListState'
import type { BookRecord, ContentStatus, SeriesRecord, StoryType } from '../types/api'

const statuses: ContentStatus[] = ['draft','writing','review_edu','review_lang','review_sharia','production','qa','ready','scheduled','published','archived']
const types: StoryType[] = ['picture_book','audio_story','interactive','comic']
const typeLabels = {
  ar: { picture_book: 'كتاب مصور', audio_story: 'كتاب صوتي', interactive: 'تفاعلي', comic: 'كوميكس' },
  en: { picture_book: 'Picture book', audio_story: 'Audio book', interactive: 'Interactive', comic: 'Comic' },
}

const copy = {
  ar: {
    eyebrow: 'مكتبة المحتوى / الكتب',
    title: 'الكتب',
    intro: 'مجموعة الكتب المخصصة: غلاف حقيقي، نوع، صفحات، لغات، سرد وجاهزية تشغيل.',
    create: 'كتاب جديد',
    total: 'كتاب', ready: 'جاهز', review: 'مراجعة', missingPages: 'ناقصة صفحات', missingCover: 'بلا غلاف',
    search: 'بحث بالعنوان...', type: 'النوع', status: 'الحالة', series: 'السلسلة',
    all: 'الكل', colCover: 'الغلاف', colBook: 'الكتاب', colSeries: 'السلسلة', colType: 'النوع', colPages: 'الصفحات', colLang: 'اللغات', colReadiness: 'الجاهزية', colStatus: 'الحالة', colUpdated: 'آخر تعديل',
    open: 'مساحة العمل', edit: 'تعديل', archive: 'أرشفة',
    denied: 'لا صلاحية', empty: 'لا كتب', noMatch: 'لا نتيجة', clear: 'مسح الفلاتر',
    loading: 'جارٍ التحميل...', loadError: 'تعذر التحميل',
    noCover: 'بلا غلاف', pagesEmpty: 'بلا صفحات', createDenied: 'الإنشاء يحتاج صلاحية',
  },
  en: {
    eyebrow: 'Content library / Books',
    title: 'Books',
    intro: 'Dedicated books collection: real cover, type, pages, languages, narration and readiness.',
    create: 'New book',
    total: 'books', ready: 'Ready', review: 'In review', missingPages: 'Missing pages', missingCover: 'No cover',
    search: 'Search by title...', type: 'Type', status: 'Status', series: 'Series',
    all: 'All', colCover: 'Cover', colBook: 'Book', colSeries: 'Series', colType: 'Type', colPages: 'Pages', colLang: 'Languages', colReadiness: 'Readiness', colStatus: 'Status', colUpdated: 'Updated',
    open: 'Workspace', edit: 'Edit', archive: 'Archive',
    denied: 'No permission', empty: 'No books', noMatch: 'No match', clear: 'Clear filters',
    loading: 'Loading...', loadError: 'Unable to load',
    noCover: 'No cover', pagesEmpty: 'No pages', createDenied: 'Create needs permission',
  },
}

const DEFAULT_FILTERS = { type: '', status: '', series_id: '' }
const COLUMNS: ColumnDefinition[] = [
  { key: 'book', label: 'colBook', locked: true },
  { key: 'series', label: 'colSeries' },
  { key: 'type', label: 'colType' },
  { key: 'pages', label: 'colPages' },
  { key: 'lang', label: 'colLang' },
  { key: 'readiness', label: 'colReadiness' },
  { key: 'status', label: 'colStatus' },
  { key: 'updated', label: 'colUpdated' },
]

function BookCover({ assetId }: { assetId?: string | null; title: string }) {
  const [url, setUrl] = useState<string>('')
  useEffect(() => {
    if (!assetId) return
    let live = true
    let obj = ''
    void api.assetBlob(assetId).then((b) => { if (!live) return; obj = URL.createObjectURL(b); setUrl(obj) }).catch(() => {})
    return () => { live = false; if (obj) URL.revokeObjectURL(obj) }
  }, [assetId])
  return <div className="entity-thumb" style={{ width: 44, height: 44 }}>{url ? <img src={url} alt="" /> : <span className="entity-thumb__letter"><Icon name="books" size={18} /></span>}</div>
}

export function BooksPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { defaultView: 'table' })
  const columns = useColumnPreferences('books', COLUMNS)
  const [storedView, setStoredView] = useStoredViewMode('books','table')
  const view: ViewMode = list.rawView === 'grid' || list.rawView === 'table' ? list.rawView : storedView === 'grid' ? 'grid':'table'
  const setView = (m: ViewMode) => { setStoredView(m); list.setView(m) }
  const [rows, setRows] = useState<BookRecord[]>([])
  const [series, setSeries] = useState<SeriesRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canCreate = hasPermission('create')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.books({ q: list.query || undefined, status: list.filters.status as any || undefined })
      let data = res.data as BookRecord[]
      if (list.filters.type) data = data.filter((r) => r.type === list.filters.type)
      if (list.filters.series_id) data = data.filter((r) => r.series_id === list.filters.series_id)
      if (list.query) {
        const q = list.query.toLowerCase()
        data = data.filter((r) => r.title_ar.toLowerCase().includes(q) || (r.series_title||'').toLowerCase().includes(q))
      }
      setRows(data)
    } catch (e) { setError(e instanceof Error ? e.message : text.loadError) } finally { setLoading(false) }
  }, [list.query, list.filters.type, list.filters.status, list.filters.series_id, text.loadError])
  useEffect(() => { const t = setTimeout(() => void load(), 180); return () => clearTimeout(t) }, [load])
  useEffect(() => { void api.series({ status: 'all', limit: 100 }).then((r) => setSeries(r.data.filter((x)=> x.status!=='archived'))).catch(()=>{}) }, [])
  const summary = useMemo(() => {
    const total = rows.length
    const ready = rows.filter((r)=> r.status==='ready'||r.status==='published').length
    const review = rows.filter((r)=> String(r.status).startsWith('review')).length
    const missingPages = rows.filter((r)=> !r.pages || (Array.isArray(r.pages)&&r.pages.length===0)).length
    const missingCover = rows.filter((r)=> !r.cover_asset_id).length
    return { total, ready, review, missingPages, missingCover }
  }, [rows])
  const fields: FilterField[] = [
    { key: 'type', label: text.type, type: 'select', options: [{ value:'', label: text.all }, ...types.map((t)=>({ value:t, label: (typeLabels as any)[locale][t] }))] },
    { key: 'status', label: text.status, type: 'select', options: [{ value:'', label: text.all }, ...statuses.map((s)=>({ value:s, label:s }))] },
    { key: 'series_id', label: text.series, type: 'select', advanced: true, options: [{ value:'', label: text.all }, ...series.map((s)=>({ value:s.id, label:s.title_ar }))]},
  ]
  if (error && !loading) {}
  const table = (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table data-table--wide">
        <thead><tr>
          <th>{text.colBook}</th>
          {columns.isVisible('series') && <th>{text.colSeries}</th>}
          {columns.isVisible('type') && <th>{text.colType}</th>}
          {columns.isVisible('pages') && <th>{text.colPages}</th>}
          {columns.isVisible('status') && <th>{text.colStatus}</th>}
          {columns.isVisible('updated') && <th>{text.colUpdated}</th>}
          <th />
        </tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            <td><Link className="entity-cell entity-cell--button" to={adminPath(`books/${row.id}`)}><BookCover assetId={(row as any).cover_asset_id} title={row.title_ar} /><div><strong>{row.title_ar}</strong><small>{row.age_min}–{row.age_max}</small></div></Link></td>
            {columns.isVisible('series') && <td>{row.series_title || '—'}</td>}
            {columns.isVisible('type') && <td>{(typeLabels as any)[locale][row.type] ?? row.type}</td>}
            {columns.isVisible('pages') && <td>{Array.isArray(row.pages) ? row.pages.length : 0}</td>}
            {columns.isVisible('status') && <td><StatusBadge status={row.status as any} /></td>}
            {columns.isVisible('updated') && <td dir="ltr">{(row as any).updated_at ? formatDate(String((row as any).updated_at).replace(' ','T')+'Z', locale) : '—'}</td>}
            <td><Link className="button button--ghost button--small" to={adminPath(`books/${row.id}`)}>{text.open}</Link></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
  const cards = (
    <div className="story-grid" role="list">
      {rows.map((row) => (
        <article key={row.id} className="story-card" role="listitem">
          <div className="story-card__media"><BookCover assetId={(row as any).cover_asset_id} title={row.title_ar} /></div>
          <div className="story-card__body"><h3><Link className="story-card__link" to={adminPath(`books/${row.id}`)}>{row.title_ar}</Link></h3><p className="story-card__where">{row.series_title || '—'} · {(typeLabels as any)[locale][row.type]}</p></div>
          <footer className="story-card__foot"><StatusBadge status={row.status as any} /></footer>
        </article>
      ))}
    </div>
  )
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.intro}</p></div><div className="page-intro__actions"><button className="button button--primary" disabled={!canCreate} title={!canCreate?text.createDenied:undefined} onClick={()=> navigate(adminPath('books/new'))}><Icon name="plus" size={16} />{text.create}</button></div></section>
      <section className="planet-summary" aria-label={text.title}>
        <div className="planet-summary__cell"><strong>{formatNumber(summary.total, locale)}</strong><span>{text.total}</span></div>
        <button type="button" className="planet-summary__cell planet-summary__cell--button" onClick={()=> list.setFilter('status','ready')}><strong>{formatNumber(summary.ready, locale)}</strong><span>{text.ready}</span></button>
        <div className="planet-summary__cell"><strong>{formatNumber(summary.missingPages, locale)}</strong><span>{text.missingPages}</span></div>
        <div className="planet-summary__cell"><strong>{formatNumber(summary.missingCover, locale)}</strong><span>{text.missingCover}</span></div>
      </section>
      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><span className="panel__kicker">{text.title}</span><h3>{formatNumber(rows.length, locale)}</h3></div>
          <ListToolbar searchValue={list.query} onSearchChange={list.setQuery} searchPlaceholder={text.search} fields={fields} values={list.filters} defaults={DEFAULT_FILTERS} onApply={(n)=>list.setFilters(n)} onClear={list.clearFilters} onRemove={(k)=>list.setFilter(k as any,'')} trailing={<><SavedViewsMenu storageKey="books" currentSearch={list.search} onApply={(s)=> navigate(`${adminPath('books')}${s}`)} />{view==='table' && <ColumnManager columns={COLUMNS.map((c)=>({ ...c, label: (text as any)[c.label]||c.label }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} />}<ViewSwitcher value={view} onChange={setView} modes={['table','grid']} locale={locale} /></>} />
        </header>
        {loading ? <p className="planet-loading">{text.loading}</p> : error ? <ErrorState message={error} onRetry={()=>void load()} /> : rows.length===0 ? <EmptyState title={list.query||list.activeFilterCount? text.noMatch: text.empty} description="" action={list.activeFilterCount? <button className="button button--ghost" onClick={()=>{list.clearFilters(); list.setQuery('')}}>{text.clear}</button>: undefined} /> : view==='grid'? cards: table}
      </section>
    </div>
  )
}
