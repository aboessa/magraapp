import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../child/application/child_provider.dart';
import '../../home/application/home_providers.dart';

/// One saved playback position, as stored in `content_progress`.
///
/// The app already wrote progress to `POST /api/v1/family/progress` but never
/// read it back, so nothing resumed and "continue watching" had no source. This
/// is the read side of that loop.
class ContentProgress {
  const ContentProgress({
    required this.contentId,
    required this.contentType,
    required this.positionMs,
    required this.durationMs,
    required this.completed,
    this.updatedAt,
  });

  factory ContentProgress.fromJson(Map<String, Object?> json) {
    int number(String key) {
      final raw = json[key];
      if (raw is int) return raw;
      if (raw is num) return raw.toInt();
      if (raw is String) return int.tryParse(raw) ?? 0;
      return 0;
    }

    String text(String key) {
      final raw = json[key];
      return raw is String ? raw.trim() : '';
    }

    final updatedRaw = json['updated_at'];
    return ContentProgress(
      contentId: text('content_id'),
      contentType: text('content_type'),
      positionMs: number('position_ms'),
      durationMs: number('duration_ms'),
      // SQLite stores this as 0/1.
      completed: number('completed') == 1,
      updatedAt: updatedRaw is int
          ? DateTime.fromMillisecondsSinceEpoch(updatedRaw)
          : null,
    );
  }

  final String contentId;
  final String contentType;
  final int positionMs;
  final int durationMs;
  final bool completed;
  final DateTime? updatedAt;

  Duration get position => Duration(milliseconds: positionMs);

  /// 0..1 watched fraction, or null when the duration is unknown.
  double? get fraction {
    if (durationMs <= 0) return null;
    return (positionMs / durationMs).clamp(0.0, 1.0);
  }

  /// Whether this is worth offering as "continue watching".
  ///
  /// Excludes finished items and the first few seconds, so a title the user
  /// merely opened does not clutter the rail.
  bool get isResumable {
    if (completed) return false;
    if (positionMs < 15_000) return false;
    final value = fraction;
    // Past ~95% is effectively finished even if the completion flag never
    // arrived, for example when the app was killed on the closing credits.
    return value == null || value < 0.95;
  }
}

/// Saved progress for the active child, keyed by content id.
///
/// Returns an empty map when no profile is selected or the request fails:
/// progress is an enhancement, so its absence must degrade quietly rather than
/// block the home screen.
final progressProvider = FutureProvider<Map<String, ContentProgress>>((
  ref,
) async {
  final childId = ref.watch(childProvider).activeChildId;
  if (childId == null || childId.isEmpty) return const {};

  final api = ref.watch(majarraApiClientProvider);
  try {
    final rows = await api.fetchProgress(childId: childId);
    final entries = rows.map(ContentProgress.fromJson).where(
      (item) => item.contentId.isNotEmpty,
    );
    return {for (final item in entries) item.contentId: item};
  } catch (_) {
    return const {};
  }
});

/// Resumable items only, newest first — the "continue watching" source.
final resumableProgressProvider = Provider<List<ContentProgress>>((ref) {
  final progress = ref.watch(progressProvider).valueOrNull ?? const {};
  final items = progress.values.where((item) => item.isResumable).toList()
    ..sort((a, b) {
      final left = a.updatedAt;
      final right = b.updatedAt;
      if (left == null || right == null) return 0;
      return right.compareTo(left);
    });
  return items;
});
