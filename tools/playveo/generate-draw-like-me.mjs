#!/usr/bin/env node
/**
 * generate-draw-like-me.mjs
 * يولّد هيرو ارسم مثلي + 6 رسومات مرجعية (عصفور/سيارة/فراشة/صاروخ/قطة/نجمة) عبر Nano Banana 2
 * الهيرو: شبح لا، خلفية navy سينمائية. المراجع: خلفية بيضا flat colors (لا شفافة إلا للـ ghost overlay optional)
 * السعر: 0.1 لكل صورة، 7 صور ≈ 0.7$ — يرفع مباشرة إلى R2 عبر adminCreativeStudio/generate أو يحفظ محلياً ثم upload
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const MANIFEST_PATH = path.join(__dirname, 'draw-like-me.manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const API_KEY = process.env.PLAYVEO_API_KEY || manifest.api_key || 'pv_IzCCZCf7qtnvmDnyghfK4VTOCoOknbfK4VTOCoOknbf5';
const BASE = manifest.base_url || 'https://playveo-api.aboessa101.workers.dev';

async function api(pathname, init) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: { ...(init.headers||{}), 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${pathname} ${res.status} ${text.slice(0,800)}`);
  return json;
}
async function submitT2I({prompt, aspect_ratio}) {
  console.log(`\n🎨 T2I ${aspect_ratio} ${prompt.slice(0,90)}...`);
  const j = await api('/v1/images/text-to-image', { method:'POST', body: JSON.stringify({ prompt, aspect_ratio, model: manifest.model||'nano_banana_2', count:1 }) });
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
    if(st==='completed'||st==='ready') return inner;
    if(st==='failed') throw new Error(`job ${id} failed ${JSON.stringify(j).slice(0,600)}`);
    console.log(`   ⏳ ${id} ${st} ${Math.round((Date.now()-start)/1000)}s`);
  }
  throw new Error(`timeout ${id}`);
}
async function download(url,dst){
  const r=await fetch(url);
  if(!r.ok) throw new Error(`download ${r.status}`);
  const buf=Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.writeFileSync(dst,buf);
  return dst;
}

async function processOne(entry){
  const isHero = entry.kind==='hero';
  const aspect = entry.aspect || (isHero ? '16:9' : manifest.aspect_ratio || '1:1');
  const tail = isHero ? manifest.style_tail_hero : manifest.style_tail_reference;
  const fullPrompt = `${entry.prompt}${tail}`.slice(0,1800);
  console.log(`\n─── ${entry.id} (${entry.label}) kind=${entry.kind} ───`);
  const jobId = await submitT2I({prompt:fullPrompt, aspect_ratio: aspect});
  const done = await waitFor(jobId);
  const urls = done.resultUrls||done.result_urls||done.urls||[];
  const firstUrl = urls[0]||done.url;
  if(!firstUrl) throw new Error('no result url '+JSON.stringify(done).slice(0,600));
  console.log(`   🖼️ ${String(firstUrl).slice(0,90)}...`);
  // local save
  const localPath = path.join(root, entry.out || `assets/images/reference/draw_like_me/${entry.filename}`);
  await download(firstUrl, localPath);
  console.log(`   💾 local → ${localPath}`);
  // optional R2 upload via admin API if env has admin token — skip for now, admin panel can upload manually or via /generate endpoint
  return { id: entry.id, url: firstUrl, localPath, r2_key: entry.r2_key };
}

async function main(){
  console.log(`🚀 draw-like-me generation: ${manifest.assets.length} assets, model=${manifest.model}, base=${BASE}, key=${API_KEY.slice(0,10)}...`);
  const concurrency = manifest.concurrency ?? 2;
  let idx=0, ok=0, fail=0;
  const results=[];
  async function worker(){
    while(true){
      const i=idx++; if(i>=manifest.assets.length) break;
      const entry=manifest.assets[i];
      try { const r=await processOne(entry); results.push(r); ok++; }
      catch(e){ fail++; console.error(`❌ ${entry.id} ${e.message}`); fs.mkdirSync(path.join(root,'tools/playveo/output'),{recursive:true}); fs.writeFileSync(path.join(root,`tools/playveo/output/${entry.id}.error.txt`), String(e.stack||e)); }
    }
  }
  await Promise.all(Array.from({length: concurrency},()=>worker()));
  console.log(`\n✅ Done: ${ok} ok, ${fail} failed.`);
  // write summary for admin import
  fs.writeFileSync(path.join(__dirname,'draw-like-me.results.json'), JSON.stringify(results,null,2));
  console.log(`   → ${path.join(__dirname,'draw-like-me.results.json')}`);
  if(fail>0) process.exit(2);
}
main().catch(e=>{ console.error(e); process.exit(1); });
