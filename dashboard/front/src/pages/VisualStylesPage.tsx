import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { ViewSwitcher, useStoredViewMode } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import { useUrlListState } from '../hooks/useUrlListState'
import type { AgeTrack, SeriesRecord, VisualStyleRecord } from '../types/api'
import { familyOf, familyLabels, type StyleFamily } from '../lib/visualStyleFamilies'
import { StylePreview } from '../components/visualStyles/StylePreview'

type Medium = VisualStyleRecord['medium']
type Form = { name_ar: string; name_en: string; slug: string; medium: Medium; description_ar: string; prompt_fragment: string; negative_prompt: string; production_level: SeriesRecord['production_level']; age_tracks: AgeTrack[]; source_reference: string }
const initial: Form = { name_ar: '', name_en: '', slug: '', medium: '2d', description_ar: '', prompt_fragment: '', negative_prompt: '', production_level: 'motion_story', age_tracks: ['preschool', 'kids', 'junior'], source_reference: 'Majarra CMS' }
const media: Medium[] = ['2d', '3d', 'mixed', 'stop_motion', 'live', 'graphic']
const productions: SeriesRecord['production_level'][] = ['motion_story', 'limited_2d', 'full_2d', 'live', 'stylized_3d']
const tracks: AgeTrack[] = ['preschool', 'kids', 'junior']

const families: StyleFamily[] = ['soft2d', 'adventure', 'storybook', 'learning', 'premium3d', 'special']

const copy = {
  ar: {
    eyebrow: 'مكتبة الإنتاج — الاستايلات البصرية الفاخرة',
    title: 'استوديو الاستايلات البصرية',
    intro: 'الهوية البصرية الموحدة لمنظومة مجرة: كل استايل يمثل ميثاقاً فنياً متكاملاً للإضاءة والألوان والتوليد واستمرارية شخصيات السلاسل.',
    create: 'استايل جديد',
    createDenied: 'الإنشاء يحتاج صلاحية المشرف.',
    editDenied: 'التعديل يحتاج صلاحية.',
    archiveDenied: 'الأرشفة تحتاج صلاحية.',
    search: 'بحث بالاسم العربي أو الإنجليزي أو المعرف...',
    family: 'العائلة البصرية',
    medium: 'الوسيط الفني',
    status: 'الحالة',
    age: 'الفئة العمرية',
    usage: 'الاستخدام',
    all: 'الكل',
    allFamilies: 'جميع العائلات البصرية',
    active: 'نشط ومعتمد',
    archived: 'مؤرشف',
    approved: 'معتمد',
    deprecated: 'مهمل',
    total: 'إجمالي الاستايلات',
    activeStyles: 'استايلات معتمدة',
    familiesCount: 'عائلات التصميم',
    totalUsage: 'استخدامات الإنتاج',
    colStyle: 'الاستايل',
    colFamily: 'العائلة',
    colMedium: 'النوع',
    colAge: 'العمر',
    colUsage: 'الاستخدام',
    colStatus: 'الحالة',
    colUpdated: 'آخر تعديل',
    openWorkspace: 'مساحة العمل',
    actions: 'إجراءات',
    edit: 'تعديل',
    duplicate: 'تكرار',
    archive: 'إخفاء',
    compare: 'مقارنة',
    compareHint: 'اختر 2–4 استايلات للمقارنة المباشرة',
    compareGo: 'قارن الاستايلات المحددة',
    doDont: 'محددات وقواعد',
    generation: 'عقد التوليد',
    usageCount: (n: number) => `${n} استخدام`,
    empty: 'لا توجد استايلات مسجلة',
    noMatch: 'لا توجد نتائج مطابقة لبحثك',
    clear: 'مسح الفلاتر',
    loading: 'جارٍ تحميل الاستايلات البصرية...',
    loadError: 'تعذر تحميل الاستايلات',
    islamicNote: 'تنبيه الحوكمة: المحتوى الإسلامي له حوكمة منفصلة — لا يطبق عليه استايل مجسم تلقائياً.',
    classDefaultWarn: 'تنبيه: class-default ليس تعريف هوية — يحوّل إلى Majarra House Style.',
    saveStyle: 'حفظ الاستايل',
    saving: 'جارٍ الحفظ...',
  },
  en: {
    eyebrow: 'Production Library — Visual Styles Studio',
    title: 'Visual Styles Studio',
    intro: 'Unified visual art bible: every style acts as a visual contract for lighting, colors, generation prompts, and character continuity across all series.',
    create: 'New Style',
    createDenied: 'Creation requires admin permissions.',
    editDenied: 'Editing requires permission.',
    archiveDenied: 'Archiving requires permission.',
    search: 'Search by Arabic, English name or slug...',
    family: 'Style Family',
    medium: 'Medium',
    status: 'Status',
    age: 'Age',
    usage: 'Usage',
    all: 'All',
    allFamilies: 'All Families',
    active: 'Active & Approved',
    archived: 'Archived',
    approved: 'Approved',
    deprecated: 'Deprecated',
    total: 'Total Styles',
    activeStyles: 'Approved Styles',
    familiesCount: 'Design Families',
    totalUsage: 'Production Usages',
    colStyle: 'Style',
    colFamily: 'Family',
    colMedium: 'Medium',
    colAge: 'Age',
    colUsage: 'Usage',
    colStatus: 'Status',
    colUpdated: 'Updated',
    openWorkspace: 'Workspace',
    actions: 'Actions',
    edit: 'Edit',
    duplicate: 'Duplicate',
    archive: 'Archive',
    compare: 'Compare',
    compareHint: 'Select 2–4 styles to compare',
    compareGo: 'Compare selected',
    doDont: 'Do / Don’t',
    generation: 'Prompt Contract',
    usageCount: (n: number) => `${n} uses`,
    empty: 'No styles recorded',
    noMatch: 'No matching styles found',
    clear: 'Clear filters',
    loading: 'Loading visual styles...',
    loadError: 'Unable to load styles',
    islamicNote: 'Governance note: Islamic content follows separate guidelines — 3D figurative styles are not auto-applied.',
    classDefaultWarn: 'Warning: class-default is not an identity definition — fallback to Majarra House Style.',
    saveStyle: 'Save Style',
    saving: 'Saving...',
  },
}

const DEFAULT_FILTERS = { family: '', medium: '', status: '', age: '' }
const COLUMNS: ColumnDefinition[] = [
  { key: 'style', label: 'colStyle', locked: true },
  { key: 'family', label: 'colFamily' },
  { key: 'medium', label: 'colMedium' },
  { key: 'age', label: 'colAge' },
  { key: 'usage', label: 'colUsage' },
  { key: 'status', label: 'colStatus' },
]

export function VisualStylesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { defaultView: 'grid' })
  const columns = useColumnPreferences('visual-styles', COLUMNS)
  const [storedView, setStoredView] = useStoredViewMode('visual-styles', 'grid')
  const view: ViewMode = list.rawView === 'grid' || list.rawView === 'table' ? list.rawView : storedView === 'grid' ? 'grid' : 'table'
  const setView = (m: ViewMode) => { setStoredView(m); list.setView(m) }

  const [items, setItems] = useState<VisualStyleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VisualStyleRecord | null>(null)
  const [form, setForm] = useState<Form>(initial)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const canCreate = hasPermission('create')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.visualStyles(true)
      setItems(res.data)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    return items.filter((s) => {
      if (list.query) {
        const q = list.query.toLowerCase()
        if (!`${s.name_ar} ${s.name_en} ${s.slug}`.toLowerCase().includes(q)) return false
      }
      if (list.filters.family && familyOf(s) !== list.filters.family) return false
      if (list.filters.medium && s.medium !== list.filters.medium) return false
      if (list.filters.status === 'active' && !s.is_active) return false
      if (list.filters.status === 'archived' && s.is_active) return false
      if (list.filters.age && !s.age_tracks.includes(list.filters.age as AgeTrack)) return false
      return true
    })
  }, [items, list.query, list.filters])

  const summary = useMemo(() => {
    const total = items.length
    const active = items.filter((s) => s.is_active).length
    const usages = items.reduce((acc, curr) => acc + Number(curr.series_count ?? 0) + Number(curr.stories_count ?? 0), 0)
    return { total, active, usages, familiesCount: families.length }
  }, [items])

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else if (next.size < 4) next.add(id)
    setSelected(next)
  }

  function create() {
    setEditing(null)
    setForm(initial)
    setOpen(true)
  }

  function edit(item: VisualStyleRecord) {
    setEditing(item)
    setForm({
      name_ar: item.name_ar,
      name_en: item.name_en,
      slug: item.slug,
      medium: item.medium,
      description_ar: item.description_ar ?? '',
      prompt_fragment: item.prompt_fragment,
      negative_prompt: item.negative_prompt ?? '',
      production_level: item.production_level,
      age_tracks: item.age_tracks,
      source_reference: item.source_reference ?? '',
    })
    setOpen(true)
  }

  function toggleTrack(t: AgeTrack) {
    setForm({
      ...form,
      age_tracks: form.age_tracks.includes(t) ? form.age_tracks.filter((x) => x !== t) : [...form.age_tracks, t],
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name_ar.trim() || !form.name_en.trim() || !form.prompt_fragment.trim() || !form.age_tracks.length) return
    setSaving(true)
    try {
      if (editing) await api.updateVisualStyle(editing.id, form as any)
      else await api.createVisualStyle(form as any)
      setOpen(false)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  async function duplicate(item: VisualStyleRecord) {
    setEditing(null)
    setForm({
      name_ar: `${item.name_ar} — نسخة`,
      name_en: `${item.name_en} copy`,
      slug: `${item.slug}-copy`,
      medium: item.medium,
      description_ar: item.description_ar ?? '',
      prompt_fragment: item.prompt_fragment,
      negative_prompt: item.negative_prompt ?? '',
      production_level: item.production_level,
      age_tracks: item.age_tracks,
      source_reference: item.source_reference ?? '',
    })
    setOpen(true)
  }

  const fields: FilterField[] = [
    { key: 'family', label: text.family, type: 'select', options: [{ value: '', label: text.all }, ...families.map((f) => ({ value: f, label: (familyLabels as any)[locale][f] }))] },
    { key: 'medium', label: text.medium, type: 'select', options: [{ value: '', label: text.all }, ...media.map((m) => ({ value: m, label: m }))] },
    { key: 'status', label: text.status, type: 'select', options: [{ value: '', label: text.all }, { value: 'active', label: text.active }, { value: 'archived', label: text.archived }] },
    { key: 'age', label: text.age, type: 'select', advanced: true, options: [{ value: '', label: text.all }, ...tracks.map((t) => ({ value: t, label: t }))] },
  ]

  const grid = (
    <div className="vs-studio-grid" role="list" aria-label={text.title}>
      {filtered.map((item) => {
        const fam = familyOf(item)
        const usage = Number(item.series_count ?? 0) + Number(item.stories_count ?? 0)
        const checked = selected.has(item.id)
        return (
          <article
            key={item.id}
            className={`vs-card-item ${checked ? 'vs-card-item--selected' : ''}`}
            role="listitem"
            aria-selected={checked}
          >
            <div className="vs-card-item__preview-wrapper">
              <StylePreview style={item} size="card" />
              <span className={`vs-family-badge vs-family--${fam}`}>
                {(familyLabels as any)[locale][fam]}
              </span>
              <span className="book-pages-pill" style={{ bottom: 10, insetInlineStart: 10, insetInlineEnd: 'auto' }}>
                {item.medium}
              </span>
            </div>

            <div className="vs-card-item__body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Link to={adminPath(`visual-styles/${item.id}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h3 className="vs-card-item__title">{locale === 'ar' ? item.name_ar : item.name_en}</h3>
                </Link>
                <StatusBadge status={item.is_active ? 'published' : 'archived'} />
              </div>

              <div className="vs-card-item__slug">{item.slug} · {item.production_level}</div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
                <span className="character-trait-pill">{item.age_tracks.join(' · ')}</span>
                <span className="character-trait-pill">⭐ {text.usageCount(usage)}</span>
              </div>
            </div>

            <footer className="vs-card-item__foot">
              <label className="checkbox" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                <input type="checkbox" checked={checked} onChange={() => toggleSelect(item.id)} />
                {text.compare}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="button button--ghost button--small" type="button" onClick={() => duplicate(item)} title={text.duplicate}>
                  <Icon name="copy" size={13} />
                </button>
                <button className="button button--ghost button--small" type="button" onClick={() => edit(item)} title={text.edit}>
                  <Icon name="edit" size={13} />
                </button>
                <Link className="button button--primary button--small" to={adminPath(`visual-styles/${item.id}`)}>
                  {text.openWorkspace}
                </Link>
              </div>
            </footer>
          </article>
        )
      })}
    </div>
  )

  const table = (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table data-table--wide">
        <thead>
          <tr>
            <th style={{ width: 40 }}><input type="checkbox" aria-label={text.compare} disabled /></th>
            <th>{text.colStyle}</th>
            {columns.isVisible('family') && <th>{text.colFamily}</th>}
            {columns.isVisible('medium') && <th>{text.colMedium}</th>}
            {columns.isVisible('age') && <th>{text.colAge}</th>}
            {columns.isVisible('usage') && <th>{text.colUsage}</th>}
            {columns.isVisible('status') && <th>{text.colStatus}</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <tr key={item.id} className={!item.is_active ? 'vs-row--inactive' : ''}>
              <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>
              <td>
                <Link className="entity-cell entity-cell--button" to={adminPath(`visual-styles/${item.id}`)}>
                  <div style={{ width: 48, height: 36, borderRadius: 8, overflow: 'hidden', background: '#0b0f19' }}>
                    <StylePreview style={item} />
                  </div>
                  <div>
                    <strong>{locale === 'ar' ? item.name_ar : item.name_en}</strong>
                    <small dir="ltr">{item.slug}</small>
                  </div>
                </Link>
              </td>
              {columns.isVisible('family') && <td>{(familyLabels as any)[locale][familyOf(item)]}</td>}
              {columns.isVisible('medium') && <td>{item.medium}</td>}
              {columns.isVisible('age') && <td>{item.age_tracks.join(', ')}</td>}
              {columns.isVisible('usage') && <td>{Number(item.series_count ?? 0) + Number(item.stories_count ?? 0)}</td>}
              {columns.isVisible('status') && <td><StatusBadge status={item.is_active ? 'published' : 'archived'} /></td>}
              <td>
                <Link className="button button--ghost button--small" to={adminPath(`visual-styles/${item.id}`)}>
                  {text.openWorkspace}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="page-stack">
      {/* 1. PANORAMIC HERO HEADER */}
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
          <p className="panel__note" style={{ marginTop: 8 }}>{text.islamicNote}</p>
          {filtered.some((s) => s.slug === 'class-default') && (
            <div className="inline-alert inline-alert--warning" style={{ marginTop: 8 }}>
              {text.classDefaultWarn}
            </div>
          )}
        </div>
        <div className="page-intro__actions">
          {selected.size >= 2 && (
            <button
              className="button button--secondary"
              onClick={() => navigate(`${adminPath('visual-styles/compare')}?ids=${Array.from(selected).join(',')}`)}
            >
              <Icon name="eye" size={15} />
              {text.compareGo} ({selected.size})
            </button>
          )}
          <button
            className="button button--primary"
            type="button"
            disabled={!canCreate}
            title={!canCreate ? text.createDenied : undefined}
            onClick={create}
          >
            <Icon name="plus" size={17} />
            {text.create}
          </button>
        </div>
      </section>

      {/* 2. LIVE BENTO KPI METRICS */}
      <section className="hero-kpis" aria-label={text.title}>
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.total}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="media" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.total, locale)}</div>
          <div className="kpi-glass-card__caption">استايلات بصرية موثقة</div>
        </div>

        <div
          className="kpi-glass-card kpi-glass-card--success"
          style={{ cursor: 'pointer' }}
          onClick={() => list.setFilter('status', list.filters.status === 'active' ? '' : 'active')}
        >
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.activeStyles}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="check" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.active, locale)}</div>
          <div className="kpi-glass-card__caption">معتمدة وقيد الإنتاج</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.familiesCount}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="layers" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{summary.familiesCount}</div>
          <div className="kpi-glass-card__caption">عائلات هوية متميزة</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.totalUsage}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="books" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.usages, locale)}</div>
          <div className="kpi-glass-card__caption">في السلاسل والقصص</div>
        </div>
      </section>

      {/* 3. QUICK FAMILY FILTER STRIP */}
      <section className="catalog-control-strip">
        <button
          type="button"
          className={`filter-pill ${!list.filters.family ? 'active' : ''}`}
          onClick={() => list.setFilter('family', '')}
        >
          🎨 {text.allFamilies} ({filtered.length})
        </button>
        {families.map((f) => (
          <button
            key={f}
            type="button"
            className={`filter-pill ${list.filters.family === f ? 'active' : ''}`}
            onClick={() => list.setFilter('family', list.filters.family === f ? '' : f)}
          >
            {(familyLabels as any)[locale][f]}
          </button>
        ))}
      </section>

      {/* 4. MAIN PANEL */}
      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{text.title}</span>
            <h3>{formatNumber(filtered.length, locale)}</h3>
          </div>
          <ListToolbar
            searchValue={list.query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={fields}
            values={list.filters}
            defaults={DEFAULT_FILTERS}
            onApply={(n) => list.setFilters(n)}
            onClear={list.clearFilters}
            onRemove={(k) => list.setFilter(k as any, '')}
            trailing={
              <>
                <SavedViewsMenu storageKey="visual-styles" currentSearch={list.search} onApply={(s) => navigate(`${adminPath('visual-styles')}${s}`)} />
                {view === 'table' && (
                  <ColumnManager
                    columns={COLUMNS.map((c) => ({ ...c, label: (text as any)[c.label] || c.label }))}
                    hidden={columns.hidden}
                    onToggle={columns.toggle}
                    onReset={columns.reset}
                  />
                )}
                <ViewSwitcher value={view} onChange={setView} modes={['grid', 'table']} locale={locale} />
              </>
            }
          />
        </header>

        {loading ? (
          <LoadingState label={text.loading} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={list.query || list.activeFilterCount ? text.noMatch : text.empty}
            description=""
            action={
              list.activeFilterCount ? (
                <button className="button button--ghost" onClick={() => { list.clearFilters(); list.setQuery('') }}>
                  {text.clear}
                </button>
              ) : undefined
            }
          />
        ) : view === 'grid' ? (
          grid
        ) : (
          table
        )}

        {selected.size > 0 && (
          <div className="inline-alert inline-alert--info" style={{ margin: 16 }}>
            {text.compareHint}: {selected.size}/4
          </div>
        )}
      </section>

      {/* 5. ADD / EDIT VISUAL STYLE LIQUID GLASS MODAL */}
      <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? (locale === 'ar' ? 'تعديل الاستايل البصري' : 'Edit Style') : (locale === 'ar' ? 'استايل بصري جديد' : 'New Visual Style')}>
        <form className="entity-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>الاسم بالعربية *</span>
              <input value={form.name_ar} required onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            </label>
            <label className="field">
              <span>English Name *</span>
              <input value={form.name_en} required onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </label>
          </div>

          <div className="form-grid form-grid--three">
            <label className="field">
              <span>Slug (المعرف)</span>
              <input dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </label>
            <label className="field">
              <span>Medium (الوسيط)</span>
              <select value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value as Medium })}>
                {media.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Production Level</span>
              <select value={form.production_level} onChange={(e) => setForm({ ...form, production_level: e.target.value as any })}>
                {productions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Prompt fragment (عقد التوليد الأساسي) *</span>
            <textarea rows={4} dir="ltr" required value={form.prompt_fragment} onChange={(e) => setForm({ ...form, prompt_fragment: e.target.value })} />
          </label>

          <label className="field">
            <span>Negative prompt (المحددات السلبية)</span>
            <textarea rows={2} dir="ltr" value={form.negative_prompt} onChange={(e) => setForm({ ...form, negative_prompt: e.target.value })} />
          </label>

          <div className="field">
            <span>Age tracks (الفئات العمرية)</span>
            <div className="checkbox-row" style={{ display: 'flex', gap: 14, marginTop: 6 }}>
              {tracks.map((t) => (
                <label key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.age_tracks.includes(t)} onChange={() => toggleTrack(t)} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setOpen(false)}>
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="button button--primary" type="submit" disabled={saving}>
              <Icon name="check" size={16} />
              {saving ? text.saving : text.saveStyle}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
