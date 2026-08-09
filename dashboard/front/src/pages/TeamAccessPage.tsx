import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { hasPermission, readAdminUser } from '../lib/adminSession'
import type { AdminUserRecord, RoleRecord } from '../types/api'

/**
 * إدارة الموظفين والصلاحيات.
 *
 * ## الثغرة التي تسدّها هذه الصفحة
 *
 * جدول `admin_users` والأدوار و`access_grants` موجودة من المهاجرة 0014، لكن
 * **لم يكن هناك أي واجهة ولا مسار يُنشئ موظفًا**. فكانت المفاتيح الأجنبية في
 * `team_members` و`tasks` و`comments` تشير إلى جدول لا يمكن الإضافة إليه، وكان
 * الدخول للوحة بمفتاح واحد مشترك بلا هوية.
 *
 * ## من يرى هذه الصفحة
 *
 * صلاحية `manage_permissions` فقط، وهي للمالك ومدير النظام. غيرهما يرى رسالة
 * لا نموذجًا معطّلًا: إظهار أزرار لا تعمل أسوأ من عدم إظهارها.
 */

const copy = {
  ar: {
    eyebrow: 'الفريق والصلاحيات',
    title: 'الموظفون',
    lede: 'حسابات فريق العمل: لكل موظف بريده وكلمة مروره ودوره. الأدوار تحدّد ما يستطيع فعله، وسجل التدقيق يسجّل التعديلات بهويته الحقيقية.',
    denied: 'تحتاج صلاحية إدارة الصلاحيات لعرض هذه الصفحة. راجع مالك المنصّة.',
    add: 'موظف جديد',
    email: 'البريد الإلكتروني',
    name: 'الاسم',
    role: 'الدور',
    password: 'كلمة مرور مؤقتة',
    passwordHint: 'عشرة أحرف على الأقل. سيُطلب من الموظف تغييرها عند أول دخول.',
    status: 'الحالة',
    lastLogin: 'آخر دخول',
    active: 'مُفعَّل',
    inactive: 'معطَّل',
    locked: 'مقفل مؤقتًا',
    noPassword: 'بلا كلمة مرور',
    never: 'لم يدخل بعد',
    save: 'إنشاء',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    created: 'أُنشئ الحساب',
    disable: 'تعطيل',
    enable: 'تفعيل',
    resetPassword: 'إعادة ضبط كلمة المرور',
    resetPrompt: 'كلمة المرور الجديدة (عشرة أحرف على الأقل)',
    resetDone: 'أُعيد ضبط كلمة المرور وسُحبت كل جلسات الحساب',
    revokeSessions: 'سحب الجلسات',
    revoked: 'سُحبت كل جلسات الحساب',
    you: 'أنت',
    empty: 'لا موظفين بعد',
    emptyHint: 'أضف أول موظف ليتمكّن من الدخول بحسابه بدل المفتاح المشترك.',
    roles: 'الأدوار',
    actions: 'إجراءات',
    confirmDisable: 'تعطيل هذا الحساب؟ ستُسحب كل جلساته فورًا.',
  },
  en: {
    eyebrow: 'Team and permissions',
    title: 'Staff accounts',
    lede: 'Team member accounts: each has their own email, password and role. Roles decide what they can do, and the audit log records changes under their real identity.',
    denied: 'You need the manage permissions right to view this page. Contact the platform owner.',
    add: 'New staff member',
    email: 'Email address',
    name: 'Name',
    role: 'Role',
    password: 'Temporary password',
    passwordHint: 'At least ten characters. They will be asked to change it on first sign-in.',
    status: 'Status',
    lastLogin: 'Last sign-in',
    active: 'Active',
    inactive: 'Disabled',
    locked: 'Temporarily locked',
    noPassword: 'No password',
    never: 'Never signed in',
    save: 'Create',
    saving: 'Saving…',
    cancel: 'Cancel',
    created: 'Account created',
    disable: 'Disable',
    enable: 'Enable',
    resetPassword: 'Reset password',
    resetPrompt: 'New password (at least ten characters)',
    resetDone: 'Password reset and all sessions revoked',
    revokeSessions: 'Revoke sessions',
    revoked: 'All sessions revoked',
    you: 'you',
    empty: 'No staff accounts yet',
    emptyHint: 'Add the first staff member so they can sign in with their own account instead of the shared key.',
    roles: 'Roles',
    actions: 'Actions',
    confirmDisable: 'Disable this account? All its sessions will be revoked immediately.',
  },
}

/// أسماء الأدوار بالعربية تأتي من الخادم (roles.name_ar)، فلا تُكرَّر هنا.
const EMPTY_FORM = { email: '', display_name: '', role_id: '', password: '' }

export function TeamAccessPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const text = copy[locale]
  const self = readAdminUser()

  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const allowed = hasPermission('manage_permissions')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [userResponse, roleResponse] = await Promise.all([api.adminUsers(), api.roles()])
      setUsers(userResponse.data)
      setRoles(roleResponse.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الموظفين' : 'Unable to load staff')
    } finally {
      setLoading(false)
    }
  }, [ar])

  useEffect(() => {
    if (allowed) void load()
    else setLoading(false)
  }, [allowed, load])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await api.createAdminUser(form)
      setOpen(false)
      setForm(EMPTY_FORM)
      setNotice(text.created)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : ar ? 'تعذر إنشاء الحساب' : 'Unable to create account')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(user: AdminUserRecord) {
    if (user.is_active && !window.confirm(text.confirmDisable)) return
    setError('')
    try {
      await api.updateAdminUser(user.id, { is_active: !user.is_active })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر التحديث' : 'Unable to update')
    }
  }

  async function resetPassword(user: AdminUserRecord) {
    const password = window.prompt(text.resetPrompt)
    if (!password) return
    setError('')
    try {
      await api.resetAdminUserPassword(user.id, password)
      setNotice(text.resetDone)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر إعادة الضبط' : 'Unable to reset')
    }
  }

  async function revokeSessions(user: AdminUserRecord) {
    setError('')
    try {
      await api.revokeAdminUserSessions(user.id)
      setNotice(text.revoked)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر السحب' : 'Unable to revoke')
    }
  }

  if (!allowed) {
    return (
      <div className="page-stack">
        <section className="page-intro">
          <div>
            <span className="eyebrow">{text.eyebrow}</span>
            <h2>{text.title}</h2>
          </div>
        </section>
        <section className="panel panel--notice" role="alert">{text.denied}</section>
      </div>
    )
  }

  if (loading) return <LoadingState />
  if (error && !users.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--primary" type="button" onClick={() => { setForm(EMPTY_FORM); setFormError(''); setOpen(true) }}>
            <Icon name="plus" size={16} />{text.add}
          </button>
        </div>
      </section>

      {notice ? <section className="panel panel--notice" role="status">{notice}</section> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <section className="panel panel--table">
        <div className="table-scroll">
          <table className="data-table data-table--wide">
            <thead>
              <tr>
                <th>{text.name}</th>
                <th>{text.roles}</th>
                <th>{text.status}</th>
                <th>{text.lastLogin}</th>
                <th>{text.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="entity-cell">
                      <span className="entity-avatar entity-avatar--parent">
                        {user.display_name.slice(0, 1)}
                      </span>
                      <div>
                        <span className="table-primary">
                          {user.display_name}
                          {self?.id === user.id ? ` (${text.you})` : ''}
                        </span>
                        {/* البريد لاتيني فيُعرض يسارًا-يمينًا داخل واجهة عربية */}
                        <span className="table-secondary" dir="ltr">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {user.roles.length
                      ? user.roles.map((role) => (
                        <span className="track-badge" key={role}>
                          {roles.find((item) => item.id === role)?.name_ar ?? role}
                        </span>
                      ))
                      : <span className="table-secondary">—</span>}
                  </td>
                  <td>
                    <span className={`account-status account-status--${user.is_active ? 'active' : 'archived'}`}>
                      {user.is_active ? text.active : text.inactive}
                    </span>
                    {!user.has_password ? <span className="table-secondary">{text.noPassword}</span> : null}
                    {user.locked_until ? <span className="table-secondary">{text.locked}</span> : null}
                  </td>
                  <td>
                    <span className="table-secondary">
                      {user.last_login_at ? formatDate(user.last_login_at, locale) : text.never}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="button button--ghost" type="button" onClick={() => void resetPassword(user)}>
                        {text.resetPassword}
                      </button>
                      <button className="button button--ghost" type="button" onClick={() => void revokeSessions(user)}>
                        {text.revokeSessions}
                      </button>
                      {/* لا يستطيع أحد تعطيل نفسه: يفقد الوصول بلا سبيل للتراجع */}
                      {self?.id !== user.id ? (
                        <button className="button button--ghost" type="button" onClick={() => void toggleActive(user)}>
                          {user.is_active ? text.disable : text.enable}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length ? (
          <div className="page-state page-state--empty">
            <span className="page-state__symbol">◇</span>
            <h3>{text.empty}</h3>
            <p>{text.emptyHint}</p>
          </div>
        ) : null}
      </section>

      {open ? (
        <Modal open={open} title={text.add} onClose={() => setOpen(false)}>
          <form className="entity-form" onSubmit={submit}>
            <div className="form-grid">
              <label className="field">
                <span>{text.email}</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  dir="ltr"
                  required
                />
              </label>
              <label className="field">
                <span>{text.name}</span>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(event) => setForm({ ...form, display_name: event.target.value })}
                  required
                />
              </label>
            </div>

            <label className="field">
              <span>{text.role}</span>
              <select
                value={form.role_id}
                onChange={(event) => setForm({ ...form, role_id: event.target.value })}
                required
              >
                <option value="">—</option>
                {roles.map((role) => (
                  <option value={role.id} key={role.id}>{role.name_ar}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{text.password}</span>
              <input
                type="text"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                dir="ltr"
                minLength={10}
                required
              />
              <small>{text.passwordHint}</small>
            </label>

            {formError ? <p className="form-error" role="alert">{formError}</p> : null}

            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setOpen(false)}>{text.cancel}</button>
              <button className="button button--primary" type="submit" disabled={saving}>
                {saving ? text.saving : text.save}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}

/// تواريخ D1 بصيغة "YYYY-MM-DD HH:MM:SS" بتوقيت UTC بلا لاحقة منطقة
function formatDate(value: string, locale: 'ar' | 'en') {
  const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
