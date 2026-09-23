import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const API_DIR = path.join(ROOT, 'dashboard', 'api');

function exec(cmd) {
  return execSync(cmd, { encoding: 'utf-8', timeout: 120000, maxBuffer: 10 * 1024 * 1024, cwd: API_DIR });
}

// Studio banner PNG twins: the 6 banners whose bundled webp paints instantly
// while the CDN twin loads via disk cache (`heavyStudioBannerUrl` gate).
// Cards (8-20KB) stay bundled-only: no twin, no URL, no upload.
const BANNERS = [
  'coloring-banner.png',
  'connect-dots-banner.png',
  'draw-like-me-banner.png',
  'studio-main-banner.png',
  'homebgaart.png',
];

const DRY = process.argv.includes('--dry');

async function main() {
  const { default: sharp } = await import('sharp');
  const srcDir = path.join(ROOT, 'app_main', 'assets', 'images', 'studio');
  const out = path.join(ROOT, '.tmp_covers', 'studio-banners');
  fs.mkdirSync(out, { recursive: true });
  const uploads = [];
  for (const f of BANNERS) {
    const buf = fs.readFileSync(path.join(srcDir, f));
    const webp = await sharp(buf).webp({ quality: 82 }).toBuffer();
    const name = f.replace(/\.png$/i, '.webp');
    const dest = path.join(out, name);
    fs.writeFileSync(dest, webp);
    const r2Key = `public/catalog/assets/images/studio/${name}`;
    uploads.push({ r2Key, dest });
    console.log(`${(buf.length / 1024).toFixed(0)}K -> ${(webp.length / 1024).toFixed(0)}K  ${r2Key}`);
  }
  if (DRY) { console.log('DRY RUN: no uploads'); return; }
  for (const { r2Key, dest } of uploads) {
    console.log(`Upload ${r2Key}`);
    const o = exec(`npx --yes wrangler r2 object put "majarra-thumbs/${r2Key}" --file="${dest}" --content-type="image/webp" --remote`);
    console.log(o.slice(0, 160));
  }
  console.log('\nDone.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
