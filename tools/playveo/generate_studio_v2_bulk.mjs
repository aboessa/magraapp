#!/usr/bin/env node
/**
 * generate_studio_v2_bulk.mjs — bounded bulk generation via /v1/images/bulk/text-to-image
 * - Implements docs.json guidance: caller_correlation_id, de-duplicate prompts, persist ids before polling,
 *   inner=j.image||j, resultUrls expire 10 days → copy to R2 later.
 * - Uses nano_banana_2 for all (required by user).
 * - For coloring_line kind: POST /v1/images/remove-background {url} sync → transparent PNG
 * - Concurrency: bulk batches of up to five prompts per POST, poll all ids independently every 5s.
 * Manifest: studio-v2-full.manifest.json with 30 entries.
 * Usage: PLAYVEO_API_KEY=... node tools/playveo/generate_studio_v2_bulk.mjs
 *        node tools/playveo/generate_studio_v2_bulk.mjs --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const MANIFEST_PATH = path.join(__dirname, 'studio-v2-full.manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const DRY_RUN = process.argv.includes('--dry-run');
const API_KEY = process.env.PLAYVEO_API_KEY?.trim();
const BASE = manifest.base_url || 'https://playveo-api.aboessa101.workers.dev';
const BULK_LIMIT = manifest.bulk_limit || 10;
const MODEL = manifest.model || 'nano_banana_2';

function requireApiKey() {
  if (!API_KEY) {
    throw new Error('PLAYVEO_API_KEY is required. Set it in the environment; do not store it in this manifest.');
  }
  return API_KEY;
}

function workspaceOutputDir(dir) {
  if (typeof dir !== 'string' || !dir.trim()) throw new Error('Output directory is missing.');
  if (path.isAbsolute(dir)) throw new Error(`Output directory must be workspace-relative: ${dir}`);
  const absolute = path.resolve(root, dir);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Output directory escapes workspace root: ${dir}`);
  }
  return { absolute, relative };
}

function appAssetsMirrorDir(relativeOutputDir) {
  const absolute = path.resolve(root, 'app_main', relativeOutputDir);
  const appMainRoot = path.resolve(root, 'app_main');
  const relative = path.relative(appMainRoot, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Mirror directory escapes app_main: ${relativeOutputDir}`);
  }
  return absolute;
}

function tailFor(entry) {
  const t = entry.tail;
  if (t === 'hero') return manifest.style_tail_hero;
  if (t === 'line') return manifest.style_tail_line;
  if (t === 'icon') return manifest.style_tail_icon;
  if (t === 'prompt') return manifest.style_tail_prompt;
  if (t === 'board_bg') return manifest.style_tail_board_bg;
  if (t === 'success') return manifest.style_tail_success;
  return manifest.style_tail_icon || '';
}

async function api(pathname, init) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${requireApiKey()}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    // Preserve body for retry decision - don't auto-retry, per critical_rules
    throw new Error(`${pathname} ${res.status} ${text.slice(0, 1200)}`);
  }
  return json;
}

function normalizePrompt(p) {
  return p.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildPrompt(entry) {
  const tail = tailFor(entry);
  const full = `${entry.prompt}${tail}`.slice(0, 1800);
  return full;
}

function outPathFor(entry) {
  const kind = entry.category || entry.kind;
  // hero → flat v2, others → organized by category
  let dir;
  if (entry.kind === 'hero' && kind === 'coloring') dir = manifest.coloring_out_dir || 'assets/images/coloring/v2';
  else if (kind === 'tracing' || entry.id.startsWith('trace-')) dir = manifest.tracing_out_dir || 'assets/images/tracing/v2';
  else if (kind === 'boards' || entry.kind === 'board_bg') dir = manifest.boards_out_dir || 'assets/images/boards/v2';
  else if (entry.kind === 'coloring_line' && (kind === 'copy_pattern' || kind === 'complete')) dir = manifest.out_dir.replace('coloring', kind === 'copy_pattern' ? 'copy_pattern' : 'complete') || manifest.out_dir;
  else dir = manifest.out_dir;
  // we will also write to app_main/assets mirror if exists
  return { dir, filename: entry.filename || `${entry.id}.png`, entry };
}

async function download(url, dstAbs) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url.slice(0, 120)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  // magic check
  const isJpg = buf[0] === 0xFF && buf[1] === 0xD8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  if (!isJpg && !isPng) console.warn(`   ⚠️ not jpg/png at ${dstAbs} magic=${buf.slice(0, 4).toString('hex')}`);
  fs.mkdirSync(path.dirname(dstAbs), { recursive: true });
  fs.writeFileSync(dstAbs, buf);
  return { buf, isJpg, isPng };
}

async function removeBackground({ url }) {
  const j = await api('/v1/images/remove-background', { method: 'POST', body: JSON.stringify({ url }) });
  if (j.status !== 'completed' || !j.url) throw new Error('remove-bg failed ' + JSON.stringify(j).slice(0, 600));
  return j.url; // transparent PNG
}

async function submitBulk(prompts, aspect_ratio) {
  // validate preflight per docs
  if (!prompts || prompts.length === 0) throw new Error('empty bulk');
  if (prompts.length > BULK_LIMIT) throw new Error(`Bulk over limit ${prompts.length} > ${BULK_LIMIT}`);
  for (const p of prompts) if (!p || !p.trim()) throw new Error('empty prompt in bulk');
  const normalized = prompts.map(normalizePrompt);
  const seen = new Set();
  for (const n of normalized) {
    if (seen.has(n)) throw new Error(`Duplicate normalized prompt rejected client-side per docs preflight: ${n.slice(0, 80)}`);
    seen.add(n);
  }
  const body = { prompts, aspect_ratio: aspect_ratio || manifest.aspect_ratio_default || '1:1', model: MODEL };
  console.log(`\n📦 BULK POST ${prompts.length} prompts aspect=${body.aspect_ratio} model=${MODEL}`);
  const j = await api('/v1/images/bulk/text-to-image', { method: 'POST', body: JSON.stringify(body) });
  // Expected { jobs: [{id,creditCost}], totalCost }
  // Some versions return flat { ids } — handle both
  const jobs = j.jobs || j.ids || [];
  if (!jobs.length) throw new Error('bulk no jobs returned ' + JSON.stringify(j).slice(0, 800));
  // Normalize jobs to [{id,creditCost,caller_correlation_id=promptIndex}]
  const normalizedJobs = jobs.map((jb, idx) => {
    const id = typeof jb === 'string' ? jb : jb.id || jb.job_id;
    const cost = typeof jb === 'object' ? (jb.creditCost ?? jb.credit_cost) : undefined;
    return { id, creditCost: cost, caller_correlation_id: `batch-${Date.now()}-${idx}`, promptIndex: idx, prompt: prompts[idx] };
  }).filter(x => x.id);
  console.log(`   ✅ bulk accepted ${normalizedJobs.length} jobs totalCost=${j.totalCost ?? '?'}`);
  // persist immediately before polling — per critical_rules
  const persistPath = path.join(root, 'tools', 'playveo', '.bulk-last-jobs.json');
  fs.mkdirSync(path.dirname(persistPath), { recursive: true });
  fs.writeFileSync(persistPath, JSON.stringify({ at: new Date().toISOString(), prompts, jobs: normalizedJobs, totalCost: j.totalCost }, null, 2));
  return normalizedJobs;
}

async function waitForImage(id, timeoutMs = 8 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 5000));
    const j = await api(`/v1/images/${id}`, { method: 'GET' });
    const inner = j.image || j;
    const st = inner.status || j.status;
    if (st === 'completed' || st === 'ready') return inner;
    if (st === 'failed') throw new Error(`job ${id} failed ${JSON.stringify(inner).slice(0, 800)}`);
    console.log(`   ⏳ ${id} status=${st} elapsed=${Math.round((Date.now() - start) / 1000)}s`);
  }
  throw new Error(`timeout ${id}`);
}

async function processEntry(entry, resultUrl) {
  const out = outPathFor(entry);
  const { absolute: safeDirAbs, relative: relDir } = workspaceOutputDir(out.dir);
  const fileNameRaw = out.filename || `${entry.id}.png`;
  // ensure filename only (no dir)
  const fileBase = path.basename(fileNameRaw);
  const safeFileAbsJpg = path.join(safeDirAbs, fileBase);

  const tmpDir = path.join(safeDirAbs, '_tmp');
  fs.mkdirSync(safeDirAbs, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpJpg = path.join(tmpDir, `${entry.id}.jpg`);

  let finalAbs = safeFileAbsJpg;

  if (entry.transparent) {
    console.log(`   🧹 remove-bg for ${entry.id}`);
    await download(resultUrl, tmpJpg);
    const transUrl = await removeBackground({ url: resultUrl });
    const pngName = fileBase.replace(/\.(jpg|jpeg|webp)$/i, '.png');
    // force .png
    const pngFileName = pngName.toLowerCase().endsWith('.png') ? pngName : `${path.basename(fileBase, path.extname(fileBase))}.png`;
    finalAbs = path.join(safeDirAbs, pngFileName);
    await download(transUrl, finalAbs);
    const b = fs.readFileSync(finalAbs);
    if (!(b[0] === 0x89 && b[1] === 0x50)) console.warn(`   ⚠️ NOT PNG magic for transparent ${entry.id} ${b.slice(0, 4).toString('hex')}`);
    else console.log(`   💾 transparent PNG ${finalAbs} ${b.length}B magic=89504E47 ✅`);
  } else {
    await download(resultUrl, finalAbs);
    const b = fs.readFileSync(finalAbs);
    console.log(`   💾 saved ${entry.id} → ${finalAbs} ${b.length}B magic=${b.slice(0, 4).toString('hex')}`);
  }

  // Mirror to app_main/<relDir>/ after resolving each root exactly once.
  try {
    const appMainDir = appAssetsMirrorDir(relDir);
    fs.mkdirSync(appMainDir, { recursive: true });
    const appMainAbs = path.join(appMainDir, path.basename(finalAbs));
    fs.copyFileSync(finalAbs, appMainAbs);
    console.log(`   🪞 mirrored → ${appMainAbs}`);
  } catch (e) {
    console.warn(`   ⚠️ mirror failed for ${entry.id}: ${e.message}`);
  }

  return finalAbs;
}

function validateOutputPaths(entries) {
  let invalid = 0;
  for (const entry of entries) {
    try {
      const out = outPathFor(entry);
      const { absolute, relative } = workspaceOutputDir(out.dir);
      const mirror = appAssetsMirrorDir(relative);
      const filename = path.basename(out.filename || `${entry.id}.png`);
      if (!filename || filename === '.') throw new Error('Asset filename is missing.');
      console.log(`✓ ${entry.id}\n  write:  ${path.join(absolute, filename)}\n  mirror: ${path.join(mirror, filename)}`);
    } catch (error) {
      invalid++;
      console.error(`✗ ${entry.id}: ${error.message}`);
    }
  }
  if (invalid > 0) throw new Error(`Dry-run found ${invalid} invalid output path(s).`);
}

async function main() {
  const allEntries = manifest.assets || [];
  if (DRY_RUN) {
    console.log(`🔎 Studio V2 path dry-run: ${allEntries.length} entries`);
    validateOutputPaths(allEntries);
    console.log('🏁 Dry-run passed. No API request was made.');
    return;
  }
  requireApiKey();
  console.log(`🚀 Studio V2 Bulk manifest: ${allEntries.length} entries, model=${MODEL}, bulkLimit=${BULK_LIMIT}`);

  // Group by aspect_ratio to reduce waste (bulk groups share one aspect)
  const byAspect = {};
  for (const e of allEntries) {
    const asp = e.aspect || manifest.aspect_ratio_default || '1:1';
    if (!byAspect[asp]) byAspect[asp] = [];
    byAspect[asp].push(e);
  }

  let totalOk = 0, totalFail = 0;

  for (const [aspect, entries] of Object.entries(byAspect)) {
    console.log(`\n━━━━━━ Aspect ${aspect}: ${entries.length} entries`);

    // The current plan accepts no more than five prompts per bulk request.
    const effectiveBulkLimit = Math.min(BULK_LIMIT, 5);
    // Chunk entries into bulk batches, de-duplicating prompts per batch.
    for (let chunkStart = 0; chunkStart < entries.length; chunkStart += effectiveBulkLimit) {
      const chunk = entries.slice(chunkStart, chunkStart + effectiveBulkLimit);
      const prompts = chunk.map(e => buildPrompt(e));

      // Preflight: dedup within chunk client-side (critical_rules)
      const seenNorm = new Map();
      const uniqueChunk = [];
      const uniquePrompts = [];
      for (let i = 0; i < chunk.length; i++) {
        const norm = normalizePrompt(prompts[i]);
        if (!seenNorm.has(norm)) {
          seenNorm.set(norm, true);
          uniqueChunk.push(chunk[i]);
          uniquePrompts.push(prompts[i]);
        } else {
          console.warn(`   ⚠️ skipping duplicate prompt in chunk: ${chunk[i].id} duplicate of earlier in same bulk`);
        }
      }

      if (uniquePrompts.length === 0) continue;

      // Submit bulk
      let jobs;
      try {
        jobs = await submitBulk(uniquePrompts, aspect);
      } catch (e) {
        console.error(`❌ bulk submit failed aspect=${aspect} chunk=${chunkStart}: ${e.message}`);
        totalFail += uniqueChunk.length;
        continue;
      }

      // Poll each job independently (parallel_images pattern)
      const pollResults = await Promise.all(uniqueChunk.map(async (entry, idx) => {
        const jobMeta = jobs[idx] || jobs.find(j => j.promptIndex === idx);
        if (!jobMeta) { console.error(`no job meta for ${entry.id}`); return { entry, error: 'no job meta' }; }
        try {
          const done = await waitForImage(jobMeta.id);
          const urls = done.resultUrls || done.result_urls || done.urls || [];
          const url = urls[0] || done.url;
          if (!url) throw new Error('no resultUrl');
          console.log(`   ✅ ${entry.id} completed → ${url.slice(0, 90)}...`);
          const finalPath = await processEntry(entry, url);
          return { entry, finalPath, ok: true };
        } catch (err) {
          console.error(`   ❌ ${entry.id} polling/processing failed: ${err.message}`);
          return { entry, error: err.message, ok: false };
        }
      }));

      for (const r of pollResults) { if (r.ok) totalOk++; else totalFail++; }
    }
  }

  console.log(`\n🏁 DONE bulk: ok=${totalOk} fail=${totalFail}`);
  if (totalFail > 0) process.exit(2);
}

main().catch(e => { console.error(e); process.exit(1); });
