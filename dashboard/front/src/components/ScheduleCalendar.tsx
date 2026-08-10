import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'
import { dayKey, scheduleRange, shiftAnchor, startOfWeek } from '../lib/scheduleDates'
import type { ScheduleView } from '../lib/scheduleDates'
import type { CalendarEventRecord } from '../types/api'

/**
 * تقويم جدولة بثلاث دقّات: يوم، أسبوع، شهر — مع سحب وإفلات للإعادة الجدولة.
 *
 * ## السحب لا يكتب هنا
 *
 * `onMove` تُنادى بتاريخ الهدف، والصفحة هي التي تنادي مسار الكيان الذي يُعلنه
 * الحدث نفسه (`event.reschedule`). فالسحب لا يستطيع تجاوز تحقّق ولا مراجعة ولا
 * تدقيق، لأنه لا يكتب شيئًا بنفسه. وحدثٌ يقول `supported: false` لا يُصبح
 * قابلًا للسحب أصلًا، ويحمل سببه في `title`.
 *
 * ## بديل لوحة المفاتيح ليس إضافة لاحقة
 *
 * السحب بالماوس لا يمكن تنفيذه بلوحة مفاتيح، فلا يجوز أن يكون الطريق الوحيد.
 * كل حدث قابل للتحريك يحمل حقل تاريخ في بطاقته: هو نفس العملية بنفس المسار،
 * ويعمل بلوحة المفاتيح وحدها. بلا ذلك تكون إعادة الجدولة ميزة لمن يستطيع السحب
 * فقط.
 */

export type { ScheduleView }

const copy: Record<Locale, {
  day: string; week: string; month: string; today: string; prev: string; next: string
  empty: string; move: string; moveHint: string; conflicts: Record<string, string>
  kinds: Record<string, string>; noMove: string; open: string; moving: string
}> = {
  ar: {
    day: 'يوم', week: 'أسبوع', month: 'شهر', today: 'اليوم',
    prev: 'السابق', next: 'التالي',
    empty: 'لا عناصر مجدولة في هذه المدة.',
    move: 'نقل إلى',
    moveHint: 'التاريخ الجديد يُرسل إلى مسار الكيان نفسه، فيمرّ بتحقّقه وتدقيقه.',
    noMove: 'غير قابل للنقل من التقويم',
    open: 'فتح',
    moving: 'جارٍ النقل…',
    conflicts: {
      no_scheduler: 'لا مُشغِّل ينشر المجدول: يحتاج نشرًا يدويًا',
      lapsed_schedule: 'الموعد مضى ولم يُنشر',
      rights_expiry_before_publication: 'الترخيص ينتهي قبل تاريخ النشر',
      same_day_collision: 'حلقتان من السلسلة نفسها في اليوم نفسه',
    },
    kinds: { scheduled: 'مجدول', published: 'منشور', due: 'مستحق', expires: 'ينتهي' },
  },
  en: {
    day: 'Day', week: 'Week', month: 'Month', today: 'Today',
    prev: 'Previous', next: 'Next',
    empty: 'Nothing scheduled in this range.',
    move: 'Move to',
    moveHint: "The new date is sent to the entity's own endpoint, so it passes its validation and audit.",
    noMove: 'Not movable from the calendar',
    open: 'Open',
    moving: 'Moving…',
    conflicts: {
      no_scheduler: 'No timer publishes a scheduled row: needs a manual publish',
      lapsed_schedule: 'The date has passed and nothing was published',
      rights_expiry_before_publication: 'The licence ends before the publication date',
      same_day_collision: 'Two episodes of one series on the same day',
    },
    kinds: { scheduled: 'Scheduled', published: 'Published', due: 'Due', expires: 'Expires' },
  },
}

const WEEKDAYS: Record<Locale, string[]> = {
  ar: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

const MONTHS: Record<Locale, string[]> = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

function EventCard({
  event, locale, onOpen, onMove, busy,
}: {
  event: CalendarEventRecord
  locale: Locale
  onOpen: (event: CalendarEventRecord) => void
  onMove: (event: CalendarEventRecord, date: string) => void
  busy: boolean
}) {
  const text = copy[locale]
  const movable = event.reschedule.supported
  const conflictLabels = event.conflicts.map((key) => text.conflicts[key] ?? key)

  return (
    <li
      className={`sched__event sched__event--${event.date_kind} ${event.conflicts.length ? 'sched__event--conflict' : ''}`}
      draggable={movable && !busy}
      onDragStart={(dragEvent) => {
        if (!movable) return
        dragEvent.dataTransfer.setData('text/plain', event.id)
        dragEvent.dataTransfer.effectAllowed = 'move'
      }}
      title={movable ? undefined : `${text.noMove}: ${event.reschedule.reason ?? ''}`}
    >
      <button type="button" className="sched__event-open" onClick={() => onOpen(event)}>
        {movable && <span className="sched__grip" aria-hidden="true"><Icon name="grip" size={13} /></span>}
        <span className="sched__event-title">{event.title}</span>
        <span className="sched__event-meta">
          <span className="sched__event-type">{event.type}</span>
          <span className="sched__event-kind">{text.kinds[event.date_kind] ?? event.date_kind}</span>
        </span>
        {event.context && <small className="sched__event-context">{event.context}</small>}
      </button>

      {conflictLabels.length > 0 && (
        <ul className="sched__conflicts">
          {conflictLabels.map((label) => (
            <li key={label}><Icon name="warning" size={12} />{label}</li>
          ))}
        </ul>
      )}

      {movable ? (
        <label className="sched__move">
          <span>{text.move}</span>
          <input
            type="date"
            defaultValue={event.date.slice(0, 10)}
            disabled={busy}
            onChange={(changeEvent) => {
              const value = changeEvent.target.value
              if (value) onMove(event, value)
            }}
          />
        </label>
      ) : (
        <p className="sched__locked">{event.reschedule.reason}</p>
      )}
    </li>
  )
}

export function ScheduleCalendar({
  view, anchor, events, onOpen, onMove, busyId, emptyLabel,
}: {
  view: ScheduleView
  anchor: Date
  events: CalendarEventRecord[]
  onOpen: (event: CalendarEventRecord) => void
  onMove: (event: CalendarEventRecord, date: string) => void
  busyId: string | null
  emptyLabel?: string
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const { days } = useMemo(() => scheduleRange(view, anchor), [anchor, view])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEventRecord[]>()
    for (const event of events) {
      const key = event.date.slice(0, 10)
      map.set(key, [...(map.get(key) ?? []), event])
    }
    return map
  }, [events])

  const todayKey = dayKey(new Date())
  const placed = days.reduce((sum, day) => sum + (byDay.get(dayKey(day))?.length ?? 0), 0)

  // العمود الأول في عرض الشهر يُحشى ليبدأ اليوم الأول في خانة يوم أسبوعه الصحيح.
  const pad = view === 'month' ? days[0]!.getDay() : 0

  return (
    <div className={`sched sched--${view}`}>
      {view !== 'day' && (
        <div className="sched__weekdays" aria-hidden="true">
          {WEEKDAYS[locale].map((day) => <span key={day}>{day}</span>)}
        </div>
      )}

      <div className="sched__grid" role="grid" aria-label={`${MONTHS[locale][anchor.getMonth()]} ${anchor.getFullYear()}`}>
        {Array.from({ length: pad }, (_, index) => (
          <div className="sched__cell sched__cell--pad" key={`pad-${index}`} />
        ))}
        {days.map((day) => {
          const key = dayKey(day)
          const dayEvents = byDay.get(key) ?? []
          return (
            <div
              key={key}
              role="gridcell"
              className={`sched__cell ${key === todayKey ? 'sched__cell--today' : ''} ${dropTarget === key ? 'sched__cell--drop' : ''}`}
              onDragOver={(dragEvent) => { dragEvent.preventDefault(); setDropTarget(key) }}
              onDragLeave={() => setDropTarget((current) => (current === key ? null : current))}
              onDrop={(dragEvent) => {
                dragEvent.preventDefault()
                setDropTarget(null)
                const id = dragEvent.dataTransfer.getData('text/plain')
                const event = events.find((candidate) => candidate.id === id)
                if (event && event.reschedule.supported && event.date.slice(0, 10) !== key) onMove(event, key)
              }}
            >
              <span className="sched__day">
                {view === 'day' ? `${WEEKDAYS[locale][day.getDay()]} ${day.getDate()} ${MONTHS[locale][day.getMonth()]}` : day.getDate()}
              </span>
              {dayEvents.length > 0 && (
                <ul className="sched__events">
                  {dayEvents.map((event) => (
                    <EventCard
                      key={`${event.type}:${event.id}`}
                      event={event}
                      locale={locale}
                      onOpen={onOpen}
                      onMove={onMove}
                      busy={busyId === event.id}
                    />
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {placed === 0 && <p className="data-unavailable">{emptyLabel ?? text.empty}</p>}
      <p className="sched__hint">{text.moveHint}</p>
    </div>
  )
}

export function ScheduleToolbar({
  view, anchor, onView, onAnchor,
}: {
  view: ScheduleView
  anchor: Date
  onView: (view: ScheduleView) => void
  onAnchor: (date: Date) => void
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const label = view === 'month'
    ? `${MONTHS[locale][anchor.getMonth()]} ${anchor.getFullYear()}`
    : view === 'week'
      ? `${dayKey(startOfWeek(anchor))} → ${scheduleRange('week', anchor).to}`
      : dayKey(anchor)

  return (
    <div className="sched__toolbar">
      <div className="view-switcher" role="group">
        {(['day', 'week', 'month'] as ScheduleView[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={view === candidate ? 'active' : ''}
            aria-pressed={view === candidate}
            onClick={() => onView(candidate)}
          >{text[candidate]}</button>
        ))}
      </div>
      <div className="sched__nav">
        <button className="icon-button" type="button" aria-label={text.prev} onClick={() => onAnchor(shiftAnchor(view, anchor, -1))}>
          <Icon name="arrow" size={16} />
        </button>
        <strong dir="ltr">{label}</strong>
        <button className="icon-button" type="button" aria-label={text.next} onClick={() => onAnchor(shiftAnchor(view, anchor, 1))}>
          <Icon name="arrow" size={16} />
        </button>
        <button className="button button--ghost button--small" type="button" onClick={() => onAnchor(new Date())}>{text.today}</button>
      </div>
    </div>
  )
}
