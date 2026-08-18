import 'dart:ui' show ImageByteFormat, PointerDeviceKind;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderRepaintBoundary;
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/data/creation_document.dart';
import 'package:majarra/features/games/engine/free_draw_surface.dart';
import 'package:majarra/features/games/engine/game_pack.dart';
import 'package:majarra/features/games/engine/game_services.dart';
import 'package:majarra/features/games/engine/game_session_controller.dart';
import 'package:majarra/features/games/engine/trace_color_engine.dart';

class _NoopReporter implements AttemptReporter {
  @override
  Future<void> report(GameAttempt attempt) async {}
}

GameSessionController _controller(Map<String, dynamic> level) {
  final pack = GamePack.fromJson({
    'pack_version': 1,
    'engine_id': 'trace_color',
    'pack_id': 'drawing-regression',
    'localization': 'language_neutral',
    'supports_dpad': false,
    'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
    'accessibility': {
      'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
      'sequential_tap_alternative': true,
      'min_touch_target_dp': 48,
    },
    'assets': {'images': <String>[], 'audio': <String>[]},
    'voice_manifest': <String, Object?>{},
    'levels': [level],
  });
  return GameSessionController(
    pack: pack,
    gameId: 'drawing-regression',
    childId: 'child-test',
    ageTrack: AgeTrack.kids,
    audio: SilentGameAudioService(),
    reporter: _NoopReporter(),
    eventIdFactory: () => 'event-test',
  );
}

Future<List<int>> _rgba(GlobalKey boundaryKey) async {
  final boundary =
      boundaryKey.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  final image = await boundary.toImage(pixelRatio: 1);
  final data = await image.toByteData(format: ImageByteFormat.rawRgba);
  image.dispose();
  return data!.buffer.asUint8List();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('mouse drag changes artwork pixels immediately', (tester) async {
    tester.view.physicalSize = const Size(500, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final controller = _controller({
      'level': 1,
      'mode': 'free_draw',
      'scoring': 'none',
      'prompt_key': 'draw',
      'completion': {'rule': 'child_taps_done'},
    });
    addTearDown(controller.dispose);
    final boundaryKey = GlobalKey();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: FreeDrawSurface(
            controller: controller,
            canvasRepaintBoundaryKey: boundaryKey,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final before = (await tester.runAsync(() => _rgba(boundaryKey)))!;
    final rect = tester.getRect(find.byKey(const Key('free_draw_canvas')));
    final mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
    await mouse.addPointer(location: rect.centerLeft + const Offset(40, 0));
    await mouse.down(rect.centerLeft + const Offset(40, 0));
    await mouse.moveTo(rect.centerRight - const Offset(40, 0));
    await mouse.up();
    await tester.pump();

    final after = (await tester.runAsync(() => _rgba(boundaryKey)))!;
    expect(after, isNot(equals(before)));
  });

  testWidgets('outside tap does not fill and fill history is exact', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final controller = _controller({
      'level': 1,
      'mode': 'coloring',
      'scoring': 'none',
      'prompt_key': 'color',
      'completion': {'rule': 'child_taps_done'},
      'coloring': {
        'enabled': true,
        'palette': ['#EF4444', '#2580FF'],
        'regions': [
          {
            'id': 'center',
            'polygon': [
              [0.25, 0.25],
              [0.75, 0.25],
              [0.75, 0.75],
              [0.25, 0.75],
            ],
          },
        ],
      },
    });
    addTearDown(controller.dispose);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: TraceColorSurface(controller: controller)),
      ),
    );
    await tester.pumpAndSettle();

    final canvas = find.byKey(const Key('coloring_canvas'));
    final rect = tester.getRect(canvas);
    await tester.tapAt(rect.topLeft + const Offset(4, 4));
    await tester.pump();
    expect(controller.regionColors, isEmpty);

    await tester.tapAt(rect.center);
    await tester.pump();
    expect(controller.regionColors, {'center': '#EF4444'});

    controller.undoFill();
    expect(controller.regionColors, isEmpty);
    controller.redoFill();
    expect(controller.regionColors, {'center': '#EF4444'});
    controller.clearFills();
    expect(controller.regionColors, isEmpty);
    controller.undoFill();
    expect(controller.regionColors, {'center': '#EF4444'});
  });

  test(
    'creation document preserves short references and scales stroke width',
    () {
      const stroke = FreeStroke(
        points: [Offset(32, 64), Offset(160, 320)],
        color: Colors.black,
        width: 16,
        isEraser: false,
        brush: DrawBrush.crayon,
        opacity: 0.7,
      );
      final stored = DocStroke.fromFreeStrokeDimensions(stroke, 320, 640);
      final restored = stored.toFreeStrokeDimensions(640, 320);

      expect(restored.points, const [Offset(64, 32), Offset(320, 160)]);
      expect(restored.width, 16);
      expect(restored.brush, DrawBrush.crayon);
      expect(restored.opacity, 0.7);

      final document = CreationDocument(
        version: kCreationDocVersion,
        mode: 'free_draw',
        referenceActivityId: 'ref-cat',
        referenceAssetId: 'asset-cat',
        referenceTitle: 'قطة',
        strokes: [stored],
      );
      final parsed = CreationDocument.tryParse(document.toJsonString());
      expect(parsed, isNotNull);
      expect(parsed!.referenceActivityId, 'ref-cat');
      expect(parsed.referenceAssetId, 'asset-cat');
      expect(parsed.referenceTitle, 'قطة');
    },
  );
}
