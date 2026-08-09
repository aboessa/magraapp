import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../child/application/child_provider.dart';
import '../../home/application/home_providers.dart';
import '../../home/data/majarra_api_client.dart';

/// Watchlist, cached on the device and mirrored to the family account.
///
/// The page originally displayed `series.where(isFree)` with modulo indexing, so
/// it listed titles the user had never saved. It then became a local-only store.
/// It now also writes through to `POST /api/v1/family/favorites`, so a save made
/// on a phone appears on the television.
///
/// Ordering: local storage is the read path and stays authoritative for the
/// session. The server call is a mirror, not a gate — a failed sync must never
/// lose the user's tap, so the local set is updated first and the request is
/// allowed to fail quietly.
class WatchlistStore {
  static const _key = 'majarra_watchlist_ids';

  Future<Set<String>> load() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_key) ?? const <String>[]).toSet();
  }

  Future<void> save(Set<String> ids) async {
    final prefs = await SharedPreferences.getInstance();
    // Store newest-first so the page can show recent saves at the top.
    await prefs.setStringList(_key, ids.toList());
  }
}

/// Ordered set of saved series ids, newest first.
class WatchlistNotifier extends StateNotifier<Set<String>> {
  WatchlistNotifier(this._store, this._api, this._childId) : super(const {}) {
    _restore();
  }

  final WatchlistStore _store;
  final MajarraApiClient _api;

  /// Active child profile. Favourites are stored per child on the server, so
  /// without a selected profile the save stays device-only rather than being
  /// attributed to an arbitrary child.
  final String? _childId;

  Future<void> _restore() async {
    final saved = await _store.load();
    if (!mounted) return;
    state = saved;
  }

  bool contains(String id) => state.contains(id);

  Future<void> toggle(String id) async {
    // Rebuild the set rather than mutating: Riverpod compares by identity, so an
    // in-place mutation would not notify listeners.
    final next = <String>{...state};
    final removed = next.remove(id);

    if (removed) {
      state = next;
      await _store.save(next);
    } else {
      // Newest first.
      final reordered = <String>{id, ...next};
      state = reordered;
      await _store.save(reordered);
    }

    await _sync(id, add: !removed);
  }

  /// Mirrors one change to the family account.
  ///
  /// Deliberately does not surface failures: the local state is already correct,
  /// and an error toast on a bookmark tap would be noise. A dropped sync
  /// self-corrects the next time the same item is toggled.
  Future<void> _sync(String id, {required bool add}) async {
    final childId = _childId;
    if (childId == null || childId.isEmpty) return;
    try {
      await _api.updateFavorite(childId: childId, entityId: id, add: add);
    } catch (_) {
      // Intentionally ignored — see above.
    }
  }

  Future<void> clear() async {
    state = const {};
    await _store.save(const {});
  }
}

final watchlistStoreProvider = Provider<WatchlistStore>(
  (ref) => WatchlistStore(),
);

final watchlistProvider =
    StateNotifierProvider<WatchlistNotifier, Set<String>>(
      (ref) => WatchlistNotifier(
        ref.watch(watchlistStoreProvider),
        ref.watch(majarraApiClientProvider),
        // Rebuilds when the active profile changes, so subsequent saves are
        // attributed to whoever is actually watching.
        ref.watch(childProvider).activeChildId,
      ),
    );
