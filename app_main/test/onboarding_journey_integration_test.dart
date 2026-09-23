/// Integration coverage for the full first-run onboarding journey (task 33):
/// registration → consents → PIN → child → interests/language → start, with
/// exit-and-return proven at every step and an already-onboarded account
/// confirmed to bypass the journey entirely (Requirements 8.3, 8.5).
///
/// This file deliberately does not repeat what `onboarding_flow_page_test.dart`
/// (task 32) already proves — the full happy-path step sequence, and resuming
/// at ONE pre-seeded step (`finish`) — nor what `onboarding_controller_test.dart`
/// (task 29) already proves — a single `goToStep` round trip. It adds exactly
/// the two things neither file proves yet:
///
/// 1. Exit-and-return at EVERY one of the six `OnboardingStep` values, not
///    just one hand-picked step (a controller-level exhaustive sweep, plus
///    one genuinely widget-level "close and reopen" proof through
///    `OnboardingFlowPage` itself).
/// 2. A family that already completed onboarding reaching its normal
///    destination without ever seeing `/onboarding`, exercised through the
///    REAL `routerProvider`/`_guardRedirect` in `app_router.dart` — not a
///    local copy of the redirect condition (that local-copy approach is what
///    `route_guard_matrix_test.dart` already uses for a different purpose:
///    proving the redirect logic's boolean combination is right, not proving
///    the router itself never surfaces `/onboarding`). `routerProvider` is a
///    public top-level provider, so building a real `MaterialApp.router`
///    against it and asserting which page actually renders is achievable
///    without touching `app_router.dart`'s private `_guardRedirect` — this
///    is the approach used below, matching the "prefer the real router if
///    feasible" guidance for this task.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/app/router/app_router.dart';
import 'package:majarra/app/router/auth_guard.dart';
import 'package:majarra/features/auth/data/parent_pin_store.dart';
import 'package:majarra/features/child/presentation/pages/child_switcher_page.dart';
import 'package:majarra/features/downloads/application/download_providers.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/features/onboarding/application/onboarding_controller.dart';
import 'package:majarra/features/onboarding/domain/onboarding_step.dart';
import 'package:majarra/features/onboarding/presentation/pages/onboarding_flow_page.dart';
import 'package:majarra/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Minimal fake — only `fetchConsents` is exercised, since the widget-level
/// exit/return scenario below never advances past the PIN-setup step's
/// rendering (it never submits a PIN).
class _ConsentOnlyFakeApiClient extends MajarraApiClient {
  _ConsentOnlyFakeApiClient() : super(http.Client());

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
}

class _NoPinFakeParentPinStore extends ParentPinStore {
  @override
  Future<bool> hasPin({String? ownerId}) async => false;

  @override
  Future<bool> isBiometricEnabled() async => false;
}

/// Fake client for the already-onboarded-family scenario: `fetchChildren`
/// returns exactly one child carrying a non-null `onboarding_completed_at`,
/// which is what `app_router.dart`'s `familyChildrenProvider` listener reads
/// to set `AuthGuard.hasCompletedOnboarding = true`.
class _OnboardedFamilyApiClient extends MajarraApiClient {
  _OnboardedFamilyApiClient() : super(http.Client());

  @override
  Future<List<Map<String, Object?>>> fetchChildren() async => [
        {
          'id': 'existing-child-1',
          'nickname': 'سارة',
          'age_track': 'kids',
          'birth_month': 4,
          'birth_year': DateTime.now().year - 7,
          'avatar_id': 'avatar-1',
          'interests': const <String>[],
          'language': 'ar',
          // Any non-null epoch millis marks this child as having completed
          // onboarding — see `ChildProfile.fromJson`'s `epochMillis` helper.
          'onboarding_completed_at': DateTime.now()
              .subtract(const Duration(days: 3))
              .millisecondsSinceEpoch,
        },
      ];
}

class _PendingFamilyApiClient extends MajarraApiClient {
  _PendingFamilyApiClient() : super(http.Client());

  final completer = Completer<List<Map<String, Object?>>>();

  @override
  Future<List<Map<String, Object?>>> fetchChildren() => completer.future;
}

class _FailingFamilyApiClient extends MajarraApiClient {
  _FailingFamilyApiClient() : super(http.Client());

  @override
  Future<List<Map<String, Object?>>> fetchChildren() async {
    throw StateError('offline');
  }
}

class _IncompleteFamilyApiClient extends _ConsentOnlyFakeApiClient {
  @override
  Future<List<Map<String, Object?>>> fetchChildren() async => const [];
}

class _LegacyFamilyApiClient extends _ConsentOnlyFakeApiClient {
  @override
  Future<List<Map<String, Object?>>> fetchChildren() async => const [
        {
          'id': 'legacy-child-1',
          'nickname': 'نور',
          'age_track': 'kids',
          'birth_month': 5,
          'birth_year': 2018,
          'avatar_id': 'avatar-1',
          'interests': <String>[],
          'language': 'ar',
          'onboarding_completed_at': null,
        },
      ];
}

Future<void> _pumpRealRouter(
  WidgetTester tester, {
  required MajarraApiClient api,
  required AuthGuard guard,
  required SharedPreferences preferences,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        majarraApiClientProvider.overrideWithValue(api),
        authGuardProvider.overrideWithValue(guard),
        sharedPreferencesProvider.overrideWithValue(preferences),
      ],
      child: Consumer(
        builder: (context, ref, _) => MaterialApp.router(
          routerConfig: ref.watch(routerProvider),
          locale: const Locale('ar'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
        ),
      ),
    ),
  );
}

void main() {
  group('حسم التهيئة لا يخلط التحميل أو الخطأ مع أسرة جديدة', () {
    testWidgets('أثناء تحميل القائمة تظهر شاشة الأطفال لا onboarding', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);
      final api = _PendingFamilyApiClient();

      await _pumpRealRouter(
        tester,
        api: api,
        guard: guard,
        preferences: preferences,
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.byType(ChildSwitcherPage), findsOneWidget);
      expect(find.byType(OnboardingFlowPage), findsNothing);
      expect(guard.familyOnboardingStatus, FamilyOnboardingStatus.loading);

      api.completer.complete(const []);
      await tester.pumpAndSettle();
    });

    testWidgets(
      'فشل القائمة يبقى في شاشة قابلة لإعادة المحاولة ولا يفتح onboarding',
      (tester) async {
        SharedPreferences.setMockInitialValues({});
        final preferences = await SharedPreferences.getInstance();
        final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
        addTearDown(guard.dispose);

        await _pumpRealRouter(
          tester,
          api: _FailingFamilyApiClient(),
          guard: guard,
          preferences: preferences,
        );
        await tester.pumpAndSettle();

        expect(find.byType(ChildSwitcherPage), findsOneWidget);
        expect(find.byType(OnboardingFlowPage), findsNothing);
        expect(find.text('إعادة المحاولة'), findsOneWidget);
        expect(guard.familyOnboardingStatus, FamilyOnboardingStatus.error);
      },
    );

    testWidgets('الاستجابة الفارغة الناجحة وحدها تبدأ onboarding', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(900, 2000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      await _pumpRealRouter(
        tester,
        api: _IncompleteFamilyApiClient(),
        guard: guard,
        preferences: preferences,
      );
      await tester.pumpAndSettle();

      expect(find.byType(OnboardingFlowPage), findsOneWidget);
      expect(guard.familyOnboardingStatus, FamilyOnboardingStatus.incomplete);
      expect(guard.onboardingJourneyInProgress, isTrue);
    });

    testWidgets('حساب قديم لديه طفل بلا ختم onboarding لا يبدأ الرحلة مجددًا', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      await _pumpRealRouter(
        tester,
        api: _LegacyFamilyApiClient(),
        guard: guard,
        preferences: preferences,
      );
      await tester.pumpAndSettle();

      expect(find.byType(ChildSwitcherPage), findsOneWidget);
      expect(find.byType(OnboardingFlowPage), findsNothing);
      expect(guard.familyOnboardingStatus, FamilyOnboardingStatus.complete);
      expect(guard.onboardingJourneyInProgress, isFalse);
    });

    for (final staleStep in OnboardingStep.values) {
      testWidgets(
        'الحساب القديم يمسح خطوة ${staleStep.name} العالقة ولا يعيد onboarding',
        (tester) async {
          SharedPreferences.setMockInitialValues({
            onboardingStepPrefsKey: staleStep.name,
          });
          final preferences = await SharedPreferences.getInstance();
          final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
          addTearDown(guard.dispose);

          await _pumpRealRouter(
            tester,
            api: _LegacyFamilyApiClient(),
            guard: guard,
            preferences: preferences,
          );
          await tester.pumpAndSettle();

          expect(find.byType(ChildSwitcherPage), findsOneWidget);
          expect(find.byType(OnboardingFlowPage), findsNothing);
          expect(preferences.containsKey(onboardingStepPrefsKey), isFalse);
          expect(guard.familyOnboardingStatus, FamilyOnboardingStatus.complete);
          expect(guard.onboardingJourneyInProgress, isFalse);
        },
      );
    }

    testWidgets('خطوة finish المحفوظة تستمر بعد إنشاء أول طفل', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        onboardingStepPrefsKey: OnboardingStep.finish.name,
      });
      final preferences = await SharedPreferences.getInstance();
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      await _pumpRealRouter(
        tester,
        api: _OnboardedFamilyApiClient(),
        guard: guard,
        preferences: preferences,
      );
      await tester.pumpAndSettle();

      expect(find.byType(OnboardingFlowPage), findsOneWidget);
      expect(guard.familyOnboardingStatus, FamilyOnboardingStatus.complete);
      expect(guard.onboardingJourneyInProgress, isTrue);
      final l10n = lookupAppLocalizations(const Locale('ar'));
      expect(find.text(l10n.onboardingFinishTitle), findsOneWidget);
    });

    testWidgets('الخطوة المحفوظة تستأنف onboarding حتى لو كان الجلب معلقًا', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        onboardingStepPrefsKey: OnboardingStep.finish.name,
      });
      final preferences = await SharedPreferences.getInstance();
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);
      final api = _PendingFamilyApiClient();

      await _pumpRealRouter(
        tester,
        api: api,
        guard: guard,
        preferences: preferences,
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.byType(OnboardingFlowPage), findsOneWidget);
      expect(guard.onboardingJourneyInProgress, isTrue);
      final l10n = lookupAppLocalizations(const Locale('ar'));
      expect(find.text(l10n.onboardingFinishTitle), findsOneWidget);

      api.completer.complete(const []);
      await tester.pumpAndSettle();
    });
  });

  group(
    'خروج ورجوع في كل خطوة من الست (Requirement 8.3)',
    () {
      // 1
      test(
        'كل قيمة من OnboardingStep.values تُستعاد بعد بناء متحكم جديد من نفس SharedPreferences',
        () async {
          SharedPreferences.setMockInitialValues({});
          final preferences = await SharedPreferences.getInstance();

          // Exhaustive sweep — `onboarding_controller_test.dart`'s own
          // `goToStep` test only proves this for one arbitrary step
          // (`childProfile`). Looping over every declared step proves the
          // "خروج ورجوع في كل خطوة" requirement literally, for all six
          // values, not just one.
          for (final step in OnboardingStep.values) {
            final controller = OnboardingController(preferences);
            controller.goToStep(step);
            expect(controller.state.currentStep, step);

            // "الخروج والرجوع": a brand new controller instance, standing in
            // for the app being relaunched, built against the exact same
            // SharedPreferences instance/data.
            final resumed = OnboardingController(preferences);
            expect(
              resumed.state.currentStep,
              step,
              reason:
                  'الخطوة ${step.name} لم تُسترجع بشكل صحيح بعد إعادة بناء '
                  'المتحكم — خلل في استرجاع الموضع (Requirement 8.3)',
            );
          }
        },
      );

      testWidgets(
        'إغلاق التطبيق منتصف الرحلة (بعد الموافقات) وإعادة فتحه يستأنف OnboardingFlowPage من نفس الخطوة',
        (tester) async {
          // ConsentPage renders inside a ListView; the default test surface
          // is too short for its continue button to be reachable, matching
          // the same workaround `onboarding_flow_page_test.dart` uses.
          await tester.binding.setSurfaceSize(const Size(900, 2000));
          addTearDown(() => tester.binding.setSurfaceSize(null));

          SharedPreferences.setMockInitialValues({});
          final preferences = await SharedPreferences.getInstance();

          // Pumps a completely fresh `OnboardingFlowPage` widget tree behind
          // its own `ProviderScope`/`GoRouter`, sharing only the
          // `SharedPreferences` *instance* with any prior pump — this is
          // what actually distinguishes "the app reopened" from merely
          // re-reading the same controller object.
          Future<void> pumpFreshOnboardingFlow() async {
            final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
            addTearDown(guard.dispose);
            final router = GoRouter(
              initialLocation: '/onboarding',
              routes: [
                GoRoute(
                  path: '/onboarding',
                  builder: (_, __) => const OnboardingFlowPage(),
                ),
                GoRoute(
                  path: '/',
                  builder: (_, __) => const Scaffold(body: Text('home')),
                ),
              ],
            );
            addTearDown(router.dispose);

            await tester.pumpWidget(
              ProviderScope(
                overrides: [
                  majarraApiClientProvider.overrideWithValue(_ConsentOnlyFakeApiClient()),
                  parentPinStoreProvider.overrideWithValue(_NoPinFakeParentPinStore()),
                  authGuardProvider.overrideWithValue(guard),
                  sharedPreferencesProvider.overrideWithValue(preferences),
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
          }

          final l10n = lookupAppLocalizations(const Locale('ar'));

          // First launch: lands on consent, advances to PIN setup.
          await pumpFreshOnboardingFlow();
          expect(find.text(l10n.consentPageTitle), findsOneWidget);
          final continueFinder = find.text(l10n.consentContinueButton);
          await tester.scrollUntilVisible(continueFinder, 200);
          await tester.pumpAndSettle();
          await tester.tap(continueFinder);
          await tester.pumpAndSettle();
          expect(find.text(l10n.createParentPin), findsOneWidget);

          // Simulate the app being closed: unmount the entire widget tree
          // (and, with it, the `ProviderScope`/`OnboardingController`
          // instance the first launch was using).
          await tester.pumpWidget(const SizedBox());
          await tester.pumpAndSettle();

          // Simulate reopening the app: a brand new widget tree, brand new
          // `ProviderScope`, brand new `OnboardingController` — but the
          // exact same `SharedPreferences` instance/data as before.
          await pumpFreshOnboardingFlow();

          expect(
            find.text(l10n.createParentPin),
            findsOneWidget,
            reason: 'يجب استئناف الرحلة من خطوة إعداد PIN لا البدء من الموافقات',
          );
          expect(find.text(l10n.consentPageTitle), findsNothing);
        },
      );
    },
  );

  group(
    'حساب أكمل الرحلة سابقًا يتجاوز /onboarding كليًا (Requirement 8.5)',
    () {
      /// ## هذا الاختبار وثّق خللًا كان موجودًا فعليًا في الإنتاج — وقد أُصلح
      ///
      /// أثناء كتابة هذا الاختبار ضد `routerProvider`/`_guardRedirect`
      /// الحقيقيين اكتُشف أن العائلة التي أكملت onboarding سابقًا **كانت قد
      /// تعلق على `/onboarding`** بعد الإقلاع البارد، بدلاً من الانتقال إلى
      /// `/children` كما تتطلب Requirement 8.5. السبب الجذري (لا يزال
      /// موصّفًا هنا كسجل تاريخي مفيد):
      ///
      /// 1. عند الإقلاع، الموجّه يبدأ من `/` (`RouteAccess.childSession`).
      ///    `AuthGuard.hasChild == false` و `hasCompletedOnboarding` لا تزال
      ///    `false` افتراضيًا لأن `familyChildrenProvider` (`FutureProvider`)
      ///    لم يُحسم بعد. `_guardRedirect` يُعيد التوجيه فورًا ومتزامنًا إلى
      ///    `/onboarding` بناءً على هذه القيم الافتراضية.
      /// 2. بعد ذلك يُحسم `familyChildrenProvider`، والمستمع في
      ///    `routerProvider` يستدعي `guard.setHasCompletedOnboarding(true)`،
      ///    الذي يستدعي `notifyListeners()` فيُعيد GoRouter تشغيل `redirect`.
      ///    لكن الموقع المطابَق الآن هو `/onboarding` نفسه، و
      ///    `accessFor('/onboarding') == RouteAccess.authenticatedFamily` —
      ///    وهذا التصنيف لا يملك أي فرع في `_guardRedirect` يعيد التوجيه
      ///    بعيدًا عنه بناءً على `hasChild`/`hasCompletedOnboarding` (تلك
      ///    الفروع موجودة فقط لمسارات `childSession` ومجموعة `authEntry`).
      /// 3. النتيجة: `OnboardingFlowPage` يبقى معروضًا نهائيًا مع أن
      ///    `AuthGuard` يعرف الآن بشكل صحيح أن العائلة أكملت onboarding —
      ///    وهو تمامًا السيناريو الذي تمنعه Requirement 8.5.
      ///
      /// تم الإصلاح: أضيف فرع صريح في `_guardRedirect` يعيد تقييم الموقع
      /// `/onboarding` نفسه متى ما أصبح `guard.hasCompletedOnboarding ==
      /// true`، فيعيد التوجيه إلى `/` إذا كان هناك طفل نشط أو إلى
      /// `/children` بخلاف ذلك — بنفس منطق فرع `RouteAccess.childSession`
      /// المطابق تمامًا. هذا الاختبار أصبح الآن اختبار انحدار يثبت أن الخلل
      /// لن يعود.
      testWidgets(
        'عبر routerProvider الحقيقي: عائلة أكمل أحد أطفالها onboarding تفتح على ChildSwitcherPage دون أي عرض لـ OnboardingFlowPage',
        (tester) async {
          SharedPreferences.setMockInitialValues({});
          final preferences = await SharedPreferences.getInstance();
          final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
          addTearDown(guard.dispose);

          // Builds against the REAL `routerProvider`/`_guardRedirect` in
          // `app_router.dart` — not a local reimplementation of the redirect
          // condition — by reading the public `routerProvider` through a
          // `Consumer` inside `MaterialApp.router`. `route_guard_matrix_test.
          // dart` already covers the redirect boolean logic in isolation;
          // this proves the shipped router itself never routes an
          // already-onboarded family through `/onboarding`, end to end.
          await tester.pumpWidget(
            ProviderScope(
              overrides: [
                majarraApiClientProvider.overrideWithValue(_OnboardedFamilyApiClient()),
                authGuardProvider.overrideWithValue(guard),
                sharedPreferencesProvider.overrideWithValue(preferences),
              ],
              child: Consumer(
                builder: (context, ref, _) => MaterialApp.router(
                  routerConfig: ref.watch(routerProvider),
                  locale: const Locale('ar'),
                  localizationsDelegates: AppLocalizations.localizationsDelegates,
                  supportedLocales: AppLocalizations.supportedLocales,
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();

          expect(
            find.byType(OnboardingFlowPage),
            findsNothing,
            reason:
                'عائلة أكمل أحد أطفالها onboarding يجب ألا تصل إلى /onboarding مطلقًا',
          );
          expect(find.byType(ChildSwitcherPage), findsOneWidget);
        },
      );
    },
  );
}
