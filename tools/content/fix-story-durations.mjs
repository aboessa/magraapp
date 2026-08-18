// Majarra — recomputes `duration_seconds` in story specs from the page model contract.
//
// THE DECISION THIS ENCODES
//
// Every story spec declared a unit duration that its own per-page timings could not
// produce: story-01-bird-home.md claims 160 s while its eight pages plus page-turn
// waits total about 50 s. The same gap, 100-153 s, appears in all 15 specs.
//
// The tie is broken by docs/content/planets/05-qisas/00-story-page-model.md, which
// calls itself the contract between content, app and dashboard and requires every
// story in the planet to follow it literally. That document:
//
//   * defines only `durationMs` (audio length, auto-extracted) and
//     `autoTurnAfterMs` (audio length + wait) as page timing fields
//   * states the post-audio wait four separate times and consistently:
//     500-1000 ms generally, 900-1000 ms on the bedtime path, and
//     "autoTurnAfterMs = duration + 900-1000ms" in its acceptance criteria
//   * contains no notion of dwell or look-at-the-picture time at all
//   * never lists `duration_seconds` among the required page fields
//
// So `duration_seconds` is a catalogue summary, not a contract field, and three
// operational sources agree against it: the per-page planned durations, the contract's
// own autoTurn rule, and the narration this pipeline actually measured (47.3 s for
// act-s1, versus 42.6 s planned). Two summary figures disagree. The summary is what
// gets corrected.
//
// WHAT IS AND IS NOT CHANGED
//
// Only `duration_seconds` and the timing-summary total are rewritten, both of which
// are derived values. Per-page `durationMs`, the Arabic text, the brightness curve and
// every editorial rule are left exactly as they are: those are authored decisions, and
// the planned durations have now been corroborated by measurement.
//
// Usage:
//   node tools/content/fix-story-durations.mjs --dry
//   node tools/content/fix-story-durations.mjs --apply

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CONTENT = path.join(ROOT, 'docs', 'content', 'planets');

/// The bedtime path uses the longest wait the contract permits, because the contract
/// states plainly that a fast turn alerts and a slow one settles.
const WAIT_MS = 1000;

const arg = (n) => {
  const i = process.argv.indexOf('--' + n);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const OPT = { apply: !!arg('apply'), dry: !!arg('dry') };

const section = (md, heading) => {
  const start = md.indexOf(heading);
  if (start === -1) return { start: -1, end: -1, body: '' };
  const rest = md.slice(start + heading.length);
  const level = heading.match(/^#+/)?.[0].length ?? 2;
  const next = rest.search(new RegExp(`\\n#{1,${level}} `));
  const end = next === -1 ? md.length : start + heading.length + next;
  return { start, end, body: md.slice(start + heading.length, end) };
};

/// Same page/duration reader as the audit: scan each row for a small integer followed
/// by a large one, which reads both the one-page-per-row and two-pages-per-row layouts
/// without hardcoding column positions.
function plannedDurations(md) {
  const out = new Map();
  const sec = section(md, '## ملخّص التوقيت').body || section(md, '### الصوت والمؤثّرات لكل صفحة').body;
  for (const line of sec.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const nums = line.split('|').map((c) => {
      const t = c.replace(/\*\*/g, '').replace(/[,\s]/g, '');
      return /^\d+$/.test(t) ? Number(t) : null;
    });
    for (let i = 0; i < nums.length - 1; i++) {
      const p = nums[i];
      const ms = nums[i + 1];
      if (p !== null && ms !== null && p >= 1 && p <= 40 && ms >= 1000 && !out.has(p)) out.set(p, ms);
    }
  }
  return out;
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function process_(file) {
  const md = fs.readFileSync(file, 'utf8');
  const durations = plannedDurations(md);
  if (durations.size < 4) return null;

  const declared = md.match(/(\|\s*`duration_seconds`\s*\|\s*)(\*{0,2})(\d{2,4})(\*{0,2})([^|\n]*)(\|)/);
  if (!declared) return null;

  const pages = durations.size;
  const narrationMs = [...durations.values()].reduce((a, b) => a + b, 0);
  // The last page has no autoTurn by design in this planet, so waits apply to pages-1.
  const totalMs = narrationMs + (pages - 1) * WAIT_MS;
  const correct = Math.round(totalMs / 1000);
  const before = Number(declared[3]);

  if (before === correct) return { file, changed: false, before, correct, pages, narrationMs };

  let out = md.replace(
    declared[0],
    `${declared[1]}**${correct}** *(${mmss(correct)})*${declared[6]}`
  );

  // Also correct the narrated-total row in the timing summary if it states one, so the
  // table cannot contradict the card it sits below.
  out = out.replace(
    /(\|\s*\*\*المجموع\*\*\s*\|\s*\*\*)([\d.]+)s(\*\*\s*سرد\s*\|\s*\*\*)~?[\d:]+(\*\*\s*بالانتظارات\s*\|)/,
    `$1${(narrationMs / 1000).toFixed(1)}s$3~${mmss(correct)}$4`
  );

  return { file, changed: true, before, correct, pages, narrationMs, out };
}

function main() {
  if (!OPT.apply && !OPT.dry) {
    console.log('Pass --dry to preview or --apply to write.');
    process.exit(1);
  }

  const results = walk(CONTENT).map(process_).filter(Boolean)
    .sort((a, b) => a.file.localeCompare(b.file));

  console.log(`post-audio wait: ${WAIT_MS} ms per page turn (contract: 900-1000 ms on the bedtime path)`);
  console.log(`${OPT.apply ? 'APPLYING' : 'DRY RUN'}\n`);
  console.log('file'.padEnd(48) + 'pg'.padStart(4) + 'narration'.padStart(11) + 'was'.padStart(6) + 'now'.padStart(6));

  let changed = 0;
  for (const r of results) {
    console.log(
      path.relative(ROOT, r.file).replace(/\\/g, '/').replace('docs/content/planets/', '').slice(0, 47).padEnd(48)
      + String(r.pages).padStart(4)
      + `${(r.narrationMs / 1000).toFixed(1)}s`.padStart(11)
      + String(r.before).padStart(6)
      + String(r.correct).padStart(6)
      + (r.changed ? '' : '   (already correct)')
    );
    if (r.changed && OPT.apply) {
      fs.writeFileSync(r.file, r.out, 'utf8');
      changed++;
    } else if (r.changed) {
      changed++;
    }
  }

  console.log(`\n${changed} of ${results.length} spec(s) ${OPT.apply ? 'corrected' : 'would change'}.`);
  if (OPT.apply) {
    console.log('Re-run the audit and re-record the baseline:');
    console.log('  node tools/content/audit-narration-pacing.mjs');
    console.log('  node tools/content/audit-narration-pacing.mjs --write-baseline');
  }
}

main();
