import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { EntityHeader } from '../components/EntityHeader'
import { DetailTabs } from '../components/DetailTabs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate, formatNumber, statusLabels } from '../lib/labels'
import type { ContentStatus, EpisodeRecord } from '../types/api'

/// تسلسل مراحل النشر الحقيقي كما هو مخزَّن في عمود status الواحد. لا توجد في
/// الخادم بيانات تقدّم منفصلة لكل مسار (سكربت/ترجمة/صوت/فيديو/QA) — التتبّع
/// أدناه يعرض هذا التسلسل الوحيد الموجود فعليًا، لا تقدّمًا موزّعًا مُخترعًا.
const SEQUENCE: ContentStatus[] = ['draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published']

const copy = {
  ar: {
    back: 'الحلقات', loading: 'جارٍ تحميل الحلقة...', loadError: 'تعذر تحميل الحلقة', notFound: 'الحلقة غير موجودة',
    overview: 'نظرة عامة', mediaTab: 'الوسائط', learningTab: 'الأهداف التعليمية', familyTab: 'الأنشطة العائلية', productionTab: 'مراحل النشر', analyticsTab: 'الأداء',
    description: 'وصف الحلقة', noDescription: 'لا يوجد وصف لهذه الحلقة بعد.',
    identity: 'الهوية', series: 'السلسلة', duration: 'المدة', ageRange: 'المدى العمري', updated: 'آخر تحديث', episodeNumber: 'رقم الحلقة',
    video: 'الفيديو', thumbnail: 'الصورة المصغّرة', captions: 'الترجمة المصاحبة', dubs: 'لغات الدوبلاج', noVideo: 'بلا فيديو مرفوع', noThumbnail: 'بلا صورة مصغّرة', noCaptions: 'بلا ترجمة مصاحبة',
    objective: 'الهدف التعليمي', noObjective: 'لا يوجد هدف تعليمي مرتبط بهذه الحلقة.', parentGuide: 'دليل ولي الأمر', noParentGuide: 'لا يوجد دليل لولي الأمر.',
    familyActivity: 'النشاط العائلي', noFamilyActivity: 'لا يوجد نشاط عائلي مسجَّل.', linkedGame: 'لعبة مرتبطة', linkedBook: 'كتاب مرتبط', none: 'بلا ارتباط',
    analyticsUnavailable: 'لا توجد بيانات تحليلات مرتبطة بهذه الحلقة تحديدًا في الخادم بعد.',
    currentStage: 'المرحلة الحالية',
  },
  en: {
    back: 'Episodes', loading: 'Loading episode...', loadError: 'Unable to load episode', notFound: 'Episode not found',
    overview: 'Overview', mediaTab: 'Media', learningTab: 'Learning objectives', familyTab: 'Family activities', productionTab: 'Publishing stages', analyticsTab: 'Performance',
    description: 'Episode description', noDescription: 'No description for this episode yet.',
    identity: 'Identity', series: 'Series', duration: 'Duration', ageRange: 'Age range', updated: 'Last updated', episodeNumber: 'Episode number',
    video: 'Video', thumbnail: 'Thumbnail', captions: 'Captions', dubs: 'Dub languages', noVideo: 'No video uploaded', noThumbnail: 'No thumbnail', noCaptions: 'No captions',
    objective: 'Learning objective', noObjective: 'No learning objective linked to this episode.', parentGuide: 'Parent guide', noParentGuide: 'No parent guide yet.',
    familyActivity: 'Family activity', noFamilyActivity: 'No family activity recorded.', linkedGame: 'Linked game', linkedBook: 'Linked book', none: 'None linked',
    analyticsUnavailable: 'No performance data specific to this episode exists on the server yet.',
    currentStage: 'Current stage',
  },
}

function durationLabel(seconds: number | null | undefined, locale: 'ar' | 'en') {
  if (!seconds) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = String(seconds % 60).padStart(2, '0')
  return `${formatNumber(minutes, locale)}:${remainder}`
}

export function EpisodeDetailPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const { id = '' } = useParams()
  const [episode, setEpisode] = useState<EpisodeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.episodeDetail(id)
      setEpisode(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading && !episode) return <LoadingState label={text.loading} />
  if (error && !episode) return <ErrorState message={error} onRetry={() => void load()} />
  if (!episode) return <EmptyState title={text.notFound} description="" />

  const stageIndex = SEQUENCE.indexOf(episode.status)

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[
          { label: text.back, to: adminPath('episodes') },
          { label: episode.series_title, to: adminPath(`series/${episode.series_id}`) },
          { label: episode.title_ar },
        ]}
        thumbnail={<EntityThumbnail src={episode.thumbnail_url} alt={episode.title_ar} icon="play" size={64} />}
        title={episode.title_ar}
        subtitle={episode.description_ar || undefined}
        meta={<>
          <span>{episode.episode_number ? `${text.episodeNumber} ${formatNumber(episode.episode_number, locale)}` : '—'}</span>
          <span>{durationLabel(episode.duration_seconds, locale)}</span>
          <span>{formatNumber(episode.age_min, locale)}–{formatNumber(episode.age_max, locale)}</span>
        </>}
        status={<StatusBadge status={episode.status} />}
        actions={<Link className="button button--secondary" to={adminPath(`episodes?q=${encodeURIComponent(episode.title_ar)}`)}><Icon name="edit" size={16} />{locale === 'ar' ? 'تعديل' : 'Edit'}</Link>}
      />

      <DetailTabs
        tabs={[
          {
            key: 'overview',
            label: text.overview,
            content: (
              <div className="dashboard-grid dashboard-grid--tracks">
                <article className="panel"><header className="panel__header"><h3>{text.description}</h3></header><div style={{ padding: '0 18px 18px', color: 'var(--text-soft)', fontSize: 11, lineHeight: 1.7 }}>{episode.description_ar || text.noDescription}</div></article>
                <article className="panel"><header className="panel__header"><h3>{text.identity}</h3></header>
                  <div style={{ padding: '0 18px 18px' }} className="form-grid form-grid--three">
                    <div className="field"><span>{text.series}</span><strong>{episode.series_title}</strong></div>
                    <div className="field"><span>{text.duration}</span><strong>{durationLabel(episode.duration_seconds, locale)}</strong></div>
                    <div className="field"><span>{text.updated}</span><strong>{formatDate(episode.updated_at, locale)}</strong></div>
                  </div>
                </article>
              </div>
            ),
          },
          {
            key: 'production',
            label: text.productionTab,
            content: (
              <div>
                <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 10 }}>{text.currentStage}: <strong style={{ color: 'var(--text)' }}>{statusLabels[locale][episode.status]}</strong></p>
                <div className="progress-rows">
                  {SEQUENCE.map((stage, index) => {
                    const done = stageIndex >= 0 && index <= stageIndex
                    return (
                      <div className="progress-row" key={stage}>
                        <small>{statusLabels[locale][stage]}</small>
                        <div className="track-progress"><span style={{ width: done ? '100%' : '0%', background: done ? 'var(--success)' : undefined }} /></div>
                        <b>{done ? '✓' : '—'}</b>
                      </div>
                    )
                  })}
                </div>
              </div>
            ),
          },
          {
            key: 'media',
            label: text.mediaTab,
            content: (
              <div className="entity-grid">
                <div className="entity-card" style={{ cursor: 'default' }}>
                  <div className="entity-card__media">{episode.thumbnail_url ? <img src={episode.thumbnail_url} alt={text.thumbnail} loading="lazy" /> : <div className="entity-card__media--placeholder"><Icon name="media" size={26} /></div>}</div>
                  <strong>{text.thumbnail}</strong><small>{episode.thumbnail_url ? '—' : text.noThumbnail}</small>
                </div>
                <div className="entity-card" style={{ cursor: 'default' }}>
                  <div className="entity-card__media"><div className="entity-card__media--placeholder"><Icon name="play" size={26} /></div></div>
                  <strong>{text.video}</strong><small>{episode.video_master_url ? '—' : text.noVideo}</small>
                </div>
                <div className="entity-card" style={{ cursor: 'default' }}>
                  <div className="entity-card__media"><div className="entity-card__media--placeholder"><Icon name="reviews" size={26} /></div></div>
                  <strong>{text.captions}</strong><small>{episode.captions_ar_url ? '—' : text.noCaptions}</small>
                </div>
                <div className="entity-card" style={{ cursor: 'default' }}>
                  <div className="entity-card__media"><div className="entity-card__media--placeholder"><Icon name="globe" size={26} /></div></div>
                  <strong>{text.dubs}</strong><small>{episode.dubs?.length ? episode.dubs.join(' · ') : '—'}</small>
                </div>
              </div>
            ),
          },
          {
            key: 'learning',
            label: text.learningTab,
            content: (
              <div className="form-grid" style={{ padding: 4 }}>
                <div className="field"><span>{text.objective}</span><strong>{episode.objective_title || text.noObjective}</strong></div>
                <div className="field"><span>{text.parentGuide}</span><strong>{episode.parent_guide_ar || text.noParentGuide}</strong></div>
              </div>
            ),
          },
          {
            key: 'family',
            label: text.familyTab,
            content: (
              <div className="form-grid" style={{ padding: 4 }}>
                <div className="field"><span>{text.familyActivity}</span><strong>{episode.family_activity_ar || text.noFamilyActivity}</strong></div>
                <div className="form-grid form-grid--three">
                  <div className="field"><span>{text.linkedGame}</span><strong>{episode.linked_game_id ? <Link className="text-link" to={adminPath('library-content')}>{episode.linked_game_id}</Link> : text.none}</strong></div>
                  <div className="field"><span>{text.linkedBook}</span><strong>{episode.linked_book_id ? <Link className="text-link" to={adminPath('stories')}>{episode.linked_book_id}</Link> : text.none}</strong></div>
                </div>
              </div>
            ),
          },
          { key: 'analytics', label: text.analyticsTab, content: <div className="data-unavailable">{text.analyticsUnavailable}</div> },
        ]}
      />
    </div>
  )
}
