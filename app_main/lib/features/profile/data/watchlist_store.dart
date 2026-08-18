import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../auth/data/auth_storage.dart';
import '../../child/application/child_provider.dart';
import '../../home/application/home_providers.dart';
import '../../home/data/majarra_api_client.dart';

/// Persists saved-series ids and unsent server mutations per parent/child.
class WatchlistStore {
  static const _legacyKey = 'majarra_watchlist_ids';
  static const _prefix = 'majarra_watchlist_v2';

  String _idsKey(String scope) =>
      '${_prefix}_ids_${Uri.encodeComponent(scope)}';
  String _pendingKey(String scope) =>
      '${_prefix}_pending_${Uri.encodeComponent(scope)}';
  String _migratedKey(String scope) =>
      '${_prefix}_migrated_${Uri.encodeComponent(scope)}';

  /// Optional [scope] keeps the original test/API surface compatible. Runtime
  /// callers always provide the parent+child scope.
  Future<Set<String>> load([String? scope]) async {
    final prefs = await SharedPreferences.getInstance();
    if (scope == null) {
      return (prefs.getStringList(_legacyKey) ?? const <String>[]).toSet();
    }

    final key = _idsKey(scope);
    final scoped = prefs.getStringList(key);
    if (scoped != null) return scoped.toSet();

    // One-time migration from the pre-v2 unscoped cache. Assign it only to the
    // first explicitly selected profile, then remove it so another child can
    // never inherit the same titles.
    final legacy = prefs.getStringList(_legacyKey);
    if (legacy == null || legacy.isEmpty) return const {};
    await prefs.setStringList(key, legacy);
    await prefs.remove(_legacyKey);
    return legacy.toSet();
  }

  Future<void> save(Set<String> ids, [String? scope]) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      scope == null ? _legacyKey : _idsKey(scope),
      ids.toList(growable: false),
    );
  }

  /// Pending values are `+id` and `-id`. Keeping them beside the scoped cache
  /// means a failed add/remove can be reconciled after restart without reviving
  /// a title the child removed while offline.
  Future<Map<String, bool>> loadPending(String scope) async {
    final prefs = await SharedPreferences.getInstance();
    final encoded = prefs.getStringList(_pendingKey(scope)) ?? const [];
    final pending = <String, bool>{};
    for (final value in encoded) {
      if (value.length < 2) continue;
      final operation = value[0];
      if (operation != '+' && operation != '-') continue;
      pending[value.substring(1)] = operation == '+';
    }
    return pending;
  }

  Future<void> savePending(String scope, Map<String, bool> pending) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_pendingKey(scope), [
      for (final entry in pending.entries)
        '${entry.value ? '+' : '-'}${entry.key}',
    ]);
  }

  Future<bool> wasMigrated(String scope) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_migratedKey(scope)) ?? false;
  }

  Future<void> markMigrated(String scope) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_migratedKey(scope), true);
  }

  /// Removes every cached id, migration marker, and pending mutation owned by
  /// one parent without issuing server calls. The parent id is captured before
  /// AuthStorage is cleared during logout/reset/account deletion.
  Future<void> clearParent(String parentId) async {
    final normalized = parentId.trim();
    if (normalized.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final scopedPrefixes = <String>[
      '${_prefix}_ids_',
      '${_prefix}_pending_',
      '${_prefix}_migrated_',
    ];
    final keys = <String>{};
    for (final key in prefs.getKeys().toList(growable: false)) {
      for (final prefix in scopedPrefixes) {
        if (!key.startsWith(prefix)) continue;
        final encodedScope = key.substring(prefix.length);
        String scope;
        try {
          scope = Uri.decodeComponent(encodedScope);
        } catch (_) {
          continue;
        }
        if (scope.startsWith('$normalized::')) keys.add(key);
        break;
      }
    }
    // The legacy cache had no account scope, so retaining it across logout
    // could assign one family's titles to the next family using this device.
    keys.add(_legacyKey);
    await _removeKeys(prefs, keys);
  }

  /// Removes every watchlist cache/outbox on this installation.
  ///
  /// Terminal session teardown uses this account-independent sweep so corrupt
  /// secure-storage identity records cannot prevent local privacy cleanup.
  Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = <String>{_legacyKey};
    for (final key in prefs.getKeys().toList(growable: false)) {
      if (key.startsWith('${_prefix}_')) keys.add(key);
    }
    await _removeKeys(prefs, keys);
  }

  Future<void> clearChild({
    required String parentId,
    required String childId,
  }) async {
    final parent = parentId.trim();
    final child = childId.trim();
    if (parent.isEmpty || child.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final scope = '$parent::$child';
    await _removeKeys(prefs, [
      _idsKey(scope),
      _pendingKey(scope),
      _migratedKey(scope),
    ]);
  }

  Future<void> _removeKeys(
    SharedPreferences prefs,
    Iterable<String> keys,
  ) async {
    var failed = false;
    for (final key in keys) {
      try {
        if (!prefs.containsKey(key)) continue;
        if (!await prefs.remove(key)) failed = true;
      } catch (_) {
        failed = true;
      }
    }
    if (!failed) return;

    try {
      await prefs.reload();
    } catch (_) {
      // The generic failure below remains retryable by the teardown caller.
    }
    throw StateError('Local watchlist removal failed');
  }
}

/// Ordered set of saved series ids, newest first.
///
/// The local cache is child/account scoped. Server favorites are hydrated on
/// construction; failed mutations remain in a small persisted outbox and are
/// replayed without discarding the child's immediate local action.
class WatchlistNotifier extends StateNotifier<Set<String>> {
  WatchlistNotifier(
    this._store,
    this._api,
    this._childId, {
    AuthStorage? authStorage,
  }) : _authStorage = authStorage,
       super(const {}) {
    _ready = _startOperation<void>(
      (generation) => _serializeMutation(() => _restore(generation)),
      whenFenced: () {},
    );
  }

  final WatchlistStore _store;
  final MajarraApiClient _api;
  final String? _childId;
  final AuthStorage? _authStorage;

  final Set<Future<void>> _operations = <Future<void>>{};
  Future<void> _mutationTail = Future<void>.value();
  Future<void>? _shutdownFuture;
  var _generation = 0;
  var _shuttingDown = false;

  late final Future<void> _ready;
  String? _scope;
  String? _parentId;
  Map<String, bool> _pending = {};

  /// Fences new work synchronously and waits for all admitted work to settle.
  /// Failures still reach the original caller but never fail the lifecycle drain.
  Future<void> shutdown() {
    final existing = _shutdownFuture;
    if (existing != null) return existing;

    final completer = Completer<void>();
    _shutdownFuture = completer.future;
    _shuttingDown = true;
    _generation++;

    unawaited(
      _drainOperations().then<void>(
        (_) => completer.complete(),
        onError: (Object _, StackTrace __) => completer.complete(),
      ),
    );
    return completer.future;
  }

  @override
  void dispose() {
    unawaited(shutdown());
    super.dispose();
  }

  Future<void> _drainOperations() async {
    while (_operations.isNotEmpty) {
      await Future.wait<void>(List<Future<void>>.of(_operations));
    }
  }

  Future<T> _startOperation<T>(
    Future<T> Function(int generation) body, {
    required T Function() whenFenced,
  }) {
    if (_shuttingDown) return Future<T>.sync(whenFenced);

    final generation = _generation;
    final ticket = Completer<void>();
    final ticketFuture = ticket.future;
    _operations.add(ticketFuture);

    void finish() {
      if (!ticket.isCompleted) ticket.complete();
      _operations.remove(ticketFuture);
    }

    late Future<T> result;
    try {
      result = body(generation);
    } catch (error, stackTrace) {
      finish();
      return Future<T>.error(error, stackTrace);
    }
    result.then<void>(
      (_) => finish(),
      onError: (Object _, StackTrace __) => finish(),
    );
    return result;
  }

  Future<T> _serializeMutation<T>(Future<T> Function() mutation) {
    final result = _mutationTail.then<T>((_) => mutation());
    _mutationTail = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace __) {},
    );
    return result;
  }

  bool _isCurrent(int generation) =>
      !_shuttingDown && generation == _generation && mounted;

  Future<void> _restore(int generation) async {
    final childId = _childId;
    if (!_isCurrent(generation)) return;
    final parentId = await _authStorage?.getParentId();
    if (!_isCurrent(generation)) return;
    _parentId = parentId;

    final scope = childId == null || childId.isEmpty
        ? 'device'
        : '${parentId ?? 'demo'}::$childId';
    if (!_isCurrent(generation)) return;
    _scope = scope;

    if (!_isCurrent(generation)) return;
    final local = await _store.load(scope == 'device' ? null : scope);
    if (!_isCurrent(generation)) return;

    Map<String, bool> pending;
    if (scope == 'device') {
      pending = <String, bool>{};
    } else {
      if (!_isCurrent(generation)) return;
      pending = await _store.loadPending(scope);
      if (!_isCurrent(generation)) return;
    }
    if (!_isCurrent(generation)) return;
    _pending = pending;

    if (childId == null || childId.isEmpty || parentId == null) {
      if (!_isCurrent(generation)) return;
      state = local;
      return;
    }

    try {
      if (!_isCurrent(generation)) return;
      final envelope = await _api.getFamilyState();
      if (!_isCurrent(generation)) return;
      final server = _seriesFavorites(envelope, childId);

      if (!_isCurrent(generation)) return;
      final migrated = await _store.wasMigrated(scope);
      if (!_isCurrent(generation)) return;
      final merged = <String>{};
      final needsMigration = !migrated;

      if (needsMigration) {
        // Preserve pre-v2 local saves once, and remember missing server rows as
        // pending additions. Subsequent starts use server state plus the outbox,
        // so removals performed on another device are respected.
        merged.addAll(local);
        merged.addAll(server);
        for (final id in local) {
          if (!server.contains(id)) {
            if (!_isCurrent(generation)) return;
            _pending[id] = true;
          }
        }
      } else {
        merged.addAll(server);
      }

      for (final entry in _pending.entries) {
        if (entry.value) {
          merged.remove(entry.key);
          merged.add(entry.key);
        } else {
          merged.remove(entry.key);
        }
      }

      if (!_isCurrent(generation)) return;
      state = merged;
      // The outbox is the recovery source if shutdown interrupts a later write.
      if (!_isCurrent(generation)) return;
      await _store.savePending(scope, Map<String, bool>.from(_pending));
      if (!_isCurrent(generation)) return;
      await _store.save(merged, scope);
      if (!_isCurrent(generation)) return;
      if (needsMigration) {
        if (!_isCurrent(generation)) return;
        await _store.markMigrated(scope);
        if (!_isCurrent(generation)) return;
      }
      await _flushPending(generation);
      if (!_isCurrent(generation)) return;
    } catch (_) {
      if (!_isCurrent(generation)) return;
      state = local;
    }
  }

  Set<String> _seriesFavorites(Map<String, dynamic> envelope, String childId) {
    final data = envelope['data'];
    if (data is! Map<String, dynamic>) return const {};
    final favorites = data['favorites'];
    if (favorites is! List<dynamic>) return const {};
    final ids = <String>{};
    for (final row in favorites.whereType<Map<String, dynamic>>()) {
      if (row['child_id'] != childId || row['entity_type'] != 'series') {
        continue;
      }
      final id = row['entity_id'];
      if (id is String && id.isNotEmpty) ids.add(id);
    }
    return ids;
  }

  bool contains(String id) => state.contains(id);

  Future<void> toggle(String id) => _startOperation<void>(
    (generation) => _serializeMutation(() => _toggle(id, generation)),
    whenFenced: () {},
  );

  Future<void> _toggle(String id, int generation) async {
    await _ready;
    if (!_isCurrent(generation)) return;
    final scope = _scope;
    if (scope == null) return;

    final next = <String>{...state};
    final removed = next.remove(id);
    final updated = removed ? next : <String>{id, ...next};
    if (!_isCurrent(generation)) return;
    state = updated;

    if (_parentId == null || _childId == null || scope == 'device') {
      if (!_isCurrent(generation)) return;
      await _store.save(updated, scope == 'device' ? null : scope);
      if (!_isCurrent(generation)) return;
      return;
    }

    if (!_isCurrent(generation)) return;
    _pending[id] = !removed;
    // Persist intent before cache so an interrupted operation can be replayed.
    if (!_isCurrent(generation)) return;
    await _store.savePending(scope, Map<String, bool>.from(_pending));
    if (!_isCurrent(generation)) return;
    await _store.save(updated, scope);
    if (!_isCurrent(generation)) return;
    await _flushPending(generation);
    if (!_isCurrent(generation)) return;
  }

  Future<void> _flushPending(int generation) async {
    final childId = _childId;
    final scope = _scope;
    if (childId == null || scope == null || _parentId == null) return;

    while (_pending.isNotEmpty) {
      if (!_isCurrent(generation)) return;
      final entry = _pending.entries.first;
      try {
        if (!_isCurrent(generation)) return;
        await _api.updateFavorite(
          childId: childId,
          entityId: entry.key,
          entityType: 'series',
          add: entry.value,
        );
        if (!_isCurrent(generation)) return;
        if (_pending[entry.key] != entry.value) continue;

        final remaining = Map<String, bool>.from(_pending)..remove(entry.key);
        if (!_isCurrent(generation)) return;
        await _store.savePending(scope, remaining);
        if (!_isCurrent(generation)) return;
        if (_pending[entry.key] != entry.value) continue;
        if (!_isCurrent(generation)) return;
        _pending.remove(entry.key);
      } catch (_) {
        // Keep this and later operations in the outbox for the next retry.
        return;
      }
    }
  }

  Future<void> clear() => _startOperation<void>(
    (generation) => _serializeMutation(() => _clear(generation)),
    whenFenced: () {},
  );

  Future<void> _clear(int generation) async {
    await _ready;
    if (!_isCurrent(generation)) return;
    final scope = _scope;
    if (scope == null) return;
    final removed = state.toList(growable: false);
    if (!_isCurrent(generation)) return;
    state = const {};

    if (_parentId == null || _childId == null || scope == 'device') {
      if (!_isCurrent(generation)) return;
      await _store.save(const {}, scope == 'device' ? null : scope);
      if (!_isCurrent(generation)) return;
      return;
    }

    for (final id in removed) {
      if (!_isCurrent(generation)) return;
      _pending[id] = false;
    }
    // Persist removals before cache so server hydration cannot revive them.
    if (!_isCurrent(generation)) return;
    await _store.savePending(scope, Map<String, bool>.from(_pending));
    if (!_isCurrent(generation)) return;
    await _store.save(const {}, scope);
    if (!_isCurrent(generation)) return;
    await _flushPending(generation);
    if (!_isCurrent(generation)) return;
  }
}

final watchlistStoreProvider = Provider<WatchlistStore>(
  (ref) => WatchlistStore(),
);

final watchlistProvider = StateNotifierProvider<WatchlistNotifier, Set<String>>(
  (ref) => WatchlistNotifier(
    ref.watch(watchlistStoreProvider),
    ref.watch(majarraApiClientProvider),
    ref.watch(childProvider).activeChildId,
    authStorage: ref.watch(authStorageProvider),
  ),
);
