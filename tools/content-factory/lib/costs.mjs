const MICROS_PER_CREDIT = 1_000_000;

export const PRICING_VERSION = 'playveo-observed-2026-08-12-v1';
export const PRICING_CATALOG = Object.freeze({
  'flux.video.model-audio': Object.freeze({
    status: 'priced',
    unit: 'second',
    low_micros_per_unit: 50_000,
    high_micros_per_unit: 50_000,
    min_units: 5,
    max_units: 20,
    basis: 'Observed provider-declared costs: 0.75 credits/15s and 1.00 credit/20s; model audio is retained.',
  }),
  'flux.image.text-to-image': Object.freeze({
    status: 'priced',
    unit: 'image',
    low_micros_per_unit: 100_000,
    high_micros_per_unit: 100_000,
    min_units: 1,
    max_units: 1000,
    basis: 'Provider response creditCost observed/documented as 0.1 credits per generated image.',
  }),
  'flux.image.image-to-image': Object.freeze({
    status: 'priced',
    unit: 'image',
    low_micros_per_unit: 150_000,
    high_micros_per_unit: 150_000,
    min_units: 1,
    max_units: 1000,
    basis: 'Provider response creditCost observed/documented as 0.15 credits per generated image.',
  }),
  'narration.unassigned': Object.freeze({
    status: 'unpriced',
    unit: 'request',
    basis: 'No narration provider or approved rate has been selected.',
  }),
  'internal.package': Object.freeze({
    status: 'priced',
    unit: 'package',
    low_micros_per_unit: 0,
    high_micros_per_unit: 0,
    min_units: 1,
    max_units: 1000,
    basis: 'Local packaging has no provider credit charge; infrastructure cost is outside this ledger.',
  }),
});

export class BudgetError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'BudgetError';
    this.details = details;
  }
}

function assertNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a finite non-negative number`);
}

function toMicros(credits, name = 'credits') {
  assertNonNegative(credits, name);
  return Math.round(credits * MICROS_PER_CREDIT);
}

function fromMicros(micros) {
  return Number((micros / MICROS_PER_CREDIT).toFixed(6));
}

function inferPricingKey(job) {
  if (job.cost?.pricing_key) return job.cost.pricing_key;
  if (job.pricing_key) return job.pricing_key;
  if (job.provider === 'flux' && job.kind === 'video') return 'flux.video.model-audio';
  if (job.provider === 'flux' && job.kind === 'image' && job.operation === 'text-to-image') return 'flux.image.text-to-image';
  if (job.provider === 'flux' && job.kind === 'image' && job.operation === 'image-to-image') return 'flux.image.image-to-image';
  if (job.kind === 'narration') return 'narration.unassigned';
  if (job.kind === 'package') return 'internal.package';
  return null;
}

function unitsFor(job, price) {
  if (price.unit === 'second') return job.duration_seconds;
  if (price.unit === 'image') return job.count ?? 1;
  if (price.unit === 'package' || price.unit === 'request') return job.count ?? 1;
  return null;
}

export function estimateJobCost(job, { catalog = PRICING_CATALOG } = {}) {
  const pricingKey = inferPricingKey(job);
  const price = pricingKey ? catalog[pricingKey] : null;
  if (!price || price.status === 'unpriced') {
    return {
      pricing_status: 'unpriced',
      pricing_key: pricingKey,
      low_credits: 0,
      high_credits: 0,
      basis: price?.basis ?? 'No approved pricing rule matches this job.',
    };
  }
  const units = unitsFor(job, price);
  if (!Number.isInteger(units) || units < price.min_units || units > price.max_units) {
    throw new BudgetError(`Invalid units for ${pricingKey}`, {
      job_id: job.job_id,
      units,
      minimum: price.min_units,
      maximum: price.max_units,
    });
  }
  const lowMicros = units * price.low_micros_per_unit;
  const highMicros = units * price.high_micros_per_unit;
  return {
    pricing_status: 'priced',
    pricing_key: pricingKey,
    low_credits: fromMicros(lowMicros),
    high_credits: fromMicros(highMicros),
    basis: price.basis,
  };
}

export function priceJobs(jobs, options) {
  return jobs.map((job) => ({ ...job, cost: estimateJobCost(job, options) }));
}

export function estimatePlan(jobs, {
  contingencyPct = 15,
  pricingVersion = PRICING_VERSION,
  catalog = PRICING_CATALOG,
} = {}) {
  assertNonNegative(contingencyPct, 'contingencyPct');
  if (contingencyPct > 100) throw new RangeError('contingencyPct cannot exceed 100');

  const pricedJobs = priceJobs(jobs, { catalog });
  let lowMicros = 0;
  let highMicros = 0;
  const unpricedJobIds = [];
  for (const job of pricedJobs) {
    if (job.cost.pricing_status === 'unpriced') {
      unpricedJobIds.push(job.job_id);
      continue;
    }
    lowMicros += toMicros(job.cost.low_credits);
    highMicros += toMicros(job.cost.high_credits);
  }
  const contingencyMicros = Math.ceil(highMicros * contingencyPct / 100);
  const withContingencyMicros = highMicros + contingencyMicros;
  return {
    jobs: pricedJobs,
    budget: {
      unit: 'credits',
      pricing_version: pricingVersion,
      estimate_low_credits: fromMicros(lowMicros),
      estimate_high_credits: fromMicros(highMicros),
      contingency_pct: contingencyPct,
      contingency_credits: fromMicros(contingencyMicros),
      estimate_with_contingency_credits: fromMicros(withContingencyMicros),
      requested_ceiling_credits: unpricedJobIds.length === 0 ? fromMicros(withContingencyMicros) : null,
      unpriced_job_ids: unpricedJobIds,
    },
  };
}

const COMPLETED_CURRENT_STATES = new Set([
  'provider_completed',
  'downloading',
  'downloaded',
  'validating',
  'awaiting_human_review',
  'approved',
]);
const FAILED_STATES = new Set([
  'submission_failed',
  'provider_failed',
  'provider_cancelled',
  'polling_failed',
  'timed_out',
  'download_failed',
  'validation_failed',
  'automated_qc_failed',
  'human_review_rejected',
  'archived',
]);
const IN_FLIGHT_STATES = new Set([
  'submitting',
  'submitted',
  'provider_pending',
  'provider_processing',
]);

export function summarizeAttemptLedger(attempts, { reservedCredits = 0 } = {}) {
  assertNonNegative(reservedCredits, 'reservedCredits');
  let grossMicros = 0;
  let completedCurrentMicros = 0;
  let failedArchivedMicros = 0;
  let inFlightCurrentMicros = 0;
  let refundsConfirmedMicros = 0;
  let refundUnknownMicros = 0;

  for (const attempt of attempts) {
    const gross = attempt.provider_declared_gross_credits ?? 0;
    const refund = attempt.refund_confirmed_credits ?? 0;
    assertNonNegative(gross, 'provider_declared_gross_credits');
    assertNonNegative(refund, 'refund_confirmed_credits');
    const grossPart = toMicros(gross);
    const refundPart = toMicros(refund);
    grossMicros += grossPart;
    refundsConfirmedMicros += refundPart;

    const current = attempt.current !== false && attempt.state !== 'archived';
    if (current && COMPLETED_CURRENT_STATES.has(attempt.state)) completedCurrentMicros += grossPart;
    if (current && IN_FLIGHT_STATES.has(attempt.state)) inFlightCurrentMicros += grossPart;
    if (!current || FAILED_STATES.has(attempt.state)) {
      failedArchivedMicros += grossPart;
      if (attempt.refund_status !== 'confirmed') refundUnknownMicros += Math.max(0, grossPart - refundPart);
    }
  }

  const netConfirmedMicros = Math.max(0, grossMicros - refundsConfirmedMicros);
  const reservedMicros = toMicros(reservedCredits);
  return {
    unit: 'credits',
    provider_declared_gross_credits: fromMicros(grossMicros),
    completed_current_credits: fromMicros(completedCurrentMicros),
    in_flight_current_credits: fromMicros(inFlightCurrentMicros),
    failed_archived_credits: fromMicros(failedArchivedMicros),
    refunds_confirmed_credits: fromMicros(refundsConfirmedMicros),
    refund_unknown_credits: fromMicros(refundUnknownMicros),
    net_confirmed_exposure_credits: fromMicros(netConfirmedMicros),
    reserved_credits: fromMicros(reservedMicros),
    projected_committed_credits: fromMicros(netConfirmedMicros + reservedMicros),
  };
}

export function assertBudgetAvailable({
  approvedCeilingCredits,
  ledger,
  requestedCredits,
}) {
  assertNonNegative(approvedCeilingCredits, 'approvedCeilingCredits');
  assertNonNegative(requestedCredits, 'requestedCredits');
  const committed = ledger.net_confirmed_exposure_credits + ledger.reserved_credits;
  const projected = committed + requestedCredits;
  if (projected > approvedCeilingCredits + Number.EPSILON) {
    throw new BudgetError('Approved budget ceiling would be exceeded', {
      approved_ceiling_credits: approvedCeilingCredits,
      committed_credits: committed,
      requested_credits: requestedCredits,
      projected_credits: projected,
    });
  }
  return {
    approved_ceiling_credits: approvedCeilingCredits,
    committed_credits: Number(committed.toFixed(6)),
    requested_credits: requestedCredits,
    remaining_after_reservation_credits: Number((approvedCeilingCredits - projected).toFixed(6)),
  };
}
