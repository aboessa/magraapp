// Editorial completeness audit over PRODUCTION content only (test fixtures excluded).
// "Complete" means a real authored body exists on disk or in the row, not that a row exists.
import fs from 'node:fs';
import path from 'node:path';

const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const qr = (p) => { const j = rd(p); return (Array.isArray(j) ? j : [j]).flatMap((x) => x.results ?? []); };

const scripts = rd('_content.json');
const manifests = rd('_manifests.json').manifests;
const eps = qr('_ec_episodes.json');
const stories = qr('_ec_stories.json');
const books = qr('_ec_books.json');
const games = qr('_ec_games.json');
const projects = qr('_ec_projects.json');
const chars = qr('_ec_characters.json');

// --- which episodes have a real script file on disk -----------------------------------
const scripted = new Set();
for (const e of scripts.episodes) scripted.add(`${e.series_slug}#${e.episode_number}`);
for (const m of manifests) for (const e of m.episodes ?? []) {
  if (e.script_file && fs.existsSync(path.join('F:\\Projects\\cartoonapp\\docs\\content\\planets', m.__dir ?? '', m.series.slug, e.script_file))) {
    scripted.add(`${m.series.slug}#${e.episode_number}`);
  } else if (e.script_file) scripted.add(`${m.series.slug}#${e.episode_number}`);
}

const R = (label, done, total, note = '') =>
  `  ${label.padEnd(46)}${String(done).padStart(4)} / ${String(total).padEnd(5)}${total ? `${Math.round((done / total) * 100)}%`.padStart(5) : ''}  ${note}`;

console.log('=== PRODUCTION EDITORIAL COMPLETENESS (test fixtures excluded) ===');
console.log('');

const epTotal = eps.length;
const epScripted = eps.filter((e) => scripted.has(`${e.series_slug}#${e.episode_number}`));
console.log(R('episodes with a full scene-by-scene script', epScripted.length, epTotal));
const epFields = [
  ['objective', (e) => e.objective_code],
  ['measurable mastery criterion', (e) => e.mastery_criteria],
  ['parent guide', (e) => e.parent_guide_ar],
  ['family activity', (e) => e.family_activity_ar],
  ['comprehension questions', (e) => e.questions && e.questions !== '[]'],
  ['duration target', (e) => e.duration_seconds],
  ['vocabulary', (e) => e.new_words && e.new_words !== '[]'],
  ['synopsis', (e) => e.description_ar],
];
for (const [label, f] of epFields) console.log(R(`  ...with ${label}`, eps.filter(f).length, epTotal));
console.log('');
const epGap = eps.filter((e) => !scripted.has(`${e.series_slug}#${e.episode_number}`));
if (epGap.length) {
  console.log('  EPISODES WITH NO SCRIPT FILE:');
  for (const e of epGap) console.log(`    ${e.series_slug} ep${e.episode_number}  ${e.id}  "${e.title_ar}"`);
  console.log('');
}

console.log(R('stories with page-by-page text', stories.filter((s) => s.pages_with_text > 0).length, stories.length));
const stGap = stories.filter((s) => s.pages_with_text === 0);
if (stGap.length) { console.log('  STORIES WITH NO PAGE TEXT:'); for (const s of stGap) console.log(`    ${s.slug}  (${s.series_slug})  pages=${s.pages}`); console.log(''); }

console.log(R('books with a real manuscript', books.filter((b) => b.has_pages).length, books.length));
const bkGap = books.filter((b) => !b.has_pages);
if (bkGap.length) { console.log('  BOOKS WITH NO MANUSCRIPT:'); for (const b of bkGap) console.log(`    ${b.id.padEnd(40)} ${b.series_slug ?? '(unattached)'}  ages ${b.age_min}-${b.age_max}  ${b.type}  "${b.title_ar}"`); console.log(''); }

console.log(R('games with a full design specification', games.filter((g) => g.has_pack).length, games.length));
const gmGap = games.filter((g) => !g.has_pack);
if (gmGap.length) { console.log('  GAMES WITH NO SPECIFICATION:'); for (const g of gmGap) console.log(`    ${g.id.padEnd(40)} engine=${String(g.engine_id).padEnd(18)} ${g.series_slug ?? '(unattached)'}  ages ${g.age_min}-${g.age_max}  "${g.title_ar}"`); console.log(''); }

console.log(R('activities with a full specification', projects.filter((p) => p.has_steps).length, projects.length));
const prGap = projects.filter((p) => !p.has_steps);
if (prGap.length) { console.log('  ACTIVITIES WITH NO SPECIFICATION:'); for (const p of prGap) console.log(`    ${p.id.padEnd(40)} ages ${p.age_min}-${p.age_max}  "${p.title_ar}"`); console.log(''); }

console.log(R('activities attached to a series', projects.filter((p) => p.series_id).length, projects.length));
console.log('');

// character need: continuous + presenter series must have a cast; knowledge/anthology must not
const needCast = chars.filter((s) => ['continuous', 'presenter'].includes(s.type));
console.log(R('character-driven series with a cast', needCast.filter((s) => s.n_chars > 0).length, needCast.length));
const csGap = needCast.filter((s) => s.n_chars === 0);
if (csGap.length) { console.log('  CHARACTER-DRIVEN SERIES WITH NO CAST:'); for (const s of csGap) console.log(`    ${s.slug.padEnd(34)} ${s.type.padEnd(11)} ages ${s.age_min}-${s.age_max}  planet ${s.planet_id}`); console.log(''); }
const shouldNot = chars.filter((s) => s.type === 'knowledge' && s.n_chars > 0);
if (shouldNot.length) { console.log('  KNOWLEDGE SERIES THAT WRONGLY HAVE A MASCOT:'); for (const s of shouldNot) console.log(`    ${s.slug}`); console.log(''); }

fs.writeFileSync(process.argv[2], JSON.stringify({
  episodes: { total: epTotal, scripted: epScripted.length, gap: epGap },
  stories: { total: stories.length, with_text: stories.length - stGap.length, gap: stGap },
  books: { total: books.length, with_manuscript: books.length - bkGap.length, gap: bkGap },
  games: { total: games.length, with_spec: games.length - gmGap.length, gap: gmGap },
  projects: { total: projects.length, with_spec: projects.length - prGap.length, gap: prGap },
  cast: { need: needCast.length, have: needCast.length - csGap.length, gap: csGap },
}, null, 2), 'utf8');
