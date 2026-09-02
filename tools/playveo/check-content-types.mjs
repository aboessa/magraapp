#!/usr/bin/env node
/**
 * check-content-types.mjs — فحص content-type و CORS لكل أصول ارسم مثلي على CDN
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'draw-like-me-50.manifest.json'), 'utf8'),
);

const CDN = 'https://cdn.majarra.app';
const ORIGIN = 'https://majarra.app';

function expectedType(key) {
  const ext = key.split('.').pop().toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

async function head(key) {
  const url = CDN + '/' + key + '?v=3';
  const r = await fetch(url, { method: 'HEAD', headers: { Origin: ORIGIN } });
  return {
    key,
    status: r.status,
    type: r.headers.get('content-type'),
    acao: r.headers.get('access-control-allow-origin'),
    want: expectedType(key),
  };
}

async function main() {
  const keys = [];
  for (const a of manifest.assets) {
    keys.push(a.r2_key);
    if (a.thumb_r2_key) keys.push(a.thumb_r2_key);
  }
  keys.push('public/studio/heroes/draw-like-me-hero.webp');

  const bad = [];
  let ok = 0;
  const limit = 8;
  let idx = 0;
  async function worker() {
    while (idx < keys.length) {
      const key = keys[idx++];
      try {
        const r = await head(key);
        const typeOk = r.type === r.want;
        const corsOk = r.acao === '*';
        if (r.status === 200 && typeOk && corsOk) ok++;
        else bad.push(r);
      } catch (e) {
        bad.push({ key, error: e.message });
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));

  console.log('total ' + keys.length + '  ok ' + ok + '  bad ' + bad.length);
  if (bad.length) {
    console.log('\n--- mismatches ---');
    for (const b of bad.slice(0, 200)) {
      console.log(
        [b.status, 'got=' + b.type, 'want=' + b.want, 'acao=' + b.acao, b.key, b.error || '']
          .join('  '),
      );
    }
  }
  fs.writeFileSync(
    path.join(__dirname, 'content-type-report.json'),
    JSON.stringify({ total: keys.length, ok, bad }, null, 2),
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
