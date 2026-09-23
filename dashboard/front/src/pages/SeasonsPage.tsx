import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Pagination } from '../components/Pagination'
import { useUrlListState } from '../hooks/useUrlListState'
import { statusLabels } from '../lib/labels'
import type { ContentStatus, SeasonRecord, SeriesRecord } from '../types/api'

const statuses: ContentStatus[] = ['draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published']
type Form = { series_id: string; season_number: string; title_ar: string; theme_ar: string; description_ar: string; watch_order: 'sequential' | 'any'; status: ContentStatus }
const initial: Form = { series_id: '', season_number: '1', title_ar: '', theme_ar: '', description_ar: '', watch_order: 'any', status: 'draft' }

/// مفتاح الفلتر هو اسم معامل الاستعلام الذي يقبله `GET /admin/seasons` بالحرف
/// (`series_id`، وإلى جانبه `limit` و`offset` في
/// `api/src/routes/adminContent.ts`). الترقيم غير موصول هنا لأن
/// `api.seasons(seriesId?)` في `lib/api.ts` لا يقبل إلا معرّف السلسلة، وتوسيعه
/// يعني تعديل ملف غير مملوك في هذه الدفعة.
const DEFAULT_FILTERS = { series_id: '' }

/// حقل الدرج بيانات لا JSX: القائمة السابقة كانت `<select>` بلا تسمية.
const FILTER_FIELDS = (ar: boolean, series: SeriesRecord[]): FilterField[] => [
  {
    key: 'series_id',
    label: ar ? 'السلسلة' : 'Series',
    type: 'select',
    options: [
      { value: '', label: ar ? 'كل السلاسل' : 'All series' },
      ...series.map((item) => ({ value: item.id, label: item.title_ar })),
    ],
  },
]

/**
 * The episode counts for one season.
 *
 * Shows what exists, not what was planned. The column used to render
 * `episode_count`, which is an editorial planning figure, so a season holding
 * zero episodes displayed "8" — the defect behind CONTENT-003.
 *
 * The planning figure is still shown when it exceeds reality, because that gap
 * is the operator's actual work item. It is labelled as a plan and never as a
 * count.
 */
function SeasonCountCell({ season, ar }: { season: SeasonRecord; ar: boolean }) {
  const total = Number(season.total_episodes ?? 0)
  const published = Number(season.published_episodes ?? 0)
  const planned = Number(season.planned_episode_count ?? 0)
  const missing = planned - total
  return (
    <div>
      <strong>{total}</strong>
      <small className="table-secondary" style={{ display: 'block' }}>
        {published} {ar ? 'منشورة' : 'published'}
      </small>
      {missing > 0 && (
        <small
          style={{ display: 'block', color: 'var(--danger, #b91c1c)' }}
          title={ar
            ? 'الرقم المخطط أكبر من الحلقات الموجودة فعلًا'
            : 'The planned figure exceeds the episodes that actually exist'}
        >
          {ar
            ? `الخطة ${planned} — ناقص ${missing}`
            : `Planned ${planned} — ${missing} missing`}
        </small>
      )}
    </div>
  )
}

export function SeasonsPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const navigate = useNavigate()
  // حالة القائمة في العنوان لا في الذاكرة: «مواسم هذه السلسلة» رابط قابل
  // للمشاركة، وزرّ الرجوع من صفحة موسم يُعيد نفس التصفية.
  const list = useUrlListState(DEFAULT_FILTERS, { limit: 50 })
  const { series_id: filter } = list.filters
  const { limit, offset } = list
  const [items, setItems] = useState<SeasonRecord[]>([])
  const [series, setSeries] = useState<SeriesRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SeasonRecord | null>(null)
  const [form, setForm] = useState<Form>(initial)
  const [saving, setSaving] = useState(false)

  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    // الترقيم يُرسَل الآن: الخادم يقبله وكان العميل يُغفله، فما بعد صفحته
    // الافتراضية لم يكن قابلًا للوصول.
    try { const [seasons, seriesResponse] = await Promise.all([api.seasons({ series_id: filter || undefined, limit, offset }), api.series({ status: 'all', limit: 100 })]); setItems(seasons.data); setTotal(seasons.meta.total); setSeries(seriesResponse.data.filter((item) => item.status !== 'archived')) }
    catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل المواسم' : 'Unable to load seasons') }
    finally { setLoading(false) }
  }, [ar, filter, limit, offset])
  useEffect(() => { void load() }, [load])

  function create() { setEditing(null); const existing = items.filter((item) => item.series_id === (filter || series[0]?.id)); setForm({ ...initial, series_id: filter || series[0]?.id || '', season_number: String(existing.length + 1) }); setOpen(true) }
  function edit(item: SeasonRecord) { setEditing(item); setForm({ series_id: item.series_id, season_number: String(item.season_number), title_ar: item.title_ar ?? '', theme_ar: item.theme_ar ?? '', description_ar: item.description_ar ?? '', watch_order: item.watch_order, status: item.status }); setOpen(true) }
  async function submit(event: FormEvent) { event.preventDefault(); if (!form.series_id || Number(form.season_number) < 1) return; setSaving(true); const payload = { ...form, season_number: Number(form.season_number) }; try { if (editing) await api.updateSeason(editing.id, payload); else await api.createSeason(payload); setOpen(false); await load() } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر الحفظ' : 'Unable to save') } finally { setSaving(false) } }
  async function archive(item: SeasonRecord) { if (!window.confirm(ar ? 'أرشفة الموسم؟' : 'Archive season?')) return; await api.archiveSeason(item.id); await load() }

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  const totalEpisodesInSeasons = items.reduce((sum, item) => sum + Number(item.total_episodes || 0), 0)

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{ar ? 'تنظيم السلسلة' : 'Series structure'}</span>
          <h2>{ar ? 'المواسم' : 'Seasons'}</h2>
          <p>{ar ? 'نظّم الحلقات داخل مواسم وحدد ترتيب المشاهدة وحالة الإنتاج.' : 'Organize episodes into seasons and control watch order and production state.'}</p>
        </div>
        <button className="button button--primary" type="button" onClick={create} disabled={!series.length}>
          <Icon name="plus" size={17}/>
          {ar ? 'موسم جديد' : 'New season'}
        </button>
      </section>

      {/* Hero KPIs */}
      <section className="hero-kpis" aria-label="Seasons KPIs">
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{ar ? 'إجمالي المواسم' : 'Total seasons'}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="clock" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{total}</div>
          <div className="kpi-glass-card__caption">{ar ? 'موسم مسجل' : 'Registered seasons'}</div>
        </div>
        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{statusLabels[locale].published}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="check" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{items.filter(i => i.status === 'published').length}</div>
          <div className="kpi-glass-card__caption">{ar ? 'مواسم معتمدة' : 'Live seasons'}</div>
        </div>
        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{ar ? 'إجمالي الحلقات' : 'Episodes in seasons'}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="media" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{totalEpisodesInSeasons}</div>
          <div className="kpi-glass-card__caption">{ar ? 'حلقة تابعة' : 'Linked episodes'}</div>
        </div>
        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{ar ? 'السلاسل' : 'Series'}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="series" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{series.length}</div>
          <div className="kpi-glass-card__caption">{ar ? 'سلسلة نشطة' : 'Active series'}</div>
        </div>
      </section>

      {/* Control Strip */}
      <section className="catalog-control-strip">
        <div className="catalog-control-strip__left">
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
            {ar ? 'تصفية واستعراض المواسم' : 'Browse & Filter Seasons'}
          </span>
        </div>
        <div className="catalog-control-strip__right">
          <div className="view-mode-toggle" aria-label="View mode">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'grid' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
              title={ar ? 'عرض بطاقات' : 'Grid view'}
            >
              <Icon name="grid" size={15} />
              <span>{ar ? 'بطاقات' : 'Cards'}</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'table' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setViewMode('table')}
              title={ar ? 'عرض جدول' : 'Table view'}
            >
              <Icon name="bars" size={15} />
              <span>{ar ? 'جدول' : 'Table'}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><span className="panel__kicker">{ar ? 'كل المواسم' : 'All seasons'}</span><h3>{total}</h3></div>
          <ListToolbar fields={FILTER_FIELDS(ar, series)} values={list.filters} defaults={DEFAULT_FILTERS} onApply={(next) => list.setFilters(next)} onClear={list.clearFilters} onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')} trailing={<SavedViewsMenu storageKey="seasons" currentSearch={list.search} onApply={(search) => navigate(`${adminPath('seasons')}${search}`)}/>}/>
        </header>

        {loading ? <LoadingState label={ar ? 'جارٍ التحميل...' : 'Loading...'}/> : error && !items.length ? <ErrorState message={error} onRetry={() => void load()}/> : items.length ? (
          <>
            {viewMode === 'grid' ? (
              /* SEASONS STUDIO GRID */
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {items.map((item) => {
                    const totalEps = Number(item.total_episodes || 0)
                    const publishedEps = Number(item.published_episodes || 0)
                    const plannedEps = Number(item.planned_episode_count || 0)
                    const progress = plannedEps > 0 ? Math.min(100, Math.round((totalEps / plannedEps) * 100)) : 100
                    return (
                      <article className="series-studio-card" key={item.id} style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '16px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
                              #{item.season_number}
                            </div>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
                                <Link to={adminPath(`seasons/${item.id}`)} style={{ color: 'inherit', textDecoration: 'none' }}>
                                  {item.title_ar || `${ar ? 'الموسم' : 'Season'} ${item.season_number}`}
                                </Link>
                              </h3>
                              <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>{item.series_title}</span>
                            </div>
                          </div>
                          <StatusBadge status={item.status}/>
                        </div>

                        {item.theme_ar && (
                          <div style={{ margin: '8px 0', fontSize: '12px', color: 'var(--muted)', background: 'var(--surface-2)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--cs-glass-border)' }}>
                            <strong>{ar ? 'الموضوع: ' : 'Theme: '}</strong>{item.theme_ar}
                          </div>
                        )}

                        {/* Episodes Progress Bar */}
                        <div style={{ margin: '12px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--muted)', marginBottom: '4px' }}>
                            <span>{ar ? 'اكتمال الحلقات' : 'Episodes progress'}</span>
                            <span>{publishedEps} / {totalEps} {ar ? 'منشورة' : 'published'}</span>
                          </div>
                          <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #10b981)', borderRadius: '4px' }} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--muted)' }}>
                          <span className="series-tag">
                            {item.watch_order === 'sequential' ? (ar ? '👁️ متتابع' : 'Sequential') : (ar ? '🎲 حر' : 'Any')}
                          </span>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid var(--cs-glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Link to={adminPath(`seasons/${item.id}`)} style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>{ar ? 'مساحة الموسم' : 'Workspace'}</span>
                            <Icon name="arrow" size={13} />
                          </Link>
                          <div className="table-actions">
                            <button className="icon-button icon-button--small" type="button" onClick={() => edit(item)} title={ar ? 'تعديل' : 'Edit'}>
                              <Icon name="edit" size={15}/>
                            </button>
                            <button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void archive(item)} title={ar ? 'أرشفة' : 'Archive'}>
                              <Icon name="archive" size={15}/>
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* DENSE TABLE VIEW */
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{ar ? 'الموسم' : 'Season'}</th>
                      <th>{ar ? 'السلسلة' : 'Series'}</th>
                      <th>{ar ? 'الموضوع' : 'Theme'}</th>
                      <th>{ar ? 'الحلقات' : 'Episodes'}</th>
                      <th>{ar ? 'الترتيب' : 'Order'}</th>
                      <th>{ar ? 'الحالة' : 'Status'}</th>
                      <th/>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link className="entity-cell entity-cell--button" to={adminPath(`seasons/${item.id}`)}>
                            <span className="entity-avatar">{item.season_number}</span>
                            <div><strong>{item.title_ar || `${ar ? 'الموسم' : 'Season'} ${item.season_number}`}</strong><small>#{item.season_number}</small></div>
                          </Link>
                        </td>
                        <td>{item.series_title}</td>
                        <td>{item.theme_ar || '—'}</td>
                        <td><SeasonCountCell season={item} ar={ar}/></td>
                        <td>{item.watch_order === 'sequential' ? (ar ? 'متتابع' : 'Sequential') : (ar ? 'حر' : 'Any')}</td>
                        <td><StatusBadge status={item.status}/></td>
                        <td>
                          <div className="table-actions">
                            <Link className="button button--ghost" to={adminPath(`seasons/${item.id}`)}>{ar ? 'فتح' : 'Open'}</Link>
                            <button className="icon-button icon-button--small" type="button" onClick={() => edit(item)}><Icon name="edit" size={15}/></button>
                            <button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void archive(item)}><Icon name="archive" size={15}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </>
        ) : <EmptyState title={ar ? 'لا توجد مواسم' : 'No seasons'} description={ar ? 'أنشئ الموسم الأول لإضافة الحلقات داخله.' : 'Create the first season for your episodes.'}/>}
      </section>

      <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? (ar ? 'تعديل الموسم' : 'Edit season') : (ar ? 'موسم جديد' : 'New season')}>
        <form className="entity-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field"><span>{ar ? 'السلسلة *' : 'Series *'}</span><select value={form.series_id} onChange={(event) => setForm({ ...form, series_id: event.target.value })}>{series.map((item) => <option value={item.id} key={item.id}>{item.title_ar}</option>)}</select></label>
            <label className="field"><span>{ar ? 'رقم الموسم *' : 'Season number *'}</span><input type="number" min="1" value={form.season_number} onChange={(event) => setForm({ ...form, season_number: event.target.value })}/></label>
          </div>
          <div className="form-grid">
            <label className="field"><span>{ar ? 'العنوان' : 'Title'}</span><input value={form.title_ar} onChange={(event) => setForm({ ...form, title_ar: event.target.value })}/></label>
            <label className="field"><span>{ar ? 'الموضوع' : 'Theme'}</span><input value={form.theme_ar} onChange={(event) => setForm({ ...form, theme_ar: event.target.value })}/></label>
          </div>
          <div className="form-grid">
            <label className="field"><span>{ar ? 'ترتيب المشاهدة' : 'Watch order'}</span><select value={form.watch_order} onChange={(event) => setForm({ ...form, watch_order: event.target.value as Form['watch_order'] })}><option value="any">{ar ? 'حر' : 'Any'}</option><option value="sequential">{ar ? 'متتابع' : 'Sequential'}</option></select></label>
            <label className="field"><span>{ar ? 'الحالة' : 'Status'}</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ContentStatus })}>{statuses.map((status) => <option value={status} key={status}>{statusLabels[locale][status]}</option>)}</select></label>
          </div>
          <label className="field"><span>{ar ? 'الوصف' : 'Description'}</span><textarea rows={4} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })}/></label>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button>
            <button className="button button--primary" disabled={saving}>{ar ? 'حفظ' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
