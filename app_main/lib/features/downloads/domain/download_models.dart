import 'dart:convert';

/// Lifecycle of a single download (§4).
enum DownloadStatus { queued, downloading, paused, ready, expired, failed }

extension DownloadStatusX on DownloadStatus {
  String get wireName => name;

  static DownloadStatus fromWire(String? value) {
    return DownloadStatus.values.firstWhere(
      (s) => s.name == value,
      orElse: () => DownloadStatus.failed,
    );
  }

  /// Arabic label for the status chip.
  String get label => switch (this) {
        DownloadStatus.queued => 'في الانتظار',
        DownloadStatus.downloading => 'يُحمّل',
        DownloadStatus.paused => 'متوقّف مؤقتًا',
        DownloadStatus.ready => 'جاهز',
        DownloadStatus.expired => 'انتهت الصلاحية',
        DownloadStatus.failed => 'فشل',
      };

  bool get isPlayable => this == DownloadStatus.ready;
  bool get isActive => this == DownloadStatus.downloading || this == DownloadStatus.queued;
}

/// A downloaded (or downloading) item, plus everything needed to play it back
/// offline, verify entitlement, and expire it.
class DownloadItem {
  const DownloadItem({
    required this.id,
    required this.childId,
    required this.contentType,
    required this.title,
    required this.subtitle,
    required this.sourceUrl,
    required this.fileName,
    required this.status,
    required this.receivedBytes,
    required this.totalBytes,
    required this.createdAt,
    this.expiresAt,
    this.posterUrl,
    this.quality,
  });

  final String id;

  /// The profile that downloaded it. Downloads are per child so one profile's
  /// offline library is never attributed to another.
  final String childId;

  /// `episode` | `audio_story` | `book`.
  final String contentType;
  final String title;
  final String subtitle;

  /// The URL the bytes came from. Kept for retry/resume.
  final String sourceUrl;

  /// Encrypted file name within the downloads directory.
  final String fileName;

  final DownloadStatus status;
  final int receivedBytes;
  final int totalBytes;
  final int createdAt;

  /// Offline licence expiry. After this the item is unplayable and swept.
  final int? expiresAt;
  final String? posterUrl;
  final String? quality;

  double get progress {
    if (totalBytes <= 0) return status == DownloadStatus.ready ? 1 : 0;
    return (receivedBytes / totalBytes).clamp(0.0, 1.0);
  }

  bool isExpired([DateTime? now]) {
    final at = expiresAt;
    if (at == null) return false;
    return (now ?? DateTime.now()).millisecondsSinceEpoch >= at;
  }

  DownloadItem copyWith({
    DownloadStatus? status,
    int? receivedBytes,
    int? totalBytes,
    int? expiresAt,
  }) {
    return DownloadItem(
      id: id,
      childId: childId,
      contentType: contentType,
      title: title,
      subtitle: subtitle,
      sourceUrl: sourceUrl,
      fileName: fileName,
      status: status ?? this.status,
      receivedBytes: receivedBytes ?? this.receivedBytes,
      totalBytes: totalBytes ?? this.totalBytes,
      createdAt: createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
      posterUrl: posterUrl,
      quality: quality,
    );
  }

  Map<String, Object?> toJson() => {
        'id': id,
        'child_id': childId,
        'content_type': contentType,
        'title': title,
        'subtitle': subtitle,
        'source_url': sourceUrl,
        'file_name': fileName,
        'status': status.wireName,
        'received_bytes': receivedBytes,
        'total_bytes': totalBytes,
        'created_at': createdAt,
        'expires_at': expiresAt,
        'poster_url': posterUrl,
        'quality': quality,
      };

  factory DownloadItem.fromJson(Map<String, Object?> json) {
    int intOf(String k) {
      final v = json[k];
      if (v is int) return v;
      if (v is num) return v.toInt();
      if (v is String) return int.tryParse(v) ?? 0;
      return 0;
    }

    return DownloadItem(
      id: json['id'] as String? ?? '',
      childId: json['child_id'] as String? ?? '',
      contentType: json['content_type'] as String? ?? 'episode',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      sourceUrl: json['source_url'] as String? ?? '',
      fileName: json['file_name'] as String? ?? '',
      status: DownloadStatusX.fromWire(json['status'] as String?),
      receivedBytes: intOf('received_bytes'),
      totalBytes: intOf('total_bytes'),
      createdAt: intOf('created_at'),
      expiresAt: json['expires_at'] == null ? null : intOf('expires_at'),
      posterUrl: json['poster_url'] as String?,
      quality: json['quality'] as String?,
    );
  }

  static String encodeList(List<DownloadItem> items) =>
      jsonEncode(items.map((e) => e.toJson()).toList());

  static List<DownloadItem> decodeList(String? raw) {
    if (raw == null || raw.isEmpty) return const [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const [];
    return decoded
        .whereType<Map<String, dynamic>>()
        .map((m) => DownloadItem.fromJson(m.cast<String, Object?>()))
        .toList();
  }
}

/// Formats a byte count as a short human label (e.g. "12.4 م.ب").
String formatBytes(int bytes) {
  if (bytes <= 0) return '0 ب';
  const units = ['ب', 'ك.ب', 'م.ب', 'غ.ب'];
  var size = bytes.toDouble();
  var unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  final rounded = unit == 0 ? size.toStringAsFixed(0) : size.toStringAsFixed(1);
  return '$rounded ${units[unit]}';
}
