import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { HomeBlockRecord } from '../types/api'

/**
 * بناء الصفحة الرئيسية للتطبيق.
 *
 * ## ما كانت عليه
 *
 * `.catch(() => ({ data: [] }))` — لا بيانات مخترعة هنا، لكنه يحوّل أي عطل في
 * الشبكة أو المصادقة إلى «لا أقسام مضبوطة»، وهي رسالة مطمئنة كاذبة. ولم يكن
 * هناك `EmptyState` إطلاقًا، فالنتيجة صفحة فارغة بلا تفسير.
 *
 * وكان `b.targeting_json` يُفكّ بـ`JSON.parse` مباشرة في العرض، فقيمة واحدة
 * فاسدة تُسقط الصفحة كلها. الخادم يُعيد `targeting` مفكوكًا بالفعل، فكان الحقل
 * الخام يُقرأ بلا داعٍ.
 *
 * والمعاينة كانت `alert(JSON.stringify(r.data.blocks.slice(0,3)...))` بلا حماية:
 * لو فشل النداء يرمي `r.data.blocks` استثناءً غير مُلتقَط داخل معالج النقر.
 *
 * ## ما صارت عليه
 *
 * أخطاء حقيقية، وحالة فراغ صريحة، ومعاينة في نافذة مقروءة بدل `alert`.
 */

const BLOCK_TYPES = [
  'hero_slider', 'content_rail', 'planet_orbit', 'feature_banner',
  'learning_journey', 'audio_rail', 'character_orbit', 'seasonal_banner',
  'welcome', 'coming_soon', 'watch_free', 'new_releases', 'most_watched',
] as const

const copy = {
  ai: '',
  ar: {
    eyebrow: 'تجربة التطبيق',
    title: 'بناء الصفحة الرئيسية',
    lede: 'ترتيب أقسام الصفحة الرئيسية واستهدافها حسب الدولة واللغة والمسار العمري والباقة والجهاز.',
    add: 'قسم جديد',
    addTitle: 'إضافة قسم',
    typeLabel: 'نوع القسم',
    titleLabel: 'العنوان',
    titleHint: 'اختياري. يُعرض للمستخدم فوق القسم.',
    create: 'إضافة',
    creating: 'جارٍ الإضافة…',
    cancel: 'إلغاء',
    created: 'أُضيف القسم',
    draft: 'مسودة',
    active: 'مفعل',
    order: 'ترتيب',
    publish: 'نشر',
    rollback: 'رجوع لإصدار سابق',
    rollbackConfirm: 'الرجوع إلى الإصدار السابق من هذا القسم؟',
    moveUp: 'أعلى',
    moveDown: 'أسفل',
    from: 'من',
    until: 'حتى',
    plan: 'باقة',
    newUser: 'مستخدم جديد',
    previewTitle: 'معاينة',
    previewHint: 'يُظهر الأقسام التي ستُعرض فعلًا بعد تطبيق الاستهداف.',
    previewMobile: 'موبايل',
    previewTv: 'تلفزيون',
    previewResult: 'نتيجة المعاينة',
    previewEmpty: 'لا أقسام تُعرض بهذا الاستهداف',
    close: 'إغلاق',
    empty: 'لا أقسام مضبوطة',
    emptyHint: 'أضف قسمًا لتحديد ما يراه المستخدم في الصفحة الرئيسية.',
    loadError: 'تعذر تحميل أقسام الصفحة الرئيسية',
    saveError: 'تعذر تنفيذ الإجراء',
  },
  en: {
    eyebrow: 'App experience',
    title: 'Home page builder',
    lede: 'Order the home page sections and target them by country, language, age track, plan and device.',
    add: 'New section',
    addTitle: 'Add section',
    typeLabel: 'Section type',
    titleLabel: 'Title',
    titleHint: 'Optional. Shown to the user above the section.',
    create: 'Add',
    creating: 'Adding…',
    cancel: 'Cancel',
    created: 'Section added',
    draft: 'Draft',
    active: 'Active',
    order: 'Order',
    publish: 'Publish',
    rollback: 'Roll back',
    rollbackConfirm: 'Roll back to the previous version of this section?',
    moveUp: 'Move up',
    moveDown: 'Move down',
    from: 'From',
    until: 'Until',
    plan: 'Plan',
    newUser: 'New user',
    previewTitle: 'Preview',
    previewHint: 'Shows the sections that would actually render after targeting is applied.',
    previewMobile: 'Mobile',
    previewTv: 'TV',
    previewResult: 'Preview result',
    previewEmpty: 'No sections render with this targeting',
    close: 'Close',
    empty: 'No sections configured',
    emptyHint: 'Add a section to control what users see on the home page.',
    loadError: 'Unable to load home page sections',
    saveError: 'Unable to complete the action',
  },
}

function formatDate(value: string | null | undefined, locale: 'ar' | 'en') {
  if (!value) return null
  const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' })
}

export function AppExperiencePage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [blocks, setBlocks] = useState<HomeBlockRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ block_type: 'content_rail', title_ar: '' })
  const [formError, setFormError] = useState('')

  const [preview, setPreview] = useState<string[] | null>(null)
  const [previewLabel, setPreviewLabel] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.homeExperience()
      setBlocks(response.data)
    } catch (caught) {
      // العطل يُعرض عطلًا: `{ data: [] }` كانت تجعله يبدو «لا أقسام»
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setBusy(false)
    }
  }

  async function move(id: string, direction: -1 | 1) {
    const index = blocks.findIndex((block) => block.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= blocks.length) return
    const reordered = [...blocks]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    // تحديث متفائل للترتيب ثم تثبيته في الخادم؛ الفشل يُعيد التحميل فيصحّح
    setBlocks(reordered)
    await run(() => api.reorderHomeBlocks(reordered.map((block) => block.id)))
  }

  async function create() {
    if (!form.block_type) return
    setFormError('')
    setBusy(true)
    try {
      await api.createHomeBlock({
        block_type: form.block_type,
        title_ar: form.title_ar.trim() || null,
      })
      setAddOpen(false)
      setForm({ block_type: 'content_rail', title_ar: '' })
      setNotice(text.created)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setBusy(false)
    }
  }

  async function openPreview(platform: 'mobile' | 'tv', label: string) {
    setBusy(true)
    setError('')
    try {
      // المعاينة تمرّ عبر lib/api.ts فترمي على الفشل بدل أن تنفجر داخل المعالج
      const response = await api.homeExperiencePreview({ track: 'kids', country: 'EG', platform })
      setPreview(response.data.blocks.map((block) => block.block_type))
      setPreviewLabel(label)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState />
  if (error && !blocks.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => { setFormError(''); setAddOpen(true) }}
          >
            <Icon name="plus" size={16} />{text.add}
          </button>
        </div>
      </section>

      {notice ? <section className="panel panel--notice" role="status">{notice}</section> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {blocks.length ? (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.order}</th>
                  <th>{text.titleLabel}</th>
                  <th>{text.active}</th>
                  <th>{text.plan}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {blocks.map((block, index) => {
                  const isDraft = Number(block.is_draft ?? 0) === 1
                  const targeting = block.targeting ?? {}
                  const from = formatDate(block.scheduled_at, locale)
                  const until = formatDate(block.expires_at, locale)
                  return (
                    <tr key={block.id} style={{ opacity: Number(block.is_active) === 1 && !isDraft ? 1 : 0.6 }}>
                      <td>
                        <div className="table-actions">
                          <button
                            className="icon-button icon-button--small"
                            type="button"
                            aria-label={text.moveUp}
                            disabled={busy || index === 0}
                            onClick={() => void move(block.id, -1)}
                          >↑</button>
                          <button
                            className="icon-button icon-button--small"
                            type="button"
                            aria-label={text.moveDown}
                            disabled={busy || index === blocks.length - 1}
                            onClick={() => void move(block.id, 1)}
                          >↓</button>
                        </div>
                      </td>
                      <td>
                        <span className="table-primary">
                          {block.title_ar || block.block_type}
                          {isDraft ? <span className="status-badge status-badge--draft">{text.draft}</span> : null}
                        </span>
                        <span className="table-secondary" dir="ltr">{block.block_type}</span>
                        {from || until ? (
                          <span className="table-secondary">
                            {from ? `${text.from} ${from}` : ''}
                            {until ? ` ${text.until} ${until}` : ''}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={Number(block.is_active) === 1}
                            disabled={busy}
                            onChange={() => void run(() => api.updateHomeBlock(block.id, {
                              is_active: Number(block.is_active) === 1 ? 0 : 1,
                            }))}
                          />
                          <span>{text.active}</span>
                        </label>
                      </td>
                      <td>
                        {/* targeting يأتي مفكوكًا من الخادم: JSON.parse في العرض
                            كان يُسقط الصفحة على قيمة واحدة فاسدة */}
                        {targeting.plan ? <span className="track-badge">{String(targeting.plan)}</span> : null}
                        {targeting.is_new_user ? <span className="track-badge">{text.newUser}</span> : null}
                      </td>
                      <td>
                        <div className="table-actions">
                          {isDraft ? (
                            <button
                              className="button button--ghost"
                              type="button"
                              disabled={busy}
                              onClick={() => void run(() => api.updateHomeBlock(block.id, { is_draft: 0 }))}
                            >{text.publish}</button>
                          ) : null}
                          <button
                            className="button button--ghost"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(text.rollbackConfirm)) return
                              void run(() => api.rollbackHomeBlock(block.id))
                            }}
                          >{text.rollback}</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState title={text.empty} description={text.emptyHint} />
      )}

      <section className="panel">
        <div className="panel__header">
          <h3>{text.previewTitle}</h3>
          <span className="panel__kicker">{text.previewHint}</span>
        </div>
        <div className="entity-form">
          <div className="mode-preview-links">
            <button
              className="button button--ghost"
              type="button"
              disabled={busy}
              onClick={() => void openPreview('mobile', text.previewMobile)}
            >
              <Icon name="devices" size={16} />{text.previewMobile}
            </button>
            <button
              className="button button--ghost"
              type="button"
              disabled={busy}
              onClick={() => void openPreview('tv', text.previewTv)}
            >
              <Icon name="play" size={16} />{text.previewTv}
            </button>
          </div>
        </div>
      </section>

      {addOpen ? (
        <Modal open title={text.addTitle} onClose={() => setAddOpen(false)}>
          <div className="entity-form">
            <label className="field">
              <span>{text.typeLabel}</span>
              {/* قائمة محدّدة من أنواع الجدول: كان النوع مثبّتًا content_rail دائمًا */}
              <select
                value={form.block_type}
                onChange={(event) => setForm({ ...form, block_type: event.target.value })}
              >
                {BLOCK_TYPES.map((value) => (
                  <option value={value} key={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{text.titleLabel}</span>
              <input
                type="text"
                value={form.title_ar}
                onChange={(event) => setForm({ ...form, title_ar: event.target.value })}
              />
              <small>{text.titleHint}</small>
            </label>

            {formError ? <p className="form-error" role="alert">{formError}</p> : null}

            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setAddOpen(false)}>
                {text.cancel}
              </button>
              <button className="button button--primary" type="button" disabled={busy} onClick={() => void create()}>
                {busy ? text.creating : text.create}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {preview ? (
        <Modal open title={`${text.previewResult} · ${previewLabel}`} onClose={() => setPreview(null)}>
          <div className="entity-form">
            {preview.length ? (
              <ol className="detail-list">
                {preview.map((blockType, index) => (
                  <li key={`${blockType}-${index}`}>
                    <span className="table-primary" dir="ltr">{index + 1}. {blockType}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="table-secondary">{text.previewEmpty}</p>
            )}
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setPreview(null)}>
                {text.close}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
