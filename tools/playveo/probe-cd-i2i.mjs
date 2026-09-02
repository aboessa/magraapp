// Does /v1/images/image-to-image work well enough to build challenge.png from
// reference_full.png?
//
// This matters because the whole point of the pack is a PAIR: challenge.png must
// show the SAME artwork as reference_full.png with one side replaced by dashed
// guides. Generating the challenge independently with text-to-image cannot do that
// — two T2I calls with the same style produce two different butterflies, so the
// child's reference would not match the puzzle.
//
// The repo already has a verdict against i2i: probe-i2i.mjs records six live jobs
// returning byte-identical output (sha 963168c7cbe5cb0b) with the prompt ignored,
// and generate.mjs:101 says it "cannot be used as a character reference". But that
// was measured on story panels, where the ask was to RESTAGE a scene. Here the ask
// is the opposite and much weaker: keep the image almost exactly as-is and modify
// one half. If the endpoint biases hard toward the source image, that bias is
// working in our favour for the first time.
//
// probe-cache.mjs also proposed that the provider caches on the SOURCE IMAGE and
// replays the first result on a cache hit. So both probes here append padding after
// the JPEG EOI marker (FFD9) to make the uploaded bytes unique while leaving every
// decoded pixel identical. That separates "endpoint ignores prompts" from
// "endpoint served a cached result".
//
// Two jobs. Variant A is the real challenge prompt. Variant B is deliberate
// nonsense: if A and B come back identical, the prompt is being ignored and i2i is
// unusable regardless of caching.
//
// Usage: node tools/playveo/probe-cd-i2i.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const SRC = path.join(ROOT, 'tools/playveo/output/probe-butterfly-reference.jpg');
const OUT = path.join(ROOT, 'tools/playveo/output');

function loadKey() {
  if (process.env.PLAYVEO_API_KEY) return process.env.PLAYVEO_API_KEY;
  const env = path.join(ROOT, '.env.local');
  const m = fs.readFileSync(env, 'utf8').match(/^\s*PLAYVEO_API_KEY\s*=\s*(.+)$/m);
  if (!m) throw new Error('PLAYVEO_API_KEY not found');
  return m[1].trim().replace(/^["']|["']$/g, '');
}
const KEY = loadKey();

async function api(method, route, body) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${route} ${res.status} ${text.slice(0, 400)}`);
  return json;
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);

/// Unique bytes, identical pixels: everything after the JPEG EOI marker is outside
/// the image stream, so decoders ignore it.
function bustedDataUrl(buf, tag) {
  const padded = Buffer.concat([buf, Buffer.from(`\n<!-- cd-probe ${tag} ${Date.now()} -->`)]);
  return { url: `data:image/jpeg;base64,${padded.toString('base64')}`, sha: sha(padded) };
}

async function waitFor(id) {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const j = await api('GET', `/v1/images/${id}`);
    const img = j.image || j;
    if (img.status === 'completed' || img.status === 'ready') return img;
    if (img.status === 'failed') throw new Error('failed ' + JSON.stringify(j).slice(0, 300));
  }
  throw new Error('timeout');
}

const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'complete-drawing.manifest.json'), 'utf8'));
const butterfly = manifest.assets[0];
const src = fs.readFileSync(SRC);
console.log(`source ${path.basename(SRC)} sha=${sha(src)} ${src.length} bytes`);

const variants = [
  {
    label: 'A-real-challenge',
    prompt:
      'Keep the left half of this butterfly exactly as it is, unchanged and fully colored. ' +
      'Erase the right half and replace it with only very light gray dashed outline guides ' +
      'showing where the missing symmetrical wing and its decorative circles belong. ' +
      'The right half must contain no color at all, just thin light gray dashed construction lines on white.',
    file: '_cd-i2i-A.jpg',
  },
  {
    label: 'B-nonsense',
    prompt: 'A bright red sports car parked in a desert at sunset, photorealistic.',
    file: '_cd-i2i-B.jpg',
  },
];

const results = [];
for (const v of variants) {
  const { url, sha: upSha } = bustedDataUrl(src, v.label);
  console.log(`\n${v.label}: upload sha=${upSha}`);
  const res = await api('POST', '/v1/images/image-to-image', {
    prompt: v.prompt,
    aspect_ratio: '1:1',
    model: manifest.model,
    count: 1,
    image: url,
  });
  console.log(`  job ${res.id} cost=${res.creditCost}`);
  const img = await waitFor(res.id);
  const outUrl = (img.resultUrls || img.result_urls || [img.url])[0];
  const buf = Buffer.from(await (await fetch(outUrl)).arrayBuffer());
  const dst = path.join(OUT, v.file);
  fs.writeFileSync(dst, buf);
  const h = sha(buf);
  results.push({ label: v.label, sha: h, file: dst });
  console.log(`  result sha=${h} ${buf.length} bytes -> ${v.file}`);
}

console.log('\n──── verdict ────');
if (results[0].sha === results[1].sha) {
  console.log('PROMPT IGNORED: variant A and B are byte-identical.');
  console.log('i2i is unusable for building the challenge. Use the local-composite path.');
} else if (results.some((r) => r.sha === sha(src))) {
  console.log('PASSTHROUGH: a result equals the source bytes. i2i unusable.');
} else {
  console.log('Prompt HAS an effect (A and B differ). Inspect _cd-i2i-A.jpg by eye:');
  console.log('  1. Is the LEFT half still the same butterfly, unchanged and colored?');
  console.log('  2. Is the RIGHT half now light gray dashed guides with no color?');
}
