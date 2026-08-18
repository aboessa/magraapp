import { createHash } from 'node:crypto';

import { approvedVisualIdentityPack } from './visual-identity-registry.mjs';

export const SCHEMA_VERSION = 'content-factory.production-manifest/v1';
export const PIPELINE_PROFILES = Object.freeze([
  'cartoon_video_model_audio',
  'motion_story_video',
  'illustrated_read_to_me',
  'live_action',
]);
export const ENTITY_TYPES = Object.freeze(['episode', 'story', 'story_page']);
export const PIPELINE_ELIGIBILITY = Object.freeze([
  'ready',
  'plannable',
  'blocked',
  'excluded',
]);
export const VISUAL_IDENTITY_PROFILES = Object.freeze([
  'cartoon_video_model_audio',
  'motion_story_video',
  'illustrated_read_to_me',
]);
export const VISUAL_REFERENCE_KINDS = Object.freeze([
  'character_sheet',
  'world_sheet',
  'prop_sheet',
  'style_frame',
  'visual_guide',
]);

const SHA256_RE = /^[a-f0-9]{64}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]+$/;
const SECRET_KEY_RE = /(?:api[_-]?key|authorization|password|secret|access[_-]?token|refresh[_-]?token)/i;
const SECRET_VALUE_RE = /(?:api[_-]?key|access[_-]?token|secret|signature)=/i;

export class ContractError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ContractError';
    this.errors = errors;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON cannot contain non-finite numbers');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) throw new TypeError('Canonical JSON only supports plain objects and arrays');

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      if (value[key] !== undefined) result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(value) {
  const bytes = Buffer.isBuffer(value) || value instanceof Uint8Array
    ? value
    : Buffer.from(typeof value === 'string' ? value : canonicalJson(value), 'utf8');
  return createHash('sha256').update(bytes).digest('hex');
}

export function sourceSha256(sourceBytes) {
  if (sourceBytes === undefined || sourceBytes === null) {
    throw new TypeError('sourceBytes are required to compute a source hash');
  }
  return sha256Hex(sourceBytes);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function visualIdentityProjection(visualIdentity) {
  const references = Array.isArray(visualIdentity?.references)
    ? visualIdentity.references
      .map((reference) => ({
        kind: reference?.kind,
        path: reference?.path,
        sha256: reference?.sha256,
      }))
      .sort((left, right) => {
        const leftKey = `${left.kind}\u0000${left.path}\u0000${left.sha256}`;
        const rightKey = `${right.kind}\u0000${right.path}\u0000${right.sha256}`;
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      })
    : [];
  return {
    identity_id: visualIdentity?.identity_id,
    version: visualIdentity?.version,
    series_slug: visualIdentity?.series_slug,
    references,
  };
}

export function computeReferencePackSha256(visualIdentity) {
  return sha256Hex(visualIdentityProjection(visualIdentity));
}

function planProjection(manifest) {
  return {
    schema_version: manifest.schema_version,
    manifest_id: manifest.manifest_id,
    revision: manifest.revision,
    entity: manifest.entity,
    visual_identity: manifest.visual_identity,
    source: manifest.source,
    pipeline: manifest.pipeline,
    preflight: manifest.preflight,
    jobs: manifest.jobs,
    budget: manifest.budget,
    quality: manifest.quality,
    blockers: manifest.blockers,
  };
}

export function computePlanSha256(manifest) {
  return sha256Hex(planProjection(manifest));
}

export function buildIdempotencyKey({
  manifestId,
  revision,
  sourceHash,
  pipelineProfile,
  visualIdentityPackSha256 = null,
  job,
}) {
  const digest = sha256Hex({
    manifest_id: manifestId,
    revision,
    source_sha256: sourceHash,
    pipeline_profile: pipelineProfile,
    visual_identity_pack_sha256: visualIdentityPackSha256,
    job_id: job.job_id,
    kind: job.kind,
    provider: job.provider,
    operation: job.operation,
    dependencies: job.dependencies ?? [],
    duration_seconds: job.duration_seconds ?? null,
    count: job.count ?? null,
    page_index: job.page_index ?? null,
    input: job.input ?? {},
  });
  return `cf-v1-${digest}`;
}

function normalizeManifest(input) {
  const revision = input.revision ?? 1;
  const visualIdentity = clone(input.visual_identity ?? null);
  const source = {
    path: input.source?.path,
    sha256: input.source?.sha256,
    content_status: input.source?.content_status ?? 'draft',
    duration_seconds: input.source?.duration_seconds ?? null,
    page_count: input.source?.page_count ?? null,
    reviews: clone(input.source?.reviews ?? []),
  };
  const pipeline = {
    profile: input.pipeline?.profile,
    eligibility: input.pipeline?.eligibility ?? 'plannable',
    exclusion_code: input.pipeline?.exclusion_code ?? null,
    ...(input.pipeline?.notes ? { notes: input.pipeline.notes } : {}),
  };
  const jobs = clone(input.jobs ?? []).map((job) => {
    const normalized = {
      ...job,
      state: 'planned',
      dependencies: clone(job.dependencies ?? []),
      input: clone(job.input ?? {}),
    };
    normalized.idempotency_key = buildIdempotencyKey({
      manifestId: input.manifest_id,
      revision,
      sourceHash: source.sha256,
      pipelineProfile: pipeline.profile,
      visualIdentityPackSha256: visualIdentity?.reference_pack_sha256 ?? null,
      job: normalized,
    });
    return normalized;
  });

  const manifest = {
    schema_version: SCHEMA_VERSION,
    manifest_id: input.manifest_id,
    revision,
    entity: clone(input.entity),
    visual_identity: visualIdentity,
    source,
    pipeline,
    preflight: {
      manifest_ready: input.preflight?.manifest_ready ?? false,
      scene_plan_ready: input.preflight?.scene_plan_ready ?? false,
      prompt_plan_ready: input.preflight?.prompt_plan_ready ?? false,
    },
    jobs,
    budget: {
      unit: 'credits',
      pricing_version: input.budget?.pricing_version ?? 'unpriced',
      estimate_low_credits: input.budget?.estimate_low_credits ?? 0,
      estimate_high_credits: input.budget?.estimate_high_credits ?? 0,
      contingency_pct: input.budget?.contingency_pct ?? 0,
      contingency_credits: input.budget?.contingency_credits ?? 0,
      estimate_with_contingency_credits:
        input.budget?.estimate_with_contingency_credits ?? input.budget?.estimate_high_credits ?? 0,
      requested_ceiling_credits: input.budget?.requested_ceiling_credits ?? null,
      unpriced_job_ids: clone(input.budget?.unpriced_job_ids ?? []),
    },
    quality: clone(input.quality ?? {
      policy_version: 'content-factory.qc/v1',
      automated_gates: [],
      human_gates: [],
    }),
    blockers: clone(input.blockers ?? []),
    integrity: {
      source_sha256: source.sha256,
      plan_sha256: '',
    },
    spend_approval: clone(input.spend_approval ?? null),
    ...(input.metadata ? { metadata: clone(input.metadata) } : {}),
  };
  manifest.integrity.plan_sha256 = computePlanSha256(manifest);
  return manifest;
}

function pushError(errors, path, code, message) {
  errors.push({ path, code, message });
}

function validateId(value, path, errors) {
  if (typeof value !== 'string' || value.length < 3 || value.length > 160 || !ID_RE.test(value)) {
    pushError(errors, path, 'INVALID_ID', 'Expected a 3-160 character stable identifier');
  }
}

function validateCredits(value, path, errors, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    pushError(errors, path, 'INVALID_CREDITS', 'Expected a finite non-negative credit amount');
  }
}

function validateVisualIdentity(manifest, errors) {
  const required = VISUAL_IDENTITY_PROFILES.includes(manifest.pipeline?.profile);
  const identity = manifest.visual_identity;
  if (!isPlainObject(identity)) {
    if (required) {
      pushError(
        errors,
        '$.visual_identity',
        'VISUAL_IDENTITY_REQUIRED',
        'Visual generation requires an approved, fingerprinted series reference pack',
      );
    }
    return;
  }

  validateId(identity.identity_id, '$.visual_identity.identity_id', errors);
  validateId(identity.version, '$.visual_identity.version', errors);
  validateId(identity.series_slug, '$.visual_identity.series_slug', errors);
  if (identity.series_slug !== manifest.entity?.series_slug) {
    pushError(
      errors,
      '$.visual_identity.series_slug',
      'VISUAL_IDENTITY_SERIES_MISMATCH',
      'Reference pack series_slug must match entity.series_slug',
    );
  }
  if (identity.status !== 'approved') {
    pushError(
      errors,
      '$.visual_identity.status',
      'VISUAL_IDENTITY_UNAPPROVED',
      'Reference pack status must be approved before planning or dispatch',
    );
  }

  const references = identity.references;
  if (!Array.isArray(references) || references.length === 0) {
    pushError(
      errors,
      '$.visual_identity.references',
      'VISUAL_IDENTITY_REFERENCES_REQUIRED',
      'Reference pack must contain at least one immutable reference',
    );
  } else {
    const seen = new Set();
    let hasCharacterSheet = false;
    let hasVisualGuide = false;
    references.forEach((reference, index) => {
      const path = `$.visual_identity.references[${index}]`;
      if (!isPlainObject(reference)) {
        pushError(errors, path, 'INVALID_VISUAL_REFERENCE', 'Visual reference must be an object');
        return;
      }
      if (!VISUAL_REFERENCE_KINDS.includes(reference.kind)) {
        pushError(errors, `${path}.kind`, 'INVALID_VISUAL_REFERENCE_KIND', 'Unsupported visual reference kind');
      }
      if (reference.kind === 'character_sheet') hasCharacterSheet = true;
      if (reference.kind === 'visual_guide') hasVisualGuide = true;
      const referencePath = reference.path;
      const segments = typeof referencePath === 'string' ? referencePath.split('/') : [];
      if (typeof referencePath !== 'string'
        || referencePath.length === 0
        || referencePath.length > 500
        || referencePath.startsWith('/')
        || referencePath.includes('\\')
        || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(referencePath)
        || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
        pushError(
          errors,
          `${path}.path`,
          'INVALID_VISUAL_REFERENCE_PATH',
          'Reference path must be a repository-relative POSIX path without traversal or URLs',
        );
      }
      if (!SHA256_RE.test(reference.sha256 ?? '')) {
        pushError(
          errors,
          `${path}.sha256`,
          'INVALID_VISUAL_REFERENCE_HASH',
          'Reference SHA-256 must be a lowercase 64-character hex value',
        );
      }
      const key = `${reference.kind}\u0000${referencePath}`;
      if (seen.has(key)) {
        pushError(errors, path, 'DUPLICATE_VISUAL_REFERENCE', 'Reference kind and path must be unique');
      }
      seen.add(key);
    });
    if (!hasCharacterSheet) {
      pushError(
        errors,
        '$.visual_identity.references',
        'VISUAL_IDENTITY_CHARACTER_SHEET_REQUIRED',
        'Every visual series reference pack needs at least one character_sheet',
      );
    }
    if (!hasVisualGuide) {
      pushError(
        errors,
        '$.visual_identity.references',
        'VISUAL_IDENTITY_GUIDE_REQUIRED',
        'Every visual series reference pack needs a visual_guide for style, world, props, camera, and audio locks',
      );
    }
  }

  if (!SHA256_RE.test(identity.reference_pack_sha256 ?? '')) {
    pushError(
      errors,
      '$.visual_identity.reference_pack_sha256',
      'INVALID_REFERENCE_PACK_HASH',
      'Reference pack SHA-256 must be a lowercase 64-character hex value',
    );
  } else if (identity.reference_pack_sha256 !== computeReferencePackSha256(identity)) {
    pushError(
      errors,
      '$.visual_identity.reference_pack_sha256',
      'VISUAL_IDENTITY_PACK_HASH_MISMATCH',
      'Reference pack fingerprint is stale or does not match its references',
    );
  }
  const registeredPack = approvedVisualIdentityPack(identity.series_slug, identity.version);
  if (!registeredPack) {
    pushError(
      errors,
      '$.visual_identity',
      'VISUAL_IDENTITY_NOT_REGISTERED',
      'No trusted approved reference pack is registered for this series and visual version',
    );
  } else if (registeredPack.identity_id !== identity.identity_id
    || registeredPack.reference_pack_sha256 !== identity.reference_pack_sha256
    || registeredPack.approved_by !== identity.approved_by
    || registeredPack.approved_at !== identity.approved_at) {
    pushError(
      errors,
      '$.visual_identity',
      'VISUAL_IDENTITY_REGISTRY_MISMATCH',
      'Manifest visual identity does not match the trusted versioned registry entry',
    );
  }
  validateId(identity.approved_by, '$.visual_identity.approved_by', errors);
  if (typeof identity.approved_at !== 'string' || !Number.isFinite(Date.parse(identity.approved_at))) {
    pushError(
      errors,
      '$.visual_identity.approved_at',
      'INVALID_VISUAL_IDENTITY_APPROVAL_DATE',
      'approved_at must be an ISO date-time',
    );
  }
}

function findSecrets(value, path = '$', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSecrets(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isPlainObject(value)) {
    if (typeof value === 'string' && SECRET_VALUE_RE.test(value)) findings.push(path);
    return findings;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (SECRET_KEY_RE.test(key)) findings.push(childPath);
    findSecrets(child, childPath, findings);
  }
  return findings;
}

function approvalPayload(approval) {
  return {
    approval_id: approval.approval_id,
    status: approval.status,
    plan_sha256: approval.plan_sha256,
    ceiling_credits: approval.ceiling_credits,
    approved_by: approval.approved_by,
    approved_at: approval.approved_at,
    expires_at: approval.expires_at ?? null,
  };
}

export function computeApprovalSha256(approval) {
  return sha256Hex(approvalPayload(approval));
}

export function verifySpendApproval(manifest, { now = new Date() } = {}) {
  const errors = [];
  const approval = manifest?.spend_approval;
  if (!approval) {
    pushError(errors, '$.spend_approval', 'SPEND_NOT_APPROVED', 'A fingerprinted spend approval is required');
    return { valid: false, errors };
  }
  if (approval.status !== 'approved') {
    pushError(errors, '$.spend_approval.status', 'SPEND_NOT_APPROVED', 'Spend approval status must be approved');
  }
  if (approval.plan_sha256 !== manifest.integrity?.plan_sha256) {
    pushError(errors, '$.spend_approval.plan_sha256', 'APPROVAL_PLAN_MISMATCH', 'Approval does not match this immutable plan');
  }
  if (approval.approval_sha256 !== computeApprovalSha256(approval)) {
    pushError(errors, '$.spend_approval.approval_sha256', 'APPROVAL_FINGERPRINT_MISMATCH', 'Spend approval fingerprint is invalid');
  }
  validateCredits(approval.ceiling_credits, '$.spend_approval.ceiling_credits', errors);
  const approvedAt = Date.parse(approval.approved_at);
  if (!Number.isFinite(approvedAt)) {
    pushError(errors, '$.spend_approval.approved_at', 'INVALID_APPROVAL_DATE', 'approved_at must be an ISO date-time');
  }
  if (approval.expires_at !== null && approval.expires_at !== undefined) {
    const expiry = Date.parse(approval.expires_at);
    if (!Number.isFinite(expiry)) {
      pushError(errors, '$.spend_approval.expires_at', 'INVALID_APPROVAL_EXPIRY', 'expires_at must be an ISO date-time or null');
    } else if (expiry <= now.getTime()) {
      pushError(errors, '$.spend_approval.expires_at', 'APPROVAL_EXPIRED', 'Spend approval has expired');
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateManifest(manifest, { verifyIntegrity = true } = {}) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(manifest)) {
    return {
      valid: false,
      errors: [{ path: '$', code: 'INVALID_MANIFEST', message: 'Manifest must be a plain object' }],
      warnings,
    };
  }

  if (manifest.schema_version !== SCHEMA_VERSION) {
    pushError(errors, '$.schema_version', 'UNSUPPORTED_SCHEMA', `Expected ${SCHEMA_VERSION}`);
  }
  validateId(manifest.manifest_id, '$.manifest_id', errors);
  if (!Number.isInteger(manifest.revision) || manifest.revision < 1) {
    pushError(errors, '$.revision', 'INVALID_REVISION', 'Revision must be a positive integer');
  }

  if (!isPlainObject(manifest.entity)) {
    pushError(errors, '$.entity', 'INVALID_ENTITY', 'Entity is required');
  } else {
    if (!ENTITY_TYPES.includes(manifest.entity.entity_type)) {
      pushError(errors, '$.entity.entity_type', 'INVALID_ENTITY_TYPE', 'Unsupported entity type');
    }
    validateId(manifest.entity.entity_id, '$.entity.entity_id', errors);
    validateId(manifest.entity.planet_slug, '$.entity.planet_slug', errors);
    validateId(manifest.entity.series_slug, '$.entity.series_slug', errors);
    if (typeof manifest.entity.locale !== 'string' || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(manifest.entity.locale)) {
      pushError(errors, '$.entity.locale', 'INVALID_LOCALE', 'Locale must use a language or language-region tag');
    }
    if (Number.isInteger(manifest.entity.age_min) && Number.isInteger(manifest.entity.age_max)
      && manifest.entity.age_min > manifest.entity.age_max) {
      pushError(errors, '$.entity.age_min', 'INVALID_AGE_RANGE', 'age_min cannot exceed age_max');
    }
  }

  if (!isPlainObject(manifest.source)) {
    pushError(errors, '$.source', 'INVALID_SOURCE', 'Source descriptor is required');
  } else {
    if (typeof manifest.source.path !== 'string' || manifest.source.path.length === 0) {
      pushError(errors, '$.source.path', 'INVALID_SOURCE_PATH', 'Source path is required');
    }
    if (!SHA256_RE.test(manifest.source.sha256 ?? '')) {
      pushError(errors, '$.source.sha256', 'INVALID_SOURCE_HASH', 'Source SHA-256 must be a lowercase 64-character hex value');
    }
    if (!Array.isArray(manifest.source.reviews)) {
      pushError(errors, '$.source.reviews', 'INVALID_REVIEWS', 'Source reviews must be an array');
    } else {
      manifest.source.reviews.forEach((review, index) => {
        if (!isPlainObject(review) || typeof review.review_type !== 'string') {
          pushError(errors, `$.source.reviews[${index}]`, 'INVALID_REVIEW', 'Each source review needs a review_type');
          return;
        }
        if (review.required && review.status === 'approved' && review.source_sha256 !== manifest.source.sha256) {
          pushError(errors, `$.source.reviews[${index}].source_sha256`, 'STALE_SOURCE_REVIEW', 'Approved review must fingerprint the current source');
        }
      });
    }
  }

  if (!isPlainObject(manifest.pipeline) || !PIPELINE_PROFILES.includes(manifest.pipeline?.profile)) {
    pushError(errors, '$.pipeline.profile', 'INVALID_PIPELINE_PROFILE', 'An explicit supported pipeline profile is required');
  }
  if (!PIPELINE_ELIGIBILITY.includes(manifest.pipeline?.eligibility)) {
    pushError(errors, '$.pipeline.eligibility', 'INVALID_PIPELINE_ELIGIBILITY', 'Unsupported pipeline eligibility');
  }

  validateVisualIdentity(manifest, errors);

  if (!isPlainObject(manifest.preflight)) {
    pushError(errors, '$.preflight', 'INVALID_PREFLIGHT', 'Preflight readiness is required');
  } else {
    for (const field of ['manifest_ready', 'scene_plan_ready', 'prompt_plan_ready']) {
      if (typeof manifest.preflight[field] !== 'boolean') {
        pushError(errors, `$.preflight.${field}`, 'INVALID_PREFLIGHT_FLAG', `${field} must be boolean`);
      }
    }
  }

  if (!Array.isArray(manifest.jobs)) {
    pushError(errors, '$.jobs', 'INVALID_JOBS', 'Jobs must be an array');
  } else {
    const jobIds = new Set();
    const idempotencyKeys = new Set();
    manifest.jobs.forEach((job, index) => {
      const path = `$.jobs[${index}]`;
      if (!isPlainObject(job)) {
        pushError(errors, path, 'INVALID_JOB', 'Job must be an object');
        return;
      }
      validateId(job.job_id, `${path}.job_id`, errors);
      if (jobIds.has(job.job_id)) pushError(errors, `${path}.job_id`, 'DUPLICATE_JOB_ID', 'Job IDs must be unique');
      jobIds.add(job.job_id);
      if (!['video', 'image', 'narration', 'package'].includes(job.kind)) {
        pushError(errors, `${path}.kind`, 'INVALID_JOB_KIND', 'Unsupported job kind');
      }
      if (job.state !== 'planned') pushError(errors, `${path}.state`, 'MUTABLE_STATE_IN_MANIFEST', 'Manifest jobs must stay planned; runtime state belongs in attempts');
      if (typeof job.provider !== 'string' || !job.provider) pushError(errors, `${path}.provider`, 'INVALID_PROVIDER', 'Provider is required');
      if (typeof job.operation !== 'string' || !job.operation) pushError(errors, `${path}.operation`, 'INVALID_OPERATION', 'Operation is required');
      if (typeof job.idempotency_key !== 'string' || job.idempotency_key.length < 16) {
        pushError(errors, `${path}.idempotency_key`, 'INVALID_IDEMPOTENCY_KEY', 'A stable idempotency key is required');
      } else if (idempotencyKeys.has(job.idempotency_key)) {
        pushError(errors, `${path}.idempotency_key`, 'DUPLICATE_IDEMPOTENCY_KEY', 'Idempotency keys must be unique');
      }
      idempotencyKeys.add(job.idempotency_key);
      const expectedIdempotencyKey = buildIdempotencyKey({
        manifestId: manifest.manifest_id,
        revision: manifest.revision,
        sourceHash: manifest.source?.sha256,
        pipelineProfile: manifest.pipeline?.profile,
        visualIdentityPackSha256: manifest.visual_identity?.reference_pack_sha256 ?? null,
        job,
      });
      if (job.idempotency_key !== expectedIdempotencyKey) {
        pushError(
          errors,
          `${path}.idempotency_key`,
          'IDEMPOTENCY_KEY_MISMATCH',
          'Job idempotency key must fingerprint the current source, pipeline, and visual identity pack',
        );
      }
      if (!Array.isArray(job.dependencies)) pushError(errors, `${path}.dependencies`, 'INVALID_DEPENDENCIES', 'Dependencies must be an array');
      if (!isPlainObject(job.input)) pushError(errors, `${path}.input`, 'INVALID_JOB_INPUT', 'Job input must be an object');
      if (job.kind === 'video' && job.provider === 'flux'
        && (!Number.isInteger(job.duration_seconds) || job.duration_seconds < 5 || job.duration_seconds > 20)) {
        pushError(errors, `${path}.duration_seconds`, 'INVALID_FLUX_DURATION', 'FLUX video clips must be 5-20 seconds');
      }
      if (!isPlainObject(job.cost)) {
        pushError(errors, `${path}.cost`, 'INVALID_JOB_COST', 'Every job requires an explicit priced, unpriced, or excluded cost');
      } else {
        if (!['priced', 'unpriced', 'excluded'].includes(job.cost.pricing_status)) {
          pushError(errors, `${path}.cost.pricing_status`, 'INVALID_PRICING_STATUS', 'Unsupported pricing status');
        }
        validateCredits(job.cost.low_credits, `${path}.cost.low_credits`, errors);
        validateCredits(job.cost.high_credits, `${path}.cost.high_credits`, errors);
        if (Number.isFinite(job.cost.low_credits) && Number.isFinite(job.cost.high_credits)
          && job.cost.low_credits > job.cost.high_credits) {
          pushError(errors, `${path}.cost`, 'INVALID_COST_RANGE', 'Low estimate cannot exceed high estimate');
        }
      }
    });
    manifest.jobs.forEach((job, index) => {
      for (const dependency of job.dependencies ?? []) {
        if (!jobIds.has(dependency)) {
          pushError(errors, `$.jobs[${index}].dependencies`, 'UNKNOWN_DEPENDENCY', `Unknown dependency: ${dependency}`);
        }
        if (dependency === job.job_id) {
          pushError(errors, `$.jobs[${index}].dependencies`, 'SELF_DEPENDENCY', 'A job cannot depend on itself');
        }
      }
    });
  }

  if (!isPlainObject(manifest.budget)) {
    pushError(errors, '$.budget', 'INVALID_BUDGET', 'Budget is required');
  } else {
    for (const field of [
      'estimate_low_credits',
      'estimate_high_credits',
      'contingency_credits',
      'estimate_with_contingency_credits',
    ]) validateCredits(manifest.budget[field], `$.budget.${field}`, errors);
    validateCredits(manifest.budget.requested_ceiling_credits, '$.budget.requested_ceiling_credits', errors, { nullable: true });
    if (manifest.budget.estimate_low_credits > manifest.budget.estimate_high_credits) {
      pushError(errors, '$.budget', 'INVALID_BUDGET_RANGE', 'Low estimate cannot exceed high estimate');
    }
    if (manifest.budget.estimate_with_contingency_credits < manifest.budget.estimate_high_credits) {
      pushError(errors, '$.budget.estimate_with_contingency_credits', 'INVALID_CONTINGENCY', 'Estimate with contingency cannot be below the high estimate');
    }
    if (manifest.budget.requested_ceiling_credits !== null
      && manifest.budget.requested_ceiling_credits < manifest.budget.estimate_with_contingency_credits) {
      pushError(errors, '$.budget.requested_ceiling_credits', 'CEILING_BELOW_PLAN', 'Requested ceiling must cover the high estimate plus contingency');
    }
    if (!Array.isArray(manifest.budget.unpriced_job_ids)) {
      pushError(errors, '$.budget.unpriced_job_ids', 'INVALID_UNPRICED_JOBS', 'unpriced_job_ids must be an array');
    }
  }

  if (!isPlainObject(manifest.quality)
    || !Array.isArray(manifest.quality.automated_gates)
    || !Array.isArray(manifest.quality.human_gates)) {
    pushError(errors, '$.quality', 'INVALID_QUALITY_POLICY', 'A versioned automated and human QC policy is required');
  }
  if (!Array.isArray(manifest.blockers)) {
    pushError(errors, '$.blockers', 'INVALID_BLOCKERS', 'Blockers must be an array');
  }

  if (manifest.pipeline?.profile === 'live_action') {
    if (manifest.pipeline.eligibility !== 'excluded') {
      pushError(errors, '$.pipeline.eligibility', 'LIVE_ACTION_MUST_BE_EXCLUDED', 'Live-action content is inventory-only');
    }
    if ((manifest.jobs?.length ?? 0) !== 0) {
      pushError(errors, '$.jobs', 'LIVE_ACTION_AUTOMATION_FORBIDDEN', 'Live-action content cannot create generation jobs');
    }
  }

  const planet = String(manifest.entity?.planet_slug ?? '').toLowerCase();
  if (planet === 'islamic' || planet === '09-islamic') {
    if ((manifest.jobs?.length ?? 0) !== 0) {
      pushError(errors, '$.jobs', 'RELIGIOUS_GENERATION_FORBIDDEN', 'Unapproved religious shells cannot create jobs');
    }
    if (!(manifest.blockers ?? []).some((blocker) => blocker.code === 'RELIGIOUS_CONTENT_UNAPPROVED')) {
      pushError(errors, '$.blockers', 'RELIGIOUS_BLOCKER_REQUIRED', 'Religious content must carry the hard approval blocker');
    }
  }

  if (manifest.pipeline?.profile === 'illustrated_read_to_me'
    && manifest.pipeline.eligibility === 'ready'
    && Number.isInteger(manifest.source?.page_count)) {
    for (let page = 1; page <= manifest.source.page_count; page += 1) {
      const pageJobs = (manifest.jobs ?? []).filter((job) => job.page_index === page);
      if (!pageJobs.some((job) => job.kind === 'image')) {
        pushError(errors, '$.jobs', 'STORY_PAGE_IMAGE_MISSING', `Page ${page} needs an independent image job`);
      }
      if (!pageJobs.some((job) => job.kind === 'narration')) {
        pushError(errors, '$.jobs', 'STORY_PAGE_NARRATION_MISSING', `Page ${page} needs an independent narration job`);
      }
    }
  }

  const secretPaths = findSecrets(manifest);
  secretPaths.forEach((path) => pushError(errors, path, 'SECRET_IN_MANIFEST', 'Credentials and signed URLs are forbidden in immutable manifests'));

  if (!isPlainObject(manifest.integrity)) {
    pushError(errors, '$.integrity', 'MISSING_INTEGRITY', 'Source and plan fingerprints are required');
  } else {
    if (manifest.integrity.source_sha256 !== manifest.source?.sha256) {
      pushError(errors, '$.integrity.source_sha256', 'SOURCE_HASH_MISMATCH', 'Integrity source hash must match source.sha256');
    }
    if (verifyIntegrity) {
      const expectedPlanHash = computePlanSha256(manifest);
      if (manifest.integrity.plan_sha256 !== expectedPlanHash) {
        pushError(errors, '$.integrity.plan_sha256', 'PLAN_HASH_MISMATCH', 'Manifest content changed after its plan fingerprint was computed');
      }
    }
  }

  if (manifest.spend_approval !== null && manifest.spend_approval !== undefined) {
    const approvalResult = verifySpendApproval(manifest, { now: new Date(0) });
    errors.push(...approvalResult.errors.filter((error) => error.code !== 'APPROVAL_EXPIRED'));
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function assertManifest(manifest, options) {
  const result = validateManifest(manifest, options);
  if (!result.valid) throw new ContractError('Production manifest is invalid', result.errors);
  return manifest;
}

export function createManifest(input) {
  const manifest = normalizeManifest(input);
  assertManifest(manifest);
  return manifest;
}

export function createSpendApproval(manifest, {
  approvalId,
  approvedBy,
  ceilingCredits,
  confirmedPlanSha256,
  approvedAt = new Date().toISOString(),
  expiresAt = null,
} = {}) {
  assertManifest(manifest);
  if (confirmedPlanSha256 !== manifest.integrity.plan_sha256) {
    throw new ContractError('The operator must confirm the exact plan fingerprint', [{
      path: '$.integrity.plan_sha256',
      code: 'PLAN_CONFIRMATION_REQUIRED',
      message: 'confirmedPlanSha256 must exactly match the current plan',
    }]);
  }
  const hardBlockers = manifest.blockers.filter((blocker) => blocker.severity === 'error' || blocker.severity === 'hard_block');
  if (hardBlockers.length > 0) {
    throw new ContractError('Blocked manifests cannot receive spend approval', hardBlockers.map((blocker) => ({
      path: '$.blockers', code: blocker.code, message: blocker.message,
    })));
  }
  if (manifest.budget.unpriced_job_ids.length > 0) {
    throw new ContractError('All paid jobs must be priced before approval', manifest.budget.unpriced_job_ids.map((jobId) => ({
      path: '$.budget.unpriced_job_ids', code: 'UNPRICED_JOB', message: jobId,
    })));
  }
  if (!Number.isFinite(ceilingCredits) || ceilingCredits < manifest.budget.estimate_with_contingency_credits) {
    throw new ContractError('Approved ceiling is below the plan plus contingency', [{
      path: '$.spend_approval.ceiling_credits',
      code: 'CEILING_BELOW_PLAN',
      message: `Ceiling must be at least ${manifest.budget.estimate_with_contingency_credits} credits`,
    }]);
  }
  if (typeof approvedBy !== 'string' || approvedBy.trim() === '') {
    throw new ContractError('approvedBy is required');
  }

  const approval = {
    approval_id: approvalId ?? `approval-${manifest.integrity.plan_sha256.slice(0, 24)}`,
    status: 'approved',
    plan_sha256: manifest.integrity.plan_sha256,
    ceiling_credits: ceilingCredits,
    approved_by: approvedBy,
    approved_at: approvedAt,
    expires_at: expiresAt,
  };
  approval.approval_sha256 = computeApprovalSha256(approval);
  const approvedManifest = clone(manifest);
  approvedManifest.spend_approval = approval;
  assertManifest(approvedManifest);
  return approvedManifest;
}

export function assertDispatchReady(manifest, {
  allowPaid = false,
  now = new Date(),
  committedGrossCredits = 0,
  confirmedRefundCredits = 0,
  reservedCredits = 0,
  jobIds = null,
} = {}) {
  assertManifest(manifest);
  const errors = [];
  if (allowPaid !== true) {
    pushError(errors, '$.allow_paid', 'PAID_FLAG_REQUIRED', 'Paid dispatch requires the explicit --allow-paid flag');
  }
  if (manifest.pipeline.eligibility !== 'ready') {
    pushError(errors, '$.pipeline.eligibility', 'PIPELINE_NOT_READY', 'Pipeline eligibility must be ready');
  }
  if (manifest.pipeline.profile === 'live_action') {
    pushError(errors, '$.pipeline.profile', 'LIVE_ACTION_AUTOMATION_FORBIDDEN', 'Live action is inventory-only');
  }
  for (const blocker of manifest.blockers) {
    if (blocker.severity === 'error' || blocker.severity === 'hard_block') {
      pushError(errors, '$.blockers', blocker.code, blocker.message);
    }
  }
  for (const flag of ['manifest_ready', 'scene_plan_ready', 'prompt_plan_ready']) {
    if (!manifest.preflight[flag]) pushError(errors, `$.preflight.${flag}`, 'PREFLIGHT_NOT_READY', `${flag} must be true`);
  }
  for (const [index, review] of manifest.source.reviews.entries()) {
    if (review.required && review.status !== 'approved' && review.status !== 'not_applicable') {
      pushError(errors, `$.source.reviews[${index}]`, 'SOURCE_REVIEW_PENDING', `${review.review_type} review is not approved`);
    }
    if (review.required && review.status === 'approved' && review.source_sha256 !== manifest.source.sha256) {
      pushError(errors, `$.source.reviews[${index}]`, 'STALE_SOURCE_REVIEW', `${review.review_type} review is stale`);
    }
  }
  if (manifest.budget.unpriced_job_ids.length > 0) {
    pushError(errors, '$.budget.unpriced_job_ids', 'UNPRICED_JOBS', 'Unpriced paid jobs cannot be dispatched');
  }
  const selectedJobs = jobIds === null
    ? manifest.jobs
    : manifest.jobs.filter((job) => jobIds.includes(job.job_id));
  if (selectedJobs.length === 0) pushError(errors, '$.jobs', 'NO_JOBS_SELECTED', 'At least one planned job must be selected');
  if (jobIds !== null && selectedJobs.length !== new Set(jobIds).size) {
    pushError(errors, '$.jobs', 'UNKNOWN_SELECTED_JOB', 'Every selected job ID must exist in the manifest');
  }

  const approvalResult = verifySpendApproval(manifest, { now });
  errors.push(...approvalResult.errors);
  if (approvalResult.valid) {
    const selectedHigh = selectedJobs.reduce((sum, job) => sum + (job.cost?.high_credits ?? 0), 0);
    const confirmedExposure = Math.max(0, committedGrossCredits - confirmedRefundCredits);
    const projectedExposure = confirmedExposure + reservedCredits + selectedHigh;
    if (projectedExposure > manifest.spend_approval.ceiling_credits + Number.EPSILON) {
      pushError(errors, '$.spend_approval.ceiling_credits', 'BUDGET_CEILING_EXCEEDED',
        `Projected exposure ${projectedExposure} exceeds approved ceiling ${manifest.spend_approval.ceiling_credits}`);
    }
  }

  if (errors.length > 0) throw new ContractError('Paid dispatch is not authorized', errors);
  return {
    plan_sha256: manifest.integrity.plan_sha256,
    approved_ceiling_credits: manifest.spend_approval.ceiling_credits,
    selected_job_ids: selectedJobs.map((job) => job.job_id),
  };
}
