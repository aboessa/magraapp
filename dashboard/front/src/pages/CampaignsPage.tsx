import { NotImplementedPage } from '../components/PageState'
import { usePreferences } from '../context/preferences'

/**
 * الحملات والإشعارات.
 *
 * ## ما كانت عليه
 *
 * أقلّ الصفحات التسع تضليلًا: لم تخترع أرقامًا، بل عرضت «لا يوجد حملات».
 *
 * لكن العبارة كانت كذبة من نوع آخر: «لا يوجد حملات» تعني «الميزة تعمل والقائمة
 * فارغة»، والحقيقة أنه لا جدول `campaigns` ولا `notifications` في أي مهاجرة.
 * وزرّ «حملة جديدة» كان بلا `onClick` إطلاقًا — يُنقَر فلا يحدث شيء ولا رسالة.
 *
 * الفرق عمليّ: مسؤول يقرأ «لا يوجد حملات» ينتظر ظهور حملات، ومسؤول يقرأ «غير
 * مُنفَّذ» يعرف أن عليه طلب بناء الميزة.
 *
 * ## ملاحظة على الإشعارات
 *
 * إرسال الإشعارات يحتاج رموز أجهزة (FCM/APNs)، و`account_devices` (المهاجرة
 * 0006) يخزّن `installation_id_hash` لا رمز إشعار. فالإرسال يتطلّب توسيع ذلك
 * الجدول لا مجرد بناء واجهة.
 */
export function CampaignsPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  return (
    <NotImplementedPage
      eyebrow={ar ? 'التسويق' : 'Marketing'}
      title={ar ? 'الحملات والإشعارات' : 'Campaigns & notifications'}
      lede={ar
        ? 'إشعارات فورية وداخل التطبيق وبريد ولافتات، مع استهداف وجدولة واختبار A/B.'
        : 'Push, in-app, email and banner messaging with targeting, scheduling and A/B testing.'}
      planned={ar ? [
        'جدول حملات وسجل إرسال — غير موجودين',
        'قنوات: إشعار فوري، داخل التطبيق، بريد، لافتة',
        'استهداف بالدولة واللغة والباقة والمسار العمري',
        'جدولة الإرسال وروابط عميقة داخل التطبيق',
        'حدّ تكرار لكل مستخدم حتى لا تتكدّس الإشعارات',
        'اختبار A/B وقياس نسبة الفتح',
        'يتطلّب أولًا: تخزين رموز الإشعارات (FCM/APNs) في account_devices',
      ] : [
        'A campaigns table and delivery log — neither exists',
        'Channels: push, in-app, email, banner',
        'Targeting by country, language, plan and age track',
        'Send scheduling and in-app deep links',
        'Per-user frequency cap so notifications do not pile up',
        'A/B testing and open-rate measurement',
        'Prerequisite: storing push tokens (FCM/APNs) in account_devices',
      ]}
    />
  )
}
