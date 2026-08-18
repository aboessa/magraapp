/// Tests for local drawing storage and the «مجموعتي» shelves.

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/data/local_creation_store.dart';
import 'package:majarra/features/games/presentation/pages/my_collection_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A 1x1 PNG, enough to exercise storage and rendering without a canvas.
final Uint8List tinyPng = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/AAAAAElFTkSuQmCC',
);

LocalCreation creation({
  required String id,
  String childId = 'child-1',
  String? uploadedId,
}) {
  return LocalCreation(
    id: id,
    childId: childId,
    gameId: 'game-tc-shapes-basic',
    drawingMode: 'coloring',
    width: 1,
    height: 1,
    byteLength: tinyPng.lengthInBytes,
    createdAt: DateTime(2026, 8, 9),
    pngBase64: base64Encode(tinyPng),
    uploadedCreationId: uploadedId,
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('LocalCreationStore', () {
    test('persists and lists a creation for one child', () async {
      final store = LocalCreationStore();
      await store.persist(creation(id: 'c1'));
      final listed = await store.list('child-1');
      expect(listed.length, 1);
      expect(listed.single.id, 'c1');
      expect(listed.single.bytes, tinyPng);
    });

    test('children do not see each other\'s drawings', () async {
      final store = LocalCreationStore();
      await store.persist(creation(id: 'c1', childId: 'child-1'));
      await store.persist(creation(id: 'c2', childId: 'child-2'));
      expect((await store.list('child-1')).single.id, 'c1');
      expect((await store.list('child-2')).single.id, 'c2');
    });

    test('newest first without deleting at the soft limit', () async {
      final store = LocalCreationStore();
      final count = LocalCreationStore.retainPerChild + 5;
      for (var i = 0; i < count; i++) {
        await store.persist(creation(id: 'c$i'));
      }
      final listed = await store.list('child-1');
      // retainPerChild is a warning threshold; only hardCap may discard data.
      expect(listed.length, count);
      expect(listed.first.id, 'c${count - 1}');
    });

    test('delete removes only the named creation', () async {
      final store = LocalCreationStore();
      await store.persist(creation(id: 'c1'));
      await store.persist(creation(id: 'c2'));
      await store.delete('child-1', 'c1');
      final listed = await store.list('child-1');
      expect(listed.map((entry) => entry.id), ['c2']);
    });

    test('clearing a child removes every drawing', () async {
      // Called when a child profile is deleted: on-device copies must not outlive
      // the profile they belong to.
      final store = LocalCreationStore();
      await store.persist(creation(id: 'c1'));
      await store.clearChild('child-1');
      expect(await store.list('child-1'), isEmpty);
    });

    test('a creation is local until explicitly marked uploaded', () async {
      final store = LocalCreationStore();
      await store.persist(creation(id: 'c1'));
      expect((await store.list('child-1')).single.isUploaded, isFalse);

      await store.markUploaded('child-1', 'c1', 'remote-1');
      final updated = (await store.list('child-1')).single;
      expect(updated.isUploaded, isTrue);
      expect(updated.uploadedCreationId, 'remote-1');
    });

    test(
      'a corrupt cache yields an empty gallery rather than a crash',
      () async {
        SharedPreferences.setMockInitialValues({
          'majarra.creations.child-1': 'not json at all',
        });
        final store = LocalCreationStore();
        expect(await store.list('child-1'), isEmpty);
      },
    );

    test('rename accepts short titles and clamps long titles', () async {
      final store = LocalCreationStore();
      await store.persist(creation(id: 'c1'));

      await store.rename('child-1', 'c1', 'لوحتي');
      expect((await store.list('child-1')).single.title, 'لوحتي');

      final longTitle = List.filled(80, 'a').join();
      await store.rename('child-1', 'c1', longTitle);
      expect(
        (await store.list('child-1')).single.title,
        longTitle.substring(0, 60),
      );
    });
  });

  group('«مجموعتي»', () {
    testWidgets('shows both shelves with honest empty states', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MyCollectionPage(
            childId: 'child-1',
            creationStore: LocalCreationStore(),
            loadStickers: () async => const [],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('مجموعتي'), findsOneWidget);
      expect(find.text('رسوماتي'), findsOneWidget);
      expect(find.text('ملصقاتي'), findsOneWidget);
      expect(find.text('لا رسومات بعد'), findsOneWidget);
    });

    testWidgets('renders a saved drawing and can delete it', (tester) async {
      final store = LocalCreationStore();
      await store.persist(creation(id: 'c1'));

      await tester.pumpWidget(
        MaterialApp(
          home: MyCollectionPage(
            childId: 'child-1',
            creationStore: store,
            loadStickers: () async => const [],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(Image), findsOneWidget);
      await tester.tap(find.byTooltip('احذف'));
      await tester.pumpAndSettle();

      expect(find.text('لا رسومات بعد'), findsOneWidget);
      expect(await store.list('child-1'), isEmpty);
    });

    testWidgets('the sticker shelf lists earned rewards', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MyCollectionPage(
            childId: 'child-1',
            creationStore: LocalCreationStore(),
            loadStickers: () async => [
              EarnedSticker(
                rewardKey: 'sticker-shapes-complete',
                sourceId: 'game-tc-shapes-basic',
                earnedAt: DateTime(2026, 8, 9),
              ),
            ],
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('ملصقاتي'));
      await tester.pumpAndSettle();
      expect(find.text('sticker-shapes-complete'), findsOneWidget);
    });

    testWidgets(
      'a failing sticker fetch does not break the child\'s own space',
      (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: MyCollectionPage(
              childId: 'child-1',
              creationStore: LocalCreationStore(),
              loadStickers: () async => throw Exception('offline'),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        await tester.tap(find.text('ملصقاتي'));
        await tester.pumpAndSettle();
        expect(find.text('لا ملصقات بعد'), findsOneWidget);
      },
    );
  });
}
