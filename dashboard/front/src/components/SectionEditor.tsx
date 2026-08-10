import { useState } from 'react'
import { Icon } from './Icon'
import { MediaField } from './MediaPicker'
import { usePreferences } from '../context/preferences'
import type { WebSectionDraft, WebSectionType } from '../types/api'

/**
 * محرِّر أقسام صفحة الموقع: حقول مُعرَّفة لكل نوع قسم، لا محرِّر JSON.
 *
 * ## لماذا مواصفة لكل نوع
 *
 * الخادم يرفض القسم الذي ينقصه مفتاحه المطلوب (`lib/cmsContent.ts`
 * `SECTION_REQUIRED`). محرِّر JSON حرّ يعني أن المحرِّر يكتشف ذلك برسالة 400 بعد
 * الحفظ، ويحتاج قراءة الكود ليعرف أن قسم البطل يحتاج `headline` تحديدًا. هنا
 * المواصفة هي نفس القائمة، معروضة كحقول، والحقل المطلوب مُعلَّم قبل الحفظ.
 *
 * ## الترتيب هو ترتيب المصفوفة
 *
 * `PUT /sections` يتجاهل أي `sort_order` مُرسَل ويستخدم موضع العنصر في المصفوفة.
 * لذلك أزرار التحريك تعيد ترتيب المصفوفة نفسها — لا حقل رقم يمكن أن يتعارض مع ما
 * يراه المحرِّر على الشاشة.
 */

interface SectionFieldSpec {
  key: string
  label: { ar: string; en: string }
  type: 'text' | 'textarea'
  required?: boolean
}

interface SectionSpec {
  label: { ar: string; en: string }
  fields: SectionFieldSpec[]
  /// حين تكون موجودة، `content.items` مصفوفة كائنات بهذه الحقول
  itemFields?: SectionFieldSpec[]
  itemsRequired?: boolean
  media?: 'image' | 'audio'
}

const field = (key: string, ar: string, en: string, type: 'text' | 'textarea' = 'text', required = false): SectionFieldSpec =>
  ({ key, label: { ar, en }, type, required })

export const SECTION_SPECS: Record<WebSectionType, SectionSpec> = {
  hero: {
    label: { ar: 'قسم البطل', en: 'Hero' },
    fields: [
      field('headline', 'العنوان الرئيسي', 'Headline', 'text', true),
      field('subheadline', 'العنوان الفرعي', 'Subheadline', 'textarea'),
      field('eyebrow', 'سطر فوق العنوان', 'Eyebrow'),
    ],
    media: 'image',
  },
  rich_text: {
    label: { ar: 'نصّ', en: 'Rich text' },
    fields: [
      field('heading', 'عنوان القسم', 'Heading'),
      field('body', 'النصّ', 'Body', 'textarea', true),
    ],
  },
  feature_grid: {
    label: { ar: 'شبكة ميزات', en: 'Feature grid' },
    fields: [field('heading', 'عنوان القسم', 'Heading')],
    itemFields: [
      field('title', 'العنوان', 'Title', 'text', true),
      field('body', 'الوصف', 'Description', 'textarea'),
    ],
    itemsRequired: true,
  },
  media: {
    label: { ar: 'وسيط', en: 'Media' },
    fields: [field('caption', 'التعليق', 'Caption')],
    media: 'image',
  },
  cta: {
    label: { ar: 'نداء لإجراء', en: 'Call to action' },
    fields: [
      field('label', 'نصّ الزرّ', 'Button label', 'text', true),
      field('href', 'الرابط', 'Link', 'text', true),
      field('body', 'نصّ مساند', 'Supporting text', 'textarea'),
    ],
  },
  faq: {
    label: { ar: 'أسئلة متكرّرة', en: 'FAQ' },
    fields: [field('heading', 'عنوان القسم', 'Heading')],
    itemFields: [
      field('question', 'السؤال', 'Question', 'text', true),
      field('answer', 'الجواب', 'Answer', 'textarea', true),
    ],
    itemsRequired: true,
  },
  plans: {
    label: { ar: 'الباقات', en: 'Plans' },
    fields: [field('heading', 'عنوان القسم', 'Heading')],
  },
  content_rail: {
    label: { ar: 'شريط محتوى', en: 'Content rail' },
    fields: [
      field('heading', 'عنوان القسم', 'Heading'),
      field('source', 'مصدر المحتوى', 'Content source', 'text', true),
    ],
  },
  testimonials: {
    label: { ar: 'شهادات', en: 'Testimonials' },
    fields: [field('heading', 'عنوان القسم', 'Heading')],
    itemFields: [
      field('quote', 'الشهادة', 'Quote', 'textarea', true),
      field('author', 'الاسم', 'Author'),
    ],
    itemsRequired: true,
  },
  steps: {
    label: { ar: 'خطوات', en: 'Steps' },
    fields: [field('heading', 'عنوان القسم', 'Heading')],
    itemFields: [
      field('title', 'الخطوة', 'Step', 'text', true),
      field('body', 'الشرح', 'Detail', 'textarea'),
    ],
    itemsRequired: true,
  },
  stats: {
    label: { ar: 'أرقام', en: 'Stats' },
    fields: [field('heading', 'عنوان القسم', 'Heading')],
    itemFields: [
      field('label', 'التسمية', 'Label', 'text', true),
      field('value', 'القيمة', 'Value', 'text', true),
    ],
    itemsRequired: true,
  },
  partners: {
    label: { ar: 'شركاء', en: 'Partners' },
    fields: [field('heading', 'عنوان القسم', 'Heading')],
    itemFields: [field('name', 'الاسم', 'Name', 'text', true)],
    itemsRequired: true,
  },
  legal_text: {
    label: { ar: 'نصّ قانوني', en: 'Legal text' },
    fields: [
      field('heading', 'العنوان', 'Heading'),
      field('body', 'النصّ', 'Body', 'textarea', true),
    ],
  },
}

const copy = {
  ar: {
    add: 'إضافة قسم',
    type: 'نوع القسم',
    active: 'مُفعَّل',
    inactive: 'مُعطَّل',
    up: 'تحريك لأعلى',
    down: 'تحريك لأسفل',
    dragHandle: 'مقبض السحب',
    dragHint: 'اسحب لإعادة الترتيب، أو استعمل زرّي الأعلى والأسفل بلوحة المفاتيح.',
    remove: 'حذف القسم',
    items: 'العناصر',
    addItem: 'إضافة عنصر',
    removeItem: 'حذف العنصر',
    cta: 'زرّ القسم',
    ctaLabel: 'نصّ الزرّ',
    ctaHref: 'رابط الزرّ',
    ctaHint: 'زرّ بنصّ بلا رابط يرفضه الخادم: زرّ لا يفعل شيئًا أسوأ من غيابه.',
    media: 'وسيط القسم',
    empty: 'لا أقسام. صفحة بلا قسم مُفعَّل لا يمكن نشرها.',
    missing: 'حقل مطلوب',
    itemsMissing: 'هذا النوع يحتاج عنصرًا واحدًا على الأقل.',
    section: 'قسم',
    inactiveNote: 'القسم المُعطَّل يُحفظ ولا يُعرض للزوّار ولا يُحتسب في بوابة النشر.',
  },
  en: {
    add: 'Add section',
    type: 'Section type',
    active: 'Active',
    inactive: 'Disabled',
    up: 'Move up',
    down: 'Move down',
    dragHandle: 'Drag handle',
    dragHint: 'Drag to reorder, or use the up and down buttons from the keyboard.',
    remove: 'Delete section',
    items: 'Items',
    addItem: 'Add item',
    removeItem: 'Remove item',
    cta: 'Section button',
    ctaLabel: 'Button label',
    ctaHref: 'Button link',
    ctaHint: 'A label with no link is refused by the server: a button that does nothing is worse than none.',
    media: 'Section media',
    empty: 'No sections. A page with no active section cannot be published.',
    missing: 'Required field',
    itemsMissing: 'This type needs at least one item.',
    section: 'Section',
    inactiveNote: 'A disabled section is saved, hidden from visitors, and ignored by the publish gate.',
  },
}

const asString = (value: unknown) => (typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value))

export function newSection(type: WebSectionType): WebSectionDraft {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    section_type: type,
    is_active: true,
    content: SECTION_SPECS[type].itemFields ? { items: [] } : {},
    cta: {},
    media_asset_id: null,
  }
}

export function SectionEditor({
  sections,
  onChange,
  canEdit,
}: {
  sections: WebSectionDraft[]
  onChange: (next: WebSectionDraft[]) => void
  canEdit: boolean
}) {
  const { locale } = usePreferences()
  const lang = locale === 'en' ? 'en' : 'ar'
  const text = copy[lang]
  const [adding, setAdding] = useState<WebSectionType>('hero')
  /// `key` of the section being dragged, and of the card it is currently over.
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  function update(index: number, patch: Partial<WebSectionDraft>) {
    onChange(sections.map((section, position) => (position === index ? { ...section, ...patch } : section)))
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next)
  }

  /// Moves the dragged section to the position of the card it was dropped on.
  ///
  /// ## Why order is array position and nothing else
  ///
  /// `PUT /admin/website/pages/:id/sections` ignores any client `sort_order` and uses the
  /// array index. So a reorder is a reorder of this array, the server is the one that assigns
  /// the numbers, and two editors cannot produce colliding `sort_order` values by dragging at
  /// the same time — the second save simply replaces the set. A `sort_order` field the client
  /// could set would reintroduce exactly that collision.
  ///
  /// Nothing is persisted here. The parent marks the page dirty and the editor saves
  /// explicitly, which is what makes an accidental drag recoverable: the unsaved-changes
  /// notice appears and reloading discards it.
  function moveTo(fromKey: string, toKey: string) {
    if (fromKey === toKey) return
    const from = sections.findIndex((section) => section.key === fromKey)
    const to = sections.findIndex((section) => section.key === toKey)
    if (from === -1 || to === -1) return
    const next = [...sections]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    onChange(next)
  }

  function setContent(index: number, key: string, value: unknown) {
    const section = sections[index]
    update(index, { content: { ...section.content, [key]: value } })
  }

  function items(section: WebSectionDraft): Array<Record<string, unknown>> {
    const raw = section.content.items
    return Array.isArray(raw) ? raw as Array<Record<string, unknown>> : []
  }

  return (
    <div className="section-editor">
      {sections.length === 0 && <p className="data-unavailable">{text.empty}</p>}

      <ol className="section-editor__list">
        {sections.map((section, index) => {
          const spec = SECTION_SPECS[section.section_type]
          const list = items(section)
          return (
            <li
              className={`section-card ${section.is_active ? '' : 'section-card--inactive'}`
                + `${dragging === section.key ? ' section-card--dragging' : ''}`
                + `${over === section.key && dragging !== section.key ? ' section-card--drop' : ''}`}
              key={section.key}
              onDragOver={(event) => {
                if (!dragging) return
                event.preventDefault()
                setOver(section.key)
              }}
              onDragLeave={() => setOver((current) => (current === section.key ? null : current))}
              onDrop={(event) => {
                event.preventDefault()
                const from = event.dataTransfer.getData('text/plain') || dragging
                setOver(null)
                setDragging(null)
                if (from) moveTo(from, section.key)
              }}
            >
              <header className="section-card__header">
                {/* The handle is draggable, not the whole card.
                    A draggable card swallows text selection inside its own fields, and an
                    editor who drags to select a headline instead reorders the page. The
                    up/down buttons beside it are not a fallback bolted on afterwards: they
                    are the keyboard path to the identical operation, and a mouse drag cannot
                    be performed from a keyboard at all. */}
                <span
                  className="section-card__index"
                  draggable={canEdit}
                  role={canEdit ? 'button' : undefined}
                  tabIndex={-1}
                  aria-hidden={canEdit ? undefined : 'true'}
                  aria-label={canEdit ? `${text.dragHandle}: ${spec.label[lang]}` : undefined}
                  title={canEdit ? text.dragHint : undefined}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', section.key)
                    event.dataTransfer.effectAllowed = 'move'
                    setDragging(section.key)
                  }}
                  onDragEnd={() => { setDragging(null); setOver(null) }}
                ><Icon name="grip" size={16} /></span>
                <div className="section-card__title">
                  <strong>{index + 1}. {spec.label[lang]}</strong>
                  <code dir="ltr">{section.section_type}</code>
                </div>
                <div className="section-card__tools">
                  <label className="checkbox checkbox--inline">
                    <input
                      type="checkbox"
                      checked={section.is_active}
                      disabled={!canEdit}
                      onChange={(event) => update(index, { is_active: event.target.checked })}
                    />
                    <span>{section.is_active ? text.active : text.inactive}</span>
                  </label>
                  <button className="icon-button icon-button--small" type="button" aria-label={text.up} disabled={!canEdit || index === 0} onClick={() => move(index, -1)}>
                    <span className="rotate-up" aria-hidden="true"><Icon name="arrow" size={14} /></span>
                  </button>
                  <button className="icon-button icon-button--small" type="button" aria-label={text.down} disabled={!canEdit || index === sections.length - 1} onClick={() => move(index, 1)}>
                    <span className="rotate-down" aria-hidden="true"><Icon name="arrow" size={14} /></span>
                  </button>
                  <button
                    className="icon-button icon-button--small icon-button--danger"
                    type="button"
                    aria-label={text.remove}
                    disabled={!canEdit}
                    onClick={() => onChange(sections.filter((_, position) => position !== index))}
                  ><Icon name="trash" size={14} /></button>
                </div>
              </header>

              <div className="section-card__body entity-form">
                {!section.is_active && <p className="field__hint">{text.inactiveNote}</p>}

                {spec.fields.map((spec_field) => {
                  const value = asString(section.content[spec_field.key])
                  const missing = spec_field.required && !value.trim()
                  return (
                    <label className="field" key={spec_field.key}>
                      <span>{spec_field.label[lang]}{spec_field.required && ' *'}</span>
                      {spec_field.type === 'textarea' ? (
                        <textarea rows={3} value={value} disabled={!canEdit} aria-invalid={missing || undefined} onChange={(event) => setContent(index, spec_field.key, event.target.value)} />
                      ) : (
                        <input value={value} disabled={!canEdit} aria-invalid={missing || undefined} onChange={(event) => setContent(index, spec_field.key, event.target.value)} />
                      )}
                      {missing && <small className="field__error">{text.missing}</small>}
                    </label>
                  )
                })}

                {spec.itemFields && (
                  <div className="section-items">
                    <div className="section-items__head">
                      <strong>{text.items} ({list.length})</strong>
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setContent(index, 'items', [...list, {}])}
                      ><Icon name="plus" size={13} />{text.addItem}</button>
                    </div>
                    {spec.itemsRequired && list.length === 0 && <small className="field__error">{text.itemsMissing}</small>}
                    <ol className="section-items__list">
                      {list.map((item, itemIndex) => (
                        <li key={`${section.key}-item-${itemIndex}`}>
                          <div className="section-items__fields">
                            {spec.itemFields?.map((itemField) => {
                              const value = asString(item[itemField.key])
                              const missing = itemField.required && !value.trim()
                              return (
                                <label className="field" key={itemField.key}>
                                  <span>{itemField.label[lang]}{itemField.required && ' *'}</span>
                                  {itemField.type === 'textarea' ? (
                                    <textarea
                                      rows={2}
                                      value={value}
                                      disabled={!canEdit}
                                      aria-invalid={missing || undefined}
                                      onChange={(event) => setContent(index, 'items', list.map((entry, position) => (position === itemIndex ? { ...entry, [itemField.key]: event.target.value } : entry)))}
                                    />
                                  ) : (
                                    <input
                                      value={value}
                                      disabled={!canEdit}
                                      aria-invalid={missing || undefined}
                                      onChange={(event) => setContent(index, 'items', list.map((entry, position) => (position === itemIndex ? { ...entry, [itemField.key]: event.target.value } : entry)))}
                                    />
                                  )}
                                  {missing && <small className="field__error">{text.missing}</small>}
                                </label>
                              )
                            })}
                          </div>
                          <button
                            className="icon-button icon-button--small icon-button--danger"
                            type="button"
                            aria-label={text.removeItem}
                            disabled={!canEdit}
                            onClick={() => setContent(index, 'items', list.filter((_, position) => position !== itemIndex))}
                          ><Icon name="trash" size={13} /></button>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {spec.media && (
                  <MediaField
                    label={text.media}
                    kind={spec.media}
                    value={section.media_asset_id}
                    onChange={(assetId) => update(index, { media_asset_id: assetId })}
                  />
                )}

                <fieldset className="section-cta">
                  <legend>{text.cta}</legend>
                  <div className="field-row">
                    <label className="field">
                      <span>{text.ctaLabel}</span>
                      <input
                        value={asString(section.cta.label)}
                        disabled={!canEdit}
                        onChange={(event) => update(index, { cta: { ...section.cta, label: event.target.value } })}
                      />
                    </label>
                    <label className="field">
                      <span>{text.ctaHref}</span>
                      <input
                        dir="ltr"
                        value={asString(section.cta.href)}
                        disabled={!canEdit}
                        aria-invalid={(!!asString(section.cta.label).trim() && !asString(section.cta.href).trim()) || undefined}
                        onChange={(event) => update(index, { cta: { ...section.cta, href: event.target.value } })}
                      />
                    </label>
                  </div>
                  <small>{text.ctaHint}</small>
                </fieldset>
              </div>
            </li>
          )
        })}
      </ol>

      {canEdit && (
        <div className="section-editor__add">
          <label className="field">
            <span>{text.type}</span>
            <select value={adding} onChange={(event) => setAdding(event.target.value as WebSectionType)}>
              {(Object.keys(SECTION_SPECS) as WebSectionType[]).map((type) => (
                <option value={type} key={type}>{SECTION_SPECS[type].label[lang]}</option>
              ))}
            </select>
          </label>
          <button className="button button--secondary" type="button" onClick={() => onChange([...sections, newSection(adding)])}>
            <Icon name="plus" size={15} />{text.add}
          </button>
        </div>
      )}
    </div>
  )
}
