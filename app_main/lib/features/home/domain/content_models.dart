import 'package:video_player/video_player.dart' show DurationRange;

enum ContentSource {
  /// Every catalogue endpoint completed successfully, including legitimate
  /// empty responses.
  remote,

  /// At least one endpoint completed live while another collection came from
  /// cache or the bundled catalogue.
  mixed,

  /// No live endpoint was usable and the last validated disk snapshot is shown.
  cached,

  /// No live or cached collection was available, so packaged starter content is
  /// shown explicitly.
  bundled,

  /// Kept for older fixtures and persisted assumptions. New repository code
  /// reports [bundled] instead.
  @Deprecated('Use ContentSource.bundled')
  local,
}

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

class EpisodeAudioTrack {
  const EpisodeAudioTrack({
    required this.language,
    required this.label,
    this.isDefault = false,
  });
  final String language;
  final String label;
  final bool isDefault;
}

class EpisodeSubtitleTrack {
  const EpisodeSubtitleTrack({
    required this.language,
    required this.label,
    this.format = 'vtt',
    this.isDefault = false,
    this.url,
  });
  final String language;
  final String label;
  final String format;
  final bool isDefault;
  final String? url;
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
    this.episodeNumber = 0,
    this.thumbnailUrl,
    this.videoUrl,
    this.captionsUrl,
    this.audioTracks = const [],
    this.subtitleTracks = const [],
    this.introStartMs,
    this.introEndMs,
    this.recapStartMs,
    this.recapEndMs,
    this.creditsStartMs,
    this.previewSpriteUrl,
    this.previewSpriteVttUrl,
    this.qualityRenditions = const [],
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

  /// Optional WebVTT track used by the captions toggle (legacy single).
  final String? captionsUrl;
  final int durationSeconds;
  final int episodeNumber;

  /// Normalized tracks — empty array is valid, never fake EN/FR
  final List<EpisodeAudioTrack> audioTracks;
  final List<EpisodeSubtitleTrack> subtitleTracks;
  final int? introStartMs;
  final int? introEndMs;
  final int? recapStartMs;
  final int? recapEndMs;
  final int? creditsStartMs;
  final String? previewSpriteUrl;
  final String? previewSpriteVttUrl;
  final List<Map<String, Object?>> qualityRenditions;

  bool get isPlayable => (videoUrl ?? '').isNotEmpty;

  String get durationLabel {
    final minutes = durationSeconds ~/ 60;
    return minutes <= 0 ? 'قصيرة' : '$minutes د';
  }

  DurationRange? get introRange {
    if (introStartMs == null || introEndMs == null) return null;
    if (introEndMs! <= introStartMs!) return null;
    return DurationRange(
      Duration(milliseconds: introStartMs!),
      Duration(milliseconds: introEndMs!),
    );
  }

  DurationRange? get recapRange {
    if (recapStartMs == null || recapEndMs == null) return null;
    if (recapEndMs! <= recapStartMs!) return null;
    return DurationRange(
      Duration(milliseconds: recapStartMs!),
      Duration(milliseconds: recapEndMs!),
    );
  }
}

class ExperienceCapabilities {
  const ExperienceCapabilities({this.supportsDpad = false});

  /// Whether the registered engine can be operated with a television remote.
  final bool supportsDpad;
}

class ExperienceItem {
  const ExperienceItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.imageAsset,
    this.planetId,
    this.seriesId,
    this.episodeId,
    this.engineId,
    this.difficulty,
    this.ageMin,
    this.ageMax,
    this.isFree = false,
    this.isServerBacked = false,
    this.capabilities = const ExperienceCapabilities(),
  });

  final String id;
  final String title;
  final String subtitle;
  final String imageAsset;
  final String? planetId;
  final String? seriesId;
  final String? episodeId;
  final String? engineId;
  final String? difficulty;
  final int? ageMin;
  final int? ageMax;
  final bool isFree;

  /// True only for an id returned by the authenticated games catalogue.
  /// Packaged demo slugs deliberately keep the default false value.
  final bool isServerBacked;
  final ExperienceCapabilities capabilities;

  bool get supportsTelevision => isServerBacked && capabilities.supportsDpad;
}

/// How a narration track may be opened by the reader.
enum StoryAudioAccess { unavailable, public, protected }

class StoryTimingCue {
  const StoryTimingCue({required this.startMs, required this.endMs, this.text});

  final int startMs;
  final int endMs;
  final String? text;

  bool isActiveAt(int positionMs) =>
      positionMs >= startMs && positionMs < endMs;
}

class StoryAudioTrack {
  const StoryAudioTrack({
    required this.language,
    required this.kind,
    required this.access,
    this.url,
    this.bubbleId,
  });

  final String language;
  final String kind;
  final StoryAudioAccess access;
  final String? url;
  final String? bubbleId;

  bool get isAvailable => access != StoryAudioAccess.unavailable;
  bool get isProtected => access == StoryAudioAccess.protected;
}

class StoryBubble {
  const StoryBubble({
    required this.id,
    required this.kind,
    required this.positionX,
    required this.positionY,
    required this.width,
    required this.height,
    required this.sortOrder,
    this.text,
    this.tracks = const [],
  });

  final String id;
  final String kind;
  final double positionX;
  final double positionY;
  final double width;
  final double height;
  final int sortOrder;
  final String? text;
  final List<StoryAudioTrack> tracks;

  bool get hasText => (text ?? '').trim().isNotEmpty;
  bool get hasAudio => tracks.any((track) => track.isAvailable);
}

/// One page of a story, as stored in `story_pages` + its requested localisation.
class StoryPage {
  const StoryPage({
    required this.id,
    required this.pageNumber,
    this.layout = 'full_bleed',
    this.transition = 'fade',
    this.bodyText,
    this.altText,
    this.imageUrl,
    this.imageWidth,
    this.imageHeight,
    this.audioUrl,
    this.durationMs,
    this.dwellMs,
    this.translationAvailable = false,
    this.audioAvailable = false,
    this.audioAccess = StoryAudioAccess.unavailable,
    this.timingCues = const [],
    this.bubbles = const [],
    this.tracks = const [],
  });

  final String id;
  final int pageNumber;

  /// `full_bleed` | `split` | `panels` | `text_focus`.
  final String layout;
  final String transition;

  /// Narration duration only — never includes viewing time.
  final int? durationMs;

  /// Post-narration illustration viewing time. Null = legacy (no authored dwell).
  final int? dwellMs;
  final String? bodyText;
  final String? altText;
  final String? imageUrl;
  final int? imageWidth;
  final int? imageHeight;

  /// A direct public narration URL. Protected tracks are resolved through a
  /// short-lived capability session instead and therefore keep this null.
  final String? audioUrl;
  final bool translationAvailable;
  final bool audioAvailable;
  final StoryAudioAccess audioAccess;
  final List<StoryTimingCue> timingCues;
  final List<StoryBubble> bubbles;
  final List<StoryAudioTrack> tracks;

  bool get hasText => (bodyText ?? '').trim().isNotEmpty;
  bool get hasImage => (imageUrl ?? '').trim().isNotEmpty;
  bool get hasAudio => (audioUrl ?? '').trim().isNotEmpty;
  bool get hasProtectedAudio =>
      audioAvailable && audioAccess == StoryAudioAccess.protected;
  bool get canNarrate => hasAudio || hasProtectedAudio;

  /// A page with neither text, art nor a translated bubble cannot be shown.
  bool get isRenderable =>
      hasText || hasImage || bubbles.any((bubble) => bubble.hasText);
}

class ReaderLanguageAvailability {
  const ReaderLanguageAvailability({
    required this.code,
    required this.declared,
    required this.translatedPages,
    required this.narratedPages,
    required this.totalPages,
    required this.translationAvailable,
    required this.translationComplete,
  });

  final String code;
  final bool declared;
  final int translatedPages;
  final int narratedPages;
  final int totalPages;
  final bool translationAvailable;
  final bool translationComplete;
}

class ReaderPageCollection {
  const ReaderPageCollection({
    required this.pages,
    required this.language,
    required this.defaultLanguage,
    required this.languages,
    required this.translationAvailable,
    required this.translationComplete,
  });

  final List<StoryPage> pages;
  final String language;
  final String defaultLanguage;
  final List<ReaderLanguageAvailability> languages;
  final bool translationAvailable;
  final bool translationComplete;
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

/// Canonical story catalogue item. Stories and books are separate entities and
/// must remain so; this is not a type alias for BookItem.
class StoryItem {
  const StoryItem({
    required this.id,
    required this.title,
    required this.description,
    required this.type,
    required this.ageMin,
    required this.ageMax,
    this.coverUrl,
    this.pagesCount,
  });

  final String id;
  final String title;
  final String description;
  final String type;
  final int ageMin;
  final int ageMax;
  final String? coverUrl;
  final int? pagesCount;

  String get ageLabel => '$ageMin–$ageMax سنوات';
}

/// Shared reader abstraction. Stories and books can share the visual reader
/// without sharing a domain model or an endpoint.
enum ReaderContentType { story, book }

class ReaderContent {
  const ReaderContent({
    required this.id,
    required this.contentType,
    required this.title,
    required this.description,
    required this.type,
    required this.coverUrl,
    required this.pages,
  });

  final String id;
  final ReaderContentType contentType;
  final String title;
  final String description;
  final String type;
  final String? coverUrl;
  final List<StoryPage> pages;

  bool get isReadable => pages.any((p) => p.isRenderable);
}

class HomeCatalog {
  const HomeCatalog({
    required this.planets,
    required this.spotlights,
    required this.series,
    required this.episodes,
    required this.experiences,
    this.books = const [],
    this.stories = const [],
    required this.source,
  });

  final List<Planet> planets;
  final List<HomeSpotlight> spotlights;
  final List<SeriesItem> series;
  final List<EpisodeItem> episodes;
  final List<ExperienceItem> experiences;
  final List<BookItem> books;
  final List<StoryItem> stories;
  final ContentSource source;

  /// Whether any part of the screen is backed by cache or packaged content.
  bool get usesLocalFallback => source != ContentSource.remote;

  bool get usesCachedCatalog => source == ContentSource.cached;

  bool get usesBundledCatalog {
    // Compatibility for snapshots written before ContentSource.bundled was
    // introduced; new repository results never emit the deprecated value.
    // ignore: deprecated_member_use_from_same_package
    return source == ContentSource.bundled || source == ContentSource.local;
  }

  /// Content types the home surfaces can actually render. An empty series list
  /// must not hide valid planets, episodes, reading content or trusted games.
  bool get hasRenderableHomeContent =>
      planets.isNotEmpty ||
      series.isNotEmpty ||
      episodes.isNotEmpty ||
      experiences.any((item) => item.isServerBacked) ||
      books.isNotEmpty ||
      stories.isNotEmpty;

  /// Returns a catalogue whose game shelf contains authenticated server rows
  /// only. Existing packaged experiences are intentionally discarded because
  /// their local slugs are not aliases for `games.id`.
  HomeCatalog withServerGames(
    Iterable<ExperienceItem> games, {
    bool requireDpad = false,
  }) {
    final byId = <String, ExperienceItem>{};
    for (final game in games) {
      if (!game.isServerBacked || (requireDpad && !game.supportsTelevision)) {
        continue;
      }
      byId.putIfAbsent(game.id, () => game);
    }
    return HomeCatalog(
      planets: planets,
      spotlights: spotlights,
      series: series,
      episodes: episodes,
      experiences: List<ExperienceItem>.unmodifiable(byId.values),
      books: books,
      stories: stories,
      source: source,
    );
  }

  SeriesItem? seriesById(String id) {
    for (final item in series) {
      if (item.id == id) return item;
    }
    return null;
  }

  StoryItem? storyById(String id) {
    for (final item in stories) {
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
