// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
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
    diff: 'الفرق',
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
    diff: 'Diff',
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
  const text = copy[locale]
  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // AuditLogPage uses GET /admin/audit-logs?entity_id=... but we can fetch via auditLogs with filter and find id
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

  useEffect(() => { void load() }, [load])

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to={adminPath('audit-logs')} className="table-secondary">
          {text.back}
        </Link>
        <span>/</span>
        <strong>{record.id.slice(0, 8)}</strong>
      </div>

      <section className="panel" style={{ padding: 16 }}>
        <h2>{summary}</h2>
        <p className="table-secondary">{record.action} · {record.entity_type} · {new Date(record.created_at).toLocaleString(locale)}</p>
        <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginTop: 12 }}>
          <dt>{text.who}</dt>
          <dd dir="ltr">{record.actor_id ?? '—'}</dd>
          <dt>{text.when}</dt>
          <dd>{new Date(record.created_at).toLocaleString(locale)}</dd>
          <dt>{text.entity}</dt>
          <dd>
            {record.entity_type} <code dir="ltr">{record.entity_id}</code>
          </dd>
          <dt>{text.action}</dt>
          <dd>{record.action}</dd>
          <dt>{text.result}</dt>
          <dd>{(details as any).result ?? '—'}</dd>
        </dl>
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h3>{text.diff}</h3>
        {before || after ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <h4>{text.before}</h4>
              <pre style={{ background: 'var(--surface-2)', padding: 8, borderRadius: 8, fontSize: 12, overflow: 'auto' }}>{JSON.stringify(before ?? {}, null, 2)}</pre>
            </div>
            <div>
              <h4>{text.after}</h4>
              <pre style={{ background: 'var(--surface-2)', padding: 8, borderRadius: 8, fontSize: 12, overflow: 'auto' }}>{JSON.stringify(after ?? {}, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <p className="table-secondary">No before/after — technical metadata in next section.</p>
        )}
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h3>{text.technical}</h3>
        <pre style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 300 }} dir="ltr">
          {JSON.stringify(details, null, 2)}
        </pre>
        <p className="table-secondary" style={{ fontSize: 11, marginTop: 8 }}>Passwords/tokens redacted as [redacted] at source (auditLog.ts).</p>
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h3>{text.related}</h3>
        <p className="table-secondary">Related records for {record.entity_type} {record.entity_id}</p>
        <Link to={adminPath(`audit-logs?entity_type=${record.entity_type}&entity_id=${record.entity_id}`)} className="button button--ghost button--small">
          View all for this entity
        </Link>
      </section>
    </div>
  )
}
