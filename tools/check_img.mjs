import fs from 'fs';
const key = fs.readFileSync('F:/Projects/cartoonapp/dashboard/api/.dev.vars','utf8').match(/PLAYVEO_API_KEY\s*=\s*(.+)/)[1].trim();
const base='https://playveo-api.aboessa101.workers.dev';
const id='ed7f1f51-7be7-4de6-9ab9-9450a2c8e869';
const r=await fetch(`${base}/v1/images/${id}`,{headers:{Authorization:`Bearer ${key}`}});
const j=await r.json();
console.log(JSON.stringify(j, null, 2));
