// Probe for the complete-drawing pair strategy. One billed T2I job.
//
// Answers three things the generator design depends on, none of which are
// recorded anywhere in the repo:
//   1. What bytes does the provider actually return — PNG or JPEG? The manifest
//      names files reference_full.png / thumbnail.jpg, and every older script in
//      this repo saves resultUrls straight to .jpg. If the provider returns JPEG,
//      writing it to a .png path produces a file whose extension lies.
//   2. Is a `seed` parameter accepted and echoed back? The manifest asks for
//      "same_seed_per_activity" but nothing proves the API supports seeds.
//   3. Does the response expose any strength/seed metadata worth pinning.
//
// Usage: node tools/playveo/probe-complete-drawing.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = 'https://playveo-api.aboessa101.workers.dev';

function loadKey() {
  if (process.env.PLAYVEO_API_KEY) return process.env.PLAYVEO_API_KEY;
  const env = path.join(ROOT, '.env.local');
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, 'utf8').match(/^\s*PLAYVEO_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('PLAYVEO_API_KEY not found');
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
  if (!res.ok) throw new Error(`${route} ${res.status} ${text.slice(0, 500)}`);
  return json;
}

const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'complete-drawing.manifest.json'), 'utf8'));
const a = manifest.assets[0];

const submit = await api('POST', '/v1/images/text-to-image', {
  prompt: `${a.prompt_full} ${manifest.master_style}`.slice(0, 1800),
  aspect_ratio: '1:1',
  model: manifest.model,
  count: 1,
  seed: 123456,
  negative_prompt: manifest.negative_prompt,
});
console.log('submit response keys:', Object.keys(submit).join(', '));
console.log(JSON.stringify(submit, null, 2).slice(0, 900));

const id = submit.id;
let img;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const j = await api('GET', `/v1/images/${id}`);
  img = j.image || j;
  console.log(`  poll ${i} status=${img.status}`);
  if (img.status === 'completed' || img.status === 'ready') break;
  if (img.status === 'failed') throw new Error('failed: ' + JSON.stringify(j).slice(0, 400));
}
console.log('\nfinal record keys:', Object.keys(img).join(', '));
console.log(JSON.stringify(img, null, 2).slice(0, 1200));

const url = (img.resultUrls || img.result_urls || [img.url])[0];
console.log('\nurl:', url);
const r = await fetch(url);
console.log('content-type:', r.headers.get('content-type'));
const buf = Buffer.from(await r.arrayBuffer());
const png = buf[0] === 0x89 && buf[1] === 0x50;
const jpg = buf[0] === 0xff && buf[1] === 0xd8;
console.log(`bytes: ${buf.length}  magic=${buf.slice(0, 4).toString('hex')}  -> ${png ? 'PNG' : jpg ? 'JPEG' : 'UNKNOWN'}`);

const out = path.join(ROOT, 'tools/playveo/output/probe-butterfly-reference');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out + (png ? '.png' : '.jpg'), buf);
console.log('saved', out + (png ? '.png' : '.jpg'));
