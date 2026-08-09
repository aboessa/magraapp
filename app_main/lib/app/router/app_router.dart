import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/device/device_profile.dart';
import '../../features/details/presentation/series_details_page.dart';
import '../../features/home/presentation/home_page.dart';
import '../../features/planets/presentation/planets_page.dart';
import '../../features/home/application/home_providers.dart';
import '../../features/playback/presentation/playback_page.dart';
import '../../features/profile/presentation/pages/membership_page.dart';
import '../../features/profile/presentation/pages/watchlist_page.dart';
import '../../features/games/presentation/pages/my_collection_route.dart';
import '../../features/profile/presentation/pages/downloads_page.dart';
import '../../features/profile/presentation/pages/account_data_page.dart';
import '../../features/profile/presentation/pages/devices_page.dart';
import '../../features/profile/presentation/pages/settings_page.dart';
import '../../features/profile/presentation/pages/support_page.dart';
import '../../features/profile/presentation/pages/privacy_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/pages/parent_pin_page.dart';
import '../../features/child/presentation/pages/child_switcher_page.dart';
import '../../features/parent/presentation/pages/parent_dashboard_page.dart';
import '../../features/reader/presentation/pages/story_reader_page.dart';
import '../../features/audio/presentation/pages/audio_player_page.dart';
import '../../features/games/presentation/pages/game_route.dart';
import '../../features/tv/presentation/pages/tv_pairing_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/child/application/child_provider.dart';
import 'auth_guard.dart';

// Kept for backwards compatibility with existing imports. New code should
// watch `routerProvider` instead so redirects react to auth/child changes.
final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  redirect: _legacyRedirect,
  routes: _routes,
  errorBuilder: _errorBuilder,
);

String? _legacyRedirect(BuildContext context, GoRouterState state) => null;

final routerProvider = Provider<GoRouter>((ref) {
  final guard = ref.watch(authGuardProvider);
  // Watch child state to keep the parental/child guards in sync.
  ref.listen(childProvider, (prev, next) {
    syncAuthGuardWithChild(next, guard);
  });
  return GoRouter(
    initialLocation: '/',
    refreshListenable: guard,
    redirect: (context, state) => _guardRedirect(state, guard),
    routes: _routes,
    errorBuilder: _errorBuilder,
  );
});

String? _guardRedirect(GoRouterState state, AuthGuard guard) {
  final loc = state.matchedLocation;
  // While secure storage is being read, do not redirect — prevents a flash
  // of /login on cold start when a valid session exists.
  if (guard.isLoading) return null;

  const public = {'/login', '/register'};
  const childRequired = {
    '/',
    '/home-v2',
    '/planets',
    '/watchlist',
    '/downloads',
  };

  final isPublic = public.contains(loc);
  final needsChild = childRequired.contains(loc) || loc.startsWith('/playback') || loc.startsWith('/reader') || loc.startsWith('/game') || loc.startsWith('/series');

  if (!guard.isAuthenticated && !isPublic) return '/login';
  if (guard.isAuthenticated && isPublic) return '/children';
  if (guard.isAuthenticated && needsChild && !guard.hasChild) return '/children';
  // Parental area requires authentication (PIN is checked inside the page).
  if (loc == '/parent' && !guard.isAuthenticated) return '/login';
  return null;
}

final List<RouteBase> _routes = <RouteBase>[
  GoRoute(
    path: '/',
    name: 'home',
    builder: (context, state) => const HomePage(),
  ),
    // New cinematic home, retained for side-by-side comparison on a real
    // device. `/` serves the original feed; this route serves v2.
    GoRoute(
      path: '/home-v2',
      name: 'home-v2',
      builder: (context, state) => const HomePage(useV2Home: true),
    ),
    GoRoute(
      path: '/planets',
      name: 'planets',
      builder: (context, state) {
        // Both shells push `/planets?planetId=$id`. This builder previously
        // ignored the query parameter, so every planet deep link landed on the
        // first planet, and it hardcoded `isTelevision: false`, so the page
        // rendered in phone layout even on a television.
        final planetId = state.uri.queryParameters['planetId'];
        return Consumer(builder: (context, ref, _) {
          final catalog = ref.watch(homeCatalogProvider);
          final device = ref.watch(deviceProfileProvider);
          final isTelevision = device.valueOrNull?.isTelevision ?? false;
          return catalog.when(
            loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
            error: (_, __) => const Scaffold(body: Center(child: Text('خطأ'))),
            data: (value) => Scaffold(
              body: PlanetsPage(
                catalog: value,
                isTelevision: isTelevision,
                selectedPlanetId: planetId,
              ),
            ),
          );
        });
      },
    ),
    GoRoute(path: '/membership', builder: (context, state) => const MembershipPage()),
    GoRoute(path: '/watchlist', builder: (context, state) => const WatchlistPage()),
    // «مجموعتي» — the child's own drawings and stickers. Reached from the profile
    // surface rather than a fifth bottom-navigation destination, which would have
    // meant restructuring the approved four-destination shell.
    GoRoute(path: '/my-collection', builder: (context, state) => const MyCollectionRoute()),
    GoRoute(path: '/downloads', builder: (context, state) => const DownloadsPage()),
    GoRoute(path: '/account', builder: (context, state) => const AccountDataPage()),
    GoRoute(path: '/devices', builder: (context, state) => const DevicesPage()),
    GoRoute(path: '/settings', builder: (context, state) => const SettingsPage()),
    GoRoute(path: '/support', builder: (context, state) => const SupportPage()),
    GoRoute(path: '/privacy', builder: (context, state) => const PrivacyPage()),
    GoRoute(path: '/playback/:episodeId', builder: (context, state) => PlaybackPage(episodeId: state.pathParameters['episodeId'] ?? '')),
    GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
    GoRoute(path: '/register', builder: (context, state) => const RegisterPage()),
    GoRoute(path: '/parent-pin', builder: (context, state) => const ParentPinPage()),
    GoRoute(path: '/children', builder: (context, state) => const ChildSwitcherPage()),
    GoRoute(path: '/parent', builder: (context, state) => const ParentDashboardPage()),
    // Story reader. The reader takes page data directly rather than a
    // `SeriesItem`: the previous version fabricated a synthetic series with a
    // hardcoded `episodesCount: 4` just to satisfy the old constructor.
    GoRoute(
      path: '/reader/:seriesId',
      builder: (context, state) {
        return Consumer(builder: (context, ref, _) {
          final catalog = ref.watch(homeCatalogProvider).valueOrNull;
          final id = state.pathParameters['seriesId'] ?? '';

          final book = catalog?.books.where((b) => b.id == id).firstOrNull;
          if (book != null) {
            // Pages are fetched on demand rather than carried on the catalogue
            // row: page bodies and artwork are far larger than a listing entry.
            // An empty result is legitimate and renders the unavailable state.
            final pages = ref.watch(
              storyPagesProvider(StoryPagesRequest(bookId: book.id)),
            );
            return StoryReaderPage(
              title: book.title,
              subtitle: book.description,
              pages: pages.valueOrNull ?? const [],
              loading: pages.isLoading,
              isComic: book.type == 'comic',
            );
          }

          // Series can also be opened in the reader (for illustrated
          // anthologies), but they carry no page data of their own yet.
          final series = catalog?.series.where((s) => s.id == id).firstOrNull;
          if (series == null) {
            return const Scaffold(
              body: Center(child: Text('القصة غير موجودة')),
            );
          }
          return StoryReaderPage(
            title: series.title,
            subtitle: series.description,
          );
        });
      },
    ),
    // Audio stories.
    //
    // Passing `bookId` through to the player is what enables the protected path:
    // narration is a private asset, so the player mints a short-lived capability
    // token instead of using a CDN URL (`تشفير المحتوي.md:70`). The catalogue's
    // public `audioUrl` is still passed as a fallback for free samples, which the
    // plan permits to be public (`:65-66`).
    GoRoute(
      path: '/audio',
      builder: (context, state) {
        final bookId = state.uri.queryParameters['bookId'];
        final pageId = state.uri.queryParameters['pageId'];
        final title = state.uri.queryParameters['title'] ?? 'استمع الآن';
        final subtitle = state.uri.queryParameters['subtitle'];

        if (bookId == null || bookId.isEmpty) {
          return AudioPlayerPage(title: title, subtitle: subtitle);
        }

        return Consumer(builder: (context, ref, _) {
          final catalog = ref.watch(homeCatalogProvider).valueOrNull;
          final book = catalog?.books.where((b) => b.id == bookId).firstOrNull;
          return AudioPlayerPage(
            title: book?.title ?? title,
            subtitle: book?.description ?? subtitle,
            audioUrl: book?.audioUrl,
            bookId: bookId,
            pageId: pageId,
          );
        });
      },
    ),
    // Games run from a server-supplied content pack.
    //
    // This route used to look the id up in the *local* catalogue and hand the
    // resulting `ExperienceItem` to `game_page.dart`, which then generated its own
    // board from emoji compiled into the app. The lookup was the tell: the only
    // thing the route needed from the catalogue was a title, because the gameplay
    // came from the binary rather than from content.
    //
    // `GameRoute` takes the path id as a `games` row id and fetches the published
    // pack for the active child. The path parameter is renamed to match what it
    // now means; both call sites already push `/game/${id}`, so nothing changes
    // for them.
    GoRoute(
      path: '/game/:gameId',
      builder: (context, state) =>
          GameRoute(gameId: state.pathParameters['gameId'] ?? ''),
    ),
    GoRoute(path: '/tv-pairing', builder: (context, state) => const TvPairingPage()),
    GoRoute(
      path: '/series/:seriesId',
      name: 'series-details',
      pageBuilder: (context, state) {
        return CustomTransitionPage<void>(
          key: state.pageKey,
          child: SeriesDetailsPage(
            seriesId: state.pathParameters['seriesId'] ?? '',
          ),
          transitionDuration: const Duration(milliseconds: 320),
          reverseTransitionDuration: const Duration(milliseconds: 240),
          transitionsBuilder: (context, animation, secondary, child) {
            final reduceMotion = MediaQuery.disableAnimationsOf(context);
            if (reduceMotion) return child;
            return FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              ),
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0, 0.025),
                  end: Offset.zero,
                ).animate(animation),
                child: child,
              ),
            );
          },
        );
      },
    ),
  ];

  Widget _errorBuilder(BuildContext context, GoRouterState state) => Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.explore_off_rounded, size: 52),
          const SizedBox(height: 16),
          Text(
            'تعذّر الوصول إلى هذه الوجهة',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => context.go('/'),
            child: const Text('العودة للرئيسية'),
          ),
        ],
      ),
    ),
  );
