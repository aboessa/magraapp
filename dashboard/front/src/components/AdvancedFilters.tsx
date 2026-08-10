import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'

/**
 * الفلاتر المتقدّمة: تعريف واحد يقود الدرج والشرائح معًا (UX-30…UX-35).
 *
 * ## لماذا تعريف بيانات لا JSX لكل صفحة
 *
 * كل صفحة قائمة كانت تكتب `<select>` بيدها، فاختلف ترتيب الفلاتر وتسميتها
 * وسلوك «الكل» بين الشاشات، ولم يكن لأي منها شرائح تُظهر ما هو مُطبَّق. هنا
 * الصفحة تُصرّح بالحقول، والمكوّن يرسم الدرج، والشرائح، وعدّاد الفلاتر النشطة،
 * وزرّ المسح — فيستحيل أن تنسى شاشةٌ واحدةً منها.
 *
 * ## القاعدة التي يفرضها الدرج
 *
 * الفلاتر لا تُطبَّق إلا بالزرّ. التطبيق الفوري على كل ضغطة في درج فيه ثمانية
 * حقول يعني ثمانية نداءات وثماني حالات وسيطة لا يريدها أحد.
 */
export type FilterFieldType = 'select' | 'text' | 'date' | 'boolean'

export interface FilterField {
  key: string
  label: string
  type: FilterFieldType
  /// خيارات `select`. القيمة الفارغة تعني «الكل» ويجب أن تكون أول عنصر.
  options?: Array<{ value: string; label: string }>
  hint?: string
  /// نصّ الشريحة عند التطبيق. الافتراضي `label: value`.
  chip?: (value: string) => string
}

const copy = {
  ar: {
    filters: 'فلاتر',
    apply: 'تطبيق',
    clear: 'مسح الكل',
    close: 'إغلاق',
    title: 'فلاتر متقدّمة',
    hint: 'الفلاتر تُحفظ في عنوان الصفحة، فالرابط قابل للمشاركة والتحديث لا يُفقدها.',
    all: 'الكل',
    yes: 'نعم',
    no: 'لا',
    remove: 'إزالة الفلتر',
    active: 'فلاتر مُطبَّقة',
  },
  en: {
    filters: 'Filters',
    apply: 'Apply',
    clear: 'Clear all',
    close: 'Close',
    title: 'Advanced filters',
    hint: 'Filters live in the URL, so the link is shareable and a refresh does not lose them.',
    all: 'All',
    yes: 'Yes',
    no: 'No',
    remove: 'Remove filter',
    active: 'Active filters',
  },
}

/// درج جانبي للفلاتر. يُدار بلوحة المفاتيح: Escape يُغلق، والتركيز يعود لمُفتِّحه.
export function FilterDrawer({
  open,
  fields,
  values,
  onApply,
  onClear,
  onClose,
}: {
  open: boolean
  fields: FilterField[]
  values: Record<string, string>
  onApply: (next: Record<string, string>) => void
  onClear: () => void
  onClose: () => void
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [draft, setDraft] = useState(values)
  const panel = useRef<HTMLDivElement | null>(null)

  // المسوّدة تُعاد إلى القيم المُطبَّقة عند كل فتح: درج يفتح بتعديلات لم تُطبَّق
  // من جلسة سابقة يجعل الشرائح المعروضة تكذب على المستخدم.
  useEffect(() => { if (open) setDraft(values) }, [open, values])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const first = panel.current?.querySelector<HTMLElement>('input, select, button')
    first?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="filter-drawer-title" ref={panel}>
        <header className="drawer__header">
          <div>
            <h2 id="filter-drawer-title">{text.title}</h2>
            <p>{text.hint}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={text.close}><Icon name="close" /></button>
        </header>
        <div className="drawer__body">
          <div className="entity-form">
            {fields.map((field) => (
              <label className="field" key={field.key}>
                <span>{field.label}</span>
                {field.type === 'select' ? (
                  <select
                    value={draft[field.key] ?? ''}
                    onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                  >
                    {(field.options ?? []).map((option) => (
                      <option value={option.value} key={option.value || 'all'}>{option.label}</option>
                    ))}
                  </select>
                ) : field.type === 'boolean' ? (
                  <select
                    value={draft[field.key] ?? ''}
                    onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                  >
                    <option value="">{text.all}</option>
                    <option value="1">{text.yes}</option>
                    <option value="0">{text.no}</option>
                  </select>
                ) : (
                  <input
                    type={field.type === 'date' ? 'date' : 'text'}
                    value={draft[field.key] ?? ''}
                    onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                  />
                )}
                {field.hint && <small>{field.hint}</small>}
              </label>
            ))}
          </div>
        </div>
        <footer className="drawer__footer">
          <button className="button button--primary" type="button" onClick={() => { onApply(draft); onClose() }}>
            <Icon name="check" size={15} />{text.apply}
          </button>
          <button className="button button--ghost" type="button" onClick={() => { onClear(); onClose() }}>{text.clear}</button>
        </footer>
      </aside>
    </div>
  )
}

/// شرائح الفلاتر المُطبَّقة. كلٌّ منها قابلة للإزالة وحدها.
export function ActiveFilterChips({
  fields,
  values,
  defaults,
  onRemove,
  onClearAll,
}: {
  fields: FilterField[]
  values: Record<string, string>
  defaults: Record<string, string>
  onRemove: (key: string) => void
  onClearAll: () => void
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const active = fields.filter((field) => (values[field.key] ?? '') !== (defaults[field.key] ?? ''))
  if (!active.length) return null

  const labelFor = (field: FilterField) => {
    const value = values[field.key] ?? ''
    if (field.chip) return field.chip(value)
    const option = field.options?.find((item) => item.value === value)
    return `${field.label}: ${option?.label ?? value}`
  }

  return (
    <div className="filter-chips" aria-label={text.active}>
      {active.map((field) => (
        <span className="filter-chip" key={field.key}>
          <span>{labelFor(field)}</span>
          <button type="button" onClick={() => onRemove(field.key)} aria-label={`${text.remove}: ${field.label}`}>
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      <button className="button button--ghost button--small" type="button" onClick={onClearAll}>{text.clear}</button>
    </div>
  )
}

/// زرّ فتح الدرج مع عدّاد الفلاتر النشطة.
export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  return (
    <button className={`button button--ghost ${count ? 'button--has-count' : ''}`} type="button" onClick={onClick}>
      <Icon name="filter" size={15} />
      {text.filters}
      {count > 0 && <span className="button__count">{count}</span>}
    </button>
  )
}

/// شريط أدوات القائمة: بحث + فلاتر + شرائح + فتحات للأدوات الأخرى.
export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  fields,
  values,
  defaults,
  onApply,
  onClear,
  onRemove,
  trailing,
}: {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  fields: FilterField[]
  values: Record<string, string>
  defaults: Record<string, string>
  onApply: (next: Record<string, string>) => void
  onClear: () => void
  onRemove: (key: string) => void
  /// أدوات إضافية: مبدّل العرض، مدير الأعمدة، العروض المحفوظة، زرّ الإنشاء
  trailing?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const activeCount = fields.filter((field) => (values[field.key] ?? '') !== (defaults[field.key] ?? '')).length

  return (
    <>
      <div className="filters-row filters-row--toolbar">
        {onSearchChange && (
          <label className="search-field">
            <Icon name="search" size={17} />
            <input
              value={searchValue ?? ''}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </label>
        )}
        {fields.length > 0 && <FilterButton count={activeCount} onClick={() => setOpen(true)} />}
        {trailing}
      </div>
      <ActiveFilterChips fields={fields} values={values} defaults={defaults} onRemove={onRemove} onClearAll={onClear} />
      <FilterDrawer
        open={open}
        fields={fields}
        values={values}
        onApply={onApply}
        onClear={onClear}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
