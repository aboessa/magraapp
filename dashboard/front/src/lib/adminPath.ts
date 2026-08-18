/**
 * مسار لوحة الإدارة في المتصفح.
 *
 * المسار الآن `/admin` مباشرة حسب طلب المنتج — لا تحويل إلى مسار مستعار.
 * الحماية الحقيقية هي المصادقة في lib/adminSession.ts وحرس requireAdmin في
 * الخادم: بلا جلسة صالحة كل نداء يُرفض بـ401 أيًا كان المسار الذي فُتح منه.
 *
 * ## الفرق بين هذا و/api/v1/admin
 *
 * هذا مسار **المتصفح** فقط. مسارات الـAPI تبقى `/api/v1/admin/*` بلا تغيير،
 * فهي محروسة بالمصادقة لا بالغموض، وتغييرها يكسر كل نداء بلا مقابل.
 */
export const ADMIN_BASE = '/admin'

/// يبني مسارًا فرعيًا داخل اللوحة: adminPath('series') → '/iamnotsite/series'
export function adminPath(sub = ''): string {
  const clean = sub.replace(/^\/+/, '')
  return clean ? `${ADMIN_BASE}/${clean}` : ADMIN_BASE
}
