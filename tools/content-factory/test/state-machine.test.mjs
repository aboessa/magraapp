import assert from 'node:assert/strict';
import test from 'node:test';

import {
  StateTransitionError,
  assertRetryFailedOnly,
  classifyRecovery,
  createAttempt,
  deriveRunState,
  normalizeProviderStatus,
  transitionAttempt,
} from '../lib/state-machine.mjs';

const createdAt = '2026-08-12T10:00:00.000Z';

function attempt() {
  return createAttempt({
    attemptId: 'attempt-01',
    runId: 'run-01',
    jobId: 'scene-01',
    idempotencyKey: 'cf-v1-0000000000000000',
    createdAt,
  });
}

test('provider statuses are normalized without treating generated as approved', () => {
  assert.equal(normalizeProviderStatus('pending'), 'provider_pending');
  assert.equal(normalizeProviderStatus('canceled'), 'provider_cancelled');

  let current = transitionAttempt(attempt(), 'submitting', { at: '2026-08-12T10:01:00.000Z' });
  assert.throws(
    () => transitionAttempt(current, 'submitted'),
    (error) => error instanceof StateTransitionError,
  );
  current = transitionAttempt(current, 'submitted', {
    providerJobId: 'provider-123',
    at: '2026-08-12T10:02:00.000Z',
  });
  current = transitionAttempt(current, 'provider_completed', {
    providerDeclaredGrossCredits: 0.75,
    at: '2026-08-12T10:10:00.000Z',
  });

  assert.equal(current.state, 'provider_completed');
  assert.equal(deriveRunState([current], { spendApproved: true }), 'awaiting_qc');
  assert.throws(() => transitionAttempt(current, 'approved'));
});

test('approval requires automated evidence, human review, and asset fingerprints', () => {
  let current = transitionAttempt(attempt(), 'submitting');
  current = transitionAttempt(current, 'submitted', { providerJobId: 'provider-123' });
  current = transitionAttempt(current, 'provider_completed');
  current = transitionAttempt(current, 'downloading');
  current = transitionAttempt(current, 'downloaded');
  current = transitionAttempt(current, 'validating');
  assert.throws(() => transitionAttempt(current, 'awaiting_human_review'));

  current = transitionAttempt(current, 'awaiting_human_review', {
    automatedQcFingerprint: 'a'.repeat(64),
  });
  assert.throws(() => transitionAttempt(current, 'approved', {
    humanReviewFingerprint: 'b'.repeat(64),
  }));
  current = transitionAttempt(current, 'approved', {
    humanReviewFingerprint: 'b'.repeat(64),
    assetSha256: 'c'.repeat(64),
  });
  assert.equal(current.state, 'approved');
  assert.equal(deriveRunState([current], { spendApproved: true }), 'completed');
});

test('resume retries the existing paid work before redispatching', () => {
  let timedOut = transitionAttempt(attempt(), 'submitting');
  timedOut = transitionAttempt(timedOut, 'submitted', { providerJobId: 'provider-123' });
  timedOut = transitionAttempt(timedOut, 'timed_out');
  assert.deepEqual(classifyRecovery(timedOut), {
    action: 'resume_poll',
    redispatch: false,
    duplicate_charge_risk: true,
    requires_operator_confirmation: false,
    reason: 'Timeout does not prove provider failure; poll the existing provider job first.',
  });
  assert.equal(assertRetryFailedOnly(timedOut).action, 'resume_poll');

  let failed = transitionAttempt(attempt(), 'submitting');
  failed = transitionAttempt(failed, 'submitted', { providerJobId: 'provider-456' });
  failed = transitionAttempt(failed, 'provider_failed');
  assert.throws(() => assertRetryFailedOnly(failed), /not authorized/);
  assert.throws(
    () => assertRetryFailedOnly(failed, { allowNewPaidAttempt: true }),
    /Duplicate-charge risk/,
  );
  assert.equal(assertRetryFailedOnly(failed, {
    allowNewPaidAttempt: true,
    acceptDuplicateChargeRisk: true,
  }).action, 'new_attempt');
});

test('retry-failed refuses successful or in-flight attempts', () => {
  assert.throws(
    () => assertRetryFailedOnly(attempt()),
    /only accepts failed attempts/,
  );
});
