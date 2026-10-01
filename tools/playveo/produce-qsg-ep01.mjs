// Production run: qiyami-alsaghira ep-01 "one-swing" — 6 still images
// (motion_story production level: stills + slow camera pan added later,
// not full video generation). Uses the approved character sheet
// (Rima: yellow shirt/blue shorts/pigtails; Nour: sage-green dress/wavy
// hair) and enforces every safety/neutrality rule from
// series-bible-qiyami-alsaghira.md: no adult in frame, Rima always beside
// (never in front of/behind) the moving swing, no angry/crying faces, no
// cultural/religious symbols, neutral yard, 3-4 elements per shot, no
// on-screen text.
//
// Usage: node tools/playveo/produce-qsg-ep01.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const RUN_ID = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const OUT_DIR = path.join(ROOT, 'assets', 'episodes', `qsg-ep01-one-swing-${RUN_ID}`);
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
  throw new Error('No key.');
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

const STYLE = 'Flat soft preschool cartoon illustration style, thick rounded soft outlines, warm flat colors, no text, no logos, no watermark, 3-4 simple elements only, plain neutral daytime outdoor yard background with no country landmarks or symbols.';
const RIMA = 'Rima: girl about 4 years old, warm light-tan skin, black hair in two neat pigtails with pale sage-green ribbons, big round brown eyes, plain light-yellow short-sleeve t-shirt, plain light-blue shorts, simple brown sandals, bare head, no religious or cultural symbols.';
const NOUR = 'Nour: girl about 4 years old, medium-tan skin, short naturally wavy black hair with no ties, big round brown eyes, plain light sage-green short dress, simple brown sandals, bare head, no religious or cultural symbols.';

const SHOTS = [
  {
    id: 'shot-01-intro-situation',
    seconds: 55,
    prompt: `${STYLE} Wide shot: a single simple wooden swing with two ropes in a neutral sandy play yard. ${NOUR} is sitting on the swing, swinging gently and smiling. ${RIMA} is walking in from the right side, looking at the swing with calm curious interest. Rima is clearly standing well to the side, at a safe distance from the swing's path, not in front of or behind it. Only the swing, Nour, and Rima are in frame (3-4 elements). Bright calm daytime lighting.`,
  },
  {
    id: 'shot-02-hard-moment',
    seconds: 30,
    prompt: `${STYLE} Medium shot, slightly slower and quieter mood: ${RIMA} standing clearly to the side of the swing (not in front of or behind it), watching calmly with a neutral thoughtful expression — no anger, no crying, no pouting. ${NOUR} still swinging gently in the background. Only Rima, Nour, and the swing visible (3 elements). Soft muted lighting to suggest a quiet waiting moment.`,
  },
  {
    id: 'shot-03-pause-question-frame',
    seconds: 20,
    prompt: `${STYLE} A calm still frame: a simple pair of open empty upward-facing hands icon, pale sage-green (#96CEB4) semi-transparent overlay background, absolutely no other characters, no swing, no text, no question mark symbol — just the two open hands shape, centered, minimal, calm.`,
  },
  {
    id: 'shot-04-choice',
    seconds: 30,
    prompt: `${STYLE} Medium shot: ${RIMA} sitting calmly on a small smooth rock, clearly located away from the swing's path, with a gentle content expression (not sad, not angry). ${NOUR} still swinging gently in the background, unbothered, continuing to play normally. Only Rima, the rock, and Nour-on-the-swing visible (3 elements). No adult present anywhere in the frame.`,
  },
  {
    id: 'shot-05-effect',
    seconds: 20,
    prompt: `${STYLE} Wide shot: ${NOUR} stepping off the now-slowing swing on one side, while ${RIMA} is climbing onto the swing seat from a safe angle, and Nour is gently giving the swing a soft push from behind (never from in front). Swing, Nour, and Rima visible (3-4 elements). No adult present. Warm cheerful but calm lighting, everyone smiling gently.`,
  },
  {
    id: 'shot-06-naming-frame',
    seconds: 5,
    prompt: `${STYLE} A calm closing still frame: soft pale sage-green (#96CEB4) gradient background with a small simple warm sun icon and a tiny swing silhouette icon, no characters, absolutely no text of any kind, minimal and warm, signaling a gentle happy ending.`,
  },
];

async function generateShot(shot) {
  console.log(`\n--- ${shot.id} (${shot.seconds}s planned) ---`);
  const submit = await request('POST', '/v1/images/text-to-image', {
    body: { prompt: shot.prompt, aspect_ratio: '16:9', model: 'nano_banana_2', count: 1 },
  });
  console.log('submit:', submit.status, JSON.stringify(submit.json));
  if (submit.status < 200 || submit.status >= 300) {
    return { id: shot.id, ok: false, reason: `submit failed: ${submit.text}` };
  }
  const jobId = submit.json?.id;
  const started = Date.now();
  while (Date.now() - started < 2 * 60_000) {
    await sleep(6000);
    const poll = await request('GET', `/v1/images/${jobId}`);
    const image = poll.json?.image;
    if (image?.status) console.log(`  ${shot.id}: ${image.status} (+${Math.round((Date.now() - started) / 1000)}s)`);
    if (image?.status === 'completed') {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const resp = await fetch(image.resultUrls[0]);
      const bytes = Buffer.from(await resp.arrayBuffer());
      const filePath = path.join(OUT_DIR, `${shot.id}.png`);
      fs.writeFileSync(filePath, bytes);
      return { id: shot.id, ok: true, file: path.relative(ROOT, filePath), jobId };
    }
    if (image?.status === 'failed') {
      return { id: shot.id, ok: false, reason: image.error ?? 'failed without message' };
    }
  }
  return { id: shot.id, ok: false, reason: 'timed out after 2 minutes' };
}

async function main() {
  console.log('=== qiyami-alsaghira ep-01 "one-swing" — 6 stills, motion_story ===');
  const results = [];
  // Sequential, not parallel: keep load light and stop immediately on any
  // account-level failure (PUBLIC_ERROR_UNUSUAL_ACTIVITY) instead of burning
  // credit on a doomed batch.
  for (const shot of SHOTS) {
    const result = await generateShot(shot);
    results.push(result);
    if (!result.ok) {
      console.error(`\nSTOPPING after failure on ${shot.id}: ${result.reason}`);
      break;
    }
  }
  console.log('\n=== Summary ===');
  console.log(JSON.stringify(results, null, 2));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'production-log.json'), JSON.stringify({ runId: RUN_ID, shots: SHOTS.map((s) => ({ id: s.id, seconds: s.seconds })), results }, null, 2));
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
