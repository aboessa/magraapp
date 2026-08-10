import { useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'

/**
 * لوحة كانبان قابلة لإعادة الاستخدام.
 *
 * ## ما لا تفعله هذه اللوحة
 *
 * لا تحفظ حالة ولا تعرف قواعد الانتقال. الأعمدة تُمرَّر إليها، والانتقالات
 * المسموحة تُمرَّر لكل بطاقة، و`onMove` تُنادى فتفعل الصفحة الكتابة. السبب أن
 * قواعد سير العمل تعيش في الخادم: `lib/supportCrm.ts` يملك جدول الانتقالات
 * ويُقدّمه في `/admin/support/sla`، فاللوحة لا تستطيع أن تعرض نقلة يرفضها
 * الخادم — ولا أن تنحرف عنه عند إضافة حالة.
 *
 * ## السحب ليس الطريق الوحيد
 *
 * لا يمكن تنفيذ سحب بالماوس بلوحة مفاتيح، فكل بطاقة تحمل قائمة «نقل إلى» تسرد
 * الأعمدة المسموحة نفسها وتنفّذ العملية نفسها. عمود غير مسموح لا يظهر في
 * القائمة ولا يقبل الإفلات، فالمنع واحد في الطريقين.
 *
 * ## التفاؤل مع تراجع
 *
 * `onMove` تُعيد وعدًا. تُنقل البطاقة بصريًّا فورًا (`optimistic`)، وإن رُفض
 * الوعد تعود إلى عمودها وتُعرض رسالة الخادم كما هي. بلا التراجع تكون اللوحة قد
 * كذبت على المستخدم بشأن حالة نظام لا يملكها.
 */

export interface KanbanColumn {
  key: string
  label: string
  /// وصف قصير للعمود، يظهر تحت العنوان.
  hint?: string
  /// حدّ عملي لعدد العناصر (WIP). يُعرض كتحذير لا كمنع.
  wipLimit?: number
}

export interface KanbanCard {
  id: string
  column: string
  title: string
  subtitle?: string | null
  /// شرائح أو بيانات وصفية تُرسمها الصفحة.
  meta?: ReactNode
  tone?: 'default' | 'warn' | 'danger'
  /// الأعمدة التي يجوز نقل هذه البطاقة إليها، من الخادم.
  allowedTargets: string[]
  /// سبب تعذّر النقل، إن كانت `allowedTargets` فارغة.
  lockedReason?: string
}

const copy = {
  ar: {
    moveTo: 'نقل إلى',
    locked: 'لا نقل من هذه الحالة',
    empty: 'لا عناصر',
    wip: (count: number, limit: number) => `${count} من حدّ ${limit}`,
    over: 'فوق الحدّ العملي',
    open: 'فتح',
    moving: 'جارٍ النقل…',
    failed: 'رُفض النقل',
    choose: 'اختر عمودًا',
    total: 'الإجمالي',
  },
  en: {
    moveTo: 'Move to',
    locked: 'No move from this state',
    empty: 'No items',
    wip: (count: number, limit: number) => `${count} of ${limit}`,
    over: 'Over the working limit',
    open: 'Open',
    moving: 'Moving…',
    failed: 'The move was rejected',
    choose: 'Choose a column',
    total: 'Total',
  },
}

export function Kanban({
  columns,
  cards,
  onMove,
  onOpen,
  emptyLabel,
}: {
  columns: KanbanColumn[]
  cards: KanbanCard[]
  /// تُنفّذ النقلة على الخادم. الرفض يُعيد البطاقة ويُعرض نصّ الخطأ.
  onMove: (card: KanbanCard, target: string) => Promise<void>
  onOpen: (card: KanbanCard) => void
  emptyLabel?: string
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [dragging, setDragging] = useState<KanbanCard | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null)
  /// نقلة متفائلة قيد التنفيذ: تُطبَّق على العرض ثم تُلغى عند الرفض.
  const [optimistic, setOptimistic] = useState<{ id: string; column: string } | null>(null)

  const columnOf = (card: KanbanCard) =>
    (optimistic && optimistic.id === card.id ? optimistic.column : card.column)

  async function run(card: KanbanCard, target: string) {
    if (target === columnOf(card) || !card.allowedTargets.includes(target)) return
    setBusyId(card.id)
    setFailure(null)
    setOptimistic({ id: card.id, column: target })
    try {
      await onMove(card, target)
      // لا إلغاء للتفاؤل هنا: الصفحة تُعيد التحميل بعد النجاح فتأتي الحالة من
      // الخادم. إلغاؤه قبل وصول البيانات الجديدة يجعل البطاقة ترتدّ ثم تعود.
    } catch (cause) {
      setOptimistic(null)
      setFailure({
        id: card.id,
        message: cause instanceof Error ? cause.message : text.failed,
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="kanban">
      {columns.map((column) => {
        const columnCards = cards.filter((card) => columnOf(card) === column.key)
        const overLimit = column.wipLimit !== undefined && columnCards.length > column.wipLimit
        const droppable = !!dragging && dragging.allowedTargets.includes(column.key)
        return (
          <section
            key={column.key}
            className={`kanban__column${over === column.key && droppable ? ' kanban__column--drop' : ''}`}
            aria-label={`${column.label} — ${columnCards.length}`}
            onDragOver={(event) => {
              if (!droppable) return
              event.preventDefault()
              setOver(column.key)
            }}
            onDragLeave={() => setOver((current) => (current === column.key ? null : current))}
            onDrop={(event) => {
              event.preventDefault()
              setOver(null)
              const card = dragging
              setDragging(null)
              if (card && droppable) void run(card, column.key)
            }}
          >
            <header className="kanban__head">
              <strong>{column.label}</strong>
              <span className="kanban__count">{columnCards.length}</span>
              {column.hint && <small>{column.hint}</small>}
              {column.wipLimit !== undefined && (
                <small className={overLimit ? 'kanban__wip kanban__wip--over' : 'kanban__wip'}>
                  {text.wip(columnCards.length, column.wipLimit)}
                  {overLimit ? ` — ${text.over}` : ''}
                </small>
              )}
            </header>

            <ul className="kanban__cards">
              {columnCards.map((card) => {
                const movable = card.allowedTargets.length > 0
                return (
                  <li
                    key={card.id}
                    className={`kanban__card kanban__card--${card.tone ?? 'default'}`
                      + `${busyId === card.id ? ' kanban__card--busy' : ''}`
                      + `${dragging?.id === card.id ? ' kanban__card--dragging' : ''}`}
                    draggable={movable && busyId !== card.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', card.id)
                      event.dataTransfer.effectAllowed = 'move'
                      setDragging(card)
                    }}
                    onDragEnd={() => { setDragging(null); setOver(null) }}
                  >
                    <button type="button" className="kanban__open" onClick={() => onOpen(card)}>
                      {movable && <span className="kanban__grip" aria-hidden="true"><Icon name="grip" size={12} /></span>}
                      <span className="kanban__title">{card.title}</span>
                      {card.subtitle && <small dir="auto">{card.subtitle}</small>}
                    </button>
                    {card.meta && <div className="kanban__meta">{card.meta}</div>}

                    {movable ? (
                      <label className="kanban__move">
                        <span>{text.moveTo}</span>
                        <select
                          value=""
                          disabled={busyId === card.id}
                          onChange={(event) => { if (event.target.value) void run(card, event.target.value) }}
                        >
                          <option value="">{text.choose}</option>
                          {card.allowedTargets.map((target) => (
                            <option value={target} key={target}>
                              {columns.find((entry) => entry.key === target)?.label ?? target}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="kanban__locked">{card.lockedReason ?? text.locked}</p>
                    )}

                    {busyId === card.id && <p className="kanban__status" role="status">{text.moving}</p>}
                    {failure?.id === card.id && (
                      <p className="kanban__status kanban__status--error" role="alert">{failure.message}</p>
                    )}
                  </li>
                )
              })}
            </ul>

            {columnCards.length === 0 && <p className="kanban__empty">{emptyLabel ?? text.empty}</p>}
          </section>
        )
      })}
    </div>
  )
}
