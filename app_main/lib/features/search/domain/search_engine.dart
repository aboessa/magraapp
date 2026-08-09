import '../../../core/text/arabic_search.dart';
import '../../home/domain/content_models.dart';

/// The kind of catalogue entity a [SearchResult] points at. Drives the icon,
/// the section grouping, and the navigation target.
enum SearchResultKind { series, episode, book, game, planet }

/// One normalised search hit, independent of the underlying model so the UI can
/// render a mixed result list without switching on five concrete types.
class SearchResult {
  const SearchResult({
    required this.kind,
    required this.id,
    required this.title,
    required this.subtitle,
    required this.route,
  });

  final SearchResultKind kind;
  final String id;
  final String title;
  final String subtitle;

  /// The go_router location to push when the result is tapped.
  final String route;
}

/// Searches the whole in-memory catalogue across content types (§10).
///
/// The previous search matched only `series` by raw `toLowerCase().contains`.
/// This walks series, episodes, books, games (experiences) and planets, matches
/// with [ArabicSearch] so diacritics and alef/te-marbuta variants fold, and
/// requires every query token to appear so a two-word query narrows rather than
/// widens.
///
/// It searches the catalogue it is given. The caller passes the age-filtered
/// catalogue for the active child, so eligibility and rights are already applied
/// upstream — this function never widens what the child may see.
List<SearchResult> searchCatalog(HomeCatalog catalog, String query) {
  final trimmed = query.trim();
  if (trimmed.isEmpty) return const [];

  final results = <SearchResult>[];
  final seen = <String>{};

  void add(SearchResult r) {
    final key = '${r.kind.name}:${r.id}';
    if (seen.add(key)) results.add(r);
  }

  bool hit(List<String> fields) =>
      fields.any((f) => ArabicSearch.matchesAllTokens(trimmed, f));

  for (final s in catalog.series) {
    if (hit([s.title, s.description, s.planetName])) {
      add(SearchResult(
        kind: SearchResultKind.series,
        id: s.id,
        title: s.title,
        subtitle: s.planetName,
        route: '/series/${s.id}',
      ));
    }
  }

  for (final e in catalog.episodes) {
    if (hit([e.title, e.description, e.seriesTitle])) {
      add(SearchResult(
        kind: SearchResultKind.episode,
        id: e.id,
        title: e.title,
        subtitle: e.seriesTitle,
        route: '/playback/${e.id}',
      ));
    }
  }

  for (final b in catalog.books) {
    if (hit([b.title, b.description])) {
      // A book routes to the reader; audio books also have an audio route, but
      // the reader is the safe default and offers the listen action itself.
      add(SearchResult(
        kind: SearchResultKind.book,
        id: b.id,
        title: b.title,
        subtitle: b.type == 'comic' ? 'قصة مصوّرة' : 'قصة',
        route: '/reader/${b.id}',
      ));
    }
  }

  for (final x in catalog.experiences) {
    if (hit([x.title, x.subtitle])) {
      add(SearchResult(
        kind: SearchResultKind.game,
        id: x.id,
        title: x.title,
        subtitle: x.subtitle,
        route: '/game/${x.id}',
      ));
    }
  }

  for (final p in catalog.planets) {
    if (hit([p.name, p.description])) {
      add(SearchResult(
        kind: SearchResultKind.planet,
        id: p.id,
        title: p.name,
        subtitle: 'كوكب',
        route: '/planets?planetId=${p.id}',
      ));
    }
  }

  return results;
}
