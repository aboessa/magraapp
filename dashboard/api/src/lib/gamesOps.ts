/// The games operations overview: what exists, what is blocked, and on whom.
///
/// ## Why this is a module and not a query in a route
///
/// The numbers a content lead needs are not one aggregation. "How many games are
/// ready" cannot be answered by `SELECT status`, because `draft` says where a row
/// is in the workflow and nothing about whether it *could* move — a draft with
/// every asset delivered and every review approved is a publish away, and a draft
/// with no artwork is a quarter away. Reporting them as one number is how a plan
/// gets built on a status column.
///
/// So readiness here is the real thing: [evaluatePublishReadiness] run per game
/// against real rows, then bucketed. That is more expensive than a `GROUP BY`, and
/// it is the only version that is true.
///
/// ## Two rules
///
///  1. **Every number comes from data.** Nothing in this file counts to twelve
///     because there are twelve engines; the engine total is the number of rows in
///     `game_engines`, and coverage is the intersection of that with the runtime
///     registry. A constant that happens to be right today is a constant that is
///     silently wrong after the thirteenth engine.
///  2. **A game appears in every bucket that applies.** The readiness buckets are
///     deliberately *not* a partition: a game can be missing artwork and audio and
///     a review at once, and forcing it into one bucket would make three of the
///     four numbers useless for planning. `blocked_total` is the distinct count,
///     so the two readings are both available and cannot be confused.

import { evaluatePublishReadiness, type PublishReadiness, type ReadinessInput } from './publishReadiness.ts';

/// The three age tracks and their bounds.
///
/// From `children_profiles.age_track`'s CHECK constraint plus the age bands the
/// content documents use. Games carry `age_min`/`age_max` rather than a track, so
/// a game belongs to every track its range touches — a 5–7 game is genuinely both
/// `preschool` and `kids`, and rounding it to one would hide it from half the
/// catalogue planning.
export const AGE_TRACK_BOUNDS: ReadonlyArray<{ id: string; min: number; max: number }> = [
  { id: 'preschool', min: 3, max: 5 },
  { id: 'kids', min: 6, max: 8 },
  { id: 'junior', min: 9, max: 12 },
];

/// Tracks whose band overlaps a game's age range.
export function tracksForAgeRange(ageMin: number, ageMax: number): string[] {
  if (!Number.isFinite(ageMin) || !Number.isFinite(ageMax) || ageMin > ageMax) return [];
  return AGE_TRACK_BOUNDS
    .filter((track) => ageMin <= track.max && ageMax >= track.min)
    .map((track) => track.id);
}

/// The readiness buckets, and what puts a game in each.
export type ReadinessBucket =
  /// Nothing blocks publication.
  | 'ready'
  /// At least one check blocks, for any reason.
  | 'blocked'
  | 'missing_assets'
  | 'missing_audio'
  | 'missing_localization'
  | 'missing_review'
  | 'engine_not_implemented';

/// Which check ids feed which bucket.
///
/// Declared as a table rather than as branches so a new check has one obvious
/// place to be classified, and an unclassified blocker still lands in `blocked`
/// instead of vanishing from the board.
const BUCKET_FOR_CHECK: Record<string, ReadinessBucket> = {
  engine: 'engine_not_implemented',
  implementation: 'engine_not_implemented',
  assets: 'missing_assets',
  production_assets: 'missing_assets',
  audio: 'missing_audio',
  localization_ar: 'missing_localization',
  localization_en: 'missing_localization',
  localization_fr: 'missing_localization',
  linguistic_review: 'missing_review',
  scientific_review: 'missing_review',
  historical_review: 'missing_review',
  music_rights: 'missing_review',
  arabic_font_license: 'missing_review',
  qa: 'missing_review',
};

export interface GamesOpsGame {
  id: string;
  title: string;
  engineId: string;
  status: string;
  ageMin: number;
  ageMax: number;
  planetId: string | null;
  planetName: string | null;
  /// The readiness input gathered for this game, or null when it could not be
  /// gathered. Null is reported as an unevaluated game rather than as a ready
  /// one: "we do not know" must never round to "fine".
  readinessInput: ReadinessInput | null;
}

export interface GamesOpsInput {
  games: readonly GamesOpsGame[];
  /// `game_engines.id` — the catalogue's own list, from a query.
  catalogueEngineIds: readonly string[];
  /// Engines this deployment can actually run, from `enginesWithRuntimeSchema()`.
  implementedEngineIds: readonly string[];
  /// Games with at least one `pending` row in `content_reviews`, from a query.
  gameIdsAwaitingReview: readonly string[];
  /// Statuses that count as published, from the catalogue's own vocabulary rather
  /// than assumed here.
  publishedStatuses?: readonly string[];
}

export interface BlockerCount {
  check_id: string;
  label_ar: string;
  games: number;
  owners: string[];
}

export interface GamesOpsOverview {
  total_games: number;
  by_planet: Array<{ planet_id: string | null; planet_name: string | null; games: number }>;
  by_engine: Array<{ engine_id: string; games: number; implemented: boolean }>;
  by_age_track: Array<{ track_id: string; games: number }>;
  by_status: Array<{ status: string; games: number }>;
  readiness_buckets: Record<ReadinessBucket, number>;
  /// Games whose readiness could not be evaluated at all.
  unevaluated_games: number;
  engine_coverage: {
    implemented: number;
    total: number;
    /// Engines in the catalogue with no runtime here. Named, because a count of
    /// missing engines is not actionable and a list is.
    missing: string[];
    /// Runtimes with no catalogue row, which is the opposite defect and just as
    /// worth seeing.
    unregistered: string[];
  };
  top_blockers: BlockerCount[];
  games_awaiting_review: number;
  draft_count: number;
  publishable_count: number;
  published_count: number;
  /// Per-game verdict, so the board can drill in without a second round trip.
  games: Array<{
    game_id: string;
    title: string;
    engine_id: string;
    status: string;
    age_min: number;
    age_max: number;
    age_tracks: string[];
    planet_id: string | null;
    publishable: boolean | null;
    buckets: ReadinessBucket[];
    blocking_reasons: string[];
  }>;
}

function increment<K extends string>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/// Buckets one game's readiness.
export function bucketsFor(readiness: PublishReadiness): ReadinessBucket[] {
  const blocked = readiness.checks.filter((check) => check.status === 'blocked');
  if (!blocked.length) return ['ready'];

  const buckets = new Set<ReadinessBucket>(['blocked']);
  for (const check of blocked) {
    const bucket = BUCKET_FOR_CHECK[check.id];
    if (bucket) buckets.add(bucket);
  }
  return [...buckets];
}

export function buildGamesOpsOverview(input: GamesOpsInput): GamesOpsOverview {
  const publishedStatuses = input.publishedStatuses ?? ['published'];
  const awaitingReview = new Set(input.gameIdsAwaitingReview);

  const planets = new Map<string, { planet_id: string | null; planet_name: string | null; games: number }>();
  const engines = new Map<string, number>();
  const tracks = new Map<string, number>();
  const statuses = new Map<string, number>();
  const buckets = new Map<ReadinessBucket, number>();
  const blockerGames = new Map<string, { label: string; games: number; owners: Set<string> }>();

  for (const bucket of [
    'ready', 'blocked', 'missing_assets', 'missing_audio',
    'missing_localization', 'missing_review', 'engine_not_implemented',
  ] as ReadinessBucket[]) {
    buckets.set(bucket, 0);
  }
  for (const track of AGE_TRACK_BOUNDS) tracks.set(track.id, 0);

  let unevaluated = 0;
  let publishable = 0;
  const gameRows: GamesOpsOverview['games'] = [];

  for (const game of input.games) {
    const planetKey = game.planetId ?? '__unassigned__';
    const planetEntry = planets.get(planetKey)
      ?? { planet_id: game.planetId, planet_name: game.planetName, games: 0 };
    planetEntry.games += 1;
    planets.set(planetKey, planetEntry);

    increment(engines, game.engineId);
    increment(statuses, game.status);
    const gameTracks = tracksForAgeRange(game.ageMin, game.ageMax);
    for (const track of gameTracks) increment(tracks, track);

    let readiness: PublishReadiness | null = null;
    if (game.readinessInput) {
      readiness = evaluatePublishReadiness(game.readinessInput);
    } else {
      unevaluated += 1;
    }

    const gameBuckets = readiness ? bucketsFor(readiness) : [];
    for (const bucket of gameBuckets) increment(buckets, bucket);
    if (readiness?.publishable) publishable += 1;

    if (readiness) {
      for (const check of readiness.checks) {
        if (check.status !== 'blocked') continue;
        const entry = blockerGames.get(check.id)
          ?? { label: check.label_ar, games: 0, owners: new Set<string>() };
        entry.games += 1;
        if (check.owner) entry.owners.add(check.owner);
        blockerGames.set(check.id, entry);
      }
    }

    gameRows.push({
      game_id: game.id,
      title: game.title,
      engine_id: game.engineId,
      status: game.status,
      age_min: game.ageMin,
      age_max: game.ageMax,
      age_tracks: gameTracks,
      planet_id: game.planetId,
      publishable: readiness ? readiness.publishable : null,
      buckets: gameBuckets,
      blocking_reasons: readiness ? readiness.blocking_reasons : [],
    });
  }

  const implemented = new Set(input.implementedEngineIds);
  const catalogue = new Set(input.catalogueEngineIds);

  return {
    total_games: input.games.length,
    by_planet: [...planets.values()].sort((a, b) => b.games - a.games),
    by_engine: [...engines.entries()]
      .map(([engine_id, games]) => ({ engine_id, games, implemented: implemented.has(engine_id) }))
      .sort((a, b) => b.games - a.games),
    by_age_track: AGE_TRACK_BOUNDS.map((track) => ({
      track_id: track.id,
      games: tracks.get(track.id) ?? 0,
    })),
    by_status: [...statuses.entries()]
      .map(([status, games]) => ({ status, games }))
      .sort((a, b) => b.games - a.games),
    readiness_buckets: Object.fromEntries(buckets) as Record<ReadinessBucket, number>,
    unevaluated_games: unevaluated,
    engine_coverage: {
      implemented: [...catalogue].filter((id) => implemented.has(id)).length,
      total: catalogue.size,
      missing: [...catalogue].filter((id) => !implemented.has(id)).sort(),
      unregistered: [...implemented].filter((id) => !catalogue.has(id)).sort(),
    },
    top_blockers: [...blockerGames.entries()]
      .map(([check_id, entry]) => ({
        check_id,
        label_ar: entry.label,
        games: entry.games,
        owners: [...entry.owners].sort(),
      }))
      .sort((a, b) => b.games - a.games || a.check_id.localeCompare(b.check_id)),
    games_awaiting_review: input.games.filter((game) => awaitingReview.has(game.id)).length,
    draft_count: statuses.get('draft') ?? 0,
    publishable_count: publishable,
    published_count: publishedStatuses.reduce((total, status) => total + (statuses.get(status) ?? 0), 0),
    games: gameRows,
  };
}
