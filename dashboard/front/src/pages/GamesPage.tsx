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
import type { GameEngineRecord, GameRecord, ContentStatus } from '../types/api'

const copy = {
  ar: { eyebrow:'مكتبة المحتوى / الألعاب', title:'الألعاب', intro:'مجموعة الألعاب المخصصة: محرك، مستويات، هدف، أصول وتشغيل وجاهزية نشر.', create:'لعبة جديدة', search:'بحث...', engine:'المحرك', status:'الحالة', total:'لعبة', ready:'قابلة للتشغيل', blocked:'معطلة', review:'مراجعة', open:'مساحة العمل', colGame:'اللعبة', colEngine:'المحرك', colLevels:'المستويات', colObjective:'الهدف', colRuntime:'التشغيل', colStatus:'الحالة', empty:'لا ألعاب', noMatch:'لا نتيجة', clear:'مسح', loading:'جارٍ...', all:'الكل' },
  en: { eyebrow:'Content library / Games', title:'Games', intro:'Dedicated games collection: engine, levels, objective, assets, runtime and publish readiness.', create:'New game', search:'Search...', engine:'Engine', status:'Status', total:'games', ready:'Playable', blocked:'Blocked', review:'Review', open:'Workspace', colGame:'Game', colEngine:'Engine', colLevels:'Levels', colObjective:'Objective', colRuntime:'Runtime', colStatus:'Status', empty:'No games', noMatch:'No match', clear:'Clear', loading:'Loading...', all:'All' },
}
const DEFAULT_FILTERS = { engine: '', status: '' }
const COLUMNS: ColumnDefinition[] = [
  { key:'game', label:'colGame', locked:true },
  { key:'engine', label:'colEngine' },
  { key:'levels', label:'colLevels' },
  { key:'objective', label:'colObjective' },
  { key:'runtime', label:'colRuntime' },
  { key:'status', label:'colStatus' },
]

function GameCover({ assetId }: { assetId?: string | null }) {
  const [url,setUrl]=useState('')
  useEffect(()=>{ if(!assetId) return; let live=true; let obj=''; void api.assetBlob(assetId).then((b)=>{ if(!live) return; obj=URL.createObjectURL(b); setUrl(obj)}).catch(()=>{}); return()=>{live=false; if(obj) URL.revokeObjectURL(obj)}},[assetId])
  return <div className="entity-thumb">{url ? <img src={url} alt="" /> : <span className="entity-thumb__letter"><Icon name="games" size={18} /></span>}</div>
}

export function GamesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { defaultView:'table' })
  const columns = useColumnPreferences('games-coll', COLUMNS)
  const [storedView,setStoredView]=useStoredViewMode('games-coll','table')
  const view: ViewMode = list.rawView==='grid'||list.rawView==='table'? list.rawView : storedView==='grid'?'grid':'table'
  const setView = (m:ViewMode)=>{ setStoredView(m); list.setView(m)}
  const [rows,setRows]=useState<GameRecord[]>([])
  const [engines,setEngines]=useState<GameEngineRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const canCreate = hasPermission('create')
  const load = useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const res = await api.games({ q: list.query||undefined, status: list.filters.status as any||undefined })
      let data = res.data as GameRecord[]
      if(list.filters.engine) data = data.filter((r)=> r.engine_id===list.filters.engine)
      setRows(data)
    }catch(e){ setError(e instanceof Error?e.message:'error')} finally{ setLoading(false)}
  },[list.query, list.filters.status, list.filters.engine])
  useEffect(()=>{ const t=setTimeout(()=>void load(),180); return()=>clearTimeout(t)},[load])
  useEffect(()=>{ void api.gameEngines().then((r)=> setEngines(r.data)).catch(()=>{})},[])
  const summary = useMemo(()=> ({ total: rows.length, ready: rows.filter((r)=> r.status==='ready'||r.status==='published').length, blocked: rows.filter((r)=> r.status==='production'||r.status==='qa').length }),[rows])
  const fields: FilterField[] = [
    { key:'engine', label: text.engine, type:'select', options:[{ value:'', label:text.all }, ...engines.map((e)=>({ value:e.id, label:e.name_ar }))] },
    { key:'status', label: text.status, type:'select', options:[{ value:'', label:text.all }, ...(['draft','ready','published','production','qa'] as ContentStatus[]).map((s)=>({ value:s, label:s }))] },
  ]
  const table = (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table data-table--wide">
        <thead><tr><th>{text.colGame}</th>{columns.isVisible('engine')&&<th>{text.colEngine}</th>}{columns.isVisible('levels')&&<th>{text.colLevels}</th>}{columns.isVisible('objective')&&<th>{text.colObjective}</th>}{columns.isVisible('runtime')&&<th>{text.colRuntime}</th>}{columns.isVisible('status')&&<th>{text.colStatus}</th>}<th /></tr></thead>
        <tbody>{rows.map((row)=> (
          <tr key={row.id}>
            <td><Link className="entity-cell entity-cell--button" to={adminPath(`games/${row.id}`)}><GameCover assetId={(row as any).cover_asset_id} /><div><strong>{row.title_ar}</strong><small>{row.age_min}–{row.age_max}</small></div></Link></td>
            {columns.isVisible('engine')&&<td dir="ltr">{(row as any).engine_name || row.engine_id}</td>}
            {columns.isVisible('levels')&&<td>{(row.content_pack as any)?.levels?.length ?? 0}</td>}
            {columns.isVisible('objective')&&<td>{(row as any).learning_objective_title || '—'}</td>}
            {columns.isVisible('runtime')&&<td>{row.engine_id ? '✓' : '✕'}</td>}
            {columns.isVisible('status')&&<td><StatusBadge status={row.status as any} /></td>}
            <td><Link className="button button--ghost button--small" to={adminPath(`games/${row.id}`)}>{text.open}</Link></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
  const cards = (
    <div className="story-grid" role="list">{rows.map((row)=> (
      <article key={row.id} className="story-card" role="listitem">
        <div className="story-card__media"><GameCover assetId={(row as any).cover_asset_id} /></div>
        <div className="story-card__body"><h3><Link className="story-card__link" to={adminPath(`games/${row.id}`)}>{row.title_ar}</Link></h3><p className="story-card__where">{(row as any).engine_name || row.engine_id} · {row.difficulty}</p></div>
        <footer className="story-card__foot"><StatusBadge status={row.status as any} /><span>{(row.content_pack as any)?.levels?.length ?? 0} lvl</span></footer>
      </article>
    ))}</div>
  )
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.intro}</p></div><div className="page-intro__actions"><button className="button button--primary" disabled={!canCreate} onClick={()=> navigate(adminPath('games/new'))}><Icon name="plus" size={16} />{text.create}</button></div></section>
      <section className="planet-summary"><div className="planet-summary__cell"><strong>{formatNumber(summary.total, locale)}</strong><span>{text.total}</span></div><div className="planet-summary__cell"><strong>{formatNumber(summary.ready, locale)}</strong><span>{text.ready}</span></div><div className="planet-summary__cell"><strong>{formatNumber(summary.blocked, locale)}</strong><span>{text.blocked}</span></div></section>
      <section className="panel panel--table">
        <header className="panel__header panel__header--filters"><div><span className="panel__kicker">{text.title}</span><h3>{formatNumber(rows.length, locale)}</h3></div>
          <ListToolbar searchValue={list.query} onSearchChange={list.setQuery} searchPlaceholder={text.search} fields={fields} values={list.filters} defaults={DEFAULT_FILTERS} onApply={(n)=>list.setFilters(n)} onClear={list.clearFilters} onRemove={(k)=>list.setFilter(k as any,'')} trailing={<><SavedViewsMenu storageKey="games-coll" currentSearch={list.search} onApply={(s)=> navigate(`${adminPath('games')}${s}`)} />{view==='table' && <ColumnManager columns={COLUMNS.map((c)=>({ ...c, label:(text as any)[c.label]||c.label }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} />}<ViewSwitcher value={view} onChange={setView} modes={['table','grid']} locale={locale} /></>} />
        </header>
        {loading ? <p className="planet-loading">{text.loading}</p> : error ? <ErrorState message={error} onRetry={()=>void load()} /> : rows.length===0 ? <EmptyState title={list.query||list.activeFilterCount? text.noMatch: text.empty} description="" action={list.activeFilterCount? <button className="button button--ghost" onClick={()=>{list.clearFilters(); list.setQuery('')}}>{text.clear}</button>: undefined} /> : view==='grid'? cards: table}
      </section>
    </div>
  )
}
