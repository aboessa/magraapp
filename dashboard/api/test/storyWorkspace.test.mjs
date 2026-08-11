/// Regression coverage for the story endpoints in routes/adminStories.ts.
///
/// ## What is worth pinning here
///
/// Two of the three endpoints are reads that feed an editor's decisions, and one is
/// the only write in the codebase that can renumber pages. The properties asserted
/// are the ones that would regress silently:
///
/// 1. **Coverage is counted, not inferred from `stories.languages`.** Declaring a
///    language is an intention; the number must come from counting pages that
///    actually carry text, and separately pages that carry a *ready* narration.
///    Conflating those two produced the old "ar · en" label that told an editor
///    nothing.
/// 2. **A `planned` image is not a ready image.** The old editor created single
///    uploads as `planned` while the publish gate demands `ready`, so stories were
///    unpublishable for a reason the screen never showed. The blocker must name the
///    actual status.
/// 3. **Read-to-me and read-along are separate verdicts.** Narration without timing
///    cues is a complete read-to-me and an empty read-along. One field cannot stand
///    for both.
/// 4. **Reorder is all-or-nothing.** `UNIQUE (story_id, page_number)` means a
///    half-applied reorder leaves duplicate or missing page numbers that no later
///    request can untangle, so a rejected payload must write nothing at all.
/// 5. **Unsupported is stated, not discovered.** `content_reviews` and
///    `content_rights` both reject `entity_type = 'story'`, and nothing writes
///    `timing_cues`. The payload says so rather than letting an editor find out from
///    a 409 or an empty panel.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';

/// Matches on the longest distinctive fragment of each statement, so a fixture
/// cannot answer a query it was not written for. Ranking by needle length means a
/// short fragment never shadows a more specific one.
function fakeDb(matchers = [], options = {}) {
  const ranked = [...matchers].sort((a, b) => b[0].length - a[0].length);
  const seen = [];
  const batches = [];
  const failing = options.failing ?? [];
  const rejectBatch = options.rejectBatch ?? false;
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
    batches,
    prepare(sql) {
      return { bind: (...args) => ({ ...terminals(sql), __sql: sql, __args: args }), ...terminals(sql), __sql: sql };
    },
    async batch(statements) {
      if (rejectBatch) throw new Error('CHECK constraint failed: page_number > 0');
      batches.push(statements);
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
  const { default: route } = await import('../src/routes/adminStories.ts');
  const response = await route.request(path, init, ENV(db));
  return { status: response.status, body: await response.json().catch(() => null) };
}

/// The same router behind an authorised request. `requirePermission` reads the
/// identity `requireAdmin` puts on the context, and this router is mounted without
/// it in these tests, so a write would answer 401 for a reason unrelated to what is
/// being tested. This sets the documented pre-seed exit rather than stubbing the
/// permission logic itself.
async function callAuthorized(db, path, init = {}) {
  const { default: route } = await import('../src/routes/adminStories.ts');
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('adminIsLegacyKey', true); await next(); });
  app.route('/', route);
  const response = await app.request(path, init, ENV(db));
  return { status: response.status, body: await response.json().catch(() => null) };
}

const LIBRARY_NEEDLE = 'FROM stories st\n      LEFT JOIN series s';
const TEXT_NEEDLE = 'COUNT(*) AS with_text';
const NARRATION_NEEDLE = 'COUNT(*) AS with_narration';

/// A row shaped like the library statement's output.
const libraryRow = (over = {}) => ({
  id: 'story-bird-home', slug: 'bird-home', title_ar: 'بيت الطائر', title_en: 'Bird Home',
  description_ar: 'طائر صغير', type: 'picture_book', status: 'ready',
  age_min: 3, age_max: 5, reading_level: 'pre_reader',
  default_language: 'ar', languages: '["ar","en"]', is_free: 1, sort_order: 1,
  updated_at: '2026-08-11 10:00:00', published_at: null,
  series_id: 'series-preschool-calm-tale', series_title: 'حكاية هادئة',
  planet_id: 'qisas', planet_name: 'كوكب القصص', planet_color: '#FECA57',
  pages_total: 8, pages_with_image: 8,
  cover_asset_r2_key: 'public/catalog/cover.jpg', cover_asset_visibility: 'public',
  cover_asset_status: 'ready', cover_asset_kind: 'image',
  ...over,
});

/* -------------------------------------------------------------- the library */

test('the library resolves real covers and counts coverage per language', async () => {
  const db = fakeDb([
    [LIBRARY_NEEDLE, [libraryRow()]],
    [TEXT_NEEDLE, [
      { story_id: 'story-bird-home', language: 'ar', with_text: 8 },
      { story_id: 'story-bird-home', language: 'en', with_text: 6 },
    ]],
    [NARRATION_NEEDLE, [
      { story_id: 'story-bird-home', language: 'ar', with_narration: 8 },
    ]],
  ]);
  const { status, body } = await call(db, '/stories/library');

  assert.equal(status, 200);
  const story = body.data[0];
  assert.equal(story.cover_url, 'https://cdn.example.com/public/catalog/cover.jpg');
  assert.equal(story.pages_total, 8);

  const ar = story.coverage.find((entry) => entry.language === 'ar');
  const en = story.coverage.find((entry) => entry.language === 'en');
  const fr = story.coverage.find((entry) => entry.language === 'fr');

  // Every figure carries its denominator: "6" alone could be six of six or six of forty.
  assert.deepEqual(
    { done: ar.text_done, total: ar.total, narration: ar.narration_done },
    { done: 8, total: 8, narration: 8 },
  );
  assert.deepEqual({ done: en.text_done, total: en.total }, { done: 6, total: 8 });
  // English is declared but has no narration — declaring a language does not create audio.
  assert.equal(en.narration_done, 0);
  assert.equal(en.declared, true);
  // French is undeclared and empty, and says so rather than being omitted.
  assert.equal(fr.declared, false);
  assert.equal(fr.text_done, 0);
});

test('a language listed in stories.languages is not reported as complete', async () => {
  // The whole point of counting: the old screen printed "ar · en" from the declared
  // list, which claimed English existed when not one page carried English text.
  const db = fakeDb([
    [LIBRARY_NEEDLE, [libraryRow({ languages: '["ar","en","fr"]' })]],
    [TEXT_NEEDLE, [{ story_id: 'story-bird-home', language: 'ar', with_text: 8 }]],
    [NARRATION_NEEDLE, []],
  ]);
  const { body } = await call(db, '/stories/library');
  const story = body.data[0];

  for (const language of ['en', 'fr']) {
    const entry = story.coverage.find((item) => item.language === language);
    assert.equal(entry.declared, true, `${language} is declared`);
    assert.equal(entry.text_done, 0, `${language} has no text despite being declared`);
  }
});

test('readiness separates an empty story from a partial one and a finished one', async () => {
  const rows = [
    libraryRow({ id: 'empty', pages_total: 0, pages_with_image: 0 }),
    libraryRow({ id: 'partial', pages_total: 8, pages_with_image: 3 }),
    libraryRow({ id: 'done', pages_total: 8, pages_with_image: 8 }),
  ];
  const db = fakeDb([
    [LIBRARY_NEEDLE, rows],
    [TEXT_NEEDLE, [
      { story_id: 'partial', language: 'ar', with_text: 8 },
      { story_id: 'done', language: 'ar', with_text: 8 },
    ]],
    [NARRATION_NEEDLE, []],
  ]);
  const { body } = await call(db, '/stories/library');
  const byId = new Map(body.data.map((story) => [story.id, story.readiness]));

  // A zero-page story is its own state, not a "draft with no explanation".
  assert.equal(byId.get('empty'), 'empty');
  assert.equal(byId.get('partial'), 'partial');
  assert.equal(byId.get('done'), 'ready');
  assert.equal(body.meta.summary.missing_pages, 1);
  assert.equal(body.meta.summary.missing_artwork, 1);
});

test('every missing-what filter narrows on the specific deficiency', async () => {
  const rows = [
    libraryRow({ id: 'nopages', pages_total: 0, pages_with_image: 0 }),
    libraryRow({ id: 'noart', pages_total: 8, pages_with_image: 2 }),
    libraryRow({ id: 'nocover', cover_asset_r2_key: null, cover_asset_status: null }),
    libraryRow({ id: 'fine' }),
  ];
  const matchers = [
    [LIBRARY_NEEDLE, rows],
    [TEXT_NEEDLE, rows.map((row) => ({ story_id: row.id, language: 'ar', with_text: row.pages_total }))],
    [NARRATION_NEEDLE, rows.map((row) => ({ story_id: row.id, language: 'ar', with_narration: row.pages_total }))],
  ];
  const ids = async (search) => (await call(fakeDb(matchers), `/stories/library${search}`)).body.data.map((row) => row.id);

  assert.deepEqual(await ids('?missing=pages'), ['nopages']);
  assert.deepEqual(await ids('?missing=artwork'), ['noart']);
  assert.deepEqual(await ids('?missing=cover'), ['nocover']);
});

test('an unreadable stories table is a 503, not an empty library', async () => {
  // A screen that renders "no stories" when the query failed sends an editor to
  // create work that already exists.
  const db = fakeDb([], { failing: ['FROM stories st'] });
  const { status, body } = await call(db, '/stories/library');
  assert.equal(status, 503);
  assert.equal(body.success, false);
  assert.match(body.error, /تعذّرت/);
});

test('the library states that read-along coverage is deliberately not counted', async () => {
  const db = fakeDb([[LIBRARY_NEEDLE, [libraryRow()]], [TEXT_NEEDLE, []], [NARRATION_NEEDLE, []]]);
  const { body } = await call(db, '/stories/library');
  // Counting a column nothing writes would produce a column of zeros that looks
  // like a measurement. The note says why it is absent instead.
  assert.match(body.meta.notes.join(' '), /timing_cues/);
  for (const entry of body.data[0].coverage) assert.equal(entry.timing_done, 0);
});

/* ------------------------------------------------------------ the workspace */

const STORY_NEEDLE = 'FROM stories st\n      LEFT JOIN series s ON s.id = st.series_id\n      LEFT JOIN planets';
const PAGES_NEEDLE = 'FROM story_pages sp\n      LEFT JOIN content_assets ca';
const LOC_NEEDLE = 'FROM story_page_localizations l';

const WORKSPACE_DB = (over = {}, options = {}) => fakeDb([
  [STORY_NEEDLE, [{
    id: 'story-bird-home', slug: 'bird-home', title_ar: 'بيت الطائر', title_en: 'Bird Home',
    type: 'picture_book', status: 'ready', age_min: 3, age_max: 5,
    default_language: 'ar', languages: '["ar","en"]', is_free: 1,
    series_id: 'series-preschool-calm-tale', series_title: 'حكاية هادئة',
    planet_id: 'qisas', planet_name: 'كوكب القصص', planet_color: '#FECA57',
    visual_style_name: 'هادئ', content_class: 'production',
    cover_asset_r2_key: 'public/catalog/cover.jpg', cover_asset_visibility: 'public',
    cover_asset_status: 'ready', cover_asset_kind: 'image',
  }]],
  [PAGES_NEEDLE, [
    {
      id: 'page-1', page_number: 1, layout: 'full_bleed', transition: 'kenburns_slow',
      duration_ms: 5480, image_asset_id: 'asset-1', background_asset_id: null,
      image_status: 'ready', image_r2_key: 'public/catalog/page-001.jpg',
      image_visibility: 'public', image_kind: 'image',
      image_width: 1920, image_height: 1080, image_aspect: '16:9',
      image_mime: 'image/jpeg', image_size: 810268,
      bubbles_count: 0, updated_at: '2026-08-11 10:00:00',
    },
    {
      id: 'page-2', page_number: 2, layout: 'full_bleed', transition: 'fade',
      duration_ms: null, image_asset_id: null, background_asset_id: null,
      image_status: null, image_r2_key: null, image_visibility: null, image_kind: null,
      image_width: null, image_height: null, image_aspect: null,
      image_mime: null, image_size: null,
      bubbles_count: 0, updated_at: '2026-08-11 10:00:00',
    },
  ]],
  [LOC_NEEDLE, [
    {
      page_id: 'page-1', language: 'ar', body_text: 'هذا زُغب.', alt_text: 'عشّ صغير',
      narration_asset_id: 'asset-vo-1', timing_cues: '[]', narration_status: 'ready',
      narration_source: 'generated', narration_size: 263084, updated_at: '2026-08-11 10:00:00',
    },
    {
      page_id: 'page-1', language: 'en', body_text: 'This is Fluff.', alt_text: 'A small nest',
      narration_asset_id: null, timing_cues: '[]', narration_status: null,
      narration_source: null, narration_size: null, updated_at: '2026-08-11 10:00:00',
    },
    {
      page_id: 'page-2', language: 'ar', body_text: null, alt_text: null,
      narration_asset_id: null, timing_cues: '[]', narration_status: null,
      narration_source: null, narration_size: null, updated_at: '2026-08-11 10:00:00',
    },
  ]],
  ['FROM audit_logs al', [
    { id: 'au-1', actor_id: 'u1', actor_name: 'محرِّر', action: 'update', entity_type: 'story', entity_id: 'story-bird-home', created_at: '2026-08-11 09:00:00' },
  ]],
].filter(([needle]) => !(needle in over)).concat(Object.entries(over)), options);

test('the workspace answers the whole editor in one request', async () => {
  const { status, body } = await call(WORKSPACE_DB(), '/stories/story-bird-home/workspace');
  assert.equal(status, 200);
  const data = body.data;

  assert.equal(data.story.title_ar, 'بيت الطائر');
  assert.equal(data.story.cover_url, 'https://cdn.example.com/public/catalog/cover.jpg');
  assert.equal(data.pages.length, 2);
  // The page image resolves to a real URL, so the canvas has something to show
  // without a per-page blob fetch.
  assert.equal(data.pages[0].image_url, 'https://cdn.example.com/public/catalog/page-001.jpg');
  assert.equal(data.pages[0].duration_ms, 5480);
  assert.equal(data.pages[0].image_width, 1920);
  assert.equal(data.activity.length, 1);
  assert.ok(data.generated_at);
});

test('a missing image and a not-ready image are different blockers', async () => {
  const { body } = await call(WORKSPACE_DB({
    [PAGES_NEEDLE]: [{
      id: 'page-1', page_number: 1, layout: 'full_bleed', transition: 'fade',
      duration_ms: null, image_asset_id: 'asset-1', background_asset_id: null,
      // `planned` is exactly the trap the old editor set: single uploads created
      // assets as planned while the publish gate demands ready.
      image_status: 'planned', image_r2_key: 'public/catalog/p1.jpg',
      image_visibility: 'public', image_kind: 'image',
      image_width: null, image_height: null, image_aspect: null,
      image_mime: null, image_size: null, bubbles_count: 0, updated_at: null,
    }],
  }), '/stories/story-bird-home/workspace');

  const notReady = body.data.blockers.find((entry) => entry.key === 'page_1_image_not_ready');
  assert.ok(notReady, 'the not-ready image is its own blocker');
  // The message names the actual status, so an editor knows to promote the asset
  // rather than re-upload an image that is already there.
  assert.match(notReady.label_ar, /planned/);
  assert.equal(notReady.inspector, 'image');
  assert.equal(notReady.page_number, 1);
  assert.ok(!body.data.blockers.some((entry) => entry.key === 'page_1_no_image'));
});

test('every blocker names the page and the inspector tab that resolves it', async () => {
  const { body } = await call(WORKSPACE_DB(), '/stories/story-bird-home/workspace');
  const blockers = body.data.blockers;
  assert.ok(blockers.length > 0);

  // "Cannot publish" without a location makes an editor open every page in turn.
  const noImage = blockers.find((entry) => entry.key === 'page_2_no_image');
  assert.equal(noImage.page_number, 2);
  assert.equal(noImage.inspector, 'image');
  assert.equal(noImage.severity, 'blocker');

  const noText = blockers.find((entry) => entry.key === 'page_2_no_text_ar');
  assert.equal(noText.inspector, 'content');
  assert.equal(noText.language, 'ar');
});

test('missing narration blocks an audio story and only warns a picture book', async () => {
  const picture = await call(WORKSPACE_DB(), '/stories/story-bird-home/workspace');
  const pictureEntry = picture.body.data.blockers.find((entry) => entry.key === 'page_2_no_narration_ar');
  // `catalogueValidation.storyPublishError` only demands narration for audio_story,
  // so anything else must warn rather than refuse.
  assert.equal(pictureEntry.severity, 'warning');

  const audio = await call(WORKSPACE_DB({
    [STORY_NEEDLE]: [{
      id: 'story-bird-home', slug: 'bird-home', title_ar: 'بيت الطائر',
      type: 'audio_story', status: 'ready', age_min: 3, age_max: 5,
      default_language: 'ar', languages: '["ar"]', is_free: 1,
      series_id: null, series_title: null, planet_id: null, planet_name: null,
      planet_color: null, visual_style_name: null, content_class: 'production',
      cover_asset_r2_key: null, cover_asset_visibility: null,
      cover_asset_status: null, cover_asset_kind: null,
    }],
  }), '/stories/story-bird-home/workspace');
  const audioEntry = audio.body.data.blockers.find((entry) => entry.key === 'page_2_no_narration_ar');
  assert.equal(audioEntry.severity, 'blocker');
});

test('read-to-me and read-along are separate verdicts', async () => {
  // Page 1 has ready narration and an empty `timing_cues`. That is a complete
  // read-to-me and an empty read-along, and one field cannot stand for both.
  const { body } = await call(WORKSPACE_DB({
    [PAGES_NEEDLE]: [{
      id: 'page-1', page_number: 1, layout: 'full_bleed', transition: 'fade',
      duration_ms: 5480, image_asset_id: 'asset-1', background_asset_id: null,
      image_status: 'ready', image_r2_key: 'public/catalog/p1.jpg',
      image_visibility: 'public', image_kind: 'image',
      image_width: null, image_height: null, image_aspect: null,
      image_mime: null, image_size: null, bubbles_count: 0, updated_at: null,
    }],
    [LOC_NEEDLE]: [{
      page_id: 'page-1', language: 'ar', body_text: 'هذا زُغب.', alt_text: 'عشّ',
      narration_asset_id: 'asset-vo-1', timing_cues: '[]', narration_status: 'ready',
      narration_source: 'generated', narration_size: 1, updated_at: null,
    }],
  }), '/stories/story-bird-home/workspace');

  assert.equal(body.data.readiness.read_to_me_ready, true);
  assert.equal(body.data.readiness.read_along_ready, false);
  assert.equal(body.data.pages[0].localizations[0].has_timing, false);
});

test('a generated narration is not reported as approved', async () => {
  const { body } = await call(WORKSPACE_DB(), '/stories/story-bird-home/workspace');
  const arabic = body.data.pages[0].localizations.find((entry) => entry.language === 'ar');
  // The source is carried through so the editor can tell a TTS render from a
  // recorded, reviewed take. Equating the two would let unreviewed audio ship.
  assert.equal(arabic.narration_source, 'generated');
  assert.equal(arabic.narration_ready, true);
});

test('the workspace states what the schema cannot support', async () => {
  const { body } = await call(WORKSPACE_DB(), '/stories/story-bird-home/workspace');
  const capabilities = body.data.capabilities;

  // Both CHECK constraints omit 'story'. Saying so beats letting an editor find
  // out from a 409 on a panel that should never have been offered.
  assert.equal(capabilities.reviews_supported, false);
  assert.match(capabilities.reviews_reason, /content_reviews/);
  assert.equal(capabilities.rights_supported, false);
  assert.equal(capabilities.timing_supported, false);
  assert.match(capabilities.timing_reason, /timing_cues/);
  // Balloons are real; comic panels are not. The distinction is the honest one.
  assert.equal(capabilities.bubbles_supported, true);
  assert.equal(capabilities.panels_supported, false);
  assert.match(capabilities.panels_reason, /panels/);
});

test('a missing story is a 404 from the workspace', async () => {
  const { status } = await call(fakeDb([]), '/stories/nope/workspace');
  assert.equal(status, 404);
});

/* -------------------------------------------------------------- the reorder */

const REORDER_DB = (pageIds = ['page-1', 'page-2', 'page-3'], options = {}) => fakeDb([
  ['SELECT id, status FROM stories WHERE id = ?', [{ id: 'story-bird-home', status: 'draft' }]],
  ['SELECT id FROM story_pages WHERE story_id = ?', pageIds.map((id) => ({ id }))],
], options);

test('a reorder parks pages on negative numbers before landing them', async () => {
  const db = REORDER_DB();
  const { status, body } = await callAuthorized(db, '/stories/story-bird-home/pages/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: ['page-3', 'page-1', 'page-2'] }),
  });

  assert.equal(status, 200);
  assert.equal(body.data.pages, 3);
  assert.equal(db.batches.length, 1, 'the whole reorder is one batch');

  // Three parks, three lands, one audit row. The parking phase is what makes this
  // survive UNIQUE (story_id, page_number): a negative number cannot collide with
  // a real one, and CHECK (page_number > 0) means a park cannot be left behind.
  const statements = db.batches[0];
  assert.equal(statements.length, 7);
  const parked = statements.slice(0, 3).flatMap((entry) => entry.__args ?? []);
  assert.ok(parked.some((value) => value === -1), 'first page parked at -1');
  assert.ok(parked.some((value) => value === -3), 'third page parked at -3');
});

test('a reorder that is not a permutation of this story writes nothing', async () => {
  for (const order of [
    ['page-1'],                                  // a subset would renumber part of the story
    ['page-1', 'page-2', 'page-9'],              // a foreign id could reorder another story
    ['page-1', 'page-1', 'page-2'],              // a duplicate would collapse two pages
  ]) {
    const db = REORDER_DB();
    const { status } = await callAuthorized(db, '/stories/story-bird-home/pages/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    assert.equal(status, 400, `${JSON.stringify(order)} is refused`);
    assert.equal(db.batches.length, 0, 'nothing was written on a refusal');
  }
});

test('an empty or malformed order is refused before any read', async () => {
  for (const payload of [{}, { order: [] }, { order: 'page-1' }, { order: [1, 2] }]) {
    const db = REORDER_DB();
    const { status } = await callAuthorized(db, '/stories/story-bird-home/pages/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 400);
    assert.equal(db.batches.length, 0);
  }
});

test('a rejected batch reports that nothing was applied', async () => {
  // The failure mode that matters: a half-applied reorder leaves duplicate or
  // missing page numbers. D1 rolls the batch back, and the response must not
  // suggest a partial success.
  const db = REORDER_DB(['page-1', 'page-2', 'page-3'], { rejectBatch: true });
  const { status, body } = await callAuthorized(db, '/stories/story-bird-home/pages/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: ['page-2', 'page-1', 'page-3'] }),
  });
  assert.equal(status, 409);
  assert.match(body.error, /لم يُطبَّق شيء/);
});

test('reordering an unknown story is a 404', async () => {
  const db = fakeDb([['SELECT id FROM story_pages WHERE story_id = ?', []]]);
  const { status } = await callAuthorized(db, '/stories/nope/pages/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: ['page-1'] }),
  });
  assert.equal(status, 404);
});

test('an unauthorised caller cannot reorder', async () => {
  // Mounted without the pre-seed exit, so `requirePermission` must refuse rather
  // than falling through to the handler.
  const db = REORDER_DB();
  const { status } = await call(db, '/stories/story-bird-home/pages/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: ['page-1', 'page-2', 'page-3'] }),
  });
  assert.equal(status, 401);
  assert.equal(db.batches.length, 0);
});
