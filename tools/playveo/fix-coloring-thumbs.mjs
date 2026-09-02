#!/usr/bin/env node
/**
 * fix-coloring-thumbs.mjs — توليد ورفع مصغرات WebP لقسم "لون" (T1.1.3).
 *
 * المشكلة: publicCreativeStudio.ts يعلن thumb_r2_key لكل صف تلوين
 * (public/studio/coloring/thumbs/{name}.webp) لكن الملفات غير موجودة على R2،
 * فكل مصغرة ترجع 404 والتطبيق يضطر للرجوع للـ PNG الكامل (190-463KB لكل كرت).
 *
 * الحل: نفس نهج fix-content-types.mjs — WebP حقيقي عبر ffmpeg (عرض 512)
 * ورفعه بـ --content-type image/webp.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const FFMPEG = process.env.FFMPEG_PATH || 'F:\\tools\\ffmpeg\\ffmpeg.exe';
const SRC_DIR = path.join(ROOT, 'assets', 'images', 'coloring', 'v2');
const TMP_DIR = path.join(ROOT, 'assets', 'images', 'coloring', 'thumbs-webp');
const BUCKET = 'majarra-thumbs';
const DRY = process.argv.includes('--dry');

// نفس الأسماء الموجودة فعلاً على R2 كـ main PNG ومطابقة لصفوف D1 (coloring-{name})
const NAMES = [
  'bird', 'cat', 'dino', 'fish', 'vehicles', 'space',
  'flowers', 'animals', 'birds', 'sea', 'fruits', 'toys',
];

function put(key, file, type) {
  execFileSync(
    'npx',
    ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--content-type', type, '--remote'],
    { stdio: 'pipe', shell: true, cwd: path.join(ROOT, 'dashboard', 'api') },
  );
}

function makeWebp(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  execFileSync(
    FFMPEG,
    ['-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=512:-2:flags=lanczos',
     '-c:v', 'libwebp', '-quality', '82', '-compression_level', '6', dst],
    { stdio: 'pipe' },
  );
}

async function main() {
  let ok = 0;
  const failed = [];

  for (const name of NAMES) {
    const src = path.join(SRC_DIR, `${name}.png`);
    if (!fs.existsSync(src)) {
      failed.push({ name, reason: 'missing local png' });
      continue;
    }
    const key = `public/studio/coloring/thumbs/${name}.webp`;
    const webp = path.join(TMP_DIR, `${name}.webp`);
    try {
      makeWebp(src, webp);
      const bytes = fs.statSync(webp).size;
      if (DRY) {
        console.log(`dry ${name}  ${bytes}B  -> ${key}`);
      } else {
        put(key, webp, 'image/webp');
        console.log(`ok ${++ok}/${NAMES.length}  ${name}  ${bytes}B`);
        continue;
      }
      ok++;
    } catch (e) {
      failed.push({ name, reason: String(e.message).slice(0, 300) });
      console.error(`FAILED ${name}`);
    }
  }

  console.log(`\ndone: ok ${ok}, failed ${failed.length}`);
  if (failed.length) {
    console.log(JSON.stringify(failed, null, 2));
    process.exit(2);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
