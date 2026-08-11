import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { EntityThumbnail } from '../components/EntityThumbnail'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import { useUrlListState } from '../hooks/useUrlListState'
import { useQuickCreate } from '../hooks/useQuickCreate'
import type { CategoryRecord, Planet } from '../types/api'

/**
 * الكواكب والتصنيفات: البنية التي يُعلَّق عليها كل المحتوى.
 *
 * ## ما كان مكسورًا في هذه الشاشة
 *
 * ١. **حالة التحميل كانت تعرض نصّ الخطأ.** `LoadingState label={text.loadError}`
 *    فكان المستخدم يقرأ «تعذر تحميل الهيكل» أثناء نجاح التحميل. خطأ يظهر في كل
 *    زيارة ولا يُسقط شيئًا، فلا اختبار يرصده.
 * ٢. **البطاقات لم تكن قابلة للنقر.** بطاقة تقول «٧ سلاسل» ولا تفتحها هي رقم
 *    في لوح لا مدخل إلى عمل. الآن البطاقة كلها رابط: التصنيف يفتح سلاسله
 *    المفلترة، والكوكب يفتح مساحة عمله.
 * ٣. **الخطّ كان بين ٧٫٥px و٨٫٥px.** غير مقروء، وهو تعويض عن كثافة ضعيفة
 *    بتصغير الحرف لا بزيادة المعلومة.
 * ٤. **بلا حالة فراغ ولا بحث.** قائمة فارغة كانت شبكة فارغة بلا تفسير.
 * ٥. **قسم الكواكب كان يُكرّر الفهرس** بصورة أضعف: بلا صور حقيقية، بلا حالة
 *    إنتاج، بلا نقر. صار ملخّصًا يقود إلى الفهرس الحقيقي لا بديلًا عنه.
 *
 * ## لماذا التصنيف لا يملك مساحة عمل
 *
 * الكوكب مجال تنقّل يحمل سلاسل وحلقات ووسائط وحقوقًا، فله مساحة عمل. أمّا
 * التصنيف فصفٌّ في `categories` وعلاقة في `series_categories` — لا وسائط له ولا
 * إنتاج ولا لغات. فبناء «مساحة عمل تصنيف» كان سيُنتج تبويبات فارغة، والصادق أن
 * يفتح التصنيف سلاسله في شاشة السلاسل حيث تُدار فعلًا.
 */

type EntityKind = 'planet' | 'category'
type TaxonomyForm = {
  name_ar: string
  name_en: string
  slug: string
  description_ar: string
  color_hex: string
  sort_order: string
}

const emptyForm: TaxonomyForm = {
  name_ar: '', name_en: '', slug: '', description_ar: '', color_hex: '#4ECDC4', sort_order: '0',
}

const copy = {
  ar: {
    eyebrow: 'هيكل المحتوى',
    title: 'الكواكب والتصنيفات',
    intro: 'الكوكب مجال تنقّل تُبنى عليه السلاسل، والتصنيف وسم عابر للكواكب. هذه الشاشة تُظهر ما يحمله كل منهما وما ينقصه.',

    addPlanet: 'إضافة كوكب',
    addCategory: 'إضافة تصنيف',
    createDenied: 'الإنشاء يحتاج صلاحية الإنشاء.',
    editDenied: 'التعديل يحتاج صلاحية تعديل البيانات.',
    archiveDenied: 'التعطيل يحتاج صلاحية الأرشفة.',

    planets: 'الكواكب',
    categories: 'التصنيفات',
    openPlanets: 'فهرس الكواكب',
    planetsNote: 'ملخّص فقط. صحة الكوكب ووسائطه وإنتاجه في مساحة عمله.',
    categoriesNote: 'التصنيف وسم يجمع سلاسل من كواكب مختلفة، فلا وسائط له ولا إنتاج.',

    series: 'سلسلة',
    assets: 'أصل',
    noSeries: 'بلا سلاسل',
    noDescription: 'بلا وصف',
    active: 'نشط',
    inactive: 'معطَّل',
    openSeries: 'سلاسل هذا التصنيف',
    openWorkspace: 'مساحة عمل الكوكب',

    summaryPlanets: 'كوكب',
    summaryCategories: 'تصنيف',
    summaryUnused: 'تصنيف بلا سلاسل',
    summaryNoDescription: 'بلا وصف',
    summaryInactive: 'معطَّل',

    search: 'ابحث في الكواكب والتصنيفات...',
    usage: 'الاستخدام',
    usageAll: 'أي استخدام',
    usageUsed: 'مستخدَم',
    usageUnused: 'بلا سلاسل',
    state: 'الحالة',
    stateAll: 'كل الحالات',

    edit: 'تعديل',
    archive: 'تعطيل',
    loading: 'جارٍ تحميل الهيكل...',
    loadError: 'تعذر تحميل الهيكل',
    retry: 'إعادة المحاولة',
    denied: 'لا تملك صلاحية عرض هيكل المحتوى.',
    emptyCategories: 'لا تصنيفات بعد',
    emptyCategoriesDesc: 'أنشئ تصنيفًا ليصير وسمًا يمكن ربط السلاسل به.',
    noResults: 'لا عنصر يطابق هذه الفلترة',
    noResultsDesc: 'وسّع الفلترة أو امسحها.',
    clear: 'مسح الفلاتر',

    createPlanet: 'إنشاء كوكب',
    editPlanet: 'تعديل الكوكب',
    createCategory: 'إنشاء تصنيف',
    editCategory: 'تعديل التصنيف',
    nameAr: 'الاسم بالعربية *',
    nameEn: 'الاسم بالإنجليزية',
    slug: 'المعرّف',
    slugLocked: 'المعرّف لا يُغيَّر بعد الإنشاء: كل رابط ومرجع مبني عليه.',
    description: 'الوصف',
    color: 'اللون',
    order: 'الترتيب',
    cancel: 'إلغاء',
    save: 'حفظ',
    saving: 'جارٍ الحفظ...',
    required: 'الاسم بالعربية مطلوب.',
    saveError: 'تعذر حفظ العنصر',
    confirmCategory: (name: string, series: number) => series > 0
      ? `تعطيل «${name}» يخفيه من كل اختيار جديد. يحمل ${series} سلسلة تبقى كما هي بلا هذا الوسم. متابعة؟`
      : `تعطيل «${name}»؟ لا سلسلة مرتبطة به، ولن تُحذف البيانات.`,
  },
  en: {
    eyebrow: 'Content structure',
    title: 'Planets and categories',
    intro: 'A planet is a navigation domain that series are built on; a category is a tag that crosses planets. This screen shows what each carries and what it lacks.',

    addPlanet: 'Add planet',
    addCategory: 'Add category',
    createDenied: 'Creating needs the create permission.',
    editDenied: 'Editing needs the edit_metadata permission.',
    archiveDenied: 'Disabling needs the archive permission.',

    planets: 'Planets',
    categories: 'Categories',
    openPlanets: 'Planet index',
    planetsNote: 'A summary only. Planet health, media and production live in its workspace.',
    categoriesNote: 'A category tags series across planets, so it has no media and no production.',

    series: 'series',
    assets: 'assets',
    noSeries: 'No series',
    noDescription: 'No description',
    active: 'Active',
    inactive: 'Disabled',
    openSeries: 'Series in this category',
    openWorkspace: 'Planet workspace',

    summaryPlanets: 'planets',
    summaryCategories: 'categories',
    summaryUnused: 'categories with no series',
    summaryNoDescription: 'no description',
    summaryInactive: 'disabled',

    search: 'Search planets and categories...',
    usage: 'Usage',
    usageAll: 'Any usage',
    usageUsed: 'In use',
    usageUnused: 'No series',
    state: 'State',
    stateAll: 'All states',

    edit: 'Edit',
    archive: 'Disable',
    loading: 'Loading the structure...',
    loadError: 'Unable to load the structure',
    retry: 'Retry',
    denied: 'You do not have permission to view the content structure.',
    emptyCategories: 'No categories yet',
    emptyCategoriesDesc: 'Create a category to have a tag that series can be linked to.',
    noResults: 'Nothing matches this filter',
    noResultsDesc: 'Widen the filter or clear it.',
    clear: 'Clear filters',

    createPlanet: 'Create planet',
    editPlanet: 'Edit planet',
    createCategory: 'Create category',
    editCategory: 'Edit category',
    nameAr: 'Arabic name *',
    nameEn: 'English name',
    slug: 'Slug',
    slugLocked: 'The slug is fixed after creation: every link and reference is built on it.',
    description: 'Description',
    color: 'Colour',
    order: 'Order',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    required: 'The Arabic name is required.',
    saveError: 'Unable to save the item',
    confirmCategory: (name: string, series: number) => series > 0
      ? `Disabling “${name}” hides it from every new selection. It tags ${series} series, which stay as they are without this tag. Continue?`
      : `Disable “${name}”? No series is linked to it, and no data is deleted.`,
  },
}

/// مفاتيح الفلاتر في العنوان، فرابط «التصنيفات غير المستخدمة» قابل للمشاركة.
const DEFAULT_FILTERS = { usage: '', state: '' }

const FILTER_FIELDS = (text: typeof copy['ar']): FilterField[] => [
  {
    key: 'usage',
    label: text.usage,
    type: 'select',
    options: [
      { value: '', label: text.usageAll },
      { value: 'used', label: text.usageUsed },
      { value: 'unused', label: text.usageUnused },
    ],
  },
  {
    key: 'state',
    label: text.state,
    type: 'select',
    options: [
      { value: '', label: text.stateAll },
      { value: 'active', label: text.active },
      { value: 'inactive', label: text.inactive },
    ],
  },
]

export function TaxonomyPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const list = useUrlListState(DEFAULT_FILTERS, {})
  const { query, filters } = list

  const [planets, setPlanets] = useState<Planet[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [kind, setKind] = useState<EntityKind>('category')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TaxonomyForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = hasPermission('create')
  const canEdit = hasPermission('edit_metadata')
  const canArchive = hasPermission('archive')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // ‏`include_inactive` دائمًا: شاشة إدارية تُظهر المعطَّل، والفلتر هو ما
      // يضيّق لا الإخفاء الضمني.
      const [planetResponse, categoryResponse] = await Promise.all([
        api.cmsPlanets(true),
        api.categories(true),
      ])
      setPlanets(planetResponse.data)
      setCategories(categoryResponse.data)
      setDenied(false)
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) {
        setDenied(true)
        setError(caught.message)
      } else {
        setError(caught instanceof Error ? caught.message : text.loadError)
      }
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  useQuickCreate(() => openCreate('category'))

  const seriesOf = (item: CategoryRecord | Planet) => Number(item.series_count ?? 0)

  /// الفلترة والبحث محليًّا هنا بقصد: النقطتان لا تقبلان `q` ولا فلاتر، والمجموعة
  /// كلها تُقرأ في نداءين بلا ترقيم (تسعة كواكب وعشرات التصنيفات). فلترة في
  /// المتصفح على مجموعة محمَّلة بالكامل ليست فلترة كاذبة — الكاذبة هي التي تدّعي
  /// تضييق مجموعة مُقسَّمة إلى صفحات.
  const needle = query.trim().toLowerCase()
  const matches = (name: string, second: string | null | undefined, id: string) =>
    !needle || [name, second, id].some((value) => typeof value === 'string' && value.toLowerCase().includes(needle))

  const visiblePlanets = useMemo(() => planets.filter((item) => {
    if (!matches(item.name_ar, item.name_en, item.id)) return false
    if (filters.state === 'active' && item.is_active === false) return false
    if (filters.state === 'inactive' && item.is_active !== false) return false
    if (filters.usage === 'used' && seriesOf(item) === 0) return false
    if (filters.usage === 'unused' && seriesOf(item) > 0) return false
    return true
  }), [planets, needle, filters.state, filters.usage])

  const visibleCategories = useMemo(() => categories.filter((item) => {
    if (!matches(item.name_ar, item.name_en, item.slug)) return false
    if (filters.state === 'active' && !item.is_active) return false
    if (filters.state === 'inactive' && item.is_active) return false
    if (filters.usage === 'used' && seriesOf(item) === 0) return false
    if (filters.usage === 'unused' && seriesOf(item) > 0) return false
    return true
  }), [categories, needle, filters.state, filters.usage])

  /// الملخّص يصف المجموعة كلها لا المفلترة: ملخّص يتحرّك بالفلترة لا يمكن أن
  /// يُستعمل لاختيار الفلترة.
  const summary = useMemo(() => ({
    planets: planets.length,
    categories: categories.length,
    unused: categories.filter((item) => seriesOf(item) === 0).length,
    noDescription: categories.filter((item) => !item.description_ar?.trim()).length,
    inactive: categories.filter((item) => !item.is_active).length,
  }), [planets, categories])

  function openCreate(nextKind: EntityKind) {
    setKind(nextKind)
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openPlanet(item: Planet) {
    setKind('planet')
    setEditingId(item.id)
    setForm({
      name_ar: item.name_ar,
      name_en: item.name_en ?? '',
      slug: item.id,
      description_ar: item.description_ar ?? '',
      color_hex: item.color_hex,
      sort_order: String(item.sort_order),
    })
    setFormError('')
    setModalOpen(true)
  }

  function openCategory(item: CategoryRecord) {
    setKind('category')
    setEditingId(item.id)
    setForm({
      name_ar: item.name_ar,
      name_en: item.name_en ?? '',
      slug: item.slug,
      description_ar: item.description_ar ?? '',
      color_hex: item.color_hex,
      sort_order: String(item.sort_order),
    })
    setFormError('')
    setModalOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.name_ar.trim()) { setFormError(text.required); return }
    setSaving(true)
    setFormError('')
    const payload = {
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim() || null,
      description_ar: form.description_ar.trim() || null,
      color_hex: form.color_hex,
      sort_order: Number(form.sort_order) || 0,
      ...(kind === 'category' ? { slug: form.slug.trim() || undefined } : {}),
    }
    try {
      if (kind === 'planet') {
        if (editingId) await api.updatePlanet(editingId, payload)
        else await api.createPlanet({ ...payload, id: form.slug.trim() || undefined })
      } else if (editingId) await api.updateCategory(editingId, payload)
      else await api.createCategory(payload)
      setModalOpen(false)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  /// التعطيل يقول عدد السلاسل المرتبطة قبل التنفيذ. تصنيف يحمل سلاسل يُعطَّل بلا
  /// إخبار يجعل المشغّل يزيل وسمًا من محتوى منشور وهو يظن أنه ينظّف قائمة.
  async function archiveCategory(item: CategoryRecord) {
    const name = locale === 'en' ? item.name_en || item.name_ar : item.name_ar
    if (!window.confirm(text.confirmCategory(name, seriesOf(item)))) return
    try {
      await api.archiveCategory(item.id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.saveError)
    }
  }

  const filtersActive = list.activeFilterCount > 0 || !!needle

  if (denied) {
    return (
      <div className="page-stack">
        <ErrorState message={error || text.denied} />
      </div>
    )
  }

  if (loading && !planets.length && !categories.length) {
    return (
      <div className="page-stack">
        {/* التسمية هي نصّ التحميل لا نصّ الخطأ. كانت `text.loadError`، فكان
            المستخدم يقرأ «تعذر تحميل الهيكل» في كل زيارة ناجحة. */}
        <p className="planet-loading" role="status" aria-live="polite">{text.loading}</p>
        <div className="taxonomy-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="taxonomy-card taxonomy-card--skeleton" key={index} aria-hidden="true">
              <span className="skeleton-line skeleton-line--orb" />
              <span className="skeleton-line skeleton-line--title" />
              <span className="skeleton-line" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error && !planets.length && !categories.length) {
    return (
      <div className="page-stack">
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <div className="page-intro__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={() => openCreate('category')}
            disabled={!canCreate}
            title={canCreate ? undefined : text.createDenied}
          ><Icon name="plus" size={17} />{text.addCategory}</button>
          <button
            className="button button--primary"
            type="button"
            onClick={() => openCreate('planet')}
            disabled={!canCreate}
            title={canCreate ? undefined : text.createDenied}
          ><Icon name="plus" size={17} />{text.addPlanet}</button>
        </div>
      </section>

      {/* كل خلية ملخّص تُطبِّق الفلترة التي تُنتج رقمها، فالرقم مدخل إلى العمل
          لا إحصاء يُقرأ ويُنسى. المجموع لا يُطبِّق شيئًا: لا فلتر يُعيد إنتاجه. */}
      <section className="planet-summary" aria-label={text.title}>
        <div className="planet-summary__cell">
          <strong>{formatNumber(summary.planets, locale)}</strong>
          <span>{text.summaryPlanets}</span>
        </div>
        <div className="planet-summary__cell">
          <strong>{formatNumber(summary.categories, locale)}</strong>
          <span>{text.summaryCategories}</span>
        </div>
        <button
          type="button"
          className={`planet-summary__cell planet-summary__cell--button ${summary.unused ? 'planet-summary__cell--warn' : ''}`}
          onClick={() => list.setFilters({ usage: 'unused', state: '' })}
        >
          <strong>{formatNumber(summary.unused, locale)}</strong>
          <span>{text.summaryUnused}</span>
        </button>
        <div className={`planet-summary__cell ${summary.noDescription ? 'planet-summary__cell--warn' : ''}`}>
          <strong>{formatNumber(summary.noDescription, locale)}</strong>
          <span>{text.summaryNoDescription}</span>
        </div>
        <button
          type="button"
          className="planet-summary__cell planet-summary__cell--button"
          onClick={() => list.setFilters({ state: 'inactive', usage: '' })}
        >
          <strong>{formatNumber(summary.inactive, locale)}</strong>
          <span>{text.summaryInactive}</span>
        </button>
      </section>

      {error && <div className="inline-alert inline-alert--error" role="alert">{error}</div>}

      <ListToolbar
        searchValue={query}
        onSearchChange={list.setQuery}
        searchPlaceholder={text.search}
        fields={FILTER_FIELDS(text)}
        values={filters}
        defaults={DEFAULT_FILTERS}
        onApply={(next) => list.setFilters(next)}
        onClear={list.clearFilters}
        onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')}
      />

      <section className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__kicker">{text.planets}</span>
            <h3>{formatNumber(visiblePlanets.length, locale)}</h3>
            <p className="panel__note">{text.planetsNote}</p>
          </div>
          <Link className="button button--ghost" to={adminPath('planets')}>
            <Icon name="planets" size={16} />{text.openPlanets}
          </Link>
        </header>
        <div className="panel__body">
          {visiblePlanets.length === 0 ? (
            <EmptyState
              title={text.noResults}
              description={text.noResultsDesc}
              action={filtersActive
                ? <button className="button button--ghost" type="button" onClick={() => { list.clearFilters(); list.setQuery('') }}>{text.clear}</button>
                : undefined}
            />
          ) : (
            <div className="taxonomy-grid" role="list">
              {visiblePlanets.map((item) => {
                const name = locale === 'en' ? item.name_en || item.name_ar : item.name_ar
                return (
                  <article
                    className={`taxonomy-card ${item.is_active === false ? 'taxonomy-card--inactive' : ''}`}
                    key={item.id}
                    role="listitem"
                    style={{ ['--planet-colour' as string]: item.color_hex }}
                  >
                    <EntityThumbnail src={item.icon_url} alt="" label={name} color={item.color_hex} icon="planets" />
                    <div className="taxonomy-card__body">
                      {/* الاسم هو الرابط، والبطاقة كلها منطقة نقر عبر ::after. */}
                      <strong>
                        <Link className="taxonomy-card__link" to={adminPath(`planets/${item.id}`)}>{name}</Link>
                      </strong>
                      <small dir="ltr">{item.id}</small>
                      <p>{item.description_ar?.trim() || text.noDescription}</p>
                      <div className="taxonomy-card__meta">
                        <span>{formatNumber(seriesOf(item), locale)} {text.series}</span>
                        <span>{formatNumber(Number(item.assets_count ?? 0), locale)} {text.assets}</span>
                        {item.is_active === false && <span className="taxonomy-card__state">{text.inactive}</span>}
                      </div>
                    </div>
                    <div className="table-actions taxonomy-card__actions">
                      <button
                        className="icon-button icon-button--small"
                        type="button"
                        aria-label={`${text.edit}: ${name}`}
                        title={canEdit ? text.edit : text.editDenied}
                        disabled={!canEdit}
                        onClick={() => openPlanet(item)}
                      ><Icon name="edit" size={15} /></button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__kicker">{text.categories}</span>
            <h3>{formatNumber(visibleCategories.length, locale)}</h3>
            <p className="panel__note">{text.categoriesNote}</p>
          </div>
        </header>
        <div className="panel__body">
          {visibleCategories.length === 0 ? (
            <EmptyState
              title={filtersActive ? text.noResults : text.emptyCategories}
              description={filtersActive ? text.noResultsDesc : text.emptyCategoriesDesc}
              action={filtersActive
                ? <button className="button button--ghost" type="button" onClick={() => { list.clearFilters(); list.setQuery('') }}>{text.clear}</button>
                : canCreate
                  ? <button className="button button--primary" type="button" onClick={() => openCreate('category')}><Icon name="plus" size={16} />{text.addCategory}</button>
                  : undefined}
            />
          ) : (
            <div className="taxonomy-grid" role="list">
              {visibleCategories.map((item) => {
                const name = locale === 'en' ? item.name_en || item.name_ar : item.name_ar
                const count = seriesOf(item)
                return (
                  <article
                    className={`taxonomy-card ${!item.is_active ? 'taxonomy-card--inactive' : ''}`}
                    key={item.id}
                    role="listitem"
                    style={{ ['--planet-colour' as string]: item.color_hex }}
                  >
                    <span className="taxonomy-card__orb taxonomy-card__orb--square" style={{ background: item.color_hex }} />
                    <div className="taxonomy-card__body">
                      {/* التصنيف يفتح سلاسله المفلترة: `GET /admin/series` يقبل
                          `category` بعد إضافته، فالرقم على البطاقة والقائمة التي
                          يفتحها يتّفقان. */}
                      <strong>
                        <Link
                          className="taxonomy-card__link"
                          to={adminPath(`series?category=${encodeURIComponent(item.id)}`)}
                          title={text.openSeries}
                        >{name}</Link>
                      </strong>
                      <small dir="ltr">{item.slug}</small>
                      <p>{item.description_ar?.trim() || text.noDescription}</p>
                      <div className="taxonomy-card__meta">
                        <span className={count === 0 ? 'taxonomy-card__meta--warn' : undefined}>
                          {count === 0 ? text.noSeries : `${formatNumber(count, locale)} ${text.series}`}
                        </span>
                        {!item.is_active && <span className="taxonomy-card__state">{text.inactive}</span>}
                      </div>
                    </div>
                    <div className="table-actions taxonomy-card__actions">
                      <button
                        className="icon-button icon-button--small"
                        type="button"
                        aria-label={`${text.edit}: ${name}`}
                        title={canEdit ? text.edit : text.editDenied}
                        disabled={!canEdit}
                        onClick={() => openCategory(item)}
                      ><Icon name="edit" size={15} /></button>
                      {item.is_active && (
                        <button
                          className="icon-button icon-button--small icon-button--danger"
                          type="button"
                          aria-label={`${text.archive}: ${name}`}
                          title={canArchive ? text.archive : text.archiveDenied}
                          disabled={!canArchive}
                          onClick={() => void archiveCategory(item)}
                        ><Icon name="archive" size={15} /></button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId
          ? (kind === 'planet' ? text.editPlanet : text.editCategory)
          : (kind === 'planet' ? text.createPlanet : text.createCategory)}
      >
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error" role="alert">{formError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>{text.nameAr}</span>
              <input autoFocus value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })} />
            </label>
            <label className="field">
              <span>{text.nameEn}</span>
              <input value={form.name_en} onChange={(event) => setForm({ ...form, name_en: event.target.value })} />
            </label>
          </div>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.slug}</span>
              <input
                dir="ltr"
                value={form.slug}
                disabled={Boolean(editingId)}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
              />
              {Boolean(editingId) && <small>{text.slugLocked}</small>}
            </label>
            <label className="field">
              <span>{text.color}</span>
              <input type="color" value={form.color_hex} onChange={(event) => setForm({ ...form, color_hex: event.target.value })} />
            </label>
            <label className="field">
              <span>{text.order}</span>
              <input type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>{text.description}</span>
            <textarea rows={4} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })} />
          </label>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setModalOpen(false)} disabled={saving}>{text.cancel}</button>
            <button className="button button--primary" type="submit" disabled={saving}>{saving ? text.saving : text.save}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
