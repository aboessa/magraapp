// One-off, minimum-cost PlayVeo test on the CORRECT documented endpoint:
// POST /v1/videos (Omni Flash / Veo 3.1), resolution="1080p" (per the live
// docs screenshot on 2026-09-29), NOT the older /v1/flux/videos path used by
// flux3-api-test.mjs. Submits one 4-second clip, polls, downloads, and
// verifies actual pixel dimensions with ffprobe. Throwaway output only.
//
// Usage: node tools/playveo/test-v1-videos-1080p.mjs
//
// Key loaded from PLAYVEO_API_KEY, repo root .env.local, or
// %USERPROFILE%\.majarra\playveo.key. Never printed.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const RUN_ID = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const OUT_DIR = path.join(ROOT, 'assets', 'playveo-flux3-tests', `v1-videos-1080p-${RUN_ID}`);
const KEY = loadKey();

function loadKey() {
  const fromProcess = process.env.PLAYVEO_API_KEY?.trim();
  if (fromProcess) return fromProcess;
  const envPath = path.join(ROOT, '.env.local');
  if (fs.existsSync(envPath)) {
    const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((c) => /^\s*PLAYVEO_API_KEY\s*=/.test(c));
    if (line) {
      let value = line.slice(line.indexOf('=') + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (value) return value;
    }
  }
  const homePath = path.join(os.homedir(), '.majarra', 'playveo.key');
  if (fs.existsSync(homePath)) return fs.readFileSync(homePath, 'utf8').trim();
  throw new Error('No PlayVeo key found.');
}

async function request(method, urlPath, { body } = {}) {
  const response = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: response.status, json, text };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log('=== PlayVeo /v1/videos (Omni Flash / Veo 3.1): single 1080p test clip ===\n');

  // Try to discover model/resolution capabilities on THIS endpoint family first.
  const capPaths = ['/v1/capabilities', '/v1/videos/capabilities', '/v1/models'];
  for (const p of capPaths) {
    const r = await request('GET', p);
    console.log(`GET ${p} -> ${r.status}`, r.status === 200 ? JSON.stringify(r.json) : '');
  }

  // Character reference: list existing characters to reuse Luna by name if present.
  const charPaths = ['/v1/characters', '/v1/videos/characters'];
  let characterName = null;
  for (const p of charPaths) {
    const r = await request('GET', `${p}?limit=20`);
    if (r.status === 200) {
      console.log(`GET ${p} -> 200`, JSON.stringify(r.json).slice(0, 400));
      const list = r.json?.characters ?? r.json?.data ?? [];
      const luna = list.find((c) => /luna/i.test(c.name ?? '') && (c.status === 'ready' || !c.status));
      if (luna) { characterName = luna.name; break; }
    }
  }
  console.log('Character to reference:', characterName ?? '(none found — proceeding text-only)');

  const prompt = 'لونا، بنت صغيرة بحجاب أصفر وتونيك أصفر وبنطلون تيل غامق، تجلس في غرفة نوم مشمسة وتبتسم للكاميرا وتلوّح بيدها، أسلوب رسوم متحركة ثلاثي الأبعاد ناعم للأطفال، إضاءة دافئة.';
  const body = {
    prompt,
    model: 'omni_flash',
    duration_seconds: 4,
    aspect_ratio: '16:9',
    resolution: '1080p',
    ...(characterName ? { characters: [characterName] } : {}),
  };
  console.log('\nSubmitting POST /v1/videos:', JSON.stringify({ ...body, prompt: `${prompt.slice(0, 40)}...` }));
  const submit = await request('POST', '/v1/videos', { body });
  console.log('Submit status:', submit.status, JSON.stringify(submit.json));
  if (submit.status < 200 || submit.status >= 300) {
    console.error('FAIL: submission rejected.', submit.text);
    process.exit(1);
  }

  const job = submit.json?.video ?? submit.json?.data ?? submit.json;
  const jobId = job?.id ?? job?.job_id;
  console.log('Job id:', jobId, '| creditCost:', submit.json?.creditCost ?? job?.creditCost ?? 'n/a');
  if (!jobId) { console.error('FAIL: no job id.', JSON.stringify(submit.json)); process.exit(1); }

  const started = Date.now();
  let finalVideo = null;
  while (Date.now() - started < 6 * 60_000) {
    const poll = await request('GET', `/v1/videos/${jobId}`);
    const video = poll.json?.video ?? poll.json?.data ?? poll.json;
    if (video?.status) console.log(`  status: ${video.status} (+${Math.round((Date.now() - started) / 1000)}s)`);
    if (video?.status === 'completed') { finalVideo = video; break; }
    if (video?.status === 'failed') { console.error('FAIL:', video.error ?? poll.text); process.exit(1); }
    await sleep(10_000);
  }
  if (!finalVideo) { console.error('FAIL: timed out after 6 minutes.'); process.exit(1); }

  const videoUrl = finalVideo.videoUrl ?? finalVideo.video_url ?? finalVideo.url;
  console.log('\nvideoUrl:', videoUrl);
  const resp = await fetch(videoUrl);
  const bytes = Buffer.from(await resp.arrayBuffer());
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const filePath = path.join(OUT_DIR, 'luna-1080p-test.mp4');
  fs.writeFileSync(filePath, bytes);
  console.log('Saved:', path.relative(ROOT, filePath), `(${bytes.length} bytes)`);

  try {
    const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', filePath], { encoding: 'utf8' });
    console.log('\nffprobe:', probe);
    const stream = JSON.parse(probe).streams?.[0];
    const is1080 = stream?.height === 1080 || stream?.width === 1080;
    console.log(is1080 ? `\n✅ CONFIRMED real 1080p: ${stream.width}x${stream.height}` : `\n⚠️ NOT 1080p: ${stream?.width}x${stream?.height}`);
  } catch (err) {
    console.log('\nffprobe unavailable:', err.message, '| file at:', filePath);
  }
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
