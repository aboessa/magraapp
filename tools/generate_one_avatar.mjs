import fs from 'fs';
import os from 'os';
import path from 'path';

const KEY_PATH = path.join(os.homedir(), '.majarra', 'playveo.key');
const KEY = fs.readFileSync(KEY_PATH,'utf8').trim();
const BASE = 'https://playveo-api.aboessa101.workers.dev';

const manifest = JSON.parse(fs.readFileSync('tools/playveo/majarra-avatars.manifest.json','utf8'));
const asset = manifest.assets[0]; // luna

const prompt = (asset.scene + ' ' + manifest.style_tail).replace(/\s+/g,' ').trim();
console.log('Prompt length', prompt.length);
console.log('Prompt:', prompt.slice(0,200)+'...');
console.log('Submitting...');

let controller = new AbortController();
setTimeout(()=>controller.abort(), 60000);

try {
  const res = await fetch(BASE+'/v1/images/text-to-image', {
    method:'POST',
    headers:{ Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio: asset.aspect_ratio, count:1, model: manifest.model }),
    signal: controller.signal
  });
  const text = await res.text();
  console.log('Status', res.status);
  console.log('Body', text.slice(0,1000));
  if(!res.ok) process.exit(1);
  const data = JSON.parse(text);
  const id = data.id;
  console.log('Job ID', id, 'cost', data.creditCost);

  // Poll
  for(let i=0;i<60;i++){
    await new Promise(r=>setTimeout(r, 10000));
    console.log(`Polling ${i}...`);
    const r2 = await fetch(BASE+`/v1/images/${id}`, { headers:{ Authorization:`Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
    const t2 = await r2.text();
    console.log('poll status', r2.status, t2.slice(0,500));
    if(!r2.ok) continue;
    const j = JSON.parse(t2);
    const st = j.image?.status || j.status;
    console.log('  ->', st);
    if(st==='completed'){
      const url = j.image?.resultUrls?.[0] || j.resultUrls?.[0];
      console.log('URL', url);
      const imgRes = await fetch(url, { headers:{ Authorization:`Bearer ${KEY}` } });
      const buf = Buffer.from(await imgRes.arrayBuffer());
      console.log('img bytes', buf.length, 'is JPEG?', buf[0]===0xff && buf[1]===0xd8);
      const outPath = path.join('app_main/assets/avatars/characters', asset.file);
      fs.mkdirSync(path.dirname(outPath), {recursive:true});
      fs.writeFileSync(outPath, buf);
      console.log('Saved to', outPath);
      process.exit(0);
    }
    if(st==='failed'){
      console.error('FAILED', j.image?.error || j.error);
      process.exit(1);
    }
  }
  console.error('Timeout');
} catch(e){
  console.error('Error', e.message, e.cause);
  process.exit(1);
}
