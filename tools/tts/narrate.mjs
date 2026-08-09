// Majarra — Gemini TTS narration runner for illustrated stories.
//
// Usage (from repo root):
//   node tools/tts/narrate.mjs --dry                  # print what would be sent, no API call
//   node tools/tts/narrate.mjs --page 1               # generate one page
//   node tools/tts/narrate.mjs --all                  # generate all 8 pages
//   node tools/tts/narrate.mjs --all --voice Aoede    # override the voice
//
// The API key is read from $env:GOOGLE_AI_API_KEY (or $env:GEMINI_API_KEY), else
// from %USERPROFILE%\.majarra\google-ai.key. It is never written into this repository.
//
// Output: 24 kHz 16-bit mono WAV masters. The story spec delivers .m4a, which needs
// a separate ffmpeg pass; ffmpeg is not installed on this machine.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = path.join(import.meta.dirname, 'act-s1.narration.json');

// PCM shape returned by the Gemini TTS models.
const SAMPLE_RATE = 24000;
const BITS = 16;
const CHANNELS = 1;

function loadKey() {
  const env = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (env) return env.trim();
  const p = path.join(os.homedir(), '.majarra', 'google-ai.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error(
    'No Google AI Studio key.\n' +
    '  Set it for this shell:  $env:GOOGLE_AI_API_KEY = "<key>"\n' +
    '  Or store it once:       Set-Content "$env:USERPROFILE\\.majarra\\google-ai.key" "<key>" -NoNewline\n' +
    '  Get a key at https://aistudio.google.com/apikey'
  );
}

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const OPT = {
  dry: !!arg('dry'),
  all: !!arg('all'),
  page: typeof arg('page') === 'string' ? Number(arg('page')) : undefined,
  voice: typeof arg('voice') === 'string' ? arg('voice') : undefined,
};

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const OUT_DIR = path.join(ROOT, manifest.out_dir);
const VOICE = OPT.voice ?? manifest.voice;

// The documented steering pattern is instructions followed by the text to read.
function buildRequestText(line) {
  return `${manifest.global_style}\n\n${line.style}\n\nRead exactly this and nothing else:\n${line.text}`;
}

// Minimal 44-byte RIFF/WAVE header for raw little-endian PCM.
function wavHeader(dataBytes) {
  const blockAlign = (CHANNELS * BITS) / 8;
  const byteRate = SAMPLE_RATE * blockAlign;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + dataBytes, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16);          // fmt chunk size
  h.writeUInt16LE(1, 20);           // PCM
  h.writeUInt16LE(CHANNELS, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(BITS, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(dataBytes, 40);
  return h;
}

function durationMs(pcmBytes) {
  return Math.round((pcmBytes / ((SAMPLE_RATE * CHANNELS * BITS) / 8)) * 1000);
}

async function synthesize(line, key) {
  const body = {
    contents: [{ parts: [{ text: buildRequestText(line) }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
      },
    },
  };

  const res = await fetch(`${API_ROOT}/${manifest.model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`);

  const json = JSON.parse(text);
  const cand = json.candidates?.[0];
  const inline = cand?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline?.data) {
    throw new Error(
      `no audio returned (finishReason=${cand?.finishReason ?? 'none'}). ` +
      'This model has known empty-response reports for some non-English prompts; ' +
      'retry, or try another voice with --voice.'
    );
  }
  return { pcm: Buffer.from(inline.data, 'base64'), mimeType: inline.mimeType };
}

async function main() {
  let targets = manifest.lines;
  if (OPT.page) targets = manifest.lines.filter((l) => l.page === OPT.page);
  else if (!OPT.all && !OPT.dry) {
    console.log('Nothing to do. Pass --dry, --page <n> or --all.');
    return;
  }
  if (!targets.length) throw new Error(`no line for --page ${OPT.page}`);

  console.log(`model=${manifest.model}  voice=${VOICE}  lang=${manifest.language}  lines=${targets.length}`);

  if (OPT.dry) {
    for (const l of targets) {
      console.log(`\n--- page ${l.page} -> ${manifest.out_dir}/${l.file}`);
      console.log(buildRequestText(l));
    }
    console.log('\nDry run only. No request sent, no key needed.');
    return;
  }

  const key = loadKey();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const report = [];
  for (const line of targets) {
    try {
      const { pcm, mimeType } = await synthesize(line, key);
      const dest = path.join(OUT_DIR, line.file);
      fs.writeFileSync(dest, Buffer.concat([wavHeader(pcm.length), pcm]));
      const ms = durationMs(pcm.length);
      const drift = ms - line.planned_duration_ms;
      console.log(
        `page ${line.page}  ${line.file}  ${ms} ms  ` +
        `(planned ${line.planned_duration_ms}, ${drift >= 0 ? '+' : ''}${drift})  ${mimeType}`
      );
      report.push({
        page: line.page,
        id: line.id,
        file: `${manifest.out_dir}/${line.file}`,
        measuredDurationMs: ms,
        plannedDurationMs: line.planned_duration_ms,
        autoTurnAfterMs: line.page === 8 ? null : ms + 1000,
      });
    } catch (err) {
      console.error(`page ${line.page} FAILED: ${err.message}`);
    }
  }

  if (report.length) {
    const p = path.join(OUT_DIR, '_durations.json');
    fs.writeFileSync(p, JSON.stringify({ voice: VOICE, model: manifest.model, pages: report }, null, 2) + '\n');
    console.log(`\nmeasured durations -> ${manifest.out_dir}/_durations.json`);
    console.log('autoTurnAfterMs = measured + 1000 ms, and page 8 has none by design.');
  }
}

main().catch((err) => {
  console.error('\nERROR: ' + err.message);
  process.exit(1);
});
