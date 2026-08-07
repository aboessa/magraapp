import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/details/presentation/series_details_page.dart';
import '../../features/home/presentation/home_page.dart';
import '../../features/planets/presentation/planets_page.dart';
import '../../features/home/application/home_providers.dart';
import '../../features/home/domain/content_models.dart';
import '../../features/playback/presentation/playback_page.dart';
import '../../features/profile/presentation/pages/membership_page.dart';
import '../../features/profile/presentation/pages/watchlist_page.dart';
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
import '../../features/games/presentation/pages/game_page.dart';
import '../../features/tv/presentation/pages/tv_pairing_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      name: 'home',
      builder: (context, state) => const HomePage(),
    ),
    GoRoute(
      path: '/planets',
      name: 'planets',
      builder: (context, state) {
        return Consumer(builder: (context, ref, _) {
          final catalog = ref.watch(homeCatalogProvider);
          return catalog.when(
            loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
            error: (_, __) => Scaffold(body: Center(child: Text('خطأ'))),
            data: (value) => Scaffold(body: PlanetsPage(catalog: value, isTelevision: false)),
          );
        });
      },
    ),
    GoRoute(path: '/membership', builder: (context, state) => const MembershipPage()),
    GoRoute(path: '/watchlist', builder: (context, state) => const WatchlistPage()),
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
    GoRoute(
      path: '/reader/:seriesId',
      builder: (context, state) {
        return Consumer(builder: (context, ref, _) {
          final catalog = ref.watch(homeCatalogProvider).valueOrNull;
          final id = state.pathParameters['seriesId'] ?? '';
          final book = catalog?.books.where((b) => b.id == id).firstOrNull;
          if (book != null) {
            // حوّل BookItem إلى SeriesItem مؤقتاً للقارئ
            final series = SeriesItem(
              id: book.id,
              title: book.title,
              description: book.description,
              planetName: 'كوكب القصص',
              posterAsset: book.posterAsset,
              bannerAsset: book.posterAsset,
              ageMin: book.ageMin,
              ageMax: book.ageMax,
              episodesCount: 4,
              type: book.type,
              isFree: true,
            );
            return StoryReaderPage(series: series);
          }
          final series = catalog?.series.where((s) => s.id == id).firstOrNull;
          if (series == null) return Scaffold(body: Center(child: Text('القصة غير موجودة')));
          return StoryReaderPage(series: series);
        });
      },
    ),
    GoRoute(path: '/audio', builder: (context, state) => AudioPlayerPage(title: state.uri.queryParameters['title'] ?? 'استمع الآن', subtitle: state.uri.queryParameters['subtitle'])),
    GoRoute(
      path: '/game/:experienceId',
      builder: (context, state) {
        return Consumer(builder: (context, ref, _) {
          final catalog = ref.watch(homeCatalogProvider).valueOrNull;
          final exp = catalog?.experiences.where((e) => e.id == state.pathParameters['experienceId']).firstOrNull;
          if (exp == null) return Scaffold(body: Center(child: Text('اللعبة غير موجودة')));
          return GamePage(experience: exp);
        });
      },
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
  ],
  errorBuilder: (context, state) => Scaffold(
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
  ),
);
