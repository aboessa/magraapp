/**
 * حساب نوافذ التقويم: يوم، أسبوع، شهر.
 *
 * دوال خالصة بلا React عن قصد، لسببين: تُختبر وحدها بلا رسم، والمكوّن
 * `ScheduleCalendar` يبقى مكوّنات فقط فلا يُبطل التحديث السريع أثناء التطوير.
 */

export type ScheduleView = 'day' | 'week' | 'month'

/**
 * مفتاح اليوم بالتوقيت المحلّي، لا بـ`toISOString` الذي يحوّل إلى UTC.
 *
 * الفرق ليس تفصيلًا: حدث في الحادية عشرة مساءً بتوقيت الرياض يظهر في اليوم
 * التالي لو حُسب مفتاحه بـUTC، فيرسم التقويم يومًا خاطئًا ويبدو أن الجدولة
 * انزلقت.
 */
export function dayKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function startOfWeek(value: Date): Date {
  const start = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  start.setDate(start.getDate() - start.getDay())
  return start
}

/// نافذة الأيام المعروضة، وهي نفسها نافذة الاستعلام من الخادم.
export function scheduleRange(view: ScheduleView, anchor: Date): { from: string; to: string; days: Date[] } {
  if (view === 'day') {
    const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
    return { from: dayKey(day), to: dayKey(day), days: [day] }
  }
  if (view === 'week') {
    const start = startOfWeek(anchor)
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
    return { from: dayKey(days[0]!), to: dayKey(days[6]!), days }
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const days = Array.from({ length: last.getDate() }, (_, index) =>
    new Date(anchor.getFullYear(), anchor.getMonth(), index + 1))
  return { from: dayKey(first), to: dayKey(last), days }
}

/// التنقّل بمقدار دقّة العرض نفسها: يوم ليوم، أسبوع لأسبوع، شهر لشهر.
export function shiftAnchor(view: ScheduleView, anchor: Date, direction: -1 | 1): Date {
  const next = new Date(anchor)
  if (view === 'day') next.setDate(anchor.getDate() + direction)
  else if (view === 'week') next.setDate(anchor.getDate() + 7 * direction)
  // اليوم الأول صراحةً: `setMonth` على يوم ٣١ في شهر من ٣٠ يومًا ينزلق شهرًا كاملًا.
  else next.setMonth(anchor.getMonth() + direction, 1)
  return next
}
