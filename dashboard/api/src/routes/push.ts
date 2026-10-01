import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryFirst } from '../lib/db.ts';
import { authenticateParent, verifyParentProof } from '../lib/parentAuth.ts';
import { isTvPlatform } from '../lib/familyPolicy.ts';
import { boolean, bodyOr400, oneOf, text } from '../lib/requestSchema.ts';

/// APP-203 — device tokens and the parent's notification choices.
///
///   POST   /api/v1/push/tokens        { token, platform }  register this device
///   DELETE /api/v1/push/tokens        { token }            sign-out / opt-out
///   GET    /api/v1/push/preferences                        what the parent gets
///   POST   /api/v1/push/preferences   { new_episodes?, screen_time?, weekly_report? }
///                                     needs a `parent_area` proof, so a child
///                                     cannot switch off screen-time alerts.

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

const TOKEN = text({ min: 20, max: 4096, pattern: /^[\w:.\-]+$/ });

route.post('/tokens', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const parsed = await bodyOr400<{ token: string; platform: string }>(c, {
    token: TOKEN, platform: oneOf(['android', 'ios', 'android_tv', 'tvos', 'web']),
  });
  if (!parsed.ok) return parsed.response;
  // Nobody reads a notification on a television.
  if (isTvPlatform(parsed.value.platform)) return c.json({ success: true, data: { registered: false } });
  // A token moves with its device: a new sign-in on the same phone takes it over.
  await c.env.DB.prepare(`
    INSERT INTO push_tokens (token, parent_id, device_id, platform) VALUES (?, ?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET parent_id = excluded.parent_id, device_id = excluded.device_id,
      platform = excluded.platform, last_seen_at = datetime('now')
  `).bind(parsed.value.token, auth.principal.parentId, auth.principal.deviceId, parsed.value.platform).run();
  return c.json({ success: true, data: { registered: true } });
});

route.delete('/tokens', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const parsed = await bodyOr400<{ token: string }>(c, { token: TOKEN });
  if (!parsed.ok) return parsed.response;
  await c.env.DB.prepare('DELETE FROM push_tokens WHERE token = ? AND parent_id = ?')
    .bind(parsed.value.token, auth.principal.parentId).run();
  return c.json({ success: true, data: { removed: true } });
});

async function preferences(env: Env, parentId: string) {
  const row = await queryFirst<{ new_episodes: number; screen_time: number; weekly_report: number }>(env.DB,
    'SELECT new_episodes, screen_time, weekly_report FROM push_preferences WHERE parent_id = ?', [parentId]);
  return {
    new_episodes: row ? Number(row.new_episodes) === 1 : true,
    screen_time: row ? Number(row.screen_time) === 1 : true,
    weekly_report: row ? Number(row.weekly_report) === 1 : true,
  };
}

route.get('/preferences', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  return c.json({ success: true, data: await preferences(c.env, auth.principal.parentId) });
});

route.post('/preferences', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const proof = await verifyParentProof(c.env, {
    principal: auth.principal, header: c.req.header('X-Parent-Proof'), purpose: 'parent_area', consume: false,
  });
  if (!proof.ok) return c.json({ success: false, error: 'A current parent proof is required' }, proof.reason === 'unconfigured' ? 503 : 403);
  const parsed = await bodyOr400<{ new_episodes?: boolean; screen_time?: boolean; weekly_report?: boolean }>(c, {
    new_episodes: boolean({ optional: true }), screen_time: boolean({ optional: true }), weekly_report: boolean({ optional: true }),
  });
  if (!parsed.ok) return parsed.response;
  const next = { ...await preferences(c.env, auth.principal.parentId), ...parsed.value };
  await c.env.DB.prepare(`
    INSERT INTO push_preferences (parent_id, new_episodes, screen_time, weekly_report) VALUES (?, ?, ?, ?)
    ON CONFLICT(parent_id) DO UPDATE SET new_episodes = excluded.new_episodes, screen_time = excluded.screen_time,
      weekly_report = excluded.weekly_report, updated_at = datetime('now')
  `).bind(auth.principal.parentId, next.new_episodes ? 1 : 0, next.screen_time ? 1 : 0, next.weekly_report ? 1 : 0).run();
  return c.json({ success: true, data: next });
});

export default route;
