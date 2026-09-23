#!/usr/bin/env node
// validate-islamic-full-scripts.mjs
//
// READ-ONLY validator for the Islamic "66 full draft scripts" expansion task.
//
// It proves, deterministically and without mutating anything:
//   1. The 12 source briefs (review-drafts.md) declare exactly 66 expected units.
//   2. Every expected unit has exactly one matching ep-NN-<slug>.md full script,
//      with no extra ep-* files that do not map to a known unit.
//   3. Each full script carries every required section and metadata field.
//   4. Each script is draft-v2 / review_sharia with empty reviewer & license
//      fields, and contains none of the forbidden approval/publication claims
//      or forbidden religious schema fields (ruling / madhhab / fatwa_ref /
//      approved / published / production_ready).
//   5. production_beats_seconds is a JSON array of only 4/6/8/10 that sums
//      exactly to duration_seconds.
//   6. The source_reference from the brief appears verbatim in the script.
//   7. The visual restrictions, audio restrictions, language-review warning,
//      and no-brand/no-text clause are all present.
//   8. audio_card units carry no scored comprehension section.
//
// It prints per-series and total coverage, then exits non-zero on any violation.
// It writes NOTHING, touches no DB/R2/network, and generates no media.
//
// Run from the repo root:
//   node tools/content/validate-islamic-full-scripts.mjs

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ISLAMIC_DIR = path.join(
  REPO_ROOT,
  'docs',
  'content',
  'planets',
  '09-islamic',
);

// The 12 series that make up the 66 religious units, in plan order.
const SERIES = [
  'noor-qalbi',
  'preschool-adhkar-manners-prayer',
  'quran-treasures',
  'prophets-stories-kids',
  'prayer-step-by-step',
  'prophetic-guidance-kids',
  'daily-adhkar-kids',
  'quran-understanding-junior',
  'seerah-journey-junior',
  'worship-with-knowledge',
  'identity-ethics-junior',
  'seasons-of-goodness',
];

const EXPECTED_TOTAL = 66;

const VALID_BEATS = new Set([4, 6, 8, 10]);
const VALID_UNIT_TYPES = new Set([
  'audio_card',
  'illustrated_unit',
  'story_unit',
  'knowledge_unit',
]);

// Metadata fields every full script must declare.
const REQUIRED_METADATA_FIELDS = [
  'unit_id',
  'series_id',
  'unit_number',
  'unit_type',
  'title_ar',
  'description_ar',
  'source_duration_target',
  'duration_seconds',
  'age_min',
  'age_max',
  'track',
  'production_level',
  'source_reference',
  'status',
];

// Reviewer / license fields that MUST be present as keys yet empty.
const MUST_BE_EMPTY_FIELDS = [
  'sharia_reviewer_id',
  'sharia_review_version',
  'language_reviewer_id',
  'recitation_license_id',
];

// Forbidden schema fields / metadata states. Matched as a metadata key
// (`field:` / `| field |`) so prose that merely explains the prohibition
// ("this app issues no ruling") does not trip the check.
const FORBIDDEN_FIELD_KEYS = [
  'ruling',
  'madhhab',
  'fatwa_ref',
  'production_ready',
];

// Forbidden completion/approval claims. Word-boundary matched, case-insensitive.
const FORBIDDEN_CLAIM_PATTERNS = [
  /\bproduction[-_\s]?ready\b/i,
  /\bpublishable\b/i,
  /\bready\s+for\s+production\b/i,
  /\bready\s+to\s+publish\b/i,
  /\bsharia[-_\s]?approved\b/i,
  /\bfact[-_\s]?checked\b/i,
  /معتمد\s+شرعا/,
  /جاهز\s+للنشر/,
  /جاهز\s+للإنتاج/,
];

// A `status:` metadata value of any of these is forbidden.
const FORBIDDEN_STATUS_VALUES = new Set([
  'approved',
  'published',
  'production_ready',
  'producible',
  'live',
]);

// Required narrative sections (each script must contain a heading/label
// answering to at least one of the alternatives on a line).
const REQUIRED_SECTIONS = [
  { name: 'warning banner (draft-v2)', patterns: [/draft-v2/i] },
  {
    name: 'educational objective',
    patterns: [/الهدف/, /objective/i],
  },
  {
    name: 'source boundary / open review questions',
    patterns: [/حدود المصدر/, /أسئلة (?:المراجعة|مفتوحة)/, /source boundary/i, /open (?:review )?questions/i],
  },
  {
    name: 'full arabic script',
    patterns: [/النص الكامل/, /السيناريو/, /full script/i, /script/i],
  },
  {
    name: 'production beats',
    patterns: [/production_beats_seconds/],
  },
  {
    name: 'parent guide',
    patterns: [/دليل ولي الأمر/, /ملاحظة ولي الأمر/, /parent guide/i, /parent note/i],
  },
  {
    name: 'family activity',
    patterns: [/نشاط (?:عائلي|أسري|آمن)/, /family activity/i],
  },
  {
    name: 'visual restrictions',
    patterns: [/القيود البصرية/, /visual restrictions/i],
  },
  {
    name: 'audio restrictions',
    patterns: [/القيود الصوتية/, /audio restrictions/i],
  },
  {
    name: 'required future assets',
    patterns: [/الأصول (?:المطلوبة|المستقبلية)/, /future assets/i, /required assets/i],
  },
  {
    name: 'blocking review checklist',
    patterns: [/بوابة المراجعة/, /قائمة المراجعة/, /review checklist/i, /blocking review/i],
  },
];

// Clauses that must appear verbatim-ish in every script.
const REQUIRED_CLAUSES = [
  {
    name: 'language-review warning (meaning needs review per language)',
    patterns: [
      /review_sharia.{0,40}(?:لكل|كل)\s+لغة/s,
      /(?:لكل|كل)\s+لغة.{0,40}review_sharia/s,
      /per[-\s]language\s+review/i,
      /review per language/i,
    ],
  },
  {
    name: 'no-brand / no-text clause',
    patterns: [
      // Arabic prohibition string carried through from the briefs.
      /ممنوع[^\n]*(?:شعار|نص|حروف|علامة تجارية|caption|branding|UI|overlay)/,
      /no\s+text[^\n]*(?:logo|watermark|caption|branding|overlay|ui)/i,
    ],
  },
];

// ---------------------------------------------------------------------------

const violations = [];
const seriesCoverage = new Map(); // series -> { expected, found }

function fail(msg) {
  violations.push(msg);
}

function timeToSeconds(str) {
  // "1:30" -> 90 ; "0:55" -> 55 ; "45" -> 45
  const s = String(str).trim();
  if (/^\d+:\d{1,2}$/.test(s)) {
    const [m, sec] = s.split(':').map(Number);
    return m * 60 + sec;
  }
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

// Parse one brief into a list of { unitId, sourceReference } records.
// Handles both known brief shapes:
//   A) table:   | `unit_id` | `noor-qalbi-01` |   with a later
//               | `source_reference` | ... |  row.
//   B) inline:  `unit_id: <id>` · ... · **المصدر:** <source...>
function parseBrief(series, text) {
  const units = [];

  // Shape B — inline header lines.
  const inlineRe = /`unit_id:\s*([a-z0-9-]+)`([^\n]*)/g;
  let m;
  while ((m = inlineRe.exec(text)) !== null) {
    const unitId = m[1].trim();
    const rest = m[2];
    let sourceReference = null;
    const src = rest.match(/\*\*المصدر:\*\*\s*(.+?)\s*$/);
    if (src) sourceReference = src[1].trim();
    units.push({ unitId, sourceReference });
  }

  // Shape A — table rows.  Collect per-unit blocks split on the unit_id row.
  const tableIdRe = /\|\s*`unit_id`\s*\|\s*`([a-z0-9-]+)`\s*\|/g;
  const tableMatches = [];
  while ((m = tableIdRe.exec(text)) !== null) {
    tableMatches.push({ unitId: m[1].trim(), index: m.index });
  }
  for (let i = 0; i < tableMatches.length; i++) {
    const start = tableMatches[i].index;
    const end = i + 1 < tableMatches.length ? tableMatches[i + 1].index : text.length;
    const block = text.slice(start, end);
    let sourceReference = null;
    const src = block.match(/\|\s*`source_reference`\s*\|\s*([^|]+?)\s*\|/);
    if (src) sourceReference = src[1].trim();
    units.push({ unitId: tableMatches[i].unitId, sourceReference });
  }

  // Dedup by unitId (a brief should not declare the same id twice).
  const seen = new Set();
  const deduped = [];
  for (const u of units) {
    if (seen.has(u.unitId)) {
      fail(`[${series}] brief declares duplicate unit_id ${u.unitId}`);
      continue;
    }
    seen.add(u.unitId);
    deduped.push(u);
  }
  return deduped;
}

function extractMetadataValue(text, field) {
  // inline table:  | `field` | value |   or   | field | value |
  let re = new RegExp(`\\|\\s*\`?${field}\`?\\s*\\|\\s*([^|]*?)\\s*\\|`, 'i');
  let m = text.match(re);
  if (m) return m[1].replace(/`/g, '').trim();
  // key: value on its own (fenced or inline):  field: value
  re = new RegExp(`\\b${field}\\s*[:=]\\s*\`?([^\`\\n|]+)\`?`, 'i');
  m = text.match(re);
  if (m) return m[1].trim();
  return null;
}

function hasSection(text, section) {
  return section.patterns.some((p) => p.test(text));
}

function validateScript(series, filePath, fileName, text, expectedUnitIds, briefByUnit) {
  const rel = path.relative(REPO_ROOT, filePath);

  // unit_id must be present and known.
  const unitId = extractMetadataValue(text, 'unit_id');
  if (!unitId) {
    fail(`[${series}] ${rel}: missing unit_id metadata`);
    return null;
  }
  if (!expectedUnitIds.has(unitId)) {
    fail(`[${series}] ${rel}: unit_id "${unitId}" is not an expected unit in the brief`);
  }

  // Required metadata fields present.
  for (const field of REQUIRED_METADATA_FIELDS) {
    const val = extractMetadataValue(text, field);
    if (val === null || val === '') {
      fail(`[${series}] ${rel}: missing required metadata field "${field}"`);
    }
  }

  // draft-v2 warning banner.
  if (!/draft-v2/i.test(text)) {
    fail(`[${series}] ${rel}: missing draft-v2 warning`);
  }

  // status must be review_sharia and not a forbidden value.
  const status = extractMetadataValue(text, 'status');
  if (!status || !/review_sharia/i.test(status)) {
    fail(`[${series}] ${rel}: status must be review_sharia (found "${status ?? 'none'}")`);
  }
  if (status && FORBIDDEN_STATUS_VALUES.has(status.toLowerCase())) {
    fail(`[${series}] ${rel}: forbidden status value "${status}"`);
  }

  // Reviewer/license fields present but empty.
  for (const field of MUST_BE_EMPTY_FIELDS) {
    const val = extractMetadataValue(text, field);
    if (val === null) {
      fail(`[${series}] ${rel}: reviewer/license field "${field}" must be present (empty)`);
    } else if (val !== '' && !/^(<pending[^>]*>|pending|tbd|-|—|_+|n\/a)$/i.test(val)) {
      fail(`[${series}] ${rel}: reviewer/license field "${field}" must be empty, found "${val}"`);
    }
  }

  // Forbidden schema fields as metadata keys.
  for (const key of FORBIDDEN_FIELD_KEYS) {
    const tableKey = new RegExp(`\\|\\s*\`?${key}\`?\\s*\\|`, 'i');
    const inlineKey = new RegExp(`(^|\\n)\\s*\`?${key}\`?\\s*[:=]`, 'i');
    if (tableKey.test(text) || inlineKey.test(text)) {
      fail(`[${series}] ${rel}: forbidden religious schema field "${key}" present as metadata`);
    }
  }

  // Forbidden approval/publication claims.
  for (const pat of FORBIDDEN_CLAIM_PATTERNS) {
    const m = text.match(pat);
    if (m) {
      fail(`[${series}] ${rel}: forbidden approval/publication claim "${m[0]}"`);
    }
  }

  // unit_type valid.
  const unitTypeRaw = extractMetadataValue(text, 'unit_type');
  const unitTypes = (unitTypeRaw || '')
    .split(/[+/,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const t of unitTypes) {
    if (!VALID_UNIT_TYPES.has(t)) {
      fail(`[${series}] ${rel}: invalid unit_type "${t}"`);
    }
  }
  const isAudioCard = unitTypes.includes('audio_card');

  // Required sections.
  for (const section of REQUIRED_SECTIONS) {
    if (!hasSection(text, section)) {
      fail(`[${series}] ${rel}: missing required section: ${section.name}`);
    }
  }

  // Required clauses.
  for (const clause of REQUIRED_CLAUSES) {
    if (!clause.patterns.some((p) => p.test(text))) {
      fail(`[${series}] ${rel}: missing required clause: ${clause.name}`);
    }
  }

  // production_beats_seconds — JSON array of only 4/6/8/10 summing to duration.
  const beatsMatch = text.match(/production_beats_seconds\s*[:=]?\s*(\[[^\]]*\])/);
  let beats = null;
  if (!beatsMatch) {
    fail(`[${series}] ${rel}: missing production_beats_seconds JSON array`);
  } else {
    try {
      beats = JSON.parse(beatsMatch[1]);
    } catch {
      fail(`[${series}] ${rel}: production_beats_seconds is not valid JSON`);
    }
  }
  const durationVal = timeToSeconds(extractMetadataValue(text, 'duration_seconds') ?? '');
  if (Array.isArray(beats)) {
    for (const b of beats) {
      if (!VALID_BEATS.has(b)) {
        fail(`[${series}] ${rel}: illegal beat "${b}" (only 4/6/8/10 allowed)`);
      }
    }
    const sum = beats.reduce((a, b) => a + (Number(b) || 0), 0);
    if (durationVal === null) {
      fail(`[${series}] ${rel}: duration_seconds is missing/unparseable, cannot verify beat sum`);
    } else if (sum !== durationVal) {
      fail(`[${series}] ${rel}: production_beats_seconds sum (${sum}) != duration_seconds (${durationVal})`);
    }
  }

  // audio_card must not carry a scored comprehension section.
  if (isAudioCard) {
    if (/(?:أسئلة الفهم|سؤال الفهم|comprehension question|quiz|درجة|score|mastery)/i.test(text)) {
      // Only fail if it looks like a real scored block, not the prose that
      // explains "audio cards have NO comprehension question".
      const scoredBlock =
        /(?:أسئلة الفهم|سؤال الفهم|comprehension)\s*[:：]/i.test(text) ||
        /\b(?:score|mastery|quiz)\b/i.test(text);
      const explainsAbsence =
        /(?:لا|بلا|no|without)\s*(?:قياس|سؤال|أسئلة الفهم|comprehension|quiz|score)/i.test(text);
      if (scoredBlock && !explainsAbsence) {
        fail(`[${series}] ${rel}: audio_card must not contain a scored comprehension section`);
      }
    }
  }

  // Source reference from the brief must appear verbatim.
  const brief = briefByUnit.get(unitId);
  if (brief && brief.sourceReference) {
    if (!text.includes(brief.sourceReference)) {
      fail(
        `[${series}] ${rel}: source_reference from brief not found verbatim in script\n` +
          `        expected: ${brief.sourceReference}`,
      );
    }
  }

  return unitId;
}

async function main() {
  if (!existsSync(ISLAMIC_DIR)) {
    fail(`islamic content directory not found: ${ISLAMIC_DIR}`);
    report();
    process.exit(1);
  }

  const expectedUnitIds = new Set();
  const briefByUnit = new Map();
  let expectedTotal = 0;

  // ---- Phase 1: parse the 12 briefs, derive expected unit ids. ----
  for (const series of SERIES) {
    const briefPath = path.join(ISLAMIC_DIR, series, 'review-drafts.md');
    if (!existsSync(briefPath)) {
      fail(`[${series}] source brief missing: ${path.relative(REPO_ROOT, briefPath)}`);
      seriesCoverage.set(series, { expected: 0, found: 0 });
      continue;
    }
    const text = await readFile(briefPath, 'utf8');
    const units = parseBrief(series, text);
    seriesCoverage.set(series, { expected: units.length, found: 0 });
    expectedTotal += units.length;
    for (const u of units) {
      if (expectedUnitIds.has(u.unitId)) {
        fail(`duplicate unit_id across briefs: ${u.unitId}`);
      }
      expectedUnitIds.add(u.unitId);
      briefByUnit.set(u.unitId, u);
    }
  }

  if (expectedTotal !== EXPECTED_TOTAL) {
    fail(`expected ${EXPECTED_TOTAL} units across the 12 briefs, parsed ${expectedTotal}`);
  }

  // ---- Phase 2: discover ep-*.md full scripts, validate each. ----
  const foundUnitIds = new Map(); // unitId -> [files]
  for (const series of SERIES) {
    const seriesDir = path.join(ISLAMIC_DIR, series);
    if (!existsSync(seriesDir)) continue;
    let entries = [];
    try {
      entries = await readdir(seriesDir, { withFileTypes: true });
    } catch {
      continue;
    }
    const epFiles = entries
      .filter((e) => e.isFile() && /^ep-.*\.md$/i.test(e.name))
      .map((e) => e.name)
      .sort();

    const cov = seriesCoverage.get(series);
    for (const fileName of epFiles) {
      const filePath = path.join(seriesDir, fileName);
      const text = await readFile(filePath, 'utf8');
      const unitId = validateScript(
        series,
        filePath,
        fileName,
        text,
        expectedUnitIds,
        briefByUnit,
      );
      if (unitId) {
        if (!foundUnitIds.has(unitId)) foundUnitIds.set(unitId, []);
        foundUnitIds.get(unitId).push(path.relative(REPO_ROOT, filePath));
        if (expectedUnitIds.has(unitId) && cov) cov.found += 1;
      }
    }
  }

  // ---- Phase 3: coverage — every expected id exactly once, no extras. ----
  for (const id of expectedUnitIds) {
    const files = foundUnitIds.get(id);
    if (!files || files.length === 0) {
      fail(`missing full script for expected unit: ${id}`);
    } else if (files.length > 1) {
      fail(`unit ${id} has ${files.length} full scripts:\n        ${files.join('\n        ')}`);
    }
  }
  for (const [id, files] of foundUnitIds) {
    if (!expectedUnitIds.has(id)) {
      fail(`extra full script for unknown unit "${id}":\n        ${files.join('\n        ')}`);
    }
  }

  report(expectedTotal, foundUnitIds);
  process.exit(violations.length === 0 ? 0 : 1);
}

function report(expectedTotal = 0, foundUnitIds = new Map()) {
  console.log('=== Islamic full-script inventory validation ===\n');
  console.log('Per-series coverage (full scripts / expected units):');
  let totalExpected = 0;
  let totalFound = 0;
  for (const series of SERIES) {
    const cov = seriesCoverage.get(series) ?? { expected: 0, found: 0 };
    totalExpected += cov.expected;
    totalFound += cov.found;
    const flag = cov.found === cov.expected && cov.expected > 0 ? 'OK ' : '-- ';
    console.log(`  ${flag}${series.padEnd(34)} ${cov.found}/${cov.expected}`);
  }
  console.log('');
  console.log(`TOTAL coverage: ${totalFound}/${totalExpected} full scripts (expected total ${EXPECTED_TOTAL})`);
  console.log('');

  if (violations.length === 0) {
    console.log('RESULT: PASS — 0 violations.');
  } else {
    console.log(`RESULT: FAIL — ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.log(`  - ${v}`);
    }
  }
}

main().catch((err) => {
  console.error('validator crashed:', err);
  process.exit(2);
});
