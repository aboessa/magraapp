import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AccountDeletionReceipt {
  const AccountDeletionReceipt({
    required this.parentId,
    required this.requestId,
    required this.secret,
  });

  final String parentId;
  final String requestId;
  final String secret;

  bool sameCapability(AccountDeletionReceipt other) =>
      parentId == other.parentId &&
      requestId == other.requestId &&
      secret == other.secret;
}

class AccountDeletionRecoveryPending implements Exception {
  const AccountDeletionRecoveryPending();

  @override
  String toString() => 'Account deletion recovery is pending';
}

class AuthStorage {
  static const _access = 'majarra_access_token';
  static const _refresh = 'majarra_refresh_token';
  static const _parentId = 'majarra_parent_id';
  static const _deletionReceipt = 'majarra_deletion_receipt_v1';
  static const _pendingChildDeletions = 'majarra_pending_child_deletions_v1';
  // Read once only to migrate receipts written by pre-v1 builds. Every current
  // write and read is authoritative from the single JSON record above.
  static const _legacyDeletionParentId = 'majarra_deletion_parent_id';
  static const _legacyDeletionRequestId = 'majarra_deletion_request_id';
  static const _legacyDeletionSecret = 'majarra_deletion_receipt_secret';

  final _store = const FlutterSecureStorage();
  Future<void> _deletionReceiptMutationTail = Future<void>.value();
  Future<void> _deletionReceiptWorkflowTail = Future<void>.value();

  Future<T> _withDeletionReceiptMutation<T>(Future<T> Function() operation) {
    final previous = _deletionReceiptMutationTail;
    final release = Completer<void>();
    _deletionReceiptMutationTail = release.future;
    return () async {
      await previous;
      try {
        return await operation();
      } finally {
        release.complete();
      }
    }();
  }

  /// Serializes status resolution, destructive dispatch, and receipt cleanup
  /// across every mounted page that shares this storage instance. Mutation
  /// methods still use their own shorter lock, so they remain safe when called
  /// from inside a workflow.
  Future<T> runDeletionReceiptWorkflow<T>(Future<T> Function() operation) {
    final previous = _deletionReceiptWorkflowTail;
    final release = Completer<void>();
    _deletionReceiptWorkflowTail = release.future;
    return () async {
      await previous;
      try {
        return await operation();
      } finally {
        release.complete();
      }
    }();
  }

  Future<void> save({
    required String accessToken,
    required String refreshToken,
    required String parentId,
  }) {
    return _withDeletionReceiptMutation(() async {
      // A retained capability owns account recovery on this device. Refuse to
      // install another account beside it; the caller must resolve status first.
      if (await _readDeletionReceiptUnlocked() != null) {
        throw const AccountDeletionRecoveryPending();
      }
      await _store.write(key: _access, value: accessToken);
      await _store.write(key: _refresh, value: refreshToken);
      await _store.write(key: _parentId, value: parentId);
    });
  }

  Future<String?> getAccessToken() => _store.read(key: _access);
  Future<String?> getRefreshToken() => _store.read(key: _refresh);
  Future<String?> getParentId() => _store.read(key: _parentId);

  Future<void> updateTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _store.write(key: _access, value: accessToken);
    await _store.write(key: _refresh, value: refreshToken);
  }

  Future<void> updateAccessToken(String accessToken) async {
    await _store.write(key: _access, value: accessToken);
  }

  Future<String?> getPendingChildDeletionRequestId(String childId) async {
    final pending = await _readPendingChildDeletions();
    return pending[childId];
  }

  Future<void> savePendingChildDeletion({
    required String childId,
    required String requestId,
  }) async {
    if (childId.isEmpty ||
        childId.length > 200 ||
        requestId.length < 8 ||
        requestId.length > 200) {
      throw ArgumentError('Invalid child deletion recovery record');
    }
    final pending = await _readPendingChildDeletions();
    pending[childId] = requestId;
    await _store.write(
      key: _pendingChildDeletions,
      value: jsonEncode({'version': 1, 'requests': pending}),
    );
  }

  Future<void> clearPendingChildDeletion(String childId) async {
    final pending = await _readPendingChildDeletions();
    if (pending.remove(childId) == null) return;
    if (pending.isEmpty) {
      await _store.delete(key: _pendingChildDeletions);
      return;
    }
    await _store.write(
      key: _pendingChildDeletions,
      value: jsonEncode({'version': 1, 'requests': pending}),
    );
  }

  Future<Map<String, String>> _readPendingChildDeletions() async {
    final encoded = await _store.read(key: _pendingChildDeletions);
    if (encoded == null) return <String, String>{};
    try {
      final decoded = jsonDecode(encoded);
      final requests = decoded is Map && decoded['version'] == 1
          ? decoded['requests']
          : null;
      if (requests is! Map) return <String, String>{};
      return {
        for (final entry in requests.entries)
          if (entry.key is String &&
              (entry.key as String).isNotEmpty &&
              (entry.key as String).length <= 200 &&
              entry.value is String &&
              (entry.value as String).length >= 8 &&
              (entry.value as String).length <= 200)
            entry.key as String: entry.value as String,
      };
    } catch (_) {
      return <String, String>{};
    }
  }

  /// Persists a client-generated account-deletion capability before dispatch.
  /// The first valid receipt wins; a later caller receives that exact receipt
  /// and must resume it rather than replacing its only recovery secret.
  Future<AccountDeletionReceipt> saveDeletionReceiptIfAbsent(
    AccountDeletionReceipt receipt,
  ) {
    return _withDeletionReceiptMutation(() async {
      final validated = _validatedDeletionReceipt(
        parentId: receipt.parentId,
        requestId: receipt.requestId,
        secret: receipt.secret,
      );
      if (validated == null) {
        throw ArgumentError('Invalid account deletion receipt');
      }
      final existing = await _readDeletionReceiptUnlocked();
      if (existing != null) return existing;
      await _writeDeletionReceiptUnlocked(validated);
      return validated;
    });
  }

  Future<AccountDeletionReceipt?> getDeletionReceipt() {
    return _withDeletionReceiptMutation(_readDeletionReceiptUnlocked);
  }

  Future<AccountDeletionReceipt?> _readDeletionReceiptUnlocked() async {
    final encoded = await _store.read(key: _deletionReceipt);
    if (encoded != null) {
      final decoded = _decodeDeletionReceipt(encoded);
      if (decoded == null) {
        throw StateError('Saved account deletion receipt is invalid');
      }
      return decoded;
    }

    // Transitional migration only. A successfully migrated value is committed
    // as one JSON record before the old keys are erased.
    final legacyValues = await Future.wait([
      _store.read(key: _legacyDeletionParentId),
      _store.read(key: _legacyDeletionRequestId),
      _store.read(key: _legacyDeletionSecret),
    ]);
    final legacy = _validatedDeletionReceipt(
      parentId: legacyValues[0],
      requestId: legacyValues[1],
      secret: legacyValues[2],
    );
    if (legacy == null) {
      if (legacyValues.any((value) => value != null)) {
        throw StateError('Legacy account deletion receipt is invalid');
      }
      return null;
    }
    await _writeDeletionReceiptUnlocked(legacy);
    return legacy;
  }

  Future<void> _writeDeletionReceiptUnlocked(
    AccountDeletionReceipt receipt,
  ) async {
    await _store.write(
      key: _deletionReceipt,
      value: jsonEncode({
        'version': 1,
        'parent_id': receipt.parentId,
        'request_id': receipt.requestId,
        'secret': receipt.secret,
      }),
    );
    await _clearLegacyDeletionReceipt();
  }

  AccountDeletionReceipt? _decodeDeletionReceipt(String encoded) {
    try {
      final decoded = jsonDecode(encoded);
      if (decoded is! Map || decoded['version'] != 1) return null;
      return _validatedDeletionReceipt(
        parentId: decoded['parent_id'],
        requestId: decoded['request_id'],
        secret: decoded['secret'],
      );
    } catch (_) {
      return null;
    }
  }

  AccountDeletionReceipt? _validatedDeletionReceipt({
    required Object? parentId,
    required Object? requestId,
    required Object? secret,
  }) {
    if (parentId is! String ||
        parentId.isEmpty ||
        parentId.length > 200 ||
        requestId is! String ||
        requestId.isEmpty ||
        requestId.length > 200 ||
        secret is! String ||
        secret.length < 32 ||
        secret.length > 256) {
      return null;
    }
    return AccountDeletionReceipt(
      parentId: parentId,
      requestId: requestId,
      secret: secret,
    );
  }

  Future<void> _clearLegacyDeletionReceipt() async {
    for (final key in const [
      _legacyDeletionParentId,
      _legacyDeletionRequestId,
      _legacyDeletionSecret,
    ]) {
      try {
        await _store.delete(key: key);
      } catch (_) {
        // The committed v1 record remains authoritative if legacy cleanup is
        // interrupted by a platform keystore failure.
      }
    }
  }

  /// Deletes only the capability the caller actually resolved. A late 404,
  /// rejection, or finish action cannot clear a different request's receipt.
  Future<bool> clearDeletionReceiptIfMatches(AccountDeletionReceipt expected) {
    return _withDeletionReceiptMutation(() async {
      final current = await _readDeletionReceiptUnlocked();
      if (current == null || !current.sameCapability(expected)) return false;
      await _store.delete(key: _deletionReceipt);
      await _clearLegacyDeletionReceipt();
      return true;
    });
  }

  /// Clears only the active session. A pending deletion receipt is a separate
  /// recovery capability and must survive logout/account revocation.
  Future<void> clear() async {
    final failures = <Object>[];
    for (final key in const [
      _access,
      _refresh,
      _parentId,
      _pendingChildDeletions,
    ]) {
      try {
        await _store.delete(key: key);
      } catch (error) {
        failures.add(error);
      }
    }
    if (failures.isNotEmpty) {
      throw StateError(
        'Active session cleanup failed for ${failures.length} value(s)',
      );
    }
  }
}
