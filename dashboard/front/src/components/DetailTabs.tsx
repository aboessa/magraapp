import type { ReactNode } from 'react'
import { useState } from 'react'

export type DetailTab = { key: string; label: string; badge?: number | string; content: ReactNode }

/**
 * تبويبات صفحة التفاصيل (جزء من معيار UX-46). تُعرض فقط التبويبات المناسبة
 * لهذا الكيان تحديدًا — لا قائمة ثابتة تُفرض على كل الكيانات.
 */
export function DetailTabs({ tabs, initial }: { tabs: DetailTab[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.key)
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0]

  return (
    <div className="detail-tabs">
      <div className="detail-tabs__list" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === current?.key}
            className={`detail-tabs__tab ${tab.key === current?.key ? 'detail-tabs__tab--active' : ''}`}
            onClick={() => setActive(tab.key)}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== '' && <small>{tab.badge}</small>}
          </button>
        ))}
      </div>
      <div className="detail-tabs__panel" role="tabpanel">{current?.content}</div>
    </div>
  )
}
