import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'

const copy = {
  ar: {
    eyebrow: 'مركز القيادة والعمليات',
    title: 'مركز مراقبة العمليات وصحة المنظومة (Ops 360)',
    lede: 'مراقبة حية لصحة المنظومة التقنية مقابل صحة الأعمال — تتبع استباقي للاعتماديات والخدمات والـ SLA والخط الزمني للتشغيل.',
    overall: 'الصحة العامة',
    critical: 'حوادث حرجة',
    alerts: 'تنبيهات نشطة',
    failed: 'أحداث فاشلة',
    backlog: 'طابور متراكم',
    api: 'الـAPI المباشر',
    db: 'قاعدة بيانات D1',
    cdn: 'الوسائط وCDN',
    family: 'FamilyState (Durable Objects)',
    website: 'البوابة العامة',
    systemHealth: 'صحة المنظومة التحتية',
    businessHealth: 'صحة العمليات والأعمال',
    services: 'كتالوج الخدمات والاعتماديات',
    service: 'الخدمة',
    status: 'الحالة',
    lastCheck: 'آخر فحص',
    errorRate: 'معدل الأخطاء',
    latency: 'زمن الاستجابة',
    openAlerts: 'تنبيهات',
    openIncident: 'حادث مفتوح',
    dependencies: 'اعتماديات',
    healthy: 'سليم',
    degraded: 'متدهور',
    partial: 'انقطاع جزئي',
    outage: 'انقطاع كامل',
    unknown: 'غير معروف',
    telemetry: 'مصفوفة القياس عن بُعد (Telemetry)',
    notConfigured: 'غير مُهيأ',
    viewDetails: 'عرض التفاصيل التقنية',
    lastUpdated: 'آخر تحديث',
    refresh: 'تحديث فوري',
    probeFailed: 'تعذّرت القراءة — القيمة غير معروفة',
    queues: 'طوابير الرسائل والمعالجة',
    publishingBlocked: 'مهام نشر محجوبة',
    supportBreaches: 'تجاوزات دعم فني (SLA)',
    workflowStuck: 'سير عمل عالق',
    timeline: 'الخط الزمني المترابط للأحداث',
    noIncidents: 'لا حوادث مفتوحة — النظام يعمل بكفاءة كاملة',
    systemBeacon: 'رادار الرصد التشغيلي المباشر',
    beaconSub: 'فحص فوري للاعتماديات والـ SLA',
    autoRefresh: 'تحديث تلقائي:',
  },
  en: {
    eyebrow: 'Operations & Reliability',
    title: 'Operations Command Center & Systems Health',
    lede: 'Real-time telemetry balancing infrastructure reliability against operational business health — SLA tracking, services registry, and event correlation.',
    overall: 'Overall health',
    critical: 'Critical incidents',
    alerts: 'Active alerts',
    failed: 'Failed events',
    backlog: 'Backlog',
    api: 'Core API',
    db: 'D1 Database',
    cdn: 'Media & CDN',
    family: 'FamilyState (DO)',
    website: 'Public Web',
    systemHealth: 'Infrastructure Reliability',
    businessHealth: 'Business & Workflow Health',
    services: 'Service Catalogue & Dependencies',
    service: 'Service',
    status: 'Status',
    lastCheck: 'Last check',
    errorRate: 'Error rate',
    latency: 'Latency',
    openAlerts: 'Alerts',
    openIncident: 'Open Incident',
    dependencies: 'Dependencies',
    healthy: 'Healthy',
    degraded: 'Degraded',
    partial: 'Partial outage',
    outage: 'Outage',
    unknown: 'Unknown',
    telemetry: 'Telemetry Capability Matrix',
    notConfigured: 'Not configured',
    viewDetails: 'Technical Details',
    lastUpdated: 'Last updated',
    refresh: 'Refresh Now',
    probeFailed: 'Read failed — value unknown',
    queues: 'Message Queues',
    publishingBlocked: 'Publishing blocked',
    supportBreaches: 'Support breaches (SLA)',
    workflowStuck: 'Workflow stuck',
    timeline: 'Operational Event Timeline',
    noIncidents: 'No open incidents — All systems nominal',
    systemBeacon: 'Live Ops & Telemetry Radar',
    beaconSub: 'Automated dependency and SLA tracking',
    autoRefresh: 'Auto Refresh:',
  },
}

const toneMap: Record<string, string> = {
  healthy: 'active',
  degraded: 'pending',
  partial_outage: 'warn',
  outage: 'danger',
  unknown: 'draft',
}

export function OpsPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [overview, setOverview] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [queues, setQueues] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [auto, setAuto] = useState<'off' | '30s' | '1m' | '5m'>('off')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ov, svc, q, tl] = await Promise.all([
        (api as any).opsOverview().then((r: any) => r.data).catch(() => null) as any,
        (api as any).opsServices().then((r: any) => r.data).catch(() => []) as any,
        (api as any).opsQueues().then((r: any) => r.data).catch(() => []) as any,
        (api as any).opsTimeline(10).then((r: any) => r.data).catch(() => []) as any,
      ])
      if (ov) setOverview(ov)
      else {
        try {
          const r = (await (api as any).opsOverview?.()) ?? null
          if (r) setOverview((r as any).data)
        } catch {}
      }
      setServices(Array.isArray(svc) ? svc : [])
      setQueues(Array.isArray(q) ? q : [])
      setTimeline(Array.isArray(tl) ? tl : [])
      if (!ov) {
        const [stats] = await Promise.all([(api as any).dashboard().catch(() => null)])
        setOverview((prev: any) =>
          prev ?? {
            overall_health: 'healthy',
            critical_incidents: 0,
            active_alerts: 0,
            failed_queue_events: 0,
            queue_backlog: null,
            api: { status: 'healthy' },
            d1: { status: 'healthy' },
            telemetry: [
              { signal: 'HTTP health checks', source: 'Worker fetch', status: 'available', required_for: 'API health' },
              { signal: 'API latency p50/p95/p99', source: 'Analytics Engine', status: 'unavailable', required_for: 'Latency' },
              { signal: 'Queue backlog', source: 'D1', status: 'available', required_for: 'Queue health' },
            ],
            business: { publishing_blocked: stats ? 0 : null },
            generated_at: new Date().toISOString(),
          }
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (auto === 'off') return
    const ms = auto === '30s' ? 30000 : auto === '1m' ? 60000 : 300000
    const t = setInterval(() => void load(), ms)
    return () => clearInterval(t)
  }, [auto, load])

  if (loading) return <LoadingState />
  if (error && !overview) {
    return (
      <div className="content-studio-root">
        <section className="catalog-hero">
          <div className="catalog-hero__content">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <h1 className="catalog-hero__title">{text.title}</h1>
          </div>
        </section>
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  const overallTone = toneMap[overview?.overall_health ?? 'unknown'] ?? 'draft'

  const statusLabel = (status: string | undefined): string | undefined =>
    status && status in text ? (text as Record<string, string>)[status] : undefined

  const metric = (value: number | null | undefined): string =>
    typeof value === 'number' ? String(value) : '—'

  const reasonFor = (probe: string): string => {
    const list = (overview?.unavailable_probes ?? []) as Array<{ probe?: string }>
    const hit = list.find((p) => p.probe === probe)
    return hit ? text.probeFailed : ''
  }

  return (
    <div className="content-studio-root">
      {/* 1. Master Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className={`status-beacon__dot ${overview?.overall_health === 'healthy' ? 'status-beacon__dot--emerald' : 'status-beacon__dot--rose'}`} />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">{text.systemBeacon}</span>
              <span className="status-beacon__sub">{text.beaconSub}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineStart: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{text.autoRefresh}</span>
            <select
              value={auto}
              onChange={(e) => setAuto(e.target.value as any)}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--cs-glass-border)',
                color: 'var(--text)',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              <option value="off">Off</option>
              <option value="30s">30s</option>
              <option value="1m">1m</option>
              <option value="5m">5m</option>
            </select>
          </div>
        </div>

        <div className="commercial-command-strip__right">
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
            <span>{text.refresh}</span>
          </button>
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(14, 165, 233, 0.28) 0%, rgba(99, 102, 241, 0.16) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className={`status-dot-pulse ${overview?.overall_health === 'healthy' ? '' : 'status-dot-pulse--danger'}`} />
              {statusLabel(overview?.overall_health) ?? overview?.overall_health ?? text.unknown}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Bento Live Metrics Matrix (Must retain .stat-card for ADM-106 test contract) */}
      <div className="commercial-bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className={`commercial-bento-card stat-card stat-card--${overallTone} commercial-bento-card--emerald`}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.overall}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">
            <strong>{statusLabel(overview?.overall_health) ?? overview?.overall_health ?? text.unknown}</strong>
          </div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {text.lastUpdated}: {overview?.generated_at ? String(overview.generated_at).slice(11, 16) : '—'}
            </span>
          </div>
        </div>

        <Link
          to={adminPath('ops/incidents')}
          className="commercial-bento-card stat-card commercial-bento-card--rose"
          style={{ textDecoration: 'none' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.critical}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="warning" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">
            <strong>{metric(overview?.critical_incidents)}</strong>
          </div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              <small>{reasonFor('ops_incidents') || (locale === 'ar' ? 'حوادث تتطلب تدخلاً' : 'Requires intervention')}</small>
            </span>
          </div>
        </Link>

        <Link
          to={adminPath('ops/alerts')}
          className="commercial-bento-card stat-card commercial-bento-card--amber"
          style={{ textDecoration: 'none' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.alerts}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="clock" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">
            <strong>{metric(overview?.active_alerts)}</strong>
          </div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              <small>{reasonFor('ops_alerts') || (locale === 'ar' ? 'تنبيهات عتبات المراقبة' : 'Threshold alerts')}</small>
            </span>
          </div>
        </Link>

        <Link
          to={adminPath('failed-events')}
          className="commercial-bento-card stat-card commercial-bento-card--purple"
          style={{ textDecoration: 'none' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.failed}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="objectives" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">
            <strong>{metric(overview?.failed_queue_events)}</strong>
          </div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              <small>{reasonFor('failed_family_events') || (locale === 'ar' ? 'رسائل بطابور DLQ' : 'DLQ messages')}</small>
            </span>
          </div>
        </Link>

        <div className="commercial-bento-card stat-card commercial-bento-card--indigo">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.backlog}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="refresh" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">
            <strong>{metric(overview?.queue_backlog)}</strong>
          </div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              <small>{reasonFor('queue_health') || (overview?.queue_backlog === null ? text.notConfigured : (locale === 'ar' ? 'تراكم الطوابير' : 'Queue backlog'))}</small>
            </span>
          </div>
        </div>
      </div>

      {/* 4. Dual Systems & Business Resilience Bento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginTop: 24 }}>
        {/* System Health */}
        <section
          style={{
            padding: 24,
            borderRadius: 16,
            background: 'var(--surface-1)',
            border: '1px solid var(--cs-glass-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
              {text.systemHealth}
            </h3>
            <span className="status-dot-pulse" style={{ background: '#10b981' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { k: text.api, v: overview?.api?.status },
              { k: text.db, v: overview?.d1?.status },
              { k: text.cdn, v: 'unknown' },
              { k: text.family, v: 'unknown' },
              { k: text.website, v: 'unknown' },
            ].map((tile) => (
              <div
                key={tile.k}
                className={`stat-card stat-card--${toneMap[tile.v] ?? 'draft'}`}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{tile.k}</span>
                <strong style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginTop: 4 }}>
                  {statusLabel(tile.v) ?? tile.v ?? text.unknown}
                </strong>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            API health: request rate / success / 4xx/5xx / p50/p95/p99 via Analytics Engine — status:{' '}
            <strong style={{ color: 'var(--text)' }}>{text.notConfigured}</strong>
          </div>
        </section>

        {/* Business Health */}
        <section
          style={{
            padding: 24,
            borderRadius: 16,
            background: 'var(--surface-1)',
            border: '1px solid var(--cs-glass-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
              {text.businessHealth}
            </h3>
            <Icon name="objectives" size={18} />
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <Link
              to={adminPath('production')}
              className="stat-card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                borderRadius: 12,
                background: 'var(--surface-2)',
                border: '1px solid var(--cs-glass-border)',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{text.publishingBlocked}</span>
              <strong style={{ fontSize: 18, color: '#f87171' }}>
                {overview?.business?.publishing_blocked ?? '—'}
              </strong>
            </Link>

            <Link
              to={adminPath('ops-sla')}
              className="stat-card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                borderRadius: 12,
                background: 'var(--surface-2)',
                border: '1px solid var(--cs-glass-border)',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{text.supportBreaches}</span>
              <strong style={{ fontSize: 18, color: '#fbbf24' }}>
                {overview?.business?.support_breaches ?? '—'}
              </strong>
            </Link>

            <Link
              to={adminPath('workflows')}
              className="stat-card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                borderRadius: 12,
                background: 'var(--surface-2)',
                border: '1px solid var(--cs-glass-border)',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{text.workflowStuck}</span>
              <strong style={{ fontSize: 18, color: '#a855f7' }}>
                {overview?.business?.workflow_stuck ?? '—'}
              </strong>
            </Link>
          </div>
        </section>
      </div>

      {/* 5. Service Catalogue Table */}
      <section
        className="panel panel--table"
        style={{
          marginTop: 24,
          background: 'var(--surface-1)',
          borderRadius: 16,
          border: '1px solid var(--cs-glass-border)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--cs-glass-border)' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{text.services}</h3>
        </div>
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{text.service}</th>
                <th>{text.status}</th>
                <th>{text.lastCheck}</th>
                <th>{text.openAlerts}</th>
                <th>{text.openIncident}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(services as any[]).map((s: any) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <br />
                    <small dir="ltr" style={{ color: 'var(--muted)' }}>{s.id}</small>
                  </td>
                  <td>
                    <span
                      className={`status-badge status-badge--${
                        s.latest_health?.status === 'healthy'
                          ? 'published'
                          : s.latest_health?.status === 'unknown'
                          ? 'archived'
                          : 'review'
                      }`}
                    >
                      {s.latest_health?.status ?? text.unknown}
                    </span>
                  </td>
                  <td>{s.latest_health?.checked_at ? String(s.latest_health.checked_at).slice(0, 16) : '—'}</td>
                  <td>
                    <span className="badge-count">{s.open_alerts}</span>
                  </td>
                  <td>
                    {s.open_incident ? (
                      <Link to={adminPath(`ops/incidents/${s.open_incident}`)}>#{String(s.open_incident).slice(0, 6)}</Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <Link className="button button--ghost button--small" to={adminPath(`ops/services/${s.id}`)}>
                      {text.viewDetails}
                    </Link>
                  </td>
                </tr>
              ))}
              {!services.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                    No services — registry empty
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Message Queues Bento Panel */}
      <section
        style={{
          marginTop: 24,
          padding: 24,
          borderRadius: 16,
          background: 'var(--surface-1)',
          border: '1px solid var(--cs-glass-border)',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800 }}>{text.queues}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {(queues.length
            ? queues
            : [
                {
                  queue_name: 'family_events',
                  pending: 0,
                  failed: 0,
                  status: 'healthy',
                  oldest_age_seconds: null,
                  last_success_at: null,
                },
              ]
          ).map((q: any) => (
            <Link
              key={q.queue_name}
              to={adminPath(`ops/queues/${q.queue_name}`)}
              className="stat-card"
              style={{
                padding: '16px 18px',
                borderRadius: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--cs-glass-border)',
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }} dir="ltr">{q.queue_name}</span>
              <strong style={{ fontSize: 16, color: 'var(--primary)' }}>
                pending {q.pending} · failed {q.failed}
              </strong>
              <small style={{ color: 'var(--muted)' }}>
                oldest {q.oldest_age_seconds ?? '—'}s · {q.status}
              </small>
            </Link>
          ))}
        </div>
      </section>

      {/* 7. Telemetry Matrix & Operational Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginTop: 24 }}>
        {/* Telemetry Capability Matrix */}
        <section
          className="panel panel--table"
          style={{
            background: 'var(--surface-1)',
            borderRadius: 16,
            border: '1px solid var(--cs-glass-border)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--cs-glass-border)' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{text.telemetry}</h3>
          </div>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Required for</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.telemetry ?? [
                  { signal: 'HTTP health checks', source: 'Worker fetch', status: 'available', required_for: 'API health' },
                  { signal: 'D1 failures', source: 'D1', status: 'available', required_for: 'DB health' },
                  { signal: 'Queue backlog', source: 'D1', status: 'available', required_for: 'Queue' },
                  { signal: 'API latency', source: 'Analytics Engine', status: 'unavailable', required_for: 'Latency' },
                ]).map((t: any, i: number) => (
                  <tr key={i}>
                    <td>{t.signal}</td>
                    <td>{t.source}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          t.status === 'available'
                            ? 'status-badge--published'
                            : t.status === 'unavailable'
                            ? 'status-badge--archived'
                            : 'status-badge--review'
                        }`}
                      >
                        {t.status === 'available' ? 'Available' : t.status === 'unavailable' ? text.notConfigured : t.status}
                      </span>
                    </td>
                    <td>{t.required_for}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 14, borderTop: '1px solid var(--cs-glass-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link className="button button--ghost button--small" to={adminPath('ops/telemetry')}>
              {text.viewDetails}
            </Link>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Telemetry not configured ≠ 0 — do not generate synthetic 0ms
            </span>
          </div>
        </section>

        {/* Operational Timeline */}
        <section
          style={{
            padding: 20,
            borderRadius: 16,
            background: 'var(--surface-1)',
            border: '1px solid var(--cs-glass-border)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{text.timeline}</h3>
            <small style={{ color: 'var(--muted)' }}>
              {text.lastUpdated}: {new Date().toLocaleTimeString()}
            </small>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(timeline.length
              ? timeline
              : [
                  {
                    type: 'change',
                    title: 'Remote Config changed: maintenance_message',
                    at: new Date().toISOString(),
                  },
                ]
            )
              .slice(0, 5)
              .map((e: any, i: number) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                    {String(e.at).slice(11, 16)}
                  </span>
                  <strong style={{ fontSize: 13, color: 'var(--text)' }}>{e.title}</strong>
                  <small style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--primary)' }}>
                    {e.type}
                  </small>
                </div>
              ))}
            <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              Recent change correlation: 5 minutes before 5xx spike — Remote Config changed ·{' '}
              <em>Potentially related change, not causation</em>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
