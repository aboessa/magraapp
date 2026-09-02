#!/usr/bin/env node
/**
 * fix-content-types.mjs — إعادة رفع أصول "ارسم مثلي" بنوع MIME صحيح.
 *
 * مشكلتان في الرفع القديم:
 *  1) wrangler بدون --content-type كان يضع image/jpeg لكل الملفات.
 *  2) المصغرات thumbs/*.webp كانت نسخة من ملف PNG (بايتس PNG باسم webp).
 *
 * الحل: رفع الأصل PNG بـ image/png، وتوليد WebP حقيقي للمصغرة (عرض 512) ورفعه بـ image/webp.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'draw-like-me-50.manifest.json'), 'utf8'),
);

const FFMPEG = process.env.FFMPEG_PATH || 'F:\\tools\\ffmpeg\\ffmpeg.exe';
const SRC_DIR = path.join(ROOT, 'assets', 'images', 'draw_like_me', 'v2-final');
const TMP_DIR = path.join(ROOT, 'assets', 'images', 'draw_like_me', 'thumbs-webp');
const BUCKET = 'majarra-thumbs';
const ONLY = process.argv.includes('--only') ? Number(process.argv[process.argv.indexOf('--only') + 1]) : 0;

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
  let assets = manifest.assets;
  if (ONLY > 0) assets = assets.slice(0, ONLY);
  let ok = 0;
  const failed = [];

  for (const a of assets) {
    const src = path.join(SRC_DIR, `${a.id}.png`);
    if (!fs.existsSync(src)) {
      failed.push({ id: a.id, reason: 'missing local png' });
      continue;
    }
    try {
      put(a.r2_key, src, 'image/png');
      if (a.thumb_r2_key) {
        const webp = path.join(TMP_DIR, `${a.id}.webp`);
        if (!fs.existsSync(webp)) makeWebp(src, webp);
        put(a.thumb_r2_key, webp, 'image/webp');
      }
      ok++;
      console.log(`ok ${ok}/${assets.length}  ${a.id}`);
    } catch (e) {
      failed.push({ id: a.id, reason: String(e.message).slice(0, 300) });
      console.error(`FAILED ${a.id}`);
    }
  }

  console.log(`\ndone: ok ${ok}, failed ${failed.length}`);
  if (failed.length) console.log(JSON.stringify(failed, null, 2));
  if (failed.length) process.exit(2);
}
main().catch((e) => { console.error(e); process.exit(1); });
