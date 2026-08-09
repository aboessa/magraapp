import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { EntityHeader } from '../components/EntityHeader'
import { DetailTabs } from '../components/DetailTabs'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge, TrackBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate, formatNumber } from '../lib/labels'
import type { SeriesDetail } from '../types/api'

const typeLabels = {
  ar: { continuous: 'مستمرة', anthology: 'منفصلة', knowledge: 'معرفية', presenter: 'تقديمية', standalone: 'مستقلة' },
  en: { continuous: 'Continuous', anthology: 'Anthology', knowledge: 'Knowledge', presenter: 'Presenter-led', standalone: 'Standalone' },
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
    mediaTitle: 'الغلاف والشعار والعرض التشويقي', noCover: 'بلا غلاف', noLogo: 'بلا شعار', noTrailer: 'بلا عرض تشويقي', cover: 'الغلاف', logo: 'الشعار', trailer: 'العرض التشويقي',
    rightsOwner: 'المالك', rightsExpiry: 'تاريخ الانتهاء', rightsTerritories: 'الدول', rightsUnavailable: 'لا توجد بيانات حقوق مسجّلة لهذه السلسلة.',
    analyticsUnavailable: 'لا توجد بيانات تحليلات مرتبطة بهذه السلسلة تحديدًا في الخادم بعد — القسم العام للتحليلات يعرض أرقامًا مجمّعة على مستوى المنصّة كلها.',
    historyUnavailable: 'سجل تعديلات مخصّص لهذه السلسلة غير متاح بعد؛ سجل التدقيق العام يسجّل كل عمليات الإدارة.',
    updated: 'آخر تحديث', open: 'فتح',
  },
  en: {
    back: 'Series', loading: 'Loading series...', loadError: 'Unable to load series', notFound: 'Series not found',
    overview: 'Overview', episodesTab: 'Episodes', seasonsTab: 'Seasons', charactersTab: 'Characters', mediaTab: 'Media', rightsTab: 'Rights & licensing', analyticsTab: 'Performance', historyTab: 'History',
    description: 'Series description', noDescription: 'No description for this series yet.',
    identity: 'Identity', slug: 'Slug', planet: 'Planet', type: 'Type', ageRange: 'Age range', production: 'Production level', visualStyle: 'Visual style', languages: 'Languages',
    episodesEmpty: 'No episodes yet', episodesEmptyDesc: 'Add the first episode from the Episodes page and link it to this series.',
    addEpisode: 'Add episode', season: 'Season', unassigned: 'Unassigned',
    seasonsEmpty: 'No seasons yet', charactersEmpty: 'No characters linked to this series yet',
    mediaTitle: 'Cover, logo and trailer', noCover: 'No cover', noLogo: 'No logo', noTrailer: 'No trailer', cover: 'Cover', logo: 'Logo', trailer: 'Trailer',
    rightsOwner: 'Owner', rightsExpiry: 'Expiry date', rightsTerritories: 'Territories', rightsUnavailable: 'No rights data recorded for this series.',
    analyticsUnavailable: 'No performance data specific to this series exists on the server yet — the global Analytics section shows platform-wide aggregates.',
    historyUnavailable: 'A dedicated change history for this series is not available yet; the global audit log records every admin action.',
    updated: 'Last updated', open: 'Open',
  },
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
  const rights = series as unknown as { rights_owner?: string | null; rights_expiry?: string | null; rights_territories?: string | null }

  const episodesBySeason = new Map<string, typeof series.episodes>()
  for (const episode of series.episodes) {
    const key = episode.season_id || 'unassigned'
    if (!episodesBySeason.has(key)) episodesBySeason.set(key, [])
    episodesBySeason.get(key)!.push(episode)
  }

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[
          { label: text.back, to: adminPath('series') },
          ...(series.planet_name ? [{ label: series.planet_name }] : []),
          { label: title },
        ]}
        thumbnail={<EntityThumbnail src={series.cover_url} alt={title} label={title} color={series.planet_color} icon="series" size={64} />}
        title={title}
        subtitle={series.description_ar || undefined}
        meta={<>
          {series.track_ids.map((track) => <TrackBadge track={track} key={track} />)}
          <span>{typeLabels[locale][series.type]}</span>
          <span>{formatNumber(Number(series.episodes_count ?? series.episodes.length), locale)} {text.episodesTab}</span>
        </>}
        status={<StatusBadge status={series.status} />}
        actions={<Link className="button button--secondary" to={adminPath(`series?q=${encodeURIComponent(title)}`)}><Icon name="edit" size={16} />{locale === 'ar' ? 'تعديل' : 'Edit'}</Link>}
      />

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
                    <div className="field"><span>{text.production}</span><strong>{series.production_level}</strong></div>
                    <div className="field"><span>{text.visualStyle}</span><strong>{series.visual_style || '—'}</strong></div>
                    <div className="field"><span>{text.updated}</span><strong>{formatDate(series.updated_at, locale)}</strong></div>
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
              <div className="entity-grid">
                {series.episodes.map((episode) => (
                  <Link className="entity-card" to={adminPath(`episodes/${episode.id}`)} key={episode.id}>
                    <div className="entity-card__media">
                      {episode.thumbnail_url ? <img src={episode.thumbnail_url} alt={episode.title_ar} loading="lazy" /> : <div className="entity-card__media--placeholder" style={{ background: series.planet_color || 'var(--primary)' }}><Icon name="play" size={26} /></div>}
                    </div>
                    <strong>{episode.episode_number ? `${locale === 'ar' ? 'الحلقة' : 'Ep.'} ${episode.episode_number} — ` : ''}{episode.title_ar}</strong>
                    <small>{episode.season_id ? text.season : text.unassigned}</small>
                    <div className="entity-card__footer"><StatusBadge status={episode.status} /><Icon name="arrow" size={14} /></div>
                  </Link>
                ))}
              </div>
            ) : <EmptyState title={text.episodesEmpty} description={text.episodesEmptyDesc} action={<Link className="button button--primary" to={adminPath('episodes')}><Icon name="plus" size={16} />{text.addEpisode}</Link>} />,
          },
          {
            key: 'seasons',
            label: text.seasonsTab,
            badge: series.seasons.length,
            content: series.seasons.length ? (
              <div className="table-scroll">
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
          { key: 'history', label: text.historyTab, content: <div className="data-unavailable">{text.historyUnavailable}</div> },
        ]}
      />
    </div>
  )
}
