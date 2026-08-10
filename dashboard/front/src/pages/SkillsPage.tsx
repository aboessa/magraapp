import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { formatNumber } from '../lib/labels'
import type { SkillRecord } from '../types/api'

/**
 * خريطة المهارات.
 *
 * ## لماذا كانت هذه الصفحة غائبة
 *
 * `GET/POST/PATCH/DELETE /admin/skills` موجودة في adminCatalogue.ts منذ إنشائه،
 * و`learning_objectives.skill_id` يشير إلى هذا الجدول. لكن لم يكن في الواجهة أي
 * مستدعٍ لها، فكان عنصر «خريطة المهارات» في القائمة معطَّلًا بلافتة «قريبًا»
 * والخادم جاهز تمامًا.
 *
 * ## قاعدتان من الخادم تُحترمان هنا
 *
 * ١. **`category` بلا قائمة بيضاء.** لا CHECK على العمود في D1، فالخادم يقبل أي
 *    نص غير فارغ ويصرّح بأنه لا يخترع قائمة لا يفرضها المخطَّط. لذلك الحقل هنا
 *    نصّ حرّ مع `datalist` من التصنيفات الموجودة فعلًا — اقتراح لا قيد.
 *
 * ٢. **الحذف يُرفض عند الاستخدام.** المفتاح الأجنبي `ON DELETE SET NULL`، فحذف
 *    مهارة مستخدمة كان يجرّدها بصمت من كل هدف يشير إليها. الخادم يرفض بـ409،
 *    وهذه الصفحة تعرض سبب الرفض كما ورد بدل رسالة عامة.
 */

const copy = {
  ar: {
    eyebrow: 'الإطار التعليمي',
    title: 'خريطة المهارات',
    intro: 'المهارات هي الجذر الذي تتفرّع منه الأهداف التعليمية. كل هدف يشير إلى مهارة واحدة.',
    add: 'مهارة جديدة',
    refresh: 'تحديث',
    list: 'المهارات',
    search: 'اسم أو معرّف...',
    allCategories: 'كل التصنيفات',
    name: 'المهارة',
    category: 'التصنيف',
    description: 'الوصف',
    objectives: 'الأهداف المرتبطة',
    edit: 'تعديل',
    remove: 'حذف',
    create: 'إنشاء مهارة',
    editTitle: 'تعديل المهارة',
    nameField: 'الاسم بالعربية *',
    categoryField: 'التصنيف *',
    categoryHint: 'نصّ حرّ. الاقتراحات من التصنيفات المستخدمة فعلًا.',
    idField: 'المعرّف',
    idHint: 'يُترك فارغًا فيولّده الخادم. لا يُعدَّل بعد الإنشاء.',
    descriptionField: 'الوصف',
    cancel: 'إلغاء',
    save: 'حفظ',
    required: 'الاسم والتصنيف مطلوبان.',
    loading: 'جارٍ تحميل المهارات...',
    loadError: 'تعذر تحميل المهارات',
    saveError: 'تعذر حفظ المهارة',
    empty: 'لا مهارات بعد',
    emptyDesc: 'أنشئ أول مهارة، ثم اربط بها أهدافًا تعليمية من صفحة الأهداف.',
    confirmRemove: 'سيُحذف هذا الصفّ نهائيًا. متابعة؟',
    inUse: 'مهارة مستخدمة: أعِد إسناد أهدافها أولًا.',
    total: 'الإجمالي',
  },
  en: {
    eyebrow: 'Learning framework',
    title: 'Skills map',
    intro: 'Skills are the root that learning objectives branch from. Each objective points at one skill.',
    add: 'New skill',
    refresh: 'Refresh',
    list: 'Skills',
    search: 'Name or id...',
    allCategories: 'All categories',
    name: 'Skill',
    category: 'Category',
    description: 'Description',
    objectives: 'Linked objectives',
    edit: 'Edit',
    remove: 'Delete',
    create: 'Create skill',
    editTitle: 'Edit skill',
    nameField: 'Arabic name *',
    categoryField: 'Category *',
    categoryHint: 'Free text. Suggestions come from categories already in use.',
    idField: 'Identifier',
    idHint: 'Leave blank and the server generates one. Not editable after creation.',
    descriptionField: 'Description',
    cancel: 'Cancel',
    save: 'Save',
    required: 'Name and category are required.',
    loading: 'Loading skills...',
    loadError: 'Unable to load skills',
    saveError: 'Unable to save skill',
    empty: 'No skills yet',
    emptyDesc: 'Create the first skill, then attach learning objectives to it from the objectives page.',
    confirmRemove: 'This row will be permanently deleted. Continue?',
    inUse: 'Skill is in use: reassign its objectives first.',
    total: 'Total',
  },
}

type SkillForm = { id: string; name_ar: string; category: string; description: string }
const emptyForm: SkillForm = { id: '', name_ar: '', category: '', description: '' }

export function SkillsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [records, setRecords] = useState<SkillRecord[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SkillForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.skills({ q: query, category, limit: 100 })
      setRecords(response.data)
      setTotal(response.meta?.total ?? response.data.length)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [category, query, text.loadError])

  // تأخير بسيط حتى لا يُنادى الخادم على كل حرف
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  /// التصنيفات المعروضة في الاقتراحات مبنية من الصفوف المحمَّلة لا من قائمة
  /// مكتوبة، فلا تنحرف عن البيانات.
  const categories = useMemo(
    () => [...new Set(records.map((item) => item.category).filter(Boolean))].sort(),
    [records],
  )

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item: SkillRecord) {
    setEditingId(item.id)
    setForm({ id: item.id, name_ar: item.name_ar, category: item.category, description: item.description ?? '' })
    setFormError('')
    setModalOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nameAr = form.name_ar.trim()
    const categoryValue = form.category.trim()
    // الخادم يرفض الفراغ في كليهما، فيُمنع الإرسال هنا بدل انتظار 400
    if (!nameAr || !categoryValue) { setFormError(text.required); return }

    setSaving(true)
    setFormError('')
    try {
      if (editingId) {
        await api.updateSkill(editingId, {
          name_ar: nameAr,
          category: categoryValue,
          description: form.description.trim() || null,
        })
      } else {
        await api.createSkill({
          ...(form.id.trim() ? { id: form.id.trim() } : {}),
          name_ar: nameAr,
          category: categoryValue,
          description: form.description.trim() || null,
        })
      }
      setModalOpen(false)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: SkillRecord) {
    // التحذير قبل النداء: الخادم يرفض الحذف عند الاستخدام، فيُوفَّر نداء فاشل
    if (Number(item.objectives_count ?? 0) > 0) { setError(text.inUse); return }
    if (!window.confirm(text.confirmRemove)) return
    try {
      await api.deleteSkill(item.id)
      await load()
    } catch (caught) {
      // 409 من الخادم يحمل سببًا مفيدًا (عدد الأهداف)، فيُعرض كما ورد
      setError(caught instanceof Error ? caught.message : text.saveError)
    }
  }

  if (loading && !records.length) return <LoadingState label={text.loading} />
  if (error && !records.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--secondary" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={17} />{text.refresh}
          </button>
          <button className="button button--primary" type="button" onClick={openCreate}>
            <Icon name="plus" size={17} />{text.add}
          </button>
        </div>
      </section>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{text.list}</span>
            <h3>{text.total} <span className="title-count">{formatNumber(total, locale)}</span></h3>
          </div>
          <div className="filters-row">
            <label className="search-field">
              <Icon name="search" size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} />
            </label>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">{text.allCategories}</option>
              {categories.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </div>
        </header>

        {records.length ? (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.name}</th>
                  <th>{text.category}</th>
                  <th>{text.description}</th>
                  <th>{text.objectives}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="entity-cell">
                        <span className="entity-avatar"><Icon name="skills" size={18} /></span>
                        <div><strong>{item.name_ar}</strong><small dir="ltr">{item.id}</small></div>
                      </div>
                    </td>
                    <td><span className="track-badge">{item.category}</span></td>
                    <td><span className="table-secondary">{item.description || '—'}</span></td>
                    <td>{formatNumber(Number(item.objectives_count ?? 0), locale)}</td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-button icon-button--small" type="button" title={text.edit} onClick={() => openEdit(item)}>
                          <Icon name="edit" size={15} />
                        </button>
                        <button className="icon-button icon-button--small icon-button--danger" type="button" title={text.remove} onClick={() => void remove(item)}>
                          <Icon name="archive" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title={text.empty} description={text.emptyDesc} />}
      </section>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? text.editTitle : text.create}
      >
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>{text.nameField}</span>
              <input autoFocus value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })} />
            </label>
            <label className="field">
              <span>{text.categoryField}</span>
              <input
                list="skill-categories"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
              <datalist id="skill-categories">
                {categories.map((item) => <option value={item} key={item} />)}
              </datalist>
              <small>{text.categoryHint}</small>
            </label>
          </div>
          {!editingId && (
            <label className="field">
              <span>{text.idField}</span>
              <input value={form.id} dir="ltr" onChange={(event) => setForm({ ...form, id: event.target.value })} />
              <small>{text.idHint}</small>
            </label>
          )}
          <label className="field">
            <span>{text.descriptionField}</span>
            <textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setModalOpen(false)}>{text.cancel}</button>
            <button className="button button--primary" type="submit" disabled={saving}>{text.save}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
