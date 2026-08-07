// Cloudflare Worker bindings. D1 is the content catalog only; parent and
// child state belongs to IdentityState and FamilyState Durable Objects.
export interface Env {
  DB: D1Database;
  IDENTITY_STATE: DurableObjectNamespace;
  FAMILY_STATE: DurableObjectNamespace;
  FAMILY_EVENTS?: Queue;
  CACHE: KVNamespace;
  MEDIA_BUCKET: R2Bucket;
  THUMBS_BUCKET: R2Bucket;
  ENVIRONMENT: string;
  API_VERSION: string;
  ADMIN_API_KEY?: string;
  AUTH_TOKEN_SECRET?: string;
  MEDIA_TOKEN_SECRET?: string;
  EMAIL?: any; // Cloudflare Email Sending binding (send_email)
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_VERIFICATION_URL?: string;
  GOOGLE_PLAY_PACKAGE_NAME?: string;
  GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PLAY_PRIVATE_KEY?: string;
  GOOGLE_PLAY_PRODUCTS?: string;
  GOOGLE_PUBSUB_AUDIENCE?: string;
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL?: string;
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
