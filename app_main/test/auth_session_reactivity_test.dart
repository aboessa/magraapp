/// اختبارات انحدار لعلّتين ظهرتا في التشغيل الحقيقي ولا يراهما المحلِّل ولا أيّ
/// اختبار قائم، لأن كلتيهما **سلوك زمني** لا خطأ نوعي:
///
/// 1. «من يشاهد الآن؟» تبقى فارغة بعد نجاح الدخول رغم أن الخادم يُعيد الأطفال.
/// 2. حلقة `POST /api/v1/family/parent-pin 403` لا تنتهي عند إنشاء رمز والد.
///
/// ولماذا ملف جديد لا إضافة إلى القائم: `pin_setup_unlock_pages_smoke_test.dart`
/// يبني الصفحتين مباشرةً بلا مُوجِّه، فلا يستطيع إثبات ما يقرّره `_PinGatePage`
/// من `stage`؛ و`onboarding_journey_integration_test.dart` يبني المُوجِّه الحقيقي
/// لكنه يفحص وجهة عائلةٍ أكملت التهيئة لا **إعادة الجلب بعد تغيّر الجلسة**.
/// وكلتا العلّتين تخصّان الترابط بين `AuthGuard` والمزوّدين، فمكانهما معًا.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/app/router/app_router.dart';
import 'package:majarra/app/router/auth_guard.dart';
import 'package:majarra/features/auth/data/parent_pin_store.dart';
import 'package:majarra/features/auth/presentation/pages/pin_setup_page.dart';
import 'package:majarra/features/auth/presentation/pages/pin_unlock_page.dart';
import 'package:majarra/features/child/application/family_children_provider.dart';
import 'package:majarra/features/downloads/application/download_providers.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// يعُدّ نداءات `fetchChildren` كي يُثبَت أن المزوّد **أعاد** الجلب فعلًا لا أن
/// نتيجةً مخزَّنة تغيّرت بالمصادفة.
class _CountingChildrenApiClient extends MajarraApiClient {
  _CountingChildrenApiClient() : super(http.Client());

  int fetchCount = 0;

  @override
  Future<List<Map<String, Object?>>> fetchChildren() async {
    fetchCount++;
    return [
      {
        'id': 'child-layla',
        'nickname': 'ليلى',
        'age_track': 'kids',
        'birth_month': 3,
        'birth_year': DateTime.now().year - 8,
        'avatar_id': 'avatar-1',
        'interests': const <String>[],
        'language': 'ar',
        'onboarding_completed_at': null,
      },
      {
        'id': 'child-ahmed',
        'nickname': 'أحمد',
        'age_track': 'preschool',
        'birth_month': 7,
        'birth_year': DateTime.now().year - 5,
        'avatar_id': 'avatar-2',
        'interests': const <String>[],
        'language': 'ar',
        'onboarding_completed_at': null,
      },
    ];
  }
}

/// المخزن المحلي يُصرّ على «لا يوجد رمز» — وهو بالضبط الاستدلال الذي كذّبه
/// الخادم بـ403 في الحالة الحقيقية (متصفّح جديد، مخزن آمن فارغ، والأسرة
/// لديها رمز مُسجَّل على الخادم فعلًا).
class _NoPinLocalStore extends ParentPinStore {
  @override
  Future<bool> hasPin({String? ownerId}) async => false;

  @override
  Future<bool> isBiometricEnabled() async => false;
}

/// والمخزن هنا يُصرّ على العكس: «يوجد رمز» — نظير 404 القادم من الخادم.
class _HasPinLocalStore extends ParentPinStore {
  @override
  Future<bool> hasPin({String? ownerId}) async => true;

  @override
  Future<bool> isBiometricEnabled() async => false;
}

class _NoopApiClient extends MajarraApiClient {
  _NoopApiClient() : super(http.Client());

  @override
  Future<List<Map<String, Object?>>> fetchChildren() async => const [];
}

void main() {
  group('familyChildrenProvider يتفاعل مع تغيّر الجلسة', () {
    /// ## العلّة
    ///
    /// `authGuardProvider` هو `Provider<AuthGuard>` يُعيد `ChangeNotifier`
    /// **ثابت الهوية**: نفس الكائن مدى عمر التطبيق. و`ref.watch` في riverpod 2
    /// يُعيد الحساب عند تغيّر **القيمة** لا عند `notifyListeners`. فكان
    /// `familyChildrenProvider` يُحسب مرّة واحدة — عند أوّل قراءة، والحال أن
    /// `isLoading == true` — فيُخزَّن `const []` ولا يُعاد جلبه أبدًا بعد نجاح
    /// الدخول. ولذلك بقيت «من يشاهد الآن؟» فارغة، وبقي
    /// `hasCompletedOnboarding == false` لأن مُستمِع المُوجِّه لم يرَ سوى
    /// القائمة الفارغة المخزَّنة.
    ///
    /// والاختبار يفشل حتمًا قبل الإصلاح: `fetchCount` يظل صفرًا.
    test('يُعيد الجلب بعد setAuthenticated بدل تخزين قائمة فارغة للأبد', () async {
      final guard = AuthGuard();
      addTearDown(guard.dispose);
      final api = _CountingChildrenApiClient();

      final container = ProviderContainer(
        overrides: [
          authGuardProvider.overrideWithValue(guard),
          majarraApiClientProvider.overrideWithValue(api),
        ],
      );
      addTearDown(container.dispose);

      // اشتراك حقيقي: بلا مُستمِع يتخلّص riverpod من المزوّد فورًا فلا يبقى
      // ما يُخزَّن ولا يظهر الخلل أصلًا — وهذا ما يجعل الاشتراك جزءًا من
      // إعادة إنتاج العلّة لا تفصيلًا في كتابة الاختبار.
      final sub = container.listen(familyChildrenProvider, (_, _) {});
      addTearDown(sub.close);

      // الحال الأولى: `isLoading == true`، فلا يُلمَس الخادم.
      final before = await container.read(familyChildrenProvider.future);
      expect(before, isEmpty);
      expect(api.fetchCount, 0, reason: 'لا يُستدعى الخادم قبل وجود جلسة');

      guard.setAuthenticated(true, parentId: 'p1');
      // `_scheduleNotify` يؤجّل الإخطار خارج طور البناء، فيلزم تفريغ الحلقة.
      await Future<void>.delayed(Duration.zero);

      final after = await container.read(familyChildrenProvider.future);
      expect(
        api.fetchCount,
        1,
        reason: 'تغيّر الجلسة يجب أن يُبطل النتيجة المخزَّنة ويُعيد الجلب',
      );
      expect(after.map((c) => c.nickname), ['ليلى', 'أحمد']);
    });

    /// ولا يكفي أن يُعاد الحساب: لو أُعيد عند **كل** إخطار لصار كل ضغط زرّ في
    /// منطقة وليّ الأمر (`grantParentAccess`) طلبًا جديدًا على الشبكة. ومفتاح
    /// الجلسة يقرأ حقول الهوية وحدها، فالإخطارات التي لا تُغيّرها لا تُبطل شيئًا.
    test('لا يُعيد الجلب عند إخطارات لا تُغيّر هوية الجلسة', () async {
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);
      final api = _CountingChildrenApiClient();

      final container = ProviderContainer(
        overrides: [
          authGuardProvider.overrideWithValue(guard),
          majarraApiClientProvider.overrideWithValue(api),
        ],
      );
      addTearDown(container.dispose);
      final sub = container.listen(familyChildrenProvider, (_, _) {});
      addTearDown(sub.close);

      await container.read(familyChildrenProvider.future);
      expect(api.fetchCount, 1);

      guard.setHasChild(true);
      await Future<void>.delayed(Duration.zero);
      await container.read(familyChildrenProvider.future);

      expect(
        api.fetchCount,
        1,
        reason: 'setHasChild لا يُغيّر الهوية، فلا داعي لطلب شبكة جديد',
      );
    });
  });

  group('مُوزِّع /parent-pin يقدّم جواب الخادم على الاستدلال المحلي', () {
    Future<void> pumpAt(WidgetTester tester, String location) async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authGuardProvider.overrideWithValue(guard),
            majarraApiClientProvider.overrideWithValue(_NoopApiClient()),
            sharedPreferencesProvider.overrideWithValue(preferences),
            // المخزن المحلي يقول «لا يوجد رمز» في كل حالات هذه المجموعة، كي
            // يكون أيّ اختلاف في النتيجة عائدًا إلى `stage` وحده.
            parentPinStoreProvider.overrideWithValue(_NoPinLocalStore()),
          ],
          child: Consumer(
            builder: (context, ref, _) {
              final router = ref.watch(routerProvider);
              // الانتقال بعد أوّل إطار: `initialLocation` مقفول على `/` في
              // `routerProvider`، والمقصود هنا فحص المُوزِّع لا تهيئته.
              WidgetsBinding.instance.addPostFrameCallback(
                (_) => router.go(location),
              );
              return MaterialApp.router(
                routerConfig: router,
                locale: const Locale('ar'),
                localizationsDelegates: AppLocalizations.localizationsDelegates,
                supportedLocales: AppLocalizations.supportedLocales,
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    /// ## العلّة
    ///
    /// كان «التطبيب الذاتي» في `PinSetupPage` يعود إلى `/parent-pin` **بلا أي
    /// معلومة جديدة**، فيُعيد `_PinGatePage` سؤال `ParentPinStore.hasPin()` —
    /// وهو المصدر الذي أخطأ للتوّ — فيُبنى `PinSetupPage` مرّة أخرى، ويُرسَل
    /// الطلب مرّة أخرى، ويُعاد 403 مرّة أخرى. حلقة مفرغة لا «رحلة ذهابٍ واحدة
    /// زائدة» كما كان التعليق يقول.
    testWidgets('stage=unlock يعرض شاشة الإدخال ولو قال المخزن المحلي «لا رمز»', (
      tester,
    ) async {
      await pumpAt(tester, '/parent-pin?stage=unlock');

      expect(find.byType(PinUnlockPage), findsOneWidget);
      expect(
        find.byType(PinSetupPage),
        findsNothing,
        reason: 'إعادة بناء شاشة الإنشاء هي عين الحلقة التي أُصلحت',
      );
    });

    testWidgets('stage=setup يعرض شاشة الإنشاء ولو قال المخزن المحلي «يوجد رمز»', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authGuardProvider.overrideWithValue(guard),
            majarraApiClientProvider.overrideWithValue(_NoopApiClient()),
            sharedPreferencesProvider.overrideWithValue(preferences),
            parentPinStoreProvider.overrideWithValue(_HasPinLocalStore()),
          ],
          child: Consumer(
            builder: (context, ref, _) {
              final router = ref.watch(routerProvider);
              WidgetsBinding.instance.addPostFrameCallback(
                (_) => router.go('/parent-pin?stage=setup'),
              );
              return MaterialApp.router(
                routerConfig: router,
                locale: const Locale('ar'),
                localizationsDelegates: AppLocalizations.localizationsDelegates,
                supportedLocales: AppLocalizations.supportedLocales,
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(PinSetupPage), findsOneWidget);
      expect(find.byType(PinUnlockPage), findsNothing);
    });

    /// وبلا `stage` يبقى السلوك القديم كما هو: الدخول الأوّل لا يملك جواب خادم
    /// بعد، فالاستدلال المحلي هو كل ما في اليد.
    testWidgets('بلا stage يُستشار المخزن المحلي كما كان', (tester) async {
      await pumpAt(tester, '/parent-pin');

      expect(find.byType(PinSetupPage), findsOneWidget);
    });
  });
}
