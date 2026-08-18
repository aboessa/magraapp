import { canonicalJson, sha256Hex, type FactoryManifest } from './contentFactory.ts';

const SHA256 = /^[a-f0-9]{64}$/;
const GATE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/;
const QC_STATUSES = new Set(['passed', 'warning', 'failed', 'not_applicable']);
const SECRET_KEY = /(?:api[_-]?key|authorization|password|secret|access[_-]?token|refresh[_-]?token)/i;
const SECRET_VALUE = /(?:api[_-]?key|access[_-]?token|secret|signature)=/i;

export class ContentFactoryQcError extends Error {
  readonly code: string;
  readonly field?: string;

  constructor(message: string, code: string, field?: string) {
    super(message);
    this.name = 'ContentFactoryQcError';
    this.code = code;
    this.field = field;
  }
}

type PolicyGate = { gate_id: string; required: boolean };
export type AutomatedQcResult = {
  gate_id: string;
  status: 'passed' | 'warning' | 'failed' | 'not_applicable';
  required: boolean;
  message?: string;
  evidence: Record<string, unknown>;
  evidence_sha256: string;
};

export type PreparedAutomatedQc = {
  policy_version: string;
  status: 'passed' | 'failed';
  required_passed: boolean;
  results: AutomatedQcResult[];
  evidence_sha256: string;
};

export type FactoryHumanReviewProjection = {
  gate_id: string;
  decision: 'approved' | 'rejected';
  reviewer_id: string;
  plan_sha256: string;
  asset_sha256: string;
  automated_qc_evidence_sha256: string;
  reviewed_at: string;
  notes: string | null;
  review_sha256: string;
};

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentFactoryQcError(`${field} must be an object`, 'INVALID_QC_FIELD', field);
  }
  return value as Record<string, unknown>;
}

function secretPath(value: unknown, field = '$', depth = 0): string | null {
  if (depth > 12) return field;
  if (typeof value === 'string') return SECRET_VALUE.test(value) ? field : null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = secretPath(value[index], `${field}[${index}]`, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) return `${field}.${key}`;
    const found = secretPath(item, `${field}.${key}`, depth + 1);
    if (found) return found;
  }
  return null;
}

function gates(value: unknown, field: string): PolicyGate[] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new ContentFactoryQcError(`${field} must be a bounded array`, 'INVALID_QC_POLICY', field);
  }
  const seen = new Set<string>();
  return value.map((item, index) => {
    const row = record(item, `${field}[${index}]`);
    if (typeof row.gate_id !== 'string' || !GATE_ID.test(row.gate_id) || seen.has(row.gate_id)) {
      throw new ContentFactoryQcError('QC gate IDs must be valid and unique', 'INVALID_QC_POLICY', `${field}[${index}].gate_id`);
    }
    if (typeof row.required !== 'boolean') {
      throw new ContentFactoryQcError('QC gate required must be boolean', 'INVALID_QC_POLICY', `${field}[${index}].required`);
    }
    seen.add(row.gate_id);
    return { gate_id: row.gate_id, required: row.required };
  });
}

function policy(manifest: FactoryManifest) {
  if (!manifest.quality || typeof manifest.quality.policy_version !== 'string' || !manifest.quality.policy_version) {
    throw new ContentFactoryQcError('Manifest has no supported QC policy', 'INVALID_QC_POLICY', 'quality.policy_version');
  }
  return {
    policy_version: manifest.quality.policy_version,
    automated: gates(manifest.quality.automated_gates, 'quality.automated_gates'),
    human: gates(manifest.quality.human_gates, 'quality.human_gates'),
  };
}

export function factoryHumanGateIds(manifest: FactoryManifest): string[] {
  return policy(manifest).human.filter((gate) => gate.required).map((gate) => gate.gate_id);
}

export async function prepareAutomatedQc(input: {
  manifest: FactoryManifest;
  value: unknown;
  plan_sha256: string;
  asset_sha256: string;
}): Promise<PreparedAutomatedQc> {
  const value = record(input.value, '$');
  if (!SHA256.test(input.plan_sha256) || !SHA256.test(input.asset_sha256)) {
    throw new ContentFactoryQcError('Plan and asset fingerprints are required', 'QC_CONTEXT_INVALID');
  }
  const currentPolicy = policy(input.manifest);
  if (value.policy_version !== currentPolicy.policy_version) {
    throw new ContentFactoryQcError('QC policy version does not match the immutable manifest', 'QC_POLICY_MISMATCH', 'policy_version');
  }
  if (!Array.isArray(value.results) || value.results.length !== currentPolicy.automated.length) {
    throw new ContentFactoryQcError('QC results must cover every automated gate exactly once', 'QC_GATE_SET_MISMATCH', 'results');
  }

  const supplied = new Map<string, Record<string, unknown>>();
  for (const [index, item] of value.results.entries()) {
    const result = record(item, `results[${index}]`);
    if (typeof result.gate_id !== 'string' || supplied.has(result.gate_id)) {
      throw new ContentFactoryQcError('QC result gate IDs must be unique strings', 'QC_GATE_SET_MISMATCH', `results[${index}].gate_id`);
    }
    supplied.set(result.gate_id, result);
  }

  const normalizedWithoutHashes: Array<Omit<AutomatedQcResult, 'evidence_sha256'>> = [];
  for (const gate of currentPolicy.automated) {
    const item = supplied.get(gate.gate_id);
    if (!item || typeof item.status !== 'string' || !QC_STATUSES.has(item.status)) {
      throw new ContentFactoryQcError(`Missing or invalid result for ${gate.gate_id}`, 'QC_GATE_SET_MISMATCH', gate.gate_id);
    }
    const evidence = item.evidence === undefined ? {} : record(item.evidence, `${gate.gate_id}.evidence`);
    const leaked = secretPath(evidence, `${gate.gate_id}.evidence`);
    if (leaked) throw new ContentFactoryQcError('QC evidence must not contain credentials', 'SECRET_IN_QC_EVIDENCE', leaked);
    const message = item.message === undefined ? undefined : String(item.message).trim();
    if (message && message.length > 1_000) {
      throw new ContentFactoryQcError('QC result messages must be 1000 characters or fewer', 'QC_MESSAGE_TOO_LONG', gate.gate_id);
    }
    normalizedWithoutHashes.push({
      gate_id: gate.gate_id,
      status: item.status as AutomatedQcResult['status'],
      required: gate.required,
      ...(message ? { message } : {}),
      evidence,
    });
  }
  if (supplied.size !== currentPolicy.automated.length) {
    throw new ContentFactoryQcError('QC results contain a gate outside the immutable policy', 'QC_GATE_SET_MISMATCH', 'results');
  }

  const evidenceSha = await sha256Hex(canonicalJson({
    policy_version: currentPolicy.policy_version,
    plan_sha256: input.plan_sha256,
    asset_sha256: input.asset_sha256,
    results: normalizedWithoutHashes,
  }));
  const results: AutomatedQcResult[] = [];
  for (const result of normalizedWithoutHashes) {
    results.push({
      ...result,
      evidence_sha256: await sha256Hex(canonicalJson({
        policy_version: currentPolicy.policy_version,
        plan_sha256: input.plan_sha256,
        asset_sha256: input.asset_sha256,
        result,
      })),
    });
  }
  const requiredPassed = results.every((result) => !result.required || result.status === 'passed');
  return {
    policy_version: currentPolicy.policy_version,
    status: requiredPassed ? 'passed' : 'failed',
    required_passed: requiredPassed,
    results,
    evidence_sha256: evidenceSha,
  };
}

export async function createFactoryHumanReview(input: {
  manifest: FactoryManifest;
  gate_id: unknown;
  decision: unknown;
  reviewer_id: string;
  plan_sha256: string;
  asset_sha256: string;
  automated_qc_evidence_sha256: string;
  reviewed_at: string;
  notes: unknown;
}): Promise<FactoryHumanReviewProjection> {
  const currentPolicy = policy(input.manifest);
  if (typeof input.gate_id !== 'string' || !currentPolicy.human.some((gate) => gate.gate_id === input.gate_id)) {
    throw new ContentFactoryQcError('Human review gate is not in the immutable policy', 'HUMAN_GATE_MISMATCH', 'gate_id');
  }
  if (input.decision !== 'approved' && input.decision !== 'rejected') {
    throw new ContentFactoryQcError('decision must be approved or rejected', 'INVALID_REVIEW_DECISION', 'decision');
  }
  if (![input.plan_sha256, input.asset_sha256, input.automated_qc_evidence_sha256].every((value) => SHA256.test(value))) {
    throw new ContentFactoryQcError('Review context fingerprints are invalid', 'REVIEW_CONTEXT_INVALID');
  }
  if (!Number.isFinite(Date.parse(input.reviewed_at))) {
    throw new ContentFactoryQcError('reviewed_at must be an ISO date-time', 'INVALID_REVIEW_DATE', 'reviewed_at');
  }
  const notes = input.notes === null || input.notes === undefined ? null : String(input.notes).trim();
  if (notes && notes.length > 4_000) {
    throw new ContentFactoryQcError('Review notes must be 4000 characters or fewer', 'REVIEW_NOTES_TOO_LONG', 'notes');
  }
  if (input.decision === 'rejected' && !notes) {
    throw new ContentFactoryQcError('Rejected reviews require actionable notes', 'REJECTION_NOTES_REQUIRED', 'notes');
  }
  const reviewWithoutHash: Omit<FactoryHumanReviewProjection, 'review_sha256'> = {
    gate_id: input.gate_id,
    decision: input.decision,
    reviewer_id: input.reviewer_id,
    plan_sha256: input.plan_sha256,
    asset_sha256: input.asset_sha256,
    automated_qc_evidence_sha256: input.automated_qc_evidence_sha256,
    reviewed_at: input.reviewed_at,
    notes,
  };
  return {
    ...reviewWithoutHash,
    review_sha256: await sha256Hex(canonicalJson(reviewWithoutHash)),
  };
}

export async function factoryHumanReviewsSha(reviews: FactoryHumanReviewProjection[]): Promise<string> {
  return sha256Hex(canonicalJson(reviews));
}
