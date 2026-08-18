import fs from 'fs';
const key = fs.readFileSync('F:/Projects/cartoonapp/dashboard/api/.dev.vars','utf8').match(/PLAYVEO_API_KEY\s*=\s*(.+)/)[1].trim();
const base='https://playveo-api.aboessa101.workers.dev';
async function gen(prompt, label){
  console.log(`\n=== gen ${label} ===`);
  const res = await fetch(`${base}/v1/images/text-to-image`, {
    method:'POST', headers:{ 'Authorization': `Bearer ${key}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio:"1:1", count:1 })
  });
  const j = await res.json();
  console.log('create', res.status, j.id, j.status, j.model);
  if(!j.id) return null;
  for(let i=0;i<20;i++){
    await new Promise(r=>setTimeout(r,5000));
    const r2 = await fetch(`${base}/v1/images/${j.id}`, {headers:{Authorization:`Bearer ${key}`}});
    const j2 = await r2.json();
    const img = j2.image || j2;
    const status = img.status || j2.status;
    console.log(` poll ${i} ${status}`);
    if(status==='completed'){
      const urls = img.resultUrls || j2.resultUrls || [];
      console.log(' done', urls[0]);
      return {id:j.id, url:urls[0]};
    }
    if(status==='failed') { console.log('failed', JSON.stringify(j2).slice(0,300)); break; }
  }
  return null;
}

const brief = "child-friendly illustration clean silhouette readable forms minimal visual noise age 3-5 large objects 1:1 soft pastel vector white background consistent line weight";

const jobs = [
  ["طابق الصورة cover: two cute cats side by side identical, "+brief, "picture-match"],
  ["صنف الألوان cover: red apple and blue fish in colorful bins, "+brief, "color-sort"],
  ["عد وضع cover: 3 yellow stars countable on white, "+brief, "count-place"],
];

for(const [prompt,label] of jobs){
  const r = await gen(prompt,label);
  if(r && r.url){
    const res = await fetch(r.url);
    const buf = Buffer.from(await res.arrayBuffer());
    const tmp = `C:/Users/pc/AppData/Local/Temp/${label}.jpg`;
    fs.writeFileSync(tmp, buf);
    console.log(` saved ${tmp} ${buf.length}`);
    // upload to R2
    // use wrangler via child_process
    const {execSync} = await import('child_process');
    try{
      execSync(`npx wrangler r2 object put majarra-media/game-assets/wave1/${label}.jpg --file="${tmp}" --content-type="image/jpeg" --remote`, {cwd:'F:/Projects/cartoonapp/dashboard/api', stdio:'inherit'});
      execSync(`npx wrangler r2 object put majarra-media/game-assets/wave1/${label}.jpg --file="${tmp}" --content-type="image/jpeg"`, {cwd:'F:/Projects/cartoonapp/dashboard/api', stdio:'inherit'});
      const id = `asset-wave1-${label}`;
      const titleMap={ "picture-match":"طابق الصورة", "color-sort":"صنف الألوان", "count-place":"عد وضع"};
      const title = titleMap[label]||label;
      const sql = `INSERT OR REPLACE INTO content_assets (id, title_ar, kind, status, r2_key, bucket, mime_type, size_bytes, visibility, version) VALUES ('${id}','${title}','image','ready','game-assets/wave1/${label}.jpg','media','image/jpeg',${buf.length},'public',1)`;
      execSync(`npx wrangler d1 execute majarra-db --local --command "${sql}"`, {cwd:'F:/Projects/cartoonapp/dashboard/api', stdio:'inherit'});
      execSync(`npx wrangler d1 execute majarra-db --remote --env production --command "${sql}"`, {cwd:'F:/Projects/cartoonapp/dashboard/api', stdio:'inherit'});
      const linkSql = `INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order) VALUES ('link-${label}','${id}','game','game-wave1-${label}','cover','',1)`;
      execSync(`npx wrangler d1 execute majarra-db --local --command "${linkSql}"`, {cwd:'F:/Projects/cartoonapp/dashboard/api', stdio:'inherit'});
      execSync(`npx wrangler d1 execute majarra-db --remote --env production --command "${linkSql}"`, {cwd:'F:/Projects/cartoonapp/dashboard/api', stdio:'inherit'});
      console.log(` linked ${id}`);
    }catch(e){ console.log('upload error', e.message); }
  }
}
console.log('batch done');
