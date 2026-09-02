import fs from 'fs';
const MANIFEST_PATH = 'tools/playveo/draw-like-me-50.manifest.json';
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));
const API_KEY = process.env.PLAYVEO_API_KEY || 'pv_IzCCZCf7qtnvmDnyghfK4VTOCoOknbfK4VTOCoOknbf5';
const BASE = 'https://playveo-api.aboessa101.workers.dev';
async function api(p, init){
  const res = await fetch(`${BASE}${p}`, {...init, headers: {...(init.headers||{}), 'Authorization': `Bearer ${API_KEY}`, 'Content-Type':'application/json'}});
  const txt = await res.text();
  let j; try{ j=JSON.parse(txt);}catch{ j={raw:txt};}
  console.log('status', res.status, JSON.stringify(j).slice(0,2000));
  return j;
}
const entry = manifest.assets[0];
const full = `${entry.prompt} ${manifest.master_style}`;
console.log('prompt len', full.length);
console.log(full.slice(0,300));
try{
  const j = await api('/v1/images/text-to-image', {method:'POST', body: JSON.stringify({prompt: full.slice(0,2500), aspect_ratio:'1:1', model:'nano_banana_2', count:1, negative_prompt: manifest.negative_prompt})});
  console.log('result', j);
}catch(e){console.error(e);}
