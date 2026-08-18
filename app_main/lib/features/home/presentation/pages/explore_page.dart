import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../application/home_providers.dart';
import '../widgets/content_cards.dart';
import '../widgets/content_rail.dart';
import '../../domain/content_models.dart';

class ExplorePage extends ConsumerWidget {
  const ExplorePage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(homeCatalogProvider).valueOrNull;
    final padding = context.horizontalPagePadding;
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      appBar: AppBar(
        backgroundColor: AppColors.deepSpace,
        foregroundColor: Colors.white,
        title: const Text('استكشف'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search_rounded),
            onPressed: () => context.push('/search'),
            tooltip: 'بحث',
          ),
        ],
      ),
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(padding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    FilledButton.icon(
                      onPressed: () => context.go('/'),
                      icon: const Icon(Icons.search_rounded),
                      label: const Text('ابحث في مجرة'),
                    ),
                    const SizedBox(height: 18),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 1.35,
                      children: [
                        _Dest(
                          icon: Icons.play_circle_fill_rounded,
                          label: 'شاهد',
                          color: const Color(0xFF2580FF),
                          onTap: () => context.push('/watch'),
                        ),
                        _Dest(
                          icon: Icons.sports_esports_rounded,
                          label: 'العب',
                          color: const Color(0xFF5BE7A9),
                          onTap: () => context.push('/play'),
                        ),
                        _Dest(
                          icon: Icons.menu_book_rounded,
                          label: 'اقرأ',
                          color: const Color(0xFF9D68FF),
                          onTap: () => context.push('/read'),
                        ),
                        _Dest(
                          icon: Icons.headphones_rounded,
                          label: 'استمع',
                          color: const Color(0xFFFF6FAE),
                          onTap: () => context.push('/listen'),
                        ),
                        _Dest(
                          icon: Icons.brush_rounded,
                          label: 'ارسم',
                          color: const Color(0xFFFFB52E),
                          onTap: () => context.push('/studio'),
                        ),
                        _Dest(
                          icon: Icons.public_rounded,
                          label: 'الكواكب',
                          color: AppColors.royalBlue,
                          onTap: () => context.push('/planets'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (catalog != null && catalog.series.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 22),
                  child: ContentRail<SeriesItem>(
                    title: 'جديد في مجرة',
                    items: catalog.series.reversed.take(6).toList(),
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
            if (catalog != null && catalog.series.any((s) => s.isFree))
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 22),
                  child: ContentRail<SeriesItem>(
                    title: 'شاهد مجاناً',
                    items: catalog.series
                        .where((s) => s.isFree)
                        .take(6)
                        .toList(),
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
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(padding),
                child: OutlinedButton(
                  onPressed: () => context.push('/shorts'),
                  child: const Text('مقاطع قصيرة — شاهد'),
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
    );
  }
}

class _Dest extends StatelessWidget {
  const _Dest({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xFF121A38),
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(alpha: 0.18),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    ),
  );
}
