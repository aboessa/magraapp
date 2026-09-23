import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const API_DIR = path.join(ROOT, 'dashboard', 'api');

function exec(cmd) {
  return execSync(cmd, { encoding: 'utf-8', timeout: 180000, maxBuffer: 10 * 1024 * 1024, cwd: API_DIR });
}

// Catalog chrome: planets, series posters/banners, top-level game covers,
// episodes, explore, seasonal. Already WebP on disk; upload q82 twins under
// the same mirrored key so heavyCdnUrl() resolves for them.
const DIRS = [
  'planets',
  'series/posters',
  'series/banners',
  'episodes',
  'explore',
  'seasonal',
];

const DRY = process.argv.includes('--dry');

async function main() {
  const { default: sharp } = await import('sharp');
  const base = path.join(ROOT, 'app_main', 'assets', 'images');
  const outBase = path.join(ROOT, '.tmp_covers', 'catalog-webp');
  fs.mkdirSync(outBase, { recursive: true });
  const uploads = [];
  async function walk(rel) {
    const abs = path.join(base, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const p = path.join(abs, e.name);
      const key = `${rel}/${e.name}`;
      if (e.isDirectory()) { await walk(key); continue; }
      if (!e.name.endsWith('.webp')) continue;
      const buf = fs.readFileSync(p);
      const webp = await sharp(buf).webp({ quality: 82 }).toBuffer();
      const dest = path.join(outBase, key);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, webp);
      uploads.push({ r2Key: `public/catalog/assets/images/${key}`, dest });
      console.log(`${(buf.length / 1024).toFixed(0)}K -> ${(webp.length / 1024).toFixed(0)}K  ${key}`);
    }
  }
  // games top-level only (wave/ already uploaded by upload_heavy_r2.mjs)
  const gamesDir = path.join(base, 'games');
  for (const e of fs.readdirSync(gamesDir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.webp')) continue;
    const buf = fs.readFileSync(path.join(gamesDir, e.name));
    const webp = await sharp(buf).webp({ quality: 82 }).toBuffer();
    const dest = path.join(outBase, 'games', e.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, webp);
    uploads.push({ r2Key: `public/catalog/assets/images/games/${e.name}`, dest });
    console.log(`${(buf.length / 1024).toFixed(0)}K -> ${(webp.length / 1024).toFixed(0)}K  games/${e.name}`);
  }
  for (const d of DIRS) await walk(d);
  console.log(`\nTOTAL ${uploads.length} files`);
  if (DRY) { console.log('DRY RUN: no uploads'); return; }
  for (const { r2Key, dest } of uploads) {
    console.log(`Upload ${r2Key}`);
    const o = exec(`npx --yes wrangler r2 object put "majarra-thumbs/${r2Key}" --file="${dest}" --content-type="image/webp" --remote`);
    console.log(o.slice(0, 160));
  }
  console.log('\nDone.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
