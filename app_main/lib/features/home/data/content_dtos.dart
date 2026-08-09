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
    this.coverUrl,
  });

  factory SeriesDto.fromJson(Map<String, Object?> json) {
    final id = _text(json['id'], fallback: 'series');
    return SeriesDto(
      id: id,
      title: _text(json['title_ar'], fallback: id),
      description: _text(json['description_ar']),
      planetName: _text(json['planet_name'], fallback: 'مجرة'),
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
      planetId: fallback.planetId,
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

/// One page of reader content from `GET /api/v1/books/:id/pages`.
///
/// Both `bodyText` and `imageUrl` are nullable by design: the API returns a page
/// row even when its localisation or artwork is missing, so the reader can show
/// an honest partial page instead of the caller inventing content.
class StoryPageDto {
  const StoryPageDto({
    required this.id,
    required this.pageNumber,
    required this.layout,
    this.bodyText,
    this.altText,
    this.imageUrl,
    this.durationMs,
  });

  factory StoryPageDto.fromJson(Map<String, Object?> json) {
    final duration = _integer(json['duration_ms']);
    return StoryPageDto(
      id: _text(json['id'], fallback: 'page'),
      pageNumber: _integer(json['page_number'], fallback: 1),
      layout: _text(json['layout'], fallback: 'full_bleed'),
      bodyText: _nullableText(json['body_text']),
      altText: _nullableText(json['alt_text']),
      imageUrl: _nullableText(json['image_url']),
      durationMs: duration <= 0 ? null : duration,
    );
  }

  final String id;
  final int pageNumber;
  final String layout;
  final String? bodyText;
  final String? altText;
  final String? imageUrl;
  final int? durationMs;

  StoryPage toDomain() => StoryPage(
    id: id,
    pageNumber: pageNumber,
    layout: layout,
    bodyText: bodyText,
    altText: altText,
    imageUrl: imageUrl,
    durationMs: durationMs,
  );
}

class BookDto {
  const BookDto({required this.id, required this.title, required this.description, required this.type, required this.ageMin, required this.ageMax, this.coverUrl, this.audioUrl, this.durationSeconds});

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
      audioUrl: _nullableText(json['audio_url']) ??
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
    return BookItem(id: id, title: title, description: description.isEmpty ? fallback.description : description, type: type, coverUrl: coverUrl, ageMin: ageMin, ageMax: ageMax < ageMin ? ageMin : ageMax, posterAsset: fallback.posterAsset, audioUrl: audioUrl ?? fallback.audioUrl, durationSeconds: durationSeconds ?? fallback.durationSeconds);
  }
}

class EpisodeDto {
  const EpisodeDto({
    required this.id,
    required this.seriesId,
    required this.title,
    required this.description,
    required this.seriesTitle,
    required this.durationSeconds,
    this.thumbnailUrl,
    this.videoUrl,
    this.captionsUrl,
  });

  factory EpisodeDto.fromJson(Map<String, Object?> json) {
    final id = _text(json['id'], fallback: 'episode');
    return EpisodeDto(
      id: id,
      seriesId: _text(json['series_id']),
      title: _text(json['title_ar'], fallback: id),
      description: _text(json['description_ar']),
      seriesTitle: _text(json['series_title'], fallback: 'مجرة'),
      durationSeconds: _integer(json['duration_seconds']),
      thumbnailUrl: _nullableText(json['thumbnail_url']),
      // The playback endpoint may name the source either way depending on
      // whether the asset is packaged as HLS or delivered as a single file.
      videoUrl: _nullableText(json['hls_url']) ??
          _nullableText(json['video_url']) ??
          _nullableText(json['playback_url']),
      captionsUrl: _nullableText(json['captions_url']) ??
          _nullableText(json['subtitles_url']),
    );
  }

  final String id;
  final String seriesId;
  final String title;
  final String description;
  final String seriesTitle;
  final int durationSeconds;
  final String? thumbnailUrl;
  final String? videoUrl;
  final String? captionsUrl;

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
    );
  }
}
