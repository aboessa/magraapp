import { useState } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export type ViewMode = 'table' | 'grid' | 'cards' | 'kanban'

const modeIcon: Record<ViewMode, IconName> = {
  table: 'reviews',
  grid: 'media',
  cards: 'styles',
  kanban: 'seasons',
}

const modeLabel = {
  ar: { table: 'جدول', grid: 'شبكة', cards: 'بطاقات', kanban: 'كانبان' },
  en: { table: 'Table', grid: 'Grid', cards: 'Cards', kanban: 'Kanban' },
}

/**
 * مبدّل طرق العرض (UX-2 / UX-3 في DASHBOARD v3).
 *
 * لا يفرض كل الأوضاع على كل كيان: كل صفحة تمرّر فقط الأوضاع التي تدعمها
 * فعليًا في `modes`. القيمة المختارة يُفترض أن يحفظها المستدعي (مثلًا في
 * localStorage عبر useViewMode) فلا يعود المستخدم لوضع الجدول الافتراضي عند
 * كل تنقل.
 */
export function ViewSwitcher({
  value,
  onChange,
  modes,
  locale,
}: {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  modes: ViewMode[]
  locale: 'ar' | 'en'
}) {
  if (modes.length < 2) return null
  return (
    <div className="view-switcher" role="group" aria-label={locale === 'ar' ? 'طريقة العرض' : 'View mode'}>
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          className={`view-switcher__button ${value === mode ? 'view-switcher__button--active' : ''}`}
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          title={modeLabel[locale][mode]}
        >
          <Icon name={modeIcon[mode]} size={16} />
          <span>{modeLabel[locale][mode]}</span>
        </button>
      ))}
    </div>
  )
}

/// يحفظ اختيار العرض بمفتاح مستقل لكل صفحة، فلا تُفقد التفضيلات بين الزيارات.
export function useStoredViewMode(storageKey: string, fallback: ViewMode): [ViewMode, (mode: ViewMode) => void] {
  const key = `majarra-admin-view:${storageKey}`
  const read = (): ViewMode => {
    try {
      const stored = window.localStorage.getItem(key)
      return (stored as ViewMode) || fallback
    } catch {
      return fallback
    }
  }
  const [mode, setModeState] = useState(read)
  function setMode(next: ViewMode) {
    setModeState(next)
    try { window.localStorage.setItem(key, next) } catch { /* التخزين غير متاح، لا يمنع تبديل العرض */ }
  }
  return [mode, setMode]
}
