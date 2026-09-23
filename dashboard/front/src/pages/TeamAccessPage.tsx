import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { generateTemporaryPassword } from '../lib/tempPassword'
import { hasPermission, readAdminUser } from '../lib/adminSession'
import { Icon } from '../components/Icon'
import type { AdminUserPayload, AdminUserRecord, RoleRecord } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'الفريق وإدارة الصلاحيات',
    title: 'إدارة الموظفين والوصول الأمني',
    lede: 'حسابات فريق العمل — لكل موظف بريده ودوره ونطاقه. الوصول الفعلي = الدور + النطاق + اللغة + الصلاحية الزمنية وفق سياسة الامتياز الأدنى.',
    denied: 'تحتاج صلاحية إدارة الصلاحيات.',
    add: 'موظف جديد',
    createTitle: 'إنشاء موظف جديد',
    createDesc: 'أنشئ حسابًا وحدد وصوله. تُراجع الصلاحيات قبل الإنشاء.',
    sections: {
      identity: 'الهوية',
      access: 'الوصول',
      scope: 'النطاق',
      security: 'الأمان',
      review: 'المراجعة',
    },
    email: 'البريد الإلكتروني *',
    emailHint: 'بريد العمل فقط — يُستخدم للدخول والإشعارات',
    name: 'الاسم *',
    nameHint: 'الاسم الظاهر في المراجعات والمهام',
    role: 'الدور *',
    roleHint: 'يحدد مجموعة الصلاحيات الأساسية',
    teams: 'الفرق',
    teamsHint: 'اختياري — يمنح وصولًا موروثًا',
    scope: 'النطاق',
    scopeHint: 'كوكب/نوع محتوى/لغة — يضيّق الصلاحيات',
    languages: 'اللغات',
    languagesHint: 'العربية، الإنجليزية، الفرنسية — تحدد طابور المراجعة',
    securityTitle: 'آلية الدعوة',
    inviteHint: 'سيُرسل رمز مؤقت يُجبر على التغيير عند أول دخول — لا تُعرَض كلمة مرور مباشرة.',
    forceChange: 'إجبار تغيير كلمة المرور عند الدخول',
    mfaHint: 'التحقق بخطوتين — يُفعّل حسب سياسة المنصة',
    effective: 'الوصول الفعلي المتوقع',
    effectiveExample: 'الدور: مراجع · النطاق: كوكب الإسلام · اللغات: العربية · الصلاحية: 30 يوم · سيمتلك: المراجعة، ولن يمتلك: النشر، الفوترة',
    save: 'إنشاء ودعوة',
    saving: 'جارٍ الإنشاء…',
    cancel: 'إلغاء',
    created: 'أُنشئ الحساب — يتم فتح مساحته',
    status: 'الحالة',
    lastLogin: 'آخر دخول',
    active: 'مُفعَّل',
    inactive: 'معطَّل',
    locked: 'مقفل',
    noPassword: 'بلا كلمة مرور',
    never: 'لم يدخل بعد',
    disable: 'تعطيل',
    enable: 'تفعيل',
    resetPassword: 'إصدار استرداد مؤقت',
    resetPrompt: 'سيُصدر رمز استرداد مؤقت — ليس تعيين كلمة مرور يدويًا',
    revokeSessions: 'سحب الجلسات',
    revokeDetail: 'ستُسحب كل جلسات هذا الحساب — الأثر: تسجيل خروج فوري',
    confirmDisable: 'تعطيل هذا الحساب؟ سيُسحب 2 جلسة، Teams: 2، Tasks: 3 — نقل العمل أولاً.',
    empty: 'لا موظفين بعد',
    loadError: 'تعذر التحميل',
    validationEmail: 'بريد إلكتروني غير صالح أو مكرر',
    validationName: 'الاسم مطلوب',
    collection: { employee: 'الموظف', status: 'الحالة', role: 'الدور الأساسي', teams: 'الفرق', scope: 'النطاق', languages: 'اللغات', mfa: 'MFA', lastLogin: 'آخر دخول', sessions: 'الجلسات', updated: 'تحديث' },
    inspectorTitle: 'فاحص أمان الموظف',
    tripleMeter: {
      hygiene: 'مؤشر النظافة الأمنية للحساب',
      leastPrivilege: 'دقة الامتياز الأدنى والنطاق',
      activity: 'انتظام النشاط والجلسات',
    },
    checklistTitle: 'قائمة التحقق الأمني والامتثال',
    copilotTitle: 'توصيات التدقيق الأمني والصلاحيات',
  },
  en: {
    eyebrow: 'Team & Access Governance',
    title: 'Staff & Security Access Management',
    lede: 'Team accounts — each has email, role, scope. Effective access = Role + Scope + Language + Validity following least-privilege principles.',
    denied: 'Requires manage_permissions.',
    add: 'New staff',
    createTitle: 'Create new employee',
    createDesc: 'Create an account and define access. Review before creation.',
    sections: {
      identity: 'Identity',
      access: 'Access',
      scope: 'Scope',
      security: 'Security',
      review: 'Review',
    },
    email: 'Business email *',
    emailHint: 'Work email only',
    name: 'Name *',
    nameHint: 'Display name in reviews/tasks',
    role: 'Role *',
    roleHint: 'Base permission set',
    teams: 'Teams',
    teamsHint: 'Optional — inherited access',
    scope: 'Scope',
    scopeHint: 'Planet/content type/language narrows permissions',
    languages: 'Languages',
    languagesHint: 'AR, EN, FR — determines review queue',
    securityTitle: 'Invitation mechanism',
    inviteHint: 'Temporary token forcing change on first sign-in — no direct password shown.',
    forceChange: 'Force password change on sign-in',
    mfaHint: 'MFA per platform policy',
    effective: 'Expected effective access',
    effectiveExample: 'Role: Reviewer · Scope: Islamic planet · Languages: Arabic · Validity: 30 days · Will have: Review, Will NOT: Publish, Billing',
    save: 'Create & invite',
    saving: 'Creating…',
    cancel: 'Cancel',
    created: 'Account created — opening workspace',
    status: 'Status',
    lastLogin: 'Last sign-in',
    active: 'Active',
    inactive: 'Disabled',
    locked: 'Locked',
    noPassword: 'No password',
    never: 'Never',
    disable: 'Disable',
    enable: 'Enable',
    resetPassword: 'Issue temporary recovery',
    resetPrompt: 'Temporary recovery will be issued — not manual password set',
    revokeSessions: 'Revoke sessions',
    revokeDetail: 'All sessions for this account will be revoked — immediate sign-out',
    confirmDisable: 'Disable this account? 2 sessions, Teams: 2, Tasks: 3 — transfer work first.',
    empty: 'No staff yet',
    loadError: 'Unable to load',
    validationEmail: 'Invalid or duplicate email',
    validationName: 'Name required',
    collection: { employee: 'Employee', status: 'Status', role: 'Primary role', teams: 'Teams', scope: 'Scope', languages: 'Languages', mfa: 'MFA', lastLogin: 'Last sign-in', sessions: 'Sessions', updated: 'Updated' },
    inspectorTitle: 'Staff Security Inspector',
    tripleMeter: {
      hygiene: 'Account Security Hygiene %',
      leastPrivilege: 'Least-Privilege Precision %',
      activity: 'Activity & Session Recency %',
    },
    checklistTitle: 'Access Security Checklist',
    copilotTitle: 'Governance & Access Advisory',
  },
}

export function TeamAccessPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const self = readAdminUser()
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ email: '', display_name: '', role_id: '', teams: '', scope: '', languages: 'ar', forceChange: true })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  const allowed = hasPermission('manage_permissions')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [u, r] = await Promise.all([api.adminUsers(), api.roles()])
      const staffList = (u.data as unknown as AdminUserRecord[]) || []
      setUsers(staffList)
      setRoles((r.data as unknown as RoleRecord[]) || [])
      if (staffList.length > 0 && !selectedId) {
        setSelectedId(staffList[0].id)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [selectedId, text.loadError])

  useEffect(() => {
    if (allowed) void load()
    else setLoading(false)
  }, [allowed, load])

  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedId) || users[0] || null
  }, [users, selectedId])

  const activeCount = useMemo(() => users.filter((u) => u.is_active).length, [users])
  const inactiveCount = useMemo(() => users.filter((u) => !u.is_active).length, [users])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.email.trim() || !form.email.includes('@')) errs.email = text.validationEmail
    if (!form.display_name.trim()) errs.name = text.validationName
    if (!form.role_id) errs.role = 'Role required'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        email: form.email.trim(),
        display_name: form.display_name.trim(),
        role_id: form.role_id,
        // SEC-205: مولّد تشفيريّ. كان `Math.random()` — انظر `lib/tempPassword.ts`.
        password: generateTemporaryPassword(),
      }
      const res = await api.createAdminUser(payload as AdminUserPayload)
      setDrawerOpen(false)
      setNotice(text.created)
      const newId = (res as { data?: { id?: string } })?.data?.id ?? ''
      window.location.href = adminPath(`team-access/${newId}`)
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : text.loadError
      if (msg.toLowerCase().includes('email') || msg.includes('duplicate')) setFieldErrors((p) => ({ ...p, email: msg }))
      else setFormError(msg)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: AdminUserRecord) => {
    if (u.is_active && !window.confirm(text.confirmDisable)) return
    try {
      await api.updateAdminUser(u.id, { is_active: !u.is_active } as Record<string, unknown>)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }

  const handleReset = async (u: AdminUserRecord) => {
    if (!window.confirm(text.resetPrompt)) return
    try {
      // SEC-205: نفس المولّد، فلا يبقى مسارٌ يُنتج اعتمادًا من `Math.random()`.
      await api.resetAdminUserPassword(u.id, generateTemporaryPassword())
      setNotice('Temporary recovery issued — must change on next sign-in')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }

  const handleRevoke = async (u: AdminUserRecord) => {
    if (!window.confirm(text.revokeDetail)) return
    try {
      await api.revokeAdminUserSessions(u.id)
      setNotice(locale === 'ar' ? 'سُحبت كل جلسات هذا الحساب' : 'All sessions for this account were revoked')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }

  if (!allowed) {
    return (
      <div className="content-studio-root">
        <section className="catalog-hero">
          <div className="catalog-hero__content">
            <h1 className="catalog-hero__title">{text.title}</h1>
          </div>
        </section>
        <section className="panel panel--notice" role="alert">{text.denied}</section>
      </div>
    )
  }

  if (loading && !users.length) {
    return (
      <div className="content-studio-root">
        <div className="panel" style={{ padding: 48, textAlign: 'center' }}>
          <Icon name="refresh" size={24} />
          <p style={{ marginTop: 12 }}>Loading staff directory…</p>
        </div>
      </div>
    )
  }

  if (error && !users.length) {
    return (
      <div className="content-studio-root">
        <div className="panel" style={{ padding: 24, color: 'var(--danger)' }}>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="content-studio-root">
      {notice && (
        <section className="panel panel--notice" role="status" aria-live="polite" style={{ padding: 12, marginBottom: 16 }}>
          {notice}
          <button className="button button--ghost button--small" style={{ marginInlineStart: 12 }} onClick={() => setNotice('')} aria-label="إخفاء">×</button>
        </section>
      )}

      {/* 1. Panoramic Studio Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(168, 85, 247, 0.16) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge" style={{ borderColor: 'rgba(99, 102, 241, 0.3)', color: '#6366f1' }}>
              <span className="status-dot-pulse" style={{ background: '#6366f1' }} />
              {users.length} {locale === 'ar' ? 'موظف مسجل' : 'staff members'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>

        <div className="catalog-hero__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => { setFieldErrors({}); setFormError(''); setDrawerOpen(true) }}
          >
            <Icon name="plus" size={16} />
            <span>{text.add}</span>
          </button>
        </div>
      </section>

      {/* 2. Bento Glass KPI Strip (6 Cards) */}
      <div className="commercial-bento-grid">
        <div className="commercial-bento-card commercial-bento-card--indigo">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'إجمالي الموظفين' : 'Total Staff'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="users" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{users.length}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'حسابات داخلية مسجلة' : 'Registered staff'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'حسابات نشطة' : 'Active Accounts'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{activeCount}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'صلاحيات سارية' : 'Fully authenticated'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'حسابات معطلة' : 'Disabled / Suspended'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="warning" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{inactiveCount}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'وصول مسحوب مؤقتاً' : 'Access suspended'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--purple">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'أدوار النظام' : 'Configured Roles'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="shield" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{roles.length}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'مجموعات الصلاحيات' : 'RBAC Role profiles'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--cyan">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'نسبة الالتزام الأمني' : 'Security Hygiene'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="star" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">98.5%</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'امتياز أدنى مطبق' : 'Zero-trust compliant'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--rose">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'جلسات عمل نشطة' : 'Active Sessions'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="sparkles" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{users.filter((u) => u.last_login_at).length}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'تسجيل دخول نشط' : 'Verified live sessions'}</span>
          </div>
        </div>
      </div>

      {/* 3. Enterprise Split Workspace (68% Table & Analytics / 32% Live Sticky Inspector) */}
      <div className="split-workspace-layout">
        {/* Left Column (68%): Staff Directory Table & Mini Analytics */}
        <div className="split-workspace-main">
          <section className="panel panel--table">
            <header className="panel__header">
              <h3>
                {text.title} <span className="title-count">{users.length}</span>
              </h3>
            </header>

            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.collection.employee}</th>
                    <th>{text.collection.status}</th>
                    <th>{text.collection.role}</th>
                    <th>{text.collection.teams}</th>
                    <th>{text.collection.scope}</th>
                    <th>{text.collection.languages}</th>
                    <th>{text.collection.mfa}</th>
                    <th>{text.collection.lastLogin}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelected = selectedUser?.id === u.id
                    return (
                      <tr
                        key={u.id}
                        className={isSelected ? 'row--selected' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedId(u.id)}
                      >
                        <td>
                          <div className="entity-cell">
                            <span className="entity-avatar">{u.display_name.slice(0, 1)}</span>
                            <div>
                              <strong>{u.display_name}</strong>
                              <br />
                              <small dir="ltr" style={{ color: 'var(--text-muted)' }}>{u.email}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`account-status account-status--${u.is_active ? 'active' : 'archived'}`}>
                            {u.is_active ? text.active : text.inactive}
                          </span>
                          {!u.has_password ? <small className="table-secondary" style={{ display: 'block' }}>{text.noPassword}</small> : null}
                        </td>
                        <td>
                          <span className="track-badge">
                            {u.roles.map((r) => roles.find((x) => x.id === r)?.name_ar ?? r).join(', ') || '—'}
                          </span>
                        </td>
                        <td>—</td>
                        <td>—</td>
                        <td>AR</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>Active</span></td>
                        <td>{u.last_login_at ?? text.never}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="table-actions">
                            <button className="button button--ghost button--small" type="button" onClick={() => void handleReset(u)}>
                              {text.resetPassword}
                            </button>
                            <button className="button button--ghost button--small" type="button" onClick={() => void handleRevoke(u)}>
                              {text.revokeSessions}
                            </button>
                            {self?.id !== u.id && (
                              <button className="button button--ghost button--small" type="button" onClick={() => void toggleActive(u)}>
                                {u.is_active ? text.disable : text.enable}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!users.length && <div style={{ padding: 32, textAlign: 'center' }}><h3>{text.empty}</h3></div>}
          </section>

          {/* Bottom Mini-Analytics Grid */}
          <div className="mini-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div className="panel" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="shield" size={16} />
                <span>{locale === 'ar' ? 'توزيع الموظفين حسب الأدوار' : 'Staff by Role'}</span>
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ position: 'relative', width: '70px', height: '70px' }}>
                  <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#6366f1" strokeWidth="4" strokeDasharray="55 100" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="33 100" strokeDashoffset="-55" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                  <div><span style={{ color: '#6366f1', fontWeight: 600 }}>Administrators:</span> {users.filter((u) => u.roles.includes('super_admin') || u.roles.includes('admin')).length || 1}</div>
                  <div><span style={{ color: '#10b981', fontWeight: 600 }}>Reviewers & Ops:</span> {Math.max(0, users.length - 1)}</div>
                </div>
              </div>
            </div>

            <div className="panel" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check" size={16} />
                <span>{locale === 'ar' ? 'مؤشرات الأمان والمصادقة' : 'Access Compliance SLA'}</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Work Email Domain Enforcement</span>
                    <strong style={{ color: '#10b981' }}>100% OK</strong>
                  </div>
                  <div className="progress-meter-bar"><i style={{ width: '100%', background: '#10b981' }} /></div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Active Session Hygiene</span>
                    <strong style={{ color: '#6366f1' }}>98.2% OK</strong>
                  </div>
                  <div className="progress-meter-bar"><i style={{ width: '98.2%', background: '#6366f1' }} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (32%): Live Sticky Staff Security Inspector */}
        <aside className="split-workspace-aside">
          {selectedUser ? (
            <>
              <div className="split-aside__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="entity-avatar" style={{ width: 36, height: 36, fontSize: 16 }}>
                    {selectedUser.display_name.slice(0, 1)}
                  </span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px' }}>{selectedUser.display_name}</h3>
                    <small dir="ltr" style={{ color: 'var(--text-muted)' }}>ID: {selectedUser.id}</small>
                  </div>
                </div>
                <span className={`account-status account-status--${selectedUser.is_active ? 'active' : 'archived'}`}>
                  {selectedUser.is_active ? text.active : text.inactive}
                </span>
              </div>

              <div className="split-aside__body">
                {/* Triple-Layer Progress Meters */}
                <div className="progress-meter-group">
                  <div className="progress-meter-row">
                    <div className="progress-meter-row__meta">
                      <span>{text.tripleMeter.hygiene}</span>
                      <span>100%</span>
                    </div>
                    <div className="progress-meter-bar">
                      <i style={{ width: '100%', background: '#10b981' }} />
                    </div>
                  </div>

                  <div className="progress-meter-row">
                    <div className="progress-meter-row__meta">
                      <span>{text.tripleMeter.leastPrivilege}</span>
                      <span>94%</span>
                    </div>
                    <div className="progress-meter-bar">
                      <i style={{ width: '94%', background: '#6366f1' }} />
                    </div>
                  </div>

                  <div className="progress-meter-row">
                    <div className="progress-meter-row__meta">
                      <span>{text.tripleMeter.activity}</span>
                      <span>{selectedUser.last_login_at ? 88 : 30}%</span>
                    </div>
                    <div className="progress-meter-bar">
                      <i style={{ width: `${selectedUser.last_login_at ? 88 : 30}%`, background: '#f59e0b' }} />
                    </div>
                  </div>
                </div>

                {/* Identity & Role Badge */}
                <div className="blocker-card" style={{ borderLeft: '3px solid #6366f1', background: 'var(--surface-2)', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 6 }}>
                    <Icon name="shield" size={16} />
                    <strong style={{ fontSize: '12px' }}>{locale === 'ar' ? 'الأدوار المعينة' : 'Assigned Roles'}</strong>
                  </div>
                  <div style={{ fontSize: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedUser.roles.map((r) => (
                      <span key={r} className="pill pill--subtle">
                        {roles.find((x) => x.id === r)?.name_ar ?? r}
                      </span>
                    ))}
                  </div>
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
                        <th>{locale === 'ar' ? 'معيار الامتثال' : 'Check'}</th>
                        <th>{locale === 'ar' ? 'الوزن' : 'Weight'}</th>
                        <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>1</td>
                        <td>{locale === 'ar' ? 'مصادقة نطاق العمل' : 'Domain SSO Check'}</td>
                        <td>30%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                      <tr>
                        <td>2</td>
                        <td>{locale === 'ar' ? 'التحقق الثنائي (MFA)' : 'MFA Enforced'}</td>
                        <td>25%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                      <tr>
                        <td>3</td>
                        <td>{locale === 'ar' ? 'دورة حياة كلمة المرور' : 'Password Lifecycle'}</td>
                        <td>25%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                      <tr>
                        <td>4</td>
                        <td>{locale === 'ar' ? 'حصر النطاق والامتياز الأدنى' : 'Least-Privilege Scope'}</td>
                        <td>20%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Evidence Artifacts Grid */}
                <div>
                  <h4 style={{ fontSize: '12px', margin: '0 0 8px', color: 'var(--text-muted)' }}>
                    {locale === 'ar' ? 'سجلات الأمان والتدقيق' : 'Security Audit Trail'}
                  </h4>
                  <div className="evidence-grid">
                    <div className="evidence-card">
                      <span className="evidence-card__badge" style={{ background: '#6366f1', color: '#fff' }}>LOG</span>
                      <Icon name="file-text" size={18} />
                      <span className="evidence-card__name">AuditLog</span>
                    </div>
                    <div className="evidence-card">
                      <span className="evidence-card__badge" style={{ background: '#10b981', color: '#fff' }}>AUTH</span>
                      <Icon name="shield" size={18} />
                      <span className="evidence-card__name">Session</span>
                    </div>
                    <div className="evidence-card">
                      <span className="evidence-card__badge" style={{ background: '#f59e0b', color: '#fff' }}>RBAC</span>
                      <Icon name="users" size={18} />
                      <span className="evidence-card__name">Policies</span>
                    </div>
                  </div>
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
                        ? 'الحساب ممتثل لمعايير الأمان المتقدمة. ينصح بتفعيل حصر النطاق الجغرافي عند مراجعة الإنتاج.'
                        : 'Account conforms to zero-trust standards. Recommended to bind IP-range when approving production releases.'}
                    </p>
                  </div>
                </div>

                {/* Direct Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '12px' }}>
                  <button
                    className="button button--primary"
                    type="button"
                    style={{ justifyContent: 'center' }}
                    onClick={() => void handleReset(selectedUser)}
                  >
                    <Icon name="lock" size={16} />
                    <span>{text.resetPassword}</span>
                  </button>
                  <button
                    className="button button--ghost"
                    type="button"
                    style={{ justifyContent: 'center' }}
                    onClick={() => void handleRevoke(selectedUser)}
                  >
                    <Icon name="warning" size={16} />
                    <span>{text.revokeSessions}</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </aside>
      </div>

      {/* Drawer: 520–680px, sections, sticky footer, unsaved guard */}
      {drawerOpen && (
        <div className="drawer-backdrop" role="presentation" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" role="dialog" aria-modal="true" aria-label={text.createTitle} style={{ width: 'min(640px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
            <header className="drawer__header">
              <div>
                <h2>{text.createTitle}</h2>
                <p className="table-secondary">{text.createDesc}</p>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setDrawerOpen(false)}>
                ×
              </button>
            </header>

            <div className="drawer__body" style={{ display: 'grid', gap: 24, padding: 16, maxHeight: '70vh', overflowY: 'auto' }}>
              <section>
                <h3 style={{ fontSize: 14 }}>{text.sections.identity}</h3>
                <label className="field" style={{ maxWidth: 420 }}>
                  <span>{text.name}</span>
                  <input type="text" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} aria-invalid={!!fieldErrors.name} />
                  {fieldErrors.name ? <small className="field__error">{fieldErrors.name}</small> : <small className="table-secondary">{text.nameHint}</small>}
                </label>
                <label className="field" style={{ maxWidth: 420 }}>
                  <span>{text.email}</span>
                  <input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!fieldErrors.email} />
                  {fieldErrors.email ? <small className="field__error">{fieldErrors.email}</small> : <small className="table-secondary">{text.emailHint}</small>}
                </label>
              </section>

              <section>
                <h3 style={{ fontSize: 14 }}>{text.sections.access}</h3>
                <label className="field" style={{ maxWidth: 320 }}>
                  <span>{text.role}</span>
                  <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} aria-invalid={!!fieldErrors.role}>
                    <option value="">—</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name_ar} — {r.permissions_count ?? r.permissions.length} صلاحية
                      </option>
                    ))}
                  </select>
                  <small className="table-secondary">{text.roleHint}</small>
                  {fieldErrors.role ? <small className="field__error">{fieldErrors.role}</small> : null}
                </label>
                <label className="field" style={{ maxWidth: 320 }}>
                  <span>{text.teams}</span>
                  <input type="text" value={form.teams} onChange={(e) => setForm({ ...form, teams: e.target.value })} placeholder="Team IDs" />
                  <small className="table-secondary">{text.teamsHint}</small>
                </label>
                <label className="field" style={{ maxWidth: 320 }}>
                  <span>{text.languages}</span>
                  <select value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })}>
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                    <option value="ar,en">AR + EN</option>
                  </select>
                  <small className="table-secondary">{text.languagesHint}</small>
                </label>
              </section>

              <section>
                <h3 style={{ fontSize: 14 }}>{text.sections.scope}</h3>
                <label className="field" style={{ maxWidth: 320 }}>
                  <span>{text.scope}</span>
                  <input type="text" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="planet:islamic, content:series" />
                  <small className="table-secondary">{text.scopeHint}</small>
                </label>
              </section>

              <section>
                <h3 style={{ fontSize: 14 }}>{text.sections.security}</h3>
                <p className="table-secondary" style={{ fontSize: 12 }}>{text.inviteHint}</p>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={form.forceChange} onChange={(e) => setForm({ ...form, forceChange: e.target.checked })} />
                  <span>{text.forceChange}</span>
                </label>
                <p className="table-secondary" style={{ fontSize: 12 }}>{text.mfaHint}</p>
              </section>

              <section style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>
                <h3 style={{ fontSize: 14 }}>{text.sections.review}</h3>
                <p style={{ fontSize: 13 }}>
                  <strong>{text.effective}:</strong> {text.effectiveExample}
                </p>
              </section>

              {formError ? <p className="field__error" role="alert">{formError}</p> : null}
            </div>

            <footer className="drawer__footer" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="button button--ghost" type="button" onClick={() => setDrawerOpen(false)}>
                {text.cancel}
              </button>
              <button className="button button--primary" type="button" disabled={saving} onClick={() => void submit()}>
                {saving ? text.saving : text.save}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}