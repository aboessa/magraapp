import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { DetailTabs } from '../components/DetailTabs'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge, TrackBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate, formatNumber, trackList } from '../lib/labels'
import type { SeriesDetail } from '../types/api'

const typeLabels = {
  ar: { continuous: 'مستمرة', anthology: 'منفصلة', knowledge: 'معرفية', presenter: 'تقديمية', standalone: 'مستقلة' },
  en: { continuous: 'Continuous', anthology: 'Anthology', knowledge: 'Knowledge', presenter: 'Presenter-led', standalone: 'Standalone' },
}

const productionLabels = {
  ar: { motion_story: 'قصة متحركة', limited_2d: 'تحريك ثنائي محدود', full_2d: 'تحريك ثنائي كامل', live: 'تصوير حي', stylized_3d: 'ثلاثي أبعاد مُصمَّم' },
  en: { motion_story: 'Motion story', limited_2d: 'Limited 2D', full_2d: 'Full 2D', live: 'Live action', stylized_3d: 'Stylized 3D' },
}

const copy = {
  ar: {
    back: 'السلاسل', loading: 'جارٍ تحميل السلسلة...', loadError: 'تعذر تحميل السلسلة', notFound: 'السلسلة غير موجودة',
    overview: 'نظرة عامة', episodesTab: 'الحلقات', seasonsTab: 'المواسم', charactersTab: 'الشخصيات', mediaTab: 'الوسائط', rightsTab: 'الحقوق والتراخيص', analyticsTab: 'الأداء', historyTab: 'السجل',
    description: 'وصف السلسلة', noDescription: 'لا يوجد وصف لهذه السلسلة بعد.',
    identity: 'الهوية', slug: 'المعرّف', planet: 'الكوكب', type: 'النوع', ageRange: 'المدى العمري', production: 'مستوى الإنتاج', visualStyle: 'الأسلوب البصري', languages: 'اللغات',
    episodesEmpty: 'لا توجد حلقات بعد', episodesEmptyDesc: 'أضف الحلقة الأولى من صفحة الحلقات واربطها بهذه السلسلة.',
    addEpisode: 'إضافة حلقة', season: 'الموسم', unassigned: 'بلا موسم',
    seasonsEmpty: 'لا توجد مواسم بعد', charactersEmpty: 'لا توجد شخصيات مرتبطة بهذه السلسلة بعد',
    mediaTitle: 'الغلاف والشعار والعرض التشويقي', noCover: 'بلا غلاف', noLogo: 'بلا شعار', noTrailer: 'بلا عرض تشويقي', cover: 'الغلاف', banner: 'البانر', logo: 'الشعار', trailer: 'العرض التشويقي',
    rightsOwner: 'المالك', rightsExpiry: 'تاريخ الانتهاء', rightsTerritories: 'الدول', rightsUnavailable: 'لا توجد بيانات حقوق مسجّلة لهذه السلسلة.',
    analyticsUnavailable: 'لا توجد بيانات تحليلات مرتبطة بهذه السلسلة تحديدًا في الخادم بعد — القسم العام للتحليلات يعرض أرقامًا مجمّعة على مستوى المنصّة كلها.',
    historyUnavailable: 'سجل تعديلات مخصّص لهذه السلسلة غير متاح بعد؛ سجل التدقيق العام يسجّل كل عمليات الإدارة.',
    updated: 'آخر تحديث', open: 'فتح', episodesCount: 'حلقة', seasonsCount: 'موسم', free: 'مجانية', premium: 'مميزة',
    religiousTitle: 'المراجعة الشرعية', religiousApproved: 'معتمدة', religiousPending: 'في انتظار الاعتماد الشرعي',
    religiousPendingDesc: 'هذه السلسلة من عالَم الإيمان والآداب ولا يجوز نشرها لأطفال حقيقيين دون مراجع شرعي حقيقي مسجّل هنا. سُجِّلت المراجعة كمعلّقة حتى تتوفر بيانات مراجع حقيقي.',
    reviewer: 'المراجع', approvedAt: 'تاريخ الاعتماد', sourceType: 'المصدر الشرعي', sourceRef: 'المرجع الكامل',
    playEpisode: 'تشغيل', noThumb: 'بلا صورة مصغّرة', published: 'منشورة', notPublished: 'غير منشورة',
  },
  en: {
    back: 'Series', loading: 'Loading series...', loadError: 'Unable to load series', notFound: 'Series not found',
    overview: 'Overview', episodesTab: 'Episodes', seasonsTab: 'Seasons', charactersTab: 'Characters', mediaTab: 'Media', rightsTab: 'Rights & licensing', analyticsTab: 'Performance', historyTab: 'History',
    description: 'Series description', noDescription: 'No description for this series yet.',
    identity: 'Identity', slug: 'Slug', planet: 'Planet', type: 'Type', ageRange: 'Age range', production: 'Production level', visualStyle: 'Visual style', languages: 'Languages',
    episodesEmpty: 'No episodes yet', episodesEmptyDesc: 'Add the first episode from the Episodes page and link it to this series.',
    addEpisode: 'Add episode', season: 'Season', unassigned: 'Unassigned',
    seasonsEmpty: 'No seasons yet', charactersEmpty: 'No characters linked to this series yet',
    mediaTitle: 'Cover, logo and trailer', noCover: 'No cover', noLogo: 'No logo', noTrailer: 'No trailer', cover: 'Cover', banner: 'Banner', logo: 'Logo', trailer: 'Trailer',
    rightsOwner: 'Owner', rightsExpiry: 'Expiry date', rightsTerritories: 'Territories', rightsUnavailable: 'No rights data recorded for this series.',
    analyticsUnavailable: 'No performance data specific to this series exists on the server yet — the global Analytics section shows platform-wide aggregates.',
    historyUnavailable: 'A dedicated change history for this series is not available yet; the global audit log records every admin action.',
    updated: 'Last updated', open: 'Open', episodesCount: 'episodes', seasonsCount: 'seasons', free: 'Free', premium: 'Premium',
    religiousTitle: 'Religious review', religiousApproved: 'Approved', religiousPending: 'Awaiting religious approval',
    religiousPendingDesc: 'This series belongs to the Faith & Manners world and must not be shown to real children without a real religious reviewer recorded here. Review is marked pending until reviewer details exist.',
    reviewer: 'Reviewer', approvedAt: 'Approved on', sourceType: 'Religious source', sourceRef: 'Full reference',
    playEpisode: 'Play', noThumb: 'No thumbnail', published: 'Published', notPublished: 'Not published',
  },
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function SeriesDetailPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const { id = '' } = useParams()
  const [series, setSeries] = useState<SeriesDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.seriesDetail(id)
      setSeries(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading && !series) return <LoadingState label={text.loading} />
  if (error && !series) return <ErrorState message={error} onRetry={() => void load()} />
  if (!series) return <EmptyState title={text.notFound} description="" />

  const title = locale === 'en' ? series.title_en || series.title_ar : series.title_ar
  const rights = series as unknown as {
    rights_owner?: string | null; rights_expiry?: string | null; rights_territories?: string | null
    source_type?: string | null; source_reference?: string | null
    verse_surah?: number | null; verse_ayah?: number | null
    hadith_collection?: string | null; hadith_number?: string | null; hadith_grade?: string | null
    religious_reviewer_id?: string | null; religious_reviewer_version?: number | null; religious_approved_at?: string | null
    visual_restrictions?: string | null
  }
  const isFaithWorld = series.planet_id === 'islamic' || series.planet_id === 'iman'
  const religiousApproved = Boolean(rights.religious_reviewer_id && rights.religious_approved_at)

  const episodesBySeason = new Map<string, typeof series.episodes>()
  for (const episode of series.episodes) {
    const key = episode.season_id || 'unassigned'
    if (!episodesBySeason.has(key)) episodesBySeason.set(key, [])
    episodesBySeason.get(key)!.push(episode)
  }

  const publishedEpisodes = series.episodes.filter((e) => e.is_published).length

  return (
    <div className="page-stack series-detail">
      <Breadcrumbs items={[
        { label: text.back, to: adminPath('series') },
        ...(series.planet_name ? [{ label: series.planet_name }] : []),
        { label: title },
      ]} />

      {/* Cinematic hero: banner as backdrop, poster as key art, identity + actions on top. */}
      <section
        className="series-hero"
        style={series.banner_url ? { backgroundImage: `linear-gradient(90deg, var(--page) 8%, rgba(10,10,10,0.35) 55%, rgba(10,10,10,0.05) 100%), url(${series.banner_url})` } : undefined}
      >
        <div className="series-hero__row">
          <div className="series-hero__poster">
            <EntityThumbnail src={series.cover_url} alt={title} label={title} color={series.planet_color} icon="series" size={128} shape="square" />
          </div>
          <div className="series-hero__identity">
            <div className="series-hero__title-row">
              <h2>{title}</h2>
              <StatusBadge status={series.status} />
            </div>
            {series.title_en && locale === 'ar' && <p className="series-hero__subtitle-en">{series.title_en}</p>}
            <div className="series-hero__meta">
              {trackList(series.track_ids).map((track) => <TrackBadge track={track} key={track} />)}
              <span className="series-hero__chip">{typeLabels[locale][series.type]}</span>
              <span className="series-hero__chip">{formatNumber(series.age_min, locale)}–{formatNumber(series.age_max, locale)}</span>
              <span className="series-hero__chip">{formatNumber(Number(series.episodes_count ?? series.episodes.length), locale)} {text.episodesCount}</span>
              {series.seasons.length > 0 && <span className="series-hero__chip">{formatNumber(series.seasons.length, locale)} {text.seasonsCount}</span>}
              <span className={`series-hero__chip series-hero__chip--${series.is_free ? 'free' : 'premium'}`}>{series.is_free ? text.free : text.premium}</span>
            </div>
            {series.description_ar && <p className="series-hero__description">{series.description_ar}</p>}
          </div>
          <div className="series-hero__actions">
            <Link className="button button--secondary" to={adminPath(`series?q=${encodeURIComponent(title)}`)}><Icon name="edit" size={16} />{locale === 'ar' ? 'تعديل' : 'Edit'}</Link>
          </div>
        </div>
      </section>

      {isFaithWorld && (
        <section className={`religious-review-banner ${religiousApproved ? 'religious-review-banner--approved' : 'religious-review-banner--pending'}`}>
          <Icon name={religiousApproved ? 'check' : 'warning'} size={20} />
          <div>
            <strong>{text.religiousTitle}: {religiousApproved ? text.religiousApproved : text.religiousPending}</strong>
            {!religiousApproved && <p>{text.religiousPendingDesc}</p>}
            {religiousApproved && (
              <p>
                {text.reviewer}: {rights.religious_reviewer_id} · {text.approvedAt}: {formatDate(rights.religious_approved_at!, locale)}
              </p>
            )}
          </div>
        </section>
      )}

      <DetailTabs
        tabs={[
          {
            key: 'overview',
            label: text.overview,
            content: (
              <div className="dashboard-grid dashboard-grid--tracks">
                <article className="panel"><header className="panel__header"><h3>{text.description}</h3></header><div style={{ padding: '0 18px 18px', color: 'var(--text-soft)', fontSize: 11, lineHeight: 1.7 }}>{series.description_ar || text.noDescription}</div></article>
                <article className="panel"><header className="panel__header"><h3>{text.identity}</h3></header>
                  <div style={{ padding: '0 18px 18px' }} className="form-grid form-grid--three">
                    <div className="field"><span>{text.slug}</span><strong>{series.slug}</strong></div>
                    <div className="field"><span>{text.planet}</span><strong>{series.planet_name || '—'}</strong></div>
                    <div className="field"><span>{text.ageRange}</span><strong>{formatNumber(series.age_min, locale)}–{formatNumber(series.age_max, locale)}</strong></div>
                    <div className="field"><span>{text.production}</span><strong>{productionLabels[locale][series.production_level]}</strong></div>
                    <div className="field"><span>{text.visualStyle}</span><strong>{series.visual_style || '—'}</strong></div>
                    <div className="field"><span>{text.updated}</span><strong>{formatDate(series.updated_at, locale)}</strong></div>
                    {isFaithWorld && (
                      <>
                        <div className="field"><span>{text.sourceType}</span><strong>{rights.source_type ?? '—'}</strong></div>
                        <div className="field"><span>{text.sourceRef}</span><strong>{rights.source_reference ?? '—'}</strong></div>
                        {rights.source_type === 'quran' && (
                          <>
                            <div className="field"><span>السورة</span><strong>{rights.verse_surah ?? '—'}</strong></div>
                            <div className="field"><span>الآية</span><strong>{rights.verse_ayah ?? '—'}</strong></div>
                          </>
                        )}
                        {rights.source_type === 'hadith' && (
                          <>
                            <div className="field"><span>مصدر الحديث</span><strong>{rights.hadith_collection ?? '—'}</strong></div>
                            <div className="field"><span>رقم الحديث</span><strong>{rights.hadith_number ?? '—'}</strong></div>
                            <div className="field"><span>درجة الحديث</span><strong>{rights.hadith_grade ?? '—'}</strong></div>
                          </>
                        )}
                        <div className="field"><span>{text.reviewer}</span><strong>{rights.religious_reviewer_id ?? '—'}</strong></div>
                        <div className="field"><span>نسخة المراجعة</span><strong>{rights.religious_reviewer_version ?? '—'}</strong></div>
                        <div className="field"><span>{text.approvedAt}</span><strong>{rights.religious_approved_at ? formatDate(rights.religious_approved_at, locale) : '—'}</strong></div>
                        <div className="field" style={{ gridColumn: '1 / -1' }}><span>القيود البصرية</span><strong style={{ wordBreak: 'break-all' }}>{rights.visual_restrictions ?? '—'}</strong></div>
                      </>
                    )}
                  </div>
                </article>
              </div>
            ),
          },
          {
            key: 'episodes',
            label: text.episodesTab,
            badge: series.episodes.length,
            content: series.episodes.length ? (
              <>
                <div className="episodes-progress-note">
                  {formatNumber(publishedEpisodes, locale)} / {formatNumber(series.episodes.length, locale)} {locale === 'ar' ? 'منشورة' : 'published'}
                </div>
                <div className="entity-grid">
                  {series.episodes.map((episode) => (
                    <Link className="entity-card episode-card" to={adminPath(`episodes/${episode.id}`)} key={episode.id}>
                      <div className="entity-card__media">
                        {episode.thumbnail_url ? (
                          <img src={episode.thumbnail_url} alt={episode.title_ar} loading="lazy" />
                        ) : (
                          <div className="entity-card__media--placeholder" style={{ background: series.planet_color || 'var(--primary)' }}><Icon name="play" size={26} /></div>
                        )}
                        {episode.duration_seconds ? <span className="episode-card__duration">{formatDuration(episode.duration_seconds)}</span> : null}
                        <span className={`episode-card__publish-dot ${episode.is_published ? 'episode-card__publish-dot--on' : ''}`} title={episode.is_published ? text.published : text.notPublished} />
                      </div>
                      <strong>{episode.episode_number ? `${locale === 'ar' ? 'الحلقة' : 'Ep.'} ${episode.episode_number} — ` : ''}{episode.title_ar}</strong>
                      <small>{episode.season_id ? text.season : text.unassigned}</small>
                      <div className="entity-card__footer"><StatusBadge status={episode.status} /><Icon name="arrow" size={14} /></div>
                    </Link>
                  ))}
                </div>
              </>
            ) : <EmptyState title={text.episodesEmpty} description={text.episodesEmptyDesc} action={<Link className="button button--primary" to={adminPath('episodes')}><Icon name="plus" size={16} />{text.addEpisode}</Link>} />,
          },
          {
            key: 'seasons',
            label: text.seasonsTab,
            badge: series.seasons.length,
            content: series.seasons.length ? (
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table">
                  <thead><tr><th>{text.season}</th><th>{text.episodesTab}</th><th /></tr></thead>
                  <tbody>
                    {series.seasons.map((season) => (
                      <tr key={season.id}>
                        <td><div className="entity-cell"><span className="entity-avatar">{formatNumber(season.season_number, locale)}</span><div><strong>{season.title_ar || `${text.season} ${season.season_number}`}</strong><small>{season.theme_ar || '—'}</small></div></div></td>
                        <td>{formatNumber((episodesBySeason.get(season.id) ?? []).length, locale)}</td>
                        <td><Link className="button button--ghost" to={adminPath(`seasons/${season.id}`)}>{text.open}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title={text.seasonsEmpty} description="" />,
          },
          {
            key: 'characters',
            label: text.charactersTab,
            badge: series.characters.length,
            content: series.characters.length ? (
              <div className="entity-grid">
                {series.characters.map((character) => (
                  <div className="entity-card" key={character.id} style={{ cursor: 'default' }}>
                    <div className="entity-card__media">
                      {character.reference_images?.[0] ? <img src={character.reference_images[0]} alt={character.name_ar} loading="lazy" /> : <div className="entity-card__media--placeholder"><Icon name="characters" size={26} /></div>}
                    </div>
                    <strong>{character.name_ar}</strong>
                    <small>{character.role || '—'}</small>
                  </div>
                ))}
              </div>
            ) : <EmptyState title={text.charactersEmpty} description="" />,
          },
          {
            key: 'media',
            label: text.mediaTab,
            content: (
              <div className="entity-grid">
                <div className="entity-card" style={{ cursor: 'default' }}>
                  <div className="entity-card__media">{series.cover_url ? <img src={series.cover_url} alt={text.cover} loading="lazy" /> : <div className="entity-card__media--placeholder"><Icon name="media" size={26} /></div>}</div>
                  <strong>{text.cover}</strong><small>{series.cover_url ? '—' : text.noCover}</small>
                </div>
                <div className="entity-card" style={{ cursor: 'default' }}>
                  <div className="entity-card__media">{series.banner_url ? <img src={series.banner_url} alt={text.banner} loading="lazy" /> : <div className="entity-card__media--placeholder"><Icon name="media" size={26} /></div>}</div>
                  <strong>{text.banner}</strong><small>{series.banner_url ? '—' : text.noCover}</small>
                </div>
                <div className="entity-card" style={{ cursor: 'default' }}>
                  <div className="entity-card__media">{series.logo_url ? <img src={series.logo_url} alt={text.logo} loading="lazy" /> : <div className="entity-card__media--placeholder"><Icon name="media" size={26} /></div>}</div>
                  <strong>{text.logo}</strong><small>{series.logo_url ? '—' : text.noLogo}</small>
                </div>
                <div className="entity-card" style={{ cursor: 'default' }}>
                  <div className="entity-card__media"><div className="entity-card__media--placeholder"><Icon name="play" size={26} /></div></div>
                  <strong>{text.trailer}</strong><small>{series.trailer_url ? '—' : text.noTrailer}</small>
                </div>
              </div>
            ),
          },
          {
            key: 'rights',
            label: text.rightsTab,
            content: (
              <>
                {rights.rights_owner ? (
                  <div className="form-grid form-grid--three" style={{ padding: 4 }}>
                    <div className="field"><span>{text.rightsOwner}</span><strong>{rights.rights_owner}</strong></div>
                    <div className="field"><span>{text.rightsExpiry}</span><strong>{rights.rights_expiry ? formatDate(rights.rights_expiry, locale) : '—'}</strong></div>
                    <div className="field"><span>{text.rightsTerritories}</span><strong>{rights.rights_territories || '—'}</strong></div>
                  </div>
                ) : <div className="data-unavailable">{text.rightsUnavailable}</div>}
                {/* الحقوق المسجّلة أعلاه هي نصّ العقد؛ الإتاحة أدناه هي ما يُفرَض
                    فعليًا على الكتالوج والتشغيل. الفصل مقصود: العقد لا يُنفِّذ
                    نفسه، وهذا بالضبط ما كان ناقصًا. */}
                <AvailabilityPanel scope="series" entityId={id ?? ''} />
              </>
            ),
          },
          { key: 'analytics', label: text.analyticsTab, content: <div className="data-unavailable">{text.analyticsUnavailable}</div> },
          { key: 'history', label: text.historyTab, content: <div style={{ display:'grid', gap:12 }}><div className="data-unavailable">{text.historyUnavailable}</div><Link className="button button--secondary button--small" to={`${adminPath('audit-logs')}?entity_type=series&entity_id=${encodeURIComponent(id)}`}><Icon name="clock" size={14}/> سجل التدقيق لهذه السلسلة →</Link></div> },
        ]}
      />
    </div>
  )
}
