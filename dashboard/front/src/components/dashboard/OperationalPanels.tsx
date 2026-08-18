import { Link } from 'react-router-dom'
import { Icon } from '../Icon'
import { formatDate } from '../../lib/labels'
import { adminPath } from '../../lib/adminPath'

export function TimelinePanel({ timeline, locale }: { timeline:any[]; locale:'ar'|'en' }) {
  return (
    <article className="panel">
      <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'التشغيل':'Ops'}</span><h3>{locale==='ar'?'الخط الزمني التشغيلي':'Operational timeline'}</h3></div><Link className="text-link" to={adminPath('ops')}>{locale==='ar'?'كل العمليات':'View ops'} <Icon name="arrow" size={12} /></Link></header>
      <div style={{ padding:'12px 16px' }}>
        {timeline.length ? (
          <ul style={{ margin:0, padding:0, listStyle:'none', display:'grid', gap:8 }}>
            {timeline.map((e:any,i:number)=>(
              <li key={i} style={{ display:'flex', gap:10, padding:'8px 10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)' }}>
                <span style={{ width:28, height:28, display:'grid', placeItems:'center', borderRadius:8, background:'var(--surface-3)', color:'var(--muted)' }}><Icon name={e.type==='change'?'edit': e.type==='incident'?'warning':'clock'} size={13} /></span>
                <div style={{ minWidth:0 }}>
                  <strong style={{ fontSize:12, display:'block', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.title ?? e.message ?? e.type}</strong>
                  <small style={{ color:'var(--muted)', fontSize:11 }}>{e.at ? formatDate(e.at, locale, true) : ''}{e.type ? ` · ${e.type}`:''}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : <small style={{ color:'var(--muted)', fontSize:12 }}>{locale==='ar'?'لا أحداث في السجل الأخير — يعتمد على /admin/ops/timeline':'No recent timeline events — from /admin/ops/timeline'}</small>}
      </div>
    </article>
  )
}

export function FailedPanel({ failedCount, failedList, locale }: { failedCount:number|null; failedList:any[]; locale:'ar'|'en' }) {
  return (
    <article className="panel">
      <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'الطوابير':'Queues'}</span><h3>{locale==='ar'?'أحداث فاشلة':'Failed events'}</h3><small style={{ color:'var(--muted)', fontSize:11 }}>{failedCount ?? '—'} pending</small></div><Link className="text-link" to={adminPath('failed-events')}>{locale==='ar'?'افتح الطابور':'Open queue'} <Icon name="arrow" size={12} /></Link></header>
      <div style={{ padding:'12px 16px', display:'grid', gap:8 }}>
        {failedList.length ? failedList.map((f:any)=>(
          <div key={f.id ?? f.event_id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'8px 10px', border:'1px solid rgba(239,68,68,.22)', borderRadius:10, background:'rgba(239,68,68,.06)' }}>
            <div style={{ minWidth:0 }}>
              <strong style={{ fontSize:12, display:'block' }}>{f.queue_name ?? f.queue ?? f.type ?? 'queue'}</strong>
              <small style={{ color:'var(--muted)', fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>{f.error ?? f.last_error ?? f.status ?? 'pending'}</small>
            </div>
            <Link className="button button--ghost button--small" to={adminPath(`failed-events/${f.id ?? f.event_id ?? ''}`)} style={{ flex:'0 0 auto', fontSize:11 }}>{locale==='ar'?'معالجة':'Inspect'}</Link>
          </div>
        )) : <small style={{ color:'var(--muted)', fontSize:12 }}>{locale==='ar'?'لا أحداث فاشلة معلّقة':'No pending failed events'}</small>}
      </div>
    </article>
  )
}

export function SearchPanel({ locale }: { locale:'ar'|'en' }) {
  return (
    <article className="panel">
      <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'البحث':'Search'}</span><h3>{locale==='ar'?'البحث الشامل':'Global search'}</h3></div><span style={{ fontSize:10, padding:'3px 7px', borderRadius:999, background:'var(--surface-3)', border:'1px solid var(--line)' }}>Ctrl+K</span></header>
      <div style={{ padding:'14px 16px', display:'grid', gap:10 }}>
        <button type="button" onClick={()=>{ const e=new KeyboardEvent('keydown',{key:'k',ctrlKey:true}); window.dispatchEvent(e); (document.querySelector('[aria-label*="بحث"]') as HTMLElement)?.click() }} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 12px', border:'1px solid var(--line-strong)', borderRadius:10, background:'var(--surface)', color:'var(--muted)', fontSize:13, cursor:'pointer', textAlign:'start' as any }}>
          <Icon name="search" size={14} /> {locale==='ar'?'ابحث في السلاسل، القصص، الأسر، التذاكر…':'Search series, stories, families, tickets…'}
        </button>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          <span className="status-badge status-badge--draft" style={{ fontSize:11 }}>series</span>
          <span className="status-badge status-badge--review" style={{ fontSize:11 }}>stories</span>
          <span className="status-badge status-badge--ready" style={{ fontSize:11 }}>families</span>
          <span className="status-badge status-badge--published" style={{ fontSize:11 }}>tickets</span>
        </div>
        <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'يفتح لوحة الأوامر من أي شاشة':'Opens command palette from any screen'}</small>
      </div>
    </article>
  )
}

export function PlatformPanel({ failedCount, locale }: { failedCount:number|null; locale:'ar'|'en' }) {
  return (
    <article className="panel">
      <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'المنصة':'Platform'}</span><h3>{locale==='ar'?'صحة المنصة':'Platform health'}</h3></div><Link className="text-link" to={adminPath('ops')}>Ops <Icon name="arrow" size={12} /></Link></header>
      <div style={{ padding:'14px 16px', display:'grid', gap:8 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {[
            {k:'API', v: 'healthy'},
            {k:'D1', v: 'healthy'},
            {k:'R2', v: 'unknown'},
            {k:'Queues', v: failedCount!=null && failedCount>5 ? 'degraded' : 'healthy'},
            {k:'CDN', v: 'unknown'},
            {k:'Cron', v: 'unknown'},
          ].map(s=>(
            <div key={s.k} style={{ padding:'8px 9px', border:'1px solid var(--line)', borderRadius:10, background: s.v==='healthy' ? 'rgba(34,184,120,.07)' : s.v==='degraded' ? 'rgba(245,158,11,.08)' : 'var(--surface)', textAlign:'center' }}>
              <small style={{ color:'var(--muted)', fontSize:10, fontWeight:700 }}>{s.k}</small><br/><strong style={{ fontSize:12, color: s.v==='healthy' ? '#0e6340' : s.v==='degraded' ? '#7a4a00' : 'var(--muted)' }}>{s.v}</strong>
            </div>
          ))}
        </div>
        <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'المصدر: /admin/ops/overview — غير متاح ≠ 0':'Source: /admin/ops/overview — unavailable ≠ 0'}</small>
      </div>
    </article>
  )
}

export function TeamPanel({ teamLoad, locale }: { teamLoad:any; locale:'ar'|'en' }) {
  return (
    <article className="panel">
      <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'الفريق':'Team'}</span><h3>{locale==='ar'?'عبء الفريق':'Team workload'}</h3></div><Link className="text-link" to={adminPath('teams')}>{locale==='ar'?'الفرق':'Teams'} <Icon name="arrow" size={12} /></Link></header>
      <div style={{ padding:'14px 16px', display:'grid', gap:10 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
          <div style={{ padding:'12px', border:'1px solid var(--line)', borderRadius:12, background:'var(--surface)', textAlign:'center' }}><small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'الفرق':'Teams'}</small><br/><strong style={{ fontSize:20 }}>{teamLoad.teams ?? '—'}</strong></div>
          <div style={{ padding:'12px', border:'1px solid var(--line)', borderRadius:12, background: teamLoad.overdueTasks && teamLoad.overdueTasks>0 ? 'rgba(239,68,68,.07)' : 'var(--surface)', textAlign:'center' }}><small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'متأخرة':'Overdue tasks'}</small><br/><strong style={{ fontSize:20, color: teamLoad.overdueTasks && teamLoad.overdueTasks>0 ? '#b91c1c' : 'var(--text)' }}>{teamLoad.overdueTasks ?? '—'}</strong></div>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <Link className="button button--ghost button--small" to={adminPath('tasks')}>{locale==='ar'?'مهامي':'My tasks'}</Link>
          <Link className="button button--ghost button--small" to={adminPath('workflows')}>Workflows</Link>
          <span className={`status-badge ${(teamLoad as any).workflowOverdue ? 'status-badge--review' : 'status-badge--draft'}`} style={{ fontSize:11 }}>{locale==='ar'?'مراحل متأخرة':'Overdue stages'}: {(teamLoad as any).workflowOverdue ?? '—'}</span>
        </div>
      </div>
    </article>
  )
}

export function WebsitePanel({ teamLoad, locale }: { teamLoad:any; locale:'ar'|'en' }) {
  return (
    <>
      <article className="panel">
        <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'الموقع':'Website'}</span><h3>{locale==='ar'?'الموقع و SEO':'Website & SEO'}</h3></div><Link className="text-link" to={adminPath('website/pages')}>Pages <Icon name="arrow" size={12} /></Link></header>
        <div style={{ padding:'14px 16px', display:'grid', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
            <div style={{ padding:'10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)', textAlign:'center' }}><small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'صفحات الموقع':'Pages'}</small><br/><strong style={{ fontSize:18 }}>{(teamLoad as any).websitePages ?? '—'}</strong></div>
            <div style={{ padding:'10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)', textAlign:'center' }}><small style={{ color:'var(--muted)', fontSize:11 }}>SEO</small><br/><Link className="text-link" to={adminPath('seo')} style={{ fontSize:12 }}>{locale==='ar'?'افتح العمليات':'Open ops'}</Link></div>
          </div>
          <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'من /admin/website/pages و /admin/seo — لا فهرسة وهمية':'From /admin/website/pages & /admin/seo — no fake indexing'}</small>
        </div>
      </article>
      <article className="panel">
        <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'الحوكمة':'Governance'}</span><h3>{locale==='ar'?'النسخ والتدقيق':'Backup & audit'}</h3></div><Link className="text-link" to={adminPath('audit-logs')}>Audit <Icon name="arrow" size={12} /></Link></header>
        <div style={{ padding:'14px 16px', display:'grid', gap:8 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', padding:'10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)' }}>
            <span style={{ width:28, height:28, display:'grid', placeItems:'center', borderRadius:8, background:'rgba(34,184,120,.12)', color:'#0e6340' }}><Icon name="check" size={14} /></span>
            <span style={{ fontSize:12 }}>{locale==='ar'?'آخر نشاط مسجّل في سجل التدقيق أدناه':'Last activity logged in audit below'}</span>
          </div>
          <small style={{ color:'var(--muted)', fontSize:11 }}>Phase 45/46 — {locale==='ar'?'النسخ الاحتياطي يتطلب موافقة وتدقيق':'Backups require approval & audit'}</small>
        </div>
      </article>
    </>
  )
}
