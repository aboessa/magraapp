// Probe AutoFlow: confirm what prompt the API actually stored for each job, and
// pull each job's file to a scratch folder so job -> image mapping can be verified.
// Key is read from $env:AUTOFLOW_API_KEY, else from %USERPROFILE%\.majarra\autoflow.key.
// The key is never written into this repository.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASE = 'https://autoflow-api.aboessa101.workers.dev';
const SCRATCH = path.join(import.meta.dirname, '_scratch');

function loadKey() {
  if (process.env.AUTOFLOW_API_KEY) return process.env.AUTOFLOW_API_KEY.trim();
  const p = path.join(os.homedir(), '.majarra', 'autoflow.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('No API key. Set $env:AUTOFLOW_API_KEY or create ~/.majarra/autoflow.key');
}
const KEY = loadKey();

const list = await (await fetch(BASE + '/api/jobs?limit=20', {
  headers: { 'X-API-Key': KEY },
})).json();

fs.mkdirSync(SCRATCH, { recursive: true });

for (const j of list.jobs ?? []) {
  console.log(`\njob ${j.id}`);
  console.log(`  status        ${j.status}`);
  console.log(`  settings      ${j.settings}`);
  console.log(`  stored prompt ${String(j.prompt).slice(0, 220)}`);
  console.log(`  result_url    ${j.result_url}`);
  console.log(`  size          ${j.file_size}  worker ${j.assigned_to}`);
  console.log(`  created       ${j.created_at}  completed ${j.completed_at}`);
  if (j.status !== 'completed') continue;
  const res = await fetch(`${BASE}/api/jobs/${j.id}/file`, { headers: { 'X-API-Key': KEY } });
  if (!res.ok) { console.log(`  file          HTTP ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = path.join(SCRATCH, `${j.id}.png`);
  fs.writeFileSync(dest, buf);
  console.log(`  file          saved ${buf.length} bytes -> tools/autoflow/_scratch/${j.id}.png`);
}
