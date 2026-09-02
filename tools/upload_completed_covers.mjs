import fs from 'fs'; import os from 'os'; import path from 'path'; import { execSync } from 'child_process';
const ROOT='F:\\Projects\\cartoonapp';
const key=fs.readFileSync(path.join(os.homedir(),'.majarra','playveo.key'),'utf8').trim();
const BASE='https://playveo-api.aboessa101.workers.dev';
const jobsPath=path.join(ROOT,'tools','playveo','games-unique-covers-jobs.json');
const jobs=JSON.parse(fs.readFileSync(jobsPath,'utf8'));

function dl(url,dest){
  return fetch(url).then(async r=>{
    if(!r.ok) throw new Error('dl '+r.status);
    const buf=Buffer.from(await r.arrayBuffer());
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,buf);
    console.log('DOWNLOADED',dest,buf.length);
    return dest;
  });
}

async function main(){
  for(const [gid,info] of Object.entries(jobs)){
    if(!info.id) continue;
    const res=await fetch(BASE+'/v1/images/'+info.id,{headers:{Authorization:'Bearer '+key}}).then(r=>r.json());
    const im=res.image||res;
    if(im.status!=='completed' || !im.resultUrls?.[0]) { console.log('SKIP',gid,im.status); continue; }
    const url=im.resultUrls[0];
    const local=path.join(ROOT,'majarra_images','assets','games',gid,'cover.jpg');
    // download if not exists
    if(!fs.existsSync(local)){
      await dl(url,local);
    } else {
      console.log('EXISTS',local);
    }
    const r2Key=`public/games/${gid}/cover.jpg`;
    try{
      console.log('UPLOAD',r2Key);
      execSync(`npx wrangler r2 object put majarra-thumbs/${r2Key} --file="${local}" --content-type=image/jpeg`,{cwd:path.join(ROOT,'dashboard','api'),stdio:'inherit',timeout:120000});
      jobs[gid].status='completed';
      jobs[gid].resultUrls=im.resultUrls;
      jobs[gid].localPath=local;
    }catch(e){ console.error('UPLOAD FAIL',gid,e.message); }
    await new Promise(r=>setTimeout(r,500));
  }
  fs.writeFileSync(jobsPath,JSON.stringify(jobs,null,2));
  console.log('Done upload completed covers');
}
main();
