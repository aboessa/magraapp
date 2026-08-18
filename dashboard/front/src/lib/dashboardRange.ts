/**
 * نطاق الداشبورد — يُمرَّر كـ range/from/to إلى /admin/dashboard/stats و /admin/dashboard/executive.
 * مستخرج من DashboardPage.tsx لتقليل حجم ملف الصفحة.
 */

export const DASHBOARD_VERSION = '1.0'

export type DashboardRange = 'today' | '7d' | '30d' | 'all'

export function rangeToParams(range: DashboardRange): { range?: string; from?: string; to?: string } {
  const now = new Date()
  const to = now.toISOString()
  if (range === 'all') return {}
  if (range === 'today') {
    const start = new Date(now); start.setHours(0,0,0,0)
    return { range, from: start.toISOString(), to }
  }
  if (range === '7d') {
    const from = new Date(now.getTime() - 7*24*60*60*1000).toISOString()
    return { range, from, to }
  }
  if (range === '30d') {
    const from = new Date(now.getTime() - 30*24*60*60*1000).toISOString()
    return { range, from, to }
  }
  return { range }
}
