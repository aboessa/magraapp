// Create Rima & Nour as PlayVeo Characters (POST /v1/characters), wait for
// both to become "ready", then generate ONE combined character-sheet image
// referencing both by name (POST /v1/images/text-to-image). Uses the real
// documented routes from https://playveo.online/docs/llms (fetched 2026-09-29).
// Throwaway/reference output only.
//
// Usage: node tools/playveo/create-rima-nour-characters.mjs

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

const CHAR_DEFS = [
  {
    name: 'RimaQiyamiEp1',
    prompt: 'Flat soft preschool cartoon character, thick rounded soft outlines, warm colors, plain neutral background, no text. A girl about 4 years old named Rima: warm light-tan skin, black hair in two neat pigtails with simple pale sage-green ties, big brown eyes, calm curious expression, plain light-yellow short-sleeve shirt, plain light-blue shorts, simple sandals, no head covering, no religious or cultural symbols, simple child proportions.',
  },
  {
    name: 'NourQiyamiEp1',
    prompt: 'Flat soft preschool cartoon character, thick rounded soft outlines, warm colors, plain neutral background, no text. A girl about 4 years old named Nour: medium-tan skin, short naturally wavy black hair with no ties, big brown eyes, cheerful expression, plain light sage-green short dress, simple sandals, no head covering, no religious or cultural symbols, simple child proportions, same art style and scale as Rima.',
  },
];

async function main() {
  console.log('=== Step 1: create characters ===\n');
  for (const def of CHAR_DEFS) {
    const r = await request('POST', '/v1/characters', { body: { name: def.name, prompt: def.prompt } });
    console.log(`POST /v1/characters (${def.name}) -> ${r.status}`, JSON.stringify(r.json));
    if (r.status < 200 || r.status >= 300) { console.error('FAIL creating', def.name, r.text); process.exit(1); }
  }

  console.log('\n=== Step 2: poll until both are ready ===\n');
  const deadline = Date.now() + 4 * 60_000;
  const readyNames = new Set();
  while (Date.now() < deadline && readyNames.size < CHAR_DEFS.length) {
    await sleep(8000);
    const list = await request('GET', '/v1/characters');
    for (const def of CHAR_DEFS) {
      const c = (list.json?.characters ?? []).find((x) => x.name === def.name);
      if (c) console.log(`  ${def.name}: ${c.status}`);
      if (c?.status === 'ready') readyNames.add(def.name);
      if (c?.status === 'failed') { console.error(`FAIL: ${def.name} failed:`, c.error); process.exit(1); }
    }
  }
  if (readyNames.size < CHAR_DEFS.length) { console.error('Timed out waiting for characters to become ready.'); process.exit(1); }
  console.log('\nBoth characters ready.');

  console.log('\n=== Step 3: generate combined character-sheet image ===\n');
  const sheetPrompt = 'Character reference sheet layout, flat soft preschool cartoon style, plain neutral light background, no text, no logos. Show Rima and Nour standing side by side, full body, front view, same simple art style and scale, clearly distinct outfits and hair as designed.';
  const submit = await request('POST', '/v1/images/text-to-image', {
    body: { prompt: sheetPrompt, aspect_ratio: '16:9', characters: ['RimaQiyamiEp1', 'NourQiyamiEp1'], count: 1 },
  });
  console.log('Submit:', submit.status, JSON.stringify(submit.json));
  if (submit.status < 200 || submit.status >= 300) { console.error('FAIL.', submit.text); process.exit(1); }
  const jobId = submit.json?.id;

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
  if (!final) { console.error('Timed out.'); process.exit(1); }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [i, url] of final.resultUrls.entries()) {
    const resp = await fetch(url);
    const bytes = Buffer.from(await resp.arrayBuffer());
    const filePath = path.join(OUT_DIR, `rima-nour-sheet-${i}.png`);
    fs.writeFileSync(filePath, bytes);
    console.log('Saved:', path.relative(ROOT, filePath));
  }
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
