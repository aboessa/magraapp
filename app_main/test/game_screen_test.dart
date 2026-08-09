/// Widget tests for the game screen and the trace_color engine running inside it.
///
/// These are the tests that answer "does the engine actually run": a real pack, a
/// real drag on a real canvas, a completed level and a reported attempt.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/engine/game_pack.dart';
import 'package:majarra/features/games/engine/game_services.dart';
import 'package:majarra/features/games/engine/game_session_controller.dart';
import 'package:majarra/features/games/presentation/pages/game_screen.dart';

/// The shapes pack shipped by migration 0026: a single closed circle stroke, so a
/// drag around the ring should complete it.
Map<String, dynamic> shapesPack() => {
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'tc-shapes-basic',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'level_complete'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 44, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'reduced_motion_supported': true,
        'min_touch_target_dp': 64,
      },
      'levels': [
        {
          'level': 1,
          'mode': 'shape',
          'scoring': 'geometric',
          'prompt_key': 'game.shapes_basic.circle.prompt',
          'prompt': 'هذه دائرة. اتبع الطريق.',
          'completion': {'rule': 'all_strokes_complete'},
          'tolerance_dp': 28,
          'coverage_required': 0.8,
          'stroke_paths': [
            {
              'id': 's1', 'order': 1, 'type': 'stroke', 'direction': 'forward',
              'points': [
                [0.50, 0.15], [0.68, 0.22], [0.80, 0.38], [0.85, 0.50],
                [0.80, 0.62], [0.68, 0.78], [0.50, 0.85], [0.32, 0.78],
                [0.20, 0.62], [0.15, 0.50], [0.20, 0.38], [0.32, 0.22],
                [0.50, 0.15],
              ],
            }
          ],
          'coloring': {
            'enabled': true,
            'regions': ['r1'],
            'palette': ['#FFD34D', '#00D6F5', '#FF6FAE'],
          },
        }
      ],
      'assets': {'images': [], 'audio': []},
      'voice_manifest': {'vo.intro': 'asset-vo-intro'},
    };

class _Harness {
  _Harness(Map<String, dynamic> json, {GameAccessibilitySettings? settings})
      : pack = GamePack.fromJson(json) {
    audio = SilentGameAudioService();
    reporter = RecordingAttemptReporter();
    controller = GameSessionController(
      pack: pack,
      gameId: 'game-tc-shapes-basic',
      childId: 'child-1',
      objectiveId: 'objective-world-shape-trace_form',
      ageTrack: AgeTrack.preschool,
      audio: audio,
      reporter: reporter,
      eventIdFactory: () => 'event-fixed',
      settings: settings ?? const GameAccessibilitySettings(),
    );
  }

  final GamePack pack;
  late final SilentGameAudioService audio;
  late final RecordingAttemptReporter reporter;
  late final GameSessionController controller;

  Widget widget({bool isTelevision = false}) => MaterialApp(
        home: GameScreen(
          pack: pack,
          controller: controller,
          registry: buildDefaultRegistry(),
          isTelevision: isTelevision,
        ),
      );
}

/// The drawing surface, addressed by key rather than by type: Flutter uses
/// `Listener` internally, so finding it by type is ambiguous.
final canvasFinder = find.byKey(const Key('trace_canvas'));
Future<void> traceCircle(WidgetTester tester, Rect canvas) async {
  const ring = [
    Offset(0.50, 0.15), Offset(0.68, 0.22), Offset(0.80, 0.38), Offset(0.85, 0.50),
    Offset(0.80, 0.62), Offset(0.68, 0.78), Offset(0.50, 0.85), Offset(0.32, 0.78),
    Offset(0.20, 0.62), Offset(0.15, 0.50), Offset(0.20, 0.38), Offset(0.32, 0.22),
    Offset(0.50, 0.15),
  ];
  Offset at(Offset normalised) => Offset(
        canvas.left + normalised.dx * canvas.width,
        canvas.top + normalised.dy * canvas.height,
      );

  final gesture = await tester.startGesture(at(ring.first));
  for (var i = 1; i < ring.length; i++) {
    // Interpolate so the pointer samples densely, as a finger would.
    for (var step = 1; step <= 6; step++) {
      final t = step / 6;
      final point = Offset(
        ring[i - 1].dx + (ring[i].dx - ring[i - 1].dx) * t,
        ring[i - 1].dy + (ring[i].dy - ring[i - 1].dy) * t,
      );
      await gesture.moveTo(at(point));
    }
  }
  await gesture.up();
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the engine renders the prompt and a drawing surface', (tester) async {
    tester.view.physicalSize = const Size(1200, 1800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final harness = _Harness(shapesPack());
    await tester.pumpWidget(harness.widget());
    await tester.pumpAndSettle();

    expect(find.text('هذه دائرة. اتبع الطريق.'), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);
    // Mandatory in every pack per the data contract.
    expect(find.text('أعد التعليمة'), findsOneWidget);
    expect(find.text('من جديد'), findsOneWidget);
  });

  testWidgets('tracing the shape completes the level and reports one attempt', (tester) async {
    tester.view.physicalSize = const Size(1200, 1800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final harness = _Harness(shapesPack());
    await tester.pumpWidget(harness.widget());
    await tester.pumpAndSettle();

    final canvas = tester.getRect(canvasFinder);
    await traceCircle(tester, canvas);

    expect(harness.controller.traceSession!.levelComplete, isTrue,
        reason: 'a full trace of the authored ring must complete the stroke');

    // The measured stage is over, so exactly one attempt is reported. Colouring
    // that follows cannot change it.
    expect(harness.reporter.attempts.length, 1);
    final attempt = harness.reporter.attempts.single;
    expect(attempt.gameId, 'game-tc-shapes-basic');
    expect(attempt.objectiveId, 'objective-world-shape-trace_form');
    expect(attempt.score, 1);
    expect(attempt.maxScore, 1);
    expect(attempt.completed, isTrue);
    expect(attempt.eventId, 'event-fixed');

    // Payload shape the server expects, and no coordinates in it.
    final json = attempt.toJson();
    expect(json['content_type'], 'game');
    expect(json['game_id'], 'game-tc-shapes-basic');
    expect(json.toString(), isNot(contains('0.85')));
  });

  testWidgets('completing the trace opens the colouring stage with a palette', (tester) async {
    tester.view.physicalSize = const Size(1200, 1800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final harness = _Harness(shapesPack());
    await tester.pumpWidget(harness.widget());
    await tester.pumpAndSettle();

    await traceCircle(tester, tester.getRect(canvasFinder));

    expect(harness.controller.phase, LevelPhase.coloring);
    // The child's own done button, available throughout free expression.
    expect(find.text('تم'), findsOneWidget);
    expect(harness.audio.played, contains('vo.coloring_intro'));
  });

  testWidgets('colouring is never scored', (tester) async {
    tester.view.physicalSize = const Size(1200, 1800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final harness = _Harness(shapesPack());
    await tester.pumpWidget(harness.widget());
    await tester.pumpAndSettle();

    await traceCircle(tester, tester.getRect(canvasFinder));
    final scoreAfterTrace = harness.reporter.attempts.single.score;

    // Paint, then finish.
    harness.controller.paintRegion('r1', '#FFD34D');
    await tester.pumpAndSettle();
    await tester.tap(find.text('تم'));
    await tester.pumpAndSettle();

    // No second attempt, and the score did not move because of colouring.
    expect(harness.reporter.attempts.length, 1);
    expect(harness.reporter.attempts.single.score, scoreAfterTrace);
    expect(harness.controller.phase, LevelPhase.finished);
  });

  testWidgets('the simplified motor toggle is reachable and announces itself', (tester) async {
    tester.view.physicalSize = const Size(1200, 1800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final harness = _Harness(shapesPack());
    await tester.pumpWidget(harness.widget());
    await tester.pumpAndSettle();

    expect(harness.controller.settings.simplifiedMotor, isFalse);
    await tester.tap(find.byTooltip('وضع حركي مبسّط'));
    await tester.pumpAndSettle();

    expect(harness.controller.settings.simplifiedMotor, isTrue);
    expect(find.textContaining('الوضع الحركي المبسّط'), findsOneWidget);
    expect(harness.controller.traceSession!.activeTolerance.toleranceDp, 44);
  });

  testWidgets('touch-only content is refused on television with a true reason', (tester) async {
    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final harness = _Harness(shapesPack());
    await tester.pumpWidget(harness.widget(isTelevision: true));
    await tester.pumpAndSettle();

    expect(find.text('هذه اللعبة تحتاج شاشة لمس'), findsOneWidget);
    // No drawing surface is offered at all, rather than one that cannot be used.
    expect(canvasFinder, findsNothing);
  });

  testWidgets('an unknown engine shows an update prompt, not a crash', (tester) async {
    tester.view.physicalSize = const Size(1200, 1800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final json = shapesPack()..['engine_id'] = 'holo_sculpt';
    final harness = _Harness(json);
    await tester.pumpWidget(harness.widget());
    await tester.pumpAndSettle();

    expect(find.text('هذه اللعبة تحتاج تحديث التطبيق'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the registry exposes every implemented engine and nothing else', (tester) async {
    final registry = buildDefaultRegistry();
    // trace_color plus the Wave 1 engines, all pack-driven.
    expect(registry.supports('trace_color'), isTrue);
    expect(registry.supports('memory_flip'), isTrue);
    expect(registry.supports('match_pairs'), isTrue);
    expect(registry.supports('sort_bins'), isTrue);
    expect(registry.supports('sequence_order'), isTrue);
    // Listing an engine without an implementation would make the registry lie,
    // and the game screen trusts it to decide what is playable.
    expect(registry.supports('block_code'), isFalse);
    expect(registry.supports('sim_lab'), isFalse);
    expect(registry.supports('word_build'), isFalse);
    expect(registry.engineIds.length, 5);
  });
}
