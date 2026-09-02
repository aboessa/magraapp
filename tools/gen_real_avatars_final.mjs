import fs from 'fs';
import os from 'os';
import path from 'path';

const KEY = fs.readFileSync(path.join(os.homedir(),'.majarra','playveo.key'),'utf8').trim();
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const manifest = JSON.parse(fs.readFileSync('tools/playveo/majarra-avatars.manifest.json','utf8'));
const outDir = 'app_main/assets/avatars/characters';
fs.mkdirSync(outDir,{recursive:true});
const sleep = ms => new Promise(r=>setTimeout(r, ms));

async function submit(asset){
  const prompt = (asset.scene + ' ' + manifest.style_tail).replace(/\s+/g,' ').trim();
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const res = await fetch(BASE+'/v1/images/text-to-image',{
        method:'POST',
        headers:{ Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ prompt, aspect_ratio: asset.aspect_ratio, count:1, model: manifest.model }),
        signal: AbortSignal.timeout(60000)
      });
      const txt = await res.text();
      if(!res.ok) throw new Error(`${res.status} ${txt.slice(0,300)}`);
      const j = JSON.parse(txt);
      if(!j.id) throw new Error('no id '+txt.slice(0,300));
      return j.id;
    }catch(e){
      console.log(`  submit attempt ${attempt} failed: ${e.message}`);
      if(attempt===3) throw e;
      await sleep(3000);
    }
  }
}

async function poll(id){
  for(let i=0;i<90;i++){
    await sleep(10000);
    try{
      const r = await fetch(BASE+`/v1/images/${id}`, { headers:{ Authorization:`Bearer ${KEY}` }, signal: AbortSignal.timeout(30000)});
      const t = await r.text();
      if(!r.ok) continue;
      const j = JSON.parse(t);
      const st = j.image?.status || j.status;
      if(i%3===0) process.stdout.write(`\r    poll ${i*10}s ${st} ${id.slice(0,8)}      `);
      if(st==='completed'){
        const url = j.image.resultUrls[0];
        const imgR = await fetch(url, { headers:{ Authorization:`Bearer ${KEY}` } });
        const buf = Buffer.from(await imgR.arrayBuffer());
        process.stdout.write(` -> ${buf.length} bytes\n`);
        return buf;
      }
      if(st==='failed'){
        throw new Error(`failed ${j.image?.error||'unknown'}`);
      }
    }catch(e){
      if(e.message.startsWith('failed')) throw e;
    }
  }
  throw new Error('timeout');
}

const queue = [...manifest.assets];
let idx=0;
let success=0, fail=0;

async function worker(wid){
  while(true){
    const myIdx = idx++;
    if(myIdx>=queue.length) return;
    const asset = queue[myIdx];
    console.log(`\n[${wid}/${success+fail+1}/${queue.length}] ${asset.id} -> ${asset.file}`);
    try{
      const jobId = await submit(asset);
      console.log(`  job ${jobId} 0.1 credit`);
      const buf = await poll(jobId);
      const dest = path.join(outDir, asset.file);
      fs.writeFileSync(dest, buf);
      console.log(`  ✅ ${asset.file} ${(buf.length/1024).toFixed(0)}KB`);
      success++;
    }catch(e){
      console.error(`  ❌ ${asset.file} ${e.message}`);
      fail++;
    }
  }
}

console.log(`${queue.length} avatars, ~${(queue.length*0.1).toFixed(1)} credits, 2 workers`);
await Promise.all([worker(1), worker(2)]);
console.log(`\n done success=${success} fail=${fail}`);

// copy aliases
const aliasMap = [
  ['luna-full.png','luna.png'],
  ['nouma-full.png','nouma.png'],
  ['zaina-front.png','zaina-full.png','zaina.png'],
  ['yaseen-front.png','yaseen-full.png','yaseen.png'],
  ['salma-full.png','salma.png'],
  ['addaad-happy.png','addaad.png'],
  ['robo-analytical.png','robo.png'],
];
for(const group of aliasMap){
  const src = group[0];
  const srcPath = path.join(outDir, src);
  if(!fs.existsSync(srcPath)) continue;
  for(const dst of group.slice(1)){
    const dstPath = path.join(outDir, dst);
    if(!fs.existsSync(dstPath)){
      fs.copyFileSync(srcPath, dstPath);
      console.log(`copied ${src} -> ${dst}`);
    }
  }
}
