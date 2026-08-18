#!/usr/bin/env node
// Story page dwell model — allocation + validation.
//
// MODEL (see docs/content/planets/05-qisas/00-story-page-model.md):
//   duration_ms = actual narration asset duration ONLY.
//   dwell_ms    = authored illustration viewing time AFTER narration completes.
//   estimatedExperienceMs (derived, never stored) =
//       SUM(narration) + SUM(dwell of pages 1..n-1) + (n-1) * readerTransitionMs
//
//   The final page's dwell is authored but excluded from the auto-turn estimate:
//   the reader does not auto-advance off the last page, so that pause is
//   viewing time before the completion screen, not part of the turn chain.
//
// Usage:
//   node tools/dwell_model.mjs report            # validation report only
//   node tools/dwell_model.mjs plan   > out.sql  # per-page UPDATE statements
//   node tools/dwell_model.mjs report --remote   # run against remote D1
//
// This tool never writes a blanket value: every page gets its own number from
// its own narration length and position in the story arc.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── calibration ────────────────────────────────────────────────────────────
// docs/content/narration-rate-calibration.json — measured from the only story
// whose narration exists as real audio (act-s1 / bird-home, Leda voice).
// Used ONLY to estimate narration for stories whose audio is not produced yet.
const ARABIC_LETTERS_PER_SECOND = 3.52;
const MIN_ESTIMATED_NARRATION_MS = 2500;

// Mirrors `_pageTransitionDuration` in
// app_main/lib/features/reader/presentation/pages/story_reader_page.dart.
// Transition duration is UI animation config, never story page content data.
const READER_PAGE_TRANSITION_MS = 280;

// ── editorial targets ──────────────────────────────────────────────────────
// Intersection of the series bible range and each story's own acceptance line.
//   series-bible-a-calm-tale.md:125      المدة 2:30–2:50  → 150–170s
//   series-bible-bedtime-stories.md:166  المدة 4:00–4:40  → 240–280s
//   story-*.md acceptance                المدة N ثانية ±T
const TARGETS = {
  // a-calm-tale — 8 pages, calm bedtime illustrations
  'bird-home': { min: 150, max: 170, band: 'calm', doc: 'a-calm-tale/story-01-bird-home.md:348 (160±10)' },
  'goodnight-toys': { min: 160, max: 170, band: 'calm', doc: 'a-calm-tale/story-02-goodnight-toys.md:228 (170±10 ∩ 150–170)' },
  'moon-sleeps': { min: 150, max: 160, band: 'calm', doc: 'a-calm-tale/story-03-moon-sleeps.md:277 (150±10 ∩ 150–170)' },
  'warm-hugs': { min: 155, max: 170, band: 'calm', doc: 'a-calm-tale/story-04-warm-hugs.md:252 (165±10 ∩ 150–170)' },
  // bedtime-stories — 12 pages, detailed illustrations
  'ant-journey': { min: 245, max: 275, band: 'bedtime', doc: 'bedtime-stories/story-01-ant-journey.md:290 (260±15)' },
  'garden-secret': { min: 255, max: 280, band: 'bedtime', doc: 'bedtime-stories/story-02-garden-secret.md:306 (270±15 ∩ 240–280)' },
  'new-friend': { min: 240, max: 265, band: 'bedtime', doc: 'bedtime-stories/story-03-new-friend.md:306 (250±15 ∩ 240–280)' },
  'rainy-night': { min: 240, max: 255, band: 'bedtime', doc: 'bedtime-stories/story-04-rainy-night.md:366 (240±15 ∩ 240–280)' },
  'old-lantern': { min: 265, max: 280, band: 'bedtime', doc: 'bedtime-stories/story-05-old-lantern.md:329 (280±15 ∩ 240–280)' },
  'lost-star': { min: 245, max: 275, band: 'bedtime', doc: 'bedtime-stories/story-06-lost-star.md:339 (260±15)' },
};

// Authoring guidance per band (ms). `prefer` is the editorial guideline range;
// `floor`/`ceil` are the hard bounds the allocator may use when a story's real
// narration is long enough that a 12–18s pause would overshoot the target.
// The reader never hard-codes any of these; they only bound authoring.
const BANDS = {
  calm: { prefer: [9000, 18000], floor: 5000, ceil: 20000, label: 'حكاية هادئة · calm illustration' },
  bedtime: { prefer: [10000, 18000], floor: 5000, ceil: 20000, label: 'حكايات قبل النوم · detailed illustration' },
};

// `قصص من الحياة` is a self-read series: its editorial target is narration
// duration (300–420s, series-bible-qisas-min-alhayat.md:28) and it must NOT
// auto-turn, so dwell there is a small reading pause and is reported only.
const SELF_READ_SERIES = 'series-qisas-min-alhayat';
const SELF_READ_NARRATION_TARGET = { min: 300, max: 420 };

// ── D1 access ──────────────────────────────────────────────────────────────
// Wrangler is invoked through its JS entry point rather than a shell so the SQL
// text is passed as a single argv entry (no shell quoting, no injection path).
const WRANGLER_BIN = path.join(API_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function d1(sql, remote) {
  const args = [
    WRANGLER_BIN, 'd1', 'execute', 'majarra-db',
    remote ? '--remote' : '--local',
    '--command', sql, '--json',
  ];
  const out = execFileSync(process.execPath, args, {
    cwd: API_DIR,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const start = out.indexOf('[');
  const parsed = JSON.parse(out.slice(start));
  return parsed[0].results;
}

function loadPages(remote) {
  return d1(
    `SELECT s.slug, s.title_ar, s.series_id, sp.id AS page_id, sp.page_number,
            sp.duration_ms, sp.dwell_ms, spl.body_text
       FROM story_pages sp
       JOIN stories s ON s.id = sp.story_id
       LEFT JOIN story_page_localizations spl
         ON spl.page_id = sp.id AND spl.language = 'ar'
      ORDER BY s.slug, sp.page_number`,
    remote,
  );
}

// ── narration ──────────────────────────────────────────────────────────────
const ARABIC_LETTER = /[\u0621-\u063A\u0641-\u064A]/g;

function arabicLetters(text) {
  if (typeof text !== 'string') return 0;
  return (text.match(ARABIC_LETTER) ?? []).length;
}

/** Real asset duration when it exists; calibrated estimate otherwise. */
function narrationFor(page) {
  const real = page.duration_ms;
  if (real !== null && real !== undefined && Number(real) > 0) {
    return { ms: Number(real), measured: true };
  }
  const letters = arabicLetters(page.body_text);
  const ms = Math.max(
    MIN_ESTIMATED_NARRATION_MS,
    Math.round((letters / ARABIC_LETTERS_PER_SECOND) * 1000),
  );
  return { ms, measured: false, letters };
}

// ── dwell allocation ───────────────────────────────────────────────────────
/**
 * Story-arc weight — continuous curve peaking in the second third.
 *
 * The page model puts the emotional peak in the second third and stillness at
 * the end (brightness curve 1.00 → 0.70), so the middle pages earn the longest
 * look while the opening and closing pages stay lighter.
 */
function arcWeight(position) {
  const peak = 0.6;
  const spread = 0.24;
  return 0.86 + 0.34 * Math.exp(-((position - peak) ** 2) / (2 * spread ** 2));
}

/**
 * Allocates per-page dwell so the estimated experience lands inside the
 * editorial target, with different values per page.
 */
function allocate(story) {
  const pages = story.pages;
  const n = pages.length;
  const band = BANDS[story.target.band];
  const targetMid = ((story.target.min + story.target.max) / 2) * 1000;
  const transitionTotal = (n - 1) * READER_PAGE_TRANSITION_MS;
  const narrationTotal = pages.reduce((sum, p) => sum + p.narrationMs, 0);

  // Only pages 1..n-1 drive the auto-turn chain.
  const turning = pages.slice(0, n - 1);
  const required = targetMid - narrationTotal - transitionTotal;

  const maxLetters = Math.max(1, ...pages.map((p) => p.letters ?? 0));
  const weights = turning.map((p, index) => {
    const arc = arcWeight(index / Math.max(1, n - 1));
    // Sparse text means the illustration carries the page: look a little longer.
    const sparsity = 1 + 0.22 * (1 - Math.min(1, (p.letters ?? maxLetters) / maxLetters));
    return arc * sparsity;
  });

  // Proportional split, then clamp to the authoring band and redistribute the
  // residual over pages that still have headroom.
  const values = new Array(turning.length).fill(0);
  let free = turning.map((_, i) => i);
  let remaining = required;

  for (let pass = 0; pass < 8 && free.length > 0; pass += 1) {
    const weightSum = free.reduce((sum, i) => sum + weights[i], 0);
    if (weightSum <= 0) break;
    const clamped = [];
    for (const i of free) {
      const raw = (remaining * weights[i]) / weightSum;
      const bounded = Math.min(band.ceil, Math.max(band.floor, raw));
      values[i] = bounded;
      if (bounded !== raw) clamped.push(i);
    }
    if (clamped.length === 0) break;
    for (const i of clamped) remaining -= values[i];
    free = free.filter((i) => !clamped.includes(i));
  }

  // Round to 100ms so authored numbers stay human-readable in the builder.
  const rounded = values.map((v) => Math.round(v / 100) * 100);

  // Correct the rounding drift on the page with the most headroom.
  let drift = Math.round(required) - rounded.reduce((a, b) => a + b, 0);
  for (let guard = 0; guard < 200 && Math.abs(drift) >= 100; guard += 1) {
    const step = drift > 0 ? 100 : -100;
    const candidate = rounded
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => (step > 0 ? value + step <= band.ceil : value + step >= band.floor))
      .sort((a, b) => (step > 0 ? a.value - b.value : b.value - a.value))[0];
    if (!candidate) break;
    rounded[candidate.index] += step;
    drift -= step;
  }

  // The final page is authored too (stillness), but never auto-turns.
  const finalDwell = Math.round(
    Math.min(band.ceil, Math.max(band.floor, rounded[rounded.length - 1] ?? band.floor)) / 100,
  ) * 100;

  pages.forEach((page, index) => {
    page.dwellMs = index === n - 1 ? finalDwell : rounded[index];
  });
  return story;
}

// ── report ─────────────────────────────────────────────────────────────────
function buildStories(rows, { useAllocated }) {
  const byStory = new Map();
  for (const row of rows) {
    if (!byStory.has(row.slug)) {
      byStory.set(row.slug, {
        slug: row.slug,
        title: row.title_ar,
        seriesId: row.series_id,
        target: TARGETS[row.slug] ?? null,
        pages: [],
      });
    }
    const narration = narrationFor(row);
    byStory.get(row.slug).pages.push({
      pageId: row.page_id,
      pageNumber: Number(row.page_number),
      narrationMs: narration.ms,
      narrationMeasured: narration.measured,
      letters: narration.letters ?? null,
      currentDwellMs: row.dwell_ms === null || row.dwell_ms === undefined ? null : Number(row.dwell_ms),
      dwellMs: row.dwell_ms === null || row.dwell_ms === undefined ? null : Number(row.dwell_ms),
    });
  }
  const stories = [...byStory.values()];
  if (useAllocated) {
    for (const story of stories) {
      if (story.target) allocate(story);
    }
  }
  return stories;
}

function summarise(story) {
  const n = story.pages.length;
  const narrationTotal = story.pages.reduce((s, p) => s + p.narrationMs, 0);
  const dwellTotal = story.pages.reduce((s, p) => s + (p.dwellMs ?? 0), 0);
  const dwellEffective = story.pages
    .slice(0, n - 1)
    .reduce((s, p) => s + (p.dwellMs ?? 0), 0);
  const transitionTotal = (n - 1) * READER_PAGE_TRANSITION_MS;
  const estimateMs = narrationTotal + dwellEffective + transitionTotal;
  const measured = story.pages.every((p) => p.narrationMeasured);
  const target = story.target;
  let status = 'N/A';
  if (target) {
    status = estimateMs / 1000 < target.min ? 'BELOW' : estimateMs / 1000 > target.max ? 'ABOVE' : 'PASS';
  }
  const band = target ? BANDS[target.band] : null;
  const belowGuidance = band
    ? story.pages.filter((p) => p.dwellMs !== null && p.dwellMs < band.prefer[0]).length
    : 0;
  const aboveGuidance = band
    ? story.pages.filter((p) => p.dwellMs !== null && p.dwellMs > band.prefer[1]).length
    : 0;
  return {
    n, narrationTotal, dwellTotal, dwellEffective, transitionTotal, estimateMs, measured, status,
    belowGuidance, aboveGuidance, band,
  };
}

function s(ms) {
  return (ms / 1000).toFixed(1);
}

function printReport(stories) {
  const auto = stories.filter((story) => story.target);
  const selfRead = stories.filter((story) => !story.target && story.seriesId === SELF_READ_SERIES);
  const other = stories.filter((story) => !story.target && story.seriesId !== SELF_READ_SERIES);

  console.log('# Story dwell validation — auto-turn series (Read to Me)\n');
  console.log('| Story | Pages | Narration | Dwell(all) | Dwell(turning) | Transition | Estimated experience | Target | Status | Narration source |');
  console.log('|---|--:|--:|--:|--:|--:|--:|:-:|:-:|:-:|');
  for (const story of auto) {
    const r = summarise(story);
    console.log(
      `| ${story.slug} — ${story.title} | ${r.n} | ${s(r.narrationTotal)}s | ${s(r.dwellTotal)}s | ${s(r.dwellEffective)}s | ${s(r.transitionTotal)}s | ${s(r.estimateMs)}s | ${story.target.min}–${story.target.max}s | ${r.status} | ${r.measured ? 'measured' : 'estimated'} |`,
    );
  }

  console.log('\n## Per story detail\n');
  for (const story of auto) {
    const r = summarise(story);
    console.log(`Story: ${story.slug} — ${story.title}`);
    console.log(`  Pages: ${r.n}`);
    console.log(`  Narration: ${s(r.narrationTotal)}s${r.measured ? ' (measured from audio assets)' : ' (estimated at 3.52 Arabic letters/s — audio not produced yet)'}`);
    console.log(`  Dwell: ${s(r.dwellTotal)}s total · ${s(r.dwellEffective)}s drives auto-turn`);
    console.log(`  Transition estimate: ${s(r.transitionTotal)}s (${r.n - 1} × ${READER_PAGE_TRANSITION_MS}ms reader animation)`);
    console.log(`  Estimated experience: ${s(r.estimateMs)}s`);
    console.log(`  Target: ${story.target.min}–${story.target.max}s  [${story.target.doc}]`);
    console.log(`  Status: ${r.status}`);
    const dwellValues = story.pages.map((p) => `p${p.pageNumber}=${((p.dwellMs ?? 0) / 1000).toFixed(1)}s`);
    console.log(`  Per page dwell: ${dwellValues.join(' ')}`);
    const distinct = new Set(story.pages.map((p) => p.dwellMs)).size;
    console.log(`  Distinct dwell values: ${distinct}/${r.n}${distinct === 1 ? ' ⚠ blanket value' : ''}`);
    if (r.band && r.belowGuidance > 0) {
      console.log(
        `  ⚠ ${r.belowGuidance} page(s) below the ${r.band.prefer[0] / 1000}s guideline — narration on those pages is long, so a longer pause would push the story past its editorial target. Editorial review recommended.`,
      );
    }
    if (r.band && r.aboveGuidance > 0) {
      console.log(
        `  ⚠ ${r.aboveGuidance} page(s) above the ${r.band.prefer[1] / 1000}s guideline — short narration on a detailed illustration. Acceptable for a calm page; editorial review recommended.`,
      );
    }
    console.log('');
  }

  if (selfRead.length) {
    console.log('## Self-read series (قصص من الحياة) — no auto-turn, narration target only\n');
    console.log('| Story | Pages | Narration | Target narration | Status | Dwell(all) |');
    console.log('|---|--:|--:|--:|:-:|--:|');
    for (const story of selfRead) {
      const r = summarise(story);
      const seconds = r.narrationTotal / 1000;
      const status = seconds < SELF_READ_NARRATION_TARGET.min ? 'BELOW' : seconds > SELF_READ_NARRATION_TARGET.max ? 'ABOVE' : 'PASS';
      console.log(`| ${story.slug} — ${story.title} | ${r.n} | ${s(r.narrationTotal)}s | ${SELF_READ_NARRATION_TARGET.min}–${SELF_READ_NARRATION_TARGET.max}s | ${status} | ${s(r.dwellTotal)}s |`);
    }
    console.log('\nSelf Read never auto-turns, so dwell here is an authored reading pause only.\n');
  }

  if (other.length) {
    console.log('## Stories without an editorial dwell target\n');
    for (const story of other) {
      const r = summarise(story);
      console.log(`- ${story.slug} — ${r.n} pages · narration ${s(r.narrationTotal)}s · dwell ${s(r.dwellTotal)}s — needs editorial review`);
    }
    console.log('');
  }

  const failing = auto.filter((story) => summarise(story).status !== 'PASS');
  console.log(`## Result: ${auto.length - failing.length}/${auto.length} auto-turn stories PASS`);
  if (failing.length) {
    console.log('Requires editorial review:');
    for (const story of failing) {
      const r = summarise(story);
      console.log(`- ${story.slug}: ${s(r.estimateMs)}s vs ${story.target.min}–${story.target.max}s (${r.status})`);
    }
  }
  const estimatedNarration = auto.filter((story) => !summarise(story).measured);
  if (estimatedNarration.length) {
    console.log('\nNarration still estimated (revalidate after audio is recorded):');
    for (const story of estimatedNarration) console.log(`- ${story.slug}`);
  }
  return failing.length === 0;
}

function printPlan(stories) {
  const auto = stories.filter((story) => story.target);
  console.log('-- Generated by dashboard/api/tools/dwell_model.mjs plan');
  console.log('-- Per-page dwell derived from each page\'s narration length and story position.');
  console.log('');
  for (const story of auto) {
    const r = summarise(story);
    console.log(`-- ${story.slug} — ${story.title} — ${r.n} pages — narration ${s(r.narrationTotal)}s — target ${story.target.min}-${story.target.max}s — estimate ${s(r.estimateMs)}s — ${r.status}`);
    for (const page of story.pages) {
      console.log(
        `UPDATE story_pages SET dwell_ms = ${page.dwellMs} WHERE id = '${page.pageId}'; -- p${page.pageNumber} narration ${s(page.narrationMs)}s`,
      );
    }
    console.log('');
  }
}

// ── main ───────────────────────────────────────────────────────────────────
const command = process.argv[2] ?? 'report';
const remote = process.argv.includes('--remote');
const rows = loadPages(remote);

if (command === 'plan') {
  printPlan(buildStories(rows, { useAllocated: true }));
} else if (command === 'preview') {
  const ok = printReport(buildStories(rows, { useAllocated: true }));
  process.exitCode = ok ? 0 : 1;
} else if (command === 'report') {
  const ok = printReport(buildStories(rows, { useAllocated: false }));
  process.exitCode = ok ? 0 : 1;
} else {
  console.error('Usage: node tools/dwell_model.mjs [report|preview|plan] [--remote]');
  process.exitCode = 2;
}
