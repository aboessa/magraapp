#!/usr/bin/env node
/**
 * generate-hero.mjs — توليد بنر "ارسم مثلي" (3 نسخ للاختيار) عبر PlayVeo
 * التصميم كامل داخل الصورة، بدون أي نص أو حروف.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Manifest is selectable so this script serves every hero banner rather than
// being copied per banner. Defaults to the draw-like-me manifest it was written
// for, so existing invocations keep working.
const manifestArgIdx = process.argv.indexOf('--manifest');
const MANIFEST_PATH = path.join(
  __dirname,
  manifestArgIdx > -1 && process.argv[manifestArgIdx + 1]
    ? process.argv[manifestArgIdx + 1]
    : 'draw-like-me-hero.manifest.json',
);
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`manifest not found: ${MANIFEST_PATH}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const API_KEY = process.env.PLAYVEO_API_KEY || 'pv_WTtKgrViXXsDo8JquF9XpKwUKfUfBumH';
const BASE = manifest.base_url;
const MASTER = manifest.master_style;
const NEG = manifest.negative_prompt;
const OUT_ROOT = path.resolve(__dirname, '..', '..', manifest.out_dir);

async function api(pathname, init) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${pathname} ${res.status} ${text.slice(0, 1200)}`);
  return json;
}

async function submit(prompt) {
  const body = {
    prompt,
    aspect_ratio: manifest.aspect_ratio,
    model: manifest.model,
    count: 1,
    negative_prompt: NEG,
  };
  const j = await api('/v1/images/text-to-image', { method: 'POST', body: JSON.stringify(body) });
  if (!j.id) throw new Error('no id ' + JSON.stringify(j));
  return j.id;
}

async function waitFor(id, timeoutMs = 8 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 7000));
    const j = await api(`/v1/images/${id}`, { method: 'GET' });
    const inner = j.image || j;
    const st = inner.status || j.status;
    if (st === 'completed' || st === 'ready' || st === 'succeeded') return inner;
    if (st === 'failed') throw new Error(`job ${id} failed ${JSON.stringify(j).slice(0, 800)}`);
    console.log(`   waiting ${id} ${st} ${Math.round((Date.now() - start) / 1000)}s`);
  }
  throw new Error(`timeout ${id}`);
}

async function download(url, dst) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, buf);
  return dst;
}

async function processOne(v) {
  const dst = path.join(OUT_ROOT, `${v.id}.png`);
  if (fs.existsSync(dst)) {
    console.log(`--- ${v.id} SKIP exists`);
    return { id: v.id, localPath: dst, skipped: true };
  }
  const prompt = `${v.prompt} ${MASTER}`.slice(0, 2800);
  console.log(`--- ${v.id} (${v.label})`);
  const jobId = await submit(prompt);
  const done = await waitFor(jobId);
  const urls = done.resultUrls || done.result_urls || done.urls || [];
  const first = urls[0] || done.url;
  if (!first) throw new Error('no result url ' + JSON.stringify(done).slice(0, 800));
  await download(first, dst);
  console.log(`   saved ${dst}`);
  return { id: v.id, label: v.label, url: first, localPath: dst };
}

async function main() {
  console.log(`hero generation: ${manifest.variants.length} variants, model=${manifest.model}, aspect=${manifest.aspect_ratio}`);
  const concurrency = manifest.concurrency ?? 3;
  let idx = 0, ok = 0, fail = 0;
  const results = [];
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= manifest.variants.length) break;
      const v = manifest.variants[i];
      try { results.push(await processOne(v)); ok++; }
      catch (e) { fail++; console.error(`FAILED ${v.id} ${e.message}`); }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`\nDone: ${ok} ok, ${fail} failed.`);
  fs.writeFileSync(path.join(__dirname, 'draw-like-me-hero.results.json'), JSON.stringify(results, null, 2));
  if (fail > 0) process.exit(2);
}
main().catch((e) => { console.error(e); process.exit(1); });
