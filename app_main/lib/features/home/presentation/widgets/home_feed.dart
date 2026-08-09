import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/analytics/analytics.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/animated_brand_logo.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../application/home_providers.dart';
import '../../domain/content_models.dart';
import '../../domain/feed_blocks.dart';
import 'cinematic_hero.dart';
import 'content_cards.dart';
import 'content_rail.dart';

class HomeFeed extends ConsumerWidget {
  const HomeFeed({
    required this.catalog,
    required this.isTelevision,
    this.onOpenPlanets,
    this.onOpenPlanet,
    this.isReturning = false,
    super.key,
  });

  final HomeCatalog catalog;
  final bool isTelevision;
  final VoidCallback? onOpenPlanets;
  final ValueChanged<String>? onOpenPlanet;
  final bool isReturning;

  /// Blocks that pass their visibility rule, in contract order.
  static List<HomeBlock> _visibleBlocks(
    HomeFeedContract contract,
    HomeCatalog catalog,
  ) => contract.blocks
      .where((block) => BlockRenderer.shouldShowBlock(block, catalog))
      .toList();

  /// First visible block that renders a focusable rail. The hero slider and the
  /// welcome card are skipped so the remote lands on real content.
  static HomeBlock? _firstFocusableBlock(
    HomeFeedContract contract,
    HomeCatalog catalog,
  ) {
    const skipped = {
      BlockType.heroSlider,
      BlockType.welcomeJourney,
    };
    for (final block in _visibleBlocks(contract, catalog)) {
      if (!skipped.contains(block.type)) return block;
    }
    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (catalog.series.isEmpty) {
      return _EmptyHome(onRefresh: () => ref.invalidate(homeCatalogProvider));
    }

    final padding = context.horizontalPagePadding;
    final contract = isReturning ? HomeFeedContract.forReturning() : HomeFeedContract.forNewcomer();
    final firstFocusable = _firstFocusableBlock(contract, catalog);

    return CinematicBackground(
      showTopGlow: true,
      child: CustomScrollView(
        key: const PageStorageKey('home-feed'),
        slivers: [
          SliverAppBar(
            pinned: true,
            toolbarHeight: isTelevision ? 82 : 72,
            backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
            surfaceTintColor: Colors.transparent,
            scrolledUnderElevation: 0,
            elevation: 0,
            titleSpacing: padding,
            flexibleSpace: ClipRRect(
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF0B1026).withValues(alpha: 0.88),
                  border: Border(
                    bottom: BorderSide(color: Colors.white.withValues(alpha: 0.06)),
                  ),
                ),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [AppColors.royalBlue.withValues(alpha: 0.08), Colors.transparent],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            title: _HomeHeader(catalog: catalog, onOpenPlanets: onOpenPlanets),
          ),

          // Dynamic Blocks rendering. The first rail-bearing block owns the
          // initial television focus, so it is flagged here rather than letting
          // every rail claim autofocus.
          for (final block in _visibleBlocks(contract, catalog))
            _BlockSliver(
              block: block,
              catalog: catalog,
              isTelevision: isTelevision,
              padding: padding,
              isFirstBlock: block == firstFocusable,
              onOpenPlanets: onOpenPlanets,
              onOpenPlanet: onOpenPlanet,
            ),

          if (catalog.usesLocalFallback)
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(padding, 18, padding, 0),
                child: _FallbackNotice(onRefresh: () => ref.invalidate(homeCatalogProvider)),
              ),
            ),

          SliverToBoxAdapter(child: SizedBox(height: isTelevision ? 72 : 98)),
        ],
      ),
    );
  }
}

class _BlockSliver extends StatelessWidget {
  const _BlockSliver({
    required this.block,
    required this.catalog,
    required this.isTelevision,
    required this.padding,
    this.isFirstBlock = false,
    this.onOpenPlanets,
    this.onOpenPlanet,
  });

  final HomeBlock block;
  final HomeCatalog catalog;
  final bool isTelevision;
  final double padding;

  /// True for the first rail-bearing block, which owns the initial TV focus.
  final bool isFirstBlock;
  final VoidCallback? onOpenPlanets;
  final ValueChanged<String>? onOpenPlanet;

  @override
  Widget build(BuildContext context) {
    switch (block.type) {
      case BlockType.heroSlider:
        return SliverToBoxAdapter(
          child: CinematicHeroSlider(
            spotlights: catalog.spotlights,
            series: catalog.series,
            isTelevision: isTelevision,
            onOpenSeries: (item) {
              // H9: the analytics class existed with zero call sites. The
              // spotlight id, not the series id, is logged because the event is
              // about which curated slide converted.
              final spotlight = catalog.spotlights
                  .where((s) => s.seriesId == item.id)
                  .firstOrNull;
              if (spotlight != null) MajarraAnalytics.heroAction(spotlight.id);
              context.push('/series/${item.id}');
            },
          ),
        );

      case BlockType.welcomeJourney:
        return SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(padding, 22, padding, 0),
            child: _WelcomeJourneyCard(
              onExplore: () => onOpenPlanets?.call(),
            ),
          ),
        );

      case BlockType.continueJourney:
        // Placeholder rail: real "continue watching" needs progress sync.
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 26),
            child: ContentRail<SeriesItem>(
              title: block.title ?? 'استمر من حيث توقفت',
              subtitle: block.subtitle ?? 'أكمل رحلتك في دقائق',
              items: catalog.series.take(4).toList(),
              height: isTelevision ? 354 : 282,
              horizontalPadding: padding,
              isTelevision: isTelevision,
              itemBuilder: (context, item, index) => Stack(
                children: [
                  SeriesCard(
                    item: item,
                    isTelevision: isTelevision,
                    // First card of the first rail is the remote's entry point.
                    autofocus: isTelevision && isFirstBlock && index == 0,
                    onPressed: () => context.push('/series/${item.id}'),
                  ),
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                      child: LinearProgressIndicator(
                        value: 0.42 + (index * 0.12),
                        backgroundColor: Colors.white.withValues(alpha: 0.12),
                        valueColor: const AlwaysStoppedAnimation(AppColors.starGold),
                        minHeight: 4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );

      case BlockType.worldOrbit:
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 26),
            child: ContentRail<Planet>(
              title: block.title ?? 'الكواكب',
              subtitle: block.subtitle ?? 'اختر عالمًا، ثم شاهد سلاسله وحلقاته وأنشطته',
              items: catalog.planets,
              height: isTelevision ? 226 : 190,
              horizontalPadding: padding,
              isTelevision: isTelevision,
              onSeeAll: onOpenPlanets,
              itemBuilder: (context, item, index) => PlanetCard(
                item: item,
                isTelevision: isTelevision,
                onPressed: () {
                  if (onOpenPlanet != null) {
                    onOpenPlanet!(item.id);
                  } else {
                    onOpenPlanets?.call();
                  }
                },
              ),
            ),
          ),
        );

      case BlockType.contentRail:
        final style = block.cardStyle;
        if (style == CardStyle.landscape) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 30),
              child: ContentRail<EpisodeItem>(
                title: block.title ?? 'رحلات قصيرة',
                subtitle: block.subtitle,
                items: catalog.episodes,
                height: isTelevision ? 247 : 208,
                horizontalPadding: padding,
              isTelevision: isTelevision,
                itemBuilder: (context, item, index) => EpisodeCard(
                  item: item,
                  isTelevision: isTelevision,
                  onPressed: () => context.push('/playback/${item.id}'),
                ),
              ),
            ),
          );
        }
        if (style == CardStyle.story) {
          final books = catalog.books.isNotEmpty ? catalog.books : catalog.series.take(3).map((s) => BookItem(id: s.id, title: s.title, description: s.description, type: 'picture_book', ageMin: s.ageMin, ageMax: s.ageMax, posterAsset: s.posterAsset)).toList();
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 30),
              child: ContentRail<BookItem>(
                title: block.title ?? 'قصص مصورة',
                subtitle: block.subtitle,
                items: books.take(6).toList(),
                height: isTelevision ? 354 : 282,
                horizontalPadding: padding,
              isTelevision: isTelevision,
                itemBuilder: (context, item, index) => BookCard(
                  item: item,
                  isTelevision: isTelevision,
                  // Audio stories open the narration player; other book types
                  // open the reader. Sending both to `/reader` made an audio
                  // story render as a silent page turner.
                  onPressed: () => context.push(
                    item.type == 'audio_story'
                        ? '/audio?bookId=${item.id}'
                        : '/reader/${item.id}',
                  ),
                ),
              ),
            ),
          );
        }
        if (style == CardStyle.square) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 30),
              child: ContentRail<ExperienceItem>(
                title: block.title ?? 'العب وتعلّم',
                subtitle: block.subtitle,
                items: catalog.experiences,
                height: isTelevision ? 322 : 266,
                horizontalPadding: padding,
              isTelevision: isTelevision,
                itemBuilder: (context, item, index) => ExperienceCard(
                  item: item,
                  isTelevision: isTelevision,
                  onPressed: () => context.push('/game/${item.id}'),
                ),
              ),
            ),
          );
        }
        // default portrait
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<SeriesItem>(
              title: block.title ?? 'سلاسل مختارة',
              subtitle: block.subtitle,
              items: catalog.series,
              height: isTelevision ? 354 : 282,
              horizontalPadding: padding,
              isTelevision: isTelevision,
              itemBuilder: (context, item, index) => SeriesCard(
                item: item,
                isTelevision: isTelevision,
                focusOrder: NumericFocusOrder(10 + index.toDouble()),
                onPressed: () => context.push('/series/${item.id}'),
              ),
            ),
          ),
        );

      case BlockType.featureBanner:
        final featured = catalog.series.isNotEmpty ? catalog.series.first : null;
        if (featured == null) return const SliverToBoxAdapter(child: SizedBox.shrink());
        return SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(padding, 30, padding, 0),
            child: _FeatureBannerCard(
              series: featured,
              isTelevision: isTelevision,
              onPlay: () => context.push('/series/${featured.id}'),
            ),
          ),
        );

      case BlockType.learningJourney:
        return SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(padding, 30, padding, 0),
            child: _LearningJourneyCard(isTelevision: isTelevision),
          ),
        );

      case BlockType.audioRail:
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<ExperienceItem>(
              title: block.title ?? 'استمع الآن',
              subtitle: 'قصص صوتية وأناشيد',
              items: catalog.experiences.take(4).toList(),
              height: isTelevision ? 260 : 220,
              horizontalPadding: padding,
              isTelevision: isTelevision,
              itemBuilder: (context, item, index) => InkWell(
                onTap: () => context.push('/audio?title=${Uri.encodeComponent(item.title)}&subtitle=${Uri.encodeComponent(item.subtitle)}'),
                borderRadius: BorderRadius.circular(16),
                child: _AudioCard(item: item, isTelevision: isTelevision),
              ),
            ),
          ),
        );

      case BlockType.comingSoon:
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: _ComingSoonRail(padding: padding, isTelevision: isTelevision, catalog: catalog, title: block.title, subtitle: block.subtitle),
          ),
        );

      case BlockType.watchFree:
        final freeItems = catalog.series.where((s) => s.isFree).toList();
        if (freeItems.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<SeriesItem>(
              title: block.title ?? 'شاهد مجاناً',
              subtitle: block.subtitle ?? 'بدون اشتراك',
              items: freeItems,
              height: isTelevision ? 354 : 282,
              horizontalPadding: padding,
              isTelevision: isTelevision,
              itemBuilder: (context, item, index) => Stack(
                children: [
                  SeriesCard(item: item, isTelevision: isTelevision, onPressed: () => context.push('/series/${item.id}')),
                  PositionedDirectional(
                    top: 8,
                    end: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(color: AppColors.success, borderRadius: BorderRadius.circular(6)),
                      child: const Text('مجاني', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );

      case BlockType.newReleases:
        final newItems = catalog.series.reversed.take(5).toList();
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<SeriesItem>(
              title: block.title ?? 'أعمال جديدة',
              subtitle: block.subtitle ?? 'أضيف مؤخراً',
              items: newItems,
              height: isTelevision ? 354 : 282,
              horizontalPadding: padding,
              isTelevision: isTelevision,
              itemBuilder: (context, item, index) => Stack(
                children: [
                  SeriesCard(item: item, isTelevision: isTelevision, onPressed: () => context.push('/series/${item.id}')),
                  if (index == 0)
                    PositionedDirectional(
                      top: 8,
                      start: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(color: AppColors.starGold, borderRadius: BorderRadius.circular(6)),
                        child: const Text('جديد', style: TextStyle(color: AppColors.deepSpace, fontSize: 9, fontWeight: FontWeight.w800)),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );

      case BlockType.mostWatched:
        final topItems = catalog.series.take(5).toList();
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: _MostWatchedRail(padding: padding, isTelevision: isTelevision, items: topItems),
          ),
        );

      case BlockType.becauseYouWatched:
        final recItems = catalog.series.skip(1).take(5).toList();
        if (recItems.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<SeriesItem>(
              title: block.title ?? 'لأنك شاهدت',
              subtitle: block.subtitle ?? 'قد يعجبك أيضاً',
              items: recItems,
              height: isTelevision ? 354 : 282,
              horizontalPadding: padding,
              isTelevision: isTelevision,
              itemBuilder: (context, item, index) => SeriesCard(item: item, isTelevision: isTelevision, onPressed: () => context.push('/series/${item.id}')),
            ),
          ),
        );

      case BlockType.characterOrbit:
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: _CharacterOrbitRail(padding: padding, isTelevision: isTelevision, catalog: catalog),
          ),
        );

      case BlockType.seasonalBanner:
        return SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(padding, 30, padding, 0),
            child: _SeasonalBannerCard(),
          ),
        );
    }
  }

  // `_unpublishedEpisode` and `_comingSoon` were removed: the player now owns
  // that messaging itself. `PlaybackPage` shows an explicit state when an
  // episode has no uploaded video, so a duplicate snackbar helper here had no
  // remaining caller.
}

// --- Block-specific widgets ---

class _WelcomeJourneyCard extends StatelessWidget {
  const _WelcomeJourneyCard({this.onExplore});
  final VoidCallback? onExplore;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [const Color(0xFF1C2550), const Color(0xFF0A102A)],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.32), blurRadius: 24, offset: const Offset(0, 12))],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.starGold),
            child: const Icon(Icons.rocket_launch_rounded, color: AppColors.deepSpace),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('مرحبًا بك في مجرة — ابدأ من هنا', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 4),
                Text('اختر كوكبك، ثم شاهد سلسلة، اقرأ قصة، والعب لعبة.', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.8), fontSize: 11.5)),
              ],
            ),
          ),
          FilledButton(onPressed: onExplore, style: FilledButton.styleFrom(backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace), child: const Text('انطلق')),
        ],
      ),
    );
  }
}

class _FeatureBannerCard extends StatelessWidget {
  const _FeatureBannerCard({required this.series, required this.isTelevision, required this.onPlay});
  final SeriesItem series;
  final bool isTelevision;
  final VoidCallback onPlay;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: isTelevision ? 380 : 320,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.42), blurRadius: 32, offset: const Offset(0, 16))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(series.bannerAsset, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppColors.indigoSurface)),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Colors.black.withValues(alpha: 0.22), const Color(0xFF06091A).withValues(alpha: 0.88), const Color(0xFF06091A)],
                stops: const [0, 0.38, 0.72, 1],
              ),
            ),
          ),
          PositionedDirectional(
            start: 20,
            end: 20,
            bottom: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.starGold, borderRadius: BorderRadius.circular(6)),
                  child: const Text('حملة الأسبوع', style: TextStyle(color: AppColors.deepSpace, fontSize: 10, fontWeight: FontWeight.w800)),
                ),
                const SizedBox(height: 10),
                Text(series.title, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, shadows: [Shadow(color: Colors.black87, blurRadius: 10)])),
                const SizedBox(height: 8),
                Text(series.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.white.withValues(alpha: 0.82), fontSize: 12.5, height: 1.5)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 48,
                        child: FilledButton.icon(
                          onPressed: onPlay,
                          style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.deepSpace),
                          icon: const Icon(Icons.play_arrow_rounded),
                          label: const Text('شاهد الآن'),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), shape: BoxShape.circle, border: Border.all(color: Colors.white.withValues(alpha: 0.18))),
                      child: const Icon(Icons.add_rounded, color: Colors.white),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LearningJourneyCard extends StatelessWidget {
  const _LearningJourneyCard({required this.isTelevision});
  final bool isTelevision;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(colors: [const Color(0xFF16204A), const Color(0xFF0B1026)]),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: AppColors.electricCyan.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(99)),
                child: const Text('رحلة تعليمية', style: TextStyle(color: AppColors.electricCyan, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
              const Spacer(),
              Text('3 خطوات • 12 دقيقة', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7), fontSize: 10)),
            ],
          ),
          const SizedBox(height: 14),
          const Text('مغامرة الحروف الأولى', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('اقرأ، استمع، ثم العب - خطوة بخطوة', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.75), fontSize: 12)),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(value: 0.34, backgroundColor: Colors.white.withValues(alpha: 0.10), valueColor: const AlwaysStoppedAnimation(AppColors.starGold), minHeight: 6),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.play_circle_fill_rounded, color: AppColors.starGold, size: 20),
              const SizedBox(width: 6),
              Text('الخطوة التالية: استمع للحرف', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.9), fontSize: 11)),
              const Spacer(),
              // "تابع" had an empty callback. This whole card is a mock: the
              // title, the 0.34 progress and the step copy are all hardcoded,
              // and there is no learning-journey endpoint to resume from
              // (`learning_objectives` has zero rows). Disabled until the
              // journey is real, so the card cannot promise a resume that
              // silently does nothing.
              const TextButton(onPressed: null, child: Text('تابع')),
            ],
          ),
        ],
      ),
    );
  }
}

class _AudioCard extends StatelessWidget {
  const _AudioCard({required this.item, required this.isTelevision});
  final ExperienceItem item;
  final bool isTelevision;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: isTelevision ? 220 : 180,
      height: isTelevision ? 220 : 180,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: const Color(0xFF121A38),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.cosmicPurple),
              child: const Icon(Icons.headphones_rounded, color: Colors.white),
            ),
            const Spacer(),
            Text(item.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
            const SizedBox(height: 4),
            Text(item.subtitle, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7), fontSize: 11)),
            const SizedBox(height: 10),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(99)),
                  child: Row(
                    children: [
                      const Icon(Icons.play_arrow_rounded, size: 16, color: AppColors.deepSpace),
                      const SizedBox(width: 2),
                      Text('شغل', style: const TextStyle(color: AppColors.deepSpace, fontSize: 11, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Text('4 دقائق', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.6), fontSize: 10)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CharacterOrbitRail extends StatelessWidget {
  const _CharacterOrbitRail({required this.padding, required this.isTelevision, required this.catalog});
  final double padding;
  final bool isTelevision;
  final HomeCatalog catalog;

  @override
  Widget build(BuildContext context) {
    final characters = catalog.series.take(6).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
          child: Row(
            children: [
              const Text('شخصيات محبوبة', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(width: 6),
              Icon(Icons.chevron_left_rounded, color: Colors.white.withValues(alpha: 0.62), size: 20),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: isTelevision ? 140 : 120,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
            itemCount: characters.length,
            separatorBuilder: (_, __) => const SizedBox(width: 16),
            itemBuilder: (context, index) {
              final s = characters[index];
              return CharacterCircleCard(name: s.title.split(' ').first, imageAsset: s.posterAsset, onPressed: () => context.push('/series/${s.id}'), size: isTelevision ? 88 : 72);
            },
          ),
        ),
      ],
    );
  }
}

class _ComingSoonRail extends StatelessWidget {
  const _ComingSoonRail({required this.padding, required this.isTelevision, required this.catalog, this.title, this.subtitle});
  final double padding;
  final bool isTelevision;
  final HomeCatalog catalog;
  final String? title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final items = catalog.series.take(5).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
          child: Row(children: [Text(title ?? 'قريباً', style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)), const SizedBox(width: 6), Icon(Icons.chevron_left_rounded, color: Colors.white.withValues(alpha: 0.62), size: 20)]),
        ),
        if (subtitle != null) ...[const SizedBox(height: 4), Padding(padding: EdgeInsetsDirectional.symmetric(horizontal: padding), child: Text(subtitle!, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11.5)))],
        const SizedBox(height: 14),
        SizedBox(
          height: isTelevision ? 354 : 282,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final item = items[index];
              // No release-date field exists in the catalogue. A hardcoded
              // list of dates previously implied real scheduling, so only a
              // neutral badge is shown here.
              return Stack(
                children: [
                  SeriesCard(item: item, isTelevision: isTelevision, onPressed: () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${item.title} — لم يُعلن موعد العرض بعد')))),
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withValues(alpha: 0.22), Colors.black.withValues(alpha: 0.55)]),
                      ),
                    ),
                  ),
                  PositionedDirectional(
                    top: 8,
                    start: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                      decoration: BoxDecoration(color: const Color(0xFFE5485D), borderRadius: BorderRadius.circular(6)),
                      child: const Row(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.calendar_today_rounded, color: Colors.white, size: 10), SizedBox(width: 4), Text('قريباً', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700))]),
                    ),
                  ),
                  PositionedDirectional(
                    bottom: 48,
                    start: 10,
                    end: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.62), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.white.withValues(alpha: 0.12))),
                      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [const Icon(Icons.notifications_none_rounded, color: AppColors.starGold, size: 14), const SizedBox(width: 4), const Text('ذكرني', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700))]),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _MostWatchedRail extends StatelessWidget {
  const _MostWatchedRail({required this.padding, required this.isTelevision, required this.items});
  final double padding;
  final bool isTelevision;
  final List<SeriesItem> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(padding: EdgeInsetsDirectional.symmetric(horizontal: padding), child: Row(children: [const Text('الأكثر مشاهدة', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)), const SizedBox(width: 6), Icon(Icons.chevron_left_rounded, color: Colors.white.withValues(alpha: 0.62), size: 20)])),
        const SizedBox(height: 4),
        Padding(padding: EdgeInsetsDirectional.symmetric(horizontal: padding), child: Text('يتصدر المشاهدات هذا الأسبوع', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11.5))),
        const SizedBox(height: 14),
        SizedBox(
          height: isTelevision ? 354 : 282,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final item = items[index];
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  SeriesCard(item: item, isTelevision: isTelevision, onPressed: () => context.push('/series/${item.id}')),
                  PositionedDirectional(
                    top: -6,
                    start: -6,
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: index == 0 ? AppColors.starGold : index == 1 ? const Color(0xFFAAB5D1) : index == 2 ? const Color(0xFFD9903D) : const Color(0xFF1B2550), border: Border.all(color: Colors.white.withValues(alpha: 0.18)), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.32), blurRadius: 8)]),
                      child: Center(child: Text('${index + 1}', style: TextStyle(color: index < 3 ? AppColors.deepSpace : Colors.white, fontSize: 13, fontWeight: FontWeight.w900))),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _SeasonalBannerCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 140,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(colors: [const Color(0xFF2A1B5A), const Color(0xFF1B2550), const Color(0xFF0A102A)]),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(6)),
                  child: const Text('موسم جديد', style: TextStyle(color: AppColors.starGold, fontSize: 10, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(height: 10),
                const Text('رمضان - حكايات تضيء القلب', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('قصص وقيم بدون ضغط', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.75), fontSize: 11)),
              ],
            ),
          ),
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.08), border: Border.all(color: Colors.white.withValues(alpha: 0.12))),
            child: const Icon(Icons.nights_stay_rounded, color: AppColors.starGold, size: 36),
          ),
        ],
      ),
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.catalog, this.onOpenPlanets});

  final HomeCatalog catalog;
  final VoidCallback? onOpenPlanets;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 410;
    final freeSeries = catalog.series.where((item) => item.isFree).firstOrNull;

    return Row(
      children: [
        Image.asset('assets/brand/majarra-logo.png', width: compact ? 40 : 46, height: 40, fit: BoxFit.contain, semanticLabel: 'مجرة'),
        if (!compact) ...[const SizedBox(width: 7), Text('مجرة', style: Theme.of(context).textTheme.titleLarge)],
        const Spacer(),
        _HeaderTextAction(label: 'الكواكب', onPressed: onOpenPlanets),
        _HeaderTextAction(label: 'السلاسل', onPressed: catalog.series.isEmpty ? null : () => context.push('/series/${catalog.series.first.id}')),
        const SizedBox(width: 2),
        FilledButton(
          onPressed: freeSeries == null ? null : () => context.push('/series/${freeSeries.id}'),
          style: FilledButton.styleFrom(backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace, minimumSize: const Size(0, 40), padding: EdgeInsets.symmetric(horizontal: compact ? 9 : 13), visualDensity: VisualDensity.compact),
          child: Text(compact ? 'مجانًا' : 'جرّب مجانًا', maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}

class _HeaderTextAction extends StatelessWidget {
  const _HeaderTextAction({required this.label, this.onPressed});
  final String label;
  final VoidCallback? onPressed;
  @override
  Widget build(BuildContext context) {
    return TextButton(onPressed: onPressed, style: TextButton.styleFrom(foregroundColor: AppColors.starlight, minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 7), visualDensity: VisualDensity.compact), child: Text(label, maxLines: 1));
  }
}

class _FallbackNotice extends StatelessWidget {
  const _FallbackNotice({required this.onRefresh});
  final VoidCallback onRefresh;
  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: DecoratedBox(
        decoration: BoxDecoration(color: AppColors.indigoSurface.withValues(alpha: 0.76), borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.electricCyan.withValues(alpha: 0.18))),
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(14, 7, 8, 7),
          child: Row(
            children: [
              const Icon(Icons.cloud_off_outlined, color: AppColors.electricCyan, size: 20),
              const SizedBox(width: 9),
              Expanded(child: Text('نعرض المكتبة المحلية الآمنة حتى يصبح المحتوى المنشور متاحًا.', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.starlight))),
              IconButton(tooltip: 'تحديث المحتوى', onPressed: onRefresh, icon: const Icon(Icons.refresh_rounded)),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyHome extends StatelessWidget {
  const _EmptyHome({required this.onRefresh});
  final VoidCallback onRefresh;
  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.deepSpace,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AnimatedBrandLogo(size: 108),
              const SizedBox(height: 22),
              Text('لا توجد رحلات متاحة الآن', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 16),
              FilledButton.icon(onPressed: onRefresh, icon: const Icon(Icons.refresh_rounded), label: const Text('تحديث المكتبة')),
            ],
          ),
        ),
      ),
    );
  }
}
