// One-off test: does the "tag" reference mode (@name in prompt) keep the
// bird character consistent using a small compressed reference image?
// Costs 1 credit if it succeeds.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASE = 'https://autoflow-api.aboessa101.workers.dev';
function loadKey() {
  if (process.env.AUTOFLOW_API_KEY) return process.env.AUTOFLOW_API_KEY.trim();
  return fs.readFileSync(path.join(os.homedir(), '.majarra', 'autoflow.key'), 'utf8').trim();
}
const KEY = loadKey();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const imgPath = path.join(import.meta.dirname, '_ref-small2.jpg');
const b64 = fs.readFileSync(imgPath).toString('base64');

const prompt = "@zughb the tiny light-gray baby bird stands on the rim of his round nest on a branch, looking up at the open sky. His mother bird stays in the nest beside him. Warm bright daylight, no text.";

const body = {
  type: 'image',
  prompt,
  model: 'nano_banana2',
  aspectRatio: 'landscape',
  count: 1,
  quality: '1K',
  referenceImages: {
    images: [{ name: 'zughb', data: `data:image/jpeg;base64,${b64}`, mimeType: 'image/jpeg' }],
    mode: 'tag',
  },
};

console.log('prompt chars:', prompt.length, ' ref bytes(b64):', b64.length);

const create = await fetch(BASE + '/api/jobs', {
  method: 'POST',
  headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const createText = await create.text();
console.log('create status', create.status, createText.slice(0, 500));
let createJson;
try { createJson = JSON.parse(createText); } catch { process.exit(1); }
const jobId = createJson.jobId;
if (!jobId) process.exit(1);

const started = Date.now();
let missing = 0;
while (Date.now() - started < 8 * 60 * 1000) {
  await sleep(8000);
  const list = await fetch(BASE + '/api/jobs?limit=20', { headers: { 'X-API-Key': KEY } });
  const json = await list.json();
  const job = json.jobs.find((j) => j.id === jobId);
  if (!job) { if (++missing >= 4) { console.log('vanished from queue'); process.exit(1); } continue; }
  missing = 0;
  console.log(`[${Math.round((Date.now() - started) / 1000)}s]`, job.status);
  if (job.status === 'completed') {
    const dl = await fetch(BASE + `/api/jobs/${jobId}/download`, { headers: { 'X-API-Key': KEY } });
    const meta = await dl.json();
    const file = await fetch(BASE + meta.url, { headers: { 'X-API-Key': KEY } });
    const buf = Buffer.from(await file.arrayBuffer());
    const dest = path.join(import.meta.dirname, '..', '..', 'assets', 'images', 'stories', 'act-s1', 'test-tag-mode-2.png');
    fs.writeFileSync(dest, buf);
    console.log('saved', dest, buf.length, 'bytes');
    process.exit(0);
  }
  if (job.status === 'failed') { console.log('failed:', job.error_message); process.exit(1); }
}
console.log('timed out');
