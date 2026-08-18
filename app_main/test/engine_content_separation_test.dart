/// The test that keeps content out of the runtime.
///
/// ## Why this exists
///
/// `docs/games/00-overview.md` requires a new game to be a row in the CMS rather
/// than an app release. That promise is only true while no gameplay content is
/// compiled into the binary, and it was not true until recently:
/// `presentation/pages/game_page.dart` shipped a memory board whose faces were
/// `['🌙','⭐','🚀','🪐','☄️','🔭','🛰️','✨']` and whose difficulty curve was
/// `static const _pairsPerLevel = [3, 4, 6, 8]`. Both were unreachable from the
/// CMS, so the only way to change a card or a level was a store release.
///
/// Every other kind of test passed while that was true, because the page worked.
/// That is the gap this file closes, from two directions:
///
/// 1. **Source-level** — no engine file may carry a list of authored content, and
///    none may contain a pictographic literal standing in for artwork. A regression
///    here is a compile-time fact, so a text scan is the honest way to assert it;
///    a behavioural test cannot see a constant that a future level happens not to
///    reach.
/// 2. **Behavioural** — the same engine, given two different packs, must produce
///    two different boards, and given an empty content list must produce an empty
///    board. An engine that quietly falls back to built-in content passes every
///    normal test and fails these.
///
/// ## The allowlist is the point
///
/// [_allowedConstantLists] names every constant collection of strings that is
/// permitted, with the reason. Interface chrome, numeral tables and ordinal words
/// are interface, not content, and belong in the app. Adding a new entry is
/// deliberately annoying: it forces whoever adds a constant to state why it is not
/// content, in a file a reviewer reads.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/application/game_providers.dart';
import 'package:majarra/features/games/engine/game_pack.dart';
import 'package:majarra/features/games/engine/game_services.dart';
import 'package:majarra/features/games/engine/game_session_controller.dart';
import 'package:majarra/features/games/presentation/pages/game_screen.dart';

/// Everything the games feature compiles, engines and their hosting pages alike.
///
/// The pages are included because the offender was a page, not an engine: keeping
/// the scan to `engine/` would have let the same board be reintroduced one
/// directory up.
const _scannedDirectories = <String>[
  'lib/features/games/engine',
  'lib/features/games/presentation',
  'lib/features/games/application',
  'lib/features/games/data',
];

/// Constant string collections that are interface rather than content.
///
/// Keyed `file.dart:identifier`. Each entry states why the strings cannot be
/// authored in a pack.
const _allowedConstantLists = <String, String>{
  // Digit glyphs for `numeral_system`. A numeral table is orthography, and a pack
  // that shipped its own would let two packs disagree about what «٣» is.
  'game_board_kit.dart:_arabicIndicDigits':
      'numeral rendering, not content: the stored value is always the number',

  // Ordinal words used to say «القرن الثامن الميلادي» out loud. Derived from the
  // year in the pack, so the pack still decides what is described.
  'timeline_map_engine.dart:_arabicOrdinals':
      'grammatical ordinals for a spoken description of pack data',

  // Region bounding boxes. Held in the client because the pack names a region and
  // a projection but carries no box, and the same numbers are asserted against
  // `docs/games/fixtures/map_regions.json` by shared_fixtures_test.dart, so the
  // server and the client cannot disagree about where a tap landed.
  'timeline_map_engine.dart:_known':
      'projection geometry, shared with the server through a fixture',

  // Brand palette used only when a level declares none. Colours are chrome, and a
  // level that names a palette overrides this entirely.
  'free_draw_surface.dart:_fallbackPalette':
      'default brush colours; any level palette wins',

  // Names for the four brush tools defined by DrawBrush. Packs provide drawing
  // prompts and assets, but do not define or rename the editor's tool vocabulary.
  'free_draw_surface.dart:labels':
      'brush-tool labels for engine-defined DrawBrush controls, not authored content',

  // The predict / try / explain stage names. These are the engine's own state
  // machine made visible — the same three stages exist in every sim_lab pack.
  'sim_lab_engine.dart:labels':
      'stage labels for the engine state machine, identical in every pack',

  // «المجموعة الأولى» / «المجموعة الثانية» / «متساويتان» in count_quantity's
  // compare mode. The three answer ids are the mode's own vocabulary, not authored
  // content: a pack chooses the two quantities, never what the two sets are called.
  'wave_two_engines.dart:labels':
      'names for the compare-mode answer ids the engine itself defines',

  // The creative studio and its drawing reference library are standalone,
  // local-first tools. These lists describe gallery filters, drawing prompts and
  // bundled reference sheets; none is consumed by a game engine or can affect a
  // pack's board, score or progression.
  'creative_studio_page.dart:_coloringItems':
      'standalone studio gallery entries, not pack-driven game content',
  'creative_studio_page.dart:_traceItems':
      'standalone studio tracing references, not pack-driven game content',
  'creative_studio_page.dart:_letterItems':
      'standalone studio letter references, not pack-driven game content',
  'creative_studio_page.dart:_numberItems':
      'standalone studio numeral references, not pack-driven game content',
  'creative_studio_page.dart:_dotsItems':
      'standalone studio dot-sheet references, not pack-driven game content',
  'creative_studio_page.dart:_completeItems':
      'standalone studio completion sheets, not pack-driven game content',
  'creative_studio_page.dart:_copyItems':
      'standalone studio copying references, not pack-driven game content',
  'creative_studio_page.dart:_promptItems':
      'standalone studio free-drawing prompts, not pack-driven game content',
  'my_boards_page.dart:_bgOptions':
      'local creation-board appearance options, not gameplay content',
  'reference_catalogue_page.dart:_categories':
      'filters for the standalone drawing reference catalogue',
  'reference_catalogue_page.dart:_ages':
      'age filters for the standalone drawing reference catalogue',
  'reference_catalogue_page.dart:_activities':
      'standalone drawing reference sheets, never consumed by an engine',
  'reference_drawing_page.dart:cards':
      'presentation cards for a selected standalone reference sheet',
  'drawing_asset_map.dart:kDrawingAssetMap':
      'maps stable drawing reference ids to bundled files; no game logic',

  // Creation document sync in the session controller — schema keys for the
  // editable document, not authored content.
  'game_session_controller.dart:doc':
      'creation document schema keys, identical for every creation',
};

/// Identifiers that named content in the deleted page, kept as a tripwire.
///
/// A grep-shaped assertion on purpose: these exact names are what the old board
/// used, and a reintroduction is far more likely to copy them than to invent new
/// ones.
const _forbiddenIdentifiers = <String>[
  '_pairsPerLevel',
  '_faces',
  '_wordList',
  '_questionBank',
];

/// Pictographic characters. Emoji were the placeholder artwork that made a
/// contentless build look finished, which is why the range is banned outright
/// rather than counted.
final _pictographic = RegExp(
  r'[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{FE0F}]',
  unicode: true,
);

final _stringLiteral = RegExp("'[^'\\n]*'|\"[^\"\\n]*\"");

/// A constant collection declaration: `const x = [`, `static const x = <T>{`, and
/// the `static final` variant that behaves the same at runtime.
final _constCollection = RegExp(
  r'(?:static\s+)?(?:const|final)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:const\s*)?(?:<[^<>]*>\s*)?([\[{])',
);

List<File> _dartFiles() {
  final files = <File>[];
  for (final path in _scannedDirectories) {
    final dir = Directory(path);
    if (!dir.existsSync()) continue;
    files.addAll(
      dir
          .listSync(recursive: true)
          .whereType<File>()
          .where((file) => file.path.endsWith('.dart')),
    );
  }
  return files;
}

/// The source with comments removed.
///
/// Every scan below except the pictograph one runs on this. The engine files
/// deliberately document what they replaced — `wave_one_engines.dart` names the old
/// `_pairsPerLevel` curve in its header, and that history is worth keeping — so a
/// scan that counted comments would force the explanations to be deleted to make
/// the test pass, which is the wrong trade.
///
/// String state is tracked so a `//` inside a URL or an Arabic label cannot swallow
/// the rest of a line.
String _codeOnly(String source) {
  final out = StringBuffer();
  var index = 0;
  while (index < source.length) {
    final ch = source[index];
    if (ch == "'" || ch == '"') {
      final quote = ch;
      out.write(ch);
      index++;
      while (index < source.length && source[index] != quote) {
        if (source[index] == r'\' && index + 1 < source.length) {
          out.write(source[index]);
          index++;
        }
        out.write(source[index]);
        index++;
      }
      if (index < source.length) out.write(source[index]);
      index++;
      continue;
    }
    if (ch == '/' && index + 1 < source.length && source[index + 1] == '/') {
      while (index < source.length && source[index] != '\n') {
        index++;
      }
      continue;
    }
    if (ch == '/' && index + 1 < source.length && source[index + 1] == '*') {
      index += 2;
      while (index + 1 < source.length &&
          !(source[index] == '*' && source[index + 1] == '/')) {
        index++;
      }
      index += 2;
      continue;
    }
    out.write(ch);
    index++;
  }
  return out.toString();
}

/// The body of a collection literal starting at [openIndex].
///
/// Bracket-matched rather than regex-matched because a level list can nest, and a
/// regex that stopped at the first `]` would read only part of it and under-count.
/// String contents are skipped so a bracket inside a string cannot unbalance it.
String _literalBody(String source, int openIndex) {
  final open = source[openIndex];
  final close = open == '[' ? ']' : '}';
  var depth = 0;
  var index = openIndex;
  while (index < source.length) {
    final ch = source[index];
    if (ch == "'" || ch == '"') {
      final quote = ch;
      index++;
      while (index < source.length && source[index] != quote) {
        if (source[index] == r'\') index++;
        index++;
      }
    } else if (ch == open) {
      depth++;
    } else if (ch == close) {
      depth--;
      if (depth == 0) return source.substring(openIndex, index + 1);
    }
    index++;
  }
  // Unbalanced input cannot happen in a file that compiles, so returning the tail
  // keeps the caller simple rather than adding an error path that is unreachable.
  return source.substring(openIndex);
}

// --------------------------------------------------------------------- fixtures

Map<String, dynamic> _packOf({
  required String engineId,
  required List<Map<String, dynamic>> levels,
}) => {
  'pack_version': 1,
  'engine_id': engineId,
  'supports_dpad': true,
  'progression': {'levels_to_finish': 1, 'advance_on': 'level_complete'},
  'accessibility': {
    'simplified_motor': {'tolerance_dp': 44, 'coverage_required': 0.6},
    'sequential_tap_alternative': true,
    'min_touch_target_dp': 48,
  },
  'levels': levels,
  'assets': {'images': [], 'audio': []},
  'voice_manifest': {'vo.intro': 'asset-vo-intro'},
};

/// A pack running inside the real screen and the real registry.
///
/// Deliberately not a direct engine construction: an engine that only behaves when
/// built by hand is not pack-driven, and this file is about that exact claim.
class _Harness {
  _Harness(Map<String, dynamic> json)
    : pack = GamePack.fromJson(json),
      reporter = RecordingAttemptReporter() {
    controller = GameSessionController(
      pack: pack,
      gameId: 'game-under-test',
      childId: 'child-1',
      ageTrack: AgeTrack.preschool,
      audio: SilentGameAudioService(),
      reporter: reporter,
      eventIdFactory: () => 'event-fixed',
      feedback: const FeedbackService(hapticsEnabled: false),
    );
  }

  final GamePack pack;
  final RecordingAttemptReporter reporter;
  late final GameSessionController controller;

  Widget widget() => MaterialApp(
    home: Directionality(
      textDirection: TextDirection.rtl,
      child: GameScreen(
        pack: pack,
        controller: controller,
        registry: buildDefaultRegistry(),
      ),
    ),
  );
}

Future<void> _pumpBig(WidgetTester tester, Widget widget) async {
  tester.view.physicalSize = const Size(1400, 2200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(widget);
  await tester.pumpAndSettle();
}

/// A memory_flip level with one authored pair per entry of [assetIds].
///
/// [columns] is passed through to `grid` because the engine reads its column count
/// from the pack. Four columns for the larger board is not cosmetic: `GridView`
/// builds lazily, and a two-column board of eight tiles is taller than the test
/// viewport, so half of it would never be built and a count assertion would
/// measure the viewport instead of the pack.
Map<String, dynamic> _memoryLevel(List<String> assetIds, {int columns = 2}) => {
  'level': 1,
  'grid': [2, columns],
  'pair_type': 'identical',
  'pairs': [
    for (final id in assetIds) {'a': id, 'b': '$id-2'},
  ],
  'flip_back_delay_ms': 900,
};

void main() {
  group('no engine file carries authored content', () {
    final files = _dartFiles();

    test('the scan actually found the games sources', () {
      // Without this, a renamed directory would turn every assertion below into a
      // silent pass.
      expect(files.length, greaterThanOrEqualTo(10));
      expect(
        files.map((f) => f.uri.pathSegments.last),
        containsAll(<String>[
          'wave_one_engines.dart',
          'wave_two_engines.dart',
          'game_screen.dart',
        ]),
      );
    });

    test('no pictographic literal stands in for artwork', () {
      for (final file in files) {
        final matches = _pictographic.allMatches(file.readAsStringSync());
        expect(
          matches.map((m) => m.group(0)).toList(),
          isEmpty,
          reason:
              '${file.path} contains placeholder pictographs; artwork is an '
              'asset id in the pack',
        );
      }
    });

    test('the identifiers the deleted demo board used are gone', () {
      for (final file in files) {
        final source = _codeOnly(file.readAsStringSync());
        for (final identifier in _forbiddenIdentifiers) {
          expect(
            source.contains(identifier),
            isFalse,
            reason:
                '${file.path} declares $identifier, which named content that '
                'belongs in a pack',
          );
        }
      }
    });

    test('every constant collection of strings is interface, not content', () {
      final offenders = <String>[];

      for (final file in files) {
        final source = _codeOnly(file.readAsStringSync());
        final name = file.uri.pathSegments.last;

        for (final match in _constCollection.allMatches(source)) {
          final identifier = match.group(1)!;
          final body = _literalBody(
            source,
            match.start + match.group(0)!.length - 1,
          );
          final strings = _stringLiteral.allMatches(body).length;

          // Two strings is a pair, not a deck. Three is where a list starts to look
          // like authored content, which is the threshold the old `_faces` array and
          // `_pairsPerLevel` curve both crossed.
          if (strings < 3) continue;
          if (_allowedConstantLists.containsKey('$name:$identifier')) continue;
          offenders.add('$name:$identifier ($strings strings)');
        }
      }

      expect(
        offenders,
        isEmpty,
        reason:
            'these constants may be content. Move them into a pack, or add '
            'them to _allowedConstantLists with the reason they are interface',
      );
    });

    test('the allowlist has no stale entries', () {
      // A stale entry is a hole: it would silently permit a future constant that
      // happens to reuse the name.
      final present = <String>{};
      for (final file in _dartFiles()) {
        final name = file.uri.pathSegments.last;
        final source = _codeOnly(file.readAsStringSync());
        for (final match in _constCollection.allMatches(source)) {
          present.add('$name:${match.group(1)}');
        }
      }
      for (final key in _allowedConstantLists.keys) {
        expect(
          present,
          contains(key),
          reason: '$key no longer exists; remove it',
        );
      }
    });

    test('the deleted hard-coded page has not come back', () {
      expect(
        File(
          'lib/features/games/presentation/pages/game_page.dart',
        ).existsSync(),
        isFalse,
        reason:
            'memory_flip is pack-driven in wave_one_engines.dart; a second '
            'implementation would be one the CMS cannot reach',
      );
    });
  });

  group('the board is whatever the pack says', () {
    testWidgets('two packs, one engine, two different boards', (tester) async {
      final small = _Harness(
        _packOf(
          engineId: 'memory_flip',
          levels: [
            _memoryLevel(['asset-moon', 'asset-star']),
          ],
        ),
      );
      await _pumpBig(tester, small.widget());
      // 2 pairs => 4 tiles. The old board would have shown 6, from its
      // pairs-per-level constant.
      expect(find.byIcon(Icons.question_mark), findsNWidgets(4));

      // Unmount before the second pack. Both boards are a `GameScreen` at the same
      // position in the tree, so pumping straight over the first one would update
      // the existing `State` rather than create a new one, and the board is built
      // in `initState` — the assertion would then measure the first pack twice.
      await tester.pumpWidget(const SizedBox.shrink());

      final large = _Harness(
        _packOf(
          engineId: 'memory_flip',
          levels: [
            _memoryLevel([
              'asset-moon',
              'asset-star',
              'asset-rocket',
              'asset-comet',
            ], columns: 4),
          ],
        ),
      );
      await _pumpBig(tester, large.widget());
      expect(find.byIcon(Icons.question_mark), findsNWidgets(8));
    });

    testWidgets('a revealed tile shows the pack\'s asset id', (tester) async {
      final harness = _Harness(
        _packOf(
          engineId: 'memory_flip',
          levels: [
            _memoryLevel(['asset-only-in-this-test']),
          ],
        ),
      );
      await _pumpBig(tester, harness.widget());

      await tester.tap(find.byKey(const ValueKey('memory_tile_0')));
      await tester.pump();

      // One of the two faces of the single authored pair. Nothing else could
      // produce this string, so the face cannot be coming from the app.
      final shown = find.textContaining('asset-only-in-this-test');
      expect(shown, findsOneWidget);
    });

    testWidgets('an empty content list produces an empty board', (
      tester,
    ) async {
      // The strongest form of the claim: with nothing authored there is nothing to
      // play. An engine holding a fallback deck would fill the grid here.
      final harness = _Harness(
        _packOf(engineId: 'memory_flip', levels: [_memoryLevel(const [])]),
      );
      await _pumpBig(tester, harness.widget());

      expect(find.byIcon(Icons.question_mark), findsNothing);
      expect(find.byKey(const ValueKey('memory_tile_0')), findsNothing);
    });

    testWidgets('count_quantity offers exactly the options in the pack', (
      tester,
    ) async {
      final harness = _Harness(
        _packOf(
          engineId: 'count_quantity',
          levels: [
            {
              'level': 1,
              'mode': 'count_and_pick',
              'scoring': 'discrete',
              'range': [1, 9],
              // Western numerals so the assertion reads the authored value directly
              // rather than through the numeral table.
              'numeral_system': 'western',
              'items': [
                {
                  'id': 'q1',
                  'items': [
                    {'image': 'asset-star', 'count': 7},
                  ],
                  'question_key': 'count.how_many',
                  'options': [6, 7, 8],
                  'answer': 7,
                },
              ],
            },
          ],
        ),
      );
      await _pumpBig(tester, harness.widget());

      for (final option in ['6', '7', '8']) {
        expect(
          find.text(option),
          findsWidgets,
          reason: 'option $option is authored',
        );
      }
      // A neighbouring value the pack did not offer. Its absence is what shows the
      // options were read rather than generated around the answer.
      expect(find.text('9'), findsNothing);
    });
  });

  group('the pack comes from the server envelope', () {
    /// A minimal `GET /api/v1/games/:id` response, shaped like `routes/games.ts`.
    Map<String, dynamic> envelope({
      Object? engineId = 'memory_flip',
      Map<String, dynamic>? pack,
      Map<String, dynamic>? engine,
      Map<String, dynamic>? gaps,
      Object? title,
    }) => {
      'success': true,
      'data': {
        'id': 'game-1',
        if (engineId != null) 'engine_id': engineId,
        if (title != null) 'title': title,
        'age_min': 3,
        'age_max': 5,
        'engine_version': 1,
        'episode_id': 'ep-1',
        'objective': {'id': 'objective-1', 'code': 'OBJ'},
        'engine': engine ?? {'supports_dpad': true},
        'content_pack':
            pack ??
            {
              'pack_version': 1,
              // Deliberately disagreeing with the envelope, to prove which one
              // the client trusts.
              'engine_id': 'something_else',
              'levels': [
                _memoryLevel(['asset-a']),
              ],
              'progression': {'levels_to_finish': 1},
              'voice_manifest': const <String, dynamic>{},
            },
        'gaps': gaps ?? {'missing_prompt_keys': [], 'missing_voice_keys': []},
      },
    };

    test('the engine id comes from the row, not from the pack body', () {
      // The registry is keyed on the `games.engine_id` column. A pack whose embedded
      // copy disagrees is a publishing bug, and picking the pack's value would run
      // the wrong engine on content authored for another.
      final resolved = resolvedGameFromEnvelope('fallback', envelope());
      expect(resolved.pack.engineId, 'memory_flip');
      expect(buildDefaultRegistry().supports(resolved.pack.engineId), isTrue);
    });

    test(
      'D-pad support comes from the engine row, so TV gating is the server\'s',
      () {
        final off = resolvedGameFromEnvelope(
          'fallback',
          envelope(engine: {'supports_dpad': false}),
        );
        expect(off.pack.supportsDpad, isFalse);
        final on = resolvedGameFromEnvelope('fallback', envelope());
        expect(on.pack.supportsDpad, isTrue);
      },
    );

    test('a missing title stays missing rather than becoming a placeholder', () {
      // An empty title renders as an empty title, which is visible and reportable.
      // A stand-in string would look like real content and hide the gap.
      expect(resolvedGameFromEnvelope('fallback', envelope()).title, isEmpty);
      expect(
        resolvedGameFromEnvelope(
          'fallback',
          envelope(title: 'ذاكرة النجوم'),
        ).title,
        'ذاكرة النجوم',
      );
    });

    test('content gaps the server reported are carried, not swallowed', () {
      final resolved = resolvedGameFromEnvelope(
        'fallback',
        envelope(
          gaps: {
            'missing_prompt_keys': ['count.how_many'],
            'missing_voice_keys': ['vo.intro'],
          },
        ),
      );
      expect(resolved.missingPromptKeys, ['count.how_many']);
      expect(resolved.missingVoiceKeys, ['vo.intro']);
      expect(resolved.hasContentGaps, isTrue);
    });

    test('a response with no pack fails instead of producing an empty game', () {
      // The failure mode this replaces: a half-built pack that throws later, inside
      // a paint call, where the cause is no longer visible.
      expect(
        () =>
            resolvedGameFromEnvelope('fallback', {'success': true, 'data': {}}),
        throwsA(isA<GamePackParseException>()),
      );
      expect(
        () => resolvedGameFromEnvelope('fallback', {'success': true}),
        throwsA(isA<GamePackParseException>()),
      );
    });

    test('the age track follows the pack\'s authored range', () {
      // Taken from the game, not the child: a pack authored for 3–5 should sound
      // like a preschool pack even when an older sibling opens it.
      expect(
        resolvedGameFromEnvelope('fallback', envelope()).ageTrack,
        AgeTrack.preschool,
      );
    });
  });
}
