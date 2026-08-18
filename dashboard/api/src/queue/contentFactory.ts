import type { Env } from '../lib/db.ts';
import {
  CONTENT_FACTORY_MESSAGE_SCHEMA,
  assertManifestReadyForApproval,
  creditsToMicros,
  parseFactoryManifest,
  parseFactoryMessage,
  sha256Hex,
  type ContentFactoryMessage,
  type FactoryJob,
} from '../lib/contentFactory.ts';
import {
  ContentFactoryProviderError,
  downloadProviderAsset,
  pollProviderJob,
  submitProviderJob,
  type ProviderResult,
} from '../services/contentFactoryProvider.ts';

type FactoryRow = {
  run_id: string;
  run_state: string;
  plan_sha256: string;
  manifest_json: string;
  approved_ceiling_micros: number | null;
  spend_approval_sha256: string | null;
  spend_approval_status: string | null;
  spend_approval_expires_at: string | null;
  blocker_count: number;
  unpriced_job_count: number;
  factory_job_id: string;
  job_id: string;
  kind: FactoryJob['kind'];
  provider: string;
  operation: string;
  idempotency_key: string;
  dependencies_json: string;
  input_json: string;
  duration_seconds: number | null;
  item_count: number | null;
  page_index: number | null;
  job_state: string;
  estimate_low_micros: number;
  estimate_high_micros: number;
  reserved_micros: number;
};

type AttemptRow = {
  id: string;
  run_id: string;
  factory_job_id: string;
  sequence: number;
  state: string;
  idempotency_key: string;
  provider_job_id: string | null;
  provider_declared_gross_micros: number | null;
  refund_status: string;
  refund_confirmed_micros: number;
  submission_outcome: string | null;
  submission_stale: number;
  is_current: number;
};

type ProcessResult = {
  accepted: boolean;
  disposition: 'ack' | 'retry' | 'reschedule';
  delay_seconds?: number;
  reason: string;
  run_id?: string;
  job_id?: string;
};

const PROVIDER_PENDING = new Set(['pending', 'processing']);
const REPLACEMENT_STATES = new Set([
  'submission_failed', 'provider_failed', 'provider_cancelled',
  'automated_qc_failed', 'human_review_rejected',
]);
const RESUMABLE_STATES = new Set([
  'submitted', 'provider_pending', 'provider_processing', 'provider_completed',
  'polling_failed', 'timed_out', 'download_failed',
]);

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function resultChanges(result: D1Result | undefined) {
  return Number(result?.meta?.changes ?? 0);
}

export function dispatchJobReservationsComplete(results: D1Result[], jobCount: number): boolean {
  if (!Number.isInteger(jobCount) || jobCount < 1) return false;
  for (let index = 0; index < jobCount; index += 1) {
    if (resultChanges(results[1 + (index * 2)]) !== 1
      || resultChanges(results[2 + (index * 2)]) !== 1) {
      return false;
    }
  }
  return true;
}

function providerState(status: ProviderResult['status']) {
  return status === 'pending' ? 'provider_pending'
    : status === 'processing' ? 'provider_processing'
      : status === 'completed' ? 'provider_completed'
        : status === 'cancelled' ? 'provider_cancelled'
          : 'provider_failed';
}

function jobFromRow(row: FactoryRow, attemptIdempotencyKey?: string): FactoryJob {
  const low = row.estimate_low_micros / 1_000_000;
  const high = row.estimate_high_micros / 1_000_000;
  return {
    job_id: row.job_id,
    kind: row.kind,
    provider: row.provider,
    operation: row.operation,
    state: 'planned',
    idempotency_key: attemptIdempotencyKey ?? row.idempotency_key,
    dependencies: parseJson<string[]>(row.dependencies_json, []),
    ...(row.duration_seconds !== null ? { duration_seconds: row.duration_seconds } : {}),
    ...(row.item_count !== null ? { count: row.item_count } : {}),
    ...(row.page_index !== null ? { page_index: row.page_index } : {}),
    input: parseJson<Record<string, unknown>>(row.input_json, {}),
    cost: {
      pricing_status: 'priced',
      pricing_key: null,
      low_credits: low,
      high_credits: high,
      basis: 'Persisted immutable factory job estimate',
    },
  };
}

async function loadFactoryRow(env: Env, message: ContentFactoryMessage) {
  return env.DB.prepare(`
    SELECT r.id AS run_id, r.state AS run_state, r.plan_sha256,
           r.manifest_json, r.approved_ceiling_micros, r.spend_approval_sha256,
           a.status AS spend_approval_status, a.expires_at AS spend_approval_expires_at,
           r.blocker_count, r.unpriced_job_count,
           j.id AS factory_job_id, j.job_id, j.kind, j.provider, j.operation,
           j.idempotency_key, j.dependencies_json, j.input_json,
           j.duration_seconds, j.item_count, j.page_index, j.state AS job_state,
           j.estimate_low_micros, j.estimate_high_micros, j.reserved_micros
      FROM content_factory_runs r
      JOIN content_factory_jobs j ON j.run_id = r.id
      LEFT JOIN content_factory_spend_approvals a
        ON a.run_id = r.id AND a.approval_sha256 = r.spend_approval_sha256
     WHERE r.id = ? AND j.job_id = ?
  `).bind(message.run_id, message.job_id).first<FactoryRow>();
}

async function currentAttempt(env: Env, factoryJobId: string) {
  return env.DB.prepare(`
    SELECT id, run_id, factory_job_id, sequence, state, idempotency_key,
           provider_job_id, provider_declared_gross_micros, refund_status,
           refund_confirmed_micros, submission_outcome,
           CASE WHEN updated_at <= datetime('now', '-5 minutes') THEN 1 ELSE 0 END AS submission_stale,
           is_current
      FROM content_factory_attempts
     WHERE factory_job_id = ? AND is_current = 1
  `).bind(factoryJobId).first<AttemptRow>();
}

async function exposureMicros(env: Env, runId: string) {
  const row = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN entry_type = 'provider_gross' THEN amount_micros ELSE 0 END), 0) AS gross,
      COALESCE(SUM(CASE WHEN entry_type = 'refund_confirmed' THEN amount_micros ELSE 0 END), 0) AS refunds,
      COALESCE(SUM(CASE WHEN entry_type = 'reservation' THEN amount_micros ELSE 0 END), 0) AS reservations,
      COALESCE(SUM(CASE WHEN entry_type = 'reservation_release' THEN amount_micros ELSE 0 END), 0) AS releases
      FROM content_factory_cost_ledger WHERE run_id = ?
  `).bind(runId).first<{ gross: number; refunds: number; reservations: number; releases: number }>();
  return Math.max(0, Number(row?.gross ?? 0) - Number(row?.refunds ?? 0))
    + Math.max(0, Number(row?.reservations ?? 0) - Number(row?.releases ?? 0));
}

function assertPaidGate(row: FactoryRow, message: ContentFactoryMessage) {
  if (row.plan_sha256 !== message.plan_sha256) throw new Error('factory_plan_hash_mismatch');
  if (![
    'approved', 'queued', 'running', 'paused', 'awaiting_qc',
    'awaiting_human_review', 'partially_failed', 'failed',
  ].includes(row.run_state)) {
    throw new Error('factory_run_not_approved');
  }
  if (row.blocker_count !== 0 || row.unpriced_job_count !== 0) throw new Error('factory_run_blocked');
  if (row.approved_ceiling_micros === null || !row.spend_approval_sha256) throw new Error('factory_spend_not_approved');
}

function assertActiveSpendApproval(row: FactoryRow) {
  if (row.spend_approval_status !== 'approved') throw new Error('factory_spend_approval_inactive');
  if (row.spend_approval_expires_at) {
    const expiry = Date.parse(row.spend_approval_expires_at);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error('factory_spend_approval_expired');
  }
}

async function assertDependencies(env: Env, row: FactoryRow) {
  const dependencies = parseJson<string[]>(row.dependencies_json, []);
  if (dependencies.length === 0) return;
  if (dependencies.length > 100) throw new Error('factory_dependency_limit_exceeded');
  const placeholders = dependencies.map(() => '?').join(', ');
  const result = await env.DB.prepare(`
    SELECT COUNT(*) AS approved
      FROM content_factory_jobs
     WHERE run_id = ? AND job_id IN (${placeholders}) AND state = 'approved'
  `).bind(row.run_id, ...dependencies).first<{ approved: number }>();
  if (Number(result?.approved ?? 0) !== dependencies.length) throw new Error('factory_dependencies_not_approved');
}

async function createInitialAttempt(env: Env, row: FactoryRow) {
  await assertDependencies(env, row);
  assertActiveSpendApproval(row);
  const attemptId = `cfa-${crypto.randomUUID()}`;
  const results = await env.DB.batch([
    env.DB.prepare(`
      INSERT OR IGNORE INTO content_factory_attempts (
        id, run_id, factory_job_id, sequence, state, idempotency_key,
        submission_outcome, is_current
      ) VALUES (?, ?, ?, 1, 'submitting', ?, NULL, 1)
    `).bind(attemptId, row.run_id, row.factory_job_id, row.idempotency_key),
    env.DB.prepare(`
      UPDATE content_factory_jobs
         SET state = 'submitting', current_attempt_id = ?, updated_at = datetime('now')
       WHERE id = ? AND state = 'queued' AND current_attempt_id IS NULL
    `).bind(attemptId, row.factory_job_id),
    env.DB.prepare(`
      UPDATE content_factory_runs SET state = 'running', updated_at = datetime('now')
       WHERE id = ? AND state IN ('approved','queued','paused','partially_failed','failed')
    `).bind(row.run_id),
  ]);
  const created = resultChanges(results[0]) === 1 && resultChanges(results[1]) === 1;
  return { attempt: await currentAttempt(env, row.factory_job_id), created };
}

async function releaseReservation(env: Env, row: FactoryRow, attempt: AttemptRow, reason: string) {
  if (row.reserved_micros <= 0) return;
  await env.DB.batch([
    env.DB.prepare(`
      INSERT OR IGNORE INTO content_factory_cost_ledger (
        id, run_id, factory_job_id, attempt_id, entry_type, amount_micros,
        source_ref, notes, created_by
      ) VALUES (?, ?, ?, ?, 'reservation_release', ?, ?, ?, 'content-factory-worker')
    `).bind(
      `cfcl-${crypto.randomUUID()}`, row.run_id, row.factory_job_id, attempt.id,
      row.reserved_micros, `release:${attempt.id}`, reason,
    ),
    env.DB.prepare(`
      UPDATE content_factory_jobs SET reserved_micros = 0, updated_at = datetime('now')
       WHERE id = ?
    `).bind(row.factory_job_id),
  ]);
}

async function recordProviderCost(env: Env, row: FactoryRow, attempt: AttemptRow, result: ProviderResult) {
  if (result.provider_declared_gross_credits === null) return;
  const grossMicros = creditsToMicros(result.provider_declared_gross_credits, 'provider creditCost');
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT OR IGNORE INTO content_factory_cost_ledger (
        id, run_id, factory_job_id, attempt_id, entry_type, amount_micros,
        source_ref, notes, created_by
      ) VALUES (?, ?, ?, ?, 'provider_gross', ?, ?, 'provider-declared gross; refund not assumed', 'content-factory-worker')
    `).bind(
      `cfcl-${crypto.randomUUID()}`, row.run_id, row.factory_job_id, attempt.id,
      grossMicros, `gross:${attempt.id}:${result.provider_job_id}`,
    ),
    env.DB.prepare(`
      UPDATE content_factory_attempts
         SET provider_declared_gross_micros = ?, updated_at = datetime('now')
       WHERE id = ?
    `).bind(grossMicros, attempt.id),
  ];
  if (row.reserved_micros > 0) {
    statements.push(env.DB.prepare(`
      INSERT OR IGNORE INTO content_factory_cost_ledger (
        id, run_id, factory_job_id, attempt_id, entry_type, amount_micros,
        source_ref, notes, created_by
      ) VALUES (?, ?, ?, ?, 'reservation_release', ?, ?, 'replaced by provider gross', 'content-factory-worker')
    `).bind(
      `cfcl-${crypto.randomUUID()}`, row.run_id, row.factory_job_id, attempt.id,
      row.reserved_micros, `release:${attempt.id}`,
    ));
    statements.push(env.DB.prepare(`
      UPDATE content_factory_jobs SET reserved_micros = 0, updated_at = datetime('now')
       WHERE id = ?
    `).bind(row.factory_job_id));
  }
  await env.DB.batch(statements);
}

async function markSubmissionFailure(
  env: Env,
  row: FactoryRow,
  attempt: AttemptRow,
  error: unknown,
) {
  const definitive = error instanceof ContentFactoryProviderError
    && error.status !== null && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
  const code = error instanceof ContentFactoryProviderError ? error.code : 'SUBMISSION_OUTCOME_UNKNOWN';
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE content_factory_attempts
         SET state = 'submission_failed', submission_outcome = ?, error_code = ?,
             error_detail = ?, updated_at = datetime('now')
       WHERE id = ? AND state = 'submitting'
    `).bind(
      definitive ? 'provider_rejected' : 'unknown', code,
      definitive ? 'Provider definitively rejected the request' : 'Submission outcome unknown; manual retry decision required',
      attempt.id,
    ),
    env.DB.prepare(`
      UPDATE content_factory_jobs SET state = 'submission_failed', updated_at = datetime('now')
       WHERE id = ?
    `).bind(row.factory_job_id),
    env.DB.prepare(`
      UPDATE content_factory_runs SET state = 'partially_failed', last_error_code = ?,
             updated_at = datetime('now') WHERE id = ?
    `).bind(code, row.run_id),
  ]);
  if (definitive) await releaseReservation(env, row, attempt, 'definitive provider rejection');
}

async function updateProviderState(env: Env, row: FactoryRow, attempt: AttemptRow, result: ProviderResult) {
  const state = providerState(result.status);
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE content_factory_attempts
         SET state = ?, provider_job_id = ?, provider_model = ?, submission_outcome = 'acknowledged',
             submitted_at = COALESCE(submitted_at, datetime('now')),
             completed_at = CASE WHEN ? = 'provider_completed' THEN datetime('now') ELSE completed_at END,
             updated_at = datetime('now')
       WHERE id = ? AND is_current = 1
    `).bind(state, result.provider_job_id, result.model, state, attempt.id),
    env.DB.prepare(`
      UPDATE content_factory_jobs SET state = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(state, row.factory_job_id),
  ]);
  await recordProviderCost(env, row, attempt, result);
}

export async function refreshContentFactoryRunState(env: Env, runId: string) {
  const counts = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN state = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN state IN ('downloaded','validating') THEN 1 ELSE 0 END) AS awaiting_qc,
      SUM(CASE WHEN state = 'awaiting_human_review' THEN 1 ELSE 0 END) AS awaiting_human,
      SUM(CASE WHEN state IN (
        'submission_failed','provider_failed','provider_cancelled','polling_failed','timed_out',
        'download_failed','validation_failed','automated_qc_failed','human_review_rejected'
      ) THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN state IN (
        'submitting','submitted','provider_pending','provider_processing','provider_completed','downloading'
      ) THEN 1 ELSE 0 END) AS active
      FROM content_factory_jobs WHERE run_id = ?
  `).bind(runId).first<{
    total: number; approved: number; awaiting_qc: number; awaiting_human: number;
    failed: number; active: number;
  }>();
  const total = Number(counts?.total ?? 0);
  const approved = Number(counts?.approved ?? 0);
  const awaitingQc = Number(counts?.awaiting_qc ?? 0);
  const awaitingHuman = Number(counts?.awaiting_human ?? 0);
  const failed = Number(counts?.failed ?? 0);
  const active = Number(counts?.active ?? 0);
  // الأبعد عن التسليم يفوز: فشل > عمل مزوّد جارٍ > QC آلي > مراجعة بشرية > مكتمل.
  // بذلك لا يمكن لتنزيل أصل أو انتظار مراجع أن يُقرأ خطأً كتسليم master معتمد.
  const state = total > 0 && approved === total ? 'completed'
    : total > 0 && failed === total ? 'failed'
      : failed > 0 ? 'partially_failed'
        : active > 0 ? 'running'
          : awaitingQc > 0 ? 'awaiting_qc'
            : awaitingHuman > 0 ? 'awaiting_human_review'
              : 'queued';
  await env.DB.prepare(`
    UPDATE content_factory_runs SET state = ?, updated_at = datetime('now')
     WHERE id = ? AND state <> 'cancelled'
  `).bind(state, runId).run();
}

async function downloadCompleted(
  env: Env,
  row: FactoryRow,
  attempt: AttemptRow,
  result: ProviderResult,
  fetchImpl: typeof fetch,
): Promise<ProcessResult> {
  const resultUrl = result.result_urls[0];
  if (!resultUrl) {
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE content_factory_attempts SET state = 'download_failed', error_code = 'RESULT_URL_MISSING',
               error_detail = 'Provider completed without a result URL', updated_at = datetime('now') WHERE id = ?
      `).bind(attempt.id),
      env.DB.prepare(`UPDATE content_factory_jobs SET state = 'download_failed', updated_at = datetime('now') WHERE id = ?`)
        .bind(row.factory_job_id),
    ]);
    await refreshContentFactoryRunState(env, row.run_id);
    return { accepted: true, disposition: 'ack', reason: 'result_url_missing', run_id: row.run_id, job_id: row.job_id };
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE content_factory_attempts SET state = 'downloading', updated_at = datetime('now') WHERE id = ?`).bind(attempt.id),
    env.DB.prepare(`UPDATE content_factory_jobs SET state = 'downloading', updated_at = datetime('now') WHERE id = ?`).bind(row.factory_job_id),
  ]);
  try {
    const downloaded = await downloadProviderAsset({
      url: resultUrl,
      apiKey: env.PLAYVEO_API_KEY!,
      baseUrl: env.PLAYVEO_BASE_URL,
      allowedHosts: env.PLAYVEO_DOWNLOAD_HOSTS,
      fetchImpl,
      maximumBytes: row.kind === 'video' ? 100_000_000 : 20_000_000,
    });
    const assetSha = await sha256Hex(downloaded.bytes);
    const extension = row.kind === 'video' ? 'mp4'
      : downloaded.content_type === 'image/png' ? 'png' : 'webp';
    const objectKey = `content-factory/${row.run_id}/${row.job_id}/${attempt.id}/${assetSha}.${extension}`;
    await env.MEDIA_BUCKET.put(objectKey, downloaded.bytes, {
      httpMetadata: { contentType: downloaded.content_type },
      customMetadata: {
        run_id: row.run_id,
        job_id: row.job_id,
        attempt_id: attempt.id,
        plan_sha256: row.plan_sha256,
        asset_sha256: assetSha,
      },
    });
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE content_factory_attempts
           SET state = 'downloaded', private_asset_key = ?, asset_sha256 = ?,
               completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
      `).bind(objectKey, assetSha, attempt.id),
      env.DB.prepare(`
        UPDATE content_factory_jobs SET state = 'downloaded', updated_at = datetime('now') WHERE id = ?
      `).bind(row.factory_job_id),
    ]);
    await refreshContentFactoryRunState(env, row.run_id);
    return { accepted: true, disposition: 'ack', reason: 'downloaded_private_asset', run_id: row.run_id, job_id: row.job_id };
  } catch (error) {
    const code = error instanceof ContentFactoryProviderError ? error.code : 'ASSET_DOWNLOAD_FAILED';
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE content_factory_attempts SET state = 'download_failed', error_code = ?,
               error_detail = 'Private asset download failed', updated_at = datetime('now') WHERE id = ?
      `).bind(code, attempt.id),
      env.DB.prepare(`UPDATE content_factory_jobs SET state = 'download_failed', updated_at = datetime('now') WHERE id = ?`)
        .bind(row.factory_job_id),
    ]);
    await refreshContentFactoryRunState(env, row.run_id);
    return {
      accepted: true,
      disposition: error instanceof ContentFactoryProviderError && error.retryable ? 'retry' : 'ack',
      delay_seconds: 60,
      reason: code,
      run_id: row.run_id,
      job_id: row.job_id,
    };
  }
}

async function applyProviderResult(
  env: Env,
  row: FactoryRow,
  attempt: AttemptRow,
  result: ProviderResult,
  fetchImpl: typeof fetch,
): Promise<ProcessResult> {
  await updateProviderState(env, row, attempt, result);
  if (PROVIDER_PENDING.has(result.status)) {
    return { accepted: true, disposition: 'reschedule', delay_seconds: 30, reason: result.status, run_id: row.run_id, job_id: row.job_id };
  }
  if (result.status === 'failed' || result.status === 'cancelled') {
    await refreshContentFactoryRunState(env, row.run_id);
    return { accepted: true, disposition: 'ack', reason: `provider_${result.status}`, run_id: row.run_id, job_id: row.job_id };
  }
  return downloadCompleted(env, row, attempt, result, fetchImpl);
}

async function submit(
  env: Env,
  row: FactoryRow,
  attempt: AttemptRow,
  fetchImpl: typeof fetch,
): Promise<ProcessResult> {
  // The provider credential is accessed only after DB-backed plan, approval,
  // dependency, idempotency and reservation checks have all passed.
  const apiKey = env.PLAYVEO_API_KEY;
  if (!apiKey) {
    await markSubmissionFailure(env, row, attempt, new Error('provider_not_configured'));
    return { accepted: true, disposition: 'ack', reason: 'provider_not_configured', run_id: row.run_id, job_id: row.job_id };
  }
  try {
    const result = await submitProviderJob({
      job: jobFromRow(row, attempt.idempotency_key),
      apiKey,
      baseUrl: env.PLAYVEO_BASE_URL,
      fetchImpl,
    });
    return applyProviderResult(env, row, attempt, result, fetchImpl);
  } catch (error) {
    await markSubmissionFailure(env, row, attempt, error);
    return {
      accepted: true,
      disposition: 'ack',
      reason: error instanceof ContentFactoryProviderError ? error.code : 'submission_outcome_unknown',
      run_id: row.run_id,
      job_id: row.job_id,
    };
  }
}

async function poll(
  env: Env,
  row: FactoryRow,
  attempt: AttemptRow,
  fetchImpl: typeof fetch,
): Promise<ProcessResult> {
  if (!attempt.provider_job_id) {
    await markSubmissionFailure(env, row, attempt, new Error('provider_job_id_missing'));
    return { accepted: true, disposition: 'ack', reason: 'provider_job_id_missing', run_id: row.run_id, job_id: row.job_id };
  }
  const apiKey = env.PLAYVEO_API_KEY;
  if (!apiKey) return { accepted: true, disposition: 'ack', reason: 'provider_not_configured', run_id: row.run_id, job_id: row.job_id };
  try {
    const result = await pollProviderJob({
      job: jobFromRow(row, attempt.idempotency_key),
      providerJobId: attempt.provider_job_id,
      apiKey,
      baseUrl: env.PLAYVEO_BASE_URL,
      fetchImpl,
    });
    return applyProviderResult(env, row, attempt, result, fetchImpl);
  } catch (error) {
    const retryable = error instanceof ContentFactoryProviderError && error.retryable;
    const code = error instanceof ContentFactoryProviderError ? error.code : 'POLLING_FAILED';
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE content_factory_attempts SET state = 'polling_failed', error_code = ?,
               error_detail = 'Provider poll failed', updated_at = datetime('now') WHERE id = ?
      `).bind(code, attempt.id),
      env.DB.prepare(`UPDATE content_factory_jobs SET state = 'polling_failed', updated_at = datetime('now') WHERE id = ?`)
        .bind(row.factory_job_id),
    ]);
    return {
      accepted: true,
      disposition: retryable ? 'retry' : 'ack',
      delay_seconds: 60,
      reason: code,
      run_id: row.run_id,
      job_id: row.job_id,
    };
  }
}

async function createReplacementAttempt(env: Env, row: FactoryRow, current: AttemptRow, message: ContentFactoryMessage) {
  if (!message.allow_new_paid_attempt || !message.accept_duplicate_charge_risk) {
    throw new Error('factory_replacement_not_authorized');
  }
  assertActiveSpendApproval(row);
  if (row.approved_ceiling_micros === null) throw new Error('factory_spend_not_approved');
  const exposure = await exposureMicros(env, row.run_id);
  if (exposure + row.estimate_high_micros > row.approved_ceiling_micros) {
    throw new Error('factory_budget_ceiling_exceeded');
  }
  const sequence = current.sequence + 1;
  const attemptId = `cfa-${crypto.randomUUID()}`;
  const idempotencyKey = `cf-attempt-${await sha256Hex(`${row.idempotency_key}:${sequence}`)}`;
  const reservationRef = `replacement:${attemptId}`;
  const results = await env.DB.batch([
    env.DB.prepare(`
      UPDATE content_factory_attempts SET state = 'archived', is_current = 0,
             updated_at = datetime('now') WHERE id = ? AND is_current = 1
    `).bind(current.id),
    env.DB.prepare(`
      INSERT INTO content_factory_attempts (
        id, run_id, factory_job_id, sequence, state, idempotency_key, is_current
      ) VALUES (?, ?, ?, ?, 'submitting', ?, 1)
    `).bind(attemptId, row.run_id, row.factory_job_id, sequence, idempotencyKey),
    env.DB.prepare(`
      INSERT INTO content_factory_cost_ledger (
        id, run_id, factory_job_id, attempt_id, entry_type, amount_micros,
        source_ref, notes, created_by
      ) VALUES (?, ?, ?, ?, 'reservation', ?, ?, 'explicit failed-only replacement', 'content-factory-worker')
    `).bind(
      `cfcl-${crypto.randomUUID()}`, row.run_id, row.factory_job_id, attemptId,
      row.estimate_high_micros, reservationRef,
    ),
    env.DB.prepare(`
      UPDATE content_factory_jobs
         SET state = 'submitting', current_attempt_id = ?, reserved_micros = ?,
             updated_at = datetime('now') WHERE id = ?
    `).bind(attemptId, row.estimate_high_micros, row.factory_job_id),
  ]);
  if (resultChanges(results[0]) !== 1 || resultChanges(results[1]) !== 1) {
    throw new Error('factory_replacement_race');
  }
  return currentAttempt(env, row.factory_job_id);
}

export async function processContentFactoryMessage(
  env: Env,
  value: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<ProcessResult> {
  const message = parseFactoryMessage(value);
  if (!message) return { accepted: false, disposition: 'ack', reason: 'invalid_message' };
  const row = await loadFactoryRow(env, message);
  if (!row) return { accepted: false, disposition: 'ack', reason: 'job_not_found', run_id: message.run_id, job_id: message.job_id };
  try {
    assertPaidGate(row, message);
    const parsedManifest = await parseFactoryManifest(parseJson(row.manifest_json, null));
    assertManifestReadyForApproval(parsedManifest);
    if (parsedManifest.plan_sha256 !== row.plan_sha256) {
      throw new Error('factory_persisted_plan_hash_mismatch');
    }
    let attempt = await currentAttempt(env, row.factory_job_id);

    if (!attempt) {
      if (message.action !== 'dispatch' || row.job_state !== 'queued' || row.reserved_micros <= 0) {
        return { accepted: false, disposition: 'ack', reason: 'no_dispatchable_attempt', run_id: row.run_id, job_id: row.job_id };
      }
      const created = await createInitialAttempt(env, row);
      attempt = created.attempt;
      if (!attempt) {
        return { accepted: true, disposition: 'reschedule', delay_seconds: 5, reason: 'attempt_creation_race', run_id: row.run_id, job_id: row.job_id };
      }
      if (!created.created) {
        return { accepted: true, disposition: 'ack', reason: 'attempt_creation_already_won', run_id: row.run_id, job_id: row.job_id };
      }
      return submit(env, row, attempt, fetchImpl);
    }

    if (['approved', 'downloaded', 'awaiting_human_review'].includes(attempt.state)) {
      return { accepted: true, disposition: 'ack', reason: 'already_delivered', run_id: row.run_id, job_id: row.job_id };
    }
    if (message.action === 'retry_failed' && REPLACEMENT_STATES.has(attempt.state)) {
      const replacement = await createReplacementAttempt(env, row, attempt, message);
      if (!replacement) return { accepted: true, disposition: 'retry', delay_seconds: 5, reason: 'replacement_creation_race', run_id: row.run_id, job_id: row.job_id };
      return submit(env, { ...row, reserved_micros: row.estimate_high_micros }, replacement, fetchImpl);
    }
    if (attempt.state === 'submitting' && !attempt.provider_job_id) {
      if (attempt.submission_stale !== 1) {
        return {
          accepted: true,
          disposition: message.action === 'resume' ? 'reschedule' : 'ack',
          delay_seconds: 30,
          reason: 'submission_in_progress',
          run_id: row.run_id,
          job_id: row.job_id,
        };
      }
      await markSubmissionFailure(env, row, attempt, new Error('stale_submitting_attempt'));
      return { accepted: true, disposition: 'ack', reason: 'submission_outcome_unknown', run_id: row.run_id, job_id: row.job_id };
    }
    if (RESUMABLE_STATES.has(attempt.state)) return poll(env, row, attempt, fetchImpl);
    return { accepted: true, disposition: 'ack', reason: 'attempt_not_resumable', run_id: row.run_id, job_id: row.job_id };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'factory_processing_failed';
    if (reason === 'factory_dependencies_not_approved') {
      return {
        accepted: true,
        disposition: 'reschedule',
        delay_seconds: 30,
        reason,
        run_id: row.run_id,
        job_id: row.job_id,
      };
    }
    return { accepted: false, disposition: 'ack', reason, run_id: row.run_id, job_id: row.job_id };
  }
}

export function isContentFactoryQueue(queueName: string) {
  return /(?:^|-)content-factory(?:-|$)/.test(queueName);
}

export async function settleContentFactoryMessage(
  message: Message<unknown>,
  result: ProcessResult,
  env: Env,
) {
  const delaySeconds = result.delay_seconds ?? 30;
  if (result.disposition === 'reschedule') {
    if (!env.CONTENT_FACTORY_JOBS) {
      message.retry({ delaySeconds });
      return;
    }
    try {
      await env.CONTENT_FACTORY_JOBS.send(message.body, { delaySeconds });
      message.ack();
    } catch {
      message.retry({ delaySeconds });
    }
    return;
  }
  if (result.disposition === 'retry') message.retry({ delaySeconds });
  else message.ack();
}

export async function handleContentFactoryJobs(batch: MessageBatch<unknown>, env: Env) {
  for (const message of batch.messages) {
    const result = await processContentFactoryMessage(env, message.body);
    await settleContentFactoryMessage(message, result, env);
  }
}

export async function handleContentFactoryDlq(batch: MessageBatch<unknown>, env: Env) {
  for (const message of batch.messages) {
    const parsed = parseFactoryMessage(message.body);
    if (parsed) {
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE content_factory_runs SET state = 'paused', last_error_code = 'FACTORY_DLQ',
                 updated_at = datetime('now') WHERE id = ?
        `).bind(parsed.run_id),
        env.DB.prepare(`
          UPDATE content_factory_jobs SET state = CASE
                   WHEN state IN ('approved','downloaded','awaiting_human_review') THEN state
                   WHEN state = 'queued' AND current_attempt_id IS NULL THEN state
                   ELSE 'polling_failed' END,
                 updated_at = datetime('now')
           WHERE run_id = ? AND job_id = ?
        `).bind(parsed.run_id, parsed.job_id),
      ]);
    }
    message.ack();
  }
}

export { CONTENT_FACTORY_MESSAGE_SCHEMA };
