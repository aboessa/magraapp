import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate } from '../lib/labels'
import type { SeasonDetail } from '../types/api'

export function SeasonDetailPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const { id = '' } = useParams()
  const [season, setSeason] = useState<SeasonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'episodes' | 'overview' | 'goals'>('episodes')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSeason((await api.seasonDetail(id)).data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الموسم' : 'Unable to load season')
    } finally {
      setLoading(false)
    }
  }, [ar, id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !season) return <LoadingState label={ar ? 'جارٍ تحميل الموسم...' : 'Loading season...'} />
  if (error && !season) return <ErrorState message={error} onRetry={() => void load()} />
  if (!season) return <EmptyState title={ar ? 'الموسم غير موجود' : 'Season not found'} description="" />

  const title = season.title_ar || `${ar ? 'الموسم' : 'Season'} ${season.season_number}`
  const publishedCount = season.episodes.filter((e) => e.is_published).length

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('seasons')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{ar ? 'المواسم' : 'Seasons'}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {title}
              </h1>
              <StatusBadge status={season.status} />
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              <Link to={adminPath(`series/${season.series_id}`)} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                {season.series_title}
              </Link>{' '}
              · {ar ? `موسم رقم ${season.season_number}` : `Season #${season.season_number}`} ·{' '}
              {season.watch_order === 'sequential'
                ? ar
                  ? 'مشاهدة متتابعة'
                  : 'Sequential'
                : ar
                ? 'مشاهدة حرة'
                : 'Any-order'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link className="button button--secondary button--small" to={adminPath('seasons')}>
            <Icon name="file-text" size={14} />
            <span>{ar ? 'تعديل الموسم' : 'Edit Season'}</span>
          </Link>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'حلقات الموسم' : 'Total Episodes'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{season.episodes.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{publishedCount} {ar ? 'منشورة للجمهور' : 'published'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'جاهزية النشر' : 'Publishing Rate'}</span>
            <div className="bento-glass-card__icon"><Icon name="play" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">
            {season.episodes.length ? Math.round((publishedCount / season.episodes.length) * 100) : 0}%
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{season.episodes.length - publishedCount} {ar ? 'قيد المراجعة/الإنتاج' : 'in pipeline'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الأهداف التعليمية' : 'Learning Goals'}</span>
            <div className="bento-glass-card__icon"><Icon name="star" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{season.learning_goals.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{ar ? 'أهداف مقيسة' : 'Targeted skills'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'نمط المشاهدة' : 'Viewing Logic'}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>
            {season.watch_order === 'sequential' ? (ar ? 'متتابعة' : 'Sequential') : (ar ? 'حرة' : 'Free')}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{season.release_date ? formatDate(season.release_date, locale) : '—'}</span>
          </div>
        </article>
      </section>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, overflowX: 'auto' }}>
        <button
          className={`button ${tab === 'episodes' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('episodes')}
        >
          {ar ? 'قائمة الحلقات' : 'Episodes'} ({season.episodes.length})
        </button>
        <button
          className={`button ${tab === 'overview' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('overview')}
        >
          {ar ? 'بيانات الموسم' : 'Season Details'}
        </button>
        <button
          className={`button ${tab === 'goals' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('goals')}
        >
          {ar ? 'الأهداف التعليمية' : 'Learning Goals'} ({season.learning_goals.length})
        </button>
      </div>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'episodes' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="play" size={18} />
                  <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'حلقات هذا الموسم' : 'Season Episodes'}</h3>
                </div>
                <span className="badge badge--pill">{season.episodes.length} {ar ? 'حلقة' : 'episodes'}</span>
              </div>

              {season.episodes.length ? (
                <div className="table-scroll" tabIndex={0}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{ar ? 'الحلقة' : 'Episode'}</th>
                        <th>{ar ? 'النشر' : 'Publication'}</th>
                        <th>{ar ? 'الحالة' : 'Status'}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {season.episodes.map((episode) => (
                        <tr key={episode.id}>
                          <td>
                            <Link className="entity-cell entity-cell--button" to={adminPath(`episodes/${episode.id}`)}>
                              <span className="entity-avatar">{episode.episode_number ?? '—'}</span>
                              <div>
                                <strong>{episode.title_ar}</strong>
                                <small>
                                  {episode.episode_number != null
                                    ? `${ar ? 'الحلقة' : 'Episode'} ${episode.episode_number}`
                                    : '—'}
                                </small>
                              </div>
                            </Link>
                          </td>
                          <td>
                            <span className={`status-badge status-badge--${episode.is_published ? 'published' : 'draft'}`}>
                              {episode.is_published ? (ar ? 'منشورة' : 'Published') : (ar ? 'مسودة' : 'Unpublished')}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={episode.status} />
                          </td>
                          <td>
                            <Link className="button button--ghost button--small" to={adminPath(`episodes/${episode.id}`)}>
                              {ar ? 'فتح' : 'Open'}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={ar ? 'لا توجد حلقات في هذا الموسم' : 'No episodes in this season'}
                  description={ar ? 'أضف الحلقات واربطها بهذا الموسم من صفحة الحلقات.' : 'Add episodes and link them to this season from the Episodes page.'}
                />
              )}
            </div>
          )}

          {tab === 'overview' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="file-text" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'عن هذا الموسم وموضوعه' : 'About Season & Theme'}</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--muted)' }}>{ar ? 'الوصف' : 'Description'}</h4>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>
                    {season.description_ar || (ar ? 'لا يوجد وصف مسجل لهذا الموسم بعد.' : 'No description recorded yet.')}
                  </p>
                </div>

                <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
                  <div>
                    <dt>{ar ? 'الموضوع الرئيسي' : 'Core Theme'}</dt>
                    <dd><strong>{season.theme_ar || '—'}</strong></dd>
                  </div>
                  <div>
                    <dt>{ar ? 'تاريخ الإصدار' : 'Release Date'}</dt>
                    <dd>{season.release_date ? formatDate(season.release_date, locale) : '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {tab === 'goals' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="star" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'الأهداف والمهارات التعليمية للموسم' : 'Curriculum Learning Goals'}</h3>
              </div>

              {season.learning_goals.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {season.learning_goals.map((goal) => (
                    <span className="track-badge" key={goal} style={{ padding: '6px 12px', fontSize: 13 }}>
                      {goal}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="table-secondary">{ar ? 'لا توجد أهداف تعليمية مسجلة لهذا الموسم.' : 'No learning goals recorded.'}</div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Season Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Parent Series Summary */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="grid" size={16} />
              <span>{ar ? 'السلسلة الأم' : 'Parent Series'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <strong style={{ fontSize: 14 }}>{season.series_title}</strong>
              </div>
              <Link to={adminPath(`series/${season.series_id}`)} className="button button--secondary button--small" style={{ justifyContent: 'center' }}>
                <Icon name="arrow" size={12} />
                <span>{ar ? 'فتح ملف السلسلة' : 'Open Series'}</span>
              </Link>
            </div>
          </div>

          {/* Publishing Meter */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="analytics" size={16} />
              <span>{ar ? 'معدل الإنجاز' : 'Pipeline Readiness'}</span>
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span>{publishedCount} {ar ? 'من' : 'of'} {season.episodes.length} {ar ? 'حلقات جاهزة' : 'ready'}</span>
              <strong style={{ color: 'var(--color-success, #10b981)' }}>
                {season.episodes.length ? Math.round((publishedCount / season.episodes.length) * 100) : 0}%
              </strong>
            </div>
            <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${season.episodes.length ? Math.round((publishedCount / season.episodes.length) * 100) : 0}%`,
                  height: '100%',
                  background: 'var(--color-success, #10b981)',
                }}
              />
            </div>
          </div>

          {/* AI Season Copilot */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار إنتاج المواسم' : 'Season Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {publishedCount === season.episodes.length && season.episodes.length > 0
                ? (ar ? 'جميع حلقات هذا الموسم منشورة بالكامل وجاهزة للاستهلاك داخل التطبيق.' : 'All episodes in this season are fully published and live in runtime.')
                : (ar ? 'تأكد من استكمال المراجعة اللغوية والشرعية للحلقات المتبقية قبل إطلاق الحملة التسويقية للموسم.' : 'Complete pending pedagogical and narration QA before initiating promotional push.')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
