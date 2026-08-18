import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { AgeTrack, ContentStatus, Planet, SeriesPayload, SeriesRecord, VisualStyleRecord } from '../types/api'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { PublishReadinessDialog } from '../components/PublishReadinessDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { Pagination } from '../components/Pagination'
import { StatusBadge, TrackBadge } from '../components/StatusBadge'
import { formatNumber, statusLabels, trackLabels, trackList } from '../lib/labels'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
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
  source_type: string
  source_reference: string
  verse_surah: string
  verse_ayah: string
  hadith_collection: string
  hadith_number: string
  hadith_grade: string
  religious_reviewer_id: string
  religious_reviewer_version: string
  religious_approved_at: string
  visual_restrictions: string
}

const emptyForm: SeriesForm = {
  title_ar: '', planet_id: '', type: 'continuous', track: 'kids', production_level: 'limited_2d', visual_style: '', visual_style_id: '', description_ar: '',
  source_type: '', source_reference: '', verse_surah: '', verse_ayah: '', hadith_collection: '', hadith_number: '', hadith_grade: '',
  religious_reviewer_id: '', religious_reviewer_version: '', religious_approved_at: '', visual_restrictions: '',
}

/// أسماء الفلاتر هي أسماء معاملات الاستعلام التي يقبلها `GET /admin/series`
/// بالحرف، فرابط من اللوحة التنفيذية يفتح المجموعة نفسها التي عدّها المقياس.
/// ‏`planet` و`category` سياقان واردان لا حقلان في الدرج: شاشة الكواكب وشاشة
/// التصنيفات تفتحان هذه القائمة مقصورةً على أحدهما. كلاهما معامل يقبله
/// `GET /admin/series` بالحرف، فالرقم على البطاقة والقائمة التي تفتحها يتّفقان.
const DEFAULT_FILTERS = { track: '', status: '', planet: '', category: '' }
const LIMIT = 50

/// حقول الدرج، مُعرَّفة كبيانات لا كـJSX: نفس التعريف يقود الدرج والشرائح
/// وعدّاد الفلاتر النشطة وزرّ المسح، فلا يمكن أن تنسى الشاشة واحدًا منها.
const FILTER_FIELDS = (
  text: { allTracks: string; allStatuses: string; track: string; status: string },
  locale: 'ar' | 'en',
): FilterField[] => [
  {
    key: 'track',
    label: text.track,
    type: 'select',
    options: [
      { value: '', label: text.allTracks },
      { value: 'preschool', label: trackLabels[locale].preschool },
      { value: 'kids', label: trackLabels[locale].kids },
      { value: 'junior', label: trackLabels[locale].junior },
    ],
  },
  {
    key: 'status',
    label: text.status,
    type: 'select',
    options: [
      { value: '', label: text.allStatuses },
      ...filterStatuses.map((item) => ({ value: item, label: statusLabels[locale][item] })),
    ],
  },
]

export function SeriesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  // حالة القائمة في العنوان لا في الذاكرة.
  //
  // ## ما كان مكسورًا
  //
  // كانت الفلاتر في `useState`، و`q` وحده يُقرأ من العنوان مرة عند التركيب. أثر
  // ذلك ثلاثة:
  //
  // ١. **روابط اللوحة التنفيذية كانت تفتح قائمة غير مفلترة.** المقياس يقول
  //    «١٢ سلسلة قيد الإنتاج» ويفتح كل السلاسل، فيقرأ المستخدم رقمًا ثم يرى
  //    مجموعة أخرى. تدقيق المقاييس رصد هذا في ثلاثة عشر مسارًا.
  // ٢. زرّ الرجوع في المتصفح لا يُعيد الفلترة السابقة.
  // ٣. رابط منسوخ من شريط العنوان لا ينقل ما كان يراه صاحبه.
  //
  // `useUrlListState` يجعل العنوان المصدر الوحيد، فتغيير الفلتر يُصفّر الترقيم
  // تلقائيًا ولا توجد نسخة ثانية تتزامن معه.
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const navigate = useNavigate()
  const { query, filters, offset, limit } = list
  const { track, status, category, planet: planetContext } = filters
  const [records, setRecords] = useState<SeriesRecord[]>([])
  const [planets, setPlanets] = useState<Planet[]>([])
  const [visualStyles, setVisualStyles] = useState<VisualStyleRecord[]>([])
  const [total, setTotal] = useState(0)
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

  // لا مزامنة بين العنوان والحالة: لم تبقَ نسخة محلية للفلاتر تحتاج مزامنة.

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.series({
        q: query,
        track,
        status,
        planet: planetContext || undefined,
        category: category || undefined,
        limit,
        offset,
      })
      setRecords(response.data)
      setTotal(response.meta.total)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [query, status, text.loadError, track, planetContext, category, offset])

  // لا `setOffset(0)` هنا: `useUrlListState` يُصفّر الترقيم عند كل تغيير فلتر،
  // فأثرٌ إضافي يفعل الشيء نفسه كان سيكتب في العنوان مرتين لكل ضغطة.

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
    /// الكوكب المفلتر يفوز على أول كوكب في القائمة.
    ///
    /// مساحة عمل الكوكب تفتح هذه الشاشة بـ`?planet=X&new=1`، وكان النموذج يختار
    /// `planets[0]` دائمًا — فمن أنشأ سلسلة من داخل «أبجد» كان يحصل على نموذج
    /// يشير إلى كوكب آخر، ويصمت الخطأ إن لم يلاحظه. الفلتر النشِط هو السياق الذي
    /// جاء منه المستخدم، فهو الافتراض الصحيح.
    const contextPlanet = list.filters.planet
    setForm({
      ...emptyForm,
      planet_id: contextPlanet || planets[0]?.id || '',
      visual_style_id: visualStyles[0]?.id ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(series: SeriesRecord) {
    setEditing(series)
    setForm({
      title_ar: series.title_ar,
      planet_id: series.planet_id,
      type: series.type,
      track: trackList(series.track_ids)[0] ?? 'kids',
      production_level: series.production_level,
      visual_style: series.visual_style ?? '',
      visual_style_id: series.visual_style_id ?? '',
      description_ar: series.description_ar ?? '',
      source_type: (series as unknown as { source_type?: string | null }).source_type ?? '',
      source_reference: (series as unknown as { source_reference?: string | null }).source_reference ?? '',
      verse_surah: String((series as unknown as { verse_surah?: number | null }).verse_surah ?? ''),
      verse_ayah: String((series as unknown as { verse_ayah?: number | null }).verse_ayah ?? ''),
      hadith_collection: (series as unknown as { hadith_collection?: string | null }).hadith_collection ?? '',
      hadith_number: (series as unknown as { hadith_number?: string | null }).hadith_number ?? '',
      hadith_grade: (series as unknown as { hadith_grade?: string | null }).hadith_grade ?? '',
      religious_reviewer_id: (series as unknown as { religious_reviewer_id?: string | null }).religious_reviewer_id ?? '',
      religious_reviewer_version: String((series as unknown as { religious_reviewer_version?: number | null }).religious_reviewer_version ?? ''),
      religious_approved_at: (series as unknown as { religious_approved_at?: string | null }).religious_approved_at ?? '',
      visual_restrictions: (series as unknown as { visual_restrictions?: string | null }).visual_restrictions ?? '',
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
    const base: SeriesPayload = {
      title_ar: form.title_ar.trim(), planet_id: form.planet_id, type: form.type,
      age_min: ageMin, age_max: ageMax, track_ids: [form.track],
      production_level: form.production_level, visual_style: form.visual_style.trim(),
      visual_style_id: form.visual_style_id || null,
      description_ar: form.description_ar.trim(),
    }
    // Islamic governance — only include fields that were actually edited or belong to islamic planet
    const isIslamic = form.planet_id === 'islamic' || form.planet_id === 'iman' || (editing?.planet_id === 'islamic' || editing?.planet_id === 'iman')
    const islamicPayload: Partial<SeriesPayload> = {}
    if (isIslamic || form.source_type || editing) {
      const st = form.source_type.trim()
      if (st) islamicPayload.source_type = st as SeriesPayload['source_type']
      else if (editing && form.source_type === '') islamicPayload.source_type = null as unknown as SeriesPayload['source_type']
      const ref = form.source_reference.trim()
      if (ref) islamicPayload.source_reference = ref
      else if (editing && form.source_reference === '') islamicPayload.source_reference = null
      const vs = form.verse_surah.trim()
      if (vs) islamicPayload.verse_surah = Number(vs)
      else if (editing && form.verse_surah === '') islamicPayload.verse_surah = null
      const va = form.verse_ayah.trim()
      if (va) islamicPayload.verse_ayah = Number(va)
      else if (editing && form.verse_ayah === '') islamicPayload.verse_ayah = null
      const hc = form.hadith_collection.trim()
      if (hc) islamicPayload.hadith_collection = hc
      else if (editing && form.hadith_collection === '') islamicPayload.hadith_collection = null
      const hn = form.hadith_number.trim()
      if (hn) islamicPayload.hadith_number = hn
      else if (editing && form.hadith_number === '') islamicPayload.hadith_number = null
      const hg = form.hadith_grade.trim()
      if (hg) islamicPayload.hadith_grade = hg
      else if (editing && form.hadith_grade === '') islamicPayload.hadith_grade = null
      const rr = form.religious_reviewer_id.trim()
      if (rr) islamicPayload.religious_reviewer_id = rr
      else if (editing && form.religious_reviewer_id === '') islamicPayload.religious_reviewer_id = null
      const rv = form.religious_reviewer_version.trim()
      if (rv) islamicPayload.religious_reviewer_version = Number(rv)
      else if (editing && form.religious_reviewer_version === '') islamicPayload.religious_reviewer_version = null
      const ra = form.religious_approved_at.trim()
      if (ra) islamicPayload.religious_approved_at = ra
      else if (editing && form.religious_approved_at === '') islamicPayload.religious_approved_at = null
      const vr = form.visual_restrictions.trim()
      if (vr) islamicPayload.visual_restrictions = vr
      else if (editing && form.visual_restrictions === '') islamicPayload.visual_restrictions = null
    }
    const payload: SeriesPayload = { ...base, ...(Object.keys(islamicPayload).length ? islamicPayload as Partial<SeriesPayload> : {}) }
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
          <ListToolbar
            searchValue={query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={FILTER_FIELDS(text, locale)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(key) => list.setFilter(key as 'track' | 'status', '')}
            trailing={
              <SavedViewsMenu
                storageKey="series"
                currentSearch={list.search}
                onApply={(search) => navigate(`${adminPath('series')}${search}`)}
              />
            }
          />
        </header>

        {loading && !records.length ? <LoadingState label={text.loading} /> : error && !records.length ? <ErrorState message={error} onRetry={() => void load()} /> : records.length ? <><div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr><th>{text.series}</th><th>{text.planet}</th><th>{text.type}</th><th>{text.track}</th><th>{text.production}</th><th>{text.episodes}</th><th>{text.status}</th><th>{text.actions}</th></tr></thead><tbody>{records.map((series) => { const title = locale === 'en' ? series.title_en || series.title_ar : series.title_ar; return <tr key={series.id}><td><Link className="entity-cell entity-cell--button" to={adminPath(`series/${series.id}`)}><EntityThumbnail src={series.cover_url} alt={title} label={title} color={series.planet_color} icon="series" /><div><strong>{title}</strong><small>{series.slug}</small></div></Link></td><td>{series.planet_name || '—'}</td><td>{typeLabels[locale][series.type]}</td><td><div className="badge-list">{trackList(series.track_ids).map((item) => <TrackBadge track={item} key={item} />)}</div></td><td>{productionLabels[locale][series.production_level]}</td><td>{formatNumber(Number(series.episodes_count ?? 0), locale)}</td><td>{series.status === 'published' ? <StatusBadge status={series.status} /> : <><select className="status-select" value={series.status} disabled={busyId === series.id} aria-label={`${text.status}: ${title}`} onChange={(event) => void changeStatus(series.id, event.target.value as ContentStatus)}>{editableStatuses.map((item) => <option value={item} key={item}>{statusLabels[locale][item]}</option>)}</select><StatusBadge status={series.status} /></>}</td><td><div className="table-actions">{series.status !== 'published' ? <button className="icon-button icon-button--small" type="button" onClick={() => void publish(series)} disabled={busyId === series.id} title={text.publish}><Icon name="upload" size={16} /></button> : null}<button className="icon-button icon-button--small" type="button" onClick={() => openEdit(series)} title={text.edit}><Icon name="edit" size={16} /></button><button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void archive(series)} disabled={busyId === series.id} title={text.archive}><Icon name="archive" size={16} /></button></div></td></tr> })}</tbody></table></div><Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} /></> : <EmptyState title={text.empty} description={text.emptyDesc} action={<button className="button button--primary" type="button" onClick={openCreate}><Icon name="plus" size={17} />{text.addSeries}</button>} />}
      </section>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? text.editTitle : text.createTitle} description={text.modalDesc}>
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid"><label className="field"><span>{text.titleAr}</span><input autoFocus value={form.title_ar} onChange={(event) => setForm({ ...form, title_ar: event.target.value })} placeholder={text.titlePlaceholder} /></label><label className="field"><span>{text.planetRequired}</span><select value={form.planet_id} onChange={(event) => setForm({ ...form, planet_id: event.target.value })}><option value="">{text.selectPlanet}</option>{planets.map((planet) => <option value={planet.id} key={planet.id}>{locale === 'en' ? planet.name_en || planet.name_ar : planet.name_ar}</option>)}</select></label></div>
          <div className="form-grid"><label className="field"><span>{text.seriesType}</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as SeriesRecord['type'] })}>{Object.entries(typeLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field"><span>{text.ageTrack}</span><select value={form.track} onChange={(event) => setForm({ ...form, track: event.target.value as AgeTrack })}>{Object.entries(trackLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
          <div className="form-grid"><label className="field"><span>{text.productionLevel}</span><select value={form.production_level} onChange={(event) => setForm({ ...form, production_level: event.target.value as SeriesRecord['production_level'] })}>{Object.entries(productionLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field"><span>{text.visualStyle}</span><select value={form.visual_style_id} onChange={(event) => { const selected = visualStyles.find((item) => item.id === event.target.value); setForm({ ...form, visual_style_id: event.target.value, visual_style: selected?.name_en ?? form.visual_style }) }}><option value="">{locale === 'ar' ? 'بدون قالب محدد' : 'No preset'}</option>{visualStyles.map((item) => <option value={item.id} key={item.id}>{locale === 'ar' ? item.name_ar : item.name_en}</option>)}</select></label></div>
          <label className="field"><span>{text.description}</span><textarea rows={4} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })} placeholder={text.descriptionPlaceholder} /></label>
          {(form.planet_id === 'islamic' || form.planet_id === 'iman') && (
            <fieldset className="field" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 8 }}>
              <legend style={{ fontSize: 11, fontWeight: 700, padding: '0 6px' }}>الحوكمة الشرعية (للأرشيف الإسلامي فقط — تمنع النشر إن نقصت)</legend>
              <div className="form-grid" style={{ marginTop: 8 }}>
                <label className="field"><span>source_type</span><select value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}><option value="">— بلا مصدر (يتم المنع عند النشر) —</option><option value="quran">quran — قرآن</option><option value="hadith">hadith — حديث</option><option value="sira">sira — سيرة</option><option value="adab">adab — آداب</option><option value="general">general — عام</option></select></label>
                <label className="field"><span>source_reference</span><input value={form.source_reference} onChange={(e) => setForm({ ...form, source_reference: e.target.value })} placeholder="مثال: البخاري — كتاب الإيمان" /></label>
              </div>
              {form.source_type === 'quran' && (
                <div className="form-grid"><label className="field"><span>verse_surah (سورة)</span><input type="number" min={1} max={114} value={form.verse_surah} onChange={(e) => setForm({ ...form, verse_surah: e.target.value })} /></label><label className="field"><span>verse_ayah (آية)</span><input type="number" min={1} value={form.verse_ayah} onChange={(e) => setForm({ ...form, verse_ayah: e.target.value })} /></label></div>
              )}
              {form.source_type === 'hadith' && (
                <div className="form-grid"><label className="field"><span>hadith_collection</span><input value={form.hadith_collection} onChange={(e) => setForm({ ...form, hadith_collection: e.target.value })} placeholder="مثال: bukhari" /></label><label className="field"><span>hadith_number</span><input value={form.hadith_number} onChange={(e) => setForm({ ...form, hadith_number: e.target.value })} /></label><label className="field"><span>hadith_grade</span><input value={form.hadith_grade} onChange={(e) => setForm({ ...form, hadith_grade: e.target.value })} placeholder="صحيح/حسن" /></label></div>
              )}
              <div className="form-grid"><label className="field"><span>religious_reviewer_id (المراجع الشرعي)</span><input value={form.religious_reviewer_id} onChange={(e) => setForm({ ...form, religious_reviewer_id: e.target.value })} placeholder="معرّف المراجع" /></label><label className="field"><span>religious_reviewer_version</span><input type="number" min={1} value={form.religious_reviewer_version} onChange={(e) => setForm({ ...form, religious_reviewer_version: e.target.value })} /></label><label className="field"><span>religious_approved_at (ISO)</span><input type="datetime-local" value={form.religious_approved_at} onChange={(e) => setForm({ ...form, religious_approved_at: e.target.value })} /></label></div>
              <label className="field"><span>visual_restrictions (JSON array)</span><input value={form.visual_restrictions} onChange={(e) => setForm({ ...form, visual_restrictions: e.target.value })} placeholder='مثال: ["no_prophet_depiction"]' /></label>
            </fieldset>
          )}
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
