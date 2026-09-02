import fs from 'fs';
import path from 'path';

const manifestPath = 'tools/playveo/draw-like-me-50.manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let sql = `-- 0067 draw_like_me 50 premium full-color references\n-- Master Style: ${manifest.master_style.slice(0,100)}...\nDELETE FROM creative_drawings WHERE category='draw_like_me';\nINSERT INTO creative_drawings (id, category, sub_category, title_ar, title_en, age_min, age_max, difficulty, r2_key, thumb_r2_key, transparent_r2_key, status, is_featured, is_new, sort_order, tags, asset_id) VALUES\n`;

const rows = manifest.assets.map(a => {
  const id = a.d1_id || a.id;
  const titleAr = a.title_ar.replace(/'/g, "''");
  const titleEn = (a.label || a.id).replace(/'/g, "''");
  const tags = (a.tags || '').replace(/'/g, "''");
  const sub = a.sub_category ? `'${a.sub_category}'` : 'NULL';
  const r2 = a.r2_key;
  const thumb = a.thumb_r2_key;
  const trans = a.r2_key; // use same as main for transparent (full color, no need transparent)
  const featured = a.sort_order <= 20 ? 1 : 0;
  const isNew = a.sort_order <= 10 ? 1 : 0;
  return `  ('${id}','${a.category}',${sub},'${titleAr}','${titleEn}',${a.age_min},${a.age_max},'${a.difficulty}','${r2}','${thumb}','${trans}','ready',${featured},${isNew},${a.sort_order},'${tags}','${a.id}')`;
});

sql += rows.join(',\n') + ';\n';

// hero
sql += `\nINSERT OR IGNORE INTO creative_drawings (id, category, title_ar, title_en, age_min, age_max, difficulty, r2_key, thumb_r2_key, transparent_r2_key, status, is_featured, is_new, sort_order, tags, asset_id) VALUES ('hero-draw-like-me','draw_like_me','ارسم مثلي — راقب ثم ارسم','Draw Like Me Hero',3,12,'سهل','public/studio/heroes/draw-like-me-hero.webp','public/studio/heroes/draw-like-me-hero.webp',NULL,'ready',1,1,0,'hero,ارسم مثلي','hero-draw-like-me');\n`;

fs.writeFileSync('dashboard/api/migrations/0067_draw_like_me_50.sql', sql, 'utf8');
console.log('SQL written to dashboard/api/migrations/0067_draw_like_me_50.sql');
console.log(sql.slice(0,1000));
