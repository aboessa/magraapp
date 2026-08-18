#!/usr/bin/env node
// Offline compiler from Luna series preproduction manifests to the current
// immutable Content Factory contract. Default mode writes only to stdout.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  ContractError,
  canonicalJson,
  createManifest,
  validateManifest as validateFactoryManifest,
} from '../../content-factory/lib/contract.mjs';
import { estimatePlan, PRICING_VERSION } from '../../content-factory/lib/costs.mjs';
import {
  buildPrompt,
  buildVisualPrompt,
  validatePreproductionManifest,
} from './production.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const SERIES_ROOT = path.resolve(import.meta.dirname);
const MANIFEST_ROOT = path.join(SERIES_ROOT, 'manifests');
const FACTORY_OUTPUT_ROOT = path.join(SERIES_ROOT, 'factory-manifests');
const SOURCE_SCHEMA = 'luna-series.preproduction/v1';
const FACTORY_PROFILE = 'cartoon_video_model_audio';
const SUPPORTED_SOURCE_REVIEW_TYPES = new Set([
  'editorial',
  'educational',
  'age_safety',
  'scientific',
  'historical',
  'sleep',
  'religious',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

function assertConfined(base, candidate, label, { allowBase = false } = {}) {
  const relation = path.relative(base, candidate);
  if (relation.startsWith('..') || path.isAbsolute(relation) || (!allowBase && relation === '')) {
    throw new Error(`${label} escapes ${relative(base)}`);
  }
}

function projectedRealPath(candidate) {
  let existing = path.resolve(candidate);
  const missingSegments = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error(`Cannot resolve an existing ancestor for ${candidate}`);
    missingSegments.unshift(path.basename(existing));
    existing = parent;
  }
  const stat = fs.lstatSync(existing);
  if (stat.isSymbolicLink()) throw new Error(`Existing ancestor is a symbolic link or junction: ${relative(existing)}`);
  return path.resolve(fs.realpathSync.native(existing), ...missingSegments);
}

function validateOutputAncestry(destination) {
  const parent = path.dirname(destination);
  assertConfined(SERIES_ROOT, parent, '--out parent', { allowBase: true });
  const seriesReal = fs.realpathSync.native(SERIES_ROOT);
  const relation = path.relative(SERIES_ROOT, parent);
  const segments = relation === '' ? [] : relation.split(path.sep);
  let current = SERIES_ROOT;
  for (const segment of segments) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) continue;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`--out rejects symbolic-link or junction ancestor: ${relative(current)}`);
    }
    if (!stat.isDirectory()) throw new Error(`--out ancestor is not a directory: ${relative(current)}`);
    const expectedReal = path.resolve(seriesReal, path.relative(SERIES_ROOT, current));
    const actualReal = fs.realpathSync.native(current);
    const normalize = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
    if (normalize(actualReal) !== normalize(expectedReal)) {
      throw new Error(`--out rejects reparse-point ancestor: ${relative(current)}`);
    }
  }
  const realRoot = projectedRealPath(FACTORY_OUTPUT_ROOT);
  const realParent = projectedRealPath(parent);
  assertConfined(realRoot, realParent, 'real --out parent', { allowBase: true });
}

function resolveSourceManifest(value) {
  if (typeof value !== 'string' || value.length === 0) throw new Error('--manifest requires a path');
  const resolved = path.resolve(ROOT, value);
  assertConfined(MANIFEST_ROOT, resolved, '--manifest');
  if (path.extname(resolved).toLowerCase() !== '.json') throw new Error('--manifest must be JSON');
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error(`Manifest is missing: ${relative(resolved)}`);
  return resolved;
}

function resolveOutput(value) {
  if (typeof value !== 'string' || value.length === 0) throw new Error('--out requires a path');
  const hasDirectory = value.includes('/') || value.includes('\\');
  const resolved = path.isAbsolute(value)
    ? path.resolve(value)
    : hasDirectory
      ? path.resolve(ROOT, value)
      : path.resolve(FACTORY_OUTPUT_ROOT, value);
  assertConfined(FACTORY_OUTPUT_ROOT, resolved, '--out');
  if (path.extname(resolved).toLowerCase() !== '.json') throw new Error('--out must end in .json');
  return resolved;
}

function assertSourcePreconditions(source, sourcePath) {
  const errors = [];
  if (source.schema_version !== SOURCE_SCHEMA) errors.push(`expected ${SOURCE_SCHEMA}`);
  if (source.source?.content_status !== 'draft') errors.push('source content_status must remain draft');
  if (source.pipeline?.dispatch_blocked !== true || source.reviews?.dispatch_blocked !== true) {
    errors.push('source preproduction manifest must retain dispatch blocks');
  }
  if (source.pipeline?.factory_profile !== FACTORY_PROFILE) errors.push(`factory_profile must be ${FACTORY_PROFILE}`);
  if (!Array.isArray(source.clips) || source.clips.length === 0) errors.push('source clips are required');
  if ((source.clips ?? []).reduce((sum, clip) => sum + clip.duration_seconds, 0) !== 180) errors.push('source clips must total 180 seconds');
  if (source.budget?.baseline_credits !== 9
    || source.budget?.contingency_credits !== 1.35
    || source.budget?.ceiling_credits !== 10.35) {
    errors.push('source budget must remain 9/1.35/10.35 credits');
  }
  const expectedPath = path.resolve(ROOT, source.source?.path ?? '');
  assertConfined(ROOT, expectedPath, 'source.path');
  if (!fs.existsSync(expectedPath) || !fs.statSync(expectedPath).isFile()) {
    errors.push(`episode source is missing: ${source.source?.path}`);
  } else if (sha256(fs.readFileSync(expectedPath)) !== source.source.sha256) {
    errors.push('episode source SHA-256 is stale');
  }
  if (errors.length) {
    const error = new Error(`Cannot compile ${relative(sourcePath)}`);
    error.diagnostics = errors;
    throw error;
  }
}

function sourceReviews(source) {
  return source.reviews.required
    .filter((review) => SUPPORTED_SOURCE_REVIEW_TYPES.has(review.review_type))
    .map((review) => ({
      review_type: review.review_type,
      required: review.required,
      status: review.status,
      source_sha256: review.source_sha256,
      notes: `Preserved from ${source.schema_version}; dispatch remains blocked.`,
    }));
}

function rawJobs(source, sourcePlanSha256) {
  return source.clips.map((clip) => {
    const prompt = buildPrompt(source, clip);
    if (prompt.length >= 10_000) throw new Error(`${clip.id} prompt exceeds the enforced 10,000-character limit`);
    return {
      job_id: clip.id.toLowerCase(),
      kind: 'video',
      provider: source.pipeline.factory_provider,
      operation: source.pipeline.operation,
      duration_seconds: clip.duration_seconds,
      dependencies: [],
      input: {
        prompt,
        prompt_sha256: sha256(prompt),
        visual_prompt_sha256: sha256(buildVisualPrompt(source, clip)),
        source_plan_sha256: sourcePlanSha256,
        source_range: clip.source_range,
        scene_number: clip.editorial_scene,
        output_file: clip.file,
        aspect_ratio: source.format.aspect_ratio,
        resolution: source.format.resolution,
        exact_spoken_dialogue: clip.exact_spoken_dialogue,
        model_audio_required: true,
        retain_model_audio_in_master: true,
        model_generated_text_forbidden: true,
        ...(source.overlay_plan ? {
          deterministic_overlay_required: true,
          overlay_plan_sha256: source.overlay_plan.overlay_plan_sha256,
          raw_model_video_must_have_blank_glyph_surfaces: true,
        } : {}),
      },
    };
  });
}

function qualityPolicy(source) {
  const automated = [
    'source_hash_and_dialogue_order',
    'video_audio_tracks',
    'clip_duration_and_aspect',
    'motion_and_audio_signal',
    'model_audio_packet_preservation',
  ].map((gateId) => ({ gate_id: gateId, required: true, status: 'not_run' }));
  if (source.overlay_plan) {
    automated.push(
      { gate_id: 'overlay_font_and_plan_hash', required: true, status: 'not_run' },
      { gate_id: 'overlay_evidence_fingerprint', required: true, status: 'not_run' },
    );
  }
  const human = source.reviews.required.map((review) => ({
    gate_id: review.review_type,
    required: review.required,
    status: review.status,
  }));
  human.push({ gate_id: 'clip_visual_and_auditory_review', required: true, status: 'pending' });
  return {
    policy_version: 'luna-series.qc/v1',
    automated_gates: automated,
    human_gates: human,
  };
}

function compile(source, sourcePath) {
  const validated = validatePreproductionManifest(sourcePath);
  if (canonicalJson(validated.manifest) !== canonicalJson(source)) {
    throw new Error('Source manifest changed while full Luna validation was running');
  }
  assertSourcePreconditions(source, sourcePath);
  const sourcePlanSha256 = validated.planSha256;
  const priced = estimatePlan(rawJobs(source, sourcePlanSha256), {
    contingencyPct: 15,
    pricingVersion: PRICING_VERSION,
  });
  if (priced.budget.estimate_low_credits !== source.budget.baseline_credits
    || priced.budget.estimate_high_credits !== source.budget.baseline_credits
    || priced.budget.contingency_credits !== source.budget.contingency_credits
    || priced.budget.estimate_with_contingency_credits !== source.budget.ceiling_credits
    || priced.budget.requested_ceiling_credits !== source.budget.ceiling_credits
    || priced.budget.unpriced_job_ids.length !== 0) {
    throw new Error('Current Content Factory pricing does not match the approved preproduction budget');
  }

  const factoryManifest = createManifest({
    manifest_id: `${source.episode.planet_slug}/${source.episode.series_slug}/${source.episode.episode_id}/v2-3d-audio`,
    revision: 1,
    entity: {
      entity_type: 'episode',
      entity_id: source.episode.episode_id,
      planet_slug: source.episode.planet_slug,
      series_slug: source.episode.series_slug,
      title: source.episode.title_ar,
      locale: source.episode.locale,
      age_min: source.episode.age_min,
      age_max: source.episode.age_max,
      track: 'preschool',
    },
    visual_identity: source.visual_identity,
    source: {
      path: source.source.path,
      sha256: source.source.sha256,
      content_status: 'draft',
      duration_seconds: 180,
      page_count: null,
      reviews: sourceReviews(source),
    },
    pipeline: {
      profile: FACTORY_PROFILE,
      eligibility: 'blocked',
      exclusion_code: null,
      notes: 'Preproduction plan is structurally complete, but immutable pending review blockers prohibit dispatch.',
    },
    preflight: {
      manifest_ready: true,
      scene_plan_ready: true,
      prompt_plan_ready: true,
    },
    jobs: priced.jobs,
    budget: priced.budget,
    quality: qualityPolicy(source),
    blockers: source.blockers.map((blocker) => ({
      code: blocker.code,
      severity: blocker.severity,
      message: blocker.message,
      path: '$.source.reviews',
      details: {
        source_sha256: source.source.sha256,
        preserved_from_preproduction: true,
      },
    })),
    metadata: {
      compiled_from_schema: source.schema_version,
      compiled_from_manifest: relative(sourcePath),
      source_preproduction_plan_sha256: sourcePlanSha256,
      production_id: source.production_id,
      output_root: source.output_root,
      source_normalizations: source.source.normalizations,
      source_overrides: source.source.overrides,
      source_production_notes: source.source.production_notes,
      source_review_requirements: source.reviews.required,
      original_pipeline_profile: source.pipeline.profile,
      dispatch_blocked: true,
      provider_result_urls_persisted: false,
      packaging_requirements: source.packaging,
      ui_overlays: source.ui_overlays,
      runtime_state_policy: source.runtime_state_policy,
      ...(source.overlay_plan ? {
        deterministic_overlay: {
          required: true,
          renderer_implemented: source.overlay_plan.renderer_implemented,
          overlay_plan_sha256: source.overlay_plan.overlay_plan_sha256,
          selected_font: source.overlay_plan.selected_font,
          license: source.overlay_plan.license,
          linguistic_and_calligraphy_review_required: true,
          finalization_blockers: source.finalization_blockers,
        },
      } : {}),
    },
  });

  const contractResult = validateFactoryManifest(factoryManifest);
  if (!contractResult.valid) throw new ContractError('Compiled manifest failed the current Content Factory contract', contractResult.errors);
  if (factoryManifest.spend_approval !== null) throw new Error('Compiler must never synthesize spend approval');
  if (factoryManifest.pipeline.eligibility !== 'blocked') throw new Error('Compiler must preserve blocked eligibility');
  return { factoryManifest, sourcePlanSha256 };
}

function pendingDiagnostics(source, factoryManifest) {
  const unsupportedSourceReviewTypes = source.reviews.required
    .map((review) => review.review_type)
    .filter((type) => !SUPPORTED_SOURCE_REVIEW_TYPES.has(type));
  return {
    contract_valid: true,
    contract_schema_version: factoryManifest.schema_version,
    pending_reviews_preserved: true,
    unsupported_source_review_types_preserved_in_metadata_and_human_gates: unsupportedSourceReviewTypes,
    pipeline_eligibility: factoryManifest.pipeline.eligibility,
    dispatch_ready: false,
    spend_approval_present: factoryManifest.spend_approval !== null,
    blocker_codes: factoryManifest.blockers.map((blocker) => blocker.code),
    note: 'The current contract accepts immutable blocked plans with pending reviews. This artifact does not bypass reviews or create approval.',
  };
}

function parseArgs(argv) {
  const options = { manifest: null, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--manifest') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('--manifest requires a path');
      options.manifest = value;
    } else if (argument === '--out') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('--out requires a path');
      options.out = value;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (!options.manifest) throw new Error('Usage: compile-factory.mjs --manifest PATH [--out PATH]');
  return options;
}

function writeNewArtifact(destination, manifest) {
  validateOutputAncestry(destination);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  validateOutputAncestry(destination);
  fs.writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourcePath = resolveSourceManifest(options.manifest);
  const source = readJson(sourcePath);
  const { factoryManifest, sourcePlanSha256 } = compile(source, sourcePath);
  const diagnostics = pendingDiagnostics(source, factoryManifest);

  if (options.out) {
    const destination = resolveOutput(options.out);
    writeNewArtifact(destination, factoryManifest);
    process.stdout.write(`${JSON.stringify({
      mode: 'write-explicit',
      written: true,
      output: relative(destination),
      source_manifest: relative(sourcePath),
      source_preproduction_plan_sha256: sourcePlanSha256,
      factory_plan_sha256: factoryManifest.integrity.plan_sha256,
      job_count: factoryManifest.jobs.length,
      budget: factoryManifest.budget,
      diagnostics,
    }, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify({
    mode: 'dry-run',
    written: false,
    source_manifest: relative(sourcePath),
    source_preproduction_plan_sha256: sourcePlanSha256,
    factory_plan_sha256: factoryManifest.integrity.plan_sha256,
    diagnostics,
    artifact: factoryManifest,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    compiled: false,
    error: error.message,
    diagnostics: error instanceof ContractError ? error.errors : error.diagnostics ?? [],
  }, null, 2)}\n`);
  process.exitCode = 1;
}
