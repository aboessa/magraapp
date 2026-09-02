#!/usr/bin/env node
/**
 * FINAL - Produce remaining bedtime stories bs-s2..bs-s6 via Bulk 10/5
 * Implements docs.json critical_rules + detected Free plan limit =5
 * 
 * Status before run:
 *   act-s4: 11/11 OK in output (done)
 *   bs-s1: 15/15 OK in output (done) - 15 in app_main too
 *   bs-s2: 5/15 in output (need 10 more)
 *   bs-s3..bs-s6: 0/15 each (60 total)
 *   Total remaining: 70 assets
 *
 * Flow:
 *  - Load official prompts from generate_all_stories_bulk.mjs BS_STORIES
 *  - For each story bs-s2..bs-s6, check existing JPEGs in output/ to resume
 *  - Group by aspect_ratio, chunk by BULK_LIMIT=5 (auto-detect Free shows Max 5)
 *  - POST /v1/images/bulk/text-to-image, persist ids immediately
 *  - Poll each id independently every 5s
 *  - Verify JPEG magic, save to output/<story>/ and mirror to app_main/assets/images/stories/<story>-playveo/
 *  - State file: .produce-missing-bulk-state.json (reuse existing) + _bulk-run-log.json per story
 *
 * Requires: PLAYVEO_API_KEY from .env.local
 * Usage:
 *   node tools/playveo/produce_remaining_bulk_final.mjs --dry
 *   node tools/playveo/produce_remaining_bulk_final.mjs --submit  (does bs-s2..bs-s6)
 *   node tools/playveo/produce_remaining_bulk_final.mjs --story bs-s3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE_URL = 'https://playveo-api.aboessa101.workers.dev';
const MODEL = 'nano_banana_2';
const BULK_LIMIT = 5; // Free plan detected: "Maximum 5". Docs: Pro=10, Enterprise=20. Keep 5 safe.
const POLL_MS = 5000;
const POLL_TIMEOUT = 12 * 60 * 1000;

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const SUBMIT = args.includes('--submit');
const ONLY = (()=>{ const i=args.indexOf('--story'); return i!==-1?args[i+1]:null; })();

function parseEnvValue(fp,name){
  if(!fs.existsSync(fp)) return;
  for(const line of fs.readFileSync(fp,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(!m||m[1]!==name) continue;
    let v=m[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    return v.trim();
  }
}
function loadKey(){
  const c=[
    process.env.PLAYVEO_API_KEY?.trim(),
    parseEnvValue(path.join(ROOT,'.env.local'),'PLAYVEO_API_KEY'),
    parseEnvValue(path.join(ROOT,'dashboard','api','.dev.vars'),'PLAYVEO_API_KEY'),
  ];
  return c.find(x=>x&&x.length>8);
}
const API_KEY = DRY ? 'dry-key' : loadKey();
if(!API_KEY && !DRY){ console.error('❌ PLAYVEO_API_KEY missing'); process.exit(1); }
console.log(`🔑 key=${DRY?'dry':API_KEY.slice(0,12)+'***'} model=${MODEL} bulk=${BULK_LIMIT} dry=${DRY} only=${ONLY||'all-remaining'} submit=${SUBMIT}`);

function normalizePrompt(p){ return p.trim().toLowerCase().replace(/\s+/g,' '); }
function buildPrompt(manifest, asset){
  const lock = manifest.character_lock ? manifest.character_lock+' ' : '';
  const scene = asset.scene+' ';
  const light = asset.light ? asset.light+' ' : '';
  const tail = manifest.style_tail||'';
  return (lock+scene+light+tail).replace(/\s+/g,' ').trim();
}

const STATE_PATH = path.join(__dirname,'.produce-missing-bulk-state.json');
function loadState(){ try{ return JSON.parse(fs.readFileSync(STATE_PATH,'utf8')); }catch{ return {at:new Date().toISOString(), stories:{}, batches:[]}; } }
function saveState(s){ s.updated_at=new Date().toISOString(); fs.writeFileSync(STATE_PATH, JSON.stringify(s,null,2)+'\n'); }

async function fetchTimeout(url,opts={}){ return fetch(url,{...opts, signal:AbortSignal.timeout(opts.timeout??120_000)}); }

async function bulkPost(prompts, aspect){
  if(!prompts.length) throw new Error('empty bulk');
  if(prompts.length > BULK_LIMIT) throw new Error(`Bulk over limit ${prompts.length}>${BULK_LIMIT}`);
  for(const p of prompts) if(!p?.trim()) throw new Error('Empty prompt in bulk rejected before billing per docs.json');
  const norm=prompts.map(normalizePrompt); const seen=new Set();
  for(const n of norm){ if(seen.has(n)) throw new Error(`Duplicate normalized prompt blocked before billing: ${n.slice(0,100)}`); seen.add(n); }
  console.log(`\n📦 BULK POST ${prompts.length}x aspect=${aspect} model=${MODEL}`);
  if(DRY) return prompts.map((_,i)=>({ id:`dry-${Date.now()}-${i}`, creditCost:0, prompt:prompts[i]}));
  const res = await fetchTimeout(`${BASE_URL}/v1/images/bulk/text-to-image`,{
    method:'POST',
    headers:{ Authorization:`Bearer ${API_KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ prompts, aspect_ratio: aspect, model: MODEL }),
    timeout: 120_000
  });
  const txt = await res.text();
  if(!res.ok) throw new Error(`bulk ${res.status} ${txt.slice(0,1200)}`);
  let j; try{ j=JSON.parse(txt); }catch{ throw new Error('bulk not json '+txt.slice(0,400)); }
  const jobs=j.jobs||[];
  if(!jobs.length) throw new Error('bulk no jobs '+txt.slice(0,600));
  const state=loadState(); state.batches.push({ at:new Date().toISOString(), aspect, count:prompts.length, prompts, jobs, totalCost:j.totalCost, remainingCredits:j.remainingCredits });
  state.at=new Date().toISOString(); saveState(state);
  console.log(`✅ accepted ${jobs.length} jobs totalCost=${j.totalCost} remaining=${j.remainingCredits??'?'}`);
  return jobs.map((job,idx)=>({ id: (typeof job==='string'? job : job.id||job.job_id||''), creditCost: job.creditCost, raw:job, prompt:prompts[idx] })).filter(x=>x.id);
}

async function waitImage(id, timeoutMs=POLL_TIMEOUT){
  if(DRY) return { status:'completed', resultUrls:[`https://example.com/${id}.jpg`], result_urls:[`https://example.com/${id}.jpg`] };
  const start=Date.now(); let last='';
  while(Date.now()-start < timeoutMs){
    await new Promise(r=>setTimeout(r,POLL_MS));
    const res=await fetchTimeout(`${BASE_URL}/v1/images/${id}`,{ headers:{ Authorization:`Bearer ${API_KEY}` }, timeout:30_000 });
    const txt=await res.text();
    if(!res.ok){ console.log(` ⏳ ${id.slice(0,8)} GET ${res.status} retry`); continue; }
    let j; try{ j=JSON.parse(txt); }catch{ console.log(` ⏳ ${id.slice(0,8)} bad json`); continue; }
    const inner=j.image||j;
    const st=(inner.status||'').toLowerCase();
    if(st!==last){ console.log(` ⏳ ${id.slice(0,8)} ${st} ${Math.round((Date.now()-start)/1000)}s`); last=st; }
    if(st==='completed'||st==='ready') return inner;
    if(st==='failed') throw new Error(`job ${id} failed ${inner.error||''} ${JSON.stringify(inner).slice(0,600)}`);
  }
  throw new Error(`timeout ${id}`);
}

async function downloadImage(url,destAbs, bytesLog=[]){
  if(DRY){ fs.mkdirSync(path.dirname(destAbs),{recursive:true}); fs.writeFileSync(destAbs, Buffer.from('dry')); return 3; }
  const r=await fetchTimeout(url,{ timeout:60_000 });
  if(!r.ok) throw new Error(`download ${r.status} ${url.slice(0,120)}`);
  const buf=Buffer.from(await r.arrayBuffer());
  const isJpg=buf[0]===0xFF && buf[1]===0xD8; const isPng=buf[0]===0x89 && buf[1]===0x50;
  if(!isJpg && !isPng) console.warn(`⚠️ not jpg/png magic=${buf.slice(0,8).toString('hex')} file=${path.basename(destAbs)}`);
  fs.mkdirSync(path.dirname(destAbs),{recursive:true});
  fs.writeFileSync(destAbs, buf);
  return buf.length;
}

// ---- Load BS stories definitions from existing file to reuse official prompts ----
// We inline BS_STORIES here (copied from produce_missing_stories_bulk.mjs for reliability)
// To keep file manageable, we import dynamically from that file if exists.

let BS_STORIES = [];
async function loadBsStories(){
  // Attempt to read from generate_all_stories_bulk.mjs via regex extraction would be fragile.
  // So embed definitions by importing the other script's BS_STORIES if we can parse its file content quickly.
  // Instead we directly load the JSON manifests if present: bs-s2..bs-s6.manifest.json, else use embedded below.

  const manifestsPresent=[];
  for(let i=2;i<=6;i++){
    const fp=path.join(__dirname,`bs-s${i}.manifest.json`);
    if(fs.existsSync(fp)){
      try{
        const m=JSON.parse(fs.readFileSync(fp,'utf8'));
        // convert to BS_STORIES shape
        const scenes=m.assets.map(a=>({
          file:a.file,
          aspect_ratio:a.aspect_ratio||'16:9',
          brightness:a.brightness,
          motion:a.motion||'kenburns_slow',
          scene:a.scene,
          light:a.light||'',
          story_id:`asset-bs-s${i}-${a.id||a.file}`
        }));
        manifestsPresent.push({
          story:`bs-s${i}`,
          title:m.title||`bs-s${i}`,
          character_lock:m.character_lock||'',
          style_tail:m.style_tail||' Premium soft 2D kids bedtime storybook illustration, full-bleed native 16:9, no baked bars, calm low-stimulation, no text, no logo, no watermark.',
          scenes
        });
      }catch{}
    }
  }
  if(manifestsPresent.length>=4){ BS_STORIES=manifestsPresent; return; }

  // Fallback: load definitions from produce_missing_stories_bulk.mjs by require? Use file read and eval of BS_STORIES const boundary: we have it in that file but easier embed minimal definitions via copy from generate_all_stories_bulk.mjs for bs-s2..bs-s6.
  // Read generate_all_stories_bulk.mjs and extract BS_STORIES array via manual include: we already have full definitions in that file - we will dynamically import as JS module if we can.

  // Simplest: rebuild from existing file produce_missing_stories_bulk.mjs which defines BS_STORIES at line ~94 - we can read it raw and parse JSON-ish manually? Instead, re-define here compact from generate_all_stories_bulk.mjs (we know bs-s2..bs-s6 definitions are in that file too).
  // For now, load from generate_all_stories_bulk.mjs via async import after converting to ESM evaluation: we will read that file string and extract BS_STORIES via Function.
  try{
    const src=fs.readFileSync(path.join(__dirname,'generate_all_stories_bulk.mjs'),'utf8');
    // crude: find "const BS_STORIES = [" then bracket match
    const start=src.indexOf('const BS_STORIES = [');
    if(start!==-1){
      // attempt to evaluate safely by extracting up to ");\n// ---- Main" - we use a marker after array.
      const endMarker='// ---- Main logic ----';
      const end=src.indexOf(endMarker, start);
      if(end!==-1){
        let arrCode=src.slice(start, end);
        // arrCode is "const BS_STORIES = [ ... ];\n\n"
        // Remove const declaration for eval
        arrCode=arrCode.replace('const BS_STORIES =','').trim().replace(/;\s*$/,'');
        // eslint-disable-next-line no-eval
        const evald = eval('('+arrCode+')'); // array of objects
        if(Array.isArray(evald) && evald.length){
          BS_STORIES=evald;
          console.log(`📚 Loaded ${BS_STORIES.length} BS definitions from generate_all_stories_bulk.mjs`);
          return;
        }
      }
    }
  }catch(e){
    console.warn('Failed to load BS from generate_all_stories_bulk.mjs', e.message);
  }

  // Final fallback: define bs-s2..bs-s6 minimal from produce_missing... state? We'll use hardcoded bs-s2..bs-s6 from earlier file produce_missing_stories_bulk.mjs if still available
  try{
    const src2=fs.readFileSync(path.join(__dirname,'produce_missing_stories_bulk.mjs'),'utf8');
    const s=src2.indexOf('const BS_STORIES = [');
    if(s!==-1){
      const e=src2.indexOf('\n// ---- Bedtime', s+2000); // rough
      // Instead look for next const after
      const e2=src2.indexOf('\nconst BS_STORIES_END', s);
      // If not, just eval up to next function
      const end=src2.indexOf('\nasync function fetchWithTimeout', s);
      if(end!==-1){
        let code=src2.slice(s, end).replace('const BS_STORIES =','').trim().replace(/;\s*$/,'');
        const evald=eval('('+code+')');
        if(Array.isArray(evald)&&evald.length){ BS_STORIES=evald; console.log(`📚 Loaded ${BS_STORIES.length} BS definitions from produce_missing_stories_bulk.mjs`); return; }
      }
    }
  }catch(e2){
    console.warn('fallback load failed2', e2.message);
  }

  throw new Error('Could not load BS stories definitions - generate manifest json files bs-s2..bs-s6 required');
}

function existingFilesForStory(storyId){
  const outDir=path.join(ROOT,'tools/playveo/output',storyId);
  if(!fs.existsSync(outDir)) return new Set();
  const files=fs.readdirSync(outDir).filter(f=>f.toLowerCase().endsWith('.jpg'));
  return new Set(files);
}

async function processStory(storyDef){
  const storyId=storyDef.story;
  console.log(`\n━━━━━━━━━━━━━━ Story ${storyId} – ${storyDef.title} — ${storyDef.scenes.length} assets`);
  const outDir=path.join(ROOT,'tools/playveo/output',storyId);
  const appDir=path.join(ROOT,'app_main/assets/images/stories',`${storyId}-playveo`);
  fs.mkdirSync(outDir,{recursive:true});
  fs.mkdirSync(appDir,{recursive:true});

  const existing=existingFilesForStory(storyId);
  console.log(`   Existing output JPEGs: ${existing.size}/${storyDef.scenes.length} – ${[...existing].join(', ')}`);

  // Build prompt list for missing only (resume)
  const allItems=storyDef.scenes.map(sc=>{
    const prompt=buildPrompt(storyDef, sc);
    return { sceneObj: sc, prompt, normalized: normalizePrompt(prompt) };
  });

  // Filter missing unless DRY – in DRY we also want only missing to preview correctly
  const missingItems = allItems.filter(it=> !existing.has(it.sceneObj.file));
  const previewItems = DRY ? missingItems : missingItems;

  if(!missingItems.length){
    console.log(`   ✅ ${storyId} already complete (${existing.size}), skipping billing`);
    return { ok: existing.size, fail:0, skipped: true };
  }
  console.log(`   Missing to produce: ${missingItems.length} – ${missingItems.map(m=>m.sceneObj.file).join(', ')}`);

  // DRY: just print (missing only)
  const toList = DRY ? missingItems : missingItems;
  if(DRY){
    for(const it of toList){
      console.log(`   ✔ ${it.sceneObj.file.padEnd(20)} ${it.sceneObj.aspect_ratio} ${it.prompt.length} chars | ${it.sceneObj.scene.slice(0,60)}...`);
      if(it.prompt.length < 20) console.warn(`   ⚠️ short prompt ${it.sceneObj.file}`);
    }
    if(!toList.length) console.log('   ✅ No missing, would skip billing');
    return { ok:0, fail:0, dry:true };
  }

  // Group by aspect for bulk compliance (bulk endpoint requires common aspect per call)
  const byAspect={};
  for(const it of missingItems){
    const asp=it.sceneObj.aspect_ratio||'16:9';
    if(!byAspect[asp]) byAspect[asp]=[];
    byAspect[asp].push(it);
  }

  let ok=0, fail=0;
  const runLogPath=path.join(outDir,'_bulk-run-log.json');
  let runLog=[];
  try{ if(fs.existsSync(runLogPath)) runLog=JSON.parse(fs.readFileSync(runLogPath,'utf8')); }catch{ runLog=[]; }

  for(const [aspect, items] of Object.entries(byAspect)){
    console.log(`\n   Aspect ${aspect}: ${items.length} prompts`);
    // Dedup normalized within this aspect group
    const seen=new Set(); const deduped=[];
    for(const it of items){
      if(seen.has(it.normalized)){
        console.warn(`   ⚠️ skip duplicate normalized ${it.sceneObj.file} -> ${it.normalized.slice(0,60)}`);
        continue;
      }
      seen.add(it.normalized); deduped.push(it);
    }
    // Chunk
    for(let i=0;i<deduped.length;i+=BULK_LIMIT){
      const chunk=deduped.slice(i,i+BULK_LIMIT);
      const prompts=chunk.map(c=>c.prompt);
      const files=chunk.map(c=>c.sceneObj.file);
      console.log(`\n   📦 Chunk ${Math.floor(i/BULK_LIMIT)+1}/${Math.ceil(deduped.length/BULK_LIMIT)} – ${chunk.length} prompts – ${files.join(', ')}`);

      let jobs;
      try{
        jobs=await bulkPost(prompts, aspect);
      }catch(e){
        console.error(`   ❌ bulk submit failed ${storyId} ${aspect} chunk ${i}: ${e.message}`);
        fail+=chunk.length;
        continue;
      }
      // Poll independently per docs.json parallel_images pattern
      const results=await Promise.all(chunk.map(async (item, idx)=>{
        const job=jobs[idx];
        if(!job){ return { error:'no job mapped', file:item.sceneObj.file }; }
        try{
          const done=await waitImage(job.id);
          const url=done.resultUrls?.[0] || done.result_urls?.[0] || done.url || done.result_url;
          if(!url) throw new Error('no result url in completed job '+JSON.stringify(done).slice(0,400));
          const destJpg=path.join(outDir, item.sceneObj.file);
          const len=await downloadImage(url, destJpg);
          console.log(`   💾 ${item.sceneObj.file} ${len}B job=${job.id.slice(0,8)} url=${url.slice(0,80)}...`);
          // Mirror to Flutter assets immediately per agent guidance: copy needed files to durable private storage (result URLs expire after 10 days)
          const mirror=path.join(appDir, item.sceneObj.file);
          try{ fs.copyFileSync(destJpg, mirror); }catch{}
          runLog.push({ at:new Date().toISOString(), story:storyId, id:item.sceneObj.file, file:item.sceneObj.file, jobId:job.id, bytes:len, aspect, prompt: item.prompt.slice(0,200) });
          fs.writeFileSync(runLogPath, JSON.stringify(runLog,null,2));
          return { ok:true, file:item.sceneObj.file };
        }catch(e){
          console.error(`   ❌ ${item.sceneObj.file} job=${job.id?.slice(0,8)} ${e.message}`);
          return { error:e.message, file:item.sceneObj.file };
        }
      }));
      for(const r of results){ if(r.ok) ok++; else fail++; }
      // Small delay between bulk chunks to respect rate limits
      await new Promise(r=>setTimeout(r,1500));
    }
  }

  console.log(`\n🏁 ${storyId} OK=${ok} FAIL=${fail} existing=${existing.size} totalTarget=${storyDef.scenes.length}`);
  fs.writeFileSync(runLogPath, JSON.stringify(runLog,null,2));
  return { ok, fail, existing: existing.size };
}

async function main(){
  console.log(`\n🚀 produce_remaining_bulk_final – model=${MODEL} bulk=${BULK_LIMIT} – remaining stories bs-s2..bs-s6`);
  console.log(`Docs: https://playveo.online/docs.json – pattern: ${BULK_LIMIT} per bulk, validate non-empty, de-dup, persist ids before polling, poll independently every 5s, copy to durable storage (result URLs expire 10 days)`);

  await loadBsStories();
  console.log(`\n📚 BS loaded: ${BS_STORIES.map(s=>`${s.story}:${s.scenes.length}`).join(', ')}`);

  let targets=BS_STORIES;
  // we want only remaining: bs-s2..bs-s6. Filter out if already complete unless forced.
  if(ONLY){
    targets=targets.filter(t=>t.story===ONLY);
    if(!targets.length){ console.error(`Story ${ONLY} not found in BS definitions`); process.exit(1); }
  }else{
    // if called with --submit previously act-s4 already done, target bs-s2..bs-s6
    targets=targets.filter(t=> t.story.startsWith('bs-s'));
  }

  // Sort by story order
  targets.sort((a,b)=> a.story.localeCompare(b.story));

  if(DRY){
    for(const st of targets){ await processStory(st); }
    console.log('\n🔎 Dry run finished – no billing.');
    return;
  }

  if(!SUBMIT && !ONLY){
    console.log('\n⚠️ No --submit nor --dry nor --story specified. To avoid accidental billing, add --dry to preview or --submit to actually produce remaining.\nExample: node tools/playveo/produce_remaining_bulk_final.mjs --dry --story bs-s2\n         node tools/playveo/produce_remaining_bulk_final.mjs --submit');
    // Default to dry preview if not submit
    for(const st of targets){ await processStory({ ...st, scenes: st.scenes.slice(0,2) }); } // preview 2 each
    return;
  }

  let totalOk=0,totalFail=0;
  for(const st of targets){
    const res=await processStory(st);
    totalOk+=res.ok||0; totalFail+=res.fail||0;
  }

  console.log(`\n\n🎉 ALL REMAINING STORIES BULK DONE – totalOk=${totalOk} totalFail=${totalFail}`);
  console.log(`Next steps:\n 1. WebP conversion: node tools/playveo/prepare-act-s3-assets.py pattern but for bs-* (or use prepare-* scripts)\n 2. Google AI Studio TTS: use tools/tts/narrate.mjs after generating narration manifests from story MD\n 3. Verify app_main/assets/images/stories/*-playveo counts match docs/content/planets/05-qisas/bedtime-stories/\n 4. Update README / remaining-artwork.manifest.json\n`);

  // Also attempt quick inventory report
  const report=[];
  for(const st of targets){
    const outDir=path.join(ROOT,'tools/playveo/output',st.story);
    const appDir=path.join(ROOT,'app_main/assets/images/stories',`${st.story}-playveo`);
    const outCount=fs.existsSync(outDir)? fs.readdirSync(outDir).filter(f=>f.endsWith('.jpg')).length : 0;
    const appCount=fs.existsSync(appDir)? fs.readdirSync(appDir).length : 0;
    report.push({ story:st.story, out:outCount, app:appCount, target:st.scenes.length, complete: outCount===st.scenes.length });
  }
  console.log('\n📊 Inventory report:');
  console.table(report);
}

main().catch(e=>{ console.error('Fatal', e); process.exit(1); });
