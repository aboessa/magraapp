import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { EntityHeader } from '../components/EntityHeader'
import { DetailTabs } from '../components/DetailTabs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge, TrackBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber, trackList } from '../lib/labels'
import type { PlanetDetail } from '../types/api'

const copy = {
  ar: {
    back: 'الكواكب', loading: 'جارٍ تحميل الكوكب...', loadError: 'تعذر تحميل الكوكب', notFound: 'الكوكب غير موجود',
    seriesCount: 'سلسلة', assetsCount: 'أصل', inactive: 'غير نشط', active: 'نشط',
    overview: 'نظرة عامة', seriesTab: 'السلاسل', statsTab: 'الإحصاءات', categoriesTab: 'التصنيفات', mediaTab: 'الوسائط',
    description: 'الوصف', noDescription: 'لا يوجد وصف لهذا الكوكب بعد.',
    identity: 'الهوية', slug: 'المعرّف', color: 'اللون', order: 'ترتيب العرض',
    seriesEmpty: 'لا توجد سلاسل في هذا الكوكب', seriesEmptyDesc: 'أضف سلسلة جديدة واربطها بهذا الكوكب من صفحة السلاسل.',
    episodes: 'حلقة', categoriesEmpty: 'لا توجد تصنيفات مرتبطة بسلاسل هذا الكوكب حاليًا.',
    statsSeries: 'إجمالي السلاسل', statsEpisodes: 'إجمالي الحلقات', statsPublished: 'سلاسل منشورة',
    mediaUnavailable: 'لا يوجد رصيد وسائط تفصيلي (بانرات/معرض) لهذا الكوكب بعد في الخادم — يظهر هنا فقط عدد الأصول المرتبطة إجمالًا.',
    openSeries: 'فتح',
  },
  en: {
    back: 'Planets', loading: 'Loading planet...', loadError: 'Unable to load planet', notFound: 'Planet not found',
    seriesCount: 'series', assetsCount: 'assets', inactive: 'Inactive', active: 'Active',
    overview: 'Overview', seriesTab: 'Series', statsTab: 'Statistics', categoriesTab: 'Categories', mediaTab: 'Media',
    description: 'Description', noDescription: 'No description for this planet yet.',
    identity: 'Identity', slug: 'Slug', color: 'Color', order: 'Sort order',
    seriesEmpty: 'No series in this planet', seriesEmptyDesc: 'Add a new series and link it to this planet from the Series page.',
    episodes: 'episodes', categoriesEmpty: 'No categories currently have series in this planet.',
    statsSeries: 'Total series', statsEpisodes: 'Total episodes', statsPublished: 'Published series',
    mediaUnavailable: 'No detailed media inventory (banners/gallery) exists yet on the server for this planet — only the total linked asset count is shown here.',
    openSeries: 'Open',
  },
}

export function PlanetDetailPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [planet, setPlanet] = useState<PlanetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.planetDetail(id)
      setPlanet(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading && !planet) return <LoadingState label={text.loading} />
  if (error && !planet) return <ErrorState message={error} onRetry={() => void load()} />
  if (!planet) return <EmptyState title={text.notFound} description="" />

  const name = locale === 'en' ? planet.name_en || planet.name_ar : planet.name_ar
  const totalEpisodes = planet.series.reduce((sum, item) => sum + Number(item.episodes_count ?? 0), 0)
  const publishedSeries = planet.series.filter((item) => item.status === 'published').length

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[{ label: text.back, to: adminPath('planets') }, { label: name }]}
        thumbnail={<EntityThumbnail src={planet.cover_url || planet.icon_url} alt={name} label={name} color={planet.color_hex} icon="planets" size={64} />}
        title={name}
        subtitle={planet.description_ar || undefined}
        meta={<>
          <span>{formatNumber(Number(planet.series_count ?? 0), locale)} {text.seriesCount}</span>
          <span>{formatNumber(Number(planet.assets_count ?? 0), locale)} {text.assetsCount}</span>
        </>}
        status={<span className={`status-badge ${planet.is_active === false ? 'status-badge--archived' : 'status-badge--published'}`}>{planet.is_active === false ? text.inactive : text.active}</span>}
        actions={<button className="button button--secondary" type="button" onClick={() => navigate(adminPath('taxonomy'))}><Icon name="edit" size={16} />{locale === 'ar' ? 'تعديل' : 'Edit'}</button>}
      />

      <DetailTabs
        tabs={[
          {
            key: 'overview',
            label: text.overview,
            content: (
              <div className="dashboard-grid dashboard-grid--tracks">
                <article className="panel"><header className="panel__header"><h3>{text.description}</h3></header><div style={{ padding: '0 18px 18px', color: 'var(--text-soft)', fontSize: 11, lineHeight: 1.7 }}>{planet.description_ar || text.noDescription}</div></article>
                <article className="panel"><header className="panel__header"><h3>{text.identity}</h3></header>
                  <div className="entity-form" style={{ padding: '0 18px 18px' }}>
                    <div className="form-grid form-grid--three">
                      <div className="field"><span>{text.slug}</span><strong>{planet.id}</strong></div>
                      <div className="field"><span>{text.color}</span><strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: planet.color_hex, display: 'inline-block' }} />{planet.color_hex}</strong></div>
                      <div className="field"><span>{text.order}</span><strong>{formatNumber(planet.sort_order, locale)}</strong></div>
                    </div>
                  </div>
                </article>
              </div>
            ),
          },
          {
            key: 'series',
            label: text.seriesTab,
            badge: planet.series.length,
            content: planet.series.length ? (
              <div className="entity-grid">
                {planet.series.map((item) => {
                  const title = locale === 'en' ? item.title_en || item.title_ar : item.title_ar
                  return (
                    <Link className="entity-card" to={adminPath(`series/${item.id}`)} key={item.id}>
                      <div className="entity-card__media">
                        {item.cover_url ? <img src={item.cover_url} alt={title} loading="lazy" /> : <div className="entity-card__media--placeholder" style={{ background: planet.color_hex }}><Icon name="series" size={26} /></div>}
                      </div>
                      <strong>{title}</strong>
                      <small>{formatNumber(item.age_min, locale)}–{formatNumber(item.age_max, locale)}</small>
                      <div className="entity-card__meta">
                        {trackList(item.track_ids).map((track) => <TrackBadge track={track} key={track} />)}
                        <span>{formatNumber(Number(item.episodes_count ?? 0), locale)} {text.episodes}</span>
                      </div>
                      <div className="entity-card__footer"><StatusBadge status={item.status} /><Icon name="arrow" size={14} /></div>
                    </Link>
                  )
                })}
              </div>
            ) : <EmptyState title={text.seriesEmpty} description={text.seriesEmptyDesc} action={<Link className="button button--primary" to={adminPath('series')}><Icon name="plus" size={16} />{locale === 'ar' ? 'إضافة سلسلة' : 'Add series'}</Link>} />,
          },
          {
            key: 'stats',
            label: text.statsTab,
            content: (
              <div className="stats-grid">
                <article className="stat-card stat-card--blue"><div className="stat-card__top"><span>{text.statsSeries}</span><span className="stat-card__icon"><Icon name="series" size={21} /></span></div><strong className="stat-card__value">{formatNumber(planet.series.length, locale)}</strong></article>
                <article className="stat-card stat-card--cyan"><div className="stat-card__top"><span>{text.statsEpisodes}</span><span className="stat-card__icon"><Icon name="episodes" size={21} /></span></div><strong className="stat-card__value">{formatNumber(totalEpisodes, locale)}</strong></article>
                <article className="stat-card stat-card--yellow"><div className="stat-card__top"><span>{text.statsPublished}</span><span className="stat-card__icon"><Icon name="analytics" size={21} /></span></div><strong className="stat-card__value">{formatNumber(publishedSeries, locale)}</strong></article>
              </div>
            ),
          },
          {
            key: 'categories',
            label: text.categoriesTab,
            badge: planet.categories.length,
            content: planet.categories.length ? (
              <div className="badge-list" style={{ flexWrap: 'wrap', gap: 8 }}>
                {planet.categories.map((category) => {
                  const catName = locale === 'en' ? category.name_en || category.name_ar : category.name_ar
                  return <span key={category.id} className="track-badge" style={{ background: `color-mix(in srgb, ${category.color_hex} 20%, transparent)`, color: category.color_hex }}>{catName} · {formatNumber(category.series_count, locale)}</span>
                })}
              </div>
            ) : <EmptyState title={text.categoriesEmpty} description="" />,
          },
          {
            key: 'media',
            label: text.mediaTab,
            content: <div className="data-unavailable">{text.mediaUnavailable}</div>,
          },
        ]}
      />
    </div>
  )
}
