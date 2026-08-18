import { Link } from 'react-router-dom'
import { EmptyState } from '../PageState'
import { Icon } from '../Icon'
import { StatusBadge } from '../StatusBadge'
import { formatDate, formatNumber, planLabels, trackLabels } from '../../lib/labels'
import { adminPath } from '../../lib/adminPath'
import type { DashboardStats } from '../../types/api'

export function ContentHealthPanels({ data, locale }: { data: DashboardStats; locale: 'ar'|'en' }) {
  const t = locale==='ar'
    ? { launchCoverage:'تغطية الإطلاق', byTrack:'السلاسل حسب المسار', total:'الإجمالي', seriesUnit:'سلاسل',
        workflow:'سير الإنتاج', seriesStatuses:'حالات السلاسل', noStatuses:'لا توجد حالات بعد', noStatusesDesc:'ستظهر مراحل الإنتاج عند إضافة السلاسل.',
        latestUpdate:'آخر تحديث', recentSeries:'السلاسل الأخيرة', viewAll:'عرض الكل', series:'السلسلة', planet:'الكوكب', age:'العمر', episodeCount:'الحلقات', status:'الحالة',
        noSeries:'لا توجد سلاسل', noSeriesDesc:'ابدأ بإضافة أول سلسلة إلى كتالوج المحتوى.', addSeries:'إضافة سلسلة',
        audit:'سجل الإدارة', latestActivity:'آخر النشاطات', noActivity:'لا يوجد نشاط مسجل', noActivityDesc:'ستظهر هنا عمليات الإنشاء والتعديل والأرشفة الفعلية.',
        create:'إضافة', archive:'أرشفة', update:'تحديث', seriesEntity:'سلسلة', episodeEntity:'حلقة', childEntity:'ملف طفل', families:'العائلات', accountsByPlan:'الحسابات حسب الباقة', admin:'admin', percent:'٪' }
    : { launchCoverage:'Launch coverage', byTrack:'Series by age track', total:'Total', seriesUnit:'series',
        workflow:'Production workflow', seriesStatuses:'Series statuses', noStatuses:'No statuses yet', noStatusesDesc:'Production stages will appear after series are added.',
        latestUpdate:'Latest update', recentSeries:'Recent series', viewAll:'View all', series:'Series', planet:'Planet', age:'Age', episodeCount:'Episodes', status:'Status',
        noSeries:'No series', noSeriesDesc:'Start by adding the first series to the content catalog.', addSeries:'Add series',
        audit:'Admin audit', latestActivity:'Recent activity', noActivity:'No recorded activity', noActivityDesc:'Actual create, update, and archive operations will appear here.',
        create:'Created', archive:'Archived', update:'Updated', seriesEntity:'series', episodeEntity:'episode', childEntity:'child profile',
        families:'Families', accountsByPlan:'Accounts by plan', admin:'admin', percent:'%' }

  const trackTotal = Object.values(data.series_by_track).reduce((sum, count) => sum + Number(count), 0)
  const actionLabel = (action: string) => action === 'create' ? t.create : action === 'archive' ? t.archive : t.update
  const entityLabel = (entity: string) => entity === 'series' ? t.seriesEntity : entity === 'episode' ? t.episodeEntity : t.childEntity

  return (
    <>
      <section className="dashboard-grid dashboard-grid--tracks">
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{t.launchCoverage}</span><h3>{t.byTrack}</h3></div><span className="data-note">{t.total} {formatNumber(trackTotal, locale)}</span></header>
          <div className="track-distribution">
            {(['preschool', 'kids', 'junior'] as const).map((track) => {
              const count = Number(data.series_by_track[track] ?? 0)
              const percentage = trackTotal ? Math.round((count / trackTotal) * 100) : 0
              return <div className={`track-row track-row--${track}`} key={track}><div className="track-row__label"><span className="track-dot"/><div><strong>{trackLabels[locale][track]}</strong><small>{formatNumber(count, locale)} {t.seriesUnit}</small></div></div><div className="track-progress"><span style={{ width: `${percentage}%` }} /></div><b>{formatNumber(percentage, locale)}{t.percent}</b></div>
            })}
          </div>
        </article>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{t.workflow}</span><h3>{t.seriesStatuses}</h3></div></header>
          {data.series_by_status.length ? <div className="status-summary">{data.series_by_status.map((row) => row.status && <div key={row.status}><StatusBadge status={row.status} /><strong>{formatNumber(Number(row.count), locale)}</strong></div>)}</div> : <EmptyState title={t.noStatuses} description={t.noStatusesDesc} />}
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--activity">
        <article className="panel panel--table">
          <header className="panel__header"><div><span className="panel__kicker">{t.latestUpdate}</span><h3>{t.recentSeries}</h3></div><Link className="text-link" to={adminPath('series')}>{t.viewAll} <Icon name="arrow" size={15} /></Link></header>
          {data.recent_series.length ? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{t.series}</th><th>{t.planet}</th><th>{t.age}</th><th>{t.episodeCount}</th><th>{t.status}</th></tr></thead><tbody>{data.recent_series.map((series) => { const title = locale === 'en' ? series.title_en || series.title_ar : series.title_ar; return <tr key={series.id}><td><div className="entity-cell"><span className="entity-avatar" style={{ background: series.planet_color || undefined }}>{title.charAt(0)}</span><div><strong>{title}</strong><small>{series.slug}</small></div></div></td><td>{series.planet_name || '—'}</td><td>{formatNumber(series.age_min, locale)}–{formatNumber(series.age_max, locale)}</td><td>{formatNumber(Number(series.episodes_count ?? 0), locale)}</td><td><StatusBadge status={series.status} /></td></tr> })}</tbody></table></div> : <EmptyState title={t.noSeries} description={t.noSeriesDesc} action={<Link className="button button--primary" to={adminPath('series')}><Icon name="plus" size={17} />{t.addSeries}</Link>} />}
        </article>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{t.audit}</span><h3>{t.latestActivity}</h3></div></header>
          {data.recent_activity.length ? <div className="activity-list">{data.recent_activity.map((item) => <div className="activity-item" key={item.id}><span className="activity-item__icon"><Icon name={item.action === 'create' ? 'plus' : item.action === 'archive' ? 'archive' : 'edit'} size={17} /></span><div><strong>{actionLabel(item.action)} {entityLabel(item.entity_type)}</strong><small>{item.actor_id || t.admin} • {formatDate(item.created_at, locale, true)}</small></div></div>)}</div> : <EmptyState title={t.noActivity} description={t.noActivityDesc} />}
        </article>
      </section>

      {data.parents_by_plan.length > 0 && <section className="panel compact-panel"><header className="panel__header"><div><span className="panel__kicker">{t.families}</span><h3>{t.accountsByPlan}</h3></div></header><div className="plan-chips">{data.parents_by_plan.map((row) => row.plan && <span key={row.plan}><b>{formatNumber(Number(row.count), locale)}</b>{planLabels[locale][row.plan]}</span>)}</div></section>}
    </>
  )
}
