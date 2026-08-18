import fs from 'fs';
const key = fs.readFileSync('F:/Projects/cartoonapp/dashboard/api/.dev.vars','utf8').match(/PLAYVEO_API_KEY\s*=\s*(.+)/)[1].trim();
const base='https://playveo-api.aboessa101.workers.dev';
async function poll(id){
  for(let i=0;i<12;i++){
    const r=await fetch(`${base}/v1/images/${id}`,{headers:{Authorization:`Bearer ${key}`}});
    const j=await r.json();
    console.log(id, j.status, j.imageUrl || (j.images&&j.images[0]?.url) || JSON.stringify(j).slice(0,200));
    if(j.status==='completed') break;
    await new Promise(r=>setTimeout(r,5000));
  }
}
await poll('cec3cab6-b16a-4f95-9c92-6b10895abe5c');
await poll('3639e5a3-81c5-46df-97f4-95db7e2e01c6');
