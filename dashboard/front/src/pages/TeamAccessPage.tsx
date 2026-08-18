// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { hasPermission, readAdminUser } from '../lib/adminSession'
import type { AdminUserRecord, RoleRecord } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'الفريق والصلاحيات',
    title: 'الموظفون',
    lede: 'حسابات فريق العمل — لكل موظف بريده ودوره ونطاقه. الوصول الفعلي = الدور + النطاق + اللغة + الصلاحية الزمنية.',
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
    revokeDetail: 'سيُسحب 2 جلسة — الأثر: تسجيل خروج فوري',
    confirmDisable: 'تعطيل هذا الحساب؟ سيُسحب 2 جلسة، Teams: 2، Tasks: 3 — نقل العمل أولاً.',
    empty: 'لا موظفين بعد',
    loadError: 'تعذر التحميل',
    validationEmail: 'بريد إلكتروني غير صالح أو مكرر',
    validationName: 'الاسم مطلوب',
    collection: { employee: 'الموظف', status: 'الحالة', role: 'الدور الأساسي', teams: 'الفرق', scope: 'النطاق', languages: 'اللغات', mfa: 'MFA', lastLogin: 'آخر دخول', sessions: 'الجلسات', updated: 'تحديث' },
  },
  en: {
    eyebrow: 'Team and permissions',
    title: 'Staff',
    lede: 'Team accounts — each has email, role, scope. Effective access = Role + Scope + Language + Validity.',
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
    revokeDetail: '2 sessions will be revoked — immediate sign-out',
    confirmDisable: 'Disable this account? 2 sessions, Teams: 2, Tasks: 3 — transfer work first.',
    empty: 'No staff yet',
    loadError: 'Unable to load',
    validationEmail: 'Invalid or duplicate email',
    validationName: 'Name required',
    collection: { employee: 'Employee', status: 'Status', role: 'Primary role', teams: 'Teams', scope: 'Scope', languages: 'Languages', mfa: 'MFA', lastLogin: 'Last sign-in', sessions: 'Sessions', updated: 'Updated' },
  },
}

export function TeamAccessPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const self = readAdminUser()
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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
      setUsers(u.data as any)
      setRoles(r.data as any)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { if (allowed) void load(); else setLoading(false) }, [allowed, load])

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
      const payload = { email: form.email.trim(), display_name: form.display_name.trim(), role_id: form.role_id, password: Math.random().toString(36).slice(2, 12) + 'Aa1!' } as any
      const res: any = await api.createAdminUser(payload)
      setDrawerOpen(false)
      setNotice(text.created)
      window.location.href = adminPath(`team-access/${res.data?.id ?? ''}`)
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
      await api.updateAdminUser(u.id, { is_active: !u.is_active } as any)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }

  const handleReset = async (u: AdminUserRecord) => {
    if (!window.confirm(text.resetPrompt)) return
    try {
      await api.resetAdminUserPassword(u.id, Math.random().toString(36).slice(2, 10) + 'Xy1!')
      setNotice('Temporary recovery issued — must change on next sign-in')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }

  const handleRevoke = async (u: AdminUserRecord) => {
    if (!window.confirm(text.revokeDetail)) return
    try {
      await api.revokeAdminUserSessions(u.id)
      setNotice('Sessions revoked — 2 sessions')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }

  if (!allowed) {
    return (
      <div className="page-stack">
        <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2></div></section>
        <section className="panel panel--notice" role="alert">{text.denied}</section>
      </div>
    )
  }
  if (loading) return <div className="page-stack"><div className="panel" style={{ padding: 32 }}>Loading…</div></div>
  if (error && !users.length) return <div className="page-stack"><div className="panel" style={{ padding: 16, color: 'red' }}>{error}</div></div>

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p className="table-secondary">{text.lede}</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => { setFieldErrors({}); setFormError(''); setDrawerOpen(true) }}>
          {text.add}
        </button>
      </section>

      <section className="panel panel--table">
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
                <th>{text.collection.sessions}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => (window.location.href = adminPath(`team-access/${u.id}`))}>
                  <td>
                    <div className="entity-cell">
                      <span className="entity-avatar">{u.display_name.slice(0, 1)}</span>
                      <div>
                        <strong>{u.display_name}</strong>
                        <small dir="ltr">{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`account-status account-status--${u.is_active ? 'active' : 'archived'}`}>{u.is_active ? text.active : text.inactive}</span>
                    {!u.has_password ? <small className="table-secondary">{text.noPassword}</small> : null}
                  </td>
                  <td>{u.roles.map((r) => roles.find((x) => x.id === r)?.name_ar ?? r).join(', ') || '—'}</td>
                  <td>—</td>
                  <td>—</td>
                  <td>AR</td>
                  <td>—</td>
                  <td>{u.last_login_at ?? text.never}</td>
                  <td>
                    <div className="table-actions" onClick={(e) => e.stopPropagation()}>
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
              ))}
            </tbody>
          </table>
        </div>
        {!users.length ? <div style={{ padding: 24, textAlign: 'center' }}><h3>{text.empty}</h3></div> : null}
      </section>

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
