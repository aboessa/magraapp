// Luna E01 v2 — controlled FLUX text-to-video production with model-generated Arabic audio.
//
// Read-only / no-cost commands:
//   node tools/playveo/luna-e01/production-v2-3d-audio.mjs --plan
//   node tools/playveo/luna-e01/production-v2-3d-audio.mjs --status
//
// Resume, poll, validate, and download only provider jobs that already exist in local state:
//   node tools/playveo/luna-e01/production-v2-3d-audio.mjs --run --allow-paid --concurrency 10
//
// New submissions and replacement attempts are disabled here. Author and approve them through
// the content factory so plan identity, spend approval, idempotency, and cost ledger stay binding.
//
// Security: API keys and provider result URLs are never logged or persisted.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { canonicalJson, computeReferencePackSha256 } from '../../content-factory/lib/contract.mjs';
import { approvedVisualIdentityPack } from '../../content-factory/lib/visual-identity-registry.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const MANIFEST_PATH = path.join(import.meta.dirname, 'production-v2-3d-audio.manifest.json');
const MANIFEST = readJson(MANIFEST_PATH);
const OUTPUT_ROOT = path.join(ROOT, MANIFEST.output_root);
const STATE_PATH = path.join(OUTPUT_ROOT, '_production-state.json');
const TERMINAL_PROVIDER = new Set(['completed', 'failed', 'cancelled', 'canceled']);
const RETRYABLE_TERMINAL = new Set(['failed', 'cancelled', 'canceled', 'submission_failed']);
const UNREGISTERED_DRAFT_PACK_HASHES = new Set([
  '9c47c1f2b46f8b1cffb29883da3af430d216b0d9362477abe073a4d32427d028',
]);
let API_KEY;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const next = process.argv[index + 1];
  return next && !next.startsWith('--') ? next : true;
}

function parseEnvValue(filePath, name) {
  if (!fs.existsSync(filePath)) return undefined;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] !== name) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value.trim();
  }
  return undefined;
}

function loadApiKey() {
  if (API_KEY) return API_KEY;
  const candidates = [
    process.env.PLAYVEO_API_KEY?.trim(),
    parseEnvValue(path.join(ROOT, '.env.local'), 'PLAYVEO_API_KEY'),
    parseEnvValue(path.join(ROOT, 'dashboard', 'api', '.dev.vars'), 'PLAYVEO_API_KEY'),
    fs.existsSync(path.join(os.homedir(), '.majarra', 'playveo.key'))
      ? fs.readFileSync(path.join(os.homedir(), '.majarra', 'playveo.key'), 'utf8').trim()
      : undefined,
  ];
  API_KEY = candidates.find((candidate) => candidate && candidate.length > 8);
  if (!API_KEY) throw new Error('PLAYVEO_API_KEY is unavailable to the controlled production runner');
  return API_KEY;
}

function safeError(value) {
  return compact(value)
    .replace(/https?:\/\/[^\s"']+/g, '[provider-url-redacted]')
    .replace(/(?:pv_|AIza)[A-Za-z0-9_-]+/g, '[secret-redacted]')
    .slice(0, 700);
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

function outputPath(relativePath) {
  const resolvedRoot = path.resolve(OUTPUT_ROOT);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const rootPrefix = `${resolvedRoot}${path.sep}`.toLowerCase();
  if (!`${resolved}${path.sep}`.toLowerCase().startsWith(rootPrefix)) {
    throw new Error(`Output path escapes production root: ${relativePath}`);
  }
  return resolved;
}

function quotedArabicLines(scene) {
  return scene.timeline.flatMap((entry) => [...entry.matchAll(/«([^»]+)»/g)].map((match) => match[1]));
}

function buildPrompt(scene) {
  const visual = MANIFEST.visual_direction;
  const audio = MANIFEST.audio_direction;
  return [
    `TASK\nCreate one continuous ${scene.duration_seconds}-second 16:9 HD animated cartoon clip. This is scene ${scene.id} of the same episode. Generate the finished picture, character animation, Arabic performance, lip-sync, ambience, music, and sound effects together inside this video. The supplied timeline is mandatory.`,
    `CURRENT SHOT\n${scene.visual}`,
    `STYLE LOCK — APPLY LITERALLY\n${visual.style}`,
    `LUNA IDENTITY LOCK\n${visual.luna}`,
    `NAJMI IDENTITY LOCK\n${visual.najmi}`,
    `WORLD LOCK\n${visual.world}`,
    `RECURRING PROP LOCK\n${visual.props}`,
    `CAMERA LOCK\n${visual.camera}`,
    `AUDIO PERFORMANCE LOCK\n${audio.voice}\n${audio.dialogue_rule}\n${audio.pronunciation}`,
    `AUDIO MIX LOCK\n${audio.mix}\n${audio.silence_rule}`,
    `EXACT TIMELINE — FOLLOW IN ORDER\n${scene.timeline.map((entry) => `- ${entry}`).join('\n')}`,
    `CRITICAL DELIVERY RULES\nThis is a complete cartoon video, not an illustrated slideshow. Arabic dialogue and all specified sound must be present in the generated clip. Keep the same Luna voice and character identity as every other scene. Do not speak timing instructions or quotation marks. Do not invent dialogue during silent holds. Never replace speech with subtitles.`,
    `NEGATIVE LOCK\n${visual.negative}`,
  ].join('\n\n').trim();
}

function validateManifest() {
  const errors = [];
  if (MANIFEST.schema_version !== 1) errors.push('schema_version must be 1');
  const visualIdentity = MANIFEST.visual_identity;
  if (!visualIdentity || typeof visualIdentity !== 'object' || Array.isArray(visualIdentity)) {
    errors.push('an approved visual_identity reference pack is required');
  } else {
    if (visualIdentity.status !== 'approved') errors.push('visual_identity status must be approved');
    if (visualIdentity.series_slug !== MANIFEST.series_slug) {
      errors.push('visual_identity series_slug must match manifest series_slug');
    }
    if (!Array.isArray(visualIdentity.references) || visualIdentity.references.length === 0) {
      errors.push('visual_identity references must not be empty');
    } else {
      if (!visualIdentity.references.some((reference) => reference?.kind === 'character_sheet')) {
        errors.push('visual_identity must include a character_sheet');
      }
      for (const [index, reference] of visualIdentity.references.entries()) {
        const referencePath = typeof reference?.path === 'string' ? reference.path : '';
        const resolved = path.resolve(ROOT, referencePath);
        const rootPrefix = `${ROOT}${path.sep}`.toLowerCase();
        if (!referencePath || !`${resolved}${path.sep}`.toLowerCase().startsWith(rootPrefix)) {
          errors.push(`visual_identity reference ${index} escapes the repository root`);
          continue;
        }
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
          errors.push(`visual_identity reference is missing: ${referencePath}`);
          continue;
        }
        const actualHash = sha256(fs.readFileSync(resolved));
        if (actualHash !== reference.sha256) {
          errors.push(`visual_identity reference hash mismatch: ${referencePath}`);
        }
        if (reference.kind === 'visual_guide') {
          try {
            const guide = readJson(resolved);
            if (canonicalJson(guide.visual_direction) !== canonicalJson(MANIFEST.visual_direction)
              || canonicalJson(guide.audio_direction) !== canonicalJson(MANIFEST.audio_direction)) {
              errors.push('manifest visual/audio locks drifted from the approved visual guide');
            }
          } catch (error) {
            errors.push(`visual guide cannot be validated: ${safeError(error.message)}`);
          }
        }
      }
    }
    try {
      if (visualIdentity.reference_pack_sha256 !== computeReferencePackSha256(visualIdentity)) {
        errors.push('visual_identity reference_pack_sha256 is stale');
      }
    } catch (error) {
      errors.push(`visual_identity pack cannot be fingerprinted: ${safeError(error.message)}`);
    }
    const registeredPack = approvedVisualIdentityPack(visualIdentity.series_slug, visualIdentity.version);
    if (!registeredPack) {
      errors.push('visual_identity is not present in the trusted registry');
    } else if (registeredPack.identity_id !== visualIdentity.identity_id
      || registeredPack.reference_pack_sha256 !== visualIdentity.reference_pack_sha256
      || registeredPack.approved_by !== visualIdentity.approved_by
      || registeredPack.approved_at !== visualIdentity.approved_at) {
      errors.push('visual_identity does not match the trusted registry entry');
    }
  }
  if (MANIFEST.production_policy?.this_production_mode !== 'cartoon_video') {
    errors.push('this production must be declared as cartoon_video');
  }
  if (MANIFEST.production_policy?.model_audio_required !== true) errors.push('model_audio_required must be true');
  if (MANIFEST.production_policy?.retain_flux_audio_in_master !== true) {
    errors.push('retain_flux_audio_in_master must be true');
  }
  if (MANIFEST.provider?.operation !== 'text-to-video') errors.push('provider operation must be text-to-video');
  if (MANIFEST.execution?.max_concurrency !== 10) errors.push('max_concurrency must be exactly 10');
  if (!String(MANIFEST.output_root).startsWith('assets/')) errors.push('output_root must remain below assets/');
  if (!Array.isArray(MANIFEST.scenes) || MANIFEST.scenes.length !== 10) {
    errors.push(`expected 10 scenes, found ${MANIFEST.scenes?.length ?? 0}`);
  }

  const ids = new Set();
  const files = new Set();
  let totalDuration = 0;
  let dialogueCount = 0;
  for (const scene of MANIFEST.scenes ?? []) {
    if (!/^S\d{2}$/.test(scene.id)) errors.push(`invalid scene id: ${scene.id}`);
    if (ids.has(scene.id)) errors.push(`duplicate scene id: ${scene.id}`);
    ids.add(scene.id);
    if (files.has(scene.file)) errors.push(`duplicate output file: ${scene.file}`);
    files.add(scene.file);
    if (!String(scene.file).endsWith('.mp4')) errors.push(`${scene.id} output must be MP4`);
    if (!Number.isInteger(scene.duration_seconds) || scene.duration_seconds < 5 || scene.duration_seconds > 20) {
      errors.push(`${scene.id} duration must be an integer from 5 to 20 seconds`);
    }
    totalDuration += Number(scene.duration_seconds) || 0;
    if (!Array.isArray(scene.timeline) || !scene.timeline.length) errors.push(`${scene.id} timeline is empty`);
    dialogueCount += quotedArabicLines(scene).length;
    const prompt = buildPrompt(scene);
    if (prompt.length > 10_000) errors.push(`${scene.id} prompt exceeds 10,000 characters (${prompt.length})`);
    for (const line of quotedArabicLines(scene)) {
      if (!/[\u0600-\u06ff]/.test(line)) errors.push(`${scene.id} has a quoted line without Arabic text`);
    }
  }

  if (totalDuration !== MANIFEST.execution.expected_total_seconds) {
    errors.push(`scene duration total is ${totalDuration}, expected ${MANIFEST.execution.expected_total_seconds}`);
  }
  if (totalDuration !== MANIFEST.acceptance.duration_seconds) {
    errors.push(`acceptance duration is ${MANIFEST.acceptance.duration_seconds}, but scenes total ${totalDuration}`);
  }
  if (dialogueCount !== 32) errors.push(`expected 32 exact Arabic dialogue lines, found ${dialogueCount}`);
  if (MANIFEST.acceptance.audio_track_required_per_clip !== true) errors.push('every clip must require an audio track');
  if (MANIFEST.acceptance.model_generated_dialogue_required !== true) errors.push('model dialogue must be required');
  if (MANIFEST.acceptance.external_dub_forbidden !== true) errors.push('external dubbing must be forbidden');
  if (MANIFEST.acceptance.final_master_must_retain_clip_audio !== true) {
    errors.push('final master must retain model clip audio');
  }

  if (errors.length) throw new Error(`Manifest validation failed:\n- ${errors.join('\n- ')}`);
  return {
    sceneCount: MANIFEST.scenes.length,
    durationSeconds: totalDuration,
    dialogueLines: dialogueCount,
    maximumPromptCharacters: Math.max(...MANIFEST.scenes.map((scene) => buildPrompt(scene).length)),
  };
}

function plannedJob(scene) {
  const prompt = buildPrompt(scene);
  return {
    key: `video/${scene.id}`,
    scene_id: scene.id,
    operation: 'text-to-video',
    prompt,
    prompt_sha256: sha256(prompt),
    visual_identity_pack_sha256: MANIFEST.visual_identity.reference_pack_sha256,
    dialogue: quotedArabicLines(scene),
    duration_seconds: scene.duration_seconds,
    aspect_ratio: MANIFEST.execution.aspect_ratio,
    resolution: MANIFEST.execution.resolution,
    output_file: scene.file,
    status: 'planned',
    job_id: null,
    provider_model: null,
    credit_cost: null,
    submitted_at: null,
    completed_at: null,
    last_polled_at: null,
    error: null,
    media: null,
  };
}

function newState() {
  return {
    schema_version: 1,
    production_id: MANIFEST.production_id,
    visual_identity: {
      identity_id: MANIFEST.visual_identity.identity_id,
      version: MANIFEST.visual_identity.version,
      reference_pack_sha256: MANIFEST.visual_identity.reference_pack_sha256,
    },
    provider: MANIFEST.provider.name,
    provider_base_url: MANIFEST.provider.base_url,
    provider_result_urls_persisted: false,
    operation: 'text-to-video-with-model-audio',
    production_policy: {
      mode: MANIFEST.production_policy.this_production_mode,
      model_audio_required: true,
      external_tts_used: false,
      retain_flux_audio_in_master: true,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    review: { clips: { status: 'pending' } },
    jobs: [],
  };
}

function mergeState() {
  const state = fs.existsSync(STATE_PATH) ? readJson(STATE_PATH) : newState();
  if (state.production_id !== MANIFEST.production_id) {
    throw new Error('Existing state belongs to a different production_id');
  }
  const currentVisualIdentity = {
    identity_id: MANIFEST.visual_identity.identity_id,
    version: MANIFEST.visual_identity.version,
    reference_pack_sha256: MANIFEST.visual_identity.reference_pack_sha256,
  };
  const persistedPackHash = state.visual_identity?.reference_pack_sha256;
  if (persistedPackHash
    && persistedPackHash !== currentVisualIdentity.reference_pack_sha256
    && !UNREGISTERED_DRAFT_PACK_HASHES.has(persistedPackHash)
    && (state.jobs ?? []).some((job) => job.job_id)) {
    throw new Error('Visual identity pack changed after paid submission; archive the old output/state before changing it');
  }
  state.visual_identity = currentVisualIdentity;
  const oldJobs = new Map((state.jobs ?? []).map((job) => [job.key, job]));
  state.jobs = MANIFEST.scenes.map((scene) => {
    const desired = plannedJob(scene);
    const old = oldJobs.get(desired.key);
    if (!old) return desired;
    const compatible = old.operation === desired.operation &&
      old.prompt_sha256 === desired.prompt_sha256 &&
      (!old.visual_identity_pack_sha256
        || old.visual_identity_pack_sha256 === desired.visual_identity_pack_sha256
        || UNREGISTERED_DRAFT_PACK_HASHES.has(old.visual_identity_pack_sha256)) &&
      old.duration_seconds === desired.duration_seconds &&
      old.output_file === desired.output_file;
    if (!compatible && old.job_id) {
      throw new Error(`Manifest signature changed after paid submission for ${desired.key}; archive the old output/state before changing it`);
    }
    return compatible ? {
      ...desired,
      ...old,
      prompt: desired.prompt,
      dialogue: desired.dialogue,
      visual_identity_pack_sha256: desired.visual_identity_pack_sha256,
    } : desired;
  });
  state.review ??= { clips: { status: 'pending' } };
  state.review.clips ??= { status: 'pending' };
  return state;
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  state.updated_at = new Date().toISOString();
  const temporary = `${STATE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(temporary, STATE_PATH);
}

async function api(method, route, body) {
  if (method === 'POST') {
    throw new Error('Standalone paid submissions are disabled; use the content factory');
  }
  const response = await fetch(`${MANIFEST.provider.base_url}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${loadApiKey()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(method === 'POST' ? 240_000 : 180_000),
  });
  const text = await response.text();
  if (response.status === 401) throw Object.assign(new Error('PlayVeo authentication failed'), { httpStatus: 401 });
  if (response.status === 402) throw Object.assign(new Error('PlayVeo credits are insufficient'), { httpStatus: 402 });
  if (response.status === 429) throw Object.assign(new Error('PlayVeo rate limit reached'), { httpStatus: 429 });
  if (!response.ok) {
    throw Object.assign(
      new Error(`PlayVeo ${method} ${route} failed (${response.status}): ${safeError(text)}`),
      { httpStatus: response.status },
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`PlayVeo ${method} ${route} returned non-JSON content`);
  }
}

function entity(response) {
  return response?.video ?? response?.job ?? response;
}

function normalizedStatus(response) {
  return compact(entity(response)?.status ?? response?.status).toLowerCase() || 'unknown';
}

function jobId(response) {
  return response?.id ?? response?.video?.id ?? response?.job?.id ?? null;
}

function resultUrl(response) {
  const item = entity(response);
  const list = item?.resultUrls ?? item?.result_urls ?? item?.urls;
  if (Array.isArray(list) && typeof list[0] === 'string') return list[0];
  return item?.videoUrl ?? item?.video_url ?? item?.resultUrl ?? item?.result_url ?? item?.url ?? null;
}

function providerFailure(response) {
  const item = entity(response);
  return safeError(item?.error ?? item?.errorMessage ?? response?.error ?? 'Provider reported failure');
}

function routeFor(job) {
  return MANIFEST.provider.get_route.replace('{id}', job.job_id);
}

function inspectVideo(bytes) {
  const head = bytes.subarray(0, 128);
  const hasFtyp = head.indexOf(Buffer.from('ftyp')) >= 0;
  const hasVideoTrack = bytes.indexOf(Buffer.from('vide')) >= 0;
  const hasAudioTrack = bytes.indexOf(Buffer.from('soun')) >= 0;
  return {
    ok: bytes.length > 10_000 && hasFtyp && hasVideoTrack && hasAudioTrack,
    format: hasFtyp ? 'mp4' : 'unknown',
    bytes: bytes.length,
    has_ftyp: hasFtyp,
    has_video_track: hasVideoTrack,
    has_audio_track: hasAudioTrack,
    sha256: sha256(bytes),
  };
}

async function downloadBytes(url) {
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('Provider returned no HTTPS result URL');
  }
  const attempt = async (headers, label) => {
    const response = await fetch(url, {
      ...(headers ? { headers } : {}),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      const error = new Error(`Media download ${label} failed (${response.status})`);
      error.httpStatus = response.status;
      throw error;
    }
    return Buffer.from(await response.arrayBuffer());
  };
  try {
    return await attempt(undefined, 'without bearer');
  } catch (publicError) {
    try {
      return await attempt({ Authorization: `Bearer ${loadApiKey()}` }, 'with bearer');
    } catch (authenticatedError) {
      throw new Error(
        `Media download failed both ways: public=${safeError(publicError.message)}; bearer=${safeError(authenticatedError.message)}`,
      );
    }
  }
}

async function submitJob(state, job) {
  try {
    const payload = {
      prompt: job.prompt,
      duration_seconds: job.duration_seconds,
      aspect_ratio: job.aspect_ratio,
      resolution: job.resolution,
    };
    // Deliberately no start_frame: this v2 is true text-to-video so the old flat
    // local composites cannot constrain the new dimensional 3D art direction.
    const response = await api('POST', MANIFEST.provider.create_route, payload);
    const id = jobId(response);
    if (!id) throw new Error('Provider submission returned no job ID');
    job.job_id = String(id);
    job.status = normalizedStatus(response);
    if (TERMINAL_PROVIDER.has(job.status) === false && !job.status) job.status = 'submitted';
    job.provider_model = response?.model ?? entity(response)?.model ?? null;
    const cost = Number(response?.creditCost ?? response?.credit_cost ?? entity(response)?.creditCost);
    job.credit_cost = Number.isFinite(cost) ? cost : null;
    job.submitted_at = new Date().toISOString();
    job.error = null;
    saveState(state);
    console.log(`submitted ${job.scene_id} -> ${job.job_id} (${job.status}, declared cost=${job.credit_cost ?? 'unreported'})`);
  } catch (error) {
    job.status = 'submission_failed';
    job.error = safeError(error.message);
    saveState(state);
    console.error(`FAILED submit ${job.scene_id}: ${job.error}`);
    if ([401, 402].includes(error.httpStatus)) throw error;
  }
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitAndDownload(state, job) {
  const deadline = Date.now() + MANIFEST.execution.timeout_minutes * 60_000;
  let lastStatus = '';
  let transientErrors = 0;

  while (Date.now() < deadline) {
    try {
      const response = await api('GET', routeFor(job));
      transientErrors = 0;
      const status = normalizedStatus(response);
      const item = entity(response);
      job.status = status;
      job.last_polled_at = new Date().toISOString();
      job.provider_duration_seconds = item?.duration ?? item?.durationSeconds ?? null;
      job.provider_resolution = item?.resolution ?? null;
      job.provider_aspect_ratio = item?.aspectRatio ?? item?.aspect_ratio ?? null;
      if (status !== lastStatus) {
        console.log(`${job.scene_id}: ${status}`);
        lastStatus = status;
      }

      if (status === 'completed') {
        const url = resultUrl(response);
        if (typeof url === 'string' && url.startsWith('https://')) {
          console.log(`${job.scene_id}: downloading from ${new URL(url).host}`);
        }
        let bytes;
        try {
          bytes = await downloadBytes(url);
        } catch (error) {
          job.status = 'download_failed';
          job.error = safeError(error.message);
          saveState(state);
          console.error(`FAILED download ${job.scene_id}: ${job.error}`);
          return;
        }
        const inspection = inspectVideo(bytes);
        if (!inspection.ok) {
          const rejected = outputPath(`_rejected/${job.scene_id}-${Date.now()}.bin`);
          fs.mkdirSync(path.dirname(rejected), { recursive: true });
          fs.writeFileSync(rejected, bytes);
          job.status = 'validation_failed';
          job.media = { ...inspection, rejected_file: relative(rejected) };
          job.error = 'Downloaded result failed MP4 video-plus-audio structural validation';
          saveState(state);
          console.error(`FAILED validation ${job.scene_id}: ${JSON.stringify(job.media)}`);
          return;
        }
        const destination = outputPath(job.output_file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, bytes);
        job.status = 'completed';
        job.media = inspection;
        job.completed_at = new Date().toISOString();
        job.error = null;
        saveState(state);
        console.log(`saved ${relative(destination)} (${inspection.bytes} bytes; video=true; audio=true)`);
        return;
      }

      if (['failed', 'cancelled', 'canceled'].includes(status)) {
        job.completed_at = new Date().toISOString();
        job.error = providerFailure(response);
        saveState(state);
        console.error(`FAILED ${job.scene_id}: ${job.error}`);
        return;
      }
      saveState(state);
    } catch (error) {
      if (error.httpStatus === 429) {
        await sleep(15_000);
        continue;
      }
      transientErrors += 1;
      job.last_polled_at = new Date().toISOString();
      job.error = safeError(error.message);
      saveState(state);
      if (transientErrors >= 5) {
        job.status = 'polling_failed';
        saveState(state);
        console.error(`PAUSED polling ${job.scene_id}: ${job.error}`);
        return;
      }
    }
    await sleep(MANIFEST.execution.poll_interval_seconds * 1000);
  }

  job.status = 'timed_out';
  job.error = `Provider job did not finish within ${MANIFEST.execution.timeout_minutes} minutes; rerun normally to resume polling without resubmission`;
  saveState(state);
  console.error(`TIMEOUT ${job.scene_id}; job ID retained, no replacement submitted`);
}

async function runPool(items, limit, worker) {
  if (!items.length) return;
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

function selectedJobs(state) {
  const only = argValue('only');
  if (only === true) throw new Error('--only requires comma-separated scene IDs, for example --only S05,S09');
  if (!only) return state.jobs;
  const requested = new Set(String(only).split(',').map((value) => value.trim().toUpperCase()).filter(Boolean));
  const jobs = state.jobs.filter((job) => requested.has(job.scene_id));
  const missing = [...requested].filter((id) => !jobs.some((job) => job.scene_id === id));
  if (missing.length) throw new Error(`Unknown --only scene ID(s): ${missing.join(', ')}`);
  return jobs;
}

function archiveAttempt(job, reason) {
  job.attempts ??= [];
  job.attempts.push({
    job_id: job.job_id,
    status: job.status,
    provider_model: job.provider_model,
    credit_cost: job.credit_cost,
    submitted_at: job.submitted_at,
    completed_at: job.completed_at,
    last_polled_at: job.last_polled_at,
    error: job.error,
    archived_at: new Date().toISOString(),
    archive_reason: reason,
  });
  job.status = 'planned';
  job.job_id = null;
  job.provider_model = null;
  job.credit_cost = null;
  job.submitted_at = null;
  job.completed_at = null;
  job.last_polled_at = null;
  job.error = null;
  job.media = null;
  delete job.provider_duration_seconds;
  delete job.provider_resolution;
  delete job.provider_aspect_ratio;
}

function prepareRetries(state, jobs) {
  let changed = false;
  if (hasArg('retry-failed')) {
    for (const job of jobs) {
      if (!RETRYABLE_TERMINAL.has(job.status)) continue;
      archiveAttempt(job, 'explicit --retry-failed');
      changed = true;
    }
  }
  if (hasArg('replace-timed-out')) {
    if (!hasArg('allow-paid')) throw new Error('--replace-timed-out also requires --allow-paid');
    for (const job of jobs) {
      if (!['timed_out', 'polling_failed'].includes(job.status)) continue;
      archiveAttempt(job, 'explicit --replace-timed-out; duplicate-charge risk accepted');
      changed = true;
    }
  }
  if (changed) saveState(state);
}

async function runProduction(state) {
  if (!hasArg('allow-paid')) throw new Error('Existing provider-job resume requires the explicit --allow-paid acknowledgement');
  if (hasArg('retry-failed') || hasArg('replace-timed-out')) {
    throw new Error('New or replacement paid submissions are disabled in this standalone runner; use the content factory');
  }
  const requestedConcurrency = Number(argValue('concurrency') ?? MANIFEST.execution.max_concurrency);
  if (!Number.isInteger(requestedConcurrency) || requestedConcurrency < 1 || requestedConcurrency > 10) {
    throw new Error('--concurrency must be an integer from 1 to 10');
  }

  const jobs = selectedJobs(state);
  prepareRetries(state, jobs);
  const planned = jobs.filter((job) => job.status === 'planned' && !job.job_id);
  if (planned.length) {
    throw new Error(
      `${planned.length} scene(s) need a new paid submission; standalone submission is disabled, use the content factory`,
    );
  }

  const pollable = jobs.filter((job) => job.job_id && (
    !TERMINAL_PROVIDER.has(job.status) ||
    (job.status === 'completed' && (!job.media?.ok || !fs.existsSync(outputPath(job.output_file))))
  ));
  if (pollable.length) {
    console.log(`Polling/downloading ${pollable.length} job(s) concurrently (limit=${requestedConcurrency}).`);
    await runPool(pollable, requestedConcurrency, async (job) => waitAndDownload(state, job));
  }

  const completed = jobs.filter((job) =>
    job.status === 'completed' &&
    job.media?.ok &&
    job.media?.has_video_track &&
    job.media?.has_audio_track &&
    fs.existsSync(outputPath(job.output_file)),
  );
  const unresolved = jobs.filter((job) => !completed.includes(job));
  console.log(`selected result: completed=${completed.length}/${jobs.length}, unresolved=${unresolved.length}`);
  if (unresolved.length) {
    console.log(`unresolved scenes: ${unresolved.map((job) => `${job.scene_id}:${job.status}`).join(', ')}`);
    process.exitCode = 1;
  }
}

function costSummary(state) {
  let declaredGross = 0;
  let completedCurrent = 0;
  let failedOrArchived = 0;
  for (const job of state.jobs) {
    const current = Number(job.credit_cost);
    if (Number.isFinite(current)) {
      declaredGross += current;
      if (job.status === 'completed') completedCurrent += current;
      else failedOrArchived += current;
    }
    for (const attempt of job.attempts ?? []) {
      const amount = Number(attempt.credit_cost);
      if (Number.isFinite(amount)) {
        declaredGross += amount;
        failedOrArchived += amount;
      }
    }
  }
  return { declaredGross, completedCurrent, failedOrArchived };
}

function printPlan(state, validation) {
  console.log(`Production: ${MANIFEST.production_id}`);
  console.log(`Validated: ${validation.sceneCount} scenes, ${validation.durationSeconds}s, ${validation.dialogueLines} exact Arabic dialogue lines.`);
  console.log(`Visual identity: ${MANIFEST.visual_identity.identity_id} @ ${MANIFEST.visual_identity.reference_pack_sha256}`);
  console.log(`Largest prompt: ${validation.maximumPromptCharacters} characters (limit enforced at 10,000).`);
  console.log('Mode: true FLUX text-to-video; no old 2D start frame is attached.');
  console.log('Dispatch: standalone POST and replacement submissions are disabled; use the content factory.');
  console.log('Audio: generated inside every clip; Arabic speech + ambience + music + effects; external TTS forbidden.');
  console.log(`Parallelism: up to ${MANIFEST.execution.max_concurrency}; estimated provider cost: ${MANIFEST.execution.estimated_credit_cost.toFixed(2)} credits.`);
  console.log(`Output: ${relative(OUTPUT_ROOT)}`);
  console.log(`State: ${relative(STATE_PATH)}`);
  console.log('No API request was sent by --plan.');
  const alreadySubmitted = state.jobs.filter((job) => job.job_id).length;
  if (alreadySubmitted) console.log(`Existing resumable provider jobs in state: ${alreadySubmitted}`);
}

function printStatus(state) {
  for (const job of state.jobs) {
    const media = job.media?.ok
      ? `mp4=${job.media.has_video_track ? 'yes' : 'no'}, audio=${job.media.has_audio_track ? 'yes' : 'no'}, bytes=${job.media.bytes}`
      : 'local media=pending';
    console.log(`${job.scene_id} ${String(job.status).padEnd(18)} ${media} cost=${job.credit_cost ?? 'unreported'}`);
  }
  const counts = state.jobs.reduce((result, job) => {
    result[job.status] = (result[job.status] ?? 0) + 1;
    return result;
  }, {});
  const costs = costSummary(state);
  console.log(`Counts: ${Object.entries(counts).map(([status, count]) => `${status}=${count}`).join(', ')}`);
  console.log(`Declared gross submissions: ${costs.declaredGross.toFixed(2)} credits`);
  console.log(`Declared current completed: ${costs.completedCurrent.toFixed(2)} credits`);
  if (costs.failedOrArchived) {
    console.log(`Declared failed/non-current attempts: ${costs.failedOrArchived.toFixed(2)} credits (refund status is not inferable here)`);
  }
  console.log(`Review gate: ${state.review.clips.status}`);
  console.log(`Output root: ${relative(OUTPUT_ROOT)}`);
}

function clipFingerprint(state) {
  return state.jobs
    .map((job) => ({ scene_id: job.scene_id, sha256: job.media?.sha256 ?? null }))
    .sort((a, b) => a.scene_id.localeCompare(b.scene_id));
}

function approveClips(state) {
  for (const job of state.jobs) {
    const destination = outputPath(job.output_file);
    if (job.status !== 'completed' || !job.media?.ok || !job.media?.has_audio_track || !fs.existsSync(destination)) {
      throw new Error(`Cannot approve clips: ${job.scene_id} is not a validated local MP4 with audio`);
    }
  }
  state.review.clips = {
    status: 'approved',
    approved_at: new Date().toISOString(),
    basis: 'manual visual-and-auditory review by runner operator',
    fingerprint: clipFingerprint(state),
  };
  saveState(state);
  console.log('approved clips gate: ten local MP4 files with audio are fingerprinted');
}

async function main() {
  const validation = validateManifest();
  const state = mergeState();
  saveState(state);
  let acted = false;

  if (hasArg('run')) {
    await runProduction(state);
    acted = true;
  }
  if (hasArg('approve-clips')) {
    approveClips(state);
    acted = true;
  }
  if (hasArg('status')) {
    printStatus(state);
    acted = true;
  }
  if (hasArg('plan') || !acted) printPlan(state, validation);
}

main().catch((error) => {
  console.error(`ERROR: ${safeError(error.message)}`);
  process.exit(1);
});
