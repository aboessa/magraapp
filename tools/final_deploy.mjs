import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = "F:\\Projects\\cartoonapp";
const API_DIR = path.join(ROOT,'dashboard','api');

function exec(cmd, opts={}) {
  console.log(`$ ${cmd.slice(0,180)}...`);
  try {
    const out = execSync(cmd, { encoding:'utf-8', timeout: 40000, maxBuffer: 10*1024*1024, ...opts });
    console.log(out.slice(-600));
    return out;
  } catch (e) {
    console.log(`FAIL: ${e.message.slice(0,300)}`);
    console.log((e.stdout?.toString() ?? '').slice(-500));
    return null;
  }
}

console.log('=== Step 1: Remaining WAVs to R2 media (after 106 covers done) ===');
const audioRoot = path.join(ROOT,'assets','audio','games');
const wavs = [];
function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(p.endsWith('.wav')) wavs.push(p); } }
walk(audioRoot);
console.log(`Total wavs local: ${wavs.length}`);
// Upload remaining not yet uploaded (we know 16 + 15 done ~31, need rest ~75)
// For simplicity upload all again — wrangler put will overwrite cheap
for (const src of wavs) {
  const rel = path.relative(audioRoot, src).replace(/\\/g,'/');
  const r2key = `private/audio/games/${rel}`;
  const objectPath = `majarra-media/${r2key}`;
  // Quick put
  exec(`npx --yes wrangler r2 object put "${objectPath}" --file="${src}" --content-type="audio/wav" --remote`, { cwd: API_DIR });
}

console.log('\n=== Step 2: Deploy API production (to refresh tokens for new assets) ===');
exec(`npx --yes wrangler deploy --env production`, { cwd: API_DIR });

console.log('\n=== Step 3: Verify remote assets count and games ===');
exec(`npx --yes wrangler d1 execute majarra-db --remote --command "SELECT visibility, kind, count(*) as c FROM content_assets WHERE id LIKE 'asset-wave4-%' OR id LIKE 'asset-vo-%' GROUP BY visibility, kind;"`, { cwd: API_DIR });
exec(`npx --yes wrangler d1 execute majarra-db --remote --command "SELECT status, count(*) as c FROM games GROUP BY status;"`, { cwd: API_DIR });

console.log('\n=== Step 4: List R2 objects counts ===');
exec(`npx --yes wrangler r2 object list majarra-thumbs/public/catalog/assets/images/games/wave4`, { cwd: API_DIR });
exec(`npx --yes wrangler r2 object list majarra-media/private/audio/games`, { cwd: API_DIR });

console.log('\nDone final_deploy');
