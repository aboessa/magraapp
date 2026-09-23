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
  const ar = locale === 'ar'
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

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!team) return <EmptyState title={text.loadError} description={id} />

  const filteredMembers = team.members.filter((m) => !query || `${m.display_name} ${m.email}`.toLowerCase().includes(query.toLowerCase()))
  const scopeText = team.planet_id ? text.scopePlanet(team.planet_id) : team.section ? text.scopeDept(team.section) : text.scopePlatform

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('teams')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{text.breadcrumb}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {team.name_ar}
              </h1>
              <span className="badge badge--pill">{scopeText}</span>
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              {team.description_ar || (ar ? 'فريق عمل تشغيلي مسند له صلاحيات ونطاق محدد' : 'Operational team with scoped grants')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="button button--primary button--small" type="button" onClick={() => { setActiveTab('members'); setShowAdd(true) }}>
            <Icon name="plus" size={14} />
            <span>{text.addMember}</span>
          </button>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'إجمالي الأعضاء' : 'Team Members'}</span>
            <div className="bento-glass-card__icon"><Icon name="users" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{team.members.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'أعضاء فاعلون' : 'Active roster'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'النطاق الإداري' : 'Scope Model'}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>
            {!team.planet_id && !team.section ? 'Platform' : team.planet_id ? 'Planet' : 'Dept'}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{scopeText}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'قائد الفريق' : 'Team Lead'}</span>
            <div className="bento-glass-card__icon"><Icon name="star" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>
            {team.team_lead_id ? team.team_lead_id.slice(0, 10) : '—'}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{ar ? 'معين للإشراف' : 'Designated lead'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'وراثة الصلاحيات' : 'Grant Inheritance'}</span>
            <div className="bento-glass-card__icon"><Icon name="lock" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>Active</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'تنتقل للأعضاء تلقائياً' : 'Propagated'}</span>
          </div>
        </article>
      </section>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, overflowX: 'auto' }}>
        {(['overview', 'members', 'grants', 'scope', 'audit'] as const).map((t) => (
          <button
            key={t}
            className={`button ${activeTab === t ? 'button--primary' : 'button--ghost'} button--small`}
            onClick={() => setActiveTab(t)}
          >
            {text[t] ?? t}
          </button>
        ))}
      </div>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeTab === 'overview' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="grid" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.overview}</h3>
              </div>
              <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                <div>
                  <dt>{text.scope}</dt>
                  <dd><span className="track-badge">{scopeText}</span></dd>
                </div>
                <div>
                  <dt>{text.members}</dt>
                  <dd><strong>{team.members.length}</strong></dd>
                </div>
                <div>
                  <dt>المسؤول</dt>
                  <dd>{team.team_lead_id ?? '—'}</dd>
                </div>
              </dl>
              <div style={{ marginTop: 20, padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="shield" size={14} />
                  <span>{text.grants}</span>
                </strong>
                <p className="table-secondary" style={{ fontSize: 12, margin: '6px 0 0' }}>
                  المنح الممنوحة للفريق تنتقل إلى كل الأعضاء. في مساحة الموظف ستظهر كـ <em>{text.inherited}</em>
                </p>
              </div>
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="button button--ghost button--small" type="button">
                  {text.archive}
                </button>
                <span className="table-secondary" style={{ fontSize: 12 }}>{text.archiveHint}</span>
              </div>
            </section>
          )}

          {activeTab === 'members' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="users" size={18} />
                  <h3 style={{ margin: 0, fontSize: 16 }}>{text.members} ({team.members.length})</h3>
                </div>
                <button className="button button--primary button--small" type="button" onClick={() => setShowAdd(true)}>
                  <Icon name="plus" size={14} /> {text.addMember}
                </button>
              </div>

              <div style={{ marginBottom: 14, maxWidth: 340 }}>
                <input
                  type="text"
                  placeholder={text.searchMember}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-sunken)' }}
                />
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
                          <td><span className="status-badge status-badge--published">نشط</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title={text.noMembers} description={text.noMembersHint} />
              )}

              {showAdd && (
                <div className="panel" style={{ marginTop: 18, padding: 18, border: '1px solid var(--primary)', background: 'var(--surface-sunken)' }}>
                  <h4 style={{ margin: '0 0 6px' }}>إضافة عضو إلى الفريق</h4>
                  <p className="table-secondary" style={{ fontSize: 12, margin: '0 0 12px' }}>
                    سيؤدي إضافة عضو إلى الفريق إلى منحه وصولاً مشتقاً لنطاق الفريق وصلاحياته بشكل تلقائي.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
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
                </div>
              )}
            </section>
          )}

          {activeTab === 'grants' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="shield" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.grants}</h3>
              </div>
              <p className="table-secondary" style={{ fontSize: 13, margin: '0 0 16px' }}>
                المنح المباشرة vs الموروثة من الفريق — تُعرض بشكل منفصل.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 8px' }}>DIRECT GRANTS</h4>
                  <EmptyState title="لا منح مباشرة" description="—" />
                </div>
                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 8px' }}>INHERITED FROM TEAM</h4>
                  <p className="table-secondary" style={{ fontSize: 12 }}>موروثة من منح الفريق — لا تُدمج بصريًا مع المباشرة.</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'scope' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="grid" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.scope}</h3>
              </div>
              <p>
                <strong>Scope Type:</strong> {!team.planet_id && !team.section ? 'Platform-wide' : team.planet_id ? 'Planet-specific' : 'Department-specific'}
              </p>
              <p className="table-secondary">{scopeText}</p>
              <p className="table-secondary" style={{ fontSize: 12, marginTop: 8 }}>
                لا يُسمح بمزيج مربك مثل "بلا كوكب" مع قسم عشوائي دون تفسير النطاق الناتج.
              </p>
            </section>
          )}

          {activeTab === 'audit' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="clock" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.audit}</h3>
              </div>
              <p className="table-secondary" style={{ fontSize: 13, margin: '0 0 16px' }}>
                سجل من audit_logs حيث entity_type=team و entity_id={team.id}
              </p>
              <EmptyState title="لا سجل بعد" description="—" />
            </section>
          )}
        </div>

        {/* Sticky Team Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Team Composition & Hierarchy */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="users" size={16} />
              <span>{ar ? 'تكوين الفريق' : 'Team Roster'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'إجمالي الأعضاء:' : 'Total Members:'}</span>
                <strong>{team.members.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'حالة النطاق:' : 'Scope Confinement:'}</span>
                <span className="track-badge">{team.planet_id ? 'Scoped' : 'Global'}</span>
              </div>
            </div>
          </div>

          {/* AI Team Governance Advisor */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'حوكمة الفرق الذكية' : 'Team Governance Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {ar
                ? 'إضافة الصلاحيات على مستوى الفريق تضمن التماثل التشغيلي وسهولة سحب الصلاحيات عند مغادرة أي عضو.'
                : 'Team-level grant binding guarantees deterministic access patterns and clean offboarding propagation.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
