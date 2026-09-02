import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Names of independently fetched catalogue collections.
abstract final class CatalogCollection {
  static const planets = 'planets';
  static const series = 'series';
  static const episodes = 'episodes';
  static const books = 'books';
  static const stories = 'stories';

  static const all = <String>{planets, series, episodes, books, stories};
}

/// Raw catalogue rows as returned by the public API, exactly as cached.
///
/// [availableCollections] records successful endpoint responses separately from
/// row count. This is important because an empty successful response means
/// "there is no published content", while a missing collection means the
/// request failed and a fallback may be used.
class CachedCatalog {
  const CachedCatalog({
    required this.planets,
    required this.series,
    required this.episodes,
    required this.books,
    this.stories = const [],
    this.availableCollections = const {},
  });

  final List<Map<String, Object?>> planets;
  final List<Map<String, Object?>> series;
  final List<Map<String, Object?>> episodes;
  final List<Map<String, Object?>> books;
  final List<Map<String, Object?>> stories;
  final Set<String> availableCollections;

  /// Older cache/test payloads did not store availability metadata. A non-empty
  /// row list still proves that collection existed and remains readable.
  bool hasCollection(String name) {
    if (availableCollections.contains(name)) return true;
    return switch (name) {
      CatalogCollection.planets => planets.isNotEmpty,
      CatalogCollection.series => series.isNotEmpty,
      CatalogCollection.episodes => episodes.isNotEmpty,
      CatalogCollection.books => books.isNotEmpty,
      CatalogCollection.stories => stories.isNotEmpty,
      _ => false,
    };
  }

  bool get isEmpty =>
      availableCollections.isEmpty &&
      planets.isEmpty &&
      series.isEmpty &&
      episodes.isEmpty &&
      books.isEmpty &&
      stories.isEmpty;
}

/// Disk cache for the public catalogue.
///
/// Public rows are shared between children; authenticated progress, favourites,
/// capability tokens and media URLs are intentionally not stored here.
class CatalogCache {
  const CatalogCache();

  /// The root every version of this cache has shared, used by [clear] so a
  /// schema bump cannot orphan the previous version's entries on disk.
  static const _keyRoot = 'majarra_catalog_cache';

  /// Public so tests manipulate the same key the implementation writes.
  ///
  /// They were previously duplicated as literals in `test/catalog_cache_test.dart`,
  /// and when the keys moved to `_v2` the tests kept backdating
  /// `majarra_catalog_cache_saved_at` — a key nothing reads. Two tests that exist
  /// to prove an expired entry and a future timestamp are refused were therefore
  /// asserting against an untouched, perfectly fresh cache. The TTL logic was
  /// correct all along; the tests had gone blind.
  static const payloadKey = '${_keyRoot}_v2';
  static const savedAtKey = '${_keyRoot}_saved_at_v2';

  static const _payloadKey = payloadKey;
  static const _savedAtKey = savedAtKey;

  /// A stale poster is preferable to an unrelated bundled title, while every
  /// app load still attempts a fresh request before consulting this snapshot.
  static const Duration ttl = Duration(hours: 24);

  Future<void> save(CachedCatalog catalog) async {
    // A value with neither rows nor successful-empty metadata represents a
    // failed fetch and must never overwrite a valid snapshot.
    if (catalog.isEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _payloadKey,
        jsonEncode({
          'planets': catalog.planets,
          'series': catalog.series,
          'episodes': catalog.episodes,
          'books': catalog.books,
          'stories': catalog.stories,
          'available_collections': catalog.availableCollections.toList(),
        }),
      );
      await prefs.setInt(_savedAtKey, DateTime.now().millisecondsSinceEpoch);
    } catch (_) {
      // A cache write must never break a successful catalogue load.
    }
  }

  /// Returns the cached rows, or null when absent, expired or unreadable.
  Future<CachedCatalog?> read() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedAt = prefs.getInt(_savedAtKey);
      final raw = prefs.getString(_payloadKey);
      if (savedAt == null || raw == null) return null;

      final age = DateTime.now().millisecondsSinceEpoch - savedAt;
      if (age < 0 || age > ttl.inMilliseconds) return null;

      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, Object?>) return null;
      return CachedCatalog(
        planets: _rows(decoded['planets']),
        series: _rows(decoded['series']),
        episodes: _rows(decoded['episodes']),
        books: _rows(decoded['books']),
        stories: _rows(decoded['stories']),
        availableCollections: _strings(decoded['available_collections']),
      );
    } catch (_) {
      return null;
    }
  }

  /// Removes the snapshot, **of every schema version**.
  ///
  /// Sweeping [_keyRoot] rather than removing the two current keys: an entry
  /// written by a build that used the `_v1` keys is never read and never expired
  /// by this class, so removing only the current pair left it on disk for the
  /// life of the install.
  Future<void> clear() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs
          .getKeys()
          .where((key) => key.startsWith(_keyRoot))
          .toList(growable: false);
      for (final key in keys) {
        await prefs.remove(key);
      }
    } catch (_) {
      // Nothing actionable; the TTL bounds any entry that survives.
    }
  }

  static List<Map<String, Object?>> _rows(Object? value) {
    if (value is! List) return const [];
    return value
        .whereType<Map<Object?, Object?>>()
        .map((row) => row.map((key, value) => MapEntry('$key', value)))
        .toList(growable: false);
  }

  static Set<String> _strings(Object? value) {
    if (value is! List) return const {};
    return value.whereType<String>().toSet();
  }
}

final catalogCacheProvider = Provider<CatalogCache>(
  (ref) => const CatalogCache(),
);
