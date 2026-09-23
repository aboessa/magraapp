import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const API_DIR = path.join(ROOT, 'dashboard', 'api');
const ASSETS = path.join(ROOT, 'app_main', 'assets', 'images');
const OUT = path.join(ROOT, '.tmp_covers', 'heavy-webp');

function exec(cmd) {
  return execSync(cmd, { encoding: 'utf-8', timeout: 180000, maxBuffer: 10 * 1024 * 1024, cwd: API_DIR });
}

// Directories whose raster files migrate to R2 as WebP. SVG stays bundled
// (vector: ~60KB for 111 files — a network round trip buys nothing).
// R2 key mirrors the repo path: public/catalog/assets/images/<rel>.webp
const DIRS = [
  'draw_like_me/v2',
  'draw_like_me/v2-final',
  'draw_like_me/heroes',
  'landing',
  'coloring/v2',
  'books',
  'connect_dots',
  'games/wave',
];
// PNG/JPG sources convert to WebP twins; WebP sources re-encode (q82) to their
// CDN twin. The earlier raster-only filter silently skipped books/ (already
// WebP on disk) while heavyCdnUrl() derived URLs for them — a 404 gap the
// books uploader closed retroactively. Never skip .webp again.
const CONVERTIBLE = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const DRY = process.argv.includes('--dry');

function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(p, rel));
    else if (CONVERTIBLE.has(path.extname(e.name).toLowerCase())) out.push({ src: p, rel });
  }
  return out;
}

async function main() {
  const { default: sharp } = await import('sharp');
  let orig = 0, webpTotal = 0;
  const uploads = [];
  for (const d of DIRS) {
    const abs = path.join(ASSETS, d);
    if (!fs.existsSync(abs)) { console.log(`SKIP missing ${d}`); continue; }
    for (const { src, rel } of walk(abs)) {
      const buf = fs.readFileSync(src);
      orig += buf.length;
      const out = await sharp(buf).webp({ quality: 82 }).toBuffer();
      webpTotal += out.length;
      const webpRel = rel.replace(/\.(png|jpg|jpeg|webp)$/i, '.webp');
      const dest = path.join(OUT, d, webpRel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, out);
      const r2Key = `public/catalog/assets/images/${d}/${webpRel}`;
      uploads.push({ r2Key, dest, origRel: `${d}/${rel}` });
      console.log(`${(buf.length / 1024).toFixed(0)}K -> ${(out.length / 1024).toFixed(0)}K  ${r2Key}`);
    }
  }
  console.log(`\nTOTAL ${(orig / 1048576).toFixed(1)}MB -> ${(webpTotal / 1048576).toFixed(1)}MB (${uploads.length} files)`);
  // Manifest maps repo-relative bundled path -> CDN URL, consumed by the
  // Dart-side fallback rewrite and by tests.
  const manifest = {};
  for (const u of uploads) manifest[`assets/images/${u.origRel}`] = `https://cdn.majarra.app/${u.r2Key}`;
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`manifest: ${uploads.length} entries -> .tmp_covers/heavy-webp/manifest.json`);
  if (DRY) { console.log('DRY RUN: no uploads'); return; }
  for (const { r2Key, dest } of uploads) {
    console.log(`Upload ${r2Key}`);
    const out = exec(`npx --yes wrangler r2 object put "majarra-thumbs/${r2Key}" --file="${dest}" --content-type="image/webp" --remote`);
    console.log(out.slice(0, 160));
  }
  console.log('\nDone.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
