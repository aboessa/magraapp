/// The CORS contract for `/api/*`, as one exported object.
///
/// ## Why this is a module rather than an inline literal
///
/// `test/cors.test.mjs` used to construct its own Hono app and copy these
/// options into it, so every assertion tested the copy. Deleting `X-Platform`
/// from the real middleware left all eight tests green while every
/// `/api/v1/*` call from Flutter Web failed *after* a successful preflight —
/// the same class of regression the notes below record having already happened
/// twice.
///
/// Importing `src/index.ts` from a test is not currently possible: it resolves
/// modules without file extensions, which the Workers bundler accepts and
/// Node's ESM loader does not. Extracting the contract keeps a single source of
/// truth without that refactor.
///
/// ## X-Admin-Actor
///
/// يُرسله عميل اللوحة على كل نداء إدارة (`front/src/lib/api.ts`). غيابه من هذه
/// القائمة يجعل المتصفح يحجب النداء بعد نجاح الـpreflight، فتفشل اللوحة كلها
/// عبر الأصول (majarra.app ← api.majarra.app) بلا خطأ ظاهر.
///
/// ## X-Platform / X-App-Version
///
/// أُضيفا لقياس التوافق — حجبهما يكسر كل مسارات `/api/v1/*` على Flutter Web.

/// Resolves the allowed origin for a request, or null to refuse.
///
/// `env.ALLOWED_ORIGINS` is an additive override, never a replacement: the
/// built-in Majarra and localhost rules continue to apply when it is set, so a
/// partial override cannot silently lock out the dashboard or the app.
export function resolveAllowedOrigin(
  origin: string | undefined,
  env: { ALLOWED_ORIGINS?: string },
): string | null {
  // Native clients send no Origin at all.
  if (!origin) return '*';

  const extra = String(env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (extra.includes(origin)) return origin;

  // Development: Flutter Web binds a random localhost port on every run.
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;

  // Production and preview Majarra hosts.
  if (/^https:\/\/(.*\.)?majarra\.app$/.test(origin)) return origin;
  if (origin === 'https://majarra.app' || origin === 'https://www.majarra.app' || origin === 'https://api.majarra.app') return origin;
  if (/^https:\/\/(.*\.)?majarra\.app:\d+$/.test(origin)) return origin;

  return null;
}

/// Every header a first-party client sends. Removing one breaks that client
/// silently, after the preflight succeeds.
export const ALLOW_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'X-Platform',
  'X-App-Version',
  'X-Parent-Proof',
  'Idempotency-Key',
  'X-Admin-Actor',
  'X-File-Name',
  'X-File-Size',
  'X-File-SHA256',
  'X-Part-Size',
  'X-Image-Width',
  'X-Image-Height',
] as const;

export const EXPOSE_HEADERS = ['Content-Length', 'Content-Range', 'ETag'] as const;

export const ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

/// Options for `hono/cors`. `credentials` stays false: the API authenticates
/// with a bearer token, so no cookie needs to cross an origin, and a wildcard
/// origin therefore carries no ambient authority.
export const corsOptions = {
  origin: (origin: string | undefined, c: { env: { ALLOWED_ORIGINS?: string } }) =>
    resolveAllowedOrigin(origin, c.env),
  allowHeaders: [...ALLOW_HEADERS],
  exposeHeaders: [...EXPOSE_HEADERS],
  allowMethods: [...ALLOW_METHODS],
  credentials: false,
};
