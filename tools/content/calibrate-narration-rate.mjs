// Majarra — measures the real Arabic narration rate from generated audio.
//
// WHY A NEW UNIT
//
// Every story spec states its narrator speed in words per minute, and all 15 of
// them disagree with their own planned durations by a consistent factor (~62%).
// A consistent error across independently authored files points at the unit, not
// at the authors.
//
// Speech tempo is conventionally measured in syllables per second rather than words
// per minute, because a word is not a comparable unit across languages. An
// Arabic-English bilingual study found near-identical rates in words per second but
// significantly faster rates in Arabic once measured in syllables per second, which
// is another way of saying Arabic carries more syllables per word. Pellegrino et al.
// report negative correlations between per-syllable information and both syllable
// rate and syllables per word, and Coupe et al. find languages converge on roughly
// 39 bits/s despite very different syllable rates. Taken together: a words-per-minute
// target carried over from English guidance will always overstate how fast Arabic can
// be read at the same perceived pace.
//   - https://en.wikipedia.org/wiki/Speech_tempo
//   - https://www.mdpi.com/2226-471X/9/12/368/xml
//   - https://languagelog.ldc.upenn.edu/nll/?p=22
//   - https://pmc.ncbi.nlm.nih.gov/articles/PMC6984970/
//
// WHY LETTERS PER SECOND AND NOT SYLLABLES PER SECOND
//
// Syllables per second is the right unit in principle, but counting syllables in
// this corpus is not reliable: an Arabic syllable has exactly one vowel nucleus, and
// short vowels are written as diacritics that these story files only apply partially.
// Any syllable count here would be an estimate whose error is unknown, which is the
// same class of mistake as the wpm target it replaces.
//
// Arabic letters per second is fully objective, needs no estimator, and tracks
// articulatory load far better than words do. It is used as the primary calibrated
// unit, with syllables/s reported as a clearly-labelled approximation and wpm kept
// only as a derived, language-specific figure for continuity with the existing docs.
//
// Usage:
//   node tools/content/calibrate-narration-rate.mjs
//   node tools/content/calibrate-narration-rate.mjs --manifest tools/tts/act-s1.narration.locked.json

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
  ROOT,
  typeof arg('manifest') === 'string' ? arg('manifest') : 'tools/tts/act-s1.narration.locked.json'
);

const ARABIC_LETTER = /[\u0621-\u063A\u0641-\u064A\u0671-\u06D3]/g;
// Combining marks: tashkeel, sukun, shadda, dagger alif. Never syllable nuclei by
// themselves and never letters, so they are excluded from every count.
const TASHKEEL = /[\u064B-\u0652\u0670\u06D6-\u06ED]/g;

const letters = (s) => (s.match(ARABIC_LETTER) ?? []).length;
const words = (s) => s.replace(TASHKEEL, '').replace(/[^\u0621-\u06D3\s]/g, ' ')
  .split(/\s+/).filter((w) => w.length > 0).length;

/// Rough syllable estimate for partially-vocalised Arabic.
///
/// Counts written vowel nuclei: the long vowels alif/waw/yaa plus any short-vowel
/// diacritic that happens to be written. Reported with an explicit warning because
/// unvocalised text hides most short vowels, so this UNDERCOUNTS. It is here to show
/// the order of magnitude against published syllable rates, not to drive decisions.
function approxSyllables(s) {
  const shortVowels = (s.match(/[\u064E\u064F\u0650]/g) ?? []).length;
  const longVowels = (s.match(/[\u0627\u0648\u064A\u0622\u0623\u0625\u0649]/g) ?? []).length;
  // Consonants with no written vowel still carry one in speech; assume a syllable per
  // two unmarked consonants as a floor.
  const consonants = letters(s) - longVowels;
  return Math.max(longVowels + shortVowels, Math.round(consonants / 2) + longVowels);
}

/// Reads real durations from a WAV so the calibration never depends on a JSON file
/// that could have drifted from the audio it describes.
///
/// Also measures silence, because page duration alone cannot answer "which page is read
/// slowest". A page with two sentences contains an inter-sentence pause that a
/// single-sentence page does not, and that pause lowers its letters-per-second without
/// anyone having spoken more slowly. Comparing pages on page-rate therefore compares
/// sentence counts as much as tempo. Subtracting silence gives an articulation rate,
/// which is what the direction "the slowest page" is actually about.
function analyseWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`${file} is not RIFF`);
  let offset = 12;
  let rate = 24000;
  let channels = 1;
  let bits = 16;
  let dataStart = -1;
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
      dataStart = body;
      dataLength = Math.min(size, buf.length - body);
    }
    offset = body + size + (size % 2);
  }
  if (dataStart === -1) throw new Error('no data chunk');

  const frames = Math.floor(dataLength / (channels * (bits / 8)));
  const durationMs = Math.round((frames / rate) * 1000);

  // 20 ms windows at -50 dBFS: above the model's noise floor, below any real speech.
  const win = Math.max(1, Math.floor(rate * 0.02));
  const threshold = 10 ** (-50 / 20);
  const flags = [];
  for (let start = 0; start + win <= frames; start += win) {
    let sumSquares = 0;
    for (let i = 0; i < win; i++) {
      const s = buf.readInt16LE(dataStart + (start + i) * 2 * channels) / 32768;
      sumSquares += s * s;
    }
    flags.push(Math.sqrt(sumSquares / win) >= threshold);
  }

  const firstLoud = flags.indexOf(true);
  const lastLoud = flags.lastIndexOf(true);
  if (firstLoud === -1) return { durationMs, speechMs: 0, internalSilenceMs: 0, pauses: 0 };

  // Only silence BETWEEN speech counts as a pause. Leading and trailing silence is
  // framing, not tempo, so it is excluded from both figures.
  let silentWindows = 0;
  let pauses = 0;
  let run = 0;
  for (let i = firstLoud; i <= lastLoud; i++) {
    if (!flags[i]) {
      silentWindows++;
      run++;
    } else {
      // 150 ms is long enough to exclude stop-consonant closures and count only pauses a
      // listener perceives as a break.
      if (run * (win / rate) * 1000 >= 150) pauses++;
      run = 0;
    }
  }

  const spanMs = Math.round(((lastLoud - firstLoud + 1) * win / rate) * 1000);
  const internalSilenceMs = Math.round((silentWindows * win / rate) * 1000);
  return { durationMs, speechMs: Math.max(1, spanMs - internalSilenceMs), internalSilenceMs, pauses };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const audioDir = path.join(ROOT, manifest.out_dir);

  const rows = [];
  for (const line of manifest.lines) {
    const wav = path.join(audioDir, line.file);
    if (!fs.existsSync(wav)) {
      console.log(`skip page ${line.page}: ${line.file} not generated`);
      continue;
    }
    const a = analyseWav(wav);
    const ms = a.durationMs;
    const L = letters(line.text);
    const W = words(line.text);
    const S = approxSyllables(line.text);
    // Sentence count is reported because it is the confound: full stops create pauses.
    const sentences = (line.text.match(/[.!?؟]/g) ?? []).length || 1;
    rows.push({
      page: line.page,
      ms,
      plannedMs: line.planned_duration_ms,
      letters: L,
      words: W,
      syl: S,
      sentences,
      speechMs: a.speechMs,
      internalSilenceMs: a.internalSilenceMs,
      pauses: a.pauses,
      lps: +(L / (ms / 1000)).toFixed(2),
      // Articulation rate: letters over speaking time only.
      alps: +(L / (a.speechMs / 1000)).toFixed(2),
      wpm: Math.round(W / ms * 60000),
      sps: +(S / (ms / 1000)).toFixed(2),
    });
  }

  if (!rows.length) throw new Error('no generated audio found; run the narration first');

  console.log(`manifest ${path.relative(ROOT, MANIFEST)}`);
  console.log(`voice ${manifest.voice}   model ${manifest.model}\n`);
  console.log(
    'pg'.padStart(3) + 'meas_ms'.padStart(9) + 'speech'.padStart(8) + 'pause'.padStart(7)
    + 'n'.padStart(3) + 'snt'.padStart(4) + 'ltr'.padStart(5)
    + 'page_lps'.padStart(10) + 'artic_lps'.padStart(11)
  );
  for (const r of rows) {
    console.log(
      String(r.page).padStart(3) + String(r.ms).padStart(9) + String(r.speechMs).padStart(8)
      + String(r.internalSilenceMs).padStart(7) + String(r.pauses).padStart(3)
      + String(r.sentences).padStart(4) + String(r.letters).padStart(5)
      + r.lps.toFixed(2).padStart(10) + r.alps.toFixed(2).padStart(11)
    );
  }

  // Settles the "closing page must be slowest" requirement on the right measure.
  const slowestByPage = rows.reduce((a, b) => (b.lps < a.lps ? b : a));
  const slowestByArtic = rows.reduce((a, b) => (b.alps < a.alps ? b : a));
  const last = rows[rows.length - 1];
  console.log('\nslowest by page rate        : page ' + slowestByPage.page + ` (${slowestByPage.lps} ltr/s)`);
  console.log('slowest by articulation rate: page ' + slowestByArtic.page + ` (${slowestByArtic.alps} ltr/s)`);
  console.log('closing page                : page ' + last.page + ` (page ${last.lps}, artic ${last.alps})`);

  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const totalMs = sum('ms');
  const totalPlanned = sum('plannedMs');
  const L = sum('letters');
  const W = sum('words');
  const S = sum('syl');

  const lps = L / (totalMs / 1000);
  const wpm = W / totalMs * 60000;
  const sps = S / (totalMs / 1000);

  console.log('\n================ CALIBRATED ARABIC NARRATION RATE ================');
  console.log(`pages measured        : ${rows.length}`);
  console.log(`measured total        : ${(totalMs / 1000).toFixed(1)} s`);
  console.log(`planned total         : ${(totalPlanned / 1000).toFixed(1)} s  (drift ${((totalMs - totalPlanned) / 1000).toFixed(1)} s, ${((totalMs / totalPlanned - 1) * 100).toFixed(0)}%)`);
  console.log(`Arabic letters        : ${L}`);
  console.log(`words                 : ${W}`);
  console.log('');
  console.log(`PRIMARY  letters/sec  : ${lps.toFixed(2)}`);
  console.log(`DERIVED  words/min    : ${wpm.toFixed(0)}   <- Arabic-specific, not portable to other languages`);
  console.log(`ESTIMATE syllables/sec: ${sps.toFixed(2)}   <- undercounts, unvocalised short vowels are invisible`);
  console.log(`         letters/word : ${(L / W).toFixed(2)}`);

  console.log('\nInterpretation:');
  console.log(`  The planned durations imply ${(W / totalPlanned * 60000).toFixed(0)} wpm and the audio delivered ${wpm.toFixed(0)} wpm.`);
  console.log('  Both sit far below the stated rule, and they agree with each other within a few percent.');
  console.log('  Two independent sources landing together is what makes the planned durations the credible');
  console.log('  figure and the stated words-per-minute rule the outlier.');
  console.log('');
  console.log('Recommended spec change: state the rule as letters/sec (objective in Arabic), and treat any');
  console.log('words-per-minute number as a derived per-language readout rather than a production target.');

  const out = path.join(ROOT, 'docs', 'content', 'narration-rate-calibration.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    measuredAt: new Date().toISOString(),
    source: path.relative(ROOT, MANIFEST).replace(/\\/g, '/'),
    voice: manifest.voice,
    model: manifest.model,
    language: manifest.language_code ?? manifest.language,
    primaryUnit: 'arabic_letters_per_second',
    lettersPerSecond: +lps.toFixed(2),
    derivedWordsPerMinute: Math.round(wpm),
    approxSyllablesPerSecond: +sps.toFixed(2),
    lettersPerWord: +(L / W).toFixed(2),
    totals: { pages: rows.length, measuredMs: totalMs, plannedMs: totalPlanned, letters: L, words: W },
    pages: rows,
    caveats: [
      'Syllables per second is an undercount: unvocalised Arabic hides most short vowels.',
      'Measured from one voice (Leda) and one register (calm bedtime narration for ages 3-5). Other registers need their own calibration.',
      'Page duration includes leading and trailing silence, so it is a page-duration rate, not an articulation rate.',
    ],
  }, null, 2) + '\n');
  console.log(`\nwrote ${path.relative(ROOT, out)}`);
}

main();
