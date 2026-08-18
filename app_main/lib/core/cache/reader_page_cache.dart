import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Which reader endpoint a cached page list came from.
///
/// Stories and books are separate entities with separate endpoints, so their
/// cache entries must never collide.
enum ReaderPageCacheKind {
  story,
  book;

  String get token => this == ReaderPageCacheKind.story ? 'story' : 'book';
}

/// Disk cache for reader page lists, stored as the exact public API envelope.
///
/// Keeping the raw envelope means every page field survives verbatim —
/// including `duration_ms` (narration) and `dwell_ms` (illustration viewing
/// time) — so an offline reader gets the same timing as an online one with no
/// network access during playback.
///
/// Only public catalogue data is stored. Protected narration is fetched through
/// short-lived audio sessions, so no capability token or signed media URL ever
/// reaches this cache.
class ReaderPageCache {
  const ReaderPageCache();

  static const _prefix = 'majarra_reader_pages_v1';

  /// Page text and timing change only when an editor publishes a new version,
  /// so a long window is safe; a stale page is far better than a blank reader.
  static const Duration ttl = Duration(days: 30);

  static String keyFor({
    required ReaderPageCacheKind kind,
    required String contentId,
    required String language,
  }) => '$_prefix.${kind.token}.$contentId.${language.toLowerCase()}';

  Future<void> save({
    required ReaderPageCacheKind kind,
    required String contentId,
    required String language,
    required Map<String, dynamic> envelope,
  }) async {
    // An empty page list is a legitimate API answer ("no published pages"), but
    // it must not overwrite a snapshot that still has pages.
    final data = envelope['data'];
    if (data is! List || data.isEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        keyFor(kind: kind, contentId: contentId, language: language),
        jsonEncode({
          'saved_at': DateTime.now().millisecondsSinceEpoch,
          'envelope': envelope,
        }),
      );
    } catch (_) {
      // A cache write must never break a successful page load.
    }
  }

  /// Returns the cached envelope, or null when absent, expired or unreadable.
  Future<Map<String, dynamic>?> read({
    required ReaderPageCacheKind kind,
    required String contentId,
    required String language,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(
        keyFor(kind: kind, contentId: contentId, language: language),
      );
      if (raw == null) return null;
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final savedAt = decoded['saved_at'];
      if (savedAt is! int) return null;
      final age = DateTime.now().millisecondsSinceEpoch - savedAt;
      if (age < 0 || age > ttl.inMilliseconds) return null;
      final envelope = decoded['envelope'];
      if (envelope is! Map) return null;
      return envelope.cast<String, dynamic>();
    } catch (_) {
      return null;
    }
  }

  Future<void> clear({
    required ReaderPageCacheKind kind,
    required String contentId,
    required String language,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(
        keyFor(kind: kind, contentId: contentId, language: language),
      );
    } catch (_) {
      // Nothing actionable; the TTL bounds any entry that survives.
    }
  }

  /// Removes every cached page list.
  ///
  /// Called from account teardown. Page text is public catalogue data rather
  /// than a child's private record, but a shared device must not carry one
  /// family's reading material into the next family's session, and a stale
  /// snapshot must not outlive the entitlement that allowed it to be fetched.
  Future<void> clearAll() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs
          .getKeys()
          .where((key) => key.startsWith(_prefix))
          .toList(growable: false);
      for (final key in keys) {
        await prefs.remove(key);
      }
    } catch (_) {
      // Teardown continues; every other store is attempted independently.
    }
  }
}
