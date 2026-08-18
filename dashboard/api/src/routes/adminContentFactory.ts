import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';
import { checkSelfApproval, SELF_APPROVAL_ERROR } from '../lib/separationOfDuties.ts';
import {
  CONTENT_FACTORY_MESSAGE_SCHEMA,
  ContentFactoryValidationError,
  MAX_MANIFEST_BYTES,
  assertManifestReadyForApproval,
  canonicalJson,
  createSpendApprovalFingerprint,
  creditsToMicros,
  microsToCredits,
  parseFactoryManifest,
  sha256Hex,
  type ContentFactoryMessage,
  type FactoryManifest,
} from '../lib/contentFactory.ts';
import {
  ContentFactoryQcError,
  createFactoryHumanReview,
  factoryHumanGateIds,
  factoryHumanReviewsSha,
  prepareAutomatedQc,
  type FactoryHumanReviewProjection,
} from '../lib/contentFactoryQc.ts';
import {
  dispatchJobReservationsComplete,
  refreshContentFactoryRunState,
} from '../queue/contentFactory.ts';

type AppEnv = { Bindings: Env };
type JsonRecord = Record<string, unknown>;

type RunRow = {
  id: string;
  manifest_id: string;
  schema_version: string;
  revision: number;
  entity_type: string;
  entity_id: string;
  planet_slug: string;
  series_slug: string;
  pipeline_profile: string;
  source_sha256: string;
  plan_sha256: string;
  inventory_sha256: string | null;
  manifest_json: string;
  state: string;
  blocker_count: number;
  unpriced_job_count: number;
  estimate_low_micros: number;
  estimate_high_micros: number;
  estimate_with_contingency_micros: number;
  approved_ceiling_micros: number | null;
  spend_approval_sha256: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  dispatched_by: string | null;
  dispatched_at: string | null;
  dispatch_idempotency_key: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
};

type JobRow = {
  id: string;
  run_id: string;
  job_id: string;
  kind: string;
  provider: string;
  operation: string;
  idempotency_key: string;
  dependencies_json: string;
  input_json: string;
  duration_seconds: number | null;
  item_count: number | null;
  page_index: number | null;
  state: string;
  estimate_low_micros: number;
  estimate_high_micros: number;
  reserved_micros: number;
  current_attempt_id: string | null;
  created_at: string;
  updated_at: string;
};

type QcTargetRow = {
  run_id: string;
  run_state: string;
  plan_sha256: string;
  manifest_json: string;
  factory_job_id: string;
  job_id: string;
  job_state: string;
  current_attempt_id: string | null;
  attempt_id: string;
  attempt_state: string;
  asset_sha256: string | null;
  private_asset_key: string | null;
  automated_qc_sha256: string | null;
};

type HumanReviewRow = {
  gate_id: string;
  decision: 'approved' | 'rejected';
  reviewer_id: string;
  plan_sha256: string;
  asset_sha256: string;
  automated_qc_sha256: string;
  review_sha256: string;
  notes: string | null;
  reviewed_at: string;
};

const route = new Hono<AppEnv>();
const RUN_STATES = new Set([
  'planned', 'blocked', 'awaiting_spend_approval', 'approved', 'queued', 'running',
  'paused', 'awaiting_qc', 'awaiting_human_review', 'partially_failed', 'failed',
  'completed', 'cancelled',
]);
const RESUMABLE_JOB_STATES = [
  'submitting', 'submitted', 'provider_pending', 'provider_processing',
  'provider_completed', 'polling_failed', 'timed_out', 'download_failed',
];
const FAILED_JOB_STATES = [
  'submission_failed', 'provider_failed', 'provider_cancelled', 'polling_failed',
  'timed_out', 'download_failed', 'automated_qc_failed',
  'human_review_rejected',
];
const REPLACEMENT_JOB_STATES = new Set([
  'submission_failed', 'provider_failed', 'provider_cancelled',
  'automated_qc_failed', 'human_review_rejected',
]);

route.use('*', requireAdmin);

async function body(c: { req: { header(name: string): string | undefined; text(): Promise<string> } }): Promise<JsonRecord | null> {
  const declared = Number(c.req.header('Content-Length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_MANIFEST_BYTES + 50_000) return null;
  const raw = await c.req.text().catch(() => '');
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_MANIFEST_BYTES + 50_000) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null;
  } catch {
    return null;
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function changes(result: D1Result | undefined): number {
  return Number(result?.meta?.changes ?? 0);
}

function serializeRun(row: RunRow) {
  return {
    id: row.id,
    manifest_id: row.manifest_id,
    revision: row.revision,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    planet_slug: row.planet_slug,
    series_slug: row.series_slug,
    pipeline_profile: row.pipeline_profile,
    source_sha256: row.source_sha256,
    plan_sha256: row.plan_sha256,
    inventory_sha256: row.inventory_sha256,
    state: row.state,
    blocker_count: row.blocker_count,
    unpriced_job_count: row.unpriced_job_count,
    estimate_low_credits: microsToCredits(row.estimate_low_micros),
    estimate_high_credits: microsToCredits(row.estimate_high_micros),
    estimate_with_contingency_credits: microsToCredits(row.estimate_with_contingency_micros),
    approved_ceiling_credits: row.approved_ceiling_micros === null ? null : microsToCredits(row.approved_ceiling_micros),
    spend_approval_sha256: row.spend_approval_sha256,
    created_by: row.created_by,
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    dispatched_by: row.dispatched_by,
    dispatched_at: row.dispatched_at,
    last_error_code: row.last_error_code,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeJob(row: JobRow) {
  return {
    id: row.id,
    job_id: row.job_id,
    kind: row.kind,
    provider: row.provider,
    operation: row.operation,
    idempotency_key: row.idempotency_key,
    dependencies: parseJson<string[]>(row.dependencies_json, []),
    duration_seconds: row.duration_seconds,
    count: row.item_count,
    page_index: row.page_index,
    state: row.state,
    estimate_low_credits: microsToCredits(row.estimate_low_micros),
    estimate_high_credits: microsToCredits(row.estimate_high_micros),
    reserved_credits: microsToCredits(row.reserved_micros),
    current_attempt_id: row.current_attempt_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validationResponse(c: any, error: unknown) {
  if (error instanceof ContentFactoryValidationError || error instanceof ContentFactoryQcError) {
    return c.json({
      success: false,
      error: { code: error.code, message: error.message, field: error.field ?? null },
    }, 400);
  }
  console.error('content_factory_validation_failed', error instanceof Error ? error.message : String(error));
  return c.json({ success: false, error: { code: 'INVALID_FACTORY_REQUEST', message: 'Invalid content factory request' } }, 400);
}

async function loadRun(db: D1Database, runId: string) {
  return queryFirst<RunRow>(db, 'SELECT * FROM content_factory_runs WHERE id = ?', [runId]);
}

async function loadQcTarget(db: D1Database, runId: string, jobId: string, attemptId: string) {
  return queryFirst<QcTargetRow>(db, `
    SELECT r.id AS run_id, r.state AS run_state, r.plan_sha256, r.manifest_json,
           j.id AS factory_job_id, j.job_id, j.state AS job_state,
           j.current_attempt_id,
           a.id AS attempt_id, a.state AS attempt_state, a.asset_sha256,
           a.private_asset_key, a.automated_qc_sha256
      FROM content_factory_runs r
      JOIN content_factory_jobs j ON j.run_id = r.id
      JOIN content_factory_attempts a ON a.factory_job_id = j.id
     WHERE r.id = ? AND j.job_id = ? AND a.id = ?
       AND a.is_current = 1 AND j.current_attempt_id = a.id
  `, [runId, jobId, attemptId]);
}

function reviewProjection(row: HumanReviewRow): FactoryHumanReviewProjection {
  return {
    gate_id: row.gate_id,
    decision: row.decision,
    reviewer_id: row.reviewer_id,
    plan_sha256: row.plan_sha256,
    asset_sha256: row.asset_sha256,
    automated_qc_evidence_sha256: row.automated_qc_sha256,
    reviewed_at: row.reviewed_at,
    notes: row.notes,
    review_sha256: row.review_sha256,
  };
}

async function costExposure(db: D1Database, runId: string) {
  const row = await queryFirst<{
    gross: number; refunds: number; reservations: number; releases: number;
  }>(db, `
    SELECT
      COALESCE(SUM(CASE WHEN entry_type = 'provider_gross' THEN amount_micros ELSE 0 END), 0) AS gross,
      COALESCE(SUM(CASE WHEN entry_type = 'refund_confirmed' THEN amount_micros ELSE 0 END), 0) AS refunds,
      COALESCE(SUM(CASE WHEN entry_type = 'reservation' THEN amount_micros ELSE 0 END), 0) AS reservations,
      COALESCE(SUM(CASE WHEN entry_type = 'reservation_release' THEN amount_micros ELSE 0 END), 0) AS releases
    FROM content_factory_cost_ledger WHERE run_id = ?
  `, [runId]);
  const gross = Number(row?.gross ?? 0);
  const refunds = Number(row?.refunds ?? 0);
  const reservations = Number(row?.reservations ?? 0);
  const releases = Number(row?.releases ?? 0);
  return {
    provider_declared_gross_micros: gross,
    refunds_confirmed_micros: refunds,
    active_reservations_micros: Math.max(0, reservations - releases),
    exposure_micros: Math.max(0, gross - refunds) + Math.max(0, reservations - releases),
  };
}

function queueMessage(action: ContentFactoryMessage['action'], run: RunRow, job: JobRow, options?: {
  allowNewPaidAttempt?: boolean; acceptDuplicateChargeRisk?: boolean;
}): ContentFactoryMessage {
  return {
    schema_version: CONTENT_FACTORY_MESSAGE_SCHEMA,
    action,
    run_id: run.id,
    job_id: job.job_id,
    plan_sha256: run.plan_sha256,
    allow_new_paid_attempt: options?.allowNewPaidAttempt === true,
    accept_duplicate_charge_risk: options?.acceptDuplicateChargeRisk === true,
  };
}

async function sendMessages(queue: Queue, messages: ContentFactoryMessage[]) {
  for (let index = 0; index < messages.length; index += 100) {
    await queue.sendBatch(messages.slice(index, index + 100).map((message) => ({ body: message })));
  }
}

route.get('/production/factory', async (c) => {
  const rawState = c.req.query('state');
  const state = rawState && RUN_STATES.has(rawState) ? rawState : null;
  if (rawState && !state) return c.json({ success: false, error: 'Invalid factory run state' }, 400);
  const limit = Math.min(Math.max(Number.parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const offset = Math.max(Number.parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  const where = state ? 'WHERE state = ?' : '';
  const params: unknown[] = state ? [state] : [];
  const [rows, total, states] = await Promise.all([
    queryAll<RunRow>(c.env.DB, `
      SELECT * FROM content_factory_runs ${where}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [...params, limit, offset]),
    queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM content_factory_runs ${where}`, params),
    queryAll<{ state: string; total: number }>(c.env.DB, `
      SELECT state, COUNT(*) AS total FROM content_factory_runs GROUP BY state ORDER BY state
    `),
  ]);
  return c.json({
    success: true,
    data: rows.map(serializeRun),
    meta: {
      total: Number(total?.total ?? 0), limit, offset,
      by_state: Object.fromEntries(states.map((item) => [item.state, Number(item.total)])),
    },
  });
});

route.get('/production/factory/:runId', async (c) => {
  const run = await loadRun(c.env.DB, c.req.param('runId') ?? '');
  if (!run) return c.json({ success: false, error: 'Factory run not found' }, 404);
  const [jobs, attempts, costs, qc, reviews, exposure] = await Promise.all([
    queryAll<JobRow>(c.env.DB, 'SELECT * FROM content_factory_jobs WHERE run_id = ? ORDER BY created_at, job_id', [run.id]),
    queryAll<Record<string, unknown>>(c.env.DB, `
      SELECT id, factory_job_id, sequence, state, provider_job_id, provider_model,
             provider_declared_gross_micros, refund_status, refund_confirmed_micros,
             asset_sha256, automated_qc_sha256, human_review_sha256, submission_outcome,
             error_code, is_current, submitted_at, completed_at, created_at, updated_at,
             CASE WHEN private_asset_key IS NULL THEN 0 ELSE 1 END AS private_asset_stored
        FROM content_factory_attempts WHERE run_id = ? ORDER BY created_at, sequence
    `, [run.id]),
    queryAll<Record<string, unknown>>(c.env.DB, `
      SELECT id, factory_job_id, attempt_id, entry_type, amount_micros, source_ref, notes, created_by, created_at
        FROM content_factory_cost_ledger WHERE run_id = ? ORDER BY created_at, id
    `, [run.id]),
    queryAll<Record<string, unknown>>(c.env.DB, `
      SELECT id, factory_job_id, attempt_id, gate_id, status, plan_sha256, asset_sha256,
             evidence_sha256, created_at
        FROM content_factory_qc_evidence WHERE run_id = ? ORDER BY created_at, gate_id
    `, [run.id]),
    queryAll<Record<string, unknown>>(c.env.DB, `
      SELECT id, factory_job_id, attempt_id, gate_id, decision, reviewer_id, plan_sha256,
             asset_sha256, automated_qc_sha256, review_sha256, notes, reviewed_at
        FROM content_factory_human_reviews WHERE run_id = ? ORDER BY reviewed_at, gate_id
    `, [run.id]),
    costExposure(c.env.DB, run.id),
  ]);
  const manifest = parseJson<FactoryManifest | null>(run.manifest_json, null);
  return c.json({
    success: true,
    data: {
      run: serializeRun(run),
      manifest,
      jobs: jobs.map(serializeJob),
      attempts: attempts.map((attempt) => ({
        ...attempt,
        provider_declared_gross_credits: attempt.provider_declared_gross_micros === null
          ? null : microsToCredits(Number(attempt.provider_declared_gross_micros)),
        refund_confirmed_credits: microsToCredits(Number(attempt.refund_confirmed_micros ?? 0)),
        provider_declared_gross_micros: undefined,
        refund_confirmed_micros: undefined,
      })),
      cost_ledger: costs.map((entry) => ({
        ...entry,
        amount_credits: microsToCredits(Number(entry.amount_micros)),
        amount_micros: undefined,
      })),
      exposure: {
        provider_declared_gross_credits: microsToCredits(exposure.provider_declared_gross_micros),
        refunds_confirmed_credits: microsToCredits(exposure.refunds_confirmed_micros),
        active_reservations_credits: microsToCredits(exposure.active_reservations_micros),
        total_exposure_credits: microsToCredits(exposure.exposure_micros),
        refund_unknown: attempts.some((attempt) => (
          Number(attempt.provider_declared_gross_micros ?? 0) > 0 && attempt.refund_status === 'unknown'
        )),
      },
      qc_evidence: qc,
      human_reviews: reviews,
    },
  });
});

route.post('/production/factory/plans', requirePermission('create'), async (c) => {
  const value = await body(c);
  if (!value || !('manifest' in value)) return c.json({ success: false, error: 'A bounded manifest object is required' }, 400);
  try {
    const parsed = await parseFactoryManifest(value.manifest);
    if (parsed.manifest.spend_approval !== null) {
      throw new ContentFactoryValidationError(
        'Spend approval must be recorded by the dedicated server endpoint',
        'EMBEDDED_APPROVAL_FORBIDDEN',
        'spend_approval',
      );
    }
    const runId = `cfr-${parsed.plan_sha256.slice(0, 24)}`;
    const existing = await loadRun(c.env.DB, runId);
    if (existing) return c.json({ success: true, data: serializeRun(existing), meta: { duplicate: true } });

    let state = 'awaiting_spend_approval';
    try { assertManifestReadyForApproval(parsed); } catch { state = 'blocked'; }
    const actor = actorId(c);
    const inventorySha = typeof parsed.manifest.metadata?.inventory_sha256 === 'string'
      && /^[a-f0-9]{64}$/.test(parsed.manifest.metadata.inventory_sha256)
      ? parsed.manifest.metadata.inventory_sha256
      : null;
    const statements: D1PreparedStatement[] = [c.env.DB.prepare(`
      INSERT INTO content_factory_runs (
        id, manifest_id, schema_version, revision, entity_type, entity_id, planet_slug,
        series_slug, pipeline_profile, source_sha256, plan_sha256, inventory_sha256,
        manifest_json, state, blocker_count, unpriced_job_count, estimate_low_micros,
        estimate_high_micros, estimate_with_contingency_micros, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      runId, parsed.manifest.manifest_id, parsed.manifest.schema_version, parsed.manifest.revision,
      parsed.manifest.entity.entity_type, parsed.manifest.entity.entity_id,
      parsed.manifest.entity.planet_slug, parsed.manifest.entity.series_slug,
      parsed.manifest.pipeline.profile, parsed.manifest.source.sha256, parsed.plan_sha256,
      inventorySha, parsed.canonical_json, state, parsed.blocker_count, parsed.unpriced_job_count,
      parsed.estimate_low_micros, parsed.estimate_high_micros,
      parsed.estimate_with_contingency_micros, actor,
    )];
    for (const job of parsed.manifest.jobs) {
      const factoryJobId = `cfj-${(await sha256Hex(`${runId}:${job.job_id}`)).slice(0, 24)}`;
      statements.push(c.env.DB.prepare(`
        INSERT INTO content_factory_jobs (
          id, run_id, job_id, kind, provider, operation, idempotency_key,
          dependencies_json, input_json, duration_seconds, item_count, page_index,
          state, estimate_low_micros, estimate_high_micros
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?)
      `).bind(
        factoryJobId, runId, job.job_id, job.kind, job.provider, job.operation,
        job.idempotency_key, canonicalJson(job.dependencies), canonicalJson(job.input),
        job.duration_seconds ?? null, job.count ?? null, job.page_index ?? null,
        creditsToMicros(job.cost.low_credits), creditsToMicros(job.cost.high_credits),
      ));
    }
    statements.push(auditStatement(c.env.DB, actor, 'create', 'content_factory_run', runId, {
      manifest_id: parsed.manifest.manifest_id,
      plan_sha256: parsed.plan_sha256,
      state,
      job_count: parsed.manifest.jobs.length,
      blocker_count: parsed.blocker_count,
      unpriced_job_count: parsed.unpriced_job_count,
    }));
    await c.env.DB.batch(statements);
    const created = await loadRun(c.env.DB, runId);
    return c.json({ success: true, data: serializeRun(created!), meta: { duplicate: false } }, 201);
  } catch (error) {
    return validationResponse(c, error);
  }
});

route.post('/production/factory/:runId/approve-spend', requirePermission('approve'), async (c) => {
  const run = await loadRun(c.env.DB, c.req.param('runId') ?? '');
  if (!run) return c.json({ success: false, error: 'Factory run not found' }, 404);
  const value = await body(c);
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400);
  if (value.confirmed_plan_sha256 !== run.plan_sha256) {
    return c.json({ success: false, error: { code: 'PLAN_CONFIRMATION_MISMATCH', message: 'Confirm the exact current plan hash' } }, 409);
  }
  if (run.state === 'approved' && run.spend_approval_sha256) {
    return c.json({ success: true, data: serializeRun(run), meta: { duplicate: true } });
  }
  if (run.state !== 'awaiting_spend_approval') {
    return c.json({ success: false, error: { code: 'RUN_NOT_APPROVABLE', message: 'Run is not awaiting spend approval' } }, 409);
  }
  try {
    const parsed = await parseFactoryManifest(parseJson(run.manifest_json, null));
    assertManifestReadyForApproval(parsed);
    const ceilingMicros = creditsToMicros(value.ceiling_credits, 'ceiling_credits');
    if (ceilingMicros < run.estimate_with_contingency_micros) {
      throw new ContentFactoryValidationError(
        'Approved ceiling must cover the high estimate plus contingency',
        'CEILING_BELOW_PLAN',
        'ceiling_credits',
      );
    }
    const expiresAt = value.expires_at === null || value.expires_at === undefined ? null
      : typeof value.expires_at === 'string' && Number.isFinite(Date.parse(value.expires_at))
        ? value.expires_at
        : undefined;
    if (expiresAt === undefined || (expiresAt && Date.parse(expiresAt) <= Date.now())) {
      throw new ContentFactoryValidationError('expires_at must be a future ISO date-time or null', 'INVALID_EXPIRY', 'expires_at');
    }
    const approver = actorId(c);
    const selfApproval = await checkSelfApproval(c.env.DB, {
      entityType: 'content_factory_run', entityId: run.id, approverId: approver,
    });
    if (!selfApproval.ok) return c.json({ success: false, error: SELF_APPROVAL_ERROR }, 409);
    const approvedAt = new Date().toISOString();
    const approvalId = `cfa-${crypto.randomUUID()}`;
    const approvalSha = await createSpendApprovalFingerprint({
      approval_id: approvalId,
      run_id: run.id,
      plan_sha256: run.plan_sha256,
      ceiling_micros: ceilingMicros,
      approved_by: approver,
      approved_at: approvedAt,
      expires_at: expiresAt,
    });
    const results = await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO content_factory_spend_approvals (
          id, run_id, plan_sha256, ceiling_micros, approved_by, approved_at,
          expires_at, approval_sha256, status, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
      `).bind(
        approvalId, run.id, run.plan_sha256, ceilingMicros, approver, approvedAt,
        expiresAt, approvalSha,
        typeof value.reason === 'string' ? value.reason.trim().slice(0, 500) || null : null,
      ),
      c.env.DB.prepare(`
        UPDATE content_factory_runs
           SET state = 'approved', approved_ceiling_micros = ?, spend_approval_sha256 = ?,
               approved_by = ?, approved_at = ?, version = version + 1, updated_at = datetime('now')
         WHERE id = ? AND state = 'awaiting_spend_approval' AND plan_sha256 = ?
      `).bind(ceilingMicros, approvalSha, approver, approvedAt, run.id, run.plan_sha256),
      auditStatement(c.env.DB, approver, 'approve_spend', 'content_factory_run', run.id, {
        plan_sha256: run.plan_sha256,
        ceiling_credits: microsToCredits(ceilingMicros),
        approval_sha256: approvalSha,
        expires_at: expiresAt,
      }),
    ]);
    if (changes(results[1]) !== 1) return c.json({ success: false, error: 'Run changed before approval; reload it' }, 409);
    return c.json({ success: true, data: serializeRun((await loadRun(c.env.DB, run.id))!) });
  } catch (error) {
    return validationResponse(c, error);
  }
});

route.post('/production/factory/:runId/dispatch', requirePermission('publish'), async (c) => {
  if (!c.env.CONTENT_FACTORY_JOBS) {
    return c.json({ success: false, error: { code: 'FACTORY_QUEUE_UNAVAILABLE', message: 'Content factory queue is not configured' } }, 503);
  }
  const value = await body(c);
  if (!value || value.allow_paid !== true) {
    return c.json({ success: false, error: { code: 'PAID_FLAG_REQUIRED', message: 'Explicit allow_paid=true is required' } }, 400);
  }
  const idempotencyKey = c.req.header('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 160) {
    return c.json({ success: false, error: 'A 16-160 character Idempotency-Key header is required' }, 400);
  }
  const run = await loadRun(c.env.DB, c.req.param('runId') ?? '');
  if (!run) return c.json({ success: false, error: 'Factory run not found' }, 404);
  if (value.confirmed_plan_sha256 !== run.plan_sha256) {
    return c.json({ success: false, error: { code: 'PLAN_CONFIRMATION_MISMATCH', message: 'Confirm the approved plan hash' } }, 409);
  }
  try {
    const parsed = await parseFactoryManifest(parseJson(run.manifest_json, null));
    assertManifestReadyForApproval(parsed);
    if (parsed.plan_sha256 !== run.plan_sha256) {
      throw new ContentFactoryValidationError(
        'Persisted run fingerprint does not match its immutable manifest',
        'PERSISTED_PLAN_HASH_MISMATCH',
        'plan_sha256',
      );
    }
  } catch (error) {
    return validationResponse(c, error);
  }
  const duplicateDispatch = run.dispatch_idempotency_key === idempotencyKey
    && run.last_error_code !== 'DISPATCH_RESERVATION_RACE'
    && [
      'queued', 'running', 'paused', 'awaiting_qc',
      'awaiting_human_review', 'partially_failed', 'failed',
    ].includes(run.state);
  if (!duplicateDispatch && run.state !== 'approved') {
    return c.json({ success: false, error: { code: 'SPEND_NOT_APPROVED', message: 'A matching server-side spend approval is required' } }, 409);
  }
  if (!run.spend_approval_sha256 || run.approved_ceiling_micros === null) {
    return c.json({ success: false, error: { code: 'SPEND_NOT_APPROVED', message: 'A matching server-side spend approval is required' } }, 409);
  }
  if (run.blocker_count > 0 || run.unpriced_job_count > 0) {
    return c.json({ success: false, error: { code: 'RUN_BLOCKED', message: 'Blocked or unpriced runs cannot dispatch' } }, 409);
  }
  const approval = await queryFirst<{ expires_at: string | null; status: string }>(c.env.DB, `
    SELECT expires_at, status FROM content_factory_spend_approvals
     WHERE run_id = ? AND approval_sha256 = ?
  `, [run.id, run.spend_approval_sha256]);
  if (!approval || approval.status !== 'approved' || (approval.expires_at && Date.parse(approval.expires_at) <= Date.now())) {
    return c.json({ success: false, error: { code: 'APPROVAL_EXPIRED', message: 'Spend approval is absent, revoked, or expired' } }, 409);
  }

  if (duplicateDispatch) {
    const queuedJobs = await queryAll<JobRow>(c.env.DB, `
      SELECT * FROM content_factory_jobs
       WHERE run_id = ? AND state = 'queued' AND current_attempt_id IS NULL AND reserved_micros > 0
       ORDER BY created_at, job_id
    `, [run.id]);
    if (queuedJobs.length === 0) {
      return c.json({ success: true, data: serializeRun(run), meta: { duplicate: true, recovered_queue_delivery: false } });
    }
    try {
      await sendMessages(c.env.CONTENT_FACTORY_JOBS, queuedJobs.map((job) => queueMessage('dispatch', run, job)));
    } catch (error) {
      await c.env.DB.prepare(`
        UPDATE content_factory_runs SET state = 'paused', last_error_code = 'QUEUE_SEND_FAILED',
               updated_at = datetime('now') WHERE id = ?
      `).bind(run.id).run();
      console.error('content_factory_queue_redispatch_failed', run.id, error instanceof Error ? error.message : String(error));
      return c.json({
        success: false,
        error: { code: 'QUEUE_SEND_FAILED', message: 'Queue delivery failed; retry dispatch with the same Idempotency-Key' },
      }, 503);
    }
    await c.env.DB.batch([
      c.env.DB.prepare(`
        UPDATE content_factory_runs
           SET state = CASE
                 WHEN state = 'paused' AND last_error_code = 'QUEUE_SEND_FAILED' THEN 'queued'
                 ELSE state END,
               last_error_code = CASE WHEN last_error_code = 'QUEUE_SEND_FAILED' THEN NULL ELSE last_error_code END,
               version = version + 1, updated_at = datetime('now')
         WHERE id = ?
      `).bind(run.id),
      auditStatement(c.env.DB, actorId(c), 'redispatch_queued', 'content_factory_run', run.id, {
        plan_sha256: run.plan_sha256,
        job_count: queuedJobs.length,
        idempotency_key: idempotencyKey,
        mode: 'reserved_jobs_without_attempts',
      }),
    ]);
    return c.json({
      success: true,
      data: serializeRun((await loadRun(c.env.DB, run.id))!),
      meta: { duplicate: true, recovered_queue_delivery: true, queued_jobs: queuedJobs.length },
    }, 202);
  }

  const jobs = await queryAll<JobRow>(c.env.DB, `
    SELECT * FROM content_factory_jobs WHERE run_id = ? AND state = 'planned' ORDER BY created_at, job_id
  `, [run.id]);
  if (jobs.length === 0) return c.json({ success: false, error: 'No planned jobs remain' }, 409);
  const exposure = await costExposure(c.env.DB, run.id);
  const requested = jobs.reduce((sum, job) => sum + job.estimate_high_micros, 0);
  if (exposure.exposure_micros + requested > run.approved_ceiling_micros) {
    return c.json({ success: false, error: { code: 'BUDGET_CEILING_EXCEEDED', message: 'Dispatch would exceed the approved ceiling' } }, 409);
  }

  const actor = actorId(c);
  const statements: D1PreparedStatement[] = [c.env.DB.prepare(`
    UPDATE content_factory_runs
       SET state = 'queued', dispatch_idempotency_key = ?, dispatched_by = ?,
           dispatched_at = datetime('now'), version = version + 1, updated_at = datetime('now')
     WHERE id = ? AND state = 'approved' AND plan_sha256 = ?
  `).bind(idempotencyKey, actor, run.id, run.plan_sha256)];
  for (const job of jobs) {
    statements.push(c.env.DB.prepare(`
      UPDATE content_factory_jobs SET state = 'queued', reserved_micros = ?, updated_at = datetime('now')
       WHERE id = ? AND state = 'planned'
    `).bind(job.estimate_high_micros, job.id));
    statements.push(c.env.DB.prepare(`
      INSERT OR IGNORE INTO content_factory_cost_ledger (
        id, run_id, factory_job_id, attempt_id, entry_type, amount_micros,
        source_ref, notes, created_by
      )
      SELECT ?, ?, ?, NULL, 'reservation', ?, ?, 'initial dispatch reservation', ?
       WHERE EXISTS (
         SELECT 1 FROM content_factory_runs
          WHERE id = ? AND state = 'queued' AND dispatch_idempotency_key = ? AND plan_sha256 = ?
       )
         AND EXISTS (
         SELECT 1 FROM content_factory_jobs
          WHERE id = ? AND state = 'queued' AND current_attempt_id IS NULL AND reserved_micros = ?
       )
    `).bind(
      `cfcl-${crypto.randomUUID()}`, run.id, job.id, job.estimate_high_micros,
      `initial:${run.id}:${job.job_id}`, actor,
      run.id, idempotencyKey, run.plan_sha256, job.id, job.estimate_high_micros,
    ));
  }
  const results = await c.env.DB.batch(statements);
  if (changes(results[0]) !== 1) return c.json({ success: false, error: 'Run changed before dispatch; reload it' }, 409);
  if (!dispatchJobReservationsComplete(results, jobs.length)) {
    await c.env.DB.prepare(`
      UPDATE content_factory_runs SET state = 'paused', last_error_code = 'DISPATCH_RESERVATION_RACE',
             updated_at = datetime('now') WHERE id = ?
    `).bind(run.id).run();
    return c.json({
      success: false,
      error: { code: 'DISPATCH_RESERVATION_RACE', message: 'Dispatch reservation changed concurrently; no provider work was queued' },
    }, 409);
  }
  await auditStatement(c.env.DB, actor, 'dispatch_paid', 'content_factory_run', run.id, {
    plan_sha256: run.plan_sha256,
    job_count: jobs.length,
    reserved_credits: microsToCredits(requested),
    idempotency_key: idempotencyKey,
  }).run();

  try {
    await sendMessages(c.env.CONTENT_FACTORY_JOBS, jobs.map((job) => queueMessage('dispatch', run, job)));
  } catch (error) {
    await c.env.DB.prepare(`
      UPDATE content_factory_runs SET state = 'paused', last_error_code = 'QUEUE_SEND_FAILED',
             updated_at = datetime('now') WHERE id = ? AND state = 'queued'
    `).bind(run.id).run();
    console.error('content_factory_queue_send_failed', run.id, error instanceof Error ? error.message : String(error));
    return c.json({
      success: false,
      error: { code: 'QUEUE_SEND_FAILED', message: 'Run was reserved but queue delivery failed; retry dispatch with the same Idempotency-Key' },
    }, 503);
  }
  return c.json({
    success: true,
    data: serializeRun((await loadRun(c.env.DB, run.id))!),
    meta: { duplicate: false, queued_jobs: jobs.length, reserved_credits: microsToCredits(requested) },
  }, 202);
});

route.post('/production/factory/:runId/jobs/:jobId/automated-qc', requirePermission('review'), async (c) => {
  const value = await body(c);
  if (!value) return c.json({ success: false, error: 'A bounded JSON QC report is required' }, 400);
  const attemptId = typeof value.attempt_id === 'string' ? value.attempt_id : '';
  if (!attemptId) return c.json({ success: false, error: 'attempt_id is required' }, 400);
  const runId = c.req.param('runId') ?? '';
  const jobId = c.req.param('jobId') ?? '';
  const target = await loadQcTarget(c.env.DB, runId, jobId, attemptId);
  if (!target) return c.json({ success: false, error: 'Current factory attempt not found' }, 404);
  if (value.confirmed_plan_sha256 !== target.plan_sha256) {
    return c.json({ success: false, error: { code: 'PLAN_CONFIRMATION_MISMATCH', message: 'Confirm the exact current plan hash' } }, 409);
  }
  if (!target.asset_sha256 || !target.private_asset_key || value.confirmed_asset_sha256 !== target.asset_sha256) {
    return c.json({ success: false, error: { code: 'ASSET_CONFIRMATION_MISMATCH', message: 'QC must bind to the current private asset fingerprint' } }, 409);
  }
  if (!['downloaded', 'validation_failed', 'automated_qc_failed', 'awaiting_human_review', 'human_review_rejected'].includes(target.attempt_state)) {
    return c.json({ success: false, error: { code: 'ATTEMPT_NOT_QC_READY', message: 'The current attempt has no downloaded asset eligible for QC' } }, 409);
  }

  try {
    const manifest = parseJson<FactoryManifest | null>(target.manifest_json, null);
    if (!manifest) throw new ContentFactoryQcError('Stored factory manifest is invalid', 'INVALID_QC_POLICY');
    const report = await prepareAutomatedQc({
      manifest,
      value,
      plan_sha256: target.plan_sha256,
      asset_sha256: target.asset_sha256,
    });
    const requiredHumanGates = factoryHumanGateIds(manifest);
    const nextState = report.required_passed
      ? (requiredHumanGates.length > 0 ? 'awaiting_human_review' : 'approved')
      : 'automated_qc_failed';
    const evidenceKey = `content-factory/${target.run_id}/${target.job_id}/${target.attempt_id}/qc/${report.evidence_sha256}.json`;
    const artifact = canonicalJson({
      schema_version: 'content-factory.automated-qc/v1',
      run_id: target.run_id,
      job_id: target.job_id,
      attempt_id: target.attempt_id,
      plan_sha256: target.plan_sha256,
      asset_sha256: target.asset_sha256,
      ...report,
    });
    // تقرير QC خاص مثل الأصل نفسه؛ لا signed URL ولا دليل خام في D1.
    await c.env.MEDIA_BUCKET.put(evidenceKey, artifact, {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: {
        run_id: target.run_id,
        job_id: target.job_id,
        attempt_id: target.attempt_id,
        plan_sha256: target.plan_sha256,
        asset_sha256: target.asset_sha256,
        evidence_sha256: report.evidence_sha256,
      },
    });

    const statements: D1PreparedStatement[] = report.results.map((result) => c.env.DB.prepare(`
      INSERT OR IGNORE INTO content_factory_qc_evidence (
        id, run_id, factory_job_id, attempt_id, gate_id, status,
        plan_sha256, asset_sha256, evidence_sha256, evidence_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `cfqc-${crypto.randomUUID()}`, target.run_id, target.factory_job_id, target.attempt_id,
      result.gate_id, result.status, target.plan_sha256, target.asset_sha256,
      result.evidence_sha256, evidenceKey,
    ));
    const attemptUpdateIndex = statements.length;
    statements.push(c.env.DB.prepare(`
      UPDATE content_factory_attempts
         SET state = ?, automated_qc_sha256 = ?, human_review_sha256 = NULL,
             error_code = ?, error_detail = ?, updated_at = datetime('now')
       WHERE id = ? AND is_current = 1 AND asset_sha256 = ?
    `).bind(
      nextState, report.evidence_sha256,
      report.required_passed ? null : 'AUTOMATED_QC_FAILED',
      report.required_passed ? null : 'One or more required automated QC gates failed',
      target.attempt_id, target.asset_sha256,
    ));
    statements.push(c.env.DB.prepare(`
      UPDATE content_factory_jobs SET state = ?, updated_at = datetime('now')
       WHERE id = ? AND current_attempt_id = ?
    `).bind(nextState, target.factory_job_id, target.attempt_id));
    statements.push(auditStatement(c.env.DB, actorId(c), 'record_automated_qc', 'content_factory_run', target.run_id, {
      job_id: target.job_id,
      attempt_id: target.attempt_id,
      plan_sha256: target.plan_sha256,
      asset_sha256: target.asset_sha256,
      automated_qc_sha256: report.evidence_sha256,
      required_passed: report.required_passed,
      next_state: nextState,
    }));
    const results = await c.env.DB.batch(statements);
    if (changes(results[attemptUpdateIndex]) !== 1) {
      return c.json({ success: false, error: 'Attempt changed before QC evidence was recorded; reload it' }, 409);
    }
    await refreshContentFactoryRunState(c.env, target.run_id);
    return c.json({
      success: true,
      data: {
        run_id: target.run_id,
        job_id: target.job_id,
        attempt_id: target.attempt_id,
        state: nextState,
        required_passed: report.required_passed,
        automated_qc_sha256: report.evidence_sha256,
      },
    });
  } catch (error) {
    if (error instanceof ContentFactoryQcError) return validationResponse(c, error);
    console.error('content_factory_qc_record_failed', runId, jobId, error instanceof Error ? error.message : String(error));
    return c.json({ success: false, error: { code: 'QC_RECORD_FAILED', message: 'Unable to persist automated QC evidence' } }, 500);
  }
});

route.post('/production/factory/:runId/jobs/:jobId/human-reviews', requirePermission('review'), async (c) => {
  const value = await body(c);
  if (!value) return c.json({ success: false, error: 'A bounded JSON review is required' }, 400);
  const attemptId = typeof value.attempt_id === 'string' ? value.attempt_id : '';
  if (!attemptId) return c.json({ success: false, error: 'attempt_id is required' }, 400);
  const runId = c.req.param('runId') ?? '';
  const jobId = c.req.param('jobId') ?? '';
  const target = await loadQcTarget(c.env.DB, runId, jobId, attemptId);
  if (!target) return c.json({ success: false, error: 'Current factory attempt not found' }, 404);
  if (value.confirmed_plan_sha256 !== target.plan_sha256
    || value.confirmed_asset_sha256 !== target.asset_sha256
    || value.confirmed_automated_qc_sha256 !== target.automated_qc_sha256) {
    return c.json({ success: false, error: { code: 'REVIEW_CONTEXT_MISMATCH', message: 'Review must confirm the current plan, asset, and automated-QC fingerprints' } }, 409);
  }
  if (!target.asset_sha256 || !target.automated_qc_sha256
    || !['awaiting_human_review', 'human_review_rejected'].includes(target.attempt_state)) {
    return c.json({ success: false, error: { code: 'ATTEMPT_NOT_REVIEWABLE', message: 'Passing automated QC evidence is required before human review' } }, 409);
  }

  try {
    const manifest = parseJson<FactoryManifest | null>(target.manifest_json, null);
    if (!manifest) throw new ContentFactoryQcError('Stored factory manifest is invalid', 'INVALID_QC_POLICY');
    const reviewer = actorId(c);
    const reviewedAt = new Date().toISOString();
    const review = await createFactoryHumanReview({
      manifest,
      gate_id: value.gate_id,
      decision: value.decision,
      reviewer_id: reviewer,
      plan_sha256: target.plan_sha256,
      asset_sha256: target.asset_sha256,
      automated_qc_evidence_sha256: target.automated_qc_sha256,
      reviewed_at: reviewedAt,
      notes: value.notes,
    });
    if (review.decision === 'approved') {
      const separation = await checkSelfApproval(c.env.DB, {
        entityType: 'content_factory_run', entityId: target.run_id, approverId: reviewer,
      });
      if (!separation.ok) return c.json({ success: false, error: SELF_APPROVAL_ERROR }, 409);
    }
    await c.env.DB.prepare(`
      INSERT INTO content_factory_human_reviews (
        id, run_id, factory_job_id, attempt_id, gate_id, decision, reviewer_id,
        plan_sha256, asset_sha256, automated_qc_sha256, review_sha256, notes, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `cfhr-${crypto.randomUUID()}`, target.run_id, target.factory_job_id, target.attempt_id,
      review.gate_id, review.decision, review.reviewer_id, review.plan_sha256,
      review.asset_sha256, review.automated_qc_evidence_sha256, review.review_sha256,
      review.notes, review.reviewed_at,
    ).run();

    const rows = await queryAll<HumanReviewRow>(c.env.DB, `
      SELECT gate_id, decision, reviewer_id, plan_sha256, asset_sha256,
             automated_qc_sha256, review_sha256, notes, reviewed_at
        FROM content_factory_human_reviews
       WHERE attempt_id = ? AND plan_sha256 = ? AND asset_sha256 = ?
         AND automated_qc_sha256 = ?
       ORDER BY reviewed_at DESC, created_at DESC
    `, [target.attempt_id, target.plan_sha256, target.asset_sha256, target.automated_qc_sha256]);
    const latest = new Map<string, HumanReviewRow>();
    for (const row of rows) if (!latest.has(row.gate_id)) latest.set(row.gate_id, row);
    const requiredGateIds = factoryHumanGateIds(manifest);
    const selected = requiredGateIds.map((gateId) => latest.get(gateId)).filter((row): row is HumanReviewRow => Boolean(row));
    const hasRejection = requiredGateIds.some((gateId) => latest.get(gateId)?.decision === 'rejected');
    const allApproved = selected.length === requiredGateIds.length
      && selected.every((row) => row.decision === 'approved');
    const nextState = hasRejection ? 'human_review_rejected' : allApproved ? 'approved' : 'awaiting_human_review';
    const humanReviewSha = allApproved
      ? await factoryHumanReviewsSha(selected.map(reviewProjection))
      : null;
    await c.env.DB.batch([
      c.env.DB.prepare(`
        UPDATE content_factory_attempts
           SET state = ?, human_review_sha256 = ?, error_code = ?, error_detail = ?,
               updated_at = datetime('now')
         WHERE id = ? AND is_current = 1 AND automated_qc_sha256 = ?
      `).bind(
        nextState, humanReviewSha,
        hasRejection ? 'HUMAN_REVIEW_REJECTED' : null,
        hasRejection ? 'At least one required human gate was rejected' : null,
        target.attempt_id, target.automated_qc_sha256,
      ),
      c.env.DB.prepare(`
        UPDATE content_factory_jobs SET state = ?, updated_at = datetime('now')
         WHERE id = ? AND current_attempt_id = ?
      `).bind(nextState, target.factory_job_id, target.attempt_id),
      auditStatement(c.env.DB, reviewer, 'record_human_review', 'content_factory_run', target.run_id, {
        job_id: target.job_id,
        attempt_id: target.attempt_id,
        gate_id: review.gate_id,
        decision: review.decision,
        review_sha256: review.review_sha256,
        resulting_state: nextState,
      }),
    ]);
    await refreshContentFactoryRunState(c.env, target.run_id);
    return c.json({
      success: true,
      data: {
        run_id: target.run_id,
        job_id: target.job_id,
        attempt_id: target.attempt_id,
        gate_id: review.gate_id,
        decision: review.decision,
        state: nextState,
        review_sha256: review.review_sha256,
        human_reviews_sha256: humanReviewSha,
      },
    });
  } catch (error) {
    if (error instanceof ContentFactoryQcError) return validationResponse(c, error);
    console.error('content_factory_human_review_failed', runId, jobId, error instanceof Error ? error.message : String(error));
    return c.json({ success: false, error: { code: 'HUMAN_REVIEW_FAILED', message: 'Unable to persist human review' } }, 500);
  }
});

route.post('/production/factory/:runId/resume', requirePermission('publish'), async (c) => {
  if (!c.env.CONTENT_FACTORY_JOBS) return c.json({ success: false, error: 'Content factory queue is not configured' }, 503);
  const run = await loadRun(c.env.DB, c.req.param('runId') ?? '');
  if (!run) return c.json({ success: false, error: 'Factory run not found' }, 404);
  if (!['queued', 'running', 'paused', 'partially_failed', 'failed'].includes(run.state)) {
    return c.json({ success: false, error: 'Run has no resumable work' }, 409);
  }
  const placeholders = RESUMABLE_JOB_STATES.map(() => '?').join(', ');
  const jobs = await queryAll<JobRow>(c.env.DB, `
    SELECT * FROM content_factory_jobs WHERE run_id = ? AND state IN (${placeholders})
      AND current_attempt_id IS NOT NULL
    ORDER BY updated_at, job_id
  `, [run.id, ...RESUMABLE_JOB_STATES]);
  if (jobs.length === 0) return c.json({ success: false, error: 'No resumable jobs found' }, 409);
  await sendMessages(c.env.CONTENT_FACTORY_JOBS, jobs.map((job) => queueMessage('resume', run, job)));
  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE content_factory_runs SET state = 'queued', last_error_code = NULL,
             version = version + 1, updated_at = datetime('now') WHERE id = ?
    `).bind(run.id),
    auditStatement(c.env.DB, actorId(c), 'resume', 'content_factory_run', run.id, {
      job_count: jobs.length, mode: 'existing_attempts_only',
    }),
  ]);
  return c.json({ success: true, data: { run_id: run.id, queued_jobs: jobs.length, mode: 'existing_attempts_only' } }, 202);
});

route.post('/production/factory/:runId/retry-failed', requirePermission('publish'), async (c) => {
  if (!c.env.CONTENT_FACTORY_JOBS) return c.json({ success: false, error: 'Content factory queue is not configured' }, 503);
  const value = await body(c);
  if (!value || value.failed_only !== true) return c.json({ success: false, error: 'failed_only=true is required' }, 400);
  const run = await loadRun(c.env.DB, c.req.param('runId') ?? '');
  if (!run) return c.json({ success: false, error: 'Factory run not found' }, 404);
  const placeholders = FAILED_JOB_STATES.map(() => '?').join(', ');
  const params: unknown[] = [run.id, ...FAILED_JOB_STATES];
  const jobFilter = typeof value.job_id === 'string' && value.job_id ? ' AND job_id = ?' : '';
  if (jobFilter) params.push(value.job_id);
  const jobs = await queryAll<JobRow>(c.env.DB, `
    SELECT * FROM content_factory_jobs WHERE run_id = ? AND state IN (${placeholders})${jobFilter}
    ORDER BY updated_at, job_id
  `, params);
  if (jobs.length === 0) return c.json({ success: false, error: 'No matching failed jobs found' }, 404);
  const replacements = jobs.filter((job) => REPLACEMENT_JOB_STATES.has(job.state));
  if (replacements.length > 0 && (
    value.allow_new_paid_attempt !== true
    || value.allow_paid !== true
    || value.accept_duplicate_charge_risk !== true
  )) {
    return c.json({
      success: false,
      error: {
        code: 'REPLACEMENT_CONFIRMATION_REQUIRED',
        message: 'Replacement attempts require allow_new_paid_attempt, allow_paid, and accept_duplicate_charge_risk',
      },
    }, 409);
  }
  if (replacements.length > 0) {
    if (run.approved_ceiling_micros === null || !run.spend_approval_sha256) {
      return c.json({ success: false, error: { code: 'SPEND_NOT_APPROVED', message: 'Replacement spend is not approved' } }, 409);
    }
    const approval = await queryFirst<{ expires_at: string | null; status: string }>(c.env.DB, `
      SELECT expires_at, status FROM content_factory_spend_approvals
       WHERE run_id = ? AND approval_sha256 = ?
    `, [run.id, run.spend_approval_sha256]);
    if (!approval || approval.status !== 'approved'
      || (approval.expires_at && Date.parse(approval.expires_at) <= Date.now())) {
      return c.json({
        success: false,
        error: { code: 'APPROVAL_EXPIRED', message: 'Replacement requires an active matching spend approval' },
      }, 409);
    }
    const exposure = await costExposure(c.env.DB, run.id);
    const replacementBudget = replacements.reduce((sum, job) => sum + job.estimate_high_micros, 0);
    if (exposure.exposure_micros + replacementBudget > run.approved_ceiling_micros) {
      return c.json({ success: false, error: { code: 'BUDGET_CEILING_EXCEEDED', message: 'Replacement attempts exceed the approved ceiling' } }, 409);
    }
  }
  await sendMessages(c.env.CONTENT_FACTORY_JOBS, jobs.map((job) => queueMessage('retry_failed', run, job, {
    allowNewPaidAttempt: replacements.some((item) => item.id === job.id),
    acceptDuplicateChargeRisk: value.accept_duplicate_charge_risk === true,
  })));
  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE content_factory_runs SET state = 'queued', version = version + 1,
             updated_at = datetime('now') WHERE id = ?
    `).bind(run.id),
    auditStatement(c.env.DB, actorId(c), 'retry_failed', 'content_factory_run', run.id, {
      failed_only: true,
      job_count: jobs.length,
      replacement_count: replacements.length,
      duplicate_charge_risk_accepted: value.accept_duplicate_charge_risk === true,
    }),
  ]);
  return c.json({
    success: true,
    data: { run_id: run.id, queued_jobs: jobs.length, replacement_jobs: replacements.length, failed_only: true },
  }, 202);
});

export default route;
