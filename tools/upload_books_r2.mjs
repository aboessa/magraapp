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

// Books were already WebP on disk, so upload_heavy_r2.mjs skipped them
// (raster-only filter). But heavyCdnUrl() derives a CDN twin for every
// raster under assets/images/books/ — including .webp sources. Upload the
// q82 re-encoded twins so the derived URLs resolve.
const DRY = process.argv.includes('--dry');

async function main() {
  const { default: sharp } = await import('sharp');
  const dir = path.join(ROOT, 'app_main', 'assets', 'images', 'books');
  const out = path.join(ROOT, '.tmp_covers', 'books-webp');
  fs.mkdirSync(out, { recursive: true });
  const uploads = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.webp')) continue;
    const buf = fs.readFileSync(path.join(dir, f));
    const webp = await sharp(buf).webp({ quality: 82 }).toBuffer();
    const dest = path.join(out, f);
    fs.writeFileSync(dest, webp);
    const r2Key = `public/catalog/assets/images/books/${f}`;
    uploads.push({ r2Key, dest });
    console.log(`${(buf.length / 1024).toFixed(0)}K -> ${(webp.length / 1024).toFixed(0)}K  ${r2Key}`);
  }
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
