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

/// Watch landing — /watch — السلاسل + شاهد مجاناً
class WatchPage extends ConsumerStatefulWidget {
  const WatchPage({super.key});

  @override
  ConsumerState<WatchPage> createState() => _WatchPageState();
}

class _WatchPageState extends ConsumerState<WatchPage> {
  String _filter = 'الكل'; // الكل | مجاناً

  @override
  Widget build(BuildContext context) {
    final catalogAsync = ref.watch(homeCatalogProvider);
    return catalogAsync.when(
      loading: () => const Scaffold(
        backgroundColor: Color(0xFF0A102A),
        body: Center(child: CircularProgressIndicator(color: Color(0xFFFFD34D))),
      ),
      error: (e, s) => Scaffold(
        backgroundColor: const Color(0xFF0A102A),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0A102A),
          foregroundColor: Colors.white,
          title: const Text('السلاسل'),
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_rounded, size: 48, color: Colors.white24),
              const SizedBox(height: 12),
              const Text('تعذّر تحميل السلاسل', style: TextStyle(color: Colors.white70)),
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
      data: (catalog) {
        final padding = context.horizontalPagePadding;
        final progress = ref.watch(progressProvider).valueOrNull ?? const {};
        final fractions = <String, double>{
          for (final e in progress.entries)
            if (e.value.isResumable && e.value.fraction != null) e.key: e.value.fraction!
        };
        final resumable = catalog.episodes.where((ep) => fractions.containsKey(ep.id)).toList();
        final allSeries = catalog.series;
        final freeSeries = allSeries.where((s) => s.isFree).toList();
        final showFilter = _filter == 'مجاناً' ? freeSeries : allSeries;

        return Scaffold(
          backgroundColor: AppColors.deepSpace,
          appBar: AppBar(
            title: const Text('السلاسل'),
            backgroundColor: AppColors.deepSpace,
            foregroundColor: Colors.white,
            actions: [
              IconButton(
                tooltip: 'بحث',
                icon: const Icon(Icons.search_rounded),
                onPressed: () => context.push('/search'),
              ),
            ],
          ),
          body: CinematicBackground(
            child: CustomScrollView(
              slivers: [
                // Filter chips
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(padding, 12, padding, 8),
                    child: Row(
                      children: [
                        _FilterChip(
                          label: 'الكل',
                          count: allSeries.length,
                          selected: _filter == 'الكل',
                          onTap: () => setState(() => _filter = 'الكل'),
                        ),
                        const SizedBox(width: 8),
                        _FilterChip(
                          label: 'مجاناً',
                          count: freeSeries.length,
                          selected: _filter == 'مجاناً',
                          onTap: () => setState(() => _filter = 'مجاناً'),
                          icon: Icons.star_rounded,
                          selectedColor: const Color(0xFFFFD34D),
                        ),
                      ],
                    ),
                  ),
                ),

                // Hero banner
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: padding, vertical: 12),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF1A0B3E), Color(0xFF2A1B5A), Color(0xFF0A102A)],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.play_circle_fill_rounded, color: Color(0xFFFFD34D), size: 28),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _filter == 'مجاناً' ? 'شاهد مجاناً' : 'كل السلاسل',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                                ),
                                Text(
                                  _filter == 'مجاناً'
                                      ? '${freeSeries.length} سلسلة مجانية'
                                      : '${allSeries.length} سلسلة',
                                  style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          FilledButton(
                            onPressed: () => context.push('/explore'),
                            style: FilledButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: AppColors.deepSpace,
                            ),
                            child: const Text('استكشف'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                if (resumable.isNotEmpty && _filter == 'الكل')
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: ContentRail<EpisodeItem>(
                        title: 'أكمل المشاهدة',
                        items: resumable.take(6).toList(),
                        height: 208,
                        horizontalPadding: padding,
                        itemBuilder: (c, item, i) => EpisodeCard(
                          item: item,
                          isTelevision: false,
                          onPressed: () => context.push('/playback/${item.id}'),
                        ),
                      ),
                    ),
                  ),

                // Free rail always visible on top when filter is all
                if (freeSeries.isNotEmpty && _filter == 'الكل')
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 22),
                      child: ContentRail<SeriesItem>(
                        title: 'شاهد مجاناً',
                        subtitle: 'جرّب مجاناً',
                        items: freeSeries.take(6).toList(),
                        height: 282,
                        horizontalPadding: padding,
                        itemBuilder: (c, item, i) => SeriesCard(
                          item: item,
                          isTelevision: false,
                          onPressed: () => context.push('/series/${item.id}'),
                        ),
                      ),
                    ),
                  ),

                // Main grid
                if (showFilter.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(padding + 12),
                      child: Column(
                        children: [
                          const Icon(Icons.tv_off_rounded, size: 48, color: Colors.white24),
                          const SizedBox(height: 12),
                          Text(
                            _filter == 'مجاناً' ? 'لا توجد سلاسل مجانية حالياً' : 'لا توجد سلاسل',
                            style: const TextStyle(color: Colors.white70),
                          ),
                          const SizedBox(height: 12),
                          FilledButton.icon(
                            onPressed: () => ref.invalidate(homeCatalogProvider),
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('تحديث'),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(padding, 16, padding, 12),
                    sliver: SliverGrid(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 0.68,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (ctx, i) {
                          final item = showFilter[i];
                          return SeriesCard(
                            item: item,
                            isTelevision: false,
                            onPressed: () => context.push('/series/${item.id}'),
                          );
                        },
                        childCount: showFilter.length,
                      ),
                    ),
                  ),

                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(padding),
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/shorts'),
                      icon: const Icon(Icons.play_circle_outline),
                      label: const Text('مقاطع قصيرة'),
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 80)),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
    this.icon,
    this.selectedColor,
  });
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
  final Color? selectedColor;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: selected ? AppColors.deepSpace : Colors.white70),
            const SizedBox(width: 4),
          ],
          Text('$label ($count)'),
        ],
      ),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: selectedColor ?? AppColors.starGold,
      backgroundColor: const Color(0xFF121A38),
      labelStyle: TextStyle(
        color: selected ? AppColors.deepSpace : Colors.white70,
        fontWeight: FontWeight.w700,
        fontSize: 12,
      ),
      side: BorderSide(color: selected ? (selectedColor ?? AppColors.starGold) : Colors.white12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    );
  }
}
