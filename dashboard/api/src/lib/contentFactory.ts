import { approvedFactoryVisualIdentityPack } from './contentFactoryVisualIdentityRegistry.ts';

export const CONTENT_FACTORY_SCHEMA = 'content-factory.production-manifest/v1' as const;
export const CONTENT_FACTORY_MESSAGE_SCHEMA = 'content-factory.job/v1' as const;
export const MAX_MANIFEST_BYTES = 1_000_000;
export const MAX_FACTORY_JOBS = 1_000;
export const MICROS_PER_CREDIT = 1_000_000;

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SECRET_KEY = /(?:api[_-]?key|authorization|password|secret|access[_-]?token|refresh[_-]?token)/i;
const SECRET_VALUE = /(?:api[_-]?key|access[_-]?token|secret|signature)=/i;
const PROFILES = new Set([
  'cartoon_video_model_audio',
  'motion_story_video',
  'illustrated_read_to_me',
  'live_action',
]);
const ELIGIBILITY = new Set(['ready', 'plannable', 'blocked', 'excluded']);
const ENTITY_TYPES = new Set(['episode', 'story', 'story_page']);
const JOB_KINDS = new Set(['video', 'image', 'narration', 'package']);
const PRICING_STATUS = new Set(['priced', 'unpriced', 'excluded']);
const VISUAL_IDENTITY_PROFILES = new Set([
  'cartoon_video_model_audio',
  'motion_story_video',
  'illustrated_read_to_me',
]);
const VISUAL_REFERENCE_KINDS = new Set([
  'character_sheet',
  'world_sheet',
  'prop_sheet',
  'style_frame',
  'visual_guide',
]);

export class ContentFactoryValidationError extends Error {
  readonly code: string;
  readonly field?: string;

  constructor(message: string, code: string, field?: string) {
    super(message);
    this.name = 'ContentFactoryValidationError';
    this.code = code;
    this.field = field;
  }
}

export type FactoryJob = {
  job_id: string;
  kind: 'video' | 'image' | 'narration' | 'package';
  provider: string;
  operation: string;
  state: 'planned';
  idempotency_key: string;
  dependencies: string[];
  duration_seconds?: number;
  count?: number;
  page_index?: number;
  input: Record<string, unknown>;
  cost: {
    pricing_status: 'priced' | 'unpriced' | 'excluded';
    pricing_key: string | null;
    low_credits: number;
    high_credits: number;
    basis: string;
  };
};

export type FactoryVisualIdentityReference = {
  kind: 'character_sheet' | 'world_sheet' | 'prop_sheet' | 'style_frame' | 'visual_guide';
  path: string;
  sha256: string;
};

export type FactoryVisualIdentity = {
  identity_id: string;
  version: string;
  series_slug: string;
  status: 'approved';
  reference_pack_sha256: string;
  references: FactoryVisualIdentityReference[];
  approved_by: string;
  approved_at: string;
};

export type FactoryManifest = {
  schema_version: typeof CONTENT_FACTORY_SCHEMA;
  manifest_id: string;
  revision: number;
  entity: {
    entity_type: 'episode' | 'story' | 'story_page';
    entity_id: string;
    planet_slug: string;
    series_slug: string;
    locale: string;
    [key: string]: unknown;
  };
  visual_identity: FactoryVisualIdentity | null;
  source: {
    path: string;
    sha256: string;
    content_status: string;
    duration_seconds: number | null;
    page_count: number | null;
    reviews: Array<Record<string, unknown>>;
  };
  pipeline: {
    profile: string;
    eligibility: string;
    exclusion_code: string | null;
    notes?: string;
  };
  preflight: {
    manifest_ready: boolean;
    scene_plan_ready: boolean;
    prompt_plan_ready: boolean;
  };
  jobs: FactoryJob[];
  budget: {
    unit: 'credits';
    pricing_version: string;
    estimate_low_credits: number;
    estimate_high_credits: number;
    contingency_pct: number;
    contingency_credits: number;
    estimate_with_contingency_credits: number;
    requested_ceiling_credits: number | null;
    unpriced_job_ids: string[];
  };
  quality: {
    policy_version: string;
    automated_gates: unknown[];
    human_gates: unknown[];
  };
  blockers: Array<{ code: string; severity: string; message: string; [key: string]: unknown }>;
  integrity: { source_sha256: string; plan_sha256: string };
  spend_approval: unknown;
  metadata?: Record<string, unknown>;
};

export type ParsedFactoryManifest = {
  manifest: FactoryManifest;
  canonical_json: string;
  plan_sha256: string;
  blocker_count: number;
  unpriced_job_count: number;
  estimate_low_micros: number;
  estimate_high_micros: number;
  estimate_with_contingency_micros: number;
};

export type ContentFactoryMessage = {
  schema_version: typeof CONTENT_FACTORY_MESSAGE_SCHEMA;
  action: 'dispatch' | 'resume' | 'retry_failed';
  run_id: string;
  job_id: string;
  plan_sha256: string;
  allow_new_paid_attempt: boolean;
  accept_duplicate_charge_risk: boolean;
};

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentFactoryValidationError(`${field} must be an object`, 'INVALID_OBJECT', field);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new ContentFactoryValidationError(`${field} must be non-empty text up to ${maximum} characters`, 'INVALID_TEXT', field);
  }
  return value;
}

function id(value: unknown, field: string): string {
  const parsed = text(value, field, 160);
  if (!ID.test(parsed)) throw new ContentFactoryValidationError(`${field} is not a stable identifier`, 'INVALID_ID', field);
  return parsed;
}

function sha(value: unknown, field: string): string {
  const parsed = text(value, field, 64);
  if (!SHA256.test(parsed)) throw new ContentFactoryValidationError(`${field} must be lowercase SHA-256`, 'INVALID_SHA256', field);
  return parsed;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new ContentFactoryValidationError(`${field} must be boolean`, 'INVALID_BOOLEAN', field);
  return value;
}

function nonNegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10_000_000) {
    throw new ContentFactoryValidationError(`${field} must be a bounded non-negative number`, 'INVALID_AMOUNT', field);
  }
  return value;
}

export function creditsToMicros(value: unknown, field = 'credits'): number {
  return Math.round(nonNegative(value, field) * MICROS_PER_CREDIT);
}

export function microsToCredits(value: number): number {
  return Number((value / MICROS_PER_CREDIT).toFixed(6));
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ContentFactoryValidationError('Canonical JSON cannot contain non-finite numbers', 'INVALID_NUMBER');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') {
    throw new ContentFactoryValidationError('Canonical JSON supports only JSON values', 'INVALID_JSON');
  }
  return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
    const child = (value as Record<string, unknown>)[key];
    if (child !== undefined) result[key] = canonicalValue(child);
    return result;
  }, {});
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export async function sha256Hex(value: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : value instanceof Uint8Array
      ? value
      : new Uint8Array(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('');
}

function visualIdentityProjection(visualIdentity: FactoryVisualIdentity) {
  const references = visualIdentity.references
    .map((reference) => ({
      kind: reference.kind,
      path: reference.path,
      sha256: reference.sha256,
    }))
    .sort((left, right) => {
      const leftKey = `${left.kind}\u0000${left.path}\u0000${left.sha256}`;
      const rightKey = `${right.kind}\u0000${right.path}\u0000${right.sha256}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  return {
    identity_id: visualIdentity.identity_id,
    version: visualIdentity.version,
    series_slug: visualIdentity.series_slug,
    references,
  };
}

export async function computeReferencePackSha256(visualIdentity: FactoryVisualIdentity): Promise<string> {
  return sha256Hex(canonicalJson(visualIdentityProjection(visualIdentity)));
}

async function expectedJobIdempotencyKey(manifest: FactoryManifest, job: FactoryJob): Promise<string> {
  const digest = await sha256Hex(canonicalJson({
    manifest_id: manifest.manifest_id,
    revision: manifest.revision,
    source_sha256: manifest.source.sha256,
    pipeline_profile: manifest.pipeline.profile,
    visual_identity_pack_sha256: manifest.visual_identity?.reference_pack_sha256 ?? null,
    job_id: job.job_id,
    kind: job.kind,
    provider: job.provider,
    operation: job.operation,
    dependencies: job.dependencies ?? [],
    duration_seconds: job.duration_seconds ?? null,
    count: job.count ?? null,
    page_index: job.page_index ?? null,
    input: job.input ?? {},
  }));
  return `cf-v1-${digest}`;
}

function planProjection(manifest: FactoryManifest) {
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

function findSecret(value: unknown, field = '$', depth = 0): string | null {
  if (depth > 20) return field;
  if (typeof value === 'string') return SECRET_VALUE.test(value) ? field : null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSecret(value[index], `${field}[${index}]`, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) return `${field}.${key}`;
    const found = findSecret(child, `${field}.${key}`, depth + 1);
    if (found) return found;
  }
  return null;
}

async function parseVisualIdentity(
  value: unknown,
  entitySeriesSlug: string,
  profile: string,
): Promise<FactoryVisualIdentity | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (VISUAL_IDENTITY_PROFILES.has(profile)) {
      throw new ContentFactoryValidationError(
        'Visual generation requires an approved, fingerprinted series reference pack',
        'VISUAL_IDENTITY_REQUIRED',
        'visual_identity',
      );
    }
    return null;
  }

  const input = value as Record<string, unknown>;
  const identityId = id(input.identity_id, 'visual_identity.identity_id');
  const version = id(input.version, 'visual_identity.version');
  const seriesSlug = id(input.series_slug, 'visual_identity.series_slug');
  if (seriesSlug !== entitySeriesSlug) {
    throw new ContentFactoryValidationError(
      'Reference pack series_slug must match entity.series_slug',
      'VISUAL_IDENTITY_SERIES_MISMATCH',
      'visual_identity.series_slug',
    );
  }
  if (input.status !== 'approved') {
    throw new ContentFactoryValidationError(
      'Reference pack status must be approved before planning or dispatch',
      'VISUAL_IDENTITY_UNAPPROVED',
      'visual_identity.status',
    );
  }

  if (!Array.isArray(input.references) || input.references.length === 0) {
    throw new ContentFactoryValidationError(
      'Reference pack must contain at least one immutable reference',
      'VISUAL_IDENTITY_REFERENCES_REQUIRED',
      'visual_identity.references',
    );
  }
  const seen = new Set<string>();
  let hasCharacterSheet = false;
  let hasVisualGuide = false;
  const references = input.references.map((value, index) => {
    const reference = record(value, `visual_identity.references[${index}]`);
    const kind = text(reference.kind, `visual_identity.references[${index}].kind`, 40);
    if (!VISUAL_REFERENCE_KINDS.has(kind)) {
      throw new ContentFactoryValidationError(
        'Unsupported visual reference kind',
        'INVALID_VISUAL_REFERENCE_KIND',
        `visual_identity.references[${index}].kind`,
      );
    }
    if (kind === 'character_sheet') hasCharacterSheet = true;
    if (kind === 'visual_guide') hasVisualGuide = true;
    const path = text(reference.path, `visual_identity.references[${index}].path`, 500);
    const segments = path.split('/');
    if (path.startsWith('/')
      || path.includes('\\')
      || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)
      || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
      throw new ContentFactoryValidationError(
        'Reference path must be a repository-relative POSIX path without traversal or URLs',
        'INVALID_VISUAL_REFERENCE_PATH',
        `visual_identity.references[${index}].path`,
      );
    }
    const referenceHash = sha(reference.sha256, `visual_identity.references[${index}].sha256`);
    const key = `${kind}\u0000${path}`;
    if (seen.has(key)) {
      throw new ContentFactoryValidationError(
        'Reference kind and path must be unique',
        'DUPLICATE_VISUAL_REFERENCE',
        `visual_identity.references[${index}]`,
      );
    }
    seen.add(key);
    return { kind, path, sha256: referenceHash } as FactoryVisualIdentityReference;
  });
  if (!hasCharacterSheet) {
    throw new ContentFactoryValidationError(
      'Every visual series reference pack needs at least one character_sheet',
      'VISUAL_IDENTITY_CHARACTER_SHEET_REQUIRED',
      'visual_identity.references',
    );
  }
  if (!hasVisualGuide) {
    throw new ContentFactoryValidationError(
      'Every visual series reference pack needs a visual_guide for style, world, props, camera, and audio locks',
      'VISUAL_IDENTITY_GUIDE_REQUIRED',
      'visual_identity.references',
    );
  }

  const approvedAt = text(input.approved_at, 'visual_identity.approved_at', 100);
  if (!Number.isFinite(Date.parse(approvedAt))) {
    throw new ContentFactoryValidationError(
      'approved_at must be an ISO date-time',
      'INVALID_VISUAL_IDENTITY_APPROVAL_DATE',
      'visual_identity.approved_at',
    );
  }
  const identity: FactoryVisualIdentity = {
    identity_id: identityId,
    version,
    series_slug: seriesSlug,
    status: 'approved',
    reference_pack_sha256: sha(input.reference_pack_sha256, 'visual_identity.reference_pack_sha256'),
    references,
    approved_by: id(input.approved_by, 'visual_identity.approved_by'),
    approved_at: approvedAt,
  };
  if (identity.reference_pack_sha256 !== await computeReferencePackSha256(identity)) {
    throw new ContentFactoryValidationError(
      'Reference pack fingerprint is stale or does not match its references',
      'VISUAL_IDENTITY_PACK_HASH_MISMATCH',
      'visual_identity.reference_pack_sha256',
    );
  }
  const registeredPack = approvedFactoryVisualIdentityPack(identity.series_slug, identity.version);
  if (!registeredPack) {
    throw new ContentFactoryValidationError(
      'No trusted approved reference pack is registered for this series and visual version',
      'VISUAL_IDENTITY_NOT_REGISTERED',
      'visual_identity',
    );
  }
  if (registeredPack.identity_id !== identity.identity_id
    || registeredPack.reference_pack_sha256 !== identity.reference_pack_sha256
    || registeredPack.approved_by !== identity.approved_by
    || registeredPack.approved_at !== identity.approved_at) {
    throw new ContentFactoryValidationError(
      'Manifest visual identity does not match the trusted versioned registry entry',
      'VISUAL_IDENTITY_REGISTRY_MISMATCH',
      'visual_identity',
    );
  }
  return identity;
}

function parseJob(value: unknown, index: number): FactoryJob {
  const input = record(value, `jobs[${index}]`);
  const kind = text(input.kind, `jobs[${index}].kind`, 20);
  if (!JOB_KINDS.has(kind)) throw new ContentFactoryValidationError('Unsupported job kind', 'INVALID_JOB_KIND', `jobs[${index}].kind`);
  const dependencies = input.dependencies;
  if (!Array.isArray(dependencies) || dependencies.some((item) => typeof item !== 'string' || !ID.test(item))) {
    throw new ContentFactoryValidationError('Job dependencies must be stable IDs', 'INVALID_DEPENDENCIES', `jobs[${index}].dependencies`);
  }
  const jobInput = record(input.input, `jobs[${index}].input`);
  const cost = record(input.cost, `jobs[${index}].cost`);
  const pricingStatus = text(cost.pricing_status, `jobs[${index}].cost.pricing_status`, 20);
  if (!PRICING_STATUS.has(pricingStatus)) {
    throw new ContentFactoryValidationError('Unsupported pricing status', 'INVALID_PRICING_STATUS', `jobs[${index}].cost.pricing_status`);
  }
  const low = nonNegative(cost.low_credits, `jobs[${index}].cost.low_credits`);
  const high = nonNegative(cost.high_credits, `jobs[${index}].cost.high_credits`);
  if (low > high) throw new ContentFactoryValidationError('Job low estimate exceeds high estimate', 'INVALID_COST_RANGE', `jobs[${index}].cost`);
  const duration = input.duration_seconds;
  if (duration !== undefined && (!Number.isInteger(duration) || (duration as number) < 1 || (duration as number) > 3600)) {
    throw new ContentFactoryValidationError('Invalid job duration', 'INVALID_DURATION', `jobs[${index}].duration_seconds`);
  }
  if (kind === 'video' && input.provider === 'flux' && ((duration as number) < 5 || (duration as number) > 20)) {
    throw new ContentFactoryValidationError('FLUX video duration must be 5-20 seconds', 'INVALID_FLUX_DURATION', `jobs[${index}].duration_seconds`);
  }
  const count = input.count;
  if (count !== undefined && (!Number.isInteger(count) || (count as number) < 1 || (count as number) > 1000)) {
    throw new ContentFactoryValidationError('Invalid job count', 'INVALID_COUNT', `jobs[${index}].count`);
  }
  const pageIndex = input.page_index;
  if (pageIndex !== undefined && (!Number.isInteger(pageIndex) || (pageIndex as number) < 1)) {
    throw new ContentFactoryValidationError('Invalid page index', 'INVALID_PAGE_INDEX', `jobs[${index}].page_index`);
  }
  if (input.state !== 'planned') {
    throw new ContentFactoryValidationError('Runtime state is forbidden in immutable manifests', 'MUTABLE_MANIFEST_STATE', `jobs[${index}].state`);
  }
  return {
    job_id: id(input.job_id, `jobs[${index}].job_id`),
    kind: kind as FactoryJob['kind'],
    provider: text(input.provider, `jobs[${index}].provider`, 80),
    operation: text(input.operation, `jobs[${index}].operation`, 120),
    state: 'planned',
    idempotency_key: text(input.idempotency_key, `jobs[${index}].idempotency_key`, 160),
    dependencies: dependencies as string[],
    ...(duration !== undefined ? { duration_seconds: duration as number } : {}),
    ...(count !== undefined ? { count: count as number } : {}),
    ...(pageIndex !== undefined ? { page_index: pageIndex as number } : {}),
    input: jobInput,
    cost: {
      pricing_status: pricingStatus as FactoryJob['cost']['pricing_status'],
      pricing_key: cost.pricing_key === null ? null : text(cost.pricing_key, `jobs[${index}].cost.pricing_key`, 120),
      low_credits: low,
      high_credits: high,
      basis: text(cost.basis, `jobs[${index}].cost.basis`, 500),
    },
  };
}

export async function parseFactoryManifest(value: unknown): Promise<ParsedFactoryManifest> {
  const sourceJson = JSON.stringify(value);
  if (!sourceJson || new TextEncoder().encode(sourceJson).byteLength > MAX_MANIFEST_BYTES) {
    throw new ContentFactoryValidationError('Manifest is empty or exceeds 1 MB', 'MANIFEST_TOO_LARGE');
  }
  const secret = findSecret(value);
  if (secret) throw new ContentFactoryValidationError('Credentials and signed capabilities are forbidden in manifests', 'SECRET_IN_MANIFEST', secret);

  const root = record(value, 'manifest');
  if (root.schema_version !== CONTENT_FACTORY_SCHEMA) {
    throw new ContentFactoryValidationError('Unsupported manifest schema', 'UNSUPPORTED_SCHEMA', 'schema_version');
  }
  const entity = record(root.entity, 'entity');
  const entityType = text(entity.entity_type, 'entity.entity_type', 30);
  if (!ENTITY_TYPES.has(entityType)) throw new ContentFactoryValidationError('Unsupported entity type', 'INVALID_ENTITY_TYPE', 'entity.entity_type');
  const entitySeriesSlug = id(entity.series_slug, 'entity.series_slug');
  const source = record(root.source, 'source');
  const pipeline = record(root.pipeline, 'pipeline');
  const profile = text(pipeline.profile, 'pipeline.profile', 80);
  const eligibility = text(pipeline.eligibility, 'pipeline.eligibility', 30);
  if (!PROFILES.has(profile)) throw new ContentFactoryValidationError('Unsupported pipeline profile', 'INVALID_PROFILE', 'pipeline.profile');
  if (!ELIGIBILITY.has(eligibility)) throw new ContentFactoryValidationError('Unsupported pipeline eligibility', 'INVALID_ELIGIBILITY', 'pipeline.eligibility');
  const visualIdentity = await parseVisualIdentity(root.visual_identity, entitySeriesSlug, profile);
  const preflight = record(root.preflight, 'preflight');
  const jobsValue = root.jobs;
  if (!Array.isArray(jobsValue) || jobsValue.length > MAX_FACTORY_JOBS) {
    throw new ContentFactoryValidationError(`jobs must contain at most ${MAX_FACTORY_JOBS} entries`, 'INVALID_JOBS', 'jobs');
  }
  const jobs = jobsValue.map(parseJob);
  const jobIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  for (const job of jobs) {
    if (jobIds.has(job.job_id)) throw new ContentFactoryValidationError('Duplicate job ID', 'DUPLICATE_JOB_ID', job.job_id);
    if (idempotencyKeys.has(job.idempotency_key)) throw new ContentFactoryValidationError('Duplicate idempotency key', 'DUPLICATE_IDEMPOTENCY_KEY', job.idempotency_key);
    jobIds.add(job.job_id);
    idempotencyKeys.add(job.idempotency_key);
  }
  for (const job of jobs) {
    if (job.dependencies.some((dependency) => !jobIds.has(dependency) || dependency === job.job_id)) {
      throw new ContentFactoryValidationError('Unknown or self job dependency', 'INVALID_DEPENDENCY', job.job_id);
    }
  }

  const budget = record(root.budget, 'budget');
  const low = nonNegative(budget.estimate_low_credits, 'budget.estimate_low_credits');
  const high = nonNegative(budget.estimate_high_credits, 'budget.estimate_high_credits');
  const withContingency = nonNegative(budget.estimate_with_contingency_credits, 'budget.estimate_with_contingency_credits');
  if (low > high || high > withContingency) {
    throw new ContentFactoryValidationError('Budget estimates are not monotonic', 'INVALID_BUDGET_RANGE', 'budget');
  }
  if (!Array.isArray(budget.unpriced_job_ids) || budget.unpriced_job_ids.some((item) => typeof item !== 'string' || !jobIds.has(item))) {
    throw new ContentFactoryValidationError('Unpriced job IDs must refer to manifest jobs', 'INVALID_UNPRICED_JOBS', 'budget.unpriced_job_ids');
  }
  const blockersValue = root.blockers;
  if (!Array.isArray(blockersValue)) throw new ContentFactoryValidationError('blockers must be an array', 'INVALID_BLOCKERS', 'blockers');
  const blockers = blockersValue.map((value, index) => {
    const blocker = record(value, `blockers[${index}]`);
    const severity = text(blocker.severity, `blockers[${index}].severity`, 20);
    if (!['warning', 'error', 'hard_block'].includes(severity)) {
      throw new ContentFactoryValidationError('Invalid blocker severity', 'INVALID_BLOCKER', `blockers[${index}]`);
    }
    return {
      ...blocker,
      code: text(blocker.code, `blockers[${index}].code`, 100),
      severity,
      message: text(blocker.message, `blockers[${index}].message`, 2000),
    } as FactoryManifest['blockers'][number];
  });
  const integrity = record(root.integrity, 'integrity');
  const sourceHash = sha(source.sha256, 'source.sha256');
  if (sha(integrity.source_sha256, 'integrity.source_sha256') !== sourceHash) {
    throw new ContentFactoryValidationError('Source fingerprint mismatch', 'SOURCE_HASH_MISMATCH', 'integrity.source_sha256');
  }
  if (!Array.isArray(source.reviews)) throw new ContentFactoryValidationError('source.reviews must be an array', 'INVALID_REVIEWS', 'source.reviews');
  for (const [index, reviewValue] of source.reviews.entries()) {
    const review = record(reviewValue, `source.reviews[${index}]`);
    if (review.required === true && review.status === 'approved' && review.source_sha256 !== sourceHash) {
      throw new ContentFactoryValidationError('Approved source review is stale', 'STALE_SOURCE_REVIEW', `source.reviews[${index}]`);
    }
  }

  const quality = record(root.quality, 'quality');
  if (!Array.isArray(quality.automated_gates) || !Array.isArray(quality.human_gates)) {
    throw new ContentFactoryValidationError('QC policy must define automated and human gates', 'INVALID_QUALITY', 'quality');
  }
  const revision = root.revision;
  if (!Number.isInteger(revision) || (revision as number) < 1) {
    throw new ContentFactoryValidationError('revision must be positive', 'INVALID_REVISION', 'revision');
  }

  const manifest = value as FactoryManifest;
  // The checks above validate fields used at every trust boundary. Preserve optional
  // schema fields exactly so the canonical hash remains byte-for-byte compatible with CLI v1.
  void id(root.manifest_id, 'manifest_id');
  void id(entity.entity_id, 'entity.entity_id');
  void id(entity.planet_slug, 'entity.planet_slug');
  void id(entity.series_slug, 'entity.series_slug');
  void text(entity.locale, 'entity.locale', 20);
  void text(source.path, 'source.path', 500);
  void boolean(preflight.manifest_ready, 'preflight.manifest_ready');
  void boolean(preflight.scene_plan_ready, 'preflight.scene_plan_ready');
  void boolean(preflight.prompt_plan_ready, 'preflight.prompt_plan_ready');
  void visualIdentity;

  if (profile === 'live_action' && (eligibility !== 'excluded' || jobs.length > 0)) {
    throw new ContentFactoryValidationError('Live action is inventory-only', 'LIVE_ACTION_AUTOMATION_FORBIDDEN', 'pipeline');
  }
  if (['islamic', '09-islamic'].includes(String(entity.planet_slug).toLowerCase()) && jobs.length > 0) {
    throw new ContentFactoryValidationError('Unapproved religious content cannot create jobs', 'RELIGIOUS_GENERATION_FORBIDDEN', 'jobs');
  }

  const expectedPlanHash = await sha256Hex(canonicalJson(planProjection(manifest)));
  if (sha(integrity.plan_sha256, 'integrity.plan_sha256') !== expectedPlanHash) {
    throw new ContentFactoryValidationError('Plan fingerprint does not match canonical manifest content', 'PLAN_HASH_MISMATCH', 'integrity.plan_sha256');
  }
  for (const job of jobs) {
    const expectedIdempotency = await expectedJobIdempotencyKey(manifest, job);
    if (job.idempotency_key !== expectedIdempotency) {
      throw new ContentFactoryValidationError(
        'Job idempotency key must fingerprint the current source, pipeline, and visual identity pack',
        'IDEMPOTENCY_KEY_MISMATCH',
        `jobs.${job.job_id}.idempotency_key`,
      );
    }
  }

  return {
    manifest,
    canonical_json: canonicalJson(manifest),
    plan_sha256: expectedPlanHash,
    blocker_count: blockers.filter((item) => item.severity === 'error' || item.severity === 'hard_block').length,
    unpriced_job_count: (budget.unpriced_job_ids as unknown[]).length,
    estimate_low_micros: creditsToMicros(low),
    estimate_high_micros: creditsToMicros(high),
    estimate_with_contingency_micros: creditsToMicros(withContingency),
  };
}

export function assertManifestReadyForApproval(parsed: ParsedFactoryManifest): void {
  const { manifest } = parsed;
  if (parsed.blocker_count > 0) throw new ContentFactoryValidationError('Manifest has blocking inventory or source issues', 'MANIFEST_BLOCKED');
  if (parsed.unpriced_job_count > 0) throw new ContentFactoryValidationError('Every paid job must be priced before approval', 'UNPRICED_JOBS');
  if (manifest.pipeline.eligibility !== 'ready') throw new ContentFactoryValidationError('Pipeline must be explicitly ready', 'PIPELINE_NOT_READY');
  if (VISUAL_IDENTITY_PROFILES.has(manifest.pipeline.profile) && manifest.visual_identity?.status !== 'approved') {
    throw new ContentFactoryValidationError(
      'An approved visual identity reference pack is required',
      'VISUAL_IDENTITY_UNAPPROVED',
      'visual_identity',
    );
  }
  if (!manifest.preflight.manifest_ready || !manifest.preflight.scene_plan_ready || !manifest.preflight.prompt_plan_ready) {
    throw new ContentFactoryValidationError('Manifest, scene/page plan, and prompt plan must all be ready', 'PREFLIGHT_NOT_READY');
  }
  for (const [index, review] of manifest.source.reviews.entries()) {
    if (review.required === true && review.status !== 'approved' && review.status !== 'not_applicable') {
      throw new ContentFactoryValidationError('A required source review is pending', 'SOURCE_REVIEW_PENDING', `source.reviews[${index}]`);
    }
  }
  if (manifest.jobs.length === 0) throw new ContentFactoryValidationError('Ready manifests need at least one job', 'NO_JOBS');
}

export async function createSpendApprovalFingerprint(input: {
  approval_id: string;
  run_id: string;
  plan_sha256: string;
  ceiling_micros: number;
  approved_by: string;
  approved_at: string;
  expires_at: string | null;
}): Promise<string> {
  return sha256Hex(canonicalJson({
    schema_version: 'content-factory.spend-approval/v1',
    ...input,
  }));
}

export function parseFactoryMessage(value: unknown): ContentFactoryMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.schema_version !== CONTENT_FACTORY_MESSAGE_SCHEMA) return null;
  if (!['dispatch', 'resume', 'retry_failed'].includes(String(input.action))) return null;
  if (typeof input.run_id !== 'string' || !ID.test(input.run_id)) return null;
  if (typeof input.job_id !== 'string' || !ID.test(input.job_id)) return null;
  if (typeof input.plan_sha256 !== 'string' || !SHA256.test(input.plan_sha256)) return null;
  if (typeof input.allow_new_paid_attempt !== 'boolean' || typeof input.accept_duplicate_charge_risk !== 'boolean') return null;
  return input as ContentFactoryMessage;
}
