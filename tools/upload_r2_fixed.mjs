import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = "F:\\Projects\\cartoonapp";
const API_DIR = path.join(ROOT, 'dashboard','api');

function r2put(bucket, key, filePath, contentType) {
  // New wrangler v4 syntax: bucket/key as single objectPath positional
  const objectPath = `${bucket}/${key}`;
  const cmd = `npx --yes wrangler r2 object put "${objectPath}" --file="${filePath}" --content-type="${contentType}" --remote`;
  console.log(`PUT ${objectPath} <- ${path.basename(filePath)}`);
  try {
    const out = execSync(cmd, { cwd: API_DIR, encoding:'utf-8', timeout: 35000 });
    const ok = out.includes('Created') || out.includes('Uploaded') || out.includes('success');
    console.log(ok ? `  OK` : `  output: ${out.slice(0,400)}`);
    return true;
  } catch (e) {
    console.log(`  FAIL: ${e.message.slice(0,400)}`);
    console.log((e.stdout?.toString() ?? '').slice(0,400));
    return false;
  }
}

console.log('=== Upload Wave4 covers to thumbs ===');
const wave4Dir = path.join(ROOT,'tools','playveo','output','wave4');
const covers=[];
function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(p.endsWith('.jpg')) covers.push(p); } }
try{ walk(wave4Dir); }catch{}
console.log(`Covers: ${covers.length}`);
let okCovers=0;
for (const src of covers) {
  const gameSlug = path.relative(wave4Dir, src).split(path.sep)[0];
  const r2key = `public/catalog/assets/images/games/wave4/${gameSlug}/cover.jpg`;
  if (r2put('majarra-thumbs', r2key, src, 'image/jpeg')) okCovers++;
}

console.log(`\n=== Upload WAVs to media (${okCovers}/${covers.length} covers ok) ===`);
const audioRoot = path.join(ROOT,'assets','audio','games');
const wavs=[];
function walkAudio(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walkAudio(p); else if(p.endsWith('.wav')) wavs.push(p); } }
walkAudio(audioRoot);
console.log(`WAVs: ${wavs.length}`);
let okWavs=0;
for (const src of wavs) {
  const rel = path.relative(audioRoot, src).replace(/\\/g,'/');
  const r2key = `private/audio/games/${rel}`;
  if (r2put('majarra-media', r2key, src, 'audio/wav')) okWavs++;
}

console.log(`\n=== DONE covers ${okCovers}/${covers.length} wavs ${okWavs}/${wavs.length} ===`);
