import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import { formatDate, formatNumber, trackLabels } from '../lib/labels'
import type { AgeTrack, AttemptRecord, MasteryByChild, MasteryByObjective, MasteryLevel } from '../types/api'

const LEVELS: MasteryLevel[] = ['not_started', 'introduced', 'practicing', 'assisted', 'independent', 'needs_review']
const levelLabels: Record<'ar' | 'en', Record<MasteryLevel, string>> = {
  ar: {
    not_started: 'لم يبدأ',
    introduced: 'تعرَّف',
    practicing: 'يتدرّب',
    assisted: 'بمساعدة',
    independent: 'مستقلّ',
    needs_review: 'يحتاج مراجعة',
  },
  en: {
    not_started: 'Not started',
    introduced: 'Introduced',
    practicing: 'Practicing',
    assisted: 'Assisted',
    independent: 'Independent',
    needs_review: 'Needs review',
  },
}
const TRACKS: AgeTrack[] = ['preschool', 'kids', 'junior']
type Tab = 'overview' | 'objectives' | 'skill' | 'children' | 'attempts' | 'needs_review' | 'diagnostics'

const copy = {
  ar: {
    eyebrow: 'الإطار التعليمي والتربوي',
    title: 'مصفوفة الإتقان ومحاولات التعلّم',
    intro:
      'الإتقان دليلٌ تجريبي مبني على محاولات مؤهلة — ليس مجرد إكمال محتوى أو فوز في لعبة. مصدر السلطة محرك FamilyState وفق إسقاطات مرخصة.',
    refresh: 'تحديث البيانات',
    total: 'الإجمالي',
    allLevels: 'كل المستويات',
    levelLabel: 'المستوى',
    allTracks: 'كل المسارات',
    childFilter: 'معرّف الطفل...',
    objective: 'الهدف التعليمي',
    skill: 'المهارة',
    childrenCount: 'الأطفال',
    independent: 'مستقلّ',
    needsReview: 'يحتاج مراجعة',
    notStarted: 'لم يبدأ',
    attempts: 'المحاولات',
    successRate: 'نسبة النجاح',
    lastAttempt: 'آخر محاولة',
    child: 'الطفل',
    track: 'المسار',
    objectivesCount: 'الأهداف',
    content: 'المحتوى',
    score: 'الدرجة',
    duration: 'المدة',
    help: 'المساعدة',
    when: 'التاريخ',
    helpUsed: 'استُخدمت',
    helpNone: 'بلا مساعدة',
    noData: '—',
    noDataHint: 'الشرطة تعني غياب محاولات، لا نسبة صفر.',
    seconds: (n: string) => `${n} ث`,
    loading: 'جارٍ التحميل...',
    loadError: 'تعذر تحميل بيانات الإتقان',
    emptyObjectives: 'لا توجد أهداف مطابقة',
    emptyChildren: 'لا يوجد أطفال مطابقون',
    emptyAttempts: 'لا توجد محاولات مسجلة',
    emptyDiag: 'لا توجد فجوات في الأدلة — النظام سليم',
    overviewTitle: 'نظرة عامة على الإتقان',
    overviewDesc: 'مقاييس آمنة وموثوقة — استنتاج الإتقان لا يتم إلا بوجود أدلة إحصائية حقيقية',
    objectivesWithEvidence: 'أهداف ذات دليل',
    objectivesWithout: 'أهداف بلا دليل',
    childrenWithEvidence: 'أطفال بأدلة مؤهلة',
    needsReviewCount: 'في قائمة المراجعة',
    recentAttempts: 'محاولات حديثة',
    invalidEvidence: 'أدلة منخفضة الدقة',
    tabOverview: 'نظرة عامة',
    tabObjectives: 'حسب الهدف',
    tabSkill: 'حسب المهارة',
    tabChildren: 'حسب الطفل',
    tabAttempts: 'المحاولات',
    tabNeeds: 'يحتاج مراجعة',
    tabDiag: 'تشخيص غياب الدليل',
    noEvidenceWhy: 'لا توجد محاولات مؤهلة لهذا الهدف بعد',
    whyContent: 'محتوى مرتبط',
    whyGames: 'ألعاب قادرة على توليد دليل',
    runtimeStatus: 'حالة التشغيل',
    whyNoCapableGame: 'لا لعبة منشورة على محرّك يقيس الإتقان',
    whyNoQuestions: 'لا أسئلة',
    whyQuestions: (n: number) => `${n} سؤالًا`,
    needsReviewTitle: 'قائمة يحتاج مراجعة',
    needsReviewDesc: 'أسباب المراجعة: تضارب الأدلة، تغير ربط الهدف، أو محاولات غير متسقة.',
    evidenceTrace: 'سلسلة الدليل: هدف ← محتوى/لعبة ← محاولة الطفل ← تدقيق المعايير ← احتساب شارة الإتقان.',
    qualifying: 'مؤهلة',
    notQualifying: 'غير مؤهلة',
    entertainmentNote: 'الألعاب الترفيهية البحتة لا تحتسب إتقاناً تلقائياً — يلزم محرك تقييمي معتمد.',
    noManual: 'لا يوجد زر يدوي لـ "تم الإتقان" — النظام يحتسب التقدم آلياً لحماية المصداقية.',
    privacyNote: 'بيانات الطفل محمية ومشفرة — الاستعراض متاح للأدوار الإشرافية المصرحة فقط.',
    more: 'تحميل المزيد',
    showing: (s: string, t: string) => `يُعرض ${s} من ${t}`,
  },
  en: {
    eyebrow: 'Educational Framework',
    title: 'Mastery Matrix & Learning Attempts',
    intro:
      'Mastery is empirical evidence-driven — not mere content consumption or casual game wins. Powered by FamilyState authority.',
    refresh: 'Refresh Data',
    total: 'Total',
    allLevels: 'All Levels',
    levelLabel: 'Level',
    allTracks: 'All Tracks',
    childFilter: 'Child ID...',
    objective: 'Objective',
    skill: 'Skill',
    childrenCount: 'Children',
    independent: 'Independent',
    needsReview: 'Needs Review',
    notStarted: 'Not Started',
    attempts: 'Attempts',
    successRate: 'Success Rate',
    lastAttempt: 'Last Attempt',
    child: 'Child',
    track: 'Track',
    objectivesCount: 'Objectives',
    content: 'Content',
    score: 'Score',
    duration: 'Duration',
    help: 'Help',
    when: 'Date',
    helpUsed: 'Used',
    helpNone: 'None',
    noData: '—',
    noDataHint: 'Dash means absence of attempts, not 0%.',
    seconds: (n: string) => `${n}s`,
    loading: 'Loading...',
    loadError: 'Unable to load mastery data',
    emptyObjectives: 'No matching objectives',
    emptyChildren: 'No matching children',
    emptyAttempts: 'No attempts recorded',
    emptyDiag: 'No evidence gaps found',
    overviewTitle: 'Mastery Overview',
    overviewDesc: 'Secure, privacy-safe analytics without inflated mastery metrics.',
    objectivesWithEvidence: 'Objectives with Evidence',
    objectivesWithout: 'Objectives without Evidence',
    childrenWithEvidence: 'Children with Evidence',
    needsReviewCount: 'In Review Queue',
    recentAttempts: 'Recent Attempts',
    invalidEvidence: 'Low Accuracy Evidence',
    tabOverview: 'Overview',
    tabObjectives: 'By Objective',
    tabSkill: 'By Skill',
    tabChildren: 'By Child',
    tabAttempts: 'Attempts',
    tabNeeds: 'Needs Review',
    tabDiag: 'Evidence Diagnostics',
    noEvidenceWhy: 'No qualifying attempts for this objective yet',
    whyContent: 'Linked Content',
    whyGames: 'Evidence-Capable Games',
    runtimeStatus: 'Runtime Status',
    whyNoCapableGame: 'No published game on a mastery-writing engine',
    whyNoQuestions: 'No questions',
    whyQuestions: (n: number) => `${n} question(s)`,
    needsReviewTitle: 'Needs Review Queue',
    needsReviewDesc: 'Reasons: conflicting attempts, altered objective mappings, or irregular outcomes.',
    evidenceTrace: 'Evidence Pipeline: Objective → Engine → Attempt → Verification → Mastery Granted.',
    entertainmentNote: 'Casual games do not contribute to academic mastery without verified assessment.',
    noManual: 'No manual "Mark Mastered" switch — mastery is purely evidence-driven.',
    privacyNote: 'Child records are anonymised and protected — accessible only by authorised roles.',
    more: 'Load More',
    showing: (s: string, t: string) => `Showing ${s} of ${t}`,
  },
}

const PAGE_SIZE = 50
function mergeBy<T>(rows: T[], key: (r: T) => string): T[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const v = key(r)
    if (seen.has(v)) return false
    seen.add(v)
    return true
  })
}
const DEFAULT_FILTERS = { level: '', track: '', child_id: '' }
const FILTER_FIELDS = (text: any, locale: 'ar' | 'en', tab: Tab): FilterField[] => {
  if (tab === 'objectives')
    return [
      {
        key: 'level',
        label: text.levelLabel,
        type: 'select',
        options: [{ value: '', label: text.allLevels }, ...LEVELS.map((i) => ({ value: i, label: levelLabels[locale][i] }))],
      },
    ]
  if (tab === 'children')
    return [
      {
        key: 'track',
        label: text.track,
        type: 'select',
        options: [{ value: '', label: text.allTracks }, ...TRACKS.map((i) => ({ value: i, label: trackLabels[locale][i] }))],
      },
    ]
  return [{ key: 'child_id', label: text.child, type: 'text', chip: (v: string) => `${text.child}: ${v}` }]
}
function Rate({ value, hint }: { value: number | null; hint: string }) {
  if (value == null) return <span className="table-secondary" title={hint}>—</span>
  return <span className={value < 50 ? 'size-warning' : undefined}>{value}%</span>
}

export function MasteryPage() {
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { limit: PAGE_SIZE, defaultView: 'overview' })
  const { filters, offset } = list
  const requestedTab = list.rawView
  const tab: Tab = requestedTab
    ? ['overview', 'objectives', 'skill', 'children', 'attempts', 'needs_review', 'diagnostics'].includes(
        requestedTab as Tab,
      )
      ? (requestedTab as Tab)
      : 'overview'
    : filters.level
    ? 'objectives'
    : filters.track
    ? 'children'
    : filters.child_id
    ? 'attempts'
    : 'overview'
  const { level, track, child_id: childId } = filters
  const [objectives, setObjectives] = useState<MasteryByObjective[]>([])
  const [children, setChildren] = useState<MasteryByChild[]>([])
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [skillAgg, setSkillAgg] = useState<any[]>([])
  const [needsReviewRows, setNeedsReviewRows] = useState<MasteryByObjective[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overviewStats, setOverviewStats] = useState<any>(null)

  const load = useCallback(
    async (nextOffset: number, append: boolean) => {
      setLoading(true)
      setError('')
      try {
        if (tab === 'overview') {
          const [o, c, a] = await Promise.all([
            api.masteryByObjective({ limit: 100 } as any) as any,
            api.masteryByChild({ limit: 100 } as any) as any,
            api.attempts({ limit: 20 } as any) as any,
          ])
          const objs = o.data as MasteryByObjective[]
          const withEv = objs.filter((x) => Number(x.attempts) > 0).length
          const without = objs.length - withEv
          const needs = objs.filter((x) => Number(x.needs_review_count) > 0).length
          const diagInvalid = objs.filter((x) => Number(x.attempts) > 0 && (x.success_rate ?? 0) < 30).length
          setOverviewStats({
            objectivesWithEvidence: withEv,
            objectivesWithout: without,
            childrenWithEvidence: (c.data as any[]).filter((x: any) => Number(x.attempts) > 0).length,
            needsReview: needs,
            recentAttempts: (a.data as any[]).length,
            invalid: diagInvalid,
          })
          setObjectives(objs.slice(0, 10))
          setTotal(objs.length)
        } else if (tab === 'objectives') {
          const res = await api.masteryByObjective({ level, limit: PAGE_SIZE, offset: nextOffset } as any)
          setObjectives((cur) => (append ? mergeBy([...cur, ...res.data], (r) => r.id) : res.data))
          setTotal(res.meta?.total ?? res.data.length)
        } else if (tab === 'skill') {
          const res = (await api.masteryByObjective({ limit: 200 } as any)) as any
          const map = new Map<
            string,
            { skill_id: string; skill_name: string; children: number; attempts: number; needs: number }
          >()
          for (const r of res.data as MasteryByObjective[]) {
            const key = r.skill_id ?? 'no_skill'
            const cur = map.get(key) ?? {
              skill_id: key,
              skill_name: r.skill_name ?? '—',
              children: 0,
              attempts: 0,
              needs: 0,
            }
            cur.children += Number(r.children_count)
            cur.attempts += Number(r.attempts)
            cur.needs += Number(r.needs_review_count)
            map.set(key, cur)
          }
          setSkillAgg(Array.from(map.values()))
          setTotal(map.size)
        } else if (tab === 'needs_review') {
          const res = await api.masteryByObjective({ level: 'needs_review', limit: PAGE_SIZE, offset: nextOffset } as any)
          setNeedsReviewRows((cur) => (append ? mergeBy([...(cur as any), ...res.data], (r: any) => r.id) : (res.data as any)))
          setTotal(res.meta?.total ?? res.data.length)
        } else if (tab === 'diagnostics') {
          const res = (await api.masteryByObjective({ limit: 100 } as any)) as any
          const gaps = res.data.filter((r: any) => Number(r.attempts) === 0)
          setObjectives(gaps)
          setTotal(gaps.length)
        } else if (tab === 'children') {
          const res = await api.masteryByChild({ track, limit: PAGE_SIZE, offset: nextOffset } as any)
          setChildren((cur) => (append ? mergeBy([...cur, ...res.data], (r) => r.child_id) : res.data))
          setTotal(res.meta?.total ?? res.data.length)
        } else {
          const res = await api.attempts({ child_id: childId.trim(), limit: PAGE_SIZE, offset: nextOffset } as any)
          setAttempts((cur) => (append ? mergeBy([...cur, ...res.data], (r) => r.id) : res.data))
          setTotal(res.meta?.total ?? res.data.length)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : text.loadError)
      } finally {
        setLoading(false)
      }
    },
    [tab, level, track, childId, text.loadError],
  )

  useEffect(() => {
    const t = setTimeout(() => void load(offset, offset > 0), 200)
    return () => clearTimeout(t)
  }, [load, offset])

  const rows =
    tab === 'objectives'
      ? objectives.length
      : tab === 'children'
      ? children.length
      : tab === 'attempts'
      ? attempts.length
      : tab === 'skill'
      ? skillAgg.length
      : tab === 'needs_review'
      ? needsReviewRows.length
      : tab === 'diagnostics'
      ? objectives.length
      : 0
  const hasMore = rows < total

  function switchTab(next: Tab) {
    if (next === tab) return
    setTotal(0)
    navigate(`${adminPath('mastery')}${next === 'overview' ? '?view=overview' : `?view=${next}`}`, { replace: true })
  }

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.15) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#6366f1' }} />
              FamilyState محرك معتمد
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.intro}</p>
        </div>
        <div className="catalog-hero__actions">
          <button className="button button--secondary" onClick={() => void load(offset, false)} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="refresh" size={15} />
            <span>{text.refresh}</span>
          </button>
        </div>
      </section>

      {/* 2. Side-by-side Bento Live Metric KPI Strip */}
      <div className="hero-kpis">
        <div className="kpi-glass-card" onClick={() => switchTab('objectives')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="check" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.objectivesWithEvidence}</span>
            <div className="kpi-glass-card__num">{overviewStats?.objectivesWithEvidence ?? '—'}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              أهداف تم التحقق من إتقانها
            </span>
          </div>
        </div>

        <div className="kpi-glass-card" onClick={() => switchTab('children')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Icon name="children" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.childrenWithEvidence}</span>
            <div className="kpi-glass-card__num">{overviewStats?.childrenWithEvidence ?? '—'}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#818cf8' }}>
              أطفال خاضوا محاولات مؤهلة
            </span>
          </div>
        </div>

        <div className="kpi-glass-card" onClick={() => switchTab('needs_review')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Icon name="warning" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.needsReviewCount}</span>
            <div className="kpi-glass-card__num">{overviewStats?.needsReview ?? '—'}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#fbbf24' }}>
              حالات تتطلب تدقيقاً تربوياً
            </span>
          </div>
        </div>

        <div className="kpi-glass-card" onClick={() => switchTab('diagnostics')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
            <Icon name="objectives" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.objectivesWithout}</span>
            <div className="kpi-glass-card__num">{overviewStats?.objectivesWithout ?? '—'}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#f87171' }}>
              فجوات بحاجة لألعاب تقييمية
            </span>
          </div>
        </div>
      </div>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      {/* 3. Catalog Control Strip with Tabs */}
      <section className="catalog-control-strip">
        <div className="catalog-control-strip__left">
          <div className="filter-pill-group">
            {(['overview', 'objectives', 'skill', 'children', 'attempts', 'needs_review', 'diagnostics'] as Tab[]).map(
              (t) => (
                <button
                  key={t}
                  className={`filter-pill ${tab === t ? 'filter-pill--active' : ''}`}
                  onClick={() => switchTab(t)}
                >
                  {
                    text[
                      t === 'overview'
                        ? 'tabOverview'
                        : t === 'objectives'
                        ? 'tabObjectives'
                        : t === 'skill'
                        ? 'tabSkill'
                        : t === 'children'
                        ? 'tabChildren'
                        : t === 'attempts'
                        ? 'tabAttempts'
                        : t === 'needs_review'
                        ? 'tabNeeds'
                        : 'tabDiag'
                    ]
                  }
                </button>
              ),
            )}
          </div>
        </div>

        <div className="catalog-control-strip__right">
          <ListToolbar
            searchValue={tab === 'attempts' ? childId : undefined}
            onSearchChange={tab === 'attempts' ? (v) => list.setFilter('child_id', v) : undefined}
            searchPlaceholder={text.childFilter}
            fields={FILTER_FIELDS(text, locale as any, tab === 'overview' ? 'objectives' : (tab as any))}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(k) => list.setFilter(k as any, '')}
            trailing={
              <SavedViewsMenu
                storageKey="mastery"
                currentSearch={list.search}
                onApply={(s) => navigate(`${adminPath('mastery')}${s}`)}
              />
            }
          />
        </div>
      </section>

      {/* 4. Tab Views */}
      {tab === 'overview' && overviewStats && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>{text.overviewTitle}</h3>
              <p className="panel__note" style={{ margin: 0 }}>{text.overviewDesc}</p>
            </div>
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                background: 'var(--surface-2)',
                borderInlineStart: '4px solid #6366f1',
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--text)',
              }}
            >
              <strong>{text.evidenceTrace}</strong>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>{text.entertainmentNote}</div>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>{text.noManual} · {text.privacyNote}</div>
            </div>
          </div>
        </section>
      )}

      <section className="panel panel--table">
        <header className="panel__header">
          <div>
            <span className="panel__kicker">
              {tab === 'overview'
                ? text.overviewTitle
                : tab === 'objectives'
                ? text.tabObjectives
                : tab === 'skill'
                ? text.tabSkill
                : tab === 'children'
                ? text.tabChildren
                : tab === 'attempts'
                ? text.tabAttempts
                : tab === 'needs_review'
                ? text.needsReviewTitle
                : text.tabDiag}
            </span>
            <h3>
              {text.total} <span className="title-count">{formatNumber(total, locale as any)}</span>
            </h3>
          </div>
        </header>

        {tab === 'objectives' &&
          (objectives.length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.objective}</th>
                    <th>{text.skill}</th>
                    <th>{text.childrenCount}</th>
                    <th>{text.independent}</th>
                    <th>{text.needsReview}</th>
                    <th>{text.attempts}</th>
                    <th>{text.successRate}</th>
                    <th>{text.lastAttempt}</th>
                  </tr>
                </thead>
                <tbody>
                  {objectives.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={adminPath(`objectives/${row.id}`)} style={{ textDecoration: 'none' }}>
                          <strong>{row.title_ar}</strong>
                          <small className="table-secondary" dir="ltr">
                            {row.code}
                          </small>
                        </Link>
                        {Number(row.attempts) === 0 && (
                          <div>
                            <span className="prod-chip prod-chip--blocked">{text.noEvidenceWhy}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {row.skill_name ? (
                          <span className="track-badge">{row.skill_name}</span>
                        ) : (
                          <span className="table-secondary">—</span>
                        )}
                      </td>
                      <td dir="ltr">{formatNumber(row.children_count, locale as any)}</td>
                      <td dir="ltr">{formatNumber(row.independent_count, locale as any)}</td>
                      <td>
                        {row.needs_review_count > 0 ? (
                          <span className="status-badge status-badge--review">
                            {formatNumber(row.needs_review_count, locale as any)}
                          </span>
                        ) : (
                          <span className="table-secondary">0</span>
                        )}
                      </td>
                      <td dir="ltr">{formatNumber(row.attempts, locale as any)}</td>
                      <td dir="ltr">
                        <Rate value={row.success_rate} hint={text.noDataHint} />
                      </td>
                      <td>
                        {row.last_attempt_at ? (
                          <span className="table-secondary">{formatDate(row.last_attempt_at, locale as any)}</span>
                        ) : (
                          <span className="table-secondary">{text.noData}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.emptyObjectives} description={text.noEvidenceWhy} />
          ))}

        {tab === 'skill' &&
          (skillAgg.length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.skill}</th>
                    <th>{text.childrenCount}</th>
                    <th>{text.attempts}</th>
                    <th>{text.needsReview}</th>
                  </tr>
                </thead>
                <tbody>
                  {skillAgg.map((r: any) => (
                    <tr key={r.skill_id}>
                      <td>
                        <strong>{r.skill_name}</strong>
                      </td>
                      <td dir="ltr">{r.children}</td>
                      <td dir="ltr">{r.attempts}</td>
                      <td>
                        {r.needs > 0 ? (
                          <span className="status-badge status-badge--review">{r.needs}</span>
                        ) : (
                          '0'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.emptyObjectives} description={text.emptyObjectives} />
          ))}

        {tab === 'needs_review' &&
          (needsReviewRows.length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.objective}</th>
                    <th>{text.skill}</th>
                    <th>{text.needsReview}</th>
                    <th>{text.successRate}</th>
                  </tr>
                </thead>
                <tbody>
                  {needsReviewRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={adminPath(`objectives/${row.id}`)} style={{ textDecoration: 'none' }}>
                          <strong>{row.title_ar}</strong>
                        </Link>
                        <br />
                        <small dir="ltr" className="table-secondary">
                          {row.code}
                        </small>
                      </td>
                      <td>{row.skill_name ?? '—'}</td>
                      <td>
                        <span className="status-badge status-badge--review">{row.needs_review_count}</span>
                      </td>
                      <td>
                        <Rate value={row.success_rate} hint={text.noDataHint} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.needsReviewCount} description={text.needsReviewDesc} />
          ))}

        {tab === 'diagnostics' &&
          (objectives.length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.objective}</th>
                    <th>محتوى</th>
                    <th>ألعاب</th>
                    <th>حالة التشغيل</th>
                  </tr>
                </thead>
                <tbody>
                  {objectives.map((row) => {
                    const capable = Number((row as any).evidence_capable_games ?? 0)
                    const linked = Number((row as any).linked_episodes ?? 0) + Number((row as any).linked_games ?? 0)
                    const questions = Number((row as any).questions_count ?? 0)
                    return (
                      <tr key={row.id}>
                        <td>
                          <Link to={adminPath(`objectives/${row.id}`)} style={{ textDecoration: 'none' }}>
                            <strong>{row.title_ar}</strong>
                          </Link>
                          <div>
                            <small dir="ltr" className="table-secondary">
                              {row.code}
                            </small>{' '}
                            — <span className="prod-chip prod-chip--blocked">{text.noEvidenceWhy}</span>
                          </div>
                        </td>
                        <td>{linked}</td>
                        <td>
                          {capable === 0 ? (
                            <span className="prod-chip prod-chip--blocked">{text.whyNoCapableGame}</span>
                          ) : (
                            capable
                          )}
                        </td>
                        <td>{questions === 0 ? text.whyNoQuestions : text.whyQuestions(questions)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.emptyDiag} description={text.noEvidenceWhy} />
          ))}

        {tab === 'children' &&
          (children.length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.child}</th>
                    <th>{text.track}</th>
                    <th>{text.objectivesCount}</th>
                    <th>{text.independent}</th>
                    <th>{text.needsReview}</th>
                    <th>{text.attempts}</th>
                    <th>{text.successRate}</th>
                  </tr>
                </thead>
                <tbody>
                  {children.map((row) => (
                    <tr key={row.child_id}>
                      <td>
                        <div className="entity-cell">
                          <span className="entity-avatar">
                            <Icon name="children" size={18} />
                          </span>
                          <div>
                            <strong>{row.nickname}</strong>
                            <small dir="ltr" className="table-secondary">
                              {row.child_id.slice(0, 8)}…
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`track-badge track-badge--${row.age_track}`}>
                          {trackLabels[locale][row.age_track]}
                        </span>
                      </td>
                      <td>{row.objectives_count}</td>
                      <td>{row.independent_count}</td>
                      <td>
                        {row.needs_review_count ? (
                          <span className="status-badge status-badge--review">{row.needs_review_count}</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td>{row.attempts}</td>
                      <td>
                        <Rate value={row.success_rate} hint={text.noDataHint} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.emptyChildren} description={text.privacyNote} />
          ))}

        {tab === 'attempts' &&
          (attempts.length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.when}</th>
                    <th>{text.child}</th>
                    <th>{text.content}</th>
                    <th>{text.score}</th>
                    <th>مؤهلة؟</th>
                    <th>{text.help}</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((row) => {
                    const qualified =
                      row.score != null &&
                      row.max_score != null &&
                      Number(row.score) / Number(row.max_score) >= 0.8 &&
                      !row.help_used
                    return (
                      <tr key={row.id}>
                        <td>
                          <span className="table-secondary">{formatDate(row.created_at, locale as any, true)}</span>
                        </td>
                        <td>
                          <strong>{row.nickname ?? '—'}</strong>
                          <br />
                          <small dir="ltr" className="table-secondary">
                            {row.child_id.slice(0, 8)}…
                          </small>
                        </td>
                        <td>
                          <strong>{row.game_title ?? row.episode_title ?? '—'}</strong>
                          <br />
                          <small dir="ltr" className="table-secondary">
                            {row.game_id ?? row.episode_id ?? ''}
                          </small>
                        </td>
                        <td dir="ltr">
                          {row.score != null && row.max_score != null ? (
                            <>
                              {row.score}/{row.max_score} <Rate value={row.score_percent} hint={text.noDataHint} />
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {qualified ? (
                            <span className="prod-chip prod-chip--complete">{text.qualifying}</span>
                          ) : (
                            <span
                              className="prod-chip prod-chip--blocked"
                              title={row.help_used ? 'help_used' : 'insufficient'}
                            >
                              {text.notQualifying}
                            </span>
                          )}
                        </td>
                        <td>
                          {row.help_used ? (
                            <span className="status-badge status-badge--review">{text.helpUsed}</span>
                          ) : (
                            <span className="table-secondary">{text.helpNone}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.emptyAttempts} description={text.noEvidenceWhy} />
          ))}

        {rows > 0 && (
          <footer className="panel__footer">
            <span>{text.showing(formatNumber(rows, locale as any), formatNumber(total, locale as any))}</span>
            {hasMore && (
              <button
                className="button button--ghost"
                disabled={loading}
                onClick={() => list.setOffset(offset + PAGE_SIZE)}
              >
                {text.more}
              </button>
            )}
          </footer>
        )}
      </section>

      {tab === 'attempts' && (
        <section className="panel panel--notice" style={{ marginTop: 16 }}>
          <strong>ملاحظة خصوصية</strong>
          <p>{text.privacyNote} — عمود answers لا يُعاد من الخادم</p>
        </section>
      )}
    </div>
  )
}