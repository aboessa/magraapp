import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'

/**
 * أدوات القوائم المشتركة: العروض المحفوظة، مدير الأعمدة، شريط الإجراءات
 * الجماعية، والعرض السريع (UX-31، UX-32، UX-36، UX-38).
 *
 * ## نطاق العروض المحفوظة هنا مُعلَن لا مُخفى
 *
 * تُحفظ في `localStorage` لهذا المتصفح. المشاركة مع الفريق تحتاج جدولًا في
 * الخادم، وهو موجود لتذاكر الدعم فقط (`support_saved_views`) — فتلك الشاشة
 * تستعمله. أي شاشة أخرى تُعلن في الواجهة أن العرض محلّي، لأن عرضًا يبدو مشتركًا
 * ولا يراه الزميل أسوأ من غيابه.
 */

// --- العروض المحفوظة -------------------------------------------------------

export interface SavedView {
  id: string
  name: string
  /// سلسلة الاستعلام كما هي في العنوان، فيعمل العرض مع أي فلتر تضيفه الصفحة لاحقًا
  search: string
}

function readViews(key: string): SavedView[] {
  try {
    const raw = window.localStorage.getItem(`majarra-admin-views:${key}`)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is SavedView => !!item?.id && !!item?.name) : []
  } catch {
    return []
  }
}

export function useSavedViews(storageKey: string) {
  const [views, setViews] = useState<SavedView[]>(() => readViews(storageKey))

  const persist = useCallback((next: SavedView[]) => {
    setViews(next)
    try { window.localStorage.setItem(`majarra-admin-views:${storageKey}`, JSON.stringify(next)) } catch { /* التخزين غير متاح؛ العرض يبقى للجلسة */ }
  }, [storageKey])

  return {
    views,
    save: (name: string, search: string) => persist([
      ...views.filter((view) => view.name !== name),
      { id: `${Date.now()}`, name, search },
    ]),
    remove: (id: string) => persist(views.filter((view) => view.id !== id)),
  }
}

const viewCopy = {
  ar: {
    label: 'عروض محفوظة',
    save: 'حفظ العرض الحالي',
    name: 'اسم العرض',
    local: 'محفوظة في هذا المتصفح فقط، لا تُشارك مع الفريق.',
    empty: 'لا عروض محفوظة بعد.',
    remove: 'حذف العرض',
    apply: 'تطبيق',
    cancel: 'إلغاء',
    confirm: 'حفظ',
  },
  en: {
    label: 'Saved views',
    save: 'Save current view',
    name: 'View name',
    local: 'Stored in this browser only; not shared with the team.',
    empty: 'No saved views yet.',
    remove: 'Delete view',
    apply: 'Apply',
    cancel: 'Cancel',
    confirm: 'Save',
  },
}

export function SavedViewsMenu({
  storageKey,
  currentSearch,
  onApply,
}: {
  storageKey: string
  currentSearch: string
  onApply: (search: string) => void
}) {
  const { locale } = usePreferences()
  const text = viewCopy[locale]
  const { views, save, remove } = useSavedViews(storageKey)
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const wrapper = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="popover-wrap" ref={wrapper}>
      <button className="button button--ghost" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="eye" size={15} />{text.label}
        {views.length > 0 && <span className="button__count">{views.length}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label={text.label}>
          <p className="popover__note">{text.local}</p>
          {views.length ? (
            <ul className="popover__list">
              {views.map((view) => (
                <li key={view.id}>
                  <button type="button" className="popover__item" onClick={() => { onApply(view.search); setOpen(false) }}>
                    {view.name}
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--small"
                    aria-label={`${text.remove}: ${view.name}`}
                    onClick={() => remove(view.id)}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="popover__empty">{text.empty}</p>}

          {naming ? (
            <div className="popover__form">
              <label className="field">
                <span>{text.name}</span>
                <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
              </label>
              <div className="popover__actions">
                <button
                  className="button button--primary button--small"
                  type="button"
                  disabled={!name.trim()}
                  onClick={() => { save(name.trim(), currentSearch); setName(''); setNaming(false) }}
                >{text.confirm}</button>
                <button className="button button--ghost button--small" type="button" onClick={() => setNaming(false)}>{text.cancel}</button>
              </div>
            </div>
          ) : (
            <button className="button button--ghost button--small popover__cta" type="button" onClick={() => setNaming(true)}>
              <Icon name="plus" size={14} />{text.save}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// --- مدير الأعمدة ----------------------------------------------------------

export interface ColumnDefinition {
  key: string
  label: string
  /// عمود لا يمكن إخفاؤه (عادة اسم الكيان، وإلا صار الجدول بلا هوية لكل صفّ)
  locked?: boolean
}

export function useColumnPreferences(storageKey: string, columns: ColumnDefinition[]) {
  const key = `majarra-admin-columns:${storageKey}`
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  })

  const setHiddenPersisted = useCallback((next: string[]) => {
    setHidden(next)
    try { window.localStorage.setItem(key, JSON.stringify(next)) } catch { /* التخزين غير متاح */ }
  }, [key])

  return {
    hidden,
    isVisible: (columnKey: string) => !hidden.includes(columnKey),
    toggle: (columnKey: string) => {
      const column = columns.find((item) => item.key === columnKey)
      if (column?.locked) return
      setHiddenPersisted(hidden.includes(columnKey) ? hidden.filter((item) => item !== columnKey) : [...hidden, columnKey])
    },
    reset: () => setHiddenPersisted([]),
  }
}

const columnCopy = {
  ar: { label: 'الأعمدة', reset: 'إظهار الكل', locked: 'عمود ثابت' },
  en: { label: 'Columns', reset: 'Show all', locked: 'Always shown' },
}

export function ColumnManager({
  columns,
  hidden,
  onToggle,
  onReset,
}: {
  columns: ColumnDefinition[]
  hidden: string[]
  onToggle: (key: string) => void
  onReset: () => void
}) {
  const { locale } = usePreferences()
  const text = columnCopy[locale]
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="popover-wrap" ref={wrapper}>
      <button className="button button--ghost" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="columns" size={15} />{text.label}
        {hidden.length > 0 && <span className="button__count">{columns.length - hidden.length}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label={text.label}>
          <ul className="popover__checks">
            {columns.map((column) => (
              <li key={column.key}>
                <label className={column.locked ? 'checkbox checkbox--disabled' : 'checkbox'}>
                  <input
                    type="checkbox"
                    checked={!hidden.includes(column.key)}
                    disabled={column.locked}
                    onChange={() => onToggle(column.key)}
                  />
                  <span>{column.label}</span>
                  {column.locked && <small>{text.locked}</small>}
                </label>
              </li>
            ))}
          </ul>
          <button className="button button--ghost button--small popover__cta" type="button" onClick={onReset}>{text.reset}</button>
        </div>
      )}
    </div>
  )
}

// --- شريط الإجراءات الجماعية ------------------------------------------------

const bulkCopy = {
  ar: { selected: 'محدَّد', clear: 'إلغاء التحديد' },
  en: { selected: 'selected', clear: 'Clear selection' },
}

export interface BulkAction {
  key: string
  label: string
  tone?: 'default' | 'danger'
  disabled?: boolean
  onRun: () => void
}

/**
 * شريط الإجراءات الجماعية.
 *
 * لا يعرض إجراءً لا مسار له في الخادم: كل إجراء تمرّره الصفحة يقابل نقطة API
 * حقيقية. الأزرار التي «ستعمل لاحقًا» هي بالضبط ما جعل نصف اللوحة يبدو مُنفَّذًا
 * وهو ليس كذلك.
 */
export function BulkActionBar({
  count,
  actions,
  onClear,
  busy,
}: {
  count: number
  actions: BulkAction[]
  onClear: () => void
  busy?: boolean
}) {
  const { locale } = usePreferences()
  const text = bulkCopy[locale]
  if (count === 0) return null
  return (
    <div className="bulk-bar" role="region" aria-live="polite">
      <strong>{count} {text.selected}</strong>
      <div className="bulk-bar__actions">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`button button--small ${action.tone === 'danger' ? 'button--danger' : 'button--secondary'}`}
            disabled={action.disabled || busy}
            onClick={action.onRun}
          >{action.label}</button>
        ))}
        <button className="button button--ghost button--small" type="button" onClick={onClear}>{text.clear}</button>
      </div>
    </div>
  )
}

// --- العرض السريع ----------------------------------------------------------

/**
 * درج العرض السريع: يقرأ كيانًا بلا مغادرة القائمة (UX-38).
 *
 * الدرج لا يستبدل صفحة التفاصيل، ولذلك يحمل دائمًا رابطًا إليها: قرار «هل أفتح
 * الصفحة الكاملة» يجب أن يكون بيد المستخدم لا بيد المكوّن.
 */
export function QuickView({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const { locale } = usePreferences()
  const panel = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, open])

  if (!open) return null
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside
        className="drawer drawer--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quickview-title"
        tabIndex={-1}
        ref={panel}
      >
        <header className="drawer__header">
          <div>
            <h2 id="quickview-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}>
            <Icon name="close" />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer && <footer className="drawer__footer">{footer}</footer>}
      </aside>
    </div>
  )
}
