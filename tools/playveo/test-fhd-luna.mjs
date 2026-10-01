// One-off, minimum-cost PlayVeo FLUX 3 test: submit a single 5-second
// resolution="fhd" (1080p) clip referencing the already-approved Luna
// character, poll until completion, download the result, and report the
// actual pixel dimensions read from the file. Non-final / throwaway output --
// written under assets/playveo-flux3-tests/, never wired into production.
//
// Usage: node tools/playveo/test-fhd-luna.mjs
//
// Key is loaded from PLAYVEO_API_KEY, repo root .env.local, or
// %USERPROFILE%\.majarra\playveo.key -- same convention as flux3-api-test.mjs.
// The key is never printed.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const RUN_ID = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const OUT_DIR = path.join(ROOT, 'assets', 'playveo-flux3-tests', `fhd-check-${RUN_ID}`);
const KEY = loadKey();

function loadKey() {
  const fromProcess = process.env.PLAYVEO_API_KEY?.trim();
  if (fromProcess) return fromProcess;

  const envPath = path.join(ROOT, '.env.local');
  if (fs.existsSync(envPath)) {
    const line = fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((candidate) => /^\s*PLAYVEO_API_KEY\s*=/.test(candidate));
    if (line) {
      let value = line.slice(line.indexOf('=') + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value) return value;
    }
  }

  const homePath = path.join(os.homedir(), '.majarra', 'playveo.key');
  if (fs.existsSync(homePath)) return fs.readFileSync(homePath, 'utf8').trim();
  throw new Error('No PlayVeo key found. Set PLAYVEO_API_KEY or create .env.local.');
}

async function request(method, urlPath, { body } = {}) {
  const response = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  return { status: response.status, json, text };
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function main() {
  console.log('=== PlayVeo FLUX 3: single fhd (1080p) test clip, Luna character ===\n');

  // 1. Confirm fhd is really in the live capabilities list before spending credit.
  const cap = await request('GET', '/v1/flux/capabilities');
  const resolutions = cap.json?.resolutions ?? cap.json?.data?.resolutions;
  console.log('capabilities.resolutions =', JSON.stringify(resolutions));
  if (!Array.isArray(resolutions) || !resolutions.includes('fhd')) {
    console.error('FAIL: "fhd" not present in live capabilities. Aborting before spending credit.');
    process.exit(1);
  }

  // 2. Find the approved Luna character to reuse as the visual reference.
  const chars = await request('GET', '/v1/characters?limit=20');
  const lunaChar = (chars.json?.characters ?? chars.json?.data ?? [])
    .find((c) => /luna/i.test(c.name ?? '') && c.status === 'ready');
  if (lunaChar) {
    console.log(`Using existing character reference: ${lunaChar.name} (${lunaChar.id})`);
  } else {
    console.log('No ready "Luna" character found via /v1/characters -- proceeding with text-only prompt (no character lock).');
  }

  // 3. Submit ONE minimum-duration (5s) fhd clip.
  const prompt = 'لونا، بنت صغيرة بحجاب أصفر وتونيك أصفر وبنطلون تيل غامق، تجلس في غرفة نوم مشمسة وتبتسم للكاميرا وتلوّح بيدها، أسلوب رسوم متحركة ثلاثي الأبعاد ناعم للأطفال، إضاءة دافئة.';
  const body = {
    prompt,
    duration_seconds: 5,
    aspect_ratio: '16:9',
    resolution: 'fhd',
    ...(lunaChar ? { character_id: lunaChar.id } : {}),
  };
  console.log('\nSubmitting job:', JSON.stringify({ ...body, prompt: `${prompt.slice(0, 40)}...` }));
  const submit = await request('POST', '/v1/flux/videos', { body });
  console.log('Submit response status:', submit.status);
  if (submit.status < 200 || submit.status >= 300) {
    console.error('FAIL: submission rejected.', submit.text);
    process.exit(1);
  }
  const job = submit.json?.video ?? submit.json?.data ?? submit.json;
  const jobId = job?.id ?? job?.job_id;
  console.log('Job id:', jobId, '| declared creditCost:', submit.json?.creditCost ?? job?.creditCost ?? 'n/a');
  if (!jobId) {
    console.error('FAIL: no job id in response.', JSON.stringify(submit.json));
    process.exit(1);
  }

  // 4. Poll until completed/failed (cap ~6 minutes for a single 5s clip).
  const started = Date.now();
  let finalVideo = null;
  while (Date.now() - started < 6 * 60_000) {
    const poll = await request('GET', `/v1/flux/videos/${jobId}`);
    const video = poll.json?.video ?? poll.json?.data ?? poll.json;
    if (video?.status) console.log(`  status: ${video.status} (+${Math.round((Date.now() - started) / 1000)}s)`);
    if (video?.status === 'completed') { finalVideo = video; break; }
    if (video?.status === 'failed') {
      console.error('FAIL: job failed.', video.error ?? poll.text);
      process.exit(1);
    }
    await sleep(10_000);
  }
  if (!finalVideo) {
    console.error('FAIL: timed out waiting for completion.');
    process.exit(1);
  }

  // 5. Download and inspect actual dimensions with ffprobe (if available).
  const videoUrl = finalVideo.videoUrl ?? finalVideo.video_url ?? finalVideo.url;
  console.log('\nvideoUrl:', videoUrl);
  const resp = await fetch(videoUrl);
  const bytes = Buffer.from(await resp.arrayBuffer());
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const filePath = path.join(OUT_DIR, 'luna-fhd-test.mp4');
  fs.writeFileSync(filePath, bytes);
  console.log('Saved:', path.relative(ROOT, filePath), `(${bytes.length} bytes)`);

  try {
    const probe = execFileSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,codec_name',
      '-of', 'json',
      filePath,
    ], { encoding: 'utf8' });
    console.log('\nffprobe result:', probe);
    const parsed = JSON.parse(probe);
    const stream = parsed.streams?.[0];
    const is1080 = stream?.height === 1080 || stream?.width === 1080;
    console.log(is1080
      ? `\n✅ CONFIRMED: actual resolution is ${stream.width}x${stream.height} -- real 1080p.`
      : `\n⚠️  Reported resolution is ${stream?.width}x${stream?.height} -- NOT 1080p despite resolution="fhd".`);
  } catch (err) {
    console.log('\nffprobe not available or failed; file saved for manual inspection:', err.message);
    console.log('File path:', filePath);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
