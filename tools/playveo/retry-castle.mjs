import fs from 'fs';
const API_KEY = 'pv_WTtKgrViXXsDo8JquF9XpKwUKfUfBumH';
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const MASTER = fs.readFileSync('tools/playveo/draw-like-me-50.manifest.json','utf8');
const manifest = JSON.parse(MASTER);
const entry = manifest.assets.find(a=>a.id==='fantasy-45-castle-small');
const fullPrompt = `${entry.prompt} ${manifest.master_style}`.slice(0,2800);
async function api(p, init){
  const res = await fetch(`${BASE}${p}`, {...init, headers: {...(init.headers||{}), 'Authorization': `Bearer ${API_KEY}`, 'Content-Type':'application/json'}});
  const txt = await res.text();
  let j; try{ j=JSON.parse(txt);}catch{ j={raw:txt};}
  return {status:res.status, json:j, text:txt};
}
async function wait(id){
  while(true){
    await new Promise(r=>setTimeout(r,7000));
    const r = await api(`/v1/images/${id}`, {method:'GET'});
    console.log('poll', r.json.status, JSON.stringify(r.json).slice(0,300));
    const st = r.json.status || r.json.image?.status;
    if(st==='completed' || st==='ready' || r.json.resultUrls){
      return r.json;
    }
    if(st==='failed'){ throw new Error('failed '+r.text); }
  }
}
const res = await api('/v1/images/text-to-image', {method:'POST', body: JSON.stringify({prompt: fullPrompt, aspect_ratio:'1:1', model:'nano_banana_2', count:1, negative_prompt: manifest.negative_prompt})});
console.log('submit', res.json);
const done = await wait(res.json.id);
console.log('done', done);
const url = done.resultUrls?.[0] || done.image?.resultUrls?.[0] || done.url;
console.log('url', url);
if(url){
  const r = await fetch(url);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync('assets/images/draw_like_me/v2-final/fantasy-45-castle-small.png', buf);
  console.log('saved');
}
