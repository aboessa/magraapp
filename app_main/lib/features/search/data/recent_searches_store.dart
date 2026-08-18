import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Device-only recent queries, partitioned by the active child profile.
class RecentSearchesStore {
  RecentSearchesStore({SharedPreferences? prefs}) : _injected = prefs;

  static const _keyPrefix = 'majarra_recent_searches';
  static const maxEntries = 8;

  final SharedPreferences? _injected;
  final Set<Future<void>> _operations = <Future<void>>{};

  Future<void> _writeTail = Future<void>.value();
  Future<void>? _shutdownFuture;
  var _generation = 0;
  var _shuttingDown = false;

  Future<SharedPreferences> get _prefs async =>
      _injected ?? await SharedPreferences.getInstance();

  Future<List<String>> load({String? childId}) async {
    final prefs = await _prefs;
    return prefs.getStringList(_keyFor(childId)) ?? const [];
  }

  Future<List<String>> add(String query, {String? childId}) {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return load(childId: childId);

    return _startOperation<List<String>>(
      (generation) => _serializeWrite(
        () => _add(trimmed, childId: childId, generation: generation),
      ),
      whenFenced: () => load(childId: childId),
    );
  }

  Future<List<String>> _add(
    String query, {
    required String? childId,
    required int generation,
  }) async {
    final key = _keyFor(childId);
    final prefs = await _prefs;
    if (!_isCurrent(generation)) {
      return prefs.getStringList(key) ?? const [];
    }

    final current = prefs.getStringList(key) ?? <String>[];
    current.removeWhere((item) => item.toLowerCase() == query.toLowerCase());
    current.insert(0, query);
    final result = current.take(maxEntries).toList(growable: false);

    if (!_isCurrent(generation)) {
      return prefs.getStringList(key) ?? const [];
    }
    await prefs.setStringList(key, result);
    if (!_isCurrent(generation)) return result;
    return result;
  }

  /// Permanently fences new additions and drains every addition already
  /// admitted. Reads and authoritative removal operations remain available.
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

  Future<void> clear({String? childId}) => _serializeWrite(() async {
    final prefs = await _prefs;
    await _removeKeys(prefs, [_keyFor(childId)]);
  });

  Future<void> clearAll() => _serializeWrite(() async {
    final prefs = await _prefs;
    final keys = prefs
        .getKeys()
        .where((key) => key == _keyPrefix || key.startsWith('${_keyPrefix}_'))
        .toList(growable: false);
    await _removeKeys(prefs, keys);
  });

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
    throw StateError('Local recent-search removal failed');
  }

  Future<void> _drainOperations() async {
    while (_operations.isNotEmpty) {
      await Future.wait<void>(List<Future<void>>.of(_operations));
    }
  }

  Future<T> _startOperation<T>(
    Future<T> Function(int generation) body, {
    required FutureOr<T> Function() whenFenced,
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

  Future<T> _serializeWrite<T>(Future<T> Function() write) {
    final result = _writeTail.then<T>((_) => write());
    _writeTail = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace __) {},
    );
    return result;
  }

  bool _isCurrent(int generation) =>
      !_shuttingDown && generation == _generation;

  static String _keyFor(String? childId) {
    final value = childId?.trim();
    if (value == null || value.isEmpty) return '${_keyPrefix}_unscoped';
    // SharedPreferences keys remain ASCII and never expose the raw profile id.
    final encoded = base64Url.encode(utf8.encode(value)).replaceAll('=', '');
    return '${_keyPrefix}_$encoded';
  }
}

final recentSearchesStoreProvider = Provider<RecentSearchesStore>((ref) {
  final store = RecentSearchesStore();
  ref.onDispose(() => unawaited(store.shutdown()));
  return store;
});

final recentSearchesProvider = FutureProvider.family<List<String>, String?>((
  ref,
  childId,
) {
  return ref.watch(recentSearchesStoreProvider).load(childId: childId);
});
