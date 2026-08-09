// Independent validation of the completion-pass manifests (books, games, activities).
// Re-derives every rule from the live D1 schema rather than trusting the authoring reports.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'F:\\Projects\\cartoonapp';
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const qr = (p) => { const j = rd(p); return (Array.isArray(j) ? j : [j]).flatMap((x) => x.results ?? []); };

const READING = ['pre_reader', 'emerging', 'independent'];
const INTERACTION = ['tap', 'guided', 'mixed', 'independent'];
const SUPERVISION = ['none', 'recommended', 'required'];
const DIFFICULTY = ['easy', 'medium', 'hard'];
const BOOK_TYPE = ['picture_book', 'audio_story', 'interactive', 'comic'];
const LAYOUT = ['full_bleed', 'split', 'panels', 'text_focus'];
const CHAR_ROLE = ['hero', 'side', 'villain', 'narrator', 'presenter'];
const ENGINES = ['match_pairs', 'trace_color', 'sort_bins', 'memory_flip', 'count_quantity',
  'sequence_order', 'word_build', 'rhythm_tap', 'logic_pattern', 'block_code', 'sim_lab', 'timeline_map'];
const BANDS = [[3, 5, 'preschool'], [6, 8, 'kids'], [9, 12, 'junior']];
const bandOf = (a, b) => BANDS.find(([lo, hi]) => a >= lo && b <= hi) ?? null;

const errors = [];
const chk = (c, w, m) => { if (!c) errors.push(`${w}: ${m}`); };
const en = (v, allowed, w, f) => chk(allowed.includes(v), w, `${f}=${JSON.stringify(v)} not in ${allowed.join('|')}`);

// live reference data
const dbBooks = new Set(qr('_ref_books.json').map((r) => r.id));
const dbGames = new Set(qr('_ref_games.json').map((r) => r.id));
const dbProjects = new Set(qr('_ref_projects.json').map((r) => r.id));
const dbObjectives = new Set(qr('_ref_objectives.json').map((r) => r.code));
const dbSeries = new Map(qr('_ref_series.json').map((r) => [r.slug, r]));
const dbEngines = new Set(qr('_ref_engines.json').map((r) => r.id));

const books = rd(path.join(ROOT, 'docs/content/planets/_manifest-books.json'));
const games = rd(path.join(ROOT, 'docs/content/planets/_manifest-games.json'));
const acts = rd(path.join(ROOT, 'docs/content/planets/_manifest-activities.json'));

// ---- books --------------------------------------------------------------------------
let bookPages = 0;
for (const b of books.books) {
  const w = `book[${b.id}]`;
  chk(dbBooks.has(b.id), w, 'id does not exist in the books table');
  en(b.reading_level, READING, w, 'reading_level');
  if (b.interaction_mode) en(b.interaction_mode, INTERACTION, w, 'interaction_mode');
  if (b.supervision_level) en(b.supervision_level, SUPERVISION, w, 'supervision_level');
  chk(!!bandOf(b.age_min, b.age_max), w, `ages ${b.age_min}-${b.age_max} straddle a track`);
  chk(Array.isArray(b.pages) && b.pages.length > 0, w, 'no pages');
  const nums = b.pages.map((p) => p.page);
  chk(nums.every((x, i) => x === i + 1), w, 'page numbers must run 1..n');
  for (const p of b.pages) {
    chk(!!p.text_ar && p.text_ar.trim().length > 5, `${w} p${p.page}`, 'text_ar empty or trivial');
    chk(!!p.illustration_brief, `${w} p${p.page}`, 'illustration_brief missing');
    bookPages += 1;
  }
  chk(!!b.cover_brief, w, 'cover_brief missing');
  chk(Array.isArray(b.production_required) && b.production_required.length > 0, w, 'production_required empty');
  chk(fs.existsSync(path.join(ROOT, b.source_file)), w, `source_file missing: ${b.source_file}`);
  if (b.objective_code) chk(dbObjectives.has(b.objective_code) || b.objective_code.match(/^[a-z]+\.[a-z_]+\.[a-z_]+$/), w, `objective_code ${b.objective_code} malformed`);
  if (b.type) en(b.type, BOOK_TYPE, w, 'type');
}

// ---- games --------------------------------------------------------------------------
for (const g of games.games) {
  const w = `game[${g.id}]`;
  chk(dbGames.has(g.id), w, 'id does not exist in the games table');
  en(g.engine, ENGINES, w, 'engine');
  chk(dbEngines.has(g.engine), w, `engine ${g.engine} is not registered in game_engines`);
  en(g.reading_level, READING, w, 'reading_level');
  en(g.interaction_mode, INTERACTION, w, 'interaction_mode');
  en(g.supervision_level, SUPERVISION, w, 'supervision_level');
  en(g.difficulty, DIFFICULTY, w, 'difficulty');
  chk(!!bandOf(g.age_min, g.age_max), w, `ages ${g.age_min}-${g.age_max} straddle a track`);
  chk(Array.isArray(g.levels) && g.levels.length >= 3, w, 'needs at least 3 levels');
  chk(!!g.instructions_ar, w, 'instructions_ar missing');
  chk(!!g.success_rule && !!g.failure_rule, w, 'success_rule/failure_rule missing');
  chk(!!g.core_mechanic && !!g.gameplay_loop, w, 'core_mechanic/gameplay_loop missing');
  chk(g.content_pack && Object.keys(g.content_pack).length > 0, w, 'content_pack empty');
  chk(g.implementation_status === 'design only', w, `implementation_status must be "design only", got ${JSON.stringify(g.implementation_status)}`);
  chk(!!g.engine_justification, w, 'engine_justification missing');
  chk(fs.existsSync(path.join(ROOT, g.source_file)), w, `source_file missing: ${g.source_file}`);
  chk(dbSeries.has(g.series_slug), w, `series ${g.series_slug} not found`);
  if (g.objective_code) chk(dbObjectives.has(g.objective_code), w, `objective_code ${g.objective_code} not in learning_objectives`);
}

// ---- activities + characters + story repair -----------------------------------------
for (const a of acts.activities) {
  const w = `activity[${a.id}]`;
  chk(dbProjects.has(a.id), w, 'id does not exist in the projects table');
  en(a.supervision_level, SUPERVISION, w, 'supervision_level');
  chk(!!bandOf(a.age_min, a.age_max), w, `ages ${a.age_min}-${a.age_max} straddle a track`);
  chk(Array.isArray(a.materials) && a.materials.length > 0, w, 'materials empty');
  chk(Array.isArray(a.steps) && a.steps.length > 0, w, 'steps empty');
  chk(!!a.safety_notes, w, 'safety_notes missing');
  chk(!!a.expected_result && !!a.explanation_ar && !!a.parent_involvement, w, 'outcome/explanation/parent involvement missing');
  chk(Number.isInteger(a.estimated_minutes) && a.estimated_minutes > 0, w, 'estimated_minutes must be a positive integer');
  chk(dbSeries.has(a.series_slug), w, `series ${a.series_slug} not found`);
  if (a.objective_code) chk(dbObjectives.has(a.objective_code), w, `objective_code ${a.objective_code} not in learning_objectives`);
  chk(fs.existsSync(path.join(ROOT, a.source_file)), w, `source_file missing: ${a.source_file}`);
}
for (const c of acts.characters) {
  const w = `character[${c.name_ar}]`;
  en(c.role, CHAR_ROLE, w, 'role');
  chk(dbSeries.has(c.series_slug), w, `series ${c.series_slug} not found`);
  chk(!!c.description_ar && !!c.visual_brief && !!c.speech_style, w, 'description/visual_brief/speech_style missing');
  chk(Array.isArray(c.expression_requirements) && c.expression_requirements.length > 0, w, 'expression_requirements empty');
  chk(!!c.voice_direction, w, 'voice_direction missing');
  chk(/none/i.test(String(c.artwork_status)), w, 'artwork_status must state that no artwork exists');
}
const sr = acts.story_repair;
chk(Array.isArray(sr?.pages) && sr.pages.length === 8, 'story_repair', `expected 8 pages, got ${sr?.pages?.length}`);
for (const p of sr?.pages ?? []) {
  const w = `story_repair p${p.page_number}`;
  en(p.layout, LAYOUT, w, 'layout');
  chk(!!p.text_ar && p.text_ar.trim().length > 5, w, 'text_ar empty');
}

const totals = {
  books: books.books.length, book_pages: bookPages,
  games: games.games.length, engine_remaps: (games.engine_remap ?? []).length,
  activities: acts.activities.length, characters: acts.characters.length,
  story_repair_pages: sr?.pages?.length ?? 0,
  open_questions: (books.open_questions?.length ?? 0) + (games.open_questions?.length ?? 0) + (acts.open_questions?.length ?? 0),
  fact_checks: (books.fact_checks_required?.length ?? 0) + (acts.fact_checks_required?.length ?? 0),
};
console.log('=== completion-pass manifest totals ===');
for (const [k, v] of Object.entries(totals)) console.log(`  ${k.padEnd(20)}${v}`);
console.log('');
console.log(`=== ERRORS: ${errors.length} ===`);
for (const e of errors) console.log(`  ${e}`);
fs.writeFileSync(process.argv[2], JSON.stringify({ totals, errors }, null, 2), 'utf8');
process.exit(errors.length ? 1 : 0);
