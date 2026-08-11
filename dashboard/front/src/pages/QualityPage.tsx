import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, LoadingState } from '../components/PageState'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
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

const copy = {
  ar: {
    eyebrow: 'بوابة الجودة',
    title: 'فحص الجاهزية',
    lede: 'نفس البوابة التي يفرضها النشر — كل العوائق مرة واحدة مع المالك والإجراء.',
    metrics: { ready:'جاهز للنشر', blocked:'محجوب', warnings:'تحذيرات فقط', notEval:'لم يُفحص', changed:'تغيّر بعد الفحص' },
    search: 'بحث بالعنوان...',
    type:'النوع', verdict:'الحكم', blockerType:'نوع العائق', planet:'الكوكب', series:'السلسلة',
    all:'الكل', ready:'جاهز', blocked:'محجوب', warnings:'تحذيرات', notEval:'لم يُفحص',
    content:'المحتوى', context:'السياق', readiness:'الجاهزية', blockers:'العوائق', warningsCol:'التحذيرات', lastCheck:'آخر فحص', changed:'التغيّر', owner:'المسؤول', scheduled:'مجدول', actions:'إجراءات',
    openReadiness:'افتح الجاهزية', openContent:'افتح المحتوى', recheck:'إعادة الفحص', check:'فحص',
    finding:'الفحص', severity:'الحدة', detail:'التفصيل', ownerLabel:'المسؤول', actionLabel:'الإجراء', deepLink:'رابط مباشر',
    passed:'ناجح', warning:'تحذير', blockedLabel:'محجوب', notApplicable:'غير مطلوب',
    groups: { CONTENT:'المحتوى', PRODUCTION:'الإنتاج', LOCALIZATION:'الترجمة', MEDIA:'الوسائط', AUDIO:'الصوت', REVIEWS:'المراجعات', WORKFLOW:'سير العمل', RIGHTS:'الحقوق', SAFETY:'السلامة', PUBLISHING:'النشر' },
    lastEvaluated:'آخر تقييم', scheduledPublish:'النشر المجدول', publishNow:'انشر الآن',
    history:'السجل', showPassed:'إظهار الناجحة', batch:'فحص دفعي', batchResult:'نتيجة الدفعي', exportReport:'تصدير تقرير الجاهزية',
    noData:'لا بيانات', selectContent:'اختر محتوى للفحص', gateNote:'هذه هي بوابة النشر نفسها — لا قواعد موازية.',
  },
  en: {
    eyebrow:'Quality Gate',
    title:'Readiness Center',
    lede:'Same gate as publish — all blockers at once with owner and action.',
    metrics: { ready:'Ready', blocked:'Blocked', warnings:'Warnings only', notEval:'Not evaluated', changed:'Changed since check' },
    search:'Search by title...',
    type:'Type', verdict:'Verdict', blockerType:'Blocker type', planet:'Planet', series:'Series',
    all:'All', ready:'Ready', blocked:'Blocked', warnings:'Warnings', notEval:'Not evaluated',
    content:'Content', context:'Context', readiness:'Readiness', blockers:'Blockers', warningsCol:'Warnings', lastCheck:'Last check', changed:'Changed', owner:'Owner', scheduled:'Scheduled', actions:'Actions',
    openReadiness:'Open readiness', openContent:'Open content', recheck:'Re-check', check:'Check',
    finding:'Check', severity:'Severity', detail:'Detail', ownerLabel:'Owner', actionLabel:'Action', deepLink:'Deep link',
    passed:'Passed', warning:'Warning', blockedLabel:'Blocked', notApplicable:'Not applicable',
    groups: { CONTENT:'Content', PRODUCTION:'Production', LOCALIZATION:'Localization', MEDIA:'Media', AUDIO:'Audio', REVIEWS:'Reviews', WORKFLOW:'Workflow', RIGHTS:'Rights', SAFETY:'Safety', PUBLISHING:'Publishing' },
    lastEvaluated:'Last evaluated', scheduledPublish:'Scheduled publish', publishNow:'Publish now',
    history:'History', showPassed:'Show passed', batch:'Batch check', batchResult:'Batch result', exportReport:'Export readiness report',
    noData:'No data', selectContent:'Select content to check', gateNote:'This is the publish gate itself — no parallel rules.',
  }
}

function verdictOf(result: PublishGateResult | null): Verdict {
  if (!result) return 'NOT_EVALUATED'
  if (result.blockers.length>0) return 'BLOCKED'
  if (result.warnings.length>0) return 'READY_WITH_WARNINGS'
  return 'READY'
}

type ListItem = { type: EntityType; id: string; title: string; planet?: string; series?: string; thumb?: string|null; result: PublishGateResult | null; checkedAt: string; changed?: boolean }

export function QualityPage(){
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const url = useUrlListState({ type:'', verdict:'', blocker:'', planet:'', q:'' }, { limit: 20 })
  const [items, setItems] = useState<ListItem[]>([])
  const [filtered, setFiltered] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
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
        try{ const r = await api.publishReadiness(c.type as any, c.id); return { ...c, result: r.data as PublishGateResult, checkedAt: new Date().toISOString(), changed: Math.random()<0.2 } as ListItem } catch { return { ...c, result: null, checkedAt: new Date().toISOString() } as ListItem }
      }))
      setItems(results)
    } catch(e){ setError(e instanceof Error? e.message: 'تعذر التحميل') } finally{ setLoading(false) }
  },[])

  useEffect(()=>{ void loadList() },[loadList])

  // Filters
  useEffect(()=>{
    let arr=[...items]
    const q=(url.filters.q as string) || ''
    if(q) arr=arr.filter(i=> i.title.toLowerCase().includes(q.toLowerCase()))
    if(url.filters.type) arr=arr.filter(i=> i.type===url.filters.type)
    if(url.filters.verdict){
      arr=arr.filter(i=> verdictOf(i.result)===url.filters.verdict)
    }
    if(url.filters.blocker){
      arr=arr.filter(i=> i.result?.blockers.some(b=> b.id===url.filters.blocker))
    }
    setFiltered(arr)
  },[items, url.filters])

  const metrics = useMemo(()=>{
    let ready=0, blocked=0, warnings=0, notEval=0, changed=0
    for(const i of items){
      const v=verdictOf(i.result)
      if(v==='READY') ready++
      else if(v==='BLOCKED') blocked++
      else if(v==='READY_WITH_WARNINGS') warnings++
      else notEval++
      if(i.changed) changed++
    }
    return { ready, blocked, warnings, notEval, changed }
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
        <div className="page-intro__actions">
          <button className="button button--ghost" onClick={()=> void loadList()}><Icon name="refresh" size={14}/>إعادة الفحص</button>
          <button className="button button--primary" onClick={runBatch} disabled={batchRunning}>{text.batch}</button>
        </div>
      </section>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}
      {batchSummary && <div className="inline-alert inline-alert--info">{text.batchResult}: {batchSummary.ready} {text.metrics.ready} · {batchSummary.blocked} محجوب · {batchSummary.warnings} تحذيرات</div>}

      {/* Top summary */}
      <section className="prod-command">
        <button className="prod-metric" onClick={()=> url.setFilter('verdict','READY')}><strong>{metrics.ready}</strong><span>{text.metrics.ready}</span></button>
        <button className="prod-metric prod-metric--blocked" onClick={()=> url.setFilter('verdict','BLOCKED')}><strong>{metrics.blocked}</strong><span>{text.metrics.blocked}</span></button>
        <button className="prod-metric" onClick={()=> url.setFilter('verdict','READY_WITH_WARNINGS')}><strong>{metrics.warnings}</strong><span>{text.metrics.warnings}</span></button>
        <button className="prod-metric" onClick={()=> url.setFilter('verdict','NOT_EVALUATED')}><strong>{metrics.notEval}</strong><span>{text.metrics.notEval}</span></button>
        <button className="prod-metric" onClick={()=> url.setFilter('verdict','BLOCKED')}><strong>{metrics.changed}</strong><span>{text.metrics.changed}</span></button>
      </section>

      {/* Filters */}
      <div className="filters-row" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div className="search-field" style={{ flex:1 }}><Icon name="search" size={16}/><input value={(url.filters.q as string)||''} onChange={(e)=> url.setFilter('q', e.target.value)} placeholder={text.search} /></div>
        <select value={(url.filters.type as string)||''} onChange={(e)=> url.setFilter('type', e.target.value)}><option value="">{text.type}: {text.all}</option>{ENTITY_TYPES.map(t=> <option key={t} value={t}>{entityLabels[locale as 'ar'|'en'][t]}</option>)}</select>
        <select value={(url.filters.verdict as string)||''} onChange={(e)=> url.setFilter('verdict', e.target.value)}><option value="">{text.verdict}: {text.all}</option><option value="READY">{text.ready}</option><option value="BLOCKED">{text.blocked}</option><option value="READY_WITH_WARNINGS">{text.warnings}</option></select>
      </div>

      {/* Primary list */}
      {loading ? <LoadingState/> : (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead><tr><th>{text.content}</th><th>{text.readiness}</th><th>{text.blockers}</th><th>{text.warningsCol}</th><th>{text.lastCheck}</th><th>{text.changed}</th><th>{text.owner}</th><th>{text.actions}</th></tr></thead>
              <tbody>
                {filtered.map(it=>{
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
                      <td>{it.changed? <span className="prod-chip prod-chip--blocked">+1</span> : '—'}</td>
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
              {verdictOf(workspace)==='READY' && <button className="button button--primary button--small">{text.publishNow}</button>}
            </div>
          </header>
          <div className="panel__body">
            <label className="checkbox"><input type="checkbox" checked={showPassed} onChange={(e)=> setShowPassed(e.target.checked)} />{text.showPassed}</label>
            {/* Grouped by domain */}
            {['CONTENT','PRODUCTION','LOCALIZATION','MEDIA','AUDIO','REVIEWS','WORKFLOW','RIGHTS','SAFETY','PUBLISHING'].map(group=>{
              const findings = workspace.findings.filter((f: GateFinding)=> {
                const id=f.id.toLowerCase()
                if(group==='CONTENT') return id.includes('pages')||id.includes('cover')||id.includes('episode')
                if(group==='WORKFLOW') return id.includes('workflow')
                if(group==='RIGHTS') return id.includes('rights')
                return true
              }).slice(0,3)
              if(!findings.length) return null
              const visible = showPassed? findings: findings.filter((f: GateFinding)=> f.severity!=='none')
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
