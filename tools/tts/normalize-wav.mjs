// Majarra — constant-loudness pass for narration masters.
//
// The story file makes this a hard acceptance criterion, not a nicety:
//   "الحجم ثابت في القصة كلها — بلا تصعيد"
//   "مراجعة صوتية: ... ويُتحقّق أن الحجم ثابت"
// Generated narration does not satisfy it on its own. The eight act-s1 pages came
// back spanning 7.3 dB RMS (-13.4 on page 8 to -20.7 on page 5) from a single
// voice, which is plainly audible when pages play back to back in a read-along.
//
// The fix is a per-file gain so every page lands on the same RMS. That is the
// correct tool here precisely because the spec forbids dynamics between pages: a
// compressor or limiter would reshape the performance, while a single gain factor
// per file preserves it exactly and only moves the level.
//
// Clipping is avoided by construction rather than repaired afterwards. The target
// defaults to -20 dBFS because that is below the point where the least-headroom
// file (page 4, peak -1.5 dBFS) would need boosting past full scale, so no file is
// ever amplified into distortion. Anything louder would clip a page, and a clipped
// bedtime story is worse than a quiet one that the app can turn up.
//
// Originals are copied to _pre-normalize/ before anything is overwritten, so the
// generated masters are recoverable without re-spending API credits.
//
// Usage:
//   node tools/tts/normalize-wav.mjs <dir> [--target -20] [--dry]

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const FULL_SCALE = 32768;
const toDb = (x) => (x <= 0 ? -Infinity : 20 * Math.log10(x));
const fromDb = (db) => 10 ** (db / 20);
const fmt = (db) => (db === -Infinity ? '-inf' : db.toFixed(1));

/// Walks the RIFF chunk list instead of assuming a 44-byte header, so a file with
/// an extra chunk before `data` is not misread.
function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let offset = 12;
  let fmtChunk = null;
  let dataStart = -1;
  let dataLength = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmtChunk = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), bits: buf.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      dataStart = body;
      dataLength = Math.min(size, buf.length - body);
    }
    offset = body + size + (size % 2);
  }
  if (!fmtChunk || dataStart === -1) throw new Error('missing fmt or data chunk');
  if (fmtChunk.format !== 1 || fmtChunk.bits !== 16) throw new Error('expected 16-bit PCM');
  return { dataStart, dataLength };
}

function measure(buf, dataStart, dataLength) {
  const n = Math.floor(dataLength / 2);
  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const s = buf.readInt16LE(dataStart + i * 2) / FULL_SCALE;
    sumSquares += s * s;
    const m = Math.abs(s);
    if (m > peak) peak = m;
  }
  return { rms: Math.sqrt(sumSquares / Math.max(1, n)), peak, samples: n };
}

/// Applies gain in place with rounding and a hard bound at the 16-bit range.
///
/// The bound is a safety net, not the clipping strategy: the target is chosen so no
/// file needs a boost that could reach it. If it ever engages, the count is reported
/// rather than swallowed.
function applyGain(buf, dataStart, samples, gain) {
  let bounded = 0;
  for (let i = 0; i < samples; i++) {
    const at = dataStart + i * 2;
    let v = Math.round(buf.readInt16LE(at) * gain);
    if (v > 32767) { v = 32767; bounded++; }
    if (v < -32768) { v = -32768; bounded++; }
    buf.writeInt16LE(v, at);
  }
  return bounded;
}

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

function main() {
  const dir = process.argv[2];
  if (!dir || dir.startsWith('--')) {
    console.log('Usage: node tools/tts/normalize-wav.mjs <dir> [--target -20] [--dry]');
    process.exit(1);
  }
  const targetDb = typeof arg('target') === 'string' ? Number(arg('target')) : -20;
  const dry = !!arg('dry');
  const root = path.resolve(dir);
  const files = fs.readdirSync(root).filter((f) => f.toLowerCase().endsWith('.wav')).sort();
  if (!files.length) throw new Error(`no .wav files in ${dir}`);

  console.log(`target ${targetDb} dBFS RMS   files ${files.length}${dry ? '   (dry run)' : ''}`);

  // Pass one measures everything and works out the loudest safe target, so a target
  // that would clip a page is refused up front instead of discovered in the output.
  const measured = files.map((name) => {
    const buf = fs.readFileSync(path.join(root, name));
    const { dataStart, dataLength } = readWav(buf);
    const m = measure(buf, dataStart, dataLength);
    return { name, buf, dataStart, ...m };
  });

  const MARGIN_DB = 1;
  const safest = Math.min(...measured.map((m) => toDb(m.rms) + (-MARGIN_DB - toDb(m.peak))));
  console.log(`loudest clip-free target for this set: ${fmt(safest)} dBFS`);
  if (targetDb > safest) {
    console.error(
      `\nRefusing to run: target ${targetDb} dBFS would drive at least one file past `
      + `${-MARGIN_DB} dBFS peak. Use --target ${Math.floor(safest)} or lower.`
    );
    process.exit(1);
  }

  if (!dry) {
    const backup = path.join(root, '_pre-normalize');
    fs.mkdirSync(backup, { recursive: true });
    for (const m of measured) {
      const dest = path.join(backup, m.name);
      if (!fs.existsSync(dest)) fs.copyFileSync(path.join(root, m.name), dest);
    }
    console.log(`originals preserved in ${path.relative(process.cwd(), backup)}/`);
  }

  console.log('\nfile'.padEnd(22) + 'rms'.padStart(7) + 'peak'.padStart(7) + 'gain'.padStart(7) + 'newPeak'.padStart(9));
  let bounded = 0;
  for (const m of measured) {
    const rmsDb = toDb(m.rms);
    const gainDb = targetDb - rmsDb;
    const newPeakDb = toDb(m.peak) + gainDb;
    console.log(
      m.name.slice(0, 21).padEnd(22) + fmt(rmsDb).padStart(7) + fmt(toDb(m.peak)).padStart(7)
      + (gainDb >= 0 ? '+' : '') + gainDb.toFixed(1).padStart(6) + fmt(newPeakDb).padStart(9)
    );
    if (!dry) {
      bounded += applyGain(m.buf, m.dataStart, m.samples, fromDb(gainDb));
      fs.writeFileSync(path.join(root, m.name), m.buf);
    }
  }

  if (dry) {
    console.log('\nDry run. Nothing written.');
    return;
  }
  console.log(bounded ? `\nWARNING: ${bounded} samples hit the 16-bit bound.` : '\nNo samples hit the bound.');
  console.log('Re-run inspect-wav.mjs to confirm the spread is closed.');
}

main();
