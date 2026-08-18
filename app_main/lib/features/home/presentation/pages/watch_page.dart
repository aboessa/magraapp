import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../profile/data/progress_store.dart';
import '../../application/home_providers.dart';
import '../../domain/content_models.dart';
import '../widgets/content_cards.dart';
import '../widgets/content_rail.dart';

/// Watch landing — /watch
class WatchPage extends ConsumerWidget {
  const WatchPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalogAsync = ref.watch(homeCatalogProvider);
    return catalogAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, s) => Scaffold(body: Center(child: Text('تعذّر التحميل'))),
      data: (catalog) {
        final padding = context.horizontalPagePadding;
        final progress = ref.watch(progressProvider).valueOrNull ?? const {};
        final fractions = <String, double>{for (final e in progress.entries) if (e.value.isResumable && e.value.fraction != null) e.key: e.value.fraction!};
        final resumable = catalog.episodes.where((ep) => fractions.containsKey(ep.id)).toList();
        return Scaffold(
          backgroundColor: AppColors.deepSpace,
          appBar: AppBar(title: const Text('شاهد'), backgroundColor: AppColors.deepSpace, foregroundColor: Colors.white),
          body: CinematicBackground(
            child: CustomScrollView(slivers: [
              if (resumable.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 22),
                    child: ContentRail<EpisodeItem>(title: 'أكمل المشاهدة', items: resumable.take(6).toList(), height: 208, horizontalPadding: padding, itemBuilder: (c, item, i) => EpisodeCard(item: item, isTelevision: false, onPressed: () => context.push('/playback/${item.id}'))),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 22),
                  child: ContentRail<SeriesItem>(title: 'سلاسل', subtitle: '${catalog.series.length} عنوان', items: catalog.series.take(8).toList(), height: 282, horizontalPadding: padding, itemBuilder: (c, item, i) => SeriesCard(item: item, isTelevision: false, onPressed: () => context.push('/series/${item.id}'))),
                ),
              ),
              if (catalog.episodes.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 22),
                    child: ContentRail<EpisodeItem>(title: 'حلقات جديدة', items: catalog.episodes.reversed.take(6).toList(), height: 208, horizontalPadding: padding, itemBuilder: (c, item, i) => EpisodeCard(item: item, isTelevision: false, onPressed: () => context.push('/playback/${item.id}'))),
                  ),
                ),
              if (catalog.series.any((s) => s.isFree))
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 22),
                    child: ContentRail<SeriesItem>(title: 'شاهد مجاناً', items: catalog.series.where((s) => s.isFree).take(6).toList(), height: 282, horizontalPadding: padding, itemBuilder: (c, item, i) => SeriesCard(item: item, isTelevision: false, onPressed: () => context.push('/series/${item.id}'))),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(padding),
                  child: OutlinedButton.icon(onPressed: () => context.push('/shorts'), icon: const Icon(Icons.play_circle_outline), label: const Text('مقاطع قصيرة')),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 80)),
            ]),
          ),
        );
      },
    );
  }
}
