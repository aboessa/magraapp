import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EntityHeader } from '../components/EntityHeader'
import { DetailTabs } from '../components/DetailTabs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { Icon } from '../components/Icon'
import { TimelineView } from '../components/DataViews'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { ProjectDetail } from '../types/api'

const TABS = ['overview','steps','materials','learning','safety','media','localization','production','workflow','downloads','analytics','history'] as const
type TabKey = typeof TABS[number]

const copy = {
  ar: { breadcrumb:'المشروعات', loading:'جارٍ تحميل المشروع...', notFound:'المشروع غير موجود', loadError:'تعذر التحميل',
    tabs:{ overview:'نظرة عامة', steps:'الخطوات', materials:'المواد', learning:'التعلم', safety:'السلامة', media:'الوسائط', localization:'الترجمة', production:'الإنتاج', workflow:'سير العمل', downloads:'التنزيلات', analytics:'التحليلات', history:'السجل' },
    duration:'المدة', difficulty:'الصعوبة', supervision:'الإشراف', age:'العمر', steps:'خطوات', materials:'مواد', objectives:'أهداف', safetyState:'حالة السلامة', review:'المراجعة',
    notRequired:'غير مطلوبة', pending:'بانتظار مراجعة', approved:'مُعتمدة', blocked:'موقوفة',
  },
  en: { breadcrumb:'Projects', loading:'Loading project...', notFound:'Project not found', loadError:'Unable to load',
    tabs:{ overview:'Overview', steps:'Steps', materials:'Materials', learning:'Learning', safety:'Safety', media:'Media', localization:'Localization', production:'Production', workflow:'Workflow', downloads:'Downloads', analytics:'Analytics', history:'History' },
    duration:'Duration', difficulty:'Difficulty', supervision:'Supervision', age:'Age', steps:'Steps', materials:'Materials', objectives:'Objectives', safetyState:'Safety', review:'Review',
    notRequired:'Not required', pending:'Pending review', approved:'Approved', blocked:'Blocked',
  },
}

export function ProjectWorkspacePage() {
  const { locale } = usePreferences()
  const text = copy[locale] as any
  const { id = '' } = useParams()
  const [project,setProject]=useState<ProjectDetail|null>(null)
  const [tab,setTab]=useState<TabKey>('overview')
  const [state,setState]=useState<'loading'|'ok'|'missing'|'error'>('loading')
  const [error,setError]=useState('')
  const load = useCallback(async()=>{
    setState('loading'); setError('')
    try{ const r=await api.project(id); setProject(r.data as any); setState('ok')}
    catch(e){ if(e instanceof ApiError && e.status===404) setState('missing'); else { setState('error'); setError(e instanceof Error?e.message:text.loadError)}}
  },[id,text.loadError])
  useEffect(()=>{ void load()},[load])
  if(state==='loading') return <LoadingState label={text.loading} />
  if(state==='missing') return <div className="page-stack"><EmptyState title={text.notFound} description="" action={<Link className="button button--ghost" to={adminPath('projects')}>{text.breadcrumb}</Link>} /></div>
  if(state==='error' || !project) return <div className="page-stack"><ErrorState message={error} onRetry={()=>void load()} /></div>
  const overview = (
    <div className="workspace-stack">
      <section className="panel"><header className="panel__header"><h3>{text.tabs.overview}</h3></header>
        <div className="panel__body">
          <div className="metric-row">
            <div className="metric-cell"><strong>{project.age_min}–{project.age_max}</strong><span>{text.age}</span></div>
            <div className="metric-cell"><strong>{(project as any).estimated_minutes ? `${(project as any).estimated_minutes} min` : '—'}</strong><span>{text.duration}</span></div>
            <div className="metric-cell"><strong>{project.supervision_level}</strong><span>{text.supervision}</span></div>
            <div className="metric-cell"><strong>{formatNumber(project.steps.length, locale)}</strong><span>{text.steps}</span></div>
            <div className="metric-cell"><strong>{formatNumber(project.materials.length, locale)}</strong><span>{text.materials}</span></div>
          </div>
          <p style={{ marginTop: 12 }}>{project.description_ar || '—'}</p>
          <div className="inline-alert inline-alert--info" style={{ marginTop: 12 }}>{text.safetyState}: {project.safety_notes ? text.approved : text.pending} · {text.supervision}: {project.supervision_level}</div>
        </div>
      </section>
    </div>
  )
  const stepsTab = project.steps.length===0 ? <EmptyState title={locale==='ar'?'لم تتم إضافة خطوات':'No steps yet'} description="" action={<button className="button button--primary"><Icon name="plus" size={14} />{locale==='ar'?'إضافة أول خطوة':'Add first step'}</button>} /> : (
    <div className="panel panel--table"><div className="table-scroll"><table className="data-table"><thead><tr><th>#</th><th>{text.tabs.steps}</th></tr></thead><tbody>{project.steps.map((s, i)=>(<tr key={i}><td>{i+1}</td><td>{s}</td></tr>))}</tbody></table></div></div>
  )
  const materialsTab = project.materials.length===0 ? <EmptyState title="لا مواد" description="" /> : (
    <div className="panel"><div className="panel__body"><ul className="detail-list">{project.materials.map((m)=> <li key={m}>{m}</li>)}</ul><p className="data-unavailable">{text.supervision}: {project.supervision_level === 'required' ? 'مطلوب' : 'مستحسن'}</p></div></div>
  )
  const tabs = [
    { key:'overview', label:text.tabs.overview, content: overview },
    { key:'steps', label:text.tabs.steps, badge: project.steps.length, content: stepsTab },
    { key:'materials', label:text.tabs.materials, badge: project.materials.length, content: materialsTab },
    { key:'learning', label:text.tabs.learning, content:<div className="data-unavailable">{text.objectives}: {project.learning_objective_ids.length} — {project.learning_objective_ids.join(', ') || '—'}</div> },
    { key:'safety', label:text.tabs.safety, content:<div className="panel"><div className="panel__body"><p>{project.safety_notes || text.pending}</p><small>{text.supervision}: {project.supervision_level}</small></div></div> },
    { key:'media', label:text.tabs.media, content: (project as any).assets?.length ? <div className="entity-grid">{(project as any).assets.map((a:any)=>(<Link key={a.id} className="entity-card" to={adminPath(`media/${a.id}`)}><strong>{a.title_ar}</strong></Link>))}</div> : <EmptyState title="لا وسائط" description="" /> },
    { key:'localization', label:text.tabs.localization, content:<div className="data-unavailable">AR 1/1 · EN 0/1</div> },
    { key:'production', label:text.tabs.production, content:<div className="data-unavailable">يرتبط بمركز الإنتاج</div> },
    { key:'workflow', label:text.tabs.workflow, content:<div className="data-unavailable">سير العمل والمراجعات</div> },
    { key:'downloads', label:text.tabs.downloads, content:<div className="data-unavailable">مواد قابلة للطباعة والتنزيل</div> },
    { key:'analytics', label:text.tabs.analytics, content:<div className="data-unavailable">بدء واكتمال — إن وُجد تتبع</div> },
    { key:'history', label:text.tabs.history, content:<TimelineView entries={[]} emptyLabel="لا سجل" /> },
  ]
  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[{ label: text.breadcrumb, to: adminPath('projects') }, { label: project.title_ar }]}
        thumbnail={<div className="entity-thumb"><span className="entity-thumb__letter"><Icon name="objectives" size={22} /></span></div>}
        title={project.title_ar}
        subtitle={project.description_ar ?? undefined}
        meta={<><span>{project.age_min}–{project.age_max}</span><span>{project.supervision_level}</span><span>{formatNumber(project.steps.length, locale)} {text.steps}</span></>}
        status={<StatusBadge status={project.status as any} />}
        actions={<Link className="button button--primary" to={adminPath(`projects/${id}/edit`)}><Icon name="edit" size={16} />{locale==='ar'?'تعديل':'Edit'}</Link>}
      />
      <DetailTabs tabs={tabs as any} active={tab} onChange={(k)=> setTab(k as TabKey)} />
    </div>
  )
}
