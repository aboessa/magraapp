// Majarra — AutoFlow image generation runner.
//
// Usage (from repo root):
//   node tools/autoflow/generate.mjs --validate         # check prompt lengths only. No API call, no credits.
//   node tools/autoflow/generate.mjs --probe            # report queue state and recent jobs
//   node tools/autoflow/generate.mjs --only page-001    # submit one asset
//   node tools/autoflow/generate.mjs --rest             # submit every asset except the reference seed
//   node tools/autoflow/generate.mjs --rest --no-ref    # ...without sending a character reference
//
// Key: $env:AUTOFLOW_API_KEY, else %USERPROFILE%\.majarra\autoflow.key.
// The key is never written into this repository.
//
// API contract, confirmed against https://autoflow-web-3yn.pages.dev/docs and live probes:
//   POST /api/jobs            -> { success, jobId, status, queuePosition, _debug:{assigned} }
//   GET  /api/jobs            -> { jobs:[...], total } with SNAKE_CASE fields (result_url, error_message)
//   GET  /api/jobs/:id/download -> { url, filename, size, type }
//   GET  /api/jobs/:id/file     -> the actual bytes
//   `quality` is FREEPIK ONLY. Sending it on a Flow model job makes the job disappear.
//   `referenceImages.images` must be BASE64 strings, not URLs.
//   Free plan: 10 requests/min, 2 concurrent, 50 credits/month. 1 credit per job.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const BASE = 'https://autoflow-api.aboessa101.workers.dev';
const PROMPT_LIMIT = 500;
const FLOW_MODELS = new Set(['imagen4', 'nano_banana_pro', 'nano_banana2']);
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = path.join(import.meta.dirname, 'act-s1.manifest.json');

// ---------------------------------------------------------------- key & args

function loadKey() {
  if (process.env.AUTOFLOW_API_KEY) return process.env.AUTOFLOW_API_KEY.trim();
  const p = path.join(os.homedir(), '.majarra', 'autoflow.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('No API key. Set $env:AUTOFLOW_API_KEY or create ~/.majarra/autoflow.key');
}

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const OPT = {
  validate: !!arg('validate'),
  probe: !!arg('probe'),
  rest: !!arg('rest'),
  only: typeof arg('only') === 'string' ? arg('only') : undefined,
  noRef: !!arg('no-ref'),
  // Attach to a job that was already submitted and paid for, and save its output.
  fetch: typeof arg('fetch') === 'string' ? arg('fetch') : undefined,
  as: typeof arg('as') === 'string' ? arg('as') : undefined,
  // Override the manifest model/quality for diagnostics without editing the manifest.
  model: typeof arg('model') === 'string' ? arg('model') : undefined,
  quality: typeof arg('quality') === 'string' ? arg('quality') : undefined,
};

// ---------------------------------------------------------------- manifest

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const OUT_DIR = path.join(ROOT, manifest.out_dir);

const buildPrompt = (asset) => (asset.scene + manifest.style_tail).replace(/\s+/g, ' ').trim();

function validate() {
  let bad = 0;
  console.log('id'.padEnd(12) + 'chars'.padStart(6) + '       model      ratio');
  for (const a of manifest.assets) {
    const n = buildPrompt(a).length;
    if (n > PROMPT_LIMIT) bad++;
    console.log(
      a.id.replace('asset-act-s1-', '').padEnd(12) + String(n).padStart(6) +
      (n > PROMPT_LIMIT ? '  OVER ' : '  ok   ') + '  ' + a.model.padEnd(10) + ' ' + a.aspectRatio
    );
  }
  console.log(bad === 0
    ? `All ${manifest.assets.length} prompts within the ${PROMPT_LIMIT}-char limit.`
    : `${bad} prompt(s) over ${PROMPT_LIMIT} chars — fix the manifest first.`);
  return bad === 0;
}

// ---------------------------------------------------------------- api

const KEY = OPT.validate ? null : loadKey();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, route, body) {
  const res = await fetch(BASE + route, {
    method,
    headers: { 'X-API-Key': KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (res.status === 402) throw new Error('402 out of credits: ' + text.slice(0, 200));
  if (res.status === 429) throw new Error('429 rate limited, Retry-After=' + (res.headers.get('Retry-After') ?? '?'));
  if (!res.ok) throw new Error(res.status + ' ' + route + ': ' + text.slice(0, 300));
  try { return JSON.parse(text); } catch { return text; }
}

function payloadFor(asset, refB64) {
  const model = OPT.model ?? asset.model;
  const p = {
    type: 'image',
    prompt: buildPrompt(asset),
    model,
    aspectRatio: asset.aspectRatio,
    count: 1,
  };
  // The docs call quality Freepik-only, but the dashboard sends it on Flow jobs too
  // and those succeed, so it is passed through whenever a value is given.
  const quality = OPT.quality ?? asset.quality;
  if (quality) p.quality = quality;
  if (refB64) {
    p.referenceImages = {
      images: [refB64],
      mode: FLOW_MODELS.has(asset.model) ? 'ingredients' : 'character',
    };
  }
  return p;
}

async function submit(asset, refB64) {
  const p = payloadFor(asset, refB64);
  if (p.prompt.length > PROMPT_LIMIT) {
    throw new Error(`prompt is ${p.prompt.length} chars, over ${PROMPT_LIMIT}`);
  }
  console.log(`  payload ${JSON.stringify({ ...p, prompt: p.prompt.length + ' chars', referenceImages: refB64 ? '<base64>' : undefined })}`);
  const res = await api('POST', '/api/jobs', p);
  const id = res.jobId ?? res.id;
  if (!id) throw new Error('no jobId in response: ' + JSON.stringify(res).slice(0, 300));
  const assigned = res._debug?.assigned;
  console.log(`  job ${id} [${res.status}]${assigned === false ? ' NO WORKER ASSIGNED' : ''}` +
    (refB64 ? ' with reference' : ''));
  return id;
}

async function findJob(jobId) {
  const res = await api('GET', '/api/jobs?limit=50');
  return (res.jobs ?? []).find((j) => j.id === jobId);
}

// Terminal states are completed / failed. A job that disappears from the list was
// rejected by the queue (that is how an invalid parameter surfaces), so treat a
// sustained absence as a failure instead of waiting out the 15-minute auto-fail.
async function waitFor(jobId, { timeoutMs = 10 * 60 * 1000, everyMs = 8000 } = {}) {
  const started = Date.now();
  let last = '';
  let missing = 0;
  while (Date.now() - started < timeoutMs) {
    await sleep(everyMs);
    const job = await findJob(jobId);
    if (!job) {
      if (++missing >= 4) {
        throw new Error(`job ${jobId} vanished from the queue — the API rejected it ` +
          '(most often an invalid parameter for the chosen model)');
      }
      continue;
    }
    missing = 0;
    if (job.status !== last) {
      console.log(`  [${Math.round((Date.now() - started) / 1000)}s] ${job.status}`);
      last = job.status;
    }
    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(`generation failed: ${job.error_message ?? 'no reason given'}`);
  }
  throw new Error(`job ${jobId} still unfinished after ${Math.round(timeoutMs / 60000)} min`);
}

async function downloadResult(jobId, destPath) {
  const meta = await api('GET', `/api/jobs/${jobId}/download`);
  const fileRoute = meta.url ?? `/api/jobs/${jobId}/file`;
  const res = await fetch(BASE + fileRoute, { headers: { 'X-API-Key': KEY } });
  if (!res.ok) throw new Error(`download ${res.status} ${fileRoute}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return { bytes: buf.length, filename: meta.filename };
}

// ---------------------------------------------------------------- run log

const LOG_PATH = path.join(OUT_DIR, '_run-log.json');

function appendLog(entry) {
  let log = { runs: [] };
  if (fs.existsSync(LOG_PATH)) {
    try { log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch { /* reset */ }
  }
  log.runs.push(entry);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + '\n');
}

// ---------------------------------------------------------------- run

async function runAsset(asset, refB64) {
  console.log(`\n${asset.id}  ${asset.model} ${asset.aspectRatio}`);
  const jobId = await submit(asset, refB64);
  await waitFor(jobId);
  const dest = path.join(OUT_DIR, asset.file);
  const { bytes } = await downloadResult(jobId, dest);
  console.log(`  saved ${manifest.out_dir}/${asset.file} (${(bytes / 1024).toFixed(0)} KB)`);
  appendLog({
    at: new Date().toISOString(),
    asset: asset.id,
    jobId,
    model: asset.model,
    aspectRatio: asset.aspectRatio,
    promptChars: buildPrompt(asset).length,
    usedReference: !!refB64,
    file: `${manifest.out_dir}/${asset.file}`,
    bytes,
  });
  return dest;
}

function referenceB64() {
  if (OPT.noRef) return undefined;
  const seed = manifest.assets.find((a) => a.id.endsWith(manifest.reference_seed));
  const p = path.join(OUT_DIR, seed.file);
  if (!fs.existsSync(p)) {
    console.log(`  (no reference: ${manifest.out_dir}/${seed.file} not generated yet)`);
    return undefined;
  }
  const b64 = fs.readFileSync(p).toString('base64');
  console.log(`  reference: ${seed.file}, ${(b64.length / 1024 / 1024).toFixed(1)} MB base64`);
  return b64;
}

async function main() {
  if (!validate()) process.exit(1);
  if (OPT.validate) return;

  if (OPT.probe) {
    const res = await api('GET', '/api/jobs?limit=20');
    console.log(`\nqueue total=${res.total}`);
    for (const j of res.jobs ?? []) {
      console.log(`  ${j.id}  ${String(j.status).padEnd(10)} ${j.created_at ?? ''} ${j.error_message ?? ''}`);
    }
    return;
  }

  if (OPT.fetch) {
    if (!OPT.as) throw new Error('--fetch <jobId> also needs --as <assetIdSuffix>');
    const asset = manifest.assets.find((a) => a.id.endsWith(OPT.as));
    if (!asset) throw new Error(`no asset matching --as ${OPT.as}`);
    const dest = path.join(OUT_DIR, asset.file);
    const { bytes } = await downloadResult(OPT.fetch, dest);
    console.log(`saved ${manifest.out_dir}/${asset.file} (${(bytes / 1024).toFixed(0)} KB)`);
    appendLog({
      at: new Date().toISOString(),
      asset: asset.id,
      jobId: OPT.fetch,
      model: asset.model,
      aspectRatio: asset.aspectRatio,
      promptChars: buildPrompt(asset).length,
      usedReference: false,
      file: `${manifest.out_dir}/${asset.file}`,
      bytes,
    });
    return;
  }

  const seed = manifest.assets.find((a) => a.id.endsWith(manifest.reference_seed));
  let targets;
  if (OPT.only) {
    targets = manifest.assets.filter((a) => a.id.endsWith(OPT.only));
    if (!targets.length) throw new Error(`no asset matching --only ${OPT.only}`);
  } else if (OPT.rest) {
    targets = manifest.assets.filter((a) => a.id !== seed.id);
  } else {
    console.log('\nNothing to do. Pass --validate, --probe, --only <id> or --rest.');
    return;
  }

  console.log(`\n${targets.length} job(s) = ${targets.length} credit(s).`);
  let ref = targets.some((t) => t.id !== seed.id) ? referenceB64() : undefined;

  const failures = [];
  for (const asset of targets) {
    try {
      await runAsset(asset, ref);
    } catch (err) {
      console.error(`  FAILED ${asset.id}: ${err.message}`);
      failures.push({ id: asset.id, error: err.message });
      // A reference that the API will not accept fails identically every time.
      // Drop it once and keep going rather than losing the whole batch.
      if (ref && /413|payload|too large|reference/i.test(err.message)) {
        console.error('  dropping the reference image and continuing without it');
        ref = undefined;
      } else if (/out of credits|vanished/.test(err.message)) {
        console.error('  stopping early — the remaining assets were not submitted');
        break;
      }
    }
    await sleep(7000); // stay under 10 requests/min
  }

  console.log(`\ndone: ${targets.length - failures.length}/${targets.length} saved`);
  for (const f of failures) console.log(`  FAILED ${f.id}: ${f.error}`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error('\nERROR: ' + err.message);
  process.exit(1);
});
