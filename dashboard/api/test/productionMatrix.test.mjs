/// Tests for the production matrix.
///
/// The property being pinned is the one that decides whether a production board is
/// usable: **no state is stored, all of it is derived**. A board that reads
/// `ARTWORK: done` over a story with three unillustrated pages is worse than no board,
/// because people stop checking it — and this dashboard has already removed pages that
/// displayed invented completion figures for exactly that reason.
///
/// The second property is that percentages appear only where a denominator exists. A
/// story's artwork is 3 of 5 pages; an episode's artwork is not a countable set, and
/// filling the column anyway would be the same defect as inventing the status.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  PRODUCTION_REQUIREMENTS,
  productionMatrix,
  summarizeMatrix,
} from '../src/lib/productionMatrix.ts';

const find = (rows, key) => rows.find((row) => row.key === key);

const episode = (overrides = {}) => ({
  content_type: 'episode',
  content_id: 'ep-1',
  title: 'حلقة',
  status: 'production',
  assets: [],
  video_master_url: null,
  video_hls_1080: null,
  thumbnail_url: null,
  captions_ar_url: null,
  dubs: ['ar'],
  learning_objective_id: 'objective-1',
  reviews: [],
  publish_blockers: [],
  publish_evaluated: true,
  ...overrides,
});

const page = (number, overrides = {}) => ({
  page_number: number,
  image_ready: true,
  text_languages: ['ar'],
  narration_languages: ['ar'],
  ...overrides,
});

const story = (overrides = {}) => ({
  content_type: 'story',
  content_id: 'story-1',
  title: 'قصة',
  status: 'production',
  story_type: 'picture_book',
  default_language: 'ar',
  declared_languages: ['ar'],
  assets: [],
  pages: [page(1), page(2), page(3), page(4), page(5)],
  reviews: [{ role: 'qa', status: 'approved' }],
  publish_blockers: [],
  publish_evaluated: true,
  ...overrides,
});

test('every requirement is reported for every item, including the ones that do not apply', () => {
  // Emitting only the applicable requirements would make the response shape depend on
  // the content type, and a board that has to discover which columns exist is a board
  // that will one day fail to show one.
  for (const facts of [episode(), story()]) {
    const rows = productionMatrix(facts);
    assert.deepEqual(rows.map((row) => row.key), [...PRODUCTION_REQUIREMENTS]);
    for (const row of rows) {
      assert.ok(row.detail, `${row.key} has no detail`);
      assert.ok(row.owner_role, `${row.key} has no owner role`);
    }
  }
});

test('an episode reports no artwork percentage because it has no denominator', () => {
  const rows = productionMatrix(episode());
  assert.equal(find(rows, 'artwork').percent, null);
  assert.equal(find(rows, 'artwork').state, 'missing');
});

test('a story reports real percentages from its pages', () => {
  const rows = productionMatrix(story({
    pages: [page(1), page(2), page(3), page(4, { image_ready: false }), page(5, { image_ready: false })],
  }));
  const artwork = find(rows, 'artwork');
  assert.equal(artwork.state, 'partial');
  assert.equal(artwork.percent, 60);
  assert.deepEqual(artwork.items, ['صفحة 4', 'صفحة 5']);
});

test('an undeclared language is not applicable rather than missing', () => {
  // Otherwise every story is permanently incomplete in French.
  const rows = productionMatrix(story());
  assert.equal(find(rows, 'translation_fr').state, 'not_applicable');
  assert.equal(find(rows, 'voice_fr').state, 'not_applicable');

  const declared = productionMatrix(story({ declared_languages: ['ar', 'fr'] }));
  assert.equal(find(declared, 'translation_fr').state, 'missing');
});

test('a story has no video or captions row to fail', () => {
  const rows = productionMatrix(story());
  assert.equal(find(rows, 'video').state, 'not_applicable');
  assert.equal(find(rows, 'captions').state, 'not_applicable');
});

test('an episode video is ready from a column or from a ready asset, and in progress while processing', () => {
  assert.equal(find(productionMatrix(episode({ video_master_url: 'https://m/x.mp4' })), 'video').state, 'ready');
  assert.equal(find(productionMatrix(episode({
    assets: [{ role: 'video', status: 'ready', language: '' }],
  })), 'video').state, 'ready');
  // Linked but unprocessed is not the same as absent, and the operator action differs.
  assert.equal(find(productionMatrix(episode({
    assets: [{ role: 'video', status: 'processing', language: '' }],
  })), 'video').state, 'in_progress');
});

test('a refused review blocks its requirement rather than showing it as pending', () => {
  const rows = productionMatrix(episode({ reviews: [{ role: 'qa', status: 'needs_changes' }] }));
  assert.equal(find(rows, 'qa').state, 'blocked');
  assert.match(find(rows, 'qa').detail, /needs_changes/);
});

test('an episode with no learning objective has nothing for the educational review to judge', () => {
  const rows = productionMatrix(episode({ learning_objective_id: null, reviews: [{ role: 'edu', status: 'approved' }] }));
  assert.equal(find(rows, 'educational').state, 'missing');
  assert.match(find(rows, 'educational').detail, /هدف تعليمي/);
});

test('the publish row reports the real gate verdict', () => {
  const blocked = productionMatrix(episode({ publish_blockers: ['ملف الفيديو: لا ملف', 'الصورة المصغّرة: لا مصغّرة'] }));
  assert.equal(find(blocked, 'publish').state, 'blocked');
  assert.equal(find(blocked, 'publish').items.length, 2);

  const clear = productionMatrix(episode({ publish_blockers: [] }));
  assert.equal(find(clear, 'publish').state, 'in_progress');

  const published = productionMatrix(episode({ status: 'published' }));
  assert.equal(find(published, 'publish').state, 'ready');

  // "We did not evaluate it" must never look like "it passed".
  const unevaluated = productionMatrix(episode({ publish_evaluated: false }));
  assert.equal(find(unevaluated, 'publish').state, 'not_applicable');
});

// --- The human layer -------------------------------------------------------

test('assignment metadata is merged without touching the derived state', () => {
  const rows = productionMatrix(episode({ video_master_url: 'https://m/x.mp4' }), [
    { requirement: 'video', assignee_id: 'user-7', team_id: 'team-1', due_at: '2026-09-01T00:00:00.000Z', blocker: null, note: 'قصّ نهائي' },
  ]);
  const video = find(rows, 'video');
  assert.equal(video.state, 'ready');
  assert.equal(video.assignee_id, 'user-7');
  assert.equal(video.due_at, '2026-09-01T00:00:00.000Z');
  assert.equal(video.note, 'قصّ نهائي');
});

test('a recorded blocker can turn in_progress into blocked but can never hide a finished asset', () => {
  const stuck = productionMatrix(episode({
    assets: [{ role: 'video', status: 'processing', language: '' }],
  }), [{ requirement: 'video', assignee_id: null, team_id: null, due_at: null, blocker: 'الاستوديو متوقف', note: null }]);
  assert.equal(find(stuck, 'video').state, 'blocked');

  // A stale blocker note must not make a delivered asset look undelivered.
  const done = productionMatrix(episode({ video_master_url: 'https://m/x.mp4' }), [
    { requirement: 'video', assignee_id: null, team_id: null, due_at: null, blocker: 'الاستوديو متوقف', note: null },
  ]);
  assert.equal(find(done, 'video').state, 'ready');

  const skipped = productionMatrix(story(), [
    { requirement: 'video', assignee_id: null, team_id: null, due_at: null, blocker: 'x', note: null },
  ]);
  assert.equal(find(skipped, 'video').state, 'not_applicable');
});

// --- Summary ---------------------------------------------------------------

test('completion is measured over applicable requirements only', () => {
  // A story must not be penalised for having no video.
  const rows = productionMatrix(story());
  const summary = summarizeMatrix(rows);
  assert.equal(summary.not_applicable > 0, true);
  assert.ok(summary.percent > 0 && summary.percent <= 100);
});

test('a partial requirement counts as its own fraction, not as half', () => {
  // 9 of 10 illustrated pages is not "half done with artwork".
  const nearly = summarizeMatrix(productionMatrix(story({
    pages: Array.from({ length: 10 }, (_, index) => page(index + 1, { image_ready: index < 9 })),
  })));
  const half = summarizeMatrix(productionMatrix(story({
    pages: Array.from({ length: 10 }, (_, index) => page(index + 1, { image_ready: index < 5 })),
  })));
  assert.ok(nearly.percent > half.percent, `${nearly.percent} should exceed ${half.percent}`);
});

test('an empty story is reported as having no pages rather than as complete', () => {
  const rows = productionMatrix(story({ pages: [] }));
  assert.equal(find(rows, 'script').state, 'missing');
  assert.match(find(rows, 'script').detail, /لا صفحات/);
  assert.equal(summarizeMatrix(rows).percent < 50, true);
});

// --- Wiring ----------------------------------------------------------------

const routeSource = readFileSync(fileURLToPath(new URL('../src/routes/adminProduction.ts', import.meta.url)), 'utf8');
const code = routeSource.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('no endpoint accepts a status for a requirement', () => {
  // The whole design rests on this: if a status could be written, the board could lie.
  assert.doesNotMatch(code, /body\.state/);
  assert.doesNotMatch(code, /body\.status/);
  const migration = readFileSync(fileURLToPath(new URL('../migrations/0032_production_requirements.sql', import.meta.url)), 'utf8');
  assert.doesNotMatch(migration, /\bstatus\b[^\n]*(TEXT|INTEGER)/);
});

test('the publish row is evaluated through the same gate the publish operation enforces', () => {
  assert.match(code, /evaluateFor\(env, type, id\)|evaluateFor\(/);
  assert.match(code, /publish_evaluated/);
});

test('the board is capped and says so', () => {
  assert.match(code, /BOARD_LIMIT/);
  assert.match(code, /board_limit: BOARD_LIMIT/);
  // The default view is the slate in production, not the archive.
  assert.match(code, /status NOT IN \('published', 'archived'\)/);
});

test('assignment writes are audited and validate the assignee exists', () => {
  assert.match(code, /'production_assign'/);
  assert.match(code, /admin_users WHERE id = \? AND is_active = 1/);
  assert.match(code, /requirePermission\('assign_members'\)/);
});

test('story pages and localisations are loaded in bulk, not per story', () => {
  // Twenty forty-page stories would otherwise cost eight hundred queries.
  const pageQueries = (code.match(/FROM story_pages/g) ?? []).length;
  assert.equal(pageQueries, 1, `expected one story_pages query, found ${pageQueries}`);
  const localizationQueries = (code.match(/FROM story_page_localizations/g) ?? []).length;
  assert.equal(localizationQueries, 1);
});
