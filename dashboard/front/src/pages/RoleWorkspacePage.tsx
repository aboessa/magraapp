// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
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

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!role) return <EmptyState title={text.loadError} description={id} />

  const isSystem = role.is_system === 1
  const risk = role.id === 'owner' || role.id === 'system_admin' ? text.high : text.medium

  return (
    <div className="page-stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to={adminPath('roles')} className="table-secondary">
          {text.back}
        </Link>
        <span>/</span>
        <strong>{role.name_ar}</strong>
        <span className={`track-badge ${isSystem ? 'track-badge--archived' : ''}`}>{isSystem ? text.system : text.custom}</span>
        <span className="track-badge" style={{ background: risk === text.high ? '#fee2e2' : '#fef3c7' }}>
          {text.risk}: {risk}
        </span>
      </div>

      <section className="page-intro">
        <div>
          <span className="eyebrow">{role.id}</span>
          <h2>{role.name_ar}</h2>
          <p className="table-secondary">{role.id === 'reviewer' ? 'يراجع المحتوى المسند لكن لا ينشر.' : role.id === 'publisher' ? 'يمكنه اعتماد المحتوى المؤهل ونشره.' : ''}</p>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {(['overview', 'permissions', 'employees', 'grants', 'history'] as const).map((t) => (
          <button key={t} className={`button ${tab === t ? 'button--primary' : 'button--ghost'} button--small`} onClick={() => setTab(t)}>
            {text[t] ?? t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.overview}</h3>
          <dl className="detail-list">
            <div>
              <dt>الوصف</dt>
              <dd>{role.id === 'reviewer' ? 'Reviews assigned content but cannot publish.' : role.id === 'publisher' ? 'Can approve and publish eligible content.' : '—'}</dd>
            </div>
            <div>
              <dt>الصلاحيات</dt>
              <dd>{role.permissions_count ?? role.permissions?.length ?? 0}</dd>
            </div>
            <div>
              <dt>النظام</dt>
              <dd>{isSystem ? text.system : text.custom}</dd>
            </div>
          </dl>
          <p className="table-secondary" style={{ fontSize: 12, marginTop: 12 }}>المفتاح التقني <code dir="ltr">{role.id}</code> ثانوي — الاسم المفهوم هو الأساس.</p>
        </section>
      )}

      {tab === 'permissions' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.permissions}</h3>
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
                {(role.permissions ?? []).map((pid: string) => {
                  const p = perms.find((x) => x.id === pid)
                  return (
                    <tr key={pid}>
                      <td>{p?.description_ar ?? p?.action ?? pid}</td>
                      <td dir="ltr">
                        <code>{pid}</code>
                      </td>
                      <td>{pid.includes('publish') || pid.includes('billing') || pid.includes('manage_permissions') ? <span className="status-badge status-badge--review">High</span> : 'Low'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'grants' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.grants}</h3>
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
                        {g.grantee_type} {g.grantee_id.slice(0, 8)}
                      </td>
                      <td>
                        <span className="track-badge">{g.scope_type}</span> {g.scope_id ?? ''}
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
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.history}</h3>
          <p className="table-secondary">سجل التغييرات — من audit_logs حيث entity_id={role.id}</p>
        </section>
      )}
    </div>
  )
}
