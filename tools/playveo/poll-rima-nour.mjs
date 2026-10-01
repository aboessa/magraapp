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

const r = await fetch(`${BASE}/v1/characters`, { headers: { Authorization: `Bearer ${KEY}` } });
const j = await r.json();
const mine = (j.characters ?? []).filter((c) => c.name === 'RimaQiyamiEp1' || c.name === 'NourQiyamiEp1');
console.log(JSON.stringify(mine, null, 2));
