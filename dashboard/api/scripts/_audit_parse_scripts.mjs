// Audit helper: parse the declared metadata cards out of docs/content/planets/** episode & story scripts.
// Reads ONLY what the source declares. Nothing is inferred or invented.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'F:\\Projects\\cartoonapp\\docs\\content\\planets';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// `key` | value   rows inside the first markdown table of the file
function parseCard(text) {
  const card = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/`/g, '');
    const m = /^\|\s*([A-Za-z_][A-Za-z0-9_/ ]*?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    const key = m[1].replace(/\s*\/\s*/g, ' / ').trim();
    let val = m[2].replace(/\*\*/g, '').replace(/[🔴✅❌🔗]/g, '').trim();
    if (/^-+$/.test(val)) continue;
    if (key in card) continue; // first occurrence wins (the card is the first table)
    card[key] = val;
  }
  return card;
}

// Extract the body of a "## <heading>" section, line-based.
// (A regex with the /m flag is unusable here because `$` then matches every line end.)
function section(text, heading, stopAtH3 = false) {
  const lines = text.split(/\r?\n/);
  const isH2 = (l) => /^##\s/.test(l);
  const isH3 = (l) => /^###\s/.test(l);
  let i = lines.findIndex((l) => isH2(l) && l.replace(/^##\s*/, '').includes(heading));
  if (i < 0) return null;
  const body = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (isH2(lines[j]) || (stopAtH3 && isH3(lines[j]))) break;
    body.push(lines[j]);
  }
  return body.join('\n').trim();
}

const hasSection = (text, heading) => section(text, heading) !== null;

const files = walk(ROOT);
const episodes = [];
const stories = [];
const other = [];

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const base = path.basename(f);
  const text = fs.readFileSync(f, 'utf8');
  const card = parseCard(text);
  const folderSeries = path.basename(path.dirname(f));
  if (/^ep-/.test(base)) {
    const objSec = section(text, 'الهدف التعليمي');
    episodes.push({
      file: rel,
      series_id: card.series_id ?? folderSeries,
      series_id_declared: card.series_id ?? null,
      episode_number: card.episode_number ? Number(card.episode_number) : null,
      title_ar: card.title_ar ?? null,
      description_ar: card.description_ar ?? null,
      duration_seconds: card.duration_seconds ? Number(String(card.duration_seconds).match(/\d+/)?.[0]) : null,
      age: card['age_min / age_max'] ?? card['age_min'] ?? null,
      reading_level: card.reading_level ?? null,
      interaction_mode: card.interaction_mode ?? null,
      supervision_level: card.supervision_level ?? null,
      difficulty: card.difficulty ?? null,
      is_free: card.is_free ?? null,
      learning_objective_id: card.learning_objective_id ?? null,
      linked_game_id: card.linked_game_id ?? null,
      linked_book_id: card.linked_book_id ?? null,
      status: card.status ?? null,
      safety_notes: card.safety_notes ?? null,
      objective_text: objSec ? (objSec.split('\n').find((l) => l.trim()) ?? '').replace(/\*\*/g, '').trim() : null,
      objective_criteria: objSec
        ? (objSec.split('\n').find((l) => /المعيار/.test(l)) ?? '').replace(/\*\*/g, '').trim() || null
        : null,
      has_parent_guide: hasSection(text, 'دليل ولي الأمر'),
      has_family_activity: hasSection(text, 'النشاط العائلي'),
      has_questions: hasSection(text, 'أسئلة') || hasSection(text, 'الأسئلة'),
      has_required_assets: hasSection(text, 'الأصول المطلوبة'),
      has_narration: hasSection(text, 'نص السرد'),
      new_words: (() => {
        const m = /```json\s*(\[[\s\S]*?\])\s*```/.exec(text);
        try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
      })(),
    });
  } else if (/^story-/.test(base)) {
    // page table lives under the "## الصفحات" heading, before the "### تفصيل الصور" sub-table
    const pagesSec = section(text, 'الصفحات', true) ?? '';
    const seen = new Set();
    const pages = [];
    const pre = /^\|\s*(\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|(.+?)\|\s*$/gm;
    let pm;
    while ((pm = pre.exec(pagesSec))) {
      const n = Number(pm[1]);
      if (seen.has(n)) continue;
      seen.add(n);
      pages.push({
        page_number: Number(pm[1]),
        role: pm[2].replace(/[*🔴]/g, '').trim(),
        brightness: pm[3].replace(/[*]/g, '').trim(),
        motion: pm[4].replace(/[*`🔴]/g, '').trim(),
        text: pm[5].replace(/[*`]/g, '').trim(),
      });
    }
    stories.push({
      file: rel,
      series_id: card.series_id ?? null,
      story_number: card.story_number ? Number(card.story_number) : null,
      title_ar: card.title_ar ?? null,
      description_ar: card.description_ar ?? null,
      page_count: card.page_count ? Number(String(card.page_count).match(/\d+/)?.[0]) : null,
      duration_seconds: card.duration_seconds ? Number(String(card.duration_seconds).match(/\d+/)?.[0]) : null,
      age: card['age_min / age_max'] ?? null,
      reading_level: card.reading_level ?? null,
      story_type: card.story_type ?? null,
      default_mode: card.default_mode ?? null,
      is_free: card.is_free ?? null,
      status: card.status ?? null,
      linked_game_id: card.linked_game_id ?? null,
      linked_planets: card.linked_planets ?? null,
      parsed_pages: pages.length,
      pages,
    });
  } else {
    other.push(rel);
  }
}

const out = { episodes, stories, other_docs: other };
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2), 'utf8');

const incomplete = episodes.filter((e) => !e.series_id || !e.episode_number || !e.title_ar || !e.duration_seconds);
console.log(`episode scripts parsed: ${episodes.length}   incomplete cards: ${incomplete.length}`);
for (const e of incomplete) console.log(`  INCOMPLETE ${e.file}`);
console.log(`story scripts parsed:   ${stories.length}`);
for (const s of stories) {
  const bad = s.page_count !== s.parsed_pages ? `  <-- declared ${s.page_count}, parsed ${s.parsed_pages}` : '';
  console.log(`  ${s.file}  pages=${s.parsed_pages}${bad}`);
}
console.log('');
const bySeries = new Map();
for (const e of episodes) {
  if (!bySeries.has(e.series_id)) bySeries.set(e.series_id, []);
  bySeries.get(e.series_id).push(e.episode_number);
}
console.log('episode scripts per declared series_id:');
for (const [s, ns] of [...bySeries].sort()) console.log(`  ${String(s).padEnd(28)} ${ns.sort((a, b) => a - b).join(',')}`);
console.log('');
const objs = new Map();
for (const e of episodes) if (e.learning_objective_id) objs.set(e.learning_objective_id, (objs.get(e.learning_objective_id) || 0) + 1);
console.log(`distinct learning_objective_id codes declared in scripts: ${objs.size}`);
