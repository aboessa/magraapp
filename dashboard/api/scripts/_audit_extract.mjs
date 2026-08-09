// Audit helper: full extraction of episode + story script content from docs/content/planets/**.
// Only reads what the source declares. Nothing is inferred or invented.
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

function lines(text) { return text.split(/\r?\n/); }

// Body of a "## <heading>" section. Line-based on purpose: a /m regex makes `$` match every line end.
function section(text, heading, { stopAtH3 = false, exact = false } = {}) {
  const L = lines(text);
  const isH2 = (l) => /^##\s/.test(l);
  const isH3 = (l) => /^###\s/.test(l);
  const clean = (l) => l.replace(/^##\s*/, '').replace(/[*`🔴✅❌🔗]/g, '').trim();
  const i = L.findIndex((l) => isH2(l) && (exact ? clean(l) === heading : clean(l).includes(heading)));
  if (i < 0) return null;
  const body = [];
  for (let j = i + 1; j < L.length; j++) {
    if (isH2(L[j]) || (stopAtH3 && isH3(L[j]))) break;
    body.push(L[j]);
  }
  return body.join('\n').trim();
}

const firstSection = (text, headings, opts) => {
  for (const h of headings) { const s = section(text, h, opts); if (s) return s; }
  return null;
};

// blockquote -> plain paragraphs
function unquote(s) {
  if (!s) return null;
  const out = s.split('\n')
    .filter((l) => l.trim().startsWith('>'))
    .map((l) => l.replace(/^\s*>\s?/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return out || null;
}

const fencedJson = (s) => {
  if (!s) return null;
  const m = /```(?:json)?\s*([\[{][\s\S]*?[\]}])\s*```/.exec(s);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
};

const fencedText = (s) => {
  if (!s) return null;
  const m = /```[a-z]*\s*([\s\S]*?)```/.exec(s);
  return m ? m[1].trim() || null : null;
};

function parseCard(text) {
  const card = {};
  for (const raw of lines(text)) {
    const line = raw.replace(/`/g, '');
    const m = /^\|\s*([A-Za-z_][A-Za-z0-9_/ ]*?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    const key = m[1].replace(/\s*\/\s*/g, ' / ').trim();
    const val = m[2].replace(/\*\*/g, '').replace(/[🔴✅❌🔗]/g, '').trim();
    if (/^-+$/.test(val) || key in card) continue;
    card[key] = val;
  }
  return card;
}

// "## الأصول المطلوبة" table -> [{ id, type, description }]
function requiredAssets(text) {
  const s = section(text, 'الأصول المطلوبة', { stopAtH3: true });
  if (!s) return [];
  const rows = [];
  for (const raw of lines(s)) {
    const m = /^\|\s*`([^`]+)`\s*\|([^|]*)\|(.*?)\|\s*$/.exec(raw);
    if (!m) continue;
    rows.push({
      id: m[1].trim(),
      type: m[2].replace(/[*`]/g, '').trim(),
      description: m[3].replace(/[*`🔴✅❌]/g, '').trim(),
    });
  }
  return rows;
}

const files = walk(ROOT);
const episodes = [];
const stories = [];
const otherDocs = [];

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const base = path.basename(f);
  const text = fs.readFileSync(f, 'utf8');
  const card = parseCard(text);
  const folderSeries = path.basename(path.dirname(f));

  if (/^ep-/.test(base)) {
    const objSec = firstSection(text, ['الهدف التعليمي', 'الهدف', 'المفهوم الواحد', 'المفهوم العلمي', 'المفهوم', 'المهارة', 'القيمة']);
    const objLines = objSec ? objSec.split('\n').map((l) => l.replace(/[*`🔴]/g, '').trim()).filter(Boolean) : [];
    const ages = (card['age_min / age_max'] ?? '').split('/').map((x) => Number(x.trim()));
    episodes.push({
      file: rel,
      series_slug: card.series_id ?? folderSeries,
      episode_number: Number(card.episode_number),
      title_ar: card.title_ar ?? null,
      description_ar: card.description_ar ?? null,
      duration_seconds: Number(String(card.duration_seconds ?? '').match(/\d+/)?.[0]) || null,
      age_min: Number.isFinite(ages[0]) ? ages[0] : null,
      age_max: Number.isFinite(ages[1]) ? ages[1] : null,
      reading_level: card.reading_level ?? null,
      interaction_mode: card.interaction_mode ?? null,
      supervision_level: card.supervision_level ?? null,
      difficulty: card.difficulty ?? null,
      is_free: card.is_free === '1' ? 1 : 0,
      learning_objective_code: card.learning_objective_id ?? null,
      linked_game_id_raw: card.linked_game_id ?? null,
      status_declared: card.status ?? null,
      safety_notes: card.safety_notes ?? null,
      objective_title: objLines.find((l) => /^هدف واحد/.test(l))?.replace(/^هدف واحد:\s*/, '') ?? objLines[0] ?? null,
      objective_criteria: objLines.find((l) => /^المعيار/.test(l))?.replace(/^المعيار:\s*/, '') ?? null,
      mastery_criteria: fencedText(section(text, 'معيار الإتقان')),
      questions: fencedJson(section(text, 'أسئلة الفهم')),
      parent_guide_ar: unquote(section(text, 'دليل ولي الأمر')),
      family_activity_ar: unquote(firstSection(text, ['النشاط العائلي'])),
      new_words: fencedJson(firstSection(text, ['المفردات الجديدة', 'المفردات', 'الكلمات الجديدة', 'المصطلحات المُقدَّمة'])),
      prerequisites: (() => { try { return card.prerequisites ? JSON.parse(card.prerequisites) : null; } catch { return null; } })(),
      required_assets: requiredAssets(text),
    });
  } else if (/^story-/.test(base)) {
    const pagesSec = section(text, 'الصفحات', { stopAtH3: true }) ?? '';
    const seen = new Set();
    const pages = [];
    const re = /^\|\s*(\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|(.+?)\|\s*$/gm;
    let pm;
    while ((pm = re.exec(pagesSec))) {
      const n = Number(pm[1]);
      if (seen.has(n)) continue;
      seen.add(n);
      pages.push({
        page_number: n,
        role: pm[2].replace(/[*`🔴]/g, '').trim(),
        brightness: pm[3].replace(/[*`]/g, '').trim(),
        motion: pm[4].replace(/[*`🔴]/g, '').trim(),
        text: pm[5].replace(/[*`]/g, '').trim(),
      });
    }
    const ages = (card['age_min / age_max'] ?? '').split('/').map((x) => Number(x.trim()));
    stories.push({
      file: rel,
      series_slug: card.series_id ?? folderSeries,
      story_number: Number(card.story_number) || null,
      title_ar: card.title_ar ?? null,
      description_ar: card.description_ar ?? null,
      page_count_declared: Number(String(card.page_count ?? '').match(/\d+/)?.[0]) || null,
      pages_parsed: pages.length,
      duration_seconds: Number(String(card.duration_seconds ?? '').match(/\d+/)?.[0]) || null,
      age_min: Number.isFinite(ages[0]) ? ages[0] : null,
      age_max: Number.isFinite(ages[1]) ? ages[1] : null,
      reading_level: card.reading_level ?? null,
      story_type: card.story_type ?? null,
      default_mode: card.default_mode ?? null,
      is_free: card.is_free?.startsWith('1') ? 1 : 0,
      status_declared: card.status ?? null,
      required_assets: requiredAssets(text),
      pages,
    });
  } else {
    otherDocs.push(rel);
  }
}

fs.writeFileSync(process.argv[2], JSON.stringify({ episodes, stories, other_docs: otherDocs }, null, 2), 'utf8');

const cnt = (arr, k) => arr.filter((e) => e[k] === null || e[k] === undefined || (Array.isArray(e[k]) && !e[k].length)).length;
console.log(`episodes: ${episodes.length}   stories: ${stories.length}   other docs: ${otherDocs.length}`);
console.log('missing values per episode field:');
for (const k of ['title_ar', 'description_ar', 'duration_seconds', 'age_min', 'reading_level', 'interaction_mode',
  'supervision_level', 'difficulty', 'learning_objective_code', 'objective_title', 'mastery_criteria',
  'questions', 'parent_guide_ar', 'family_activity_ar', 'new_words', 'safety_notes', 'required_assets']) {
  console.log(`  ${k.padEnd(26)} ${cnt(episodes, k)} / ${episodes.length}`);
}
const codes = new Map();
for (const e of episodes) if (e.learning_objective_code) {
  const cur = codes.get(e.learning_objective_code) ?? { title: null, criteria: null, amin: 99, amax: 0, n: 0 };
  cur.n++;
  cur.title ??= e.objective_title;
  cur.criteria ??= e.objective_criteria ?? e.mastery_criteria;
  cur.amin = Math.min(cur.amin, e.age_min ?? 99);
  cur.amax = Math.max(cur.amax, e.age_max ?? 0);
  codes.set(e.learning_objective_code, cur);
}
const withTitle = [...codes.values()].filter((c) => c.title).length;
console.log('');
console.log(`distinct objective codes: ${codes.size}   with a declared title: ${withTitle}   without: ${codes.size - withTitle}`);
const assetIds = new Set();
for (const e of episodes) for (const a of e.required_assets) assetIds.add(a.id);
console.log(`distinct required-asset identifiers declared across scripts: ${assetIds.size}`);
