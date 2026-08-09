/**
 * وضع الموقع العام.
 *
 * `live`         · الموقع مفتوح وصفحة الهبوط تُعرض كما هي.
 * `construction` · لم يُطلق بعد: تُعرض صفحة «تحت الإنشاء».
 * `maintenance`  · مُطلق لكنه متوقّف مؤقتًا: تُعرض صفحة «تحت الصيانة».
 *
 * الفرق بين الأخيرين ليس شكليًا. «تحت الإنشاء» حالة ما قبل الإطلاق ويصحّ
 * أرشفتها في محركات البحث بلا ضرر، أما «تحت الصيانة» انقطاع مؤقّت لموقع
 * موجود، فيجب أن يُعيد 503 مع Retry-After حتى لا تُسقط المحركات صفحاته
 * المفهرسة. لذلك يحمل كل وضع رمز حالته الخاص.
 */
export const SITE_MODES = ['live', 'construction', 'maintenance'] as const

export type SiteMode = typeof SITE_MODES[number]

export const DEFAULT_SITE_MODE: SiteMode = 'construction'

export function isSiteMode(value: unknown): value is SiteMode {
  return typeof value === 'string' && (SITE_MODES as readonly string[]).includes(value)
}

/** مفاتيح الإعدادات التي تخصّ وضع الموقع، وكلها قابلة للتحرير من اللوحة. */
export const SITE_MODE_SETTINGS = [
  'site_mode',
  'site_launch_at',
  'site_status_message',
  'maintenance_eta_minutes',
] as const

export type SiteModeSettingKey = typeof SITE_MODE_SETTINGS[number]

export function isSiteModeSetting(key: string): key is SiteModeSettingKey {
  return (SITE_MODE_SETTINGS as readonly string[]).includes(key)
}

export type SiteModeSettings = Record<SiteModeSettingKey, string>

const EMPTY_SETTINGS: SiteModeSettings = {
  site_mode: DEFAULT_SITE_MODE,
  site_launch_at: '',
  site_status_message: '',
  maintenance_eta_minutes: '',
}

/**
 * حالة الموقع كما تُعرض للزائر.
 *
 * `retryAfterSeconds` غير فارغ في وضع الصيانة فقط، ويُترجم إلى ترويسة
 * Retry-After. الرسالة المخصّصة تُعاد كما كتبها المسؤول، والواجهة تعرض
 * نصها المترجم عند غيابها.
 */
export type PublicSiteStatus = {
  mode: SiteMode
  launchAt: string | null
  message: string | null
  retryAfterSeconds: number | null
}

/**
 * يقرأ كل مفاتيح الوضع في استعلام واحد.
 *
 * صفحة الهبوط تستدعي هذا على كل زيارة، فالقراءة المتسلسلة لأربعة مفاتيح
 * تعني أربع رحلات إلى D1 بلا داعٍ.
 *
 * الاستعلام مكتوب هنا مباشرة بلا `queryAll` من lib/db: هذه الوحدة تُختبر
 * بـ`node --experimental-strip-types`، وهو يمحو أنواع TypeScript فقط ولا
 * يحلّ مسارات الاستيراد بلا امتداد. استيراد قيمة من './db' كان يُسقط
 * الاختبار بـERR_MODULE_NOT_FOUND، بينما استيراد النوع وحده يُمحى فلا يضر.
 * النتيجة أن الوحدة نقية قابلة للاختبار ولا تعتمد إلا على D1Database.
 */
export async function readSiteModeSettings(db: D1Database): Promise<SiteModeSettings> {
  const placeholders = SITE_MODE_SETTINGS.map(() => '?').join(', ')
  const result = await db
    .prepare(`SELECT key, value FROM platform_settings WHERE key IN (${placeholders})`)
    .bind(...SITE_MODE_SETTINGS)
    .all()
  const rows = (result.results ?? []) as { key: string; value: string | null }[]

  const settings = { ...EMPTY_SETTINGS }
  for (const row of rows) {
    if (isSiteModeSetting(row.key)) settings[row.key] = row.value ?? ''
  }

  // مفتاح مفقود أو قيمة غير معروفة تعود إلى الافتراض الآمن بدل تعطيل البوابة
  if (!isSiteMode(settings.site_mode)) settings.site_mode = DEFAULT_SITE_MODE
  return settings
}

/** التحقق من صيغة موعد الإطلاق. الفراغ مسموح ويعني «لا موعد معلن». */
export function normalizeLaunchAt(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  // نُطبّع إلى ISO حتى تُعرض بلا غموض في المنطقة الزمنية
  return parsed.toISOString()
}

/** دقائق الصيانة المتوقّعة. الفراغ مسموح ويعني «مدة غير محدّدة». */
export function normalizeEtaMinutes(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 60 * 24 * 14) return null
  return String(parsed)
}

const MESSAGE_LIMIT = 500

export function normalizeStatusMessage(raw: string): string {
  return raw.trim().slice(0, MESSAGE_LIMIT)
}

/** يحوّل الإعدادات المخزّنة إلى الشكل الذي يراه الزائر. */
export function toPublicStatus(settings: SiteModeSettings): PublicSiteStatus {
  const mode = isSiteMode(settings.site_mode) ? settings.site_mode : DEFAULT_SITE_MODE
  const eta = Number(settings.maintenance_eta_minutes)
  return {
    mode,
    launchAt: settings.site_launch_at.trim() || null,
    message: settings.site_status_message.trim() || null,
    // Retry-After للصيانة فقط: «تحت الإنشاء» ليست انقطاعًا مؤقّتًا
    retryAfterSeconds: mode === 'maintenance' && Number.isInteger(eta) && eta > 0
      ? eta * 60
      : null,
  }
}
