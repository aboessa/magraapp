// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { Modal } from '../components/Modal'
import type { Planet, TeamRecord } from '../types/api'

/**
 * Teams — fixed global form standard.
 *
 * BEFORE: large horizontal inline form (3 fields stretched across viewport, weak hierarchy,
 * no sections, no scope explanation, no validation summary, collection and creation compete).
 *
 * AFTER: Drawer (520–680px) with logical sections, sticky footer, scope modes, review step.
 * Complex Team configuration would use dedicated page; current simple case fits Drawer.
 */

const copy = {
  ar: {
    eyebrow: 'الفرق والأعضاء',
    title: 'إدارة الفرق',
    lede: 'كل فريق له نطاق (كوكب أو قسم). المنح الممنوحة للفريق تنتقل إلى كل أعضائه.',
    add: 'فريق جديد',
    createTitle: 'إنشاء فريق جديد',
    createDesc: 'أنشئ فريق عمل وحدد نطاقه الإداري. يمكن إضافة الأعضاء والصلاحيات بعد الإنشاء.',
    sections: {
      basic: 'المعلومات الأساسية',
      scope: 'النطاق الإداري',
      members: 'الأعضاء المبدئيون',
      review: 'المراجعة',
    },
    name: 'اسم الفريق *',
    nameHint: 'مثال: فريق المراجعة الإسلامية',
    desc: 'الوصف',
    descHint: 'اختياري — يظهر في مساحة الفريق',
    scopeType: 'نوع النطاق *',
    scopeTypes: {
      platform: 'عام — المنصة كاملة',
      planet: 'خاص بكوكب',
      department: 'خاص بقسم',
    },
    scopeHelp: {
      platform: 'الفريق له صلاحيات عامة بدون تقييد كوكب.',
      planet: 'اختر كوكبًا — الفريق يعمل فقط ضمن هذا الكوكب.',
      department: 'حدد القسم — مثال: التحرير، التدقيق اللغوي.',
    },
    planet: 'الكوكب',
    planetHint: 'يُحدد نطاق الكوكب للفريق.',
    section: 'القسم',
    sectionHint: 'مثال: التحرير، المراجعة الشرعية',
    noPlanet: '— اختر —',
    membersHint: 'يمكن إضافة الأعضاء لاحقًا من مساحة الفريق.',
    reviewTitle: 'ملخص النطاق',
    reviewScope: 'النطاق النهائي:',
    scopePlatform: 'المنصة كاملة',
    scopePlanet: (p: string) => `كوكب: ${p}`,
    scopeDepartment: (d: string) => `قسم: ${d}`,
    save: 'إنشاء الفريق',
    saving: 'جارٍ الإنشاء…',
    cancel: 'إلغاء',
    created: 'أُنشئ الفريق — يتم فتح مساحة الفريق',
    empty: 'لا فرق بعد',
    emptyHint: 'الفرق تجمع الموظفين حسب نطاق العمل وتبسط التعيينات. أنشئ أول فريق.',
    loadError: 'تعذر تحميل الفرق',
    nameRequired: 'اسم الفريق مطلوب',
    invalidScope: 'حدد كوكبًا أو قسمًا حسب نوع النطاق',
    collection: { team: 'الفريق', scope: 'النطاق', planet: 'الكوكب/القسم', members: 'الأعضاء', lead: 'المسؤول', tasks: 'المهام', reviews: 'المراجعات', status: 'الحالة', updated: 'آخر تحديث' },
  },
  en: {
    eyebrow: 'Teams & members',
    title: 'Team management',
    lede: 'Each team has a scope (planet or section). Grants to a team apply to all members.',
    add: 'New team',
    createTitle: 'Create new team',
    createDesc: 'Create a team and define its administrative scope. Members and permissions can be added afterward.',
    sections: {
      basic: 'Basic Information',
      scope: 'Administrative Scope',
      members: 'Initial Members',
      review: 'Review',
    },
    name: 'Team name *',
    nameHint: 'Example: Islamic Review Team',
    desc: 'Description',
    descHint: 'Optional — shown in team workspace',
    scopeType: 'Scope type *',
    scopeTypes: {
      platform: 'Platform-wide',
      planet: 'Planet-specific',
      department: 'Department-specific',
    },
    scopeHelp: {
      platform: 'Team has platform-wide permissions without planet restriction.',
      planet: 'Select a planet — team operates only within this planet.',
      department: 'Define a department — e.g. Editorial, Language Review.',
    },
    planet: 'Planet',
    planetHint: 'Defines the planet scope for this team.',
    section: 'Department',
    sectionHint: 'Example: Editorial, Sharia Review',
    noPlanet: '— Select —',
    membersHint: 'Members can be added later from the team workspace.',
    reviewTitle: 'Scope summary',
    reviewScope: 'Final scope:',
    scopePlatform: 'Platform-wide',
    scopePlanet: (p: string) => `Planet: ${p}`,
    scopeDepartment: (d: string) => `Department: ${d}`,
    save: 'Create team',
    saving: 'Creating…',
    cancel: 'Cancel',
    created: 'Team created — opening workspace',
    empty: 'No teams yet',
    emptyHint: 'Teams group staff by working scope and simplify assignments. Create the first team.',
    loadError: 'Unable to load teams',
    nameRequired: 'Team name is required',
    invalidScope: 'Select a planet or department for the chosen scope',
    collection: { team: 'Team', scope: 'Scope', planet: 'Planet/Department', members: 'Members', lead: 'Lead', tasks: 'Tasks', reviews: 'Reviews', status: 'Status', updated: 'Updated' },
  },
}

type ScopeType = 'platform' | 'planet' | 'department'

export function TeamsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [planets, setPlanets] = useState<Planet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ name_ar: '', description_ar: '', scopeType: 'platform' as ScopeType, planet_id: '', section: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [teamRes, planetRes] = await Promise.all([api.teams(), api.cmsPlanets()])
      setTeams(teamRes.data)
      setPlanets(planetRes.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name_ar.trim()) errs.name = text.nameRequired
    if (form.scopeType === 'planet' && !form.planet_id) errs.scope = text.invalidScope
    if (form.scopeType === 'department' && !form.section.trim()) errs.scope = text.invalidScope
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async () => {
    if (!validate()) return
    setSaving(true)
    setFormError('')
    try {
      const payload: Record<string, string | null> = {
        name_ar: form.name_ar.trim(),
        description_ar: form.description_ar.trim() || null,
        planet_id: form.scopeType === 'planet' ? form.planet_id : null,
        section: form.scopeType === 'department' ? form.section.trim() : form.scopeType === 'planet' ? null : null,
      }
      const res = await api.createTeam(payload as any)
      setDrawerOpen(false)
      setForm({ name_ar: '', description_ar: '', scopeType: 'platform', planet_id: '', section: '' })
      // open new Team Workspace instead of meaningless list
      window.location.href = adminPath(`teams/${(res as any).data?.id ?? ''}`)
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : text.loadError
      // map server validation to exact field if possible
      if (msg.includes('planet')) setFieldErrors((p) => ({ ...p, scope: msg }))
      else if (msg.toLowerCase().includes('name') || msg.includes('اسم')) setFieldErrors((p) => ({ ...p, name: msg }))
      else setFormError(msg)
    } finally {
      setSaving(false)
    }
  }

  const scopeLabel = (team: TeamRecord) => {
    if (team.planet_id) return text.scopePlanet(planets.find((p) => p.id === team.planet_id)?.name_ar ?? team.planet_id)
    if (team.section) return text.scopeDepartment(team.section)
    return text.scopePlatform
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--primary" type="button" onClick={() => { setFormError(''); setFieldErrors({}); setDrawerOpen(true) }}>
            <Icon name="plus" size={16} />{text.add}
          </button>
        </div>
      </section>

      {teams.length ? (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.collection.team}</th>
                  <th>{text.collection.scope}</th>
                  <th>{text.collection.planet}</th>
                  <th>{text.collection.members}</th>
                  <th>{text.collection.lead}</th>
                  <th>{text.collection.updated}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id} style={{ cursor: 'pointer' }} onClick={() => (window.location.href = adminPath(`teams/${team.id}`))}>
                    <td>
                      <Link to={adminPath(`teams/${team.id}`)} onClick={(e) => e.stopPropagation()}>
                        <strong>{team.name_ar}</strong>
                        {team.description_ar ? <small className="table-secondary">{team.description_ar}</small> : null}
                      </Link>
                    </td>
                    <td>
                      <span className="track-badge">
                        {!team.planet_id && !team.section ? text.scopeTypes.platform : team.planet_id ? text.scopeTypes.planet : text.scopeTypes.department}
                      </span>
                    </td>
                    <td>{team.planet_id ? planets.find((p) => p.id === team.planet_id)?.name_ar ?? team.planet_id : team.section ?? '—'}</td>
                    <td>{team.members_count ?? 0}</td>
                    <td>{team.team_lead_id?.slice(0, 8) ?? '—'}</td>
                    <td className="table-secondary">{team.created_at?.slice(0, 10) ?? '—'}</td>
                    <td>
                      <Link className="button button--ghost button--small" to={adminPath(`teams/${team.id}`)} onClick={(e) => e.stopPropagation()}>
                        فتح
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="panel" style={{ padding: 32, textAlign: 'center' }}>
          <Icon name="parents" size={32} />
          <h3>{text.empty}</h3>
          <p className="table-secondary">{text.emptyHint}</p>
          <button className="button button--primary" type="button" onClick={() => setDrawerOpen(true)}>
            {text.add}
          </button>
        </section>
      )}

      {/* Drawer: 520–680px, sections, sticky footer, unsaved guard */}
      {drawerOpen && (
        <div className="drawer-backdrop" role="presentation" onClick={() => setDrawerOpen(false)}>
          <div
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={text.createTitle}
            style={{ width: 'min(640px, 92vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="drawer__header">
              <div>
                <h2>{text.createTitle}</h2>
                <p className="table-secondary">{text.createDesc}</p>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setDrawerOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </header>

            <div className="drawer__body" style={{ display: 'grid', gap: 24, padding: 16 }}>
              <section>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>{text.sections.basic}</h3>
                <label className="field" style={{ maxWidth: 480 }}>
                  <span>{text.name}</span>
                  <input
                    type="text"
                    value={form.name_ar}
                    onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                    aria-invalid={!!fieldErrors.name}
                    autoFocus
                  />
                  {fieldErrors.name ? <small className="field__error">{fieldErrors.name}</small> : <small className="table-secondary">{text.nameHint ?? ''}</small>}
                </label>
                <label className="field" style={{ maxWidth: 480 }}>
                  <span>{text.desc}</span>
                  <input type="text" value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} />
                  <small className="table-secondary">{text.descHint}</small>
                </label>
              </section>

              <section>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>{text.sections.scope}</h3>
                <div role="radiogroup" aria-label={text.scopeType} style={{ display: 'grid', gap: 8 }}>
                  {(['platform', 'planet', 'department'] as ScopeType[]).map((v) => (
                    <label key={v} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 10, border: form.scopeType === v ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 8 }}>
                      <input type="radio" name="scopeType" value={v} checked={form.scopeType === v} onChange={() => setForm({ ...form, scopeType: v })} />
                      <div>
                        <strong>{text.scopeTypes[v]}</strong>
                        <div className="table-secondary" style={{ fontSize: 12 }}>{text.scopeHelp[v]}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {form.scopeType === 'planet' && (
                  <label className="field" style={{ maxWidth: 380, marginTop: 12 }}>
                    <span>{text.planet} *</span>
                    <select value={form.planet_id} onChange={(e) => setForm({ ...form, planet_id: e.target.value })} aria-invalid={!!fieldErrors.scope}>
                      <option value="">{text.noPlanet}</option>
                      {planets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name_ar}
                        </option>
                      ))}
                    </select>
                    <small className="table-secondary">{text.planetHint}</small>
                    {fieldErrors.scope ? <small className="field__error">{fieldErrors.scope}</small> : null}
                  </label>
                )}
                {form.scopeType === 'department' && (
                  <label className="field" style={{ maxWidth: 380, marginTop: 12 }}>
                    <span>{text.section} *</span>
                    <input type="text" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} aria-invalid={!!fieldErrors.scope} />
                    <small className="table-secondary">{text.sectionHint}</small>
                    {fieldErrors.scope ? <small className="field__error">{fieldErrors.scope}</small> : null}
                  </label>
                )}
                {form.scopeType === 'platform' && <p className="table-secondary" style={{ fontSize: 12, marginTop: 8 }}>{text.scopeHelp.platform}</p>}
              </section>

              <section>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>{text.sections.members}</h3>
                <p className="table-secondary" style={{ fontSize: 12 }}>{text.membersHint}</p>
              </section>

              <section style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>
                <h3 style={{ fontSize: 14 }}>{text.sections.review}</h3>
                <p style={{ fontSize: 13 }}>
                  {text.reviewScope} <strong>{form.scopeType === 'platform' ? text.scopePlatform : form.scopeType === 'planet' ? text.scopePlanet(planets.find((p) => p.id === form.planet_id)?.name_ar ?? '—') : text.scopeDepartment(form.section || '—')}</strong>
                </p>
              </section>

              {formError ? <p className="field__error" role="alert">{formError}</p> : null}
            </div>

            <footer className="drawer__footer" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="button button--ghost" type="button" onClick={() => setDrawerOpen(false)}>
                {text.cancel}
              </button>
              <button className="button button--primary" type="button" disabled={saving} onClick={() => void handleCreate()}>
                {saving ? text.saving : text.save}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
