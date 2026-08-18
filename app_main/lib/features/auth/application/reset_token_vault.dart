import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Memory-only handoff for a reset capability captured from a deep-link
/// fragment. GoRouter immediately redirects to the fragment-free path, then the
/// page takes the token once; it is never persisted or left in browser history.
class ResetTokenVault {
  String? _token;

  void capture(String token) {
    final normalized = token.trim();
    if (normalized.isEmpty || normalized.length > 8192) return;
    _token = normalized;
  }

  String? take() {
    final value = _token;
    _token = null;
    return value;
  }

  void clear() => _token = null;
}

final resetTokenVaultProvider = Provider<ResetTokenVault>(
  (ref) => ResetTokenVault(),
);
