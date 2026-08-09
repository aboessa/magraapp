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
    this.videoUrl,
    this.captionsUrl,
  });

  final String id;
  final String seriesId;
  final String title;
  final String description;
  final String seriesTitle;
  final String thumbnailAsset;
  final String? thumbnailUrl;

  /// HLS manifest or progressive MP4 delivered by the playback endpoint.
  /// When null the player shows a poster-only state instead of failing.
  final String? videoUrl;

  /// Optional WebVTT track used by the captions toggle.
  final String? captionsUrl;
  final int durationSeconds;

  bool get isPlayable => (videoUrl ?? '').isNotEmpty;

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

/// One page of a story, as stored in `story_pages` + `story_page_localizations`.
///
/// Both fields are nullable because the seeded content is incomplete: every row
/// in `0013_qisas_pages.sql` has `image_asset_id = NULL`, and only a handful of
/// pages have a localisation row. The reader must therefore render a page that
/// has text but no art, or art but no text, without breaking.
class StoryPage {
  const StoryPage({
    required this.id,
    required this.pageNumber,
    this.layout = 'full_bleed',
    this.bodyText,
    this.altText,
    this.imageUrl,
  });

  final String id;
  final int pageNumber;

  /// `full_bleed` | `split` | `panels` | `text_focus`.
  final String layout;

  /// Page copy in the requested language. Null when no localisation row exists.
  final String? bodyText;

  /// Screen-reader description for the page artwork.
  final String? altText;

  /// Page artwork. Null until an asset is attached in the CMS.
  final String? imageUrl;

  bool get hasText => (bodyText ?? '').trim().isNotEmpty;
  bool get hasImage => (imageUrl ?? '').trim().isNotEmpty;

  /// A page with neither text nor art cannot be shown to a child.
  bool get isRenderable => hasText || hasImage;
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
    this.audioUrl,
    this.durationSeconds,
    this.pages = const [],
  });

  final String id;
  final String title;
  final String description;
  final String type;
  final int ageMin;
  final int ageMax;
  final String posterAsset;
  final String? coverUrl;

  /// Narration track for audio stories. When null the audio player shows a
  /// "not uploaded yet" state instead of faking progress.
  final String? audioUrl;

  /// Track length reported by the API. Null until the asset is processed; the
  /// player then falls back to whatever the decoder reports.
  final int? durationSeconds;

  /// Story pages, in reading order. Empty until the pages endpoint is wired and
  /// the CMS has published content; the reader shows an explicit empty state
  /// rather than substituting a different story.
  final List<StoryPage> pages;

  bool get isPlayable => (audioUrl ?? '').isNotEmpty;

  /// Pages that actually have something to show.
  List<StoryPage> get readablePages =>
      pages.where((page) => page.isRenderable).toList(growable: false);

  bool get isReadable => readablePages.isNotEmpty;

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
