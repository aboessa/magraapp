/// Covers the colouring pages catalogue and the board that paints on them.
///
/// The board keeps its paint buffer and flood fill private, so these tests drive
/// it the way a child does — pump it with the real bundled picture, tap and drag
/// on it, and assert on what the widget exposes. That is deliberate: a test that
/// reached into the fill algorithm would pass while the board stayed unusable.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/data/coloring_page.dart';
import 'package:majarra/features/games/engine/coloring_board.dart';

List<Map<String, dynamic>> _catalogueJson() {
  final file = File('assets/data/coloring_pages.json');
  if (!file.existsSync()) return const [];
  return (jsonDecode(file.readAsStringSync()) as List<dynamic>)
      .whereType<Map<String, dynamic>>()
      .toList();
}

void main() {
  group('catalogue', () {
    test('every published page is valid and its picture exists', () {
      final entries = _catalogueJson();
      expect(entries, isNotEmpty, reason: 'no colouring pages published');
      for (final entry in entries) {
        final page = ColoringPage.fromJson(entry);
        expect(page.isValid, isTrue, reason: '${page.id} is not valid');
        expect(
          File(page.image).existsSync(),
          isTrue,
          reason: '${page.id}: missing picture ${page.image}',
        );
      }
    });

    test('any raster format is accepted, not just PNG', () {
      // The point of the rewrite: nothing reads these pixels as data, so no
      // format is privileged. A JPG page must parse exactly like a PNG one.
      for (final ext in ['png', 'jpg', 'jpeg', 'webp']) {
        final page = ColoringPage.fromJson({
          'id': 'x',
          'label': 'x',
          'image': 'assets/images/coloring/x.$ext',
        });
        expect(page.isValid, isTrue, reason: '$ext was rejected');
      }
    });

    test('a page without a palette falls back to the default twelve', () {
      final page = ColoringPage.fromJson({
        'id': 'x',
        'label': 'x',
        'image': 'assets/images/coloring/x.png',
      });
      expect(page.palette, kDefaultColoringPalette);
      expect(
        page.palette.length,
        greaterThanOrEqualTo(8),
        reason: 'too few colours leaves a child with a two-colour drawing',
      );
    });

    test('an explicit palette wins, and an empty one does not', () {
      expect(
        ColoringPage.fromJson({
          'id': 'x',
          'label': 'x',
          'image': 'a.png',
          'palette': ['#FF0000'],
        }).palette,
        ['#FF0000'],
      );
      // An empty list is bad data, not an instruction to offer no colours.
      expect(
        ColoringPage.fromJson({
          'id': 'x',
          'label': 'x',
          'image': 'a.png',
          'palette': <String>[],
        }).palette,
        kDefaultColoringPalette,
      );
    });

    test('a half-written entry is rejected rather than shown', () {
      expect(
        ColoringPage.fromJson({'id': 'x', 'label': 'x', 'image': ''}).isValid,
        isFalse,
      );
    });
  });

  group('board', () {
    late ColoringPage page;

    setUpAll(() {
      page = ColoringPage.fromJson(_catalogueJson().first);
    });

    /// Lets the board's real async work finish, then renders a frame.
    ///
    /// `pumpAndSettle` cannot be used anywhere in this group. The board decodes an
    /// actual image (`rootBundle.load`, `instantiateImageCodec`,
    /// `decodeImageFromPixels`), and those complete on the real event loop, which
    /// the fake-async clock driving `pumpAndSettle` never advances — it times out
    /// instead. `runAsync` is the documented escape hatch for exactly this.
    ///
    /// ## Why it polls instead of sleeping (`QA-105`)
    ///
    /// This used to wait a flat 120 ms of **wall-clock** time and assume the decode
    /// had finished. Alone that is plenty; in a full `flutter test` run — many test
    /// processes competing for the same machine — it is not, and the next line
    /// asserted on a board still showing its loading indicator.
    ///
    /// The result was a test that failed roughly one full run in two and passed on
    /// its own, three times observed. A test whose verdict depends on machine load
    /// is worse than no test: its red is attributed to "flakiness" and re-run, so a
    /// real regression in the same file would be waved through the same way.
    ///
    /// So the wait is on the **condition**, not on the clock: poll in short steps
    /// until the loading indicator is gone (the error path clears it too), bounded
    /// by a real timeout that fails with a sentence rather than leaving the next
    /// `expect` to fail confusingly. Fast when the machine is idle, patient when it
    /// is not.
    /// [until] defaults to "the loading indicator is gone", which is the right
    /// condition after mounting. After an **interaction** the right condition is the
    /// fact the test is about to assert — usually that the paint callback has fired
    /// — so those call sites pass it explicitly. Waiting for the assertion's own
    /// precondition is what makes the wait honest: it cannot pass early by luck, and
    /// it cannot fail late because the machine was busy.
    Future<void> settle(
      WidgetTester tester, {
      Duration timeout = const Duration(seconds: 10),
      bool Function()? until,
      String? describe,
    }) async {
      final done = until
          ?? () => find.byType(CircularProgressIndicator).evaluate().isEmpty;
      final deadline = DateTime.now().add(timeout);
      while (true) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 20)),
        );
        await tester.pump();
        if (done()) return;
        if (DateTime.now().isAfter(deadline)) {
          fail(
            '${describe ?? 'the board still shows a loading indicator'} '
            'did not happen within $timeout',
          );
        }
      }
    }

    /// Whether a tool button is actually tappable.
    ///
    /// This is the precondition the flaky test was missing. `tester.tap` on a button
    /// whose `onTap` is null **succeeds and does nothing**, so a test that taps too
    /// early sees no effect and blames the effect. Undo enables redo only on the
    /// rebuild that follows the commit, and the paint callback fires before that
    /// rebuild — so waiting for the callback alone was necessary and not sufficient.
    bool enabled(String label) {
      final matches = find
          .descendant(
            of: find.bySemanticsLabel(label),
            matching: find.byType(InkResponse),
          )
          .evaluate();
      if (matches.isEmpty) return false;
      return (matches.first.widget as InkResponse).onTap != null;
    }

    /// Gives the real event loop time and asserts nothing arrived.
    ///
    /// Proving an **absence** cannot be a wait-for-condition: there is no condition
    /// to reach. It is the one place a duration is the right tool, so it is named
    /// for what it does instead of hiding inside [settle] — where a caller could
    /// think the wait was bounded by a fact.
    Future<void> quiet(WidgetTester tester) async {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 250)),
      );
      await tester.pump();
    }

    Future<void> pump(
      WidgetTester tester, {
      ValueChanged<bool>? onPainted,
      ColoringPage? override,
    }) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ColoringBoard(
              page: override ?? page,
              onPaintedChanged: onPainted,
            ),
          ),
        ),
      );
      await settle(tester);
    }

    testWidgets('loads the real picture and offers the tools', (tester) async {
      await pump(tester);

      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.textContaining('تعذّر'), findsNothing);

      for (final label in ['فرشاة', 'دلو التلوين', 'ممحاة']) {
        expect(find.bySemanticsLabel(label), findsOneWidget, reason: label);
      }
      expect(
        find.bySemanticsLabel('مساحة تلوين ${page.label}'),
        findsOneWidget,
      );
      // Every colour is reachable without opening a menu.
      for (final hex in page.palette) {
        expect(find.bySemanticsLabel('اختيار اللون $hex'), findsOneWidget);
      }
    });

    testWidgets('an untouched board reports nothing painted', (tester) async {
      final events = <bool>[];
      await pump(tester, onPainted: events.add);
      expect(
        events,
        isEmpty,
        reason: 'a host must not enable save on an untouched picture',
      );
    });

    testWidgets('a brush drag paints, and undo takes it back', (tester) async {
      final events = <bool>[];
      await pump(tester, onPainted: events.add);

      final canvas = find.bySemanticsLabel('مساحة تلوين ${page.label}');
      final centre = tester.getCenter(canvas);
      final gesture = await tester.startGesture(centre);
      await gesture.moveBy(const Offset(30, 20));
      await gesture.moveBy(const Offset(25, -15));
      await gesture.up();
      // Each wait is for the precondition of the **next** step, not for a duration:
      // the paint callback plus the rebuild that enables the button about to be
      // tapped. Waiting for the callback alone let the tap land on a disabled
      // button, which does nothing and looks like the feature failing.
      await settle(
        tester,
        until: () => events.isNotEmpty && enabled('رجوع'),
        describe: 'the drag reporting paint and undo becoming available',
      );

      expect(events, [true], reason: 'the drag did not register as paint');

      await tester.tap(find.bySemanticsLabel('رجوع'));
      await settle(
        tester,
        until: () => events.length >= 2 && enabled('إعادة'),
        describe: 'undo reporting an empty board and redo becoming available',
      );
      expect(events, [true, false], reason: 'undo did not clear the board');

      // Redo is only offered once something has been undone.
      await tester.tap(find.bySemanticsLabel('إعادة'));
      await settle(
        tester,
        until: () => events.length >= 3,
        describe: 'redo reporting the board painted again',
      );
      expect(events, [true, false, true]);
    });

    testWidgets('the bucket fills from a single tap', (tester) async {
      final events = <bool>[];
      await pump(tester, onPainted: events.add);

      await tester.tap(find.bySemanticsLabel('دلو التلوين'));
      await tester.pump();
      await tester.tap(find.bySemanticsLabel('مساحة تلوين ${page.label}'));
      await settle(tester, until: () => events.isNotEmpty, describe: 'the paint callback reaching 1 event(s)');

      expect(events, [true], reason: 'one tap with the bucket should fill');
    });

    testWidgets('clear removes everything in one step', (tester) async {
      final events = <bool>[];
      await pump(tester, onPainted: events.add);

      final canvas = find.bySemanticsLabel('مساحة تلوين ${page.label}');
      await tester.tapAt(tester.getCenter(canvas));
      await settle(
        tester,
        until: () => events.isNotEmpty && enabled('من جديد'),
        describe: 'the first tap reporting paint and clear becoming available',
      );
      await tester.tapAt(tester.getCenter(canvas) + const Offset(20, 20));
      // A second stroke must not report a second time: the board was already
      // painted. Proving that needs elapsed time, not a condition to reach.
      await quiet(tester);
      expect(events, [true]);

      await tester.tap(find.bySemanticsLabel('من جديد'));
      await settle(
        tester,
        until: () => events.length >= 2,
        describe: 'clear reporting an empty board',
      );
      expect(events, [true, false]);
    });

    testWidgets('picking a colour stands the eraser down', (tester) async {
      await pump(tester);

      final eraser = find.bySemanticsLabel('ممحاة');
      final handle = tester.ensureSemantics();

      await tester.tap(eraser);
      await tester.pump();
      expect(tester.getSemantics(eraser), containsSemantics(isSelected: true));

      await tester.tap(find.bySemanticsLabel('اختيار اللون ${page.palette.first}'));
      await tester.pump();
      expect(
        tester.getSemantics(eraser),
        containsSemantics(isSelected: false),
        reason: 'choosing a colour means the child wants to paint',
      );
      handle.dispose();
    });

    testWidgets('a missing picture reports failure instead of hanging', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ColoringBoard(
              page: ColoringPage(
                id: 'nope',
                label: 'nope',
                image: 'assets/images/coloring/does-not-exist.png',
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('تعذّر'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });
  });
}