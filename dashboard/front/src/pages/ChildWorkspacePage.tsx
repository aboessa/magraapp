import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { DetailTabs } from '../components/DetailTabs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { trackLabels } from '../lib/labels'
import { Icon } from '../components/Icon'

const copy = {
  ar: {
    eyebrow: 'إدارة ملفات الأطفال',
    back: 'العودة لقائمة الأطفال',
    loading: 'جارٍ تحميل ملف الطفل…',
    loadError: 'تعذر تحميل ملف الطفل',
    tabs: {
      overview: 'نظرة عامة ومقاييس',
      profile: 'بيانات الملف',
      learning: 'التقدم والإتقان',
      content: 'المحتوى والمشاهدة',
      privacy: 'الخصوصية والأمان',
    },
    nickname: 'الاسم المستعار',
    track: 'المسار التعليمي',
    family: 'العائلة',
    parent: 'ولي الأمر',
    status: 'الحالة',
    birth: 'تاريخ الميلاد',
    language: 'اللغة المفضلة',
    interests: 'الاهتمامات المختارة',
    noData: '—',
    privacyHint: 'البيانات الحساسة مقيّدة لحماية الطفل. تاريخ الميلاد الكامل لا يُعرض إلا للمخولين وفق ضوابط الخصوصية.',
    ageBand: 'الفئة العمرية',
    progressUnavailable: 'تعذر تحميل بيانات التعلم حاليًا.',
    viewFamily: 'ملف العائلة 360',
    viewParent: 'ملف ولي الأمر',
    watchTitle: 'سجل مشاهدة الحلقات',
    masteryTitle: 'سجل شارات وأدلة الإتقان',
    attemptsTitle: 'سجل المحاولات في الألعاب',
    episode: 'الحلقة',
    completed: 'مكتمل',
    watchCount: 'مرات المشاهدة',
    objective: 'الهدف التعليمي',
    level: 'المستوى',
    attemptsCount: 'المحاولات',
    successRate: 'نسبة النجاح',
    score: 'الدرجة',
    duration: 'المدة',
    noWatch: 'لا يوجد سجل مشاهدات مسجل',
    noMastery: 'لا توجد شارات إتقان محققة بعد',
    noAttempts: 'لا توجد محاولات ألعاب مسجلة',
  },
  en: {
    eyebrow: 'Child Profiles',
    back: 'Back to Children',
    loading: 'Loading child profile…',
    loadError: 'Unable to load child profile',
    tabs: {
      overview: 'Overview & KPIs',
      profile: 'Profile Data',
      learning: 'Mastery Progress',
      content: 'Media & Watching',
      privacy: 'Privacy & Security',
    },
    nickname: 'Nickname',
    track: 'Track',
    family: 'Family',
    parent: 'Parent',
    status: 'Status',
    birth: 'Birth',
    language: 'Language',
    interests: 'Interests',
    noData: '—',
    privacyHint: 'Sensitive data is protected. Exact birth date is restricted to authorized roles only.',
    ageBand: 'Age Band',
    progressUnavailable: 'Learning data is temporarily unavailable.',
    viewFamily: 'Family 360',
    viewParent: 'Parent Profile',
    watchTitle: 'Episode Watching History',
    masteryTitle: 'Mastery & Learning Evidence',
    attemptsTitle: 'Interactive Game Attempts',
    episode: 'Episode',
    completed: 'Completed',
    watchCount: 'Watch Count',
    objective: 'Objective',
    level: 'Level',
    attemptsCount: 'Attempts',
    successRate: 'Success Rate',
    score: 'Score',
    duration: 'Duration',
    noWatch: 'No watch history recorded',
    noMastery: 'No mastery records earned yet',
    noAttempts: 'No game attempts recorded',
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError, text.progressUnavailable])

  useEffect(() => {
    void load()
  }, [load])

  const setTab = (key: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!child) return <EmptyState title={text.loadError} description={id} />

  const nickname = child.nickname || text.noData
  const initial = nickname.trim().charAt(0) || (locale === 'ar' ? 'ط' : 'C')

  const overview = (
    <div className="page-stack">
      <div className="hero-kpis">
        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
            <Icon name="children" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.track}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 18 }}>
              {(trackLabels as any)[locale][child.age_track] ?? child.age_track}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#ec4899' }}>
              المسار العمري المخصص
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="check" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.masteryTitle}</span>
            <div className="kpi-glass-card__num">{progress?.mastery?.length ?? 0}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              شارات إتقان محققة
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Icon name="video" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.watchTitle}</span>
            <div className="kpi-glass-card__num">{progress?.watch_progress?.length ?? 0}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#818cf8' }}>
              حلقات تمت مشاهدتها
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Icon name="games" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.attemptsTitle}</span>
            <div className="kpi-glass-card__num">{progress?.attempts?.length ?? 0}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#fbbf24' }}>
              محاولات في الألعاب
            </span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 16 }}>معلومات الطفل والأسرة</h4>
        <dl className="detail-list">
          <div>
            <dt>{text.birth}</dt>
            <dd>
              {child.birth_year} — {months[locale][(child.birth_month ?? 1) - 1]}
            </dd>
          </div>
          <div>
            <dt>{text.parent}</dt>
            <dd>
              <Link to={adminPath(`parents/${child.parent_id}`)}>
                {child.parent_name ?? child.parent_id}
              </Link>
            </dd>
          </div>
          <div>
            <dt>{text.family}</dt>
            <dd>
              <Link to={adminPath(`customers/${child.parent_id}`)}>{child.parent_id}</Link>
            </dd>
          </div>
        </dl>
        <p className="readiness-note" style={{ marginTop: 14 }}>
          {text.privacyHint}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Link
            className="button button--primary button--small"
            to={adminPath(`customers/${child.parent_id}`)}
          >
            <Icon name="parents" size={13} />
            <span>{text.viewFamily}</span>
          </Link>
          <Link
            className="button button--ghost button--small"
            to={adminPath(`parents/${child.parent_id}`)}
          >
            <Icon name="parents" size={13} />
            <span>{text.viewParent}</span>
          </Link>
        </div>
      </div>
    </div>
  )

  const profileTab = (
    <div className="page-stack">
      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <dl className="detail-list">
          <div>
            <dt>{text.nickname}</dt>
            <dd>{nickname}</dd>
          </div>
          <div>
            <dt>{text.track}</dt>
            <dd>
              {child.age_track ? (
                <span className={`track-badge track-badge--${child.age_track}`}>
                  {(trackLabels as any)[locale][child.age_track]}
                </span>
              ) : (
                text.noData
              )}
            </dd>
          </div>
          <div>
            <dt>{text.birth}</dt>
            <dd>
              {child.birth_year} / {child.birth_month}
            </dd>
          </div>
          <div>
            <dt>{text.language}</dt>
            <dd>{child.language}</dd>
          </div>
          <div>
            <dt>{text.interests}</dt>
            <dd className="cell-wrap">
              {(() => {
                try {
                  const p = JSON.parse(child.interests)
                  return Array.isArray(p) ? p.join(locale === 'ar' ? '، ' : ', ') : child.interests
                } catch {
                  return child.interests || text.noData
                }
              })()}
            </dd>
          </div>
          <div>
            <dt>{text.status}</dt>
            <dd>{child.status}</dd>
          </div>
        </dl>
        <p className="readiness-note" style={{ marginTop: 14 }}>
          {text.privacyHint}
        </p>
      </div>
    </div>
  )

  const learningTab = progressError ? (
    <p className="inline-alert inline-alert--warn">{text.progressUnavailable}</p>
  ) : progress ? (
    <div className="page-stack">
      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 12px' }}>
          {text.masteryTitle} ({progress.mastery?.length ?? 0})
        </h4>
        {progress.mastery?.length ? (
          <div className="table-scroll" tabIndex={0}>
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
                {progress.mastery.map((row: any) => (
                  <tr key={row.objective_id}>
                    <td>{row.objective_title ?? row.objective_id}</td>
                    <td>{row.level}</td>
                    <td>{row.attempts}</td>
                    <td>{row.success_rate != null ? `${row.success_rate}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="table-secondary">{text.noMastery}</p>
        )}
      </div>

      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 12px' }}>
          {text.attemptsTitle} ({progress.attempts?.length ?? 0})
        </h4>
        {progress.attempts?.length ? (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.score}</th>
                  <th>{text.duration}</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {progress.attempts.map((row: any) => (
                  <tr key={row.id}>
                    <td>{row.score != null && row.max_score != null ? `${row.score}/${row.max_score}` : '—'}</td>
                    <td>{row.time_spent_seconds}s</td>
                    <td dir="ltr">{row.created_at?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="table-secondary">{text.noAttempts}</p>
        )}
      </div>
    </div>
  ) : (
    <LoadingState />
  )

  const contentTab = (
    <div className="page-stack">
      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 12px' }}>
          {text.watchTitle} ({progress?.watch_progress?.length ?? 0})
        </h4>
        {progress?.watch_progress?.length ? (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.episode}</th>
                  <th>{text.completed}</th>
                  <th>{text.watchCount}</th>
                </tr>
              </thead>
              <tbody>
                {progress.watch_progress.map((row: any) => (
                  <tr key={row.episode_id}>
                    <td>{row.episode_title ?? row.episode_id}</td>
                    <td>{row.is_completed ? '✓' : '—'}</td>
                    <td>{row.watch_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="table-secondary">{text.noWatch}</p>
        )}
      </div>
    </div>
  )

  const privacyTab = (
    <div className="page-stack">
      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <p className="readiness-note">{text.privacyHint}</p>
        <ul className="readiness-list">
          <li className="readiness-item">
            <strong>{text.ageBand}</strong> —{' '}
            {locale === 'ar' ? 'يُعرض بدلاً من تاريخ الميلاد الكامل لمعظم الأدوار الإدارية.' : 'Shown instead of full birth date for most roles.'}
          </li>
          <li className="readiness-item">
            <strong>{text.track}</strong> — {child.age_track}
          </li>
          <li className="readiness-item">
            <strong>{locale === 'ar' ? 'بيانات التعلم' : 'Learning'}</strong> —{' '}
            {locale === 'ar' ? 'مقيّدة بالصلاحية لحماية تقدم الطفل.' : 'Access is permission-gated to protect child privacy.'}
          </li>
        </ul>
        <div style={{ marginTop: 14 }}>
          <Link className="button button--ghost" to={adminPath(`customers/${child.parent_id}`)}>
            {text.viewFamily}
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, rgba(139, 92, 246, 0.15) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{
                borderColor: child.status === 'active' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                color: child.status === 'active' ? '#10b981' : '#f87171',
              }}
            >
              <span
                className="status-dot-pulse"
                style={{ background: child.status === 'active' ? '#10b981' : '#f87171' }}
              />
              ملف الطفل: {child.status}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
            <div className="child-avatar-ring" style={{ width: 54, height: 54, fontSize: 22 }}>
              {initial}
            </div>
            <div>
              <h1 className="catalog-hero__title" style={{ fontSize: 24, margin: 0 }}>
                {nickname}
              </h1>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                #{child.id.slice(0, 8)} · {(trackLabels as any)[locale][child.age_track] ?? child.age_track}
              </div>
            </div>
          </div>
        </div>
        <div className="catalog-hero__actions">
          <Link className="button button--secondary" to={adminPath('children')} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="chevron-left" size={14} />
            <span>{text.back}</span>
          </Link>
        </div>
      </section>

      {/* 2. Detail tabs */}
      <div style={{ marginTop: 20 }}>
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
    </div>
  )
}
