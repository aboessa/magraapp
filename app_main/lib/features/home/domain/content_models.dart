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
    this.publishedSeries,
    this.publishedOpenable,
  });

  final String id;
  final String name;
  final String description;
  final String colorHex;
  final String imageAsset;
  final String? iconUrl;

  /// How much published content the server counted for this planet, or `null`
  /// when nobody counted (`CNT-106`).
  ///
  /// **`null` is not zero.** The bundled offline catalogue carries no counts, and
  /// reading its silence as "empty" would stamp every planet «قريبًا» the moment
  /// the network drops — announcing an absence that is only an absence of
  /// knowledge. Same rule as the ops metrics: a dash for unknown, a number for
  /// measured.
  final int? publishedSeries;

  /// Published items a child can actually **open** in this planet: episodes,
  /// stories, games and books.
  ///
  /// A series is a folder, so publishing one opens nothing — and episodes alone
  /// misdescribe the shelf in both directions: on the measured data, an
  /// episode-only count calls `maharat` and `tarikh` empty when each holds three
  /// openable items, and calls `qiyam` full when it holds none.
  final int? publishedOpenable;

  /// True only when the server **measured** that nothing here can be opened.
  bool get isMeasuredEmpty => publishedOpenable == 0;
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
    this.bannerUrl,
  });

  final String id;
  final String title;
  final String description;
  final String planetName;
  final String? planetId;
  final String posterAsset;
  final String bannerAsset;
  final String? coverUrl;

  /// البانر العريض (16:9) لصفحة التفاصيل. عند غيابه يُستخدم البوستر.
  final String? bannerUrl;
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

  /// Whether the episode can be opened for playback.
  ///
  /// `videoUrl` لا يصل أبدًا في القائمة — الفيديو يُسلَّم عبر جلسة تشغيل
  /// (`POST /episodes/:id/playback-sessions`) بعد فتح الصفحة، فاشتراطه هنا
  /// كان يجعل **كل** الحلقات «غير قابلة للتشغيل» ويعطّل زر «شاهد الآن».
  /// القائمة تُرجع المنشور فقط، فالوجود في الكتالوج هو القابلية.
  bool get isPlayable => true;

  /// The measured length, or `null` when nobody measured it (`CNT-108`).
  ///
  /// ## Why this used to lie
  ///
  /// It returned «قصيرة» whenever `durationSeconds` was 0 — and every published
  /// episode has no duration recorded, so **every card asserted the episode was
  /// short**. That is not an empty field: it is a claim about the content that
  /// nobody measured, shown to a parent who is choosing something short before bed.
  ///
  /// Unknown now reads as unknown: `null`, and each caller omits the label rather
  /// than inventing one. `home_feed.dart` already did exactly this
  /// (`durationSeconds != null && durationSeconds > 0 ? … : null`), so the pattern
  /// was in the codebase and this getter was the outlier.
  ///
  /// A duration under a minute **is** measured, so it keeps a label — a precise one
  /// rather than the vague word that used to double as "I don't know".
  String? get durationLabel {
    if (durationSeconds <= 0) return null;
    final minutes = durationSeconds ~/ 60;
    return minutes <= 0 ? 'أقل من دقيقة' : '$minutes د';
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
    this.coverUrl,
  });

  final String id;
  final String title;
  final String subtitle;
  /// Local asset path fallback — for Wave4 keep empty to avoid APK bloat, use coverUrl CDN instead
  final String imageAsset;
  /// CDN cover URL — when set, CinematicImage prefers it over assetPath
  final String? coverUrl;
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

/// One narration track declared for a story, keyed by language.
///
/// `assetId` is read verbatim from the API response — today the server
/// (task 8) always sends it as `null`, but the DTO makes no assumption about
/// that and simply carries through whatever value is present.
class StoryNarrator {
  const StoryNarrator({required this.language, this.assetId});

  final String language;
  final String? assetId;
}

/// A minimal reference to a character that appears in a story, used for the
/// story detail screen's cast list. Not the full character catalogue entry.
class StoryCharacterRef {
  const StoryCharacterRef({
    required this.id,
    required this.name,
    this.nameEn,
    this.avatarUrl,
  });

  final String id;
  final String name;
  final String? nameEn;
  final String? avatarUrl;
}

/// A minimal reference to another story shown in a "similar stories" rail.
class SimilarStoryRef {
  const SimilarStoryRef({required this.id, required this.title, this.coverUrl});

  final String id;
  final String title;
  final String? coverUrl;
}

/// Canonical story catalogue item. Stories and books are separate entities and
/// must remain so; this is not a type alias for BookItem.
class StoryItem {
  const StoryItem({
    required this.id,
    this.seriesId,
    required this.title,
    required this.description,
    required this.type,
    required this.ageMin,
    required this.ageMax,
    this.coverUrl,
    this.pagesCount,
    this.readingLevel,
    this.availableLanguages = const [],
    this.narrators = const [],
    this.listenDurationMs,
    this.characters = const [],
    this.similar = const [],
    this.chapters = const [],
    this.activities = const [],
  });

  final String id;
  final String? seriesId;
  final String title;
  final String description;
  final String type;
  final int ageMin;
  final int ageMax;
  final String? coverUrl;
  final int? pagesCount;
  final String? readingLevel;
  final List<String> availableLanguages;
  final List<StoryNarrator> narrators;
  final int? listenDurationMs;
  final List<StoryCharacterRef> characters;
  final List<SimilarStoryRef> similar;

  /// Deliberately opaque until a real structure is designed — the server
  /// always sends an empty array today.
  final List<Map<String, Object?>> chapters;

  /// Deliberately opaque until a real structure is designed — the server
  /// always sends an empty array today.
  final List<Map<String, Object?>> activities;

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

  List<StoryItem> storiesFor(String seriesId) {
    return stories
        .where((item) => item.seriesId == seriesId)
        .toList(growable: false);
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
