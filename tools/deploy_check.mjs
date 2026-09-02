import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const API_DIR = path.join(ROOT, 'dashboard', 'api');

function checkKey(name, filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      return { exists: true, len: content.length, preview: content.slice(0,10)+'...' };
    }
  } catch {}
  return { exists: false };
}

console.log('=== Keys check ===');
console.log('HOME', os.homedir());
console.log('playveo.key', checkKey('playveo', path.join(os.homedir(), '.majarra', 'playveo.key')));
console.log('google-ai.key', checkKey('google-ai', path.join(os.homedir(), '.majarra', 'google-ai.key')));
console.log('autoflow.key', checkKey('autoflow', path.join(os.homedir(), '.majarra', 'autoflow.key')));

console.log('\n=== Local D1 counts (via wrangler) ===');
try {
  const out = execSync('npx wrangler d1 execute majarra-db --local --command "SELECT status, count(*) as c FROM games GROUP BY status" --json', { cwd: API_DIR, encoding: 'utf-8', timeout: 30000 });
  console.log(out.slice(0, 4000));
} catch (e) {
  console.log('LOCAL count failed:', e.message?.slice(0,500));
  console.log(e.stdout?.toString().slice(0,2000));
  console.log(e.stderr?.toString().slice(0,2000));
}

console.log('\n=== Remote D1 counts ===');
try {
  const out = execSync('npx wrangler d1 execute majarra-db --remote --command "SELECT status, count(*) as c FROM games GROUP BY status" --json', { cwd: API_DIR, encoding: 'utf-8', timeout: 30000 });
  console.log(out.slice(0, 4000));
} catch (e) {
  console.log('REMOTE count failed:', e.message?.slice(0,500));
  console.log(e.stdout?.toString().slice(0,2000));
  console.log(e.stderr?.toString().slice(0,2000));
}

console.log('\n=== Games detailed remote ===');
try {
  const out = execSync('npx wrangler d1 execute majarra-db --remote --command "SELECT engine_id, count(*) as c FROM games WHERE status=\'published\' GROUP BY engine_id"', { cwd: API_DIR, encoding: 'utf-8', timeout: 30000 });
  console.log(out.slice(0, 5000));
} catch (e) {
  console.log('detailed failed', e.message.slice(0,500));
}
