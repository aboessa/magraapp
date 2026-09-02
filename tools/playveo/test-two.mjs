import fs from 'fs';
const API_KEY = 'pv_WTtKgrViXXsDo8JquF9XpKwUKfUfBumH';
const BASE = 'https://playveo-api.aboessa101.workers.dev';
async function api(p, init){
  const res = await fetch(`${BASE}${p}`, {...init, headers: {...(init.headers||{}), 'Authorization': `Bearer ${API_KEY}`, 'Content-Type':'application/json'}});
  const txt = await res.text();
  let j; try{ j=JSON.parse(txt);}catch{ j={raw:txt};}
  console.log('status', res.status, JSON.stringify(j).slice(0,2000));
  return j;
}
const prompt = 'A cute small blue and yellow bird sitting on a simple brown tree branch, rounded body, Premium child-friendly learn-to-draw reference illustration, finished full-color artwork, clean modern cartoon style, simple rounded shapes, bold clean silhouette, bright harmonious colors, minimal visual clutter, easy to understand and copy by a child, centered composition, clear separation between shapes, polished mobile kids app quality, soft simple background accents only, no text, no letters, no numbers, no watermark, no UI, no frame, no photorealism, square 1:1 composition.';
try{
  const j = await api('/v1/images/text-to-image', {method:'POST', body: JSON.stringify({prompt: prompt.slice(0,2000), aspect_ratio:'1:1', model:'nano_banana_2', count:1, negative_prompt: 'photorealistic, text, watermark'})});
  console.log('result', j);
}catch(e){console.error(e);}
