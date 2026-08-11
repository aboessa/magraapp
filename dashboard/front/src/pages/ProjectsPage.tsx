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
import { formatNumber } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import { useUrlListState } from '../hooks/useUrlListState'
import type { ContentStatus, ProjectRecord } from '../types/api'

const copy = {
  ar: { eyebrow:'مكتبة المحتوى / المشروعات', title:'المشروعات / الأنشطة', intro:'مجموعة المشروعات: تجربة تعليمية عملية بخطوات ومواد وسلامة وتعلم.', create:'مشروع جديد', search:'بحث...', status:'الحالة', supervision:'الإشراف', total:'مشروع', ready:'جاهزة', review:'مراجعة', safety:'بانتظار سلامة', open:'مساحة العمل', colProject:'المشروع', colAge:'العمر', colDuration:'المدة', colSupervision:'الإشراف', colSteps:'الخطوات', colStatus:'الحالة', empty:'لا مشروعات', noMatch:'لا نتيجة', clear:'مسح', loading:'جارٍ...', all:'الكل' },
  en: { eyebrow:'Content library / Projects', title:'Projects / Activities', intro:'Dedicated projects: hands-on instructional experience with steps, materials, safety and learning.', create:'New project', search:'Search...', status:'Status', supervision:'Supervision', total:'projects', ready:'Ready', review:'Review', safety:'Safety pending', open:'Workspace', colProject:'Project', colAge:'Age', colDuration:'Duration', colSupervision:'Supervision', colSteps:'Steps', colStatus:'Status', empty:'No projects', noMatch:'No match', clear:'Clear', loading:'Loading...', all:'All' },
}
const DEFAULT_FILTERS = { status:'', supervision:'' }
const COLUMNS: ColumnDefinition[] = [
  { key:'project', label:'colProject', locked:true },
  { key:'age', label:'colAge' },
  { key:'duration', label:'colDuration' },
  { key:'supervision', label:'colSupervision' },
  { key:'steps', label:'colSteps' },
  { key:'status', label:'colStatus' },
]

function ProjectCover({ coverUrl }: { coverUrl?: string | null; title: string }) {
  return <div className="entity-thumb">{coverUrl ? <img src={coverUrl} alt="" /> : <span className="entity-thumb__letter"><Icon name="objectives" size={18} /></span>}</div>
}

export function ProjectsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { defaultView:'table' })
  const columns = useColumnPreferences('projects-coll', COLUMNS)
  const [storedView,setStoredView]=useStoredViewMode('projects-coll','table')
  const view: ViewMode = list.rawView==='grid'||list.rawView==='table'? list.rawView : storedView==='grid'?'grid':'table'
  const setView = (m:ViewMode)=>{ setStoredView(m); list.setView(m)}
  const [rows,setRows]=useState<ProjectRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const canCreate = hasPermission('create')
  const load = useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const res = await api.projects({ q: list.query||undefined, status: list.filters.status as any||undefined })
      let data = res.data as ProjectRecord[]
      if(list.filters.supervision) data = data.filter((r)=> r.supervision_level===list.filters.supervision)
      setRows(data)
    }catch(e){ setError(e instanceof Error?e.message:'error')} finally{ setLoading(false)}
  },[list.query, list.filters.status, list.filters.supervision])
  useEffect(()=>{ const t=setTimeout(()=>void load(),180); return()=>clearTimeout(t)},[load])
  const summary = useMemo(()=> ({ total: rows.length, ready: rows.filter((r)=> r.status==='ready'||r.status==='published').length, safety: rows.filter((r)=> r.supervision_level==='required' && !r.safety_notes).length }),[rows])
  const fields: FilterField[] = [
    { key:'status', label:text.status, type:'select', options:[{ value:'', label:text.all }, ...(['draft','ready','published'] as ContentStatus[]).map((s)=>({ value:s, label:s }))] },
    { key:'supervision', label:text.supervision, type:'select', options:[{ value:'', label:text.all }, { value:'none', label:'none' }, { value:'recommended', label:'recommended' }, { value:'required', label:'required' }], advanced:true },
  ]
  const table = (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table data-table--wide">
        <thead><tr><th>{text.colProject}</th>{columns.isVisible('age')&&<th>{text.colAge}</th>}{columns.isVisible('duration')&&<th>{text.colDuration}</th>}{columns.isVisible('supervision')&&<th>{text.colSupervision}</th>}{columns.isVisible('steps')&&<th>{text.colSteps}</th>}{columns.isVisible('status')&&<th>{text.colStatus}</th>}<th /></tr></thead>
        <tbody>{rows.map((row)=> (
          <tr key={row.id}>
            <td><Link className="entity-cell entity-cell--button" to={adminPath(`projects/${row.id}`)}><ProjectCover coverUrl={(row as any).cover_url} title={row.title_ar} /><div><strong>{row.title_ar}</strong><small>{row.description_ar?.slice(0,40) || '—'}</small></div></Link></td>
            {columns.isVisible('age')&&<td>{row.age_min}–{row.age_max}</td>}
            {columns.isVisible('duration')&&<td>{(row as any).estimated_minutes ? `${(row as any).estimated_minutes} min` : '—'}</td>}
            {columns.isVisible('supervision')&&<td>{row.supervision_level}</td>}
            {columns.isVisible('steps')&&<td>{row.steps.length}</td>}
            {columns.isVisible('status')&&<td><StatusBadge status={row.status as any} /></td>}
            <td><Link className="button button--ghost button--small" to={adminPath(`projects/${row.id}`)}>{text.open}</Link></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
  const cards = (
    <div className="story-grid" role="list">{rows.map((row)=> (
      <article key={row.id} className="story-card" role="listitem">
        <div className="story-card__media"><ProjectCover coverUrl={(row as any).cover_url} title={row.title_ar} /></div>
        <div className="story-card__body"><h3><Link className="story-card__link" to={adminPath(`projects/${row.id}`)}>{row.title_ar}</Link></h3><p className="story-card__where">{row.age_min}–{row.age_max} · {row.supervision_level} · {row.steps.length} steps</p></div>
        <footer className="story-card__foot"><StatusBadge status={row.status as any} /></footer>
      </article>
    ))}</div>
  )
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.intro}</p></div><div className="page-intro__actions"><button className="button button--primary" disabled={!canCreate} onClick={()=> navigate(adminPath('projects/new'))}><Icon name="plus" size={16} />{text.create}</button></div></section>
      <section className="planet-summary"><div className="planet-summary__cell"><strong>{formatNumber(summary.total, locale)}</strong><span>{text.total}</span></div><div className="planet-summary__cell"><strong>{formatNumber(summary.ready, locale)}</strong><span>{text.ready}</span></div><div className="planet-summary__cell"><strong>{formatNumber(summary.safety, locale)}</strong><span>{text.safety}</span></div></section>
      <section className="panel panel--table">
        <header className="panel__header panel__header--filters"><div><span className="panel__kicker">{text.title}</span><h3>{formatNumber(rows.length, locale)}</h3></div>
          <ListToolbar searchValue={list.query} onSearchChange={list.setQuery} searchPlaceholder={text.search} fields={fields} values={list.filters} defaults={DEFAULT_FILTERS} onApply={(n)=>list.setFilters(n)} onClear={list.clearFilters} onRemove={(k)=>list.setFilter(k as any,'')} trailing={<><SavedViewsMenu storageKey="projects-coll" currentSearch={list.search} onApply={(s)=> navigate(`${adminPath('projects')}${s}`)} />{view==='table' && <ColumnManager columns={COLUMNS.map((c)=>({ ...c, label:(text as any)[c.label]||c.label }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} />}<ViewSwitcher value={view} onChange={setView} modes={['table','grid']} locale={locale} /></>} />
        </header>
        {loading ? <p className="planet-loading">{text.loading}</p> : error ? <ErrorState message={error} onRetry={()=>void load()} /> : rows.length===0 ? <EmptyState title={list.query||list.activeFilterCount? text.noMatch: text.empty} description="" action={list.activeFilterCount? <button className="button button--ghost" onClick={()=>{list.clearFilters(); list.setQuery('')}}>{text.clear}</button>: undefined} /> : view==='grid'? cards: table}
      </section>
    </div>
  )
}
