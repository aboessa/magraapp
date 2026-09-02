#!/usr/bin/env node
/**
 * Bulk production for qisas-min-alhayat (junior 9-12) - 5 stories
 * Uses same pattern as produce_remaining_bulk_final.mjs but adapted for qisas manifest
 * Fixes previous dry-run bug where fake files were written
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'docs/content/planets/05-qisas/_manifest-qisas-min-alhayat.json');
const BASE_URL = 'https://playveo-api.aboessa101.workers.dev';
const MODEL = 'nano_banana_2';
const BULK_LIMIT = 5; // Free plan: Maximum 5 per https://playveo.online/docs.json (10 Pro, 20 Enterprise)
const POLL_MS = 5000;
const TIMEOUT_MS = 12*60*1000;

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ONLY = (()=>{ const i=args.indexOf('--story'); return i!==-1? args[i+1]: null; })();
const SUBMIT = args.includes('--submit');

function loadKey(){
  const candidates=[
    process.env.PLAYVEO_API_KEY?.trim(),
    (()=>{ const fp=path.join(ROOT,'.env.local'); if(!fs.existsSync(fp)) return; for(const line of fs.readFileSync(fp,'utf8').split(/\r?\n/)){ const m=line.match(/^\s*PLAYVEO_API_KEY\s*=\s*(.+)$/); if(!m) continue; let v=m[1].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); return v; } })(),
  ];
  return candidates.find(x=>x&&x.length>8);
}
const API_KEY = DRY? 'dry-key' : loadKey();
if(!API_KEY && !DRY){ console.error('Missing PLAYVEO_API_KEY'); process.exit(1); }

console.log(`key=${DRY?'dry':API_KEY.slice(0,12)+'***'} model=${MODEL} bulk=${BULK_LIMIT} only=${ONLY||'all'} submit=${SUBMIT} dry=${DRY}`);

function normalize(p){ return p.trim().toLowerCase().replace(/\s+/g,' '); }

const STATE_PATH = path.join(__dirname, '.qisas-bulk-state.json');
function loadState(){ try{ return JSON.parse(fs.readFileSync(STATE_PATH,'utf8')); }catch{ return { at:new Date().toISOString(), batches:[] }; } }
function saveState(s){ s.updated_at=new Date().toISOString(); fs.writeFileSync(STATE_PATH, JSON.stringify(s,null,2)); }

async function bulkPost(prompts, aspect){
  if(!prompts.length) throw new Error('empty bulk');
  if(prompts.length>BULK_LIMIT) throw new Error(`bulk over limit ${prompts.length}>${BULK_LIMIT}`);
  for(const p of prompts) if(!p?.trim()) throw new Error('empty prompt in bulk blocked before billing');
  const norm=prompts.map(normalize); const seen=new Set();
  for(const n of norm){ if(seen.has(n)) throw new Error(`duplicate normalized prompt blocked before billing: ${n.slice(0,100)}`); seen.add(n); }
  console.log(`\n BULK POST ${prompts.length}x aspect=${aspect} model=${MODEL}`);
  if(DRY) return prompts.map((_,i)=>({ id:`dry-${Date.now()}-${i}`, creditCost:0 }));
  const res=await fetch(`${BASE_URL}/v1/images/bulk/text-to-image`,{
    method:'POST',
    headers:{ Authorization:`Bearer ${API_KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ prompts, aspect_ratio: aspect, model: MODEL })
  });
  const txt=await res.text();
  if(!res.ok) throw new Error(`bulk ${res.status} ${txt.slice(0,1200)}`);
  const j=JSON.parse(txt);
  const jobs=j.jobs||[];
  if(!jobs.length) throw new Error('bulk no jobs '+txt.slice(0,600));
  const state=loadState(); state.batches.push({ at:new Date().toISOString(), aspect, count:prompts.length, prompts, jobs, totalCost:j.totalCost, remainingCredits:j.remainingCredits }); saveState(state);
  console.log(`  accepted ${jobs.length} totalCost=${j.totalCost} remaining=${j.remainingCredits}`);
  return jobs.map((job,idx)=>({ id: typeof job==='string'?job: job.id||job.job_id, prompt: prompts[idx] })).filter(x=>x.id);
}

async function waitImage(id){
  if(DRY) return { resultUrls:[`https://example.com/${id}.jpg`] };
  const start=Date.now(); let last='';
  while(Date.now()-start < TIMEOUT_MS){
    await new Promise(r=>setTimeout(r,POLL_MS));
    const res=await fetch(`${BASE_URL}/v1/images/${id}`,{ headers:{ Authorization:`Bearer ${API_KEY}` } });
    const txt=await res.text();
    if(!res.ok){ console.log(`   poll ${id.slice(0,8)} ${res.status} retry`); continue; }
    let j; try{ j=JSON.parse(txt); }catch{ console.log(`   poll ${id.slice(0,8)} bad json`); continue; }
    const inner=j.image||j;
    const st=(inner.status||'').toLowerCase();
    if(st!==last){ console.log(`   poll ${id.slice(0,8)} ${st} ${Math.round((Date.now()-start)/1000)}s`); last=st; }
    if(st==='completed' || st==='ready') return inner;
    if(st==='failed') throw new Error(`job ${id} failed ${inner.error}`);
  }
  throw new Error(`timeout ${id}`);
}

async function downloadImage(url,dest){
  if(DRY) return 3;
  const r=await fetch(url);
  if(!r.ok) throw new Error(`download ${r.status} ${url.slice(0,80)}`);
  const buf=Buffer.from(await r.arrayBuffer());
  const isJpg=buf[0]===0xFF && buf[1]===0xD8;
  const isPng=buf[0]===0x89 && buf[1]===0x50;
  if(!isJpg && !isPng) console.warn(`   not jpg/png magic ${buf.slice(0,8).toString('hex')} ${path.basename(dest)}`);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function buildPagePrompt(story, page){
  // Character consistency + illustration brief + text
  const chars = (story.characters||[]).map(c=> `${c.name_ar} ${c.age} years old ${c.description_ar}`).join('; ');
  const lock = chars ? `Same characters in every image for this story: ${chars}. ` : '';
  const brief = page.illustration_brief || '';
  const text = page.text_ar || '';
  const styleTail = " Premium illustrated junior storybook 9-12 independent reading, detailed contemporary Arab characters and homes and school and club and neighborhood and wide ground, 5-7 elements per page, full-bleed native 16:9, no baked black bars, no text burnt into image, no logo, no watermark, no frame, child-safe calm but mature, keep faces and story action inside central 90%, no crying face, no dark loneliness, no villain face, no complete darkness.";
  // Keep prompt under ~1500 chars but detailed
  let prompt = `${lock}${brief} ${text} ${styleTail}`.replace(/\s+/g,' ').trim();
  // Hard cap 1500 to stay under billing efficiency (docs allow longer but prefer concise)
  if(prompt.length>1600) prompt=prompt.slice(0,1600);
  return prompt;
}

async function processStory(story){
  const slug=story.slug;
  const outDir=path.join(ROOT,`tools/playveo/output/qml-${slug}`);
  const appDir=path.join(ROOT,`app_main/assets/images/stories/qml-${slug}-playveo`);
  if(!DRY){
    fs.mkdirSync(outDir,{recursive:true});
    fs.mkdirSync(appDir,{recursive:true});
  }
  const pages=story.pages||[];
  const existingFiles = fs.existsSync(outDir) ? new Set(fs.readdirSync(outDir).filter(f=>f.toLowerCase().endsWith('.jpg'))) : new Set();
  const missingPages = pages.filter(p=>{
    const file=`page-${String(p.page_number).padStart(3,'0')}.jpg`;
    return !existingFiles.has(file);
  });

  console.log(`\n=== ${slug} - ${story.title_ar} ===`);
  console.log(`pages total ${pages.length}, existing ${existingFiles.size}, missing ${missingPages.length}`);

  const allItems = missingPages.map(p=>{
    const file=`page-${String(p.page_number).padStart(3,'0')}.jpg`;
    const prompt=buildPagePrompt(story,p);
    return { file, prompt, page:p };
  });

  if(allItems.length===0){
    console.log(`  ${slug} pages already complete`);
  }else{
    // Group by aspect (all 16:9)
    for(let i=0;i<allItems.length;i+=BULK_LIMIT){
      const chunk=allItems.slice(i,i+BULK_LIMIT);
      const prompts=chunk.map(c=>c.prompt);
      const files=chunk.map(c=>c.file);
      console.log(`\n Chunk ${Math.floor(i/BULK_LIMIT)+1}/${Math.ceil(allItems.length/BULK_LIMIT)} - ${files.join(', ')}`);
      let jobs;
      try{ jobs=await bulkPost(prompts,'16:9'); }catch(e){ console.error(`  bulk submit failed ${slug} chunk ${i}: ${e.message}`); continue; }
      await Promise.all(chunk.map(async (item,idx)=>{
        const job=jobs[idx];
        if(!job) return;
        try{
          const done=await waitImage(job.id);
          const url=done.resultUrls?.[0] || done.result_urls?.[0] || done.url;
          if(!url) throw new Error('no url');
          const dest=path.join(outDir,item.file);
          const len=await downloadImage(url,dest);
          console.log(`   saved ${item.file} ${len}B job=${job.id.slice(0,8)}`);
          if(!DRY) fs.copyFileSync(dest, path.join(appDir,item.file));
        }catch(e){ console.error(`   fail ${item.file} ${e.message}`); }
      }));
      await new Promise(r=>setTimeout(r,1500));
    }
  }

  // Extras: cover/hero/thumb
  const extraDefs=[
    { file:'cover.jpg', aspect:'1:1', prompt: `${story.title_ar} - ${story.description_ar}. Premium junior storybook square cover 1:1, contemporary Arab kids 9-12, centered composition upper clean for title layer, full-bleed no text burnt, no logo, no watermark.` },
    { file:'hero.jpg', aspect:'16:9', prompt: `${story.title_ar} - ${story.description_ar}. Wide cinematic junior storybook hero 16:9, left side story scene, right 40% empty darker gradient for Arabic title overlay, no embedded title, full-bleed low contrast.` },
    { file:'thumb.jpg', aspect:'3:4', prompt: `${story.title_ar} - ${story.description_ar}. Vertical thumbnail wordless NO WRITING, strong readable silhouettes small size, upper quarter clean empty gradient for title, no text, no letters, full-bleed readable.` },
  ];
  for(const extra of extraDefs){
    const extraPath=path.join(outDir,extra.file);
    if(fs.existsSync(extraPath)) continue;
    console.log(`\n Extra ${extra.file} aspect=${extra.aspect}`);
    try{
      const jobs=await bulkPost([extra.prompt], extra.aspect);
      const done=await waitImage(jobs[0].id);
      const url=done.resultUrls?.[0];
      if(url){
        const len=await downloadImage(url,extraPath);
        console.log(`   saved extra ${extra.file} ${len}B`);
        if(!DRY) fs.copyFileSync(extraPath, path.join(appDir,extra.file));
      }
    }catch(e){ console.error(`   extra ${extra.file} fail ${e.message}`); }
  }
  console.log(`\nDONE ${slug} - total in output: ${(fs.existsSync(outDir)? fs.readdirSync(outDir).filter(f=>f.endsWith('.jpg')).length:0)} jpg`);
}

async function main(){
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));
  let stories = manifest.stories || [];
  if(ONLY) stories = stories.filter(s=> s.slug===ONLY);
  console.log(`Produce qisas-min-alhayat bulk - ${stories.length} stories, model=${MODEL}, bulk=${BULK_LIMIT}, dry=${DRY}, submit=${SUBMIT}`);

  if(!SUBMIT && !DRY && !ONLY){
    console.log('Use --dry to preview or --submit to produce or --story <slug> to produce one');
    return;
  }

  for(const st of stories){
    await processStory(st);
  }
  console.log('\nAll qisas done - cleaning up dry test file');
}

main().catch(e=>{ console.error(e); process.exit(1); });
