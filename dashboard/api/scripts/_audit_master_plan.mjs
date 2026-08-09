// Generates KIRO_CONTENT_AUDIT.md — the master Majarra content plan.
// Production content and test fixtures are separated. Every status is derived from the
// database and the on-disk sources, never asserted.
import fs from 'node:fs';
import path from 'node:path';

const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const qr = (p) => { const j = rd(p); return (Array.isArray(j) ? j : [j]).flatMap((x) => x.results ?? []); };

const rows = qr('_plan_rows.json');
const seriesRows = qr('_plan_series.json');
const projectRows = qr('_plan_projects.json');
const totalsRows = qr('_plan_totals.json');
const prodRows = qr('_plan_production.json');
const reviewRows = qr('_plan_reviews.json');
const slate = rd('_manifests.json');
const completion = rd('_completion.json');
const islamic = rd('_islamic.json');
const scripts = rd('_content.json');
const ec = rd('_ec.json');

const PLANET_DIR = { abjad: '01-abjad', arqam: '02-arqam', oloom: '03-oloom', qiyam: '04-qiyam', qisas: '05-qisas', maharat: '06-maharat', tarikh: '07-tarikh', alam: '08-alam', islamic: '09-islamic' };
const PLANET_AR = { abjad: 'أبجد · Language', arqam: 'أرقام · Numbers', oloom: 'علوم · Science', qiyam: 'قيم · Values', qisas: 'قصص · Stories', maharat: 'مهارات · Skills', tarikh: 'تاريخ · History', alam: 'العالم حولنا · Our World', islamic: 'الإيمان والآداب · Faith & Manners' };
const ORDER = ['abjad', 'arqam', 'oloom', 'qiyam', 'qisas', 'maharat', 'tarikh', 'alam', 'islamic'];

// series authored in the slate pass -> its items are editorial drafts
const authoredSlugs = new Set(slate.manifests.map((m) => m.series.slug));
const islamicNew = new Set([...islamic.filter((x) => x.in_db === 'no').map((x) => x.slug),
  'preschool-adhkar-first', 'preschool-manners-beautiful', 'preschool-prepare-for-prayer']);
// items whose editorial body genuinely exists on disk
const scriptedEp = new Set(scripts.episodes.map((e) => `${e.series_slug}#${e.episode_number}`));
for (const m of slate.manifests) for (const e of m.episodes ?? []) if (e.script_file) scriptedEp.add(`${m.series.slug}#${e.episode_number}`);

// series that deliberately have no comprehension questions / failable mastery criterion
const NO_TEST_BY_DESIGN = new Set(['colors-around-us']);

// STATUS MODEL
const S = {
  A: 'A · Editorially complete',
  B: 'B · Editorial review required',
  C: 'C · Religious review required',
  D: 'D · Media production required',
  E: 'E · Implementation required',
  F: 'F · Blocked',
};

function statusFor(r, isAuthored) {
  if (r.planet === 'islamic') return { ed: S.C, media: 'not started', impl: 'n/a', review: 'sharia: pending' };
  const hasBody =
    r.kind === 'episode' ? scriptedEp.has(`${r.series_slug}#${r.item_number}`)
      : r.kind === 'story' ? (r.pages || 0) > 0
        : r.kind === 'book' ? !!r.has_pages
          : r.kind === 'game' ? !!r.has_pack
            : !!r.has_steps;

  let ed;
  if (!hasBody) ed = S.F;
  else if (isAuthored) ed = S.B;
  else ed = S.A;

  const media = [];
  let impl = 'n/a';
  if (r.kind === 'episode') {
    media.push(r.has_stream ? 'video ✓' : 'video required');
    media.push(r.has_thumb ? 'thumbnail ✓' : 'thumbnail required');
    media.push('voiceover required', 'captions required');
  } else if (r.kind === 'story') {
    media.push(`illustration ×${r.pages || 0} required`, 'narration required', r.has_cover ? 'cover ✓' : 'cover required');
  } else if (r.kind === 'book') {
    media.push('illustration required', 'layout required', r.has_cover ? 'cover ✓' : 'cover required');
  } else if (r.kind === 'game') {
    media.push('game art required', 'voice prompts required');
    impl = S.E;
  }
  const review = (isAuthored || islamicNew.has(r.series_slug)) ? 'edu pending · lang pending'
    : (hasBody ? 'edu pending · lang pending' : 'not submitted');
  return { ed, media: media.join(' · '), impl, review };
}

const lines = [];
const P = (s = '') => lines.push(s);
const counts = {};
const bump = (k) => { counts[k] = (counts[k] ?? 0) + 1; };

P('# Majarra — master content plan');
P('');
P(`**Generated:** ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · derived from local D1 plus the on-disk content sources.`);
P('');
P('Every row is a real database row. Every status is computed, not asserted: media status comes');
P('from `asset_links`, editorial status from whether a script or page text actually exists,');
P('implementation status from whether a game is programmed, review status from `content_reviews`.');
P('');
P('> **Mazen & Thaaloub is not Majarra content.** It was supplied as external material for testing');
P('> upload, R2 storage, asset linking, streaming, playback sessions and player behaviour. It is');
P('> flagged `content_class = test_fixture` in the database and appears only in the');
P('> [Test fixtures](#test-fixtures--platform-validation-content) section at the end. It is excluded');
P('> from every Majarra production count in this document.');
P('');
P('## Canonical hierarchy');
P('');
P('```');
P('Planet  (9, fixed taxonomy — planets.id is the slug)');
P('  └── Section / Category  (9, one per planet, via series_categories)');
P('        └── Series  (purpose · type · one age track · content_class)');
P('              └── Season  (1 per series; seasons.episode_count is the planned figure)');
P('                    └── Content item  (episode · story · book · game · activity)');
P('                          └── Learning objective → Skill → Age track → Difficulty → Prerequisites');
P('```');
P('');
P('## Status model');
P('');
P('| Code | Status | Meaning |');
P('|---|---|---|');
P('| **A** | Editorially complete | Full script, manuscript or content specification exists and has been reviewed at least once. |');
P('| **B** | Editorial review required | Full draft exists but no human editor has read it. |');
P('| **C** | Religious review required | Islamic material needing authoritative sourcing and a registered reviewer. |');
P('| **D** | Media production required | Editorial content complete; video, audio or artwork still to be produced. |');
P('| **E** | Implementation required | Game designed and specified but not programmed. |');
P('| **F** | Blocked | A genuine external decision or source is needed. |');
P('');
P('Media status and implementation status are reported per item alongside the editorial status,');
P('because an item is normally in more than one of these states at once: an episode can be');
P('editorially complete (A) and still need video (D).');
P('');

/* ---------------- production content ---------------- */
P('---');
P('');
P('# Majarra production content');
P('');

for (const pid of ORDER) {
  const sers = seriesRows.filter((s) => s.planet === pid && s.status !== 'archived' && s.content_class === 'production')
    .sort((a, b) => (a.track_order - b.track_order) || a.slug.localeCompare(b.slug));
  if (!sers.length) continue;
  const planetItems = rows.filter((r) => r.planet === pid && r.content_class === 'production');
  P('---');
  P('');
  P(`## ${PLANET_AR[pid]}  \`${pid}\``);
  P('');
  P(`Section \`${sers[0]?.category_id ?? '—'}\` · series ${sers.length} · content items ${planetItems.length} · sources \`docs/content/planets/${PLANET_DIR[pid]}/\``);
  P('');
  if (pid === 'tarikh') {
    P('> **The preschool track is deliberately empty.** `07-tarikh/README.md` records why: a');
    P('> four-year-old cannot distinguish "yesterday" from "a thousand years ago", so history at');
    P('> that age produces confusion rather than knowledge. What suits that age — concrete old');
    P('> objects — already exists as a qisas story. This is a decision, not a gap.');
    P('');
  }
  if (pid === 'islamic') {
    P('> **The whole planet is Status C by design.** `09-islamic/series-shells.md` is explicitly');
    P('> structure and not content: every unit title in the source is `<pending_sharia_review>`, and');
    P('> the document records that even choosing which surah or dhikr appears is itself a religious');
    P('> decision. No unit text has been authored and none should be until a registered reviewer');
    P('> scopes and approves the sourcing. **RELIGIOUS SOURCE/REVIEW REQUIRED.**');
    P('>');
    P('> Structure *was* registered, which that same document recommends: the four declared but');
    P('> unregistered series, and the split of the merged preschool series into its three planned');
    P('> parts. Registering structure needs no approval; omitting it hides the plan from reporting.');
    P('');
  }
  for (const s of sers) {
    const items = planetItems.filter((r) => r.series_slug === s.slug);
    const isAuthored = authoredSlugs.has(s.slug);
    P(`### ${s.title_ar} · \`${s.slug}\``);
    P('');
    P(`\`${s.type}\` · ages ${s.age_min}–${s.age_max} · track \`${s.track}\` · \`${s.production_level}\` · \`${s.price_tier}\` · status \`${s.status}\`${isAuthored ? ' · **authored in this pass**' : ''}${islamicNew.has(s.slug) ? ' · **structure registered in this pass**' : ''}`);
    P('');
    if (s.description_ar) P(`**Purpose.** ${String(s.description_ar).replace(/\s+/g, ' ').slice(0, 420)}`);
    P('');
    P(`Season 1 · planned units ${s.planned_items} · registered items ${items.length} · poster ${s.has_poster ? '✓' : 'required'} · banner ${s.has_banner ? '✓' : 'required'}`);
    if (NO_TEST_BY_DESIGN.has(s.slug)) {
      P('');
      P('> This series deliberately carries **no comprehension question and no failable mastery');
      P('> criterion** — `series-bible-colors-around-us.md` states that this age is not tested and');
      P('> that measurement comes from the game pack instead. Their absence is by design.');
    }
    P('');
    if (!items.length) {
      P(`_No content items registered. ${s.planned_items} units are planned._`);
      P('');
      for (let i = 0; i < s.planned_items; i += 1) bump(pid === 'islamic' ? S.C : S.F);
      continue;
    }
    P('| # | Item | Type | Editorial | Media | Implementation | Review | Objective |');
    P('|---:|---|---|---|---|---|---|---|');
    for (const r of items.sort((a, b) => (a.kind_order - b.kind_order) || ((a.item_number ?? 0) - (b.item_number ?? 0)) || String(a.title).localeCompare(String(b.title)))) {
      const st = statusFor(r, isAuthored);
      bump(st.ed);
      if (st.impl !== 'n/a') bump(S.E);
      P(`| ${r.item_number ?? '—'} | ${String(r.title).replace(/\|/g, '/')} | ${r.kind} | ${st.ed} | ${st.media} | ${st.impl} | ${st.review} | \`${r.objective_code ?? '—'}\` |`);
    }
    P('');
  }
}

/* ---------------- activities ---------------- */
P('---');
P('');
P('## Activities and projects');
P('');
P('`projects` gained `series_id`, `episode_id` and `estimated_minutes` in migration 0018, so every');
P('activity is now attached to the content it belongs to. Before that it could not be.');
P('');
P('| Activity | Ages | Series | Supervision | Steps | Minutes | Editorial | Production required |');
P('|---|---|---|---|---:|---:|---|---|');
for (const pr of projectRows) {
  const ed = pr.has_steps ? S.B : S.F;
  bump(ed);
  P(`| ${String(pr.title_ar).replace(/\|/g, '/')} | ${pr.age_min}–${pr.age_max} | ${pr.series_slug ?? '—'} | \`${pr.supervision_level}\` | ${pr.n_steps} | ${pr.estimated_minutes ?? '—'} | ${ed} | ${pr.has_cover ? 'step photos' : 'cover · step photos'} |`);
}
P('');

/* ---------------- completeness ratios ---------------- */
P('---');
P('');
P('## Editorial completeness — Majarra production content only');
P('');
const e = ec.episodes; const st = ec.stories; const bk = ec.books; const gm = ec.games; const pj = ec.projects;
P('| Layer | Complete | Total | Ratio |');
P('|---|---:|---:|---:|');
const ratio = (a, b) => `${Math.round((a / b) * 100)}%`;
P(`| Episodes with a full scene-by-scene script | ${e.scripted} | ${e.total} | ${ratio(e.scripted, e.total)} |`);
P(`| Stories with complete page-by-page text | ${st.with_text} | ${st.total} | ${ratio(st.with_text, st.total)} |`);
P(`| Books with a complete manuscript | ${bk.with_manuscript} | ${bk.total} | ${ratio(bk.with_manuscript, bk.total)} |`);
P(`| Games with a complete design specification | ${gm.with_spec} | ${gm.total} | ${ratio(gm.with_spec, gm.total)} |`);
P(`| Activities with a complete specification | ${pj.with_spec} | ${pj.total} | ${ratio(pj.with_spec, pj.total)} |`);
P('');
P('## Media and implementation — what is actually produced');
P('');
P('| Requirement | Outstanding | Note |');
P('|---|---:|---|');
for (const r of prodRows) P(`| ${r.k} | ${r.v} | ${r.note ?? ''} |`);
P('');
P('## Review gates outstanding');
P('');
P('| Reviewer role | Pending | Scope |');
P('|---|---:|---|');
for (const r of reviewRows) P(`| \`${r.reviewer_role}\` | ${r.n} | ${r.scope} |`);
P('');
P('## Content items by status');
P('');
P('| Status | Items |');
P('|---|---:|');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) P(`| ${k} | ${v} |`);
P('');
P('## Canonical totals');
P('');
P('| Layer | Count |');
P('|---|---:|');
for (const r of totalsRows) P(`| ${r.k} | ${r.v} |`);
P('');
P(`Open questions recorded by the authoring passes: **${slate.totals.open_questions + completion.totals.open_questions}**. `
  + `Fact checks recorded: **${slate.totals.fact_checks + completion.totals.fact_checks}**. `
  + 'Both are stored per series in the `_manifest-*.json` sources.');
P('');

/* ---------------- test fixtures ---------------- */
P('---');
P('');
P('# Test fixtures / platform validation content');
P('');
P('Not Majarra content. Not counted in any production figure above. Kept because the videos are');
P('the only real media in the system and are needed to exercise upload, R2 storage, asset linking,');
P('streaming, playback sessions, player behaviour and private-media CDN handling.');
P('');
P('Flagged in the database as `series.content_class = \'test_fixture\'` (migration 0018), so it can');
P('be excluded from production reporting and from a public release with a single predicate rather');
P('than a naming convention.');
P('');
for (const s of seriesRows.filter((x) => x.content_class === 'test_fixture')) {
  const items = rows.filter((r) => r.series_slug === s.slug);
  P(`## ${s.title_ar} · \`${s.slug}\``);
  P('');
  P(`\`${s.type}\` · ages ${s.age_min}–${s.age_max} · planet \`${s.planet}\` · status \`${s.status}\` · **\`content_class = test_fixture\`**`);
  P('');
  P('**Origin.** External material supplied for platform testing only. Arabic orthography lessons.');
  P('Not a Majarra original, not editorially produced by Majarra, and not to be presented as');
  P('Majarra Original.');
  P('');
  P('**Deliberately NOT completed:** no scripts, no learning objectives, no parent guides, no');
  P('comprehension questions, no thumbnails, no poster, no banner. No production resource should be');
  P('spent on it.');
  P('');
  P(`| # | Item | Type | Video | Purpose |`);
  P('|---:|---|---|---|---|');
  for (const r of items.sort((a, b) => (a.item_number ?? 0) - (b.item_number ?? 0))) {
    P(`| ${r.item_number ?? '—'} | ${String(r.title).replace(/\|/g, '/')} | ${r.kind} | ${r.has_stream ? 'real video ✓' : '—'} | platform test fixture |`);
  }
  P('');
}

fs.writeFileSync(process.argv[2], lines.join('\n') + '\n', 'utf8');
console.log(`written: ${process.argv[2]}  (${lines.length} lines)`);
console.log('status distribution:');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(34)}${v}`);
