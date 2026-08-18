/**
 * Season and series episode counts, derived from canonical episode rows.
 *
 * ## Why this file exists
 *
 * `seasons.episode_count` is not a count of episodes. It is an editorial
 * planning figure: both seed generators wrote the *intended* number of units
 * into it before any episode row existed (`scripts/_audit_load_slate.mjs:91`
 * binds `${items}`, the planned unit count from the slate), and
 * `PATCH /admin/content/seasons/:id` let an operator type any number over it.
 * Nothing ever reconciled it with reality, so 17 seasons ended up advertising
 * 91 episodes that do not exist — see `KIRO_LAST_REPORT.md`, «17-Season Matrix».
 *
 * A planning figure and a content count are different facts about a season, and
 * the defect was that one column carried both. This module keeps them apart:
 *
 * - `planned_episode_count` — the editorial intent. Read from
 *   `seasons.episode_count`, never presented as a number of episodes, and never
 *   sent to a child-facing surface.
 * - `total_episodes` — canonical episode rows in the season, excluding archived
 *   ones. This is "how many episodes exist".
 * - `published_episodes` — of those, the ones the catalogue will serve.
 * - `available_episodes` — of those, the ones that actually have a video source.
 *   A published episode with no media is listed but cannot be watched, and the
 *   distinction matters because the platform currently has **zero** video
 *   assets: `published_episodes` without `available_episodes` would still read
 *   as watchable content.
 *
 * The column keeps its name because renaming it needs a migration, and the
 * migration ledger is unreconciled (`OPS-002`, blocked on `DECIDE-001`). The
 * rename happens in the DTOs instead, which is where the misleading label was
 * actually read.
 */

/// A season's counts as the API reports them.
export interface SeasonEpisodeCounts {
  /// Editorial intent, from `seasons.episode_count`. Not a content count.
  planned_episode_count: number
  /// Canonical, non-archived episode rows belonging to the season.
  total_episodes: number
  /// Rows the catalogue will serve.
  published_episodes: number
  /// Published rows that have a video source and can actually be played.
  available_episodes: number
}

/**
 * Correlated sub-selects producing the three derived counts for a season.
 *
 * Written as SQL rather than resolved per row in TypeScript so a season list
 * stays one query: the seasons list is paginated and joined, and an N+1 count
 * per season is exactly the kind of thing that is fine at 39 seasons and not at
 * 400.
 *
 * `alias` is the table alias of `seasons` in the caller's query. It is
 * interpolated, so it must never come from a request — every call site passes a
 * literal.
 */
export function seasonEpisodeCountSelect(alias: string): string {
  return `
      (SELECT COUNT(*) FROM episodes e WHERE e.season_id = ${alias}.id
        AND e.status <> 'archived') AS total_episodes,
      (SELECT COUNT(*) FROM episodes e WHERE e.season_id = ${alias}.id
        AND e.status = 'published' AND e.is_published = 1) AS published_episodes,
      (SELECT COUNT(*) FROM episodes e WHERE e.season_id = ${alias}.id
        AND e.status = 'published' AND e.is_published = 1
        AND (COALESCE(NULLIF(TRIM(e.video_master_url), ''), NULLIF(TRIM(e.video_hls_1080), '')) IS NOT NULL)
      ) AS available_episodes`
}

/// Normalizes a row carrying the derived columns plus the planning column.
export function seasonEpisodeCounts(row: Record<string, unknown>): SeasonEpisodeCounts {
  const count = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0
  }
  return {
    planned_episode_count: count(row.episode_count),
    total_episodes: count(row.total_episodes),
    published_episodes: count(row.published_episodes),
    available_episodes: count(row.available_episodes),
  }
}

/**
 * Strips the raw planning column out of a spread row and replaces it with the
 * honest four.
 *
 * `SELECT se.*` is used by the admin seasons list, so `episode_count` arrives in
 * the row whether or not the handler wants it. Deleting it here is what stops
 * the old name reaching a client that would render it as "6 حلقة".
 */
export function withSeasonEpisodeCounts<T extends Record<string, unknown>>(
  row: T,
): Omit<T, 'episode_count' | 'total_episodes' | 'published_episodes' | 'available_episodes'> & SeasonEpisodeCounts {
  const counts = seasonEpisodeCounts(row)
  const rest = { ...row }
  delete rest.episode_count
  delete rest.total_episodes
  delete rest.published_episodes
  delete rest.available_episodes
  return { ...rest, ...counts } as Omit<
    T, 'episode_count' | 'total_episodes' | 'published_episodes' | 'available_episodes'
  > & SeasonEpisodeCounts
}

/// One season, as the publish gate needs to see it.
export interface SeasonCountFact extends SeasonEpisodeCounts {
  season_id: string
  season_number: number
  title_ar: string | null
  status: string
}

/// A season whose planning figure claims more episodes than exist.
export interface SeasonCountContradiction {
  season_id: string
  season_number: number
  status: string
  planned_episode_count: number
  total_episodes: number
  missing: number
}

/**
 * Seasons whose stored planning figure exceeds their canonical episode rows.
 *
 * Only an *excess* is a contradiction. A season holding 6 episodes while
 * planning 4 is an editorial plan that was overachieved, which advertises
 * nothing false to a parent; the reverse promises content that does not exist.
 * Archived seasons are ignored because they advertise nothing at all.
 */
export function seasonCountContradictions(seasons: SeasonCountFact[]): SeasonCountContradiction[] {
  return seasons
    .filter((season) => season.status !== 'archived'
      && season.planned_episode_count > season.total_episodes)
    .map((season) => ({
      season_id: season.season_id,
      season_number: season.season_number,
      status: season.status,
      planned_episode_count: season.planned_episode_count,
      total_episodes: season.total_episodes,
      missing: season.planned_episode_count - season.total_episodes,
    }))
}

/// Seasons that are published while holding no episodes at all.
export function emptyPublishedSeasons(seasons: SeasonCountFact[]): SeasonCountFact[] {
  return seasons.filter((season) => season.status === 'published' && season.total_episodes === 0)
}
