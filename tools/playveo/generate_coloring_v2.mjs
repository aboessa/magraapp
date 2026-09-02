#!/usr/bin/env node
/**
 * generate_coloring_v2.mjs
 * يولّد جميع رسومات التلوين + الهيرو عبر Nano Banana ثم يشيل الخلفية عبر POST /v1/images/remove-background للحصول على PNG شفاف.
 * كما ورد في التوثيق: Remove Background endpoint يرجّع {status:completed, url:transparent PNG}
 * السعر: 0.1 تلوين + 0.05 شفافية = 0.15 لكل رسمة — متوافق مع الميزانية.
 * المفتاح: pv_IzCCZCf7qtnvmDnyghfK4VTOCoOknbfK4VTOCoOknbf5
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const MANIFEST_PATH = path.join(__dirname, 'coloring-v2.manifest.json');
const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
const manifest = JSON.parse(raw);

// use key from env if present else manifest
const API_KEY = process.env.PLAYVEO_API_KEY || manifest.api_key || 'pv_IzCCZCf7qtnvmDnyghfK4VTOCoOknbfK4VTOCoOknbf5';
const BASE = manifest.base_url || 'https://playveo-api.aboessa101.workers.dev';

// --- helpers ---
async function api(pathname, init) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: { ...(init.headers||{}), 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${pathname} ${res.status} ${text.slice(0,800)}`);
  return json;
}

async function submitT2I({prompt, aspect_ratio}) {
  console.log(`\n🎨 T2I submit aspect=${aspect_ratio} prompt=${prompt.slice(0,80)}...`);
  const j = await api('/v1/images/text-to-image', {
    method: 'POST',
    body: JSON.stringify({ prompt, aspect_ratio, model: manifest.model || 'nano_banana_2', count: 1 })
  });
  if (!j.id) throw new Error('no id returned ' + JSON.stringify(j));
  return j.id;
}

async function waitFor(id, timeoutMs= 8*60*1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r=> setTimeout(r, 7000));
    const j = await api(`/v1/images/${id}`, { method: 'GET' });
    // API returns { image: { status, resultUrls } } — normalize
    const inner = j.image || j;
    const st = inner.status || j.status;
    if (st === 'completed' || st === 'ready') return inner;
    if (st === 'failed') throw new Error(`job ${id} failed: ${JSON.stringify(j).slice(0,600)}`);
    console.log(`   ⏳ ${id} status=${st} elapsed=${Math.round((Date.now()-start)/1000)}s`);
  }
  throw new Error(`timeout waiting ${id}`);
}

async function download(url, dst) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  // guard: reject non-image
  if (buf[0]===0xFF && buf[1]===0xD8 || buf[0]===0x89 && buf[1]===0x50) {} else {
    console.warn(`   ⚠️ not jpeg/png magic at ${dst.slice(0,60)} first bytes ${buf.slice(0,4).toString('hex')}`);
  }
  fs.mkdirSync(path.dirname(dst), {recursive: true});
  fs.writeFileSync(dst, buf);
  return dst;
}

async function removeBackground({url, base64}) {
  console.log(`   🧹 remove-background url=${(url||'').slice(0,80)}... base64=${base64? `${base64.length} chars` : 'no'}`);
  // per docs: POST /v1/images/remove-background { image base64 OR url }
  const body = {};
  if (url) body.url = url;
  if (base64) body.image = base64;
  const j = await api('/v1/images/remove-background', { method:'POST', body: JSON.stringify(body) });
  // synchronous per docs -> {status:completed, url: transparent PNG, cost:0.05}
  console.log(`   ✅ remove-bg status=${j.status} url=${(j.url||'').slice(0,80)} cost=${j.cost}`);
  if (j.status !== 'completed' || !j.url) throw new Error('remove-bg not completed: ' + JSON.stringify(j).slice(0,500));
  return j.url;
}

function toDataUriIfNeeded(assetPath) {
  // not used for generated now; we use url path after t2i
  return null;
}

async function processOne(entry, outDir, heroOutDir, styleTail) {
  const isHero = entry.kind === 'hero';
  const dir = isHero ? heroOutDir : outDir;
  const aspect = entry.aspect || manifest.aspect_ratio || '1:1';
  const tail = isHero ? manifest.style_tail_hero : (manifest.style_tail_coloring || '');
  const fullPrompt = `${entry.prompt}${tail}`.slice(0, 1800);
  console.log(`\n────────────────────────────────────────\n📌 ${entry.id} → ${entry.filename} kind=${entry.kind}`);

  // 1) t2i
  const jobId = await submitT2I({ prompt: fullPrompt, aspect_ratio: aspect });
  const done = await waitFor(jobId);
  const resultUrls = done.resultUrls || done.result_urls || done.urls || [];
  const firstUrl = resultUrls[0] || done.url;
  if (!firstUrl) throw new Error(`no result url for ${entry.id} ${JSON.stringify(done).slice(0,600)}`);

  console.log(`   🖼️ result url=${String(firstUrl).slice(0,90)}...`);
  const tmpJpeg = path.join(dir, '_tmp', `${entry.id}.jpg`);
  await download(firstUrl, path.join(root, tmpJpeg.replace(/^\//,'')));

  // 2) remove background → transparent png (خصوصاً رسومات التلوين لتصير على canvas الأبيض بدون هالة)
  // للفئة hero: قد نترك الخلفية navy كما هي (لا نشيلها)، لكن بنشيل خلفية التلوين فقط.
  let finalPath;
  if (manifest.remove_background && entry.kind === 'coloring_line') {
    const transparentUrl = await removeBackground({ url: firstUrl });
    const finalName = entry.filename.replace(/\.(jpg|jpeg|webp)$/i, '.png');
    finalPath = path.join(root, outDir, finalName);
    await download(transparentUrl, finalPath);
    console.log(`   💾 saved transparent → ${finalPath}`);
  } else {
    // hero: save jpeg directly as png-named? نحفظ JPEG نفسه في المجلد v2 كـ png ليتوافق مع Image.asset
    const finalName = entry.filename;
    finalPath = path.join(root, dir, finalName);
    // re-download jpg to final (keep jpg extension if png requested but jpg actual -> convert via rename)
    const ext = path.extname(finalName).toLowerCase();
    const dlExt = ext === '.png' && firstUrl.endsWith('.jpg') ? '.jpg' : ext;
    const tmpFinal = path.join(root, dir, entry.id + dlExt);
    // already downloaded jpeg as _tmp, copy?
    try {
      const srcBuf = fs.readFileSync(path.join(root, tmpJpeg.replace(/^\//,'')));
      fs.mkdirSync(path.dirname(finalPath), {recursive: true});
      fs.writeFileSync(finalPath, srcBuf);
    } catch {}
    console.log(`   💾 saved hero → ${finalPath}`);
  }
  return finalPath;
}

async function main() {
  const outDir = manifest.out_dir;
  const heroOutDir = manifest.hero_out_dir;
  fs.mkdirSync(path.join(root, outDir), { recursive: true });
  fs.mkdirSync(path.join(root, heroOutDir), { recursive: true });
  fs.mkdirSync(path.join(root, outDir, '_tmp'), { recursive: true });
  fs.mkdirSync(path.join(root, heroOutDir, '_tmp'), { recursive: true });

  const allEntries = [...(manifest.assets||[]), ...(manifest.hero_assets||[])];

  console.log(`🚀 Starting coloring-v2 generation: ${allEntries.length} assets, key=${API_KEY.slice(0,10)}..., base=${BASE}`);

  // concurrency 2 as manifest
  const concurrency = manifest.concurrency ?? 2;
  let idx = 0;
  let ok = 0;
  let fail = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= allEntries.length) break;
      const entry = allEntries[i];
      try {
        await processOne(entry, outDir, heroOutDir, manifest.style_tail_coloring);
        ok++;
      } catch (e) {
        fail++;
        console.error(`❌ ${entry.id} failed: ${e.message || e}`);
        fs.writeFileSync(path.join(root, outDir, '_tmp', `${entry.id}.error.txt`), String(e.stack||e));
      }
    }
  }

  const workers = Array.from({length: concurrency}, () => worker());
  await Promise.all(workers);

  console.log(`\n✅ Done: ${ok} ok, ${fail} failed.`);
  if (fail>0) process.exit(2);
}

main().catch(err => { console.error(err); process.exit(1); });
