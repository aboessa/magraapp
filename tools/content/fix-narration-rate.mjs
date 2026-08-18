// Majarra — replaces English-derived words-per-minute targets with the measured Arabic rate.
//
// THE FINDING THIS APPLIES
//
// All 15 story specs stated a narrator speed in words per minute, and all 15 planned
// per-page durations averaging 62% of it (range 55-77%). A near-constant error across
// files authored at different times points at the unit, not the authors.
//
// Speech tempo is not comparable across languages in words per minute, because a word
// is not a constant unit. An Arabic-English bilingual study found near-identical rates
// in words per second but significantly faster rates in Arabic once measured in
// syllables per second, i.e. Arabic carries more syllables per word. This corpus
// confirms it directly: 3.95 Arabic letters per word.
//   - https://en.wikipedia.org/wiki/Speech_tempo
//   - https://www.mdpi.com/2226-471X/9/12/368/xml
//   - https://languagelog.ldc.upenn.edu/nll/?p=22
//   - https://pmc.ncbi.nlm.nih.gov/articles/PMC6984970/
//
// So a wpm figure imported from English guidance will always overstate how fast Arabic
// can be read at the same perceived pace, by roughly the ratio observed here.
//
// WHY ONLY ONE SERIES IS CORRECTED
//
// The replacement rate is measured, not modelled: 3.51 Arabic letters/second from eight
// generated pages of a-calm-tale narration, corroborated by that series' own planned
// durations (59 wpm implied, 53 wpm delivered). Letters per second is a property of the
// REGISTER, and only the calm 3-5 register has been measured.
//
// bedtime-stories (stated 100 wpm, ages 6-8) and qisas-min-alhayat (stated 135 wpm,
// manual page turn) are deliberately left alone. Writing a corrected number for them
// would repeat the original mistake in the opposite direction: asserting an unmeasured
// target as fact. Each needs one calibration run, which is one page of generated audio.
//
// Usage:
//   node tools/content/fix-narration-rate.mjs --dry
//   node tools/content/fix-narration-rate.mjs --apply

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CALIBRATION = path.join(ROOT, 'docs', 'content', 'narration-rate-calibration.json');

/// Only series whose register has actually been measured.
const CALIBRATED_SERIES = [
  {
    // Matches the series bible and its four story files.
    match: /05-qisas[\\/](a-calm-tale|series-bible-a-calm-tale)/,
    statedWpm: 90,
  },
];

const arg = (n) => {
  const i = process.argv.indexOf('--' + n);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const OPT = { apply: !!arg('apply'), dry: !!arg('dry') };

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function main() {
  if (!OPT.apply && !OPT.dry) {
    console.log('Pass --dry to preview or --apply to write.');
    process.exit(1);
  }
  if (!fs.existsSync(CALIBRATION)) {
    console.error('No calibration found. Run: node tools/content/calibrate-narration-rate.mjs');
    process.exit(1);
  }

  const cal = JSON.parse(fs.readFileSync(CALIBRATION, 'utf8'));
  const lps = cal.lettersPerSecond;
  const wpm = cal.derivedWordsPerMinute;

  console.log(`calibrated rate: ${lps} Arabic letters/sec  (${wpm} wpm derived, ${cal.lettersPerWord} letters/word)`);
  console.log(`source: ${cal.source}, voice ${cal.voice}\n`);

  const files = walk(path.join(ROOT, 'docs', 'content', 'planets'));
  let touched = 0;

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const series = CALIBRATED_SERIES.find((s) => s.match.test(file));
    if (!series) continue;

    const md = fs.readFileSync(file, 'utf8');
    // No pre-gate on purpose. Two earlier versions gated on a regex and silently
    // skipped files that were already partly converted, leaving stale figures behind
    // while reporting success. The only reliable test of "did this file need work" is
    // whether the transforms actually changed it, so every transform runs and the
    // comparison at the end decides.

    // The new phrasing leads with the objective unit and keeps the wpm as a derived
    // readout, so the number stays legible to reviewers without becoming a target that
    // a future language would inherit.
    const replacement = `~${lps} حرف عربي/ثانية *(≈${wpm} كلمة/دقيقة للعربية — مقيس لا مُقدَّر)*`;
    let out = md.split(`~${series.statedWpm} كلمة/دقيقة`).join(replacement);

    // Per-page figures such as the closing line's "~75 كلمة/دقيقة" were written as a
    // RATIO of the narrator rule, not as absolute speeds: 75/90 means "read the last
    // page at 83% of your normal pace". So they convert by that same ratio, which keeps
    // the editorial intent while dropping the unit that did not transfer.
    //
    // Leaving them behind is not harmless. On the first run this file converted the
    // narrator rule and left the page-8 figure, so the audit lost the narrator rule,
    // fell back to the page figure, and compared 75 wpm against 59 wpm as though that
    // were the story's target.
    for (const m of [...md.matchAll(/~\s*(\d{2,3})\s*كلمة\/دقيقة/g)]) {
      const pageWpm = Number(m[1]);
      if (pageWpm === series.statedWpm) continue;
      const scaled = +(lps * (pageWpm / series.statedWpm)).toFixed(2);
      out = out.split(m[0]).join(
        `~${scaled} حرف عربي/ثانية *(${Math.round((pageWpm / series.statedWpm) * 100)}% من إيقاع الراوي)*`
      );
    }

    // Bare back-references such as "الصفحة 8 ~75" carry no unit, so the pattern above
    // does not see them and they survive as stale numbers in the acceptance criteria —
    // pointing a reviewer at a target that no longer exists anywhere else in the file.
    out = out.replace(
      /(الصفحة\s*(\d{1,2})\s*)~\s*(\d{2,3})(?!\s*(?:حرف|كلمة))/g,
      (whole, prefix, pageNo, wpmRef) => {
        const scaled = +(lps * (Number(wpmRef) / series.statedWpm)).toFixed(2);
        return `${prefix}~${scaled} حرف/ثانية`;
      }
    );

    // The bible contrasts its speed with other planets using the same discredited unit.
    out = out.replace(
      /مقابل\s*115[–-]140\s*في الكواكب الأخرى/g,
      'والمقارنة بالكواكب الأخرى تُجرى بالحرف/الثانية لا بالكلمة/الدقيقة'
    );

    if (out === md) continue;

    // Report what actually changed rather than a count from one pattern, so a file that
    // needed only its dangling back-reference fixed is not reported as "0 occurrences".
    const before = (md.match(/~\s*\d{2,3}\s*كلمة\/دقيقة/g) ?? []).length;
    const dangling = (md.match(/الصفحة\s*\d{1,2}\s*~\s*\d{2,3}(?!\s*(?:حرف|كلمة))/g) ?? []).length;
    const left = (out.match(/~\s*\d{2,3}\s*كلمة\/دقيقة/g) ?? []).length
      + (out.match(/الصفحة\s*\d{1,2}\s*~\s*\d{2,3}(?!\s*(?:حرف|كلمة))/g) ?? []).length;
    console.log(`${rel}  wpm:${before} dangling:${dangling} -> remaining:${left}`);
    if (OPT.apply) fs.writeFileSync(file, out, 'utf8');
    touched++;
  }

  console.log(`\n${touched} file(s) ${OPT.apply ? 'updated' : 'would be updated'}.`);
  console.log('\nDeliberately NOT changed, because their register is unmeasured:');
  console.log('  bedtime-stories      stated 100 wpm, ages 6-8');
  console.log('  qisas-min-alhayat    stated 135 wpm, manual page turn');
  console.log('Calibrate each with one generated page before touching their numbers:');
  console.log('  node tools/content/calibrate-narration-rate.mjs --manifest <manifest>');
}

main();
