#!/usr/bin/env node
/**
 * Poll PlayVeo jobs for unique game covers, download, then upload to R2 thumbs via wrangler.
 * CDN path: majarra-thumbs / public/games/{game-id}/cover.jpg
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const ROOT = 'F:\\Projects\\cartoonapp';
const jobsPath = path.join(ROOT, 'tools', 'playveo', 'games-unique-covers-jobs.json');

let apiKey = '';
try {
  apiKey = fs.readFileSync(path.join(os.homedir(), '.majarra', 'playveo.key'), 'utf8').trim();
} catch {}

const BASE = 'https://playveo-api.aboessa101.workers.dev';

async function poll(id) {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${BASE}/v1/images/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    const data = await res.json();
    if (data.status === 'completed') return data;
    if (data.status === 'failed') throw new Error(`failed ${id} ${JSON.stringify(data)}`);
    console.log(`  poll ${id} ${data.status} try ${i}`);
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('timeout');
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log(`DOWNLOADED ${dest} ${buf.length}B`);
  return dest;
}

function uploadToR2(localPath, r2Key) {
  // Use wrangler r2 object put syntax: wrangler r2 object put bucket/key --file=local
  try {
    console.log(`UPLOAD R2 thumbs ${r2Key} from ${localPath}`);
    execSync(`npx wrangler r2 object put majarra-thumbs/${r2Key} --file="${localPath}" --content-type=image/jpeg`, {
      cwd: path.join(ROOT, 'dashboard', 'api'),
      stdio: 'inherit',
      timeout: 120000
    });
    console.log(`OK R2 ${r2Key}`);
    return true;
  } catch (e) {
    console.error(`FAIL R2 ${r2Key}: ${e.message}`);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(jobsPath)) {
    console.error('No jobs file', jobsPath);
    return;
  }
  const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
  for (const [gameId, info] of Object.entries(jobs)) {
    if (!info.id) continue;
    // skip if already uploaded marker exists
    const uploadMarker = path.join(ROOT, 'majarra_images', 'assets', 'games', gameId, '.uploaded');
    if (fs.existsSync(uploadMarker)) {
      console.log(`SKIP ${gameId} already uploaded`);
      continue;
    }

    let resultUrls = info.resultUrls;
    let localPath = info.localPath;

    // If not yet completed, poll
    if (!resultUrls || info.status !== 'completed') {
      console.log(`POLLING ${gameId} ${info.id}`);
      try {
        const data = await poll(info.id);
        resultUrls = data.resultUrls;
        jobs[gameId].status = 'completed';
        jobs[gameId].resultUrls = resultUrls;
        fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));
      } catch (e) {
        console.error(`POLL FAIL ${gameId}: ${e.message}`);
        continue;
      }
    }

    // Download if not yet local
    if (!localPath || !fs.existsSync(localPath)) {
      if (!resultUrls?.[0]) {
        console.error(`NO URL for ${gameId}`);
        continue;
      }
      localPath = path.join(ROOT, 'majarra_images', 'assets', 'games', gameId, 'cover.jpg');
      await download(resultUrls[0], localPath);
      jobs[gameId].localPath = localPath;
      fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));
    }

    // Upload to R2
    const r2Key = `public/games/${gameId}/cover.jpg`;
    const ok = uploadToR2(localPath, r2Key);
    if (ok) {
      fs.writeFileSync(uploadMarker, new Date().toISOString());
      console.log(`MARKED uploaded ${gameId}`);
    }
    // small throttle
    await new Promise(r => setTimeout(r, 800));
  }
  console.log('All done');
}

main().catch(e => { console.error(e); process.exit(1); });
