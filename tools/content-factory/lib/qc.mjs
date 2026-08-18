import { canonicalJson, sha256Hex } from './contract.mjs';

export const QC_POLICY_VERSION = 'content-factory.qc/v1';

const AUTOMATED_BY_PROFILE = Object.freeze({
  cartoon_video_model_audio: [
    'source_integrity',
    'asset_integrity',
    'video_decodable',
    'video_duration',
    'video_dimensions',
    'model_audio_present',
  ],
  motion_story_video: [
    'source_integrity',
    'asset_integrity',
    'video_decodable',
    'video_duration',
    'video_dimensions',
    'audio_present',
  ],
  illustrated_read_to_me: [
    'source_integrity',
    'package_integrity',
    'story_pages_complete',
    'story_images_decodable',
    'story_narration_complete',
    'story_text_separate',
  ],
  live_action: [],
});

const BASE_HUMAN_GATES = Object.freeze(['creative', 'educational', 'age_safety']);
const SPECIAL_HUMAN_GATES = Object.freeze({
  scientific: 'scientific_accuracy',
  science: 'scientific_accuracy',
  historical: 'historical_accuracy',
  history: 'historical_accuracy',
  sleep: 'sleep_suitability',
  bedtime: 'sleep_suitability',
  religious: 'religious_review',
  islamic: 'religious_review',
});

export class QcError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'QcError';
    this.details = details;
  }
}

function unique(values) {
  return [...new Set(values)];
}

export function createQcPolicy({ profile, tags = [], requireHuman = true } = {}) {
  if (!(profile in AUTOMATED_BY_PROFILE)) throw new TypeError(`Unsupported QC profile: ${profile}`);
  const special = tags
    .map((tag) => SPECIAL_HUMAN_GATES[String(tag).toLowerCase()])
    .filter(Boolean);
  const humanGateIds = profile === 'live_action'
    ? []
    : unique([...(requireHuman ? BASE_HUMAN_GATES : []), ...special]);
  return {
    policy_version: QC_POLICY_VERSION,
    automated_gates: AUTOMATED_BY_PROFILE[profile].map((gateId) => ({
      gate_id: gateId,
      required: true,
      status: 'not_run',
    })),
    human_gates: humanGateIds.map((gateId) => ({
      gate_id: gateId,
      required: true,
      status: 'pending',
    })),
  };
}

function pass(gateId, evidence = {}) {
  return { gate_id: gateId, status: 'passed', evidence };
}

function fail(gateId, message, evidence = {}) {
  return { gate_id: gateId, status: 'failed', message, evidence };
}

function ratioDifference(width, height, expectedRatio) {
  if (!width || !height || !expectedRatio) return Number.POSITIVE_INFINITY;
  return Math.abs(width / height - expectedRatio) / expectedRatio;
}

function evaluateGate(gateId, evidence) {
  switch (gateId) {
    case 'source_integrity':
      return evidence.source_sha256 && evidence.source_sha256 === evidence.expected_source_sha256
        ? pass(gateId, { source_sha256: evidence.source_sha256 })
        : fail(gateId, 'Source fingerprint is missing or stale', {
            expected: evidence.expected_source_sha256 ?? null,
            actual: evidence.source_sha256 ?? null,
          });
    case 'asset_integrity':
      return /^[a-f0-9]{64}$/.test(evidence.asset_sha256 ?? '')
        ? pass(gateId, { asset_sha256: evidence.asset_sha256 })
        : fail(gateId, 'A SHA-256 fingerprint for the generated asset is required');
    case 'video_decodable':
      return evidence.video?.exists === true && evidence.video?.decodable === true && evidence.video?.has_video_stream === true
        ? pass(gateId, { probe_ref: evidence.video.probe_ref ?? null })
        : fail(gateId, 'Video must exist, decode, and contain a video stream');
    case 'video_duration': {
      const actual = evidence.video?.duration_seconds;
      const expected = evidence.video?.expected_duration_seconds;
      const tolerance = evidence.video?.duration_tolerance_seconds ?? Math.max(1, (expected ?? 0) * 0.05);
      return Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= tolerance
        ? pass(gateId, { actual_seconds: actual, expected_seconds: expected, tolerance_seconds: tolerance })
        : fail(gateId, 'Video duration is outside tolerance', {
            actual_seconds: actual ?? null,
            expected_seconds: expected ?? null,
            tolerance_seconds: tolerance,
          });
    }
    case 'video_dimensions': {
      const width = evidence.video?.width;
      const height = evidence.video?.height;
      const expectedRatio = evidence.video?.expected_aspect_ratio ?? 16 / 9;
      const ratioTolerance = evidence.video?.aspect_ratio_tolerance ?? 0.02;
      const minWidth = evidence.video?.minimum_width ?? 1280;
      const minHeight = evidence.video?.minimum_height ?? 720;
      return Number.isInteger(width) && Number.isInteger(height)
        && width >= minWidth && height >= minHeight
        && ratioDifference(width, height, expectedRatio) <= ratioTolerance
        ? pass(gateId, { width, height, expected_aspect_ratio: expectedRatio })
        : fail(gateId, 'Video dimensions or aspect ratio do not meet policy', {
            width: width ?? null,
            height: height ?? null,
            minimum_width: minWidth,
            minimum_height: minHeight,
            expected_aspect_ratio: expectedRatio,
          });
    }
    case 'model_audio_present':
    case 'audio_present':
      return evidence.video?.has_audio_stream === true && evidence.video?.audio_duration_seconds > 0
        ? pass(gateId, { audio_duration_seconds: evidence.video.audio_duration_seconds })
        : fail(gateId, gateId === 'model_audio_present'
          ? 'The original FLUX model-audio stream must be retained'
          : 'An audio stream is required');
    case 'package_integrity':
      return /^[a-f0-9]{64}$/.test(evidence.package_sha256 ?? '')
        ? pass(gateId, { package_sha256: evidence.package_sha256 })
        : fail(gateId, 'Story package needs an immutable SHA-256 fingerprint');
    case 'story_pages_complete': {
      const expected = evidence.story?.expected_page_count;
      const pages = evidence.story?.pages ?? [];
      const indexes = new Set(pages.map((page) => page.page_index));
      const complete = Number.isInteger(expected) && expected > 0
        && pages.length === expected
        && Array.from({ length: expected }, (_, index) => index + 1).every((index) => indexes.has(index));
      return complete
        ? pass(gateId, { expected_page_count: expected, actual_page_count: pages.length })
        : fail(gateId, 'Story package does not contain every expected page exactly once', {
            expected_page_count: expected ?? null,
            actual_page_count: pages.length,
          });
    }
    case 'story_images_decodable': {
      const pages = evidence.story?.pages ?? [];
      const failedPages = pages
        .filter((page) => page.image?.decodable !== true || !/^[a-f0-9]{64}$/.test(page.image?.sha256 ?? ''))
        .map((page) => page.page_index);
      return pages.length > 0 && failedPages.length === 0
        ? pass(gateId, { checked_pages: pages.length })
        : fail(gateId, 'Every page needs an independently decodable, fingerprinted image', { failed_pages: failedPages });
    }
    case 'story_narration_complete': {
      const pages = evidence.story?.pages ?? [];
      const failedPages = pages
        .filter((page) => page.narration?.decodable !== true
          || !/^[a-f0-9]{64}$/.test(page.narration?.sha256 ?? '')
          || !(page.narration?.duration_seconds > 0))
        .map((page) => page.page_index);
      return pages.length > 0 && failedPages.length === 0
        ? pass(gateId, { checked_pages: pages.length })
        : fail(gateId, 'Every page needs independent, decodable narration', { failed_pages: failedPages });
    }
    case 'story_text_separate': {
      const pages = evidence.story?.pages ?? [];
      const failedPages = pages
        .filter((page) => page.text_layer_present !== true || page.text_baked_into_image === true)
        .map((page) => page.page_index);
      return pages.length > 0 && failedPages.length === 0
        ? pass(gateId, { checked_pages: pages.length })
        : fail(gateId, 'Readable story text must remain a separate layer and not be baked into images', { failed_pages: failedPages });
    }
    default:
      return fail(gateId, 'No automated evaluator is registered for this required gate');
  }
}

export function evaluateAutomatedQc(policy, evidence) {
  if (policy?.policy_version !== QC_POLICY_VERSION || !Array.isArray(policy.automated_gates)) {
    throw new QcError('Unsupported or malformed QC policy');
  }
  const results = policy.automated_gates.map((gate) => ({
    ...evaluateGate(gate.gate_id, evidence),
    required: gate.required,
  }));
  const requiredFailures = results.filter((result) => result.required && result.status !== 'passed');
  const projection = {
    policy_version: policy.policy_version,
    plan_sha256: evidence.plan_sha256 ?? null,
    asset_sha256: evidence.asset_sha256 ?? evidence.package_sha256 ?? null,
    results,
  };
  return {
    policy_version: policy.policy_version,
    status: requiredFailures.length === 0 ? 'passed' : 'failed',
    required_passed: requiredFailures.length === 0,
    results,
    evidence_sha256: sha256Hex(projection),
  };
}

function humanReviewPayload(review) {
  return {
    gate_id: review.gate_id,
    decision: review.decision,
    reviewer_id: review.reviewer_id,
    plan_sha256: review.plan_sha256,
    asset_sha256: review.asset_sha256,
    automated_qc_evidence_sha256: review.automated_qc_evidence_sha256,
    reviewed_at: review.reviewed_at,
    notes: review.notes ?? null,
  };
}

export function createHumanReview({
  gateId,
  decision,
  reviewerId,
  planSha256,
  assetSha256,
  automatedQcEvidenceSha256,
  reviewedAt = new Date().toISOString(),
  notes = null,
}) {
  if (!gateId || !reviewerId) throw new TypeError('gateId and reviewerId are required');
  if (!['approved', 'rejected'].includes(decision)) throw new TypeError('decision must be approved or rejected');
  for (const [name, value] of Object.entries({ planSha256, assetSha256, automatedQcEvidenceSha256 })) {
    if (!/^[a-f0-9]{64}$/.test(value ?? '')) throw new TypeError(`${name} must be a SHA-256 fingerprint`);
  }
  if (!Number.isFinite(Date.parse(reviewedAt))) throw new TypeError('reviewedAt must be an ISO date-time');
  const review = {
    gate_id: gateId,
    decision,
    reviewer_id: reviewerId,
    plan_sha256: planSha256,
    asset_sha256: assetSha256,
    automated_qc_evidence_sha256: automatedQcEvidenceSha256,
    reviewed_at: reviewedAt,
    notes,
  };
  review.review_sha256 = sha256Hex(humanReviewPayload(review));
  return review;
}

export function verifyHumanReviews(policy, reviews, {
  planSha256,
  assetSha256,
  automatedQcEvidenceSha256,
} = {}) {
  const errors = [];
  for (const gate of policy.human_gates ?? []) {
    if (!gate.required) continue;
    const review = reviews.find((candidate) => candidate.gate_id === gate.gate_id);
    if (!review) {
      errors.push({ gate_id: gate.gate_id, code: 'REVIEW_MISSING' });
      continue;
    }
    if (review.decision !== 'approved') errors.push({ gate_id: gate.gate_id, code: 'REVIEW_NOT_APPROVED' });
    if (review.plan_sha256 !== planSha256
      || review.asset_sha256 !== assetSha256
      || review.automated_qc_evidence_sha256 !== automatedQcEvidenceSha256) {
      errors.push({ gate_id: gate.gate_id, code: 'REVIEW_CONTEXT_MISMATCH' });
    }
    if (review.review_sha256 !== sha256Hex(humanReviewPayload(review))) {
      errors.push({ gate_id: gate.gate_id, code: 'REVIEW_FINGERPRINT_MISMATCH' });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    reviews_sha256: sha256Hex(canonicalJson(reviews)),
  };
}

export function assertMasterDeliverable({
  automatedQc,
  policy,
  humanReviews,
  planSha256,
  assetSha256,
}) {
  if (automatedQc?.required_passed !== true || automatedQc.status !== 'passed') {
    throw new QcError('Automated QC evidence has not passed', { automatedQc });
  }
  const human = verifyHumanReviews(policy, humanReviews, {
    planSha256,
    assetSha256,
    automatedQcEvidenceSha256: automatedQc.evidence_sha256,
  });
  if (!human.valid) throw new QcError('Required human reviews are incomplete or stale', human);
  return {
    deliverable: true,
    plan_sha256: planSha256,
    asset_sha256: assetSha256,
    automated_qc_evidence_sha256: automatedQc.evidence_sha256,
    human_reviews_sha256: human.reviews_sha256,
    delivery_fingerprint: sha256Hex({
      plan_sha256: planSha256,
      asset_sha256: assetSha256,
      automated_qc_evidence_sha256: automatedQc.evidence_sha256,
      human_reviews_sha256: human.reviews_sha256,
    }),
  };
}
