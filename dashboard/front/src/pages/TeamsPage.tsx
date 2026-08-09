import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import type { Planet, TeamRecord } from '../types/api'

/**
 * الفرق وأعضاؤها.
 *
 * ## ما كانت عليه
 *
 * `(api as any).teams?.()` — و`api.teams` لم يكن موجودًا، فكانت النتيجة
 * `undefined` ويعمل الاحتياطي دائمًا: `fetch('/api/v1/admin/teams')` بمسار
 * نسبي يذهب إلى majarra.app فيرجع HTML، فيرمي `r.json()`، فيمسك `catch`
 * ويضع **فريقين مخترعين** بأعداد أعضاء مخترعة (3 و2). الكاست `as any` هو ما
 * أخفى الخطأ عن المُصرِّف.
 *
 * وكان الإنشاء يثبّت `planet_id: 'qisas'` لكل فريق أيًا كان الغرض، والاستجابة
 * لا تُفحَص فتُمسح الخانة ويُعاد التحميل حتى عند الفشل.
 *
 * ## ما صارت عليه
 *
 * `api.teams()` حقيقي، والكوكب يُختار من قائمة الكواكب الفعلية، والفشل يظهر.
 */

const copy = {
  ar: {
    eyebrow: 'الفرق والأعضاء',
    title: 'إدارة الفرق',
    lede: 'كل فريق له نطاق (كوكب أو قسم). المنح الممنوحة للفريق تنتقل إلى كل أعضائه.',
    add: 'فريق جديد',
    name: 'اسم الفريق',
    planet: 'الكوكب',
    section: 'القسم',
    noPlanet: 'بلا كوكب',
    members: (n: number) => `${n} أعضاء`,
    create: 'إنشاء',
    creating: 'جارٍ الإنشاء…',
    cancel: 'إلغاء',
    created: 'أُنشئ الفريق',
    empty: 'لا فرق بعد',
    emptyHint: 'أنشئ فريقًا لتجميع الموظفين تحت نطاق واحد.',
    loadError: 'تعذر تحميل الفرق',
    nameRequired: 'اسم الفريق مطلوب',
  },
  en: {
    eyebrow: 'Teams and members',
    title: 'Team management',
    lede: 'Each team has a scope (planet or section). Grants given to a team apply to all its members.',
    add: 'New team',
    name: 'Team name',
    planet: 'Planet',
    section: 'Section',
    noPlanet: 'No planet',
    members: (n: number) => `${n} members`,
    create: 'Create',
    creating: 'Creating…',
    cancel: 'Cancel',
    created: 'Team created',
    empty: 'No teams yet',
    emptyHint: 'Create a team to group staff under a single scope.',
    loadError: 'Unable to load teams',
    nameRequired: 'Team name is required',
  },
}

export function TeamsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [planets, setPlanets] = useState<Planet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name_ar: '', planet_id: '', section: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // الكواكب تُحمَّل معها ليُختار النطاق من قائمة حقيقية بدل قيمة مثبّتة
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

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!form.name_ar.trim()) { setFormError(text.nameRequired); return }
    setSaving(true)
    setFormError('')
    try {
      await api.createTeam({
        name_ar: form.name_ar.trim(),
        // الفراغ يعني «بلا نطاق» ويُرسل null لا نصًا فارغًا
        planet_id: form.planet_id || null,
        section: form.section.trim() || null,
      })
      setOpen(false)
      setForm({ name_ar: '', planet_id: '', section: '' })
      setNotice(text.created)
      await load()
    } catch (caught) {
      // الفشل يظهر ولا تُمسح المدخلات، فلا يفقد المستخدم ما كتبه
      setFormError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
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
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--primary" type="button" onClick={() => { setFormError(''); setOpen(!open) }}>
            <Icon name="plus" size={16} />{text.add}
          </button>
        </div>
      </section>

      {notice ? <section className="panel panel--notice" role="status">{notice}</section> : null}

      {open ? (
        <form className="panel" onSubmit={create}>
          <div className="panel__header"><h3>{text.add}</h3></div>
          <div className="entity-form">
            <div className="form-grid form-grid--three">
              <label className="field">
                <span>{text.name}</span>
                <input
                  type="text"
                  value={form.name_ar}
                  onChange={(event) => setForm({ ...form, name_ar: event.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>{text.planet}</span>
                <select value={form.planet_id} onChange={(event) => setForm({ ...form, planet_id: event.target.value })}>
                  <option value="">{text.noPlanet}</option>
                  {planets.map((planet) => (
                    <option value={planet.id} key={planet.id}>{planet.name_ar}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{text.section}</span>
                <input
                  type="text"
                  value={form.section}
                  onChange={(event) => setForm({ ...form, section: event.target.value })}
                />
              </label>
            </div>

            {formError ? <p className="form-error" role="alert">{formError}</p> : null}

            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setOpen(false)}>{text.cancel}</button>
              <button className="button button--primary" type="submit" disabled={saving}>
                {saving ? text.creating : text.create}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {teams.length ? (
        <div className="taxonomy-grid">
          {teams.map((team) => (
            <article className="taxonomy-card" key={team.id}>
              <span className="taxonomy-card__orb taxonomy-card__orb--square">
                <Icon name="parents" size={18} />
              </span>
              <div>
                <strong>{team.name_ar}</strong>
                <small>{text.members(Number(team.members_count ?? 0))}</small>
              </div>
              <div className="taxonomy-card__meta">
                {team.planet_id ? <span className="track-badge">{team.planet_id}</span> : null}
                {team.section ? <span className="track-badge">{team.section}</span> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title={text.empty} description={text.emptyHint} />
      )}
    </div>
  )
}
