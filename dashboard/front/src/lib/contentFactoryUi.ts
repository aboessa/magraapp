import type { Locale } from '../context/preferences'
import type { ContentFactoryRunState } from '../types/api'

const stateLabels: Record<Locale, Record<ContentFactoryRunState, string>> = {
  ar: {
    planned: 'مخطط',
    blocked: 'محجوب',
    awaiting_spend_approval: 'بانتظار اعتماد الإنفاق',
    approved: 'الإنفاق معتمد',
    queued: 'في الطابور',
    running: 'قيد التشغيل',
    paused: 'متوقف مؤقتًا',
    awaiting_qc: 'بانتظار الفحص الآلي',
    awaiting_human_review: 'بانتظار المراجعة البشرية',
    partially_failed: 'فشل جزئي',
    failed: 'فشل',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  },
  en: {
    planned: 'Planned',
    blocked: 'Blocked',
    awaiting_spend_approval: 'Awaiting spend approval',
    approved: 'Spend approved',
    queued: 'Queued',
    running: 'Running',
    paused: 'Paused',
    awaiting_qc: 'Awaiting automated QC',
    awaiting_human_review: 'Awaiting human review',
    partially_failed: 'Partially failed',
    failed: 'Failed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },
}

export const contentFactoryRunStates = Object.keys(stateLabels.en) as ContentFactoryRunState[]

export function factoryStateLabel(locale: Locale, state: ContentFactoryRunState) {
  return stateLabels[locale][state]
}

export function factoryStateTone(state: ContentFactoryRunState) {
  if (state === 'completed') return 'success'
  if (state === 'blocked' || state === 'failed' || state === 'partially_failed') return 'danger'
  if (state === 'approved') return 'approved'
  if (state === 'awaiting_spend_approval' || state === 'awaiting_qc' || state === 'awaiting_human_review') return 'warning'
  if (state === 'running' || state === 'queued') return 'active'
  return 'neutral'
}

export function formatCredits(value: number | null, locale: Locale) {
  if (value === null) return '—'
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value)
}

export function formatFactoryDate(value: string | null, locale: Locale) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}
