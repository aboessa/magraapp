import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { CategoryRecord, Planet } from '../types/api'

type EntityKind = 'planet' | 'category'
type TaxonomyForm = { name_ar: string; name_en: string; slug: string; description_ar: string; color_hex: string; sort_order: string }
const emptyForm: TaxonomyForm = { name_ar: '', name_en: '', slug: '', description_ar: '', color_hex: '#4ECDC4', sort_order: '0' }

const copy = {
  ar: { eyebrow: 'هيكل المحتوى', title: 'الكواكب والتصنيفات', intro: 'أنشئ مجالات التنقل والتصنيفات المرنة، واربط السلسلة بكوكب رئيسي وأكثر من تصنيف.', addPlanet: 'كوكب جديد', addCategory: 'تصنيف جديد', planets: 'الكواكب', categories: 'التصنيفات', series: 'سلسلة', assets: 'أصل', edit: 'تعديل', archive: 'أرشفة', createPlanet: 'إنشاء كوكب', editPlanet: 'تعديل الكوكب', createCategory: 'إنشاء تصنيف', editCategory: 'تعديل التصنيف', nameAr: 'الاسم بالعربية *', nameEn: 'الاسم بالإنجليزية', slug: 'المعرّف', description: 'الوصف', color: 'اللون', order: 'الترتيب', cancel: 'إلغاء', save: 'حفظ', required: 'الاسم بالعربية مطلوب.', loadError: 'تعذر تحميل الهيكل', saveError: 'تعذر حفظ العنصر', confirm: 'سيتم إخفاء العنصر من الاختيارات الجديدة دون حذف البيانات. متابعة؟' },
  en: { eyebrow: 'Content structure', title: 'Planets and taxonomy', intro: 'Create navigation domains and flexible categories, then link a series to a primary planet and multiple categories.', addPlanet: 'New planet', addCategory: 'New category', planets: 'Planets', categories: 'Categories', series: 'series', assets: 'assets', edit: 'Edit', archive: 'Archive', createPlanet: 'Create planet', editPlanet: 'Edit planet', createCategory: 'Create category', editCategory: 'Edit category', nameAr: 'Arabic name *', nameEn: 'English name', slug: 'Slug', description: 'Description', color: 'Color', order: 'Order', cancel: 'Cancel', save: 'Save', required: 'Arabic name is required.', loadError: 'Unable to load taxonomy', saveError: 'Unable to save item', confirm: 'This item will be hidden from new selections without deleting data. Continue?' },
}

export function TaxonomyPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [planets, setPlanets] = useState<Planet[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [kind, setKind] = useState<EntityKind>('planet')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TaxonomyForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [planetResponse, categoryResponse] = await Promise.all([api.cmsPlanets(true), api.categories(true)])
      setPlanets(planetResponse.data)
      setCategories(categoryResponse.data)
    } catch (caught) { setError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setLoading(false) }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  function openCreate(nextKind: EntityKind) {
    setKind(nextKind); setEditingId(null); setForm(emptyForm); setFormError(''); setModalOpen(true)
  }

  function openPlanet(item: Planet) {
    setKind('planet'); setEditingId(item.id); setForm({ name_ar: item.name_ar, name_en: item.name_en ?? '', slug: item.id, description_ar: item.description_ar ?? '', color_hex: item.color_hex, sort_order: String(item.sort_order) }); setFormError(''); setModalOpen(true)
  }

  function openCategory(item: CategoryRecord) {
    setKind('category'); setEditingId(item.id); setForm({ name_ar: item.name_ar, name_en: item.name_en ?? '', slug: item.slug, description_ar: item.description_ar ?? '', color_hex: item.color_hex, sort_order: String(item.sort_order) }); setFormError(''); setModalOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.name_ar.trim()) { setFormError(text.required); return }
    setSaving(true); setFormError('')
    const payload = { name_ar: form.name_ar.trim(), name_en: form.name_en.trim() || null, description_ar: form.description_ar.trim() || null, color_hex: form.color_hex, sort_order: Number(form.sort_order) || 0, ...(kind === 'category' ? { slug: form.slug.trim() || undefined } : {}) }
    try {
      if (kind === 'planet') {
        if (editingId) await api.updatePlanet(editingId, payload)
        else await api.createPlanet({ ...payload, id: form.slug.trim() || undefined })
      } else if (editingId) await api.updateCategory(editingId, payload)
      else await api.createCategory(payload)
      setModalOpen(false); await load()
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : text.saveError) }
    finally { setSaving(false) }
  }

  async function archive(nextKind: EntityKind, id: string) {
    if (!window.confirm(text.confirm)) return
    try { if (nextKind === 'planet') await api.archivePlanet(id); else await api.archiveCategory(id); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.saveError) }
  }

  if (loading && !planets.length && !categories.length) return <LoadingState label={text.loadError} />
  if (error && !planets.length && !categories.length) return <ErrorState message={error} onRetry={() => void load()} />

  return <div className="page-stack">
    <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.intro}</p></div><div className="page-intro__actions"><button className="button button--secondary" type="button" onClick={() => openCreate('category')}><Icon name="plus" size={17}/>{text.addCategory}</button><button className="button button--primary" type="button" onClick={() => openCreate('planet')}><Icon name="plus" size={17}/>{text.addPlanet}</button></div></section>
    {error && <div className="inline-alert inline-alert--error">{error}</div>}
    <section className="panel"><header className="panel__header"><div><span className="panel__kicker">{text.planets}</span><h3>{planets.length}</h3></div></header><div className="taxonomy-grid">{planets.map((item) => <article className={`taxonomy-card ${item.is_active === false ? 'taxonomy-card--inactive' : ''}`} key={item.id}><span className="taxonomy-card__orb" style={{ background: item.color_hex }}/><div><strong>{locale === 'en' ? item.name_en || item.name_ar : item.name_ar}</strong><small>{item.id}</small><p>{item.description_ar || '—'}</p><div className="taxonomy-card__meta"><span>{Number(item.series_count ?? 0)} {text.series}</span><span>{Number(item.assets_count ?? 0)} {text.assets}</span></div></div><div className="table-actions"><button className="icon-button icon-button--small" type="button" title={text.edit} onClick={() => openPlanet(item)}><Icon name="edit" size={15}/></button>{item.is_active !== false && <button className="icon-button icon-button--small icon-button--danger" type="button" title={text.archive} onClick={() => void archive('planet', item.id)}><Icon name="archive" size={15}/></button>}</div></article>)}</div></section>
    <section className="panel"><header className="panel__header"><div><span className="panel__kicker">{text.categories}</span><h3>{categories.length}</h3></div></header><div className="taxonomy-grid">{categories.map((item) => <article className={`taxonomy-card ${!item.is_active ? 'taxonomy-card--inactive' : ''}`} key={item.id}><span className="taxonomy-card__orb taxonomy-card__orb--square" style={{ background: item.color_hex }}/><div><strong>{locale === 'en' ? item.name_en || item.name_ar : item.name_ar}</strong><small>{item.slug}</small><p>{item.description_ar || '—'}</p><div className="taxonomy-card__meta"><span>{Number(item.series_count ?? 0)} {text.series}</span></div></div><div className="table-actions"><button className="icon-button icon-button--small" type="button" title={text.edit} onClick={() => openCategory(item)}><Icon name="edit" size={15}/></button>{item.is_active && <button className="icon-button icon-button--small icon-button--danger" type="button" title={text.archive} onClick={() => void archive('category', item.id)}><Icon name="archive" size={15}/></button>}</div></article>)}</div></section>

    <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editingId ? (kind === 'planet' ? text.editPlanet : text.editCategory) : (kind === 'planet' ? text.createPlanet : text.createCategory)}>
      <form className="entity-form" onSubmit={submit}>{formError && <div className="inline-alert inline-alert--error">{formError}</div>}<div className="form-grid"><label className="field"><span>{text.nameAr}</span><input autoFocus value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })}/></label><label className="field"><span>{text.nameEn}</span><input value={form.name_en} onChange={(event) => setForm({ ...form, name_en: event.target.value })}/></label></div><div className="form-grid form-grid--three"><label className="field"><span>{text.slug}</span><input value={form.slug} disabled={kind === 'planet' && Boolean(editingId)} onChange={(event) => setForm({ ...form, slug: event.target.value })}/></label><label className="field"><span>{text.color}</span><input type="color" value={form.color_hex} onChange={(event) => setForm({ ...form, color_hex: event.target.value })}/></label><label className="field"><span>{text.order}</span><input type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })}/></label></div><label className="field"><span>{text.description}</span><textarea rows={4} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })}/></label><div className="form-actions"><button className="button button--ghost" type="button" onClick={() => setModalOpen(false)}>{text.cancel}</button><button className="button button--primary" type="submit" disabled={saving}>{text.save}</button></div></form>
    </Modal>
  </div>
}
