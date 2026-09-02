// Wave 4 visual asset generation for 18 new games via PlayVeo
// Usage:
//   node tools/playveo/generate_wave4_assets.mjs --plan
//   node tools/playveo/generate_wave4_assets.mjs --submit --only game-match-nature-3/cover
//   node tools/playveo/generate_wave4_assets.mjs --submit --poll --limit 6

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST_PATH = path.join(import.meta.dirname, 'wave4-visual.manifest.json');
const STATE_PATH = path.join(import.meta.dirname, 'wave4-production.jobs.json');
const BASE_URL = 'https://playveo-api.aboessa101.workers.dev';

function parseEnvValue(fp, name) {
  if (!fs.existsSync(fp)) return undefined;
  for (const line of fs.readFileSync(fp,'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1]!==name) continue;
    let v = m[2]; if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    return v.trim();
  }
}
function loadKey() {
  const cands = [
    process.env.PLAYVEO_API_KEY?.trim(),
    parseEnvValue(path.join(ROOT,'.env.local'),'PLAYVEO_API_KEY'),
    parseEnvValue(path.join(ROOT,'dashboard','api','.dev.vars'),'PLAYVEO_API_KEY'),
    fs.existsSync(path.join(os.homedir(),'.majarra','playveo.key'))?fs.readFileSync(path.join(os.homedir(),'.majarra','playveo.key'),'utf8').trim():undefined,
  ];
  const k = cands.find(x=>x&&x.length>8);
  if(!k) throw new Error('PLAYVEO_API_KEY unavailable');
  return k;
}
const sha256 = (v)=>crypto.createHash('sha256').update(v).digest('hex');
const compact = (v)=>String(v??'').replace(/\s+/g,' ').trim();
const slug = (id)=>id.replace(/^game-/,'');
function aspectFor(a){ if(a.transparent) return '1:1'; if(a.asset==='cover'||String(a.asset).includes('background')) return '4:3'; return '4:3'; }
function extFor(a){ return a.transparent?'png':'webp'; }

function buildPrompt(manifest, game, asset) {
  const c = manifest.shared_prompt_contract;
  return compact([
    c.brand+'.', `Audience: children age ${game.age_group}.`,
    `Game: ${game.title_ar}; purpose: ${game.engine} gameplay.`,
    `Art direction: ${game.art_direction}`,
    `Asset purpose: ${asset.role}.`,
    `Subject: ${asset.prompt_subject}.`,
    `${c.style}.`, `${c.purpose}.`, `${c.framing}.`, `${c.camera}.`,
    asset.transparent?`Render standalone object against one plain evenly lit easily removable background. Keep every edge fully inside frame; final will be transparent cutout.`:`Use requested game-specific background and preserve clear negative space for runtime controls.`,
    `${c.simplicity}.`, `${c.text_rule}.`, `${c.rights_rule}.`,
    asset.transparent?`${c.transparency_rule}.`:'',
  ].join(' '));
}

function expandManifest(m) {
  const jobs=[];
  for (const g of m.games) for (const a of g.assets) {
    if(a.action!=='GENERATE') continue;
    const key=`${g.game_id}/${a.asset}`;
    const prompt = buildPrompt(m,g,a);
    const gameSlug = slug(g.game_id);
    jobs.push({
      key, game_id:g.game_id, game_title_ar:g.title_ar, age_group:g.age_group, engine:g.engine,
      asset:a.asset, purpose:a.role, operation:'text-to-image', route_kind:'image',
      aspect_ratio: aspectFor(a), transparent_required: Boolean(a.transparent),
      prompt, prompt_sha256: sha256(prompt),
      source_file:`tools/playveo/output/wave4/${gameSlug}/source/${a.asset}.jpg`,
      target_file:`app_main/assets/images/games/wave4/${gameSlug}/${a.asset}.${extFor(a)}`,
      status:'planned', job_id:null, provider_model:null, credit_cost:null,
      submitted_at:null, completed_at:null, error:null, downloaded:false, optimized:false,
    });
  }
  return jobs;
}

function baseState(m){ return { schema_version:1, manifest_id:m.manifest_id, provider:'PlayVeo', provider_base_url:BASE_URL, created_at:new Date().toISOString(), updated_at:new Date().toISOString(), jobs:[] }; }
function mergeState(m){
  const desired = expandManifest(m);
  let s = fs.existsSync(STATE_PATH)?JSON.parse(fs.readFileSync(STATE_PATH,'utf8')):baseState(m);
  const ex = new Map((s.jobs??[]).map(j=>[j.key,j]));
  s.jobs = desired.map(j=>({...j, ...(ex.get(j.key)??{}) }));
  s.updated_at=new Date().toISOString(); return s;
}
function saveState(s){ s.updated_at=new Date().toISOString(); fs.writeFileSync(STATE_PATH+'.tmp', JSON.stringify(s,null,2)+'\n'); fs.renameSync(STATE_PATH+'.tmp', STATE_PATH); }
function safeErr(v){ return compact(v).replace(/https?:\/\/[^\s"']+/g,'[url]').replace(/pv_[A-Za-z0-9_-]+/g,'[secret]').slice(0,500); }

let KEY;
async function api(method,route,body){
  KEY??=loadKey();
  const r=await fetch(`${BASE_URL}${route}`,{method,headers:{Authorization:`Bearer ${KEY}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(180_000)});
  const t=await r.text();
  if(r.status===401) throw new Error('401 auth failed');
  if(r.status===402) throw new Error('402 credits insufficient: '+t.slice(0,200));
  if(r.status===429) throw new Error('429 rate limited');
  if(!r.ok) throw new Error(`${method} ${route} ${r.status}: ${safeErr(t)}`);
  try{return JSON.parse(t);}catch{return t;}
}

function arg(name){ const i=process.argv.indexOf(`--${name}`); if(i<0) return undefined; const n=process.argv[i+1]; return n&&!n.startsWith('--')?n:true; }
function printPlan(s){
  const by={}; const transp=s.jobs.filter(j=>j.transparent_required).length;
  for(const j of s.jobs) by[j.aspect_ratio]=(by[j.aspect_ratio]??0)+1;
  console.log(`Manifest: ${s.manifest_id}`); console.log(`Jobs: ${s.jobs.length}`); console.log(`Transparent: ${transp}`);
  console.log(`Ratios: ${Object.entries(by).map(([k,v])=>`${k}=${v}`).join(', ')}`);
  console.log(`Est credits: ${(s.jobs.length*0.1).toFixed(2)}`);
}

async function main(){
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));
  let state = mergeState(manifest);

  if (process.argv.includes('--plan')||process.argv.length===2) {
    printPlan(state); saveState(state); return;
  }

  const only = typeof arg('only')==='string'?arg('only'):undefined;
  let jobs = only?state.jobs.filter(j=>j.key.includes(only)):state.jobs;
  const limit = Number(arg('limit')); if(Number.isFinite(limit)&&limit>0) jobs=jobs.slice(0,Math.floor(limit));

  if (process.argv.includes('--submit')) {
    console.log(`Submitting ${jobs.length} jobs...`);
    for (const job of jobs) {
      if(job.status==='completed'&&job.downloaded) { console.log(`  skip completed ${job.key}`); continue; }
      console.log(`  submit ${job.key} ${job.aspect_ratio} prompt ${job.prompt.length} chars`);
      try {
        const res = await api('POST','/v1/images/text-to-image',{prompt:job.prompt, aspect_ratio: job.aspect_ratio, count:1});
        job.job_id=res.id; job.status=res.status??'pending'; job.provider_model=res.model??null; job.credit_cost=res.creditCost??0.1; job.submitted_at=new Date().toISOString(); job.error=null;
        console.log(`    -> ${job.job_id} [${job.status}] cost=${job.credit_cost}`);
      } catch(e){ job.error=safeErr(e.message); console.log(`    FAIL ${job.error}`); }
      saveState(state);
      await new Promise(r=>setTimeout(r,800));
    }
  }

  if (process.argv.includes('--poll')) {
    console.log(`Polling ${jobs.length} jobs...`);
    for (const job of jobs) {
      if(!job.job_id||job.status==='completed') continue;
      console.log(`  poll ${job.key} ${job.job_id}`);
      try {
        const res = await api('GET',`/v1/images/${job.job_id}`);
        const entity = res.image??res.job??res;
        const st = String(entity.status??res.status??'unknown').toLowerCase();
        job.status=st; job.last_polled_at=new Date().toISOString();
        if(st==='completed'&&entity.resultUrls?.length) {
          job.result_count=entity.resultUrls.length; job.completed_at=new Date().toISOString();
          const url = entity.resultUrls[0];
          const outAbs = path.resolve(ROOT, job.source_file);
          fs.mkdirSync(path.dirname(outAbs),{recursive:true});
          console.log(`    downloading ${url.slice(0,80)}... -> ${job.source_file}`);
          const imgRes = await fetch(url);
          if(!imgRes.ok) throw new Error(`download ${imgRes.status}`);
          const buf = Buffer.from(await imgRes.arrayBuffer());
          fs.writeFileSync(outAbs, buf);
          job.downloaded=true;
          console.log(`    saved ${buf.length} bytes`);
        } else if(st==='failed') { job.error=entity.error??'failed'; }
        console.log(`    status=${job.status} resultCount=${job.result_count??0}`);
      } catch(e){ job.error=safeErr(e.message); console.log(`    FAIL ${job.error}`); }
      saveState(state);
      await new Promise(r=>setTimeout(r,1500));
    }
  }

  saveState(state);
  const done=state.jobs.filter(j=>j.status==='completed').length;
  console.log(`\nDone ${done}/${state.jobs.length} completed`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
