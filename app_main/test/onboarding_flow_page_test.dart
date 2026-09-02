/// Widget tests for `OnboardingFlowPage` (task 32), proving the step
/// sequence actually advances end to end using a fake `MajarraApiClient`:
/// consent -> PIN setup -> child profile (with `markOnboardingComplete`
/// asserted true) -> basic controls -> finish, and that tapping "finish"
/// calls `OnboardingController.complete()` and navigates to `/`.
///
/// Follows the `_FakeApiClient` pattern already used by
/// `consent_page_test.dart`, `child_profile_form_page_test.dart` and
/// `pin_full_flow_test.dart` — a fake subclass of `MajarraApiClient`
/// overriding only the methods this flow actually calls, never a mock
/// framework.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/app/router/auth_guard.dart';
import 'package:majarra/features/auth/data/parent_pin_store.dart';
import 'package:majarra/features/downloads/application/download_providers.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/features/onboarding/application/onboarding_controller.dart';
import 'package:majarra/features/onboarding/domain/onboarding_step.dart';
import 'package:majarra/features/onboarding/presentation/pages/onboarding_flow_page.dart';
import 'package:majarra/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeApiClient extends MajarraApiClient {
  _FakeApiClient() : super(http.Client());

  Map<String, Object?>? lastCreateChildArgs;
  final List<Map<String, Object?>> updateChildSettingsCalls = [];
  int createChildCallCount = 0;

  @override
  Future<Map<String, dynamic>> fetchConsents({String? childId}) async => {
        'success': true,
        'data': {
          'rows': const [],
          'decisions': {
            'data_collection': const {'granted': true, 'required_version': '1'},
            'analytics': const {'granted': false, 'reason': 'never_granted', 'required_version': '1'},
            'voice': const {'granted': false, 'reason': 'never_granted', 'required_version': '1'},
            'personalization': const {'granted': false, 'reason': 'never_granted', 'required_version': '1'},
            'child_creations': const {'granted': false, 'reason': 'never_granted', 'required_version': '1'},
          },
        },
      };

  @override
  Future<Map<String, dynamic>> setParentPin({required String pin}) async => {
        'success': true,
        'data': {
          'parent_proof': 'server-proof-1',
          'issued_at': DateTime.now().toIso8601String(),
          'expires_at': DateTime.now().add(const Duration(minutes: 15)).toIso8601String(),
        },
      };

  @override
  Future<String> authorizeParentAction(String purpose) async => 'proof-$purpose';

  @override
  Future<Map<String, dynamic>> createChild({
    required String nickname,
    required int birthMonth,
    required int birthYear,
    required String avatarId,
    String language = 'ar',
    List<String> interests = const [],
    bool markOnboardingComplete = false,
  }) async {
    createChildCallCount++;
    lastCreateChildArgs = {
      'nickname': nickname,
      'birthMonth': birthMonth,
      'birthYear': birthYear,
      'avatarId': avatarId,
      'language': language,
      'interests': interests,
      'markOnboardingComplete': markOnboardingComplete,
    };
    return {'data': {'id': 'new-child-1'}};
  }

  @override
  Future<List<Map<String, Object?>>> fetchChildren() async => [
        {
          'id': 'new-child-1',
          'nickname': 'طفل تجريبي',
          'age_track': 'kids',
          'birth_month': 5,
          'birth_year': DateTime.now().year - 7,
          'avatar_id': 'avatar-1',
          'interests': const <String>[],
          'language': 'ar',
        },
      ];

  @override
  Future<Map<String, dynamic>> fetchChildSettings(String childId) async => {
        'success': true,
        'data': <String, dynamic>{'daily_minutes': 30},
      };

  @override
  Future<Map<String, dynamic>> updateChildSettings(
    String childId,
    Map<String, Object?> body,
  ) async {
    updateChildSettingsCalls.add(body);
    return {'success': true, 'data': <String, dynamic>{}};
  }
}

class _FakeParentPinStore extends ParentPinStore {
  @override
  Future<bool> hasPin({String? ownerId}) async => false;

  @override
  Future<bool> isBiometricEnabled() async => false;

  @override
  Future<void> setPin(String pin, {String? ownerId}) async {}
}

class _FlowHandles {
  _FlowHandles(this.router, this.guard);
  final GoRouter router;
  final AuthGuard guard;
}

Future<_FlowHandles> _pumpFlow(WidgetTester tester, _FakeApiClient api) async {
  // ConsentPage renders 5 rows in a ListView; the default test surface is
  // too short for the continue button below them to exist in the tree.
  await tester.binding.setSurfaceSize(const Size(900, 2000));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
  addTearDown(guard.dispose);

  final router = GoRouter(
    initialLocation: '/onboarding',
    routes: [
      GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingFlowPage()),
      GoRoute(path: '/', builder: (_, __) => const Scaffold(body: Text('home'))),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        majarraApiClientProvider.overrideWithValue(api),
        parentPinStoreProvider.overrideWithValue(_FakeParentPinStore()),
        authGuardProvider.overrideWithValue(guard),
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return _FlowHandles(router, guard);
}

void main() {
  testWidgets(
    'الرحلة تبدأ بـConsentPage وتنتقل عبر كل الخطوات حتى finish (Requirement 8.2)',
    (tester) async {
      final api = _FakeApiClient();
      final handles = await _pumpFlow(tester, api);
      final guard = handles.guard;

      // Step 1: consent.
      final l10n = lookupAppLocalizations(const Locale('ar'));
      expect(find.text(l10n.consentPageTitle), findsOneWidget);
      final continueFinder = find.text(l10n.consentContinueButton);
      await tester.scrollUntilVisible(continueFinder, 200);
      await tester.pumpAndSettle();
      await tester.tap(continueFinder);
      await tester.pumpAndSettle();

      // Step 2: PIN setup.
      expect(find.text(l10n.createParentPin), findsOneWidget);
      await tester.enterText(find.byType(TextField).first, '1946');
      await tester.enterText(find.byType(TextField).last, '1946');
      await tester.tap(find.byType(FilledButton).first);
      await tester.pumpAndSettle();

      // Step 3: child profile — fill nickname and save.
      expect(find.byType(TextField), findsWidgets);
      await tester.enterText(find.byType(TextField).first, 'طفل تجريبي');
      await tester.tap(find.byType(FilledButton).last);
      await tester.pumpAndSettle();

      expect(api.createChildCallCount, 1);
      expect(api.lastCreateChildArgs!['markOnboardingComplete'], isTrue);

      // Step 4: basic controls.
      expect(find.text(l10n.onboardingBasicControlsStepTitle), findsOneWidget);
      await tester.tap(find.text(l10n.onboardingContinueButton));
      await tester.pumpAndSettle();

      // Step 5: finish.
      expect(find.text(l10n.onboardingFinishTitle), findsOneWidget);

      // `grantParentAccess` (PIN setup step) armed a real ~15-minute Timer.
      // Cancel it explicitly before the test ends, matching the pattern in
      // `pin_full_flow_test.dart` — the pending-timer invariant check runs
      // before registered tearDowns fire.
      guard.revokeParentAccess();
    },
  );

  testWidgets(
    'الضغط على زر البدء يُكمل الرحلة ويذهب إلى / (Requirement 8.5)',
    (tester) async {
      final api = _FakeApiClient();
      SharedPreferences.setMockInitialValues({
        onboardingStepPrefsKey: OnboardingStep.finish.name,
      });
      final prefs = await SharedPreferences.getInstance();
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      final router = GoRouter(
        initialLocation: '/onboarding',
        routes: [
          GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingFlowPage()),
          GoRoute(path: '/', builder: (_, __) => const Scaffold(body: Text('home'))),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            majarraApiClientProvider.overrideWithValue(api),
            parentPinStoreProvider.overrideWithValue(_FakeParentPinStore()),
            authGuardProvider.overrideWithValue(guard),
            sharedPreferencesProvider.overrideWithValue(prefs),
          ],
          child: MaterialApp.router(
            routerConfig: router,
            locale: const Locale('ar'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final l10n = lookupAppLocalizations(const Locale('ar'));
      expect(find.text(l10n.onboardingFinishTitle), findsOneWidget);
      await tester.tap(find.text(l10n.onboardingFinishButton));
      await tester.pumpAndSettle();

      expect(find.text('home'), findsOneWidget);
      expect(prefs.getString(onboardingStepPrefsKey), isNull);
    },
  );
}
