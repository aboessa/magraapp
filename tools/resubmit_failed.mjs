import fs from 'fs'; import os from 'os'; import path from 'path';
const ROOT='F:\\Projects\\cartoonapp';
const key=fs.readFileSync(path.join(os.homedir(),'.majarra','playveo.key'),'utf8').trim();
const BASE='https://playveo-api.aboessa101.workers.dev';
const jobsPath=path.join(ROOT,'tools','playveo','games-unique-covers-jobs.json');
const jobs=JSON.parse(fs.readFileSync(jobsPath,'utf8'));

const FAILED = ["game-wave1-memory-animals","game-wave1-picture-match","game-wave1-color-sort","game-wave1-count-place","game-wave1-sequence-kids","game-wave1-word-kids","game-wave1-block-code","game-wave2-match-2","game-wave2-sort-junior","game-wave2-count-drag","game-sequence-daily-3b","game-shape-matching","game-butterfly-sequence"];

async function submit(prompt){
  const res=await fetch(BASE+'/v1/images/text-to-image',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({prompt,aspect_ratio:'4:3',count:1})});
  const data=await res.json();
  if(!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

for(const gid of FAILED){
  const info=jobs[gid];
  if(!info) continue;
  console.log('RESUBMIT',gid);
  try{
    const data=await submit(info.prompt);
    jobs[gid]={id:data.id,status:data.status||'pending',prompt:info.prompt,submittedAt:new Date().toISOString()};
    console.log('->',data.id,data.status);
    fs.writeFileSync(jobsPath,JSON.stringify(jobs,null,2));
    await new Promise(r=>setTimeout(r,2000));
  }catch(e){ console.error('FAIL',gid,e.message); }
}
console.log('Resubmit done');
