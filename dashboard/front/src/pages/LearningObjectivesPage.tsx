import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber, trackLabel, trackLabels } from '../lib/labels'
import type { AgeTrack, LearningObjectiveRecord, SkillRecord } from '../types/api'

const ALL_TRACKS: AgeTrack[] = ['preschool', 'kids', 'junior']
const TRACK_BOUNDS: Record<AgeTrack, [number, number]> = {
  preschool: [3, 5],
  kids: [6, 8],
  junior: [9, 12],
}

function tracksForRange(a: number, b: number): AgeTrack[] {
  return ALL_TRACKS.filter((t) => {
    const [l, h] = TRACK_BOUNDS[t]
    return a <= h && b >= l
  })
}

const copy = {
  ar: {
    eyebrow: 'الإطار التعليمي والتربوي',
    title: 'الأهداف التعليمية القابلة للقياس',
    intro: 'كل هدف يمثل ناتجًا تعليميًا محددًا وقابلاً للقياس — مربوط بمهارة، مسار عمري، ومحتوى يولّد دليل إتقان.',
    add: 'هدف تعليمي جديد',
    refresh: 'تحديث البيانات',
    total: 'إجمالي الأهداف',
    withoutSkill: 'بدون مهارة',
    withoutContent: 'بدون محتوى',
    withGames: 'لها ألعاب تفاعلية',
    allTracks: 'كل المسارات العمرية',
    allSkills: 'كل المهارات',
    search: 'بحث برمز الهدف أو العنوان...',
    code: 'الرمز',
    objective: 'الهدف التعليمي',
    skill: 'المهارة',
    ages: 'المدى العمري',
    tracks: 'المسارات',
    linked: 'المحتوى المرتبط',
    questions: 'الأسئلة',
    mastery: 'الإتقان',
    health: 'الحالة',
    edit: 'تعديل',
    remove: 'حذف',
    rederive: 'إعادة اشتقاق المسارات',
    create: 'إنشاء هدف تعليمي',
    editTitle: 'تعديل بيانات الهدف التعليمي',
    cardsView: 'بطاقات الأهداف',
    tableView: 'الجدول المفصل',
    empty: 'لا توجد أهداف تعليمية مطابقة',
    emptyDesc: 'يمكنك إضافة هدف جديد ثم ربطه بالمحتوى والألعاب التقييمية.',
    confirmRemove: 'هل أنت متأكد من حذف هذا الهدف؟ سيتم منعه إن كان مرتبطاً بمحتوى منشور.',
  },
  en: {
    eyebrow: 'Educational Framework',
    title: 'Measurable Learning Objectives',
    intro: 'Every objective is a measurable outcome — linked to a skill, age track, content, and assessments that generate mastery evidence.',
    add: 'New Objective',
    refresh: 'Refresh Data',
    total: 'Total Objectives',
    withoutSkill: 'Without Skill',
    withoutContent: 'Without Content',
    withGames: 'Interactive Games',
    allTracks: 'All Age Tracks',
    allSkills: 'All Skills',
    search: 'Search by code or title...',
    code: 'Code',
    objective: 'Learning Objective',
    skill: 'Skill',
    ages: 'Age Range',
    tracks: 'Tracks',
    linked: 'Linked Content',
    questions: 'Questions',
    mastery: 'Mastery',
    health: 'Status',
    edit: 'Edit',
    remove: 'Delete',
    rederive: 'Re-derive Tracks',
    create: 'Create Objective',
    editTitle: 'Edit Learning Objective',
    cardsView: 'Objective Cards',
    tableView: 'Detailed Table',
    empty: 'No matching learning objectives',
    emptyDesc: 'Create a new objective and link it to content and assessments.',
    confirmRemove: 'Are you sure you want to delete this objective? Blocked if linked to published content.',
  },
}

export function LearningObjectivesPage() {
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [records, setRecords] = useState<LearningObjectiveRecord[]>([])
  const [skills, setSkills] = useState<SkillRecord[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [masteryRows, setMasteryRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState('')
  const [skillId, setSkillId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>({
    code: '',
    title_ar: '',
    skill_id: '',
    age_min: '3',
    age_max: '5',
    description_ar: '',
    measurable_criteria: '',
    track_ids: tracksForRange(3, 5),
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [r, s, q, m] = await Promise.allSettled([
        api.learningObjectives({ q: query, track, skill_id: skillId, limit: 100 } as any),
        api.skills({ limit: 100 } as any),
        api.questions({ limit: 100 } as any),
        api.masteryByObjective({ limit: 100 } as any),
      ])
      if (r.status === 'fulfilled') {
        setRecords((r.value as any).data || [])
        setTotal((r.value as any).meta?.total ?? (r.value as any).data?.length ?? 0)
      }
      if (s.status === 'fulfilled') setSkills((s.value as any).data || [])
      if (q.status === 'fulfilled') setQuestions((q.value as any).data || [])
      if (m.status === 'fulfilled') setMasteryRows((m.value as any).data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الأهداف التعليمية')
    } finally {
      setLoading(false)
    }
  }, [query, track, skillId])

  useEffect(() => {
    const t = setTimeout(() => void load(), 200)
    return () => clearTimeout(t)
  }, [load])

  const metrics = useMemo(() => {
    const totalM = records.length
    const withoutSkill = records.filter((r) => !r.skill_id).length
    const withoutContent = records.filter(
      (r) => Number(r.episodes_count ?? 0) + Number(r.games_count ?? 0) === 0,
    ).length
    const withGames = records.filter((r) => Number(r.games_count ?? 0) > 0).length
    return { totalM, withoutSkill, withoutContent, withGames }
  }, [records])

  const rangeValid = (() => {
    const a = Number(form.age_min)
    const b = Number(form.age_max)
    return Number.isInteger(a) && Number.isInteger(b) && a >= 3 && b <= 12 && b >= a
  })()
  const allowedTracks = rangeValid ? tracksForRange(Number(form.age_min), Number(form.age_max)) : []

  function openCreate() {
    setEditingId(null)
    setForm({
      code: '',
      title_ar: '',
      skill_id: '',
      age_min: '3',
      age_max: '5',
      description_ar: '',
      measurable_criteria: '',
      track_ids: tracksForRange(3, 5),
    })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item: any, e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditingId(item.id)
    setForm({
      code: item.code,
      title_ar: item.title_ar,
      skill_id: item.skill_id ?? '',
      age_min: String(item.age_min),
      age_max: String(item.age_max),
      description_ar: item.description_ar ?? '',
      measurable_criteria: item.measurable_criteria ?? '',
      track_ids: item.track_ids?.length ? item.track_ids : tracksForRange(item.age_min, item.age_max),
    })
    setFormError('')
    setModalOpen(true)
  }

  async function submit(e: any) {
    e.preventDefault()
    if (!form.code.trim() || !form.title_ar.trim()) {
      setFormError('الرمز والعنوان مطلوبان')
      return
    }
    if (!rangeValid) {
      setFormError('المدى العمري يجب أن يكون بين 3 و 12 سنة')
      return
    }
    if (!form.track_ids.length) {
      setFormError('يرجى اختيار مسار عمري واحد على الأقل')
      return
    }
    setSaving(true)
    setFormError('')
    const payload = {
      code: form.code.trim(),
      title_ar: form.title_ar.trim(),
      skill_id: form.skill_id || null,
      age_min: Number(form.age_min),
      age_max: Number(form.age_max),
      description_ar: form.description_ar.trim() || null,
      measurable_criteria: form.measurable_criteria.trim() || null,
      track_ids: form.track_ids,
    }
    try {
      if (editingId) await api.updateLearningObjective(editingId, payload as any)
      else await api.createLearningObjective(payload as any)
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: any, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!window.confirm(text.confirmRemove)) return
    try {
      await api.deleteLearningObjective(item.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الهدف')
    }
  }

  if (loading && !records.length) return <LoadingState label="جارٍ تحميل الأهداف التعليمية..." />
  if (error && !records.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div className="catalog-hero__glow" style={{ background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(99, 102, 241, 0.1) 60%, transparent 80%)' }} />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#10b981' }} />
              {formatNumber(total, locale as any)} هدف نشط
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.intro}</p>
        </div>
        <div className="catalog-hero__actions">
          <button className="button button--secondary" onClick={() => void load()} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="refresh" size={15} />
            <span>{text.refresh}</span>
          </button>
          <button className="cs-btn-primary" onClick={openCreate}>
            <Icon name="plus" size={16} />
            <span>{text.add}</span>
          </button>
        </div>
      </section>

      {/* 2. Side-by-side Bento Live Metric KPI Strip */}
      <div className="hero-kpis">
        <div className="kpi-glass-card" onClick={() => { setTrack(''); setSkillId(''); }} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="objectives" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.total}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.totalM, locale as any)}</div>
            <span className="kpi-glass-card__trend">
              <Icon name="check" size={12} /> أهداف تربوية معتمدة
            </span>
          </div>
        </div>

        <div className="kpi-glass-card" onClick={() => setSkillId('')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
            <Icon name="warning" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.withoutSkill}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.withoutSkill, locale as any)}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#f87171' }}>
              <Icon name="warning" size={12} /> غير مربوطة بمهارة رئيسية
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Icon name="layers" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.withoutContent}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.withoutContent, locale as any)}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#fbbf24' }}>
              <Icon name="info" size={12} /> بحاجة لحلقات أو أنشطة
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Icon name="games" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.withGames}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.withGames, locale as any)}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#818cf8' }}>
              <Icon name="check" size={12} /> تولّد أدلة إتقان تفاعلية
            </span>
          </div>
        </div>
      </div>

      {/* 3. Catalog Quick Filter Strip */}
      <section className="catalog-control-strip">
        <div className="catalog-control-strip__left">
          <div className="filter-pill-group">
            <button
              className={`filter-pill ${track === '' ? 'filter-pill--active' : ''}`}
              onClick={() => setTrack('')}
            >
              {text.allTracks}
            </button>
            {ALL_TRACKS.map((t) => (
              <button
                key={t}
                className={`filter-pill ${track === t ? 'filter-pill--active' : ''}`}
                onClick={() => setTrack(t)}
              >
                {trackLabels[locale][t]}
              </button>
            ))}
          </div>

          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--cs-glass-border)',
              color: 'var(--text)',
              fontSize: 13,
            }}
          >
            <option value="">{text.allSkills}</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-control-strip__right">
          <div className="search-field" style={{ minWidth: 260 }}>
            <Icon name="search" size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={text.search}
            />
          </div>

          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${view === 'cards' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setView('cards')}
            >
              <Icon name="grid" size={14} />
              <span>{text.cardsView}</span>
            </button>
            <button
              className={`view-mode-btn ${view === 'table' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setView('table')}
            >
              <Icon name="bars" size={14} />
              <span>{text.tableView}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4. Objectives Content */}
      {records.length === 0 ? (
        <EmptyState title={text.empty} description={text.emptyDesc} />
      ) : view === 'cards' ? (
        <div className="objectives-studio-grid">
          {records.map((item) => {
            const qCount = questions.filter((q) => q.learning_objective_id === item.id).length
            const hasCriterion = !!item.measurable_criteria?.trim()
            const epCount = Number(item.episodes_count ?? 0)
            const gmCount = Number(item.games_count ?? 0)

            return (
              <article key={item.id} className="objective-card-item">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'rgba(99, 102, 241, 0.12)',
                      color: '#818cf8',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                    }}
                  >
                    {item.code}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {item.track_ids?.map((t: string) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--surface-3)',
                          color: 'var(--text-soft)',
                        }}
                      >
                        {trackLabel(locale, t)}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <Link
                    to={adminPath(`objectives/${item.id}`)}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <h3 style={{ margin: '0 0 6px', fontSize: 16.5, fontWeight: 800, color: 'var(--text)' }}>
                      {item.title_ar}
                    </h3>
                  </Link>
                  <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                    {item.skill_name ? `المهارة: ${item.skill_name}` : 'غير مربوط بمهارة'}
                  </div>
                </div>

                {hasCriterion ? (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--surface-2)',
                      fontSize: 11.5,
                      color: 'var(--text-soft)',
                      lineHeight: 1.4,
                      borderInlineStart: '3px solid #10b981',
                    }}
                  >
                    <strong style={{ color: '#10b981', display: 'block', marginBottom: 2 }}>معيار القياس:</strong>
                    {item.measurable_criteria}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(239, 68, 68, 0.08)',
                      fontSize: 11,
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    لا يوجد معيار قياس محدد — يحتاج لصياغة شرط النجاح
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 6,
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--surface-2)',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{epCount}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>حلقة</div>
                  </div>
                  <div style={{ textAlign: 'center', borderInline: '1px solid var(--cs-glass-border)' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{gmCount}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>لعبة</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{qCount}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>سؤال</div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 10,
                    borderTop: '1px solid var(--cs-glass-border)',
                    marginTop: 'auto',
                  }}
                >
                  <Link
                    to={adminPath(`objectives/${item.id}`)}
                    className="button button--primary button--small"
                    style={{ textDecoration: 'none' }}
                  >
                    <span>مساحة العمل</span>
                  </Link>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="button button--ghost button--small"
                      onClick={(e) => openEdit(item, e)}
                      title={text.edit}
                    >
                      <Icon name="edit" size={13} />
                      <span>{text.edit}</span>
                    </button>
                    <button
                      className="icon-button icon-button--small icon-button--danger"
                      onClick={(e) => remove(item, e)}
                      title={text.remove}
                    >
                      <Icon name="archive" size={13} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.objective}</th>
                  <th>{text.skill}</th>
                  <th>{text.ages}</th>
                  <th>{text.tracks}</th>
                  <th>معيار القياس</th>
                  <th>{text.linked}</th>
                  <th>{text.questions}</th>
                  <th>{text.mastery}</th>
                  <th>{text.health}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((item) => {
                  const qCount = questions.filter((q) => q.learning_objective_id === item.id).length
                  const mRow = masteryRows.find((m: any) => m.id === item.id)
                  const hasCriterion = !!item.measurable_criteria?.trim()
                  const hasContent = Number(item.episodes_count ?? 0) + Number(item.games_count ?? 0) > 0
                  const hasAssessment = qCount > 0
                  const hasEvidence = Number(mRow?.attempts ?? 0) > 0
                  const health = !hasCriterion
                    ? 'بدون معيار'
                    : !hasContent
                    ? 'بدون محتوى'
                    : !hasAssessment
                    ? 'بدون تقييم'
                    : !hasEvidence
                    ? 'بدون دليل'
                    : 'جيد'

                  return (
                    <tr key={item.id}>
                      <td>
                        <Link to={adminPath(`objectives/${item.id}`)} style={{ textDecoration: 'none' }}>
                          <strong>{item.title_ar}</strong>
                          <br />
                          <small className="table-secondary" dir="ltr">
                            {item.code}
                          </small>
                        </Link>
                      </td>
                      <td>
                        {item.skill_name ? (
                          <span className="track-badge">{item.skill_name}</span>
                        ) : (
                          <span className="table-secondary">—</span>
                        )}
                      </td>
                      <td dir="ltr">
                        {item.age_min}–{item.age_max}
                      </td>
                      <td>
                        {item.track_ids?.length ? (
                          <div className="badge-row">
                            {item.track_ids.map((v: string) => (
                              <span key={v} className={`track-badge track-badge--${v}`}>
                                {trackLabel(locale, v)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {hasCriterion ? (
                          <span className="prod-chip prod-chip--complete">✓ معتمد</span>
                        ) : (
                          <span className="prod-chip prod-chip--blocked">غير محدد</span>
                        )}
                      </td>
                      <td>
                        <span className="table-secondary">
                          {formatNumber(Number(item.episodes_count ?? 0), locale as any)} حلقة ·{' '}
                          {formatNumber(Number(item.games_count ?? 0), locale as any)} لعبة
                        </span>
                      </td>
                      <td>
                        {qCount ? (
                          <Link to={adminPath(`quiz?objective_id=${item.id}`)} className="prod-chip prod-chip--complete">
                            {qCount} سؤال
                          </Link>
                        ) : (
                          <span className="table-secondary">0</span>
                        )}
                      </td>
                      <td>
                        {hasEvidence ? (
                          <Link to={adminPath('mastery')} className="table-secondary">
                            {mRow.attempts} محاولات
                          </Link>
                        ) : (
                          <span className="table-secondary">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`prod-chip ${health === 'جيد' ? 'prod-chip--complete' : 'prod-chip--blocked'}`}
                        >
                          {health}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Link className="button button--ghost button--small" to={adminPath(`objectives/${item.id}`)}>
                            فتح
                          </Link>
                          <button
                            className="icon-button icon-button--small"
                            title={text.edit}
                            onClick={() => openEdit(item)}
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            className="icon-button icon-button--small icon-button--danger"
                            title={text.remove}
                            onClick={() => void remove(item)}
                          >
                            <Icon name="archive" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add / Edit Objective Modal */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? text.editTitle : text.create}
      >
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>رمز الهدف البرمجي *</span>
              <input
                dir="ltr"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="مثال: LO-SHAPES-01"
              />
            </label>
            <label className="field">
              <span>عنوان الهدف التعليمي *</span>
              <input
                value={form.title_ar}
                onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
                placeholder="مثال: تمييز المثلث والمربع والدائرة في البيئة المحيطة"
              />
            </label>
          </div>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>المهارة التابعة لها</span>
              <select
                value={form.skill_id}
                onChange={(e) => setForm({ ...form, skill_id: e.target.value })}
              >
                <option value="">بلا مهارة</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name_ar}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>أدنى عمر (سنوات) *</span>
              <input
                type="number"
                min={3}
                max={12}
                value={form.age_min}
                onChange={(e) =>
                  setForm({
                    ...form,
                    age_min: e.target.value,
                    track_ids: (() => {
                      const a = Number(e.target.value)
                      const b = Number(form.age_max)
                      if (Number.isInteger(a) && Number.isInteger(b) && a >= 3 && b <= 12 && b >= a)
                        return tracksForRange(a, b)
                      return form.track_ids
                    })(),
                  })
                }
              />
            </label>
            <label className="field">
              <span>أقصى عمر (سنوات) *</span>
              <input
                type="number"
                min={3}
                max={12}
                value={form.age_max}
                onChange={(e) =>
                  setForm({
                    ...form,
                    age_max: e.target.value,
                    track_ids: (() => {
                      const a = Number(form.age_min)
                      const b = Number(e.target.value)
                      if (Number.isInteger(a) && Number.isInteger(b) && a >= 3 && b <= 12 && b >= a)
                        return tracksForRange(a, b)
                      return form.track_ids
                    })(),
                  })
                }
              />
            </label>
          </div>
          <fieldset className="field">
            <span>المسارات العمرية المستهدفة</span>
            <div className="checkbox-row">
              {ALL_TRACKS.map((v) => {
                const allowed = allowedTracks.includes(v)
                return (
                  <label
                    key={v}
                    className={`checkbox-chip ${allowed ? '' : 'checkbox-chip--disabled'}`}
                  >
                    <input
                      type="checkbox"
                      checked={form.track_ids.includes(v)}
                      disabled={!allowed}
                      onChange={() =>
                        setForm((c: any) => ({
                          ...c,
                          track_ids: c.track_ids.includes(v)
                            ? c.track_ids.filter((x: any) => x !== v)
                            : [...c.track_ids, v],
                        }))
                      }
                    />
                    <span>{trackLabels[locale][v]}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <label className="field">
            <span>الوصف والتفاصيل</span>
            <textarea
              rows={2}
              value={form.description_ar}
              onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
              placeholder="وصف إضافي لطريقة تنفيذ هذا الهدف في المحتوى..."
            />
          </label>
          <label className="field">
            <span>معيار القياس التجريبي *</span>
            <textarea
              rows={2}
              value={form.measurable_criteria}
              onChange={(e) => setForm({ ...form, measurable_criteria: e.target.value })}
              placeholder="إجراء/شرط/معيار نجاح: مثال: يتعرف الطفل بنجاح على ٤ أشكال من أصل ٥ في لعبة التوصيل."
            />
          </label>
          <div className="form-actions">
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setModalOpen(false)}
            >
              إلغاء
            </button>
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? 'جارٍ الحفظ...' : 'حفظ الهدف'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
