/// Navigation tests for «مجموعتي».
///
/// The page was previously built, tested and unreachable. These tests pin the
/// thing that was actually missing: that a child can *get there*, by deep link
/// and by tapping, and that the route resolves the child itself rather than
/// trusting the URL.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:majarra/features/child/application/child_provider.dart';
import 'package:majarra/features/games/data/local_creation_store.dart';
import 'package:majarra/features/games/presentation/pages/my_collection_page.dart';
import 'package:majarra/features/games/presentation/pages/my_collection_route.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A router with only the route under test, so a failure here is about routing
/// rather than about anything else the real router pulls in.
GoRouter routerFor({String initialLocation = '/my-collection'}) {
  return GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () => context.push('/my-collection'),
              child: const Text('مجموعتي'),
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/my-collection',
        builder: (context, state) => const MyCollectionRoute(),
      ),
    ],
  );
}

Widget app(GoRouter router, {String? activeChildId, LocalCreationStore? store}) {
  return ProviderScope(
    overrides: [
      childProvider.overrideWith((ref) => _FakeChildNotifier(activeChildId)),
      if (store != null) localCreationStoreProvider.overrideWithValue(store),
      earnedStickersProvider.overrideWith((ref) async => const []),
    ],
    child: MaterialApp.router(routerConfig: router),
  );
}

/// Seeds a fixed active child so routing can be tested without a session.
class _FakeChildNotifier extends ChildNotifier {
  _FakeChildNotifier(String? id) {
    if (id != null) state = ChildState(activeChildId: id);
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('a deep link to /my-collection opens the page', (tester) async {
    await tester.pumpWidget(app(routerFor(), activeChildId: 'child-1'));
    await tester.pumpAndSettle();

    expect(find.byType(MyCollectionPage), findsOneWidget);
    expect(find.text('رسوماتي'), findsOneWidget);
    expect(find.text('ملصقاتي'), findsOneWidget);
  });

  testWidgets('tapping the entry point navigates there', (tester) async {
    await tester.pumpWidget(app(routerFor(initialLocation: '/'), activeChildId: 'child-1'));
    await tester.pumpAndSettle();

    expect(find.byType(MyCollectionPage), findsNothing);
    await tester.tap(find.text('مجموعتي'));
    await tester.pumpAndSettle();
    expect(find.byType(MyCollectionPage), findsOneWidget);
  });

  testWidgets('both shelves open', (tester) async {
    await tester.pumpWidget(app(routerFor(), activeChildId: 'child-1'));
    await tester.pumpAndSettle();

    expect(find.text('لا رسومات بعد'), findsOneWidget);
    await tester.tap(find.text('ملصقاتي'));
    await tester.pumpAndSettle();
    expect(find.text('لا ملصقات بعد'), findsOneWidget);
  });

  testWidgets('with no child selected it asks for one instead of showing an empty shelf',
      (tester) async {
    // An empty gallery would look like data loss. Naming the reason is kinder and
    // is also the only honest thing to show.
    await tester.pumpWidget(app(routerFor(), activeChildId: null));
    await tester.pumpAndSettle();

    expect(find.text('اختر طفلًا أولًا'), findsOneWidget);
    expect(find.byType(MyCollectionPage), findsNothing);
  });

  testWidgets('the route shows the active child, not a child named in the URL', (tester) async {
    // The path carries no child id by design, so a deep link cannot be used to
    // open another child's collection.
    final store = LocalCreationStore();
    await store.persist(LocalCreation(
      id: 'c-other', childId: 'child-2', gameId: 'g', drawingMode: 'coloring',
      width: 1, height: 1, byteLength: 10, createdAt: DateTime(2026),
      pngBase64: 'aGVsbG8=',
    ));

    await tester.pumpWidget(app(routerFor(), activeChildId: 'child-1', store: store));
    await tester.pumpAndSettle();

    // child-1 has nothing; child-2's drawing must not appear.
    expect(find.text('لا رسومات بعد'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });
}
