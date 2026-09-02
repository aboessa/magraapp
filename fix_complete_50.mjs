import { execSync } from 'node:child_process';
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync('tools/playveo/complete-drawing.manifest.json','utf8'));
const batchSize = 10;
for (let i=0; i<manifest.assets.length; i+=batchSize){
  const slice = manifest.assets.slice(i,i+batchSize);
  const values = slice.map(a=>{
    const diff = a.difficulty==='صعب'?'صعب':a.difficulty==='متوسط'?'متوسط':'سهل';
    return `('${a.id.replace(/'/g,"''")=='butterfly-01'?'complete-butterfly-01':`complete-${a.id}`.replace('complete-complete-','complete-')}','complete','${a.titleAr.replace(/'/g,"''")}','${a.titleEn.replace(/'/g,"''")}',4,5,'${diff}','complete-drawing/${a.id}/challenge.png','complete-drawing/${a.id}/thumbnail.jpg','{\"reference_full\":\"complete-drawing/${a.id}/reference_full.png\",\"group\":\"${a.group}\"}','ready',0,1,${a.order},'${a.group}','complete-${a.id}')`;
  });
  // Actually need correct ids: manifest ids already are butterfly-01 etc, but we want complete-butterfly-01
  const sqlValues = slice.map(a=>{
    const id = `complete-${a.id}`;
    const diff = a.difficulty;
    return `('${id}','complete','${a.titleAr}','${a.titleEn}',4,5,'${diff}','complete-drawing/${a.id}/challenge.png','complete-drawing/${a.id}/thumbnail.jpg','{\"reference_full\":\"complete-drawing/${a.id}/reference_full.png\"}','ready',0,1,${a.order},'${a.group}','${id}')`;
  }).join(',\n');
  const sql = `INSERT OR IGNORE INTO creative_drawings (id, category, title_ar, title_en, age_min, age_max, difficulty, r2_key, thumb_r2_key, extra_json, status, is_featured, is_new, sort_order, tags, asset_id) VALUES \n${sqlValues};`;
  fs.writeFileSync('/tmp/batch.sql', sql);
  console.log(`\n--- batch ${i/batchSize+1}: ${slice.map(s=>s.id).join(', ')}`);
  try {
    const out = execSync(`npx wrangler d1 execute majarra-db --local --file /tmp/batch.sql`, {cwd: 'dashboard/api', encoding: 'utf8'});
    console.log(out.slice(0,500));
  } catch(e){ console.error(e.stdout?.toString().slice(0,800) || e.message); }
}
const count = execSync(`npx wrangler d1 execute majarra-db --local --command "SELECT COUNT(*) as c FROM creative_drawings WHERE category='complete';"`, {cwd: 'dashboard/api', encoding:'utf8'});
console.log(count.toString().slice(-500));
