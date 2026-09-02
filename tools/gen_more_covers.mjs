import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ROOT="F:\\Projects\\cartoonapp";
const key=fs.readFileSync(path.join(os.homedir(),'.majarra','playveo.key'),'utf8').trim();
console.log('PlayVeo key',key.slice(0,8),'len',key.length);
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'tools','playveo','wave4-visual.manifest.json'),'utf8'));

function buildPrompt(game, asset) {
  const c=manifest.shared_prompt_contract;
  return [
    c.brand+'.', `Audience: children age ${game.age_group}.`,
    `Game: ${game.title_ar}; purpose: ${game.engine} gameplay.`,
    `Art direction: ${game.art_direction}`,
    `Asset purpose: ${asset.role}.`,
    `Subject: ${asset.prompt_subject}.`,
    `${c.style}.`, `${c.purpose}.`, `${c.framing}.`, `${c.camera}.`,
    asset.transparent? 'Render standalone object against plain easily removable background. Keep every edge fully inside frame; final will be transparent cutout.' : 'Use requested game-specific background and preserve clear negative space for runtime controls.',
    `${c.simplicity}.`, `${c.text_rule}.`, `${c.rights_rule}.`,
    asset.transparent? `${c.transparency_rule}.` : '',
  ].join(' ').replace(/\s+/g,' ').trim();
}

const jobs=[];
for (const g of manifest.games) {
  for (const a of g.assets) {
    if (a.action!=='GENERATE') continue;
    if (a.asset!=='cover') continue;
    // skip already done (match-nature, count-nature, sort-animals already done)
    const outPath=path.join(ROOT,'tools','playveo','output','wave4',g.game_id.replace('game-',''),'source',`${a.asset}.jpg`);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size>10000) { console.log(`skip exists ${g.game_id}/${a.asset}`); continue; }
    const prompt=buildPrompt(g,a);
    const aspect=a.transparent?'1:1':'4:3';
    jobs.push({ game_id:g.game_id, title:g.title_ar, asset:a.asset, aspect, prompt, outPath });
  }
}
console.log(`Jobs remaining: ${jobs.length} covers`);

async function submit(job) {
  const res=await fetch('https://playveo-api.aboessa101.workers.dev/v1/images/text-to-image',{
    method:'POST',
    headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({ prompt:job.prompt, aspect_ratio:job.aspect, count:1 })
  });
  const text=await res.text();
  if(!res.ok) throw new Error(`POST ${res.status} ${text.slice(0,600)}`);
  return JSON.parse(text).id;
}
async function poll(jobId) {
  for (let attempt=0; attempt<30; attempt++) {
    await new Promise(r=>setTimeout(r,4000));
    const res=await fetch(`https://playveo-api.aboessa101.workers.dev/v1/images/${jobId}`,{headers:{'Authorization':'Bearer '+key}});
    const text=await res.text();
    if(!res.ok) throw new Error(`GET ${res.status} ${text.slice(0,500)}`);
    const j=JSON.parse(text);
    const entity=j.image??j.job??j;
    const st=String(entity.status??j.status??'unknown').toLowerCase();
    console.log(`  poll ${jobId} attempt ${attempt+1}: ${st}`);
    if(st==='completed'){
      const urls=entity.resultUrls??entity.result_urls??[];
      if(urls.length) return urls[0];
      return null;
    }
    if(st==='failed') throw new Error(`job failed ${entity.error}`);
  }
  throw new Error('poll timeout');
}

async function download(url, dest) {
  const res=await fetch(url);
  if(!res.ok) throw new Error(`download ${res.status}`);
  const buf=Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest, buf);
  // also copy to app_main
  const appPath=path.join(ROOT,'app_main','assets','images','games','wave4', path.basename(path.dirname(path.dirname(dest))),'cover.jpg');
  try{ fs.mkdirSync(path.dirname(appPath),{recursive:true}); fs.copyFileSync(dest, appPath); console.log(`  copied to ${appPath}`); }catch{}
  console.log(`  downloaded ${dest} ${buf.length}B`);
}

for (let i=0;i<jobs.length;i++) {
  const job=jobs[i];
  console.log(`\n[${i+1}/${jobs.length}] ${job.game_id} - ${job.title} aspect ${job.aspect} prompt ${job.prompt.length} chars`);
  try {
    const jobId=await submit(job);
    console.log(`  submitted ${jobId}`);
    const url=await poll(jobId);
    if(url){ await download(url, job.outPath); }
    else console.log('  no url returned');
  } catch(e){ console.log(`  FAIL ${e.message.slice(0,600)}`); }
}
console.log('\nAll done');
