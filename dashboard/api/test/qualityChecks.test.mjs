import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { storyPublishError } from '../src/lib/catalogueValidation.ts';

/// Regression coverage for readiness checks and entity export.
///
/// ## Why this file exists
///
/// `routes/adminBackup.ts` shipped with four logic defects, and no test caught
/// any of them. It was rewritten to fix them — and the rewrite had no test
/// either, which is the same exposure that let the originals survive.
///
/// The four defects:
///
/// 1. **Wrong table.** `type === 'story'` queried `books`, but
///    `story_pages.story_id` references `stories(id)`. A real story id returned
///    404; a book id returned zero pages. The check never worked on valid input.
///
/// 2. **A check that could not fail.** `passed: !!story.cover_asset_id || true`
///    is unconditionally `true`. Worse, neither `books` nor `stories` has a
///    `cover_asset_id` column, so the read was always `undefined`. It reported
///    "غلاف افتراضي" for a column that does not exist.
///
/// 3. **Empty success.** Only `if (type === 'story')` populated `checks`, and
///    `[].every()` is `true`. So `series`, `book`, `game` and `project` returned
///    `readyToPublish: true` having run zero checks.
///
/// 4. **An invented threshold.** "pages >= 4" appears in no publish gate. The
///    real gate requires >= 1 page plus text per page, so the rule blocked
///    valid 3-page stories.
///
/// ## What is asserted, and what is not
///
/// The check functions are module-private, so these tests reach them through
/// the router with a stubbed D1 rather than importing them. That exercises the
/// dispatch in `/quality/:type/:id` too, which is where defect 3 lived.
///
/// The Hono app is built with a fake `env`, so no Workers runtime is needed and
/// the suite stays on plain `node --test`.

const routesDir = fileURLToPath(new URL('../src/routes/', import.meta.url));
const source = readFileSync(routesDir + 'adminBackup.ts', 'utf8');

/// Strips comments before asserting on code.
///
/// Line comments first: a `///` comment containing a path like `/api/v1/admin/*`
/// otherwise pairs its `/*` with a later `*/` and deletes real code between
/// them. That exact ordering bug hid three live routes from an earlier sweep.
function stripComments(text) {
  return text
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

const code = stripComments(source);

/* ------------------------------------------------------------- D1 stub */

/// Minimal D1 stub driven by a matcher list.
///
/// Each entry is `[substring, rows]`. The **most specific** match wins, measured
/// by needle length, so a test only declares the queries it cares about. An
/// unmatched query yields no rows, which models "nothing found" rather than
/// throwing — the same thing D1 does.
///
/// ## Needles must be unique, and why longest-match is not enough
///
/// The localizations query embeds the pages query as a subquery:
///
///   SELECT ... FROM story_page_localizations
///    WHERE page_id IN (SELECT id FROM story_pages WHERE story_id = ?)
///
/// A `'FROM story_pages WHERE story_id = ?'` needle therefore matches *both*
/// queries, so the localizations lookup received page rows. Every page appeared
/// to have no text and a valid story reported as unpublishable — a stub bug that
/// reads exactly like a code defect.
///
/// Longest-match does not rescue that: the ambiguous needle is 35 characters and
/// the specific one (`FROM story_page_localizations`) is 29, so the wrong entry
/// still wins. The fix is that each needle must appear in exactly one query —
/// `image_asset_id FROM story_pages` for the checks path, `SELECT * FROM
/// story_pages` for the export path.
///
/// Longest-match is kept as a tiebreaker so the stub stays insensitive to
/// declaration order, which a test helper needs, but uniqueness is what makes it
/// correct.
function fakeDb(matchers = []) {
  const queries = [];
  const ranked = [...matchers].sort((a, b) => b[0].length - a[0].length);
  return {
    queries,
    prepare(sql) {
      return {
        bind(...params) {
          const run = () => {
            queries.push({ sql, params });
            const hit = ranked.find(([needle]) => sql.includes(needle));
            return hit ? hit[1] : [];
          };
          return {
            async first() {
              const rows = run();
              return rows.length ? rows[0] : null;
            },
            async all() {
              return { results: run() };
            },
            async run() {
              run();
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

/// Builds the router with a stub env and issues one request.
///
/// `requireAdmin` runs for real. With no `ADMIN_API_KEY`, no admin users and
/// `ENVIRONMENT === 'development'` it takes the documented frictionless path, so
/// these tests exercise the handlers rather than the auth guard — which
/// `routeGuards.test.mjs` already covers.
async function call(path, db) {
  const { default: route } = await import('../src/routes/adminBackup.ts');
  const env = {
    DB: db,
    ENVIRONMENT: 'development',
    ADMIN_API_KEY: undefined,
  };
  const response = await route.request(path, {}, env);
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

const check = (report, name) => report.data.checks.find((item) => item.check === name);

/* --------------------------------------------------- defect 1: the table */

test('a story is read from stories, never from books', () => {
  // The mapping is the fix. Asserting on it directly means a future edit that
  // points `story` back at `books` fails here rather than in production.
  assert.match(code, /story:\s*'stories'/);
  assert.match(code, /book:\s*'books'/);

  // story_pages joins on story_id; that is what made the old mapping wrong.
  assert.match(code, /FROM story_pages WHERE story_id = \?/);
});

test('story and book are distinct types, not aliases', async () => {
  // Both must be independently checkable. Treating them as synonyms is what the
  // original code did by routing both to one table.
  const db = fakeDb([
    ['FROM books WHERE id = ?', [{ pages: '[{"n":1}]', visual_style_id: 'style-1' }]],
  ]);
  const book = await call('/quality/book/book-1', db);
  assert.equal(book.status, 200);
  assert.equal(book.body.data.entity_type, 'book');

  // The same id as a story finds nothing, because the tables are separate.
  const missing = await call('/quality/story/book-1', fakeDb());
  assert.equal(missing.status, 404);
});

/* ------------------------------------------- defect 2: unfalsifiable check */

test('no check is hardcoded to pass', () => {
  // `!!x || true` is the specific shape that made the cover check meaningless.
  assert.doesNotMatch(code, /passed:.*\|\|\s*true/);
  // A literal `passed: true` is equally unfalsifiable.
  assert.doesNotMatch(code, /passed:\s*true\s*[,}]/);
});

test('the cover check is gone rather than faked', () => {
  // Neither books nor stories has a cover_asset_id column, so any check reading
  // one was reporting on a field that does not exist. Removing it is correct;
  // asserting its absence stops it being reintroduced.
  assert.doesNotMatch(code, /cover_asset_id/);
});

test('visual style is checked against a column that exists', async () => {
  const withStyle = await call('/quality/story/story-1', fakeDb([
    ['FROM stories WHERE id = ?', [{ type: 'picture_book', default_language: 'ar', visual_style_id: 'style-1' }]],
    ['image_asset_id FROM story_pages', [{ id: 'p1', page_number: 1, image_asset_id: 'a1' }]],
    ['FROM story_page_localizations', [{ page_id: 'p1', language: 'ar', body_text: 'نص', narration_asset_id: null }]],
    ['FROM content_assets', [{ total: 1 }]],
  ]));
  assert.equal(check(withStyle.body, 'visual_style').passed, true);

  // And it must be able to fail, which the cover check never could.
  const withoutStyle = await call('/quality/story/story-1', fakeDb([
    ['FROM stories WHERE id = ?', [{ type: 'picture_book', default_language: 'ar', visual_style_id: null }]],
    ['image_asset_id FROM story_pages', [{ id: 'p1', page_number: 1, image_asset_id: 'a1' }]],
    ['FROM story_page_localizations', [{ page_id: 'p1', language: 'ar', body_text: 'نص', narration_asset_id: null }]],
    ['FROM content_assets', [{ total: 1 }]],
  ]));
  assert.equal(check(withoutStyle.body, 'visual_style').passed, false);
  assert.equal(withoutStyle.body.data.readyToPublish, false);
});

/* ------------------------------------------- defect 3: empty success */

test('every supported type runs at least one check', async () => {
  // `[].every()` is true, so a type with no checks previously reported ready.
  const cases = [
    ['series', '/quality/series/s1', [
      ['FROM series WHERE id = ?', [{ planet_id: 'p1', visual_style_id: 'v1' }]],
      ['FROM episodes WHERE series_id = ?', [{ total: 3 }]],
    ]],
    ['story', '/quality/story/st1', [
      ['FROM stories WHERE id = ?', [{ type: 'picture_book', default_language: 'ar', visual_style_id: 'v1' }]],
      ['image_asset_id FROM story_pages', [{ id: 'p1', page_number: 1, image_asset_id: 'a1' }]],
      ['FROM story_page_localizations', [{ page_id: 'p1', language: 'ar', body_text: 'نص', narration_asset_id: null }]],
      ['FROM content_assets', [{ total: 1 }]],
    ]],
    ['book', '/quality/book/b1', [
      ['FROM books WHERE id = ?', [{ pages: '[{"n":1}]', visual_style_id: 'v1' }]],
    ]],
    ['game', '/quality/game/g1', [
      ['FROM games WHERE id = ?', [{ content_pack: '{"levels":1}', engine_id: 'e1' }]],
    ]],
    ['project', '/quality/project/pr1', [
      ['FROM projects WHERE id = ?', [{ materials: '["ورق"]', steps: '["اطوِ"]' }]],
    ]],
  ];

  for (const [name, path, matchers] of cases) {
    const report = await call(path, fakeDb(matchers));
    assert.equal(report.status, 200, name);
    assert.ok(report.body.data.checks.length > 0, `${name} ran no checks`);
    assert.equal(report.body.data.entity_type, name);
  }
});

test('a failing type reports not ready rather than empty success', async () => {
  // Each non-story type must be able to fail on its own terms.
  const failing = [
    ['series', '/quality/series/s1', [
      ['FROM series WHERE id = ?', [{ planet_id: null, visual_style_id: null }]],
      ['FROM episodes WHERE series_id = ?', [{ total: 0 }]],
    ]],
    ['book', '/quality/book/b1', [
      ['FROM books WHERE id = ?', [{ pages: '[]', visual_style_id: null }]],
    ]],
    ['game', '/quality/game/g1', [
      ['FROM games WHERE id = ?', [{ content_pack: '{}', engine_id: null }]],
    ]],
    ['project', '/quality/project/pr1', [
      ['FROM projects WHERE id = ?', [{ materials: '[]', steps: '[]' }]],
    ]],
  ];

  for (const [name, path, matchers] of failing) {
    const report = await call(path, fakeDb(matchers));
    assert.equal(report.body.data.readyToPublish, false, `${name} should not be ready`);
    assert.ok(
      report.body.data.checks.some((item) => !item.passed),
      `${name} reported ready with no failing check`,
    );
  }
});

/* ------------------------------------------- defect 4: the invented rule */

test('the four-page threshold is gone', () => {
  // No publish gate mentions four pages. The rule blocked valid short stories.
  assert.doesNotMatch(code, />=\s*4/);
  assert.doesNotMatch(code, /\/4/);
});

test('a three-page story is publishable, matching the real gate', async () => {
  const pages = [1, 2, 3].map((n) => ({ id: `p${n}`, page_number: n, image_asset_id: `a${n}` }));
  const report = await call('/quality/story/story-1', fakeDb([
    ['FROM stories WHERE id = ?', [{ type: 'picture_book', default_language: 'ar', visual_style_id: 'v1' }]],
    ['image_asset_id FROM story_pages', pages],
    ['FROM story_page_localizations', pages.map((p) => ({
      page_id: p.id, language: 'ar', body_text: 'نص', narration_asset_id: null,
    }))],
    ['FROM content_assets', [{ total: 3 }]],
  ]));

  assert.equal(report.body.data.readyToPublish, true);
  assert.equal(check(report.body, 'pages_and_text').passed, true);

  // The check must agree with the gate the server actually enforces on publish.
  assert.equal(
    storyPublishError(
      pages.map((p) => ({
        page_number: p.page_number,
        image_asset_id: p.image_asset_id,
        localizations: [{ language: 'ar', body_text: 'نص', narration_asset_id: null }],
      })),
      'picture_book',
      'ar',
    ),
    null,
  );
});

test('readiness delegates to the shared publish gate', () => {
  // A parallel ruleset is how the four defects arose. The check must call the
  // same function `PATCH /stories/:id` calls, so both verdicts always agree.
  assert.match(code, /storyPublishError\(/);
  // The extension is optional: wrangler resolves either form, and this suite
  // needs the explicit `.ts`. Matching both keeps the assertion about *where*
  // the gate comes from rather than about import spelling.
  assert.match(source, /from '\.\.\/lib\/catalogueValidation(\.ts)?'/);
});

/* --------------------------------------------------------- story specifics */

test('a story with no pages is not publishable', async () => {
  const report = await call('/quality/story/story-1', fakeDb([
    ['FROM stories WHERE id = ?', [{ type: 'picture_book', default_language: 'ar', visual_style_id: 'v1' }]],
  ]));
  assert.equal(report.body.data.readyToPublish, false);
  assert.equal(check(report.body, 'pages_and_text').passed, false);
  // page_images must also fail: zero pages is not "all pages have images".
  assert.equal(check(report.body, 'page_images').passed, false);
});

test('a page missing its image names the page number', async () => {
  const report = await call('/quality/story/story-1', fakeDb([
    ['FROM stories WHERE id = ?', [{ type: 'picture_book', default_language: 'ar', visual_style_id: 'v1' }]],
    ['image_asset_id FROM story_pages', [
      { id: 'p1', page_number: 1, image_asset_id: 'a1' },
      { id: 'p2', page_number: 2, image_asset_id: null },
    ]],
    ['FROM story_page_localizations', [
      { page_id: 'p1', language: 'ar', body_text: 'نص', narration_asset_id: null },
      { page_id: 'p2', language: 'ar', body_text: 'نص', narration_asset_id: null },
    ]],
  ]));

  const images = check(report.body, 'page_images');
  assert.equal(images.passed, false);
  // The message carries the cause, not just a verdict: an operator needs to
  // know which page to fix.
  assert.match(images.message, /2/);
});

test('an unready image asset blocks publication', async () => {
  const report = await call('/quality/story/story-1', fakeDb([
    ['FROM stories WHERE id = ?', [{ type: 'picture_book', default_language: 'ar', visual_style_id: 'v1' }]],
    ['image_asset_id FROM story_pages', [{ id: 'p1', page_number: 1, image_asset_id: 'a1' }]],
    ['FROM story_page_localizations', [{ page_id: 'p1', language: 'ar', body_text: 'نص', narration_asset_id: null }]],
    // Asset exists but is not status='ready', so the count comes back short.
    ['FROM content_assets', [{ total: 0 }]],
  ]));
  assert.equal(check(report.body, 'page_images').passed, false);
  assert.equal(report.body.data.readyToPublish, false);
});

test('an audio story needs narration, not just text', async () => {
  // The gate treats audio_story differently because its pages are heard.
  const report = await call('/quality/story/story-1', fakeDb([
    ['FROM stories WHERE id = ?', [{ type: 'audio_story', default_language: 'ar', visual_style_id: 'v1' }]],
    ['image_asset_id FROM story_pages', [{ id: 'p1', page_number: 1, image_asset_id: 'a1' }]],
    ['FROM story_page_localizations', [{ page_id: 'p1', language: 'ar', body_text: 'نص', narration_asset_id: null }]],
    ['FROM content_assets', [{ total: 1 }]],
  ]));
  assert.equal(check(report.body, 'pages_and_text').passed, false);
});

/* ------------------------------------------------------- malformed columns */

test('a corrupt JSON column fails the check instead of the request', async () => {
  // `pages` is TEXT. One bad row must not turn a readiness answer into a 500.
  const report = await call('/quality/book/book-1', fakeDb([
    ['FROM books WHERE id = ?', [{ pages: '{not json', visual_style_id: 'v1' }]],
  ]));
  assert.equal(report.status, 200);
  assert.equal(check(report.body, 'pages').passed, false);
});

test('a JSON array in content_pack is rejected as a pack', async () => {
  // The gate requires a non-empty object. An array parses but drives nothing.
  const report = await call('/quality/game/game-1', fakeDb([
    ['FROM games WHERE id = ?', [{ content_pack: '[]', engine_id: 'e1' }]],
  ]));
  assert.equal(check(report.body, 'content_pack').passed, false);
});

/* ------------------------------------------------------------ type guard */

test('an unknown type is refused with the valid list', async () => {
  const report = await call('/quality/planet/p1', fakeDb());
  assert.equal(report.status, 400);
  // Naming the accepted types is what turns a 400 into a usable message.
  for (const name of ['series', 'story', 'book', 'game', 'project']) {
    assert.match(report.body.error, new RegExp(name));
  }
});

test('the type list is derived from the table map, not written twice', () => {
  // Two hand-maintained lists drift; the error message would then name a type
  // the dispatch does not handle.
  assert.match(code, /Object\.keys\(ENTITY_TABLES\)/);
});

test('a missing entity is a 404, not a failed check', async () => {
  // "Does not exist" and "exists but is not ready" are different answers.
  for (const path of ['/quality/series/x', '/quality/story/x', '/quality/book/x', '/quality/game/x', '/quality/project/x']) {
    const report = await call(path, fakeDb());
    assert.equal(report.status, 404, path);
  }
});

/* ---------------------------------------------------------------- export */

test('export covers all five types', async () => {
  const cases = [
    ['series', '/backup/series/s1', [['FROM series WHERE id = ?', [{ id: 's1' }]]]],
    ['story', '/backup/story/st1', [['FROM stories WHERE id = ?', [{ id: 'st1' }]]]],
    ['book', '/backup/book/b1', [['FROM books WHERE id = ?', [{ id: 'b1' }]]]],
    ['game', '/backup/game/g1', [['FROM games WHERE id = ?', [{ id: 'g1' }]]]],
    ['project', '/backup/project/pr1', [['FROM projects WHERE id = ?', [{ id: 'pr1' }]]]],
  ];
  for (const [name, path, matchers] of cases) {
    const report = await call(path, fakeDb(matchers));
    assert.equal(report.status, 200, name);
    assert.equal(report.body.data.entity_type, name);
    assert.equal(report.body.data.version, 1);
    assert.ok(report.body.data.exported_at, 'exported_at is missing');
  }
});

test('a story export carries page text', async () => {
  // Without localizations the file holds no story text at all: a backup with no
  // content. The original export omitted them entirely.
  const report = await call('/backup/story/story-1', fakeDb([
    ['FROM stories WHERE id = ?', [{ id: 'story-1', title_ar: 'قصة' }]],
    // The export path selects every column, so its needle differs from the
    // checks path (`image_asset_id FROM story_pages`). Both must stay unique:
    // `FROM story_pages WHERE story_id = ?` alone also matches the
    // localizations subquery.
    ['SELECT * FROM story_pages', [{ id: 'p1', page_number: 1 }]],
    ['FROM story_page_localizations', [{ page_id: 'p1', language: 'ar', body_text: 'نص الصفحة' }]],
  ]));

  assert.equal(report.status, 200);
  assert.equal(report.body.data.pages.length, 1);
  assert.equal(report.body.data.pages[0].localizations.length, 1);
  assert.equal(report.body.data.pages[0].localizations[0].body_text, 'نص الصفحة');
});

test('a series export carries its episodes', async () => {
  const report = await call('/backup/series/series-1', fakeDb([
    ['FROM series WHERE id = ?', [{ id: 'series-1' }]],
    ['FROM episodes WHERE series_id = ?', [{ id: 'e1', episode_number: 1 }]],
  ]));
  assert.equal(report.body.data.episodes.length, 1);
});

test('export refuses an unknown type and a missing entity', async () => {
  const badType = await call('/backup/planet/p1', fakeDb());
  assert.equal(badType.status, 400);

  const missing = await call('/backup/story/nope', fakeDb());
  assert.equal(missing.status, 404);
});

/* --------------------------------------------------------------- restore */

test('restore refuses explicitly instead of reporting a false success', async () => {
  // It used to return `{ restored: true }` without writing anything, so an
  // operator could delete a source believing a restore had happened.
  const { default: route } = await import('../src/routes/adminBackup.ts');
  const response = await route.request(
    '/restore',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'story', id: 'x' }) },
    { DB: fakeDb(), ENVIRONMENT: 'development' },
  );
  assert.equal(response.status, 501);
  const body = await response.json();
  assert.equal(body.success, false);

  assert.doesNotMatch(code, /restored:\s*true/);
});
