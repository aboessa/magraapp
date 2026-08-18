/**
 * A rate-limit bucket.
 *
 * ## Why a Durable Object
 *
 * The previous limiter counted in a module-level `Map` with a best-effort KV
 * mirror, and both stores are wrong for this job:
 *
 * - A module-level map lives in **one isolate**. Cloudflare runs many isolates
 *   per colo and many colos, so "5 login attempts per minute" was really "5 per
 *   minute per isolate the request happened to land on". A caller who simply
 *   retried got a fresh budget.
 * - KV is eventually consistent with a documented ~1 write/second per key and
 *   reads that can serve a stale value for up to a minute. A counter built on it
 *   cannot refuse the burst it exists to refuse, which the old code's own comment
 *   conceded ("precise counting is done via WAF rule as well" — there is no such
 *   WAF rule in this repository).
 *
 * A Durable Object is the only primitive here with the property a counter needs:
 * all requests for one key reach one instance, serialized. `idFromName(key)`
 * makes the bucket key the addressing key, so no coordination is needed.
 *
 * ## Cost shape
 *
 * One instance per bucket — per principal, per limit prefix. Instances are
 * evicted when idle and each holds a single small record, so the footprint is a
 * function of *active* callers rather than of total callers. An alarm clears the
 * record one window after the last write so an abandoned bucket does not retain
 * storage indefinitely.
 */

type Bucket = {
  /// Requests counted in the current window.
  count: number
  /// Epoch ms at which the window ends and the count resets.
  resetAt: number
  /// Window length, kept so the alarm can be scheduled without the caller.
  windowMs: number
}

type ConsumeRequest = {
  windowMs: number
  max: number
  /// Requests this call should count as. Always 1 today; present so a heavier
  /// operation can cost more without changing the protocol.
  cost?: number
  /// When true the current count is reported without incrementing, which is what
  /// a read-only probe (a test, or a pre-flight check) needs.
  peek?: boolean
}

export type ConsumeResult = {
  allowed: boolean
  limit: number
  remaining: number
  /// Epoch seconds, matching the `X-RateLimit-Reset` convention.
  resetAt: number
  /// Seconds until the window ends. Zero when the request was allowed.
  retryAfter: number
}

const STORAGE_KEY = 'bucket'

/// Upper bounds, so a malformed or hostile internal call cannot request a
/// thousand-year window or an unbounded allowance.
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_ALLOWANCE = 100_000

export class RateLimiter {
  private readonly ctx: DurableObjectState

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/consume') return this.consume(request)
    if (url.pathname === '/state') return this.state()
    return Response.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  /// Clears an abandoned bucket. Scheduled one window past `resetAt`, so a bucket
  /// still in use reschedules instead of being wiped mid-window.
  async alarm(): Promise<void> {
    const bucket = await this.ctx.storage.get<Bucket>(STORAGE_KEY)
    if (!bucket) return
    if (Date.now() < bucket.resetAt) {
      await this.ctx.storage.setAlarm(bucket.resetAt + bucket.windowMs)
      return
    }
    await this.ctx.storage.deleteAll()
  }

  private async state(): Promise<Response> {
    const bucket = await this.ctx.storage.get<Bucket>(STORAGE_KEY)
    return Response.json({ success: true, data: bucket ?? null })
  }

  private async consume(request: Request): Promise<Response> {
    const body = await request.json().catch(() => null) as ConsumeRequest | null
    const windowMs = Math.trunc(Number(body?.windowMs))
    const max = Math.trunc(Number(body?.max))
    const cost = body?.cost === undefined ? 1 : Math.trunc(Number(body.cost))

    if (!Number.isFinite(windowMs) || windowMs < 1000 || windowMs > MAX_WINDOW_MS
      || !Number.isFinite(max) || max < 1 || max > MAX_ALLOWANCE
      || !Number.isFinite(cost) || cost < 1 || cost > MAX_ALLOWANCE) {
      return Response.json({ success: false, error: 'Invalid rate limit parameters' }, { status: 400 })
    }

    const now = Date.now()
    // `blockConcurrencyWhile` is what makes read-modify-write atomic against
    // other requests to this same object. Without it two concurrent requests can
    // both read count=4 and both write count=5, which is exactly the burst a
    // limiter is for.
    const result = await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<Bucket>(STORAGE_KEY)
      const bucket: Bucket = stored && stored.resetAt > now
        ? { ...stored, windowMs }
        : { count: 0, resetAt: now + windowMs, windowMs }

      if (body?.peek !== true) {
        bucket.count += cost
        await this.ctx.storage.put(STORAGE_KEY, bucket)
        // Scheduled once per window rather than on every request: setAlarm
        // overwrites, so this is idempotent and cheap.
        await this.ctx.storage.setAlarm(bucket.resetAt + windowMs)
      }

      return {
        allowed: bucket.count <= max,
        limit: max,
        remaining: Math.max(0, max - bucket.count),
        resetAt: Math.ceil(bucket.resetAt / 1000),
        retryAfter: bucket.count <= max ? 0 : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      } satisfies ConsumeResult
    })

    return Response.json({ success: true, data: result })
  }
}
