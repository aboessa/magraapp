import { NotImplementedPage } from '../components/PageState'
import { usePreferences } from '../context/preferences'

/**
 * ربحية المحتوى.
 *
 * ## ما كانت عليه
 *
 * «تكلفة القصة EGP 4,200» و«إيراد 12,400 +194%» و«ميزانية الكوكب 45,000/60,000»
 * و«LTV EGP 420» — كلها ثابتة في الكود، مع شريط تقدّم بنسبة 75% مكتوبة يدويًا.
 * وزرّ «تصدير» كان `alert('تصدير CSV')` لا يصدّر شيئًا.
 *
 * لا جدول تكاليف في أي مهاجرة. تكلفة الإنتاج ليست بيانات يمكن استنتاجها من
 * المحتوى: يجب أن تُدخَل يدويًا أو تُستورد من نظام محاسبة، وكلاهما غير موجود.
 *
 * حساب الربحية يتطلّب طرفين: التكلفة (غير مخزَّنة) والإيراد المنسوب لكل قطعة
 * محتوى (غير محسوب — انظر RevenuePage).
 */
export function AdvancedFinancePage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  return (
    <NotImplementedPage
      eyebrow={ar ? 'المالية المتقدمة' : 'Advanced finance'}
      title={ar ? 'ربحية المحتوى' : 'Content profitability'}
      lede={ar
        ? 'تكلفة الإنتاج والترجمة والترخيص مقابل الإيراد المنسوب لكل قطعة محتوى.'
        : 'Production, translation and licensing cost against revenue attributed to each content item.'}
      planned={ar ? [
        'إدخال تكلفة الإنتاج لكل قصة أو حلقة',
        'تكلفة الترجمة والدبلجة لكل لغة',
        'رسوم الترخيص من rights_licenses',
        'ميزانية لكل كوكب ومقدار المستهلك منها',
        'القيمة الدائمة للمشترك (LTV) ومتوسط عمر الاشتراك',
        'تصدير CSV فعليّ لا زرّ يُوهم بالتصدير',
        'يتطلّب أولًا: جدول تكاليف + نسبة الإيراد لكل محتوى',
      ] : [
        'Manual entry of production cost per story or episode',
        'Translation and dubbing cost per language',
        'Licensing fees sourced from rights_licenses',
        'Per-planet budget and consumed amount',
        'Subscriber lifetime value and average subscription age',
        'A real CSV export rather than a button that pretends to export',
        'Prerequisites: a cost table and per-content revenue attribution',
      ]}
    />
  )
}
