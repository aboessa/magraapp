// Majarra — AutoFlow API surface test (Freepik intentionally excluded).
//
// Phase 1 (this run): read-only / no-cost probes — auth, job listing, job lookup,
// download routes, and input-validation error paths. None of these create a job.
//
// Phase 2 (separate, costs credits): one minimal image job per Flow model
// (imagen4, nano_banana_pro, nano_banana2) to see which model actually completes.
// Video models (veo3_fast, veo3_quality, veo2_fast) are NOT run automatically —
// each is a paid multi-minute job and needs explicit confirmation first.
//
// Usage:
//   node tools/autoflow/api-test.mjs            # phase 1 only, free
//   node tools/autoflow/api-test.mjs --models    # phase 1 + phase 2 image models (3 credits)
//
// Key: $env:AUTOFLOW_API_KEY, else %USERPROFILE%\.majarra\autoflow.key.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASE = 'https://autoflow-api.aboessa101.workers.dev';
const RUN_MODELS = process.argv.includes('--models');

function loadKey() {
  if (process.env.AUTOFLOW_API_KEY) return process.env.AUTOFLOW_API_KEY.trim();
  const p = path.join(os.homedir(), '.majarra', 'autoflow.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('No API key. Set $env:AUTOFLOW_API_KEY or create ~/.majarra/autoflow.key');
}
const KEY = loadKey();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}\n      ${detail}`);
}

async function raw(method, route, { headers = {}, body } = {}) {
  const res = await fetch(BASE + route, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, json, headers: res.headers };
}

// ---------------------------------------------------------------- phase 1

async function phase1() {
  console.log('=== Phase 1: read-only probes, no credits spent ===\n');

  // 1. Auth: no key at all
  {
    const r = await raw('GET', '/api/jobs?limit=1');
    record('GET /api/jobs (no X-API-Key header)', r.status === 401,
      `status=${r.status} body=${r.text.slice(0, 150)}`);
  }

  // 2. Auth: garbage key
  {
    const r = await raw('GET', '/api/jobs?limit=1', { headers: { 'X-API-Key': 'af_not_a_real_key' } });
    record('GET /api/jobs (invalid X-API-Key)', r.status === 401,
      `status=${r.status} body=${r.text.slice(0, 150)}`);
  }

  // 3. Auth: real key
  let listRes;
  {
    const r = await raw('GET', '/api/jobs?limit=50', { headers: { 'X-API-Key': KEY } });
    listRes = r;
    record('GET /api/jobs (valid key)', r.status === 200,
      `status=${r.status} total=${r.json?.total ?? '?'}`);
  }

  // 4. Status filters
  for (const status of ['pending', 'queued', 'processing', 'completed', 'failed']) {
    const r = await raw('GET', `/api/jobs?status=${status}&limit=5`, { headers: { 'X-API-Key': KEY } });
    record(`GET /api/jobs?status=${status}`, r.status === 200,
      `status=${r.status} count=${r.json?.jobs?.length ?? '?'}`);
  }

  // 5. Pagination params
  {
    const r = await raw('GET', '/api/jobs?limit=2&offset=1', { headers: { 'X-API-Key': KEY } });
    record('GET /api/jobs?limit=2&offset=1', r.status === 200,
      `status=${r.status} count=${r.json?.jobs?.length ?? '?'}`);
  }

  // 6. Single job lookup on a real completed job (from history), a fake id, and a
  //    job that is known to have vanished from the list entirely.
  const completedId = listRes.json?.jobs?.find((j) => j.status === 'completed')?.id;
  if (completedId) {
    const r = await raw('GET', `/api/jobs/${completedId}`, { headers: { 'X-API-Key': KEY } });
    record(`GET /api/jobs/:id (real completed job)`, r.status === 200 || r.status === 404,
      `status=${r.status} body=${r.text.slice(0, 150)}`);

    const dl = await raw('GET', `/api/jobs/${completedId}/download`, { headers: { 'X-API-Key': KEY } });
    record('GET /api/jobs/:id/download', dl.status === 200,
      `status=${dl.status} body=${dl.text.slice(0, 200)}`);

    if (dl.json?.url) {
      const file = await fetch(BASE + dl.json.url, { headers: { 'X-API-Key': KEY } });
      record('GET /api/jobs/:id/file (via download url)', file.ok,
        `status=${file.status} content-type=${file.headers.get('content-type')} length=${file.headers.get('content-length')}`);
    }
  } else {
    record('GET /api/jobs/:id (real completed job)', false, 'no completed job found in history to test against');
  }

  {
    const r = await raw('GET', '/api/jobs/00000000-0000-0000-0000-000000000000', { headers: { 'X-API-Key': KEY } });
    record('GET /api/jobs/:id (nonexistent id)', r.status === 404,
      `status=${r.status} body=${r.text.slice(0, 150)}`);
  }

  // 7. POST validation errors (rejected before a job is created, so no credit cost)
  {
    const r = await raw('POST', '/api/jobs', { headers: { 'X-API-Key': KEY }, body: {} });
    record('POST /api/jobs (missing type & prompt)', r.status === 400,
      `status=${r.status} body=${r.text.slice(0, 200)}`);
  }
  {
    const r = await raw('POST', '/api/jobs', { headers: { 'X-API-Key': KEY }, body: { type: 'image' } });
    record('POST /api/jobs (missing prompt)', r.status === 400,
      `status=${r.status} body=${r.text.slice(0, 200)}`);
  }
  {
    const longPrompt = 'a'.repeat(600);
    const r = await raw('POST', '/api/jobs', {
      headers: { 'X-API-Key': KEY },
      body: { type: 'image', prompt: longPrompt, model: 'nano_banana2' },
    });
    record('POST /api/jobs (prompt over 500 chars)', r.status === 400,
      `status=${r.status} body=${r.text.slice(0, 200)}`);
  }
  {
    const r = await raw('POST', '/api/jobs', {
      headers: { 'X-API-Key': KEY },
      body: { type: 'not_a_real_type', prompt: 'test' },
    });
    record('POST /api/jobs (invalid type value)', r.status === 400,
      `status=${r.status} body=${r.text.slice(0, 200)}`);
  }

  // 8. Docs / base route sanity
  {
    const r = await raw('GET', '/');
    record('GET / (base route)', r.status < 500,
      `status=${r.status}`);
  }

  console.log(`\nPhase 1 done: ${results.filter((r) => r.ok).length}/${results.length} as expected.\n`);
}

// ---------------------------------------------------------------- phase 2

const IMAGE_MODELS = ['imagen4', 'nano_banana_pro', 'nano_banana2'];

async function submitAndWait(model) {
  const body = {
    type: 'image',
    prompt: `AutoFlow API test image for the ${model} model, a single small blue circle on white, no text.`,
    model,
    aspectRatio: 'landscape',
    count: 1,
  };
  const create = await raw('POST', '/api/jobs', { headers: { 'X-API-Key': KEY }, body });
  if (create.status !== 200 && create.status !== 201) {
    return { model, ok: false, detail: `create failed: ${create.status} ${create.text.slice(0, 200)}` };
  }
  const jobId = create.json?.jobId;
  if (!jobId) return { model, ok: false, detail: `create returned no jobId: ${create.text.slice(0, 200)}` };

  const started = Date.now();
  let missing = 0;
  while (Date.now() - started < 10 * 60 * 1000) {
    await sleep(8000);
    const list = await raw('GET', '/api/jobs?limit=50', { headers: { 'X-API-Key': KEY } });
    const job = list.json?.jobs?.find((j) => j.id === jobId);
    if (!job) {
      if (++missing >= 4) return { model, ok: false, detail: `job ${jobId} vanished from the queue` };
      continue;
    }
    missing = 0;
    if (job.status === 'completed') {
      return { model, ok: true, detail: `job ${jobId} completed in ${Math.round((Date.now() - started) / 1000)}s` };
    }
    if (job.status === 'failed') {
      return { model, ok: false, detail: `job ${jobId} failed: ${job.error_message ?? 'no reason given'}` };
    }
  }
  return { model, ok: false, detail: `job ${jobId} still unfinished after 10 min` };
}

async function phase2() {
  console.log(`=== Phase 2: one real image job per Flow model (${IMAGE_MODELS.length} credits) ===\n`);
  for (const model of IMAGE_MODELS) {
    console.log(`submitting ${model}...`);
    const r = await submitAndWait(model);
    record(`Flow model: ${model}`, r.ok, r.detail);
    await sleep(7000);
  }
}

await phase1();
if (RUN_MODELS) await phase2();
else console.log('Skipping Phase 2 (image model generation). Re-run with --models to spend 3 credits and test imagen4 / nano_banana_pro / nano_banana2 directly.');

console.log('\n=== Summary ===');
for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.name}`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log(`\n${failed.length} unexpected result(s):`);
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
}
