import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'dart:convert';
import 'dart:typed_data';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/analytics/analytics.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/animated_brand_logo.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../child/application/child_provider.dart';
import '../../../games/data/local_creation_store.dart';
import '../../../profile/data/progress_store.dart';
import '../../application/home_providers.dart';
import '../../domain/content_models.dart';
import '../../domain/feed_blocks.dart';
import 'cinematic_hero.dart';
import 'content_cards.dart';
import 'content_rail.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../../../core/widgets/focusable_scale.dart';

class HomeFeed extends ConsumerWidget {
  const HomeFeed({
    required this.catalog,
    required this.isTelevision,
    this.onOpenPlanets,
    this.onOpenPlanet,
    this.isReturning = false,
    this.onSelectSearch,
    this.onSelectProfile,
    this.onOpenPortal,
    super.key,
  });

  final HomeCatalog catalog;
  final bool isTelevision;
  final VoidCallback? onOpenPlanets;
  final ValueChanged<String>? onOpenPlanet;
  final bool isReturning;
  final VoidCallback? onSelectSearch;
  final VoidCallback? onSelectProfile;
  final VoidCallback? onOpenPortal;

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
    const skipped = {BlockType.heroSlider, BlockType.welcomeJourney};
    for (final block in _visibleBlocks(contract, catalog)) {
      if (!skipped.contains(block.type)) return block;
    }
    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!catalog.hasRenderableHomeContent) {
      return _EmptyHome(onRefresh: () => ref.invalidate(homeCatalogProvider));
    }

    final padding = context.horizontalPagePadding;

    // The order, titles and visibility of every row come from the Home Builder.
    //
    // This used to be a fixed sequence of slivers under a comment reading
    // `=== CANONICAL V1 SUPER-APP ORDER ===`, with six rows emitted directly and
    // the contract consulted only for the hero and the "remaining curated
    // blocks". No dashboard change could reach any of it. `homeLayoutProvider`
    // never fails: an unreachable configuration resolves to the built-in
    // fallback, so this screen has no error branch to render.
    final layout = ref.watch(homeLayoutProvider);
    final resolved = layout.valueOrNull;
    // A fallback layout picks its variant here, where `isReturning` is known: the
    // provider has no view of the child's history.
    final usesFallback = resolved == null || resolved.usesFallback;
    final contract = usesFallback
        ? HomeFeedContract.fallback(isReturning: isReturning)
        : resolved.contract;
    final firstFocusable = _firstFocusableBlock(contract, catalog);
    // Ambient bloom from hero accent — subtle streaming glow like V2.
    final heroAccent = _accentForHero(catalog);

    return Stack(
      fit: StackFit.expand,
      children: [
        // V2 ambient stage migrated into V1 — radial glow + starfield, low intensity.
        Positioned.fill(
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: AppColors.cinematicBackground,
              ),
              child: Stack(
                children: [
                  AnimatedContainer(
                    duration: MediaQuery.disableAnimationsOf(context)
                        ? Duration.zero
                        : const Duration(milliseconds: 900),
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: const Alignment(0.62, -0.86),
                        radius: 1.32,
                        colors: [
                          heroAccent.withValues(alpha: 0.18),
                          Colors.transparent,
                        ],
                        stops: const [0, 1],
                      ),
                    ),
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: Alignment(-0.78, 0.52),
                        radius: 1.1,
                        colors: [Color(0x291A3DF2), Colors.transparent],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        CinematicBackground(
          showTopGlow: true,
          child: CustomScrollView(
            key: const PageStorageKey('home-feed'),
            slivers: [
              SliverAppBar(
                pinned: true,
                toolbarHeight: isTelevision ? 82 : 72,
                backgroundColor: const Color(
                  0xFF0B1026,
                ).withValues(alpha: 0.88),
                surfaceTintColor: Colors.transparent,
                scrolledUnderElevation: 0,
                elevation: 0,
                titleSpacing: padding,
                flexibleSpace: ClipRRect(
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF0B1026).withValues(alpha: 0.88),
                      border: Border(
                        bottom: BorderSide(
                          color: Colors.white.withValues(alpha: 0.06),
                        ),
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
                                colors: [
                                  AppColors.royalBlue.withValues(alpha: 0.08),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                title: _HomeHeader(
                  catalog: catalog,
                  onOpenPlanets: onOpenPlanets,
                ),
              ),

              // A configuration problem is surfaced at the top, where a notice is
              // actually seen, rather than after every rail.
              if (resolved != null && resolved.usesFallback)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsetsDirectional.fromSTEB(
                      padding,
                      14,
                      padding,
                      0,
                    ),
                    child: _LayoutFallbackNotice(
                      onRefresh: () => ref.invalidate(resolvedHomeProvider),
                    ),
                  ),
                ),

              if (catalog.usesLocalFallback)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsetsDirectional.fromSTEB(
                      padding,
                      14,
                      padding,
                      0,
                    ),
                    child: _FallbackNotice(
                      onRefresh: () => ref.invalidate(homeCatalogProvider),
                    ),
                  ),
                ),

              // Every row, in the order the Home Builder saved.
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

              SliverToBoxAdapter(
                child: SizedBox(height: isTelevision ? 72 : 98),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Color _accentForHero(HomeCatalog cat) {
    final id = cat.spotlights.isNotEmpty ? cat.spotlights.first.seriesId : null;
    final s = id == null
        ? null
        : cat.series.where((e) => e.id == id).firstOrNull;
    final pid = s?.planetId ?? cat.planets.firstOrNull?.id ?? 'abjad';
    return switch (pid) {
      'abjad' => const Color(0xFF2580FF),
      'arqam' => const Color(0xFFFFB52E),
      'oloom' => const Color(0xFF32C979),
      'qiyam' => const Color(0xFFFF6FAE),
      'qisas' => const Color(0xFF9D68FF),
      'ibdaa' => const Color(0xFF6A3DF2),
      'maharat' => const Color(0xFF00BFA6),
      'tarikh' => const Color(0xFFD9903D),
      'iman' => const Color(0xFF2FBF8F),
      _ => AppColors.cosmicPurple,
    };
  }
}

/// Real continue watching — uses [progressProvider] fractions, no fake 0.42.
class _RealContinueSliver extends ConsumerWidget {
  const _RealContinueSliver({
    required this.catalog,
    required this.isTelevision,
    required this.padding,
    required this.isFirstBlock,
    this.title,
    this.subtitle,
  });
  final HomeCatalog catalog;
  final bool isTelevision;
  final double padding;
  final bool isFirstBlock;
  final String? title;
  final String? subtitle;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(progressProvider).valueOrNull ?? const {};
    final fractions = <String, double>{
      for (final e in progress.entries)
        if (e.value.isResumable && e.value.fraction != null)
          e.key: e.value.fraction!,
    };
    if (fractions.isEmpty) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }
    final resumable = catalog.episodes
        .where((ep) => fractions.containsKey(ep.id))
        .toList();
    if (resumable.isEmpty) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }
    // newest first via updatedAt
    resumable.sort((a, b) {
      final pa = progress[a.id]?.updatedAt;
      final pb = progress[b.id]?.updatedAt;
      if (pa == null || pb == null) return 0;
      return pb.compareTo(pa);
    });
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.only(top: 26),
        child: ContentRail<EpisodeItem>(
          title: title ?? 'أكمل ما بدأت',
          subtitle: subtitle ?? 'تابع المشاهدة من حيث توقفت',
          items: resumable.take(6).toList(),
          height: isTelevision ? 247 : 208,
          horizontalPadding: padding,
          isTelevision: isTelevision,
          itemBuilder: (context, item, index) => Stack(
            children: [
              EpisodeCard(
                item: item,
                isTelevision: isTelevision,
                autofocus: isFirstBlock && index == 0,
                onPressed: () => context.push('/playback/${item.id}'),
              ),
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    bottom: Radius.circular(14),
                  ),
                  child: LinearProgressIndicator(
                    value: fractions[item.id] ?? 0,
                    backgroundColor: Colors.white.withValues(alpha: 0.12),
                    valueColor: const AlwaysStoppedAnimation(
                      AppColors.starGold,
                    ),
                    minHeight: 4,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Explore Majarra — 6 large destination cards (شاهد/العب/اقرأ/استمع/ارسم/الكواكب)
// Reserved for Phase 2 discovery layout — kept behind hideWhenEmpty until wired
// ignore: unused_element
class _ExploreMajarraSection extends StatelessWidget {
  const _ExploreMajarraSection({
    required this.catalog,
    required this.isTelevision,
  });
  final HomeCatalog catalog;
  final bool isTelevision;
  @override
  Widget build(BuildContext context) {
    final destinations = _buildDestinations(context);
    final isTablet = MediaQuery.sizeOf(context).width >= 600;
    final cross = isTelevision ? 3 : (isTablet ? 3 : 2);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Text(
              'استكشف مجرة',
              style: TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(width: 6),
            Icon(
              Icons.chevron_left_rounded,
              color: Colors.white.withValues(alpha: 0.62),
              size: 20,
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'شاهد • العب • اقرأ • استمع • ارسم • اكتشف',
          style: TextStyle(
            color: AppColors.mutedText.withValues(alpha: 0.62),
            fontSize: 11.5,
          ),
        ),
        const SizedBox(height: 14),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: cross,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: isTelevision ? 1.4 : 1.35,
          ),
          itemCount: destinations.length,
          itemBuilder: (context, i) => _ExploreCard(dest: destinations[i]),
        ),
      ],
    );
  }

  List<_ExploreDest> _buildDestinations(BuildContext context) {
    final hasAudio = catalog.books.any(
      (b) => b.type == 'audio_story' || b.isPlayable,
    );
    return [
      _ExploreDest(
        id: 'watch',
        label: 'شاهد',
        desc: catalog.series.isEmpty
            ? 'سلاسل وحلقات'
            : '${catalog.series.length} سلسلة',
        icon: Icons.play_circle_fill_rounded,
        color: const Color(0xFF2580FF),
        onTap: () => context.push('/watch'),
      ),
      _ExploreDest(
        id: 'play',
        label: 'العب',
        desc: 'ألعاب تناسب عمرك',
        icon: Icons.sports_esports_rounded,
        color: const Color(0xFF5BE7A9),
        onTap: () => context.push('/play'),
      ),
      _ExploreDest(
        id: 'read',
        label: 'اقرأ',
        desc: 'قصص وكتب',
        icon: Icons.menu_book_rounded,
        color: const Color(0xFF9D68FF),
        onTap: () => context.push('/read'),
      ),
      if (hasAudio)
        _ExploreDest(
          id: 'listen',
          label: 'استمع',
          desc: 'حكايات مسموعة',
          icon: Icons.headphones_rounded,
          color: const Color(0xFFFF6FAE),
          onTap: () => context.push('/listen'),
        ),
      _ExploreDest(
        id: 'draw',
        label: 'ارسم',
        desc: 'استوديو الإبداع',
        icon: Icons.brush_rounded,
        color: const Color(0xFFFFB52E),
        onTap: () => context.push('/studio'),
      ),
      _ExploreDest(
        id: 'planets',
        label: 'الكواكب',
        desc: '${catalog.planets.length} عوالم',
        icon: Icons.public_rounded,
        color: AppColors.royalBlue,
        onTap: () => context.push('/planets'),
      ),
    ];
  }
}

class _ExploreDest {
  const _ExploreDest({
    required this.id,
    required this.label,
    required this.desc,
    required this.icon,
    required this.color,
    required this.onTap,
  });
  final String id;
  final String label;
  final String desc;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
}

class _ExploreCard extends StatelessWidget {
  const _ExploreCard({required this.dest});
  final _ExploreDest dest;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: dest.onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF121A38).withValues(alpha: 0.96),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withValues(alpha: 0.09)),
            gradient: LinearGradient(
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
              colors: [dest.color.withValues(alpha: 0.18), Colors.transparent],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: dest.color.withValues(alpha: 0.18),
                ),
                child: Icon(dest.icon, color: dest.color, size: 24),
              ),
              const Spacer(),
              Text(
                dest.label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                dest.desc,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.72),
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Horizontal slider — استكشف مجرة (after planets, compact rail)
class _ExploreMajarraRail extends StatelessWidget {
  const _ExploreMajarraRail({
    required this.catalog,
    required this.isTelevision,
    required this.horizontalPadding,
    this.title,
    this.subtitle,
  });
  final HomeCatalog catalog;
  final bool isTelevision;
  final double horizontalPadding;
  final String? title;
  final String? subtitle;
  @override
  Widget build(BuildContext context) {
    final hasAudio = catalog.books.any(
      (b) => b.type == 'audio_story' || b.isPlayable,
    );
    final items = <_RailDest>[
      _RailDest(
        id: 'watch',
        label: 'شاهد',
        subtitle: 'مسلسلات وحلقات',
        icon: Icons.play_circle_fill_rounded,
        color: const Color(0xFF2580FF),
        artworkAsset: 'assets/images/explore/explore-watch.webp',
        artworkUrl: null,
        onTap: () => context.push('/watch'),
      ),
      _RailDest(
        id: 'play',
        label: 'العب',
        subtitle: 'ألعاب وتحديات',
        icon: Icons.sports_esports_rounded,
        color: const Color(0xFF5BE7A9),
        artworkAsset: 'assets/images/explore/explore-play.webp',
        artworkUrl: null,
        onTap: () => context.push('/play'),
      ),
      _RailDest(
        id: 'read',
        label: 'اقرأ',
        subtitle: 'قصص وحكايات',
        icon: Icons.menu_book_rounded,
        color: const Color(0xFF9D68FF),
        artworkAsset: 'assets/images/explore/explore-read.webp',
        artworkUrl: null,
        onTap: () => context.push('/read'),
      ),
      if (hasAudio)
        _RailDest(
          id: 'listen',
          label: 'استمع',
          subtitle: 'حكايات مسموعة',
          icon: Icons.headphones_rounded,
          color: const Color(0xFFFF6FAE),
          artworkAsset: 'assets/images/explore/explore-listen.webp',
          artworkUrl: null,
          onTap: () => context.push('/listen'),
        ),
      _RailDest(
        id: 'draw',
        label: 'ارسم',
        subtitle: 'ارسم • لوّن • ابتكر',
        icon: Icons.brush_rounded,
        color: const Color(0xFFFFB52E),
        artworkAsset: 'assets/images/explore/explore-draw.webp',
        artworkUrl: null,
        onTap: () => context.push('/studio'),
      ),
      _RailDest(
        id: 'planets',
        label: 'الكواكب',
        subtitle: 'استكشف عالم مجرة',
        icon: Icons.public_rounded,
        color: AppColors.royalBlue,
        artworkAsset: 'assets/images/explore/explore-planets.webp',
        artworkUrl: null,
        onTap: () => context.push('/planets'),
      ),
    ];

    final cardWidth = isTelevision
        ? 220.0
        : (context.layoutClass == AppLayoutClass.compact ? 148.0 : 172.0);
    final cardHeight = cardWidth * 1.22;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsetsDirectional.symmetric(
            horizontal: horizontalPadding,
          ),
          child: Row(
            children: [
              Text(
                title ?? 'استكشف مجرة',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(width: 6),
              Icon(
                Icons.chevron_left_rounded,
                color: Colors.white.withValues(alpha: 0.62),
                size: 20,
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Padding(
          padding: EdgeInsetsDirectional.symmetric(
            horizontal: horizontalPadding,
          ),
          child: Text(
            subtitle ?? 'كل مغامراتك في مكان واحد',
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.62),
              fontSize: 11.5,
            ),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: cardHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: horizontalPadding,
            ),
            physics: isTelevision
                ? const ClampingScrollPhysics()
                : const BouncingScrollPhysics(),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final d = items[index];
              return _ExploreRailCard(
                dest: d,
                width: cardWidth,
                height: cardHeight,
                isTelevision: isTelevision,
              );
            },
          ),
        ),
      ],
    );
  }
}

class _RailDest {
  const _RailDest({
    required this.id,
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.artworkAsset,
    this.artworkUrl,
    required this.onTap,
  });
  final String id;
  final String label;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String artworkAsset;
  final String? artworkUrl;
  final VoidCallback onTap;
}

class _ExploreRailCard extends StatelessWidget {
  const _ExploreRailCard({
    required this.dest,
    required this.width,
    required this.height,
    required this.isTelevision,
  });
  final _RailDest dest;
  final double width;
  final double height;
  final bool isTelevision;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: FocusableScale(
        onPressed: dest.onTap,
        semanticLabel: dest.label,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            boxShadow: [
              BoxShadow(
                color: dest.color.withValues(alpha: 0.18),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.28),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CinematicImage(
                assetPath: dest.artworkAsset,
                networkUrl: dest.artworkUrl,
                semanticLabel: dest.label,
                fit: BoxFit.cover,
                decodeWidth: width,
              ),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.12),
                      const Color(0xFF06091A).withValues(alpha: 0.88),
                      const Color(0xFF06091A),
                    ],
                    stops: const [0, 0.35, 0.72, 1],
                  ),
                ),
              ),
              PositionedDirectional(
                top: 10,
                start: 10,
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.92),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.18),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  child: Icon(dest.icon, color: dest.color, size: 18),
                ),
              ),
              PositionedDirectional(
                start: 12,
                end: 12,
                bottom: 12,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      dest.label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        shadows: [Shadow(color: Colors.black87, blurRadius: 8)],
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      dest.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.82),
                        fontSize: 10.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Creative Studio first-class Home entry
class _CreativeStudioEntry extends StatelessWidget {
  const _CreativeStudioEntry({required this.isTelevision});
  final bool isTelevision;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          colors: [Color(0xFF2A1B5A), Color(0xFF1B2550), Color(0xFF0A102A)],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.starGold,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'استوديو الإبداع',
                    style: TextStyle(
                      color: AppColors.deepSpace,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'ارسم • لوّن • ابتكر',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'لوحاتك وألوانك في مكان واحد',
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.75),
                    fontSize: 11,
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: () => context.push('/studio'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.deepSpace,
                  ),
                  icon: const Icon(Icons.brush_rounded, size: 18),
                  label: const Text('ابدأ الرسم'),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: isTelevision ? 96 : 84,
            height: isTelevision ? 96 : 84,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.08),
              border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
            ),
            child: const Icon(
              Icons.palette_rounded,
              color: AppColors.starGold,
              size: 42,
            ),
          ),
        ],
      ),
    );
  }
}

/// Continue drawing — shows editable drawings only, hidden if none.
class _ContinueDrawingSliver extends ConsumerWidget {
  const _ContinueDrawingSliver({
    required this.isTelevision,
    required this.padding,
    this.title,
    this.subtitle,
  });
  final bool isTelevision;
  final double padding;
  final String? title;
  final String? subtitle;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childId = ref.watch(childProvider).activeChildId;
    if (childId == null || childId.isEmpty) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }
    final store = LocalCreationStore();
    return FutureBuilder<List<LocalCreation>>(
      future: store.list(childId),
      builder: (context, snap) {
        final all = snap.data ?? const [];
        final editable = all.where((c) => c.isEditable).take(6).toList();
        if (editable.isEmpty) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<LocalCreation>(
              title: title ?? 'أكمل رسمتك',
              subtitle: subtitle ?? 'آخر لوحاتك بانتظارك',
              items: editable,
              height: isTelevision ? 240 : 200,
              horizontalPadding: padding,
              isTelevision: isTelevision,
              itemBuilder: (context, item, index) => _DrawingCard(
                item: item,
                isTelevision: isTelevision,
                onPressed: () => context.push('/studio', extra: item),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _DrawingCard extends StatelessWidget {
  const _DrawingCard({
    required this.item,
    required this.isTelevision,
    required this.onPressed,
  });
  final LocalCreation item;
  final bool isTelevision;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) {
    Uint8List? bytes;
    try {
      bytes = base64Decode(item.pngBase64);
    } catch (_) {}
    final width = isTelevision ? 180.0 : 148.0;
    return SizedBox(
      width: width,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF121A38),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: bytes == null
                      ? Container(
                          color: AppColors.indigoSurface,
                          child: const Icon(
                            Icons.brush_rounded,
                            color: Colors.white54,
                          ),
                        )
                      : Image.memory(bytes, fit: BoxFit.cover),
                ),
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.displayTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '${item.createdAt.day}/${item.createdAt.month}',
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.6),
                          fontSize: 10,
                        ),
                      ),
                    ],
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

class _RecommendedSliver extends ConsumerWidget {
  const _RecommendedSliver({
    required this.catalog,
    required this.padding,
    required this.isTelevision,
    this.title,
    this.subtitle,
  });
  final HomeCatalog catalog;
  final double padding;
  final bool isTelevision;
  final String? title;
  final String? subtitle;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childId = ref.watch(childProvider).activeChildId;
    if (childId == null) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }
    final rec = ref.watch(recommendationsProvider(childId));
    return rec.when(
      data: (ids) {
        if (ids.isEmpty) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
        final items = [
          for (final id in ids)
            catalog.series.where((s) => s.id == id).firstOrNull,
        ].whereType<SeriesItem>().toList();
        if (items.isEmpty) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<SeriesItem>(
              title: title ?? 'اخترنا لك',
              subtitle: subtitle ?? 'قد يعجبك',
              items: items.take(6).toList(),
              height: isTelevision ? 354 : 282,
              horizontalPadding: padding,
              isTelevision: isTelevision,
              itemBuilder: (c, item, i) => SeriesCard(
                item: item,
                isTelevision: isTelevision,
                onPressed: () => context.push('/series/${item.id}'),
              ),
            ),
          ),
        );
      },
      loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
      error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
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
            child: _WelcomeJourneyCard(onExplore: () => onOpenPlanets?.call()),
          ),
        );

      case BlockType.continueJourney:
        // Real resume, from `progressProvider`. The sliver renders nothing when
        // there is no resumable item, which is why the block's visibility rule
        // can be unconditional.
        return _RealContinueSliver(
          catalog: catalog,
          isTelevision: isTelevision,
          padding: padding,
          isFirstBlock: isFirstBlock,
          title: block.title,
          subtitle: block.subtitle,
        );

      case BlockType.creativeStudio:
        return SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(padding, 22, padding, 0),
            child: _CreativeStudioEntry(isTelevision: isTelevision),
          ),
        );

      case BlockType.continueDrawing:
        return _ContinueDrawingSliver(
          isTelevision: isTelevision,
          padding: padding,
          title: block.title,
          subtitle: block.subtitle,
        );

      case BlockType.exploreMajarra:
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: _ExploreMajarraRail(
              catalog: catalog,
              isTelevision: isTelevision,
              horizontalPadding: padding,
              title: block.title,
              subtitle: block.subtitle,
            ),
          ),
        );

      case BlockType.newEpisodes:
        // Deterministic freshness: the last entries in catalogue order. There is
        // no publication timestamp on the client, so this is ordering, not a
        // claim about dates.
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<EpisodeItem>(
              title: block.title ?? 'حلقات جديدة',
              subtitle: block.subtitle ?? 'أضيفت حديثًا',
              items: catalog.episodes.reversed
                  .take(block.maxItems ?? 5)
                  .toList(),
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

      case BlockType.recentlyAdded:
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<SeriesItem>(
              title: block.title ?? 'جديد في مجرة',
              subtitle: block.subtitle ?? 'استكشف ما أضفناه لك',
              items: catalog.series.reversed.take(block.maxItems ?? 6).toList(),
              height: isTelevision ? 354 : 282,
              horizontalPadding: padding,
              isTelevision: isTelevision,
              itemBuilder: (context, item, index) => SeriesCard(
                item: item,
                isTelevision: isTelevision,
                onPressed: () => context.push('/series/${item.id}'),
              ),
            ),
          ),
        );

      case BlockType.recommended:
        return _RecommendedSliver(
          catalog: catalog,
          padding: padding,
          isTelevision: isTelevision,
          title: block.title,
          subtitle: block.subtitle,
        );

      case BlockType.worldOrbit:
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 26),
            child: ContentRail<Planet>(
              title: block.title ?? 'الكواكب',
              subtitle:
                  block.subtitle ??
                  'اختر عالمًا، ثم شاهد سلاسله وحلقاته وأنشطته',
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
          // Stories are canonical; books are the legacy shelf. They are
          // combined without inventing books from unrelated series rows.
          final storyIds = catalog.stories.map((story) => story.id).toSet();
          final books = <BookItem>[
            for (final story in catalog.stories)
              BookItem(
                id: story.id,
                title: story.title,
                description: story.description,
                type: story.type,
                ageMin: story.ageMin,
                ageMax: story.ageMax,
                posterAsset: 'assets/images/explore/explore-read.webp',
                coverUrl: story.coverUrl,
              ),
            for (final book in catalog.books)
              if (!storyIds.contains(book.id)) book,
          ];
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
                        ? Uri(
                            path: '/audio',
                            queryParameters: {'bookId': item.id},
                          ).toString()
                        : Uri(
                            path: '/reader/${item.id}',
                            queryParameters: {
                              'contentType': storyIds.contains(item.id)
                                  ? 'story'
                                  : 'book',
                            },
                          ).toString(),
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
                items: catalog.experiences
                    .where((item) => item.isServerBacked)
                    .toList(growable: false),
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
        final featured = catalog.series.isNotEmpty
            ? catalog.series.first
            : null;
        if (featured == null) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
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
        // Disabled: hardcoded 0.34 progress with no endpoint — hide until real journey.
        return const SliverToBoxAdapter(child: SizedBox.shrink());

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
                onTap: () => context.push(
                  '/audio?title=${Uri.encodeComponent(item.title)}&subtitle=${Uri.encodeComponent(item.subtitle)}',
                ),
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
            child: _ComingSoonRail(
              padding: padding,
              isTelevision: isTelevision,
              catalog: catalog,
              title: block.title,
              subtitle: block.subtitle,
            ),
          ),
        );

      case BlockType.watchFree:
        final freeItems = catalog.series.where((s) => s.isFree).toList();
        if (freeItems.isEmpty) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
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
                  SeriesCard(
                    item: item,
                    isTelevision: isTelevision,
                    onPressed: () => context.push('/series/${item.id}'),
                  ),
                  PositionedDirectional(
                    top: 8,
                    end: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.success,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'مجاني',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
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
                  SeriesCard(
                    item: item,
                    isTelevision: isTelevision,
                    onPressed: () => context.push('/series/${item.id}'),
                  ),
                  if (index == 0)
                    PositionedDirectional(
                      top: 8,
                      start: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.starGold,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'جديد',
                          style: TextStyle(
                            color: AppColors.deepSpace,
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );

      case BlockType.mostWatched:
        // Hidden until trustworthy analytics transport exists — no fake ranking.
        return const SliverToBoxAdapter(child: SizedBox.shrink());

      case BlockType.becauseYouWatched:
        // Hidden until rule-based recommendation engine provides truthful candidates.
        return const SliverToBoxAdapter(child: SizedBox.shrink());

      case BlockType.characterOrbit:
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: _CharacterOrbitRail(
              padding: padding,
              isTelevision: isTelevision,
              catalog: catalog,
            ),
          ),
        );

      case BlockType.seasonalBanner:
        return SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(padding, 30, padding, 0),
            child: _SeasonalBannerCard(
              title: block.title ?? '',
              subtitle: block.subtitle,
            ),
          ),
        );
      case BlockType.languageRail:
        // Language-specific rail — hide if no episodes/series, otherwise show landscape.
        if (catalog.episodes.isEmpty) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<EpisodeItem>(
              title: block.title ?? 'بلغتك',
              subtitle: block.subtitle,
              items: catalog.episodes.take(6).toList(),
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
      case BlockType.tvGamesRail:
        final tvGames = catalog.experiences
            .where((e) => e.isServerBacked && e.supportsTelevision)
            .toList();
        if (tvGames.isEmpty) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: ContentRail<ExperienceItem>(
              title: block.title ?? 'ألعاب للتلفزيون',
              subtitle: block.subtitle,
              items: tvGames,
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
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.32),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.starGold,
            ),
            child: const Icon(
              Icons.rocket_launch_rounded,
              color: AppColors.deepSpace,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'مرحبًا بك في مجرة — ابدأ من هنا',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'اختر كوكبك، ثم شاهد سلسلة، اقرأ قصة، والعب لعبة.',
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.8),
                    fontSize: 11.5,
                  ),
                ),
              ],
            ),
          ),
          FilledButton(
            onPressed: onExplore,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.starGold,
              foregroundColor: AppColors.deepSpace,
            ),
            child: const Text('انطلق'),
          ),
        ],
      ),
    );
  }
}

class _FeatureBannerCard extends StatelessWidget {
  const _FeatureBannerCard({
    required this.series,
    required this.isTelevision,
    required this.onPlay,
  });
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
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.42),
            blurRadius: 32,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            series.bannerAsset,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) =>
                Container(color: AppColors.indigoSurface),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.22),
                  const Color(0xFF06091A).withValues(alpha: 0.88),
                  const Color(0xFF06091A),
                ],
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.starGold,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'حملة الأسبوع',
                    style: TextStyle(
                      color: AppColors.deepSpace,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  series.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    shadows: [Shadow(color: Colors.black87, blurRadius: 10)],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  series.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.82),
                    fontSize: 12.5,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 48,
                        child: FilledButton.icon(
                          onPressed: onPlay,
                          style: FilledButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: AppColors.deepSpace,
                          ),
                          icon: const Icon(Icons.play_arrow_rounded),
                          label: const Text('شاهد الآن'),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.18),
                        ),
                      ),
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

// ignore: unused_element
class _LearningJourneyCard extends StatelessWidget {
  // ignore: unused_element
  const _LearningJourneyCard({required this.isTelevision});
  final bool isTelevision;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          colors: [const Color(0xFF16204A), const Color(0xFF0B1026)],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: AppColors.electricCyan.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: const Text(
                  'رحلة تعليمية',
                  style: TextStyle(
                    color: AppColors.electricCyan,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                '3 خطوات • 12 دقيقة',
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.7),
                  fontSize: 10,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Text(
            'مغامرة الحروف الأولى',
            style: TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'اقرأ، استمع، ثم العب - خطوة بخطوة',
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.75),
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: 0.34,
              backgroundColor: Colors.white.withValues(alpha: 0.10),
              valueColor: const AlwaysStoppedAnimation(AppColors.starGold),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(
                Icons.play_circle_fill_rounded,
                color: AppColors.starGold,
                size: 20,
              ),
              const SizedBox(width: 6),
              Text(
                'الخطوة التالية: استمع للحرف',
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.9),
                  fontSize: 11,
                ),
              ),
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
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.cosmicPurple,
              ),
              child: const Icon(Icons.headphones_rounded, color: Colors.white),
            ),
            const Spacer(),
            Text(
              item.title,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              item.subtitle,
              style: TextStyle(
                color: AppColors.mutedText.withValues(alpha: 0.7),
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.play_arrow_rounded,
                        size: 16,
                        color: AppColors.deepSpace,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        'شغل',
                        style: const TextStyle(
                          color: AppColors.deepSpace,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '4 دقائق',
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.6),
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CharacterOrbitRail extends StatelessWidget {
  const _CharacterOrbitRail({
    required this.padding,
    required this.isTelevision,
    required this.catalog,
  });
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
              const Text(
                'شخصيات محبوبة',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 6),
              Icon(
                Icons.chevron_left_rounded,
                color: Colors.white.withValues(alpha: 0.62),
                size: 20,
              ),
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
              return CharacterCircleCard(
                name: s.title.split(' ').first,
                imageAsset: s.posterAsset,
                onPressed: () => context.push('/series/${s.id}'),
                size: isTelevision ? 88 : 72,
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ComingSoonRail extends StatelessWidget {
  const _ComingSoonRail({
    required this.padding,
    required this.isTelevision,
    required this.catalog,
    this.title,
    this.subtitle,
  });
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
          child: Row(
            children: [
              Text(
                title ?? 'قريباً',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 6),
              Icon(
                Icons.chevron_left_rounded,
                color: Colors.white.withValues(alpha: 0.62),
                size: 20,
              ),
            ],
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Padding(
            padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
            child: Text(
              subtitle!,
              style: TextStyle(
                color: AppColors.mutedText.withValues(alpha: 0.62),
                fontSize: 11.5,
              ),
            ),
          ),
        ],
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
                  SeriesCard(
                    item: item,
                    isTelevision: isTelevision,
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          '${item.title} — لم يُعلن موعد العرض بعد',
                        ),
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.22),
                            Colors.black.withValues(alpha: 0.55),
                          ],
                        ),
                      ),
                    ),
                  ),
                  PositionedDirectional(
                    top: 8,
                    start: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE5485D),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.calendar_today_rounded,
                            color: Colors.white,
                            size: 10,
                          ),
                          SizedBox(width: 4),
                          Text(
                            'قريباً',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  PositionedDirectional(
                    bottom: 48,
                    start: 10,
                    end: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.62),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.12),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.notifications_none_rounded,
                            color: AppColors.starGold,
                            size: 14,
                          ),
                          const SizedBox(width: 4),
                          const Text(
                            'ذكرني',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
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

// ignore: unused_element
class _MostWatchedRail extends StatelessWidget {
  const _MostWatchedRail({
    required this.padding,
    required this.isTelevision,
    required this.items,
  });
  final double padding;
  final bool isTelevision;
  final List<SeriesItem> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
          child: Row(
            children: [
              const Text(
                'الأكثر مشاهدة',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 6),
              Icon(
                Icons.chevron_left_rounded,
                color: Colors.white.withValues(alpha: 0.62),
                size: 20,
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Padding(
          padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
          child: Text(
            'يتصدر المشاهدات هذا الأسبوع',
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.62),
              fontSize: 11.5,
            ),
          ),
        ),
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
                  SeriesCard(
                    item: item,
                    isTelevision: isTelevision,
                    onPressed: () => context.push('/series/${item.id}'),
                  ),
                  PositionedDirectional(
                    top: -6,
                    start: -6,
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: index == 0
                            ? AppColors.starGold
                            : index == 1
                            ? const Color(0xFFAAB5D1)
                            : index == 2
                            ? const Color(0xFFD9903D)
                            : const Color(0xFF1B2550),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.18),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.32),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          '${index + 1}',
                          style: TextStyle(
                            color: index < 3
                                ? AppColors.deepSpace
                                : Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
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

/// A seasonal banner, entirely from Home Builder configuration.
///
/// The card used to hardcode «رمضان - حكايات تضيء القلب» and «موسم جديد», which
/// were shown for whatever season an editor had actually scheduled — the seeded
/// block is a *winter* season. Its visibility rule now requires a configured
/// title, so an unconfigured seasonal block renders nothing rather than
/// announcing the wrong season.
class _SeasonalBannerCard extends StatelessWidget {
  const _SeasonalBannerCard({required this.title, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 140,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          colors: [
            const Color(0xFF2A1B5A),
            const Color(0xFF1B2550),
            const Color(0xFF0A102A),
          ],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 10),
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.mutedText.withValues(alpha: 0.75),
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.08),
              border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
            ),
            child: const Icon(
              Icons.nights_stay_rounded,
              color: AppColors.starGold,
              size: 36,
            ),
          ),
        ],
      ),
    );
  }
}

/// Shown when the Home layout came from the built-in fallback, not the server.
///
/// A configured Home and a fallback Home are different states, and the child's
/// screen is the wrong place to hide that from an operator testing a change: the
/// row order they just saved either arrived or it did not.
class _LayoutFallbackNotice extends StatelessWidget {
  const _LayoutFallbackNotice({required this.onRefresh});
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.indigoSurface.withValues(alpha: 0.76),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.starGold.withValues(alpha: 0.24)),
        ),
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(14, 7, 8, 7),
          child: Row(
            children: [
              const Icon(
                Icons.tune_rounded,
                color: AppColors.starGold,
                size: 20,
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  'نعرض ترتيب الصفحة الافتراضي حتى يصل إعداد الصفحة الرئيسية.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: AppColors.starlight),
                ),
              ),
              IconButton(
                tooltip: 'إعادة المحاولة',
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
        ),
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
        Image.asset(
          'assets/brand/majarra-logo.png',
          width: compact ? 40 : 46,
          height: 40,
          fit: BoxFit.contain,
          semanticLabel: 'مجرة',
        ),
        if (!compact) ...[
          const SizedBox(width: 7),
          Text('مجرة', style: Theme.of(context).textTheme.titleLarge),
        ],
        const Spacer(),
        _HeaderTextAction(label: 'الكواكب', onPressed: onOpenPlanets),
        _HeaderTextAction(
          label: 'السلاسل',
          onPressed: catalog.series.isEmpty
              ? null
              : () => context.push('/series/${catalog.series.first.id}'),
        ),
        const SizedBox(width: 2),
        FilledButton(
          onPressed: freeSeries == null
              ? null
              : () => context.push('/series/${freeSeries.id}'),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.starGold,
            foregroundColor: AppColors.deepSpace,
            minimumSize: const Size(0, 40),
            padding: EdgeInsets.symmetric(horizontal: compact ? 9 : 13),
            visualDensity: VisualDensity.compact,
          ),
          child: Text(
            compact ? 'مجانًا' : 'جرّب مجانًا',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
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
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: AppColors.starlight,
        minimumSize: const Size(0, 40),
        padding: const EdgeInsets.symmetric(horizontal: 7),
        visualDensity: VisualDensity.compact,
      ),
      child: Text(label, maxLines: 1),
    );
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
        decoration: BoxDecoration(
          color: AppColors.indigoSurface.withValues(alpha: 0.76),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppColors.electricCyan.withValues(alpha: 0.18),
          ),
        ),
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(14, 7, 8, 7),
          child: Row(
            children: [
              const Icon(
                Icons.cloud_off_outlined,
                color: AppColors.electricCyan,
                size: 20,
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  'نعرض المكتبة المحلية الآمنة حتى يصبح المحتوى المنشور متاحًا.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: AppColors.starlight),
                ),
              ),
              IconButton(
                tooltip: 'تحديث المحتوى',
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh_rounded),
              ),
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
              Text(
                'لا توجد رحلات متاحة الآن',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('تحديث المكتبة'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
