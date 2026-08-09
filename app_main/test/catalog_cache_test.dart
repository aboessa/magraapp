import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/cache/catalog_cache.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    // In-memory backing store; no platform channel needed.
    SharedPreferences.setMockInitialValues({});
  });

  test('read returns null when nothing was ever saved', () async {
    expect(await const CatalogCache().read(), isNull);
  });

  test('round-trips rows through disk', () async {
    const cache = CatalogCache();
    await cache.save(
      const CachedCatalog(
        planets: [
          {'id': 'abjad', 'name_ar': 'أبجد'},
        ],
        series: [
          {'id': 's1', 'title_ar': 'مغامرات', 'is_free': 1},
        ],
        episodes: [
          {'id': 'e1', 'series_id': 's1'},
        ],
        books: [],
      ),
    );

    final restored = await cache.read();
    expect(restored, isNotNull);
    expect(restored!.planets.single['id'], 'abjad');
    // Arabic must survive the JSON round trip unmangled.
    expect(restored.planets.single['name_ar'], 'أبجد');
    expect(restored.series.single['is_free'], 1);
    expect(restored.episodes.single['series_id'], 's1');
    expect(restored.books, isEmpty);
  });

  test('an empty payload never overwrites a good entry', () async {
    const cache = CatalogCache();
    await cache.save(
      const CachedCatalog(
        planets: [
          {'id': 'abjad'},
        ],
        series: [],
        episodes: [],
        books: [],
      ),
    );
    await cache.save(
      const CachedCatalog(planets: [], series: [], episodes: [], books: []),
    );

    // The good entry is still there: a failed fetch must not erase the cache.
    expect((await cache.read())!.planets.single['id'], 'abjad');
  });

  test('an entry older than the TTL is refused', () async {
    const cache = CatalogCache();
    await cache.save(
      const CachedCatalog(
        planets: [
          {'id': 'abjad'},
        ],
        series: [],
        episodes: [],
        books: [],
      ),
    );

    // Backdate the stored timestamp past the TTL.
    final prefs = await SharedPreferences.getInstance();
    final stale = DateTime.now()
        .subtract(CatalogCache.ttl + const Duration(minutes: 1))
        .millisecondsSinceEpoch;
    await prefs.setInt('majarra_catalog_cache_saved_at', stale);

    expect(await cache.read(), isNull);
  });

  test('a future timestamp is refused rather than trusted forever', () async {
    const cache = CatalogCache();
    await cache.save(
      const CachedCatalog(
        planets: [
          {'id': 'abjad'},
        ],
        series: [],
        episodes: [],
        books: [],
      ),
    );

    // Simulates the device clock moving backwards after a write.
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(
      'majarra_catalog_cache_saved_at',
      DateTime.now().add(const Duration(days: 2)).millisecondsSinceEpoch,
    );

    expect(await cache.read(), isNull);
  });

  test('corrupt json is treated as a miss, not an error', () async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('majarra_catalog_cache_v1', '{not json');
    await prefs.setInt(
      'majarra_catalog_cache_saved_at',
      DateTime.now().millisecondsSinceEpoch,
    );

    expect(await const CatalogCache().read(), isNull);
  });

  test('clear removes the entry', () async {
    const cache = CatalogCache();
    await cache.save(
      const CachedCatalog(
        planets: [
          {'id': 'abjad'},
        ],
        series: [],
        episodes: [],
        books: [],
      ),
    );
    await cache.clear();
    expect(await cache.read(), isNull);
  });
}
