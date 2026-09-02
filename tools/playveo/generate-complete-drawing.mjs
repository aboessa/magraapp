#!/usr/bin/env node
/**
 * generate-complete-drawing.mjs
 *
 * Builds the 50 "أكمل الرسمة" activities. Each activity is a PAIR that must show
 * the SAME artwork:
 *   reference_full.png = the finished answer key, fully colored
 *   challenge.png      = that same artwork with one side/part replaced by light
 *                        gray dashed guides for the child to complete
 *   thumbnail.jpg      = downscale of the reference
 *
 * ── Why it works this way ────────────────────────────────────────────────────
 *
 * 1. reference_full comes from text-to-image using the manifest's `prompt_full`.
 *    The previous version of this file derived the reference prompt by running
 *    two regexes over the challenge prompt (old lines 79-81) to strip the
 *    "dashed guides" clause. That was fragile: it built an unused `fullPrompt`,
 *    then a `refPrompt` whose `.replace(/light gray dashed[^.]*\.?/gi,'')` left
 *    mangled sentences like "The tail, second part of the body and remaining
 *    branch leaves are shown as ." — actively telling the model something was
 *    missing in the image that is supposed to be complete. Every asset now
 *    carries an explicit reviewed `prompt_full`, so no regex is involved.
 *
 * 2. challenge comes from image-to-image seeded with the reference. This is the
 *    only way the two files can depict the same drawing. Two independent T2I
 *    calls produce two different butterflies, so the child's answer key would
 *    not match the puzzle.
 *
 *    Note this contradicts the warning at generate.mjs:101 and the findings in
 *    probe-i2i.mjs, which concluded i2i "cannot be used as a character
 *    reference". That was measured on story panels, where the goal was to
 *    RESTAGE a scene and the endpoint's heavy bias toward the source image was
 *    the defect. Here the goal is the opposite — keep the image nearly
 *    identical, change one half — so that same bias is what we want.
 *    Re-verified live for this pack by probe-cd-i2i.mjs.
 *
 * 3. Provider output is JPEG, always (verified: content-type image/jpeg, magic
 *    ffd8ffe0). The old code did `fs.copyFileSync(refLocal, thumbLocal)` and
 *    wrote provider bytes straight to *.png, producing files whose extensions
 *    lie — a JPEG named .png and a PNG-sized copy named .jpg. Every download
 *    here is re-encoded by complete_drawing_images.py to match the extension it
 *    is saved under, and verified afterwards.
 *
 * 4. `strength: 0.35` was dropped from the i2i payload. Nothing in the verified
 *    API responses acknowledges that field, and the probe reached the desired
 *    result without it. Sending unsupported knobs invites silent behavior
 *    changes. The same applies to `seed`: the manifest asks for
 *    "same_seed_per_activity", but the probe showed the API neither echoes nor
 *    documents a seed. Pair consistency is achieved structurally, via i2i, not
 *    by hoping a seed is honored.
 *
 * Usage:
 *   node tools/playveo/generate-complete-drawing.mjs            # all pending
 *   node tools/playveo/generate-complete-drawing.mjs --only butterfly-01
 *   node tools/playveo/generate-complete-drawing.mjs --limit 3
 *   node tools/playveo/generate-complete-drawing.mjs --force    # redo existing
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(__dirname, 'complete-drawing.manifest.json');
const RESULTS_PATH = path.join(__dirname, 'complete-drawing.results.json');
const IMG_TOOL = path.join(__dirname, 'complete_drawing_images.py');
const PYTHON = process.env.PYTHON || 'python';

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const BASE = manifest.base_url;
const MODEL = manifest.model;
const ASPECT = manifest.aspect_ratio || '1:1';
const MASTER_STYLE = manifest.master_style;
const NEGATIVE = manifest.negative_prompt;
const PROMPT_CAP = 1800;

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ONLY = opt('--only');
const LIMIT = opt('--limit') ? Number(opt('--limit')) : undefined;
const FORCE = flag('--force');
const CONCURRENCY = Number(opt('--concurrency') ?? manifest.concurrency ?? 2);

// ── key ─────────────────────────────────────────────────────────────────────
function loadKey() {
  if (process.env.PLAYVEO_API_KEY) return process.env.PLAYVEO_API_KEY;
  const env = path.join(ROOT, '.env.local');
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, 'utf8').match(/^\s*PLAYVEO_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  // Deliberately no hardcoded fallback key, unlike the previous version which
  // embedded a live credential in source at line 19.
  throw new Error('PLAYVEO_API_KEY not set (env or .env.local)');
}
const KEY = loadKey();

// ── api ─────────────────────────────────────────────────────────────────────
async function api(method, route, body, tries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(`${BASE}${route}`, {
        method,
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      // 5xx and 429 are worth retrying; 4xx means the request itself is wrong.
      if (!res.ok) {
        const retryable = res.status >= 500 || res.status === 429;
        const err = new Error(`${route} ${res.status} ${text.slice(0, 300)}`);
        if (!retryable || attempt === tries) throw err;
        lastErr = err;
      } else {
        return json;
      }
    } catch (e) {
      lastErr = e;
      if (attempt === tries) throw e;
    }
    await sleep(3000 * attempt);
  }
  throw lastErr;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);

async function waitFor(id, label, timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(6000);
    const j = await api('GET', `/v1/images/${id}`);
    const img = j.image || j;
    const st = img.status || j.status;
    if (st === 'completed' || st === 'ready') return img;
    if (st === 'failed') {
      // Surface the provider's own error field. Previously this threw
      // JSON.stringify(j).slice(0, 400), but the response puts `error` after
      // `prompt`, and the prompt alone exceeds the 400-char cut — so the real
      // reason was always truncated away. That made every failure log an
      // unreadable prompt blob AND defeated the transient-retry check below,
      // which matches on the error text.
      const reason = img.error || img.error_message || img.failure_reason || JSON.stringify(j).slice(0, 400);
      throw new Error(`${label} job ${id} failed: ${reason}`);
    }
  }
  throw new Error(`${label} job ${id} timed out`);
}

function resultUrl(img) {
  const url = (img.resultUrls || img.result_urls || [img.url])[0] || img.url;
  if (!url) throw new Error('no result url in ' + JSON.stringify(img).slice(0, 300));
  return url;
}

async function downloadTmp(url, tmpPath) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
  fs.writeFileSync(tmpPath, buf);
  return buf;
}

// ── local encode ────────────────────────────────────────────────────────────
function py(...args) {
  return execFileSync(PYTHON, [IMG_TOOL, ...args], { encoding: 'utf8' }).trim();
}
/** Re-encode to whatever the destination extension promises. */
function encode(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  return py('png', src, dst);
}
function encodeThumb(src, dst, size = 512) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  return py('thumb', src, dst, String(size));
}
function verifyFiles(paths) {
  try {
    return { ok: true, report: py('verify', ...paths) };
  } catch (e) {
    return { ok: false, report: String(e.stdout || e.message) };
  }
}

/// Unique upload bytes, identical pixels. Appended after the JPEG EOI marker so
/// decoders ignore it. probe-cache.mjs found the provider replaying a cached
/// result for a repeated source image; this keeps each i2i submission distinct.
function bustedDataUrl(buf, tag) {
  const padded = Buffer.concat([buf, Buffer.from(`\n<!-- cd ${tag} ${Date.now()} -->`)]);
  return `data:image/jpeg;base64,${padded.toString('base64')}`;
}

// ── prompts ─────────────────────────────────────────────────────────────────
const refPrompt = (a) => `${a.prompt_full} ${MASTER_STYLE}`.slice(0, PROMPT_CAP);

/**
 * The challenge is an EDIT instruction, not a fresh description. It has to be
 * explicit that the finished parts stay untouched, otherwise the model redraws
 * the whole subject and the pair stops matching.
 */
const challengePrompt = (a) =>
  [
    'Edit this image to create a "complete the drawing" activity for a child.',
    'Keep every already-finished, colored part of the artwork EXACTLY as it is:',
    'same shapes, same colors, same outlines, same position, same size, unchanged.',
    `Target result: ${a.prompt}`,
    'The unfinished part must be erased of all color and replaced with only thin,',
    'very light gray dashed outline guides on the plain white background,',
    'so a child can trace and finish it. The dashed area must contain no color and no shading.',
    'Keep the background plain pure white and perfectly uniform across the whole square,',
    'with no visible seam, panel, edge or tone difference between the finished part and the dashed part.',
    MASTER_STYLE,
  ]
    .join(' ')
    .slice(0, PROMPT_CAP);

// ── per-activity pipeline ───────────────────────────────────────────────────
/**
 * Local output dir for one activity.
 *
 * NOT out_dir + r2_dir. `r2_dir` is the REMOTE key ("complete-drawing/<id>") and
 * `out_dir` already ends in "complete-drawing", so joining them produced
 * assets/complete-drawing/complete-drawing/<id> — a duplicated segment, caught
 * on the butterfly-01 smoke run. The activity folder is keyed by id locally; the
 * r2_dir is carried through to the results file for the upload step instead.
 */
function paths(a) {
  const dir = path.join(ROOT, manifest.out_dir, a.id);
  return {
    dir,
    ref: path.join(dir, a.files.reference_full),
    chal: path.join(dir, a.files.challenge),
    thumb: path.join(dir, a.files.thumbnail),
    tmpRef: path.join(ROOT, 'tools/playveo/output/.tmp', `${a.id}-ref.jpg`),
    tmpChal: path.join(ROOT, 'tools/playveo/output/.tmp', `${a.id}-chal.jpg`),
  };
}

function isDone(p) {
  return [p.ref, p.chal, p.thumb].every((f) => fs.existsSync(f) && fs.statSync(f).size > 10_000);
}

async function processOne(a) {
  const p = paths(a);
  const log = (m) => console.log(`  [${a.id}] ${m}`);

  // 1) reference_full — text-to-image from the explicit prompt_full
  log('T2I reference_full');
  const refJob = await api('POST', '/v1/images/text-to-image', {
    prompt: refPrompt(a),
    aspect_ratio: ASPECT,
    model: MODEL,
    count: 1,
    negative_prompt: NEGATIVE,
  });
  if (!refJob.id) throw new Error('no job id: ' + JSON.stringify(refJob).slice(0, 200));
  const refImg = await waitFor(refJob.id, 'reference');
  const refBytes = await downloadTmp(resultUrl(refImg), p.tmpRef);
  log(`ref bytes ${refBytes.length} sha=${sha(refBytes)}`);

  encode(p.tmpRef, p.ref);
  encodeThumb(p.tmpRef, p.thumb, 512);
  log(`encoded ${path.basename(p.ref)} + ${path.basename(p.thumb)}`);

  // 2) challenge — image-to-image seeded with the reference we just made,
  //    so both files depict the same drawing.
  //
  // The i2i job can come back status=failed with
  //   CURRENT_FLOW_UPLOAD_NOT_READY:reference (upload did not finish/appear)
  // meaning the provider never finished attaching our uploaded reference. That
  // is transient and unrelated to the prompt: measured 5 failures in 12 activities
  // at concurrency 3. It has to be retried HERE rather than by re-running the
  // script, because the reference already exists on disk at this point and a
  // fresh run would spend another T2I call to rebuild it (and get a different
  // drawing). Each attempt re-uploads with a new cache-buster tag so the
  // provider treats it as a distinct submission.
  let chalJob;
  let chalImg;
  const I2I_TRIES = 4;
  for (let attempt = 1; attempt <= I2I_TRIES; attempt++) {
    log(`I2I challenge from reference (attempt ${attempt}/${I2I_TRIES})`);
    chalJob = await api('POST', '/v1/images/image-to-image', {
      prompt: challengePrompt(a),
      aspect_ratio: ASPECT,
      model: MODEL,
      count: 1,
      image: bustedDataUrl(refBytes, `${a.id}-${attempt}`),
      negative_prompt: NEGATIVE,
    });
    if (!chalJob.id) throw new Error('no i2i job id: ' + JSON.stringify(chalJob).slice(0, 200));
    try {
      chalImg = await waitFor(chalJob.id, 'challenge');
      break;
    } catch (e) {
      const transient = /UPLOAD_NOT_READY|upload did not finish/i.test(String(e.message || e));
      if (!transient || attempt === I2I_TRIES) throw e;
      log(`reference upload not ready, resubmitting in ${8 * attempt}s`);
      await sleep(8000 * attempt);
    }
  }
  const chalBytes = await downloadTmp(resultUrl(chalImg), p.tmpChal);
  log(`chal bytes ${chalBytes.length} sha=${sha(chalBytes)}`);

  // A challenge identical to the reference means the edit silently did nothing,
  // which would ship a puzzle that is already solved.
  if (sha(chalBytes) === sha(refBytes)) {
    throw new Error('challenge is byte-identical to reference (edit had no effect)');
  }

  encode(p.tmpChal, p.chal);
  log(`encoded ${path.basename(p.chal)}`);

  const v = verifyFiles([p.ref, p.chal, p.thumb]);
  if (!v.ok || /BAD/.test(v.report)) throw new Error('format verify failed:\n' + v.report);

  for (const t of [p.tmpRef, p.tmpChal]) { try { fs.unlinkSync(t); } catch {} }

  return {
    id: a.id,
    group: a.group,
    titleAr: a.titleAr,
    r2_dir: a.r2_dir,
    refJobId: refJob.id,
    chalJobId: chalJob.id,
    files: {
      reference_full: path.relative(ROOT, p.ref).replace(/\\/g, '/'),
      challenge: path.relative(ROOT, p.chal).replace(/\\/g, '/'),
      thumbnail: path.relative(ROOT, p.thumb).replace(/\\/g, '/'),
    },
    verify: v.report,
  };
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  let assets = manifest.assets;
  if (ONLY) assets = assets.filter((a) => ONLY.split(',').includes(a.id));
  if (!FORCE) {
    const before = assets.length;
    assets = assets.filter((a) => !isDone(paths(a)));
    const skipped = before - assets.length;
    if (skipped) console.log(`skipping ${skipped} already-complete activities (--force to redo)`);
  }
  if (LIMIT) assets = assets.slice(0, LIMIT);

  if (!assets.length) { console.log('nothing to do'); return; }

  console.log(`complete-drawing: ${assets.length} activities x2 images, model=${MODEL}, concurrency=${CONCURRENCY}`);

  const prior = fs.existsSync(RESULTS_PATH)
    ? JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'))
    : { results: [], failures: [] };
  const results = (prior.results || []).filter((r) => !assets.some((a) => a.id === r.id));
  const failures = [];

  let idx = 0;
  async function worker(n) {
    while (true) {
      const i = idx++;
      if (i >= assets.length) return;
      const a = assets[i];
      console.log(`\n=== [${i + 1}/${assets.length}] ${a.id} — ${a.titleAr} (w${n}) ===`);
      try {
        results.push(await processOne(a));
        console.log(`  [${a.id}] OK`);
      } catch (e) {
        const msg = String(e.message || e);
        failures.push({ id: a.id, error: msg });
        console.error(`  [${a.id}] FAILED ${msg}`);
      }
      // Persist after each activity so a crash or Ctrl+C never loses progress.
      fs.writeFileSync(
        RESULTS_PATH,
        JSON.stringify({ generated_at: new Date().toISOString(), model: MODEL, results, failures }, null, 2)
      );
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, n) => worker(n + 1)));

  console.log(`\ndone: ${results.length} total ok, ${failures.length} failed this run`);
  if (failures.length) {
    for (const f of failures) console.log(`  FAILED ${f.id}: ${f.error}`);
    process.exitCode = 2;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
