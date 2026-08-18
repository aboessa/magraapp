import fs from 'fs';
const key = fs.readFileSync('F:/Projects/cartoonapp/dashboard/api/.dev.vars','utf8').match(/PLAYVEO_API_KEY\s*=\s*(.+)/)[1].trim();
const base='https://playveo-api.aboessa101.workers.dev';
const prompt="Counting game cover with 3 bright yellow stars countable on white, child-friendly clean silhouette 1:1 soft pastel vector white background";
const res = await fetch(`${base}/v1/images/text-to-image`, {method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify({prompt, aspect_ratio:"1:1", count:1})});
const j = await res.json();
console.log('create',j.id,j.status);
for(let i=0;i<20;i++){ await new Promise(r=>setTimeout(r,5000)); const r2=await fetch(`${base}/v1/images/${j.id}`,{headers:{Authorization:`Bearer ${key}`}}); const j2=await r2.json(); const img=j2.image||j2; console.log(`poll ${i}`,img.status); if(img.status==='completed'){ console.log(img.resultUrls[0]); const rr=await fetch(img.resultUrls[0]); const buf=Buffer.from(await rr.arrayBuffer()); fs.writeFileSync('C:/Users/pc/AppData/Local/Temp/count-place.jpg', buf); console.log('saved',buf.length); break; } }
