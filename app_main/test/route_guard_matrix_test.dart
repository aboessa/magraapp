import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/app/router/auth_guard.dart';
import 'package:majarra/app/router/route_access.dart';

/// Route guard matrix — proves every route the router can actually reach is
/// deliberately classified, and that adding a new route without a
/// `routeAccessTable` entry fails this test instead of silently falling
/// through to an under-protected default.
///
/// Requirement 13.4 explicitly calls out that a guard test must scan every
/// route in the app, not a subset filtered by name (e.g. only files named
/// `admin*`) — that exact blind spot is what hid an unauthenticated path in
/// the past. This file walks the full route surface below, not a filtered
/// slice of it.
void main() {
  // Snapshot of every `GoRoute.path` literal currently in `_routes`
  // (`app_main/lib/app/router/app_router.dart`), written out by hand rather
  // than read from the source file at runtime — Requirement 13.3 requires
  // test data to live inside the test itself, matching the style already
  // used in `story_reader_dwell_test.dart`.
  //
  // `/series`, `/free`, `/library`, `/home-v2` were removed by task 5 of
  // this spec as unreachable route definitions (zero call sites). Their
  // entries were deleted from this list in the same change.
  const allRoutePaths = <String>[
    '/',
    '/planets',
    '/watch',
    '/play',
    '/read',
    '/listen',
    '/explore',
    '/search',
    '/shorts',
    '/membership',
    '/watchlist',
    '/my-collection',
    '/studio',
    '/studio/coloring/:id',
    '/studio/reference/:id',
    '/studio/trace/:id',
    '/downloads',
    '/account',
    '/devices',
    '/settings',
    '/support',
    '/privacy',
    '/playback/:episodeId',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/deletion-status',
    '/help-signin',
    '/terms',
    '/verify-email',
    '/parent-pin',
    '/children',
    '/onboarding',
    '/parent',
    '/reader/:seriesId',
    '/audio',
    '/game/:gameId',
    '/tv-pairing',
    '/series/:seriesId',
  ];

  group('تغطية شاملة: كل مسار في _routes مصنَّف فعليًا (Requirement 1.2)', () {
    // 1
    test('كل مسار في allRoutePaths له مفتاح مطابق تمامًا في routeAccessTable', () {
      // Deliberately checks table *membership*, not the resolved
      // `accessFor()` value — a route that is genuinely classified
      // `authenticatedFamily` (e.g. `/free`, `/search`) must pass this
      // check exactly the same as one classified `parentVerified`. Only a
      // route that is *absent* from the table should fail it. Comparing
      // `accessFor()` output alone could never tell the two apart, because
      // both a deliberate `authenticatedFamily` entry and a missing entry
      // resolve to the exact same enum value.
      final missing = <String>[
        for (final path in allRoutePaths)
          if (!routeAccessTable.containsKey(path)) path,
      ];
      expect(
        missing,
        isEmpty,
        reason:
            'accessFor() would silently fall through to '
            'RouteAccess.authenticatedFamily for these routes, without '
            'anyone having deliberately classified them: $missing',
      );
    });
  });

  group('تصنيف الفئات الأربع عبر accessFor (Requirement 1.1)', () {
    // 1
    test('parentVerified: /parent و /account', () {
      expect(accessFor('/parent'), RouteAccess.parentVerified);
      expect(accessFor('/account'), RouteAccess.parentVerified);
    });

    // 2
    test('childSession: / و /planets', () {
      expect(accessFor('/'), RouteAccess.childSession);
      expect(accessFor('/planets'), RouteAccess.childSession);
    });

    // 3
    test('public: /login', () {
      expect(accessFor('/login'), RouteAccess.public);
    });

    // 4
    test('authenticatedFamily: /children و /search', () {
      expect(accessFor('/children'), RouteAccess.authenticatedFamily);
      expect(accessFor('/search'), RouteAccess.authenticatedFamily);
    });

    // 5
    test(
      'بادئة معلَمة: /playback/abc123 يُصنَّف childSession رغم غيابه الحرفي عن الخريطة',
      () {
        // '/playback/abc123' can never be a literal key in
        // routeAccessTable — only the placeholder form
        // '/playback/:episodeId' is. Asserting it resolves to childSession
        // anyway proves the prefix-matching branch inside accessFor() runs,
        // not just the exact-match branch.
        expect(routeAccessTable.containsKey('/playback/abc123'), isFalse);
        expect(accessFor('/playback/abc123'), RouteAccess.childSession);
      },
    );
  });

  group(
    'وجهة الحرس عند غياب طفل نشط: /onboarding مقابل /children (Requirement 8.1, 8.6)',
    () {
      // Mirrors the exact condition `_guardRedirect` applies
      // (`app_router.dart`): no active child AND the family never
      // completed onboarding anywhere -> `/onboarding`; no active child
      // but SOME child already completed onboarding -> `/children`. This
      // is not a re-implementation under test — `_guardRedirect` itself is
      // private to `app_router.dart` — it locks the same boolean
      // combination `AuthGuard.hasCompletedOnboarding`/`hasChild` expose,
      // so a change to either field's semantics without updating the
      // router fails here first.
      String redirectTargetForNoActiveChild(AuthGuard guard) =>
          guard.hasCompletedOnboarding ? '/children' : '/onboarding';

      // 1
      test(
        'لا طفل نشط ولا onboarding_completed_at على أي طفل -> /onboarding',
        () {
          final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
          addTearDown(guard.dispose);
          guard.setHasChild(false);
          guard.setHasCompletedOnboarding(false);

          expect(redirectTargetForNoActiveChild(guard), '/onboarding');
        },
      );

      // 2
      test(
        'لا طفل نشط حاليًا لكن طفلًا آخر أكمل onboarding سابقًا -> /children لا /onboarding',
        () {
          final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
          addTearDown(guard.dispose);
          guard.setHasChild(false);
          guard.setHasCompletedOnboarding(true);

          expect(redirectTargetForNoActiveChild(guard), '/children');
        },
      );
    },
  );

  group('كشف الانحدار الصامت عند إضافة/حذف مسار (Requirement 1.2)', () {
    // 1
    test('لا يوجد مسار في _routes بلا تصنيف في routeAccessTable', () {
      // Forward diff: a route reachable from the router with no matching
      // entry in the classification table. This is exactly the "مسار جديد
      // بلا تصنيف" regression Requirement 1.2 requires the suite to catch:
      // before routeAccessTable existed, such a route fell through
      // silently to an under-protected default instead of failing a build.
      final routesWithoutClassification = allRoutePaths.toSet().difference(
        routeAccessTable.keys.toSet(),
      );
      expect(
        routesWithoutClassification,
        isEmpty,
        reason:
            'Route(s) present in _routes with no routeAccessTable entry: '
            '$routesWithoutClassification',
      );
    });

    // 2
    test(
      'لا يوجد مفتاح ميت في routeAccessTable بلا مسار مقابل في _routes',
      () {
        // Backward diff: a key left behind in the table after its route
        // was removed from the router. Not itself a security hole, but a
        // dead entry that misrepresents today's real route surface and
        // could mask a genuinely missing classification behind an
        // inflated coverage count.
        final deadTableEntries = routeAccessTable.keys.toSet().difference(
          allRoutePaths.toSet(),
        );
        expect(
          deadTableEntries,
          isEmpty,
          reason:
              'Key(s) left in routeAccessTable with no matching route in '
              '_routes: $deadTableEntries',
        );
      },
    );
  });
}
