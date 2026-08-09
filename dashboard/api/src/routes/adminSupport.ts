/// Support CRM endpoints: tickets, timeline, assignment, escalation, SLA and views.
///
/// `lib/supportCrm.ts` holds the rules; this loads the rows, enforces them and writes
/// the timeline. Mounted on the admin prefix.
///
/// ## Which permission guards what
///
/// Reads need only `requireAdmin`: a support operator who cannot see the queue cannot
/// work, and hiding tickets from colleagues is not a security boundary. Writes need
/// `assign_members` — the closest thing in the seeded permission set (migration 0014)
/// to "may operate the support queue". Inventing a `support` permission was rejected
/// for the same reason as elsewhere: a permission no role holds makes the feature
/// unreachable, and the first person to notice is an operator who cannot do their job.
///
/// Recording an operational action is guarded harder (`manage_permissions`) when the
/// action touches an account rather than the ticket, because "I resynced this family's
/// entitlements" is a claim about production state.
///
/// ## Every write leaves two traces
///
/// The ticket timeline (`support_ticket_events`) is what an operator reads; the audit
/// log is what an investigation reads. They are not redundant: the timeline is
/// narrative and scoped to one ticket, the audit log is uniform and queryable across
/// entities, and losing either makes one of those two jobs impossible.

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { requireAdmin, requirePermission } from '../lib/adminAuth';
import { actorId, auditStatement } from '../lib/auditLog';
import { parsePagination } from '../lib/catalogueValidation';
import {
  isTicketAction,
  isTicketPriority,
  isTicketStatus,
  resolveSlaPolicy,
  slaDueDates,
  slaState,
  stampsFirstResponse,
  SUPPORTED_ACTIONS,
  ticketCreateInput,
  ticketReference,
  transitionError,
  UNAVAILABLE_ACTIONS,
  type SlaPolicy,
  type TicketStatus,
} from '../lib/supportCrm.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

interface TicketRow {
  id: string;
  reference: string;
  subject: string;
  body: string | null;
  category: string;
  priority: string;
  status: TicketStatus;
  family_id: string | null;
  subscription_ref: string | null;
  purchase_ref: string | null;
  device_id: string | null;
  assignee_id: string | null;
  team_id: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

async function loadPolicies(db: D1Database): Promise<SlaPolicy[]> {
  const rows = await queryAll<{
    category: string; priority: string; first_response_minutes: number; resolution_minutes: number;
  }>(db, 'SELECT category, priority, first_response_minutes, resolution_minutes FROM support_sla_policies');
  return rows.map((row) => ({
    category: row.category,
    priority: row.priority as SlaPolicy['priority'],
    first_response_minutes: Number(row.first_response_minutes),
    resolution_minutes: Number(row.resolution_minutes),
  }));
}

async function loadTags(db: D1Database, ticketIds: string[]): Promise<Map<string, string[]>> {
  if (!ticketIds.length) return new Map();
  const rows = await queryAll<{ ticket_id: string; tag: string }>(db, `
    SELECT ticket_id, tag FROM support_ticket_tags
     WHERE ticket_id IN (${ticketIds.map(() => '?').join(', ')})
     ORDER BY tag
  `, ticketIds);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.ticket_id) ?? [];
    list.push(row.tag);
    map.set(row.ticket_id, list);
  }
  return map;
}

const decorate = (ticket: TicketRow, tags: string[], now: string) => ({
  ...ticket,
  tags,
  sla: slaState(ticket, now),
});

/// `GET /admin/support/tickets`
///
/// Filters compose, and `overdue=1` is computed in SQL rather than in code so that
/// paging over a filtered set returns the right page — filtering after the LIMIT is
/// how a "12 overdue tickets" badge ends up disagreeing with a list of three.
route.get('/support/tickets', requireAdmin, async (c) => {
  const db = c.env.DB;
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), { defaultLimit: 25, maxLimit: 100 });

  const clauses: string[] = [];
  const params: unknown[] = [];
  const status = c.req.query('status');
  if (status && isTicketStatus(status)) { clauses.push('t.status = ?'); params.push(status); }
  const priority = c.req.query('priority');
  if (priority && isTicketPriority(priority)) { clauses.push('t.priority = ?'); params.push(priority); }
  const category = c.req.query('category');
  if (category) { clauses.push('t.category = ?'); params.push(category); }
  const assignee = c.req.query('assignee_id');
  if (assignee) { clauses.push('t.assignee_id = ?'); params.push(assignee); }
  const family = c.req.query('family_id');
  if (family) { clauses.push('t.family_id = ?'); params.push(family); }
  const tag = c.req.query('tag');
  if (tag) {
    clauses.push('EXISTS (SELECT 1 FROM support_ticket_tags tt WHERE tt.ticket_id = t.id AND tt.tag = ?)');
    params.push(tag.trim().toLowerCase());
  }
  const search = c.req.query('q')?.trim();
  if (search) {
    clauses.push('(t.subject LIKE ? OR t.reference LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  // `open` here means "not settled", which is what an operator means by it — the four
  // live statuses rather than the single `open` value.
  if (c.req.query('live') === '1') {
    clauses.push("t.status NOT IN ('resolved', 'closed')");
  }
  if (c.req.query('overdue') === '1') {
    clauses.push(`t.resolution_due_at IS NOT NULL
      AND t.status NOT IN ('resolved', 'closed', 'waiting_customer')
      AND t.resolution_due_at < datetime('now')`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = await queryFirst<{ total: number }>(db, `SELECT COUNT(*) AS total FROM support_tickets t ${where}`, params);
  const rows = await queryAll<TicketRow & { assignee_name: string | null }>(db, `
    SELECT t.*, au.display_name AS assignee_name
      FROM support_tickets t
      LEFT JOIN admin_users au ON au.id = t.assignee_id
      ${where}
     ORDER BY
       CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
       t.resolution_due_at IS NULL,
       t.resolution_due_at ASC,
       t.created_at DESC
     LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  const tags = await loadTags(db, rows.map((row) => row.id));
  const now = new Date().toISOString();
  return c.json({
    success: true,
    data: rows.map((row) => decorate(row, tags.get(row.id) ?? [], now)),
    meta: { total: Number(total?.total ?? 0), limit, offset },
  });
});

/// `POST /admin/support/tickets`
route.post('/support/tickets', requirePermission('assign_members'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);
  const parsed = ticketCreateInput(body);
  if ('error' in parsed) return c.json({ success: false, error: parsed.error }, 400);
  const input = parsed.input;

  if (input.assignee_id) {
    const user = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM admin_users WHERE id = ? AND is_active = 1', [input.assignee_id]);
    if (!user) return c.json({ success: false, error: 'Assignee not found or inactive' }, 404);
  }
  if (input.team_id) {
    const team = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM teams WHERE id = ?', [input.team_id]);
    if (!team) return c.json({ success: false, error: 'Team not found' }, 404);
  }

  const policies = await loadPolicies(c.env.DB);
  const now = new Date().toISOString();
  const due = slaDueDates(resolveSlaPolicy(policies, input.category, input.priority), now);

  // The reference is derived from the row count. It is not a security value and a
  // collision is prevented by the UNIQUE constraint rather than by hope: a retry after
  // a genuine race fails loudly instead of silently reusing a colleague's reference.
  const count = await queryFirst<{ total: number }>(c.env.DB, 'SELECT COUNT(*) AS total FROM support_tickets');
  const id = crypto.randomUUID();
  const reference = ticketReference(Number(count?.total ?? 0) + 1);

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(`
      INSERT INTO support_tickets
        (id, reference, subject, body, category, priority, status, family_id,
         subscription_ref, purchase_ref, device_id, assignee_id, team_id,
         first_response_due_at, resolution_due_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, reference, input.subject, input.body, input.category, input.priority,
      input.family_id, input.subscription_ref, input.purchase_ref, input.device_id,
      input.assignee_id, input.team_id, due.first_response_due_at, due.resolution_due_at,
      actorId(c),
    ),
  ];
  for (const tag of input.tags) {
    statements.push(c.env.DB.prepare('INSERT OR IGNORE INTO support_ticket_tags (ticket_id, tag) VALUES (?, ?)').bind(id, tag));
  }
  statements.push(c.env.DB.prepare(`
    INSERT INTO support_ticket_events (id, ticket_id, kind, body, metadata_json, actor_id)
    VALUES (?, ?, 'link', ?, ?, ?)
  `).bind(
    crypto.randomUUID(), id,
    'فُتحت التذكرة.',
    JSON.stringify({
      category: input.category, priority: input.priority,
      family_id: input.family_id, device_id: input.device_id,
      first_response_due_at: due.first_response_due_at, resolution_due_at: due.resolution_due_at,
    }),
    actorId(c),
  ));
  statements.push(auditStatement(c.env.DB, actorId(c), 'support_ticket_create', 'support_ticket', id, {
    reference, category: input.category, priority: input.priority, family_id: input.family_id,
  }));

  await c.env.DB.batch(statements);
  return c.json({ success: true, data: { id, reference } }, 201);
});

/// `GET /admin/support/tickets/:id` — ticket, tags, SLA state and full timeline.
route.get('/support/tickets/:id', requireAdmin, async (c) => {
  const id = c.req.param('id') ?? '';
  const ticket = await queryFirst<TicketRow & { assignee_name: string | null }>(c.env.DB, `
    SELECT t.*, au.display_name AS assignee_name
      FROM support_tickets t
      LEFT JOIN admin_users au ON au.id = t.assignee_id
     WHERE t.id = ? OR t.reference = ?
  `, [id, id]);
  if (!ticket) return c.json({ success: false, error: 'Ticket not found' }, 404);

  const [tags, timeline] = await Promise.all([
    loadTags(c.env.DB, [ticket.id]),
    queryAll(c.env.DB, `
      SELECT e.id, e.kind, e.body, e.metadata_json, e.actor_id, e.is_internal, e.created_at,
             au.display_name AS actor_name
        FROM support_ticket_events e
        LEFT JOIN admin_users au ON au.id = e.actor_id
       WHERE e.ticket_id = ?
       ORDER BY e.created_at DESC
    `, [ticket.id]),
  ]);

  return c.json({
    success: true,
    data: {
      ticket: decorate(ticket, tags.get(ticket.id) ?? [], new Date().toISOString()),
      timeline,
      // Sent with every ticket so the screen never has to guess which operational
      // actions exist, and never renders one that cannot work.
      supported_actions: SUPPORTED_ACTIONS,
      unavailable_actions: UNAVAILABLE_ACTIONS,
    },
  });
});

/// `PATCH /admin/support/tickets/:id` — status, priority, assignment, tags.
route.patch('/support/tickets/:id', requirePermission('assign_members'), async (c) => {
  const id = c.req.param('id') ?? '';
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const ticket = await queryFirst<TicketRow>(c.env.DB, 'SELECT * FROM support_tickets WHERE id = ?', [id]);
  if (!ticket) return c.json({ success: false, error: 'Ticket not found' }, 404);

  const now = new Date().toISOString();
  const sets: string[] = [];
  const params: unknown[] = [];
  const events: Array<{ kind: string; body: string; metadata: unknown }> = [];

  if (body.status !== undefined) {
    if (!isTicketStatus(body.status)) return c.json({ success: false, error: 'Invalid status' }, 400);
    const error = transitionError(ticket.status, body.status);
    if (error) return c.json({ success: false, error }, 409);
    if (body.status !== ticket.status) {
      sets.push('status = ?'); params.push(body.status);
      if (stampsFirstResponse(ticket.status, body.status, ticket.first_response_at)) {
        sets.push('first_response_at = ?'); params.push(now);
      }
      if (body.status === 'resolved' && !ticket.resolved_at) { sets.push('resolved_at = ?'); params.push(now); }
      if (body.status === 'closed') {
        sets.push('closed_at = ?'); params.push(now);
        // Closing without a resolution timestamp would make the ticket look resolved at
        // close time in every report; stamping it here keeps the two clocks honest.
        if (!ticket.resolved_at) { sets.push('resolved_at = ?'); params.push(now); }
      }
      events.push({ kind: 'status_change', body: `${ticket.status} → ${body.status}`, metadata: { from: ticket.status, to: body.status } });
    }
  }

  if (body.priority !== undefined) {
    if (!isTicketPriority(body.priority)) return c.json({ success: false, error: 'Invalid priority' }, 400);
    if (body.priority !== ticket.priority) {
      sets.push('priority = ?'); params.push(body.priority);
      // Raising the priority moves the deadlines with it. Leaving the original due
      // dates would mean an urgent ticket keeping a three-day target, which makes the
      // priority field decorative.
      const policies = await loadPolicies(c.env.DB);
      const due = slaDueDates(resolveSlaPolicy(policies, ticket.category, body.priority), ticket.created_at);
      sets.push('first_response_due_at = ?', 'resolution_due_at = ?');
      params.push(due.first_response_due_at, due.resolution_due_at);
      events.push({
        kind: 'priority_change',
        body: `${ticket.priority} → ${body.priority}`,
        metadata: { from: ticket.priority, to: body.priority, ...due },
      });
    }
  }

  if (body.assignee_id !== undefined) {
    const assignee = typeof body.assignee_id === 'string' && body.assignee_id.trim() ? body.assignee_id.trim() : null;
    if (assignee) {
      const user = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM admin_users WHERE id = ? AND is_active = 1', [assignee]);
      if (!user) return c.json({ success: false, error: 'Assignee not found or inactive' }, 404);
    }
    sets.push('assignee_id = ?'); params.push(assignee);
    events.push({ kind: 'assignment', body: assignee ? `أُسندت إلى ${assignee}` : 'أُلغي الإسناد', metadata: { assignee_id: assignee } });
  }

  if (body.team_id !== undefined) {
    const team = typeof body.team_id === 'string' && body.team_id.trim() ? body.team_id.trim() : null;
    if (team) {
      const exists = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM teams WHERE id = ?', [team]);
      if (!exists) return c.json({ success: false, error: 'Team not found' }, 404);
    }
    sets.push('team_id = ?'); params.push(team);
    events.push({ kind: 'assignment', body: team ? `فريق ${team}` : 'بلا فريق', metadata: { team_id: team } });
  }

  const statements: D1PreparedStatement[] = [];
  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    statements.push(c.env.DB.prepare(`UPDATE support_tickets SET ${sets.join(', ')} WHERE id = ?`).bind(...params, ticket.id));
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) return c.json({ success: false, error: 'tags must be an array' }, 400);
    const tags = [...new Set(body.tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .map((tag) => tag.slice(0, 40)))];
    statements.push(c.env.DB.prepare('DELETE FROM support_ticket_tags WHERE ticket_id = ?').bind(ticket.id));
    for (const tag of tags) {
      statements.push(c.env.DB.prepare('INSERT OR IGNORE INTO support_ticket_tags (ticket_id, tag) VALUES (?, ?)').bind(ticket.id, tag));
    }
    events.push({ kind: 'link', body: `الوسوم: ${tags.join(' · ') || 'بلا وسوم'}`, metadata: { tags } });
  }

  if (!statements.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400);

  for (const event of events) {
    statements.push(c.env.DB.prepare(`
      INSERT INTO support_ticket_events (id, ticket_id, kind, body, metadata_json, actor_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), ticket.id, event.kind, event.body, JSON.stringify(event.metadata), actorId(c)));
  }
  statements.push(auditStatement(c.env.DB, actorId(c), 'support_ticket_update', 'support_ticket', ticket.id, {
    reference: ticket.reference,
    changes: events.map((event) => event.kind),
  }));

  await c.env.DB.batch(statements);
  return c.json({ success: true, data: { id: ticket.id, updated: true } });
});

/// `POST /admin/support/tickets/:id/notes` — an internal note.
route.post('/support/tickets/:id/notes', requirePermission('assign_members'), async (c) => {
  const id = c.req.param('id') ?? '';
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const note = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!note) return c.json({ success: false, error: 'body is required' }, 400);
  if (note.length > 5_000) return c.json({ success: false, error: 'body must be 5000 characters or fewer' }, 400);

  const ticket = await queryFirst<{ id: string; status: TicketStatus; first_response_at: string | null; reference: string }>(
    c.env.DB, 'SELECT id, status, first_response_at, reference FROM support_tickets WHERE id = ?', [id],
  );
  if (!ticket) return c.json({ success: false, error: 'Ticket not found' }, 404);

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(`
      INSERT INTO support_ticket_events (id, ticket_id, kind, body, actor_id, is_internal)
      VALUES (?, ?, 'note', ?, ?, 1)
    `).bind(crypto.randomUUID(), ticket.id, note, actorId(c)),
  ];

  // A note is not a customer reply and does not stamp the first response. There is no
  // outbound channel (see migrations/0031), so treating an internal note as a reply
  // would make the first-response metric measure the wrong thing entirely.
  statements.push(c.env.DB.prepare("UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?").bind(ticket.id));
  statements.push(auditStatement(c.env.DB, actorId(c), 'support_ticket_note', 'support_ticket', ticket.id, {
    reference: ticket.reference, length: note.length,
  }));
  await c.env.DB.batch(statements);
  return c.json({ success: true, data: { id: ticket.id, noted_at: now } });
});

/// `POST /admin/support/tickets/:id/first-response` — records that a reply was sent.
///
/// Explicit, because the platform cannot observe it: the reply travels through
/// whatever channel the family used. Recording it is an operator statement, and the
/// endpoint says so in its audit payload rather than implying delivery.
route.post('/support/tickets/:id/first-response', requirePermission('assign_members'), async (c) => {
  const id = c.req.param('id') ?? '';
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const channel = typeof body?.channel === 'string' ? body.channel.trim().slice(0, 60) : '';
  if (!channel) return c.json({ success: false, error: 'channel is required (how the family was answered)' }, 400);

  const ticket = await queryFirst<{ id: string; reference: string; first_response_at: string | null }>(
    c.env.DB, 'SELECT id, reference, first_response_at FROM support_tickets WHERE id = ?', [id],
  );
  if (!ticket) return c.json({ success: false, error: 'Ticket not found' }, 404);
  if (ticket.first_response_at) {
    return c.json({ success: false, error: 'A first response is already recorded and cannot be overwritten' }, 409);
  }

  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE support_tickets SET first_response_at = ?, updated_at = datetime('now') WHERE id = ?").bind(now, ticket.id),
    c.env.DB.prepare(`
      INSERT INTO support_ticket_events (id, ticket_id, kind, body, metadata_json, actor_id)
      VALUES (?, ?, 'note', ?, ?, ?)
    `).bind(crypto.randomUUID(), ticket.id, `سُجِّل أول ردّ عبر ${channel}.`, JSON.stringify({ channel, recorded_by_operator: true }), actorId(c)),
    auditStatement(c.env.DB, actorId(c), 'support_first_response', 'support_ticket', ticket.id, {
      reference: ticket.reference, channel, note: 'operator-recorded; the platform sends no messages',
    }),
  ]);
  return c.json({ success: true, data: { first_response_at: now } });
});

/// `POST /admin/support/tickets/:id/escalate`
route.post('/support/tickets/:id/escalate', requirePermission('assign_members'), async (c) => {
  const id = c.req.param('id') ?? '';
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return c.json({ success: false, error: 'reason is required' }, 400);

  const ticket = await queryFirst<TicketRow>(c.env.DB, 'SELECT * FROM support_tickets WHERE id = ?', [id]);
  if (!ticket) return c.json({ success: false, error: 'Ticket not found' }, 404);
  if (ticket.status === 'closed') return c.json({ success: false, error: 'A closed ticket cannot be escalated' }, 409);

  // Escalation raises the priority one step and re-derives the deadlines from it.
  // Escalating without moving the clock is a note, not an escalation.
  const next = ticket.priority === 'urgent' ? 'urgent' : ticket.priority === 'high' ? 'urgent' : ticket.priority === 'normal' ? 'high' : 'normal';
  const policies = await loadPolicies(c.env.DB);
  const due = slaDueDates(resolveSlaPolicy(policies, ticket.category, next), new Date().toISOString());

  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE support_tickets
         SET priority = ?, escalated_at = datetime('now'), escalation_reason = ?,
             first_response_due_at = ?, resolution_due_at = ?, updated_at = datetime('now')
       WHERE id = ?
    `).bind(next, reason.slice(0, 500), due.first_response_due_at, due.resolution_due_at, ticket.id),
    c.env.DB.prepare(`
      INSERT INTO support_ticket_events (id, ticket_id, kind, body, metadata_json, actor_id)
      VALUES (?, ?, 'escalation', ?, ?, ?)
    `).bind(crypto.randomUUID(), ticket.id, reason.slice(0, 500), JSON.stringify({ from: ticket.priority, to: next, ...due }), actorId(c)),
    auditStatement(c.env.DB, actorId(c), 'support_ticket_escalate', 'support_ticket', ticket.id, {
      reference: ticket.reference, from: ticket.priority, to: next,
    }),
  ]);
  return c.json({ success: true, data: { priority: next, ...due } });
});

/// `POST /admin/support/tickets/:id/actions`
///
/// Only actions the platform can actually perform are accepted. Everything else is
/// refused with 501 and the specific reason from `UNAVAILABLE_ACTIONS`, so an operator
/// learns where to go instead of retrying a control that looks broken.
route.post('/support/tickets/:id/actions', requirePermission('manage_permissions'), async (c) => {
  const id = c.req.param('id') ?? '';
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!isTicketAction(action)) return c.json({ success: false, error: 'Unknown action' }, 400);
  if (!reason) return c.json({ success: false, error: 'reason is required for any operational action' }, 400);

  const ticket = await queryFirst<{ id: string; reference: string; family_id: string | null }>(
    c.env.DB, 'SELECT id, reference, family_id FROM support_tickets WHERE id = ?', [id],
  );
  if (!ticket) return c.json({ success: false, error: 'Ticket not found' }, 404);

  if (!SUPPORTED_ACTIONS.includes(action)) {
    return c.json({
      success: false,
      error: UNAVAILABLE_ACTIONS[action as keyof typeof UNAVAILABLE_ACTIONS],
      data: { action, available: false, supported_actions: SUPPORTED_ACTIONS },
    }, 501);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO support_ticket_events (id, ticket_id, kind, body, metadata_json, actor_id)
      VALUES (?, ?, 'action', ?, ?, ?)
    `).bind(crypto.randomUUID(), ticket.id, reason.slice(0, 2_000), JSON.stringify({ action, family_id: ticket.family_id }), actorId(c)),
    c.env.DB.prepare("UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?").bind(ticket.id),
    auditStatement(c.env.DB, actorId(c), 'support_ticket_action', 'support_ticket', ticket.id, {
      reference: ticket.reference, action, family_id: ticket.family_id,
    }),
  ]);
  return c.json({ success: true, data: { action, recorded: true } });
});

/// `GET /admin/support/sla` — policies plus the current breach counts.
route.get('/support/sla', requireAdmin, async (c) => {
  const policies = await queryAll(c.env.DB, `
    SELECT id, category, priority, first_response_minutes, resolution_minutes, updated_at
      FROM support_sla_policies ORDER BY category, priority
  `);
  const breaches = await queryFirst<{ response_breaches: number; resolution_breaches: number }>(c.env.DB, `
    SELECT
      (SELECT COUNT(*) FROM support_tickets
        WHERE first_response_at IS NULL AND first_response_due_at IS NOT NULL
          AND status NOT IN ('resolved', 'closed')
          AND first_response_due_at < datetime('now')) AS response_breaches,
      (SELECT COUNT(*) FROM support_tickets
        WHERE resolution_due_at IS NOT NULL
          AND status NOT IN ('resolved', 'closed', 'waiting_customer')
          AND resolution_due_at < datetime('now')) AS resolution_breaches
  `);
  return c.json({
    success: true,
    data: {
      policies,
      open_breaches: {
        first_response: Number(breaches?.response_breaches ?? 0),
        resolution: Number(breaches?.resolution_breaches ?? 0),
      },
    },
  });
});

// --- Saved views -----------------------------------------------------------

route.get('/support/views', requireAdmin, async (c) => {
  const user = c.get('adminUser') as { id?: string } | undefined;
  const rows = await queryAll(c.env.DB, `
    SELECT id, owner_id, name, filters_json, is_shared, created_at
      FROM support_saved_views
     WHERE is_shared = 1 OR owner_id = ?
     ORDER BY is_shared DESC, name
  `, [user?.id ?? '']);
  return c.json({ success: true, data: rows });
});

route.post('/support/views', requirePermission('assign_members'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!name) return c.json({ success: false, error: 'name is required' }, 400);
  const filters = body?.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)
    ? body.filters as Record<string, unknown>
    : null;
  if (!filters) return c.json({ success: false, error: 'filters must be an object' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO support_saved_views (id, owner_id, name, filters_json, is_shared)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, actorId(c), name, JSON.stringify(filters), body?.is_shared === true ? 1 : 0).run();
  return c.json({ success: true, data: { id, name } }, 201);
});

route.delete('/support/views/:id', requirePermission('assign_members'), async (c) => {
  const id = c.req.param('id') ?? '';
  const user = c.get('adminUser') as { id?: string } | undefined;
  const view = await queryFirst<{ id: string; owner_id: string | null; is_shared: number }>(
    c.env.DB, 'SELECT id, owner_id, is_shared FROM support_saved_views WHERE id = ?', [id],
  );
  if (!view) return c.json({ success: false, error: 'View not found' }, 404);
  // A shared view belongs to the team, so deleting one needs more than having made it;
  // a private view is only ever visible to its owner and needs nothing more.
  if (view.is_shared === 1 && view.owner_id !== (user?.id ?? null)) {
    return c.json({ success: false, error: 'A shared view can only be deleted by its owner' }, 403);
  }
  await c.env.DB.prepare('DELETE FROM support_saved_views WHERE id = ?').bind(id).run();
  return c.json({ success: true, data: { id, deleted: true } });
});

export default route;
