const KEY="pv_pGsel6vL3VLUrmdoRV8PpyE3oHxtDVbu";
// build a real studio prompt like EpisodeDetail does (from luna-locks)
import { readFileSync } from 'fs';
// use a simplified real prompt - take from manifest
const j = JSON.parse(readFileSync('majarra-playveo-studio/src/lib/manifests.generated.json','utf8'));
const ep = j.find(e=>e.folder==='luna-discovers-words');
console.log('ep',ep.folder, ep.scenes.length, ep.scenes[0].visual.slice(0,120));
const longPrompt = `Premium stylized 3D preschool animation. ${ep.scenes[0].visual} Luna says in Arabic: «${(ep.scenes[0].dialogue||[]).join(' ') }» Timeline: ${(ep.scenes[0].timeline||[]).map(t=>t.at+': '+t.text).join(' | ')}`;
// also build via buildClipPrompt if available
console.log('prompt len', longPrompt.length);

async function post(base, body){
  const res = await fetch(base, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${KEY}`}, body: JSON.stringify(body)});
  const txt = await res.text();
  console.log('POST', base, 'HTTP', res.status, txt.slice(0,800));
  return txt;
}
const shortBody = {prompt:"Premium calm stylized 3D preschool animation test, a girl waves in a garden, 16:9", aspect_ratio:"16:9", duration_seconds:4};
const longBody = {prompt: longPrompt, aspect_ratio:"16:9", duration_seconds: 10};

console.log('\n--- short via DIRECT ---');
await post('https://playveo-api.aboessa101.workers.dev/v1/videos', shortBody);
console.log('\n--- long via DIRECT ---');
await post('https://playveo-api.aboessa101.workers.dev/v1/videos', longBody);
console.log('\n--- long via PROXY 127.0.0.1 ---');
await post('http://127.0.0.1:1420/api/playveo/v1/videos', longBody);
