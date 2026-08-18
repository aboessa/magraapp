import { Link } from 'react-router-dom'
import { adminPath } from '../../lib/adminPath'

export function AttentionPanels({ attention, ops, locale }: { attention: { blocked:any[]; atRisk:any[]; overdue:number|null }; ops:any; locale:'ar'|'en' }) {
  return (
    <>
      <article className="panel">
        <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'اختناقات':'Bottlenecks'}</span><h3>{locale==='ar'?'إنتاج متعطل':'Blocked production'}</h3></div><Link className="text-link" to={adminPath('production')}>{locale==='ar'?'افتح المركز':'Open'} <span>→</span></Link></header>
        <div style={{ padding:'12px 16px', display:'grid', gap:8 }}>
          {attention.blocked.length ? attention.blocked.map((it:any)=>(
            <div key={it.id ?? it.entity_id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'8px 10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)' }}>
              <span style={{ fontSize:12, fontWeight:600, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.title_ar ?? it.title ?? it.entity_id ?? it.id}</span>
              <span className="status-badge status-badge--review" style={{ fontSize:11 }}>{it.status ?? it.blocker ?? 'blocked'}</span>
            </div>
          )) : <small style={{ color:'var(--muted)', fontSize:12 }}>{locale==='ar'?'لا اختناقات ظاهرة في آخر 5 عناصر':'No blockers in the last 5 items'}</small>}
        </div>
      </article>
      <article className="panel">
        <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'العملاء':'Customers'}</span><h3>{locale==='ar'?'يحتاجون تدخلاً':'Needs attention'}</h3></div><Link className="text-link" to={adminPath('customers')}>{locale==='ar'?'افتح':'Open'} <span>→</span></Link></header>
        <div style={{ padding:'12px 16px', display:'grid', gap:8 }}>
          {attention.atRisk.length ? attention.atRisk.slice(0,5).map((c:any)=>(
            <div key={c.id ?? c.parent_id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'8px 10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)' }}>
              <span style={{ fontSize:12, fontWeight:600 }}>{c.id ?? c.parent_id}</span>
              <span style={{ fontSize:11, color:'var(--muted)' }}>{c.plan ?? c.status ?? ''}</span>
            </div>
          )) : <small style={{ color:'var(--muted)', fontSize:12 }}>{locale==='ar'?'لا عملاء في قائمة الانتظار':'No customers queued'}</small>}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
            <span className="status-badge status-badge--review">{locale==='ar'?'تجاوز SLA':'SLA overdue'}: {attention.overdue ?? '—'}</span>
            <span className="status-badge status-badge--published">Reviews: {ops?.pendingReviews?.length ?? '—'}</span>
          </div>
        </div>
      </article>
    </>
  )
}
