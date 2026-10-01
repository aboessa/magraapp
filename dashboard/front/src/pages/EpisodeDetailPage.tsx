import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api, episodePlaybackUrl } from '../lib/api'
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
    mediaTab: 'الوسائط والفيديو وتوقيتات البث',
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
    mediaTab: 'Media, Video & Streaming',
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

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streaming, setStreaming] = useState<{
    intro_start_ms: number | null
    intro_end_ms: number | null
    recap_start_ms: number | null
    recap_end_ms: number | null
    credits_start_ms: number | null
  }>({
    intro_start_ms: null,
    intro_end_ms: null,
    recap_start_ms: null,
    recap_end_ms: null,
    credits_start_ms: null,
  })
  const [subtitleTracks, setSubtitleTracks] = useState<Array<{ id: string; language: string; label: string; format: string; is_default: number }>>([])
  const [audioTracks, setAudioTracks] = useState<Array<{ id: string; language: string; label: string; is_default: number }>>([])
  const [savingTimestamps, setSavingTimestamps] = useState(false)
  const [timestampNotice, setTimestampNotice] = useState('')
  const [newSubLang, setNewSubLang] = useState('ar')
  const [newSubLabel, setNewSubLabel] = useState('')
  const [newSubFormat, setNewSubFormat] = useState('vtt')
  const [uploadingSub, setUploadingSub] = useState(false)

  const loadStreaming = useCallback(async () => {
    try {
      const res = await api.episodeStreaming(id)
      if (res.data?.episode) {
        setStreaming({
          intro_start_ms: res.data.episode.intro_start_ms,
          intro_end_ms: res.data.episode.intro_end_ms,
          recap_start_ms: res.data.episode.recap_start_ms,
          recap_end_ms: res.data.episode.recap_end_ms,
          credits_start_ms: res.data.episode.credits_start_ms,
        })
      }
      if (res.data?.subtitle_tracks) {
        setSubtitleTracks(res.data.subtitle_tracks)
      }
      if (res.data?.audio_tracks) {
        setAudioTracks(res.data.audio_tracks)
      }
    } catch {
      // streaming might not exist yet
    }
  }, [id])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.episodeDetail(id)
      setEpisode(response.data)
      void loadStreaming()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError, loadStreaming])

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Master Video & Direct Frame Tools */}
              <div className="panel" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="play" size={18} />
                    <h3 style={{ margin: 0, fontSize: 16 }}>{text.video}</h3>
                  </div>
                  {timestampNotice && (
                    <span style={{ fontSize: 12, color: 'var(--color-success, #10b981)', fontWeight: 600 }}>
                      ✓ {timestampNotice}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(240px, 1fr)', gap: 16, alignItems: 'start' }}>
                  <div style={{ background: '#000', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {(() => {
                      const videoSrc = episodePlaybackUrl(episode)
                      return videoSrc ? (
                        <video
                          ref={videoRef}
                          src={videoSrc}
                          controls
                          crossOrigin="anonymous"
                          preload="metadata"
                          style={{ width: '100%', maxHeight: 320, objectFit: 'contain' }}
                        />
                      ) : (
                        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                          <Icon name="play" size={36} />
                          <p style={{ marginTop: 8, fontSize: 13 }}>{text.noVideo}</p>
                        </div>
                      )
                    })()}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                        {ar ? 'أزرار مساعدة لالتقاط التوقيت' : 'Quick Capture from Playback'}
                      </strong>
                      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 10px' }}>
                        {ar ? 'شغّل الفيديو إلى اللحظة المطلوبة ثم اضغط لتعبئة الحقل تلقائياً:' : 'Play video to desired frame and click to populate timestamp:'}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button
                          type="button"
                          className="button button--secondary button--small"
                          onClick={() => {
                            if (videoRef.current) {
                              const sec = Math.floor(videoRef.current.currentTime)
                              setStreaming(prev => ({ ...prev, intro_start_ms: sec * 1000 }))
                            }
                          }}
                        >
                          {ar ? 'تعيين بداية المقدمة (Intro Start)' : 'Set Intro Start'}
                        </button>
                        <button
                          type="button"
                          className="button button--secondary button--small"
                          onClick={() => {
                            if (videoRef.current) {
                              const sec = Math.floor(videoRef.current.currentTime)
                              setStreaming(prev => ({ ...prev, intro_end_ms: sec * 1000 }))
                            }
                          }}
                        >
                          {ar ? 'تعيين نهاية المقدمة (Intro End)' : 'Set Intro End'}
                        </button>
                        <button
                          type="button"
                          className="button button--secondary button--small"
                          onClick={() => {
                            if (videoRef.current) {
                              const sec = Math.floor(videoRef.current.currentTime)
                              setStreaming(prev => ({ ...prev, credits_start_ms: sec * 1000 }))
                            }
                          }}
                        >
                          {ar ? 'تعيين بداية شارة النهاية (Credits Start)' : 'Set Credits Start'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--surface-sunken)', borderRadius: 8 }}>
                      {episode.thumbnail_url ? (
                        <img src={episode.thumbnail_url} alt="" style={{ width: 64, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 64, height: 48, borderRadius: 6, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="eye" size={18} />
                        </div>
                      )}
                      <div>
                        <strong style={{ fontSize: 12, display: 'block' }}>{text.thumbnail}</strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {episode.thumbnail_url ? (ar ? 'صورة مفعلة' : 'Set') : text.noThumbnail}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Streaming Timestamps Editor */}
              <div className="panel" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="clock" size={18} />
                    <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'توقيتات البث والتخطي الذكي' : 'Streaming Timestamps & Skip Markers'}</h3>
                  </div>
                  <button
                    type="button"
                    className="button button--primary button--small"
                    disabled={savingTimestamps}
                    onClick={async () => {
                      setSavingTimestamps(true)
                      setTimestampNotice('')
                      try {
                        await api.updateEpisodeStreaming(episode.id, streaming)
                        setTimestampNotice(ar ? 'تم حفظ التوقيتات بنجاح' : 'Timestamps saved')
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Failed to save')
                      } finally {
                        setSavingTimestamps(false)
                      }
                    }}
                  >
                    {savingTimestamps ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ التوقيتات' : 'Save Timestamps')}
                  </button>
                </div>

                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {ar
                    ? 'تتيح هذه التوقيتات لتطبيق الأطفال إظهار زر "تخطي شارة البداية" وتشغيل الحلقة التالية تلقائياً عند بدء شارة النهاية.'
                    : 'These markers enable the Skip Intro button and trigger the Next Episode countdown before credits.'}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  <label className="field">
                    <span className="field__label">{ar ? 'بداية المقدمة (ثانية)' : 'Intro Start (sec)'}</span>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      value={streaming.intro_start_ms != null ? streaming.intro_start_ms / 1000 : ''}
                      placeholder="0"
                      onChange={e => {
                        const val = e.target.value === '' ? null : Math.max(0, Number(e.target.value))
                        setStreaming(prev => ({ ...prev, intro_start_ms: val != null ? Math.round(val * 1000) : null }))
                      }}
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">{ar ? 'نهاية المقدمة (ثانية)' : 'Intro End (sec)'}</span>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      value={streaming.intro_end_ms != null ? streaming.intro_end_ms / 1000 : ''}
                      placeholder="e.g. 45"
                      onChange={e => {
                        const val = e.target.value === '' ? null : Math.max(0, Number(e.target.value))
                        setStreaming(prev => ({ ...prev, intro_end_ms: val != null ? Math.round(val * 1000) : null }))
                      }}
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">{ar ? 'بداية التلخيص (ثانية)' : 'Recap Start (sec)'}</span>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      value={streaming.recap_start_ms != null ? streaming.recap_start_ms / 1000 : ''}
                      placeholder="0"
                      onChange={e => {
                        const val = e.target.value === '' ? null : Math.max(0, Number(e.target.value))
                        setStreaming(prev => ({ ...prev, recap_start_ms: val != null ? Math.round(val * 1000) : null }))
                      }}
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">{ar ? 'نهاية التلخيص (ثانية)' : 'Recap End (sec)'}</span>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      value={streaming.recap_end_ms != null ? streaming.recap_end_ms / 1000 : ''}
                      placeholder="e.g. 30"
                      onChange={e => {
                        const val = e.target.value === '' ? null : Math.max(0, Number(e.target.value))
                        setStreaming(prev => ({ ...prev, recap_end_ms: val != null ? Math.round(val * 1000) : null }))
                      }}
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">{ar ? 'بداية شارة النهاية (ثانية)' : 'Credits Start (sec)'}</span>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      value={streaming.credits_start_ms != null ? streaming.credits_start_ms / 1000 : ''}
                      placeholder="e.g. 680"
                      onChange={e => {
                        const val = e.target.value === '' ? null : Math.max(0, Number(e.target.value))
                        setStreaming(prev => ({ ...prev, credits_start_ms: val != null ? Math.round(val * 1000) : null }))
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Subtitles & Captions Manager */}
              <div className="panel" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Icon name="text" size={18} />
                  <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'مسارات الترجمة المصاحبة (Subtitles)' : 'Subtitle & Caption Tracks'}</h3>
                </div>

                {subtitleTracks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                    {subtitleTracks.map(sub => (
                      <div
                        key={sub.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'var(--surface-sunken)',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            {sub.language}
                          </span>
                          <strong style={{ fontSize: 13 }}>{sub.label}</strong>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>({sub.format.toUpperCase()})</span>
                          {sub.is_default === 1 && (
                            <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{ar ? 'افتراضي' : 'Default'}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          style={{ color: 'var(--color-danger, #ef4444)' }}
                          onClick={async () => {
                            if (!confirm(ar ? 'هل أنت متأكد من حذف مسار الترجمة هذا؟' : 'Delete this subtitle track?')) return
                            try {
                              await api.deleteEpisodeSubtitleTrack(episode.id, sub.id)
                              await loadStreaming()
                            } catch (err) {
                              alert(err instanceof Error ? err.message : 'Error')
                            }
                          }}
                        >
                          <Icon name="trash" size={14} />
                          <span>{ar ? 'حذف' : 'Delete'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 13 }}>
                    {ar ? 'لا توجد مسارات ترجمة مصاحبة مسجلة لهذه الحلقة.' : 'No subtitle tracks configured yet.'}
                  </p>
                )}

                {/* Direct Upload New Subtitle Track */}
                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px dashed var(--border)' }}>
                  <strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                    {ar ? 'رفع مسار ترجمة جديد (WebVTT / SRT)' : 'Upload New Subtitle Track'}
                  </strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, alignItems: 'end' }}>
                    <label className="field">
                      <span className="field__label">{ar ? 'اللغة' : 'Language'}</span>
                      <select className="input" value={newSubLang} onChange={e => setNewSubLang(e.target.value)}>
                        <option value="ar">العربية (ar)</option>
                        <option value="en">English (en)</option>
                        <option value="fr">Français (fr)</option>
                      </select>
                    </label>

                    <label className="field">
                      <span className="field__label">{ar ? 'الصيغة' : 'Format'}</span>
                      <select className="input" value={newSubFormat} onChange={e => setNewSubFormat(e.target.value)}>
                        <option value="vtt">WebVTT (.vtt)</option>
                        <option value="srt">SubRip (.srt)</option>
                      </select>
                    </label>

                    <label className="field">
                      <span className="field__label">{ar ? 'التسمية' : 'Label'}</span>
                      <input
                        type="text"
                        className="input"
                        placeholder={newSubLang === 'ar' ? 'العربية' : 'English CC'}
                        value={newSubLabel}
                        onChange={e => setNewSubLabel(e.target.value)}
                      />
                    </label>

                    <div>
                      <label className={`button button--secondary button--small ${uploadingSub ? 'is-loading' : ''}`} style={{ width: '100%', cursor: 'pointer', textAlign: 'center' }}>
                        <Icon name="upload" size={14} />
                        <span>{uploadingSub ? (ar ? 'جارٍ الرفع...' : 'Uploading...') : (ar ? 'اختر ملف الترجمة' : 'Choose File')}</span>
                        <input
                          type="file"
                          accept=".vtt,.srt"
                          style={{ display: 'none' }}
                          disabled={uploadingSub}
                          onChange={async e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setUploadingSub(true)
                            try {
                              const assetRes = await api.createAsset({
                                kind: 'subtitle',
                                title: `${episode.title_ar} Subtitle (${newSubLang})`,
                                language: newSubLang,
                              })
                              const assetId = assetRes.data.id
                              await api.uploadAssetFile(assetId, file)
                              await api.createEpisodeSubtitleTrack(episode.id, {
                                language: newSubLang,
                                asset_id: assetId,
                                label: newSubLabel.trim() || (newSubLang === 'ar' ? 'العربية' : newSubLang === 'en' ? 'English' : 'Français'),
                                format: newSubFormat,
                                is_default: subtitleTracks.length === 0,
                              })
                              await loadStreaming()
                              setNewSubLabel('')
                            } catch (err) {
                              alert(err instanceof Error ? err.message : 'Upload failed')
                            } finally {
                              setUploadingSub(false)
                              e.target.value = ''
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio Dubs Manager */}
              <div className="panel" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Icon name="globe" size={18} />
                  <h3 style={{ margin: 0, fontSize: 16 }}>{text.dubs}</h3>
                </div>
                {audioTracks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {audioTracks.map(audio => (
                      <div
                        key={audio.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'var(--surface-sunken)',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            {audio.language}
                          </span>
                          <strong style={{ fontSize: 13 }}>{audio.label}</strong>
                          {audio.is_default === 1 && (
                            <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{ar ? 'المسار الافتراضي' : 'Default'}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                    {episode.dubs?.length ? episode.dubs.join(' · ') : (ar ? 'اللغة العربية (المسار الصوتي الأصلي مدمج في الفيديو)' : 'Arabic (Original master audio)')}
                  </p>
                )}
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
