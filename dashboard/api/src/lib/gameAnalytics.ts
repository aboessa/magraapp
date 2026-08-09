/// Aggregate game analytics, and the privacy rule that shapes them.
///
/// ## The rule first, because it constrains everything else
///
/// A drawing game could record a great deal: every point of every stroke, the
/// pixels of the finished picture, the words a child typed into a creative
/// prompt, how long the finger hovered before committing. All of it would make
/// a richer dashboard, and none of it may be stored or returned here.
///
/// Three reasons, in order of weight:
///
///  1. **It is a child.** Stroke coordinates are biometric-adjacent — pressure,
///     tremor, hesitation and handedness are recoverable from them — and free text
///     is whatever a six-year-old decided to say. Neither is necessary to know
///     whether a game works.
///  2. **Data that is not collected cannot leak.** Every field added here becomes
///     part of a breach, a subject-access request, and a retention obligation.
///     `routes/adminMastery.ts` already refuses to return `attempts.answers` for
///     exactly this reason; this module extends the same refusal to the
///     aggregate path rather than quietly reintroducing it one column at a time.
///  3. **Aggregates answer the actual question.** "Is level 3 too hard?" is a
///     completion rate, not a stroke trace. Behavioural telemetry beyond that is
///     collected because it is possible, not because it is needed.
///
/// [findPrivacyViolations] makes the rule enforceable instead of aspirational: it
/// is exported so the route can refuse to emit a violating payload and the test
/// suite can assert the shape independently of the implementation.
///
/// ## Honesty about what `attempts` can and cannot answer
///
/// The `attempts` table (migration 0001) holds: score, max_score, time spent,
/// whether help was used, the child, the game, and a timestamp. That is all. Two
/// consequences are stated in the payload rather than papered over:
///
///  * There is **no level number** on an attempt, so per-level completion cannot
///    be computed. It is reported as unavailable with the reason, because a
///    plausible-looking number derived from something else is worse than an
///    absent one — someone would retire a level on the strength of it.
///  * There is **no separate start signal** for games. `processed_family_events`
///    carries no content id, so a start cannot be attributed to a game. A
///    recorded attempt is therefore the earliest evidence a game was played, and
///    `starts` says so explicitly instead of pretending to a funnel.

/// Field names that must never appear in an analytics payload.
///
/// Matched against key names, not values, because the key is the intent. A
/// dashboard that asks for `stroke_points` has already decided to collect them.
///
/// `answers` is on the list because it is a real column on `attempts` that a
/// `SELECT *` would sweep in — the most likely way this rule gets broken is not
/// malice, it is convenience.
export const PRIVATE_FIELD_PATTERNS: readonly RegExp[] = [
  // Drawing geometry and raster data.
  /^(x|y|dx|dy|cx|cy|x1|y1|x2|y2|lat|lon)$/i,
  /coord/i,
  // A bare `points` array, or points qualified by a gesture. `points_missed` is a
  // score and deliberately not matched: a pattern that flags legitimate fields
  // gets deleted by the next person who hits it, and then flags nothing.
  /(^|_)points?$/i,
  /(stroke|touch|tap|drag|gesture|path|canvas|drawing|sample)_?points?/i,
  /stroke/i,
  /(^|_)path(s)?($|_)/i,
  /pixel/i,
  /bitmap|raster|image_data|canvas|drawing/i,
  /thumbnail|snapshot/i,
  // Anything a child wrote or said.
  /answers?/i,
  /free_?text/i,
  /(^|_)text($|_)/i,
  /transcript|utterance|caption_text/i,
  /(^|_)comment(s)?($|_)/i,
  /(^|_)note(s)?($|_)/i,
  // Behavioural telemetry beyond an aggregate.
  /keystroke|touch_event|gesture|dwell|hover|heatmap|session_replay/i,
  /device_id|ip_address|user_agent|geo/i,
  // Direct identifiers of a child.
  /nickname|child_name|birth_(month|year)|email|parent_email/i,
];

/// The longest string the payload may carry.
///
/// A short cap is a second line of defence: free text smuggled under an innocent
/// key name is still free text, and no legitimate value here — a game id, an
/// engine id, a mastery level, a one-line note about a limitation — needs more.
export const MAX_STRING_LENGTH = 240;

/// Every privacy violation in a payload, as human-readable paths.
///
/// Returns a list rather than throwing, so a caller can log all of them at once
/// and a test can assert on the exact offender.
export function findPrivacyViolations(payload: unknown, path = '$'): string[] {
  const violations: string[] = [];

  if (Array.isArray(payload)) {
    payload.forEach((entry, index) => {
      violations.push(...findPrivacyViolations(entry, `${path}[${index}]`));
    });
    return violations;
  }

  if (payload !== null && typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      const here = `${path}.${key}`;
      const offending = PRIVATE_FIELD_PATTERNS.find((pattern) => pattern.test(key));
      if (offending) violations.push(`${here} matches ${offending}`);
      violations.push(...findPrivacyViolations(value, here));
    }
    return violations;
  }

  if (typeof payload === 'string' && payload.length > MAX_STRING_LENGTH) {
    violations.push(`${path} is ${payload.length} characters, over the ${MAX_STRING_LENGTH} cap`);
  }

  return violations;
}

/// Accuracy at or above which an attempt counts as successful.
///
/// The same 0.8 the mastery ladder uses (`lib/mastery.ts`). Duplicating the
/// number with a different value would let a dashboard call an attempt successful
/// while the child's mastery row disagreed.
export const SUCCESS_THRESHOLD = 0.8;

/// One row of the per-game aggregate. Every field is a `COUNT`, a `SUM` or an id.
///
/// Deliberately no free columns: the query that fills this is the boundary where
/// raw attempt data stops, and it is expressed as sums so no individual attempt
/// crosses it.
export interface GameAttemptAggregate {
  game_id: string;
  game_title: string | null;
  engine_id: string | null;
  game_status: string | null;
  attempts: number;
  /// Attempts with a positive `max_score`, i.e. ones that measured something.
  scored_attempts: number;
  /// Attempts on a level that grades nothing — colouring, free drawing.
  unscored_attempts: number;
  /// Attempts that left nothing undone: full marks, or nothing to mark.
  completed_attempts: number;
  /// Attempts at or above [SUCCESS_THRESHOLD].
  successful_attempts: number;
  /// Attempts that lost at least one point.
  attempts_with_errors: number;
  points_earned: number;
  points_possible: number;
  help_used_attempts: number;
  /// Sum of `time_spent_seconds` over attempts that reported a duration.
  duration_seconds_total: number;
  /// Attempts with `time_spent_seconds > 0`. Zero means "not reported", and
  /// averaging it in would understate every duration on the board.
  timed_attempts: number;
  unique_children: number;
  first_attempt_at: string | null;
  last_attempt_at: string | null;
}

/// Current mastery distribution for a game's objective.
///
/// `mastery` is a projection of the present, not a history: it carries
/// `last_attempt_at` but no previous level, so there is no ledger of transitions
/// anywhere in D1. "Movement" is therefore reported as the distribution across the
/// ladder plus the two ends that matter — `independent` and `needs_review` — and
/// the payload says as much.
export interface GameMasteryAggregate {
  game_id: string;
  level: string;
  children: number;
}

/// Accuracy bands, the closest thing to per-level difficulty that `attempts`
/// supports.
export interface GameScoreBand {
  game_id: string;
  band: string;
  attempts: number;
}

export interface GameAnalyticsInput {
  attempts: readonly GameAttemptAggregate[];
  mastery: readonly GameMasteryAggregate[];
  bands: readonly GameScoreBand[];
  /// `progression.levels_to_finish` per game, read from the pack. Included so the
  /// payload can say how many levels exist even though it cannot say which ones
  /// were completed.
  packLevels?: Record<string, number>;
  /// Window the aggregate covers, for the payload header.
  since?: string | null;
}

export interface GameAnalyticsRow {
  game_id: string;
  game_title: string | null;
  engine_id: string | null;
  game_status: string | null;
  starts: number;
  attempts: number;
  completions: number;
  successful_attempts: number;
  scored_attempts: number;
  unscored_attempts: number;
  unique_children: number;
  /// completions / starts, or null when nothing was played.
  completion_rate: number | null;
  /// successful attempts / scored attempts, or null when nothing was scored.
  success_rate: number | null;
  /// attempts using help / attempts, or null when nothing was played.
  help_used_rate: number | null;
  /// Mean accuracy across scored attempts, or null.
  average_accuracy: number | null;
  average_duration_seconds: number | null;
  /// Attempts that lost points, and how many points were lost in total. The only
  /// error signal the schema carries: there is no per-question error log, and
  /// adding one would mean storing what the child answered.
  attempts_with_errors: number;
  points_missed: number;
  levels_in_pack: number | null;
  mastery_movement: {
    by_level: Record<string, number>;
    children_tracked: number;
    independent: number;
    needs_review: number;
    /// Stated in the payload so a reader does not mistake a snapshot for a trend.
    basis: string;
  };
  accuracy_bands: Record<string, number>;
  first_attempt_at: string | null;
  last_attempt_at: string | null;
}

export interface GameAnalyticsTotals {
  games_with_data: number;
  starts: number;
  attempts: number;
  completions: number;
  successful_attempts: number;
  unique_children: number;
  completion_rate: number | null;
  success_rate: number | null;
  help_used_rate: number | null;
  average_duration_seconds: number | null;
}

export interface LevelCompletionAvailability {
  available: false;
  reason: string;
}

export interface GameAnalytics {
  since: string | null;
  privacy: {
    /// Restated in the response so an integrator reading the payload learns the
    /// rule without reading this file.
    policy: string;
    aggregate_only: true;
    /// Columns the queries never read.
    excluded_columns: string[];
  };
  definitions: Record<string, string>;
  totals: GameAnalyticsTotals;
  level_completion: LevelCompletionAvailability;
  games: GameAnalyticsRow[];
}

function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

/// Shapes the aggregate rows into the response.
///
/// Pure, and the only place a rate is computed. Rates calculated in SQL and again
/// in the client are rates that eventually disagree.
export function buildGameAnalytics(input: GameAnalyticsInput): GameAnalytics {
  const masteryByGame = new Map<string, GameMasteryAggregate[]>();
  for (const row of input.mastery) {
    const list = masteryByGame.get(row.game_id) ?? [];
    list.push(row);
    masteryByGame.set(row.game_id, list);
  }
  const bandsByGame = new Map<string, GameScoreBand[]>();
  for (const row of input.bands) {
    const list = bandsByGame.get(row.game_id) ?? [];
    list.push(row);
    bandsByGame.set(row.game_id, list);
  }

  const games: GameAnalyticsRow[] = input.attempts.map((row) => {
    const masteryRows = masteryByGame.get(row.game_id) ?? [];
    const byLevel: Record<string, number> = {};
    let childrenTracked = 0;
    for (const entry of masteryRows) {
      byLevel[entry.level] = (byLevel[entry.level] ?? 0) + entry.children;
      childrenTracked += entry.children;
    }
    const accuracyBands: Record<string, number> = {};
    for (const entry of bandsByGame.get(row.game_id) ?? []) {
      accuracyBands[entry.band] = (accuracyBands[entry.band] ?? 0) + entry.attempts;
    }

    return {
      game_id: row.game_id,
      game_title: row.game_title,
      engine_id: row.engine_id,
      game_status: row.game_status,
      // Equal to `attempts` by construction, and named separately because the
      // dashboard asks for a funnel and must be told there is not one.
      starts: row.attempts,
      attempts: row.attempts,
      completions: row.completed_attempts,
      successful_attempts: row.successful_attempts,
      scored_attempts: row.scored_attempts,
      unscored_attempts: row.unscored_attempts,
      unique_children: row.unique_children,
      completion_rate: ratio(row.completed_attempts, row.attempts),
      success_rate: ratio(row.successful_attempts, row.scored_attempts),
      help_used_rate: ratio(row.help_used_attempts, row.attempts),
      average_accuracy: ratio(row.points_earned, row.points_possible),
      average_duration_seconds: row.timed_attempts > 0
        ? Math.round((row.duration_seconds_total / row.timed_attempts) * 10) / 10
        : null,
      attempts_with_errors: row.attempts_with_errors,
      points_missed: Math.max(row.points_possible - row.points_earned, 0),
      levels_in_pack: input.packLevels?.[row.game_id] ?? null,
      mastery_movement: {
        by_level: byLevel,
        children_tracked: childrenTracked,
        independent: byLevel.independent ?? 0,
        needs_review: byLevel.needs_review ?? 0,
        basis: 'لقطة حالية من جدول mastery؛ لا سجلّ انتقالات في القاعدة.',
      },
      accuracy_bands: accuracyBands,
      first_attempt_at: row.first_attempt_at,
      last_attempt_at: row.last_attempt_at,
    };
  });

  const sum = (pick: (row: GameAttemptAggregate) => number): number =>
    input.attempts.reduce((total, row) => total + (Number(pick(row)) || 0), 0);

  const attempts = sum((row) => row.attempts);
  const scored = sum((row) => row.scored_attempts);
  const timed = sum((row) => row.timed_attempts);

  return {
    since: input.since ?? null,
    privacy: {
      policy: 'مؤشّرات مُجمَّعة فقط. لا إحداثيات رسم ولا بكسلات ولا نصّ حرّ من الطفل، '
        + 'ولا قياسات سلوكية غير لازمة.',
      aggregate_only: true,
      excluded_columns: ['attempts.answers'],
    },
    definitions: {
      starts: 'عدد المحاولات المسجّلة. لا إشارة بدء منفصلة للألعاب في القاعدة.',
      completions: 'محاولات لم يتبقَّ فيها شيء: درجة كاملة، أو مستوى بلا تقييم.',
      successful_attempts: `محاولات دقّتها ≥ ${SUCCESS_THRESHOLD} وهي عتبة الإتقان نفسها.`,
      points_missed: 'مجموع النقاط المفقودة. لا سجلّ أخطاء لكل سؤال، لأنه يعني تخزين جواب الطفل.',
      average_duration_seconds: 'متوسط على المحاولات التي أبلغت مدّة فقط؛ الصفر يعني «غير مُبلَّغ».',
    },
    totals: {
      games_with_data: input.attempts.length,
      starts: attempts,
      attempts,
      completions: sum((row) => row.completed_attempts),
      successful_attempts: sum((row) => row.successful_attempts),
      // A child who played two games is counted in both, so this is a sum of
      // per-game distinct counts and not a platform-wide distinct count. Named
      // plainly rather than presented as the latter.
      unique_children: sum((row) => row.unique_children),
      completion_rate: ratio(sum((row) => row.completed_attempts), attempts),
      success_rate: ratio(sum((row) => row.successful_attempts), scored),
      help_used_rate: ratio(sum((row) => row.help_used_attempts), attempts),
      average_duration_seconds: timed > 0
        ? Math.round((sum((row) => row.duration_seconds_total) / timed) * 10) / 10
        : null,
    },
    level_completion: {
      available: false,
      reason: 'جدول attempts لا يحمل رقم المستوى، فإكمال كل مستوى غير محسوب. '
        + 'أي رقم مشتقّ من غيره سيكون تخمينًا يُبنى عليه قرار حذف مستوى.',
    },
    games,
  };
}

/// The aggregate query, in two halves so a caller can insert a date filter.
///
/// Exported so a test can assert what it does *not* select. `answers` is absent by
/// construction: every column is either a key or an aggregate, so no attempt row
/// leaves the database intact, and `child_id` appears only inside
/// `COUNT(DISTINCT ...)`. There is no `SELECT *` anywhere in this file, because
/// `SELECT *` on `attempts` would pull the child's answers in by accident — which
/// is how this rule would actually get broken.
export const GAME_ATTEMPT_AGGREGATE_SQL = `
  SELECT a.game_id AS game_id,
         g.title_ar AS game_title,
         g.engine_id AS engine_id,
         g.status AS game_status,
         COUNT(*) AS attempts,
         SUM(CASE WHEN a.max_score IS NOT NULL AND a.max_score > 0 THEN 1 ELSE 0 END) AS scored_attempts,
         SUM(CASE WHEN a.max_score IS NULL OR a.max_score = 0 THEN 1 ELSE 0 END) AS unscored_attempts,
         SUM(CASE WHEN a.max_score IS NULL OR a.max_score = 0
                       OR (a.score IS NOT NULL AND a.score >= a.max_score)
                  THEN 1 ELSE 0 END) AS completed_attempts,
         SUM(CASE WHEN a.max_score IS NOT NULL AND a.max_score > 0 AND a.score IS NOT NULL
                       AND (a.score * 1.0 / a.max_score) >= ${SUCCESS_THRESHOLD}
                  THEN 1 ELSE 0 END) AS successful_attempts,
         SUM(CASE WHEN a.max_score IS NOT NULL AND a.max_score > 0 AND a.score IS NOT NULL
                       AND a.score < a.max_score
                  THEN 1 ELSE 0 END) AS attempts_with_errors,
         COALESCE(SUM(CASE WHEN a.max_score IS NOT NULL AND a.max_score > 0 THEN a.score ELSE 0 END), 0) AS points_earned,
         COALESCE(SUM(CASE WHEN a.max_score IS NOT NULL AND a.max_score > 0 THEN a.max_score ELSE 0 END), 0) AS points_possible,
         SUM(CASE WHEN a.help_used = 1 THEN 1 ELSE 0 END) AS help_used_attempts,
         COALESCE(SUM(CASE WHEN a.time_spent_seconds > 0 THEN a.time_spent_seconds ELSE 0 END), 0) AS duration_seconds_total,
         SUM(CASE WHEN a.time_spent_seconds > 0 THEN 1 ELSE 0 END) AS timed_attempts,
         COUNT(DISTINCT a.child_id) AS unique_children,
         MIN(a.created_at) AS first_attempt_at,
         MAX(a.created_at) AS last_attempt_at
    FROM attempts a
    LEFT JOIN games g ON g.id = a.game_id
   WHERE a.game_id IS NOT NULL
`;

export const GAME_ATTEMPT_AGGREGATE_GROUP_BY = `
   GROUP BY a.game_id, g.title_ar, g.engine_id, g.status
   ORDER BY COUNT(*) DESC
`;

/// Mastery distribution per game, through the game's learning objective.
export const GAME_MASTERY_AGGREGATE_SQL = `
  SELECT g.id AS game_id, m.level AS level, COUNT(DISTINCT m.child_id) AS children
    FROM games g
    JOIN mastery m ON m.objective_id = g.learning_objective_id
   WHERE g.learning_objective_id IS NOT NULL
`;

export const GAME_MASTERY_AGGREGATE_GROUP_BY = `
   GROUP BY g.id, m.level
`;

/// Accuracy bands per game. Bands, not scores, so no single attempt is legible.
export const GAME_SCORE_BAND_SQL = `
  SELECT a.game_id AS game_id,
         CASE
           WHEN a.max_score IS NULL OR a.max_score = 0 THEN 'unscored'
           WHEN (a.score * 1.0 / a.max_score) >= 0.8 THEN 'high'
           WHEN (a.score * 1.0 / a.max_score) >= 0.5 THEN 'mid'
           ELSE 'low'
         END AS band,
         COUNT(*) AS attempts
    FROM attempts a
   WHERE a.game_id IS NOT NULL
`;

export const GAME_SCORE_BAND_GROUP_BY = `
   GROUP BY a.game_id, band
`;

/// Every analytics query, for the test that asserts none of them reads a private
/// column. Keeping the list here means a query added later is covered by the same
/// assertion instead of silently escaping it.
export const ANALYTICS_QUERIES: readonly string[] = [
  GAME_ATTEMPT_AGGREGATE_SQL,
  GAME_MASTERY_AGGREGATE_SQL,
  GAME_SCORE_BAND_SQL,
];
