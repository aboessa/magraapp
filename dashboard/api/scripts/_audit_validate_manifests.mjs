// Independent validation of the authored manifests against the real D1 CHECK constraints.
// Does not trust the authoring agents' self-reports: re-derives every rule from the schema.
import fs from 'node:fs';
import path from 'node:path';

const PLANETS_DIR = 'F:\\Projects\\cartoonapp\\docs\\content\\planets';

const READING = ['pre_reader', 'emerging', 'independent'];
const INTERACTION = ['tap', 'guided', 'mixed', 'independent'];
const SUPERVISION = ['none', 'recommended', 'required'];
const DIFFICULTY = ['easy', 'medium', 'hard'];
const SERIES_TYPE = ['continuous', 'anthology', 'knowledge', 'presenter', 'standalone'];
const PRODUCTION = ['motion_story', 'limited_2d', 'full_2d', 'live', 'stylized_3d'];
const PRICE = ['free', 'family', 'family_plus'];
const TRACKS = ['preschool', 'kids', 'junior'];
const STORY_TYPE = ['picture_book', 'audio_story', 'interactive', 'comic'];
const LAYOUT = ['full_bleed', 'split', 'panels', 'text_focus'];
const CHAR_ROLE = ['hero', 'side', 'villain', 'narrator', 'presenter'];
const ENGINES = ['match_pairs', 'trace_color', 'sort_bins', 'memory_flip', 'count_quantity',
  'sequence_order', 'word_build', 'rhythm_tap', 'logic_pattern', 'block_code', 'sim_lab', 'timeline_map'];
const PLANET_IDS = ['abjad', 'arqam', 'oloom', 'qiyam', 'qisas', 'maharat', 'tarikh', 'alam', 'islamic'];
const CATEGORY_IDS = ['category-language', 'category-numbers', 'category-science', 'category-values',
  'category-stories', 'category-skills', 'category-history', 'category-world', 'category-faith'];
const BANDS = [[3, 5, 'preschool'], [6, 8, 'kids'], [9, 12, 'junior']];

const errors = [];
const warnings = [];
const manifests = [];

const bandOf = (min, max) => BANDS.find(([lo, hi]) => min >= lo && max <= hi) ?? null;

function chk(cond, where, msg) { if (!cond) errors.push(`${where}: ${msg}`); }
function warn(cond, where, msg) { if (!cond) warnings.push(`${where}: ${msg}`); }
const enumChk = (v, allowed, where, field) =>
  chk(allowed.includes(v), where, `${field}=${JSON.stringify(v)} is not one of ${allowed.join('|')}`);

for (const dir of fs.readdirSync(PLANETS_DIR).filter((d) => /^\d\d-/.test(d))) {
  const full = path.join(PLANETS_DIR, dir);
  for (const f of fs.readdirSync(full).filter((x) => /^_manifest-.*\.json$/.test(x))) {
    const p = path.join(full, f);
    let m;
    try { m = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); }
    catch (e) { errors.push(`${f}: does not parse — ${e.message}`); continue; }
    m.__file = f; m.__dir = dir; m.__path = p;
    manifests.push(m);

    const w = f;
    enumChk(m.planet_id, PLANET_IDS, w, 'planet_id');
    enumChk(m.category_id, CATEGORY_IDS, w, 'category_id');

    const s = m.series ?? {};
    const sw = `${w} series[${s.slug}]`;
    chk(!!s.slug && /^[a-z0-9-]+$/.test(s.slug), sw, 'slug must be lowercase kebab-case');
    chk(!!s.title_ar, sw, 'title_ar required');
    enumChk(s.type, SERIES_TYPE, sw, 'type');
    enumChk(s.reading_level, READING, sw, 'reading_level');
    enumChk(s.interaction_mode, INTERACTION, sw, 'interaction_mode');
    enumChk(s.supervision_level, SUPERVISION, sw, 'supervision_level');
    enumChk(s.difficulty, DIFFICULTY, sw, 'difficulty');
    enumChk(s.production_level, PRODUCTION, sw, 'production_level');
    enumChk(s.price_tier, PRICE, sw, 'price_tier');
    enumChk(s.track, TRACKS, sw, 'track');
    const sBand = bandOf(s.age_min, s.age_max);
    chk(!!sBand, sw, `ages ${s.age_min}-${s.age_max} straddle a track band`);
    if (sBand) chk(sBand[2] === s.track, sw, `ages ${s.age_min}-${s.age_max} imply ${sBand[2]} but track=${s.track}`);
    chk(s.type !== 'continuous' || (m.characters ?? []).length > 0, sw, 'continuous series must declare characters');
    warn(!(s.type === 'knowledge' && (m.characters ?? []).length > 0), sw,
      'knowledge series declares characters, contrary to the documented rule');

    const objCodes = new Set();
    for (const o of m.objectives ?? []) {
      const ow = `${w} objective[${o.code}]`;
      chk(/^[a-z]+\.[a-z_]+\.[a-z_]+$/.test(o.code ?? ''), ow, 'code must be domain.topic.specific in lowercase');
      chk(!!o.title_ar, ow, 'title_ar required');
      chk(!!(o.criteria_ar ?? o.measurable_criteria), ow, 'measurable criteria required');
      const ob = bandOf(o.age_min, o.age_max);
      chk(!!ob, ow, `ages ${o.age_min}-${o.age_max} straddle a band`);
      objCodes.add(o.code);
    }

    const items = [...(m.episodes ?? []), ...(m.stories ?? [])];
    chk(items.length > 0, w, 'no episodes and no stories');
    const seenNum = new Set();
    for (const e of m.episodes ?? []) {
      const ew = `${w} ep${e.episode_number}`;
      chk(Number.isInteger(e.episode_number) && e.episode_number > 0, ew, 'episode_number must be a positive integer');
      chk(!seenNum.has(e.episode_number), ew, 'duplicate episode_number');
      seenNum.add(e.episode_number);
      chk(!!e.title_ar, ew, 'title_ar required');
      chk(!!e.description_ar, ew, 'description_ar required');
      chk(Number.isInteger(e.duration_seconds) && e.duration_seconds > 0, ew, 'duration_seconds required');
      enumChk(e.reading_level, READING, ew, 'reading_level');
      enumChk(e.interaction_mode, INTERACTION, ew, 'interaction_mode');
      enumChk(e.supervision_level, SUPERVISION, ew, 'supervision_level');
      enumChk(e.difficulty, DIFFICULTY, ew, 'difficulty');
      chk(e.is_free === 0 || e.is_free === 1, ew, 'is_free must be 0 or 1');
      const eb = bandOf(e.age_min, e.age_max);
      chk(!!eb, ew, `ages ${e.age_min}-${e.age_max} straddle a band`);
      if (eb) chk(eb[2] === s.track, ew, `ages imply ${eb[2]} but series track is ${s.track}`);
      chk(objCodes.has(e.objective_code), ew, `objective_code ${e.objective_code} not declared in objectives`);
      chk(!!e.mastery_criteria, ew, 'mastery_criteria required');
      chk(!!e.parent_guide_ar, ew, 'parent_guide_ar required');
      chk(!!e.family_activity_ar, ew, 'family_activity_ar required');
      chk(Array.isArray(e.production_required) && e.production_required.length > 0, ew, 'production_required must be a non-empty list');
      if (e.script_file) {
        chk(fs.existsSync(path.join(full, s.slug, e.script_file)), ew, `script_file ${e.script_file} not found on disk`);
      } else warnings.push(`${ew}: no script_file`);
    }

    for (const st of m.stories ?? []) {
      const stw = `${w} story[${st.slug}]`;
      enumChk(st.type, STORY_TYPE, stw, 'type');
      enumChk(st.reading_level, READING, stw, 'reading_level');
      enumChk(st.interaction_mode, INTERACTION, stw, 'interaction_mode');
      enumChk(st.supervision_level, SUPERVISION, stw, 'supervision_level');
      const stb = bandOf(st.age_min, st.age_max);
      chk(!!stb, stw, `ages ${st.age_min}-${st.age_max} straddle a band`);
      chk(Array.isArray(st.pages) && st.pages.length >= 8, stw, 'needs at least 8 pages');
      const nums = (st.pages ?? []).map((x) => x.page_number);
      chk(new Set(nums).size === nums.length, stw, 'duplicate page_number');
      chk(nums.every((x, i) => x === i + 1), stw, 'page_number must run 1..n with no gaps');
      for (const pg of st.pages ?? []) {
        const pw = `${stw} p${pg.page_number}`;
        enumChk(pg.layout, LAYOUT, pw, 'layout');
        chk(!!pg.text_ar && pg.text_ar.trim().length > 0, pw, 'text_ar required');
        chk(!!pg.illustration_brief, pw, 'illustration_brief required');
      }
      chk(objCodes.has(st.objective_code), stw, `objective_code ${st.objective_code} not declared`);
    }

    for (const g of m.games ?? []) {
      const gw = `${w} game[${g.pack_id}]`;
      enumChk(g.engine, ENGINES, gw, 'engine');
      chk(!!g.title_ar, gw, 'title_ar required');
      chk(!!g.core_mechanic, gw, 'core_mechanic required');
      chk(Array.isArray(g.levels) && g.levels.length > 0, gw, 'levels required');
      chk(!!g.instructions_ar, gw, 'instructions_ar required');
      chk(!!g.success_rule && !!g.failure_rule, gw, 'success_rule and failure_rule required');
      chk(objCodes.has(g.objective_code), gw, `objective_code ${g.objective_code} not declared`);
      const gb = bandOf(g.age_min, g.age_max);
      chk(!!gb, gw, `ages ${g.age_min}-${g.age_max} straddle a band`);
    }

    for (const b of m.books ?? []) {
      const bw = `${w} book[${b.slug}]`;
      enumChk(b.type, STORY_TYPE, bw, 'type');
      enumChk(b.reading_level, READING, bw, 'reading_level');
      chk(Array.isArray(b.pages) && b.pages.length > 0, bw, 'pages required');
      const bb = bandOf(b.age_min, b.age_max);
      chk(!!bb, bw, `ages straddle a band`);
    }

    for (const pr of m.projects ?? []) {
      const pw = `${w} project[${pr.slug}]`;
      enumChk(pr.supervision_level, SUPERVISION, pw, 'supervision_level');
      chk(Array.isArray(pr.materials) && pr.materials.length > 0, pw, 'materials required');
      chk(Array.isArray(pr.steps) && pr.steps.length > 0, pw, 'steps required');
      const pb = bandOf(pr.age_min, pr.age_max);
      chk(!!pb, pw, 'ages straddle a band');
      if (pb && pb[2] === 'preschool') chk(!!pr.safety_notes, pw, 'a preschool project must carry safety_notes');
    }

    for (const c of m.characters ?? []) {
      const cw = `${w} character[${c.name_ar}]`;
      enumChk(c.role, CHAR_ROLE, cw, 'role');
      chk(!!c.description_ar, cw, 'description_ar required');
      chk(!!c.visual_brief, cw, 'visual_brief required');
    }
  }
}

// cross-manifest: objective code collisions with a DIFFERENT definition
const byCode = new Map();
for (const m of manifests) for (const o of m.objectives ?? []) {
  if (!byCode.has(o.code)) byCode.set(o.code, []);
  byCode.get(o.code).push({ file: m.__file, title: o.title_ar });
}
for (const [code, uses] of byCode) {
  if (uses.length > 1 && new Set(uses.map((u) => u.title)).size > 1) {
    errors.push(`objective code ${code} is defined differently in ${uses.map((u) => u.file).join(', ')}`);
  }
}
// slug collisions
const slugs = manifests.map((m) => m.series.slug);
for (const s of new Set(slugs)) if (slugs.filter((x) => x === s).length > 1) errors.push(`duplicate series slug ${s}`);

const totals = {
  manifests: manifests.length,
  series: manifests.length,
  episodes: manifests.reduce((a, m) => a + (m.episodes?.length ?? 0), 0),
  stories: manifests.reduce((a, m) => a + (m.stories?.length ?? 0), 0),
  story_pages: manifests.reduce((a, m) => a + (m.stories ?? []).reduce((b, s) => b + (s.pages?.length ?? 0), 0), 0),
  objectives: byCode.size,
  games: manifests.reduce((a, m) => a + (m.games?.length ?? 0), 0),
  books: manifests.reduce((a, m) => a + (m.books?.length ?? 0), 0),
  book_pages: manifests.reduce((a, m) => a + (m.books ?? []).reduce((b, x) => b + (x.pages?.length ?? 0), 0), 0),
  projects: manifests.reduce((a, m) => a + (m.projects?.length ?? 0), 0),
  characters: manifests.reduce((a, m) => a + (m.characters?.length ?? 0), 0),
  open_questions: manifests.reduce((a, m) => a + (m.open_questions?.length ?? 0), 0),
  fact_checks: manifests.reduce((a, m) => a + (m.fact_checks_required?.length ?? 0), 0),
};

console.log('=== authored slate totals ===');
for (const [k, v] of Object.entries(totals)) console.log(`  ${k.padEnd(16)}${v}`);
console.log('');
console.log(`=== ERRORS: ${errors.length} ===`);
for (const e of errors) console.log(`  ${e}`);
console.log('');
console.log(`=== WARNINGS: ${warnings.length} ===`);
for (const x of warnings.slice(0, 30)) console.log(`  ${x}`);
if (warnings.length > 30) console.log(`  ... and ${warnings.length - 30} more`);

fs.writeFileSync(process.argv[2], JSON.stringify({ totals, errors, warnings, manifests }, null, 2), 'utf8');
process.exit(errors.length ? 1 : 0);
