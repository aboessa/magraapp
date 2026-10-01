import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { authenticateParent } from '../lib/parentAuth.ts';
import { boolean, bodyOr400, integer, list, oneOf, text } from '../lib/requestSchema.ts';

/// `POST /api/v1/analytics/crashes` — first-party crash reports (`OPS-202`).
///
/// ## Why not Crashlytics or Sentry
///
/// Both send a children's app's diagnostics to a third party, which needs a
/// privacy disclosure that does not exist yet, and both need project accounts.
/// The app already funnels every error through `CrashReporter`; this is the
/// other end of that funnel, on infrastructure the platform already owns.
///
/// ## What a report may contain
///
/// - `error_type`: the Dart runtime type (`RangeError`), never the message.
///   Messages carry request payloads and, in this product, children's names.
/// - `frames`: up to 12 stack frames, each shaped as `package:majarra/...:line`
///   or `dart:...`. Anything else is refused, so a frame cannot smuggle text.
/// - `context`, `fatal`, `platform`, `device_kind`, `occurred_at`.
///
/// Anonymous reports are accepted (a crash can happen before sign-in) and are
/// stored with no identity. A signed-in report records the parent id only, as
/// analytics does, so the dashboard can count affected families.
///
/// Rate limited by `analyticsLimit` in `index.ts` (mounted under `/analytics`).

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

/// One stack frame: an app or SDK location, nothing free-form.
export const FRAME_PATTERN = /^(package:[a-z0-9_]+\/[\w./-]{1,160}|dart:[\w./-]{1,80})(:\d{1,6}(:\d{1,5})?)?( [\w.<>$]{1,80})?$/;

const SCHEMA = {
  error_type: text({ max: 80, pattern: /^[\w<>$.,\s]{1,80}$/ }),
  frames: list(text({ max: 260, pattern: FRAME_PATTERN }), { max: 12 }),
  context: text({ max: 64, pattern: /^[\w.:-]{1,64}$/, optional: true }),
  fatal: boolean({ optional: true }),
  platform: oneOf(['android', 'ios', 'web', 'other'], { optional: true }),
  device_kind: oneOf(['phone', 'tablet', 'tv', 'web', 'other'], { optional: true }),
  occurred_at: integer({ min: 1_600_000_000_000, max: 4_102_444_800_000, optional: true }),
};

type CrashBody = {
  error_type: string;
  frames: string[];
  context?: string;
  fatal?: boolean;
  platform?: string;
  device_kind?: string;
  occurred_at?: number;
};

const VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){0,3}([+-][\w.]{1,20})?$/;

/// Groups identical crashes: same type and the same top five frames. Line
/// numbers are kept, so a fix that moves code starts a new group on purpose.
export async function crashFingerprint(errorType: string, frames: string[]): Promise<string> {
  const material = [errorType.trim(), ...frames.slice(0, 5)].join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

route.post('/crashes', async (c) => {
  const parsed = await bodyOr400<CrashBody>(c, SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  const parentId = auth.ok ? auth.principal.parentId : null;

  const header = c.req.header('X-App-Version')?.trim();
  const appVersion = header && VERSION_PATTERN.test(header) ? header : null;

  // A client clock in the future (or years off) is recorded as "now" rather
  // than trusted, so the dashboard's time windows cannot be skewed by a device.
  const now = Date.now();
  const occurred = body.occurred_at && body.occurred_at <= now + 5 * 60_000 && body.occurred_at >= now - 30 * 86_400_000
    ? body.occurred_at
    : now;

  const fingerprint = await crashFingerprint(body.error_type, body.frames);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO app_crash_reports
       (id, fingerprint, error_type, frames_json, context, fatal, app_version, platform, device_kind, parent_id, occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    id,
    fingerprint,
    body.error_type.trim(),
    JSON.stringify(body.frames),
    body.context ?? null,
    body.fatal ? 1 : 0,
    appVersion,
    body.platform ?? null,
    body.device_kind ?? null,
    parentId,
    new Date(occurred).toISOString(),
  ).run();

  // Opportunistic 30-day retention: roughly one report in fifty prunes, so no
  // cron is needed and the table cannot grow without bound.
  if (Math.random() < 0.02) {
    const prune = c.env.DB.prepare(
      `DELETE FROM app_crash_reports WHERE created_at < datetime('now', '-30 days')`,
    ).run().catch(() => undefined);
    // Hono's `executionCtx` getter throws outside a Worker (tests); then just await.
    try { c.executionCtx.waitUntil(prune); } catch { await prune; }
  }

  return c.json({ success: true, data: { id, fingerprint } }, 201);
});

export default route;
