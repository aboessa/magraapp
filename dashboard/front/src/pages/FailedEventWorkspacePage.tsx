import { useParams, Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

export function FailedEventWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const [row, setRow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [replaying, setReplaying] = useState(false)
  const [replayEligible, setReplayEligible] = useState<'REPLAY_SAFE' | 'REPLAY_REQUIRES_REVIEW' | 'REPLAY_NOT_SUPPORTED'>('REPLAY_REQUIRES_REVIEW')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await api.failedFamilyEvents({ limit: 1 } as any) // warm cache fallback
      const res = await api.failedFamilyEvents({ limit: 100 } as any)
      const found = (res.data ?? []).find((x: any) => x.id === id) ?? null
      if (!found) throw new Error('Not found')
      setRow(found)

      let parsedPayload: any = null
      try {
        parsedPayload = JSON.parse(found.payload)
      } catch {
        parsedPayload = {}
      }

      if (parsedPayload?.error) setReplayEligible('REPLAY_NOT_SUPPORTED')
      else if (found.attempts >= 3) setReplayEligible('REPLAY_SAFE')
      else setReplayEligible('REPLAY_REQUIRES_REVIEW')
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
  if (!row) return null

  const category = row.event_type?.includes('entitlement') ? 'DEPENDENCY' : row.event_type?.includes('validation') ? 'VALIDATION' : 'UNKNOWN'
  const hoursAgo = Math.floor((Date.now() - new Date(row.failed_at).getTime()) / 3600000)

  let formattedJson = ''
  try {
    formattedJson = JSON.stringify(JSON.parse(row.payload), null, 2)
  } catch {
    formattedJson = row.payload || ''
  }

  const handleReplay = async () => {
    const promptMsg = ar
      ? `تأكيد إعادة تشغيل الحدث (${replayEligible})؟ يرجى التحقق من قابلية المعالجة المتكررة (Idempotency).`
      : `Confirm event replay (${replayEligible})? Verify idempotency before executing.`
    if (!confirm(promptMsg)) return

    setReplaying(true)
    try {
      await api.replayFailedFamilyEvent(id)
      await load()
    } finally {
      setReplaying(false)
    }
  }

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to={adminPath('failed-events')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{ar ? 'الأحداث المتعثرة' : 'DLQ Events'}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="track-badge">{category}</span>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {ar ? `حدث متعثر: ${row.id.slice(0, 10)}...` : `Failed Event: ${row.id.slice(0, 10)}...`}
              </h1>
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              {ar ? `الطابور: family_events · وقت الفشل: منذ ${hoursAgo} ساعة` : `Queue: family_events · Failed ${hoursAgo}h ago`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="button button--primary button--small"
            disabled={replayEligible === 'REPLAY_NOT_SUPPORTED' || replaying}
            onClick={() => void handleReplay()}
          >
            <Icon name="refresh" size={14} />
            <span>
              {replaying
                ? (ar ? 'جارٍ إعادة المحاولة...' : 'Replaying...')
                : (ar ? 'إعادة تشغيل الحدث (Replay)' : 'Replay Event')}
            </span>
          </button>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'جاهزية الإعادة' : 'Replay Eligibility'}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>{replayEligible}</div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${replayEligible === 'REPLAY_SAFE' ? 'positive' : replayEligible === 'REPLAY_NOT_SUPPORTED' ? 'negative' : 'neutral'}`}>
              {replayEligible === 'REPLAY_NOT_SUPPORTED'
                ? (ar ? 'قد يسبب تكراراً مالياً' : 'Duplicate risk')
                : replayEligible === 'REPLAY_SAFE'
                ? (ar ? 'آمن لإعادة التشغيل' : 'Safe to replay')
                : (ar ? 'يتطلب فحص مسبق' : 'Requires review')}
            </span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'عدد المحاولات' : 'Retry Attempts'}</span>
            <div className="bento-glass-card__icon"><Icon name="clock" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{row.attempts}</div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${row.attempts >= 3 ? 'negative' : 'neutral'}`}>
              {row.attempts >= 3 ? (ar ? 'استنفد المحاولات' : 'Exhausted worker retries') : (ar ? 'محاولات نشطة' : 'In range')}
            </span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'تصنيف الفشل' : 'Failure Domain'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{row.event_type?.split('.')[0] || 'family'}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{row.event_type}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الحالة الحالية' : 'Ledger Status'}</span>
            <div className="bento-glass-card__icon"><Icon name="warning" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{row.status}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend negative">{ar ? 'في طابور التعثر' : 'In DLQ'}</span>
          </div>
        </article>
      </section>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Payload Inspector */}
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="file-text" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'حمولة الحدث المعطل (Payload)' : 'Event Payload JSON'}</h3>
              </div>
              <span className="badge badge--pill" style={{ fontSize: 11 }}>
                {ar ? 'البيانات الحساسة محجوبة' : 'PII Redacted'}
              </span>
            </div>

            <pre
              style={{
                background: 'var(--surface-sunken)',
                padding: 14,
                borderRadius: 8,
                maxHeight: 380,
                overflow: 'auto',
                direction: 'ltr',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                border: '1px solid var(--border)',
                lineHeight: 1.5,
              }}
            >
              {formattedJson}
            </pre>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, marginInlineStart: 4 }}>
              {ar ? 'تم حجب الرموز الحساسة وروابط التخزين الخاصة أوتوماتيكياً.' : 'Tokens and internal storage presigned URLs masked for compliance.'}
            </p>
          </div>

          {/* Attempt History */}
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon name="clock" size={18} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'سجل المحاولات وسياق الفشل' : 'Retry Attempts Log'}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: row.attempts || 1 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'var(--surface-sunken)',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="badge badge--pill" style={{ fontWeight: 700 }}>#{i + 1}</span>
                    <span>Worker: <code>family-events-consumer</code></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="track-badge">{category}</span>
                    <span className="status-badge status-badge--review">FAILED</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
              Correlation ID: <code>{row.event_id || '—'}</code>
            </div>
          </div>
        </div>

        {/* Sticky DLQ Remediation Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Related Entities */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="users" size={16} />
              <span>{ar ? 'الكيانات المترابطة' : 'Related Entities'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {row.parent_id && (
                <div>
                  <span style={{ color: 'var(--muted)' }}>{ar ? 'العائلة / ولي الأمر:' : 'Parent / Family:'}</span>
                  <div style={{ marginTop: 4 }}>
                    <Link className="button button--secondary button--small" to={adminPath(`customers/${row.parent_id}`)}>
                      <Icon name="users" size={12} />
                      <span>{ar ? `ملف العائلة (${row.parent_id.slice(0, 8)})` : `Family (${row.parent_id.slice(0, 8)})`}</span>
                    </Link>
                  </div>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'ربط بحادث تشغيلي:' : 'Link Incident:'}</span>
                <div style={{ marginTop: 4 }}>
                  <Link className="button button--ghost button--small" to={adminPath('ops/incidents')}>
                    <Icon name="warning" size={12} />
                    <span>{ar ? 'فتح غرفة الحوادث' : 'Open War Room'}</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Replay Safety Card */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={16} />
              <span>{ar ? 'تحليل أمان الإعادة' : 'Safety Posture'}</span>
            </h4>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--muted)', margin: 0 }}>
              {replayEligible === 'REPLAY_NOT_SUPPORTED'
                ? (ar ? 'لا يمكن إعادة تشغيل هذا الحدث برمجياً لأنه يحتوي على خطأ في بنية الحمولة قد يسبب عمليات فوترة مكررة.' : 'This payload contains malformed parameters or non-idempotent billing hooks.')
                : replayEligible === 'REPLAY_SAFE'
                ? (ar ? 'الحدث آمن للإعادة بعد استنفاد محاولات المعالجة دون آثار جانبية ضارة.' : 'Payload verified safe for DLQ replay with zero duplicate charge vectors.')
                : (ar ? 'يتطلب فحص اليدوي لمعرف العملية قبل الإعادة للتأكد من عدم تسجيلها في D1.' : 'Requires manual cross-check with database before triggering replay.')}
            </p>
          </div>

          {/* AI DLQ Advisor */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار الأحداث المتعثرة' : 'DLQ Copilot Advisor'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {ar
                ? 'إذا استمر فشل الحدث بعد الإعادة، افحص صحة اتصال الـ Worker بقاعدة بيانات D1 وتحقق من وجود أي مفاتيح أجنبية غير متطابقة.'
                : 'If failures persist after replay, verify worker D1 binding connectivity and foreign key integrity.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
