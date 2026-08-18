import type { Context, Next } from 'hono'
import type { Env } from './db.ts'
import type { ConsumeResult } from '../do/RateLimiter.ts'

export type RateLimitOptions = {
  windowMs: number
  max: number
  keyPrefix: string
  /**
   * Count against the authenticated parent rather than the source address when a
   * bearer token is present.
   *
   * Per-IP alone is wrong in both directions for authenticated traffic: a family
   * behind one carrier NAT shares a budget with strangers, while an attacker on a
   * residential proxy pool gets a fresh budget per request. For unauthenticated
   * endpoints — login, register, reset — the address is all there is, so those
   * keep the IP key.
   */
  perPrincipal?: boolean
}

/**
 * Rate limiting.
 *
 * ## Store
 *
 * Counters live in the `RateLimiter` Durable Object, one instance per bucket, so
 * a limit holds across isolates and colos. See `do/RateLimiter.ts` for why
 * neither the previous in-memory map nor KV could do this.
 *
 * ## Degradation
 *
 * If the binding is absent (local runs and tests without a DO), or the object is
 * unreachable, the request falls back to a per-isolate counter and the reason is
 * **logged**. A degraded limit is preferable to none, and both are preferable to
 * refusing every login during a storage incident — but the previous code
 * swallowed KV errors silently, so nobody could know which store was answering.
 */

type MemoryEntry = { count: number; resetAt: number }

/// Per-isolate fallback only. Never the authority when the binding exists.
const memoryStore = new Map<string, MemoryEntry>()

function clientAddress(c: Context<{ Bindings: Env }>) {
  return c.req.header('CF-Connecting-IP')
    ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
    ?? 'unknown'
}

/**
 * The identity a request is counted against.
 *
 * The bearer token is hashed rather than used raw: the bucket key becomes a
 * Durable Object name, which appears in traces and dashboards, and a session
 * token must not. It is not verified here — verification costs a DO round trip
 * and this is a counting key, not an authorization decision. A forged token
 * simply gets its own bucket, which is no weaker than the IP bucket it would
 * otherwise share.
 */
async function principalKey(c: Context<{ Bindings: Env }>, options: RateLimitOptions) {
  const address = clientAddress(c)
  if (!options.perPrincipal) return `ip:${address}`
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return `ip:${address}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const hex = [...new Uint8Array(digest).slice(0, 12)]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `sub:${hex}`
}

function memoryConsume(key: string, options: RateLimitOptions): ConsumeResult {
  const now = Date.now()
  const existing = memoryStore.get(key)
  const entry: MemoryEntry = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + options.windowMs }
  entry.count += 1
  memoryStore.set(key, entry)

  if (memoryStore.size > 5000) {
    for (const [candidate, value] of memoryStore) {
      if (value.resetAt <= now) memoryStore.delete(candidate)
    }
  }

  return {
    allowed: entry.count <= options.max,
    limit: options.max,
    remaining: Math.max(0, options.max - entry.count),
    resetAt: Math.ceil(entry.resetAt / 1000),
    retryAfter: entry.count <= options.max ? 0 : Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  }
}

/// Consumes one unit from the bucket, using the durable store when available.
export async function consumeRateLimit(
  c: Context<{ Bindings: Env }>,
  options: RateLimitOptions,
): Promise<ConsumeResult> {
  const key = `${options.keyPrefix}:${await principalKey(c, options)}`
  const namespace = c.env.RATE_LIMITER

  if (!namespace) {
    // Expected locally; a warning rather than an error so test output stays
    // readable, but never silent.
    console.warn('rate_limit_store_unavailable', options.keyPrefix, 'binding_missing')
    return memoryConsume(key, options)
  }

  try {
    const stub = namespace.get(namespace.idFromName(key))
    const response = await stub.fetch(new Request('https://durable.internal/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowMs: options.windowMs, max: options.max }),
    }))
    const payload = await response.json().catch(() => null) as
      { success?: boolean; data?: ConsumeResult } | null
    if (!response.ok || payload?.success !== true || !payload.data) {
      throw new Error(`rate limiter responded ${response.status}`)
    }
    return payload.data
  } catch (error) {
    // Logged, not swallowed. This is the line the audit found missing: a KV
    // failure used to leave an empty catch, so an unlimited endpoint looked
    // identical to a limited one.
    console.error(
      'rate_limit_store_failed', options.keyPrefix,
      error instanceof Error ? error.message : String(error),
    )
    return memoryConsume(key, options)
  }
}

function applyHeaders(c: Context<{ Bindings: Env }>, result: ConsumeResult) {
  c.header('X-RateLimit-Limit', String(result.limit))
  c.header('X-RateLimit-Remaining', String(result.remaining))
  c.header('X-RateLimit-Reset', String(result.resetAt))
}

export function rateLimit(options: RateLimitOptions) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const result = await consumeRateLimit(c, options)
    applyHeaders(c, result)

    if (!result.allowed) {
      // `Retry-After` is required for a client to back off correctly rather than
      // hammer the endpoint until the window happens to roll over.
      c.header('Retry-After', String(result.retryAfter))
      return c.json({
        success: false,
        error: 'Too many requests, please try again later',
        retry_after: result.retryAfter,
      }, 429)
    }

    await next()
  }
}

/* ------------------------------------------------------------------ presets */

/// Login, register, password reset. Per-IP by design: there is no principal yet,
/// and the address is the only thing an attacker must spend to get a new budget.
export const strictAuthLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'auth' })

export const billingLimit = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'billing', perPrincipal: true })

/**
 * حصّة الإدارة.
 *
 * كانت ثلاثين طلبًا في الدقيقة، وهو رقم يبدو معقولًا حتى تُفتح اللوحة فعلًا: كل
 * شاشة تصدر بين ثلاثة وسبعة نداءات (قائمة + تصنيفات + إحصاءات + تدقيق)، فخمس
 * شاشات تستهلك الحصّة كلها. النتيجة التي رُصدت في أول تشغيل حقيقي للمتصفح: بعد
 * نحو ست شاشات يبدأ الخادم بردّ 429، فتُعرض شاشة الدخول للمسؤول في منتصف عمله.
 *
 * الحدّ الجديد يبقى حدًّا — عشرة طلبات في الثانية مستدامة تمنع الزحف والإساءة —
 * لكنه لا يعاقب الاستخدام العادي. الحماية الحقيقية للإدارة هي المصادقة
 * والصلاحيات، لا خنق المعدّل.
 */
export const adminLimit = rateLimit({ windowMs: 60_000, max: 600, keyPrefix: 'admin', perPrincipal: true })

export const generalLimit = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: 'general', perPrincipal: true })

/// Telemetry ingest. A single child session emits events steadily rather than in
/// bursts, so this is generous enough for real use and still bounds an anonymous
/// flood: the endpoint writes a D1 row per call and had no quota at all.
export const analyticsLimit = rateLimit({ windowMs: 60_000, max: 240, keyPrefix: 'analytics' })

/**
 * Playback and narration session creation.
 *
 * Each call mints a lease and a capability token inside the family object, so it
 * is both the most expensive authenticated write on the read path and the one an
 * abusive client would repeat to farm media tokens. A real session starts a
 * handful of times a minute at most — a child opening episodes — so 40 is
 * generous for use and still bounds token farming.
 */
export const mediaSessionLimit = rateLimit({
  windowMs: 60_000, max: 40, keyPrefix: 'media-session', perPrincipal: true,
})

/**
 * Notification and child-settings writes.
 *
 * Parental-control writes, so they are counted per parent rather than per
 * address: a shared NAT must not let one family exhaust another's budget.
 */
export const parentWriteLimit = rateLimit({
  windowMs: 60_000, max: 60, keyPrefix: 'parent-write', perPrincipal: true,
})

/**
 * Child creation uploads.
 *
 * The one endpoint on the child path that writes an R2 object, so an
 * unconstrained loop costs storage rather than just CPU. Children draw slowly;
 * 30 saves a minute is far above real use.
 */
export const creationWriteLimit = rateLimit({
  windowMs: 60_000, max: 30, keyPrefix: 'creation-write', perPrincipal: true,
})
