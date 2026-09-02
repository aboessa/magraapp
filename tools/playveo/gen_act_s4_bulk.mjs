#!/usr/bin/env node
// Produces act-s4 via bulk then polls independently per docs.json critical_rules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const MODEL = 'nano_banana_2';
const BULK_LIMIT = 5;

function parseEnv(filePath, name) {
  if (!fs.existsSync(filePath)) return undefined;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1] !== name) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
    return v.trim();
  }
}
const KEY = process.env.PLAYVEO_API_KEY?.trim() || parseEnv(path.join(ROOT,'.env.local'),'PLAYVEO_API_KEY') || parseEnv(path.join(ROOT,'dashboard/api/.dev.vars'),'PLAYVEO_API_KEY');
if (!KEY) throw new Error('no PLAYVEO_API_KEY');
console.log('key', KEY.slice(0,10)+'***');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,'act-s4.manifest.json'),'utf8'));

function buildPrompt(asset) {
  const lock = manifest.character_lock ? manifest.character_lock + ' ' : '';
  const scene = asset.scene + ' ';
  const light = asset.light ? asset.light + ' ' : '';
  const tail = manifest.style_tail || '';
  return (lock + scene + light + tail).replace(/\s+/g,' ').trim();
}
function normalizePrompt(p){ return p.trim().toLowerCase().replace(/\s+/g,' '); }

async function bulkPost(prompts, aspect) {
  const norm = prompts.map(normalizePrompt);
  const seen = new Set();
  for (const n of norm) { if (seen.has(n)) throw new Error('duplicate prompt blocked before billing: '+n.slice(0,80)); seen.add(n); }
  console.log(`\n📦 BULK POST ${prompts.length}x aspect=${aspect} model=${MODEL}`);
  const res = await fetch(`${BASE}/v1/images/bulk/text-to-image`, {
    method:'POST',
    headers:{ Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ prompts, aspect_ratio: aspect, model: MODEL }),
    signal: AbortSignal.timeout(120_000)
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`bulk ${res.status} ${txt.slice(0,800)}`);
  const j = JSON.parse(txt);
  const jobs = j.jobs || [];
  console.log(`✅ accepted ${jobs.length} jobs totalCost=${j.totalCost} remainingCredits=${j.remainingCredits ?? '?'}`);
  if (!jobs.length) throw new Error('no jobs '+txt.slice(0,400));
  // persist immediately per docs.json critical_rules
  const statePath = path.join(__dirname, '.act-s4-bulk.json');
  fs.writeFileSync(statePath, JSON.stringify({ at:new Date().toISOString(), prompts, aspect, jobs, totalCost:j.totalCost }, null, 2));
  console.log(`💾 persisted ${statePath}`);
  return jobs;
}

async function waitFor(id) {
  const start = Date.now();
  while (Date.now()-start < 10*60*1000) {
    await new Promise(r=>setTimeout(r, 5000));
    const r = await fetch(`${BASE}/v1/images/${id}`, { headers:{Authorization:`Bearer ${KEY}`}, signal:AbortSignal.timeout(30_000) });
    const txt = await r.text();
    if (!r.ok) { console.log(` ⏳ ${id.slice(0,8)} GET ${r.status}`); continue; }
    const j = JSON.parse(txt);
    const inner = j.image || j;
    const st = inner.status;
    if (st==='completed' || st==='ready') return inner;
    if (st==='failed') throw new Error(`failed ${id} ${inner.error} ${txt.slice(0,400)}`);
    console.log(` ⏳ ${id.slice(0,8)} ${st} ${Math.round((Date.now()-start)/1000)}s`);
  }
  throw new Error(`timeout ${id}`);
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), {recursive:true});
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  const assets = manifest.assets;
  // group by aspect
  const byAspect = {};
  for (const a of assets) {
    const asp = a.aspect_ratio;
    if (!byAspect[asp]) byAspect[asp]=[];
    byAspect[asp].push(a);
  }
  const outDir = path.join(ROOT,'tools/playveo/output/act-s4');
  const appDir = path.join(ROOT,'app_main/assets/images/stories/act-s4-playveo');
  fs.mkdirSync(outDir,{recursive:true});
  fs.mkdirSync(appDir,{recursive:true});

  let ok=0,fail=0;
  const log=[];
  for (const [aspect, list] of Object.entries(byAspect)) {
    console.log(`\n━━━ Aspect ${aspect} ${list.length} assets`);
    // de-dup normalized client-side
    const seen=new Set();
    const uniq=[];
    const uniqPrompts=[];
    for (const a of list) {
      const p=buildPrompt(a);
      const n=normalizePrompt(p);
      if (seen.has(n)) { console.warn(` ⚠️ skip dup ${a.file}`); continue; }
      seen.add(n);
      uniq.push(a);
      uniqPrompts.push(p);
    }
    for (let i=0;i<uniq.length;i+=BULK_LIMIT) {
      const chunkAssets=uniq.slice(i,i+BULK_LIMIT);
      const chunkPrompts=uniqPrompts.slice(i,i+BULK_LIMIT);
      console.log(`\n 📦 Chunk ${Math.floor(i/BULK_LIMIT)+1} ${chunkAssets.length} prompts`);
      let jobs;
      try { jobs = await bulkPost(chunkPrompts, aspect); } catch(e){ console.error('bulk submit fail', e.message); fail+=chunkAssets.length; continue; }
      const results = await Promise.all(chunkAssets.map(async (asset, idx)=>{
        const job=jobs[idx];
        if (!job) return {asset, error:'no job'};
        try {
          const done=await waitFor(job.id);
          const url=done.resultUrls?.[0] || done.result_urls?.[0] || done.url;
          if (!url) throw new Error('no result url');
          const dst=path.join(outDir, asset.file);
          const len=await download(url, dst);
          console.log(`  💾 ${asset.file} ${len}B job=${job.id.slice(0,8)}`);
          const mirror=path.join(appDir, asset.file);
          fs.copyFileSync(dst, mirror);
          log.push({at:new Date().toISOString(), story:'act-s4', id:asset.id, file:asset.file, jobId:job.id, bytes:len, aspect});
          return {ok:true};
        } catch(e){ console.error(`  ❌ ${asset.file} ${e.message}`); return {error:e.message}; }
      }));
      for (const r of results) if (r.ok) ok++; else fail++;
      fs.writeFileSync(path.join(outDir,'_bulk-run-log.json'), JSON.stringify(log,null,2));
    }
  }
  console.log(`\n🏁 act-s4 OK=${ok} FAIL=${fail}`);
  fs.writeFileSync(path.join(outDir,'_bulk-run-log.json'), JSON.stringify(log,null,2));
}

main().catch(e=>{console.error(e); process.exit(1);});
