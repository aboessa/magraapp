import { NotImplementedPage } from '../components/PageState'
import { usePreferences } from '../context/preferences'

/**
 * إدارة SLA والتكاملات.
 *
 * ## ما كانت عليه
 *
 * «68% التزام - 3 متأخرة» مع شريط تقدّم مرسوم على 68% — رقمان مخترعان يقيسان
 * أداء الفريق. ومهل «لغوية 24 ساعة • دينية 48 ساعة» معروضة كسياسة مُطبَّقة، وهي
 * ليست مخزَّنة في أي مكان ولا يقرأها أي كود. و«تصعيد تلقائي عند التأخير» معلَن
 * وغير مُنفَّذ. وزرَّا Slack وAI كلاهما `alert()`.
 *
 * رقم التزام مخترع خطر بنوع خاص: قد يُقرأ كتقييم أداء لمراجعين حقيقيين.
 *
 * ## ما هو متاح فعلًا
 *
 * الأساس موجود جزئيًا: `content_reviews` (المهاجرة 0002) و`workflow_runs`
 * (0014) يحملان `created_at` و`updated_at`، فمدّة كل مراجعة **قابلة للقياس**.
 * والناقص هو تعريف المهلة نفسها: لا جدول سياسات SLA، فلا مرجع نُقيس عليه
 * الالتزام.
 *
 * أي أن هذه أقرب الصفحات التسع للتنفيذ: تحتاج جدول سياسات + استعلامًا تجميعيًا،
 * لا نموذج بيانات جديدًا.
 */
export function OpsSlaPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  return (
    <NotImplementedPage
      eyebrow={ar ? 'التشغيل' : 'Operations'}
      title={ar ? 'إدارة SLA والتكاملات' : 'SLA & integrations'}
      lede={ar
        ? 'مهل المراجعة لكل نوع، والتصعيد عند التأخير، وتكاملات الإشعارات الخارجية.'
        : 'Per-type review deadlines, escalation on delay, and external notification integrations.'}
      planned={ar ? [
        'جدول سياسات SLA: مهلة لكل نوع مراجعة — غير موجود',
        'قياس مدّة المراجعة الفعلية من content_reviews و workflow_runs',
        'نسبة الالتزام وقائمة المراجعات المتأخرة، محسوبتان لا مكتوبتين',
        'تصعيد تلقائي عند تجاوز المهلة — معلَن سابقًا وغير مُنفَّذ',
        'تكامل Slack أو Teams لإشعار المراجعين',
        'مساعد آليّ لاقتراح الميتاداتا وفحص الجودة',
      ] : [
        'An SLA policy table defining a deadline per review type — does not exist',
        'Measuring actual review duration from content_reviews and workflow_runs',
        'Compliance rate and overdue review list, computed rather than hardcoded',
        'Automatic escalation when a deadline passes — previously advertised, not implemented',
        'Slack or Teams integration to notify reviewers',
        'An assistant for metadata suggestions and quality checks',
      ]}
    />
  )
}
