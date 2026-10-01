// Generates one voiceover clip per scene with Gemini TTS, then writes
// src/voiceover.json with each clip's measured duration so the video timeline
// follows the narration exactly.
//
// Key: GEMINI_API_KEY from the environment or the repo's .env.local (gitignored).
// Usage: node scripts/voiceover.mjs [--only s3-logo] [--voice Kore] [--force]
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '..', '..');
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

// --script src/script-30.json selects another cut; its clips and timings live
// in their own folder/file so cuts never overwrite each other.
const scriptPath = resolve(root, arg('script') ?? 'src/script.json');
const script = JSON.parse(readFileSync(scriptPath, 'utf8'));
const voSub = script.voDir ?? 'vo';
const voDir = join(root, 'public', voSub);
const timingsPath = join(root, 'src', script.timings ?? 'voiceover.json');
const force = process.argv.includes('--force');

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envFile = join(repo, '.env.local');
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  throw new Error('GEMINI_API_KEY not found in env or .env.local');
}

const voice = arg('voice') ?? script.voice;
const model = script.model;
const only = arg('only');
const key = loadKey();

mkdirSync(voDir, { recursive: true });
const timings = existsSync(timingsPath) ? JSON.parse(readFileSync(timingsPath, 'utf8')) : {};

async function synthesize(scene) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: scene.vo, speech_metadata: { style: `${script.style} ${scene.style ?? ''}`.trim() } }],
    }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { voice } },
    },
  };
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part) throw new Error(`no audio in response: ${JSON.stringify(json).slice(0, 400)}`);
      return part.inlineData;
    }
    const text = await res.text();
    // Retry only transient failures; auth/quota/validation errors stop the batch.
    // The free tier allows only a few requests per minute, so honour the
    // server's suggested retry delay on 429.
    if (![429, 500, 503].includes(res.status) || attempt === maxAttempts) {
      throw new Error(`TTS ${res.status}: ${text.slice(0, 500)}`);
    }
    const hinted = Number(text.match(/retry in ([\d.]+)s/i)?.[1]);
    const waitMs = Number.isFinite(hinted) ? Math.ceil(hinted * 1000) + 1500 : 2000 * attempt;
    console.log(`\n  ${res.status}, retrying in ${Math.round(waitMs / 1000)}s`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

function toWav(inline, outPath) {
  const buf = Buffer.from(inline.data, 'base64');
  const mime = inline.mimeType ?? '';
  const tmp = `${outPath}.raw`;
  writeFileSync(tmp, buf);
  const rate = Number(mime.match(/rate=(\d+)/)?.[1] ?? 24000);
  const isPcm = /L16|pcm/i.test(mime) || !/wav|mp3|ogg/i.test(mime);
  const input = isPcm ? ['-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', tmp] : ['-i', tmp];
  // Trim leading/trailing silence and normalise loudness for a clean ad mix.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...input,
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11',
    '-ar', '48000', '-ac', '1', outPath]);
  unlinkSync(tmp);
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', outPath]).toString().trim();
  return Number(dur);
}

for (const scene of script.scenes) {
  if (only && scene.id !== only) continue;
  const out = join(voDir, `${scene.id}.wav`);
  if (existsSync(out) && !force && timings[scene.id]?.text === scene.vo) {
    console.log(`skip ${scene.id} (unchanged)`);
    continue;
  }
  process.stdout.write(`${scene.id} ... `);
  const inline = await synthesize(scene);
  const durationSec = toWav(inline, out);
  timings[scene.id] = { file: `${voSub}/${scene.id}.wav`, durationSec, text: scene.vo, voice, mime: inline.mimeType };
  writeFileSync(timingsPath, JSON.stringify(timings, null, 2));
  console.log(`${durationSec.toFixed(2)}s`);
}
// Optional script-level "tempo" (e.g. 1.1): speed clips up with atempo, which
// keeps pitch. Idempotent: each clip records the tempo already applied.
const tempo = script.tempo ?? 1;
for (const scene of script.scenes) {
  const entry = timings[scene.id];
  if (!entry || (only && scene.id !== only)) continue;
  const applied = entry.tempo ?? 1;
  if (Math.abs(applied - tempo) < 1e-6) continue;
  const out = join(voDir, `${scene.id}.wav`);
  const tmp = `${out}.tmp.wav`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-af', `atempo=${tempo / applied}`, '-ar', '48000', '-ac', '1', tmp]);
  renameSync(tmp, out);
  entry.durationSec = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim());
  entry.tempo = tempo;
  console.log(`tempo ${scene.id} x${tempo} -> ${entry.durationSec.toFixed(2)}s`);
}
writeFileSync(timingsPath, JSON.stringify(timings, null, 2));
console.log(`timings -> ${timingsPath}`);
