import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Notifies [GoRouter] when authentication or child selection changes.
///
/// This is the `refreshListenable` for C5. The audit required three guards
/// (Parent Session / Child Session / Parental Area) backed by `GoRouter.redirect`
/// — without a listenable, navigation would not re-evaluate after login, logout
/// or child switch and the guards would be dead code.
class AuthGuard extends ChangeNotifier {
  AuthGuard({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  bool _isAuthenticated = false;
  bool _hasChild = false;
  bool _isLoading = true;

  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  bool get hasChild => _hasChild;

  Future<void> load() async {
    final token = await _storage.read(key: 'majarra_access_token');
    _isAuthenticated = token != null && token.isNotEmpty;
    _isLoading = false;
    notifyListeners();
  }

  void setAuthenticated(bool value) {
    if (_isAuthenticated == value) return;
    _isAuthenticated = value;
    notifyListeners();
  }

  void setHasChild(bool value) {
    if (_hasChild == value) return;
    _hasChild = value;
    notifyListeners();
  }

  /// Marks the session as ended so `redirect` sends the user back to `/login`.
  ///
  /// Only flips the flags: clearing tokens, the PIN and cached content is the
  /// caller's job (see `AuthController.logout`). Keeping the two apart means the
  /// guard has no dependency on storage beyond the one read in [load].
  void handleLogout() {
    _isAuthenticated = false;
    _hasChild = false;
    notifyListeners();
  }
}

final authGuardProvider = Provider<AuthGuard>((ref) {
  final guard = AuthGuard();
  guard.load();
  ref.onDispose(guard.dispose);
  return guard;
});
