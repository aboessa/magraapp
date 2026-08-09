/// Tests for the games operations overview.
///
/// Two properties matter here and neither is about arithmetic. First, readiness is
/// evaluated rather than read off the `status` column — a draft with every asset
/// delivered and a draft with no artwork are not the same thing, and a status
/// breakdown says they are. Second, no number is a constant: the engine total is
/// the number of rows in `game_engines`, so the thirteenth engine does not need
/// this file edited.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGE_TRACK_BOUNDS,
  bucketsFor,
  buildGamesOpsOverview,
  tracksForAgeRange,
} from '../src/lib/gamesOps.ts';
import { evaluatePublishReadiness } from '../src/lib/publishReadiness.ts';
import { enginesWithRuntimeSchema } from '../src/lib/gamePackGate.ts';

/// A readiness input for a game that is complete unless told otherwise.
function readiness(overrides = {}) {
  return {
    engineId: 'match_pairs',
    engineHasRuntimeSchema: true,
    packErrors: [],
    packWarnings: [],
    pack: {
      pack_version: 1,
      localization: 'translatable',
      levels: [{ level: 1, scoring: 'discrete', prompt_key: 'game.x.prompt' }],
      accessibility: { min_touch_target_dp: 64, sequential_tap_alternative: true },
      review: {},
    },
    objectiveId: 'objective-1',
    objectiveCode: 'x.y.z',
    primarySkillId: 'skill-1',
    secondarySkillIds: [],
    localizations: ['ar', 'en', 'fr'].map((language) => ({
      language, status: 'ready', hasTitle: true, hasInstructions: true,
      missingPromptKeys: [], isMachineTranslated: false,
    })),
    requiredPromptKeys: ['game.x.prompt'],
    assets: { required: [], missing: [], notReady: [] },
    audio: { required: [], missing: [], notReady: [] },
    ageMin: 6,
    ageMax: 8,
    supervisionLevel: 'none',
    safetyNotes: null,
    isTestFixture: false,
    supportedPackVersion: 1,
    reviews: [{ role: 'qa', status: 'approved' }],
    productionAssets: [{ role: 'cover', assetId: 'a-cover', status: 'ready' }],
    ...overrides,
  };
}

function game(overrides = {}) {
  return {
    id: 'game-1',
    title: 'لعبة',
    engineId: 'match_pairs',
    status: 'draft',
    ageMin: 6,
    ageMax: 8,
    planetId: 'planet-arqam',
    planetName: 'أرقام',
    readinessInput: readiness(),
    ...overrides,
  };
}

const base = {
  catalogueEngineIds: ['match_pairs', 'sim_lab', 'not_built_yet'],
  implementedEngineIds: ['match_pairs', 'sim_lab'],
  gameIdsAwaitingReview: [],
};

/* ------------------------------------------------------------- age tracks */

test('a game belongs to every track its age range touches', () => {
  // A 5–7 game is genuinely both preschool and kids; rounding it to one hides it
  // from half the catalogue planning.
  assert.deepEqual(tracksForAgeRange(3, 5), ['preschool']);
  assert.deepEqual(tracksForAgeRange(5, 7), ['preschool', 'kids']);
  assert.deepEqual(tracksForAgeRange(9, 12), ['junior']);
  assert.deepEqual(tracksForAgeRange(3, 12), ['preschool', 'kids', 'junior']);
  assert.deepEqual(tracksForAgeRange(8, 4), [], 'an inverted range belongs nowhere');
});

test('the track bands cover 3 to 12 without a gap', () => {
  const sorted = [...AGE_TRACK_BOUNDS].sort((a, b) => a.min - b.min);
  assert.equal(sorted[0].min, 3);
  assert.equal(sorted[sorted.length - 1].max, 12);
  for (let index = 1; index < sorted.length; index += 1) {
    assert.equal(sorted[index].min, sorted[index - 1].max + 1, 'a gap would strand an age');
  }
});

/* ---------------------------------------------------------------- buckets */

test('a complete game is ready and nothing else', () => {
  assert.deepEqual(bucketsFor(evaluatePublishReadiness(readiness())), ['ready']);
});

test('a game lands in every bucket that applies, not just the first', () => {
  // Forcing one bucket would make three of the four numbers useless for planning.
  const result = evaluatePublishReadiness(readiness({
    engineHasRuntimeSchema: false,
    assets: { required: ['a'], missing: ['a'], notReady: [] },
    audio: { required: ['v'], missing: ['v'], notReady: [] },
    localizations: [],
    reviews: [{ role: 'qa', status: 'rejected' }],
  }));
  const buckets = bucketsFor(result);
  for (const expected of [
    'blocked', 'engine_not_implemented', 'missing_assets',
    'missing_audio', 'missing_localization', 'missing_review',
  ]) {
    assert.ok(buckets.includes(expected), `missing bucket ${expected}: ${buckets.join(',')}`);
  }
  assert.ok(!buckets.includes('ready'));
});

test('an unclassified blocker still lands in blocked', () => {
  // A check added later without a bucket must not disappear from the board.
  const result = evaluatePublishReadiness(readiness({ isTestFixture: true }));
  assert.deepEqual(bucketsFor(result), ['blocked']);
});

/* --------------------------------------------------------------- overview */

test('breakdowns count every game exactly once per dimension', () => {
  const overview = buildGamesOpsOverview({
    ...base,
    games: [
      game({ id: 'g1', status: 'draft', engineId: 'match_pairs', planetId: 'p1', planetName: 'أ' }),
      game({ id: 'g2', status: 'published', engineId: 'match_pairs', planetId: 'p1', planetName: 'أ' }),
      game({ id: 'g3', status: 'published', engineId: 'sim_lab', planetId: 'p2', planetName: 'ب', ageMin: 9, ageMax: 12,
        readinessInput: readiness({ engineId: 'sim_lab', ageMin: 9, ageMax: 12, pack: {
          pack_version: 1, localization: 'language_neutral',
          levels: [{ level: 1, scoring: 'discrete' }],
          accessibility: { min_touch_target_dp: 48 },
          review: { scientific_review: { status: 'approved' } },
        } }) }),
    ],
  });

  assert.equal(overview.total_games, 3);
  assert.equal(overview.by_planet.reduce((total, row) => total + row.games, 0), 3);
  assert.equal(overview.by_engine.reduce((total, row) => total + row.games, 0), 3);
  assert.equal(overview.by_status.reduce((total, row) => total + row.games, 0), 3);
  assert.equal(overview.draft_count, 1);
  assert.equal(overview.published_count, 2);
  assert.deepEqual(
    overview.by_age_track,
    [{ track_id: 'preschool', games: 0 }, { track_id: 'kids', games: 2 }, { track_id: 'junior', games: 1 }],
  );
});

test('engine coverage is the intersection of the catalogue and the runtimes', () => {
  const overview = buildGamesOpsOverview({ ...base, games: [] });
  assert.equal(overview.engine_coverage.total, 3);
  assert.equal(overview.engine_coverage.implemented, 2);
  assert.deepEqual(overview.engine_coverage.missing, ['not_built_yet']);
  assert.deepEqual(overview.engine_coverage.unregistered, []);

  // A runtime with no catalogue row is the opposite defect and just as visible.
  const reversed = buildGamesOpsOverview({
    ...base, games: [], catalogueEngineIds: ['match_pairs'], implementedEngineIds: ['match_pairs', 'sim_lab'],
  });
  assert.deepEqual(reversed.engine_coverage.unregistered, ['sim_lab']);
  assert.equal(reversed.engine_coverage.total, 1);
});

test('the engine total is data, not the number twelve', () => {
  // Written as an assertion so the day a thirteenth engine is added, nothing here
  // has to change.
  const overview = buildGamesOpsOverview({
    ...base, games: [], catalogueEngineIds: ['a', 'b', 'c', 'd', 'e'], implementedEngineIds: ['a'],
  });
  assert.equal(overview.engine_coverage.total, 5);
  assert.equal(overview.engine_coverage.implemented, 1);
});

test('publishable is evaluated, not read off the status column', () => {
  const overview = buildGamesOpsOverview({
    ...base,
    games: [
      // A draft that is genuinely finished.
      game({ id: 'ready-draft', status: 'draft' }),
      // A published row whose artwork is missing: published is not the same as ready.
      game({
        id: 'broken-published', status: 'published',
        readinessInput: readiness({ assets: { required: ['a'], missing: ['a'], notReady: [] } }),
      }),
    ],
  });
  assert.equal(overview.published_count, 1);
  assert.equal(overview.draft_count, 1);
  assert.equal(overview.publishable_count, 1);
  assert.equal(overview.readiness_buckets.ready, 1);
  assert.equal(overview.readiness_buckets.missing_assets, 1);
  assert.equal(overview.games.find((row) => row.game_id === 'ready-draft').publishable, true);
  assert.equal(overview.games.find((row) => row.game_id === 'broken-published').publishable, false);
});

test('blocked_total is distinct while the reason buckets overlap', () => {
  const overview = buildGamesOpsOverview({
    ...base,
    games: [game({
      readinessInput: readiness({
        assets: { required: ['a'], missing: ['a'], notReady: [] },
        audio: { required: ['v'], missing: ['v'], notReady: [] },
      }),
    })],
  });
  assert.equal(overview.readiness_buckets.blocked, 1);
  assert.equal(overview.readiness_buckets.missing_assets, 1);
  assert.equal(overview.readiness_buckets.missing_audio, 1);
});

test('top blockers are ranked and carry their owners', () => {
  const overview = buildGamesOpsOverview({
    ...base,
    games: [
      game({ id: 'g1', readinessInput: readiness({ audio: { required: ['v'], missing: ['v'], notReady: [] } }) }),
      game({ id: 'g2', readinessInput: readiness({ audio: { required: ['v'], missing: ['v'], notReady: [] } }) }),
      game({ id: 'g3', readinessInput: readiness({ assets: { required: ['a'], missing: ['a'], notReady: [] } }) }),
    ],
  });
  assert.equal(overview.top_blockers[0].check_id, 'audio');
  assert.equal(overview.top_blockers[0].games, 2);
  assert.deepEqual(overview.top_blockers[0].owners, ['production']);
  assert.equal(overview.top_blockers[1].check_id, 'assets');
});

test('a game that could not be evaluated is reported, never counted as ready', () => {
  // "We do not know" must not round to "fine".
  const overview = buildGamesOpsOverview({
    ...base,
    games: [game({ id: 'g1', readinessInput: null }), game({ id: 'g2' })],
  });
  assert.equal(overview.unevaluated_games, 1);
  assert.equal(overview.publishable_count, 1);
  assert.equal(overview.readiness_buckets.ready, 1);
  assert.equal(overview.games.find((row) => row.game_id === 'g1').publishable, null);
  assert.deepEqual(overview.games.find((row) => row.game_id === 'g1').buckets, []);
});

test('games awaiting review counts only games in the set', () => {
  const overview = buildGamesOpsOverview({
    ...base,
    games: [game({ id: 'g1' }), game({ id: 'g2' })],
    gameIdsAwaitingReview: ['g1', 'g-archived-elsewhere'],
  });
  assert.equal(overview.games_awaiting_review, 1);
});

test('games with no planet are still counted', () => {
  const overview = buildGamesOpsOverview({
    ...base,
    games: [game({ id: 'g1', planetId: null, planetName: null })],
  });
  assert.equal(overview.total_games, 1);
  assert.equal(overview.by_planet.length, 1);
  assert.equal(overview.by_planet[0].planet_id, null);
  assert.equal(overview.by_planet[0].games, 1);
});

test('every bucket key is present even when empty, so a board can render zeroes', () => {
  const overview = buildGamesOpsOverview({ ...base, games: [] });
  for (const bucket of ['ready', 'blocked', 'missing_assets', 'missing_audio',
    'missing_localization', 'missing_review', 'engine_not_implemented']) {
    assert.equal(overview.readiness_buckets[bucket], 0, `${bucket} missing from the report`);
  }
  assert.equal(overview.total_games, 0);
  assert.equal(overview.publishable_count, 0);
});

test('the runtime registry is what implementation coverage is measured against', () => {
  const implemented = enginesWithRuntimeSchema();
  assert.ok(implemented.length >= 12, `expected the twelve engines, found ${implemented.length}`);
  const overview = buildGamesOpsOverview({
    games: [],
    catalogueEngineIds: implemented,
    implementedEngineIds: implemented,
    gameIdsAwaitingReview: [],
  });
  assert.equal(overview.engine_coverage.implemented, implemented.length);
  assert.deepEqual(overview.engine_coverage.missing, []);
});
