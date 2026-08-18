import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/domain/content_models.dart';
import 'package:majarra/features/search/presentation/search_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

HomeCatalog _catalog() => const HomeCatalog(
  planets: [],
  spotlights: [],
  series: [
    SeriesItem(
      id: 's1',
      title: 'مغامرات الأرقام',
      description: 'سلسلة تعليمية',
      planetName: 'كوكب الأرقام',
      posterAsset: 'a',
      bannerAsset: 'b',
      ageMin: 6,
      ageMax: 8,
      episodesCount: 4,
      type: 'series',
      isFree: true,
    ),
  ],
  episodes: [],
  experiences: [],
  books: [],
  source: ContentSource.bundled,
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Widget host() => ProviderScope(
    child: MaterialApp(
      home: Directionality(
        textDirection: TextDirection.rtl,
        // SearchPage is normally hosted inside a shell Scaffold; provide one
        // so its TextField/Chips find a Material ancestor.
        child: Scaffold(
          body: SearchPage(catalog: _catalog(), isTelevision: false),
        ),
      ),
    ),
  );

  testWidgets('idle state prompts suggestions, then a query shows real results', (
    tester,
  ) async {
    await tester.pumpWidget(host());
    await tester.pump();

    // Idle: the "try searching for" prompt is visible, no result tiles.
    expect(find.text('جرّب البحث عن'), findsOneWidget);

    // Type a normalised query (missing the alef-lam and using a bare alef).
    await tester.enterText(find.byType(TextField), 'الارقام');
    await tester.pump();

    // The series is found by Arabic-normalized matching and grouped under مسلسلات.
    expect(find.text('مغامرات الأرقام'), findsOneWidget);
    expect(find.textContaining('مسلسلات'), findsOneWidget);
  });

  testWidgets('a non-matching query shows the honest empty state', (
    tester,
  ) async {
    await tester.pumpWidget(host());
    await tester.pump();

    await tester.enterText(find.byType(TextField), 'زخرفة اسلامية');
    await tester.pump();

    expect(find.textContaining('لا نتائج'), findsOneWidget);
  });
}
