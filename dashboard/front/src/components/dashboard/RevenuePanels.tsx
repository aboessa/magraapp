import { Link } from 'react-router-dom'
import { adminPath } from '../../lib/adminPath'
import { Icon } from '../Icon'

export function RevenuePanel({ revDetail, locale }: { revDetail: any; locale: 'ar'|'en' }) {
  return (
    <article className="panel">
      <header className="panel__header">
        <div><span className="panel__kicker">{locale==='ar'?'المالية':'Revenue'}</span><h3>{locale==='ar'?'تفصيل الإيراد':'Revenue breakdown'}</h3></div>
        <Link className="text-link" to={adminPath('revenue')}>{locale==='ar'?'التفاصيل':'Details'} <Icon name="arrow" size={12} /></Link>
      </header>
      <div style={{ padding:'14px 16px', display:'grid', gap:14 }}>
        {revDetail?._unavailable ? (
          <div className="inline-alert inline-alert--info" style={{ fontSize:12 }}>{locale==='ar'?'لا مزوّد دفع مُهيَّأ — المعاينَة تُظهر صفرًا بصراحة':'No payment provider configured — showing truthful unavailable'}</div>
        ) : revDetail ? (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              <div style={{ padding:'10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)' }}><small style={{ color:'var(--muted)', fontSize:11 }}>Gross</small><br/><strong>{revDetail.metrics?.gross_revenue?.value!=null ? `$${(revDetail.metrics.gross_revenue.value/100).toFixed(2)}` : '—'}</strong></div>
              <div style={{ padding:'10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)' }}><small style={{ color:'var(--muted)', fontSize:11 }}>Refunds</small><br/><strong>{revDetail.metrics?.refunds ?? '—'}</strong></div>
              <div style={{ padding:'10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)' }}><small style={{ color:'var(--muted)', fontSize:11 }}>Renewals</small><br/><strong>{revDetail.metrics?.renewals ?? '—'}</strong></div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {(revDetail.breakdowns?.by_plan ?? []).map((r:any)=><span key={r.plan} className="plan-badge" style={{ fontSize:11 }}><b>{r.cnt}</b> {r.plan}</span>)}
              {(revDetail.breakdowns?.by_provider ?? []).map((r:any)=><span key={r.provider} className="plan-badge plan-badge--free" style={{ fontSize:11 }}>{r.provider}: {r.cnt}</span>)}
            </div>
            {(revDetail.data_quality?.length ?? 0) >0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {revDetail.data_quality.map((q:any)=><span key={q.issue} className="status-badge status-badge--review" style={{ fontSize:11 }}>{q.issue}: {q.cnt}</span>)}
              </div>
            )}
          </>
        ) : (
          <span style={{ fontSize:12, color:'var(--muted)' }}>{locale==='ar'?'جارٍ التحميل…':'Loading…'}</span>
        )}
      </div>
    </article>
  )
}

export function AnalyticsPanel({ analytics, failedCount, locale }: { analytics: any; failedCount: number|null; locale: 'ar'|'en' }) {
  return (
    <article className="panel">
      <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'التحليلات':'Analytics'}</span><h3>{locale==='ar'?'الاستهلاك والتعلّم':'Consumption & learning'}</h3></div><Link className="text-link" to={adminPath('analytics')}>{locale==='ar'?'التفاصيل':'Details'} <Icon name="arrow" size={12} /></Link></header>
      <div style={{ padding:'14px 16px', display:'grid', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <span className="status-badge status-badge--published">Plays: {analytics?.total_plays ?? '—'}</span>
          <span className="status-badge status-badge--ready">Failed: {failedCount ?? '—'}</span>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {(analytics?.by_track ?? []).slice(0,4).map((t:any)=><span key={t.track_id} className="track-badge" style={{ fontSize:11 }}>{t.track_id}: {t.count}</span>)}
        </div>
        <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'من /admin/analytics/overview و /admin/failed-events':'From /admin/analytics/overview & /admin/failed-events'}</small>
      </div>
    </article>
  )
}
