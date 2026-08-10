import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { AgeTrack, ContentStatus, Planet, SeriesPayload, SeriesRecord, VisualStyleRecord } from '../types/api'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { PublishReadinessDialog } from '../components/PublishReadinessDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { Pagination } from '../components/Pagination'
import { StatusBadge, TrackBadge } from '../components/StatusBadge'
import { formatNumber, statusLabels, trackLabels } from '../lib/labels'
import { adminPath } from '../lib/adminPath'
import { useQuickCreate } from '../hooks/useQuickCreate'
import { usePreferences } from '../context/preferences'

const typeLabels = {
  ar: { continuous: 'مستمرة', anthology: 'منفصلة', knowledge: 'معرفية', presenter: 'تقديمية', standalone: 'مستقلة' },
  en: { continuous: 'Continuous', anthology: 'Anthology', knowledge: 'Knowledge', presenter: 'Presenter-led', standalone: 'Standalone' },
}
const productionLabels = {
  ar: { motion_story: 'قصة متحركة', limited_2d: 'تحريك ثنائي محدود', full_2d: 'تحريك ثنائي كامل', live: 'تصوير حي', stylized_3d: 'ثلاثي أبعاد مبسط' },
  en: { motion_story: 'Motion story', limited_2d: 'Limited 2D', full_2d: 'Full 2D', live: 'Live action', stylized_3d: 'Stylized 3D' },
}
const editableStatuses: ContentStatus[] = ['draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled']
const filterStatuses: ContentStatus[] = [...editableStatuses, 'published']
const trackAges: Record<AgeTrack, [number, number]> = { preschool: [3, 5], kids: [6, 8], junior: [9, 12] }

const copy = {
  ar: {
    loadError: 'تعذر تحميل السلاسل', required: 'اسم السلسلة والكوكب مطلوبان.', saveError: 'تعذر حفظ السلسلة', statusError: 'تعذر تحديث الحالة', archiveError: 'تعذر أرشفة السلسلة',
    confirmArchive: (title: string) => `هل تريد أرشفة «${title}»؟ لن تُحذف البيانات.`, network: 'شبكة المحتوى', headline: 'السلاسل هي الكيان الأساسي', intro: 'لكل سلسلة هوية وأهداف وشخصيات ومسار عمري مستقل.',
    newSeries: 'سلسلة جديدة', catalog: 'كتالوج المحتوى', allSeries: 'كل السلاسل', search: 'بحث بالاسم...', allTracks: 'كل المسارات', allStatuses: 'كل الحالات النشطة',
    loading: 'جارٍ تحميل السلاسل...', series: 'السلسلة', planet: 'الكوكب', type: 'النوع', track: 'المسار', production: 'الإنتاج', episodes: 'الحلقات', status: 'الحالة', actions: 'إجراءات',
    edit: 'تعديل', archive: 'أرشفة', publish: 'نشر', empty: 'لا توجد نتائج', emptyDesc: 'غيّر خيارات البحث أو أضف سلسلة جديدة.', addSeries: 'إضافة سلسلة',
    qualityWarningTitle: (title: string) => `تنبيهات جودة على «${title}»`,
    qualityWarningIntro: 'فحص الجودة الموجود بالخادم يشير إلى نواقص. النشر لا يزال مسموحًا؛ هذا تنبيه لا بوابة إلزامية.',
    qualityWarningConfirm: 'نشر مع هذه النواقص؟',
    qualityCheckFailed: 'تعذر تشغيل فحص الجودة قبل النشر؛ استمرّ بحذر.',
    editTitle: 'تعديل السلسلة', createTitle: 'إضافة سلسلة جديدة', modalDesc: 'المسار المختار يحدد نطاق العمر تلقائيًا.', titleAr: 'اسم السلسلة بالعربية *', titlePlaceholder: 'مثال: حكاية وحكمة',
    planetRequired: 'الكوكب *', selectPlanet: 'اختر الكوكب', seriesType: 'نوع السلسلة', ageTrack: 'المسار العمري', productionLevel: 'مستوى الإنتاج', visualStyle: 'الأسلوب البصري',
    visualPlaceholder: 'مثال: رسوم ثنائية ناعمة', description: 'وصف السلسلة', descriptionPlaceholder: 'وصف مختصر يوضح الفكرة التعليمية...', cancel: 'إلغاء', saving: 'جارٍ الحفظ...', save: 'حفظ التعديلات', createDraft: 'إنشاء كمسودة',
  },
  en: {
    loadError: 'Unable to load series', required: 'Series name and planet are required.', saveError: 'Unable to save the series', statusError: 'Unable to update status', archiveError: 'Unable to archive the series',
    confirmArchive: (title: string) => `Archive “${title}”? The data will not be deleted.`, network: 'Content network', headline: 'Series are the core content entity', intro: 'Every series has its own identity, objectives, characters, and age track.',
    newSeries: 'New series', catalog: 'Content catalog', allSeries: 'All series', search: 'Search by name...', allTracks: 'All tracks', allStatuses: 'All active statuses',
    loading: 'Loading series...', series: 'Series', planet: 'Planet', type: 'Type', track: 'Track', production: 'Production', episodes: 'Episodes', status: 'Status', actions: 'Actions',
    edit: 'Edit', archive: 'Archive', publish: 'Publish', empty: 'No results', emptyDesc: 'Change the filters or add a new series.', addSeries: 'Add series',
    qualityWarningTitle: (title: string) => `Quality warnings on “${title}”`,
    qualityWarningIntro: 'The server-side quality check found issues. Publishing is still allowed; this is a warning, not a required gate.',
    qualityWarningConfirm: 'Publish anyway?',
    qualityCheckFailed: 'Unable to run the pre-publish quality check; proceeding without it.',
    editTitle: 'Edit series', createTitle: 'Add a new series', modalDesc: 'The selected track sets the age range automatically.', titleAr: 'Arabic series title *', titlePlaceholder: 'Example: A Tale and Wisdom',
    planetRequired: 'Planet *', selectPlanet: 'Select a planet', seriesType: 'Series type', ageTrack: 'Age track', productionLevel: 'Production level', visualStyle: 'Visual style',
    visualPlaceholder: 'Example: Soft 2D / Infographic', description: 'Series description', descriptionPlaceholder: 'A short description of the learning concept...', cancel: 'Cancel', saving: 'Saving...', save: 'Save changes', createDraft: 'Create as draft',
  },
}

type SeriesForm = {
  title_ar: string
  planet_id: string
  type: SeriesRecord['type']
  track: AgeTrack
  production_level: SeriesRecord['production_level']
  visual_style: string
  visual_style_id: string
  description_ar: string
}

const emptyForm: SeriesForm = { title_ar: '', planet_id: '', type: 'continuous', track: 'kids', production_level: 'limited_2d', visual_style: '', visual_style_id: '', description_ar: '' }

export function SeriesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [searchParams] = useSearchParams()
  const requestedQuery = searchParams.get('q') ?? ''
  const [records, setRecords] = useState<SeriesRecord[]>([])
  const [planets, setPlanets] = useState<Planet[]>([])
  const [visualStyles, setVisualStyles] = useState<VisualStyleRecord[]>([])
  const [query, setQuery] = useState(requestedQuery)
  const [track, setTrack] = useState('')
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 50
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SeriesRecord | null>(null)
  const [form, setForm] = useState<SeriesForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [busyId, setBusyId] = useState('')
  /// السلسلة التي طُلب نشرها. غير فارغة ⇒ شاشة الجاهزية مفتوحة لها.
  const [publishTarget, setPublishTarget] = useState<SeriesRecord | null>(null)

  useEffect(() => setQuery(requestedQuery), [requestedQuery])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.series({ q: query, track, status, limit, offset })
      setRecords(response.data)
      setTotal(response.meta.total)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [query, status, text.loadError, track, offset])

  useEffect(() => { setOffset(0) }, [query, track, status])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    void Promise.all([api.planets(), api.visualStyles()]).then(([planetResponse, styleResponse]) => {
      setPlanets(planetResponse.data)
      setVisualStyles(styleResponse.data)
    }).catch(() => { setPlanets([]); setVisualStyles([]) })
  }, [])

  // ‏?new=1 من لوحة الأوامر يفتح النموذج نفسه الذي يفتحه زرّ الصفحة.
  useQuickCreate(() => openCreate())

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, planet_id: planets[0]?.id ?? '', visual_style_id: visualStyles[0]?.id ?? '' })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(series: SeriesRecord) {
    setEditing(series)
    setForm({
      title_ar: series.title_ar,
      planet_id: series.planet_id,
      type: series.type,
      track: series.track_ids[0] ?? 'kids',
      production_level: series.production_level,
      visual_style: series.visual_style ?? '',
      visual_style_id: series.visual_style_id ?? '',
      description_ar: series.description_ar ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.title_ar.trim() || !form.planet_id) {
      setFormError(text.required)
      return
    }
    setSaving(true)
    setFormError('')
    const [ageMin, ageMax] = trackAges[form.track]
    const payload: SeriesPayload = {
      title_ar: form.title_ar.trim(), planet_id: form.planet_id, type: form.type,
      age_min: ageMin, age_max: ageMax, track_ids: [form.track],
      production_level: form.production_level, visual_style: form.visual_style.trim(),
      visual_style_id: form.visual_style_id || null,
      description_ar: form.description_ar.trim(),
    }
    try {
      if (editing) await api.updateSeries(editing.id, payload)
      else await api.createSeries(payload)
      setModalOpen(false)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(id: string, nextStatus: ContentStatus) {
    setBusyId(id)
    try { await api.updateSeries(id, { status: nextStatus }); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.statusError) }
    finally { setBusyId('') }
  }

  async function publish(series: SeriesRecord) {
    // لا نشر مباشر من الجدول: تُفتح شاشة الجاهزية أولًا.
    //
    // النسخة السابقة كانت تستدعي فحص الجودة ثم `window.confirm` وتنشر بعد
    // التأكيد — أي تنبيه في المتصفح لا بوابة. الفرض الآن على الخادم في
    // `lib/publishGate.ts`، وهذه الشاشة تعرض نفس نتيجته قبل الضغط، فلا يبقى
    // فرق بين ما يراه المحرّر وما سيحدث فعلًا.
    setPublishTarget(series)
  }

  async function archive(series: SeriesRecord) {
    const title = locale === 'en' ? series.title_en || series.title_ar : series.title_ar
    if (!window.confirm(text.confirmArchive(title))) return
    setBusyId(series.id)
    try { await api.archiveSeries(series.id); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.archiveError) }
    finally { setBusyId('') }
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">{text.network}</span><h2>{text.headline}</h2><p>{text.intro}</p></div>
        <button className="button button--primary" type="button" onClick={openCreate}><Icon name="plus" size={17} />{text.newSeries}</button>
      </section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><span className="panel__kicker">{text.catalog}</span><h3>{text.allSeries} <span className="title-count">{formatNumber(total, locale)}</span></h3></div>
          <div className="filters-row">
            <label className="search-field"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} /></label>
            <select value={track} onChange={(event) => setTrack(event.target.value)}><option value="">{text.allTracks}</option><option value="preschool">{trackLabels[locale].preschool}</option><option value="kids">{trackLabels[locale].kids}</option><option value="junior">{trackLabels[locale].junior}</option></select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{text.allStatuses}</option>{filterStatuses.map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}</select>
          </div>
        </header>

        {loading && !records.length ? <LoadingState label={text.loading} /> : error && !records.length ? <ErrorState message={error} onRetry={() => void load()} /> : records.length ? <><div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr><th>{text.series}</th><th>{text.planet}</th><th>{text.type}</th><th>{text.track}</th><th>{text.production}</th><th>{text.episodes}</th><th>{text.status}</th><th>{text.actions}</th></tr></thead><tbody>{records.map((series) => { const title = locale === 'en' ? series.title_en || series.title_ar : series.title_ar; return <tr key={series.id}><td><Link className="entity-cell entity-cell--button" to={adminPath(`series/${series.id}`)}><EntityThumbnail src={series.cover_url} alt={title} label={title} color={series.planet_color} icon="series" /><div><strong>{title}</strong><small>{series.slug}</small></div></Link></td><td>{series.planet_name || '—'}</td><td>{typeLabels[locale][series.type]}</td><td><div className="badge-list">{series.track_ids.map((item) => <TrackBadge track={item} key={item} />)}</div></td><td>{productionLabels[locale][series.production_level]}</td><td>{formatNumber(Number(series.episodes_count ?? 0), locale)}</td><td>{series.status === 'published' ? <StatusBadge status={series.status} /> : <><select className="status-select" value={series.status} disabled={busyId === series.id} onChange={(event) => void changeStatus(series.id, event.target.value as ContentStatus)}>{editableStatuses.map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}</select><StatusBadge status={series.status} /></>}</td><td><div className="table-actions">{series.status !== 'published' ? <button className="icon-button icon-button--small" type="button" onClick={() => void publish(series)} disabled={busyId === series.id} title={text.publish}><Icon name="upload" size={16} /></button> : null}<button className="icon-button icon-button--small" type="button" onClick={() => openEdit(series)} title={text.edit}><Icon name="edit" size={16} /></button><button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void archive(series)} disabled={busyId === series.id} title={text.archive}><Icon name="archive" size={16} /></button></div></td></tr> })}</tbody></table></div><Pagination total={total} limit={limit} offset={offset} onOffsetChange={setOffset} locale={locale} /></> : <EmptyState title={text.empty} description={text.emptyDesc} action={<button className="button button--primary" type="button" onClick={openCreate}><Icon name="plus" size={17} />{text.addSeries}</button>} />}
      </section>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? text.editTitle : text.createTitle} description={text.modalDesc}>
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid"><label className="field"><span>{text.titleAr}</span><input autoFocus value={form.title_ar} onChange={(event) => setForm({ ...form, title_ar: event.target.value })} placeholder={text.titlePlaceholder} /></label><label className="field"><span>{text.planetRequired}</span><select value={form.planet_id} onChange={(event) => setForm({ ...form, planet_id: event.target.value })}><option value="">{text.selectPlanet}</option>{planets.map((planet) => <option value={planet.id} key={planet.id}>{locale === 'en' ? planet.name_en || planet.name_ar : planet.name_ar}</option>)}</select></label></div>
          <div className="form-grid"><label className="field"><span>{text.seriesType}</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as SeriesRecord['type'] })}>{Object.entries(typeLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field"><span>{text.ageTrack}</span><select value={form.track} onChange={(event) => setForm({ ...form, track: event.target.value as AgeTrack })}>{Object.entries(trackLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
          <div className="form-grid"><label className="field"><span>{text.productionLevel}</span><select value={form.production_level} onChange={(event) => setForm({ ...form, production_level: event.target.value as SeriesRecord['production_level'] })}>{Object.entries(productionLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field"><span>{text.visualStyle}</span><select value={form.visual_style_id} onChange={(event) => { const selected = visualStyles.find((item) => item.id === event.target.value); setForm({ ...form, visual_style_id: event.target.value, visual_style: selected?.name_en ?? form.visual_style }) }}><option value="">{locale === 'ar' ? 'بدون قالب محدد' : 'No preset'}</option>{visualStyles.map((item) => <option value={item.id} key={item.id}>{locale === 'ar' ? item.name_ar : item.name_en}</option>)}</select></label></div>
          <label className="field"><span>{text.description}</span><textarea rows={4} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })} placeholder={text.descriptionPlaceholder} /></label>
          <div className="form-actions"><button className="button button--ghost" type="button" onClick={() => setModalOpen(false)} disabled={saving}>{text.cancel}</button><button className="button button--primary" type="submit" disabled={saving}>{saving ? text.saving : editing ? text.save : text.createDraft}</button></div>
        </form>
      </Modal>

      {publishTarget && (
        <PublishReadinessDialog
          open
          entityType="series"
          entityId={publishTarget.id}
          entityTitle={locale === 'en' ? publishTarget.title_en || publishTarget.title_ar : publishTarget.title_ar}
          onClose={() => setPublishTarget(null)}
          onPublish={(id) => api.publishSeries(id)}
          onPublished={load}
        />
      )}
    </div>
  )
}
