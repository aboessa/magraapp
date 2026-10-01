import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';
import { parsePagination } from '../lib/catalogueValidation.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

// GET /notifications — list broadcast notifications and aggregate metrics
route.get('/notifications', requireAdmin, async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), { defaultLimit: 50, maxLimit: 200 });
  const kind = c.req.query('kind');
  const search = c.req.query('q')?.trim();

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (kind) {
    clauses.push('kind = ?');
    params.push(kind);
  }
  if (search) {
    clauses.push('(title_ar LIKE ? OR body_ar LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await queryAll(
    c.env.DB,
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRow = await queryFirst<{ count: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS count FROM notifications ${where}`,
    params
  );
  const unreadRow = await queryFirst<{ count: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0`,
    []
  );

  return c.json({
    success: true,
    data: rows,
    meta: {
      total: totalRow?.count ?? 0,
      unread: unreadRow?.count ?? 0,
      limit,
      offset,
    },
  });
});

// POST /notifications/broadcast — broadcast a push notification
route.post('/notifications/broadcast', requireAdmin, requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json() as Record<string, unknown>;
  const title_ar = String(body.title_ar ?? '').trim();
  const body_ar = String(body.body_ar ?? '').trim();
  const kind = String(body.kind ?? 'new_episode');
  const deep_link = body.deep_link ? String(body.deep_link).trim() : null;
  const target = String(body.target ?? 'all');
  const parentId = body.parent_id ? String(body.parent_id).trim() : null;

  if (!title_ar) return c.json({ success: false, error: 'عنوان الإشعار مطلوب' }, 400);

  const validKinds = ['new_episode', 'new_series', 'continue_watching', 'download_complete', 'subscription_issue', 'creative_update'];
  if (!validKinds.includes(kind)) {
    return c.json({ success: false, error: `نوع الإشعار غير صالح. الأنواع المسموحة: ${validKinds.join(', ')}` }, 400);
  }

  let sentCount = 0;
  if (target === 'specific' && parentId) {
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, parent_id, kind, title_ar, body_ar, deep_link) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, parentId, kind, title_ar, body_ar || null, deep_link).run();
    sentCount = 1;
  } else if (target === 'active_subscribers') {
    const subscribers = await queryAll<{ parent_id: string }>(
      c.env.DB,
      `SELECT parent_id FROM family_projection WHERE status = 'active'`
    );
    for (const sub of subscribers) {
      const id = crypto.randomUUID();
      await c.env.DB.prepare(
        `INSERT INTO notifications (id, parent_id, kind, title_ar, body_ar, deep_link) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, sub.parent_id, kind, title_ar, body_ar || null, deep_link).run();
      sentCount += 1;
    }
  } else {
    // broadcast to all
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, parent_id, kind, title_ar, body_ar, deep_link) VALUES (?, NULL, ?, ?, ?, ?)`
    ).bind(id, kind, title_ar, body_ar || null, deep_link).run();
    sentCount = 1;
  }

  await auditStatement(c.env.DB, actorId(c), 'broadcast_notification', 'notification', 'broadcast', {
    title_ar,
    kind,
    target,
    sentCount,
  }).run();

  return c.json({ success: true, data: { sent: sentCount } });
});

// DELETE /notifications/:id
route.delete('/notifications/:id', requireAdmin, requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id')!;
  await c.env.DB.prepare(`DELETE FROM notifications WHERE id = ?`).bind(id).run();
  await auditStatement(c.env.DB, actorId(c), 'delete_notification', 'notification', id, {}).run();
  return c.json({ success: true });
});

export default route;
