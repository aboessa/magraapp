import { useState } from 'react'
import { Icon } from './Icon'
import { MediaField } from './MediaPicker'
import { usePreferences } from '../context/preferences'
import type { BlogBlockDraft, BlogBlockType } from '../types/api'

/**
 * محرِّر جسم المقال ككتل مهيكلة.
 *
 * ## لماذا ليس مربّع JSON ولا HTML
 *
 * الخادم يتحقّق من كل كتلة ويرفض المصفوفة كاملة إن فسدت واحدة (`validateBlocks`)،
 * ولا يشذّب: إسقاط فقرة كتبها المحرِّر بصمت أسوأ من رفض الحفظ. محرِّر JSON حرّ
 * يجعل ذلك الرفض هو التجربة المعتادة، ويطالب المحرِّر بمعرفة أن الصورة تحتاج
 * `asset_id` و`alt` معًا. الحقول هنا هي نفس القواعد معروضةً قبل الحفظ.
 *
 * ## القواعد المُطبَّقة في الواجهة (والخادم هو المرجع)
 *
 * - العنوان بمستوى 2–4 فقط: h1 هو عنوان المقال، وثانٍ يهدم مخطّط المستند.
 * - الصورة بمعرّف أصل و نصّ بديل إلزاميين.
 * - التضمين https ومن قائمة مسموح بها، لا قائمة ممنوعة.
 * - CTA بنصّ ورابط معًا.
 */

/// مطابقة `ALLOWED_EMBED_HOSTS` في الخادم. الخادم يرفض ما عداها؛ عرضها هنا يمنع
/// محاولة حفظ رابط سيُرفض.
const ALLOWED_EMBED_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'player.vimeo.com', 'cdn.majarra.app']

const copy = {
  ar: {
    add: 'إضافة كتلة',
    type: 'نوع الكتلة',
    up: 'تحريك لأعلى',
    down: 'تحريك لأسفل',
    remove: 'حذف الكتلة',
    empty: 'لا كتل. مقال بلا محتوى لا يمكن نشره.',
    heading: 'عنوان فرعي',
    level: 'المستوى',
    paragraph: 'فقرة',
    list: 'قائمة',
    listStyle: 'النمط',
    bullet: 'نقاط',
    number: 'أرقام',
    items: 'العناصر',
    addItem: 'إضافة عنصر',
    removeItem: 'حذف',
    image: 'صورة',
    alt: 'النصّ البديل',
    altHint: 'إلزامي. صورة بلا نصّ بديل غائبة عن قارئ الشاشة وعن بحث الصور، والخادم يرفضها.',
    caption: 'التعليق',
    quote: 'اقتباس',
    attribution: 'النسبة',
    callout: 'تنبيه',
    tone: 'النبرة',
    info: 'معلومة',
    warning: 'تحذير',
    success: 'نجاح',
    embed: 'تضمين',
    url: 'الرابط',
    embedHint: 'https ومن هذه المضيفات فقط:',
    embedInvalid: 'مضيف غير مسموح أو رابط غير https.',
    cta: 'نداء لإجراء',
    ctaLabel: 'نصّ الزرّ',
    ctaHref: 'الرابط',
    related: 'محتوى مرتبط',
    relatedHint: 'معرّفات محتوى مجرّة (سلسلة/حلقة/قصة)، معرّف في كل سطر.',
    divider: 'فاصل',
    dividerHint: 'لا حقول.',
    required: 'حقل مطلوب',
    text: 'النصّ',
    words: 'كلمة',
    blockTypes: {
      heading: 'عنوان فرعي',
      paragraph: 'فقرة',
      list: 'قائمة',
      image: 'صورة',
      quote: 'اقتباس',
      callout: 'تنبيه',
      embed: 'تضمين',
      cta: 'نداء لإجراء',
      related_content: 'محتوى مرتبط',
      divider: 'فاصل',
    } as Record<BlogBlockType, string>,
  },
  en: {
    add: 'Add block',
    type: 'Block type',
    up: 'Move up',
    down: 'Move down',
    remove: 'Delete block',
    empty: 'No blocks. A post with no content cannot be published.',
    heading: 'Heading',
    level: 'Level',
    paragraph: 'Paragraph',
    list: 'List',
    listStyle: 'Style',
    bullet: 'Bulleted',
    number: 'Numbered',
    items: 'Items',
    addItem: 'Add item',
    removeItem: 'Remove',
    image: 'Image',
    alt: 'Alt text',
    altHint: 'Required. An image with no alt text is invisible to screen readers and image search, and the server refuses it.',
    caption: 'Caption',
    quote: 'Quote',
    attribution: 'Attribution',
    callout: 'Callout',
    tone: 'Tone',
    info: 'Info',
    warning: 'Warning',
    success: 'Success',
    embed: 'Embed',
    url: 'URL',
    embedHint: 'https and these hosts only:',
    embedInvalid: 'Host not allowed, or the URL is not https.',
    cta: 'Call to action',
    ctaLabel: 'Button label',
    ctaHref: 'Link',
    related: 'Related content',
    relatedHint: 'Majarra content ids (series/episode/story), one per line.',
    divider: 'Divider',
    dividerHint: 'No fields.',
    required: 'Required field',
    text: 'Text',
    words: 'words',
    blockTypes: {
      heading: 'Heading',
      paragraph: 'Paragraph',
      list: 'List',
      image: 'Image',
      quote: 'Quote',
      callout: 'Callout',
      embed: 'Embed',
      cta: 'Call to action',
      related_content: 'Related content',
      divider: 'Divider',
    } as Record<BlogBlockType, string>,
  },
}

const BLOCK_TYPES: BlogBlockType[] = [
  'heading', 'paragraph', 'list', 'image', 'quote', 'callout', 'embed', 'cta', 'related_content', 'divider',
]

const asString = (value: unknown) => (typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value))
const asItems = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => asString(item)) : [])

export function newBlock(type: BlogBlockType): BlogBlockDraft {
  const key = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  switch (type) {
    case 'heading': return { key, type, level: 2, text: '' }
    case 'list': return { key, type, style: 'bullet', items: [''] }
    case 'related_content': return { key, type, items: [] }
    default: return { key, type }
  }
}

export function embedAllowed(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && ALLOWED_EMBED_HOSTS.includes(parsed.hostname)
  } catch {
    return false
  }
}

/// عدّ الكلمات كما يعدّه الخادم: نصوص الكتل وعناصر القوائم.
export function blockWordCount(blocks: BlogBlockDraft[]): number {
  const text = blocks.flatMap((block) => {
    if (typeof block.text === 'string') return [block.text]
    if (Array.isArray(block.items)) return block.items.filter((item): item is string => typeof item === 'string')
    return []
  }).join(' ')
  return text.split(/\s+/).filter(Boolean).length
}

export function BlockEditor({
  blocks,
  onChange,
  dir,
  canEdit = true,
}: {
  blocks: BlogBlockDraft[]
  onChange: (next: BlogBlockDraft[]) => void
  dir: 'rtl' | 'ltr'
  canEdit?: boolean
}) {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [adding, setAdding] = useState<BlogBlockType>('paragraph')

  function update(index: number, patch: Record<string, unknown>) {
    onChange(blocks.map((block, position) => (position === index ? { ...block, ...patch } : block)))
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next)
  }

  return (
    <div className="block-editor">
      {blocks.length === 0 && <p className="data-unavailable">{text.empty}</p>}

      <ol className="block-editor__list">
        {blocks.map((block, index) => (
          <li className="block-card" key={block.key}>
            <header className="block-card__header">
              <span aria-hidden="true"><Icon name="grip" size={15} /></span>
              <strong>{index + 1}. {text.blockTypes[block.type]}</strong>
              <div className="block-card__tools">
                <button className="icon-button icon-button--small" type="button" aria-label={text.up} disabled={!canEdit || index === 0} onClick={() => move(index, -1)}>
                  <span className="rotate-up" aria-hidden="true"><Icon name="arrow" size={13} /></span>
                </button>
                <button className="icon-button icon-button--small" type="button" aria-label={text.down} disabled={!canEdit || index === blocks.length - 1} onClick={() => move(index, 1)}>
                  <span className="rotate-down" aria-hidden="true"><Icon name="arrow" size={13} /></span>
                </button>
                <button
                  className="icon-button icon-button--small icon-button--danger"
                  type="button"
                  aria-label={text.remove}
                  disabled={!canEdit}
                  onClick={() => onChange(blocks.filter((_, position) => position !== index))}
                ><Icon name="trash" size={13} /></button>
              </div>
            </header>

            <div className="block-card__body entity-form" dir={dir}>
              {block.type === 'heading' && (
                <>
                  <label className="field">
                    <span>{text.level}</span>
                    <select value={Number(block.level ?? 2)} disabled={!canEdit} onChange={(event) => update(index, { level: Number(event.target.value) })}>
                      <option value={2}>H2</option>
                      <option value={3}>H3</option>
                      <option value={4}>H4</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{text.text} *</span>
                    <input value={asString(block.text)} disabled={!canEdit} aria-invalid={!asString(block.text).trim() || undefined} onChange={(event) => update(index, { text: event.target.value })} />
                    {!asString(block.text).trim() && <small className="field__error">{text.required}</small>}
                  </label>
                </>
              )}

              {(block.type === 'paragraph' || block.type === 'quote' || block.type === 'callout') && (
                <label className="field">
                  <span>{text.text} *</span>
                  <textarea rows={block.type === 'paragraph' ? 5 : 3} value={asString(block.text)} disabled={!canEdit} aria-invalid={!asString(block.text).trim() || undefined} onChange={(event) => update(index, { text: event.target.value })} />
                  {!asString(block.text).trim() && <small className="field__error">{text.required}</small>}
                </label>
              )}

              {block.type === 'quote' && (
                <label className="field">
                  <span>{text.attribution}</span>
                  <input value={asString(block.attribution)} disabled={!canEdit} onChange={(event) => update(index, { attribution: event.target.value })} />
                </label>
              )}

              {block.type === 'callout' && (
                <label className="field">
                  <span>{text.tone}</span>
                  <select value={asString(block.tone) || 'info'} disabled={!canEdit} onChange={(event) => update(index, { tone: event.target.value })}>
                    <option value="info">{text.info}</option>
                    <option value="warning">{text.warning}</option>
                    <option value="success">{text.success}</option>
                  </select>
                </label>
              )}

              {(block.type === 'list' || block.type === 'related_content') && (
                <>
                  {block.type === 'list' && (
                    <label className="field">
                      <span>{text.listStyle}</span>
                      <select value={asString(block.style) || 'bullet'} disabled={!canEdit} onChange={(event) => update(index, { style: event.target.value })}>
                        <option value="bullet">{text.bullet}</option>
                        <option value="number">{text.number}</option>
                      </select>
                    </label>
                  )}
                  <div className="section-items">
                    <div className="section-items__head">
                      <strong>{text.items} ({asItems(block.items).length}) *</strong>
                      <button className="button button--ghost button--small" type="button" disabled={!canEdit} onClick={() => update(index, { items: [...asItems(block.items), ''] })}>
                        <Icon name="plus" size={13} />{text.addItem}
                      </button>
                    </div>
                    {block.type === 'related_content' && <small>{text.relatedHint}</small>}
                    {asItems(block.items).length === 0 && <small className="field__error">{text.required}</small>}
                    <ol className="section-items__list">
                      {asItems(block.items).map((item, itemIndex) => (
                        <li key={`${block.key}-item-${itemIndex}`}>
                          <input
                            className="section-items__inline"
                            dir={block.type === 'related_content' ? 'ltr' : dir}
                            value={item}
                            disabled={!canEdit}
                            onChange={(event) => update(index, { items: asItems(block.items).map((entry, position) => (position === itemIndex ? event.target.value : entry)) })}
                          />
                          <button
                            className="icon-button icon-button--small icon-button--danger"
                            type="button"
                            aria-label={text.removeItem}
                            disabled={!canEdit}
                            onClick={() => update(index, { items: asItems(block.items).filter((_, position) => position !== itemIndex) })}
                          ><Icon name="trash" size={13} /></button>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}

              {block.type === 'image' && (
                <>
                  <MediaField
                    label={`${text.image} *`}
                    value={asString(block.asset_id) || null}
                    onChange={(assetId) => update(index, { asset_id: assetId ?? '' })}
                  />
                  <label className="field">
                    <span>{text.alt} *</span>
                    <input value={asString(block.alt)} disabled={!canEdit} aria-invalid={!asString(block.alt).trim() || undefined} onChange={(event) => update(index, { alt: event.target.value })} />
                    <small>{text.altHint}</small>
                    {!asString(block.alt).trim() && <small className="field__error">{text.required}</small>}
                  </label>
                  <label className="field">
                    <span>{text.caption}</span>
                    <input value={asString(block.caption)} disabled={!canEdit} onChange={(event) => update(index, { caption: event.target.value })} />
                  </label>
                </>
              )}

              {block.type === 'embed' && (
                <label className="field">
                  <span>{text.url} *</span>
                  <input dir="ltr" value={asString(block.url)} disabled={!canEdit} aria-invalid={(!!asString(block.url) && !embedAllowed(asString(block.url))) || undefined} onChange={(event) => update(index, { url: event.target.value })} />
                  <small>{text.embedHint} {ALLOWED_EMBED_HOSTS.join(', ')}</small>
                  {!!asString(block.url) && !embedAllowed(asString(block.url)) && <small className="field__error">{text.embedInvalid}</small>}
                </label>
              )}

              {block.type === 'cta' && (
                <div className="field-row">
                  <label className="field">
                    <span>{text.ctaLabel} *</span>
                    <input value={asString(block.label)} disabled={!canEdit} aria-invalid={!asString(block.label).trim() || undefined} onChange={(event) => update(index, { label: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>{text.ctaHref} *</span>
                    <input dir="ltr" value={asString(block.href)} disabled={!canEdit} aria-invalid={!asString(block.href).trim() || undefined} onChange={(event) => update(index, { href: event.target.value })} />
                  </label>
                </div>
              )}

              {block.type === 'divider' && <p className="field__hint">{text.dividerHint}</p>}
            </div>
          </li>
        ))}
      </ol>

      {canEdit && (
        <div className="block-editor__add">
          <label className="field">
            <span>{text.type}</span>
            <select value={adding} onChange={(event) => setAdding(event.target.value as BlogBlockType)}>
              {BLOCK_TYPES.map((type) => <option value={type} key={type}>{text.blockTypes[type]}</option>)}
            </select>
          </label>
          <button className="button button--secondary" type="button" onClick={() => onChange([...blocks, newBlock(adding)])}>
            <Icon name="plus" size={15} />{text.add}
          </button>
          <span className="block-editor__count">{blockWordCount(blocks)} {text.words}</span>
        </div>
      )}
    </div>
  )
}
