import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  emptyPublishedSeasons,
  seasonCountContradictions,
  seasonEpisodeCounts,
  seasonEpisodeCountSelect,
  withSeasonEpisodeCounts,
} from '../src/lib/episodeCounts.ts';
import { evaluatePublishGate } from '../src/lib/publishGate.ts';

/// Season episode counts (CONTENT-003).
///
/// ## The defect these tests pin
///
/// `seasons.episode_count` was written by the seed generators as a *planned* unit
/// count and could be typed over by any operator, but every screen and the public
/// series payload rendered it as the number of episodes. 17 seasons therefore
/// advertised 91 episodes that had no rows behind them.
///
/// The fix is not a data edit — it is that the number of episodes is now derived
/// from episode rows everywhere it is read, the planning figure is named for what
/// it is, and the publish gate refuses a published season that claims more than
/// it holds.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/* ------------------------------------------------- the derived counts */

test('a count is derived from canonical rows, not from the planning column', () => {
  const counts = seasonEpisodeCounts({
    episode_count: 8, total_episodes: 3, published_episodes: 2, available_episodes: 0,
  });
  assert.equal(counts.planned_episode_count, 8);
  assert.equal(counts.total_episodes, 3);
  assert.equal(counts.published_episodes, 2);
  // Two episodes are published and neither has a video source: "published" and
  // "watchable" are different facts, and the platform currently has zero videos.
  assert.equal(counts.available_episodes, 0);
});

test('draft and published episodes are counted separately', () => {
  // Six rows, two published: a season list must be able to say both numbers
  // without one standing in for the other.
  const counts = seasonEpisodeCounts({
    episode_count: 6, total_episodes: 6, published_episodes: 2, available_episodes: 1,
  });
  assert.equal(counts.total_episodes, 6);
  assert.equal(counts.published_episodes, 2);
  assert.equal(counts.total_episodes - counts.published_episodes, 4, 'four remain unpublished');
});

test('a season with no episodes reports zero however large the plan is', () => {
  // This is the exact shape of all 17 affected seasons.
  const counts = seasonEpisodeCounts({
    episode_count: 12, total_episodes: 0, published_episodes: 0, available_episodes: 0,
  });
  assert.equal(counts.planned_episode_count, 12);
  assert.equal(counts.total_episodes, 0);
});

test('missing or corrupt count columns resolve to zero, never to the plan', () => {
  const counts = seasonEpisodeCounts({ episode_count: 5 });
  assert.equal(counts.total_episodes, 0);
  assert.equal(counts.published_episodes, 0);
  const negative = seasonEpisodeCounts({ episode_count: -3, total_episodes: 'x' });
  assert.equal(negative.planned_episode_count, 0);
  assert.equal(negative.total_episodes, 0);
});

test('the raw column never survives into a response payload', () => {
  const payload = withSeasonEpisodeCounts({
    id: 'season-1', title_ar: 'الموسم الأول', episode_count: 8,
    total_episodes: 0, published_episodes: 0, available_episodes: 0,
  });
  assert.equal('episode_count' in payload, false, 'the misleading key must be gone');
  assert.equal(payload.planned_episode_count, 8);
  assert.equal(payload.total_episodes, 0);
  assert.equal(payload.title_ar, 'الموسم الأول', 'unrelated fields are preserved');
});

test('the derived SQL excludes archived rows and requires a video for availability', () => {
  const sql = seasonEpisodeCountSelect('se');
  // An archived episode is not content the season contains.
  assert.match(sql, /total_episodes/);
  assert.match(sql, /e\.status <> 'archived'/);
  // Published means both the status and the flag, because the catalogue reads
  // require both and a count that disagreed with the read would be a new lie.
  assert.match(sql, /e\.status = 'published' AND e\.is_published = 1/);
  // Availability requires an actual media source.
  assert.match(sql, /video_master_url/);
  assert.match(sql, /video_hls_1080/);
});

/* --------------------------------- episodes moving, archiving, unpublishing */

test('moving an episode to another season moves the count with it', () => {
  // The counts are correlated sub-selects on `episodes.season_id`, so a move is
  // reflected by both seasons on the next read with nothing to recompute. This is
  // the property a stored counter cannot have: it is exactly how the 17 seasons
  // drifted.
  const sql = seasonEpisodeCountSelect('se');
  assert.match(sql, /WHERE e\.season_id = se\.id/);
  assert.equal(
    sql.includes('seasons.episode_count'), false,
    'no derived count may read the stored planning column',
  );
});

test('archiving an episode lowers the total; unpublishing lowers only the published count', () => {
  const before = seasonEpisodeCounts({
    episode_count: 4, total_episodes: 4, published_episodes: 4, available_episodes: 0,
  });
  // Unpublish one: still four rows, three served.
  const unpublished = seasonEpisodeCounts({
    episode_count: 4, total_episodes: 4, published_episodes: 3, available_episodes: 0,
  });
  // Archive that one: three rows, three served.
  const archived = seasonEpisodeCounts({
    episode_count: 4, total_episodes: 3, published_episodes: 3, available_episodes: 0,
  });
  assert.equal(before.total_episodes, 4);
  assert.equal(unpublished.total_episodes, 4, 'unpublishing does not remove the row');
  assert.equal(unpublished.published_episodes, 3);
  assert.equal(archived.total_episodes, 3, 'archiving removes it from the total');
  // The plan never moves in response to any of this, which is why it must not be
  // read as a count.
  assert.equal(archived.planned_episode_count, before.planned_episode_count);
});

/* ------------------------------------------------------ the contradiction */

test('only an excess plan is a contradiction', () => {
  const gaps = seasonCountContradictions([
    { season_id: 's1', season_number: 1, title_ar: null, status: 'published', planned_episode_count: 8, total_episodes: 3, published_episodes: 3, available_episodes: 0 },
    // Overachieved: six episodes against a plan of four promises nothing false.
    { season_id: 's2', season_number: 2, title_ar: null, status: 'draft', planned_episode_count: 4, total_episodes: 6, published_episodes: 0, available_episodes: 0 },
    // Exact match.
    { season_id: 's3', season_number: 3, title_ar: null, status: 'draft', planned_episode_count: 2, total_episodes: 2, published_episodes: 0, available_episodes: 0 },
    // Archived seasons advertise nothing.
    { season_id: 's4', season_number: 4, title_ar: null, status: 'archived', planned_episode_count: 9, total_episodes: 0, published_episodes: 0, available_episodes: 0 },
  ]);
  assert.deepEqual(gaps.map((gap) => gap.season_id), ['s1']);
  assert.equal(gaps[0].missing, 5);
});

test('an empty published season is found even when its plan is zero', () => {
  const empty = emptyPublishedSeasons([
    { season_id: 's1', season_number: 1, title_ar: null, status: 'published', planned_episode_count: 0, total_episodes: 0, published_episodes: 0, available_episodes: 0 },
    { season_id: 's2', season_number: 2, title_ar: null, status: 'draft', planned_episode_count: 0, total_episodes: 0, published_episodes: 0, available_episodes: 0 },
  ]);
  // A plan of zero is not the problem; a published season with no episodes is.
  assert.deepEqual(empty.map((season) => season.season_id), ['s1']);
});

/* ---------------------------------------------------------- publish gate */

const season = (overrides) => ({
  season_id: 'season-1', season_number: 1, title_ar: 'الموسم الأول', status: 'draft',
  planned_episode_count: 0, total_episodes: 0, published_episodes: 0, available_episodes: 0,
  ...overrides,
});

/// A series that passes every unrelated series rule, so a failure in these tests
/// can only come from the season rule.
const seriesFacts = (overrides = {}) => ({
  entity_type: 'series',
  entity_id: 'series-1',
  status: 'ready',
  is_test_fixture: false,
  reviews: [
    { role: 'edu', status: 'approved', reviewer_id: 'r1', decided_at: '2026-01-01' },
    { role: 'lang', status: 'approved', reviewer_id: 'r2', decided_at: '2026-01-01' },
    { role: 'qa', status: 'approved', reviewer_id: 'r3', decided_at: '2026-01-01' },
  ],
  reviews_supported: true,
  rights: [],
  rights_supported: true,
  assets: [],
  today: '2026-08-15',
  workflow: { run_id: 'run-1', blockers: [], total_blocking_stages: 3 },
  planet_id: 'oloom',
  source_type: null,
  religious_reviewer_id: null,
  religious_approved_at: null,
  cover_url: 'https://example.test/cover.webp',
  visual_style_id: 'style-1',
  description_ar: 'وصف',
  episode_count: 3,
  published_episode_count: 3,
  ...overrides,
});

const finding = (result, id) => result.findings.find((item) => item.id === id);

test('a published season claiming episodes it does not have blocks the series', () => {
  const result = evaluatePublishGate(seriesFacts({
    seasons: [season({ status: 'published', planned_episode_count: 8, total_episodes: 3, published_episodes: 3 })],
  }));
  const gap = finding(result, 'season_counts');
  assert.equal(gap.status, 'blocked');
  assert.equal(gap.severity, 'blocker');
  assert.equal(result.publishable, false);
  // The refusal must name the season and the shortfall, or an operator cannot act
  // on it.
  assert.match(gap.items[0], /الموسم 1/);
  assert.match(gap.items[0], /ناقص 5/);
  assert.equal(gap.owner, 'publisher');
});

test('the same gap on an unpublished season warns instead of blocking', () => {
  // Work in progress is the normal state of a plan; refusing it would make every
  // series unpublishable while its later seasons are still being written.
  const result = evaluatePublishGate(seriesFacts({
    seasons: [season({ status: 'production', planned_episode_count: 8, total_episodes: 3 })],
  }));
  const gap = finding(result, 'season_counts');
  assert.equal(gap.status, 'warn');
  assert.equal(gap.severity, 'warning');
  assert.equal(result.publishable, true, 'a warning must not block');
  assert.equal(gap.owner, 'editor');
});

test('a published season with zero episodes is a separate blocker', () => {
  const result = evaluatePublishGate(seriesFacts({
    seasons: [season({ status: 'published', planned_episode_count: 0, total_episodes: 0 })],
  }));
  const empty = finding(result, 'empty_published_seasons');
  assert.equal(empty.status, 'blocked');
  assert.equal(result.publishable, false);
  assert.match(empty.items[0], /season-1/);
});

test('seasons that contain what they planned pass', () => {
  const result = evaluatePublishGate(seriesFacts({
    seasons: [
      season({ status: 'published', planned_episode_count: 3, total_episodes: 3, published_episodes: 3 }),
      season({ season_id: 'season-2', season_number: 2, status: 'draft', planned_episode_count: 2, total_episodes: 4 }),
    ],
  }));
  assert.equal(finding(result, 'season_counts').status, 'pass');
  assert.equal(finding(result, 'empty_published_seasons'), undefined);
});

test('a series with no seasons, and one evaluated without season facts, are distinguished', () => {
  const none = evaluatePublishGate(seriesFacts({ seasons: [] }));
  assert.equal(finding(none, 'season_counts').status, 'not_applicable');
  assert.match(finding(none, 'season_counts').detail, /لا مواسم/);

  // Absent facts must not read as "verified fine".
  const unknown = evaluatePublishGate(seriesFacts());
  assert.equal(finding(unknown, 'season_counts').status, 'not_applicable');
  assert.match(finding(unknown, 'season_counts').detail, /لم تُقدَّم/);
});

/* -------------------------------------------------- the surfaces, by source */

test('the public series payload no longer selects the planning column', () => {
  const source = read('src/routes/series.ts');
  const detail = source.slice(source.indexOf('FROM seasons se'), source.indexOf('FROM characters'));
  assert.equal(
    /se\.episode_count/.test(detail), false,
    'a child-facing payload must not carry an editorial planning figure',
  );
  assert.match(source, /seasonEpisodeCountSelect\('se'\)/);
});

test('every admin season read goes through the shared derivation', () => {
  for (const file of ['src/routes/adminContent.ts', 'src/routes/adminCatalogue.ts']) {
    const source = read(file);
    assert.match(source, /withSeasonEpisodeCounts/, `${file} must strip the raw column`);
    assert.match(source, /seasonEpisodeCountSelect\('se'\)/, `${file} must derive the counts`);
  }
});

test('the publish gate loads season facts for a series', () => {
  const source = read('src/routes/adminPublishGate.ts');
  assert.match(source, /FROM seasons se WHERE se\.series_id = \?/);
  assert.match(source, /seasons: seasonRows\.map/);
});

test('writing episode_count is refused, and the planning figure has its own field', () => {
  const source = read('src/routes/adminContent.ts');
  // Refused rather than aliased: a caller sending `episode_count` believed it was
  // setting a number of episodes, and silently storing that as a plan would carry
  // the misunderstanding into the write path.
  assert.match(source, /if \(value\.episode_count !== undefined\) return null/);
  assert.match(source, /value\.planned_episode_count/);
  assert.match(source, /episode_count is no longer accepted/);
});
