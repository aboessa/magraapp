import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { EmptyState, LoadingState } from '../components/PageState'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import type { PublishGateResult } from '../types/api'
type GateFinding = PublishGateResult['findings'][number]

type Verdict = 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED' | 'NOT_EVALUATED'
type EntityType = 'series' | 'story' | 'book' | 'game' | 'project' | 'episode'

const ENTITY_TYPES: EntityType[] = ['series','story','book','game','project','episode']
const entityLabels: Record<'ar'|'en', Record<EntityType,string>> = {
  ar: { series:'سلسلة', story:'قصة', book:'كتاب', game:'لعبة', project:'مشروع', episode:'حلقة' },
  en: { series:'Series', story:'Story', book:'Book', game:'Game', project:'Project', episode:'Episode' },
}

const QUALITY_FILTER_DEFAULTS = { type:'', id:'', verdict:'', blocker:'', planet:'' }
const FINDING_GROUPS = ['CONTENT','PRODUCTION','LOCALIZATION','MEDIA','AUDIO','REVIEWS','WORKFLOW','RIGHTS','SAFETY','PUBLISHING'] as const
type FindingGroup = typeof FINDING_GROUPS[number]

function findingGroup(finding: GateFinding): FindingGroup {
  const id = finding.id.toLowerCase()
  if (id.includes('workflow')) return 'WORKFLOW'
  if (id.includes('right') || id.includes('license')) return 'RIGHTS'
  if (id.includes('safety') || id.includes('age_gate') || id.includes('child')) return 'SAFETY'
  if (id.includes('translation') || id.includes('localization') || id.includes('language')) return 'LOCALIZATION'
  if (id.includes('audio') || id.includes('voice') || id.includes('narration')) return 'AUDIO'
  if (id.includes('review') || id.includes('approval')) return 'REVIEWS'
  if (id.includes('video') || id.includes('artwork') || id.includes('production')) return 'PRODUCTION'
  if (id.includes('image') || id.includes('asset') || id.includes('media') || id.includes('thumbnail')) return 'MEDIA'
  if (id.includes('page') || id.includes('cover') || id.includes('episode') || id.includes('content')) return 'CONTENT'
  return 'PUBLISHING'
}

const copy = {
  ar: {
    eyebrow: 'بوابة الجودة',
    title: 'فحص الجاهزية',
    lede: 'نفس البوابة التي يفرضها النشر — كل العوائق مرة واحدة مع المالك والإجراء.',
    metrics: { ready:'جاهز للنشر', blocked:'محجوب', warnings:'تحذيرات فقط', notEval:'لم يُفحص', changed:'تغيّر بعد الفحص' },
    search: 'بحث بالعنوان...',
    type:'النوع', id:'المعرّف', verdict:'الحكم', blockerType:'نوع العائق', planet:'الكوكب', series:'السلسلة',
    all:'الكل', ready:'جاهز', blocked:'محجوب', warnings:'تحذيرات', notEval:'لم يُفحص',
    content:'المحتوى', context:'السياق', readiness:'الجاهزية', blockers:'العوائق', warningsCol:'التحذيرات', lastCheck:'آخر فحص', changed:'التغيّر', owner:'المسؤول', scheduled:'مجدول', actions:'إجراءات',
    openReadiness:'افتح الجاهزية', openContent:'افتح المحتوى', recheck:'إعادة الفحص', check:'فحص',
    finding:'الفحص', severity:'الحدة', detail:'التفصيل', ownerLabel:'المسؤول', actionLabel:'الإجراء', deepLink:'رابط مباشر',
    passed:'ناجح', warning:'تحذير', blockedLabel:'محجوب', notApplicable:'غير مطلوب',
    groups: { CONTENT:'المحتوى', PRODUCTION:'الإنتاج', LOCALIZATION:'الترجمة', MEDIA:'الوسائط', AUDIO:'الصوت', REVIEWS:'المراجعات', WORKFLOW:'سير العمل', RIGHTS:'الحقوق', SAFETY:'السلامة', PUBLISHING:'النشر' },
    lastEvaluated:'آخر تقييم', scheduledPublish:'النشر المجدول', publishNow:'انشر الآن',
    history:'السجل', showPassed:'إظهار الناجحة', batch:'فحص دفعي', batchResult:'نتيجة الدفعي', exportReport:'تصدير تقرير الجاهزية',
    noData:'لا بيانات', selectContent:'اختر محتوى للفحص', gateNote:'هذه هي بوابة النشر نفسها — لا قواعد موازية.',
    publishing:'يُنشر…', publishDone:'تم النشر', publishFailed:'تعذّر النشر',
    publishBlocked:'النشر ممنوع', publishUnsupported:'هذا النوع لا يُنشر من هنا',
  },
  en: {
    eyebrow:'Quality Gate',
    title:'Readiness Center',
    lede:'Same gate as publish — all blockers at once with owner and action.',
    metrics: { ready:'Ready', blocked:'Blocked', warnings:'Warnings only', notEval:'Not evaluated', changed:'Changed since check' },
    search:'Search by title...',
    type:'Type', id:'ID', verdict:'Verdict', blockerType:'Blocker type', planet:'Planet', series:'Series',
    all:'All', ready:'Ready', blocked:'Blocked', warnings:'Warnings', notEval:'Not evaluated',
    content:'Content', context:'Context', readiness:'Readiness', blockers:'Blockers', warningsCol:'Warnings', lastCheck:'Last check', changed:'Changed', owner:'Owner', scheduled:'Scheduled', actions:'Actions',
    openReadiness:'Open readiness', openContent:'Open content', recheck:'Re-check', check:'Check',
    finding:'Check', severity:'Severity', detail:'Detail', ownerLabel:'Owner', actionLabel:'Action', deepLink:'Deep link',
    passed:'Passed', warning:'Warning', blockedLabel:'Blocked', notApplicable:'Not applicable',
    groups: { CONTENT:'Content', PRODUCTION:'Production', LOCALIZATION:'Localization', MEDIA:'Media', AUDIO:'Audio', REVIEWS:'Reviews', WORKFLOW:'Workflow', RIGHTS:'Rights', SAFETY:'Safety', PUBLISHING:'Publishing' },
    lastEvaluated:'Last evaluated', scheduledPublish:'Scheduled publish', publishNow:'Publish now',
    history:'History', showPassed:'Show passed', batch:'Batch check', batchResult:'Batch result', exportReport:'Export readiness report',
    noData:'No data', selectContent:'Select content to check', gateNote:'This is the publish gate itself — no parallel rules.',
    publishing:'Publishing…', publishDone:'Published', publishFailed:'Publish failed',
    publishBlocked:'Publish blocked', publishUnsupported:'This type cannot be published here',
  }
}

function qualityFilterFields(text: typeof copy.ar, locale: 'ar'|'en'): FilterField[] {
  return [
    {
      key: 'type', label: text.type, type: 'select',
      options: [{ value:'', label:text.all }, ...ENTITY_TYPES.map((type) => ({ value:type, label:entityLabels[locale][type] }))],
    },
    { key:'id', label:text.id, type:'text' },
    {
      key:'verdict', label:text.verdict, type:'select', advanced:true,
      options: [
        { value:'', label:text.all },
        { value:'READY', label:text.ready },
        { value:'BLOCKED', label:text.blocked },
        { value:'READY_WITH_WARNINGS', label:text.warnings },
        { value:'NOT_EVALUATED', label:text.notEval },
      ],
    },
  ]
}

function verdictOf(result: PublishGateResult | null): Verdict {
  if (!result) return 'NOT_EVALUATED'
  if (result.blockers.length>0) return 'BLOCKED'
  if (result.warnings.length>0) return 'READY_WITH_WARNINGS'
  return 'READY'
}

type ListItem = { type: EntityType; id: string; title: string; planet?: string; series?: string; thumb?: string|null; result: PublishGateResult | null; checkedAt: string }

export function QualityPage(){
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const url = useUrlListState(QUALITY_FILTER_DEFAULTS, { limit: 20 })
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  // Publishing is a mutation from a screen that otherwise only reads, so its
  // in-flight and result states are explicit rather than inferred.
  const [publishing, setPublishing] = useState(false)
  const [publishNote, setPublishNote] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<PublishGateResult | null>(null)
  const [workspaceMeta, setWorkspaceMeta] = useState<{ title:string; type:EntityType; id:string; checkedAt:string } | null>(null)
  const [showPassed, setShowPassed] = useState(false)
  const [history, setHistory] = useState<PublishGateResult[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchSummary, setBatchSummary] = useState<{ ready:number; blocked:number; warnings:number }|null>(null)
  const [error, setError] = useState('')

  const loadList = useCallback(async()=>{
    setLoading(true); setError('')
    try{
      // Gather sample entities across types — efficient aggregate: one list per type, then parallel gate evaluations.
      const [seriesRes, storiesRes, episodesRes, booksRes, gamesRes, projectsRes] = await Promise.all([
        api.series({ limit: 8 } as any).catch(()=>({data:[]} as any)),
        api.stories({ limit: 8 } as any).catch(()=>({data:[]} as any)),
        api.episodes({ limit: 8 } as any).catch(()=>({data:[]} as any)),
        api.books({ limit: 8 } as any).catch(()=>({data:[]} as any)),
        api.games({ limit: 8 } as any).catch(()=>({data:[]} as any)),
        api.projects({ limit: 8 } as any).catch(()=>({data:[]} as any)),
      ])
      const candidates: Array<{type:EntityType; id:string; title:string; planet?:string; series?:string; thumb?:string|null}> = []
      for(const s of (seriesRes.data||[]).slice(0,6)) candidates.push({ type:'series', id:(s as any).id, title:(s as any).title_ar, thumb:(s as any).cover_url })
      for(const s of (storiesRes as any).data?.slice(0,6) || []) candidates.push({ type:'story', id:s.id, title:s.title_ar, thumb:s.cover_asset_id? 'cover': null, series:s.series_title })
      for(const e of (episodesRes as any).data?.slice(0,6) || []) candidates.push({ type:'episode', id:e.id, title:e.title_ar, thumb:e.thumbnail_url })
      for(const b of (booksRes as any).data?.slice(0,4) || []) candidates.push({ type:'book', id:b.id, title:b.title_ar })
      for(const g of (gamesRes as any).data?.slice(0,4) || []) candidates.push({ type:'game', id:g.id, title:g.title_ar })
      for(const p of (projectsRes as any).data?.slice(0,4) || []) candidates.push({ type:'project', id:p.id, title:p.title_ar })

      // Parallel gate evaluations — bounded to candidates length (max 32) to avoid N+1 storm.
      const results = await Promise.all(candidates.map(async c=>{
        try{ const r = await api.publishReadiness(c.type as any, c.id); return { ...c, result: r.data as PublishGateResult, checkedAt: new Date().toISOString() } as ListItem } catch { return { ...c, result: null, checkedAt: new Date().toISOString() } as ListItem }
      }))
      setItems(results)
    } catch(e){ setError(e instanceof Error? e.message: 'تعذر التحميل') } finally{ setLoading(false) }
  },[])

  const directId = url.filters.id.trim()
  const directType = (url.filters.type || 'story') as EntityType
  const filterFields = useMemo(() => qualityFilterFields(text, locale as 'ar'|'en'), [locale, text])

  useEffect(()=>{ if (!directId) void loadList() },[directId, loadList])

  useEffect(() => {
    if (!directId) {
      setWorkspace(null)
      setWorkspaceMeta(null)
      return
    }

    let active = true
    const checkedAt = new Date().toISOString()
    setLoading(true)
    setError('')
    void api.publishReadiness(directType, directId)
      .then((response) => {
        if (!active) return
        const result = response.data as PublishGateResult
        setWorkspace(result)
        setWorkspaceMeta({ title: directId, type: directType, id: directId, checkedAt })
        setHistory((current) => [result, ...current].slice(0, 5))
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : locale === 'ar' ? 'تعذر التحميل' : 'Unable to load')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [directId, directType, locale])

  const filtered = useMemo(() => {
    let result = [...items]
    const query = url.query.trim().toLowerCase()
    if(query) result=result.filter((item)=> item.title.toLowerCase().includes(query))
    if(url.filters.type) result=result.filter((item)=> item.type===url.filters.type)
    if(url.filters.verdict) result=result.filter((item)=> verdictOf(item.result)===url.filters.verdict)
    if(url.filters.blocker) result=result.filter((item)=> item.result?.blockers.some((blocker)=> blocker.id===url.filters.blocker))
    return result
  }, [items, url.filters.blocker, url.filters.type, url.filters.verdict, url.query])

  const pageItems = useMemo(
    () => filtered.slice(url.offset, url.offset + url.limit),
    [filtered, url.limit, url.offset],
  )

  const metrics = useMemo(()=>{
    let ready=0, blocked=0, warnings=0, notEval=0
    for(const i of items){
      const v=verdictOf(i.result)
      if(v==='READY') ready++
      else if(v==='BLOCKED') blocked++
      else if(v==='READY_WITH_WARNINGS') warnings++
      else notEval++
    }
    return { ready, blocked, warnings, notEval, changed: 0 }
  },[items])

  const openWorkspace = async (it: ListItem)=>{
    try{
      const r = await api.publishReadiness(it.type as any, it.id)
      setWorkspace(r.data as any)
      setWorkspaceMeta({ title: it.title, type: it.type, id: it.id, checkedAt: new Date().toISOString() })
      setHistory(h=> [r.data as any, ...h].slice(0,5))
    } catch{}
  }

  const runBatch = async()=>{
    setBatchRunning(true)
    const subset = filtered.slice(0, 10)
    let ready=0, blocked=0, warnings=0
    for(const it of subset){
      const v=verdictOf(it.result)
      if(v==='READY') ready++; else if(v==='BLOCKED') blocked++; else if(v==='READY_WITH_WARNINGS') warnings++
    }
    setBatchSummary({ ready, blocked, warnings })
    setBatchRunning(false)
  }

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p><p className="panel__note">{text.gateNote}</p></div>
        {!directId && <div className="page-intro__actions">
          <button className="button button--ghost" onClick={()=> void loadList()}><Icon name="refresh" size={14}/>{text.recheck}</button>
          <button className="button button--primary" onClick={runBatch} disabled={batchRunning}>{text.batch}</button>
        </div>}
      </section>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}
      {!directId && batchSummary && <div className="inline-alert inline-alert--info">{text.batchResult}: {batchSummary.ready} {text.metrics.ready} · {batchSummary.blocked} محجوب · {batchSummary.warnings} تحذيرات</div>}

      {/* Top summary */}
      {!directId && <section className="prod-command">
        <button className="prod-metric" onClick={()=> url.setFilter('verdict','READY')}><strong>{metrics.ready}</strong><span>{text.metrics.ready}</span></button>
        <button className="prod-metric prod-metric--blocked" onClick={()=> url.setFilter('verdict','BLOCKED')}><strong>{metrics.blocked}</strong><span>{text.metrics.blocked}</span></button>
        <button className="prod-metric" onClick={()=> url.setFilter('verdict','READY_WITH_WARNINGS')}><strong>{metrics.warnings}</strong><span>{text.metrics.warnings}</span></button>
        <button className="prod-metric" onClick={()=> url.setFilter('verdict','NOT_EVALUATED')}><strong>{metrics.notEval}</strong><span>{text.metrics.notEval}</span></button>
        <button className="prod-metric" onClick={()=> url.setFilter('verdict','BLOCKED')}><strong>{metrics.changed}</strong><span>{text.metrics.changed}</span></button>
      </section>}

      <ListToolbar
        searchValue={url.query}
        onSearchChange={url.setQuery}
        searchPlaceholder={text.search}
        fields={filterFields}
        values={url.filters}
        defaults={QUALITY_FILTER_DEFAULTS}
        onApply={url.setFilters}
        onClear={url.clearFilters}
        onRemove={(key) => url.setFilter(key as keyof typeof QUALITY_FILTER_DEFAULTS, '')}
      />

      {/* Primary list */}
      {directId ? (loading ? <LoadingState/> : null) : loading ? <LoadingState/> : (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead><tr><th>{text.content}</th><th>{text.readiness}</th><th>{text.blockers}</th><th>{text.warningsCol}</th><th>{text.lastCheck}</th><th>{text.changed}</th><th>{text.owner}</th><th>{text.actions}</th></tr></thead>
              <tbody>
                {pageItems.map(it=>{
                  const v=verdictOf(it.result)
                  return (
                    <tr key={`${it.type}:${it.id}`}>
                      <td>
                        <div className="prod-identity">
                          <div className="prod-thumb">{it.thumb ? <img src={it.thumb} alt="" /> : <Icon name="media" size={16}/>}</div>
                          <div><Link to={adminPath(it.type==='episode'?`episodes/${it.id}`: it.type==='story'?`stories/${it.id}`: `${it.type}s/${it.id}`)}><strong>{it.title}</strong></Link><small>{entityLabels[locale as 'ar'|'en'][it.type]} · {it.series ?? it.planet ?? ''}</small><small dir="ltr">{it.id.slice(0,8)}</small></div>
                        </div>
                      </td>
                      <td><span className={`status-badge ${v==='READY'?'status-badge--published': v==='BLOCKED'?'status-badge--archived':'status-badge--review'}`}>{v==='READY'?text.ready: v==='BLOCKED'?text.blocked: v==='READY_WITH_WARNINGS'?text.warnings: text.notEval}</span></td>
                      <td>{it.result?.blockers.length ?? 0}</td>
                      <td>{it.result?.warnings.length ?? 0}</td>
                      <td dir="ltr">{it.checkedAt.slice(0,16).replace('T',' ')}</td>
                      <td>—</td>
                      <td>{it.result?.blockers[0]?.owner ?? '—'}<br/><small>{it.result?.blockers[0]?.required_action?.slice(0,20) ?? ''}</small></td>
                      <td><button className="button button--ghost button--small" onClick={()=> void openWorkspace(it)}>{text.openReadiness}</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length===0 && <EmptyState title={text.noData} description={text.selectContent} />}
          <Pagination total={filtered.length} limit={url.limit} offset={url.offset} onOffsetChange={url.setOffset as any} locale={locale} />
        </section>
      )}

      {/* Workspace */}
      {workspace && workspaceMeta && (
        <section className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{entityLabels[locale as 'ar'|'en'][workspaceMeta.type]} · {workspaceMeta.title}</span><h3 style={{ color: verdictOf(workspace)==='BLOCKED'?'#ef4444': verdictOf(workspace)==='READY'?'#22c55e':'#f59e0b'}}>{verdictOf(workspace)==='READY'?text.ready: verdictOf(workspace)==='BLOCKED'?text.blocked: text.warnings}</h3><small>{text.lastEvaluated}: {workspaceMeta.checkedAt.slice(0,16)} · {text.scheduled}: —</small></div>
            <div className="table-actions">
              <button className="button button--ghost button--small" onClick={async()=>{ const r=await api.publishReadiness(workspaceMeta.type as any, workspaceMeta.id); setWorkspace(r.data as any) }}>{text.recheck}</button>
              <Link className="button button--ghost button--small" to={adminPath(workspaceMeta.type==='episode'?`episodes/${workspaceMeta.id}`: workspaceMeta.type==='story'?`stories/${workspaceMeta.id}`: `${workspaceMeta.type}s/${workspaceMeta.id}`)}>{text.openContent}</Link>
              {verdictOf(workspace)==='READY' && <button className="button button--primary button--small" disabled={publishing} onClick={async()=>{
                // This button had no handler at all, so a reviewer could clear
                // every blocker and still have no way to publish. The four content
                // types it covers had no publish endpoint either until now.
                setPublishing(true)
                setPublishNote(null)
                try {
                  const publisher = {
                    story: api.publishStory,
                    book: api.publishBook,
                    game: api.publishGame,
                    project: api.publishProject,
                    series: api.publishSeries,
                    episode: api.publishEpisode,
                  }[workspaceMeta.type as 'story'|'book'|'game'|'project'|'series'|'episode']
                  if(!publisher){ setPublishNote(text.publishUnsupported); return }
                  await publisher(workspaceMeta.id)
                  // Re-evaluate rather than assume: the server is the authority on
                  // what state the content is now in.
                  const r = await api.publishReadiness(workspaceMeta.type as any, workspaceMeta.id)
                  setWorkspace(r.data as any)
                  setPublishNote(text.publishDone)
                } catch (error) {
                  // The 409 body carries every blocker; showing "failed" alone
                  // would send the reviewer back to guessing.
                  const blockers = (error as ApiError)?.payload as { data?: { blockers?: Array<{ id: string }> } } | undefined
                  const ids = blockers?.data?.blockers?.map((blocker)=> blocker.id) ?? []
                  setPublishNote(ids.length ? `${text.publishBlocked}: ${ids.join(', ')}` : ((error as Error)?.message ?? text.publishFailed))
                } finally {
                  setPublishing(false)
                }
              }}>{publishing ? text.publishing : text.publishNow}</button>}
            </div>
          </header>
          <div className="panel__body">
            {publishNote && (
              // Stated rather than swallowed: a 409 carries every blocker, and a
              // reviewer who cleared the checklist needs to know which one is left.
              <p role="status" aria-live="polite" className="story-inspector__hint" style={{ marginBottom: 8 }}>{publishNote}</p>
            )}
            <label className="checkbox"><input type="checkbox" checked={showPassed} onChange={(e)=> setShowPassed(e.target.checked)} />{text.showPassed}</label>
            {/* Grouped by domain */}
            {FINDING_GROUPS.map((group)=>{
              const visible = workspace.findings
                .filter((finding: GateFinding) => findingGroup(finding) === group && (showPassed || finding.severity !== 'none'))
                .slice(0, 3)
              if(!visible.length) return null
              return (
                <div key={group} className="readiness-group" style={{ marginTop:12 }}>
                  <h4 style={{ fontSize:12, color:'var(--muted)' }}>{(text.groups as any)[group] ?? group}</h4>
                  {visible.map((f: GateFinding)=> (
                    <div key={f.id} className={`readiness-item ${f.severity==='blocker'?'readiness-item--blocked': f.severity==='warning'?'readiness-item--warn':''}`} style={{ borderInlineStart:`3px solid ${f.severity==='blocker'?'#ef4444': f.severity==='warning'?'#f59e0b':'#22c55e'}`, paddingInlineStart:8, margin: '6px 0' }}>
                      <div className="readiness-item__head"><strong>{f.label_ar}</strong><span className={`status-badge ${f.status==='blocked'?'status-badge--archived': f.status==='warn'?'status-badge--review': 'status-badge--published'}`}>{f.status}</span></div>
                      <p className="panel__note">{f.detail}</p>
                      <small>Owner: {f.owner ?? '—'} · Action: {f.required_action ?? '—'}</small>
                      {f.items && f.items.length>0 && <small> · Items: {f.items.slice(0,3).join(', ')}</small>}
                      {f.required_action && <div><Link className="button button--ghost button--small" to={adminPath(f.owner==='production'?'production': f.owner==='reviewer'?'content-reviews': 'quality')}>{f.required_action.slice(0,24)}</Link></div>}
                    </div>
                  ))}
                </div>
              )
            })}
            <div className="panel__body" style={{ display:'flex', gap:8, marginTop:12 }}>
              <button className="button button--ghost button--small" onClick={()=>{ const blob=new Blob([JSON.stringify(workspace,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`readiness-${workspaceMeta.id}.json`; a.click(); URL.revokeObjectURL(url)}}>{text.exportReport}</button>
            </div>
            {history.length>1 && <div style={{ marginTop:12 }}><h4>{text.history}</h4>{history.slice(0,3).map((h,i)=> <div key={i} className="panel__note">{h.blockers.length} blockers · {h.warnings.length} warnings</div>)}</div>}
          </div>
        </section>
      )}
    </div>
  )
}
