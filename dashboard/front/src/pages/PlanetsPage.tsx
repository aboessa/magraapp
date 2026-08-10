import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ViewSwitcher, useStoredViewMode } from '../components/ViewSwitcher'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { Planet } from '../types/api'

/**
 * فهرس الكواكب (DASHBOARD v3 UX-7/UX-8): تجربة تصفّح بصرية بصورة حقيقية عند
 * وجودها، بحث، وفتح كل كوكب في مساحة عمله الكاملة عبر /planets/:id.
 *
 * إدارة إنشاء/تعديل الكواكب والتصنيفات بقيت في TaxonomyPage (صفحة النماذج)،
 * فلا يُكرَّر منطق الحفظ هنا؛ هذه الصفحة مسؤولة عن تجربة الفهرس والتفاصيل.
 */
const copy = {
  ar: {
    eyebrow: 'هيكل المحتوى', title: 'الكواكب', intro: 'كل كوكب هو مجال تنقل مستقل تُبنى عليه السلاسل. افتح كوكبًا لرؤية سلاسله وإحصاءاته كاملة.',
    manage: 'إدارة وإنشاء', search: 'بحث عن كوكب...', loading: 'جارٍ تحميل الكواكب...', loadError: 'تعذر تحميل الكواكب',
    series: 'سلسلة', assets: 'أصل', empty: 'لا توجد كواكب', emptyDesc: 'أنشئ أول كوكب من صفحة الإدارة والإنشاء.',
    inactive: 'غير نشط', catalog: 'الفهرس', all: 'كل الكواكب',
    name: 'الكوكب', seriesCount: 'السلاسل', assetsCount: 'الأصول', status: 'الحالة', open: 'فتح',
  },
  en: {
    eyebrow: 'Content structure', title: 'Planets', intro: 'Each planet is an independent navigation domain that series are built on. Open a planet to see its full series list and stats.',
    manage: 'Manage & create', search: 'Search planets...', loading: 'Loading planets...', loadError: 'Unable to load planets',
    series: 'series', assets: 'assets', empty: 'No planets yet', emptyDesc: 'Create the first planet from the manage & create page.',
    inactive: 'Inactive', catalog: 'Catalog', all: 'All planets',
    name: 'Planet', seriesCount: 'Series', assetsCount: 'Assets', status: 'Status', open: 'Open',
  },
}

export function PlanetsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [items, setItems] = useState<Planet[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useStoredViewMode('planets', 'grid')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.cmsPlanets(true)
      setItems(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  const filtered = items.filter((item) => {
    if (!query.trim()) return true
    const name = locale === 'en' ? item.name_en || item.name_ar : item.name_ar
    return name.toLowerCase().includes(query.trim().toLowerCase())
  })

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.intro}</p></div>
        <Link className="button button--primary" to={adminPath('taxonomy')}><Icon name="plus" size={17} />{text.manage}</Link>
      </section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><span className="panel__kicker">{text.catalog}</span><h3>{text.all} <span className="title-count">{formatNumber(filtered.length, locale)}</span></h3></div>
          <div className="filters-row">
            <label className="search-field"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} /></label>
            <ViewSwitcher value={view} onChange={setView} modes={['grid', 'table']} locale={locale} />
          </div>
        </header>

        {loading && !items.length ? <LoadingState label={text.loading} /> : error && !items.length ? <ErrorState message={error} onRetry={() => void load()} /> : filtered.length ? (
          view === 'grid' ? (
            <div className="entity-grid" style={{ padding: 16 }}>
              {filtered.map((planet) => {
                const name = locale === 'en' ? planet.name_en || planet.name_ar : planet.name_ar
                return (
                  <Link className="entity-card" to={adminPath(`planets/${planet.id}`)} key={planet.id} style={planet.is_active === false ? { opacity: 0.55 } : undefined}>
                    <div className="entity-card__media">
                      {planet.cover_url || planet.icon_url ? (
                        <img src={planet.cover_url || planet.icon_url || ''} alt={name} loading="lazy" />
                      ) : (
                        <div className="entity-card__media--placeholder" style={{ background: planet.color_hex }}><Icon name="planets" size={30} /></div>
                      )}
                    </div>
                    <strong>{name}</strong>
                    <small>{planet.description_ar || '—'}</small>
                    <div className="entity-card__meta">
                      <span>{formatNumber(Number(planet.series_count ?? 0), locale)} {text.series}</span>
                      <span>{formatNumber(Number(planet.assets_count ?? 0), locale)} {text.assets}</span>
                      {planet.is_active === false && <span>{text.inactive}</span>}
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>{text.name}</th><th>{text.seriesCount}</th><th>{text.assetsCount}</th><th>{text.status}</th><th /></tr></thead>
                <tbody>
                  {filtered.map((planet) => {
                    const name = locale === 'en' ? planet.name_en || planet.name_ar : planet.name_ar
                    return (
                      <tr key={planet.id}>
                        <td>
                          <Link className="entity-cell entity-cell--button" to={adminPath(`planets/${planet.id}`)}>
                            <EntityThumbnail src={planet.cover_url || planet.icon_url} alt={name} label={name} color={planet.color_hex} icon="planets" />
                            <div><strong>{name}</strong><small>{planet.id}</small></div>
                          </Link>
                        </td>
                        <td>{formatNumber(Number(planet.series_count ?? 0), locale)}</td>
                        <td>{formatNumber(Number(planet.assets_count ?? 0), locale)}</td>
                        <td>{planet.is_active === false ? <span className="status-badge status-badge--archived">{text.inactive}</span> : '—'}</td>
                        <td><Link className="button button--ghost" to={adminPath(`planets/${planet.id}`)}>{text.open}</Link></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : <EmptyState title={text.empty} description={text.emptyDesc} action={<Link className="button button--primary" to={adminPath('taxonomy')}><Icon name="plus" size={17} />{text.manage}</Link>} />}
      </section>
    </div>
  )
}
