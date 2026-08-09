import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/auth_guard.dart';
import '../../../core/cache/catalog_cache.dart';
import '../../child/application/child_provider.dart';
import '../../home/application/home_providers.dart';
import '../data/parent_pin_store.dart';

/// Session teardown (M11).
///
/// The audit found the sign-out button wired to `onPressed: () {}` while
/// `AuthStorage.clear()` existed with no callers. Local deletion alone is not
/// enough: the refresh token stays valid on the server until it expires, and a
/// stale parent PIN would unlock the next account signed in on the same device.
///
/// Order matters. The server call runs first so a still-valid access token is
/// available to authenticate it, but its failure never blocks the local wipe —
/// otherwise an offline user could not sign out at all, which is worse than a
/// session lingering server-side until expiry.
class AuthController {
  const AuthController(this._ref);

  final Ref _ref;

  Future<void> logout() async {
    // 1. Revoke server-side while the token is still usable.
    try {
      await _ref.read(majarraApiClientProvider).logout();
    } catch (_) {
      // Offline, expired, or already revoked. Proceed with the local wipe.
    }

    // 2. Remove every credential and personalised artefact from the device.
    //    Each is guarded separately: a failure in one store must not leave the
    //    others behind, which would be the worst outcome on a shared device.
    //    Read through providers rather than constructing the stores here, so a
    //    test can substitute them without a Keychain or platform channel.
    for (final wipe in <Future<void> Function()>[
      () => _ref.read(authStorageProvider).clear(),
      // A PIN enrolled by one parent must never gate another account.
      () => _ref.read(parentPinStoreProvider).clear(),
      // Cached catalogue rows are not per-account today, but clearing them keeps
      // that true if entitlement-filtered content is ever cached.
      () => _ref.read(catalogCacheProvider).clear(),
    ]) {
      try {
        await wipe();
      } catch (_) {
        // Best effort; continue to the next store.
      }
    }

    // 3. Drop the active child so the next session cannot inherit a profile.
    _ref.read(childProvider.notifier).clear();

    // 4. Invalidate anything derived from the session. Without this the home
    //    screen would keep rendering the previous account's catalogue until it
    //    happened to refetch.
    _ref.invalidate(homeCatalogProvider);

    // 5. Flip the guard last, so `redirect` re-evaluates against fully cleared
    //    state rather than racing the wipe above.
    _ref.read(authGuardProvider).handleLogout();
  }
}

final authControllerProvider = Provider<AuthController>(AuthController.new);
