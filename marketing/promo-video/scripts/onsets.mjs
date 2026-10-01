// Detects speech onsets (starts of each phrase after a pause) in every VO clip
// with ffmpeg silencedetect and stores them next to the clip timings, so the
// animation can land words on the real audio instead of hand-typed beats.
// Usage: node scripts/onsets.mjs --script src/egy/script-egy.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--script');
const script = JSON.parse(readFileSync(resolve(root, i > -1 ? process.argv[i + 1] : 'src/script.json'), 'utf8'));
const timingsPath = join(root, 'src', script.timings ?? 'voiceover.json');
const timings = JSON.parse(readFileSync(timingsPath, 'utf8'));

for (const scene of script.scenes) {
  const entry = timings[scene.id];
  if (!entry) continue;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', join(root, 'public', entry.file),
    '-af', 'silencedetect=noise=-32dB:d=0.07', '-f', 'null', '-'], { encoding: 'utf8' });
  const ends = [...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  entry.onsets = [0, ...ends.filter((e) => e < entry.durationSec - 0.1)].map((x) => Math.round(x * 1000) / 1000);
  console.log(`${scene.id}: ${entry.onsets.join(', ')}`);
}
writeFileSync(timingsPath, JSON.stringify(timings, null, 2));
