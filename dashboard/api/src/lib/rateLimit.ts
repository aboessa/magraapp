import type { Context, Next } from 'hono'
import type { Env } from './db'

type RateLimitOptions = {
  windowMs: number
  max: number
  keyPrefix: string
  skipSuccessfulRequests?: boolean
}

// In-memory fallback for dev (single isolate). For production, uses KV with best-effort.
// KV has 1 write/s per key, but for abuse protection this is acceptable; precise counting is done via WAF rule as well.
const memoryStore = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(options: RateLimitOptions) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'
    const key = `${options.keyPrefix}:${ip}`

    const now = Date.now()
    let entry = memoryStore.get(key)

    // Try KV first for distributed (optional)
    if (!entry && c.env.CACHE) {
      try {
        const raw = await c.env.CACHE.get(`rl:${key}`, 'json') as { count: number; resetAt: number } | null
        if (raw && raw.resetAt > now) entry = raw
      } catch {}
    }

    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + options.windowMs }
    } else {
      entry.count += 1
    }

    // Store back
    memoryStore.set(key, entry)
    if (c.env.CACHE) {
      try {
        await c.env.CACHE.put(`rl:${key}`, JSON.stringify(entry), { expirationTtl: Math.ceil(options.windowMs / 1000) + 5 })
      } catch {}
    }

    // Cleanup memory store periodically
    if (memoryStore.size > 5000) {
      for (const [k, v] of memoryStore) if (v.resetAt <= now) memoryStore.delete(k)
    }

    const remaining = Math.max(0, options.max - entry.count)
    c.header('X-RateLimit-Limit', String(options.max))
    c.header('X-RateLimit-Remaining', String(remaining))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > options.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      c.header('Retry-After', String(retryAfter))
      return c.json({ success: false, error: 'Too many requests, please try again later' }, 429)
    }

    await next()

    // Optionally skip counting successful requests if configured
    if (options.skipSuccessfulRequests && c.res?.status && c.res.status < 400) {
      // Decrement is not precise, but we keep it simple
    }
  }
}

// Presets
export const strictAuthLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'auth' })
export const billingLimit = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'billing' })
export const adminLimit = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'admin' })
export const generalLimit = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: 'general' })

/**
 * عدّ يدوي بدل الوسيط، ليُستدعى بعد نجاح التحقق من المدخلات.
 *
 * الوسيط يعدّ كل طلب يصل، فالمدخلات الخاطئة تستهلك حصة المستخدم:
 * خمس محاولات بخطأ مطبعي في البريد كانت تحجب صاحبها ساعة كاملة.
 * الحصة الضيقة معنيّة بالإرسال المقبول، وحماية الطلبات الفاسدة
 * وظيفة generalLimit الأوسع.
 */
export async function consumeRateLimit(
  c: Context<{ Bindings: Env }>,
  options: RateLimitOptions,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'
  const key = `${options.keyPrefix}:${ip}`
  const now = Date.now()

  let entry = memoryStore.get(key)
  if (!entry && c.env.CACHE) {
    try {
      const raw = await c.env.CACHE.get(`rl:${key}`, 'json') as { count: number; resetAt: number } | null
      if (raw && raw.resetAt > now) entry = raw
    } catch { /* انقطاع الكاش لا يمنع الخدمة */ }
  }

  if (!entry || entry.resetAt <= now) entry = { count: 1, resetAt: now + options.windowMs }
  else entry.count += 1

  memoryStore.set(key, entry)
  if (c.env.CACHE) {
    try {
      await c.env.CACHE.put(`rl:${key}`, JSON.stringify(entry), {
        expirationTtl: Math.ceil(options.windowMs / 1000) + 5,
      })
    } catch { /* أفضل جهد */ }
  }

  return {
    allowed: entry.count <= options.max,
    retryAfter: Math.ceil((entry.resetAt - now) / 1000),
  }
}
