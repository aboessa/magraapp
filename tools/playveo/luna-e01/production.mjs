// Luna E01 — controlled PlayVeo Images + FLUX production runner.
//
// Safe/read-only usage from the repository root:
//   node tools/playveo/luna-e01/production.mjs --plan
//   node tools/playveo/luna-e01/production.mjs --status
//
// Paid phases require an explicit flag and are dependency-gated:
//   node tools/playveo/luna-e01/production.mjs --phase sheet  --allow-paid
//   node tools/playveo/luna-e01/production.mjs --approve sheet
//   node tools/playveo/luna-e01/production.mjs --phase probe  --allow-paid
//   node tools/playveo/luna-e01/production.mjs --approve probe
//   node tools/playveo/luna-e01/production.mjs --phase images --allow-paid --concurrency 10
//   node tools/playveo/luna-e01/production.mjs --approve images
//   node tools/playveo/luna-e01/production.mjs --phase videos --allow-paid --concurrency 10
//   node tools/playveo/luna-e01/production.mjs --approve videos
//
// The optional text-only image fallback is deliberately noisy and cannot run by
// accident:
//   ... --phase images --image-mode text --allow-text-fallback --allow-paid
//
// Security: the API key and provider result URLs are never logged or persisted.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const MANIFEST_PATH = path.join(import.meta.dirname, 'production.manifest.json');
const MANIFEST = readJson(MANIFEST_PATH);
const OUTPUT_ROOT = path.join(ROOT, MANIFEST.output_root);
const STATE_PATH = path.join(OUTPUT_ROOT, '_production-state.json');
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'canceled']);
const ACTIVE = new Set(['pending', 'queued', 'processing', 'running', 'submitted', 'unknown']);
const PHASES = new Set(['sheet', 'probe', 'images', 'videos']);
const GATES = new Set(['sheet', 'probe', 'images', 'videos']);
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

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const next = process.argv[index + 1];
  return next && !next.startsWith('--') ? next : true;
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
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
    .slice(0, 600);
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

function outputPath(relativePath) {
  const resolved = path.resolve(OUTPUT_ROOT, relativePath);
  const prefix = `${path.resolve(OUTPUT_ROOT)}${path.sep}`.toLowerCase();
  if (!`${resolved}${path.sep}`.toLowerCase().startsWith(prefix)) {
    throw new Error(`Output path escapes production root: ${relativePath}`);
  }
  return resolved;
}

function validateManifest() {
  const errors = [];
  if (MANIFEST.schema_version !== 1) errors.push('schema_version must be 1');
  if (MANIFEST.execution.max_concurrency !== 10) errors.push('max_concurrency must be exactly 10');
  if (!String(MANIFEST.output_root).startsWith('assets/')) errors.push('output_root must stay under ignored assets/');
  const canonical = path.join(ROOT, MANIFEST.canon.source_image);
  if (!fs.existsSync(canonical)) errors.push(`canonical source is missing: ${MANIFEST.canon.source_image}`);
  if (MANIFEST.scenes.length !== 10) errors.push(`expected 10 scenes, found ${MANIFEST.scenes.length}`);
  if (MANIFEST.narration.length !== 32) errors.push(`expected 32 narration lines, found ${MANIFEST.narration.length}`);

  let cursor = 0;
  const sceneIds = new Set();
  const files = new Set();
  for (const scene of MANIFEST.scenes) {
    if (sceneIds.has(scene.id)) errors.push(`duplicate scene id ${scene.id}`);
    sceneIds.add(scene.id);
    if (scene.start_seconds !== cursor) errors.push(`${scene.id} starts at ${scene.start_seconds}, expected ${cursor}`);
    if (!Number.isInteger(scene.duration_seconds) || scene.duration_seconds < 5 || scene.duration_seconds > 20) {
      errors.push(`${scene.id} duration must be an integer from 5 to 20 seconds`);
    }
    cursor += scene.duration_seconds;
    for (const file of [scene.image_file, scene.video_file]) {
      if (files.has(file)) errors.push(`duplicate output file ${file}`);
      files.add(file);
    }
  }
  if (cursor !== MANIFEST.acceptance.duration_seconds) {
    errors.push(`scene duration total is ${cursor}, expected ${MANIFEST.acceptance.duration_seconds}`);
  }

  for (const line of MANIFEST.narration) {
    if (!sceneIds.has(line.scene)) errors.push(`${line.id} references unknown scene ${line.scene}`);
    if (!Number.isInteger(line.cue_ms) || line.cue_ms < 0 || line.cue_ms >= cursor * 1000) {
      errors.push(`${line.id} has invalid cue_ms ${line.cue_ms}`);
    }
    const words = compact(line.text).split(' ').filter(Boolean).length;
    if (words > 6) errors.push(`${line.id} exceeds six words (${words})`);
  }

  if (errors.length) throw new Error(`Manifest validation failed:\n- ${errors.join('\n- ')}`);
  return { sceneCount: MANIFEST.scenes.length, durationSeconds: cursor, narrationLines: MANIFEST.narration.length };
}

function lunaPrompt(scene) {
  return scene.characters.includes('luna') ? MANIFEST.canon.luna_lock : 'Luna is not visible in this frame.';
}

function najmiPrompt(scene) {
  return scene.characters.includes('najmi') ? MANIFEST.canon.najmi_lock : 'Najmi is not visible in this frame.';
}

function buildScenePrompt(scene, operation) {
  return compact([
    operation === 'image-to-image'
      ? 'Use the attached combined sheet only to preserve exact identity and prop design. Completely replace its sheet layout with the requested story scene.'
      : 'Create the requested story scene with exact continuity across this ten-image production set.',
    scene.image_prompt,
    lunaPrompt(scene),
    najmiPrompt(scene),
    MANIFEST.canon.prop_lock,
    'Apply the prop lock only to objects explicitly named in this scene; do not add the other recurring props.',
    MANIFEST.canon.world_lock,
    MANIFEST.canon.style_lock,
    MANIFEST.canon.negative_lock,
  ].join(' '));
}

function buildSheetPrompt() {
  return compact([
    MANIFEST.character_sheet.prompt,
    MANIFEST.canon.luna_lock,
    MANIFEST.canon.najmi_lock,
    MANIFEST.canon.prop_lock,
    MANIFEST.canon.style_lock,
    MANIFEST.canon.negative_lock,
  ].join(' '));
}

function buildProbePrompt() {
  return compact([
    MANIFEST.reference_probe.prompt,
    MANIFEST.canon.luna_lock,
    MANIFEST.canon.najmi_lock,
    MANIFEST.canon.world_lock,
    MANIFEST.canon.style_lock,
    MANIFEST.canon.negative_lock,
  ].join(' '));
}

function plannedJob({ key, phase, kind, operation, prompt, output, source, durationSeconds, sceneId }) {
  return {
    key,
    phase,
    kind,
    operation,
    scene_id: sceneId ?? null,
    prompt,
    prompt_sha256: sha256(prompt),
    aspect_ratio: MANIFEST.execution.aspect_ratio,
    duration_seconds: durationSeconds ?? null,
    resolution: kind === 'video' ? MANIFEST.execution.video_resolution : null,
    source_file: source ?? null,
    output_file: output,
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

function expectedJobs(imageMode) {
  const imageOperation = imageMode === 'reference' ? 'image-to-image' : 'text-to-image';
  const jobs = [
    plannedJob({
      key: 'sheet/combined-character-sheet',
      phase: 'sheet',
      kind: 'image',
      operation: 'text-to-image',
      prompt: buildSheetPrompt(),
      output: MANIFEST.character_sheet.file,
    }),
    plannedJob({
      key: 'probe/reference-restage',
      phase: 'probe',
      kind: 'image',
      operation: 'image-to-image',
      prompt: buildProbePrompt(),
      source: MANIFEST.reference_probe.source,
      output: MANIFEST.reference_probe.file,
    }),
    plannedJob({
      key: 'probe/text-lock-fallback',
      phase: 'probe',
      kind: 'image',
      operation: 'text-to-image',
      prompt: compact([
        'Fallback visual proof after a rejected image-to-image clone. Create a real story frame, never a model sheet.',
        buildScenePrompt(MANIFEST.scenes[1], 'text-to-image'),
      ].join(' ')),
      output: 'reference/text-lock-fallback-probe.jpg',
      sceneId: 'S02-proof',
    }),
  ];

  for (const scene of MANIFEST.scenes) {
    jobs.push(plannedJob({
      key: `image/${scene.id}`,
      phase: 'images',
      kind: 'image',
      operation: imageOperation,
      prompt: buildScenePrompt(scene, imageOperation),
      source: imageOperation === 'image-to-image' ? MANIFEST.image_generation.preferred_reference : null,
      output: scene.image_file,
      sceneId: scene.id,
    }));
    jobs.push(plannedJob({
      key: `video/${scene.id}`,
      phase: 'videos',
      kind: 'video',
      operation: 'image-to-video',
      prompt: compact([
        scene.motion_prompt,
        MANIFEST.canon.style_lock,
        MANIFEST.canon.negative_lock,
      ].join(' ')),
      source: scene.image_file,
      output: scene.video_file,
      durationSeconds: scene.duration_seconds,
      sceneId: scene.id,
    }));
  }
  return jobs;
}

function newState(imageMode) {
  return {
    schema_version: 1,
    production_id: MANIFEST.production_id,
    provider: MANIFEST.provider.name,
    provider_base_url: MANIFEST.provider.base_url,
    provider_result_urls_persisted: false,
    image_mode: imageMode,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    gates: Object.fromEntries([...GATES].map((gate) => [gate, { status: 'pending' }])),
    jobs: [],
  };
}

function mergeState(imageMode) {
  let state = fs.existsSync(STATE_PATH) ? readJson(STATE_PATH) : newState(imageMode);
  if (state.production_id !== MANIFEST.production_id) throw new Error('State belongs to a different production_id');

  const oldJobs = new Map((state.jobs ?? []).map((job) => [job.key, job]));
  const desired = expectedJobs(imageMode);
  state.jobs = desired.map((job) => {
    const old = oldJobs.get(job.key);
    if (!old) return job;
    const compatible = old.operation === job.operation && old.prompt_sha256 === job.prompt_sha256 &&
      old.output_file === job.output_file && old.source_file === job.source_file;
    if (!compatible && old.job_id) {
      throw new Error(`Manifest/job signature changed after submission for ${job.key}; preserve the old manifest or archive state first`);
    }
    return compatible ? { ...job, ...old, prompt: job.prompt } : job;
  });
  state.image_mode = imageMode;
  state.gates ??= Object.fromEntries([...GATES].map((gate) => [gate, { status: 'pending' }]));
  for (const gate of GATES) state.gates[gate] ??= { status: 'pending' };
  if (hasArg('adopt-local-sheet')) adoptLocalSheet(state);
  if (hasArg('adopt-local-images')) adoptLocalImages(state);
  return state;
}

function adoptLocalSheet(state) {
  const job = state.jobs.find((candidate) => candidate.key === 'sheet/combined-character-sheet');
  if (!job) throw new Error('Combined sheet job is missing from production state');
  const source = outputPath('reference/combined-character-sheet.local.jpg');
  if (!fs.existsSync(source)) {
    throw new Error(`Local combined sheet is missing: ${relative(source)}; run build_local_reference.py first`);
  }
  const bytes = fs.readFileSync(source);
  const inspection = inspectImage(bytes);
  if (!inspection.ok) throw new Error('Local combined sheet failed structural JPEG/16:9 validation');
  const destination = outputPath(job.output_file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
  job.provider_attempt = {
    job_id: job.job_id,
    status_at_fallback: job.status,
    submitted_at: job.submitted_at,
    last_polled_at: job.last_polled_at,
    declared_credit_cost: job.credit_cost,
    note: 'PlayVeo Images job remained pending and its GET endpoint became unavailable; no duplicate was submitted.',
  };
  job.status = 'completed';
  job.completed_at = new Date().toISOString();
  job.completion_mode = 'deterministic-local-composite-after-provider-timeout';
  job.local_source_file = relative(source);
  job.media = {
    ...inspection,
    provenance: 'canonical Luna pixels plus locally drawn Najmi and locked props',
  };
  job.error = null;
  state.gates.sheet = { status: 'pending', note: 'Local fallback requires visual approval.' };
  console.log(`adopted ${relative(source)} -> ${relative(destination)}; original provider attempt remains recorded`);
}

function adoptLocalImages(state) {
  const jobs = state.jobs.filter((job) => job.phase === 'images');
  if (jobs.length !== MANIFEST.scenes.length) {
    throw new Error(`Expected ${MANIFEST.scenes.length} image jobs, found ${jobs.length}`);
  }
  for (const job of jobs) {
    const filePath = outputPath(job.output_file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local scene is missing: ${relative(filePath)}; run build_local_scenes.py first`);
    }
    const bytes = fs.readFileSync(filePath);
    const inspection = inspectImage(bytes);
    if (!inspection.ok || inspection.width !== 1920 || inspection.height !== 1080) {
      throw new Error(`Local scene failed JPEG/1920x1080 validation: ${relative(filePath)}`);
    }
    job.status = 'completed';
    job.job_id = null;
    job.provider_model = null;
    job.credit_cost = null;
    job.submitted_at = null;
    job.completed_at = new Date().toISOString();
    job.last_polled_at = null;
    job.completion_mode = 'deterministic-local-composite-after-playveo-image-qc-failure';
    job.local_source_file = relative(filePath);
    job.media = {
      ...inspection,
      provenance: 'canonical Luna cutout plus deterministic Najmi, prop, card, and Planet Abjad layers',
    };
    job.error = null;
  }
  state.gates.images = { status: 'pending', note: 'Local ten-frame contact sheet requires visual approval.' };
  console.log(`adopted ${jobs.length} local 1920x1080 scene images; no PlayVeo image jobs were submitted`);
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  state.updated_at = new Date().toISOString();
  const temp = `${STATE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(temp, STATE_PATH);
}

async function api(method, route, body) {
  if (method === 'POST' && MANIFEST.production_status === 'superseded_do_not_dispatch') {
    throw new Error(`Provider POST blocked: this manifest is superseded by ${MANIFEST.superseded_by}`);
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

function entity(response, kind) {
  return response?.[kind] ?? response?.job ?? response;
}

function normalizedStatus(response, kind) {
  return compact(entity(response, kind)?.status ?? response?.status).toLowerCase() || 'unknown';
}

function jobId(response, kind) {
  return response?.id ?? response?.[kind]?.id ?? response?.job?.id ?? null;
}

function resultUrl(response, kind) {
  const item = entity(response, kind);
  const list = item?.resultUrls ?? item?.result_urls ?? item?.urls;
  if (Array.isArray(list) && typeof list[0] === 'string') return list[0];
  return item?.videoUrl ?? item?.video_url ?? item?.resultUrl ?? item?.result_url ?? item?.url ?? null;
}

function providerFailure(response, kind) {
  const item = entity(response, kind);
  return safeError(item?.error ?? item?.errorMessage ?? response?.error ?? 'Provider reported failure');
}

function dataUrl(relativePath) {
  const filePath = outputPath(relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Required source file is missing: ${relative(filePath)}`);
  const bytes = fs.readFileSync(filePath);
  if (bytes.length > 10 * 1024 * 1024) throw new Error(`Image source exceeds 10 MB: ${relative(filePath)}`);
  const extension = path.extname(filePath).toLowerCase();
  const mime = extension === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

function jpegDimensions(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (sof.has(marker)) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function inspectImage(bytes) {
  const dimensions = jpegDimensions(bytes);
  const ratio = dimensions ? dimensions.width / dimensions.height : null;
  const ok = bytes.length > 10_000 && dimensions && Math.abs(ratio - (16 / 9)) <= 0.08;
  return {
    ok: Boolean(ok),
    format: dimensions ? 'jpeg' : 'unknown',
    bytes: bytes.length,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    aspect_ratio: ratio ? Number(ratio.toFixed(4)) : null,
    sha256: sha256(bytes),
  };
}

function inspectVideo(bytes) {
  const prefix = bytes.subarray(0, 64).toString('latin1');
  const binary = bytes.toString('latin1');
  const hasFtyp = prefix.includes('ftyp');
  const hasVideoTrack = binary.includes('vide');
  const hasAudioTrack = binary.includes('soun');
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
  if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Provider returned no HTTPS result URL');

  const attempt = async (headers, label) => {
    const response = await fetch(url, {
      ...(headers ? { headers } : {}),
      signal: AbortSignal.timeout(75_000),
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

function routeForJob(job) {
  if (job.kind === 'video') return MANIFEST.provider.flux_get_route.replace('{id}', job.job_id);
  return MANIFEST.provider.image_get_route.replace('{id}', job.job_id);
}

async function submitJob(state, job) {
  try {
    let route;
    let payload;
    if (job.kind === 'video') {
      route = MANIFEST.provider.flux_create_route;
      payload = {
        prompt: job.prompt,
        duration_seconds: job.duration_seconds,
        aspect_ratio: job.aspect_ratio,
        resolution: job.resolution,
        start_frame: dataUrl(job.source_file),
      };
    } else if (job.operation === 'image-to-image') {
      route = MANIFEST.provider.image_reference_route;
      payload = {
        prompt: job.prompt,
        aspect_ratio: job.aspect_ratio,
        count: 1,
        image: dataUrl(job.source_file),
      };
    } else {
      route = MANIFEST.provider.image_text_route;
      payload = { prompt: job.prompt, aspect_ratio: job.aspect_ratio, count: 1 };
    }

    const response = await api('POST', route, payload);
    const id = jobId(response, job.kind);
    if (!id) throw new Error('Provider submission returned no job ID');
    job.job_id = String(id);
    job.status = normalizedStatus(response, job.kind);
    if (!ACTIVE.has(job.status) && !TERMINAL.has(job.status)) job.status = 'submitted';
    job.provider_model = response?.model ?? entity(response, job.kind)?.model ?? null;
    const cost = Number(response?.creditCost ?? response?.credit_cost ?? entity(response, job.kind)?.creditCost);
    job.credit_cost = Number.isFinite(cost) ? cost : null;
    job.submitted_at = new Date().toISOString();
    job.error = null;
    saveState(state);
    console.log(`submitted ${job.key} -> ${job.job_id} (${job.status}, cost=${job.credit_cost ?? 'unreported'})`);
  } catch (error) {
    job.status = 'submission_failed';
    job.error = safeError(error.message);
    saveState(state);
    console.error(`FAILED submit ${job.key}: ${job.error}`);
    if (error.httpStatus === 401 || error.httpStatus === 402) throw error;
  }
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitAndDownload(state, job) {
  const timeoutMinutes = job.kind === 'video'
    ? MANIFEST.execution.video_timeout_minutes
    : MANIFEST.execution.image_timeout_minutes;
  const deadline = Date.now() + timeoutMinutes * 60_000;
  let lastStatus = '';
  let transientErrors = 0;

  while (Date.now() < deadline) {
    try {
      const response = await api('GET', routeForJob(job));
      transientErrors = 0;
      const status = normalizedStatus(response, job.kind);
      job.status = status;
      job.last_polled_at = new Date().toISOString();
      const item = entity(response, job.kind);
      if (job.kind === 'video') {
        job.provider_duration_seconds = item?.duration ?? item?.durationSeconds ?? null;
        job.provider_resolution = item?.resolution ?? null;
        job.provider_aspect_ratio = item?.aspectRatio ?? item?.aspect_ratio ?? null;
      }
      if (status !== lastStatus) {
        console.log(`${job.key}: ${status}`);
        lastStatus = status;
      }

      if (status === 'completed') {
        const url = resultUrl(response, job.kind);
        if (typeof url === 'string' && url.startsWith('https://')) {
          const parsedResultUrl = new URL(url);
          console.log(`${job.key}: result host=${parsedResultUrl.host} path=${parsedResultUrl.pathname.split('/').slice(0, 3).join('/')}`);
        }
        let bytes;
        try {
          bytes = await downloadBytes(url);
        } catch (downloadError) {
          job.status = 'download_failed';
          job.error = safeError(downloadError.message);
          saveState(state);
          console.error(`FAILED download ${job.key}: ${job.error}`);
          return;
        }
        const inspection = job.kind === 'video' ? inspectVideo(bytes) : inspectImage(bytes);
        const destination = outputPath(job.output_file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        if (!inspection.ok) {
          fs.writeFileSync(destination, bytes);
          job.status = 'validation_failed';
          job.media = {
            ...inspection,
            prefix_hex: bytes.subarray(0, 16).toString('hex'),
            received_file: relative(destination),
          };
          job.error = `Downloaded ${job.kind} failed structural validation`;
          saveState(state);
          console.error(`FAILED validation ${job.key}: ${JSON.stringify(job.media)}`);
          return;
        }
        fs.writeFileSync(destination, bytes);
        job.media = inspection;
        if (job.phase === 'probe') {
          const sourceHash = fileSha256(outputPath(job.source_file));
          job.media.source_sha256 = sourceHash;
          job.media.exact_clone_of_source = sourceHash === inspection.sha256;
        }
        job.completed_at = new Date().toISOString();
        job.error = null;
        saveState(state);
        console.log(`saved ${relative(destination)} (${inspection.bytes} bytes)`);
        return;
      }

      if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
        job.completed_at = new Date().toISOString();
        job.error = providerFailure(response, job.kind);
        saveState(state);
        console.error(`FAILED ${job.key}: ${job.error}`);
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
      if (transientErrors >= 4) {
        job.status = 'polling_failed';
        saveState(state);
        console.error(`FAILED poll ${job.key}: ${job.error}`);
        return;
      }
    }
    await sleep(MANIFEST.execution.poll_interval_seconds * 1000);
  }

  job.status = 'timed_out';
  job.error = `Provider job did not finish within ${timeoutMinutes} minutes`;
  saveState(state);
  console.error(`TIMEOUT ${job.key}`);
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

function jobsForGate(state, phase) {
  const jobs = state.jobs.filter((job) => job.phase === phase);
  if (phase !== 'probe') return jobs;
  const proofKey = state.image_mode === 'text'
    ? 'probe/text-lock-fallback'
    : 'probe/reference-restage';
  return jobs.filter((job) => job.key === proofKey);
}

function currentGateFingerprint(state, phase) {
  return jobsForGate(state, phase)
    .map((job) => ({ key: job.key, sha256: job.media?.sha256 ?? null }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function gateIsCurrent(state, gate) {
  const record = state.gates?.[gate];
  if (record?.status !== 'approved' || !Array.isArray(record.fingerprint)) return false;
  return JSON.stringify(record.fingerprint) === JSON.stringify(currentGateFingerprint(state, gate));
}

function assertPrerequisite(state, phase) {
  const prerequisite = { probe: 'sheet', images: 'probe', videos: 'images' }[phase];
  if (!prerequisite) return;
  if (!gateIsCurrent(state, prerequisite)) {
    throw new Error(`Phase ${phase} is blocked: approve the current ${prerequisite} output first`);
  }
}

function approveGate(state, gate) {
  if (!GATES.has(gate)) throw new Error(`--approve must be one of: ${[...GATES].join(', ')}`);
  const jobs = jobsForGate(state, gate);
  if (!jobs.length) throw new Error(`No jobs exist for gate ${gate}`);
  for (const job of jobs) {
    const destination = outputPath(job.output_file);
    if (job.status !== 'completed' || !job.media?.ok || !fs.existsSync(destination)) {
      throw new Error(`Cannot approve ${gate}: ${job.key} is not a complete validated local file`);
    }
  }
  if (gate === 'probe' && state.image_mode === 'reference' && jobs[0].media?.exact_clone_of_source) {
    throw new Error('Cannot approve probe: provider returned a byte-identical clone of the character sheet');
  }
  const previousRejection = gate === 'probe' && state.gates?.probe?.status === 'rejected'
    ? state.gates.probe
    : null;
  state.gates[gate] = {
    status: 'approved',
    approved_at: new Date().toISOString(),
    review: 'manual-visual-review-recorded-by-runner-operator',
    approval_basis: gate === 'probe'
      ? (state.image_mode === 'text' ? 'text-to-image-fallback-proof' : 'image-to-image-reference-proof')
      : gate,
    previous_reference_rejection: previousRejection,
    fingerprint: currentGateFingerprint(state, gate),
  };
  saveState(state);
  console.log(`approved ${gate} gate (${jobs.length} file${jobs.length === 1 ? '' : 's'})`);
}

function rejectGate(state, gate) {
  if (!GATES.has(gate)) throw new Error(`--reject must be one of: ${[...GATES].join(', ')}`);
  state.gates[gate] = {
    status: 'rejected',
    rejected_at: new Date().toISOString(),
    reason: typeof argValue('reason') === 'string' ? safeError(argValue('reason')) : 'manual visual review rejected the output',
    fingerprint: currentGateFingerprint(state, gate),
  };
  saveState(state);
  console.log(`rejected ${gate} gate`);
}

function resetFailedJobs(state, jobs) {
  if (!hasArg('retry-failed')) return;
  for (const job of jobs) {
    if (!['failed', 'submission_failed', 'polling_failed', 'timed_out', 'cancelled', 'canceled'].includes(job.status)) continue;
    job.attempts ??= [];
    job.attempts.push({
      job_id: job.job_id,
      status: job.status,
      credit_cost: job.credit_cost,
      submitted_at: job.submitted_at,
      completed_at: job.completed_at,
      last_polled_at: job.last_polled_at,
      error: job.error,
      archived_at: new Date().toISOString(),
    });
    job.status = 'planned';
    job.job_id = null;
    job.credit_cost = null;
    job.submitted_at = null;
    job.completed_at = null;
    job.last_polled_at = null;
    job.error = null;
    job.media = null;
  }
  saveState(state);
}

async function runPhase(state, phase) {
  if (!PHASES.has(phase)) throw new Error(`--phase must be one of: ${[...PHASES].join(', ')}`);
  if (MANIFEST.production_status === 'superseded_do_not_dispatch' && hasArg('retry-failed')) {
    throw new Error(`Replacement submissions blocked: this manifest is superseded by ${MANIFEST.superseded_by}`);
  }
  if (!hasArg('allow-paid')) throw new Error('Paid phase blocked: add --allow-paid after reviewing --plan');
  assertPrerequisite(state, phase);
  if (phase === 'images' && state.image_mode === 'text' && !hasArg('allow-text-fallback')) {
    throw new Error('Text-only fallback blocked: add --allow-text-fallback after approving the fallback consistency plan');
  }

  const requestedConcurrency = Number(argValue('concurrency') ?? MANIFEST.execution.max_concurrency);
  if (!Number.isInteger(requestedConcurrency) || requestedConcurrency < 1 || requestedConcurrency > 10) {
    throw new Error('--concurrency must be an integer from 1 to 10');
  }

  const jobs = state.jobs.filter((job) => job.phase === phase);
  resetFailedJobs(state, jobs);
  const planned = jobs.filter((job) => job.status === 'planned' && !job.job_id);
  if (planned.length && MANIFEST.production_status === 'superseded_do_not_dispatch') {
    console.log(`Skipped ${planned.length} unsubmitted ${phase} job(s): superseded runner is resume-existing-only.`);
  } else if (planned.length) {
    console.log(`Submitting ${planned.length} ${phase} job(s) with concurrency=${Math.min(requestedConcurrency, planned.length)}.`);
    await runPool(planned, requestedConcurrency, async (job) => submitJob(state, job));
  }

  const pollable = jobs.filter((job) => job.job_id && (
    !TERMINAL.has(job.status) || (job.status === 'completed' && !fs.existsSync(outputPath(job.output_file)))
  ));
  if (pollable.length) {
    console.log(`Polling/downloading ${pollable.length} ${phase} job(s) with concurrency=${Math.min(requestedConcurrency, pollable.length)}.`);
    await runPool(pollable, requestedConcurrency, async (job) => waitAndDownload(state, job));
  }

  const completed = jobs.filter((job) => job.status === 'completed' && job.media?.ok && fs.existsSync(outputPath(job.output_file)));
  const failed = jobs.filter((job) => !completed.includes(job));
  console.log(`${phase}: completed=${completed.length}/${jobs.length}${failed.length ? `, unresolved=${failed.length}` : ''}`);
  if (failed.length) process.exitCode = 1;
}

function actualCredits(state) {
  return state.jobs.reduce((sum, job) => {
    const current = Number.isFinite(Number(job.credit_cost)) ? Number(job.credit_cost) : 0;
    const archived = (job.attempts ?? []).reduce(
      (attemptSum, attempt) => attemptSum + (Number.isFinite(Number(attempt.credit_cost)) ? Number(attempt.credit_cost) : 0),
      0,
    );
    return sum + current + archived;
  }, 0);
}

function printPlan(state, validation) {
  const imageMode = state.image_mode;
  const estimated = imageMode === 'reference'
    ? MANIFEST.budget.estimated_total_reference
    : MANIFEST.budget.estimated_total_text_lock;
  console.log(`Production: ${MANIFEST.production_id}`);
  console.log(`Validated: ${validation.sceneCount} scenes, ${validation.durationSeconds}s, ${validation.narrationLines} narration lines.`);
  console.log(`Image mode: ${imageMode === 'reference' ? 'image-to-image using the combined sheet' : 'text-to-image fallback'}`);
  console.log(`Estimated full provider cost: ${estimated.toFixed(2)} credits (actual API declarations are persisted).`);
  console.log('Dependency order: sheet -> approve -> probe -> approve -> 10 images in parallel -> approve -> 10 FLUX videos in parallel.');
  console.log(`State: ${relative(STATE_PATH)}`);
  console.log('No API request was sent by --plan.');
}

function printStatus(state) {
  for (const phase of PHASES) {
    const jobs = state.jobs.filter((job) => job.phase === phase);
    const counts = jobs.reduce((map, job) => {
      map[job.status] = (map[job.status] ?? 0) + 1;
      return map;
    }, {});
    const gate = state.gates?.[phase]?.status ?? 'pending';
    console.log(`${phase.padEnd(7)} gate=${gate.padEnd(8)} ${Object.entries(counts).map(([status, count]) => `${status}=${count}`).join(', ')}`);
  }
  console.log(`Declared credits in current state: ${actualCredits(state).toFixed(2)}`);
  console.log(`Output root: ${relative(OUTPUT_ROOT)}`);
}

async function main() {
  const validation = validateManifest();
  const requestedImageMode = argValue('image-mode');
  const persistedImageMode = fs.existsSync(STATE_PATH)
    ? readJson(STATE_PATH).image_mode
    : 'reference';
  const imageMode = requestedImageMode ?? persistedImageMode ?? 'reference';
  if (!['text', 'reference'].includes(imageMode)) {
    throw new Error('--image-mode must be reference or text');
  }
  const state = mergeState(imageMode);
  saveState(state);

  const approve = argValue('approve');
  const reject = argValue('reject');
  const phase = argValue('phase');
  let acted = false;

  if (typeof approve === 'string') { approveGate(state, approve); acted = true; }
  if (typeof reject === 'string') { rejectGate(state, reject); acted = true; }
  if (typeof phase === 'string') { await runPhase(state, phase); acted = true; }
  if (hasArg('status')) { printStatus(state); acted = true; }
  if (hasArg('plan') || !acted) printPlan(state, validation);
}

main().catch((error) => {
  console.error(`ERROR: ${safeError(error.message)}`);
  process.exit(1);
});
