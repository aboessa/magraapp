/// Tests for aggregate game analytics, and for the privacy rule that shapes them.
///
/// The most important test in this file is the one that asserts what the payload
/// does **not** contain. A metric that should have been included is a gap someone
/// will notice; a child's drawing coordinates that should not have been included
/// is a gap nobody notices until it matters.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYTICS_QUERIES,
  GAME_ATTEMPT_AGGREGATE_GROUP_BY,
  GAME_ATTEMPT_AGGREGATE_SQL,
  MAX_STRING_LENGTH,
  SUCCESS_THRESHOLD,
  buildGameAnalytics,
  findPrivacyViolations,
} from '../src/lib/gameAnalytics.ts';
import { MASTERY_ACCURACY_THRESHOLD } from '../src/lib/mastery.ts';

function aggregate(overrides = {}) {
  return {
    game_id: 'game-1',
    game_title: 'مطابقة',
    engine_id: 'match_pairs',
    game_status: 'published',
    attempts: 10,
    scored_attempts: 8,
    unscored_attempts: 2,
    completed_attempts: 6,
    successful_attempts: 5,
    attempts_with_errors: 3,
    points_earned: 24,
    points_possible: 32,
    help_used_attempts: 4,
    duration_seconds_total: 600,
    timed_attempts: 8,
    unique_children: 3,
    first_attempt_at: '2026-08-01 10:00:00',
    last_attempt_at: '2026-08-08 18:00:00',
    ...overrides,
  };
}

/* ------------------------------------------------------------------ privacy */

test('the analytics payload carries no coordinate-like or free-text field', () => {
  const payload = buildGameAnalytics({
    attempts: [aggregate()],
    mastery: [{ game_id: 'game-1', level: 'independent', children: 2 }],
    bands: [{ game_id: 'game-1', band: 'high', attempts: 5 }],
    packLevels: { 'game-1': 5 },
    since: '2026-08-01',
  });

  assert.deepEqual(findPrivacyViolations(payload), []);
});

test('the guard actually catches the fields it claims to', () => {
  // Without this, the assertion above would pass on a guard that inspects nothing.
  const offenders = [
    { stroke_points: [[1, 2]] },
    { coordinates: [] },
    { x: 1, y: 2 },
    { drawing_png: 'data:...' },
    { answers: ['a'] },
    { free_text: 'قلت شيئًا' },
    { child_nickname: 'سعاد' },
    { games: [{ game_id: 'g', touch_events: 4 }] },
    { pixels: 0 },
    { games: [{ notes: 'x' }] },
    { session_replay_url: 'https://x' },
    { device_id: 'abc' },
  ];
  for (const offender of offenders) {
    assert.ok(
      findPrivacyViolations(offender).length > 0,
      `guard missed ${Object.keys(offender).join(',')}`,
    );
  }

  // And a long string is caught even under an innocent key name.
  assert.equal(findPrivacyViolations({ label: 'a'.repeat(MAX_STRING_LENGTH + 1) }).length, 1);
  assert.equal(findPrivacyViolations({ label: 'a'.repeat(MAX_STRING_LENGTH) }).length, 0);
});

test('a score field is not mistaken for drawing points', () => {
  // A guard that flags legitimate fields gets deleted by the next person who trips
  // over it, and then it flags nothing at all.
  assert.deepEqual(findPrivacyViolations({ points_missed: 8, points_possible: 32 }), []);
  assert.ok(findPrivacyViolations({ points: [[1, 2]] }).length > 0);
});

test('no analytics query reads the answers column or selects everything', () => {
  assert.ok(ANALYTICS_QUERIES.length >= 3);
  for (const sql of ANALYTICS_QUERIES) {
    assert.doesNotMatch(sql, /\banswers\b/i, `query reads answers: ${sql.slice(0, 60)}`);
    assert.doesNotMatch(sql, /SELECT\s+\*/i, 'SELECT * would sweep in the child answers');
  }
  // `child_id` may appear, but only inside a distinct count.
  const withChild = ANALYTICS_QUERIES.filter((sql) => /child_id/.test(sql));
  for (const sql of withChild) {
    for (const match of sql.match(/[a-z_.]*child_id/gi) ?? []) {
      const index = sql.indexOf(match);
      assert.match(
        sql.slice(Math.max(index - 20, 0), index + match.length),
        /COUNT\(DISTINCT/i,
        'child_id must only ever be counted, never returned',
      );
    }
  }
});

test('the payload states the privacy policy it was built under', () => {
  const payload = buildGameAnalytics({ attempts: [], mastery: [], bands: [] });
  assert.equal(payload.privacy.aggregate_only, true);
  assert.deepEqual(payload.privacy.excluded_columns, ['attempts.answers']);
  assert.ok(payload.privacy.policy.length > 20);
});

/* ------------------------------------------------------------------- metrics */

test('rates are derived from the counts and never invented', () => {
  const payload = buildGameAnalytics({
    attempts: [aggregate()], mastery: [], bands: [],
  });
  const row = payload.games[0];
  assert.equal(row.attempts, 10);
  assert.equal(row.starts, 10);
  assert.equal(row.completions, 6);
  assert.equal(row.completion_rate, 0.6);
  assert.equal(row.success_rate, 0.625);
  assert.equal(row.help_used_rate, 0.4);
  assert.equal(row.average_accuracy, 0.75);
  assert.equal(row.points_missed, 8);
  assert.equal(row.attempts_with_errors, 3);
  assert.equal(row.unique_children, 3);
});

test('a game nobody played reports null rates, not zero', () => {
  // Zero is a measurement. "Nobody played it" is not, and a dashboard that shows
  // 0% completion for an unplayed game invites retiring content that was never
  // offered.
  const payload = buildGameAnalytics({
    attempts: [aggregate({
      attempts: 0, scored_attempts: 0, unscored_attempts: 0, completed_attempts: 0,
      successful_attempts: 0, attempts_with_errors: 0, points_earned: 0, points_possible: 0,
      help_used_attempts: 0, duration_seconds_total: 0, timed_attempts: 0, unique_children: 0,
    })],
    mastery: [], bands: [],
  });
  const row = payload.games[0];
  assert.equal(row.completion_rate, null);
  assert.equal(row.success_rate, null);
  assert.equal(row.help_used_rate, null);
  assert.equal(row.average_duration_seconds, null);
});

test('duration averages only over attempts that reported one', () => {
  // `time_spent_seconds` defaults to 0, which means "not reported". Averaging it in
  // would understate every duration on the board.
  const payload = buildGameAnalytics({
    attempts: [aggregate({ attempts: 10, duration_seconds_total: 600, timed_attempts: 4 })],
    mastery: [], bands: [],
  });
  assert.equal(payload.games[0].average_duration_seconds, 150);
});

test('the success threshold matches the mastery ladder', () => {
  // A dashboard calling an attempt successful while the child's mastery row
  // disagrees is worse than having no dashboard.
  assert.equal(SUCCESS_THRESHOLD, MASTERY_ACCURACY_THRESHOLD);
  assert.ok(GAME_ATTEMPT_AGGREGATE_SQL.includes(String(SUCCESS_THRESHOLD)));
});

test('mastery movement is labelled as a snapshot because that is all D1 holds', () => {
  const payload = buildGameAnalytics({
    attempts: [aggregate()],
    mastery: [
      { game_id: 'game-1', level: 'independent', children: 2 },
      { game_id: 'game-1', level: 'needs_review', children: 1 },
      { game_id: 'game-1', level: 'practicing', children: 4 },
    ],
    bands: [],
  });
  const movement = payload.games[0].mastery_movement;
  assert.equal(movement.independent, 2);
  assert.equal(movement.needs_review, 1);
  assert.equal(movement.children_tracked, 7);
  assert.deepEqual(movement.by_level, { independent: 2, needs_review: 1, practicing: 4 });
  assert.match(movement.basis, /لقطة/);
});

test('per-level completion is reported as unavailable with the reason', () => {
  // `attempts` carries no level number. A plausible number derived from something
  // else would get a level retired.
  const payload = buildGameAnalytics({ attempts: [aggregate()], mastery: [], bands: [] });
  assert.equal(payload.level_completion.available, false);
  assert.match(payload.level_completion.reason, /رقم المستوى/);
  assert.equal(payload.games[0].levels_in_pack, null);
});

test('accuracy bands are attached to the right game', () => {
  const payload = buildGameAnalytics({
    attempts: [aggregate(), aggregate({ game_id: 'game-2' })],
    mastery: [],
    bands: [
      { game_id: 'game-1', band: 'high', attempts: 5 },
      { game_id: 'game-1', band: 'low', attempts: 2 },
      { game_id: 'game-2', band: 'unscored', attempts: 9 },
    ],
  });
  assert.deepEqual(payload.games[0].accuracy_bands, { high: 5, low: 2 });
  assert.deepEqual(payload.games[1].accuracy_bands, { unscored: 9 });
});

test('totals are summed from the same rows the list shows', () => {
  const payload = buildGameAnalytics({
    attempts: [aggregate(), aggregate({ game_id: 'game-2', attempts: 5, completed_attempts: 5, scored_attempts: 5, successful_attempts: 4, help_used_attempts: 0, timed_attempts: 5, duration_seconds_total: 100, unique_children: 2 })],
    mastery: [], bands: [],
  });
  assert.equal(payload.totals.games_with_data, 2);
  assert.equal(payload.totals.attempts, 15);
  assert.equal(payload.totals.completions, 11);
  assert.equal(payload.totals.successful_attempts, 9);
  assert.equal(payload.totals.unique_children, 5);
  assert.equal(payload.totals.average_duration_seconds, Math.round((700 / 13) * 10) / 10);
});

test('the definitions block says what each number means', () => {
  const payload = buildGameAnalytics({ attempts: [], mastery: [], bands: [] });
  for (const key of ['starts', 'completions', 'successful_attempts', 'points_missed', 'average_duration_seconds']) {
    assert.ok(payload.definitions[key], `${key} is reported without a definition`);
  }
  // `starts` in particular must admit that there is no separate start signal.
  assert.match(payload.definitions.starts, /لا إشارة بدء منفصلة/);
});

test('the group-by clause composes onto the aggregate query', () => {
  const sql = `${GAME_ATTEMPT_AGGREGATE_SQL} AND a.created_at >= ?${GAME_ATTEMPT_AGGREGATE_GROUP_BY}`;
  assert.match(sql, /WHERE a\.game_id IS NOT NULL\s+AND a\.created_at >= \?/);
  assert.match(sql, /GROUP BY a\.game_id/);
  assert.ok(sql.indexOf('GROUP BY') > sql.indexOf('WHERE'));
});
