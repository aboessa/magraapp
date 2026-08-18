#!/usr/bin/env node
// Offline, explicit human source-review attestations for Luna production plans.
// This tool never contacts a backend, loads credentials, or dispatches provider work.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { canonicalJson } from '../../content-factory/lib/contract.mjs';
import { validatePreproductionManifest } from './production.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const SERIES_ROOT = path.resolve(import.meta.dirname);
const MANIFEST_ROOT = path.join(SERIES_ROOT, 'manifests');
const REVIEW_ROOT = path.join(SERIES_ROOT, 'source-reviews');
const REQUEST_SCHEMA = 'luna-series.source-review-request/v1';
const ATTESTATION_SCHEMA = 'luna-series.source-review-attestation/v1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const SAFE_REVIEW_TYPE_RE = /^[a-z][a-z0-9_]{2,63}$/;
const CRITERIA = Object.freeze({
  editorial: 'Confirm narrative clarity, exact dialogue order, age-appropriate wording, scene continuity, and correspondence with the current source bytes.',
  linguistic: 'Confirm Arabic grammar, diacritics, pronunciation directions, target-word forms, and child-appropriate Modern Standard Arabic for the current source bytes.',
  educational: 'Confirm the learning objective, scaffolding, response windows, feedback, repetition, and age suitability for the current source bytes.',
  calligraphy_and_glyph: 'Confirm Arabic glyph forms, shaping, point placement, stroke order, overlay timing, and calligraphic correctness for the current source and overlay plan.',
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

function assertInside(base, candidate, label, { allowBase = false } = {}) {
  const relation = path.relative(base, candidate);
  if (relation.startsWith('..') || path.isAbsolute(relation) || (!allowBase && relation === '')) {
    throw new Error(`${label} escapes ${relative(base)}`);
  }
}

function assertSafeAncestry(candidate) {
  assertInside(SERIES_ROOT, candidate, 'review path');
  const segments = path.relative(SERIES_ROOT, candidate).split(path.sep).filter(Boolean);
  let current = SERIES_ROOT;
  for (const segment of segments) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) continue;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`Review path rejects symbolic-link or junction ancestry: ${relative(current)}`);
  }
}

export function resolveSourceManifest(value) {
  if (typeof value !== 'string' || value.length === 0) throw new Error('--manifest requires a path');
  const candidate = path.isAbsolute(value) ? path.resolve(value) : path.resolve(ROOT, value);
  assertInside(MANIFEST_ROOT, candidate, '--manifest');
  if (path.extname(candidate).toLowerCase() !== '.json') throw new Error('--manifest must be JSON');
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
    throw new Error(`Manifest is missing: ${relative(candidate)}`);
  }
  assertSafeAncestry(candidate);
  return candidate;
}

export function resolveReviewDirectory(value, fallbackEpisodeId = null, { mustExist = false } = {}) {
  const selected = value ?? fallbackEpisodeId;
  if (typeof selected !== 'string' || selected.length === 0) throw new Error('--review-dir requires a path or episode id');
  const hasDirectory = selected.includes('/') || selected.includes('\\');
  const candidate = path.isAbsolute(selected)
    ? path.resolve(selected)
    : hasDirectory
      ? path.resolve(ROOT, selected)
      : path.resolve(REVIEW_ROOT, selected);
  assertInside(REVIEW_ROOT, candidate, '--review-dir');
  assertSafeAncestry(candidate);
  if (mustExist && (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory())) {
    throw new Error(`Review directory is missing: ${relative(candidate)}`);
  }
  return candidate;
}

function writeJsonExclusive(destination, value) {
  assertSafeAncestry(destination);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  assertSafeAncestry(destination);
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

function withoutField(value, field) {
  const projection = structuredClone(value);
  delete projection[field];
  return projection;
}

function fingerprint(value, field) {
  return sha256(canonicalJson(withoutField(value, field)));
}

function requiredReviewDescriptors(manifest) {
  const reviews = manifest.reviews?.required;
  if (!Array.isArray(reviews)) throw new Error('Manifest has no reviews.required array');
  const required = reviews.filter((review) => review?.required === true);
  if (required.length === 0) throw new Error('Manifest has no required source reviews');
  const seen = new Set();
  return required.map((review) => {
    const reviewType = review.review_type;
    if (!SAFE_REVIEW_TYPE_RE.test(reviewType ?? '')) throw new Error(`Invalid review type: ${reviewType ?? '<missing>'}`);
    if (seen.has(reviewType)) throw new Error(`Duplicate required review type: ${reviewType}`);
    seen.add(reviewType);
    if (review.source_sha256 !== manifest.source.sha256) throw new Error(`${reviewType} requirement is stale for the current source`);
    return {
      review_type: reviewType,
      required: true,
      acceptance_criteria: CRITERIA[reviewType] ?? 'Confirm this review gate against the exact current source bytes and production plan.',
    };
  });
}

function requestBindings(validated) {
  const { manifest, manifestPath, planSha256, dialogueCount } = validated;
  return {
    episode_id: manifest.episode.episode_id,
    episode_number: manifest.episode.episode_number,
    title_ar: manifest.episode.title_ar,
    locale: manifest.episode.locale,
    manifest_path: relative(manifestPath),
    source_path: manifest.source.path,
    source_sha256: manifest.source.sha256,
    preproduction_plan_sha256: planSha256,
    visual_identity_pack_sha256: manifest.visual_identity.reference_pack_sha256,
    dialogue_count: dialogueCount,
  };
}

function createRequest(validated) {
  const request = {
    schema_version: REQUEST_SCHEMA,
    created_at: new Date().toISOString(),
    status: 'awaiting_human_reviews',
    bindings: requestBindings(validated),
    required_reviews: requiredReviewDescriptors(validated.manifest),
    reviewer_instructions: [
      'Open and review the source_path whose bytes match source_sha256.',
      'Confirm the preproduction plan hash and the acceptance criteria for only your review type.',
      'Record approval with the attest command; never edit an attestation or copy approval from another source hash.',
      'A linguistic approval must be made by a human with an explicitly recorded Arabic-language qualification.',
    ],
    identity_assurance: 'operator-supplied human reviewer identity; repository audit trail; no automatic approval',
    network_requests_sent: 0,
    paid_requests_sent: 0,
    request_sha256: '',
  };
  request.request_sha256 = fingerprint(request, 'request_sha256');
  return request;
}

function assertValidTimestamp(value, label) {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO-8601 timestamp with timezone`);
  }
  if (Date.parse(value) > Date.now() + 5 * 60 * 1000) throw new Error(`${label} cannot be in the future`);
}

function assertBoundRequest(request, validated) {
  if (request?.schema_version !== REQUEST_SCHEMA) throw new Error('Unsupported source review request schema');
  if (!SHA256_RE.test(request.request_sha256 ?? '') || fingerprint(request, 'request_sha256') !== request.request_sha256) {
    throw new Error('Source review request fingerprint is invalid');
  }
  assertValidTimestamp(request.created_at, 'request.created_at');
  const expectedBindings = requestBindings(validated);
  if (canonicalJson(request.bindings) !== canonicalJson(expectedBindings)) {
    throw new Error('Source review request is stale for the current source, plan, or visual identity');
  }
  const expectedReviews = requiredReviewDescriptors(validated.manifest);
  if (canonicalJson(request.required_reviews) !== canonicalJson(expectedReviews)) {
    throw new Error('Source review request does not exactly match the current required review gates');
  }
}

function loadBoundRequest(manifestPath, reviewDir) {
  const validated = validatePreproductionManifest(manifestPath);
  const requestPath = path.join(reviewDir, 'request.json');
  if (!fs.existsSync(requestPath) || !fs.statSync(requestPath).isFile()) {
    throw new Error(`Review request is missing: ${relative(requestPath)}`);
  }
  assertSafeAncestry(requestPath);
  const request = readJson(requestPath);
  assertBoundRequest(request, validated);
  return { validated, request, requestPath };
}

function assertHumanText(value, label, minimum = 3, maximum = 1000) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum || /[\u0000-\u001f]/.test(value)) {
    throw new Error(`${label} must contain ${minimum}-${maximum} non-control characters`);
  }
  return value.trim();
}

function validateAttestation(attestation, request, reviewType) {
  if (attestation?.schema_version !== ATTESTATION_SCHEMA) throw new Error(`${reviewType} attestation has an unsupported schema`);
  if (attestation.review_type !== reviewType || attestation.decision !== 'approved' || attestation.required !== true) {
    throw new Error(`${reviewType} attestation is not an explicit required approval`);
  }
  if (attestation.request_sha256 !== request.request_sha256) throw new Error(`${reviewType} attestation references another request`);
  if (canonicalJson(attestation.bindings) !== canonicalJson(request.bindings)) {
    throw new Error(`${reviewType} attestation is stale for the review bindings`);
  }
  if (!SHA256_RE.test(attestation.attestation_sha256 ?? '')
    || fingerprint(attestation, 'attestation_sha256') !== attestation.attestation_sha256) {
    throw new Error(`${reviewType} attestation fingerprint is invalid`);
  }
  assertHumanText(attestation.reviewer_id, `${reviewType}.reviewer_id`, 3, 160);
  assertHumanText(attestation.reviewer_role, `${reviewType}.reviewer_role`, 3, 160);
  assertHumanText(attestation.basis, `${reviewType}.basis`, 20, 1000);
  assertValidTimestamp(attestation.reviewed_at, `${reviewType}.reviewed_at`);
  if (reviewType === 'linguistic') {
    assertHumanText(attestation.qualification, 'linguistic.qualification', 10, 500);
  }
  if (attestation.identity_assurance !== request.identity_assurance) {
    throw new Error(`${reviewType} attestation identity assurance differs from the request`);
  }
  return attestation;
}

export function loadApprovedReviewBundle(manifestValue, reviewDirValue) {
  const manifestPath = resolveSourceManifest(manifestValue);
  const initial = validatePreproductionManifest(manifestPath);
  const reviewDir = resolveReviewDirectory(reviewDirValue, initial.manifest.episode.episode_id, { mustExist: true });
  const { validated, request } = loadBoundRequest(manifestPath, reviewDir);
  const requiredTypes = request.required_reviews.map((review) => review.review_type).sort();
  const expectedFiles = new Set(requiredTypes.map((reviewType) => `${reviewType}.approved.json`));
  const unexpected = fs.readdirSync(reviewDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.approved.json') && !expectedFiles.has(entry.name))
    .map((entry) => entry.name);
  if (unexpected.length > 0) throw new Error(`Unexpected approved review files: ${unexpected.join(', ')}`);

  const reviews = requiredTypes.map((reviewType) => {
    const reviewPath = path.join(reviewDir, `${reviewType}.approved.json`);
    if (!fs.existsSync(reviewPath) || !fs.statSync(reviewPath).isFile()) {
      throw new Error(`Required ${reviewType} approval is missing: ${relative(reviewPath)}`);
    }
    assertSafeAncestry(reviewPath);
    return validateAttestation(readJson(reviewPath), request, reviewType);
  });
  const chainProjection = reviews.map((review) => ({
    review_type: review.review_type,
    attestation_sha256: review.attestation_sha256,
    reviewer_id: review.reviewer_id,
    reviewed_at: review.reviewed_at,
  }));
  return {
    manifest: validated.manifest,
    manifestPath,
    sourcePlanSha256: validated.planSha256,
    request,
    reviewDir,
    reviews,
    chainSha256: sha256(canonicalJson(chainProjection)),
    identityAssurance: request.identity_assurance,
  };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  const booleanOptions = new Set(['approve', 'help']);
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected positional argument: ${argument}`);
    const key = argument.slice(2);
    if (booleanOptions.has(key)) {
      options[key] = true;
      continue;
    }
    const value = rest[++index];
    if (!value || value.startsWith('--')) throw new Error(`--${key} requires a value`);
    options[key] = value;
  }
  return { command, options };
}

function requireOption(options, key) {
  const value = options[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`--${key} is required`);
  return value;
}

function assertOptions(options, allowed) {
  for (const key of Object.keys(options)) if (!allowed.has(key)) throw new Error(`Unknown option: --${key}`);
}

function executeRequest(options) {
  assertOptions(options, new Set(['manifest', 'review-dir']));
  const manifestPath = resolveSourceManifest(requireOption(options, 'manifest'));
  const validated = validatePreproductionManifest(manifestPath);
  const reviewDir = resolveReviewDirectory(options['review-dir'], validated.manifest.episode.episode_id);
  const requestPath = path.join(reviewDir, 'request.json');
  if (fs.existsSync(requestPath)) {
    const existing = readJson(requestPath);
    assertBoundRequest(existing, validated);
    return { created: false, duplicate: true, request: existing, output: relative(requestPath) };
  }
  const request = createRequest(validated);
  writeJsonExclusive(requestPath, request);
  return { created: true, duplicate: false, request, output: relative(requestPath) };
}

function executeAttest(options) {
  assertOptions(options, new Set([
    'manifest', 'review-dir', 'review-type', 'reviewer-id', 'reviewer-role', 'basis',
    'qualification', 'confirm-source-sha', 'confirm-plan-sha', 'approve',
  ]));
  if (options.approve !== true) throw new Error('Recording approval requires the explicit --approve flag');
  const manifestPath = resolveSourceManifest(requireOption(options, 'manifest'));
  const validated = validatePreproductionManifest(manifestPath);
  const reviewDir = resolveReviewDirectory(options['review-dir'], validated.manifest.episode.episode_id, { mustExist: true });
  const { request } = loadBoundRequest(manifestPath, reviewDir);
  const reviewType = requireOption(options, 'review-type');
  if (!request.required_reviews.some((review) => review.review_type === reviewType)) {
    throw new Error(`${reviewType} is not a required review type for this request`);
  }
  if (requireOption(options, 'confirm-source-sha') !== request.bindings.source_sha256) {
    throw new Error('--confirm-source-sha does not match the current request');
  }
  if (requireOption(options, 'confirm-plan-sha') !== request.bindings.preproduction_plan_sha256) {
    throw new Error('--confirm-plan-sha does not match the current request');
  }
  const qualification = options.qualification === undefined
    ? null
    : assertHumanText(options.qualification, '--qualification', 10, 500);
  if (reviewType === 'linguistic' && qualification === null) {
    throw new Error('A linguistic approval requires --qualification for the human Arabic-language reviewer');
  }
  const attestation = {
    schema_version: ATTESTATION_SCHEMA,
    decision: 'approved',
    review_type: reviewType,
    required: true,
    reviewer_id: assertHumanText(requireOption(options, 'reviewer-id'), '--reviewer-id', 3, 160),
    reviewer_role: assertHumanText(requireOption(options, 'reviewer-role'), '--reviewer-role', 3, 160),
    qualification,
    reviewed_at: new Date().toISOString(),
    basis: assertHumanText(requireOption(options, 'basis'), '--basis', 20, 1000),
    request_sha256: request.request_sha256,
    bindings: request.bindings,
    identity_assurance: request.identity_assurance,
    attestation_sha256: '',
  };
  attestation.attestation_sha256 = fingerprint(attestation, 'attestation_sha256');
  const destination = path.join(reviewDir, `${reviewType}.approved.json`);
  writeJsonExclusive(destination, attestation);
  return { created: true, review_type: reviewType, output: relative(destination), attestation_sha256: attestation.attestation_sha256 };
}

function executeVerify(options) {
  assertOptions(options, new Set(['manifest', 'review-dir']));
  const bundle = loadApprovedReviewBundle(
    requireOption(options, 'manifest'),
    options['review-dir'],
  );
  return {
    valid: true,
    episode_id: bundle.manifest.episode.episode_id,
    source_sha256: bundle.manifest.source.sha256,
    preproduction_plan_sha256: bundle.sourcePlanSha256,
    review_types: bundle.reviews.map((review) => review.review_type),
    review_chain_sha256: bundle.chainSha256,
    identity_assurance: bundle.identityAssurance,
    network_requests_sent: 0,
    paid_requests_sent: 0,
  };
}

function usage() {
  return [
    'Usage:',
    '  source-reviews.mjs request --manifest PATH [--review-dir EPISODE_OR_PATH]',
    '  source-reviews.mjs attest --manifest PATH [--review-dir EPISODE_OR_PATH] --review-type TYPE',
    '    --reviewer-id ID --reviewer-role ROLE --basis TEXT [--qualification TEXT]',
    '    --confirm-source-sha SHA256 --confirm-plan-sha SHA256 --approve',
    '  source-reviews.mjs verify --manifest PATH [--review-dir EPISODE_OR_PATH]',
    '',
    'All commands are offline. Only attest writes an approval, and only with explicit human reviewer metadata and --approve.',
  ].join('\n');
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const result = command === 'request'
    ? executeRequest(options)
    : command === 'attest'
      ? executeAttest(options)
      : command === 'verify'
        ? executeVerify(options)
        : null;
  if (!result) throw new Error(`Unknown command: ${command}\n${usage()}`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ success: false, error: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  });
}
