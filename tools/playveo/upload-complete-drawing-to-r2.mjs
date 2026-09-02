#!/usr/bin/env node
/**
 * upload-complete-drawing-to-r2.mjs
 *
 * Uploads the 50 "أكمل الرسمة" activity triples to the public THUMBS_BUCKET.
 *
 * KEY LAYOUT
 * ----------
 *   public/studio/complete-drawing/{id}/reference_full.png   (answer key)
 *   public/studio/complete-drawing/{id}/challenge.png        (the puzzle)
 *   public/studio/complete-drawing/{id}/thumbnail.jpg        (grid card)
 *
 * The `public/studio/` prefix is not cosmetic. Three independent sources agree
 * on it and only migration 0069 disagreed:
 *   - adminCreativeStudio.ts:14 documents `public/studio/{category}/{id}.{ext}`
 *     as the layout for every creative drawing, and r2KeyFor() builds exactly
 *     that for uploads made through the admin UI.
 *   - The live coloring and draw_like_me rows both serve
 *     `public/studio/...` keys and return 200.
 *   - app_main/assets/data/complete_items.json already expects
 *     `public/studio/complete-drawing/{id}/challenge.png`.
 * Migration 0069 stored the keys without the prefix, which is why all 50 rows
 * 404'd. Adding the prefix here makes the bucket match the bundled JSON exactly;
 * the migration is corrected separately so D1 agrees with both.
 *
 * Content-type is passed explicitly. Wrangler defaults to
 * application/octet-stream, and the fix-content-types.mjs pass for the
 * draw_like_me pack existed only because that detail was missed the first time
 * (101 objects had to be re-uploaded). Setting it correctly on the way in avoids
 * a second corrective pass here.
 *
 * Usage:
 *   node tools/playveo/upload-complete-drawing-to-r2.mjs
 *   node tools/playveo/upload-complete-drawing-to-r2.mjs --only butterfly-01
 *   node tools/playveo/upload-complete-drawing-to-r2.mjs --concurrency 6
 *   node tools/playveo/upload-complete-drawing-to-r2.mjs --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
// wrangler resolves its account/config from the api worker directory.
const WRANGLER_CWD = path.join(ROOT, 'dashboard', 'api');
const BUCKET = 'majarra-thumbs';
const KEY_PREFIX = 'public/studio/complete-drawing';
const LOCAL_ROOT = path.join(ROOT, 'assets', 'complete-drawing');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'complete-drawing.manifest.json'), 'utf8')
);

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const ONLY = opt('--only');
const DRY = argv.includes('--dry-run');
const CONCURRENCY = Number(opt('--concurrency') ?? 4);

const FILES = [
  { name: 'reference_full.png', type: 'image/png' },
  { name: 'challenge.png', type: 'image/png' },
  { name: 'thumbnail.jpg', type: 'image/jpeg' },
];

let assets = manifest.assets;
if (ONLY) assets = assets.filter((a) => ONLY.split(',').includes(a.id));

/** Build the full upload worklist, failing loudly on anything missing on disk. */
const jobs = [];
const missing = [];
for (const a of assets) {
  for (const f of FILES) {
    const file = path.join(LOCAL_ROOT, a.id, f.name);
    if (!fs.existsSync(file)) { missing.push(path.relative(ROOT, file)); continue; }
    jobs.push({ id: a.id, file, key: `${KEY_PREFIX}/${a.id}/${f.name}`, type: f.type });
  }
}

if (missing.length) {
  console.error(`refusing to start: ${missing.length} local file(s) missing`);
  for (const m of missing.slice(0, 10)) console.error(`  ${m}`);
  process.exit(1);
}

function put(job) {
  return new Promise((resolve) => {
    if (DRY) { resolve({ job, ok: true, dry: true }); return; }
    execFile(
      'npx',
      ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${job.key}`,
        '--file', job.file, '--content-type', job.type, '--remote'],
      { cwd: WRANGLER_CWD, shell: true, maxBuffer: 1024 * 1024 * 8 },
      (err, stdout, stderr) => {
        const out = `${stdout}${stderr}`;
        // Wrangler can exit 0 while still reporting a failure in its output.
        const ok = !err && /Upload complete/i.test(out);
        resolve({ job, ok, out: out.trim().split('\n').slice(-3).join(' | ') });
      }
    );
  });
}

const failures = [];
let done = 0;
let idx = 0;

async function worker() {
  while (true) {
    const i = idx++;
    if (i >= jobs.length) return;
    const job = jobs[i];
    const r = await put(job);
    done++;
    if (r.ok) {
      if (done % 10 === 0 || done === jobs.length) console.log(`  ${done}/${jobs.length} uploaded`);
    } else {
      failures.push({ key: job.key, out: r.out });
      console.error(`  FAILED ${job.key}\n    ${r.out}`);
    }
  }
}

console.log(
  `${DRY ? '[dry-run] ' : ''}uploading ${jobs.length} objects for ${assets.length} activities ` +
  `to ${BUCKET}/${KEY_PREFIX}/ (concurrency ${CONCURRENCY})`
);

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\ndone: ${jobs.length - failures.length} ok, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAILED ${f.key}`);
  process.exitCode = 2;
}
