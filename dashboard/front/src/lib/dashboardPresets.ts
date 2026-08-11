import { readAdminUser } from './adminSession'

/**
 * ترتيب وحدات اللوحة الرئيسية حسب الدور.
 *
 * ## لماذا في العميل لا في الخادم
 *
 * المقاييس كلها تُحسب مرة واحدة في `/admin/dashboard/executive`. لو صار الترتيب
 * قرارًا خادميًّا لاحتاج كل دور استعلامًا خاصًّا أو معاملًا يُغيّر الاستجابة، وهو
 * تفريع لمنطق المقاييس على ستّة أدوار — وهو بالضبط ما نُهي عنه. الترتيب تفضيل
 * عرض: يُطبَّق على المجموعة نفسها التي أتت من الخادم، فلا يُكرَّر منطق ولا يمكن
 * أن ينحرف رقمٌ بين دور ودور.
 *
 * ## الرؤية ليست إخفاءً أمنيًّا
 *
 * الوحدة المُستبعدة من إعداد الدور تبقى قابلة للعرض بتبديل الإعداد. الحرس الأمني
 * في الخادم: المقاييس التي تحتاج صلاحية تأتي أو لا تأتي منه. هذا ترتيب أولويات
 * لا سياسة وصول، ولو كان إخفاءً أمنيًّا لكان بابًا مغلقًا في الواجهة ومفتوحًا
 * بـcurl.
 */

export type DashboardPreset =
  | 'executive' | 'content' | 'production' | 'support' | 'marketing' | 'tech' | 'all'

/// مفاتيح الوحدات كما يُعيدها `/admin/dashboard/executive`.
export const MODULE_KEYS = [
  'support', 'production', 'workflow', 'catalogue', 'website',
  'blog', 'seo', 'customers', 'devices', 'rights', 'platform',
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

/**
 * الوحدات التي يبدأ بها كل دور، بالترتيب.
 *
 * ما لا يُذكَر لا يُخفى بل يُنقل إلى ما بعد المذكور، تحت عنوان صريح. الإخفاء
 * الكامل كان سيعني أن مدير الدعم لا يعرف أن هناك وحدة حقوق إطلاقًا.
 */
export const PRESETS: Record<Exclude<DashboardPreset, 'all'>, ModuleKey[]> = {
  executive: ['catalogue', 'customers', 'support', 'production', 'rights', 'platform'],
  content: ['catalogue', 'production', 'workflow', 'rights', 'website', 'blog'],
  production: ['production', 'workflow', 'catalogue', 'rights'],
  support: ['support', 'customers', 'devices', 'platform'],
  marketing: ['website', 'blog', 'seo', 'catalogue', 'customers'],
  tech: ['platform', 'devices', 'workflow', 'production', 'support'],
}

/// الدور المقترح من أدوار الحساب، أو `executive` عند عدم التطابق.
///
/// الأسماء هي أدوار `roles` في الخادم؛ ما لا يُطابق أيًّا منها يحصل على الإعداد
/// التنفيذي لأنه الأوسع، لا على إعداد فارغ.
export function suggestedPreset(): DashboardPreset {
  const roles = readAdminUser()?.roles ?? []
  const has = (...names: string[]) => names.some((name) => roles.includes(name))
  if (has('owner', 'system_admin', 'executive')) return 'executive'
  if (has('support', 'support_lead', 'customer_support')) return 'support'
  if (has('production_manager', 'producer')) return 'production'
  if (has('marketing', 'seo', 'growth')) return 'marketing'
  if (has('tech_ops', 'devops', 'engineer')) return 'tech'
  if (has('content_manager', 'editor', 'reviewer')) return 'content'
  return 'executive'
}

const STORAGE_KEY = 'majarra-admin-dashboard-preset'

/// الإعداد المختار: تفضيل شخصي في هذا المتصفح، أو المقترح من الدور.
///
/// `localStorage` لأنه تفضيل عرض لا بيانات: لا يوجد جدول تفضيلات في الخادم،
/// وإضافة واحد لأجل ترتيب بطاقات كان سيكون مهاجرة لأجل زينة. والحدّ مُعلَن في
/// الشاشة بدل أن يكتشفه المستخدم على جهاز ثانٍ.
export function readPreset(): DashboardPreset {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && (stored === 'all' || stored in PRESETS)) return stored as DashboardPreset
  } catch {
    // التخزين محجوب في التصفح الخاص: يُستعمل المقترح
  }
  return suggestedPreset()
}

export function writePreset(preset: DashboardPreset): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preset)
  } catch {
    // تفضيل عرض: فقدانه لا يمنع شيئًا
  }
}

/**
 * يرتّب وحدات الاستجابة حسب الإعداد.
 *
 * يُعيد المجموعة كاملة مقسومة: `primary` بترتيب الإعداد، و`secondary` الباقي
 * بترتيبه من الخادم. لا وحدة تُحذف، فلا معلومة تُفقد بتبديل إعداد.
 */
export function orderModules<T extends { key: string }>(
  modules: T[],
  preset: DashboardPreset,
): { primary: T[]; secondary: T[] } {
  if (preset === 'all') return { primary: modules, secondary: [] }
  const order = PRESETS[preset]
  const primary = order
    .map((key) => modules.find((module) => module.key === key))
    .filter((module): module is T => module !== undefined)
  const chosen = new Set(primary.map((module) => module.key))
  return { primary, secondary: modules.filter((module) => !chosen.has(module.key)) }
}
