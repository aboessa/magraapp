import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { DetailTabs } from '../components/DetailTabs'
import { EntityHeader } from '../components/EntityHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { trackLabels } from '../lib/labels'

const copy = {
  ar: {
    eyebrow: 'ملفات الأطفال', back: 'كل الأطفال', loading: 'جارٍ تحميل ملف الطفل…', loadError: 'تعذر تحميل ملف الطفل',
    tabs: { overview: 'نظرة عامة', profile: 'الملف', learning: 'التعلم', content: 'المحتوى', devices: 'الأجهزة', privacy: 'الخصوصية', activity: 'النشاط' },
    nickname: 'الاسم', track: 'المسار', family: 'العائلة', parent: 'ولي الأمر', status: 'الحالة',
    birth: 'سنة الميلاد', language: 'اللغة', interests: 'الاهتمامات', noData: '—',
    privacyHint: 'البيانات الحساسة مقيّدة. تاريخ الميلاد الكامل لا يُعرض إلا للمخولين.',
    ageBand: 'الفئة العمرية', progressUnavailable: 'تعذر تحميل بيانات التعلم حاليًا.',
    viewFamily: 'ملف العائلة', viewParent: 'ولي الأمر',
    watchTitle: 'المشاهدة', masteryTitle: 'الإتقان', attemptsTitle: 'المحاولات',
    episode: 'الحلقة', completed: 'مكتمل', watchCount: 'مرات المشاهدة',
    objective: 'الهدف', level: 'المستوى', attemptsCount: 'المحاولات', successRate: 'نسبة النجاح',
    score: 'الدرجة', duration: 'المدة',
    noWatch: 'لا مشاهدات', noMastery: 'لا سجل إتقان', noAttempts: 'لا محاولات',
  },
  en: {
    eyebrow: 'Child profiles', back: 'All children', loading: 'Loading child profile…', loadError: 'Unable to load child profile',
    tabs: { overview: 'Overview', profile: 'Profile', learning: 'Learning', content: 'Content', devices: 'Devices', privacy: 'Privacy', activity: 'History' },
    nickname: 'Name', track: 'Track', family: 'Family', parent: 'Parent', status: 'Status',
    birth: 'Birth year', language: 'Language', interests: 'Interests', noData: '—',
    privacyHint: 'Sensitive data is restricted. Full birth date is shown only to authorized staff.',
    ageBand: 'Age band', progressUnavailable: 'Learning data is temporarily unavailable.',
    viewFamily: 'Family file', viewParent: 'Parent',
    watchTitle: 'Watching', masteryTitle: 'Mastery', attemptsTitle: 'Attempts',
    episode: 'Episode', completed: 'Completed', watchCount: 'Watch count',
    objective: 'Objective', level: 'Level', attemptsCount: 'Attempts', successRate: 'Success rate',
    score: 'Score', duration: 'Duration',
    noWatch: 'No watch history', noMastery: 'No mastery records', noAttempts: 'No attempts',
  },
}

const months: Record<string, string[]> = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

export function ChildWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const [child, setChild] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [progressError, setProgressError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setProgressError('')
    try {
      const res = await api.childDetail(id)
      setChild(res.data)
      try {
        const prog = await api.childProgress(id)
        setProgress(prog.data)
      } catch (e) {
        setProgressError(e instanceof Error ? e.message : text.progressUnavailable)
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setLoading(false) }
  }, [id, text.loadError, text.progressUnavailable])

  useEffect(() => { void load() }, [load])

  const setTab = (key: string) => { const next = new URLSearchParams(searchParams); next.set('tab', key); setSearchParams(next, { replace: true }) }

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!child) return <EmptyState title={text.loadError} description={id} />

  const nickname = child.nickname || text.noData

  const overview = (
    <div className="page-stack">
      <div className="stat-grid">
        <div className="stat-card"><span>{text.track}</span><strong><span className={`track-badge track-badge--${child.age_track}`}>{(trackLabels as any)[locale][child.age_track] ?? child.age_track}</span></strong></div>
        <div className="stat-card"><span>{text.status}</span><strong>{child.status}</strong></div>
        <div className="stat-card"><span>{text.ageBand}</span><strong>{child.age_track}</strong></div>
        <div className="stat-card"><span>{text.language}</span><strong>{child.language}</strong></div>
      </div>
      <dl className="detail-list">
        <div><dt>{text.birth}</dt><dd>{child.birth_year} — {months[locale][(child.birth_month ?? 1) - 1]}</dd></div>
        <div><dt>{text.parent}</dt><dd><Link to={adminPath(`parents/${child.parent_id}`)}>{child.parent_name ?? child.parent_id}</Link></dd></div>
        <div><dt>{text.family}</dt><dd><Link to={adminPath(`customers/${child.parent_id}`)}>{child.parent_id}</Link></dd></div>
      </dl>
      <p className="readiness-note">{text.privacyHint}</p>
      <div className="form-actions">
        <Link className="button button--primary button--small" to={adminPath(`customers/${child.parent_id}`)}>{text.viewFamily}</Link>
        <Link className="button button--ghost button--small" to={adminPath(`parents/${child.parent_id}`)}>{text.viewParent}</Link>
      </div>
    </div>
  )

  const profileTab = (
    <div className="page-stack">
      <dl className="detail-list">
        <div><dt>{text.nickname}</dt><dd>{nickname}</dd></div>
        <div><dt>{text.track}</dt><dd>{child.age_track ? <span className={`track-badge track-badge--${child.age_track}`}>{(trackLabels as any)[locale][child.age_track]}</span> : text.noData}</dd></div>
        <div><dt>{text.birth}</dt><dd>{child.birth_year} / {child.birth_month}</dd></div>
        <div><dt>{text.language}</dt><dd>{child.language}</dd></div>
        <div><dt>{text.interests}</dt><dd className="cell-wrap">{(() => { try { const p = JSON.parse(child.interests); return Array.isArray(p) ? p.join(locale === 'ar' ? '، ' : ', ') : child.interests } catch { return child.interests || text.noData } })()}</dd></div>
        <div><dt>{text.status}</dt><dd>{child.status}</dd></div>
      </dl>
      <p className="readiness-note">{text.privacyHint}</p>
    </div>
  )

  const learningTab = progressError ? <p className="inline-alert inline-alert--warn">{text.progressUnavailable}</p>
    : progress ? (
      <div className="page-stack">
        <h4>{text.watchTitle} ({progress.watch_progress?.length ?? 0})</h4>
        {progress.watch_progress?.length ? (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.episode}</th><th>{text.completed}</th><th>{text.watchCount}</th></tr></thead>
              <tbody>
                {progress.watch_progress.map((row: any) => (
                  <tr key={row.episode_id}><td>{row.episode_title ?? row.episode_id}</td><td>{row.is_completed ? '✓' : '—'}</td><td>{row.watch_count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="table-secondary">{text.noWatch}</p>}

        <h4>{text.masteryTitle} ({progress.mastery?.length ?? 0})</h4>
        {progress.mastery?.length ? (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.objective}</th><th>{text.level}</th><th>{text.attemptsCount}</th><th>{text.successRate}</th></tr></thead>
              <tbody>
                {progress.mastery.map((row: any) => (
                  <tr key={row.objective_id}><td>{row.objective_title ?? row.objective_id}</td><td>{row.level}</td><td>{row.attempts}</td><td>{row.success_rate != null ? `${row.success_rate}%` : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="table-secondary">{text.noMastery}</p>}

        <h4>{text.attemptsTitle} ({progress.attempts?.length ?? 0})</h4>
        {progress.attempts?.length ? (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.score}</th><th>{text.duration}</th><th>{text.attemptsCount}</th></tr></thead>
              <tbody>
                {progress.attempts.map((row: any) => (
                  <tr key={row.id}><td>{row.score != null && row.max_score != null ? `${row.score}/${row.max_score}` : '—'}</td><td>{row.time_spent_seconds}s</td><td dir="ltr">{row.created_at?.slice(0, 10)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="table-secondary">{text.noAttempts}</p>}
      </div>
    ) : <LoadingState />

  const contentTab = progress ? learningTab : <p className="readiness-note">{text.progressUnavailable}</p>

  const privacyTab = (
    <div className="page-stack">
      <p className="readiness-note">{text.privacyHint}</p>
      <ul className="readiness-list">
        <li className="readiness-item"><strong>{text.ageBand}</strong> — {locale === 'ar' ? 'يُعرض بدل تاريخ الميلاد الكامل لمعظم الأدوار.' : 'Shown instead of full birth date for most roles.'}</li>
        <li className="readiness-item"><strong>{text.track}</strong> — {child.age_track}</li>
        <li className="readiness-item"><strong>{locale === 'ar' ? 'التعلم' : 'Learning'}</strong> — {locale === 'ar' ? 'مقيّد حسب الصلاحية، ليس لكل الأدوار.' : 'Access is permission-gated, not visible to every role.'}</li>
      </ul>
      <Link className="button button--ghost" to={adminPath(`customers/${child.parent_id}`)}>{text.viewFamily}</Link>
    </div>
  )

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[{ label: text.eyebrow, to: adminPath('children') }, { label: nickname }]}
        title={nickname}
        subtitle={`#${child.id.slice(0, 8)} · ${child.age_track}`}
        meta={<><span>{text.family}: <Link to={adminPath(`customers/${child.parent_id}`)}>{child.parent_name ?? child.parent_id}</Link></span></>}
        status={<span className={`account-status account-status--${child.status}`}>{child.status}</span>}
        actions={<Link className="button button--ghost" to={adminPath('children')}>{text.back}</Link>}
      />
      <DetailTabs
        active={activeTab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: text.tabs.overview, content: overview },
          { key: 'profile', label: text.tabs.profile, content: profileTab },
          { key: 'learning', label: text.tabs.learning, content: learningTab },
          { key: 'content', label: text.tabs.content, content: contentTab },
          { key: 'privacy', label: text.tabs.privacy, content: privacyTab },
        ]}
      />
    </div>
  )
}
