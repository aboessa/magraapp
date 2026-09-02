library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/presentation/pages/coloring/coloring_home_v2.dart';
import 'package:majarra/features/games/presentation/pages/studio_v2/category_inside_coloring_page.dart';

void main() {
  const items = <FeaturedColoringSpec>[
    FeaturedColoringSpec(
      id: 'easy-young',
      label: 'عصفور صغير',
      isNew: true,
      ageMin: 3,
      ageMax: 5,
      difficulty: 'easy',
    ),
    FeaturedColoringSpec(
      id: 'medium-school',
      label: 'قطة مستكشفة',
      isNew: false,
      ageMin: 6,
      ageMax: 8,
      difficulty: 'متوسط',
    ),
    FeaturedColoringSpec(
      id: 'hard-older',
      label: 'صاروخ فضائي',
      isNew: false,
      ageMin: 9,
      ageMax: 12,
      difficulty: 'hard',
    ),
  ];

  Widget host() => const MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: CategoryInsideColoringPage(title: 'اختبار الفلاتر', items: items),
        ),
      );

  testWidgets('category filters use real age ranges and difficulty metadata', (
    tester,
  ) async {
    await tester.pumpWidget(host());
    await tester.pumpAndSettle();

    expect(find.text('عصفور صغير'), findsOneWidget);
    expect(find.text('قطة مستكشفة'), findsOneWidget);
    expect(find.text('صاروخ فضائي'), findsOneWidget);

    await tester.tap(find.text('3-5'));
    await tester.pumpAndSettle();

    expect(find.text('عصفور صغير'), findsOneWidget);
    expect(find.text('قطة مستكشفة'), findsNothing);
    expect(find.text('صاروخ فضائي'), findsNothing);

    await tester.tap(find.text('9-12'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('صعب'));
    await tester.tap(find.text('صعب'));
    await tester.pumpAndSettle();

    expect(find.text('عصفور صغير'), findsNothing);
    expect(find.text('قطة مستكشفة'), findsNothing);
    expect(find.text('صاروخ فضائي'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
