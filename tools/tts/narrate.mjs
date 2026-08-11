// Majarra — Gemini TTS narration runner for illustrated stories.
//
// Usage (from repo root):
//   node tools/tts/narrate.mjs --dry                  # print what would be sent, no API call
//   node tools/tts/narrate.mjs --page 1               # generate one page
//   node tools/tts/narrate.mjs --all                  # generate all 8 pages
//   node tools/tts/narrate.mjs --all --voice Aoede    # override the voice
//   node tools/tts/narrate.mjs --all --manifest act-s1.narration.locked.json
//
// --manifest selects the narration manifest, defaulting to act-s1.narration.json.
// act-s1.narration.locked.json is the reviewed one: voice Leda, and a prompt built
// in the structure this model documents (synthesis preamble, performance direction,
// then a labelled transcript boundary).
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
const DEFAULT_MANIFEST = 'act-s1.narration.json';

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
  manifest: typeof arg('manifest') === 'string' ? arg('manifest') : DEFAULT_MANIFEST,
};

const MANIFEST = path.isAbsolute(OPT.manifest)
  ? OPT.manifest
  : path.join(import.meta.dirname, OPT.manifest);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const OUT_DIR = path.join(ROOT, manifest.out_dir);
const VOICE = OPT.voice ?? manifest.voice;

/// Assembles the text sent to the model.
///
/// Two shapes are supported, selected by whether the manifest defines a
/// `preamble`, so the original manifest keeps working untouched:
///
///  * With a preamble — the documented structure for this model: an explicit
///    instruction to synthesize, the performance direction, then the transcript
///    behind a labelled '#### TRANSCRIPT' boundary. This exists because the model
///    has two documented failure modes on vague prompts: rejecting the request as
///    PROHIBITED_CONTENT, or reading the director's notes ALOUD. Naming where the
///    spoken text begins is the documented mitigation, and it held in testing —
///    a 1526-character prompt produced 11 s of audio for a 50-character line.
///
///  * Without one — the original "instructions then text" form.
function buildRequestText(line) {
  if (manifest.preamble) {
    // `audio_tag` is kept out of `text` on purpose. The manifest requires the Arabic to
    // be verbatim from the story file, and a tag is a delivery marker that is never
    // spoken, not part of the line. Prepending it here preserves both.
    //
    // Tags exist because prose direction did not work: page 8 is required to be the
    // slowest page in the story, and asking for that in the director's notes produced
    // 3.66 letters/sec against a 2.92 target, making it one of the FASTER pages.
    // Inline tags are the documented mechanism for pace control, and Google recommends
    // keeping them in English even when the transcript is not.
    const transcript = line.audio_tag ? `${line.audio_tag} ${line.text}` : line.text;
    return `${manifest.preamble}\n\n${manifest.global_style}\n${line.style}\n\n#### TRANSCRIPT\n${transcript}`;
  }
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/// Retries a line before giving up on it.
///
/// Not defensive padding: Google documents that this model occasionally returns
/// text tokens instead of audio and fails the request with a 500, that it happens
/// randomly in a small share of requests, and that callers should implement retry
/// logic. Across eight pages a single unretried blip means a missing narration file
/// and a silent page.
async function synthesizeWithRetry(line, key, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await synthesize(line, key);
    } catch (err) {
      lastErr = err;
      if (i === attempts) break;
      console.log(`  attempt ${i} failed (${err.message.slice(0, 90)}), retrying...`);
      await sleep(2000 * i);
    }
  }
  throw lastErr;
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
      const { pcm, mimeType } = await synthesizeWithRetry(line, key);
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

    // Merge, never replace.
    //
    // This used to write `pages: report`, so regenerating one page rewrote the file with
    // only that page and silently discarded the other seven measurements. It happened:
    // after re-recording pages 1 and 8, the file held a single entry. The audio was
    // still on disk so nothing was unrecoverable, but every consumer of this file — the
    // spec's duration table, autoTurnAfterMs, the preview build — was reading a set of
    // one.
    let existing = [];
    if (fs.existsSync(p)) {
      try {
        existing = JSON.parse(fs.readFileSync(p, 'utf8')).pages ?? [];
      } catch {
        existing = [];
      }
    }
    const merged = new Map(existing.map((entry) => [entry.page, entry]));
    for (const entry of report) merged.set(entry.page, entry);
    const pages = [...merged.values()].sort((a, b) => a.page - b.page);

    fs.writeFileSync(p, JSON.stringify({ voice: VOICE, model: manifest.model, pages }, null, 2) + '\n');
    if (pages.length > report.length) {
      console.log(`merged ${report.length} new measurement(s) into ${pages.length} page(s)`);
    }
    console.log(`\nmeasured durations -> ${manifest.out_dir}/_durations.json`);
    console.log('autoTurnAfterMs = measured + 1000 ms, and page 8 has none by design.');
  }
}

main().catch((err) => {
  console.error('\nERROR: ' + err.message);
  process.exit(1);
});
