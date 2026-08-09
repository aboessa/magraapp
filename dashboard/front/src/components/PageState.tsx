import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: { loading: 'جارٍ تحميل البيانات...', error: 'تعذر تحميل البيانات', retry: 'إعادة المحاولة' },
  en: { loading: 'Loading data...', error: 'Unable to load data', retry: 'Try again' },
}

export function LoadingState({ label }: { label?: string }) {
  const { locale } = usePreferences()
  return <div className="page-state page-state--loading"><span className="spinner" aria-hidden="true" /><p>{label ?? copy[locale].loading}</p></div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { locale } = usePreferences()
  return (
    <div className="page-state page-state--error">
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

const notImplemented = {
  ar: {
    eyebrow: 'غير مُنفَّذ',
    heading: 'هذه الشاشة لم تُبنَ بعد',
    noBackend: 'لا يوجد جدول ولا نقطة API لهذه الميزة في الخادم بعد.',
    plannedTitle: 'المخطَّط عند التنفيذ',
    why:
      'كانت هذه الصفحة تعرض أرقامًا ثابتة مكتوبة في الكود تبدو كبيانات حقيقية. '
      + 'أُزيلت لأن قراءة رقم مُختلق كأنه حقيقي أسوأ من عدم رؤية شيء: قد يُبنى عليه قرار.',
  },
  en: {
    eyebrow: 'Not implemented',
    heading: 'This screen has not been built yet',
    noBackend: 'There is no table or API endpoint for this feature on the server yet.',
    plannedTitle: 'Planned scope',
    why:
      'This page used to display hardcoded numbers that looked like real data. '
      + 'They were removed because reading an invented figure as fact is worse than seeing nothing: a decision could be based on it.',
  },
}

/**
 * شاشة ميزة غير مُنفَّذة.
 *
 * ## لماذا مكوّن مشترك
 *
 * تسع صفحات كانت تعرض بيانات مخترعة: إيرادات وتكاليف وأسعار باقات ونِسَب
 * التزام ومدارس وطلاب. لا جدول ولا نقطة API لأي منها في الخادم — تحقّقتُ من
 * مهاجرات قاعدة البيانات كلها. تكرار الرسالة تسع مرات يجعلها تتباعد صياغةً،
 * فالنص هنا في مكان واحد.
 *
 * ## القاعدة التي يفرضها
 *
 * لا رقم على الشاشة إلا من الخادم. تُعرض حدود الميزة المخطَّطة كنص وصفيّ
 * صريح — وهو معلومة نافعة للفريق — دون تلبيسها هيئة قياسات أو مؤشّرات.
 *
 * النمط نفسه المستخدم في SupportCenterPage.tsx: `panel--notice` مع إعلان صريح
 * عمّا ليس مُنفَّذًا بدل زرّ يُوهم بالعمل.
 */
export function NotImplementedPage({
  eyebrow,
  title,
  lede,
  planned,
}: {
  /// قسم الميزة، كما كان معروضًا قبل الإزالة
  eyebrow: string
  title: string
  /// وصف الميزة كما هي مخطَّطة
  lede: string
  /// بنود النطاق المخطَّط. نصٌّ وصفيّ لا أرقام.
  planned: string[]
}) {
  const { locale } = usePreferences()
  const text = notImplemented[locale]

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{lede}</p>
        </div>
      </section>

      <div className="page-state page-state--empty">
        <span className="page-state__symbol">◇</span>
        <h3>{text.heading}</h3>
        <p>{text.noBackend}</p>
      </div>

      {planned.length ? (
        <section className="panel">
          <div className="panel__header"><h3>{text.plannedTitle}</h3></div>
          <div className="entity-form">
            <ul className="planned-list">
              {planned.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="panel panel--notice">
        <strong>{text.eyebrow}</strong>
        <p>{text.why}</p>
      </section>
    </div>
  )
}
