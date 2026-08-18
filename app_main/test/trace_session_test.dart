/// Tests for the pack model, the tracing session and the engine registry.
///
/// The pack fixture is the real shipped shape from migration 0023 (the Arabic
/// baa level: a curved body then a diacritic dot), so the rules being asserted
/// are the ones that will run against actual content.

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/engine/game_engine_registry.dart';
import 'package:majarra/features/games/engine/game_pack.dart';
import 'package:majarra/features/games/engine/game_services.dart';
import 'package:majarra/features/games/engine/game_session_controller.dart';
import 'package:majarra/features/games/engine/trace_geometry.dart';
import 'package:majarra/features/games/engine/trace_session.dart';
import 'package:flutter/widgets.dart';

Map<String, dynamic> baaLevel() => {
  'level': 1,
  'mode': 'letter',
  'scoring': 'geometric_ordered',
  'prompt_key': 'game.letter_tracing.baa.prompt',
  'prompt': 'هذا حرف الباء، وصوته بَ.',
  'completion': {'rule': 'all_strokes_complete'},
  'language': 'ar',
  'glyph': 'ب',
  'letter_form': 'isolated',
  'writing_direction': 'rtl',
  'guide_audio': 'asset-vo-sound-baa',
  'tolerance_dp': 24,
  'coverage_required': 0.8,
  // Written dot-first on purpose: the model must sort by `order`, so no
  // rendering or input path can depend on JSON ordering.
  'stroke_paths': [
    {
      'id': 's2',
      'order': 2,
      'type': 'dot',
      'points': [
        [0.55, 0.78],
      ],
    },
    {
      'id': 's1',
      'order': 1,
      'type': 'stroke',
      'direction': 'forward',
      'points': [
        [0.80, 0.45],
        [0.55, 0.62],
        [0.30, 0.45],
      ],
    },
  ],
  'coloring': {
    'enabled': true,
    'regions': ['r1'],
    'palette': ['#FFD34D', '#00D6F5', '#FF6FAE'],
  },
};

Map<String, dynamic> packJson({List<Map<String, dynamic>>? levels}) => {
  'pack_version': 1,
  'engine_id': 'trace_color',
  'pack_id': 'tc-luna-ep4',
  'localization': 'language_specific',
  'supports_dpad': false,
  'progression': {'levels_to_finish': 1, 'advance_on': 'level_complete'},
  'accessibility': {
    'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
    'sequential_tap_alternative': true,
    'reduced_motion_supported': true,
    'min_touch_target_dp': 48,
  },
  'levels': levels ?? [baaLevel()],
  'assets': {'images': [], 'audio': []},
  'voice_manifest': {'vo.intro': 'asset-vo-glt-intro'},
};

/// Traces the baa body on a [size] x [size] canvas.
///
/// Scaled from the authored normalised points rather than hard-coded pixels, so
/// a test can choose a realistic canvas. Canvas size matters: a 24dp tolerance
/// on a 100px canvas is extremely forgiving because the whole glyph is only
/// ~60px long, whereas on a 400px canvas it behaves as authored.
List<Offset2D> traceBody(double size) {
  const authored = [
    NormalizedPoint(0.80, 0.45),
    NormalizedPoint(0.55, 0.62),
    NormalizedPoint(0.30, 0.45),
  ];
  final points = <Offset2D>[];
  for (var segment = 1; segment < authored.length; segment++) {
    final from = authored[segment - 1].scale(size, size);
    final to = authored[segment].scale(size, size);
    for (var step = 0; step <= 40; step++) {
      final t = step / 40;
      points.add(
        Offset2D(
          from.dx + (to.dx - from.dx) * t,
          from.dy + (to.dy - from.dy) * t,
        ),
      );
    }
  }
  return points;
}

/// The baa diacritic's authored position, in canvas pixels.
Offset2D dotAt(double size) =>
    const NormalizedPoint(0.55, 0.78).scale(size, size);

TraceSession sessionFor(
  GamePack pack, {
  bool simplified = false,
  double canvas = 400,
}) {
  return TraceSession(
    level: pack.levels.first,
    accessibility: pack.accessibility,
    canvasWidth: canvas,
    canvasHeight: canvas,
    simplifiedMotor: simplified,
  );
}

/// Drags [points] as one continuous stroke and returns whether it completed.
bool drag(TraceSession session, TraceStroke stroke, List<Offset2D> points) {
  session.beginStroke(stroke, points.first);
  for (final point in points.skip(1)) {
    session.extend(point);
  }
  return session.endStroke();
}

class _StubEngine extends GameEngine {
  const _StubEngine(this.engineId, {this.supportsDpad = false});
  @override
  final String engineId;
  @override
  final bool supportsDpad;
  @override
  Widget build(BuildContext context, GameSessionController controller) =>
      const SizedBox.shrink();
}

void main() {
  group('GamePack parsing', () {
    test('strokes are ordered by `order`, not by JSON position', () {
      final pack = GamePack.fromJson(packJson());
      final ids = pack.levels.first.strokes.map((stroke) => stroke.id).toList();
      expect(ids, ['s1', 's2'], reason: 'body must precede the dot');
    });

    test('reads the letter data and does not infer direction from the UI', () {
      final level = GamePack.fromJson(packJson()).levels.first;
      expect(level.glyph, 'ب');
      expect(level.language, 'ar');
      expect(level.letterForm, 'isolated');
      expect(level.isRtl, isTrue);
      expect(level.mode, DrawingMode.letter);
      expect(level.scoring, ScoringMode.geometricOrdered);
      expect(level.scoring.enforcesOrder, isTrue);
    });

    test('max score counts strokes and excludes unscored levels', () {
      final scored = GamePack.fromJson(packJson());
      expect(scored.levels.first.maxScore, 2);

      final free = GamePack.fromJson(
        packJson(
          levels: [
            {
              'level': 1,
              'mode': 'free_draw',
              'scoring': 'none',
              'prompt_key': 'game.free.prompt',
              'completion': {'rule': 'child_taps_done'},
            },
          ],
        ),
      );
      // Colouring "لا يُحسب" — an unscored level contributes nothing, rather
      // than contributing zero out of one, which would drag the ratio down.
      expect(free.levels.first.maxScore, 0);
      expect(free.maxScore, 0);
    });

    test('an unknown mode degrades instead of throwing', () {
      final pack = GamePack.fromJson(
        packJson(
          levels: [
            {
              'level': 1,
              'mode': 'holographic_sculpting',
              'scoring': 'none',
              'prompt_key': 'game.x.prompt',
              'completion': {'rule': 'child_taps_done'},
            },
          ],
        ),
      );
      expect(pack.levels.first.mode, DrawingMode.unknown);
    });

    test('a pack with no levels is rejected loudly', () {
      expect(
        () => GamePack.fromJson({...packJson(), 'levels': <dynamic>[]}),
        throwsA(isA<GamePackParseException>()),
      );
    });

    test('accessibility defaults match the contract when fields are absent', () {
      final pack = GamePack.fromJson({...packJson(), 'accessibility': null});
      // The schema pins the tap alternative to true, so a missing field must not
      // silently disable the mandatory alternative.
      expect(pack.accessibility.sequentialTapAlternative, isTrue);
      expect(pack.accessibility.simplifiedMotor.toleranceDp, 40);
    });

    test('creation-producing packs are identifiable', () {
      expect(GamePack.fromJson(packJson()).producesCreations, isTrue);
    });
  });

  group('stroke order', () {
    test('the dot is locked until the body is complete', () {
      // This is the measured criterion of lang.letters.trace_form. Rendering the
      // order without enforcing it would teach nothing.
      final pack = GamePack.fromJson(packJson());
      final session = sessionFor(pack);
      final body = pack.levels.first.strokes[0];
      final dot = pack.levels.first.strokes[1];

      expect(session.activeStroke!.id, 's1');
      expect(session.acceptsInput(dot), isFalse);
      expect(session.acceptsInput(body), isTrue);

      expect(drag(session, body, traceBody(400)), isTrue);

      expect(session.activeStroke!.id, 's2');
      expect(session.acceptsInput(dot), isTrue);
    });

    test('tapping the dot before the body does nothing', () {
      final pack = GamePack.fromJson(packJson());
      final session = sessionFor(pack);
      final completed = session.tap(dotAt(400));
      expect(completed, isFalse);
      expect(session.levelComplete, isFalse);
    });

    test('the level completes once body then dot are done', () {
      final pack = GamePack.fromJson(packJson());
      final session = sessionFor(pack);
      final body = pack.levels.first.strokes[0];

      drag(session, body, traceBody(400));
      expect(session.tap(dotAt(400)), isTrue);

      expect(session.levelComplete, isTrue);
      expect(session.score, 2);
    });

    test('unordered levels accept any incomplete stroke', () {
      final pack = GamePack.fromJson(
        packJson(
          levels: [
            {
              'level': 1,
              'mode': 'shape',
              'scoring': 'geometric',
              'prompt_key': 'game.shape.prompt',
              'completion': {'rule': 'all_strokes_complete'},
              'tolerance_dp': 24,
              'coverage_required': 0.8,
              'stroke_paths': [
                {
                  'id': 's1',
                  'order': 1,
                  'type': 'stroke',
                  'points': [
                    [0.1, 0.1],
                    [0.9, 0.1],
                  ],
                },
                {
                  'id': 's2',
                  'order': 2,
                  'type': 'stroke',
                  'points': [
                    [0.1, 0.9],
                    [0.9, 0.9],
                  ],
                },
              ],
            },
          ],
        ),
      );
      final session = sessionFor(pack);
      expect(session.level.scoring.enforcesOrder, isFalse);
      expect(session.acceptsInput(pack.levels.first.strokes[1]), isTrue);
    });
  });

  group('never fails the child', () {
    test('coverage accumulates across lifted fingers', () {
      // "لا إعادة من البداية": tracing part, lifting, then tracing the rest has
      // traced the whole stroke. A 400px canvas keeps the authored 24dp
      // tolerance meaningful; on a tiny canvas the whole glyph fits inside it.
      final pack = GamePack.fromJson(packJson());
      final session = sessionFor(pack, canvas: 400);
      final body = pack.levels.first.strokes[0];
      final all = traceBody(400);
      final firstPart = all.take(all.length ~/ 3).toList();
      final rest = all.skip(all.length ~/ 3).toList();

      expect(
        drag(session, body, firstPart),
        isFalse,
        reason: 'a third of the stroke must not reach 80% coverage',
      );
      final partial = session.strokeStates.first.coverage;
      expect(partial, greaterThan(0));
      expect(partial, lessThan(0.8));

      expect(
        drag(session, body, rest),
        isTrue,
        reason: 'progress from the first attempt must be retained',
      );
    });

    test('stalling escalates help rather than failing', () {
      final pack = GamePack.fromJson(packJson());
      final session = sessionFor(pack);
      final body = pack.levels.first.strokes[0];

      for (var attempt = 0; attempt < 2; attempt++) {
        drag(session, body, const [Offset2D(0, 0), Offset2D(1, 0)]);
      }
      expect(session.stalls, 2);
      expect(session.helpLevel, TraceHelpLevel.directionArrow);
      // No failure state exists to assert against; the level simply is not done.
      expect(session.levelComplete, isFalse);
    });

    test('the third stall widens tolerance and re-scores what was drawn', () {
      // A child should not have to trace again at the easier setting: the
      // attempt they just made is re-evaluated against the wider tolerance.
      final pack = GamePack.fromJson(
        packJson(
          levels: [
            {
              'level': 1,
              'mode': 'path',
              'scoring': 'geometric',
              'prompt_key': 'game.path.prompt',
              'completion': {'rule': 'all_strokes_complete'},
              'tolerance_dp': 16,
              'coverage_required': 0.8,
              'stroke_paths': [
                {
                  'id': 's1',
                  'order': 1,
                  'type': 'stroke',
                  'points': [
                    [0.0, 0.5],
                    [1.0, 0.5],
                  ],
                },
              ],
            },
          ],
        ),
      );
      final session = sessionFor(pack, canvas: 100);
      final stroke = pack.levels.first.strokes.first;
      // 20px off the path: outside 16dp, inside the widened 24dp.
      List<Offset2D> offsetTrace() =>
          List.generate(60, (i) => Offset2D(i * 100 / 59, 50 + 20));

      for (var attempt = 0; attempt < 3; attempt++) {
        if (drag(session, stroke, offsetTrace())) break;
      }
      expect(session.levelComplete, isTrue);
      expect(
        session.usedAssistance,
        isTrue,
        reason: 'succeeding only after widening must be recorded as assisted',
      );
    });

    test(
      'simplified motor mode completes a trace that normal mode would not',
      () {
        Map<String, dynamic> strictLevel() => {
          'level': 1,
          'mode': 'path',
          'scoring': 'geometric',
          'prompt_key': 'game.path.prompt',
          'completion': {'rule': 'all_strokes_complete'},
          'tolerance_dp': 16,
          'coverage_required': 0.9,
          'stroke_paths': [
            {
              'id': 's1',
              'order': 1,
              'type': 'stroke',
              'points': [
                [0.0, 0.5],
                [1.0, 0.5],
              ],
            },
          ],
        };
        // Sloppy trace: drifts 25px away, and only covers part of the path.
        List<Offset2D> sloppy() =>
            List.generate(40, (i) => Offset2D(i * 70 / 39, 50 + 25));

        final normal = sessionFor(
          GamePack.fromJson(packJson(levels: [strictLevel()])),
          canvas: 100,
        );
        drag(normal, normal.level.strokes.first, sloppy());
        expect(normal.levelComplete, isFalse);

        final simplified = sessionFor(
          GamePack.fromJson(packJson(levels: [strictLevel()])),
          simplified: true,
          canvas: 100,
        );
        drag(simplified, simplified.level.strokes.first, sloppy());
        expect(simplified.activeTolerance.toleranceDp, 40);
        expect(simplified.activeTolerance.coverageRequired, 0.6);
        expect(
          simplified.levelComplete,
          isTrue,
          reason:
              'the mandatory accessible mode must actually let a child finish',
        );
      },
    );
  });

  group('sequential tap alternative', () {
    test('tapping along the path completes a stroke without dragging', () {
      // Mandatory substitute for continuous drag. Without it, children who
      // cannot drag are excluded from the engine built for motor skills.
      final pack = GamePack.fromJson(
        packJson(
          levels: [
            {
              'level': 1,
              'mode': 'path',
              'scoring': 'geometric',
              'prompt_key': 'game.path.prompt',
              'completion': {'rule': 'all_strokes_complete'},
              'tolerance_dp': 40,
              'coverage_required': 0.8,
              'stroke_paths': [
                {
                  'id': 's1',
                  'order': 1,
                  'type': 'stroke',
                  'points': [
                    [0.0, 0.5],
                    [1.0, 0.5],
                  ],
                },
              ],
            },
          ],
        ),
      );
      final session = sessionFor(pack, canvas: 100);
      var completed = false;
      for (var x = 0; x <= 100 && !completed; x += 10) {
        completed = session.tap(Offset2D(x.toDouble(), 50));
      }
      expect(completed, isTrue);
    });
  });

  group('metrics reported to the server', () {
    test('carry coverage and deviation but no coordinates', () {
      final pack = GamePack.fromJson(packJson());
      final session = sessionFor(pack);
      drag(session, pack.levels.first.strokes[0], traceBody(400));

      final json = session.metrics().first.toJson();
      expect(json.keys.toSet(), {
        'stroke',
        'coverage',
        'deviation_dp',
        'completed',
        'help_level',
      });
      // A child's hand movement has no analytical value once coverage and
      // deviation are known, so the path itself never leaves the device.
      expect(json.toString(), isNot(contains('points')));
      expect(json['coverage'], isA<double>());
    });
  });

  group('undo and clear', () {
    test('undo removes the last completed stroke', () {
      final pack = GamePack.fromJson(packJson());
      final session = sessionFor(pack);
      drag(session, pack.levels.first.strokes[0], traceBody(400));
      expect(session.strokeStates.first.status, StrokeStatus.complete);

      session.undo();
      expect(session.strokeStates.first.status, StrokeStatus.active);
    });

    test('clear resets the level', () {
      final pack = GamePack.fromJson(packJson());
      final session = sessionFor(pack);
      drag(session, pack.levels.first.strokes[0], traceBody(400));
      session.clear();
      expect(session.levelComplete, isFalse);
      expect(session.score, 0);
    });
  });

  group('GameEngineRegistry', () {
    final registry = GameEngineRegistry([
      const _StubEngine('trace_color'),
      const _StubEngine('memory_flip', supportsDpad: true),
    ]);

    test('resolves a known engine and returns null for an unknown one', () {
      expect(registry.resolve('trace_color'), isNotNull);
      expect(registry.resolve('block_code'), isNull);
      expect(registry.supports('memory_flip'), isTrue);
    });

    test('an unknown engine is unavailable rather than a crash', () {
      // The CMS can publish an engine faster than app stores ship one.
      final availability = evaluateAvailability(
        registry: registry,
        engineId: 'sim_lab',
        pack: GamePack.fromJson(packJson()),
        requiredEngineVersion: 1,
        supportedEngineVersion: 1,
        supportedPackVersion: 1,
        isTelevision: false,
      );
      expect(availability.isAvailable, isFalse);
      expect(availability.reason, GameUnavailableReason.unsupportedEngine);
      expect(availability.detail, 'sim_lab');
    });

    test('touch-only content is hidden on television', () {
      final availability = evaluateAvailability(
        registry: registry,
        engineId: 'trace_color',
        pack: GamePack.fromJson(packJson()),
        requiredEngineVersion: 1,
        supportedEngineVersion: 1,
        supportedPackVersion: 1,
        isTelevision: true,
      );
      expect(availability.reason, GameUnavailableReason.requiresTouch);
      expect(
        registry.playableOnTelevision('trace_color', packSupportsDpad: false),
        isFalse,
      );
    });

    test('a pack from a newer engine version is refused', () {
      final availability = evaluateAvailability(
        registry: registry,
        engineId: 'trace_color',
        pack: GamePack.fromJson({...packJson(), 'pack_version': 2}),
        requiredEngineVersion: 1,
        supportedEngineVersion: 1,
        supportedPackVersion: 1,
        isTelevision: false,
      );
      expect(availability.reason, GameUnavailableReason.unsupportedPackVersion);
    });

    test('a malformed pack is unavailable, not fatal', () {
      final availability = evaluateAvailability(
        registry: registry,
        engineId: 'trace_color',
        pack: null,
        requiredEngineVersion: 1,
        supportedEngineVersion: 1,
        supportedPackVersion: 1,
        isTelevision: false,
      );
      expect(availability.reason, GameUnavailableReason.malformedPack);
    });
  });

  group('touch targets', () {
    test('a pack cannot request a target below the platform floor', () {
      final pack = GamePack.fromJson({
        ...packJson(),
        'accessibility': {
          'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
          'sequential_tap_alternative': true,
          'min_touch_target_dp': 20,
        },
      });
      expect(effectiveTouchTarget(pack.accessibility), 48);
    });

    test('a larger request is honoured', () {
      final pack = GamePack.fromJson({
        ...packJson(),
        'accessibility': {
          'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
          'sequential_tap_alternative': true,
          'min_touch_target_dp': 64,
        },
      });
      expect(effectiveTouchTarget(pack.accessibility), 64);
    });
  });
}
