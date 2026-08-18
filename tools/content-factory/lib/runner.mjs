import {
  ContractError,
  assertDispatchReady,
  sha256Hex,
} from './contract.mjs';
import {
  StateTransitionError,
  assertRetryFailedOnly,
  createAttempt,
  normalizeProviderStatus,
  transitionAttempt,
} from './state-machine.mjs';

export class RunnerError extends Error {
  constructor(message, { code = 'RUNNER_ERROR', details = null } = {}) {
    super(message);
    this.name = 'RunnerError';
    this.code = code;
    this.details = details;
  }
}

function requireMethod(target, method, name) {
  if (typeof target?.[method] !== 'function') throw new TypeError(`${name}.${method} is required`);
}

function assertDependencies({ repository, providerFactory }) {
  for (const method of ['findCurrentAttempt', 'nextAttemptSequence', 'saveAttempt', 'getBudgetSnapshot', 'reserveBudget']) {
    requireMethod(repository, method, 'repository');
  }
  if (typeof providerFactory !== 'function') throw new TypeError('providerFactory is required');
}

function findJob(manifest, jobId) {
  const job = manifest.jobs.find((candidate) => candidate.job_id === jobId);
  if (!job) throw new RunnerError(`Unknown manifest job: ${jobId}`, { code: 'UNKNOWN_JOB' });
  return job;
}

function attemptIdempotencyKey(jobKey, sequence) {
  if (sequence === 1) return jobKey;
  return `cf-attempt-${sha256Hex({ job_idempotency_key: jobKey, sequence })}`;
}

async function persist(repository, attempt) {
  await repository.saveAttempt(attempt);
  return attempt;
}

async function instantiateProvider(providerFactory, job) {
  const provider = await providerFactory({ provider: job.provider, job });
  for (const method of ['submit', 'poll']) requireMethod(provider, method, 'provider');
  return provider;
}

function budgetArgs(snapshot) {
  return {
    committedGrossCredits: snapshot?.provider_declared_gross_credits ?? 0,
    confirmedRefundCredits: snapshot?.refunds_confirmed_credits ?? 0,
    reservedCredits: snapshot?.reserved_credits ?? 0,
  };
}

async function assertJobDependencies(repository, { runId, job }) {
  if (job.dependencies.length === 0) return;
  if (typeof repository.areDependenciesApproved !== 'function') {
    throw new RunnerError('Repository must verify dependency approval for dependent jobs', {
      code: 'DEPENDENCY_CHECK_UNAVAILABLE', details: { job_id: job.job_id },
    });
  }
  const result = await repository.areDependenciesApproved({ runId, dependencyJobIds: job.dependencies });
  if (result !== true) {
    throw new RunnerError('Job dependencies are not approved', {
      code: 'DEPENDENCIES_NOT_APPROVED', details: { job_id: job.job_id, dependencies: job.dependencies },
    });
  }
}

async function reserve(repository, { runId, job, attempt, manifest }) {
  const reservation = await repository.reserveBudget({
    run_id: runId,
    job_id: job.job_id,
    attempt_id: attempt.attempt_id,
    idempotency_key: attempt.idempotency_key,
    amount_credits: job.cost.high_credits,
    approved_ceiling_credits: manifest.spend_approval.ceiling_credits,
    plan_sha256: manifest.integrity.plan_sha256,
  });
  if (!reservation || reservation.ok !== true) {
    throw new RunnerError('Atomic budget reservation was rejected', {
      code: 'BUDGET_RESERVATION_REJECTED', details: reservation ?? null,
    });
  }
  return reservation;
}

function addProviderObservation(attempt, result) {
  const next = structuredClone(attempt);
  next.provider_result_count = result.result_urls?.length ?? 0;
  if (result.model) next.provider_model = result.model;
  return next;
}

async function completeReservation(repository, attempt, result) {
  if (typeof repository.commitProviderCost === 'function') {
    await repository.commitProviderCost({
      attempt_id: attempt.attempt_id,
      provider_declared_gross_credits: result.provider_declared_gross_credits,
    });
  }
}

async function releaseReservation(repository, attempt, reason) {
  if (typeof repository.releaseBudgetReservation === 'function') {
    await repository.releaseBudgetReservation({ attempt_id: attempt.attempt_id, reason });
  }
}

async function downloadResult({ repository, provider, assetStore, manifest, job, attempt, result, now }) {
  if (!assetStore || result.status !== 'completed') return attempt;
  requireMethod(provider, 'download', 'provider');
  requireMethod(assetStore, 'putPrivate', 'assetStore');
  const url = result.result_urls?.[0];
  if (!url) {
    const failed = transitionAttempt(attempt, 'download_failed', {
      at: now(), reason: 'provider_completed_without_result_url',
    });
    return persist(repository, failed);
  }

  let downloading = transitionAttempt(attempt, 'downloading', {
    at: now(), reason: 'private_asset_download_started',
  });
  downloading = await persist(repository, downloading);
  try {
    const bytes = await provider.download(url);
    const assetSha256 = sha256Hex(bytes);
    const stored = await assetStore.putPrivate({
      run_id: attempt.run_id,
      job_id: job.job_id,
      attempt_id: attempt.attempt_id,
      plan_sha256: manifest.integrity.plan_sha256,
      asset_sha256: assetSha256,
      bytes,
      content_type: job.kind === 'video' ? 'video/mp4' : 'image/*',
    });
    if (!stored?.private_key) {
      throw new RunnerError('Private asset store did not return an object key', { code: 'ASSET_STORE_FAILED' });
    }
    let downloaded = transitionAttempt(downloading, 'downloaded', {
      at: now(), reason: 'private_asset_downloaded', assetSha256,
    });
    downloaded.private_asset_key = stored.private_key;
    downloaded.provider_result_count = result.result_urls.length;
    return persist(repository, downloaded);
  } catch (error) {
    const failed = transitionAttempt(downloading, 'download_failed', {
      at: now(), reason: error?.code ?? 'download_failed',
    });
    await persist(repository, failed);
    throw error;
  }
}

async function applyProviderResult({ repository, provider, assetStore, manifest, job, attempt, result, now }) {
  if (!result?.status) {
    const failed = transitionAttempt(attempt, 'polling_failed', {
      at: now(), reason: 'provider_status_missing',
    });
    await persist(repository, failed);
    throw new RunnerError('Provider response has no status', { code: 'INVALID_PROVIDER_STATUS' });
  }
  const targetState = normalizeProviderStatus(result.status);
  let next = transitionAttempt(attempt, targetState, {
    at: now(),
    reason: 'provider_status_observed',
    providerJobId: result.provider_job_id ?? attempt.provider_job_id,
    ...(result.provider_declared_gross_credits !== null
      ? { providerDeclaredGrossCredits: result.provider_declared_gross_credits }
      : {}),
  });
  next = addProviderObservation(next, result);
  next = await persist(repository, next);
  await completeReservation(repository, next, result);
  return downloadResult({ repository, provider, assetStore, manifest, job, attempt: next, result, now });
}

async function dispatchNewAttempt({
  manifest,
  runId,
  job,
  allowPaid,
  repository,
  providerFactory,
  assetStore,
  now,
}) {
  await assertJobDependencies(repository, { runId, job });
  const budgetSnapshot = await repository.getBudgetSnapshot({ run_id: runId });
  assertDispatchReady(manifest, {
    allowPaid,
    ...budgetArgs(budgetSnapshot),
    jobIds: [job.job_id],
    now: new Date(now()),
  });

  const sequence = await repository.nextAttemptSequence({ run_id: runId, job_id: job.job_id });
  const attempt = createAttempt({
    attemptId: `attempt-${sha256Hex({ run_id: runId, job_id: job.job_id, sequence }).slice(0, 24)}`,
    runId,
    jobId: job.job_id,
    idempotencyKey: attemptIdempotencyKey(job.idempotency_key, sequence),
    sequence,
    createdAt: now(),
  });
  await reserve(repository, { runId, job, attempt, manifest });
  await persist(repository, attempt);

  let submitting = transitionAttempt(attempt, 'submitting', {
    at: now(), reason: 'paid_submission_started_after_budget_reservation',
  });
  submitting = await persist(repository, submitting);

  // Credentials/network-capable adapters are instantiated only after all local
  // contract, approval, dependency, and atomic budget checks have passed.
  try {
    const provider = await instantiateProvider(providerFactory, job);
    const result = await provider.submit({ ...job, idempotency_key: attempt.idempotency_key });
    let submitted = transitionAttempt(submitting, 'submitted', {
      at: now(),
      reason: 'provider_submission_acknowledged',
      providerJobId: result.provider_job_id,
      ...(result.provider_declared_gross_credits !== null
        ? { providerDeclaredGrossCredits: result.provider_declared_gross_credits }
        : {}),
    });
    submitted = addProviderObservation(submitted, result);
    submitted = await persist(repository, submitted);
    if (result.status && result.status !== 'submitted') {
      return applyProviderResult({
        repository, provider, assetStore, manifest, job,
        attempt: submitted, result, now,
      });
    }
    return submitted;
  } catch (error) {
    const failed = transitionAttempt(submitting, 'submission_failed', {
      at: now(), reason: error?.code ?? 'submission_failed',
    });
    failed.submission_outcome = error?.status && error.status >= 400 && error.status < 500
      ? 'provider_rejected'
      : 'unknown';
    await persist(repository, failed);
    if (failed.submission_outcome === 'provider_rejected') {
      await releaseReservation(repository, failed, 'definitive_provider_rejection');
    }
    throw error;
  }
}

export async function runPlannedJob({
  manifest,
  runId,
  jobId,
  allowPaid = false,
  repository,
  providerFactory,
  assetStore = null,
  now = () => new Date().toISOString(),
} = {}) {
  assertDependencies({ repository, providerFactory });
  const job = findJob(manifest, jobId);
  const current = await repository.findCurrentAttempt({ run_id: runId, job_id: jobId });
  if (current) {
    if (current.state === 'approved' || current.state === 'downloaded' || current.state === 'awaiting_human_review') {
      return { action: 'no_op', attempt: current };
    }
    throw new RunnerError('A current attempt already exists; use resume or retry-failed', {
      code: 'CURRENT_ATTEMPT_EXISTS', details: { attempt_id: current.attempt_id, state: current.state },
    });
  }
  const attempt = await dispatchNewAttempt({
    manifest, runId, job, allowPaid, repository, providerFactory, assetStore, now,
  });
  return { action: 'dispatched', attempt };
}

export async function resumeAttempt({
  manifest,
  runId,
  jobId,
  repository,
  providerFactory,
  assetStore = null,
  now = () => new Date().toISOString(),
} = {}) {
  assertDependencies({ repository, providerFactory });
  const job = findJob(manifest, jobId);
  const attempt = await repository.findCurrentAttempt({ run_id: runId, job_id: jobId });
  if (!attempt) throw new RunnerError('No current attempt exists', { code: 'ATTEMPT_NOT_FOUND' });
  if (['approved', 'downloaded', 'awaiting_human_review'].includes(attempt.state)) {
    return { action: 'no_op', attempt };
  }
  if (!attempt.provider_job_id) {
    throw new RunnerError('Cannot resume provider work without a provider job ID', {
      code: 'PROVIDER_JOB_ID_MISSING', details: { state: attempt.state },
    });
  }
  const resumable = new Set([
    'submitted', 'provider_pending', 'provider_processing', 'polling_failed', 'timed_out',
    'provider_completed', 'download_failed',
  ]);
  if (!resumable.has(attempt.state)) {
    throw new RunnerError('Attempt state is not resumable', {
      code: 'ATTEMPT_NOT_RESUMABLE', details: { state: attempt.state },
    });
  }
  const provider = await instantiateProvider(providerFactory, job);
  try {
    const result = await provider.poll(job, attempt.provider_job_id);
    if ((attempt.state === 'provider_completed' || attempt.state === 'download_failed') && result.status === 'completed') {
      return {
        action: 'resumed_download',
        attempt: await downloadResult({ repository, provider, assetStore, manifest, job, attempt, result, now }),
      };
    }
    return {
      action: 'resumed_poll',
      attempt: await applyProviderResult({
        repository, provider, assetStore, manifest, job, attempt, result, now,
      }),
    };
  } catch (error) {
    if (error instanceof StateTransitionError || error instanceof ContractError) throw error;
    if (['submitted', 'provider_pending', 'provider_processing'].includes(attempt.state)) {
      const failed = transitionAttempt(attempt, 'polling_failed', {
        at: now(), reason: error?.code ?? 'polling_failed',
      });
      await persist(repository, failed);
    }
    throw error;
  }
}

export async function retryFailedJob({
  manifest,
  runId,
  jobId,
  allowPaid = false,
  allowNewPaidAttempt = false,
  acceptDuplicateChargeRisk = false,
  repository,
  providerFactory,
  assetStore = null,
  now = () => new Date().toISOString(),
} = {}) {
  assertDependencies({ repository, providerFactory });
  const job = findJob(manifest, jobId);
  const current = await repository.findCurrentAttempt({ run_id: runId, job_id: jobId });
  if (!current) throw new RunnerError('No failed attempt exists', { code: 'ATTEMPT_NOT_FOUND' });
  const recovery = assertRetryFailedOnly(current, {
    allowNewPaidAttempt,
    acceptDuplicateChargeRisk,
  });
  if (!recovery.redispatch) {
    return resumeAttempt({
      manifest, runId, jobId, repository, providerFactory, assetStore, now,
    });
  }
  if (!allowPaid) {
    throw new RunnerError('A replacement provider request requires --allow-paid', {
      code: 'PAID_FLAG_REQUIRED', details: recovery,
    });
  }
  const archived = transitionAttempt(current, 'archived', {
    at: now(), reason: 'failed_attempt_archived_before_explicit_replacement',
  });
  await persist(repository, archived);
  const replacement = await dispatchNewAttempt({
    manifest, runId, job, allowPaid, repository, providerFactory, assetStore, now,
  });
  return { action: 'redispatched_failed_only', attempt: replacement, archived_attempt_id: current.attempt_id };
}
