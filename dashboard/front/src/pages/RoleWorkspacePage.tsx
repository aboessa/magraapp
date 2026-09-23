import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: {
    back: 'الأدوار',
    overview: 'نظرة عامة',
    permissions: 'الصلاحيات',
    employees: 'الموظفون',
    teams: 'الفرق',
    grants: 'المنح النشطة',
    history: 'التغييرات',
    audit: 'التدقيق',
    risk: 'المخاطر',
    system: 'نظام',
    custom: 'مخصص',
    high: 'عالي',
    medium: 'متوسط',
    loadError: 'تعذر تحميل الدور',
  },
  en: {
    back: 'Roles',
    overview: 'Overview',
    permissions: 'Permissions',
    employees: 'Employees',
    teams: 'Teams',
    grants: 'Active grants',
    history: 'History',
    audit: 'Audit',
    risk: 'Risk',
    system: 'System',
    custom: 'Custom',
    high: 'High',
    medium: 'Medium',
    loadError: 'Unable to load role',
  },
}

export function RoleWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const text = copy[locale]
  const [role, setRole] = useState<any>(null)
  const [perms, setPerms] = useState<any[]>([])
  const [grants, setGrants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'permissions' | 'employees' | 'grants' | 'history'>('overview')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rRes, pRes, gRes] = await Promise.all([api.roles(), api.permissions(), api.grants()])
      const found = (rRes.data as any[]).find((r) => r.id === id)
      if (!found) throw new Error(text.loadError)
      setRole(found)
      setPerms(pRes.data as any[])
      setGrants((gRes.data as any[]).filter((g) => g.role_id === id))
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
  if (!role) return <EmptyState title={text.loadError} description={id} />

  const isSystem = role.is_system === 1
  const risk = role.id === 'owner' || role.id === 'system_admin' ? text.high : text.medium
  const permissionsList = role.permissions || []

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('roles')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{text.back}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {role.name_ar}
              </h1>
              <span className={`track-badge ${isSystem ? 'track-badge--archived' : ''}`}>
                {isSystem ? text.system : text.custom}
              </span>
              <span className="track-badge" style={{ background: risk === text.high ? '#fee2e2' : '#fef3c7' }}>
                {text.risk}: {risk}
              </span>
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }} dir="ltr">
              <code>{role.id}</code> · {role.id === 'reviewer' ? 'يراجع المحتوى المسند لكن لا ينشر.' : role.id === 'publisher' ? 'يمكنه اعتماد المحتوى المؤهل ونشره.' : ''}
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
            <span className="bento-glass-card__title">{ar ? 'الصلاحيات المضمنة' : 'Permissions'}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{permissionsList.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'إجراءات مصرح بها' : 'Authorized actions'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الممنوحون النشطون' : 'Active Grantees'}</span>
            <div className="bento-glass-card__icon"><Icon name="users" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{grants.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{ar ? 'موظفون وفرق' : 'Users & teams'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'مستوى المخاطر' : 'Risk Tier'}</span>
            <div className="bento-glass-card__icon"><Icon name="warning" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{risk}</div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${risk === text.high ? 'negative' : 'positive'}`}>
              {risk === text.high ? (ar ? 'تحتاج مصادقة ثنائية' : 'Step-up MFA') : (ar ? 'مخاطر قياسية' : 'Standard')}
            </span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'نوع الدور' : 'Role Origin'}</span>
            <div className="bento-glass-card__icon"><Icon name="lock" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>{isSystem ? text.system : text.custom}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{isSystem ? (ar ? 'دور نظامي محمي' : 'Immutable system role') : (ar ? 'مخصص' : 'Custom')}</span>
          </div>
        </article>
      </section>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, overflowX: 'auto' }}>
        {(['overview', 'permissions', 'employees', 'grants', 'history'] as const).map((t) => (
          <button
            key={t}
            className={`button ${tab === t ? 'button--primary' : 'button--ghost'} button--small`}
            onClick={() => setTab(t)}
          >
            {text[t] ?? t}
          </button>
        ))}
      </div>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'overview' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="grid" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.overview}</h3>
              </div>
              <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                <div>
                  <dt>الوصف</dt>
                  <dd>{role.id === 'reviewer' ? 'Reviews assigned content but cannot publish.' : role.id === 'publisher' ? 'Can approve and publish eligible content.' : '—'}</dd>
                </div>
                <div>
                  <dt>الصلاحيات</dt>
                  <dd><strong>{role.permissions_count ?? permissionsList.length}</strong></dd>
                </div>
                <div>
                  <dt>النظام</dt>
                  <dd><span className="track-badge">{isSystem ? text.system : text.custom}</span></dd>
                </div>
              </dl>
              <p className="table-secondary" style={{ fontSize: 12, marginTop: 14 }}>
                المفتاح التقني <code dir="ltr">{role.id}</code> ثانوي — الاسم المفهوم هو الأساس في الحوكمة.
              </p>
            </section>
          )}

          {tab === 'permissions' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="shield" size={18} />
                  <h3 style={{ margin: 0, fontSize: 16 }}>{text.permissions} ({permissionsList.length})</h3>
                </div>
                <span className="badge badge--pill">{permissionsList.length} actions</span>
              </div>

              <div className="table-scroll" tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>الصلاحية</th>
                      <th>المفتاح التقني</th>
                      <th>المخاطر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissionsList.map((pid: string) => {
                      const p = perms.find((x) => x.id === pid)
                      const isHigh = pid.includes('publish') || pid.includes('billing') || pid.includes('manage_permissions')
                      return (
                        <tr key={pid}>
                          <td><strong>{p?.description_ar ?? p?.action ?? pid}</strong></td>
                          <td dir="ltr"><code>{pid}</code></td>
                          <td>
                            <span className={`status-badge status-badge--${isHigh ? 'review' : 'draft'}`}>
                              {isHigh ? 'High' : 'Low'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'grants' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="users" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.grants} ({grants.length})</h3>
              </div>
              {grants.length ? (
                <div className="table-scroll" tabIndex={0}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>الممنوح له</th>
                        <th>النطاق</th>
                        <th>الصلاحية حتى</th>
                        <th>المصدر</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grants.map((g) => (
                        <tr key={g.id}>
                          <td>
                            <span className="badge badge--pill">{g.grantee_type}</span>{' '}
                            <code>{g.grantee_id.slice(0, 8)}</code>
                          </td>
                          <td>
                            <span className="track-badge">{g.scope_type}</span> {g.scope_id ?? 'Platform'}
                          </td>
                          <td>{g.valid_until ?? 'دائم'}</td>
                          <td>{g.granted_by ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="لا منح" description="—" />
              )}
            </section>
          )}

          {tab === 'history' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="clock" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.history}</h3>
              </div>
              <p className="table-secondary" style={{ fontSize: 13, margin: '0 0 16px' }}>
                سجل التغييرات — من audit_logs حيث entity_id={role.id}
              </p>
              <div style={{ padding: 10, background: 'var(--surface-sunken)', borderRadius: 6, fontSize: 12 }}>
                <code>role.policy_evaluated</code> · النظام مستقر
              </div>
            </section>
          )}
        </div>

        {/* Sticky Role Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Blast Radius Assessment */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="warning" size={16} />
              <span>{ar ? 'نطاق التأثير (Blast Radius)' : 'Blast Radius'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'صلاحيات حساسة:' : 'Sensitive Actions:'}</span>
                <strong style={{ color: risk === text.high ? 'var(--color-danger, #ef4444)' : 'inherit' }}>
                  {permissionsList.filter((p: string) => p.includes('publish') || p.includes('billing')).length}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'إجمالي المنح:' : 'Total Grantees:'}</span>
                <strong>{grants.length}</strong>
              </div>
            </div>
          </div>

          {/* AI Role Governance Copilot */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار حوكمة الأدوار' : 'RBAC Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {isSystem
                ? (ar ? 'هذا الدور دور نظامي محمي غير قابل للحذف لمنع شلل البنية التحتية الإدارية.' : 'System roles are protected against direct deletion to prevent catastrophic privilege deadlocks.')
                : (ar ? 'دور مخصص يمكن تعديل صلاحياته وإعادة تقييم المنح التابعة له.' : 'Custom role permits granular capability assignment and dynamic scope rebinding.')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
