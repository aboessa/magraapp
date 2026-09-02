import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = "F:\\Projects\\cartoonapp";
const API_DIR = path.join(ROOT, 'dashboard','api');

function exec(cmd, opts={}) {
  try {
    return execSync(cmd, { encoding:'utf-8', timeout: 60000, maxBuffer: 10*1024*1024, ...opts });
  } catch (e) {
    console.log(`FAIL cmd: ${cmd.slice(0,200)} -> ${e.message.slice(0,600)}`);
    console.log((e.stdout?.toString() ?? '').slice(0,1000));
    console.log((e.stderr?.toString() ?? '').slice(0,1000));
    throw e;
  }
}

console.log('=== Step 1: Upload 11 Wave4 covers to majarra-thumbs (public) ===');
const wave4Dir = path.join(ROOT, 'tools','playveo','output','wave4');
const covers = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.jpg') && p.includes('source/cover.jpg')) covers.push(p);
  }
}
walk(wave4Dir);
console.log(`Found ${covers.length} covers`);

for (const srcPath of covers) {
  const rel = path.relative(wave4Dir, srcPath); // e.g. match-nature-3/source/cover.jpg
  const gameSlug = rel.split(path.sep)[0]; // match-nature-3
  const r2Key = `public/catalog/assets/images/games/wave4/${gameSlug}/cover.jpg`;
  console.log(`\nUpload ${rel} -> ${r2Key}`);
  try {
    const cmd = `npx --yes wrangler r2 object put majarra-thumbs --file="${srcPath}" --key="${r2Key}" --content-type="image/jpeg" --remote`;
    const out = exec(cmd, { cwd: API_DIR });
    console.log(out.slice(0, 500));
  } catch (e) {
    console.log(`  skip or fail ${r2Key}, will retry`);
  }
}

console.log('\n=== Step 2: Upload 106 WAVs to majarra-media (private) ===');
const audioRoot = path.join(ROOT, 'assets','audio','games');
const wavs = [];
function walkAudio(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkAudio(p);
    else if (p.endsWith('.wav')) wavs.push(p);
  }
}
walkAudio(audioRoot);
console.log(`Found ${wavs.length} wavs`);

for (const srcPath of wavs) {
  const rel = path.relative(audioRoot, srcPath).replace(/\\/g,'/'); // e.g. count-quantity/ar/vo-count-1-ar.wav
  const r2Key = `private/audio/games/${rel}`;
  // skip if already uploaded recently (we will just attempt)
  console.log(`\nUpload ${rel} -> ${r2Key}`);
  try {
    const cmd = `npx --yes wrangler r2 object put majarra-media --file="${srcPath}" --key="${r2Key}" --content-type="audio/wav" --remote`;
    const out = exec(cmd, { cwd: API_DIR });
    console.log(out.slice(0, 400));
  } catch (e) {
    console.log(`  fail ${r2Key}`);
  }
}

console.log('\n=== Step 3: Register content_assets for uploaded files (remote D1) ===');

const assetRegs = [];
// Wave4 images
for (const srcPath of covers) {
  const gameSlug = path.relative(wave4Dir, srcPath).split(path.sep)[0];
  const id = `asset-wave4-${gameSlug}-cover`;
  const r2Key = `public/catalog/assets/images/games/wave4/${gameSlug}/cover.jpg`;
  assetRegs.push({ id, kind:'image', status:'ready', visibility:'public', source:'generated', title:`غلاف ${gameSlug}`, r2_key:r2Key, bucket:'thumbs', mime:'image/jpeg', expected_path:r2Key });
}
// Audio
for (const srcPath of wavs) {
  const rel = path.relative(audioRoot, srcPath).replace(/\\/g,'/');
  // rel like count-quantity/ar/vo-count-1-ar.wav
  const parts = rel.split('/');
  const safeId = `asset-vo-${parts[0]}-${path.basename(rel, '.wav')}`.replace(/[^A-Za-z0-9_-]/g,'-').slice(0,100);
  const r2Key = `private/audio/games/${rel}`;
  assetRegs.push({ id: safeId, kind:'audio', status:'ready', visibility:'private', source:'generated', title:path.basename(rel), r2_key:r2Key, bucket:'media', mime:'audio/wav', expected_path:r2Key, likeRel: rel });
}

console.log(`Registering ${assetRegs.length} assets into D1 remote...`);
// Build SQL inserts in batches of 20
const batches = [];
for (let i=0;i<assetRegs.length;i+=20) batches.push(assetRegs.slice(i,i+20));

for (let b=0;b<batches.length;b++) {
  const batch = batches[b];
  const values = batch.map(a => {
    const id = a.id.replace(/'/g, "''");
    const title = a.title.replace(/'/g, "''");
    const r2 = a.r2_key.replace(/'/g, "''");
    const bucket = a.bucket;
    const mime = a.mime;
    const exp = a.expected_path.replace(/'/g, "''");
    return `('${id}','${a.kind}','${a.status}','${a.visibility}','${a.source}','${exp}','${title}','${r2}','${bucket}','${mime}','2026-08-23T00:00:00Z')`;
  }).join(',\n');
  const sql = `INSERT OR IGNORE INTO content_assets (id, kind, status, visibility, source, expected_path, title_ar, r2_key, bucket, mime_type, created_at) VALUES\n${values};`;
  const tmpPath = `C:\\Temp\\assets_batch_${b}.sql`;
  fs.writeFileSync(tmpPath, sql);
  console.log(`\nBatch ${b+1}/${batches.length} (${batch.length} assets) -> ${tmpPath}`);
  try {
    const out = exec(`npx --yes wrangler d1 execute majarra-db --remote --file="${tmpPath}"`, { cwd: API_DIR });
    console.log(out.slice(0, 1200));
  } catch (e) {
    console.log(`  batch ${b} fail, will continue`);
  }
}

console.log('\n=== Step 4: Verify remote assets count ===');
try {
  const out = exec(`npx --yes wrangler d1 execute majarra-db --remote --command "SELECT visibility, kind, count(*) as c FROM content_assets WHERE id LIKE 'asset-wave4-%' OR id LIKE 'asset-vo-%' GROUP BY visibility, kind;"`, { cwd: API_DIR });
  console.log(out.slice(0, 3000));
} catch (e) {
  console.log('verify fail', e.message.slice(0,500));
}

console.log('\n=== Step 5: Also local verification ===');
try {
  const out = exec(`npx --yes wrangler d1 execute majarra-db --local --command "SELECT visibility, kind, count(*) as c FROM content_assets WHERE id LIKE 'asset-wave4-%' OR id LIKE 'asset-vo-%' GROUP BY visibility, kind;"`, { cwd: API_DIR });
  console.log(out.slice(0, 3000));
} catch {}

console.log('\nDone upload_all_r2');
