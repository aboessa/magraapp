#!/usr/bin/env node
/**
 * generate-50.mjs - توليد 50 صورة ارسم مثلي بالـ Master Style الموحد
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, 'draw-like-me-50.manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const API_KEY = process.env.PLAYVEO_API_KEY || 'pv_WTtKgrViXXsDo8JquF9XpKwUKfUfBumH';
const BASE = manifest.base_url || 'https://playveo-api.aboessa101.workers.dev';
const MASTER = manifest.master_style;
const NEG = manifest.negative_prompt;

async function api(pathname, init) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: { ...(init.headers||{}), 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${pathname} ${res.status} ${text.slice(0,1200)}`);
  return json;
}
async function submitT2I({prompt, aspect_ratio, negative_prompt}) {
  const body = { prompt, aspect_ratio, model: manifest.model||'nano_banana_2', count: 1 };
  if (negative_prompt) body.negative_prompt = negative_prompt;
  const j = await api('/v1/images/text-to-image', { method:'POST', body: JSON.stringify(body) });
  if (!j.id) throw new Error('no id ' + JSON.stringify(j));
  return j.id;
}
async function waitFor(id, timeoutMs=8*60*1000) {
  const start=Date.now();
  while(Date.now()-start<timeoutMs){
    await new Promise(r=>setTimeout(r,7000));
    const j=await api(`/v1/images/${id}`,{method:'GET'});
    const inner=j.image||j;
    const st=inner.status||j.status;
    if(st==='completed'||st==='ready'||st==='succeeded') return inner;
    if(st==='failed') throw new Error(`job ${id} failed ${JSON.stringify(j).slice(0,800)}`);
    console.log(`   ⏳ ${id} ${st} ${Math.round((Date.now()-start)/1000)}s`);
  }
  throw new Error(`timeout ${id}`);
}
async function download(url,dst){
  const r=await fetch(url);
  if(!r.ok) throw new Error(`download ${r.status} ${url}`);
  const buf=Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.writeFileSync(dst,buf);
  return dst;
}

async function processOne(entry){
  const outRoot = path.resolve(__dirname, '..', '..', 'assets', 'images', 'draw_like_me', 'v2-final');
  const localPath = path.join(outRoot, `${entry.id}.png`);
  if (fs.existsSync(localPath)) {
    console.log(`\n─── ${entry.id} (${entry.title_ar}) ─── SKIP exists`);
    return { id: entry.id, title_ar: entry.title_ar, url: null, localPath, r2_key: entry.r2_key, thumb_r2_key: entry.thumb_r2_key, sort_order: entry.sort_order, tags: entry.tags, age_min: entry.age_min, age_max: entry.age_max, difficulty: entry.difficulty, sub_category: entry.sub_category, category: entry.category, d1_id: entry.d1_id, skipped: true };
  }
  const fullPrompt = `${entry.prompt} ${MASTER}`.slice(0,2800);
  console.log(`\n─── ${entry.id} (${entry.title_ar}) ───`);
  console.log(`   prompt: ${fullPrompt.slice(0,120)}...`);
  const jobId = await submitT2I({prompt: fullPrompt, aspect_ratio: manifest.aspect_ratio||'1:1', negative_prompt: NEG});
  const done = await waitFor(jobId);
  const urls = done.resultUrls||done.result_urls||done.urls||[];
  const firstUrl = urls[0]||done.url;
  if(!firstUrl) throw new Error('no result url '+JSON.stringify(done).slice(0,800));
  console.log(`   🖼️ ${String(firstUrl).slice(0,100)}...`);
  await download(firstUrl, localPath);
  console.log(`   💾 local → ${localPath}`);
  return { id: entry.id, title_ar: entry.title_ar, url: firstUrl, localPath, r2_key: entry.r2_key, thumb_r2_key: entry.thumb_r2_key, sort_order: entry.sort_order, tags: entry.tags, age_min: entry.age_min, age_max: entry.age_max, difficulty: entry.difficulty, sub_category: entry.sub_category, category: entry.category, d1_id: entry.d1_id };
}

async function main(){
  console.log(`🚀 draw-like-me 50 generation: ${manifest.assets.length} assets, model=${manifest.model}, base=${BASE}`);
  const concurrency = manifest.concurrency ?? 2;
  let idx=0, ok=0, fail=0;
  const results=[];
  async function worker(){
    while(true){
      const i=idx++; if(i>=manifest.assets.length) break;
      const entry=manifest.assets[i];
      try { const r=await processOne(entry); results.push(r); ok++; }
      catch(e){ fail++; console.error(`❌ ${entry.id} ${e.message}`); fs.mkdirSync(path.join(__dirname,'output'),{recursive:true}); try{fs.writeFileSync(path.join(__dirname,`output/${entry.id}.error.txt`), String(e.stack||e));}catch{} }
    }
  }
  await Promise.all(Array.from({length: concurrency},()=>worker()));
  console.log(`\n✅ Done: ${ok} ok, ${fail} failed.`);
  fs.writeFileSync(path.join(__dirname,'draw-like-me-50.results.json'), JSON.stringify(results,null,2));
  console.log(`   → ${path.join(__dirname,'draw-like-me-50.results.json')}`);
  if(fail>0) process.exit(2);
}
main().catch(e=>{ console.error(e); process.exit(1); });
