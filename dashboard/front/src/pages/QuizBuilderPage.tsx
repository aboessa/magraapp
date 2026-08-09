import { NotImplementedPage } from '../components/PageState'
import { usePreferences } from '../context/preferences'

/**
 * بنك الأسئلة.
 *
 * ## ما كانت عليه
 *
 * سؤال واحد مخترع («ماذا وجد الأرنب؟») في `useState`، وإضافة الأسئلة عبر
 * `prompt()`، والحفظ لا وجود له — كل ما يُكتب يضيع عند تحديث الصفحة. وسطر
 * «مرتبط بهدف: مهارة القراءة • صعوبة: متوسط • Randomization: مفعل» كان ثابتًا
 * تحت كل سؤال بلا صلة بأي بيانات.
 *
 * ## أسمّي تناقضًا وجدته
 *
 * `attempts` (المهاجرة 0001) فيه عمود `answers` يخزّن أجوبة الأطفال، و`mastery`
 * يحسب `correct_attempts`. أي أن النظام **يسجّل أجوبة على أسئلة لا يملك جدولًا
 * يعرّفها**. الأسئلة تأتي حاليًا من داخل الألعاب (`games`) لا من بنك مركزي.
 *
 * فبناء هذه الصفحة يعني أولًا حسم قرار معماريّ: هل تبقى الأسئلة داخل كل لعبة،
 * أم تُنقل إلى بنك مركزي تشير إليه `attempts`؟ وهو قرار لا تحسمه صفحة إدارة.
 */
export function QuizBuilderPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  return (
    <NotImplementedPage
      eyebrow={ar ? 'التعليم' : 'Learning'}
      title={ar ? 'بنك الأسئلة' : 'Question bank'}
      lede={ar
        ? 'أسئلة اختيار وصح/خطأ وترتيب ومطابقة وصورة، مع تلميح وربط بهدف تعليمي.'
        : 'Multiple choice, true/false, ordering, matching and image questions, with hints and learning-objective links.'}
      planned={ar ? [
        'قرار معماريّ أولًا: بنك أسئلة مركزي أم أسئلة داخل كل لعبة',
        'جدول أسئلة يشير إليه attempts.answers الموجود بالفعل',
        'أنواع الأسئلة: اختيار، صح/خطأ، ترتيب، مطابقة، صورة',
        'ربط كل سؤال بهدف تعليمي من learning_objectives',
        'درجة الصعوبة والتلميح وترتيب عشوائي للخيارات',
        'معاينة على مقاسات الأجهزة، واستيراد/تصدير البنك',
      ] : [
        'Architectural decision first: a central question bank versus questions embedded per game',
        'A questions table referenced by the existing attempts.answers column',
        'Question types: multiple choice, true/false, ordering, matching, image',
        'Linking each question to a learning objective from learning_objectives',
        'Difficulty level, hints, and randomised answer order',
        'Device-size preview, plus bank import and export',
      ]}
    />
  )
}
