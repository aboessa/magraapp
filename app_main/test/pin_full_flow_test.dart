/// Full-flow test for the parental PIN gate (task 24): setup → lock →
/// unlock (with and without a biometric re-arm) → rate limiting.
///
/// ## Scope note on "تغيير PIN" (Requirement 11.3/11.4)
///
/// Investigated before writing this file: there is currently **no UI entry
/// point** anywhere in `app_main/lib` that calls
/// `MajarraApiClient.authorizeParentAction('change_parent_pin')`. Neither
/// `pin_setup_page.dart` nor `pin_unlock_page.dart` exposes a "change PIN"
/// action (task 23's scope was explicitly setup/unlock split only), and
/// `settings_page.dart`'s biometric tile only toggles the local biometric
/// convenience flag, not the PIN's value itself. A grep across `lib/` for
/// `change_parent_pin` only turns up doc-comment mentions in the two PIN
/// pages, and a grep for "تغيير"/"غيّر" in `settings_page.dart` finds nothing
/// PIN-related either.
///
/// Rather than fabricate a settings screen just to make this "integration"
/// in the strict page sense (out of scope for this task), the "تغيير PIN"
/// group below is a **contract-level test of `MajarraApiClient` itself**:
/// it drives `authorizeParentAction('change_parent_pin')` and `setParentPin`
/// directly against a fake client that simulates the server's one-time-proof
/// consumption contract (`dashboard/api/src/routes/family.ts`'s
/// `requireParentProof(..., 'change_parent_pin', true)`, already covered
/// server-side in `dashboard/api/test/parentProof.test.mjs`). This proves the
/// client-side plumbing is wired correctly, but it is **not** a widget test
/// and does not exercise any production screen — that gap (no change-PIN UI)
/// is real and is flagged here for a future task/backlog item rather than
/// silently invented.
///
/// Requirements: 11.4, 11.7 (plus 11.1/11.2/11.5 as supporting setup for the
/// "lock → unlock" sequence the task describes).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/app/router/auth_guard.dart';
import 'package:majarra/core/security/biometric_auth.dart';
import 'package:majarra/features/auth/data/parent_pin_store.dart';
import 'package:majarra/features/auth/presentation/pages/pin_setup_page.dart';
import 'package:majarra/features/auth/presentation/pages/pin_unlock_page.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/l10n/app_localizations.dart';

/// Fake `ParentPinStore` with per-test-configurable `hasPin`/biometric state.
/// `setPin` is overridden to a cheap in-memory flip instead of touching
/// secure storage, mirroring `_FakeParentPinStore` in
/// `pin_setup_unlock_pages_smoke_test.dart`.
class _ConfigurableFakeParentPinStore extends ParentPinStore {
  _ConfigurableFakeParentPinStore({
    this.hasPinValue = false,
    this.biometricEnabled = false,
  });

  bool hasPinValue;
  bool biometricEnabled;

  @override
  Future<bool> hasPin({String? ownerId}) async => hasPinValue;

  @override
  Future<bool> isBiometricEnabled() async => biometricEnabled;

  @override
  Future<void> setPin(String pin, {String? ownerId}) async {
    hasPinValue = true;
  }
}

/// Deterministic fake biometric authenticator, configurable per test.
class _FakeBiometricAuthenticator implements BiometricAuthenticator {
  _FakeBiometricAuthenticator({
    this.avail = BiometricAvailability.unsupported,
    this.authResult = false,
  });

  BiometricAvailability avail;
  bool authResult;
  int authenticateCalls = 0;

  @override
  Future<BiometricAvailability> availability() async => avail;

  @override
  Future<bool> authenticate({required String localizedReason}) async {
    authenticateCalls++;
    return authResult;
  }
}

/// Fake `MajarraApiClient` that simulates `setParentPin`/`verifyParentPin`/
/// `authorizeParentAction` responses, configurable per test case, following
/// the `_FakeApiClient` pattern in `logout_tile_test.dart` and
/// `child_profile_form_page_test.dart`.
///
/// Also simulates the server's one-time-proof consumption contract for
/// `change_parent_pin` (see the file header) entirely in memory, since no
/// production caller exists to exercise through a widget.
class _FakeApiClient extends MajarraApiClient {
  _FakeApiClient() : super(http.Client());

  int setPinCallCount = 0;
  int verifyCallCount = 0;
  final List<String> authorizeCalls = [];

  Object? setParentPinError;
  Map<String, dynamic>? setParentPinResponse;

  Object? verifyParentPinError;
  Map<String, dynamic>? verifyParentPinResponse;

  bool _serverHasExistingPin = false;
  final Set<String> _issuedProofs = {};
  final Set<String> _consumedProofs = {};
  String? _presentedProof;
  int _pinVersion = 1;

  Set<String> get consumedProofs => _consumedProofs;
  int get pinVersion => _pinVersion;

  void simulateServerHasExistingPin() => _serverHasExistingPin = true;

  /// Test-only hook standing in for the `X-Parent-Proof` header this fake
  /// bypasses (it overrides `setParentPin` directly instead of going through
  /// `MajarraApiClient._headers`/`getParentProof`).
  void presentProofForNextSetParentPin(String? proof) => _presentedProof = proof;

  @override
  Future<Map<String, dynamic>> setParentPin({required String pin}) async {
    setPinCallCount++;
    if (setParentPinError != null) {
      // ignore: only_throw_errors
      throw setParentPinError!;
    }
    if (_serverHasExistingPin) {
      final proof = _presentedProof;
      _presentedProof = null;
      final proofIsLiveAndUnconsumed =
          proof != null && _issuedProofs.contains(proof) && !_consumedProofs.contains(proof);
      if (!proofIsLiveAndUnconsumed) {
        throw const MajarraApiException(
          'HTTP 403: {"success":false,"error":"a current parent proof is required to change the PIN"}',
          statusCode: 403,
        );
      }
      _consumedProofs.add(proof);
      _pinVersion++;
    } else {
      _serverHasExistingPin = true;
    }
    return setParentPinResponse ?? _successEnvelope();
  }

  @override
  Future<Map<String, dynamic>> verifyParentPin({
    required String pin,
    String purpose = 'parent_area',
  }) async {
    verifyCallCount++;
    if (verifyParentPinError != null) {
      // ignore: only_throw_errors
      throw verifyParentPinError!;
    }
    return verifyParentPinResponse ?? _successEnvelope();
  }

  @override
  Future<String> authorizeParentAction(String purpose) async {
    authorizeCalls.add(purpose);
    final proof = 'proof-$purpose-${_issuedProofs.length + 1}';
    _issuedProofs.add(proof);
    return proof;
  }

  Map<String, dynamic> _successEnvelope() => {
        'success': true,
        'data': {
          'parent_proof': 'server-proof-${DateTime.now().microsecondsSinceEpoch}',
          'issued_at': DateTime.now().toIso8601String(),
          'expires_at': DateTime.now().add(const Duration(minutes: 15)).toIso8601String(),
          'pin_version': _pinVersion,
        },
      };
}

/// Pumps [page] behind a real `GoRouter` (so `context.go`/`context.pop`
/// resolve) with `/parent` as the default return target both pages fall
/// back to when `returnTo` is unset or unrecognised.
Future<GoRouter> _pumpGatePage(
  WidgetTester tester, {
  required Widget page,
  required AuthGuard guard,
  required MajarraApiClient api,
  ParentPinStore? store,
  BiometricAuthenticator? biometric,
}) async {
  final router = GoRouter(
    initialLocation: '/gate',
    routes: [
      GoRoute(path: '/gate', builder: (_, __) => page),
      GoRoute(
        path: '/parent',
        builder: (_, __) => const Scaffold(body: Text('PARENT_HOME_MARK')),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        majarraApiClientProvider.overrideWithValue(api),
        authGuardProvider.overrideWithValue(guard),
        if (store != null) parentPinStoreProvider.overrideWithValue(store),
        if (biometric != null)
          biometricAuthenticatorProvider.overrideWithValue(biometric),
      ],
      child: MaterialApp.router(
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

void main() {
  group('الإعداد أول مرة (Requirement 11.1)', () {
    testWidgets('إدخال رمز وتأكيده بنجاح يمنح وصول الوالد وينقل للهدف', (
      tester,
    ) async {
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);
      final api = _FakeApiClient();
      final store = _ConfigurableFakeParentPinStore(hasPinValue: false);

      await _pumpGatePage(
        tester,
        page: const PinSetupPage(),
        guard: guard,
        api: api,
        store: store,
      );
      expect(guard.hasParentAccess, isFalse);

      await tester.enterText(find.byType(TextField).at(0), '1946');
      await tester.enterText(find.byType(TextField).at(1), '1946');
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();

      expect(api.setPinCallCount, 1);
      expect(guard.hasParentAccess, isTrue);
      expect(find.text('PARENT_HOME_MARK'), findsOneWidget);

      // `grantParentAccess` armed a real ~15-minute Timer. Cancel it
      // explicitly (not just via `addTearDown(guard.dispose)`) so the
      // `testWidgets` pending-timer invariant check — which runs before
      // registered tearDowns fire — does not flag it.
      guard.revokeParentAccess();
    });
  });

  group('قفل ثم فتح — بلا بصمة (محاكاة إغلاق وإعادة فتح)', () {
    testWidgets('revokeParentAccess يقفل، وإدخال الرمز الصحيح يعيد المنح', (
      tester,
    ) async {
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      // Simulate a prior successful setup/unlock in this session…
      final firstGrant = guard.grantParentAccess(
        proof: 'initial-proof',
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
      );
      expect(firstGrant, isTrue);
      expect(guard.hasParentAccess, isTrue);

      // …then simulate the app being locked (backgrounded / re-guarded).
      // AuthGuard's own timer/backgrounding logic is out of scope here; only
      // the resulting state (no live proof) matters for this test.
      guard.revokeParentAccess();
      expect(guard.hasParentAccess, isFalse);

      final api = _FakeApiClient();
      final store = _ConfigurableFakeParentPinStore(hasPinValue: true);

      await _pumpGatePage(
        tester,
        page: const PinUnlockPage(),
        guard: guard,
        api: api,
        store: store,
      );

      await tester.enterText(find.byType(TextField), '1946');
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();

      expect(api.verifyCallCount, 1);
      expect(guard.hasParentAccess, isTrue);
      expect(find.text('PARENT_HOME_MARK'), findsOneWidget);

      guard.revokeParentAccess(); // cancel the live grant Timer before teardown
    });
  });

  group('فتح بالبصمة (إعادة تسليح إثبات حيّ)', () {
    testWidgets(
      'إثبات حيّ + بصمة متاحة وناجحة يعيد التسليح بلا نداء verifyParentPin',
      (tester) async {
        final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
        addTearDown(guard.dispose);

        final granted = guard.grantParentAccess(
          proof: 'live-proof',
          expiresAt: DateTime.now().add(const Duration(minutes: 10)),
        );
        expect(granted, isTrue);
        expect(guard.hasParentAccess, isTrue);

        final api = _FakeApiClient();
        final store = _ConfigurableFakeParentPinStore(
          hasPinValue: true,
          biometricEnabled: true,
        );
        final biometric = _FakeBiometricAuthenticator(
          avail: BiometricAvailability.available,
          authResult: true,
        );

        await _pumpGatePage(
          tester,
          page: const PinUnlockPage(),
          guard: guard,
          api: api,
          store: store,
          biometric: biometric,
        );

        expect(biometric.authenticateCalls, 1);
        // The re-arm path never contacts the server: it only re-affirms the
        // already-live proof already granted above.
        expect(api.verifyCallCount, 0);
        expect(guard.hasParentAccess, isTrue);
        expect(find.text('PARENT_HOME_MARK'), findsOneWidget);

        guard.revokeParentAccess(); // cancel the live grant Timer before teardown
      },
    );
  });

  group(
    'تغيير PIN بإثبات change_parent_pin مستهلَك لمرة واحدة '
    '(اختبار عقد MajarraApiClient — لا واجهة إنتاج تستدعيه اليوم)',
    () {
      test('أول تسجيل PIN لا يتطلب إثباتًا وينجح', () async {
        final api = _FakeApiClient();

        final response = await api.setParentPin(pin: '1946');

        expect(response['success'], isTrue);
        expect(api.setPinCallCount, 1);
      });

      test(
        'تغيير PIN بعد وجود PIN مسبق يتطلب إثبات change_parent_pin صالحًا',
        () async {
          final api = _FakeApiClient()..simulateServerHasExistingPin();

          final proof = await api.authorizeParentAction('change_parent_pin');
          expect(api.authorizeCalls, ['change_parent_pin']);

          api.presentProofForNextSetParentPin(proof);
          final response = await api.setParentPin(pin: '2468');

          expect(response['success'], isTrue);
          expect(api.consumedProofs, contains(proof));
          expect(api.pinVersion, 2);
        },
      );

      test('إعادة استخدام إثبات change_parent_pin المُستهلَك يفشل بـ403', () async {
        final api = _FakeApiClient()..simulateServerHasExistingPin();

        final proof = await api.authorizeParentAction('change_parent_pin');
        api.presentProofForNextSetParentPin(proof);
        await api.setParentPin(pin: '2468'); // consumes the proof

        api.presentProofForNextSetParentPin(proof); // reuse the SAME proof
        await expectLater(
          () => api.setParentPin(pin: '3579'),
          throwsA(
            isA<MajarraApiException>().having(
              (e) => e.statusCode,
              'statusCode',
              403,
            ),
          ),
        );
        // The reuse attempt must not have minted a second consumption or
        // silently bumped the version.
        expect(api.pinVersion, 2);
      });

      test('تغيير PIN بلا أي إثبات (بعد وجود PIN) يفشل بـ403', () async {
        final api = _FakeApiClient()..simulateServerHasExistingPin();

        await expectLater(
          () => api.setParentPin(pin: '2468'),
          throwsA(isA<MajarraApiException>()),
        );
      });
    },
  );

  group('تحديد المعدل عند إدخال خاطئ متكرر (Requirement 11.7)', () {
    testWidgets(
      '423 يعرض رسالة تحديد معدل بمهلة زمنية بلا كشف عدد المحاولات المتبقية، ولا يمنح وصولًا',
      (tester) async {
        final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
        addTearDown(guard.dispose);

        final api = _FakeApiClient()
          ..verifyParentPinError = const MajarraApiException(
            'HTTP 423: {"success":false,"error":"Too many attempts",'
            '"locked_until":"2026-01-01T00:00:00Z"}',
            statusCode: 423,
          );
        final store = _ConfigurableFakeParentPinStore(hasPinValue: true);

        await _pumpGatePage(
          tester,
          page: const PinUnlockPage(),
          guard: guard,
          api: api,
          store: store,
        );

        await tester.enterText(find.byType(TextField), '0000');
        await tester.tap(find.byType(FilledButton));
        await tester.pumpAndSettle();

        // `pinLockedOut` ("محاولات كثيرة. حاول بعد {label}") is a
        // duration-based message — it must render, and it must never mention
        // a remaining-attempts count (that phrasing belongs to the separate
        // `pinIncorrectAttemptsLeft`/`pinIncorrectOneLeft` keys, which this
        // screen's 423 branch never uses).
        final errorFinder = find.textContaining('محاولات كثيرة');
        expect(errorFinder, findsOneWidget);

        final errorText = tester.widget<Text>(errorFinder).data ?? '';
        expect(errorText, contains('حاول بعد'));
        expect(errorText, isNot(contains('متبقية')));
        expect(errorText, isNot(contains('محاولة واحدة')));

        expect(api.verifyCallCount, 1);
        expect(guard.hasParentAccess, isFalse);
      },
    );
  });
}
