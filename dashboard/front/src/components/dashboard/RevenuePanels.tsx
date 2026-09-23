import { Link } from 'react-router-dom'
import { adminPath } from '../../lib/adminPath'
import { Icon } from '../Icon'

export function RevenuePanel({ revDetail, locale }: { revDetail: any; locale: 'ar'|'en' }) {
  return (
    <article className="panel bento-card">
      <header className="panel__header">
        <div>
          <span className="panel__kicker">{locale==='ar'?'المالية والاشتراكات':'Revenue & Billing'}</span>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{locale==='ar'?'تفصيل الإيراد المالي':'Revenue breakdown'}</h3>
        </div>
        <Link className="text-link" to={adminPath('revenue')} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600 }}>
          {locale==='ar'?'التفاصيل الكاملة':'Full details'} <Icon name="arrow" size={12} />
        </Link>
      </header>
      <div style={{ padding:'16px 18px', display:'grid', gap:14 }}>
        {revDetail?._unavailable ? (
          <div className="inline-alert inline-alert--info" style={{ fontSize:12.5, borderRadius:12 }}>
            {locale==='ar'?'لا مزوّد دفع مُهيَّأ في هذه البيئة — المعاينة تُظهر صفرًا بصراحة':'No payment provider configured in this environment'}
          </div>
        ) : revDetail ? (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              <div style={{ padding:'12px', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, background:'var(--surface-2)' }}>
                <small style={{ color:'var(--muted)', fontSize:11, fontWeight:600 }}>Gross Revenue</small>
                <div style={{ fontSize:18, fontWeight:800, marginTop:4, color:'var(--primary)' }}>
                  {revDetail.metrics?.gross_revenue?.value!=null ? `$${(revDetail.metrics.gross_revenue.value/100).toFixed(2)}` : '—'}
                </div>
              </div>
              <div style={{ padding:'12px', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, background:'var(--surface-2)' }}>
                <small style={{ color:'var(--muted)', fontSize:11, fontWeight:600 }}>Refunds</small>
                <div style={{ fontSize:18, fontWeight:800, marginTop:4, color:'var(--warning)' }}>
                  {revDetail.metrics?.refunds ?? '—'}
                </div>
              </div>
              <div style={{ padding:'12px', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, background:'var(--surface-2)' }}>
                <small style={{ color:'var(--muted)', fontSize:11, fontWeight:600 }}>Renewals</small>
                <div style={{ fontSize:18, fontWeight:800, marginTop:4, color:'var(--success)' }}>
                  {revDetail.metrics?.renewals ?? '—'}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600, marginInlineEnd:4 }}>{locale==='ar'?'حسب الباقة:':'By plan:'}</span>
              {(revDetail.breakdowns?.by_plan ?? []).map((r:any)=>(
                <span key={r.plan} className="plan-badge" style={{ fontSize:11.5, padding:'4px 10px', borderRadius:8 }}>
                  <b>{r.cnt}</b> {r.plan}
                </span>
              ))}
              {(revDetail.breakdowns?.by_provider ?? []).map((r:any)=>(
                <span key={r.provider} className="plan-badge plan-badge--free" style={{ fontSize:11.5, padding:'4px 10px', borderRadius:8 }}>
                  {r.provider}: {r.cnt}
                </span>
              ))}
            </div>
            {(revDetail.data_quality?.length ?? 0) > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
                <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600, marginInlineEnd:4 }}>{locale==='ar'?'تنبيهات الجودة:':'Quality:'}</span>
                {revDetail.data_quality.map((q:any)=>(
                  <span key={q.issue} className="status-badge status-badge--review" style={{ fontSize:11, padding:'4px 8px', borderRadius:8 }}>
                    {q.issue}: {q.cnt}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <span style={{ fontSize:12, color:'var(--muted)' }}>{locale==='ar'?'جارٍ تحميل الأرقام المالية…':'Loading…'}</span>
        )}
      </div>
    </article>
  )
}

export function AnalyticsPanel({ analytics, failedCount, locale }: { analytics: any; failedCount: number|null; locale: 'ar'|'en' }) {
  return (
    <article className="panel bento-card">
      <header className="panel__header">
        <div>
          <span className="panel__kicker">{locale==='ar'?'التحليلات والمشاهدة':'Analytics & Usage'}</span>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{locale==='ar'?'الاستهلاك والتعلّم الفعلي':'Consumption & learning'}</h3>
        </div>
        <Link className="text-link" to={adminPath('analytics')} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600 }}>
          {locale==='ar'?'التحليلات':'Analytics'} <Icon name="arrow" size={12} />
        </Link>
      </header>
      <div style={{ padding:'16px 18px', display:'grid', gap:14 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <div style={{ flex: 1, minWidth: 120, padding:'10px 14px', borderRadius:12, background:'var(--surface-2)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <small style={{ color:'var(--muted)', fontSize:11, fontWeight:600 }}>Total Plays</small>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--cyan)', marginTop:2 }}>{analytics?.total_plays ?? '—'}</div>
          </div>
          <div style={{ flex: 1, minWidth: 120, padding:'10px 14px', borderRadius:12, background:'var(--surface-2)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <small style={{ color:'var(--muted)', fontSize:11, fontWeight:600 }}>Failed Stream Events</small>
            <div style={{ fontSize:18, fontWeight:800, color: (failedCount && failedCount > 0) ? 'var(--danger)' : 'var(--success)', marginTop:2 }}>{failedCount ?? '—'}</div>
          </div>
        </div>
        <div>
          <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600, display:'block', marginBottom:6 }}>{locale==='ar'?'التوزيع حسب المسار العمري:':'Distribution by Track:'}</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {(analytics?.by_track ?? []).slice(0,4).map((t:any)=>(
              <span key={t.track_id} className={`track-badge track-badge--${t.track_id}`} style={{ fontSize:12, padding:'5px 12px', borderRadius:999 }}>
                <strong>{t.track_id}</strong>: {t.count}
              </span>
            ))}
          </div>
        </div>
        <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'مصدر البيانات: /admin/analytics/overview و /admin/failed-events':'Source: /admin/analytics/overview & /admin/failed-events'}</small>
      </div>
    </article>
  )
}

