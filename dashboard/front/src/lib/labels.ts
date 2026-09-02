import type { Locale } from '../context/preferences'
import type { AgeTrack, ContentStatus, ParentRecord } from '../types/api'

export const statusLabels: Record<Locale, Record<ContentStatus, string>> = {
  ar: {
    draft: 'مسودة', writing: 'كتابة', review_edu: 'مراجعة تعليمية', review_lang: 'مراجعة لغوية',
    review_sharia: 'مراجعة شرعية', production: 'إنتاج', qa: 'جودة', ready: 'جاهز',
    scheduled: 'مجدول', published: 'منشور', archived: 'مؤرشف',
  },
  en: {
    draft: 'Draft', writing: 'Writing', review_edu: 'Educational review', review_lang: 'Language review',
    review_sharia: 'Values review', production: 'Production', qa: 'Quality assurance', ready: 'Ready',
    scheduled: 'Scheduled', published: 'Published', archived: 'Archived',
  },
}

/**
 * تسمية مسار عمريّ قيمته نصّ من الخادم لا `AgeTrack` مضمونة.
 *
 * كانت الصفحات تكتب `trackLabels[locale as any][value]`، و`as any` هو ما كان
 * يُسكت الفحص: قيمةٌ لا يعرفها الجدول تُنتج `undefined` فتظهر **شارة فارغة** لا
 * أثر لها في السجل. هنا تظهر القيمة الخام بدل الفراغ، فيُرى الخلل ولا يُخفى.
 */
export function trackLabel(locale: Locale, value: string): string {
  return trackLabels[locale][value as AgeTrack] ?? value
}

export const trackLabels: Record<Locale, Record<AgeTrack, string>> = {
  ar: { preschool: 'البراعم 3–5', kids: 'المستكشفون 6–8', junior: 'الروّاد 9–12' },
  en: { preschool: 'Preschool 3–5', kids: 'Explorers 6–8', junior: 'Pioneers 9–12' },
}

const TRACKS: AgeTrack[] = ['preschool', 'kids', 'junior']

/// المسارات العمرية كقائمة قابلة للعرض، أيًّا كان شكل الحقل القادم من الخادم.
///
/// `track_ids` مُعلَن `AgeTrack[]`، لكن كل استعلامات الإدارة تجمعه بـ
/// GROUP_CONCAT، فأي مسار ينسى تفكيكه يُعيد نصًّا («kids,junior») أو null.
/// النداء المباشر لـ`.map` على ذلك يرفع TypeError داخل التصيير، فتُفرَّغ الصفحة
/// بكاملها بسبب حقل شارة واحد. التطبيع هنا يجعل الحقل التالف يُخفي الشارات فقط.
export function trackList(value: unknown): AgeTrack[] {
  const parts = Array.isArray(value)
    ? value
    : typeof value === 'string' && value ? value.split(',') : []
  return parts.filter((track): track is AgeTrack => TRACKS.includes(track as AgeTrack))
}

export const planLabels: Record<Locale, Record<ParentRecord['plan'], string>> = {
  ar: { free: 'مجاني', family: 'عائلة', family_plus: 'عائلة بلس' },
  en: { free: 'Free', family: 'Family', family_plus: 'Family Plus' },
}

export const accountStatusLabels: Record<Locale, Record<ParentRecord['status'], string>> = {
  ar: { active: 'نشط', suspended: 'موقوف', archived: 'مؤرشف' },
  en: { active: 'Active', suspended: 'Suspended', archived: 'Archived' },
}

import { DEFAULT_LOCALE_MAP } from './constants.ts'
export function localeCode(locale: Locale) {
  return (DEFAULT_LOCALE_MAP as any)[locale] ?? (locale === 'ar' ? 'ar-EG' : 'en-US')
}

export function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(localeCode(locale)).format(value)
}

export function formatDate(value: string | number | null | undefined, locale: Locale, includeTime = false) {
  if (value == null || value === '') return '—'
  const date = new Date(typeof value === 'number' ? value : String(value))
  if (Number.isNaN(date.getTime())) return '—'
  const options: Intl.DateTimeFormatOptions = includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }
  return new Intl.DateTimeFormat(localeCode(locale), options).format(date)
}

export function formatDateTime(value: string | number | null | undefined, locale: Locale) {
  return formatDate(value, locale, true)
}
