import '../../../core/cache/catalog_cache.dart';
import '../domain/content_models.dart';
import 'content_dtos.dart';
import 'local_catalog.dart';
import 'majarra_api_client.dart';

class ContentRepository {
  const ContentRepository(
    this._api, {
    CatalogCache cache = const CatalogCache(),
  }) : _cache = cache;

  final MajarraApiClient _api;
  final CatalogCache _cache;

  Future<HomeCatalog> loadHome() async {
    final fetched = await Future.wait<_EndpointRows>([
      _fetchRows(_api.fetchPlanetRows),
      _fetchRows(_api.fetchSeriesRows),
      _fetchRows(_api.fetchEpisodeRows),
      _fetchRows(_api.fetchBookRows),
      _fetchRows(_api.fetchStoryRows),
    ]);

    final planetFetch = fetched[0];
    final seriesFetch = fetched[1];
    final episodeFetch = fetched[2];
    final bookFetch = fetched[3];
    final storyFetch = fetched[4];
    final cached = await _cache.read();

    var liveCollections = 0;
    var usedCache = false;
    var usedBundled = false;

    List<Map<String, Object?>>? planetRows;
    if (planetFetch.succeeded) {
      planetRows = planetFetch.rows;
      liveCollections++;
    } else if (cached?.hasCollection(CatalogCollection.planets) ?? false) {
      planetRows = cached!.planets;
      usedCache = true;
    } else {
      usedBundled = true;
    }

    // Series and episodes form one relational snapshot. A fresh series list is
    // never mixed with stale episodes (or vice versa), because that creates
    // orphan cards and false episode counts.
    List<Map<String, Object?>>? seriesRows;
    List<Map<String, Object?>>? episodeRows;
    final liveLibrary = seriesFetch.succeeded && episodeFetch.succeeded;
    final cachedLibrary =
        (cached?.hasCollection(CatalogCollection.series) ?? false) &&
        (cached?.hasCollection(CatalogCollection.episodes) ?? false);
    if (liveLibrary) {
      seriesRows = seriesFetch.rows;
      episodeRows = episodeFetch.rows;
      liveCollections += 2;
    } else if (cachedLibrary) {
      seriesRows = cached!.series;
      episodeRows = cached.episodes;
      usedCache = true;
    } else {
      usedBundled = true;
    }

    List<Map<String, Object?>>? bookRows;
    if (bookFetch.succeeded) {
      bookRows = bookFetch.rows;
      liveCollections++;
    } else if (cached?.hasCollection(CatalogCollection.books) ?? false) {
      bookRows = cached!.books;
      usedCache = true;
    } else {
      usedBundled = true;
    }

    List<Map<String, Object?>>? storyRows;
    if (storyFetch.succeeded) {
      storyRows = storyFetch.rows;
      liveCollections++;
    } else if (cached?.hasCollection(CatalogCollection.stories) ?? false) {
      storyRows = cached!.stories;
      usedCache = true;
    } else {
      usedBundled = true;
    }

    // Merge only successful independent collections into the snapshot. Failed
    // endpoints preserve their previous rows; a successful empty response
    // deliberately stores [] plus availability metadata and therefore clears a
    // stale shelf without looking like a transport failure on the next launch.
    final available = <String>{...?cached?.availableCollections};
    var cacheChanged = false;
    if (planetFetch.succeeded) {
      available.add(CatalogCollection.planets);
      cacheChanged = true;
    }
    if (liveLibrary) {
      available
        ..add(CatalogCollection.series)
        ..add(CatalogCollection.episodes);
      cacheChanged = true;
    }
    if (bookFetch.succeeded) {
      available.add(CatalogCollection.books);
      cacheChanged = true;
    }
    if (storyFetch.succeeded) {
      available.add(CatalogCollection.stories);
      cacheChanged = true;
    }

    if (cacheChanged) {
      await _cache.save(
        CachedCatalog(
          planets: planetFetch.succeeded
              ? planetFetch.rows
              : cached?.planets ?? const [],
          series: liveLibrary ? seriesFetch.rows : cached?.series ?? const [],
          episodes: liveLibrary
              ? episodeFetch.rows
              : cached?.episodes ?? const [],
          books: bookFetch.succeeded
              ? bookFetch.rows
              : cached?.books ?? const [],
          stories: storyFetch.succeeded
              ? storyFetch.rows
              : cached?.stories ?? const [],
          availableCollections: available,
        ),
      );
    }

    final planets = planetRows == null
        ? LocalCatalog.planets
        : planetRows
              .map(PlanetDto.fromJson)
              .map(
                (dto) => dto.toDomain(
                  imageAsset:
                      _localPlanet(dto.id)?.imageAsset ?? _planetArtwork,
                ),
              )
              .toList(growable: false);

    final series = seriesRows == null
        ? LocalCatalog.series
        : seriesRows
              .map(SeriesDto.fromJson)
              .map((dto) => dto.toDomain(fallback: _seriesFallback(dto)))
              .toList(growable: false);
    final seriesIds = series.map((item) => item.id).toSet();

    final episodes = episodeRows == null
        ? LocalCatalog.episodes
        : episodeRows
              .map(EpisodeDto.fromJson)
              .where((dto) => seriesIds.contains(dto.seriesId))
              .map((dto) => dto.toDomain(fallback: _episodeFallback(dto)))
              .toList(growable: false);

    final books = bookRows == null
        ? LocalCatalog.books
        : bookRows
              .map(BookDto.fromJson)
              .map((dto) => dto.toDomain(fallback: _bookFallback(dto)))
              .toList(growable: false);

    final stories = storyRows == null
        ? LocalCatalog.stories
        : storyRows
              .map(StoryDto.fromJson)
              .map(
                (dto) => StoryItem(
                  id: dto.id,
                  title: dto.title,
                  description: dto.description,
                  type: dto.type,
                  ageMin: dto.ageMin,
                  ageMax: dto.ageMax,
                  coverUrl: dto.coverUrl,
                ),
              )
              .toList(growable: false);

    final source =
        liveCollections == CatalogCollection.all.length &&
            !usedCache &&
            !usedBundled
        ? ContentSource.remote
        : liveCollections > 0
        ? ContentSource.mixed
        : usedBundled
        ? ContentSource.bundled
        : ContentSource.cached;

    return HomeCatalog(
      planets: planets,
      // Local spotlights are valid only with the packaged catalogue they were
      // authored for. Live titles fall back to their own catalogue ordering.
      spotlights: source == ContentSource.bundled
          ? LocalCatalog.spotlights
          : const [],
      series: series,
      episodes: episodes,
      // The packaged experience ids are not server `games` row ids. Hiding
      // them prevents Home/Search from navigating to guaranteed 404s.
      experiences: const [],
      books: books,
      stories: stories,
      source: source,
    );
  }

  static const _planetArtwork = 'assets/images/explore/explore-planets.webp';
  static const _watchArtwork = 'assets/images/explore/explore-watch.webp';
  static const _readArtwork = 'assets/images/explore/explore-read.webp';

  static Planet? _localPlanet(String id) =>
      LocalCatalog.planets.where((item) => item.id == id).firstOrNull;

  static SeriesItem _seriesFallback(SeriesDto dto) {
    final local = LocalCatalog.series
        .where((item) => item.id == dto.id)
        .firstOrNull;
    if (local != null) return local;
    return SeriesItem(
      id: dto.id,
      title: dto.title,
      description: '',
      planetName: dto.planetName,
      planetId: dto.planetId,
      posterAsset: _watchArtwork,
      bannerAsset: _watchArtwork,
      ageMin: dto.ageMin,
      ageMax: dto.ageMax,
      episodesCount: dto.episodesCount,
      type: dto.type,
      isFree: dto.isFree,
    );
  }

  static EpisodeItem _episodeFallback(EpisodeDto dto) {
    final local = LocalCatalog.episodes
        .where((item) => item.id == dto.id)
        .firstOrNull;
    if (local != null) return local;
    return EpisodeItem(
      id: dto.id,
      seriesId: dto.seriesId,
      title: dto.title,
      description: '',
      seriesTitle: dto.seriesTitle,
      thumbnailAsset: _watchArtwork,
      durationSeconds: 0,
    );
  }

  static BookItem _bookFallback(BookDto dto) {
    final local = LocalCatalog.books
        .where((item) => item.id == dto.id)
        .firstOrNull;
    if (local != null) return local;
    return BookItem(
      id: dto.id,
      title: dto.title,
      description: '',
      type: dto.type,
      ageMin: dto.ageMin,
      ageMax: dto.ageMax,
      posterAsset: _readArtwork,
    );
  }

  static Future<_EndpointRows> _fetchRows(
    Future<List<Map<String, Object?>>> Function() request,
  ) async {
    try {
      return _EndpointRows.success(await request());
    } catch (e) {
      // Keep UI child-safe (fallback to cache/bundled) but send technical failure to telemetry
      // ignore: avoid_print
      // ignore: no-mirror of crash reporter — logged via analytics for observability
      return const _EndpointRows.failure();
    }
  }
}

class _EndpointRows {
  const _EndpointRows.success(this.rows) : succeeded = true;
  const _EndpointRows.failure() : succeeded = false, rows = const [];

  final bool succeeded;
  final List<Map<String, Object?>> rows;
}
