// Generate ONE plain character-sheet image (Rima + Nour) via the confirmed
// working route POST /v1/images/text-to-image — NO Characters API (that path
// is currently stuck pending on this account). Single detailed prompt only.
//
// Usage: node tools/playveo/generate-character-sheet-plain.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const RUN_ID = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const OUT_DIR = path.join(ROOT, 'assets', 'playveo-flux3-tests', `char-sheet-plain-${RUN_ID}`);
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

async function main() {
  const prompt = [
    'Character reference sheet, flat soft preschool cartoon illustration style, thick rounded soft outlines, warm flat colors, plain light neutral background, no text, no logos, no watermark.',
    'TWO full-body girl characters standing side by side, front view, same simple proportions and art style, clearly different so they are never confused:',
    'LEFT girl "Rima": about 4 years old, warm light-tan skin, black hair in two neat pigtails tied with simple pale sage-green ribbons, big round brown eyes, calm friendly expression, plain light-yellow short-sleeve t-shirt, plain light-blue shorts, simple brown sandals, bare head, no religious or cultural symbols on clothing.',
    'RIGHT girl "Nour": about 4 years old, medium-tan skin, short naturally wavy black hair with no ties, big round brown eyes, cheerful smiling expression, plain light sage-green short dress, simple brown sandals, bare head, no religious or cultural symbols on clothing.',
    'Both children same simple cartoon proportions and scale, clean flat lighting, single reference pose each.',
  ].join(' ');

  console.log('Submitting POST /v1/images/text-to-image ...');
  const submit = await request('POST', '/v1/images/text-to-image', {
    body: { prompt, aspect_ratio: '16:9', model: 'nano_banana_2', count: 1 },
  });
  console.log('Submit status:', submit.status, JSON.stringify(submit.json));
  if (submit.status < 200 || submit.status >= 300) { console.error('FAIL.', submit.text); process.exit(1); }
  const jobId = submit.json?.id;
  console.log('Job id:', jobId, '| creditCost:', submit.json?.creditCost);

  const started = Date.now();
  let final = null;
  while (Date.now() - started < 3 * 60_000) {
    await sleep(6000);
    const poll = await request('GET', `/v1/images/${jobId}`);
    const image = poll.json?.image;
    if (image?.status) console.log(`  status: ${image.status} (+${Math.round((Date.now() - started) / 1000)}s)`);
    if (image?.status === 'completed') { final = image; break; }
    if (image?.status === 'failed') { console.error('FAIL:', image.error); process.exit(1); }
  }
  if (!final) { console.error('Timed out after 3 minutes.'); process.exit(1); }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [i, url] of final.resultUrls.entries()) {
    const resp = await fetch(url);
    const bytes = Buffer.from(await resp.arrayBuffer());
    const filePath = path.join(OUT_DIR, `rima-nour-sheet-${i}.png`);
    fs.writeFileSync(filePath, bytes);
    console.log('Saved:', path.relative(ROOT, filePath), `(${bytes.length} bytes)`);
  }
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
