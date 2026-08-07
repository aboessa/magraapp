enum ContentSource { remote, mixed, local }

class Planet {
  const Planet({
    required this.id,
    required this.name,
    required this.description,
    required this.colorHex,
    required this.imageAsset,
    this.iconUrl,
  });

  final String id;
  final String name;
  final String description;
  final String colorHex;
  final String imageAsset;
  final String? iconUrl;
}

/// A deliberately curated item for the cinematic home slider.
/// Only enabled entries in this list may be selected at random by the app.
class HomeSpotlight {
  const HomeSpotlight({
    required this.id,
    required this.seriesId,
    required this.eyebrow,
    required this.primaryActionLabel,
    this.enabled = true,
  });

  final String id;
  final String seriesId;
  final String eyebrow;
  final String primaryActionLabel;
  final bool enabled;
}

class SeriesItem {
  const SeriesItem({
    required this.id,
    required this.title,
    required this.description,
    required this.planetName,
    required this.posterAsset,
    required this.bannerAsset,
    required this.ageMin,
    required this.ageMax,
    required this.episodesCount,
    required this.type,
    required this.isFree,
    this.planetId,
    this.coverUrl,
  });

  final String id;
  final String title;
  final String description;
  final String planetName;
  final String? planetId;
  final String posterAsset;
  final String bannerAsset;
  final String? coverUrl;
  final int ageMin;
  final int ageMax;
  final int episodesCount;
  final String type;
  final bool isFree;

  String get ageLabel => '$ageMin–$ageMax سنوات';
}

class EpisodeItem {
  const EpisodeItem({
    required this.id,
    required this.seriesId,
    required this.title,
    required this.description,
    required this.seriesTitle,
    required this.thumbnailAsset,
    required this.durationSeconds,
    this.thumbnailUrl,
  });

  final String id;
  final String seriesId;
  final String title;
  final String description;
  final String seriesTitle;
  final String thumbnailAsset;
  final String? thumbnailUrl;
  final int durationSeconds;

  String get durationLabel {
    final minutes = durationSeconds ~/ 60;
    return minutes <= 0 ? 'قصيرة' : '$minutes د';
  }
}

class ExperienceItem {
  const ExperienceItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.imageAsset,
    this.planetId,
  });

  final String id;
  final String title;
  final String subtitle;
  final String imageAsset;
  final String? planetId;
}

class BookItem {
  const BookItem({
    required this.id,
    required this.title,
    required this.description,
    required this.type,
    required this.ageMin,
    required this.ageMax,
    required this.posterAsset,
    this.coverUrl,
  });

  final String id;
  final String title;
  final String description;
  final String type;
  final int ageMin;
  final int ageMax;
  final String posterAsset;
  final String? coverUrl;

  String get ageLabel => '$ageMin–$ageMax سنوات';
}

class HomeCatalog {
  const HomeCatalog({
    required this.planets,
    required this.spotlights,
    required this.series,
    required this.episodes,
    required this.experiences,
    this.books = const [],
    required this.source,
  });

  final List<Planet> planets;
  final List<HomeSpotlight> spotlights;
  final List<SeriesItem> series;
  final List<EpisodeItem> episodes;
  final List<ExperienceItem> experiences;
  final List<BookItem> books;
  final ContentSource source;

  bool get usesLocalFallback => source != ContentSource.remote;

  SeriesItem? seriesById(String id) {
    for (final item in series) {
      if (item.id == id) return item;
    }
    return null;
  }

  List<SeriesItem> seriesForPlanet(Planet planet) {
    return series
        .where(
          (item) =>
              item.planetId == planet.id || item.planetName == planet.name,
        )
        .toList(growable: false);
  }

  List<EpisodeItem> episodesFor(String seriesId) {
    return episodes.where((item) => item.seriesId == seriesId).toList();
  }

  List<EpisodeItem> episodesForPlanet(Planet planet) {
    final seriesIds = seriesForPlanet(planet).map((item) => item.id).toSet();
    return episodes
        .where((item) => seriesIds.contains(item.seriesId))
        .toList(growable: false);
  }

  List<ExperienceItem> experiencesForPlanet(Planet planet) {
    return experiences
        .where((item) => item.planetId == planet.id)
        .toList(growable: false);
  }
}
