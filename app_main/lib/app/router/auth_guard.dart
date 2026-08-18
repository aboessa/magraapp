import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

enum AuthLoadOutcome { ready, expiredWithoutRefresh }

/// Reactive session and parental-area gate used by [GoRouter].
///
/// A normal authenticated session and the local demo experience are deliberately
/// separate. Demo never receives bearer tokens and can only enter child-facing
/// routes. Parental access is an in-memory, short-lived proof: it is never
/// persisted and is cleared on sign-out, session replacement, expiry, and app
/// backgrounding.
class AuthGuard extends ChangeNotifier {
  AuthGuard({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const parentAccessDuration = Duration(minutes: 5);

  final FlutterSecureStorage _storage;
  Timer? _parentAccessTimer;

  bool _isAuthenticated = false;
  bool _isDemo = false;
  bool _hasChild = false;
  bool _isLoading = true;
  String? _parentId;
  String? _parentAccessOwner;
  String? _parentProof;
  DateTime? _parentAccessExpiresAt;

  bool get isLoading => _isLoading;

  /// True for either a real authenticated family session or the local demo.
  bool get isAuthenticated => _isAuthenticated;

  /// A local, child-only session. It never carries API credentials.
  bool get isDemo => _isAuthenticated && _isDemo;

  bool get isRealAuthenticated => _isAuthenticated && !_isDemo;
  bool get hasChild => _hasChild;
  String? get parentId => _parentId;
  DateTime? get parentAccessExpiresAt => _parentAccessExpiresAt;

  /// The signed server proof while it is valid. It is deliberately memory-only;
  /// the API client reads it through a callback and never writes it to storage.
  String? get parentProof => hasParentAccess ? _parentProof : null;

  bool get hasParentAccess {
    final expiresAt = _parentAccessExpiresAt;
    return isRealAuthenticated &&
        _parentId != null &&
        _parentAccessOwner == _parentId &&
        _parentProof != null &&
        _parentProof!.isNotEmpty &&
        expiresAt != null &&
        expiresAt.isAfter(DateTime.now());
  }

  bool _accessTokenExpired(String token) {
    try {
      final parts = token.split('.');
      // Majarra signed tokens are `payload.signature`; accept a conventional
      // three-part JWT as a migration-compatible read-only expiry hint too.
      if (parts.length != 2 && parts.length != 3) return false;
      var payload = parts.length == 2 ? parts[0] : parts[1];
      payload = payload.replaceAll('-', '+').replaceAll('_', '/');
      while (payload.length % 4 != 0) {
        payload += '=';
      }
      final decoded = jsonDecode(utf8.decode(base64.decode(payload)));
      if (decoded is! Map) return false;
      final expValue = decoded['exp'];
      final exp = expValue is num
          ? expValue.toInt()
          : int.tryParse('$expValue');
      if (exp == null) return false;
      final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      return exp <= nowSec + 30;
    } catch (_) {
      return false;
    }
  }

  /// Loads persisted credentials without publishing a terminal logged-out state
  /// until account-scoped data has been wiped by [AuthController].
  Future<AuthLoadOutcome> load() async {
    final values = await Future.wait([
      _storage.read(key: 'majarra_access_token'),
      _storage.read(key: 'majarra_parent_id'),
      _storage.read(key: 'majarra_refresh_token'),
    ]);
    final token = values[0];
    final storedParentId = values[1];
    final refreshToken = values[2];
    var isExpired = false;
    if (token != null && token.isNotEmpty) {
      isExpired = _accessTokenExpired(token);
    }
    final expiredWithoutRefresh =
        isExpired && (refreshToken == null || refreshToken.isEmpty);
    // If expired and we have refresh, keep authenticated but mark for silent
    // refresh via the API client's coalesced path. Only an explicit refresh 401
    // is terminal; transient refresh failures must preserve offline data.
    if (expiredWithoutRefresh) {
      _isAuthenticated = false;
      _parentId = null;
    } else {
      _isAuthenticated =
          token != null &&
          token.isNotEmpty &&
          storedParentId != null &&
          storedParentId.isNotEmpty;
      _parentId = _isAuthenticated ? storedParentId : null;
    }
    _isDemo = false;
    _clearParentAccess();
    if (expiredWithoutRefresh) {
      // Keep the router blocked until AuthController completes the same full
      // teardown used by logout, deletion, and a rejected refresh.
      return AuthLoadOutcome.expiredWithoutRefresh;
    }
    _isLoading = false;
    notifyListeners();
    return AuthLoadOutcome.ready;
  }

  void setAuthenticated(bool value, {String? parentId}) {
    final nextParentId = value ? (parentId ?? _parentId) : null;
    final changed =
        _isAuthenticated != value ||
        _isDemo ||
        _parentId != nextParentId ||
        _parentProof != null ||
        _isLoading;
    _isAuthenticated = value;
    _isDemo = false;
    _parentId = nextParentId;
    _isLoading = false;
    // This method is called when credentials are installed after login. Even
    // when the same parent signs in again, the session id may have changed, so
    // a proof bound to the previous session must never survive the replacement.
    _clearParentAccess();
    if (changed) notifyListeners();
  }

  /// Starts a memory-only reviewer experience without writing fake credentials.
  void startDemoSession() {
    _isAuthenticated = true;
    _isDemo = true;
    _parentId = null;
    _hasChild = false;
    _isLoading = false;
    _clearParentAccess();
    notifyListeners();
  }

  void setHasChild(bool value) {
    if (_hasChild == value) return;
    _hasChild = value;
    notifyListeners();
  }

  /// Stores a server-signed `parent_area` proof in memory only.
  ///
  /// The server expiry is authoritative and is capped to the local safety window
  /// so a malformed response can never create a longer-lived UI grant.
  bool grantParentAccess({required String proof, required DateTime expiresAt}) {
    if (!isRealAuthenticated ||
        _parentId == null ||
        proof.isEmpty ||
        !expiresAt.isAfter(DateTime.now())) {
      return false;
    }
    final maximum = DateTime.now().add(parentAccessDuration);
    final effectiveExpiry = expiresAt.isBefore(maximum) ? expiresAt : maximum;
    _parentAccessTimer?.cancel();
    _parentAccessOwner = _parentId;
    _parentProof = proof;
    _parentAccessExpiresAt = effectiveExpiry;
    _parentAccessTimer = Timer(
      effectiveExpiry.difference(DateTime.now()),
      revokeParentAccess,
    );
    notifyListeners();
    return true;
  }

  void revokeParentAccess() {
    final hadAccess =
        _parentAccessExpiresAt != null || _parentAccessOwner != null;
    _clearParentAccess();
    if (hadAccess) notifyListeners();
  }

  /// Marks the session as ended so `redirect` sends the user to `/login`.
  void handleLogout() {
    _isAuthenticated = false;
    _isDemo = false;
    _hasChild = false;
    _parentId = null;
    _isLoading = false;
    _clearParentAccess();
    notifyListeners();
  }

  void _clearParentAccess() {
    _parentAccessTimer?.cancel();
    _parentAccessTimer = null;
    _parentAccessOwner = null;
    _parentProof = null;
    _parentAccessExpiresAt = null;
  }

  @override
  void dispose() {
    _parentAccessTimer?.cancel();
    super.dispose();
  }
}

final authGuardProvider = Provider<AuthGuard>((ref) {
  final guard = AuthGuard();
  ref.onDispose(guard.dispose);
  return guard;
});
