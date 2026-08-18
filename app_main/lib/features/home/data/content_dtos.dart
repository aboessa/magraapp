import 'dart:convert';

import '../domain/content_models.dart';

String _text(Object? value, {String fallback = ''}) {
  if (value is String && value.trim().isNotEmpty) {
    return _decodeArabicMojibake(value.trim());
  }
  return fallback;
}

/// Repairs Arabic text that an upstream source encoded as UTF-8 and then read
/// as Latin-1 (for example, `Ø£Ø¨Ø¬Ø¯` instead of `أبجد`). The guard keeps
/// IDs, URLs, and correctly encoded content untouched.
String _decodeArabicMojibake(String value) {
  if (!value.contains('Ø') && !value.contains('Ù')) return value;

  final percentEncodedBytes = StringBuffer();
  for (final unit in value.codeUnits) {
    if (unit > 0xff) return value;
    percentEncodedBytes.write('%${unit.toRadixString(16).padLeft(2, '0')}');
  }

  try {
    final repaired = Uri.decodeComponent(percentEncodedBytes.toString());
    final containsArabic = repaired.runes.any(
      (rune) => rune >= 0x0600 && rune <= 0x06ff,
    );
    return containsArabic ? repaired : value;
  } on FormatException {
    return value;
  }
}

String? _nullableText(Object? value) {
  if (value is String && value.trim().isNotEmpty) return value.trim();
  return null;
}

int _integer(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

bool _boolean(Object? value) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) return value == '1' || value.toLowerCase() == 'true';
  return false;
}

class PlanetDto {
  const PlanetDto({
    required this.id,
    required this.name,
    required this.description,
    required this.colorHex,
    this.iconUrl,
  });

  /// Short, verified Arabic presentation labels for the catalog's fixed
  /// planet IDs. Remote content remains a fallback for future, unknown IDs.
  static const _displayNames = <String, String>{
    'abjad': 'أبجد',
    'arqam': 'الأرقام',
    'oloom': 'العلوم',
    'qiyam': 'القيم',
    'qisas': 'القصص',
    'maharat': 'المهارات',
    'tarikh': 'التاريخ',
    'alam': 'عالمنا',
    'islamic': 'الإيمان',
    // Legacy aliases: older LocalCatalog used ibdaa/iman; keep them
    // mapped so cached or offline data does not render as raw IDs.
    'ibdaa': 'عالمنا',
    'iman': 'الإيمان',
  };

  factory PlanetDto.fromJson(Map<String, Object?> json) {
    final id = _text(json['id'], fallback: 'planet');
    final remoteName = _text(json['name_ar'], fallback: id);
    return PlanetDto(
      id: id,
      name: _displayNames[id] ?? remoteName,
      description: _text(
        json['description_ar'],
        fallback: 'رحلة تعليمية مليئة بالاكتشاف',
      ),
      colorHex: _text(json['color_hex'], fallback: '#2856D8'),
      iconUrl: _nullableText(json['icon_url']),
    );
  }

  final String id;
  final String name;
  final String description;
  final String colorHex;
  final String? iconUrl;

  Planet toDomain({required String imageAsset}) {
    return Planet(
      id: id,
      name: name,
      description: description,
      colorHex: colorHex,
      imageAsset: imageAsset,
      iconUrl: iconUrl,
    );
  }
}

class SeriesDto {
  const SeriesDto({
    required this.id,
    required this.title,
    required this.description,
    required this.planetName,
    required this.ageMin,
    required this.ageMax,
    required this.episodesCount,
    required this.type,
    required this.isFree,
    this.planetId,
    this.coverUrl,
  });

  factory SeriesDto.fromJson(Map<String, Object?> json) {
    final id = _text(json['id'], fallback: 'series');
    return SeriesDto(
      id: id,
      title: _text(json['title_ar'], fallback: id),
      description: _text(json['description_ar']),
      planetName: _text(json['planet_name'], fallback: 'مجرة'),
      planetId: _nullableText(json['planet_id']),
      ageMin: _integer(json['age_min'], fallback: 3).clamp(3, 12),
      ageMax: _integer(json['age_max'], fallback: 12).clamp(3, 12),
      episodesCount: _integer(json['episodes_count']),
      type: _text(json['type'], fallback: 'knowledge'),
      isFree: _boolean(json['is_free']),
      coverUrl: _nullableText(json['cover_url']),
    );
  }

  final String id;
  final String title;
  final String description;
  final String planetName;
  final String? planetId;
  final int ageMin;
  final int ageMax;
  final int episodesCount;
  final String type;
  final bool isFree;
  final String? coverUrl;

  SeriesItem toDomain({required SeriesItem fallback}) {
    return SeriesItem(
      id: id,
      title: title,
      description: description.isEmpty ? fallback.description : description,
      planetName: planetName,
      planetId: planetId ?? fallback.planetId,
      posterAsset: fallback.posterAsset,
      bannerAsset: fallback.bannerAsset,
      coverUrl: coverUrl,
      ageMin: ageMin,
      ageMax: ageMax < ageMin ? ageMin : ageMax,
      episodesCount: episodesCount,
      type: type,
      isFree: isFree,
    );
  }
}

/// One row from the authenticated child-specific games catalogue.
///
/// Unlike the older catalogue DTOs this parser has no synthetic id/title
/// fallback: a malformed row is not a playable game and is omitted by
/// `MajarraApiClient.fetchGames`.
class GameSummaryDto {
  const GameSummaryDto({
    required this.id,
    required this.title,
    required this.engine,
    required this.seriesId,
    required this.planetId,
    required this.difficulty,
    required this.ageMin,
    required this.ageMax,
    required this.isFree,
    required this.supportsDpad,
    this.episodeId,
  });

  static const _difficulties = {'easy', 'medium', 'hard'};

  static GameSummaryDto? tryParse(Map<String, Object?> json) {
    final id = _nullableText(json['id']);
    final title = _text(json['title']);
    final engine = _nullableText(json['engine']);
    final seriesId = _nullableText(json['series_id']);
    final episodeId = _nullableText(json['episode_id']);
    final planetId = _nullableText(json['planet_id']);
    final difficulty = _nullableText(json['difficulty']);
    final ageMin = _strictInteger(json['age_min']);
    final ageMax = _strictInteger(json['age_max']);
    final isFree = _strictBoolean(json['is_free']);
    final supportsDpad = _strictBoolean(json['supports_dpad']);

    if (id == null ||
        title.isEmpty ||
        engine == null ||
        seriesId == null ||
        planetId == null ||
        difficulty == null ||
        !_difficulties.contains(difficulty) ||
        ageMin == null ||
        ageMax == null ||
        ageMin < 3 ||
        ageMax > 12 ||
        ageMax < ageMin ||
        isFree == null ||
        supportsDpad == null) {
      return null;
    }

    return GameSummaryDto(
      id: id,
      title: title,
      engine: engine,
      seriesId: seriesId,
      episodeId: episodeId,
      planetId: planetId,
      difficulty: difficulty,
      ageMin: ageMin,
      ageMax: ageMax,
      isFree: isFree,
      supportsDpad: supportsDpad,
    );
  }

  static int? _strictInteger(Object? value) {
    if (value is int) return value;
    if (value is num && value.isFinite && value == value.roundToDouble()) {
      return value.toInt();
    }
    if (value is String && RegExp(r'^\d+$').hasMatch(value.trim())) {
      return int.tryParse(value.trim());
    }
    return null;
  }

  static bool? _strictBoolean(Object? value) {
    if (value is bool) return value;
    if (value == 1 || value == '1' || value == 'true') return true;
    if (value == 0 || value == '0' || value == 'false') return false;
    return null;
  }

  final String id;
  final String title;
  final String engine;
  final String seriesId;
  final String? episodeId;
  final String planetId;
  final String difficulty;
  final int ageMin;
  final int ageMax;
  final bool isFree;
  final bool supportsDpad;

  ExperienceItem toDomain() {
    final difficultyLabel = switch (difficulty) {
      'medium' => 'متوسطة',
      'hard' => 'متقدمة',
      _ => 'سهلة',
    };
    return ExperienceItem(
      id: id,
      title: title,
      subtitle: '$difficultyLabel • $ageMin–$ageMax سنوات',
      imageAsset: 'assets/brand/majarra-logo.png',
      planetId: planetId,
      seriesId: seriesId,
      episodeId: episodeId,
      engineId: engine,
      difficulty: difficulty,
      ageMin: ageMin,
      ageMax: ageMax,
      isFree: isFree,
      isServerBacked: true,
      capabilities: ExperienceCapabilities(supportsDpad: supportsDpad),
    );
  }
}

double _decimal(Object? value, {double fallback = 0}) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

Map<String, Object?> _object(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map<Object?, Object?>) {
    return Map<String, Object?>.from(value);
  }
  return const {};
}

List<Map<String, Object?>> _objectList(Object? value) {
  if (value is! List<Object?>) return const [];
  return value
      .whereType<Map<Object?, Object?>>()
      .map((item) => Map<String, Object?>.from(item))
      .toList(growable: false);
}

StoryAudioAccess _audioAccess(Object? value) {
  return switch (value) {
    'public' => StoryAudioAccess.public,
    'protected' => StoryAudioAccess.protected,
    _ => StoryAudioAccess.unavailable,
  };
}

class StoryTimingCueDto {
  const StoryTimingCueDto({
    required this.startMs,
    required this.endMs,
    this.text,
  });

  factory StoryTimingCueDto.fromJson(Map<String, Object?> json) {
    final start = _integer(json['start_ms'], fallback: -1);
    final authoredEnd = _integer(json['end_ms'], fallback: -1);
    final duration = _integer(json['duration_ms']);
    final end = authoredEnd > start
        ? authoredEnd
        : duration > 0
        ? start + duration
        : start + 1;
    return StoryTimingCueDto(
      startMs: start,
      endMs: end,
      text: _nullableText(json['text'] ?? json['word'] ?? json['token']),
    );
  }

  final int startMs;
  final int endMs;
  final String? text;

  bool get isValid => startMs >= 0 && endMs > startMs;

  StoryTimingCue toDomain() =>
      StoryTimingCue(startMs: startMs, endMs: endMs, text: text);
}

class StoryAudioTrackDto {
  const StoryAudioTrackDto({
    required this.language,
    required this.kind,
    required this.access,
    this.url,
    this.bubbleId,
  });

  factory StoryAudioTrackDto.fromJson(Map<String, Object?> json) {
    return StoryAudioTrackDto(
      language: _text(json['language'], fallback: 'ar'),
      kind: _text(json['kind'], fallback: 'narration'),
      access: _audioAccess(json['access']),
      url: _nullableText(json['url']),
      bubbleId: _nullableText(json['bubble_id']),
    );
  }

  final String language;
  final String kind;
  final StoryAudioAccess access;
  final String? url;
  final String? bubbleId;

  StoryAudioTrack toDomain() => StoryAudioTrack(
    language: language,
    kind: kind,
    access: access,
    url: url,
    bubbleId: bubbleId,
  );
}

class StoryBubbleDto {
  const StoryBubbleDto({
    required this.id,
    required this.kind,
    required this.positionX,
    required this.positionY,
    required this.width,
    required this.height,
    required this.sortOrder,
    required this.tracks,
    this.text,
  });

  factory StoryBubbleDto.fromJson(Map<String, Object?> json) {
    return StoryBubbleDto(
      id: _text(json['id'], fallback: 'bubble'),
      kind: _text(json['kind'], fallback: 'dialogue'),
      positionX: _decimal(json['position_x']).clamp(0, 100),
      positionY: _decimal(json['position_y']).clamp(0, 100),
      width: _decimal(json['width'], fallback: 30).clamp(1, 100),
      height: _decimal(json['height'], fallback: 20).clamp(1, 100),
      sortOrder: _integer(json['sort_order']),
      text: _nullableText(json['text']),
      tracks: _objectList(
        json['tracks'],
      ).map(StoryAudioTrackDto.fromJson).toList(growable: false),
    );
  }

  final String id;
  final String kind;
  final double positionX;
  final double positionY;
  final double width;
  final double height;
  final int sortOrder;
  final String? text;
  final List<StoryAudioTrackDto> tracks;

  StoryBubble toDomain() => StoryBubble(
    id: id,
    kind: kind,
    positionX: positionX,
    positionY: positionY,
    width: width,
    height: height,
    sortOrder: sortOrder,
    text: text,
    tracks: tracks.map((track) => track.toDomain()).toList(growable: false),
  );
}

/// One localized page returned by the reader endpoint.
class StoryPageDto {
  const StoryPageDto({
    required this.id,
    required this.pageNumber,
    required this.layout,
    required this.transition,
    required this.translationAvailable,
    required this.audioAvailable,
    required this.audioAccess,
    required this.timingCues,
    required this.bubbles,
    required this.tracks,
    this.bodyText,
    this.altText,
    this.imageUrl,
    this.imageWidth,
    this.imageHeight,
    this.audioUrl,
    this.durationMs,
    this.dwellMs,
  });

  factory StoryPageDto.fromJson(Map<String, Object?> json) {
    final duration = _integer(json['duration_ms']);
    final dwell = _integer(json['dwell_ms']);
    final audioUrl =
        _nullableText(json['audio_url']) ??
        _nullableText(json['narration_url']);
    final tracks = _objectList(
      json['tracks'],
    ).map(StoryAudioTrackDto.fromJson).toList(growable: false);
    final access = _audioAccess(json['audio_access']);
    return StoryPageDto(
      id: _text(json['id'], fallback: 'page'),
      pageNumber: _integer(json['page_number'], fallback: 1),
      layout: _text(json['layout'], fallback: 'full_bleed'),
      transition: _text(json['transition'], fallback: 'fade'),
      bodyText: _nullableText(json['body_text']),
      altText: _nullableText(json['alt_text']),
      imageUrl: _nullableText(json['image_url']),
      imageWidth: _integer(json['image_width']) > 0
          ? _integer(json['image_width'])
          : null,
      imageHeight: _integer(json['image_height']) > 0
          ? _integer(json['image_height'])
          : null,
      audioUrl: audioUrl,
      durationMs: duration <= 0 ? null : duration,
      dwellMs: dwell <= 0 ? null : dwell,
      translationAvailable: _boolean(json['translation_available']),
      audioAvailable:
          _boolean(json['audio_available']) ||
          audioUrl != null ||
          tracks.any((track) => track.access != StoryAudioAccess.unavailable),
      audioAccess: audioUrl != null ? StoryAudioAccess.public : access,
      timingCues: _objectList(json['timing_cues'])
          .map(StoryTimingCueDto.fromJson)
          .where((cue) => cue.isValid)
          .toList(growable: false),
      bubbles: _objectList(
        json['bubbles'],
      ).map(StoryBubbleDto.fromJson).toList(growable: false),
      tracks: tracks,
    );
  }

  final String id;
  final int pageNumber;
  final String layout;
  final String transition;
  final String? bodyText;
  final String? altText;
  final String? imageUrl;
  final int? imageWidth;
  final int? imageHeight;
  final String? audioUrl;
  final int? durationMs;
  final int? dwellMs;
  final bool translationAvailable;
  final bool audioAvailable;
  final StoryAudioAccess audioAccess;
  final List<StoryTimingCueDto> timingCues;
  final List<StoryBubbleDto> bubbles;
  final List<StoryAudioTrackDto> tracks;

  StoryPage toDomain() => StoryPage(
    id: id,
    pageNumber: pageNumber,
    layout: layout,
    transition: transition,
    bodyText: bodyText,
    altText: altText,
    imageUrl: imageUrl,
    imageWidth: imageWidth,
    imageHeight: imageHeight,
    audioUrl: audioUrl,
    durationMs: durationMs,
    dwellMs: dwellMs,
    translationAvailable: translationAvailable,
    audioAvailable: audioAvailable,
    audioAccess: audioAccess,
    timingCues: timingCues.map((cue) => cue.toDomain()).toList(growable: false),
    bubbles: bubbles.map((bubble) => bubble.toDomain()).toList(growable: false),
    tracks: tracks.map((track) => track.toDomain()).toList(growable: false),
  );
}

class ReaderLanguageAvailabilityDto {
  const ReaderLanguageAvailabilityDto({
    required this.code,
    required this.declared,
    required this.translatedPages,
    required this.narratedPages,
    required this.totalPages,
    required this.translationAvailable,
    required this.translationComplete,
  });

  factory ReaderLanguageAvailabilityDto.fromJson(Map<String, Object?> json) {
    return ReaderLanguageAvailabilityDto(
      code: _text(json['code'], fallback: 'ar'),
      declared: _boolean(json['declared']),
      translatedPages: _integer(json['translated_pages']),
      narratedPages: _integer(json['narrated_pages']),
      totalPages: _integer(json['total_pages']),
      translationAvailable: _boolean(json['translation_available']),
      translationComplete: _boolean(json['translation_complete']),
    );
  }

  final String code;
  final bool declared;
  final int translatedPages;
  final int narratedPages;
  final int totalPages;
  final bool translationAvailable;
  final bool translationComplete;

  ReaderLanguageAvailability toDomain() => ReaderLanguageAvailability(
    code: code,
    declared: declared,
    translatedPages: translatedPages,
    narratedPages: narratedPages,
    totalPages: totalPages,
    translationAvailable: translationAvailable,
    translationComplete: translationComplete,
  );
}

class ReaderPageCollectionDto {
  const ReaderPageCollectionDto({
    required this.pages,
    required this.language,
    required this.defaultLanguage,
    required this.languages,
    required this.translationAvailable,
    required this.translationComplete,
  });

  factory ReaderPageCollectionDto.fromEnvelope(
    Map<String, dynamic> envelope, {
    required String requestedLanguage,
  }) {
    final pages = _objectList(
      envelope['data'],
    ).map(StoryPageDto.fromJson).toList(growable: false);
    final meta = _object(envelope['meta']);
    final languages = _objectList(
      meta['languages'],
    ).map(ReaderLanguageAvailabilityDto.fromJson).toList(growable: false);
    final hasRequestedTranslation = pages.any(
      (page) => page.translationAvailable || page.bodyText != null,
    );
    return ReaderPageCollectionDto(
      pages: pages,
      language: _text(meta['language'], fallback: requestedLanguage),
      defaultLanguage: _text(
        meta['default_language'],
        fallback: requestedLanguage,
      ),
      languages: languages.isNotEmpty
          ? languages
          : [
              ReaderLanguageAvailabilityDto(
                code: requestedLanguage,
                declared: true,
                translatedPages: hasRequestedTranslation ? pages.length : 0,
                narratedPages: pages
                    .where((page) => page.audioAvailable)
                    .length,
                totalPages: pages.length,
                translationAvailable: hasRequestedTranslation,
                translationComplete:
                    pages.isNotEmpty &&
                    pages.every((page) => page.translationAvailable),
              ),
            ],
      translationAvailable: meta.containsKey('translation_available')
          ? _boolean(meta['translation_available'])
          : hasRequestedTranslation,
      translationComplete: meta.containsKey('translation_complete')
          ? _boolean(meta['translation_complete'])
          : pages.isNotEmpty &&
                pages.every((page) => page.translationAvailable),
    );
  }

  final List<StoryPageDto> pages;
  final String language;
  final String defaultLanguage;
  final List<ReaderLanguageAvailabilityDto> languages;
  final bool translationAvailable;
  final bool translationComplete;

  ReaderPageCollection toDomain() => ReaderPageCollection(
    pages: pages.map((page) => page.toDomain()).toList(growable: false),
    language: language,
    defaultLanguage: defaultLanguage,
    languages: languages.map((item) => item.toDomain()).toList(growable: false),
    translationAvailable: translationAvailable,
    translationComplete: translationComplete,
  );
}

class BookDto {
  const BookDto({
    required this.id,
    required this.title,
    required this.description,
    required this.type,
    required this.ageMin,
    required this.ageMax,
    this.coverUrl,
    this.audioUrl,
    this.durationSeconds,
  });

  factory BookDto.fromJson(Map<String, Object?> json) {
    final id = _text(json['id'], fallback: 'book');
    final duration = _integer(json['duration_seconds']);
    return BookDto(
      id: id,
      title: _text(json['title_ar'], fallback: id),
      description: _text(json['description_ar']),
      type: _text(json['type'], fallback: 'picture_book'),
      ageMin: _integer(json['age_min'], fallback: 3).clamp(3, 12),
      ageMax: _integer(json['age_max'], fallback: 12).clamp(3, 12),
      coverUrl: _nullableText(json['cover_url']),
      // Narration source. Accepts either naming the API may use depending on
      // whether the track is packaged standalone or alongside the story pages.
      audioUrl:
          _nullableText(json['audio_url']) ??
          _nullableText(json['narration_url']),
      durationSeconds: duration <= 0 ? null : duration,
    );
  }

  final String id;
  final String title;
  final String description;
  final String type;
  final int ageMin;
  final int ageMax;
  final String? coverUrl;
  final String? audioUrl;
  final int? durationSeconds;

  BookItem toDomain({required BookItem fallback}) {
    return BookItem(
      id: id,
      title: title,
      description: description.isEmpty ? fallback.description : description,
      type: type,
      coverUrl: coverUrl,
      ageMin: ageMin,
      ageMax: ageMax < ageMin ? ageMin : ageMax,
      posterAsset: fallback.posterAsset,
      audioUrl: audioUrl ?? fallback.audioUrl,
      durationSeconds: durationSeconds ?? fallback.durationSeconds,
    );
  }
}

/// Canonical story catalogue row. Stories and books are separate entities and
/// must remain so; this is not a type alias for BookDto.
class StoryDto {
  const StoryDto({
    required this.id,
    required this.title,
    required this.description,
    required this.type,
    required this.ageMin,
    required this.ageMax,
    this.coverUrl,
  });

  factory StoryDto.fromJson(Map<String, Object?> json) {
    final id = _text(json['id'], fallback: 'story');
    return StoryDto(
      id: id,
      title: _text(json['title_ar'], fallback: id),
      description: _text(json['description_ar']),
      type: _text(json['type'], fallback: 'picture_book'),
      ageMin: _integer(json['age_min'], fallback: 3).clamp(3, 12),
      ageMax: _integer(json['age_max'], fallback: 12).clamp(3, 12),
      coverUrl: _nullableText(json['cover_url']),
    );
  }

  final String id;
  final String title;
  final String description;
  final String type;
  final int ageMin;
  final int ageMax;
  final String? coverUrl;
}

class EpisodeAudioTrackDto {
  const EpisodeAudioTrackDto({
    required this.language,
    required this.label,
    required this.isDefault,
    this.assetId,
  });
  factory EpisodeAudioTrackDto.fromJson(Map<String, Object?> json) =>
      EpisodeAudioTrackDto(
        language: _text(json['language'], fallback: 'ar'),
        label:
            _nullableText(json['label']) ??
            _text(json['language'], fallback: 'ar'),
        isDefault: json['is_default'] == 1 || json['is_default'] == true,
        assetId: _nullableText(json['asset_id']),
      );
  final String language;
  final String label;
  final bool isDefault;
  final String? assetId;
}

class EpisodeSubtitleTrackDto {
  const EpisodeSubtitleTrackDto({
    required this.language,
    required this.label,
    required this.format,
    required this.isDefault,
    this.assetId,
    this.legacyUrl,
  });
  factory EpisodeSubtitleTrackDto.fromJson(
    Map<String, Object?> json,
  ) => EpisodeSubtitleTrackDto(
    language: _text(json['language'], fallback: 'ar'),
    label:
        _nullableText(json['label']) ?? _text(json['language'], fallback: 'ar'),
    format: _text(json['format'], fallback: 'vtt'),
    isDefault: json['is_default'] == 1 || json['is_default'] == true,
    assetId: _nullableText(json['asset_id']),
    legacyUrl: _nullableText(json['legacy_url']) ?? _nullableText(json['url']),
  );
  final String language;
  final String label;
  final String format;
  final bool isDefault;
  final String? assetId;
  final String? legacyUrl;
}

class EpisodeDto {
  const EpisodeDto({
    required this.id,
    required this.seriesId,
    required this.title,
    required this.description,
    required this.seriesTitle,
    required this.durationSeconds,
    this.episodeNumber = 0,
    this.thumbnailUrl,
    this.videoUrl,
    this.captionsUrl,
    this.audioTracks = const [],
    this.subtitleTracks = const [],
    this.qualityRenditions = const [],
    this.introStartMs,
    this.introEndMs,
    this.recapStartMs,
    this.recapEndMs,
    this.creditsStartMs,
    this.previewSpriteUrl,
    this.previewSpriteVttUrl,
  });

  factory EpisodeDto.fromJson(Map<String, Object?> json) {
    final id = _text(json['id'], fallback: 'episode');
    // Detail endpoint nests episode under `episode` key — support both shapes
    final root = json.containsKey('episode') && json['episode'] is Map
        ? Map<String, Object?>.from(json['episode'] as Map)
        : json;
    // Also handle wrapped publication with audio_tracks at root
    List<EpisodeAudioTrackDto> audios = _objectList(
      json['audio_tracks'],
    ).map(EpisodeAudioTrackDto.fromJson).toList();
    if (audios.isEmpty) {
      audios = _objectList(
        root['audio_tracks'],
      ).map(EpisodeAudioTrackDto.fromJson).toList();
    }
    List<EpisodeSubtitleTrackDto> subs = _objectList(
      json['subtitle_tracks'],
    ).map(EpisodeSubtitleTrackDto.fromJson).toList();
    if (subs.isEmpty) {
      subs = _objectList(
        root['subtitle_tracks'],
      ).map(EpisodeSubtitleTrackDto.fromJson).toList();
    }
    // legacy fallback from flat captions_ar_url / dubs if no normalized tracks
    if (audios.isEmpty) {
      final dubsRaw = root['dubs'];
      List<String> dubs = [];
      if (dubsRaw is String) {
        try {
          dubs = (jsonDecode(dubsRaw) as List).whereType<String>().toList();
        } catch (_) {}
      } else if (dubsRaw is List) {
        dubs = dubsRaw.whereType<String>().toList();
      }
      if (dubs.isEmpty &&
          (root['captions_ar_url'] != null || root['captionsUrl'] != null)) {
        dubs = ['ar'];
      }
      audios = dubs
          .take(3)
          .map(
            (l) => EpisodeAudioTrackDto(
              language: l,
              label: l == 'ar'
                  ? 'العربية'
                  : l == 'en'
                  ? 'English'
                  : 'Français',
              isDefault: l == dubs.first,
              assetId: null,
            ),
          )
          .toList();
    }
    if (subs.isEmpty && _nullableText(root['captions_ar_url']) != null) {
      subs = [
        EpisodeSubtitleTrackDto(
          language: 'ar',
          label: 'العربية',
          format: 'vtt',
          isDefault: true,
          legacyUrl: _nullableText(root['captions_ar_url']),
        ),
      ];
    }
    // intro/recap ranges may be at root or nested
    int? introS = root['intro_start_ms'] is int
        ? root['intro_start_ms'] as int
        : (root['intro_start_ms'] is num
              ? (root['intro_start_ms'] as num).toInt()
              : null);
    int? introE = root['intro_end_ms'] is int
        ? root['intro_end_ms'] as int
        : (root['intro_end_ms'] is num
              ? (root['intro_end_ms'] as num).toInt()
              : null);
    if (root.containsKey('intro_range') && root['intro_range'] is Map) {
      final ir = root['intro_range'] as Map;
      introS = (ir['start_ms'] as num?)?.toInt() ?? introS;
      introE = (ir['end_ms'] as num?)?.toInt() ?? introE;
    }
    // quality renditions
    List<Map<String, Object?>> quals = _objectList(root['quality_renditions']);
    if (quals.isEmpty) quals = _objectList(json['quality_renditions']);
    // preview sprite
    String? sprite = _nullableText(root['preview_sprite_url']);
    String? spriteVtt = _nullableText(root['preview_sprite_vtt_url']);
    if (root['preview_sprite'] is Map) {
      final ps = root['preview_sprite'] as Map;
      sprite = _nullableText(ps['url']) ?? sprite;
      spriteVtt = _nullableText(ps['vtt_url']) ?? spriteVtt;
    }
    return EpisodeDto(
      id: id,
      seriesId: _text(root['series_id']),
      title: _text(root['title_ar'], fallback: id),
      description: _text(root['description_ar']),
      seriesTitle: _text(root['series_title'], fallback: 'مجرة'),
      durationSeconds: _integer(root['duration_seconds']),
      episodeNumber: _integer(root['episode_number']),
      thumbnailUrl: _nullableText(root['thumbnail_url']),
      videoUrl:
          _nullableText(root['hls_url']) ??
          _nullableText(root['video_url']) ??
          _nullableText(root['playback_url']),
      captionsUrl:
          _nullableText(root['captions_ar_url']) ??
          _nullableText(root['subtitles_url']),
      audioTracks: audios,
      subtitleTracks: subs,
      qualityRenditions: quals,
      introStartMs: introS,
      introEndMs: introE,
      recapStartMs: root['recap_start_ms'] is num
          ? (root['recap_start_ms'] as num).toInt()
          : null,
      recapEndMs: root['recap_end_ms'] is num
          ? (root['recap_end_ms'] as num).toInt()
          : null,
      creditsStartMs: root['credits_start_ms'] is num
          ? (root['credits_start_ms'] as num).toInt()
          : null,
      previewSpriteUrl: sprite,
      previewSpriteVttUrl: spriteVtt,
    );
  }

  final String id;
  final String seriesId;
  final String title;
  final String description;
  final String seriesTitle;
  final int durationSeconds;
  final int episodeNumber;
  final String? thumbnailUrl;
  final String? videoUrl;
  final String? captionsUrl;
  final List<EpisodeAudioTrackDto> audioTracks;
  final List<EpisodeSubtitleTrackDto> subtitleTracks;
  final List<Map<String, Object?>> qualityRenditions;
  final int? introStartMs;
  final int? introEndMs;
  final int? recapStartMs;
  final int? recapEndMs;
  final int? creditsStartMs;
  final String? previewSpriteUrl;
  final String? previewSpriteVttUrl;

  EpisodeItem toDomain({required EpisodeItem fallback}) {
    return EpisodeItem(
      id: id,
      seriesId: seriesId.isEmpty ? fallback.seriesId : seriesId,
      title: title,
      description: description.isEmpty ? fallback.description : description,
      seriesTitle: seriesTitle,
      thumbnailAsset: fallback.thumbnailAsset,
      thumbnailUrl: thumbnailUrl,
      videoUrl: videoUrl ?? fallback.videoUrl,
      captionsUrl: captionsUrl ?? fallback.captionsUrl,
      durationSeconds: durationSeconds <= 0
          ? fallback.durationSeconds
          : durationSeconds,
      episodeNumber: episodeNumber > 0 ? episodeNumber : fallback.episodeNumber,
      audioTracks: audioTracks
          .map(
            (e) => EpisodeAudioTrack(
              language: e.language,
              label: e.label,
              isDefault: e.isDefault,
            ),
          )
          .toList(),
      subtitleTracks: subtitleTracks
          .map(
            (e) => EpisodeSubtitleTrack(
              language: e.language,
              label: e.label,
              format: e.format,
              isDefault: e.isDefault,
              url: e.legacyUrl,
            ),
          )
          .toList(),
      introStartMs: introStartMs,
      introEndMs: introEndMs,
      recapStartMs: recapStartMs,
      recapEndMs: recapEndMs,
      creditsStartMs: creditsStartMs,
      previewSpriteUrl: previewSpriteUrl,
      previewSpriteVttUrl: previewSpriteVttUrl,
      qualityRenditions: qualityRenditions,
    );
  }
}
