import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { AccessGrantRecord, PermissionRecord, RoleRecord } from '../types/api'

/**
 * الأدوار والصلاحيات، مقروءة من الخادم.
 *
 * ## ما كانت عليه
 *
 * كانت تنادي `fetch('/api/v1/admin/roles')` بمسار نسبي، فيذهب النداء إلى
 * majarra.app لا api.majarra.app. وPages تُعيد index.html لأي مسار مجهول،
 * فترجع 200 بـHTML، فيرمي `r.json()`، فيمسك الـcatch ويضع **ثلاثة أدوار
 * مخترعة** بأعداد صلاحيات مخترعة. على شاشة صلاحيات هذا أخطر ما يمكن: يقرأ
 * المسؤول قواعد تصريح لا وجود لها.
 *
 * وكانت مصفوفة الصلاحيات في الأسفل ثابتة في الكود، لا صلة لها بـ
 * role_permissions في قاعدة البيانات.
 *
 * ## ما صارت عليه
 *
 * `lib/api.ts` يبني المسار من API_ROOT ويضيف ترويسة الجلسة ويرمي ApiError على
 * أي استجابة غير ناجحة. الفشل يظهر كخطأ صريح، والمصفوفة تُبنى من الأدوار
 * والصلاحيات والمنح الحقيقية.
 */

const copy = {
  ar: {
    eyebrow: 'الأدوار والصلاحيات',
    title: 'الأدوار والمنح',
    lede: 'المنح بأربع طبقات: دور + نطاق + نوع محتوى + لغة. مثال: مراجع لغوي على كوكب القصص للعربية فقط.',
    rolesTitle: 'الأدوار',
    rolesCount: (n: number) => `${n} دور`,
    permissionsUnit: (n: number) => `${n} صلاحية`,
    grantsTitle: 'المنح النشطة',
    grantsEmpty: 'لا منح بعد',
    grantsEmptyHint: 'امنح دورًا لموظف من صفحة «الموظفون والصلاحيات».',
    matrixTitle: 'مصفوفة الصلاحيات',
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
    save: 'إنشاء',
    cancel: 'إلغاء',
    required: 'المعرف والاسم مطلوبان',
    createOk: 'تم إنشاء الدور',
  },
  en: {
    eyebrow: 'Roles and permissions',
    title: 'Roles and grants',
    lede: 'Grants have four layers: role + scope + content type + language. Example: a language reviewer on the Stories planet for Arabic only.',
    rolesTitle: 'Roles',
    rolesCount: (n: number) => `${n} roles`,
    permissionsUnit: (n: number) => `${n} permissions`,
    grantsTitle: 'Active grants',
    grantsEmpty: 'No grants yet',
    grantsEmptyHint: 'Grant a role to a staff member from the Staff and permissions page.',
    matrixTitle: 'Permission matrix',
    matrixHint: 'Built from real role_permissions rows, not a hardcoded list.',
    action: 'Permission',
    grantee: 'Grantee',
    role: 'Role',
    scope: 'Scope',
    validUntil: 'Expires',
    never: 'Never',
    user: 'User',
    team: 'Team',
    loadError: 'Unable to load roles',
    noRoles: 'No roles configured',
    noRolesHint: 'Roles are seeded by migrations. Contact your system administrator.',
    addRole: 'New role',
    createTitle: 'Create custom role',
    idLabel: 'Technical ID (e.g. custom_editor)',
    nameLabel: 'Arabic name',
    descLabel: 'Description',
    permsLabel: 'Permissions',
    save: 'Create',
    cancel: 'Cancel',
    required: 'ID and name required',
    createOk: 'Role created',
  },
}

/// الأدوار المعروضة في المصفوفة. عرض 12 دورًا في جدول واحد غير مقروء،
/// وهذه هي أدوار سير العمل التي تهمّ فعلًا.
const MATRIX_ROLES = ['content_creator', 'section_lead', 'reviewer', 'publisher']

export function RolesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [permissions, setPermissions] = useState<PermissionRecord[]>([])
  const [grants, setGrants] = useState<AccessGrantRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ id:'', name_ar:'', description_ar:'', perms: [] as string[] })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // الثلاثة معًا: الصفحة بلا معنى إن نقص أحدها، فالفشل يظهر مرة واحدة
      const [roleRes, permRes, grantRes] = await Promise.all([
        api.roles(),
        api.permissions(),
        api.grants(),
      ])
      setRoles(roleRes.data)
      setPermissions(permRes.data)
      setGrants(grantRes.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  async function createRole(){
    if(!form.id.trim() || !form.name_ar.trim()){ setFormError(text.required); return }
    setSaving(true); setFormError('')
    try{
      await api.createRole({ id: form.id.trim(), name_ar: form.name_ar.trim(), description_ar: form.description_ar.trim() || null, permissions: form.perms })
      setNotice(text.createOk); setShowCreate(false); setForm({ id:'', name_ar:'', description_ar:'', perms: [] }); await load()
    }catch(e){ setFormError(e instanceof Error? e.message: 'Error') } finally{ setSaving(false) }
  }

  if (!roles.length && loading) return <LoadingState/>
  if (error && !roles.length) return <ErrorState message={error} onRetry={()=>void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--primary" onClick={()=> { setForm({ id:'', name_ar:'', description_ar:'', perms: [] }); setFormError(''); setShowCreate(true) }}><Icon name="plus" size={14}/>{text.addRole}</button>
        </div>
      </section>

      {notice && <div className="inline-alert inline-alert--success">{notice}</div>}

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel__header">
            <h3>{text.rolesTitle}</h3>
            {/* العدد من الخادم لا رقم ثابت: كان مكتوبًا «الأدوار (12)» بينما
                القائمة تعرض ثلاثة أدوار مخترعة */}
            <span className="panel__kicker">{text.rolesCount(roles.length)}</span>
          </div>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr><th>{text.role}</th><th>{text.action}</th></tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <span className="table-primary">{role.name_ar}</span>
                      <span className="table-secondary" dir="ltr">{role.id}</span>
                    </td>
                    <td>
                      <span className={Number(role.permissions_count ?? 0) === 0 ? 'status-badge status-badge--draft' : 'track-badge'}>
                        {text.permissionsUnit(Number(role.permissions_count ?? 0))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
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
                        <span className="table-secondary" dir="ltr">{grant.grantee_id.slice(0, 12)}…</span>
                      </td>
                      <td>{grant.role_name ?? grant.role_id}</td>
                      <td>
                        <span className="track-badge">{grant.scope_type}</span>
                        {grant.scope_id ? <span className="table-secondary">{grant.scope_id}</span> : null}
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
      </div>

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
                    <span className="table-secondary" dir="ltr">{permission.id}</span>
                  </td>
                  {MATRIX_ROLES.map((roleId) => (
                    <td key={roleId}>
                      {/* من role_permissions الحقيقية عبر الخادم، لا قائمة ثابتة */}
                      {(roles.find((r) => r.id === roleId)?.permissions ?? []).includes(permission.id) ? '✓' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={showCreate} onClose={()=> !saving && setShowCreate(false)} title={text.createTitle}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field"><span>{text.idLabel} *</span><input dir="ltr" value={form.id} onChange={e=> setForm({...form, id:e.target.value})} placeholder="custom_editor" /></label>
          <label className="field"><span>{text.nameLabel} *</span><input value={form.name_ar} onChange={e=> setForm({...form, name_ar:e.target.value})} placeholder="محرر مخصص" /></label>
          <label className="field"><span>{text.descLabel}</span><textarea rows={2} value={form.description_ar} onChange={e=> setForm({...form, description_ar:e.target.value})} /></label>
          <div className="field"><span>{text.permsLabel}</span><div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:6, maxHeight:240, overflowY:'auto', padding:8, border:'1px solid var(--line)', borderRadius:10, background:'var(--surface-2)' }}>
            {permissions.map(p=> (
              <label key={p.id} style={{ display:'flex', gap:8, alignItems:'center', fontSize:12, cursor:'pointer' }}>
                <input type="checkbox" checked={form.perms.includes(p.id)} onChange={()=> setForm(f=> ({...f, perms: f.perms.includes(p.id) ? f.perms.filter(x=>x!==p.id) : [...f.perms, p.id]}))} />
                <span>{p.description_ar ?? p.action} <small dir="ltr" style={{ color:'var(--muted)' }}>({p.id})</small></span>
              </label>
            ))}
          </div></div>
          <div className="form-actions"><button className="button button--ghost" onClick={()=> setShowCreate(false)}>{text.cancel}</button><button className="button button--primary" disabled={saving} onClick={()=>void createRole()}>{saving? '...': text.save}</button></div>
        </div>
      </Modal>
    </div>
  )
}
