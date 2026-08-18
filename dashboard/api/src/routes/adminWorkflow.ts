/// The workflow engine's HTTP surface.
///
/// `lib/workflowEngine.ts` holds the rules; this loads the rows, enforces the
/// transition and writes the history. Mounted on the admin prefix.
///
/// ## One history, not two
///
/// Every decision writes both the stage row (`workflow_run_stages`, the state) and a
/// `workflow_step_reviews` row (the history). The second is not redundant: it is the
/// table the pre-existing history endpoint reads, and keeping one trail means a
/// question like "who approved the language review, and when, and what did they say"
/// has exactly one answer. Two trails always diverge, and the divergence is only
/// discovered when someone needs the record.
///
/// ## Runs are created explicitly
///
/// Nothing auto-creates a run when content is created. Deriving one implicitly was
/// considered and rejected: the template depends on the *kind* of content — an
/// Islamic episode follows the Islamic path, not the episode path — and guessing
/// from a planet id is exactly the sort of inference `lib/islamicContent.ts` records
/// getting wrong for the entire catalogue. The template is chosen by a person, and
/// the publish gate reports the absence of a run as a warning rather than silently
/// treating unmanaged content as approved.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';
import { checkSelfApproval, SELF_APPROVAL_ERROR } from '../lib/separationOfDuties.ts';
// The deadline predicate lives with the support CRM because that is where the format mismatch
// was first diagnosed, but it is not support-specific: workflow stage deadlines are written
// the same way (`new Date().toISOString()`) and compared against the same `datetime('now')`,
// so this handler had the identical defect — same-day stage breaches were invisible while
// cross-day ones happened to work. Found by the executive metric audit.
import { SQL_DEADLINE_PASSED } from '../lib/supportCrm.ts';
import {
  actionableStages,
  applyDecision,
  dueAt,
  isStageDecision,
  overdueStages,
  runStatusFor,
  transitionRefusal,
  unmetDependencies,
  type WorkflowActor,
  type WorkflowRunStage,
  type WorkflowStage,
} from '../lib/workflowEngine.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

const parseKeys = (raw: unknown): string[] => {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

interface StageRow {
  stage_key: string; name_ar: string; sort_order: number;
  required_role: string | null; required_permission: string | null;
  sla_hours: number | null; escalate_after_hours: number | null;
  blocks_publish: number; depends_on: string; instructions_ar: string | null;
}

const toStage = (row: StageRow): WorkflowStage => ({
  stage_key: row.stage_key,
  name_ar: row.name_ar,
  sort_order: Number(row.sort_order) || 0,
  required_role: row.required_role,
  required_permission: row.required_permission,
  sla_hours: row.sla_hours === null ? null : Number(row.sla_hours),
  escalate_after_hours: row.escalate_after_hours === null ? null : Number(row.escalate_after_hours),
  blocks_publish: Number(row.blocks_publish) === 1,
  depends_on: parseKeys(row.depends_on),
  instructions_ar: row.instructions_ar,
});

export async function loadTemplateStages(db: D1Database, templateId: string): Promise<WorkflowStage[]> {
  const rows = await queryAll<StageRow>(db, `
    SELECT stage_key, name_ar, sort_order, required_role, required_permission,
           sla_hours, escalate_after_hours, blocks_publish, depends_on, instructions_ar
      FROM workflow_stages WHERE template_id = ? ORDER BY sort_order
  `, [templateId]);
  return rows.map(toStage);
}

export async function loadRunStages(db: D1Database, runId: string): Promise<WorkflowRunStage[]> {
  return queryAll<WorkflowRunStage>(db, `
    SELECT stage_key, status, assignee_id, assignee_team_id, due_at, started_at,
           completed_at, decided_by, decision_comment, skip_reason
      FROM workflow_run_stages WHERE run_id = ?
  `, [runId]);
}

/// The run governing one content item, with its template's stages.
///
/// Exported for `lib/publishGate.ts`'s gatherer: the gate must read the same rows the
/// workflow screen reads, or the two will disagree about whether something is
/// approved.
export async function workflowFor(
  db: D1Database,
  contentType: string,
  contentId: string,
): Promise<{ runId: string; status: string; stages: WorkflowStage[]; runStages: WorkflowRunStage[] } | null> {
  const run = await queryFirst<{ id: string; template_id: string | null; status: string }>(db, `
    SELECT id, template_id, status FROM workflow_runs WHERE content_type = ? AND content_id = ?
  `, [contentType, contentId]);
  if (!run || !run.template_id) return null;
  return {
    runId: run.id,
    status: run.status,
    stages: await loadTemplateStages(db, run.template_id),
    runStages: await loadRunStages(db, run.id),
  };
}

function actorFrom(c: { get: (key: string) => unknown }): WorkflowActor {
  const user = c.get('adminUser') as { id?: string; roles?: string[]; permissions?: string[] } | undefined;
  return {
    id: user?.id ?? 'legacy-admin-key',
    // A break-glass key holder has no roles or grants. Rather than treating that as
    // "no authority" (which would lock the only account available before the first
    // user is seeded) or as "all authority" (which would erase stage requirements),
    // it is given the generic approval permission only, so stage-specific
    // requirements still refuse it.
    permissions: user?.permissions ?? ['approve'],
    roles: user?.roles ?? [],
    teams: [],
  };
}

// --- Templates -------------------------------------------------------------

route.get('/workflows/templates', requireAdmin, async (c) => {
  const templates = await queryAll<{ id: string; name_ar: string; content_type: string }>(c.env.DB, `
    SELECT id, name_ar, content_type FROM workflow_templates ORDER BY id
  `);
  const stages = await queryAll<StageRow & { template_id: string }>(c.env.DB, `
    SELECT template_id, stage_key, name_ar, sort_order, required_role, required_permission,
           sla_hours, escalate_after_hours, blocks_publish, depends_on, instructions_ar
      FROM workflow_stages ORDER BY template_id, sort_order
  `);
  return c.json({
    success: true,
    data: templates.map((template) => ({
      ...template,
      stages: stages.filter((stage) => stage.template_id === template.id).map(toStage),
    })),
  });
});

// --- Runs ------------------------------------------------------------------

/// `POST /admin/workflows/runs` — starts a run for one content item.
route.post('/workflows/runs', requirePermission('assign_members'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const contentType = typeof body?.content_type === 'string' ? body.content_type.trim() : '';
  const contentId = typeof body?.content_id === 'string' ? body.content_id.trim() : '';
  const templateId = typeof body?.template_id === 'string' ? body.template_id.trim() : '';
  if (!contentType || !contentId || !templateId) {
    return c.json({ success: false, error: 'content_type, content_id and template_id are required' }, 400);
  }

  const template = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM workflow_templates WHERE id = ?', [templateId]);
  if (!template) return c.json({ success: false, error: 'Workflow template not found' }, 404);

  const stages = await loadTemplateStages(c.env.DB, templateId);
  if (!stages.length) {
    // A template with no stages would create a run that is instantly "approved",
    // which is worse than no run at all: it would satisfy the publish gate.
    return c.json({ success: false, error: 'This template has no stages, so it cannot govern anything' }, 409);
  }

  const existing = await queryFirst<{ id: string }>(c.env.DB, `
    SELECT id FROM workflow_runs WHERE content_type = ? AND content_id = ?
  `, [contentType, contentId]);
  if (existing) return c.json({ success: false, error: 'A workflow run already exists for this content' }, 409);

  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const first = stages[0];

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(`
      INSERT INTO workflow_runs (id, content_type, content_id, template_id, current_step, status)
      VALUES (?, ?, ?, ?, ?, 'running')
    `).bind(runId, contentType, contentId, templateId, first.stage_key),
  ];
  for (const stage of stages) {
    // Only stages with no dependencies get a due date at creation: an SLA that
    // starts counting while the stage is blocked on another one measures the
    // predecessor's delay and blames the wrong person.
    const startsNow = stage.depends_on.length === 0;
    statements.push(c.env.DB.prepare(`
      INSERT INTO workflow_run_stages (id, run_id, stage_key, status, due_at, started_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), runId, stage.stage_key,
      startsNow ? 'in_progress' : 'pending',
      startsNow ? dueAt(stage, now) : null,
      startsNow ? now : null,
    ));
  }
  statements.push(auditStatement(c.env.DB, actorId(c), 'workflow_start', contentType, contentId, {
    run_id: runId, template_id: templateId, stages: stages.map((stage) => stage.stage_key),
  }));

  await c.env.DB.batch(statements);
  return c.json({ success: true, data: { run_id: runId, template_id: templateId, stages: stages.length } }, 201);
});

/// `GET /admin/workflows/runs/:id` — state, actionable stages, overdue and history.
route.get('/workflows/runs/:id', requireAdmin, async (c) => {
  const runId = c.req.param('id') ?? '';
  const run = await queryFirst<{
    id: string; content_type: string; content_id: string; template_id: string | null;
    current_step: string; status: string; created_at: string; updated_at: string;
  }>(c.env.DB, 'SELECT * FROM workflow_runs WHERE id = ?', [runId]);
  if (!run) return c.json({ success: false, error: 'Workflow run not found' }, 404);

  const stages = run.template_id ? await loadTemplateStages(c.env.DB, run.template_id) : [];
  const runStages = await loadRunStages(c.env.DB, runId);
  const now = new Date().toISOString();
  const actor = actorFrom(c);

  const history = await queryAll(c.env.DB, `
    SELECT wsr.id, wsr.step, wsr.decision, wsr.comment, wsr.created_at,
           wsr.reviewer_id, au.display_name AS reviewer_name
      FROM workflow_step_reviews wsr
      LEFT JOIN admin_users au ON au.id = wsr.reviewer_id
     WHERE wsr.run_id = ?
     ORDER BY wsr.created_at DESC
  `, [runId]);

  return c.json({
    success: true,
    data: {
      run,
      stages: stages.map((stage) => {
        const entry = runStages.find((candidate) => candidate.stage_key === stage.stage_key) ?? null;
        // The refusal reason is returned per stage so the UI can disable a control
        // and say why, instead of letting a reviewer click and receive a 403.
        const refusal = entry ? transitionRefusal(stage, runStages, actor, 'approved') : 'لا صفّ لهذه المرحلة.';
        return {
          ...stage,
          run_stage: entry,
          unmet_dependencies: unmetDependencies(stage, runStages),
          can_decide: refusal === null,
          refusal_reason: refusal,
        };
      }),
      actionable: actionableStages(stages, runStages).map((entry) => entry.stage.stage_key),
      overdue: overdueStages(stages, runStages, now),
      implied_status: runStatusFor(stages, runStages),
      history,
    },
  });
});

/// `POST /admin/workflows/runs/:id/stages/:key/assign`
route.post('/workflows/runs/:id/stages/:key/assign', requirePermission('assign_members'), async (c) => {
  const runId = c.req.param('id') ?? '';
  const stageKey = c.req.param('key') ?? '';
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const assigneeId = typeof body?.assignee_id === 'string' && body.assignee_id ? body.assignee_id : null;
  const teamId = typeof body?.assignee_team_id === 'string' && body.assignee_team_id ? body.assignee_team_id : null;
  const dueDate = typeof body?.due_at === 'string' && body.due_at ? body.due_at : null;
  if (dueDate && Number.isNaN(Date.parse(dueDate))) {
    return c.json({ success: false, error: 'due_at must be an ISO 8601 timestamp' }, 400);
  }

  const stage = await queryFirst<{ id: string }>(c.env.DB, `
    SELECT id FROM workflow_run_stages WHERE run_id = ? AND stage_key = ?
  `, [runId, stageKey]);
  if (!stage) return c.json({ success: false, error: 'Stage not found on this run' }, 404);

  // An assignee must exist. A dangling id looks assigned on screen and reaches
  // nobody, which is worse than an unassigned stage that is visibly unassigned.
  if (assigneeId) {
    const user = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM admin_users WHERE id = ? AND is_active = 1', [assigneeId]);
    if (!user) return c.json({ success: false, error: 'Assignee not found or inactive' }, 404);
  }
  if (teamId) {
    const team = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM teams WHERE id = ?', [teamId]);
    if (!team) return c.json({ success: false, error: 'Team not found' }, 404);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE workflow_run_stages
         SET assignee_id = ?, assignee_team_id = ?, due_at = COALESCE(?, due_at),
             updated_at = datetime('now')
       WHERE run_id = ? AND stage_key = ?
    `).bind(assigneeId, teamId, dueDate, runId, stageKey),
    auditStatement(c.env.DB, actorId(c), 'workflow_assign', 'workflow_run', runId, {
      stage_key: stageKey, assignee_id: assigneeId, assignee_team_id: teamId, due_at: dueDate,
    }),
  ]);
  return c.json({ success: true, data: { run_id: runId, stage_key: stageKey, assignee_id: assigneeId } });
});

/// `POST /admin/workflows/runs/:id/stages/:key/decision`
///
/// The transition. Guarded by `review` at the router level and by the stage's own
/// requirement inside [transitionRefusal] — the outer guard keeps the endpoint away
/// from accounts with no review authority at all, the inner one enforces *which*
/// stage this particular person may decide.
route.post('/workflows/runs/:id/stages/:key/decision', requirePermission('review'), async (c) => {
  const runId = c.req.param('id') ?? '';
  const stageKey = c.req.param('key') ?? '';
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const decision = body?.decision;
  if (!isStageDecision(decision)) {
    return c.json({ success: false, error: 'decision must be approved, rejected, changes_requested or skipped' }, 400);
  }
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';
  if (comment.length > 2_000) {
    return c.json({ success: false, error: 'Comment must be 2000 characters or fewer' }, 400);
  }
  // A refusal with no reason is unactionable for whoever has to fix it, and a skip
  // with no reason is indistinguishable from a stage nobody noticed.
  if ((decision === 'rejected' || decision === 'changes_requested' || decision === 'skipped') && !comment) {
    return c.json({ success: false, error: 'A comment is required when rejecting, requesting changes or skipping' }, 400);
  }

  const run = await queryFirst<{
    id: string; content_type: string; content_id: string; template_id: string | null; status: string;
  }>(c.env.DB, 'SELECT id, content_type, content_id, template_id, status FROM workflow_runs WHERE id = ?', [runId]);
  if (!run) return c.json({ success: false, error: 'Workflow run not found' }, 404);
  if (run.status === 'cancelled') return c.json({ success: false, error: 'Workflow run is cancelled' }, 409);
  if (!run.template_id) return c.json({ success: false, error: 'Workflow run has no template' }, 409);

  const stages = await loadTemplateStages(c.env.DB, run.template_id);
  const stage = stages.find((candidate) => candidate.stage_key === stageKey);
  if (!stage) return c.json({ success: false, error: 'Stage not found on this template' }, 404);
  const runStages = await loadRunStages(c.env.DB, runId);

  const actor = actorFrom(c);
  const refusal = transitionRefusal(stage, runStages, actor, decision);
  if (refusal) return c.json({ success: false, error: refusal }, 403);

  // Creator/approver separation, on the content rather than on the run: the
  // authorship record lives in audit_logs against the content id. Applied only to
  // approvals — the rule protects against self-approval, not self-criticism.
  if (decision === 'approved') {
    const separation = await checkSelfApproval(c.env.DB, {
      entityType: run.content_type,
      entityId: run.content_id,
      approverId: actor.id,
    });
    if (!separation.ok) return c.json({ success: false, error: SELF_APPROVAL_ERROR }, 409);
  }

  const now = new Date().toISOString();
  const updates = applyDecision(stages, runStages, stageKey, decision, actor.id, now);
  const statements: D1PreparedStatement[] = [];

  for (const update of updates) {
    statements.push(c.env.DB.prepare(`
      UPDATE workflow_run_stages
         SET status = ?, completed_at = ?, decided_by = ?, decision_comment = ?,
             skip_reason = ?, updated_at = datetime('now')
       WHERE run_id = ? AND stage_key = ?
    `).bind(
      update.status,
      update.completed_at,
      update.decided_by,
      update.stage_key === stageKey ? (comment || null) : null,
      update.stage_key === stageKey && decision === 'skipped' ? comment : null,
      runId, update.stage_key,
    ));
  }

  // Newly unblocked stages start their clock now. Doing it here rather than lazily
  // means "overdue" is computed from when the work actually became possible.
  const projected = runStages.map((entry) => {
    const update = updates.find((candidate) => candidate.stage_key === entry.stage_key);
    return update ? { ...entry, status: update.status } : entry;
  });
  for (const candidate of actionableStages(stages, projected)) {
    if (candidate.run_stage.status !== 'pending') continue;
    statements.push(c.env.DB.prepare(`
      UPDATE workflow_run_stages
         SET status = 'in_progress', started_at = ?, due_at = COALESCE(due_at, ?),
             updated_at = datetime('now')
       WHERE run_id = ? AND stage_key = ?
    `).bind(now, dueAt(candidate.stage, now), runId, candidate.stage.stage_key));
  }

  const impliedStatus = runStatusFor(stages, projected);
  const nextActionable = actionableStages(stages, projected)[0]?.stage.stage_key ?? stageKey;
  statements.push(c.env.DB.prepare(`
    UPDATE workflow_runs SET status = ?, current_step = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(impliedStatus, nextActionable, runId));

  // The history row, in the same table the pre-existing history endpoint reads.
  statements.push(c.env.DB.prepare(`
    INSERT INTO workflow_step_reviews (id, run_id, step, reviewer_id, decision, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), runId, stageKey, actor.id,
    // `workflow_step_reviews.decision` has a CHECK of approved/rejected/
    // changes_requested and does not know about skipping. A skip is recorded as a
    // change of process rather than forced into a review verb it is not: it is
    // stored as `changes_requested` with the reason, and the stage row carries the
    // authoritative `skipped` status. Widening the CHECK needs a table rebuild.
    decision === 'skipped' ? 'changes_requested' : decision,
    decision === 'skipped' ? `[skipped] ${comment}` : (comment || null),
  ));
  statements.push(auditStatement(c.env.DB, actor.id, 'workflow_decision', run.content_type, run.content_id, {
    run_id: runId, stage_key: stageKey, decision, implied_status: impliedStatus,
  }));

  await c.env.DB.batch(statements);
  return c.json({
    success: true,
    data: { run_id: runId, stage_key: stageKey, decision, run_status: impliedStatus },
  });
});

/// `GET /admin/workflows/overdue` — SLA breaches and escalations across all runs.
route.get('/workflows/overdue', requireAdmin, async (c) => {
  const rows = await queryAll<{
    run_id: string; content_type: string; content_id: string; template_id: string | null;
    stage_key: string; status: string; due_at: string | null;
    assignee_id: string | null; assignee_team_id: string | null;
    name_ar: string | null; escalate_after_hours: number | null;
  }>(c.env.DB, `
    SELECT wr.id AS run_id, wr.content_type, wr.content_id, wr.template_id,
           rs.stage_key, rs.status, rs.due_at, rs.assignee_id, rs.assignee_team_id,
           ws.name_ar, ws.escalate_after_hours
      FROM workflow_run_stages rs
      JOIN workflow_runs wr ON wr.id = rs.run_id
      LEFT JOIN workflow_stages ws ON ws.template_id = wr.template_id AND ws.stage_key = rs.stage_key
     WHERE rs.due_at IS NOT NULL
       AND rs.status NOT IN ('approved', 'skipped')
       AND wr.status = 'running'
       AND ${SQL_DEADLINE_PASSED('rs.due_at')}
     ORDER BY rs.due_at ASC
  `);

  const now = Date.now();
  return c.json({
    success: true,
    data: rows.map((row) => {
      const hoursLate = row.due_at ? (now - new Date(row.due_at).getTime()) / 3_600_000 : 0;
      return {
        ...row,
        hours_late: Math.round(hoursLate * 10) / 10,
        escalated: row.escalate_after_hours !== null && hoursLate >= Number(row.escalate_after_hours),
      };
    }),
    meta: { total: rows.length },
  });
});

/// `GET /admin/workflows/my-stages` — the signed-in reviewer's actionable work.
route.get('/workflows/my-stages', requireAdmin, async (c) => {
  const user = c.get('adminUser') as { id?: string } | undefined;
  if (!user?.id) {
    // The break-glass key is not a person, so it has no queue. Returning an empty
    // list rather than everything avoids implying that the key owns the work.
    return c.json({ success: true, data: [], meta: { total: 0, reason: 'no_session_identity' } });
  }
  const rows = await queryAll(c.env.DB, `
    SELECT wr.id AS run_id, wr.content_type, wr.content_id, rs.stage_key, rs.status,
           rs.due_at, ws.name_ar, ws.blocks_publish
      FROM workflow_run_stages rs
      JOIN workflow_runs wr ON wr.id = rs.run_id
      LEFT JOIN workflow_stages ws ON ws.template_id = wr.template_id AND ws.stage_key = rs.stage_key
     WHERE rs.assignee_id = ? AND rs.status NOT IN ('approved', 'skipped') AND wr.status = 'running'
     ORDER BY rs.due_at IS NULL, rs.due_at ASC
  `, [user.id]);
  return c.json({ success: true, data: rows, meta: { total: rows.length } });
});

export default route;
