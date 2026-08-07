import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';

 type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();
const TRACKS = ['preschool', 'kids', 'junior'];
const PLANS = ['free', 'family', 'family_plus'];

function pagination(limitValue?: string, offsetValue?: string) {
  const limit = Number.parseInt(limitValue ?? '20', 10);
  const offset = Number.parseInt(offsetValue ?? '0', 10);
  return {
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20,
    offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
  };
}

route.get('/parents', async (c) => {
  const { limit, offset } = pagination(c.req.query('limit'), c.req.query('offset'));
  const search = c.req.query('q')?.trim();
  const plan = c.req.query('plan');
  const status = c.req.query('status');
  if (plan && !PLANS.includes(plan)) return c.json({ success: false, error: 'Invalid plan' }, 400);
  if (status && !['active', 'suspended', 'archived'].includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400);

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (search) { clauses.push('display_name LIKE ?'); params.push(`%${search}%`); }
  if (plan) { clauses.push('plan = ?'); params.push(plan); }
  if (status) { clauses.push('status = ?'); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM family_projection ${where}`, params);
  const rows = await queryAll(c.env.DB, `
    SELECT fp.*,
      (SELECT COUNT(*) FROM child_projection cp WHERE cp.parent_id = fp.parent_id AND cp.status = 'active') AS children_count
    FROM family_projection fp ${where}
    ORDER BY fp.last_event_at_ms DESC LIMIT ? OFFSET ?
  `, [...params, limit, offset]);
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset, source: 'family_event_projection' } });
});

route.get('/parents/:id', async (c) => {
  const parent = await queryFirst<Record<string, unknown>>(c.env.DB, 'SELECT * FROM family_projection WHERE parent_id = ?', [c.req.param('id')]);
  if (!parent) return c.json({ success: false, error: 'Parent projection not found' }, 404);
  const children = await queryAll(c.env.DB, 'SELECT * FROM child_projection WHERE parent_id = ? ORDER BY status, created_at_ms', [c.req.param('id')]);
  return c.json({ success: true, data: { ...parent, children }, meta: { source: 'family_event_projection' } });
});

route.get('/children', async (c) => {
  const { limit, offset } = pagination(c.req.query('limit'), c.req.query('offset'));
  const search = c.req.query('q')?.trim();
  const track = c.req.query('track');
  const parentId = c.req.query('parent_id');
  const status = c.req.query('status');
  if (track && !TRACKS.includes(track)) return c.json({ success: false, error: 'Invalid track' }, 400);
  if (status && !['active', 'archived'].includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400);

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (search) { clauses.push('(cp.nickname LIKE ? OR fp.display_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (track) { clauses.push('cp.age_track = ?'); params.push(track); }
  if (parentId) { clauses.push('cp.parent_id = ?'); params.push(parentId); }
  if (status) { clauses.push('cp.status = ?'); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = await queryFirst<{ total: number }>(c.env.DB, `
    SELECT COUNT(*) AS total FROM child_projection cp
    LEFT JOIN family_projection fp ON fp.parent_id = cp.parent_id ${where}
  `, params);
  const rows = await queryAll(c.env.DB, `
    SELECT cp.*, fp.display_name AS parent_name, fp.plan AS parent_plan
    FROM child_projection cp LEFT JOIN family_projection fp ON fp.parent_id = cp.parent_id
    ${where} ORDER BY cp.last_event_at_ms DESC LIMIT ? OFFSET ?
  `, [...params, limit, offset]);
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset, source: 'family_event_projection' } });
});

route.get('/children/:id', async (c) => {
  const row = await queryFirst(c.env.DB, `
    SELECT cp.*, fp.display_name AS parent_name, fp.plan AS parent_plan
    FROM child_projection cp LEFT JOIN family_projection fp ON fp.parent_id = cp.parent_id
    WHERE cp.child_id = ?
  `, [c.req.param('id')]);
  if (!row) return c.json({ success: false, error: 'Child projection not found' }, 404);
  return c.json({ success: true, data: row, meta: { source: 'family_event_projection' } });
});

const readOnly = (c: { json(value: unknown, status: 405): Response }) => c.json({
  success: false,
  error: 'Family administration is read-only; mutate family state through authenticated Family APIs',
}, 405);
route.post('/children', readOnly);
route.patch('/children/:id', readOnly);
route.delete('/children/:id', readOnly);

export default route;
