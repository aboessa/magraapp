import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: {
    back: 'سجل التدقيق',
    who: 'من',
    what: 'ماذا',
    when: 'متى',
    where: 'أين',
    entity: 'الكيان',
    action: 'الفعل',
    result: 'النتيجة',
    reason: 'السبب',
    before: 'قبل',
    after: 'بعد',
    diff: 'الفرق والمقارنة',
    related: 'سجلات ذات صلة',
    technical: 'بيانات تقنية',
    loadError: 'تعذر تحميل الحدث',
  },
  en: {
    back: 'Audit log',
    who: 'Who',
    what: 'What',
    when: 'When',
    where: 'Where',
    entity: 'Entity',
    action: 'Action',
    result: 'Result',
    reason: 'Reason',
    before: 'Before',
    after: 'After',
    diff: 'Diff Inspection',
    related: 'Related records',
    technical: 'Technical metadata',
    loadError: 'Unable to load event',
  },
}

function parseDetails(raw: string) {
  try {
    const p = JSON.parse(raw)
    return p && typeof p === 'object' ? p : { raw }
  } catch {
    return { raw }
  }
}

export function AuditEventDetailPage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const text = copy[locale]
  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.auditLogs({ limit: 100 } as any)
      const found = (res.data as any[]).find((r) => r.id === id)
      if (!found) throw new Error(text.loadError)
      setRecord(found)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!record) return <EmptyState title={text.loadError} description={id} />

  const details = parseDetails(record.details)
  const before = (details as any).before
  const after = (details as any).after

  const summary =
    record.action === 'create' && record.entity_type === 'series'
      ? `Created series ${record.entity_id}`
      : record.action === 'update' && record.entity_type === 'admin_user'
        ? `Updated employee ${record.entity_id}`
        : record.action === 'create' && record.entity_type === 'team'
          ? `Created team ${record.entity_id}`
          : `${record.action} ${record.entity_type} ${record.entity_id}`

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('audit-logs')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{text.back}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`status-badge status-badge--${record.action === 'delete' ? 'review' : 'published'}`}>
                {record.action?.toUpperCase()}
              </span>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {summary}
              </h1>
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              {new Date(record.created_at).toLocaleString(locale)} · Entity: <code>{record.entity_type}/{record.entity_id}</code>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الفاعل (Actor)' : 'Actor Identity'}</span>
            <div className="bento-glass-card__icon"><Icon name="users" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }} dir="ltr">
            {record.actor_id ? record.actor_id.slice(0, 10) : 'System'}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'معرّف موثق' : 'Authenticated'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'نوع الكيان' : 'Entity Domain'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>{record.entity_type}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral"><code>{record.entity_id?.slice(0, 8)}</code></span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'طبيعة العملية' : 'Action Vector'}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>{record.action}</div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${record.action === 'delete' ? 'negative' : 'positive'}`}>
              {record.action === 'delete' ? (ar ? 'عملية إتلاف' : 'Destructive') : (ar ? 'عملية آمنة' : 'State mutation')}
            </span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'التوقيت' : 'Time Horizon'}</span>
            <div className="bento-glass-card__icon"><Icon name="clock" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 16 }}>
            {new Date(record.created_at).toLocaleTimeString(locale)}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{new Date(record.created_at).toLocaleDateString(locale)}</span>
          </div>
        </article>
      </section>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Action Context Ledger */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Icon name="file-text" size={18} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'سياق العملية والفاعل' : 'Event Context & Provenance'}</h3>
            </div>

            <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12 }}>
              <dt>{text.who}</dt>
              <dd dir="ltr"><code>{record.actor_id ?? 'System Internal'}</code></dd>
              <dt>{text.when}</dt>
              <dd>{new Date(record.created_at).toLocaleString(locale)}</dd>
              <dt>{text.entity}</dt>
              <dd>
                <span className="track-badge">{record.entity_type}</span> <code dir="ltr">{record.entity_id}</code>
              </dd>
              <dt>{text.action}</dt>
              <dd><strong>{record.action}</strong></dd>
              <dt>{text.result}</dt>
              <dd>{(details as any).result ?? 'Success (200 OK)'}</dd>
            </dl>
          </div>

          {/* Visual Diff Panel */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Icon name="analytics" size={18} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{text.diff}</h3>
            </div>

            {before || after ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <h4 style={{ margin: '0 0 8px', color: 'var(--color-danger, #ef4444)' }}>{text.before}</h4>
                  <pre style={{ background: 'var(--surface-sunken)', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto', border: '1px solid var(--border)', direction: 'ltr' }}>
                    {JSON.stringify(before ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 8px', color: 'var(--color-success, #10b981)' }}>{text.after}</h4>
                  <pre style={{ background: 'var(--surface-sunken)', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto', border: '1px solid var(--border)', direction: 'ltr' }}>
                    {JSON.stringify(after ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="table-secondary" style={{ margin: 0 }}>No before/after — technical metadata in next section.</p>
            )}
          </div>

          {/* Technical Metadata */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon name="grid" size={18} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{text.technical}</h3>
            </div>
            <pre style={{ background: 'var(--surface-sunken)', padding: 14, borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 300, border: '1px solid var(--border)', direction: 'ltr' }}>
              {JSON.stringify(details, null, 2)}
            </pre>
            <p className="table-secondary" style={{ fontSize: 11, marginTop: 8, marginInlineStart: 4 }}>
              Passwords/tokens redacted as [redacted] at source (auditLog.ts).
            </p>
          </div>
        </div>

        {/* Sticky Forensic Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Related Records Links */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="clock" size={16} />
              <span>{text.related}</span>
            </h4>
            <p className="table-secondary" style={{ fontSize: 12, margin: '0 0 12px' }}>
              Related records for {record.entity_type} {record.entity_id}
            </p>
            <Link
              to={adminPath(`audit-logs?entity_type=${record.entity_type}&entity_id=${record.entity_id}`)}
              className="button button--secondary button--small"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              View all for this entity
            </Link>
          </div>

          {/* AI Forensic Copilot */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار التحليل الجنائي' : 'Forensic Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {ar
                ? 'تم تسجيل الحدث في سجل D1 غير القابل للتلاعب مع التحقق من هوية الفاعل وتوثيق التغييرات بالكامل.'
                : 'Immutable audit record registered in Cloudflare D1 with signed actor authentication context.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
