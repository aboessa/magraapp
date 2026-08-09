import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ChildProgressReport, ParentDetail, ParentRecord } from '../types/api'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { accountStatusLabels, formatDate, formatNumber, planLabels, trackLabels } from '../lib/labels'
import { usePreferences } from '../context/preferences'

/**
 * أولياء الأمور.
 *
 * ## ما أُضيف
 *
 * كانت الصفحة تنادي `/admin/parents` وحده. المسارَان
 * `/admin/parents/:id` و`/admin/analytics/children/:childId` كانا موجودَين في
 * الخادم بلا أي مستدعٍ، فلا سبيل للنزول من القائمة إلى حساب واحد ولا إلى تقدّم
 * طفل — وهما ما يحتاجه الدعم فعلًا عند سؤال عن أسرة بعينها.
 *
 * ## علّة أُصلحت في الخادم أولًا
 *
 * `/analytics/children/:childId` كان يستعلم جدولًا اسمه `content_progress` لا
 * وجود له في أي مهاجرة ولا في قاعدة الإنتاج (تحقّقتُ من `sqlite_master`)، وكل
 * أسماء أعمدته مخترعة. فكان يرمي على كل نداء، ولم يظهر ذلك لأنه بلا واجهة.
 *
 * صار يجمع ثلاثة مصادر حقيقية: `watch_progress` و`mastery` و`attempts` — لأن
 * «تقدّم الطفل» ليس جدولًا واحدًا.
 *
 * ## مصدر البيانات
 *
 * القائمة والتفصيل من `family_projection` و`child_projection`: إسقاطان مبنيّان
 * من أحداث العائلة لا جدولا الهوية. لذلك كل أعمدة الإسقاط قابلة للفراغ — الحدث
 * الأول قد لا يحمل كل الحقول — وتُعرض شُرطة لا صفر عند الغياب.
 */

const copy = {
  ar: {
    loadError: 'تعذر تحميل أولياء الأمور', account: 'حساب الأسرة', title: 'أولياء الأمور',
    intro: 'حساب ولي الأمر هو المالك لكل ملفات الأطفال والموافقات والاشتراك.', refresh: 'تحديث', directory: 'دليل الحسابات',
    search: 'اسم أو بريد...', allPlans: 'كل الباقات', parent: 'ولي الأمر', plan: 'الباقة', children: 'ملفات الأطفال', language: 'اللغة',
    timezone: 'المنطقة الزمنية', status: 'الحالة', joined: 'تاريخ التسجيل', loading: 'جارٍ تحميل الحسابات...',
    noName: 'من دون اسم معروض', arabic: 'العربية', english: 'الإنجليزية', empty: 'لا توجد حسابات بعد',
    emptyDesc: 'ستظهر حسابات أولياء الأمور هنا فور تسجيلها فعليًا؛ لا تعرض اللوحة مستخدمين افتراضيين.',
    // تفصيل ولي الأمر
    detailTitle: 'تفصيل الحساب',
    detailHint: 'من family_projection: إسقاط مبنيّ من أحداث العائلة لا جدول الهوية.',
    open: 'فتح التفصيل',
    close: 'إغلاق',
    lastEvent: 'آخر حدث',
    createdAt: 'أُنشئ',
    childrenTitle: 'ملفات الأطفال',
    noChildren: 'لا ملفات أطفال',
    noChildrenHint: 'الملفات تُنشأ من التطبيق، ولا تُنشأ من اللوحة.',
    nickname: 'الكُنية',
    track: 'المسار',
    childStatus: 'الحالة',
    viewProgress: 'التقدّم',
    // تقدّم الطفل
    progressTitle: 'تقدّم الطفل',
    progressHint: 'ثلاثة مصادر: المشاهدة والإتقان والمحاولات. «تقدّم الطفل» ليس جدولًا واحدًا.',
    watchTitle: 'المشاهدة',
    masteryTitle: 'الإتقان',
    attemptsTitle: 'المحاولات',
    episode: 'الحلقة',
    series: 'السلسلة',
    watched: 'المُشاهَد',
    completed: 'مكتمل',
    watchCount: 'مرات المشاهدة',
    objective: 'الهدف',
    level: 'المستوى',
    attemptsCount: 'المحاولات',
    successRate: 'نسبة النجاح',
    content: 'المحتوى',
    score: 'الدرجة',
    duration: 'المدة',
    help: 'المساعدة',
    when: 'التاريخ',
    helpUsed: 'استُخدمت',
    helpNone: 'بلا',
    yes: 'نعم',
    no: 'لا',
    seconds: (n: string) => `${n} ث`,
    noWatch: 'لا مشاهدات',
    noMastery: 'لا سجل إتقان',
    noAttempts: 'لا محاولات',
    noData: '—',
    noDataHint: 'الشرطة تعني غياب بيانات، لا قيمة صفر.',
    progressError: 'تعذر تحميل تقدّم الطفل',
    detailError: 'تعذر تحميل تفصيل الحساب',
  },
  en: {
    loadError: 'Unable to load parent accounts', account: 'Family account', title: 'Parents',
    intro: 'The parent account owns all child profiles, consents, and the subscription.', refresh: 'Refresh', directory: 'Account directory',
    search: 'Name or email...', allPlans: 'All plans', parent: 'Parent', plan: 'Plan', children: 'Child profiles', language: 'Language',
    timezone: 'Time zone', status: 'Status', joined: 'Registration date', loading: 'Loading accounts...',
    noName: 'No display name', arabic: 'Arabic', english: 'English', empty: 'No accounts yet',
    emptyDesc: 'Real parent accounts will appear here as soon as they register; the dashboard does not show placeholder users.',
    detailTitle: 'Account detail',
    detailHint: 'From family_projection: a projection built from family events, not the identity table.',
    open: 'Open detail',
    close: 'Close',
    lastEvent: 'Last event',
    createdAt: 'Created',
    childrenTitle: 'Child profiles',
    noChildren: 'No child profiles',
    noChildrenHint: 'Profiles are created from the app, never from the dashboard.',
    nickname: 'Nickname',
    track: 'Track',
    childStatus: 'Status',
    viewProgress: 'Progress',
    progressTitle: 'Child progress',
    progressHint: 'Three sources: watching, mastery and attempts. Child progress is not one table.',
    watchTitle: 'Watching',
    masteryTitle: 'Mastery',
    attemptsTitle: 'Attempts',
    episode: 'Episode',
    series: 'Series',
    watched: 'Watched',
    completed: 'Completed',
    watchCount: 'Watch count',
    objective: 'Objective',
    level: 'Level',
    attemptsCount: 'Attempts',
    successRate: 'Success rate',
    content: 'Content',
    score: 'Score',
    duration: 'Duration',
    help: 'Help',
    when: 'When',
    helpUsed: 'Used',
    helpNone: 'None',
    yes: 'Yes',
    no: 'No',
    seconds: (n: string) => `${n}s`,
    noWatch: 'No watch history',
    noMastery: 'No mastery records',
    noAttempts: 'No attempts',
    noData: '—',
    noDataHint: 'A dash means no data, not a zero value.',
    progressError: 'Unable to load child progress',
    detailError: 'Unable to load account detail',
  },
}

const levelLabels: Record<'ar' | 'en', Record<string, string>> = {
  ar: {
    not_started: 'لم يبدأ', introduced: 'تعرَّف', practicing: 'يتدرّب',
    assisted: 'بمساعدة', independent: 'مستقلّ', needs_review: 'يحتاج مراجعة',
  },
  en: {
    not_started: 'Not started', introduced: 'Introduced', practicing: 'Practicing',
    assisted: 'Assisted', independent: 'Independent', needs_review: 'Needs review',
  },
}

/// تواريخ الإسقاط ميلي ثانية لا نصوص D1، فتُنسَّق على حدة.
function formatMs(value: number | null, locale: 'ar' | 'en') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  return new Date(value).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/// نسبة أو شُرطة. `null` تعني غياب بيانات لا نسبة صفر.
function Rate({ value, hint }: { value: number | null; hint: string }) {
  if (value == null) return <span className="table-secondary" title={hint}>—</span>
  return <span className={value < 50 ? 'size-warning' : undefined}>{value}%</span>
}

export function ParentsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [records, setRecords] = useState<ParentRecord[]>([])
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /// تفصيل حساب واحد. مستقلّ عن القائمة: فتحه لا يُعيد تحميلها.
  const [detail, setDetail] = useState<ParentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  /// تقدّم طفل واحد. يُفتح فوق التفصيل لا بدلًا منه.
  const [progress, setProgress] = useState<ChildProgressReport | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressError, setProgressError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { const response = await api.parents({ q: query, plan, limit: 100 }); setRecords(response.data) }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setLoading(false) }
  }, [plan, query, text.loadError])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer) }, [load])

  async function openDetail(parentId: string) {
    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    try {
      const response = await api.parentDetail(parentId)
      setDetail(response.data)
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : text.detailError)
    } finally {
      setDetailLoading(false)
    }
  }

  async function openProgress(childId: string) {
    setProgressLoading(true)
    setProgressError('')
    setProgress(null)
    try {
      const response = await api.childProgress(childId)
      setProgress(response.data)
    } catch (caught) {
      setProgressError(caught instanceof Error ? caught.message : text.progressError)
    } finally {
      setProgressLoading(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.account}</span><h2>{text.title}</h2><p>{text.intro}</p></div><button className="button button--secondary" type="button" onClick={() => void load()}><Icon name="refresh" size={17}/>{text.refresh}</button></section>
      <section className="panel panel--table"><header className="panel__header panel__header--filters"><div><span className="panel__kicker">{text.directory}</span><h3>{text.title} <span className="title-count">{formatNumber(records.length, locale)}</span></h3></div><div className="filters-row"><label className="search-field"><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search}/></label><select value={plan} onChange={(event) => setPlan(event.target.value)}><option value="">{text.allPlans}</option><option value="free">{planLabels[locale].free}</option><option value="family">{planLabels[locale].family}</option><option value="family_plus">{planLabels[locale].family_plus}</option></select></div></header>
        {loading && !records.length ? <LoadingState label={text.loading}/> : error && !records.length ? <ErrorState message={error} onRetry={() => void load()}/> : records.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>{text.parent}</th><th>{text.plan}</th><th>{text.children}</th><th>{text.language}</th><th>{text.timezone}</th><th>{text.status}</th><th>{text.joined}</th><th/></tr></thead><tbody>{records.map((parent) => <tr key={parent.id}><td><div className="entity-cell"><span className="entity-avatar entity-avatar--parent">{(parent.display_name || parent.email || (locale === 'ar' ? 'و' : 'P')).charAt(0)}</span><div><strong>{parent.display_name || text.noName}</strong><small>{parent.email || parent.id}</small></div></div></td><td><span className={`plan-badge plan-badge--${parent.plan}`}>{planLabels[locale][parent.plan]}</span></td><td>{formatNumber(Number(parent.children_count), locale)}</td><td>{parent.locale === 'ar' ? text.arabic : parent.locale === 'en' ? text.english : parent.locale}</td><td>{parent.timezone}</td><td><span className={`account-status account-status--${parent.status}`}>{accountStatusLabels[locale][parent.status]}</span></td><td>{formatDate(parent.created_at, locale)}</td><td><div className="table-actions"><button className="icon-button icon-button--small" type="button" title={text.open} onClick={() => void openDetail(parent.id)}><Icon name="arrow" size={15}/></button></div></td></tr>)}</tbody></table></div> : <EmptyState title={text.empty} description={text.emptyDesc}/>} 
      </section>

      {/* تفصيل الحساب: مسار كان بلا مستدعٍ */}
      <Modal
        open={detailLoading || Boolean(detail) || Boolean(detailError)}
        onClose={() => { setDetail(null); setDetailError('') }}
        title={text.detailTitle}
        description={detail?.display_name ?? detail?.parent_id}
      >
        {detailLoading ? <LoadingState /> : null}
        {detailError ? <div className="inline-alert inline-alert--error">{detailError}</div> : null}
        {detail ? (
          <div className="entity-form">
            <dl className="detail-list">
              <div>
                <dt>{text.parent}</dt>
                <dd dir="ltr">{detail.parent_id}</dd>
              </div>
              <div>
                <dt>{text.plan}</dt>
                <dd><span className={`plan-badge plan-badge--${detail.plan}`}>{planLabels[locale][detail.plan]}</span></dd>
              </div>
              <div>
                <dt>{text.status}</dt>
                <dd>
                  <span className={`account-status account-status--${detail.status}`}>
                    {accountStatusLabels[locale][detail.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{text.createdAt}</dt>
                <dd dir="ltr">{formatMs(detail.created_at_ms, locale)}</dd>
              </div>
              <div>
                <dt>{text.lastEvent}</dt>
                <dd dir="ltr">{formatMs(detail.last_event_at_ms, locale)}</dd>
              </div>
            </dl>

            <h4>{text.childrenTitle} ({formatNumber(detail.children.length, locale)})</h4>
            {detail.children.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{text.nickname}</th>
                      <th>{text.track}</th>
                      <th>{text.childStatus}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {detail.children.map((child) => (
                      <tr key={child.child_id}>
                        <td>
                          <div>
                            {/* الإسقاط قد يفتقد الكُنية: الحدث الأول قد لا يحملها */}
                            <strong>{child.nickname ?? text.noData}</strong>
                            <small className="table-secondary" dir="ltr">{child.child_id}</small>
                          </div>
                        </td>
                        <td>
                          {child.age_track
                            ? <span className={`track-badge track-badge--${child.age_track}`}>{trackLabels[locale][child.age_track]}</span>
                            : <span className="table-secondary" title={text.noDataHint}>{text.noData}</span>}
                        </td>
                        <td>
                          <span className={`account-status account-status--${child.status === 'active' ? 'active' : 'archived'}`}>
                            {child.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="button button--ghost"
                            type="button"
                            onClick={() => void openProgress(child.child_id)}
                          >
                            {text.viewProgress}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title={text.noChildren} description={text.noChildrenHint} />}

            <p className="table-secondary">{text.detailHint}</p>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => { setDetail(null); setDetailError('') }}>
                {text.close}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* تقدّم الطفل: المسار كان يستعلم جدولًا غير موجود، فأُصلح في الخادم */}
      <Modal
        open={progressLoading || Boolean(progress) || Boolean(progressError)}
        onClose={() => { setProgress(null); setProgressError('') }}
        title={text.progressTitle}
        description={progress?.child.nickname}
      >
        {progressLoading ? <LoadingState /> : null}
        {progressError ? <div className="inline-alert inline-alert--error">{progressError}</div> : null}
        {progress ? (
          <div className="entity-form">
            <dl className="detail-list">
              <div>
                <dt>{text.nickname}</dt>
                <dd>{progress.child.nickname}</dd>
              </div>
              <div>
                <dt>{text.track}</dt>
                <dd>
                  <span className={`track-badge track-badge--${progress.child.age_track}`}>
                    {trackLabels[locale][progress.child.age_track]}
                  </span>
                </dd>
              </div>
            </dl>

            <h4>{text.watchTitle} ({formatNumber(progress.watch_progress.length, locale)})</h4>
            {progress.watch_progress.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{text.episode}</th>
                      <th>{text.series}</th>
                      <th>{text.watched}</th>
                      <th>{text.completed}</th>
                      <th>{text.watchCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.watch_progress.map((row) => (
                      <tr key={row.episode_id}>
                        <td><span className="table-primary">{row.episode_title ?? row.episode_id}</span></td>
                        <td><span className="table-secondary">{row.series_title ?? text.noData}</span></td>
                        {/* العمود بالثواني لا بالميلي ثانية */}
                        <td dir="ltr">{text.seconds(formatNumber(row.progress_seconds, locale))}</td>
                        <td>
                          {row.is_completed
                            ? <span className="status-badge status-badge--published">{text.yes}</span>
                            : <span className="table-secondary">{text.no}</span>}
                        </td>
                        <td dir="ltr">{formatNumber(row.watch_count, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="table-secondary">{text.noWatch}</p>}

            <h4>{text.masteryTitle} ({formatNumber(progress.mastery.length, locale)})</h4>
            {progress.mastery.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{text.objective}</th>
                      <th>{text.level}</th>
                      <th>{text.attemptsCount}</th>
                      <th>{text.successRate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.mastery.map((row) => (
                      <tr key={row.objective_id}>
                        <td>
                          <div>
                            <strong>{row.objective_title ?? row.objective_id}</strong>
                            {row.code ? <small className="table-secondary" dir="ltr">{row.code}</small> : null}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${row.level === 'needs_review' ? 'status-badge--review' : row.level === 'independent' ? 'status-badge--published' : 'status-badge--draft'}`}>
                            {levelLabels[locale][row.level] ?? row.level}
                          </span>
                        </td>
                        <td dir="ltr">{formatNumber(row.attempts, locale)}</td>
                        <td dir="ltr"><Rate value={row.success_rate} hint={text.noDataHint} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="table-secondary">{text.noMastery}</p>}

            <h4>{text.attemptsTitle} ({formatNumber(progress.attempts.length, locale)})</h4>
            {progress.attempts.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{text.when}</th>
                      <th>{text.content}</th>
                      <th>{text.score}</th>
                      <th>{text.duration}</th>
                      <th>{text.help}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.attempts.map((row) => (
                      <tr key={row.id}>
                        <td><span className="table-secondary">{formatDate(row.created_at, locale, true)}</span></td>
                        <td>
                          <span className="table-primary">
                            {row.game_title ?? row.episode_title ?? text.noData}
                          </span>
                        </td>
                        <td dir="ltr">
                          {row.score != null && row.max_score != null
                            ? <>{formatNumber(row.score, locale)}/{formatNumber(row.max_score, locale)} <Rate value={row.score_percent} hint={text.noDataHint} /></>
                            : <span className="table-secondary" title={text.noDataHint}>{text.noData}</span>}
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
            ) : <p className="table-secondary">{text.noAttempts}</p>}

            <p className="table-secondary">{text.progressHint}</p>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => { setProgress(null); setProgressError('') }}>
                {text.close}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
