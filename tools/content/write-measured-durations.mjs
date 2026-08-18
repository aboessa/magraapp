// Majarra — writes measured narration durations back into a story spec.
//
// Every story file in this planet already mandates this, in its own words:
//   "المدد أعلاه تقديرية للتخطيط. تُستخرج فعليًا من ملفات الصوت المسجّلة، ولكل لغة على حدة."
// and in its acceptance criteria:
//   "المدد مقيسة من الملفات لكل لغة"
//
// Until narration exists there is nothing to measure, so the planning estimates stand.
// act-s1 now has eight generated and QC'd files, so its estimates are superseded.
//
// The gap is small but real: 42.6 s planned against 47.3 s delivered, which is the 11%
// that keeps the spec failing its own letters-per-second check. Closing it here is not
// tuning a number to make a test pass — the test is comparing the spec against reality,
// and reality is the audio.
//
// autoTurnAfterMs is recomputed as duration + 1000 ms per the page model contract, with
// the final page left without one, which is that planet's stated rule.
//
// Usage:
//   node tools/content/write-measured-durations.mjs --dry
//   node tools/content/write-measured-durations.mjs --apply

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const WAIT_MS = 1000;

const arg = (n) => {
  const i = process.argv.indexOf('--' + n);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const OPT = {
  apply: !!arg('apply'),
  dry: !!arg('dry'),
  spec: typeof arg('spec') === 'string'
    ? arg('spec')
    : 'docs/content/planets/05-qisas/a-calm-tale/story-01-bird-home.md',
  durations: typeof arg('durations') === 'string'
    ? arg('durations')
    : 'assets/audio/stories/act-s1/ar/_durations.json',
};

function main() {
  if (!OPT.apply && !OPT.dry) {
    console.log('Pass --dry to preview or --apply to write.');
    process.exit(1);
  }

  const specPath = path.join(ROOT, OPT.spec);
  const durPath = path.join(ROOT, OPT.durations);
  for (const p of [specPath, durPath]) {
    if (!fs.existsSync(p)) throw new Error(`missing: ${path.relative(ROOT, p)}`);
  }

  const measured = JSON.parse(fs.readFileSync(durPath, 'utf8'));
  const byPage = new Map(measured.pages.map((p) => [p.page, p.measuredDurationMs]));
  let md = fs.readFileSync(specPath, 'utf8');

  const pageCount = measured.pages.length;
  const rows = [];

  // Rewrite the per-page rows in both timing tables. Matching on a row that starts with
  // the page number and is followed by two millisecond cells keeps the edit surgical:
  // the audio-file name, sfx, brightness and motion cells are carried through untouched.
  // Rewritten cell-by-cell rather than with one row-shaped regex.
  //
  // A single regex failed on this file, and failed quietly: it rewrote 7 rows instead of
  // 16. The story has TWO timing tables with different column orders — one is
  // page | audiofile | durationMs | autoTurn | sfx, the other is
  // page | durationMs | autoTurn | brightness | motion — and the final page states its
  // autoTurn as the words "بلا autoTurn" rather than a number, so it matched neither.
  // A partial rewrite is worse than none: it leaves two tables disagreeing about the
  // same page.
  //
  // Splitting each row into cells and locating the duration by value means both layouts
  // and the text cell are handled by the same code.
  md = md.split('\n').map((line) => {
    if (!line.trim().startsWith('|')) return line;
    const cells = line.split('|');
    // cells[0] and the last are the empty edges of a markdown row.
    const pageIdx = cells.findIndex((c, i) => i > 0 && /^\s*\d{1,2}\s*$/.test(c));
    if (pageIdx === -1) return line;
    const page = Number(cells[pageIdx].trim());
    const ms = byPage.get(page);
    if (ms === undefined) return line;

    // The duration is the first millisecond-scale number after the page number; the
    // autoTurn is the next cell, numeric or not.
    const durIdx = cells.findIndex((c, i) => i > pageIdx && /^\s*\**\s*\d{4,6}\s*\**\s*$/.test(c));
    if (durIdx === -1) return line;

    const oldMs = Number(cells[durIdx].replace(/[^\d]/g, ''));
    cells[durIdx] = cells[durIdx].replace(/\d{4,6}/, String(ms));

    const turnIdx = durIdx + 1;
    const isLast = page === pageCount;
    if (turnIdx < cells.length - 1) {
      const cell = cells[turnIdx];
      if (/^\s*\**\s*\d{4,6}\s*\**\s*$/.test(cell)) {
        // The last page keeps no autoTurn, which is this planet's stated rule.
        cells[turnIdx] = isLast ? ' — ' : cell.replace(/\d{4,6}/, String(ms + WAIT_MS));
      } else if (/^\s*—\s*$/.test(cell) && !isLast) {
        cells[turnIdx] = ` ${ms + WAIT_MS} `;
      }
      // A prose cell such as "بلا autoTurn" is deliberately left as written: it already
      // says the right thing and is not a value to recompute.
    }

    rows.push({ page, from: oldMs, to: ms });
    return cells.join('|');
  }).join('\n');

  // The summary table in this planet's 8-page stories puts durationMs and autoTurn in
  // columns 2 and 3 followed by brightness and motion, so it matches the same shape.
  const total = measured.pages.reduce((s, p) => s + p.measuredDurationMs, 0);
  const withTurns = total + (pageCount - 1) * WAIT_MS;

  md = md.replace(
    /(\|\s*\*\*المجموع\*\*\s*\|\s*\*\*)[\d.]+s(\*\*\s*سرد\s*\|\s*\*\*)~?[\d:]+(\*\*\s*بالانتظارات\s*\|)/,
    `$1${(total / 1000).toFixed(1)}s$2~${Math.floor(withTurns / 60000)}:${String(Math.round((withTurns % 60000) / 1000)).padStart(2, '0')}$3`
  );

  const secs = Math.round(withTurns / 1000);
  md = md.replace(
    /(\|\s*`duration_seconds`\s*\|\s*)\*{0,2}\d{2,4}\*{0,2}[^|\n]*(\|)/,
    `$1**${secs}** *(${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')})*$2`
  );

  // Replace the planning caveat with a statement of fact, so a reviewer is not told to
  // re-measure numbers that are already measured.
  md = md.replace(
    /⚠️ \*\*المدد أعلاه تقديرية للتخطيط\.\*\*[^\n]*/,
    `✅ **المدد أعلاه مقيسة من ملفات الصوت الفعلية** (${measured.voice} · ${measured.model}) `
    + `ولكل لغة على حدة. \`autoTurnAfterMs\` = المدة + **${WAIT_MS}ms** *(الحدّ الأعلى المسموح في مسار النوم)*، `
    + `والصفحة ${pageCount} بلا تقليب تلقائي بحكم القاعدة.`
  );

  console.log(`spec      ${OPT.spec}`);
  console.log(`durations ${OPT.durations}  (voice ${measured.voice})\n`);
  console.log('page'.padStart(5) + 'was'.padStart(8) + 'now'.padStart(8) + 'drift'.padStart(8));
  for (const r of rows.sort((a, b) => a.page - b.page)) {
    console.log(String(r.page).padStart(5) + String(r.from).padStart(8) + String(r.to).padStart(8)
      + `${r.to - r.from >= 0 ? '+' : ''}${r.to - r.from}`.padStart(8));
  }
  console.log(`\nnarration total ${(total / 1000).toFixed(1)}s, with turns ${secs}s`);
  console.log(`rows rewritten: ${rows.length} (expected ${pageCount} per timing table)`);

  if (OPT.apply) {
    fs.writeFileSync(specPath, md, 'utf8');
    console.log('\nwritten. Re-run the audit, then re-record the baseline.');
  } else {
    console.log('\nDry run. Nothing written.');
  }
}

main();
