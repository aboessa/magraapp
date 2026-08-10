import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { formatNumber, trackLabels } from '../lib/labels'
import type { AgeTrack, LearningObjectiveRecord, SkillRecord } from '../types/api'

/**
 * الأهداف التعليمية القابلة للقياس.
 *
 * ## لماذا كانت هذه الصفحة غائبة
 *
 * المسارات الخمسة في adminCatalogue.ts — بما فيها `tracks/rederive` — كانت بلا
 * أي مستدعٍ في الواجهة، فكان عنصر «الأهداف القابلة للقياس» معطَّلًا بلافتة
 * «قريبًا» بينما الخادم كامل.
 *
 * ## قاعدة المسارات العمرية: مشتقّة لا مُدخَلة
 *
 * `learning_objective_tracks` لا يُكتَب يدويًا. الخادم يشتقّ المسارات من المدى
 * العمري (`tracksForRange`)، ومدى 5–6 يلمس preschool وkids فيُنتجهما معًا.
 *
 * وقاعدة التضييق: قائمة صريحة **تُضيّق** المشتقّ ولا تتجاوزه أبدًا — لا يمكن
 * إضافة مسار لا يصل إليه المدى العمري. لذلك تُعرض المسارات المشتقّة هنا
 * كصناديق اختيار مُحدَّدة سلفًا، ويُمنع اختيار ما هو خارج المدى بدل إرساله
 * وانتظار 400.
 *
 * ## الحذف
 *
 * الخادم يرفض بـ409 عند وجود ارتباطات، ويميّز حالتين: محتوى **منشور** (رفض
 * قاطع) ومحتوى غير منشور (يُطلب فصله أولًا). الرسالة تُعرض كما وردت لأنها تحمل
 * الأعداد.
 */

const AGE_MIN = 3
const AGE_MAX = 12
const ALL_TRACKS: AgeTrack[] = ['preschool', 'kids', 'junior']
/// حدود كل مسار، مطابقة لـTRACK_BOUNDS في lib/catalogueValidation.ts
const TRACK_BOUNDS: Record<AgeTrack, [number, number]> = {
  preschool: [3, 5],
  kids: [6, 8],
  junior: [9, 12],
}

/// نفس منطق `tracksForRange` في الخادم: كل مسار يتقاطع مع المدى.
/// مكرَّر هنا عن قصد لمنع إرسال ما سيُرفض، والخادم يبقى المرجع النهائي.
function tracksForRange(ageMin: number, ageMax: number): AgeTrack[] {
  return ALL_TRACKS.filter((track) => {
    const [low, high] = TRACK_BOUNDS[track]
    return ageMin <= high && ageMax >= low
  })
}

const copy = {
  ar: {
    eyebrow: 'الإطار التعليمي',
    title: 'الأهداف القابلة للقياس',
    intro: 'كل هدف مربوط بمهارة ومدى عمري، وتُشتقّ منه المسارات العمرية تلقائيًا.',
    add: 'هدف جديد',
    refresh: 'تحديث',
    list: 'الأهداف',
    total: 'الإجمالي',
    search: 'رمز أو عنوان...',
    allTracks: 'كل المسارات',
    allSkills: 'كل المهارات',
    code: 'الرمز',
    objective: 'الهدف',
    skill: 'المهارة',
    ages: 'المدى العمري',
    tracks: 'المسارات',
    linked: 'المحتوى المرتبط',
    edit: 'تعديل',
    remove: 'حذف',
    rederive: 'إعادة اشتقاق المسارات',
    create: 'إنشاء هدف',
    editTitle: 'تعديل الهدف',
    codeField: 'الرمز *',
    codeHint: 'فريد. مثل LO-READ-01.',
    titleField: 'العنوان بالعربية *',
    skillField: 'المهارة',
    noSkill: 'بلا مهارة',
    ageMinField: 'أدنى عمر *',
    ageMaxField: 'أقصى عمر *',
    tracksField: 'المسارات العمرية',
    tracksHint: 'مشتقّة من المدى العمري. يمكن تضييقها لا توسيعها.',
    descriptionField: 'الوصف',
    criteriaField: 'معيار القياس',
    criteriaHint: 'كيف نعرف أن الطفل حقّق الهدف؟',
    cancel: 'إلغاء',
    save: 'حفظ',
    required: 'الرمز والعنوان مطلوبان.',
    rangeError: 'المدى العمري يجب أن يكون بين 3 و12، والأقصى ≥ الأدنى.',
    tracksRequired: 'اختر مسارًا واحدًا على الأقل.',
    loading: 'جارٍ تحميل الأهداف...',
    loadError: 'تعذر تحميل الأهداف',
    saveError: 'تعذر حفظ الهدف',
    empty: 'لا أهداف بعد',
    emptyDesc: 'أنشئ أول هدف تعليمي، ثم اربط به حلقات وألعابًا ومشروعات.',
    confirmRemove: 'سيُحذف هذا الهدف نهائيًا مع صفوف مساراته. متابعة؟',
    noTracks: 'بلا مسارات',
    noTracksHint: 'استخدم «إعادة اشتقاق المسارات».',
    episodes: 'حلقة',
    games: 'لعبة',
  },
  en: {
    eyebrow: 'Learning framework',
    title: 'Measurable objectives',
    intro: 'Each objective links to a skill and an age range, and its age tracks are derived automatically.',
    add: 'New objective',
    refresh: 'Refresh',
    list: 'Objectives',
    total: 'Total',
    search: 'Code or title...',
    allTracks: 'All tracks',
    allSkills: 'All skills',
    code: 'Code',
    objective: 'Objective',
    skill: 'Skill',
    ages: 'Age range',
    tracks: 'Tracks',
    linked: 'Linked content',
    edit: 'Edit',
    remove: 'Delete',
    rederive: 'Re-derive tracks',
    create: 'Create objective',
    editTitle: 'Edit objective',
    codeField: 'Code *',
    codeHint: 'Unique. For example LO-READ-01.',
    titleField: 'Arabic title *',
    skillField: 'Skill',
    noSkill: 'No skill',
    ageMinField: 'Minimum age *',
    ageMaxField: 'Maximum age *',
    tracksField: 'Age tracks',
    tracksHint: 'Derived from the age range. Can be narrowed, never widened.',
    descriptionField: 'Description',
    criteriaField: 'Measurable criteria',
    criteriaHint: 'How do we know the child met this objective?',
    cancel: 'Cancel',
    save: 'Save',
    required: 'Code and title are required.',
    rangeError: 'Age range must be within 3–12, with maximum ≥ minimum.',
    tracksRequired: 'Select at least one track.',
    loading: 'Loading objectives...',
    loadError: 'Unable to load objectives',
    saveError: 'Unable to save objective',
    empty: 'No objectives yet',
    emptyDesc: 'Create the first learning objective, then link episodes, games and projects to it.',
    confirmRemove: 'This objective and its track rows will be permanently deleted. Continue?',
    noTracks: 'No tracks',
    noTracksHint: 'Use “Re-derive tracks”.',
    episodes: 'episode(s)',
    games: 'game(s)',
  },
}

type ObjectiveForm = {
  code: string
  title_ar: string
  skill_id: string
  age_min: string
  age_max: string
  description_ar: string
  measurable_criteria: string
  track_ids: AgeTrack[]
}

const emptyForm: ObjectiveForm = {
  code: '',
  title_ar: '',
  skill_id: '',
  age_min: '3',
  age_max: '12',
  description_ar: '',
  measurable_criteria: '',
  track_ids: ALL_TRACKS,
}

export function LearningObjectivesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [records, setRecords] = useState<LearningObjectiveRecord[]>([])
  const [skills, setSkills] = useState<SkillRecord[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState('')
  const [skillId, setSkillId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ObjectiveForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.learningObjectives({ q: query, track, skill_id: skillId, limit: 100 })
      setRecords(response.data)
      setTotal(response.meta?.total ?? response.data.length)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [query, skillId, text.loadError, track])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  // المهارات تُحمَّل مرة واحدة: تُستخدم في التصفية وفي قائمة النموذج
  useEffect(() => {
    void api.skills({ limit: 100 })
      .then((response) => setSkills(response.data))
      .catch(() => setSkills([]))
  }, [])

  /// المدى الحالي في النموذج والمسارات المسموحة به
  const formMin = Number(form.age_min)
  const formMax = Number(form.age_max)
  const rangeValid = Number.isInteger(formMin) && Number.isInteger(formMax)
    && formMin >= AGE_MIN && formMax <= AGE_MAX && formMax >= formMin
  const allowedTracks = rangeValid ? tracksForRange(formMin, formMax) : []

  /// تغيير المدى يعيد ضبط المسارات على المشتقّ الجديد.
  ///
  /// لازم لا تجميلي: لو بقي مسار محدَّدًا خارج المدى الجديد لرفض الخادم الطلب
  /// بـ«track_ids do not match the age range»، والمسؤول لا يرى سبب الرفض.
  function setAge(field: 'age_min' | 'age_max', value: string) {
    const next = { ...form, [field]: value }
    const min = Number(next.age_min)
    const max = Number(next.age_max)
    if (Number.isInteger(min) && Number.isInteger(max) && min >= AGE_MIN && max <= AGE_MAX && max >= min) {
      next.track_ids = tracksForRange(min, max)
    }
    setForm(next)
  }

  function toggleTrack(value: AgeTrack) {
    setForm((current) => ({
      ...current,
      track_ids: current.track_ids.includes(value)
        ? current.track_ids.filter((item) => item !== value)
        : [...current.track_ids, value],
    }))
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item: LearningObjectiveRecord) {
    setEditingId(item.id)
    setForm({
      code: item.code,
      title_ar: item.title_ar,
      skill_id: item.skill_id ?? '',
      age_min: String(item.age_min),
      age_max: String(item.age_max),
      description_ar: item.description_ar ?? '',
      measurable_criteria: item.measurable_criteria ?? '',
      track_ids: item.track_ids.length ? item.track_ids : tracksForRange(item.age_min, item.age_max),
    })
    setFormError('')
    setModalOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const code = form.code.trim()
    const titleAr = form.title_ar.trim()
    if (!code || !titleAr) { setFormError(text.required); return }
    if (!rangeValid) { setFormError(text.rangeError); return }
    if (!form.track_ids.length) { setFormError(text.tracksRequired); return }

    setSaving(true)
    setFormError('')
    const payload = {
      code,
      title_ar: titleAr,
      skill_id: form.skill_id || null,
      age_min: formMin,
      age_max: formMax,
      description_ar: form.description_ar.trim() || null,
      measurable_criteria: form.measurable_criteria.trim() || null,
      track_ids: form.track_ids,
    }
    try {
      if (editingId) await api.updateLearningObjective(editingId, payload)
      else await api.createLearningObjective(payload)
      setModalOpen(false)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: LearningObjectiveRecord) {
    if (!window.confirm(text.confirmRemove)) return
    try {
      await api.deleteLearningObjective(item.id)
      await load()
    } catch (caught) {
      // 409 يحمل أعداد الحلقات والألعاب والمشروعات المرتبطة، فيُعرض كما ورد
      setError(caught instanceof Error ? caught.message : text.saveError)
    }
  }

  async function rederive(item: LearningObjectiveRecord) {
    try {
      await api.rederiveObjectiveTracks(item.id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.saveError)
    }
  }

  if (loading && !records.length) return <LoadingState label={text.loading} />
  if (error && !records.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--secondary" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={17} />{text.refresh}
          </button>
          <button className="button button--primary" type="button" onClick={openCreate}>
            <Icon name="plus" size={17} />{text.add}
          </button>
        </div>
      </section>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{text.list}</span>
            <h3>{text.total} <span className="title-count">{formatNumber(total, locale)}</span></h3>
          </div>
          <div className="filters-row">
            <label className="search-field">
              <Icon name="search" size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} />
            </label>
            <select value={track} onChange={(event) => setTrack(event.target.value)}>
              <option value="">{text.allTracks}</option>
              {ALL_TRACKS.map((item) => <option value={item} key={item}>{trackLabels[locale][item]}</option>)}
            </select>
            <select value={skillId} onChange={(event) => setSkillId(event.target.value)}>
              <option value="">{text.allSkills}</option>
              {skills.map((item) => <option value={item.id} key={item.id}>{item.name_ar}</option>)}
            </select>
          </div>
        </header>

        {records.length ? (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.code}</th>
                  <th>{text.objective}</th>
                  <th>{text.skill}</th>
                  <th>{text.ages}</th>
                  <th>{text.tracks}</th>
                  <th>{text.linked}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((item) => (
                  <tr key={item.id}>
                    <td><span className="table-primary" dir="ltr">{item.code}</span></td>
                    <td>
                      <div>
                        <strong>{item.title_ar}</strong>
                        {item.measurable_criteria && <small className="table-secondary">{item.measurable_criteria}</small>}
                      </div>
                    </td>
                    <td>
                      {item.skill_name
                        ? <span className="track-badge">{item.skill_name}</span>
                        : <span className="table-secondary">—</span>}
                    </td>
                    <td dir="ltr">{item.age_min}–{item.age_max}</td>
                    <td>
                      {item.track_ids.length ? (
                        <div className="badge-row">
                          {item.track_ids.map((value) => (
                            <span className={`track-badge track-badge--${value}`} key={value}>
                              {trackLabels[locale][value]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        // 116 هدفًا حُمِّلت باستيراد جماعي بلا صفوف مسارات، فالحالة واقعية
                        <span className="table-secondary" title={text.noTracksHint}>{text.noTracks}</span>
                      )}
                    </td>
                    <td>
                      <span className="table-secondary">
                        {formatNumber(Number(item.episodes_count ?? 0), locale)} {text.episodes}
                        {' · '}
                        {formatNumber(Number(item.games_count ?? 0), locale)} {text.games}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {!item.track_ids.length && (
                          <button className="icon-button icon-button--small" type="button" title={text.rederive} onClick={() => void rederive(item)}>
                            <Icon name="refresh" size={15} />
                          </button>
                        )}
                        <button className="icon-button icon-button--small" type="button" title={text.edit} onClick={() => openEdit(item)}>
                          <Icon name="edit" size={15} />
                        </button>
                        <button className="icon-button icon-button--small icon-button--danger" type="button" title={text.remove} onClick={() => void remove(item)}>
                          <Icon name="archive" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title={text.empty} description={text.emptyDesc} />}
      </section>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? text.editTitle : text.create}
      >
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>{text.codeField}</span>
              <input autoFocus dir="ltr" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
              <small>{text.codeHint}</small>
            </label>
            <label className="field">
              <span>{text.titleField}</span>
              <input value={form.title_ar} onChange={(event) => setForm({ ...form, title_ar: event.target.value })} />
            </label>
          </div>

          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.skillField}</span>
              <select value={form.skill_id} onChange={(event) => setForm({ ...form, skill_id: event.target.value })}>
                <option value="">{text.noSkill}</option>
                {skills.map((item) => <option value={item.id} key={item.id}>{item.name_ar}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.ageMinField}</span>
              <input type="number" min={AGE_MIN} max={AGE_MAX} value={form.age_min} onChange={(event) => setAge('age_min', event.target.value)} />
            </label>
            <label className="field">
              <span>{text.ageMaxField}</span>
              <input type="number" min={AGE_MIN} max={AGE_MAX} value={form.age_max} onChange={(event) => setAge('age_max', event.target.value)} />
            </label>
          </div>

          <fieldset className="field">
            <span>{text.tracksField}</span>
            <div className="checkbox-row">
              {ALL_TRACKS.map((value) => {
                const allowed = allowedTracks.includes(value)
                return (
                  <label className={`checkbox-chip ${allowed ? '' : 'checkbox-chip--disabled'}`} key={value}>
                    <input
                      type="checkbox"
                      checked={form.track_ids.includes(value)}
                      // خارج المدى: معطَّل لأن الخادم يرفضه على أي حال
                      disabled={!allowed}
                      onChange={() => toggleTrack(value)}
                    />
                    <span>{trackLabels[locale][value]}</span>
                  </label>
                )
              })}
            </div>
            <small>{text.tracksHint}</small>
          </fieldset>

          <label className="field">
            <span>{text.descriptionField}</span>
            <textarea rows={3} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })} />
          </label>
          <label className="field">
            <span>{text.criteriaField}</span>
            <textarea rows={3} value={form.measurable_criteria} onChange={(event) => setForm({ ...form, measurable_criteria: event.target.value })} />
            <small>{text.criteriaHint}</small>
          </label>

          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setModalOpen(false)}>{text.cancel}</button>
            <button className="button button--primary" type="submit" disabled={saving}>{text.save}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
