import fs from 'fs';
import { execSync } from 'child_process';
const manifest = JSON.parse(fs.readFileSync('tools/playveo/draw-like-me-50.manifest.json','utf8'));
const outRoot = 'assets/images/draw_like_me/v2-final';

for (const a of manifest.assets) {
  const localPath = `${outRoot}/${a.id}.png`;
  if (!fs.existsSync(localPath)) {
    console.log(`SKIP missing ${localPath}`);
    continue;
  }
  const keyMain = a.r2_key;
  const keyThumb = a.thumb_r2_key;
  // main
  console.log(`Uploading ${a.id} -> ${keyMain}`);
  try {
    execSync(`npx wrangler r2 object put majarra-thumbs/${keyMain} --file "${localPath}" --remote`, {stdio: 'inherit'});
  } catch(e){ console.error(`failed main ${a.id}`, e.message); }
  // thumb (same file)
  console.log(`Uploading thumb ${a.id} -> ${keyThumb}`);
  try {
    execSync(`npx wrangler r2 object put majarra-thumbs/${keyThumb} --file "${localPath}" --remote`, {stdio: 'inherit'});
  } catch(e){ console.error(`failed thumb ${a.id}`, e.message); }
}
// hero
const heroLocal = 'assets/images/draw_like_me/v2-final/animal-01-bird-branch.png'; // use first as hero placeholder if real hero not exists
const heroKey = 'public/studio/heroes/draw-like-me-hero.webp';
console.log(`Uploading hero -> ${heroKey}`);
try {
  execSync(`npx wrangler r2 object put majarra-thumbs/${heroKey} --file "${heroLocal}" --remote`, {stdio: 'inherit'});
} catch(e){ console.error('hero failed', e.message); }

console.log('Done');
