// Majarra Games Wave visual-production runner.
//
// Security invariants:
// - PLAYVEO_API_KEY is loaded only in this controlled Node process.
// - The key and provider result URLs are never logged or persisted.
// - GamePacks receive only Majarra-owned asset IDs in the later ingest step.
//
// Usage from the repository root:
//   node tools/playveo/wave-production.mjs --plan
//   node tools/playveo/wave-production.mjs --resume-legacy
//   node tools/playveo/wave-production.mjs --submit --only game-wave1-memory-animals/cover
//   node tools/playveo/wave-production.mjs --poll --only game-wave1-memory-animals/cover
//   node tools/playveo/wave-production.mjs --submit --poll
//
// The live PlayVeo contract was checked against https://playveo.online/docs/:
//   POST /v1/images/text-to-image
//   GET  /v1/images/:id
// Background removal is deliberately handled by the next pipeline phase because
// POST /v1/images/remove-background is synchronous and operates on completed art.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST_PATH = path.join(import.meta.dirname, 'wave-visual.manifest.json');
const STATE_PATH = path.join(import.meta.dirname, 'wave-production.jobs.json');
const BASE_URL = 'https://playveo-api.aboessa101.workers.dev';
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'canceled']);
const ACTIVE = new Set(['pending', 'queued', 'processing', 'running', 'submitted']);

// These are the only unresolved provider jobs found in the repository audit.
// They are retained as evidence, not assumed to belong to a production asset.
const LEGACY_JOBS = [
  {
    key: 'legacy/image/cec3cab6-b16a-4f95-9c92-6b10895abe5c',
    job_id: 'cec3cab6-b16a-4f95-9c92-6b10895abe5c',
    route_kind: 'image',
    purpose: 'Legacy Wave image job; exact asset purpose was not persisted',
  },
  {
    key: 'legacy/image/3639e5a3-81c5-46df-97f4-95db7e2e01c6',
    job_id: '3639e5a3-81c5-46df-97f4-95db7e2e01c6',
    route_kind: 'image',
    purpose: 'Legacy Wave image job; exact asset purpose was not persisted',
  },
  {
    key: 'legacy/video/08343439-01ee-4323-b590-b7c597478ead',
    job_id: '08343439-01ee-4323-b590-b7c597478ead',
    route_kind: 'video',
    purpose: 'Legacy FLUX provider probe; not a Wave production asset',
  },
  {
    key: 'legacy/video/79d0fc12-9790-4fcb-87c0-6ae1ce0e578c',
    job_id: '79d0fc12-9790-4fcb-87c0-6ae1ce0e578c',
    route_kind: 'video',
    purpose: 'Legacy FLUX provider probe; not a Wave production asset',
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseEnvValue(filePath, name) {
  if (!fs.existsSync(filePath)) return undefined;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
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
  const candidates = [
    process.env.PLAYVEO_API_KEY?.trim(),
    parseEnvValue(path.join(ROOT, '.env.local'), 'PLAYVEO_API_KEY'),
    parseEnvValue(path.join(ROOT, 'dashboard', 'api', '.dev.vars'), 'PLAYVEO_API_KEY'),
    fs.existsSync(path.join(os.homedir(), '.majarra', 'playveo.key'))
      ? fs.readFileSync(path.join(os.homedir(), '.majarra', 'playveo.key'), 'utf8').trim()
      : undefined,
  ];
  const key = candidates.find((candidate) => candidate && candidate.length > 8);
  if (!key) {
    throw new Error('PLAYVEO_API_KEY is unavailable to the controlled production runner');
  }
  return key;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function slugFor(gameId) {
  return gameId.replace(/^game-/, '');
}

function aspectRatioFor(asset) {
  if (asset.transparent) return '1:1';
  if (asset.asset === 'cover' || String(asset.asset).includes('background')) return '4:3';
  if (String(asset.asset).includes('card') || String(asset.role).includes('card')) return '4:3';
  return '4:3';
}

function outputExtension(asset) {
  return asset.transparent ? 'png' : 'webp';
}

function buildPrompt(manifest, game, asset, member) {
  const contract = manifest.shared_prompt_contract;
  const subject = member?.subject ?? asset.prompt_subject;
  const setDirection = member ? asset.set_style : undefined;
  const background = asset.transparent
    ? 'Render the standalone object against one plain, evenly lit, easily removable background. Keep every edge and appendage fully inside frame; the final production asset will be a transparent cutout.'
    : 'Use the requested game-specific background and preserve clear negative space for runtime controls.';
  return compact([
    contract.brand + '.',
    `Audience: children age ${game.age_group}.`,
    `Game: ${game.title_ar}; purpose: ${game.engine} gameplay.`,
    `Art direction: ${game.art_direction}`,
    setDirection ? `Set consistency: ${setDirection}.` : '',
    `Asset purpose: ${asset.role}.`,
    `Subject: ${subject}.`,
    `${contract.style}.`,
    `${contract.purpose}.`,
    `${contract.framing}.`,
    `${contract.camera}.`,
    `${background}`,
    `${contract.simplicity}.`,
    `${contract.text_rule}.`,
    `${contract.rights_rule}.`,
    asset.transparent ? `${contract.transparency_rule}.` : '',
  ].join(' '));
}

function expandManifest(manifest) {
  const jobs = [];
  for (const game of manifest.games) {
    for (const asset of game.assets) {
      if (asset.action !== 'GENERATE') continue;
      const members = Array.isArray(asset.members) && asset.members.length
        ? asset.members
        : [undefined];
      for (const member of members) {
        const assetKey = member?.id ?? asset.asset;
        const key = `${game.game_id}/${assetKey}`;
        const prompt = buildPrompt(manifest, game, asset, member);
        const gameSlug = slugFor(game.game_id);
        jobs.push({
          key,
          game_id: game.game_id,
          game_title_ar: game.title_ar,
          age_group: game.age_group,
          engine: game.engine,
          asset: asset.asset,
          member: member?.id ?? null,
          purpose: asset.role,
          operation: 'text-to-image',
          route_kind: 'image',
          aspect_ratio: aspectRatioFor(asset),
          transparent_required: Boolean(asset.transparent),
          background_removal_required: Boolean(asset.transparent),
          prompt,
          prompt_sha256: sha256(prompt),
          source_file: `tools/playveo/output/wave/${gameSlug}/source/${assetKey}.jpg`,
          target_file: `app_main/assets/images/games/wave/${gameSlug}/${assetKey}.${outputExtension(asset)}`,
          review: game.reviews,
          status: 'planned',
          job_id: null,
          provider_model: null,
          credit_cost: null,
          submitted_at: null,
          completed_at: null,
          last_polled_at: null,
          error: null,
          result_count: 0,
          downloaded: false,
          background_removed: false,
          optimized: false,
          media_asset_id: null,
          r2_key: null,
        });
      }
    }
  }
  return jobs;
}

function baseState(manifest) {
  return {
    schema_version: 1,
    manifest_id: manifest.manifest_id,
    provider: 'PlayVeo',
    provider_base_url: BASE_URL,
    provider_result_urls_persisted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    jobs: [],
    legacy_jobs: LEGACY_JOBS.map((job) => ({
      ...job,
      status: 'unresolved',
      last_polled_at: null,
      completed_at: null,
      result_count: 0,
      error: null,
    })),
  };
}

function mergeState(manifest) {
  const desired = expandManifest(manifest);
  let state = fs.existsSync(STATE_PATH) ? readJson(STATE_PATH) : baseState(manifest);
  const existing = new Map((state.jobs ?? []).map((job) => [job.key, job]));
  state.jobs = desired.map((job) => ({ ...job, ...(existing.get(job.key) ?? {}) }));
  const legacy = new Map((state.legacy_jobs ?? []).map((job) => [job.key, job]));
  state.legacy_jobs = LEGACY_JOBS.map((job) => ({
    ...job,
    status: 'unresolved',
    last_polled_at: null,
    completed_at: null,
    result_count: 0,
    error: null,
    ...(legacy.get(job.key) ?? {}),
  }));
  state.updated_at = new Date().toISOString();
  return state;
}

function saveState(state) {
  state.updated_at = new Date().toISOString();
  const tempPath = `${STATE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tempPath, STATE_PATH);
}

function safeProviderError(value) {
  return compact(value)
    .replace(/https?:\/\/[^\s"']+/g, '[provider-url-redacted]')
    .replace(/pv_[A-Za-z0-9_-]+/g, '[secret-redacted]')
    .slice(0, 500);
}

let API_KEY;
async function api(method, route, body) {
  API_KEY ??= loadApiKey();
  const response = await fetch(`${BASE_URL}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await response.text();
  if (response.status === 401) throw new Error('PlayVeo authentication failed');
  if (response.status === 402) throw new Error('PlayVeo credits are insufficient');
  if (response.status === 429) throw new Error('PlayVeo rate limit reached');
  if (!response.ok) {
    const error = new Error(`PlayVeo ${method} ${route} failed (${response.status}): ${safeProviderError(text)}`);
    error.httpStatus = response.status;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`PlayVeo ${method} ${route} returned a non-JSON response`);
  }
}

function entityFromResponse(response, routeKind) {
  return response?.[routeKind] ?? response?.job ?? response;
}

function statusFromResponse(response, routeKind) {
  const entity = entityFromResponse(response, routeKind);
  return compact(entity?.status ?? response?.status).toLowerCase() || 'unknown';
}

function resultCountFromResponse(response, routeKind) {
  const entity = entityFromResponse(response, routeKind);
  const candidates = [
    entity?.resultUrls,
    entity?.result_urls,
    entity?.images,
    response?.images,
    entity?.videoUrl ? [entity.videoUrl] : null,
    entity?.video_url ? [entity.video_url] : null,
    entity?.url ? [entity.url] : null,
  ];
  const list = candidates.find((candidate) => Array.isArray(candidate));
  return list?.length ?? 0;
}

function providerErrorFromResponse(response, routeKind) {
  const entity = entityFromResponse(response, routeKind);
  return safeProviderError(entity?.error ?? entity?.errorMessage ?? response?.error ?? 'Provider reported failure');
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const next = process.argv[index + 1];
  return next && !next.startsWith('--') ? next : true;
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function filterJobs(jobs) {
  const only = argValue('only');
  let selected = typeof only === 'string'
    ? jobs.filter((job) => job.key.includes(only))
    : [...jobs];
  const limitValue = Number(argValue('limit'));
  if (Number.isFinite(limitValue) && limitValue > 0) {
    selected = selected.slice(0, Math.floor(limitValue));
  }
  return selected;
}

function printPlan(state) {
  const byRatio = {};
  const transparent = state.jobs.filter((job) => job.transparent_required).length;
  for (const job of state.jobs) byRatio[job.aspect_ratio] = (byRatio[job.aspect_ratio] ?? 0) + 1;
  const estimatedCredits = state.jobs.length * 0.1;
  console.log(`Manifest: ${state.manifest_id}`);
  console.log(`Production image jobs: ${state.jobs.length}`);
  console.log(`Transparent/background-removal outputs: ${transparent}`);
  console.log(`Ratios: ${Object.entries(byRatio).map(([ratio, count]) => `${ratio}=${count}`).join(', ')}`);
  console.log(`Estimated text-to-image credits at the last observed rate: ${estimatedCredits.toFixed(2)}`);
  console.log(`Legacy unresolved jobs to poll: ${state.legacy_jobs.length}`);
  console.log('Secrets and provider result URLs: not printed or persisted');
}

async function submitJobs(state) {
  const candidates = filterJobs(state.jobs).filter((job) =>
    job.generation_method !== 'set_sheet_crop' &&
    (!job.job_id || job.status === 'planned' || job.status === 'submission_failed'));
  if (!candidates.length) {
    console.log('No planned jobs match the submission filter.');
    return;
  }
  console.log(`Submitting ${candidates.length} PlayVeo image job(s) one asset per job for traceable provenance.`);
  for (const [index, job] of candidates.entries()) {
    try {
      const response = await api('POST', '/v1/images/text-to-image', {
        prompt: job.prompt,
        aspect_ratio: job.aspect_ratio,
        count: 1,
      });
      const id = response?.id ?? response?.image?.id;
      if (!id) throw new Error('PlayVeo submission returned no job ID');
      job.job_id = String(id);
      job.status = statusFromResponse(response, 'image');
      if (job.status === 'unknown') job.status = 'submitted';
      job.provider_model = response?.model ?? response?.image?.model ?? null;
      job.credit_cost = response?.creditCost ?? response?.credit_cost ?? null;
      job.submitted_at = new Date().toISOString();
      job.error = null;
      saveState(state);
      console.log(`[${index + 1}/${candidates.length}] submitted ${job.key} -> ${job.job_id} (${job.status})`);
      await sleep(500);
    } catch (error) {
      job.status = 'submission_failed';
      job.error = safeProviderError(error.message);
      saveState(state);
      console.error(`[${index + 1}/${candidates.length}] FAILED ${job.key}: ${job.error}`);
      if (String(error.message).includes('credits are insufficient') ||
          String(error.message).includes('authentication failed')) {
        throw error;
      }
      await sleep(1_500);
    }
  }
}

async function pollOne(job) {
  const route = job.route_kind === 'video'
    ? `/v1/videos/${job.job_id}`
    : `/v1/images/${job.job_id}`;
  try {
    const response = await api('GET', route);
    const status = statusFromResponse(response, job.route_kind);
    job.status = status;
    job.last_polled_at = new Date().toISOString();
    job.result_count = resultCountFromResponse(response, job.route_kind);
    if (status === 'completed') {
      job.completed_at ??= new Date().toISOString();
      job.error = null;
    } else if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
      job.completed_at ??= new Date().toISOString();
      job.error = providerErrorFromResponse(response, job.route_kind);
    }
    return status;
  } catch (error) {
    job.last_polled_at = new Date().toISOString();
    if (error.httpStatus === 404) {
      job.status = 'failed';
      job.completed_at ??= new Date().toISOString();
      job.error = 'Provider job was not found';
      return job.status;
    }
    job.error = safeProviderError(error.message);
    return job.status;
  }
}

async function pollJobs(state, jobs, label) {
  const timeoutMinutes = Number(argValue('timeout-min')) || 20;
  const deadline = Date.now() + timeoutMinutes * 60_000;
  let lastSummary = '';
  while (Date.now() < deadline) {
    const outstanding = jobs.filter((job) => job.job_id && !TERMINAL.has(job.status));
    if (!outstanding.length) break;

    // Small batches avoid provider bursts while still allowing all submitted jobs
    // to progress in parallel on the service.
    for (let start = 0; start < outstanding.length; start += 5) {
      const batch = outstanding.slice(start, start + 5);
      await Promise.all(batch.map(pollOne));
      saveState(state);
      if (start + 5 < outstanding.length) await sleep(350);
    }

    const summary = jobs.reduce((counts, job) => {
      counts[job.status] = (counts[job.status] ?? 0) + 1;
      return counts;
    }, {});
    const summaryText = Object.entries(summary).map(([status, count]) => `${status}=${count}`).join(', ');
    if (summaryText !== lastSummary) {
      console.log(`${label}: ${summaryText}`);
      lastSummary = summaryText;
    }
    if (jobs.every((job) => !job.job_id || TERMINAL.has(job.status))) break;
    await sleep(8_000);
  }

  const unfinished = jobs.filter((job) => job.job_id && !TERMINAL.has(job.status));
  if (unfinished.length) {
    console.error(`${label}: ${unfinished.length} job(s) did not reach a terminal state within ${timeoutMinutes} minutes.`);
    process.exitCode = 2;
  }
}

async function resumeLegacy(state) {
  console.log(`Polling ${state.legacy_jobs.length} audited legacy job(s) to terminal evidence.`);
  await pollJobs(state, state.legacy_jobs, 'legacy');
}

function prepareFailedRetries(state) {
  const failed = filterJobs(state.jobs).filter((job) =>
    job.status === 'failed' || job.status === 'submission_failed');
  if (!failed.length) {
    console.log('No failed production jobs match the retry filter.');
    return;
  }
  for (const job of failed) {
    job.attempts ??= [];
    job.attempts.push({
      job_id: job.job_id,
      status: job.status,
      provider_model: job.provider_model,
      credit_cost: job.credit_cost,
      submitted_at: job.submitted_at,
      completed_at: job.completed_at,
      error: job.error,
      result_count: job.result_count,
    });
    job.job_id = null;
    job.status = 'planned';
    job.provider_model = null;
    job.credit_cost = null;
    job.submitted_at = null;
    job.completed_at = null;
    job.last_polled_at = null;
    job.error = null;
    job.result_count = 0;
  }
  saveState(state);
  console.log(`Prepared ${failed.length} failed production job(s) for a new, separately recorded attempt.`);
}

function printFinalSummary(state) {
  const selected = filterJobs(state.jobs);
  const counts = selected.reduce((result, job) => {
    result[job.status] = (result[job.status] ?? 0) + 1;
    return result;
  }, {});
  console.log(`Production status: ${Object.entries(counts).map(([status, count]) => `${status}=${count}`).join(', ')}`);
  const failed = selected.filter((job) => job.status === 'failed' || job.status === 'submission_failed');
  if (failed.length) {
    console.log(`Failed production jobs: ${failed.length}`);
    process.exitCode = 1;
  }
}

async function main() {
  const manifest = readJson(MANIFEST_PATH);
  const state = mergeState(manifest);
  saveState(state);

  if (hasArg('plan') || process.argv.length === 2) printPlan(state);
  if (hasArg('resume-legacy')) await resumeLegacy(state);
  if (hasArg('retry-failed')) prepareFailedRetries(state);
  if (hasArg('submit')) await submitJobs(state);
  if (hasArg('poll')) {
    const selected = filterJobs(state.jobs).filter((job) => job.job_id);
    await pollJobs(state, selected, 'production');
  }
  if (hasArg('submit') || hasArg('poll')) printFinalSummary(state);
}

main().catch((error) => {
  console.error(safeProviderError(error.message));
  process.exit(1);
});
