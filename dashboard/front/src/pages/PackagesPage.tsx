import { NotImplementedPage } from '../components/PageState'
import { usePreferences } from '../context/preferences'

/**
 * الباقات والأسعار.
 *
 * ## ما كانت عليه
 *
 * كانت تعرض «Family — 99.90 EGP» و«Family Plus — 149.90 EGP» كأسعار حقيقية،
 * وزرَّي «تعديل» و«إنشاء كود» كلاهما `alert()`.
 *
 * ## الفرق المهم: الحدود موجودة، الأسعار لا
 *
 * `subscription_plan_limits` (المهاجرة 0006) يحمل الحدود فعلًا ومبذورة:
 * free = 1 طفل/1 جهاز، family = 4/4، family_plus = 4/8. فتلك الأرقام كانت
 * صحيحة بالمصادفة لكنها منسوخة يدويًا، فتنحرف عن الجدول عند أي تعديل.
 *
 * **الأسعار لا وجود لها في أي جدول.** لا `packages` ولا `plans` ولا
 * `promo_codes`. رقم «99.90 EGP» مخترع بالكامل، وهو أخطر ما كان في الصفحة:
 * سعرٌ يُقرأ كأنه المُطبَّق فعلًا في المتجر.
 *
 * عرض الحدود وحدها كان يتطلّب نقطة API لا وجود لها
 * (`subscription_plan_limits` غير مكشوف)، فالصفحة تبقى غير مُنفَّذة حتى تُبنى.
 */
export function PackagesPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  return (
    <NotImplementedPage
      eyebrow={ar ? 'التجارة' : 'Commerce'}
      title={ar ? 'الباقات والأسعار' : 'Plans & pricing'}
      lede={ar
        ? 'إدارة الباقات حسب الدولة والعملة والمتجر، مع أكواد الخصم والأسعار المحفوظة للمشتركين القدامى.'
        : 'Manage plans by country, currency and store, with promo codes and grandfathered pricing.'}
      planned={ar ? [
        'قراءة حدود كل باقة من subscription_plan_limits بدل نسخها في الكود',
        'أسعار لكل دولة وعملة — يتطلّب جدول أسعار جديدًا',
        'مطابقة معرّفات المنتجات مع Google Play و App Store',
        'أكواد خصم وعروض موسمية وأكواد هدايا',
        'الأسعار المحفوظة للمشتركين القدامى عند رفع السعر',
        'يتطلّب أولًا: كشف subscription_plan_limits عبر API + جدول أسعار',
      ] : [
        'Read each plan\u2019s limits from subscription_plan_limits instead of copying them into code',
        'Per-country and per-currency pricing — requires a new pricing table',
        'Product ID mapping for Google Play and the App Store',
        'Promo codes, seasonal offers and gift codes',
        'Grandfathered pricing for existing subscribers after a price rise',
        'Prerequisites: expose subscription_plan_limits via API plus a pricing table',
      ]}
    />
  )
}
