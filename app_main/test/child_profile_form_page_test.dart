/// Widget tests for `ChildProfileFormPage` covering Requirement 10.8: the
/// birth-date boundary ages 3/5/6/8/9/12 must be reachable and their
/// rejection counterparts (2 and 13) must be structurally unreachable, and
/// the saved state must actually carry `interests` and `language` through to
/// `MajarraApiClient.createChild`.
///
/// The year dropdown (`_selectableYears` in `child_profile_form_page.dart`)
/// only ever offers `now.year - 12 .. now.year - 3`. There is no year option
/// for age 2 or age 13 in the UI at all, so "reject age 2/13" is enforced at
/// this layer by construction rather than by a runtime validation message —
/// the server-side rejection for those ages is already covered by
/// `dashboard/api/test/familyState.test.mjs` (task 20). This file proves the
/// UI-layer half of that guarantee: the dropdown's offered items are exactly
/// the 10 years for ages 3-12, and each of those boundary ages actually
/// round-trips to `createChild` with the matching `birthYear`.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/features/child/presentation/pages/child_profile_form_page.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/l10n/app_localizations.dart';

/// Captures the arguments `ChildProfileFormPage` passes to `createChild`
/// instead of making a real network call, following the `_FakeApiClient`
/// pattern in `logout_tile_test.dart`.
class _FakeApiClient extends MajarraApiClient {
  _FakeApiClient() : super(http.Client());

  Map<String, Object?>? lastCreateChildArgs;

  @override
  Future<List<Map<String, Object?>>> fetchChildren() async => const [];

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
    lastCreateChildArgs = {
      'nickname': nickname,
      'birthMonth': birthMonth,
      'birthYear': birthYear,
      'avatarId': avatarId,
      'language': language,
      'interests': interests,
    };
    return {'data': {'id': 'new-child-1'}};
  }
}

void main() {
  late _FakeApiClient api;

  /// Pumps `ChildProfileFormPage` in create mode inside a real `Navigator`
  /// (two routes deep) so `context.pop(true)` on submit succeeds instead of
  /// throwing, and with real `AppLocalizations` delegates so interest chip
  /// and language labels render as actual localized text.
  Future<void> pumpCreateForm(WidgetTester tester) async {
    api = _FakeApiClient();

    // The form is a long scroll with several sections (avatar picker,
    // interests, language panel). The default test surface is too narrow and
    // too short for all of it to lay out without overflowing, which is what
    // broke the first version of this test — a tall, wide surface mirrors
    // the pattern already used in `logout_tile_test.dart`.
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [majarraApiClientProvider.overrideWithValue(api)],
        child: MaterialApp(
          locale: const Locale('ar'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Navigator(
            pages: const [
              MaterialPage(child: Scaffold(body: SizedBox())),
              MaterialPage(child: ChildProfileFormPage()),
            ],
            onDidRemovePage: (page) {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// The exact years the widget's own `_selectableYears` computes for ages
  /// 3 through 12 — the source of truth this test asserts against, kept in
  /// the test rather than duplicating a hardcoded year list that would drift
  /// from the real current year.
  List<int> selectableYearsForAges3to12() =>
      [for (var age = 3; age <= 12; age++) DateTime.now().year - age];

  int yearForAge(int age) => DateTime.now().year - age;

  Future<void> selectBirthYear(WidgetTester tester, int year) async {
    final dropdownFinder = find.byKey(const Key('birthYearDropdown'));
    expect(dropdownFinder, findsOneWidget);
    await tester.tap(dropdownFinder);
    await tester.pumpAndSettle();

    // The open dropdown menu renders one `Text('$year')` entry per item, plus
    // the currently-selected value's mirror in the closed field underneath;
    // scoping to the last (topmost, freshly opened) match keeps this stable.
    final optionFinder = find.text('$year').last;
    await tester.tap(optionFinder);
    await tester.pumpAndSettle();
  }

  Future<void> fillNickname(WidgetTester tester, String name) async {
    await tester.enterText(find.byType(TextField), name);
    await tester.pumpAndSettle();
  }

  Future<void> tapSave(WidgetTester tester) async {
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
  }

  group('حدود تاريخ الميلاد (Requirement 10.8)', () {
    testWidgets(
      'قائمة سنوات الميلاد تعرض فقط أعمار 3 إلى 12 — عمرا 2 و13 غير قابلين للاختيار بنيويًا',
      (tester) async {
        await pumpCreateForm(tester);

        final dropdownFinder = find.byKey(const Key('birthYearDropdown'));
        await tester.tap(dropdownFinder);
        await tester.pumpAndSettle();

        final expectedYears = selectableYearsForAges3to12();
        for (final year in expectedYears) {
          expect(
            find.text('$year'),
            findsWidgets,
            reason: 'سنة العمر $year (بين 3 و12) يجب أن تكون معروضة',
          );
        }

        // Age 2's and age 13's years must not appear anywhere in the menu.
        final age2Year = yearForAge(2);
        final age13Year = yearForAge(13);
        expect(
          find.text('$age2Year'),
          findsNothing,
          reason: 'عمر 2 يجب أن يكون غير قابل للاختيار من القائمة أصلًا',
        );
        expect(
          find.text('$age13Year'),
          findsNothing,
          reason: 'عمر 13 يجب أن يكون غير قابل للاختيار من القائمة أصلًا',
        );

        // Close the menu so later pumps in other tests don't see it open.
        await tester.tapAt(const Offset(5, 5));
        await tester.pumpAndSettle();
      },
    );

    for (final age in [3, 5, 6, 8, 9, 12]) {
      testWidgets(
        'اختيار سنة عمر $age يُحفظ فعليًا في birthYear المُرسَل عند الحفظ',
        (tester) async {
          await pumpCreateForm(tester);

          final year = yearForAge(age);
          await selectBirthYear(tester, year);
          await fillNickname(tester, 'طفل تجريبي');
          await tapSave(tester);

          expect(
            api.lastCreateChildArgs,
            isNotNull,
            reason: 'يجب أن يستدعي الحفظ createChild فعليًا',
          );
          expect(api.lastCreateChildArgs!['birthYear'], year);
        },
      );
    }
  });

  group('الاهتمامات تظهر في حالة الحفظ', () {
    testWidgets('اختيار اهتمامين يُرسلهما بالضبط عند الحفظ', (tester) async {
      await pumpCreateForm(tester);

      final l10n = lookupAppLocalizations(const Locale('ar'));

      await tester.tap(find.text(l10n.interestAbjad));
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.interestQisas));
      await tester.pumpAndSettle();

      await fillNickname(tester, 'طفل تجريبي');
      await tapSave(tester);

      expect(api.lastCreateChildArgs, isNotNull);
      final interests =
          (api.lastCreateChildArgs!['interests'] as List).cast<String>();
      expect(interests, containsAll(<String>['abjad', 'qisas']));
      expect(interests.length, 2);
    });
  });

  group('اللغة تظهر بحالة قراءة فقط في الحفظ', () {
    testWidgets(
      'لوحة اللغة تعرض النص العربي المُوطَّن، وlanguage المُرسَل يساوي ar',
      (tester) async {
        await pumpCreateForm(tester);

        final l10n = lookupAppLocalizations(const Locale('ar'));
        expect(find.text(l10n.languageValueArabic), findsOneWidget);

        await fillNickname(tester, 'طفل تجريبي');
        await tapSave(tester);

        expect(api.lastCreateChildArgs, isNotNull);
        expect(api.lastCreateChildArgs!['language'], 'ar');
      },
    );
  });
}
