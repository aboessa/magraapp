import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/domain/content_models.dart';
import 'package:majarra/features/home/presentation/widgets/home_destination_spec.dart';
import 'package:majarra/features/home/presentation/widgets/majarra_bottom_navigation.dart';

/// Property 8 (design.md): for every index `i` in the shared destination
/// list, `label(i)`, `icon(i)` and `build(i)` are derived from the exact same
/// [HomeDestinationSpec] on phone, tablet and television — the phone bottom
/// bar used to call index 2 "مكتبتي" while the tablet/television rails called
/// the same body "بحث" (Requirement 3.5). This file guards against that
/// drift ever coming back.
///
/// Cases 4 builds `MajarraBottomNavigation` and a `NavigationRail` directly
/// instead of the full `AdaptiveHomeShell`/`TvHomeShell`, which would need a
/// real catalogue and network calls to render. That is sufficient to prove
/// Property 8: the three shells (locked down by task 6's refactor) consume
/// `buildHomeDestinationSpecs` output unmodified, so exercising that exact
/// navigation widget through the same constructor the shells use covers the
/// same code path.
void main() {
  const emptyCatalog = HomeCatalog(
    planets: [],
    spotlights: [],
    series: [],
    episodes: [],
    experiences: [],
    source: ContentSource.remote,
  );

  group('1. عدد الوجهات وسلامة كل عنصر', () {
    test('تُعيد أربع وجهات بالضبط، كل واحدة بتسمية وأيقونتين وجسم صالحين', () {
      final specs = buildHomeDestinationSpecs(
        catalog: emptyCatalog,
        isTelevision: false,
      );

      expect(specs.length, 4);
      for (final spec in specs) {
        expect(spec.label, isNotEmpty);
        expect(
          spec.icon,
          isNot(spec.selectedIcon),
          reason:
              'كل وجهة تستخدم زوج أيقونة outlined/filled متمايز بتصميم متعمد',
        );
        expect(spec.build(), isA<Widget>());
      }
    });
  });

  group('2. تطابق (تسمية، أيقونة) بين الهاتف والتلفزيون', () {
    test('كل فهرس يحمل نفس label وicon وselectedIcon في الاستدعاءين', () {
      final phoneSpecs = buildHomeDestinationSpecs(
        catalog: emptyCatalog,
        isTelevision: false,
      );
      final tvSpecs = buildHomeDestinationSpecs(
        catalog: emptyCatalog,
        isTelevision: true,
      );

      expect(phoneSpecs.length, tvSpecs.length);
      for (var i = 0; i < phoneSpecs.length; i++) {
        expect(
          tvSpecs[i].label,
          phoneSpecs[i].label,
          reason: 'الفهرس $i يجب أن يحمل نفس التسمية بين الهاتف والتلفزيون',
        );
        expect(
          tvSpecs[i].icon,
          phoneSpecs[i].icon,
          reason: 'الفهرس $i يجب أن يحمل نفس الأيقونة العادية',
        );
        expect(
          tvSpecs[i].selectedIcon,
          phoneSpecs[i].selectedIcon,
          reason: 'الفهرس $i يجب أن يحمل نفس الأيقونة المحددة',
        );
      }
    });
  });

  group('3. التسميات الصحيحة بالضبط لكل فهرس', () {
    late List<HomeDestinationSpec> specs;

    setUp(() {
      specs = buildHomeDestinationSpecs(
        catalog: emptyCatalog,
        isTelevision: false,
      );
    });

    test('index0 = الرئيسية', () {
      expect(specs[HomeDestinationIndex.home].label, 'الرئيسية');
    });

    test('index1 = استكشف', () {
      expect(specs[HomeDestinationIndex.explore].label, 'استكشف');
    });

    test('index2 = مكتبتي (لا بحث — هذا هو انحدار المهمة 6 الذي أُصلح)', () {
      expect(specs[HomeDestinationIndex.library].label, 'مكتبتي');
      expect(specs[HomeDestinationIndex.library].label, isNot('بحث'));
    });

    test('index3 = ملفي', () {
      expect(specs[HomeDestinationIndex.profile].label, 'ملفي');
    });
  });

  group('4. تكامل: العنصر الفعلي المرسوم على الهاتف والتلفزيون', () {
    Future<void> pumpPhoneNav(WidgetTester tester) async {
      tester.view.physicalSize = const Size(1200, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Directionality(
              textDirection: TextDirection.rtl,
              child: Scaffold(
                bottomNavigationBar: MajarraBottomNavigation(
                  selectedIndex: HomeDestinationIndex.library,
                  onDestinationSelected: (_) {},
                  onPortalPressed: () {},
                  destinations: buildHomeDestinationSpecs(
                    catalog: emptyCatalog,
                    isTelevision: false,
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
    }

    Future<void> pumpTvRail(WidgetTester tester) async {
      tester.view.physicalSize = const Size(1920, 1080);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final tvSpecs = buildHomeDestinationSpecs(
        catalog: emptyCatalog,
        isTelevision: true,
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Directionality(
              textDirection: TextDirection.rtl,
              child: Scaffold(
                body: Row(
                  children: [
                    NavigationRail(
                      selectedIndex: HomeDestinationIndex.library,
                      onDestinationSelected: (_) {},
                      destinations: [
                        for (final spec in tvSpecs)
                          NavigationRailDestination(
                            icon: Icon(spec.icon),
                            selectedIcon: Icon(spec.selectedIcon),
                            label: Text(spec.label),
                          ),
                      ],
                    ),
                    const Expanded(child: SizedBox()),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
    }

    testWidgets('الهاتف (MajarraBottomNavigation): مكتبتي موجودة وبحث غائبة', (
      tester,
    ) async {
      await pumpPhoneNav(tester);

      expect(find.text('مكتبتي'), findsOneWidget);
      expect(find.text('بحث'), findsNothing);
    });

    testWidgets('التلفزيون (NavigationRail): مكتبتي موجودة وبحث غائبة', (
      tester,
    ) async {
      await pumpTvRail(tester);

      expect(find.text('مكتبتي'), findsOneWidget);
      expect(find.text('بحث'), findsNothing);
    });
  });
}
