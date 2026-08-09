/**
 * End-to-end verification of the Mazen & Thaaloub series after import.
 *
 * Checks the public catalogue API and the underlying D1/R2 state, and asserts
 * that no private stream detail leaks through any public endpoint.
 *
 * Usage: node scripts/verify-mazen-series.mjs [--base=http://127.0.0.1:8787]
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(scriptDir, '..');
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
const tempDir = path.join(apiDir, '.tmp');

const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith('--base='))?.split('=')[1] ?? 'http://127.0.0.1:8787').replace(/\/+$/, '');
const SLUG = 'mazen-wa-thaaloub';
const EXPECTED_EPISODES = 14;

let pass = 0;
let fail = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) { pass += 1; console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`); }
  else { fail += 1; failures.push(label); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

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

async function d1(sql) {
  await fs.mkdir(tempDir, { recursive: true });
  const sqlPath = path.join(tempDir, `verify-${createHash('sha1').update(sql).digest('hex').slice(0, 12)}.sql`);
  await fs.writeFile(sqlPath, sql, 'utf8');
  try {
    const { stdout } = await run(['d1', 'execute', 'majarra-db', '--local', '--json', `--file=${sqlPath}`]);
    return JSON.parse(stdout.slice(stdout.indexOf('[')))[0]?.results ?? [];
  } finally {
    await fs.rm(sqlPath, { force: true });
  }
}

async function getJson(endpoint) {
  const response = await fetch(`${BASE}${endpoint}`);
  const text = await response.text();
  return { status: response.status, raw: text, json: JSON.parse(text) };
}

/// Patterns that must never appear in a public catalogue response.
const LEAK_PATTERN = /r2_key|majarra-media|majarra-thumbs|private\/|\.mp4|upload_id|checksum_sha256|"bucket"/i;

async function main() {
  console.log(`Verifying Mazen & Thaaloub against ${BASE}\n`);

  // --- A. GET /api/v1/series ------------------------------------------------
  console.log('GET /api/v1/series');
  const list = await getJson('/api/v1/series?limit=100');
  check('endpoint returns 200', list.status === 200, `status=${list.status}`);
  const matches = list.json.data.filter((s) => s.slug === SLUG);
  check('exactly one Mazen series exists', matches.length === 1, `found ${matches.length}`);
  const series = matches[0];
  check('series episodes_count is 14', Number(series.episodes_count) === EXPECTED_EPISODES, `got ${series?.episodes_count}`);
  check('series title_ar is the real Arabic title', series?.title_ar === 'مازن وثعلوب', series?.title_ar);
  check('series is published', !!series?.published_at, series?.published_at);
  check('series planet is abjad', series?.planet_id === 'abjad', series?.planet_id);
  check('series list leaks no private detail', !LEAK_PATTERN.test(list.raw));
  // Artwork: honest null until a real public poster asset exists.
  check('series cover_url is null (no editorial artwork yet)', series?.cover_url === null, String(series?.cover_url));

  // --- B. GET /api/v1/series/:id -------------------------------------------
  console.log('\nGET /api/v1/series/:id');
  const detail = await getJson(`/api/v1/series/${series.id}`);
  check('endpoint returns 200', detail.status === 200, `status=${detail.status}`);
  check('detail returns the same series id', detail.json.data.series?.id === series.id);
  check('series detail leaks no private detail', !LEAK_PATTERN.test(detail.raw));

  // --- C. GET /api/v1/episodes?series_id= ----------------------------------
  console.log('\nGET /api/v1/episodes?series_id=');
  const episodes = await getJson(`/api/v1/episodes?series_id=${series.id}&limit=100`);
  check('endpoint returns 200', episodes.status === 200, `status=${episodes.status}`);
  check(`returns ${EXPECTED_EPISODES} episodes`, episodes.json.data.length === EXPECTED_EPISODES, `got ${episodes.json.data.length}`);

  const numbers = episodes.json.data.map((e) => Number(e.episode_number));
  const sortedDesc = [...numbers].sort((a, b) => b - a);
  check('episode ordering is monotonic', JSON.stringify(numbers) === JSON.stringify(sortedDesc), numbers.join(','));
  const unique = new Set(numbers);
  check('episode numbers are unique', unique.size === numbers.length, `${unique.size} unique of ${numbers.length}`);
  check('episode numbers cover 1..14', numbers.length === EXPECTED_EPISODES && Math.min(...numbers) === 1 && Math.max(...numbers) === EXPECTED_EPISODES);
  check('every episode has a real duration', episodes.json.data.every((e) => Number(e.duration_seconds) > 0));
  check('every episode has an Arabic title', episodes.json.data.every((e) => /[\u0600-\u06FF]/.test(e.title_ar ?? '')));
  check('every thumbnail_url is null (no editorial stills yet)', episodes.json.data.every((e) => e.thumbnail_url === null));
  check('episode list leaks no private detail', !LEAK_PATTERN.test(episodes.raw));

  // --- D. GET /api/v1/episodes/:id for representatives ---------------------
  console.log('\nGET /api/v1/episodes/:id');
  for (const number of [1, 7, 14]) {
    const pick = episodes.json.data.find((e) => Number(e.episode_number) === number);
    if (!pick) { check(`episode #${number} present`, false); continue; }
    const one = await getJson(`/api/v1/episodes/${pick.id}`);
    const ep = one.json.data.episode;
    check(`episode #${number} returns 200`, one.status === 200, `status=${one.status}`);
    check(`episode #${number} id matches`, ep?.id === pick.id);
    check(`episode #${number} has Arabic title`, /[\u0600-\u06FF]/.test(ep?.title_ar ?? ''), ep?.title_ar);
    check(`episode #${number} duration > 0`, Number(ep?.duration_seconds) > 0, `${ep?.duration_seconds}s`);
    check(`episode #${number} is published`, !!ep?.published_at);
    check(`episode #${number} leaks no stream URL or R2 key`, !LEAK_PATTERN.test(one.raw));
  }

  // --- E. D1 state ----------------------------------------------------------
  console.log('\nD1 verification');
  const seriesRows = await d1(`SELECT COUNT(*) AS n FROM series WHERE slug = '${SLUG}';`);
  check('exactly one series row', Number(seriesRows[0].n) === 1, `${seriesRows[0].n}`);

  const epRows = await d1(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN status='published' AND is_published=1 THEN 1 ELSE 0 END) AS published,`
    + ` SUM(CASE WHEN duration_seconds > 0 THEN 1 ELSE 0 END) AS with_duration`
    + ` FROM episodes WHERE series_id = (SELECT id FROM series WHERE slug = '${SLUG}');`,
  );
  check(`${EXPECTED_EPISODES} episode rows`, Number(epRows[0].n) === EXPECTED_EPISODES, `${epRows[0].n}`);
  check('all episodes published', Number(epRows[0].published) === EXPECTED_EPISODES, `${epRows[0].published}`);
  check('all episodes have durations', Number(epRows[0].with_duration) === EXPECTED_EPISODES, `${epRows[0].with_duration}`);

  const trackRows = await d1(
    `SELECT COUNT(*) AS n, COUNT(DISTINCT et.episode_id) AS episodes, GROUP_CONCAT(DISTINCT et.track_id) AS tracks`
    + ` FROM episode_tracks et JOIN episodes e ON e.id = et.episode_id`
    + ` WHERE e.series_id = (SELECT id FROM series WHERE slug = '${SLUG}');`,
  );
  check(`episode_tracks cover all ${EXPECTED_EPISODES} episodes`, Number(trackRows[0].episodes) === EXPECTED_EPISODES, `${trackRows[0].episodes}`);
  check('track is junior (ages 9-12)', String(trackRows[0].tracks) === 'junior', String(trackRows[0].tracks));

  const assetRows = await d1(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN ca.status='ready' THEN 1 ELSE 0 END) AS ready,`
    + ` SUM(CASE WHEN ca.visibility='private' THEN 1 ELSE 0 END) AS private_count,`
    + ` SUM(CASE WHEN ca.bucket='media' THEN 1 ELSE 0 END) AS in_media,`
    + ` SUM(CASE WHEN ca.r2_key LIKE 'private/%' THEN 1 ELSE 0 END) AS private_key`
    + ` FROM content_assets ca JOIN asset_links al ON al.asset_id = ca.id`
    + ` JOIN episodes e ON e.id = al.entity_id`
    + ` WHERE al.role = 'stream' AND e.series_id = (SELECT id FROM series WHERE slug = '${SLUG}');`,
  );
  check(`${EXPECTED_EPISODES} stream content_assets`, Number(assetRows[0].n) === EXPECTED_EPISODES, `${assetRows[0].n}`);
  check('all stream assets status=ready', Number(assetRows[0].ready) === EXPECTED_EPISODES, `${assetRows[0].ready}`);
  check('all stream assets private', Number(assetRows[0].private_count) === EXPECTED_EPISODES, `${assetRows[0].private_count}`);
  check('all stream assets in MEDIA_BUCKET', Number(assetRows[0].in_media) === EXPECTED_EPISODES, `${assetRows[0].in_media}`);
  check('all stream keys carry private/ prefix', Number(assetRows[0].private_key) === EXPECTED_EPISODES, `${assetRows[0].private_key}`);

  const linkRows = await d1(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN al.role='stream' THEN 1 ELSE 0 END) AS stream_role,`
    + ` SUM(CASE WHEN al.entity_type='episode' THEN 1 ELSE 0 END) AS episode_entity`
    + ` FROM asset_links al JOIN episodes e ON e.id = al.entity_id`
    + ` WHERE e.series_id = (SELECT id FROM series WHERE slug = '${SLUG}');`,
  );
  check(`${EXPECTED_EPISODES} asset_links`, Number(linkRows[0].n) === EXPECTED_EPISODES, `${linkRows[0].n}`);
  check('all links role=stream', Number(linkRows[0].stream_role) === EXPECTED_EPISODES, `${linkRows[0].stream_role}`);
  check('all links entity_type=episode', Number(linkRows[0].episode_entity) === EXPECTED_EPISODES, `${linkRows[0].episode_entity}`);

  // --- F. R2 objects --------------------------------------------------------
  console.log('\nR2 verification');
  const keys = await d1(
    `SELECT ca.r2_key, ca.size_bytes, ca.checksum_sha256 FROM content_assets ca`
    + ` JOIN asset_links al ON al.asset_id = ca.id JOIN episodes e ON e.id = al.entity_id`
    + ` WHERE al.role='stream' AND e.series_id = (SELECT id FROM series WHERE slug = '${SLUG}')`
    + ` ORDER BY e.episode_number;`,
  );
  let objectsFound = 0;
  let bytesMatch = 0;
  await fs.mkdir(tempDir, { recursive: true });
  for (const row of keys) {
    const destination = path.join(tempDir, 'r2-probe.bin');
    await fs.rm(destination, { force: true });
    const { code } = await run(
      ['r2', 'object', 'get', `majarra-media-dev/${row.r2_key}`, `--file=${destination}`, '--local'],
      { allowFailure: true },
    );
    if (code === 0) {
      objectsFound += 1;
      const bytes = await fs.readFile(destination);
      if (bytes.length === Number(row.size_bytes)
        && createHash('sha256').update(bytes).digest('hex') === row.checksum_sha256) bytesMatch += 1;
    }
    await fs.rm(destination, { force: true });
  }
  check(`${EXPECTED_EPISODES} R2 objects present`, objectsFound === EXPECTED_EPISODES, `${objectsFound}`);
  check('every R2 object matches size and SHA-256', bytesMatch === EXPECTED_EPISODES, `${bytesMatch}`);

  // --- G. Summary -----------------------------------------------------------
  console.log('\nEpisode inventory:');
  const inventory = await d1(
    `SELECT e.episode_number, e.title_ar, e.duration_seconds, ca.r2_key, ca.size_bytes`
    + ` FROM episodes e JOIN asset_links al ON al.entity_id = e.id AND al.role='stream'`
    + ` JOIN content_assets ca ON ca.id = al.asset_id`
    + ` WHERE e.series_id = (SELECT id FROM series WHERE slug = '${SLUG}') ORDER BY e.episode_number;`,
  );
  for (const row of inventory) {
    console.log(`  #${String(row.episode_number).padStart(2, '0')} ${String(row.duration_seconds).padStart(3)}s ${String(row.size_bytes).padStart(9)} B  ${row.title_ar}`);
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  if (failures.length) {
    console.log('Failed checks:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
