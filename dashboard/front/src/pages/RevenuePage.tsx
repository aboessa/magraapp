import { NotImplementedPage } from '../components/PageState'
import { usePreferences } from '../context/preferences'

/**
 * الإيرادات والتحويل.
 *
 * ## ما كانت عليه
 *
 * كانت تعرض «MRR: EGP 12,400» و«التحويل 18%» و«Retention 72%» وجدول شهرين
 * بأرقام churn — كلها ثابتة في الكود. لا جدول `revenue` ولا `mrr` في أي
 * مهاجرة، ولا نقطة API تحسب أيًّا منها.
 *
 * رقم مالي مُختلق أخطر من صفحة فارغة: يُقتبس في اجتماع ويُبنى عليه قرار تسعير.
 *
 * ## ما يلزم لتنفيذها
 *
 * المصدر المتاح فعلًا هو `billing_audit` (المهاجرة 0008) و`family_projection`،
 * وهما ما تستعلمه `/admin/billing/stats` القائمة. حساب MRR منهما يحتاج سعر
 * المنتج لكل باقة ودولة — وهو ما لا يُخزَّن بعد.
 */
export function RevenuePage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  return (
    <NotImplementedPage
      eyebrow={ar ? 'المالية' : 'Finance'}
      title={ar ? 'الإيرادات والتحويل' : 'Revenue & conversion'}
      lede={ar
        ? 'MRR وARR ومعدّل الإلغاء والاحتفاظ، وصافي الإيراد بعد حصة المتجر.'
        : 'MRR, ARR, churn and retention, plus net revenue after store commission.'}
      planned={ar ? [
        'MRR وARR محسوبان من سجل الشراء في billing_audit',
        'معدّل التحويل من المجاني إلى المدفوع',
        'الاحتفاظ بعد 30 و60 و90 يومًا',
        'الإيراد الإجمالي مقابل الصافي بعد حصة المتجر (15–30%)',
        'تفصيل حسب الدولة والعملة والباقة',
        'يتطلّب أولًا: تخزين سعر المنتج لكل باقة ودولة',
      ] : [
        'MRR and ARR derived from billing_audit purchase records',
        'Free-to-paid conversion rate',
        'Retention at 30, 60 and 90 days',
        'Gross versus net revenue after store commission (15–30%)',
        'Breakdown by country, currency and plan',
        'Prerequisite: storing product price per plan and country',
      ]}
    />
  )
}
