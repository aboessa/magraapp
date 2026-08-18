import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/auth_guard.dart';
import '../../../core/cache/catalog_cache.dart';
import '../../../core/cache/reader_page_cache.dart';
import '../../child/application/child_provider.dart';
import '../../downloads/application/download_providers.dart';
import '../../games/application/creation_cloud_service.dart';
import '../../home/application/home_providers.dart';
import '../../profile/data/watchlist_store.dart';
import '../../search/data/recent_searches_store.dart';
import '../data/parent_pin_store.dart';

/// Owns complete account-scoped teardown for every session-ending transition.
class AuthController {
  AuthController(this._ref);

  final Ref _ref;
  final Set<String> _queuedTeardownChildIds = <String>{};
  bool _bootstrapTeardownPending = false;
  Future<void>? _activeTeardown;

  /// Resolves persisted auth before the router exposes a public route. A
  /// terminal cold-start session uses the complete local teardown coordinator;
  /// storage failures also fail closed instead of leaving the app loading.
  Future<void> bootstrap() async {
    if (!_bootstrapTeardownPending) {
      try {
        final outcome = await _ref.read(authGuardProvider).load();
        _bootstrapTeardownPending =
            outcome == AuthLoadOutcome.expiredWithoutRefresh;
      } catch (_) {
        _bootstrapTeardownPending = true;
      }
    }
    if (!_bootstrapTeardownPending) return;

    // Keep this flag set if teardown fails. Invalidating authBootstrapProvider
    // can then retry the wipe directly, even if an earlier credential deletion
    // partially succeeded and the original expiry signal is no longer readable.
    await _clearLocalSession();
    _bootstrapTeardownPending = false;
  }

  /// Clears any previous real account before entering the local demo session.
  Future<void> prepareDemoSession() => _clearLocalSession();

  /// Revokes the current server session when possible, then always clears local
  /// credentials and account-scoped data so offline logout remains possible.
  Future<void> logout() async {
    final childIds = await _captureChildIds(includeServer: true);
    try {
      await _ref.read(majarraApiClientProvider).logout();
    } catch (_) {
      // Offline, expired, or already revoked. Local teardown must still run.
    }
    await _clearLocalSession(childIds: childIds);
  }

  /// Account deletion may only tear down the receipt owner's local session.
  /// A retained capability can outlive logout, so a later account must never
  /// be erased while resolving an older account's deletion.
  Future<void> completeAccountDeletion({
    required String parentId,
    Iterable<String> childIds = const <String>[],
  }) async {
    final activeParentId = await _ref.read(authStorageProvider).getParentId();
    if (activeParentId != null && activeParentId != parentId) {
      throw StateError('Deletion receipt belongs to a different account');
    }
    await _clearLocalSession(childIds: childIds.toSet());
  }

  /// Removes only data owned by one accepted child-deletion request. The
  /// parent's session and other child profiles remain intact. Writer barriers
  /// are global, then providers are rebuilt from the surviving family data.
  Future<void> clearChildData(String childId) async {
    final child = childId.trim();
    if (child.isEmpty) return;

    final failures = <Object>[];
    String? parentId;
    try {
      parentId = await _ref.read(authStorageProvider).getParentId();
      if (parentId == null || parentId.isEmpty) {
        failures.add(StateError('Parent scope is unavailable'));
      }
    } catch (error) {
      failures.add(error);
    }

    final barrierFailures = <Object>[];
    if (_ref.exists(watchlistProvider)) {
      final notifier = _ref.read(watchlistProvider.notifier);
      try {
        await notifier.shutdown();
      } catch (error) {
        barrierFailures.add(error);
      }
    }
    if (_ref.exists(downloadManagerProvider)) {
      final manager = _ref.read(downloadManagerProvider.notifier);
      try {
        await manager.shutdown();
      } catch (error) {
        barrierFailures.add(error);
      }
    }
    final searches = _ref.read(recentSearchesStoreProvider);
    try {
      await searches.shutdown();
    } catch (error) {
      barrierFailures.add(error);
    }
    final creations = _ref.read(localCreationStoreProvider);
    try {
      await creations.shutdown();
    } catch (error) {
      barrierFailures.add(error);
    }
    _throwIfTeardownFailed(barrierFailures);

    final wipes = <Future<void> Function()>[
      if (parentId != null && parentId.isNotEmpty)
        () => _ref
            .read(watchlistStoreProvider)
            .clearChild(parentId: parentId!, childId: child),
      () => searches.clear(childId: child),
      () => creations.clearChild(child),
      () => _ref.read(downloadRepositoryProvider).deleteAllForChild(child),
    ];
    for (final wipe in wipes) {
      try {
        await wipe();
      } catch (error) {
        failures.add(error);
      }
    }
    _throwIfTeardownFailed(failures);

    final memoryWipes = <void Function()>[
      if (_ref.read(childProvider).activeChildId == child)
        () => _ref.read(childProvider.notifier).clear(),
      () => _ref.invalidate(watchlistProvider),
      () => _ref.invalidate(downloadManagerProvider),
      () => _ref.invalidate(recentSearchesStoreProvider),
      () => _ref.invalidate(recentSearchesProvider),
      () => _ref.invalidate(localCreationStoreProvider),
    ];
    for (final wipe in memoryWipes) {
      try {
        wipe();
      } catch (error) {
        failures.add(error);
      }
    }
    _throwIfTeardownFailed(failures);
  }

  /// A successful password reset revokes all sessions server-side, including a
  /// session that happened to be active while the deep link was opened.
  Future<void> completePasswordReset() => _clearLocalSession();

  /// Used by MajarraApiClient when refresh is definitively rejected. It shares
  /// the exact same coordinator as logout/deletion rather than only erasing the
  /// bearer tokens and leaving child data behind.
  Future<void> handleRefreshFailure() => _clearLocalSession();

  Future<Set<String>> _captureChildIds({bool includeServer = false}) async {
    final ids = <String>{};
    final active = _ref.read(childProvider).activeChildId;
    if (active != null && active.isNotEmpty && active != 'demo-child') {
      ids.add(active);
    }
    if (includeServer) {
      try {
        final rows = await _ref.read(majarraApiClientProvider).fetchChildren();
        for (final row in rows) {
          final id = row['id']?.toString();
          if (id != null && id.isNotEmpty) ids.add(id);
        }
      } catch (_) {
        // Prefix-scoped local sweeps below remain authoritative for privacy.
      }
    }
    return ids;
  }

  /// Serializes every terminal transition so logout, rejected refresh, reset,
  /// deletion, and demo preparation cannot interleave competing wipe phases.
  Future<void> _clearLocalSession({Set<String>? childIds}) {
    _queuedTeardownChildIds.addAll(childIds ?? const <String>{});
    final active = _activeTeardown;
    if (active != null) return active;

    late final Future<void> operation;
    operation = _runLocalSessionTeardown().whenComplete(() {
      if (identical(_activeTeardown, operation)) {
        _activeTeardown = null;
        _queuedTeardownChildIds.clear();
      }
    });
    _activeTeardown = operation;
    return operation;
  }

  Future<void> _runLocalSessionTeardown() async {
    final storage = _ref.read(authStorageProvider);
    final failures = <Object>[];

    final ids = <String>{..._queuedTeardownChildIds};
    try {
      ids.addAll(await _captureChildIds());
    } catch (error) {
      failures.add(error);
    }

    // Quiesce initialized asynchronous writers before the authoritative store
    // sweeps. Ref.exists avoids constructing a manager/notifier merely to stop
    // it, while recent-search writes are fenced on the store used below.
    final barrierFailures = <Object>[];
    if (_ref.exists(watchlistProvider)) {
      final notifier = _ref.read(watchlistProvider.notifier);
      try {
        await notifier.shutdown();
      } catch (error) {
        barrierFailures.add(error);
      }
    }
    if (_ref.exists(downloadManagerProvider)) {
      final manager = _ref.read(downloadManagerProvider.notifier);
      try {
        await manager.shutdown();
      } catch (error) {
        barrierFailures.add(error);
      }
    }
    final recentSearches = _ref.read(recentSearchesStoreProvider);
    try {
      await recentSearches.shutdown();
    } catch (error) {
      barrierFailures.add(error);
    }
    final creations = _ref.read(localCreationStoreProvider);
    try {
      await creations.shutdown();
    } catch (error) {
      barrierFailures.add(error);
    }
    _throwIfTeardownFailed(barrierFailures);

    final persistentWipes = <Future<void> Function()>[
      // Sweep every account-scoped watchlist key without consulting encrypted
      // identity state. A malformed parent-id record must not deadlock the
      // cleanup that deletes that same record later in this teardown.
      () => _ref.read(watchlistStoreProvider).clearAll(),
      for (final childId in ids) () => recentSearches.clear(childId: childId),
      recentSearches.clearAll,
      for (final childId in ids) () => creations.clearChild(childId),
      creations.clearAll,
      () => _ref.read(parentPinStoreProvider).clear(),
      () => _ref.read(catalogCacheProvider).clear(),
      // Reader page snapshots carry `duration_ms`/`dwell_ms` and page text for
      // whichever stories this account opened. They are cleared alongside the
      // catalogue cache so a shared device does not carry one family's reading
      // material into the next family's session.
      () => const ReaderPageCache().clearAll(),
      () => _ref.read(downloadRepositoryProvider).cleanupPlayFiles(),
      () => _ref.read(downloadRepositoryProvider).wipeAll(),
    ];

    // Every independent store is attempted. Credentials remain available until
    // all scoped data is gone, so a failed wipe can be retried with its parent
    // and child identifiers instead of orphaning personalized data on disk.
    for (final wipe in persistentWipes) {
      try {
        await wipe();
      } catch (error) {
        failures.add(error);
      }
    }
    _throwIfTeardownFailed(failures);

    // AuthStorage.clear itself attempts every credential key and deliberately
    // excludes the account-deletion receipt capability.
    try {
      await storage.clear();
    } catch (error) {
      failures.add(error);
    }
    _throwIfTeardownFailed(failures);

    final memoryWipes = <void Function()>[
      () => _ref.read(childProvider.notifier).clear(),
      () => _ref.invalidate(watchlistProvider),
      () => _ref.invalidate(downloadManagerProvider),
      () => _ref.invalidate(recentSearchesStoreProvider),
      () => _ref.invalidate(recentSearchesProvider),
      () => _ref.invalidate(localCreationStoreProvider),
      // Clearing the selected child rebuilds mounted child-scoped providers.
      // Avoid instantiating unmounted storage-backed providers during shutdown.
      () => _ref.invalidate(homeCatalogProvider),
    ];
    for (final wipe in memoryWipes) {
      try {
        wipe();
      } catch (error) {
        failures.add(error);
      }
    }
    _throwIfTeardownFailed(failures);

    _ref.read(authGuardProvider).handleLogout();
  }

  void _throwIfTeardownFailed(List<Object> failures) {
    if (failures.isEmpty) return;
    throw StateError(
      'Local session teardown failed in ${failures.length} operation(s)',
    );
  }
}

final authControllerProvider = Provider<AuthController>(AuthController.new);

/// Runs once per root provider scope and keeps [AuthGuard] loading until any
/// terminal cold-start teardown is complete.
final authBootstrapProvider = FutureProvider<void>((ref) {
  return ref.read(authControllerProvider).bootstrap();
});
