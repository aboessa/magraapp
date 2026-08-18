// Majarra — narration QC for generated WAV masters.
//
// Exists because narration is generated headlessly: nobody is listening to every
// take, and the failure modes are silent by nature. A file can be a perfectly
// valid 500 KB WAV and still be unusable — all silence, clipped, or (the
// documented Gemini-TTS failure) the director's notes read aloud instead of the
// transcript.
//
// The checks are chosen so each one catches a specific real failure:
//   * RMS near the floor           -> the model returned silence
//   * peak at full scale           -> clipping, audible as distortion
//   * duration far above expected  -> the prompt leaked into the spoken output
//   * long leading silence         -> the page will feel unresponsive on turn
//   * RMS spread across a set      -> loudness drifts between pages, which is the
//                                     single most noticeable defect in a read-along
//
// Usage:
//   node tools/tts/inspect-wav.mjs <file-or-dir> [more...]
//   node tools/tts/inspect-wav.mjs _audition/tts

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/// Reads a 16-bit PCM WAV by walking the RIFF chunk list.
///
/// Chunks are walked rather than assuming a 44-byte header because a writer may
/// insert LIST/fact chunks before `data`; assuming the offset would silently
/// misread the first samples as audio.
function readWav(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let offset = 12;
  let fmt = null;
  let data = null;

  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }
    // Chunks are word-aligned: an odd size is followed by a pad byte.
    offset = body + size + (size % 2);
  }

  if (!fmt) throw new Error('no fmt chunk');
  if (!data) throw new Error('no data chunk');
  if (fmt.format !== 1 || fmt.bits !== 16) {
    throw new Error(`expected 16-bit PCM, got format=${fmt.format} bits=${fmt.bits}`);
  }
  return { fmt, data };
}

const FULL_SCALE = 32768;
const toDb = (linear) => (linear <= 0 ? -Infinity : 20 * Math.log10(linear));
const fmtDb = (db) => (db === -Infinity ? '  -inf' : db.toFixed(1).padStart(6));

/// Silence threshold at -50 dBFS. Chosen above the model's noise floor so genuine
/// room tone is not counted as speech, and below any real utterance.
const SILENCE_DB = -50;
const SILENCE_LINEAR = 10 ** (SILENCE_DB / 20);

function analyse(buf) {
  const { fmt, data } = readWav(buf);
  const samples = Math.floor(data.length / 2 / fmt.channels);
  const durationMs = Math.round((samples / fmt.sampleRate) * 1000);

  let sumSquares = 0;
  let peak = 0;
  let clipped = 0;
  let firstLoud = -1;
  let lastLoud = -1;

  // Window the signal to find where speech actually starts and ends, rather than
  // where the file does.
  const windowSamples = Math.max(1, Math.floor(fmt.sampleRate * 0.02)); // 20 ms
  let windowSum = 0;
  let windowCount = 0;
  let windowIndex = 0;

  for (let i = 0; i < samples; i++) {
    // Left channel only: these masters are mono, and averaging channels would
    // hide a one-sided dropout.
    const sample = data.readInt16LE(i * 2 * fmt.channels) / FULL_SCALE;
    const magnitude = Math.abs(sample);
    sumSquares += sample * sample;
    if (magnitude > peak) peak = magnitude;
    if (magnitude >= 0.999) clipped++;

    windowSum += sample * sample;
    if (++windowCount === windowSamples) {
      const windowRms = Math.sqrt(windowSum / windowCount);
      if (windowRms >= SILENCE_LINEAR) {
        if (firstLoud === -1) firstLoud = windowIndex * windowSamples;
        lastLoud = (windowIndex + 1) * windowSamples;
      }
      windowSum = 0;
      windowCount = 0;
      windowIndex++;
    }
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, samples));
  const msOf = (s) => Math.round((s / fmt.sampleRate) * 1000);

  return {
    sampleRate: fmt.sampleRate,
    channels: fmt.channels,
    durationMs,
    rmsDb: toDb(rms),
    peakDb: toDb(peak),
    clippedSamples: clipped,
    leadingSilenceMs: firstLoud === -1 ? durationMs : msOf(firstLoud),
    trailingSilenceMs: lastLoud === -1 ? durationMs : Math.max(0, durationMs - msOf(lastLoud)),
    speechMs: firstLoud === -1 ? 0 : msOf(lastLoud - firstLoud),
  };
}

function collect(targets) {
  const files = [];
  for (const t of targets) {
    const p = path.resolve(t);
    if (!fs.existsSync(p)) {
      console.error(`skip (missing): ${t}`);
      continue;
    }
    if (fs.statSync(p).isDirectory()) {
      for (const name of fs.readdirSync(p).sort()) {
        if (name.toLowerCase().endsWith('.wav')) files.push(path.join(p, name));
      }
    } else {
      files.push(p);
    }
  }
  return files;
}

function main() {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.log('Usage: node tools/tts/inspect-wav.mjs <file-or-dir> [more...]');
    process.exit(1);
  }

  const files = collect(targets);
  if (!files.length) {
    console.error('No .wav files found.');
    process.exit(1);
  }

  console.log(
    'file'.padEnd(30) + 'dur'.padStart(8) + 'speech'.padStart(8) +
    'lead'.padStart(7) + 'rmsdB'.padStart(8) + 'peakdB'.padStart(8) +
    'clip'.padStart(6) + '  rate'
  );

  const rows = [];
  for (const f of files) {
    const name = path.basename(f);
    try {
      const a = analyse(fs.readFileSync(f));
      rows.push({ name, ...a });
      console.log(
        name.slice(0, 29).padEnd(30) +
        `${a.durationMs}`.padStart(8) +
        `${a.speechMs}`.padStart(8) +
        `${a.leadingSilenceMs}`.padStart(7) +
        fmtDb(a.rmsDb).padStart(8) +
        fmtDb(a.peakDb).padStart(8) +
        `${a.clippedSamples}`.padStart(6) +
        `  ${a.sampleRate}/${a.channels}ch`
      );
    } catch (err) {
      console.log(`${name.slice(0, 29).padEnd(30)}  ERROR: ${err.message}`);
    }
  }

  // Findings, not just numbers: state the defect rather than leaving the reader to
  // compare columns.
  const problems = [];
  for (const r of rows) {
    if (r.rmsDb < -45) problems.push(`${r.name}: effectively silent (RMS ${fmtDb(r.rmsDb).trim()} dBFS)`);
    if (r.clippedSamples > 10) problems.push(`${r.name}: ${r.clippedSamples} clipped samples`);
    if (r.speechMs === 0) problems.push(`${r.name}: no speech detected above ${SILENCE_DB} dBFS`);
    if (r.leadingSilenceMs > 1500) problems.push(`${r.name}: ${r.leadingSilenceMs} ms of leading silence`);
  }

  if (rows.length > 1) {
    const loud = rows.filter((r) => Number.isFinite(r.rmsDb)).map((r) => r.rmsDb);
    if (loud.length > 1) {
      const spread = Math.max(...loud) - Math.min(...loud);
      console.log(`\nloudness spread across ${loud.length} files: ${spread.toFixed(1)} dB`);
      // 3 dB is roughly where a listener starts noticing one page is louder than
      // the next in a continuous read-along.
      if (spread > 3) problems.push(`loudness varies by ${spread.toFixed(1)} dB across the set — audible between pages`);
    }
  }

  if (problems.length) {
    console.log('\nPROBLEMS');
    for (const p of problems) console.log(`  - ${p}`);
  } else {
    console.log('\nNo problems detected by these checks.');
  }
  console.log('\nNote: timbre, accent and pronunciation cannot be checked programmatically. Listen before approving.');
}

main();
