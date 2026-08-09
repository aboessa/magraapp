/// The mastery ladder.
///
/// ## What was implemented before
///
/// `FamilyState.recordAttempt` collapsed mastery into three states using a
/// running counter:
///
///   level = CASE WHEN correct_attempts + excluded >= 3 THEN 'independent'
///                WHEN correct_attempts + excluded >= 1 THEN 'practicing'
///                ELSE 'introduced' END
///
/// `docs/games/05-mastery-and-measurement.md` specifies six states over a
/// **last-five-attempts** window with an 80% accuracy threshold. Three
/// consequences of the old shape mattered:
///
///  1. `assisted` did not exist, so a child who only succeeded because the engine
///     widened its tolerance was recorded as `independent`. For tracing this is
///     not a rounding error: the help ladder widens tolerance from 24dp to 36dp
///     at the third stall, and reporting that as independent mastery of letter
///     formation is simply false.
///  2. `needs_review` did not exist, so a skill that regressed after being
///     mastered stayed `independent` forever.
///  3. A lifetime counter never forgets, so one good run years ago outweighed
///     five recent failures.
///
/// This module is pure so the ladder is provable in tests. `FamilyState` keeps
/// the attempt rows; the level is derived from them.

export type MasteryLevel =
  | 'not_started'
  | 'introduced'
  | 'practicing'
  | 'assisted'
  | 'independent'
  | 'needs_review';

export const MASTERY_LEVELS: readonly MasteryLevel[] = [
  'not_started', 'introduced', 'practicing', 'assisted', 'independent', 'needs_review',
];

export function isMasteryLevel(value: unknown): value is MasteryLevel {
  return typeof value === 'string' && (MASTERY_LEVELS as readonly string[]).includes(value);
}

/// One attempt, reduced to what mastery depends on.
export interface MasteryAttempt {
  /// Points earned.
  score: number;
  /// Points available. Zero means the level was unscored, which is a real state
  /// for colouring and free drawing.
  maxScore: number;
  /// True when a hint, a widened tolerance or a shown solution contributed.
  helpUsed: boolean;
  /// Milliseconds since the epoch. Only the ordering is used.
  createdAt: number;
}

/// How many recent attempts the level is computed from.
export const MASTERY_WINDOW = 5;

/// Accuracy at or above which an attempt counts as successful.
export const MASTERY_ACCURACY_THRESHOLD = 0.8;

/// Consecutive unassisted successes required for `independent`.
export const INDEPENDENT_STREAK = 3;

/// Accuracy below which a previously independent objective needs review.
export const REVIEW_THRESHOLD = 0.5;

function accuracy(attempt: MasteryAttempt): number | null {
  // An unscored attempt has no accuracy. Treating it as 0 would drag a child's
  // mastery down for colouring a picture, which is explicitly never graded.
  if (!Number.isFinite(attempt.maxScore) || attempt.maxScore <= 0) return null;
  const ratio = attempt.score / attempt.maxScore;
  if (!Number.isFinite(ratio)) return null;
  return Math.min(Math.max(ratio, 0), 1);
}

/// Attempts that carry a measurement, newest last.
function scoredAttempts(attempts: readonly MasteryAttempt[]): MasteryAttempt[] {
  return [...attempts]
    .sort((a, b) => a.createdAt - b.createdAt)
    .filter((attempt) => accuracy(attempt) !== null);
}

export interface MasterySummary {
  level: MasteryLevel;
  /// Attempts considered, i.e. the size of the window actually available.
  consideredAttempts: number;
  /// Mean accuracy across the window, or null when nothing was scored.
  windowAccuracy: number | null;
  /// True when any attempt in the window used help.
  helpUsedInWindow: boolean;
}

/// Derives the mastery level from an attempt history.
///
/// [previousLevel] matters only for `needs_review`: regression is defined
/// relative to having been independent before, so it cannot be computed from the
/// window alone.
export function deriveMastery(
  attempts: readonly MasteryAttempt[],
  previousLevel: MasteryLevel = 'not_started',
): MasterySummary {
  const scored = scoredAttempts(attempts);

  // No attempt at all.
  if (attempts.length === 0) {
    return { level: 'not_started', consideredAttempts: 0, windowAccuracy: null, helpUsedInWindow: false };
  }

  // Attempts exist but none was measurable: the child has met the objective's
  // activity without producing a measurement. `introduced` is the honest level.
  if (scored.length === 0) {
    return { level: 'introduced', consideredAttempts: 0, windowAccuracy: null, helpUsedInWindow: false };
  }

  const window = scored.slice(-MASTERY_WINDOW);
  const accuracies = window.map((attempt) => accuracy(attempt)!);
  const mean = accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length;
  const helpUsedInWindow = window.some((attempt) => attempt.helpUsed);

  const summary = (level: MasteryLevel): MasterySummary => ({
    level,
    consideredAttempts: window.length,
    windowAccuracy: mean,
    helpUsedInWindow,
  });

  // Regression after mastery. Checked first: a child who has slipped needs the
  // system to notice, and that signal must not be masked by a passing mean.
  if (previousLevel === 'independent' && mean < REVIEW_THRESHOLD) {
    return summary('needs_review');
  }

  // `independent` requires a streak of unassisted successes, not just a good
  // average, so one strong attempt among weak ones does not qualify.
  const tail = window.slice(-INDEPENDENT_STREAK);
  const independentStreak = tail.length === INDEPENDENT_STREAK &&
    tail.every((attempt) => accuracy(attempt)! >= MASTERY_ACCURACY_THRESHOLD && !attempt.helpUsed);
  if (independentStreak) return summary('independent');

  // Accurate, but with help. Not a lesser grade: it is the signal that tells the
  // system to offer practice and tells a parent where support is still needed.
  if (mean >= MASTERY_ACCURACY_THRESHOLD && helpUsedInWindow) return summary('assisted');

  // Accurate without help but without the streak yet.
  if (mean >= MASTERY_ACCURACY_THRESHOLD) return summary('practicing');

  if (mean >= REVIEW_THRESHOLD) return summary('practicing');

  // Below half. `needs_review` is reserved for regression, so a child who has
  // never been independent is `introduced` rather than flagged.
  return summary(previousLevel === 'independent' ? 'needs_review' : 'introduced');
}

/// Counters kept alongside the derived level for the admin projection.
export interface MasteryCounters {
  attempts: number;
  correctAttempts: number;
}

export function masteryCounters(attempts: readonly MasteryAttempt[]): MasteryCounters {
  const scored = scoredAttempts(attempts);
  return {
    attempts: attempts.length,
    correctAttempts: scored.filter((attempt) => accuracy(attempt)! >= MASTERY_ACCURACY_THRESHOLD).length,
  };
}
