// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import { formatDate, formatNumber, trackLabels } from '../lib/labels'
import type { AgeTrack, AttemptRecord, MasteryByChild, MasteryByObjective, MasteryLevel } from '../types/api'

const LEVELS: MasteryLevel[] = ['not_started','introduced','practicing','assisted','independent','needs_review']
const levelLabels: Record<'ar'|'en', Record<MasteryLevel,string>> = {
  ar: { not_started:'لم يبدأ', introduced:'تعرَّف', practicing:'يتدرّب', assisted:'بمساعدة', independent:'مستقلّ', needs_review:'يحتاج مراجعة' },
  en: { not_started:'Not started', introduced:'Introduced', practicing:'Practicing', assisted:'Assisted', independent:'Independent', needs_review:'Needs review' },
}
const TRACKS: AgeTrack[]=['preschool','kids','junior']
type Tab='overview'|'objectives'|'skill'|'children'|'attempts'|'needs_review'|'diagnostics'

const copy={
  ar:{
    eyebrow:'الإطار التعليمي', title:'الإتقان والمحاولات', intro:'الإتقان دليلٌ مبني على محاولات مؤهلة — ليس إكمال محتوى ولا نجاح لعبة ترفيهية. مصدر السلطة FamilyState، واللوحة تقرأ إسقاطات مصرح بها فقط.',
    refresh:'تحديث', total:'الإجمالي', allLevels:'كل المستويات', levelLabel:'المستوى', allTracks:'كل المسارات', childFilter:'معرّف الطفل...',
    objective:'الهدف', skill:'المهارة', childrenCount:'الأطفال', independent:'مستقلّ', needsReview:'يحتاج مراجعة', notStarted:'لم يبدأ', attempts:'المحاولات', successRate:'نسبة النجاح', lastAttempt:'آخر محاولة',
    child:'الطفل', track:'المسار', objectivesCount:'الأهداف', content:'المحتوى', score:'الدرجة', duration:'المدة', help:'المساعدة', when:'التاريخ', helpUsed:'استُخدمت', helpNone:'بلا', noData:'—', noDataHint:'الشرطة تعني غياب محاولات، لا نسبة صفر.', seconds:(n:string)=>`${n} ث`,
    loading:'جارٍ التحميل...', loadError:'تعذر تحميل بيانات الإتقان',
    emptyObjectives:'لا أهداف مطابقة', emptyChildren:'لا أطفال مطابقين', emptyAttempts:'لا محاولات', emptyDiag:'لا فجوات دليل',
    overviewTitle:'نظرة عامة', overviewDesc:'مقاييس آمنة — لا نسبة إتقان وهمية بلا دليل',
    objectivesWithEvidence:'أهداف لها دليل', objectivesWithout:'أهداف بلا دليل', childrenWithEvidence:'أطفال لهم دليل مؤهل', needsReviewCount:'في قائمة المراجعة', recentAttempts:'محاولات حديثة', invalidEvidence:'أدلة مرفوضة',
    tabOverview:'نظرة عامة', tabObjectives:'حسب الهدف', tabSkill:'حسب المهارة', tabChildren:'حسب الطفل', tabAttempts:'المحاولات', tabNeeds:'يحتاج مراجعة', tabDiag:'تشخيص الدليل',
    noEvidenceWhy:'لا توجد محاولات مؤهلة لهذا الهدف بعد', whyContent:'محتوى مرتبط', whyGames:'ألعاب قادرة على توليد دليل', runtimeStatus:'حالة التشغيل',
    needsReviewTitle:'قائمة يحتاج مراجعة', needsReviewDesc:'أسباب: تضارب أدلة، تغيّر الربط، تغيّر نسخة الهدف، مصدر غير صالح',
    evidenceTrace:'تتبع الدليل: هدف → مصدر → محاولة → تأهيل → تحديث إتقان',
    qualifying:'مؤهلة', notQualifying:'غير مؤهلة', entertainmentNote:'الألعاب الترفيهية لا تُنشئ إتقانًا تلقائيًا — فحص نوع المحرك مطلوب',
    noManual:'لا يوجد زر "تم الإتقان" اعتيادي — الإتقان محسوب من الأدلة', privacyNote:'بيانات الطفل محمية — يحتاج دورًا مصرحًا',
    more:'تحميل المزيد', showing:(s:string,t:string)=>`يُعرض ${s} من ${t}`,
  },
  en:{
    eyebrow:'Learning framework', title:'Mastery and attempts', intro:'Mastery is evidence-driven — not content completion nor a single game win. FamilyState is the authority; dashboard reads authorised projections only.',
    refresh:'Refresh', total:'Total', allLevels:'All levels', levelLabel:'Level', allTracks:'All tracks', childFilter:'Child id...',
    objective:'Objective', skill:'Skill', childrenCount:'Children', independent:'Independent', needsReview:'Needs review', notStarted:'Not started', attempts:'Attempts', successRate:'Success rate', lastAttempt:'Last attempt',
    child:'Child', track:'Track', objectivesCount:'Objectives', content:'Content', score:'Score', duration:'Duration', help:'Help', when:'When', helpUsed:'Used', helpNone:'None', noData:'—', noDataHint:'Dash means no attempts, not zero.', seconds:(n:string)=>`${n}s`,
    loading:'Loading...', loadError:'Unable to load mastery data',
    emptyObjectives:'No matching objectives', emptyChildren:'No matching children', emptyAttempts:'No attempts', emptyDiag:'No evidence gaps',
    overviewTitle:'Overview', overviewDesc:'Privacy-safe metrics — no fake mastery % without evidence',
    objectivesWithEvidence:'Objectives with evidence', objectivesWithout:'Objectives without evidence', childrenWithEvidence:'Children with qualifying evidence', needsReviewCount:'Needs review', recentAttempts:'Recent attempts', invalidEvidence:'Rejected evidence',
    tabOverview:'Overview', tabObjectives:'By objective', tabSkill:'By skill', tabChildren:'By child', tabAttempts:'Attempts', tabNeeds:'Needs review', tabDiag:'Diagnostics',
    noEvidenceWhy:'No qualifying attempts for this objective yet', whyContent:'Linked content', whyGames:'Games capable of evidence', runtimeStatus:'Runtime status',
    needsReviewTitle:'Needs Review queue', needsReviewDesc:'Reasons: conflicting evidence, mapping changed, objective version changed, invalid source',
    evidenceTrace:'Trace: Objective → Source → Attempt → Qualification → Mastery update',
    qualifying:'QUALIFIED', notQualifying:'NOT QUALIFIED', entertainmentNote:'Entertainment-first games do not create mastery automatically — engine type check required',
    noManual:'No ordinary "Mark Mastered" — mastery is computed', privacyNote:'Child data is protected — authorised roles only',
    more:'Load more', showing:(s:string,t:string)=>`Showing ${s} of ${t}`,
  }
}

const PAGE_SIZE=50
function mergeBy<T>(rows:T[], key:(r:T)=>string):T[]{ const seen=new Set<string>(); return rows.filter(r=>{ const v=key(r); if(seen.has(v)) return false; seen.add(v); return true }) }
const DEFAULT_FILTERS={ level:'', track:'', child_id:'' }
const FILTER_FIELDS=(text:any,locale:'ar'|'en',tab:Tab):FilterField[]=>{
  if(tab==='objectives') return [{ key:'level', label:text.levelLabel, type:'select', options:[{value:'',label:text.allLevels}, ...LEVELS.map(i=>({value:i,label:levelLabels[locale][i]}))]}]
  if(tab==='children') return [{ key:'track', label:text.track, type:'select', options:[{value:'',label:text.allTracks}, ...TRACKS.map(i=>({value:i,label:trackLabels[locale][i]}))]}]
  return [{ key:'child_id', label:text.child, type:'text', chip:(v:string)=>`${text.child}: ${v}` }]
}
function Rate({value,hint}:{value:number|null;hint:string}){
  if(value==null) return <span className="table-secondary" title={hint}>—</span>
  return <span className={value<50?'size-warning':undefined}>{value}%</span>
}

export function MasteryPage(){
  const { locale }=usePreferences()
  const text=copy[locale] as any
  const navigate=useNavigate()
  const list=useUrlListState(DEFAULT_FILTERS,{ limit:PAGE_SIZE, defaultView:'overview' })
  const { filters, offset }=list
  const requestedTab = list.rawView
  const tab:Tab = requestedTab
    ? (['overview','objectives','skill','children','attempts','needs_review','diagnostics'].includes(requestedTab as Tab) ? requestedTab as Tab : 'overview')
    : filters.level ? 'objectives' : filters.track ? 'children' : filters.child_id ? 'attempts' : 'overview'
  const { level, track, child_id: childId }=filters
  const [objectives,setObjectives]=useState<MasteryByObjective[]>([])
  const [children,setChildren]=useState<MasteryByChild[]>([])
  const [attempts,setAttempts]=useState<AttemptRecord[]>([])
  const [skillAgg,setSkillAgg]=useState<any[]>([])
  const [needsReviewRows,setNeedsReviewRows]=useState<MasteryByObjective[]>([])
  const [total,setTotal]=useState(0)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [overviewStats,setOverviewStats]=useState<any>(null)

  const load=useCallback(async(nextOffset:number, append:boolean)=>{
    setLoading(true); setError('')
    try{
      if(tab==='overview'){
        const [o, c, a]=await Promise.all([
          api.masteryByObjective({ limit:100 } as any) as any,
          api.masteryByChild({ limit:100 } as any) as any,
          api.attempts({ limit:20 } as any) as any,
        ])
        const objs=o.data as MasteryByObjective[]
        const withEv=objs.filter(x=> Number(x.attempts)>0).length
        const without=objs.length - withEv
        const needs=objs.filter(x=> Number(x.needs_review_count)>0).length
        const diagInvalid=objs.filter(x=> Number(x.attempts)>0 && (x.success_rate??0)<30).length
        setOverviewStats({ objectivesWithEvidence: withEv, objectivesWithout: without, childrenWithEvidence: (c.data as any[]).filter((x:any)=> Number(x.attempts)>0).length, needsReview: needs, recentAttempts: (a.data as any[]).length, invalid: diagInvalid })
        setObjectives(objs.slice(0,10))
        setTotal(objs.length)
      } else if(tab==='objectives'){
        const res=await api.masteryByObjective({ level, limit:PAGE_SIZE, offset: nextOffset } as any)
        setObjectives(cur=> append? mergeBy([...cur, ...res.data], r=>r.id): res.data); setTotal(res.meta?.total??res.data.length)
      } else if(tab==='skill'){
        const res=await api.masteryByObjective({ limit:200 } as any) as any
        // aggregate by skill
        const map=new Map<string,{ skill_id:string; skill_name:string; children:number; attempts:number; needs:number }>()
        for(const r of res.data as MasteryByObjective[]){
          const key=r.skill_id ?? 'no_skill'
          const cur=map.get(key)??{ skill_id:key, skill_name: r.skill_name?? '—', children:0, attempts:0, needs:0 }
          cur.children += Number(r.children_count)
          cur.attempts += Number(r.attempts)
          cur.needs += Number(r.needs_review_count)
          map.set(key, cur)
        }
        setSkillAgg(Array.from(map.values()))
        setTotal(map.size)
      } else if(tab==='needs_review'){
        const res=await api.masteryByObjective({ level:'needs_review', limit:PAGE_SIZE, offset: nextOffset } as any)
        setNeedsReviewRows(cur=> append? mergeBy([...cur as any, ...res.data], (r:any)=>r.id): res.data as any)
        setTotal(res.meta?.total??res.data.length)
      } else if(tab==='diagnostics'){
        const res=await api.masteryByObjective({ limit:100 } as any) as any
        const gaps=res.data.filter((r:any)=> Number(r.attempts)===0)
        setObjectives(gaps)
        setTotal(gaps.length)
      } else if(tab==='children'){
        const res=await api.masteryByChild({ track, limit:PAGE_SIZE, offset: nextOffset } as any)
        setChildren(cur=> append? mergeBy([...cur,...res.data], r=>r.child_id): res.data); setTotal(res.meta?.total??res.data.length)
      } else {
        const res=await api.attempts({ child_id: childId.trim(), limit:PAGE_SIZE, offset: nextOffset } as any)
        setAttempts(cur=> append? mergeBy([...cur,...res.data], r=>r.id): res.data); setTotal(res.meta?.total??res.data.length)
      }
    }catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[tab, level, track, childId, text.loadError])

  useEffect(()=>{ const t=setTimeout(()=> void load(offset, offset>0),220); return ()=> clearTimeout(t)},[load, offset])

  const rows = tab==='objectives'? objectives.length: tab==='children'? children.length: tab==='attempts'? attempts.length: tab==='skill'? skillAgg.length: tab==='needs_review'? needsReviewRows.length: tab==='diagnostics'? objectives.length: 0
  const hasMore = rows < total
  function switchTab(next:Tab){ if(next===tab) return; setTotal(0); navigate(`${adminPath('mastery')}${next==='overview'?'?view=overview':`?view=${next}`}`,{ replace:true })}

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.intro}</p></div><button className="button button--secondary" onClick={()=> void load(offset,false)}><Icon name="refresh" size={17}/>{text.refresh}</button></section>
      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      <div className="library-tabs" style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {(['overview','objectives','skill','children','attempts','needs_review','diagnostics'] as Tab[]).map(t=>(
          <button key={t} className={`library-tab ${tab===t?'library-tab--active':''}`} onClick={()=> switchTab(t)}>{text[t==='overview'?'tabOverview': t==='objectives'?'tabObjectives': t==='skill'?'tabSkill': t==='children'?'tabChildren': t==='attempts'?'tabAttempts': t==='needs_review'?'tabNeeds':'tabDiag']}</button>
        ))}
      </div>

      {tab==='overview' && overviewStats && (
        <section className="panel"><div style={{ padding:16 }}>
          <h3>{text.overviewTitle}</h3><p className="panel__note">{text.overviewDesc}</p>
          <div className="prod-command" style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:12 }}>
            <div className="prod-metric"><strong>{overviewStats.objectivesWithEvidence}</strong><span>{text.objectivesWithEvidence}</span></div>
            <div className="prod-metric prod-metric--blocked"><strong>{overviewStats.objectivesWithout}</strong><span>{text.objectivesWithout}</span></div>
            <div className="prod-metric"><strong>{overviewStats.childrenWithEvidence}</strong><span>{text.childrenWithEvidence}</span></div>
            <div className="prod-metric prod-metric--blocked"><strong>{overviewStats.needsReview}</strong><span>{text.needsReviewCount}</span></div>
            <div className="prod-metric"><strong>{overviewStats.recentAttempts}</strong><span>{text.recentAttempts}</span></div>
            <div className="prod-metric prod-metric--blocked"><strong>{overviewStats.invalid}</strong><span>{text.invalidEvidence}</span></div>
          </div>
          <div style={{ marginTop:16 }}><p className="panel__note">{text.evidenceTrace}</p><p className="panel__note">{text.entertainmentNote}</p><p className="panel__note">{text.noManual} · {text.privacyNote}</p></div>
        </div></section>
      )}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><span className="panel__kicker">{tab==='overview'? text.overviewTitle: tab==='objectives'? text.tabObjectives: tab==='skill'? text.tabSkill: tab==='children'? text.tabChildren: tab==='attempts'? text.tabAttempts: tab==='needs_review'? text.needsReviewTitle: text.tabDiag}</span><h3>{text.total} <span className="title-count">{formatNumber(total, locale as any)}</span></h3></div>
          <ListToolbar
            searchValue={tab==='attempts'? childId: undefined}
            onSearchChange={tab==='attempts'? (v=> list.setFilter('child_id',v)): undefined}
            searchPlaceholder={text.childFilter}
            fields={FILTER_FIELDS(text, locale as any, tab==='overview'?'objectives':tab as any)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={next=> list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={k=> list.setFilter(k as any,'')}
            trailing={<SavedViewsMenu storageKey="mastery" currentSearch={list.search} onApply={s=> navigate(`${adminPath('mastery')}${s}`)} />}
          />
        </header>

        {tab==='objectives' && (
          objectives.length? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.objective}</th><th>{text.skill}</th><th>{text.childrenCount}</th><th>{text.independent}</th><th>{text.needsReview}</th><th>{text.attempts}</th><th>{text.successRate}</th><th>{text.lastAttempt}</th></tr></thead><tbody>
            {objectives.map(row=>(
              <tr key={row.id}>
                <td><Link to={adminPath(`objectives/${row.id}`)} style={{ textDecoration:'none' }}><strong>{row.title_ar}</strong><small className="table-secondary" dir="ltr">{row.code}</small></Link>{Number(row.attempts)===0 && <div><span className="prod-chip prod-chip--blocked">{text.noEvidenceWhy}</span></div>}</td>
                <td>{row.skill_name? <span className="track-badge">{row.skill_name}</span>: <span className="table-secondary">—</span>}</td>
                <td dir="ltr">{formatNumber(row.children_count, locale as any)}</td>
                <td dir="ltr">{formatNumber(row.independent_count, locale as any)}</td>
                <td>{row.needs_review_count>0? <span className="status-badge status-badge--review">{formatNumber(row.needs_review_count, locale as any)}</span>: <span className="table-secondary">0</span>}</td>
                <td dir="ltr">{formatNumber(row.attempts, locale as any)}</td>
                <td dir="ltr"><Rate value={row.success_rate} hint={text.noDataHint} /></td>
                <td>{row.last_attempt_at? <span className="table-secondary">{formatDate(row.last_attempt_at, locale as any)}</span>: <span className="table-secondary">{text.noData}</span>}</td>
              </tr>
            ))}
          </tbody></table></div> : <EmptyState title={text.emptyObjectives} description={text.noEvidenceWhy} />
        )}

        {tab==='skill' && (
          skillAgg.length? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.skill}</th><th>{text.childrenCount}</th><th>{text.attempts}</th><th>{text.needsReview}</th></tr></thead><tbody>
            {skillAgg.map((r:any)=> <tr key={r.skill_id}><td>{r.skill_name}</td><td>{r.children}</td><td>{r.attempts}</td><td>{r.needs}</td></tr>)}
          </tbody></table></div> : <EmptyState title={text.emptyObjectives} description={text.emptyObjectives} />
        )}

        {tab==='needs_review' && (
          needsReviewRows.length? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.objective}</th><th>{text.skill}</th><th>{text.needsReview}</th><th>{text.successRate}</th></tr></thead><tbody>
            {needsReviewRows.map(row=> <tr key={row.id}><td><Link to={adminPath(`objectives/${row.id}`)}>{row.title_ar}</Link><br/><small dir="ltr">{row.code}</small></td><td>{row.skill_name ?? '—'}</td><td><span className="status-badge status-badge--review">{row.needs_review_count}</span></td><td><Rate value={row.success_rate} hint={text.noDataHint} /></td></tr>)}
          </tbody></table></div> : <EmptyState title={text.needsReviewCount} description={text.needsReviewDesc} />
        )}

        {tab==='diagnostics' && (
          objectives.length? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.objective}</th><th>محتوى</th><th>ألعاب</th><th>حالة التشغيل</th></tr></thead><tbody>
            {objectives.map(row=> <tr key={row.id}><td><Link to={adminPath(`objectives/${row.id}`)}>{row.title_ar}</Link><div><small dir="ltr">{row.code}</small> — <span className="prod-chip prod-chip--blocked">{text.noEvidenceWhy}</span></div></td><td>{text.whyContent}</td><td>{text.whyGames}</td><td>{text.runtimeStatus}</td></tr>)}
          </tbody></table></div> : <EmptyState title={text.emptyDiag} description={text.noEvidenceWhy} />
        )}

        {tab==='children' && (
          children.length? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.child}</th><th>{text.track}</th><th>{text.objectivesCount}</th><th>{text.independent}</th><th>{text.needsReview}</th><th>{text.attempts}</th><th>{text.successRate}</th></tr></thead><tbody>
            {children.map(row=> <tr key={row.child_id}><td><div className="entity-cell"><span className="entity-avatar"><Icon name="children" size={18}/></span><div><strong>{row.nickname}</strong><small dir="ltr">{row.child_id.slice(0,8)}…</small></div></div></td><td><span className={`track-badge track-badge--${row.age_track}`}>{trackLabels[locale as any][row.age_track]}</span></td><td>{row.objectives_count}</td><td>{row.independent_count}</td><td>{row.needs_review_count? <span className="status-badge status-badge--review">{row.needs_review_count}</span>: '0'}</td><td>{row.attempts}</td><td><Rate value={row.success_rate} hint={text.noDataHint} /></td></tr>)}
          </tbody></table></div> : <EmptyState title={text.emptyChildren} description={text.privacyNote} />
        )}

        {tab==='attempts' && (
          attempts.length? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.when}</th><th>{text.child}</th><th>{text.content}</th><th>{text.score}</th><th>مؤهلة؟</th><th>{text.help}</th></tr></thead><tbody>
            {attempts.map(row=>{
              const qualified = row.score!=null && row.max_score!=null && Number(row.score)/Number(row.max_score) >=0.8 && !row.help_used
              return <tr key={row.id}><td><span className="table-secondary">{formatDate(row.created_at, locale as any, true)}</span></td><td><strong>{row.nickname ?? '—'}</strong><br/><small dir="ltr">{row.child_id.slice(0,8)}…</small></td><td><strong>{row.game_title ?? row.episode_title ?? '—'}</strong><br/><small dir="ltr">{row.game_id ?? row.episode_id ?? ''}</small></td><td dir="ltr">{row.score!=null&&row.max_score!=null? <>{row.score}/{row.max_score} <Rate value={row.score_percent} hint={text.noDataHint}/></>: '—'}</td><td>{qualified? <span className="prod-chip prod-chip--complete">{text.qualifying}</span>: <span className="prod-chip prod-chip--blocked" title={row.help_used? 'help_used': 'insufficient'}>{text.notQualifying}</span>}</td><td>{row.help_used? <span className="status-badge status-badge--review">{text.helpUsed}</span>: <span className="table-secondary">{text.helpNone}</span>}</td></tr>
            })}
          </tbody></table></div> : <EmptyState title={text.emptyAttempts} description={text.noEvidenceWhy} />
        )}

        {rows>0 && <footer className="panel__footer"><span>{text.showing(formatNumber(rows, locale as any), formatNumber(total, locale as any))}</span>{hasMore && <button className="button button--ghost" disabled={loading} onClick={()=> list.setOffset(offset+PAGE_SIZE)}>{text.more}</button>}</footer>}
      </section>

      {tab==='attempts' && <section className="panel panel--notice"><strong>ملاحظة خصوصية</strong><p>{text.privacyNote} — عمود answers لا يُعاد من الخادم</p></section>}
    </div>
  )
}
