import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DetailTabs } from '../components/DetailTabs'
import { EntityHeader, EntityThumbnail } from '../components/EntityHeader'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate } from '../lib/labels'
import type { SeasonDetail } from '../types/api'

export function SeasonDetailPage() {
  const { locale } = usePreferences(); const ar = locale === 'ar'; const { id = '' } = useParams()
  const [season, setSeason] = useState<SeasonDetail | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { setSeason((await api.seasonDetail(id)).data) } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الموسم' : 'Unable to load season') } finally { setLoading(false) } }, [ar, id])
  useEffect(() => { void load() }, [load])
  if (loading && !season) return <LoadingState label={ar ? 'جارٍ تحميل الموسم...' : 'Loading season...'} />
  if (error && !season) return <ErrorState message={error} onRetry={() => void load()} />
  if (!season) return <EmptyState title={ar ? 'الموسم غير موجود' : 'Season not found'} description="" />
  const title = season.title_ar || `${ar ? 'الموسم' : 'Season'} ${season.season_number}`
  return <div className="page-stack">
    <EntityHeader
      breadcrumbs={[{ label: ar ? 'المواسم' : 'Seasons', to: adminPath('seasons') }, { label: season.series_title, to: adminPath(`series/${season.series_id}`) }, { label: title }]}
      thumbnail={<EntityThumbnail alt={title} label={String(season.season_number)} icon="series" size={64} />}
      title={title}
      subtitle={season.description_ar || season.theme_ar || undefined}
      meta={<><span>{season.series_title}</span><span>{ar ? 'موسم' : 'Season'} {season.season_number}</span><span>{season.watch_order === 'sequential' ? (ar ? 'مشاهدة متتابعة' : 'Sequential viewing') : (ar ? 'مشاهدة حرة' : 'Any-order viewing')}</span></>}
      status={<StatusBadge status={season.status} />}
      actions={<Link className="button button--secondary" to={adminPath('seasons')}><Icon name="edit" size={16} />{ar ? 'تعديل' : 'Edit'}</Link>}
    />
    <DetailTabs tabs={[
      { key: 'overview', label: ar ? 'نظرة عامة' : 'Overview', content: <div className="dashboard-grid dashboard-grid--tracks"><article className="panel"><header className="panel__header"><h3>{ar ? 'عن الموسم' : 'About this season'}</h3></header><div className="detail-panel-pad">{season.description_ar || <span className="data-unavailable">{ar ? 'لا يوجد وصف مسجل لهذا الموسم بعد.' : 'No description is recorded for this season yet.'}</span>}</div></article><article className="panel"><header className="panel__header"><h3>{ar ? 'البيانات' : 'Details'}</h3></header><div className="detail-fields detail-panel-pad"><div><span>{ar ? 'الموضوع' : 'Theme'}</span><strong>{season.theme_ar || '—'}</strong></div><div><span>{ar ? 'تاريخ الإصدار' : 'Release date'}</span><strong>{season.release_date ? formatDate(season.release_date, locale) : '—'}</strong></div><div><span>{ar ? 'عدد الحلقات في الموسم' : 'Episodes in season'}</span><strong>{season.episodes.length}</strong></div></div></article></div> },
      { key: 'episodes', label: ar ? 'الحلقات' : 'Episodes', badge: season.episodes.length, content: season.episodes.length ? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{ar ? 'الحلقة' : 'Episode'}</th><th>{ar ? 'النشر' : 'Publication'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th /></tr></thead><tbody>{season.episodes.map((episode) => <tr key={episode.id}><td><Link className="entity-cell entity-cell--button" to={adminPath(`episodes/${episode.id}`)}><span className="entity-avatar">{episode.episode_number ?? '—'}</span><div><strong>{episode.title_ar}</strong><small>{episode.episode_number != null ? `${ar ? 'الحلقة' : 'Episode'} ${episode.episode_number}` : '—'}</small></div></Link></td><td>{episode.is_published ? (ar ? 'منشورة' : 'Published') : (ar ? 'غير منشورة' : 'Not published')}</td><td><StatusBadge status={episode.status} /></td><td><Link className="button button--ghost" to={adminPath(`episodes/${episode.id}`)}>{ar ? 'فتح' : 'Open'}</Link></td></tr>)}</tbody></table></div> : <EmptyState title={ar ? 'لا توجد حلقات في هذا الموسم' : 'No episodes in this season'} description={ar ? 'أضف الحلقات واربطها بهذا الموسم من صفحة الحلقات.' : 'Add episodes and link them to this season from the Episodes page.'} /> },
      { key: 'goals', label: ar ? 'الأهداف التعليمية' : 'Learning goals', badge: season.learning_goals.length, content: season.learning_goals.length ? <div className="badge-list detail-panel-pad">{season.learning_goals.map((goal) => <span className="track-badge" key={goal}>{goal}</span>)}</div> : <div className="data-unavailable">{ar ? 'لا توجد أهداف تعليمية مسجلة لهذا الموسم.' : 'No learning goals are recorded for this season.'}</div> },
      { key: 'media', label: ar ? 'الوسائط' : 'Media', content: <div className="data-unavailable">{ar ? 'لا يعيد الخادم أصول أو روابط وسائط الموسم في endpoint التفاصيل بعد؛ لم يتم إنشاء معرض مزيّف.' : 'The detail endpoint does not return season assets or media links yet; no fabricated gallery is shown.'}</div> },
    ]} />
  </div>
}
