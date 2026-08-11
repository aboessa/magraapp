import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'

/**
 * ثلاث طرق عرض لا يصلح الجدول لها: التقويم، الخطّ الزمني، الشجرة
 * (UX-4، UX-5، UX-37).
 *
 * كلها مبنيّة على بيانات حقيقية تُمرّرها الصفحة؛ لا شيء منها يخترع مدخلًا ليبدو
 * ممتلئًا. تقويم بلا عناصر يقول ذلك صراحةً.
 */

// --- التقويم ---------------------------------------------------------------

export interface CalendarItem {
  id: string
  /// تاريخ ISO. العناصر بلا تاريخ لا تُمرَّر إلى التقويم بل تُعرض في قائمة منفصلة.
  at: string
  label: string
  tone?: 'default' | 'scheduled' | 'published' | 'late'
  href?: string
  onOpen?: () => void
}

const monthNames = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

const weekdayNames = {
  ar: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

const calendarCopy = {
  ar: { prev: 'الشهر السابق', next: 'الشهر التالي', today: 'اليوم', empty: 'لا عناصر مجدولة في هذا الشهر.' },
  en: { prev: 'Previous month', next: 'Next month', today: 'Today', empty: 'Nothing scheduled this month.' },
}

const dayKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`

export function CalendarView({ items, emptyLabel }: { items: CalendarItem[]; emptyLabel?: string }) {
  const { locale } = usePreferences()
  const text = calendarCopy[locale]
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const byDay = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const parsed = new Date(item.at)
    if (Number.isNaN(parsed.getTime())) continue
    const key = dayKey(parsed)
    byDay.set(key, [...(byDay.get(key) ?? []), item])
  }

  const firstWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay()
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const cells: Array<{ key: string; date: Date | null }> = []
  for (let index = 0; index < firstWeekday; index += 1) cells.push({ key: `pad-${index}`, date: null })
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), day)
    cells.push({ key: dayKey(date), date })
  }

  const todayKey = dayKey(new Date())
  const monthCount = cells.filter((cell) => cell.date && byDay.has(dayKey(cell.date))).length

  return (
    <div className="calendar">
      <header className="calendar__header">
        <button
          className="icon-button"
          type="button"
          aria-label={text.prev}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        ><Icon name="arrow" size={16} /></button>
        <strong>{monthNames[locale][cursor.getMonth()]} {cursor.getFullYear()}</strong>
        <button
          className="icon-button"
          type="button"
          aria-label={text.next}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        ><Icon name="arrow" size={16} /></button>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={() => { const now = new Date(); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)) }}
        >{text.today}</button>
      </header>

      <div className="calendar__weekdays" aria-hidden="true">
        {weekdayNames[locale].map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="calendar__grid" role="grid">
        {cells.map((cell) => {
          if (!cell.date) return <div className="calendar__cell calendar__cell--pad" key={cell.key} />
          const key = dayKey(cell.date)
          const dayItems = byDay.get(key) ?? []
          return (
            <div
              className={`calendar__cell ${key === todayKey ? 'calendar__cell--today' : ''}`}
              key={cell.key}
              role="gridcell"
            >
              <span className="calendar__day">{cell.date.getDate()}</span>
              <ul>
                {dayItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`calendar__item calendar__item--${item.tone ?? 'default'}`}
                      onClick={item.onOpen}
                      title={item.label}
                    >{item.label}</button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {monthCount === 0 && <p className="data-unavailable">{emptyLabel ?? text.empty}</p>}
    </div>
  )
}

// --- الخطّ الزمني ----------------------------------------------------------

export interface TimelineEntry {
  id: string
  at: string
  title: string
  detail?: ReactNode
  actor?: string | null
  tone?: 'default' | 'warn' | 'danger' | 'good'
}

/// خطّ زمني للمراجعات والتدقيق. الترتيب كما تُمرَّره الصفحة، لأن الخادم هو من
/// يعرف الترتيب الصحيح (نسخة تنازلية للمراجعات، تصاعدية للأحداث).
export function TimelineView({ entries, emptyLabel }: { entries: TimelineEntry[]; emptyLabel: string }) {
  const { locale } = usePreferences()
  if (!entries.length) return <p className="data-unavailable">{emptyLabel}</p>
  return (
    <ol className="timeline">
      {entries.map((entry) => (
        <li className={`timeline__entry timeline__entry--${entry.tone ?? 'default'}`} key={entry.id}>
          <span className="timeline__marker" aria-hidden="true" />
          <div className="timeline__body">
            <div className="timeline__head">
              <strong>{entry.title}</strong>
              <time dir="ltr">{new Date(entry.at).toLocaleString(locale === 'ar' ? 'ar' : 'en-GB')}</time>
            </div>
            {entry.actor && <small>{entry.actor}</small>}
            {entry.detail && <div className="timeline__detail">{entry.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

// --- الشجرة ----------------------------------------------------------------

export interface TreeNode {
  id: string
  label: string
  badge?: string | number
  meta?: string
  /// مسار الكيان. يُفضَّل على `onOpen` لأنه يُنتج `<a href>` حقيقيًّا، فيعمل
  /// النقر الأوسط وفتح في تبويب جديد ونسخ الرابط — وهي أفعال يفعلها المشغّل
  /// كثيرًا في شجرة محتوى ولا يتيحها زرّ يستدعي `navigate()`.
  href?: string
  onOpen?: () => void
  /// شرائح حالة قصيرة تُقرأ مع الصف: نقص، جاهزية، لغة.
  ///
  /// اللون وحده لا يكفي، فكل شريحة تحمل نصًّا. `tone` زيادة على النصّ لا بديل عنه.
  tags?: Array<{ label: string; tone?: 'good' | 'warn' | 'danger' | 'muted' }>
  /// صورة مصغّرة للكيان، إن كانت له صورة.
  thumb?: string | null
  children?: TreeNode[]
}

/// نسخ الشجرة. زرّ الطيّ أيقونة وحدها، فبلا اسم مقروء لا يعرف قارئ الشاشة ما
/// يفعله — وهو ما رصده axe كخطأ حاسم (`button-name`).
const treeCopy = {
  ar: { expand: 'توسيع', collapse: 'طَيّ' },
  en: { expand: 'Expand', collapse: 'Collapse' },
}

function TreeBranch({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1)
  const { locale } = usePreferences()
  const hasChildren = !!node.children?.length
  const label = <>
    {node.thumb && <img className="tree__thumb" src={node.thumb} alt="" loading="lazy" />}
    <span className="tree__title">{node.label}</span>
  </>
  return (
    // ‏`role="treeitem"` لا `<li>` عاريًا: `role="tree"` على الحاوية يُلغي دور
    // القائمة الضمني عن أبنائها، فبلا دور صريح تصير الشجرة حاوية بلا عناصر —
    // رصد axe ذلك خطأين: `aria-required-children` و`listitem`.
    <li className="tree__node" role="treeitem" aria-expanded={hasChildren ? open : undefined}>
      <div className="tree__row" style={{ paddingInlineStart: `${depth * 18}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className="tree__toggle"
            aria-expanded={open}
            aria-label={`${open ? treeCopy[locale].collapse : treeCopy[locale].expand}: ${node.label}`}
            onClick={() => setOpen(!open)}
          ><Icon name="arrow" size={13} /></button>
        ) : <span className="tree__toggle tree__toggle--leaf" aria-hidden="true" />}
        {node.href
          ? <Link className="tree__label" to={node.href}>{label}</Link>
          : node.onOpen
            ? <button type="button" className="tree__label" onClick={node.onOpen}>{label}</button>
            : <span className="tree__label">{label}</span>}
        {node.badge !== undefined && <span className="tree__badge">{node.badge}</span>}
        {node.tags?.map((tag) => (
          <span className={`tree__tag tree__tag--${tag.tone ?? 'muted'}`} key={tag.label}>{tag.label}</span>
        ))}
        {node.meta && <small className="tree__meta">{node.meta}</small>}
      </div>
      {hasChildren && open && (
        // ‏`role="group"` هو الابن الآخر الذي يقبله `tree`، وبه تُنسب الأبناء
        // إلى أبيهم لا إلى الجذر.
        <ul role="group">
          {node.children?.map((child) => <TreeBranch node={child} depth={depth + 1} key={child.id} />)}
        </ul>
      )}
    </li>
  )
}

export function TreeView({ nodes, emptyLabel, label }: { nodes: TreeNode[]; emptyLabel: string; label?: string }) {
  if (!nodes.length) return <p className="data-unavailable">{emptyLabel}</p>
  return (
    <ul className="tree" role="tree" aria-label={label}>
      {nodes.map((node) => <TreeBranch node={node} depth={0} key={node.id} />)}
    </ul>
  )
}
