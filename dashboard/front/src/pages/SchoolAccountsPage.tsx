import { NotImplementedPage } from '../components/PageState'
import { usePreferences } from '../context/preferences'

/**
 * حسابات مدرسية.
 *
 * ## ما كانت عليه
 *
 * «مدرسة النور — 3 فصول — 78 طالب» و«الصف 3أ — 26 طالب» و«متوسط الإتقان 68%»
 * — مدرسة مخترعة بالكامل مع طلاب وأرقام إتقان. وزرّ «إنشاء مدرسة» بلا معالِج
 * إطلاقًا: يُنقَر فلا يحدث شيء.
 *
 * وقائمة «الخصوصية» كانت تعلن ثلاث ضمانات — «المعلم لا يرى البريد/الهاتف»،
 * «التقارير مجهولة عند 5+ طلاب» — وهي ضمانات **غير مُنفَّذة في أي سطر كود**.
 * إعلان ضمانة خصوصية لم تُبنَ أخطر من رقم مالي مخترع: قد تُقتبس في عقد مع
 * مدرسة أو جهة تعليمية.
 *
 * لا `schools` ولا `classrooms` في أي مهاجرة. نموذج الصلاحيات الحالي مبنيّ على
 * `parents` ← `children_profiles`، ولا يعرف كيانًا وسيطًا كالفصل أو المدرسة،
 * فهذه ميزة تتطلّب توسيع نموذج البيانات لا مجرد صفحة.
 */
export function SchoolAccountsPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  return (
    <NotImplementedPage
      eyebrow={ar ? 'التوسع' : 'Expansion'}
      title={ar ? 'حسابات مدرسية' : 'School accounts'}
      lede={ar
        ? 'حسابات على مستوى الفصل والمدرسة والمنطقة، مع تقارير مجمَّعة وعزل بيانات الطلاب.'
        : 'Classroom, school and district level accounts with aggregated reporting and student data isolation.'}
      planned={ar ? [
        'كيان مدرسة وفصل — يتطلّب جدولين جديدين وتوسيع نموذج الصلاحيات',
        'دور المعلم: يرى تقدّم فصله فقط',
        'عزل البيانات: المعلم لا يرى بريد ولي الأمر ولا هاتفه',
        'ولي الأمر لا يرى بيانات بقية الفصل',
        'إخفاء الهوية في التقارير المجمَّعة عند حدّ أدنى من الطلاب',
        'تقارير على مستوى المدرسة والمنطقة',
        'ملاحظة: ضمانات العزل أعلاه غير مُنفَّذة بعد، وكانت معروضة كأنها مُطبَّقة',
      ] : [
        'School and classroom entities — requires two new tables and an extended permission model',
        'Teacher role scoped to their own classroom\u2019s progress only',
        'Data isolation: teachers cannot see parent email or phone',
        'Parents cannot see other students in the classroom',
        'Anonymisation in aggregated reports above a minimum student count',
        'School and district level reporting',
        'Note: the isolation guarantees above are not implemented yet, and were previously shown as if they were',
      ]}
    />
  )
}
