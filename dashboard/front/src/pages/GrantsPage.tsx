// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { Modal } from '../components/Modal'

const copy = {
  ar: {
    eyebrow: 'المنح',
    title: 'المنح النشطة',
    lede: 'المنح بأربع طبقات: دور + نطاق + نوع محتوى + لغة. الترتيب حسب الصلاحية.',
    add: 'منح جديد',
    createTitle: 'إنشاء منح — معاينة الوصول الفعلي',
    steps: ['الموضوع: موظف/فريق', 'الدور', 'النطاق', 'نوع المحتوى', 'اللغات', 'الصلاحية الزمنية', 'المراجعة', 'تأكيد'],
    subject: 'الموضوع',
    role: 'الدور',
    scope: 'النطاق',
    contentType: 'نوع المحتوى',
    languages: 'اللغات',
    valid: 'الصلاحية',
    grantedTo: 'الممنوح له',
    subjectType: 'نوع الموضوع',
    scopeType: 'نوع النطاق',
    validFrom: 'من',
    expires: 'ينتهي',
    source: 'المصدر',
    grantedBy: 'منحه',
    status: 'الحالة',
    highRisk: 'صلاحية عالية المخاطر — تتطلب تأكيدًا',
    save: 'إنشاء',
    cancel: 'إلغاء',
    loadError: 'تعذر تحميل المنح',
    empty: 'لا منح بعد',
    wizardHint: 'الافتراضي: أضيق نطاق معقول — لا تجعل الكوكب = الكل واللغة = الكل للتسهيل.',
  },
  en: {
    eyebrow: 'Grants',
    title: 'Active grants',
    lede: 'Grants have four layers: role + scope + content type + language.',
    add: 'New grant',
    createTitle: 'Create grant — effective access review',
    steps: ['Subject: user/team', 'Role', 'Scope', 'Content type', 'Languages', 'Validity', 'Review', 'Confirm'],
    subject: 'Subject',
    role: 'Role',
    scope: 'Scope',
    contentType: 'Content type',
    languages: 'Languages',
    valid: 'Validity',
    grantedTo: 'Granted to',
    subjectType: 'Subject type',
    scopeType: 'Scope type',
    validFrom: 'Valid from',
    expires: 'Expires',
    source: 'Source',
    grantedBy: 'Granted by',
    status: 'Status',
    highRisk: 'High-risk — requires confirmation',
    save: 'Create',
    cancel: 'Cancel',
    loadError: 'Unable to load grants',
    empty: 'No grants yet',
    wizardHint: 'Default to narrowest scope — do not default to ALL for convenience.',
  },
}

export function GrantsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [grants, setGrants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ grantee_type: 'user', grantee_id: '', role_id: '', scope_type: 'planet', scope_id: '', content_type: '', language: 'ar', valid_until: '' })
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [g, u, r] = await Promise.all([api.grants(), api.adminUsers(), api.roles()])
      setGrants(g.data as any)
      setUsers(u.data as any)
      setRoles(r.data as any)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  const highRisk = ['publish', 'billing', 'manage_permissions', 'customer'].some((k) => form.role_id.includes(k))

  const handleCreate = async () => {
    try {
      await api.createGrant({
        grantee_type: form.grantee_type as any,
        grantee_id: form.grantee_id,
        role_id: form.role_id,
        scope_type: form.scope_type as any,
        scope_id: form.scope_id || null,
      } as any)
      setWizardOpen(false)
      setStep(0)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p className="table-secondary">{text.lede}</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => { setStep(0); setWizardOpen(true) }}>
          <Icon name="plus" size={16} />{text.add}
        </button>
      </section>

      <section className="panel panel--table">
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{text.grantedTo}</th>
                <th>{text.subjectType}</th>
                <th>{text.role}</th>
                <th>{text.scope}</th>
                <th>{text.contentType}</th>
                <th>{text.languages}</th>
                <th>{text.valid}</th>
                <th>{text.expires}</th>
                <th>{text.source}</th>
                <th>{text.status}</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} onClick={() => (window.location.href = adminPath(`grants/${g.id}`))} style={{ cursor: 'pointer' }}>
                  <td>
                    <Link to={adminPath(`grants/${g.id}`)} onClick={(e) => e.stopPropagation()}>
                      {g.grantee_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{g.grantee_type}</td>
                  <td>{g.role_name ?? g.role_id}</td>
                  <td>
                    <span className="track-badge">{g.scope_type}</span> {g.scope_id ?? ''}
                  </td>
                  <td>{g.content_type ?? '—'}</td>
                  <td>{g.language ?? '—'}</td>
                  <td>{g.valid_from?.slice(0, 10) ?? '—'}</td>
                  <td>{g.valid_until?.slice(0, 10) ?? 'دائم'}</td>
                  <td>{g.granted_by ?? '—'}</td>
                  <td>{g.valid_until && new Date(g.valid_until) < new Date() ? 'منتهي' : 'نشط'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!grants.length ? <EmptyState title={text.empty} description={text.wizardHint} /> : null}
      </section>

      {wizardOpen && (
        <div className="drawer-backdrop" role="presentation" onClick={() => setWizardOpen(false)}>
          <div className="drawer" role="dialog" aria-modal="true" aria-label={text.createTitle} style={{ width: 'min(640px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
            <header className="drawer__header">
              <div>
                <h2>{text.createTitle}</h2>
                <p className="table-secondary">{text.steps[step]}</p>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {text.steps.map((_, i) => (
                    <span key={i} style={{ flex: 1, height: 4, background: i <= step ? 'var(--primary)' : 'var(--border)', borderRadius: 4 }} />
                  ))}
                </div>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setWizardOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </header>

            <div className="drawer__body" style={{ display: 'grid', gap: 16, padding: 16, maxHeight: '65vh', overflowY: 'auto' }}>
              {step === 0 && (
                <section>
                  <h3>1. {text.subject}</h3>
                  <p className="table-secondary" style={{ fontSize: 12 }}>اختر موظفًا أو فريقًا — يظهر الصورة/الاسم/البريد/الحالة/الدور الحالي</p>
                  <label className="field" style={{ maxWidth: 340 }}>
                    <span>الموظف/الفريق</span>
                    <select value={form.grantee_id} onChange={(e) => setForm({ ...form, grantee_id: e.target.value, grantee_type: users.find((u) => u.id === e.target.value) ? 'user' : 'team' })}>
                      <option value="">—</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.display_name} — {u.email} — {u.is_active ? 'نشط' : 'معطّل'}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              )}
              {step === 1 && (
                <section>
                  <h3>2. {text.role}</h3>
                  <label className="field" style={{ maxWidth: 340 }}>
                    <span>{text.role}</span>
                    <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                      <option value="">—</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name_ar} — {r.permissions?.length ?? r.permissions_count} صلاحية — {r.description ?? ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {highRisk ? <p className="field__error">⚠ {text.highRisk}</p> : null}
                </section>
              )}
              {step === 2 && (
                <section>
                  <h3>3. {text.scope}</h3>
                  <p className="table-secondary" style={{ fontSize: 12 }}>الصلاحية = الدور + النطاق + نوع المحتوى + اللغة + الصلاحية الزمنية — لا تُبسّط إلى RBAC عام</p>
                  <label className="field" style={{ maxWidth: 320 }}>
                    <span>Scope type</span>
                    <select value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value })}>
                      <option value="platform">Platform-wide</option>
                      <option value="planet">Planet</option>
                      <option value="section">Section</option>
                      <option value="series">Series</option>
                    </select>
                  </label>
                  <label className="field" style={{ maxWidth: 320 }}>
                    <span>Scope id</span>
                    <input type="text" value={form.scope_id} onChange={(e) => setForm({ ...form, scope_id: e.target.value })} placeholder="islamic or series id" />
                  </label>
                </section>
              )}
              {step === 3 && (
                <section>
                  <h3>4. {text.contentType}</h3>
                  <input type="text" value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })} placeholder="series, episode..." />
                </section>
              )}
              {step === 4 && (
                <section>
                  <h3>5. {text.languages}</h3>
                  <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="">الكل</option>
                  </select>
                  <p className="table-secondary" style={{ fontSize: 12 }}>{text.wizardHint}</p>
                </section>
              )}
              {step === 5 && (
                <section>
                  <h3>6. {text.valid}</h3>
                  <label className="field" style={{ maxWidth: 280 }}>
                    <span>ينتهي</span>
                    <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
                  </label>
                  <p className="table-secondary">مؤقت ينتهي في 7/30 يوم، دائم، منتهي — حسب الخلفية</p>
                </section>
              )}
              {step === 6 && (
                <section style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>
                  <h3>المراجعة — الوصول الفعلي</h3>
                  <p>
                    تمنح: <strong>{form.role_id}</strong> إلى <strong>{form.grantee_id.slice(0, 8)}</strong>
                    <br />
                    النطاق: {form.scope_type} {form.scope_id}
                    <br />
                    اللغات: {form.language}
                    <br />
                    الصلاحية: {form.valid_until || 'دائم'}
                  </p>
                  <p className="table-secondary">سيمتلك: النشر (لو مراجع islamic) — ولن يمتلك: الفوترة</p>
                  {highRisk ? <p className="field__error">⚠ تأكيد صريح مطلوب للمخاطر العالية</p> : null}
                </section>
              )}
            </div>

            <footer className="drawer__footer" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button className="button button--ghost" type="button" onClick={() => (step > 0 ? setStep((s) => s - 1) : setWizardOpen(false))}>
                رجوع
              </button>
              {step < 6 ? (
                <button className="button button--primary" type="button" onClick={() => setStep((s) => s + 1)}>
                  التالي
                </button>
              ) : (
                <button className="button button--primary" type="button" onClick={() => void handleCreate()}>
                  {text.save}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
