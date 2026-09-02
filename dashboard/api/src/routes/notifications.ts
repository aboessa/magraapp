import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { authenticateParent } from '../lib/parentAuth.ts';
import { bodyOr400, text } from '../lib/requestSchema.ts';

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

/// `POST /api/v1/notifications/test`
///
/// ## No client caller today, and why that is not a defect
///
/// A full search of `app_main/lib` and `dashboard/front/src` finds no caller of
/// this route. That is by design: it is an operational tool for creating a
/// notification for the *authenticated account's own* family (never another
/// family — `parent_id` is always the caller's), used to verify the
/// notifications pipeline (storage, unread badge, `GET /` listing,
/// `POST /:id/read`) end to end without needing a server-side trigger (a real
/// episode release, a reward, etc.) to fire first. It is reached today via a
/// direct authenticated HTTP call (curl/Postman) during manual QA of the
/// pipeline, not through either UI.
///
/// Kept rather than removed per Requirement 6.5: it is scoped to the caller's
/// own account, requires the same authentication as every other notifications
/// route, and is rate-limited under `parentWriteLimit` (`index.ts`), so it
/// carries no cross-account risk. Removing it would take away the one way to
/// smoke-test the notification pipeline against a live environment.
route.post('/test', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  // SEC-110: كان الجسم يُقرأ **بلا التقاط** — فجسمٌ مشوّه يرفع استثناءً فيصير 500
  // بدل 400. وكانت القيَم تُكتب كما جاءت: `kind` كائنًا، أو عنوانًا بميغابايت.
  const parsed = await bodyOr400<{
    child_id?: string;
    kind?: string;
    title_ar?: string;
    body_ar?: string;
    deep_link?: string;
  }>(c, {
    child_id: text({ max: 128, optional: true }),
    kind: text({ max: 64, optional: true }),
    title_ar: text({ max: 200, optional: true }),
    body_ar: text({ max: 1000, optional: true }),
    deep_link: text({ max: 500, optional: true }),
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO notifications (id, parent_id, child_id, kind, title_ar, body_ar, deep_link) VALUES (?,?,?,?,?,?,?)`)
    .bind(id, auth.principal.parentId, body.child_id ?? null, body.kind ?? 'new_episode', body.title_ar ?? 'حلقة جديدة', body.body_ar ?? null, body.deep_link ?? null).run();
  return c.json({ success: true, data: { id } }, 201);
});

export default route;
