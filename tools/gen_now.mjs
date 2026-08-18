import fs from 'fs';
const key = fs.readFileSync('F:/Projects/cartoonapp/dashboard/api/.dev.vars','utf8').match(/PLAYVEO_API_KEY\s*=\s*(.+)/)[1].trim();
const base='https://playveo-api.aboessa101.workers.dev';
const prompt = "Cute cartoon memory game cover, 4 friendly animals cat bird fish rabbit in 2x4 grid cards, child-friendly illustration clean silhouette minimal noise large objects 1:1, soft pastel, vector style, white background";
console.log('key', key.slice(0,8)+'***');
const res = await fetch(`${base}/v1/images/text-to-image`, {
  method:'POST',
  headers:{ 'Authorization': `Bearer ${key}`, 'Content-Type':'application/json' },
  body: JSON.stringify({ prompt, aspect_ratio:"1:1", count:1 })
});
const j = await res.json();
console.log('create', res.status, JSON.stringify(j, null, 2));
if(j.id){
  for(let i=0;i<20;i++){
    await new Promise(r=>setTimeout(r, 4000));
    const r2 = await fetch(`${base}/v1/images/${j.id}`, {headers:{Authorization:`Bearer ${key}`}});
    const j2 = await r2.json();
    console.log(`poll ${i}`, j2.status, j2.imageUrl || j2.images?.[0]?.url || j2.url || JSON.stringify(j2).slice(0,400));
    if(j2.status==='completed' && (j2.imageUrl||j2.images)) break;
    if(j2.status==='failed') break;
  }
}
