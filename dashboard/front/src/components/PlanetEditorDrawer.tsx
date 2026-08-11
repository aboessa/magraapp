import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { formatNumber } from '../lib/labels'
import type { PlanetListRow, PlanetPayload } from '../types/api'

/**
 * محرِّر الكوكب: درج مُقسَّم إلى أقسام، لا نافذة صغيرة.
 *
 * ## لماذا درج وأقسام
 *
 * كان تعديل الكوكب داخل نموذج واحد في صفحة التصنيفات، بستّة حقول متجاورة بلا
 * أقسام ولا تحقّق ولا تحذير عند الإغلاق بتعديلات غير محفوظة. الكوكب أحد أعلى
 * كيانات المحتوى، وتعديل لونه أو تعطيله يظهر في كل شاشة تختار كوكبًا — فالشكل
 * الصحيح هو سطح عمل يفصل الهوية عن اللغة عن الهوية البصرية عن العرض.
 *
 * ## ما لا يُعرض هنا
 *
 * جدول `planets` يحمل سبعة أعمدة فقط: `name_ar`، `name_en`، `description_ar`،
 * `color_hex`، `icon_url` (مهجور)، `sort_order`، `is_active`. لا حقل لوصف
 * إنجليزي ولا لصور: الصور تُربط عبر `asset_links` من تبويب الوسائط، و`icon_url`
 * لا يكتبه أي مسار. اختراع حقول لأعمدة غير موجودة هو ما جعل شاشات أخرى تبدو
 * أكمل مما هي، فالحقول هنا هي الأعمدة بالحرف، والباقي مذكور بوصفه في مكان آخر.
 */

const copy = {
  ar: {
    createTitle: 'كوكب جديد',
    editTitle: 'تعديل الكوكب',
    createLede: 'مجال تنقّل جديد تُبنى عليه السلاسل. يمكن إكمال الصور والإتاحة بعد الإنشاء.',
    editLede: 'الحقول هنا هي أعمدة جدول الكواكب بالحرف. الصور والإتاحة في تبويبات مساحة العمل.',
    identity: 'الهوية',
    nameAr: 'الاسم بالعربية',
    nameArHint: 'يظهر للأطفال وفي كل شاشة تختار كوكبًا.',
    slug: 'المعرّف (slug)',
    slugHint: 'يدخل في الروابط ولا يمكن تغييره بعد الإنشاء. يُشتقّ من الاسم الإنجليزي إن تُرك فارغًا.',
    slugLocked: 'المعرّف ثابت بعد الإنشاء: تغييره يكسر كل رابط ومرجع للكوكب.',
    localization: 'اللغات',
    nameEn: 'الاسم بالإنجليزية',
    nameEnHint: 'يُستخدم في الواجهة الإنجليزية؛ عند غيابه يُعرض الاسم العربي.',
    description: 'الوصف',
    descriptionHint: 'سطران يشرحان ما يجده الطفل في هذا الكوكب.',
    noEnglishDescription: 'لا عمود لوصف إنجليزي في جدول الكواكب، فلا حقل له هنا.',
    visual: 'الهوية البصرية',
    color: 'لون الهوية',
    colorPicker: 'منتقي لون الهوية',
    colorValue: 'قيمة اللون (#RRGGBB)',
    colorHint: 'يُستخدم كلون تمييز وحدود وخلفية أيقونة، ولا يُستخدم كحالة — ألوان الحالة محفوظة لمعناها.',
    preview: 'معاينة البطاقة',
    artwork: 'الصور',
    artworkIcon: 'الأيقونة',
    artworkCover: 'الغلاف',
    artworkPresent: 'مرفوعة',
    artworkMissing: 'غير مرفوعة',
    artworkNote: 'الصور تُربط بالكوكب عبر مكتبة الوسائط (asset_links) لا بحقل نصّي، فتُدار من تبويب الوسائط في مساحة العمل.',
    display: 'العرض',
    order: 'ترتيب العرض',
    orderHint: 'الأصغر أولًا في فهرس الكواكب وفي التطبيق.',
    active: 'كوكب نشط',
    activeHint: 'التعطيل يخفي الكوكب من كل اختيار جديد ولا يحذف محتواه ولا يوقف نشر ما هو منشور.',
    activeStateNote: 'هذه حالة تشغيل لا حالة نشر: جدول الكواكب لا يحمل حالة تحريرية ولا تاريخ نشر.',
    cancel: 'إلغاء',
    save: 'حفظ',
    saving: 'جارٍ الحفظ...',
    saved: 'حُفظ',
    close: 'إغلاق',
    requiredName: 'الاسم بالعربية مطلوب.',
    requiredColor: 'اللون يجب أن يكون بصيغة #RRGGBB.',
    invalidOrder: 'ترتيب العرض يجب أن يكون عددًا صحيحًا.',
    invalidSlug: 'المعرّف يقبل أحرفًا وأرقامًا وشرطات فقط.',
    saveError: 'تعذر حفظ الكوكب',
    unsaved: 'هناك تعديلات غير محفوظة. إغلاق الدرج سيفقدها. متابعة؟',
    dirty: 'تعديلات غير محفوظة',
  },
  en: {
    createTitle: 'New planet',
    editTitle: 'Edit planet',
    createLede: 'A new navigation domain for series. Artwork and availability can follow later.',
    editLede: 'These fields are exactly the planet table columns. Artwork and availability live in the workspace tabs.',
    identity: 'Identity',
    nameAr: 'Arabic name',
    nameArHint: 'Shown to children and in every screen that picks a planet.',
    slug: 'Slug',
    slugHint: 'Used in URLs and fixed after creation. Derived from the English name when left empty.',
    slugLocked: 'The slug is fixed after creation: changing it breaks every link and reference.',
    localization: 'Languages',
    nameEn: 'English name',
    nameEnHint: 'Used in the English interface; the Arabic name is shown when absent.',
    description: 'Description',
    descriptionHint: 'Two lines on what a child finds in this planet.',
    noEnglishDescription: 'The planets table has no English description column, so there is no field for one.',
    visual: 'Visual identity',
    color: 'Identity colour',
    colorPicker: 'Identity colour picker',
    colorValue: 'Colour value (#RRGGBB)',
    colorHint: 'Used as accent, border and icon background — never as a state. Status colours keep their meaning.',
    preview: 'Card preview',
    artwork: 'Artwork',
    artworkIcon: 'Icon',
    artworkCover: 'Cover',
    artworkPresent: 'Uploaded',
    artworkMissing: 'Not uploaded',
    artworkNote: 'Artwork is attached through the media library (asset_links), not a text field, so it is managed from the workspace media tab.',
    display: 'Display',
    order: 'Sort order',
    orderHint: 'Lower first, in the planet index and in the app.',
    active: 'Active planet',
    activeHint: 'Disabling hides the planet from new selections. It deletes no content and unpublishes nothing.',
    activeStateNote: 'This is an operational state, not a publication state: the planets table has no editorial status and no published_at.',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Saved',
    close: 'Close',
    requiredName: 'The Arabic name is required.',
    requiredColor: 'The colour must be in #RRGGBB form.',
    invalidOrder: 'Sort order must be a whole number.',
    invalidSlug: 'A slug accepts letters, numbers and dashes only.',
    saveError: 'Unable to save the planet',
    unsaved: 'There are unsaved changes. Closing the drawer discards them. Continue?',
    dirty: 'Unsaved changes',
  },
}

type Form = {
  name_ar: string
  name_en: string
  description_ar: string
  color_hex: string
  sort_order: string
  is_active: boolean
  slug: string
}

const emptyForm: Form = {
  name_ar: '', name_en: '', description_ar: '', color_hex: '#4ECDC4',
  sort_order: '0', is_active: true, slug: '',
}

const fromPlanet = (planet: PlanetListRow): Form => ({
  name_ar: planet.name_ar,
  name_en: planet.name_en ?? '',
  description_ar: planet.description_ar ?? '',
  color_hex: planet.color_hex,
  sort_order: String(planet.sort_order ?? 0),
  is_active: planet.is_active !== false,
  slug: planet.id,
})

export function PlanetEditorDrawer({
  open,
  planet,
  onClose,
  onSaved,
}: {
  open: boolean
  /// `null` يعني إنشاء.
  planet: PlanetListRow | null
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [form, setForm] = useState<Form>(emptyForm)
  const [baseline, setBaseline] = useState<Form>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const panel = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const next = planet ? fromPlanet(planet) : emptyForm
    setForm(next)
    setBaseline(next)
    setError('')
  }, [open, planet])

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)

  // الإغلاق المحروس: Escape ونقر الخلفية وزرّ الإغلاق كلها تمرّ بنفس السؤال، فلا
  // يفقد المحرِّر عمله بمسار واحد نُسي.
  const guardedClose = () => {
    if (dirty && !window.confirm(text.unsaved)) return
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') guardedClose() }
    window.addEventListener('keydown', onKey)
    panel.current?.querySelector<HTMLElement>('input, textarea, select')?.focus()
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nameAr = form.name_ar.trim()
    if (!nameAr) { setError(text.requiredName); return }
    if (!/^#[0-9a-f]{6}$/i.test(form.color_hex)) { setError(text.requiredColor); return }
    const order = Number(form.sort_order)
    if (!Number.isInteger(order)) { setError(text.invalidOrder); return }
    const slug = form.slug.trim()
    if (!planet && slug && !/^[\p{L}\p{N}-]+$/u.test(slug)) { setError(text.invalidSlug); return }

    const payload: PlanetPayload = {
      name_ar: nameAr,
      name_en: form.name_en.trim() || null,
      description_ar: form.description_ar.trim() || null,
      color_hex: form.color_hex,
      sort_order: order,
      is_active: form.is_active,
    }

    setSaving(true)
    setError('')
    try {
      const response = planet
        ? await api.updatePlanet(planet.id, payload)
        : await api.createPlanet({ ...payload, ...(slug ? { id: slug } : {}) })
      setBaseline(form)
      onSaved(response.data.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  const previewName = locale === 'en' ? form.name_en || form.name_ar : form.name_ar

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) guardedClose() }}
    >
      <aside
        className="drawer drawer--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planet-editor-title"
        ref={panel}
      >
        <header className="drawer__header">
          <div>
            <h2 id="planet-editor-title">{planet ? text.editTitle : text.createTitle}</h2>
            <p>{planet ? text.editLede : text.createLede}</p>
          </div>
          <div className="planet-editor__header-tools">
            {dirty && <span className="planet-chip planet-chip--warn">{text.dirty}</span>}
            <button className="icon-button" type="button" onClick={guardedClose} aria-label={text.close}>
              <Icon name="close" />
            </button>
          </div>
        </header>

        <form className="drawer__body planet-editor" onSubmit={submit} id="planet-editor-form">
          {error && <div className="inline-alert inline-alert--error" role="alert">{error}</div>}

          <fieldset className="planet-editor__section">
            <legend>{text.identity}</legend>
            <label className="field">
              <span>{text.nameAr} *</span>
              <input
                value={form.name_ar}
                onChange={(event) => setForm({ ...form, name_ar: event.target.value })}
                required
              />
              <small>{text.nameArHint}</small>
            </label>
            <label className="field">
              <span>{text.slug}</span>
              <input
                dir="ltr"
                value={form.slug}
                disabled={!!planet}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
              />
              <small>{planet ? text.slugLocked : text.slugHint}</small>
            </label>
          </fieldset>

          <fieldset className="planet-editor__section">
            <legend>{text.localization}</legend>
            <label className="field">
              <span>{text.nameEn}</span>
              <input dir="ltr" value={form.name_en} onChange={(event) => setForm({ ...form, name_en: event.target.value })} />
              <small>{text.nameEnHint}</small>
            </label>
            <label className="field">
              <span>{text.description}</span>
              <textarea
                rows={3}
                value={form.description_ar}
                onChange={(event) => setForm({ ...form, description_ar: event.target.value })}
              />
              <small>{text.descriptionHint}</small>
            </label>
            <p className="planet-editor__note">{text.noEnglishDescription}</p>
          </fieldset>

          <fieldset className="planet-editor__section">
            <legend>{text.visual}</legend>
            <div className="planet-editor__colour">
              {/* حقلان لقيمة واحدة، فلكلٍّ اسمه: `label` واحد يلفّهما يجعل قارئ
                  الشاشة يعلن الاسم نفسه لعنصرين مختلفين، ولا يمكن تمييزهما. */}
              <div className="field field--colour">
                <span id="planet-colour-label">{text.color}</span>
                <div className="planet-editor__colour-row">
                  <input
                    type="color"
                    aria-label={text.colorPicker}
                    value={/^#[0-9a-f]{6}$/i.test(form.color_hex) ? form.color_hex : '#4ECDC4'}
                    onChange={(event) => setForm({ ...form, color_hex: event.target.value })}
                  />
                  <input
                    dir="ltr"
                    aria-label={text.colorValue}
                    value={form.color_hex}
                    onChange={(event) => setForm({ ...form, color_hex: event.target.value })}
                  />
                </div>
                <small>{text.colorHint}</small>
              </div>

              {/* معاينة حقيقية: نفس بنية بطاقة الفهرس، فما يُرى هنا هو ما سيظهر هناك. */}
              <div className="planet-editor__preview" aria-label={text.preview}>
                <span className="planet-editor__preview-label">{text.preview}</span>
                <div className="planet-card planet-card--preview" style={{ ['--planet-colour' as string]: form.color_hex }}>
                  <div className="planet-card__media">
                    {planet?.cover_url || planet?.icon_url
                      ? <img src={planet.cover_url || planet.icon_url || ''} alt="" />
                      : <div className="planet-card__media-fallback"><Icon name="planets" size={26} /></div>}
                  </div>
                  <div className="planet-card__body">
                    <strong>{previewName || '—'}</strong>
                    <p>{form.description_ar || '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="planet-editor__artwork">
              <span>{text.artwork}</span>
              <ul>
                <li>
                  <span>{text.artworkIcon}</span>
                  <strong className={planet?.health?.artwork_icon ? 'field__ok' : 'field__warn'}>
                    {planet?.health?.artwork_icon ? text.artworkPresent : text.artworkMissing}
                  </strong>
                </li>
                <li>
                  <span>{text.artworkCover}</span>
                  <strong className={planet?.health?.artwork_cover ? 'field__ok' : 'field__warn'}>
                    {planet?.health?.artwork_cover ? text.artworkPresent : text.artworkMissing}
                  </strong>
                </li>
              </ul>
              <p className="planet-editor__note">{text.artworkNote}</p>
            </div>
          </fieldset>

          <fieldset className="planet-editor__section">
            <legend>{text.display}</legend>
            <label className="field">
              <span>{text.order}</span>
              <input
                type="number"
                dir="ltr"
                value={form.sort_order}
                onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
              />
              <small>{text.orderHint}</small>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
              />
              <span>{text.active}</span>
            </label>
            <p className="planet-editor__note">{text.activeHint}</p>
            <p className="planet-editor__note">{text.activeStateNote}</p>
            {planet && (
              <p className="planet-editor__note" dir="ltr">
                {formatNumber(planet.health?.series_total ?? 0, locale)} series ·{' '}
                {formatNumber(planet.health?.episodes_total ?? 0, locale)} episodes
              </p>
            )}
          </fieldset>
        </form>

        <footer className="drawer__footer">
          <button className="button button--ghost" type="button" onClick={guardedClose} disabled={saving}>
            {text.cancel}
          </button>
          <button className="button button--primary" type="submit" form="planet-editor-form" disabled={saving}>
            {saving ? text.saving : text.save}
          </button>
        </footer>
      </aside>
    </div>
  )
}
