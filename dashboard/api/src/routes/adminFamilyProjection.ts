import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { requireAdmin, requirePermission } from '../lib/adminAuth';
import { actorId } from '../lib/auditLog';
import type { AdminSessionUser } from '../lib/adminUsers';
import { processFamilyEvent } from '../queue/familyEvents';

type AppEnv = { Bindings: Env; Variables: { adminUser?: AdminSessionUser; adminIsLegacyKey?: boolean } };
const route = new Hono<AppEnv>();
const TRACKS = ['preschool', 'kids', 'junior'];
const PLANS = ['free', 'family', 'family_plus'];
/// مطابقة لقيد CHECK على failed_family_events.status في المهاجرة 0021
const FAILED_EVENT_STATUSES = ['pending', 'replayed', 'discarded'];

/// حرس صريح لا ضمني.
///
/// كان هذا الملف بلا `use()`، فحمايته تأتي كلها من وسيط adminRoute المركّب على
/// `/api/v1/admin/*` وتعتمد على بقاء ذلك الترتيب في admin.ts. مساراته تكشف
/// أسماء أولياء الأمور وكُنى الأطفال ومساراتهم العمرية وخططهم — أكثر بيانات
/// حسّاسية في المنصّة — فاتّكال حمايتها على ترتيب تركيب في ملف آخر غير مقبول.
///
/// التكرار مقصود: `requireAdmin` يحلّ الجلسة مرة ويضعها في السياق، فتشغيله
/// مرتين لا يُكلّف نداء قاعدة بيانات ثانيًا على المسار نفسه.
route.use('*', requireAdmin);

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

/* --------------------------------------------- الأحداث الفاشلة وإعادة تشغيلها */

/**
 * الأحداث التي استنفدت محاولاتها وسقطت في الـDLQ.
 *
 * ## لماذا هذه المسارات موجودة
 *
 * `queue/dlq.ts` كان يـack كل رسالة فاشلة بعد سطر سجل، فتُحذف من الطابور بلا
 * أثر دائم. صار يكتبها في `failed_family_events` (المهاجرة 0021)، لكن جدولًا
 * لا يقرأه أحد لا يختلف كثيرًا عن سطر سجل يشيخ.
 *
 * والتعليق القديم هناك كان يوعد بمصالحة عبر
 * `/admin/family-projection/reconcile` — وهو مسار لم يوجد قط. هذه المسارات هي
 * ذلك الوعد منفَّذًا: قراءة ما فشل، وإعادة تشغيله، أو استبعاده بسبب مكتوب.
 */

/// حدّ صفحة القائمة. مطابق لـ`pagination` أعلاه فلا يتباعد سلوك المسارين.
route.get('/failed-family-events', async (c) => {
  const { limit, offset } = pagination(c.req.query('limit'), c.req.query('offset'));
  const status = c.req.query('status');
  const parentId = c.req.query('parent_id');

  if (status && !FAILED_EVENT_STATUSES.includes(status)) {
    return c.json({ success: false, error: `status must be one of: ${FAILED_EVENT_STATUSES.join(', ')}` }, 400);
  }

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status) { clauses.push('status = ?'); params.push(status); }
  if (parentId) { clauses.push('parent_id = ?'); params.push(parentId); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const total = await queryFirst<{ total: number }>(
    c.env.DB, `SELECT COUNT(*) AS total FROM failed_family_events ${where}`, params,
  );
  // تُعاد الأقدم أولًا داخل المعلَّقة: الحدث الأقدم هو الذي تأخّر إسقاطه أكثر
  const rows = await queryAll(c.env.DB, `
    SELECT id, event_id, event_type, parent_id, occurred_at_ms, payload, attempts,
           failed_at, status, resolved_at, resolved_by, resolution_note
      FROM failed_family_events ${where}
     ORDER BY failed_at ASC
     LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  const pending = await queryFirst<{ total: number }>(
    c.env.DB, `SELECT COUNT(*) AS total FROM failed_family_events WHERE status = 'pending'`,
  );

  return c.json({
    success: true,
    data: rows,
    meta: {
      total: Number(total?.total ?? 0),
      pending: Number(pending?.total ?? 0),
      limit,
      offset,
    },
  });
});

/**
 * يعيد تشغيل حدث فاشل عبر نفس المعالِج الذي فشل معه.
 *
 * ## لماذا `processFamilyEvent` لا إدراج مباشر
 *
 * إعادة كتابة منطق الإسقاط هنا تعني نسختين تتباعدان. والأهم أن
 * `processFamilyEvent` يفحص `processed_family_events` أولًا، فحدث نجح لاحقًا
 * بطريق آخر يُعَدّ مكرَّرًا ولا يُطبَّق مرتين.
 *
 * الفشل لا يغيّر حالة الصفّ: يبقى `pending` ليُحاول مرة أخرى بعد إصلاح السبب،
 * ويُعاد الخطأ كما هو ليُقرأ. هذا هو الغرض من حفظ الجسم الخام.
 */
route.post('/failed-family-events/:id/replay', requirePermission('publish'), async (c) => {
  const id = c.req.param('id');
  const row = await queryFirst<{ id: string; payload: string; status: string }>(
    c.env.DB, 'SELECT id, payload, status FROM failed_family_events WHERE id = ?', [id],
  );
  if (!row) return c.json({ success: false, error: 'Failed event not found' }, 404);
  if (row.status !== 'pending') {
    return c.json({ success: false, error: `Event is already ${row.status}` }, 409);
  }

  let body: unknown;
  try {
    body = JSON.parse(row.payload);
  } catch {
    return c.json({ success: false, error: 'Stored payload is not valid JSON and cannot be replayed' }, 422);
  }

  // جسم حُفظ مقتطعًا أو غير قابل للترميز ليس حدثًا، فإعادة تشغيله لا معنى لها
  if (body && typeof body === 'object' && !Array.isArray(body)
    && typeof (body as Record<string, unknown>).error === 'string') {
    return c.json({
      success: false,
      error: 'Stored payload is a capture placeholder, not an event. Discard it instead.',
    }, 422);
  }

  let result: Awaited<ReturnType<typeof processFamilyEvent>>;
  try {
    result = await processFamilyEvent(c.env, body);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 502);
  }

  if (!result.accepted) {
    // حدث مشوّه لن ينجح أبدًا: يُبلَّغ بذلك بدل تركه معلَّقًا للأبد
    return c.json({ success: false, error: `Event rejected: ${result.reason}` }, 422);
  }

  await c.env.DB.prepare(`
    UPDATE failed_family_events
       SET status = 'replayed', resolved_at = datetime('now'), resolved_by = ?, resolution_note = ?
     WHERE id = ?
  `).bind(actorId(c), result.duplicate ? 'already projected; marked replayed' : null, id).run();

  return c.json({
    success: true,
    data: { id, replayed: true, event_id: result.eventId, duplicate: result.duplicate },
  });
});

/// يستبعد حدثًا يُحكَم بأنه غير قابل للاستعادة. السبب إلزامي: صفّ مُستبعَد بلا
/// سبب يُعيد المشكلة الأصلية — فقدان المعلومة عن سبب الفقدان.
route.post('/failed-family-events/:id/discard', requirePermission('publish'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null) as { note?: unknown } | null;
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : '';
  if (!note) return c.json({ success: false, error: 'note is required when discarding an event' }, 400);

  const row = await queryFirst<{ status: string }>(
    c.env.DB, 'SELECT status FROM failed_family_events WHERE id = ?', [id],
  );
  if (!row) return c.json({ success: false, error: 'Failed event not found' }, 404);
  if (row.status !== 'pending') {
    return c.json({ success: false, error: `Event is already ${row.status}` }, 409);
  }

  await c.env.DB.prepare(`
    UPDATE failed_family_events
       SET status = 'discarded', resolved_at = datetime('now'), resolved_by = ?, resolution_note = ?
     WHERE id = ?
  `).bind(actorId(c), note, id).run();

  return c.json({ success: true, data: { id, discarded: true } });
});

export default route;
