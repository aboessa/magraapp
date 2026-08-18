import '../../../core/text/arabic_search.dart';
import '../../home/domain/content_models.dart';

/// Catalogue types that have a real, reachable destination.
enum SearchResultKind { series, episode, game, story, book, planet }

class SearchResult {
  const SearchResult({
    required this.kind,
    required this.id,
    required this.title,
    required this.subtitle,
    required this.route,
    required this.imageAsset,
    required this.relevance,
    this.imageUrl,
  });

  final SearchResultKind kind;
  final String id;
  final String title;
  final String subtitle;
  final String route;
  final String imageAsset;
  final String? imageUrl;
  final int relevance;
}

/// Searches the age-filtered in-memory catalogue and ranks exact title,
/// title-prefix, title-token and metadata matches in that order.
List<SearchResult> searchCatalog(
  HomeCatalog catalog,
  String query, {
  Set<SearchResultKind> kinds = const {},
}) {
  final trimmed = query.trim();
  if (trimmed.isEmpty) return const [];

  final results = <SearchResult>[];
  final seen = <String>{};

  bool includes(SearchResultKind kind) => kinds.isEmpty || kinds.contains(kind);

  void add({
    required SearchResultKind kind,
    required String id,
    required String title,
    required List<String> fields,
    required String subtitle,
    required String route,
    required String imageAsset,
    String? imageUrl,
  }) {
    if (!includes(kind)) return;
    final relevance = _score(trimmed, title, fields);
    if (relevance == 0) return;
    final key = '${kind.name}:$id';
    if (!seen.add(key)) return;
    results.add(
      SearchResult(
        kind: kind,
        id: id,
        title: title,
        subtitle: subtitle,
        route: route,
        imageAsset: imageAsset,
        imageUrl: imageUrl,
        relevance: relevance,
      ),
    );
  }

  for (final series in catalog.series) {
    add(
      kind: SearchResultKind.series,
      id: series.id,
      title: series.title,
      fields: [series.description, series.planetName],
      subtitle: series.episodesCount > 0
          ? '${series.planetName} • ${series.ageLabel} • ${series.episodesCount} حلقة'
          : '${series.planetName} • ${series.ageLabel}',
      route: '/series/${series.id}',
      imageAsset: series.posterAsset,
      imageUrl: series.coverUrl,
    );
  }

  for (final episode in catalog.episodes) {
    add(
      kind: SearchResultKind.episode,
      id: episode.id,
      title: episode.title,
      fields: [episode.description, episode.seriesTitle],
      subtitle: '${episode.seriesTitle} • ${episode.durationLabel}',
      route: '/playback/${episode.id}',
      imageAsset: episode.thumbnailAsset,
      imageUrl: episode.thumbnailUrl,
    );
  }

  for (final game in catalog.experiences) {
    if (!game.isServerBacked) continue;
    add(
      kind: SearchResultKind.game,
      id: game.id,
      title: game.title,
      fields: [game.subtitle, game.difficulty ?? '', game.engineId ?? ''],
      subtitle: game.subtitle,
      route: '/game/${game.id}',
      imageAsset: game.imageAsset,
    );
  }

  for (final story in catalog.stories) {
    add(
      kind: SearchResultKind.story,
      id: story.id,
      title: story.title,
      fields: [story.description, _bookTypeLabel(story.type)],
      subtitle: '${_bookTypeLabel(story.type)} • ${story.ageLabel}',
      route: Uri(
        path: '/reader/${story.id}',
        queryParameters: const {'contentType': 'story'},
      ).toString(),
      imageAsset: 'assets/brand/majarra-logo.png',
      imageUrl: story.coverUrl,
    );
  }

  for (final book in catalog.books) {
    add(
      kind: SearchResultKind.book,
      id: book.id,
      title: book.title,
      fields: [book.description, _bookTypeLabel(book.type)],
      subtitle: '${_bookTypeLabel(book.type)} • ${book.ageLabel}',
      route: book.type == 'audio_story'
          ? Uri(path: '/audio', queryParameters: {'bookId': book.id}).toString()
          : Uri(
              path: '/reader/${book.id}',
              queryParameters: const {'contentType': 'book'},
            ).toString(),
      imageAsset: book.posterAsset,
      imageUrl: book.coverUrl,
    );
  }

  for (final planet in catalog.planets) {
    add(
      kind: SearchResultKind.planet,
      id: planet.id,
      title: planet.name,
      fields: [planet.description],
      subtitle: planet.description.isEmpty ? 'كوكب' : planet.description,
      route: Uri(
        path: '/planets',
        queryParameters: {'planetId': planet.id},
      ).toString(),
      imageAsset: planet.imageAsset,
      imageUrl: planet.iconUrl,
    );
  }

  results.sort((left, right) {
    final byScore = right.relevance.compareTo(left.relevance);
    if (byScore != 0) return byScore;
    final byKind = left.kind.index.compareTo(right.kind.index);
    if (byKind != 0) return byKind;
    return left.title.compareTo(right.title);
  });
  return results;
}

int _score(String query, String title, List<String> fields) {
  final normalizedQuery = ArabicSearch.normalize(query);
  if (normalizedQuery.isEmpty) return 0;
  final normalizedTitle = ArabicSearch.normalize(title);
  final combined = [title, ...fields].join(' ');

  if (normalizedTitle == normalizedQuery) return 500;
  if (normalizedTitle.startsWith(normalizedQuery)) return 420;
  if (normalizedTitle.contains(normalizedQuery)) return 360;
  if (ArabicSearch.matchesAllTokens(query, title)) return 300;
  if (ArabicSearch.matchesAllTokens(query, combined)) return 220;
  return 0;
}

String _bookTypeLabel(String type) => switch (type) {
  'comic' => 'كوميكس',
  'audio_story' => 'قصة صوتية',
  'interactive' => 'قصة تفاعلية',
  _ => 'قصة مصورة',
};
