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

  return <div className="page-stack"><section className="page-intro"><div><span className="eyebrow">{ar ? 'تنظيم السلسلة' : 'Series structure'}</span><h2>{ar ? 'المواسم' : 'Seasons'}</h2><p>{ar ? 'نظّم الحلقات داخل مواسم وحدد ترتيب المشاهدة وحالة الإنتاج.' : 'Organize episodes into seasons and control watch order and production state.'}</p></div><button className="button button--primary" type="button" onClick={create} disabled={!series.length}><Icon name="plus" size={17}/>{ar ? 'موسم جديد' : 'New season'}</button></section><section className="panel panel--table"><header className="panel__header panel__header--filters"><div><span className="panel__kicker">{ar ? 'كل المواسم' : 'All seasons'}</span><h3>{total}</h3></div><ListToolbar fields={FILTER_FIELDS(ar, series)} values={list.filters} defaults={DEFAULT_FILTERS} onApply={(next) => list.setFilters(next)} onClear={list.clearFilters} onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')} trailing={<SavedViewsMenu storageKey="seasons" currentSearch={list.search} onApply={(search) => navigate(`${adminPath('seasons')}${search}`)}/>}/></header>{loading ? <LoadingState label={ar ? 'جارٍ التحميل...' : 'Loading...'}/> : error && !items.length ? <ErrorState message={error} onRetry={() => void load()}/> : items.length ? <><div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{ar ? 'الموسم' : 'Season'}</th><th>{ar ? 'السلسلة' : 'Series'}</th><th>{ar ? 'الموضوع' : 'Theme'}</th><th>{ar ? 'الحلقات' : 'Episodes'}</th><th>{ar ? 'الترتيب' : 'Order'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th/></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><Link className="entity-cell entity-cell--button" to={adminPath(`seasons/${item.id}`)}><span className="entity-avatar">{item.season_number}</span><div><strong>{item.title_ar || `${ar ? 'الموسم' : 'Season'} ${item.season_number}`}</strong><small>#{item.season_number}</small></div></Link></td><td>{item.series_title}</td><td>{item.theme_ar || '—'}</td><td>{Number(item.episodes_count ?? item.episode_count ?? 0)}</td><td>{item.watch_order === 'sequential' ? (ar ? 'متتابع' : 'Sequential') : (ar ? 'حر' : 'Any')}</td><td><StatusBadge status={item.status}/></td><td><div className="table-actions"><Link className="button button--ghost" to={adminPath(`seasons/${item.id}`)}>{ar ? 'فتح' : 'Open'}</Link><button className="icon-button icon-button--small" type="button" onClick={() => edit(item)}><Icon name="edit" size={15}/></button><button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void archive(item)}><Icon name="archive" size={15}/></button></div></td></tr>)}</tbody></table></div><Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} /></> : <EmptyState title={ar ? 'لا توجد مواسم' : 'No seasons'} description={ar ? 'أنشئ الموسم الأول لإضافة الحلقات داخله.' : 'Create the first season for your episodes.'}/>}</section>
  <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? (ar ? 'تعديل الموسم' : 'Edit season') : (ar ? 'موسم جديد' : 'New season')}><form className="entity-form" onSubmit={submit}><div className="form-grid"><label className="field"><span>{ar ? 'السلسلة *' : 'Series *'}</span><select value={form.series_id} onChange={(event) => setForm({ ...form, series_id: event.target.value })}>{series.map((item) => <option value={item.id} key={item.id}>{item.title_ar}</option>)}</select></label><label className="field"><span>{ar ? 'رقم الموسم *' : 'Season number *'}</span><input type="number" min="1" value={form.season_number} onChange={(event) => setForm({ ...form, season_number: event.target.value })}/></label></div><div className="form-grid"><label className="field"><span>{ar ? 'العنوان' : 'Title'}</span><input value={form.title_ar} onChange={(event) => setForm({ ...form, title_ar: event.target.value })}/></label><label className="field"><span>{ar ? 'الموضوع' : 'Theme'}</span><input value={form.theme_ar} onChange={(event) => setForm({ ...form, theme_ar: event.target.value })}/></label></div><div className="form-grid"><label className="field"><span>{ar ? 'ترتيب المشاهدة' : 'Watch order'}</span><select value={form.watch_order} onChange={(event) => setForm({ ...form, watch_order: event.target.value as Form['watch_order'] })}><option value="any">{ar ? 'حر' : 'Any'}</option><option value="sequential">{ar ? 'متتابع' : 'Sequential'}</option></select></label><label className="field"><span>{ar ? 'الحالة' : 'Status'}</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ContentStatus })}>{statuses.map((status) => <option value={status} key={status}>{statusLabels[locale][status]}</option>)}</select></label></div><label className="field"><span>{ar ? 'الوصف' : 'Description'}</span><textarea rows={4} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })}/></label><div className="form-actions"><button className="button button--ghost" type="button" onClick={() => setOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button><button className="button button--primary" disabled={saving}>{ar ? 'حفظ' : 'Save'}</button></div></form></Modal></div>
}
