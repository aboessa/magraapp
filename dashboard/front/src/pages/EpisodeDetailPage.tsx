import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate, formatNumber, statusLabels } from '../lib/labels'
import type { ContentStatus, EpisodeRecord } from '../types/api'

const SEQUENCE: ContentStatus[] = [
  'draft',
  'writing',
  'review_edu',
  'review_lang',
  'review_sharia',
  'production',
  'qa',
  'ready',
  'scheduled',
  'published',
]

const copy = {
  ar: {
    back: 'الحلقات',
    loading: 'جارٍ تحميل الحلقة...',
    loadError: 'تعذر تحميل الحلقة',
    notFound: 'الحلقة غير موجودة',
    overview: 'نظرة عامة والقصة',
    mediaTab: 'الوسائط والفيديو',
    learningTab: 'الأهداف والدليل التربوي',
    familyTab: 'الأنشطة العائلية',
    productionTab: 'مراحل الإنتاج والنشر',
    availabilityTab: 'الإتاحة والدول',
    description: 'ملخص سيناريو الحلقة',
    noDescription: 'لا يوجد ملخص مسجل لهذه الحلقة بعد.',
    identity: 'بيانات الحلقة',
    series: 'السلسلة التابعة',
    duration: 'المدة الزمنية',
    ageRange: 'الفئة العمرية',
    updated: 'آخر تحديث',
    episodeNumber: 'رقم الحلقة',
    video: 'ملف الفيديو الرئيسي',
    thumbnail: 'الصورة المصغرة (Thumbnail)',
    captions: 'الترجمة المصاحبة (Subtitles)',
    dubs: 'المسارات الصوتية (Dubs)',
    noVideo: 'لم يُرفع فيديو بعد',
    noThumbnail: 'بلا صورة مصغّرة',
    noCaptions: 'بلا ترجمة مصاحبة',
    objective: 'الهدف التعليمي الأساسي',
    noObjective: 'لا يوجد هدف تعليمي مسجل.',
    parentGuide: 'دليل ولي الأمر والمناقشة',
    noParentGuide: 'لا يوجد دليل لولي الأمر.',
    familyActivity: 'النشاط العائلي التطبيقي',
    noFamilyActivity: 'لا يوجد نشاط عائلي مسجّل.',
    linkedGame: 'لعبة تفاعلية مرتبطة',
    linkedBook: 'كتاب مصور مرتبط',
    none: 'بلا ارتباط',
    currentStage: 'المرحلة الإنتاجية الحالية',
  },
  en: {
    back: 'Episodes',
    loading: 'Loading episode...',
    loadError: 'Unable to load episode',
    notFound: 'Episode not found',
    overview: 'Overview & Story',
    mediaTab: 'Media & Video',
    learningTab: 'Pedagogy & Guide',
    familyTab: 'Family Activities',
    productionTab: 'Production Pipeline',
    availabilityTab: 'Availability & Territories',
    description: 'Episode Synopsis',
    noDescription: 'No synopsis recorded yet.',
    identity: 'Identity',
    series: 'Parent Series',
    duration: 'Duration',
    ageRange: 'Age Range',
    updated: 'Last Updated',
    episodeNumber: 'Episode #',
    video: 'Master Video File',
    thumbnail: 'Thumbnail',
    captions: 'Closed Captions',
    dubs: 'Audio Dubs',
    noVideo: 'No video uploaded',
    noThumbnail: 'No thumbnail',
    noCaptions: 'No captions',
    objective: 'Core Learning Objective',
    noObjective: 'No learning objective linked.',
    parentGuide: 'Parent Discussion Guide',
    noParentGuide: 'No parent guide yet.',
    familyActivity: 'Family Activity',
    noFamilyActivity: 'No family activity recorded.',
    linkedGame: 'Linked Game',
    linkedBook: 'Linked Book',
    none: 'None',
    currentStage: 'Current Stage',
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
  const ar = locale === 'ar'
  const text = copy[locale]
  const { id = '' } = useParams()
  const [episode, setEpisode] = useState<EpisodeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'media' | 'production' | 'learning' | 'availability'>('overview')

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

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !episode) return <LoadingState label={text.loading} />
  if (error && !episode) return <ErrorState message={error} onRetry={() => void load()} />
  if (!episode) return <EmptyState title={text.notFound} description="" />

  const stageIndex = SEQUENCE.indexOf(episode.status)

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('episodes')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{text.back}</span>
          </Link>
          <span className="live-status-pulse" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {episode.thumbnail_url ? (
              <img
                src={episode.thumbnail_url}
                alt={episode.title_ar}
                style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }}
              />
            ) : (
              <span
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 8,
                  background: 'var(--surface-sunken)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <Icon name="play" size={24} />
              </span>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 className="admin-page-title" style={{ margin: 0 }}>
                  {episode.title_ar}
                </h1>
                <StatusBadge status={episode.status} />
              </div>
              <p className="admin-page-subtitle" style={{ margin: 0 }}>
                <Link to={adminPath(`series/${episode.series_id}`)} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  {episode.series_title}
                </Link>{' '}
                {episode.episode_number != null ? `· ${text.episodeNumber} ${formatNumber(episode.episode_number, locale)}` : ''}{' '}
                · {durationLabel(episode.duration_seconds, locale)} · {formatNumber(episode.age_min, locale)}–{formatNumber(episode.age_max, locale)} {ar ? 'سنوات' : 'yrs'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link className="button button--secondary button--small" to={adminPath(`episodes?q=${encodeURIComponent(episode.title_ar)}`)}>
            <Icon name="edit" size={14} />
            <span>{ar ? 'تعديل' : 'Edit'}</span>
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
            <span className="bento-glass-card__title">{text.episodeNumber}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">
            {episode.episode_number != null ? `#${episode.episode_number}` : '—'}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{episode.series_title}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{text.duration}</span>
            <div className="bento-glass-card__icon"><Icon name="clock" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">
            {durationLabel(episode.duration_seconds, locale)}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{episode.duration_seconds || 0} {ar ? 'ثانية' : 'sec'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{text.ageRange}</span>
            <div className="bento-glass-card__icon"><Icon name="children" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">
            {episode.age_min}–{episode.age_max}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'سنوات مناسبة' : 'target age'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{text.currentStage}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>
            {statusLabels[locale][episode.status]}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">
              {stageIndex >= 0 ? `${stageIndex + 1}/${SEQUENCE.length} ${ar ? 'مكتمل' : 'steps'}` : 'In progress'}
            </span>
          </div>
        </article>
      </section>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, overflowX: 'auto' }}>
        <button className={`button ${tab === 'overview' ? 'button--primary' : 'button--ghost'} button--small`} onClick={() => setTab('overview')}>
          {text.overview}
        </button>
        <button className={`button ${tab === 'media' ? 'button--primary' : 'button--ghost'} button--small`} onClick={() => setTab('media')}>
          {text.mediaTab}
        </button>
        <button className={`button ${tab === 'production' ? 'button--primary' : 'button--ghost'} button--small`} onClick={() => setTab('production')}>
          {text.productionTab}
        </button>
        <button className={`button ${tab === 'learning' ? 'button--primary' : 'button--ghost'} button--small`} onClick={() => setTab('learning')}>
          {text.learningTab}
        </button>
        <button className={`button ${tab === 'availability' ? 'button--primary' : 'button--ghost'} button--small`} onClick={() => setTab('availability')}>
          {text.availabilityTab}
        </button>
      </div>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'overview' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="file-text" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.description}</h3>
              </div>
              <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, lineHeight: 1.6, marginBottom: 18 }}>
                {episode.description_ar || text.noDescription}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="grid" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.identity}</h3>
              </div>
              <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
                <div><dt>{text.series}</dt><dd><strong>{episode.series_title}</strong></dd></div>
                <div><dt>{text.duration}</dt><dd>{durationLabel(episode.duration_seconds, locale)}</dd></div>
                <div><dt>{text.updated}</dt><dd>{formatDate(episode.updated_at, locale)}</dd></div>
              </dl>
            </div>
          )}

          {tab === 'media' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Icon name="play" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.mediaTab}</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Icon name="play" size={16} />
                    <strong style={{ fontSize: 13 }}>{text.video}</strong>
                  </div>
                  {episode.video_master_url ? (
                    <video src={episode.video_master_url} controls style={{ width: '100%', borderRadius: 6, maxHeight: 180 }} />
                  ) : (
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>{text.noVideo}</p>
                  )}
                </div>

                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Icon name="eye" size={16} />
                    <strong style={{ fontSize: 13 }}>{text.thumbnail}</strong>
                  </div>
                  {episode.thumbnail_url ? (
                    <img src={episode.thumbnail_url} alt="" style={{ width: '100%', borderRadius: 6, maxHeight: 180, objectFit: 'cover' }} />
                  ) : (
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>{text.noThumbnail}</p>
                  )}
                </div>

                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Icon name="text" size={16} />
                    <strong style={{ fontSize: 13 }}>{text.captions}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: episode.captions_ar_url ? 'var(--text)' : 'var(--muted)' }}>
                    {episode.captions_ar_url ? 'VTT / Arabic Synced' : text.noCaptions}
                  </p>
                </div>

                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Icon name="globe" size={16} />
                    <strong style={{ fontSize: 13 }}>{text.dubs}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 12 }}>
                    {episode.dubs?.length ? episode.dubs.join(' · ') : 'Arabic (Original)'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'production' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Icon name="shield" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.productionTab}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SEQUENCE.map((stage, index) => {
                  const done = stageIndex >= 0 && index <= stageIndex
                  const isCurrent = stage === episode.status
                  return (
                    <div
                      key={stage}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: isCurrent ? 'var(--primary-subtle, rgba(99, 102, 241, 0.1))' : 'var(--surface-sunken)',
                        borderRadius: 8,
                        border: isCurrent ? '1px solid var(--primary)' : '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            background: done ? 'var(--color-success, #10b981)' : 'var(--border)',
                            color: '#fff',
                          }}
                        >
                          {done ? '✓' : index + 1}
                        </span>
                        <strong style={{ fontSize: 13 }}>{statusLabels[locale][stage]}</strong>
                      </div>
                      <span className={`status-badge status-badge--${done ? 'published' : 'draft'}`}>
                        {done ? (isCurrent ? 'Current' : 'Completed') : 'Pending'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'learning' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="star" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.learningTab}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>{text.objective}</h4>
                  <p style={{ margin: 0, fontSize: 13, color: episode.objective_title ? 'inherit' : 'var(--muted)' }}>
                    {episode.objective_title || text.noObjective}
                  </p>
                </div>
                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>{text.parentGuide}</h4>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: episode.parent_guide_ar ? 'inherit' : 'var(--muted)' }}>
                    {episode.parent_guide_ar || text.noParentGuide}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'availability' && (
            <div className="panel" style={{ padding: 20 }}>
              <AvailabilityPanel scope="episode" entityId={episode.id} />
            </div>
          )}
        </div>

        {/* Sticky Episode Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Linked Media & Cross-Media */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="link" size={16} />
              <span>{ar ? 'الارتباطات المتقاطعة' : 'Cross-Media Links'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--muted)' }}>{text.linkedGame}:</span>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{episode.linked_game_id || text.none}</div>
              </div>
              <div>
                <span style={{ color: 'var(--muted)' }}>{text.linkedBook}:</span>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{episode.linked_book_id || text.none}</div>
              </div>
            </div>
          </div>

          {/* Publishing Readiness */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="analytics" size={16} />
              <span>{ar ? 'اكتمال خط الإنتاج' : 'Pipeline Progress'}</span>
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span>{stageIndex >= 0 ? `${stageIndex + 1} / ${SEQUENCE.length}` : '0%'}</span>
              <strong style={{ color: 'var(--color-success, #10b981)' }}>
                {stageIndex >= 0 ? Math.round(((stageIndex + 1) / SEQUENCE.length) * 100) : 0}%
              </strong>
            </div>
            <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${stageIndex >= 0 ? Math.round(((stageIndex + 1) / SEQUENCE.length) * 100) : 0}%`,
                  height: '100%',
                  background: 'var(--color-success, #10b981)',
                }}
              />
            </div>
          </div>

          {/* AI Episode Copilot */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار الحلقة الذكي' : 'Episode Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {episode.status === 'published'
                ? (ar ? 'الحلقة منشورة في التطبيق وجاهزة للبث مع تفعيل التحقق الأبوي.' : 'Episode is live in production stream with active parent guardrails.')
                : (ar ? 'تأكد من مطابقة ملف الفيديو لجودة HLS ورفع الترجمة المصاحبة قبل الاعتماد النهائي.' : 'Verify HLS streaming bitrate and closed-captions sync before final publication approval.')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
