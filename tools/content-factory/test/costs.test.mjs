import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BudgetError,
  assertBudgetAvailable,
  estimateJobCost,
  estimatePlan,
  summarizeAttemptLedger,
} from '../lib/costs.mjs';

test('observed FLUX video and image prices remain explicit', () => {
  assert.equal(estimateJobCost({
    job_id: 'clip-15', kind: 'video', provider: 'flux', duration_seconds: 15,
  }).high_credits, 0.75);
  assert.equal(estimateJobCost({
    job_id: 'clip-20', kind: 'video', provider: 'flux', duration_seconds: 20,
  }).high_credits, 1);
  assert.equal(estimateJobCost({
    job_id: 'pages', kind: 'image', provider: 'flux', operation: 'text-to-image', count: 194,
  }).high_credits, 19.4);
});

test('plan separates priced floor, contingency, and unpriced narration', () => {
  const estimate = estimatePlan([
    { job_id: 'clip-15', kind: 'video', provider: 'flux', duration_seconds: 15 },
    { job_id: 'clip-20', kind: 'video', provider: 'flux', duration_seconds: 20 },
    { job_id: 'pages', kind: 'image', provider: 'flux', operation: 'text-to-image', count: 194 },
    { job_id: 'narration', kind: 'narration', provider: 'unassigned' },
  ]);
  assert.equal(estimate.budget.estimate_low_credits, 21.15);
  assert.equal(estimate.budget.estimate_high_credits, 21.15);
  assert.equal(estimate.budget.contingency_credits, 3.1725);
  assert.equal(estimate.budget.estimate_with_contingency_credits, 24.3225);
  assert.equal(estimate.budget.requested_ceiling_credits, null);
  assert.deepEqual(estimate.budget.unpriced_job_ids, ['narration']);
});

test('actual ledger never assumes refunds for failed or archived attempts', () => {
  const ledger = summarizeAttemptLedger([
    {
      state: 'approved', current: true,
      provider_declared_gross_credits: 9,
      refund_status: 'unknown', refund_confirmed_credits: 0,
    },
    {
      state: 'archived', current: false,
      provider_declared_gross_credits: 1,
      refund_status: 'unknown', refund_confirmed_credits: 0,
    },
    {
      state: 'timed_out', current: true,
      provider_declared_gross_credits: 2,
      refund_status: 'confirmed', refund_confirmed_credits: 0.5,
    },
  ], { reservedCredits: 0.75 });

  assert.equal(ledger.provider_declared_gross_credits, 12);
  assert.equal(ledger.completed_current_credits, 9);
  assert.equal(ledger.failed_archived_credits, 3);
  assert.equal(ledger.refunds_confirmed_credits, 0.5);
  assert.equal(ledger.refund_unknown_credits, 1);
  assert.equal(ledger.net_confirmed_exposure_credits, 11.5);
  assert.equal(ledger.projected_committed_credits, 12.25);
});

test('budget reservation is rejected before crossing the approved ceiling', () => {
  const ledger = summarizeAttemptLedger([], { reservedCredits: 0.5 });
  assert.deepEqual(assertBudgetAvailable({
    approvedCeilingCredits: 2,
    ledger,
    requestedCredits: 1,
  }), {
    approved_ceiling_credits: 2,
    committed_credits: 0.5,
    requested_credits: 1,
    remaining_after_reservation_credits: 0.5,
  });
  assert.throws(
    () => assertBudgetAvailable({ approvedCeilingCredits: 1, ledger, requestedCredits: 0.75 }),
    (error) => error instanceof BudgetError,
  );
});
