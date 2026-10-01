import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = 'https://playveo-api.aboessa101.workers.dev';

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
const KEY = loadKey();

async function req(method, p, body) {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  return { status: r.status, text: t };
}

const listResp = await req('GET', '/v1/images?limit=50');
const parsed = JSON.parse(listResp.text);
const statuses = {};
for (const img of parsed.images ?? []) statuses[img.status] = (statuses[img.status] ?? 0) + 1;
console.log('status counts:', statuses);
const completed = (parsed.images ?? []).find((i) => i.status === 'completed');
console.log('\nfirst completed image job (if any):', JSON.stringify(completed, null, 2));
const failedSample = (parsed.images ?? []).filter((i) => i.status === 'failed').slice(0, 5);
console.log('\nfailed samples:', JSON.stringify(failedSample.map((f) => ({ id: f.id, model: f.model, mode: f.mode, error: f.error, createdAt: f.createdAt })), null, 2));
