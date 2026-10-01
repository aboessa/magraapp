import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/domain/content_models.dart';
import 'package:majarra/features/home/presentation/widgets/majarra_portal.dart';

void main() {
  testWidgets(
    'showMajarraPortal renders cleanly without overflow on small mobile screens',
    (tester) async {
      // Set screen size to a standard compact mobile phone: 360 x 640
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final testCatalog = HomeCatalog(
        spotlights: const [],
        series: const [
          SeriesItem(
            id: 'series-1',
            title: 'مغامرات الفضاء الطويلة جدًا',
            description: 'وصف السلسلة',
            planetName: 'كوكب الألوان',
            planetId: 'planet-1',
            posterAsset: 'assets/test.jpg',
            bannerAsset: 'assets/test.jpg',
            ageMin: 4,
            ageMax: 8,
            episodesCount: 10,
            type: 'animation',
            isFree: true,
          ),
        ],
        experiences: const [],
        episodes: const [],
        books: const [],
        stories: const [],
        planets: const [
          Planet(
            id: 'planet-1',
            name: 'كوكب الألوان',
            description: 'عالم الرسم والإبداع',
            colorHex: '#FF5722',
            imageAsset: 'assets/planets/test.png',
          ),
        ],
        source: ContentSource.remote,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) {
                return ElevatedButton(
                  onPressed: () {
                    showMajarraPortal(
                      context,
                      catalog: testCatalog,
                      onExplore: () {},
                      onOpenLibrary: () {},
                      onOpenProfile: () {},
                      onOpenReading: () {},
                      onOpenListening: () {},
                      onOpenSeries: (_) {},
                      onOpenGame: (_) {},
                    );
                  },
                  child: const Text('Open Portal'),
                );
              },
            ),
          ),
        ),
      );

      // Tap to open portal
      await tester.tap(find.text('Open Portal'));
      await tester.pumpAndSettle();

      // Verify dialog header is present
      expect(find.text('بوابة مجرة'), findsOneWidget);

      // Verify recommendations banner is present
      expect(find.text('اقترح لي محتوى'), findsOneWidget);

      // Verify "قائمتي" is present (replaces old overflowing title)
      expect(find.text('قائمتي'), findsOneWidget);

      // Verify no RenderFlex overflow error was triggered
      expect(tester.takeException(), isNull);
    },
  );
}
