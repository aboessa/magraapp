import type { ReactNode } from 'react'
import { useState } from 'react'

export type DetailTab = { key: string; label: string; badge?: number | string; content: ReactNode }

/**
 * تبويبات صفحة التفاصيل (جزء من معيار UX-46). تُعرض فقط التبويبات المناسبة
 * لهذا الكيان تحديدًا — لا قائمة ثابتة تُفرض على كل الكيانات.
 *
 * ## التبويب المُتحكَّم فيه
 *
 * الحالة الداخلية تكفي لصفحة تفاصيل صغيرة، لكنها تكفي فقط لأن أحدًا لا يشارك
 * رابطًا إليها. مساحة عمل بعشرة تبويبات مختلفة الأسئلة تُشارَك بالرابط: «افتح
 * تبويب الإنتاج في كوكب أبجد» يجب أن يكون رابطًا، وزرّ الرجوع يجب أن يعيد
 * التبويب السابق. لذلك يقبل المكوّن `active` و`onChange` ليقود العنوانَ من يريد،
 * ويبقى غير المتحكَّم فيه كما هو لكل مستدعٍ قائم.
 */
export function DetailTabs({
  tabs,
  initial,
  active,
  onChange,
}: {
  tabs: DetailTab[]
  initial?: string
  /// التبويب الحالي من الخارج (عادةً من عنوان الصفحة). مع `onChange` يصير المكوّن متحكَّمًا فيه.
  active?: string
  onChange?: (key: string) => void
}) {
  const [internal, setInternal] = useState(initial ?? tabs[0]?.key)
  const controlled = active !== undefined
  // تبويب مطلوب في العنوان لكنه غير موجود لهذا الكيان (لأن بياناته غير موجودة)
  // يعود إلى الأول بدل لوحة فارغة بلا تفسير.
  const currentKey = controlled ? active : internal
  const current = tabs.find((tab) => tab.key === currentKey) ?? tabs[0]

  const select = (key: string) => {
    if (!controlled) setInternal(key)
    onChange?.(key)
  }

  return (
    <div className="detail-tabs">
      <div className="detail-tabs__list" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={tab.key === current?.key}
            aria-controls={`tabpanel-${tab.key}`}
            className={`detail-tabs__tab ${tab.key === current?.key ? 'detail-tabs__tab--active' : ''}`}
            onClick={() => select(tab.key)}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== '' && <small>{tab.badge}</small>}
          </button>
        ))}
      </div>
      <div
        className="detail-tabs__panel"
        role="tabpanel"
        id={`tabpanel-${current?.key ?? ''}`}
        aria-labelledby={`tab-${current?.key ?? ''}`}
      >{current?.content}</div>
    </div>
  )
}
