import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { ContentStatus, EpisodePayload, EpisodeRecord, SeriesRecord } from '../types/api'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { PublishReadinessDialog } from '../components/PublishReadinessDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { Pagination } from '../components/Pagination'
import { StatusBadge, TrackBadge } from '../components/StatusBadge'
import { formatNumber, localeCode, statusLabels } from '../lib/labels'
import { adminPath } from '../lib/adminPath'
import { useQuickCreate } from '../hooks/useQuickCreate'
import { usePreferences } from '../context/preferences'

const editableStatuses: ContentStatus[] = ['draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled']
const filterStatuses: ContentStatus[] = [...editableStatuses, 'published']

const copy = {
  ar: {
    loadError: 'تعذر تحميل الحلقات', required: 'اسم الحلقة والسلسلة مطلوبان.', saveError: 'تعذر حفظ الحلقة', statusError: 'تعذر تحديث الحالة', archiveError: 'تعذر أرشفة الحلقة',
    confirmArchive: (title: string) => `هل تريد أرشفة حلقة «${title}»؟`, level: 'المستوى الخامس', headline: 'الحلقات والوحدات التعليمية', intro: 'كل حلقة مرتبطة بسلسلة ومسار، ويمكن إسناد هدف ونشاط عائلي لها.',
    newEpisode: 'حلقة جديدة', needsSeries: 'أضف سلسلة أولًا قبل إنشاء الحلقات.', library: 'مكتبة الحلقات', allEpisodes: 'كل الحلقات', search: 'بحث حلقة...', allSeries: 'كل السلاسل', allStatuses: 'كل الحالات النشطة',
    loading: 'جارٍ تحميل الحلقات...', episode: 'الحلقة', series: 'السلسلة', track: 'المسار', objective: 'الهدف', familyActivity: 'النشاط العائلي', duration: 'المدة', status: 'الحالة', actions: 'إجراءات',
    episodeNumber: (number: number) => `الحلقة ${number}`, noNumber: 'بلا رقم بعد', unspecified: 'غير محدد', edit: 'تعديل', archive: 'أرشفة', empty: 'لا توجد حلقات بعد', emptyDesc: 'أنشئ أول حلقة داخل إحدى السلاسل، ولن نعرض بيانات تجريبية بدلًا منها.', addEpisode: 'إضافة حلقة',
    editTitle: 'تعديل الحلقة', createTitle: 'إضافة حلقة جديدة', modalDesc: 'يمكن استكمال الهدف التعليمي والوسائط لاحقًا عبر الـAPI.', name: 'اسم الحلقة *', selectSeries: 'اختر السلسلة', number: 'رقم الحلقة', seconds: 'المدة بالثواني', description: 'وصف الحلقة', parentGuide: 'دليل ولي الأمر', activity: 'نشاط عائلي', cancel: 'إلغاء', saving: 'جارٍ الحفظ...', save: 'حفظ الحلقة',
  },
  en: {
    loadError: 'Unable to load episodes', required: 'Episode name and series are required.', saveError: 'Unable to save the episode', statusError: 'Unable to update status', archiveError: 'Unable to archive the episode',
    confirmArchive: (title: string) => `Archive the episode “${title}”?`, level: 'Learning units', headline: 'Episodes and learning units', intro: 'Every episode is linked to a series and track and can include an objective and family activity.',
    newEpisode: 'New episode', needsSeries: 'Add a series before creating episodes.', library: 'Episode library', allEpisodes: 'All episodes', search: 'Search episodes...', allSeries: 'All series', allStatuses: 'All active statuses',
    loading: 'Loading episodes...', episode: 'Episode', series: 'Series', track: 'Track', objective: 'Objective', familyActivity: 'Family activity', duration: 'Duration', status: 'Status', actions: 'Actions',
    episodeNumber: (number: number) => `Episode ${number}`, noNumber: 'Not numbered yet', unspecified: 'Not specified', edit: 'Edit', archive: 'Archive', empty: 'No episodes yet', emptyDesc: 'Create the first episode in a series; placeholder data is never shown instead.', addEpisode: 'Add episode',
    editTitle: 'Edit episode', createTitle: 'Add a new episode', modalDesc: 'The learning objective and media can be completed later through the API.', name: 'Episode name *', selectSeries: 'Select a series', number: 'Episode number', seconds: 'Duration in seconds', description: 'Episode description', parentGuide: 'Parent guide', activity: 'Family activity', cancel: 'Cancel', saving: 'Saving...', save: 'Save episode',
  },
}

type EpisodeForm = { title_ar: string; series_id: string; episode_number: string; duration_seconds: string; description_ar: string; parent_guide_ar: string; family_activity_ar: string; status: ContentStatus }
const emptyForm: EpisodeForm = { title_ar: '', series_id: '', episode_number: '', duration_seconds: '', description_ar: '', parent_guide_ar: '', family_activity_ar: '', status: 'draft' }

function durationLabel(seconds: number | null | undefined, locale: 'ar' | 'en') {
  if (!seconds) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = new Intl.NumberFormat(localeCode(locale), { minimumIntegerDigits: 2, useGrouping: false }).format(seconds % 60)
  return `${formatNumber(minutes, locale)}:${remainder}`
}

export function EpisodesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [records, setRecords] = useState<EpisodeRecord[]>([])
  const [series, setSeries] = useState<SeriesRecord[]>([])
  const [query, setQuery] = useState('')
  const [seriesFilter, setSeriesFilter] = useState('')
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 50
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EpisodeRecord | null>(null)
  const [form, setForm] = useState<EpisodeForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [publishTarget, setPublishTarget] = useState<EpisodeRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.episodes({ q: query, series_id: seriesFilter, status, limit, offset })
      setRecords(response.data)
      setTotal(response.meta.total)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally { setLoading(false) }
  }, [query, seriesFilter, status, text.loadError, offset])

  useEffect(() => { setOffset(0) }, [query, seriesFilter, status])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer) }, [load])
  useEffect(() => { void api.series({ status: 'all', limit: 100 }).then((response) => setSeries(response.data.filter((item) => item.status !== 'archived'))).catch(() => setSeries([])) }, [])

  // ‏?new=1 من لوحة الأوامر يفتح النموذج نفسه الذي يفتحه زرّ الصفحة.
  useQuickCreate(() => openCreate())

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, series_id: seriesFilter || series[0]?.id || '' })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(episode: EpisodeRecord) {
    setEditing(episode)
    setForm({ title_ar: episode.title_ar, series_id: episode.series_id, episode_number: episode.episode_number ? String(episode.episode_number) : '', duration_seconds: episode.duration_seconds ? String(episode.duration_seconds) : '', description_ar: episode.description_ar ?? '', parent_guide_ar: episode.parent_guide_ar ?? '', family_activity_ar: episode.family_activity_ar ?? '', status: episode.status })
    setFormError('')
    setModalOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.title_ar.trim() || !form.series_id) { setFormError(text.required); return }
    setSaving(true)
    setFormError('')
    const payload: EpisodePayload = {
      title_ar: form.title_ar.trim(), series_id: form.series_id,
      episode_number: form.episode_number ? Number(form.episode_number) : null,
      duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
      description_ar: form.description_ar.trim(), parent_guide_ar: form.parent_guide_ar.trim(),
      family_activity_ar: form.family_activity_ar.trim(), status: form.status,
    }
    try {
      if (editing) await api.updateEpisode(editing.id, payload)
      else await api.createEpisode(payload)
      setModalOpen(false)
      await load()
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : text.saveError) }
    finally { setSaving(false) }
  }

  async function changeStatus(id: string, nextStatus: ContentStatus) {
    setBusyId(id)
    try { await api.updateEpisode(id, { status: nextStatus }); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.statusError) }
    finally { setBusyId('') }
  }

  async function publish(episode: EpisodeRecord) {
    // شاشة الجاهزية أولًا، لا نداء نشر مباشر.
    //
    // فحوص الحلقة هي الأكثر أثرًا في البوابة: حلقة بلا ملف فيديو أو بلا صورة
    // مصغّرة أو تحت سلسلة غير منشورة ليست حلقة أقلّ جودة، بل بطاقة ميتة في
    // مكتبة الطفل. الخادم يرفضها بـ409، وهذه الشاشة تُظهر ذلك قبل المحاولة.
    setPublishTarget(episode)
  }

  async function archive(episode: EpisodeRecord) {
    if (!window.confirm(text.confirmArchive(episode.title_ar))) return
    setBusyId(episode.id)
    try { await api.archiveEpisode(episode.id); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.archiveError) }
    finally { setBusyId('') }
  }

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.level}</span><h2>{text.headline}</h2><p>{text.intro}</p></div><button className="button button--primary" type="button" onClick={openCreate} disabled={!series.length}><Icon name="plus" size={17} />{text.newEpisode}</button></section>
      {!series.length && !loading && <div className="inline-alert inline-alert--info">{text.needsSeries}</div>}
      <section className="panel panel--table">
        <header className="panel__header panel__header--filters"><div><span className="panel__kicker">{text.library}</span><h3>{text.allEpisodes} <span className="title-count">{formatNumber(total, locale)}</span></h3></div><div className="filters-row"><label className="search-field"><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search}/></label><select value={seriesFilter} onChange={(event) => setSeriesFilter(event.target.value)} aria-label={text.allSeries}><option value="">{text.allSeries}</option>{series.map((item) => <option value={item.id} key={item.id}>{locale === 'en' ? item.title_en || item.title_ar : item.title_ar}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={text.allStatuses}><option value="">{text.allStatuses}</option>{filterStatuses.map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}</select></div></header>
        {loading && !records.length ? <LoadingState label={text.loading}/> : error && !records.length ? <ErrorState message={error} onRetry={() => void load()}/> : records.length ? <><div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr><th>{text.episode}</th><th>{text.series}</th><th>{text.track}</th><th>{text.objective}</th><th>{text.familyActivity}</th><th>{text.duration}</th><th>{text.status}</th><th>{text.actions}</th></tr></thead><tbody>{records.map((episode) => <tr key={episode.id}><td><Link className="entity-cell entity-cell--button" to={adminPath(`episodes/${episode.id}`)}><EntityThumbnail src={episode.thumbnail_url} alt={episode.title_ar} icon="play" /><div><strong>{episode.title_ar}</strong><small>{episode.episode_number ? text.episodeNumber(episode.episode_number) : text.noNumber}</small></div></Link></td><td>{episode.series_title}</td><td><div className="badge-list">{episode.track_ids.map((item) => <TrackBadge track={item} key={item}/>)}</div></td><td className="cell-wrap">{episode.objective_title || text.unspecified}</td><td className="cell-wrap">{episode.family_activity_ar || '—'}</td><td>{durationLabel(episode.duration_seconds, locale)}</td><td>{episode.status === 'published' ? <StatusBadge status={episode.status}/> : <><select className="status-select" value={episode.status} disabled={busyId === episode.id} aria-label={`${text.status}: ${episode.title_ar}`} onChange={(event) => void changeStatus(episode.id, event.target.value as ContentStatus)}>{editableStatuses.map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}</select><StatusBadge status={episode.status}/></>}</td><td><div className="table-actions">{episode.status !== 'published' ? <button className="icon-button icon-button--small" type="button" onClick={() => void publish(episode)} disabled={busyId === episode.id} title={locale === 'ar' ? 'نشر' : 'Publish'}><Icon name="upload" size={16}/></button> : null}<button className="icon-button icon-button--small" type="button" onClick={() => openEdit(episode)} title={text.edit}><Icon name="edit" size={16}/></button><button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void archive(episode)} disabled={busyId === episode.id} title={text.archive}><Icon name="archive" size={16}/></button></div></td></tr>)}</tbody></table></div><Pagination total={total} limit={limit} offset={offset} onOffsetChange={setOffset} locale={locale} /></> : <EmptyState title={text.empty} description={text.emptyDesc} action={series.length ? <button className="button button--primary" type="button" onClick={openCreate}><Icon name="plus" size={17}/>{text.addEpisode}</button> : undefined}/>}
      </section>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? text.editTitle : text.createTitle} description={text.modalDesc}>
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid"><label className="field"><span>{text.name}</span><input autoFocus value={form.title_ar} onChange={(event) => setForm({ ...form, title_ar: event.target.value })}/></label><label className="field"><span>{text.series} *</span><select value={form.series_id} onChange={(event) => setForm({ ...form, series_id: event.target.value })}><option value="">{text.selectSeries}</option>{series.map((item) => <option value={item.id} key={item.id}>{locale === 'en' ? item.title_en || item.title_ar : item.title_ar}</option>)}</select></label></div>
          <div className="form-grid form-grid--three"><label className="field"><span>{text.number}</span><input type="number" min="1" value={form.episode_number} onChange={(event) => setForm({ ...form, episode_number: event.target.value })}/></label><label className="field"><span>{text.seconds}</span><input type="number" min="1" value={form.duration_seconds} onChange={(event) => setForm({ ...form, duration_seconds: event.target.value })}/></label><label className="field"><span>{text.status}</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ContentStatus })}>{editableStatuses.map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}</select></label></div>
          <label className="field"><span>{text.description}</span><textarea rows={3} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })}/></label>
          <div className="form-grid"><label className="field"><span>{text.parentGuide}</span><textarea rows={3} value={form.parent_guide_ar} onChange={(event) => setForm({ ...form, parent_guide_ar: event.target.value })}/></label><label className="field"><span>{text.activity}</span><textarea rows={3} value={form.family_activity_ar} onChange={(event) => setForm({ ...form, family_activity_ar: event.target.value })}/></label></div>
          <div className="form-actions"><button className="button button--ghost" type="button" onClick={() => setModalOpen(false)} disabled={saving}>{text.cancel}</button><button className="button button--primary" type="submit" disabled={saving}>{saving ? text.saving : text.save}</button></div>
        </form>
      </Modal>

      {publishTarget && (
        <PublishReadinessDialog
          open
          entityType="episode"
          entityId={publishTarget.id}
          entityTitle={publishTarget.title_ar}
          onClose={() => setPublishTarget(null)}
          onPublish={(id) => api.publishEpisode(id)}
          onPublished={load}
        />
      )}
    </div>
  )
}
