import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/diagnostics/ignored_errors.dart';
import '../../../core/failures/secure_storage_failure.dart';

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
  static const _legacyDeletionParentId = 'majarra_deletion_parent_id';
  static const _legacyDeletionRequestId = 'majarra_deletion_request_id';
  static const _legacyDeletionSecret = 'majarra_deletion_receipt_secret';

  /// [storage] للاختبار وحده: بلا حقن، مسار الفشل غير قابل للاختبار إلا بجهاز
  /// مخزنُه مكسور (`APP-106`).
  AuthStorage({FlutterSecureStorage? storage}) : _store = storage ?? _secureOpts;

  static const _secureOpts = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
  final FlutterSecureStorage _store;

  /// قراءة تُعيد `null` عند الفشل، **وتسجّله** (`APP-106`).
  ///
  /// الإرجاع `null` مقصود ولم يتغيّر: مسار الإقلاع يقرأ التوكن ليعرف «هل هناك
  /// جلسة؟»، ورفع استثناء هناك يمنع فتح التطبيق أصلًا. لكن «لا جلسة» و«المخزن
  /// الآمن لا يُقرأ» كانا يبدوان سواءً — والثاني يعني خروجًا غامضًا لا يفهمه
  /// المستخدم ولا نراه نحن. الآن يُسجَّل، ويظهر في `keystoreUnavailable`.
  Future<String?> _safeRead(String key) async {
    try {
      return await _store.read(key: key);
    } catch (error, stack) {
      _readFailed = true;
      reportIgnoredError('auth_storage.read', error, stack);
      return null;
    }
  }

  /// كتابة **ترفع** عند الفشل (`APP-106` + `ENC-011`).
  ///
  /// كان الفشل مكتومًا، ومعناه أن الجلسة لن تنجو من إغلاق التطبيق: المستخدم
  /// يسجّل دخوله بنجاح ظاهر، ثم يجد نفسه خارجًا عند الإقلاع التالي بلا سبب
  /// معلَن. ورفع الاستثناء هنا يجعل مسار الدخول يفشل **وقتَ حدوثه**، وهو ما
  /// يُنتج رسالة صحيحة بدل عطل يظهر لاحقًا في موضع آخر.
  Future<void> _safeWrite(String key, String value) async {
    try {
      await _store.write(key: key, value: value);
    } catch (error) {
      throw SecureStorageUnavailableException('auth_storage.write', error);
    }
  }

  /// حذف يُهمَل فشله ويُسجَّل.
  ///
  /// لا يُرفَع: المستدعي إمّا يمسح جلسة (والذاكرة مُسحت أصلًا فالأثر العملي واقع)
  /// أو ينظّف مفتاحًا قديمًا. و[clear] وحدها ترفع، لأن بقاء توكن على القرص بعد
  /// «خروج» ليس تنظيفًا فائتًا بل خطأ أمني.
  Future<void> _safeDelete(String key) async {
    try {
      await _store.delete(key: key);
    } catch (error) {
      reportIgnoredError('auth_storage.delete', error);
    }
  }

  bool _readFailed = false;

  /// هل فشلت قراءة واحدة من المخزن الآمن في هذه الجلسة؟
  ///
  /// تُقرأ عند غياب التوكن للتفريق بين «لا جلسة محفوظة» و«المخزن لا يُقرأ»،
  /// فتُعرَض رسالة صحيحة بدل شاشة دخول بلا تفسير.
  bool get keystoreUnavailable => _readFailed;
  Future<void> _deletionReceiptMutationTail = Future<void>.value();
  Future<void> _deletionReceiptWorkflowTail = Future<void>.value();

  // In-memory cache – fixes web race where secure_storage read lags behind
  // save() (IndexedDB/localStorage async). After save, getAccessToken returns
  // immediately from memory, so /family/children right after login never 401s.
  String? _memAccess;
  String? _memRefresh;
  String? _memParentId;
  bool _memLoaded = false;

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
      if (await _readDeletionReceiptUnlocked() != null) {
        throw const AccountDeletionRecoveryPending();
      }
      _memAccess = accessToken;
      _memRefresh = refreshToken;
      _memParentId = parentId;
      _memLoaded = true;
      await _safeWrite(_access, accessToken);
      await _safeWrite(_refresh, refreshToken);
      await _safeWrite(_parentId, parentId);
    });
  }

  Future<String?> getAccessToken() async {
    if (_memLoaded && _memAccess != null) return _memAccess;
    final v = await _safeRead(_access);
    if (v != null) {
      _memAccess = v;
      _memLoaded = true;
    }
    return v;
  }

  Future<String?> getRefreshToken() async {
    if (_memLoaded && _memRefresh != null) return _memRefresh;
    final v = await _safeRead(_refresh);
    if (v != null) {
      _memRefresh = v;
    }
    return v;
  }

  Future<String?> getParentId() async {
    if (_memLoaded && _memParentId != null) return _memParentId;
    final v = await _safeRead(_parentId);
    if (v != null) {
      _memParentId = v;
      _memLoaded = true;
    }
    return v;
  }

  Future<void> updateTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    _memAccess = accessToken;
    _memRefresh = refreshToken;
    _memLoaded = true;
    await _safeWrite(_access, accessToken);
    await _safeWrite(_refresh, refreshToken);
  }

  Future<void> updateAccessToken(String accessToken) async {
    _memAccess = accessToken;
    _memLoaded = true;
    await _safeWrite(_access, accessToken);
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
    await _safeWrite(
      _pendingChildDeletions,
      jsonEncode({'version': 1, 'requests': pending}),
    );
  }

  Future<void> clearPendingChildDeletion(String childId) async {
    final pending = await _readPendingChildDeletions();
    if (pending.remove(childId) == null) return;
    if (pending.isEmpty) {
      await _safeDelete(_pendingChildDeletions);
      return;
    }
    await _safeWrite(
      _pendingChildDeletions,
      jsonEncode({'version': 1, 'requests': pending}),
    );
  }

  Future<Map<String, String>> _readPendingChildDeletions() async {
    final encoded = await _safeRead(_pendingChildDeletions);
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
    final encoded = await _safeRead(_deletionReceipt);
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
      _safeRead(_legacyDeletionParentId),
      _safeRead(_legacyDeletionRequestId),
      _safeRead(_legacyDeletionSecret),
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
    await _safeWrite(
      _deletionReceipt,
      jsonEncode({
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
      } catch (error) {
        // The committed v1 record remains authoritative if legacy cleanup is
        // interrupted by a platform keystore failure. Recorded rather than
        // dropped: a keystore that refuses deletes will refuse other writes too.
        reportIgnoredError('auth_storage.legacy_cleanup', error);
      }
    }
  }

  /// Deletes only the capability the caller actually resolved. A late 404,
  /// rejection, or finish action cannot clear a different request's receipt.
  Future<bool> clearDeletionReceiptIfMatches(AccountDeletionReceipt expected) {
    return _withDeletionReceiptMutation(() async {
      final current = await _readDeletionReceiptUnlocked();
      if (current == null || !current.sameCapability(expected)) return false;
      await _safeDelete(_deletionReceipt);
      await _clearLegacyDeletionReceipt();
      return true;
    });
  }

  /// Clears only the active session. A pending deletion receipt is a separate
  /// recovery capability and must survive logout/account revocation.
  Future<void> clear() async {
    _memAccess = null;
    _memRefresh = null;
    _memParentId = null;
    _memLoaded = false;
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
