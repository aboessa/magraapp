import { useParams, Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

export function OpsServiceWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.opsService(id)
      if ((r as any).success) setData((r as any).data)
      else throw new Error((r as any).error)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return null

  const service = data.service || {}
  const healthChecks = data.health_checks || []
  const alerts = data.alerts || []
  const recentChanges = data.recent_changes || []
  const deps = service.dependencies || []

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to={adminPath('ops')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{ar ? 'العودة للعمليات' : 'Back to Ops'}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <h1 className="admin-page-title" style={{ margin: 0 }}>
              {service.name || id}
            </h1>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              {service.description || (ar ? 'تفاصيل الخدمة ومؤشرات الجاهزية' : 'Service details and health telemetry')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="badge badge--pill" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600 }}>Tier:</span> {service.tier || 'Standard'}
          </span>
          <button className="button button--secondary button--small" onClick={() => void load()} title="Refresh">
            <Icon name="refresh" size={14} />
            <span>{ar ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'مستوى الخدمة' : 'Service Tier'}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{service.tier || 'P1'}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'معرفة في النظام' : 'Configured tier'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'التبعيات' : 'Dependencies'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{deps.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{deps.join(', ') || 'None'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'فحوصات الجاهزية' : 'Health Checks'}</span>
            <div className="bento-glass-card__icon"><Icon name="analytics" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{healthChecks.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'مسجلة مؤخراً' : 'Recent probes'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'التنبيهات النشطة' : 'Active Alerts'}</span>
            <div className="bento-glass-card__icon"><Icon name="warning" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{alerts.length}</div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${alerts.length > 0 ? 'negative' : 'positive'}`}>
              {alerts.length > 0 ? (ar ? 'تحتاج فحصاً' : 'Requires attention') : (ar ? 'مستقرة' : 'All nominal')}
            </span>
          </div>
        </article>
      </section>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Health Checks Panel */}
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="analytics" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'سجل فحوصات الجاهزية والزمن المستغرق' : 'Health Checks & Latency'}</h3>
              </div>
              <span className="badge badge--pill">{healthChecks.length} {ar ? 'فحص' : 'checks'}</span>
            </div>

            {healthChecks.length > 0 ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{ar ? 'الوقت' : 'Timestamp'}</th>
                      <th>{ar ? 'الحالة' : 'Status'}</th>
                      <th>{ar ? 'زمن الاستجابة' : 'Latency'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthChecks.map((h: any) => (
                      <tr key={h.id}>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
                            {String(h.checked_at).slice(0, 19).replace('T', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge status-badge--${h.status === 'healthy' || h.status === 'pass' ? 'published' : 'review'}`}>
                            {h.status}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>
                            {h.latency_ms != null ? `${h.latency_ms} ms` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', margin: 0 }}>{ar ? 'لا توجد فحوصات مسجلة' : 'No health checks recorded'}</p>
            )}
          </div>

          {/* Active Alerts Panel */}
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Icon name="warning" size={18} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'التنبيهات المربوطة بالخدمة' : 'Service Alerts'}</h3>
            </div>
            {alerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {alerts.map((a: any) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div>
                      <strong>{a.condition_text}</strong>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.description || a.id}</div>
                    </div>
                    <span className={`status-badge status-badge--${a.severity === 'critical' ? 'review' : 'draft'}`}>
                      {a.severity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', margin: 0 }}>{ar ? 'لا توجد تنبيهات نشطة' : 'No active alerts for this service'}</p>
            )}
          </div>
        </div>

        {/* Sticky Service Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Service Topology & Dependencies */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="grid" size={16} />
              <span>{ar ? 'مخطط التبعيات' : 'Dependency Topology'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deps.length > 0 ? (
                deps.map((dep: string) => (
                  <div key={dep} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface-sunken)', borderRadius: 6 }}>
                    <Icon name="arrow" size={12} />
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{dep}</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{ar ? 'خدمة مستقلة بلا تبعيات' : 'Standalone root service'}</div>
              )}
            </div>
          </div>

          {/* Recent Changes & Audit */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="clock" size={16} />
              <span>{ar ? 'التغييرات الأخيرة' : 'Recent Changes'}</span>
            </h4>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 10px' }}>
              {ar ? 'تغييرات تزامنت مع أحداث التشغيل (لا تفترض علاقة سببية حتمية).' : 'Potentially related changes shown next to telemetry, not causation.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentChanges.length > 0 ? (
                recentChanges.map((c: any) => (
                  <div key={c.id} style={{ fontSize: 12, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                    <strong>{c.action}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: 11 }}>{String(c.created_at).slice(0, 16)}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{ar ? 'لا تغييرات مسجلة حديثاً' : 'No recent change records'}</div>
              )}
            </div>
          </div>

          {/* AI Copilot Advisory */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار الاستقرار التشغيلي' : 'Ops Copilot Advisor'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {alerts.length > 0
                ? (ar ? 'يوجد تنبيه نشط على الخدمة. يُنصح بمراجعة سجلات الحوادث والتحقق من سلاسة تدفق المهام التابعة.' : 'Active alerts detected. Cross-reference with incident ledger and verify downstream consumers.')
                : (ar ? 'جميع مؤشرات الجاهزية ضمن الحدود المسموح بها ومعدلات الاستجابة مستقرة.' : 'Telemetry metrics within SLA bounds with zero open degradation events.')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
