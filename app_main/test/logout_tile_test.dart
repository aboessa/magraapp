import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/app/router/auth_guard.dart';
import 'package:majarra/core/cache/catalog_cache.dart';
import 'package:majarra/core/crypto/file_crypto.dart';
import 'package:majarra/features/auth/data/auth_storage.dart';
import 'package:majarra/features/auth/data/parent_pin_store.dart';
import 'package:majarra/features/downloads/application/download_providers.dart';
import 'package:majarra/features/downloads/data/download_repository.dart';
import 'package:majarra/features/games/application/creation_cloud_service.dart';
import 'package:majarra/features/games/data/local_creation_store.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/features/profile/presentation/pages/settings_page.dart';
import 'package:majarra/features/search/data/recent_searches_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeAuthStorage extends AuthStorage {
  bool cleared = false;

  @override
  Future<String?> getParentId() async => null;

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

class _FakeDownloadRepository extends DownloadRepository {
  _FakeDownloadRepository(SharedPreferences preferences)
    : super(
        prefs: preferences,
        crypto: FileCrypto(),
        directory: () async => Directory.systemTemp,
      );

  @override
  Future<void> cleanupPlayFiles() async {}

  @override
  Future<void> wipeAll() async {}
}

class _FakeApiClient extends MajarraApiClient {
  _FakeApiClient() : super(http.Client());

  bool logoutCalled = false;

  @override
  Future<List<Map<String, Object?>>> fetchChildren() async => const [];

  @override
  Future<Map<String, dynamic>> logout() async {
    logoutCalled = true;
    return {'success': true};
  }
}

void main() {
  late _FakeAuthStorage storage;
  late _FakeParentPinStore pin;
  late _FakeCatalogCache cache;
  late _FakeApiClient api;
  late AuthGuard guard;

  /// Pumps SettingsPage inside a router so `context.go('/login')` resolves.
  Future<void> pumpSettings(WidgetTester tester) async {
    // SettingsNotifier and the teardown stores read SharedPreferences. Injecting
    // one mock instance keeps this existing widget harness plugin-free.
    //
    // The reader entry is seeded so the teardown assertion is meaningful: an
    // empty store would pass whether or not logout clears anything.
    SharedPreferences.setMockInitialValues({
      'majarra_reader_pages_v1.story.story-bird-home.ar':
          '{"saved_at":9999999999999,"envelope":{"data":[{"id":"p1","page_number":1,"dwell_ms":13200}]}}',
    });
    final preferences = await SharedPreferences.getInstance();

    // The page is a long scroll and the sign-out tile sits at the very bottom.
    // A tall surface keeps it on screen so taps land without scrolling, which
    // is what silently broke the first version of this test.
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    storage = _FakeAuthStorage();
    pin = _FakeParentPinStore();
    cache = _FakeCatalogCache();
    api = _FakeApiClient();
    guard = AuthGuard()..setAuthenticated(true);

    final router = GoRouter(
      initialLocation: '/settings',
      routes: [
        GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
        GoRoute(
          path: '/login',
          builder: (_, __) => const Scaffold(body: Text('LOGIN')),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authStorageProvider.overrideWithValue(storage),
          parentPinStoreProvider.overrideWithValue(pin),
          catalogCacheProvider.overrideWithValue(cache),
          majarraApiClientProvider.overrideWithValue(api),
          authGuardProvider.overrideWithValue(guard),
          recentSearchesStoreProvider.overrideWithValue(
            RecentSearchesStore(prefs: preferences),
          ),
          localCreationStoreProvider.overrideWithValue(
            LocalCreationStore(preferences: () async => preferences),
          ),
          downloadRepositoryProvider.overrideWithValue(
            _FakeDownloadRepository(preferences),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> openDialog(WidgetTester tester) async {
    await tester.tap(find.byIcon(Icons.logout_rounded));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsOneWidget);
  }

  testWidgets('cancelling the dialog leaves the session untouched', (
    tester,
  ) async {
    await pumpSettings(tester);
    await openDialog(tester);

    await tester.tap(find.text('إلغاء'));
    await tester.pumpAndSettle();

    expect(api.logoutCalled, isFalse);
    expect(storage.cleared, isFalse);
    expect(pin.cleared, isFalse);
    expect(guard.isAuthenticated, isTrue);
    expect(find.text('LOGIN'), findsNothing);
  });

  testWidgets('confirming tears down the session and routes to login', (
    tester,
  ) async {
    await pumpSettings(tester);
    await openDialog(tester);

    // Scoped to the dialog: the confirm button carries the same label as the
    // tile behind it, so a bare text finder would match twice.
    await tester.tap(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.byType(FilledButton),
      ),
    );
    await tester.pumpAndSettle();

    expect(api.logoutCalled, isTrue);
    expect(storage.cleared, isTrue);
    expect(pin.cleared, isTrue);
    expect(cache.cleared, isTrue);
    expect(guard.isAuthenticated, isFalse);
    expect(find.text('LOGIN'), findsOneWidget);

    // Reader page snapshots hold page text and timing for whichever stories
    // this account opened. Leaving them behind carried one family's reading
    // material into the next family's session on a shared device.
    final prefs = await SharedPreferences.getInstance();
    expect(
      prefs.getKeys().where((key) => key.startsWith('majarra_reader_pages_v1')),
      isEmpty,
      reason: 'logout must wipe cached reader pages',
    );
  });

  testWidgets('the dialog warns that the parent PIN will be deleted', (
    tester,
  ) async {
    // The wording is load-bearing: removing the PIN is destructive and the
    // parent must be told before confirming, not after.
    await pumpSettings(tester);
    await openDialog(tester);

    expect(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.textContaining('رمز ولي الأمر'),
      ),
      findsOneWidget,
      reason: 'the confirmation must disclose that the PIN is removed',
    );
  });
}
