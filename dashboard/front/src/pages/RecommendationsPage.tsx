import { NotImplementedPage } from '../components/PageState'
import { usePreferences } from '../context/preferences'

/**
 * إدارة التوصيات.
 *
 * ## ما كانت عليه
 *
 * ثلاث بطاقات Pin/Boost/Exclude تعمل على `useState` فقط: الإضافة عبر
 * `prompt()`، والقيم الابتدائية `'series-1'` و`'series-2'` معرّفات مخترعة قد
 * لا توجد في `series` أصلًا. كل ما يُضاف يضيع عند تحديث الصفحة.
 *
 * وسطر «حد تكرار + منع أعلى من العمر مفعل» كان يعلن قاعدتَي حماية **غير
 * مُنفَّذتين**، تمامًا كإعلان ضمانات الخصوصية في صفحة المدارس. وبلوك JSON
 * المعروض كان مثالًا ثابتًا لا إعدادًا محفوظًا.
 *
 * ## ما هو متاح
 *
 * `home_experience_blocks` (المهاجرة 0015) يوفّر بالفعل ترتيبًا واستهدافًا
 * لبلوكات الصفحة الرئيسية، وله واجهة عاملة في AppExperiencePage. فالتثبيت
 * والإخفاء اليدويّ قد يكونان امتدادًا له بدل نظام توصيات مستقل — قرار معماريّ
 * يسبق البناء.
 *
 * لا محرّك توصيات ولا جدول قواعد في أي مهاجرة.
 */
export function RecommendationsPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  return (
    <NotImplementedPage
      eyebrow={ar ? 'التوصيات' : 'Recommendations'}
      title={ar ? 'إدارة التوصيات' : 'Recommendation controls'}
      lede={ar
        ? 'تثبيت محتوى ورفع ترتيبه واستثناؤه، مع قواعد «لأنك شاهدت» ومعاينة على حساب تجريبي.'
        : 'Pin, boost and exclude content, with “because you watched” rules and preview against a test account.'}
      planned={ar ? [
        'قرار معماريّ أولًا: توسيع home_experience_blocks أم نظام توصيات مستقل',
        'تثبيت محتوى في أعلى صفّ محدَّد',
        'رفع أو خفض ترتيب محتوى بمعامل',
        'استثناء محتوى من الاقتراح',
        'قواعد «إذا شاهد X فاقترح Y»',
        'حدّ تكرار الاقتراح لكل طفل أسبوعيًا — غير مُنفَّذ وكان معروضًا كأنه مفعَّل',
        'منع اقتراح محتوى أعلى من المسار العمري — غير مُنفَّذ وكان معروضًا كأنه مفعَّل',
        'معاينة الصفحة الرئيسية بعمر ومسار مختارين',
      ] : [
        'Architectural decision first: extend home_experience_blocks or build a separate recommendation system',
        'Pin content to the top of a specific row',
        'Boost or demote content by a multiplier',
        'Exclude content from suggestions',
        '“If they watched X, suggest Y” rules',
        'Weekly per-child suggestion frequency cap — not implemented, previously shown as active',
        'Blocking suggestions above the child\u2019s age track — not implemented, previously shown as active',
        'Preview the home page for a chosen age and track',
      ]}
    />
  )
}
