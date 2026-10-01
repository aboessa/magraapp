/// Tests for the seven engines added after Wave 1, and for the invariant that ties
/// the registry to the documented engine set.
///
/// The emphasis is on the rules each contract calls out as non-negotiable, because
/// those are the ones a refactor is most likely to quietly break:
///
/// * `count_quantity` — a wrong answer teaches instead of rejecting, and the
///   numeral system is presentation only.
/// * `logic_pattern` — an unexplained correct answer cannot reach mastery.
/// * `word_build` — the letter renders in its in-word form, and the written-word
///   button exists.
/// * `rhythm_tap` — there is no failure state, ever.
/// * `block_code` — the interpreter's semantics, and no RTL mirroring.
/// * `sim_lab` — a wrong prediction is never deducted, and a `none` variable has
///   no effect.
/// * `timeline_map` — years are stored Gregorian, the map is never mirrored.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/engine/block_code_engine.dart';
import 'package:majarra/features/games/engine/game_board_kit.dart';
import 'package:majarra/features/games/engine/game_pack.dart';
import 'package:majarra/features/games/engine/game_services.dart';
import 'package:majarra/features/games/engine/game_session_controller.dart';
import 'package:majarra/features/games/engine/rhythm_tap_engine.dart';
import 'package:majarra/features/games/engine/sim_lab_engine.dart';
import 'package:majarra/features/games/engine/timeline_map_engine.dart';
import 'package:majarra/features/games/engine/wave_two_engines.dart';
import 'package:majarra/features/games/presentation/pages/game_screen.dart';
import 'package:majarra/features/games/presentation/widgets/drawing_asset.dart';

/// A minimal pack wrapper around one authored level.
Map<String, dynamic> packWith(
  String engineId,
  Map<String, dynamic> level, {
  bool supportsDpad = true,
}) {
  return {
    'pack_version': 1,
    'engine_id': engineId,
    'pack_id': 'test-$engineId',
    'supports_dpad': supportsDpad,
    'progression': {'levels_to_finish': 1, 'advance_on': 'level_complete'},
    'accessibility': {
      'min_touch_target_dp': 64,
      'sequential_tap_alternative': true,
      'reduced_motion_supported': true,
      'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
    },
    'voice_manifest': const <String, String>{},
    'levels': [level],
  };
}

({
  GameSessionController controller,
  RecordingAttemptReporter reporter,
  SilentGameAudioService audio,
})
session(
  Map<String, dynamic> packJson, {
  String gameId = 'game-test',
  GameAccessibilitySettings settings = const GameAccessibilitySettings(),
}) {
  final reporter = RecordingAttemptReporter();
  final audio = SilentGameAudioService();
  var counter = 0;
  final controller = GameSessionController(
    pack: GamePack.fromJson(packJson),
    gameId: gameId,
    childId: 'child-test',
    ageTrack: AgeTrack.kids,
    audio: audio,
    reporter: reporter,
    eventIdFactory: () => 'event-${counter++}',
    settings: settings,
  );
  return (controller: controller, reporter: reporter, audio: audio);
}

Future<void> pumpEngine(
  WidgetTester tester,
  Widget Function(BuildContext) build,
) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(body: Builder(builder: build)),
      ),
    ),
  );
  await tester.pump();
}

bool primaryFocusIsWithin(Finder finder) {
  final focusContext = FocusManager.instance.primaryFocus?.context;
  if (focusContext is! Element) return false;

  final targets = finder.evaluate().toSet();
  if (targets.contains(focusContext)) return true;

  var found = false;
  focusContext.visitAncestorElements((ancestor) {
    found = targets.contains(ancestor);
    return !found;
  });
  if (found) return true;

  for (final target in targets) {
    target.visitAncestorElements((ancestor) {
      found = ancestor == focusContext;
      return !found;
    });
    if (found) return true;
  }
  return false;
}

Future<void> tabTo(WidgetTester tester, Finder finder) async {
  for (var index = 0; index < 30; index++) {
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    if (primaryFocusIsWithin(finder)) return;
  }
  fail('Could not focus ${finder.description} with Tab.');
}

void main() {
  // ------------------------------------------------------------ engine matrix

  group('engine matrix', () {
    test('every documented engine is registered, and nothing extra is', () {
      // The docs directory is the canonical list. Deriving the expectation from it
      // rather than hard-coding twelve ids means a thirteenth spec cannot be added
      // without this failing, and an engine cannot be registered without a spec.
      final dir = Directory('../docs/games/engines');
      expect(dir.existsSync(), isTrue, reason: 'engine specs must be present');

      final documented = dir
          .listSync()
          .whereType<File>()
          .map((f) => f.uri.pathSegments.last)
          .where((name) => name.endsWith('.md'))
          // `05-count-quantity.md` -> `count_quantity`
          .map(
            (name) =>
                name.replaceFirst(RegExp(r'^\d+-'), '').replaceAll('.md', ''),
          )
          .map((name) => name.replaceAll('-', '_'))
          .toSet();

      final registered = buildDefaultRegistry().engineIds.toSet();
      expect(registered, equals(documented));
    });

    testWidgets(
      'every registered engine declares D-pad support and rhythm stays accessible',
      (tester) async {
        final registry = buildDefaultRegistry();
        // trace_color is the only engine that needs a pointer.
        expect(
          registry.playableOnTelevision('trace_color', packSupportsDpad: true),
          isFalse,
        );
        for (final id in registry.engineIds.where(
          (id) => id != 'trace_color',
        )) {
          expect(
            registry.playableOnTelevision(id, packSupportsDpad: true),
            isTrue,
            reason: '$id declares supports_dpad in its contract',
          );
        }

        final s = session(
          packWith('rhythm_tap', {
            'level': 1,
            'track': 'asset-existing-track',
            'track_duration_ms': 5000,
            'lanes': 2,
            'hit_window_ms': 450,
            'accuracy_to_pass': 0.5,
            'notes': [
              {'time_ms': 1000, 'lane': 0},
              {'time_ms': 2000, 'lane': 1},
            ],
            'visual_pulse': true,
            'never_fail': true,
          }),
          gameId: 'game-wave2-rhythm',
        );
        await tester.pumpWidget(
          MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: TextScaler.linear(2),
                disableAnimations: true,
              ),
              child: child!,
            ),
            home: Directionality(
              textDirection: TextDirection.rtl,
              child: Scaffold(
                body: Builder(
                  builder: (context) =>
                      const RhythmTapEngine().build(context, s.controller),
                ),
              ),
            ),
          ),
        );
        await tester.pump();

        final stageImages = tester
            .widgetList<Image>(find.byType(Image))
            .map((image) => image.image)
            .whereType<AssetImage>()
            .map((image) => image.assetName);
        expect(
          stageImages,
          contains(endsWith('wave2-rhythm/stage-background.webp')),
        );
        expect(find.byKey(const Key('rhythm_stage_art')), findsOneWidget);
        expect(
          Directionality.of(
            tester.element(find.byKey(const ValueKey('rhythm_lane_0'))),
          ),
          TextDirection.ltr,
        );
        expect(
          tester
              .widget<AnimatedContainer>(
                find.byKey(const ValueKey('rhythm_lane_glow_0')),
              )
              .duration,
          Duration.zero,
        );
        final lane = find.byKey(const ValueKey('rhythm_lane_0'));
        await tabTo(tester, lane);
        expect(primaryFocusIsWithin(lane), isTrue);
        expect(tester.takeException(), isNull);
      },
    );
  });

  // ---------------------------------------------------------- count_quantity

  group('count_quantity', () {
    Map<String, dynamic> level({String mode = 'count_and_pick'}) => {
      'level': 1,
      'mode': mode,
      'scoring': 'discrete',
      'range': [1, 5],
      'numeral_system': 'arabic_indic',
      'count_aloud_on_error': true,
      'allow_recount_button': true,
      'items': [
        {
          'id': 'q1',
          'items': [
            {'image': 'asset-star', 'count': 3},
          ],
          'question_key': 'count.how_many',
          'options': [2, 3, 4],
          'answer': 3,
        },
        {
          'id': 'q2',
          'items': [
            {'image': 'asset-star', 'count': 5},
          ],
          'question_key': 'count.how_many',
          'options': [4, 5, 6],
          'answer': 5,
        },
      ],
    };

    testWidgets('all items right on the first try scores full marks', (
      tester,
    ) async {
      final s = session(packWith('count_quantity', level()));
      await pumpEngine(
        tester,
        (context) => const CountQuantityEngine().build(context, s.controller),
      );

      // Arabic-Indic digits are what is rendered, and the value stays numeric.
      expect(find.text('٣'), findsWidgets);

      await tester.tap(find.byKey(const ValueKey('count_option_3')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('count_option_5')));
      await tester.pumpAndSettle();

      expect(s.reporter.attempts, hasLength(1));
      expect(s.reporter.attempts.single.score, 2);
      expect(s.reporter.attempts.single.maxScore, 2);
      expect(s.reporter.attempts.single.helpUsed, isFalse);
    });

    testWidgets('a wrong answer counts aloud instead of rejecting', (
      tester,
    ) async {
      final s = session(packWith('count_quantity', level()));
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) =>
                  const CountQuantityEngine().build(context, s.controller),
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const ValueKey('count_option_2')));
      await tester.pumpAndSettle();

      // The first rung counts every element aloud, as separate clips.
      expect(s.audio.played, contains('vo.count.1'));
      expect(s.audio.played, contains('vo.count.3'));
      // Nothing negative was said. There is no such key in this engine at all.
      expect(s.audio.played.any((k) => k.contains('wrong')), isFalse);
      // And the item is still answerable.
      expect(find.byKey(const ValueKey('count_option_3')), findsOneWidget);
    });

    testWidgets('the recount button is present before any mistake', (
      tester,
    ) async {
      final s = session(packWith('count_quantity', level(mode: 'drag_amount')));
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) =>
                  const CountQuantityEngine().build(context, s.controller),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.byKey(const Key('count_recount_button')), findsOneWidget);

      final source = find.byKey(const ValueKey('drag_source_0'));
      final sourceSemantics = tester.widget<Semantics>(
        find.ancestor(of: source, matching: find.byType(Semantics)).first,
      );
      expect(sourceSemantics.properties.button, isTrue);
      expect(sourceSemantics.properties.label, 'نجمة رقم ١');
      await tabTo(tester, source);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();

      final boxSemantics = tester.widget<Semantics>(
        find.byWidgetPredicate(
          (widget) =>
              widget is Semantics &&
              widget.properties.label == 'عدد العناصر في الصندوق',
        ),
      );
      expect(boxSemantics.properties.liveRegion, isTrue);
      expect(boxSemantics.properties.value, '١');
      final recountSize = tester.getSize(
        find.byKey(const Key('count_recount_button')),
      );
      expect(recountSize.width, greaterThanOrEqualTo(64));
      expect(recountSize.height, greaterThanOrEqualTo(64));

      final empty = session(
        packWith('count_quantity', {'level': 1, 'items': const []}),
      );
      await pumpEngine(
        tester,
        (context) =>
            const CountQuantityEngine().build(context, empty.controller),
      );
      expect(find.byType(GameStatePanel), findsOneWidget);
      expect(
        find.text('لا توجد عناصر للعد هنا. جرّب مستوى آخر.'),
        findsOneWidget,
      );
    });

    test('numeral formatting is display only', () {
      expect(formatNumeral(7, 'arabic_indic'), '٧');
      expect(formatNumeral(7, 'western'), '7');
      expect(formatNumeral(12, 'arabic_indic'), '١٢');
      // `auto` follows the interface language.
      expect(formatNumeral(3, 'auto', languageCode: 'en'), '3');
      expect(formatNumeral(3, 'auto', languageCode: 'ar'), '٣');
    });
  });

  // ----------------------------------------------------------- logic_pattern

  group('logic_pattern', () {
    Map<String, dynamic> matrixLevel() => {
      'level': 4,
      'mode': 'matrix_3x3',
      'scoring': 'discrete',
      'grid': [
        ['asset-a1', 'asset-a2', 'asset-a3'],
        ['asset-b1', 'asset-b2', 'asset-b3'],
        ['asset-c1', 'asset-c2', null],
      ],
      'options': ['asset-c3', 'asset-x1', 'asset-x2', 'asset-x3', 'asset-x4'],
      'answer': 'asset-c3',
      'rule_key': 'rule.rotate_and_shift',
      'changing_dimensions': ['rotation', 'color'],
      'require_explanation': true,
      'explain_options': [
        'rule.rotate_and_shift',
        'rule.mirror_only',
        'rule.color_only',
      ],
      'explain_answer': 'rule.rotate_and_shift',
    };

    testWidgets('a correct answer without the explanation cannot reach mastery', (
      tester,
    ) async {
      final s = session(packWith('logic_pattern', matrixLevel()));
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) =>
                  const LogicPatternEngine().build(context, s.controller),
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const ValueKey('logic_option_asset-c3')));
      await tester.pumpAndSettle();
      // Wrong rule chosen.
      await tester.tap(
        find.byKey(const ValueKey('logic_explain_rule.mirror_only')),
      );
      await tester.pumpAndSettle();

      final attempt = s.reporter.attempts.single;
      expect(attempt.score, 1);
      expect(attempt.maxScore, 2);
      // 50% cannot reach the 80% the mastery ladder requires for `independent`,
      // which is how the contract's rule is enforced without a special case.
      expect(attempt.score / attempt.maxScore, lessThan(0.8));
    });

    testWidgets('answer and explanation together score both marks', (
      tester,
    ) async {
      final s = session(packWith('logic_pattern', matrixLevel()));
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) =>
                  const LogicPatternEngine().build(context, s.controller),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('logic_option_asset-c3')));
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(const ValueKey('logic_explain_rule.rotate_and_shift')),
      );
      await tester.pumpAndSettle();

      expect(s.reporter.attempts.single.score, 2);
      expect(s.reporter.attempts.single.maxScore, 2);
    });

    testWidgets('hints point at the rule, and the answer is never eliminated', (
      tester,
    ) async {
      final s = session(packWith('logic_pattern', matrixLevel()));
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) =>
                  const LogicPatternEngine().build(context, s.controller),
            ),
          ),
        ),
      );
      await tester.pump();

      for (var i = 0; i < 3; i++) {
        await tester.tap(find.byKey(const ValueKey('logic_option_asset-x1')));
        await tester.pumpAndSettle();
      }
      // The rule is what gets explained, and the correct option is still offered.
      expect(s.audio.played, contains('vo.hint_2'));
      expect(
        find.byKey(const ValueKey('logic_option_asset-c3')),
        findsOneWidget,
      );
    });

    testWidgets('every cell carries a text alternative', (tester) async {
      final s = session(packWith('logic_pattern', matrixLevel()));
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) =>
                  const LogicPatternEngine().build(context, s.controller),
            ),
          ),
        ),
      );
      await tester.pump();

      // Asserted on the declared label rather than the merged semantics tree: the
      // cell also renders the id as text, so the composed node label is not a
      // stable thing to match on, while the declaration is exactly the contract
      // item ("وصف بديل لكل خلية").
      Finder labelled(String label) => find.byWidgetPredicate(
        (widget) => widget is Semantics && widget.properties.label == label,
      );

      // Colour is never the only channel: a stable glyph and a child-safe
      // ordinal label accompany each unresolved cell; raw asset ids stay hidden.
      expect(labelled('الشكل ١'), findsOneWidget);
      expect(labelled('الشكل ٨'), findsOneWidget);
      expect(labelled('الخلية الناقصة'), findsOneWidget);
    });
  });

  // -------------------------------------------------------------- word_build

  group('word_build', () {
    Map<String, dynamic> arabicLevel() => {
      'level': 3,
      'mode': 'letter',
      'scoring': 'discrete',
      'language': 'ar',
      'word': 'قمر',
      'word_audio': 'asset-vo-word-qamar',
      'word_image': 'asset-moon',
      'writing_direction': 'rtl',
      'slots': 3,
      'letters': [
        {
          'char': 'ق',
          'form': 'initial',
          'position': 1,
          'audio': 'asset-vo-qaf',
        },
        {
          'char': 'م',
          'form': 'medial',
          'position': 2,
          'audio': 'asset-vo-meem',
        },
        {'char': 'ر', 'form': 'final', 'position': 3, 'audio': 'asset-vo-ra'},
      ],
      'distractors': [
        {'char': 'ن', 'form': 'isolated', 'audio': 'asset-vo-noon'},
      ],
      'show_word_text_button': true,
    };

    test('a letter renders in its in-word form, not isolated', () {
      // Ignoring `form` would teach the wrong shape, which the contract calls out.
      expect(arabicFormGlyph('ق', 'initial'), 'ق\u200D');
      expect(arabicFormGlyph('م', 'medial'), '\u200Dم\u200D');
      expect(arabicFormGlyph('ر', 'final'), '\u200Dر');
      expect(arabicFormGlyph('ن', 'isolated'), 'ن');
      expect(arabicFormGlyph('ن', null), 'ن');
    });

    testWidgets('the written-word button is always available', (tester) async {
      final s = session(packWith('word_build', arabicLevel()));
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) =>
                  const WordBuildEngine().build(context, s.controller),
            ),
          ),
        ),
      );
      await tester.pump();

      // Mandatory: it is what makes the game playable without hearing.
      expect(find.byKey(const Key('word_show_text_button')), findsOneWidget);
      expect(find.byKey(const Key('word_text_reveal')), findsNothing);
      await tester.tap(find.byKey(const Key('word_show_text_button')));
      await tester.pump();
      expect(find.byKey(const Key('word_text_reveal')), findsOneWidget);
    });

    testWidgets(
      'tapping a letter then a slot places it, and the word completes',
      (tester) async {
        final s = session(packWith('word_build', arabicLevel()));
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) =>
                    const WordBuildEngine().build(context, s.controller),
              ),
            ),
          ),
        );
        await tester.pump();

        for (final entry in [('ق', 1, 0), ('م', 2, 1), ('ر', 3, 2)]) {
          await tester.tap(
            find.byKey(ValueKey('word_tile_${entry.$1}_${entry.$2}')),
          );
          await tester.pumpAndSettle();
          await tester.tap(find.byKey(ValueKey('word_slot_${entry.$3}')));
          await tester.pumpAndSettle();
        }

        final attempt = s.reporter.attempts.single;
        expect(attempt.score, 1);
        expect(attempt.maxScore, 1);
        // The word itself is never in the payload.
        expect(attempt.answers.single.containsKey('word'), isFalse);
        expect(attempt.answers.single['word_length'], 3);
      },
    );

    testWidgets('a wrong letter bounces back without punishment', (
      tester,
    ) async {
      final s = session(packWith('word_build', arabicLevel()));
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) =>
                  const WordBuildEngine().build(context, s.controller),
            ),
          ),
        ),
      );
      await tester.pump();

      // The distractor cannot occupy a slot, and the tile returns to the tray.
      await tester.tap(find.byKey(const ValueKey('word_tile_ن_null')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('word_slot_0')));
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('word_tile_ن_null')), findsOneWidget);
      expect(s.reporter.attempts, isEmpty);
    });
  });

  // ------------------------------------------------------------- block_code

  group('block_code interpreter', () {
    BlockGrid grid() => BlockGrid.fromJson(const {
      'w': 4,
      'h': 4,
      'walls': [
        [2, 0],
      ],
      'start': [0, 0],
      'facing': 'east',
      'goal': [3, 0],
      'collectibles': [
        [1, 0],
      ],
    });

    test('move advances one cell in the facing direction', () {
      final trace = BlockInterpreter(
        grid: grid(),
      ).run(BlockProgram.fromTokens(['move']));
      expect(trace.last.x, 1);
      expect(trace.last.y, 0);
    });

    test('a wall stops Robo and marks the causing block', () {
      final trace = BlockInterpreter(
        grid: grid(),
      ).run(BlockProgram.fromTokens(['move', 'move']));
      expect(trace.last.collided, isTrue);
      // Stopped before the wall at x=2, on the second block.
      expect(trace.last.x, 1);
      expect(trace.last.blockIndex, 1);
    });

    test('repeat:n repeats the block that follows it', () {
      final open = BlockGrid.fromJson(const {
        'w': 5,
        'h': 2,
        'start': [0, 0],
        'facing': 'east',
        'goal': [3, 0],
      });
      final trace = BlockInterpreter(
        grid: open,
      ).run(BlockProgram.fromTokens(['repeat:3', 'move']));
      expect(trace.last.x, 3);
    });

    test('if_path guards the next block only', () {
      // Facing a wall: the guarded move must not run, and what follows must.
      final g = BlockGrid.fromJson(const {
        'w': 4,
        'h': 2,
        'walls': [
          [1, 0],
        ],
        'start': [0, 0],
        'facing': 'east',
        'goal': [0, 1],
      });
      final trace = BlockInterpreter(
        grid: g,
      ).run(BlockProgram.fromTokens(['if_path', 'move', 'turn_right']));
      expect(trace.last.collided, isFalse);
      expect(trace.last.x, 0);
      expect(trace.last.facing, Facing.south);
    });

    test('collect only picks up what is on the current cell', () {
      final interpreter = BlockInterpreter(grid: grid());
      final missed = interpreter.run(BlockProgram.fromTokens(['collect']));
      expect(missed.last.collected, isEmpty);
      final got = interpreter.run(BlockProgram.fromTokens(['move', 'collect']));
      expect(got.last.collected, hasLength(1));
    });

    test('reaching the goal without the collectible is not a win', () {
      final g = BlockGrid.fromJson(const {
        'w': 4,
        'h': 2,
        'start': [0, 0],
        'facing': 'east',
        'goal': [3, 0],
        'collectibles': [
          [1, 0],
        ],
      });
      final open = BlockInterpreter(grid: g);
      final skipped = open.run(BlockProgram.fromTokens(['repeat:3', 'move']));
      expect(skipped.last.x, 3);
      expect(open.reachedGoal(skipped.last), isFalse);

      final complete = open.run(
        BlockProgram.fromTokens(['move', 'collect', 'move', 'move']),
      );
      expect(open.reachedGoal(complete.last), isTrue);
    });

    test('a collision is never a win, even standing on the goal', () {
      final g = BlockGrid.fromJson(const {
        'w': 3,
        'h': 2,
        'walls': [
          [2, 0],
        ],
        'start': [0, 0],
        'facing': 'east',
        'goal': [1, 0],
      });
      final interpreter = BlockInterpreter(grid: g);
      final trace = interpreter.run(BlockProgram.fromTokens(['move', 'move']));
      expect(trace.last.x, 1, reason: 'stopped on the goal cell');
      expect(trace.last.collided, isTrue);
      expect(interpreter.reachedGoal(trace.last), isFalse);
    });

    test('the function strip runs where the function block is', () {
      final g = BlockGrid.fromJson(const {
        'w': 5,
        'h': 2,
        'start': [0, 0],
        'facing': 'east',
        'goal': [2, 0],
      });
      final trace = BlockInterpreter(grid: g).run(
        BlockProgram(
          main: const [ProgramBlock(BlockKind.function)],
          function: const [
            ProgramBlock(BlockKind.move),
            ProgramBlock(BlockKind.move),
          ],
        ),
      );
      expect(trace.last.x, 2);
    });

    test('block count treats repeat as one block', () {
      final program = BlockProgram.fromTokens(['repeat:5', 'move']);
      expect(program.blockCount, 2);
    });

    testWidgets(
      'block maze pilot keeps LTR geometry and accessible art at 2x',
      (tester) async {
        tester.view.physicalSize = const Size(1000, 1600);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        final s = session(
          packWith('block_code', {
            'level': 1,
            'prompt': 'أوصل روبو إلى الهدف',
            'grid': {
              'w': 4,
              'h': 4,
              'walls': [
                [1, 1],
              ],
              'start': [0, 0],
              'facing': 'east',
              'goal': [3, 3],
              'collectibles': [
                [2, 2],
              ],
            },
            'allowed_blocks': ['move', 'turn_left', 'turn_right', 'collect'],
            'block_limit': 8,
            'optimal_blocks': 6,
            'step_delay_ms': 500,
            'reference_solution': ['move'],
          }),
          gameId: 'game-block-maze-3',
          settings: const GameAccessibilitySettings(reduceMotion: true),
        );
        await tester.pumpWidget(
          MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: TextScaler.linear(2),
                disableAnimations: true,
              ),
              child: child!,
            ),
            home: Directionality(
              textDirection: TextDirection.rtl,
              child: Scaffold(
                body: Builder(
                  builder: (context) =>
                      const BlockCodeEngine().build(context, s.controller),
                ),
              ),
            ),
          ),
        );
        await tester.pump();

        expect(find.byType(DrawingAsset), findsNWidgets(3));
        Finder semanticsLabel(String label) => find.byWidgetPredicate(
          (widget) => widget is Semantics && widget.properties.label == label,
        );
        expect(semanticsLabel('روبو'), findsOneWidget);
        expect(semanticsLabel('عائق'), findsOneWidget);
        expect(semanticsLabel('الهدف'), findsOneWidget);
        expect(
          tester.getTopLeft(find.byKey(const ValueKey('block_cell_0_0'))).dx,
          lessThan(
            tester.getTopLeft(find.byKey(const ValueKey('block_cell_1_0'))).dx,
          ),
        );
        expect(
          Directionality.of(
            tester.element(find.byKey(const ValueKey('block_cell_0_0'))),
          ),
          TextDirection.ltr,
        );
        final move = find.byKey(const ValueKey('block_palette_move'));
        final turnLeft = find.byKey(const ValueKey('block_palette_turn_left'));
        await tabTo(tester, move);
        expect(primaryFocusIsWithin(move), isTrue);
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump();
        expect(find.byKey(const ValueKey('block_placed_0')), findsOneWidget);

        await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
        await tester.pump();
        expect(primaryFocusIsWithin(turnLeft), isTrue);
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump();
        expect(find.byKey(const ValueKey('block_placed_1')), findsOneWidget);
        expect(find.text('الأوامر: 2 من 8'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('Robo collision has semantic and non-colour visual signals', (
      tester,
    ) async {
      final s = session(
        packWith('block_code', {
          'level': 1,
          'prompt': 'جرّب تحريك روبو',
          'grid': {
            'w': 3,
            'h': 2,
            'walls': [
              [1, 0],
            ],
            'start': [0, 0],
            'facing': 'east',
            'goal': [2, 1],
            'collectibles': const <List<int>>[],
          },
          'allowed_blocks': ['move'],
          'block_limit': 2,
          'optimal_blocks': 1,
          'step_delay_ms': 500,
          'reference_solution': const <String>[],
        }),
        gameId: 'game-block-maze-3',
        settings: const GameAccessibilitySettings(reduceMotion: true),
      );
      await pumpEngine(
        tester,
        (context) => const BlockCodeEngine().build(context, s.controller),
      );

      await tester.tap(find.byKey(const ValueKey('block_palette_move')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('block_run_button')));
      await tester.pumpAndSettle();

      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is Semantics &&
              widget.properties.label == 'روبو توقف أمام عائق',
        ),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('block_collision_indicator')),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });
  });

  // ---------------------------------------------------------------- sim_lab

  group('sim_lab', () {
    final pendulum = SimModel(
      variables: [
        const SimVariable(
          id: 'length_cm',
          labelKey: 'var.length',
          min: 20,
          max: 100,
          step: 20,
          unitKey: 'unit.cm',
        ),
        const SimVariable(
          id: 'mass_g',
          labelKey: 'var.mass',
          min: 10,
          max: 50,
          step: 10,
          unitKey: 'unit.gram',
        ),
      ],
      relationships: const {'length_cm': 'positive', 'mass_g': 'none'},
    );

    test('a variable declared none has no effect at all', () {
      final light = pendulum.measure({'length_cm': 60, 'mass_g': 10});
      final heavy = pendulum.measure({'length_cm': 60, 'mass_g': 50});
      // This is the whole pedagogical point of the pendulum simulation.
      expect(light, heavy);
      expect(pendulum.affects('mass_g'), isFalse);
    });

    test('a positive variable moves the result monotonically', () {
      final short = pendulum.measure({'length_cm': 20, 'mass_g': 30});
      final long = pendulum.measure({'length_cm': 100, 'mass_g': 30});
      expect(long, greaterThan(short));
      expect(pendulum.affects('length_cm'), isTrue);
    });

    test('a saturating variable rises then flattens', () {
      final model = SimModel(
        variables: [
          const SimVariable(
            id: 'light_h',
            labelKey: 'var.light',
            min: 0,
            max: 12,
            step: 1,
            unitKey: 'unit.hour',
          ),
        ],
        relationships: const {'light_h': 'saturating'},
      );
      final low = model.measure({'light_h': 0});
      final mid = model.measure({'light_h': 4});
      final high = model.measure({'light_h': 12});
      expect(
        mid - low,
        greaterThan(high - mid),
        reason: 'growth must slow, which is what saturating means',
      );
    });

    testWidgets('a wrong prediction is recorded and never deducted', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1000, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final level = {
        'level': 4,
        'mode': 'shape',
        'scoring': 'discrete',
        'sim': 'pendulum',
        'variables': [
          {
            'id': 'length_cm',
            'label_key': 'var.length',
            'min': 20,
            'max': 100,
            'step': 20,
            'unit_key': 'unit.cm',
          },
        ],
        'measured': {
          'id': 'period_s',
          'label_key': 'var.period',
          'unit_key': 'unit.second',
        },
        'hypothesis_options': ['hyp.longer_slower', 'hyp.no_effect'],
        'expected_relationships': {'length_cm': 'positive'},
        'explanation_options': ['exp.length_only', 'exp.mass_only'],
        'explanation_answer': 'exp.length_only',
        'results_table': true,
        'min_trials_before_explain': 2,
        'supervision_level': 'none',
        'safety_note_key': null,
      };
      final s = session(
        packWith('sim_lab', level),
        gameId: 'game-wave1-sim-lab',
        settings: const GameAccessibilitySettings(reduceMotion: true),
      );
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: TextScaler.linear(2),
              disableAnimations: true,
            ),
            child: child!,
          ),
          home: Scaffold(
            body: Builder(
              builder: (context) =>
                  const SimLabEngine().build(context, s.controller),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('التوقع ١'), findsOneWidget);
      expect(find.text('التوقع ٢'), findsOneWidget);
      expect(find.textContaining('hyp.'), findsNothing);

      // The wrong hypothesis.
      await tester.tap(
        find.byKey(const ValueKey('sim_hypothesis_hyp.no_effect')),
      );
      await tester.pumpAndSettle();

      final labImages = tester
          .widgetList<Image>(find.byType(Image))
          .map((image) => image.image)
          .whereType<AssetImage>()
          .map((image) => image.assetName);
      expect(
        labImages,
        contains(endsWith('wave1-sim-lab/lab-background.webp')),
      );
      expect(labImages, contains(endsWith('wave1-sim-lab/heat-apparatus.png')));
      expect(find.byKey(const Key('sim_result_painter')), findsOneWidget);
      expect(find.textContaining('var.'), findsNothing);
      expect(find.textContaining('unit.'), findsNothing);
      expect(find.textContaining('hyp.'), findsNothing);
      for (final key in [
        const Key('sim_record_trial'),
        const Key('sim_go_explain'),
        const ValueKey('sim_minus_length_cm'),
        const ValueKey('sim_plus_length_cm'),
      ]) {
        final size = tester.getSize(find.byKey(key));
        expect(size.width, greaterThanOrEqualTo(64));
        expect(size.height, greaterThanOrEqualTo(64));
      }

      // Cannot explain before the minimum number of trials.
      await tester.tap(find.byKey(const Key('sim_go_explain')));
      await tester.pumpAndSettle();
      expect(s.audio.played, contains('vo.need_more_trials'));
      expect(
        find.byKey(const ValueKey('sim_explanation_exp.length_only')),
        findsNothing,
      );

      await tester.tap(find.byKey(const Key('sim_record_trial')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('sim_plus_length_cm')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('sim_record_trial')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('sim_go_explain')));
      await tester.pumpAndSettle();

      expect(find.text('التفسير ١'), findsOneWidget);
      expect(find.text('التفسير ٢'), findsOneWidget);
      expect(find.textContaining('exp.'), findsNothing);
      await tester.tap(
        find.byKey(const ValueKey('sim_explanation_exp.length_only')),
      );
      await tester.pumpAndSettle();

      final attempt = s.reporter.attempts.single;
      // Full marks despite the wrong prediction: the explanation is what is
      // measured, and `max_score` is 1 for the explanation alone.
      expect(attempt.score, 1);
      expect(attempt.maxScore, 1);
      expect(attempt.answers.single['prediction_recorded'], isTrue);
    });
  });

  // ----------------------------------------------------------- timeline_map

  group('timeline_map', () {
    test('the map is never mirrored and the projection is stable', () {
      final bounds = MapBounds.forRegion('middle_east_north_africa');
      final (x1, _) = bounds.project(33.31, 44.36);
      final (x2, _) = bounds.project(33.31, 20.0);
      // A smaller longitude is further left in the projection, in every locale.
      expect(x2, lessThan(x1));
    });

    test(
      'an unknown region falls back to the world rather than mis-plotting',
      () {
        expect(MapBounds.forRegion('atlantis').maxLon, MapBounds.world.maxLon);
      },
    );

    test('projection and unprojection round-trip', () {
      final bounds = MapBounds.forRegion('middle_east_north_africa');
      final (fx, fy) = bounds.project(30.0, 31.2);
      final (lat, lon) = bounds.unproject(fx, fy);
      expect(lat, closeTo(30.0, 0.001));
      expect(lon, closeTo(31.2, 0.001));
    });

    test('distance is real kilometres', () {
      // Baghdad to Cairo is roughly 1,250 km.
      final km = distanceKm(33.31, 44.36, 30.04, 31.24);
      expect(km, greaterThan(1100));
      expect(km, lessThan(1400));
    });

    test('Hijri conversion is display only and anchored on the Hijra', () {
      expect(hijriYearForGregorian(622), 1);
      expect(hijriYearForGregorian(762), closeTo(145, 2));
      // Before the Hijra there is no Hijri year to show.
      expect(hijriYearForGregorian(500), 0);
    });

    test('a year has a spoken description', () {
      expect(centuryDescription(762), 'القرن الثامن الميلادي');
      expect(centuryDescription(1), 'القرن الأول الميلادي');
      expect(centuryDescription(100), 'القرن الأول الميلادي');
      expect(centuryDescription(101), 'القرن الثاني الميلادي');
    });

    testWidgets(
      'Egypt pilot shows event scene and an unmirrored real map at 2x',
      (tester) async {
        tester.view.physicalSize = const Size(1000, 1500);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        final s = session(
          packWith('timeline_map', {
            'level': 1,
            'mode': 'map',
            'prompt': 'ضع الحدث على الخريطة',
            'map': {
              'region': 'middle_east_north_africa',
              'projection': 'equirectangular',
              'mirror_in_rtl': false,
            },
            'events': [
              {
                'id': 'pyramids',
                'label_key': 'timeline.event.pyramids',
                'image': 'timeline.event.pyramids',
                'lat': 29.9792,
                'lon': 31.1342,
                'tolerance_km': 200,
              },
            ],
          }),
          gameId: 'game-timeline-egypt-3',
        );
        await tester.pumpWidget(
          MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: TextScaler.linear(2),
                disableAnimations: true,
              ),
              child: child!,
            ),
            home: Directionality(
              textDirection: TextDirection.rtl,
              child: Scaffold(
                body: Builder(
                  builder: (context) =>
                      const TimelineMapEngine().build(context, s.controller),
                ),
              ),
            ),
          ),
        );
        await tester.pump();

        final assetNames = tester
            .widgetList<Image>(find.byType(Image))
            .map((image) => image.image)
            .whereType<AssetImage>()
            .map((image) => image.assetName);
        expect(
          assetNames,
          contains(endsWith('wave2-timeline/event-pyramids.webp')),
        );
        expect(
          assetNames,
          contains(
            endsWith('wave3-timeline-detail/map-timeline-background.webp'),
          ),
        );
        expect(
          Directionality.of(
            tester.element(find.byKey(const Key('timeline_map_surface'))),
          ),
          TextDirection.ltr,
        );
        expect(
          Directionality.of(
            tester.element(find.byKey(const Key('timeline_event_art'))),
          ),
          TextDirection.ltr,
          reason: 'event artwork must never mirror in RTL',
        );
        expect(find.byTooltip('حرّك غربًا'), findsOneWidget);
        expect(find.byTooltip('حرّك شرقًا'), findsOneWidget);
        expect(find.text('بناء الأهرام'), findsOneWidget);
        for (final action in [
          find.byTooltip('اسمع الاسم'),
          find.byKey(const Key('timeline_map_west')),
          find.byKey(const Key('timeline_map_north')),
          find.byKey(const Key('timeline_map_south')),
          find.byKey(const Key('timeline_map_east')),
          find.byKey(const Key('timeline_submit_place')),
        ]) {
          final size = tester.getSize(action);
          expect(size.width, greaterThanOrEqualTo(64));
          expect(size.height, greaterThanOrEqualTo(64));
        }

        final west = find.byKey(const Key('timeline_map_west'));
        final north = find.byKey(const Key('timeline_map_north'));
        final description = find.byKey(const Key('timeline_map_description'));
        final before = tester.widget<Text>(description).data;
        await tabTo(tester, west);
        expect(primaryFocusIsWithin(west), isTrue);
        await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
        await tester.pump();
        expect(primaryFocusIsWithin(north), isTrue);
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump();
        expect(tester.widget<Text>(description).data, isNot(before));

        await tester.tap(find.byKey(const Key('timeline_submit_place')));
        await tester.pumpAndSettle();
        expect(
          find.byKey(const Key('timeline_retry_feedback')),
          findsOneWidget,
        );
        expect(
          find.text('حرّك العلامة شرقًا ثم جرّب مرة أخرى'),
          findsOneWidget,
        );
        expect(find.byIcon(Icons.east_rounded), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('unknown event key uses a neutral child-facing label', (
      tester,
    ) async {
      const rawKey = 'timeline.event.internal_missing_scene';
      final s = session(
        packWith('timeline_map', {
          'level': 1,
          'mode': 'timeline',
          'timeline': {'from': 600, 'to': 1000},
          'events': [
            {
              'id': 'unknown-event',
              'label_key': rawKey,
              'image': 'asset-missing-event-scene',
              'year': 800,
            },
          ],
        }),
        gameId: 'game-timeline-egypt-3',
      );
      await pumpEngine(
        tester,
        (context) => const TimelineMapEngine().build(context, s.controller),
      );

      expect(find.text('حدث تاريخي'), findsOneWidget);
      expect(find.textContaining(rawKey), findsNothing);
      expect(find.textContaining('timeline.event.'), findsNothing);
      expect(find.bySemanticsLabel('الحدث: حدث تاريخي'), findsOneWidget);

      final empty = session(
        packWith('timeline_map', {'level': 1, 'events': const []}),
      );
      await pumpEngine(
        tester,
        (context) => const TimelineMapEngine().build(context, empty.controller),
      );
      expect(find.byType(GameStatePanel), findsOneWidget);
      expect(
        find.text('لا توجد أحداث للعب هنا. جرّب مستوى آخر.'),
        findsOneWidget,
      );
    });

    testWidgets('the authored timeline follows Arabic reading direction', (
      tester,
    ) async {
      final s = session(
        packWith('timeline_map', {
          'level': 1,
          'mode': 'timeline',
          'timeline': {'from': 600, 'to': 1000},
          'events': [
            {
              'id': 'library',
              'label_key': 'timeline.event.library_alex',
              'image': 'timeline.event.library_alex',
              'year': 800,
              'tolerance_years': 20,
            },
          ],
        }),
        gameId: 'game-wave2-timeline',
      );
      await pumpEngine(
        tester,
        (context) => const TimelineMapEngine().build(context, s.controller),
      );

      expect(
        Directionality.of(
          tester.element(find.byKey(const Key('timeline_year_slider'))),
        ),
        TextDirection.rtl,
      );
      final timelineImages = tester
          .widgetList<Image>(find.byType(Image))
          .map((image) => image.image)
          .whereType<AssetImage>()
          .map((image) => image.assetName);
      expect(
        timelineImages,
        contains(endsWith('wave2-timeline/timeline-background.webp')),
      );
      expect(find.byKey(const Key('timeline_background_art')), findsOneWidget);
      for (final key in [
        const Key('timeline_year_minus'),
        const Key('timeline_year_plus'),
        const Key('timeline_submit_year'),
      ]) {
        final size = tester.getSize(find.byKey(key));
        expect(size.width, greaterThanOrEqualTo(64));
        expect(size.height, greaterThanOrEqualTo(64));
      }
      expect(tester.takeException(), isNull);
    });
  });
}
