import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:majarra/features/games/application/creative_catalogue_provider.dart';
import 'package:majarra/features/games/data/creative_catalogue.dart';
import 'package:majarra/features/games/engine/game_pack.dart';
import 'package:majarra/features/games/engine/trace_geometry.dart' show StrokeKind;

// Catalogue -> GamePack smoke: same path prod uses, but via direct JSON
// to avoid ProviderContainer deadlock in headless tests.
List<Map<String, dynamic>> _loadJson(String rel) {
  final f = File(rel);
  if (!f.existsSync()) return [];
  return (jsonDecode(f.readAsStringSync()) as List).cast<Map<String, dynamic>>();
}

GamePack _packColoring(ColoringTemplate t) => GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-color-${t.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [t.assetId],
        'audio': <String>[],
      },
      'voice_manifest': <String, Object?>{},
      'levels': [
        {
          'level': 1,
          'mode': 'coloring',
          'scoring': 'none',
          'prompt_key': 'game.color.${t.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'coloring': {
            'enabled': true,
            'palette': t.palette,
            'regions': t.regions.map((r) => r.toJson()).toList(),
            'template_asset': t.assetId,
          },
        },
      ],
    });

GamePack _packStudio(StudioCatalogItem item, String mode) => GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-shape-template-circle'],
        'audio': <String>[],
      },
      'voice_manifest': <String, Object?>{},
      'levels': [
        if (mode == 'dots')
          {
            'level': 1,
            'mode': 'connect_dots',
            'scoring': 'sequence',
            'prompt_key': 'game.dots.${item.id}.prompt',
            'completion': {'rule': 'all_dots_connected'},
            'dots': item.dots,
          }
        else if (mode == 'complete')
          {
            'level': 1,
            'mode': 'complete_drawing',
            'scoring': 'none',
            'prompt_key': 'game.complete.${item.id}.prompt',
            'completion': {'rule': 'child_taps_done'},
            'background_asset': item.assetId,
          }
        else if (mode == 'copy')
          {
            'level': 1,
            'mode': 'copy_pattern',
            'scoring': 'none',
            'prompt_key': 'game.copy.${item.id}.prompt',
            'completion': {'rule': 'child_taps_done'},
            'background_asset': item.assetId,
          }
        else
          {
            'level': 1,
            'mode': item.mode ?? mode,
            'scoring': mode == 'trace' || mode == 'letter' || mode == 'number' ? 'geometric' : 'none',
            'prompt_key': 'game.trace.${item.id}.prompt',
            'completion': {'rule': 'all_strokes_complete'},
            'stroke_paths': item.strokePaths,
            'background_asset': item.assetId,
          },
      ],
    });

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('Creative Studio E2E', () {
    testWidgets('catalogues load (40 coloring / 15 trace)', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: Consumer(builder: (context, ref, _) {
                final coloring = ref.watch(coloringCatalogueProvider);
                final trace = ref.watch(traceCatalogueProvider);
                return coloring.when(
                  loading: () => const CircularProgressIndicator(),
                  error: (e, _) => Text('err $e'),
                  data: (list) => trace.when(
                    loading: () => const CircularProgressIndicator(),
                    error: (e, _) => Text('err $e'),
                    data: (tlist) => Text('ok ${list.length}/${tlist.length}'),
                  ),
                );
              }),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('ok 40/15'), findsOneWidget);
    });

    test('Trace/Letter/Number JSON has valid stroke geometry', () {
      for (final rel in ['assets/data/trace_items.json', 'assets/data/letter_items.json', 'assets/data/number_items.json']) {
        final list = _loadJson(rel);
        expect(list, isNotEmpty, reason: rel);
        for (final m in list) {
          final item = StudioCatalogItem.fromJson(m);
          final pack = _packStudio(item, 'trace');
          expect(pack.levels.first.strokes, isNotEmpty, reason: '${item.id} no strokes');
          for (final s in pack.levels.first.strokes) {
            if (s.kind == StrokeKind.dot) {
              expect(s.points.length, 1, reason: '${item.id}/${s.id} dot must have 1 point');
            } else {
              expect(s.points.length, greaterThanOrEqualTo(2), reason: '${item.id}/${s.id}');
            }
            for (final p in s.points) {
              expect(p.x, inInclusiveRange(0, 1));
              expect(p.y, inInclusiveRange(0, 1));
            }
          }
        }
      }
    });

    test('Dots packs have ordered dots', () {
      final list = _loadJson('assets/data/dots_items.json').map(StudioCatalogItem.fromJson).toList();
      expect(list.length, 12);
      final pack = _packStudio(list.first, 'dots');
      expect(pack.levels.first.dots.length, greaterThanOrEqualTo(3));
      final orders = pack.levels.first.dots.map((d) => d.order).toList();
      expect(orders, orderedEquals(List.generate(orders.length, (i) => i + 1)));
    });

    test('Coloring packs have regions with valid polygons', () {
      final list = _loadJson('assets/data/coloring_templates.json').map(ColoringTemplate.fromJson).toList();
      final bird = list.firstWhere((e) => e.id == 'bird');
      expect(bird.regions, isNotEmpty);
      expect(bird.regions.every((r) => r.polygon.length >= 3), isTrue);
      final pack = _packColoring(bird);
      expect(pack.levels.first.coloring!.templateAsset, isNotNull);
    });

    test('Complete/Copy packs are child_taps_done', () {
      final complete = StudioCatalogItem.fromJson(_loadJson('assets/data/complete_items.json').first);
      final copy = StudioCatalogItem.fromJson(_loadJson('assets/data/copy_items.json').first);
      expect(_packStudio(complete, 'complete').levels.first.completion, CompletionRule.childTapsDone);
      expect(_packStudio(copy, 'copy').levels.first.completion, CompletionRule.childTapsDone);
    });

    testWidgets('Reference activity deep link resolves (ref-cat -> قطة)', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Consumer(builder: (context, ref, _) {
              final async = ref.watch(referenceActivityAsync('ref-cat'));
              return async.when(
                loading: () => const CircularProgressIndicator(),
                error: (e, _) => Text('err $e'),
                data: (act) => Text(act == null ? 'not found' : act.titleAr),
              );
            }),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('قطة'), findsOneWidget);
    });

    test('Reference steps ordered per activity', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final steps = await c.read(referenceStepsProvider.future);
      expect(steps.length, 29);
      final cat = steps.where((s) => s.activityId == 'ref-cat').toList();
      expect(cat.length, 5);
      expect(cat.map((e) => e.order).toList(), orderedEquals([1, 2, 3, 4, 5]));
    });

    test('Prompt items exist (free-draw)', () {
      final list = _loadJson('assets/data/prompt_items.json');
      expect(list.length, 6);
      expect(list.every((e) => e['icon'] == 'prompt'), isTrue);
    });

    test('Deep-link IDs stable across reloads (direct JSON, no container deadlock)', () {
      final l1 = _loadJson('assets/data/coloring_templates.json');
      final l2 = _loadJson('assets/data/coloring_templates.json');
      expect(l1.map((e) => e['id']).toList(), l2.map((e) => e['id']).toList());
      final t1 = ColoringTemplate.fromJson(l1.firstWhere((e) => e['id'] == 'bird'));
      final t2 = ColoringTemplate.fromJson(l2.firstWhere((e) => e['id'] == 'bird'));
      expect(_packColoring(t1).packId, _packColoring(t2).packId);
    });
  });
}
