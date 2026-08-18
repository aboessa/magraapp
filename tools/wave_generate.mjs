import fs from 'fs';
import path from 'path';

const envPath = 'F:/Projects/cartoonapp/dashboard/api/.dev.vars';
let key = '';
try {
  const txt = fs.readFileSync(envPath,'utf8');
  const m = txt.match(/PLAYVEO_API_KEY\s*=\s*(.+)/);
  if(m) key = m[1].trim();
} catch {}
if(!key) { console.error('no key'); process.exit(1); }

const base = 'https://playveo-api.aboessa101.workers.dev';

async function gen(prompt, ratio='1:1'){
  const res = await fetch(`${base}/v1/images/text-to-image`, {
    method:'POST',
    headers:{ 'Authorization': `Bearer ${key}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio: ratio, count:1 })
  });
  const j = await res.json().catch(()=> ({}));
  console.log('gen', res.status, JSON.stringify(j).slice(0,500));
  return j;
}

const brief = "child-friendly illustration, clean silhouette, readable forms, minimal visual noise, age-appropriate, consistent line weight, white background, vector style";

for(const p of [
  `Memory game cover with 4 cute cartoon animals cat bird fish rabbit in grid, ${brief}`,
  `Counting game cover with 3 yellow stars on white, ${brief}`
]){
  await gen(p);
}
