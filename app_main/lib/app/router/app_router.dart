import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/onboarding/application/onboarding_journey.dart';
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
import '../../features/auth/presentation/pages/pin_setup_page.dart';
import '../../features/auth/presentation/pages/pin_unlock_page.dart';
import '../../features/auth/data/parent_pin_store.dart';
import '../../features/auth/presentation/pages/help_signin_page.dart';
import '../../features/onboarding/application/onboarding_controller.dart';
import '../../features/child/presentation/pages/child_switcher_page.dart';
import '../../features/onboarding/presentation/pages/onboarding_flow_page.dart';
import '../../features/parent/presentation/pages/parent_dashboard_page.dart';
import '../../features/reader/presentation/pages/story_reader_page.dart';
import '../../features/audio/presentation/pages/audio_player_page.dart';
import '../../features/tv/presentation/pages/tv_pairing_page.dart';
import '../../features/home/domain/content_models.dart';
import '../../features/child/application/child_provider.dart';
import 'auth_guard.dart';
import 'route_access.dart';
import 'touch_only_surface.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final guard = ref.watch(authGuardProvider);
  final resetTokenVault = ref.watch(resetTokenVaultProvider);
  // Watch child state to keep the parental/child guards in sync.
  // _scheduleNotify inside AuthGuard already defers when inside a build,
  // so no extra microtask here is needed.
  ref.listen(childProvider, (prev, next) {
    syncAuthGuardWithChild(next, guard);
  });
  // حالة تهيئة الأسرة ورحلتها (Requirement 8.1, 8.5, 8.6).
  //
  // `_guardRedirect` يبقى متزامنًا بقراءة منطقيّاتٍ مُحسَّبة هنا، لا بقراءة
  // مزوّدٍ غير متزامن. والقرار يحتاج مصدرين — قائمة الأطفال والخطوة المحفوظة —
  // فيُعاد حسابه كلّما تغيّر أحدهما، والقواعد نفسها دوالُّ خالصة في
  // `features/onboarding/application/onboarding_journey.dart`.
  //
  // `fireImmediately` في الاثنين: `ref.listen` لا يُشعِل على القيمة الأولى،
  // فبلا هذا يبقى أوّل إطارٍ على القيم الافتراضية — وهو بالضبط الإطار الذي كان
  // يُعيد التوجيه إلى `/onboarding` قبل أن يُحسم الجلب.
  // الحالة تُشتَقّ من قيمةٍ **مُمرَّرة** لا من قراءةٍ لاحقة للمزوّد: عند الفشل
  // يُسلِّم Riverpod الخطأ إلى `onError`، وتوقيتُ استقرار حالة المزوّد الداخلية
  // بعدها ليس عقدًا يُعتمد عليه. فمن يعرف الجواب يُمرّره.
  void applyOnboardingJourney({
    required FamilyOnboardingStatus status,
    required bool anyChildStamped,
  }) {
    final hasPersistedStep = ref.read(onboardingControllerProvider).hasPersistedStep;

    guard.setFamilyOnboardingStatus(status);
    guard.setOnboardingJourneyInProgress(onboardingJourneyIsActive(
      status: status,
      hasPersistedStep: hasPersistedStep,
      anyChildStamped: anyChildStamped,
    ));

    // خطوةٌ خلّفها حسابٌ قديم: تُمسح هنا لأن `OnboardingFlowPage` لا يُبنى في
    // هذه الحالة أصلًا (التوجيه يذهب إلى `/children`)، فلا موضع آخر يراها.
    if (persistedStepIsStale(
      status: status,
      hasPersistedStep: hasPersistedStep,
      anyChildStamped: anyChildStamped,
    )) {
      unawaited(ref.read(onboardingControllerProvider.notifier).complete());
    }
  }

  void syncOnboardingJourney() {
    applyOnboardingJourney(
      status: ref.read(familyOnboardingStatusProvider),
      anyChildStamped: ref.read(anyChildStampedProvider),
    );
  }

  // الاستماع إلى المزوّدين **المشتقّين** لا إلى `familyChildrenProvider` مباشرةً:
  // الأخير غير متزامن، و`ref.listen` عليه يُصعِّد الفشل خطأً غير مُعالَج بدل أن
  // يُسلّمه حالةً (موصَّف في `onboarding_journey.dart`). والمشتقّان
  // `Provider` عاديّان لا يرميان أبدًا.
  ref.listen(familyOnboardingStatusProvider, (prev, next) => syncOnboardingJourney(),
      fireImmediately: true);
  ref.listen(anyChildStampedProvider, (prev, next) => syncOnboardingJourney());
  ref.listen(onboardingControllerProvider, (prev, next) => syncOnboardingJourney(),
      fireImmediately: true);
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

  // Auth-entry screens: signing in/registering/verifying/resetting a
  // password while already authenticated should bounce forward instead of
  // re-showing the form. This set has no `RouteAccess` equivalent — it is
  // not a protection level, it is a subset of `RouteAccess.public` routes
  // that additionally redirect *away* when the user already has a session.
  // The four-category enum only classifies how much access a route
  // *requires*, not this orthogonal "entry point" behaviour, so it stays a
  // local constant rather than living in `route_access.dart`.
  const authEntry = {
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
  };

  final access = accessFor(loc);

  if (!guard.isAuthenticated && access != RouteAccess.public) return '/login';
  if (guard.isAuthenticated &&
      authEntry.contains(loc) &&
      loc != '/reset-password') {
    if (guard.hasChild) return '/';
    // Requirement 8.1: أسرةٌ بلا طفلٍ نشط تذهب إلى الرحلة **فقط** إن كانت
    // الرحلة جارية فعلًا (`shouldEnterOnboarding`) — أي أسرةٌ بلا أطفال، أو
    // خطوةٌ محفوظة تُستأنف. و«لم يُحسم الجلب» و«فشل الجلب» تذهبان إلى
    // `/children`، حيث مؤشّر تحميلٍ أو خطأٌ قابل لإعادة المحاولة. وأسرةٌ
    // أكملت التهيئة تمرّ إلى `/children` حتى بلا طفلٍ مختار (إضافة طفلٍ ثانٍ
    // لاحقًا) — Requirement 8.6.
    return guard.shouldEnterOnboarding ? '/onboarding' : '/children';
  }

  // Requirement 8.5: `/onboarding` نفسه يُعاد تقييمه، لا المسارات المُوجِّهة
  // إليه وحدها. وبلا هذا الفرع تبقى أسرةٌ حُسمت حالتها **بعد** التوجيه المتزامن
  // الأوّل عالقةً على الرحلة، لأن `/onboarding` مصنَّف `authenticatedFamily`
  // فلا فرعَ فئةٍ يُخرج منه.
  //
  // والشرط `!onboardingJourneyInProgress` لا `hasCompletedOnboarding`: الأسرة
  // تصير `complete` **بإنشاء أوّل طفل داخل الرحلة نفسها**، فالحكم بالحالة وحدها
  // كان ينتزع المستخدم من شاشة الاحتفال في اللحظة التي يستحقّها.
  if (loc == '/onboarding' && !guard.onboardingJourneyInProgress) {
    return guard.hasChild ? '/' : '/children';
  }

  // والمقابل المتناظر: أسرةٌ هبطت على `/children` ثم حُسمت حالتها `incomplete`.
  //
  // التوجيه الأوّل متزامن ويقع قبل حسم `familyChildrenProvider`، فيذهب إلى
  // `/children` بحقّ (لا نعرف بعد). ثم يُحسم الجلب بصفر أطفال، وبلا هذا الفرع
  // تبقى الأسرة على شاشة «من يشاهد الآن؟» **فارغةً بلا مخرج** — لأن
  // `/children` مصنَّف `authenticatedFamily` فلا فرعَ فئةٍ ينقل منه، وهي نفس
  // العلّة الموصوفة على `/onboarding` أعلاه في الاتجاه المعاكس.
  if (loc == '/children' && guard.shouldEnterOnboarding) return '/onboarding';

  // Demo is a child-only, memory-only experience. It cannot enrol a PIN or
  // manage a real account, so those routes lead to sign-in rather than bouncing
  // back to Home, which made every account link look broken.
  //
  // `/membership` is the one exception: it is read-only plan information, and
  // both providers serve a guest preview instead of calling the account API.
  if (guard.isDemo &&
      ((access == RouteAccess.parentVerified && loc != '/membership') ||
          loc == '/parent-pin')) {
    return '/login';
  }

  if (access == RouteAccess.childSession &&
      guard.isAuthenticated &&
      !guard.hasChild) {
    return guard.hasCompletedOnboarding ? '/children' : '/onboarding';
  }

  if (access == RouteAccess.parentVerified && !guard.hasParentAccess) {
    return Uri(path: '/parent-pin', queryParameters: {'from': loc}).toString();
  }
  return null;
}

/* ------------------------------------------- الاتجاه بحسب المسار (`APP-108`) */

/// أنماط المسارات التي يُسمح فيها بالعرض الأفقي.
///
/// التطبيق مقفول على portrait في `main.dart` لأن كل شاشة مصمَّمة عموديًّا، ويستثني
/// المُشغِّل وحده — وهو يفتح الأفقي بنفسه في `initState` ويُعيد القفل في `dispose`.
///
/// النمط لا الموقع: `'/playback/:episodeId'` هو ما يُعلنه `GoRoute`، فيُطابَق أيّ
/// معرّف حلقة بلا تحليل نصّي لعنوان.
const landscapeCapableRoutes = <String>{'/playback/:episodeId'};

/// هل المسار المعروض الآن يسمح بالأفقي؟
///
/// ## ما كان (`APP-108`)
///
/// `ModalRoute.of(context)?.settings.name?.contains('playback')` داخل
/// `MaterialApp.router(builder:)`. وفيه عطلان:
///
/// 1. **`builder` فوق الـNavigator**، فلا `ModalRoute` أعلاه — والقيمة `null`
///    **دائمًا**. أي أن الشرط لم يكن هشًّا فحسب: كان **مكسورًا في اتجاه واحد
///    ثابت**، فيُغطّى المُشغِّل بشاشة «أدِر الجهاز» في الوضع الأفقي — وهو الوضع
///    الذي يفتحه المُشغِّل بنفسه لمشاهدة الفيديو.
/// 2. `contains('playback')` مطابقةٌ نصّية تُصيب أي مسار يحوي الكلمة.
///
/// والقرار يُشتقّ الآن من نمط المسار الذي طابقه `go_router` فعلًا، لا نصًّا
/// يُخمَّن.
///
/// ## ولماذا ليس `fullPath` وحدها
///
/// كان هذا السطر `currentConfiguration.fullPath`، وكان **مكسورًا في كل فتحةٍ
/// حقيقية للمُشغِّل**. السبب أن `RouteMatchList._generateFullPath` في
/// go_router 14.6.2 (‏`lib/src/match.dart:558-561`) يستثني المسارات المدفوعة
/// بالتصميم:
///
/// ```dart
/// for (final RouteMatchBase match in matches
///     .where((RouteMatchBase match) => match is! ImperativeRouteMatch)) {
/// ```
///
/// و`context.push` يُنتج `ImperativeRouteMatch` بعينه. والتطبيق لا يفتح
/// المُشغِّل إلّا بـ`push` — أحد عشر موضعًا، صفر `go`. فـ`fullPath` على شاشة
/// المُشغِّل تبقى نمطَ ما تحته (`/`)، فتُمنع الشاشة الوحيدة المستثناة.
///
/// وأثره حلقةٌ يراها الطفل: المُشغِّل يفتح الأفقي في `initState` ← الحاجز يرى
/// أفقيًّا بلا إذن فيستبدل الـNavigator بـ«أدِر الجهاز» ← المُشغِّل يُفكَّك
/// فيُعيد `dispose` القفل العمودي ← الشرط يسقط فيعود الـNavigator ← والمسار ما
/// زال في المكدّس فيُبنى المُشغِّل من جديد ← وهكذا بلا توقّف.
///
/// والاختبار السابق مرّ لأنه كان يستعمل `go` حصرًا: أثبت أن الآلية تعمل في
/// طريقٍ لا يسلكه التطبيق.
bool routeAllowsLandscape(GoRouter router) {
  final pattern = _topRoutePattern(router.routerDelegate.currentConfiguration);
  return landscapeCapableRoutes.contains(pattern);
}

/// نمط المسار **الأعلى** في المكدّس، نازلًا في المسارات المدفوعة.
///
/// `ImperativeRouteMatch.matches` قائمةٌ ناتجة عن تحليلٍ تصريحيّ للموقع
/// المدفوع، فـ`fullPath` **داخلها** صحيحة. والنزول يعالج `push` فوق `push`:
/// الأعلى وحده يحكم، فالعودة تسحب الإذن تلقائيًّا.
String _topRoutePattern(RouteMatchList configuration) {
  final matches = configuration.matches;
  if (matches.isEmpty) return configuration.fullPath;
  final last = matches.last;
  if (last is ImperativeRouteMatch) return _topRoutePattern(last.matches);
  return configuration.fullPath;
}

/// مسارٌ سطحُه لا يُدار بلا مؤشّر: يُغلَّف بـ[TouchOnlySurface] **بالبناء**.
///
/// وُجد لأن `/studio` كان يحمل الفحص داخل بانيه وحده، فمرّت ثلاثة روابط عميقة
/// تفتح الأسطح نفسها بلا فحص (`A11Y-102`). من يضيف مسار استوديو رابعًا عبر هذه
/// الدالّة لا يستطيع أن ينسى الفحص، ومن يضيفه بـ`GoRoute` عاريًا يُوقعه
/// `touch_only_routes_test.dart`.
GoRoute _touchOnlyRoute({
  required String path,
  required Widget Function(BuildContext context, GoRouterState state) builder,
}) => GoRoute(
  path: path,
  builder: (context, state) =>
      TouchOnlySurface(child: (context) => builder(context, state)),
);

final List<RouteBase> _routes = <RouteBase>[
  GoRoute(
    path: '/',
    name: 'home',
    builder: (context, state) => const HomePage(),
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
  _touchOnlyRoute(
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
        // فحص التلفاز كان هنا، وصار في `touchOnlyRoute` فوق: الأمر واحد لهذا
        // المسار وللروابط العميقة الثلاثة التي كانت تفوته.
        return CreativeStudioPage(
          childId: childId,
          creationStore: ref.watch(localCreationStoreProvider),
          initialCreation: document == null ? null : creation,
          initialDocument: document,
          displayName: ref.watch(childProvider).displayName,
        );
      },
    ),
  ),
  // Deep links — canonical IDs, resolve from provider/cache, not just `extra`.
  _touchOnlyRoute(
    path: '/studio/coloring/:id',
    builder: (context, state) {
      final id = state.pathParameters['id'] ?? '';
      return Consumer(
        builder: (context, ref, _) {
          final childId = ref.watch(childProvider).activeChildId;
          if (childId == null || childId.isEmpty) {
            return const _RouteMessage(
              icon: Icons.face_outlined,
              title: 'اختر طفلًا أولًا',
              body: 'الاستوديو يحفظ الرسومات في مساحة الطفل المحدد.',
            );
          }
          return ColoringDeepLinkResolver(childId: childId, templateId: id);
        },
      );
    },
  ),
  _touchOnlyRoute(
    path: '/studio/reference/:id',
    builder: (context, state) {
      final id = state.pathParameters['id'] ?? '';
      return Consumer(
        builder: (context, ref, _) {
          final childId = ref.watch(childProvider).activeChildId;
          if (childId == null || childId.isEmpty) {
            return const _RouteMessage(
              icon: Icons.face_outlined,
              title: 'اختر طفلًا أولًا',
              body: 'الاستوديو يحفظ الرسومات في مساحة الطفل المحدد.',
            );
          }
          return ReferenceDeepLinkResolver(childId: childId, activityId: id);
        },
      );
    },
  ),
  _touchOnlyRoute(
    path: '/studio/trace/:id',
    builder: (context, state) {
      final id = state.pathParameters['id'] ?? '';
      return Consumer(
        builder: (context, ref, _) {
          final childId = ref.watch(childProvider).activeChildId;
          if (childId == null || childId.isEmpty) {
            return const _RouteMessage(
              icon: Icons.face_outlined,
              title: 'اختر طفلًا أولًا',
              body: 'الاستوديو يحفظ الرسومات في مساحة الطفل المحدد.',
            );
          }
          return TraceDeepLinkResolver(childId: childId, itemId: id);
        },
      );
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
    path: '/help-signin',
    builder: (context, state) => const HelpSignInPage(),
  ),
  GoRoute(path: '/terms', builder: (context, state) => const PrivacyPage()),
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
    builder: (context, state) => _PinGatePage(
      returnTo: state.uri.queryParameters['from'],
      // `stage` يحمل **جواب الخادم** بعد أن يُكذّب الاستدلال المحلي، فلا
      // يُعاد سؤال `hasPin()` الذي أخطأ أصلًا. انظر `_PinGatePage`.
      stage: state.uri.queryParameters['stage'],
    ),
  ),
  GoRoute(
    path: '/children',
    builder: (context, state) => const ChildSwitcherPage(),
  ),
  GoRoute(
    path: '/onboarding',
    builder: (context, state) => const OnboardingFlowPage(),
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

/// Dispatches `/parent-pin?from=<loc>` to [PinSetupPage] or [PinUnlockPage]
/// (Component 11, Requirement 11.1, 11.2, 11.6).
///
/// Keeps a single literal route path (`/parent-pin`) in `_routes`,
/// `_guardRedirect`, `route_access.dart`, and every external call site
/// (`devices_page.dart`, `account_data_page.dart`, `playback_page.dart`,
/// `parent_dashboard_page.dart`, `home_destination_spec.dart`,
/// `my_collection_route.dart`, `child_switcher_page.dart`) — none of them
/// need to know which of the two screens actually renders. Acceptance
/// criteria 11.1/11.2 only require the user see the correct one of the two
/// screens, not that the URL itself differs between them, so a dispatcher
/// builder is the least invasive way to satisfy both without touching
/// `route_guard_matrix_test.dart`'s route-name extraction or any of the
/// seven external call sites above.
///
/// `ParentPinStore.hasPin()` is a local heuristic (a per-device mirror of
/// whether *this* device ever enrolled a PIN for the current owner), not a
/// server fact — the server is the only authority on real enrolment state.
/// Both [PinSetupPage] and [PinUnlockPage] self-heal when this guess turns
/// out wrong (403 on setup, 404 on unlock) by navigating to the other one,
/// so a wrong first guess here costs one extra round trip, never a stuck
/// screen.
///
/// ## ولماذا يلزم [stage]
///
/// «التطبيبُ الذاتي» كان يعود إلى `/parent-pin` **بلا أي معلومة جديدة**، وهذا
/// المُوزِّع يُعيد سؤال `hasPin()` نفسه — وهو المصدر الذي أخطأ أوّلًا. فالجواب
/// لا يتغيّر، فيُعاد بناء نفس الشاشة، ويُعاد الطلب، ويُعاد 403: حلقة مفرغة لا
/// «رحلة ذهابٍ واحدة زائدة». وهذا ما ظهر على المتصفّح كـ
/// `POST /api/v1/family/parent-pin 403 (Forbidden)` بلا تقدّم.
///
/// و`stage` يحمل جواب الخادم عبر عنوان المسار: `unlock` يعني «الخادم يقول إن
/// رمزًا موجود» و`setup` يعني «الخادم يقول لا رمز». وحين يُمرَّر، يُقدَّم على
/// الاستدلال المحلي بلا قراءةٍ للمخزن الآمن أصلًا.
class _PinGatePage extends ConsumerStatefulWidget {
  const _PinGatePage({this.returnTo, this.stage});

  final String? returnTo;

  /// `'unlock'` أو `'setup'` — جواب الخادم بعد أن كذّب الاستدلال المحلي.
  /// `null` في الدخول الأوّل، فيُستشار المخزن المحلي كما كان.
  final String? stage;

  @override
  ConsumerState<_PinGatePage> createState() => _PinGatePageState();
}

class _PinGatePageState extends ConsumerState<_PinGatePage> {
  bool _loading = true;
  bool _hasPin = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    // جواب الخادم يسبق كل استدلال محلي: بلا هذا الفرع يعود المُوزِّع إلى
    // `hasPin()` الذي أخطأ فتُعاد نفس الشاشة ويُعاد نفس 403 بلا نهاية.
    final stage = widget.stage;
    if (stage == 'unlock' || stage == 'setup') {
      setState(() {
        _hasPin = stage == 'unlock';
        _loading = false;
      });
      return;
    }
    final guard = ref.read(authGuardProvider);
    bool hasPin;
    try {
      hasPin = await ref.read(parentPinStoreProvider).hasPin(ownerId: guard.parentId);
    } catch (_) {
      hasPin = false;
    }
    if (!mounted) return;
    setState(() {
      _hasPin = hasPin;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.deepSpace,
        body: Center(child: CircularProgressIndicator(color: AppColors.starGold)),
      );
    }
    return _hasPin
        ? PinUnlockPage(returnTo: widget.returnTo)
        : PinSetupPage(returnTo: widget.returnTo);
  }
}

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
