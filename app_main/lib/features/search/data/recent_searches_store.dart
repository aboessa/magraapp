import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Locally-persisted recent search queries (§10).
///
/// Recent searches are a convenience stored only on the device: they are the
/// parent/child's own queries, so there is no reason to send them to the server,
/// and keeping them local avoids building a per-child query history that would
/// be a privacy liability in a children's app. Capped so the list cannot grow
/// without bound.
class RecentSearchesStore {
  RecentSearchesStore({SharedPreferences? prefs}) : _injected = prefs;

  static const _key = 'majarra_recent_searches';
  static const maxEntries = 8;

  final SharedPreferences? _injected;

  Future<SharedPreferences> get _prefs async =>
      _injected ?? await SharedPreferences.getInstance();

  Future<List<String>> load() async {
    final prefs = await _prefs;
    return prefs.getStringList(_key) ?? const [];
  }

  /// Records [query], moving an existing identical entry to the front and
  /// trimming to [maxEntries]. Blank queries are ignored.
  Future<List<String>> add(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return load();
    final prefs = await _prefs;
    final current = prefs.getStringList(_key) ?? <String>[];
    // Case-insensitive de-dupe so "علوم" and "علوم " do not both appear.
    current.removeWhere((e) => e.toLowerCase() == trimmed.toLowerCase());
    current.insert(0, trimmed);
    final trimmedList = current.take(maxEntries).toList();
    await prefs.setStringList(_key, trimmedList);
    return trimmedList;
  }

  Future<void> clear() async {
    final prefs = await _prefs;
    await prefs.remove(_key);
  }
}

final recentSearchesStoreProvider =
    Provider<RecentSearchesStore>((ref) => RecentSearchesStore());

/// The current recent-search list, exposed as async so the UI can show nothing
/// until the first read completes rather than flashing an empty state.
final recentSearchesProvider = FutureProvider<List<String>>((ref) {
  return ref.watch(recentSearchesStoreProvider).load();
});
