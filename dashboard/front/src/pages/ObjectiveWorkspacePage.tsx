import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'
import { trackLabel } from '../lib/labels'

const copy = {
  ar: {
    back: 'العودة لقائمة الأهداف',
    loading: 'جارٍ تحميل مساحة عمل الهدف…',
    loadError: 'تعذر تحميل الهدف التعليمي',
    tabs: {
      overview: 'نظرة عامة ومقاييس',
      measurement: 'معايير القياس',
      age: 'المسارات والتوزيع العمري',
      content: 'المحتوى المرئي',
      games: 'الألعاب والتدريب',
      questions: 'بنك الأسئلة',
      mastery: 'أدلة الإتقان والتقدم',
      reviews: 'المراجعات التربوية',
      history: 'سجل التغييرات',
    },
    code: 'الرمز',
    skill: 'المهارة',
    ages: 'المدى العمري',
    tracks: 'المسارات',
    criterion: 'معيار القياس التجريبي',
    noCriterion: 'لا يوجد معيار قياس محدد — يحتاج لصياغة تربوية',
    noCriterionHint: 'يجب إضافة إجراء/هدف/شرط/معيار نجاح قابل للقياس البرمجي',
    contentCoverage: 'تغطية المحتوى المرئي والمشروعات',
    gamesCoverage: 'الألعاب والتطبيقات التفاعلية',
    questionsCoverage: 'الأسئلة التقييمية',
    masteryEligible: 'مؤهل لاحتساب الإتقان',
    evidenceSources: 'مصادر الدليل',
    episodes: 'حلقات',
    stories: 'قصص',
    games: 'ألعاب',
    projects: 'مشروعات',
    questions: 'أسئلة',
    noContent: 'لا يوجد محتوى مرتبط بهذا الهدف بعد',
    noGames: 'لا توجد ألعاب تدرّب على هذا الهدف',
    noQuestions: 'لا توجد أسئلة تقييمية مرتبطة',
    noMastery: 'لا توجد أدلة إتقان مسجلة بعد',
    domainGap: 'يُنصح بربط الألعاب وتصنيف دورها: تمهيد / تدريب / قياس إتقان.',
    measurementTitle: 'ماذا يُقاس برمجياً وتربوياً؟',
    measurementWhat: 'السلوك المقاس',
    measurementSuccess: 'ما يُعد نجاحًا في المحاولة',
    measurementEvidence: 'ما يُحتسب دليلاً في المحرك',
    measurementMin: 'الحد الأدنى للمحاولات',
    measurementMastery: 'هل يساهم في شارة الإتقان؟',
    threshold: 'عتبة النجاح: 80% دقة',
    minAttempts: '٣ محاولات مؤهلة',
    evidence: 'ألعاب الرسم والتلوين والأسئلة التفاعلية',
  },
  en: {
    back: 'Back to Objectives',
    loading: 'Loading Objective Workspace…',
    loadError: 'Unable to load objective',
    tabs: {
      overview: 'Overview & KPIs',
      measurement: 'Measurement Criteria',
      age: 'Age Tracks',
      content: 'Media Content',
      games: 'Games & Practice',
      questions: 'Question Bank',
      mastery: 'Mastery Evidence',
      reviews: 'Educational Reviews',
      history: 'Change History',
    },
    code: 'Code',
    skill: 'Skill',
    ages: 'Age Range',
    tracks: 'Tracks',
    criterion: 'Measurable Criterion',
    noCriterion: 'No measurable criterion defined',
    noCriterionHint: 'Add Action/Target/Condition/Success criterion',
    contentCoverage: 'Media & Projects Coverage',
    gamesCoverage: 'Games & Interactive Apps',
    questionsCoverage: 'Assessment Questions',
    masteryEligible: 'Mastery Eligible',
    evidenceSources: 'Evidence Sources',
    episodes: 'Episodes',
    stories: 'Stories',
    games: 'Games',
    projects: 'Projects',
    questions: 'Questions',
    noContent: 'No content linked to this objective',
    noGames: 'No games linked to this objective',
    noQuestions: 'No assessment questions linked',
    noMastery: 'No mastery evidence recorded yet',
    domainGap: 'Recommended to link games with clear roles: Teach / Practice / Assess.',
    measurementTitle: 'What is measured?',
    measurementWhat: 'Measured Behavior',
    measurementSuccess: 'Criteria for Success',
    measurementEvidence: 'Engine Evidence',
    measurementMin: 'Minimum Attempts',
    measurementMastery: 'Contributes to Mastery?',
    threshold: 'Accuracy Threshold: 80%',
    minAttempts: '3 qualifying attempts',
    evidence: 'Interactive drawing, coloring & quiz engines',
  },
}

export function ObjectiveWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState<keyof typeof text.tabs>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [coverage, setCoverage] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [mastery, setMastery] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.learningObjective(id)
      setData(res.data)
      const [epRes, gameRes, qRes] = await Promise.allSettled([
        api.episodes({ limit: 50 } as any),
        api.games({ limit: 50 } as any),
        api.questions({ objective_id: id, limit: 50 } as any),
      ])
      const eps =
        epRes.status === 'fulfilled'
          ? (epRes.value as any).data?.filter((e: any) => e.learning_objective_id === id) ?? []
          : []
      const gs =
        gameRes.status === 'fulfilled'
          ? (gameRes.value as any).data?.filter((g: any) => g.learning_objective_id === id) ?? []
          : []
      const projRes = (await (api as any).projects?.({ limit: 100 })?.catch(() => null)) as any
      let projects: any[] = []
      try {
        if (projRes?.data)
          projects = projRes.data.filter(
            (p: any) => Array.isArray(p.learning_objective_ids) && p.learning_objective_ids.includes(id),
          )
      } catch {}
      setCoverage({ episodes: eps, games: gs, projects, stories: [] })
      if (qRes.status === 'fulfilled') setQuestions((qRes.value as any).data ?? [])
      try {
        const mr = (await api.masteryByObjective({} as any)) as any
        const row = mr.data?.find((r: any) => r.id === id)
        setMastery(row ?? null)
      } catch {
        setMastery(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return <EmptyState title={text.loadError} description={id} />

  const isMeasurable = !!data.measurable_criteria?.trim()
  const hasAssessment = questions.length > 0 || (coverage?.games?.length ?? 0) > 0
  const masteryEligible = isMeasurable && hasAssessment

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(99, 102, 241, 0.1) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{data.code}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: isMeasurable ? '#10b981' : '#f59e0b' }} />
              {isMeasurable ? 'معيار قياس نشط' : 'بلا معيار قياس'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{data.title_ar}</h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            <span>
              {text.skill}:{' '}
              <Link to={adminPath('skills')} style={{ color: 'var(--primary)', fontWeight: 700 }}>
                {data.skill_name ?? '—'}
              </Link>
            </span>
            <span>
              {text.ages}: {data.age_min}–{data.age_max} سنة
            </span>
            <span>
              {text.tracks}:{' '}
              {data.track_ids?.map((t: string) => trackLabel(locale, t)).join(', ') ?? '—'}
            </span>
          </div>
        </div>
        <div className="catalog-hero__actions">
          <Link className="button button--secondary" to={adminPath('objectives')} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="chevron-left" size={14} />
            <span>{text.back}</span>
          </Link>
        </div>
      </section>

      {/* 2. Side-by-side Bento Live Metric Strip */}
      <div className="hero-kpis">
        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Icon name="video" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.episodes}</span>
            <div className="kpi-glass-card__num">{coverage?.episodes?.length ?? 0}</div>
            <span className="kpi-glass-card__trend">حلقات تحقق هذا الهدف</span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="games" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.games}</span>
            <div className="kpi-glass-card__num">{coverage?.games?.length ?? 0}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              ألعاب تدريب وقياس
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Icon name="objectives" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.questions}</span>
            <div className="kpi-glass-card__num">{questions.length}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#fbbf24' }}>
              أسئلة في بنك الاختبارات
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div
            className="kpi-glass-card__icon"
            style={{
              background: masteryEligible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: masteryEligible ? '#10b981' : '#f87171',
            }}
          >
            <Icon name={masteryEligible ? 'check' : 'warning'} size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.masteryEligible}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 20 }}>
              {masteryEligible ? 'مؤهل للإتقان' : 'غير مؤهل'}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: masteryEligible ? '#10b981' : '#f87171' }}>
              {masteryEligible ? 'معيار + أدوات تقييم متوفرة' : 'يحتاج معيار أو أدوات تقييم'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Tab navigation */}
      <div className="detail-tabs" role="tablist" style={{ margin: '20px 0 16px' }}>
        {(Object.keys(text.tabs) as Array<keyof typeof text.tabs>).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={`detail-tab ${tab === k ? 'detail-tab--active' : ''}`}
            onClick={() => setTab(k)}
          >
            {text.tabs[k]}
          </button>
        ))}
      </div>

      {/* 4. Tab contents */}
      {tab === 'overview' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {data.description_ar && (
              <div>
                <h4 style={{ margin: '0 0 6px', color: 'var(--text)' }}>الوصف التربوي للهدف</h4>
                <p style={{ margin: 0, color: 'var(--text-soft)', lineHeight: 1.6 }}>{data.description_ar}</p>
              </div>
            )}

            <div>
              <h4 style={{ margin: '0 0 8px', color: 'var(--text)' }}>{text.criterion}</h4>
              {isMeasurable ? (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                    borderInlineStart: '4px solid #10b981',
                    fontSize: 14,
                    color: 'var(--text)',
                    lineHeight: 1.6,
                  }}
                >
                  {data.measurable_criteria}
                </div>
              ) : (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderInlineStart: '4px solid #ef4444',
                    color: '#f87171',
                  }}
                >
                  <strong>{text.noCriterion}</strong> — {text.noCriterionHint}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Link className="button button--ghost button--small" to={adminPath(`quiz?objective_id=${data.id}`)}>
                <Icon name="objectives" size={13} />
                <span>عرض أسئلة الهدف ({questions.length})</span>
              </Link>
              <Link className="button button--ghost button--small" to={adminPath('mastery')}>
                <Icon name="check" size={13} />
                <span>عرض لوحة أدلة الإتقان</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {tab === 'measurement' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{text.measurementTitle}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 14, background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
                {text.measurementWhat}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{data.title_ar}</div>
            </div>
            <div style={{ padding: 16, borderRadius: 14, background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
                {text.measurementSuccess}
              </div>
              <div style={{ fontSize: 14, color: isMeasurable ? 'var(--text)' : '#f87171' }}>
                {isMeasurable ? data.measurable_criteria : text.noCriterion}
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 14, background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
                {text.threshold}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>
                عتبة الدقة: ≥80% في نافذة 5 محاولات متتالية لتوثيق الإتقان
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 14, background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
                {text.measurementEvidence}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>{text.evidence}</div>
            </div>
          </div>
        </section>
      )}

      {tab === 'content' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{text.contentCoverage}</h3>
          {(coverage?.episodes?.length ?? 0) === 0 && (coverage?.projects?.length ?? 0) === 0 ? (
            <EmptyState
              title={text.noContent}
              description="يمكنك ربط الحلقات والمشروعات بهذا الهدف التعليمي من خلال استوديو الحلقات."
            />
          ) : (
            <div className="skills-studio-grid">
              {coverage.episodes.map((e: any) => (
                <div key={e.id} className="skill-card-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="skill-domain-pill">حلقة أنيميشن</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{e.id}</span>
                  </div>
                  <h4 style={{ margin: '4px 0', fontSize: 16 }}>{e.title_ar}</h4>
                  <small style={{ color: 'var(--muted)' }}>{e.series_title ?? 'سلسلة مجرة'}</small>
                  <Link
                    to={adminPath(`episodes/${e.id}`)}
                    className="button button--ghost button--small"
                    style={{ marginTop: 'auto' }}
                  >
                    فتح استوديو الحلقة
                  </Link>
                </div>
              ))}
              {coverage.projects.map((p: any) => (
                <div key={p.id} className="skill-card-item">
                  <span className="skill-domain-pill" style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                    مشروع عملي
                  </span>
                  <h4 style={{ margin: '4px 0', fontSize: 16 }}>{p.title_ar}</h4>
                  <Link
                    to={adminPath(`projects/${p.id}`)}
                    className="button button--ghost button--small"
                    style={{ marginTop: 'auto' }}
                  >
                    فتح المشروع
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'games' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{text.gamesCoverage}</h3>
          {(coverage?.games?.length ?? 0) === 0 ? (
            <EmptyState
              title={text.noGames}
              description="الألعاب المرتبطة بهذا الهدف تظهر هنا وتولّد أدلة الإتقان عند لعب الأطفال."
            />
          ) : (
            <div className="skills-studio-grid">
              {coverage.games.map((g: any) => (
                <div key={g.id} className="skill-card-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="skill-domain-pill">{g.engine_name ?? g.engine_id ?? 'لعبة تفاعلية'}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{g.difficulty}</span>
                  </div>
                  <h4 style={{ margin: '4px 0', fontSize: 16 }}>{g.title_ar}</h4>
                  <small style={{ color: 'var(--muted)' }}>
                    الأعمار: {g.age_min}–{g.age_max} سنة
                  </small>
                  <Link
                    to={adminPath(`games/${g.id}`)}
                    className="button button--ghost button--small"
                    style={{ marginTop: 'auto' }}
                  >
                    فتح استوديو اللعبة
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'questions' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>{text.questionsCoverage}</h3>
            <Link className="button button--primary button--small" to={adminPath(`quiz?objective_id=${data.id}`)}>
              <Icon name="plus" size={13} />
              <span>إضافة سؤال جديد</span>
            </Link>
          </div>
          {questions.length === 0 ? (
            <EmptyState
              title={text.noQuestions}
              description="أنشئ سؤالاً تقييميًا مرتبطًا بهذا الهدف من بنك الأسئلة لتمكين قياس الإتقان."
            />
          ) : (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>نص السؤال</th>
                    <th>نوع السؤال</th>
                    <th>الحالة</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q: any) => (
                    <tr key={q.id}>
                      <td>
                        <strong>{q.prompt_ar?.slice(0, 100)}</strong>
                      </td>
                      <td>
                        <span className="question-type-badge">{q.type}</span>
                      </td>
                      <td>
                        <span className="prod-chip prod-chip--complete">{q.status}</span>
                      </td>
                      <td>
                        <Link to={adminPath(`quiz/${q.id}`)} className="button button--ghost button--small">
                          تعديل
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'mastery' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{text.masteryEligible}</h3>
          {mastery ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{mastery.children_count ?? 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>عدد الأطفال الذين خاضوا التقييم</div>
                </div>
                <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
                    {mastery.independent_count ?? 0}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>حققوا درجة الاستقلال والإتقان</div>
                </div>
                <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>
                    {mastery.needs_review_count ?? 0}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>يحتاجون متابعة ودعم</div>
                </div>
              </div>
              <Link to={adminPath('mastery')} className="button button--ghost button--small" style={{ alignSelf: 'flex-start' }}>
                فتح لوحة الإتقان الشاملة
              </Link>
            </div>
          ) : (
            <EmptyState
              title={text.noMastery}
              description="لا توجد محاولات مسجلة لهذا الهدف بعد — يبدأ التسجيل تلقائيًا عندما يلعب الأطفال الألعاب المرتبطة."
            />
          )}
        </section>
      )}
    </div>
  )
}