import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: { loading: 'جارٍ تحميل البيانات...', error: 'تعذر تحميل البيانات', retry: 'إعادة المحاولة' },
  en: { loading: 'Loading data...', error: 'Unable to load data', retry: 'Try again' },
}

/**
 * حالات الصفحة المشتركة.
 *
 * ## لماذا `role="status"` و`role="alert"` هنا
 *
 * قارئ الشاشة لا يرى دوّارة التحميل. بلا منطقة حيّة يبقى المستخدم على إعلان
 * الصفحة السابق بلا أي إشارة إلى أن شيئًا يحدث، ثم تظهر النتيجة صامتة. `status`
 * مؤدَّب (يُعلَن عند فراغ القارئ) و`alert` مُقاطِع — وهو الصحيح للخطأ لأن
 * المستخدم ينتظر بيانات لن تأتي. أُضيفا بعد أن كشف اختبار الواجهة غيابهما.
 */
export function LoadingState({ label }: { label?: string }) {
  const { locale } = usePreferences()
  return (
    <div className="page-state page-state--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label ?? copy[locale].loading}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { locale } = usePreferences()
  return (
    <div className="page-state page-state--error" role="alert">
      <span className="page-state__symbol">!</span>
      <h3>{copy[locale].error}</h3>
      <p>{message}</p>
      {onRetry && <button className="button button--secondary" type="button" onClick={onRetry}><Icon name="refresh" size={17} />{copy[locale].retry}</button>}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-state page-state--empty">
      <span className="page-state__symbol">◇</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

/*
 * حُذف من هنا `NotImplementedPage` ونصوصه (`ADM-107`، الدفعة 42).
 *
 * كان مُعرَّفًا وغير مستخدَم في أي صفحة: تسع صفحات استعملته يومًا ثم صارت كلّها
 * شاشاتٍ حقيقية تنادي الخادم. وبقاؤه ليس ترتيبًا مؤجَّلًا — أربع وثائق كانت
 * تستشهد بوجوده دليلًا على أن ثماني وجهات «غير مُنفَّذة»، فصار الكود الميت
 * مصدرَ حُكمٍ خاطئ عن حالة المنصّة.
 */
