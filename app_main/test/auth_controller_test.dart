import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/app/router/auth_guard.dart';
import 'package:majarra/core/cache/catalog_cache.dart';
import 'package:majarra/features/auth/application/auth_controller.dart';
import 'package:majarra/features/auth/data/auth_storage.dart';
import 'package:majarra/features/auth/data/parent_pin_store.dart';
import 'package:majarra/features/child/application/child_provider.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';

class _FakeAuthStorage extends AuthStorage {
  bool cleared = false;

  @override
  Future<void> clear() async => cleared = true;
}

class _FakeParentPinStore extends ParentPinStore {
  bool cleared = false;

  @override
  Future<void> clear() async => cleared = true;
}

class _FakeCatalogCache extends CatalogCache {
  bool cleared = false;

  @override
  Future<void> clear() async => cleared = true;
}

class _FakeApiClient extends MajarraApiClient {
  _FakeApiClient({this.fails = false}) : super(http.Client());

  final bool fails;
  bool logoutCalled = false;

  @override
  Future<Map<String, dynamic>> logout() async {
    logoutCalled = true;
    if (fails) throw const MajarraApiException('Network request failed');
    return {'success': true};
  }
}

/// Wires the fakes into a container and returns them for inspection.
({
  ProviderContainer container,
  _FakeAuthStorage storage,
  _FakeParentPinStore pin,
  _FakeCatalogCache cache,
  _FakeApiClient api,
  AuthGuard guard,
})
_harness({bool serverFails = false}) {
  final storage = _FakeAuthStorage();
  final pin = _FakeParentPinStore();
  final cache = _FakeCatalogCache();
  final api = _FakeApiClient(fails: serverFails);

  // Constructed directly rather than through authGuardProvider, whose factory
  // calls load() and would hit the secure-storage platform channel.
  final guard = AuthGuard()..setAuthenticated(true);

  // `overrideWithValue`, not `overrideValue`: the latter does not exist on a
  // plain Provider in Riverpod 2.x.
  final container = ProviderContainer(
    overrides: [
      authStorageProvider.overrideWithValue(storage),
      parentPinStoreProvider.overrideWithValue(pin),
      catalogCacheProvider.overrideWithValue(cache),
      majarraApiClientProvider.overrideWithValue(api),
      authGuardProvider.overrideWithValue(guard),
    ],
  );
  addTearDown(container.dispose);

  return (
    container: container,
    storage: storage,
    pin: pin,
    cache: cache,
    api: api,
    guard: guard,
  );
}

void main() {
  test('clears every local store and ends the session', () async {
    final h = _harness();
    h.container.read(childProvider.notifier).selectChild(
      childId: 'child-1',
      ageTrack: 'kids',
      displayName: 'ليلى',
    );
    expect(h.container.read(childProvider).hasSelection, isTrue);

    await h.container.read(authControllerProvider).logout();

    expect(h.api.logoutCalled, isTrue, reason: 'server session must be revoked');
    expect(h.storage.cleared, isTrue);
    expect(h.pin.cleared, isTrue);
    expect(h.cache.cleared, isTrue);
    expect(h.container.read(childProvider).hasSelection, isFalse);
    expect(h.guard.isAuthenticated, isFalse);
    expect(h.guard.hasChild, isFalse);
  });

  test('still wipes locally when the server call fails', () async {
    // An offline user must be able to sign out. If a failed revoke aborted the
    // teardown, tokens and the parent PIN would survive on the device — the
    // opposite of what the button promises.
    final h = _harness(serverFails: true);

    await h.container.read(authControllerProvider).logout();

    expect(h.api.logoutCalled, isTrue);
    expect(h.storage.cleared, isTrue);
    expect(h.pin.cleared, isTrue);
    expect(h.cache.cleared, isTrue);
    expect(h.guard.isAuthenticated, isFalse);
  });

  test('the parent PIN never survives a sign-out', () async {
    // Regression guard for the shared-device case: a PIN enrolled by one parent
    // must not unlock the parental area of the next account signed in here.
    final h = _harness();
    await h.container.read(authControllerProvider).logout();
    expect(h.pin.cleared, isTrue);
  });

  test('is safe to call twice', () async {
    final h = _harness();
    await h.container.read(authControllerProvider).logout();
    await h.container.read(authControllerProvider).logout();
    expect(h.guard.isAuthenticated, isFalse);
  });
}
