import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/app/router/app_router.dart';
import 'package:majarra/app/router/auth_guard.dart';
import 'package:majarra/app/router/route_access.dart';
import 'package:majarra/features/auth/data/auth_storage.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/features/tv/presentation/pages/link_tv_page.dart';
import 'package:majarra/features/tv/presentation/pages/tv_pairing_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// TV-001: television sign-in by pairing code, both halves.

class _SavingStorage extends AuthStorage {
  final saved = <String, String>{};

  @override
  Future<void> save({
    required String accessToken,
    required String refreshToken,
    required String parentId,
  }) async {
    saved
      ..['access'] = accessToken
      ..['refresh'] = refreshToken
      ..['parent'] = parentId;
  }
}

class _PairingApi extends MajarraApiClient {
  _PairingApi() : super(http.Client());

  int starts = 0;
  final pollResults = <Object>[];
  final startedWith = <String, String>{};
  Object? lookupResult;
  Object? approveResult;
  final approvedCodes = <String>[];

  @override
  Future<Map<String, dynamic>> startTvPairing({
    required String installationId,
    required String platform,
    String? deviceName,
  }) async {
    starts += 1;
    startedWith['platform'] = platform;
    startedWith['name'] = deviceName ?? '';
    return {
      'success': true,
      'data': {
        'code': starts == 1 ? 'ABCD-EF23' : 'WXYZ-9876',
        'poll_secret': 's' * 43,
        'expires_in': 600,
        'interval': 5,
        'verification_uri_complete': 'majarra://app/link-tv?code=ABCD-EF23',
      },
    };
  }

  @override
  Future<Map<String, dynamic>> pollTvPairing({
    required String code,
    required String pollSecret,
  }) async {
    final next = pollResults.isEmpty
        ? {
            'success': true,
            'data': {'status': 'pending'},
          }
        : pollResults.removeAt(0);
    if (next is MajarraApiException) throw next;
    return next as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> lookupTvPairing({required String code}) async {
    final result = lookupResult;
    if (result is MajarraApiException) throw result;
    return result as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> approveTvPairing({required String code}) async {
    approvedCodes.add(code);
    final result = approveResult;
    if (result is MajarraApiException) throw result;
    return result as Map<String, dynamic>;
  }
}

Future<void> _pump(
  WidgetTester tester, {
  required String location,
  required _PairingApi api,
  required AuthGuard guard,
  AuthStorage? storage,
}) async {
  tester.view.physicalSize = const Size(1920, 1080);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: location,
    routes: [
      GoRoute(path: '/tv-pairing', builder: (_, __) => const TvPairingPage()),
      GoRoute(
        path: '/link-tv',
        builder: (_, state) =>
            LinkTvPage(initialCode: state.uri.queryParameters['code']),
      ),
      GoRoute(path: '/children', builder: (_, __) => const Text('CHILDREN')),
      GoRoute(path: '/devices', builder: (_, __) => const Text('DEVICES')),
      GoRoute(path: '/login', builder: (_, __) => const Text('LOGIN')),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        majarraApiClientProvider.overrideWithValue(api),
        authGuardProvider.overrideWithValue(guard),
        if (storage != null) authStorageProvider.overrideWithValue(storage),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        builder: (context, child) =>
            Directionality(textDirection: TextDirection.rtl, child: child!),
      ),
    ),
  );
  // The TV label comes over a platform channel first; let it settle.
  for (var i = 0; i < 4; i++) {
    await tester.pump();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    // The native side of `com.majarra/device`: no seed, a TV model name.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('com.majarra/device'),
          (call) async => call.method == 'deviceLabel' ? 'Xiaomi MIBOX4' : null,
        );
  });

  test('a signed-out television can reach the pairing screen', () {
    expect(accessFor('/tv-pairing'), RouteAccess.public);
    expect(accessFor('/link-tv'), RouteAccess.authenticatedFamily);
  });

  test(
    'a freshly installed TV opens on the pairing code, not the email form',
    () {
      String? tv(String location, {String? method, bool signedIn = false}) =>
          signedOutTvRedirect(
            location: location,
            isAuthenticated: signedIn,
            isTelevision: true,
            loginMethod: method,
          );
      // First launch: `/` is protected, so the TV lands on the code.
      expect(tv('/'), '/tv-pairing');
      expect(tv('/login'), '/tv-pairing');
      expect(tv('/playback/ep-1'), '/tv-pairing');
      expect(tv('/tv-pairing'), isNull);
      // The explicit fallback and other public pages stay reachable.
      expect(tv('/login', method: 'email'), isNull);
      expect(tv('/privacy'), isNull);
      // Signed in, or not a TV: this rule does nothing.
      expect(tv('/', signedIn: true), isNull);
      expect(
        signedOutTvRedirect(
          location: '/',
          isAuthenticated: false,
          isTelevision: false,
        ),
        isNull,
        reason: 'a phone still goes to the normal login',
      );
    },
  );

  testWidgets('the TV shows a code and signs itself in once it is approved', (
    tester,
  ) async {
    final api = _PairingApi()
      ..pollResults.addAll([
        {
          'success': true,
          'data': {'status': 'pending'},
        },
        {
          'success': true,
          'data': {
            'status': 'approved',
            'access_token': 'access-1',
            'refresh_token': 'v1.refresh',
            'parent': {'id': 'parent-1', 'plan': 'family'},
          },
        },
      ]);
    final guard = AuthGuard();
    addTearDown(guard.dispose);
    final storage = _SavingStorage();

    await _pump(
      tester,
      location: '/tv-pairing',
      api: api,
      guard: guard,
      storage: storage,
    );
    expect(find.text('ABCD-EF23'), findsOneWidget);
    expect(api.startedWith['platform'], 'android_tv');
    expect(
      api.startedWith['name'],
      'تلفزيون Xiaomi MIBOX4',
      reason: 'two TVs must be told apart',
    );

    await tester.pump(const Duration(seconds: 5));
    expect(find.text('ABCD-EF23'), findsOneWidget, reason: 'still waiting');
    expect(storage.saved, isEmpty);

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(storage.saved, {
      'access': 'access-1',
      'refresh': 'v1.refresh',
      'parent': 'parent-1',
    });
    expect(guard.isAuthenticated, isTrue);
    expect(find.text('CHILDREN'), findsOneWidget);
  });

  testWidgets(
    'an expired code is replaced with a fresh one, not shown as an error',
    (tester) async {
      final api = _PairingApi()
        ..pollResults.add(
          const MajarraApiException(
            'expired',
            statusCode: 410,
            code: 'pairing_expired',
          ),
        );
      final guard = AuthGuard();
      addTearDown(guard.dispose);

      await _pump(tester, location: '/tv-pairing', api: api, guard: guard);
      await tester.pump(const Duration(seconds: 5));
      await tester.pump();
      await tester.pump();
      expect(api.starts, 2);
      expect(find.text('WXYZ-9876'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('the TV offers the email form as a fallback', (tester) async {
    final api = _PairingApi();
    final guard = AuthGuard();
    addTearDown(guard.dispose);

    await _pump(tester, location: '/tv-pairing', api: api, guard: guard);
    await tester.tap(find.text('الدخول بالبريد وكلمة المرور'));
    await tester.pumpAndSettle();
    expect(find.text('LOGIN'), findsOneWidget);
  });

  testWidgets('the phone shows which device asks, then approves it', (
    tester,
  ) async {
    final api = _PairingApi()
      ..lookupResult = {
        'success': true,
        'data': {
          'code': 'ABCD-EF23',
          'platform': 'android_tv',
          'device_name': 'تلفزيون الصالة',
        },
      }
      ..approveResult = {
        'success': true,
        'data': {'approved': true},
      };
    final guard = AuthGuard()..setAuthenticated(true, parentId: 'parent-1');
    addTearDown(guard.dispose);
    guard.grantParentAccess(
      proof: 'proof',
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );

    await _pump(
      tester,
      location: '/link-tv?code=abcd-ef23',
      api: api,
      guard: guard,
    );
    await tester.pumpAndSettle();
    expect(find.text('تلفزيون الصالة'), findsOneWidget);

    await tester.tap(find.text('موافقة بـ PIN ولي الأمر'));
    await tester.pumpAndSettle();
    expect(api.approvedCodes, ['ABCDEF23']);
    expect(find.textContaining('تم ربط التلفزيون'), findsOneWidget);
    guard.revokeParentAccess(); // Cancels the guard's own expiry timer.
  });

  testWidgets('a device-limit refusal points the parent to device management', (
    tester,
  ) async {
    final api = _PairingApi()
      ..lookupResult = {
        'success': true,
        'data': {'code': 'ABCD-EF23', 'platform': 'android_tv'},
      }
      ..approveResult = const MajarraApiException(
        'This account has reached its device limit',
        statusCode: 403,
      );
    final guard = AuthGuard()..setAuthenticated(true, parentId: 'parent-1');
    addTearDown(guard.dispose);
    guard.grantParentAccess(
      proof: 'proof',
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );

    await _pump(
      tester,
      location: '/link-tv?code=ABCD-EF23',
      api: api,
      guard: guard,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('موافقة بـ PIN ولي الأمر'));
    await tester.pumpAndSettle();
    expect(find.textContaining('حدّ التلفزيونات'), findsOneWidget);
    await tester.tap(find.text('إدارة الأجهزة'));
    await tester.pumpAndSettle();
    expect(find.text('DEVICES'), findsOneWidget);
    guard.revokeParentAccess();
  });

  testWidgets('an unknown code is explained on the phone', (tester) async {
    final api = _PairingApi()
      ..lookupResult = const MajarraApiException('not found', statusCode: 404);
    final guard = AuthGuard()..setAuthenticated(true, parentId: 'parent-1');
    addTearDown(guard.dispose);

    await _pump(tester, location: '/link-tv', api: api, guard: guard);
    await tester.enterText(find.byType(TextField), 'zzzz9999');
    await tester.tap(find.text('متابعة'));
    await tester.pumpAndSettle();
    expect(find.textContaining('الكود غير صحيح'), findsOneWidget);
  });
}
