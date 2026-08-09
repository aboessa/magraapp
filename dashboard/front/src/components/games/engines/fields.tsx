/**
 * الحقول المشتركة لمحرّرات المحرّكات: أصل، مفتاح ترجمة، رقم، وبطاقة عنصر.
 *
 * ## العلّة التي تُغلقها
 *
 * كل حزمة في المنصّة تشير إلى صورها وأصواتها بمعرّفات نصيّة
 * (`^[A-Za-z0-9_-]{3,128}$`). حقل نصّ حرّ لمعرّف أصل يعني ثلاث علل في وقت واحد:
 * لا يعرف المحرّر ما المعرّفات الموجودة، ولا يرى ما تحتويه الصورة التي اختارها،
 * ولا يكتشف الخطأ المطبعي إلا عند النشر حين يُرفض «الأصل غير موجود». محرّر
 * مطابقة بلا صور ليس محرّرًا مرئيًا، بل نموذج JSON بحقول أجمل.
 *
 * فكل معرّف أصل هنا يحمل ثلاثة أشياء: **معاينة فعلية** للصورة، **منتقيًا** يقرأ
 * `GET /admin/assets` فيبحث بالاسم ويرشّح بالنوع، و**تنبيه صيغة** فوريًا.
 *
 * ## لماذا الأصول تُقرأ كـblob
 *
 * `/admin/assets/:id/content` محروس بالمصادقة، فلا يمكن ربطه بـ`<img src>`
 * مباشرة. القراءة تمرّ بـ`api.assetBlob` ثم `URL.createObjectURL`، والرابط
 * يُحرَّر عند التفريغ: كل معاينة غير محرَّرة تحتجز ذاكرة التبويب حتى إغلاقه،
 * وشاشة فيها ثلاثون بطاقة تعني ثلاثين احتجازًا.
 *
 * ## لماذا تنبيه لا منع
 *
 * الحقول لا ترفض الكتابة: منع الإدخال يمنع أيضًا لصق معرّف صحيح من مكان آخر،
 * ويُخفي عن المحرّر ما كتبه. الصيغة تُعرض كتنبيه بجانب الحقل، والخادم يبقى
 * الحَكَم.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../../Icon'
import { Modal } from '../../Modal'
import { usePreferences } from '../../../context/preferences'
import { api } from '../../../lib/api'
import { ASSET_ID_PATTERN, I18N_KEY_PATTERN } from '../../../lib/enginePack'
import type { AssetRecord } from '../../../types/api'

const copy = {
  ar: {
    browse: 'اختر من المكتبة',
    clear: 'إزالة',
    pickerTitle: 'اختيار أصل',
    pickerHint: 'يُبحث في مكتبة الوسائط. الحالة معروضة كما هي: أصل غير جاهز يمنع النشر لا الحفظ.',
    search: 'بحث بالاسم أو المعرّف',
    kindImage: 'صور',
    kindAudio: 'أصوات',
    loading: 'جارٍ التحميل...',
    empty: 'لا أصول مطابقة.',
    choose: 'اختيار',
    invalidAsset: 'صيغة معرّف الأصل: أحرف وأرقام وشرطة و_ فقط، من 3 إلى 128.',
    invalidKey: 'مفتاح ترجمة: أحرف صغيرة وأرقام و_ ونقاط، مثل game.level_1.prompt.',
    required: 'مطلوب',
    missingPreview: 'لا معاينة: الأصل غير موجود أو لا يمكن قراءته.',
    noAsset: 'لا أصل',
    status: 'الحالة',
    play: 'تشغيل',
    audioUnavailable: 'لا يمكن تشغيل هذا الأصل.',
  },
  en: {
    browse: 'Pick from the library',
    clear: 'Clear',
    pickerTitle: 'Choose an asset',
    pickerHint: 'Searches the media library. States are shown as they are: a not-ready asset blocks publish, not saving.',
    search: 'Search by title or id',
    kindImage: 'Images',
    kindAudio: 'Audio',
    loading: 'Loading...',
    empty: 'No matching assets.',
    choose: 'Choose',
    invalidAsset: 'Asset id shape: letters, digits, dash and underscore only, 3 to 128.',
    invalidKey: 'Translation key: lower case, digits, underscore and dots, e.g. game.level_1.prompt.',
    required: 'Required',
    missingPreview: 'No preview: the asset does not exist or cannot be read.',
    noAsset: 'No asset',
    status: 'State',
    play: 'Play',
    audioUnavailable: 'This asset cannot be played.',
  },
}

/**
 * معاينة صورة أصل.
 *
 * تُعرض علامة صريحة عند الفشل ولا تُترك فارغة: مربّع فارغ لا يفرّق بين «لم
 * يُختَر أصل» و«الأصل مختار وغير موجود»، والثاني هو ما يمنع النشر.
 */
export function AssetThumb({ assetId, size = 56 }: { assetId?: string | null; size?: number }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setUrl('')
    setFailed(false)
    if (!assetId) return
    let live = true
    let objectUrl = ''
    void api.assetBlob(assetId)
      .then((blob) => {
        if (!live) return
        if (!blob.type.startsWith('image/')) { setFailed(true); return }
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => { if (live) setFailed(true) })
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [assetId])

  if (!assetId) {
    return (
      <span className="engine-thumb engine-thumb--empty" style={{ width: size, height: size }} title={text.noAsset}>
        <Icon name="media" size={Math.round(size / 3)} />
      </span>
    )
  }
  if (url) {
    return <img className="engine-thumb" style={{ width: size, height: size }} src={url} alt={assetId} />
  }
  return (
    <span
      className={failed ? 'engine-thumb engine-thumb--failed' : 'engine-thumb engine-thumb--loading'}
      style={{ width: size, height: size }}
      title={failed ? text.missingPreview : text.loading}
      role="img"
      aria-label={failed ? text.missingPreview : text.loading}
    >{failed ? '!' : ''}</span>
  )
}

/// منتقي أصل: يبحث في مكتبة الوسائط ويعرض معاينة كل صفّ.
function AssetPicker({
  open,
  kind,
  onClose,
  onPick,
}: {
  open: boolean
  kind: 'image' | 'audio'
  onClose: () => void
  onPick: (assetId: string) => void
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [term, setTerm] = useState('')
  const [rows, setRows] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.assets({ kind, search: term, limit: 24 })
      setRows(response.data)
    } catch {
      // الفشل يُعرض كقائمة فارغة: المنتقي وسيلة راحة، والحقل النصّي يبقى
      // متاحًا، فرسالة خطأ ثانية هنا لا تضيف قرارًا.
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [kind, term])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => { void load() }, 250)
    return () => window.clearTimeout(timer)
  }, [load, open])

  return (
    <Modal open={open} title={text.pickerTitle} description={text.pickerHint} onClose={onClose}>
      <div className="entity-form">
        <label className="field">
          <span>{text.search}</span>
          <input value={term} onChange={(event) => setTerm(event.target.value)} autoFocus />
        </label>
        {loading && <p className="data-unavailable">{text.loading}</p>}
        {!loading && !rows.length && <p className="data-unavailable">{text.empty}</p>}
        <ul className="engine-picker">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" className="engine-picker__row" onClick={() => { onPick(row.id); onClose() }}>
                {kind === 'image' ? <AssetThumb assetId={row.id} size={48} /> : <Icon name="play" size={20} />}
                <span className="engine-picker__meta">
                  <strong>{row.title_ar || row.id}</strong>
                  <code dir="ltr">{row.id}</code>
                  <small>{text.status}: <span dir="ltr">{row.status}</span></small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}

export interface AssetFieldProps {
  label: string
  value: string | undefined
  onChange: (value: string) => void
  kind: 'image' | 'audio'
  hint?: string
  required?: boolean
  /// يُخفي المعاينة حيث تُعرض الصورة أصلًا في مكان آخر من البطاقة.
  hideThumb?: boolean
}

export function AssetField(props: AssetFieldProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [picking, setPicking] = useState(false)
  const value = props.value ?? ''
  const invalid = value.length > 0 && !ASSET_ID_PATTERN.test(value)

  return (
    <div className="field engine-field">
      <span>
        {props.label}
        {props.required && <em className="engine-field__required" title={text.required}> *</em>}
      </span>
      <div className="engine-field__row">
        {props.kind === 'image' && !props.hideThumb && <AssetThumb assetId={value || null} size={44} />}
        <input
          dir="ltr"
          value={value}
          aria-invalid={invalid || undefined}
          onChange={(event) => props.onChange(event.target.value.trim())}
        />
        <button className="button button--ghost" type="button" onClick={() => setPicking(true)}>
          <Icon name="search" size={15} />{text.browse}
        </button>
        {value && (
          <button className="icon-button icon-button--small" type="button" title={text.clear} onClick={() => props.onChange('')}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {invalid && <small className="engine-field__error">{text.invalidAsset}</small>}
      {props.hint && <small>{props.hint}</small>}
      <AssetPicker open={picking} kind={props.kind} onClose={() => setPicking(false)} onPick={props.onChange} />
    </div>
  )
}

/**
 * حقل مفتاح ترجمة.
 *
 * المفتاح دلالي لا نصّ ظاهر، والخادم يرفض النصّ داخل الحزمة لأنها تصير غير
 * قابلة للترجمة. `suggest` يكتب مفتاحًا مطابقًا للصيغة بضغطة واحدة، لأن مفتاحًا
 * يُكتب حرفًا حرفًا في كل عنصر هو مفتاح سيُكتب خطأً في أحدها.
 */
export function KeyField({
  label,
  value,
  onChange,
  hint,
  required,
  suggest,
}: {
  label: string
  value: string | undefined
  onChange: (value: string) => void
  hint?: string
  required?: boolean
  suggest?: string
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const current = value ?? ''
  const invalid = current.length > 0 && !I18N_KEY_PATTERN.test(current)

  return (
    <div className="field engine-field">
      <span>
        {label}
        {required && <em className="engine-field__required" title={text.required}> *</em>}
      </span>
      <div className="engine-field__row">
        <input
          dir="ltr"
          value={current}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value.trim())}
        />
        {suggest && suggest !== current && (
          <button className="button button--ghost" type="button" onClick={() => onChange(suggest)}>
            <Icon name="sparkles" size={15} /><span dir="ltr">{suggest}</span>
          </button>
        )}
      </div>
      {invalid && <small className="engine-field__error">{text.invalidKey}</small>}
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  suffix,
}: {
  label: string
  value: number | undefined | null
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  hint?: string
  suffix?: string
}) {
  return (
    <label className="field engine-field">
      <span>{label}{suffix ? <small dir="ltr"> {suffix}</small> : null}</span>
      <input
        type="number"
        dir="ltr"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && <small>{hint}</small>}
    </label>
  )
}

/// بطاقة عنصر داخل محرّر: ترويسة بمعرّف وأزرار ترتيب وحذف، ثم الحقول.
export function EditorCard({
  badge,
  title,
  onMoveUp,
  onMoveDown,
  onRemove,
  removeLabel,
  children,
  tone,
}: {
  badge?: ReactNode
  title: ReactNode
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove?: () => void
  removeLabel?: string
  children: ReactNode
  tone?: 'default' | 'warn'
}) {
  const { locale } = usePreferences()
  const up = locale === 'ar' ? 'تقديم' : 'Move earlier'
  const down = locale === 'ar' ? 'تأخير' : 'Move later'
  return (
    <article className={tone === 'warn' ? 'engine-card engine-card--warn' : 'engine-card'}>
      <header className="engine-card__head">
        <div className="engine-card__title">{badge}{title}</div>
        <div className="table-actions">
          {onMoveUp && <button className="icon-button icon-button--small" type="button" title={up} aria-label={up} onClick={onMoveUp}>▲</button>}
          {onMoveDown && <button className="icon-button icon-button--small" type="button" title={down} aria-label={down} onClick={onMoveDown}>▼</button>}
          {onRemove && (
            <button
              className="icon-button icon-button--small icon-button--danger"
              type="button"
              title={removeLabel}
              aria-label={removeLabel}
              onClick={onRemove}
            ><Icon name="close" size={14} /></button>
          )}
        </div>
      </header>
      <div className="engine-card__body">{children}</div>
    </article>
  )
}

/// قسم داخل محرّر مستوى، بعنوان وشرح موجز لسبب وجود الحقول.
export function EditorSection({ title, hint, actions, children }: {
  title: string
  hint?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="engine-section">
      <header className="engine-section__head">
        <div><h4>{title}</h4>{hint && <p>{hint}</p>}</div>
        {actions && <div className="trace-editor__row">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

/// يحرّك عنصرًا داخل مصفوفة، مستخدَم في كل المحرّرات.
export function moveInArray<T>(items: readonly T[], index: number, offset: number): T[] {
  const target = index + offset
  if (target < 0 || target >= items.length) return [...items]
  const next = [...items]
  const moved = next[index]
  const displaced = next[target]
  if (moved === undefined || displaced === undefined) return next
  next[index] = displaced
  next[target] = moved
  return next
}

/// نصّ تأكيد الحذف. الحذف لا يُلغى إلا بتراجع لا يوجد في هذه الشاشات، فالسؤال
/// أرخص من إعادة تأليف عنصر بصوره ومفاتيحه.
export function confirmRemoval(locale: 'ar' | 'en', what: string): boolean {
  return window.confirm(locale === 'ar' ? `سيُحذف ${what}. متابعة؟` : `${what} will be deleted. Continue?`)
}

export function useEditorLocale() {
  const { locale } = usePreferences()
  return useMemo(() => ({ locale, isArabic: locale === 'ar' }), [locale])
}
