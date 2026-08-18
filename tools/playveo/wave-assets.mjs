// Download and background-removal phase for Majarra Wave game art.
//
// Provider result URLs and PLAYVEO_API_KEY are used only in memory. Neither is
// printed nor persisted. This script starts only from completed job IDs in the
// internal production state and writes Majarra-controlled local source files.
//
// Usage:
//   node tools/playveo/wave-assets.mjs --download
//   node tools/playveo/wave-assets.mjs --remove-background
//   node tools/playveo/wave-assets.mjs --verify

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const STATE_PATH = path.join(import.meta.dirname, 'wave-production.jobs.json');
const BASE_URL = 'https://playveo-api.aboessa101.workers.dev';

function parseEnvValue(filePath, name) {
  if (!fs.existsSync(filePath)) return undefined;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] !== name) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return value.trim();
  }
  return undefined;
}

function loadApiKey() {
  const homeKey = path.join(os.homedir(), '.majarra', 'playveo.key');
  const key = [
    process.env.PLAYVEO_API_KEY?.trim(),
    parseEnvValue(path.join(ROOT, '.env.local'), 'PLAYVEO_API_KEY'),
    parseEnvValue(path.join(ROOT, 'dashboard', 'api', '.dev.vars'), 'PLAYVEO_API_KEY'),
    fs.existsSync(homeKey) ? fs.readFileSync(homeKey, 'utf8').trim() : undefined,
  ].find((candidate) => candidate && candidate.length > 8);
  if (!key) throw new Error('PLAYVEO_API_KEY is unavailable to the controlled asset runner');
  return key;
}

function safeError(value) {
  return String(value ?? '')
    .replace(/https?:\/\/[^\s"']+/g, '[provider-url-redacted]')
    .replace(/pv_[A-Za-z0-9_-]+/g, '[secret-redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readState() {
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function saveState(state) {
  state.updated_at = new Date().toISOString();
  const temporary = `${STATE_PATH}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(temporary, STATE_PATH);
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath.replaceAll('/', path.sep));
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function imageType(buffer, contentType = '') {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: '.jpg' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', extension: '.png' };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', extension: '.webp' };
  }
  throw new Error(`Provider returned ${buffer.length} bytes with unsupported image type ${contentType || 'unknown'}`);
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

function filterJobs(jobs) {
  const only = argValue('only');
  let selected = typeof only === 'string' ? jobs.filter((job) => job.key.includes(only)) : [...jobs];
  const limit = Number(argValue('limit'));
  if (Number.isFinite(limit) && limit > 0) selected = selected.slice(0, Math.floor(limit));
  return selected;
}

let API_KEY;
async function fetchJson(method, route, body) {
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
  if (!response.ok) throw new Error(`PlayVeo ${method} ${route} failed (${response.status}): ${safeError(text)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`PlayVeo ${method} ${route} returned non-JSON data`);
  }
}

async function fetchImageBytes(url) {
  API_KEY ??= loadApiKey();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`Provider image download failed (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const type = imageType(buffer, response.headers.get('content-type') ?? '');
  return { buffer, ...type };
}

function imageEntity(response) {
  return response?.image ?? response?.job ?? response;
}

function resultUrls(response) {
  const entity = imageEntity(response);
  const direct = [entity?.resultUrls, entity?.result_urls, entity?.images, response?.images]
    .find((candidate) => Array.isArray(candidate));
  if (direct) {
    return direct.map((item) => typeof item === 'string' ? item : item?.url).filter(Boolean);
  }
  return [entity?.imageUrl, entity?.image_url, entity?.resultUrl, entity?.result_url, entity?.url]
    .filter(Boolean);
}

function synchronousResultUrl(response) {
  const entity = imageEntity(response);
  return entity?.url ?? entity?.imageUrl ?? entity?.image_url ??
    entity?.resultUrl ?? entity?.result_url ?? response?.url ?? null;
}

async function downloadOne(job) {
  const response = await fetchJson('GET', `/v1/images/${job.job_id}`);
  const entity = imageEntity(response);
  if (String(entity?.status ?? '').toLowerCase() !== 'completed') {
    throw new Error(`Job ${job.job_id} is not completed`);
  }
  const urls = resultUrls(response);
  if (!urls.length) throw new Error(`Completed job ${job.job_id} has no result`);
  const downloaded = await fetchImageBytes(urls[0]);

  let relativePath = job.source_file;
  if (path.extname(relativePath).toLowerCase() !== downloaded.extension) {
    relativePath = relativePath.replace(/\.[^.\/]+$/, downloaded.extension);
    job.source_file = relativePath.replaceAll('\\', '/');
  }
  const outputPath = absolute(relativePath);
  ensureParent(outputPath);
  fs.writeFileSync(outputPath, downloaded.buffer);
  job.downloaded = true;
  job.downloaded_at = new Date().toISOString();
  job.source_mime = downloaded.mime;
  job.source_bytes = downloaded.buffer.length;
  job.source_checksum_sha256 = sha256(downloaded.buffer);
  job.download_error = null;
}

async function downloadAll(state) {
  const jobs = filterJobs(state.jobs).filter((job) =>
    job.generation_method !== 'set_sheet_crop' &&
    job.status === 'completed' && (!job.downloaded || !fs.existsSync(absolute(job.source_file))));
  console.log(`Downloading ${jobs.length} completed provider output(s) into Majarra-controlled local storage.`);
  let done = 0;
  for (let start = 0; start < jobs.length; start += 5) {
    const batch = jobs.slice(start, start + 5);
    await Promise.all(batch.map(async (job) => {
      try {
        await downloadOne(job);
        done += 1;
        console.log(`[${done}/${jobs.length}] downloaded ${job.key}`);
      } catch (error) {
        job.downloaded = false;
        job.download_error = safeError(error.message);
        console.error(`FAILED download ${job.key}: ${job.download_error}`);
      }
    }));
    saveState(state);
  }
}

function dataUrlFor(job) {
  const source = fs.readFileSync(absolute(job.source_file));
  const type = imageType(source, job.source_mime);
  return `data:${type.mime};base64,${source.toString('base64')}`;
}

function removedRelativePath(job) {
  const source = job.source_file.replaceAll('\\', '/');
  const marker = '/source/';
  return source.includes(marker)
    ? source.replace(marker, '/removed/').replace(/\.[^.\/]+$/, '.png')
    : source.replace(/\.[^.\/]+$/, '.removed.png');
}

async function removeBackgroundOne(job) {
  const startedAt = new Date().toISOString();
  const response = await fetchJson('POST', '/v1/images/remove-background', { image: dataUrlFor(job) });
  const entity = imageEntity(response);
  const status = String(entity?.status ?? response?.status ?? '').toLowerCase();
  if (status && status !== 'completed') throw new Error(`Background removal returned status ${status}`);
  const url = synchronousResultUrl(response);
  if (!url) throw new Error('Background removal completed without a result URL');
  const downloaded = await fetchImageBytes(url);
  if (downloaded.mime !== 'image/png') {
    throw new Error(`Background removal returned ${downloaded.mime}, expected transparent PNG`);
  }
  const relativePath = removedRelativePath(job);
  const outputPath = absolute(relativePath);
  ensureParent(outputPath);
  fs.writeFileSync(outputPath, downloaded.buffer);
  job.removed_file = relativePath;
  job.background_removed = true;
  job.background_removal_status = 'completed';
  job.background_removal_started_at = startedAt;
  job.background_removal_completed_at = new Date().toISOString();
  job.background_removal_id = entity?.id ?? response?.id ?? null;
  job.removed_mime = downloaded.mime;
  job.removed_bytes = downloaded.buffer.length;
  job.removed_checksum_sha256 = sha256(downloaded.buffer);
  job.background_removal_error = null;
}

async function removeAllBackgrounds(state) {
  const jobs = filterJobs(state.jobs).filter((job) =>
    job.status === 'completed' && job.background_removal_required &&
    job.downloaded && (!job.background_removed || !job.removed_file || !fs.existsSync(absolute(job.removed_file))));
  console.log(`Running documented synchronous background removal for ${jobs.length} standalone object(s).`);
  let done = 0;
  for (let start = 0; start < jobs.length; start += 2) {
    const batch = jobs.slice(start, start + 2);
    await Promise.all(batch.map(async (job) => {
      try {
        await removeBackgroundOne(job);
        done += 1;
        console.log(`[${done}/${jobs.length}] background removed ${job.key}`);
      } catch (error) {
        job.background_removed = false;
        job.background_removal_status = 'failed';
        job.background_removal_error = safeError(error.message);
        console.error(`FAILED background removal ${job.key}: ${job.background_removal_error}`);
      }
    }));
    saveState(state);
  }
}

function prepareFailedBackgroundRetries(state) {
  const jobs = filterJobs(state.jobs).filter((job) =>
    job.background_removal_required && job.background_removal_status === 'failed');
  for (const job of jobs) {
    job.background_removal_attempts ??= [];
    job.background_removal_attempts.push({
      status: job.background_removal_status,
      started_at: job.background_removal_started_at,
      completed_at: job.background_removal_completed_at,
      error: job.background_removal_error,
    });
    job.background_removed = false;
    job.background_removal_status = 'planned';
    job.background_removal_started_at = null;
    job.background_removal_completed_at = null;
    job.background_removal_error = null;
  }
  saveState(state);
  console.log(`Prepared ${jobs.length} failed background-removal operation(s) for retry.`);
}

function verify(state) {
  const selected = filterJobs(state.jobs);
  const missingSources = selected.filter((job) =>
    job.status === 'completed' && (!job.downloaded || !fs.existsSync(absolute(job.source_file))));
  const missingRemoved = selected.filter((job) =>
    job.background_removal_required && (!job.background_removed || !job.removed_file ||
      !fs.existsSync(absolute(job.removed_file))));
  const sourceBytes = selected.reduce((sum, job) => sum + (job.source_bytes ?? 0), 0);
  const removedBytes = selected.reduce((sum, job) => sum + (job.removed_bytes ?? 0), 0);
  console.log(JSON.stringify({
    selected: selected.length,
    downloaded: selected.filter((job) => job.downloaded).length,
    derivedFromCoherentSetSheets: selected.filter((job) => job.generation_method === 'set_sheet_crop').length,
    coherentSetSources: Object.keys(state.set_sources ?? {}).length,
    backgroundRemovalRequired: selected.filter((job) => job.background_removal_required).length,
    backgroundRemoved: selected.filter((job) => job.background_removed).length,
    missingSources: missingSources.map((job) => job.key),
    missingRemoved: missingRemoved.map((job) => job.key),
    sourceBytes,
    removedBytes,
    providerResultUrlsPersisted: state.provider_result_urls_persisted,
  }, null, 2));
  if (missingSources.length || missingRemoved.length) process.exitCode = 1;
}

async function main() {
  const state = readState();
  if (hasArg('download')) await downloadAll(state);
  if (hasArg('retry-failed-bg')) prepareFailedBackgroundRetries(state);
  if (hasArg('remove-background')) await removeAllBackgrounds(state);
  if (hasArg('verify') || process.argv.length === 2) verify(state);
  saveState(state);
}

main().catch((error) => {
  console.error(safeError(error.message));
  process.exit(1);
});
