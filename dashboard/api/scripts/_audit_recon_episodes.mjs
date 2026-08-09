// Audit helper: reconcile parsed scripts against D1 episodes; classify every gap.
import fs from 'node:fs';

const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))[0].results;
const ser = rd('_ser_map.json');
const eps = rd('_ep_all.json');
const sc = JSON.parse(fs.readFileSync('_scripts.json', 'utf8'));

const bySlug = new Map(ser.map((s) => [s.slug, s]));
const d1 = new Map(eps.map((e) => [`${e.series_slug}#${e.episode_number}`, e]));

const missing = [];
const present = [];
const mismatch = [];

for (const s of sc.episodes) {
  const key = `${s.series_id}#${s.episode_number}`;
  const hit = d1.get(key);
  if (!hit) { missing.push(s); continue; }
  present.push({ s, hit });
  const [amin, amax] = s.age.split('/').map((x) => Number(x.trim()));
  const d = [];
  if (hit.duration_seconds !== s.duration_seconds) d.push(`duration_seconds: D1=${hit.duration_seconds} script=${s.duration_seconds}`);
  if (hit.title_ar !== s.title_ar) d.push(`title_ar: D1=${JSON.stringify(hit.title_ar)} script=${JSON.stringify(s.title_ar)}`);
  if (hit.age_min !== amin || hit.age_max !== amax) d.push(`ages: D1=${hit.age_min}-${hit.age_max} script=${amin}-${amax}`);
  if (hit.difficulty !== s.difficulty) d.push(`difficulty: D1=${hit.difficulty} script=${s.difficulty}`);
  if (hit.reading_level !== s.reading_level) d.push(`reading_level: D1=${hit.reading_level} script=${s.reading_level}`);
  if (hit.interaction_mode !== s.interaction_mode) d.push(`interaction_mode: D1=${hit.interaction_mode} script=${s.interaction_mode}`);
  if (String(hit.is_free) !== String(s.is_free)) d.push(`is_free: D1=${hit.is_free} script=${s.is_free}`);
  if (d.length) mismatch.push({ key, id: hit.id, diffs: d });
}

// which existing D1 episodes are missing editorial fields the script supplies
const emptyish = (v) => v === null || v === undefined || v === '' || v === '[]' || v === '{}';
const fieldGaps = {};
for (const { s, hit } of present) {
  for (const [col, srcHas] of [
    ['safety_notes', !!s.safety_notes],
    ['parent_guide_ar', s.has_parent_guide],
    ['family_activity_ar', s.has_family_activity],
    ['questions', s.has_questions],
    ['new_words', !!(s.new_words && s.new_words.length)],
    ['learning_objective_id', !!s.learning_objective_id],
    ['mastery_criteria', !!s.objective_criteria],
    ['linked_game_id', !!s.linked_game_id],
  ]) {
    if (emptyish(hit[col]) && srcHas) fieldGaps[col] = (fieldGaps[col] || 0) + 1;
  }
}

console.log(`script episodes: ${sc.episodes.length}   present in D1: ${present.length}   MISSING FROM D1: ${missing.length}`);
console.log('');
console.log('=== MISSING EPISODES (full script on disk, no D1 row) ===');
const g = {};
for (const m of missing) (g[m.series_id] ||= []).push(m);
for (const k of Object.keys(g).sort()) {
  const sr = bySlug.get(k);
  console.log(`  ${k}   (${sr.id}, planet ${sr.planet_id}, series status ${sr.status})`);
  for (const m of g[k].sort((a, b) => a.episode_number - b.episode_number)) {
    console.log(`      ep ${String(m.episode_number).padStart(2)}  ${m.title_ar}`);
    console.log(`            ${m.duration_seconds}s | ages ${m.age} | ${m.reading_level}/${m.interaction_mode}/${m.difficulty} | free=${m.is_free} | obj ${m.learning_objective_id} | game ${m.linked_game_id} | declared status: ${m.status}`);
  }
}
console.log('');
console.log(`=== METADATA MISMATCHES on episodes that already exist (${mismatch.length}) ===`);
for (const m of mismatch) { console.log(`  ${m.key}  (${m.id})`); for (const x of m.diffs) console.log(`      ${x}`); }
console.log('');
console.log('=== EMPTY D1 COLUMNS on existing episodes where the script DOES supply content ===');
for (const [k, v] of Object.entries(fieldGaps).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${v} / ${present.length} episodes`);

fs.writeFileSync('_recon_eps.json', JSON.stringify({ missing, mismatch, fieldGaps, present_count: present.length }, null, 2), 'utf8');
