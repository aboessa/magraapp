const PUBLIC_CONTENT_CACHE_VERSION_KEY = 'majarra:public-content:version'
const DEFAULT_VERSION = '1'

function normalizedPublicUrl(request: Request): URL {
  const requestUrl = new URL(request.url)
  requestUrl.searchParams.sort()
  return requestUrl
}

async function contentVersion(cache: KVNamespace): Promise<string> {
  try {
    return (await cache.get(PUBLIC_CONTENT_CACHE_VERSION_KEY)) ?? DEFAULT_VERSION
  } catch {
    // A cache outage must not make the public catalog unavailable.
    return DEFAULT_VERSION
  }
}

/**
 * Caches only unauthenticated catalog responses. Never use this helper for a
 * child, parent, admin, entitlement, playback, or signed-media response.
 *
 * ## `variant`
 *
 * Any response whose *content* depends on something other than the URL must pass
 * that something here, and territory availability is exactly such a dependency:
 * a catalogue page filtered for a child in one country and stored under a
 * country-agnostic key would be served verbatim to every other country, which
 * turns an enforced restriction back into no restriction — with a cache hit as the
 * only evidence. `routes/series.ts` and `routes/episodes.ts` pass the resolved
 * request country.
 *
 * Kept as an explicit parameter rather than derived from `request.cf` inside this
 * helper because most cached endpoints are country-independent, and adding a
 * country to their keys would multiply their cache entries by the number of
 * countries for no benefit.
 */
export async function cachedPublicJson<T>(
  request: Request,
  cache: KVNamespace,
  load: () => Promise<T>,
  ttlSeconds = 300,
  variant = '',
): Promise<Response> {
  const version = await contentVersion(cache)
  const url = normalizedPublicUrl(request)
  const scope = variant ? `${version}/v-${encodeURIComponent(variant)}` : version
  const cacheKey = new Request(
    `https://majarra-public-cache.invalid/${scope}${url.pathname}${url.search}`,
  )

  try {
    const hit = await caches.default.match(cacheKey)
    if (hit) return hit
  } catch {
    // Fall through to D1 when the edge cache is unavailable.
  }

  const payload = await load()
  const response = new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': `public, max-age=60, s-maxage=${ttlSeconds}, stale-while-revalidate=60`,
      'X-Content-Type-Options': 'nosniff',
      'X-Majarra-Cache': 'MISS',
    },
  })

  try {
    await caches.default.put(cacheKey, response.clone())
  } catch {
    // Serving fresh catalog data is more important than a best-effort cache write.
  }

  return response
}

/**
 * Rotating the version avoids prefix-purge requirements. Old edge entries
 * expire naturally; the next read uses a different cache key.
 */
export async function bumpPublicContentCacheVersion(cache: KVNamespace): Promise<void> {
  try {
    await cache.put(PUBLIC_CONTENT_CACHE_VERSION_KEY, crypto.randomUUID())
  } catch {
    // A short TTL still bounds staleness if KV is temporarily unavailable.
  }
}
