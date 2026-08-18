import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { authenticateParent } from '../lib/parentAuth.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

route.get('/', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const childId = c.req.query('child_id');
  const onlyUnread = c.req.query('unread') === '1';
  let sql = `SELECT * FROM notifications WHERE parent_id=?`;
  const vals: unknown[] = [auth.principal.parentId];
  if (childId) { sql += ` AND (child_id=? OR child_id IS NULL)`; vals.push(childId); }
  if (onlyUnread) sql += ` AND is_read=0`;
  sql += ` ORDER BY created_at DESC LIMIT 50`;
  const rows = await c.env.DB.prepare(sql).bind(...vals).all();
  return c.json({ success: true, data: rows.results });
});

route.post('/:id/read', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  await c.env.DB.prepare(`UPDATE notifications SET is_read=1 WHERE id=? AND parent_id=?`).bind(c.req.param('id'), auth.principal.parentId).run();
  return c.json({ success: true });
});

route.post('/test', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const body = await c.req.json() as Record<string, unknown>;
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO notifications (id, parent_id, child_id, kind, title_ar, body_ar, deep_link) VALUES (?,?,?,?,?,?,?)`)
    .bind(id, auth.principal.parentId, body.child_id ?? null, body.kind ?? 'new_episode', body.title_ar ?? 'حلقة جديدة', body.body_ar ?? null, body.deep_link ?? null).run();
  return c.json({ success: true, data: { id } }, 201);
});

export default route;
