// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'

export function GrantDetailPage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const [grant, setGrant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.grants()
      const found = (res.data as any[]).find((g) => g.id === id)
      if (!found) throw new Error('Not found')
      setGrant(found)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!grant) return <EmptyState title="Grant not found" description={id} />

  const isHighRisk = ['publish', 'billing', 'manage_permissions'].some((k) => grant.role_id.includes(k))

  return (
    <div className="page-stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to={adminPath('grants')} className="table-secondary">
          المنح
        </Link>
        <span>/</span>
        <strong>{grant.id.slice(0, 8)}</strong>
      </div>

      <section className="panel" style={{ padding: 16 }}>
        <h2>
          Grant: {grant.role_name ?? grant.role_id} → {grant.grantee_id.slice(0, 8)}
          {isHighRisk ? <span className="status-badge status-badge--review" style={{ marginInlineStart: 8 }}>High-risk</span> : null}
        </h2>
        <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, marginTop: 12 }}>
          <dt>Subject</dt>
          <dd>
            {grant.grantee_type} <code dir="ltr">{grant.grantee_id}</code>
          </dd>
          <dt>Role</dt>
          <dd>{grant.role_name ?? grant.role_id}</dd>
          <dt>Scope</dt>
          <dd>
            <span className="track-badge">{grant.scope_type}</span> {grant.scope_id ?? '—'}
          </dd>
          <dt>Content type</dt>
          <dd>{grant.content_type ?? '—'}</dd>
          <dt>Languages</dt>
          <dd>{grant.language ?? '—'}</dd>
          <dt>Valid from</dt>
          <dd>{grant.valid_from?.slice(0, 10) ?? '—'}</dd>
          <dt>Expires</dt>
          <dd>{grant.valid_until?.slice(0, 10) ?? 'Permanent'}</dd>
          <dt>Source</dt>
          <dd>{grant.granted_by ?? '—'}</dd>
        </dl>
        <p className="table-secondary" style={{ fontSize: 12, marginTop: 12 }}>Effective permissions = Role + Scope + Content Type + Language + Validity — not global RBAC only. Least privilege default.</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="button button--danger button--small" type="button">
            Revoke (requires reason + impact preview)
          </button>
        </div>
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h3>History / Audit</h3>
        <p className="table-secondary">History for grant {grant.id} from audit_logs</p>
      </section>
    </div>
  )
}
