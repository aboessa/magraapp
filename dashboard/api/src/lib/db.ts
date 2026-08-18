// Cloudflare Worker bindings. D1 is the content catalog only; parent and
// child state belongs to IdentityState and FamilyState Durable Objects.
export interface Env {
  DB: D1Database;
  IDENTITY_STATE: DurableObjectNamespace;
  FAMILY_STATE: DurableObjectNamespace;
  /**
   * Rate-limit counters, one Durable Object per bucket.
   *
   * Optional so a local run or a test without the binding still serves: the
   * limiter falls back to a per-isolate counter and logs that it did. It must
   * never be optional in a deployed environment — `wrangler.jsonc` declares it for
   * both the top level and production.
   */
  RATE_LIMITER?: DurableObjectNamespace;
  FAMILY_EVENTS?: Queue;
  /// Dedicated paid-production queue. Never share its consumer with family events.
  CONTENT_FACTORY_JOBS?: Queue;
  CACHE: KVNamespace;
  MEDIA_BUCKET: R2Bucket;
  THUMBS_BUCKET: R2Bucket;
  CREATIONS_BUCKET?: R2Bucket;
  ENVIRONMENT: string;
  API_VERSION: string;
  /// Base URL of the CDN fronting the public asset bucket, e.g.
  /// https://cdn.majarra.app. When unset, catalogue artwork resolves to null
  /// rather than to a broken or guessable URL. See lib/assetUrls.ts.
  PUBLIC_ASSET_BASE_URL?: string;
  /// Opt-in for serving platform test fixtures. Never honoured when ENVIRONMENT is production.
  INCLUDE_TEST_FIXTURES?: string;
  ADMIN_API_KEY?: string;
  AUTH_TOKEN_SECRET?: string;
  MEDIA_TOKEN_SECRET?: string;
  EMAIL?: any; // Cloudflare Email Sending binding (send_email)
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_VERIFICATION_URL?: string;
  PASSWORD_RESET_URL?: string;
  GOOGLE_PLAY_PACKAGE_NAME?: string;
  GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PLAY_PRIVATE_KEY?: string;
  GOOGLE_PLAY_PRODUCTS?: string;
  GOOGLE_PUBSUB_AUDIENCE?: string;
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL?: string;

  // --- Gemini-TTS (narration generation) ---
  //
  // Two auth paths are supported because the same models are reachable two ways
  // and the credentials are not interchangeable:
  //
  //  * AI Studio  — a single API key, sent as `x-goog-api-key`. Fastest to set
  //    up, and what a developer trying the model first will already have.
  //  * Vertex / Cloud TTS — a service account that signs a JWT and exchanges it
  //    for an OAuth token, the same flow `services/googlePlay.ts` already uses.
  //    Required for data residency and for a Google Cloud billing account.
  //
  // When both are present the service account wins: it is the production path,
  // and an API key left over from local testing must not silently take over.
  //
  // Deliberately NOT stored in `platform_settings`: that table's `value` column
  // is plaintext TEXT (migration 0017), so a private key placed there would be
  // readable by anything with D1 access and would appear in every backup. Model,
  // voice and prompt choices are safe to keep in D1; the credential is not.
  GOOGLE_TTS_API_KEY?: string;
  GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_TTS_PRIVATE_KEY?: string;

  /// Google Cloud project id, required only by the service-account path: the
  /// synthesize call sends it as `x-goog-user-project` for quota attribution.
  GOOGLE_TTS_PROJECT_ID?: string;

  // --- Content factory / PlayVeo ---
  // Credentials are Worker secrets and are read only by the paid queue consumer
  // after immutable-plan, approval, idempotency and budget checks pass.
  PLAYVEO_API_KEY?: string;
  PLAYVEO_BASE_URL?: string;
  /// Comma-separated HTTPS hostnames accepted for provider result downloads.
  PLAYVEO_DOWNLOAD_HOSTS?: string;
  /// Comma-separated origins allowed via CORS (e.g. "https://custom.majarra.app,https://preview.example.com").
  ALLOWED_ORIGINS?: string;
}

export async function queryAll<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T[]> {
  const stmt = db.prepare(sql);
  const result = params.length ? await stmt.bind(...params).all() : await stmt.all();
  return (result.results as T[]) || [];
}

export async function queryFirst<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T | null> {
  const stmt = db.prepare(sql);
  const result = params.length ? await stmt.bind(...params).first() : await stmt.first();
  return (result as T) || null;
}

export async function cachedJson<T>(cache: KVNamespace, key: string, fetcher: () => Promise<T>, ttl = 300): Promise<T> {
  const cached = await cache.get(key, 'json');
  if (cached) return cached as T;
  const fresh = await fetcher();
  await cache.put(key, JSON.stringify(fresh), { expirationTtl: ttl });
  return fresh;
}
