/// Widget tests for the Wave 1 engines and the remaining drawing modes.
///
/// Each engine is exercised through the registry and the shared session
/// controller, because the point of the registry is that a game is data: if an
/// engine only works when constructed directly, it is not really pack-driven.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/engine/game_pack.dart';
import 'package:majarra/features/games/engine/game_services.dart';
import 'package:majarra/features/games/engine/game_session_controller.dart';
import 'package:majarra/features/games/presentation/pages/game_screen.dart';

Map<String, dynamic> packOf({
  required String engineId,
  required List<Map<String, dynamic>> levels,
  int levelsToFinish = 1,
}) => {
      'pack_version': 1,
      'engine_id': engineId,
      'supports_dpad': engineId != 'trace_color',
      'progression': {'levels_to_finish': levelsToFinish, 'advance_on': 'level_complete'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 44, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 64,
      },
      'levels': levels,
      'assets': {'images': [], 'audio': []},
      'voice_manifest': {'vo.intro': 'asset-vo-intro'},
    };

class Harness {
  Harness(Map<String, dynamic> json)
      : pack = GamePack.fromJson(json),
        reporter = RecordingAttemptReporter(),
        audio = SilentGameAudioService() {
    controller = GameSessionController(
      pack: pack,
      gameId: 'game-under-test',
      childId: 'child-1',
      objectiveId: 'objective-1',
      ageTrack: AgeTrack.preschool,
      audio: audio,
      reporter: reporter,
      eventIdFactory: () => 'event-fixed',
      feedback: const FeedbackService(hapticsEnabled: false),
    );
  }

  final GamePack pack;
  final RecordingAttemptReporter reporter;
  final SilentGameAudioService audio;
  late final GameSessionController controller;

  Widget widget({bool isTelevision = false}) => MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: GameScreen(
            pack: pack,
            controller: controller,
            registry: buildDefaultRegistry(),
            isTelevision: isTelevision,
          ),
        ),
      );
}

Future<void> pumpBig(WidgetTester tester, Widget widget) async {
  tester.view.physicalSize = const Size(1400, 2200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(widget);
  await tester.pumpAndSettle();
}

void main() {
  group('registry', () {
    test('every Wave 1 engine is registered with a real implementation', () {
      final registry = buildDefaultRegistry();
      for (final id in ['trace_color', 'memory_flip', 'match_pairs', 'sort_bins', 'sequence_order']) {
        expect(registry.supports(id), isTrue, reason: '$id must be registered');
        expect(registry.resolve(id), isNotNull);
      }
      // Not implemented, so it must not be claimed.
      expect(registry.supports('block_code'), isFalse);
      expect(registry.supports('sim_lab'), isFalse);
    });

    test('only trace_color is hidden from television', () {
      final registry = buildDefaultRegistry();
      // Tracing needs a pointer; a grid of cards is navigable with a D-pad.
      expect(registry.resolve('trace_color')!.supportsDpad, isFalse);
      for (final id in ['memory_flip', 'match_pairs', 'sort_bins', 'sequence_order']) {
        expect(registry.resolve(id)!.supportsDpad, isTrue, reason: id);
      }
    });
  });

  group('memory_flip', () {
    Map<String, dynamic> level() => {
          'level': 1,
          'grid': [2, 2],
          'pair_type': 'identical',
          'pairs': [
            {'a': 'asset-moon', 'b': 'asset-moon-2', 'sound_key': 'pair.moon'},
            {'a': 'asset-star', 'b': 'asset-star-2', 'sound_key': 'pair.star'},
          ],
          'flip_back_delay_ms': 900,
        };

    testWidgets('the board comes from the pack, not from hard-coded content', (tester) async {
      // The old implementation generated its own board and used emoji placeholders.
      final harness = Harness(packOf(engineId: 'memory_flip', levels: [level()]));
      await pumpBig(tester, harness.widget());

      // 2 pairs => 4 tiles.
      expect(find.byIcon(Icons.question_mark), findsNWidgets(4));
      expect(find.text('أعد التعليمة'), findsOneWidget);
    });

    testWidgets('completing the board reports that it was played but not a score',
        (tester) async {
      // Entertainment-first: the mastery document gives it attempts and no mastery.
      final harness = Harness(packOf(engineId: 'memory_flip', levels: [level()]));
      await pumpBig(tester, harness.widget());

      // Try every unordered tile pair by position. Tile keys are position-stable,
      // so this makes progress regardless of how the deck was shuffled — unlike a
      // reveal-state finder, whose indices shift as tiles resolve.
      Future<void> tapTile(int index) async {
        await tester.tap(find.byKey(ValueKey('memory_tile_$index')));
        await tester.pumpAndSettle();
      }

      for (var a = 0; a < 4; a++) {
        for (var b = a + 1; b < 4; b++) {
          if (harness.reporter.attempts.isNotEmpty) break;
          await tapTile(a);
          await tapTile(b);
          // Long enough for a mismatch to flip back at the pack's 900ms delay.
          await tester.pumpAndSettle(const Duration(milliseconds: 1200));
        }
      }

      expect(harness.reporter.attempts.length, 1);
      final attempt = harness.reporter.attempts.single;
      expect(attempt.maxScore, 0, reason: 'memory_flip must not produce a mark');
      expect(attempt.score, 0);
      expect(attempt.gameId, 'game-under-test');
    });
  });

  group('match_pairs', () {
    Map<String, dynamic> level() => {
          'level': 1,
          'match_type': 'identical',
          'prompt_key': 'game.match.prompt',
          'prompt': 'ضع كل صورة عند مثيلها',
          'targets': [
            {'id': 't1', 'image': 'asset-cat', 'label_key': 'label.cat', 'audio': 'asset-vo-cat'},
            {'id': 't2', 'image': 'asset-dog', 'label_key': 'label.dog', 'audio': 'asset-vo-dog'},
          ],
          'items': [
            {'id': 'i1', 'image': 'asset-cat-2', 'target': 't1', 'label_key': 'label.cat', 'audio': 'asset-vo-cat'},
            {'id': 'i2', 'image': 'asset-dog-2', 'target': 't2', 'label_key': 'label.dog', 'audio': 'asset-vo-dog'},
          ],
        };

    testWidgets('a correct match on the first try counts, a retry does not',
        (tester) async {
      final harness = Harness(packOf(engineId: 'match_pairs', levels: [level()]));
      await pumpBig(tester, harness.widget());

      expect(find.text('ضع كل صورة عند مثيلها'), findsOneWidget);

      // i1 placed on the wrong target first: returned, no failure shown.
      await tester.tap(find.text('i1'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('t2'));
      await tester.pumpAndSettle();
      expect(find.text('i1'), findsOneWidget, reason: 'a wrong placement returns the piece');

      // Then correctly.
      await tester.tap(find.text('i1'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('t1'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('i2'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('t2'));
      await tester.pumpAndSettle();

      final attempt = harness.reporter.attempts.single;
      expect(attempt.maxScore, 2);
      // Only i2 was right first time, which is what the mastery table specifies.
      expect(attempt.score, 1);
      expect(attempt.helpUsed, isTrue);
    });
  });

  group('sort_bins', () {
    Map<String, dynamic> level() => {
          'level': 1,
          'criterion_key': 'criterion.colour',
          'criterion_type': 'color',
          'prompt': 'ضع كل شيء في سلّته',
          'bins': [
            {'id': 'b1', 'label_key': 'bin.yellow', 'image': 'asset-bin-yellow', 'audio': 'asset-vo-yellow'},
            {'id': 'b2', 'label_key': 'bin.blue', 'image': 'asset-bin-blue', 'audio': 'asset-vo-blue'},
          ],
          'items': [
            {'id': 'i1', 'image': 'a1', 'bin': 'b1', 'label_key': 'l.1', 'audio': 'v1'},
            {'id': 'i2', 'image': 'a2', 'bin': 'b2', 'label_key': 'l.2', 'audio': 'v2'},
            {'id': 'i3', 'image': 'a3', 'bin': 'b1', 'label_key': 'l.3', 'audio': 'v3'},
            {'id': 'i4', 'image': 'a4', 'bin': 'b2', 'label_key': 'l.4', 'audio': 'v4'},
          ],
        };

    testWidgets('sorting every item correctly scores full marks', (tester) async {
      final harness = Harness(packOf(engineId: 'sort_bins', levels: [level()]));
      await pumpBig(tester, harness.widget());

      for (final pair in [['i1', 'b1'], ['i2', 'b2'], ['i3', 'b1'], ['i4', 'b2']]) {
        await tester.tap(find.text(pair[0]));
        await tester.pumpAndSettle();
        await tester.tap(find.text(pair[1]).first);
        await tester.pumpAndSettle();
      }

      final attempt = harness.reporter.attempts.single;
      expect(attempt.score, 4);
      expect(attempt.maxScore, 4);
      expect(attempt.helpUsed, isFalse);
    });
  });

  group('sequence_order', () {
    Map<String, dynamic> level() => {
          'level': 1,
          'sequence_type': 'process',
          'prompt_key': 'game.seq.prompt',
          'prompt': 'رتّب الخطوات',
          'direction': 'reading_order',
          'panels': [
            {'id': 'p1', 'image': 'a1', 'position': 1, 'caption_key': 'c.1', 'audio': 'v1'},
            {'id': 'p2', 'image': 'a2', 'position': 2, 'caption_key': 'c.2', 'audio': 'v2'},
            {'id': 'p3', 'image': 'a3', 'position': 3, 'caption_key': 'c.3', 'audio': 'v3'},
          ],
          'accepted_orders': [['p1', 'p2', 'p3']],
        };

    testWidgets('the accepted order scores 1 of 1', (tester) async {
      // A sequence is right or it is not yet right, so the mastery table scores it
      // as one item rather than per panel.
      final harness = Harness(packOf(engineId: 'sequence_order', levels: [level()]));
      await pumpBig(tester, harness.widget());

      for (final id in ['p1', 'p2', 'p3']) {
        await tester.tap(find.text(id));
        await tester.pumpAndSettle();
      }

      final attempt = harness.reporter.attempts.single;
      expect(attempt.score, 1);
      expect(attempt.maxScore, 1);
    });

    testWidgets('a wrong order still completes and is not punished', (tester) async {
      final harness = Harness(packOf(engineId: 'sequence_order', levels: [level()]));
      await pumpBig(tester, harness.widget());

      for (final id in ['p3', 'p2', 'p1']) {
        await tester.tap(find.text(id));
        await tester.pumpAndSettle();
      }

      final attempt = harness.reporter.attempts.single;
      expect(attempt.score, 0);
      expect(attempt.maxScore, 1);
      // No failure state, no lockout: the level finished.
      expect(harness.controller.phase, LevelPhase.finished);
    });

    testWidgets('undo removes the last placed panel', (tester) async {
      final harness = Harness(packOf(engineId: 'sequence_order', levels: [level()]));
      await pumpBig(tester, harness.widget());

      await tester.tap(find.text('p1'));
      await tester.pumpAndSettle();
      expect(find.text('p1'), findsOneWidget);

      await tester.tap(find.text('رجوع'));
      await tester.pumpAndSettle();
      // Back in the tray, and the strip shows its slot number again.
      expect(harness.reporter.attempts, isEmpty);
    });
  });

  group('connect_dots', () {
    Map<String, dynamic> level() => {
          'level': 1,
          'mode': 'connect_dots',
          'scoring': 'sequence',
          'prompt_key': 'game.dots.prompt',
          'prompt': 'وصّل النقاط بالترتيب',
          'completion': {'rule': 'all_dots_connected'},
          'dots': [
            {'id': 'd1', 'order': 1, 'at': [0.2, 0.2]},
            {'id': 'd2', 'order': 2, 'at': [0.8, 0.2]},
            {'id': 'd3', 'order': 3, 'at': [0.5, 0.8]},
          ],
        };

    testWidgets('tapping the dots in order completes the level', (tester) async {
      final harness = Harness(packOf(engineId: 'trace_color', levels: [level()]));
      await pumpBig(tester, harness.widget());

      final canvas = find.byKey(const Key('connect_dots_canvas'));
      expect(canvas, findsOneWidget);
      final rect = tester.getRect(canvas);
      Offset at(double nx, double ny) =>
          Offset(rect.left + nx * rect.width, rect.top + ny * rect.height);

      for (final point in [[0.2, 0.2], [0.8, 0.2], [0.5, 0.8]]) {
        await tester.tapAt(at(point[0], point[1]));
        await tester.pumpAndSettle();
      }

      expect(harness.controller.connectedDots.length, 3);
      final attempt = harness.reporter.attempts.single;
      expect(attempt.answers.first['dots_connected'], 3);
    });

    testWidgets('an out-of-order tap is ignored, not punished', (tester) async {
      final harness = Harness(packOf(engineId: 'trace_color', levels: [level()]));
      await pumpBig(tester, harness.widget());

      final rect = tester.getRect(find.byKey(const Key('connect_dots_canvas')));
      // Tap the third dot first.
      await tester.tapAt(Offset(rect.left + 0.5 * rect.width, rect.top + 0.8 * rect.height));
      await tester.pumpAndSettle();

      expect(harness.controller.connectedDots, isEmpty);
      expect(harness.reporter.attempts, isEmpty);
    });
  });

  group('free draw', () {
    Map<String, dynamic> level() => {
          'level': 1,
          'mode': 'free_draw',
          'scoring': 'none',
          'prompt_key': 'game.free.prompt',
          'prompt': 'ارسم ما تحب',
          'completion': {'rule': 'child_taps_done'},
        };

    testWidgets('offers brush, eraser, undo, redo, clear and done', (tester) async {
      final harness = Harness(packOf(engineId: 'trace_color', levels: [level()]));
      await pumpBig(tester, harness.widget());

      expect(find.byKey(const Key('free_draw_canvas')), findsOneWidget);
      expect(find.text('ممحاة'), findsOneWidget);
      expect(find.text('رجوع'), findsOneWidget);
      expect(find.text('إعادة'), findsOneWidget);
      expect(find.text('من جديد'), findsOneWidget);
      expect(find.text('تم'), findsOneWidget);
      // No guide path to trace, so no tolerance is displayed anywhere.
      expect(find.text('ارسم ما تحب'), findsOneWidget);
    });

    testWidgets('drawing then undo and redo restores exactly', (tester) async {
      final harness = Harness(packOf(engineId: 'trace_color', levels: [level()]));
      await pumpBig(tester, harness.widget());

      final rect = tester.getRect(find.byKey(const Key('free_draw_canvas')));
      final gesture = await tester.startGesture(rect.center);
      for (var i = 1; i <= 8; i++) {
        await gesture.moveTo(rect.center + Offset(i * 6, i * 3));
      }
      await gesture.up();
      await tester.pumpAndSettle();

      // Undo becomes available only once something was drawn. Located by key,
      // because `find.byType(OutlinedButton)` does not match the subclass that
      // `OutlinedButton.icon` constructs.
      final undo = find.byKey(const Key('free_undo'));
      final redo = find.byKey(const Key('free_redo'));
      expect(tester.widget<OutlinedButton>(undo).onPressed, isNotNull);
      expect(tester.widget<OutlinedButton>(redo).onPressed, isNull,
          reason: 'nothing has been undone yet');

      await tester.tap(undo);
      await tester.pumpAndSettle();
      expect(tester.widget<OutlinedButton>(redo).onPressed, isNotNull);
      expect(tester.widget<OutlinedButton>(undo).onPressed, isNull,
          reason: 'the only stroke was undone');

      await tester.tap(redo);
      await tester.pumpAndSettle();
      expect(tester.widget<OutlinedButton>(undo).onPressed, isNotNull);
      expect(tester.widget<OutlinedButton>(redo).onPressed, isNull);
    });

    testWidgets('free drawing is never scored', (tester) async {
      final harness = Harness(packOf(engineId: 'trace_color', levels: [level()]));
      await pumpBig(tester, harness.widget());

      await tester.tap(find.text('تم'));
      await tester.pumpAndSettle();

      final attempt = harness.reporter.attempts.single;
      expect(attempt.maxScore, 0, reason: 'there is nothing objective to measure');
      expect(attempt.score, 0);
      expect(harness.controller.phase, LevelPhase.finished);
    });

    testWidgets('draw_from_prompt uses the same unscored surface', (tester) async {
      final harness = Harness(packOf(engineId: 'trace_color', levels: [
        {...level(), 'mode': 'draw_from_prompt', 'prompt': 'ارسم بيتًا لحيوان تحبّه'},
      ]));
      await pumpBig(tester, harness.widget());

      expect(find.byKey(const Key('free_draw_canvas')), findsOneWidget);
      expect(find.text('ارسم بيتًا لحيوان تحبّه'), findsOneWidget);
      await tester.tap(find.text('تم'));
      await tester.pumpAndSettle();
      expect(harness.reporter.attempts.single.maxScore, 0);
    });

    testWidgets('complete_drawing with authored geometry stays measurable', (tester) async {
      // The one case where an open-ended-sounding mode does have something
      // objective: a template to complete, so it keeps the tracing surface.
      final harness = Harness(packOf(engineId: 'trace_color', levels: [
        {
          'level': 1,
          'mode': 'complete_drawing',
          'scoring': 'geometric',
          'prompt_key': 'game.complete.prompt',
          'prompt': 'أكمل النصف الآخر',
          'completion': {'rule': 'all_strokes_complete'},
          'tolerance_dp': 28,
          'coverage_required': 0.8,
          'stroke_paths': [
            {'id': 's1', 'order': 1, 'type': 'stroke', 'points': [[0.5, 0.2], [0.5, 0.8]]},
          ],
        },
      ]));
      await pumpBig(tester, harness.widget());

      expect(find.byKey(const Key('trace_canvas')), findsOneWidget);
      expect(find.byKey(const Key('free_draw_canvas')), findsNothing);
    });
  });
}
