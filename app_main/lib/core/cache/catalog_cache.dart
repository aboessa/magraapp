import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Raw catalogue rows as returned by the public API, exactly as cached.
///
/// Deliberately untyped rows rather than domain models: the DTO layer already
/// knows how to parse this shape, including the Arabic mojibake repair, so the
/// cache stays a dumb byte store and cannot drift from the parsing rules.
class CachedCatalog {
  const CachedCatalog({
    required this.planets,
    required this.series,
    required this.episodes,
    required this.books,
  });

  final List<Map<String, Object?>> planets;
  final List<Map<String, Object?>> series;
  final List<Map<String, Object?>> episodes;
  final List<Map<String, Object?>> books;

  bool get isEmpty =>
      planets.isEmpty && series.isEmpty && episodes.isEmpty && books.isEmpty;
}

/// Disk cache for the public catalogue (H6).
///
/// Before this the app had `shared_preferences` as a dependency with zero
/// imports, and every cold start went straight to the network: with no
/// connectivity the home screen fell back to the bundled `LocalCatalog` even
/// when real content had been fetched minutes earlier.
///
/// ## Scope: one entry, not per child
///
/// The audit asked for a catalogue cache "partitioned by `child_id`". That does
/// not apply to these endpoints: `/planets`, `/series`, `/episodes` and `/books`
/// are public, unauthenticated and identical for every profile — age filtering
/// happens on the client in `filteredCatalogProvider`. Keying by child would
/// store N identical copies and multiply the cold-start cost. Per-child caching
/// belongs to progress and favourites, which are authenticated and genuinely
/// differ per profile.
///
/// ## What is deliberately not cached
///
/// Nothing authenticated, and no capability tokens or stream URLs. Those are
/// short-lived by design (`capability_expires_in: 180`), so persisting them
/// would store a credential that is useless by the time it is read.
class CatalogCache {
  const CatalogCache();

  static const _payloadKey = 'majarra_catalog_cache_v1';
  static const _savedAtKey = 'majarra_catalog_cache_saved_at';

  /// Kept deliberately long. A stale poster is a far better cold-start
  /// experience than the bundled placeholder catalogue, and every read is
  /// still followed by a live fetch that overwrites it.
  static const Duration ttl = Duration(hours: 24);

  Future<void> save(CachedCatalog catalog) async {
    if (catalog.isEmpty) return; // never cache an empty result over a good one
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _payloadKey,
        jsonEncode({
          'planets': catalog.planets,
          'series': catalog.series,
          'episodes': catalog.episodes,
          'books': catalog.books,
        }),
      );
      await prefs.setInt(_savedAtKey, DateTime.now().millisecondsSinceEpoch);
    } catch (_) {
      // A cache write must never break a successful load.
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
      // A negative age means the device clock moved backwards; treat the entry
      // as unusable rather than trusting it indefinitely.
      if (age < 0 || age > ttl.inMilliseconds) return null;

      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, Object?>) return null;
      return CachedCatalog(
        planets: _rows(decoded['planets']),
        series: _rows(decoded['series']),
        episodes: _rows(decoded['episodes']),
        books: _rows(decoded['books']),
      );
    } catch (_) {
      return null;
    }
  }

  /// Must be called on sign-out so one account's catalogue state cannot leak
  /// into the next session on a shared device.
  Future<void> clear() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_payloadKey);
      await prefs.remove(_savedAtKey);
    } catch (_) {
      // Nothing actionable; the TTL bounds any entry that survives.
    }
  }

  static List<Map<String, Object?>> _rows(Object? value) {
    if (value is! List) return const [];
    return value
        .whereType<Map<String, Object?>>()
        .map(Map<String, Object?>.from)
        .toList(growable: false);
  }
}

/// Injectable so sign-out teardown can be exercised in a test.
final catalogCacheProvider = Provider<CatalogCache>(
  (ref) => const CatalogCache(),
);
