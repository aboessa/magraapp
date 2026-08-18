// Majarra — Gemini-TTS voice audition.
//
// Generates the SAME Arabic line with several candidate voices so a human can pick
// one, then that choice gets locked into a narration manifest.
//
// Why this exists separately from narrate.mjs: narrate.mjs is bound to a specific
// story manifest and writes production masters into assets/. Auditioning is
// throwaway comparison work and must not touch production output paths.
//
// Usage (from repo root):
//   node tools/tts/audition.mjs --dry
//   node tools/tts/audition.mjs --all
//   node tools/tts/audition.mjs --voices Leda,Aoede
//
// Key resolution matches narrate.mjs: $env:GOOGLE_AI_API_KEY, else
// $env:GEMINI_API_KEY, else %USERPROFILE%\.majarra\google-ai.key.
// The key is never printed and never written into the repository.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3.1-flash-tts-preview';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
// Under assets/ rather than a root _audition/ folder: a first run wrote six WAVs to
// f:\Projects\cartoonapp\_audition\tts and they were gone a few minutes later,
// with no delete command issued and no .kiro hook present. Cause unidentified, so
// the output moved to the tree that the narration masters already use and that has
// held its contents throughout.
const OUT_DIR = path.join(ROOT, 'assets', 'audio', '_audition');

// PCM shape returned by the Gemini TTS models.
const SAMPLE_RATE = 24000;
const BITS = 16;
const CHANNELS = 1;

// Female-leaning voices from the published 30, ordered by how plausible each is as
// a young female narrator for 3-5 year olds. The parenthetical is Google's own
// one-word descriptor, which is the only official signal about timbre.
const CANDIDATES = [
  { voice: 'Leda', note: 'Youthful' },
  { voice: 'Aoede', note: 'Breezy' },
  { voice: 'Vindemiatrix', note: 'Gentle' },
  { voice: 'Achernar', note: 'Soft' },
  { voice: 'Sulafat', note: 'Warm' },
  { voice: 'Kore', note: 'Firm — current manifest default, baseline for comparison' },
];

// Arabic copied verbatim from the existing approved story (act-s1, pages 1-2).
// Auditioning on real content rather than a lorem line is the point: pronunciation
// of زُغب and the shadda in عشّ are exactly what can go wrong.
const TRANSCRIPT = 'هذا زُغب. بيته عشّ صغير. اليوم يريد أن يطير قليلًا.';

// Structured per the official prompting guide: Audio Profile, Scene, Director's
// Notes, then an explicitly labelled transcript.
//
// The preamble and the TRANSCRIPT label are not decoration. The model's documented
// failure mode is that a vague prompt makes it either reject the request as
// PROHIBITED_CONTENT or read the director's notes ALOUD. A clear synthesis
// instruction plus a labelled transcript boundary is the documented mitigation.
//
// The persona is deliberately a young woman rather than "a narrator", because the
// model is documented to drift when the written tone and the selected voice
// disagree — asking a neutral prompt to sound like a young girl produces a
// mismatch, so the prompt states the age and warmth explicitly.
const PROMPT = `Synthesize speech. Read aloud only the text under TRANSCRIPT. Everything above it is direction for how to perform, and must never be spoken.

# AUDIO PROFILE: Salma
## "The Kind Older Sister"
Salma is a young Arab woman in her early twenties with a light, bright, distinctly feminine voice. She is not a professional announcer and does not sound like one. She sounds like a kind older sister who reads to a small child every night.

## THE SCENE
A child's bedroom, late evening, one warm lamp on. A three year old is lying down, already sleepy, holding the edge of the blanket. Salma is sitting on the floor beside the bed with the picture book open on her knees. The room is quiet enough that she never needs to raise her voice.

### DIRECTOR'S NOTES
Style: Bright, soft and affectionate, with a gentle vocal smile the listener can hear. Light and youthful in timbre, never breathy, never babyish, and never a performed cartoon voice. Warm and reassuring throughout.
Pacing: Slow and unhurried, roughly ninety words per minute. Leave a small natural pause at every full stop so a small child can follow.
Accent: Clear Modern Standard Arabic, articulated the way an educated Egyptian speaker reads a children's book aloud.
Loudness: Constant from the first word to the last. No build-up, no escalation, no dramatic emphasis, no gasps or exclamations.
Articulation: Give زُغب a clear short u vowel on the first letter. Give عشّ its shadda clearly but gently.

#### TRANSCRIPT
${TRANSCRIPT}`;

function loadKey() {
  const env = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (env) return env.trim();
  const p = path.join(os.homedir(), '.majarra', 'google-ai.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error(
    'No Google AI Studio key.\n' +
    '  Set it for this shell:  $env:GOOGLE_AI_API_KEY = "<key>"\n' +
    '  Or store it once:       Set-Content "$env:USERPROFILE\\.majarra\\google-ai.key" "<key>" -NoNewline'
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
  voices: typeof arg('voices') === 'string' ? arg('voices').split(',').map((v) => v.trim()) : undefined,
};

// Minimal 44-byte RIFF/WAVE header for raw little-endian PCM.
function wavHeader(dataBytes) {
  const blockAlign = (CHANNELS * BITS) / 8;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + dataBytes, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(CHANNELS, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(SAMPLE_RATE * blockAlign, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(BITS, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(dataBytes, 40);
  return h;
}

const durationMs = (pcmBytes) =>
  Math.round((pcmBytes / ((SAMPLE_RATE * CHANNELS * BITS) / 8)) * 1000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function synthesizeOnce(voice, key) {
  const res = await fetch(`${API_ROOT}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${res.status} ${text.slice(0, 300)}`);
    // Documented: this model randomly returns text tokens instead of audio and the
    // server fails the request with 500. Retrying is the documented mitigation.
    err.retryable = res.status >= 500 || res.status === 429;
    throw err;
  }

  const json = JSON.parse(text);
  const cand = json.candidates?.[0];
  const inline = cand?.content?.parts?.find((p) => p.inlineData ?? p.inline_data);
  const blob = inline?.inlineData ?? inline?.inline_data;
  if (!blob?.data) {
    const err = new Error(`no audio (finishReason=${cand?.finishReason ?? 'none'})`);
    err.retryable = true;
    throw err;
  }
  return { pcm: Buffer.from(blob.data, 'base64'), mimeType: blob.mimeType ?? blob.mime_type ?? '' };
}

async function synthesize(voice, key, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await synthesizeOnce(voice, key);
    } catch (err) {
      lastErr = err;
      if (!err.retryable || i === attempts) throw err;
      console.log(`    attempt ${i} failed (${err.message.slice(0, 80)}), retrying...`);
      await sleep(2000 * i);
    }
  }
  throw lastErr;
}

async function main() {
  let targets = CANDIDATES;
  if (OPT.voices) {
    targets = CANDIDATES.filter((c) => OPT.voices.includes(c.voice));
    for (const v of OPT.voices) {
      if (!CANDIDATES.some((c) => c.voice === v)) targets.push({ voice: v, note: 'ad hoc' });
    }
  } else if (!OPT.all && !OPT.dry) {
    console.log('Nothing to do. Pass --dry, --all or --voices A,B.');
    return;
  }

  console.log(`model=${MODEL}  voices=${targets.length}  prompt=${PROMPT.length} chars`);
  console.log(`transcript: ${TRANSCRIPT}`);

  if (OPT.dry) {
    console.log('\n--- prompt sent for every voice ---\n');
    console.log(PROMPT);
    console.log('\nDry run only. No request sent, no key needed.');
    return;
  }

  const key = loadKey();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const report = [];
  for (const { voice, note } of targets) {
    process.stdout.write(`\n${voice} (${note})\n`);
    try {
      const { pcm, mimeType } = await synthesize(voice, key);
      const file = `audition-${voice}.wav`;
      fs.writeFileSync(path.join(OUT_DIR, file), Buffer.concat([wavHeader(pcm.length), pcm]));
      const ms = durationMs(pcm.length);
      const wpm = Math.round((TRANSCRIPT.split(/\s+/).length / ms) * 60000);
      console.log(`    OK  ${file}  ${ms} ms  ~${wpm} wpm  ${mimeType}`);
      report.push({ voice, note, file, durationMs: ms, approxWpm: wpm, ok: true });
    } catch (err) {
      console.error(`    FAILED  ${err.message.slice(0, 200)}`);
      report.push({ voice, note, ok: false, error: err.message.slice(0, 200) });
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, '_audition.json'),
    JSON.stringify({ model: MODEL, transcript: TRANSCRIPT, prompt: PROMPT, results: report }, null, 2)
  );
  const ok = report.filter((r) => r.ok).length;
  console.log(`\n${ok}/${report.length} succeeded. Files in ${path.relative(ROOT, OUT_DIR)}/`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
