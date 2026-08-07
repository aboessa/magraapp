import '../domain/content_models.dart';
import 'content_dtos.dart';
import 'local_catalog.dart';
import 'majarra_api_client.dart';

class ContentRepository {
  const ContentRepository(this._api);

  final MajarraApiClient _api;

  Future<HomeCatalog> loadHome() async {
    List<PlanetDto>? remotePlanets;
    List<SeriesDto>? remoteSeries;
    List<EpisodeDto>? remoteEpisodes;

    Future<void> loadPlanets() async {
      try {
        remotePlanets = await _api.fetchPlanets();
      } on Object {
        remotePlanets = null;
      }
    }

    Future<void> loadSeries() async {
      try {
        remoteSeries = await _api.fetchSeries();
      } on Object {
        remoteSeries = null;
      }
    }

    Future<void> loadEpisodes() async {
      try {
        remoteEpisodes = await _api.fetchEpisodes();
      } on Object {
        remoteEpisodes = null;
      }
    }

    await Future.wait([loadPlanets(), loadSeries(), loadEpisodes()]);

    final hasRemotePlanets = remotePlanets?.isNotEmpty ?? false;
    final hasRemoteSeries = remoteSeries?.isNotEmpty ?? false;
    final hasRemoteEpisodes = remoteEpisodes?.isNotEmpty ?? false;

    final planets = hasRemotePlanets
        ? remotePlanets!
              .asMap()
              .entries
              .map((entry) {
                final fallback = LocalCatalog.planets.firstWhere(
                  (planet) => planet.id == entry.value.id,
                  orElse: () =>
                      LocalCatalog.planets[entry.key %
                          LocalCatalog.planets.length],
                );
                return entry.value.toDomain(imageAsset: fallback.imageAsset);
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
      books: LocalCatalog.books,
      source: source,
    );
  }
}
