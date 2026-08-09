import { NotImplementedPage } from '../components/PageState'
import { usePreferences } from '../context/preferences'

/**
 * مركز الترجمة.
 *
 * ## ما كانت عليه
 *
 * ثلاث بطاقات لغات بنِسَب تقدّم ثابتة (ar 100%، en 72%، fr 18%) مع أشرطة تقدّم
 * مرسومة على تلك النِسَب، ومصطلحات Glossary مكتوبة في الكود، وأربعة أزرار
 * استيراد/تصدير كلها `alert()`.
 *
 * والأسوأ: تنبيه «تغيّر النص الأصلي — أعد فتح المراجعة» كان يظهر لكل لغة نسبتها
 * أقل من 100%، أي أنه تنبيه مشروط برقم مخترع لا بأي تغيير حقيقي.
 *
 * ## ما هو متاح فعلًا وما ليس
 *
 * `story_page_localizations` (المهاجرة 0002) موجود ويحمل النص لكل صفحة ولغة،
 * فنسبة التقدّم الحقيقية **قابلة للحساب**: عدد الصفحات المترجمة على إجمالي
 * الصفحات. لكن لا نقطة API تُجمّع ذلك — الموجود هو
 * `PUT /admin/story-pages/:id/localizations/:language` لصفحة واحدة، وحسابها في
 * الواجهة يعني نداءً لكل صفحة في كل قصة.
 *
 * أما Glossary وذاكرة الترجمة فلا جدول لهما إطلاقًا.
 */
export function TranslationCenterPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  return (
    <NotImplementedPage
      eyebrow={ar ? 'الترجمة والدبلجة' : 'Translation & dubbing'}
      title={ar ? 'مركز الترجمة' : 'Translation centre'}
      lede={ar
        ? 'تقدّم الترجمة لكل لغة، ومسرد المصطلحات الثابتة، وذاكرة الترجمة، ومقارنة بالنص الأصلي.'
        : 'Per-language translation progress, a fixed-term glossary, translation memory, and source-text comparison.'}
      planned={ar ? [
        'نسبة التقدّم لكل لغة محسوبة من story_page_localizations',
        'نقطة API تُجمّع الصفحات المترجمة لكل لغة بدل نداء لكل صفحة',
        'مسرد مصطلحات: أسماء الشخصيات وما لا يُترجَم — يتطلّب جدولًا جديدًا',
        'ذاكرة ترجمة واستيراد/تصدير TMX أو Excel',
        'رصد تغيّر النص الأصلي وإعادة فتح مراجعة اللغة تلقائيًا',
        'مقارنة جنبًا إلى جنب بين الأصل والترجمة',
      ] : [
        'Per-language progress computed from story_page_localizations',
        'An API endpoint that aggregates translated pages per language instead of one call per page',
        'Glossary of fixed terms: character names and do-not-translate entries — requires a new table',
        'Translation memory with TMX or Excel import and export',
        'Detecting source-text changes and automatically reopening language review',
        'Side-by-side comparison of source and translation',
      ]}
    />
  )
}
