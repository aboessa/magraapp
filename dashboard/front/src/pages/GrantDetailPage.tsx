import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

export function GrantDetailPage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const ar = locale === 'ar'
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

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!grant) return <EmptyState title="Grant not found" description={id} />

  const isHighRisk = ['publish', 'billing', 'manage_permissions'].some((k) => grant.role_id?.includes(k))

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('grants')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{ar ? 'المنح' : 'Grants'}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {grant.role_name ?? grant.role_id} → {grant.grantee_id.slice(0, 8)}
              </h1>
              {isHighRisk && (
                <span className="status-badge status-badge--review">
                  {ar ? 'عالية المخاطر' : 'High-risk'}
                </span>
              )}
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              {ar ? `معرّف المنحة: ${grant.id} · النوع: ${grant.grantee_type}` : `Grant ID: ${grant.id} · Grantee: ${grant.grantee_type}`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="button button--danger button--small" type="button">
            <Icon name="warning" size={14} />
            <span>{ar ? 'سحب المنحة فوراً' : 'Revoke Grant'}</span>
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
            <span className="bento-glass-card__title">{ar ? 'الممنوح له' : 'Subject'}</span>
            <div className="bento-glass-card__icon"><Icon name="users" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>{grant.grantee_type}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral"><code>{grant.grantee_id.slice(0, 8)}</code></span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'نطاق التفويض' : 'Scope Model'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>{grant.scope_type}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{grant.scope_id || 'Platform'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الأفق الزمني' : 'Validity Horizon'}</span>
            <div className="bento-glass-card__icon"><Icon name="clock" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>
            {grant.valid_until ? grant.valid_until.slice(0, 10) : 'Permanent'}
          </div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${grant.valid_until ? 'positive' : 'neutral'}`}>
              {grant.valid_until ? (ar ? 'صلاحية مؤقتة ومحددة' : 'Time-bound') : (ar ? 'دائمة بلا انتهاء' : 'Permanent grant')}
            </span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'مستوى المخاطر' : 'Risk Assessment'}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>
            {isHighRisk ? 'High' : 'Normal'}
          </div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${isHighRisk ? 'negative' : 'positive'}`}>
              {isHighRisk ? (ar ? 'تتطلب رقابة إشرافية' : 'Audit enforced') : (ar ? 'مخاطر منخفضة' : 'Nominal')}
            </span>
          </div>
        </article>
      </section>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Grant 5-Tuple Specifications */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Icon name="shield" size={18} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'محددات المنحة الخماسية (5-Tuple Granular Policy)' : 'Granular Policy 5-Tuple'}</h3>
            </div>

            <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12 }}>
              <dt>Subject (الموضوع)</dt>
              <dd>
                <span className="badge badge--pill">{grant.grantee_type}</span> <code dir="ltr">{grant.grantee_id}</code>
              </dd>
              <dt>Role (الدور المسند)</dt>
              <dd><strong>{grant.role_name ?? grant.role_id}</strong></dd>
              <dt>Scope (النطاق)</dt>
              <dd>
                <span className="track-badge">{grant.scope_type}</span> {grant.scope_id ?? '—'}
              </dd>
              <dt>Content Type (نوع المحتوى)</dt>
              <dd>{grant.content_type ?? 'All'}</dd>
              <dt>Languages (اللغات)</dt>
              <dd>{grant.language ?? 'All languages'}</dd>
              <dt>Valid From (سارية من)</dt>
              <dd>{grant.valid_from?.slice(0, 10) ?? '—'}</dd>
              <dt>Expires (تنتهي في)</dt>
              <dd>{grant.valid_until?.slice(0, 10) ?? 'Permanent'}</dd>
              <dt>Source (المصدر / المانح)</dt>
              <dd>{grant.granted_by ?? 'System Root'}</dd>
            </dl>

            <div style={{ marginTop: 18, padding: 12, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <p className="table-secondary" style={{ fontSize: 12, margin: 0 }}>
                Effective permissions = Role + Scope + Content Type + Language + Validity — not global RBAC only. Least privilege default.
              </p>
            </div>
          </div>

          {/* Audit Log Panel */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon name="clock" size={18} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'سجل التدقيق والتغييرات' : 'History / Audit'}</h3>
            </div>
            <p className="table-secondary" style={{ fontSize: 13, margin: '0 0 14px' }}>
              History for grant {grant.id} from audit_logs
            </p>
            <div style={{ padding: 10, background: 'var(--surface-sunken)', borderRadius: 6, fontSize: 12 }}>
              <code>grant.evaluated</code> · النطاق مقيد ومفعل في الذاكرة التخزينية
            </div>
          </div>
        </div>

        {/* Sticky Grant Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Effective Capabilities */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={16} />
              <span>{ar ? 'القدرات الفعلية' : 'Effective Capability'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'تعديل البيانات:' : 'Data Mutation:'}</span>
                <span className="badge badge--pill">Allowed</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'اعتماد ونشر:' : 'Publishing:'}</span>
                <span className="badge badge--pill">{isHighRisk ? 'Yes' : 'Restricted'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'إدارة الوصول:' : 'Access Admin:'}</span>
                <span className="badge badge--pill">Restricted</span>
              </div>
            </div>
          </div>

          {/* AI Least Privilege Copilot */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'حوكمة الامتيازات الذكية' : 'Least-Privilege Guard'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {isHighRisk
                ? (ar ? 'تتضمن هذه المنحة صلاحيات حساسة على مستوى النشر أو الإدارة. يُنصح بوضع تاريخ انتهاء زمني ومراجعة دورية.' : 'High-risk capability requires strict validity windows and periodic re-certification.')
                : (ar ? 'منحة تشغيلية محدودة النطاق تتماشى تماماً مع سياسة الحد الأدنى من الصلاحيات.' : 'Scoped operational grant meets zero-trust security baselines.')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}