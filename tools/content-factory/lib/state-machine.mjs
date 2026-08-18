export const ATTEMPT_STATES = Object.freeze([
  'planned',
  'submitting',
  'submitted',
  'provider_pending',
  'provider_processing',
  'provider_completed',
  'downloading',
  'downloaded',
  'validating',
  'automated_qc_failed',
  'awaiting_human_review',
  'human_review_rejected',
  'approved',
  'submission_failed',
  'provider_failed',
  'provider_cancelled',
  'polling_failed',
  'timed_out',
  'download_failed',
  'validation_failed',
  'archived',
]);

export const RUN_STATES = Object.freeze([
  'planned',
  'blocked',
  'awaiting_spend_approval',
  'approved',
  'queued',
  'running',
  'paused',
  'awaiting_qc',
  'awaiting_human_review',
  'partially_failed',
  'failed',
  'completed',
  'cancelled',
]);

const ATTEMPT_TRANSITIONS = Object.freeze({
  planned: ['submitting', 'archived'],
  submitting: ['submitted', 'submission_failed', 'archived'],
  submitted: ['provider_pending', 'provider_processing', 'provider_completed', 'provider_failed', 'provider_cancelled', 'polling_failed', 'timed_out'],
  provider_pending: ['provider_processing', 'provider_completed', 'provider_failed', 'provider_cancelled', 'polling_failed', 'timed_out'],
  provider_processing: ['provider_completed', 'provider_failed', 'provider_cancelled', 'polling_failed', 'timed_out'],
  provider_completed: ['downloading', 'download_failed', 'validation_failed', 'archived'],
  downloading: ['downloaded', 'download_failed', 'archived'],
  downloaded: ['validating', 'validation_failed', 'archived'],
  validating: ['awaiting_human_review', 'automated_qc_failed', 'validation_failed', 'archived'],
  automated_qc_failed: ['archived'],
  awaiting_human_review: ['approved', 'human_review_rejected', 'archived'],
  human_review_rejected: ['archived'],
  approved: [],
  submission_failed: ['submitting', 'archived'],
  provider_failed: ['archived'],
  provider_cancelled: ['archived'],
  polling_failed: ['provider_pending', 'provider_processing', 'provider_completed', 'provider_failed', 'provider_cancelled', 'timed_out', 'archived'],
  timed_out: ['provider_pending', 'provider_processing', 'provider_completed', 'provider_failed', 'provider_cancelled', 'archived'],
  download_failed: ['downloading', 'archived'],
  validation_failed: ['validating', 'archived'],
  archived: [],
});

const RUN_TRANSITIONS = Object.freeze({
  planned: ['blocked', 'awaiting_spend_approval', 'cancelled'],
  blocked: ['planned', 'cancelled'],
  awaiting_spend_approval: ['planned', 'approved', 'cancelled'],
  approved: ['queued', 'cancelled'],
  queued: ['running', 'paused', 'cancelled'],
  running: ['paused', 'awaiting_qc', 'awaiting_human_review', 'partially_failed', 'failed', 'completed', 'cancelled'],
  paused: ['queued', 'running', 'cancelled'],
  awaiting_qc: ['running', 'awaiting_human_review', 'partially_failed', 'failed', 'cancelled'],
  awaiting_human_review: ['running', 'partially_failed', 'failed', 'completed', 'cancelled'],
  partially_failed: ['queued', 'running', 'failed', 'completed', 'cancelled'],
  failed: ['queued', 'cancelled'],
  completed: [],
  cancelled: [],
});

const FAILURE_STATES = new Set([
  'submission_failed',
  'provider_failed',
  'provider_cancelled',
  'polling_failed',
  'timed_out',
  'download_failed',
  'validation_failed',
  'automated_qc_failed',
  'human_review_rejected',
]);

const PROVIDER_STATUS_MAP = Object.freeze({
  pending: 'provider_pending',
  processing: 'provider_processing',
  completed: 'provider_completed',
  failed: 'provider_failed',
  cancelled: 'provider_cancelled',
  canceled: 'provider_cancelled',
});

export class StateTransitionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StateTransitionError';
    this.details = details;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertIsoDate(value, field) {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be an ISO date-time`);
}

export function normalizeProviderStatus(status) {
  const normalized = PROVIDER_STATUS_MAP[String(status).toLowerCase()];
  if (!normalized) throw new StateTransitionError(`Unknown provider status: ${status}`, { status });
  return normalized;
}

export function canTransitionAttempt(from, to) {
  return ATTEMPT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionRun(from, to) {
  return RUN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function createAttempt({
  attemptId,
  runId,
  jobId,
  idempotencyKey,
  sequence = 1,
  createdAt = new Date().toISOString(),
}) {
  if (!attemptId || !runId || !jobId || !idempotencyKey) {
    throw new TypeError('attemptId, runId, jobId, and idempotencyKey are required');
  }
  assertIsoDate(createdAt, 'createdAt');
  return {
    attempt_id: attemptId,
    run_id: runId,
    job_id: jobId,
    sequence,
    state: 'planned',
    idempotency_key: idempotencyKey,
    provider_job_id: null,
    provider_declared_gross_credits: null,
    refund_status: 'unknown',
    refund_confirmed_credits: 0,
    current: true,
    created_at: createdAt,
    updated_at: createdAt,
    history: [{ from: null, to: 'planned', at: createdAt, reason: 'attempt_created' }],
  };
}

export function transitionAttempt(attempt, to, {
  at = new Date().toISOString(),
  reason = null,
  providerJobId,
  providerDeclaredGrossCredits,
  refundStatus,
  refundConfirmedCredits,
  automatedQcFingerprint,
  humanReviewFingerprint,
  assetSha256,
} = {}) {
  if (!ATTEMPT_STATES.includes(attempt?.state)) throw new StateTransitionError('Attempt has an invalid current state');
  if (!ATTEMPT_STATES.includes(to)) throw new StateTransitionError(`Unknown target attempt state: ${to}`);
  if (!canTransitionAttempt(attempt.state, to)) {
    throw new StateTransitionError(`Illegal attempt transition ${attempt.state} -> ${to}`, {
      from: attempt.state,
      to,
      allowed: ATTEMPT_TRANSITIONS[attempt.state],
    });
  }
  assertIsoDate(at, 'at');
  if (to === 'submitted' && !(providerJobId ?? attempt.provider_job_id)) {
    throw new StateTransitionError('submitted requires a provider job ID');
  }
  if (to.startsWith('provider_') && to !== 'provider_failed' && !(providerJobId ?? attempt.provider_job_id)) {
    throw new StateTransitionError(`${to} requires a provider job ID`);
  }
  if (to === 'awaiting_human_review' && !automatedQcFingerprint) {
    throw new StateTransitionError('Human review cannot begin without fingerprinted automated QC evidence');
  }
  if (to === 'approved' && (!humanReviewFingerprint || !assetSha256)) {
    throw new StateTransitionError('Approval requires fingerprinted human review and the immutable asset hash');
  }
  if (providerDeclaredGrossCredits !== undefined
    && (!Number.isFinite(providerDeclaredGrossCredits) || providerDeclaredGrossCredits < 0)) {
    throw new TypeError('providerDeclaredGrossCredits must be non-negative');
  }
  if (refundConfirmedCredits !== undefined
    && (!Number.isFinite(refundConfirmedCredits) || refundConfirmedCredits < 0)) {
    throw new TypeError('refundConfirmedCredits must be non-negative');
  }

  const next = clone(attempt);
  const from = next.state;
  next.state = to;
  next.updated_at = at;
  if (providerJobId !== undefined) next.provider_job_id = providerJobId;
  if (providerDeclaredGrossCredits !== undefined) next.provider_declared_gross_credits = providerDeclaredGrossCredits;
  if (refundStatus !== undefined) next.refund_status = refundStatus;
  if (refundConfirmedCredits !== undefined) next.refund_confirmed_credits = refundConfirmedCredits;
  if (automatedQcFingerprint !== undefined) next.automated_qc_fingerprint = automatedQcFingerprint;
  if (humanReviewFingerprint !== undefined) next.human_review_fingerprint = humanReviewFingerprint;
  if (assetSha256 !== undefined) next.asset_sha256 = assetSha256;
  if (to === 'archived') next.current = false;
  next.history.push({ from, to, at, reason: reason ?? 'state_transition' });
  return next;
}

export function transitionRun(run, to, { at = new Date().toISOString(), reason = null } = {}) {
  if (!RUN_STATES.includes(run?.state)) throw new StateTransitionError('Run has an invalid current state');
  if (!RUN_STATES.includes(to)) throw new StateTransitionError(`Unknown target run state: ${to}`);
  if (!canTransitionRun(run.state, to)) {
    throw new StateTransitionError(`Illegal run transition ${run.state} -> ${to}`, {
      from: run.state,
      to,
      allowed: RUN_TRANSITIONS[run.state],
    });
  }
  assertIsoDate(at, 'at');
  const next = clone(run);
  const from = next.state;
  next.state = to;
  next.updated_at = at;
  next.history = [...(next.history ?? []), { from, to, at, reason: reason ?? 'state_transition' }];
  return next;
}

export function isFailureState(state) {
  return FAILURE_STATES.has(state);
}

export function classifyRecovery(attempt) {
  switch (attempt.state) {
    case 'submission_failed':
      if (attempt.provider_job_id) {
        return {
          action: 'resume_poll',
          redispatch: false,
          duplicate_charge_risk: false,
          requires_operator_confirmation: false,
          reason: 'A provider ID exists; recover the existing request instead of creating a duplicate.',
        };
      }
      return {
        action: 'new_attempt',
        redispatch: true,
        duplicate_charge_risk: attempt.submission_outcome !== 'provider_rejected',
        requires_operator_confirmation: attempt.submission_outcome !== 'provider_rejected',
        reason: attempt.submission_outcome === 'provider_rejected'
          ? 'The provider definitively rejected the request before accepting paid work.'
          : 'Submission outcome is unknown; the provider may have accepted work before the connection failed.',
      };
    case 'polling_failed':
      return {
        action: 'resume_poll',
        redispatch: false,
        duplicate_charge_risk: false,
        requires_operator_confirmation: false,
        reason: 'Polling failed after submission; keep the same provider job.',
      };
    case 'timed_out':
      return {
        action: 'resume_poll',
        redispatch: false,
        duplicate_charge_risk: true,
        requires_operator_confirmation: false,
        reason: 'Timeout does not prove provider failure; poll the existing provider job first.',
      };
    case 'download_failed':
      return {
        action: 'resume_download',
        redispatch: false,
        duplicate_charge_risk: false,
        requires_operator_confirmation: false,
        reason: 'Generation completed; retry only the download.',
      };
    case 'validation_failed':
      return {
        action: 'resume_validation',
        redispatch: false,
        duplicate_charge_risk: false,
        requires_operator_confirmation: false,
        reason: 'Validate the same downloaded asset before considering regeneration.',
      };
    case 'provider_failed':
    case 'provider_cancelled':
      return {
        action: 'new_attempt',
        redispatch: true,
        duplicate_charge_risk: true,
        requires_operator_confirmation: true,
        reason: 'Provider billing or refund is unknown; a replacement can create another charge.',
      };
    case 'automated_qc_failed':
    case 'human_review_rejected':
      return {
        action: 'manual_decision',
        redispatch: false,
        duplicate_charge_risk: true,
        requires_operator_confirmation: true,
        reason: 'A creative or quality failure needs an explicit regeneration decision and budget.',
      };
    default:
      return {
        action: 'none',
        redispatch: false,
        duplicate_charge_risk: false,
        requires_operator_confirmation: false,
        reason: FAILURE_STATES.has(attempt.state)
          ? 'No automatic recovery is defined.'
          : 'Only failed attempts are eligible for recovery.',
      };
  }
}

export function assertRetryFailedOnly(attempt, {
  allowNewPaidAttempt = false,
  acceptDuplicateChargeRisk = false,
} = {}) {
  if (!isFailureState(attempt.state)) {
    throw new StateTransitionError('retry-failed only accepts failed attempts', { state: attempt.state });
  }
  const recovery = classifyRecovery(attempt);
  if (recovery.action === 'none' || recovery.action === 'manual_decision') {
    throw new StateTransitionError('This failure requires a separate manual decision', recovery);
  }
  if (recovery.redispatch && !allowNewPaidAttempt) {
    throw new StateTransitionError('A new paid attempt was not authorized', recovery);
  }
  if (recovery.redispatch && recovery.duplicate_charge_risk && !acceptDuplicateChargeRisk) {
    throw new StateTransitionError('Duplicate-charge risk must be accepted explicitly', recovery);
  }
  return recovery;
}

export function deriveRunState(attempts, { hasBlockers = false, spendApproved = false } = {}) {
  if (hasBlockers) return 'blocked';
  if (!spendApproved && attempts.length === 0) return 'awaiting_spend_approval';
  if (attempts.length === 0) return spendApproved ? 'approved' : 'planned';

  const current = attempts.filter((attempt) => attempt.current !== false);
  if (current.length === 0) return 'failed';
  if (current.every((attempt) => attempt.state === 'approved')) return 'completed';
  const failures = current.filter((attempt) => isFailureState(attempt.state));
  if (failures.length === current.length) return 'failed';
  if (failures.length > 0) return 'partially_failed';
  if (current.some((attempt) => attempt.state === 'awaiting_human_review')) return 'awaiting_human_review';
  if (current.some((attempt) => ['provider_completed', 'downloading', 'downloaded', 'validating'].includes(attempt.state))) return 'awaiting_qc';
  if (current.some((attempt) => ['submitted', 'provider_pending', 'provider_processing', 'submitting'].includes(attempt.state))) return 'running';
  return 'queued';
}
