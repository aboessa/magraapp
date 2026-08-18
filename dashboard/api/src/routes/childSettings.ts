import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryFirst } from '../lib/db.ts';
import { authenticateParent, verifyParentProof } from '../lib/parentAuth.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

function isHHMM(v: string) { return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v); }

route.get('/:childId', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const childId = c.req.param('childId');
  const child = await queryFirst(c.env.DB, `SELECT id FROM children_profiles WHERE id=? AND parent_id=?`, [childId, auth.principal.parentId]);
  if (!child) return c.json({ success: false, error: 'Child not found' }, 404);
  let settings = await queryFirst(c.env.DB, `SELECT * FROM child_settings WHERE child_id=?`, [childId]);
  if (!settings) {
    await c.env.DB.prepare(`INSERT INTO child_settings (child_id) VALUES (?)`).bind(childId).run();
    settings = await queryFirst(c.env.DB, `SELECT * FROM child_settings WHERE child_id=?`, [childId]);
  }
  return c.json({ success: true, data: settings });
});

route.put('/:childId', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const proof = await verifyParentProof(c.env, {
    principal: auth.principal,
    header: c.req.header('X-Parent-Proof'),
    purpose: 'parent_area',
  });
  if (!proof.ok) {
    return c.json({ success: false, error: 'A current parent proof is required' }, proof.reason === 'unconfigured' ? 503 : 403);
  }
  const childId = c.req.param('childId');
  const child = await queryFirst(c.env.DB, `SELECT id FROM children_profiles WHERE id=? AND parent_id=?`, [childId, auth.principal.parentId]);
  if (!child) return c.json({ success: false, error: 'Child not found' }, 404);
  const body = await c.req.json() as Record<string, unknown>;
  const fields: string[] = []; const vals: unknown[] = [];
  if ('daily_minutes' in body) {
    const v = Number(body.daily_minutes);
    if (!Number.isInteger(v) || v < 5 || v > 180) return c.json({ success: false, error: 'daily_minutes 5-180' }, 400);
    fields.push('daily_minutes=?'); vals.push(v);
  }
  if ('max_session_minutes' in body) {
    const v = body.max_session_minutes == null ? null : Number(body.max_session_minutes);
    if (v != null && (!Number.isInteger(v) || v < 5 || v > 180)) return c.json({ success: false, error: 'max_session_minutes 5-180' }, 400);
    fields.push('max_session_minutes=?'); vals.push(v);
  }
  if ('bedtime_start' in body || 'bedtime_end' in body) {
    const s = body.bedtime_start as string | null; const e = body.bedtime_end as string | null;
    if (s != null && s !== '' && !isHHMM(s)) return c.json({ success: false, error: 'bedtime_start HH:MM' }, 400);
    if (e != null && e !== '' && !isHHMM(e)) return c.json({ success: false, error: 'bedtime_end HH:MM' }, 400);
    if ('bedtime_start' in body) { fields.push('bedtime_start=?'); vals.push(s === '' ? null : s); }
    if ('bedtime_end' in body) { fields.push('bedtime_end=?'); vals.push(e === '' ? null : e); }
  }
  if ('autoplay_override' in body) {
    const v = body.autoplay_override as string | null;
    if (v != null && !['off','on','inherit'].includes(v)) return c.json({ success: false, error: 'autoplay_override off/on/inherit' }, 400);
    fields.push('autoplay_override=?'); vals.push(v);
  }
  if ('allow_speed_change' in body) { fields.push('allow_speed_change=?'); vals.push(body.allow_speed_change ? 1 : 0); }
  if ('autoplay' in body) { fields.push('autoplay=?'); vals.push(body.autoplay ? 1 : 0); }
  if (!fields.length) return c.json({ success: false, error: 'No fields' }, 400);
  vals.push(childId);
  await c.env.DB.prepare(`UPDATE child_settings SET ${fields.join(', ')}, updated_at=datetime('now') WHERE child_id=?`).bind(...vals).run();
  const updated = await queryFirst(c.env.DB, `SELECT * FROM child_settings WHERE child_id=?`, [childId]);
  return c.json({ success: true, data: updated });
});

export default route;
