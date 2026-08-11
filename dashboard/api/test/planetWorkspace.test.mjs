/// Regression coverage for the planet endpoints in routes/adminPlanets.ts.
///
/// ## What is worth pinning on a read-only workspace
///
/// Nothing here writes, so a defect cannot corrupt data — it misinforms an operator
/// on the screen they use to decide what to work on next. The properties asserted are
/// the ones that would regress silently:
///
/// 1. **Zero and "could not be read" stay distinguishable.** Every module carries its
///    own `unavailable`, and a module whose statement failed must not present zeros.
///    This is the defect class the executive dashboard already shipped once.
/// 2. **A field the schema cannot answer is absent, not zero.** Planet analytics is
///    permanently `unavailable` because the D1 activity tables have no writer, and the
///    French series title has no column at all. Both must say so.
/// 3. **Health counters exclude test fixtures** (`series.content_class`), while the
///    two legacy fields keep their old meaning because other screens read them.
/// 4. **`track_ids` reaches the browser as an array**, whatever GROUP_CONCAT returns.
///    Calling `.map` on the raw string blanked the whole planet route before.
/// 5. **Disabling a planet that still has content requires confirmation**, and the
///    refusal names the impact rather than just failing.
///
/// The handlers are reached through the router with a stubbed D1, so dispatch, the SQL
/// shape and the post-processing are exercised together on `node --test`.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';

/// Matches on the longest distinctive fragment of each statement, so a fixture cannot
/// answer a query it was not written for. Ranking by needle length means a short
/// fragment never shadows a more specific one.
function fakeDb(matchers = [], options = {}) {
  const ranked = [...matchers].sort((a, b) => b[0].length - a[0].length);
  const seen = [];
  const failing = options.failing ?? [];
  const terminals = (sql) => {
    const run = () => {
      seen.push(sql);
      if (failing.some((needle) => sql.includes(needle))) throw new Error('no such table');
      const hit = ranked.find(([needle]) => sql.includes(needle));
      return hit ? hit[1] : [];
    };
    return {
      async first() { const rows = run(); return rows.length ? rows[0] : null; },
      async all() { return { results: run() }; },
      async run() { run(); return { meta: { changes: 1 } }; },
    };
  };
  return {
    statements: seen,
    batched: [],
    prepare(sql) {
      return { bind: () => terminals(sql), ...terminals(sql) };
    },
    async batch(statements) {
      this.batched.push(statements.length);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

const ENV = (db) => ({
  DB: db,
  ENVIRONMENT: 'development',
  PUBLIC_ASSET_BASE_URL: 'https://cdn.example.com',
  CACHE: { async get() { return null; }, async put() {} },
});

async function call(db, path, init = {}) {
  const { default: route } = await import('../src/routes/adminPlanets.ts');
  const response = await route.request(path, init, ENV(db));
  return { status: response.status, body: await response.json().catch(() => null) };
}

/// The same router behind an authorised request.
///
/// `requirePermission` reads the identity `requireAdmin` puts on the context, and the
/// reads here are mounted without it, so the writes would answer 401 for a reason that
/// has nothing to do with what is being tested. This mounts the router under a
/// middleware that sets the documented pre-seed exit (`adminIsLegacyKey`), which is the
/// path `requirePermission` allows explicitly rather than a stub of its logic.
async function callAuthorized(db, path, init = {}) {
  const { default: route } = await import('../src/routes/adminPlanets.ts');
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('adminIsLegacyKey', true); await next(); });
  app.route('/', route);
  const response = await app.request(path, init, ENV(db));
  return { status: response.status, body: await response.json().catch(() => null) };
}

/// A row shaped like the collection statement's output: the planet columns plus the
/// `h_*` aggregate aliases and the four artwork columns per prefix.
const listRow = (over = {}) => ({
  id: 'qisas', name_ar: 'كوكب القصص', name_en: 'Stories', description_ar: 'حكايات',
  color_hex: '#FECA57', icon_url: null, sort_order: 5, is_active: 1, created_at: '2026-01-01 00:00:00',
  series_count: 3, assets_count: 2,
  h_series_total: 3, h_series_published: 1, h_series_pipeline: 2, h_seasons_total: 2,
  h_episodes_total: 9, h_episodes_published: 4, h_episodes_ready_unpublished: 1,
  h_stories_total: 5, h_books_total: 0, h_games_total: 2, h_projects_total: 0,
  h_characters_total: 4, h_series_english: 2,
  h_artwork_icon: 1, h_artwork_cover: 1,
  h_production_blockers: 0, h_reviews_pending: 0,
  h_content_updated_at: '2026-08-01 10:00:00',
  icon_asset_r2_key: 'public/planets/qisas-icon.png', icon_asset_visibility: 'public',
  icon_asset_status: 'ready', icon_asset_kind: 'image',
  cover_asset_r2_key: 'public/planets/qisas-cover.png', cover_asset_visibility: 'public',
  cover_asset_status: 'ready', cover_asset_kind: 'image',
  ...over,
});

const LIST_NEEDLE = 'FROM planets p\n  ORDER BY p.sort_order';

/* ------------------------------------------------------------- the collection */

test('the collection resolves artwork URLs and exposes health per planet', async () => {
  const db = fakeDb([[LIST_NEEDLE, [listRow()]]]);
  const { status, body } = await call(db, '/planets');

  assert.equal(status, 200);
  assert.equal(body.data.length, 1);
  const planet = body.data[0];
  assert.equal(planet.icon_url, 'https://cdn.example.com/public/planets/qisas-icon.png');
  assert.equal(planet.cover_url, 'https://cdn.example.com/public/planets/qisas-cover.png');
  assert.equal(planet.is_active, true);
  assert.equal(planet.health.episodes_total, 9);
  assert.equal(planet.health.artwork_icon, true);
  assert.equal(planet.health.has_description, true);
  // The internal aggregate aliases never reach a client.
  for (const key of Object.keys(planet)) assert.ok(!key.startsWith('h_'), `${key} leaked`);
  // Nor do the artwork projection columns.
  assert.ok(!('icon_asset_r2_key' in planet));
});

test('an unreadable planets statement is a 503, not an empty catalogue', async () => {
  // A screen that renders "no planets" when the query failed sends an operator to
  // create planets that already exist.
  const db = fakeDb([], { failing: ['FROM planets p'] });
  const { status, body } = await call(db, '/planets');
  assert.equal(status, 503);
  assert.equal(body.success, false);
  assert.match(body.error, /تعذّرت/);
});

test('inactive planets are hidden by default and included on request', async () => {
  const rows = [listRow(), listRow({ id: 'old', name_ar: 'قديم', is_active: 0 })];
  const visible = await call(fakeDb([[LIST_NEEDLE, rows]]), '/planets');
  assert.deepEqual(visible.body.data.map((row) => row.id), ['qisas']);

  const withInactive = await call(fakeDb([[LIST_NEEDLE, rows]]), '/planets?include_inactive=1');
  assert.deepEqual(withInactive.body.data.map((row) => row.id), ['qisas', 'old']);

  const onlyInactive = await call(fakeDb([[LIST_NEEDLE, rows]]), '/planets?status=inactive');
  assert.deepEqual(onlyInactive.body.data.map((row) => row.id), ['old']);
});

test('the header summary describes every planet, not the filtered subset', async () => {
  // A summary that moves when a filter is applied cannot be used to decide which
  // filter to apply.
  const rows = [
    listRow({ id: 'a', h_series_published: 1 }),
    listRow({ id: 'b', h_series_published: 0, h_episodes_published: 0, h_artwork_cover: 0, description_ar: null }),
    listRow({ id: 'c', h_series_published: 0, h_episodes_published: 0, h_production_blockers: 3 }),
  ];
  const { body } = await call(fakeDb([[LIST_NEEDLE, rows]]), '/planets?artwork=missing');

  assert.deepEqual(body.data.map((row) => row.id), ['b'], 'only the planet missing artwork is listed');
  assert.equal(body.meta.total, 1);
  assert.equal(body.meta.summary.total, 3);
  assert.equal(body.meta.summary.with_published_content, 1);
  assert.equal(body.meta.summary.without_published_content, 2);
  assert.equal(body.meta.summary.missing_artwork, 1);
  assert.equal(body.meta.summary.missing_description, 1);
  assert.equal(body.meta.summary.with_production_blockers, 1);
});

test('every collection filter narrows on a real signal', async () => {
  const rows = [
    listRow({ id: 'full' }),
    listRow({ id: 'empty', h_series_total: 0, h_stories_total: 0, h_games_total: 0, h_books_total: 0, h_projects_total: 0 }),
    listRow({ id: 'blocked', h_production_blockers: 2 }),
    listRow({ id: 'nodesc', description_ar: '  ' }),
  ];
  const ids = async (search) => (await call(fakeDb([[LIST_NEEDLE, rows]]), `/planets${search}`)).body.data.map((row) => row.id);

  assert.deepEqual(await ids('?content=empty'), ['empty']);
  assert.deepEqual(await ids('?content=has'), ['full', 'blocked', 'nodesc']);
  assert.deepEqual(await ids('?production=blocked'), ['blocked']);
  assert.deepEqual(await ids('?description=missing'), ['nodesc'], 'whitespace is not a description');
  assert.deepEqual(await ids('?q=blocked'), ['blocked']);
});

test('the localization filter measures English titles and excludes planets with nothing to translate', async () => {
  // Only English is offered: `series.title_ar` is NOT NULL so an Arabic filter would
  // match everything, and no French title column exists at all.
  const rows = [
    listRow({ id: 'done', h_series_total: 3, h_series_english: 3 }),
    listRow({ id: 'partial', h_series_total: 3, h_series_english: 1 }),
    listRow({ id: 'none', h_series_total: 3, h_series_english: 0 }),
    // A planet with no series is neither complete nor incomplete: sending an operator
    // to translate a planet that carries nothing is a false positive.
    listRow({ id: 'bare', h_series_total: 0, h_series_english: 0 }),
  ];
  const ids = async (search) => (await call(fakeDb([[LIST_NEEDLE, rows]]), `/planets${search}`)).body.data.map((row) => row.id);

  assert.deepEqual(await ids('?localization=en_complete'), ['done']);
  assert.deepEqual(await ids('?localization=en_incomplete'), ['partial', 'none']);
  assert.deepEqual(await ids(''), ['done', 'partial', 'none', 'bare'], 'no filter still lists them all');
});

test('sorting is a server decision and covers order, name, content and recency', async () => {
  const rows = [
    listRow({ id: 'b', name_ar: 'باء', sort_order: 2, h_episodes_total: 1, h_content_updated_at: '2026-01-01 00:00:00' }),
    listRow({ id: 'a', name_ar: 'ألف', sort_order: 3, h_episodes_total: 50, h_content_updated_at: '2026-09-01 00:00:00' }),
    listRow({ id: 'c', name_ar: 'تاء', sort_order: 1, h_episodes_total: 10, h_content_updated_at: '2026-05-01 00:00:00' }),
  ];
  const ids = async (search) => (await call(fakeDb([[LIST_NEEDLE, rows]]), `/planets${search}`)).body.data.map((row) => row.id);

  assert.deepEqual(await ids(''), ['c', 'b', 'a'], 'display order is the default');
  assert.deepEqual(await ids('?sort=content_desc'), ['a', 'c', 'b']);
  assert.deepEqual(await ids('?sort=content_asc'), ['b', 'c', 'a']);
  assert.deepEqual(await ids('?sort=updated'), ['a', 'c', 'b']);
  assert.deepEqual((await ids('?sort=name'))[0], 'a', 'Arabic collation, not code points');
});

/* -------------------------------------------------------------- the workspace */

const WORKSPACE_DB = (over = {}, options = {}) => fakeDb([
  ['FROM planets p WHERE p.id = ?', [{
    id: 'qisas', name_ar: 'كوكب القصص', description_ar: 'حكايات', color_hex: '#FECA57',
    sort_order: 5, is_active: 1, series_count: 3, assets_count: 2,
    h_artwork_icon: 1, h_artwork_cover: 0,
    icon_asset_r2_key: 'public/i.png', icon_asset_visibility: 'public', icon_asset_status: 'ready', icon_asset_kind: 'image',
    cover_asset_r2_key: null, cover_asset_visibility: null, cover_asset_status: null, cover_asset_kind: null,
  }]],
  ['AS episodes_ready_unpublished', [{
    series_total: 3, series_published: 1, series_pipeline: 2, series_early: 1, series_in_review: 1,
    series_in_production: 0, series_ready: 0, seasons_total: 2, episodes_total: 9,
    episodes_published: 4, episodes_ready_unpublished: 2, episodes_without_video: 3,
    stories_total: 5, stories_published: 2, games_total: 2, games_published: 0,
    books_total: 0, projects_total: 1, characters_total: 4, fixture_series: 1,
    unparented_stories: 7, unparented_games: 0, unparented_books: 0, unparented_projects: 0,
    content_updated_at: '2026-08-01 10:00:00',
  }]],
  ['FROM asset_links al JOIN content_assets ca ON ca.id = al.asset_id\n     WHERE al.entity_type = \'planet\'', [
    { link_id: 'l1', role: 'icon', language: '', asset_id: 'a1', title_ar: 'أيقونة', kind: 'image', status: 'ready', visibility: 'public', expected_width: 512, expected_height: 512, updated_at: '2026-07-01 00:00:00' },
  ]],
  ['AS series_without_poster', [{
    series_total: 3, series_without_poster: 2, episodes_total: 9, episodes_without_thumbnail: 5,
  }]],
  ['AS story_pages_total', [{
    series_total: 3, series_title_en: 2, series_description_en: 1, episodes_total: 9,
    episodes_dub_ar: 9, episodes_dub_en: 2, episodes_dub_fr: 0, episodes_captions_ar: 6,
    story_pages_total: 40, story_text_ar: 40, story_text_en: 12, story_text_fr: 0,
    story_voice_ar: 30, story_voice_en: 0, story_voice_fr: 0,
    games_total: 2, games_loc_ar: 2, games_loc_en: 1, games_loc_fr: 0,
  }]],
  ['AS tracked_items', [{ blocked: 2, past_due: 3, unowned: 4, tracked_items: 6 }]],
  ['pr.blocker, pr.due_at', [
    { content_type: 'episode', content_id: 'ep-1', requirement: 'video', blocker: 'انتظار المونتاج', due_at: '2026-07-01T00:00:00.000Z', title: 'الحلقة الأولى', series_id: 's1', series_title: 'حكايات' },
  ]],
  ['AS objectives_catalogue', [{
    episodes_total: 9, episodes_with_objective: 6, games_total: 2, games_with_objective: 1,
    distinct_objectives: 5, objectives_catalogue: 40,
  }]],
  ['FROM learning_objectives lo', [
    { id: 'lo-1', code: 'LO-1', title_ar: 'الحروف', age_min: 6, age_max: 8, skill_name: 'القراءة', episodes: 3, games: 1 },
  ]],
  ['AS religious_scoped', [{
    pending: 3, needs_changes: 1, approved: 5, rejected: 0,
    runs_running: 2, stages_overdue: 1, religious_pending: 0, religious_scoped: 0,
  }]],
  ['LEFT JOIN admin_users au ON au.id = cr.reviewer_id', [
    { id: 'cr-1', entity_type: 'series', entity_id: 's1', reviewer_role: 'edu', status: 'pending', created_at: '2026-08-01 00:00:00', title: 'حكايات' },
  ]],
  ["WHERE entity_type = 'planet' AND entity_id = ?", [{ entity_type: 'planet', entity_id: 'qisas', mode: 'worldwide', reason: 'commercial', countries: '[]', languages: '[]', platforms: '[]' }]],
  ["WHERE entity_type = 'global'", [{ mode: 'worldwide', reason: 'commercial', note: null }]],
  ['AS series_overrides', [{ series_overrides: 1, episode_overrides: 0, withheld: 0, restricted: 1 }]],
  ['FROM rights_licenses rl', [
    { id: 'rl-1', content_id: 's1', owner: 'مجرة', license_type: 'exclusive', expiry_date: '2020-01-01', title: 'حكايات' },
  ]],
  ['FROM audit_logs al', [
    { id: 'au-1', actor_id: 'u1', action: 'update', entity_type: 'series', entity_id: 's1', created_at: '2026-08-01 09:00:00', title: 'حكايات', actor_name: 'محرِّر' },
  ]],
].filter(([needle]) => !(needle in over)).concat(Object.entries(over)), options);

test('the workspace answers every module in one request', async () => {
  const { status, body } = await call(WORKSPACE_DB(), '/planets/qisas/workspace');
  assert.equal(status, 200);
  const data = body.data;

  assert.equal(data.planet.artwork_icon, true);
  assert.equal(data.planet.artwork_cover, false, 'a missing cover is reported as missing');
  assert.equal(data.content.episodes_total, 9);
  assert.equal(data.content.unavailable, null);
  assert.equal(data.media.series_without_poster, 2);
  assert.equal(data.media.assets.length, 1);
  assert.deepEqual(data.media.expected_roles, { icon: ['icon'], cover: ['cover', 'banner'] });
  assert.equal(data.production.blocked, 2);
  assert.equal(data.production.items.length, 1);
  assert.equal(data.learning.episodes_with_objective, 6);
  assert.equal(data.learning.objectives.length, 1);
  assert.equal(data.reviews.pending, 3);
  assert.equal(data.rights.series_overrides, 1);
  assert.equal(data.activity.length, 1);
  assert.ok(data.generated_at);
});

test('planet analytics is permanently unavailable and names the authority', async () => {
  // D1's watch_progress / attempts / mastery have no writer — child activity lives in
  // the FamilyState Durable Object — so a per-planet view count would be invented.
  const { body } = await call(WORKSPACE_DB(), '/planets/qisas/workspace');
  assert.match(body.data.analytics.unavailable, /FamilyState/);
  assert.match(body.data.analytics.source, /FamilyState/);
  assert.ok(!('views' in body.data.analytics));
  assert.ok(!('plays' in body.data.analytics));
});

test('a module whose statement fails reports unavailable instead of zeros', async () => {
  const { body } = await call(
    WORKSPACE_DB({}, { failing: ['production_requirements'] }),
    '/planets/qisas/workspace',
  );
  assert.match(body.data.production.unavailable, /تعذّرت/);
  assert.equal(body.data.content.unavailable, null, 'one failed source does not blank the others');
  assert.equal(body.data.content.episodes_total, 9);
  // And nothing that failed is presented as an attention item, which would read as
  // "all clear on production".
  assert.ok(!body.data.attention.some((item) => item.key === 'production_blocked'));
});

test('the French series title states that no column exists rather than reporting zero', async () => {
  const { body } = await call(WORKSPACE_DB(), '/planets/qisas/workspace');
  const french = body.data.localization.languages.find((entry) => entry.language === 'fr');
  const metadata = french.signals.find((signal) => signal.key === 'series_metadata');
  assert.match(metadata.unavailable, /لا عمود/);

  const arabic = body.data.localization.languages.find((entry) => entry.language === 'ar');
  const arabicMetadata = arabic.signals.find((signal) => signal.key === 'series_metadata');
  assert.equal(arabicMetadata.total, 3);
  assert.equal(arabicMetadata.done, 3);
  assert.match(arabicMetadata.note, /NOT NULL/, 'a constraint-driven 100% says so');

  const english = body.data.localization.languages.find((entry) => entry.language === 'en');
  assert.equal(english.signals.find((signal) => signal.key === 'story_text').done, 12);
  assert.equal(english.signals.find((signal) => signal.key === 'story_text').total, 40);
});

test('every language signal carries a denominator', async () => {
  const { body } = await call(WORKSPACE_DB(), '/planets/qisas/workspace');
  for (const entry of body.data.localization.languages) {
    for (const signal of entry.signals) {
      assert.equal(typeof signal.total, 'number', `${entry.language}/${signal.key} needs a denominator`);
      assert.equal(typeof signal.done, 'number');
      assert.ok(signal.done <= signal.total || signal.unavailable, `${entry.language}/${signal.key} exceeds its total`);
    }
  }
});

test('attention items are real counts and each carries a destination', async () => {
  const { body } = await call(WORKSPACE_DB(), '/planets/qisas/workspace');
  const items = body.data.attention;
  assert.ok(items.length > 0);
  for (const item of items) {
    assert.ok(item.count > 0, `${item.key} is listed with no count`);
    assert.ok(item.drill && item.drill.startsWith('/'), `${item.key} has no destination`);
    assert.ok(['warn', 'danger'].includes(item.tone));
  }
  const keys = items.map((item) => item.key);
  assert.ok(keys.includes('planet_artwork'), 'the missing cover is surfaced');
  assert.ok(keys.includes('series_without_poster'));
  assert.ok(keys.includes('production_blocked'));
  assert.ok(keys.includes('rights_expired'), 'an expired licence on this planet is surfaced');
  assert.ok(!keys.includes('religious_pending'), 'a zero is not listed as work to do');
  assert.ok(!keys.includes('planet_description'), 'a planet with a description is not flagged');
});

test('a reviewer is named, and a reviewer row that vanished still lists its review', async () => {
  // A raw `reviewer_id` names nobody an operator can chase, so the query joins
  // `admin_users` the way the production query already does. The join is LEFT: losing
  // the row would hide pending work, which is worse than showing an id.
  const named = await call(WORKSPACE_DB({
    'LEFT JOIN admin_users au ON au.id = cr.reviewer_id': [
      { id: 'cr-1', entity_type: 'series', entity_id: 's1', reviewer_role: 'edu', reviewer_id: 'u-7', reviewer_name: 'مراجِع تربوي', status: 'pending', created_at: '2026-08-01 00:00:00', title: 'حكايات' },
    ],
  }), '/planets/qisas/workspace');
  assert.equal(named.body.data.reviews.items[0].reviewer_name, 'مراجِع تربوي');

  const orphaned = await call(WORKSPACE_DB({
    'LEFT JOIN admin_users au ON au.id = cr.reviewer_id': [
      { id: 'cr-2', entity_type: 'series', entity_id: 's1', reviewer_role: 'qa', reviewer_id: 'u-gone', reviewer_name: null, status: 'pending', created_at: '2026-08-01 00:00:00', title: 'حكايات' },
    ],
  }), '/planets/qisas/workspace');
  assert.equal(orphaned.body.data.reviews.items.length, 1, 'the review is not dropped');
  assert.equal(orphaned.body.data.reviews.items[0].reviewer_id, 'u-gone');
});

test('a right expiring soon is its own bucket, separate from one already expired', async () => {
  // By the time a right is expired the content is already unlicensed. The window is
  // the last moment a renewal can be negotiated calmly, so it earns its own item.
  const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const far = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);
  const { body } = await call(WORKSPACE_DB({
    'FROM rights_licenses rl': [
      { id: 'gone', content_id: 's1', owner: 'مجرة', license_type: 'exclusive', expiry_date: '2020-01-01', title: 'منتهية' },
      { id: 'soon', content_id: 's1', owner: 'مجرة', license_type: 'exclusive', expiry_date: soon, title: 'قريبة' },
      { id: 'far', content_id: 's1', owner: 'مجرة', license_type: 'exclusive', expiry_date: far, title: 'بعيدة' },
      { id: 'open', content_id: 's1', owner: 'مجرة', license_type: 'exclusive', expiry_date: null, title: 'بلا انتهاء' },
    ],
  }), '/planets/qisas/workspace');

  const items = body.data.attention;
  const expired = items.find((item) => item.key === 'rights_expired');
  const expiring = items.find((item) => item.key === 'rights_expiring');
  assert.equal(expired.count, 1, 'only the already-expired licence counts as expired');
  assert.equal(expired.tone, 'danger');
  assert.equal(expiring.count, 1, 'the far and open-ended licences are not urgent');
  assert.equal(expiring.tone, 'warn');
  assert.match(expiring.label_ar, /30/, 'the window is stated, not implied');
});

test('the workspace states what it deliberately does not compute', async () => {
  const { body } = await call(WORKSPACE_DB(), '/planets/qisas/workspace');
  // No planet-level completion percentage, and the reason is in the payload.
  assert.ok(!('percent' in body.data.production));
  assert.match(body.data.production.notes.join(' '), /productionMatrix/);
  // Stories cannot carry a review row at all; that is a schema constraint, not a gap.
  assert.match(body.data.reviews.notes.join(' '), /story/);
  // Availability does not intersect, so an override on a series ignores the planet.
  assert.match(body.data.rights.notes.join(' '), /لا تتقاطع/);
  // Books have no language column, so they are absent from localisation.
  assert.match(body.data.localization.notes.join(' '), /الكتب/);
});

test('a missing planet is a 404 from the workspace and the tree', async () => {
  const workspace = await call(fakeDb([]), '/planets/nope/workspace');
  assert.equal(workspace.status, 404);
  const tree = await call(fakeDb([]), '/planets/nope/tree');
  assert.equal(tree.status, 404);
});

/* ------------------------------------------------------------------- the tree */

const TREE_DB = () => fakeDb([
  ['SELECT id FROM planets WHERE id = ?', [{ id: 'qisas' }]],
  ['FROM series s\n   WHERE s.planet_id = ?', [
    {
      id: 's1', title_ar: 'حكايات', slug: 'hekayat', status: 'draft', type: 'anthology',
      age_min: 6, age_max: 8, sort_order: 1, updated_at: '2026-08-01 00:00:00',
      content_class: 'production', cover_url: null, seasons_count: 1, episodes_count: 2,
      episodes_published: 1, track_ids: 'kids,junior',
      cover_asset_r2_key: null, cover_asset_visibility: null, cover_asset_status: null, cover_asset_kind: null,
    },
  ]],
  ['FROM seasons se', [
    { id: 'se1', series_id: 's1', season_number: 1, title_ar: 'الموسم الأول', status: 'draft', episodes_count: 1 },
  ]],
  ['SELECT COUNT(*) AS total FROM episodes e', [{ total: 2 }]],
  ['e.id, e.series_id, e.season_id, e.episode_number', [
    { id: 'ep1', series_id: 's1', season_id: 'se1', episode_number: 1, title_ar: 'الأولى', status: 'ready', is_published: 1, has_video: 1, has_captions: 0, thumbnail_asset: 1, thumbnail_url: null, dubs: '["ar"]' },
    { id: 'ep2', series_id: 's1', season_id: null, episode_number: 2, title_ar: 'الثانية', status: 'draft', is_published: 0, has_video: 0, has_captions: 0, thumbnail_asset: 0, thumbnail_url: null, dubs: '["ar"]' },
  ]],
]);

test('the tree nests planet to series to season to episode', async () => {
  const { status, body } = await call(TREE_DB(), '/planets/qisas/tree');
  assert.equal(status, 200);
  const series = body.data[0];
  assert.deepEqual(series.track_ids, ['kids', 'junior'], 'tracks arrive as an array');
  assert.equal(series.seasons.length, 1);
  assert.equal(series.seasons[0].episodes.length, 1);
  assert.equal(series.seasons[0].episodes[0].id, 'ep1');
  assert.equal(series.seasons[0].episodes[0].has_thumbnail, true);
  assert.equal(series.seasons[0].episodes[0].is_published, true);
});

test('an episode attached to no season is exposed, not hidden', async () => {
  // These are the ones an operator most often needs to find; dropping them made the
  // tree disagree with the episode count next to it.
  const { body } = await call(TREE_DB(), '/planets/qisas/tree');
  const series = body.data[0];
  assert.deepEqual(series.unassigned_episodes.map((episode) => episode.id), ['ep2']);
  assert.equal(series.unassigned_episodes[0].has_video, false);
  assert.equal(series.loaded_episodes, 2);
});

test('the tree advertises its caps so a capped tree is not read as the whole planet', async () => {
  const { body } = await call(TREE_DB(), '/planets/qisas/tree');
  assert.equal(body.meta.series_limit, 60);
  assert.equal(body.meta.episode_limit, 400);
  assert.equal(body.meta.episodes_total, 2);
  assert.equal(body.meta.episodes_returned, 2);
  assert.equal(body.meta.truncated, false);
});

/* ------------------------------------------------------------------ the writes */

test('disabling a planet that still carries content requires explicit confirmation', async () => {
  const db = fakeDb([
    ['SELECT id FROM planets WHERE id = ?', [{ id: 'qisas' }]],
    ['AS published_episodes', [{ series: 3, published_series: 1, episodes: 9, published_episodes: 4 }]],
  ]);
  const refused = await callAuthorized(db, '/planets/qisas', { method: 'DELETE' });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.data.requires_confirmation, true);
  assert.deepEqual(refused.body.data.impact, {
    series: 3, published_series: 1, episodes: 9, published_episodes: 4,
  });
  assert.equal(db.batched.length, 0, 'nothing was written on a refusal');

  const forced = await callAuthorized(db, '/planets/qisas?force=1', { method: 'DELETE' });
  assert.equal(forced.status, 200);
  assert.equal(forced.body.data.is_active, false);
  assert.equal(forced.body.data.impact.published_series, 1, 'the impact is reported back');
  assert.equal(db.batched.length, 1, 'the update and its audit row go in one batch');
});

test('an empty planet is disabled without a force flag', async () => {
  const db = fakeDb([
    ['SELECT id FROM planets WHERE id = ?', [{ id: 'fresh' }]],
    ['AS published_episodes', [{ series: 0, published_series: 0, episodes: 0, published_episodes: 0 }]],
  ]);
  const { status, body } = await callAuthorized(db, '/planets/fresh', { method: 'DELETE' });
  assert.equal(status, 200);
  assert.equal(body.data.is_active, false);
});

test('an unauthorised caller cannot write, and the refusal is not a validation error', async () => {
  // The router is mounted under `requireAdmin` in production; reached without it, a
  // write must be 401 rather than falling through to the handler.
  const db = fakeDb([['SELECT id FROM planets WHERE id = ?', [{ id: 'qisas' }]]]);
  const created = await call(db, '/planets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name_ar: 'كوكب' }),
  });
  assert.equal(created.status, 401);
  assert.equal(db.batched.length, 0);
});

test('planet writes validate the colour and reject an empty name', async () => {
  const db = fakeDb([['SELECT id FROM planets WHERE id = ?', [{ id: 'qisas' }]]]);
  const post = (payload) => callAuthorized(db, '/planets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });

  assert.equal((await post({})).status, 400);
  assert.match((await post({ name_ar: 'كوكب', color_hex: 'red' })).body.error, /six-digit/);
  assert.equal((await post({ name_ar: 'كوكب جديد', color_hex: '#123abc' })).status, 201);

  const patched = await callAuthorized(db, '/planets/qisas', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name_ar: '   ' }),
  });
  assert.equal(patched.status, 400);
});
