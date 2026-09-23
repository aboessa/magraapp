import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const API_DIR = path.join(ROOT, 'dashboard', 'api');
const AVATARS = path.join(ROOT, 'app_main', 'assets', 'avatars');
const OUT = path.join(ROOT, '.tmp_covers', 'avatars-webp');

function exec(cmd) {
  return execSync(cmd, { encoding: 'utf-8', timeout: 120000, maxBuffer: 10 * 1024 * 1024, cwd: API_DIR });
}

// Used avatar files: parsed from app_main/lib/features/child/presentation/widgets/child_avatars.dart
// plus the pubspec-declared set. Keep in sync with ChildAvatars.all.
const USED = [
  'characters/addaad-celebrating.png',
  'characters/addaad-happy.png',
  'characters/addaad-learning.png',
  'characters/luna-excited.png',
  'characters/luna-full.png',
  'characters/luna-happy.png',
  'characters/nouma-full.png',
  'characters/nouma-happy.png',
  'characters/nouma-thinking.png',
  'characters/robo-analytical.png',
  'characters/robo-success.png',
  'characters/salma-full.png',
  'characters/yaseen-front.png',
  'characters/yaseen-full.png',
  'characters/yaseen-highfive.png',
  'characters/zaina-front.png',
  'characters/zaina-full.png',
  'characters/zaina-jump.png',
  'planets/abjad.png',
  'planets/arqam.png',
  'planets/maharat.png',
  'planets/oloom.png',
  'planets/qisas.png',
  'planets/qiyam.png',
];

const DRY = process.argv.includes('--dry');

async function main() {
  const { default: sharp } = await import('sharp');
  fs.mkdirSync(OUT, { recursive: true });
  let pngTotal = 0, webpTotal = 0;
  const keys = [];
  for (const rel of USED) {
    const src = path.join(AVATARS, rel);
    const base = path.basename(rel, '.png');
    const sub = path.dirname(rel); // characters | planets
    const destDir = path.join(OUT, sub);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, `${base}.webp`);
    const buf = fs.readFileSync(src);
    pngTotal += buf.length;
    const webp = await sharp(buf).webp({ quality: 85 }).toBuffer();
    webpTotal += webp.length;
    fs.writeFileSync(dest, webp);
    // R2 key mirrors the CDN convention used by _wave4CdnCover:
    // public/avatars/<sub>/<id>.webp
    const r2Key = `public/avatars/${sub}/${base}.webp`;
    keys.push({ r2Key, dest });
    console.log(`${(buf.length / 1024).toFixed(0)}K -> ${(webp.length / 1024).toFixed(0)}K  ${r2Key}`);
  }
  console.log(`\nTOTAL png ${(pngTotal / 1048576).toFixed(1)}MB -> webp ${(webpTotal / 1048576).toFixed(1)}MB`);
  if (DRY) { console.log('DRY RUN: no uploads'); return; }
  for (const { r2Key, dest } of keys) {
    console.log(`Upload ${r2Key}`);
    const out = exec(`npx --yes wrangler r2 object put "majarra-thumbs/${r2Key}" --file="${dest}" --content-type="image/webp" --remote`);
    console.log(out.slice(0, 200));
  }
  console.log('\nDone. Verify: https://cdn.majarra.app/public/avatars/characters/luna-full.webp');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
