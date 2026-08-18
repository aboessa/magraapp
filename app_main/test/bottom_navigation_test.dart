import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/child/application/child_provider.dart';
import 'package:majarra/features/home/presentation/widgets/majarra_bottom_navigation.dart';

/// The profile tab used to be labelled with a literal personal name
/// (`'عبدالله'`), so every user of the app saw the same stranger's name on the
/// primary navigation bar.
void main() {
  Future<void> pumpNav(
    WidgetTester tester, {
    String? childId,
    String? displayName,
  }) async {
    tester.view.physicalSize = const Size(1200, 2000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          childProvider.overrideWith((ref) {
            final notifier = ChildNotifier();
            if (childId != null) {
              notifier.selectChild(
                childId: childId,
                ageTrack: 'preschool',
                displayName: displayName,
              );
            }
            return notifier;
          }),
        ],
        child: MaterialApp(
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              bottomNavigationBar: MajarraBottomNavigation(
                selectedIndex: 0,
                onDestinationSelected: (_) {},
                onPortalPressed: () {},
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('with no child selected the profile tab uses a generic label', (
    tester,
  ) async {
    await pumpNav(tester);

    expect(
      find.text(MajarraBottomNavigation.defaultProfileLabel),
      findsOneWidget,
    );
  });

  testWidgets('the profile tab shows the active child name', (tester) async {
    await pumpNav(tester, childId: 'child-1', displayName: 'سلمى');

    expect(find.text('سلمى'), findsOneWidget);
    expect(
      find.text(MajarraBottomNavigation.defaultProfileLabel),
      findsNothing,
    );
  });

  testWidgets('a blank display name falls back to the generic label', (
    tester,
  ) async {
    await pumpNav(tester, childId: 'child-1', displayName: '   ');

    expect(
      find.text(MajarraBottomNavigation.defaultProfileLabel),
      findsOneWidget,
    );
  });

  test('no personal name is hardcoded in the navigation bar', () {
    // A regression guard rather than a behaviour test: the defect was a literal
    // in the widget, not a wrong lookup.
    final contents = File(
      'lib/features/home/presentation/widgets/majarra_bottom_navigation.dart',
    ).readAsStringSync();
    expect(
      contents.contains("label: 'عبدالله'"),
      isFalse,
      reason: 'the profile label must come from the active child',
    );
  });
}
