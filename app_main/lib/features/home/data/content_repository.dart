import '../../../core/cache/catalog_cache.dart';
import '../domain/content_models.dart';
import 'content_dtos.dart';
import 'local_catalog.dart';
import 'majarra_api_client.dart';

class ContentRepository {
  const ContentRepository(this._api, {CatalogCache cache = const CatalogCache()})
    : _cache = cache;

  final MajarraApiClient _api;
  final CatalogCache _cache;

  Future<HomeCatalog> loadHome() async {
    List<PlanetDto>? remotePlanets;
    List<SeriesDto>? remoteSeries;
    List<EpisodeDto>? remoteEpisodes;
    List<BookDto>? remoteBooks;

    // Raw rows kept alongside the parsed DTOs so a successful fetch can be
    // written to disk without re-serialising the domain models.
    List<Map<String, Object?>>? planetRows;
    List<Map<String, Object?>>? seriesRows;
    List<Map<String, Object?>>? episodeRows;
    List<Map<String, Object?>>? bookRows;

    Future<void> loadPlanets() async {
      try {
        planetRows = await _api.fetchPlanetRows();
        remotePlanets = planetRows!.map(PlanetDto.fromJson).toList(growable: false);
      } on Object {
        remotePlanets = null;
      }
    }

    Future<void> loadSeries() async {
      try {
        seriesRows = await _api.fetchSeriesRows();
        remoteSeries = seriesRows!.map(SeriesDto.fromJson).toList(growable: false);
      } on Object {
        remoteSeries = null;
      }
    }

    Future<void> loadEpisodes() async {
      try {
        episodeRows = await _api.fetchEpisodeRows();
        remoteEpisodes = episodeRows!.map(EpisodeDto.fromJson).toList(growable: false);
      } on Object {
        remoteEpisodes = null;
      }
    }

    // Books were previously never requested: `loadHome` only fetched planets,
    // series and episodes, then always used `LocalCatalog.books`. The public
    // `/api/v1/books` endpoint now exists, so the library can come from the API.
    Future<void> loadBooks() async {
      try {
        bookRows = await _api.fetchBookRows();
        remoteBooks = bookRows!.map(BookDto.fromJson).toList(growable: false);
      } on Object {
        remoteBooks = null;
      }
    }

    await Future.wait([
      loadPlanets(),
      loadSeries(),
      loadEpisodes(),
      loadBooks(),
    ]);

    // Disk cache (H6).
    //
    // Substituted only for the collections the network failed to return, and
    // only when nothing at all came back for them. A partial live response is
    // always preferred over cached rows for the same collection, because mixing
    // a fresh series list with a stale episode list can produce episodes whose
    // parent series no longer exists.
    final anythingLive = (remotePlanets?.isNotEmpty ?? false) ||
        (remoteSeries?.isNotEmpty ?? false) ||
        (remoteEpisodes?.isNotEmpty ?? false) ||
        (remoteBooks?.isNotEmpty ?? false);

    if (anythingLive) {
      // Write-through. Awaited so a cold start immediately followed by a kill
      // still persists; the write is a single small `shared_preferences` entry.
      await _cache.save(
        CachedCatalog(
          planets: planetRows ?? const [],
          series: seriesRows ?? const [],
          episodes: episodeRows ?? const [],
          books: bookRows ?? const [],
        ),
      );
    } else {
      final cached = await _cache.read();
      if (cached != null) {
        remotePlanets = cached.planets.map(PlanetDto.fromJson).toList(growable: false);
        remoteSeries = cached.series.map(SeriesDto.fromJson).toList(growable: false);
        remoteEpisodes = cached.episodes.map(EpisodeDto.fromJson).toList(growable: false);
        remoteBooks = cached.books.map(BookDto.fromJson).toList(growable: false);
      }
    }

    final hasRemotePlanets = remotePlanets?.isNotEmpty ?? false;
    final hasRemoteSeries = remoteSeries?.isNotEmpty ?? false;
    final hasRemoteEpisodes = remoteEpisodes?.isNotEmpty ?? false;

    // Planet image fallback must never assign a wrong planet's artwork.
    // Using index % length (the previous code) would show a random planet
    // when the server introduces a new ID.
    const neutralPlanetImage = 'assets/images/planets/planet-abjad.webp';
    final planets = hasRemotePlanets
        ? remotePlanets!
              .map((dto) {
                final fallback = LocalCatalog.planets
                    .where((planet) => planet.id == dto.id)
                    .firstOrNull;
                return dto.toDomain(
                  imageAsset: fallback?.imageAsset ?? neutralPlanetImage,
                );
              })
              .toList(growable: false)
        : LocalCatalog.planets;

    final remoteSeriesItems = hasRemoteSeries
        ? remoteSeries!
              .asMap()
              .entries
              .map((entry) {
                final fallback =
                    LocalCatalog.series[entry.key % LocalCatalog.series.length];
                return entry.value.toDomain(fallback: fallback);
              })
              .toList(growable: false)
        : const <SeriesItem>[];
    final remoteSeriesIds = remoteSeriesItems.map((item) => item.id).toSet();
    final remoteEpisodeItems = hasRemoteEpisodes
        ? remoteEpisodes!
              .where((dto) => remoteSeriesIds.contains(dto.seriesId))
              .toList(growable: false)
              .asMap()
              .entries
              .map((entry) {
                final fallback = LocalCatalog
                    .episodes[entry.key % LocalCatalog.episodes.length];
                return entry.value.toDomain(fallback: fallback);
              })
              .toList(growable: false)
        : const <EpisodeItem>[];

    // Series and episodes are one relational boundary. Falling back separately
    // can display episodes whose parent series is absent, so both switch together.
    final hasConsistentRemoteLibrary =
        remoteSeriesItems.isNotEmpty && remoteEpisodeItems.isNotEmpty;
    final series = hasConsistentRemoteLibrary
        ? remoteSeriesItems
        : LocalCatalog.series;
    final episodes = hasConsistentRemoteLibrary
        ? remoteEpisodeItems
        : LocalCatalog.episodes;

    // Books are an independent collection: unlike episodes they do not require a
    // parent series to be renderable, so they can come from the API even when the
    // series library falls back to local content.
    final hasRemoteBooks = remoteBooks?.isNotEmpty ?? false;
    final books = hasRemoteBooks
        ? remoteBooks!
              .asMap()
              .entries
              .map((entry) {
                final fallback = LocalCatalog
                    .books[entry.key % LocalCatalog.books.length];
                return entry.value.toDomain(fallback: fallback);
              })
              .toList(growable: false)
        : LocalCatalog.books;

    final source = hasRemotePlanets && hasConsistentRemoteLibrary
        ? ContentSource.remote
        : !hasRemotePlanets && !hasConsistentRemoteLibrary
        ? ContentSource.local
        : ContentSource.mixed;

    return HomeCatalog(
      planets: planets,
      spotlights: LocalCatalog.spotlights,
      series: series,
      episodes: episodes,
      experiences: LocalCatalog.experiences,
      books: books,
      source: source,
    );
  }
}
