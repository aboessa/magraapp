/**
 * Imports the real "مازن وثعلوب" episode videos through the existing
 * adminAssets upload path.
 *
 * The first episode was imported by hand during the B1 spike and proved the
 * pipeline. This script does the remaining ones, and is idempotent so it can be
 * re-run safely: an episode whose video is already uploaded and linked is
 * skipped rather than duplicated.
 *
 * ## What is derived versus left unset
 *
 * Titles come from the actual filenames (Arabic orthography lessons). Durations
 * are read from the MP4 `mvhd` atom, not guessed. Age track and price tier are
 * inherited from the existing series.
 *
 * Descriptions, learning objectives, new words, skills, questions and parent
 * guides are **left unset**. They cannot be derived from a filename without
 * inventing editorial content, and the run reports them as outstanding.
 *
 * Stream assets stay `visibility='private'` in MEDIA_BUCKET and are linked with
 * `role='stream'`, so they are reachable only through a playback session.
 *
 * Usage:
 *   node scripts/import-mazen-episodes.mjs --dry-run
 *   node scripts/import-mazen-episodes.mjs [--limit=N]
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(scriptDir, '..');
const rootDir = path.resolve(apiDir, '..', '..');
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
const tempDir = path.join(apiDir, '.tmp');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const baseUrl = (args.find((a) => a.startsWith('--base='))?.split('=')[1] ?? 'http://127.0.0.1:8787').replace(/\/+$/, '');
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0') || 0;

const SERIES_SLUG = 'mazen-wa-thaaloub';
const SOURCE_DIR = path.join(
  rootDir, 'videos', '1 مازن وثعلوب-20260807T145657Z-1-001', '1 مازن وثعلوب',
);

/// Direct upload ceiling enforced by routes/adminAssets.ts. Every source video
/// is well under this, so the multipart path is not needed.
const DIRECT_UPLOAD_LIMIT = 95 * 1024 * 1024;

/// Stable transliterated slugs for the R2 key, so keys stay ASCII and readable.
/// Keyed by the exact source filename, which is the only real evidence we have.
const SLUG_BY_FILENAME = {
  'إهمال نقطتي التاء المربوطة.mp4': 'ihmal-nuqtatay-al-taa-al-marbuta',
  'الحركة والسكون.mp4': 'al-haraka-wa-al-sukun',
  'الهمزة المتوسطة المكسورة .mp4': 'hamza-maksura',
  'الهمزة المتوسطة على الواو.mp4': 'hamza-mutawassita-ala-al-waw',
  'الهمزة وال التعريف.mp4': 'al-hamza-wa-al-tareef',
  'جعل التاء المربوطة تاءً مفتوحة.mp4': 'jal-al-taa-al-marbuta-maftuha',
  'جعل التنوين نوانًا .mp4': 'jal-al-tanween-nunan',
  'كتابة الهمزة على ألف في آخر الكلمة.mp4': 'hamza-ala-alif-akhir-al-kalima',
  'كتابة الهمزة على ألف في وسط الكلمة.mp4': 'hamza-ala-alif-wasat-al-kalima',
  'كتابة الهمزة على واو في آخر الكلمة.mp4': 'hamza-ala-waw-akhir-al-kalima',
  'نسيان سنتي الصاد والضاد.mp4': 'nisyan-sinnatay-al-sad-wa-al-dad',
  'نقطتا الألف المقصورة اللينة.mp4': 'nuqtata-al-alif-al-maqsura',
  'نقطتي الياء المتطرفة.mp4': 'nuqtatay-al-yaa-al-mutatarrifa',
  'نقطتي_الهاء_المتطرفة.mp4': 'nuqtatay-al-haa-al-mutatarrifa',
};

/// The episode title is the filename with its extension and separators cleaned.
/// No wording is invented: this is the editorial title as delivered.
function titleFromFilename(filename) {
  return filename
    .replace(/\.mp4$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- MP4 duration ----------------------------------------------------------

/// Reads the real duration from the MP4 `mvhd` atom.
///
/// `mvhd` carries a timescale and a duration in those units. Returns null when
/// the atom cannot be found, so a missing duration is reported rather than
/// fabricated.
function durationFromMp4(buffer) {
  const marker = Buffer.from('mvhd', 'ascii');
  const at = buffer.indexOf(marker);
  if (at < 0) return null;
  const version = buffer.readUInt8(at + 4);
  try {
    if (version === 1) {
      const timescale = buffer.readUInt32BE(at + 8 + 8 + 8);
      const duration = Number(buffer.readBigUInt64BE(at + 8 + 8 + 8 + 4));
      if (!timescale || !duration) return null;
      return Math.round(duration / timescale);
    }
    const timescale = buffer.readUInt32BE(at + 8 + 4 + 4);
    const duration = buffer.readUInt32BE(at + 8 + 4 + 4 + 4);
    if (!timescale || !duration) return null;
    return Math.round(duration / timescale);
  } catch {
    return null;
  }
}

// --- plumbing --------------------------------------------------------------

function run(cmdArgs, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(wrangler, cmdArgs, { cwd: apiDir, shell: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || allowFailure) resolve({ code, stdout, stderr });
      else reject(new Error(`wrangler ${cmdArgs.join(' ')} exited ${code}\n${stderr}`));
    });
  });
}

async function d1Query(sql) {
  await fs.mkdir(tempDir, { recursive: true });
  const sqlPath = path.join(tempDir, `mazen-q-${createHash('sha1').update(sql).digest('hex').slice(0, 12)}.sql`);
  await fs.writeFile(sqlPath, sql, 'utf8');
  try {
    const { stdout } = await run(['d1', 'execute', 'majarra-db', '--local', '--json', `--file=${sqlPath}`]);
    return JSON.parse(stdout.slice(stdout.indexOf('[')))[0]?.results ?? [];
  } finally {
    await fs.rm(sqlPath, { force: true });
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/// The admin surface is rate limited to 30 requests per minute (`adminLimit` in
/// src/index.ts) and each episode costs five calls, so a 14-episode run trips the
/// limiter partway through. A 429 is backpressure rather than a failure, so wait
/// for the window to roll over and retry instead of abandoning the episode.
const RATE_LIMIT_BACKOFF_MS = 62_000;

async function api(method, endpoint, body, extraHeaders = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Actor': 'mazen-import-script', ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();

    if (response.status === 429 && attempt <= 6) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? (retryAfter + 2) * 1000 : RATE_LIMIT_BACKOFF_MS;
      console.log(`    rate limited on ${method} ${endpoint}; waiting ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) throw new Error(`${method} ${endpoint} -> ${response.status} ${text.slice(0, 300)}`);
    try { return JSON.parse(text); } catch { return null; }
  }
}

/// Uploads the file bytes to the direct-upload endpoint.
async function uploadContent(assetId, filePath, filename, size, mime, sha256) {
  const body = await fs.readFile(filePath);
  const response = await fetch(`${baseUrl}/api/v1/admin/assets/${assetId}/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': mime,
      'Content-Length': String(size),
      // Encoded because Arabic filenames cannot travel raw in a header.
      'X-File-Name': encodeURIComponent(filename),
      'X-File-Size': String(size),
      'X-File-SHA256': sha256,
      'X-Admin-Actor': 'mazen-import-script',
    },
    body,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`upload -> ${response.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// --- main ------------------------------------------------------------------

async function main() {
  const series = (await d1Query(
    `SELECT id, slug, age_min, age_max, planet_id, status FROM series WHERE slug = '${SERIES_SLUG}';`,
  ))[0];
  if (!series) throw new Error(`Series ${SERIES_SLUG} not found. Refusing to create a duplicate.`);
  console.log(`Reusing series ${series.id} (${series.slug}) ages ${series.age_min}-${series.age_max}`);

  const existingEpisodes = await d1Query(
    `SELECT id, episode_number, title_ar, duration_seconds, status FROM episodes WHERE series_id = '${series.id}' ORDER BY episode_number;`,
  );
  const existingByTitle = new Map(existingEpisodes.map((e) => [e.title_ar, e]));
  console.log(`Existing episodes: ${existingEpisodes.length}`);

  const filenames = (await fs.readdir(SOURCE_DIR))
    .filter((name) => name.toLowerCase().endsWith('.mp4'))
    .sort((a, b) => a.localeCompare(b, 'ar'));
  console.log(`Source videos: ${filenames.length}`);

  // Episode numbering follows the sorted source order so it is deterministic and
  // reproducible; episode 1 keeps the number assigned during the spike.
  const planned = [];
  for (let index = 0; index < filenames.length; index += 1) {
    const filename = filenames[index];
    const title = titleFromFilename(filename);
    planned.push({
      filename,
      title,
      slug: SLUG_BY_FILENAME[filename] ?? `ep-${index + 1}`,
      absolute: path.join(SOURCE_DIR, filename),
      existing: existingByTitle.get(title) ?? null,
    });
  }

  // Keep the already-imported episode's number stable, then fill the rest.
  const takenNumbers = new Set(existingEpisodes.map((e) => Number(e.episode_number)).filter(Boolean));
  let nextNumber = 1;
  for (const item of planned) {
    if (item.existing) { item.episodeNumber = Number(item.existing.episode_number); continue; }
    while (takenNumbers.has(nextNumber)) nextNumber += 1;
    item.episodeNumber = nextNumber;
    takenNumbers.add(nextNumber);
  }

  const todo = planned.filter((item) => !item.existing);
  const selected = limit ? todo.slice(0, limit) : todo;

  console.log('\nPlan:');
  for (const item of planned) {
    console.log(`  #${String(item.episodeNumber).padStart(2, '0')} ${item.existing ? '[exists]' : '[import]'} ${item.title}`);
  }

  const counts = { inspected: planned.length, skipped_existing: planned.length - todo.length, created: 0, uploaded: 0, linked: 0, published: 0, failed: 0 };
  const failures = [];
  const results = [];
  const missingMetadata = [];

  for (const item of selected) {
    try {
      const bytes = await fs.readFile(item.absolute);
      const size = bytes.length;
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const duration = durationFromMp4(bytes);
      if (duration === null) missingMetadata.push(`${item.title}: duration unreadable`);
      if (size > DIRECT_UPLOAD_LIMIT) throw new Error(`${size} B exceeds the direct upload limit; multipart needed`);

      if (dryRun) {
        results.push({ ...item, size, sha256, duration, dry: true });
        console.log(`  DRY #${item.episodeNumber} ${item.title} ${size} B duration=${duration ?? 'unknown'}s`);
        continue;
      }

      // --- 1. Episode -----------------------------------------------------
      const episode = await api('POST', '/api/v1/admin/episodes', {
        series_id: series.id,
        episode_number: item.episodeNumber,
        title_ar: item.title,
        duration_seconds: duration ?? undefined,
        // Matches the episode imported during the spike.
        reading_level: 'independent',
        interaction_mode: 'independent',
        supervision_level: 'none',
        difficulty: 'medium',
        is_free: 0,
        status: 'draft',
      });
      const episodeId = episode.data.id;
      counts.created += 1;

      // --- 2. Private video asset -----------------------------------------
      const expectedPath = `assets/video/series/${SERIES_SLUG}/ep-${String(item.episodeNumber).padStart(2, '0')}-${item.slug}.mp4`;
      const asset = await api('POST', '/api/v1/admin/assets', {
        title_ar: item.title,
        kind: 'video',
        source: 'upload',
        status: 'planned',
        // Streams are entitlement controlled and must never reach the CDN.
        visibility: 'private',
        original_filename: item.filename,
        expected_path: expectedPath,
        mime_type: 'video/mp4',
      });
      const assetId = asset.data.id;

      // --- 3. Direct upload ------------------------------------------------
      const uploaded = await uploadContent(assetId, item.absolute, item.filename, size, 'video/mp4', sha256);
      if (uploaded.data.status !== 'ready') throw new Error(`asset not ready: ${JSON.stringify(uploaded.data)}`);
      counts.uploaded += 1;

      // --- 4. Link as the stream -------------------------------------------
      await api('PUT', `/api/v1/admin/assets/${assetId}/links`, {
        links: [{ entity_type: 'episode', entity_id: episodeId, role: 'stream', sort_order: 0 }],
      });
      counts.linked += 1;

      // --- 5. Publish only after the object is confirmed -------------------
      await api('PATCH', `/api/v1/admin/episodes/${episodeId}`, { status: 'published' });
      counts.published += 1;

      results.push({
        ...item, size, sha256, duration,
        episode_id: episodeId, asset_id: assetId, r2_key: uploaded.data.r2_key, etag: uploaded.data.etag,
      });
      console.log(`  OK  #${String(item.episodeNumber).padStart(2, '0')} ${item.title} ${size} B ${duration ?? '?'}s -> ${uploaded.data.r2_key}`);
    } catch (error) {
      counts.failed += 1;
      failures.push(`${item.title}: ${error instanceof Error ? error.message : error}`);
      console.log(`  FAIL #${item.episodeNumber} ${item.title}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log('\nCounts:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(20)} ${v}`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  ${failure}`);
  }
  if (missingMetadata.length) {
    console.log('\nUnresolved metadata:');
    for (const note of missingMetadata) console.log(`  ${note}`);
  }
  console.log('\nEditorial fields intentionally left unset (cannot be derived from filenames):');
  console.log('  description_ar, learning_objective_id, new_words, skills, questions, parent_guide_ar');
  console.log('  thumbnail/poster artwork: no source artwork exists for this series');

  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(
    path.join(tempDir, 'mazen-import-result.json'),
    JSON.stringify({ generated_at: new Date().toISOString(), series, counts, results, failures, missingMetadata }, null, 2),
    'utf8',
  );
  if (counts.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
