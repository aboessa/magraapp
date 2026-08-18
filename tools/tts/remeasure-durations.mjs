// Majarra — rebuilds _durations.json from the WAV files on disk.
//
// Needed because narrate.mjs used to write `pages: report`, so regenerating a single
// page replaced the whole file with one entry and discarded the other measurements.
// That bug is fixed, but a file damaged before the fix still has to be repaired, and the
// audio is the only source that cannot drift: the durations are IN the files.
//
// Also useful whenever audio is edited outside the generator, for example after the
// loudness pass, since a gain change must not silently invalidate a duration.
//
// Usage:
//   node tools/tts/remeasure-durations.mjs
//   node tools/tts/remeasure-durations.mjs --manifest act-s1.narration.locked.json

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const MANIFEST = path.join(
  import.meta.dirname,
  typeof arg('manifest') === 'string' ? arg('manifest') : 'act-s1.narration.locked.json'
);

/// Duration straight from the RIFF chunks, so a non-standard header offset cannot make
/// the reading wrong.
function wavDurationMs(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF');
  let offset = 12;
  let rate = 24000;
  let channels = 1;
  let bits = 16;
  let dataLength = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      dataLength = Math.min(size, buf.length - body);
    }
    offset = body + size + (size % 2);
  }
  if (!dataLength) throw new Error('no data chunk');
  return Math.round((dataLength / (channels * (bits / 8)) / rate) * 1000);
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const dir = path.join(ROOT, manifest.out_dir);
  const outPath = path.join(dir, '_durations.json');

  const before = fs.existsSync(outPath)
    ? (JSON.parse(fs.readFileSync(outPath, 'utf8')).pages ?? []).length
    : 0;

  const pages = [];
  const missing = [];
  for (const line of manifest.lines) {
    const wav = path.join(dir, line.file);
    if (!fs.existsSync(wav)) {
      missing.push(line.file);
      continue;
    }
    const ms = wavDurationMs(wav);
    const preRoll = line.pre_roll_ms ?? 0;
    pages.push({
      page: line.page,
      id: line.id,
      file: `${manifest.out_dir}/${line.file}`,
      measuredDurationMs: ms,
      plannedDurationMs: line.planned_duration_ms,
      // Silence the player inserts BEFORE the line, kept out of the audio so the file's
      // own duration stays honest for anything that measures it.
      preRollMs: preRoll || undefined,
      // What the child actually experiences on this page.
      pageDurationMs: preRoll + ms,
      // The final page carries no autoTurn by this planet's rule.
      autoTurnAfterMs: line.page === manifest.lines.length ? null : preRoll + ms + 1000,
    });
  }

  if (!pages.length) throw new Error('no audio found');

  fs.writeFileSync(
    outPath,
    JSON.stringify({ voice: manifest.voice, model: manifest.model, pages }, null, 2) + '\n'
  );

  console.log(`measured ${pages.length} page(s) from audio; file previously held ${before}`);
  console.log('pg'.padStart(3) + 'measured'.padStart(10) + 'planned'.padStart(9) + 'drift'.padStart(8));
  for (const p of pages) {
    const d = p.measuredDurationMs - p.plannedDurationMs;
    console.log(
      String(p.page).padStart(3) + String(p.measuredDurationMs).padStart(10)
      + String(p.plannedDurationMs).padStart(9) + `${d >= 0 ? '+' : ''}${d}`.padStart(8)
    );
  }
  const total = pages.reduce((s, p) => s + p.measuredDurationMs, 0);
  console.log(`\ntotal ${(total / 1000).toFixed(1)}s   with page-turn waits ${((total + (pages.length - 1) * 1000) / 1000).toFixed(0)}s`);
  if (missing.length) {
    console.log(`\nnot generated yet: ${missing.join(', ')}`);
    process.exitCode = 1;
  }
}

main();
