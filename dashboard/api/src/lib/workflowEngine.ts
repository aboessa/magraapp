/// The workflow engine's rules: what is actionable, who may decide it, what a
/// decision does, and what the workflow contributes to the publish gate.
///
/// Pure — no D1, no request, no clock. `routes/adminWorkflow.ts` loads the rows and
/// passes `now` in, so dependency and SLA behaviour is unit testable and an overdue
/// test cannot become flaky at an hour boundary.
///
/// ## Why the engine says "actionable" rather than "current"
///
/// The old model had one `workflow_runs.current_step` string. A single cursor can
/// only express a strictly linear process, and the real ones are not: on an episode,
/// translation and media production both depend on the language review and neither
/// depends on the other, so both are legitimately in flight at once. Forcing them
/// through one cursor means either blocking work that could proceed or moving the
/// cursor past a stage nobody did — and the second is what actually happens, because
/// people route around a tool that lies about their work.
///
/// So a stage is actionable when every stage it declares in `depends_on` is
/// approved (or deliberately skipped), and the engine returns *all* of them.
///
/// ## Authorization is part of the transition, not a decoration on it
///
/// [transitionRefusal] returns null only when the actor holds the stage's required
/// permission and, when one is declared, its required role. The route must call it;
/// the reason it lives here rather than inline is that the same decision has to be
/// answerable to the UI *before* a click, so a reviewer sees a disabled control with
/// a reason instead of a 403 after the fact.
///
/// ## What this deliberately does not do
///
/// It does not touch content status. A stage approval is a statement about a review,
/// not about publication, and coupling them was the defect in the other direction:
/// the previous review endpoint had to be careful not to flip a run to `approved`
/// and imply a publish. Publication remains the publish operation's decision, and
/// [workflowPublishBlockers] is how the workflow's opinion reaches it.

export const STAGE_STATUSES = [
  'pending', 'in_progress', 'approved', 'rejected', 'changes_requested', 'skipped',
] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const STAGE_DECISIONS = ['approved', 'rejected', 'changes_requested', 'skipped'] as const;
export type StageDecision = (typeof STAGE_DECISIONS)[number];

export function isStageDecision(value: unknown): value is StageDecision {
  return typeof value === 'string' && (STAGE_DECISIONS as readonly string[]).includes(value);
}

export interface WorkflowStage {
  stage_key: string;
  name_ar: string;
  sort_order: number;
  required_role: string | null;
  required_permission: string | null;
  sla_hours: number | null;
  escalate_after_hours: number | null;
  blocks_publish: boolean;
  depends_on: string[];
  instructions_ar: string | null;
}

export interface WorkflowRunStage {
  stage_key: string;
  status: StageStatus;
  assignee_id: string | null;
  assignee_team_id: string | null;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  decided_by: string | null;
  decision_comment: string | null;
  skip_reason: string | null;
}

/// The acting admin, as the session and the grant tables describe them.
export interface WorkflowActor {
  id: string;
  /// Permission actions the actor holds, from `role_permissions` via `access_grants`.
  permissions: string[];
  /// Role ids the actor holds.
  roles: string[];
  /// Team ids the actor belongs to.
  teams: string[];
}

/// A stage that can be decided right now, and why.
export interface ActionableStage {
  stage: WorkflowStage;
  run_stage: WorkflowRunStage;
  /// Dependencies that are satisfied, for display.
  satisfied_by: string[];
}

const isSettled = (status: StageStatus) => status === 'approved' || status === 'skipped';

/// Every stage whose dependencies are met and which is not itself settled.
///
/// A stage in `rejected` or `changes_requested` is actionable again: that is the
/// whole point of requesting changes — the work returns to the same stage rather
/// than to a new one, and the history keeps both decisions.
export function actionableStages(
  stages: WorkflowStage[],
  runStages: WorkflowRunStage[],
): ActionableStage[] {
  const byKey = new Map(runStages.map((entry) => [entry.stage_key, entry]));
  const ordered = [...stages].sort((left, right) => left.sort_order - right.sort_order);

  return ordered.flatMap((stage) => {
    const runStage = byKey.get(stage.stage_key);
    if (!runStage || isSettled(runStage.status)) return [];

    // Dependencies are named by key rather than implied by order, so a stage with an
    // empty list is actionable immediately even if it sorts last. Order is for
    // presentation; `depends_on` is the contract.
    const unmet = stage.depends_on.filter((key) => {
      const dependency = byKey.get(key);
      return !dependency || !isSettled(dependency.status);
    });
    if (unmet.length) return [];

    return [{ stage, run_stage: runStage, satisfied_by: stage.depends_on }];
  });
}

/// Dependencies of a stage that are not yet settled.
export function unmetDependencies(
  stage: WorkflowStage,
  runStages: WorkflowRunStage[],
): string[] {
  const byKey = new Map(runStages.map((entry) => [entry.stage_key, entry]));
  return stage.depends_on.filter((key) => {
    const dependency = byKey.get(key);
    return !dependency || !isSettled(dependency.status);
  });
}

/// Why a transition must be refused, or null when it is allowed.
///
/// Returns an Arabic sentence rather than a boolean because every refusal here is
/// shown to a person who then has to do something about it, and "غير مسموح" is not
/// something anyone can act on.
export function transitionRefusal(
  stage: WorkflowStage,
  runStages: WorkflowRunStage[],
  actor: WorkflowActor,
  decision: StageDecision,
): string | null {
  const unmet = unmetDependencies(stage, runStages);
  if (unmet.length) {
    return `المرحلة معلَّقة على مراحل غير مكتملة: ${unmet.join(' · ')}.`;
  }

  const current = runStages.find((entry) => entry.stage_key === stage.stage_key);
  if (!current) return 'لا صفّ لهذه المرحلة في هذه التشغيلة.';
  if (isSettled(current.status)) {
    return `المرحلة محسومة بالفعل (${current.status})؛ أعِد فتحها بطلب تعديل على مرحلة لاحقة بدل تغيير قرارها.`;
  }

  // Skipping is a stronger act than approving: it removes a required step from a
  // process someone designed. It needs the stage's own authority *plus* the
  // authority to override the process, which in the seeded permission set is
  // `manage_permissions` — the closest thing to a process owner. Without this,
  // "skip" is a way to approve without being allowed to approve.
  if (decision === 'skipped' && !actor.permissions.includes('manage_permissions')) {
    return 'تخطّي مرحلة مطلوبة يحتاج صلاحية إدارة الصلاحيات (مالك العملية)، لا صلاحية المرحلة وحدها.';
  }

  if (stage.required_permission && !actor.permissions.includes(stage.required_permission)) {
    return `هذه المرحلة تحتاج صلاحية «${stage.required_permission}».`;
  }
  if (stage.required_role && !actor.roles.includes(stage.required_role)) {
    return `هذه المرحلة تحتاج دور «${stage.required_role}».`;
  }
  // A stage with neither declared falls back to the generic approval permission,
  // which is the behaviour that existed before stages had requirements.
  if (!stage.required_permission && !stage.required_role && !actor.permissions.includes('approve')) {
    return 'هذه المرحلة تحتاج صلاحية الاعتماد.';
  }
  return null;
}

/// The stage states a decision produces, including the effect on dependents.
///
/// A rejection or a change request does **not** reset the stages that already
/// approved before it: their reviewers did review the thing they saw, and discarding
/// that would make every rejection cost the whole chain again. Dependents that had
/// started are returned to `pending`, because the thing they were working from has
/// changed underneath them.
export function applyDecision(
  stages: WorkflowStage[],
  runStages: WorkflowRunStage[],
  stageKey: string,
  decision: StageDecision,
  actorId: string,
  now: string,
): Array<{ stage_key: string; status: StageStatus; completed_at: string | null; decided_by: string | null }> {
  const updates: Array<{ stage_key: string; status: StageStatus; completed_at: string | null; decided_by: string | null }> = [
    {
      stage_key: stageKey,
      status: decision,
      completed_at: decision === 'approved' || decision === 'skipped' ? now : null,
      decided_by: actorId,
    },
  ];

  if (decision === 'rejected' || decision === 'changes_requested') {
    const dependents = stages.filter((stage) => stage.depends_on.includes(stageKey));
    for (const dependent of dependents) {
      const current = runStages.find((entry) => entry.stage_key === dependent.stage_key);
      if (current && current.status === 'in_progress') {
        updates.push({ stage_key: dependent.stage_key, status: 'pending', completed_at: null, decided_by: null });
      }
    }
  }
  return updates;
}

/// The run status implied by its stages.
///
/// `approved` only when every blocking stage is settled: a run that reports approved
/// while a required review is pending is the exact misreport the old model produced
/// by advancing a cursor.
export function runStatusFor(
  stages: WorkflowStage[],
  runStages: WorkflowRunStage[],
): 'running' | 'approved' | 'rejected' {
  if (runStages.some((entry) => entry.status === 'rejected')) return 'rejected';
  const blocking = stages.filter((stage) => stage.blocks_publish);
  const byKey = new Map(runStages.map((entry) => [entry.stage_key, entry]));
  const allSettled = blocking.every((stage) => {
    const entry = byKey.get(stage.stage_key);
    return entry ? isSettled(entry.status) : false;
  });
  return allSettled ? 'approved' : 'running';
}

/// The due timestamp for a stage that has just become actionable.
export function dueAt(stage: WorkflowStage, from: string): string | null {
  if (!stage.sla_hours) return null;
  return new Date(new Date(from).getTime() + stage.sla_hours * 3_600_000).toISOString();
}

export interface OverdueStage {
  stage_key: string;
  name_ar: string;
  due_at: string;
  hours_late: number;
  escalated: boolean;
  assignee_id: string | null;
  assignee_team_id: string | null;
}

/// Stages past their due time, with escalation state.
///
/// Escalation is derived rather than stored: a stored flag needs a scheduled job to
/// set it, and a job that fails silently produces a workflow that looks healthy. A
/// derived answer cannot drift from the data it is derived from.
export function overdueStages(
  stages: WorkflowStage[],
  runStages: WorkflowRunStage[],
  now: string,
): OverdueStage[] {
  const byKey = new Map(stages.map((stage) => [stage.stage_key, stage]));
  const currentTime = new Date(now).getTime();

  return runStages.flatMap((entry) => {
    if (isSettled(entry.status) || !entry.due_at) return [];
    const due = new Date(entry.due_at).getTime();
    if (!(currentTime > due)) return [];
    const stage = byKey.get(entry.stage_key);
    const hoursLate = (currentTime - due) / 3_600_000;
    const escalateAfter = stage?.escalate_after_hours ?? null;
    return [{
      stage_key: entry.stage_key,
      name_ar: stage?.name_ar ?? entry.stage_key,
      due_at: entry.due_at,
      hours_late: Math.round(hoursLate * 10) / 10,
      escalated: escalateAfter !== null && hoursLate >= escalateAfter,
      assignee_id: entry.assignee_id,
      assignee_team_id: entry.assignee_team_id,
    }];
  });
}

export interface WorkflowPublishBlocker {
  stage_key: string;
  name_ar: string;
  status: StageStatus;
  assignee_id: string | null;
  detail: string;
}

/// The workflow's contribution to the publish gate.
///
/// This is the mechanism that stops a status string bypassing a required gate. Every
/// stage with `blocks_publish` that is not approved or deliberately skipped is
/// returned, and `lib/publishGate.ts` turns each into a blocker with the reviewer as
/// its owner.
///
/// A run that does not exist yields no blockers. That is a deliberate limit and it is
/// stated rather than hidden: most existing catalogue rows predate the engine, and
/// requiring a run would mark the entire published library unpublishable on the day
/// this shipped. The gate reports the absence as a warning instead, so the gap is
/// visible without being paralysing.
export function workflowPublishBlockers(
  stages: WorkflowStage[],
  runStages: WorkflowRunStage[],
): WorkflowPublishBlocker[] {
  const byKey = new Map(runStages.map((entry) => [entry.stage_key, entry]));
  return stages
    .filter((stage) => stage.blocks_publish)
    .sort((left, right) => left.sort_order - right.sort_order)
    .flatMap((stage) => {
      const entry = byKey.get(stage.stage_key);
      if (entry && isSettled(entry.status)) return [];
      const status: StageStatus = entry?.status ?? 'pending';
      const detail = status === 'rejected'
        ? 'المرحلة مرفوضة، فالنشر يتجاوز قرار مراجع صريح.'
        : status === 'changes_requested'
          ? 'المرحلة أعادت العمل بطلب تعديلات غير منفَّذة.'
          : status === 'in_progress'
            ? 'المرحلة قيد التنفيذ ولم تُعتمد.'
            : 'المرحلة لم تبدأ.';
      return [{
        stage_key: stage.stage_key,
        name_ar: stage.name_ar,
        status,
        assignee_id: entry?.assignee_id ?? null,
        detail,
      }];
    });
}
