/**
 * تنبيه ترخيص الخطّ العربي.
 *
 * ## لماذا مكوّن مستقلّ ومعروض في أكثر من مكان
 *
 * هذا العائق مختلف عن كل ما سواه في لوحة الجاهزية: **لا يستطيع أحد في الفريق
 * حلّه**. الخطّ يُرخَّص من مسبك خطوط، والمهلة أسابيع، ولا بديل داخليًّا. وهو في
 * الوقت نفسه العائق الأقلّ ظهورًا: الحزمة تُفحَص فتمرّ، والحروف تُرسم على شاشة
 * المطوِّر بأي خطّ يوفّره النظام، ولا يفشل شيء حتى يسأل محامٍ عن الترخيص الذي
 * يغطّي توزيع خطّ داخل تطبيق أطفال مدفوع.
 *
 * فحصُه موجود في الخادم (`arabic_font_license`، مالكه `provider`، ويمنع النشر)،
 * لكن فحصًا في صفّ رقم أربعة عشر من جدول لا يُقرأ قبل الإطلاق. هذا المكوّن يرفعه
 * إلى أعلى الشاشة: في لوحة الجاهزية لكل لعبة تعرض حروفًا عربية، وفي لوحة
 * عمليّات الكتالوج بعدد الألعاب المحجوبة به.
 *
 * ## لا يُخفى عند النجاح
 *
 * حين يكون الترخيص موثَّقًا يُعرض ذلك أيضًا، بنبرة هادئة. إخفاء التنبيه عند
 * النجاح يعني أن غياب التنبيه لا يفرّق بين «مُرخَّص» و«لم يُفحَص».
 */

import { Icon } from '../Icon'
import { usePreferences } from '../../context/preferences'

/// نصّ `label_ar` للفحص كما يُصدره الخادم، ويُستخدم للتعرّف على أسبابه في
/// `blocking_reasons` (وهي `${label_ar}: ${detail}`). مكتوب هنا مرة واحدة لأن
/// تكراره في صفحتين يعني أن تغييره في الخادم يُصلح واحدة وينسى الأخرى.
export const ARABIC_FONT_CHECK_LABEL = 'ترخيص الخطّ العربي'
export const ARABIC_FONT_CHECK_ID = 'arabic_font_license'

const copy = {
  ar: {
    kicker: 'اعتماد خارجي',
    title: 'ترخيص الخطّ العربي',
    blockedOne: 'هذه اللعبة تعرض أشكال حروف عربية للطفل، فتحتاج ترخيص خطّ تجاريًا موثَّقًا قبل النشر.',
    blockedMany: (count: number) => `${count} لعبة تعرض أشكال حروف عربية للطفل ولا يوجد لها ترخيص خطّ موثَّق.`,
    why: 'الخطّ يُوزَّع داخل التطبيق ويُعرض كبيرًا للطفل — هو المحتوى المُعلَّم نفسه لا نصّ واجهة. '
      + 'ترخيص لا يغطّي هذا الاستخدام هو ترخيص لا يغطّي المنتج.',
    owner: 'المسؤول: مزوّد خارجي (مسبك الخطوط). لا يمكن لأي جهد داخلي أن يحلّه، ومهلته أسابيع لا أيام.',
    evidence: 'الإثبات صفّ في content_reviews بدور rights. لا سجلّ، أو سجلّ معلَّق، أو سجلّ لجهة أخرى — كلها تُبقي النشر محجوبًا.',
    approved: 'الترخيص موثَّق في سجلّ الحقوق.',
    notApplicable: 'لا تنطبق: الحزمة لا تعرض أشكال حروف عربية للطفل.',
    action: 'سجلّ الحقوق',
  },
  en: {
    kicker: 'External clearance',
    title: 'Arabic font licence',
    blockedOne: 'This game renders Arabic letter shapes to a child, so it needs a documented commercial font licence before publish.',
    blockedMany: (count: number) => `${count} game(s) render Arabic letter shapes to a child with no documented font licence.`,
    why: 'The typeface is redistributed inside the app and drawn large for the child — it is the taught content itself, not interface text. '
      + 'A licence that does not cover that use is a licence that does not cover the product.',
    owner: 'Owner: an external provider (the type foundry). No internal effort substitutes for it, and the lead time is weeks, not days.',
    evidence: 'The evidence is a content_reviews row with the rights role. No record, a pending record, or a record for something else all leave publish blocked.',
    approved: 'The licence is documented in the rights register.',
    notApplicable: 'Not applicable: this pack renders no Arabic letter shapes to a child.',
    action: 'Rights register',
  },
}

export interface ArabicFontLicenceAlertProps {
  /// `blocked` يعرض التنبيه الكامل، و`pass` سطرًا هادئًا، و`not_applicable`
  /// جملة واحدة. القيم هي حالات الفحص نفسها في الخادم.
  state: 'blocked' | 'pass' | 'not_applicable'
  /// عدد الألعاب المحجوبة، للعرض على مستوى الكتالوج. غير معرَّف يعني لعبة واحدة.
  games?: number
  detail?: string | null
  /// رابط سجلّ الحقوق، حين يُعرض التنبيه في صفحة تعرف مساره.
  rightsHref?: string
}

export function ArabicFontLicenceAlert(props: ArabicFontLicenceAlertProps) {
  const { locale } = usePreferences()
  const text = copy[locale]

  if (props.state === 'not_applicable') {
    return <p className="table-secondary">{text.title}: {text.notApplicable}</p>
  }

  if (props.state === 'pass') {
    return (
      <p className="inline-alert inline-alert--info">
        <strong>{text.title}</strong> — {text.approved}{props.detail ? ` ${props.detail}` : ''}
      </p>
    )
  }

  return (
    <section className="panel panel--notice" role="alert">
      <span className="panel__kicker">{text.kicker}</span>
      <h3><Icon name="rights" size={18} /> {text.title}</h3>
      <p><strong>{props.games !== undefined && props.games !== 1 ? text.blockedMany(props.games) : text.blockedOne}</strong></p>
      <p>{text.why}</p>
      <p>{text.owner}</p>
      <p>{text.evidence}</p>
      {props.detail && <p className="table-secondary">{props.detail}</p>}
      {props.rightsHref && (
        <a className="button button--secondary" href={props.rightsHref}>
          <Icon name="arrow" size={15} />{text.action}
        </a>
      )}
    </section>
  )
}
