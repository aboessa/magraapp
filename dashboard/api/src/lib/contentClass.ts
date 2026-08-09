/// Separating platform test fixtures from Majarra production content.
///
/// Some catalogue rows exist only to exercise the platform: the Mazen & Thaaloub series and its
/// videos were supplied as external material so upload, R2 storage, asset linking, streaming,
/// playback sessions and player behaviour could be tested end to end. They are useful and must
/// not be deleted, but they are not Majarra content: they must never be counted in production
/// content figures, presented as a Majarra Original, or shipped in a public release.
///
/// `series.content_class` carries this, added in migration 0018. It lives on `series` because
/// series is the parent of episodes, stories, books, games and characters, so one predicate
/// reaches all of them through a join and there is no second copy to keep in sync.
///
/// Why a column and not a naming convention: a slug check is a guess that silently stops working
/// the moment someone renames a series or adds a second fixture. A constrained column cannot be
/// got wrong by accident, and it can be indexed.

export const CONTENT_CLASSES = ['production', 'test_fixture'] as const;
export type ContentClass = (typeof CONTENT_CLASSES)[number];

export function isContentClass(value: unknown): value is ContentClass {
  return typeof value === 'string' && (CONTENT_CLASSES as readonly string[]).includes(value);
}

/// Whether the public catalogue should serve test fixtures.
///
/// Default is NO, so a misconfigured or unset environment fails closed and production never
/// leaks test material. Local development opts in explicitly, because the fixture videos are the
/// only real media in the system and the player cannot be tested without them.
export function shouldServeTestFixtures(env: {
  ENVIRONMENT?: string;
  INCLUDE_TEST_FIXTURES?: string;
}): boolean {
  const flag = String(env.INCLUDE_TEST_FIXTURES ?? '').trim().toLowerCase();
  if (flag === 'true' || flag === '1') {
    // Never honour the opt-in in production, whatever the variable says.
    return String(env.ENVIRONMENT ?? '').trim().toLowerCase() !== 'production';
  }
  return false;
}

/// SQL predicate restricting a query to production content.
///
/// Returns an empty string when fixtures are allowed so callers can interpolate unconditionally.
/// [seriesAlias] is the alias of the `series` table in the caller's query. It is never taken from
/// request input — callers pass a literal — so this cannot be used to inject SQL.
export function contentClassPredicate(
  seriesAlias: string,
  serveTestFixtures: boolean,
): string {
  if (serveTestFixtures) return '';
  return ` AND ${seriesAlias}.content_class = 'production'`;
}
