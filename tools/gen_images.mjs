import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = "F:\\Projects\\cartoonapp";
const key = fs.readFileSync(path.join(os.homedir(), '.majarra','playveo.key'),'utf8').trim();
console.log('PlayVeo key len', key.length, 'prefix', key.slice(0,8));

const manifestPath = path.join(ROOT, 'tools','playveo','wave4-visual.manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
console.log(`Wave4: ${manifest.games.length} games`);

function buildPrompt(game, asset) {
  const c = manifest.shared_prompt_contract;
  return [
    c.brand+'.',
    `Audience: children age ${game.age_group}.`,
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

const jobs = [];
for (const g of manifest.games) {
  for (const a of g.assets) {
    if (a.action!=='GENERATE') continue;
    // pick only first asset per game for demo (cover)
    if (a.asset!=='cover') continue;
    const prompt = buildPrompt(g,a);
    const aspect = a.transparent ? '1:1' : '4:3';
    jobs.push({ game_id:g.game_id, asset:a.asset, aspect, prompt });
  }
}
console.log(`Demo jobs (covers only): ${jobs.length}`);

async function submit(job) {
  const res = await fetch('https://playveo-api.aboessa101.workers.dev/v1/images/text-to-image', {
    method:'POST',
    headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
    body: JSON.stringify({ prompt: job.prompt, aspect_ratio: job.aspect, count:1 })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${res.status} ${text.slice(0,500)}`);
  const j = JSON.parse(text);
  return j.id;
}

async function poll(jobId) {
  for (let attempt=0; attempt<30; attempt++) {
    await new Promise(r=>setTimeout(r, 4000));
    const res = await fetch(`https://playveo-api.aboessa101.workers.dev/v1/images/${jobId}`, {
      headers:{'Authorization':'Bearer '+key}
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`GET ${res.status} ${text.slice(0,500)}`);
    const j = JSON.parse(text);
    const entity = j.image ?? j.job ?? j;
    const st = String(entity.status ?? j.status ?? 'unknown').toLowerCase();
    console.log(`  poll ${jobId} attempt ${attempt+1}: status=${st}`);
    if (st==='completed') {
      const urls = entity.resultUrls ?? entity.result_urls ?? [];
      if (urls.length) return { status: st, url: urls[0] };
      return { status: st, url: null };
    }
    if (st==='failed') throw new Error(`job failed: ${entity.error ?? 'unknown'}`);
  }
  throw new Error('poll timeout');
}

async function download(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), {recursive:true});
  fs.writeFileSync(destPath, buf);
  console.log(`  downloaded ${destPath} ${buf.length} bytes`);
}

async function main() {
  // Try only first 3 covers to limit credits (0.3)
  for (let i=0; i<Math.min(3, jobs.length); i++) {
    const job = jobs[i];
    console.log(`\n[${i+1}/${Math.min(3,jobs.length)}] ${job.game_id}/${job.asset} prompt ${job.prompt.length} chars aspect ${job.aspect}`);
    try {
      const jobId = await submit(job);
      console.log(`  submitted job ${jobId}`);
      const result = await poll(jobId);
      console.log(`  completed! url=${result.url?.slice(0,80)}...`);
      if (result.url) {
        const outPath = path.join(ROOT, 'tools','playveo','output','wave4', job.game_id.replace('game-',''), 'source', `${job.asset}.jpg`);
        await download(result.url, outPath);
      }
    } catch (e) {
      console.log(`  FAIL ${job.game_id}/${job.asset}: ${e.message.slice(0,400)}`);
    }
  }
  console.log('\nDone covers');
}

main().catch(e=>{ console.error(e); process.exit(1); });
