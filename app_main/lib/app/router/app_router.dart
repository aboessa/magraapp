import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/device/device_profile.dart';
import '../theme/app_colors.dart';
import '../../features/details/presentation/series_details_page.dart';
import '../../features/games/presentation/pages/creative_deep_links.dart';
import '../../features/home/application/home_providers.dart';
import '../../features/home/presentation/home_page.dart';
import '../../features/planets/presentation/planets_page.dart';
import '../../features/playback/presentation/playback_page.dart';
import '../../features/profile/presentation/pages/membership_page.dart';
import '../../features/profile/presentation/pages/watchlist_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/home/presentation/pages/watch_page.dart';
import '../../features/home/presentation/pages/play_page.dart';
import '../../features/home/presentation/pages/read_page.dart';
import '../../features/search/presentation/search_page.dart';
import '../../features/shorts/presentation/shorts_page.dart';
import '../../features/home/presentation/pages/listen_page.dart';
import '../../features/home/presentation/pages/explore_page.dart';
import '../../features/home/presentation/pages/library_page.dart';
import '../../features/games/application/creation_cloud_service.dart';
import '../../features/games/application/game_providers.dart';
import '../../features/games/data/creation_document.dart';
import '../../features/games/data/local_creation_store.dart';
import '../../features/games/presentation/pages/creative_studio_page.dart';
import '../../features/games/presentation/pages/game_route.dart';
import '../../features/games/presentation/pages/my_collection_route.dart';
import '../../features/profile/presentation/pages/downloads_page.dart';
import '../../features/profile/presentation/pages/account_data_page.dart';
import '../../features/profile/presentation/pages/devices_page.dart';
import '../../features/profile/presentation/pages/settings_page.dart';
import '../../features/profile/presentation/pages/support_page.dart';
import '../../features/profile/presentation/pages/privacy_page.dart';
import '../../features/auth/application/reset_token_vault.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/pages/email_verification_page.dart';
import '../../features/auth/presentation/pages/forgot_password_page.dart';
import '../../features/auth/presentation/pages/reset_password_page.dart';
import '../../features/auth/presentation/pages/deletion_status_page.dart';
import '../../features/auth/presentation/pages/parent_pin_page.dart';
import '../../features/child/presentation/pages/child_switcher_page.dart';
import '../../features/parent/presentation/pages/parent_dashboard_page.dart';
import '../../features/reader/presentation/pages/story_reader_page.dart';
import '../../features/audio/presentation/pages/audio_player_page.dart';
import '../../features/tv/presentation/pages/tv_pairing_page.dart';
import '../../features/home/domain/content_models.dart';
import '../../features/child/application/child_provider.dart';
import 'auth_guard.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final guard = ref.watch(authGuardProvider);
  final resetTokenVault = ref.watch(resetTokenVaultProvider);
  // Watch child state to keep the parental/child guards in sync.
  ref.listen(childProvider, (prev, next) {
    syncAuthGuardWithChild(next, guard);
  });
  return GoRouter(
    initialLocation: '/',
    refreshListenable: guard,
    redirect: (context, state) => _guardRedirect(state, guard, resetTokenVault),
    routes: _routes,
    errorBuilder: _errorBuilder,
  );
});

String? _guardRedirect(
  GoRouterState state,
  AuthGuard guard,
  ResetTokenVault resetTokenVault,
) {
  final loc = state.matchedLocation;

  // Capture reset credentials before any authenticated-entry redirect. Both
  // the preferred fragment and legacy query form are replaced immediately by
  // the clean path, keeping the capability out of browser history/referrers.
  if (loc == '/reset-password') {
    String? fragmentToken;
    if (state.uri.fragment.isNotEmpty) {
      try {
        fragmentToken = Uri.splitQueryString(state.uri.fragment)['token'];
      } catch (_) {
        fragmentToken = null;
      }
    }
    final token = fragmentToken ?? state.uri.queryParameters['token'];
    if (token != null && token.trim().isNotEmpty) {
      resetTokenVault.capture(token);
      return '/reset-password';
    }
  }

  // While secure storage is being read, do not redirect — prevents a flash
  // of /login on cold start when a valid session exists.
  if (guard.isLoading) return null;

  const public = {
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/deletion-status',
    '/privacy',
  };
  const authEntry = {
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
  };
  const parentProtected = {
    '/parent',
    '/account',
    '/devices',
    '/membership',
    '/settings',
  };
  const childRequired = {
    '/',
    '/planets',
    '/watchlist',
    '/my-collection',
    '/studio',
    '/downloads',
    '/audio',
    '/watch',
    '/play',
    '/read',
    '/listen',
    '/explore',
    '/library',
  };

  // Legacy /home-v2 alias now unconditionally redirects to canonical /.
  if (loc == '/home-v2') return '/';

  final isPublic = public.contains(loc);
  final needsChild =
      childRequired.contains(loc) ||
      loc.startsWith('/playback') ||
      loc.startsWith('/reader') ||
      loc.startsWith('/game') ||
      loc.startsWith('/series');

  if (!guard.isAuthenticated && !isPublic) return '/login';
  if (guard.isAuthenticated &&
      authEntry.contains(loc) &&
      loc != '/reset-password') {
    return guard.hasChild ? '/' : '/children';
  }

  // Demo is a child-only, memory-only experience. It cannot enrol a PIN or
  // enter any parent-protected route even when navigated by a deep link.
  if (guard.isDemo && (parentProtected.contains(loc) || loc == '/parent-pin')) {
    return '/';
  }

  if (guard.isAuthenticated && needsChild && !guard.hasChild) {
    return '/children';
  }

  if (parentProtected.contains(loc) && !guard.hasParentAccess) {
    return Uri(path: '/parent-pin', queryParameters: {'from': loc}).toString();
  }
  return null;
}

final List<RouteBase> _routes = <RouteBase>[
  GoRoute(
    path: '/',
    name: 'home',
    builder: (context, state) => const HomePage(),
  ),
  // Canonical Home is now single V1. Old /home-v2 links redirect via _guardRedirect.
  GoRoute(path: '/home-v2', name: 'home-v2', redirect: (context, state) => '/'),
  GoRoute(
    path: '/planets',
    name: 'planets',
    builder: (context, state) {
      // Both shells push `/planets?planetId=$id`. This builder previously
      // ignored the query parameter, so every planet deep link landed on the
      // first planet, and it hardcoded `isTelevision: false`, so the page
      // rendered in phone layout even on a television.
      final planetId = state.uri.queryParameters['planetId'];
      return Consumer(
        builder: (context, ref, _) {
          final catalog = ref.watch(homeCatalogProvider);
          final games = ref.watch(gameCatalogProvider);
          final device = ref.watch(deviceProfileProvider);
          final isTelevision = device.valueOrNull?.isTelevision ?? false;
          return catalog.when(
            loading: () => const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => _RouteLoadError(
              title: 'تعذّر تحميل الكواكب',
              body: 'تحقق من الاتصال ثم حاول مرة أخرى.',
              onRetry: () {
                ref.invalidate(homeCatalogProvider);
                ref.invalidate(gameCatalogProvider);
              },
            ),
            data: (value) {
              final currentGames = games is AsyncData<List<ExperienceItem>>
                  ? games.value
                  : const <ExperienceItem>[];
              final effectiveCatalog = value.withServerGames(
                currentGames,
                requireDpad: isTelevision,
              );
              return Scaffold(
                body: PlanetsPage(
                  catalog: effectiveCatalog,
                  isTelevision: isTelevision,
                  selectedPlanetId: planetId,
                ),
              );
            },
          );
        },
      );
    },
  ),
  GoRoute(path: '/watch', builder: (context, state) => const WatchPage()),
  GoRoute(path: '/play', builder: (context, state) => const PlayPage()),
  GoRoute(path: '/read', builder: (context, state) => const ReadPage()),
  GoRoute(path: '/listen', builder: (context, state) => const ListenPage()),
  GoRoute(path: '/explore', builder: (context, state) => const ExplorePage()),
  GoRoute(path: '/library', builder: (context, state) => const LibraryPage()),
  GoRoute(
    path: '/search',
    builder: (context, state) => Consumer(
      builder: (context, ref, _) {
        final catalog = ref.watch(homeCatalogProvider).valueOrNull;
        if (catalog == null) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return SearchPage(catalog: catalog, isTelevision: false);
      },
    ),
  ),
  GoRoute(
    path: '/shorts',
    builder: (context, state) => Consumer(
      builder: (context, ref, _) {
        final catalog = ref.watch(homeCatalogProvider).valueOrNull;
        if (catalog == null) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return ShortsPage(catalog: catalog, isTelevision: false);
      },
    ),
  ),
  GoRoute(
    path: '/membership',
    builder: (context, state) => const MembershipPage(),
  ),
  GoRoute(
    path: '/watchlist',
    builder: (context, state) => const WatchlistPage(),
  ),
  // «مجموعتي» — the child's own drawings and stickers. Reached from the profile
  // surface rather than a fifth bottom-navigation destination, which would have
  // meant restructuring the approved four-destination shell.
  GoRoute(
    path: '/my-collection',
    builder: (context, state) => const MyCollectionRoute(),
  ),
  GoRoute(
    path: '/studio',
    builder: (context, state) => Consumer(
      builder: (context, ref, _) {
        final childId = ref.watch(childProvider).activeChildId;
        if (childId == null || childId.isEmpty) {
          return const _RouteMessage(
            icon: Icons.face_outlined,
            title: 'اختر طفلًا أولًا',
            body: 'الاستوديو يحفظ الرسومات في مساحة الطفل المحدد.',
          );
        }

        final extra = state.extra;
        final creation =
            extra is LocalCreation &&
                extra.childId == childId &&
                extra.isEditable
            ? extra
            : null;
        final document = creation?.documentJson == null
            ? null
            : CreationDocument.tryParse(creation!.documentJson!);
        final device = ref.watch(deviceProfileProvider);

        Widget studio() => CreativeStudioPage(
          childId: childId,
          creationStore: ref.watch(localCreationStoreProvider),
          initialCreation: document == null ? null : creation,
          initialDocument: document,
        );

        return device.when(
          loading: () =>
              const Scaffold(body: Center(child: CircularProgressIndicator())),
          error: (_, __) => studio(),
          data: (profile) => profile.isTelevision
              ? const _RouteMessage(
                  icon: Icons.touch_app_outlined,
                  title: 'الاستوديو يحتاج شاشة لمس',
                  body: 'افتح الاستوديو على الهاتف أو الجهاز اللوحي للرسم.',
                )
              : studio(),
        );
      },
    ),
  ),
  // Deep links — canonical IDs, resolve from provider/cache, not just `extra`.
  GoRoute(
    path: '/studio/coloring/:id',
    builder: (context, state) {
      final id = state.pathParameters['id'] ?? '';
      return Consumer(builder: (context, ref, _) {
        final childId = ref.watch(childProvider).activeChildId;
        if (childId == null || childId.isEmpty) {
          return const _RouteMessage(icon: Icons.face_outlined, title: 'اختر طفلًا أولًا', body: 'الاستوديو يحفظ الرسومات في مساحة الطفل المحدد.');
        }
        return ColoringDeepLinkResolver(childId: childId, templateId: id);
      });
    },
  ),
  GoRoute(
    path: '/studio/reference/:id',
    builder: (context, state) {
      final id = state.pathParameters['id'] ?? '';
      return Consumer(builder: (context, ref, _) {
        final childId = ref.watch(childProvider).activeChildId;
        if (childId == null || childId.isEmpty) {
          return const _RouteMessage(icon: Icons.face_outlined, title: 'اختر طفلًا أولًا', body: 'الاستوديو يحفظ الرسومات في مساحة الطفل المحدد.');
        }
        return ReferenceDeepLinkResolver(childId: childId, activityId: id);
      });
    },
  ),
  GoRoute(
    path: '/studio/trace/:id',
    builder: (context, state) {
      final id = state.pathParameters['id'] ?? '';
      return Consumer(builder: (context, ref, _) {
        final childId = ref.watch(childProvider).activeChildId;
        if (childId == null || childId.isEmpty) {
          return const _RouteMessage(icon: Icons.face_outlined, title: 'اختر طفلًا أولًا', body: 'الاستوديو يحفظ الرسومات في مساحة الطفل المحدد.');
        }
        return TraceDeepLinkResolver(childId: childId, itemId: id);
      });
    },
  ),
  GoRoute(
    path: '/downloads',
    builder: (context, state) => const DownloadsPage(),
  ),
  GoRoute(
    path: '/account',
    builder: (context, state) => const AccountDataPage(),
  ),
  GoRoute(path: '/devices', builder: (context, state) => const DevicesPage()),
  GoRoute(path: '/settings', builder: (context, state) => const SettingsPage()),
  GoRoute(path: '/support', builder: (context, state) => const SupportPage()),
  GoRoute(path: '/privacy', builder: (context, state) => const PrivacyPage()),
  GoRoute(
    path: '/playback/:episodeId',
    builder: (context, state) =>
        PlaybackPage(episodeId: state.pathParameters['episodeId'] ?? ''),
  ),
  GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
  GoRoute(path: '/register', builder: (context, state) => const RegisterPage()),
  GoRoute(
    path: '/forgot-password',
    builder: (context, state) =>
        ForgotPasswordPage(initialEmail: state.uri.queryParameters['email']),
  ),
  GoRoute(
    path: '/reset-password',
    builder: (context, state) =>
        ResetPasswordPage(initialToken: state.uri.queryParameters['token']),
  ),
  GoRoute(
    path: '/deletion-status',
    builder: (context, state) => const DeletionStatusPage(),
  ),
  GoRoute(
    path: '/verify-email',
    builder: (context, state) {
      final extra = state.extra;
      final args = extra is EmailVerificationArgs ? extra : null;
      return EmailVerificationPage(
        email: args?.email,
        token: args?.token ?? state.uri.queryParameters['token'],
      );
    },
  ),
  GoRoute(
    path: '/parent-pin',
    builder: (context, state) =>
        ParentPinPage(returnTo: state.uri.queryParameters['from']),
  ),
  GoRoute(
    path: '/children',
    builder: (context, state) => const ChildSwitcherPage(),
  ),
  GoRoute(
    path: '/parent',
    builder: (context, state) => const ParentDashboardPage(),
  ),
  // Story reader. The reader takes page data directly rather than a
  // `SeriesItem`: the previous version fabricated a synthetic series with a
  // hardcoded `episodesCount: 4` just to satisfy the old constructor.
  GoRoute(
    path: '/reader/:seriesId',
    builder: (context, state) {
      return Consumer(
        builder: (context, ref, _) {
          final catalogState = ref.watch(homeCatalogProvider);
          final catalog = catalogState.valueOrNull;
          final id = state.pathParameters['seriesId'] ?? '';

          if (catalog == null && catalogState.isLoading) {
            return const Scaffold(
              backgroundColor: AppColors.deepSpace,
              body: Center(
                child: CircularProgressIndicator(color: AppColors.starGold),
              ),
            );
          }
          if (catalog == null && catalogState.hasError) {
            return Scaffold(
              backgroundColor: AppColors.deepSpace,
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.cloud_off_rounded,
                        color: Colors.white70,
                        size: 48,
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'تعذّر تحميل مكتبة القصص.',
                        style: TextStyle(color: Colors.white, fontSize: 16),
                      ),
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: () => ref.invalidate(homeCatalogProvider),
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('إعادة المحاولة'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          final requestedType = state.uri.queryParameters['contentType'];
          final book = requestedType == 'story'
              ? null
              : catalog?.books.where((item) => item.id == id).firstOrNull;
          if (book != null) {
            final request = StoryPagesRequest(bookId: book.id);
            final pages = ref.watch(storyPagesProvider(request));
            return StoryReaderPage(
              title: book.title,
              subtitle: book.description,
              collection: pages.valueOrNull,
              loading: pages.isLoading,
              error: pages.error,
              onRetry: () => ref.invalidate(storyPagesProvider(request)),
              isComic: book.type == 'comic',
              bookId: book.id,
              contentType: ReaderContentType.book,
            );
          }

          final story = requestedType == 'book'
              ? null
              : catalog?.stories.where((item) => item.id == id).firstOrNull;
          if (story != null) {
            final request = StoryPagesRequest(bookId: story.id);
            final pages = ref.watch(storyStoryPagesProvider(request));
            return StoryReaderPage(
              title: story.title,
              subtitle: story.description,
              collection: pages.valueOrNull,
              loading: pages.isLoading,
              error: pages.error,
              onRetry: () => ref.invalidate(storyStoryPagesProvider(request)),
              isComic: story.type == 'comic',
              storyId: story.id,
              contentType: ReaderContentType.story,
            );
          }

          final series = catalog?.series
              .where((item) => item.id == id)
              .firstOrNull;
          if (series == null) {
            return const Scaffold(
              backgroundColor: AppColors.deepSpace,
              body: Center(
                child: Text(
                  'القصة غير موجودة',
                  style: TextStyle(color: Colors.white),
                ),
              ),
            );
          }
          return StoryReaderPage(
            title: series.title,
            subtitle: series.description,
          );
        },
      );
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
      final downloadId = state.uri.queryParameters['downloadId'];
      final title = state.uri.queryParameters['title'] ?? 'استمع الآن';
      final subtitle = state.uri.queryParameters['subtitle'];
      final artworkUrl = state.uri.queryParameters['artworkUrl'];

      if (bookId == null || bookId.isEmpty) {
        return AudioPlayerPage(
          title: title,
          subtitle: subtitle,
          downloadId: downloadId,
          artworkUrl: artworkUrl,
        );
      }

      return Consumer(
        builder: (context, ref, _) {
          final catalog = ref.watch(homeCatalogProvider).valueOrNull;
          final book = catalog?.books.where((b) => b.id == bookId).firstOrNull;
          return AudioPlayerPage(
            title: book?.title ?? title,
            subtitle: book?.description ?? subtitle,
            audioUrl: book?.audioUrl,
            artworkUrl: book?.coverUrl ?? artworkUrl,
            artworkAsset: book?.posterAsset,
            bookId: bookId,
            pageId: pageId,
            downloadId: downloadId,
          );
        },
      );
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
  GoRoute(
    path: '/tv-pairing',
    builder: (context, state) => const TvPairingPage(),
  ),
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

class _RouteLoadError extends StatelessWidget {
  const _RouteLoadError({
    required this.title,
    required this.body,
    required this.onRetry,
  });

  final String title;
  final String body;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return _RouteMessage(
      icon: Icons.cloud_off_outlined,
      title: title,
      body: body,
      actionLabel: 'إعادة المحاولة',
      onAction: onRetry,
    );
  }
}

class _RouteMessage extends StatelessWidget {
  const _RouteMessage({
    required this.icon,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 56),
              const SizedBox(height: 14),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(body, textAlign: TextAlign.center),
              if (onAction != null && actionLabel != null) ...[
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: onAction,
                  icon: const Icon(Icons.refresh),
                  label: Text(actionLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

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
