import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../core/widgets/cinematic_image.dart';
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
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        titleSpacing: padding,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: AppColors.cosmicPurple.withValues(alpha: 0.18),
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.cosmicPurple.withValues(alpha: 0.35),
                  width: 1,
                ),
              ),
              child: const Icon(
                Icons.explore_rounded,
                size: 18,
                color: Color(0xFFC7B8FF),
              ),
            ),
            const SizedBox(width: 10),
            const Text(
              'استكشف',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.2,
              ),
            ),
          ],
        ),
      ),
      body: CinematicBackground(
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(
                  padding,
                  4,
                  padding,
                  padding,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _ExploreSearchBar(onTap: () => context.push('/search')),
                    const SizedBox(height: 18),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.92,
                      children: [
                        _Dest(
                          assetPath: 'assets/images/explore/explore-watch.webp',
                          icon: Icons.play_circle_fill_rounded,
                          label: 'شاهد',
                          color: const Color(0xFF2580FF),
                          onTap: () => context.push('/watch'),
                        ),
                        _Dest(
                          assetPath: 'assets/images/explore/explore-play.webp',
                          icon: Icons.sports_esports_rounded,
                          label: 'العب',
                          color: const Color(0xFF5BE7A9),
                          onTap: () => context.push('/play'),
                        ),
                        _Dest(
                          assetPath: 'assets/images/explore/explore-read.webp',
                          icon: Icons.menu_book_rounded,
                          label: 'اقرأ',
                          color: const Color(0xFF9D68FF),
                          onTap: () => context.push('/read'),
                        ),
                        _Dest(
                          assetPath:
                              'assets/images/explore/explore-listen.webp',
                          icon: Icons.headphones_rounded,
                          label: 'استمع',
                          color: const Color(0xFFFF6FAE),
                          onTap: () => context.push('/listen'),
                        ),
                        _Dest(
                          assetPath: 'assets/images/explore/explore-draw.webp',
                          icon: Icons.brush_rounded,
                          label: 'ارسم',
                          color: const Color(0xFFFFB52E),
                          onTap: () => context.push('/studio'),
                        ),
                        _Dest(
                          assetPath:
                              'assets/images/explore/explore-planets.webp',
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
    required this.assetPath,
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final String assetPath;
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xFF121A38),
    borderRadius: BorderRadius.circular(18),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          CinematicImage(
            assetPath: assetPath,
            semanticLabel: label,
            fit: BoxFit.cover,
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  Color(0x3306091A),
                  Color(0xF206091A),
                ],
                stops: [0.35, 0.62, 1],
              ),
            ),
          ),
          PositionedDirectional(
            top: 10,
            start: 10,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.94),
                boxShadow: const [
                  BoxShadow(color: Colors.black26, blurRadius: 10),
                ],
              ),
              child: Icon(icon, color: color, size: 20),
            ),
          ),
          PositionedDirectional(
            start: 14,
            end: 14,
            bottom: 14,
            child: Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w800,
                shadows: [Shadow(color: Colors.black87, blurRadius: 8)],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _ExploreSearchBar extends StatelessWidget {
  const _ExploreSearchBar({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'ابحث في محتوى مجرة',
      child: Material(
        color: const Color(0xFF101735),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            height: 50,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.12),
                width: 1.0,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.28),
                  blurRadius: 12,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.search_rounded,
                  color: AppColors.starGold,
                  size: 22,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'ابحث عن المسلسلات، الألعاب، أو الكواكب...',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.mutedText.withValues(alpha: 0.85),
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.tune_rounded,
                    size: 16,
                    color: AppColors.mutedText,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
