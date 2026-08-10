import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { formatDate, formatNumber, trackLabels } from '../lib/labels'
import type {
  AgeTrack,
  AttemptRecord,
  MasteryByChild,
  MasteryByObjective,
  MasteryLevel,
} from '../types/api'

/**
 * الإتقان والمحاولات.
 *
 * ## لماذا كانت هذه الصفحة غائبة
 *
 * `mastery` و`attempts` جدولان من المهاجرة 0001، وكل ما كان يقرأهما سطرٌ واحد
 * في `adminAnalytics.ts:20`:
 *
 *   SELECT level, COUNT(*) FROM mastery GROUP BY level
 *
 * أي أن السؤال الوحيد الذي كان يمكن طرحه هو «كم صفًّا في كل مستوى» — ولا سبيل
 * لمعرفة **أي طفل** متعثّر ولا **أي هدف** يتعثّر فيه الأطفال. ولذلك بقي عنصر
 * «الإتقان والمحاولات» معطَّلًا بلافتة «قريبًا» وهو آخر عنصر معطَّل في القائمة.
 *
 * ## ثلاثة أسئلة، ثلاثة تبويبات
 *
 * التبويب ليس تجميلًا: كل عرض يجيب سؤالًا مختلفًا ويأتي من مسار مختلف.
 *
 * - **الأهداف**: أي هدف يحتاج مراجعة؟ مرتَّب بعدد `needs_review` تنازليًا.
 * - **الأطفال**: من يحتاج مساعدة؟ مرتَّب بالمعيار نفسه.
 * - **المحاولات**: ما الذي حدث بالضبط؟ سجل أحداث خام.
 *
 * ## `null` ليست صفرًا
 *
 * `success_rate` يعود `null` عند غياب المحاولات. عرضه كـ«0%» يقلب المعنى: هدف
 * لم يحاوله أحد يبدو هدفًا يفشل فيه الجميع. تُعرض شُرطة لا رقم.
 */

type Tab = 'objectives' | 'children' | 'attempts'

const LEVELS: MasteryLevel[] = [
  'not_started',
  'introduced',
  'practicing',
  'assisted',
  'independent',
  'needs_review',
]

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

const copy = {
  ar: {
    eyebrow: 'الإطار التعليمي',
    title: 'الإتقان والمحاولات',
    intro: 'قياس تقدّم الأطفال في الأهداف التعليمية. الهدف الذي يتكرّر فيه «يحتاج مراجعة» مرشَّح لإعادة صياغة.',
    refresh: 'تحديث',
    tabObjectives: 'حسب الهدف',
    tabChildren: 'حسب الطفل',
    tabAttempts: 'المحاولات',
    total: 'الإجمالي',
    allLevels: 'كل المستويات',
    allTracks: 'كل المسارات',
    childFilter: 'معرّف الطفل...',
    objective: 'الهدف',
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
    helpNone: 'بلا',
    noData: 'لا بيانات',
    noDataHint: 'الشرطة تعني غياب محاولات، لا نسبة نجاح صفر.',
    seconds: (n: string) => `${n} ث`,
    loading: 'جارٍ التحميل...',
    loadError: 'تعذر تحميل بيانات الإتقان',
    emptyObjectives: 'لا أهداف مطابقة',
    emptyObjectivesHint: 'أنشئ أهدافًا تعليمية من صفحة الأهداف، أو غيّر التصفية.',
    emptyChildren: 'لا أطفال مطابقين',
    emptyChildrenHint: 'تظهر هنا ملفات الأطفال النشطة فقط.',
    emptyAttempts: 'لا محاولات',
    emptyAttemptsHint: 'تُسجَّل المحاولات عندما يلعب الطفل لعبة أو يُكمل حلقة.',
    answersNote: 'أجوبة الأطفال غير معروضة',
    answersHint: 'عمود answers لا يُعاد من الخادم: حجمه غير محدود ولا يفيد اللوحة بقدر ما يوسّع تعرّض بيانات الأطفال.',
    more: 'تحميل المزيد',
    showing: (shown: string, total: string) => `يُعرض ${shown} من ${total}`,
  },
  en: {
    eyebrow: 'Learning framework',
    title: 'Mastery and attempts',
    intro: 'How children progress against learning objectives. An objective that repeatedly needs review is a candidate for rewriting.',
    refresh: 'Refresh',
    tabObjectives: 'By objective',
    tabChildren: 'By child',
    tabAttempts: 'Attempts',
    total: 'Total',
    allLevels: 'All levels',
    allTracks: 'All tracks',
    childFilter: 'Child id...',
    objective: 'Objective',
    skill: 'Skill',
    childrenCount: 'Children',
    independent: 'Independent',
    needsReview: 'Needs review',
    notStarted: 'Not started',
    attempts: 'Attempts',
    successRate: 'Success rate',
    lastAttempt: 'Last attempt',
    child: 'Child',
    track: 'Track',
    objectivesCount: 'Objectives',
    content: 'Content',
    score: 'Score',
    duration: 'Duration',
    help: 'Help',
    when: 'When',
    helpUsed: 'Used',
    helpNone: 'None',
    noData: 'No data',
    noDataHint: 'A dash means no attempts, not a zero success rate.',
    seconds: (n: string) => `${n}s`,
    loading: 'Loading...',
    loadError: 'Unable to load mastery data',
    emptyObjectives: 'No matching objectives',
    emptyObjectivesHint: 'Create learning objectives from the objectives page, or change the filter.',
    emptyChildren: 'No matching children',
    emptyChildrenHint: 'Only active child profiles appear here.',
    emptyAttempts: 'No attempts',
    emptyAttemptsHint: 'An attempt is recorded when a child plays a game or completes an episode.',
    answersNote: 'Child answers are not shown',
    answersHint: 'The answers column is not returned by the server: it is unbounded in size and widens child-data exposure without helping the dashboard.',
    more: 'Load more',
    showing: (shown: string, total: string) => `Showing ${shown} of ${total}`,
  },
}

const PAGE_SIZE = 50

/// نسبة مئوية أو شُرطة. `null` تعني غياب محاولات لا نسبة صفر.
function Rate({ value, hint }: { value: number | null; hint: string }) {
  if (value == null) return <span className="table-secondary" title={hint}>—</span>
  return (
    <span className={value < 50 ? 'size-warning' : undefined}>
      {value}%
    </span>
  )
}

export function MasteryPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [tab, setTab] = useState<Tab>('objectives')
  const [objectives, setObjectives] = useState<MasteryByObjective[]>([])
  const [children, setChildren] = useState<MasteryByChild[]>([])
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)

  const [level, setLevel] = useState('')
  const [track, setTrack] = useState('')
  const [childId, setChildId] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (nextOffset: number, append: boolean) => {
    setLoading(true)
    setError('')
    try {
      if (tab === 'objectives') {
        const response = await api.masteryByObjective({ level, limit: PAGE_SIZE, offset: nextOffset })
        setObjectives((current) => append ? [...current, ...response.data] : response.data)
        setTotal(response.meta?.total ?? response.data.length)
      } else if (tab === 'children') {
        const response = await api.masteryByChild({ track, limit: PAGE_SIZE, offset: nextOffset })
        setChildren((current) => append ? [...current, ...response.data] : response.data)
        setTotal(response.meta?.total ?? response.data.length)
      } else {
        const response = await api.attempts({ child_id: childId.trim(), limit: PAGE_SIZE, offset: nextOffset })
        setAttempts((current) => append ? [...current, ...response.data] : response.data)
        setTotal(response.meta?.total ?? response.data.length)
      }
      setOffset(nextOffset)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [childId, level, tab, text.loadError, track])

  // تأخير بسيط: حقل معرّف الطفل نصّ حرّ فلا يُنادى الخادم على كل حرف
  useEffect(() => {
    const timer = window.setTimeout(() => void load(0, false), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  const rows = tab === 'objectives' ? objectives.length : tab === 'children' ? children.length : attempts.length
  const hasMore = rows < total

  function switchTab(next: Tab) {
    if (next === tab) return
    setTab(next)
    setOffset(0)
    setTotal(0)
  }

  if (loading && !rows) return <LoadingState label={text.loading} />
  if (error && !rows) return <ErrorState message={error} onRetry={() => void load(0, false)} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--secondary" type="button" onClick={() => void load(0, false)}>
            <Icon name="refresh" size={17} />{text.refresh}
          </button>
        </div>
      </section>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      {/* التبويب ليس تجميلًا: كل عرض يجيب سؤالًا مختلفًا ويأتي من مسار مختلف */}
      <div className="library-tabs">
        <button
          className={`library-tab ${tab === 'objectives' ? 'library-tab--active' : ''}`}
          type="button"
          onClick={() => switchTab('objectives')}
        >
          <Icon name="objectives" size={17} />{text.tabObjectives}
        </button>
        <button
          className={`library-tab ${tab === 'children' ? 'library-tab--active' : ''}`}
          type="button"
          onClick={() => switchTab('children')}
        >
          <Icon name="children" size={17} />{text.tabChildren}
        </button>
        <button
          className={`library-tab ${tab === 'attempts' ? 'library-tab--active' : ''}`}
          type="button"
          onClick={() => switchTab('attempts')}
        >
          <Icon name="reviews" size={17} />{text.tabAttempts}
        </button>
      </div>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">
              {tab === 'objectives' ? text.tabObjectives : tab === 'children' ? text.tabChildren : text.tabAttempts}
            </span>
            <h3>{text.total} <span className="title-count">{formatNumber(total, locale)}</span></h3>
          </div>
          <div className="filters-row">
            {tab === 'objectives' && (
              <select value={level} onChange={(event) => setLevel(event.target.value)} aria-label={text.allLevels}>
                <option value="">{text.allLevels}</option>
                {LEVELS.map((item) => (
                  <option value={item} key={item}>{levelLabels[locale][item]}</option>
                ))}
              </select>
            )}
            {tab === 'children' && (
              <select value={track} onChange={(event) => setTrack(event.target.value)} aria-label={text.allTracks}>
                <option value="">{text.allTracks}</option>
                {TRACKS.map((item) => (
                  <option value={item} key={item}>{trackLabels[locale][item]}</option>
                ))}
              </select>
            )}
            {tab === 'attempts' && (
              <label className="search-field">
                <Icon name="search" size={17} />
                <input
                  value={childId}
                  dir="ltr"
                  onChange={(event) => setChildId(event.target.value)}
                  placeholder={text.childFilter}
                />
              </label>
            )}
          </div>
        </header>

        {tab === 'objectives' && (
          objectives.length ? (
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
                        <div>
                          <strong>{row.title_ar}</strong>
                          <small className="table-secondary" dir="ltr">{row.code}</small>
                        </div>
                      </td>
                      <td>
                        {row.skill_name
                          ? <span className="track-badge">{row.skill_name}</span>
                          : <span className="table-secondary">—</span>}
                      </td>
                      <td dir="ltr">{formatNumber(row.children_count, locale)}</td>
                      <td dir="ltr">{formatNumber(row.independent_count, locale)}</td>
                      <td>
                        {/* الترتيب من الخادم تنازليًّا بهذا العمود: أعلى قيمة أول
                            ما يراه المسؤول */}
                        {row.needs_review_count > 0
                          ? <span className="status-badge status-badge--review">{formatNumber(row.needs_review_count, locale)}</span>
                          : <span className="table-secondary">0</span>}
                      </td>
                      <td dir="ltr">{formatNumber(row.attempts, locale)}</td>
                      <td dir="ltr"><Rate value={row.success_rate} hint={text.noDataHint} /></td>
                      <td>
                        {row.last_attempt_at
                          ? <span className="table-secondary">{formatDate(row.last_attempt_at, locale)}</span>
                          : <span className="table-secondary" title={text.noDataHint}>{text.noData}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title={text.emptyObjectives} description={text.emptyObjectivesHint} />
        )}

        {tab === 'children' && (
          children.length ? (
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
                    <th>{text.lastAttempt}</th>
                  </tr>
                </thead>
                <tbody>
                  {children.map((row) => (
                    <tr key={row.child_id}>
                      <td>
                        <div className="entity-cell">
                          <span className="entity-avatar"><Icon name="children" size={18} /></span>
                          <div>
                            <strong>{row.nickname}</strong>
                            <small className="table-secondary" dir="ltr">{row.child_id}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`track-badge track-badge--${row.age_track}`}>
                          {trackLabels[locale][row.age_track]}
                        </span>
                      </td>
                      <td dir="ltr">{formatNumber(row.objectives_count, locale)}</td>
                      <td dir="ltr">{formatNumber(row.independent_count, locale)}</td>
                      <td>
                        {row.needs_review_count > 0
                          ? <span className="status-badge status-badge--review">{formatNumber(row.needs_review_count, locale)}</span>
                          : <span className="table-secondary">0</span>}
                      </td>
                      <td dir="ltr">{formatNumber(row.attempts, locale)}</td>
                      <td dir="ltr"><Rate value={row.success_rate} hint={text.noDataHint} /></td>
                      <td>
                        {row.last_attempt_at
                          ? <span className="table-secondary">{formatDate(row.last_attempt_at, locale)}</span>
                          : <span className="table-secondary" title={text.noDataHint}>{text.noData}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title={text.emptyChildren} description={text.emptyChildrenHint} />
        )}

        {tab === 'attempts' && (
          attempts.length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.when}</th>
                    <th>{text.child}</th>
                    <th>{text.content}</th>
                    <th>{text.score}</th>
                    <th>{text.duration}</th>
                    <th>{text.help}</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((row) => (
                    <tr key={row.id}>
                      <td><span className="table-secondary">{formatDate(row.created_at, locale, true)}</span></td>
                      <td>
                        <div>
                          <strong>{row.nickname ?? '—'}</strong>
                          <small className="table-secondary" dir="ltr">{row.child_id}</small>
                        </div>
                      </td>
                      <td>
                        {/* المحاولة مرتبطة بلعبة أو حلقة، والقيد في المهاجرة 0001
                            يضمن أن أحدهما موجود */}
                        <div>
                          <strong>{row.game_title ?? row.episode_title ?? '—'}</strong>
                          <small className="table-secondary" dir="ltr">
                            {row.game_id ?? row.episode_id ?? ''}
                          </small>
                        </div>
                      </td>
                      <td dir="ltr">
                        {row.score != null && row.max_score != null
                          ? <>{formatNumber(row.score, locale)}/{formatNumber(row.max_score, locale)} <Rate value={row.score_percent} hint={text.noDataHint} /></>
                          : <span className="table-secondary" title={text.noDataHint}>—</span>}
                      </td>
                      <td dir="ltr">{text.seconds(formatNumber(row.time_spent_seconds, locale))}</td>
                      <td>
                        {row.help_used
                          ? <span className="status-badge status-badge--review">{text.helpUsed}</span>
                          : <span className="table-secondary">{text.helpNone}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title={text.emptyAttempts} description={text.emptyAttemptsHint} />
        )}

        {rows > 0 && (
          <footer className="panel__footer">
            <span>{text.showing(formatNumber(rows, locale), formatNumber(total, locale))}</span>
            {hasMore && (
              <button
                className="button button--ghost"
                type="button"
                disabled={loading}
                onClick={() => void load(offset + PAGE_SIZE, true)}
              >
                {text.more}
              </button>
            )}
          </footer>
        )}
      </section>

      {/* حدّ مقصود يُعلَن بدل أن يُكتشف: أجوبة الأطفال لا تُعاد */}
      {tab === 'attempts' && (
        <section className="panel panel--notice">
          <strong>{text.answersNote}</strong>
          <p>{text.answersHint}</p>
        </section>
      )}
    </div>
  )
}
