/**
 * ملكية سمتي lang و dir على <html>.
 *
 * صفحة الهبوط لها لغاتها الثلاث (ar/en/fr) ولوحة الإدارة لها لغتاها (ar/en)،
 * وكلتاهما كانت تكتب على <html> فتفوز الأخيرة تنفيذًا — وهي مزوّد التفضيلات
 * لأن تأثيرات الأب تعمل بعد تأثيرات الابن. الملكية تحسم التعارض صراحة
 * بدل الاعتماد على ترتيب التنفيذ.
 */

let owner: string | null = null

export function claimDocumentLocale(id: string) {
  owner = id
}

export function releaseDocumentLocale(id: string) {
  if (owner === id) owner = null
}

/** يكتب lang/dir إن كان المتصل هو المالك أو لا مالك، ويعيد هل كُتبت */
export function applyDocumentLocale(id: string, lang: string, dir: 'rtl' | 'ltr') {
  if (owner !== null && owner !== id) return false
  document.documentElement.lang = lang
  document.documentElement.dir = dir
  return true
}
