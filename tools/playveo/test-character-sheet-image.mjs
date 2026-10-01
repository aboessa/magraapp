// Generate ONE character-sheet reference image for Rima & Nour
// (qiyami-alsaghira ep-01) via PlayVeo. Discovers the image endpoint first
// (docs screenshot only showed /v1/videos), then submits one image job.
// Throwaway/reference output only -- written under
// assets/playveo-flux3-tests/, NOT wired into production assets.
//
// Usage: node tools/playveo/test-character-sheet-image.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const RUN_ID = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const OUT_DIR = path.join(ROOT, 'assets', 'playveo-flux3-tests', `char-sheet-${RUN_ID}`);
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
  console.log('=== Discovering image endpoint on playveo-api ===\n');
  const candidates = ['/v1/images', '/v1/image', '/v1/flux/images'];
  let workingPath = null;
  for (const p of candidates) {
    const r = await request('GET', `${p}?limit=1`);
    console.log(`GET ${p} -> ${r.status}`);
    if (r.status === 200 || r.status === 401 || r.status === 400) { workingPath = p; if (r.status !== 401) break; }
  }
  if (!workingPath) { console.error('No image endpoint found among candidates. Aborting.'); process.exit(1); }
  console.log('\nUsing image endpoint:', workingPath);

  const prompt = [
    'Character reference sheet, flat soft preschool cartoon style, thick rounded soft outlines, warm colors, plain neutral light background, no text, no logos.',
    'TWO separate full-body child character turnarounds side by side on one sheet:',
    'LEFT — "Rima": girl about 4 years old, warm light-tan skin, black hair in two neat pigtails with simple pale sage-green (#96CEB4) ties, big brown eyes, calm curious expression, plain light-yellow short-sleeve shirt, plain light-blue shorts, simple sandals, no head covering, no religious or cultural symbols.',
    'RIGHT — "Nour": girl about 4 years old, medium-tan skin, short naturally wavy black hair with no ties, big brown eyes, cheerful expression, plain light sage-green (#96CEB4) short dress, simple sandals, no head covering, no religious or cultural symbols.',
    'Both children same simple proportions, same art style, front view and 3/4 view for each, small color swatches beside each character showing exact outfit colors.',
  ].join(' ');

  const body = { prompt, aspect_ratio: '16:9', resolution: '1080p' };
  console.log('\nSubmitting image job:', JSON.stringify({ ...body, prompt: `${prompt.slice(0, 60)}...` }));
  const submit = await request('POST', workingPath, { body });
  console.log('Submit status:', submit.status, JSON.stringify(submit.json).slice(0, 500));
  if (submit.status < 200 || submit.status >= 300) { console.error('FAIL.', submit.text); process.exit(1); }

  const job = submit.json?.image ?? submit.json?.data ?? submit.json;
  const jobId = job?.id ?? job?.job_id;
  console.log('Job id:', jobId);
  if (!jobId) { console.error('No job id.', JSON.stringify(submit.json)); process.exit(1); }

  const started = Date.now();
  let final = null;
  while (Date.now() - started < 4 * 60_000) {
    const poll = await request('GET', `${workingPath}/${jobId}`);
    const item = poll.json?.image ?? poll.json?.data ?? poll.json;
    if (item?.status) console.log(`  status: ${item.status} (+${Math.round((Date.now() - started) / 1000)}s)`);
    if (item?.status === 'completed') { final = item; break; }
    if (item?.status === 'failed') { console.error('FAIL:', item.error ?? poll.text); process.exit(1); }
    await sleep(8_000);
  }
  if (!final) { console.error('Timed out.'); process.exit(1); }

  const url = final.imageUrl ?? final.image_url ?? final.url ?? final.videoUrl;
  console.log('\nResult URL:', url);
  const resp = await fetch(url);
  const bytes = Buffer.from(await resp.arrayBuffer());
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ext = url.endsWith('.mp4') ? 'mp4' : 'png';
  const filePath = path.join(OUT_DIR, `rima-nour-character-sheet.${ext}`);
  fs.writeFileSync(filePath, bytes);
  console.log('Saved:', path.relative(ROOT, filePath), `(${bytes.length} bytes)`);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
