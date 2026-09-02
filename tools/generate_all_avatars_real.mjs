import fs from 'fs';
import os from 'os';
import path from 'path';

const KEY = fs.readFileSync(path.join(os.homedir(),'.majarra','playveo.key'),'utf8').trim();
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const manifest = JSON.parse(fs.readFileSync('tools/playveo/majarra-avatars.manifest.json','utf8'));

const outDir = 'app_main/assets/avatars/characters';
const sleep = ms => new Promise(r=>setTimeout(r, ms));

async function submit(prompt, ratio){
  const res = await fetch(BASE+'/v1/images/text-to-image',{
    method:'POST',
    headers:{ Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio: ratio, count:1, model: manifest.model }),
    signal: AbortSignal.timeout(60000)
  });
  const txt = await res.text();
  if(!res.ok) throw new Error(`${res.status} ${txt.slice(0,300)}`);
  const j = JSON.parse(txt);
  return j.id;
}

async function waitAndDownload(id, destFile){
  for(let i=0;i<80;i++){
    await sleep(10000);
    const r = await fetch(BASE+`/v1/images/${id}`, { headers:{ Authorization:`Bearer ${KEY}` }, signal: AbortSignal.timeout(30000)});
    const t = await r.text();
    if(!r.ok){ console.log(`  poll ${i} fail ${r.status}`); continue; }
    const j = JSON.parse(t);
    const st = j.image?.status;
    process.stdout.write(`\r  [${Math.round((i*10)/60)}m ${i*10%60}s] ${st} ${id.slice(0,8)}...   `);
    if(st==='completed'){
      const url = j.image.resultUrls[0];
      const imgR = await fetch(url, { headers:{ Authorization:`Bearer ${KEY}` } });
      const buf = Buffer.from(await imgR.arrayBuffer());
      const dest = path.join(outDir, destFile);
      fs.mkdirSync(path.dirname(dest), {recursive:true});
      fs.writeFileSync(dest, buf);
      console.log(`\n  ✅ Saved ${destFile} ${(buf.length/1024).toFixed(0)}KB`);
      return true;
    }
    if(st==='failed'){
      console.error(`\n  ❌ Failed ${id}: ${j.image.error}`);
      return false;
    }
  }
  console.error(`\n  ⏰ Timeout ${id}`);
  return false;
}

async function main(){
  // Already done: luna-full.jpg, now skip it if exists and is recent (>500KB JPEG)
  const targets = manifest.assets.slice(1); // skip first already done
  console.log(`${targets.length} avatars to generate, ~${(targets.length*0.1).toFixed(1)} credits`);

  const concurrency = 2;
  let idx=0;

  async function worker(wId){
    while(true){
      const myIdx = idx++;
      if(myIdx>=targets.length) return;
      const asset = targets[myIdx];
      const prompt = (asset.scene + ' ' + manifest.style_tail).replace(/\s+/g,' ').trim();
      console.log(`\n[${wId}] ${asset.id} -> ${asset.file} (${prompt.length} chars)`);

      // Skip if already exists and >400KB (real PlayVeo image)
      const destPath = path.join(outDir, asset.file);
      if(fs.existsSync(destPath)){
        const s = fs.statSync(destPath);
        if(s.size>300*1024){
          console.log(`  ⏭️  Skip existing ${asset.file} (${(s.size/1024).toFixed(0)}KB)`);
          continue;
        }
      }

      let attempts=0;
      while(attempts<2){
        attempts++;
        try{
          const jobId = await submit(prompt, asset.aspect_ratio);
          console.log(`  Job ${jobId} (attempt ${attempts})`);
          const ok = await waitAndDownload(jobId, asset.file);
          if(ok) break;
        }catch(e){
          console.error(`  Error ${e.message} attempt ${attempts}`);
          await sleep(5000);
        }
      }
    }
  }

  await Promise.all([worker(1), worker(2)]);
  console.log('\n✅ All done!');
}

main();
