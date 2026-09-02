import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = "F:\\Projects\\cartoonapp";
const API_DIR = path.join(ROOT,'dashboard','api');

function r2put(bucket, filePath, key, contentType) {
  const cmd = `npx --yes wrangler r2 object put ${bucket} --file="${filePath}" --key="${key}" --content-type="${contentType}" --remote`;
  console.log(`PUT ${bucket} ${key} <- ${path.basename(filePath)}`);
  try {
    const out = execSync(cmd, { cwd: API_DIR, encoding:'utf-8', timeout: 30000 });
    const ok = out.includes('Created') || out.includes('Uploaded') || out.includes('Object');
    console.log(ok ? `  OK ${key}` : `  ? ${out.slice(0,300)}`);
    return ok;
  } catch (e) {
    console.log(`  FAIL ${key}: ${e.message.slice(0,300)}`);
    return false;
  }
}

console.log('=== Upload Wave4 covers to thumbs ===');
const wave4Dir = path.join(ROOT,'tools','playveo','output','wave4');
const covers = [];
function walk(d) {
  for (const e of fs.readdirSync(d, {withFileTypes:true})) {
    const p=path.join(d,e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('cover.jpg')) covers.push(p);
  }
}
walk(wave4Dir);
console.log(`Covers: ${covers.length}`);
let okCovers=0;
for (const src of covers) {
  const rel = path.relative(wave4Dir, src).split(path.sep)[0];
  const r2key = `public/catalog/assets/images/games/wave4/${rel}/cover.jpg`;
  if (r2put('majarra-thumbs', src, r2key, 'image/jpeg')) okCovers++;
}

console.log(`\n=== Upload WAVs to media (all ${covers.length} covers done: ${okCovers}) ===`);
const audioRoot = path.join(ROOT,'assets','audio','games');
const wavs=[];
function walkAudio(d) {
  for (const e of fs.readdirSync(d,{withFileTypes:true})) {
    const p=path.join(d,e.name);
    if (e.isDirectory()) walkAudio(p);
    else if (p.endsWith('.wav')) wavs.push(p);
  }
}
walkAudio(audioRoot);
console.log(`WAVs: ${wavs.length}`);

let okWavs=0;
for (const src of wavs) {
  const rel = path.relative(audioRoot, src).replace(/\\/g,'/');
  const r2key = `private/audio/games/${rel}`;
  if (r2put('majarra-media', src, r2key, 'audio/wav')) okWavs++;
}

console.log(`\n=== DONE covers ${okCovers}/${covers.length} wavs ${okWavs}/${wavs.length} ===`);

console.log('\n=== List R2 thumbs wave4 ===');
try {
  const out = execSync(`npx --yes wrangler r2 object list majarra-thumbs --prefix="public/catalog/assets/images/games/wave4"`, { cwd: API_DIR, encoding:'utf-8', timeout: 15000 });
  console.log(out.slice(0,3000));
} catch (e) { console.log('list thumbs fail', e.message.slice(0,300)); }

console.log('\n=== List R2 media private/audio/games (first) ===');
try {
  const out = execSync(`npx --yes wrangler r2 object list majarra-media --prefix="private/audio/games" --limit 100`, { cwd: API_DIR, encoding:'utf-8', timeout: 15000 });
  console.log(out.slice(0,4000));
} catch (e) { console.log('list media fail', e.message.slice(0,400)); }
