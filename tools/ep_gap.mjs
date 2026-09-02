import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
function walk(dir, out=[]){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) walk(p,out);
    else if(e.name.startsWith('ep-') && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}
const files=walk('docs/content/planets');
let rows=[];
for(const f of files){
  const txt=fs.readFileSync(f,'utf8');
  const idMatch=txt.match(/\|\s*`id`\s*\|\s*([^\n|]+)/);
  const loMatch=txt.match(/\|\s*`learning_objective_id`\s*\|\s*`([^`]+)`/);
  if(!idMatch||!loMatch) continue;
  rows.push({epId:idMatch[1].trim(), loCode:loMatch[1].trim(), file:f});
}
const out=execSync('cd dashboard/api && npx wrangler d1 execute majarra-db --local --command "SELECT id FROM episodes" 2>&1',{encoding:'utf8'});
const dbIds=new Set([...out.matchAll(/"id":\s*"([^"]+)"/g)].map(x=>x[1]).filter(s=>s.startsWith('episode')));
console.log('docs parsed',rows.length,'dbIds',dbIds.size);
const missing=rows.filter(r=>!dbIds.has(r.epId));
console.log('missing episodes not in DB',missing.length);
console.log(missing.slice(0,12).map(r=>r.epId).join('\n'));
console.log('--- present ---',rows.filter(r=>dbIds.has(r.epId)).length);
