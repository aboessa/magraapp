import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { authenticateParent } from '../lib/parentAuth.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

const ALLOWED = new Set(['app_open','profile_selected','content_impression','content_opened','video_started','video_paused','video_resumed','seeked','playback_error','video_completed','next_episode','search','search_result_opened','favorite_added','download_started','download_completed','subscription_screen_viewed','content_started','content_completed','downloadSucceeded','downloadFailed','voiceSearchUsed']);

/// Events acceptable with no session at all.
///
/// A launch happens before a profile is chosen and sometimes before sign-in, so
/// refusing it entirely would lose the one metric that establishes a denominator.
/// Nothing identifying is stored for these: see the `parent_id`/`child_id`
/// handling below.
const ANONYMOUS_EVENTS = new Set(['app_open']);

/// Parameter keys the platform is willing to store.
///
/// ## Why an allowlist replaced the previous denylist
///
/// The old screen was `/nickname|email|birth|query|text|transcript/i` run over
/// the **serialized JSON**, so it rejected any event whose *value* happened to
/// contain "text" while accepting `child_name`, `dob` and `phone` — the three
/// keys that matter most. A substring match over a serialized blob cannot
/// distinguish a key from a value, so it fails in both directions at once.
///
/// An allowlist inverts the default: an unrecognised key is refused, and adding
/// one is a reviewed decision. That is the only form of this check that can be
/// relied on for a children's product.
const ALLOWED_PARAM_KEYS = new Set([
  // What was interacted with. All opaque catalogue identifiers, never names.
  'content_id', 'content_type', 'series_id', 'season_id', 'episode_id',
  'story_id', 'book_id', 'game_id', 'planet_id', 'pack_id', 'block_id',
  // Playback and reading position. Durations, not timestamps of a person's day.
  'position_ms', 'duration_ms', 'dwell_ms', 'page_number', 'progress_pct',
  // Outcome and diagnostics.
  'result', 'result_count', 'error_code', 'status_code', 'completed', 'success',
  'reason', 'attempt', 'retry_count',
  // Context of the surface, not of the user.
  'source', 'surface', 'mode', 'quality', 'engine', 'language', 'age_track',
  'platform', 'app_version', 'orientation', 'is_offline', 'index',
]);

const MAX_PARAM_KEYS = 24;
const MAX_VALUE_LENGTH = 120;

type ParamCheck =
  | { ok: true; json: string }
  | { ok: false; error: string };

function screenParams(raw: unknown): ParamCheck {
  if (raw === undefined || raw === null) return { ok: true, json: '{}' };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'params must be an object' };
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_PARAM_KEYS) {
    return { ok: false, error: `params may carry at most ${MAX_PARAM_KEYS} keys` };
  }

  const rejected = entries
    .map(([key]) => key)
    .filter((key) => !ALLOWED_PARAM_KEYS.has(key));
  if (rejected.length) {
    return { ok: false, error: `params contain keys that are not allowed: ${rejected.sort().join(', ')}` };
  }

  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of entries) {
    // Scalars only. A nested object is a place to smuggle free text, and free
    // text is where a child's name ends up.
    if (typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      if (value.length > MAX_VALUE_LENGTH) {
        return { ok: false, error: `params.${key} is longer than ${MAX_VALUE_LENGTH} characters` };
      }
      clean[key] = value;
      continue;
    }
    if (value === null || value === undefined) continue;
    return { ok: false, error: `params.${key} must be a string, number or boolean` };
  }

  return { ok: true, json: JSON.stringify(clean) };
}

/// Confirms the child belongs to the authenticated parent.
///
/// `FamilyState` is the ownership authority; the D1 `children_profiles` table it
/// is projected into has no writer yet (see DATA-001 in the audit backlog), so it
/// cannot be used for this check.
async function ownsChild(env: Env, parentId: string, childId: string): Promise<boolean> {
  const state = await callDurable(familyStub(env, parentId), '/state', {});
  if (state.status !== 200) return false;
  const children = (state.data as { data?: { children?: Array<Record<string, unknown>> } })
    ?.data?.children ?? [];
  return children.some((entry) => String(entry.id) === childId);
}

/// `POST /api/v1/analytics/events`
///
/// ## What was wrong
///
/// The handler computed `authenticateParent` and then discarded it: `parent_id`
/// fell back to the request body when unauthenticated, and `child_id` was taken
/// from the body **always**, with no ownership check. Any anonymous caller could
/// therefore write unbounded rows attributed to arbitrary families and children,
/// corrupting every future metric and growing D1 without limit. The route was
/// also absent from the rate-limit registration in `index.ts`.
///
/// Identifiers now come from the session or not at all.
route.post('/events', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const name = String(body.event ?? body.name ?? '').trim();
  if (!ALLOWED.has(name)) return c.json({ success: false, error: 'event not allowed' }, 400);

  if (!auth.ok && !ANONYMOUS_EVENTS.has(name)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const params = screenParams(body.params);
  if (!params.ok) return c.json({ success: false, error: params.error }, 400);

  // Attribution is never taken from the caller. An unauthenticated `app_open`
  // is stored with no identifiers rather than with the ones it asked for.
  const parentId = auth.ok ? auth.principal.parentId : null;

  let childId: string | null = null;
  if (auth.ok) {
    const claimed = typeof body.child_id === 'string'
      ? body.child_id.trim()
      : typeof body.childId === 'string' ? body.childId.trim() : '';
    if (claimed) {
      if (!await ownsChild(c.env, auth.principal.parentId, claimed)) {
        return c.json({ success: false, error: 'child_id does not belong to this account' }, 403);
      }
      childId = claimed;
    }
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO analytics_events (id, parent_id, child_id, event_name, params_json) VALUES (?,?,?,?,?)`,
  ).bind(id, parentId, childId, name, params.json).run();
  return c.json({ success: true, data: { id } }, 201);
});

route.get('/events', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const rows = await c.env.DB.prepare(`SELECT event_name, COUNT(*) as c FROM analytics_events WHERE parent_id=? GROUP BY event_name ORDER BY c DESC LIMIT 20`).bind(auth.principal.parentId).all();
  return c.json({ success: true, data: rows.results });
});

export default route;
