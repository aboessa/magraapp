// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import type { TeamDetail } from '../types/api'

const copy = {
  ar: {
    breadcrumb: 'الفرق',
    overview: 'نظرة عامة',
    members: 'الأعضاء',
    grants: 'المنح / الصلاحيات',
    scope: 'النطاق',
    assignments: 'التكليفات',
    tasks: 'المهام',
    reviews: 'المراجعات',
    activity: 'النشاط',
    audit: 'التدقيق',
    addMember: 'إضافة عضو',
    member: 'الموظف',
    roleInTeam: 'الدور في الفريق',
    added: 'أُضيف',
    addedBy: 'أضافه',
    status: 'الحالة',
    noMembers: 'لا أعضاء بعد',
    noMembersHint: 'أضف أول عضو ليستفيد من منح الفريق.',
    scopePlatform: 'المنصة كاملة',
    scopePlanet: (p: string) => `كوكب: ${p}`,
    scopeDept: (d: string) => `قسم: ${d}`,
    inherited: 'موروث من الفريق',
    direct: 'مباشر',
    archive: 'أرشفة الفريق',
    archiveHint: 'سيُحفظ تاريخ المنح والمراجعات — يُفضل الأرشفة على الحذف.',
    loadError: 'تعذر تحميل الفريق',
    searchMember: 'بحث بالاسم أو البريد...',
  },
  en: {
    breadcrumb: 'Teams',
    overview: 'Overview',
    members: 'Members',
    grants: 'Grants',
    scope: 'Scope',
    assignments: 'Assignments',
    tasks: 'Tasks',
    reviews: 'Reviews',
    activity: 'Activity',
    audit: 'Audit',
    addMember: 'Add member',
    member: 'Employee',
    roleInTeam: 'Role in team',
    added: 'Added',
    addedBy: 'Added by',
    status: 'Status',
    noMembers: 'No members yet',
    noMembersHint: 'Add the first member to benefit from team grants.',
    scopePlatform: 'Platform-wide',
    scopePlanet: (p: string) => `Planet: ${p}`,
    scopeDept: (d: string) => `Department: ${d}`,
    inherited: 'Inherited from team',
    direct: 'Direct',
    archive: 'Archive team',
    archiveHint: 'Grants and reviews history will be preserved — archive is preferred over hard delete.',
    loadError: 'Unable to load team',
    searchMember: 'Search by name or email...',
  },
}

export function TeamWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale]
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'grants' | 'scope' | 'audit'>('overview')
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [picker, setPicker] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.team(id)
      setTeam(res.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!team) return <EmptyState title={text.loadError} description={id} />

  const filteredMembers = team.members.filter((m) => !query || `${m.display_name} ${m.email}`.toLowerCase().includes(query.toLowerCase()))

  const scopeText = team.planet_id ? text.scopePlanet(team.planet_id) : team.section ? text.scopeDept(team.section) : text.scopePlatform

  return (
    <div className="page-stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <Link to={adminPath('teams')} className="table-secondary">
          {text.breadcrumb}
        </Link>
        <Icon name="arrow" size={12} />
        <strong>{team.name_ar}</strong>
      </div>

      <section className="page-intro" style={{ paddingBottom: 8 }}>
        <div>
          <span className="eyebrow">{text.breadcrumb}</span>
          <h2>{team.name_ar}</h2>
          <p className="table-secondary">{scopeText} · {team.members.length} عضو</p>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {(['overview', 'members', 'grants', 'scope', 'audit'] as const).map((t) => (
          <button key={t} className={`button ${activeTab === t ? 'button--primary' : 'button--ghost'} button--small`} onClick={() => setActiveTab(t)}>
            {text[t] ?? t}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.overview}</h3>
          <dl className="detail-list">
            <div>
              <dt>النطاق</dt>
              <dd>{scopeText}</dd>
            </div>
            <div>
              <dt>الأعضاء</dt>
              <dd>{team.members.length}</dd>
            </div>
            <div>
              <dt>المسؤول</dt>
              <dd>{team.team_lead_id ?? '—'}</dd>
            </div>
          </dl>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
            <strong>{text.grants}</strong>
            <p className="table-secondary" style={{ fontSize: 12 }}>
              المنح الممنوحة للفريق تنتقل إلى كل الأعضاء. في مساحة الموظف ستظهر كـ <em>{text.inherited}</em>
            </p>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="button button--ghost button--small" type="button">
              {text.archive}
            </button>
            <p className="table-secondary" style={{ fontSize: 12 }}>{text.archiveHint}</p>
          </div>
        </section>
      )}

      {activeTab === 'members' && (
        <section className="panel" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{text.members} ({team.members.length})</h3>
            <button className="button button--primary button--small" type="button" onClick={() => setShowAdd(true)}>
              <Icon name="plus" size={14} /> {text.addMember}
            </button>
          </div>
          <div style={{ marginBottom: 12, maxWidth: 320 }}>
            <input type="text" placeholder={text.searchMember} value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--border)' }} />
          </div>
          {filteredMembers.length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.member}</th>
                    <th>{text.roleInTeam}</th>
                    <th>{text.added}</th>
                    <th>{text.addedBy}</th>
                    <th>{text.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="entity-cell">
                          <span className="entity-avatar">{m.display_name.slice(0, 1)}</span>
                          <div>
                            <strong>{m.display_name}</strong>
                            <small dir="ltr">{m.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>نشط</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.noMembers} description={text.noMembersHint} />
          )}
          {showAdd && (
            <div className="panel" style={{ marginTop: 16, padding: 16, border: '1px solid var(--primary)' }}>
              <h4>إضافة عضو</h4>
              <p className="table-secondary" style={{ fontSize: 12 }}>سيؤدي إضافة سارة إلى "فريق المراجعة الإسلامية" إلى منحها وصولًا مشتقًا إلى كوكب الإسلام وطابور المراجعة العربية فقط إذا كان منح الفريق يعمل بالوراثة.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="بحث بالاسم أو البريد"
                  value={picker}
                  onChange={(e) => setPicker(e.target.value)}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <button className="button button--primary button--small" type="button" onClick={() => setShowAdd(false)}>
                  إضافة
                </button>
                <button className="button button--ghost button--small" type="button" onClick={() => setShowAdd(false)}>
                  إلغاء
                </button>
              </div>
              <p className="table-secondary" style={{ fontSize: 12, marginTop: 8 }}>يُظهر منتقي الموظف: الصورة/الحرف، الاسم، البريد، الحالة، الدور الحالي.</p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'grants' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.grants}</h3>
          <p className="table-secondary">المنح المباشرة vs الموروثة من الفريق — تُعرض بشكل منفصل.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <div>
              <h4>DIRECT GRANTS</h4>
              <EmptyState title="لا منح مباشرة" description="—" />
            </div>
            <div>
              <h4>INHERITED FROM TEAM</h4>
              <p className="table-secondary">موروثة من منح الفريق — لا تُدمج بصريًا مع المباشرة.</p>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'scope' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.scope}</h3>
          <p>
            <strong>Scope Type:</strong> {!team.planet_id && !team.section ? 'Platform-wide' : team.planet_id ? 'Planet-specific' : 'Department-specific'}
          </p>
          <p className="table-secondary">{scopeText}</p>
          <p className="table-secondary" style={{ fontSize: 12, marginTop: 8 }}>لا يُسمح بمزيج مربك مثل "بلا كوكب" مع قسم عشوائي دون تفسير النطاق الناتج.</p>
        </section>
      )}

      {activeTab === 'audit' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.audit}</h3>
          <p className="table-secondary">سجل من audit_logs حيث entity_type=team و entity_id={team.id}</p>
          <EmptyState title="لا سجل بعد" description="—" />
        </section>
      )}
    </div>
  )
}
