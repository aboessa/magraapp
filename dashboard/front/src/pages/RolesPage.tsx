import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
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

  if (!roles.length) {
    return (
      <div className="page-stack">
        <section className="page-intro">
          <div>
            <span className="eyebrow">{text.eyebrow}</span>
            <h2>{text.title}</h2>
          </div>
        </section>
        <EmptyState title={text.noRoles} description={text.noRolesHint} />
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

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
    </div>
  )
}
