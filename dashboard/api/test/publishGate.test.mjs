/// Tests for the centralized publish gate.
///
/// Two properties are pinned here, and they fail for different reasons.
///
/// 1. **The rules**: every blocker is reported at once, each with an owner and an
///    action, and the blocker/warning split is the one the product needs — Arabic
///    and safety and rights block, secondary languages and nice-to-haves warn.
///
/// 2. **The wiring**: the publish operations actually consult the gate. A gate the
///    UI calls and the API ignores is decoration, and that exact shape existed
///    before this change: `SeriesPage` showed quality findings in a confirm dialog
///    while `POST /admin/series/:id/publish` published anything. Rule tests cannot
///    catch that; only an assertion about the route source can.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { evaluatePublishGate, summarizeGate } from '../src/lib/publishGate.ts';

const find = (result, id) => result.findings.find((finding) => finding.id === id);
const ids = (list) => list.map((finding) => finding.id).sort();

const common = (overrides = {}) => ({
  status: 'ready',
  is_test_fixture: false,
  reviews: [],
  reviews_supported: true,
  rights: [],
  rights_supported: true,
  assets: [],
  today: '2026-08-09',
  ...overrides,
});

const seriesFacts = (overrides = {}) => ({
  entity_type: 'series',
  entity_id: 'series-1',
  ...common(),
  planet_id: 'qisas',
  source_type: null,
  religious_reviewer_id: null,
  religious_approved_at: null,
  cover_url: 'https://cdn.majarra.app/series/cover.webp',
  visual_style_id: 'style-1',
  description_ar: 'وصف',
  episode_count: 4,
  published_episode_count: 2,
  ...overrides,
});

const episodeFacts = (overrides = {}) => ({
  entity_type: 'episode',
  entity_id: 'episode-1',
  ...common(),
  series_id: 'series-1',
  series_status: 'published',
  planet_id: 'qisas',
  source_type: null,
  religious_approved_at: null,
  video_master_url: 'https://media/ep1.mp4',
  video_hls_1080: null,
  thumbnail_url: 'https://thumbs/ep1.webp',
  duration_seconds: 420,
  captions_ar_url: 'https://media/ep1.ar.vtt',
  dubs: ['ar'],
  learning_objective_id: 'objective-1',
  ...overrides,
});

const page = (number, overrides = {}) => ({
  page_number: number,
  image_asset_id: `asset-page-${number}`,
  image_status: 'ready',
  localizations: [
    { language: 'ar', body_text: 'نص', narration_asset_id: `narration-${number}`, narration_status: 'ready' },
  ],
  ...overrides,
});

const storyFacts = (overrides = {}) => ({
  entity_type: 'story',
  entity_id: 'story-1',
  ...common({ reviews_supported: false, rights_supported: false }),
  story_type: 'picture_book',
  default_language: 'ar',
  declared_languages: ['ar'],
  visual_style_id: 'style-1',
  series_id: 'series-1',
  series_status: 'published',
  pages: [page(1), page(2)],
  assets: [{ role: 'cover', asset_id: 'asset-cover', status: 'ready', language: '' }],
  ...overrides,
});

// --- Series ----------------------------------------------------------------

test('a finished series is publishable, and its warnings are still reported', () => {
  const result = evaluatePublishGate(seriesFacts());
  assert.equal(result.publishable, true);
  assert.deepEqual(result.blockers, []);
  // No rights record is a warning, not a blocker: most seeded rows have none and
  // the honest statement is "we do not know", not "we know it is forbidden".
  assert.deepEqual(ids(result.warnings), ['review_edu', 'review_lang', 'review_qa', 'rights']);
});

test('every series blocker is returned at once, each with an owner and an action', () => {
  const result = evaluatePublishGate(seriesFacts({
    cover_url: null,
    episode_count: 0,
    published_episode_count: 0,
    reviews: [{ role: 'lang', status: 'rejected' }],
  }));
  assert.equal(result.publishable, false);
  assert.deepEqual(ids(result.blockers), ['cover', 'episodes', 'review_lang']);
  for (const blocker of result.blockers) {
    assert.ok(blocker.owner, `${blocker.id} has no owner`);
    assert.ok(blocker.required_action, `${blocker.id} has no required action`);
    assert.notEqual(blocker.detail, '', `${blocker.id} has no detail`);
  }
});

test('a test fixture can never be published', () => {
  const result = evaluatePublishGate(seriesFacts({ is_test_fixture: true }));
  assert.equal(find(result, 'content_class').severity, 'blocker');
  assert.equal(result.publishable, false);
});

test('an expired licence blocks, an open-ended one does not', () => {
  const expired = evaluatePublishGate(seriesFacts({
    rights: [{ owner: 'Studio', territories: ['SA'], licenses: ['vod'], expiry: '2026-01-01' }],
  }));
  assert.equal(find(expired, 'rights_expiry').severity, 'blocker');
  assert.match(find(expired, 'rights_expiry').items[0], /Studio/);

  const open = evaluatePublishGate(seriesFacts({
    rights: [{ owner: 'Studio', territories: ['SA'], licenses: ['vod'], expiry: null }],
  }));
  assert.equal(find(open, 'rights_expiry').status, 'pass');
  assert.equal(open.publishable, true);
});

test('an inherited expired licence names the ancestor it came from', () => {
  const result = evaluatePublishGate(episodeFacts({
    rights: [{
      owner: 'Studio', territories: [], licenses: [], expiry: '2020-05-05',
      inherited_from: { type: 'series', id: 'series-1' },
    }],
  }));
  assert.equal(result.publishable, false);
  assert.match(find(result, 'rights_expiry').items[0], /موروث من series/);
});

test('islamic content cannot be published without a recorded religious approval', () => {
  const result = evaluatePublishGate(seriesFacts({ planet_id: 'islamic', source_type: 'hadith' }));
  assert.equal(result.publishable, false);
  assert.equal(find(result, 'religious_review').severity, 'blocker');
  // The sharia decision is a blocker even when absent, unlike edu/lang/qa.
  assert.equal(find(result, 'review_sharia').severity, 'blocker');

  const approved = evaluatePublishGate(seriesFacts({
    planet_id: 'islamic',
    source_type: 'hadith',
    religious_reviewer_id: 'reviewer-7',
    religious_approved_at: '2026-07-01',
    reviews: [{ role: 'sharia', status: 'approved' }],
  }));
  assert.equal(find(approved, 'religious_review').status, 'pass');
  assert.equal(find(approved, 'review_sharia').status, 'pass');
});

test('non-islamic content is not asked for a religious review', () => {
  const result = evaluatePublishGate(seriesFacts());
  assert.equal(find(result, 'religious_review').status, 'not_applicable');
  assert.notEqual(find(result, 'religious_review').detail, '');
});

// --- Episodes --------------------------------------------------------------

test('an episode with no video and no thumbnail reports both, not one', () => {
  const result = evaluatePublishGate(episodeFacts({
    video_master_url: null, video_hls_1080: null, thumbnail_url: null,
  }));
  assert.deepEqual(ids(result.blockers), ['thumbnail', 'video']);
});

test('an episode whose series is unpublished is blocked as unreachable', () => {
  const result = evaluatePublishGate(episodeFacts({ series_status: 'ready' }));
  assert.equal(find(result, 'parent_series').severity, 'blocker');
  assert.match(find(result, 'parent_series').detail, /ready/);
});

test('an unready linked video is not counted as present', () => {
  const result = evaluatePublishGate(episodeFacts({
    video_master_url: null,
    video_hls_1080: null,
    assets: [{ role: 'video', asset_id: 'asset-v', status: 'processing', language: '' }],
  }));
  assert.equal(find(result, 'video').severity, 'blocker');
  assert.match(find(result, 'video').detail, /ليس جاهزًا/);
});

test('a ready linked thumbnail satisfies the thumbnail check without a column value', () => {
  const result = evaluatePublishGate(episodeFacts({
    thumbnail_url: null,
    assets: [{ role: 'thumbnail', asset_id: 'asset-t', status: 'ready', language: '' }],
  }));
  assert.equal(find(result, 'thumbnail').status, 'pass');
});

test('missing arabic voicing blocks while missing captions only warns', () => {
  const result = evaluatePublishGate(episodeFacts({ dubs: ['en'], captions_ar_url: null }));
  assert.equal(find(result, 'dub_ar').severity, 'blocker');
  assert.equal(find(result, 'captions').severity, 'warning');
});

// --- Stories ---------------------------------------------------------------

test('a finished picture book is publishable', () => {
  const result = evaluatePublishGate(storyFacts());
  assert.equal(result.publishable, true);
});

test('a story reports every unillustrated and untexted page together', () => {
  const result = evaluatePublishGate(storyFacts({
    pages: [
      page(1, { image_asset_id: null, image_status: null }),
      page(2, { image_status: 'processing' }),
      page(3, { localizations: [{ language: 'ar', body_text: null, narration_asset_id: null, narration_status: null }] }),
    ],
  }));
  assert.equal(result.publishable, false);
  assert.deepEqual(ids(result.blockers), ['page_images', 'page_text']);
  assert.deepEqual(find(result, 'page_images').items, ['صفحة 1: بلا رسم', 'صفحة 2: الأصل processing']);
  assert.deepEqual(find(result, 'page_text').items, ['صفحة 3']);
});

test('narration blocks an audio story and warns elsewhere', () => {
  const silent = [page(1, {
    localizations: [{ language: 'ar', body_text: 'نص', narration_asset_id: null, narration_status: null }],
  })];
  const audio = evaluatePublishGate(storyFacts({ story_type: 'audio_story', pages: silent }));
  assert.equal(find(audio, 'narration').severity, 'blocker');

  const picture = evaluatePublishGate(storyFacts({ pages: silent }));
  assert.equal(find(picture, 'narration').severity, 'warning');
  assert.equal(picture.publishable, true);
});

test('a declared language with missing pages warns and names the language', () => {
  const result = evaluatePublishGate(storyFacts({
    declared_languages: ['ar', 'fr'],
  }));
  const finding = find(result, 'translations');
  assert.equal(finding.severity, 'warning');
  assert.equal(finding.owner, 'translator');
  assert.deepEqual(finding.items, ['fr: 2 صفحة ناقصة']);
  assert.equal(result.publishable, true);
});

test('a story is not blamed for a review row the schema forbids', () => {
  const result = evaluatePublishGate(storyFacts());
  const finding = find(result, 'reviews');
  assert.equal(finding.status, 'not_applicable');
  assert.match(finding.detail, /content_reviews/);
  assert.equal(find(result, 'rights').status, 'not_applicable');
});

test('an empty story reports only that, without cascading page noise', () => {
  const result = evaluatePublishGate(storyFacts({ pages: [] }));
  assert.deepEqual(ids(result.blockers), ['pages']);
});

// --- Books and projects ----------------------------------------------------

test('a book with no pages and an incoherent language set reports both', () => {
  const result = evaluatePublishGate({
    entity_type: 'book',
    entity_id: 'book-1',
    ...common(),
    pages: '[]',
    languages: '["ar"]',
    default_language: 'fr',
  });
  assert.deepEqual(ids(result.blockers), ['languages', 'pages']);
  assert.match(find(result, 'languages').detail, /default_language/);
});

test('a project needing supervision must say what the risk is', () => {
  const result = evaluatePublishGate({
    entity_type: 'project',
    entity_id: 'project-1',
    ...common(),
    materials: '["ورق"]',
    steps: '["اقطع"]',
    supervision_level: 'required',
    safety_notes: null,
    cover_url: null,
  });
  assert.equal(find(result, 'safety').severity, 'blocker');
  assert.equal(find(result, 'cover').severity, 'warning');
});

// --- Games -----------------------------------------------------------------

test('game findings come from the engine readiness verbatim, not a second opinion', () => {
  const result = evaluatePublishGate({
    entity_type: 'game',
    entity_id: 'game-1',
    ...common(),
    readiness: {
      publishable: false,
      blocking_reasons: ['الصوت: تسجيل ناقص'],
      checks: [
        { id: 'engine', label_ar: 'المحرّك', status: 'pass', detail: 'trace_color' },
        { id: 'audio', label_ar: 'الصوت', status: 'blocked', detail: 'تسجيل ناقص', owner: 'production', items: ['asset-a'] },
        { id: 'touch_targets', label_ar: 'هدف اللمس', status: 'warn', detail: 'غير مُعلَن', owner: 'editor' },
      ],
    },
  });
  assert.equal(result.publishable, false);
  assert.deepEqual(ids(result.blockers), ['engine_audio']);
  assert.equal(find(result, 'engine_audio').owner, 'production');
  assert.deepEqual(find(result, 'engine_audio').items, ['asset-a']);
  assert.equal(find(result, 'engine_touch_targets').severity, 'warning');
  // The shared catalogue checks are added on top rather than replacing them.
  assert.ok(find(result, 'content_class'));
  assert.ok(find(result, 'rights'));
});

// --- Summary ---------------------------------------------------------------

test('the audit summary names the blockers rather than counting them', () => {
  const blocked = evaluatePublishGate(seriesFacts({ cover_url: null, episode_count: 0 }));
  const summary = summarizeGate(blocked);
  assert.match(summary, /cover/);
  assert.match(summary, /episodes/);
  assert.doesNotMatch(summary, /^2 blockers$/);

  const clean = evaluatePublishGate(seriesFacts({
    reviews: [
      { role: 'edu', status: 'approved' }, { role: 'lang', status: 'approved' }, { role: 'qa', status: 'approved' },
    ],
    rights: [{ owner: 'Majarra', territories: ['*'], licenses: ['all'], expiry: null }],
  }));
  assert.equal(summarizeGate(clean), 'publishable');
});

// --- Wiring ----------------------------------------------------------------

const routesDir = fileURLToPath(new URL('../src/routes/', import.meta.url));
const adminSource = readFileSync(`${routesDir}admin.ts`, 'utf8');

/// Comments are stripped before asserting on code: prose describing the defect
/// otherwise reads as the defect, and prose describing the fix otherwise passes
/// for the fix.
const stripComments = (source) => source
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const publishHandler = (entity) => {
  const code = stripComments(adminSource);
  const start = code.indexOf(`adminRoute.post('/${entity}/:id/publish'`);
  assert.notEqual(start, -1, `no publish handler for ${entity}`);
  const end = code.indexOf('\nadminRoute.', start + 1);
  return code.slice(start, end === -1 ? undefined : end);
};

for (const entity of ['series', 'episodes']) {
  test(`the ${entity} publish operation consults the gate and refuses on blockers`, () => {
    const handler = publishHandler(entity);
    assert.match(handler, /await evaluateFor\(/, 'publish does not evaluate readiness');
    assert.match(handler, /gate\.publishable/, 'publish does not branch on the verdict');
    assert.match(handler, /gateRefusal\(gate\)/, 'publish does not return the blocker list');
    assert.match(handler, /409/, 'refusal is not a 409');
    // The refusal itself is audited: an attempt that was blocked is operational
    // information, and losing it means nobody can see that someone tried.
    assert.match(handler, /'publish_blocked'/, 'a blocked publish is not audited');
    // The blocker branch must come before the UPDATE.
    assert.ok(
      handler.indexOf('gateRefusal(gate)') < handler.indexOf('UPDATE'),
      'the gate is evaluated after the write',
    );
  });
}

test('the readiness endpoint is mounted and needs no publish permission to read', () => {
  const gateSource = readFileSync(`${routesDir}adminPublishGate.ts`, 'utf8');
  const code = stripComments(gateSource);
  assert.match(code, /route\.get\('\/publish-readiness\/:type\/:id', requireAdmin/);
  assert.doesNotMatch(code, /publish-readiness[\s\S]{0,120}requirePermission/);
  assert.match(stripComments(adminSource), /adminRoute\.route\('\/', adminPublishGateRoute\)/);
});
