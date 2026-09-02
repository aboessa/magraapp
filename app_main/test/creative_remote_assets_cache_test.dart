import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/data/creative_remote_assets.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  RemoteDrawing drawing(String id) => RemoteDrawing(
        id: id,
        category: 'coloring',
        subCategory: 'animals',
        titleAr: 'قطة',
        urls: RemoteDrawingUrls(
          transparent: 'https://cdn.example.test/$id.png',
          thumb: 'https://cdn.example.test/$id.webp',
        ),
        isFeatured: true,
      );

  test('round-trips a child-scoped remote catalogue', () async {
    final cache = CreativeRemoteDrawingCache();
    await cache.save('child-a', [drawing('coloring-cat')]);

    final restored = await cache.read('child-a');

    expect(restored, hasLength(1));
    expect(restored!.single.id, 'coloring-cat');
    expect(restored.single.bestImageUrl, 'https://cdn.example.test/coloring-cat.png');
    expect(await cache.read('child-b'), isNull);
  });

  test('does not replace a usable catalogue with an empty response', () async {
    final cache = CreativeRemoteDrawingCache();
    await cache.save('child-a', [drawing('coloring-cat')]);
    await cache.save('child-a', []);

    expect((await cache.read('child-a'))!.single.id, 'coloring-cat');
  });

  test('treats corrupt stored JSON as a cache miss', () async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('majarra.creative_remote_drawings.v1.child-a', '{bad');

    expect(await CreativeRemoteDrawingCache().read('child-a'), isNull);
  });
}
