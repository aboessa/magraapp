// Majarra — PlayVeo image generation runner.
//
// Usage (from repo root):
//   node tools/playveo/generate.mjs --validate            # prompt lengths only. No API call, no credits.
//   node tools/playveo/generate.mjs --only page-001       # submit one asset (text-to-image if it is the seed)
//   node tools/playveo/generate.mjs --only page-001,page-008 --out-dir tools/playveo/output/review
//   node tools/playveo/generate.mjs --reftest             # 1 credit-ish probe: can i2i actually restage the scene?
//   node tools/playveo/generate.mjs --rest                # every asset except the reference seed
//   node tools/playveo/generate.mjs --missing             # only assets without an output file
//   node tools/playveo/generate.mjs --rest --no-ref       # ...without attaching the character reference
//
// --out-dir overrides the manifest output directory for isolated review rounds.
// It must stay inside the workspace; production files are replaced only after review.
//
// Key: $env:PLAYVEO_API_KEY, else %USERPROFILE%\.majarra\playveo.key.
// The key is never printed and never written into this repository.
//
// API contract, confirmed by live calls on 2026-08-11 (the published docs are
// incomplete and wrong in three places, so this is the verified shape):
//   POST /v1/images/text-to-image  { prompt, aspect_ratio, count }
//                                  -> { id, status:'pending', model, creditCost:0.1 }
//   POST /v1/images/image-to-image { prompt, aspect_ratio, count, image }
//                                  -> { id, status, sourceImageUrl, strength:0.7, creditCost:0.15 }
//        `image` MUST be a base64 data URL. Passing `image_url` returns
//        400 "Image is required (base64 data URL)".
//   GET  /v1/images/{id}           -> { image:{ status, resultUrls:[...], error } }
//        NOT /v1/jobs/{id} and NOT /v1/images/text-to-image/{id}; both 404.
//   Result URLs are absolute, under /worker/serve-image/.
//   Observed latency: text-to-image ~41 s, image-to-image ~59 s.
//   Output is JPEG. There is no PNG option, so these are proofs not masters.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DEFAULT_MANIFEST = 'act-s1.manifest.json';

// ---------------------------------------------------------------- key & args

function loadKey() {
  if (process.env.PLAYVEO_API_KEY) return process.env.PLAYVEO_API_KEY.trim();
  const p = path.join(os.homedir(), '.majarra', 'playveo.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('No API key. Set $env:PLAYVEO_API_KEY or create ~/.majarra/playveo.key');
}

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const concurrencyArg = arg('concurrency');
const concurrency = concurrencyArg === undefined ? 1 : Number(concurrencyArg);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) {
  throw new Error('--concurrency must be an integer between 1 and 10');
}

const onlyArg = typeof arg('only') === 'string' ? arg('only') : undefined;
const onlyIds = onlyArg
  ? onlyArg.split(',').map((value) => value.trim()).filter(Boolean)
  : [];
const outDirArg = typeof arg('out-dir') === 'string' ? arg('out-dir') : undefined;
if (outDirArg && path.isAbsolute(outDirArg)) {
  throw new Error('--out-dir must be a workspace-relative path');
}

const OPT = {
  validate: !!arg('validate'),
  reftest: !!arg('reftest'),
  rest: !!arg('rest'),
  missing: !!arg('missing'),
  onlyIds,
  outDir: outDirArg,
  noRef: !!arg('no-ref'),
  concurrency,
  manifest: typeof arg('manifest') === 'string' ? arg('manifest') : DEFAULT_MANIFEST,
};

const MANIFEST = path.isAbsolute(OPT.manifest)
  ? OPT.manifest
  : path.join(import.meta.dirname, OPT.manifest);

// ---------------------------------------------------------------- manifest

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const BASE = manifest.base_url;
const outputRelative = OPT.outDir ?? manifest.out_dir;
const OUT_DIR = path.resolve(ROOT, outputRelative);
const rootPrefix = `${ROOT}${path.sep}`;
if (OUT_DIR !== ROOT && !OUT_DIR.startsWith(rootPrefix)) {
  throw new Error('--out-dir must resolve inside the workspace');
}

/// Prompt order: character lock, scene, this page's light, shared style tail.
///
/// The character lock leads because it is the only thing holding identity together.
/// The provider's image-to-image endpoint cannot be used as a character reference
/// (see `mode_note` in the manifest: six live jobs, byte-identical output, prompt
/// ignored), so the bird stays the same bird only if every prompt describes him in
/// the same words.
///
/// Light is per asset and sits before the tail because the story file sets a
/// brightness curve from 1.00 down to 0.70 and makes a visible moon mandatory only
/// on the last two pages. A single shared sky clause cannot serve every page — the
/// first attempt at page-001 proved it by returning a starry night sky for the
/// brightest page in the story.
/// `character_lock` is optional, and its absence must not leak into the prompt.
///
/// Written as unguarded concatenation this produced the literal string
/// "undefined " at the head of every prompt for any manifest without a character
/// to lock — which is every manifest that is not a story: line art, covers,
/// colouring pages. The provider would have been paid to render the word.
/// Caught by --validate before the first billed call on coloring.manifest.json.
const buildPrompt = (asset) =>
  ((manifest.character_lock ?? '') + ' ' + asset.scene + ' ' + (asset.light ?? '') + manifest.style_tail)
    .replace(/\s+/g, ' ').trim();

/// Image-to-image prompt: the same thing, prefixed with an explicit identity
/// instruction.
///
/// The prefix exists because of a measured behaviour, not a guess: on the first
/// live i2i test the model reproduced the source framing almost exactly while
/// changing only the pose. Left implicit, "here is an image, here is a scene" is
/// read as "edit this picture". Stating which parts to preserve (character) and
/// which to replace (scene, camera) is what separates a restaged panel from a
/// near-duplicate of the reference.
const buildRefPrompt = (asset) =>
  (manifest.reference_instruction + ' ' + asset.scene + ' ' + (asset.light ?? '') + manifest.style_tail)
    .replace(/\s+/g, ' ').trim();

function validate() {
  console.log('id'.padEnd(14) + 't2i'.padStart(6) + 'i2i'.padStart(6) + '   ratio');
  for (const a of manifest.assets) {
    console.log(
      a.id.replace('asset-act-s1-', '').padEnd(14) +
      String(buildPrompt(a).length).padStart(6) +
      String(buildRefPrompt(a).length).padStart(6) +
      '   ' + a.aspect_ratio
    );
  }
  // No documented prompt limit for PlayVeo, unlike AutoFlow's hard 500. Lengths
  // are still reported so a regression shows up rather than being discovered as a
  // silent truncation.
  console.log(`\n${manifest.assets.length} assets. No documented prompt limit on this provider; lengths shown for reference.`);
}

// ---------------------------------------------------------------- api

const KEY = OPT.validate ? null : loadKey();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, route, body) {
  const res = await fetch(BASE + route, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  if (res.status === 401) throw new Error('401 unauthorized — check the PlayVeo key');
  if (res.status === 402) throw new Error('402 out of credits: ' + text.slice(0, 200));
  if (res.status === 429) throw new Error('429 rate limited');
  if (!res.ok) throw new Error(`${res.status} ${route}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function submit(asset, refDataUrl, log = console.log) {
  const usingRef = !!refDataUrl;
  const prompt = usingRef ? buildRefPrompt(asset) : buildPrompt(asset);
  const route = usingRef ? '/v1/images/image-to-image' : '/v1/images/text-to-image';
  const payload = {
    prompt,
    aspect_ratio: asset.aspect_ratio,
    count: 1,
    ...(manifest.model ? { model: manifest.model } : {}),
    ...(usingRef ? { image: refDataUrl } : {}),
  };
  log(`  ${usingRef ? 'i2i' : 't2i'}  ${prompt.length} chars  ${asset.aspect_ratio}`);
  // Never retry this POST automatically: an unknown response may already have
  // created a paid job, and repeating it can bill a duplicate.
  const res = await api('POST', route, payload);
  if (!res.id) throw new Error('no id in response: ' + JSON.stringify(res).slice(0, 300));
  log(`  job ${res.id} [${res.status}] cost=${res.creditCost}${res.strength ? ` strength=${res.strength}` : ''}`);
  return res.id;
}

/// Polls until the job leaves pending/processing.
///
/// `failed` is terminal and reported with the provider's own message; a job that
/// never leaves processing is surfaced as a timeout rather than hanging forever.
async function waitFor(id, { timeoutMs = 8 * 60 * 1000, everyMs = 10_000, log = console.log } = {}) {
  const started = Date.now();
  let last = '';
  while (Date.now() - started < timeoutMs) {
    await sleep(everyMs);
    const res = await api('GET', `/v1/images/${id}`);
    const img = res.image ?? res;
    if (img.status !== last) {
      log(`  [${Math.round((Date.now() - started) / 1000)}s] ${img.status}`);
      last = img.status;
    }
    if (img.status === 'completed') {
      if (!img.resultUrls?.length) throw new Error('completed but resultUrls was empty');
      return img;
    }
    if (img.status === 'failed') throw new Error(`generation failed: ${img.error ?? 'no reason given'}`);
  }
  throw new Error(`job ${id} still unfinished after ${Math.round(timeoutMs / 60000)} min`);
}

async function download(url, destPath) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // JPEG SOI. Guards against saving an error page as a .jpg, which would only be
  // discovered later when something tried to display it.
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) {
    throw new Error(`downloaded ${buf.length} bytes but it is not a JPEG`);
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

function writeLogEntries(entries) {
  if (!entries.length) return;
  const logPath = path.join(OUT_DIR, '_run-log.json');
  let log = [];
  if (fs.existsSync(logPath)) {
    try { log = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch { log = []; }
  }
  const tempPath = `${logPath}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify([...log, ...entries], null, 2));
  fs.renameSync(tempPath, logPath);
}

/// Reads the generated seed image back as a base64 data URL.
///
/// The provider rejects URLs, so the reference has to travel as bytes on every
/// single request. A ~440 KB JPEG becomes ~590 KB of base64 in each body.
function referenceDataUrl() {
  if (OPT.noRef) return undefined;
  const seed = manifest.assets.find((a) => a.id.endsWith(manifest.reference_seed));
  const p = path.join(OUT_DIR, seed.file);
  if (!fs.existsSync(p)) {
    console.log(`  (no reference: ${outputRelative}/${seed.file} not generated yet)`);
    return undefined;
  }
  const b64 = fs.readFileSync(p).toString('base64');
  console.log(`  reference: ${seed.file}, ${(b64.length / 1024 / 1024).toFixed(2)} MB base64`);
  return `data:image/jpeg;base64,${b64}`;
}

async function run(asset, refDataUrl) {
  const lines = [`\n${asset.id}`];
  const log = (message) => lines.push(message);
  try {
    const id = await submit(asset, refDataUrl, log);
    const img = await waitFor(id, { log });
    const dest = path.join(OUT_DIR, asset.file);
    const bytes = await download(img.resultUrls[0], dest);
    log(`  saved ${outputRelative}/${asset.file} (${(bytes / 1024).toFixed(0)} KB)`);
    return {
      ok: true,
      lines,
      dest,
      logEntry: {
        at: new Date().toISOString(),
        asset: asset.id,
        jobId: id,
        mode: refDataUrl ? 'image-to-image' : 'text-to-image',
        model: img.model ?? manifest.model,
        aspectRatio: asset.aspect_ratio,
        promptChars: (refDataUrl ? buildRefPrompt(asset) : buildPrompt(asset)).length,
        usedReference: !!refDataUrl,
        file: `${outputRelative}/${asset.file}`,
        bytes,
      },
    };
  } catch (error) {
    lines.push(`  FAILED ${asset.id}: ${String(error.message).slice(0, 300)}`);
    return { ok: false, lines, error };
  }
}

async function runPool(targets, concurrency) {
  const results = new Array(targets.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= targets.length) return;
      results[index] = await run(targets[index], undefined);
    }
  }

  const workerCount = Math.min(concurrency, targets.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

// ---------------------------------------------------------------- reftest

/// Answers one question before eleven credits are spent on it: does
/// image-to-image restage the scene, or does it clone the reference framing?
///
/// page-003 is the probe because it is the furthest possible departure from the
/// seed while still being a real page of this story — the seed is a close-up of a
/// nest with two birds in it, and page-003 is a bird in open flight with that nest
/// reduced to a small background element. If i2i can do that, it can do every
/// other page. If it returns another nest close-up, the whole reference-lock
/// approach has to change, and it is much cheaper to learn that now.
///
/// Both variants are generated from the same reference so the only difference is
/// the prompt: one with the explicit "change the scene and camera" instruction and
/// one without. That isolates whether the instruction is doing any work.
async function reftest() {
  const seed = manifest.assets.find((a) => a.id.endsWith(manifest.reference_seed));
  const seedPath = path.join(OUT_DIR, seed.file);
  if (!fs.existsSync(seedPath)) {
    throw new Error(`reference missing. Run:  node tools/playveo/generate.mjs --only ${manifest.reference_seed}`);
  }
  const ref = referenceDataUrl();
  const probe = manifest.assets.find((a) => a.id.endsWith('page-003'));

  const variants = [
    { label: 'with-instruction', prompt: buildRefPrompt(probe), file: '_reftest-with-instruction.jpg' },
    {
      label: 'scene-only',
      prompt: (probe.scene + ' ' + (probe.light ?? '') + manifest.style_tail).replace(/\s+/g, ' ').trim(),
      file: '_reftest-scene-only.jpg',
    },
  ];

  for (const v of variants) {
    console.log(`\nreftest: ${v.label}  (${v.prompt.length} chars)`);
    const res = await api('POST', '/v1/images/image-to-image', {
      prompt: v.prompt,
      aspect_ratio: probe.aspect_ratio,
      count: 1,
      image: ref,
    });
    console.log(`  job ${res.id} cost=${res.creditCost} strength=${res.strength}`);
    const img = await waitFor(res.id);
    const bytes = await download(img.resultUrls[0], path.join(OUT_DIR, v.file));
    console.log(`  saved ${outputRelative}/${v.file} (${(bytes / 1024).toFixed(0)} KB)`);
  }

  console.log('\nCompare the two against page-001. What matters:');
  console.log('  1. Is the bird the SAME character in both?  (identity preserved)');
  console.log('  2. Is the bird FLYING with the nest small in the background, or still a nest close-up?');
  console.log('     A nest close-up means i2i clones composition and cannot restage a panel.');
}

// ---------------------------------------------------------------- main

async function main() {
  if (OPT.validate) return validate();

  if (OPT.reftest) return reftest();

  const seed = manifest.reference_seed
    ? manifest.assets.find((a) => a.id.endsWith(manifest.reference_seed))
    : undefined;
  if (manifest.reference_seed && !seed) {
    throw new Error(`reference_seed ${manifest.reference_seed} does not match any manifest asset`);
  }

  let targets;
  if (OPT.onlyIds.length) {
    targets = manifest.assets.filter((asset) =>
      OPT.onlyIds.some((id) => asset.id === id || asset.id.endsWith(id))
    );
    const unmatched = OPT.onlyIds.filter((id) =>
      !manifest.assets.some((asset) => asset.id === id || asset.id.endsWith(id))
    );
    if (unmatched.length) throw new Error(`no asset matching --only ${unmatched.join(',')}`);
  } else if (OPT.missing) {
    targets = manifest.assets.filter((asset) => !fs.existsSync(path.join(OUT_DIR, asset.file)));
  } else if (OPT.rest) {
    // Manifests without a reference seed are pure text-to-image batches, so
    // "rest" means every asset. Seeded legacy manifests still exclude the seed.
    targets = seed ? manifest.assets.filter((a) => a.id !== seed.id) : [...manifest.assets];
  } else {
    console.log('Nothing to do. Pass --validate, --reftest, --only <id>, --missing or --rest.');
    return;
  }

  if (!targets.length) {
    console.log('No matching assets need generation.');
    return;
  }

  console.log(`${targets.length} job(s), concurrency=${Math.min(OPT.concurrency, targets.length)}, about ${(targets.length * 0.1).toFixed(2)} credits.`);

  // The bounded pool follows PlayVeo's documented parallel pattern: each prompt
  // is its own count:1 job. It never starts more than ten local job lifecycles,
  // and a failure in one slot does not cancel or retry any other paid POST.
  const results = await runPool(targets, OPT.concurrency);
  for (const result of results) console.log(result.lines.join('\n'));

  // Persist successful provenance once and in manifest order. Buffering avoids
  // concurrent read/modify/write races when jobs finish out of order.
  writeLogEntries(results.filter((result) => result.ok).map((result) => result.logEntry));

  const failed = results
    .map((result, index) => result.ok ? null : targets[index].id)
    .filter(Boolean);
  if (failed.length) {
    console.log(`\n${failed.length} failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${targets.length} asset(s) generated.`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
