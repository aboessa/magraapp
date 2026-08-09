/**
 * عميل مستقل لحالة الموقع.
 *
 * لا يستورد lib/api.ts لسببين: حزمة الهبوط لا يجب أن تسحب كود اللوحة
 * وترويسات الإدارة، وهذا النداء يسبق كل شيء آخر في الصفحة فيجب أن يبقى
 * أخف ما يمكن.
 *
 * ولا يرمي استثناءات: يُعيد اتحادًا مُميَّزًا، لأن تعذّر معرفة الحالة ليس
 * خطأ يُعرض للزائر بل حالة تُعامل بقرار صريح — انظر التعليق على `unknown`.
 */

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export type SiteMode = 'live' | 'construction' | 'maintenance'

export type SiteStatus = {
  mode: SiteMode
  /** موعد الإطلاق بصيغة ISO، أو null إن لم يُعلن */
  launchAt: string | null
  /** رسالة مخصّصة من اللوحة، أو null لاستخدام النص المُترجم في الواجهة */
  message: string | null
  retryAfterSeconds: number | null
}

export type SiteStatusResult =
  | { state: 'ready'; status: SiteStatus }
  /**
   * تعذّر الوصول إلى الـAPI. الواجهة تعرض صفحة الهبوط في هذه الحالة.
   *
   * الاختيار مقصود: لو أخفينا الموقع عند كل انقطاع مؤقّت في الشبكة لتحوّل
   * خلل عابر في الاتصال إلى تعطيل كامل للموقع لدى الزائر. والوضع الحقيقي
   * محفوظ في D1 على أي حال، فالفشل المفتوح هنا يخصّ العرض لا الصلاحيات.
   */
  | { state: 'unavailable' }

function isSiteMode(value: unknown): value is SiteMode {
  return value === 'live' || value === 'construction' || value === 'maintenance'
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function fetchSiteStatus(signal?: AbortSignal): Promise<SiteStatusResult> {
  try {
    const response = await fetch(`${API_ROOT}/site-mode`, {
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!response.ok) return { state: 'unavailable' }

    const body = await response.json() as { data?: Record<string, unknown> } | null
    const data = body?.data
    if (!data || !isSiteMode(data.mode)) return { state: 'unavailable' }

    const retry = Number(data.retryAfterSeconds)
    return {
      state: 'ready',
      status: {
        mode: data.mode,
        launchAt: text(data.launchAt),
        message: text(data.message),
        retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : null,
      },
    }
  } catch {
    return { state: 'unavailable' }
  }
}

/**
 * مفتاح تجاوز للمعاينة: `?preview=<mode>` يعرض صفحة حالة بعينها.
 *
 * يخصّ العرض فقط ولا يغيّر أي إعداد، فوجوده لا يُسرّب شيئًا: أي زائر يمكنه
 * رؤية صفحة «تحت الصيانة» بلا ضرر. الغرض أن يراجع المسؤول التصميم قبل
 * تبديل الوضع فعلًا.
 */
export function previewModeFromLocation(search: string): SiteMode | null {
  const value = new URLSearchParams(search).get('preview')
  return isSiteMode(value) ? value : null
}
