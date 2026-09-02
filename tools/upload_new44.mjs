import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = "F:\\Projects\\cartoonapp";
const API_DIR = path.join(ROOT, 'dashboard','api');

function r2put(bucket, key, filePath, ct) {
  const objectPath = `${bucket}/${key}`;
  const cmd = `npx --yes wrangler r2 object put "${objectPath}" --file="${filePath}" --content-type="${ct}" --remote`;
  try {
    const out = execSync(cmd, { cwd: API_DIR, encoding:'utf-8', timeout: 35000 });
    console.log(`OK ${key}`);
    return true;
  } catch (e) {
    console.log(`FAIL ${key}: ${e.message.slice(0,200)}`);
    return false;
  }
}

const twoHoursAgo = Date.now() - 2*60*60*1000;
const wavs = [];
function walk(d){
  for (const e of fs.readdirSync(d, {withFileTypes:true})) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.wav') && fs.statSync(p).mtimeMs > twoHoursAgo) wavs.push(p);
  }
}
walk(path.join(ROOT,'assets','audio','games'));
console.log(`Recent WAVs (last 2h): ${wavs.length}`);

let ok=0;
for (const src of wavs) {
  const rel = path.relative(path.join(ROOT,'assets','audio','games'), src).replace(/\\/g,'/');
  const r2key = `private/audio/games/${rel}`;
  if (r2put('majarra-media', r2key, src, 'audio/wav')) ok++;
}
console.log(`Done ${ok}/${wavs.length} new wavs uploaded`);

console.log('\nDeploy API...');
try {
  const out = execSync(`npx --yes wrangler deploy --env production`, { cwd: API_DIR, encoding:'utf-8', timeout: 90000 });
  console.log(out.slice(-1500));
} catch (e) {
  console.log(e.stdout?.toString().slice(-1000) ?? e.message.slice(0,800));
}

console.log('\nVerify D1 remote published count');
try {
  const out = execSync(`npx --yes wrangler d1 execute majarra-db --remote --command "SELECT count(*) as published FROM games WHERE status='published';"`, { cwd: API_DIR, encoding:'utf-8', timeout: 20000 });
  console.log(out.slice(0,2000));
} catch (e) { console.log(e.message.slice(0,500)); }
