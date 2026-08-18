// Majarra — diagnostic probe for PlayVeo image-to-image.
//
// Why this exists: two image-to-image jobs submitted with completely different
// prompts against the same reference returned BYTE-IDENTICAL output
// (SHA256 963168c7cbe5cb0b for both a 735-char restaging instruction and a
// 464-char scene-only prompt). That is not weak prompt adherence, it is the prompt
// having no effect at all, and the cause changes what we do next:
//
//   * If a nonsense prompt ALSO returns the same bird-in-nest image, the provider
//     is either caching on the reference image or dropping the prompt. Either way
//     image-to-image cannot restage a panel and the character-lock plan has to be
//     rebuilt on text-to-image.
//   * If a nonsense prompt DOES change the output, the prompt is read but the
//     reference dominates it, and a strength parameter may rebalance them.
//
// Each probe is one job at 0.15 credits. Usage:
//   node tools/playveo/probe-i2i.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import process from 'node:process';

const BASE = 'https://playveo-api.aboessa101.workers.dev';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const REF = path.join(ROOT, 'assets/images/stories/act-s1-playveo/page-001.jpg');
const OUT = path.join(ROOT, 'assets/images/stories/act-s1-playveo');

function loadKey() {
  if (process.env.PLAYVEO_API_KEY) return process.env.PLAYVEO_API_KEY.trim();
  const p = path.join(os.homedir(), '.majarra', 'playveo.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('No API key. Set $env:PLAYVEO_API_KEY or create ~/.majarra/playveo.key');
}
const KEY = loadKey();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, route, body) {
  const res = await fetch(BASE + route, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${route}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function waitFor(id) {
  for (let i = 0; i < 48; i++) {
    await sleep(10_000);
    const r = await api('GET', `/v1/images/${id}`);
    const img = r.image ?? r;
    if (img.status === 'completed') return img;
    if (img.status === 'failed') throw new Error(`failed: ${img.error}`);
  }
  throw new Error('timeout');
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

async function probe(label, payload, file) {
  console.log(`\n--- ${label}`);
  console.log(`    payload keys: ${Object.keys(payload).join(', ')}`);
  const res = await api('POST', '/v1/images/image-to-image', payload);
  // Echoed fields matter: if `strength` comes back unchanged after being sent
  // explicitly, the provider is ignoring the parameter rather than honouring it.
  console.log(`    job ${res.id}  cost=${res.creditCost}  strength=${res.strength}  model=${res.model}`);
  const img = await waitFor(res.id);
  const r = await fetch(img.resultUrls[0], { headers: { Authorization: `Bearer ${KEY}` } });
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(path.join(OUT, file), buf);
  console.log(`    saved ${file}  ${buf.length} bytes  sha=${sha(buf)}`);
  return sha(buf);
}

async function main() {
  if (!fs.existsSync(REF)) throw new Error(`reference missing: ${REF}`);
  const refBuf = fs.readFileSync(REF);
  const dataUrl = `data:image/jpeg;base64,${refBuf.toString('base64')}`;
  console.log(`reference page-001.jpg  ${refBuf.length} bytes  sha=${sha(refBuf)}`);
  console.log('known i2i output sha from both earlier reftest prompts: 963168c7cbe5cb0b');

  const results = {};

  // Probe 1: a prompt with nothing in common with the reference. If the bird in the
  // nest comes back anyway, the prompt is not reaching the model.
  results.nonsense = await probe(
    'nonsense prompt (a red sports car in a desert) — tests whether the prompt is read at all',
    {
      prompt: 'A bright red sports car parked on an empty desert road at noon, photorealistic, no animals, no trees, no birds.',
      aspect_ratio: '16:9',
      count: 1,
      image: dataUrl,
    },
    '_probe-nonsense.jpg'
  );

  // Probe 2: same restaging prompt as the reftest, but asking for maximum deviation
  // from the source. Also checks whether the echoed `strength` reflects the input.
  results.strength = await probe(
    'explicit strength=1.0 with the page-003 restaging prompt — tests whether strength is honoured',
    {
      prompt: 'The same baby bird character from the reference image, now FLYING in open sky with wings spread wide, seen from a distance. His nest is far away and small in the background. Wide shot, completely different camera angle from the reference.',
      aspect_ratio: '16:9',
      count: 1,
      image: dataUrl,
      strength: 1.0,
    },
    '_probe-strength.jpg'
  );

  console.log('\n================ VERDICT ================');
  console.log(`nonsense-prompt output sha : ${results.nonsense}`);
  console.log(`strength=1.0 output sha    : ${results.strength}`);
  console.log('earlier reftest output sha : 963168c7cbe5cb0b');
  if (results.nonsense === '963168c7cbe5cb0b') {
    console.log('\n=> The prompt is IGNORED or the result is cached on the reference image.');
    console.log('   image-to-image cannot restage a panel. Rebuild panel generation on text-to-image.');
  } else {
    console.log('\n=> The prompt IS read (nonsense prompt changed the output).');
    console.log('   The reference was simply dominating the earlier prompts. Inspect the strength probe.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
