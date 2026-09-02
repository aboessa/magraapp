import fs from 'fs'; import os from 'os'; import path from 'path'; import { execSync } from 'child_process';
const ROOT='F:\\Projects\\cartoonapp';
const key=fs.readFileSync(path.join(os.homedir(),'.majarra','playveo.key'),'utf8').trim();
const BASE='https://playveo-api.aboessa101.workers.dev';
const jobsPath=path.join(ROOT,'tools','playveo','games-unique-covers-jobs.json');
const jobs=JSON.parse(fs.readFileSync(jobsPath,'utf8'));

async function check(id){
  const r=await fetch(BASE+'/v1/images/'+id,{headers:{Authorization:'Bearer '+key}}).then(x=>x.json());
  return r.image||r;
}

async function dl(url,dest){
  const res=await fetch(url);
  if(!res.ok) throw new Error('dl '+res.status);
  const buf=Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,buf);
  console.log('DL',dest,buf.length);
  return dest;
}

for(const [gid,info] of Object.entries(jobs)){
  const st=await check(info.id);
  console.log(gid, st.status, (st.error||'').slice(0,60), st.resultUrls?.length||0);
  if(st.status==='completed' && st.resultUrls?.[0]){
    const local=path.join(ROOT,'majarra_images','assets','games',gid,'cover.jpg');
    if(!fs.existsSync(local)){
      await dl(st.resultUrls[0],local);
    }
    // upload remote
    try{
      execSync(`npx wrangler r2 object put majarra-thumbs/public/games/${gid}/cover.jpg --remote --file="${local}" --content-type=image/jpeg`,{cwd:path.join(ROOT,'dashboard','api'),stdio:'inherit',timeout:120000});
      jobs[gid].status='completed';
      jobs[gid].resultUrls=st.resultUrls;
      jobs[gid].localPath=local;
      fs.writeFileSync(jobsPath,JSON.stringify(jobs,null,2));
    }catch(e){ console.error('UPLOAD FAIL',gid,e.message); }
  }
  await new Promise(r=>setTimeout(r,600));
}
console.log('Poll done');
