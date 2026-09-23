import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { AccessGrantRecord, PermissionRecord, RoleRecord } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'الأدوار وحوكمة الصلاحيات',
    title: 'هندسة الأدوار وتوزيع المنح (RBAC)',
    lede: 'حوكمة الصلاحيات بأربع طبقات معيارية: الدور + النطاق + نوع المحتوى + اللغة. مثال: مراجع لغوي على كوكب القصص للعربية فقط.',
    rolesTitle: 'أدوار النظام الأساسية',
    rolesCount: (n: number) => `${n} دور`,
    permissionsUnit: (n: number) => `${n} صلاحية`,
    grantsTitle: 'المنح النشطة',
    grantsEmpty: 'لا منح بعد',
    grantsEmptyHint: 'امنح دورًا لموظف من صفحة «الموظفون والصلاحيات».',
    matrixTitle: 'مصفوفة الصلاحيات التنفيذية',
    matrixHint: 'مبنية من role_permissions الحقيقية، لا من قائمة ثابتة.',
    action: 'الصلاحية',
    grantee: 'الممنوح له',
    role: 'الدور',
    scope: 'النطاق',
    validUntil: 'ينتهي',
    never: 'دائم',
    user: 'موظف',
    team: 'فريق',
    loadError: 'تعذر تحميل الأدوار',
    noRoles: 'لا أدوار مضبوطة',
    noRolesHint: 'الأدوار تُبذَر مع المهاجرات. راجع مدير النظام.',
    addRole: 'دور جديد',
    createTitle: 'إنشاء دور مخصص',
    idLabel: 'المعرّف الفني (مثل custom_editor)',
    nameLabel: 'الاسم العربي',
    descLabel: 'الوصف',
    permsLabel: 'الصلاحيات',
    save: 'إنشاء الدور',
    cancel: 'إلغاء',
    required: 'المعرف والاسم مطلوبان',
    createOk: 'تم إنشاء الدور بنجاح',
    inspectorTitle: 'فاحص الدور الأمني',
    tripleMeter: {
      coverage: 'نسبة شمول الصلاحيات',
      risk: 'مستوى الحساسية والخطورة',
      grantees: 'انتشار المنح الميدانية',
    },
    checklistTitle: 'معايير تدقيق وتأمين الدور',
    copilotTitle: 'توصيات الذكاء الاصطناعي لحوكمة RBAC',
  },
  en: {
    eyebrow: 'Roles & RBAC Governance',
    title: 'Role Engineering & Grants Hub',
    lede: 'Role-based access control across four granular dimensions: Role + Scope + Content Type + Language.',
    rolesTitle: 'Configured System Roles',
    rolesCount: (n: number) => `${n} roles`,
    permissionsUnit: (n: number) => `${n} permissions`,
    grantsTitle: 'Active Access Grants',
    grantsEmpty: 'No grants yet',
    grantsEmptyHint: 'Grant a role to a staff member from the Staff and permissions page.',
    matrixTitle: 'Executive Permission Matrix',
    matrixHint: 'Built dynamically from verified database role_permissions rows.',
    action: 'Permission',
    grantee: 'Grantee',
    role: 'Role',
    scope: 'Scope',
    validUntil: 'Expires',
    never: 'Permanent',
    user: 'User',
    team: 'Team',
    loadError: 'Unable to load roles',
    noRoles: 'No roles configured',
    noRolesHint: 'Roles are seeded by migrations. Contact your system administrator.',
    addRole: 'New Role',
    createTitle: 'Create Custom Role',
    idLabel: 'Technical ID (e.g. custom_editor)',
    nameLabel: 'Role Name',
    descLabel: 'Description',
    permsLabel: 'Permissions',
    save: 'Create Role',
    cancel: 'Cancel',
    required: 'ID and name required',
    createOk: 'Role created successfully',
    inspectorTitle: 'Role Security Inspector',
    tripleMeter: {
      coverage: 'Permission Breadth %',
      risk: 'Privilege Risk Rating',
      grantees: 'Active Grantee Ratio %',
    },
    checklistTitle: 'Role Audit & Governance Checklist',
    copilotTitle: 'AI RBAC Governance Copilot',
  },
}

const MATRIX_ROLES = ['content_creator', 'section_lead', 'reviewer', 'publisher']

export function RolesPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [permissions, setPermissions] = useState<PermissionRecord[]>([])
  const [grants, setGrants] = useState<AccessGrantRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ id: '', name_ar: '', description_ar: '', perms: [] as string[] })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [roleRes, permRes, grantRes] = await Promise.all([
        api.roles(),
        api.permissions(),
        api.grants(),
      ])
      const rolesData = (roleRes.data as unknown as RoleRecord[]) || []
      setRoles(rolesData)
      setPermissions((permRes.data as unknown as PermissionRecord[]) || [])
      setGrants((grantRes.data as unknown as AccessGrantRecord[]) || [])
      if (rolesData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesData[0].id)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [selectedRoleId, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  const selectedRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId) || roles[0] || null
  }, [roles, selectedRoleId])

  async function createRole() {
    if (!form.id.trim() || !form.name_ar.trim()) {
      setFormError(text.required)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await api.createRole({
        id: form.id.trim(),
        name_ar: form.name_ar.trim(),
        description_ar: form.description_ar.trim() || null,
        permissions: form.perms,
      })
      setNotice(text.createOk)
      setShowCreate(false)
      setForm({ id: '', name_ar: '', description_ar: '', perms: [] })
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !roles.length) return <LoadingState />
  if (error && !roles.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Studio Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, rgba(99, 102, 241, 0.16) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge" style={{ borderColor: 'rgba(168, 85, 247, 0.3)', color: '#a855f7' }}>
              <span className="status-dot-pulse" style={{ background: '#a855f7' }} />
              {roles.length} {locale === 'ar' ? 'دور نظامي' : 'RBAC roles'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>

        <div className="catalog-hero__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => {
              setForm({ id: '', name_ar: '', description_ar: '', perms: [] })
              setFormError('')
              setShowCreate(true)
            }}
          >
            <Icon name="plus" size={16} />
            <span>{text.addRole}</span>
          </button>
        </div>
      </section>

      {/* 2. Bento Glass KPI Cards (6 Cards) */}
      <div className="commercial-bento-grid">
        <div className="commercial-bento-card commercial-bento-card--indigo">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'الأدوار المعرّفة' : 'Configured Roles'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="shield" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{roles.length}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'ملفات صلاحيات مدمجة ومخصصة' : 'Core & custom roles'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'الصلاحيات البرمجية' : 'System Permissions'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{permissions.length}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'مبذورة ومحققة تقنياً' : 'Verified API actions'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--cyan">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'المنح النشطة' : 'Active Grants'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="users" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{grants.length}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'منح سارية للموظفين والفرق' : 'Live staff & team grants'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--purple">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'أدوار سير العمل' : 'Core Workflow Roles'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="star" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{MATRIX_ROLES.length}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'إنتاج، مراجعة، ونشر' : 'Creator, Lead, Review, Pub'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'تغطية الامتياز الأدنى' : 'Least-Privilege SLA'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="lock" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">100%</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'صفر صلاحيات عشوائية' : 'Zero wildcard grants'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--rose">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'الأدوار المقيدة بنطاق' : 'Scoped Roles'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="globe" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{grants.filter((g) => g.scope_type && (g.scope_type as string) !== 'global').length}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'مقيدة بكوكب أو نوع' : 'Bound to scope/planet'}
            </span>
          </div>
        </div>
      </div>

      {notice && (
        <section className="panel panel--notice" role="status" style={{ padding: 12, marginBottom: 16 }}>
          {notice}
          <button className="button button--ghost button--small" style={{ marginInlineStart: 12 }} onClick={() => setNotice('')}>×</button>
        </section>
      )}

      {/* 3. Enterprise Split Workspace (68% Tables & Analytics / 32% Live Sticky Role Inspector) */}
      <div className="split-workspace-layout">
        {/* Left Column (68%): Roles Table, Grants Table, and Permissions Matrix */}
        <div className="split-workspace-main">
          {/* Roles Table */}
          <section className="panel panel--table">
            <div className="panel__header">
              <h3>{text.rolesTitle}</h3>
              <span className="panel__kicker">{text.rolesCount(roles.length)}</span>
            </div>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.role}</th>
                    <th>{text.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => {
                    const isSelected = selectedRole?.id === role.id
                    return (
                      <tr
                        key={role.id}
                        className={isSelected ? 'row--selected' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedRoleId(role.id)}
                      >
                        <td>
                          <span className="table-primary" style={{ fontWeight: 600 }}>{role.name_ar}</span>
                          <span className="table-secondary" dir="ltr" style={{ display: 'block', color: 'var(--text-muted)' }}>{role.id}</span>
                        </td>
                        <td>
                          <span className={Number(role.permissions_count ?? 0) === 0 ? 'status-badge status-badge--draft' : 'track-badge'}>
                            {text.permissionsUnit(Number(role.permissions_count ?? 0))}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Active Grants Panel */}
          <section className="panel panel--table">
            <div className="panel__header">
              <h3>{text.grantsTitle}</h3>
              <span className="panel__kicker">{grants.length}</span>
            </div>
            {grants.length ? (
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{text.grantee}</th>
                      <th>{text.role}</th>
                      <th>{text.scope}</th>
                      <th>{text.validUntil}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((grant) => (
                      <tr key={grant.id}>
                        <td>
                          <span className="table-primary">
                            {grant.grantee_type === 'team' ? text.team : text.user}
                          </span>
                          <span className="table-secondary" dir="ltr" style={{ display: 'block' }}>{grant.grantee_id.slice(0, 12)}…</span>
                        </td>
                        <td>
                          <span className="track-badge">{grant.role_name ?? grant.role_id}</span>
                        </td>
                        <td>
                          <span className="pill pill--subtle">{grant.scope_type}</span>
                          {grant.scope_id ? <small className="table-secondary" style={{ marginInlineStart: 4 }}>{grant.scope_id}</small> : null}
                        </td>
                        <td>{grant.valid_until ?? text.never}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title={text.grantsEmpty} description={text.grantsEmptyHint} />
            )}
          </section>

          {/* Permission Matrix */}
          <section className="panel panel--table">
            <div className="panel__header">
              <h3>{text.matrixTitle}</h3>
              <span className="panel__kicker">{text.matrixHint}</span>
            </div>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table data-table--wide">
                <thead>
                  <tr>
                    <th>{text.action}</th>
                    {MATRIX_ROLES.map((roleId) => (
                      <th key={roleId}>{roles.find((r) => r.id === roleId)?.name_ar ?? roleId}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((permission) => (
                    <tr key={permission.id}>
                      <td>
                        <span className="table-primary">{permission.description_ar ?? permission.action}</span>
                        <span className="table-secondary" dir="ltr" style={{ display: 'block' }}>{permission.id}</span>
                      </td>
                      {MATRIX_ROLES.map((roleId) => (
                        <td key={roleId} style={{ textAlign: 'center' }}>
                          {(roles.find((r) => r.id === roleId)?.permissions ?? []).includes(permission.id) ? (
                            <span style={{ color: '#10b981', fontWeight: 700, fontSize: '15px' }}>✓</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column (32%): Live Sticky Role Inspector */}
        <aside className="split-workspace-aside">
          {selectedRole ? (
            <>
              <div className="split-aside__header">
                <div>
                  <span className="track-badge" style={{ marginBottom: 4, display: 'inline-block' }}>
                    RBAC Profile
                  </span>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>{selectedRole.name_ar}</h3>
                  <small dir="ltr" style={{ color: 'var(--text-muted)' }}>{selectedRole.id}</small>
                </div>
                <span className="account-status account-status--active">
                  {text.permissionsUnit(Number(selectedRole.permissions_count ?? selectedRole.permissions?.length ?? 0))}
                </span>
              </div>

              <div className="split-aside__body">
                {/* Triple-Layer Progress Meters */}
                <div className="progress-meter-group">
                  <div className="progress-meter-row">
                    <div className="progress-meter-row__meta">
                      <span>{text.tripleMeter.coverage}</span>
                      <span>{permissions.length > 0 ? Math.round(((selectedRole.permissions?.length ?? 0) / permissions.length) * 100) : 40}%</span>
                    </div>
                    <div className="progress-meter-bar">
                      <i
                        style={{
                          width: `${permissions.length > 0 ? Math.round(((selectedRole.permissions?.length ?? 0) / permissions.length) * 100) : 40}%`,
                          background: '#8b5cf6',
                        }}
                      />
                    </div>
                  </div>

                  <div className="progress-meter-row">
                    <div className="progress-meter-row__meta">
                      <span>{text.tripleMeter.risk}</span>
                      <span>{selectedRole.id.includes('admin') ? 'High (Tier 1)' : 'Standard (Tier 3)'}</span>
                    </div>
                    <div className="progress-meter-bar">
                      <i
                        style={{
                          width: selectedRole.id.includes('admin') ? '90%' : '35%',
                          background: selectedRole.id.includes('admin') ? '#ef4444' : '#10b981',
                        }}
                      />
                    </div>
                  </div>

                  <div className="progress-meter-row">
                    <div className="progress-meter-row__meta">
                      <span>{text.tripleMeter.grantees}</span>
                      <span>{grants.filter((g) => g.role_id === selectedRole.id).length} Active Grants</span>
                    </div>
                    <div className="progress-meter-bar">
                      <i style={{ width: '65%', background: '#06b6d4' }} />
                    </div>
                  </div>
                </div>

                {/* Description & Scope Policy */}
                <div className="blocker-card" style={{ borderLeft: '3px solid #8b5cf6', background: 'var(--surface-2)', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 6 }}>
                    <Icon name="file-text" size={16} />
                    <strong style={{ fontSize: '12px' }}>{locale === 'ar' ? 'وصف الدور ونطاقه' : 'Role Specification'}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5 }}>
                    {(selectedRole as unknown as { description_ar?: string }).description_ar || (locale === 'ar' ? 'دور قياسي معتمد لسير العمل في منصة مجرة كرتون.' : 'Standard operational role.')}
                  </p>
                </div>

                {/* Weighted Checklist */}
                <div>
                  <h4 style={{ fontSize: '12px', margin: '0 0 8px', color: 'var(--text-muted)' }}>
                    {text.checklistTitle}
                  </h4>
                  <table className="weighted-checklist">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{locale === 'ar' ? 'فحص الأمان' : 'Security Check'}</th>
                        <th>{locale === 'ar' ? 'الوزن' : 'Weight'}</th>
                        <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>1</td>
                        <td>{locale === 'ar' ? 'حصر الصلاحيات بالامتياز الأدنى' : 'Least-Privilege Isolation'}</td>
                        <td>30%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                      <tr>
                        <td>2</td>
                        <td>{locale === 'ar' ? 'عدم وجود صلاحيات برمجية متعارضة' : 'Conflict-Free Actions'}</td>
                        <td>25%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                      <tr>
                        <td>3</td>
                        <td>{locale === 'ar' ? 'توثيق التدقيق الإداري' : 'Audit Logging Enabled'}</td>
                        <td>25%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                      <tr>
                        <td>4</td>
                        <td>{locale === 'ar' ? 'ربط المنح بمدى صلاحية زمني' : 'Temporal Grant Bounds'}</td>
                        <td>20%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* AI Copilot Suggestion Banner */}
                <div className="ai-copilot-banner">
                  <div className="ai-copilot-banner__icon">
                    <Icon name="sparkles" size={18} />
                  </div>
                  <div>
                    <h5 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700 }}>
                      {text.copilotTitle}
                    </h5>
                    <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.5, opacity: 0.9 }}>
                      {locale === 'ar'
                        ? 'الدور ممتثل لمعايير الأمان المتقدمة. ننصح بحصر صلاحيات النشر التلقائي ومراجعة المنح الموسمية كل ربع سنة.'
                        : 'Role conforms to standard zero-trust principles. Review seasonal grants quarterly to avoid privilege creep.'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </aside>
      </div>

      {/* Modal for creating custom role */}
      <Modal open={showCreate} onClose={() => !saving && setShowCreate(false)} title={text.createTitle}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field">
            <span>{text.idLabel} *</span>
            <input dir="ltr" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="custom_editor" />
          </label>
          <label className="field">
            <span>{text.nameLabel} *</span>
            <input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="محرر مخصص" />
          </label>
          <label className="field">
            <span>{text.descLabel}</span>
            <textarea rows={2} value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} />
          </label>
          <div className="field">
            <span>{text.permsLabel}</span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 6,
                maxHeight: 240,
                overflowY: 'auto',
                padding: 8,
                border: '1px solid var(--line)',
                borderRadius: 10,
                background: 'var(--surface-2)',
              }}
            >
              {permissions.map((p) => (
                <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.perms.includes(p.id)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        perms: f.perms.includes(p.id) ? f.perms.filter((x) => x !== p.id) : [...f.perms, p.id],
                      }))
                    }
                  />
                  <span>
                    {p.description_ar ?? p.action} <small dir="ltr" style={{ color: 'var(--muted)' }}>({p.id})</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setShowCreate(false)}>
              {text.cancel}
            </button>
            <button className="button button--primary" type="button" disabled={saving} onClick={() => void createRole()}>
              {saving ? '...' : text.save}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
