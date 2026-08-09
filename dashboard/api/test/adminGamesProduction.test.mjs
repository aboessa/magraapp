/// Wiring tests for the four catalogue-wide game endpoints.
///
/// ## Why source-level unit tests are not enough here
///
/// `audioProductionQueue`, `artProductionQueue`, `gameAnalytics` and `gamesOps`
/// are pure and tested directly. What those tests cannot show is that the route
/// gathers the right rows and hands them over in the right shape — and that is
/// where the interesting mistakes live: a games query that forgets `content_pack`,
/// a localization map keyed by the wrong column, a privacy guard wired after the
/// response instead of before it.
///
/// The suite runs on plain `node --test` with no Workers runtime, so D1 is stubbed.
/// The stub supports both a bound statement and an unbound one, because
/// `lib/db.ts` calls `all()` directly when there are no parameters and a stub that
/// only implements `bind()` would fail on exactly those queries.

import test from 'node:test';
import assert from 'node:assert/strict';

import { findPrivacyViolations } from '../src/lib/gameAnalytics.ts';

/// Minimal D1 stub driven by `[substring, rows]` matchers, longest needle first.
///
/// An unmatched query yields no rows, which models "nothing found" the way D1
/// does rather than throwing — so a test only declares the queries it cares about.
function fakeDb(matchers = []) {
  const queries = [];
  const ranked = [...matchers].sort((a, b) => b[0].length - a[0].length);
  const run = (sql, params) => {
    queries.push({ sql, params });
    const hit = ranked.find(([needle]) => sql.includes(needle));
    return hit ? hit[1] : [];
  };
  const statement = (sql, params) => ({
    async first() {
      const rows = run(sql, params);
      return rows.length ? rows[0] : null;
    },
    async all() {
      return { results: run(sql, params) };
    },
    async run() {
      run(sql, params);
      return { meta: { changes: 1 } };
    },
  });
  return {
    queries,
    prepare(sql) {
      return {
        ...statement(sql, []),
        bind: (...params) => statement(sql, params),
      };
    },
  };
}

/// Builds the router with a stub env and issues one request.
///
/// `requireAdmin` runs for real. With no `ADMIN_API_KEY`, no admin users and
/// `ENVIRONMENT === 'development'` it takes the documented frictionless path, so
/// these tests exercise the handlers rather than the guard, which
/// `routeGuards.test.mjs` already covers.
async function call(path, db) {
  const { default: route } = await import('../src/routes/adminGames.ts');
  const env = { DB: db, ENVIRONMENT: 'development', ADMIN_API_KEY: undefined };
  const response = await route.request(path, {}, env);
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

const GAME_ROW = {
  id: 'game-1',
  engine_id: 'count_quantity',
  title_ar: 'هيا نعدّ',
  status: 'draft',
  content_pack: JSON.stringify({
    pack_version: 1,
    engine_id: 'count_quantity',
    localization: 'translatable',
    progression: { levels_to_finish: 1, advance_on: 'level_complete' },
    voice_manifest: { 'vo.intro': 'asset-vo-intro' },
    assets: { images: ['asset-star'] },
    levels: [{
      level: 1,
      mode: 'count_and_pick',
      prompt_key: 'count.prompt',
      scoring: 'discrete',
      items: [{ id: 'i1', image: 'asset-star', items: [{ image: 'asset-star', count: 3 }], options: [3], answer: 3 }],
    }],
    accessibility: { min_touch_target_dp: 64, sequential_tap_alternative: true },
  }),
  learning_objective_id: 'objective-1',
  age_min: 3,
  age_max: 5,
  supervision_level: 'none',
  safety_notes: null,
  translated_from: null,
  content_class: null,
  planet_id: 'planet-arqam',
  planet_name: 'أرقام',
  objective_code: 'num.count.to_ten',
  primary_skill_id: 'counting',
  objective_age_min: 3,
  objective_age_max: 6,
};

const CATALOGUE = [
  ['FROM games g\n      LEFT JOIN series s', [GAME_ROW]],
  ['FROM game_localizations', [{
    game_id: 'game-1', language: 'ar', status: 'ready', title: 'هيا نعدّ',
    instructions: 'عُدّ النجوم', prompts: JSON.stringify({ 'count.prompt': 'عُدّ النجوم، ثم اختر الرقم' }),
    voice_manifest: JSON.stringify({}), is_machine_translated: 0,
  }]],
  ['FROM content_reviews', [{ entity_id: 'game-1', reviewer_role: 'lang', status: 'approved' }]],
  ['FROM content_assets', [{
    id: 'asset-vo-intro', status: 'ready', kind: 'audio', expected_width: null,
    expected_height: null, aspect_ratio: null, language: 'ar', uploaded_by: 'admin-1',
  }]],
  ['FROM asset_links al', [{ entity_id: 'game-1', role: 'cover', asset_id: 'asset-cover', status: null }]],
  ['SELECT entity_id, role, asset_id\n        FROM asset_links', [{ entity_id: 'game-1', role: 'cover', asset_id: 'asset-cover' }]],
  ['FROM game_engines', [{ id: 'count_quantity', mechanics: JSON.stringify({ max_elements_on_screen: 20, engine_version: 1 }) }]],
];

/* ------------------------------------------------------------- audio queue */

test('the audio queue endpoint returns every language and derives the count clips', async () => {
  const response = await call('/games/production/audio', fakeDb(CATALOGUE));
  assert.equal(response.status, 200);
  const data = response.body.data;

  assert.deepEqual(data.languages, ['ar', 'en', 'fr']);
  assert.equal(data.games_covered, 1);

  const countClips = data.rows.filter((row) => row.voice_key.startsWith('vo.count.'));
  // Twenty clips in each of three languages.
  assert.equal(countClips.length, 60);
  assert.ok(countClips.every((row) => row.production_status === 'missing'));

  // The one recorded clip is the only one reported ready, and only in Arabic.
  const ready = data.rows.filter((row) => row.production_status === 'ready');
  assert.equal(ready.length, 1);
  assert.equal(ready[0].voice_key, 'vo.intro');
  assert.equal(ready[0].language, 'ar');
  assert.equal(ready[0].asset_id, 'asset-vo-intro');

  // The instruction script comes from the translation the editor wrote.
  const instruction = data.rows.find((row) => row.language === 'ar' && row.voice_key === 'vo.instruction' && row.level === 1);
  assert.equal(instruction.source_text, 'عُدّ النجوم، ثم اختر الرقم');
  assert.equal(instruction.source_text_origin, 'localization');

  assert.equal(data.summary.total, data.rows.length);
  assert.equal(data.catalogue_summary.total, data.rows.length);
});

test('the audio queue filters narrow the list while the catalogue total stays visible', async () => {
  const filtered = await call('/games/production/audio?language=ar&production_status=missing&required=true', fakeDb(CATALOGUE));
  assert.equal(filtered.status, 200);
  const data = filtered.body.data;
  assert.ok(data.rows.length > 0);
  assert.ok(data.rows.every((row) => row.language === 'ar'));
  assert.ok(data.rows.every((row) => row.production_status === 'missing'));
  assert.ok(data.rows.every((row) => row.requirement === 'required'));
  // A filter must not hide how much work remains overall.
  assert.ok(data.catalogue_summary.total > data.summary.total);
});

test('the audio queue rejects an unknown language rather than returning nothing', async () => {
  const response = await call('/games/production/audio?language=de', fakeDb(CATALOGUE));
  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
});

/* --------------------------------------------------------------- art queue */

test('the art queue endpoint returns roles, briefs and the unlinked cover', async () => {
  const response = await call('/games/production/art', fakeDb(CATALOGUE));
  assert.equal(response.status, 200);
  const rows = response.body.data.rows;

  const star = rows.find((row) => row.asset_id === 'asset-star');
  assert.ok(star);
  assert.equal(star.role, 'game_illustration');
  assert.equal(star.game_id, 'game-1');
  assert.equal(star.level, 1);
  assert.ok(star.brief.length > 20);
  assert.equal(star.production_status, 'missing');

  const cover = rows.find((row) => row.asset_id === 'asset-cover');
  assert.ok(cover, 'the cover lives in asset_links and must still be queued');
  assert.equal(cover.role, 'cover');
  assert.equal(cover.expected_aspect_ratio, '1:1');

  assert.equal(response.body.data.summary.total, rows.length);
});

test('the art queue rejects an invalid production status', async () => {
  const response = await call('/games/production/art?production_status=drawn', fakeDb(CATALOGUE));
  assert.equal(response.status, 400);
});

/* ---------------------------------------------------------------- analytics */

test('the analytics endpoint aggregates real rows and passes its own privacy guard', async () => {
  const db = fakeDb([
    ...CATALOGUE,
    ['FROM attempts a\n    LEFT JOIN games g', [{
      game_id: 'game-1', game_title: 'هيا نعدّ', engine_id: 'count_quantity', game_status: 'draft',
      attempts: 12, scored_attempts: 10, unscored_attempts: 2, completed_attempts: 7,
      successful_attempts: 6, attempts_with_errors: 4, points_earned: 30, points_possible: 40,
      help_used_attempts: 5, duration_seconds_total: 900, timed_attempts: 9, unique_children: 4,
      first_attempt_at: '2026-08-01 09:00:00', last_attempt_at: '2026-08-08 12:00:00',
    }]],
    ['JOIN mastery m', [{ game_id: 'game-1', level: 'practicing', children: 3 }]],
    ['THEN \'unscored\'', [{ game_id: 'game-1', band: 'high', attempts: 6 }]],
    ['SELECT id, content_pack FROM games', [{ id: 'game-1', content_pack: GAME_ROW.content_pack }]],
  ]);

  const response = await call('/games/analytics', db);
  assert.equal(response.status, 200);
  const data = response.body.data;

  assert.equal(data.totals.attempts, 12);
  assert.equal(data.totals.completions, 7);
  assert.equal(data.games[0].help_used_rate, 0.417);
  assert.equal(data.games[0].average_duration_seconds, 100);
  assert.equal(data.games[0].levels_in_pack, 1);
  assert.equal(data.games[0].mastery_movement.by_level.practicing, 3);
  assert.equal(data.level_completion.available, false);

  // The response the route actually emitted, checked again from the outside.
  assert.deepEqual(findPrivacyViolations(data), []);

  // And no query it ran touched the answers column.
  for (const query of db.queries) {
    assert.doesNotMatch(query.sql, /\banswers\b/i, query.sql.slice(0, 80));
  }
});

test('the analytics endpoint accepts a since filter without breaking the group by', async () => {
  const db = fakeDb([['FROM attempts a\n    LEFT JOIN games g', []]]);
  const response = await call('/games/analytics?since=2026-08-01', db);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.since, '2026-08-01');

  const aggregate = db.queries.find((query) => query.sql.includes('FROM attempts a'));
  assert.ok(aggregate.sql.indexOf('GROUP BY') > aggregate.sql.indexOf('created_at >='));
  assert.deepEqual(aggregate.params, ['2026-08-01']);
});

/* ---------------------------------------------------------------------- ops */

test('the ops endpoint evaluates readiness rather than reading the status column', async () => {
  const db = fakeDb([
    ...CATALOGUE,
    ['SELECT DISTINCT entity_id FROM content_reviews', [{ entity_id: 'game-1' }]],
  ]);
  const response = await call('/games/ops', db);
  assert.equal(response.status, 200);
  const data = response.body.data;

  assert.equal(data.total_games, 1);
  assert.equal(data.draft_count, 1);
  assert.equal(data.published_count, 0);
  assert.equal(data.games_awaiting_review, 1);
  assert.deepEqual(data.by_planet, [{ planet_id: 'planet-arqam', planet_name: 'أرقام', games: 1 }]);
  assert.deepEqual(data.by_age_track.find((row) => row.track_id === 'preschool'), { track_id: 'preschool', games: 1 });

  // The pack references artwork with no `content_assets` row, so this game is not
  // publishable however its status column reads.
  assert.equal(data.publishable_count, 0);
  assert.equal(data.games[0].publishable, false);
  assert.ok(data.games[0].buckets.includes('missing_assets'));
  assert.ok(data.top_blockers.length > 0);
  assert.ok(data.top_blockers.every((entry) => entry.games > 0));

  // Engine coverage comes from the catalogue rows, not from a constant.
  assert.equal(data.engine_coverage.total, 1);
  assert.equal(data.engine_coverage.implemented, 1);
  assert.equal(data.unevaluated_games, 0);
});

test('the ops endpoint answers on an empty catalogue', async () => {
  const response = await call('/games/ops', fakeDb([]));
  assert.equal(response.status, 200);
  assert.equal(response.body.data.total_games, 0);
  assert.equal(response.body.data.publishable_count, 0);
  assert.equal(response.body.data.engine_coverage.total, 0);
});

/* ------------------------------------------------------------- readiness */

test('single-game readiness now reports the review record and the font licence', async () => {
  const db = fakeDb([
    ['FROM games g\n      LEFT JOIN series s', [GAME_ROW]],
    ['FROM game_localizations', [{
      language: 'ar', title: 'هيا نعدّ', instructions: 'عُدّ',
      prompts: JSON.stringify({ 'count.prompt': 'عُدّ' }), status: 'ready', is_machine_translated: 0,
    }]],
    ['SELECT reviewer_role, status, reviewer_id', [{ reviewer_role: 'qa', status: 'pending', reviewer_id: null }]],
    ['FROM asset_links al', [{ role: 'cover', asset_id: 'asset-cover', status: 'planned' }]],
    ['SELECT mechanics FROM game_engines', [{ mechanics: JSON.stringify({ max_elements_on_screen: 20, engine_version: 1 }) }]],
  ]);
  const response = await call('/games/game-1/readiness', db);
  assert.equal(response.status, 200);

  const checks = response.body.data.checks;
  const byId = (id) => checks.find((entry) => entry.id === id);
  assert.equal(byId('qa').status, 'warn');
  assert.equal(byId('production_assets').status, 'warn');
  assert.equal(byId('arabic_font_license').status, 'not_applicable');
  assert.equal(byId('touch_targets').status, 'pass');
  assert.equal(byId('pack_version').status, 'pass');
  assert.equal(byId('age_range').status, 'pass');

  // The original contract of this endpoint is unchanged: no generic failure.
  for (const reason of response.body.data.blocking_reasons) {
    assert.ok(!/cannot publish/i.test(reason));
  }
});
