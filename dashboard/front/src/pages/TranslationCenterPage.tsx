// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu, useColumnPreferences, ColumnManager } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'

const STATUSES=['pending','in_translation','ready_for_review','changes_requested','approved','stale']
const LANGUAGES=['ar','en','fr']
const ENTITIES=['story_page','story','game','question','planet','series','episode','book']

const copy={
  ar:{
    eyebrow:'الترجمة', title:'مركز الترجمة', lede:'من إصدار المصدر إلى ترجمة مراجعة معتمدة — ذاكرة ترجمة ومسرد يحمي المصطلحات',
    add:'ترجمة جديدة', refresh:'تحديث',
    pending:'قيد الانتظار', inProgress:'قيد الترجمة', readyForReview:'جاهز للمراجعة', changes:'يطلب تعديل', approved:'معتمد', stale:'قديم', missing:'مفقود', overdue:'متأخر',
    content:'المحتوى', entityType:'نوع الكيان', field:'الحقل', sourceLang:'لغة المصدر', targetLang:'لغة الهدف', sourcePreview:'معاينة المصدر', translationStatus:'حالة الترجمة', translator:'المترجم', reviewer:'المراجع', due:'الاستحقاق', sourceVersion:'إصدار المصدر', actions:'', noQueue:'لا عناصر مطابقة', noQueueHint:'غيّر الفلاتر أو اختر لغة هدف',
    storyContext:'سياق القصة', gameContext:'سياق اللعبة', glossary:'المسرد', memory:'ذاكرة الترجمة', reauthor:'يتطلب إعادة تأليف',
    byLang:'حسب اللغة', total:'الإجمالي',
    search:'بحث...', allEntities:'كل الأنواع', allStatuses:'كل الحالات', allLangs:'كل اللغات',
    glossaryTitle:'المسرد/المصطلحات', glossaryAdd:'مصطلح جديد', term:'المصطلح', translations:'الترجمات', scope:'النطاق', category:'الفئة',
    tmTitle:'ذاكرة الترجمة', staleTitle:'ترجمات قديمة',
  },
  en:{
    eyebrow:'Localization', title:'Translation Center', lede:'From source version to approved localization — with translation memory and glossary',
    add:'New translation', refresh:'Refresh',
    pending:'Pending', inProgress:'In translation', readyForReview:'Ready for review', changes:'Changes requested', approved:'Approved', stale:'Stale', missing:'Missing', overdue:'Overdue',
    content:'Content', entityType:'Entity type', field:'Field', sourceLang:'Source', targetLang:'Target', sourcePreview:'Source preview', translationStatus:'Status', translator:'Translator', reviewer:'Reviewer', due:'Due', sourceVersion:'Source version', actions:'', noQueue:'No matching items', noQueueHint:'Change filters or pick target language',
    storyContext:'Story context', gameContext:'Game context', glossary:'Glossary', memory:'Translation Memory', reauthor:'Re-author required',
    byLang:'By language', total:'Total',
    search:'Search...', allEntities:'All types', allStatuses:'All statuses', allLangs:'All languages',
    glossaryTitle:'Glossary', glossaryAdd:'Add term', term:'Term', translations:'Translations', scope:'Scope', category:'Category',
    tmTitle:'Translation Memory', staleTitle:'Stale translations',
  }
}

const COLUMNS: ColumnDefinition[]=[
  { key:'content', label:'content', locked:true },
  { key:'entityType', label:'entityType' },
  { key:'field', label:'field' },
  { key:'sourceLang', label:'sourceLang' },
  { key:'targetLang', label:'targetLang' },
  { key:'sourcePreview', label:'sourcePreview' },
  { key:'translationStatus', label:'translationStatus' },
  { key:'translator', label:'translator' },
]

export function TranslationCenterPage(){
  const { locale }=usePreferences()
  const text=copy[locale] as any
  const navigate=useNavigate()
  const list=useUrlListState({ entity_type:'', target_language:'', status:'', stale:'' } as any, { limit:25 })
  const { query, filters, offset, limit }=list
  const [queue,setQueue]=useState<any[]>([])
  const [total,setTotal]=useState(0)
  const [summary,setSummary]=useState<any>(null)
  const [glossary,setGlossary]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [tab,setTab]=useState<'queue'|'glossary'|'memory'|'stale'>('queue')
  const columns=useColumnPreferences('translation', COLUMNS)

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const [qRes, gRes]=await Promise.all([
        api.translationQueue({ q: query, ...filters, limit, offset } as any),
        api.glossary({ limit:20 } as any),
      ])
      setQueue((qRes as any).data); setTotal((qRes as any).meta?.total ?? (qRes as any).data.length); setSummary((qRes as any).meta?.summary)
      setGlossary((gRes as any).data)
    }catch(e){ setError(e instanceof Error? e.message:'خطأ')} finally{ setLoading(false)}
  },[query, filters, limit, offset])

  useEffect(()=>{ const t=setTimeout(()=> void load(),220); return ()=> clearTimeout(t)},[load])

  const filterFields: FilterField[]=[
    { key:'entity_type', label:text.entityType, type:'select', options:[{value:'',label:text.allEntities}, ...ENTITIES.map(v=>({value:v,label:v}))] },
    { key:'target_language', label:text.targetLang, type:'select', options:[{value:'',label:text.allLangs}, ...LANGUAGES.map(v=>({value:v,label:v}))] },
    { key:'status', label:text.translationStatus, type:'select', options:[{value:'',label:text.allStatuses}, ...STATUSES.map(v=>({value:v,label:v}))] },
  ]

  if(loading && !queue.length) return <LoadingState />
  if(error && !queue.length) return <ErrorState message={error} onRetry={()=> void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div><button className="button button--secondary" onClick={()=> void load()}><Icon name="refresh" size={17}/>{text.refresh}</button></section>

      <section className="prod-command" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div className="prod-metric"><strong>{summary?.pending ?? queue.filter(q=>q.status==='pending').length}</strong><span>{text.pending}</span></div>
        <div className="prod-metric"><strong>{summary?.ready_for_review ?? queue.filter(q=>q.status==='ready_for_review').length}</strong><span>{text.readyForReview}</span></div>
        <div className="prod-metric"><strong>{summary?.changes_requested ?? 0}</strong><span>{text.changes}</span></div>
        <div className="prod-metric prod-metric--complete"><strong>{summary?.approved ?? queue.filter(q=>q.status==='approved').length}</strong><span>{text.approved}</span></div>
        <div className="prod-metric prod-metric--blocked"><strong>{summary?.stale ?? queue.filter(q=>q.status==='stale').length}</strong><span>{text.stale}</span></div>
        <div className="prod-metric"><strong>{summary?.en_approved ?? 0} / {summary?.en_total ?? 0}</strong><span>EN</span></div>
        <div className="prod-metric"><strong>{summary?.fr_approved ?? 0} / {summary?.fr_total ?? 0}</strong><span>FR</span></div>
      </section>

      <div className="library-tabs" style={{ display:'flex', gap:6 }}>
        {(['queue','glossary','memory','stale'] as const).map(t=> <button key={t} className={`library-tab ${tab===t?'library-tab--active':''}`} onClick={()=> setTab(t)}>{t==='queue'? text.content: t==='glossary'? text.glossary: t==='memory'? text.memory: text.staleTitle}</button>)}
      </div>

      {tab==='queue' && (
        <section className="panel panel--table">
          <header className="panel__header panel__header--filters">
            <div><h3>{text.content} <span className="title-count">{formatNumber(total, locale as any)}</span></h3></div>
            <ListToolbar
              searchValue={query}
              onSearchChange={list.setQuery}
              searchPlaceholder={text.search}
              fields={filterFields}
              values={filters as any}
              defaults={{ entity_type:'', target_language:'', status:'', stale:'' } as any}
              onApply={next=> list.setFilters(next as any)}
              onClear={list.clearFilters}
              onRemove={k=> list.setFilter(k as any,'')}
              trailing={<><SavedViewsMenu storageKey="translation" currentSearch={list.search} onApply={s=> navigate(`${adminPath('translation')}${s}`)} /><ColumnManager columns={COLUMNS.map(c=> ({...c, label: (text as any)[c.label] ?? c.label }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} /></>}
            />
          </header>

          {queue.length? (
            <>
              <div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr>
                <th>{text.content}</th>{columns.isVisible('entityType')&&<th>{text.entityType}</th>}{columns.isVisible('field')&&<th>{text.field}</th>}<th>{text.sourceLang}</th><th>{text.targetLang}</th>{columns.isVisible('sourcePreview')&&<th>{text.sourcePreview}</th>}{columns.isVisible('translationStatus')&&<th>{text.translationStatus}</th>}<th></th>
              </tr></thead><tbody>
                {queue.map(row=>(
                  <tr key={row.id}>
                    <td><Link to={adminPath(`translation/${row.id}`)} style={{ textDecoration:'none' }}><strong>{row.context_title ?? row.entity_id.slice(0,12)}</strong><br/><small className="table-secondary">{row.entity_type} · ص {row.page_number ?? row.field}</small>{row.is_reauthor? <><br/><span className="prod-chip prod-chip--blocked">{text.reauthor}</span></>: null}</Link></td>
                    {columns.isVisible('entityType')&&<td>{row.entity_type}</td>}
                    {columns.isVisible('field')&&<td>{row.field}</td>}
                    <td>AR</td>
                    <td>{row.target_language?.toUpperCase()}</td>
                    {columns.isVisible('sourcePreview')&&<td><span style={{ display:'block', maxWidth:260, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{row.source_text?.slice(0,80) ?? '—'}</span></td>}
                    {columns.isVisible('translationStatus')&&<td><span className={`status-badge ${row.status==='approved'?'status-badge--published': row.status==='stale'?'status-badge--review':''}`}>{row.status}</span>{row.stale&& <span className="prod-chip prod-chip--blocked" style={{ marginInlineStart:6 }}>{text.stale}</span>}</td>}
                    <td><Link className="button button--ghost button--small" to={adminPath(`translation/${row.id}`)}>فتح</Link></td>
                  </tr>
                ))}
              </tbody></table></div>
              <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale as any} />
            </>
          ): <EmptyState title={text.noQueue} description={text.noQueueHint} />}
        </section>
      )}

      {tab==='glossary' && (
        <section className="panel panel--table">
          <header className="panel__header"><div><h3>{text.glossaryTitle} <span className="title-count">{glossary.length}</span></h3></div>
            <button className="button button--ghost button--small" onClick={async()=>{
              const term=prompt('المصطلح المصدر (عربي):'); if(!term) return;
              const en=prompt('EN ترجمة'); const fr=prompt('FR ترجمة');
              await api.createGlossaryTerm({ source_term: term, translations:{ en:en??'', fr:fr??'' }, scope:'global', category:'general' } as any); void load()
            }}>{text.glossaryAdd}</button>
          </header>
          <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.term}</th><th>AR → EN</th><th>AR → FR</th><th>{text.scope}</th><th>{text.category}</th></tr></thead><tbody>
            {glossary.map(g=> <tr key={g.id}><td><strong>{g.source_term}</strong></td><td>{g.translations?.en ?? '—'}</td><td>{g.translations?.fr ?? '—'}</td><td>{g.scope}</td><td><span className="track-badge">{g.category}</span></td></tr>)}
          </tbody></table></div>
          <p className="panel__note" style={{ padding:12 }}>مثال: أسماء الشخصيات لا تُترجم حرفيًا — المسرد يحميها</p>
        </section>
      )}

      {tab==='memory' && (
        <section className="panel"><div style={{ padding:16 }}>
          <h3>{text.tmTitle}</h3>
          <p className="panel__note">تخزن الترجمات المعتمدة السابقة وتقترحها للمترجم — لا اقتراحات AI وهمية</p>
          <div className="search-field" style={{ maxWidth:400 }}><Icon name="search" size={16}/><input placeholder="ابحث في ذاكرة الترجمة..." onChange={async e=>{
            const q=e.target.value; if(q.length<3) return;
            const res=await api.translationMemory(q,'en');
            console.log('TM', res)
          }} /></div>
          <p className="panel__note" style={{ marginTop:12 }}>تظهر الاقتراحات في مساحة الترجمة الجانبية</p>
        </div></section>
      )}

      {tab==='stale' && (
        <section className="panel panel--table">
          <header className="panel__header"><h3>{text.staleTitle}</h3></header>
          {queue.filter(q=>q.status==='stale').length? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.content}</th><th>{text.sourceVersion}</th><th>{text.translationStatus}</th><th></th></tr></thead><tbody>
            {queue.filter(q=>q.status==='stale').map(row=> <tr key={row.id}><td>{row.context_title}</td><td>{row.source_version}</td><td><span className="status-badge status-badge--review">{text.stale}</span></td><td><Link className="button button--ghost button--small" to={adminPath(`translation/${row.id}`)}>تحديث</Link></td></tr>)}
          </tbody></table></div>: <EmptyState title="لا ترجمات قديمة" description="عند تغيير النص المصدر، تصبح ترجماته قديمة وتظهر هنا" />}
        </section>
      )}
    </div>
  )
}
