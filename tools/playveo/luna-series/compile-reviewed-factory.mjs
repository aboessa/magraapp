#!/usr/bin/env node
// Offline compiler for a reviewed Luna plan. It consumes the existing blocked
// compiler output plus explicit human source-review attestations. It never
// contacts Content Factory, creates spend approval, or dispatches paid work.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import {
  ContractError,
  createManifest,
  validateManifest,
} from '../../content-factory/lib/contract.mjs';
import {
  loadApprovedReviewBundle,
  resolveSourceManifest,
} from './source-reviews.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const SERIES_ROOT = path.resolve(import.meta.dirname);
const FACTORY_OUTPUT_ROOT = path.join(SERIES_ROOT, 'factory-manifests');
const BLOCKED_COMPILER = path.join(SERIES_ROOT, 'compile-factory.mjs');
const SOURCE_REVIEW_BLOCKERS = new Set([
  'SOURCE_EDITORIAL_REVIEW_PENDING',
  'SOURCE_LINGUISTIC_REVIEW_PENDING',
  'SOURCE_EDUCATIONAL_REVIEW_PENDING',
]);
const SUPPORTED_FACTORY_SOURCE_REVIEWS = new Set([
  'editorial',
  'educational',
  'age_safety',
  'scientific',
  'historical',
  'sleep',
  'religious',
]);

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

function assertInside(base, candidate, label, { allowBase = false } = {}) {
  const relation = path.relative(base, candidate);
  if (relation.startsWith('..') || path.isAbsolute(relation) || (!allowBase && relation === '')) {
    throw new Error(`${label} escapes ${relative(base)}`);
  }
}

function assertSafeOutputAncestry(candidate) {
  assertInside(FACTORY_OUTPUT_ROOT, candidate, '--out');
  const relation = path.relative(SERIES_ROOT, candidate);
  let current = SERIES_ROOT;
  for (const segment of relation.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) continue;
    if (fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`--out rejects symbolic-link or junction ancestry: ${relative(current)}`);
    }
  }
}

function resolveOutput(value) {
  if (typeof value !== 'string' || value.length === 0) throw new Error('--out requires a path');
  const hasDirectory = value.includes('/') || value.includes('\\');
  const candidate = path.isAbsolute(value)
    ? path.resolve(value)
    : hasDirectory
      ? path.resolve(ROOT, value)
      : path.resolve(FACTORY_OUTPUT_ROOT, value);
  assertInside(FACTORY_OUTPUT_ROOT, candidate, '--out');
  if (path.extname(candidate).toLowerCase() !== '.json') throw new Error('--out must end in .json');
  assertSafeOutputAncestry(candidate);
  return candidate;
}

function parseArgs(argv) {
  const options = { manifest: null, reviewDir: null, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
    if (argument === '--manifest') options.manifest = value;
    else if (argument === '--review-dir') options.reviewDir = value;
    else if (argument === '--out') options.out = value;
    else throw new Error(`Unknown option: ${argument}`);
  }
  if (!options.manifest) throw new Error('Usage: compile-reviewed-factory.mjs --manifest PATH --review-dir PATH [--out PATH]');
  if (!options.reviewDir) throw new Error('--review-dir is required; reviewed compilation never infers or synthesizes approvals');
  return options;
}

function blockedFactoryArtifact(manifestPath) {
  const child = spawnSync(process.execPath, [BLOCKED_COMPILER, '--manifest', manifestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(`Blocked compiler failed: ${(child.stderr || child.stdout || '').trim().slice(0, 4000)}`);
  }
  let wrapper;
  try {
    wrapper = JSON.parse(child.stdout);
  } catch (error) {
    throw new Error(`Blocked compiler returned invalid JSON: ${error.message}`);
  }
  if (wrapper?.mode !== 'dry-run' || wrapper?.written !== false || !wrapper.artifact) {
    throw new Error('Blocked compiler did not return the expected read-only artifact');
  }
  return wrapper.artifact;
}

function approvedReviewProjection(review) {
  return {
    review_type: review.review_type,
    required: true,
    status: 'approved',
    source_sha256: review.bindings.source_sha256,
    reviewer_id: review.reviewer_id,
    reviewed_at: review.reviewed_at,
    notes: [
      `Source-bound human approval ${review.attestation_sha256}.`,
      `Role: ${review.reviewer_role}.`,
      `Basis: ${review.basis}`,
    ].join(' ').slice(0, 4000),
  };
}

function metadataReviewProjection(review) {
  return {
    review_type: review.review_type,
    decision: review.decision,
    reviewer_id: review.reviewer_id,
    reviewer_role: review.reviewer_role,
    qualification: review.qualification,
    reviewed_at: review.reviewed_at,
    basis: review.basis,
    request_sha256: review.request_sha256,
    attestation_sha256: review.attestation_sha256,
    source_sha256: review.bindings.source_sha256,
    preproduction_plan_sha256: review.bindings.preproduction_plan_sha256,
    visual_identity_pack_sha256: review.bindings.visual_identity_pack_sha256,
  };
}

function compileReviewed(manifestPath, reviewDir) {
  const blocked = blockedFactoryArtifact(manifestPath);
  const bundle = loadApprovedReviewBundle(manifestPath, reviewDir);
  if (bundle.manifest.overlay_plan) {
    throw new Error('E03/E04 remain blocked: source reviews do not replace deterministic overlay implementation and specialist evidence');
  }
  if (blocked.integrity.source_sha256 !== bundle.manifest.source.sha256
    || blocked.metadata?.source_preproduction_plan_sha256 !== bundle.sourcePlanSha256
    || blocked.visual_identity?.reference_pack_sha256 !== bundle.manifest.visual_identity.reference_pack_sha256) {
    throw new Error('Blocked factory artifact differs from the reviewed source bindings');
  }

  const byType = new Map(bundle.reviews.map((review) => [review.review_type, review]));
  const factorySourceReviews = blocked.source.reviews.map((review) => {
    const attestation = byType.get(review.review_type);
    if (!attestation) throw new Error(`Factory source review ${review.review_type} lacks an approved attestation`);
    return approvedReviewProjection(attestation);
  });
  for (const reviewType of byType.keys()) {
    if (SUPPORTED_FACTORY_SOURCE_REVIEWS.has(reviewType)
      && !factorySourceReviews.some((review) => review.review_type === reviewType)) {
      factorySourceReviews.push(approvedReviewProjection(byType.get(reviewType)));
    }
  }

  const remainingBlockers = blocked.blockers.filter((blocker) => !SOURCE_REVIEW_BLOCKERS.has(blocker.code));
  if (remainingBlockers.some((blocker) => blocker.severity === 'error' || blocker.severity === 'hard_block')) {
    throw new Error(`Reviewed plan retains hard blockers: ${remainingBlockers.map((blocker) => blocker.code).join(', ')}`);
  }
  const clipReviewGate = blocked.quality.human_gates.find((gate) => gate.gate_id === 'clip_visual_and_auditory_review');
  if (!clipReviewGate) throw new Error('Reviewed plan lost the required post-generation clip review gate');

  const reviewed = createManifest({
    ...blocked,
    revision: blocked.revision + 1,
    source: {
      ...blocked.source,
      content_status: 'approved',
      reviews: factorySourceReviews,
    },
    pipeline: {
      ...blocked.pipeline,
      eligibility: 'ready',
      notes: 'Source-bound human attestations are complete. Paid dispatch still requires separate server-side spend approval.',
    },
    quality: {
      ...blocked.quality,
      human_gates: [{ ...clipReviewGate, status: 'pending' }],
    },
    blockers: remainingBlockers,
    spend_approval: null,
    metadata: {
      ...blocked.metadata,
      dispatch_blocked: false,
      reviewed_compiler: 'luna-series.reviewed-factory/v1',
      source_review_request_sha256: bundle.request.request_sha256,
      source_review_chain_sha256: bundle.chainSha256,
      source_review_identity_assurance: bundle.identityAssurance,
      source_review_attestations: bundle.reviews.map(metadataReviewProjection),
      source_review_requirements: bundle.reviews.map(approvedReviewProjection),
      linguistic_review_preserved_in_metadata: byType.has('linguistic'),
      spend_approval_embedded: false,
    },
  });

  const contract = validateManifest(reviewed);
  if (!contract.valid) throw new ContractError('Reviewed manifest failed the Content Factory contract', contract.errors);
  if (reviewed.pipeline.eligibility !== 'ready' || reviewed.blockers.length !== 0) {
    throw new Error('Reviewed compiler failed to produce an unblocked ready plan');
  }
  if (reviewed.source.reviews.some((review) => review.required && review.status !== 'approved')) {
    throw new Error('Reviewed compiler left a factory-supported source review unapproved');
  }
  if (reviewed.spend_approval !== null) throw new Error('Reviewed compiler must never synthesize spend approval');
  return { reviewed, bundle };
}

function writeNewArtifact(destination, manifest) {
  assertSafeOutputAncestry(destination);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  assertSafeOutputAncestry(destination);
  fs.writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = resolveSourceManifest(options.manifest);
  const { reviewed, bundle } = compileReviewed(manifestPath, options.reviewDir);
  const diagnostics = {
    contract_valid: true,
    dispatch_ready: true,
    source_reviews_approved: bundle.reviews.map((review) => review.review_type),
    source_review_chain_sha256: bundle.chainSha256,
    identity_assurance: bundle.identityAssurance,
    spend_approval_present: false,
    network_requests_sent: 0,
    paid_requests_sent: 0,
  };
  if (options.out) {
    const destination = resolveOutput(options.out);
    writeNewArtifact(destination, reviewed);
    process.stdout.write(`${JSON.stringify({
      mode: 'write-explicit',
      written: true,
      output: relative(destination),
      source_manifest: relative(manifestPath),
      factory_plan_sha256: reviewed.integrity.plan_sha256,
      job_count: reviewed.jobs.length,
      budget: reviewed.budget,
      diagnostics,
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({
    mode: 'dry-run',
    written: false,
    source_manifest: relative(manifestPath),
    factory_plan_sha256: reviewed.integrity.plan_sha256,
    diagnostics,
    artifact: reviewed,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    compiled: false,
    error: error.message,
    diagnostics: error instanceof ContractError ? error.errors : [],
  }, null, 2)}\n`);
  process.exitCode = 1;
}
