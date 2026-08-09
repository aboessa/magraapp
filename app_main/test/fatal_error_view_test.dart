import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/widgets/fatal_error_view.dart';

/// Widget that always throws during build, used to drive `ErrorWidget.builder`.
class _AlwaysThrows extends StatelessWidget {
  const _AlwaysThrows();

  @override
  Widget build(BuildContext context) {
    throw StateError('deliberate build failure');
  }
}

void main() {
  testWidgets('renders an Arabic message and leaks no technical detail', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: FatalErrorView()));

    expect(find.text('حدث خطأ غير متوقع'), findsOneWidget);
    expect(find.byIcon(Icons.sentiment_dissatisfied_rounded), findsOneWidget);
  });

  testWidgets('sets RTL regardless of ancestor directionality', (tester) async {
    // Deliberately wrapped in LTR: the view must still lay out RTL, because it
    // can be installed above MaterialApp where no locale has been resolved.
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: FatalErrorView(),
      ),
    );

    final directionality = tester.widget<Directionality>(
      find
          .descendant(
            of: find.byType(FatalErrorView),
            matching: find.byType(Directionality),
          )
          .first,
    );
    expect(directionality.textDirection, TextDirection.rtl);
  });

  testWidgets('does not require a Scaffold ancestor', (tester) async {
    // A build error can replace a widget deep inside an existing route, so a
    // Scaffold of its own would assert. Pumped bare to prove it survives.
    await tester.pumpWidget(const FatalErrorView());
    expect(tester.takeException(), isNull);
    expect(find.byType(FatalErrorView), findsOneWidget);
  });

  testWidgets('ErrorWidget.builder wiring surfaces it on a build failure', (
    tester,
  ) async {
    // Mirrors what main.dart installs in release mode.
    //
    // Restored inside the test body, not via addTearDown: the test binding
    // asserts that ErrorWidget.builder is back to its default *before*
    // teardown callbacks run, so a tearDown-based restore fails the test.
    final previous = ErrorWidget.builder;
    ErrorWidget.builder = (_) => const FatalErrorView();

    await tester.pumpWidget(const MaterialApp(home: _AlwaysThrows()));

    // The thrown StateError is reported to the framework; consume it so the
    // test does not fail on an unhandled exception.
    expect(tester.takeException(), isA<StateError>());
    expect(find.byType(FatalErrorView), findsOneWidget);
    expect(find.text('حدث خطأ غير متوقع'), findsOneWidget);

    ErrorWidget.builder = previous;
  });
}
