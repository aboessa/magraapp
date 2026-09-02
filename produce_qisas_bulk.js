#!/usr/bin/env node
// Bulk produce remaining qisas-min-alhayat stories (5 stories, 90+ images)
// Uses same pattern as produce_remaining_bulk_final.mjs but for junior track
import fs from 'fs';
import path from 'path';
const ROOT = 'F:/Projects/cartoonapp';
const manifestPath = path.join(ROOT,'docs/content/planets/05-qisas/_manifest-qisas-min-alhayat.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));

const PLAYVEO_API_KEY = (()=>{ 
  const envLocal = path.join(ROOT,'.env.local');
  if(fs.existsSync(envLocal)){
    for(const line of fs.readFileSync(envLocal,'utf8').split(/\r?\n/)){
      const m=line.match(/^\s*PLAYVEO_API_KEY\s*=\s*(.+)$/);
      if(m){ let v=m[1].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); return v; }
    }
  }
  return process.env.PLAYVEO_API_KEY?.trim();
})();
if(!PLAYVEO_API_KEY) { console.error('No PLAYVEO_API_KEY'); process.exit(1); }

const BASE_URL = 'https://playveo-api.aboessa101.workers.dev';
const MODEL = 'nano_banana_2';
const BULK_LIMIT = 5; // Free plan limit detected
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ONLY_STORY = (()=>{
  const i=args.indexOf('--story');
  return i!==-1? args[i+1]: null;
})();

function buildPrompt(story, page){
  const charLock = story.characters?.map(c=> `${c.name_ar} is ${c.description_ar}`).join(' ') || '';
  const styleTail = " Premium soft 2D illustrated storybook for junior track 9-12 independent reading, detailed expressive characters, contemporary Arab home and school and club and neighborhood, full-bleed native 16:9, no baked black bars, calm low stimulation but more mature composition than preschool, 5-7 elements per page, no text burnt into image, no logo, no watermark, keep faces and story action inside central 90%, child-safe reassuring.";
  const lock = story.title_ar ? `Same characters consistent in every image: ${story.characters.map(c=> c.name_ar + ' ' + c.age + ' years old').join(', ')}. ` : '';
  return `${lock}${page.illustration_brief} ${page.text_ar} ${styleTail}`.replace(/\s+/g,' ').trim();
}

function normalize(p){ return p.trim().toLowerCase().replace(/\s+/g,' '); }

async function bulkPost(prompts, aspect){
  if(!prompts.length) throw new Error('empty bulk');
  if(prompts.length>BULK_LIMIT) throw new Error(`bulk over limit ${prompts.length}>${BULK_LIMIT}`);
  for(const p of prompts) if(!p?.trim()) throw new Error('empty prompt rejected before billing per docs');
  const norm = prompts.map(normalize);
  const seen=new Set();
  for(const n of norm){ if(seen.has(n)) throw new Error(`duplicate normalized blocked before billing: ${n.slice(0,80)}`); seen.add(n); }
  console.log(`\nBULK POST ${prompts.length}x aspect=${aspect} model=${MODEL}`);
  if(DRY) return prompts.map((_,i)=>({id:`dry-${Date.now()}-${i}`, creditCost:0}));
  const res = await fetch(`${BASE_URL}/v1/images/bulk/text-to-image`,{
    method:'POST',
    headers:{ Authorization:`Bearer ${PLAYVEO_API_KEY}`, 'Content-Type':'application/json'},
    body: JSON.stringify({ prompts, aspect_ratio: aspect, model: MODEL })
  });
  const txt=await res.text();
  if(!res.ok) throw new Error(`bulk ${res.status} ${txt.slice(0,800)}`);
  const j=JSON.parse(txt);
  console.log(`accepted ${j.jobs.length} totalCost=${j.totalCost} remaining=${j.remainingCredits}`);
  return j.jobs.map((job,i)=>({id: job.id || job, creditCost: job.creditCost, prompt: prompts[i]})).filter(x=>x.id);
}

async function waitImage(id){
  if(DRY) return { resultUrls:[`https://example.com/${id}.jpg`] };
  const start=Date.now();
  while(Date.now()-start < 12*60*1000){
    await new Promise(r=>setTimeout(r,5000));
    const res=await fetch(`${BASE_URL}/v1/images/${id}`,{ headers:{ Authorization:`Bearer ${PLAYVEO_API_KEY}`}});
    const txt=await res.text();
    if(!res.ok){ console.log(`  poll ${id.slice(0,8)} ${res.status} retry`); continue; }
    const j=JSON.parse(txt);
    const inner=j.image||j;
    const st=(inner.status||'').toLowerCase();
    if(st==='completed' || st==='ready') return inner;
    if(st==='failed') throw new Error(`job ${id} failed ${inner.error}`);
    console.log(`  poll ${id.slice(0,8)} ${st} ${Math.round((Date.now()-start)/1000)}s`);
  }
  throw new Error(`timeout ${id}`);
}

async function download(url,dest){
  if(DRY){ return 3; } // dry should NOT write fake files
  const r=await fetch(url);
  if(!r.ok) throw new Error(`download ${r.status}`);
  const buf=Buffer.from(await r.arrayBuffer());
  const isJpg = buf[0]===0xFF && buf[1]===0xD8;
  const isPng = buf[0]===0x89 && buf[1]===0x50;
  if(!isJpg && !isPng) console.warn(`not jpg/png magic ${buf.slice(0,8).toString('hex')} ${dest}`);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function processStory(story){
  const slug=story.slug;
  const outDir=path.join(ROOT,`tools/playveo/output/qml-${slug}`);
  const appDir=path.join(ROOT,`app_main/assets/images/stories/qml-${slug}-playveo`);
  if(!DRY){
    fs.mkdirSync(outDir,{recursive:true});
    fs.mkdirSync(appDir,{recursive:true});
  }
  const existing=new Set(fs.existsSync(outDir)? fs.readdirSync(outDir).filter(f=>f.endsWith('.jpg')): []);

  const pages=story.pages||[];
  const missing=pages.filter((p,i)=> !existing.has(`page-${String(p.page_number).padStart(3,'0')}.jpg`));
  console.log(`\n=== ${slug} - ${story.title_ar} ===`);
  console.log(`pages total ${pages.length}, existing ${existing.size}, missing ${missing.length}`);
  if(DRY && missing.length===0){
    console.log('already complete dry');
    return;
  }
  // Build prompts grouped by aspect (all 16:9 for now)
  const allItems = (ONLY_STORY? missing: pages).map(p=>{
    const file=`page-${String(p.page_number).padStart(3,'0')}.jpg`;
    const prompt = buildPrompt(story,p);
    return { file, prompt, page:p };
  }).filter(it=> DRY? true: !existing.has(it.file) || ONLY_STORY);

  if(!allItems.length){
    console.log(`  ${slug} already complete`);
    return;
  }

  // Chunk by BULK_LIMIT
  for(let i=0;i<allItems.length;i+=BULK_LIMIT){
    const chunk=allItems.slice(i,i+BULK_LIMIT);
    const prompts=chunk.map(c=>c.prompt);
    const files=chunk.map(c=>c.file);
    console.log(`\n Chunk ${Math.floor(i/BULK_LIMIT)+1}/${Math.ceil(allItems.length/BULK_LIMIT)} - ${files.join(', ')}`);
    let jobs;
    try{ jobs=await bulkPost(prompts,'16:9'); }catch(e){ console.error(`bulk submit failed ${slug} chunk ${i}: ${e.message}`); continue; }
    const results=await Promise.all(chunk.map(async (item,idx)=>{
      const job=jobs[idx];
      if(!job) return {error:'no job mapped', file:item.file};
      try{
        const done=await waitImage(job.id);
        const url=done.resultUrls?.[0] || done.result_urls?.[0] || done.url;
        if(!url) throw new Error('no url');
        const dest=path.join(outDir,item.file);
        const len=await download(url,dest);
        console.log(`  saved ${item.file} ${len}B job=${job.id.slice(0,8)}`);
        if(!DRY) fs.copyFileSync(dest, path.join(appDir,item.file));
        return {ok:true};
      }catch(e){ console.error(`  fail ${item.file} ${e.message}`); return {error:e.message}; }
    }));
    await new Promise(r=>setTimeout(r,1500));
  }
  // cover/hero/thumb for qisas
  const extraFiles=['cover.jpg','hero.jpg','thumb.jpg'];
  const extraExisting=new Set(fs.existsSync(outDir)? fs.readdirSync(outDir).filter(f=>f.endsWith('.jpg')): []);
  for(const ef of extraFiles){
    if(extraExisting.has(ef)) continue;
    const prompt=`${story.title_ar} ${story.description_ar} Premium illustrated junior storybook cover for ${slug}, contemporary Arab kids 9-12, full bleed native aspect for ${ef}, no text burnt, no logo.`;
    try{
      const aspect=ef==='cover.jpg'?'1:1': ef==='thumb.jpg'?'3:4':'16:9';
      const jobs=await bulkPost([prompt], aspect);
      const done=await waitImage(jobs[0].id);
      const url=done.resultUrls?.[0];
      if(url && !DRY){
        const dest=path.join(outDir,ef);
        const len=await download(url,dest);
        fs.copyFileSync(dest, path.join(appDir,ef));
        console.log(`  saved extra ${ef} ${len}B`);
      }
    }catch(e){ console.error(`  extra ${ef} fail ${e.message}`); }
  }
  console.log(`\nDONE ${slug}`);
}

async function main(){
  console.log(`Produce qisas-min-alhayat bulk remaining - model=${MODEL} bulk=${BULK_LIMIT} dry=${DRY} only=${ONLY_STORY||'all'}`);
  const stories = manifest.stories;
  let targets = stories;
  if(ONLY_STORY) targets = stories.filter(s=> s.slug===ONLY_STORY);
  for(const st of targets){
    await processStory(st);
  }
  console.log('\nAll qisas done');
}

main().catch(e=>{ console.error(e); process.exit(1); });
