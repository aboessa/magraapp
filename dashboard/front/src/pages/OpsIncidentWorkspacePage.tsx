import { useParams, Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

const INCIDENT_STAGES = ['open', 'investigating', 'identified', 'monitoring', 'resolved'] as const

export function OpsIncidentWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [advancing, setAdvancing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.opsIncident(id)
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

  const timeline = data.timeline || []
  const alerts = data.alerts || []
  const failedEvents = data.failed_events || []
  const affected = data.affected_services || []

  const nextStatus =
    data.status === 'open'
      ? 'investigating'
      : data.status === 'investigating'
      ? 'identified'
      : data.status === 'identified'
      ? 'monitoring'
      : 'resolved'

  const handleAdvance = async () => {
    setAdvancing(true)
    try {
      await api.updateOpsIncident(id, { status: nextStatus })
      await load()
    } finally {
      setAdvancing(false)
    }
  }

  const currentStageIndex = INCIDENT_STAGES.indexOf(data.status as any)

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to={adminPath('ops/incidents')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{ar ? 'قائمة الحوادث' : 'Incident Ledger'}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`status-badge status-badge--${data.severity === 'critical' ? 'review' : 'draft'}`}>
                {data.severity?.toUpperCase()}
              </span>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {data.title || `Incident ${data.id.slice(0, 8)}`}
              </h1>
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              {ar ? `معرّف الحادث: ${data.id} · بدأ: ${String(data.started_at).slice(0, 16)}` : `ID: ${data.id} · Started: ${String(data.started_at).slice(0, 16)}`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {data.status !== 'resolved' ? (
            <button
              className="button button--primary button--small"
              onClick={() => void handleAdvance()}
              disabled={advancing}
            >
              <Icon name="check" size={14} />
              <span>{advancing ? (ar ? 'جارٍ التحديث...' : 'Updating...') : (ar ? `ترقية الحالة إلى (${nextStatus})` : `Advance to ${nextStatus}`)}</span>
            </button>
          ) : (
            <span className="status-badge status-badge--published">{ar ? 'تم الحل بنجاح' : 'Resolved'}</span>
          )}
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Incident Lifecycle Stepper */}
      <div className="panel" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          {INCIDENT_STAGES.map((st, idx) => {
            const isDone = idx < currentStageIndex || data.status === 'resolved'
            const isCurrent = st === data.status && data.status !== 'resolved'
            return (
              <div key={st} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    background: isCurrent ? 'var(--primary)' : isDone ? 'var(--color-success, #10b981)' : 'var(--surface-sunken)',
                    color: isCurrent || isDone ? '#fff' : 'var(--muted)',
                    border: '2px solid var(--border)',
                  }}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  {st}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'مستوى الخطورة' : 'Severity'}</span>
            <div className="bento-glass-card__icon"><Icon name="warning" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ textTransform: 'uppercase' }}>{data.severity}</div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${data.severity === 'critical' ? 'negative' : 'neutral'}`}>
              {data.severity === 'critical' ? (ar ? 'أولوية قصوى' : 'High Priority') : (ar ? 'تحت السيطرة' : 'Guarded')}
            </span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الخدمات المتأثرة' : 'Affected Services'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{affected.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{affected.join(', ') || 'None declared'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'محطات الخط الزمني' : 'Timeline Entries'}</span>
            <div className="bento-glass-card__icon"><Icon name="clock" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{timeline.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'سجل زمني موثق' : 'Forensic trace'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الأحداث المتعثرة المربوطة' : 'Linked Failed Events'}</span>
            <div className="bento-glass-card__icon"><Icon name="analytics" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{failedEvents.length}</div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${failedEvents.length > 0 ? 'negative' : 'positive'}`}>
              {failedEvents.length > 0 ? (ar ? 'مرتبطة بالحادث' : 'DLQ correlated') : (ar ? 'لا أحداث تابعة' : 'None linked')}
            </span>
          </div>
        </article>
      </section>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Incident Timeline */}
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="clock" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'الخط الزمني المباشر وتطورات الاستجابة' : 'War Room Timeline'}</h3>
              </div>
              <span className="badge badge--pill">{timeline.length} {ar ? 'سجل' : 'events'}</span>
            </div>

            {timeline.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {timeline.map((t: any) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      gap: 14,
                      padding: '10px 14px',
                      background: 'var(--surface-sunken)',
                      borderRadius: 8,
                      borderInlineStart: '4px solid var(--primary)',
                    }}
                  >
                    <div style={{ minWidth: 60, fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {String(t.created_at).slice(11, 16)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge badge--pill" style={{ fontSize: 11 }}>{t.entry_type}</span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.5 }}>{t.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', margin: 0 }}>{ar ? 'لا يوجد تحديثات في الخط الزمني بعد' : 'No timeline logs filed yet'}</p>
            )}
          </div>

          {/* Linked Failed Events */}
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Icon name="warning" size={18} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'الأحداث المتعثرة في الطابور (DLQ)' : 'Correlated DLQ Events'}</h3>
            </div>
            {failedEvents.length > 0 ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{ar ? 'المعرف' : 'Event ID'}</th>
                      <th>{ar ? 'النوع' : 'Event Type'}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {failedEvents.map((f: any) => (
                      <tr key={f.id}>
                        <td><code>{f.id.slice(0, 10)}...</code></td>
                        <td><span className="track-badge">{f.event_type}</span></td>
                        <td>
                          <Link className="button button--ghost button--small" to={adminPath(`failed-events/${f.id}`)}>
                            {ar ? 'فحص الحدث' : 'Inspect'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', margin: 0 }}>{ar ? 'لا أحداث متعثرة مرتبطة بهذا الحادث' : 'No DLQ events linked'}</p>
            )}
          </div>
        </div>

        {/* Sticky Incident War Room Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Incident Impact & Owner */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={16} />
              <span>{ar ? 'الأثر والمسؤولية' : 'Impact & Ownership'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'المسؤول المكلّف:' : 'Incident Commander:'}</span>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{data.owner_id || (ar ? 'غير معين' : 'Unassigned')}</div>
              </div>
              <div>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'الأثر التشغيلي:' : 'Operational Impact:'}</span>
                <div style={{ marginTop: 2, padding: '8px 10px', background: 'var(--surface-sunken)', borderRadius: 6 }}>
                  {data.impact || (ar ? 'لم يُسجل أثر تفصيلي' : 'No detailed impact statement')}
                </div>
              </div>
            </div>
          </div>

          {/* Linked Alerts */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="warning" size={16} />
              <span>{ar ? 'التنبيهات المسببة' : 'Triggering Alerts'}</span>
            </h4>
            {alerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map((a: any) => (
                  <div key={a.id} style={{ fontSize: 12, padding: '6px 10px', background: 'var(--surface-sunken)', borderRadius: 6 }}>
                    {a.condition_text}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{ar ? 'لا تنبيهات مباشرة مربوطة' : 'No triggering alerts'}</div>
            )}
          </div>

          {/* AI War Room Advisory */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'إرشادات غرفة الطوارئ' : 'War Room Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {data.status === 'open'
                ? (ar ? 'قم بتعيين مسؤول الحادث والانتقال إلى مرحلة التحقيق فوراً لتحديد النطاق المتأثر.' : 'Acknowledge incident and assign commander to begin active investigation.')
                : data.status === 'investigating'
                ? (ar ? 'افحص سجلات التغيير الأخيرة والأحداث المتعثرة في الطابور لعزل السبب الجذري.' : 'Audit recent deploys and correlated DLQ messages to isolate root cause.')
                : (ar ? 'راقب استقرار الخدمات المتأثرة قبل الإعلان عن الحل النهائي.' : 'Confirm service stability and error rate return to baseline before resolving.')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
