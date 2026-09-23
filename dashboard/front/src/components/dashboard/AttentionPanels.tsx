import { Link } from 'react-router-dom'
import { adminPath } from '../../lib/adminPath'
import { Icon } from '../Icon'

export function AttentionPanels({ attention, ops, locale }: { attention: { blocked:any[]; atRisk:any[]; overdue:number|null }; ops:any; locale:'ar'|'en' }) {
  return (
    <>
      <article className="panel bento-card">
        <header className="panel__header">
          <div>
            <span className="panel__kicker" style={{ color: 'var(--warning)' }}>{locale==='ar'?'اختناقات الإنتاج':'Production Bottlenecks'}</span>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{locale==='ar'?'إنتاج متوقف أو متعطل':'Blocked production'}</h3>
          </div>
          <Link className="text-link" to={adminPath('production')} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600 }}>
            {locale==='ar'?'مركز الإنتاج':'Production board'} <Icon name="arrow" size={12} />
          </Link>
        </header>
        <div style={{ padding:'16px 18px', display:'grid', gap:10 }}>
          {attention.blocked.length ? attention.blocked.map((it:any)=>(
            <div key={it.id ?? it.entity_id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 14px', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, background:'var(--surface-2)', transition:'background var(--dur-fast) ease' }}>
              <span style={{ fontSize:13, fontWeight:600, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {it.title_ar ?? it.title ?? it.entity_id ?? it.id}
              </span>
              <span className="status-badge status-badge--review" style={{ fontSize:11, padding:'4px 8px', borderRadius:8 }}>
                {it.status ?? it.blocker ?? 'blocked'}
              </span>
            </div>
          )) : (
            <div style={{ padding:'14px', textAlign:'center', color:'var(--muted)', fontSize:12.5, background:'var(--surface-2)', borderRadius:12, border:'1px dashed rgba(255,255,255,0.06)' }}>
              {locale==='ar'?'لا توجد اختناقات حالياً في خط الإنتاج':'No blockers in the last 5 items'}
            </div>
          )}
        </div>
      </article>

      <article className="panel bento-card">
        <header className="panel__header">
          <div>
            <span className="panel__kicker" style={{ color: 'var(--cyan)' }}>{locale==='ar'?'رعاية المشتركين':'Subscribers & SLA'}</span>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{locale==='ar'?'حسابات تتطلب متابعة':'Needs attention'}</h3>
          </div>
          <Link className="text-link" to={adminPath('customers')} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600 }}>
            {locale==='ar'?'إدارة العملاء':'Customers'} <Icon name="arrow" size={12} />
          </Link>
        </header>
        <div style={{ padding:'16px 18px', display:'grid', gap:10 }}>
          {attention.atRisk.length ? attention.atRisk.slice(0,5).map((c:any)=>(
            <div key={c.id ?? c.parent_id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 14px', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, background:'var(--surface-2)' }}>
              <span style={{ fontSize:13, fontWeight:600, fontFamily:'monospace' }}>{c.id ?? c.parent_id}</span>
              <span className="plan-badge" style={{ fontSize:11, padding:'3px 8px', borderRadius:6 }}>{c.plan ?? c.status ?? ''}</span>
            </div>
          )) : (
            <div style={{ padding:'14px', textAlign:'center', color:'var(--muted)', fontSize:12.5, background:'var(--surface-2)', borderRadius:12, border:'1px dashed rgba(255,255,255,0.06)' }}>
              {locale==='ar'?'لا توجد حسابات معلقة أو تواجه مشاكل حالياً':'No customers queued'}
            </div>
          )}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
            <span className="status-badge status-badge--review" style={{ fontSize:12, padding:'5px 10px', borderRadius:8 }}>
              {locale==='ar'?'تجاوز SLA':'SLA overdue'}: <strong>{attention.overdue ?? '—'}</strong>
            </span>
            {/* ‏`ADM-203`: `—` تعني «تعذّرت القراءة» و`0` تعني «لا شيء معلَّق».
                والفرق يأتي من `loadOpsWidgets`: القراءة الفاشلة صارت `null` بدل
                `[]`، فـ`null?.length ?? '—'` يعرض شرطةً حيث كان يعرض صفرًا.

                والعدّادان التاليان كانا **يُجلَبان ولا يُعرَضان**: `api.tasks()`
                و`api.rights()` يُنادَيان في كل تحميل للوحة وتُهمَل نتيجتهما،
                ونصوصُ حالتهما الفارغة معرَّفة في `DashboardPage` بلا مُستهلِك.
                فعرضُهما هنا يجعل النداءين يؤدّيان غرضًا بدل حذفهما. */}
            <span className="status-badge status-badge--published" style={{ fontSize:12, padding:'5px 10px', borderRadius:8 }}>
              {locale==='ar'?'المراجعات':'Reviews'}: <strong>{ops?.pendingReviews?.length ?? '—'}</strong>
            </span>
            <span className="status-badge status-badge--review" style={{ fontSize:12, padding:'5px 10px', borderRadius:8 }}>
              {locale==='ar'?'مهامي':'My tasks'}: <strong>{ops?.myTasks?.length ?? '—'}</strong>
            </span>
            <span className="status-badge status-badge--draft" style={{ fontSize:12, padding:'5px 10px', borderRadius:8 }}>
              {locale==='ar'?'حقوق تنتهي قريبًا':'Rights expiring'}: <strong>{ops?.expiringRights?.length ?? '—'}</strong>
            </span>
          </div>
        </div>
      </article>
    </>
  )
}

