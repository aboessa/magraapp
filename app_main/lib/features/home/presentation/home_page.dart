import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/device/device_profile.dart';
import '../../../core/widgets/animated_brand_logo.dart';
import '../application/home_providers.dart';
import '../domain/content_models.dart';
import '../../child/application/child_provider.dart';
import '../../games/application/game_providers.dart';
import 'shells/adaptive_home_shell.dart';
import 'shells/tv_home_shell.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final baseCatalog = ref.watch(homeCatalogProvider);
    final filtered = ref.watch(filteredCatalogProvider);
    // استخدم المفلتر حسب الطفل إن وجد، مع الحفاظ على حالة التحميل/الخطأ الأصلية
    final catalog = filtered.when(
      data: (value) => AsyncValue.data(value),
      loading: () => baseCatalog,
      error: (e, s) => baseCatalog,
    );
    final games = ref.watch(gameCatalogProvider);

    // Chrome must never wait for or inherit a TV device profile.
    if (kIsWeb) {
      return _catalogView(context, ref, catalog, games, isTelevision: false);
    }

    final device = ref.watch(deviceProfileProvider);
    return device.when(
      loading: () => const Scaffold(body: BrandLoadingView()),
      error: (_, __) =>
          _catalogView(context, ref, catalog, games, isTelevision: false),
      data: (profile) => _catalogView(
        context,
        ref,
        catalog,
        games,
        isTelevision: profile.isTelevision,
      ),
    );
  }

  Widget _catalogView(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<HomeCatalog> catalog,
    AsyncValue<List<ExperienceItem>> gameCatalog, {
    required bool isTelevision,
  }) {
    final games = gameCatalog is AsyncData<List<ExperienceItem>>
        ? gameCatalog.value
        : const <ExperienceItem>[];
    final effectiveCatalog = catalog.whenData(
      (value) => value.withServerGames(games, requireDpad: isTelevision),
    );

    return effectiveCatalog.when(
      loading: () => const Scaffold(body: BrandLoadingView()),
      error: (_, __) =>
          _HomeErrorView(onRetry: () => ref.invalidate(homeCatalogProvider)),
      data: (value) => isTelevision
          ? TvHomeShell(catalog: value)
          : AdaptiveHomeShell(catalog: value),
    );
  }
}

class _HomeErrorView extends StatelessWidget {
  const _HomeErrorView({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topCenter,
            radius: 1.2,
            colors: [AppColors.indigoSurface, AppColors.deepSpace],
          ),
        ),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const AnimatedBrandLogo(size: 108),
                const SizedBox(height: 24),
                Text(
                  'تعذّر تجهيز الرحلة',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  'جرّب مرة أخرى، وسنعود إلى مكتبتك بأمان.',
                  style: Theme.of(context).textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('إعادة المحاولة'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
