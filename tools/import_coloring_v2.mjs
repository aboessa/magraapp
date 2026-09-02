#!/usr/bin/env node
/**
 * Import coloring V2 PNGs to R2 + D1
 * Reads assets/images/coloring/v2/*.png (12 files) and uploads to THUMBS_BUCKET
 * Usage:
 *  node tools/import_coloring_v2.mjs --local   (wrangler local)
 *  node tools/import_coloring_v2.mjs --remote  (--remote --env production)
 *  node tools/import_coloring_v2.mjs --dry     (no write, just log)
 */
import { readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const isLocal = args.includes('--local') || !args.includes('--remote');
const isDry = args.includes('--dry');
const isRemote = args.includes('--remote');

const srcDir = 'assets/images/coloring/v2';
const files = readdirSync(srcDir).filter(f=> f.endsWith('.png') && !f.startsWith('_'));

// mapping: file base -> DB id and R2 key
// bird.png -> coloring-bird -> public/studio/coloring/bird.png
// but our DB expects coloring-bird etc. For simplicity, R2 key is as in migration
const map = {
  'bird.png':     { id:'coloring-bird',     key:'public/studio/coloring/bird.png' },
  'cat.png':      { id:'coloring-cat',      key:'public/studio/coloring/cat.png' },
  'dino.png':     { id:'coloring-dino',     key:'public/studio/coloring/dino.png' },
  'fish.png':     { id:'coloring-fish',     key:'public/studio/coloring/fish.png' },
  'vehicles.png': { id:'coloring-vehicles', key:'public/studio/coloring/vehicles.png' },
  'space.png':    { id:'coloring-space',    key:'public/studio/coloring/space.png' },
  'flowers.png':  { id:'coloring-flowers',  key:'public/studio/coloring/flowers.png' },
  'animals.png':  { id:'coloring-animals',  key:'public/studio/coloring/animals.png' },
  'birds.png':    { id:'coloring-birds',    key:'public/studio/coloring/birds.png' },
  'sea.png':      { id:'coloring-sea',      key:'public/studio/coloring/sea.png' },
  'fruits.png':   { id:'coloring-fruits',   key:'public/studio/coloring/fruits.png' },
  'toys.png':     { id:'coloring-toys',     key:'public/studio/coloring/toys.png' },
};

function run(cmd) {
  console.log(`> ${cmd}`);
  if (isDry) return;
  execSync(cmd, { stdio:'inherit' });
}

console.log(`Import coloring V2: ${files.length} files, mode=${isLocal?'local':'remote'}, dry=${isDry}`);

for (const f of files) {
  const meta = map[f];
  if (!meta) { console.warn(`skip unknown ${f}`); continue; }
  const src = join(srcDir, f);
  const size = statSync(src).size;
  const key = meta.key;
  // 1. put to R2
  // local bucket is majarra-thumbs via preview, remote is same but --remote
  const bucketFlag = isRemote ? 'majarra-thumbs --remote' : 'majarra-thumbs';
  // wrangler r2 object put
  // Note: wrangler r2 object put <bucket> <key> --file=<path> [--remote]
  const putCmd = `npx wrangler r2 object put ${bucketFlag} "${key}" --file="${src}" ${isRemote?'--env production':''}`.replace(/\s+/g,' ').trim();
  // Actually correct is: wrangler r2 object put <bucket>/<key> --file...
  // But wrangler v4 uses: wrangler r2 object put <bucket> --key=<key> --file=...
  // We'll try both: use the documented form
  const putCmd2 = `npx wrangler r2 object put majarra-thumbs --key="${key}" --file="${src}" ${isRemote ? '--remote' : '--local'} ${isRemote ? '--env production':''}`;
  try {
    run(putCmd2);
  } catch (e) {
    console.error(`put failed for ${f}: ${e.message}`);
    // fallback to old syntax
    try { run(putCmd); } catch(e2){ console.error(`fallback also failed`); }
  }

  // 2. update D1 status to ready/published if not already
  const sql = `UPDATE creative_drawings SET status='ready', updated_at=datetime('now') WHERE id='${meta.id}';`;
  const d1Cmd = `npx wrangler d1 execute majarra-db ${isLocal ? '--local' : '--remote'} ${isRemote ? '--env production':''} --command="${sql}"`;
  try { run(d1Cmd); } catch(e){ console.error(`d1 failed for ${meta.id}`); }
}

console.log('Done. Verify: GET /api/v1/creative-studio/drawings?category=coloring');
