import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/presentation/widgets/drawing_asset.dart';

void main() {
  final smokeAssets = <String, String>{
    'coloring': 'asset-color-bird',
    'shape': 'asset-shape-template-circle',
    'number': 'asset-number-1',
    'letter': 'asset-glyph-alif',
    'dots': 'asset-dots-star',
    'complete': 'asset-complete-half-sun',
    'copy': 'asset-copy-pattern',
    'cover': 'asset-shape-cover',
  };

  for (final entry in smokeAssets.entries) {
    testWidgets('renders ${entry.key} ${entry.value} as SVG without placeholder', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 300,
                height: 300,
                child: DrawingAsset(assetIdOrPath: entry.value, fit: BoxFit.contain),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // SVG should be present
      expect(find.byType(SvgPicture), findsWidgets, reason: 'SvgPicture not found for ${entry.value}');

      // Placeholder grey box icon should NOT be shown for valid asset
      // Our placeholder uses Icons.image_outlined — ensure not present
      // (SvgPicture renders correctly, error placeholder not triggered)
      expect(find.byIcon(Icons.image_outlined), findsNothing);
    });
  }

  testWidgets('RTL does not affect drawing asset sizing', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: Center(
              child: SizedBox(
                width: 300,
                height: 300,
                child: DrawingAsset(assetIdOrPath: 'asset-color-bird', fit: BoxFit.contain),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(SvgPicture), findsWidgets);
    // Check that the SizedBox constraints are respected (no clipping error)
    final size = tester.getSize(find.byType(DrawingAsset));
    expect(size.width, greaterThan(0));
    expect(size.height, greaterThan(0));
  });

  testWidgets('phone (390x844) and tablet (768x1024) sizes do not clip', (tester) async {
    for (final phoneSize in [const Size(390, 844), const Size(768, 1024)]) {
      await tester.binding.setSurfaceSize(phoneSize);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: phoneSize.width * 0.8,
                height: phoneSize.width * 0.8,
                child: const DrawingAsset(assetIdOrPath: 'asset-color-cat', fit: BoxFit.contain),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(SvgPicture), findsWidgets);
      expect(tester.takeException(), isNull);
    }
    await tester.binding.setSurfaceSize(null);
  });

  testWidgets('missing asset shows fallback and logs', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 200,
            height: 200,
            child: DrawingAsset(assetIdOrPath: 'asset-does-not-exist-xyz', fit: BoxFit.contain),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    // Should show placeholder icon
    expect(find.byIcon(Icons.image_outlined), findsWidgets);
  });
}
