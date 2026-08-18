// Majarra — pacing audit for every illustrated story spec.
//
// WHY THIS EXISTS
//
// Producing act-s1 narration surfaced a contradiction that is not a production
// mistake but a specification one. story-01-bird-home.md states three numbers that
// cannot all be true:
//
//   1. Narrator speed  ~90 words/min   (a red-flagged rule, and the series bible
//                                       calls it "the slowest on the platform")
//   2. Per-page durationMs summing to 42.6 s for 42 words  ->  implies 59 wpm
//   3. Unit duration    2:30-2:50      ->  150-170 s for those same 42 words
//
// Reading 42 words at 90 wpm takes 28 s. So (1) and (2) disagree by a factor of
// 1.5, and (3) disagrees with both by a factor of 5. The file also claims waits
// stretch 42.6 s to ~2:40, which needs ~117 s of waiting, while the stated rule
// autoTurnAfterMs = durationMs + 1000 adds only 7 s across 8 pages.
//
// This matters beyond documentation tidiness. `autoTurnAfterMs` drives automatic
// page turns in the bedtime path, and `duration_seconds` drives the catalogue.
// Generating narration against the wrong target produces audio that either rushes
// a three-year-old or turns the page before the sentence lands.
//
// So the audit measures, per story file:
//   * every stated words-per-minute rule
//   * the real word count per page, from the translation keys where present
//   * the planned durationMs per page
//   * the words-per-minute those planned durations actually imply
//   * the declared unit duration, against the sum of the planned pages
//
// It asserts nothing about which number is correct. It reports the gap so the
// editorial decision is made once, deliberately, and applied everywhere, instead of
// each story being discovered mid-production like act-s1 was.
//
// Usage:
//   node tools/content/audit-narration-pacing.mjs
//   node tools/content/audit-narration-pacing.mjs --json
//   node tools/content/audit-narration-pacing.mjs --tolerance 15

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CONTENT = path.join(ROOT, 'docs', 'content', 'planets');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}
const BASELINE = path.join(ROOT, 'docs', 'content', 'narration-pacing-baseline.json');

const OPT = {
  json: !!arg('json'),
  // CI mode: fail only on conflicts that are not already recorded as known debt.
  // A gate that fails on day one gets disabled on day two, so the 15 pre-existing
  // contradictions are recorded and the gate protects against NEW ones.
  check: !!arg('check'),
  writeBaseline: !!arg('write-baseline'),
  // Percent by which implied and stated speed may differ before it is called a
  // conflict. 10% absorbs rounding in hand-authored estimates; beyond that the two
  // numbers describe genuinely different performances.
  tolerance: typeof arg('tolerance') === 'string' ? Number(arg('tolerance')) : 10,
};

/// Arabic word count.
///
/// The separator '·' is used inside page-text cells to divide sentences, and the
/// tashkeel marks are combining characters that must not be counted as words.
/// Counting them would inflate every page and hide the real gap.
function countWords(text) {
  return text
    .replace(/[·•]/g, ' ')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .split(/\s+/)
    .filter((w) => /[\u0600-\u06FF a-zA-Z0-9]/.test(w) && w.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '').length > 0)
    .length;
}

const section = (md, heading) => {
  const start = md.indexOf(heading);
  if (start === -1) return '';
  const rest = md.slice(start + heading.length);
  // Stop at the next heading of the same or higher level.
  const level = heading.match(/^#+/)?.[0].length ?? 2;
  const next = rest.search(new RegExp(`\\n#{1,${level}} `));
  return next === -1 ? rest : rest.slice(0, next);
};

/// Page text from the translation-keys block: `xx.sN.pM = text`.
///
/// Preferred over the pages table because it holds the full sentence set per page
/// on one line, while the table splits sentences with '·' and sometimes wraps.
function pageTextsFromKeys(md) {
  const out = new Map();
  for (const m of md.matchAll(/^\s*[\w.]*\.p(\d{1,2})\s*=\s*(.+)$/gm)) {
    const page = Number(m[1]);
    const text = m[2].trim();
    if (text && !out.has(page)) out.set(page, text);
  }
  return out;
}

/// Fallback: the last cell of each row in the `## الصفحات` table.
function pageTextsFromTable(md) {
  const out = new Map();
  const sec = section(md, '## الصفحات');
  for (const line of sec.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
    if (cells.length < 3) continue;
    const page = Number(cells[0].replace(/\D/g, ''));
    const text = cells[cells.length - 1];
    if (!Number.isInteger(page) || page < 1 || page > 40) continue;
    if (!/[\u0600-\u06FF]/.test(text)) continue;
    if (!out.has(page)) out.set(page, text);
  }
  return out;
}

/// Planned durations from the timing summary.
///
/// Two layouts exist and both must work: a one-page-per-row table, and a
/// two-pages-per-row table that packs pages 1-6 and 7-12 side by side. Rather than
/// hardcoding column positions, the row is scanned for a small integer (a page
/// number) immediately followed by a large one (milliseconds). That reads both.
/// Player-inserted silence before a page, stated in the pronunciation notes as
/// "وقفة 800ms قبلها".
///
/// It has to be counted or the "closing page is the slowest" check asks the wrong
/// question. act-s1 page 8 reads at 3.17 letters/sec from its audio alone, which is
/// faster than page 1, but the spec also requires an 800 ms beat before it. Including
/// that beat puts the page at 2.78 and makes it the slowest page the child experiences,
/// which is what the requirement is about. The silence is deliberately not baked into
/// the WAV, so it can only be known from the spec.
function preRollByPage(md) {
  const out = new Map();
  for (const line of md.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const pageCell = cells.find((c) => /^\d{1,2}$/.test(c));
    if (!pageCell) continue;
    const pause = line.match(/وقفة\s*(\d{3,4})\s*(?:ms|ملّي|ملي)?\s*قبلها/);
    if (pause) out.set(Number(pageCell), Number(pause[1]));
  }
  return out;
}

function plannedDurations(md) {
  const out = new Map();
  const sec = section(md, '## ملخّص التوقيت') || section(md, '### الصوت والمؤثّرات لكل صفحة');
  for (const line of sec.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const nums = cells.map((c) => {
      const cleaned = c.replace(/\*\*/g, '').replace(/[,\s]/g, '');
      return /^\d+$/.test(cleaned) ? Number(cleaned) : null;
    });
    for (let i = 0; i < nums.length - 1; i++) {
      const page = nums[i];
      const ms = nums[i + 1];
      if (page !== null && ms !== null && page >= 1 && page <= 40 && ms >= 1000 && !out.has(page)) {
        out.set(page, ms);
      }
    }
  }
  return out;
}

const ARABIC_LETTER = /[\u0621-\u063A\u0641-\u064A\u0671-\u06D3]/g;
const countLetters = (s) => (s.match(ARABIC_LETTER) ?? []).length;

/// The calibrated rate in Arabic letters per second, if a file states one.
///
/// This is the unit that replaced words per minute, so the audit has to read it or the
/// guard stops working on exactly the files that were corrected. That happened once:
/// converting a-calm-tale removed its narrator wpm row, the audit fell back to the
/// page-8 figure of 75 wpm, and the comparison silently became meaningless.
function statedLettersPerSecond(md) {
  const m = md.match(/~\s*([\d.]+)\s*حرف عربي\/ثانية/);
  return m ? Number(m[1]) : null;
}

/// Every stated words-per-minute figure, with the row label it came from.
function statedWpm(md) {
  const found = [];
  for (const m of md.matchAll(/^\s*\|\s*([^|]{1,40}?)\s*\|([^|\n]*?~\s*(\d{2,3})\s*كلمة\/دقيقة[^|\n]*)\|/gm)) {
    found.push({ scope: m[1].replace(/\*\*/g, '').trim(), wpm: Number(m[3]) });
  }
  // Also catch prose mentions outside tables, e.g. a bible's emphasis line.
  for (const m of md.matchAll(/~\s*(\d{2,3})\s*كلمة\/دقيقة/g)) {
    const wpm = Number(m[1]);
    if (!found.some((f) => f.wpm === wpm)) found.push({ scope: '(prose)', wpm });
  }
  return found;
}

function declaredSeconds(md) {
  const m = md.match(/\|\s*`?duration_seconds`?\s*\|\s*\*{0,2}(\d{2,4})\*{0,2}/);
  if (m) return Number(m[1]);
  const r = md.match(/\|\s*المدة\s*\|\s*\*{0,2}(\d{1,2}):(\d{2})/);
  return r ? Number(r[1]) * 60 + Number(r[2]) : null;
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function audit(file) {
  const md = fs.readFileSync(file, 'utf8');
  const durations = plannedDurations(md);
  const keyTexts = pageTextsFromKeys(md);
  const tableTexts = pageTextsFromTable(md);
  const texts = keyTexts.size >= tableTexts.size ? keyTexts : tableTexts;
  const textSource = keyTexts.size >= tableTexts.size ? 'translation-keys' : 'pages-table';

  // A story spec is one that plans per-page narration durations. Bibles, game packs
  // and episode scripts are skipped rather than half-parsed.
  if (durations.size < 4 || texts.size < 4) return null;

  const preRoll = preRollByPage(md);

  const pages = [...durations.keys()].sort((a, b) => a - b).map((page) => {
    const ms = durations.get(page);
    const text = texts.get(page) ?? '';
    const words = countWords(text);
    const letters = countLetters(text);
    const lead = preRoll.get(page) ?? 0;
    // The page as experienced: the beat before it plus the narration.
    const pageMs = ms + lead;
    return {
      page,
      ms,
      preRollMs: lead || undefined,
      pageMs,
      words,
      letters,
      impliedWpm: words && ms ? Math.round((words / ms) * 60000) : null,
      impliedLps: letters && ms ? +(letters / (ms / 1000)).toFixed(2) : null,
      // Used for the slowest-page comparison, where the beat counts.
      experiencedLps: letters && pageMs ? +(letters / (pageMs / 1000)).toFixed(2) : null,
    };
  });

  const totalMs = pages.reduce((s, p) => s + p.ms, 0);
  const totalWords = pages.reduce((s, p) => s + p.words, 0);
  const totalLetters = pages.reduce((s, p) => s + p.letters, 0);
  const overallWpm = totalMs ? Math.round((totalWords / totalMs) * 60000) : null;
  const overallLps = totalMs ? +(totalLetters / (totalMs / 1000)).toFixed(2) : null;

  const lpsRule = statedLettersPerSecond(md);
  const stated = statedWpm(md);
  // The narrator-wide rule, not a single slower closing line. Skipped entirely once a
  // file has been converted to letters/second, because the only wpm figures left in
  // such a file are per-page relative notes, and treating one of those as the
  // narrator-wide target produces a false comparison.
  const narratorRule = lpsRule
    ? null
    : stated.find((s) => /راوي|السرعة|voiceover/i.test(s.scope)) ?? stated[0] ?? null;

  const declared = declaredSeconds(md);
  const conflicts = [];

  // Converted files are checked in the calibrated unit. Same test, objective unit.
  if (lpsRule && overallLps) {
    const gap = Math.abs(overallLps - lpsRule) / lpsRule * 100;
    if (gap > OPT.tolerance) {
      conflicts.push(
        `stated ${lpsRule} Arabic letters/sec but planned durations imply ${overallLps} `
        + `(${gap.toFixed(0)}% off; ${totalLetters} letters at ${lpsRule}/s takes `
        + `${(totalLetters / lpsRule).toFixed(1)}s, not ${(totalMs / 1000).toFixed(1)}s)`
      );
    }
  }

  if (narratorRule && overallWpm) {
    const gap = Math.abs(overallWpm - narratorRule.wpm) / narratorRule.wpm * 100;
    if (gap > OPT.tolerance) {
      conflicts.push(
        `stated ${narratorRule.wpm} wpm but planned durations imply ${overallWpm} wpm `
        + `(${gap.toFixed(0)}% off; reading ${totalWords} words at ${narratorRule.wpm} wpm takes `
        + `${(totalWords / narratorRule.wpm * 60).toFixed(1)}s, not ${(totalMs / 1000).toFixed(1)}s). `
        + `Words per minute does not transfer between languages; see `
        + `docs/content/narration-rate-calibration.json`
      );
    }
  }

  if (declared) {
    const narrationS = totalMs / 1000;
    // autoTurn adds 1 s per page except the last, per the stated rule.
    const withTurns = narrationS + Math.max(0, pages.length - 1);
    if (declared > withTurns * 1.5) {
      conflicts.push(
        `declared unit duration ${declared}s but pages plus page-turn waits total only `
        + `${withTurns.toFixed(0)}s — the gap of ${(declared - withTurns).toFixed(0)}s is unexplained by autoTurn = duration + 1000ms`
      );
    }
  }

  // A closing page that is meant to be the slowest but is not.
  //
  // Compared on the experienced rate, which includes any beat the spec calls for before
  // a page. Comparing narration alone marks a page as too fast when the spec has already
  // slowed it down with silence the audio file does not contain.
  const comparable = pages.filter((p) => p.experiencedLps !== null);
  const last = pages[pages.length - 1];
  const wantsSlowFinish = /أبطأ (جملة|صفحة)/.test(md);
  if (wantsSlowFinish && comparable.length && last.experiencedLps !== null) {
    const slowest = comparable.reduce((a, b) => (b.experiencedLps < a.experiencedLps ? b : a));
    if (slowest.page !== last.page) {
      conflicts.push(
        `the file requires the closing page to be the slowest, but page ${last.page} reads at `
        + `${last.experiencedLps} letters/sec${last.preRollMs ? ` (including its ${last.preRollMs} ms beat)` : ''} `
        + `while page ${slowest.page} is slower at ${slowest.experiencedLps}`
      );
    }
  }

  return {
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    textSource,
    pageCount: pages.length,
    totalWords,
    plannedNarrationMs: totalMs,
    impliedWpm: overallWpm,
    statedWpm: narratorRule?.wpm ?? null,
    statedLettersPerSecond: lpsRule,
    impliedLettersPerSecond: overallLps,
    totalLetters,
    allStatedWpm: stated,
    declaredUnitSeconds: declared,
    pages,
    conflicts,
  };
}

/// Reduces a conflict to a stable identity.
///
/// The kind is keyed, not the message: the message embeds measured numbers that move
/// whenever a duration is edited, so matching on text would make the baseline stale
/// after any harmless change. Keying on file plus conflict type means the baseline
/// says "this file has a known speed mismatch", and a *different* kind of
/// contradiction in the same file still fails.
function conflictKey(file, message) {
  const kind = /stated .* wpm but planned/.test(message) ? 'speed-mismatch'
    : /declared unit duration/.test(message) ? 'unit-duration-unexplained'
      : /closing page to be the slowest/.test(message) ? 'closing-page-not-slowest'
        : 'other';
  return `${file}::${kind}`;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    return { known: new Set(parsed.known ?? []), files: parsed.files ?? [] };
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(CONTENT)) throw new Error(`content tree not found: ${CONTENT}`);
  const results = walk(CONTENT).map(audit).filter(Boolean)
    .sort((a, b) => a.file.localeCompare(b.file));

  if (OPT.writeBaseline) {
    const known = [];
    for (const r of results) for (const c of r.conflicts) known.push(conflictKey(r.file, c));
    known.sort();
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify({
      recordedAt: new Date().toISOString(),
      note: 'Known narration-pacing contradictions, recorded so CI can block NEW ones. '
        + 'Entries are file::kind. Shrink this list; never grow it. '
        + 'See docs/content/narration-rate-calibration.json for the measured Arabic rate '
        + 'that supersedes the stated words-per-minute targets.',
      tolerancePercent: OPT.tolerance,
      // The parsed file list is recorded as well as the conflicts, because a file the
      // parser can no longer read produces zero conflicts and would otherwise look
      // like a pass. Found by testing the gate against a deliberate edit: the file
      // silently dropped from 15 specs to 14 and --check still exited 0.
      files: results.map((r) => r.file).sort(),
      known,
    }, null, 2) + '\n');
    console.log(`recorded ${known.length} known conflict(s) across ${results.length} spec(s) -> ${path.relative(ROOT, BASELINE)}`);
    return;
  }

  if (OPT.check) {
    const baseline = loadBaseline();
    if (!baseline) {
      console.error(`No baseline at ${path.relative(ROOT, BASELINE)}. Run --write-baseline once.`);
      process.exit(1);
    }
    const fresh = [];
    for (const r of results) {
      for (const c of r.conflicts) {
        if (!baseline.known.has(conflictKey(r.file, c))) fresh.push({ file: r.file, message: c });
      }
    }

    // A spec that no longer parses reports no conflicts, which is indistinguishable
    // from a clean spec unless the expected file set is checked explicitly.
    const parsed = new Set(results.map((r) => r.file));
    const vanished = baseline.files.filter((f) => !parsed.has(f));

    const total = results.reduce((s, r) => s + r.conflicts.length, 0);
    console.log(`story specs checked: ${results.length} (baseline expects ${baseline.files.length})`);
    console.log(`conflicts: ${total} total, ${baseline.known.size} known, ${fresh.length} new`);

    if (vanished.length) {
      console.error('\nStory specs the audit can no longer read:');
      for (const f of vanished) console.error(`  ${f}`);
      console.error(
        '\nEach of these parsed before and does not now, so its pacing is unchecked rather than correct.'
        + '\nUsual causes: the file was renamed or deleted, the `## الصفحات` or `## ملخّص التوقيت`'
        + '\nheading changed, or the file was rewritten with a different encoding.'
        + '\nIf the change is intentional, re-record the baseline with --write-baseline.'
      );
      process.exit(1);
    }

    if (fresh.length) {
      console.error('\nNEW narration-pacing contradictions:');
      for (const f of fresh) console.error(`  ${f.file}\n    * ${f.message}`);
      console.error(
        '\nA story spec must not state a narration pace its own per-page durations contradict.'
        + '\nThe measured Arabic rate is in docs/content/narration-rate-calibration.json'
        + '\n(3.51 Arabic letters/sec for calm narration, ages 3-5). Words-per-minute targets'
        + '\ncarried over from English guidance do not transfer to Arabic and should not be used.'
      );
      process.exit(1);
    }
    console.log('\nNo new contradictions.');
    return;
  }

  if (OPT.json) {
    console.log(JSON.stringify({ tolerancePercent: OPT.tolerance, stories: results }, null, 2));
    return;
  }

  console.log(`story specs with per-page narration timings: ${results.length}`);
  console.log(`tolerance: ${OPT.tolerance}% between stated and implied speed\n`);
  console.log(
    'file'.padEnd(52) + 'pg'.padStart(4) + 'words'.padStart(7)
    + 'plan_s'.padStart(8) + 'stated'.padStart(8) + 'implied'.padStart(9) + '  verdict'
  );

  let conflicted = 0;
  for (const r of results) {
    const ok = r.conflicts.length === 0;
    if (!ok) conflicted++;
    console.log(
      r.file.replace('docs/content/planets/', '').slice(0, 51).padEnd(52)
      + String(r.pageCount).padStart(4)
      + String(r.totalWords).padStart(7)
      + (r.plannedNarrationMs / 1000).toFixed(1).padStart(8)
      + String(r.statedLettersPerSecond ?? r.statedWpm ?? '—').padStart(8)
      + String(r.statedLettersPerSecond ? r.impliedLettersPerSecond : r.impliedWpm ?? '—').padStart(9)
      + (r.statedLettersPerSecond ? '  ltr/s' : '  wpm  ')
      + (ok ? '  ok' : `  ${r.conflicts.length} conflict(s)`)
    );
  }

  console.log(`\n${conflicted} of ${results.length} story specs are internally inconsistent.\n`);
  for (const r of results.filter((x) => x.conflicts.length)) {
    console.log(`--- ${r.file}`);
    for (const c of r.conflicts) console.log(`    * ${c}`);
  }

  const withBoth = results.filter((r) => r.statedWpm && r.impliedWpm);
  if (withBoth.length) {
    const ratios = withBoth.map((r) => r.impliedWpm / r.statedWpm);
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    console.log(
      `\nAcross ${withBoth.length} specs the planned durations run on average `
      + `${(mean * 100).toFixed(0)}% of the stated speed `
      + `(range ${(Math.min(...ratios) * 100).toFixed(0)}%-${(Math.max(...ratios) * 100).toFixed(0)}%).`
    );
    console.log(
      mean < 0.9
        ? 'The estimates are consistently SLOWER than the stated rule, so the two were authored independently\n'
          + 'rather than one being derived from the other. Pick which is authoritative once, then regenerate the other.'
        : 'The estimates broadly track the stated rule.'
    );
  }
}

main();
