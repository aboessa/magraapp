import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { SkillRecord } from '../types/api'

const DOMAIN_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  cognitive: { ar: 'معرفية', en: 'Cognitive', color: '#6366f1' },
  creative: { ar: 'إبداعية', en: 'Creative', color: '#ec4899' },
  literacy: { ar: 'القراءة والكتابة', en: 'Literacy', color: '#10b981' },
  motor: { ar: 'حركية', en: 'Motor', color: '#f59e0b' },
  numeracy: { ar: 'عددية', en: 'Numeracy', color: '#38bdf8' },
  social: { ar: 'اجتماعية', en: 'Social', color: '#a855f7' },
}

function domainLabel(key: string, locale: string) {
  return DOMAIN_CONFIG[key]?.[locale === 'ar' ? 'ar' : 'en'] ?? key
}

function domainColor(key: string) {
  return DOMAIN_CONFIG[key]?.color ?? '#6366f1'
}

const copy = {
  ar: {
    eyebrow: 'الإطار التعليمي والأكاديمي',
    title: 'خريطة المهارات والنمو الإدراكي',
    intro: 'المهارة ← أهداف قابلة للقياس ← مسارات عمرية ← محتوى مرئي وتفاعلي ← بنك الأسئلة ← مصفوفة الإتقان.',
    total: 'إجمالي المهارات',
    coveredContent: 'مكتملة التغطية',
    noObjectives: 'بدون أهداف',
    noContent: 'بدون محتوى',
    orphanObjectives: 'أهداف بلا مهارة',
    withGames: 'لها ألعاب تقييمية',
    measurable: 'قابلة للقياس',
    map: 'بطاقات المهارات',
    table: 'الجدول الشامل',
    ageView: 'مصفوفة الأعمار',
    matrix: 'تغطية الوسائط',
    search: 'بحث باسم المهارة أو المعرّف...',
    domain: 'المجال',
    allDomains: 'كل المجالات',
    skill: 'المهارة',
    domainCol: 'المجال الإنمائي',
    objectives: 'الأهداف',
    content: 'المحتوى المرئي',
    games: 'الألعاب والأنشطة',
    assessment: 'التقييم',
    health: 'حالة التغطية',
    viewSkill: 'استعراض المهارة',
    edit: 'تعديل',
    create: 'مهارة جديدة',
    createTitle: 'إنشاء مهارة تعليمية جديدة',
    editTitle: 'تعديل بيانات المهارة',
    noAssessment: 'لا يوجد تقييم تفاعلي',
    goodCoverage: 'تغطية ممتازة',
    needsContent: 'تحتاج محتوى إضافي',
  },
  en: {
    eyebrow: 'Educational Framework',
    title: 'Skills & Cognitive Development Map',
    intro: 'Skill → Measurable objectives → Age tracks → Rich media → Question bank → Mastery matrix.',
    total: 'Total Skills',
    coveredContent: 'Full Coverage',
    noObjectives: 'No Objectives',
    noContent: 'No Content',
    orphanObjectives: 'Orphan Objectives',
    withGames: 'Interactive Games',
    measurable: 'Measurable Criteria',
    map: 'Skill Cards',
    table: 'Detailed Table',
    ageView: 'Age Matrix',
    matrix: 'Media Matrix',
    search: 'Search skills by name or ID...',
    domain: 'Domain',
    allDomains: 'All Domains',
    skill: 'Skill',
    domainCol: 'Domain',
    objectives: 'Objectives',
    content: 'Video Content',
    games: 'Games & Activities',
    assessment: 'Assessment',
    health: 'Coverage Health',
    viewSkill: 'View Skill',
    edit: 'Edit',
    create: 'New Skill',
    createTitle: 'Create New Educational Skill',
    editTitle: 'Edit Skill',
    noAssessment: 'No interactive assessment',
    goodCoverage: 'Good Coverage',
    needsContent: 'Needs Content',
  },
}

type View = 'map' | 'table' | 'age' | 'matrix'

export function SkillsPage() {
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const [view, setView] = useState<View>('map')
  const [skills, setSkills] = useState<SkillRecord[]>([])
  const [objectives, setObjectives] = useState<any[]>([])
  const [episodes, setEpisodes] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [selected, setSelected] = useState<SkillRecord | null>(null)
  const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'objectives' | 'age' | 'content' | 'games'>('overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<SkillRecord | null>(null)
  const [form, setForm] = useState({ name_ar: '', category: 'cognitive', description: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, o, e, g] = await Promise.all([
        api.skills({} as any),
        api.learningObjectives({ limit: 100 } as any),
        api.episodes({ limit: 50 } as any),
        api.games({ limit: 50 } as any),
      ])
      setSkills((s as any).data || (s as any))
      setObjectives((o as any).data || [])
      setEpisodes((e as any).data || [])
      setGames((g as any).data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطأ في جلب بيانات المهارات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let arr = [...skills]
    if (query.trim()) {
      const q = query.toLowerCase().trim()
      arr = arr.filter((s) => `${s.name_ar} ${s.id} ${s.description || ''}`.toLowerCase().includes(q))
    }
    if (domainFilter) arr = arr.filter((s) => s.category === domainFilter)
    return arr
  }, [skills, query, domainFilter])

  const metrics = useMemo(() => {
    const total = skills.length
    const noObj = skills.filter((s) => !objectives.some((o) => o.skill_id === s.id)).length
    const coveredContent = skills.filter((s) => {
      const objs = objectives.filter((o) => o.skill_id === s.id).map((o) => o.id)
      return (
        episodes.some((e) => objs.includes((e as any).objective_id)) ||
        games.some((g) => objs.includes((g as any).learning_objective_id))
      )
    }).length
    const withGames = skills.filter((s) => {
      const objs = objectives.filter((o) => o.skill_id === s.id).map((o) => o.id)
      return games.some((g) => objs.includes((g as any).learning_objective_id))
    }).length
    return {
      total,
      noObj,
      coveredContent,
      withGames,
    }
  }, [skills, objectives, episodes, games])

  const ageMatrix = useMemo(() => {
    const tracks = ['preschool', 'kids', 'junior']
    const matrix: Record<string, Record<string, number>> = {}
    for (const s of filtered) {
      matrix[s.id] = {}
      for (const t of tracks) {
        const objs = objectives.filter((o) => o.skill_id === s.id && o.track_ids?.includes(t))
        matrix[s.id][t] = objs.length
      }
    }
    return { tracks, matrix }
  }, [filtered, objectives])

  const openCreate = () => {
    setEditingSkill(null)
    setForm({ name_ar: '', category: 'cognitive', description: '' })
    setModalOpen(true)
  }

  const openEdit = (s: SkillRecord, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingSkill(s)
    setForm({
      name_ar: s.name_ar,
      category: s.category || 'cognitive',
      description: s.description || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name_ar.trim()) return
    try {
      if (editingSkill) {
        // update
        await api.updateSkill?.(editingSkill.id, form as any)
      } else {
        await api.createSkill({
          name_ar: form.name_ar,
          category: form.category,
          description: form.description,
        } as any)
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشلت العملية')
    }
  }

  if (loading) return <LoadingState label="جارٍ تحميل استوديو خريطة المهارات..." />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div className="catalog-hero__glow" />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" />
              {formatNumber(skills.length, locale as any)} مهارة معتمدة
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.intro}</p>
        </div>
        <div className="catalog-hero__actions">
          <button className="cs-btn-primary" onClick={openCreate}>
            <Icon name="plus" size={16} />
            <span>{text.create}</span>
          </button>
        </div>
      </section>

      {/* 2. Side-by-side Bento Live Metric KPI Strip */}
      <div className="hero-kpis">
        <div className="kpi-glass-card" onClick={() => setDomainFilter('')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Icon name="skills" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.total}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.total, locale as any)}</div>
            <span className="kpi-glass-card__trend">
              <Icon name="info" size={12} /> عبر {Object.keys(DOMAIN_CONFIG).length} مجالات نمائية
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="check" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.coveredContent}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.coveredContent, locale as any)}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              <Icon name="check" size={12} /> مدعومة بمحتوى مرئي وألعاب
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
            <Icon name="warning" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.noObjectives}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.noObj, locale as any)}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#f87171' }}>
              <Icon name="warning" size={12} /> بحاجة لربط أهداف تعليمية
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Icon name="objectives" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.withGames}</span>
            <div className="kpi-glass-card__num">{formatNumber(metrics.withGames, locale as any)}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#fbbf24' }}>
              <Icon name="games" size={12} /> ألعاب تقيس نواتج التعلم
            </span>
          </div>
        </div>
      </div>

      {/* 3. Quick Filter Pill Strip */}
      <section className="catalog-control-strip">
        <div className="catalog-control-strip__left">
          <div className="filter-pill-group">
            <button
              className={`filter-pill ${domainFilter === '' ? 'filter-pill--active' : ''}`}
              onClick={() => setDomainFilter('')}
            >
              {text.allDomains} ({skills.length})
            </button>
            {Object.keys(DOMAIN_CONFIG).map((d) => {
              const count = skills.filter((s) => s.category === d).length
              return (
                <button
                  key={d}
                  className={`filter-pill ${domainFilter === d ? 'filter-pill--active' : ''}`}
                  onClick={() => setDomainFilter(d)}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: domainColor(d),
                      marginInlineEnd: 6,
                    }}
                  />
                  {domainLabel(d, locale)} ({count})
                </button>
              )
            })}
          </div>
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
              className={`view-mode-btn ${view === 'map' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setView('map')}
            >
              <Icon name="grid" size={14} />
              <span>{text.map}</span>
            </button>
            <button
              className={`view-mode-btn ${view === 'table' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setView('table')}
            >
              <Icon name="bars" size={14} />
              <span>{text.table}</span>
            </button>
            <button
              className={`view-mode-btn ${view === 'age' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setView('age')}
            >
              <Icon name="children" size={14} />
              <span>{text.ageView}</span>
            </button>
            <button
              className={`view-mode-btn ${view === 'matrix' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setView('matrix')}
            >
              <Icon name="layers" size={14} />
              <span>{text.matrix}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4. Active View Presentation */}
      {view === 'map' && (
        <div className="skills-studio-grid">
          {filtered.map((s) => {
            const objs = objectives.filter((o) => o.skill_id === s.id)
            const contentCount =
              episodes.filter((e) => objs.some((o) => o.id === (e as any).objective_id)).length +
              games.filter((g) => objs.some((o) => o.id === (g as any).learning_objective_id)).length
            const gamesCount = games.filter((g) => objs.some((o) => o.id === (g as any).learning_objective_id)).length
            const coverageScore = Math.min(100, Math.round((objs.length * 20 + contentCount * 15 + gamesCount * 25) || 10))

            return (
              <article key={s.id} className="skill-card-item" onClick={() => setSelected(s)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="skill-domain-pill" style={{ color: domainColor(s.category), borderColor: `${domainColor(s.category)}40` }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: domainColor(s.category) }} />
                    {domainLabel(s.category, locale)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{s.id}</span>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                    {s.name_ar}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.description || 'مهارة أساسية ضمن المسار الإدراكي'}
                  </p>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-soft)', marginBottom: 4 }}>
                    <span>معدل اكتمال المنهج</span>
                    <strong style={{ color: coverageScore > 50 ? '#10b981' : '#f59e0b' }}>{coverageScore}%</strong>
                  </div>
                  <div className="skill-coverage-bar">
                    <div
                      className="skill-coverage-bar__fill"
                      style={{
                        width: `${coverageScore}%`,
                        background: coverageScore > 50 ? 'linear-gradient(90deg, #6366f1, #10b981)' : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{objs.length}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>أهداف</div>
                  </div>
                  <div style={{ textAlign: 'center', borderInline: '1px solid var(--cs-glass-border)' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{contentCount}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>محتوى</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{gamesCount}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>ألعاب</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--cs-glass-border)', marginTop: 'auto' }}>
                  <span style={{ fontSize: 11.5, color: gamesCount > 0 ? '#10b981' : '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name={gamesCount > 0 ? 'check' : 'warning'} size={12} />
                    {gamesCount > 0 ? text.goodCoverage : text.noAssessment}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="button button--ghost button--small"
                      onClick={(e) => openEdit(s, e)}
                      title="تعديل المهارة"
                    >
                      <Icon name="edit" size={13} />
                      <span>{text.edit}</span>
                    </button>
                    <button
                      className="button button--primary button--small"
                      onClick={() => setSelected(s)}
                    >
                      <span>{text.viewSkill}</span>
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {view === 'table' && (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.skill}</th>
                  <th>{text.domainCol}</th>
                  <th>{text.objectives}</th>
                  <th>{text.content}</th>
                  <th>{text.games}</th>
                  <th>{text.assessment}</th>
                  <th>{text.health}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const objs = objectives.filter((o) => o.skill_id === s.id)
                  const contentCount = episodes.filter((e) => objs.some((o) => o.id === (e as any).objective_id)).length
                  const gamesCount = games.filter((g) => objs.some((o) => o.id === (g as any).learning_objective_id)).length
                  return (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name_ar}</strong>
                        <br />
                        <small dir="ltr" style={{ color: 'var(--muted)' }}>{s.id}</small>
                      </td>
                      <td>
                        <span className="skill-domain-pill" style={{ color: domainColor(s.category), borderColor: `${domainColor(s.category)}40` }}>
                          {domainLabel(s.category, locale)}
                        </span>
                      </td>
                      <td>
                        <Link to={adminPath('objectives')} className="prod-chip">
                          {objs.length} أهداف
                        </Link>
                      </td>
                      <td>{contentCount} حلقات</td>
                      <td>{gamesCount} ألعاب</td>
                      <td>{gamesCount > 0 ? 'مقيَّمة تفاعلياً' : text.noAssessment}</td>
                      <td>
                        {objs.length === 0 ? (
                          <span className="prod-chip prod-chip--blocked">بلا أهداف</span>
                        ) : contentCount === 0 ? (
                          <span className="prod-chip prod-chip--blocked">بلا محتوى</span>
                        ) : (
                          <span className="prod-chip prod-chip--complete">مكتملة</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="button button--ghost button--small" onClick={() => openEdit(s)}>
                            <Icon name="edit" size={12} />
                          </button>
                          <button className="button button--primary button--small" onClick={() => setSelected(s)}>
                            {text.viewSkill}
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

      {view === 'age' && (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>المهارة</th>
                  <th>المجال</th>
                  <th>3–5 سنوات (براعم)</th>
                  <th>6–8 سنوات (أطفال)</th>
                  <th>9–12 سنة (يافعين)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name_ar}</strong></td>
                    <td>{domainLabel(s.category, locale)}</td>
                    {ageMatrix.tracks.map((t) => (
                      <td key={t}>
                        {ageMatrix.matrix[s.id]?.[t] ? (
                          <span className="prod-chip prod-chip--complete">
                            {ageMatrix.matrix[s.id][t]} هدف
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'matrix' && (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>المهارة</th>
                  <th>حلقات الرسوم</th>
                  <th>القصص الرقمية</th>
                  <th>الألعاب التعليمية</th>
                  <th>المشاريع والأنشطة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const objs = objectives.filter((o) => o.skill_id === s.id).map((o) => o.id)
                  const ep = episodes.filter((e) => objs.includes((e as any).objective_id)).length
                  const ga = games.filter((g) => objs.includes((g as any).learning_objective_id)).length
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.name_ar}</strong></td>
                      <td>
                        <Link to={adminPath('episodes')} className="prod-chip">
                          {ep} حلقات
                        </Link>
                      </td>
                      <td>0 قصص</td>
                      <td>
                        <Link to={adminPath('games')} className="prod-chip">
                          {ga} ألعاب
                        </Link>
                      </td>
                      <td>0 أنشطة</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Detail Workspace Drawer */}
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <div className="drawer drawer--wide" onClick={(e) => e.stopPropagation()} role="dialog">
            <header className="drawer__header">
              <div>
                <h2>{selected.name_ar}</h2>
                <small dir="ltr">{selected.id} · {domainLabel(selected.category, locale)}</small>
              </div>
              <button className="icon-button" onClick={() => setSelected(null)}>
                <Icon name="close" size={16} />
              </button>
            </header>
            <div className="drawer__body">
              <div className="detail-tabs" role="tablist">
                {(['overview', 'objectives', 'age', 'content', 'games'] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={workspaceTab === t}
                    className={`detail-tab ${workspaceTab === t ? 'detail-tab--active' : ''}`}
                    onClick={() => setWorkspaceTab(t)}
                  >
                    {t === 'overview'
                      ? 'نظرة عامة'
                      : t === 'objectives'
                      ? 'الأهداف التعليمية'
                      : t === 'age'
                      ? 'المسارات العمرية'
                      : t === 'content'
                      ? 'المحتوى المرتبط'
                      : 'الألعاب والتقييم'}
                  </button>
                ))}
              </div>

              {workspaceTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ color: 'var(--text-soft)', lineHeight: 1.6 }}>
                    {selected.description || 'لا يوجد وصف مضاف لهذه المهارة بعد.'}
                  </p>
                  <div className="metric-row">
                    <div className="metric-cell">
                      <strong>{objectives.filter((o) => o.skill_id === selected.id).length}</strong>
                      <span>أهداف مرتبطة</span>
                    </div>
                    <div className="metric-cell">
                      <strong>
                        {
                          episodes.filter((e) =>
                            objectives
                              .filter((o) => o.skill_id === selected.id)
                              .some((o) => o.id === (e as any).objective_id),
                          ).length
                        }
                      </strong>
                      <span>حلقات فيديو</span>
                    </div>
                    <div className="metric-cell">
                      <strong>
                        {
                          games.filter((g) =>
                            objectives
                              .filter((o) => o.skill_id === selected.id)
                              .some((o) => o.id === (g as any).learning_objective_id),
                          ).length
                        }
                      </strong>
                      <span>ألعاب تقييم</span>
                    </div>
                  </div>
                </div>
              )}

              {workspaceTab === 'objectives' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {objectives.filter((o) => o.skill_id === selected.id).length === 0 ? (
                    <p style={{ color: 'var(--muted)' }}>لا توجد أهداف تعليمية مضافة لهذه المهارة.</p>
                  ) : (
                    objectives
                      .filter((o) => o.skill_id === selected.id)
                      .map((o) => (
                        <div
                          key={o.id}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 12,
                            background: 'var(--surface-2)',
                            border: '1px solid var(--cs-glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <strong style={{ display: 'block', fontSize: 14 }}>{o.title_ar}</strong>
                            <small style={{ color: 'var(--muted)' }}>{o.code || o.id}</small>
                          </div>
                          <Link to={adminPath('objectives')} className="button button--ghost button--small">
                            فتح الهدف
                          </Link>
                        </div>
                      ))
                  )}
                </div>
              )}

              {workspaceTab === 'content' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    الحلقات والوسائط التي تحقق أهداف هذه المهارة:
                  </p>
                  {episodes.filter((e) =>
                    objectives.filter((o) => o.skill_id === selected.id).some((o) => o.id === (e as any).objective_id),
                  ).map((ep) => (
                    <div key={ep.id} style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
                      <strong>{ep.title_ar}</strong>
                    </div>
                  ))}
                </div>
              )}

              {workspaceTab === 'games' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {games.filter((g) =>
                    objectives.filter((o) => o.skill_id === selected.id).some((o) => o.id === (g as any).learning_objective_id),
                  ).map((gm) => (
                    <div key={gm.id} style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
                      <strong>{gm.title_ar}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Skill Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSkill ? text.editTitle : text.createTitle}
      >
        <div className="entity-form">
          <label className="field">
            <span>الاسم باللغة العربية *</span>
            <input
              value={form.name_ar}
              onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
              placeholder="مثال: التعرف على الأشكال الهندسية"
            />
          </label>
          <label className="field">
            <span>المجال النمائي *</span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {Object.entries(DOMAIN_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.ar} ({v.en})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>الوصف التربوي</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="شرح أثر هذه المهارة على الطفل وآلية قياسها..."
            />
          </label>
          <div className="form-actions">
            <button className="button button--ghost" onClick={() => setModalOpen(false)}>
              إلغاء
            </button>
            <button className="button button--primary" onClick={handleSave}>
              {editingSkill ? 'حفظ التعديلات' : 'إنشاء المهارة'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
